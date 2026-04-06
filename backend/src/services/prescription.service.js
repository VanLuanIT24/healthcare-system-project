const {
  Encounter,
  MedicationMaster,
  Patient,
  Prescription,
  PrescriptionItem,
} = require('../models');
const {
  buildPagination,
  createError,
  escapeRegex,
  generateCode,
  getPagination,
  recordAuditLog,
} = require('./core.service');

const PRESCRIPTION_STATUS_TRANSITIONS = {
  draft: ['active', 'cancelled', 'completed'],
  active: ['verified', 'cancelled', 'completed', 'partially_dispensed', 'fully_dispensed'],
  verified: ['partially_dispensed', 'fully_dispensed', 'completed', 'cancelled'],
  partially_dispensed: ['fully_dispensed', 'completed', 'cancelled'],
  fully_dispensed: ['completed'],
  cancelled: [],
  completed: [],
};

function generatePrescriptionNumber() {
  return generateCode('RX');
}

function validatePrescriptionStatusTransition(currentStatus, nextStatus) {
  const allowed = PRESCRIPTION_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw createError(`Không thể chuyển trạng thái prescription từ ${currentStatus} sang ${nextStatus}.`, 409);
  }
  return true;
}

async function validatePrescriptionCreation(payload) {
  const encounter = await Encounter.findById(payload.encounter_id).lean();
  if (!encounter) throw createError('Không tìm thấy encounter.', 404);
  return { encounter };
}

async function checkPrescriptionEditable(prescriptionId) {
  const prescription = await Prescription.findById(prescriptionId).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  return {
    prescription_id: String(prescription._id),
    editable: ['draft', 'active'].includes(prescription.status),
    status: prescription.status,
  };
}

async function createPrescription(payload, actor, requestMeta = {}) {
  await validatePrescriptionCreation(payload);
  const prescription = await Prescription.create({
    encounter_id: payload.encounter_id,
    prescribed_by: payload.prescribed_by || actor?.userId,
    prescription_no: payload.prescription_no || generatePrescriptionNumber(),
    prescribed_at: payload.prescribed_at ? new Date(payload.prescribed_at) : new Date(),
    status: payload.status || 'draft',
    note: payload.note,
  });

  await recordAuditLog({
    actor,
    action: 'prescription.create',
    targetType: 'prescription',
    targetId: prescription._id,
    status: 'success',
    message: 'Tạo đơn thuốc thành công.',
    requestMeta,
  });

  return getPrescriptionDetail(prescription._id);
}

async function listPrescriptions(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.encounter_id) filter.encounter_id = query.encounter_id;
  if (query.prescribed_by) filter.prescribed_by = query.prescribed_by;
  if (query.status) filter.status = query.status;
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [{ prescription_no: { $regex: keyword, $options: 'i' } }];
  }

  const [items, total] = await Promise.all([
    Prescription.find(filter).sort({ prescribed_at: -1 }).skip(skip).limit(limit).lean(),
    Prescription.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
}

async function searchPrescriptions(query = {}) {
  return listPrescriptions(query);
}

async function getPrescriptionDetail(prescriptionId) {
  const prescription = await Prescription.findById(prescriptionId).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  const items = await PrescriptionItem.find({ prescription_id: prescription._id }).sort({ created_at: 1 }).lean();
  return { prescription, items };
}

async function updatePrescription(prescriptionId, payload, actor, requestMeta = {}) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  const editable = await checkPrescriptionEditable(prescription._id);
  if (!editable.editable) throw createError('Prescription hiện không thể chỉnh sửa.', 409);

  if (payload.note !== undefined) prescription.note = payload.note;
  if (payload.prescribed_at !== undefined) prescription.prescribed_at = payload.prescribed_at;
  prescription.updated_by = actor?.userId;
  await prescription.save();

  await recordAuditLog({
    actor,
    action: 'prescription.update',
    targetType: 'prescription',
    targetId: prescription._id,
    status: 'success',
    message: 'Cập nhật đơn thuốc thành công.',
    requestMeta,
  });

  return getPrescriptionDetail(prescription._id);
}

