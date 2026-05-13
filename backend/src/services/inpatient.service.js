const {
  Admission,
  Bed,
  BedAssignment,
  Charge,
  Department,
  Encounter,
  Patient,
  Room,
  ServiceCatalog,
  User,
} = require('../models');
const { PERMISSION } = require('../constants/permissions');
const {
  ADMISSION_STATUS,
  BED_ASSIGNMENT_STATUS,
  BED_STATUS,
  CHARGE_STATUS,
  DEPARTMENT_STATUS,
  ENCOUNTER_STATUS,
  PATIENT_STATUS,
  ROOM_STATUS,
  SERVICE_STATUS,
  SERVICE_TYPE,
  USER_STATUS,
} = require('../constants/statuses');
const {
  ADMISSION_TRANSITIONS,
  BED_ASSIGNMENT_TRANSITIONS,
  BED_TRANSITIONS,
} = require('../constants/transitions');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  getStartOfDay,
  recordAuditLog,
} = require('./core.service');
const { CODE_TYPE, generateBusinessCode } = require('./code-generator.service');
const permissionService = require('./permission.service');
const { assertTransition } = require('../shared/utils/status-transition');
const { withOptionalTransaction } = require('../shared/utils/transaction');

const ACTIVE_ADMISSION_STATUSES = [
  ADMISSION_STATUS.PLANNED,
  ADMISSION_STATUS.ADMITTED,
  ADMISSION_STATUS.TRANSFERRED,
];

const ASSIGNABLE_ADMISSION_STATUSES = [
  ADMISSION_STATUS.PLANNED,
  ADMISSION_STATUS.ADMITTED,
  ADMISSION_STATUS.TRANSFERRED,
];

const ROOM_ASSIGNABLE_STATUSES = [ROOM_STATUS.ACTIVE];
const ACTIVE_CHARGE_EXCLUDED_STATUSES = [
  CHARGE_STATUS.VOIDED,
  CHARGE_STATUS.CANCELLED,
  CHARGE_STATUS.REFUNDED,
];

function sessionOptions(session) {
  return session ? { session } : {};
}

function withSession(query, session) {
  return session ? query.session(session) : query;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function sameId(left, right) {
  if (!left || !right) return false;
  return String(left?._id || left) === String(right?._id || right);
}

function actorType(actor = {}) {
  return actor.actorType || actor.actor_type;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function hasPermission(actor = {}, permissionCode) {
  return permissionService.hasPermission(actor.permissions || [], permissionCode);
}

function hasAnyPermission(actor = {}, permissions = []) {
  return permissionService.hasAnyPermission(actor.permissions || [], permissions.filter(Boolean));
}

function assertStaffPermission(actor = {}, permissions = [], message = 'Bạn không có quyền thao tác Inpatient Module.') {
  if (actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (actorType(actor) !== 'staff') throw createError(message, 403);
  if (!hasAnyPermission(actor, Array.isArray(permissions) ? permissions : [permissions])) {
    throw createError(message, 403);
  }
  return true;
}

function assertPatientSelf(actor = {}, patientId) {
  if (actorType(actor) !== 'patient') return false;
  if (!hasPermission(actor, PERMISSION.ADMISSIONS.SELF_READ)) {
    throw createError('Tài khoản bệnh nhân không có quyền xem admission.', 403);
  }
  if (!sameId(actor.patientId || actor.patient_id, patientId)) {
    throw createError('Bạn chỉ được xem admission của chính mình.', 403);
  }
  return true;
}

function formatDayKey(value) {
  const date = getStartOfDay(value || new Date());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value, days) {
  const date = getStartOfDay(value || new Date());
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function isDuplicateKeyError(error = {}) {
  return error?.code === 11000 || String(error?.message || '').includes('E11000 duplicate key error');
}

function isTransactionConflictError(error = {}) {
  const message = String(error?.message || '');
  return (
    message.includes('WriteConflict')
    || message.includes('TransientTransactionError')
    || message.includes('Transaction aborted')
    || message.includes('conflict')
  );
}

function assertDepartmentScope(actor = {}, departmentId, { globalPermissions = [], message = 'Bạn không có quyền thao tác trên department này.' } = {}) {
  if (actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (hasAnyPermission(actor, globalPermissions)) return true;
  const actorDept = actorDepartmentId(actor);
  if (!actorDept) throw createError('Thiếu department scope của staff.', 403);
  if (sameId(actorDept, departmentId)) return true;
  throw createError(message, 403);
}

function isWithinActorDepartment(actor = {}, departmentId) {
  const actorDept = actorDepartmentId(actor);
  return Boolean(actorDept) && sameId(actorDept, departmentId);
}

function parseDate(value, fieldName) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw createError(`${fieldName} không hợp lệ.`, 400);
  return date;
}

function parseNonNegativeNumber(value, fieldName, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) throw createError(`${fieldName} không hợp lệ.`, 400);
  return numberValue;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function generateAdmissionNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.ADMISSION, options);
}

async function generateChargeNumber(options = {}) {
  return generateBusinessCode(CODE_TYPE.CHARGE, options);
}

async function assertDepartmentActive(departmentId, session = null) {
  const department = await withSession(Department.findById(departmentId), session);
  if (!department || department.is_deleted) throw createError('Không tìm thấy department.', 404);
  if (department.status !== DEPARTMENT_STATUS.ACTIVE) throw createError('Department không active.', 409);
  return department;
}

async function assertPatientActive(patientId, session = null) {
  const patient = await withSession(Patient.findById(patientId), session);
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy patient.', 404);
  if (patient.status !== PATIENT_STATUS.ACTIVE) throw createError('Patient không active.', 409);
  return patient;
}

async function assertUserActive(userId, label = 'User', session = null) {
  const user = await withSession(User.findById(userId), session);
  if (!user || user.is_deleted) throw createError(`Không tìm thấy ${label}.`, 404);
  if (user.status !== USER_STATUS.ACTIVE) throw createError(`${label} không active.`, 409);
  return user;
}

function applyDepartmentReadScope(filter, actor = {}, permissions = {}) {
  if (hasAnyPermission(actor, permissions.global || [])) return filter;
  const departmentId = actorDepartmentId(actor);
  if (departmentId && hasAnyPermission(actor, permissions.department || [])) {
    return { ...filter, department_id: departmentId };
  }
  return filter;
}

function assertRoomAccess(room, actor = {}, write = false) {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (write) {
    if (hasAnyPermission(actor, [PERMISSION.ROOMS.MANAGE])) return true;
    return assertDepartmentScope(actor, room.department_id, {
      globalPermissions: [PERMISSION.ROOMS.MANAGE],
      message: 'Bạn không có quyền sửa room của department này.',
    });
  }
  if (hasAnyPermission(actor, [PERMISSION.ROOMS.READ, PERMISSION.ROOMS.MANAGE])) return true;
  if (hasPermission(actor, PERMISSION.ROOMS.READ_DEPARTMENT) && isWithinActorDepartment(actor, room.department_id)) return true;
  throw createError('Bạn không có quyền truy cập room này.', 403);
}

function assertBedAccessForRoom(room, actor = {}, write = false) {
  if (hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (write) {
    if (hasAnyPermission(actor, [PERMISSION.BEDS.MANAGE])) return true;
    return assertDepartmentScope(actor, room.department_id, {
      globalPermissions: [PERMISSION.BEDS.MANAGE],
      message: 'Bạn không có quyền sửa bed của department này.',
    });
  }
  if (hasAnyPermission(actor, [PERMISSION.BEDS.READ, PERMISSION.BEDS.MANAGE])) return true;
  if (hasPermission(actor, PERMISSION.BEDS.READ_DEPARTMENT) && isWithinActorDepartment(actor, room.department_id)) return true;
  throw createError('Bạn không có quyền truy cập bed này.', 403);
}

async function getRoomBedSummary(roomIds = [], session = null) {
  if (roomIds.length === 0) return new Map();
  const rows = await Bed.aggregate([
    { $match: { room_id: { $in: roomIds }, is_deleted: false } },
    {
      $group: {
        _id: { room_id: '$room_id', status: '$status' },
        count: { $sum: 1 },
      },
    },
  ]).session(session || null);

  const summary = new Map();
  for (const row of rows) {
    const key = String(row._id.room_id);
    const current = summary.get(key) || {
      total_beds: 0,
      available_beds: 0,
      occupied_beds: 0,
      reserved_beds: 0,
      maintenance_beds: 0,
      blocked_beds: 0,
      inactive_beds: 0,
    };
    current.total_beds += row.count;
    const statusKey = `${row._id.status}_beds`;
    if (Object.prototype.hasOwnProperty.call(current, statusKey)) current[statusKey] += row.count;
    summary.set(key, current);
  }
  return summary;
}

async function createRoom(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ROOMS.CREATE, PERMISSION.ROOMS.MANAGE]);
  const roomCode = normalizeString(payload.room_code).toUpperCase();
  const roomName = normalizeString(payload.room_name);
  if (!roomCode) throw createError('room_code là bắt buộc.', 400);
  if (!roomName) throw createError('room_name là bắt buộc.', 400);
  await assertDepartmentActive(payload.department_id);
  assertDepartmentScope(actor, payload.department_id, {
    globalPermissions: [PERMISSION.ROOMS.MANAGE],
    message: 'Bạn không có quyền tạo room cho department này.',
  });
  if (payload.service_id) await assertRoomChargeService(payload.service_id);
  const exists = await Room.exists({ room_code: roomCode, is_deleted: false });
  if (exists) throw createError('room_code đã tồn tại.', 409);
  let room;
  try {
    room = await Room.create({
      department_id: payload.department_id,
      service_id: payload.service_id,
      room_code: roomCode,
      room_name: roomName,
      room_type: payload.room_type,
      floor: normalizeString(payload.floor),
      building: normalizeString(payload.building),
      capacity: parseNonNegativeNumber(payload.capacity, 'capacity', 0),
      notes: normalizeString(payload.notes),
      status: payload.status || ROOM_STATUS.ACTIVE,
      created_by: actor.userId,
      updated_by: actor.userId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw createError('room_code đã tồn tại.', 409);
    throw error;
  }
  await recordAuditLog({ actor, action: 'rooms.create', targetType: 'room', targetId: room._id, status: 'success', message: 'Tạo room thành công.', requestMeta });
  return getRoomDetail(room._id, actor);
}

async function listRooms(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.ROOMS.READ, PERMISSION.ROOMS.READ_DEPARTMENT, PERMISSION.ROOMS.MANAGE]);
  const { page, limit, skip } = getPagination(query);
  let filter = { is_deleted: false };
  for (const field of ['department_id', 'room_type', 'floor', 'building', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  const keyword = normalizeString(query.keyword || query.search);
  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { room_code: { $regex: pattern, $options: 'i' } },
      { room_name: { $regex: pattern, $options: 'i' } },
    ];
  }
  filter = applyDepartmentReadScope(filter, actor, {
    global: [PERMISSION.ROOMS.READ, PERMISSION.ROOMS.MANAGE],
    department: [PERMISSION.ROOMS.READ_DEPARTMENT],
  });
  const [items, total] = await Promise.all([
    Room.find(filter)
      .sort({ department_id: 1, room_code: 1 })
      .skip(skip)
      .limit(limit)
      .populate('department_id', 'department_code department_name')
      .populate('service_id', 'service_code service_name unit_price')
      .lean(),
    Room.countDocuments(filter),
  ]);
  const summary = query.include_bed_summary === 'false'
    ? new Map()
    : await getRoomBedSummary(items.map((room) => room._id));
  return {
    items: items.map((room) => ({ ...room, bed_summary: summary.get(String(room._id)) || undefined })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getRoomDetail(roomId, actor = {}) {
  const room = await Room.findOne({ _id: roomId, is_deleted: false })
    .populate('department_id', 'department_code department_name status')
    .populate('service_id', 'service_code service_name unit_price')
    .lean();
  if (!room) throw createError('Không tìm thấy room.', 404);
  assertRoomAccess(room, actor);
  const beds = await Bed.find({ room_id: room._id, is_deleted: false }).sort({ bed_code: 1 }).lean();
  const summary = await getRoomBedSummary([room._id]);
  return { ...room, beds, bed_summary: summary.get(String(room._id)) || null };
}

async function roomHasActiveAssignments(roomId, session = null) {
  const beds = await withSession(Bed.find({ room_id: roomId, is_deleted: false }).select('_id').lean(), session);
  const bedIds = beds.map((bed) => bed._id);
  if (bedIds.length === 0) return false;
  return withSession(BedAssignment.exists({ bed_id: { $in: bedIds }, status: BED_ASSIGNMENT_STATUS.ACTIVE }), session);
}

async function updateRoom(roomId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ROOMS.UPDATE, PERMISSION.ROOMS.MANAGE]);
  const room = await Room.findOne({ _id: roomId, is_deleted: false });
  if (!room) throw createError('Không tìm thấy room.', 404);
  assertRoomAccess(room, actor, true);
  const before = room.toObject();
  const activeAssignments = await roomHasActiveAssignments(room._id);
  if ((payload.department_id || payload.room_type) && activeAssignments) {
    throw createError('Room đang có active bed assignment, không được đổi department/room_type.', 409);
  }
  if ([ROOM_STATUS.INACTIVE, ROOM_STATUS.MAINTENANCE, ROOM_STATUS.CLOSED].includes(payload.status) && activeAssignments) {
    throw createError('Room đang có bệnh nhân/giường active, không thể chuyển inactive/maintenance/closed.', 409);
  }
  if (payload.department_id !== undefined) {
    await assertDepartmentActive(payload.department_id);
    if (!hasAnyPermission(actor, [PERMISSION.ROOMS.MANAGE])) {
      assertDepartmentScope(actor, payload.department_id, {
        globalPermissions: [PERMISSION.ROOMS.MANAGE],
        message: 'Bạn không có quyền đổi room sang department này.',
      });
    }
    room.department_id = payload.department_id;
  }
  if (payload.service_id !== undefined) {
    if (payload.service_id) await assertRoomChargeService(payload.service_id);
    room.service_id = payload.service_id || undefined;
  }
  for (const field of ['room_name', 'room_type', 'floor', 'building', 'notes', 'status']) {
    if (payload[field] !== undefined) room[field] = typeof payload[field] === 'string' ? normalizeString(payload[field]) : payload[field];
  }
  if (payload.capacity !== undefined) room.capacity = parseNonNegativeNumber(payload.capacity, 'capacity', 0);
  room.updated_by = actor.userId;
  await room.save();
  await recordAuditLog({ actor, action: 'rooms.update', targetType: 'room', targetId: room._id, status: 'success', message: 'Cập nhật room thành công.', requestMeta, before, after: room.toObject() });
  return getRoomDetail(room._id, actor);
}

async function deleteRoomSoft(roomId, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ROOMS.DELETE, PERMISSION.ROOMS.MANAGE]);
  const room = await Room.findOne({ _id: roomId, is_deleted: false });
  if (!room) throw createError('Không tìm thấy room.', 404);
  assertRoomAccess(room, actor, true);
  const activeAssignments = await roomHasActiveAssignments(room._id);
  if (activeAssignments) throw createError('Không thể xóa room đang có active bed assignment.', 409);
  const activeBeds = await Bed.exists({
    room_id: room._id,
    is_deleted: false,
    status: { $in: [BED_STATUS.OCCUPIED, BED_STATUS.RESERVED] },
  });
  if (activeBeds) throw createError('Không thể xóa room có bed occupied/reserved.', 409);
  room.is_deleted = true;
  room.deleted_at = new Date();
  room.deleted_by = actor.userId;
  room.updated_by = actor.userId;
  await room.save();
  await recordAuditLog({ actor, action: 'rooms.delete_soft', targetType: 'room', targetId: room._id, status: 'success', message: 'Soft delete room thành công.', requestMeta });
  return { deleted: true, room_id: String(room._id) };
}

