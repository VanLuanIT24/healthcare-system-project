import { useEffect, useMemo, useState } from 'react'
import { doctorApi, getDoctorId } from './doctorApi'
import { safeArray } from './doctorData'
import { DoctorIcon } from './DoctorShell'
import { useToast } from './toast/ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const HISTORY_COLORS = {
  completed: '#25bd71',
  skipped: '#ff9416',
  transferred: '#2177ff',
  cancelled: '#ef4444',
}

function ticketIdOf(ticket = {}) {
  return ticket.queue_ticket_id || ticket.ticket_id || ticket.id || ticket._id || ''
}

function ticketNumber(ticket = {}, index = 0) {
  const room = roomName(ticket).replace(/\s+/g, '') || 'PK'
  const value = ticket.queue_number || ticket.ticket_no || ticket.number || ticket.sequence_number || index + 1
  return String(value).startsWith(room) ? String(value) : `${room}-${String(value).padStart(3, '0')}`
}

function getPatient(ticket = {}) {
  return ticket.patient || ticket.patient_info || {}
}

function patientName(ticket = {}) {
  const patient = getPatient(ticket)
  return ticket.patient_name || patient.full_name || patient.name || 'Bệnh nhân'
}

function patientAvatar(ticket = {}) {
  const patient = getPatient(ticket)
  return ticket.patient_avatar || ticket.avatar_url || patient.avatar_url || patient.photo_url || patient.image_url || ''
}

function patientMeta(ticket = {}) {
  const patient = getPatient(ticket)
  const gender = ticket.patient_gender || patient.gender || patient.sex
  const age = ticket.patient_age || patient.age
  return [gender, age ? `${age} tuổi` : ''].filter(Boolean).join(', ')
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
  return ticket.room_name || ticket.clinic_room || ticket.room || ticket.location || ticket.department_name || 'PK'
}

function doctorName(ticket = {}, user = {}) {
  const doctor = ticket.doctor || {}
  return ticket.doctor_name || doctor.full_name || doctor.name || user.full_name || user.name || 'Bác sĩ'
}

function dateOf(ticket = {}) {
  return ticket.service_date || ticket.queue_date || ticket.date || ticket.created_at || ticket.checkin_time || ticket.check_in_time || ''
}

function timeFrom(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }
  const text = String(value)
  return text.length >= 5 ? text.slice(0, 5) : text
}

function dateText(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString('vi-VN')
}

function statusInfo(ticket = {}) {
  const raw = String(ticket.status || ticket.final_status || '').toLowerCase()
  if (['completed', 'done', 'finished'].includes(raw)) return { key: 'completed', label: 'Hoàn tất', tone: 'green' }
  if (['skipped', 'skip'].includes(raw)) return { key: 'skipped', label: 'Bỏ qua', tone: 'orange' }
  if (['transferred', 'transfer', 'moved'].includes(raw)) return { key: 'transferred', label: 'Chuyển', tone: 'blue' }
  if (['cancelled', 'canceled'].includes(raw)) return { key: 'cancelled', label: 'Hủy', tone: 'red' }
  if (['in_service', 'serving', 'examining', 'in_progress'].includes(raw)) return { key: 'in_service', label: 'Đang khám', tone: 'green' }
  if (['called', 'recalled'].includes(raw)) return { key: 'called', label: 'Đã gọi', tone: 'blue' }
  return { key: 'waiting', label: 'Đang chờ', tone: 'slate' }
}

function minutesBetween(start, end) {
  const a = new Date(start)
  const b = new Date(end)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000))
}

function waitMinutes(ticket = {}) {
  const explicit = Number(ticket.wait_minutes || ticket.waiting_minutes)
  if (Number.isFinite(explicit)) return explicit
  return minutesBetween(ticket.checkin_time || ticket.check_in_time || ticket.created_at, ticket.called_time || ticket.called_at || ticket.start_time || ticket.started_at)
}

function totalMinutes(ticket = {}) {
  const explicit = Number(ticket.total_minutes || ticket.duration_minutes)
  if (Number.isFinite(explicit)) return explicit
  return minutesBetween(ticket.checkin_time || ticket.check_in_time || ticket.created_at, ticket.completed_time || ticket.completed_at || ticket.cancelled_at || ticket.updated_at)
}

function minuteText(value) {
  return Number.isFinite(value) ? `${value} phút` : '-'
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
    ...safeArray(board.waiting),
    ...safeArray(board.called),
    ...safeArray(board.in_service),
    ...safeArray(board.serving),
    ...safeArray(board.completed),
    ...safeArray(board.skipped),
    ...safeArray(board.cancelled),
  ]
}

