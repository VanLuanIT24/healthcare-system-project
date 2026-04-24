import {
  appointmentAPI,
  clinicalAPI,
  encounterAPI,
  patientAPI,
  prescriptionAPI,
  queueAPI,
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
    patient_id: patient?.patient_id || patient?.id || '',
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
    status: normalizedStatus,
    encounter_type: encounter?.encounter_type || encounter?.type || '',
  }
}

export function normalizeQueueTicket(item = {}) {
  const ticket = item.ticket || item.queue_ticket || item

  return {
    ...ticket,
    queue_ticket_id: ticket?.queue_ticket_id || ticket?.id || '',
    queue_number: ticket?.queue_number || ticket?.ticket_no || '',
    patient_id: ticket?.patient_id || ticket?.patient?.patient_id || '',
    appointment_id: ticket?.appointment_id || '',
    encounter_id: ticket?.encounter_id || '',
    checkin_time: ticket?.checkin_time || ticket?.checked_in_at || ticket?.created_at || '',
    queue_type: ticket?.queue_type || ticket?.visit_type || '',
    status: ticket?.status || '',
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
    prescription_id: prescription?.prescription_id || prescription?.id || '',
    prescription_no: prescription?.prescription_no || prescription?.code || '',
    status: prescription?.status || '',
    items: asArray(prescription?.items),
    note: prescription?.note || '',
    created_at: prescription?.created_at || '',
  }
}

export function normalizeClinicalNote(item = {}) {
  const note = item.note || item

  return {
    ...note,
    note_id: note?.note_id || note?.id || note?._id || '',
    note_text: note?.note_text || note?.content || '',
    status: note?.status || '',
    created_at: note?.created_at || '',
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
    slot_time: item?.slot_time || item?.time || '',
    is_available: Boolean(item?.is_available),
    is_booked: Boolean(item?.is_booked),
    is_blocked: Boolean(item?.is_blocked),
    patient_name: item?.patient_name || item?.patient?.full_name || '',
  }
}

function normalizeBoard(payload = {}) {
  return {
    waiting: asArray(payload?.waiting).map(normalizeQueueTicket),
    called: asArray(payload?.called).map(normalizeQueueTicket),
    in_service: asArray(payload?.in_service).map(normalizeQueueTicket),
    completed: asArray(payload?.completed).map(normalizeQueueTicket),
  }
}