async function getRoomForBed(roomId, session = null) {
  const room = await withSession(Room.findOne({ _id: roomId, is_deleted: false }), session);
  if (!room) throw createError('Không tìm thấy room.', 404);
  if (!ROOM_ASSIGNABLE_STATUSES.includes(room.status)) throw createError('Room không active, không thể dùng giường.', 409);
  return room;
}

async function createBed(payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.BEDS.CREATE, PERMISSION.BEDS.MANAGE]);
  const bedCode = normalizeString(payload.bed_code).toUpperCase();
  if (!bedCode) throw createError('bed_code là bắt buộc.', 400);
  const room = await getRoomForBed(payload.room_id);
  assertBedAccessForRoom(room, actor, true);
  assertDepartmentScope(actor, room.department_id, {
    globalPermissions: [PERMISSION.BEDS.MANAGE],
    message: 'Bạn không có quyền tạo bed cho department này.',
  });
  const exists = await Bed.exists({ bed_code: bedCode, is_deleted: false });
  if (exists) throw createError('bed_code đã tồn tại.', 409);
  let bed;
  try {
    bed = await Bed.create({
      room_id: room._id,
      bed_code: bedCode,
      bed_name: normalizeString(payload.bed_name),
      bed_type: payload.bed_type,
      notes: normalizeString(payload.notes),
      status: BED_STATUS.AVAILABLE,
      created_by: actor.userId,
      updated_by: actor.userId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw createError('bed_code đã tồn tại.', 409);
    throw error;
  }
  await recordAuditLog({ actor, action: 'beds.create', targetType: 'bed', targetId: bed._id, status: 'success', message: 'Tạo bed thành công.', requestMeta });
  return getBedDetail(bed._id, actor);
}

async function buildBedFilterFromRoomQuery(query = {}) {
  const roomFilter = { is_deleted: false };
  for (const field of ['department_id', 'floor', 'building', 'room_type']) {
    if (query[field]) roomFilter[field] = query[field];
  }
  const hasRoomFilter = Object.keys(roomFilter).length > 1;
  if (!hasRoomFilter) return {};
  const rooms = await Room.find(roomFilter).select('_id').lean();
  return { room_id: { $in: rooms.map((room) => room._id) } };
}

async function listBeds(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.BEDS.READ, PERMISSION.BEDS.READ_DEPARTMENT, PERMISSION.BEDS.MANAGE]);
  const { page, limit, skip } = getPagination(query);
  let filter = { is_deleted: false };
  for (const field of ['room_id', 'bed_type', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  Object.assign(filter, await buildBedFilterFromRoomQuery(query));
  if (!hasAnyPermission(actor, [PERMISSION.BEDS.READ, PERMISSION.BEDS.MANAGE]) && hasPermission(actor, PERMISSION.BEDS.READ_DEPARTMENT)) {
    const rooms = await Room.find({ department_id: actorDepartmentId(actor), is_deleted: false }).select('_id').lean();
    filter.room_id = { $in: rooms.map((room) => room._id) };
  }
  const [items, total] = await Promise.all([
    Bed.find(filter)
      .sort({ bed_code: 1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'room_id', select: 'room_code room_name room_type department_id floor building status', populate: { path: 'department_id', select: 'department_code department_name' } })
      .lean(),
    Bed.countDocuments(filter),
  ]);
  const activeAssignments = await BedAssignment.find({
    bed_id: { $in: items.map((bed) => bed._id) },
    status: BED_ASSIGNMENT_STATUS.ACTIVE,
  }).populate('admission_id', 'admission_no patient_id status').lean();
  const assignmentByBed = new Map(activeAssignments.map((assignment) => [String(assignment.bed_id), assignment]));
  return {
    items: items.map((bed) => ({ ...bed, current_assignment: assignmentByBed.get(String(bed._id)) || null })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getBedDetail(bedId, actor = {}) {
  const bed = await Bed.findOne({ _id: bedId, is_deleted: false })
    .populate({ path: 'room_id', select: 'room_code room_name room_type department_id floor building status service_id', populate: { path: 'department_id', select: 'department_code department_name status' } })
    .lean();
  if (!bed) throw createError('Không tìm thấy bed.', 404);
  assertBedAccessForRoom({ department_id: bed.room_id?.department_id?._id || bed.room_id?.department_id }, actor);
  const [activeAssignment, history] = await Promise.all([
    BedAssignment.findOne({ bed_id: bed._id, status: BED_ASSIGNMENT_STATUS.ACTIVE })
      .populate('admission_id', 'admission_no patient_id status admitted_at')
      .lean(),
    BedAssignment.find({ bed_id: bed._id })
      .sort({ assigned_from: -1 })
      .limit(20)
      .populate('admission_id', 'admission_no patient_id status')
      .lean(),
  ]);
  return { ...bed, current_assignment: activeAssignment, assignment_history: history };
}

async function updateBed(bedId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.BEDS.UPDATE, PERMISSION.BEDS.STATUS_UPDATE, PERMISSION.BEDS.MANAGE]);
  const bed = await Bed.findOne({ _id: bedId, is_deleted: false }).populate('room_id');
  if (!bed) throw createError('Không tìm thấy bed.', 404);
  assertBedAccessForRoom(bed.room_id, actor, true);
  const activeAssignment = await BedAssignment.exists({ bed_id: bed._id, status: BED_ASSIGNMENT_STATUS.ACTIVE });
  if (activeAssignment && (payload.room_id || [BED_STATUS.MAINTENANCE, BED_STATUS.BLOCKED, BED_STATUS.INACTIVE, BED_STATUS.AVAILABLE].includes(payload.status))) {
    throw createError('Bed đang có active assignment, không thể đổi room/status trực tiếp.', 409);
  }
  if (payload.room_id !== undefined) {
    const room = await getRoomForBed(payload.room_id);
    assertBedAccessForRoom(room, actor, true);
    assertDepartmentScope(actor, room.department_id, {
      globalPermissions: [PERMISSION.BEDS.MANAGE],
      message: 'Bạn không có quyền đổi bed sang department này.',
    });
    bed.room_id = room._id;
  }
  for (const field of ['bed_name', 'bed_type', 'notes']) {
    if (payload[field] !== undefined) bed[field] = normalizeString(payload[field]);
  }
  if (payload.status !== undefined) {
    assertTransition(BED_TRANSITIONS, bed.status, payload.status, 'bed');
    bed.status = payload.status;
  }
  bed.updated_by = actor.userId;
  await bed.save();
  await recordAuditLog({ actor, action: 'beds.update', targetType: 'bed', targetId: bed._id, status: 'success', message: 'Cập nhật bed thành công.', requestMeta });
  return getBedDetail(bed._id, actor);
}

async function getAvailableBeds(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.BEDS.AVAILABLE_READ, PERMISSION.BEDS.AVAILABLE_READ_DEPARTMENT, PERMISSION.BEDS.READ, PERMISSION.BEDS.READ_DEPARTMENT]);
  const beds = await listBeds({ ...query, status: BED_STATUS.AVAILABLE, limit: query.limit || 100 }, actor);
  const available = beds.items.filter((bed) => {
    const roomStatus = bed.room_id?.status;
    return roomStatus === ROOM_STATUS.ACTIVE && !bed.current_assignment;
  });
  return { ...beds, items: available };
}

