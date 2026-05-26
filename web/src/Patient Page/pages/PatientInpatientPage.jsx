import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import inpatientWardHero from '../assets/inpatient-ward-hero.png'

const admissionFilters = [
  { id: 'current', label: 'Hiện tại' },
  { id: 'history', label: 'Lịch sử nội trú' },
  { id: 'bed', label: 'Phòng / giường' },
  { id: 'medications', label: 'Thuốc nội trú' },
  { id: 'nursing', label: 'Chăm sóc điều dưỡng' },
  { id: 'charges', label: 'Chi phí nội trú' },
  { id: 'documents', label: 'Giấy ra viện' },
]

const admissionTypeLabels = {
  elective: 'Chủ động',
  emergency: 'Cấp cứu',
  transfer: 'Chuyển viện',
  observation: 'Theo dõi',
  day_case: 'Trong ngày',
}

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

function formatShortDate(value) {
  if (!value) return 'Chưa cập nhật'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatRelativeDays(value) {
  if (!value) return 'Chưa có dữ liệu'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return 'Hôm nay'
  if (diffDays > 0) return `${diffDays} ngày trước`
  return `${Math.abs(diffDays)} ngày tới`
}

function formatStayLength(startValue, endValue) {
  if (!startValue) return 'Chưa nhập viện'

  const start = new Date(startValue)
  if (Number.isNaN(start.getTime())) return 'Chưa nhập viện'

  const end = endValue ? new Date(endValue) : new Date()
  if (Number.isNaN(end.getTime())) return 'Đang cập nhật'

  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
  return `${days} ngày`
}

function formatCurrency(value) {
  const number = Number(value || 0)
  if (!number) return 'Chưa cập nhật'

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(number)
}

function getAdmissionStatusMeta(status) {
  const map = {
    planned: { label: 'Chờ nhập viện', tone: 'waiting', group: 'planned' },
    admitted: { label: 'Đang nội trú', tone: 'active', group: 'active' },
    transferred: { label: 'Đã chuyển khoa/giường', tone: 'active', group: 'active' },
    discharged: { label: 'Đã ra viện', tone: 'done', group: 'completed' },
    cancelled: { label: 'Đã hủy', tone: 'cancelled', group: 'cancelled' },
  }

  return map[status] || { label: status || 'Chưa cập nhật', tone: 'waiting', group: 'planned' }
}

function getName(value, fallback = 'Đang cập nhật') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return value.full_name || value.department_name || value.room_name || value.bed_name || value.username || fallback
}

function getDepartmentName(admission) {
  return getName(admission.department_id, admission.department_name || 'Chưa có khoa')
}

function getDoctorName(admission) {
  return getName(admission.attending_doctor_id, admission.attending_doctor_name || 'Chưa phân công bác sĩ')
}

function getBedLabel(admission) {
  const assignment = admission.current_bed_assignment
  const bed = assignment?.bed_id
  const room = bed?.room_id
  const parts = [
    room?.room_name || room?.room_code,
    bed?.bed_name || bed?.bed_code,
  ].filter(Boolean)

  return parts.length ? parts.join(' · ') : 'Chưa gán giường'
}

function mapAdmission(admission, index) {
  const id = admission.admission_id || admission._id || admission.id || `admission-${index}`
  const status = getAdmissionStatusMeta(admission.status)
  const admittedAt = admission.admitted_at || admission.created_at
  const endedAt = admission.discharged_at || admission.cancelled_at
  const endLabel = status.group === 'cancelled'
    ? 'Đã hủy'
    : status.group === 'completed'
      ? 'Ra viện'
      : status.group === 'active'
        ? 'Dự kiến ra viện'
        : 'Dự kiến nhập viện'

  return {
    id,
    raw: admission,
    number: admission.admission_no || `NT-${String(index + 1).padStart(4, '0')}`,
    type: admissionTypeLabels[admission.admission_type] || admission.admission_type || 'Nội trú',
    department: getDepartmentName(admission),
    doctor: getDoctorName(admission),
    bed: getBedLabel(admission),
    status: status.label,
    statusTone: status.tone,
    statusGroup: status.group,
    admittedAt: formatDateTime(admittedAt),
    dischargedAt: endedAt ? formatDateTime(endedAt) : 'Chưa ra viện',
    expectedDischargeAt: formatDate(admission.expected_discharge_at || admission.estimated_discharge_at),
    stayLength: formatStayLength(admittedAt, endedAt),
    admittedDate: formatShortDate(admittedAt),
    endedDate: endedAt ? formatShortDate(endedAt) : 'Chưa cập nhật',
    endLabel,
    reason: admission.reason || admission.discharge_summary || 'Chưa có ghi chú từ backend.',
    disposition: admission.discharge_disposition || 'Chưa cập nhật',
    nurse:
      getName(admission.primary_nurse_id, admission.primary_nurse_name || admission.nurse_name || 'Chưa phân công điều dưỡng'),
    mainOrders:
      admission.main_orders ||
      admission.active_orders_summary ||
      admission.care_plan_summary ||
      'Y lệnh chính sẽ được cập nhật từ hồ sơ nội trú.',
    medications:
      admission.medications_summary ||
      admission.inpatient_medications_summary ||
      'Thuốc nội trú sẽ hiển thị khi khoa điều trị phát hành.',
    charges:
      formatCurrency(
        admission.estimated_charges ||
          admission.current_charges ||
          admission.charges_summary?.total_amount ||
          admission.charges_summary?.balance_due,
      ),
    paperwork:
      admission.paperwork_status ||
      admission.discharge_documents_status ||
      'Chưa có giấy tờ cần hoàn tất.',
    rawAdmittedAt: admittedAt,
  }
}