async function activatePrescription(prescriptionId, actor, requestMeta = {}) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  await validatePrescriptionBeforeActivate(prescription._id);
  validatePrescriptionStatusTransition(prescription.status, 'active');
  prescription.status = 'active';
  prescription.updated_by = actor?.userId;
  await prescription.save();
  await recordAuditLog({ actor, action: 'prescription.activate', targetType: 'prescription', targetId: prescription._id, status: 'success', message: 'Kích hoạt đơn thuốc thành công.', requestMeta });
  return getPrescriptionDetail(prescription._id);
}

async function cancelPrescription(prescriptionId, actor, requestMeta = {}) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  validatePrescriptionStatusTransition(prescription.status, 'cancelled');
  prescription.status = 'cancelled';
  prescription.updated_by = actor?.userId;
  await prescription.save();
  await recordAuditLog({ actor, action: 'prescription.cancel', targetType: 'prescription', targetId: prescription._id, status: 'success', message: 'Hủy đơn thuốc thành công.', requestMeta });
  return getPrescriptionDetail(prescription._id);
}

async function completePrescription(prescriptionId, actor, requestMeta = {}) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  validatePrescriptionStatusTransition(prescription.status, 'completed');
  prescription.status = 'completed';
  prescription.updated_by = actor?.userId;
  await prescription.save();
  await recordAuditLog({ actor, action: 'prescription.complete', targetType: 'prescription', targetId: prescription._id, status: 'success', message: 'Hoàn tất đơn thuốc thành công.', requestMeta });
  return getPrescriptionDetail(prescription._id);
}

async function validateMedicationAvailableForPrescription(medicationId) {
  const medication = await MedicationMaster.findById(medicationId).lean();
  if (!medication || medication.is_deleted) throw createError('Không tìm thấy thuốc.', 404);
  if (!['active'].includes(medication.status)) throw createError('Thuốc hiện không được phép kê đơn.', 409);
  return medication;
}

function calculatePrescriptionItemQuantity(payload = {}) {
  if (payload.quantity) return Number(payload.quantity);
  const duration = Number(payload.duration_days || 0);
  if (!duration) return 0;
  return duration;
}

function validatePrescriptionItemPayload(payload = {}) {
  if (!payload.prescription_id) throw createError('prescription_id là bắt buộc.');
  if (!payload.medication_id) throw createError('medication_id là bắt buộc.');
  if (payload.quantity !== undefined && Number(payload.quantity) <= 0) throw createError('quantity phải lớn hơn 0.');
  if (payload.duration_days !== undefined && Number(payload.duration_days) < 0) throw createError('duration_days không hợp lệ.');
  return true;
}

async function checkDrugAllergyConflict() {
  return { has_conflict: false, conflicts: [] };
}

async function checkDrugInteractionConflict() {
  return {
    has_conflict: false,
    conflicts: [],
    message: 'MVP hiện chưa tích hợp cơ sở dữ liệu tương tác thuốc.',
  };
}

async function checkDuplicateMedicationInPrescription(prescriptionId, medicationId, excludeItemId = null) {
  const filter = {
    prescription_id: prescriptionId,
    medication_id: medicationId,
    status: { $nin: ['cancelled'] },
  };
  if (excludeItemId) filter._id = { $ne: excludeItemId };

  const existing = await PrescriptionItem.findOne(filter).lean();
  return {
    has_duplicate: Boolean(existing),
    item: existing || null,
  };
}

