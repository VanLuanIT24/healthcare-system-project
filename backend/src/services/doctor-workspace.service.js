const {
  Allergy,
  Appointment,
  Attachment,
  CarePlan,
  ClinicalNote,
  Consultation,
  ConsentRecord,
  Diagnosis,
  Dispense,
  Encounter,
  ImagingOrder,
  ImagingReport,
  LabOrder,
  LabResult,
  LabResultItem,
  MedicalRecord,
  Notification,
  Order,
  Patient,
  Prescription,
  PrescriptionRefillRequest,
  ProblemList,
  ProcedureOrder,
  ProcedureResult,
  QueueTicket,
  SupportTicket,
  User,
  VitalSign,
} = require('../models');
const { createError, getEndOfDay, getStartOfDay } = require('./core.service');
const {
  ALLERGY_STATUS,
  APPOINTMENT_STATUS,
  CARE_PLAN_STATUS,
  CLINICAL_NOTE_STATUS,
  CONSULTATION_STATUS,
  DIAGNOSIS_STATUS,
  ENCOUNTER_STATUS,
  LAB_RESULT_STATUS,
  ORDER_STATUS,
  PRESCRIPTION_STATUS,
  PRESCRIPTION_REFILL_REQUEST_STATUS,
  PROBLEM_STATUS,
  QUEUE_STATUS,
} = require('../constants/statuses');

const ACTIVE_ENCOUNTER_STATUSES = [
  ENCOUNTER_STATUS.PLANNED,
  ENCOUNTER_STATUS.ARRIVED,
  ENCOUNTER_STATUS.IN_PROGRESS,
  ENCOUNTER_STATUS.ON_HOLD,
];

const ACTIVE_QUEUE_STATUSES = [
  QUEUE_STATUS.WAITING,
  QUEUE_STATUS.CALLED,
  QUEUE_STATUS.RECALLED,
  QUEUE_STATUS.IN_SERVICE,
  QUEUE_STATUS.SKIPPED,
];

const ACTIVE_ORDER_STATUSES = [
  ORDER_STATUS.DRAFT,
  ORDER_STATUS.ORDERED,
  ORDER_STATUS.ACKNOWLEDGED,
  ORDER_STATUS.IN_PROGRESS,
];

const RESULT_FINAL_STATUSES = [
  LAB_RESULT_STATUS.FINAL,
  LAB_RESULT_STATUS.AMENDED,
  'final',
  'amended',
  'signed',
];

function toId(value) {
  return value ? String(value._id || value.id || value) : null;
}

function actorDoctorId(actor = {}) {
  return actor.userId || actor.user_id || actor.user?._id || actor.user?.id || null;
}

function actorDepartmentId(actor = {}) {
  return actor.departmentId || actor.department_id || actor.user?.department_id || null;
}