function formatCount(value) {
  return String(value).padStart(2, '0')
}

function getLatestAdmission(admissions) {
  return admissions.reduce((latest, admission) => {
    if (!admission.rawAdmittedAt) return latest
    if (!latest) return admission

    const currentTime = new Date(admission.rawAdmittedAt).getTime()
    const latestTime = new Date(latest.rawAdmittedAt).getTime()
    return currentTime > latestTime ? admission : latest
  }, null)
}

function InpatientHeroArt() {
  return (
    <div className="patient-inpatient-hero-photo" aria-hidden="true">
      <img src={inpatientWardHero} alt="" />
    </div>
  )
}

function InpatientEmptyState() {
  return (
    <div className="patient-inpatient-empty-state">
      <div className="patient-inpatient-empty-art" aria-hidden="true">
        <span className="patient-inpatient-empty-art__leaf patient-inpatient-empty-art__leaf--left" />
        <span className="patient-inpatient-empty-art__leaf patient-inpatient-empty-art__leaf--right" />
        <div className="patient-inpatient-empty-art__board">
          <span className="patient-inpatient-empty-art__clip" />
          <PatientIcon name="add" />
          <span className="patient-inpatient-empty-art__line" />
          <span className="patient-inpatient-empty-art__line" />
          <span className="patient-inpatient-empty-art__line" />
        </div>
      </div>
      <strong>Chưa có hồ sơ nội trú để hiển thị.</strong>
      <p>Các lần nhập viện sẽ được hiển thị tại đây.</p>
    </div>
  )
}

