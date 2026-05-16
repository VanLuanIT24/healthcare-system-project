import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import procedureRoomHero from '../assets/procedure-room-hero.png'

const procedureFilters = [
  { id: 'all', label: 'Tất cả', icon: 'dashboard' },
  { id: 'completed', label: 'Hoàn tất', icon: 'check_circle' },
  { id: 'urgent', label: 'Ưu tiên cao', icon: 'warning' },
  { id: 'with-result', label: 'Có kết quả', icon: 'description' },
]

const performerAvatars = [
  '/images/scheduling/doctors/doctor-minh.svg',
  '/images/scheduling/doctors/doctor-khoa.svg',
  '/images/scheduling/doctors/doctor-lan.svg',
  '/images/scheduling/doctors/doctor-hanh.svg',
  '/images/scheduling/doctors/doctor-quang.svg',
]

function getDate(value) {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatProcedureDay(value) {
  const date = getDate(value)
  if (!date) return 'Chưa có lịch'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatProcedureTime(value) {
  const date = getDate(value)
  if (!date) return '--:--'

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getName(value, fallback = 'Đang cập nhật') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return value.full_name || value.department_name || value.username || fallback
}

function getProcedureStatusMeta(status, hasResult, priority) {
  if (['urgent', 'stat'].includes(priority)) {
    return { label: 'Ưu tiên cao', tone: 'urgent', group: 'active' }
  }

  if (hasResult) {
    return { label: 'Có kết quả', tone: 'result', group: 'completed' }
  }

  const map = {
    ordered: { label: 'Đã chỉ định', tone: 'waiting', group: 'active' },
    scheduled: { label: 'Đã lên lịch', tone: 'waiting', group: 'active' },
    in_progress: { label: 'Đang thực hiện', tone: 'active', group: 'active' },
    completed: { label: 'Hoàn tất', tone: 'completed', group: 'completed' },
    cancelled: { label: 'Đã hủy', tone: 'cancelled', group: 'cancelled' },
    no_show: { label: 'Không đến', tone: 'cancelled', group: 'cancelled' },
  }

  return map[status] || { label: status || 'Chưa cập nhật', tone: 'waiting', group: 'active' }
}

function getChargeText(chargeSummary) {
  if (!chargeSummary) return 'Chưa ghi nhận viện phí'

  const amount = Number(chargeSummary.total_amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) return 'Đã ghi nhận viện phí'

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

function getResultSummary(note) {
  const trimmed = String(note || '').trim()
  if (!trimmed) return 'Chưa có ghi chú kết quả từ backend.'
  return trimmed
}

function getPercentText(part, total) {
  if (!total) return '0% tổng số'
  const percent = (part / total) * 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}% tổng số`
}

function mapProcedure(procedure, index) {
  const id = procedure.procedure_order_id || procedure._id || procedure.id || `procedure-${index}`
  const hasResult = Boolean(String(procedure.result_note || '').trim())
  const status = getProcedureStatusMeta(procedure.status, hasResult, procedure.priority)
  const eventTime =
    procedure.completed_at ||
    procedure.performed_start ||
    procedure.scheduled_start ||
    procedure.created_at
  const performer = getName(procedure.performer_id, 'Chưa phân công')

  return {
    id,
    avatar: procedure.performer_id?.avatar_url || procedure.performer_id?.photo_url || performerAvatars[index % performerAvatars.length],
    code: procedure.procedure_order_no || procedure.procedure_code || `TT${new Date().getFullYear()}${String(index + 1).padStart(4, '0')}`,
    name: procedure.procedure_name || 'Thủ thuật',
    department: getName(procedure.department_id, 'Chưa có khoa'),
    performer,
    requestedBy: getName(procedure.requested_by, 'Chưa có người chỉ định'),
    encounterCode: procedure.encounter_id?.encounter_code || 'Chưa gắn lượt khám',
    status: status.label,
    statusTone: status.tone,
    statusGroup: status.group,
    dateLabel: formatProcedureDay(eventTime),
    timeLabel: formatProcedureTime(eventTime),
    scheduledAt: `${formatProcedureDay(procedure.scheduled_start)} ${formatProcedureTime(procedure.scheduled_start)}`,
    completedAt: `${formatProcedureDay(procedure.completed_at)} ${formatProcedureTime(procedure.completed_at)}`,
    resultNote: getResultSummary(procedure.result_note),
    clinicalIndication: procedure.clinical_indication || 'Chưa có chỉ định lâm sàng.',
    chargeText: getChargeText(procedure.charge_summary),
    hasResult,
    rawPriority: procedure.priority,
  }
}

function getStatusIcon(tone) {
  if (tone === 'urgent') return 'warning'
  if (tone === 'result') return 'description'
  if (tone === 'cancelled') return 'close'
  return 'check_circle'
}

function ProcedureHeroArt() {
  return (
    <div className="patient-procedure-hero-photo" aria-hidden="true">
      <img src={procedureRoomHero} alt="" />
    </div>
  )
}

function ProcedureEmptyState() {
  return (
    <div className="patient-procedure-empty-state">
      <div className="patient-procedure-empty-art" aria-hidden="true">
        <span className="patient-procedure-empty-spark patient-procedure-empty-spark--left" />
        <span className="patient-procedure-empty-spark patient-procedure-empty-spark--right" />
        <span className="patient-procedure-empty-paper">
          <i />
          <i />
        </span>
        <span className="patient-procedure-empty-folder" />
        <span className="patient-procedure-empty-search" />
      </div>
      <strong>Chưa có ghi chú hoặc kết quả</strong>
      <p>Thông tin ghi chú và kết quả của thủ thuật sẽ hiển thị tại đây khi có dữ liệu.</p>
      <button type="button">
        <PatientIcon name="help_outline" aria-hidden="true" />
        <span>Xem hướng dẫn</span>
      </button>
    </div>
  )
}

export default function PatientProceduresPage({ error = '', loading = false, procedures = [] }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedProcedureId, setSelectedProcedureId] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const procedureRows = useMemo(() => procedures.map(mapProcedure), [procedures])
  const completedCount = procedureRows.filter((procedure) => procedure.statusGroup === 'completed').length
  const urgentCount = procedureRows.filter((procedure) => ['urgent', 'stat'].includes(procedure.rawPriority)).length
  const resultCount = procedureRows.filter((procedure) => procedure.hasResult).length
  const filteredRows = useMemo(() => {
    if (activeFilter === 'all') return procedureRows
    if (activeFilter === 'completed') {
      return procedureRows.filter((procedure) => procedure.statusGroup === 'completed')
    }
    if (activeFilter === 'urgent') {
      return procedureRows.filter((procedure) => ['urgent', 'stat'].includes(procedure.rawPriority))
    }
    return procedureRows.filter((procedure) => procedure.hasResult)
  }, [activeFilter, procedureRows])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, pageCount)
  const pageStartIndex = (safeCurrentPage - 1) * pageSize
  const visibleRows = filteredRows.slice(pageStartIndex, pageStartIndex + pageSize)
  const selectedProcedure =
    filteredRows.find((procedure) => procedure.id === selectedProcedureId) || null
  const startResult = filteredRows.length ? pageStartIndex + 1 : 0
  const endResult = Math.min(pageStartIndex + pageSize, filteredRows.length)
  const firstPaginationPage = Math.max(1, Math.min(safeCurrentPage - 1, Math.max(1, pageCount - 2)))
  const paginationPages = Array.from(
    { length: Math.min(3, pageCount) },
    (_, index) => firstPaginationPage + index,
  ).filter((page) => page <= pageCount)

  useEffect(() => {
    setCurrentPage(1)
    setSelectedProcedureId('')
  }, [activeFilter, pageSize])

  useEffect(() => {
    if (!filteredRows.some((procedure) => procedure.id === selectedProcedureId)) {
      setSelectedProcedureId('')
    }

    if (currentPage > pageCount) {
      setCurrentPage(pageCount)
    }
  }, [currentPage, filteredRows, pageCount, selectedProcedureId])

  const summaryCards = [
    {
      id: 'total',
      label: 'Tổng thủ thuật',
      value: procedureRows.length,
      helper: 'Tất cả thủ thuật',
      icon: 'edit_note',
      tone: 'blue',
    },
    {
      id: 'completed',
      label: 'Hoàn tất',
      value: completedCount,
      helper: getPercentText(completedCount, procedureRows.length),
      icon: 'check_circle',
      tone: 'green',
    },
    {
      id: 'urgent',
      label: 'Ưu tiên cao',
      value: urgentCount,
      helper: 'Cần theo dõi',
      icon: 'warning',
      tone: 'orange',
    },
    {
      id: 'result',
      label: 'Có ghi chú kết quả',
      value: resultCount,
      helper: 'Đã có kết quả',
      icon: 'description',
      tone: 'violet',
    },
  ]

  return (
    <section className="patient-care-page patient-care-page--procedures">
      <header className="patient-care-header">
        <div>
          <span className="patient-care-eyebrow">Can thiệp và thủ thuật</span>
          <h1>Thủ thuật</h1>
          <p>Theo dõi thủ thuật đã hoàn tất, người thực hiện, lịch thực hiện, ghi chú kết quả và viện phí liên quan.</p>
        </div>

        <div className="patient-procedure-stats">
          {summaryCards.map((card) => (
            <article className={`patient-procedure-stat-card is-${card.tone}`} key={card.id}>
              <span className="patient-procedure-stat-icon" aria-hidden="true">
                <PatientIcon name={card.icon} />
              </span>
              <div>
                <strong>{card.label}</strong>
                <p>{card.value}</p>
                <small>{card.helper}</small>
              </div>
            </article>
          ))}
        </div>

        <ProcedureHeroArt />
      </header>

      {loading ? <div className="patient-care-state">Đang tải lịch sử thủ thuật...</div> : null}
      {!loading && error ? <div className="patient-care-state is-error">{error}</div> : null}

      <div className="patient-procedure-workspace">
        <div className="patient-procedure-main">
          <div className="patient-procedure-tabs" role="tablist" aria-label="Lọc lịch sử thủ thuật">
            {procedureFilters.map((filter) => {
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
                  <PatientIcon name={filter.icon} aria-hidden="true" />
                  <span>{filter.label}</span>
                </button>
              )
            })}
          </div>

          <div className="patient-procedure-table-panel">
            <div className="patient-procedure-table-head">
              <span>Mã thủ thuật</span>
              <span>Tên thủ thuật</span>
              <span>Thực hiện</span>
              <span>Thời gian</span>
              <span>Trạng thái</span>
              <span />
            </div>

            <div className="patient-procedure-table-body">
              {!loading && visibleRows.length === 0 ? (
                <div className="patient-procedure-table-empty">Chưa có thủ thuật phù hợp.</div>
              ) : null}

              {visibleRows.map((procedure) => (
                <button
                  key={procedure.id}
                  className={`patient-procedure-row${
                    selectedProcedure?.id === procedure.id ? ' is-selected' : ''
                  }`}
                  type="button"
                  onClick={() => setSelectedProcedureId(procedure.id)}
                >
                  <strong className="patient-procedure-code">{procedure.code}</strong>
                  <span className="patient-procedure-name">{procedure.name}</span>
                  <span className="patient-procedure-performer">
                    <img src={procedure.avatar} alt="" />
                    <span>
                      <strong>{procedure.performer}</strong>
                      <small>{procedure.department}</small>
                    </span>
                  </span>
                  <span className="patient-procedure-date">
                    <strong>{procedure.dateLabel}</strong>
                    <small>{procedure.timeLabel}</small>
                  </span>
                  <em className={`patient-procedure-status is-${procedure.statusTone}`}>
                    <PatientIcon name={getStatusIcon(procedure.statusTone)} aria-hidden="true" />
                    <span>{procedure.status}</span>
                  </em>
                  <span className="patient-procedure-more" aria-hidden="true">
                    <PatientIcon name="more_vert" />
                  </span>
                </button>
              ))}
            </div>

            <div className="patient-procedure-table-footer">
              <span>
                Hiển thị {startResult} - {endResult} của {filteredRows.length} kết quả
              </span>

              <div className="patient-procedure-pagination" aria-label="Phân trang thủ thuật">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  aria-label="Trang trước"
                >
                  <PatientIcon name="chevron_left" aria-hidden="true" />
                </button>
                {paginationPages.map((page) => (
                  <button
                    key={page}
                    className={page === safeCurrentPage ? 'is-current' : ''}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    aria-label={`Trang ${page}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safeCurrentPage === pageCount}
                  onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                  aria-label="Trang sau"
                >
                  <PatientIcon name="chevron_right" aria-hidden="true" />
                </button>
                <select
                  aria-label="Số dòng mỗi trang"
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                >
                  <option value={5}>5 / trang</option>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <aside className="patient-procedure-side-panel">
          <div className="patient-procedure-side-head">
            <span aria-hidden="true">
              <PatientIcon name="clinical_notes" />
            </span>
            <h2>Ghi chú & kết quả</h2>
          </div>

          {selectedProcedure ? (
            <div className="patient-procedure-result-detail">
              <span className={`patient-procedure-status is-${selectedProcedure.statusTone}`}>
                <PatientIcon name={getStatusIcon(selectedProcedure.statusTone)} aria-hidden="true" />
                <span>{selectedProcedure.status}</span>
              </span>
              <h3>{selectedProcedure.name}</h3>
              <p>{selectedProcedure.code}</p>

              <dl>
                <div>
                  <dt>Người thực hiện</dt>
                  <dd>{selectedProcedure.performer}</dd>
                </div>
                <div>
                  <dt>Khoa</dt>
                  <dd>{selectedProcedure.department}</dd>
                </div>
                <div>
                  <dt>Lịch thực hiện</dt>
                  <dd>{selectedProcedure.scheduledAt}</dd>
                </div>
                <div>
                  <dt>Hoàn tất</dt>
                  <dd>{selectedProcedure.completedAt}</dd>
                </div>
              </dl>

              <section>
                <h4>Chỉ định lâm sàng</h4>
                <p>{selectedProcedure.clinicalIndication}</p>
              </section>
              <section>
                <h4>Kết quả thủ thuật</h4>
                <p>{selectedProcedure.resultNote}</p>
              </section>
              <div className="patient-procedure-result-foot">
                <span>{selectedProcedure.chargeText}</span>
                <span>{selectedProcedure.encounterCode}</span>
              </div>
            </div>
          ) : (
            <ProcedureEmptyState />
          )}
        </aside>
      </div>
    </section>
  )
}
