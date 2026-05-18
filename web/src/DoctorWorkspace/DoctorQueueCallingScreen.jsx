import { useEffect, useMemo, useState } from 'react'
import { doctorApi, getDoctorId } from './doctorApi'
import { safeArray } from './doctorData'
import { DoctorIcon } from './DoctorShell'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const ROOM_COLORS = ['#1264f2', '#35c875', '#ff9f1a', '#7c4dff']

function ticketIdOf(ticket = {}) {
  return ticket.queue_ticket_id || ticket.ticket_id || ticket.id || ticket._id || ''
}

function ticketNumber(ticket = {}, index = 0) {
  const value = ticket.queue_number || ticket.ticket_no || ticket.number || ticket.sequence_number || ''
  if (value) return String(value).padStart(2, '0')
  return String(index + 1).padStart(2, '0')
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

function patientCode(ticket = {}) {
  const patient = getPatient(ticket)
  return ticket.patient_code || patient.patient_code || ticket.patient_id || patient.id || ''
}

function patientMeta(ticket = {}) {
  const patient = getPatient(ticket)
  const gender = ticket.patient_gender || patient.gender || patient.sex
  const age = ticket.patient_age || patient.age
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
  return ticket.room_name || ticket.clinic_room || ticket.room || ticket.location || ticket.department_name || 'PK'
}

function doctorName(ticket = {}, user = {}) {
  const doctor = ticket.doctor || {}
  return ticket.doctor_name || doctor.full_name || doctor.name || user.full_name || user.name || 'Bác sĩ'
}

function reasonText(ticket = {}) {
  return ticket.reason || ticket.reason_for_visit || ticket.note || ticket.queue_type || ticket.service_name || 'Theo thứ tự hàng đợi'
}

function arrivedAt(ticket = {}) {
  return ticket.called_at || ticket.checkin_time || ticket.check_in_time || ticket.created_at || ticket.arrived_at || ''
}

function statusInfo(ticket = {}) {
  const raw = String(ticket.status || '').toLowerCase()
  if (['called', 'recalled', 'calling'].includes(raw)) return { key: 'called', label: 'Đang gọi', tone: 'blue' }
  if (['in_service', 'serving', 'examining', 'in_progress'].includes(raw)) return { key: 'in_service', label: 'Đang khám', tone: 'green' }
  if (['completed', 'done', 'finished'].includes(raw)) return { key: 'completed', label: 'Hoàn tất', tone: 'green' }
  if (['skipped', 'skip'].includes(raw)) return { key: 'skipped', label: 'Bỏ qua', tone: 'slate' }
  if (['cancelled', 'canceled'].includes(raw)) return { key: 'cancelled', label: 'Đã hủy', tone: 'red' }
  return { key: 'waiting', label: 'Đang chờ', tone: 'orange' }
}

function waitMinutes(ticket = {}) {
  const explicit = Number(ticket.wait_minutes || ticket.waiting_minutes || ticket.estimated_wait_minutes)
  if (Number.isFinite(explicit)) return explicit
  const start = new Date(arrivedAt(ticket))
  if (Number.isNaN(start.getTime())) return null
  return Math.max(0, Math.round((Date.now() - start.getTime()) / 60000))
}

function waitText(ticket = {}) {
  const minutes = waitMinutes(ticket)
  if (minutes == null) return '--'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}:${String(rest).padStart(2, '0')}` : `00:${String(rest).padStart(2, '0')}`
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

function donutBackground(segments = []) {
  const total = segments.reduce((sum, item) => sum + item.count, 0)
  if (!total) return 'conic-gradient(#e8eef8 0 100%)'
  let cursor = 0
  const stops = segments.slice(0, 4).map((item, index) => {
    const start = cursor
    cursor += (item.count / total) * 100
    return `${ROOM_COLORS[index]} ${start}% ${cursor}%`
  })
  if (cursor < 100) stops.push(`#e8eef8 ${cursor}% 100%`)
  return `conic-gradient(${stops.join(', ')})`
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

async function loadQueueCalling(user) {
  const doctorId = getDoctorId(user)
  const emptyBoard = { waiting: [], called: [], in_service: [], serving: [], completed: [], skipped: [] }
  const [board, groupedAll, summary] = await Promise.all([
    doctorId ? settledValue(doctorApi.queue.getBoard(doctorId), emptyBoard) : Promise.resolve(emptyBoard),
    settledValue(doctorApi.queue.listAll({ doctor_id: doctorId, limit: 200 }), emptyBoard),
    settledValue(doctorApi.queue.getTodaySummary({ doctor_id: doctorId }), null),
  ])

  const selectedBoard = flattenBoard(board).length ? board : groupedAll
  const tickets = flattenBoard(selectedBoard).sort((a, b) => {
    const orderA = Number(a.queue_number || a.ticket_no || a.sequence_number || 9999)
    const orderB = Number(b.queue_number || b.ticket_no || b.sequence_number || 9999)
    if (orderA !== orderB) return orderA - orderB
    return new Date(arrivedAt(a)).getTime() - new Date(arrivedAt(b)).getTime()
  })

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

function CallingDonut({ total, rooms }) {
  return (
    <div className="doctor-calling-donut" style={{ background: donutBackground(rooms) }}>
      <div>
        <strong>{total}</strong>
        <span>Tổng chờ</span>
      </div>
    </div>
  )
}

export function DoctorQueueCallingScreen({ user }) {
  const toast = useToast()
  const [state, setState] = useState({ loading: true, error: '', data: { board: {}, tickets: [], summary: null } })
  const [actingId, setActingId] = useState('')

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadQueueCalling(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải dữ liệu gọi tiếp theo.'),
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
            error: getApiErrorMessage(error, 'Không thể tải dữ liệu gọi tiếp theo.'),
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
    const waitingTickets = tickets.filter((item) => statusInfo(item).key === 'waiting')
    const calledTickets = tickets.filter((item) => statusInfo(item).key === 'called')
    const servingTickets = tickets.filter((item) => statusInfo(item).key === 'in_service')
    const completedTickets = tickets.filter((item) => statusInfo(item).key === 'completed')
    const summary = state.data.summary || {}
    const waiting = numberFrom(summary, ['waiting_count', 'waiting', 'pending_count'], waitingTickets.length)
    const calledToday = numberFrom(summary, ['called_count', 'called', 'called_today'], calledTickets.length + servingTickets.length + completedTickets.length)
    const inService = numberFrom(summary, ['in_service_count', 'serving_count', 'in_service'], servingTickets.length)
    const nextTicket = calledTickets[0] || waitingTickets[0] || null
    const rooms = groupedRooms(waitingTickets)
    const totalWaiting = waiting || waitingTickets.length
    const avgWait = numberFrom(summary, ['average_wait_minutes', 'avg_wait_minutes', 'average_wait'], averageWait(waitingTickets))

    return {
      tickets,
      waitingTickets,
      calledTickets,
      servingTickets,
      completedTickets,
      waiting,
      calledToday,
      inService,
      nextTicket,
      rooms,
      totalWaiting,
      avgWait,
      currentRoom: nextTicket ? roomName(nextTicket) : rooms[0]?.room || '--',
      currentDoctor: doctorName(nextTicket || servingTickets[0] || {}, user),
    }
  }, [state.data, user])

  async function runAction(type, ticket = null) {
    const doctorId = getDoctorId(user)
    const ticketId = ticket ? ticketIdOf(ticket) : ''
    if (ticket && !ticketId) {
      toast.error('Không tìm thấy mã ticket hàng đợi.')
      return
    }
    if (type === 'transfer') {
      toast.warning('Cần chọn bác sĩ/phòng đích trước khi chuyển hàng đợi.')
      return
    }

    setActingId(`${type}:${ticketId || 'next'}`)
    try {
      if (type === 'callNext') await doctorApi.queue.callNext(doctorId)
      if (type === 'call') await doctorApi.queue.call(ticketId)
      if (type === 'recall') await doctorApi.queue.recall(ticketId)
      if (type === 'skip') await doctorApi.queue.skip(ticketId)
      if (type === 'start') await doctorApi.queue.startService(ticketId)
      toast.success('Đã cập nhật hàng đợi.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác hàng đợi.'))
    } finally {
      setActingId('')
    }
  }

  const nextTicket = dashboard.nextTicket
  const nextStatus = nextTicket ? statusInfo(nextTicket) : null

  return (
    <div className="doctor-calling-page">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

      <section className="doctor-calling-kpis" aria-label="Tổng quan gọi tiếp theo">
        <CallingKpi icon="patients" tone="blue" label="Bệnh nhân đang chờ" value={dashboard.waiting} hint="Chờ trong hàng đợi" />
        <CallingKpi icon="message" tone="green" label="Đã gọi" value={dashboard.calledToday} hint="Hôm nay" />
        <CallingKpi icon="doctor" tone="orange" label="Đang khám" value={dashboard.inService} hint="Đang phục vụ" />
        <CallingKpi icon="clock" tone="purple" label="Thời gian chờ TB" value={`${dashboard.avgWait} phút`} hint="Cập nhật theo thời gian thực" />
      </section>

      <section className="doctor-calling-layout">
        <main className="doctor-calling-main">
          <article className="doctor-calling-panel doctor-calling-next">
            <header>
              <h2>Bệnh nhân tiếp theo</h2>
              <span>Ưu tiên: {nextTicket?.priority_flag || nextTicket?.priority ? 'Cao' : 'Thường'}</span>
            </header>

            {state.loading ? (
              <div className="doctor-appointment-empty is-small">Đang tải bệnh nhân tiếp theo...</div>
            ) : nextTicket ? (
              <div className="doctor-calling-next__body">
                <div className="doctor-calling-stt">
                  <span>STT HÀNG ĐỢI</span>
                  <strong>{ticketNumber(nextTicket)}</strong>
                  <b>{roomName(nextTicket)}</b>
                </div>

                <PatientAvatar ticket={nextTicket} />

                <div className="doctor-calling-patient-info">
                  <h3>{patientName(nextTicket)}</h3>
                  <p><DoctorIcon name="calendar" /> {patientMeta(nextTicket) || 'Thông tin bệnh nhân'}</p>
                  <p>Lý do khám: {reasonText(nextTicket)}</p>
                  <div>
                    <span><DoctorIcon name="clock" /> Thời gian chờ <strong>{waitText(nextTicket)}</strong></span>
                    <span><DoctorIcon name="queue" /> Phòng khám <strong>{roomName(nextTicket)}</strong></span>
                  </div>
                </div>

                <div className="doctor-calling-action-grid">
                  <button type="button" className="is-primary" onClick={() => runAction(nextStatus?.key === 'called' ? 'recall' : 'callNext')} disabled={Boolean(actingId)}>
                    <DoctorIcon name="message" />
                    Gọi tiếp theo
                  </button>
                  <button type="button" onClick={() => runAction(nextStatus?.key === 'called' ? 'recall' : 'call', nextTicket)} disabled={Boolean(actingId)}>
                    <DoctorIcon name="message" />
                    Gọi lại
                  </button>
                  <button type="button" onClick={() => runAction('start', nextTicket)} disabled={Boolean(actingId)}>
                    <DoctorIcon name="doctor" />
                    Bắt đầu khám
                  </button>
                  <button type="button" onClick={() => runAction('skip', nextTicket)} disabled={Boolean(actingId)}>
                    <DoctorIcon name="chevron_right" />
                    Bỏ qua
                  </button>
                  <button type="button" onClick={() => runAction('transfer', nextTicket)} disabled={Boolean(actingId)}>
                    <DoctorIcon name="arrow_left" />
                    Chuyển hàng đợi
                  </button>
                </div>
              </div>
            ) : (
              <div className="doctor-appointment-empty is-small">Chưa có bệnh nhân đang chờ.</div>
            )}
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
              <button type="button" className="doctor-calling-link">Xem toàn bộ đang phục vụ <DoctorIcon name="chevron_right" /></button>
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
              <button type="button" className="doctor-calling-link">Xem đầy đủ danh sách chờ <DoctorIcon name="chevron_right" /></button>
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
              <CallingDonut total={dashboard.totalWaiting} rooms={dashboard.rooms} />
              <dl>
                {dashboard.rooms.slice(0, 4).map((room, index) => (
                  <div key={room.room}>
                    <dt><i className={`is-${index}`} /> {room.room}</dt>
                    <dd>{room.count}</dd>
                  </div>
                ))}
                {!dashboard.rooms.length ? <div><dt><i className="is-0" /> Chưa có phòng</dt><dd>0</dd></div> : null}
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
          </article>

          <article className="doctor-calling-panel doctor-calling-current">
            <h2>Thông tin hiện tại</h2>
            <div>
              <DoctorIcon name="home" />
              <span>Phòng khám hiện tại</span>
              <strong>{dashboard.currentRoom}</strong>
            </div>
            <div>
              <DoctorIcon name="patients" />
              <span>Bác sĩ phụ trách</span>
              <strong>{dashboard.currentDoctor}</strong>
            </div>
          </article>

          <article className="doctor-calling-panel doctor-calling-quick">
            <h2>Thao tác nhanh</h2>
            <div>
              <button type="button" onClick={reload} disabled={state.loading}><DoctorIcon name="refresh" /> Làm mới trạng thái</button>
              <button type="button" onClick={() => toast.info('Mở mục Bảng hàng đợi trong menu bên trái để xem toàn bộ ticket.')}><DoctorIcon name="calendar" /> Mở bảng hàng đợi</button>
              <button type="button" onClick={() => toast.info('Lịch sử dùng /queue/:ticketId/timeline khi chọn ticket cụ thể.')}><DoctorIcon name="clock" /> Xem lịch sử</button>
              <button type="button" className="is-danger" onClick={() => toast.warning('Tạm dừng gọi cần endpoint cấu hình riêng, không có trong danh sách API được cung cấp.')}><DoctorIcon name="cancel" /> Tạm dừng gọi</button>
            </div>
          </article>
        </aside>
      </section>
    </div>
  )
}
