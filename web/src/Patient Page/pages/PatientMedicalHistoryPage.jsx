import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const sampleEncounters = [
  {
    encounter_id: 'sample-visit-1',
    encounter_code: 'VIS-20260425-001',
    start_time: '2026-04-25T09:30:00+07:00',
    end_time: '2026-04-25T10:10:00+07:00',
    status: 'completed',
    doctor_name: 'BS. Nguyễn Văn A',
    department_name: 'Tim mạch',
    encounter_type: 'outpatient',
    chief_reason: 'Khám tim mạch định kỳ',
    location: 'Bệnh viện Đa khoa Quốc tế',
    diagnosis: 'Tăng huyết áp độ 1',
    clinical_notes:
      'Kiểm soát chế độ ăn uống, tập thể dục đều đặn. Theo dõi huyết áp tại nhà và tái khám sau 3 tháng.',
  },
  {
    encounter_id: 'sample-visit-2',
    encounter_code: 'VIS-20260310-002',
    start_time: '2026-03-10T08:00:00+07:00',
    end_time: '2026-03-10T08:40:00+07:00',
    status: 'completed',
    doctor_name: 'BS. Trần Thị B',
    department_name: 'Xét nghiệm',
    encounter_type: 'outpatient',
    chief_reason: 'Xét nghiệm tổng quát',
    location: 'Phòng khám CarePlus',
    diagnosis: 'Chỉ số sinh hóa trong giới hạn theo dõi',
    clinical_notes:
      'Cholesterol hơi cao, ưu tiên giảm đồ chiên rán và tăng vận động nhẹ mỗi ngày.',
  },
  {
    encounter_id: 'sample-visit-3',
    encounter_code: 'VIS-20260222-003',
    start_time: '2026-02-22T10:00:00+07:00',
    end_time: '2026-02-22T10:35:00+07:00',
    status: 'completed',
    doctor_name: 'BS. Lê Minh Tâm',
    department_name: 'Hô hấp',
    encounter_type: 'outpatient',
    chief_reason: 'Khám hô hấp',
    location: 'Bệnh viện Đa khoa Quốc tế',
    diagnosis: 'Viêm phế quản nhẹ',
    clinical_notes:
      'Uống đủ nước, tránh khói bụi và theo dõi ho kéo dài. Tái khám nếu khó thở hoặc sốt.',
  },
  {
    encounter_id: 'sample-visit-4',
    encounter_code: 'VIS-20260105-004',
    start_time: '2026-01-05T14:30:00+07:00',
    end_time: '2026-01-05T15:05:00+07:00',
    status: 'completed',
    doctor_name: 'BS. Phạm Thị Lan',
    department_name: 'Tiêu hóa',
    encounter_type: 'outpatient',
    chief_reason: 'Khám tiêu hoá',
    location: 'Phòng khám CarePlus',
    diagnosis: 'Rối loạn tiêu hóa chức năng',
    clinical_notes:
      'Ăn đúng bữa, hạn chế thức ăn cay nóng. Có thể bổ sung men vi sinh theo hướng dẫn.',
  },
  {
    encounter_id: 'sample-visit-5',
    encounter_code: 'VIS-20251212-005',
    start_time: '2025-12-12T09:15:00+07:00',
    end_time: '2025-12-12T09:40:00+07:00',
    status: 'cancelled',
    doctor_name: 'BS. Đỗ Quang Minh',
    department_name: 'Thần kinh',
    encounter_type: 'outpatient',
    chief_reason: 'Khám thần kinh',
    location: 'Bệnh viện Đa khoa Quốc tế',
    diagnosis: 'Lịch khám đã hủy',
    clinical_notes:
      'Bệnh nhân đã hủy lịch trước giờ khám. Chưa phát sinh ghi chú chuyên môn.',
  },
]

const samplePrescriptions = [
  {
    prescription_id: 'sample-rx-1',
    prescription_no: 'RX-20260425',
    prescribed_at: '2026-04-25T10:00:00+07:00',
    status: 'active',
    items: [
      {
        prescription_item_id: 'sample-rx-1-1',
        medication_name: 'Amlodipine 5mg',
        dose: 'Sáng 1 viên',
        frequency: '1 lần/ngày',
        route: 'oral',
        duration_days: 30,
        quantity: 30,
      },
      {
        prescription_item_id: 'sample-rx-1-2',
        medication_name: 'Aspirin 81mg',
        dose: 'Sáng 1 viên sau ăn',
        frequency: '1 lần/ngày',
        route: 'oral',
        duration_days: 30,
        quantity: 30,
      },
      {
        prescription_item_id: 'sample-rx-1-3',
        medication_name: 'Atorvastatin 10mg',
        dose: 'Tối 1 viên',
        frequency: '1 lần/ngày',
        route: 'oral',
        duration_days: 30,
        quantity: 30,
      },
    ],
  },
]

function formatVisitDate(value) {
  if (!value) {
    return 'Chưa có ngày'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có ngày'
  }

  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date)
}

function formatVisitTime(value) {
  if (!value) {
    return 'Chưa có giờ'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có giờ'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getVisitDateParts(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return {
      day: '--',
      month: 'TH --',
      year: '',
      time: 'Chưa có giờ',
      full: 'Chưa có ngày',
    }
  }

  return {
    day: new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(date),
    month: `TH ${new Intl.DateTimeFormat('vi-VN', { month: 'numeric' }).format(date)}`,
    year: new Intl.DateTimeFormat('vi-VN', { year: 'numeric' }).format(date),
    time: formatVisitTime(value),
    full: formatVisitDate(value),
  }
}

function getEncounterStatusMeta(status) {
  const map = {
    planned: { label: 'Đã lên kế hoạch', tone: 'pending' },
    arrived: { label: 'Đã đến', tone: 'pending' },
    in_progress: { label: 'Đang khám', tone: 'pending' },
    on_hold: { label: 'Tạm dừng', tone: 'pending' },
    completed: { label: 'Đã hoàn thành', tone: 'completed' },
    cancelled: { label: 'Đã hủy', tone: 'cancelled' },
    booked: { label: 'Đã đặt lịch', tone: 'pending' },
    confirmed: { label: 'Đã xác nhận', tone: 'pending' },
    checked_in: { label: 'Đã check-in', tone: 'pending' },
    in_consultation: { label: 'Đang khám', tone: 'pending' },
    no_show: { label: 'Vắng mặt', tone: 'cancelled' },
    rescheduled: { label: 'Đã dời lịch', tone: 'pending' },
  }

  return map[status] || { label: status || 'Chưa xác định', tone: 'pending' }
}