async function getBedAvailability(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.BEDS.AVAILABLE_READ, PERMISSION.BEDS.AVAILABLE_READ_DEPARTMENT, PERMISSION.BEDS.READ, PERMISSION.BEDS.READ_DEPARTMENT]);
  let roomFilter = { is_deleted: false };
  for (const field of ['department_id', 'room_id', 'room_type', 'floor', 'building']) {
    if (query[field]) {
      if (field === 'room_id') roomFilter._id = query[field];
      else roomFilter[field] = query[field];
    }
  }
  if (!hasAnyPermission(actor, [PERMISSION.BEDS.AVAILABLE_READ, PERMISSION.BEDS.READ, PERMISSION.BEDS.MANAGE]) && hasAnyPermission(actor, [PERMISSION.BEDS.AVAILABLE_READ_DEPARTMENT, PERMISSION.BEDS.READ_DEPARTMENT])) {
    roomFilter.department_id = actorDepartmentId(actor);
  }
  const rooms = await Room.find(roomFilter).populate('department_id', 'department_code department_name').lean();
  const roomIds = rooms.map((room) => room._id);
  const bedFilter = { room_id: { $in: roomIds }, is_deleted: false };
  if (query.bed_type) bedFilter.bed_type = query.bed_type;
  if (query.status) bedFilter.status = query.status;
  const beds = await Bed.find(bedFilter).lean();
  const activeAssignments = beds.length
    ? await BedAssignment.find({ bed_id: { $in: beds.map((bed) => bed._id) }, status: BED_ASSIGNMENT_STATUS.ACTIVE }).lean()
    : [];
  const activeBedIds = new Set(activeAssignments.map((assignment) => String(assignment.bed_id)));
  const roomMap = new Map(rooms.map((room) => [String(room._id), room]));
  const summary = {
    total_beds: beds.length,
    available: 0,
    occupied: 0,
    reserved: 0,
    maintenance: 0,
    blocked: 0,
    inactive: 0,
    data_mismatch_active_assignment_on_available_bed: 0,
  };
  const byRoom = new Map();
  for (const bed of beds) {
    const room = roomMap.get(String(bed.room_id));
    const key = String(bed.room_id);
    const row = byRoom.get(key) || {
      room,
      total_beds: 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
      blocked: 0,
      inactive: 0,
    };
    row.total_beds += 1;
    summary[bed.status] = (summary[bed.status] || 0) + 1;
    row[bed.status] = (row[bed.status] || 0) + 1;
    if (bed.status === BED_STATUS.AVAILABLE && activeBedIds.has(String(bed._id))) {
      summary.data_mismatch_active_assignment_on_available_bed += 1;
    }
    byRoom.set(key, row);
  }
  return { summary, rooms: [...byRoom.values()] };
}

async function validateAdmissionCreation(encounterId, payload = {}, actor = {}, session = null) {
  assertStaffPermission(actor, [PERMISSION.ADMISSIONS.CREATE, PERMISSION.ADMISSIONS.CREATE_OWN]);
  const encounter = await withSession(Encounter.findById(encounterId), session);
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  if (encounter.status === ENCOUNTER_STATUS.CANCELLED) throw createError('Encounter đã cancelled.', 409);
  if (encounter.status === ENCOUNTER_STATUS.COMPLETED && !payload.allow_completed_encounter_admission) {
    throw createError('Encounter đã completed. Cần allow_completed_encounter_admission=true nếu policy cho phép.', 409);
  }
  const patient = await assertPatientActive(encounter.patient_id, session);
  if (hasPermission(actor, PERMISSION.ADMISSIONS.CREATE_OWN) && !hasPermission(actor, PERMISSION.ADMISSIONS.CREATE) && !sameId(encounter.attending_doctor_id, actor.userId)) {
    throw createError('Doctor chỉ được tạo admission cho encounter của mình.', 403);
  }
  const targetDepartmentId = payload.department_id || encounter.department_id;
  const targetDoctorId = payload.attending_doctor_id || encounter.attending_doctor_id;
  if (payload.patient_id && !sameId(payload.patient_id, encounter.patient_id)) {
    throw createError('patient_id không khớp encounter.', 409);
  }
  if (payload.department_id && !sameId(payload.department_id, encounter.department_id)) {
    throw createError('department_id không khớp encounter.', 409);
  }
  if (payload.attending_doctor_id && !sameId(payload.attending_doctor_id, encounter.attending_doctor_id)) {
    throw createError('attending_doctor_id không khớp encounter.', 409);
  }
  const department = await assertDepartmentActive(targetDepartmentId, session);
  const attendingDoctor = await assertUserActive(targetDoctorId, 'attending_doctor', session);
  if (hasPermission(actor, PERMISSION.ADMISSIONS.CREATE) && !hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) {
    if (!isWithinActorDepartment(actor, department._id)) {
      throw createError('Bạn không có quyền tạo admission cho department này.', 403);
    }
  }
  const activeAdmission = await withSession(Admission.exists({
    patient_id: patient._id,
    status: { $in: ACTIVE_ADMISSION_STATUSES },
  }), session);
  if (activeAdmission && !payload.allow_multiple_active_admissions) {
    throw createError('Patient đang có admission active khác.', 409);
  }
  return { encounter, patient, department, attendingDoctor };
}

