const {
  Encounter,
  ImagingOrder,
  LabOrder,
  Patient,
  ProcedureOrder,
} = require('../models');
const { escapeRegex } = require('../services/core.service');

function uniqueIds(items = []) {
  return [...new Set(items.filter(Boolean).map((item) => String(item?._id || item)))];
}

async function findSearchOrderIds(keyword) {
  const pattern = escapeRegex(keyword);
  const [patients, encounters, labOrders, imagingOrders, procedureOrders] = await Promise.all([
    Patient.find({
      $or: [
        { patient_code: { $regex: pattern, $options: 'i' } },
        { full_name: { $regex: pattern, $options: 'i' } },
        { phone: { $regex: pattern, $options: 'i' } },
      ],
    }).select('_id').lean(),
    Encounter.find({
      $or: [
        { encounter_code: { $regex: pattern, $options: 'i' } },
        { encounter_type: { $regex: pattern, $options: 'i' } },
      ],
    }).select('_id').lean(),
    LabOrder.find({
      $or: [
        { lab_order_no: { $regex: pattern, $options: 'i' } },
        { test_name: { $regex: pattern, $options: 'i' } },
        { test_code: { $regex: pattern, $options: 'i' } },
        { specimen_type: { $regex: pattern, $options: 'i' } },
      ],
    }).select('order_id').lean(),
    ImagingOrder.find({
      $or: [
        { imaging_order_no: { $regex: pattern, $options: 'i' } },
        { modality: { $regex: pattern, $options: 'i' } },
        { body_part: { $regex: pattern, $options: 'i' } },
      ],
    }).select('order_id').lean(),
    ProcedureOrder.find({
      $or: [
        { procedure_order_no: { $regex: pattern, $options: 'i' } },
        { procedure_name: { $regex: pattern, $options: 'i' } },
        { procedure_code: { $regex: pattern, $options: 'i' } },
      ],
    }).select('order_id').lean(),
  ]);

  return {
    patientIds: uniqueIds(patients),
    encounterIds: uniqueIds(encounters),
    orderIds: uniqueIds([
      ...labOrders.map((item) => item.order_id),
      ...imagingOrders.map((item) => item.order_id),
      ...procedureOrders.map((item) => item.order_id),
    ]),
  };
}

module.exports = {
  findSearchOrderIds,
};