function getPrescriptionStatusLabel(status) {
  const map = {
    draft: 'Nháp',
    active: 'Đang hiệu lực',
    verified: 'Đã duyệt',
    partially_dispensed: 'Cấp phần',
    fully_dispensed: 'Đã cấp đủ',
    cancelled: 'Đã hủy',
    completed: 'Hoàn tất',
  }

  return map[status] || status || 'Chưa cập nhật'
}

function getRouteLabel(route) {
  const map = {
    oral: 'Uống',
    iv: 'Tiêm tĩnh mạch',
    im: 'Tiêm bắp',
    sc: 'Tiêm dưới da',
    topical: 'Bôi ngoài da',
    inhalation: 'Hít',
  }

  return map[String(route || '').toLowerCase()] || route || ''
}

function getVisitVisual(specialty = '') {
  const lower = specialty.toLowerCase()

  if (lower.includes('tim')) {
    return { icon: 'favorite', tone: 'heart' }
  }

  if (lower.includes('xét') || lower.includes('lab')) {
    return { icon: 'experiment', tone: 'lab' }
  }

  if (lower.includes('hô') || lower.includes('phổi')) {
    return { icon: 'pulmonology', tone: 'lung' }
  }

  if (lower.includes('tiêu') || lower.includes('dạ')) {
    return { icon: 'gastroenterology', tone: 'digest' }
  }

  if (lower.includes('thần')) {
    return { icon: 'psychology', tone: 'neuro' }
  }

  return { icon: 'medical_services', tone: 'default' }
}

function buildStableRating(seed) {
  const text = String(seed || 'doctor')
  const hash = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0)

  return {
    rating: (4.6 + (hash % 4) / 10).toFixed(1),
    reviews: 48 + (hash % 81),
  }
}

function mapApiEncounter(encounter, index) {
  const id = encounter.encounter_id || encounter._id || `${encounter.start_time}-${index}`
  const status = getEncounterStatusMeta(encounter.status)
  const typeKey = normalizeTypeKey(encounter.encounter_type)
  const specialty =
    encounter.department_name ||
    (encounter.encounter_type === 'emergency' ? 'Cấp cứu' : 'Khám ngoại trú')
  const visual = getVisitVisual(specialty)
  const date = getVisitDateParts(encounter.start_time)
  const doctor =
    encounter.doctor_name ||
    `Bác sĩ ${String(encounter.attending_doctor_id || '').slice(-6)}`
  const rating = buildStableRating(doctor)

  return {
    id,
    latest: index === 0,
    day: date.day,
    month: date.month,
    year: date.year,
    time: date.time,
    date: date.full,
    rawDate: encounter.start_time || '',
    doctor,
    specialty,
    typeKey,
    typeLabel: getVisitTypeLabel(typeKey),
    status: status.label,
    statusTone: status.tone,
    title:
      encounter.chief_reason ||
      (specialty.toLowerCase().includes('xét') ? 'Xét nghiệm tổng quát' : `Khám ${specialty.toLowerCase()}`),
    location: encounter.location || encounter.facility_name || 'Bệnh viện Đa khoa Quốc tế',
    reason: encounter.chief_reason || 'Kiểm tra định kỳ',
    diagnosis:
      encounter.diagnosis ||
      (encounter.status === 'completed' ? 'Đã hoàn tất thăm khám' : 'Đang cập nhật chẩn đoán'),
    notes:
      encounter.clinical_notes ||
      (encounter.status === 'completed'
        ? 'Kiểm soát chế độ ăn uống, tập thể dục đều đặn. Tái khám theo lịch hẹn.'
        : 'Thông tin chi tiết sẽ được cập nhật sau khi bác sĩ hoàn tất hồ sơ.'),
    recordId: encounter.encounter_code || id,
    icon: visual.icon,
    tone: visual.tone,
    rating: rating.rating,
    reviews: rating.reviews,
    hasReleasedRecord: Boolean(encounter.medical_record_id || encounter.released_record_id),
    hasResults: Boolean(encounter.has_results || encounter.lab_result_id || encounter.imaging_report_id),
    hasPrescription: Boolean(encounter.has_prescription || encounter.prescription_id),
    hasInvoice: Boolean(encounter.has_invoice || encounter.invoice_id),
    relatedCounts: {
      records: encounter.medical_record_id || encounter.released_record_id ? 1 : 0,
      results: Number(Boolean(encounter.has_results || encounter.lab_result_id || encounter.imaging_report_id)),
      prescriptions: Number(Boolean(encounter.has_prescription || encounter.prescription_id)),
      invoices: Number(Boolean(encounter.has_invoice || encounter.invoice_id)),
    },
    relatedRecords: [],
    relatedResults: [],
    relatedPrescriptions: [],
    relatedInvoices: [],
  }
}

function mapPrescriptionRows(prescriptions = []) {
  return prescriptions.flatMap((prescription) => {
    const header = [
      prescription.prescription_no ? `Đơn ${prescription.prescription_no}` : '',
      prescription.prescribed_at ? formatVisitDate(prescription.prescribed_at) : '',
      getPrescriptionStatusLabel(prescription.status),
    ]
      .filter(Boolean)
      .join(' • ')

    if (!prescription.items?.length) {
      return [
        {
          id: prescription.prescription_id,
          medication: header || 'Đơn thuốc',
          dosage: 'Chưa có chi tiết',
          usage:
            prescription.note ||
            'Backend chưa trả ra danh sách thuốc trong đơn này.',
          quantity: '-',
        },
      ]
    }

    return prescription.items.map((item) => ({
      id:
        item.prescription_item_id ||
        `${prescription.prescription_id}-${item.medication_name}`,
      medication: item.medication_name || 'Thuốc chưa định danh',
      dosage:
        [item.dose, item.frequency].filter(Boolean).join(' • ') ||
        'Theo chỉ định',
      usage: [
        item.instructions,
        item.route ? `Đường dùng: ${getRouteLabel(item.route)}` : '',
        item.duration_days ? `Số ngày: ${item.duration_days}` : '',
        header,
      ]
        .filter(Boolean)
        .join(' • '),
      quantity: item.quantity ?? '-',
    }))
  })
}

