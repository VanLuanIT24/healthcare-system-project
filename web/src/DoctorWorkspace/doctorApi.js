import {
  appointmentAPI,
  clinicalAPI,
  dashboardAPI,
  encounterAPI,
  labAPI,
  notificationAPI,
  orderAPI,
  patientAPI,
  prescriptionAPI,
  procedureAPI,
  queueAPI,
  reportAPI,
  scheduleAPI,
  unwrapData,
} from '../utils/api'

const DEFAULT_LIST_LIMIT = 100

function withListLimit(params = {}, limit = DEFAULT_LIST_LIMIT) {
  return {
    limit,
    ...params,
  }
}

/**
 * @typedef {Object} DoctorCapabilities
 * @property {boolean} patientsRead
 * @property {boolean} appointmentsRead
 * @property {boolean} appointmentsWrite
 * @property {boolean} scheduleRead
 * @property {boolean} encountersRead
 * @property {boolean} encountersWrite
 * @property {boolean} consultationsWrite
 * @property {boolean} diagnosesWrite
 * @property {boolean} vitalsWrite
 * @property {boolean} prescriptionsWrite
 * @property {boolean} medicationsRead
 * @property {boolean} queueManage
 * @property {boolean} canQueueActions
 * @property {boolean} canAppointmentActions
 * @property {boolean} canEncounterActions
 * @property {boolean} canClinicalWrite
 * @property {boolean} canPrescriptionWrite
 */

/**
 * @typedef {Object} DoctorPatient
 * @property {string} patient_id
 * @property {string} patient_code
 * @property {string} full_name
 * @property {string} gender
 * @property {string} blood_type
 * @property {string} status
 * @property {string} date_of_birth
 * @property {string} phone
 * @property {string} email
 * @property {string} insurance_number
 * @property {string[]} allergies
 */

const permissionKeys = {
  patientsRead: 'patients.read',
  appointmentsRead: 'appointments.read',
  appointmentsWrite: 'appointments.write',
  scheduleRead: 'schedule.read',
  encountersRead: 'encounters.read',
  encountersWrite: 'encounters.write',
  consultationsWrite: 'consultations.write',
  diagnosesWrite: 'diagnoses.write',
  vitalsWrite: 'vitals.write',
  prescriptionsWrite: 'prescriptions.write',
  ordersRead: 'orders.read',
  ordersWrite: 'orders.write',
  medicationsRead: 'medications.read',
  queueManage: 'queue.manage',
}

export function getDoctorId(user) {
  return (
    user?.user_id ||
    user?.userId ||
    user?.id ||
    user?._id ||
    user?.profile?.user_id ||
    user?.profile?.userId ||
    user?.profile?._id ||
    ''
  )
}

export function hasPermission(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission)
}

export function getDoctorCapabilities(user) {
  const capabilities = {
    patientsRead: hasPermission(user, permissionKeys.patientsRead),
    appointmentsRead: hasPermission(user, permissionKeys.appointmentsRead),
    appointmentsWrite: hasPermission(user, permissionKeys.appointmentsWrite),
    scheduleRead: hasPermission(user, permissionKeys.scheduleRead),
    encountersRead: hasPermission(user, permissionKeys.encountersRead),
    encountersWrite: hasPermission(user, permissionKeys.encountersWrite),
    consultationsWrite: hasPermission(user, permissionKeys.consultationsWrite),
    diagnosesWrite: hasPermission(user, permissionKeys.diagnosesWrite),
    vitalsWrite: hasPermission(user, permissionKeys.vitalsWrite),
    prescriptionsWrite: hasPermission(user, permissionKeys.prescriptionsWrite),
    ordersRead: hasPermission(user, permissionKeys.ordersRead),
    ordersWrite: hasPermission(user, permissionKeys.ordersWrite),
    medicationsRead: hasPermission(user, permissionKeys.medicationsRead),
    queueManage: hasPermission(user, permissionKeys.queueManage),
  }

  return {
    ...capabilities,
    canQueueActions: capabilities.queueManage,
    canAppointmentActions: capabilities.appointmentsWrite,
    canEncounterActions: capabilities.encountersWrite,
    canClinicalWrite:
      capabilities.consultationsWrite || capabilities.diagnosesWrite || capabilities.vitalsWrite,
    canPrescriptionWrite: capabilities.prescriptionsWrite,
    canOrderActions: capabilities.ordersWrite,
  }
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (Array.isArray(value?.items)) {
    return value.items
  }

  return []
}

function asSlotArray(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.slots)) return value.slots
  if (Array.isArray(value?.available_slots)) return value.available_slots
  if (Array.isArray(value?.availableSlots)) return value.availableSlots
  if (Array.isArray(value?.booked_slots)) return value.booked_slots
  if (Array.isArray(value?.bookedSlots)) return value.bookedSlots
  if (Array.isArray(value?.items)) return value.items
  return []
}

function normalizeId(...values) {
  for (const value of values) {
    if (!value) continue
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value)
    }
    if (typeof value === 'object') {
      if (typeof value.$oid === 'string') return value.$oid
      if (typeof value.id === 'string') return value.id
      if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
        const normalized = value.toString()
        if (normalized && normalized !== '[object Object]') return normalized
      }
    }
  }

  return ''
}

function normalizeAllergies(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }

  return []
}

export function normalizePatient(payload = {}) {
  const patient = payload.patient || payload.profile || payload

  return {
    ...patient,
    patient_id: normalizeId(patient?.patient_id, patient?.id, patient?._id),
    patient_code: patient?.patient_code || patient?.patientCode || '',
    full_name: patient?.full_name || patient?.fullName || patient?.name || '',
    gender: patient?.gender || patient?.sex || '',
    blood_type: patient?.blood_type || patient?.bloodType || '',
    status: patient?.status || '',
    date_of_birth: patient?.date_of_birth || patient?.dob || '',
    phone: patient?.phone || '',
    email: patient?.email || '',
    insurance_number: patient?.insurance_number || patient?.insuranceNo || '',
    allergies: normalizeAllergies(patient?.allergies),
  }
}

export function normalizeAppointment(item = {}) {
  const appointment = item.appointment || item

  return {
    ...appointment,
    appointment_id: appointment?.appointment_id || appointment?.id || '',
    patient_id: appointment?.patient_id || appointment?.patient?.patient_id || '',
    doctor_id: appointment?.doctor_id || appointment?.doctor?.user_id || '',
    appointment_time:
      appointment?.appointment_time || appointment?.scheduled_at || appointment?.date_time || '',
    appointment_type: appointment?.appointment_type || appointment?.visit_type || appointment?.type || '',
    status: appointment?.status || '',
    note: appointment?.note || appointment?.notes || appointment?.reason || '',
    encounter_id:
      appointment?.encounter_id ||
      appointment?.related_encounter_id ||
      item?.encounter_id ||
      item?.encounter?.encounter_id ||
      item?.encounter?.id ||
      '',
  }
}

export function normalizeEncounter(item = {}) {
  const encounter = item.encounter || item
  const rawStatus = encounter?.status || ''
  const normalizedStatus = ['arrived', 'planned'].includes(rawStatus) ? 'waiting' : rawStatus

  return {
    ...encounter,
    encounter_id: encounter?.encounter_id || encounter?.id || '',
    encounter_code: encounter?.encounter_code || encounter?.encounter_no || '',
    patient_id: encounter?.patient_id || encounter?.patient?.patient_id || '',
    doctor_id:
      encounter?.doctor_id ||
      encounter?.attending_doctor_id ||
      encounter?.doctor?.user_id ||
      '',
    start_time: encounter?.start_time || encounter?.started_at || encounter?.encounter_time || '',
    raw_status: rawStatus,
    status: normalizedStatus,
    encounter_type: encounter?.encounter_type || encounter?.type || '',
  }
}