async function addPrescriptionItem(payload, actor, requestMeta = {}) {
  validatePrescriptionItemPayload(payload);
  const prescription = await Prescription.findById(payload.prescription_id).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  const editable = await checkPrescriptionEditable(prescription._id);
  if (!editable.editable) throw createError('Prescription hiện không thể chỉnh sửa item.', 409);

  await validateMedicationAvailableForPrescription(payload.medication_id);
  const duplicate = await checkDuplicateMedicationInPrescription(payload.prescription_id, payload.medication_id);
  if (duplicate.has_duplicate) throw createError('Thuốc này đã tồn tại trong đơn thuốc.', 409);

  const quantity = calculatePrescriptionItemQuantity(payload);
  const item = await PrescriptionItem.create({
    prescription_id: payload.prescription_id,
    medication_id: payload.medication_id,
    dose: payload.dose,
    frequency: payload.frequency,
    route: payload.route,
    duration_days: payload.duration_days,
    quantity,
    instructions: payload.instructions,
    status: payload.status || 'active',
  });

  await recordAuditLog({
    actor,
    action: 'prescription_item.create',
    targetType: 'prescription_item',
    targetId: item._id,
    status: 'success',
    message: 'Thêm thuốc vào đơn thành công.',
    requestMeta,
  });

  return getPrescriptionItemDetail(item._id);
}

async function listPrescriptionItems(prescriptionId) {
  const items = await PrescriptionItem.find({ prescription_id: prescriptionId }).sort({ created_at: 1 }).lean();
  return { prescription_id: String(prescriptionId), items };
}

async function getPrescriptionItemDetail(itemId) {
  const item = await PrescriptionItem.findById(itemId).lean();
  if (!item) throw createError('Không tìm thấy prescription item.', 404);
  return { prescription_item: item };
}

async function updatePrescriptionItem(itemId, payload, actor, requestMeta = {}) {
  const item = await PrescriptionItem.findById(itemId);
  if (!item) throw createError('Không tìm thấy prescription item.', 404);
  const prescription = await Prescription.findById(item.prescription_id).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  const editable = await checkPrescriptionEditable(prescription._id);
  if (!editable.editable) throw createError('Prescription hiện không thể chỉnh sửa item.', 409);

  if (payload.medication_id && String(payload.medication_id) !== String(item.medication_id)) {
    await validateMedicationAvailableForPrescription(payload.medication_id);
    const duplicate = await checkDuplicateMedicationInPrescription(item.prescription_id, payload.medication_id, item._id);
    if (duplicate.has_duplicate) throw createError('Thuốc này đã tồn tại trong đơn thuốc.', 409);
    item.medication_id = payload.medication_id;
  }

  const fields = ['dose', 'frequency', 'route', 'duration_days', 'instructions', 'status'];
  for (const field of fields) {
    if (payload[field] !== undefined) item[field] = payload[field];
  }
  item.quantity = payload.quantity !== undefined ? Number(payload.quantity) : calculatePrescriptionItemQuantity(item);
  item.updated_by = actor?.userId;
  await item.save();

  await recordAuditLog({
    actor,
    action: 'prescription_item.update',
    targetType: 'prescription_item',
    targetId: item._id,
    status: 'success',
    message: 'Cập nhật thuốc trong đơn thành công.',
    requestMeta,
  });

  return getPrescriptionItemDetail(item._id);
}

async function stopPrescriptionItem(itemId, actor, requestMeta = {}) {
  return updatePrescriptionItem(itemId, { status: 'stopped' }, actor, requestMeta);
}

async function cancelPrescriptionItem(itemId, actor, requestMeta = {}) {
  return updatePrescriptionItem(itemId, { status: 'cancelled' }, actor, requestMeta);
}

async function completePrescriptionItem(itemId, actor, requestMeta = {}) {
  return updatePrescriptionItem(itemId, { status: 'completed' }, actor, requestMeta);
}

async function removePrescriptionItem(itemId, actor, requestMeta = {}) {
  return cancelPrescriptionItem(itemId, actor, requestMeta);
}