function ensureDoctorActor(actor = {}) {
  const doctorId = actorDoctorId(actor);
  if (!doctorId) {
    throw createError('Không xác định được bác sĩ hiện tại.', 403);
  }
  return String(doctorId);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function asDateRange(query = {}) {
  const date = query.date || new Date();
  return {
    start: getStartOfDay(date),
    end: getEndOfDay(date),
  };
}

function ageFromDate(date) {
  if (!date) return null;
  const birth = new Date(date);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function patientCompact(patient) {
  if (!patient) return null;
  return {
    patient_id: toId(patient),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    gender: patient.gender,
    age: ageFromDate(patient.date_of_birth),
    date_of_birth: patient.date_of_birth,
    phone: patient.phone,
    email: patient.email,
    insurance_number: patient.insurance_number,
    status: patient.status,
  };
}

function doctorCompact(user) {
  if (!user) return null;
  return {
    user_id: toId(user),
    full_name: user.full_name,
    employee_code: user.employee_code,
    department_id: toId(user.department_id),
    status: user.status,
  };
}

function departmentCompact(department) {
  if (!department) return null;
  return {
    department_id: toId(department),
    department_code: department.department_code,
    department_name: department.department_name,
    status: department.status,
  };
}

function vitalCompact(vital) {
  if (!vital) return null;
  return {
    vital_sign_id: toId(vital),
    recorded_at: vital.recorded_at || vital.created_at,
    blood_pressure_systolic: vital.blood_pressure_systolic,
    blood_pressure_diastolic: vital.blood_pressure_diastolic,
    pulse: vital.pulse,
    heart_rate: vital.heart_rate,
    respiratory_rate: vital.respiratory_rate,
    temperature: vital.temperature,
    spo2: vital.spo2,
    weight: vital.weight,
    height: vital.height,
    bmi: vital.bmi,
    status: vital.status,
  };
}

function queueCompact(ticket) {
  return {
    queue_ticket_id: toId(ticket),
    queue_number: ticket.queue_number,
    display_number: ticket.display_number || ticket.queue_number,
    queue_type: ticket.queue_type,
    status: ticket.status,
    nursing_stage: ticket.nursing_stage,
    checkin_time: ticket.checkin_time,
    called_time: ticket.called_time,
    service_start_time: ticket.service_start_time,
    ready_for_doctor_at: ticket.ready_for_doctor_at,
    sla_due_at: ticket.sla_due_at,
    priority_reason: ticket.priority_reason,
    doctor_room_id: ticket.doctor_room_id,
    patient: patientCompact(ticket.patient_id),
    latest_vital: vitalCompact(ticket.latest_vital_sign_id),
    appointment_id: toId(ticket.appointment_id),
    encounter_id: toId(ticket.encounter_id),
  };
}

function appointmentCompact(appointment) {
  return {
    appointment_id: toId(appointment),
    appointment_code: appointment.appointment_code,
    appointment_no: appointment.appointment_no,
    appointment_time: appointment.appointment_time,
    appointment_type: appointment.appointment_type,
    reason: appointment.reason || appointment.visit_reason || appointment.note,
    status: appointment.status,
    patient: patientCompact(appointment.patient_id),
    department: departmentCompact(appointment.department_id),
  };
}

function encounterCompact(encounter, readiness = null) {
  return {
    encounter_id: toId(encounter),
    encounter_code: encounter.encounter_code,
    encounter_type: encounter.encounter_type,
    status: encounter.status,
    nursing_status: encounter.nursing_status,
    start_time: encounter.start_time,
    started_at: encounter.started_at,
    end_time: encounter.end_time,
    chief_reason: encounter.chief_reason,
    patient: patientCompact(encounter.patient_id),
    department: departmentCompact(encounter.department_id),
    attending_doctor: doctorCompact(encounter.attending_doctor_id),
    appointment_id: toId(encounter.appointment_id),
    readiness,
  };
}

function orderCompact(order) {
  return {
    order_id: toId(order),
    order_no: order.order_no,
    order_type: order.order_type,
    priority: order.priority,
    status: order.status,
    ordered_at: order.ordered_at,
    requested_at: order.requested_at,
    clinical_indication: order.clinical_indication,
    patient: patientCompact(order.patient_id),
    encounter_id: toId(order.encounter_id),
    charge_id: toId(order.charge_id),
  };
}

function prescriptionCompact(prescription) {
  return {
    prescription_id: toId(prescription),
    prescription_no: prescription.prescription_no,
    status: prescription.status,
    prescribed_at: prescription.prescribed_at,
    verified_at: prescription.verified_at,
    completed_at: prescription.completed_at,
    patient: patientCompact(prescription.patient_id),
    encounter_id: toId(prescription.encounter_id),
  };
}

function labResultCompact(result, order = null) {
  const labOrder = order || result.lab_order_id;
  return {
    result_id: toId(result),
    result_no: result.result_no,
    result_type: 'lab',
    title: labOrder?.test_name || 'Kết quả xét nghiệm',
    status: result.status,
    reported_at: result.reported_at,
    released_to_doctor_at: result.released_to_doctor_at,
    doctor_viewed_at: result.doctor_viewed_at,
    doctor_acknowledged_at: result.doctor_acknowledged_at,
    is_critical: Boolean(result.is_critical),
    critical_acknowledged_at: result.critical_acknowledged_at,
    patient: patientCompact(result.patient_id),
    encounter_id: toId(labOrder?.encounter_id),
    source_order_id: toId(labOrder),
    summary: result.interpretation || result.notes || '',
  };
}

function imagingResultCompact(report, order = null) {
  const imagingOrder = order || report.imaging_order_id;
  return {
    result_id: toId(report),
    result_no: report.report_no,
    result_type: 'imaging',
    title: imagingOrder?.study_name || imagingOrder?.modality || 'Kết quả CĐHA',
    status: report.status,
    reported_at: report.reported_at,
    released_to_doctor_at: report.released_to_doctor_at,
    doctor_viewed_at: report.doctor_viewed_at,
    doctor_acknowledged_at: report.doctor_acknowledged_at,
    is_critical: Boolean(report.is_critical),
    critical_acknowledged_at: report.critical_acknowledged_at,
    patient: patientCompact(report.patient_id),
    encounter_id: toId(imagingOrder?.encounter_id),
    source_order_id: toId(imagingOrder),
    summary: report.impression || report.findings || report.recommendation || report.critical_finding || '',
  };
}

function procedureResultCompact(result, order = null) {
  const procedureOrder = order || result.procedure_order_id;
  return {
    result_id: toId(result),
    result_no: result.result_no,
    result_type: 'procedure',
    title: procedureOrder?.procedure_name || 'Kết quả thủ thuật',
    status: result.status,
    reported_at: result.reported_at,
    released_to_doctor_at: result.released_to_doctor_at,
    doctor_viewed_at: result.doctor_viewed_at,
    doctor_acknowledged_at: result.doctor_acknowledged_at,
    is_critical: Boolean(result.is_critical),
    critical_acknowledged_at: result.critical_acknowledged_at,
    patient: patientCompact(result.patient_id),
    encounter_id: toId(result.encounter_id || procedureOrder?.encounter_id),
    source_order_id: toId(procedureOrder),
    summary: result.conclusion || result.findings || result.recommendation || result.critical_note || '',
  };
}

function notificationCompact(notification) {
  return {
    notification_id: toId(notification),
    title: notification.title,
    message: notification.message,
    tone: notification.tone || notification.priority || notification.type,
    is_read: Boolean(notification.is_read || notification.read_at),
    occurred_at: notification.occurred_at || notification.created_at,
    path: notification.path || notification.deep_link || notification.action_url,
  };
}

async function buildEncounterReadiness(encounterIds = []) {
  if (!encounterIds.length) return new Map();

  const [notes, diagnoses, primaryDiagnoses, orders, prescriptions, carePlans, consultations] = await Promise.all([
    ClinicalNote.aggregate([
      { $match: { encounter_id: { $in: encounterIds }, status: { $nin: [CLINICAL_NOTE_STATUS.CANCELLED] } } },
      { $group: { _id: '$encounter_id', total: { $sum: 1 }, signed: { $sum: { $cond: [{ $in: ['$status', [CLINICAL_NOTE_STATUS.SIGNED, CLINICAL_NOTE_STATUS.AMENDED]] }, 1, 0] } }, draft: { $sum: { $cond: [{ $in: ['$status', [CLINICAL_NOTE_STATUS.DRAFT, CLINICAL_NOTE_STATUS.IN_PROGRESS]] }, 1, 0] } } } },
    ]),
    Diagnosis.aggregate([
      { $match: { encounter_id: { $in: encounterIds }, status: { $ne: DIAGNOSIS_STATUS.ENTERED_IN_ERROR } } },
      { $group: { _id: '$encounter_id', total: { $sum: 1 } } },
    ]),
    Diagnosis.aggregate([
      { $match: { encounter_id: { $in: encounterIds }, is_primary: true, status: { $ne: DIAGNOSIS_STATUS.ENTERED_IN_ERROR } } },
      { $group: { _id: '$encounter_id', total: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { encounter_id: { $in: encounterIds }, status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.ENTERED_IN_ERROR] } } },
      { $group: { _id: '$encounter_id', total: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ['$status', ACTIVE_ORDER_STATUSES] }, 1, 0] } } } },
    ]),
    Prescription.aggregate([
      { $match: { encounter_id: { $in: encounterIds }, status: { $ne: PRESCRIPTION_STATUS.CANCELLED } } },
      { $group: { _id: '$encounter_id', total: { $sum: 1 }, draft: { $sum: { $cond: [{ $eq: ['$status', PRESCRIPTION_STATUS.DRAFT] }, 1, 0] } } } },
    ]),
    CarePlan.aggregate([
      { $match: { encounter_id: { $in: encounterIds }, status: { $nin: [CARE_PLAN_STATUS.CANCELLED] } } },
      { $group: { _id: '$encounter_id', total: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ['$status', [CARE_PLAN_STATUS.ACTIVE, CARE_PLAN_STATUS.COMPLETED]] }, 1, 0] } } } },
    ]),
    Consultation.aggregate([
      { $match: { encounter_id: { $in: encounterIds }, status: { $ne: CONSULTATION_STATUS.CANCELLED } } },
      { $group: { _id: '$encounter_id', total: { $sum: 1 }, signed: { $sum: { $cond: [{ $in: ['$status', [CONSULTATION_STATUS.SIGNED, CONSULTATION_STATUS.AMENDED]] }, 1, 0] } }, draft: { $sum: { $cond: [{ $in: ['$status', [CONSULTATION_STATUS.DRAFT, CONSULTATION_STATUS.IN_PROGRESS]] }, 1, 0] } } } },
    ]),
  ]);

  const byId = new Map();
  const merge = (rows, key) => {
    rows.forEach((row) => {
      const id = toId(row._id);
      byId.set(id, { ...(byId.get(id) || {}), [key]: row });
    });
  };
  merge(notes, 'notes');
  merge(diagnoses, 'diagnoses');
  merge(primaryDiagnoses, 'primaryDiagnoses');
  merge(orders, 'orders');
  merge(prescriptions, 'prescriptions');
  merge(carePlans, 'carePlans');
  merge(consultations, 'consultations');

  return byId;
}

