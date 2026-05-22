const {
  Appointment,
  Bed,
  Department,
  DoctorProfile,
  DoctorSchedule,
  Encounter,
  FacilityLocation,
  ImagingEquipment,
  ImagingRoom,
  LabSlaRule,
  LabTestCatalog,
  ProcedureCatalog,
  ProcedureOrder,
  QueueTicket,
  Room,
  ServiceCatalog,
  SpecimenTypeCatalog,
  StorageLocation,
  User,
  Warehouse,
} = require('../models');
const { getEndOfDay, getStartOfDay } = require('./core.service');
const departmentService = require('./department.service');

const OPEN_ENCOUNTER_STATUSES = ['planned', 'arrived', 'in_progress', 'on_hold'];
const ACTIVE_APPOINTMENT_STATUSES = ['booked', 'confirmed', 'checked_in', 'in_consultation'];
const BLOCKING_SCHEDULE_STATUSES = ['draft', 'published', 'active'];
const ACTIVE_QUEUE_STATUSES = ['waiting', 'called', 'serving', 'in_service', 'ready_for_doctor', 'waiting_nurse'];

function idOf(value) {
  return value ? String(value) : null;
}

function groupCountMap(rows = [], key = '_id', value = 'count') {
  return rows.reduce((accumulator, row) => {
    const mapKey = idOf(row[key]);
    if (mapKey) accumulator[mapKey] = Number(row[value] || 0);
    return accumulator;
  }, {});
}

function emptyStaffBucket() {
  return { total: 0, active: 0, locked: 0, suspended: 0, disabled: 0, inactive: 0 };
}

async function groupedCounts(model, match = {}, groupField = 'department_id') {
  const rows = await model.aggregate([
    { $match: match },
    { $group: { _id: `$${groupField}`, count: { $sum: 1 } } },
  ]);
  return groupCountMap(rows);
}

