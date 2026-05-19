import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doctorApi, getDoctorId } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { ConfirmActionDialog, DoctorIcon } from './DoctorShell'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5
const STATUS_COLORS = {
  waiting: '#ff9f1a',
  calling: '#2f86ff',
  serving: '#35c875',
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
  if (['calling', 'called', 'recalled'].includes(raw)) return 'calling'
  if (['serving', 'in_service', 'in-progress', 'in_progress', 'examining'].includes(raw)) return 'serving'
  if (['completed', 'done', 'finished'].includes(raw)) return 'completed'
  if (['skipped', 'skip', 'no_show', 'no-show', 'missed'].includes(raw)) return 'skipped'
  if (['cancelled', 'canceled'].includes(raw)) return 'cancelled'
  return raw || 'unknown'
}

function ticketIdOf(ticket = {}) {
  return valueOf(ticket, ['ticket_id', 'ticketId', 'queue_ticket_id', 'queueTicketId', 'id', '_id'], '')
}

function ticketNumber(ticket = {}, index = 0) {
  const value = valueOf(ticket, ['queue_number', 'queueNumber', 'ticket_number', 'ticketNumber', 'ticket_no', 'number', 'sequence_number'], '')
  if (value) return String(value).padStart(2, '0')
  return String(index + 1).padStart(2, '0')
}

function getPatient(ticket = {}) {
  return ticket.patient || ticket.patient_info || {}
}

function patientName(ticket = {}) {
  return nestedValue(ticket, [
    'patient_name',
    'patientName',
    'patient.fullName',
    'patient.full_name',
    'patient.name',
    'patient_info.full_name',
    'patient_info.name',
  ], 'Chưa có tên bệnh nhân')
}

function patientAvatar(ticket = {}) {
  const patient = getPatient(ticket)
  return ticket.patient_avatar || ticket.avatar_url || patient.avatar_url || patient.photo_url || patient.image_url || ''
}

function patientCode(ticket = {}) {
  return nestedValue(ticket, [
    'patient_code',
    'patientCode',
    'patient.patientCode',
    'patient.patient_code',
    'patient.code',
    'patient_info.patient_code',
    'patient_id',
  ], '')
}