async function createMedication(payload, actor, requestMeta = {}) {
  const medication = await MedicationMaster.create({
    medication_code: payload.medication_code || generateCode('MED'),
    generic_name: payload.generic_name,
    brand_name: payload.brand_name,
    dosage_form: payload.dosage_form,
    strength: payload.strength,
    route_default: payload.route_default,
    unit: payload.unit,
    status: payload.status || 'active',
    created_by: actor?.userId,
  });

  await recordAuditLog({
    actor,
    action: 'medication.create',
    targetType: 'medication',
    targetId: medication._id,
    status: 'success',
    message: 'Tạo thuốc trong danh mục thành công.',
    requestMeta,
  });

  return getMedicationDetail(medication._id);
}

async function listMedications(query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.search) {
    const keyword = escapeRegex(query.search);
    filter.$or = [
      { medication_code: { $regex: keyword, $options: 'i' } },
      { generic_name: { $regex: keyword, $options: 'i' } },
      { brand_name: { $regex: keyword, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    MedicationMaster.find(filter).sort({ generic_name: 1 }).skip(skip).limit(limit).lean(),
    MedicationMaster.countDocuments(filter),
  ]);

  return { items, pagination: buildPagination(page, limit, total) };
}

async function searchMedications(query = {}) {
  return listMedications(query);
}

async function getMedicationDetail(medicationId) {
  const medication = await MedicationMaster.findById(medicationId).lean();
  if (!medication || medication.is_deleted) throw createError('Không tìm thấy thuốc.', 404);
  return { medication };
}

async function updateMedication(medicationId, payload, actor, requestMeta = {}) {
  const medication = await MedicationMaster.findById(medicationId);
  if (!medication || medication.is_deleted) throw createError('Không tìm thấy thuốc.', 404);
  const fields = ['generic_name', 'brand_name', 'dosage_form', 'strength', 'route_default', 'unit'];
  for (const field of fields) {
    if (payload[field] !== undefined) medication[field] = payload[field];
  }
  medication.updated_by = actor?.userId;
  await medication.save();
  await recordAuditLog({ actor, action: 'medication.update', targetType: 'medication', targetId: medication._id, status: 'success', message: 'Cập nhật thuốc thành công.', requestMeta });
  return getMedicationDetail(medication._id);
}

async function updateMedicationStatus(medicationId, status, actor, requestMeta = {}) {
  const medication = await MedicationMaster.findById(medicationId);
  if (!medication || medication.is_deleted) throw createError('Không tìm thấy thuốc.', 404);
  medication.status = status;
  medication.updated_by = actor?.userId;
  await medication.save();
  await recordAuditLog({ actor, action: 'medication.update_status', targetType: 'medication', targetId: medication._id, status: 'success', message: 'Cập nhật trạng thái thuốc thành công.', requestMeta, metadata: { status } });
  return getMedicationDetail(medication._id);
}

async function getEncounterPrescriptions(encounterId, query = {}) {
  return listPrescriptions({ ...query, encounter_id: encounterId });
}

async function getPatientPrescriptionHistory(patientId, query = {}) {
  const encounters = await Encounter.find({ patient_id: patientId }).select('_id').lean();
  const encounterIds = encounters.map((item) => item._id);
  return listPrescriptions({ ...query, encounter_id: { $in: encounterIds } });
}

async function getDoctorPrescriptions(doctorId, query = {}) {
  return listPrescriptions({ ...query, prescribed_by: doctorId });
}

async function validatePrescriptionBeforeActivate(prescriptionId) {
  const prescription = await Prescription.findById(prescriptionId).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);

  const items = await PrescriptionItem.find({
    prescription_id: prescription._id,
    status: { $nin: ['cancelled'] },
  }).lean();

  if (items.length === 0) {
    throw createError('Prescription phải có ít nhất một item trước khi activate.', 409);
  }

  for (const item of items) {
    await validateMedicationAvailableForPrescription(item.medication_id);
  }

  const allergyCheck = await checkDrugAllergyConflict(prescription._id);
  const interactionCheck = await checkDrugInteractionConflict(prescription._id);

  if (allergyCheck.has_conflict || interactionCheck.has_conflict) {
    throw createError('Prescription đang có xung đột thuốc cần xử lý trước khi activate.', 409);
  }

  return {
    prescription_id: String(prescription._id),
    can_activate: true,
    items_count: items.length,
  };
}

