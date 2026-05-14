import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
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

function calculateAge(dob) {
  if (!dob) return null
  const date = new Date(dob)
  if (Number.isNaN(date.getTime())) return null
  return new Date().getFullYear() - date.getFullYear()
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
  return status || '—'
}

function statusTone(status) {
  if (status === 'active') return 'green'
  if (status === 'inactive') return 'orange'
  if (status === 'archived') return 'violet'
  return 'red'
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

export default function ReceptionistPatientRecordsPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [patients, setPatients] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 0 })
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [filterGender, setFilterGender] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const loadPatients = useCallback(async (page = 1, search = '') => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page, limit: 20 })
      if (search) params.set('search', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const data = await fetchWithAuth(`${API_BASE_URL}/patients?${params}`).then(readJson)
      const items = itemsFrom(data)
      setPatients(items)
      if (data.pagination) {
        setPagination(data.pagination)
      } else {
        setPagination({ page, limit: 20, totalItems: items.length, totalPages: 1 })
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

  function handleSearch() {
    setCurrentPage(1)
    loadPatients(1, searchTerm)
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') handleSearch()
  }

  function handleViewDetail(patient) {
    navigate(`/receptionist/patient-records/${patient.patient_id}`)
  }

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      if (filterGender !== 'all' && p.gender !== filterGender) return false
      return true
    })
  }, [patients, filterGender])

  const totalPatients = pagination.totalItems || patients.length
  const totalPages = pagination.totalPages || Math.ceil(totalPatients / 20) || 1
  const pageNumbers = []
  for (let i = 1; i <= Math.min(totalPages, 5); i++) pageNumbers.push(i)

  return (
    <ReceptionistShell
      title="Hồ sơ bệnh nhân"
      subtitle="Danh sách hồ sơ bệnh nhân - Nhấp vào để xem chi tiết"
      activeSection="patientRecords"
    >
      <div className="rd-content appointment-content">
        <div className="appointment-filters">
          <div className="appointment-search-field">
            <Icon name="search" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm theo tên, SDT, mã bệnh nhân..."
            />
          </div>
          <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}>
            <option value="all">Tất cả giới tính</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1) }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Không hoạt động</option>
            <option value="archived">Lưu trữ</option>
          </select>
          <button type="button" className="appointment-create" onClick={handleSearch}>
            Tìm kiếm
          </button>
        </div>

        <div className="appointment-table-card">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#7c8db5' }}>
              Đang tải danh sách hồ sơ...
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#d63b4f' }}>
              {error}
            </div>
          ) : filteredPatients.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#7c8db5' }}>
              Không tìm thấy hồ sơ bệnh nhân nào.
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', padding: '16px' }}>
                {filteredPatients.map((patient) => {
                  const age = calculateAge(patient.date_of_birth)
                  return (
                    <div
                      key={patient.patient_id}
                      onClick={() => handleViewDetail(patient)}
                      style={{
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid #e0e4ef',
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(57, 68, 118, 0.04)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(57, 68, 118, 0.12)'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(57, 68, 118, 0.04)'
                        e.currentTarget.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '16px',
                            color: '#fff',
                            background: initialsColor(patient.full_name),
                            flexShrink: 0,
                          }}
                        >
                          {patientInitials(patient.full_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#121a3f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {patient.full_name}
                            </h4>
                            {patient.is_vip && (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: 800,
                                background: '#ffd700',
                                color: '#121a3f',
                                padding: '2px 6px',
                                borderRadius: '999px',
                                flexShrink: 0,
                              }}>VIP</span>
                            )}
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#7c8db5' }}>
                            {patient.patient_code}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px', fontSize: '12px' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '10px', color: '#7c8db5' }}>Tuổi</p>
                          <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                            {age !== null ? `${age} tuổi` : '—'}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '10px', color: '#7c8db5' }}>Giới tính</p>
                          <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                            {genderLabel(patient.gender)}
                          </p>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <p style={{ margin: 0, fontSize: '10px', color: '#7c8db5' }}>Điện thoại</p>
                          <p style={{ margin: 0, fontWeight: 600, color: '#121a3f', fontSize: '11px' }}>
                            {patient.phone || '—'}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', paddingTop: '12px', borderTop: '1px solid #f0f2f7' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          background: `${statusTone(patient.status) === 'green' ? '#e6f9ef' : statusTone(patient.status) === 'orange' ? '#fff3e8' : '#fff1f3'}`,
                          color: `${statusTone(patient.status) === 'green' ? '#14a36a' : statusTone(patient.status) === 'orange' ? '#f28f22' : '#d63b4f'}`,
                        }}>
                          {statusLabel(patient.status)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', padding: '16px', borderTop: '1px solid #e0e4ef' }}>
                  {pageNumbers.map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        border: page === currentPage ? 'none' : '1px solid #e0e4ef',
                        background: page === currentPage ? '#514bff' : '#fff',
                        color: page === currentPage ? '#fff' : '#34446a',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ReceptionistShell>
  )
}
