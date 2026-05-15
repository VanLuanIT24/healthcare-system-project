import { useEffect, useMemo, useState } from 'react'
import { doctorApi, getDoctorId } from './doctorApi'
import { formatTime, safeArray } from './doctorData'
import { DoctorIcon } from './DoctorShell'
import { useToast } from './toast/ToastProvider'
import { getApiErrorMessage } from '../utils/api'

function ticketIdOf(ticket = {}) {
  return ticket.queue_ticket_id || ticket.ticket_id || ticket.id || ticket._id || ''
}

function ticketNumber(ticket = {}, index = 0) {
  const value = ticket.queue_number || ticket.ticket_no || ticket.number || ''
  if (value) return String(value).padStart(3, '0')
  return String(index + 1).padStart(3, '0')
}

function patientName(ticket = {}) {
  const patient = ticket.patient || {}
  return ticket.patient_name || patient.full_name || patient.name || 'Bệnh nhân'
}

function patientCode(ticket = {}) {
  const patient = ticket.patient || {}
  return ticket.patient_code || patient.patient_code || ticket.patient_id || ''
}

function patientMeta(ticket = {}) {
  const patient = ticket.patient || {}
  const gender = ticket.patient_gender || patient.gender
  const age = ticket.patient_age || patient.age
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
  return ticket.room_name || ticket.clinic_room || ticket.room || ticket.location || ticket.department_name || 'PK'
}

function doctorName(ticket = {}, user = {}) {
  const doctor = ticket.doctor || {}
  return ticket.doctor_name || doctor.full_name || doctor.name || user.full_name || user.name || 'Bác sĩ'
}

function arrivedAt(ticket = {}) {
  return ticket.checkin_time || ticket.check_in_time || ticket.created_at || ticket.arrived_at || ''
}

function statusInfo(ticket = {}) {
  const raw = String(ticket.status || '').toLowerCase()
  if (['called', 'recalled'].includes(raw)) return { key: 'called', label: 'Đang gọi', tone: 'blue' }
  if (['in_service', 'serving', 'examining', 'in_progress'].includes(raw)) return { key: 'in_service', label: 'Đang khám', tone: 'green' }
  if (['completed', 'done', 'finished'].includes(raw)) return { key: 'completed', label: 'Hoàn tất', tone: 'green' }
  if (['skipped', 'skip'].includes(raw)) return { key: 'skipped', label: 'Bỏ qua', tone: 'slate' }
  if (['cancelled', 'canceled'].includes(raw)) return { key: 'cancelled', label: 'Đã hủy', tone: 'red' }
  return { key: 'waiting', label: 'Đang chờ', tone: 'orange' }
}

function waitMinutes(ticket = {}) {
  const start = new Date(arrivedAt(ticket))
  if (Number.isNaN(start.getTime())) return null
  return Math.max(0, Math.round((Date.now() - start.getTime()) / 60000))
}