function completionChecklistFromReadiness(encounter, readiness = {}) {
  const noteSigned = Number(readiness.notes?.signed || 0) > 0;
  const hasPrimaryDiagnosis = Number(readiness.primaryDiagnoses?.total || 0) > 0;
  const hasCarePlan = Number(readiness.carePlans?.active || readiness.carePlans?.total || 0) > 0;
  const noDraftPrescription = Number(readiness.prescriptions?.draft || 0) === 0;
  const noActiveOrder = Number(readiness.orders?.active || 0) === 0;
  const noDraftConsultation = Number(readiness.consultations?.draft || 0) === 0;
  const items = [
    { key: 'clinical_note', label: 'Clinical note đã ký', done: noteSigned, count: Number(readiness.notes?.signed || 0) },
    { key: 'primary_diagnosis', label: 'Có chẩn đoán chính', done: hasPrimaryDiagnosis, count: Number(readiness.primaryDiagnoses?.total || 0) },
    { key: 'care_plan', label: 'Có care plan / dặn dò', done: hasCarePlan, count: Number(readiness.carePlans?.total || 0) },
    { key: 'orders_clear', label: 'Không còn order chờ', done: noActiveOrder, count: Number(readiness.orders?.active || 0) },
    { key: 'prescription_clear', label: 'Không còn đơn thuốc draft', done: noDraftPrescription, count: Number(readiness.prescriptions?.draft || 0) },
    { key: 'consultation_clear', label: 'Không còn hội chẩn draft', done: noDraftConsultation, count: Number(readiness.consultations?.draft || 0) },
  ];
  const doneCount = items.filter((item) => item.done).length;
  return {
    encounter_id: toId(encounter),
    score: Math.round((doneCount / items.length) * 100),
    can_complete: encounter.status === ENCOUNTER_STATUS.IN_PROGRESS && doneCount === items.length,
    items,
    missing: items.filter((item) => !item.done).map((item) => item.label),
  };
}

