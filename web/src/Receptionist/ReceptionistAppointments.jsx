import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentAPI, queueAPI } from '../utils/api'
import { clearStoredAuth, readStoredAuth } from '../lib/storage'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

const statusLabels = {
  booked: 'Đã đặt',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã check-in',
  in_consultation: 'Đang khám',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
  rescheduled: 'Đã đổi lịch',
}

function getAppointmentStatusLabel(status) {
  return statusLabels[status] || status || 'Chưa xác định'
}

function formatAppointmentTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(date)
}

function mapAppointmentToRow(appointment) {
  const patientRecord = appointment.patient_code ? `HS: ${appointment.patient_code}` : `HS: ${String(appointment.patient_id || '').slice(-6)}`
  return {
    appointment_id: appointment.appointment_id,
    time: formatAppointmentTime(appointment.appointment_time),
    patient: appointment.patient_name || `Bệnh nhân ${String(appointment.patient_id || '').slice(-6)}`,
    record: patientRecord,
    phone: appointment.patient_phone || '—',
    doctor: appointment.doctor_name || '—',
    doctorMeta: appointment.department_name || appointment.appointment_type || 'N/A',
    room: appointment.department_name || '—',
    service: appointment.reason || appointment.appointment_type || 'Khám bệnh',
    status: getAppointmentStatusLabel(appointment.status),
  }
}

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function StatusBadge({ status }) {
  const tone = status === 'Đã xác nhận' ? 'green' : status === 'Đã check-in' ? 'blue' : status === 'Đã hủy' ? 'red' : 'orange'
  return <span className={`appt-badge ${tone}`}>{status}</span>
}