function patientMeta(ticket = {}) {
  const gender = nestedValue(ticket, ['patient_gender', 'patient.gender', 'patient.sex', 'patient_info.gender'], '')
  const age = nestedValue(ticket, ['patient_age', 'patient.age', 'patient_info.age'], '')
  return [age ? `${age} tuổi` : '', gender, patientCode(ticket) ? `#${patientCode(ticket)}` : ''].filter(Boolean).join(' · ')
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

function reasonText(ticket = {}) {
  return ticket.reason || ticket.reason_for_visit || ticket.note || ticket.queue_type || ticket.service_name || 'Theo thứ tự hàng đợi'
}

function arrivedAt(ticket = {}) {
  return valueOf(ticket, ['arrived_at', 'arrivedAt', 'checkin_time', 'check_in_time', 'checkInTime', 'created_at', 'createdAt'], '')
}

function calledAt(ticket = {}) {
  return valueOf(ticket, ['called_at', 'calledAt', 'called_time', 'last_called_at', 'lastCalledAt', 'updated_at', 'updatedAt'], '')
}

function serviceStartedAt(ticket = {}) {
  return valueOf(ticket, ['started_at', 'startedAt', 'start_time', 'service_started_at', 'called_at', 'calledAt', 'called_time'], '')
}

function serviceEndedAt(ticket = {}) {
  return valueOf(ticket, ['completed_at', 'completedAt', 'completed_time', 'updated_at', 'updatedAt'], '')
}

function callCount(ticket = {}) {
  const value = Number(valueOf(ticket, ['call_count', 'callCount', 'called_count', 'calledCount', 'recall_count', 'recallCount'], 0))
  return Number.isFinite(value) ? value : 0
}

function statusInfo(ticket = {}) {
  const key = normalizeQueueStatus(ticket.status)
  if (key === 'calling') return { key, label: 'Đang gọi', tone: 'blue' }
  if (key === 'serving') return { key, label: 'Đang khám', tone: 'green' }
  if (key === 'completed') return { key, label: 'Đã hoàn tất', tone: 'green' }
  if (key === 'skipped') return { key, label: 'Bỏ qua', tone: 'slate' }
  if (key === 'cancelled') return { key, label: 'Đã hủy', tone: 'red' }
  return { key: 'waiting', label: 'Đang chờ', tone: 'orange' }
}

function waitMinutes(ticket = {}) {
  const explicit = Number(valueOf(ticket, ['wait_minutes', 'waiting_minutes', 'waitMinutes', 'estimated_wait_minutes'], NaN))
  if (Number.isFinite(explicit)) return Math.max(0, Math.round(explicit))

  const start = new Date(arrivedAt(ticket)).getTime()
  if (Number.isNaN(start)) return null

  const endValue = serviceStartedAt(ticket) || serviceEndedAt(ticket) || calledAt(ticket)
  const end = endValue ? new Date(endValue).getTime() : Date.now()
  if (Number.isNaN(end)) return null

  return Math.max(0, Math.round((end - start) / 60000))
}

function minutesText(minutes) {
  if (!Number.isFinite(minutes)) return '--'
  return `${minutes} phút`
}

function waitText(ticket = {}) {
  return minutesText(waitMinutes(ticket))
}

function waitRange(tickets = []) {
  const waits = tickets.map(waitMinutes).filter((value) => Number.isFinite(value))
  if (!waits.length) return '--'
  const min = Math.min(...waits)
  const max = Math.max(...waits)
  return min === max ? `${min} phút` : `${min} - ${max} phút`
}

function averageWait(tickets = []) {
  const waits = tickets.map(waitMinutes).filter((value) => Number.isFinite(value))
  if (!waits.length) return 0
  return Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length)
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

function sortByQueueOrder(a, b) {
  const orderA = Number(valueOf(a, ['queue_number', 'queueNumber', 'ticket_number', 'ticketNumber', 'ticket_no', 'sequence_number'], 999999))
  const orderB = Number(valueOf(b, ['queue_number', 'queueNumber', 'ticket_number', 'ticketNumber', 'ticket_no', 'sequence_number'], 999999))
  if (orderA !== orderB) return orderA - orderB
  return new Date(arrivedAt(a) || 0).getTime() - new Date(arrivedAt(b) || 0).getTime()
}

function sortCalling(a, b) {
  const aCalledAt = new Date(calledAt(a) || valueOf(a, ['updated_at', 'updatedAt'], '') || 0).getTime()
  const bCalledAt = new Date(calledAt(b) || valueOf(b, ['updated_at', 'updatedAt'], '') || 0).getTime()
  if (aCalledAt !== bCalledAt) return bCalledAt - aCalledAt
  return sortByQueueOrder(a, b)
}

function groupedRooms(tickets = []) {
  const map = new Map()
  tickets.forEach((ticket) => {
    const room = roomName(ticket)
    if (!map.has(room)) map.set(room, [])
    map.get(room).push(ticket)
  })
  return Array.from(map.entries())
    .map(([room, items]) => ({ room, count: items.length, wait: waitRange(items) }))
    .sort((a, b) => b.count - a.count)
}

function statusDonutBackground({ waiting, calling, serving, completed, skipped, total }) {
  if (!total) return 'conic-gradient(#e8eef8 0 100%)'
  const segments = [
    { color: STATUS_COLORS.waiting, value: waiting },
    { color: STATUS_COLORS.calling, value: calling },
    { color: STATUS_COLORS.serving, value: serving },
    { color: STATUS_COLORS.completed, value: completed },
    { color: STATUS_COLORS.skipped, value: skipped },
  ]
  let cursor = 0
  const stops = segments
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cursor
      cursor += (item.value / total) * 100
      return `${item.color} ${start}% ${cursor}%`
    })
  if (cursor < 100) stops.push(`#e8eef8 ${cursor}% 100%`)
  return `conic-gradient(${stops.join(', ')})`
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