async function getDoctorScopeIds(doctorId, dayRange) {
  const encounters = await Encounter.find({
    attending_doctor_id: doctorId,
    $or: [
      { status: { $in: ACTIVE_ENCOUNTER_STATUSES } },
      { start_time: { $gte: dayRange.start, $lte: dayRange.end } },
    ],
  })
    .select('_id patient_id status start_time')
    .lean();

  return {
    encounterIds: encounters.map((item) => item._id),
    patientIds: [...new Set(encounters.map((item) => toId(item.patient_id)).filter(Boolean))],
    encounters,
  };
}

async function getResultInbox({ doctorId, dayRange, limit = 12, onlyCritical = false }) {
  const { encounterIds, patientIds } = await getDoctorScopeIds(doctorId, dayRange);
  const [labOrders, imagingOrders, procedureOrders] = await Promise.all([
    LabOrder.find({ $or: [{ ordered_by: doctorId }, { encounter_id: { $in: encounterIds } }] }).select('_id encounter_id test_name').lean(),
    ImagingOrder.find({ $or: [{ ordered_by: doctorId }, { encounter_id: { $in: encounterIds } }] }).select('_id encounter_id modality study_name').lean(),
    ProcedureOrder.find({ $or: [{ requested_by: doctorId }, { encounter_id: { $in: encounterIds } }] }).select('_id encounter_id procedure_name').lean(),
  ]);

  const labOrderById = new Map(labOrders.map((item) => [toId(item), item]));
  const imagingOrderById = new Map(imagingOrders.map((item) => [toId(item), item]));
  const procedureOrderById = new Map(procedureOrders.map((item) => [toId(item), item]));

  const labFilter = {
    is_current: true,
    status: { $in: RESULT_FINAL_STATUSES },
    $or: [
      { lab_order_id: { $in: labOrders.map((item) => item._id) } },
      { patient_id: { $in: patientIds } },
    ],
    ...(onlyCritical ? { is_critical: true, critical_acknowledged_at: null } : {}),
  };
  const imagingFilter = {
    is_current: true,
    status: { $in: RESULT_FINAL_STATUSES },
    $or: [
      { imaging_order_id: { $in: imagingOrders.map((item) => item._id) } },
      { patient_id: { $in: patientIds } },
    ],
    ...(onlyCritical ? { is_critical: true, critical_acknowledged_at: null } : {}),
  };
  const procedureFilter = {
    status: { $in: RESULT_FINAL_STATUSES },
    $or: [
      { procedure_order_id: { $in: procedureOrders.map((item) => item._id) } },
      { encounter_id: { $in: encounterIds } },
      { patient_id: { $in: patientIds } },
    ],
    ...(onlyCritical ? { is_critical: true, critical_acknowledged_at: null } : {}),
  };

  const [labResults, imagingResults, procedureResults] = await Promise.all([
    LabResult.find(labFilter).populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status').sort({ reported_at: -1, created_at: -1 }).limit(limit).lean(),
    ImagingReport.find(imagingFilter).populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status').sort({ reported_at: -1, created_at: -1 }).limit(limit).lean(),
    ProcedureResult.find(procedureFilter).populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status').sort({ reported_at: -1, created_at: -1 }).limit(limit).lean(),
  ]);

  const results = [
    ...labResults.map((item) => labResultCompact(item, labOrderById.get(toId(item.lab_order_id)))),
    ...imagingResults.map((item) => imagingResultCompact(item, imagingOrderById.get(toId(item.imaging_order_id)))),
    ...procedureResults.map((item) => procedureResultCompact(item, procedureOrderById.get(toId(item.procedure_order_id)))),
  ].sort((left, right) => new Date(right.reported_at || right.released_to_doctor_at || 0) - new Date(left.reported_at || left.released_to_doctor_at || 0));

  return results.slice(0, limit);
}