export default function ReceptionistAppointmentsPage() {
  const navigate = useNavigate()
  const auth = readStoredAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selectedDoctor, setSelectedDoctor] = useState('all')
  const [selectedRoom, setSelectedRoom] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalAppointments, setTotalAppointments] = useState(0)
  const displayUser = auth?.user?.fullName || auth?.user?.username || 'receptionist02'
  const [actionMenu, setActionMenu] = useState(null) // appointment_id of open menu
  const [statusLoading, setStatusLoading] = useState(null) // appointment_id being updated

  useEffect(() => {
    async function loadAppointments() {
      setLoading(true)
      setError(null)

      try {
        const response = await appointmentAPI.listAppointments({ date: selectedDate, limit: 100 })
        const items = response.data?.data?.items || []
        setAppointments(items)
        setTotalAppointments(response.data?.data?.pagination?.total || items.length)
      } catch (fetchError) {
        setError(fetchError?.response?.data?.message || fetchError?.message || 'Không thể tải danh sách lịch hẹn.')
      } finally {
        setLoading(false)
      }
    }

    loadAppointments()
  }, [selectedDate])

  const rows = useMemo(() => appointments.map(mapAppointmentToRow), [appointments])
  const doctorOptions = useMemo(() => {
    const doctors = Array.from(new Set(rows.map((row) => row.doctor).filter(Boolean)))
    return [{ value: 'all', label: 'Tất cả bác sĩ' }, ...doctors.map((name) => ({ value: name, label: name }))]
  }, [rows])
  const roomOptions = useMemo(() => {
    const rooms = Array.from(new Set(rows.map((row) => row.room).filter(Boolean)))
    return [{ value: 'all', label: 'Tất cả phòng khám' }, ...rooms.map((room) => ({ value: room, label: room }))]
  }, [rows])

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return rows.filter((row) => {
      const matchSearch =
        !term ||
        [row.patient, row.record, row.phone, row.doctor, row.room, row.service, row.status]
          .some((value) => value.toLowerCase().includes(term))
      const matchDoctor = selectedDoctor === 'all' || row.doctor === selectedDoctor
      const matchRoom = selectedRoom === 'all' || row.room === selectedRoom
      const matchStatus = selectedStatus === 'all' || row.status === selectedStatus
      return matchSearch && matchDoctor && matchRoom && matchStatus
    })
  }, [rows, searchTerm, selectedDoctor, selectedRoom, selectedStatus])

  const appointmentStats = useMemo(() => {
    const total = rows.length
    const confirmed = rows.filter((row) => row.status === 'Đã xác nhận').length
    const checkedIn = rows.filter((row) => row.status === 'Đã check-in').length
    const cancelled = rows.filter((row) => row.status === 'Đã hủy').length
    const confirmedRate = total ? `${Math.round((confirmed / total) * 100)}% tổng lịch` : '0% tổng lịch'
    const checkedInRate = total ? `${Math.round((checkedIn / total) * 100)}% tổng lịch` : '0% tổng lịch'
    const cancelledRate = total ? `${Math.round((cancelled / total) * 100)}% tổng lịch` : '0% tổng lịch'

    return [
      { label: 'Tổng lịch hôm nay', value: total, detail: `Tổng ${total} lịch`, tone: 'purple' },
      { label: 'Đã xác nhận', value: confirmed, detail: confirmedRate, tone: 'green' },
      { label: 'Đã check-in', value: checkedIn, detail: checkedInRate, tone: 'blue' },
      { label: 'Đã hủy', value: cancelled, detail: cancelledRate, tone: 'red' },
    ]
  }, [rows])

  function handleMenuSelection(item) {
    if (item.key === 'dashboard') {
      navigate('/receptionist')
      return
    }
    if (item.key === 'appointments') {
      navigate('/receptionist/appointments')
      return
    }
    if (item.key === 'createAppointment') {
      navigate('/receptionist/create')
      return
    }
    if (item.key === 'searchPatient') {
      navigate('/receptionist/appointments')
      return
    }
  }

  function handleLogout() {
    clearStoredAuth()
    navigate('/staff/login', { replace: true })
  }

  async function handleStatusChange(appointmentId, action, label) {
    if (!window.confirm(`Xác nhận: ${label}?`)) return
    setStatusLoading(appointmentId)
    setActionMenu(null)
    try {
      if (action === 'confirm') {
        await appointmentAPI.confirm(appointmentId)
      } else if (action === 'check-in') {
        await appointmentAPI.checkIn(appointmentId)
        // Tạo Queue Ticket để bệnh nhân xuất hiện ở trang Danh sách chờ
        try {
          await queueAPI.createFromAppointment(appointmentId)
        } catch (queueErr) {
          console.warn('Tạo queue ticket không thành công:', queueErr?.message)
        }
      } else if (action === 'cancel') {
        await appointmentAPI.cancel(appointmentId)
      } else if (action === 'no-show') {
        await appointmentAPI.noShow(appointmentId)
      } else if (action === 'complete') {
        await appointmentAPI.complete(appointmentId)
      }
      // Reload danh sách
      const response = await appointmentAPI.listAppointments({ date: selectedDate, limit: 100 })
      const items = response.data?.data?.items || []
      setAppointments(items)
      setTotalAppointments(response.data?.data?.pagination?.total || items.length)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không thể cập nhật trạng thái lịch hẹn.')
    } finally {
      setStatusLoading(null)
    }
  }

  function getActions(status, appointmentId) {
    const s = status
    const actions = []
    if (s === 'Đã đặt') {
      actions.push({ action: 'confirm', label: 'Xác nhận lịch', tone: 'green' })
      actions.push({ action: 'cancel', label: 'Hủy lịch', tone: 'red' })
    } else if (s === 'Đã xác nhận') {
      actions.push({ action: 'check-in', label: 'Check-in tiếp nhận', tone: 'blue' })
      actions.push({ action: 'cancel', label: 'Hủy lịch', tone: 'red' })
    } else if (s === 'Đã check-in' || s === 'Đang khám') {
      actions.push({ action: 'complete', label: 'Hoàn tất khám', tone: 'green' })
      actions.push({ action: 'no-show', label: 'Không đến', tone: 'orange' })
    }
    return actions
  }

  return (
    <ReceptionistShell
      title="Lịch hẹn"
      subtitle="Quản lý và theo dõi toàn bộ lịch hẹn khám bệnh"
      activeSection="appointments"
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onCreateAppointment={() => navigate('/receptionist/create')}
    >
      <div className="rd-content appointment-content">
        <div className="appointment-topcards">
          {appointmentStats.map((card) => (
            <article key={card.label} className={`rd-stat ${card.tone}`}>
              <div className="rd-stat-head">
                <div className={`rd-stat-icon ${card.tone}`}><Icon name="calendar" /></div>
                <span>{card.label}</span>
              </div>
              <div className="rd-stat-body">
                <strong>{card.value}</strong>
                <span>{card.detail}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="appointment-filters">
          <div className="appointment-search-field">
            <Icon name="search" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm bệnh nhân, SDT, mã hồ sơ..."
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
            <option value="Đã đặt">Đã đặt</option>
            <option value="Đã xác nhận">Đã xác nhận</option>
            <option value="Đã check-in">Đã check-in</option>
            <option value="Đang khám">Đang khám</option>
            <option value="Hoàn tất">Hoàn tất</option>
            <option value="Đã hủy">Đã hủy</option>
            <option value="Không đến">Không đến</option>
            <option value="Đã đổi lịch">Đã đổi lịch</option>
          </select>
          <button className="appointment-export">Xuất file</button>
          <button className="appointment-create" onClick={() => navigate('/receptionist/create')}>Đặt lịch mới</button>
        </div>

        <div className="appointment-table-card">
          <table className="appointment-table">
            <thead>
              <tr>
                <th>Giờ</th>
                <th>Bệnh nhân</th>
                <th>Số điện thoại</th>
                <th>Bác sĩ</th>
                <th>Phòng khám</th>
                <th>Dịch vụ</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="appointment-loading">
                    Đang tải lịch hẹn...
                  </td>
                </tr>
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row, index) => (
                  <tr key={`${row.appointment_id || row.patient}-${index}`}>
                    <td>{row.time}</td>
                    <td>
                      <strong>{row.patient}</strong>
                      <small>{row.record}</small>
                    </td>
                    <td>{row.phone}</td>
                    <td>
                      <strong>{row.doctor}</strong>
                      <small>{row.doctorMeta}</small>
                    </td>
                    <td>{row.room}</td>
                    <td>{row.service}</td>
                    <td><StatusBadge status={row.status} /></td>
                    <td style={{ position: 'relative' }}>
                      {statusLoading === row.appointment_id ? (
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>Đang xử lý...</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {getActions(row.status, row.appointment_id).map((act) => (
                            <button
                              key={act.action}
                              type="button"
                              style={{
                                fontSize: '0.75rem',
                                padding: '3px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                                background:
                                  act.tone === 'green' ? '#dcfce7' :
                                  act.tone === 'blue' ? '#dbeafe' :
                                  act.tone === 'red' ? '#fee2e2' :
                                  act.tone === 'orange' ? '#ffedd5' : '#f3f4f6',
                                color:
                                  act.tone === 'green' ? '#166534' :
                                  act.tone === 'blue' ? '#1d4ed8' :
                                  act.tone === 'red' ? '#991b1b' :
                                  act.tone === 'orange' ? '#9a3412' : '#374151',
                              }}
                              onClick={() => handleStatusChange(row.appointment_id, act.action, act.label)}
                            >
                              {act.label}
                            </button>
                          ))}
                          {getActions(row.status, row.appointment_id).length === 0 && (
                            <span style={{ fontSize: '0.78rem', color: '#aaa' }}>—</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="appointment-empty">
                    {error ? error : 'Không tìm thấy lịch hẹn cho ngày đã chọn.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="appointment-pagination">
          <span>Hiển thị {filteredRows.length} của {totalAppointments} kết quả</span>
          <div>
            <button>‹</button>
            <button className="active">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </div>
        </div>
      </div>
    </ReceptionistShell>
  )
}