async function buildDepartmentOperationsBoard() {
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const todayEnd = getEndOfDay(now);
  const departments = await Department.find({ is_deleted: false }).sort({ department_name: 1 }).lean();
  const departmentIds = departments.map((department) => department._id);

  const [
    heads,
    staffRows,
    doctorCounts,
    schedulesToday,
    futureSchedules,
    appointmentsToday,
    futureAppointments,
    openEncounters,
    locations,
    rooms,
    queuesWaiting,
    services,
    warehouses,
  ] = await Promise.all([
    User.find({ _id: { $in: departments.map((department) => department.head_user_id).filter(Boolean) }, is_deleted: false })
      .select('full_name username email phone status')
      .lean(),
    User.aggregate([
      { $match: { department_id: { $in: departmentIds }, is_deleted: false } },
      {
        $group: {
          _id: '$department_id',
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          locked: { $sum: { $cond: [{ $eq: ['$status', 'locked'] }, 1, 0] } },
          suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
          disabled: { $sum: { $cond: [{ $eq: ['$status', 'disabled'] }, 1, 0] } },
        },
      },
    ]),
    groupedCounts(DoctorProfile, { department_id: { $in: departmentIds }, is_deleted: false, status: 'active' }),
    groupedCounts(DoctorSchedule, {
      department_id: { $in: departmentIds },
      is_deleted: false,
      work_date: { $gte: todayStart, $lte: todayEnd },
    }),
    groupedCounts(DoctorSchedule, {
      department_id: { $in: departmentIds },
      is_deleted: false,
      work_date: { $gte: todayStart },
      status: { $in: BLOCKING_SCHEDULE_STATUSES },
    }),
    groupedCounts(Appointment, {
      department_id: { $in: departmentIds },
      is_deleted: false,
      appointment_time: { $gte: todayStart, $lte: todayEnd },
    }),
    groupedCounts(Appointment, {
      department_id: { $in: departmentIds },
      is_deleted: false,
      appointment_time: { $gte: now },
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    }),
    groupedCounts(Encounter, { department_id: { $in: departmentIds }, status: { $in: OPEN_ENCOUNTER_STATUSES } }),
    groupedCounts(FacilityLocation, { department_id: { $in: departmentIds }, is_deleted: false }),
    Room.find({ department_id: { $in: departmentIds }, is_deleted: false }).select('_id department_id status room_type').lean(),
    groupedCounts(QueueTicket, {
      department_id: { $in: departmentIds },
      queue_date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ACTIVE_QUEUE_STATUSES },
    }),
    groupedCounts(ServiceCatalog, { department_id: { $in: departmentIds }, is_deleted: false, status: 'active' }),
    groupedCounts(Warehouse, { department_id: { $in: departmentIds }, is_deleted: false }),
  ]);

  const headById = new Map(heads.map((head) => [idOf(head._id), head]));
  const staffByDepartment = staffRows.reduce((accumulator, row) => {
    const key = idOf(row._id);
    accumulator[key] = {
      total: Number(row.total || 0),
      active: Number(row.active || 0),
      locked: Number(row.locked || 0),
      suspended: Number(row.suspended || 0),
      disabled: Number(row.disabled || 0),
      inactive: Number(row.total || 0) - Number(row.active || 0),
    };
    return accumulator;
  }, {});

  const roomsByDepartment = rooms.reduce((accumulator, room) => {
    const key = idOf(room.department_id);
    if (!accumulator[key]) accumulator[key] = { count: 0, active: 0, room_ids: [] };
    accumulator[key].count += 1;
    if (room.status === 'active') accumulator[key].active += 1;
    accumulator[key].room_ids.push(room._id);
    return accumulator;
  }, {});

  const bedRows = rooms.length
    ? await Bed.aggregate([
        { $match: { room_id: { $in: rooms.map((room) => room._id) }, is_deleted: false } },
        { $group: { _id: '$room_id', count: { $sum: 1 }, available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } } } },
      ])
    : [];
  const bedByRoom = bedRows.reduce((accumulator, row) => {
    accumulator[idOf(row._id)] = { count: Number(row.count || 0), available: Number(row.available || 0) };
    return accumulator;
  }, {});

  const items = departments.map((department) => {
    const departmentId = idOf(department._id);
    const staff = staffByDepartment[departmentId] || emptyStaffBucket();
    const roomBucket = roomsByDepartment[departmentId] || { count: 0, active: 0, room_ids: [] };
    const beds = roomBucket.room_ids.reduce((accumulator, roomId) => {
      const row = bedByRoom[idOf(roomId)] || { count: 0, available: 0 };
      accumulator.count += row.count;
      accumulator.available += row.available;
      return accumulator;
    }, { count: 0, available: 0 });
    const head = headById.get(idOf(department.head_user_id));
    const riskBadges = [];

    if (!head) riskBadges.push('missing_head');
    if (staff.active === 0) riskBadges.push('no_active_staff');
    if (Number(futureSchedules[departmentId] || 0) > 0) riskBadges.push('future_schedules');
    if (Number(futureAppointments[departmentId] || 0) > 0) riskBadges.push('future_appointments');
    if (Number(openEncounters[departmentId] || 0) > 0) riskBadges.push('open_encounters');
    if (Number(locations[departmentId] || 0) === 0) riskBadges.push('no_location');
    if (Number(roomBucket.count || 0) === 0 && ['clinical', 'inpatient', 'emergency', 'procedure'].includes(department.department_type)) riskBadges.push('no_room');
    if (Number(services[departmentId] || 0) === 0) riskBadges.push('no_service_binding');

    const canDeactivate = staff.active === 0 &&
      Number(futureSchedules[departmentId] || 0) === 0 &&
      Number(futureAppointments[departmentId] || 0) === 0 &&
      Number(openEncounters[departmentId] || 0) === 0 &&
      Number(doctorCounts[departmentId] || 0) === 0;
    if (!canDeactivate) riskBadges.push('cannot_deactivate');

    const configScore = Math.max(0, 100 - (riskBadges.length * 9));

    return {
      department_id: departmentId,
      department_code: department.department_code,
      department_name: department.department_name,
      department_type: department.department_type,
      status: department.status,
      head: head ? {
        user_id: idOf(head._id),
        full_name: head.full_name,
        username: head.username,
        email: head.email,
        phone: head.phone,
        status: head.status,
        has_department_head_role: true,
      } : null,
      staff,
      doctors_count: Number(doctorCounts[departmentId] || 0),
      schedules_today: Number(schedulesToday[departmentId] || 0),
      future_schedules_count: Number(futureSchedules[departmentId] || 0),
      appointments_today: Number(appointmentsToday[departmentId] || 0),
      future_appointments_count: Number(futureAppointments[departmentId] || 0),
      open_encounters_count: Number(openEncounters[departmentId] || 0),
      locations_count: Number(locations[departmentId] || 0),
      rooms_count: Number(roomBucket.count || 0),
      active_rooms_count: Number(roomBucket.active || 0),
      beds_count: beds.count,
      available_beds_count: beds.available,
      queue_waiting: Number(queuesWaiting[departmentId] || 0),
      services_count: Number(services[departmentId] || 0),
      warehouses_count: Number(warehouses[departmentId] || 0),
      can_deactivate: canDeactivate,
      config_score: configScore,
      risk_badges: [...new Set(riskBadges)],
      last_activity_at: department.updated_at || department.created_at,
      location_note: department.location_note,
    };
  });

  return {
    generated_at: new Date(),
    summary: {
      total: items.length,
      active: items.filter((item) => item.status === 'active').length,
      inactive: items.filter((item) => item.status !== 'active').length,
      missing_head: items.filter((item) => !item.head).length,
      blocked_deactivation: items.filter((item) => !item.can_deactivate).length,
      config_warnings: items.reduce((total, item) => total + item.risk_badges.length, 0),
      active_staff: items.reduce((total, item) => total + item.staff.active, 0),
      queue_waiting: items.reduce((total, item) => total + item.queue_waiting, 0),
    },
    items,
  };
}