function groupQueueItems(items = []) {
  const tickets = asArray(items).map(normalizeQueueTicket)

  return {
    waiting: tickets.filter((item) => item.status === 'waiting'),
    called: tickets.filter((item) => ['called', 'recalled'].includes(item.status)),
    in_service: tickets.filter((item) => item.status === 'in_service'),
    completed: tickets.filter((item) => item.status === 'completed'),
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
    getAppointmentsToday: async () =>
      requestAndNormalize(appointmentAPI.listToday(withListLimit()), (payload) =>
        asArray(payload).map(normalizeAppointment),
      ),
    getEncountersToday: async () =>
      requestAndNormalize(encounterAPI.listToday(withListLimit()), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    getQueueBoard: async (params = {}) =>
      requestAndNormalize(queueAPI.list(withListLimit(params, 200)), (payload) => groupQueueItems(payload), {
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
    getSlots: async (scheduleId) =>
      requestAndNormalize(scheduleAPI.availableSlots(scheduleId), (payload) =>
        asArray(payload).map(normalizeSlot),
      ),
  },
  queue: {
    listAll: async (params = {}) =>
      requestAndNormalize(queueAPI.list(withListLimit(params, 200)), (payload) => groupQueueItems(payload)),
    getBoard: async (doctorId, params = {}) =>
      requestAndNormalize(queueAPI.boardByDoctor(doctorId, params), normalizeBoard),
    callNext: async (doctorId) => requestAndNormalize(queueAPI.callNext({ doctor_id: doctorId })),
    recall: async (ticketId) => requestAndNormalize(queueAPI.recall(ticketId)),
    skip: async (ticketId) => requestAndNormalize(queueAPI.skip(ticketId)),
    startService: async (ticketId) => requestAndNormalize(queueAPI.startService(ticketId)),
    complete: async (ticketId) => requestAndNormalize(queueAPI.complete(ticketId)),
  },
  appointments: {
    listAll: async (params = {}) =>
      requestAndNormalize(appointmentAPI.list(withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeAppointment),
      ),
    listByDoctor: async (doctorId, params = {}) =>
      requestAndNormalize(appointmentAPI.listByDoctor(doctorId, withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeAppointment),
      ),
    getDetail: async (appointmentId) =>
      requestAndNormalize(appointmentAPI.detail(appointmentId), normalizeAppointment),
    confirm: async (appointmentId) => requestAndNormalize(appointmentAPI.confirmAppointment(appointmentId)),
    noShow: async (appointmentId) => requestAndNormalize(appointmentAPI.markAppointmentNoShow(appointmentId)),
    complete: async (appointmentId) => requestAndNormalize(appointmentAPI.completeAppointment(appointmentId)),
  },
  encounters: {
    listAll: async (params = {}) =>
      requestAndNormalize(encounterAPI.list(withListLimit(params)), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    list: async (doctorId, params = {}) =>
      requestAndNormalize(encounterAPI.list(withListLimit({ doctor_id: doctorId, ...params })), (payload) =>
        asArray(payload).map(normalizeEncounter),
      ),
    getDetail: async (encounterId) =>
      requestAndNormalize(encounterAPI.detail(encounterId), normalizeEncounter),
    getTimeline: async (encounterId) =>
      requestAndNormalize(encounterAPI.timeline(encounterId), (payload) => asArray(payload)),
    createFromAppointment: async (appointmentId) =>
      requestAndNormalize(encounterAPI.createFromAppointment(appointmentId)),
    start: async (encounterId) => requestAndNormalize(encounterAPI.start(encounterId)),
    hold: async (encounterId) => requestAndNormalize(encounterAPI.hold(encounterId)),
    complete: async (encounterId) => requestAndNormalize(encounterAPI.complete(encounterId)),
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
  },
  prescriptions: {
    listByEncounter: async (encounterId) =>
      requestAndNormalize(prescriptionAPI.listByEncounter(encounterId), (payload) =>
        asArray(payload).map(normalizePrescription),
      ),
    listByPatient: async (patientId) =>
      requestAndNormalize(prescriptionAPI.listByPatient(patientId), (payload) =>
        asArray(payload).map(normalizePrescription),
      ),
    getDetail: async (prescriptionId) =>
      requestAndNormalize(prescriptionAPI.detail(prescriptionId), normalizePrescription),
    create: async (payload) => requestAndNormalize(prescriptionAPI.create(payload), normalizePrescription),
    addItem: async (payload) => requestAndNormalize(prescriptionAPI.addItem(payload)),
    searchMedications: async (search) =>
      requestAndNormalize(prescriptionAPI.searchMedications(search), (payload) => asArray(payload)),
    checkAllergyConflict: async (payload) =>
      requestAndNormalize(prescriptionAPI.checkAllergyConflict(payload)),
    activate: async (prescriptionId) => requestAndNormalize(prescriptionAPI.activate(prescriptionId)),
    cancel: async (prescriptionId) => requestAndNormalize(prescriptionAPI.cancel(prescriptionId)),
    duplicate: async (prescriptionId) => requestAndNormalize(prescriptionAPI.duplicate(prescriptionId)),
  },
  patients: {
    search: async (params = {}) =>
      requestAndNormalize(patientAPI.search(withListLimit(params)), (payload) =>
        asArray(payload).map(normalizePatient),
      ),
    getDetail: async (patientId) =>
      requestAndNormalize(patientAPI.detail(patientId), normalizePatient),
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
      requestAndNormalize(patientAPI.timeline(patientId), (payload) => asArray(payload)),
  },
  notes: {
    listByEncounter: async (encounterId) =>
      requestAndNormalize(clinicalAPI.listNotes({ encounter_id: encounterId }), (payload) =>
        asArray(payload).map(normalizeClinicalNote),
      ),
    create: async (payload) => requestAndNormalize(clinicalAPI.createNote(payload), normalizeClinicalNote),
    sign: async (noteId) => requestAndNormalize(clinicalAPI.signNote(noteId)),
  },
}
