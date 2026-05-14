import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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

function formatDateTime(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date)
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

export default function ReceptionistPatientDetailPage() {
  const navigate = useNavigate()
  const { patientId } = useParams()
  const [patient, setPatient] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [notice, setNotice] = useState('')

  function showNotice(msg) {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 2500)
  }

  useEffect(() => {
    const loadPatientData = async () => {
      setLoading(true)
      setError('')
      try {
        const patientRes = await fetchWithAuth(`${API_BASE_URL}/patients/${patientId}`).then(readJson)
        setPatient(patientRes.patient || patientRes)

        const [appointmentsRes, prescriptionsRes] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/appointments?patient_id=${patientId}&limit=100`).then(readJson).catch(() => []),
          fetchWithAuth(`${API_BASE_URL}/prescriptions/patient/${patientId}`).then(readJson).catch(() => []),
        ])

        setAppointments(itemsFrom(appointmentsRes))
        setPrescriptions(itemsFrom(prescriptionsRes))
      } catch (err) {
        setError(err.message || 'Không thể tải thông tin bệnh nhân.')
      } finally {
        setLoading(false)
      }
    }

    if (patientId) loadPatientData()
  }, [patientId])

  if (loading) {
    return (
      <ReceptionistShell title="Chi tiết bệnh nhân" activeSection="searchPatient">
        <div className="rd-content" style={{ textAlign: 'center', padding: '40px' }}>
          Đang tải thông tin bệnh nhân...
        </div>
      </ReceptionistShell>
    )
  }

  if (error || !patient) {
    return (
      <ReceptionistShell title="Chi tiết bệnh nhân" activeSection="searchPatient">
        <div className="rd-content" style={{ textAlign: 'center', padding: '40px', color: '#d63b4f' }}>
          {error || 'Không tìm thấy bệnh nhân.'}
        </div>
      </ReceptionistShell>
    )
  }

  const age = calculateAge(patient.date_of_birth)
  const recentAppointments = appointments.slice(0, 4)
  const recentPrescriptions = prescriptions.slice(0, 3)

  const tabs = [
    { key: 'overview', label: 'Tổng quan', icon: 'home' },
    { key: 'history', label: 'Lịch sử khám', icon: 'calendar' },
    { key: 'prescriptions', label: 'Đơn thuốc', icon: 'file' },
    { key: 'tests', label: 'Xét nghiệm', icon: 'lab' },
    { key: 'documents', label: 'Tài liệu', icon: 'document' },
    { key: 'billing', label: 'Thanh toán', icon: 'wallet' },
  ]

  return (
    <ReceptionistShell title="Chi tiết bệnh nhân" activeSection="searchPatient">
      {notice && <div className="rd-toast">{notice}</div>}
      <div className="rd-content appointment-content">
        {/* Header */}
        <div className="appointment-table-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '20px',
                  color: '#fff',
                  background: initialsColor(patient.full_name),
                  flexShrink: 0,
                }}
              >
                {patientInitials(patient.full_name)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', color: '#121a3f' }}>{patient.full_name}</h2>
                  {patient.is_vip && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      background: '#ffd700',
                      color: '#121a3f',
                      padding: '2px 8px',
                      borderRadius: '999px',
                    }}>VIP</span>
                  )}
                </div>
                <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#7c8db5' }}>
                  {patient.patient_code}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#7c8db5' }}>
                  {age && `${age} tuổi`} • {genderLabel(patient.gender)}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#514bff',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/receptionist/create', { state: { patientId: patient.patient_id, patientName: patient.full_name } })}
              >
                <Icon name="calendar" /> Đặt lịch
              </button>
              <button
                type="button"
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#10b981',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/receptionist/patient-records/${patient.patient_id}`)}
              >
                <Icon name="file" /> Xem hồ sơ
              </button>
              <button
                type="button"
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e4ef',
                  background: '#fff',
                  color: '#34446a',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => showNotice('Sẽ in hồ sơ')}
              >
                <Icon name="printer" /> In hồ sơ
              </button>
              <button
                type="button"
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e4ef',
                  background: '#fff',
                  color: '#34446a',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => showNotice('Sẽ mở form chỉnh sửa')}
              >
                <Icon name="edit" /> Chỉnh sửa
              </button>
              <button
                type="button"
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e0e4ef',
                  background: '#fff',
                  color: '#34446a',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={() => navigate('/receptionist/patients')}
              >
                ← Quay lại
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #e0e4ef', marginBottom: '20px' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '12px 0',
                border: 'none',
                borderBottom: activeTab === tab.key ? '3px solid #514bff' : 'none',
                background: 'transparent',
                color: activeTab === tab.key ? '#514bff' : '#7c8db5',
                fontSize: '12px',
                fontWeight: activeTab === tab.key ? 700 : 600,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Left Column */}
            <div>
              {/* Thông tin cá nhân */}
              <div className="appointment-table-card" style={{ padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#121a3f' }}>
                  Thông tin cá nhân
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Ngày sinh</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {formatDate(patient.date_of_birth)}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>CCCD/BHYT</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.national_id || '—'}
                    </p>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Địa chỉ</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.address || '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Số điện thoại</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.phone || '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Email</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.email || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thông tin y tế */}
              <div className="appointment-table-card" style={{ padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#121a3f' }}>
                  Thông tin y tế
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Dị ứng</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.allergies || 'Không ghi nhận'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Bệnh nền</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.chronic_conditions || 'Tăng huyết áp'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Chiều cao</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.height ? `${patient.height} cm` : '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Cân nặng</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.weight ? `${patient.weight} kg` : '—'}
                    </p>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Huyết áp</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.blood_pressure || '—'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, color: '#7c8db5', fontSize: '11px' }}>Nhóm máu</p>
                    <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                      {patient.blood_type || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div>
              {/* Lịch sử khám gần đây */}
              <div className="appointment-table-card" style={{ padding: '16px', marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#121a3f' }}>
                  Lịch sử khám gần đây
                </h4>
                {recentAppointments.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recentAppointments.map((appt) => (
                      <div key={appt._id || appt.id} style={{ padding: '8px', borderRadius: '6px', background: '#f6f8ff', fontSize: '11px' }}>
                        <p style={{ margin: 0, fontWeight: 600, color: '#121a3f' }}>
                          {formatDate(appt.appointment_time)}
                        </p>
                        <p style={{ margin: '2px 0 0', color: '#7c8db5' }}>
                          {appt.doctor_name || 'BS —'} • {appt.reason || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#7c8db5' }}>Chưa có lịch khám nào.</p>
                )}
              </div>

              {/* Liên hệ khẩn cấp */}
              <div className="appointment-table-card" style={{ padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#121a3f' }}>
                  Liên hệ khẩn cấp
                </h4>
                <div style={{ fontSize: '12px' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#121a3f' }}>
                    {patient.emergency_contact || '—'}
                  </p>
                  <p style={{ margin: 0, color: '#7c8db5' }}>
                    {patient.emergency_phone || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="appointment-table-card">
            <table className="appointment-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ngày khám</th>
                  <th>Bác sĩ</th>
                  <th>Chẩn đoán</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length > 0 ? (
                  appointments.map((appt) => (
                    <tr key={appt._id || appt.id}>
                      <td>{formatDateTime(appt.appointment_time)}</td>
                      <td>{appt.doctor_name || '—'}</td>
                      <td>{appt.reason || '—'}</td>
                      <td>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: '#edf2ff',
                          color: '#2546ff',
                        }}>
                          {appt.status || 'booked'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#7c8db5' }}>
                      Chưa có lịch khám nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'prescriptions' && (
          <div className="appointment-table-card">
            <table className="appointment-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ngày cấp</th>
                  <th>Bác sĩ</th>
                  <th>Số lượng thuốc</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.length > 0 ? (
                  prescriptions.map((presc) => (
                    <tr key={presc._id || presc.id}>
                      <td>{formatDate(presc.created_at || presc.date)}</td>
                      <td>{presc.doctor_name || '—'}</td>
                      <td>{presc.medicines?.length || 0}</td>
                      <td>{presc.notes || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#7c8db5' }}>
                      Chưa có đơn thuốc nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {(activeTab === 'tests' || activeTab === 'documents' || activeTab === 'billing') && (
          <div className="appointment-table-card" style={{ padding: '40px', textAlign: 'center', color: '#7c8db5' }}>
            <p style={{ fontSize: '12px' }}>Tính năng này sẽ được thêm trong phiên bản tiếp theo.</p>
          </div>
        )}
      </div>
    </ReceptionistShell>
  )
}
