import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctorApi, getDoctorId } from './doctorApi'
import { safeArray } from './doctorData'
import { DoctorIcon } from './DoctorShell'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5

const HISTORY_COLORS = {
  completed: '#25bd71',
  skipped: '#ff9416',
  cancelled: '#ef4444',
  transferred: '#2177ff',
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') || ''
}

function toNumber(value, fallback = null) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

function getPatient(ticket = {}) {
  return ticket.patient || ticket.patient_info || ticket.patientInfo || {}
}

function ticketIdOf(ticket = {}) {
  return firstValue(
    ticket.ticket_id,
    ticket.ticketId,
    ticket.queue_ticket_id,
    ticket.queueTicketId,
    ticket.id,
    ticket._id,
  )
}

function rawTicketNumber(ticket = {}) {
  return firstValue(
    ticket.queue_number,
    ticket.queueNumber,
    ticket.ticket_number,
    ticket.ticketNumber,
    ticket.ticket_no,
    ticket.number,
    ticket.sequence_number,
  )
}

function ticketNumber(ticket = {}, index = 0) {
  const value = rawTicketNumber(ticket) || index + 1
  return String(value).startsWith('#') ? String(value) : `#${String(value).padStart(3, '0')}`
}

function patientName(ticket = {}) {
  const patient = getPatient(ticket)
  return firstValue(
    ticket.patient_name,
    ticket.patientName,
    patient.fullName,
    patient.full_name,
    patient.name,
    'Chưa có tên bệnh nhân',
  )
}

function patientCode(ticket = {}) {
  const patient = getPatient(ticket)
  return firstValue(
    ticket.patient_code,
    ticket.patientCode,
    patient.patientCode,
    patient.patient_code,
    patient.code,
  )
}

function patientAvatar(ticket = {}) {
  const patient = getPatient(ticket)
  return firstValue(ticket.patient_avatar, ticket.avatar_url, patient.avatar_url, patient.photo_url, patient.image_url)
}

function patientMeta(ticket = {}) {
  const patient = getPatient(ticket)
  const code = patientCode(ticket)
  const gender = firstValue(ticket.patient_gender, patient.gender, patient.sex)
  const age = firstValue(ticket.patient_age, patient.age)
  return [code, gender, age ? `${age} tuổi` : ''].filter(Boolean).join(' - ')
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

function arrivedAt(ticket = {}) {
  return firstValue(
    ticket.arrived_at,
    ticket.arrivedAt,
    ticket.check_in_time,
    ticket.checkInTime,
    ticket.checkin_time,
    ticket.checked_in_at,
    ticket.created_at,
    ticket.createdAt,
  )
}

function calledAt(ticket = {}) {
  return firstValue(
    ticket.called_at,
    ticket.calledAt,
    ticket.called_time,
    ticket.last_called_at,
    ticket.lastCalledAt,
    ticket.updated_at,
    ticket.updatedAt,
  )
}

function startedAt(ticket = {}) {
  return firstValue(
    ticket.started_at,
    ticket.startedAt,
    ticket.start_time,
    ticket.service_started_at,
    ticket.serviceStartedAt,
  )
}

function completedAt(ticket = {}) {
  return firstValue(ticket.completed_at, ticket.completedAt, ticket.completed_time, ticket.finished_at, ticket.finishedAt)
}

function cancelledAt(ticket = {}) {
  return firstValue(ticket.cancelled_at, ticket.cancelledAt, ticket.canceled_at, ticket.canceledAt)
}

function noShowAt(ticket = {}) {
  return firstValue(ticket.no_show_at, ticket.noShowAt, ticket.skipped_at, ticket.skippedAt, ticket.missed_at, ticket.missedAt)
}

function endedAt(ticket = {}) {
  return firstValue(completedAt(ticket), cancelledAt(ticket), noShowAt(ticket), ticket.finished_at, ticket.finishedAt, ticket.updated_at, ticket.updatedAt)
}

function roomName(ticket = {}) {
  return firstValue(
    ticket.room_name,
    ticket.roomName,
    ticket.clinic_room,
    ticket.clinicRoom,
    ticket.room,
    ticket.location,
    ticket.department_name,
    '--',
  )
}

function doctorName(ticket = {}, user = {}) {
  const doctor = ticket.doctor || {}
  return firstValue(
    ticket.doctor_name,
    ticket.doctorName,
    doctor.fullName,
    doctor.full_name,
    doctor.name,
    user.full_name,
    user.fullName,
    user.name,
    '--',
  )
}

function dateOf(ticket = {}) {
  return firstValue(endedAt(ticket), ticket.service_date, ticket.queue_date, ticket.date, arrivedAt(ticket))
}

function timeFrom(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }
  const text = String(value)
  return text.length >= 5 ? text.slice(0, 5) : text
}

