import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'

const CHECKIN_STATE_TABS = [
  { id: 'empty', label: 'Chưa có lịch hôm nay' },
  { id: 'ready', label: 'Có lịch, chưa check-in' },
  { id: 'queued', label: 'Đã check-in và có queue' },
]

function formatDateTime(value) {
  if (!value) return 'Chưa có thời gian'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian'

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatTime(value) {
  if (!value) return 'Chưa có giờ'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có giờ'

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function isSameLocalDay(value, target = new Date()) {
  if (!value) return false

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false

  return date.toDateString() === target.toDateString()
}

function isTerminalAppointmentStatus(status) {
  return ['cancelled', 'completed', 'no_show', 'rescheduled'].includes(String(status || '').toLowerCase())
}

function getAppointmentTime(appointment = {}) {
  return appointment.appointment_time || appointment.start_time || appointment.scheduled_at || appointment.created_at
}

function getAppointmentId(appointment = {}) {
  return appointment.appointment_id || appointment._id || appointment.id || ''
}

function getDoctorName(appointment = {}) {
  return (
    appointment.doctor_name ||
    appointment.doctor?.full_name ||
    appointment.doctor?.name ||
    appointment.doctor_id?.full_name ||
    'Bác sĩ đang cập nhật'
  )
}

function getDepartmentName(appointment = {}) {
  return (
    appointment.department_name ||
    appointment.department?.department_name ||
    appointment.department_id?.department_name ||
    appointment.specialty ||
    'Chuyên khoa đang cập nhật'
  )
}

function getRoomName(appointment = {}) {
  return (
    appointment.room_name ||
    appointment.room?.name ||
    appointment.room?.room_name ||
    appointment.location ||
    appointment.doctor_room ||
    'P.203'
  )
}

function mapTodayAppointment(appointment) {
  return {
    id: getAppointmentId(appointment),
    time: getAppointmentTime(appointment),
    department: getDepartmentName(appointment),
    doctor: getDoctorName(appointment),
    room: getRoomName(appointment),
    status: appointment.status || 'confirmed',
    queueTicket: appointment.queue_ticket || appointment.queueTicket || null,
  }
}

function mapUpcomingAppointment(appointment) {
  return {
    ...mapTodayAppointment(appointment),
    status: appointment.status || 'confirmed',
  }
}

function getQueueNo(currentQueue = null) {
  return (
    currentQueue?.ticket_no ||
    currentQueue?.display_number ||
    currentQueue?.queue_number ||
    currentQueue?.queue_no ||
    '--'
  )
}

function getCurrentServingNo(currentQueue = null) {
  return (
    currentQueue?.current_serving_no ||
    currentQueue?.currentServingNo ||
    currentQueue?.current_serving_number ||
    '--'
  )
}

function getQueueStatusLabel(status) {
  const map = {
    waiting: 'Đang chờ',
    called: 'Đã gọi số',
    in_service: 'Đang phục vụ',
    skipped: 'Tạm bỏ qua',
    recalled: 'Gọi lại',
    completed: 'Hoàn tất',
    no_show: 'Vắng mặt',
    cancelled: 'Đã hủy',
  }

  return map[status] || status || 'Đang chờ'
}

function getQueueProgressPercent(currentQueue = null) {
  const peopleAhead = Number(currentQueue?.people_ahead ?? 0)
  if (currentQueue?.status === 'in_service') return 100
  if (currentQueue?.status === 'called' || currentQueue?.status === 'recalled') return 82
  if (peopleAhead <= 0) return 68
  if (peopleAhead <= 2) return 52
  if (peopleAhead <= 5) return 34
  return 18
}

function buildQrCells(seed) {
  const text = String(seed || 'checkin')
  return Array.from({ length: 49 }, (_, index) => {
    const code = text.charCodeAt(index % text.length) || 0
    return (code + index * 7) % 5 < 2
  })
}

export default function PatientCheckinQueuePage({
  appointments = [],
  checkingInAppointmentId = '',
  currentQueue = null,
  error = '',
  feedback = null,
  loading = false,
  onCheckIn,
  onNavigate,
}) {
  const [showQr, setShowQr] = useState(false)
  const [notifyEnabled, setNotifyEnabled] = useState(false)
  const [localNotice, setLocalNotice] = useState(null)
  const [selectedStateId, setSelectedStateId] = useState('')
  const todayAppointment = useMemo(() => {
    return appointments
      .filter((appointment) => {
        const time = getAppointmentTime(appointment)
        return isSameLocalDay(time) && !isTerminalAppointmentStatus(appointment.status)
      })
      .sort((left, right) => new Date(getAppointmentTime(left)) - new Date(getAppointmentTime(right)))
      .map(mapTodayAppointment)[0] || null
  }, [appointments])
  const upcomingAppointments = useMemo(() => {
    const now = Date.now()
    return appointments
      .filter((appointment) => {
        const time = new Date(getAppointmentTime(appointment)).getTime()
        return !Number.isNaN(time) && time >= now && !isTerminalAppointmentStatus(appointment.status)
      })
      .sort((left, right) => new Date(getAppointmentTime(left)) - new Date(getAppointmentTime(right)))
      .map(mapUpcomingAppointment)
      .slice(0, 3)
  }, [appointments])
  const effectiveQueue = currentQueue || todayAppointment?.queueTicket || null
  const queueRoom = effectiveQueue?.room || {}
  const queueAppointment = effectiveQueue?.appointment || null
  const queueDoctor = effectiveQueue?.doctor || null
  const qrCells = useMemo(
    () => buildQrCells(todayAppointment?.id || effectiveQueue?.queue_ticket_id || getQueueNo(effectiveQueue)),
    [effectiveQueue, todayAppointment],
  )
  const hasQueue = Boolean(effectiveQueue?.queue_ticket_id || effectiveQueue?.ticket_no || effectiveQueue?.queue_number)
  const dataStateId = hasQueue ? 'queued' : todayAppointment ? 'ready' : 'empty'
  const stateId = selectedStateId || dataStateId
  const queueProgress = getQueueProgressPercent(effectiveQueue)
  const currentRoomName = queueRoom.name || todayAppointment?.room || effectiveQueue?.doctor_room_id || 'Phòng đang cập nhật'
  const currentDoctorName = queueDoctor?.name || getDoctorName(queueAppointment || todayAppointment || {})
  const dataStateLabel = CHECKIN_STATE_TABS.find((item) => item.id === dataStateId)?.label || ''

  useEffect(() => {
    setSelectedStateId('')
  }, [dataStateId])

  const handleStateTabClick = (nextStateId) => {
    setSelectedStateId(nextStateId)
    setLocalNotice(null)
  }

  const handleNotifyClick = () => {
    setNotifyEnabled((value) => !value)
    setLocalNotice({
      type: 'success',
      message: notifyEnabled
        ? 'Đã tắt nhắc khi gần tới lượt.'
        : 'Đã bật nhắc khi gần tới lượt trên màn hình portal.',
    })
  }

  return (
    <section className="patient-checkin-page">
      <header className="patient-feature-header">
        <div>
          <p className="patient-section-label">Chăm sóc</p>
          <h1>Check-in / Queue</h1>
          <p>Theo dõi check-in online, QR tại quầy, số thứ tự hiện tại và hướng dẫn đến phòng khám.</p>
        </div>
        <button className="patient-soft-button" type="button" onClick={() => onNavigate?.('book-appointment')}>
          <PatientIcon name="calendar_add_on" aria-hidden="true" />
          Đặt lịch khám
        </button>
      </header>

      {loading ? <div className="patient-care-state">Đang tải trạng thái check-in...</div> : null}
      {!loading && error ? <div className="patient-care-state is-error">{error}</div> : null}
      {feedback?.context === 'checkin' ? (
        <div className={`patient-care-state${feedback.type === 'error' ? ' is-error' : ''}`}>
          {feedback.message || feedback.text}
        </div>
      ) : null}
      {localNotice ? (
        <div className={`patient-care-state${localNotice.type === 'error' ? ' is-error' : ''}`}>
          {localNotice.message}
        </div>
      ) : null}

      <div className="patient-checkin-state-tabs" role="tablist" aria-label="Trạng thái check-in">
        {CHECKIN_STATE_TABS.map((item) => (
          <button
            key={item.id}
            className={stateId === item.id ? 'is-active' : ''}
            type="button"
            role="tab"
            aria-selected={stateId === item.id}
            onClick={() => handleStateTabClick(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {stateId === 'empty' ? (
        <div className="patient-checkin-empty-layout">
          <section className="patient-panel patient-checkin-empty-panel">
            <div className="patient-checkin-empty-icon" aria-hidden="true">
              <PatientIcon name="calendar_today" />
            </div>
            <div>
              <h2>{dataStateId === 'empty' ? 'Bạn chưa có lịch khám hôm nay.' : 'Không có dữ liệu ở trạng thái chưa có lịch.'}</h2>
              <p>
                {dataStateId === 'empty'
                  ? 'Các lịch đã xác nhận trong ngày sẽ xuất hiện ở đây để check-in online hoặc mở QR tại quầy.'
                  : `Hồ sơ hiện đang ở trạng thái "${dataStateLabel}".`}
              </p>
            </div>
            <div className="patient-checkin-empty-actions">
              <button className="patient-hero-button" type="button" onClick={() => onNavigate?.('book-appointment')}>
                <PatientIcon name="calendar_add_on" aria-hidden="true" />
                Đặt lịch khám
              </button>
              <button className="patient-outline-button" type="button" onClick={() => onNavigate?.('appointments')}>
                <PatientIcon name="event" aria-hidden="true" />
                Xem lịch hẹn
              </button>
            </div>
          </section>

          <section className="patient-panel patient-checkin-next-card">
            <div className="patient-checkin-card-head">
              <span className="patient-checkin-card-icon" aria-hidden="true">
                <PatientIcon name="schedule" />
              </span>
              <div>
                <p className="patient-section-label">Lịch sắp tới</p>
                <h2>{upcomingAppointments.length ? 'Các lịch gần nhất của bạn' : 'Chưa có lịch sắp tới'}</h2>
              </div>
            </div>
            {upcomingAppointments.length ? (
              <div className="patient-checkin-upcoming-list">
                {upcomingAppointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    className="patient-checkin-upcoming-row"
                    type="button"
                    onClick={() => onNavigate?.('appointments')}
                  >
                    <span>{formatDateTime(appointment.time)}</span>
                    <strong>{appointment.department}</strong>
                    <small>{appointment.doctor}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p>Đặt lịch mới để sử dụng check-in online, QR tại quầy và theo dõi số thứ tự.</p>
            )}
          </section>

          <section className="patient-panel patient-checkin-prep-card">
            <h2>Chuẩn bị nhanh</h2>
            <ul>
              <li>Mang giấy tờ tùy thân, thẻ bảo hiểm và hồ sơ cũ nếu có.</li>
              <li>Đến sớm 15 phút để hoàn tất tiếp nhận.</li>
              <li>Khi có lịch hôm nay, nút check-in và QR sẽ tự xuất hiện ở đây.</li>
            </ul>
          </section>
        </div>
      ) : null}

      {stateId === 'ready' && !todayAppointment ? (
        <div className="patient-checkin-empty-layout">
          <section className="patient-panel patient-checkin-empty-panel">
            <div className="patient-checkin-empty-icon" aria-hidden="true">
              <PatientIcon name="event" />
            </div>
            <div>
              <h2>Chưa có lịch hôm nay để check-in.</h2>
              <p>Khi có lịch khám còn hiệu lực trong ngày, nút check-in online và QR sẽ xuất hiện ở đây.</p>
            </div>
            <div className="patient-checkin-empty-actions">
              <button className="patient-hero-button" type="button" onClick={() => onNavigate?.('book-appointment')}>
                <PatientIcon name="calendar_add_on" aria-hidden="true" />
                Đặt lịch khám
              </button>
              <button className="patient-outline-button" type="button" onClick={() => onNavigate?.('appointments')}>
                <PatientIcon name="event" aria-hidden="true" />
                Xem lịch hẹn
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {stateId === 'ready' && todayAppointment ? (
        <div className="patient-checkin-grid">
          <section className="patient-panel patient-checkin-queue-card">
            <div className="patient-checkin-card-head">
              <span className="patient-checkin-card-icon" aria-hidden="true">
                <PatientIcon name="event" />
              </span>
              <div>
                <p className="patient-section-label">Lịch hôm nay</p>
                <h2>Bạn có lịch khám lúc {formatTime(todayAppointment.time)}</h2>
              </div>
            </div>

            <div className="patient-checkin-meta-grid">
              <div>
                <span>Chuyên khoa</span>
                <strong>{todayAppointment.department}</strong>
              </div>
              <div>
                <span>Bác sĩ</span>
                <strong>{todayAppointment.doctor}</strong>
              </div>
              <div>
                <span>Phòng dự kiến</span>
                <strong>{todayAppointment.room}</strong>
              </div>
              <div>
                <span>Thời gian</span>
                <strong>{formatDateTime(todayAppointment.time)}</strong>
              </div>
            </div>

            <div className="patient-checkin-actions">
              <button
                className="patient-hero-button"
                type="button"
                disabled={checkingInAppointmentId === todayAppointment.id}
                onClick={() => onCheckIn?.(todayAppointment.id)}
              >
                <PatientIcon name="check_circle" aria-hidden="true" />
                {checkingInAppointmentId === todayAppointment.id ? 'Đang check-in...' : 'Check-in online'}
              </button>
              <button className="patient-outline-button" type="button" onClick={() => setShowQr((value) => !value)}>
                <PatientIcon name="receipt_long" aria-hidden="true" />
                Hiển thị QR check-in
              </button>
              <button className="patient-soft-button" type="button" onClick={() => onNavigate?.('directory')}>
                <PatientIcon name="directions" aria-hidden="true" />
                Xem hướng dẫn đến phòng
              </button>
            </div>
          </section>

          <aside className="patient-panel patient-checkin-guide">
            <h2>QR check-in</h2>
            {showQr ? (
              <div className="patient-checkin-qr" aria-label="QR check-in mô phỏng">
                {qrCells.map((filled, index) => (
                  <span key={index} className={filled ? 'is-filled' : ''} />
                ))}
              </div>
            ) : (
              <p>QR dùng để nhân viên quầy xác nhận đúng lịch hẹn trong ngày.</p>
            )}
            <div className="patient-checkin-room-card">
              <strong>{todayAppointment.room}</strong>
              <span>{todayAppointment.department} · {todayAppointment.doctor}</span>
            </div>
            <ol>
              <li>Đến khu tiếp nhận đúng cơ sở ghi trên lịch.</li>
              <li>Mở QR hoặc bấm check-in online trước giờ khám.</li>
              <li>Theo dõi số thứ tự và di chuyển đến phòng được chỉ định.</li>
            </ol>
          </aside>
        </div>
      ) : null}

      {stateId === 'queued' && !hasQueue ? (
        <div className="patient-checkin-empty-layout">
          <section className="patient-panel patient-checkin-empty-panel">
            <div className="patient-checkin-empty-icon" aria-hidden="true">
              <PatientIcon name="receipt_long" />
            </div>
            <div>
              <h2>Chưa có queue đang hoạt động.</h2>
              <p>Queue sẽ xuất hiện sau khi lịch hôm nay được check-in thành công.</p>
            </div>
            <div className="patient-checkin-empty-actions">
              {todayAppointment ? (
                <button
                  className="patient-hero-button"
                  type="button"
                  disabled={checkingInAppointmentId === todayAppointment.id}
                  onClick={() => onCheckIn?.(todayAppointment.id)}
                >
                  <PatientIcon name="check_circle" aria-hidden="true" />
                  {checkingInAppointmentId === todayAppointment.id ? 'Đang check-in...' : 'Check-in online'}
                </button>
              ) : null}
              <button className="patient-outline-button" type="button" onClick={() => onNavigate?.('appointments')}>
                <PatientIcon name="event" aria-hidden="true" />
                Xem lịch hẹn
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {stateId === 'queued' && hasQueue ? (
        <div className="patient-checkin-grid">
          <section className="patient-panel patient-checkin-queue-card">
            <div className="patient-checkin-card-head">
              <span className="patient-checkin-card-icon" aria-hidden="true">
                <PatientIcon name="receipt_long" />
              </span>
              <div>
                <p className="patient-section-label">Đã check-in</p>
                <h2>Trạng thái queue hiện tại</h2>
              </div>
            </div>

            <div className="patient-checkin-number">
              <strong>{getQueueNo(effectiveQueue)}</strong>
              <span>Số thứ tự của bạn</span>
            </div>

            <div className="patient-checkin-progress" aria-label="Tiến độ hàng đợi">
              <span style={{ width: `${queueProgress}%` }} />
            </div>

            <div className="patient-checkin-meta-grid">
              <div>
                <span>Đang phục vụ</span>
                <strong>{getCurrentServingNo(effectiveQueue)}</strong>
              </div>
              <div>
                <span>Còn trước bạn</span>
                <strong>{effectiveQueue?.people_ahead ?? 0} người</strong>
              </div>
              <div>
                <span>Dự kiến đến lượt</span>
                <strong>{effectiveQueue?.estimated_wait_minutes ?? 0} phút</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <strong>{getQueueStatusLabel(effectiveQueue?.status)}</strong>
              </div>
              <div>
                <span>Phòng khám</span>
                <strong>{currentRoomName}</strong>
              </div>
              <div>
                <span>Bác sĩ</span>
                <strong>{currentDoctorName}</strong>
              </div>
            </div>

            <div className="patient-checkin-actions">
              <button className="patient-hero-button" type="button" onClick={handleNotifyClick}>
                <PatientIcon name={notifyEnabled ? 'notifications_off' : 'notifications'} aria-hidden="true" />
                {notifyEnabled ? 'Tắt thông báo lượt' : 'Nhận thông báo khi gần tới lượt'}
              </button>
              <button className="patient-outline-button" type="button" onClick={() => onNavigate?.('directory')}>
                <PatientIcon name="map" aria-hidden="true" />
                Xem bản đồ phòng khám
              </button>
              <button className="patient-soft-button" type="button" onClick={() => onNavigate?.('support')}>
                <PatientIcon name="call" aria-hidden="true" />
                Liên hệ quầy
              </button>
            </div>
          </section>

          <aside className="patient-panel patient-checkin-guide">
            <h2>Hướng dẫn đến phòng khám</h2>
            <div className="patient-checkin-room-card">
              <strong>{currentRoomName}</strong>
              <span>{[queueRoom.floor || 'Tầng 2', queueRoom.building || 'Khu A'].filter(Boolean).join(' · ')}</span>
            </div>
            <ol>
              <li>Đi thang máy đến {queueRoom.floor || 'tầng 2'}.</li>
              <li>Rẽ phải tại quầy điều dưỡng gần nhất.</li>
              <li>{currentRoomName} nằm bên trái hành lang.</li>
            </ol>
          </aside>
        </div>
      ) : null}
    </section>
  )
}
