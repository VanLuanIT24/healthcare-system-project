import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const procedureFilters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'completed', label: 'Hoàn tất' },
  { id: 'urgent', label: 'Ưu tiên cao' },
  { id: 'with-result', label: 'Có kết quả' },
]

function formatProcedureDate(value) {
  if (!value) return 'Chưa có thời gian'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian'

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getName(value, fallback = 'Đang cập nhật') {
  if (!value) return fallback
  if (typeof value === 'string') return value
  return value.full_name || value.department_name || value.username || fallback
}

function getProcedureStatusMeta(status) {
  const map = {
    ordered: { label: 'Đã chỉ định', tone: 'waiting', group: 'active' },
    scheduled: { label: 'Đã lên lịch', tone: 'waiting', group: 'active' },
    in_progress: { label: 'Đang thực hiện', tone: 'active', group: 'active' },
    completed: { label: 'Hoàn tất', tone: 'done', group: 'completed' },
    cancelled: { label: 'Đã hủy', tone: 'cancelled', group: 'cancelled' },
    no_show: { label: 'Không đến', tone: 'cancelled', group: 'cancelled' },
  }

  return map[status] || { label: status || 'Chưa cập nhật', tone: 'waiting', group: 'active' }
}

function getPriorityMeta(priority) {
  const map = {
    routine: { label: 'Thường quy', tone: 'soft' },
    urgent: { label: 'Khẩn', tone: 'warning' },
    stat: { label: 'Rất khẩn', tone: 'critical' },
  }

  return map[priority] || { label: priority || 'Thường quy', tone: 'soft' }
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

function mapProcedure(procedure, index) {
  const id = procedure.procedure_order_id || procedure._id || procedure.id || `procedure-${index}`
  const status = getProcedureStatusMeta(procedure.status)
  const priority = getPriorityMeta(procedure.priority)
  const eventTime =
    procedure.completed_at ||
    procedure.performed_start ||
    procedure.scheduled_start ||
    procedure.created_at

  return {
    id,
    code: procedure.procedure_order_no || procedure.procedure_code || `TT-${String(index + 1).padStart(4, '0')}`,
    name: procedure.procedure_name || 'Thủ thuật',
    department: getName(procedure.department_id, 'Chưa có khoa'),
    performer: getName(procedure.performer_id, 'Chưa phân công người thực hiện'),
    requestedBy: getName(procedure.requested_by, 'Chưa có người chỉ định'),
    encounterCode: procedure.encounter_id?.encounter_code || 'Chưa gắn lượt khám',
    status: status.label,
    statusTone: status.tone,
    statusGroup: status.group,
    priority: priority.label,
    priorityTone: priority.tone,
    scheduledAt: formatProcedureDate(procedure.scheduled_start),
    performedAt: formatProcedureDate(procedure.performed_start || procedure.completed_at),
    completedAt: formatProcedureDate(procedure.completed_at),
    resultNote: procedure.result_note || '',
    clinicalIndication: procedure.clinical_indication || 'Chưa có chỉ định lâm sàng.',
    chargeText: getChargeText(procedure.charge_summary),
    hasResult: Boolean(procedure.result_note),
    rawPriority: procedure.priority,
  }
}

export default function PatientProceduresPage({ error = '', loading = false, procedures = [] }) {
  const [activeFilter, setActiveFilter] = useState('all')
  const [selectedProcedureId, setSelectedProcedureId] = useState('')
  const procedureRows = useMemo(() => procedures.map(mapProcedure), [procedures])
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
  const selectedProcedure =
    filteredRows.find((procedure) => procedure.id === selectedProcedureId) || filteredRows[0] || null

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedProcedureId('')
      return
    }

    if (!filteredRows.some((procedure) => procedure.id === selectedProcedureId)) {
      setSelectedProcedureId(filteredRows[0].id)
    }
  }, [filteredRows, selectedProcedureId])

  const summaryCards = [
    {
      id: 'total',
      label: 'Tổng thủ thuật',
      value: procedureRows.length,
      icon: 'clinical_notes',
      tone: 'blue',
    },
    {
      id: 'completed',
      label: 'Hoàn tất',
      value: procedureRows.filter((procedure) => procedure.statusGroup === 'completed').length,
      icon: 'check_circle',
      tone: 'green',
    },
    {
      id: 'urgent',
      label: 'Ưu tiên cao',
      value: procedureRows.filter((procedure) => ['urgent', 'stat'].includes(procedure.rawPriority)).length,
      icon: 'warning',
      tone: 'orange',
    },
    {
      id: 'result',
      label: 'Có ghi chú kết quả',
      value: procedureRows.filter((procedure) => procedure.hasResult).length,
      icon: 'description',
      tone: 'soft',
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
        <span className="patient-care-header-icon" aria-hidden="true">
          <PatientIcon name="clinical_notes" />
        </span>
      </header>

      {loading ? <div className="patient-care-state">Đang tải lịch sử thủ thuật...</div> : null}
      {!loading && error ? <div className="patient-care-state is-error">{error}</div> : null}

      <div className="patient-care-summary-grid">
        {summaryCards.map((card) => (
          <article className={`patient-care-summary-card ${card.tone}`} key={card.id}>
            <span aria-hidden="true">
              <PatientIcon name={card.icon} />
            </span>
            <div>
              <strong>{card.label}</strong>
              <p>{card.value}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="patient-care-tabs" role="tablist" aria-label="Lọc lịch sử thủ thuật">
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
              {filter.label}
            </button>
          )
        })}
      </div>

      <div className="patient-care-layout">
        <div className="patient-care-list-panel">
          <div className="patient-care-list-head patient-care-list-head--procedure">
            <span>Mã thủ thuật</span>
            <span>Tên thủ thuật</span>
            <span>Thực hiện</span>
            <span>Trạng thái</span>
          </div>

          <div className="patient-care-list">
            {!loading && filteredRows.length === 0 ? (
              <div className="patient-care-empty">Chưa có thủ thuật phù hợp.</div>
            ) : null}

            {filteredRows.map((procedure) => (
              <button
                key={procedure.id}
                className={`patient-care-row patient-care-row--procedure${
                  selectedProcedure?.id === procedure.id ? ' is-selected' : ''
                }`}
                type="button"
                onClick={() => setSelectedProcedureId(procedure.id)}
              >
                <strong>{procedure.code}</strong>
                <span>{procedure.name}</span>
                <span>{procedure.performedAt}</span>
                <em className={`patient-care-status ${procedure.statusTone}`}>{procedure.status}</em>
              </button>
            ))}
          </div>
        </div>

        <aside className="patient-care-detail-panel">
          {selectedProcedure ? (
            <>
              <div className="patient-care-detail-head">
                <span className={`patient-care-status ${selectedProcedure.statusTone}`}>{selectedProcedure.status}</span>
                <h2>{selectedProcedure.name}</h2>
                <p>{selectedProcedure.code}</p>
              </div>

              <div className="patient-care-detail-list">
                <div>
                  <PatientIcon name="apartment" aria-hidden="true" />
                  <span>Khoa thực hiện</span>
                  <strong>{selectedProcedure.department}</strong>
                </div>
                <div>
                  <PatientIcon name="person" aria-hidden="true" />
                  <span>Người thực hiện</span>
                  <strong>{selectedProcedure.performer}</strong>
                </div>
                <div>
                  <PatientIcon name="clinical_notes" aria-hidden="true" />
                  <span>Người chỉ định</span>
                  <strong>{selectedProcedure.requestedBy}</strong>
                </div>
                <div>
                  <PatientIcon name="history_edu" aria-hidden="true" />
                  <span>Lượt khám</span>
                  <strong>{selectedProcedure.encounterCode}</strong>
                </div>
                <div>
                  <PatientIcon name="calendar_today" aria-hidden="true" />
                  <span>Lịch thực hiện</span>
                  <strong>{selectedProcedure.scheduledAt}</strong>
                </div>
                <div>
                  <PatientIcon name="check_circle" aria-hidden="true" />
                  <span>Hoàn tất</span>
                  <strong>{selectedProcedure.completedAt}</strong>
                </div>
              </div>

              <section className="patient-care-note">
                <h3>Chỉ định lâm sàng</h3>
                <p>{selectedProcedure.clinicalIndication}</p>
              </section>

              <section className="patient-care-note">
                <h3>Kết quả thủ thuật</h3>
                <p>{selectedProcedure.resultNote || 'Chưa có ghi chú kết quả từ backend.'}</p>
              </section>

              <div className="patient-care-inline-meta">
                <span className={`patient-care-priority ${selectedProcedure.priorityTone}`}>
                  {selectedProcedure.priority}
                </span>
                <span>{selectedProcedure.chargeText}</span>
              </div>
            </>
          ) : (
            <div className="patient-care-empty">Chưa có lịch sử thủ thuật để hiển thị.</div>
          )}
        </aside>
      </div>
    </section>
  )
}
