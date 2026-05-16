import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const admissionFilters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'active', label: 'Đang nội trú' },
  { id: 'planned', label: 'Chờ nhập viện' },
  { id: 'completed', label: 'Đã ra viện' },
  { id: 'cancelled', label: 'Đã hủy' },
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

function formatStayLength(startValue, endValue) {
  if (!startValue) return 'Chưa nhập viện'

  const start = new Date(startValue)
  if (Number.isNaN(start.getTime())) return 'Chưa nhập viện'

  const end = endValue ? new Date(endValue) : new Date()
  if (Number.isNaN(end.getTime())) return 'Đang cập nhật'

  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
  return `${days} ngày`
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

  return {
    id,
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
    stayLength: formatStayLength(admittedAt, endedAt),
    reason: admission.reason || admission.discharge_summary || 'Chưa có ghi chú từ backend.',
    disposition: admission.discharge_disposition || 'Chưa cập nhật',
    rawAdmittedAt: admittedAt,
  }
}

export default function PatientInpatientPage({ admissions = [], error = '', loading = false }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedAdmissionId, setSelectedAdmissionId] = useState('')
  const admissionRows = useMemo(() => admissions.map(mapAdmission), [admissions])
  const filteredRows = useMemo(() => {
    if (activeFilter === 'all') return admissionRows
    return admissionRows.filter((admission) => admission.statusGroup === activeFilter)
  }, [activeFilter, admissionRows])
  const selectedAdmission =
    filteredRows.find((admission) => admission.id === selectedAdmissionId) || filteredRows[0] || null
  const latestAdmission = admissionRows[0]

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedAdmissionId('')
      return
    }

    if (!filteredRows.some((admission) => admission.id === selectedAdmissionId)) {
      setSelectedAdmissionId(filteredRows[0].id)
    }
  }, [filteredRows, selectedAdmissionId])

  const summaryCards = [
    {
      id: 'total',
      label: 'Tổng lần nội trú',
      value: admissionRows.length,
      icon: 'local_hospital',
      tone: 'blue',
    },
    {
      id: 'active',
      label: 'Đang nội trú',
      value: admissionRows.filter((admission) => admission.statusGroup === 'active').length,
      icon: 'monitor_heart',
      tone: 'green',
    },
    {
      id: 'completed',
      label: 'Đã ra viện',
      value: admissionRows.filter((admission) => admission.statusGroup === 'completed').length,
      icon: 'check_circle',
      tone: 'soft',
    },
    {
      id: 'latest',
      label: 'Lần gần nhất',
      value: latestAdmission ? formatDate(latestAdmission.rawAdmittedAt) : 'Chưa có',
      icon: 'calendar_today',
      tone: 'slate',
      compact: true,
    },
  ]

  return (
    <section className="patient-care-page patient-care-page--inpatient">
      <header className="patient-care-header">
        <div>
          <span className="patient-care-eyebrow">Điều trị nội trú</span>
          <h1>Nội trú</h1>
          <p>Theo dõi các lần nhập viện, khoa điều trị, bác sĩ phụ trách, giường bệnh và trạng thái ra viện.</p>
        </div>
        <span className="patient-care-header-icon" aria-hidden="true">
          <PatientIcon name="local_hospital" />
        </span>
      </header>

      {loading ? <div className="patient-care-state">Đang tải dữ liệu nội trú...</div> : null}
      {!loading && error ? <div className="patient-care-state is-error">{error}</div> : null}

      <div className="patient-care-summary-grid">
        {summaryCards.map((card) => (
          <article className={`patient-care-summary-card ${card.tone}`} key={card.id}>
            <span aria-hidden="true">
              <PatientIcon name={card.icon} />
            </span>
            <div>
              <strong>{card.label}</strong>
              <p className={card.compact ? 'is-compact' : ''}>{card.value}</p>
            </div>
          </article>
        ))}
      </div>

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
          <div className="patient-care-list-head">
            <span>Mã nội trú</span>
            <span>Khoa</span>
            <span>Thời gian</span>
            <span>Trạng thái</span>
          </div>

          <div className="patient-care-list">
            {!loading && filteredRows.length === 0 ? (
              <div className="patient-care-empty">Chưa có hồ sơ nội trú phù hợp.</div>
            ) : null}

            {filteredRows.map((admission) => (
              <button
                key={admission.id}
                className={`patient-care-row${selectedAdmission?.id === admission.id ? ' is-selected' : ''}`}
                type="button"
                onClick={() => setSelectedAdmissionId(admission.id)}
              >
                <strong>{admission.number}</strong>
                <span>{admission.department}</span>
                <span>{admission.admittedAt}</span>
                <em className={`patient-care-status ${admission.statusTone}`}>{admission.status}</em>
              </button>
            ))}
          </div>
        </div>

        <aside className="patient-care-detail-panel">
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
            <div className="patient-care-empty">Chưa có hồ sơ nội trú để hiển thị.</div>
          )}
        </aside>
      </div>
    </section>
  )
}