function dateText(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString('vi-VN')
}

function dateInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function normalizeQueueStatus(status) {
  const raw = String(status || '').toLowerCase()
  if (['waiting', 'pending', 'queued'].includes(raw)) return 'waiting'
  if (['calling', 'called', 'recalled'].includes(raw)) return 'calling'
  if (['serving', 'in_service', 'in-progress', 'in_progress', 'examining'].includes(raw)) return 'serving'
  if (['completed', 'done', 'finished'].includes(raw)) return 'completed'
  if (['skipped', 'skip', 'no_show', 'no-show', 'missed'].includes(raw)) return 'skipped'
  if (['cancelled', 'canceled'].includes(raw)) return 'cancelled'
  if (['transferred', 'transfer', 'moved'].includes(raw)) return 'transferred'
  return raw || 'unknown'
}

function statusInfo(ticket = {}) {
  const normalized = normalizeQueueStatus(ticket.status || ticket.final_status)
  if (normalized === 'completed') return { key: 'completed', label: 'Đã hoàn tất', tone: 'green' }
  if (normalized === 'skipped') return { key: 'skipped', label: 'Bỏ qua', tone: 'orange' }
  if (normalized === 'cancelled') return { key: 'cancelled', label: 'Đã hủy', tone: 'red' }
  if (normalized === 'transferred') return { key: 'transferred', label: 'Chuyển', tone: 'blue' }
  if (normalized === 'serving') return { key: 'serving', label: 'Đang khám', tone: 'green' }
  if (normalized === 'calling') return { key: 'calling', label: 'Đang gọi', tone: 'blue' }
  return { key: normalized, label: normalized === 'waiting' ? 'Đang chờ' : 'Không rõ', tone: 'slate' }
}

function isHistoryTicket(ticket = {}) {
  const status = statusInfo(ticket).key
  return ['completed', 'skipped', 'cancelled', 'transferred'].includes(status)
    || Boolean(completedAt(ticket) || cancelledAt(ticket) || noShowAt(ticket) || ticket.finished_at || ticket.finishedAt)
}

function minutesBetween(start, end) {
  if (!start || !end) return null
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(0, Math.round((b - a) / 60000))
}

function waitMinutes(ticket = {}) {
  const explicit = toNumber(firstValue(ticket.wait_minutes, ticket.waiting_minutes, ticket.waitTimeMinutes))
  if (Number.isFinite(explicit)) return explicit
  return minutesBetween(arrivedAt(ticket), firstValue(startedAt(ticket), calledAt(ticket), endedAt(ticket)))
}

function serviceMinutes(ticket = {}) {
  const explicit = toNumber(firstValue(ticket.service_minutes, ticket.serviceMinutes, ticket.duration_minutes))
  if (Number.isFinite(explicit)) return explicit
  return minutesBetween(startedAt(ticket), completedAt(ticket))
}

function totalMinutes(ticket = {}) {
  const explicit = toNumber(firstValue(ticket.total_minutes, ticket.totalMinutes))
  if (Number.isFinite(explicit)) return explicit
  return minutesBetween(arrivedAt(ticket), endedAt(ticket))
}

function minuteText(value, fallback = '--') {
  return Number.isFinite(value) ? `${value} phút` : fallback
}