function mapLabResultRows(labResults = []) {
  return labResults.map((result, index) => ({
    id: result.lab_result_id || result._id || `${result.reported_at}-${index}`,
    title:
      result.result_no ||
      result.lab_result_no ||
      result.test_name ||
      'Kết quả xét nghiệm',
    value:
      result.summary ||
      result.status ||
      (result.reported_at ? formatVisitDate(result.reported_at) : 'Đã release cho bệnh nhân'),
  }))
}

function formatRecordTitle(record = {}, index = 0) {
  return (
    record.title ||
    record.record_title ||
    record.record_name ||
    record.document_title ||
    record.summary ||
    record.chief_complaint ||
    record.diagnosis ||
    `Hồ sơ bệnh án ${index + 1}`
  )
}

function formatRecordDate(record = {}) {
  return formatVisitDate(
    record.recorded_at ||
      record.updated_at ||
      record.created_at ||
      record.visit_date ||
      record.encounter_date ||
      record.start_time,
  )
}

function formatRecordType(record = {}) {
  const type = String(record.record_type || record.type || record.category || '').toLowerCase()

  if (type.includes('diagnosis') || type.includes('chẩn')) {
    return 'Chẩn đoán'
  }

  if (type.includes('lab') || type.includes('xét')) {
    return 'Xét nghiệm'
  }

  if (type.includes('prescription') || type.includes('thuốc')) {
    return 'Đơn thuốc'
  }

  if (type.includes('imaging') || type.includes('image') || type.includes('hình')) {
    return 'Chẩn đoán hình ảnh'
  }

  return 'Bệnh án'
}

function mapMedicalRecordRows(records = [], visits = []) {
  if (records.length) {
    return records.map((record, index) => ({
      id: record.medical_record_id || record.record_id || record._id || record.id || `record-${index}`,
      title: formatRecordTitle(record, index),
      type: formatRecordType(record),
      date: formatRecordDate(record),
      doctor: record.doctor_name || record.created_by_name || record.attending_doctor_name || 'Đang cập nhật',
      note:
        record.clinical_notes ||
        record.notes ||
        record.description ||
        record.diagnosis ||
        record.summary ||
        'Hồ sơ y tế đã được lưu trong hệ thống.',
    }))
  }

  return visits.slice(0, 4).map((visit, index) => ({
    id: `visit-record-${visit.id || index}`,
    title: visit.diagnosis || visit.title,
    type: 'Từ lần khám',
    date: visit.date,
    doctor: visit.doctor,
    note: visit.notes || visit.reason || 'Thông tin bệnh án được tổng hợp từ lịch sử khám.',
  }))
}

function getDoctorAvatar(seed) {
  const avatars = [
    'https://randomuser.me/api/portraits/men/32.jpg',
    'https://randomuser.me/api/portraits/women/44.jpg',
    'https://randomuser.me/api/portraits/men/46.jpg',
    'https://randomuser.me/api/portraits/women/65.jpg',
  ]
  const hash = [...String(seed || 'doctor')].reduce((sum, char) => sum + char.charCodeAt(0), 0)

  return avatars[hash % avatars.length]
}

function getRatingLabel(rating) {
  const labels = {
    1: 'Cần cải thiện',
    2: 'Chưa hài lòng',
    3: 'Tạm ổn',
    4: 'Tốt',
    5: 'Tuyệt vời!',
  }

  return labels[rating] || 'Chọn đánh giá'
}

const visitTabs = [
  { id: 'all', label: 'Tất cả' },
  { id: 'outpatient', label: 'Khám ngoại trú' },
  { id: 'inpatient', label: 'Nội trú' },
  { id: 'emergency', label: 'Cấp cứu' },
  { id: 'procedure', label: 'Thủ thuật' },
  { id: 'follow_up', label: 'Tái khám' },
  { id: 'released', label: 'Có hồ sơ đã phát hành' },
]

function normalizeTypeKey(value = '') {
  const type = String(value || '').toLowerCase()
  if (type.includes('inpatient') || type.includes('nội')) return 'inpatient'
  if (type.includes('emergency') || type.includes('cấp')) return 'emergency'
  if (type.includes('procedure') || type.includes('thủ')) return 'procedure'
  if (type.includes('follow') || type.includes('tái')) return 'follow_up'
  return 'outpatient'
}

function getVisitTypeLabel(typeKey) {
  const map = {
    outpatient: 'Khám ngoại trú',
    inpatient: 'Nội trú',
    emergency: 'Cấp cứu',
    procedure: 'Thủ thuật',
    follow_up: 'Tái khám',
  }

  return map[typeKey] || 'Khám ngoại trú'
}

function getDiagnosisText(diagnosis) {
  if (!diagnosis) return ''

  if (typeof diagnosis !== 'object') {
    return String(diagnosis)
  }

  return (
    diagnosis.diagnosis_name ||
    diagnosis.name ||
    diagnosis.description ||
    diagnosis.code ||
    diagnosis.icd_code ||
    ''
  )
}

function mapRelatedResultRows(items = [], typeLabel = 'Kết quả') {
  return items.map((item, index) => ({
    id: item.lab_result_id || item.imaging_report_id || item.procedure_result_id || item._id || `${typeLabel}-${index}`,
    title:
      item.result_no ||
      item.report_no ||
      item.procedure_result_no ||
      item.test_name ||
      item.study_name ||
      item.procedure_name ||
      typeLabel,
    value:
      item.summary ||
      item.impression ||
      item.findings ||
      item.status ||
      formatVisitDate(item.reported_at || item.released_at || item.created_at),
  }))
}

function mapInvoiceRows(invoices = []) {
  return invoices.map((invoice, index) => ({
    id: invoice.invoice_id || invoice._id || `${invoice.invoice_no || 'invoice'}-${index}`,
    title: invoice.invoice_no || invoice.invoice_code || `Hóa đơn ${index + 1}`,
    value: [
      invoice.status || 'Đang cập nhật',
      Number(invoice.balance_due || 0) > 0 ? `Còn ${Number(invoice.balance_due || 0).toLocaleString('vi-VN')}đ` : '',
    ]
      .filter(Boolean)
      .join(' • '),
  }))
}

