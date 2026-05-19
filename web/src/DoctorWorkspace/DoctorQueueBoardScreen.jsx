import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctorApi, getDoctorId } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { ConfirmActionDialog, DoctorIcon } from './DoctorShell'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5
const EMPTY_BOARD = { waiting: [], called: [], in_service: [], serving: [], completed: [], skipped: [], cancelled: [] }

const STATUS_COLORS = {
  waiting: '#ff9f1a',
  called: '#2f86ff',
  in_service: '#35c875',
  completed: '#7c4dff',
  skipped: '#98a2b3',
}

function valueOf(source = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function nestedValue(source = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = key.split('.').reduce((target, part) => target?.[part], source)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

function normalizeQueueStatus(status) {
  const raw = String(status || '').toLowerCase().replace(/\s+/g, '_')
  if (['waiting', 'pending', 'queued'].includes(raw)) return 'waiting'
  if (['calling', 'called', 'recalled'].includes(raw)) return 'called'
  if (['serving', 'in_service', 'in-progress', 'in_progress', 'examining'].includes(raw)) return 'in_service'
  if (['completed', 'done', 'finished'].includes(raw)) return 'completed'
  if (['skipped', 'skip', 'no_show', 'no-show', 'missed'].includes(raw)) return 'skipped'
  if (['cancelled', 'canceled'].includes(raw)) return 'cancelled'
  return raw || 'unknown'
}

function ticketIdOf(ticket = {}) {
  return valueOf(ticket, ['queue_ticket_id', 'ticket_id', 'ticketId', 'queueTicketId', 'id', '_id'], '')
}

function ticketNumber(ticket = {}, index = 0) {
  const value = valueOf(ticket, ['queue_number', 'queueNumber', 'ticket_number', 'ticketNumber', 'ticket_no', 'number'], '')
  if (value) return String(value).padStart(3, '0')
  return String(index + 1).padStart(3, '0')
}

function patientName(ticket = {}) {
  return nestedValue(ticket, [
    'patient_name',
    'patientName',
    'patient.fullName',
    'patient.full_name',
    'patient.name',
  ], 'Chưa có tên bệnh nhân')
}

function patientCode(ticket = {}) {
  return nestedValue(ticket, [
    'patient_code',
    'patientCode',
    'patient.patientCode',
    'patient.patient_code',
    'patient.code',
    'patient_id',
  ], '')
}

function patientMeta(ticket = {}) {
  const gender = nestedValue(ticket, ['patient_gender', 'patient.gender', 'patient.sex'], '')
  const age = nestedValue(ticket, ['patient_age', 'patient.age'], '')
  return [gender, age ? `${age} tuổi` : '', patientCode(ticket) ? `#${patientCode(ticket)}` : ''].filter(Boolean).join(' · ')
}

function initials(ticket = {}) {
  return patientName(ticket)
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'BN'
}

function roomName(ticket = {}) {
  return nestedValue(ticket, [
    'room_name',
    'roomName',
    'clinic_room',
    'clinicRoom',
    'room',
    'location',
    'department_name',
    'department.name',
  ], '--')
}

function doctorName(ticket = {}, user = {}) {
  return nestedValue(ticket, [
    'doctor_name',
    'doctorName',
    'doctor.fullName',
    'doctor.full_name',
    'doctor.name',
  ], user?.fullName || user?.full_name || user?.name || '--')
}

function arrivedAt(ticket = {}) {
  return valueOf(ticket, ['arrived_at', 'arrivedAt', 'checkin_time', 'check_in_time', 'checkInTime', 'created_at', 'createdAt'], '')
}

function serviceStartedAt(ticket = {}) {
  return valueOf(ticket, ['started_at', 'startedAt', 'start_time', 'service_started_at', 'called_time', 'called_at'], '')
}

function serviceEndedAt(ticket = {}) {
  return valueOf(ticket, ['completed_at', 'completedAt', 'completed_time', 'cancelled_at', 'canceled_at', 'updated_at', 'updatedAt'], '')
}

function statusInfo(ticket = {}) {
  const key = normalizeQueueStatus(ticket.status)
  if (key === 'called') return { key, label: 'Đang gọi', tone: 'blue' }
  if (key === 'in_service') return { key, label: 'Đang khám', tone: 'green' }
  if (key === 'completed') return { key, label: 'Đã hoàn tất', tone: 'green' }
  if (key === 'skipped') return { key, label: 'Bỏ qua', tone: 'slate' }
  if (key === 'cancelled') return { key, label: 'Đã hủy', tone: 'red' }
  return { key: 'waiting', label: 'Đang chờ', tone: 'orange' }
}

function waitMinutes(ticket = {}) {
  const explicit = Number(valueOf(ticket, ['wait_minutes', 'waiting_minutes', 'waitMinutes'], NaN))
  if (Number.isFinite(explicit)) return Math.max(0, Math.round(explicit))

  const start = new Date(arrivedAt(ticket)).getTime()
  if (Number.isNaN(start)) return null

  const endSource = serviceStartedAt(ticket) || serviceEndedAt(ticket)
  const end = endSource ? new Date(endSource).getTime() : Date.now()
  if (Number.isNaN(end)) return null

  return Math.max(0, Math.round((end - start) / 60000))
}

function minutesText(minutes) {
  if (!Number.isFinite(minutes)) return '-'
  return `${minutes} phút`
}

function waitText(ticket = {}) {
  return minutesText(waitMinutes(ticket))
}

function averageWait(tickets = []) {
  const values = tickets.map(waitMinutes).filter((value) => Number.isFinite(value))
  if (!values.length) return '0 phút'
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  return minutesText(average)
}

function summaryTextTime(value) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'number') return minutesText(Math.round(value))
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return minutesText(Math.round(numeric))
  return String(value)
}