async function createAdmissionFromEncounter(encounterId, payload = {}, actor = {}, requestMeta = {}) {
  let admissionId;
  let idempotent = false;
  try {
    await withOptionalTransaction(async (session) => {
      const validation = await validateAdmissionCreation(encounterId, payload, actor, session);
      const existing = await withSession(Admission.findOne({ encounter_id: validation.encounter._id }), session);
      if (existing) {
        admissionId = existing._id;
        idempotent = true;
        return;
      }
      const status = payload.status || ADMISSION_STATUS.PLANNED;
      if (![ADMISSION_STATUS.PLANNED, ADMISSION_STATUS.ADMITTED].includes(status)) {
        throw createError('Admission mới chỉ được tạo planned/admitted.', 400);
      }
      const admissionNo = payload.admission_no || await generateAdmissionNumber({ session });
      const admittedAt = status === ADMISSION_STATUS.ADMITTED
        ? parseDate(payload.admitted_at, 'admitted_at') || new Date()
        : parseDate(payload.admitted_at, 'admitted_at');
      const [admission] = await Admission.create([{
        patient_id: validation.patient._id,
        encounter_id: validation.encounter._id,
        department_id: validation.department._id,
        attending_doctor_id: validation.attendingDoctor._id,
        admission_no: admissionNo,
        admission_type: payload.admission_type,
        admitted_at: admittedAt,
        admitted_by: status === ADMISSION_STATUS.ADMITTED ? actor.userId : undefined,
        reason: normalizeString(payload.reason),
        status,
        created_by: actor.userId,
        updated_by: actor.userId,
      }], sessionOptions(session));
      admissionId = admission._id;
    }, { fallbackToNoTransaction: false });
  } catch (error) {
    if (!admissionId && isDuplicateKeyError(error)) {
      const existing = await Admission.findOne({ encounter_id: encounterId }).lean();
      if (existing) {
        admissionId = existing._id;
        idempotent = true;
      } else {
        throw error;
      }
    } else {
      await recordAuditLog({
        actor,
        action: 'admissions.create',
        targetType: 'admission',
        targetId: admissionId || encounterId,
        status: 'failure',
        message: 'Tạo admission thất bại.',
        requestMeta,
        metadata: { error: error.message },
      });
      throw error;
    }
  }
  await recordAuditLog({ actor, action: 'admissions.create', targetType: 'admission', targetId: admissionId, status: 'success', message: idempotent ? 'Tạo admission thành công (idempotent).' : 'Tạo admission thành công.', requestMeta, metadata: { idempotent } });
  return getAdmissionDetail(admissionId, actor);
}

function assertAdmissionReadAccess(admission, actor = {}) {
  if (actorType(actor) === 'patient') return assertPatientSelf(actor, admission.patient_id);
  if (hasAnyPermission(actor, [PERMISSION.ADMISSIONS.READ, PERMISSION.SYSTEM.FULL_ACCESS])) return true;
  if (hasPermission(actor, PERMISSION.ADMISSIONS.READ_OWN) && sameId(admission.attending_doctor_id, actor.userId)) return true;
  if (hasPermission(actor, PERMISSION.ADMISSIONS.READ_DEPARTMENT) && sameId(admission.department_id, actorDepartmentId(actor))) return true;
  throw createError('Bạn không có quyền xem admission này.', 403);
}

function assertAdmissionWriteScope(admission, actor = {}, { allowOwnDoctor = false, message = 'Bạn không có quyền thao tác trên admission này.' } = {}) {
  if (actor.internal || actor.system || hasPermission(actor, PERMISSION.SYSTEM.FULL_ACCESS)) return true;
  if (allowOwnDoctor && sameId(admission.attending_doctor_id, actor.userId)) return true;
  if (isWithinActorDepartment(actor, admission.department_id)) return true;
  throw createError(message, 403);
}

async function listAdmissions(query = {}, actor = {}) {
  if (actorType(actor) === 'patient') {
    assertPatientSelf(actor, actor.patientId || actor.patient_id);
  } else {
    assertStaffPermission(actor, [PERMISSION.ADMISSIONS.READ, PERMISSION.ADMISSIONS.READ_OWN, PERMISSION.ADMISSIONS.READ_DEPARTMENT]);
  }
  const { page, limit, skip } = getPagination(query);
  let filter = {};
  for (const field of ['patient_id', 'department_id', 'attending_doctor_id', 'status', 'admission_type']) {
    if (query[field]) filter[field] = query[field];
  }
  if (query.admitted_from || query.admitted_to) {
    filter.admitted_at = {};
    const from = parseDate(query.admitted_from, 'admitted_from');
    const to = parseDate(query.admitted_to, 'admitted_to');
    if (from) filter.admitted_at.$gte = from;
    if (to) filter.admitted_at.$lte = to;
  }
  if (query.discharged_from || query.discharged_to) {
    filter.discharged_at = {};
    const from = parseDate(query.discharged_from, 'discharged_from');
    const to = parseDate(query.discharged_to, 'discharged_to');
    if (from) filter.discharged_at.$gte = from;
    if (to) filter.discharged_at.$lte = to;
  }
  if (actorType(actor) === 'patient') {
    filter.patient_id = actor.patientId || actor.patient_id;
  } else if (!hasPermission(actor, PERMISSION.ADMISSIONS.READ)) {
    const scopedConditions = [];
    if (hasPermission(actor, PERMISSION.ADMISSIONS.READ_OWN)) {
      scopedConditions.push({ attending_doctor_id: actor.userId });
    }
    if (hasPermission(actor, PERMISSION.ADMISSIONS.READ_DEPARTMENT)) {
      const departmentId = actorDepartmentId(actor);
      if (!departmentId) throw createError('Thiếu department scope cho admission.', 403);
      scopedConditions.push({ department_id: departmentId });
    }
    if (scopedConditions.length === 0) throw createError('Bạn không có quyền xem danh sách admission.', 403);
    if (scopedConditions.length === 1) {
      Object.assign(filter, scopedConditions[0]);
    } else {
      filter.$or = scopedConditions;
    }
  }
  const [items, total] = await Promise.all([
    Admission.find(filter)
      .sort({ admitted_at: -1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('patient_id', 'patient_code full_name')
      .populate('department_id', 'department_code department_name')
      .populate('attending_doctor_id', 'full_name username employee_code')
      .lean(),
    Admission.countDocuments(filter),
  ]);
  const assignments = await BedAssignment.find({
    admission_id: { $in: items.map((admission) => admission._id) },
    status: BED_ASSIGNMENT_STATUS.ACTIVE,
  }).populate({ path: 'bed_id', select: 'bed_code bed_name bed_type room_id', populate: { path: 'room_id', select: 'room_code room_name' } }).lean();
  const assignmentByAdmission = new Map(assignments.map((assignment) => [String(assignment.admission_id), assignment]));
  return {
    items: items.map((admission) => ({ ...admission, current_bed_assignment: assignmentByAdmission.get(String(admission._id)) || null })),
    pagination: buildPagination(page, limit, total),
  };
}

async function getAdmissionDetail(admissionId, actor = {}) {
  const admission = await Admission.findById(admissionId)
    .populate('patient_id', 'patient_code full_name date_of_birth gender')
    .populate('encounter_id', 'encounter_code encounter_type status start_time')
    .populate('department_id', 'department_code department_name')
    .populate('attending_doctor_id', 'full_name username employee_code')
    .populate('admitted_by', 'full_name username employee_code')
    .populate('discharged_by', 'full_name username employee_code')
    .lean();
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  assertAdmissionReadAccess({
    ...admission,
    patient_id: admission.patient_id?._id || admission.patient_id,
    department_id: admission.department_id?._id || admission.department_id,
    attending_doctor_id: admission.attending_doctor_id?._id || admission.attending_doctor_id,
  }, actor);
  const [currentAssignment, history, charges] = await Promise.all([
    BedAssignment.findOne({ admission_id: admission._id, status: BED_ASSIGNMENT_STATUS.ACTIVE })
      .populate({ path: 'bed_id', select: 'bed_code bed_name bed_type status room_id', populate: { path: 'room_id', select: 'room_code room_name room_type floor building service_id' } })
      .lean(),
    BedAssignment.find({ admission_id: admission._id })
      .sort({ assigned_from: 1 })
      .populate({ path: 'bed_id', select: 'bed_code bed_name bed_type room_id', populate: { path: 'room_id', select: 'room_code room_name room_type' } })
      .lean(),
    hasAnyPermission(actor, [PERMISSION.CHARGES.READ, PERMISSION.INPATIENT_CHARGES.READ])
      ? Charge.find({ admission_id: admission._id }).sort({ charged_at: -1 }).lean()
      : Promise.resolve([]),
  ]);
  return {
    ...admission,
    current_bed_assignment: currentAssignment,
    bed_history: history,
    charges,
    allowed_actions: buildAdmissionAllowedActions(admission, currentAssignment, actor),
  };
}

function buildAdmissionAllowedActions(admission, currentAssignment, actor = {}) {
  const status = admission.status;
  return {
    can_admit: status === ADMISSION_STATUS.PLANNED && hasPermission(actor, PERMISSION.ADMISSIONS.ADMIT),
    can_assign_bed: ASSIGNABLE_ADMISSION_STATUSES.includes(status) && !currentAssignment && hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.CREATE),
    can_transfer_bed: [ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED].includes(status) && Boolean(currentAssignment) && hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.TRANSFER),
    can_release_bed: Boolean(currentAssignment) && hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.RELEASE),
    can_discharge: [ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED].includes(status) && hasAnyPermission(actor, [PERMISSION.ADMISSIONS.DISCHARGE, PERMISSION.ADMISSIONS.DISCHARGE_OWN]),
    can_cancel: ![ADMISSION_STATUS.DISCHARGED, ADMISSION_STATUS.CANCELLED].includes(status) && hasPermission(actor, PERMISSION.ADMISSIONS.CANCEL),
  };
}

