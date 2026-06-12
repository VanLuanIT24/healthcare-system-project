import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HeartPulse,
  Inbox,
  ListChecks,
  Paperclip,
  Pill,
  Play,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react'
import {
  appointmentAPI,
  clinicalAPI,
  doctorWorkspaceAPI,
  encounterAPI,
  getApiErrorMessage,
  orderAPI,
  patientAPI,
  prescriptionAPI,
  queueAPI,
  recordsAPI,
  unwrapData,
} from '../utils/api'

function safeArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined)
  if (Array.isArray(value?.items)) return value.items.filter((item) => item !== null && item !== undefined)
  if (Array.isArray(value?.data)) return value.data.filter((item) => item !== null && item !== undefined)
  return []
}

function dataOf(response, fallback = null) {
  const payload = unwrapData(response)
  return payload === undefined || payload === null ? fallback : payload
}

function idOf(value = {}, keys = ['id', '_id']) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  for (const key of keys) {
    const raw = value?.[key]
    if (!raw) continue
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
    if (typeof raw?.$oid === 'string') return raw.$oid
  }
  return ''
}

function patientIdOf(source = {}) {
  const value = source || {}
  return idOf(value.patient || value.patient_id || value, ['patient_id', 'id', '_id'])
}

function encounterIdOf(source = {}) {
  const value = source || {}
  return idOf(value.encounter || value.encounter_id || value, ['encounter_id', 'id', '_id'])
}

function ticketIdOf(source = {}) {
  const value = source || {}
  return idOf(value.queue_ticket || value.ticket || value, ['queue_ticket_id', 'ticket_id', 'id', '_id'])
}

function appointmentIdOf(source = {}) {
  const value = source || {}
  return idOf(value.appointment || value.appointment_id || value, ['appointment_id', 'id', '_id'])
}

function encounterExamPath(encounterId) {
  return `/doctor/encounters?view=active&encounterId=${encodeURIComponent(encounterId)}`
}

async function findTodayEncounterForAppointment(appointmentId) {
  if (!appointmentId) return ''
  try {
    const response = await encounterAPI.listToday({ limit: 100 })
    const payload = dataOf(response, {})
    const rows = safeArray(payload)
    const matched = rows.find((encounter) => appointmentIdOf(encounter) === appointmentId)
    return encounterIdOf(matched)
  } catch (error) {
    return ''
  }
}

async function startEncounterForExam(encounterId, appointmentId = '') {
  if (!encounterId) return
  try {
    await encounterAPI.start(encounterId)
    return
  } catch (startError) {
    try {
      await encounterAPI.arrive(encounterId)
      await encounterAPI.start(encounterId)
      return
    } catch (arriveError) {
      if (!appointmentId) throw arriveError || startError
      await appointmentAPI.checkIn(appointmentId)
      await encounterAPI.start(encounterId)
    }
  }
}

function recordIdOf(record = {}) {
  const value = record || {}
  return idOf(value.medical_record || value.record || value, ['record_id', 'medical_record_id', 'id', '_id'])
}

function attachmentIdOf(attachment = {}) {
  const value = attachment || {}
  return idOf(value.attachment || value, ['attachment_id', 'id', '_id'])
}

function carePlanIdOf(plan = {}) {
  const value = plan || {}
  return idOf(value.care_plan || value, ['care_plan_id', 'id', '_id'])
}

function consultationIdOf(consultation = {}) {
  const value = consultation || {}
  return idOf(value.consultation || value, ['consultation_id', 'id', '_id'])
}

function diagnosisIdOf(diagnosis = {}) {
  const value = diagnosis || {}
  return idOf(value.diagnosis || value, ['diagnosis_id', 'id', '_id'])
}

function noteIdOf(note = {}) {
  const value = note || {}
  return idOf(value.clinical_note || value.note || value, ['note_id', 'clinical_note_id', 'id', '_id'])
}

function orderIdOf(order = {}) {
  const value = order || {}
  return idOf(value.order || value, ['order_id', 'id', '_id'])
}

function medicationIdOf(medication = {}) {
  const value = medication || {}
  return idOf(value.medication || value, ['medication_id', 'id', '_id'])
}

function prescriptionIdOf(prescription = {}) {
  const value = prescription || {}
  return idOf(value.prescription || value, ['prescription_id', 'id', '_id'])
}

function problemIdOf(problem = {}) {
  const value = problem || {}
  return idOf(value.problem || value, ['problem_id', 'id', '_id'])
}

function allergyIdOf(allergy = {}) {
  const value = allergy || {}
  return idOf(value.allergy || value, ['allergy_id', 'id', '_id'])
}

function patientName(source = {}) {
  const value = source || {}
  const patient = value.patient || value.patient_id || value
  return value.patient_name || patient?.full_name || patient?.fullName || patient?.name || 'Bệnh nhân'
}

function patientCode(source = {}) {
  const value = source || {}
  const patient = value.patient || value.patient_id || value
  return value.patient_code || patient?.patient_code || patient?.patientCode || patientIdOf(value)
}

function doctorName(source = {}) {
  const value = source || {}
  const doctor = value.doctor || value.attending_doctor || value.attending_doctor_id || value.provider || value.provider_id || {}
  return value.doctor_name || value.attending_doctor_name || doctor?.full_name || doctor?.fullName || doctor?.name || 'Bác sĩ phụ trách'
}

function departmentName(source = {}) {
  const value = source || {}
  const department = value.department || value.department_id || value.clinic || value.clinic_id || {}
  return value.department_name || department?.department_name || department?.name || value.specialty_name || '--'
}

function diagnosisTypeLabel(value) {
  const normalized = String(value || '').toLowerCase()
  const labels = {
    provisional: 'Tạm thời',
    confirmed: 'Đã xác nhận',
    confirmed_diagnosis: 'Đã xác nhận',
    differential: 'Phân biệt',
    primary: 'Chẩn đoán chính',
  }
  return labels[normalized] || value || '--'
}

function normalizedStatus(value) {
  return String(value || '').toLowerCase()
}

function canStartClinicalNote(note = {}) {
  return ['draft', 'amended'].includes(normalizedStatus(note?.status))
}

function canSignClinicalNote(note = {}) {
  return ['draft', 'in_progress', 'amended'].includes(normalizedStatus(note?.status))
}

function canResolveDiagnosis(diagnosis = {}) {
  return normalizedStatus(diagnosis?.status || 'active') === 'active'
}

function isUsableDiagnosis(diagnosis = {}) {
  const status = normalizedStatus(diagnosis?.status || 'active')
  return !['cancelled', 'entered_in_error', 'voided', 'inactive'].includes(status)
}

function isPrimaryDiagnosis(diagnosis = {}) {
  const type = normalizedStatus(diagnosis?.diagnosis_type || diagnosis?.type)
  return Boolean(diagnosis?.is_primary || type === 'primary' || type === 'confirmed_diagnosis')
}

function canCancelOrder(order = {}) {
  return ['draft', 'ordered', 'acknowledged', 'in_progress'].includes(normalizedStatus(order?.status))
}

function canActivatePrescription(prescription = {}) {
  return normalizedStatus(prescription?.status) === 'draft'
}

function canCancelPrescription(prescription = {}) {
  return !['cancelled', 'completed', 'stopped', 'voided'].includes(normalizedStatus(prescription?.status))
}

function isEncounterCompleted(encounter = {}) {
  return normalizedStatus(encounter?.status) === 'completed'
}

function hasSignedClinicalNote(notes = []) {
  return safeArray(notes).some((note) => normalizedStatus(note.status) === 'signed')
}

function hasPrimaryDiagnosis(diagnoses = []) {
  const usableDiagnoses = safeArray(diagnoses).filter(isUsableDiagnosis)
  return usableDiagnoses.some(isPrimaryDiagnosis) || usableDiagnoses.length > 0
}

function hasAnyOrder(orders = []) {
  return safeArray(orders).length > 0
}

function hasAnyPrescription(prescriptions = []) {
  return safeArray(prescriptions).length > 0
}

function hasBlockingOrders(orders = []) {
  return safeArray(orders).some(canCancelOrder)
}

function canCompleteEncounter(readiness = {}) {
  return Boolean(readiness?.can_complete || readiness?.canComplete || readiness?.allowed || readiness?.ready)
}

const MEDICATION_SEARCH_ALIASES = {
  acetaminophen: 'paracetamol',
  paracatemol: 'paracetamol',
  paracetemol: 'paracetamol',
  parcetamol: 'paracetamol',
  'giam dau': 'paracetamol',
  'ha sot': 'paracetamol',
  'so mui': 'cetirizine',
  'di ung': 'cetirizine',
  'dau da day': 'omeprazole',
  'tieu chay': 'oresol',
  'mat nuoc': 'oresol',
  'khang sinh': 'amoxicillin',
}

const MEDICATION_SUGGESTION_CATALOG = [
  {
    key: 'paracetamol',
    label: 'Paracetamol 500mg',
    search: 'Paracetamol',
    dosage: '500mg',
    route: 'uống',
    frequency: 'Ngày 3 lần khi sốt/đau',
    duration_days: '3',
    quantity: '9',
    unit: 'viên',
    instructions: 'Uống sau ăn, không dùng quá 4g/ngày.',
    meta: 'Sốt, đau đầu, đau họng',
    keywords: ['sốt', 'sot', 'đau', 'dau', 'nhức', 'nhuc', 'đau họng', 'dau hong', 'viêm họng', 'viem hong'],
  },
  {
    key: 'oresol',
    label: 'Oresol',
    search: 'Oresol',
    dosage: '1 gói',
    route: 'uống',
    frequency: 'Pha theo hướng dẫn, uống sau mỗi lần tiêu chảy',
    duration_days: '2',
    quantity: '6',
    unit: 'gói',
    instructions: 'Pha đúng lượng nước theo hướng dẫn trên gói, không pha đặc.',
    meta: 'Tiêu chảy, nôn, mất nước',
    keywords: ['tiêu chảy', 'tieu chay', 'nôn', 'non', 'mất nước', 'mat nuoc', 'đi ngoài', 'di ngoai'],
  },
  {
    key: 'cetirizine',
    label: 'Cetirizine 10mg',
    search: 'Cetirizine',
    dosage: '10mg',
    route: 'uống',
    frequency: 'Ngày 1 lần buổi tối',
    duration_days: '5',
    quantity: '5',
    unit: 'viên',
    instructions: 'Có thể gây buồn ngủ, tránh lái xe nếu buồn ngủ.',
    meta: 'Dị ứng, hắt hơi, sổ mũi',
    keywords: ['dị ứng', 'di ung', 'mề đay', 'me day', 'ngứa', 'ngua', 'sổ mũi', 'so mui', 'hắt hơi', 'hat hoi'],
  },
  {
    key: 'amoxicillin',
    label: 'Amoxicillin 500mg',
    search: 'Amoxicillin',
    dosage: '500mg',
    route: 'uống',
    frequency: 'Ngày 3 lần',
    duration_days: '5',
    quantity: '15',
    unit: 'viên',
    instructions: 'Chỉ dùng khi bác sĩ xác định cần kháng sinh; hỏi tiền sử dị ứng penicillin.',
    meta: 'Nhiễm khuẩn nghi ngờ',
    keywords: ['nhiễm khuẩn', 'nhiem khuan', 'mủ', 'mu', 'viêm amidan', 'viem amidan', 'viêm phổi', 'viem phoi', 'kháng sinh', 'khang sinh'],
  },
  {
    key: 'omeprazole',
    label: 'Omeprazole 20mg',
    search: 'Omeprazole',
    dosage: '20mg',
    route: 'uống',
    frequency: 'Ngày 1 lần trước ăn sáng',
    duration_days: '7',
    quantity: '7',
    unit: 'viên',
    instructions: 'Uống trước ăn sáng 30 phút.',
    meta: 'Đau thượng vị, trào ngược',
    keywords: ['đau thượng vị', 'dau thuong vi', 'dạ dày', 'da day', 'ợ nóng', 'o nong', 'trào ngược', 'trao nguoc', 'viêm dạ dày', 'viem da day'],
  },
  {
    key: 'salbutamol',
    label: 'Salbutamol',
    search: 'Salbutamol',
    dosage: '100mcg/liều',
    route: 'hít',
    frequency: '1-2 nhát khi khó thở/khò khè',
    duration_days: '3',
    quantity: '1',
    unit: 'bình',
    instructions: 'Hướng dẫn kỹ thuật xịt; tái khám/cấp cứu nếu khó thở tăng.',
    meta: 'Khò khè, hen',
    keywords: ['khò khè', 'kho khe', 'hen', 'khó thở', 'kho tho', 'co thắt phế quản', 'co that phe quan'],
  },
  {
    key: 'metformin',
    label: 'Metformin 500mg',
    search: 'Metformin',
    dosage: '500mg',
    route: 'uống',
    frequency: 'Ngày 1 lần sau ăn',
    duration_days: '30',
    quantity: '30',
    unit: 'viên',
    instructions: 'Dùng sau ăn; kiểm tra chống chỉ định và chức năng thận.',
    meta: 'Đái tháo đường type 2',
    keywords: ['đái tháo đường', 'dai thao duong', 'tiểu đường', 'tieu duong', 'glucose', 'hba1c'],
  },
  {
    key: 'losartan',
    label: 'Losartan 50mg',
    search: 'Losartan',
    dosage: '50mg',
    route: 'uống',
    frequency: 'Ngày 1 lần',
    duration_days: '30',
    quantity: '30',
    unit: 'viên',
    instructions: 'Theo dõi huyết áp, kali máu và chức năng thận khi cần.',
    meta: 'Tăng huyết áp',
    keywords: ['tăng huyết áp', 'tang huyet ap', 'huyết áp cao', 'huyet ap cao', 'i10'],
  },
]