function mapPortalVisit(visit, index) {
  const encounter = visit.encounter || {}
  const appointment = visit.appointment || {}
  const id = visit.visit_id || encounter.encounter_id || encounter._id || `${encounter.start_time}-${index}`
  const status = getEncounterStatusMeta(encounter.status || appointment.status)
  const typeKey = normalizeTypeKey(encounter.encounter_type || appointment.appointment_type)
  const specialty =
    encounter.department_name ||
    appointment.department_name ||
    getVisitTypeLabel(typeKey)
  const visual = getVisitVisual(specialty)
  const dateValue = encounter.start_time || appointment.appointment_time || appointment.start_time || visit.visit_date
  const date = getVisitDateParts(dateValue)
  const doctor =
    encounter.doctor_name ||
    appointment.doctor_name ||
    encounter.attending_doctor_name ||
    'Bác sĩ đang cập nhật'
  const primaryDiagnosis = getDiagnosisText(visit.primary_diagnosis)
  const counters = visit.counters || {}
  const rating = buildStableRating(doctor)
  const labRelated = mapRelatedResultRows(visit.lab_results || [], 'Kết quả xét nghiệm')
  const imagingRelated = mapRelatedResultRows(visit.imaging_reports || [], 'Kết quả hình ảnh')
  const procedureRelated = mapRelatedResultRows(visit.procedure_results || [], 'Kết quả thủ thuật')
  const relatedRecords = mapMedicalRecordRows(visit.released_records || [])
  const relatedPrescriptions = mapPrescriptionRows(visit.prescriptions || [])
  const relatedInvoices = mapInvoiceRows(visit.invoices || [])

  return {
    id,
    source: visit.visit_source || (encounter._id || encounter.encounter_id ? 'encounter' : 'appointment'),
    latest: index === 0,
    day: date.day,
    month: date.month,
    year: date.year,
    time: date.time,
    date: date.full,
    rawDate: dateValue || visit.visit_date || '',
    doctor,
    specialty,
    typeKey,
    typeLabel: getVisitTypeLabel(typeKey),
    status: status.label,
    statusTone: status.tone,
    title:
      encounter.chief_reason ||
      appointment.reason ||
      (typeKey === 'procedure' ? 'Thủ thuật' : `Khám ${specialty.toLowerCase()}`),
    location: encounter.location || appointment.location || 'Bệnh viện Đa khoa Quốc tế',
    reason: encounter.chief_reason || appointment.reason || 'Kiểm tra định kỳ',
    diagnosis:
      primaryDiagnosis ||
      (encounter.status === 'completed' ? 'Đã hoàn tất thăm khám' : 'Đang cập nhật chẩn đoán'),
    notes:
      encounter.clinical_notes ||
      encounter.summary ||
      'Thông tin chi tiết được tổng hợp từ lượt khám và hồ sơ đã phát hành.',
    recordId: encounter.encounter_code || id,
    icon: visual.icon,
    tone: visual.tone,
    rating: rating.rating,
    reviews: rating.reviews,
    hasReleasedRecord: Number(counters.released_records || visit.released_records?.length || 0) > 0,
    hasResults:
      Number(counters.lab_results || visit.lab_results?.length || 0) > 0 ||
      Number(counters.imaging_reports || visit.imaging_reports?.length || 0) > 0 ||
      Number(counters.procedure_results || visit.procedure_results?.length || 0) > 0,
    hasPrescription: Number(counters.prescriptions || visit.prescriptions?.length || 0) > 0,
    hasInvoice: Number(counters.invoices || visit.invoices?.length || 0) > 0,
    relatedCounts: {
      records: Number(counters.released_records || visit.released_records?.length || 0),
      results:
        Number(counters.lab_results || visit.lab_results?.length || 0) +
        Number(counters.imaging_reports || visit.imaging_reports?.length || 0) +
        Number(counters.procedure_results || visit.procedure_results?.length || 0),
      prescriptions: Number(counters.prescriptions || visit.prescriptions?.length || 0),
      invoices: Number(counters.invoices || visit.invoices?.length || 0),
    },
    relatedRecords,
    relatedResults: [...labRelated, ...imagingRelated, ...procedureRelated],
    relatedPrescriptions,
    relatedInvoices,
  }
}

function buildVisitSummaryText(visit) {
  if (!visit) return ''

  return [
    'TOM TAT LUOT KHAM',
    `Ma luot kham: ${visit.recordId || visit.id}`,
    `Ngay kham: ${visit.date} ${visit.time}`,
    `Chuyen khoa: ${visit.specialty}`,
    `Bac si: ${visit.doctor}`,
    `Trang thai: ${visit.status}`,
    `Ly do: ${visit.reason}`,
    `Chan doan: ${visit.diagnosis}`,
    `Ghi chu: ${visit.notes}`,
  ].join('\n')
}