async function getDepartmentOperationalProfile(departmentId) {
  const board = await buildDepartmentOperationsBoard();
  const item = board.items.find((department) => department.department_id === idOf(departmentId));
  const department = await Department.findById(departmentId).lean();
  if (!department || department.is_deleted) {
    const error = new Error('Không tìm thấy department.');
    error.statusCode = 404;
    throw error;
  }

  const [staff, locations, rooms, services, warehouses, imagingRooms] = await Promise.all([
    User.find({ department_id: department._id, is_deleted: false })
      .select('full_name username email phone employee_code status last_login_at')
      .sort({ full_name: 1 })
      .limit(80)
      .lean(),
    FacilityLocation.find({ department_id: department._id, is_deleted: false }).sort({ name: 1 }).lean(),
    Room.find({ department_id: department._id, is_deleted: false }).sort({ room_code: 1 }).lean(),
    ServiceCatalog.find({ department_id: department._id, is_deleted: false }).sort({ service_name: 1 }).limit(80).lean(),
    Warehouse.find({ department_id: department._id, is_deleted: false }).sort({ warehouse_code: 1 }).lean(),
    ImagingRoom.find({}).populate('location_id').lean(),
  ]);

  const roomIds = rooms.map((room) => room._id);
  const beds = roomIds.length ? await Bed.find({ room_id: { $in: roomIds }, is_deleted: false }).lean() : [];
  const locationIds = new Set(locations.map((location) => idOf(location._id)));

  return {
    generated_at: new Date(),
    department: item || {
      department_id: idOf(department._id),
      department_code: department.department_code,
      department_name: department.department_name,
      department_type: department.department_type,
      status: department.status,
      risk_badges: [],
    },
    staff: staff.map((user) => ({
      user_id: idOf(user._id),
      full_name: user.full_name,
      username: user.username,
      email: user.email,
      phone: user.phone,
      employee_code: user.employee_code,
      status: user.status,
      last_login_at: user.last_login_at,
    })),
    facility_locations: locations.map((location) => ({
      location_id: idOf(location._id),
      name: location.name,
      type: location.type,
      address: location.address,
      phone: location.phone,
      status: location.status,
      public_visible: location.public_visible,
    })),
    rooms: rooms.map((room) => ({
      room_id: idOf(room._id),
      room_code: room.room_code,
      room_name: room.room_name,
      room_type: room.room_type,
      floor: room.floor,
      building: room.building,
      status: room.status,
      beds_count: beds.filter((bed) => idOf(bed.room_id) === idOf(room._id)).length,
    })),
    beds_summary: {
      total: beds.length,
      available: beds.filter((bed) => bed.status === 'available').length,
      occupied: beds.filter((bed) => bed.status === 'occupied').length,
    },
    service_bindings: services.map((service) => ({
      service_id: idOf(service._id),
      service_code: service.service_code,
      service_name: service.service_name,
      service_type: service.service_type,
      status: service.status,
      is_billable: service.is_billable,
      unit_price: service.unit_price,
    })),
    warehouses: warehouses.map((warehouse) => ({
      warehouse_id: idOf(warehouse._id),
      warehouse_code: warehouse.warehouse_code,
      name: warehouse.name,
      type: warehouse.type,
      status: warehouse.status,
    })),
    imaging_rooms: imagingRooms
      .filter((room) => room.location_id && locationIds.has(idOf(room.location_id._id || room.location_id)))
      .map((room) => ({
        room_id: idOf(room._id),
        code: room.code,
        name: room.name,
        modality: room.modality,
        active: room.active,
        maintenance_status: room.maintenance_status,
      })),
    warnings: item?.risk_badges || [],
  };
}