function normalizeMedicationKeyword(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function medicationSearchTerms(keyword = '') {
  const raw = String(keyword || '').trim()
  const normalized = normalizeMedicationKeyword(raw)
  return Array.from(new Set([raw, MEDICATION_SEARCH_ALIASES[normalized], normalized].filter(Boolean)))
}

function medicationDisplayText(medication = {}) {
  const value = medication?.medication || medication || {}
  return [
    value.brand_name,
    value.generic_name,
    value.medication_name,
    value.name,
    value.strength,
    value.medication_code,
  ].filter(Boolean).join(' ')
}

function collectMedicationClinicalText(workspace = {}, noteForm = {}, diagnosisForm = {}, consultForm = {}) {
  const fragments = [
    noteForm.title,
    noteForm.content,
    diagnosisForm.icd10_code,
    diagnosisForm.diagnosis_name,
    consultForm.chief_complaint,
    consultForm.assessment,
    consultForm.plan,
    ...safeArray(workspace.notes).flatMap((note) => [note.title, note.content, note.note_text, note.soap_subjective, note.soap_assessment, note.plan]),
    ...safeArray(workspace.diagnoses).flatMap((diagnosis) => [diagnosis.icd10_code, diagnosis.diagnosis_name, diagnosis.description, diagnosis.notes]),
    ...safeArray(workspace.consultations).flatMap((consultation) => [consultation.chief_complaint, consultation.assessment, consultation.plan]),
    ...safeArray(workspace.carePlans).flatMap((carePlan) => [carePlan.title, carePlan.goal, carePlan.intervention, carePlan.notes]),
  ]
  return fragments.filter(Boolean).join(' ')
}

function rankMedicationSuggestions(clinicalText = '') {
  const normalizedText = normalizeMedicationKeyword(clinicalText)
  const scored = MEDICATION_SUGGESTION_CATALOG.map((suggestion, index) => {
    const matched = suggestion.keywords.filter((keyword) => normalizedText.includes(normalizeMedicationKeyword(keyword)))
    return {
      ...suggestion,
      score: matched.length,
      matchedKeywords: matched,
      fallbackOrder: index,
    }
  })
  const contextual = scored
    .filter((suggestion) => suggestion.score > 0)
    .sort((first, second) => second.score - first.score || first.fallbackOrder - second.fallbackOrder)
  const fallback = scored.filter((suggestion) => !contextual.some((item) => item.key === suggestion.key))
  return [...contextual, ...fallback].slice(0, 6)
}

function medicationDisplayName(medication = {}) {
  const value = medication?.medication || medication || {}
  return [value.brand_name, value.generic_name || value.medication_name || value.name, value.strength]
    .filter(Boolean)
    .join(' ')
    || value.medication_code
    || medicationIdOf(value)
}

function medicationAvailableStock(medication = {}) {
  const value = medication?.medication || medication || {}
  const summary = value.stock_summary || value.stockSummary || value.inventory_summary || value.stock || {}
  const candidates = [
    summary.available_on_hand,
    summary.availableOnHand,
    summary.available_quantity,
    summary.quantity_available,
    value.available_on_hand,
    value.available_quantity,
    summary.total_on_hand,
    value.total_on_hand,
  ]
  const numeric = candidates.map((item) => Number(item)).find((item) => Number.isFinite(item))
  return numeric || 0
}

function medicationStockText(medication = {}) {
  const value = medication?.medication || medication || {}
  const summary = value.stock_summary || value.stockSummary || value.inventory_summary || value.stock || {}
  const available = medicationAvailableStock(value)
  const batchCount = Number(summary.available_batches ?? summary.batch_count ?? summary.batchCount ?? 0)
  const nearExpiry = Number(summary.near_expiry_batches ?? summary.nearExpiryBatches ?? 0)
  const parts = [
    available > 0 ? `Tồn khả dụng ${available}` : 'Hết tồn khả dụng',
    batchCount > 0 ? `${batchCount} lô` : '',
    nearExpiry > 0 ? `${nearExpiry} lô gần hết hạn` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function medicationSuggestionLabel(medication = {}, fallback = '') {
  const value = medication?.medication || medication || {}
  return [
    value.medication_code || '',
    value.route_default || '',
    value.unit || '',
    medicationStockText(value),
    fallback,
  ].filter(Boolean).join(' · ')
}

function sortMedicationsByStock(items = []) {
  return safeArray(items).slice().sort((first, second) => {
    const firstStock = medicationAvailableStock(first)
    const secondStock = medicationAvailableStock(second)
    if (Boolean(secondStock) !== Boolean(firstStock)) return Number(Boolean(secondStock)) - Number(Boolean(firstStock))
    return secondStock - firstStock
  })
}

async function fetchMedicationCatalogSuggestions(keyword = '', options = {}) {
  const limit = options.limit || 10
  const stockedOnly = options.stockedOnly !== false
  let items = []
  let matchedTerm = keyword
  for (const term of medicationSearchTerms(keyword)) {
    const response = await prescriptionAPI.searchMedications(term, {
      limit,
      status: 'active',
      with_stock: stockedOnly ? true : undefined,
      in_stock: stockedOnly ? true : undefined,
    })
    items = sortMedicationsByStock(safeArray(dataOf(response, [])))
    matchedTerm = term
    if (items.length) break
  }
  return { items, matchedTerm }
}

function compactClinicalText(value = '', maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return '--'
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text
}

function clinicalNotePreview(note = {}) {
  return compactClinicalText(note.content || note.note_text || note.soap_subjective || note.soap_assessment || note.plan || note.title)
}

function orderPreview(order = {}) {
  return compactClinicalText(order.title || order.order_name || order.test_name || order.procedure_name || order.body_part || order.order_type)
}

function prescriptionPreview(prescription = {}) {
  const items = safeArray(prescription.items)
  if (items.length) {
    return items.map((item) => compactClinicalText([
      item.medication_name || medicationDisplayName(item.medication_id || item.medication),
      item.dose || item.dosage,
      item.frequency,
      item.duration_days ? `${item.duration_days} ngày` : '',
    ].filter(Boolean).join(' · '), 120)).join(' | ')
  }
  return compactClinicalText([
    prescription.medication_name || prescription.prescription_no,
    prescription.dose || prescription.dosage,
    prescription.frequency,
  ].filter(Boolean).join(' · '))
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatAppointmentTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatAppointmentDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function minutesSince(value) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return Math.max(0, Math.round((Date.now() - time) / 60000))
}

function waitText(value) {
  const minutes = minutesSince(value)
  if (minutes === null) return '--'
  if (minutes < 60) return `${minutes} phút`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}p`
}

function statusLabel(status = '') {
  const labels = {
    waiting: 'Đang chờ',
    called: 'Đã gọi',
    recalled: 'Gọi lại',
    ready_for_doctor: 'Sẵn sàng',
    in_service: 'Đang phục vụ',
    planned: 'Dự kiến',
    arrived: 'Đã đến',
    in_progress: 'Đang khám',
    on_hold: 'Tạm dừng',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    draft: 'Bản nháp',
    active: 'Đang hiệu lực',
    signed: 'Đã ký',
    amended: 'Đã chỉnh sửa',
    resolved: 'Đã xử lý',
    entered_in_error: 'Nhập sai',
    final: 'Hoàn tất',
    sealed: 'Đã niêm phong',
    released: 'Đã công bố',
    routine: 'Thường quy',
    urgent: 'Khẩn',
    stat: 'Cấp cứu',
  }
  return labels[String(status || '').toLowerCase()] || status || 'Chưa rõ'
}

function toneFor(status = '', priority = '') {
  const value = String(status || '').toLowerCase()
  const level = String(priority || '').toLowerCase()
  if (['critical', 'stat', 'urgent'].includes(level) || value.includes('critical')) return 'critical'
  if (['draft', 'on_hold', 'waiting', 'called'].includes(value)) return 'warning'
  if (['completed', 'signed', 'final', 'sealed', 'active', 'released'].includes(value)) return 'success'
  return 'neutral'
}

function isReleased(item = {}) {
  return Boolean(item.released_to_patient || item.released_at || item.release_status === 'released')
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`dw2-pill dw2-tone-${tone}`}>{children}</span>
}

function CommandNotice({ error, success }) {
  if (!error && !success) return null
  return (
    <div className={`dw2-command-notice ${error ? 'is-error' : 'is-success'}`}>
      {error || success}
    </div>
  )
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="dw2-panel">
      <div className="dw2-panel__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="dw2-panel__action">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ label = 'Chưa có dữ liệu phù hợp.' }) {
  return (
    <div className="dw2-empty">
      <Inbox size={18} />
      <span>{label}</span>
    </div>
  )
}

function KpiStrip({ items }) {
  return (
    <div className="dw2-command-kpis">
      {items.map((item) => (
        <article className={`dw2-command-kpi dw2-tone-${item.tone || 'neutral'}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.hint}</small>
        </article>
      ))}
    </div>
  )
}

