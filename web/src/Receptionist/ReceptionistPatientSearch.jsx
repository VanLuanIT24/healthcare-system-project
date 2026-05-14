import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import { appointmentAPI } from '../utils/api'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function patientInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase()
}

function initialsColor(name) {
  const colors = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#00cec9', '#636e72']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function formatDate(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function genderLabel(gender) {
  if (gender === 'male') return 'Nam'
  if (gender === 'female') return 'Nữ'
  if (gender === 'other') return 'Khác'
  return '—'
}

function statusLabel(status) {
  if (status === 'active') return 'Hoạt động'
  if (status === 'inactive') return 'Không HĐ'
  if (status === 'deceased') return 'Đã mất'
  if (status === 'archived') return 'Lưu trữ'
  if (status === 'merged') return 'Đã gộp'
  return status || '—'
}

function statusTone(status) {
  if (status === 'active') return 'green'
  if (status === 'inactive') return 'orange'
  if (status === 'archived') return 'violet'
  return 'red'
}

function calculateAge(dob) {
  if (!dob) return null
  const date = new Date(dob)
  if (Number.isNaN(date.getTime())) return null
  return new Date().getFullYear() - date.getFullYear()
}

function getBirthYear(dob) {
  if (!dob) return '—'
  const date = new Date(dob)
  if (Number.isNaN(date.getTime())) return '—'
  return date.getFullYear()
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Không thể tải dữ liệu.')
  return payload?.data || payload
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

const RECENTLY_VIEWED_KEY = 'receptionist_recently_viewed_patients'

function getRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]')
  } catch (_e) { return [] }
}

function addRecentlyViewed(patient) {
  const list = getRecentlyViewed().filter((p) => p.patient_id !== patient.patient_id)
  list.unshift({
    patient_id: patient.patient_id,
    full_name: patient.full_name,
    patient_code: patient.patient_code,
    viewedAt: new Date().toISOString(),
  })
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list.slice(0, 10)))
}

export default function ReceptionistPatientSearchPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [patients, setPatients] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  const [filterGender, setFilterGender] = useState('all')
  const [filterAge, setFilterAge] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const [todayAppointments, setTodayAppointments] = useState([])
  const [recentlyViewed, setRecentlyViewed] = useState(getRecentlyViewed)
  const [quickSearch, setQuickSearch] = useState({ type: '', value: '' })

  function showNotice(msg) {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 2500)
  }

  const loadPatients = useCallback(async (page = 1, search = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page, limit: 10 })
      if (search) params.set('search', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const data = await fetchWithAuth(`${API_BASE_URL}/patients?${params}`).then(readJson)
      const items = itemsFrom(data)
      setPatients(items)
      if (data.pagination) {
        setPagination(data.pagination)
      } else {
        setPagination({ page, limit: 10, totalItems: items.length, totalPages: 1 })
      }
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách bệnh nhân.')
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    loadPatients(currentPage, searchTerm)
  }, [currentPage, filterStatus, loadPatients])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    appointmentAPI.listAppointments({ date: today, limit: 200 })
      .then((res) => {
        const items = res.data?.data?.items || res.data?.items || []
        setTodayAppointments(items)
      })
      .catch(() => {})
  }, [])

  function handleSearch() {
    setCurrentPage(1)
    loadPatients(1, searchTerm)
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') handleSearch()
  }

  function handleQuickSearch() {
    if (!quickSearch.value.trim()) return
    setSearchTerm(quickSearch.value.trim())
    setCurrentPage(1)
    loadPatients(1, quickSearch.value.trim())
    setQuickSearch({ type: '', value: '' })
  }

  function handleViewDetail(patient) {
    addRecentlyViewed(patient)
    setRecentlyViewed(getRecentlyViewed())
    navigate(`/receptionist/patients/${patient.patient_id}`)
  }

  function handleBookAppointment(patient) {
    navigate('/receptionist/create', { state: { patientId: patient.patient_id, patientName: patient.full_name } })
  }

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (filterGender !== 'all' && p.gender !== filterGender) return false
      if (filterAge !== 'all') {
        const age = calculateAge(p.date_of_birth)
        if (filterAge === 'child' && (age === null || age >= 18)) return false
        if (filterAge === 'adult' && (age === null || age < 18 || age >= 60)) return false
        if (filterAge === 'elderly' && (age === null || age < 60)) return false
      }
      return true
    })
  }, [patients, filterGender, filterAge])

  const totalPatients = pagination.totalItems || patients.length
  const todayCount = todayAppointments.length
  const needUpdateCount = patients.filter((p) => !p.phone || !p.date_of_birth || !p.gender || p.gender === 'unknown').length

  const patientsWithAppointments = useMemo(() => {
    const patientIds = new Set(todayAppointments.map((a) => a.patient_id))
    return patientIds.size
  }, [todayAppointments])

  const doctorMap = useMemo(() => {
    const map = new Map()
    todayAppointments.forEach((a) => {
      if (a.patient_id && a.doctor_name) map.set(a.patient_id, a.doctor_name)
    })
    return map
  }, [todayAppointments])

  const lastVisitMap = useMemo(() => {
    const map = new Map()
    todayAppointments.forEach((a) => {
      if (a.patient_id && a.appointment_time) {
        const existing = map.get(a.patient_id)
        if (!existing || new Date(a.appointment_time) > new Date(existing)) {
          map.set(a.patient_id, a.appointment_time)
        }
      }
    })
    return map
  }, [todayAppointments])

  const totalPages = pagination.totalPages || Math.ceil(totalPatients / 10) || 1
  const pageNumbers = []
  for (let i = 1; i <= Math.min(totalPages, 5); i++) pageNumbers.push(i)

  return (
    <ReceptionistShell
      title="Tìm bệnh nhân"
      subtitle="Tra cứu nhanh thông tin bệnh nhân, hồ sơ và lịch sử khám"
      activeSection="searchPatient"
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onCreateAppointment={() => navigate('/receptionist/create')}
    >
      {notice && <div className="rd-toast">{notice}</div>}
      <div className="rd-content appointment-content">
        <div className="rd-stats">
          <article className="rd-stat purple">
            <div className="rd-stat-head">
              <div className="rd-stat-icon purple"><Icon name="users" /></div>
              <span>Tổng bệnh nhân hôm nay</span>
            </div>
            <div className="rd-stat-body">
              <strong>{totalPatients}</strong>
              <span>Trong hệ thống</span>
            </div>
          </article>
          <article className="rd-stat green">
            <div className="rd-stat-head">
              <div className="rd-stat-icon green"><Icon name="plus" /></div>
              <span>Bệnh nhân mới</span>
            </div>
            <div className="rd-stat-body">
              <strong>{'—'}</strong>
              <span>Đăng ký hôm nay</span>
            </div>
          </article>
          <article className="rd-stat blue">
            <div className="rd-stat-head">
              <div className="rd-stat-icon blue"><Icon name="calendar" /></div>
              <span>Có lịch hẹn hôm nay</span>
            </div>
            <div className="rd-stat-body">
              <strong>{patientsWithAppointments}</strong>
              <span>Bệnh nhân</span>
            </div>
          </article>
          <article className="rd-stat red">
            <div className="rd-stat-head">
              <div className="rd-stat-icon red"><Icon name="warning" /></div>
              <span>Cần cập nhật hồ sơ</span>
            </div>
            <div className="rd-stat-body">
              <strong>{needUpdateCount}</strong>
              <span>Thiếu thông tin</span>
            </div>
          </article>
        </div>

        <div className="appointment-filters">
          <div className="appointment-search-field">
            <Icon name="search" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm theo tên, SDT, mã bệnh nhân, CCCD..."
            />
          </div>
          <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
            <option value="all">Tất cả giới tính</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
          <select value={filterAge} onChange={(e) => setFilterAge(e.target.value)}>
            <option value="all">Tất cả độ tuổi</option>
            <option value="child">Trẻ em (&lt;18)</option>
            <option value="adult">Người lớn (18-59)</option>
            <option value="elderly">Cao tuổi (60+)</option>
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1) }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Không hoạt động</option>
            <option value="archived">Lưu trữ</option>
          </select>
          <button type="button" className="appointment-export" onClick={handleSearch}>
            Xuất danh sách
          </button>
          <button type="button" className="appointment-create" onClick={() => navigate('/receptionist/patients/add')}>
            + Thêm bệnh nhân
          </button>
        </div>

        <div className="appointment-table-card">
          <table className="appointment-table patient-table">
            <thead>
              <tr>
                <th>Mã BN</th>
                <th>Bệnh nhân</th>
                <th>SĐT</th>
                <th>Năm sinh</th>
                <th>Giới tính</th>
                <th>Lần khám gần nhất</th>
                <th>Bác sĩ phụ trách</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="appointment-loading">
                    Đang tải danh sách bệnh nhân...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="9" className="appointment-empty">{error}</td>
                </tr>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => {
                  const age = calculateAge(patient.date_of_birth)
                  const ageStr = age !== null ? `, ${age} tuổi` : ''
                  return (
                    <tr key={patient.patient_id}>
                      <td>
                        <small style={{ color: '#7c8db5', fontSize: '0.78rem' }}>{patient.patient_code}</small>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            className="patient-avatar"
                            style={{
                              width: 32, height: 32, borderRadius: '50%', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                              fontSize: '0.72rem', color: '#fff',
                              background: initialsColor(patient.full_name),
                              flexShrink: 0,
                            }}
                          >
                            {patientInitials(patient.full_name)}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.82rem' }}>{patient.full_name}</strong>
                            <br />
                            <small style={{ color: '#7c8db5' }}>{genderLabel(patient.gender)}{ageStr}</small>
                          </div>
                        </div>
                      </td>
                      <td>{patient.phone || '—'}</td>
                      <td>{getBirthYear(patient.date_of_birth)}</td>
                      <td>{genderLabel(patient.gender)}</td>
                      <td>
                        <small>{formatDate(lastVisitMap.get(patient.patient_id)) || '—'}</small>
                      </td>
                      <td>
                        <small>{doctorMap.get(patient.patient_id) || '—'}</small>
                      </td>
                      <td>
                        <span className={`appt-badge ${statusTone(patient.status)}`}>{statusLabel(patient.status)}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={{
                              fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px',
                              border: 'none', cursor: 'pointer', fontWeight: 600,
                              background: '#dbeafe', color: '#1d4ed8',
                            }}
                            onClick={() => handleViewDetail(patient)}
                          >Chi tiết</button>
                          <button
                            type="button"
                            style={{
                              fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px',
                              border: 'none', cursor: 'pointer', fontWeight: 600,
                              background: '#dcfce7', color: '#166534',
                            }}
                            onClick={() => handleBookAppointment(patient)}
                          >Đặt lịch</button>
                          <button
                            type="button"
                            style={{
                              fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px',
                              border: 'none', cursor: 'pointer', fontWeight: 600,
                              background: '#f3f4f6', color: '#374151',
                            }}
                            onClick={() => navigate(`/receptionist/patient-records/${patient.patient_id}`)}
                          >Hồ sơ</button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="9" className="appointment-empty">Không tìm thấy bệnh nhân phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="appointment-pagination">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', color: '#7c8db5' }}>Hiển thị</span>
            <select
              value={pagination.limit || 10}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #e0e4ef', fontSize: '0.82rem' }}
              onChange={() => {}}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span style={{ fontSize: '0.82rem', color: '#7c8db5' }}>trên trang</span>
          </div>
          <span>
            {filteredPatients.length > 0
              ? `${(currentPage - 1) * 10 + 1}–${Math.min(currentPage * 10, totalPatients)} của ${totalPatients} bệnh nhân`
              : '0 bệnh nhân'
            }
          </span>
          <div>
            <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>‹</button>
            {pageNumbers.map((num) => (
              <button key={num} className={num === currentPage ? 'active' : ''} onClick={() => setCurrentPage(num)}>
                {num}
              </button>
            ))}
            <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>›</button>
          </div>
        </div>
      </div>

      <aside className="rd-right">
        <section className="rd-card-list">
          <header>
            <h2>Tìm nhanh</h2>
          </header>
          <article className="rd-card-action">
            <div>
              <strong>Theo SĐT</strong>
              <p>Tìm theo số điện thoại</p>
            </div>
            <button type="button" onClick={() => setQuickSearch({ type: 'phone', value: '' })}>
              <Icon name="search" />
            </button>
          </article>
          <article className="rd-card-action">
            <div>
              <strong>Theo CCCD</strong>
              <p>Tìm theo số CCCD/CMND</p>
            </div>
            <button type="button" onClick={() => setQuickSearch({ type: 'cccd', value: '' })}>
              <Icon name="search" />
            </button>
          </article>
          <article className="rd-card-action">
            <div>
              <strong>Theo mã BN</strong>
              <p>Tìm theo mã bệnh nhân</p>
            </div>
            <button type="button" onClick={() => setQuickSearch({ type: 'code', value: '' })}>
              <Icon name="search" />
            </button>
          </article>
          {quickSearch.type && (
            <div style={{ padding: '8px 0', display: 'flex', gap: '6px' }}>
              <input
                autoFocus
                value={quickSearch.value}
                onChange={(e) => setQuickSearch((s) => ({ ...s, value: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickSearch() }}
                placeholder={
                  quickSearch.type === 'phone' ? 'Nhập SĐT...'
                    : quickSearch.type === 'cccd' ? 'Nhập CCCD...'
                    : 'Nhập mã BN...'
                }
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: '6px',
                  border: '1px solid #d0d5e3', fontSize: '0.82rem',
                }}
              />
              <button
                type="button"
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: 'none',
                  background: '#4f46e5', color: '#fff', fontWeight: 600,
                  fontSize: '0.78rem', cursor: 'pointer',
                }}
                onClick={handleQuickSearch}
              >Tìm</button>
            </div>
          )}
        </section>

        <section className="rd-card-list">
          <header>
            <h2>Gần đây đã xem</h2>
            {recentlyViewed.length > 0 && (
              <button type="button" onClick={() => showNotice('Xem tất cả')}>Xem tất cả</button>
            )}
          </header>
          {recentlyViewed.length > 0 ? recentlyViewed.slice(0, 5).map((item) => (
            <article key={item.patient_id}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                  fontSize: '0.7rem', color: '#fff', flexShrink: 0,
                  background: initialsColor(item.full_name),
                }}
              >
                {patientInitials(item.full_name)}
              </div>
              <div>
                <strong>{item.full_name}</strong>
                <p>{item.patient_code} • {formatDate(item.viewedAt)}</p>
              </div>
            </article>
          )) : (
            <p className="rd-muted">Chưa xem bệnh nhân nào.</p>
          )}
        </section>
      </aside>
    </ReceptionistShell>
  )
}