export function normalizeQueueTicket(item = {}) {
  const ticket = item.ticket || item.queue_ticket || item

  return {
    ...ticket,
    queue_ticket_id: normalizeId(ticket?.queue_ticket_id, ticket?.id, ticket?._id),
    queue_number: ticket?.queue_number || ticket?.ticket_no || '',
    patient_id: normalizeId(ticket?.patient_id, ticket?.patient?.patient_id, ticket?.patient?.id, ticket?.patient?._id),
    appointment_id: normalizeId(ticket?.appointment_id, ticket?.appointment?.appointment_id, ticket?.appointment?.id, ticket?.appointment?._id),
    encounter_id: normalizeId(ticket?.encounter_id, ticket?.encounter?.encounter_id, ticket?.encounter?.id, ticket?.encounter?._id),
    doctor_id: normalizeId(ticket?.doctor_id, ticket?.doctor?.user_id, ticket?.doctor?.id, ticket?.doctor?._id),
    department_id: normalizeId(ticket?.department_id, ticket?.department?.department_id, ticket?.department?.id, ticket?.department?._id),
    checkin_time: ticket?.checkin_time || ticket?.checked_in_at || ticket?.created_at || '',
    queue_type: ticket?.queue_type || ticket?.visit_type || '',
    status: ticket?.status || '',
    called_time: ticket?.called_time || '',
    completed_time: ticket?.completed_time || '',
    patient_name: ticket?.patient_name || ticket?.patient?.full_name || ticket?.patient?.name || '',
    priority_flag: Boolean(ticket?.priority_flag || ticket?.is_priority),
    priority_reason: ticket?.priority_reason || '',
  }
}

export function normalizeConsultation(item = {}) {
  const consultation = item.consultation || item

  return {
    ...consultation,
    consultation_id: consultation?.consultation_id || consultation?.id || consultation?._id || '',
    status: consultation?.status || '',
    chief_complaint: consultation?.chief_complaint || '',
    history_present_illness: consultation?.history_present_illness || '',
    physical_exam: consultation?.physical_exam || '',
    assessment: consultation?.assessment || '',
    plan: consultation?.plan || '',
  }
}

export function normalizeDiagnosis(item = {}) {
  const diagnosis = item.diagnosis || item

  return {
    ...diagnosis,
    diagnosis_id: diagnosis?.diagnosis_id || diagnosis?.id || diagnosis?._id || '',
    icd10_code: diagnosis?.icd10_code || '',
    diagnosis_name: diagnosis?.diagnosis_name || diagnosis?.name || '',
    diagnosis_type: diagnosis?.diagnosis_type || '',
    is_primary: Boolean(diagnosis?.is_primary),
    onset_date: diagnosis?.onset_date || '',
    notes: diagnosis?.notes || '',
    status: diagnosis?.status || diagnosis?.diagnosis_type || '',
  }
}

export function normalizeVitalSign(item = {}) {
  const vital = item.vital_sign || item

  return {
    ...vital,
    vital_sign_id: vital?.vital_sign_id || vital?.id || vital?._id || '',
    temperature: vital?.temperature ?? '',
    heart_rate: vital?.heart_rate ?? '',
    respiratory_rate: vital?.respiratory_rate ?? '',
    systolic_bp: vital?.systolic_bp ?? '',
    diastolic_bp: vital?.diastolic_bp ?? '',
    spo2: vital?.spo2 ?? '',
    weight: vital?.weight ?? '',
    height: vital?.height ?? '',
    bmi: vital?.bmi ?? '',
    recorded_at: vital?.recorded_at || vital?.created_at || '',
  }
}

export function normalizePrescription(item = {}) {
  const prescription = item.prescription || item

  return {
    ...prescription,
    prescription_id: normalizeId(prescription?.prescription_id, prescription?.id, prescription?._id),
    encounter_id: normalizeId(prescription?.encounter_id, prescription?.encounter?.encounter_id, prescription?.encounter?.id),
    prescribed_by: normalizeId(prescription?.prescribed_by, prescription?.doctor_id, prescription?.doctor?.id),
    encounter_code: prescription?.encounter_code || prescription?.encounter?.encounter_code || '',
    patient_id: normalizeId(prescription?.patient_id, prescription?.patient?.patient_id, prescription?.patient?.id),
    patient_name: prescription?.patient_name || prescription?.patient?.full_name || '',
    prescription_no: prescription?.prescription_no || prescription?.code || '',
    status: prescription?.status || '',
    items: asArray(prescription?.items),
    note: prescription?.note || '',
    prescribed_at: prescription?.prescribed_at || '',
    created_at: prescription?.created_at || '',
    updated_at: prescription?.updated_at || '',
  }
}

export function normalizePrescriptionItem(item = {}) {
  const prescriptionItem = item.prescription_item || item.item || item

  return {
    ...prescriptionItem,
    prescription_item_id: normalizeId(prescriptionItem?.prescription_item_id, prescriptionItem?.id, prescriptionItem?._id),
    prescription_id: normalizeId(prescriptionItem?.prescription_id, prescriptionItem?.prescription?.prescription_id, prescriptionItem?.prescription?.id),
    medication_id: normalizeId(prescriptionItem?.medication_id, prescriptionItem?.medication?.medication_id, prescriptionItem?.medication?.id),
    medication_name:
      prescriptionItem?.medication_name ||
      prescriptionItem?.generic_name ||
      prescriptionItem?.drug_name ||
      prescriptionItem?.medication?.generic_name ||
      prescriptionItem?.medication?.brand_name ||
      '',
    dose: prescriptionItem?.dose || '',
    frequency: prescriptionItem?.frequency || '',
    route: prescriptionItem?.route || '',
    duration_days: prescriptionItem?.duration_days ?? '',
    quantity: prescriptionItem?.quantity ?? '',
    instructions: prescriptionItem?.instructions || '',
    status: prescriptionItem?.status || '',
  }
}

export function normalizeLabOrder(item = {}) {
  const order = item.lab_order || item.order || item
  const patient = order?.patient || order?.patient_id || {}
  const encounter = order?.encounter || order?.encounter_id || {}
  const doctor = order?.doctor || order?.ordered_by || {}

  return {
    ...order,
    lab_order_id: normalizeId(order?.lab_order_id, order?.order_id, order?.id, order?._id),
    order_id: normalizeId(order?.order_id, order?.lab_order_id, order?.id, order?._id),
    encounter_id: normalizeId(order?.encounter_id, encounter?.encounter_id, encounter?.id, encounter?._id),
    encounter_code: order?.encounter_code || encounter?.encounter_code || '',
    patient_id: normalizeId(order?.patient_id, patient?.patient_id, patient?.id, patient?._id),
    patient_code: order?.patient_code || patient?.patient_code || '',
    patient_name: order?.patient_name || patient?.full_name || patient?.name || '',
    patient_gender: order?.patient_gender || patient?.gender || '',
    patient_birth_year: order?.patient_birth_year || patient?.birth_year || '',
    test_name: order?.test_name || order?.service_name || order?.service?.service_name || order?.name || '',
    test_type: order?.test_type || order?.category || order?.service?.category || '',
    lab_room: order?.lab_room || order?.lab_room_name || order?.department_name || order?.room_name || '',
    ordering_doctor_name: order?.ordering_doctor_name || order?.doctor_name || doctor?.full_name || '',
    status: order?.status || '',
    ordered_at: order?.ordered_at || order?.created_at || order?.requested_at || '',
    created_at: order?.created_at || order?.ordered_at || '',
    updated_at: order?.updated_at || '',
  }
}

