import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import { queueAPI } from '../utils/api'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

const DEPARTMENT_CACHE_URL = `${API_BASE_URL}/departments/active`

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function formatTime(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(date)
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

function transformDoctor(item, index) {
  const id = item.user_id || item._id || `doctor-${index}`
  return {
    id,
    name: item.full_name || item.name || item.username || `Bác sĩ ${index + 1}`,
    department: item.department_name || item.department || 'Phòng khám',
  }
}

function transformPatient(item) {
  const id = item.patient_id || item._id
  return {
    id: String(id),
    name: item.full_name || item.name || `Bệnh nhân ${String(id).slice(-6)}`,
    code: item.patient_code || item.medical_record_number || 'HS: ---',
    phone: item.phone || item.phone_number || item.mobile || '—',
    age: item.age || item.birth_date ? new Date().getFullYear() - new Date(item.birth_date).getFullYear() : null,
    gender: item.gender || item.sex || '—',
  }
}

function formatStatusLabel(status) {
  if (status === 'waiting') return 'Đang chờ'
  if (status === 'called') return 'Đã gọi'
  if (status === 'in_service') return 'Đang khám'
  if (status === 'completed') return 'Hoàn tất'
  if (status === 'cancelled') return 'Đã hủy'
  if (status === 'skipped') return 'Bỏ qua'
  if (status === 'recalled') return 'Gọi lại'
  return status
}

function statusTone(status) {
  if (status === 'waiting') return 'orange'
  if (status === 'called' || status === 'recalled') return 'blue'
  if (status === 'in_service') return 'green'
  if (status === 'completed') return 'green'
  if (status === 'cancelled' || status === 'skipped') return 'red'
  return 'violet'
}

function StatusBadge({ status }) {
  return <span className={`appt-badge ${statusTone(status)}`}>{formatStatusLabel(status)}</span>
}

function getDelayLabel(row) {
  if (!row.checkinTime) return ''
  const diff = row.checkinTime.getTime() - Date.now()
  if (diff < -15 * 60000) {
    return `Trễ ${Math.abs(Math.round(diff / 60000))} phút`
  }
  if (diff <= 0) {
    return 'Sắp đến giờ'
  }
  return `Còn ${Math.round(diff / 60000)} phút`
}

export default function ReceptionistQueueListPage() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [statusLoading, setStatusLoading] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2500)
  }

  async function handleQueueAction(ticketId, action) {
    const labels = {
      'start-service': 'Bắt đầu khám',
      complete: 'Hoàn tất khám',
      cancel: 'Hủy lượt',
      recall: 'Gọi lại',
    }
    if (!window.confirm(`Xác nhận: ${labels[action] || action}?`)) return
    setStatusLoading(ticketId)
    try {
      if (action === 'start-service') await queueAPI.startService(ticketId)
      else if (action === 'complete') await queueAPI.complete(ticketId)
      else if (action === 'cancel') await queueAPI.cancel(ticketId)
      else if (action === 'recall') await queueAPI.recall(ticketId)
      // Reload data
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showNotice(err?.response?.data?.message || err?.message || 'Không thể cập nhật trạng thái.')
    } finally {
      setStatusLoading(null)
    }
  }

  useEffect(() => {
    async function loadQueue() {
      setLoading(true)
      setError(null)

      try {
        const [patientsPayload, doctorsPayload, queuePayload, departmentsPayload] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/patients?limit=250`).then(readJson),
          fetchWithAuth(`${API_BASE_URL}/staff/doctors`).then(readJson),
          fetchWithAuth(`${API_BASE_URL}/queue?limit=200&date=${selectedDate}`).then(readJson),
          fetch(DEPARTMENT_CACHE_URL).then((res) => res.json()).then((res) => res?.data || res).catch(() => []),
        ])

        const patients = itemsFrom(patientsPayload).map(transformPatient)
        const patientMap = new Map(patients.map((patient) => [patient.id, patient]))
        const doctors = itemsFrom(doctorsPayload).map(transformDoctor)
        const doctorMap = new Map(doctors.map((doctor) => [String(doctor.id), doctor]))
        const departments = itemsFrom(departmentsPayload)
        const departmentMap = new Map(
          departments.map((dep) => [String(dep.department_id || dep._id), dep.department_name || dep.name || 'Phòng khám'])
        )

        const rows = itemsFrom(queuePayload).map((item, index) => {
          const patient = patientMap.get(String(item.patient_id)) || transformPatient({ patient_id: item.patient_id })
          const doctor = doctorMap.get(String(item.doctor_id)) || transformDoctor(item, index)
          const checkinTime = item.checkin_time ? new Date(item.checkin_time) : null
          return {
            id: item.queue_ticket_id || item._id || `queue-${index}`,
            ticket: item.queue_number || `Q${index + 1}`,
            patientName: patient.name,
            patientCode: patient.code,
            patientDetail: `${patient.gender === 'female' ? 'Nữ' : patient.gender === 'male' ? 'Nam' : ''}${patient.age ? ` • ${patient.age} tuổi` : ''}`,
            phone: patient.phone,
            roomName: departmentMap.get(String(item.department_id)) || doctor.department || 'Phòng khám',
            doctorName: doctor.name,
            checkinTime,
            status: item.status || 'waiting',
            queueType: item.queue_type || 'normal',
            isPriority: item.queue_type === 'priority' || item.queue_type === 'vip',
          }
        })

        setQueueRows(rows)

        setDoctorOptions([
          { value: 'all', label: 'Tất cả bác sĩ' },
          ...Array.from(new Set(rows.map((row) => row.doctorName).filter(Boolean))).map((name) => ({ value: name, label: name })),
        ])

        setRoomOptions([
          { value: 'all', label: 'Tất cả phòng khám' },
          ...Array.from(new Set(rows.map((row) => row.roomName).filter(Boolean))).map((name) => ({ value: name, label: name })),
        ])
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách chờ.')
      } finally {
        setLoading(false)
      }
    }

    loadQueue()
  }, [selectedDate, refreshKey])

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return queueRows.filter((row) => {
      const matchesSearch =
        !term ||
        [row.patientName, row.patientCode, row.phone, row.roomName, row.doctorName, row.ticket, row.status]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
      const matchesDoctor = selectedDoctor === 'all' || row.doctorName === selectedDoctor
      const matchesRoom = selectedRoom === 'all' || row.roomName === selectedRoom
      const matchesStatus = selectedStatus === 'all' || row.status === selectedStatus
      return matchesSearch && matchesDoctor && matchesRoom && matchesStatus
    })
  }, [queueRows, searchTerm, selectedDoctor, selectedRoom, selectedStatus])

  const stats = useMemo(() => {
    const waiting = queueRows.filter((row) => row.status === 'waiting').length
    const called = queueRows.filter((row) => row.status === 'called').length
    const inService = queueRows.filter((row) => row.status === 'in_service').length
    const completed = queueRows.filter((row) => row.status === 'completed').length
    return [
      { label: 'Đang chờ', value: waiting, detail: `${waiting} so với hôm qua`, tone: 'purple' },
      { label: 'Đã gọi', value: called, detail: `${called} so với hôm qua`, tone: 'green' },
      { label: 'Đang khám', value: inService, detail: `${inService} so với hôm qua`, tone: 'blue' },
      { label: 'Hoàn tất', value: completed, detail: `${completed} so với hôm qua`, tone: 'green' },
    ]
  }, [queueRows])

  const averageWait = useMemo(() => {
    const waitingRows = queueRows.filter((row) => row.status === 'waiting' && row.checkinTime)
    if (!waitingRows.length) return '0 phút'
    const totalMinutes = waitingRows.reduce((sum, row) => sum + Math.max(0, Math.round((row.checkinTime.getTime() - Date.now()) / 60000)), 0)
    return `${Math.round(totalMinutes / waitingRows.length)} phút`
  }, [queueRows])

  const inServiceCount = queueRows.filter((row) => row.status === 'in_service').length
  const priorityList = useMemo(() => queueRows.filter((row) => row.isPriority).slice(0, 3), [queueRows])
  const lateRows = useMemo(
    () => queueRows.filter((row) => row.status === 'waiting' && row.checkinTime && row.checkinTime.getTime() < Date.now() - 15 * 60000).slice(0, 5),
    [queueRows],
  )
  const recommendationRows = useMemo(
    () => queueRows.filter((row) => row.status === 'waiting' && !row.isPriority && row.roomName && row.doctorName).slice(0, 2),
    [queueRows],
  )

  async function handleCallNext() {
    try {
      await queueAPI.callNext({})
      showNotice('Đã gọi số tiếp theo.')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showNotice(err?.response?.data?.message || err?.message || 'Không thể gọi số tiếp theo.')
    }
  }

  const activeSection = location.pathname.includes('/receptionist/queue') ? 'queue' : 'waitingList'

  return (
    <ReceptionistShell
      title="Danh sách chờ"
      subtitle="Quản lý bệnh nhân đã check-in và đang chờ vào khám"
      activeSection={activeSection}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onCreateAppointment={() => navigate('/receptionist/create')}
    >
      {notice && <div className="rd-toast">{notice}</div>}
      <div className="rd-content appointment-content">
        <div className="rd-stats">
          {stats.map((card) => (
            <article key={card.label} className={`rd-stat ${card.tone}`}>
              <div className="rd-stat-head">
                <div className={`rd-stat-icon ${card.tone}`}><Icon name="clock" /></div>
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
              placeholder="Tìm bệnh nhân, SDT, mã lượt..."
            />
          </div>
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          <select value={selectedRoom} onChange={(event) => setSelectedRoom(event.target.value)}>
            {roomOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={selectedDoctor} onChange={(event) => setSelectedDoctor(event.target.value)}>
            {doctorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="waiting">Đang chờ</option>
            <option value="called">Đã gọi</option>
            <option value="in_service">Đang khám</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Đã hủy</option>
          </select>
          <button type="button" className="appointment-export" onClick={() => setRefreshKey((k) => k + 1)}>
            Làm mới
          </button>
          <button type="button" className="appointment-create" onClick={handleCallNext}>
            Gọi số tiếp theo
          </button>
        </div>

        <div className="appointment-table-card">
          <table className="appointment-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã lượt</th>
                <th>Bệnh nhân</th>
                <th>SDT</th>
                <th>Phòng khám</th>
                <th>Bác sĩ</th>
                <th>Giờ check-in</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="appointment-loading">
                    Đang tải danh sách chờ...
                  </td>
                </tr>
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{row.ticket}</td>
                    <td>
                      <strong>{row.patientName}</strong>
                      <small>{row.patientCode} {row.patientDetail}</small>
                    </td>
                    <td>{row.phone}</td>
                    <td>{row.roomName}</td>
                    <td>{row.doctorName}</td>
                    <td>{formatTime(row.checkinTime)}</td>
                    <td>
                      <span className={`appt-badge ${statusTone(row.status)}`}>{formatStatusLabel(row.status)}</span>
                    </td>
                    <td>
                      {statusLoading === row.id ? (
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>Đang xử lý...</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {row.status === 'waiting' && (
                            <button type="button"
                              style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: '#dbeafe', color: '#1d4ed8' }}
                              onClick={() => handleQueueAction(row.id, 'start-service')}
                            >Bắt đầu khám</button>
                          )}
                          {row.status === 'called' && (
                            <button type="button"
                              style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: '#dbeafe', color: '#1d4ed8' }}
                              onClick={() => handleQueueAction(row.id, 'start-service')}
                            >Vào khám</button>
                          )}
                          {row.status === 'in_service' && (
                            <button type="button"
                              style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: '#dcfce7', color: '#166534' }}
                              onClick={() => handleQueueAction(row.id, 'complete')}
                            >Hoàn tất</button>
                          )}
                          {['waiting', 'called'].includes(row.status) && (
                            <button type="button"
                              style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}
                              onClick={() => handleQueueAction(row.id, 'cancel')}
                            >Hủy</button>
                          )}
                          {row.status === 'completed' && (
                            <span style={{ fontSize: '0.78rem', color: '#aaa' }}>—</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="appointment-empty">
                    {error || 'Không có bệnh nhân chờ.'}
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
            <h2>Thời gian chờ trung bình</h2>
            <span>{averageWait}</span>
          </header>
          <article>
            <div>
              <strong>{averageWait}</strong>
              <p>{queueRows.length ? `- ${Math.max(0, queueRows.length - 2)} phút so với hôm qua` : 'Chưa có dữ liệu'}</p>
            </div>
          </article>
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Đang phục vụ</h2>
            <span>{inServiceCount}</span>
          </header>
          <article>
            <div>
              <strong>{inServiceCount}</strong>
              <p>Bệnh nhân đang được khám</p>
            </div>
          </article>
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Bệnh nhân ưu tiên</h2>
            <span>{priorityList.length}</span>
          </header>
          {priorityList.map((row, index) => (
            <article key={row.id}>
              <b>{index + 1}</b>
              <div>
                <strong>{row.patientName}</strong>
                <p>{formatTime(row.checkinTime)} • {row.roomName}</p>
              </div>
              <button type="button" onClick={() => showNotice(`Xử lý ${row.patientName}`)}>Xử lý</button>
            </article>
          ))}
          {!priorityList.length && <p className="rd-muted">Không có bệnh nhân ưu tiên.</p>}
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Cảnh báo trễ giờ</h2>
            <button type="button" onClick={() => showNotice('Xem danh sách trễ giờ')}>Xem danh sách</button>
          </header>
          {lateRows.map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.patientName}</strong>
                <p>{getDelayLabel(row)} • {row.roomName}</p>
              </div>
            </article>
          ))}
          {!lateRows.length && <p className="rd-muted">Không có cảnh báo trễ.</p>}
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Gợi ý điều phối</h2>
            <span>{recommendationRows.length}</span>
          </header>
          {recommendationRows.map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.roomName}</strong>
                <p>{row.patientName} • {formatTime(row.checkinTime)}</p>
              </div>
              <button type="button" onClick={() => showNotice(`Điều phối ${row.patientName}`)}>Điều phối</button>
            </article>
          ))}
          {!recommendationRows.length && <p className="rd-muted">Chưa có gợi ý điều phối.</p>}
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Tải nhanh</h2>
          </header>
          <article className="rd-card-action">
            <div>
              <strong>Xuất danh sách</strong>
              <p>Tải về danh sách bệnh nhân đang chờ hiện tại, dễ dàng gửi cho quản lý hoặc lưu lại.</p>
            </div>
            <button type="button" onClick={() => showNotice('Xuất danh sách')}>
              Xuất
            </button>
          </article>
          <article className="rd-card-action">
            <div>
              <strong>In danh sách</strong>
              <p>In nhanh danh sách chờ giúp nhân viên tiếp nhận và điều phối dễ theo dõi.</p>
            </div>
            <button type="button" onClick={() => showNotice('In danh sách')}>
              In
            </button>
          </article>
        </section>
      </aside>
    </ReceptionistShell>
  )
}