async function getFacilityResourceBoard() {
  const [
    departments,
    locations,
    rooms,
    beds,
    imagingRooms,
    imagingEquipment,
    warehouses,
    storageLocations,
    labTests,
    specimenTypes,
    labSlaRules,
    procedureCatalog,
    procedureOrdersToday,
    services,
  ] = await Promise.all([
    Department.find({ is_deleted: false }).select('department_code department_name department_type status').lean(),
    FacilityLocation.find({ is_deleted: false }).sort({ type: 1, name: 1 }).lean(),
    Room.find({ is_deleted: false }).sort({ room_code: 1 }).lean(),
    Bed.find({ is_deleted: false }).lean(),
    ImagingRoom.find({}).sort({ code: 1 }).lean(),
    ImagingEquipment.find({}).sort({ code: 1 }).lean(),
    Warehouse.find({ is_deleted: false }).sort({ warehouse_code: 1 }).lean(),
    StorageLocation.find({ is_deleted: false }).sort({ location_code: 1 }).lean(),
    LabTestCatalog.countDocuments({ active: true }),
    SpecimenTypeCatalog.countDocuments({ active: true }),
    LabSlaRule.countDocuments({ active: true }).catch(() => 0),
    ProcedureCatalog.find({ active: true }).select('code name active allowed_locations default_service_id').lean(),
    ProcedureOrder.countDocuments({
      created_at: { $gte: getStartOfDay(new Date()), $lte: getEndOfDay(new Date()) },
    }).catch(() => 0),
    ServiceCatalog.find({ is_deleted: false }).select('service_code service_name service_type department_id status is_billable unit_price').limit(400).lean(),
  ]);

  const departmentById = new Map(departments.map((department) => [idOf(department._id), department]));
  const bedsByRoom = beds.reduce((accumulator, bed) => {
    const roomId = idOf(bed.room_id);
    if (!accumulator[roomId]) accumulator[roomId] = { total: 0, available: 0, occupied: 0 };
    accumulator[roomId].total += 1;
    if (bed.status === 'available') accumulator[roomId].available += 1;
    if (bed.status === 'occupied') accumulator[roomId].occupied += 1;
    return accumulator;
  }, {});
  const storageByWarehouse = storageLocations.reduce((accumulator, location) => {
    const warehouseId = idOf(location.warehouse_id);
    if (!accumulator[warehouseId]) accumulator[warehouseId] = { total: 0, locked: 0, quarantine: 0, cold: 0 };
    accumulator[warehouseId].total += 1;
    if (location.is_locked || location.status === 'locked') accumulator[warehouseId].locked += 1;
    if (location.allow_quarantine || location.location_type === 'quarantine') accumulator[warehouseId].quarantine += 1;
    if (location.location_type === 'fridge' || location.temperature_zone) accumulator[warehouseId].cold += 1;
    return accumulator;
  }, {});

  return {
    generated_at: new Date(),
    summary: {
      locations: locations.length,
      public_locations: locations.filter((location) => location.public_visible).length,
      rooms: rooms.length,
      beds: beds.length,
      available_beds: beds.filter((bed) => bed.status === 'available').length,
      imaging_rooms: imagingRooms.length,
      imaging_equipment_down: imagingEquipment.filter((item) => item.status !== 'available').length,
      warehouses: warehouses.length,
      storage_locations: storageLocations.length,
      locked_storage_locations: storageLocations.filter((item) => item.is_locked || item.status === 'locked').length,
      lab_tests: labTests,
      specimen_types: specimenTypes,
      lab_sla_rules: labSlaRules,
      procedure_catalog: procedureCatalog.length,
      procedure_orders_today: procedureOrdersToday,
      services: services.length,
    },
    departments: departments.map((department) => ({
      department_id: idOf(department._id),
      department_code: department.department_code,
      department_name: department.department_name,
      department_type: department.department_type,
      status: department.status,
    })),
    locations: locations.map((location) => ({
      location_id: idOf(location._id),
      name: location.name,
      type: location.type,
      department_id: idOf(location.department_id),
      department_name: departmentById.get(idOf(location.department_id))?.department_name,
      address: location.address,
      phone: location.phone,
      opening_hours: location.opening_hours,
      status: location.status,
      public_visible: location.public_visible,
      warnings: [
        !location.address ? 'missing_address' : null,
        !location.phone ? 'missing_phone' : null,
        location.public_visible && !location.opening_hours ? 'missing_opening_hours' : null,
      ].filter(Boolean),
    })),
    rooms: rooms.map((room) => ({
      room_id: idOf(room._id),
      room_code: room.room_code,
      room_name: room.room_name,
      room_type: room.room_type,
      department_id: idOf(room.department_id),
      department_name: departmentById.get(idOf(room.department_id))?.department_name,
      building: room.building,
      floor: room.floor,
      capacity: room.capacity,
      status: room.status,
      beds: bedsByRoom[idOf(room._id)] || { total: 0, available: 0, occupied: 0 },
      has_service_binding: Boolean(room.service_id),
    })),
    imaging_rooms: imagingRooms.map((room) => ({
      room_id: idOf(room._id),
      code: room.code,
      name: room.name,
      modality: room.modality,
      location_id: idOf(room.location_id),
      equipment_id: idOf(room.equipment_id),
      default_duration_minutes: room.default_duration_minutes,
      active: room.active,
      maintenance_status: room.maintenance_status,
      risk: room.active && room.maintenance_status !== 'available' ? 'high' : 'low',
    })),
    imaging_equipment: imagingEquipment.map((equipment) => ({
      equipment_id: idOf(equipment._id),
      code: equipment.code,
      name: equipment.name,
      modality: equipment.modality,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      status: equipment.status,
      last_maintenance_at: equipment.last_maintenance_at,
      next_maintenance_at: equipment.next_maintenance_at,
    })),
    warehouses: warehouses.map((warehouse) => ({
      warehouse_id: idOf(warehouse._id),
      warehouse_code: warehouse.warehouse_code,
      name: warehouse.name,
      type: warehouse.type,
      department_id: idOf(warehouse.department_id),
      department_name: departmentById.get(idOf(warehouse.department_id))?.department_name,
      status: warehouse.status,
      storage: storageByWarehouse[idOf(warehouse._id)] || { total: 0, locked: 0, quarantine: 0, cold: 0 },
    })),
    storage_locations: storageLocations.map((location) => ({
      location_id: idOf(location._id),
      warehouse_id: idOf(location.warehouse_id),
      parent_id: idOf(location.parent_id),
      location_code: location.location_code,
      name: location.name,
      location_type: location.location_type,
      zone: location.zone,
      shelf: location.shelf,
      bin: location.bin,
      temperature_zone: location.temperature_zone,
      is_locked: location.is_locked,
      status: location.status,
      qr_code: location.qr_code,
      allow_quarantine: location.allow_quarantine,
      allow_recalled_stock: location.allow_recalled_stock,
      allow_controlled_drug: location.allow_controlled_drug,
    })),
    lab: {
      tests_count: labTests,
      specimen_types_count: specimenTypes,
      sla_rules_count: labSlaRules,
    },
    procedure_rooms: {
      catalog: procedureCatalog.map((procedure) => ({
        procedure_id: idOf(procedure._id),
        procedure_code: procedure.code,
        procedure_name: procedure.name,
        status: procedure.active ? 'active' : 'inactive',
        service_id: idOf(procedure.default_service_id),
        location_count: (procedure.allowed_locations || []).length,
      })),
      orders_today: procedureOrdersToday,
    },
    services: services.map((service) => ({
      service_id: idOf(service._id),
      service_code: service.service_code,
      service_name: service.service_name,
      service_type: service.service_type,
      department_id: idOf(service.department_id),
      department_name: departmentById.get(idOf(service.department_id))?.department_name,
      status: service.status,
      is_billable: service.is_billable,
      unit_price: service.unit_price,
      binding_warnings: [!service.department_id ? 'missing_department' : null].filter(Boolean),
    })),
  };
}