async function admitPatient(admissionId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ADMISSIONS.ADMIT]);
  let admittedId;
  try {
    await withOptionalTransaction(async (session) => {
      const admission = await withSession(Admission.findById(admissionId), session);
      if (!admission) throw createError('Không tìm thấy admission.', 404);
      if (admission.status !== ADMISSION_STATUS.PLANNED) throw createError('Admission phải planned trước khi admit.', 409);
      assertAdmissionWriteScope(admission, actor, { message: 'Bạn không có quyền admit admission này.' });
      await assertPatientActive(admission.patient_id, session);
      await assertDepartmentActive(admission.department_id, session);
      await assertUserActive(admission.attending_doctor_id, 'attending_doctor', session);
      assertTransition(ADMISSION_TRANSITIONS, admission.status, ADMISSION_STATUS.ADMITTED, 'admission');
      admission.status = ADMISSION_STATUS.ADMITTED;
      admission.admitted_at = parseDate(payload.admitted_at, 'admitted_at') || admission.admitted_at || new Date();
      admission.admitted_by = actor.userId;
      admission.updated_by = actor.userId;
      await admission.save(sessionOptions(session));
      admittedId = admission._id;
      const activeAssignment = await withSession(BedAssignment.findOne({
        admission_id: admission._id,
        status: BED_ASSIGNMENT_STATUS.ACTIVE,
      }), session);
      if (activeAssignment) {
        const reservedBed = await withSession(Bed.findOne({
          _id: activeAssignment.bed_id,
          status: BED_STATUS.RESERVED,
        }), session);
        if (reservedBed) {
          assertTransition(BED_TRANSITIONS, reservedBed.status, BED_STATUS.OCCUPIED, 'bed');
          reservedBed.status = BED_STATUS.OCCUPIED;
          reservedBed.updated_by = actor.userId;
          await reservedBed.save(sessionOptions(session));
        }
      } else if (normalizeBoolean(payload.require_bed_assignment)) {
        throw createError('Admission active phải có bed assignment theo policy.', 409);
      } else if (payload.bed_id) {
        await assignBedInternal(admission, payload, actor, session);
      }
    }, { fallbackToNoTransaction: false });
  } catch (error) {
    if (isDuplicateKeyError(error) || isTransactionConflictError(error)) {
      throw createError('Admission đang được xử lý bởi một yêu cầu khác, vui lòng thử lại.', 409);
    }
    await recordAuditLog({
      actor,
      action: 'admissions.admit',
      targetType: 'admission',
      targetId: admissionId,
      status: 'failure',
      message: 'Admit patient thất bại.',
      requestMeta,
      metadata: { error: error.message },
    });
    throw error;
  }
  await recordAuditLog({ actor, action: 'admissions.admit', targetType: 'admission', targetId: admittedId, status: 'success', message: 'Admit patient thành công.', requestMeta });
  return getAdmissionDetail(admittedId, actor);
}

async function validateBedAssignment(admissionId, bedId, payload = {}, actor = {}, session = null) {
  const admission = await withSession(Admission.findById(admissionId), session);
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  if (!ASSIGNABLE_ADMISSION_STATUSES.includes(admission.status)) throw createError('Admission không ở trạng thái assign bed.', 409);
  assertAdmissionWriteScope(admission, actor, { message: 'Bạn không có quyền gán bed cho admission này.' });
  await assertPatientActive(admission.patient_id, session);
  const bed = await withSession(Bed.findOne({ _id: bedId, is_deleted: false }), session);
  if (!bed) throw createError('Không tìm thấy bed.', 404);
  const room = await getRoomForBed(bed.room_id, session);
  assertBedAccessForRoom(room, actor, true);
  if (payload.enforce_department_match !== false && !sameId(room.department_id, admission.department_id)) {
    throw createError('Bed thuộc department khác admission.', 409);
  }
  if (bed.status !== BED_STATUS.AVAILABLE) throw createError('Bed không available.', 409);
  const [activeBedAssignment, activeAdmissionAssignment] = await Promise.all([
    withSession(BedAssignment.exists({ bed_id: bed._id, status: BED_ASSIGNMENT_STATUS.ACTIVE }), session),
    withSession(BedAssignment.exists({ admission_id: admission._id, status: BED_ASSIGNMENT_STATUS.ACTIVE }), session),
  ]);
  if (activeBedAssignment) throw createError('Bed đã có active assignment.', 409);
  if (activeAdmissionAssignment) throw createError('Admission đã có active bed assignment.', 409);
  return { admission, bed, room };
}

async function occupyBedAtomic(bedId, nextStatus, actor = {}, session = null) {
  const bed = await Bed.findOneAndUpdate(
    { _id: bedId, is_deleted: false, status: BED_STATUS.AVAILABLE },
    { $set: { status: nextStatus, updated_by: actor.userId } },
    { new: true, ...sessionOptions(session) },
  );
  if (!bed) throw createError('Bed không còn available, vui lòng chọn giường khác.', 409);
  return bed;
}

async function releaseBedAtomic(bedId, actor = {}, session = null) {
  const bed = await withSession(Bed.findOne({ _id: bedId, is_deleted: false }), session);
  if (!bed) throw createError('Không tìm thấy bed khi release.', 404);
  if ([BED_STATUS.OCCUPIED, BED_STATUS.RESERVED].includes(bed.status)) {
    bed.status = BED_STATUS.AVAILABLE;
    bed.updated_by = actor.userId;
    await bed.save(sessionOptions(session));
  }
  return bed;
}

async function assignBedInternal(admission, payload = {}, actor = {}, session = null) {
  const validation = await validateBedAssignment(admission._id, payload.bed_id, payload, actor, session);
  const assignedFrom = parseDate(payload.assigned_from, 'assigned_from') || new Date();
  const shouldReserve = payload.admit_now !== true
    && (payload.mode === 'reserve' || validation.admission.status === ADMISSION_STATUS.PLANNED);
  const bedStatus = shouldReserve ? BED_STATUS.RESERVED : BED_STATUS.OCCUPIED;
  await occupyBedAtomic(validation.bed._id, bedStatus, actor, session);
  if (payload.admit_now === true && validation.admission.status === ADMISSION_STATUS.PLANNED) {
    assertTransition(ADMISSION_TRANSITIONS, validation.admission.status, ADMISSION_STATUS.ADMITTED, 'admission');
    validation.admission.status = ADMISSION_STATUS.ADMITTED;
    validation.admission.admitted_at = assignedFrom;
    validation.admission.admitted_by = actor.userId;
    validation.admission.updated_by = actor.userId;
    await validation.admission.save(sessionOptions(session));
  }
  const [assignment] = await BedAssignment.create([{
    admission_id: validation.admission._id,
    bed_id: validation.bed._id,
    assigned_by: actor.userId,
    assigned_from: assignedFrom,
    note: normalizeString(payload.note),
    status: BED_ASSIGNMENT_STATUS.ACTIVE,
    created_by: actor.userId,
    updated_by: actor.userId,
  }], sessionOptions(session));
  return assignment;
}

async function assignBed(admissionId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.BED_ASSIGNMENTS.CREATE]);
  let assignmentId;
  try {
    await withOptionalTransaction(async (session) => {
      const admission = await withSession(Admission.findById(admissionId), session);
      if (!admission) throw createError('Không tìm thấy admission.', 404);
      const assignment = await assignBedInternal(admission, payload, actor, session);
      assignmentId = assignment._id;
    }, { fallbackToNoTransaction: false });
  } catch (error) {
    if (isDuplicateKeyError(error) || isTransactionConflictError(error)) {
      throw createError('Giường đang được xử lý bởi một yêu cầu khác, vui lòng thử lại.', 409);
    }
    await recordAuditLog({
      actor,
      action: 'bed_assignment.create',
      targetType: 'bed_assignment',
      targetId: admissionId,
      status: 'failure',
      message: 'Assign bed thất bại.',
      requestMeta,
      metadata: { error: error.message },
    });
    throw error;
  }
  await recordAuditLog({ actor, action: 'bed_assignment.create', targetType: 'bed_assignment', targetId: assignmentId, status: 'success', message: 'Assign bed thành công.', requestMeta });
  return getBedAssignmentDetail(assignmentId, actor);
}