function ActionButton({ children, onClick, disabled, tone = 'neutral', type = 'button', form }) {
  return (
    <button type={type} form={form} className={`dw2-command-button is-${tone}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label className="dw2-command-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function EncounterSummaryRow({ icon: Icon, label, children }) {
  return (
    <div className="dw2-encounter-summary-row">
      <Icon size={15} />
      <span>{label}</span>
      <strong>{children || '--'}</strong>
    </div>
  )
}

function EncounterChecklistRow({ icon: Icon, label, done }) {
  return (
    <div className="dw2-encounter-check-row">
      <Icon size={15} />
      <span>{label}</span>
      <StatusPill tone={done ? 'success' : 'critical'}>{done ? 'Đã hoàn tất' : 'Chưa hoàn tất'}</StatusPill>
    </div>
  )
}

function MedicalRecordPreviewSection({ title, icon: Icon, children, emptyLabel }) {
  return (
    <section className="dw2-record-preview__section">
      <h4><Icon size={15} /> {title}</h4>
      <div className="dw2-record-preview__rows">
        {children || <p className="dw2-record-preview__empty">{emptyLabel || 'Chưa có dữ liệu.'}</p>}
      </div>
    </section>
  )
}

function MedicalRecordPreview({ record, workspace = {} }) {
  const notes = safeArray(workspace.notes)
  const diagnoses = safeArray(workspace.diagnoses)
  const orders = safeArray(workspace.orders)
  const prescriptions = safeArray(workspace.prescriptions)
  const carePlans = safeArray(workspace.carePlans)
  const consultations = safeArray(workspace.consultations)
  const vitals = safeArray(workspace.vitals)

  return (
    <div className="dw2-record-preview">
      <div className="dw2-record-preview__header">
        <div>
          <strong>Tóm tắt hồ sơ trước khi chốt</strong>
          <small>Xem lại nội dung đã ghi trong lượt khám này trước khi ký/chốt và gửi cho bệnh nhân.</small>
        </div>
        <StatusPill tone={recordIdOf(record) ? 'success' : 'warning'}>{recordIdOf(record) ? statusLabel(record.status) : 'Chưa tạo hồ sơ'}</StatusPill>
      </div>
      <div className="dw2-record-preview__grid">
        <MedicalRecordPreviewSection title="Ghi chú lâm sàng" icon={FileText} emptyLabel="Chưa có ghi chú lâm sàng.">
          {notes.length ? notes.slice(0, 3).map((note) => (
            <article key={noteIdOf(note)}>
              <strong>{note.title || note.note_type || 'Ghi chú lâm sàng'}</strong>
              <small>{statusLabel(note.status)} · {formatDateTime(note.created_at)}</small>
              <p>{clinicalNotePreview(note)}</p>
            </article>
          )) : null}
        </MedicalRecordPreviewSection>
        <MedicalRecordPreviewSection title="Chẩn đoán" icon={ClipboardCheck} emptyLabel="Chưa có chẩn đoán.">
          {diagnoses.length ? diagnoses.slice(0, 4).map((diagnosis) => (
            <article key={diagnosisIdOf(diagnosis)}>
              <strong>{diagnosis.diagnosis_name || diagnosis.icd10_code || 'Chẩn đoán'}</strong>
              <small>{diagnosis.icd10_code || '--'} · {diagnosis.is_primary ? 'Chẩn đoán chính' : diagnosisTypeLabel(diagnosis.diagnosis_type)} · {statusLabel(diagnosis.status || 'active')}</small>
            </article>
          )) : null}
        </MedicalRecordPreviewSection>
        <MedicalRecordPreviewSection title="Chỉ định" icon={ClipboardList} emptyLabel="Chưa có chỉ định.">
          {orders.length ? orders.slice(0, 4).map((order) => (
            <article key={orderIdOf(order)}>
              <strong>{orderPreview(order)}</strong>
              <small>{statusLabel(order.order_type)} · {statusLabel(order.priority || 'routine')} · {statusLabel(order.status)}</small>
            </article>
          )) : null}
        </MedicalRecordPreviewSection>
        <MedicalRecordPreviewSection title="Đơn thuốc" icon={Pill} emptyLabel="Chưa có đơn thuốc.">
          {prescriptions.length ? prescriptions.slice(0, 4).map((prescription) => (
            <article key={prescription.prescription_id || prescription.id || prescription._id || prescription.prescription_no}>
              <strong>{prescription.prescription_no || 'Đơn thuốc'}</strong>
              <small>{statusLabel(prescription.status)} · {formatDateTime(prescription.created_at)}</small>
              <p>{prescriptionPreview(prescription)}</p>
            </article>
          )) : null}
        </MedicalRecordPreviewSection>
        <MedicalRecordPreviewSection title="Sinh hiệu" icon={HeartPulse} emptyLabel="Chưa có sinh hiệu trong lượt khám.">
          {vitals.length ? vitals.slice(0, 2).map((vital) => (
            <article key={idOf(vital, ['vital_sign_id', 'id', '_id']) || formatDateTime(vital.recorded_at)}>
              <strong>HA {vital.systolic_bp || '--'}/{vital.diastolic_bp || '--'} · Mạch {vital.heart_rate || '--'} · SpO2 {vital.spo2 || '--'}%</strong>
              <small>{formatDateTime(vital.recorded_at || vital.created_at)}</small>
            </article>
          )) : null}
        </MedicalRecordPreviewSection>
        <MedicalRecordPreviewSection title="Kế hoạch / hội chẩn" icon={ListChecks} emptyLabel="Chưa có kế hoạch hoặc hội chẩn.">
          {[...carePlans.slice(0, 2), ...consultations.slice(0, 2)].length ? [...carePlans.slice(0, 2), ...consultations.slice(0, 2)].map((item, index) => (
            <article key={carePlanIdOf(item) || consultationIdOf(item) || index}>
              <strong>{item.title || item.consultation_no || item.chief_complaint || 'Nội dung theo dõi'}</strong>
              <small>{statusLabel(item.status)} · {compactClinicalText(item.goal || item.assessment || item.plan || item.intervention, 90)}</small>
            </article>
          )) : null}
        </MedicalRecordPreviewSection>
      </div>
    </div>
  )
}

function PatientClinical360({ summary, timeline, records, attachments, documentTimeline, onNavigate }) {
  if (!summary?.patient) {
    return <EmptyState label="Chọn một bệnh nhân để mở Patient Clinical 360." />
  }

  const patient = summary.patient
  const alerts = safeArray(summary.alerts)
  const latestVital = safeArray(summary.latest_vitals)[0]

  return (
    <div className="dw2-clinical-360">
      <div className="dw2-clinical-360__header">
        <span className="dw2-clinical-avatar">{String(patient.full_name || 'BN').slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{patient.full_name || 'Bệnh nhân'}</strong>
          <p>{[patient.gender, patient.age ? `${patient.age} tuổi` : '', patient.patient_code].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className="dw2-command-badges">
        {alerts.length ? alerts.slice(0, 4).map((alert, index) => (
          <StatusPill key={`${alert.type}-${index}`} tone={alert.severity === 'high' || alert.severity === 'critical' ? 'critical' : 'warning'}>
            {alert.title || alert.type}
          </StatusPill>
        )) : <StatusPill tone="success">Không có cảnh báo active</StatusPill>}
        <StatusPill tone={latestVital ? 'neutral' : 'warning'}>
          {latestVital ? `HA ${latestVital.systolic_bp || '--'}/${latestVital.diastolic_bp || '--'} · SpO2 ${latestVital.spo2 || '--'}%` : 'Chưa có sinh hiệu'}
        </StatusPill>
      </div>
      <div className="dw2-blueprint-grid dw2-blueprint-grid--compact">
        <div><h4>Dị ứng</h4><p>{safeArray(summary.allergies).slice(0, 3).map((item) => item.allergen || item.allergen_name).filter(Boolean).join(' · ') || 'Không ghi nhận'}</p></div>
        <div><h4>Problem active</h4><p>{safeArray(summary.problems).slice(0, 3).map((item) => item.problem_name || item.title).filter(Boolean).join(' · ') || 'Không ghi nhận'}</p></div>
        <div><h4>Đơn thuốc gần đây</h4><p>{safeArray(summary.prescriptions).slice(0, 2).map((item) => item.prescription_no || item.status).filter(Boolean).join(' · ') || 'Không có'}</p></div>
      </div>
      <div className="dw2-command-lists">
        <Panel title="Encounter gần đây" subtitle="Tối đa 5 lần khám mới nhất từ database.">
          <div className="dw2-compact-list">
            {!safeArray(summary.encounters).length ? <EmptyState label="Chưa có encounter." /> : safeArray(summary.encounters).slice(0, 5).map((encounter) => (
              <button type="button" key={encounterIdOf(encounter)} onClick={() => onNavigate(`/doctor/encounters?view=active&encounterId=${encounterIdOf(encounter)}`)}>
                <Stethoscope size={16} />
                <span><strong>{encounter.encounter_code || 'Encounter'}</strong><small>{statusLabel(encounter.status)} · {formatDateTime(encounter.start_time || encounter.started_at)}</small></span>
                <StatusPill tone={toneFor(encounter.status)}>{statusLabel(encounter.status)}</StatusPill>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Hồ sơ và tài liệu" subtitle="Medical record, attachment và document timeline.">
          <div className="dw2-compact-list">
            {[...safeArray(records).slice(0, 3), ...safeArray(attachments).slice(0, 3)].length ? (
              [...safeArray(records).slice(0, 3), ...safeArray(attachments).slice(0, 3)].map((item, index) => (
                <button type="button" key={`${recordIdOf(item) || attachmentIdOf(item)}-${index}`}>
                  <FileText size={16} />
                  <span><strong>{item.record_no || item.file_name || item.title || 'Tài liệu'}</strong><small>{item.record_type || item.category || item.status || 'document'} · {formatDateTime(item.created_at || item.opened_at)}</small></span>
                  <StatusPill tone={isReleased(item) ? 'success' : 'neutral'}>{isReleased(item) ? 'Release' : statusLabel(item.status)}</StatusPill>
                </button>
              ))
            ) : <EmptyState label="Chưa có hồ sơ/tài liệu." />}
          </div>
        </Panel>
      </div>
      <Panel title="Timeline" subtitle="Sự kiện bệnh nhân gần đây.">
        <div className="dw2-command-timeline">
          {!safeArray(timeline).length && !safeArray(documentTimeline).length ? <EmptyState label="Chưa có timeline." /> : [...safeArray(timeline), ...safeArray(documentTimeline)].slice(0, 8).map((event, index) => (
            <div key={`${event.event_id || event.id || index}`}>
              <time>{formatDateTime(event.created_at || event.timestamp || event.event_time || event.opened_at)}</time>
              <strong>{event.title || event.event_type || event.type || 'Sự kiện'}</strong>
              <span>{event.description || event.message || event.status || ''}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

async function loadPatient360(patientId) {
  if (!patientId) return { summary: null, timeline: [], records: [], attachments: [], documentTimeline: [] }
  const [summary, timeline, records, attachments, documentTimeline] = await Promise.allSettled([
    doctorWorkspaceAPI.patientSummary(patientId),
    patientAPI.timeline(patientId),
    recordsAPI.listPatientMedicalRecords(patientId, { limit: 20 }),
    recordsAPI.listPatientAttachments(patientId, { limit: 20 }),
    recordsAPI.getPatientDocumentTimeline(patientId, { limit: 30 }),
  ])

  return {
    summary: summary.status === 'fulfilled' ? dataOf(summary.value, null) : null,
    timeline: timeline.status === 'fulfilled' ? safeArray(dataOf(timeline.value, [])) : [],
    records: records.status === 'fulfilled' ? safeArray(dataOf(records.value, [])) : [],
    attachments: attachments.status === 'fulfilled' ? safeArray(dataOf(attachments.value, [])) : [],
    documentTimeline: documentTimeline.status === 'fulfilled' ? safeArray(dataOf(documentTimeline.value, [])) : [],
  }
}

export function DoctorPatientFlowPage({ item, overview, onNavigate, onRefresh }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [patient360, setPatient360] = useState({ summary: null, timeline: [], records: [], attachments: [], documentTimeline: [] })
  const [notice, setNotice] = useState({ error: '', success: '' })

  const viewKey = item?.key || 'patients-waiting'

  useEffect(() => {
    let cancelled = false
    async function loadRows() {
      setLoading(true)
      try {
        let nextRows = []
        if (viewKey === 'patients-waiting') {
          nextRows = safeArray(overview.queue)
        } else if (viewKey === 'patients-in-care') {
          nextRows = safeArray(overview.active_encounters)
        } else if (viewKey === 'patients-seen-today') {
          const response = await encounterAPI.listToday({ status: 'completed', limit: 60 })
          nextRows = safeArray(dataOf(response, []))
        } else if (viewKey === 'follow-up-due') {
          const [tasks, appointments] = await Promise.allSettled([
            doctorWorkspaceAPI.tasks({ q: 'follow', limit: 50 }),
            appointmentAPI.listUpcoming({ q: 'follow', limit: 50 }),
          ])
          nextRows = [
            ...safeArray(tasks.status === 'fulfilled' ? dataOf(tasks.value, []) : []).map((task) => ({ ...task, row_type: 'task' })),
            ...safeArray(appointments.status === 'fulfilled' ? dataOf(appointments.value, []) : []).map((appointment) => ({ ...appointment, row_type: 'appointment' })),
          ]
        } else {
          const response = query.trim()
            ? await patientAPI.search({ q: query.trim(), limit: 50 })
            : await patientAPI.list({ limit: 50 })
          nextRows = safeArray(dataOf(response, []))
        }
        if (!cancelled) setRows(nextRows)
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tải được danh sách bệnh nhân.'), success: '' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadRows()
    return () => { cancelled = true }
  }, [viewKey, overview.queue, overview.active_encounters, query])

  useEffect(() => {
    let cancelled = false
    if (!selectedPatientId) return undefined
    async function load() {
      try {
        const data = await loadPatient360(selectedPatientId)
        if (!cancelled) setPatient360(data)
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tải được Patient Clinical 360.'), success: '' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedPatientId])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || viewKey === 'patient-history') return rows
    return rows.filter((row) => {
      const text = [patientName(row), patientCode(row), row.reason, row.title, row.description, row.encounter_code, row.queue_number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return text.includes(q)
    })
  }, [query, rows, viewKey])

  async function selectRow(row) {
    const patientId = patientIdOf(row)
    if (patientId) setSelectedPatientId(patientId)
  }

  async function startFromQueue(row) {
    const ticketId = ticketIdOf(row)
    if (!ticketId) {
      setNotice({ error: 'Queue ticket không có id để bắt đầu encounter.', success: '' })
      return
    }
    try {
      setNotice({ error: '', success: '' })
      await queueAPI.call(ticketId).catch(() => null)
      const response = await encounterAPI.createFromQueue(ticketId)
      const payload = dataOf(response, {})
      const encounterId = encounterIdOf(payload.encounter || payload)
      setNotice({ error: '', success: 'Đã tạo encounter từ queue ticket.' })
      onRefresh?.()
      if (encounterId) onNavigate(`/doctor/encounters?view=active&encounterId=${encounterId}`)
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Không bắt đầu được encounter từ queue.'), success: '' })
    }
  }

  async function createFollowUp() {
    const patientId = selectedPatientId || patientIdOf(filteredRows[0] || {})
    if (!patientId) {
      setNotice({ error: 'Chọn bệnh nhân trước khi tạo follow-up.', success: '' })
      return
    }
    try {
      await clinicalAPI.createCarePlan({
        patient_id: patientId,
        title: 'Follow-up tại phòng khám',
        goals: [{ goal: 'Bác sĩ cần theo dõi lại bệnh nhân theo kế hoạch.', target_date: new Date().toISOString() }],
        interventions: [{ description: 'Liên hệ bệnh nhân, xem kết quả cần theo dõi hoặc tạo lịch tái khám.', responsible_role: 'doctor' }],
        status: 'active',
        notes: 'Tạo từ Doctor Workspace - Follow-up đến hạn.',
      })
      setNotice({ error: '', success: 'Đã tạo care plan follow-up trong database.' })
      onRefresh?.()
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Không tạo được follow-up.'), success: '' })
    }
  }

  const kpis = [
    { label: 'Tổng dòng', value: filteredRows.length, hint: item?.label, tone: 'neutral' },
    { label: 'Hàng đợi đang hoạt động', value: safeArray(overview.queue).length, hint: 'Từ tổng quan bác sĩ', tone: 'warning' },
    { label: 'Encounter mở', value: safeArray(overview.active_encounters).length, hint: 'in_progress/on_hold/arrived', tone: 'success' },
    { label: 'Việc cần hoàn tất', value: safeArray(overview.tasks).length, hint: 'Task inbox lâm sàng', tone: 'neutral' },
  ]

  return (
    <div className="dw2-command-page">
      <KpiStrip items={kpis} />
      <CommandNotice error={notice.error} success={notice.success} />
      <div className="dw2-command-toolbar">
        <div className="dw2-command-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, mã BN, STT queue, encounter, lý do khám..." />
        </div>
        <ActionButton onClick={createFollowUp} tone="success"><PlusCircle size={16} /> Tạo follow-up</ActionButton>
      </div>
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <Panel title={item?.label || 'Bệnh nhân của tôi'} subtitle="Danh sách điều phối dựa trên doctor-workspace overview và endpoint nghiệp vụ hiện có.">
            <div className="dw2-command-table">
              <div className="dw2-command-row is-head">
                <span>Bệnh nhân</span><span>Trạng thái</span><span>Clinical signal</span><span>Thời gian</span><span>Thao tác</span>
              </div>
              {loading ? <EmptyState label="Đang tải dữ liệu..." /> : null}
              {!loading && !filteredRows.length ? <EmptyState label="Chưa có bệnh nhân phù hợp." /> : null}
              {!loading && filteredRows.map((row, index) => {
                const status = row.status || row.encounter_status || row.row_type || ''
                const latestVital = row.latest_vital || row.latest_vital_signs
                return (
                  <div className="dw2-command-row" key={`${ticketIdOf(row) || encounterIdOf(row) || patientIdOf(row) || index}`}>
                    <button type="button" onClick={() => selectRow(row)}>
                      <strong>{patientName(row)}</strong>
                      <small>{patientCode(row) || row.encounter_code || row.queue_number || 'Chưa có mã'}</small>
                    </button>
                    <span><StatusPill tone={toneFor(status, row.priority || row.queue_type)}>{statusLabel(status || row.queue_type)}</StatusPill></span>
                    <span>{latestVital ? `SpO2 ${latestVital.spo2 || '--'}% · Mạch ${latestVital.heart_rate || latestVital.pulse || '--'}` : row.description || row.reason || 'Chưa có sinh hiệu/cảnh báo'}</span>
                    <span>{waitText(row.checkin_time || row.started_at || row.start_time || row.created_at)}</span>
                    <span className="dw2-command-actions">
                      {ticketIdOf(row) ? <ActionButton onClick={() => startFromQueue(row)} tone="success"><Play size={15} /> Bắt đầu</ActionButton> : null}
                      {encounterIdOf(row) ? <ActionButton onClick={() => onNavigate(`/doctor/encounters?view=active&encounterId=${encounterIdOf(row)}`)}><Stethoscope size={15} /> Mở</ActionButton> : null}
                    </span>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Patient Clinical 360" subtitle="Tóm tắt lâm sàng lấy từ /doctor-workspace/patients/:id/summary và records.">
            <PatientClinical360 {...patient360} onNavigate={onNavigate} />
          </Panel>
          {viewKey === 'follow-up-due' ? (
            <Panel title="Backend gap được xử lý rõ" subtitle="Không giả lập DoctorFollowUpTask khi backend chưa có model riêng.">
              <div className="dw2-focus-list">
                <div><AlertTriangle size={16} /><span>Follow-up hiện được ghi nhận bằng CarePlan active để có tác động database thật.</span></div>
                <div><CheckCircle2 size={16} /><span>Khi backend có /doctor-workspace/follow-ups, UI có thể chuyển sang queue chuyên biệt.</span></div>
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function readinessItems(readiness = {}) {
  const checklist = safeArray(readiness.checklist).length ? safeArray(readiness.checklist) : safeArray(readiness.items)
  if (checklist.length) {
    return checklist.filter((item) => !['orders_clear', 'care_plan'].includes(item.key))
  }
  return [
    { key: 'note', label: 'Ghi chú lâm sàng đã ký', done: !safeArray(readiness.missing).some((item) => String(item).toLowerCase().includes('note')) },
    { key: 'diagnosis', label: 'Có chẩn đoán chính', done: !safeArray(readiness.missing).some((item) => String(item).toLowerCase().includes('chẩn đoán')) },
    { key: 'prescription', label: 'Không còn đơn thuốc draft', done: true },
  ]
}

async function loadEncounterWorkspace(encounterId) {
  if (!encounterId) return {}
  const calls = await Promise.allSettled([
    encounterAPI.detail(encounterId),
    encounterAPI.summary(encounterId),
    encounterAPI.timeline(encounterId),
    encounterAPI.canStart(encounterId),
    encounterAPI.canComplete(encounterId),
    encounterAPI.editable(encounterId),
    clinicalAPI.encounterSummary(encounterId),
    clinicalAPI.listNotes({ encounter_id: encounterId }),
    clinicalAPI.listDiagnoses(encounterId),
    clinicalAPI.listVitalSigns(encounterId),
    encounterAPI.listOrders(encounterId, { limit: 40 }),
    prescriptionAPI.listByEncounter(encounterId, { limit: 40 }),
    clinicalAPI.listCarePlans({ encounter_id: encounterId, limit: 40 }),
    clinicalAPI.listConsultations({ encounter_id: encounterId, limit: 40 }),
    recordsAPI.getEncounterMedicalRecord(encounterId),
  ])
  const value = (index, fallback) => calls[index].status === 'fulfilled' ? dataOf(calls[index].value, fallback) : fallback
  return {
    detail: value(0, null),
    summary: value(1, null),
    timeline: safeArray(value(2, [])),
    canStart: value(3, null),
    canComplete: value(4, null),
    editable: value(5, null),
    clinicalSummary: value(6, null),
    notes: safeArray(value(7, [])),
    diagnoses: safeArray(value(8, [])),
    vitals: safeArray(value(9, [])),
    orders: safeArray(value(10, [])),
    prescriptions: safeArray(value(11, [])),
    carePlans: safeArray(value(12, [])),
    consultations: safeArray(value(13, [])),
    record: value(14, null),
  }
}

export function DoctorEncounterCommandPage({ item, overview, onNavigate, onRefresh }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const requestedEncounterId = params.get('encounterId') || ''
  const requestedAppointmentId = params.get('appointmentId') || ''
  const [selectedEncounterId, setSelectedEncounterId] = useState(requestedEncounterId || encounterIdOf(safeArray(overview.active_encounters)[0] || {}))
  const [autoOpenedAppointmentId, setAutoOpenedAppointmentId] = useState('')
  const [workspace, setWorkspace] = useState({})
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState({ error: '', success: '' })
  const [noteForm, setNoteForm] = useState({ title: 'SOAP note', content: '' })
  const [diagnosisForm, setDiagnosisForm] = useState({ icd10_code: '', diagnosis_name: '', diagnosis_type: 'provisional', is_primary: true })
  const [orderForm, setOrderForm] = useState({ order_type: 'lab', title: '', priority: 'routine', instructions: '' })
  const [prescriptionForm, setPrescriptionForm] = useState({ medication_id: '', medication_name: '', dosage: '', route: 'oral', frequency: '', duration_days: '5', quantity: '1', unit: 'viên', instructions: '' })
  const [medicationSearch, setMedicationSearch] = useState({ loading: false, error: '', hint: '', items: [] })
  const [medicationCatalogSuggestions, setMedicationCatalogSuggestions] = useState({ loading: false, error: '', items: [] })
  const [vitalForm, setVitalForm] = useState({ temperature: '', heart_rate: '', respiratory_rate: '', systolic_bp: '', diastolic_bp: '', spo2: '', weight: '', height: '' })
  const [carePlanForm, setCarePlanForm] = useState({ title: 'Kế hoạch điều trị', goal: '', intervention: '' })
  const [consultForm, setConsultForm] = useState({ chief_complaint: '', assessment: '', plan: '' })
  const [problemForm, setProblemForm] = useState({ problem_name: '', severity: 'unknown', notes: '' })
  const [activeExamAction, setActiveExamAction] = useState('note')

  useEffect(() => {
    if (requestedEncounterId) setSelectedEncounterId(requestedEncounterId)
  }, [requestedEncounterId])

  useEffect(() => {
    let cancelled = false
    if (!selectedEncounterId) return undefined
    async function load() {
      setLoading(true)
      try {
        const data = await loadEncounterWorkspace(selectedEncounterId)
        if (!cancelled) setWorkspace(data)
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tải được encounter workspace.'), success: '' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedEncounterId])

  const encounter = workspace.detail?.encounter || workspace.detail || safeArray(overview.active_encounters).find((row) => encounterIdOf(row) === selectedEncounterId) || null
  const patientId = patientIdOf(encounter)
  const readiness = encounter?.readiness || workspace.canComplete || workspace.summary?.readiness || {}
  const currentView = item?.key || 'encounter-active'
  const isExamWorkflow = currentView === 'encounter-active'
  const medicationClinicalText = useMemo(
    () => collectMedicationClinicalText(workspace, noteForm, diagnosisForm, consultForm),
    [workspace, noteForm.title, noteForm.content, diagnosisForm.icd10_code, diagnosisForm.diagnosis_name, consultForm.chief_complaint, consultForm.assessment, consultForm.plan],
  )
  const medicationSuggestions = useMemo(() => rankMedicationSuggestions(medicationClinicalText), [medicationClinicalText])
  const hasMedicationClinicalContext = Boolean(normalizeMedicationKeyword(medicationClinicalText))
  const visibleMedicationSuggestions = medicationCatalogSuggestions.items.length ? medicationCatalogSuggestions.items : medicationSuggestions
  const medicationSearchItems = safeArray(medicationSearch.items)
  const hasMedicationSearchItems = medicationSearchItems.length > 0

  useEffect(() => {
    if (!isExamWorkflow || activeExamAction !== 'prescription') {
      setMedicationCatalogSuggestions((current) => (
        current.loading || current.error || current.items.length
          ? { loading: false, error: '', items: [] }
          : current
      ))
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      const ranked = medicationSuggestions
      const seeds = (ranked.some((suggestion) => suggestion.score > 0)
        ? ranked.filter((suggestion) => suggestion.score > 0)
        : ranked).slice(0, 6)
      setMedicationCatalogSuggestions((current) => ({ ...current, loading: true, error: '' }))
      try {
        const catalogItems = []
        const seen = new Set()
        for (const suggestion of seeds) {
          const { items } = await fetchMedicationCatalogSuggestions(suggestion.search || suggestion.label, { limit: 4 })
          const selected = items.find((medication) => {
            const medicationId = medicationIdOf(medication)
            return medicationId && !seen.has(medicationId)
          })
          if (!selected) continue
          const medicationId = medicationIdOf(selected)
          seen.add(medicationId)
          catalogItems.push({
            ...selected,
            suggestion_key: suggestion.key,
            suggestion_reason: suggestion.score > 0 ? suggestion.meta : '',
            prescription_defaults: suggestion,
          })
          if (catalogItems.length >= 6) break
        }
        if (!catalogItems.length) {
          const response = await prescriptionAPI.listMedications({ limit: 6, status: 'active', with_stock: true, in_stock: true })
          for (const medication of sortMedicationsByStock(dataOf(response, []))) {
            const medicationId = medicationIdOf(medication)
            if (!medicationId || seen.has(medicationId)) continue
            seen.add(medicationId)
            catalogItems.push(medication)
          }
        }
        if (!cancelled) setMedicationCatalogSuggestions({ loading: false, error: '', items: catalogItems })
      } catch (error) {
        if (!cancelled) {
          setMedicationCatalogSuggestions({
            loading: false,
            error: getApiErrorMessage(error, 'Không tải được gợi ý thuốc từ kho dược.'),
            items: [],
          })
        }
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeExamAction, isExamWorkflow, medicationSuggestions])

  useEffect(() => {
    if (!isExamWorkflow || activeExamAction !== 'prescription') return undefined
    if (prescriptionForm.medication_id) return undefined
    const keyword = prescriptionForm.medication_name.trim()
    if (keyword.length < 2) {
      setMedicationSearch((current) => (
        current.loading || current.error || current.hint || current.items.length
          ? { loading: false, error: '', hint: '', items: [] }
          : current
      ))
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setMedicationSearch((current) => ({
        ...current,
        loading: true,
        error: '',
        hint: 'Đang lấy gợi ý từ kho thuốc dược...',
      }))
      try {
        const { items, matchedTerm } = await fetchMedicationCatalogSuggestions(keyword, { limit: 10 })
        if (cancelled) return
        const correctedTerm = normalizeMedicationKeyword(matchedTerm) !== normalizeMedicationKeyword(keyword)
        setMedicationSearch({
          loading: false,
          error: items.length ? '' : 'Không tìm thấy thuốc còn tồn khả dụng trong kho dược.',
          hint: items.length
            ? correctedTerm
              ? `Đã tự sửa tìm kiếm thành "${matchedTerm}" và lấy gợi ý từ kho dược.`
              : 'Gợi ý lấy từ kho thuốc dược backend.'
            : '',
          items,
        })
      } catch (error) {
        if (!cancelled) {
          setMedicationSearch({
            loading: false,
            error: getApiErrorMessage(error, 'Không tải được gợi ý thuốc từ kho dược.'),
            hint: '',
            items: [],
          })
        }
      }
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeExamAction, isExamWorkflow, prescriptionForm.medication_id, prescriptionForm.medication_name])

  async function runAction(action, successMessage) {
    try {
      setNotice({ error: '', success: '' })
      await action()
      setNotice({ error: '', success: successMessage })
      if (selectedEncounterId) setWorkspace(await loadEncounterWorkspace(selectedEncounterId))
      onRefresh?.()
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Thao tác không thành công.'), success: '' })
    }
  }

  async function createFromQueue(ticket) {
    const ticketId = ticketIdOf(ticket)
    if (!ticketId) return
    await runAction(async () => {
      const response = await encounterAPI.createFromQueue(ticketId)
      const payload = dataOf(response, {})
      const encounterId = encounterIdOf(payload.encounter || payload)
      if (encounterId) {
        try {
          await startEncounterForExam(encounterId)
        } catch (error) {
          // Keep the encounter selected even if another active encounter blocks start.
        }
        setSelectedEncounterId(encounterId)
        onNavigate?.(encounterExamPath(encounterId))
      }
    }, 'Đã tạo encounter từ queue ticket.')
  }

  async function createFromAppointment(appointment) {
    const appointmentId = appointmentIdOf(appointment)
    if (!appointmentId) return
    await runAction(async () => {
      let response = null
      let createError = null
      try {
        response = await encounterAPI.createFromAppointment(appointmentId)
      } catch (error) {
        createError = error
        try {
          await appointmentAPI.checkIn(appointmentId)
        } catch (checkInError) {
          // Retry create below; if it still fails, recover an existing encounter if possible.
        }
        try {
          response = await encounterAPI.createFromAppointment(appointmentId)
          createError = null
        } catch (retryError) {
          createError = retryError
        }
      }

      const payload = dataOf(response, {})
      let encounterId = encounterIdOf(payload.encounter || payload)
      if (!encounterId) encounterId = await findTodayEncounterForAppointment(appointmentId)
      if (!encounterId && createError) throw createError
      if (encounterId) {
        try {
          await startEncounterForExam(encounterId, appointmentId)
        } catch (error) {
          // The note workspace can still open when start is blocked by another active encounter.
        }
        setSelectedEncounterId(encounterId)
        onNavigate?.(encounterExamPath(encounterId))
      }
    }, 'Đã tạo encounter từ lịch hẹn.')
  }

  useEffect(() => {
    if (!requestedAppointmentId || requestedEncounterId || autoOpenedAppointmentId === requestedAppointmentId) return
    setAutoOpenedAppointmentId(requestedAppointmentId)
    createFromAppointment({ appointment_id: requestedAppointmentId })
  }, [requestedAppointmentId, requestedEncounterId, autoOpenedAppointmentId])

  async function createNote(event) {
    event.preventDefault()
    if (!selectedEncounterId || !noteForm.content.trim()) return
    await runAction(() => clinicalAPI.createNote({
      encounter_id: selectedEncounterId,
      title: noteForm.title,
      note_type: 'progress_note',
      content: noteForm.content,
      visibility: 'care_team',
    }), 'Đã lưu clinical note vào database.')
    setNoteForm({ title: 'SOAP note', content: '' })
  }

  async function createDiagnosis(event) {
    event.preventDefault()
    if (!selectedEncounterId || !diagnosisForm.diagnosis_name.trim()) return
    await runAction(() => clinicalAPI.createDiagnosis({ encounter_id: selectedEncounterId, ...diagnosisForm }), 'Đã thêm chẩn đoán.')
    setDiagnosisForm({ icd10_code: '', diagnosis_name: '', diagnosis_type: 'provisional', is_primary: false })
  }

  async function startNote(note) {
    if (!canStartClinicalNote(note)) return
    await runAction(() => clinicalAPI.startNote(noteIdOf(note)), 'Đã bắt đầu ghi chú.')
  }

  async function signNote(note) {
    if (!canSignClinicalNote(note)) return
    await runAction(() => clinicalAPI.signNote(noteIdOf(note)), 'Đã ký ghi chú.')
  }

  async function setDiagnosisPrimary(diagnosis) {
    if (!canResolveDiagnosis(diagnosis)) return
    await runAction(() => clinicalAPI.setPrimaryDiagnosis(diagnosisIdOf(diagnosis)), 'Đã đặt làm chẩn đoán chính.')
  }

  async function resolveDiagnosis(diagnosis) {
    if (!canResolveDiagnosis(diagnosis)) return
    await runAction(() => clinicalAPI.resolveDiagnosis(diagnosisIdOf(diagnosis)), 'Đã đánh dấu chẩn đoán là đã xử lý.')
  }

  async function cancelOrder(order) {
    const id = orderIdOf(order)
    if (!id || !canCancelOrder(order)) return
    await runAction(() => orderAPI.cancel(id, { reason: 'Hủy từ màn hình khám của bác sĩ' }), 'Đã hủy chỉ định.')
  }

  async function activatePrescription(prescription) {
    const id = prescriptionIdOf(prescription)
    if (!id || !canActivatePrescription(prescription)) return
    await runAction(() => prescriptionAPI.activate(id), 'Đã kích hoạt đơn thuốc. Đơn không còn ở trạng thái bản nháp.')
  }

  async function cancelPrescription(prescription) {
    const id = prescriptionIdOf(prescription)
    if (!id || !canCancelPrescription(prescription)) return
    await runAction(() => prescriptionAPI.cancel(id, { reason: 'Hủy từ màn hình hoàn tất lượt khám của bác sĩ' }), 'Đã hủy đơn thuốc.')
  }

  async function completeCurrentEncounter() {
    if (!selectedEncounterId) return
    await encounterAPI.complete(selectedEncounterId)
  }

  async function ensureEncounterCompletedForRecordAction() {
    if (!isEncounterCompleted(encounter)) {
      await completeCurrentEncounter()
    }
  }

  async function finalizeCurrentMedicalRecord() {
    if (!encounterRecordId) return
    await ensureEncounterCompletedForRecordAction()
    const recordStatus = normalizedStatus(encounterRecord?.status)
    if (!['finalized', 'sealed', 'archived'].includes(recordStatus)) {
      await recordsAPI.finalizeMedicalRecord(encounterRecordId)
    }
  }

  async function releaseCurrentMedicalRecord() {
    if (!encounterRecordId) return
    await ensureEncounterCompletedForRecordAction()
    const recordStatus = normalizedStatus(encounterRecord?.status)
    if (!['finalized', 'sealed', 'archived'].includes(recordStatus)) {
      await recordsAPI.finalizeMedicalRecord(encounterRecordId)
    }
    if (!isReleased(encounterRecord)) {
      await recordsAPI.releaseMedicalRecordToPatient(encounterRecordId)
    }
  }

  function selectMedicationForPrescription(medication, defaults = {}) {
    const medicationId = medicationIdOf(medication)
    if (!medicationId) return
    setPrescriptionForm((current) => ({
      ...current,
      medication_id: medicationId,
      medication_name: medicationDisplayName(medication),
      dosage: defaults.dosage || current.dosage || medication.strength || '',
      route: medication.route_default || defaults.route || current.route || 'uống',
      frequency: defaults.frequency || current.frequency || '',
      duration_days: defaults.duration_days || current.duration_days || '1',
      quantity: defaults.quantity || current.quantity || '1',
      unit: medication.unit || defaults.unit || current.unit || 'viên',
      instructions: defaults.instructions || current.instructions || '',
    }))
    setMedicationSearch((current) => ({ ...current, error: '', hint: `Đã chọn ${medicationDisplayName(medication)}.` }))
  }

  async function searchMedicationForPrescription(event, forcedKeyword = '', defaults = {}) {
    event?.preventDefault()
    const keyword = String(forcedKeyword || prescriptionForm.medication_name.trim() || prescriptionForm.medication_id.trim()).trim()
    if (!keyword) {
      setMedicationSearch({ loading: false, error: 'Nhập tên thuốc để tìm trong danh mục hoặc bấm một thuốc gợi ý.', hint: '', items: [] })
      return []
    }
    setMedicationSearch({ loading: true, error: '', hint: '', items: [] })
    try {
      const { items, matchedTerm } = await fetchMedicationCatalogSuggestions(keyword, { limit: 10 })
      const correctedTerm = normalizeMedicationKeyword(matchedTerm) !== normalizeMedicationKeyword(keyword)
      setMedicationSearch({
        loading: false,
        error: items.length ? '' : 'Không tìm thấy thuốc còn tồn khả dụng trong kho dược. Thử từ khóa khác hoặc kiểm tra kho thuốc.',
        hint: items.length
          ? correctedTerm
            ? `Đã tự sửa tìm kiếm thành "${matchedTerm}" và lấy gợi ý từ kho dược.`
            : 'Gợi ý lấy từ kho thuốc dược backend.'
          : '',
        items,
      })
      if (items.length && defaults.autoSelect) selectMedicationForPrescription(items[0], defaults)
      return items
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không tìm được danh mục thuốc.')
      setMedicationSearch({ loading: false, error: message, hint: '', items: [] })
      return []
    }
  }

  async function chooseMedicationSuggestion(suggestion) {
    const medicationId = medicationIdOf(suggestion)
    if (medicationId) {
      selectMedicationForPrescription(suggestion, suggestion.prescription_defaults || {})
      return
    }
    setPrescriptionForm((current) => ({
      ...current,
      medication_id: '',
      medication_name: suggestion.search,
      dosage: suggestion.dosage || current.dosage,
      route: suggestion.route || current.route || 'uống',
      frequency: suggestion.frequency || current.frequency,
      duration_days: suggestion.duration_days || current.duration_days,
      quantity: suggestion.quantity || current.quantity,
      unit: suggestion.unit || current.unit || 'viên',
      instructions: suggestion.instructions || current.instructions,
    }))
    await searchMedicationForPrescription(null, suggestion.search, { ...suggestion, autoSelect: true })
  }

  async function resolvePrescriptionMedication() {
    if (prescriptionForm.medication_id.trim()) {
      return {
        medication_id: prescriptionForm.medication_id.trim(),
        medication_name: prescriptionForm.medication_name.trim() || prescriptionForm.medication_id.trim(),
      }
    }
    const items = medicationSearch.items.length ? medicationSearch.items : await searchMedicationForPrescription()
    const keyword = normalizeMedicationKeyword(prescriptionForm.medication_name)
    const selected = items.find((item) => normalizeMedicationKeyword(medicationDisplayText(item)) === keyword)
      || items.find((item) => normalizeMedicationKeyword(medicationDisplayText(item)).includes(keyword))
      || items[0]
    const medicationId = medicationIdOf(selected)
    if (!medicationId) {
      setNotice({ error: 'Không tìm thấy thuốc hợp lệ trong danh mục. Hãy nhập tên thuốc rồi bấm Tìm thuốc.', success: '' })
      return null
    }
    selectMedicationForPrescription(selected)
    return selected
  }

  async function createOrder(event) {
    event.preventDefault()
    const title = orderForm.title.trim()
    const instructions = orderForm.instructions.trim()
    if (!selectedEncounterId) {
      setNotice({ error: 'Chọn encounter đang khám trước khi tạo chỉ định.', success: '' })
      return
    }
    if (!title) {
      setNotice({ error: 'Nhập tên chỉ định trước khi tạo.', success: '' })
      return
    }
    if (!instructions) {
      setNotice({ error: 'Nhập lý do chỉ định / dặn dò. Trường này bắt buộc với xét nghiệm, CĐHA và thủ thuật.', success: '' })
      return
    }
    const payload = {
      order_type: orderForm.order_type,
      priority: orderForm.priority,
      clinical_indication: instructions,
    }
    if (orderForm.order_type === 'lab') payload.test_name = title
    if (orderForm.order_type === 'imaging') {
      payload.modality = 'xray'
      payload.body_part = title
    }
    if (orderForm.order_type === 'procedure') payload.procedure_name = title
    await runAction(() => orderAPI.createForEncounter(selectedEncounterId, payload), 'Đã tạo chỉ định.')
    setOrderForm({ order_type: 'lab', title: '', priority: 'routine', instructions: '' })
  }

  async function createPrescription(event) {
    event.preventDefault()
    if (!selectedEncounterId) return
    const medication = await resolvePrescriptionMedication()
    const medicationId = medicationIdOf(medication)
    if (!medicationId) return
    if (!prescriptionForm.dosage.trim() && !String(medication.strength || '').trim()) {
      setNotice({ error: 'Nhập liều dùng trước khi kê đơn.', success: '' })
      return
    }
    if (!prescriptionForm.frequency.trim()) {
      setNotice({ error: 'Nhập tần suất dùng thuốc trước khi kê đơn.', success: '' })
      return
    }
    const medicationItem = {
      medication_id: medicationId,
      medication_name: prescriptionForm.medication_name || medicationDisplayName(medication),
      dose: prescriptionForm.dosage || medication.strength,
      route: prescriptionForm.route || medication.route_default || 'oral',
      frequency: prescriptionForm.frequency,
      duration_days: Number(prescriptionForm.duration_days) || 1,
      quantity: Number(prescriptionForm.quantity) || 1,
      unit: prescriptionForm.unit || medication.unit || 'viên',
      instructions: prescriptionForm.instructions,
    }
    await runAction(() => prescriptionAPI.createForEncounter(selectedEncounterId, {
      status: 'draft',
      items: [medicationItem],
      note: prescriptionForm.instructions,
    }), 'Đã tạo đơn thuốc draft.')
    setPrescriptionForm({ medication_id: '', medication_name: '', dosage: '', route: 'oral', frequency: '', duration_days: '5', quantity: '1', unit: 'viên', instructions: '' })
    setMedicationSearch({ loading: false, error: '', items: [] })
  }

  async function createVitals(event) {
    event.preventDefault()
    await runAction(() => clinicalAPI.createVitalSigns({
      patient_id: patientId,
      encounter_id: selectedEncounterId,
      context: 'encounter',
      recorded_at: new Date().toISOString(),
      ...Object.fromEntries(Object.entries(vitalForm).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)])),
    }), 'Đã ghi sinh hiệu.')
  }

  async function createCarePlan(event) {
    event.preventDefault()
    if (!patientId || !carePlanForm.title.trim()) return
    await runAction(() => clinicalAPI.createCarePlan({
      patient_id: patientId,
      encounter_id: selectedEncounterId,
      title: carePlanForm.title,
      goals: carePlanForm.goal ? [{ goal: carePlanForm.goal }] : [],
      interventions: carePlanForm.intervention ? [{ description: carePlanForm.intervention, responsible_role: 'doctor' }] : [],
      status: 'active',
    }), 'Đã tạo care plan.')
  }

  async function createConsultation(event) {
    event.preventDefault()
    if (!selectedEncounterId) return
    await runAction(() => clinicalAPI.createConsultation({
      encounter_id: selectedEncounterId,
      chief_complaint: consultForm.chief_complaint,
      assessment: consultForm.assessment,
      plan: consultForm.plan,
      status: 'draft',
      allow_multiple: true,
    }), 'Đã tạo consultation.')
  }

  async function createProblem(event) {
    event.preventDefault()
    if (!patientId || !problemForm.problem_name.trim()) return
    await runAction(() => clinicalAPI.createPatientProblem(patientId, {
      encounter_id: selectedEncounterId,
      ...problemForm,
    }), 'Đã thêm problem vào hồ sơ bệnh nhân.')
    setProblemForm({ problem_name: '', severity: 'unknown', notes: '' })
  }

  const selectedPatient = encounter?.patient || encounter?.patient_id || null
  const encounterRows = safeArray(overview.active_encounters)
  const examWorkflowSteps = [
    { key: 'note', label: '1. Ghi note', done: hasSignedClinicalNote(workspace.notes), doneLabel: 'Đã ký' },
    { key: 'diagnosis', label: '2. Chẩn đoán', done: hasPrimaryDiagnosis(workspace.diagnoses), doneLabel: 'Đã làm' },
    { key: 'order', label: '3. Tạo chỉ định', done: hasAnyOrder(workspace.orders), doneLabel: 'Đã tạo' },
    { key: 'prescription', label: '4. Kê đơn', done: hasAnyPrescription(workspace.prescriptions), doneLabel: 'Đã tạo' },
    { key: 'complete', label: '5. Hoàn tất', done: isEncounterCompleted(encounter), doneLabel: 'Đã hoàn tất' },
  ]
  const visibleExamWorkflowSteps = examWorkflowSteps
    .filter((step) => step.key !== 'order')
    .map((step, index) => ({
      ...step,
      label: `${index + 1}. ${step.label.replace(/^\d+\.\s*/, '')}`,
    }))
  const showNotePanel = currentView === 'clinical-note' || (isExamWorkflow && activeExamAction === 'note')
  const showDiagnosisPanel = currentView === 'diagnosis' || (isExamWorkflow && activeExamAction === 'diagnosis')
  const showOrderPanel = isExamWorkflow && activeExamAction === 'order'
  const showPrescriptionPanel = isExamWorkflow && activeExamAction === 'prescription'
  const showCompletePanel = currentView === 'complete-encounter' || (isExamWorkflow && activeExamAction === 'complete')
  const showEncounterTools = currentView === 'encounter-start' || isExamWorkflow
  const patientAgeGender = [selectedPatient?.age, selectedPatient?.gender].filter(Boolean).join(' / ') || '--'
  const missingText = safeArray(readiness.missing).join(' ').toLowerCase()
  const checklistRows = [
    { key: 'note', label: 'Ghi chú lâm sàng', icon: FileText, done: !missingText.includes('note') && safeArray(workspace.notes).length > 0 },
    { key: 'diagnosis', label: 'Chẩn đoán chính', icon: ClipboardCheck, done: !missingText.includes('diagn') && !missingText.includes('chẩn') },
    { key: 'order', label: 'Chỉ định', icon: ClipboardList, done: !missingText.includes('order') },
    { key: 'prescription', label: 'Đơn thuốc', icon: Pill, done: !missingText.includes('prescription') && !missingText.includes('thuốc') },
    { key: 'care', label: 'Kế hoạch chăm sóc', icon: ListChecks, done: !missingText.includes('care') },
  ]
  const encounterRecord = workspace.record?.medical_record || workspace.record || null
  const encounterRecordId = recordIdOf(encounterRecord)
  const encounterCompleted = isEncounterCompleted(encounter)
  const draftPrescriptions = safeArray(workspace.prescriptions).filter((prescription) => normalizedStatus(prescription.status) === 'draft')
  const activeBlockingOrders = safeArray(workspace.orders).filter(canCancelOrder)
  const noteStepComplete = hasSignedClinicalNote(workspace.notes)
  const diagnosisStepComplete = hasPrimaryDiagnosis(workspace.diagnoses)
  const visibleChecklistRows = checklistRows
    .filter((check) => check.key !== 'care')
    .filter((check) => check.key !== 'order' || activeBlockingOrders.length > 0)
    .map((check) => {
      if (check.key === 'note') return { ...check, done: noteStepComplete }
      if (check.key === 'diagnosis') return { ...check, done: diagnosisStepComplete }
      if (check.key === 'prescription') return { ...check, done: draftPrescriptions.length === 0 }
      if (check.key === 'order') return { ...check, done: activeBlockingOrders.length === 0 }
      return check
    })
  const missingRequiredClinicalSteps = !noteStepComplete || !diagnosisStepComplete
  const canCompleteNow = noteStepComplete && diagnosisStepComplete && !draftPrescriptions.length && !activeBlockingOrders.length

  useEffect(() => {
    if (selectedEncounterId) return
    const fallbackEncounterId = requestedEncounterId || encounterIdOf(safeArray(overview.active_encounters)[0] || {})
    if (fallbackEncounterId) setSelectedEncounterId(fallbackEncounterId)
  }, [requestedEncounterId, overview.active_encounters, selectedEncounterId])

  return (
    <div className="dw2-command-page dw2-encounter-workspace">
      <CommandNotice error={notice.error} success={notice.success} />
      {isExamWorkflow ? (
        <>
        <div className="dw2-exam-workflow">
          {visibleExamWorkflowSteps.map((step, index) => {
            const isActive = activeExamAction === step.key
            const stepStatus = step.done ? step.doneLabel : isActive ? 'Đang thực hiện' : 'Chưa bắt đầu'
            return (
              <button
                type="button"
                key={step.key}
                className={`${isActive ? 'is-active' : ''} ${step.done ? 'is-done' : ''}`.trim()}
                aria-pressed={isActive}
                onClick={() => setActiveExamAction(step.key)}
              >
                <span>{index + 1}</span>
                <b>{step.label.replace(/^\d+\.\s*/, '')}</b>
                <small>{stepStatus}</small>
              </button>
            )
          })}
        </div>
        <div className="dw2-exam-optional-tools">
          <button
            type="button"
            className={activeExamAction === 'order' ? 'is-active' : ''}
            onClick={() => setActiveExamAction('order')}
          >
            <ClipboardList size={16} />
            <span>
              <strong>Chỉ định nếu cần</strong>
              <small>{hasBlockingOrders(workspace.orders) ? 'Có chỉ định đang mở cần xử lý' : hasAnyOrder(workspace.orders) ? 'Đã có chỉ định trong lượt khám' : 'Không bắt buộc cho mọi lượt khám'}</small>
            </span>
          </button>
        </div>
        </>
      ) : null}
      <div className="dw2-encounter-shell">
        <div className="dw2-encounter-shell__main">
          <Panel
            title="Lượt khám đang mở"
            subtitle="Chọn encounter để thao tác nội dung lâm sàng và hoàn tất lần khám."
            action={encounter ? <ActionButton onClick={() => onNavigate?.(`/doctor/encounters?view=active&encounterId=${selectedEncounterId}`)}>Xem chi tiết</ActionButton> : null}
          >
            <div className="dw2-encounter-list">
              {!encounterRows.length ? <EmptyState label="Không có encounter đang mở." /> : encounterRows.map((row) => (
                <button type="button" key={encounterIdOf(row)} className={`dw2-encounter-card ${encounterIdOf(row) === selectedEncounterId ? 'is-selected' : ''}`} onClick={() => setSelectedEncounterId(encounterIdOf(row))}>
                  <div className="dw2-encounter-card__identity">
                    <FileText size={18} />
                    <span><strong>{row.encounter_code || 'Lượt khám'}</strong><small>Bắt đầu lúc {formatDateTime(row.start_time || row.started_at || row.created_at)}</small></span>
                  </div>
                  <span><b>Bệnh nhân</b>{patientName(row)}<small>{patientCode(row)}</small></span>
                  <span><b>Bác sĩ</b>{doctorName(row)}<small>{departmentName(row)}</small></span>
                  <span><b>Trạng thái</b><StatusPill tone={toneFor(row.status)}>{statusLabel(row.status)}</StatusPill><small>{safeArray(row.readiness?.missing).join(' · ') || 'Checklist ổn'}</small></span>
                </button>
              ))}
            </div>
          </Panel>

          {showEncounterTools ? (
            <div className="dw2-encounter-midgrid">
              <Panel title="Tạo từ queue" subtitle="Chọn ticket để bắt đầu encounter.">
                <div className="dw2-encounter-mini-list">
                  {!safeArray(overview.queue).length ? <EmptyState label="Không có queue sẵn sàng." /> : safeArray(overview.queue).slice(0, 2).map((ticket) => (
                    <button type="button" key={ticketIdOf(ticket)} onClick={() => createFromQueue(ticket)} className="dw2-encounter-mini-card">
                      <span className="dw2-encounter-mini-code">{ticket.display_number || ticket.queue_number || ticket.ticket_code || '--'} <StatusPill tone={toneFor(ticket.status)}>{statusLabel(ticket.status)}</StatusPill></span>
                      <strong>{patientName(ticket)}</strong>
                      <small>{ticket.room_name || 'Phòng khám 1'} · {doctorName(ticket)}</small>
                      <span className="dw2-encounter-mini-action">Xem queue</span>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title="Tạo từ lịch hẹn" subtitle="Danh sách lịch hẹn trong ngày.">
                <div className="dw2-encounter-mini-list">
                  {!safeArray(overview.appointments).length ? <EmptyState label="Không có lịch hẹn hôm nay." /> : safeArray(overview.appointments).slice(0, 2).map((appointment) => (
                    <button type="button" key={appointmentIdOf(appointment)} onClick={() => createFromAppointment(appointment)} className="dw2-encounter-appointment-row">
                      <CalendarDays size={15} />
                      <span className="dw2-encounter-appointment-time">
                        <strong>{formatAppointmentTime(appointment.appointment_time)}</strong>
                        <small>{formatAppointmentDate(appointment.appointment_time)}</small>
                      </span>
                      <span className="dw2-encounter-appointment-info">
                        <strong>{patientName(appointment)}</strong>
                        <small>{doctorName(appointment)}</small>
                      </span>
                      <span className="dw2-encounter-appointment-meta">
                        <StatusPill tone={toneFor(appointment.status)}>{statusLabel(appointment.status)}</StatusPill>
                        <span className="dw2-encounter-mini-action">Tạo lượt khám</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title="Dòng thời gian" subtitle="Lịch sử hoạt động của lượt khám.">
                <div className="dw2-encounter-timeline">
                  {!safeArray(workspace.timeline).length ? <EmptyState label="Chưa có timeline." /> : safeArray(workspace.timeline).slice(0, 3).map((event, index) => (
                    <div key={`${event.event_id || index}`}>
                      <span />
                      <time>{formatDateTime(event.created_at || event.timestamp)}</time>
                      <strong>{event.action || event.title || event.type || 'Sự kiện'}</strong>
                      <small>{event.message || event.status || ''}</small>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {showNotePanel ? (
            <Panel
              title="Ghi chú lâm sàng"
              subtitle="Tạo và quản lý ghi chú lâm sàng (SOAP)."
              action={<div className="dw2-encounter-note-actions"><ActionButton type="submit" form="dw2-clinical-note-form" tone="success"><FileText size={16} /> Lưu ghi chú</ActionButton></div>}
            >
              <form id="dw2-clinical-note-form" className="dw2-soap-editor" onSubmit={createNote}>
                <input className="dw2-soap-editor__title" value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} aria-label="Tiêu đề note" />
                <div className="dw2-soap-editor__tabs" aria-label="SOAP sections">
                  <button type="button" className="is-active">S - Chủ quan</button>
                  <button type="button">O - Khách quan</button>
                  <button type="button">A - Đánh giá</button>
                  <button type="button">P - Kế hoạch</button>
                </div>
                <div className="dw2-soap-editor__toolbar">
                  <button type="button">↶</button>
                  <button type="button">↷</button>
                  <select aria-label="Kiểu chữ" defaultValue="normal"><option value="normal">Bình thường</option></select>
                  <button type="button"><strong>B</strong></button>
                  <button type="button"><em>I</em></button>
                  <button type="button"><u>U</u></button>
                  <button type="button">☷</button>
                  <button type="button"><Paperclip size={14} /></button>
                </div>
                <textarea rows={5} value={noteForm.content} onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))} placeholder="Nhập thông tin chủ quan của bệnh nhân..." />
                <div className="dw2-soap-editor__footer">
                  <span>Chưa hoàn tất · Chưa ký · Cập nhật lần cuối: {formatDateTime(new Date())}</span>
                  <ActionButton type="submit" tone="success"><FileText size={16} /> Lưu ghi chú</ActionButton>
                </div>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.notes).length ? <EmptyState label="Chưa có ghi chú." /> : safeArray(workspace.notes).map((note) => {
                  const noteCanStart = canStartClinicalNote(note)
                  const noteCanSign = canSignClinicalNote(note)
                  return (
                    <button type="button" key={noteIdOf(note)}>
                      <FileText size={16} />
                      <span><strong>{note.title || note.note_type || 'Ghi chú lâm sàng'}</strong><small>{statusLabel(note.status)} · {formatDateTime(note.created_at)}</small></span>
                      <span className="dw2-command-actions">
                        {noteCanStart ? <ActionButton onClick={() => startNote(note)}>Bắt đầu</ActionButton> : null}
                        {noteCanSign ? <ActionButton onClick={() => signNote(note)} tone="success">Ký ghi chú</ActionButton> : <StatusPill tone={normalizedStatus(note.status) === 'signed' ? 'success' : 'neutral'}>{statusLabel(note.status)}</StatusPill>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Panel>
          ) : null}

          {showDiagnosisPanel ? (
            <Panel title="Chẩn đoán" subtitle="Hệ thống đảm bảo mỗi lượt khám chỉ có một chẩn đoán chính đang hiệu lực.">
              <form className="dw2-command-form" onSubmit={createDiagnosis}>
                <Field label="ICD-10"><input value={diagnosisForm.icd10_code} onChange={(event) => setDiagnosisForm((current) => ({ ...current, icd10_code: event.target.value }))} /></Field>
                <Field label="Tên chẩn đoán"><input value={diagnosisForm.diagnosis_name} onChange={(event) => setDiagnosisForm((current) => ({ ...current, diagnosis_name: event.target.value }))} /></Field>
                <Field label="Loại"><select value={diagnosisForm.diagnosis_type} onChange={(event) => setDiagnosisForm((current) => ({ ...current, diagnosis_type: event.target.value }))}><option value="provisional">Tạm thời</option><option value="confirmed">Đã xác nhận</option><option value="differential">Phân biệt</option></select></Field>
                <Field label="Chẩn đoán chính"><input type="checkbox" checked={diagnosisForm.is_primary} onChange={(event) => setDiagnosisForm((current) => ({ ...current, is_primary: event.target.checked }))} /></Field>
                <ActionButton type="submit" tone="success"><PlusCircle size={16} /> Thêm chẩn đoán</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.diagnoses).length ? <EmptyState label="Chưa có chẩn đoán." /> : safeArray(workspace.diagnoses).map((diagnosis) => {
                  const diagnosisActive = canResolveDiagnosis(diagnosis)
                  return (
                    <button type="button" key={diagnosisIdOf(diagnosis)}>
                      <ClipboardCheck size={16} /><span><strong>{diagnosis.diagnosis_name || diagnosis.icd10_code}</strong><small>{diagnosis.icd10_code || '--'} · {diagnosis.is_primary ? 'Chẩn đoán chính' : diagnosisTypeLabel(diagnosis.diagnosis_type)} · {statusLabel(diagnosis.status || 'active')}</small></span>
                      <span className="dw2-command-actions">
                        {diagnosisActive && !diagnosis.is_primary ? <ActionButton onClick={() => setDiagnosisPrimary(diagnosis)}>Đặt làm chính</ActionButton> : null}
                        {diagnosisActive ? <ActionButton onClick={() => resolveDiagnosis(diagnosis)}>Đã xử lý</ActionButton> : <StatusPill tone="neutral">{statusLabel(diagnosis.status)}</StatusPill>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Panel>
          ) : null}
          {showOrderPanel ? (
            <Panel title="Tạo chỉ định" subtitle="Tạo chỉ định trực tiếp trong lượt khám đang mở.">
              <form className="dw2-command-form" onSubmit={createOrder}>
                <Field label="Loại chỉ định"><select value={orderForm.order_type} onChange={(event) => setOrderForm((current) => ({ ...current, order_type: event.target.value }))}><option value="lab">Xét nghiệm</option><option value="imaging">CĐHA</option><option value="procedure">Thủ thuật</option></select></Field>
                <Field label="Tên chỉ định"><input required value={orderForm.title} onChange={(event) => setOrderForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ví dụ: Công thức máu, X-quang ngực..." /></Field>
                <Field label="Ưu tiên"><select value={orderForm.priority} onChange={(event) => setOrderForm((current) => ({ ...current, priority: event.target.value }))}><option value="routine">Thường quy</option><option value="urgent">Khẩn</option><option value="stat">Cấp cứu</option></select></Field>
                <Field label="Lý do / dặn dò"><input required value={orderForm.instructions} onChange={(event) => setOrderForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Ví dụ: Sốt 3 ngày, ho nhiều, cần loại trừ viêm phổi..." /></Field>
                <ActionButton type="submit" tone="success"><ClipboardList size={16} /> Tạo chỉ định</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.orders).length ? <EmptyState label="Chưa có chỉ định trong encounter." /> : safeArray(workspace.orders).map((order) => (
                  <div className="dw2-command-row" key={orderIdOf(order)}>
                    <ClipboardList size={16} /><span><strong>{order.title || order.order_name || order.order_type || 'Chỉ định'}</strong><small>{statusLabel(order.status)} · {statusLabel(order.priority || 'routine')}</small></span>
                    <span className="dw2-command-actions">
                      {canCancelOrder(order) ? <ActionButton onClick={() => cancelOrder(order)}>Hủy chỉ định</ActionButton> : <StatusPill tone={normalizedStatus(order.status) === 'completed' ? 'success' : 'neutral'}>{statusLabel(order.status)}</StatusPill>}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {showPrescriptionPanel ? (
            <Panel title="Kê đơn" subtitle="Tạo đơn thuốc draft cho encounter đang khám.">
              <form className="dw2-command-form" onSubmit={createPrescription}>
                <Field label="Tên thuốc">
                  <span className="dw2-medication-search-field">
                    <input
                      required
                      value={prescriptionForm.medication_name}
                      onChange={(event) => {
                        setPrescriptionForm((current) => ({ ...current, medication_id: '', medication_name: event.target.value }))
                        setMedicationSearch((current) => ({ ...current, error: '', hint: '' }))
                      }}
                      placeholder="Ví dụ: Paracetamol, Amoxicillin..."
                    />
                    <button type="button" onClick={searchMedicationForPrescription} disabled={medicationSearch.loading}>
                      <Search size={15} />
                      {medicationSearch.loading ? 'Đang tìm' : 'Tìm thuốc'}
                    </button>
                  </span>
                </Field>
                <Field label="Mã thuốc đã chọn"><input value={prescriptionForm.medication_id || 'Chưa chọn thuốc từ danh mục'} readOnly /></Field>
                <div className="dw2-medication-suggestion-box">
                  <div className="dw2-medication-suggestion-head">
                    <strong>{hasMedicationClinicalContext ? 'Gợi ý theo nội dung khám' : 'Gợi ý thuốc thường dùng'}</strong>
                    <small>{hasMedicationClinicalContext ? 'Dựa trên ghi chú, chẩn đoán và nội dung khám hiện có.' : 'Chưa có nội dung khám đủ rõ, hiển thị thuốc hay dùng để chọn nhanh.'}</small>
                  </div>
                  {medicationSearch.loading ? <p className="dw2-prescription-search-note">Đang lấy gợi ý từ kho thuốc dược...</p> : null}
                  {hasMedicationSearchItems ? <p className="dw2-prescription-search-note">Gợi ý từ kho thuốc dược backend.</p> : null}
                  {hasMedicationSearchItems ? (
                    <div className="dw2-medication-suggestion-chips is-catalog">
                      {medicationSearchItems.map((medication) => (
                        <button type="button" key={medicationIdOf(medication)} onClick={() => selectMedicationForPrescription(medication)}>
                          <strong>{medicationDisplayName(medication)}</strong>
                          <small>{[medication.medication_code, medication.route_default || 'route chưa rõ', medication.unit || 'đơn vị chưa rõ', medicationStockText(medication)].filter(Boolean).join(' · ')}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className={`dw2-medication-suggestion-chips ${hasMedicationSearchItems ? 'is-hidden' : ''}`.trim()}>
                    {visibleMedicationSuggestions.map((suggestion) => {
                      const medicationId = medicationIdOf(suggestion)
                      return (
                        <button type="button" key={medicationId || suggestion.key} onClick={() => chooseMedicationSuggestion(suggestion)}>
                          <strong>{medicationId ? medicationDisplayName(suggestion) : suggestion.label}</strong>
                          <small>{medicationId ? medicationSuggestionLabel(suggestion, suggestion.suggestion_reason) : (suggestion.score > 0 ? `Phù hợp: ${suggestion.meta}` : suggestion.meta)}</small>
                        </button>
                      )
                    })}
                  </div>
                  {medicationCatalogSuggestions.loading ? <p className="dw2-prescription-search-note">Đang lấy gợi ý từ kho dược...</p> : null}
                  {medicationCatalogSuggestions.error ? <p className="dw2-prescription-search-note is-error">{medicationCatalogSuggestions.error}</p> : null}
                </div>
                <Field label="Liều dùng"><input value={prescriptionForm.dosage} onChange={(event) => setPrescriptionForm((current) => ({ ...current, dosage: event.target.value }))} placeholder="500mg" /></Field>
                <Field label="Đường dùng"><input value={prescriptionForm.route} onChange={(event) => setPrescriptionForm((current) => ({ ...current, route: event.target.value }))} placeholder="oral" /></Field>
                <Field label="Tần suất"><input value={prescriptionForm.frequency} onChange={(event) => setPrescriptionForm((current) => ({ ...current, frequency: event.target.value }))} placeholder="Ngày 2 lần" /></Field>
                <Field label="Số ngày"><input type="number" min="1" value={prescriptionForm.duration_days} onChange={(event) => setPrescriptionForm((current) => ({ ...current, duration_days: event.target.value }))} /></Field>
                <Field label="Số lượng"><input type="number" min="1" value={prescriptionForm.quantity} onChange={(event) => setPrescriptionForm((current) => ({ ...current, quantity: event.target.value }))} /></Field>
                <Field label="Đơn vị"><input value={prescriptionForm.unit} onChange={(event) => setPrescriptionForm((current) => ({ ...current, unit: event.target.value }))} placeholder="viên" /></Field>
                <Field label="Dặn dò"><input value={prescriptionForm.instructions} onChange={(event) => setPrescriptionForm((current) => ({ ...current, instructions: event.target.value }))} /></Field>
                <ActionButton type="submit" tone="success"><Pill size={16} /> Kê đơn</ActionButton>
              </form>
              {medicationSearch.error ? <p className="dw2-prescription-search-note is-error">{medicationSearch.error}</p> : null}
              {medicationSearch.hint ? <p className="dw2-prescription-search-note">{medicationSearch.hint}</p> : null}
              {safeArray(medicationSearch.items).length ? (
                <div className="dw2-medication-results">
                  {safeArray(medicationSearch.items).map((medication) => (
                    <button type="button" key={medicationIdOf(medication)} onClick={() => selectMedicationForPrescription(medication)}>
                      <Pill size={15} />
                      <span>
                        <strong>{medicationDisplayName(medication)}</strong>
                        <small>{medication.medication_code || '--'} · {medication.route_default || 'route chưa rõ'} · {medication.unit || 'đơn vị chưa rõ'}</small>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="dw2-compact-list">
                {!safeArray(workspace.prescriptions).length ? <EmptyState label="Chưa có đơn thuốc trong encounter." /> : safeArray(workspace.prescriptions).map((prescription) => (
                  <div className="dw2-command-row" key={prescriptionIdOf(prescription)}>
                    <Pill size={16} /><span><strong>{prescription.prescription_no || prescription.medication_name || 'Đơn thuốc'}</strong><small>{statusLabel(prescription.status)} · {formatDateTime(prescription.created_at)}</small></span>
                    <span className="dw2-command-actions">
                      {canActivatePrescription(prescription) ? <ActionButton onClick={() => activatePrescription(prescription)} tone="success">Kích hoạt đơn</ActionButton> : null}
                      {canCancelPrescription(prescription) ? <ActionButton onClick={() => cancelPrescription(prescription)}>Hủy đơn</ActionButton> : <StatusPill tone="success">{statusLabel(prescription.status)}</StatusPill>}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {currentView === 'problem-list' ? (
            <Panel title="Problem list" subtitle="Problem dài hạn theo patient, có thể liên kết encounter hiện tại.">
              <form className="dw2-command-form" onSubmit={createProblem}>
                <Field label="Tên vấn đề"><input value={problemForm.problem_name} onChange={(event) => setProblemForm((current) => ({ ...current, problem_name: event.target.value }))} /></Field>
                <Field label="Mức độ"><select value={problemForm.severity} onChange={(event) => setProblemForm((current) => ({ ...current, severity: event.target.value }))}><option value="unknown">Unknown</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></Field>
                <Field label="Ghi chú"><input value={problemForm.notes} onChange={(event) => setProblemForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
                <ActionButton type="submit" tone="success"><PlusCircle size={16} /> Thêm problem</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.clinicalSummary?.problems).length ? <EmptyState label="Chưa có problem active." /> : safeArray(workspace.clinicalSummary?.problems).map((problem) => (
                  <button type="button" key={problemIdOf(problem)}>
                    <ListChecks size={16} /><span><strong>{problem.problem_name || problem.name}</strong><small>{problem.severity || '--'} · {statusLabel(problem.status)}</small></span>
                    <ActionButton onClick={() => runAction(() => clinicalAPI.resolveProblem(problemIdOf(problem)), 'Đã đánh dấu vấn đề là đã xử lý.')}>Đã xử lý</ActionButton>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {currentView === 'care-plan' ? (
            <Panel title="Kế hoạch chăm sóc" subtitle="Tạo kế hoạch điều trị, dặn dò và lịch theo dõi thật trong hệ thống.">
              <form className="dw2-command-form" onSubmit={createCarePlan}>
                <Field label="Tiêu đề"><input value={carePlanForm.title} onChange={(event) => setCarePlanForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Mục tiêu"><input value={carePlanForm.goal} onChange={(event) => setCarePlanForm((current) => ({ ...current, goal: event.target.value }))} /></Field>
                <Field label="Can thiệp"><input value={carePlanForm.intervention} onChange={(event) => setCarePlanForm((current) => ({ ...current, intervention: event.target.value }))} /></Field>
                <ActionButton type="submit" tone="success"><PlusCircle size={16} /> Tạo kế hoạch</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.carePlans).length ? <EmptyState label="Chưa có kế hoạch chăm sóc." /> : safeArray(workspace.carePlans).map((plan) => (
                  <button type="button" key={carePlanIdOf(plan)}>
                    <ClipboardList size={16} /><span><strong>{plan.title || plan.plan_no}</strong><small>{statusLabel(plan.status)} · {safeArray(plan.goals).length} mục tiêu</small></span>
                    <span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => clinicalAPI.completeCarePlan(carePlanIdOf(plan)), 'Đã hoàn tất kế hoạch chăm sóc.')} tone="success">Hoàn tất</ActionButton><ActionButton onClick={() => runAction(() => clinicalAPI.cancelCarePlan(carePlanIdOf(plan), { reason: 'Hủy từ màn hình khám của bác sĩ' }), 'Đã hủy kế hoạch chăm sóc.')}>Hủy</ActionButton></span>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {currentView === 'consultation' ? (
            <Panel title="Hội chẩn" subtitle="Tạo và ký phiếu hội chẩn trong lượt khám.">
              <form className="dw2-command-form" onSubmit={createConsultation}>
                <Field label="Lý do / than phiền"><input value={consultForm.chief_complaint} onChange={(event) => setConsultForm((current) => ({ ...current, chief_complaint: event.target.value }))} /></Field>
                <Field label="Đánh giá"><input value={consultForm.assessment} onChange={(event) => setConsultForm((current) => ({ ...current, assessment: event.target.value }))} /></Field>
                <Field label="Kế hoạch"><input value={consultForm.plan} onChange={(event) => setConsultForm((current) => ({ ...current, plan: event.target.value }))} /></Field>
                <ActionButton type="submit" tone="success"><PlusCircle size={16} /> Tạo hội chẩn</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.consultations).length ? <EmptyState label="Chưa có hội chẩn." /> : safeArray(workspace.consultations).map((consultation) => (
                  <button type="button" key={consultationIdOf(consultation)}>
                    <Send size={16} /><span><strong>{consultation.consultation_no || consultation.chief_complaint || 'Hội chẩn'}</strong><small>{statusLabel(consultation.status)} · {consultation.assessment || '--'}</small></span>
                    <span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => clinicalAPI.startConsultation(consultationIdOf(consultation)), 'Đã bắt đầu hội chẩn.')}>Bắt đầu</ActionButton><ActionButton onClick={() => runAction(() => clinicalAPI.signConsultation(consultationIdOf(consultation)), 'Đã ký hội chẩn.')} tone="success">Ký</ActionButton></span>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {showCompletePanel ? (
            <Panel title="Hoàn tất lượt khám" subtitle="Tạo hồ sơ bệnh án, ký/chốt hồ sơ rồi gửi cho bệnh nhân.">
              <div className="dw2-focus-list">
                {readinessItems(readiness).map((check) => (
                  <div key={check.key}><CheckCircle2 size={16} /><span>{check.label}: {check.done ? 'Đạt' : 'Còn thiếu'}</span></div>
                ))}
                {encounterRecordId ? (
                  <div><FileText size={16} /><span>Hồ sơ bệnh án đã tạo: {encounterRecord.record_no || encounterRecord.title || encounterRecordId} · {statusLabel(encounterRecord.status)}</span></div>
                ) : (
                  <div><FileText size={16} /><span>Chưa tạo hồ sơ bệnh án cho lượt khám này.</span></div>
                )}
              </div>
              {(missingRequiredClinicalSteps || draftPrescriptions.length || activeBlockingOrders.length) ? (
                <div className="dw2-complete-blockers">
                  <div>
                    <strong>Cần xử lý trước</strong>
                    <small>Hoàn tất ghi chú, chẩn đoán và các mục đang mở trước khi chốt lượt khám.</small>
                  </div>
                  {!noteStepComplete ? (
                    <div className="dw2-command-row dw2-blocker-row">
                      <FileText size={16} />
                      <span><strong>Ghi chú lâm sàng</strong><small>Chưa ký</small></span>
                      <span className="dw2-command-actions">
                        <ActionButton onClick={() => setActiveExamAction('note')}>Mở ghi note</ActionButton>
                      </span>
                    </div>
                  ) : null}
                  {!diagnosisStepComplete ? (
                    <div className="dw2-command-row dw2-blocker-row">
                      <ClipboardCheck size={16} />
                      <span><strong>Chẩn đoán chính</strong><small>Chưa có chẩn đoán chính active</small></span>
                      <span className="dw2-command-actions">
                        <ActionButton onClick={() => setActiveExamAction('diagnosis')}>Mở chẩn đoán</ActionButton>
                      </span>
                    </div>
                  ) : null}
                  {draftPrescriptions.length ? draftPrescriptions.map((prescription) => (
                    <div className="dw2-command-row dw2-blocker-row" key={prescriptionIdOf(prescription)}>
                      <Pill size={16} />
                      <span><strong>{prescription.prescription_no || 'Đơn thuốc'}</strong><small>Bản nháp</small></span>
                      <span className="dw2-command-actions">
                        <ActionButton onClick={() => activatePrescription(prescription)} tone="success">Kích hoạt</ActionButton>
                        <ActionButton onClick={() => cancelPrescription(prescription)}>Hủy</ActionButton>
                      </span>
                    </div>
                  )) : null}
                  {activeBlockingOrders.length ? activeBlockingOrders.map((order) => (
                    <div className="dw2-command-row dw2-blocker-row" key={orderIdOf(order)}>
                      <ClipboardList size={16} />
                      <span><strong>{order.title || order.order_name || order.order_type || 'Chỉ định'}</strong><small>{statusLabel(order.status)}</small></span>
                      <span className="dw2-command-actions">
                        <ActionButton onClick={() => cancelOrder(order)}>Hủy</ActionButton>
                      </span>
                    </div>
                  )) : null}
                  {!encounterCompleted ? (
                    <div className="dw2-complete-blockers__hint">
                      Hết mục chặn thì bấm <strong>Hoàn tất lượt khám</strong>, sau đó <strong>Ký/chốt hồ sơ</strong>.
                    </div>
                  ) : null}
                </div>
              ) : null}
              {encounterRecordId ? <MedicalRecordPreview record={encounterRecord} workspace={workspace} /> : null}
              <div className="dw2-command-actions is-wide">
                <ActionButton
                  onClick={() => runAction(
                    () => recordsAPI.createMedicalRecordFromEncounter(selectedEncounterId, { title: `Hồ sơ ${encounter?.encounter_code || ''}` }),
                    'Đã tạo hồ sơ bệnh án. Hồ sơ vẫn ở màn hình này để bác sĩ ký/chốt và gửi cho bệnh nhân.',
                  )}
                  disabled={Boolean(encounterRecordId)}
                >
                  <FileText size={16} /> {encounterRecordId ? 'Đã tạo hồ sơ bệnh án' : 'Tạo hồ sơ bệnh án'}
                </ActionButton>
                <ActionButton
                  onClick={() => runAction(completeCurrentEncounter, 'Đã hoàn tất lượt khám. Bây giờ có thể ký/chốt hồ sơ bệnh án.')}
                  disabled={!canCompleteNow || encounterCompleted}
                  tone="success"
                >
                  <CheckCircle2 size={16} /> {encounterCompleted ? 'Đã hoàn tất lượt khám' : 'Hoàn tất lượt khám'}
                </ActionButton>
                {encounterRecordId ? <ActionButton disabled={!canCompleteNow && !encounterCompleted} onClick={() => runAction(finalizeCurrentMedicalRecord, 'Đã ký/chốt hồ sơ bệnh án.')}>Ký/chốt hồ sơ</ActionButton> : null}
                {encounterRecordId ? <ActionButton disabled={!canCompleteNow && !encounterCompleted} onClick={() => runAction(releaseCurrentMedicalRecord, 'Đã gửi hồ sơ bệnh án cho bệnh nhân.')} tone="success">Gửi cho bệnh nhân</ActionButton> : null}
              </div>
            </Panel>
          ) : null}

          {currentView === 'vitals' ? (
            <Panel title="Sinh hiệu encounter" subtitle="Ghi sinh hiệu mới bằng /api/clinical/vital-signs.">
              <form className="dw2-command-form" onSubmit={createVitals}>
                {Object.keys(vitalForm).map((key) => <Field key={key} label={key}><input type="number" value={vitalForm[key]} onChange={(event) => setVitalForm((current) => ({ ...current, [key]: event.target.value }))} /></Field>)}
                <ActionButton type="submit" tone="success"><HeartPulse size={16} /> Ghi sinh hiệu</ActionButton>
              </form>
            </Panel>
          ) : null}
        </div>
        <aside className="dw2-encounter-shell__side">
          <Panel title="Tóm tắt lượt khám" subtitle={loading ? 'Đang tải...' : 'Tổng quan nhanh về lượt khám hiện tại.'}>
            {!encounter ? <EmptyState label="Chọn encounter để xem chi tiết." /> : (
              <div className="dw2-encounter-summary">
                <EncounterSummaryRow icon={UserRound} label="Bệnh nhân">{patientName(encounter)}</EncounterSummaryRow>
                <EncounterSummaryRow icon={UsersRound} label="Tuổi / Giới">{patientAgeGender}</EncounterSummaryRow>
                <EncounterSummaryRow icon={Stethoscope} label="Bác sĩ điều trị">{doctorName(encounter)}</EncounterSummaryRow>
                <EncounterSummaryRow icon={ShieldCheck} label="Khoa">{departmentName(encounter)}</EncounterSummaryRow>
                <EncounterSummaryRow icon={CalendarDays} label="Bắt đầu lúc">{formatDateTime(encounter.start_time || encounter.started_at || encounter.created_at)}</EncounterSummaryRow>
                <EncounterSummaryRow icon={ClipboardList} label="Nguồn">{encounter.source || encounter.encounter_source || 'Khám trực tiếp / Hàng đợi'}</EncounterSummaryRow>
                <EncounterSummaryRow icon={FileText} label="Mã lượt khám">{encounter.encounter_code || selectedEncounterId}</EncounterSummaryRow>
                <button type="button" className="dw2-encounter-link-button" onClick={() => onNavigate?.(`/doctor/encounters?view=active&encounterId=${selectedEncounterId}`)}>Xem chi tiết thông tin</button>
              </div>
            )}
          </Panel>
          <Panel title="Việc cần hoàn tất" subtitle="Các hạng mục cần hoàn thành trước khi đóng encounter.">
            <div className="dw2-encounter-checklist">
              {visibleChecklistRows.map((check) => (
                <EncounterChecklistRow key={check.key} icon={check.icon} label={check.label} done={check.done} />
              ))}
              <button type="button" className="dw2-encounter-link-button">Xem chi tiết danh sách cần hoàn tất</button>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

export function DoctorClinicalRecordsPage({ item, overview, onNavigate, onRefresh }) {
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(patientIdOf(safeArray(overview.active_encounters)[0] || safeArray(overview.queue)[0] || {}))
  const [patient360, setPatient360] = useState({ summary: null, timeline: [], records: [], attachments: [], documentTimeline: [] })
  const [vitals, setVitals] = useState([])
  const [authorizations, setAuthorizations] = useState([])
  const [notice, setNotice] = useState({ error: '', success: '' })
  const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction: '', severity: 'unknown', allergy_type: 'unknown' })
  const [problemForm, setProblemForm] = useState({ problem_name: '', severity: 'unknown', notes: '' })

  const viewKey = item?.key || 'patient-summary'

  useEffect(() => {
    let cancelled = false
    async function loadSearch() {
      if (!query.trim()) {
        setPatients([])
        return
      }
      try {
        const response = await patientAPI.search({ q: query.trim(), limit: 20 })
        if (!cancelled) setPatients(safeArray(dataOf(response, [])))
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tìm được bệnh nhân.'), success: '' })
      }
    }
    const timer = window.setTimeout(loadSearch, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    let cancelled = false
    if (!selectedPatientId) return undefined
    async function load() {
      try {
        const [summaryData, vitalData, authData] = await Promise.allSettled([
          loadPatient360(selectedPatientId),
          clinicalAPI.listPatientVitalSigns(selectedPatientId, { limit: 40 }),
          patientAPI.authorizations(selectedPatientId, { limit: 40 }),
        ])
        if (!cancelled) {
          setPatient360(summaryData.status === 'fulfilled' ? summaryData.value : { summary: null, timeline: [], records: [], attachments: [], documentTimeline: [] })
          setVitals(vitalData.status === 'fulfilled' ? safeArray(dataOf(vitalData.value, [])) : [])
          setAuthorizations(authData.status === 'fulfilled' ? safeArray(dataOf(authData.value, [])) : [])
        }
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tải được hồ sơ lâm sàng.'), success: '' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedPatientId])

  async function runAction(action, successMessage) {
    try {
      setNotice({ error: '', success: '' })
      await action()
      if (selectedPatientId) setPatient360(await loadPatient360(selectedPatientId))
      setNotice({ error: '', success: successMessage })
      onRefresh?.()
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Thao tác không thành công.'), success: '' })
    }
  }

  async function createAllergy(event) {
    event.preventDefault()
    if (!selectedPatientId || !allergyForm.allergen.trim()) return
    await runAction(() => clinicalAPI.createPatientAllergy(selectedPatientId, allergyForm), 'Đã thêm dị ứng.')
    setAllergyForm({ allergen: '', reaction: '', severity: 'unknown', allergy_type: 'unknown' })
  }

  async function createProblem(event) {
    event.preventDefault()
    if (!selectedPatientId || !problemForm.problem_name.trim()) return
    await runAction(() => clinicalAPI.createPatientProblem(selectedPatientId, problemForm), 'Đã thêm problem.')
    setProblemForm({ problem_name: '', severity: 'unknown', notes: '' })
  }

  const records = safeArray(patient360.records)
  const attachments = safeArray(patient360.attachments)
  const summary = patient360.summary
  const released = [...records, ...attachments].filter(isReleased)

  return (
    <div className="dw2-command-page">
      <KpiStrip items={[
        { label: 'Alerts', value: safeArray(summary?.alerts).length, hint: 'Clinical alerts', tone: safeArray(summary?.alerts).length ? 'critical' : 'success' },
        { label: 'Allergy', value: safeArray(summary?.allergies).length, hint: 'Dị ứng active', tone: 'warning' },
        { label: 'Medical records', value: records.length, hint: 'Hồ sơ bệnh án', tone: 'neutral' },
        { label: 'Released', value: released.length, hint: 'Đã release portal', tone: 'success' },
      ]} />
      <CommandNotice error={notice.error} success={notice.success} />
      <div className="dw2-command-toolbar">
        <div className="dw2-command-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bệnh nhân theo tên, mã BN, SĐT..." /></div>
        <ActionButton onClick={() => selectedPatientId && onNavigate(`/doctor/patients?view=history&patientId=${selectedPatientId}`)}><UserRound size={16} /> Mở lịch sử</ActionButton>
      </div>
      {patients.length ? (
        <div className="dw2-command-patient-results">
          {patients.map((patient) => <button type="button" key={patientIdOf(patient)} onClick={() => setSelectedPatientId(patientIdOf(patient))}>{patientName(patient)} <small>{patientCode(patient)}</small></button>)}
        </div>
      ) : null}
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          {viewKey === 'patient-summary' ? <PatientClinical360 {...patient360} onNavigate={onNavigate} /> : null}

          {viewKey === 'history-allergy' ? (
            <div className="dw2-two-panels">
              <Panel title="Dị ứng" subtitle="CRUD qua /api/clinical/patients/:patientId/allergies">
                <form className="dw2-command-form" onSubmit={createAllergy}>
                  <Field label="Dị nguyên"><input value={allergyForm.allergen} onChange={(event) => setAllergyForm((current) => ({ ...current, allergen: event.target.value }))} /></Field>
                  <Field label="Phản ứng"><input value={allergyForm.reaction} onChange={(event) => setAllergyForm((current) => ({ ...current, reaction: event.target.value }))} /></Field>
                  <Field label="Mức độ"><select value={allergyForm.severity} onChange={(event) => setAllergyForm((current) => ({ ...current, severity: event.target.value }))}><option value="unknown">Chưa rõ</option><option value="mild">Nhẹ</option><option value="moderate">Trung bình</option><option value="severe">Nặng</option></select></Field>
                  <ActionButton type="submit" tone="success">Thêm dị ứng</ActionButton>
                </form>
                <div className="dw2-compact-list">{safeArray(summary?.allergies).map((allergy) => <button type="button" key={allergyIdOf(allergy)}><AlertTriangle size={16} /><span><strong>{allergy.allergen || allergy.allergen_name}</strong><small>{allergy.reaction || '--'} · {statusLabel(allergy.severity)}</small></span><ActionButton onClick={() => runAction(() => clinicalAPI.resolveAllergy(allergyIdOf(allergy)), 'Đã đánh dấu dị ứng là đã xử lý.')}>Đã xử lý</ActionButton></button>)}</div>
              </Panel>
              <Panel title="Danh sách vấn đề" subtitle="Quản lý vấn đề sức khỏe của bệnh nhân.">
                <form className="dw2-command-form" onSubmit={createProblem}>
                  <Field label="Vấn đề"><input value={problemForm.problem_name} onChange={(event) => setProblemForm((current) => ({ ...current, problem_name: event.target.value }))} /></Field>
                  <Field label="Ghi chú"><input value={problemForm.notes} onChange={(event) => setProblemForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
                  <ActionButton type="submit" tone="success">Thêm vấn đề</ActionButton>
                </form>
                <div className="dw2-compact-list">{safeArray(summary?.problems).map((problem) => <button type="button" key={problemIdOf(problem)}><ListChecks size={16} /><span><strong>{problem.problem_name || problem.name}</strong><small>{statusLabel(problem.severity) || '--'} · {statusLabel(problem.status)}</small></span><ActionButton onClick={() => runAction(() => clinicalAPI.resolveProblem(problemIdOf(problem)), 'Đã đánh dấu vấn đề là đã xử lý.')}>Đã xử lý</ActionButton></button>)}</div>
              </Panel>
            </div>
          ) : null}

          {viewKey === 'vitals' ? (
            <Panel title="Sinh hiệu" subtitle="Danh sách và trend sinh hiệu từ clinical endpoints.">
              <div className="dw2-command-table">
                <div className="dw2-command-row is-head"><span>Thời điểm</span><span>HA</span><span>Mạch</span><span>SpO2</span><span>BMI</span></div>
                {!vitals.length ? <EmptyState label="Chưa có sinh hiệu." /> : vitals.map((vital) => <div className="dw2-command-row" key={idOf(vital, ['vital_sign_id', 'id', '_id'])}><span>{formatDateTime(vital.recorded_at)}</span><span>{vital.systolic_bp || '--'}/{vital.diastolic_bp || '--'}</span><span>{vital.heart_rate || '--'}</span><span>{vital.spo2 || '--'}%</span><span>{vital.bmi || '--'}</span></div>)}
              </div>
            </Panel>
          ) : null}

          {viewKey === 'medical-records' ? (
            <Panel title="Hồ sơ bệnh án" subtitle="Finalize, seal, archive, void và release tác động trực tiếp database.">
              <div className="dw2-command-table">
                <div className="dw2-command-row is-head"><span>Hồ sơ</span><span>Loại</span><span>Trạng thái</span><span>Release</span><span>Thao tác</span></div>
                {!records.length ? <EmptyState label="Chưa có medical record." /> : records.map((record) => <div className="dw2-command-row" key={recordIdOf(record)}><span>{record.record_no || record.title}</span><span>{record.record_type}</span><span>{statusLabel(record.status)}</span><span>{isReleased(record) ? 'Đã release' : 'Chưa release'}</span><span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => recordsAPI.finalizeMedicalRecord(recordIdOf(record)), 'Đã finalize hồ sơ.')}>Finalize</ActionButton><ActionButton onClick={() => runAction(() => recordsAPI.sealMedicalRecord(recordIdOf(record)), 'Đã seal hồ sơ.')}>Seal</ActionButton><ActionButton onClick={() => runAction(() => recordsAPI.releaseMedicalRecordToPatient(recordIdOf(record)), 'Đã release hồ sơ.')} tone="success">Release</ActionButton></span></div>)}
              </div>
            </Panel>
          ) : null}

          {viewKey === 'attachments' ? (
            <Panel title="Tài liệu đính kèm" subtitle="Release, revoke, archive, restore và download metadata dùng records API.">
              <div className="dw2-command-table">
                <div className="dw2-command-row is-head"><span>File</span><span>Entity</span><span>Scan</span><span>Release</span><span>Thao tác</span></div>
                {!attachments.length ? <EmptyState label="Chưa có attachment." /> : attachments.map((attachment) => <div className="dw2-command-row" key={attachmentIdOf(attachment)}><span>{attachment.file_name || attachment.title}</span><span>{attachment.entity_type || '--'}</span><span>{attachment.scan_status || '--'}</span><span>{isReleased(attachment) ? 'Đã release' : 'Chưa release'}</span><span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => recordsAPI.releaseAttachmentToPatient(attachmentIdOf(attachment)), 'Đã release attachment.')} tone="success">Release</ActionButton><ActionButton onClick={() => runAction(() => recordsAPI.revokeAttachmentRelease(attachmentIdOf(attachment), { reason: 'Revoked from doctor workspace' }), 'Đã revoke release.')}>Revoke</ActionButton><ActionButton onClick={() => runAction(() => recordsAPI.archiveAttachment(attachmentIdOf(attachment), { reason: 'Archived from doctor workspace' }), 'Đã archive attachment.')}>Archive</ActionButton></span></div>)}
              </div>
            </Panel>
          ) : null}

          {viewKey === 'consent-access' ? (
            <div className="dw2-two-panels">
              <Panel title="Consent records" subtitle="Đọc từ doctor patient summary.">
                <div className="dw2-compact-list">{!safeArray(summary?.consents).length ? <EmptyState label="Chưa có consent." /> : safeArray(summary?.consents).map((consent, index) => <button type="button" key={idOf(consent, ['consent_id', 'id', '_id']) || index}><ShieldCheck size={16} /><span><strong>{consent.consent_type || consent.scope || 'Consent'}</strong><small>{statusLabel(consent.status)} · {formatDate(consent.valid_to || consent.expires_at)}</small></span></button>)}</div>
              </Panel>
              <Panel title="Ủy quyền người thân" subtitle="Đọc từ /api/patients/:patientId/authorizations.">
                <div className="dw2-compact-list">{!authorizations.length ? <EmptyState label="Chưa có authorization." /> : authorizations.map((auth, index) => <button type="button" key={idOf(auth, ['authorization_id', 'id', '_id']) || index}><UsersRound size={16} /><span><strong>{auth.scope || auth.authorization_type || 'Authorization'}</strong><small>{statusLabel(auth.status)} · {formatDate(auth.valid_to || auth.expires_at)}</small></span></button>)}</div>
              </Panel>
            </div>
          ) : null}

          {viewKey === 'released-records' ? (
            <Panel title="Hồ sơ đã release" subtitle="Lọc từ medical records và attachments đã release cho portal.">
              <div className="dw2-command-table">
                <div className="dw2-command-row is-head"><span>Tên</span><span>Loại</span><span>Release lúc</span><span>Trạng thái</span><span>Thao tác</span></div>
                {!released.length ? <EmptyState label="Chưa có hồ sơ/tài liệu đã release." /> : released.map((item, index) => <div className="dw2-command-row" key={`${recordIdOf(item) || attachmentIdOf(item)}-${index}`}><span>{item.record_no || item.file_name || item.title}</span><span>{item.record_type || item.entity_type || 'attachment'}</span><span>{formatDateTime(item.released_at)}</span><span>{statusLabel(item.status)}</span><span className="dw2-command-actions">{attachmentIdOf(item) ? <ActionButton onClick={() => runAction(() => recordsAPI.revokeAttachmentRelease(attachmentIdOf(item), { reason: 'Revoked from released records view' }), 'Đã revoke release attachment.')}>Revoke</ActionButton> : null}</span></div>)}
              </div>
            </Panel>
          ) : null}
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Bệnh nhân đang chọn" subtitle="Clinical context dùng chung cho nhóm Hồ sơ lâm sàng.">
            <PatientClinical360 {...patient360} onNavigate={onNavigate} />
          </Panel>
          <Panel title="Realtime/event cần nghe" subtitle="UI đã sẵn sàng nhận update row-level khi backend publish.">
            <div className="dw2-focus-list">
              <div><Bell size={16} /><span>vital_sign.recorded, medical_record.finalized, attachment.released</span></div>
              <div><RefreshCw size={16} /><span>Hiện refresh thủ công sau mỗi mutation để phản ánh database.</span></div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