function numberFrom(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = Number(source?.[key])
    if (Number.isFinite(value)) return value
  }
  return fallback
}

function percent(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 1000) / 10
}

function flattenBoard(board = {}) {
  return [
    ...safeArray(board.called),
    ...safeArray(board.waiting),
    ...safeArray(board.in_service),
    ...safeArray(board.serving),
    ...safeArray(board.completed),
    ...safeArray(board.skipped),
    ...safeArray(board.cancelled),
  ]
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

function sortTickets(a, b) {
  const orderA = Number(valueOf(a, ['queue_number', 'queueNumber', 'ticket_number', 'ticketNumber', 'ticket_no'], 999999))
  const orderB = Number(valueOf(b, ['queue_number', 'queueNumber', 'ticket_number', 'ticketNumber', 'ticket_no'], 999999))
  if (orderA !== orderB) return orderA - orderB
  return new Date(arrivedAt(a) || 0).getTime() - new Date(arrivedAt(b) || 0).getTime()
}

async function loadQueueBoard(user) {
  const doctorId = getDoctorId(user)
  const query = doctorId ? { doctor_id: doctorId, limit: 200 } : { limit: 200 }
  const [board, groupedAll, summary] = await Promise.all([
    doctorId ? settledValue(doctorApi.queue.getBoard(doctorId), EMPTY_BOARD) : Promise.resolve(EMPTY_BOARD),
    settledValue(doctorApi.queue.listAll(query), EMPTY_BOARD),
    settledValue(doctorApi.queue.getTodaySummary(query), null),
  ])

  const selectedBoard = flattenBoard(board).length ? board : groupedAll
  const tickets = flattenBoard(selectedBoard).sort(sortTickets)

  return { board: selectedBoard, tickets, summary }
}

function QueueKpi({ icon, tone, label, value, hint, active, onClick }) {
  const Component = onClick ? 'button' : 'article'
  return (
    <Component
      className={`doctor-queue-kpi${active ? ' is-active' : ''}${onClick ? ' is-actionable' : ''}`}
      {...(onClick ? { type: 'button', onClick } : {})}
    >
      <span className={`doctor-queue-kpi__icon is-${tone}`}>
        <DoctorIcon name={icon} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{hint}</span>
      </div>
    </Component>
  )
}

function QueueDonut({ total, waiting, called, inService, completed, skipped }) {
  const w = percent(waiting, total)
  const c = percent(called, total)
  const s = percent(inService, total)
  const d = percent(completed, total)
  const k = percent(skipped, total)
  const background = total
    ? `conic-gradient(${STATUS_COLORS.completed} 0 ${d}%, ${STATUS_COLORS.waiting} ${d}% ${d + w}%, ${STATUS_COLORS.in_service} ${d + w}% ${d + w + s}%, ${STATUS_COLORS.called} ${d + w + s}% ${d + w + s + c}%, ${STATUS_COLORS.skipped} ${d + w + s + c}% ${d + w + s + c + k}%, #e8eef8 ${d + w + s + c + k}% 100%)`
    : 'conic-gradient(#e8eef8 0 100%)'

  return (
    <div className="doctor-queue-donut" style={{ background }}>
      <div>
        <strong>{total}</strong>
        <span>Tổng bệnh nhân</span>
      </div>
    </div>
  )
}

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

function DetailModal({ detail, onClose }) {
  if (!detail) return null
  const ticket = detail.ticket || {}
  const timeline = safeArray(detail.timeline)
  const status = statusInfo(ticket)

  return (
    <div className="doctor-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="doctor-dialog doctor-queue-detail-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="doctor-dialog-head">
          <h3>Chi tiết ticket {ticketNumber(ticket)}</h3>
          <button className="doctor-icon-button" type="button" onClick={onClose} aria-label="Đóng hộp thoại">
            <DoctorIcon name="cancel" />
          </button>
        </div>
        <div className="doctor-queue-detail-grid">
          <p><span>Bệnh nhân</span><strong>{patientName(ticket)}</strong></p>
          <p><span>Mã bệnh nhân</span><strong>{patientCode(ticket) || '--'}</strong></p>
          <p><span>Trạng thái</span><strong>{status.label}</strong></p>
          <p><span>Giờ đến</span><strong>{formatTime(arrivedAt(ticket))}</strong></p>
          <p><span>Phòng khám</span><strong>{roomName(ticket)}</strong></p>
          <p><span>Bác sĩ</span><strong>{doctorName(ticket)}</strong></p>
        </div>
        <div className="doctor-queue-detail-timeline">
          <h4>Timeline</h4>
          {timeline.length ? timeline.map((event, index) => (
            <p key={`${ticketIdOf(ticket)}-${index}`}>
              <time>{formatTime(event.created_at || event.time || event.timestamp || event.updated_at)}</time>
              <span>{event.message || event.description || event.action || event.status || 'Cập nhật ticket'}</span>
            </p>
          )) : <p className="doctor-appointment-empty is-small">Chưa có timeline cho ticket này.</p>}
        </div>
      </div>
    </div>
  )
}

export function DoctorQueueBoardScreen({ user }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', data: { board: {}, tickets: [], summary: null } })
  const [actingId, setActingId] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [detail, setDetail] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadQueueBoard(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải dữ liệu hàng đợi. Vui lòng thử lại sau.'),
        data: { board: {}, tickets: [], summary: null },
      }))
  }

  useEffect(() => {
    let active = true
    loadQueueBoard(user)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải dữ liệu hàng đợi. Vui lòng thử lại sau.'),
            data: { board: {}, tickets: [], summary: null },
          })
        }
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, state.data.tickets])

  const dashboard = useMemo(() => {
    const tickets = safeArray(state.data.tickets)
    const summary = state.data.summary || {}
    const waitingTickets = tickets.filter((item) => statusInfo(item).key === 'waiting')
    const calledTickets = tickets.filter((item) => statusInfo(item).key === 'called')
    const inServiceTickets = tickets.filter((item) => statusInfo(item).key === 'in_service')
    const completedTickets = tickets.filter((item) => statusInfo(item).key === 'completed')
    const skippedTickets = tickets.filter((item) => statusInfo(item).key === 'skipped')
    const cancelledTickets = tickets.filter((item) => statusInfo(item).key === 'cancelled')
    const waiting = numberFrom(summary, ['waiting_count', 'waiting'], waitingTickets.length)
    const called = numberFrom(summary, ['called_count', 'calling_count', 'called', 'calling'], calledTickets.length)
    const inService = numberFrom(summary, ['in_service_count', 'serving_count', 'examining_count', 'in_service', 'serving'], inServiceTickets.length)
    const completed = numberFrom(summary, ['completed_count', 'done_count', 'finished_count', 'completed'], completedTickets.length)
    const skipped = numberFrom(summary, ['skipped_count', 'skip_count', 'no_show_count', 'noShowCount', 'skipped'], skippedTickets.length)
    const cancelled = numberFrom(summary, ['cancelled_count', 'canceled_count', 'cancelled'], cancelledTickets.length)
    const total = numberFrom(summary, ['total_tickets', 'total_patients', 'total'], waiting + called + inService + completed + skipped + cancelled || tickets.length)
    const nextTicket = [...waitingTickets].sort(sortTickets)[0] || null
    const currentTicket = calledTickets[0] || inServiceTickets[0] || nextTicket || tickets[0] || null
    const summaryAverage = summaryTextTime(summary.average_wait_time ?? summary.averageWaitTime ?? summary.average_wait_minutes ?? summary.avg_wait_minutes)

    return {
      tickets,
      waiting,
      called,
      inService,
      completed,
      skipped,
      cancelled,
      total,
      waitingRate: percent(waiting, total),
      calledRate: percent(called, total),
      inServiceRate: percent(inService, total),
      completedRate: percent(completed, total),
      skippedRate: percent(skipped, total),
      nextTicket,
      currentTicket,
      averageWait: summaryAverage || averageWait(tickets),
    }
  }, [state.data])

  const visibleTickets = useMemo(() => {
    if (statusFilter === 'all') return dashboard.tickets
    return dashboard.tickets.filter((ticket) => statusInfo(ticket).key === statusFilter)
  }, [dashboard.tickets, statusFilter])

  const totalPages = Math.max(1, Math.ceil(visibleTickets.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = visibleTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = visibleTickets.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(currentPage * PAGE_SIZE, visibleTickets.length)

  async function runAction(type, ticket = null) {
    const doctorId = getDoctorId(user)
    const ticketId = ticket ? ticketIdOf(ticket) : ''
    if (ticket && !ticketId) {
      toast.error('Không tìm thấy mã ticket hàng đợi.')
      return
    }

    setActingId(`${type}:${ticketId || 'next'}`)
    try {
      if (type === 'callNext') await doctorApi.queue.callNext(doctorId)
      if (type === 'call') await doctorApi.queue.call(ticketId)
      if (type === 'recall') await doctorApi.queue.recall(ticketId)
      if (type === 'noShow') await doctorApi.queue.markNoShow(ticketId)
      if (type === 'start') await doctorApi.queue.startService(ticketId)
      if (type === 'complete') await doctorApi.queue.complete(ticketId)
      if (type === 'cancel') await doctorApi.queue.cancel(ticketId)
      toast.success('Đã cập nhật hàng đợi.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, type === 'callNext' ? 'Không có bệnh nhân tiếp theo hoặc không thể gọi lượt tiếp theo.' : 'Không thể thực hiện thao tác hàng đợi.'))
    } finally {
      setActingId('')
      setConfirmAction(null)
    }
  }

  async function viewDetail(ticket) {
    const ticketId = ticketIdOf(ticket)
    if (!ticketId) {
      toast.error('Không tìm thấy mã ticket hàng đợi.')
      return
    }

    setActingId(`detail:${ticketId}`)
    try {
      const [ticketDetail, timeline] = await Promise.all([
        doctorApi.queue.getDetail(ticketId),
        doctorApi.queue.getTimeline(ticketId),
      ])
      setDetail({ ticket: ticketDetail || ticket, timeline })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết ticket.'))
    } finally {
      setActingId('')
    }
  }

  function exportCsv() {
    const source = visibleTickets
    if (!source.length) {
      toast.info('Không có dữ liệu hàng đợi để xuất.')
      return
    }

    const rows = [
      ['Số thứ tự', 'Bệnh nhân', 'Mã bệnh nhân', 'Giờ đến', 'Trạng thái', 'Phòng khám', 'Bác sĩ', 'Thời gian chờ'],
      ...source.map((ticket, index) => [
        ticketNumber(ticket, index),
        patientName(ticket),
        patientCode(ticket),
        formatTime(arrivedAt(ticket)),
        statusInfo(ticket).label,
        roomName(ticket),
        doctorName(ticket, user),
        waitText(ticket),
      ]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `doctor-queue-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Đã xuất danh sách hàng đợi.')
  }

  return (
    <div className="doctor-queue-board-page">
      {state.error ? (
        <div className="doctor-today-error doctor-queue-error">
          <span>{state.error}</span>
          <button type="button" onClick={reload}>Thử lại</button>
        </div>
      ) : null}

      <section className="doctor-queue-kpis" aria-label="Tổng quan hàng đợi">
        <QueueKpi icon="clock" tone="orange" label="Đang chờ" value={dashboard.waiting} hint={`${dashboard.waitingRate}% tổng số`} active={statusFilter === 'waiting'} onClick={() => setStatusFilter(statusFilter === 'waiting' ? 'all' : 'waiting')} />
        <QueueKpi icon="message" tone="blue" label="Đang gọi" value={dashboard.called} hint={`${dashboard.calledRate}% tổng số`} active={statusFilter === 'called'} onClick={() => setStatusFilter(statusFilter === 'called' ? 'all' : 'called')} />
        <QueueKpi icon="doctor" tone="green" label="Đang khám" value={dashboard.inService} hint={`${dashboard.inServiceRate}% tổng số`} active={statusFilter === 'in_service'} onClick={() => setStatusFilter(statusFilter === 'in_service' ? 'all' : 'in_service')} />
        <QueueKpi icon="check_circle" tone="purple" label="Đã hoàn tất" value={dashboard.completed} hint={`${dashboard.completedRate}% tổng số`} active={statusFilter === 'completed'} onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')} />
      </section>

      <section className="doctor-queue-layout">
        <article className="doctor-queue-panel doctor-queue-list">
          <header>
            <h2>Danh sách hàng đợi hiện tại</h2>
            {statusFilter !== 'all' ? <button type="button" className="doctor-queue-clear-filter" onClick={() => setStatusFilter('all')}>Bỏ lọc</button> : null}
          </header>

          <div className="doctor-queue-head">
            <span>Số thứ tự</span>
            <span>Bệnh nhân</span>
            <span>Giờ đến</span>
            <span>Trạng thái</span>
            <span>Phòng khám</span>
            <span>Bác sĩ</span>
            <span>Thời gian chờ</span>
            <span>Hành động</span>
          </div>

          <div className="doctor-queue-body">
            {state.loading ? (
              <div className="doctor-appointment-empty">Đang tải bảng hàng đợi...</div>
            ) : pageRows.length ? pageRows.map((ticket, index) => {
              const id = ticketIdOf(ticket) || `queue-${index}`
              const status = statusInfo(ticket)
              const isDone = ['completed', 'cancelled', 'skipped'].includes(status.key)
              const mainAction = status.key === 'called' ? 'recall' : status.key === 'in_service' ? 'complete' : 'call'
              const mainLabel = status.key === 'called' ? 'Gọi lại' : status.key === 'in_service' ? 'Hoàn tất' : 'Gọi'
              const secondaryAction = status.key === 'called' ? 'start' : status.key === 'in_service' ? 'cancel' : 'noShow'
              const secondaryLabel = status.key === 'called' ? 'Bắt đầu khám' : status.key === 'in_service' ? 'Hủy' : 'Bỏ qua'
              const rowNumber = (currentPage - 1) * PAGE_SIZE + index
              return (
                <div className="doctor-queue-row" key={id}>
                  <strong>{ticketNumber(ticket, rowNumber)}</strong>
                  <span className="doctor-queue-patient">
                    <em>{initials(ticket)}</em>
                    <b>{patientName(ticket)}</b>
                    <small>{patientMeta(ticket) || '--'}</small>
                  </span>
                  <span>{formatTime(arrivedAt(ticket))}</span>
                  <span><i className={`is-${status.tone}`}>{status.label}</i></span>
                  <span>{roomName(ticket)}</span>
                  <span>{doctorName(ticket, user)}</span>
                  <span>{isDone ? '-' : waitText(ticket)}</span>
                  <span className="doctor-queue-actions">
                    <button type="button" className={status.key === 'in_service' ? 'is-green' : 'is-primary'} disabled={Boolean(actingId) || isDone} onClick={() => runAction(mainAction, ticket)}>
                      <DoctorIcon name={status.key === 'in_service' ? 'doctor' : 'message'} />
                      {mainLabel}
                    </button>
                    {!isDone ? (
                      <button
                        type="button"
                        onClick={() => ['cancel', 'noShow'].includes(secondaryAction) ? setConfirmAction({ type: secondaryAction, ticket, label: secondaryLabel }) : runAction(secondaryAction, ticket)}
                        disabled={Boolean(actingId)}
                      >
                        <DoctorIcon name={secondaryAction === 'start' ? 'doctor' : 'warning'} />
                        {secondaryLabel}
                      </button>
                    ) : null}
                    <button type="button" className="is-more" onClick={() => viewDetail(ticket)} disabled={Boolean(actingId)}>
                      <DoctorIcon name="search" />
                      Chi tiết
                    </button>
                  </span>
                </div>
              )
            }) : (
              <div className="doctor-appointment-empty">Chưa có bệnh nhân trong hàng đợi.</div>
            )}
          </div>

          <footer className="doctor-queue-footer">
            <button type="button" disabled>Hiển thị {PAGE_SIZE} dòng</button>
            <div>
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><DoctorIcon name="chevron_right" /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                <button type="button" className={pageNumber === currentPage ? 'is-active' : ''} key={pageNumber} onClick={() => setPage(pageNumber)}>
                  {pageNumber}
                </button>
              ))}
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><DoctorIcon name="chevron_right" /></button>
            </div>
            <span>Hiển thị {visibleTickets.length ? `${pageStart} đến ${pageEnd}` : '0'} của {visibleTickets.length} bệnh nhân</span>
          </footer>
        </article>

        <aside className="doctor-queue-side">
          <article className="doctor-queue-panel doctor-queue-overview">
            <header>
              <h2>Tổng quan hàng đợi</h2>
            </header>
            <div className="doctor-queue-overview__top">
              <QueueDonut
                total={dashboard.total}
                waiting={dashboard.waiting}
                called={dashboard.called}
                inService={dashboard.inService}
                completed={dashboard.completed}
                skipped={dashboard.skipped}
              />
              <dl>
                <div><dt><i className="is-orange" /> Đang chờ</dt><dd>{dashboard.waiting} ({dashboard.waitingRate}%)</dd></div>
                <div><dt><i className="is-blue" /> Đang gọi</dt><dd>{dashboard.called} ({dashboard.calledRate}%)</dd></div>
                <div><dt><i className="is-green" /> Đang khám</dt><dd>{dashboard.inService} ({dashboard.inServiceRate}%)</dd></div>
                <div><dt><i className="is-purple" /> Đã hoàn tất</dt><dd>{dashboard.completed} ({dashboard.completedRate}%)</dd></div>
                <div><dt><i className="is-slate" /> Bỏ qua</dt><dd>{dashboard.skipped} ({dashboard.skippedRate}%)</dd></div>
              </dl>
            </div>
            <div className="doctor-queue-overview__list">
              <div><DoctorIcon name="clock" /><span>Thời gian chờ trung bình</span><strong>{dashboard.averageWait}</strong></div>
              <div><DoctorIcon name="patients" /><span>Bệnh nhân tiếp theo</span><strong>{dashboard.nextTicket ? `${patientName(dashboard.nextTicket)} (STT ${ticketNumber(dashboard.nextTicket)})` : '--'}</strong></div>
              <div><DoctorIcon name="queue" /><span>Quầy / Phòng hiện tại</span><strong>{dashboard.currentTicket ? roomName(dashboard.currentTicket) : '--'}</strong></div>
              <div><DoctorIcon name="patients" /><span>Bác sĩ phụ trách</span><strong>{dashboard.currentTicket ? doctorName(dashboard.currentTicket, user) : doctorName({}, user)}</strong></div>
            </div>
          </article>

          <article className="doctor-queue-panel doctor-queue-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" className="is-call-next" onClick={() => runAction('callNext')} disabled={Boolean(actingId)}>
              <DoctorIcon name="message" />
              <span>Gọi tiếp theo</span>
            </button>
            <div className="doctor-queue-quick-grid">
              <button type="button" onClick={reload} disabled={state.loading}><DoctorIcon name="refresh" /> Làm mới</button>
              <button type="button" onClick={exportCsv} disabled={state.loading}><DoctorIcon name="note" /> Xuất danh sách</button>
              <button type="button" onClick={() => navigate('/doctor/queue?view=history')}><DoctorIcon name="clock" /> Xem lịch sử</button>
            </div>
          </article>

          <article className="doctor-queue-tip">
            <DoctorIcon name="warning" />
            <p>Mẹo: Nhấn “Gọi tiếp theo” để gọi bệnh nhân đầu tiên trong danh sách chờ.</p>
          </article>
        </aside>
      </section>

      <DetailModal detail={detail} onClose={() => setDetail(null)} />
      <ConfirmActionDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'cancel' ? 'Hủy ticket hàng đợi?' : 'Đánh dấu bỏ qua?'}
        description={confirmAction ? `${confirmAction.label} ticket STT ${ticketNumber(confirmAction.ticket)} của ${patientName(confirmAction.ticket)}.` : ''}
        confirmLabel={confirmAction?.label || 'Xác nhận'}
        tone={confirmAction?.type === 'cancel' ? 'danger' : 'primary'}
        busy={Boolean(actingId)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => runAction(confirmAction.type, confirmAction.ticket)}
      />
    </div>
  )
}
