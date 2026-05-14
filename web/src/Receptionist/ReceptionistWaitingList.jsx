import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { appointmentAPI, queueAPI } from '../utils/api'
import { readStoredAuth } from '../lib/storage'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function formatTime(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(date)
}

function statusLabel(status = '') {
  const labels = {
    waiting: 'Đang chờ',
    called: 'Đã gọi',
    in_service: 'Đang phục vụ',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    skipped: 'Bỏ qua',
    recalled: 'Gọi lại',
  }
  return labels[status] || status || 'Chưa xác định'
}

function statusTone(status = '') {
  const normalized = String(status).toLowerCase()
  if (normalized === 'waiting') return 'orange'
  if (normalized === 'called' || normalized === 'recalled') return 'blue'
  if (normalized === 'in_service') return 'green'
  if (normalized === 'completed') return 'green'
  if (normalized === 'cancelled' || normalized === 'skipped') return 'red'
  return 'violet'
}

function StatusBadge({ status }) {
  return <span className={`appt-badge ${statusTone(status)}`}>{statusLabel(status)}</span>
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể tải dữ liệu.')
  }
  return payload?.data || payload
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

function transformAppointmentToRow(item) {
  return {
    id: item.appointment_id || item._id,
    appointment_id: item.appointment_id || item._id,
    patientName: item.patient_name || `Bệnh nhân ${String(item.patient_id || '').slice(-6)}`,
    patientCode: item.patient_code ? `HS: ${item.patient_code}` : `HS: ${String(item.patient_id || '').slice(-6)}`,
    patientPhone: item.patient_phone || '—',
    doctorName: item.doctor_name || 'Chưa rõ bác sĩ',
    roomName: item.department_name || 'Chưa rõ phòng',
    checkinTime: item.appointment_time ? new Date(item.appointment_time) : null,
    status: item.status || 'booked',
    reason: item.reason || '',
    appointmentType: item.appointment_type || 'outpatient',
    queueType: 'normal',
    ticket: item.patient_code || `BN-${String(item.patient_id || '').slice(-6)}`,
  }
}

function hasUnknownAssignment(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return !normalized || normalized.includes('chưa rõ') || normalized.includes('chua ro')
}

function isWaitingAppointment(row) {
  return ['booked', 'confirmed'].includes(row.status)
}