async function getPrescriptionSummary(prescriptionId) {
  const prescription = await Prescription.findById(prescriptionId).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);
  const items = await PrescriptionItem.find({ prescription_id: prescription._id }).lean();

  return {
    prescription_id: String(prescription._id),
    status: prescription.status,
    items_count: items.length,
    active_items_count: items.filter((item) => item.status === 'active').length,
    total_medications: new Set(items.map((item) => String(item.medication_id))).size,
  };
}

async function getPatientActivePrescriptions(patientId, query = {}) {
  const patient = await Patient.findById(patientId).lean();
  if (!patient || patient.is_deleted) throw createError('Không tìm thấy bệnh nhân.', 404);
  const encounters = await Encounter.find({ patient_id: patient._id }).select('_id').lean();
  const encounterIds = encounters.map((item) => item._id);
  return listPrescriptions({
    ...query,
    encounter_id: { $in: encounterIds },
    status: 'active',
  });
}

async function duplicatePrescription(prescriptionId, payload = {}, actor, requestMeta = {}) {
  const prescription = await Prescription.findById(prescriptionId).lean();
  if (!prescription) throw createError('Không tìm thấy prescription.', 404);

  const items = await PrescriptionItem.find({ prescription_id: prescription._id, status: { $nin: ['cancelled'] } }).lean();
  const created = await createPrescription(
    {
      encounter_id: payload.encounter_id || prescription.encounter_id,
      prescribed_by: payload.prescribed_by || actor?.userId || prescription.prescribed_by,
      note: payload.note !== undefined ? payload.note : prescription.note,
      status: 'draft',
    },
    actor,
    requestMeta,
  );

  const targetId = created.prescription._id || created.prescription.prescription_id || created.prescription.id;
  const createdPrescriptionId = targetId || created.prescription_id;
  for (const item of items) {
    await addPrescriptionItem(
      {
        prescription_id: createdPrescriptionId,
        medication_id: item.medication_id,
        dose: item.dose,
        frequency: item.frequency,
        route: item.route,
        duration_days: item.duration_days,
        quantity: item.quantity,
        instructions: item.instructions,
      },
      actor,
      requestMeta,
    );
  }

  return getPrescriptionDetail(createdPrescriptionId);
}

async function renewPrescription(prescriptionId, payload = {}, actor, requestMeta = {}) {
  return duplicatePrescription(
    prescriptionId,
    {
      ...payload,
      note: payload.note || 'Gia hạn từ đơn thuốc cũ.',
    },
    actor,
    requestMeta,
  );
}

module.exports = {
  createPrescription,
  listPrescriptions,
  getPrescriptionDetail,
  updatePrescription,
  activatePrescription,
  cancelPrescription,
  completePrescription,
  generatePrescriptionNumber,
  validatePrescriptionCreation,
  validatePrescriptionStatusTransition,
  validatePrescriptionBeforeActivate,
  checkPrescriptionEditable,
  addPrescriptionItem,
  listPrescriptionItems,
  getPrescriptionItemDetail,
  updatePrescriptionItem,
  stopPrescriptionItem,
  cancelPrescriptionItem,
  completePrescriptionItem,
  removePrescriptionItem,
  validatePrescriptionItemPayload,
  checkDrugAllergyConflict,
  checkDrugInteractionConflict,
  checkDuplicateMedicationInPrescription,
  calculatePrescriptionItemQuantity,
  createMedication,
  listMedications,
  searchMedications,
  getMedicationDetail,
  updateMedication,
  updateMedicationStatus,
  validateMedicationAvailableForPrescription,
  getEncounterPrescriptions,
  getPatientPrescriptionHistory,
  getPatientActivePrescriptions,
  getDoctorPrescriptions,
  searchPrescriptions,
  getPrescriptionSummary,
  duplicatePrescription,
  renewPrescription,
};
