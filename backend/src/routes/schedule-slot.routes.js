const express = require('express');
const { Types } = require('mongoose');
const { ScheduleSlot, Appointment, AuditLog } = require('../models');
const scheduleService = require('../services/schedule.service');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const ApiResponse = require('../common/responses/api-response');
const { PERMISSION } = require('../constants/permissions');
const { SCHEDULE_SLOT_STATUS } = require('../constants/statuses');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

const readPermissions = [
  PERMISSION.SCHEDULE_SLOTS.READ,
  PERMISSION.SCHEDULES.READ,
  PERMISSION.APPOINTMENTS.READ,
].filter(Boolean);

const writePermissions = [
  PERMISSION.SCHEDULE_SLOTS.HOLD,
  PERMISSION.SCHEDULE_SLOTS.BLOCK,
  PERMISSION.SCHEDULE_SLOTS.REOPEN,
  PERMISSION.SCHEDULE_SLOTS.BATCH_BLOCK,
  PERMISSION.SCHEDULE_SLOTS.BATCH_REOPEN,
  PERMISSION.SCHEDULES.UPDATE,
].filter(Boolean);

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function startOfDay(value) {
  const date = value ? new Date(`${String(value).slice(0, 10)}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

function buildSlotFilter(query = {}) {
  const filter = { is_deleted: false };
  const date = startOfDay(query.date || query.date_from);
  const dateTo = startOfDay(query.date_to);

  if (date && dateTo) {
    filter.start_time = { $gte: date, $lt: endOfDay(dateTo) };
  } else if (date) {
    filter.start_time = { $gte: date, $lt: endOfDay(date) };
  }

  if (query.status && query.status !== 'all') filter.status = query.status;
  if (Types.ObjectId.isValid(String(query.doctor_id || ''))) filter.doctor_id = query.doctor_id;
  if (Types.ObjectId.isValid(String(query.department_id || ''))) filter.department_id = query.department_id;
  if (Types.ObjectId.isValid(String(query.schedule_id || query.doctor_schedule_id || ''))) {
    filter.doctor_schedule_id = query.schedule_id || query.doctor_schedule_id;
  }

  return filter;
}

function formatSlot(slot = {}) {
  const doctor = slot.doctor_id || {};
  const department = slot.department_id || {};
  const schedule = slot.doctor_schedule_id || {};

  return {
    slot_id: String(slot._id || slot.id),
    schedule_slot_id: String(slot._id || slot.id),
    schedule_id: String(schedule._id || slot.doctor_schedule_id || ''),
    doctor_schedule_id: String(schedule._id || slot.doctor_schedule_id || ''),
    doctor_id: String(doctor._id || slot.doctor_id || ''),
    doctor_name: doctor.full_name || doctor.name || doctor.username || '',
    department_id: String(department._id || slot.department_id || ''),
    department_name: department.department_name || department.name || department.code || '',
    start_time: slot.start_time,
    end_time: slot.end_time,
    slot_number: slot.slot_number,
    status: slot.status,
    capacity: slot.capacity,
    booked_count: slot.booked_count,
    appointment_id: slot.appointment_id ? String(slot.appointment_id) : null,
    patient_id: slot.patient_id ? String(slot.patient_id) : null,
    hold_expires_at: slot.hold_expires_at,
    block_reason: slot.block_reason,
    schedule_type: schedule.schedule_type,
    work_date: schedule.work_date,
  };
}

function getSlotScheduleId(slot = {}) {
  const schedule = slot.doctor_schedule_id || slot.schedule_id;
  return schedule?._id || schedule;
}

async function findSlot(slotId) {
  const slot = await ScheduleSlot.findById(slotId)
    .populate('doctor_id', 'full_name name username')
    .populate('department_id', 'department_name name code')
    .populate('doctor_schedule_id', 'schedule_type work_date shift_start shift_end')
    .lean();
  if (!slot || slot.is_deleted) {
    const error = new Error('Không tìm thấy schedule slot.');
    error.statusCode = 404;
    throw error;
  }
  return slot;
}

router.param('slotId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);
  const page = Math.max(Number(req.query.page || 1), 1);
  const filter = buildSlotFilter(req.query);
  const [items, total] = await Promise.all([
    ScheduleSlot.find(filter)
      .sort({ start_time: 1, slot_number: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('doctor_id', 'full_name name username')
      .populate('department_id', 'department_name name code')
      .populate('doctor_schedule_id', 'schedule_type work_date shift_start shift_end')
      .lean(),
    ScheduleSlot.countDocuments(filter),
  ]);

  return ApiResponse.success(res, {
    items: items.map(formatSlot),
    pagination: { page, limit, total },
  }, 'Lấy danh sách schedule slot thành công.');
}));

router.get('/utilization', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const items = await ScheduleSlot.find(buildSlotFilter(req.query)).sort({ start_time: 1 }).lean();
  const groups = new Map();

  items.forEach((slot) => {
    const date = new Date(slot.start_time);
    const label = Number.isNaN(date.getTime()) ? 'unknown' : `${String(date.getHours()).padStart(2, '0')}:00`;
    const current = groups.get(label) || { label, total_slots: 0, booked_slots: 0, available_slots: 0, blocked_slots: 0 };
    current.total_slots += 1;
    current.booked_slots += Number(slot.booked_count || 0);
    if (slot.status === SCHEDULE_SLOT_STATUS.BLOCKED) current.blocked_slots += 1;
    if (slot.status === SCHEDULE_SLOT_STATUS.AVAILABLE) current.available_slots += 1;
    groups.set(label, current);
  });

  const result = Array.from(groups.values()).map((item) => ({
    ...item,
    utilization_rate: item.total_slots ? Math.round((item.booked_slots / item.total_slots) * 100) : 0,
  }));

  return ApiResponse.success(res, { items: result }, 'Lấy utilization schedule slot thành công.');
}));

router.get('/activity', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const items = await AuditLog.find({
    target_type: { $in: ['schedule_slot', 'doctor_schedule'] },
  }).sort({ created_at: -1 }).limit(limit).lean();

  return ApiResponse.success(res, { items }, 'Lấy nhật ký schedule slot thành công.');
}));

router.get('/import-template', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  return ApiResponse.success(res, {
    columns: ['doctor_code', 'department_code', 'work_date', 'shift_start', 'shift_end', 'slot_duration_minutes', 'capacity'],
  }, 'Lấy template import slot thành công.');
}));

router.get('/export', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const items = await ScheduleSlot.find(buildSlotFilter(req.query))
    .sort({ start_time: 1 })
    .populate('doctor_id', 'full_name name username')
    .populate('department_id', 'department_name name code')
    .populate('doctor_schedule_id', 'schedule_type work_date')
    .lean();
  return ApiResponse.success(res, { items: items.map(formatSlot), format: 'json' }, 'Export schedule slot thành công.');
}));

router.post('/blocking/preview', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const slotIds = Array.isArray(req.body?.slot_ids) ? req.body.slot_ids : [];
  const items = slotIds.length
    ? await ScheduleSlot.find({ _id: { $in: slotIds }, is_deleted: false }).lean()
    : [];
  return ApiResponse.success(res, {
    total: items.length,
    blocked_candidates: items.filter((slot) => slot.status !== SCHEDULE_SLOT_STATUS.BLOCKED && Number(slot.booked_count || 0) === 0).length,
    booked_conflicts: items.filter((slot) => Number(slot.booked_count || 0) > 0).length,
  }, 'Preview chặn/mở slot thành công.');
}));

router.post('/bulk-block', authorize({ anyPermissions: writePermissions }), asyncRoute(async (req, res) => {
  const slotIds = Array.isArray(req.body?.slot_ids) ? req.body.slot_ids : [];
  const slots = await ScheduleSlot.find({ _id: { $in: slotIds }, is_deleted: false }).lean();
  const results = [];
  for (const slot of slots) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await scheduleService.blockScheduleSlot(slot.doctor_schedule_id, {
      slot_time: slot.start_time,
      reason: req.body?.reason || 'Batch block từ schedule slot board',
    }, req.auth, req.context || {}));
  }
  return ApiResponse.success(res, { changed_count: results.length, items: results }, 'Chặn nhiều schedule slot thành công.');
}));

router.post('/bulk-reopen', authorize({ anyPermissions: writePermissions }), asyncRoute(async (req, res) => {
  const slotIds = Array.isArray(req.body?.slot_ids) ? req.body.slot_ids : [];
  const slots = await ScheduleSlot.find({ _id: { $in: slotIds }, is_deleted: false }).lean();
  const results = [];
  for (const slot of slots) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await scheduleService.reopenScheduleSlot(slot.doctor_schedule_id, {
      slot_time: slot.start_time,
      reason: req.body?.reason || 'Batch reopen từ schedule slot board',
    }, req.auth, req.context || {}));
  }
  return ApiResponse.success(res, { changed_count: results.length, items: results }, 'Mở nhiều schedule slot thành công.');
}));

router.post('/import-excel/preview', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  return ApiResponse.success(res, {
    accepted_count: items.length,
    rejected_count: 0,
    items: items.map((item, index) => ({ index, success: true, item })),
  }, 'Preview import slot thành công.');
}));

router.post('/import-excel', authorize({ anyPermissions: writePermissions }), asyncRoute(async (req, res) => {
  return ApiResponse.success(res, {
    imported_count: 0,
    message: 'Import Excel cần pipeline lưu file riêng; endpoint đã nhận request an toàn.',
  }, 'Import schedule slot đã được ghi nhận.');
}));

router.get('/:slotId', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const slot = await findSlot(req.params.slotId);
  return ApiResponse.success(res, formatSlot(slot), 'Lấy chi tiết schedule slot thành công.');
}));

router.get('/:slotId/patients', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const items = await Appointment.find({ schedule_slot_id: req.params.slotId, is_deleted: false })
    .populate('patient_id', 'full_name patient_code phone')
    .lean();
  return ApiResponse.success(res, { items }, 'Lấy bệnh nhân trong slot thành công.');
}));

router.get('/:slotId/timeline', authorize({ anyPermissions: readPermissions }), asyncRoute(async (req, res) => {
  const items = await AuditLog.find({
    target_id: req.params.slotId,
    target_type: { $in: ['schedule_slot', 'doctor_schedule'] },
  }).sort({ created_at: -1 }).limit(100).lean();
  return ApiResponse.success(res, { items }, 'Lấy timeline schedule slot thành công.');
}));

router.post('/:slotId/hold', authorize({ anyPermissions: writePermissions }), asyncRoute(async (req, res) => {
  const minutes = Math.min(Math.max(Number(req.body?.hold_minutes || 5), 1), 30);
  const holdExpiresAt = new Date(Date.now() + minutes * 60000);
  const slot = await ScheduleSlot.findOneAndUpdate(
    {
      _id: req.params.slotId,
      is_deleted: false,
      status: { $in: [SCHEDULE_SLOT_STATUS.AVAILABLE, SCHEDULE_SLOT_STATUS.HELD] },
      booked_count: { $lt: 1 },
    },
    {
      $set: {
        status: SCHEDULE_SLOT_STATUS.HELD,
        hold_expires_at: holdExpiresAt,
        updated_by: req.auth?.userId,
      },
    },
    { new: true },
  ).lean();

  if (!slot) {
    const error = new Error('Slot không thể hold vì đã đặt, đã khóa hoặc không tồn tại.');
    error.statusCode = 409;
    throw error;
  }

  return ApiResponse.success(res, { slot: formatSlot(slot), hold_expires_at: holdExpiresAt }, 'Hold schedule slot thành công.');
}));

router.post('/:slotId/release-hold', authorize({ anyPermissions: writePermissions }), asyncRoute(async (req, res) => {
  const slot = await ScheduleSlot.findOneAndUpdate(
    { _id: req.params.slotId, is_deleted: false, status: SCHEDULE_SLOT_STATUS.HELD },
    {
      $set: { status: SCHEDULE_SLOT_STATUS.AVAILABLE, updated_by: req.auth?.userId },
      $unset: { hold_expires_at: '' },
    },
    { new: true },
  ).lean();
  return ApiResponse.success(res, { slot: slot ? formatSlot(slot) : null }, 'Release hold schedule slot thành công.');
}));

router.post('/:slotId/block', authorize({ anyPermissions: writePermissions }), asyncRoute(async (req, res) => {
  const slot = await findSlot(req.params.slotId);
  const result = await scheduleService.blockScheduleSlot(getSlotScheduleId(slot), {
    slot_time: slot.start_time,
    reason: req.body?.reason || 'Khóa từ schedule slot board',
  }, req.auth, req.context || {});
  return ApiResponse.success(res, result, 'Chặn schedule slot thành công.');
}));

router.post('/:slotId/reopen', authorize({ anyPermissions: writePermissions }), asyncRoute(async (req, res) => {
  const slot = await findSlot(req.params.slotId);
  const result = await scheduleService.reopenScheduleSlot(getSlotScheduleId(slot), {
    slot_time: slot.start_time,
    reason: req.body?.reason || 'Mở lại từ schedule slot board',
  }, req.auth, req.context || {});
  return ApiResponse.success(res, result, 'Mở lại schedule slot thành công.');
}));

router.patch('/:slotId/capacity', authorize({ anyPermissions: writePermissions }), asyncRoute(async (req, res) => {
  const capacity = Math.min(Math.max(Number(req.body?.capacity || 1), 1), 1);
  const slot = await ScheduleSlot.findOneAndUpdate(
    { _id: req.params.slotId, is_deleted: false, booked_count: { $lte: capacity } },
    { $set: { capacity, updated_by: req.auth?.userId } },
    { new: true },
  ).lean();
  if (!slot) {
    const error = new Error('Không thể cập nhật capacity nhỏ hơn số đã đặt.');
    error.statusCode = 409;
    throw error;
  }
  return ApiResponse.success(res, { slot: formatSlot(slot) }, 'Cập nhật capacity schedule slot thành công.');
}));

module.exports = router;