async function getOverview(query = {}, actor = {}) {
  const doctorId = ensureDoctorActor(actor);
  const dayRange = asDateRange(query);
  const limit = Math.min(Math.max(Number(query.limit || 12), 4), 30);

  const [doctor, appointments, queueTickets, activeEncounters, completedToday, openEncounterCount, orders, prescriptions, doctorPrescriptionIds, notifications] = await Promise.all([
    User.findById(doctorId).select('full_name employee_code department_id status').populate('department_id', 'department_code department_name status').lean(),
    Appointment.find({
      doctor_id: doctorId,
      appointment_time: { $gte: dayRange.start, $lte: dayRange.end },
      status: { $nin: [APPOINTMENT_STATUS.CANCELLED] },
    })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .populate('department_id', 'department_code department_name status')
      .sort({ appointment_time: 1 })
      .limit(40)
      .lean(),
    QueueTicket.find({
      doctor_id: doctorId,
      queue_date: { $gte: dayRange.start, $lte: dayRange.end },
      status: { $in: ACTIVE_QUEUE_STATUSES },
    })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .populate('latest_vital_sign_id')
      .sort({ ready_for_doctor_at: -1, checkin_time: 1, created_at: 1 })
      .limit(40)
      .lean(),
    Encounter.find({ attending_doctor_id: doctorId, status: { $in: ACTIVE_ENCOUNTER_STATUSES } })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .populate('department_id', 'department_code department_name status')
      .populate('attending_doctor_id', 'full_name employee_code department_id status')
      .sort({ started_at: -1, start_time: -1 })
      .limit(20)
      .lean(),
    Encounter.countDocuments({
      attending_doctor_id: doctorId,
      status: ENCOUNTER_STATUS.COMPLETED,
      end_time: { $gte: dayRange.start, $lte: dayRange.end },
    }),
    Encounter.countDocuments({ attending_doctor_id: doctorId, status: { $in: ACTIVE_ENCOUNTER_STATUSES } }),
    Order.find({ ordered_by: doctorId, status: { $in: ACTIVE_ORDER_STATUSES } })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .sort({ priority: -1, ordered_at: -1 })
      .limit(limit)
      .lean(),
    Prescription.find({ prescribed_by: doctorId, status: { $in: [PRESCRIPTION_STATUS.DRAFT, PRESCRIPTION_STATUS.ACTIVE, PRESCRIPTION_STATUS.VERIFIED, PRESCRIPTION_STATUS.PARTIALLY_DISPENSED] } })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .sort({ prescribed_at: -1 })
      .limit(limit)
      .lean(),
    Prescription.find({ prescribed_by: doctorId }).distinct('_id').catch(() => []),
    Notification.find({ $or: [{ recipient_id: doctorId }, { recipient_user_id: doctorId }, { recipient_actor_id: doctorId }] })
      .sort({ created_at: -1 })
      .limit(8)
      .lean()
      .catch(() => []),
  ]);

  const refillRequests = await PrescriptionRefillRequest.find({
    status: PRESCRIPTION_REFILL_REQUEST_STATUS.PENDING,
    $or: [
      { reviewed_by_doctor: doctorId },
      { prescription_id: { $in: doctorPrescriptionIds } },
      { routed_to_doctor_at: { $ne: null } },
    ],
  })
    .sort({ priority: 1, created_at: -1 })
    .limit(8)
    .lean()
    .catch(() => []);

  const encounterIds = activeEncounters.map((item) => item._id);
  const readinessByEncounter = await buildEncounterReadiness(encounterIds);
  const newResults = await getResultInbox({ doctorId, dayRange, limit: 10 });
  const criticalResults = await getResultInbox({ doctorId, dayRange, limit: 10, onlyCritical: true });

  const draftNotesCount = [...readinessByEncounter.values()].reduce((sum, item) => sum + Number(item.notes?.draft || 0), 0);
  const activeOrderCount = orders.length;
  const draftPrescriptionCount = prescriptions.filter((item) => item.status === PRESCRIPTION_STATUS.DRAFT).length;
  const waitingQueueCount = queueTickets.filter((item) => [QUEUE_STATUS.WAITING, QUEUE_STATUS.CALLED, QUEUE_STATUS.RECALLED].includes(item.status)).length;

  const encounterCards = activeEncounters.map((encounter) => {
    const readiness = completionChecklistFromReadiness(encounter, readinessByEncounter.get(toId(encounter)) || {});
    return encounterCompact(encounter, readiness);
  });

  const tasks = buildTaskInbox({
    activeEncounters: encounterCards,
    criticalResults,
    orders,
    prescriptions,
    refillRequests,
  });

  return {
    date: dayRange.start.toISOString(),
    doctor: {
      ...doctorCompact(doctor),
      department: departmentCompact(doctor?.department_id),
    },
    kpis: {
      waiting_patients: waitingQueueCount,
      active_encounters: openEncounterCount,
      completed_today: completedToday,
      appointments_today: appointments.length,
      new_results: newResults.filter((item) => !item.doctor_viewed_at).length,
      critical_unhandled: criticalResults.length,
      pending_tasks: tasks.length,
      draft_notes: draftNotesCount,
      active_orders: activeOrderCount,
      draft_prescriptions: draftPrescriptionCount,
    },
    queue: queueTickets.map(queueCompact),
    appointments: appointments.map(appointmentCompact),
    active_encounters: encounterCards,
    orders: orders.map(orderCompact),
    prescriptions: prescriptions.map(prescriptionCompact),
    results: newResults,
    critical_results: criticalResults,
    tasks,
    notifications: notifications.map(notificationCompact),
    workflow: [
      { key: 'queue', label: 'Bệnh nhân chờ', count: waitingQueueCount },
      { key: 'encounter', label: 'Encounter mở', count: openEncounterCount },
      { key: 'orders', label: 'Order chờ', count: activeOrderCount },
      { key: 'results', label: 'Kết quả mới', count: newResults.length },
      { key: 'prescription', label: 'Đơn draft', count: draftPrescriptionCount },
      { key: 'complete', label: 'Việc cần hoàn tất', count: tasks.length },
    ],
    backend_capability_map: {
      existing: [
        'encounter lifecycle',
        'clinical note signing/amendment',
        'diagnosis/problem/care-plan',
        'queue and appointment check-in',
        'orders across lab/imaging/procedure/medication/service',
        'lab/imaging/procedure result release and critical acknowledgement fields',
        'prescription, refill, dispense and pharmacy stock',
        'records, attachments, consent/access, notifications, messages, support',
      ],
      added_for_workspace: [
        'doctor-workspace overview aggregation',
        'doctor-workspace global clinical search',
        'doctor-workspace task inbox',
        'doctor-workspace result inbox',
        'doctor-workspace patient clinical summary',
      ],
    },
  };
}