function waitText(ticket = {}) {
  const minutes = waitMinutes(ticket)
  if (minutes == null) return '-'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}:${String(rest).padStart(2, '0')}` : `00:${String(rest).padStart(2, '0')}`
}

function averageWait(tickets = []) {
  const values = tickets.map(waitMinutes).filter((value) => Number.isFinite(value))
  if (!values.length) return '00:00'
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  return `00:${String(average).padStart(2, '0')}`
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
    ...safeArray(board.completed),
    ...safeArray(board.skipped),
  ]
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

async function loadQueueBoard(user) {
  const doctorId = getDoctorId(user)
  const [board, groupedAll, summary] = await Promise.all([
    doctorId ? settledValue(doctorApi.queue.getBoard(doctorId), { waiting: [], called: [], in_service: [], completed: [] }) : Promise.resolve({ waiting: [], called: [], in_service: [], completed: [] }),
    settledValue(doctorApi.queue.listAll({ doctor_id: doctorId, limit: 200 }), { waiting: [], called: [], in_service: [], completed: [] }),
    settledValue(doctorApi.queue.getTodaySummary({ doctor_id: doctorId }), null),
  ])

  const selectedBoard = flattenBoard(board).length ? board : groupedAll
  const tickets = flattenBoard(selectedBoard)
    .sort((a, b) => {
      const orderA = Number(a.queue_number || a.ticket_no || 9999)
      const orderB = Number(b.queue_number || b.ticket_no || 9999)
      return orderA - orderB
    })

  return { board: selectedBoard, tickets, summary }
}

function QueueKpi({ icon, tone, label, value, hint }) {
  return (
    <article className="doctor-queue-kpi">
      <span className={`doctor-queue-kpi__icon is-${tone}`}>
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

function QueueDonut({ total }) {
  return (
    <div className="doctor-queue-donut">
      <div>
        <strong>{total}</strong>
        <span>Tổng bệnh nhân</span>
      </div>
    </div>
  )
}

export function DoctorQueueBoardScreen({ user }) {
  const toast = useToast()
  const [state, setState] = useState({ loading: true, error: '', data: { board: {}, tickets: [], summary: null } })
  const [actingId, setActingId] = useState('')

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadQueueBoard(user)
      .then((data) => setState({ loading: false, error: '', data }))
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải bảng hàng đợi.'),
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
            error: getApiErrorMessage(error, 'Không thể tải bảng hàng đợi.'),
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
    const summary = state.data.summary || {}
    const waiting = numberFrom(summary, ['waiting_count', 'waiting'], tickets.filter((item) => statusInfo(item).key === 'waiting').length)
    const called = numberFrom(summary, ['called_count', 'called'], tickets.filter((item) => statusInfo(item).key === 'called').length)
    const inService = numberFrom(summary, ['in_service_count', 'serving_count', 'in_service'], tickets.filter((item) => statusInfo(item).key === 'in_service').length)
    const completed = numberFrom(summary, ['completed_count', 'completed'], tickets.filter((item) => statusInfo(item).key === 'completed').length)
    const skipped = numberFrom(summary, ['skipped_count', 'skip_count', 'skipped'], tickets.filter((item) => statusInfo(item).key === 'skipped').length)
    const total = numberFrom(summary, ['total_tickets', 'total_patients', 'total'], waiting + called + inService + completed + skipped || tickets.length)
    const nextTicket = tickets.find((item) => statusInfo(item).key === 'waiting') || tickets.find((item) => statusInfo(item).key === 'called') || null
    const first = tickets[0] || null

    return {
      tickets,
      waiting,
      called,
      inService,
      completed,
      skipped,
      total,
      waitingRate: percent(waiting, total),
      calledRate: percent(called, total),
      inServiceRate: percent(inService, total),
      completedRate: percent(completed, total),
      skippedRate: percent(skipped, total),
      nextTicket,
      first,
      averageWait: summary.average_wait_time || summary.avg_wait_time || averageWait(tickets),
    }
  }, [state.data])

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
      if (type === 'skip') await doctorApi.queue.skip(ticketId)
      if (type === 'start') await doctorApi.queue.startService(ticketId)
      if (type === 'complete') await doctorApi.queue.complete(ticketId)
      if (type === 'cancel') await doctorApi.queue.cancel(ticketId)
      toast.success('Đã cập nhật hàng đợi.')
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác hàng đợi.'))
    } finally {
      setActingId('')
    }
  }

  return (
    <div className="doctor-queue-board-page">
      {state.error ? <div className="doctor-today-error">{state.error}</div> : null}

      <section className="doctor-queue-kpis" aria-label="Tổng quan hàng đợi">
        <QueueKpi icon="clock" tone="orange" label="Đang chờ" value={dashboard.waiting} hint={`${dashboard.waitingRate}% tổng số`} />
        <QueueKpi icon="message" tone="blue" label="Đang gọi" value={dashboard.called} hint={`${dashboard.calledRate}% tổng số`} />
        <QueueKpi icon="doctor" tone="green" label="Đang khám" value={dashboard.inService} hint={`${dashboard.inServiceRate}% tổng số`} />
        <QueueKpi icon="check_circle" tone="purple" label="Đã hoàn tất" value={dashboard.completed} hint={`${dashboard.completedRate}% tổng số`} />
      </section>

      <section className="doctor-queue-layout">
        <article className="doctor-queue-panel doctor-queue-list">
          <header>
            <h2>Danh sách hàng đợi hiện tại</h2>
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
            ) : dashboard.tickets.length ? dashboard.tickets.slice(0, 10).map((ticket, index) => {
              const id = ticketIdOf(ticket) || `queue-${index}`
              const status = statusInfo(ticket)
              const isDone = ['completed', 'cancelled', 'skipped'].includes(status.key)
              const mainAction = status.key === 'called' ? 'recall' : status.key === 'in_service' ? 'complete' : 'call'
              const mainLabel = status.key === 'called' ? 'Gọi lại' : status.key === 'in_service' ? 'Hoàn tất' : 'Gọi'
              const secondaryAction = status.key === 'called' ? 'start' : status.key === 'in_service' ? 'cancel' : 'skip'
              const secondaryLabel = status.key === 'called' ? 'Bắt đầu khám' : status.key === 'in_service' ? 'Hủy' : 'Bỏ qua'
              return (
                <div className="doctor-queue-row" key={id}>
                  <strong>{ticketNumber(ticket, index)}</strong>
                  <span className="doctor-queue-patient">
                    <em>{initials(ticket)}</em>
                    <b>{patientName(ticket)}</b>
                    <small>{patientMeta(ticket)}</small>
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
                    {isDone ? (
                      <button type="button" disabled>{status.label}</button>
                    ) : (
                      <button type="button" onClick={() => runAction(secondaryAction, ticket)} disabled={Boolean(actingId)}>
                        <DoctorIcon name={secondaryAction === 'start' ? 'doctor' : 'search'} />
                        {secondaryLabel}
                      </button>
                    )}
                    <button type="button" className="is-more" aria-label="Thêm thao tác"><DoctorIcon name="chevron_down" /></button>
                  </span>
                </div>
              )
            }) : (
              <div className="doctor-appointment-empty">Chưa có bệnh nhân trong hàng đợi.</div>
            )}
          </div>

          <footer className="doctor-queue-footer">
            <button type="button">Hiển thị 10 dòng <DoctorIcon name="chevron_down" /></button>
            <div>
              <button type="button" disabled><DoctorIcon name="chevron_right" /></button>
              <button type="button" className="is-active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">4</button>
              <button type="button">5</button>
              <button type="button"><DoctorIcon name="chevron_right" /></button>
            </div>
            <span>Hiển thị {dashboard.tickets.length ? `1 đến ${Math.min(10, dashboard.tickets.length)}` : '0'} của {dashboard.total} bệnh nhân</span>
          </footer>
        </article>

        <aside className="doctor-queue-side">
          <article className="doctor-queue-panel doctor-queue-overview">
            <header>
              <h2>Tổng quan hàng đợi</h2>
            </header>
            <div className="doctor-queue-overview__top">
              <QueueDonut total={dashboard.total} />
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
              <div><DoctorIcon name="queue" /><span>Quầy / Phòng hiện tại</span><strong>{dashboard.first ? roomName(dashboard.first) : '--'}</strong></div>
              <div><DoctorIcon name="patients" /><span>Bác sĩ phụ trách</span><strong>{doctorName(dashboard.first || {}, user)}</strong></div>
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
              <button type="button" onClick={() => toast.info('Chưa có endpoint xuất danh sách trong nhóm API hàng đợi được cung cấp.')}><DoctorIcon name="note" /> Xuất danh sách</button>
              <button type="button" onClick={() => toast.info('Lịch sử dùng /queue/:ticketId/timeline khi chọn một ticket cụ thể.')}><DoctorIcon name="clock" /> Xem lịch sử</button>
            </div>
          </article>

          <article className="doctor-queue-tip">
            <DoctorIcon name="warning" />
            <p>Mẹo: Nhấn “Gọi tiếp theo” để gọi bệnh nhân đầu tiên trong danh sách chờ.</p>
          </article>
        </aside>
      </section>
    </div>
  )
}