function downloadVisitSummary(visit) {
  const text = buildVisitSummaryText(visit)
  if (!text) return

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `tom-tat-luot-kham-${visit.recordId || visit.id}.txt`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function PatientMedicalHistoryPage({
  encounters = [],
  labResults = [],
  loading = false,
  medicalRecords = [],
  onNavigate,
  prescriptions = [],
  visits: portalVisits = [],
  viewMode = 'history',
}) {
  const sourceEncounters = encounters
  const sourcePrescriptions = prescriptions
  const visits = useMemo(
    () => (portalVisits.length ? portalVisits.map(mapPortalVisit) : sourceEncounters.map(mapApiEncounter)),
    [portalVisits, sourceEncounters],
  )
  const prescriptionRows = useMemo(
    () => mapPrescriptionRows(sourcePrescriptions),
    [sourcePrescriptions],
  )
  const labRows = useMemo(() => mapLabResultRows(labResults), [labResults])
  const [activeVisitId, setActiveVisitId] = useState(null)
  const [activeVisitTab, setActiveVisitTab] = useState('all')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [diagnosisFilter, setDiagnosisFilter] = useState('')
  const [relatedFilters, setRelatedFilters] = useState({
    results: false,
    prescriptions: false,
    invoices: false,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [doctorRating, setDoctorRating] = useState(0)
  const [doctorReview, setDoctorReview] = useState('')
  const [historyNotice, setHistoryNotice] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  const specialties = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.specialty).filter(Boolean))),
    [visits],
  )
  const statuses = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.status).filter(Boolean))),
    [visits],
  )
  const doctors = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.doctor).filter(Boolean))),
    [visits],
  )
  const filteredVisits = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    const diagnosisKeyword = diagnosisFilter.trim().toLowerCase()
    const maxDays = timeFilter === 'all' ? null : Number(timeFilter)
    const now = Date.now()

    return visits.filter((visit) => {
      const visitTime = new Date(visit.rawDate).getTime()
      const matchTab =
        activeVisitTab === 'all' ||
        (activeVisitTab === 'released' ? visit.hasReleasedRecord : visit.typeKey === activeVisitTab)
      const matchSpecialty = specialtyFilter === 'all' || visit.specialty === specialtyFilter
      const matchStatus = statusFilter === 'all' || visit.status === statusFilter
      const matchDoctor = doctorFilter === 'all' || visit.doctor === doctorFilter
      const matchTime =
        !maxDays ||
        (!Number.isNaN(visitTime) && now - visitTime <= maxDays * 24 * 60 * 60 * 1000)
      const matchDiagnosis =
        !diagnosisKeyword ||
        String(visit.diagnosis || '').toLowerCase().includes(diagnosisKeyword)
      const matchRelated =
        (!relatedFilters.results || visit.hasResults) &&
        (!relatedFilters.prescriptions || visit.hasPrescription) &&
        (!relatedFilters.invoices || visit.hasInvoice)
      const matchKeyword =
        !keyword ||
        [visit.title, visit.doctor, visit.specialty, visit.location, visit.reason, visit.diagnosis]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      return matchTab && matchSpecialty && matchStatus && matchDoctor && matchTime && matchDiagnosis && matchRelated && matchKeyword
    })
  }, [activeVisitTab, diagnosisFilter, doctorFilter, relatedFilters, searchTerm, specialtyFilter, statusFilter, timeFilter, visits])

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / pageSize))
  const pagedVisits = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages)
    return filteredVisits.slice((safePage - 1) * pageSize, safePage * pageSize)
  }, [currentPage, filteredVisits, totalPages])

  const hasActiveFilters =
    activeVisitTab !== 'all' ||
    specialtyFilter !== 'all' ||
    statusFilter !== 'all' ||
    timeFilter !== 'all' ||
    doctorFilter !== 'all' ||
    diagnosisFilter.trim() ||
    searchTerm.trim() ||
    Object.values(relatedFilters).some(Boolean)

  useEffect(() => {
    if (!filteredVisits.length) {
      setActiveVisitId(null)
      return
    }

    if (!filteredVisits.some((visit) => visit.id === activeVisitId)) {
      setActiveVisitId(filteredVisits[0].id)
    }
  }, [activeVisitId, filteredVisits])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeVisitTab, diagnosisFilter, doctorFilter, relatedFilters, searchTerm, specialtyFilter, statusFilter, timeFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const activeVisit = filteredVisits.find((visit) => visit.id === activeVisitId) || filteredVisits[0] || null
  const visiblePrescriptions = activeVisit?.relatedPrescriptions?.length
    ? activeVisit.relatedPrescriptions.slice(0, 3)
    : prescriptionRows.slice(0, 3)
  const visibleLabs = activeVisit?.relatedResults?.length
    ? activeVisit.relatedResults.slice(0, 3)
    : labRows.slice(0, 3)
  const visibleInvoices = activeVisit?.relatedInvoices?.slice(0, 3) || []
  const visibleRecords = activeVisit?.relatedRecords?.slice(0, 3) || []
  const isRecordsView = viewMode === 'records'
  const recordRows = useMemo(() => mapMedicalRecordRows(medicalRecords, visits), [medicalRecords, visits])
  const pageTitle = isRecordsView ? 'Hồ sơ y tế' : 'Lịch sử khám'
  const pageDescription = isRecordsView
    ? 'Tổng hợp bệnh án, chẩn đoán, đơn thuốc, xét nghiệm và các lần khám liên quan.'
    : 'Theo dõi toàn bộ các lần khám và điều trị của bạn'
  const recordOverviewCards = [
    {
      id: 'records',
      label: 'Hồ sơ bệnh án',
      value: recordRows.length,
      unit: 'mục',
      icon: 'folder_shared',
    },
    {
      id: 'visits',
      label: 'Lần khám',
      value: visits.length,
      unit: 'lần',
      icon: 'medical_services',
    },
    {
      id: 'prescriptions',
      label: 'Đơn thuốc',
      value: prescriptionRows.length,
      unit: 'thuốc',
      icon: 'medication',
    },
    {
      id: 'labs',
      label: 'Xét nghiệm',
      value: labRows.length,
      unit: 'kết quả',
      icon: 'experiment',
    },
  ]
  const visitOverviewCards = [
    { id: 'total', label: 'Lượt khám', value: visits.length, unit: 'lần', icon: 'medical_services' },
    { id: 'released', label: 'Hồ sơ phát hành', value: visits.filter((visit) => visit.hasReleasedRecord).length, unit: 'lượt', icon: 'folder_shared' },
    { id: 'results', label: 'Có kết quả', value: visits.filter((visit) => visit.hasResults).length, unit: 'lượt', icon: 'experiment' },
    { id: 'prescriptions', label: 'Có đơn thuốc', value: visits.filter((visit) => visit.hasPrescription).length, unit: 'lượt', icon: 'medication' },
  ]

  const clearFilters = () => {
    setActiveVisitTab('all')
    setSpecialtyFilter('all')
    setStatusFilter('all')
    setTimeFilter('all')
    setDoctorFilter('all')
    setDiagnosisFilter('')
    setSearchTerm('')
    setRelatedFilters({ results: false, prescriptions: false, invoices: false })
  }

  const focusVisit = (visit, target = 'detail') => {
    setActiveVisitId(visit.id)
    setHistoryNotice(null)
    if (target === 'records') onNavigate?.('medical-records')
    if (target === 'results') onNavigate?.('lab-results')
    if (target === 'prescriptions') onNavigate?.('medications')
    if (target === 'invoices') onNavigate?.('billing-receipts')
    if (target === 'review') {
      setHistoryNotice({ type: 'success', message: 'Đã mở khung đánh giá dịch vụ cho lượt khám này.' })
    }
  }

  const handleDownloadSummary = (visit) => {
    downloadVisitSummary(visit)
    setHistoryNotice({ type: 'success', message: 'Đã tạo file tóm tắt lượt khám.' })
  }

  const submitReview = () => {
    setHistoryNotice({
      type: doctorRating ? 'success' : 'error',
      message: doctorRating
        ? 'Đã ghi nhận đánh giá của bạn trên portal.'
        : 'Vui lòng chọn số sao trước khi gửi đánh giá.',
    })
  }

  return (
    <div className="patient-history-page">
      <header className="patient-history-titlebar">
        <div>
          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>
      </header>

      {!isRecordsView ? (
        <section className="patient-history-overview" aria-label="Tổng quan lịch sử khám">
          {visitOverviewCards.map((card) => (
            <article className="patient-history-overview-card" key={card.id}>
              <span aria-hidden="true">
                <PatientIcon name={card.icon} />
              </span>
              <div>
                <strong>{card.label}</strong>
                <p>
                  <b>{card.value}</b>
                  {card.unit}
                </p>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {historyNotice ? (
        <div className={`patient-care-state${historyNotice.type === 'error' ? ' is-error' : ''}`}>
          {historyNotice.message}
        </div>
      ) : null}

      {isRecordsView ? (
        <>
          <section className="patient-records-overview" aria-label="Tổng quan hồ sơ y tế">
            {recordOverviewCards.map((card) => (
              <div className="patient-records-overview-card" key={card.id}>
                <span aria-hidden="true">
                  <PatientIcon name={card.icon} />
                </span>
                <div>
                  <strong>{card.label}</strong>
                  <p>
                    <b>{card.value}</b>
                    {card.unit}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <section className="patient-records-panel">
            <div className="patient-records-panel-head">
              <div>
                <h2>Hồ sơ bệnh án gần đây</h2>
                <p>Những mục bệnh án và ghi chú lâm sàng quan trọng nhất.</p>
              </div>
              <span>{recordRows.length} mục</span>
            </div>

            <div className="patient-records-list">
              {loading ? <div className="patient-empty-state">Đang tải hồ sơ y tế...</div> : null}

              {!loading && recordRows.length === 0 ? (
                <div className="patient-empty-state">Chưa có hồ sơ bệnh án để hiển thị.</div>
              ) : null}

              {recordRows.map((record) => (
                <article className="patient-records-row" key={record.id}>
                  <span className="patient-records-row-icon" aria-hidden="true">
                    <PatientIcon name="clinical_notes" />
                  </span>
                  <div>
                    <strong>{record.title}</strong>
                    <p>{record.note}</p>
                    <small>
                      {record.type}
                      <span>•</span>
                      {record.date}
                      <span>•</span>
                      {record.doctor}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="patient-history-workspace">
        <div className="patient-history-left">
          <div className="patient-history-tabs" role="tablist" aria-label="Nhóm lượt khám">
            {visitTabs.map((tab) => {
              const active = activeVisitTab === tab.id

              return (
                <button
                  key={tab.id}
                  className={active ? 'is-active' : ''}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveVisitTab(tab.id)}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="patient-history-filterbar">
            <label className="patient-history-filter">
              <PatientIcon name="calendar_today" aria-hidden="true" />
              <select
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value)}
                aria-label="Lọc theo thời gian"
              >
                <option value="all">Tất cả thời gian</option>
                <option value="30">30 ngày gần đây</option>
                <option value="90">90 ngày gần đây</option>
                <option value="365">12 tháng gần đây</option>
              </select>
              <PatientIcon name="expand_more" aria-hidden="true" />
            </label>

            <label className="patient-history-filter">
              <select
                value={specialtyFilter}
                onChange={(event) => setSpecialtyFilter(event.target.value)}
                aria-label="Lọc chuyên khoa"
              >
                <option value="all">Tất cả chuyên khoa</option>
                {specialties.map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {specialty}
                  </option>
                ))}
              </select>
              <PatientIcon name="expand_more" aria-hidden="true" />
            </label>

            <label className="patient-history-filter">
              <select
                value={doctorFilter}
                onChange={(event) => setDoctorFilter(event.target.value)}
                aria-label="Lọc bác sĩ"
              >
                <option value="all">Tất cả bác sĩ</option>
                {doctors.map((doctor) => (
                  <option key={doctor} value={doctor}>
                    {doctor}
                  </option>
                ))}
              </select>
              <PatientIcon name="expand_more" aria-hidden="true" />
            </label>

            <label className="patient-history-search">
              <PatientIcon name="search" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm bác sĩ, bệnh lý..."
              />
            </label>

            <label className="patient-history-filter">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Lọc trạng thái hồ sơ"
              >
                <option value="all">Tất cả trạng thái</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <PatientIcon name="expand_more" aria-hidden="true" />
            </label>

            <label className="patient-history-search">
              <PatientIcon name="clinical_notes" aria-hidden="true" />
              <input
                type="search"
                value={diagnosisFilter}
                onChange={(event) => setDiagnosisFilter(event.target.value)}
                placeholder="Lọc chẩn đoán"
              />
            </label>
          </div>

          <div className="patient-history-related-filters" aria-label="Lọc dữ liệu liên quan">
            {[
              { id: 'results', label: 'Có kết quả' },
              { id: 'prescriptions', label: 'Có đơn thuốc' },
              { id: 'invoices', label: 'Có hóa đơn' },
            ].map((filter) => (
              <label key={filter.id}>
                <input
                  type="checkbox"
                  checked={relatedFilters[filter.id]}
                  onChange={(event) => {
                    setRelatedFilters((current) => ({
                      ...current,
                      [filter.id]: event.target.checked,
                    }))
                  }}
                />
                <span>{filter.label}</span>
              </label>
            ))}
            {hasActiveFilters ? (
              <button className="patient-history-clear-filters" type="button" onClick={clearFilters}>
                <PatientIcon name="close" aria-hidden="true" />
                Xóa bộ lọc
              </button>
            ) : null}
          </div>

          <div className="patient-history-visit-list">
            {loading ? (
              <div className="patient-empty-state">Đang tải lịch sử khám...</div>
            ) : null}

            {!loading && filteredVisits.length === 0 ? (
              <div className="patient-history-empty-state">
                <PatientIcon name={hasActiveFilters ? 'filter_list' : 'history_edu'} aria-hidden="true" />
                <strong>
                  {hasActiveFilters
                    ? 'Không có lần khám nào phù hợp với bộ lọc.'
                    : 'Chưa có lượt khám đã hoàn tất để hiển thị.'}
                </strong>
                <p>
                  {hasActiveFilters
                    ? 'Bạn có thể xóa bộ lọc hoặc mở nhóm khác để xem toàn bộ dữ liệu.'
                    : 'Khi có lịch đã khám, hồ sơ phát hành, kết quả hoặc hóa đơn, hệ thống sẽ gom về đây.'}
                </p>
                <div>
                  {hasActiveFilters ? (
                    <button className="patient-outline-button" type="button" onClick={clearFilters}>
                      Xóa bộ lọc
                    </button>
                  ) : null}
                  <button className="patient-hero-button" type="button" onClick={() => onNavigate?.('book-appointment')}>
                    <PatientIcon name="calendar_add_on" aria-hidden="true" />
                    Đặt lịch khám
                  </button>
                  <button className="patient-soft-button" type="button" onClick={() => onNavigate?.('medical-records')}>
                    <PatientIcon name="folder_shared" aria-hidden="true" />
                    Mở hồ sơ y tế
                  </button>
                </div>
              </div>
            ) : null}

            {pagedVisits.map((visit) => {
              const isActive = visit.id === activeVisit?.id

              return (
                <article
                  key={visit.id}
                  className={`patient-history-visit-row${isActive ? ' is-active' : ''}`}
                >
                  <button
                    className="patient-history-visit-main"
                    type="button"
                    onClick={() => setActiveVisitId(visit.id)}
                  >
                    <div className="patient-history-datebox">
                      <strong>{visit.day}</strong>
                      <span>{visit.month}</span>
                      <small>{visit.year}</small>
                      <em>{visit.time}</em>
                    </div>

                    <div className={`patient-history-visit-icon ${visit.tone}`}>
                      <PatientIcon name={visit.icon} aria-hidden="true" />
                    </div>

                  <div className="patient-history-visit-copy">
                    <h3>{visit.title}</h3>
                    <p>
                      {visit.doctor}
                      <span>•</span>
                      {visit.specialty}
                      <span>•</span>
                      {visit.typeLabel}
                    </p>
                    <small>
                      <PatientIcon name="location_on" aria-hidden="true" />
                      {visit.location}
                    </small>
                    <div className="patient-history-related-chips" aria-label="Dữ liệu liên quan">
                      <span>{visit.relatedCounts.records} hồ sơ</span>
                      <span>{visit.relatedCounts.results} kết quả</span>
                      <span>{visit.relatedCounts.prescriptions} đơn thuốc</span>
                      <span>{visit.relatedCounts.invoices} hóa đơn</span>
                    </div>
                  </div>

                    <span className={`patient-history-status ${visit.statusTone}`}>
                      {visit.status}
                    </span>
                  </button>

                  <div className="patient-history-row-actions patient-history-row-actions--dense">
                    <button type="button" onClick={() => focusVisit(visit)}>
                      Xem chi tiết
                    </button>
                    <button type="button" disabled={!visit.hasReleasedRecord} onClick={() => focusVisit(visit, 'records')}>
                      Xem hồ sơ đã phát hành
                    </button>
                    <button type="button" disabled={!visit.hasResults} onClick={() => focusVisit(visit, 'results')}>
                      Xem kết quả
                    </button>
                    <button type="button" disabled={!visit.hasPrescription} onClick={() => focusVisit(visit, 'prescriptions')}>
                      Xem đơn thuốc
                    </button>
                    <button type="button" disabled={!visit.hasInvoice} onClick={() => focusVisit(visit, 'invoices')}>
                      Xem hóa đơn
                    </button>
                    <button type="button" onClick={() => handleDownloadSummary(visit)}>
                      <PatientIcon name="download" aria-hidden="true" />
                      Tải tóm tắt
                    </button>
                    <button type="button" onClick={() => focusVisit(visit, 'review')}>
                      Đánh giá dịch vụ
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {filteredVisits.length > 0 ? (
            <div className="patient-history-pagination" aria-label="Phân trang lịch sử khám">
              <button
                type="button"
                aria-label="Trang trước"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <PatientIcon name="chevron_left" aria-hidden="true" />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5).map((page) => (
                <button
                  key={page}
                  className={page === currentPage ? 'is-active' : ''}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              {totalPages > 5 ? <span>...</span> : null}
              {totalPages > 5 ? (
                <button type="button" onClick={() => setCurrentPage(totalPages)}>
                  {totalPages}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Trang sau"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                <PatientIcon name="chevron_right" aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>

        <aside className="patient-history-detail-panel">
          {activeVisit ? (
            <>
              <div className="patient-history-detail-top">
                <h2>Chi tiết lần khám</h2>
                <button type="button" onClick={() => window.print()}>
                  <PatientIcon name="print" aria-hidden="true" />
                  In hồ sơ
                </button>
              </div>

              <div className="patient-history-doctor-card">
                <span className="patient-history-doctor-avatar" aria-hidden="true">
                  <PatientIcon name="medical_services" />
                </span>
                <div>
                  <h3>{activeVisit.doctor}</h3>
                  <p>{activeVisit.specialty}</p>
                  <div className="patient-history-stars">
                    <span>★★★★★</span>
                    <strong>{activeVisit.rating}</strong>
                    <small>({activeVisit.reviews} đánh giá)</small>
                  </div>
                </div>
              </div>

              <div className="patient-history-detail-list">
                <div>
                  <PatientIcon name="calendar_today" aria-hidden="true" />
                  <span>Ngày khám</span>
                  <strong>{activeVisit.date} - {activeVisit.time}</strong>
                </div>
                <div>
                  <PatientIcon name="location_on" aria-hidden="true" />
                  <span>Địa điểm khám</span>
                  <strong>{activeVisit.location}</strong>
                </div>
                <div>
                  <PatientIcon name="description" aria-hidden="true" />
                  <span>Lý do khám</span>
                  <strong>{activeVisit.reason}</strong>
                </div>
                <div>
                  <PatientIcon name="folder_shared" aria-hidden="true" />
                  <span>Trạng thái hồ sơ</span>
                  <strong>{activeVisit.hasReleasedRecord ? 'Đã phát hành' : 'Đang cập nhật'}</strong>
                </div>
              </div>

              <section className="patient-history-detail-section">
                <div className="patient-history-section-head">
                  <div className="patient-history-section-icon diagnosis">
                    <PatientIcon name="folder_shared" aria-hidden="true" />
                  </div>
                  <h3>Dữ liệu liên quan</h3>
                </div>
                <ul>
                  <li>Hồ sơ đã phát hành <small>{activeVisit.relatedCounts.records}</small></li>
                  <li>Kết quả liên quan <small>{activeVisit.relatedCounts.results}</small></li>
                  <li>Đơn thuốc liên quan <small>{activeVisit.relatedCounts.prescriptions}</small></li>
                  <li>Hóa đơn liên quan <small>{activeVisit.relatedCounts.invoices}</small></li>
                </ul>
              </section>

              <section className="patient-history-detail-section">
                <div className="patient-history-section-head">
                  <div className="patient-history-section-icon diagnosis">
                    <PatientIcon name="folder_shared" aria-hidden="true" />
                  </div>
                  <h3>Hồ sơ đã phát hành</h3>
                  <button type="button" onClick={() => onNavigate?.('medical-records')}>Mở hồ sơ</button>
                </div>
                <ul>
                  {visibleRecords.length ? (
                    visibleRecords.map((record) => (
                      <li key={record.id}>
                        <span>{record.title}</span>
                        <small>{record.date}</small>
                      </li>
                    ))
                  ) : (
                    <li>Chưa có hồ sơ đã phát hành cho lượt này.</li>
                  )}
                </ul>
              </section>

              <section className="patient-history-detail-section">
                <div className="patient-history-section-head">
                  <div className="patient-history-section-icon diagnosis">
                    <PatientIcon name="clinical_notes" aria-hidden="true" />
                  </div>
                  <h3>Chẩn đoán</h3>
                </div>
                <ul>
                  <li>{activeVisit.diagnosis}</li>
                </ul>
              </section>

              <section className="patient-history-detail-section">
                <div className="patient-history-section-head">
                  <div className="patient-history-section-icon prescription">
                    <PatientIcon name="medication" aria-hidden="true" />
                  </div>
                  <h3>Đơn thuốc</h3>
                  <button type="button" onClick={() => onNavigate?.('medications')}>Xem tất cả</button>
                </div>
                <ul>
                  {visiblePrescriptions.length ? (
                    visiblePrescriptions.map((item) => (
                      <li key={item.id}>
                        <span>{item.medication}</span>
                        <small>{item.dosage}</small>
                      </li>
                    ))
                  ) : (
                    <li>Chưa có đơn thuốc từ backend.</li>
                  )}
                </ul>
              </section>

              <section className="patient-history-detail-section">
                <div className="patient-history-section-head">
                  <div className="patient-history-section-icon lab">
                    <PatientIcon name="experiment" aria-hidden="true" />
                  </div>
                  <h3>Kết quả xét nghiệm</h3>
                  <button type="button" onClick={() => onNavigate?.('lab-results')}>Xem tất cả</button>
                </div>
                <ul>
                  {visibleLabs.length ? (
                    visibleLabs.map((result) => (
                      <li key={result.id}>
                        <span>{result.title}</span>
                        <small>{result.value}</small>
                      </li>
                    ))
                  ) : (
                    <li>Chưa có kết quả xét nghiệm từ backend.</li>
                  )}
                </ul>
              </section>

              <section className="patient-history-detail-section">
                <div className="patient-history-section-head">
                  <div className="patient-history-section-icon note">
                    <PatientIcon name="receipt_long" aria-hidden="true" />
                  </div>
                  <h3>Hóa đơn</h3>
                  <button type="button" onClick={() => onNavigate?.('billing-receipts')}>Xem hóa đơn</button>
                </div>
                <ul>
                  {visibleInvoices.length ? (
                    visibleInvoices.map((invoice) => (
                      <li key={invoice.id}>
                        <span>{invoice.title}</span>
                        <small>{invoice.value}</small>
                      </li>
                    ))
                  ) : (
                    <li>Chưa có hóa đơn liên quan cho lượt này.</li>
                  )}
                </ul>
              </section>

              <section className="patient-history-detail-section">
                <div className="patient-history-section-head">
                  <div className="patient-history-section-icon note">
                    <PatientIcon name="edit_note" aria-hidden="true" />
                  </div>
                  <h3>Ghi chú của bác sĩ</h3>
                </div>
                <p>{activeVisit.notes}</p>
              </section>

              <section className="patient-history-rating-section">
                <div>
                  <h3>Đánh giá của bạn</h3>
                  <p>Đánh giá này sẽ được hiển thị công khai sau khi gửi.</p>
                </div>
                <label className="patient-history-rating-label">Chọn số sao</label>
                <div className="patient-history-rating-stars" role="radiogroup" aria-label="Đánh giá bác sĩ">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      className={[
                        rating <= doctorRating ? 'is-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      type="button"
                      role="radio"
                      aria-checked={rating === doctorRating}
                      aria-label={`${rating} sao`}
                      onClick={() => setDoctorRating(rating)}
                    >
                      ★
                    </button>
                  ))}
                  <span className={doctorRating >= 4 ? 'is-good-rating' : 'is-muted-rating'}>
                    {getRatingLabel(doctorRating)}
                  </span>
                </div>
                <label className="patient-history-review-field">
                  <span>Chia sẻ trải nghiệm của bạn (không bắt buộc)</span>
                  <textarea
                    value={doctorReview}
                    onChange={(event) => setDoctorReview(event.target.value)}
                    placeholder="Ví dụ: Bác sĩ tư vấn rõ ràng, quy trình khám nhanh..."
                    rows={3}
                  />
                </label>
                <button className="patient-history-review-submit" type="button" onClick={submitReview}>
                  Gửi đánh giá
                </button>
              </section>

              <button className="patient-history-rebook" type="button" onClick={() => onNavigate?.('book-appointment')}>
                Đặt lịch tái khám
              </button>
            </>
          ) : (
            <div className="patient-empty-state">
              Chưa có chi tiết lần khám để hiển thị.
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}