export function normalizeLabResult(item = {}) {
  const result = item.lab_result || item.result || item
  const order = result?.order || result?.lab_order_id || {}
  const patient = result?.patient || result?.patient_id || {}
  const encounter = result?.encounter || result?.encounter_id || order?.encounter_id || {}

  return {
    ...result,
    result_id: normalizeId(result?.result_id, result?.lab_result_id, result?.id, result?._id),
    lab_order_id: normalizeId(result?.lab_order_id, result?.order_id, order?.lab_order_id, order?.id, order?._id),
    encounter_id: normalizeId(result?.encounter_id, encounter?.encounter_id, encounter?.id, encounter?._id),
    encounter_code: result?.encounter_code || encounter?.encounter_code || '',
    patient_id: normalizeId(result?.patient_id, patient?.patient_id, patient?.id, patient?._id),
    patient_code: result?.patient_code || patient?.patient_code || '',
    patient_name: result?.patient_name || patient?.full_name || patient?.name || '',
    patient_gender: result?.patient_gender || patient?.gender || '',
    patient_birth_year: result?.patient_birth_year || patient?.birth_year || '',
    test_name: result?.test_name || order?.test_name || result?.service_name || result?.analyte_name || result?.name || '',
    test_type: result?.test_type || result?.category || '',
    result_value: result?.result_value ?? result?.value ?? result?.display_value ?? '',
    unit: result?.unit || result?.result_unit || '',
    reference_range: result?.reference_range || result?.normal_range || '',
    lab_room: result?.lab_room || result?.lab_room_name || result?.department_name || result?.room_name || '',
    status: result?.status || '',
    is_abnormal: Boolean(result?.is_abnormal || result?.abnormal || result?.flag === 'abnormal'),
    is_critical: Boolean(result?.is_critical || result?.critical || result?.flag === 'critical'),
    acknowledged_at: result?.acknowledged_at || result?.critical_acknowledged_at || '',
    resulted_at: result?.resulted_at || result?.completed_at || result?.created_at || '',
    created_at: result?.created_at || result?.resulted_at || '',
    updated_at: result?.updated_at || '',
  }
}

export function normalizeLabResultItem(item = {}) {
  return {
    ...item,
    result_item_id: normalizeId(item?.result_item_id, item?.lab_result_item_id, item?.id, item?._id),
    item_name: item?.item_name || item?.name || item?.item_code || '',
    item_code: item?.item_code || '',
    result_value: item?.result_value ?? item?.numeric_value ?? item?.value ?? '',
    unit: item?.unit || '',
    reference_range: item?.reference_range || item?.normal_range || '',
    abnormal_flag: item?.abnormal_flag || '',
    is_critical: Boolean(item?.is_critical),
    status: item?.status || '',
  }
}

export function normalizeLabResultDetail(payload = {}) {
  const result = normalizeLabResult(payload?.result || payload?.lab_result || payload)
  const items = asArray(payload?.items || payload?.result_items).map(normalizeLabResultItem)
  return { ...result, result, items }
}

export function normalizeLabOrderDetail(payload = {}) {
  const order = normalizeLabOrder(payload?.lab_order || payload?.order || payload)
  return {
    ...order,
    order,
    specimens: asArray(payload?.specimens),
    results: asArray(payload?.results).map(normalizeLabResult),
    charge: payload?.charge || null,
    activity: asArray(payload?.activity),
    allowed_actions: payload?.allowed_actions || null,
  }
}

export function normalizeProcedureOrder(item = {}) {
  const order = item.procedure_order || item.order || item

  return {
    ...order,
    procedure_order_id: normalizeId(order?.procedure_order_id, order?.order_id, order?.id, order?._id),
    order_id: normalizeId(order?.order_id, order?.procedure_order_id, order?.id, order?._id),
    encounter_id: normalizeId(order?.encounter_id, order?.encounter?.encounter_id, order?.encounter?.id),
    encounter_code: order?.encounter_code || order?.encounter?.encounter_code || '',
    patient_id: normalizeId(order?.patient_id, order?.patient?.patient_id, order?.patient?.id),
    patient_code: order?.patient_code || order?.patient?.patient_code || '',
    patient_name: order?.patient_name || order?.patient?.full_name || order?.patient?.name || '',
    patient_gender: order?.patient_gender || order?.patient?.gender || '',
    patient_age: order?.patient_age ?? order?.patient?.age ?? '',
    procedure_name:
      order?.procedure_name ||
      order?.service_name ||
      order?.service?.service_name ||
      order?.name ||
      order?.title ||
      '',
    procedure_room: order?.procedure_room || order?.procedure_room_name || order?.room_name || order?.department_name || '',
    procedure_staff_name: order?.procedure_staff_name || order?.technician_name || order?.doctor_name || order?.doctor?.full_name || '',
    priority: order?.priority || order?.urgency || '',
    status: order?.status || '',
    scheduled_at: order?.scheduled_at || order?.start_time || order?.created_at || order?.ordered_at || '',
    started_at: order?.started_at || '',
    completed_at: order?.completed_at || order?.end_time || '',
    created_at: order?.created_at || order?.ordered_at || '',
    updated_at: order?.updated_at || '',
  }
}

export function normalizeOrder(item = {}) {
  const order = item.order || item

  return {
    ...order,
    order_id: normalizeId(order?.order_id, order?.id, order?._id),
    order_code: order?.order_code || order?.code || '',
    title: order?.title || '',
    encounter_id: normalizeId(order?.encounter_id, order?.encounter?.encounter_id, order?.encounter?.id),
    encounter_code: order?.encounter_code || order?.encounter?.encounter_code || '',
    patient_id: normalizeId(order?.patient_id, order?.patient?.patient_id, order?.patient?.id),
    patient_name: order?.patient_name || order?.patient?.full_name || '',
    patient_code: order?.patient_code || order?.patient?.patient_code || '',
    patient_phone: order?.patient_phone || order?.patient?.phone || '',
    patient_gender: order?.patient_gender || order?.patient?.gender || '',
    patient_age: order?.patient_age ?? '',
    doctor_id: normalizeId(order?.doctor_id, order?.requested_by, order?.doctor?.id),
    doctor_name: order?.doctor_name || order?.doctor?.full_name || '',
    doctor_code: order?.doctor_code || order?.doctor?.employee_code || '',
    department_id: normalizeId(order?.department_id, order?.department?.department_id, order?.department?.id),
    department_name: order?.department_name || order?.department?.department_name || '',
    receiving_department_id: normalizeId(order?.receiving_department_id, order?.receiving_department?.department_id, order?.receiving_department?.id),
    receiving_department_name:
      order?.receiving_department_name || order?.receiving_department?.department_name || '',
    order_type: order?.order_type || 'lab',
    priority: order?.priority || 'routine',
    status: order?.status || 'draft',
    clinical_diagnosis: order?.clinical_diagnosis || '',
    clinical_symptoms: order?.clinical_symptoms || '',
    doctor_note: order?.doctor_note || '',
    cancel_reason: order?.cancel_reason || '',
    cancel_note: order?.cancel_note || '',
    items_count: Number(order?.items_count || 0),
    created_at: order?.created_at || '',
    updated_at: order?.updated_at || '',
    cancelled_at: order?.cancelled_at || '',
  }
}