async function loadQueueCalling(user) {
  const doctorId = getDoctorId(user)
  const emptyBoard = { waiting: [], called: [], in_service: [], serving: [], completed: [], skipped: [], cancelled: [] }
  const query = doctorId ? { doctor_id: doctorId, limit: 200 } : { limit: 200 }
  const [board, groupedAll, summary] = await Promise.all([
    doctorId ? settledValue(doctorApi.queue.getBoard(doctorId), emptyBoard) : Promise.resolve(emptyBoard),
    settledValue(doctorApi.queue.listAll(query), emptyBoard),
    settledValue(doctorApi.queue.getTodaySummary(query), null),
  ])

  const selectedBoard = flattenBoard(board).length ? board : groupedAll
  const tickets = flattenBoard(selectedBoard).sort(sortByQueueOrder)

  return { board: selectedBoard, tickets, summary }
}

function PatientAvatar({ ticket, size = 'normal' }) {
  const avatar = patientAvatar(ticket)
  if (avatar) {
    return <img className={`doctor-calling-avatar is-${size}`} src={avatar} alt={patientName(ticket)} />
  }
  return <span className={`doctor-calling-avatar is-${size}`}>{initials(ticket)}</span>
}

function CallingKpi({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-calling-kpi">
      <span className={`doctor-calling-kpi__icon is-${tone}`}>
        <DoctorIcon name={icon} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{hint}</span>
      </div>
    </article>
  )
}