export default function PatientInpatientPage({ admissions = [], error = '', loading = false }) {
  const [activeFilter, setActiveFilter] = useState('current')
  const [selectedAdmissionId, setSelectedAdmissionId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const admissionRows = useMemo(() => admissions.map(mapAdmission), [admissions])
  const filteredRows = useMemo(() => {
    if (activeFilter === 'current') {
      const currentRows = admissionRows.filter((admission) => admission.statusGroup === 'active')
      return currentRows.length ? currentRows : admissionRows.slice(0, 1)
    }

    if (activeFilter === 'history') {
      return admissionRows.filter((admission) => admission.statusGroup !== 'active')
    }

    return admissionRows
  }, [activeFilter, admissionRows])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [currentPage, filteredRows, pageSize])
  const selectedAdmission =
    filteredRows.find((admission) => admission.id === selectedAdmissionId) || null
  const latestAdmission = getLatestAdmission(admissionRows)
  const currentAdmission =
    admissionRows.find((admission) => admission.statusGroup === 'active') || latestAdmission
  const activeCount = admissionRows.filter((admission) => admission.statusGroup === 'active').length
  const completedCount = admissionRows.filter((admission) => admission.statusGroup === 'completed').length
  const displayStart = filteredRows.length ? (currentPage - 1) * pageSize + 1 : 0
  const displayEnd = Math.min(currentPage * pageSize, filteredRows.length)

  useEffect(() => {
    setCurrentPage(1)
  }, [activeFilter])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  useEffect(() => {
    if (!filteredRows.some((admission) => admission.id === selectedAdmissionId)) {
      setSelectedAdmissionId(filteredRows[0]?.id || '')
    }
  }, [filteredRows, selectedAdmissionId])

  const summaryCards = [
    {
      id: 'total',
      label: 'Tổng lần nội trú',
      value: formatCount(admissionRows.length),
      unit: 'Lần',
      icon: 'local_hospital',
      tone: 'blue',
    },
    {
      id: 'active',
      label: 'Đang nội trú',
      value: formatCount(activeCount),
      unit: 'Lần',
      caption: 'so với 6 tháng trước',
      trend: activeCount ? `↑ ${activeCount}` : '',
      icon: 'monitor_heart',
      tone: 'green',
    },
    {
      id: 'completed',
      label: 'Đã ra viện',
      value: formatCount(completedCount),
      unit: 'Lần',
      caption: 'so với 6 tháng trước',
      trend: '−',
      icon: 'check_circle',
      tone: 'soft',
    },
    {
      id: 'latest',
      label: 'Lần gần nhất',
      value: latestAdmission ? formatShortDate(latestAdmission.rawAdmittedAt) : 'Chưa có',
      caption: latestAdmission ? formatRelativeDays(latestAdmission.rawAdmittedAt) : 'Chưa có dữ liệu',
      icon: 'calendar_today',
      tone: 'slate',
      compact: true,
    },
  ]

  return (
    <section className="patient-care-page patient-care-page--inpatient">
      <header className="patient-care-header patient-inpatient-hero">
        <div>
          <span className="patient-care-eyebrow">Điều trị nội trú</span>
          <h1>Nội trú</h1>
          <p>Theo dõi các lần nhập viện, khoa điều trị, bác sĩ phụ trách, giường bệnh và trạng thái ra viện.</p>
        </div>
        <div className="patient-care-summary-grid">
          {summaryCards.map((card) => (
            <article className={`patient-care-summary-card ${card.tone}`} key={card.id}>
              <span aria-hidden="true">
                <PatientIcon name={card.icon} />
              </span>
              <div>
                <strong>{card.label}</strong>
                <p className={card.compact ? 'is-compact' : ''}>
                  {card.value}
                  {card.unit ? <small>{card.unit}</small> : null}
                </p>
                {card.caption || card.trend ? (
                  <div className="patient-inpatient-card-meta">
                    {card.caption ? <small>{card.caption}</small> : null}
                    {card.trend ? <em>{card.trend}</em> : null}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <InpatientHeroArt />
      </header>

      {loading ? <div className="patient-care-state">Đang tải dữ liệu nội trú...</div> : null}
      {!loading && error ? <div className="patient-care-state is-error">{error}</div> : null}

      {!loading && currentAdmission ? (
        <section className="patient-panel patient-inpatient-current-panel">
          <div className="patient-inpatient-current-head">
            <div>
              <p className="patient-section-label">Đợt nội trú hiện tại</p>
              <h2>{currentAdmission.number}</h2>
              <span className={`patient-care-status ${currentAdmission.statusTone}`}>{currentAdmission.status}</span>
            </div>
            <strong>{currentAdmission.department}</strong>
          </div>

          <div className="patient-inpatient-current-grid">
            <div>
              <span>Khoa / phòng / giường</span>
              <strong>{currentAdmission.bed}</strong>
            </div>
            <div>
              <span>Bác sĩ điều trị</span>
              <strong>{currentAdmission.doctor}</strong>
            </div>
            <div>
              <span>Điều dưỡng phụ trách</span>
              <strong>{currentAdmission.nurse}</strong>
            </div>
            <div>
              <span>Ngày nhập viện</span>
              <strong>{currentAdmission.admittedAt}</strong>
            </div>
            <div>
              <span>Dự kiến ra viện</span>
              <strong>{currentAdmission.expectedDischargeAt}</strong>
            </div>
            <div>
              <span>Chi phí tạm tính</span>
              <strong>{currentAdmission.charges}</strong>
            </div>
          </div>

          <div className="patient-inpatient-current-notes">
            <article>
              <h3>Y lệnh chính</h3>
              <p>{currentAdmission.mainOrders}</p>
            </article>
            <article>
              <h3>Thuốc nội trú</h3>
              <p>{currentAdmission.medications}</p>
            </article>
            <article>
              <h3>Giấy tờ cần hoàn tất</h3>
              <p>{currentAdmission.paperwork}</p>
            </article>
          </div>
        </section>
      ) : null}

      <div className="patient-care-tabs" role="tablist" aria-label="Lọc hồ sơ nội trú">
        {admissionFilters.map((filter) => {
          const isActive = activeFilter === filter.id

          return (
            <button
              key={filter.id}
              className={isActive ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      <div className="patient-care-layout">
        <div className="patient-care-list-panel">
          <div className="patient-care-list-head patient-care-list-head--inpatient">
            <span>Mã nội trú</span>
            <span>Khoa</span>
            <span>Thời gian</span>
            <span>Trạng thái</span>
            <span>Thao tác</span>
          </div>

          <div className="patient-care-list">
            {!loading && filteredRows.length === 0 ? (
              <div className="patient-care-empty">Chưa có hồ sơ nội trú phù hợp.</div>
            ) : null}

            {pagedRows.map((admission) => (
              <div
                key={admission.id}
                className={`patient-care-row patient-care-row--inpatient${
                  selectedAdmission?.id === admission.id ? ' is-selected' : ''
                }`}
              >
                <strong>{admission.number}</strong>
                <span>{admission.department}</span>
                <span className="patient-inpatient-time">
                  <span>Nhập viện: {admission.admittedDate}</span>
                  <span>{admission.endLabel}: {admission.endedDate}</span>
                </span>
                <em className={`patient-care-status ${admission.statusTone}`}>{admission.status}</em>
                <button
                  className="patient-inpatient-detail-button"
                  type="button"
                  onClick={() => setSelectedAdmissionId(admission.id)}
                >
                  <span>Xem chi tiết</span>
                  <PatientIcon name="chevron_right" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <footer className="patient-inpatient-table-footer">
            <span>
              Hiển thị {displayStart} - {displayEnd} của {filteredRows.length} kết quả
            </span>
            <div className="patient-inpatient-pagination">
              <button
                type="button"
                aria-label="Trang trước"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <PatientIcon name="chevron_left" />
              </button>
              <button
                type="button"
                className="is-current"
                aria-label={`Trang ${currentPage}`}
              >
                {currentPage}
              </button>
              <button
                type="button"
                aria-label="Trang sau"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                <PatientIcon name="chevron_right" />
              </button>
              <select
                aria-label="Số dòng mỗi trang"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
              </select>
            </div>
          </footer>
        </div>

        <aside className="patient-care-detail-panel patient-inpatient-side-panel">
          {selectedAdmission ? (
            <>
              <div className="patient-care-detail-head">
                <span className={`patient-care-status ${selectedAdmission.statusTone}`}>{selectedAdmission.status}</span>
                <h2>{selectedAdmission.number}</h2>
                <p>{selectedAdmission.type}</p>
              </div>

              <div className="patient-care-detail-list">
                <div>
                  <PatientIcon name="apartment" aria-hidden="true" />
                  <span>Khoa điều trị</span>
                  <strong>{selectedAdmission.department}</strong>
                </div>
                <div>
                  <PatientIcon name="person" aria-hidden="true" />
                  <span>Bác sĩ phụ trách</span>
                  <strong>{selectedAdmission.doctor}</strong>
                </div>
                <div>
                  <PatientIcon name="local_hospital" aria-hidden="true" />
                  <span>Giường hiện tại</span>
                  <strong>{selectedAdmission.bed}</strong>
                </div>
                <div>
                  <PatientIcon name="calendar_today" aria-hidden="true" />
                  <span>Nhập viện</span>
                  <strong>{selectedAdmission.admittedAt}</strong>
                </div>
                <div>
                  <PatientIcon name="check_circle" aria-hidden="true" />
                  <span>Ra viện</span>
                  <strong>{selectedAdmission.dischargedAt}</strong>
                </div>
                <div>
                  <PatientIcon name="schedule" aria-hidden="true" />
                  <span>Thời gian nằm viện</span>
                  <strong>{selectedAdmission.stayLength}</strong>
                </div>
              </div>

              <section className="patient-inpatient-tab-detail">
                {activeFilter === 'bed' ? (
                  <>
                    <h3>Phòng / giường</h3>
                    <p>{selectedAdmission.bed}</p>
                    <small>Khoa {selectedAdmission.department}</small>
                  </>
                ) : null}
                {activeFilter === 'medications' ? (
                  <>
                    <h3>Thuốc nội trú</h3>
                    <p>{selectedAdmission.medications}</p>
                  </>
                ) : null}
                {activeFilter === 'nursing' ? (
                  <>
                    <h3>Chăm sóc điều dưỡng</h3>
                    <p>Điều dưỡng phụ trách: {selectedAdmission.nurse}</p>
                  </>
                ) : null}
                {activeFilter === 'charges' ? (
                  <>
                    <h3>Chi phí nội trú</h3>
                    <p>Tạm tính: {selectedAdmission.charges}</p>
                  </>
                ) : null}
                {activeFilter === 'documents' ? (
                  <>
                    <h3>Giấy ra viện</h3>
                    <p>{selectedAdmission.paperwork}</p>
                  </>
                ) : null}
                {['current', 'history'].includes(activeFilter) ? (
                  <>
                    <h3>Tóm tắt nội trú</h3>
                    <p>{selectedAdmission.mainOrders}</p>
                  </>
                ) : null}
              </section>

              <section className="patient-care-note">
                <h3>Lý do / ghi chú</h3>
                <p>{selectedAdmission.reason}</p>
              </section>

              <section className="patient-care-note">
                <h3>Hướng xử trí ra viện</h3>
                <p>{selectedAdmission.disposition}</p>
              </section>
            </>
          ) : (
            <InpatientEmptyState />
          )}
        </aside>
      </div>
    </section>
  )
}