export default function ReceptionistWaitingListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = readStoredAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selectedDoctor, setSelectedDoctor] = useState('all')
  const [selectedRoom, setSelectedRoom] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [queueRows, setQueueRows] = useState([])
  const [doctorOptions, setDoctorOptions] = useState([{ value: 'all', label: 'Tất cả bác sĩ' }])
  const [roomOptions, setRoomOptions] = useState([{ value: 'all', label: 'Tất cả phòng khám' }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [statusLoading, setStatusLoading] = useState(null)

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2500)
  }

  function getStatusLabel(row) {
    if (row.status === 'booked') return 'Đã đặt'
    if (row.status === 'confirmed') return 'Đã xác nhận'
    if (row.status === 'checked_in') return 'Đã check-in'
    return statusLabel(row.status)
  }

  async function handleAction(row, action) {
    const labels = { confirm: 'Xác nhận lịch', 'check-in': 'Check-in tiếp nhận', cancel: 'Hủy lịch' }
    if (!window.confirm(`Xác nhận: ${labels[action]}?`)) return
    setStatusLoading(row.id)
    try {
      if (action === 'confirm') {
        await appointmentAPI.confirm(row.appointment_id)
      } else if (action === 'check-in') {
        await appointmentAPI.checkIn(row.appointment_id)
        try { await queueAPI.createFromAppointment(row.appointment_id) } catch (e) { console.warn(e) }
      } else if (action === 'cancel') {
        await appointmentAPI.cancel(row.appointment_id)
      }
      // Reload
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không thể cập nhật trạng thái.')
    } finally {
      setStatusLoading(null)
    }
  }

  function getActionButtons(row) {
    if (row.status === 'booked') {
      return [
        { label: 'Xác nhận', action: () => handleAction(row, 'confirm'), tone: 'green' },
        { label: 'Hủy lịch', action: () => handleAction(row, 'cancel'), tone: 'red' },
      ]
    }
    if (row.status === 'confirmed') {
      return [
        { label: 'Check-in tiếp nhận', action: () => handleAction(row, 'check-in'), tone: 'blue' },
        { label: 'Hủy lịch', action: () => handleAction(row, 'cancel'), tone: 'red' },
      ]
    }
    return []
  }

  useEffect(() => {
    async function loadWaitingList() {
      setLoading(true)
      setError(null)
      try {
        const res = await appointmentAPI.listAppointments({ date: selectedDate, limit: 200 })
        const items = res.data?.data?.items || res.data?.items || []
        const pending = items.filter((item) => ['booked', 'confirmed'].includes(item.status))
        setQueueRows(pending.map(transformAppointmentToRow))

        const doctors = Array.from(new Set(pending.map((item) => item.doctor_name).filter(Boolean)))
        setDoctorOptions([{ value: 'all', label: 'Tất cả bác sĩ' }, ...doctors.map((name) => ({ value: name, label: name }))])

        const rooms = Array.from(new Set(pending.map((item) => item.department_name).filter(Boolean)))
        setRoomOptions([{ value: 'all', label: 'Tất cả phòng khám' }, ...rooms.map((name) => ({ value: name, label: name }))])
      } catch (loadError) {
        setError(loadError?.message || 'Không thể tải danh sách chờ.')
      } finally {
        setLoading(false)
      }
    }
    loadWaitingList()
  }, [selectedDate, refreshKey])

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return queueRows.filter((row) => {
      const matchesSearch =
        !term ||
        [row.patientName, row.ticket, row.doctorName, row.roomName, row.queueType, row.status]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
      const matchesDoctor = selectedDoctor === 'all' || row.doctorName === selectedDoctor
      const matchesRoom = selectedRoom === 'all' || row.roomName === selectedRoom
      const matchesStatus = selectedStatus === 'all' || row.status === selectedStatus
      return matchesSearch && matchesDoctor && matchesRoom && matchesStatus
    })
  }, [queueRows, searchTerm, selectedDoctor, selectedRoom, selectedStatus])

  const arrivalsCount = useMemo(
    () => queueRows.filter((row) => {
      if (!isWaitingAppointment(row) || !row.checkinTime) return false
      const diff = row.checkinTime.getTime() - Date.now()
      return diff > 0 && diff <= 60 * 60000
    }).length,
    [queueRows],
  )
  const checkedInCount = useMemo(
    () => queueRows.filter((row) => {
      if (!isWaitingAppointment(row) || !row.checkinTime) return false
      const diff = Date.now() - row.checkinTime.getTime()
      return diff >= 0 && diff <= 15 * 60000
    }).length,
    [queueRows],
  )
  const lateCount = useMemo(
    () => queueRows.filter((row) => isWaitingAppointment(row) && row.checkinTime && row.checkinTime.getTime() < Date.now() - 15 * 60000).length,
    [queueRows],
  )
  const coordinationCount = useMemo(
    () => queueRows.filter((row) => isWaitingAppointment(row) && (hasUnknownAssignment(row.doctorName) || hasUnknownAssignment(row.roomName))).length,
    [queueRows],
  )

  const priorityRows = useMemo(
    () => queueRows
      .filter((row) => row.queueType === 'priority' || row.queueType === 'vip')
      .sort((a, b) => a.checkinTime - b.checkinTime)
      .slice(0, 3),
    [queueRows],
  )

  const lateWarnings = useMemo(
    () => queueRows
      .filter((row) => isWaitingAppointment(row) && row.checkinTime && row.checkinTime.getTime() < Date.now() - 15 * 60000)
      .slice(0, 3),
    [queueRows],
  )

  const coordinationSuggestions = useMemo(
    () => queueRows
      .filter((row) => isWaitingAppointment(row) && row.queueType === 'normal' && (hasUnknownAssignment(row.doctorName) || hasUnknownAssignment(row.roomName)))
      .slice(0, 2),
    [queueRows],
  )

  const activeSection = location.pathname.includes('/receptionist/queue') ? 'queue' : 'waitingList'
  const displayUser = auth?.user?.fullName || auth?.user?.username || 'Receptionist'

  return (
    <ReceptionistShell
      title="Lịch chờ xác nhận"
      subtitle="Danh sách lịch hẹn chưa check-in, cần xác nhận hoặc tiếp nhận"
      activeSection={activeSection}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onCreateAppointment={() => navigate('/receptionist/create')}
    >
      {notice && <div className="rd-toast">{notice}</div>}
      <div className="rd-content appointment-content">
        <div className="rd-stats">
          <article className="rd-stat purple">
            <div className="rd-stat-head">
              <div className="rd-stat-icon purple"><Icon name="clock" /></div>
              <span>Sắp đến giờ</span>
            </div>
            <div className="rd-stat-body">
              <strong>{arrivalsCount}</strong>
              <span>Trong 60 phút tới</span>
            </div>
          </article>
          <article className="rd-stat green">
            <div className="rd-stat-head">
              <div className="rd-stat-icon green"><Icon name="check" /></div>
              <span>Đã đến</span>
            </div>
            <div className="rd-stat-body">
              <strong>{checkedInCount}</strong>
              <span>Chờ check-in</span>
            </div>
          </article>
          <article className="rd-stat red">
            <div className="rd-stat-head">
              <div className="rd-stat-icon red"><Icon name="warning" /></div>
              <span>Trễ giờ</span>
            </div>
            <div className="rd-stat-body">
              <strong>{lateCount}</strong>
              <span>Cần xử lý ngay</span>
            </div>
          </article>
          <article className="rd-stat orange">
            <div className="rd-stat-head">
              <div className="rd-stat-icon orange"><Icon name="users" /></div>
              <span>Cần điều phối</span>
            </div>
            <div className="rd-stat-body">
              <strong>{coordinationCount}</strong>
              <span>Chưa có phòng phù hợp</span>
            </div>
          </article>
        </div>

        <div className="appointment-filters">
          <div className="appointment-search-field">
            <Icon name="search" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm bệnh nhân, SDT, mã lượt..."
            />
          </div>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          <select value={selectedDoctor} onChange={(event) => setSelectedDoctor(event.target.value)}>
            {doctorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={selectedRoom} onChange={(event) => setSelectedRoom(event.target.value)}>
            {roomOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="booked">Đã đặt</option>
            <option value="confirmed">Đã xác nhận</option>
          </select>
          <button type="button" className="appointment-export" onClick={() => setRefreshKey((k) => k + 1)}>
            Làm mới
          </button>
        </div>

        <div className="appointment-table-card">
          <table className="appointment-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Bệnh nhân</th>
                <th>Thông tin khám</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="appointment-loading">
                    Đang tải danh sách chờ...
                  </td>
                </tr>
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{formatTime(row.checkinTime)}</strong>
                      <small>{getStatusLabel(row)}</small>
                    </td>
                    <td>
                      <strong>{row.patientName}</strong>
                      <small>{row.ticket}</small>
                    </td>
                    <td>
                      <strong>{row.doctorName}</strong>
                      <small>{row.roomName}</small>
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>
                      {statusLoading === row.id ? (
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>Đang xử lý...</span>
                      ) : (
                        getActionButtons(row).map((button) => (
                          <button
                            key={button.label}
                            type="button"
                            style={{
                              fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px',
                              border: 'none', cursor: 'pointer', fontWeight: 600, marginRight: '4px',
                              background: button.tone === 'green' ? '#dcfce7' : button.tone === 'blue' ? '#dbeafe' : button.tone === 'red' ? '#fee2e2' : '#f3f4f6',
                              color: button.tone === 'green' ? '#166534' : button.tone === 'blue' ? '#1d4ed8' : button.tone === 'red' ? '#991b1b' : '#374151',
                            }}
                            onClick={button.action}
                          >
                            {button.label}
                          </button>
                        ))
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="appointment-empty">
                    {error || 'Không có lượt chờ phù hợp.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="appointment-pagination">
          <span>Hiển thị {filteredRows.length} của {queueRows.length} lượt</span>
          <div>
            <button>‹</button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </div>
        </div>
      </div>

      <aside className="rd-right">
        <section className="rd-card-list">
          <header>
            <h2>Ưu tiên xử lý</h2>
            <span>{priorityRows.length}</span>
          </header>
          {priorityRows.length > 0 ? priorityRows.map((row, index) => (
            <article key={row.id}>
              <b>{index + 1}</b>
              <div>
                <strong>{row.patientName}</strong>
                <p>{row.roomName} • {formatTime(row.checkinTime)}</p>
              </div>
              <button type="button" onClick={() => showNotice(`Xử lý ${row.patientName}`)}>Xử lý</button>
            </article>
          )) : <p className="rd-muted">Không có bệnh nhân ưu tiên.</p>}
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Cảnh báo trễ giờ</h2>
            <button type="button" onClick={() => showNotice('Xem danh sách trễ giờ.')}>Xem danh sách</button>
          </header>
          {lateWarnings.length > 0 ? lateWarnings.map((row, index) => (
            <article key={row.id}>
              <b>{index + 1}</b>
              <div>
                <strong>{row.patientName}</strong>
                <p>{formatTime(row.checkinTime)} • {row.roomName}</p>
              </div>
            </article>
          )) : <p className="rd-muted">Không có cảnh báo trễ.</p>}
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Gợi ý điều phối</h2>
            <span>{coordinationSuggestions.length}</span>
          </header>
          {coordinationSuggestions.length > 0 ? coordinationSuggestions.map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.roomName}</strong>
                <p>{row.patientName} • {formatTime(row.checkinTime)}</p>
              </div>
              <button type="button" onClick={() => showNotice(`Điều phối ${row.patientName}`)}>Điều phối</button>
            </article>
          )) : <p className="rd-muted">Chưa có gợi ý điều phối.</p>}
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Tải nhanh</h2>
          </header>
          <article className="rd-card-action">
            <div>
              <strong>Xuất danh sách</strong>
              <p>Tải file danh sách chờ hiện tại để gửi cho phòng khám hoặc lưu hồ sơ.</p>
            </div>
            <button type="button" onClick={() => showNotice('Xuất danh sách chờ.')}>Xuất</button>
          </article>
          <article className="rd-card-action">
            <div>
              <strong>In danh sách</strong>
              <p>Chuẩn bị mẫu in danh sách chờ để màn hình tiếp nhận hoặc quầy lễ tân.</p>
            </div>
            <button type="button" onClick={() => showNotice('In danh sách chờ.')}>In</button>
          </article>
        </section>
      </aside>
    </ReceptionistShell>
  )
}