function CallingDonut({ dashboard }) {
  return (
    <div className="doctor-calling-donut" style={{ background: statusDonutBackground(dashboard) }}>
      <div>
        <strong>{dashboard.total}</strong>
        <span>Tổng lượt</span>
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
      <div className="doctor-dialog doctor-calling-detail-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="doctor-dialog-head">
          <h3>Chi tiết ticket {ticketNumber(ticket)}</h3>
          <button className="doctor-icon-button" type="button" onClick={onClose} aria-label="Đóng hộp thoại">
            <DoctorIcon name="cancel" />
          </button>
        </div>
        <div className="doctor-calling-detail-grid">
          <p><span>Bệnh nhân</span><strong>{patientName(ticket)}</strong></p>
          <p><span>Mã bệnh nhân</span><strong>{patientCode(ticket) || '--'}</strong></p>
          <p><span>Trạng thái</span><strong>{status.label}</strong></p>
          <p><span>Giờ gọi</span><strong>{formatTime(calledAt(ticket))}</strong></p>
          <p><span>Phòng khám</span><strong>{roomName(ticket)}</strong></p>
          <p><span>Bác sĩ</span><strong>{doctorName(ticket)}</strong></p>
        </div>
        <div className="doctor-calling-detail-timeline">
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

export function DoctorQueueCallingScreen({ user }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', data: { board: {}, tickets: [], summary: null } })
  const [actingId, setActingId] = useState('')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadQueueCalling(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải dữ liệu hàng đợi đang gọi. Vui lòng thử lại sau.'),
        data: { board: {}, tickets: [], summary: null },
      }))
  }

  useEffect(() => {
    let active = true
    loadQueueCalling(user)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải dữ liệu hàng đợi đang gọi. Vui lòng thử lại sau.'),
            data: { board: {}, tickets: [], summary: null },
          })
        }
      })
    return () => {
      active = false
    }
  }, [user])

  const dashboard = useMemo(() => {
    const tickets = safeArray(state.data.tickets)
    const waitingTickets = tickets.filter((item) => statusInfo(item).key === 'waiting').sort(sortByQueueOrder)
    const callingTickets = tickets.filter((item) => statusInfo(item).key === 'calling').sort(sortCalling)
    const servingTickets = tickets.filter((item) => statusInfo(item).key === 'serving')
    const completedTickets = tickets.filter((item) => statusInfo(item).key === 'completed')
    const skippedTickets = tickets.filter((item) => statusInfo(item).key === 'skipped')
    const summary = state.data.summary || {}
    const waiting = numberFrom(summary, ['waiting_count', 'waiting', 'pending_count'], waitingTickets.length)
    const calling = numberFrom(summary, ['called_count', 'calling_count', 'called', 'calling'], callingTickets.length)
    const serving = numberFrom(summary, ['in_service_count', 'serving_count', 'in_service', 'serving'], servingTickets.length)
    const completed = numberFrom(summary, ['completed_count', 'completed', 'done_count', 'finished_count'], completedTickets.length)
    const skipped = numberFrom(summary, ['skipped_count', 'skip_count', 'no_show_count', 'skipped'], skippedTickets.length)
    const total = numberFrom(summary, ['total_tickets', 'total_patients', 'total'], waiting + calling + serving + completed + skipped || tickets.length)
    const currentCalling = callingTickets[0] || null
    const nextPatient = waitingTickets[0] || null
    const avgWait = numberFrom(summary, ['average_wait_minutes', 'avg_wait_minutes', 'average_wait'], averageWait(tickets))
    const rooms = groupedRooms([...callingTickets, ...waitingTickets])

    return {
      tickets,
      waitingTickets,
      callingTickets,
      servingTickets,
      completedTickets,
      skippedTickets,
      waiting,
      calling,
      serving,
      completed,
      skipped,
      total,
      avgWait,
      currentCalling,
      nextPatient,
      rooms,
      currentRoom: currentCalling ? roomName(currentCalling) : nextPatient ? roomName(nextPatient) : rooms[0]?.room || '--',
      currentDoctor: doctorName(currentCalling || nextPatient || {}, user),
    }
  }, [state.data, user])

  useEffect(() => {
    setPage(1)
  }, [dashboard.callingTickets])

  const totalPages = Math.max(1, Math.ceil(dashboard.callingTickets.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = dashboard.callingTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const pageStart = dashboard.callingTickets.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0
  const pageEnd = Math.min(currentPage * PAGE_SIZE, dashboard.callingTickets.length)

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
      if (type === 'start') await doctorApi.queue.startService(ticketId)
      if (type === 'noShow') await doctorApi.queue.markNoShow(ticketId)
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
    if (!dashboard.callingTickets.length) {
      toast.info('Không có bệnh nhân đang gọi để xuất.')
      return
    }

    const rows = [
      ['Số thứ tự', 'Bệnh nhân', 'Mã bệnh nhân', 'Giờ đến', 'Giờ gọi', 'Trạng thái', 'Phòng khám', 'Bác sĩ', 'Thời gian chờ', 'Số lần gọi'],
      ...dashboard.callingTickets.map((ticket, index) => [
        ticketNumber(ticket, index),
        patientName(ticket),
        patientCode(ticket),
        formatTime(arrivedAt(ticket)),
        formatTime(calledAt(ticket)),
        statusInfo(ticket).label,
        roomName(ticket),
        doctorName(ticket, user),
        waitText(ticket),
        callCount(ticket) || '',
      ]),
    ]
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `doctor-calling-queue-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Đã xuất danh sách đang gọi.')
  }

  const currentTicket = dashboard.currentCalling

  return (
    <div className="doctor-calling-page">
      {state.error ? (
        <div className="doctor-today-error doctor-calling-error">
          <span>{state.error}</span>
          <button type="button" onClick={reload}>Thử lại</button>
        </div>
      ) : null}

      <section className="doctor-calling-kpis" aria-label="Tổng quan gọi tiếp theo">
        <CallingKpi icon="patients" tone="blue" label="Đang chờ" value={dashboard.waiting} hint="Chờ trong hàng đợi" />
        <CallingKpi icon="message" tone="green" label="Đang gọi" value={dashboard.calling} hint="Đang được gọi" />
        <CallingKpi icon="doctor" tone="orange" label="Đang khám" value={dashboard.serving} hint="Đang phục vụ" />
        <CallingKpi icon="check_circle" tone="purple" label="Đã hoàn tất" value={dashboard.completed} hint="Hoàn tất hôm nay" />
      </section>

      <section className="doctor-calling-layout">
        <main className="doctor-calling-main">
          <article className="doctor-calling-panel doctor-calling-next">
            <header>
              <h2>Bệnh nhân đang gọi hiện tại</h2>
              <span>Ưu tiên: {currentTicket?.priority_flag || currentTicket?.priority ? 'Cao' : 'Thường'}</span>
            </header>

            {state.loading ? (
              <div className="doctor-appointment-empty is-small">Đang tải bệnh nhân đang gọi...</div>
            ) : currentTicket ? (
              <div className="doctor-calling-next__body">
                <div className="doctor-calling-stt">
                  <span>STT HÀNG ĐỢI</span>
                  <strong>{ticketNumber(currentTicket)}</strong>
                  <b>{roomName(currentTicket)}</b>
                </div>

                <PatientAvatar ticket={currentTicket} />

                <div className="doctor-calling-patient-info">
                  <h3>{patientName(currentTicket)}</h3>
                  <p><DoctorIcon name="calendar" /> {patientMeta(currentTicket) || 'Thông tin bệnh nhân'}</p>
                  <p>Lý do khám: {reasonText(currentTicket)}</p>
                  <div>
                    <span><DoctorIcon name="clock" /> Giờ gọi <strong>{formatTime(calledAt(currentTicket))}</strong></span>
                    <span><DoctorIcon name="queue" /> Phòng khám <strong>{roomName(currentTicket)}</strong></span>
                    <span><DoctorIcon name="clock" /> Thời gian chờ <strong>{waitText(currentTicket)}</strong></span>
                    <span><DoctorIcon name="message" /> Số lần gọi <strong>{callCount(currentTicket) || '--'}</strong></span>
                  </div>
                </div>

                <div className="doctor-calling-action-grid">
                  <button type="button" className="is-primary" onClick={() => runAction('callNext')} disabled={Boolean(actingId)}>
                    <DoctorIcon name="message" />
                    Gọi tiếp theo
                  </button>
                  <button type="button" onClick={() => runAction('call', currentTicket)} disabled={Boolean(actingId)}>
                    <DoctorIcon name="message" />
                    Gọi lại
                  </button>
                  <button type="button" onClick={() => runAction('start', currentTicket)} disabled={Boolean(actingId)}>
                    <DoctorIcon name="doctor" />
                    Bắt đầu khám
                  </button>
                  <button type="button" onClick={() => setConfirmAction({ type: 'noShow', ticket: currentTicket, label: 'Bỏ qua' })} disabled={Boolean(actingId)}>
                    <DoctorIcon name="chevron_right" />
                    Bỏ qua
                  </button>
                  <button type="button" onClick={() => viewDetail(currentTicket)} disabled={Boolean(actingId)}>
                    <DoctorIcon name="search" />
                    Xem chi tiết
                  </button>
                </div>
              </div>
            ) : (
              <div className="doctor-appointment-empty is-small">Chưa có bệnh nhân đang được gọi.</div>
            )}
          </article>

          <article className="doctor-calling-panel doctor-calling-list-panel">
            <header>
              <h2>Bệnh nhân đang gọi</h2>
              <span>{dashboard.callingTickets.length}</span>
            </header>
            <div className="doctor-calling-table">
              <div className="doctor-calling-table-head">
                <span>Số thứ tự</span>
                <span>Bệnh nhân</span>
                <span>Giờ đến</span>
                <span>Giờ gọi</span>
                <span>Phòng khám</span>
                <span>Thời gian chờ</span>
                <span>Số lần gọi</span>
                <span>Hành động</span>
              </div>
              <div className="doctor-calling-table-body">
                {state.loading ? (
                  <div className="doctor-appointment-empty is-small">Đang tải danh sách đang gọi...</div>
                ) : pageRows.length ? pageRows.map((ticket, index) => {
                  const rowNumber = (currentPage - 1) * PAGE_SIZE + index
                  return (
                    <div className="doctor-calling-table-row" key={ticketIdOf(ticket) || `calling-${index}`}>
                      <strong>{ticketNumber(ticket, rowNumber)}</strong>
                      <span className="doctor-calling-table-patient">
                        <PatientAvatar ticket={ticket} size="tiny" />
                        <span><b>{patientName(ticket)}</b><small>{patientMeta(ticket) || '--'}</small></span>
                      </span>
                      <span>{formatTime(arrivedAt(ticket))}</span>
                      <span>{formatTime(calledAt(ticket))}</span>
                      <span>{roomName(ticket)}</span>
                      <span>{waitText(ticket)}</span>
                      <span>{callCount(ticket) || '--'}</span>
                      <span className="doctor-calling-row-actions">
                        <button type="button" onClick={() => runAction('call', ticket)} disabled={Boolean(actingId)}>Gọi lại</button>
                        <button type="button" onClick={() => runAction('start', ticket)} disabled={Boolean(actingId)}>Bắt đầu</button>
                        <button type="button" onClick={() => setConfirmAction({ type: 'noShow', ticket, label: 'Bỏ qua' })} disabled={Boolean(actingId)}>Bỏ qua</button>
                        <button type="button" onClick={() => viewDetail(ticket)} disabled={Boolean(actingId)}>Chi tiết</button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-appointment-empty is-small">Chưa có bệnh nhân đang được gọi.</div>
                )}
              </div>
            </div>
            <footer className="doctor-calling-pagination">
              <span>Hiển thị {dashboard.callingTickets.length ? `${pageStart} đến ${pageEnd}` : '0'} của {dashboard.callingTickets.length}</span>
              <div>
                <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                  <button type="button" className={pageNumber === currentPage ? 'is-active' : ''} key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                ))}
                <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button>
              </div>
            </footer>
          </article>

          <section className="doctor-calling-lists">
            <article className="doctor-calling-panel">
              <header>
                <h2>Đang được phục vụ</h2>
                <span>{dashboard.servingTickets.length}</span>
              </header>
              <div className="doctor-calling-serving">
                {dashboard.servingTickets.length ? dashboard.servingTickets.slice(0, 3).map((ticket, index) => (
                  <div className="doctor-calling-serving-row" key={ticketIdOf(ticket) || `serving-${index}`}>
                    <PatientAvatar ticket={ticket} size="small" />
                    <span>
                      <b>{patientName(ticket)}</b>
                      <small>{patientMeta(ticket)}</small>
                    </span>
                    <i>{roomName(ticket)}</i>
                    <strong>Đang khám</strong>
                    <small>{waitText(ticket)}</small>
                  </div>
                )) : <div className="doctor-appointment-empty is-small">Chưa có bệnh nhân đang khám.</div>}
              </div>
              <button type="button" className="doctor-calling-link" onClick={() => navigate('/doctor/queue')}>Xem toàn bộ hàng đợi <DoctorIcon name="chevron_right" /></button>
            </article>

            <article className="doctor-calling-panel">
              <header>
                <h2>Danh sách chờ kế tiếp</h2>
                <span><DoctorIcon name="patients" /> {dashboard.waitingTickets.length}</span>
              </header>
              <div className="doctor-calling-waiting">
                {dashboard.waitingTickets.slice(0, 5).map((ticket, index) => (
                  <div className="doctor-calling-waiting-row" key={ticketIdOf(ticket) || `waiting-${index}`}>
                    <strong>{ticketNumber(ticket, index + 1)}</strong>
                    <PatientAvatar ticket={ticket} size="tiny" />
                    <span>
                      <b>{patientName(ticket)}</b>
                      <small>{patientMeta(ticket)}</small>
                    </span>
                    <i>{roomName(ticket)}</i>
                    <mark>Chờ {waitText(ticket)}</mark>
                  </div>
                ))}
                {!dashboard.waitingTickets.length ? <div className="doctor-appointment-empty is-small">Không còn bệnh nhân chờ kế tiếp.</div> : null}
              </div>
              <button type="button" className="doctor-calling-link" onClick={() => navigate('/doctor/queue')}>Xem đầy đủ danh sách chờ <DoctorIcon name="chevron_right" /></button>
            </article>
          </section>
        </main>

        <aside className="doctor-calling-side">
          <article className="doctor-calling-panel doctor-calling-overview">
            <header>
              <h2>Tổng quan hàng đợi</h2>
              <span>Thời gian thực</span>
            </header>
            <div className="doctor-calling-overview__body">
              <CallingDonut dashboard={dashboard} />
              <dl>
                <div><dt><i className="is-waiting" /> Đang chờ</dt><dd>{dashboard.waiting} ({percent(dashboard.waiting, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-calling" /> Đang gọi</dt><dd>{dashboard.calling} ({percent(dashboard.calling, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-serving" /> Đang khám</dt><dd>{dashboard.serving} ({percent(dashboard.serving, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-completed" /> Đã hoàn tất</dt><dd>{dashboard.completed} ({percent(dashboard.completed, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-skipped" /> Bỏ qua</dt><dd>{dashboard.skipped} ({percent(dashboard.skipped, dashboard.total)}%)</dd></div>
              </dl>
            </div>
          </article>

          <article className="doctor-calling-panel doctor-calling-estimate">
            <h2>Thời gian chờ ước tính</h2>
            {dashboard.rooms.slice(0, 4).map((room) => (
              <div key={room.room}>
                <DoctorIcon name="calendar" />
                <span>{room.room}</span>
                <strong>{room.wait}</strong>
              </div>
            ))}
            {!dashboard.rooms.length ? <div><DoctorIcon name="calendar" /><span>Chưa có dữ liệu</span><strong>--</strong></div> : null}
            <div>
              <DoctorIcon name="clock" />
              <span>Thời gian chờ TB</span>
              <strong>{dashboard.avgWait} phút</strong>
            </div>
          </article>

          <article className="doctor-calling-panel doctor-calling-current">
            <h2>Thông tin hiện tại</h2>
            <div>
              <DoctorIcon name="message" />
              <span>Bệnh nhân đang gọi</span>
              <strong>{dashboard.currentCalling ? patientName(dashboard.currentCalling) : '--'}</strong>
            </div>
            <div>
              <DoctorIcon name="patients" />
              <span>Bệnh nhân tiếp theo</span>
              <strong>{dashboard.nextPatient ? patientName(dashboard.nextPatient) : '--'}</strong>
            </div>
            <div>
              <DoctorIcon name="home" />
              <span>Phòng khám hiện tại</span>
              <strong>{dashboard.currentRoom}</strong>
            </div>
            <div>
              <DoctorIcon name="doctor" />
              <span>Bác sĩ phụ trách</span>
              <strong>{dashboard.currentDoctor}</strong>
            </div>
          </article>

          <article className="doctor-calling-panel doctor-calling-quick">
            <h2>Thao tác nhanh</h2>
            <div>
              <button type="button" onClick={reload} disabled={state.loading}><DoctorIcon name="refresh" /> Làm mới trạng thái</button>
              <button type="button" onClick={exportCsv} disabled={state.loading}><DoctorIcon name="note" /> Xuất danh sách</button>
              <button type="button" onClick={() => navigate('/doctor/queue?view=history')}><DoctorIcon name="clock" /> Xem lịch sử</button>
              <button type="button" className="is-danger" onClick={() => currentTicket ? setConfirmAction({ type: 'cancel', ticket: currentTicket, label: 'Hủy' }) : toast.info('Không có ticket đang gọi để hủy.')}><DoctorIcon name="cancel" /> Hủy ticket hiện tại</button>
            </div>
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