async function transferBed(admissionId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.BED_ASSIGNMENTS.TRANSFER, PERMISSION.ADMISSIONS.TRANSFER]);
  const reason = normalizeString(payload.reason || payload.release_reason);
  if (!reason) throw createError('reason là bắt buộc khi transfer bed.', 400);
  let newAssignmentId;
  try {
    await withOptionalTransaction(async (session) => {
      const admission = await withSession(Admission.findById(admissionId), session);
      if (!admission) throw createError('Không tìm thấy admission.', 404);
      if (![ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED].includes(admission.status)) {
        throw createError('Admission phải admitted/transferred trước khi transfer bed.', 409);
      }
      assertAdmissionWriteScope(admission, actor, { message: 'Bạn không có quyền transfer admission này.' });
      const current = await withSession(BedAssignment.findOne({
        admission_id: admission._id,
        status: BED_ASSIGNMENT_STATUS.ACTIVE,
      }), session);
      if (!current) throw createError('Admission chưa có active bed assignment để transfer.', 409);
      if (sameId(current.bed_id, payload.new_bed_id)) throw createError('new_bed_id phải khác bed hiện tại.', 400);
      const transferAt = parseDate(payload.transfer_at, 'transfer_at') || new Date();
      const validation = await validateBedAssignment(admission._id, payload.new_bed_id, { ...payload, bed_id: payload.new_bed_id }, actor, session)
        .catch((error) => {
          if (error.statusCode === 409 && String(error.message || '').includes('Admission đã có active bed assignment')) return null;
          throw error;
        });
      if (!validation) {
        const bed = await withSession(Bed.findOne({ _id: payload.new_bed_id, is_deleted: false }), session);
        if (!bed) throw createError('Không tìm thấy new_bed.', 404);
        const room = await getRoomForBed(bed.room_id, session);
        assertBedAccessForRoom(room, actor, true);
        if (payload.enforce_department_match !== false && !sameId(room.department_id, admission.department_id)) {
          throw createError('New bed thuộc department khác admission.', 409);
        }
        if (bed.status !== BED_STATUS.AVAILABLE) throw createError('New bed không available.', 409);
        const activeBedAssignment = await withSession(BedAssignment.exists({ bed_id: bed._id, status: BED_ASSIGNMENT_STATUS.ACTIVE }), session);
        if (activeBedAssignment) throw createError('New bed đã có active assignment.', 409);
      }
      assertTransition(BED_ASSIGNMENT_TRANSITIONS, current.status, BED_ASSIGNMENT_STATUS.TRANSFERRED, 'bed_assignment');
      current.status = BED_ASSIGNMENT_STATUS.TRANSFERRED;
      current.assigned_to = transferAt;
      current.release_reason = reason;
      current.updated_by = actor.userId;
      await current.save(sessionOptions(session));
      await releaseBedAtomic(current.bed_id, actor, session);
      await occupyBedAtomic(payload.new_bed_id, BED_STATUS.OCCUPIED, actor, session);
      const [nextAssignment] = await BedAssignment.create([{
        admission_id: admission._id,
        bed_id: payload.new_bed_id,
        assigned_by: actor.userId,
        assigned_from: transferAt,
        note: normalizeString(payload.note),
        status: BED_ASSIGNMENT_STATUS.ACTIVE,
        created_by: actor.userId,
        updated_by: actor.userId,
      }], sessionOptions(session));
      if (admission.status === ADMISSION_STATUS.TRANSFERRED) {
        assertTransition(ADMISSION_TRANSITIONS, admission.status, ADMISSION_STATUS.ADMITTED, 'admission');
        admission.status = ADMISSION_STATUS.ADMITTED;
        admission.updated_by = actor.userId;
        await admission.save(sessionOptions(session));
      }
      newAssignmentId = nextAssignment._id;
    }, { fallbackToNoTransaction: false });
  } catch (error) {
    if (isDuplicateKeyError(error) || isTransactionConflictError(error)) {
      throw createError('Giường đang được xử lý bởi một yêu cầu khác, vui lòng thử lại.', 409);
    }
    await recordAuditLog({
      actor,
      action: 'bed_assignment.transfer',
      targetType: 'bed_assignment',
      targetId: admissionId,
      status: 'failure',
      message: 'Transfer bed thất bại.',
      requestMeta,
      metadata: { reason, error: error.message },
    });
    throw error;
  }
  await recordAuditLog({ actor, action: 'bed_assignment.transfer', targetType: 'bed_assignment', targetId: newAssignmentId, status: 'success', message: 'Transfer bed thành công.', requestMeta, metadata: { reason } });
  return getBedAssignmentDetail(newAssignmentId, actor);
}

async function transferBedAssignment(assignmentId, payload = {}, actor = {}, requestMeta = {}) {
  const assignment = await BedAssignment.findById(assignmentId).lean();
  if (!assignment) throw createError('Không tìm thấy bed assignment.', 404);
  if (assignment.status !== BED_ASSIGNMENT_STATUS.ACTIVE) throw createError('Chỉ active assignment mới được transfer.', 409);
  return transferBed(assignment.admission_id, payload, actor, requestMeta);
}

async function releaseBedAssignment(assignmentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.BED_ASSIGNMENTS.RELEASE]);
  let releasedId;
  await withOptionalTransaction(async (session) => {
    const assignment = await withSession(BedAssignment.findById(assignmentId), session);
    if (!assignment) throw createError('Không tìm thấy bed assignment.', 404);
    if (assignment.status !== BED_ASSIGNMENT_STATUS.ACTIVE) throw createError('Chỉ active assignment mới được release.', 409);
    const admission = await withSession(Admission.findById(assignment.admission_id), session);
    if (!admission) throw createError('Không tìm thấy admission của bed assignment.', 404);
    assertAdmissionWriteScope(admission, actor, { message: 'Bạn không có quyền release bed assignment này.' });
    assertTransition(BED_ASSIGNMENT_TRANSITIONS, assignment.status, BED_ASSIGNMENT_STATUS.RELEASED, 'bed_assignment');
    assignment.status = BED_ASSIGNMENT_STATUS.RELEASED;
    assignment.assigned_to = parseDate(payload.released_at, 'released_at') || new Date();
    assignment.release_reason = normalizeString(payload.reason || payload.release_reason || 'released');
    assignment.updated_by = actor.userId;
    await assignment.save(sessionOptions(session));
    await releaseBedAtomic(assignment.bed_id, actor, session);
    releasedId = assignment._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'bed_assignment.release', targetType: 'bed_assignment', targetId: releasedId, status: 'success', message: 'Release bed assignment thành công.', requestMeta });
  return getBedAssignmentDetail(releasedId, actor);
}

async function cancelBedAssignment(assignmentId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.BED_ASSIGNMENTS.CANCEL]);
  const reason = normalizeString(payload.reason || payload.cancel_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  let cancelledId;
  await withOptionalTransaction(async (session) => {
    const assignment = await withSession(BedAssignment.findById(assignmentId), session);
    if (!assignment) throw createError('Không tìm thấy bed assignment.', 404);
    if (assignment.status !== BED_ASSIGNMENT_STATUS.ACTIVE) throw createError('Chỉ active assignment mới được cancel.', 409);
    const admission = await withSession(Admission.findById(assignment.admission_id), session);
    if (!admission) throw createError('Không tìm thấy admission của bed assignment.', 404);
    assertAdmissionWriteScope(admission, actor, { message: 'Bạn không có quyền cancel bed assignment này.' });
    const chargeExists = await withSession(Charge.exists({
      source_module: 'inpatient',
      source_id: assignment._id,
      status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
    }), session);
    if (chargeExists && !payload.allow_cancel_with_charge) {
      throw createError('Assignment đã có charge active, nên release/adjust thay vì cancel.', 409);
    }
    assertTransition(BED_ASSIGNMENT_TRANSITIONS, assignment.status, BED_ASSIGNMENT_STATUS.CANCELLED, 'bed_assignment');
    assignment.status = BED_ASSIGNMENT_STATUS.CANCELLED;
    assignment.assigned_to = parseDate(payload.cancelled_at, 'cancelled_at') || new Date();
    assignment.release_reason = reason;
    assignment.updated_by = actor.userId;
    await assignment.save(sessionOptions(session));
    await releaseBedAtomic(assignment.bed_id, actor, session);
    cancelledId = assignment._id;
  }, { fallbackToNoTransaction: false });
  await recordAuditLog({ actor, action: 'bed_assignment.cancel', targetType: 'bed_assignment', targetId: cancelledId, status: 'success', message: 'Cancel bed assignment thành công.', requestMeta, metadata: { reason } });
  return getBedAssignmentDetail(cancelledId, actor);
}

async function getBedAssignmentDetail(assignmentId, actor = {}) {
  const assignment = await BedAssignment.findById(assignmentId)
    .populate('admission_id', 'admission_no patient_id department_id attending_doctor_id status')
    .populate({ path: 'bed_id', select: 'bed_code bed_name bed_type status room_id', populate: { path: 'room_id', select: 'room_code room_name room_type department_id floor building' } })
    .populate('assigned_by', 'full_name username employee_code')
    .lean();
  if (!assignment) throw createError('Không tìm thấy bed assignment.', 404);
  const admission = assignment.admission_id;
  assertAdmissionReadAccess({
    ...admission,
    patient_id: admission?.patient_id,
    department_id: admission?.department_id,
    attending_doctor_id: admission?.attending_doctor_id,
  }, actor);
  return assignment;
}