async function getOperationalStatus() {
  const [board, resources] = await Promise.all([buildDepartmentOperationsBoard(), getFacilityResourceBoard()]);
  const criticalBlockers = [];
  const warnings = [];

  board.items.forEach((department) => {
    department.risk_badges.forEach((badge) => {
      const severity = ['missing_head', 'no_active_staff', 'open_encounters', 'cannot_deactivate'].includes(badge) ? 'high' : 'medium';
      const item = {
        severity,
        resource_type: 'department',
        resource_id: department.department_id,
        title: `${department.department_name}: ${badge}`,
        message: `Khoa/phòng ${department.department_code} có cảnh báo ${badge}.`,
        suggested_action: badge === 'missing_head' ? 'Gán trưởng khoa hoặc kiểm tra nhân sự đủ điều kiện.' : 'Mở operational profile để xem dependencies.',
      };
      if (severity === 'high') criticalBlockers.push(item);
      warnings.push(item);
    });
  });

  resources.locations.forEach((location) => {
    location.warnings.forEach((warning) => {
      warnings.push({
        severity: warning === 'missing_opening_hours' ? 'medium' : 'low',
        resource_type: 'facility_location',
        resource_id: location.location_id,
        title: `${location.name}: ${warning}`,
        message: 'Địa điểm public/internal chưa đủ cấu hình vận hành.',
        suggested_action: 'Bổ sung address, phone hoặc opening hours.',
      });
    });
  });

  const heatmap = board.items.map((department) => ({
    department_id: department.department_id,
    department_code: department.department_code,
    department_name: department.department_name,
    cells: {
      head: department.head ? 'ok' : 'critical',
      staff: department.staff.active > 0 ? 'ok' : 'critical',
      schedule: department.future_schedules_count > 0 ? 'warning' : 'ok',
      appointment: department.future_appointments_count > 0 ? 'warning' : 'ok',
      queue: department.queue_waiting > 25 ? 'warning' : 'ok',
      location: department.locations_count > 0 ? 'ok' : 'warning',
      room: department.rooms_count > 0 ? 'ok' : 'info',
      bed: department.beds_count > 0 ? 'ok' : 'info',
      service: department.services_count > 0 ? 'ok' : 'warning',
      warehouse: department.warehouses_count > 0 ? 'ok' : 'info',
    },
  }));

  const healthScore = Math.max(0, Math.min(100, Math.round(
    100 - (criticalBlockers.length * 4) - (warnings.length * 1.2),
  )));

  return {
    generated_at: new Date(),
    health_score: healthScore,
    summary: {
      departments_active: board.summary.active,
      locations_active: resources.locations.filter((location) => location.status === 'active').length,
      rooms_active: resources.rooms.filter((room) => room.status === 'active').length,
      beds_available: resources.summary.available_beds,
      imaging_equipment_down: resources.summary.imaging_equipment_down,
      warehouses_active: resources.warehouses.filter((warehouse) => warehouse.status === 'active').length,
      storage_locked: resources.summary.locked_storage_locations,
      critical_blockers: criticalBlockers.length,
      warnings: warnings.length,
    },
    heatmap,
    critical_blockers: criticalBlockers,
    warnings,
  };
}

