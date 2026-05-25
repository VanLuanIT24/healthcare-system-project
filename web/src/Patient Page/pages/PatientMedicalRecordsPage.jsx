import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

function formatDateTime(value) {
  if (!value) return 'Chưa có thời gian'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian'

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatDate(value) {
  if (!value) return 'Chưa có ngày'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có ngày'

  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date)
}

function formatClock(value) {
  if (!value) return '--:--'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getDateParts(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return { day: '--', month: '--', year: '----', time: '--:--', full: 'Chưa có ngày' }
  }

  return {
    day: new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('vi-VN', { month: '2-digit' }).format(date),
    year: new Intl.DateTimeFormat('vi-VN', { year: 'numeric' }).format(date),
    time: formatClock(value),
    full: formatDate(value),
  }
}

function getStatusMeta(status) {
  const key = String(status || '').toLowerCase()

  const map = {
    completed: { label: 'Đã hoàn thành', tone: 'success' },
    active: { label: 'Đang xử lý', tone: 'warning' },
    verified: { label: 'Đã xác nhận', tone: 'success' },
    partially_dispensed: { label: 'Cấp một phần', tone: 'warning' },
    fully_dispensed: { label: 'Đã cấp đủ', tone: 'success' },
    draft: { label: 'Nháp', tone: 'neutral' },
    planned: { label: 'Đã lên lịch', tone: 'neutral' },
    arrived: { label: 'Đã đến', tone: 'neutral' },
    in_progress: { label: 'Đang khám', tone: 'warning' },
    on_hold: { label: 'Tạm dừng', tone: 'warning' },
    cancelled: { label: 'Đã hủy', tone: 'danger' },
  }

  return map[key] || { label: key || 'Chưa xác định', tone: 'neutral' }
}

function getDoctorAvatar(seed) {
  const avatars = [
    'https://randomuser.me/api/portraits/women/44.jpg',
    'https://randomuser.me/api/portraits/men/32.jpg',
    'https://randomuser.me/api/portraits/women/65.jpg',
    'https://randomuser.me/api/portraits/men/46.jpg',
  ]
  const hash = [...String(seed || 'doctor')].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return avatars[hash % avatars.length]
}

function mapEncounter(encounter, index) {
  const dateParts = getDateParts(encounter.start_time)
  const status = getStatusMeta(encounter.status)
  const doctor = encounter.doctor_name || `Bác sĩ ${index + 1}`
  const specialty = encounter.department_name || 'Khám ngoại trú'
  const reason = encounter.chief_reason || 'Khám định kỳ'

  return {
    id: encounter.encounter_id || encounter._id || `${encounter.start_time || 'record'}-${index}`,
    doctor,
    specialty,
    reason,
    location: encounter.location || encounter.facility_name || 'Bệnh viện Đa khoa Bộ Y tế',
    diagnosis: encounter.diagnosis || 'Đang cập nhật chẩn đoán',
    notes:
      encounter.clinical_notes ||
      'Thông tin chi tiết sẽ được cập nhật sau khi hoàn tất hồ sơ khám.',
    statusLabel: status.label,
    statusTone: status.tone,
    dateParts,
    time: dateParts.time,
    fullDate: dateParts.full,
    avatar: getDoctorAvatar(doctor),
    recordCode: encounter.encounter_code || encounter.visit_code || `VIS-${index + 1}`,
  }
}

function mapRecordRows(records = [], encounters = []) {
  if (records.length) {
    return records.map((record, index) => ({
      id: record.medical_record_id || record.record_id || record._id || `record-${index}`,
      title:
        record.title ||
        record.record_title ||
        record.document_title ||
        record.summary ||
        `Hồ sơ bệnh án ${index + 1}`,
      type: record.record_type || record.category || 'Bệnh án',
      date: formatDate(record.recorded_at || record.updated_at || record.created_at),
      doctor: record.doctor_name || 'Đang cập nhật',
      note:
        record.clinical_notes ||
        record.notes ||
        record.description ||
        'Hồ sơ y tế đã được lưu trong hệ thống.',
    }))
  }

  return encounters.slice(0, 4).map((encounter, index) => ({
    id: `record-${encounter.id}`,
    title: encounter.reason,
    type: 'Từ lần khám',
    date: encounter.fullDate,
    doctor: encounter.doctor,
    note: encounter.notes,
  }))
}