async function listBedAssignments(query = {}, actor = {}) {
  assertStaffPermission(actor, [PERMISSION.BED_ASSIGNMENTS.READ, PERMISSION.BED_ASSIGNMENTS.READ_DEPARTMENT]);
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  for (const field of ['admission_id', 'bed_id', 'status']) {
    if (query[field]) filter[field] = query[field];
  }
  let scopedAdmissionIds = null;
  let scopedBedIds = null;
  if (!hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.READ) && hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.READ_DEPARTMENT)) {
    const departmentId = actorDepartmentId(actor);
    if (!departmentId) throw createError('Thiếu department scope cho bed assignment.', 403);
    const [admissions, rooms] = await Promise.all([
      Admission.find({ department_id: departmentId, is_deleted: false }).select('_id').lean(),
      Room.find({ department_id: departmentId, is_deleted: false }).select('_id').lean(),
    ]);
    const beds = rooms.length
      ? await Bed.find({ room_id: { $in: rooms.map((room) => room._id) }, is_deleted: false }).select('_id').lean()
      : [];
    scopedAdmissionIds = admissions.map((admission) => admission._id);
    scopedBedIds = beds.map((bed) => bed._id);
  }
  if (scopedAdmissionIds) {
    if (filter.admission_id) {
      const admissionIds = Array.isArray(filter.admission_id?.$in) ? filter.admission_id.$in : [filter.admission_id];
      filter.admission_id = {
        $in: admissionIds.filter((id) => scopedAdmissionIds.some((scopedId) => sameId(scopedId, id))),
      };
    } else {
      filter.admission_id = { $in: scopedAdmissionIds };
    }
  }
  if (scopedBedIds) {
    if (filter.bed_id) {
      const bedIds = Array.isArray(filter.bed_id?.$in) ? filter.bed_id.$in : [filter.bed_id];
      filter.bed_id = {
        $in: bedIds.filter((id) => scopedBedIds.some((scopedId) => sameId(scopedId, id))),
      };
    } else {
      filter.bed_id = { $in: scopedBedIds };
    }
  }
  if (query.assigned_from || query.assigned_to) {
    filter.assigned_from = {};
    const from = parseDate(query.assigned_from, 'assigned_from');
    const to = parseDate(query.assigned_to, 'assigned_to');
    if (from) filter.assigned_from.$gte = from;
    if (to) filter.assigned_from.$lte = to;
  }
  const [items, total] = await Promise.all([
    BedAssignment.find(filter)
      .sort({ assigned_from: -1 })
      .skip(skip)
      .limit(limit)
      .populate('admission_id', 'admission_no patient_id department_id status')
      .populate({ path: 'bed_id', select: 'bed_code bed_name bed_type room_id', populate: { path: 'room_id', select: 'room_code room_name department_id' } })
      .lean(),
    BedAssignment.countDocuments(filter),
  ]);
  let scopedItems = items;
  if (!hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.READ) && hasPermission(actor, PERMISSION.BED_ASSIGNMENTS.READ_DEPARTMENT)) {
    const departmentId = String(actorDepartmentId(actor));
    scopedItems = items.filter((item) => {
      const admissionDepartment = item.admission_id?.department_id;
      const roomDepartment = item.bed_id?.room_id?.department_id;
      return sameId(admissionDepartment, departmentId) || sameId(roomDepartment, departmentId);
    });
  }
  return { items: scopedItems, pagination: buildPagination(page, limit, total) };
}

async function cancelAdmission(admissionId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ADMISSIONS.CANCEL]);
  const reason = normalizeString(payload.reason || payload.cancel_reason);
  if (!reason) throw createError('reason là bắt buộc.', 400);
  try {
    await withOptionalTransaction(async (session) => {
      const admission = await withSession(Admission.findById(admissionId), session);
      if (!admission) throw createError('Không tìm thấy admission.', 404);
      if ([ADMISSION_STATUS.DISCHARGED, ADMISSION_STATUS.CANCELLED].includes(admission.status)) {
        throw createError('Admission đã terminal, không thể cancel.', 409);
      }
      assertAdmissionWriteScope(admission, actor, { message: 'Bạn không có quyền cancel admission này.' });
      const billedCharge = await withSession(Charge.exists({
        admission_id: admission._id,
        source_module: 'inpatient',
        status: CHARGE_STATUS.BILLED,
      }), session);
      if (billedCharge && !payload.allow_cancel_with_billed_charge) {
        throw createError('Admission đã có inpatient charge billed. Cần billing adjustment trước khi cancel.', 409);
      }
      const activeAssignment = await withSession(BedAssignment.findOne({
        admission_id: admission._id,
        status: BED_ASSIGNMENT_STATUS.ACTIVE,
      }), session);
      if (activeAssignment) {
        activeAssignment.status = BED_ASSIGNMENT_STATUS.CANCELLED;
        activeAssignment.assigned_to = new Date();
        activeAssignment.release_reason = reason;
        activeAssignment.updated_by = actor.userId;
        await activeAssignment.save(sessionOptions(session));
        await releaseBedAtomic(activeAssignment.bed_id, actor, session);
      }
      assertTransition(ADMISSION_TRANSITIONS, admission.status, ADMISSION_STATUS.CANCELLED, 'admission');
      admission.status = ADMISSION_STATUS.CANCELLED;
      admission.cancelled_by = actor.userId;
      admission.cancelled_at = new Date();
      admission.cancel_reason = reason;
      admission.updated_by = actor.userId;
      await admission.save(sessionOptions(session));
      await Charge.updateMany(
        {
          admission_id: admission._id,
          source_module: 'inpatient',
          status: { $in: [CHARGE_STATUS.PENDING, CHARGE_STATUS.DRAFT, CHARGE_STATUS.POSTED] },
        },
        {
          $set: {
            status: CHARGE_STATUS.VOIDED,
            voided_by: actor.userId,
            voided_at: new Date(),
            void_reason: reason,
            updated_by: actor.userId,
          },
        },
        sessionOptions(session),
      );
    }, { fallbackToNoTransaction: false });
  } catch (error) {
    await recordAuditLog({
      actor,
      action: 'admissions.cancel',
      targetType: 'admission',
      targetId: admissionId,
      status: 'failure',
      message: 'Cancel admission thất bại.',
      requestMeta,
      metadata: { reason, error: error.message },
    });
    throw error;
  }
  await recordAuditLog({ actor, action: 'admissions.cancel', targetType: 'admission', targetId: admissionId, status: 'success', message: 'Cancel admission thành công.', requestMeta, metadata: { reason } });
  return getAdmissionDetail(admissionId, actor);
}

async function checkAdmissionCanDischarge(admissionId, payload = {}, actor = {}, session = null) {
  const admission = await withSession(Admission.findById(admissionId), session);
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  if (![ADMISSION_STATUS.ADMITTED, ADMISSION_STATUS.TRANSFERRED].includes(admission.status)) {
    throw createError('Admission phải admitted/transferred trước khi discharge.', 409);
  }
  assertAdmissionWriteScope(admission, actor, {
    allowOwnDoctor: true,
    message: 'Bạn không có quyền discharge admission này.',
  });
  if (hasPermission(actor, PERMISSION.ADMISSIONS.DISCHARGE_OWN) && !hasPermission(actor, PERMISSION.ADMISSIONS.DISCHARGE) && !sameId(admission.attending_doctor_id, actor.userId)) {
    throw createError('Doctor chỉ được discharge admission của mình.', 403);
  }
  const summary = normalizeString(payload.discharge_summary || admission.discharge_summary);
  if (payload.require_discharge_summary && !summary) throw createError('discharge_summary là bắt buộc.', 409);
  return { admission, can_discharge: true, warnings: [] };
}

async function dischargeAdmission(admissionId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.ADMISSIONS.DISCHARGE, PERMISSION.ADMISSIONS.DISCHARGE_OWN]);
  try {
    await withOptionalTransaction(async (session) => {
      const validation = await checkAdmissionCanDischarge(admissionId, payload, actor, session);
      const admission = validation.admission;
      const dischargedAt = parseDate(payload.discharged_at, 'discharged_at') || new Date();
      const activeAssignment = await withSession(BedAssignment.findOne({
        admission_id: admission._id,
        status: BED_ASSIGNMENT_STATUS.ACTIVE,
      }), session);
      if (activeAssignment) {
        activeAssignment.status = BED_ASSIGNMENT_STATUS.RELEASED;
        activeAssignment.assigned_to = dischargedAt;
        activeAssignment.release_reason = 'discharge';
        activeAssignment.updated_by = actor.userId;
        await activeAssignment.save(sessionOptions(session));
        await releaseBedAtomic(activeAssignment.bed_id, actor, session);
      }
      assertTransition(ADMISSION_TRANSITIONS, admission.status, ADMISSION_STATUS.DISCHARGED, 'admission');
      admission.status = ADMISSION_STATUS.DISCHARGED;
      admission.discharged_at = dischargedAt;
      admission.discharged_by = actor.userId;
      admission.discharge_disposition = normalizeString(payload.discharge_disposition);
      admission.discharge_summary = normalizeString(payload.discharge_summary || admission.discharge_summary);
      admission.updated_by = actor.userId;
      await admission.save(sessionOptions(session));
      if (payload.create_room_charge === true) {
        await createRoomBedChargeInternal(admission, payload, actor, session);
      }
    }, { fallbackToNoTransaction: false });
  } catch (error) {
    await recordAuditLog({
      actor,
      action: 'admissions.discharge',
      targetType: 'admission',
      targetId: admissionId,
      status: 'failure',
      message: 'Discharge admission thất bại.',
      requestMeta,
      metadata: { error: error.message },
    });
    throw error;
  }
  await recordAuditLog({ actor, action: 'admissions.discharge', targetType: 'admission', targetId: admissionId, status: 'success', message: 'Discharge admission thành công.', requestMeta });
  return getAdmissionDetail(admissionId, actor);
}

async function assertRoomChargeService(serviceId, session = null) {
  const service = await withSession(ServiceCatalog.findById(serviceId), session);
  if (!service || service.is_deleted) throw createError('Không tìm thấy room/bed service catalog.', 404);
  if (service.status !== SERVICE_STATUS.ACTIVE) throw createError('Room/bed service không active.', 409);
  if (!service.is_billable) throw createError('Room/bed service không billable.', 409);
  if (service.service_type !== SERVICE_TYPE.ROOM) throw createError('Room/bed charge service_type phải là room.', 409);
  return service;
}

function collectAssignmentChargeDays(assignment, nextAssignment, admissionEndAt, billedDays = new Set()) {
  const from = assignment.assigned_from ? getStartOfDay(assignment.assigned_from) : null;
  if (!from || Number.isNaN(from.getTime())) return [];
  const toSource = nextAssignment?.assigned_from || admissionEndAt || assignment.assigned_to || new Date();
  const to = getStartOfDay(toSource);
  const end = Number.isNaN(to.getTime()) || to < from ? from : to;
  const days = [];
  for (let cursor = new Date(from); cursor <= end; cursor = addDays(cursor, 1)) {
    const dayKey = formatDayKey(cursor);
    if (!billedDays.has(dayKey)) days.push(dayKey);
  }
  return days;
}