async function getFacilityOverview() {
  const [board, resources, operationalStatus] = await Promise.all([
    buildDepartmentOperationsBoard(),
    getFacilityResourceBoard(),
    getOperationalStatus(),
  ]);
  return {
    generated_at: new Date(),
    summary: {
      ...board.summary,
      health_score: operationalStatus.health_score,
      locations: resources.summary.locations,
      rooms: resources.summary.rooms,
      beds: resources.summary.beds,
      imaging_rooms: resources.summary.imaging_rooms,
      warehouses: resources.summary.warehouses,
      storage_locations: resources.summary.storage_locations,
      services: resources.summary.services,
    },
    department_risks: board.items
      .filter((department) => department.risk_badges.length)
      .slice(0, 12),
    resource_summary: resources.summary,
    heatmap: operationalStatus.heatmap,
    warnings: operationalStatus.warnings.slice(0, 20),
  };
}

async function createDepartmentWithDefaults(payload = {}, actor = {}, requestMeta = {}) {
  const result = await departmentService.createDepartment(payload.department || {}, actor, requestMeta);
  const departmentId = result?.department?.department_id;
  const departmentCode = result?.department?.department_code;
  const departmentName = result?.department?.department_name;
  const defaults = payload.defaults || {};
  const created = {
    location: null,
    room: null,
    warehouse: null,
  };

  if (defaults.create_location) {
    const location = await FacilityLocation.create({
      name: defaults.location_name || `${departmentName} - địa điểm mặc định`,
      type: defaults.location_type || 'clinic',
      department_id: departmentId,
      address: defaults.address,
      phone: defaults.phone,
      opening_hours: defaults.opening_hours,
      status: 'active',
      public_visible: defaults.public_visible !== false,
      metadata: {
        created_from_facility_wizard: true,
        note: defaults.location_note,
      },
      created_by: actor.userId,
    });
    created.location = {
      location_id: idOf(location._id),
      name: location.name,
      type: location.type,
      status: location.status,
    };
  }

  if (defaults.create_room) {
    const room = await Room.create({
      department_id: departmentId,
      room_code: defaults.room_code || `${departmentCode}-ROOM-01`,
      room_name: defaults.room_name || `${departmentName} - phòng mặc định`,
      room_type: defaults.room_type || 'consultation',
      building: defaults.building,
      floor: defaults.floor,
      capacity: Number(defaults.capacity || 1),
      status: 'active',
      notes: defaults.room_note,
      created_by: actor.userId,
    });
    created.room = {
      room_id: idOf(room._id),
      room_code: room.room_code,
      room_name: room.room_name,
      status: room.status,
    };
  }

  if (defaults.create_warehouse) {
    const warehouse = await Warehouse.create({
      warehouse_code: defaults.warehouse_code || `${departmentCode}-WH`,
      name: defaults.warehouse_name || `${departmentName} - kho mặc định`,
      type: defaults.warehouse_type || 'department',
      department_id: departmentId,
      status: 'active',
      note: defaults.warehouse_note,
      created_by: actor.userId,
    });
    created.warehouse = {
      warehouse_id: idOf(warehouse._id),
      warehouse_code: warehouse.warehouse_code,
      name: warehouse.name,
      status: warehouse.status,
    };
  }

  return {
    department: result.department,
    created,
    profile: await getDepartmentOperationalProfile(departmentId),
  };
}

module.exports = {
  buildDepartmentOperationsBoard,
  createDepartmentWithDefaults,
  getDepartmentOperationalProfile,
  getFacilityOverview,
  getFacilityResourceBoard,
  getOperationalStatus,
};