function getTypeLabel(value) {
  const text = String(value || '').toLowerCase()
  if (text.includes('lab') || text.includes('xét')) return 'Xét nghiệm'
  if (text.includes('prescription') || text.includes('thuốc')) return 'Đơn thuốc'
  if (text.includes('image') || text.includes('hình')) return 'Chẩn đoán hình ảnh'
  if (text.includes('diagnosis') || text.includes('chẩn')) return 'Chẩn đoán'
  return 'Bệnh án'
}

export default function PatientMedicalRecordsPage({
  encounters = [],
  labResults = [],
  loading = false,
  medicalRecords = [],
  prescriptions = [],
}) {
  const visits = useMemo(() => encounters.map(mapEncounter), [encounters])
  const recordRows = useMemo(() => mapRecordRows(medicalRecords, visits), [medicalRecords, visits])
  const prescriptionCount = prescriptions.length
  const labCount = labResults.length
  const [activeVisitId, setActiveVisitId] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const specialties = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.specialty).filter(Boolean))),
    [visits],
  )
  const statuses = useMemo(
    () => Array.from(new Set(visits.map((visit) => visit.statusLabel).filter(Boolean))),
    [visits],
  )

  const filteredVisits = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()

    return visits.filter((visit) => {
      const matchSpecialty = specialtyFilter === 'all' || visit.specialty === specialtyFilter
      const matchStatus = statusFilter === 'all' || visit.statusLabel === statusFilter
      const matchKeyword =
        !keyword ||
        [visit.doctor, visit.specialty, visit.reason, visit.diagnosis, visit.location]
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
  const recentVisits = filteredVisits.slice(0, 3)
  const statCards = [
    {
      id: 'records',
      label: 'Hồ sơ bệnh án',
      value: recordRows.length,
      unit: 'mục',
      icon: 'folder_shared',
      accent: 'blue',
      hint: '+2 mục mới',
    },
    {
      id: 'visits',
      label: 'Lần khám',
      value: visits.length,
      unit: 'lần',
      icon: 'medical_services',
      accent: 'cyan',
      hint: '+3 lần gần đây',
    },
    {
      id: 'prescriptions',
      label: 'Đơn thuốc',
      value: prescriptionCount,
      unit: 'đơn',
      icon: 'medication',
      accent: 'green',
      hint: '+1 đơn mới',
    },
    {
      id: 'labs',
      label: 'Xét nghiệm',
      value: labCount,
      unit: 'kết quả',
      icon: 'biotech',
      accent: 'violet',
      hint: '+4 kết quả mới',
    },
  ]

  const detailTabs = [
    { id: 'overview', label: 'Tổng quan' },
    { id: 'diagnosis', label: 'Chẩn đoán' },
    { id: 'prescriptions', label: 'Đơn thuốc' },
    { id: 'results', label: 'Kết quả' },
  ]

  const vitals = [
    { label: 'Huyết áp', value: '120/80', unit: 'mmHg', icon: 'bloodtype' },
    { label: 'Nhịp tim', value: '72', unit: 'lần/phút', icon: 'ecg_heart' },
    { label: 'Nhiệt độ', value: '36.6', unit: '°C', icon: 'thermometer' },
    { label: 'SpO2', value: '98', unit: '%', icon: 'water_drop' },
  ]

  const attachments = [
    {
      id: 'attachment-lab',
      title: labResults[0]?.test_name || 'Kết quả xét nghiệm mẫu',
      meta: labResults[0] ? 'Kết quả mới nhất' : 'PDF • 245 KB',
      icon: 'picture_as_pdf',
    },
    {
      id: 'attachment-image',
      title: 'Hình ảnh siêu âm ổ bụng',
      meta: 'JPG • 1.2 MB',
      icon: 'image',
    },
  ]

  return (
    <div className="patient-medical-records-page">
      <header className="patient-medical-records-header">
        <div>
          <h1>Hồ sơ y tế</h1>
          <p>Tổng hợp bệnh án, chẩn đoán, đơn thuốc, xét nghiệm và các lần khám liên quan.</p>
        </div>

        <button className="patient-medical-records-guide" type="button">
          <PatientIcon name="info" aria-hidden="true" />
          Hướng dẫn
        </button>
      </header>

      <section className="patient-medical-records-stats" aria-label="Tổng quan hồ sơ">
        {statCards.map((card) => (
          <article className={`patient-medical-records-stat is-${card.accent}`} key={card.id}>
            <span className="patient-medical-records-stat-icon" aria-hidden="true">
              <PatientIcon name={card.icon} />
            </span>
            <div className="patient-medical-records-stat-copy">
              <strong>{card.label}</strong>
              <div>
                <b>{card.value}</b>
                <span>{card.unit}</span>
              </div>
              <small>{card.hint}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="patient-medical-records-workspace">
        <div className="patient-medical-records-main">
          <section className="patient-medical-records-panel">
            <div className="patient-medical-records-panel-head">
              <div>
                <h2>Hồ sơ bệnh án gần đây</h2>
                <p>Những mục bệnh án và ghi chú lâm sàng quan trọng nhất.</p>
              </div>
              <span>{recordRows.length} mục</span>
            </div>

            <div className="patient-medical-records-preview">
              {loading ? <div className="patient-medical-records-empty">Đang tải hồ sơ y tế...</div> : null}

              {!loading && !recentVisits.length ? (
                <div className="patient-medical-records-empty">Chưa có hồ sơ bệnh án để hiển thị.</div>
              ) : null}

              {recentVisits.map((visit) => (
                <article
                  className={`patient-medical-records-preview-card${visit.id === activeVisit?.id ? ' is-active' : ''}`}
                  key={visit.id}
                >
                  <button type="button" onClick={() => setActiveVisitId(visit.id)}>
                    <div className="patient-medical-records-datebox">
                      <strong>{visit.dateParts.day}</strong>
                      <span>TH {visit.dateParts.month}</span>
                      <small>{visit.dateParts.year}</small>
                    </div>

                    <img src={visit.avatar} alt={visit.doctor} />

                    <div className="patient-medical-records-preview-copy">
                      <h3>{visit.doctor}</h3>
                      <p>
                        {visit.reason}
                        <span>•</span>
                        {visit.specialty}
                      </p>
                      <small>
                        <PatientIcon name="location_on" aria-hidden="true" />
                        {visit.location}
                      </small>
                    </div>

                    <span className={`patient-medical-records-status is-${visit.statusTone}`}>
                      {visit.statusLabel}
                    </span>
                  </button>

                  <div className="patient-medical-records-preview-meta">
                    <div>
                      <strong>{visit.time}</strong>
                      <span>{visit.fullDate}</span>
                    </div>
                    <button type="button" onClick={() => setActiveVisitId(visit.id)}>
                      Xem chi tiết
                      <PatientIcon name="chevron_right" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="patient-medical-records-table-panel">
            <div className="patient-medical-records-toolbar">
              <label className="patient-medical-records-filter">
                <PatientIcon name="calendar_today" aria-hidden="true" />
                <span>01/01/2025 - 25/04/2026</span>
                <PatientIcon name="expand_more" aria-hidden="true" />
              </label>

              <label className="patient-medical-records-filter">
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

              <label className="patient-medical-records-filter">
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

              <label className="patient-medical-records-search">
                <PatientIcon name="search" aria-hidden="true" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm bác sĩ, bệnh lý..."
                />
              </label>
            </div>

            <div className="patient-medical-records-table">
              <div className="patient-medical-records-table-head">
                <span>Ngày khám</span>
                <span>Bác sĩ</span>
                <span>Chuyên khoa</span>
                <span>Lý do khám</span>
                <span>Trạng thái</span>
              </div>

              {loading ? <div className="patient-medical-records-empty">Đang tải lịch sử khám...</div> : null}

              {!loading && !filteredVisits.length ? (
                <div className="patient-medical-records-empty">
                  Chưa có lần khám nào phù hợp với bộ lọc hiện tại.
                </div>
              ) : null}

              {filteredVisits.map((visit) => {
                const isActive = visit.id === activeVisit?.id

                return (
                  <button
                    className={`patient-medical-records-table-row${isActive ? ' is-active' : ''}`}
                    key={visit.id}
                    type="button"
                    onClick={() => {
                      setActiveVisitId(visit.id)
                      setActiveTab('overview')
                    }}
                  >
                    <span className="patient-medical-records-date-cell">
                      <strong>{visit.dateParts.day}</strong>
                      <small>{visit.time}</small>
                    </span>
                    <span className="patient-medical-records-doctor-cell">
                      <img src={visit.avatar} alt={visit.doctor} />
                      <span>{visit.doctor}</span>
                    </span>
                    <span>{visit.specialty}</span>
                    <span>{visit.reason}</span>
                    <span className={`patient-medical-records-status is-${visit.statusTone}`}>
                      {visit.statusLabel}
                    </span>
                  </button>
                )
              })}
            </div>

            {filteredVisits.length > 0 ? (
              <div className="patient-medical-records-pagination" aria-label="Phân trang hồ sơ">
                <button type="button" aria-label="Trang trước">
                  <PatientIcon name="chevron_left" aria-hidden="true" />
                </button>
                <button className="is-active" type="button">
                  1
                </button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button" aria-label="Trang sau">
                  <PatientIcon name="chevron_right" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="patient-medical-records-sidebar">
          <section className="patient-medical-records-detail">
            <div className="patient-medical-records-detail-head">
              <h2>Chi tiết hồ sơ</h2>
              <button type="button" aria-label="Đóng chi tiết">
                <PatientIcon name="close" aria-hidden="true" />
              </button>
            </div>

            {activeVisit ? (
              <>
                <div className="patient-medical-records-detail-summary">
                  <div className="patient-medical-records-detail-date">
                    <span>Thứ 6</span>
                    <strong>{activeVisit.dateParts.day}</strong>
                    <small>TH {activeVisit.dateParts.month}</small>
                    <em>{activeVisit.dateParts.year}</em>
                  </div>

                  <div className="patient-medical-records-detail-hero">
                    <div>
                      <h3>{activeVisit.reason}</h3>
                      <p>{activeVisit.doctor}</p>
                      <small>
                        <PatientIcon name="location_on" aria-hidden="true" />
                        {activeVisit.location}
                      </small>
                    </div>
                    <span className={`patient-medical-records-status is-${activeVisit.statusTone}`}>
                      {activeVisit.statusLabel}
                    </span>
                  </div>
                </div>

                <div className="patient-medical-records-tabs" role="tablist" aria-label="Chi tiết hồ sơ">
                  {detailTabs.map((tab) => (
                    <button
                      key={tab.id}
                      className={tab.id === activeTab ? 'is-active' : ''}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === activeTab}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'overview' ? (
                  <section className="patient-medical-records-section">
                    <div className="patient-medical-records-section-head">
                      <h3>Thông tin khám</h3>
                    </div>
                    <dl className="patient-medical-records-keylist">
                      <div>
                        <dt>Lý do khám</dt>
                        <dd>{activeVisit.reason}</dd>
                      </div>
                      <div>
                        <dt>Triệu chứng</dt>
                        <dd>Không có triệu chứng bất thường</dd>
                      </div>
                      <div>
                        <dt>Tiền sử bệnh</dt>
                        <dd>Tăng huyết áp, viêm dạ dày mạn</dd>
                      </div>
                      <div>
                        <dt>Dị ứng</dt>
                        <dd>Không ghi nhận</dd>
                      </div>
                      <div>
                        <dt>Ghi chú</dt>
                        <dd>{activeVisit.notes}</dd>
                      </div>
                    </dl>
                  </section>
                ) : null}

                {activeTab === 'diagnosis' ? (
                  <section className="patient-medical-records-section">
                    <div className="patient-medical-records-section-head">
                      <h3>Chẩn đoán</h3>
                    </div>
                    <p className="patient-medical-records-section-copy">{activeVisit.diagnosis}</p>
                  </section>
                ) : null}

                {activeTab === 'prescriptions' ? (
                  <section className="patient-medical-records-section">
                    <div className="patient-medical-records-section-head">
                      <h3>Đơn thuốc</h3>
                      <button type="button">Xem tất cả</button>
                    </div>
                    <ul className="patient-medical-records-list">
                      {prescriptions.length ? (
                        prescriptions.slice(0, 3).map((prescription, index) => (
                          <li key={prescription.prescription_id || index}>
                            <span>{prescription.prescription_no || `Đơn ${index + 1}`}</span>
                            <small>{formatDateTime(prescription.prescribed_at)}</small>
                          </li>
                        ))
                      ) : (
                        <li>Chưa có đơn thuốc từ backend.</li>
                      )}
                    </ul>
                  </section>
                ) : null}

                {activeTab === 'results' ? (
                  <section className="patient-medical-records-section">
                    <div className="patient-medical-records-section-head">
                      <h3>Kết quả xét nghiệm</h3>
                      <button type="button">Xem tất cả</button>
                    </div>
                    <ul className="patient-medical-records-list">
                      {labResults.length ? (
                        labResults.slice(0, 3).map((result, index) => (
                          <li key={result.lab_result_id || result._id || index}>
                            <span>{result.test_name || result.result_no || `Kết quả ${index + 1}`}</span>
                            <small>{result.summary || result.status || 'Đã cập nhật'}</small>
                          </li>
                        ))
                      ) : (
                        <li>Chưa có kết quả xét nghiệm từ backend.</li>
                      )}
                    </ul>
                  </section>
                ) : null}

                <section className="patient-medical-records-vitals">
                  <div className="patient-medical-records-section-head">
                    <h3>Chỉ số sinh tồn</h3>
                    <button type="button">Xem tất cả</button>
                  </div>
                  <div className="patient-medical-records-vitals-grid">
                    {vitals.map((item) => (
                      <article key={item.label}>
                        <span aria-hidden="true">
                          <PatientIcon name={item.icon} />
                        </span>
                        <strong>{item.label}</strong>
                        <b>{item.value}</b>
                        <small>{item.unit}</small>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="patient-medical-records-section">
                  <div className="patient-medical-records-section-head">
                    <h3>Tệp đính kèm</h3>
                  </div>
                  <ul className="patient-medical-records-attachments">
                    {attachments.map((item) => (
                      <li key={item.id}>
                        <span>
                          <PatientIcon name={item.icon} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.meta}</small>
                        </div>
                        <button type="button" aria-label={`Tải ${item.title}`}>
                          <PatientIcon name="download" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <button className="patient-medical-records-download-all" type="button">
                  <PatientIcon name="download" aria-hidden="true" />
                  Tải toàn bộ hồ sơ
                </button>
              </>
            ) : (
              <div className="patient-medical-records-empty">Chưa có chi tiết hồ sơ để hiển thị.</div>
            )}
          </section>
        </aside>
      </section>
    </div>
  )
}
