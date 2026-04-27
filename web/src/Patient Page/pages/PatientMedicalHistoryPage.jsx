import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { labResultCards } from '../data/patientPageData'

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

export default function PatientMedicalHistoryPage({
  encounters = [],
  loading = false,
  prescriptions = [],
}) {
  const sourceEncounters = encounters.length ? encounters : sampleEncounters
  const sourcePrescriptions = prescriptions.length ? prescriptions : samplePrescriptions
  const visits = useMemo(() => sourceEncounters.map(mapApiEncounter), [sourceEncounters])
  const prescriptionRows = useMemo(
    () => mapPrescriptionRows(sourcePrescriptions),
    [sourcePrescriptions],
  )
  const [activeVisitId, setActiveVisitId] = useState(null)
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [doctorRating, setDoctorRating] = useState(0)
  const [doctorReview, setDoctorReview] = useState('')

  const specialties = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.specialty).filter(Boolean))),
    [visits],
  )
  const statuses = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.status).filter(Boolean))),
    [visits],
  )
  const filteredVisits = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return visits.filter((visit) => {
      const matchSpecialty = specialtyFilter === 'all' || visit.specialty === specialtyFilter
      const matchStatus = statusFilter === 'all' || visit.status === statusFilter
      const matchKeyword =
        !keyword ||
        [visit.title, visit.doctor, visit.specialty, visit.location, visit.reason]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword)

      return matchSpecialty && matchStatus && matchKeyword
    })
  }, [searchTerm, specialtyFilter, statusFilter, visits])

  useEffect(() => {
    if (!filteredVisits.length) {
      setActiveVisitId(null)
      return
    }

    if (!filteredVisits.some((visit) => visit.id === activeVisitId)) {
      setActiveVisitId(filteredVisits[0].id)
    }
  }, [activeVisitId, filteredVisits])

  const activeVisit = filteredVisits.find((visit) => visit.id === activeVisitId) || filteredVisits[0] || null
  const visiblePrescriptions = prescriptionRows.slice(0, 3)
  const visibleLabs = labResultCards.slice(0, 3)

  return (
    <div className="patient-history-page">
      <header className="patient-history-titlebar">
        <div>
          <h1>Lịch sử khám</h1>
          <p>Theo dõi toàn bộ các lần khám và điều trị của bạn</p>
        </div>
      </header>

      <section className="patient-history-workspace">
        <div className="patient-history-left">
          <div className="patient-history-filterbar">
            <label className="patient-history-filter">
              <PatientIcon name="calendar_today" aria-hidden="true" />
              <span>01/01/2025 - 25/04/2026</span>
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
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Lọc trạng thái"
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
              <PatientIcon name="search" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm bác sĩ, bệnh lý..."
              />
            </label>
          </div>

          <div className="patient-history-visit-list">
            {loading ? (
              <div className="patient-empty-state">Đang tải lịch sử khám...</div>
            ) : null}

            {!loading && filteredVisits.length === 0 ? (
              <div className="patient-empty-state">
                Chưa có lần khám nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : null}

            {filteredVisits.map((visit) => {
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
                      </p>
                      <small>
                        <PatientIcon name="location_on" aria-hidden="true" />
                        {visit.location}
                      </small>
                    </div>

                    <span className={`patient-history-status ${visit.statusTone}`}>
                      {visit.status}
                    </span>
                  </button>

                  <div className="patient-history-row-actions">
                    <button type="button" onClick={() => setActiveVisitId(visit.id)}>
                      Xem chi tiết
                    </button>
                    <button type="button">
                      <PatientIcon name="download" aria-hidden="true" />
                      Tải kết quả
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {filteredVisits.length > 0 ? (
            <div className="patient-history-pagination" aria-label="Phân trang lịch sử khám">
              <button type="button" aria-label="Trang trước">
                <PatientIcon name="chevron_left" aria-hidden="true" />
              </button>
              <button className="is-active" type="button">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <span>...</span>
              <button type="button">8</button>
              <button type="button" aria-label="Trang sau">
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
                <button type="button">
                  <PatientIcon name="print" aria-hidden="true" />
                  In hồ sơ
                </button>
              </div>

              <div className="patient-history-doctor-card">
                <img src={getDoctorAvatar(activeVisit.doctor)} alt={activeVisit.doctor} />
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
              </div>

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
                  <button type="button">Xem tất cả</button>
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
                  <button type="button">Xem tất cả</button>
                </div>
                <ul>
                  {visibleLabs.map((result) => (
                    <li key={result.id}>
                      <span>{result.title}</span>
                      <small>{result.details?.[0]?.value || result.badge}</small>
                    </li>
                  ))}
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
              </section>

              <button className="patient-history-rebook" type="button">
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