const { Department, DoctorProfile, FacilityLocation, ServiceCatalog, ScheduleSlot } = require('../models');
const { buildPagination, createError, getPagination } = require('./core.service');

function regex(value) {
  return value ? { $regex: String(value).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } : undefined;
}

async function listDepartments(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false, status: 'active' };
  const keyword = regex(query.search || query.keyword);
  if (keyword) filter.$or = [{ department_name: keyword }, { department_code: keyword }, { specialty: keyword }];
  const [items, total] = await Promise.all([
    Department.find(filter).sort({ department_name: 1 }).skip(skip).limit(limit).lean(),
    Department.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listDoctors(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false, status: 'active' };
  if (query.department_id) filter.department_id = query.department_id;
  if (query.specialty) filter.specialty = regex(query.specialty);
  const keyword = regex(query.search || query.keyword);
  if (keyword) filter.$or = [{ specialty: keyword }, { subspecialty: keyword }, { qualification: keyword }, { biography: keyword }, { license_number: keyword }];
  const [items, total] = await Promise.all([
    DoctorProfile.find(filter).sort({ specialty: 1, created_at: -1 }).skip(skip).limit(limit).populate('user_id', 'full_name username').lean(),
    DoctorProfile.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getDoctor(doctorId) {
  const doctor = await DoctorProfile.findOne({ _id: doctorId, is_deleted: false, status: 'active' })
    .populate('user_id', 'full_name username')
    .lean();
  if (!doctor) throw createError('Không tìm thấy bác sĩ public đang active.', 404);
  return doctor;
}

async function listServices(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false, status: 'active' };
  if (query.service_type) filter.service_type = query.service_type;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.insurance_supported !== undefined) filter.insurance_supported = query.insurance_supported === 'true' || query.insurance_supported === true;
  if (query.price_min || query.price_max) {
    filter.unit_price = {};
    if (query.price_min) filter.unit_price.$gte = Number(query.price_min);
    if (query.price_max) filter.unit_price.$lte = Number(query.price_max);
  }
  const keyword = regex(query.search || query.keyword);
  if (keyword) filter.$or = [{ service_code: keyword }, { service_name: keyword }];
  const [items, total] = await Promise.all([
    ServiceCatalog.find(filter).sort({ service_type: 1, service_name: 1 }).skip(skip).limit(limit).populate('department_id', 'department_name department_code').lean(),
    ServiceCatalog.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listLocations(type, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false, public_visible: true, status: 'active' };
  if (type) filter.type = type;
  if (query.department_id) filter.department_id = query.department_id;
  const keyword = regex(query.search || query.keyword || query.location);
  if (keyword) filter.$or = [{ name: keyword }, { address: keyword }];
  const [items, total] = await Promise.all([
    FacilityLocation.find(filter).sort({ type: 1, name: 1 }).skip(skip).limit(limit).populate('department_id', 'department_name department_code').lean(),
    FacilityLocation.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function listAvailableSlots(query = {}) {
  const { page, limit, skip } = getPagination(query, 20, 100);
  const filter = { status: 'available' };
  if (query.doctor_id) filter.doctor_id = query.doctor_id;
  if (query.department_id) filter.department_id = query.department_id;
  if (query.date) {
    const start = new Date(query.date);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.start_time = { $gte: start, $lt: end };
  }
  const [items, total] = await Promise.all([
    ScheduleSlot.find(filter).sort({ start_time: 1 }).skip(skip).limit(limit).lean(),
    ScheduleSlot.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

module.exports = {
  listDepartments,
  listDoctors,
  getDoctor,
  listServices,
  listServicePrices: listServices,
  listLocations,
  listAvailableSlots,
};