export function normalizeOrderItem(item = {}) {
  const orderItem = item.order_item || item.item || item

  return {
    ...orderItem,
    order_item_id: normalizeId(orderItem?.order_item_id, orderItem?.id, orderItem?._id),
    order_id: normalizeId(orderItem?.order_id, orderItem?.order?.order_id, orderItem?.order?.id),
    service_code: orderItem?.service_code || '',
    service_name: orderItem?.service_name || orderItem?.name || '',
    specimen_type: orderItem?.specimen_type || '',
    unit_price: Number(orderItem?.unit_price || 0),
    quantity: Number(orderItem?.quantity || 1),
    status: orderItem?.status || 'pending',
    note: orderItem?.note || '',
    created_at: orderItem?.created_at || '',
    updated_at: orderItem?.updated_at || '',
  }
}

export function normalizeMedication(item = {}) {
  const medication = item.medication || item

  return {
    ...medication,
    medication_id: normalizeId(medication?.medication_id, medication?.id, medication?._id),
    medication_code: medication?.medication_code || medication?.code || '',
    generic_name: medication?.generic_name || medication?.name || '',
    brand_name: medication?.brand_name || '',
    dosage_form: medication?.dosage_form || medication?.form || '',
    strength: medication?.strength || '',
    route_default: medication?.route_default || medication?.route || '',
    unit: medication?.unit || '',
    status: medication?.status || '',
  }
}

export function normalizeClinicalNote(item = {}) {
  const note = item.note || item.clinical_note || item

  return {
    ...note,
    note_id: note?.note_id || note?.id || note?._id || '',
    note_text: note?.note_text || note?.content || '',
    content: note?.content || note?.note_text || '',
    title: note?.title || '',
    status: note?.status || '',
    created_at: note?.created_at || '',
  }
}

function normalizeClinicalSummary(payload = {}) {
  return {
    ...payload,
    consultation: payload?.consultation ? normalizeConsultation(payload.consultation) : null,
    primary_diagnosis: payload?.primary_diagnosis ? normalizeDiagnosis(payload.primary_diagnosis) : null,
    latest_vital_signs: payload?.latest_vital_signs ? normalizeVitalSign(payload.latest_vital_signs) : null,
    latest_notes: asArray(payload?.latest_notes).map(normalizeClinicalNote),
  }
}

function normalizeEncounterReadiness(parts = {}) {
  return {
    can_start: Boolean(parts.canStart?.can_start),
    can_complete: Boolean(parts.canComplete?.can_complete),
    editable: parts.editable?.editable !== false,
    has_signed_consultation: Boolean(parts.signedConsultation?.has_signed_consultation),
    has_active_prescription: Boolean(parts.activePrescription?.has_active_prescription),
    status: parts.canStart?.status || parts.canComplete?.status || parts.editable?.status || '',
    signed_consultations_count: Number(parts.canComplete?.signed_consultations_count || parts.signedConsultation?.signed_consultations_count || 0),
    active_diagnoses_count: Number(parts.canComplete?.active_diagnoses_count || 0),
    active_prescriptions_count: Number(parts.canComplete?.active_prescriptions_count || parts.activePrescription?.active_prescriptions_count || 0),
  }
}

export function normalizeSchedule(item = {}) {
  const schedule = item.schedule || item

  return {
    ...schedule,
    doctor_schedule_id: schedule?.doctor_schedule_id || schedule?.schedule_id || schedule?.id || '',
    shift_start: schedule?.shift_start || schedule?.start_time || '',
    shift_end: schedule?.shift_end || schedule?.end_time || '',
    status: schedule?.status || '',
    department_name: schedule?.department_name || schedule?.unit_name || '',
    shift_type: schedule?.shift_type || schedule?.schedule_type || '',
  }
}

export function normalizeSlot(item = {}) {
  return {
    ...item,
    slot_time: item?.slot_time || item?.appointment_time || item?.time || '',
    is_available: Boolean(item?.is_available),
    is_booked: Boolean(item?.is_booked),
    is_blocked: Boolean(item?.is_blocked),
    patient_name: item?.patient_name || item?.patient?.full_name || '',
  }
}

function normalizePagedItems(payload = {}, itemNormalizer = (item) => item) {
  return {
    items: asArray(payload?.items || payload).map(itemNormalizer),
    pagination: payload?.pagination || null,
  }
}

function normalizeBoard(payload = {}) {
  return {
    waiting: asArray(payload?.waiting).map(normalizeQueueTicket),
    called: asArray(payload?.called).map(normalizeQueueTicket),
    in_service: asArray(payload?.in_service).map(normalizeQueueTicket),
    serving: asArray(payload?.serving).map(normalizeQueueTicket),
    completed: asArray(payload?.completed).map(normalizeQueueTicket),
    skipped: asArray(payload?.skipped).map(normalizeQueueTicket),
    cancelled: asArray(payload?.cancelled || payload?.canceled).map(normalizeQueueTicket),
  }
}

function normalizeOrderActionResult(response = {}) {
  return {
    order: response?.order ? normalizeOrder(response.order) : response ? normalizeOrder(response) : null,
    items: asArray(response?.items).map(normalizeOrderItem),
    summary: response?.summary || null,
    progress: response?.progress || null,
  }
}

function groupQueueItems(items = []) {
  const tickets = asArray(items).map(normalizeQueueTicket)

  return {
    waiting: tickets.filter((item) => item.status === 'waiting'),
    called: tickets.filter((item) => ['called', 'recalled'].includes(item.status)),
    in_service: tickets.filter((item) => ['in_service', 'serving', 'examining', 'in_progress'].includes(item.status)),
    completed: tickets.filter((item) => ['completed', 'done', 'finished'].includes(item.status)),
    skipped: tickets.filter((item) => ['skipped', 'skip'].includes(item.status)),
    cancelled: tickets.filter((item) => ['cancelled', 'canceled'].includes(item.status)),
  }
}

async function requestAndNormalize(request, normalizer, fallback) {
  const payload = unwrapData(await request)
  if (!payload && fallback !== undefined) {
    return fallback
  }

  return normalizer ? normalizer(payload) : payload
}