function calculateAssignmentQuantity(assignment, nextAssignment, admissionEndAt, billedDays = new Set(), billingUnit = 'day') {
  if (billingUnit === 'hour') {
    const from = assignment.assigned_from ? new Date(assignment.assigned_from) : null;
    const to = assignment.assigned_to ? new Date(assignment.assigned_to) : new Date();
    if (!from || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return 1;
    const hours = Math.ceil((to - from) / (60 * 60 * 1000));
    return Math.max(hours, 1);
  }
  const days = collectAssignmentChargeDays(assignment, nextAssignment, admissionEndAt, billedDays);
  return days.length;
}

async function resolveRoomChargeService(assignment, payload = {}, session = null) {
  if (payload.service_id) return assertRoomChargeService(payload.service_id, session);
  if (payload.default_service_id) return assertRoomChargeService(payload.default_service_id, session);
  const bed = await withSession(Bed.findById(assignment.bed_id).populate('room_id'), session);
  if (!bed) throw createError('Không tìm thấy bed khi tạo charge phòng/giường.', 404);
  if (bed.room_id?.service_id) return assertRoomChargeService(bed.room_id.service_id, session);
  throw createError('Chưa cấu hình service_id cho room/bed charge.', 409);
}

async function createRoomBedChargeInternal(admission, payload = {}, actor = {}, session = null) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_CHARGES.CREATE, PERMISSION.CHARGES.CREATE]);
  const assignments = await withSession(BedAssignment.find({
    admission_id: admission._id,
    status: { $in: [BED_ASSIGNMENT_STATUS.TRANSFERRED, BED_ASSIGNMENT_STATUS.RELEASED] },
    assigned_to: { $ne: null },
  }).sort({ assigned_from: 1 }).populate({ path: 'bed_id', populate: { path: 'room_id' } }), session);
  const createdCharges = [];
  const billedDays = new Set();
  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index];
    const nextAssignment = assignments[index + 1] || null;
    const chargeDays = collectAssignmentChargeDays(assignment, nextAssignment, admission.discharged_at || new Date(), billedDays);
    for (const dayKey of chargeDays) billedDays.add(dayKey);
    const duplicate = await withSession(Charge.exists({
      source_module: 'inpatient',
      source_id: assignment._id,
      status: { $nin: ACTIVE_CHARGE_EXCLUDED_STATUSES },
    }), session);
    if (duplicate || chargeDays.length === 0) continue;
    const service = await resolveRoomChargeService(assignment, payload, session);
    const quantity = chargeDays.length;
    const unitPrice = Number(payload.unit_price ?? service.unit_price ?? 0);
    if (unitPrice < 0) throw createError('unit_price không hợp lệ.', 400);
    const discountAmount = parseNonNegativeNumber(payload.discount_amount, 'discount_amount', 0);
    const taxAmount = parseNonNegativeNumber(payload.tax_amount, 'tax_amount', 0);
    const totalAmount = roundMoney(quantity * unitPrice - discountAmount + taxAmount);
    if (totalAmount < 0) throw createError('Room/bed charge total_amount không được âm.', 400);
    const chargeNo = await generateChargeNumber({ session });
    const bed = assignment.bed_id;
    const room = bed?.room_id;
    try {
      const [charge] = await Charge.create([{
        patient_id: admission.patient_id,
        encounter_id: admission.encounter_id,
        admission_id: admission._id,
        service_id: service._id,
        source_module: 'inpatient',
        source_id: assignment._id,
        charge_no: chargeNo,
        description: normalizeString(payload.description) || `Tiền phòng/giường ${room?.room_code || ''} ${bed?.bed_code || ''}`.trim(),
        quantity,
        unit_price: unitPrice,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        charged_at: parseDate(payload.charged_at, 'charged_at') || new Date(),
        status: payload.status || CHARGE_STATUS.POSTED,
        posted_by: (payload.status || CHARGE_STATUS.POSTED) === CHARGE_STATUS.POSTED ? actor.userId : undefined,
        posted_at: (payload.status || CHARGE_STATUS.POSTED) === CHARGE_STATUS.POSTED ? new Date() : undefined,
        created_by: actor.userId,
        updated_by: actor.userId,
      }], sessionOptions(session));
      createdCharges.push(charge);
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
  }
  return createdCharges;
}

async function createRoomBedCharge(admissionId, payload = {}, actor = {}, requestMeta = {}) {
  assertStaffPermission(actor, [PERMISSION.INPATIENT_CHARGES.CREATE, PERMISSION.CHARGES.CREATE]);
  let chargeIds = [];
  try {
    await withOptionalTransaction(async (session) => {
      const admission = await withSession(Admission.findById(admissionId), session);
      if (!admission) throw createError('Không tìm thấy admission.', 404);
      const charges = await createRoomBedChargeInternal(admission, payload, actor, session);
      chargeIds = charges.map((charge) => charge._id);
    }, { fallbackToNoTransaction: false });
  } catch (error) {
    await recordAuditLog({
      actor,
      action: 'inpatient_charge.create',
      targetType: 'admission',
      targetId: admissionId,
      status: 'failure',
      message: 'Tạo room/bed charge thất bại.',
      requestMeta,
      metadata: { error: error.message },
    });
    throw error;
  }
  await recordAuditLog({ actor, action: 'inpatient_charge.create', targetType: 'admission', targetId: admissionId, status: 'success', message: 'Tạo room/bed charge thành công.', requestMeta, metadata: { charge_ids: chargeIds } });
  return listAdmissionCharges(admissionId, actor);
}

async function listAdmissionCharges(admissionId, actor = {}) {
  const admission = await Admission.findById(admissionId).lean();
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  assertAdmissionReadAccess(admission, actor);
  if (actorType(actor) !== 'patient') {
    assertStaffPermission(actor, [PERMISSION.INPATIENT_CHARGES.READ, PERMISSION.CHARGES.READ, PERMISSION.ADMISSIONS.READ, PERMISSION.ADMISSIONS.READ_DEPARTMENT]);
  }
  return Charge.find({ admission_id: admissionId, source_module: 'inpatient' })
    .sort({ charged_at: -1 })
    .populate('service_id', 'service_code service_name service_type')
    .lean();
}

async function getAdmissionBedHistory(admissionId, actor = {}) {
  const admission = await Admission.findById(admissionId).lean();
  if (!admission) throw createError('Không tìm thấy admission.', 404);
  assertAdmissionReadAccess(admission, actor);
  return BedAssignment.find({ admission_id: admissionId })
    .sort({ assigned_from: 1 })
    .populate({ path: 'bed_id', select: 'bed_code bed_name bed_type room_id', populate: { path: 'room_id', select: 'room_code room_name room_type floor building department_id' } })
    .populate('assigned_by', 'full_name username employee_code')
    .lean();
}

module.exports = {
  // createRoom: Tạo phòng nội trú.
  createRoom,
  // listRooms: Liệt kê phòng nội trú.
  listRooms,
  // getRoomDetail: Lấy chi tiết phòng nội trú.
  getRoomDetail,
  // updateRoom: Cập nhật phòng nội trú.
  updateRoom,
  // deleteRoomSoft: Xóa mềm phòng nội trú.
  deleteRoomSoft,
  // createBed: Tạo giường bệnh.
  createBed,
  // listBeds: Liệt kê giường bệnh.
  listBeds,
  // getBedDetail: Lấy chi tiết giường bệnh.
  getBedDetail,
  // updateBed: Cập nhật giường bệnh.
  updateBed,
  // getAvailableBeds: Lấy giường còn trống.
  getAvailableBeds,
  // getBedAvailability: Lấy tình trạng trống của giường.
  getBedAvailability,
  // generateAdmissionNumber: Sinh/tạo mã nhập viện.
  generateAdmissionNumber,
  // validateAdmissionCreation: Kiểm tra tính hợp lệ của điều kiện tạo hồ sơ nhập viện.
  validateAdmissionCreation,
  // createAdmissionFromEncounter: Tạo hồ sơ nhập viện từ lượt khám.
  createAdmissionFromEncounter,
  // listAdmissions: Liệt kê hồ sơ nhập viện.
  listAdmissions,
  // getAdmissionDetail: Lấy chi tiết hồ sơ nhập viện.
  getAdmissionDetail,
  // admitPatient: Ghi nhận nhập viện cho bệnh nhân.
  admitPatient,
  // cancelAdmission: Hủy nhập viện.
  cancelAdmission,
  // checkAdmissionCanDischarge: Kiểm tra điều kiện xuất viện.
  checkAdmissionCanDischarge,
  // dischargeAdmission: Ghi nhận xuất viện cho nhập viện.
  dischargeAdmission,
  // validateBedAssignment: Kiểm tra tính hợp lệ của phân giường.
  validateBedAssignment,
  // assignBed: Gán giường bệnh.
  assignBed,
  // transferBed: Chuyển giường bệnh.
  transferBed,
  // transferBedAssignment: Chuyển phân giường.
  transferBedAssignment,
  // releaseBedAssignment: Giải phóng phân giường.
  releaseBedAssignment,
  // cancelBedAssignment: Hủy phân giường.
  cancelBedAssignment,
  // listBedAssignments: Liệt kê phân giường.
  listBedAssignments,
  // getBedAssignmentDetail: Lấy chi tiết phân giường.
  getBedAssignmentDetail,
  // getAdmissionBedHistory: Lấy lịch sử giường của hồ sơ nhập viện.
  getAdmissionBedHistory,
  // createRoomBedCharge: Tạo khoản phí phòng/giường.
  createRoomBedCharge,
  // listAdmissionCharges: Liệt kê khoản phí của hồ sơ nhập viện.
  listAdmissionCharges,
};