function average(values) {
  const finiteValues = values.filter(Number.isFinite)
  if (!finiteValues.length) return 0
  return Math.round(finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length)
}

function percent(value, total) {
  if (!total) return 0
  return Math.round((value / total) * 1000) / 10
}

function flattenBoard(board = {}) {
  return [
    ...safeArray(board.waiting),
    ...safeArray(board.pending),
    ...safeArray(board.queued),
    ...safeArray(board.called),
    ...safeArray(board.calling),
    ...safeArray(board.in_service),
    ...safeArray(board.serving),
    ...safeArray(board.completed),
    ...safeArray(board.done),
    ...safeArray(board.finished),
    ...safeArray(board.skipped),
    ...safeArray(board.no_show),
    ...safeArray(board.cancelled),
    ...safeArray(board.canceled),
    ...safeArray(board.transferred),
    ...safeArray(board.items),
    ...safeArray(board.tickets),
    ...safeArray(board.data),
  ]
}

function mergeTickets(...groups) {
  const seen = new Set()
  return groups.flat().filter((ticket, index) => {
    const key = ticketIdOf(ticket) || `${rawTicketNumber(ticket)}-${patientName(ticket)}-${lastTime(ticket)}-${index}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function lastTime(ticket = {}) {
  return firstValue(endedAt(ticket), calledAt(ticket), arrivedAt(ticket))
}

function eventLabel(event = {}, ticket = {}) {
  const type = normalizeQueueStatus(event.status || event.action || event.type || event.event_type || statusInfo(ticket).key)
  if (type === 'completed') return 'Hoàn tất lượt khám'
  if (type === 'skipped') return 'Bỏ qua / No-show'
  if (type === 'cancelled') return 'Đã hủy lượt khám'
  if (type === 'transferred') return `Chuyển từ ${event.from_room || ticket.from_room || roomName(ticket)}`
  if (type === 'calling') return 'Gọi bệnh nhân'
  if (type === 'serving') return 'Bắt đầu khám'
  return event.description || event.note || statusInfo(ticket).label
}

function timelineTime(event = {}, ticket = {}) {
  return firstValue(event.created_at, event.createdAt, event.time, event.timestamp, event.occurred_at, lastTime(ticket))
}

function fallbackEvent(ticket) {
  return {
    ticket,
    key: statusInfo(ticket).key,
    time: lastTime(ticket),
    label: eventLabel({}, ticket),
  }
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

async function loadQueueHistory(user) {
  const doctorId = getDoctorId(user)
  const emptyBoard = {
    waiting: [],
    called: [],
    in_service: [],
    completed: [],
    skipped: [],
    cancelled: [],
    transferred: [],
  }
  const listParams = doctorId ? { doctor_id: doctorId, limit: 300 } : { limit: 300 }

  const [board, all, summary] = await Promise.all([
    doctorId ? settledValue(doctorApi.queue.getBoard(doctorId), emptyBoard) : Promise.resolve(emptyBoard),
    settledValue(doctorApi.queue.listAll(listParams), emptyBoard),
    settledValue(doctorApi.queue.getTodaySummary(listParams), null),
  ])

  const tickets = mergeTickets(flattenBoard(board), flattenBoard(all))
    .filter(isHistoryTicket)
    .sort((a, b) => new Date(lastTime(b)).getTime() - new Date(lastTime(a)).getTime())
  const events = tickets.map(fallbackEvent).slice(0, 8)

  return { tickets, summary, events }
}

function csvValue(value) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function exportCsv(tickets, user) {
  const header = [
    'So thu tu',
    'Benh nhan',
    'Ma benh nhan',
    'Gio den',
    'Gio goi',
    'Bat dau kham',
    'Ket thuc',
    'Trang thai',
    'Phong kham',
    'Bac si',
    'Thoi gian cho',
    'Thoi luong phuc vu',
  ]
  const rows = tickets.map((ticket, index) => [
    ticketNumber(ticket, index),
    patientName(ticket),
    patientCode(ticket),
    timeFrom(arrivedAt(ticket)),
    timeFrom(calledAt(ticket)),
    timeFrom(startedAt(ticket)),
    timeFrom(endedAt(ticket)),
    statusInfo(ticket).label,
    roomName(ticket),
    doctorName(ticket, user),
    minuteText(waitMinutes(ticket), '0 phút'),
    minuteText(serviceMinutes(ticket), '0 phút'),
  ])
  const csv = [header, ...rows].map((row) => row.map(csvValue).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `lich-su-hang-doi-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function HistoryKpi({ icon, tone, label, value, hint, onClick }) {
  const Component = onClick ? 'button' : 'article'
  return (
    <Component className={`doctor-history-kpi${onClick ? ' is-actionable' : ''}`} type={onClick ? 'button' : undefined} onClick={onClick}>
      <span className={`doctor-history-kpi__icon is-${tone}`}>
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

function PatientAvatar({ ticket }) {
  const avatar = patientAvatar(ticket)
  if (avatar) return <img className="doctor-history-avatar" src={avatar} alt={patientName(ticket)} />
  return <span className="doctor-history-avatar">{initials(ticket)}</span>
}

function Donut({ total, completed, skipped, transferred, cancelled }) {
  const c = percent(completed, total)
  const s = percent(skipped, total)
  const x = percent(cancelled, total)
  const t = percent(transferred, total)
  const background = total
    ? `conic-gradient(${HISTORY_COLORS.completed} 0 ${c}%, ${HISTORY_COLORS.skipped} ${c}% ${c + s}%, ${HISTORY_COLORS.cancelled} ${c + s}% ${c + s + x}%, ${HISTORY_COLORS.transferred} ${c + s + x}% ${c + s + x + t}%, #e8eef8 ${c + s + x + t}% 100%)`
    : 'conic-gradient(#e8eef8 0 100%)'
  return (
    <div className="doctor-history-donut" style={{ background }}>
      <div>
        <strong>{total}</strong>
        <span>Tổng lượt</span>
      </div>
    </div>
  )
}

function DetailModal({ detail, user, onClose }) {
  if (!detail) return null
  const ticket = detail.ticket || {}
  const timeline = safeArray(detail.timeline)
  const statusMeta = statusInfo(ticket)
  return (
    <div className="doctor-history-modal" role="dialog" aria-modal="true" aria-label="Chi tiết lịch sử hàng đợi">
      <div className="doctor-history-modal__backdrop" onClick={onClose} />
      <article className="doctor-history-modal__panel">
        <header>
          <div>
            <span>{ticketNumber(ticket)}</span>
            <h2>{patientName(ticket)}</h2>
            <p>{patientMeta(ticket) || 'Không có mã bệnh nhân'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết">
            <DoctorIcon name="cancel" />
          </button>
        </header>
        <dl>
          <div><dt>Trạng thái</dt><dd><i className={`is-${statusMeta.tone}`}>{statusMeta.label}</i></dd></div>
          <div><dt>Giờ đến</dt><dd>{dateText(arrivedAt(ticket))} {timeFrom(arrivedAt(ticket))}</dd></div>
          <div><dt>Giờ gọi</dt><dd>{timeFrom(calledAt(ticket))}</dd></div>
          <div><dt>Bắt đầu khám</dt><dd>{timeFrom(startedAt(ticket))}</dd></div>
          <div><dt>Kết thúc</dt><dd>{timeFrom(endedAt(ticket))}</dd></div>
          <div><dt>Phòng khám</dt><dd>{roomName(ticket)}</dd></div>
          <div><dt>Bác sĩ phụ trách</dt><dd>{doctorName(ticket, user)}</dd></div>
          <div><dt>Thời gian chờ</dt><dd>{minuteText(waitMinutes(ticket))}</dd></div>
          <div><dt>Thời lượng phục vụ</dt><dd>{minuteText(serviceMinutes(ticket))}</dd></div>
        </dl>
        <section>
          <h3>Timeline ticket</h3>
          {timeline.length ? timeline.map((event, index) => (
            <article key={`${timelineTime(event, ticket)}-${index}`}>
              <time>{dateText(timelineTime(event, ticket))} {timeFrom(timelineTime(event, ticket))}</time>
              <strong>{eventLabel(event, ticket)}</strong>
              {event.note || event.description ? <p>{event.note || event.description}</p> : null}
            </article>
          )) : (
            <p>Backend chưa trả timeline cho ticket này.</p>
          )}
        </section>
      </article>
    </div>
  )
}

function EventsModal({ events, onClose }) {
  if (!events) return null
  return (
    <div className="doctor-history-modal" role="dialog" aria-modal="true" aria-label="Tất cả mốc hoạt động">
      <div className="doctor-history-modal__backdrop" onClick={onClose} />
      <article className="doctor-history-modal__panel is-compact">
        <header>
          <div>
            <span>Lịch sử hàng đợi</span>
            <h2>Tất cả mốc hoạt động</h2>
            <p>{events.length} mốc từ dữ liệu hiện tại</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng timeline">
            <DoctorIcon name="cancel" />
          </button>
        </header>
        <section className="doctor-history-modal-events">
          {events.length ? events.map((event, index) => (
            <article key={`${ticketIdOf(event.ticket)}-${event.time}-${index}`}>
              <time>{dateText(event.time)} {timeFrom(event.time)}</time>
              <strong>{patientName(event.ticket)} ({ticketNumber(event.ticket, index)})</strong>
              <p>{event.label}</p>
            </article>
          )) : <p>Chưa có mốc hoạt động gần đây.</p>}
        </section>
      </article>
    </div>
  )
}

export function DoctorQueueHistoryScreen({ user }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', data: { tickets: [], summary: null, events: [] } })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [room, setRoom] = useState('all')
  const [doctor, setDoctor] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [detail, setDetail] = useState(null)
  const [eventsOpen, setEventsOpen] = useState(false)

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadQueueHistory(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải lịch sử hàng đợi. Vui lòng thử lại sau.'),
        data: { tickets: [], summary: null, events: [] },
      }))
  }

  useEffect(() => {
    let active = true
    loadQueueHistory(user)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải lịch sử hàng đợi. Vui lòng thử lại sau.'),
            data: { tickets: [], summary: null, events: [] },
          })
        }
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    setPage(1)
  }, [query, status, room, doctor, dateFrom, dateTo])

  const allTickets = safeArray(state.data.tickets)
  const rooms = useMemo(() => Array.from(new Set(allTickets.map(roomName))).filter(Boolean), [allTickets])
  const doctors = useMemo(() => Array.from(new Set(allTickets.map((ticket) => doctorName(ticket, user)))).filter(Boolean), [allTickets, user])

  const filteredTickets = useMemo(() => {
    const text = query.trim().toLowerCase()
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null
    return allTickets.filter((ticket, index) => {
      const ticketDate = dateOf(ticket)
      const ticketTime = ticketDate ? new Date(ticketDate).getTime() : null
      const haystack = [
        patientName(ticket),
        patientCode(ticket),
        ticketNumber(ticket, index),
        roomName(ticket),
        doctorName(ticket, user),
      ].join(' ').toLowerCase()
      return (!text || haystack.includes(text))
        && (status === 'all' || statusInfo(ticket).key === status)
        && (room === 'all' || roomName(ticket) === room)
        && (doctor === 'all' || doctorName(ticket, user) === doctor)
        && (!fromTime || (ticketTime && ticketTime >= fromTime))
        && (!toTime || (ticketTime && ticketTime <= toTime))
    })
  }, [allTickets, query, status, room, doctor, dateFrom, dateTo, user])

  const dashboard = useMemo(() => {
    const completed = filteredTickets.filter((ticket) => statusInfo(ticket).key === 'completed').length
    const skipped = filteredTickets.filter((ticket) => statusInfo(ticket).key === 'skipped').length
    const cancelled = filteredTickets.filter((ticket) => statusInfo(ticket).key === 'cancelled').length
    const transferred = filteredTickets.filter((ticket) => statusInfo(ticket).key === 'transferred').length
    const waitValues = filteredTickets.map(waitMinutes).filter(Number.isFinite)
    const serviceValues = filteredTickets.map(serviceMinutes).filter(Number.isFinite)
    const longestWait = filteredTickets
      .map((ticket) => ({ ticket, wait: waitMinutes(ticket) }))
      .filter((row) => Number.isFinite(row.wait))
      .sort((a, b) => b.wait - a.wait)[0]
    const fastestService = filteredTickets
      .map((ticket) => ({ ticket, duration: serviceMinutes(ticket) }))
      .filter((row) => Number.isFinite(row.duration))
      .sort((a, b) => a.duration - b.duration)[0]
    const topRoom = Array.from(filteredTickets.reduce((map, ticket) => {
      const name = roomName(ticket)
      map.set(name, (map.get(name) || 0) + 1)
      return map
    }, new Map()).entries()).sort((a, b) => b[1] - a[1])[0]

    return {
      total: filteredTickets.length,
      completed,
      skipped,
      cancelled,
      transferred,
      avgWait: average(waitValues),
      avgService: average(serviceValues),
      longestWait,
      fastestService,
      topRoom,
    }
  }, [filteredTickets])

  const visibleEvents = useMemo(() => {
    const ids = new Set(filteredTickets.map(ticketIdOf).filter(Boolean))
    const source = safeArray(state.data.events)
    const filtered = source.filter((event) => {
      const id = ticketIdOf(event.ticket)
      return !ids.size || !id || ids.has(id)
    })
    return filtered.length ? filtered : filteredTickets.map(fallbackEvent).slice(0, 8)
  }, [state.data.events, filteredTickets])

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const firstPage = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = filteredTickets.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredTickets.length)
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
    return start + index
  }).filter((value) => value <= totalPages)

  function resetFilters(nextStatus = 'all') {
    setQuery('')
    setStatus(nextStatus)
    setRoom('all')
    setDoctor('all')
    setDateFrom('')
    setDateTo('')
  }

  async function viewDetail(ticket, mode = 'detail') {
    const id = ticketIdOf(ticket)
    if (!id) {
      toast.error('Không tìm thấy mã ticket hàng đợi.')
      return
    }
    try {
      const [ticketDetail, timeline] = await Promise.all([
        mode === 'detail' ? doctorApi.queue.getDetail(id) : Promise.resolve(ticket),
        doctorApi.queue.getTimeline(id),
      ])
      setDetail({ ticket: ticketDetail || ticket, timeline })
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết ticket.'))
    }
  }

  function handleExport() {
    if (!filteredTickets.length) {
      toast.info('Không có dữ liệu lịch sử để xuất.')
      return
    }
    exportCsv(filteredTickets, user)
    toast.success('Đã xuất lịch sử hàng đợi.')
  }

  return (
    <div className="doctor-history-page">
      {state.error ? (
        <div className="doctor-history-error">
          <span>{state.error}</span>
          <button type="button" onClick={reload}>Thử lại</button>
        </div>
      ) : null}

      <section className="doctor-history-kpis" aria-label="Tổng quan lịch sử hàng đợi">
        <HistoryKpi icon="queue" tone="blue" label="Tổng lượt xử lý" value={dashboard.total} hint="Theo bộ lọc hiện tại" onClick={() => resetFilters()} />
        <HistoryKpi icon="check_circle" tone="green" label="Đã hoàn tất" value={dashboard.completed} hint={`${percent(dashboard.completed, dashboard.total)}% tổng lượt xử lý`} onClick={() => resetFilters('completed')} />
        <HistoryKpi icon="chevron_right" tone="orange" label="Bỏ qua / No-show" value={dashboard.skipped} hint={`${percent(dashboard.skipped, dashboard.total)}% tổng lượt xử lý`} onClick={() => resetFilters('skipped')} />
        <HistoryKpi icon="cancel" tone="red" label="Đã hủy" value={dashboard.cancelled} hint={`${percent(dashboard.cancelled, dashboard.total)}% tổng lượt xử lý`} onClick={() => resetFilters('cancelled')} />
        <HistoryKpi icon="clock" tone="purple" label="Thời gian chờ TB" value={`${dashboard.avgWait} phút`} hint="Tính từ lịch sử đang hiển thị" />
      </section>

      <section className="doctor-history-layout">
        <main className="doctor-history-main">
          <article className="doctor-history-panel">
            <h2>Lịch sử hàng đợi</h2>
            <div className="doctor-history-filters">
              <label><DoctorIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm bệnh nhân, số thứ tự..." /></label>
              <label><DoctorIcon name="calendar" /><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Từ ngày" /></label>
              <label><DoctorIcon name="calendar" /><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Đến ngày" /></label>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="completed">Đã hoàn tất</option>
                <option value="skipped">Bỏ qua / No-show</option>
                <option value="cancelled">Đã hủy</option>
                <option value="transferred">Chuyển</option>
              </select>
              <select value={room} onChange={(event) => setRoom(event.target.value)}>
                <option value="all">Tất cả phòng khám</option>
                {rooms.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={doctor} onChange={(event) => setDoctor(event.target.value)}>
                <option value="all">Tất cả bác sĩ</option>
                {doctors.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <button className="doctor-history-filter-button" type="button" onClick={() => resetFilters()}>Đặt lại</button>
            </div>

            <div className="doctor-history-table">
              <div className="doctor-history-head">
                <span>Ngày</span>
                <span>Số thứ tự</span>
                <span>Bệnh nhân</span>
                <span>Trạng thái cuối</span>
                <span>Giờ gọi</span>
                <span>Bắt đầu khám</span>
                <span>Hoàn tất</span>
                <span>Thời gian chờ</span>
                <span>Tổng thời gian</span>
                <span>Hành động</span>
              </div>
              <div className="doctor-history-body">
                {state.loading ? (
                  <div className="doctor-appointment-empty is-small">Đang tải lịch sử hàng đợi...</div>
                ) : firstPage.length ? firstPage.map((ticket, index) => {
                  const absoluteIndex = (currentPage - 1) * PAGE_SIZE + index
                  const statusMeta = statusInfo(ticket)
                  return (
                    <div className="doctor-history-row" key={ticketIdOf(ticket) || `history-${absoluteIndex}`}>
                      <span>{dateText(dateOf(ticket))}</span>
                      <strong>{ticketNumber(ticket, absoluteIndex)}</strong>
                      <div className="doctor-history-patient">
                        <PatientAvatar ticket={ticket} />
                        <span><b>{patientName(ticket)}</b><small>{patientMeta(ticket) || roomName(ticket)}</small></span>
                      </div>
                      <i className={`is-${statusMeta.tone}`}>{statusMeta.label}</i>
                      <span>{timeFrom(calledAt(ticket))}</span>
                      <span>{timeFrom(startedAt(ticket))}</span>
                      <span>{timeFrom(endedAt(ticket))}</span>
                      <span>{minuteText(waitMinutes(ticket))}</span>
                      <span>{minuteText(serviceMinutes(ticket) ?? totalMinutes(ticket))}</span>
                      <span className="doctor-history-actions">
                        <button type="button" onClick={() => viewDetail(ticket)}><DoctorIcon name="search" /> Chi tiết</button>
                        <button type="button" onClick={() => viewDetail(ticket, 'timeline')}><DoctorIcon name="clock" /> Timeline</button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-appointment-empty is-small">Chưa có lịch sử hàng đợi.</div>
                )}
              </div>
            </div>

            <footer className="doctor-history-footer">
              <span>Hiển thị <b>{PAGE_SIZE}</b> dòng</span>
              <div>
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
                {pageNumbers.map((pageNumber) => (
                  <button type="button" className={pageNumber === currentPage ? 'is-active' : ''} key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                ))}
                <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button>
              </div>
              <span>Hiển thị {filteredTickets.length ? `${pageStart} đến ${pageEnd}` : '0'} của {filteredTickets.length} lượt</span>
            </footer>
          </article>
        </main>

        <aside className="doctor-history-side">
          <article className="doctor-history-panel doctor-history-overview">
            <h2>Tổng quan lịch sử</h2>
            <div className="doctor-history-overview__top">
              <Donut total={dashboard.total} completed={dashboard.completed} skipped={dashboard.skipped} transferred={dashboard.transferred} cancelled={dashboard.cancelled} />
              <dl>
                <div><dt><i className="is-completed" /> Đã hoàn tất</dt><dd>{dashboard.completed} ({percent(dashboard.completed, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-skipped" /> Bỏ qua</dt><dd>{dashboard.skipped} ({percent(dashboard.skipped, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-cancelled" /> Đã hủy</dt><dd>{dashboard.cancelled} ({percent(dashboard.cancelled, dashboard.total)}%)</dd></div>
                {dashboard.transferred ? <div><dt><i className="is-transferred" /> Chuyển</dt><dd>{dashboard.transferred} ({percent(dashboard.transferred, dashboard.total)}%)</dd></div> : null}
              </dl>
            </div>
            <div className="doctor-history-metrics">
              <p><DoctorIcon name="clock" /><span>Thời gian chờ TB</span><strong>{dashboard.avgWait} phút</strong></p>
              <p><DoctorIcon name="clock" /><span>Phục vụ TB</span><strong>{dashboard.avgService ? `${dashboard.avgService} phút` : '--'}</strong></p>
              <p><DoctorIcon name="queue" /><span>Ticket chờ lâu nhất</span><strong>{dashboard.longestWait ? `${ticketNumber(dashboard.longestWait.ticket)} - ${dashboard.longestWait.wait} phút` : '--'}</strong></p>
              <p><DoctorIcon name="check_circle" /><span>Xử lý nhanh nhất</span><strong>{dashboard.fastestService ? `${ticketNumber(dashboard.fastestService.ticket)} - ${dashboard.fastestService.duration} phút` : '--'}</strong></p>
              <p><DoctorIcon name="pin" /><span>Phòng xử lý nhiều nhất</span><strong>{dashboard.topRoom ? `${dashboard.topRoom[0]} (${dashboard.topRoom[1]})` : '--'}</strong></p>
              <p><DoctorIcon name="doctor" /><span>Bác sĩ phụ trách</span><strong>{doctor === 'all' ? doctorName({}, user) : doctor}</strong></p>
            </div>
          </article>

          <article className="doctor-history-panel doctor-history-events">
            <h2>Mốc hoạt động gần đây</h2>
            <div>
              {visibleEvents.slice(0, 5).map((event, index) => (
                <article key={`${ticketIdOf(event.ticket)}-${event.time}-${index}`}>
                  <i className={`is-${event.key}`} />
                  <time>{timeFrom(event.time)}</time>
                  <span>
                    <b>{patientName(event.ticket)} ({ticketNumber(event.ticket, index)})</b>
                    <small>{event.label}</small>
                  </span>
                </article>
              ))}
              {!visibleEvents.length ? <p className="doctor-history-empty-note">Chưa có mốc hoạt động gần đây.</p> : null}
            </div>
            <button type="button" onClick={() => setEventsOpen(true)}>Xem tất cả mốc hoạt động <DoctorIcon name="chevron_right" /></button>
          </article>

          <article className="doctor-history-panel doctor-history-quick">
            <h2>Thao tác nhanh</h2>
            <div>
              <button type="button" onClick={handleExport}><DoctorIcon name="arrow_left" /> Xuất lịch sử</button>
              <button type="button" onClick={() => resetFilters()}><DoctorIcon name="settings" /> Đặt lại lọc</button>
              <button type="button" onClick={() => navigate('/doctor/queue')}><DoctorIcon name="patients" /> Xem bảng hàng đợi</button>
              <button type="button" onClick={reload} disabled={state.loading}><DoctorIcon name="refresh" /> Làm mới</button>
            </div>
          </article>
        </aside>
      </section>

      <DetailModal detail={detail} user={user} onClose={() => setDetail(null)} />
      <EventsModal events={eventsOpen ? visibleEvents : null} onClose={() => setEventsOpen(false)} />
    </div>
  )
}