export const doctorApi = {
  dashboard: {
    getMe: async (params = {}) =>
      requestAndNormalize(dashboardAPI.doctorMe(params), (payload) => ({
        doctor: payload?.doctor || null,
        today_shift: payload?.today_shift ? normalizeSchedule(payload.today_shift) : null,
        kpis: payload?.kpis || null,
        appointments_today: asArray(payload?.appointments_today).map(normalizeAppointment),
        waiting_queue: asArray(payload?.waiting_queue).map(normalizeQueueTicket),
        active_encounters: asArray(payload?.active_encounters).map(normalizeEncounter),
        pending_orders: asArray(payload?.pending_orders).map(normalizeOrder),
        weekly_overview: payload?.weekly_overview || null,
      })),
    getAppointmentsToday: async (doctorId, params = {}) =>
      requestAndNormalize(
        doctorId
          ? appointmentAPI.listByDoctor(doctorId, withListLimit({ date: new Date().toISOString(), ...params }))
          : appointmentAPI.listToday(withListLimit(params)),
        (payload) =>
        asArray(payload).map(normalizeAppointment),
      ),
    getEncountersToday: async (doctorId, params = {}) =>
      requestAndNormalize(
        doctorId
          ? encounterAPI.listByDoctor(doctorId, withListLimit({ date_from: new Date().toISOString(), date_to: new Date().toISOString(), ...params }))
          : encounterAPI.listToday(withListLimit(params)),
        (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    getQueueBoard: async (doctorId, params = {}) =>
      doctorId
        ? requestAndNormalize(queueAPI.boardByDoctor(doctorId, params), normalizeBoard, {
            waiting: [],
            called: [],
            in_service: [],
            completed: [],
          })
        : requestAndNormalize(queueAPI.list(withListLimit(params, 200)), (payload) => groupQueueItems(payload), {
            waiting: [],
            called: [],
            in_service: [],
            completed: [],
          }),
  },
  schedules: {
    listAll: async (params = {}) =>
      requestAndNormalize(scheduleAPI.list(withListLimit(params, 200)), (payload) =>
        asArray(payload).map(normalizeSchedule),
      ),
    getCalendar: async (doctorId, params = {}) =>
      requestAndNormalize(scheduleAPI.calendarByDoctor(doctorId, withListLimit(params, 200)), (payload) =>
        asArray(payload).map(normalizeSchedule),
      ),
    getByDoctor: async (doctorId, params = {}) =>
      requestAndNormalize(scheduleAPI.listByDoctor(doctorId, withListLimit(params, 200)), (payload) =>
        asArray(payload).map(normalizeSchedule),
      ),
    myToday: async (params = {}) =>
      requestAndNormalize(scheduleAPI.getMyTodaySchedule(params), (payload) =>
        asArray(payload?.schedules || payload).map(normalizeSchedule),
      ),
    myWeek: async (params = {}) =>
      requestAndNormalize(scheduleAPI.getMyWeekSchedule(params), (payload) =>
        asArray(payload?.schedules || payload).map(normalizeSchedule),
      ),
    dateRange: async (params = {}) =>
      requestAndNormalize(scheduleAPI.dateRange(withListLimit(params, 200)), (payload) =>
        asArray(payload?.schedules || payload).map(normalizeSchedule),
      ),
    getDetail: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.detail(scheduleId), normalizeSchedule),
    getSummary: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.summary(scheduleId), (payload) => payload || null),
    getActivity: async (scheduleId, params = {}) =>
      requestAndNormalize(scheduleAPI.activity(scheduleId, params), (payload) => asArray(payload?.items || payload)),
    getUtilization: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.utilization(scheduleId), (payload) => payload || null),
    getCanUpdate: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.canUpdate(scheduleId), (payload) => payload || null),
    getCanCancel: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.canCancel(scheduleId), (payload) => payload || null),
    getFutureAppointments: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.futureAppointments(scheduleId), (payload) => payload || null),
    getSlots: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.slots(scheduleId), (payload) =>
        asSlotArray(payload).map(normalizeSlot),
      ),
    getAvailableSlots: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.availableSlots(scheduleId), (payload) =>
        asSlotArray(payload).map(normalizeSlot),
      ),
    getBookedSlots: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.getBookedSlots(scheduleId), (payload) =>
        asSlotArray(payload).map(normalizeSlot),
      ),
    getBookedSlotsAlias: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.getBookedSlotsAlias(scheduleId), (payload) =>
        asSlotArray(payload).map(normalizeSlot),
      ),
  },
  queue: {
    listAll: async (params = {}) =>
      requestAndNormalize(queueAPI.list(withListLimit(params, 200)), (payload) => groupQueueItems(payload)),
    getBoard: async (doctorId, params = {}) =>
      requestAndNormalize(queueAPI.boardByDoctor(doctorId, params), normalizeBoard),
    getDetail: async (ticketId) => requestAndNormalize(queueAPI.detail(ticketId), normalizeQueueTicket),
    getTimeline: async (ticketId) =>
      requestAndNormalize(queueAPI.timeline(ticketId), (payload) => asArray(payload?.items || payload)),
    getTodaySummary: async (params = {}) => requestAndNormalize(queueAPI.summaryToday(params), (payload) => payload || null),
    callNext: async (doctorId) => requestAndNormalize(queueAPI.callNext({ doctor_id: doctorId })),
    call: async (ticketId) => requestAndNormalize(queueAPI.call(ticketId)),
    recall: async (ticketId) => requestAndNormalize(queueAPI.recall(ticketId)),
    skip: async (ticketId) => requestAndNormalize(queueAPI.skip(ticketId)),
    startService: async (ticketId) => requestAndNormalize(queueAPI.startService(ticketId)),
    complete: async (ticketId) => requestAndNormalize(queueAPI.complete(ticketId)),
    cancel: async (ticketId) => requestAndNormalize(queueAPI.cancel(ticketId)),
    transfer: async (ticketId, body = {}) => requestAndNormalize(queueAPI.transfer(ticketId, body)),
  },
  reports: {
    doctors: async (params = {}) =>
      requestAndNormalize(reportAPI.doctors(params), (payload) => payload || null),
    appointments: async (params = {}) =>
      requestAndNormalize(reportAPI.appointments(params), (payload) => payload || null),
    encounters: async (params = {}) =>
      requestAndNormalize(reportAPI.encounters(params), (payload) => payload || null),
    queue: async (params = {}) =>
      requestAndNormalize(reportAPI.queue(params), (payload) => payload || null),
  },
  appointments: {
    listAll: async (params = {}) =>
      requestAndNormalize(appointmentAPI.list(withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeAppointment),
      ),
    searchPage: async (params = {}) =>
      requestAndNormalize(appointmentAPI.search(withListLimit(params, 8)), (payload) =>
        normalizePagedItems(payload, normalizeAppointment),
      ),
    listByDoctor: async (doctorId, params = {}) =>
      requestAndNormalize(appointmentAPI.listByDoctor(doctorId, withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeAppointment),
      ),
    listToday: async (params = {}) =>
      requestAndNormalize(appointmentAPI.listToday(withListLimit(params, 200)), (payload) =>
        asArray(payload?.appointments || payload).map(normalizeAppointment),
      ),
    listUpcoming: async (params = {}) =>
      requestAndNormalize(appointmentAPI.listUpcoming(withListLimit(params, 200)), (payload) =>
        asArray(payload?.appointments || payload).map(normalizeAppointment),
      ),
    listByDate: async (params = {}) =>
      requestAndNormalize(appointmentAPI.listByDate(withListLimit(params, 200)), (payload) =>
        asArray(payload?.appointments || payload).map(normalizeAppointment),
      ),
    getDetail: async (appointmentId) =>
      requestAndNormalize(appointmentAPI.detail(appointmentId), normalizeAppointment),
    getSummary: async (params = {}) =>
      requestAndNormalize(appointmentAPI.summary(params), (payload) => payload || null),
    getTimeline: async (appointmentId) =>
      requestAndNormalize(appointmentAPI.timeline(appointmentId), (payload) => asArray(payload?.items || payload)),
    getReadChecks: async (appointmentId) => {
      const [canUpdate, canCancel, canReschedule, canCheckIn] = await Promise.all([
        requestAndNormalize(appointmentAPI.canUpdate(appointmentId)),
        requestAndNormalize(appointmentAPI.canCancel(appointmentId)),
        requestAndNormalize(appointmentAPI.canReschedule(appointmentId)),
        requestAndNormalize(appointmentAPI.canCheckIn(appointmentId)),
      ])
      return {
        canUpdate,
        canCancel,
        canReschedule,
        canCheckIn: canCheckIn
          ? {
              ...canCheckIn,
              can_check_in: Boolean(canCheckIn.can_check_in ?? canCheckIn.can_checkin),
            }
          : canCheckIn,
      }
    },
    canCheckIn: async (appointmentId) =>
      requestAndNormalize(appointmentAPI.canCheckIn(appointmentId), (payload) =>
        payload
          ? {
              ...payload,
              can_check_in: Boolean(payload.can_check_in ?? payload.can_checkin),
            }
          : payload,
      ),
    confirm: async (appointmentId) => requestAndNormalize(appointmentAPI.confirmAppointment(appointmentId)),
    checkIn: async (appointmentId) => requestAndNormalize(appointmentAPI.checkIn(appointmentId)),
    noShow: async (appointmentId) => requestAndNormalize(appointmentAPI.markAppointmentNoShow(appointmentId)),
    complete: async (appointmentId) => requestAndNormalize(appointmentAPI.completeAppointment(appointmentId)),
    createQueueTicket: async (appointmentId) => requestAndNormalize(appointmentAPI.createQueueTicket(appointmentId)),
    createEncounter: async (appointmentId) => requestAndNormalize(appointmentAPI.createEncounter(appointmentId)),
    linkEncounter: async (appointmentId, body = {}) => requestAndNormalize(appointmentAPI.linkEncounter(appointmentId, body)),
  },
  encounters: {
    listAll: async (params = {}) =>
      requestAndNormalize(encounterAPI.list(withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    listToday: async (params = {}) =>
      requestAndNormalize(encounterAPI.listToday(withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    searchPage: async (params = {}) =>
      requestAndNormalize(encounterAPI.search(withListLimit(params, 8)), (payload) =>
        normalizePagedItems(payload, normalizeEncounter),
      ),
    listByDoctor: async (doctorId, params = {}) =>
      requestAndNormalize(encounterAPI.listByDoctor(doctorId, withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    listActiveByDoctor: async (doctorId, params = {}) =>
      requestAndNormalize(encounterAPI.listActiveByDoctor(doctorId, withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    list: async (doctorId, params = {}) =>
      requestAndNormalize(encounterAPI.list(withListLimit({ doctor_id: doctorId, ...params })), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    getDetail: async (encounterId) =>
      requestAndNormalize(encounterAPI.detail(encounterId), normalizeEncounter),
    getSummary: async (encounterId) =>
      requestAndNormalize(encounterAPI.summary(encounterId), (payload) => payload || null),
    getTimeline: async (encounterId) =>
      requestAndNormalize(encounterAPI.timeline(encounterId), (payload) => asArray(payload?.items || payload)),
    getClinicalSummary: async (encounterId) =>
      requestAndNormalize(clinicalAPI.encounterSummary(encounterId), normalizeClinicalSummary, null),
    getReadiness: async (encounterId) => {
      const [canStart, canComplete, editable, signedConsultation, activePrescription] = await Promise.all([
        requestAndNormalize(encounterAPI.canStart(encounterId)),
        requestAndNormalize(encounterAPI.canComplete(encounterId)),
        requestAndNormalize(encounterAPI.editable(encounterId)),
        requestAndNormalize(encounterAPI.hasSignedConsultation(encounterId)),
        requestAndNormalize(encounterAPI.hasActivePrescription(encounterId)),
      ])
      return normalizeEncounterReadiness({
        canStart,
        canComplete,
        editable,
        signedConsultation,
        activePrescription,
      })
    },
    createFromAppointment: async (appointmentId) =>
      requestAndNormalize(encounterAPI.createFromAppointment(appointmentId)),
    arrive: async (encounterId) => requestAndNormalize(encounterAPI.arrive(encounterId), normalizeEncounter),
    start: async (encounterId) => requestAndNormalize(encounterAPI.start(encounterId)),
    hold: async (encounterId) => requestAndNormalize(encounterAPI.hold(encounterId)),
    resume: async (encounterId) => requestAndNormalize(encounterAPI.resume(encounterId)),
    complete: async (encounterId) => requestAndNormalize(encounterAPI.complete(encounterId)),
    cancel: async (encounterId) => requestAndNormalize(encounterAPI.cancel(encounterId), normalizeEncounter),
    reopen: async (encounterId) => requestAndNormalize(encounterAPI.reopen(encounterId), normalizeEncounter),
  },
  orders: {
    listAll: async (params = {}) =>
      requestAndNormalize(orderAPI.list(withListLimit(params)), (payload) => normalizePagedItems(payload, normalizeOrder)),
    search: async (params = {}) =>
      requestAndNormalize(orderAPI.search(withListLimit(params)), (payload) => normalizePagedItems(payload, normalizeOrder)),
    getSummary: async (params = {}) =>
      requestAndNormalize(orderAPI.summary(params), (payload) => payload || null),
    listByDoctorPage: async (doctorId, params = {}) =>
      requestAndNormalize(orderAPI.listByDoctor(doctorId, withListLimit(params)), (payload) => normalizePagedItems(payload, normalizeOrder)),
    listByEncounter: async (encounterId, params = {}) =>
      requestAndNormalize(encounterAPI.listOrders(encounterId, withListLimit(params, 50)), (payload) =>
        asArray(payload?.items || payload).map(normalizeOrder),
      ),
    getEncounterSummary: async (encounterId, params = {}) =>
      requestAndNormalize(encounterAPI.ordersSummary(encounterId, params), (payload) => payload || null),
    getDetail: async (orderId) =>
      requestAndNormalize(orderAPI.detail(orderId), (payload) => ({
        order: payload?.order ? normalizeOrder(payload.order) : null,
        items: asArray(payload?.items).map(normalizeOrderItem),
        summary: payload?.summary || null,
        progress: payload?.progress || null,
      })),
    getTimeline: async (orderId) =>
      requestAndNormalize(orderAPI.timeline(orderId), (payload) => asArray(payload?.items || payload)),
    createForEncounter: async (encounterId, payload) =>
      requestAndNormalize(orderAPI.createForEncounter(encounterId, payload), normalizeOrderActionResult),
    dispatch: async (orderId, payload = {}) =>
      requestAndNormalize(orderAPI.dispatch(orderId, payload), normalizeOrderActionResult),
    acknowledge: async (orderId, payload = {}) =>
      requestAndNormalize(orderAPI.acknowledge(orderId, payload), normalizeOrderActionResult),
    start: async (orderId, payload = {}) =>
      requestAndNormalize(orderAPI.start(orderId, payload), normalizeOrderActionResult),
    complete: async (orderId, payload = {}) =>
      requestAndNormalize(orderAPI.complete(orderId, payload), normalizeOrderActionResult),
    cancel: async (orderId, payload = {}) =>
      requestAndNormalize(orderAPI.cancel(orderId, payload), normalizeOrderActionResult),
  },
  lab: {
    listOrders: async (params = {}) =>
      requestAndNormalize(labAPI.listOrders(withListLimit(params, 500)), (payload) => ({
        items: asArray(payload).map(normalizeLabOrder),
        pagination: payload?.pagination || null,
      })),
    getOrder: async (labOrderId) => requestAndNormalize(labAPI.orderDetail(labOrderId), normalizeLabOrderDetail),
    listResults: async (params = {}) =>
      requestAndNormalize(labAPI.listResults(withListLimit(params, 500)), (payload) => ({
        items: asArray(payload).map(normalizeLabResult),
        pagination: payload?.pagination || null,
      })),
    getResult: async (resultId) => requestAndNormalize(labAPI.resultDetail(resultId), normalizeLabResultDetail),
    listEncounterOrders: async (encounterId, params = {}) =>
      requestAndNormalize(labAPI.encounterOrders(encounterId, withListLimit(params, 100)), (payload) =>
        asArray(payload).map(normalizeLabOrder),
      ),
    listEncounterResults: async (encounterId, params = {}) =>
      requestAndNormalize(labAPI.encounterResults(encounterId, withListLimit(params, 100)), (payload) =>
        asArray(payload).map(normalizeLabResult),
      ),
    getEncounterSummary: async (encounterId) =>
      requestAndNormalize(labAPI.encounterSummary(encounterId), (payload) => payload || null),
    listPatientResults: async (patientId, params = {}) =>
      requestAndNormalize(labAPI.patientResults(patientId, withListLimit(params, 100)), (payload) =>
        asArray(payload).map(normalizeLabResult),
      ),
    acknowledgeCritical: async (resultId, payload = {}) =>
      requestAndNormalize(labAPI.acknowledgeCritical(resultId, payload), normalizeLabResultDetail),
  },
  procedures: {
    getDashboardSummary: async (params = {}) =>
      requestAndNormalize(procedureAPI.dashboardSummary(params), (payload) => payload || null),
    listOrders: async (params = {}) =>
      requestAndNormalize(procedureAPI.listOrders(withListLimit(params, 500)), (payload) => ({
        items: asArray(payload).map(normalizeProcedureOrder),
        pagination: payload?.pagination || null,
      })),
    getOrder: async (procedureOrderId) =>
      requestAndNormalize(procedureAPI.orderDetail(procedureOrderId), normalizeProcedureOrder),
    getTimeline: async (procedureOrderId) =>
      requestAndNormalize(procedureAPI.orderTimeline(procedureOrderId), (payload) => asArray(payload?.items || payload)),
    listEncounterOrders: async (encounterId, params = {}) =>
      requestAndNormalize(procedureAPI.encounterOrders(encounterId, withListLimit(params, 100)), (payload) =>
        asArray(payload).map(normalizeProcedureOrder),
      ),
    getEncounterSummary: async (encounterId) =>
      requestAndNormalize(procedureAPI.encounterSummary(encounterId), (payload) => payload || null),
    listPatientHistory: async (patientId, params = {}) =>
      requestAndNormalize(procedureAPI.patientHistory(patientId, withListLimit(params, 100)), (payload) =>
        asArray(payload).map(normalizeProcedureOrder),
      ),
  },
  consultations: {
    listByEncounter: async (encounterId) =>
      requestAndNormalize(clinicalAPI.listConsultations({ encounter_id: encounterId }), (payload) =>
        asArray(payload).map(normalizeConsultation),
      ),
    getDetail: async (consultationId) =>
      requestAndNormalize(clinicalAPI.consultationDetail(consultationId), normalizeConsultation),
    create: async (payload) =>
      requestAndNormalize(clinicalAPI.createConsultation(payload), normalizeConsultation),
    update: async (consultationId, payload) =>
      requestAndNormalize(clinicalAPI.updateConsultation(consultationId, payload), normalizeConsultation),
    start: async (consultationId) => requestAndNormalize(clinicalAPI.startConsultation(consultationId)),
    sign: async (consultationId) => requestAndNormalize(clinicalAPI.signConsultation(consultationId)),
    amend: async (consultationId, payload) =>
      requestAndNormalize(clinicalAPI.amendConsultation(consultationId, payload)),
    cancel: async (consultationId) => requestAndNormalize(clinicalAPI.cancelConsultation(consultationId)),
  },
  diagnoses: {
    listByEncounter: async (encounterId) =>
      requestAndNormalize(clinicalAPI.listDiagnoses(encounterId), (payload) =>
        asArray(payload).map(normalizeDiagnosis),
      ),
    create: async (payload) => requestAndNormalize(clinicalAPI.createDiagnosis(payload), normalizeDiagnosis),
    update: async (diagnosisId, payload) =>
      requestAndNormalize(clinicalAPI.updateDiagnosis(diagnosisId, payload), normalizeDiagnosis),
    setPrimary: async (diagnosisId) => requestAndNormalize(clinicalAPI.setPrimaryDiagnosis(diagnosisId)),
    resolve: async (diagnosisId) => requestAndNormalize(clinicalAPI.resolveDiagnosis(diagnosisId)),
    remove: async (diagnosisId) => requestAndNormalize(clinicalAPI.removeDiagnosis(diagnosisId)),
  },
  vitals: {
    listByEncounter: async (encounterId) =>
      requestAndNormalize(clinicalAPI.listVitalSigns(encounterId), (payload) =>
        asArray(payload).map(normalizeVitalSign),
      ),
    getLatest: async (encounterId) =>
      requestAndNormalize(clinicalAPI.latestVitalSigns(encounterId), normalizeVitalSign, null),
    create: async (payload) => requestAndNormalize(clinicalAPI.createVitalSigns(payload), normalizeVitalSign),
    update: async (vitalSignId, payload) =>
      requestAndNormalize(clinicalAPI.updateVitalSigns(vitalSignId, payload), normalizeVitalSign),
    remove: async (vitalSignId) => requestAndNormalize(clinicalAPI.removeVitalSigns(vitalSignId), normalizeVitalSign),
  },
  prescriptions: {
    listByEncounter: async (encounterId, params = {}) =>
      requestAndNormalize(prescriptionAPI.listByEncounter(encounterId, withListLimit(params, 50)), (payload) =>
        asArray(payload).map(normalizePrescription),
      ),
    listByPatient: async (patientId) =>
      requestAndNormalize(prescriptionAPI.listByPatient(patientId), (payload) =>
        asArray(payload).map(normalizePrescription),
      ),
    listActiveByPatient: async (patientId, params = {}) =>
      requestAndNormalize(prescriptionAPI.listActiveByPatient(patientId, withListLimit(params, 50)), (payload) =>
        asArray(payload?.items || payload).map(normalizePrescription),
      ),
    getDetail: async (prescriptionId) =>
      requestAndNormalize(prescriptionAPI.detail(prescriptionId), normalizePrescription),
    getSummary: async (prescriptionId) =>
      requestAndNormalize(prescriptionAPI.summary(prescriptionId), (payload) => payload || null),
    create: async (payload) => requestAndNormalize(prescriptionAPI.create(payload), normalizePrescription),
    createForEncounter: async (encounterId, payload) =>
      requestAndNormalize(prescriptionAPI.createForEncounter(encounterId, payload), normalizePrescription),
    addItem: async (payload) => requestAndNormalize(prescriptionAPI.addItem(payload)),
    listItems: async (prescriptionId) =>
      requestAndNormalize(prescriptionAPI.listItems(prescriptionId), (payload) =>
        asArray(payload?.items || payload).map(normalizePrescriptionItem),
      ),
    updateItem: async (itemId, payload) =>
      requestAndNormalize(prescriptionAPI.updateItem(itemId, payload), normalizePrescriptionItem),
    stopItem: async (itemId) => requestAndNormalize(prescriptionAPI.stopItem(itemId), normalizePrescriptionItem),
    cancelItem: async (itemId) => requestAndNormalize(prescriptionAPI.cancelItem(itemId), normalizePrescriptionItem),
    completeItem: async (itemId) => requestAndNormalize(prescriptionAPI.completeItem(itemId), normalizePrescriptionItem),
    removeItem: async (itemId) => requestAndNormalize(prescriptionAPI.removeItem(itemId), normalizePrescriptionItem),
    searchMedications: async (search, params = {}) =>
      requestAndNormalize(prescriptionAPI.searchMedications(search, withListLimit({ status: 'active', ...params }, 50)), (payload) =>
        asArray(payload).map(normalizeMedication),
      ),
    searchMedicationsPage: async (search, params = {}) =>
      requestAndNormalize(prescriptionAPI.searchMedications(search, withListLimit({ status: 'active', ...params }, 25)), (payload) => ({
        items: asArray(payload).map(normalizeMedication),
        pagination: payload?.pagination || null,
      })),
    checkAllergyConflict: async (payload) =>
      requestAndNormalize(prescriptionAPI.checkAllergyConflict(payload)),
    checkInteractionConflict: async (payload) =>
      requestAndNormalize(prescriptionAPI.checkInteractionConflict(payload)),
    checkDuplicateMedication: async (payload) =>
      requestAndNormalize(prescriptionAPI.checkDuplicateMedication(payload)),
    calculateItemQuantity: async (payload) =>
      requestAndNormalize(prescriptionAPI.calculateItemQuantity(payload)),
    activate: async (prescriptionId) => requestAndNormalize(prescriptionAPI.activate(prescriptionId)),
    cancel: async (prescriptionId) => requestAndNormalize(prescriptionAPI.cancel(prescriptionId)),
    complete: async (prescriptionId) => requestAndNormalize(prescriptionAPI.complete(prescriptionId)),
    duplicate: async (prescriptionId) =>
      requestAndNormalize(prescriptionAPI.duplicate(prescriptionId), normalizePrescription),
    renew: async (prescriptionId, payload = {}) =>
      requestAndNormalize(prescriptionAPI.renew(prescriptionId, payload), normalizePrescription),
    listByDoctor: async (doctorId, params = {}) =>
      requestAndNormalize(prescriptionAPI.listByDoctor(doctorId, withListLimit(params)), (payload) =>
        asArray(payload).map(normalizePrescription),
      ),
    listByDoctorPage: async (doctorId, params = {}) =>
      requestAndNormalize(
        prescriptionAPI.listByDoctor(doctorId, withListLimit(params)),
        (payload) => normalizePagedItems(payload, normalizePrescription),
      ),
  },
  patients: {
    listPage: async (params = {}) =>
      requestAndNormalize(patientAPI.list(withListLimit(params)), (payload) =>
        normalizePagedItems(payload, normalizePatient),
      ),
    search: async (params = {}) =>
      requestAndNormalize(patientAPI.search(withListLimit(params)), (payload) =>
        asArray(payload).map(normalizePatient),
      ),
    searchPage: async (params = {}) =>
      requestAndNormalize(patientAPI.search(withListLimit(params)), (payload) => ({
        items: asArray(payload).map(normalizePatient),
        pagination: payload?.pagination || null,
      })),
    getDetail: async (patientId) =>
      requestAndNormalize(patientAPI.detail(patientId), normalizePatient),
    getSummary: async (patientId) =>
      requestAndNormalize(patientAPI.summary(patientId), (payload) => {
        const summary = payload?.summary || payload || null
        if (!summary) {
          return null
        }

        return {
          ...summary,
          appointment_count: Number(summary.appointment_count ?? summary.appointments_count ?? 0),
          prescription_count: Number(summary.prescription_count ?? summary.prescriptions_count ?? 0),
          encounter_count: Number(summary.encounter_count ?? summary.encounters_count ?? 0),
        }
      }),
    getEncounters: async (patientId) =>
      requestAndNormalize(patientAPI.encounters(patientId, withListLimit()), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    getAppointments: async (patientId) =>
      requestAndNormalize(patientAPI.appointments(patientId, withListLimit()), (payload) =>
        asArray(payload).map(normalizeAppointment),
      ),
    getPrescriptions: async (patientId) =>
      requestAndNormalize(patientAPI.prescriptions(patientId, withListLimit()), (payload) =>
        asArray(payload).map(normalizePrescription),
      ),
    getTimeline: async (patientId) =>
      requestAndNormalize(patientAPI.timeline(patientId), (payload) => asArray(payload?.items || payload)),
    getProblems: async (patientId, params = {}) =>
      requestAndNormalize(patientAPI.problems(patientId, withListLimit(params, 20)), (payload) =>
        asArray(payload?.items || payload),
      ),
    getAllergies: async (patientId, params = {}) =>
      requestAndNormalize(patientAPI.allergies(patientId, withListLimit(params, 20)), (payload) =>
        asArray(payload?.items || payload),
      ),
    getAppointmentsHistory: async (patientId, params = {}) =>
      requestAndNormalize(patientAPI.appointmentsHistory(patientId, withListLimit(params, 20)), (payload) =>
        normalizePagedItems(payload, normalizeAppointment),
      ),
    getEncountersHistory: async (patientId, params = {}) =>
      requestAndNormalize(patientAPI.encountersHistory(patientId, withListLimit(params, 20)), (payload) =>
        normalizePagedItems(payload, normalizeEncounter),
      ),
    getPrescriptionsHistory: async (patientId, params = {}) =>
      requestAndNormalize(patientAPI.prescriptionsHistory(patientId, withListLimit(params, 20)), (payload) =>
        normalizePagedItems(payload, normalizePrescription),
      ),
    canBookAppointment: async (patientId, params = {}) =>
      requestAndNormalize(patientAPI.canBookAppointment(patientId, params), (payload) => payload || null),
  },
  notes: {
    listByEncounter: async (encounterId) =>
      requestAndNormalize(clinicalAPI.listNotes({ encounter_id: encounterId }), (payload) =>
        asArray(payload).map(normalizeClinicalNote),
      ),
    create: async (payload) => requestAndNormalize(clinicalAPI.createNote(payload), normalizeClinicalNote),
    update: async (noteId, payload) =>
      requestAndNormalize(clinicalAPI.updateNote(noteId, payload), normalizeClinicalNote),
    start: async (noteId) => requestAndNormalize(clinicalAPI.startNote(noteId), normalizeClinicalNote),
    complete: async (noteId) => requestAndNormalize(clinicalAPI.completeNote(noteId), normalizeClinicalNote),
    sign: async (noteId) => requestAndNormalize(clinicalAPI.signNote(noteId)),
    amend: async (noteId, payload) => requestAndNormalize(clinicalAPI.amendNote(noteId, payload), normalizeClinicalNote),
    cancel: async (noteId) => requestAndNormalize(clinicalAPI.cancelNote(noteId), normalizeClinicalNote),
  },
  notifications: {
    getUnreadCount: async () =>
      requestAndNormalize(notificationAPI.unreadCount(), (payload) =>
        Number(payload?.unread_count ?? payload?.count ?? payload?.total ?? 0),
      ),
  },
}