function lastTime(ticket = {}) {
  return ticket.completed_time || ticket.completed_at || ticket.cancelled_at || ticket.updated_at || ticket.called_time || ticket.called_at || ticket.checkin_time || ticket.created_at || ''
}

function eventLabel(event = {}, ticket = {}) {
  const type = String(event.type || event.event_type || event.action || event.status || statusInfo(ticket).key).toLowerCase()
  if (type.includes('complete')) return 'Hoàn tất khám'
  if (type.includes('transfer')) return `Chuyển từ ${event.from_room || ticket.from_room || roomName(ticket)}`
  if (type.includes('skip')) return 'Bỏ qua lượt khám'
  if (type.includes('cancel')) return 'Đã hủy lượt khám'
  if (type.includes('call')) return 'Gọi bệnh nhân'
  if (type.includes('start')) return 'Bắt đầu khám'
  return event.description || event.note || statusInfo(ticket).label
}

function timelineTime(event = {}, ticket = {}) {
  return event.created_at || event.time || event.timestamp || lastTime(ticket)
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
  const emptyBoard = { waiting: [], called: [], in_service: [], completed: [], skipped: [], cancelled: [] }
  const [all, board, summary] = await Promise.all([
    settledValue(doctorApi.queue.listAll({ doctor_id: doctorId, limit: 300 }), emptyBoard),
    doctorId ? settledValue(doctorApi.queue.getBoard(doctorId), emptyBoard) : Promise.resolve(emptyBoard),
    settledValue(doctorApi.queue.getTodaySummary({ doctor_id: doctorId }), null),
  ])
  const tickets = (flattenBoard(all).length ? flattenBoard(all) : flattenBoard(board))
    .sort((a, b) => new Date(lastTime(b)).getTime() - new Date(lastTime(a)).getTime())
  const timelineTickets = tickets.slice(0, 5)
  const timelineSets = await Promise.all(timelineTickets.map((ticket) =>
    settledValue(doctorApi.queue.getTimeline(ticketIdOf(ticket)), []).then((events) => ({ ticket, events })),
  ))
  const events = timelineSets
    .flatMap(({ ticket, events: items }) => {
      const source = safeArray(items)
      if (!source.length) return [fallbackEvent(ticket)]
      return source.slice(-2).map((event) => ({
        ticket,
        key: statusInfo({ status: event.status || event.action || event.type || ticket.status }).key,
        time: timelineTime(event, ticket),
        label: eventLabel(event, ticket),
      }))
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5)

  return { tickets, summary, events }
}

function HistoryKpi({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-history-kpi">
      <span className={`doctor-history-kpi__icon is-${tone}`}>
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

function PatientAvatar({ ticket }) {
  const avatar = patientAvatar(ticket)
  if (avatar) return <img className="doctor-history-avatar" src={avatar} alt={patientName(ticket)} />
  return <span className="doctor-history-avatar">{initials(ticket)}</span>
}

function Donut({ total, completed, skipped, transferred, cancelled }) {
  const c = percent(completed, total)
  const s = percent(skipped, total)
  const t = percent(transferred, total)
  const x = percent(cancelled, total)
  const background = total
    ? `conic-gradient(${HISTORY_COLORS.completed} 0 ${c}%, ${HISTORY_COLORS.skipped} ${c}% ${c + s}%, ${HISTORY_COLORS.transferred} ${c + s}% ${c + s + t}%, ${HISTORY_COLORS.cancelled} ${c + s + t}% ${c + s + t + x}%, #e8eef8 ${c + s + t + x}% 100%)`
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

export function DoctorQueueHistoryScreen({ user }) {
  const toast = useToast()
  const [state, setState] = useState({ loading: true, error: '', data: { tickets: [], summary: null, events: [] } })
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [room, setRoom] = useState('all')
  const [doctor, setDoctor] = useState('all')

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadQueueHistory(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải lịch sử hàng đợi.'),
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
            error: getApiErrorMessage(error, 'Không thể tải lịch sử hàng đợi.'),
            data: { tickets: [], summary: null, events: [] },
          })
        }
      })
    return () => {
      active = false
    }
  }, [user])

  const dashboard = useMemo(() => {
    const tickets = safeArray(state.data.tickets)
    const summary = state.data.summary || {}
    const completedTickets = tickets.filter((ticket) => statusInfo(ticket).key === 'completed')
    const skippedTickets = tickets.filter((ticket) => statusInfo(ticket).key === 'skipped')
    const transferredTickets = tickets.filter((ticket) => statusInfo(ticket).key === 'transferred')
    const cancelledTickets = tickets.filter((ticket) => statusInfo(ticket).key === 'cancelled')
    const completed = numberFrom(summary, ['completed_count', 'completed'], completedTickets.length)
    const skipped = numberFrom(summary, ['skipped_count', 'skip_count', 'skipped'], skippedTickets.length)
    const transferred = numberFrom(summary, ['transferred_count', 'transfer_count', 'transferred'], transferredTickets.length)
    const cancelled = numberFrom(summary, ['cancelled_count', 'canceled_count', 'cancelled'], cancelledTickets.length)
    const total = numberFrom(summary, ['total_tickets', 'total_patients', 'total', 'processed_count'], completed + skipped + transferred + cancelled || tickets.length)
    const avgWait = numberFrom(summary, ['average_wait_minutes', 'avg_wait_minutes'], Math.round(tickets.map(waitMinutes).filter(Number.isFinite).reduce((sum, value, _, arr) => sum + value / arr.length, 0)) || 0)
    const avgTotal = numberFrom(summary, ['average_total_minutes', 'avg_total_minutes'], Math.round(tickets.map(totalMinutes).filter(Number.isFinite).reduce((sum, value, _, arr) => sum + value / arr.length, 0)) || 0)
    return { tickets, total, completed, skipped, transferred, cancelled, avgWait, avgTotal }
  }, [state.data])

  const rooms = useMemo(() => Array.from(new Set(dashboard.tickets.map(roomName))).filter(Boolean), [dashboard.tickets])
  const doctors = useMemo(() => Array.from(new Set(dashboard.tickets.map((ticket) => doctorName(ticket, user)))).filter(Boolean), [dashboard.tickets, user])
  const filteredTickets = useMemo(() => {
    const text = query.trim().toLowerCase()
    return dashboard.tickets.filter((ticket, index) => {
      const haystack = [patientName(ticket), ticketNumber(ticket, index), patientMeta(ticket), roomName(ticket), doctorName(ticket, user)].join(' ').toLowerCase()
      return (!text || haystack.includes(text))
        && (status === 'all' || statusInfo(ticket).key === status)
        && (room === 'all' || roomName(ticket) === room)
        && (doctor === 'all' || doctorName(ticket, user) === doctor)
    })
  }, [dashboard.tickets, query, status, room, doctor, user])

  const firstPage = filteredTickets.slice(0, 10)

  async function viewDetail(ticket) {
    const ticketId = ticketIdOf(ticket)
    if (!ticketId) {
      toast.error('Không tìm thấy mã ticket hàng đợi.')
      return
    }
    try {
      await Promise.all([doctorApi.queue.getDetail(ticketId), doctorApi.queue.getTimeline(ticketId)])
      toast.success('Đã tải chi tiết và timeline ticket.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết ticket.'))
    }
  }

  return (
    <div className="doctor-history-page">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

      <section className="doctor-history-kpis" aria-label="Tổng quan lịch sử hàng đợi">
        <HistoryKpi icon="queue" tone="blue" label="Tổng lượt xử lý" value={dashboard.total} hint="100% tổng lượt hàng đợi" />
        <HistoryKpi icon="check_circle" tone="green" label="Đã hoàn tất" value={dashboard.completed} hint={`${percent(dashboard.completed, dashboard.total)}% tổng lượt xử lý`} />
        <HistoryKpi icon="chevron_right" tone="orange" label="Bỏ qua" value={dashboard.skipped} hint={`${percent(dashboard.skipped, dashboard.total)}% tổng lượt xử lý`} />
        <HistoryKpi icon="clock" tone="purple" label="Thời gian chờ TB" value={`${dashboard.avgWait} phút`} hint="So với dữ liệu hiện tại" />
      </section>

      <section className="doctor-history-layout">
        <main className="doctor-history-main">
          <article className="doctor-history-panel">
            <h2>Lịch sử hàng đợi</h2>
            <div className="doctor-history-filters">
              <label><DoctorIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm bệnh nhân, số thứ tự..." /></label>
              <label><DoctorIcon name="calendar" /><input type="text" readOnly value="13/05/2025 - 20/05/2025" /></label>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="completed">Hoàn tất</option>
                <option value="skipped">Bỏ qua</option>
                <option value="transferred">Chuyển</option>
                <option value="cancelled">Hủy</option>
              </select>
              <select value={room} onChange={(event) => setRoom(event.target.value)}>
                <option value="all">Tất cả phòng khám</option>
                {rooms.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={doctor} onChange={(event) => setDoctor(event.target.value)}>
                <option value="all">Tất cả bác sĩ</option>
                {doctors.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
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
                  const statusMeta = statusInfo(ticket)
                  return (
                    <div className="doctor-history-row" key={ticketIdOf(ticket) || `history-${index}`}>
                      <span>{dateText(dateOf(ticket))}</span>
                      <strong>{ticketNumber(ticket, index)}</strong>
                      <div className="doctor-history-patient">
                        <PatientAvatar ticket={ticket} />
                        <span><b>{patientName(ticket)}</b><small>{patientMeta(ticket)}</small></span>
                      </div>
                      <i className={`is-${statusMeta.tone}`}>{statusMeta.label}</i>
                      <span>{timeFrom(ticket.called_time || ticket.called_at)}</span>
                      <span>{timeFrom(ticket.start_time || ticket.started_at || ticket.service_started_at)}</span>
                      <span>{timeFrom(ticket.completed_time || ticket.completed_at)}</span>
                      <span>{minuteText(waitMinutes(ticket))}</span>
                      <span>{minuteText(totalMinutes(ticket))}</span>
                      <button type="button" onClick={() => viewDetail(ticket)}><DoctorIcon name="search" /> Xem chi tiết</button>
                    </div>
                  )
                }) : (
                  <div className="doctor-appointment-empty is-small">Chưa có lịch sử hàng đợi phù hợp.</div>
                )}
              </div>
            </div>

            <footer className="doctor-history-footer">
              <span>Hiển thị <b>{firstPage.length}</b> dòng</span>
              <div><button type="button">‹</button><button type="button" className="is-active">1</button><button type="button">2</button><button type="button">3</button><button type="button">4</button><button type="button">5</button><button type="button">›</button></div>
              <span>Hiển thị 1 đến {firstPage.length} của {filteredTickets.length} lượt</span>
            </footer>
          </article>
        </main>

        <aside className="doctor-history-side">
          <article className="doctor-history-panel doctor-history-overview">
            <h2>Tổng quan lịch sử</h2>
            <div className="doctor-history-overview__top">
              <Donut total={dashboard.total} completed={dashboard.completed} skipped={dashboard.skipped} transferred={dashboard.transferred} cancelled={dashboard.cancelled} />
              <dl>
                <div><dt><i className="is-completed" /> Hoàn tất</dt><dd>{dashboard.completed} ({percent(dashboard.completed, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-skipped" /> Bỏ qua</dt><dd>{dashboard.skipped} ({percent(dashboard.skipped, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-transferred" /> Chuyển</dt><dd>{dashboard.transferred} ({percent(dashboard.transferred, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-cancelled" /> Hủy</dt><dd>{dashboard.cancelled} ({percent(dashboard.cancelled, dashboard.total)}%)</dd></div>
              </dl>
            </div>
            <div className="doctor-history-metrics">
              <p><DoctorIcon name="clock" /><span>Thời gian chờ TB</span><strong>{dashboard.avgWait} phút</strong></p>
              <p><DoctorIcon name="clock" /><span>Tổng thời gian TB</span><strong>{dashboard.avgTotal} phút</strong></p>
            </div>
          </article>

          <article className="doctor-history-panel doctor-history-events">
            <h2>Mốc hoạt động gần đây</h2>
            <div>
              {safeArray(state.data.events).map((event, index) => (
                <article key={`${ticketIdOf(event.ticket)}-${index}`}>
                  <i className={`is-${event.key}`} />
                  <time>{timeFrom(event.time)}</time>
                  <span>
                    <b>{patientName(event.ticket)} ({ticketNumber(event.ticket, index)})</b>
                    <small>{event.label}</small>
                  </span>
                </article>
              ))}
              {!state.data.events.length ? <p className="doctor-history-empty-note">Chưa có mốc hoạt động gần đây.</p> : null}
            </div>
            <button type="button">Xem tất cả mốc hoạt động <DoctorIcon name="chevron_right" /></button>
          </article>

          <article className="doctor-history-panel doctor-history-quick">
            <h2>Thao tác nhanh</h2>
            <div>
              <button type="button"><DoctorIcon name="arrow_left" /> Xuất báo cáo</button>
              <button type="button"><DoctorIcon name="settings" /> Lọc nâng cao</button>
              <button type="button"><DoctorIcon name="patients" /> Xem bảng hàng đợi</button>
              <button type="button" onClick={reload}><DoctorIcon name="refresh" /> Làm mới</button>
            </div>
          </article>
        </aside>
      </section>
    </div>
  )
}
