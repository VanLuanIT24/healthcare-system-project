import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileClock,
  FilePlus2,
  HelpCircle,
  ListPlus,
  MoreVertical,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { doctorApi } from './doctorApi'
import { safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './toast/ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 7

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function idOf(order = {}) {
  return order.procedure_order_id || order.order_id || order.id || order._id || ''
}

function procedureCode(order = {}, index = 0) {
  return order.procedure_code || order.order_code || order.code || idOf(order) || `PRC-${String(index + 1).padStart(4, '0')}`
}

function patientName(order = {}) {
  return order.patient_name || order.patient?.full_name || order.patient?.name || 'Bệnh nhân'
}

function patientLine(order = {}) {
  return [order.patient_gender, order.patient_age ? `${order.patient_age} tuổi` : ''].filter(Boolean).join(', ') || order.patient_code || '--'
}

function encounterCode(order = {}) {
  return order.encounter_code || order.encounter?.encounter_code || order.encounter_id || '--'
}

function encounterType(order = {}) {
  return order.encounter_type || order.encounter?.type || order.visit_type || 'Ngoại trú'
}

function procedureName(order = {}) {
  return order.procedure_name || order.service_name || order.service?.service_name || order.title || order.name || 'Thủ thuật'
}

function roomName(order = {}) {
  return order.procedure_room || order.procedure_room_name || order.room_name || order.department_name || 'P. Thủ thuật'
}

function orderTime(order = {}) {
  return order.scheduled_at || order.started_at || order.created_at || order.ordered_at || order.updated_at || ''
}

function statusInfo(order = {}) {
  const raw = String(order.status || '').toLowerCase()
  if (['completed', 'complete', 'done', 'finished'].includes(raw)) return { label: 'Hoàn tất', tone: 'green', group: 'completed' }
  if (['started', 'in_progress', 'processing', 'performing'].includes(raw)) return { label: 'Đang thực hiện', tone: 'blue', group: 'processing' }
  if (['follow_up', 'monitoring', 'post_procedure'].includes(raw)) return { label: 'Theo dõi sau thủ thuật', tone: 'purple', group: 'follow' }
  if (['cancelled', 'canceled', 'voided'].includes(raw)) return { label: 'Hủy', tone: 'slate', group: 'cancelled' }
  return { label: 'Chờ thực hiện', tone: 'orange', group: 'waiting' }
}

function priorityInfo(order = {}) {
  const raw = String(order.priority || order.urgency || '').toLowerCase()
  if (['stat', 'urgent', 'high', 'cao', 'emergency'].includes(raw)) return { label: 'Cao', tone: 'red', score: 3 }
  if (['low', 'thap', 'thấp'].includes(raw)) return { label: 'Thấp', tone: 'green', score: 1 }
  return { label: 'Trung bình', tone: 'orange', score: 2 }
}

function matchSearch(order, keyword) {
  if (!keyword) return true
  const text = [
    procedureCode(order),
    patientName(order),
    order.patient_code,
    encounterCode(order),
    procedureName(order),
    roomName(order),
  ].filter(Boolean).join(' ').toLowerCase()
  return text.includes(keyword.toLowerCase())
}

function withinTime(order, value) {
  if (value === 'all') return true
  const date = new Date(orderTime(order))
  if (Number.isNaN(date.getTime())) return false
  if (value === 'today') return date.toDateString() === new Date().toDateString()
  const diffDays = (Date.now() - date.getTime()) / 86400000
  return value === '7d' ? diffDays <= 7 : diffDays <= 30
}

function ProcedureKpi({ icon: Icon, tone, label, value, hint, trend }) {
  return (
    <article className={`doctor-procedure-kpi is-${tone}`}>
      <span><Icon size={29} /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
      <em>{trend}</em>
    </article>
  )
}

function StatusBadge({ status }) {
  return <span className={`doctor-procedure-status is-${status.tone}`}>{status.label}</span>
}

function PriorityBadge({ priority }) {
  return <span className={`doctor-procedure-priority is-${priority.tone}`}>{priority.label}</span>
}

function ProcedureDonut({ stats }) {
  const total = stats.total || 1
  const waitingEnd = percent(stats.waiting, total)
  const processingEnd = waitingEnd + percent(stats.processing, total)
  const completedEnd = processingEnd + percent(stats.completed, total)
  const followEnd = completedEnd + percent(stats.follow, total)
  const cancelledEnd = followEnd + percent(stats.cancelled, total)
  return (
    <div
      className="doctor-procedure-donut"
      style={{
        '--waiting-end': `${waitingEnd}%`,
        '--processing-end': `${processingEnd}%`,
        '--completed-end': `${completedEnd}%`,
        '--follow-end': `${followEnd}%`,
        '--cancelled-end': `${cancelledEnd}%`,
      }}
    >
      <div><strong>{stats.total}</strong><span>Tổng</span></div>
    </div>
  )
}

function countFrom(summary = {}, keys = [], fallback = 0) {
  for (const key of keys) {
    if (summary?.[key] !== undefined && summary?.[key] !== null) return Number(summary[key]) || 0
  }
  return fallback
}

export function DoctorProcedureScreen() {
  const toast = useToast()
  const [today] = useState(getTodayDate)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('today')
  const [selectedId, setSelectedId] = useState('')
  const [state, setState] = useState({ loading: true, error: '', orders: [], summary: null, pagination: null })

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    Promise.all([
      doctorApi.procedures.getDashboardSummary({ range: '7d' }).catch(() => null),
      doctorApi.procedures.listOrders({ sort_by: 'created_at', sort_order: 'desc' }),
    ])
      .then(([summary, ordersPayload]) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          summary,
          orders: safeArray(ordersPayload?.items),
          pagination: ordersPayload?.pagination || null,
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải dữ liệu thủ thuật.'),
          orders: [],
          summary: null,
          pagination: null,
        })
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const filtered = useMemo(
    () => state.orders.filter((order) => {
      const status = statusInfo(order)
      const priority = priorityInfo(order)
      return matchSearch(order, searchTerm.trim())
        && (statusFilter === 'all' || status.group === statusFilter)
        && (priorityFilter === 'all' || priority.tone === priorityFilter)
        && (roomFilter === 'all' || roomName(order).toLowerCase().includes(roomFilter))
        && withinTime(order, timeFilter)
    }),
    [priorityFilter, roomFilter, searchTerm, state.orders, statusFilter, timeFilter],
  )

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const displayRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const stats = useMemo(() => {
    const base = { total: state.orders.length, waiting: 0, processing: 0, completed: 0, follow: 0, cancelled: 0, highPriority: 0, encounters: 0 }
    const encounterSet = new Set()
    state.orders.forEach((order) => {
      const status = statusInfo(order).group
      if (status === 'waiting') base.waiting += 1
      if (status === 'processing') base.processing += 1
      if (status === 'completed') base.completed += 1
      if (status === 'follow') base.follow += 1
      if (status === 'cancelled') base.cancelled += 1
      if (priorityInfo(order).score === 3) base.highPriority += 1
      if (order.encounter_id || encounterCode(order) !== '--') encounterSet.add(order.encounter_id || encounterCode(order))
    })
    const summary = state.summary || {}
    return {
      ...base,
      total: countFrom(summary, ['total_orders', 'total', 'orders_count'], base.total),
      waiting: countFrom(summary, ['waiting_count', 'pending_count', 'waiting'], base.waiting),
      processing: countFrom(summary, ['processing_count', 'in_progress_count', 'processing'], base.processing),
      completed: countFrom(summary, ['completed_count', 'completed'], base.completed),
      follow: countFrom(summary, ['follow_up_count', 'monitoring_count', 'follow'], base.follow),
      cancelled: countFrom(summary, ['cancelled_count', 'cancelled'], base.cancelled),
      highPriority: countFrom(summary, ['high_priority_count', 'urgent_count'], base.highPriority),
      encounters: countFrom(summary, ['encounters_count', 'encounter_count'], encounterSet.size),
    }
  }, [state.orders, state.summary])

  const priorityRows = state.orders
    .filter((order) => statusInfo(order).group !== 'completed' && priorityInfo(order).score === 3)
    .slice(0, 3)
  const activities = state.orders.slice(0, 3)
  const completionRate = percent(stats.completed, stats.total)

  async function openOrder(order) {
    const id = idOf(order)
    if (!id) {
      toast.error('Không tìm thấy mã thủ thuật.')
      return
    }
    setSelectedId(id)
    try {
      await Promise.all([
        doctorApi.procedures.getOrder(id),
        doctorApi.procedures.getTimeline(id).catch(() => []),
      ])
      toast.info('Đã tải chi tiết và timeline thủ thuật từ API.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết thủ thuật.'))
    }
  }

  function reload() {
    setReloadKey((current) => current + 1)
  }

  function exportCsv() {
    const rows = [
      ['Ma thu thuat', 'Benh nhan', 'Encounter', 'Thu thuat', 'Trang thai', 'Muc uu tien', 'Thoi gian', 'Phong thu thuat'],
      ...filtered.map((order, index) => [
        procedureCode(order, index),
        patientName(order),
        encounterCode(order),
        procedureName(order),
        statusInfo(order).label,
        priorityInfo(order).label,
        `${formatTime(orderTime(order))} ${formatDate(orderTime(order))}`,
        roomName(order),
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `procedure-orders-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="doctor-procedure-page">
      <header className="doctor-procedure-header">
        <div>
          <h1>Thủ thuật</h1>
          <p>Quản lý chỉ định thủ thuật và theo dõi tiến trình thực hiện</p>
        </div>
        <div className="doctor-procedure-topbar">
          <button type="button" aria-label="Thông báo"><Bell size={18} /><i>3</i></button>
          <button type="button" aria-label="Trợ giúp"><HelpCircle size={19} /></button>
        </div>
      </header>

      {state.error ? <div className="doctor-procedure-error">{state.error}</div> : null}

      <section className="doctor-procedure-kpis">
        <ProcedureKpi icon={FilePlus2} tone="blue" label="Tổng chỉ định thủ thuật" value={stats.total} hint="Trong 7 ngày qua" trend="↑ 12%" />
        <ProcedureKpi icon={Clock3} tone="orange" label="Chờ thực hiện" value={stats.waiting} hint="Chờ thực hiện" trend="↑ 8%" />
        <ProcedureKpi icon={UserRound} tone="blue" label="Đang thực hiện" value={stats.processing} hint="Theo dữ liệu hiện tại" trend="↓ 13%" />
        <ProcedureKpi icon={CheckCircle2} tone="green" label="Hoàn tất hôm nay" value={stats.completed} hint="Hoàn tất" trend="↑ 10%" />
      </section>

      <section className="doctor-procedure-layout">
        <main className="doctor-procedure-main">
          <article className="doctor-procedure-panel doctor-procedure-table-card">
            <div className="doctor-procedure-filters">
              <label className="doctor-procedure-search"><Search size={15} /><input value={searchTerm} placeholder="Tìm kiếm mã thủ thuật, bệnh nhân, encounter..." onChange={(event) => { setSearchTerm(event.target.value); setPage(1) }} /></label>
              <label><span>Trạng thái</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="waiting">Chờ thực hiện</option><option value="processing">Đang thực hiện</option><option value="completed">Hoàn tất</option><option value="follow">Theo dõi sau TT</option><option value="cancelled">Hủy</option></select></label>
              <label><span>Mức ưu tiên</span><select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="red">Cao</option><option value="orange">Trung bình</option><option value="green">Thấp</option></select></label>
              <label><span>Phòng thủ thuật</span><select value={roomFilter} onChange={(event) => { setRoomFilter(event.target.value); setPage(1) }}><option value="all">Tất cả</option><option value="thủ thuật">P. Thủ thuật</option><option value="nội soi">P. Nội soi</option></select></label>
              <label><select value={timeFilter} onChange={(event) => { setTimeFilter(event.target.value); setPage(1) }}><option value="today">Hôm nay</option><option value="7d">7 ngày qua</option><option value="30d">30 ngày qua</option><option value="all">Tất cả</option></select></label>
              <button type="button" onClick={reload}><ListPlus size={15} /> Bộ lọc</button>
            </div>

            <div className="doctor-procedure-table-head">
              <span>Mã thủ thuật</span>
              <span>Bệnh nhân</span>
              <span>Encounter</span>
              <span>Thủ thuật</span>
              <span>Trạng thái</span>
              <span>Mức ưu tiên</span>
              <span>Thời gian</span>
              <span>Phòng thủ thuật</span>
              <span>Thao tác</span>
            </div>
            <div className="doctor-procedure-table">
              {state.loading ? (
                <div className="doctor-procedure-empty">Đang tải dữ liệu thủ thuật...</div>
              ) : displayRows.length ? displayRows.map((order, index) => {
                const status = statusInfo(order)
                const priority = priorityInfo(order)
                return (
                  <div className={`doctor-procedure-row${selectedId === idOf(order) ? ' is-selected' : ''}`} key={idOf(order) || procedureCode(order, index)}>
                    <strong>{procedureCode(order, index)}</strong>
                    <span className="doctor-procedure-person"><b>{patientName(order)}</b><small>{patientLine(order)}</small></span>
                    <span><b>{encounterCode(order)}</b><small>{encounterType(order)}</small></span>
                    <span>{procedureName(order)}</span>
                    <StatusBadge status={status} />
                    <PriorityBadge priority={priority} />
                    <time>{formatTime(orderTime(order))}<small>{formatDate(orderTime(order))}</small></time>
                    <span>{roomName(order)}</span>
                    <button type="button" onClick={() => openOrder(order)} aria-label="Mở thủ thuật"><MoreVertical size={16} /></button>
                  </div>
                )
              }) : (
                <div className="doctor-procedure-empty">Chưa có thủ thuật phù hợp.</div>
              )}
            </div>
            <footer className="doctor-procedure-footer">
              <span>Hiển thị {total ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, total)}` : '0'} / {total.toLocaleString('vi-VN')} kết quả</span>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                  <button className={pageNumber === page ? 'is-active' : ''} type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                ))}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={15} /></button>
              </div>
              <button type="button">20 / trang <ChevronDown size={14} /></button>
            </footer>
          </article>

          <section className="doctor-procedure-bottom">
            <article className="doctor-procedure-panel doctor-procedure-priority-card">
              <header><h2>Ưu tiên thực hiện</h2><b>{priorityRows.length}</b></header>
              <div className="doctor-procedure-mini-head"><span>Mã thủ thuật</span><span>Bệnh nhân</span><span>Thủ thuật</span><span>Mức ưu tiên</span><span>Thời gian</span><span>Phòng</span></div>
              {priorityRows.length ? priorityRows.map((order, index) => (
                <button type="button" key={idOf(order) || index} onClick={() => openOrder(order)}>
                  <strong>{procedureCode(order, index)}</strong>
                  <span>{patientName(order)} ({order.patient_age || '--'} tuổi)</span>
                  <span>{procedureName(order)}</span>
                  <PriorityBadge priority={priorityInfo(order)} />
                  <time>{formatTime(orderTime(order))}</time>
                  <span>{roomName(order)}</span>
                </button>
              )) : <p>Không có thủ thuật ưu tiên cao.</p>}
              <button className="doctor-procedure-link" type="button" onClick={() => setPriorityFilter('red')}>Xem tất cả ưu tiên <ChevronRight size={14} /></button>
            </article>

            <article className="doctor-procedure-panel doctor-procedure-activity">
              <h2>Hoạt động gần đây</h2>
              {activities.length ? activities.map((order, index) => {
                const status = statusInfo(order)
                return (
                  <div key={idOf(order) || index}>
                    <time>{formatTime(orderTime(order))}<small>{formatDate(orderTime(order))}</small></time>
                    <i className={`is-${status.tone}`} />
                    <span>
                      <b>{status.group === 'completed' ? 'Hoàn tất thủ thuật' : status.group === 'processing' ? 'Bắt đầu thực hiện' : 'Tạo chỉ định thủ thuật'}: {procedureName(order)}</b>
                      <small>BN: {patientName(order)} ({encounterCode(order)})</small>
                    </span>
                  </div>
                )
              }) : <p>Chưa có hoạt động gần đây.</p>}
              <button className="doctor-procedure-link" type="button">Xem tất cả hoạt động <ChevronRight size={14} /></button>
            </article>
          </section>
        </main>

        <aside className="doctor-procedure-side">
          <article className="doctor-procedure-panel doctor-procedure-overview">
            <h2>Tổng quan thủ thuật</h2>
            <div>
              <ProcedureDonut stats={stats} />
              <dl>
                <div><dt><i className="is-orange" /> Chờ thực hiện</dt><dd>{stats.waiting} ({percent(stats.waiting, stats.total)}%)</dd></div>
                <div><dt><i className="is-blue" /> Đang thực hiện</dt><dd>{stats.processing} ({percent(stats.processing, stats.total)}%)</dd></div>
                <div><dt><i className="is-green" /> Hoàn tất</dt><dd>{stats.completed} ({percent(stats.completed, stats.total)}%)</dd></div>
                <div><dt><i className="is-purple" /> Theo dõi sau TT</dt><dd>{stats.follow} ({percent(stats.follow, stats.total)}%)</dd></div>
                <div><dt><i /> Hủy</dt><dd>{stats.cancelled} ({percent(stats.cancelled, stats.total)}%)</dd></div>
              </dl>
            </div>
            <section>
              <p><ShieldCheck size={18} /> <span>Tỷ lệ hoàn tất<small>Trong 7 ngày qua</small></span><strong>{completionRate}%</strong></p>
              <p><FileClock size={18} /> <span>Thủ thuật ưu tiên cao<small>Chờ thực hiện</small></span><strong>{stats.highPriority}</strong></p>
              <p><UsersRound size={18} /> <span>Encounter có thủ thuật<small>Trong 7 ngày qua</small></span><strong>{stats.encounters}</strong></p>
            </section>
          </article>

          <article className="doctor-procedure-panel doctor-procedure-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => toast.info('Tạo chỉ định thủ thuật dùng màn encounter và endpoint POST tương ứng nếu backend cung cấp.')}><span><FilePlus2 size={18} /></span><b>Tạo chỉ định thủ thuật</b><ChevronRight size={17} /></button>
            <button type="button" onClick={() => selectedId ? doctorApi.procedures.getTimeline(selectedId).then(() => toast.info('Đã tải timeline chỉ định từ API.')) : toast.info('Chọn một thủ thuật để xem timeline.')}><span><Clock3 size={18} /></span><b>Xem timeline chỉ định</b><ChevronRight size={17} /></button>
            <button type="button" onClick={exportCsv}><span><Download size={18} /></span><b>Xuất danh sách</b><ChevronRight size={17} /></button>
            <button type="button" onClick={() => selectedId ? toast.info('Lịch sử bệnh nhân dùng /procedures/patients/:patientId/history khi có patientId.') : toast.info('Chọn một bệnh nhân để xem lịch sử.')}><span><UserRound size={18} /></span><b>Xem lịch sử bệnh nhân</b><ChevronRight size={17} /></button>
          </article>
        </aside>
      </section>
    </div>
  )
}