function buildTaskInbox({ activeEncounters = [], criticalResults = [], orders = [], prescriptions = [], refillRequests = [] }) {
  const tasks = [];

  activeEncounters.forEach((encounter) => {
    const missing = encounter.readiness?.missing || [];
    if (!missing.length) return;
    tasks.push({
      task_id: `encounter-${encounter.encounter_id}`,
      type: 'encounter_completion',
      priority: missing.some((item) => item.includes('chẩn đoán') || item.includes('Clinical')) ? 'high' : 'normal',
      title: `Hoàn tất ${encounter.encounter_code || 'encounter'}`,
      description: missing.slice(0, 3).join(' · '),
      patient: encounter.patient,
      encounter_id: encounter.encounter_id,
      due_at: encounter.started_at || encounter.start_time,
      action_path: `/doctor/encounters?view=active&encounterId=${encounter.encounter_id}`,
    });
  });

  criticalResults.forEach((result) => {
    tasks.push({
      task_id: `critical-${result.result_type}-${result.result_id}`,
      type: 'critical_result',
      priority: 'critical',
      title: `Critical result: ${result.title}`,
      description: result.summary || 'Cần acknowledge và ghi nhận hành động xử lý.',
      patient: result.patient,
      encounter_id: result.encounter_id,
      due_at: result.reported_at || result.released_to_doctor_at,
      action_path: `/doctor/clinical?view=${result.result_type}&resultId=${result.result_id}`,
    });
  });

  orders.slice(0, 8).forEach((order) => {
    tasks.push({
      task_id: `order-${toId(order)}`,
      type: 'order_pending',
      priority: order.priority === 'stat' ? 'critical' : order.priority === 'urgent' ? 'high' : 'normal',
      title: `Order đang chờ: ${order.order_no}`,
      description: `${order.order_type} · ${order.status}`,
      patient: patientCompact(order.patient_id),
      encounter_id: toId(order.encounter_id),
      due_at: order.sla_due_at || order.ordered_at,
      action_path: `/doctor/orders?orderId=${toId(order)}`,
    });
  });

  prescriptions.filter((item) => item.status === PRESCRIPTION_STATUS.DRAFT).slice(0, 8).forEach((prescription) => {
    tasks.push({
      task_id: `prescription-${toId(prescription)}`,
      type: 'prescription_draft',
      priority: 'high',
      title: `Đơn thuốc draft: ${prescription.prescription_no}`,
      description: 'Cần kiểm tra an toàn và ký đơn trước khi gửi nhà thuốc.',
      patient: patientCompact(prescription.patient_id),
      encounter_id: toId(prescription.encounter_id),
      due_at: prescription.prescribed_at,
      action_path: `/doctor/prescriptions?prescriptionId=${toId(prescription)}`,
    });
  });

  refillRequests.slice(0, 8).forEach((request) => {
    tasks.push({
      task_id: `refill-${toId(request)}`,
      type: 'refill_request',
      priority: 'normal',
      title: 'Refill request chờ duyệt',
      description: request.reason || request.note || 'Bệnh nhân yêu cầu cấp lại thuốc.',
      patient: null,
      encounter_id: null,
      due_at: request.created_at,
      action_path: `/doctor/prescriptions?view=refill&requestId=${toId(request)}`,
    });
  });

  return tasks
    .sort((left, right) => priorityWeight(right.priority) - priorityWeight(left.priority) || new Date(left.due_at || 0) - new Date(right.due_at || 0))
    .slice(0, 30);
}

function priorityWeight(priority) {
  if (priority === 'critical') return 3;
  if (priority === 'high') return 2;
  if (priority === 'normal') return 1;
  return 0;
}

async function searchWorkspace(query = {}, actor = {}) {
  const doctorId = ensureDoctorActor(actor);
  const q = String(query.q || query.search || '').trim();
  if (q.length < 2) {
    return { q, groups: [] };
  }

  const regex = new RegExp(escapeRegex(q), 'i');
  const limit = Math.min(Math.max(Number(query.limit || 6), 3), 12);

  const [patients, encounters, orders, prescriptions, labResults] = await Promise.all([
    Patient.find({
      is_deleted: false,
      $or: [
        { full_name: regex },
        { patient_code: regex },
        { phone: regex },
        { national_id: regex },
        { insurance_number: regex },
      ],
    }).limit(limit).lean(),
    Encounter.find({
      attending_doctor_id: doctorId,
      $or: [{ encounter_code: regex }, { chief_reason: regex }, { encounter_type: regex }],
    })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .sort({ start_time: -1 })
      .limit(limit)
      .lean(),
    Order.find({
      ordered_by: doctorId,
      $or: [{ order_no: regex }, { order_type: regex }, { clinical_indication: regex }],
    })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .sort({ ordered_at: -1 })
      .limit(limit)
      .lean(),
    Prescription.find({
      prescribed_by: doctorId,
      prescription_no: regex,
    })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .sort({ prescribed_at: -1 })
      .limit(limit)
      .lean(),
    LabResult.find({
      result_no: regex,
      status: { $in: RESULT_FINAL_STATUSES },
    })
      .populate('patient_id', 'patient_code full_name date_of_birth gender phone insurance_number status')
      .sort({ reported_at: -1 })
      .limit(limit)
      .lean(),
  ]);

  return {
    q,
    groups: [
      {
        id: 'patients',
        label: 'Bệnh nhân',
        items: patients.map((patient) => ({
          id: toId(patient),
          title: patient.full_name,
          meta: [patient.patient_code, patient.gender, ageFromDate(patient.date_of_birth) ? `${ageFromDate(patient.date_of_birth)} tuổi` : null].filter(Boolean).join(' · '),
          path: `/doctor/patients/${toId(patient)}`,
          patient: patientCompact(patient),
        })),
      },
      {
        id: 'encounters',
        label: 'Encounter',
        items: encounters.map((encounter) => ({
          id: toId(encounter),
          title: encounter.encounter_code,
          meta: [encounter.status, encounter.patient_id?.full_name, encounter.chief_reason].filter(Boolean).join(' · '),
          path: `/doctor/encounters?encounterId=${toId(encounter)}`,
          patient: patientCompact(encounter.patient_id),
        })),
      },
      {
        id: 'orders',
        label: 'Chỉ định',
        items: orders.map((order) => ({
          id: toId(order),
          title: order.order_no,
          meta: [order.order_type, order.status, order.patient_id?.full_name].filter(Boolean).join(' · '),
          path: `/doctor/orders?orderId=${toId(order)}`,
          patient: patientCompact(order.patient_id),
        })),
      },
      {
        id: 'results',
        label: 'Kết quả',
        items: labResults.map((result) => ({
          id: toId(result),
          title: result.result_no,
          meta: [result.is_critical ? 'Critical' : 'Result', result.status, result.patient_id?.full_name].filter(Boolean).join(' · '),
          path: `/doctor/clinical?view=lab&resultId=${toId(result)}`,
          patient: patientCompact(result.patient_id),
        })),
      },
      {
        id: 'prescriptions',
        label: 'Đơn thuốc',
        items: prescriptions.map((prescription) => ({
          id: toId(prescription),
          title: prescription.prescription_no,
          meta: [prescription.status, prescription.patient_id?.full_name].filter(Boolean).join(' · '),
          path: `/doctor/prescriptions?prescriptionId=${toId(prescription)}`,
          patient: patientCompact(prescription.patient_id),
        })),
      },
    ].filter((group) => group.items.length),
  };
}

async function getTasks(query = {}, actor = {}) {
  const overview = await getOverview(query, actor);
  return {
    items: overview.tasks,
    kpis: {
      total: overview.tasks.length,
      critical: overview.tasks.filter((item) => item.priority === 'critical').length,
      high: overview.tasks.filter((item) => item.priority === 'high').length,
      normal: overview.tasks.filter((item) => item.priority === 'normal').length,
    },
  };
}

async function getResults(query = {}, actor = {}) {
  const doctorId = ensureDoctorActor(actor);
  const dayRange = asDateRange(query);
  const limit = Math.min(Math.max(Number(query.limit || 30), 5), 100);
  const onlyCritical = query.filter === 'critical' || query.critical === 'true';
  const results = await getResultInbox({ doctorId, dayRange, limit, onlyCritical });
  return {
    items: results,
    kpis: {
      total: results.length,
      critical: results.filter((item) => item.is_critical).length,
      unread: results.filter((item) => !item.doctor_viewed_at).length,
      unacknowledged: results.filter((item) => item.is_critical && !item.critical_acknowledged_at).length,
    },
  };
}

async function getPatientSummary(patientId, query = {}, actor = {}) {
  ensureDoctorActor(actor);
  const [patient, allergies, problems, latestVitals, encounters, diagnoses, prescriptions, labResults, medicalRecords, attachments, consents] = await Promise.all([
    Patient.findById(patientId).lean(),
    Allergy.find({ patient_id: patientId, status: ALLERGY_STATUS.ACTIVE }).sort({ severity: -1, created_at: -1 }).limit(10).lean(),
    ProblemList.find({ patient_id: patientId, status: { $in: [PROBLEM_STATUS.ACTIVE] } }).sort({ updated_at: -1 }).limit(10).lean(),
    VitalSign.find({ patient_id: patientId }).sort({ recorded_at: -1, created_at: -1 }).limit(5).lean(),
    Encounter.find({ patient_id: patientId }).sort({ start_time: -1 }).limit(8).lean(),
    Diagnosis.find({ status: { $ne: DIAGNOSIS_STATUS.ENTERED_IN_ERROR } })
      .where('encounter_id')
      .in(await Encounter.find({ patient_id: patientId }).distinct('_id'))
      .sort({ created_at: -1 })
      .limit(12)
      .lean(),
    Prescription.find({ patient_id: patientId, status: { $ne: PRESCRIPTION_STATUS.CANCELLED } }).sort({ prescribed_at: -1 }).limit(8).lean(),
    LabResult.find({ patient_id: patientId, status: { $in: RESULT_FINAL_STATUSES } }).sort({ reported_at: -1 }).limit(8).lean(),
    MedicalRecord.find({ patient_id: patientId }).sort({ opened_at: -1, created_at: -1 }).limit(8).lean(),
    Attachment.find({ patient_id: patientId }).sort({ created_at: -1 }).limit(8).lean(),
    ConsentRecord.find({ patient_id: patientId }).sort({ created_at: -1 }).limit(8).lean().catch(() => []),
  ]);

  if (!patient || patient.is_deleted) {
    throw createError('Không tìm thấy bệnh nhân.', 404);
  }

  return {
    patient: patientCompact(patient),
    alerts: [
      ...allergies.slice(0, 4).map((item) => ({
        type: 'allergy',
        severity: item.severity,
        title: item.allergen_name || item.allergen || 'Dị ứng',
        description: item.reaction || item.notes || item.allergy_type,
      })),
      ...latestVitals.filter((item) => Number(item.spo2) && Number(item.spo2) < 94).map((item) => ({
        type: 'vital',
        severity: 'high',
        title: 'SpO2 thấp',
        description: `SpO2 ${item.spo2}%`,
      })),
    ],
    allergies,
    problems,
    latest_vitals: latestVitals.map(vitalCompact),
    encounters: encounters.map((item) => encounterCompact(item)),
    diagnoses,
    prescriptions: prescriptions.map(prescriptionCompact),
    lab_results: labResults.map((item) => labResultCompact(item)),
    medical_records: medicalRecords,
    attachments,
    consents,
  };
}

async function getCollaboration(query = {}, actor = {}) {
  const doctorId = ensureDoctorActor(actor);
  const [consultations, supportTickets, notifications] = await Promise.all([
    Consultation.find({ $or: [{ requested_by: doctorId }, { consultant_id: doctorId }, { assigned_to: doctorId }] })
      .sort({ updated_at: -1, created_at: -1 })
      .limit(20)
      .lean(),
    SupportTicket.find({ $or: [{ created_by: doctorId }, { assigned_to: doctorId }] })
      .sort({ updated_at: -1, created_at: -1 })
      .limit(20)
      .lean()
      .catch(() => []),
    Notification.find({ $or: [{ recipient_id: doctorId }, { recipient_user_id: doctorId }, { recipient_actor_id: doctorId }] }).sort({ created_at: -1 }).limit(20).lean().catch(() => []),
  ]);

  return {
    consultations,
    support_tickets: supportTickets,
    notifications: notifications.map(notificationCompact),
  };
}

module.exports = {
  getOverview,
  searchWorkspace,
  getTasks,
  getResults,
  getPatientSummary,
  getCollaboration,
};
