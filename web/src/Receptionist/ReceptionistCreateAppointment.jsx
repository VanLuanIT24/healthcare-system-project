import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import { appointmentAPI } from '../utils/api'
import { clearStoredAuth, readStoredAuth } from '../lib/storage'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

const menuGroups = [
  { title: '', items: [{ key: 'dashboard', label: 'Tổng quan', icon: 'home' }] },
  {
    title: 'Lịch & đặt lịch',
    items: [
      { key: 'appointments', label: 'Lịch hẹn', icon: 'calendar' },
      { key: 'createAppointment', label: 'Đặt lịch mới', icon: 'plus' },
      { key: 'waitingList', label: 'Lịch chờ', icon: 'calendar', count: 12 },
      { key: 'queue', label: 'Danh sách chờ', icon: 'queue' },
    ],
  },
  {
    title: 'Bệnh nhân',
    items: [
      { key: 'searchPatient', label: 'Tìm bệnh nhân', icon: 'search' },
      { key: 'patientRecords', label: 'Hồ sơ bệnh nhân', icon: 'patient' },
      { key: 'vipPatients', label: 'Khách hàng thân thiết', icon: 'star' },
    ],
  },
  {
    title: 'Thanh toán',
    items: [
      { key: 'cashier', label: 'Thu ngân', icon: 'wallet' },
      { key: 'paymentHistory', label: 'Lịch sử thanh toán', icon: 'receipt' },
    ],
  },
  { title: 'Báo cáo', items: [{ key: 'dailyReport', label: 'Báo cáo ngày', icon: 'chart' }, { key: 'productivity', label: 'Hiệu suất làm việc', icon: 'trend' }] },
  { title: 'Cài đặt', items: [{ key: 'settings', label: 'Cài đặt hệ thống', icon: 'settings' }, { key: 'users', label: 'Quản lý người dùng', icon: 'users' }] },
]

const specialtyOptions = [
  'Nội tổng quát',
  'Tim mạch',
  'Nhi khoa',
  'Tai mũi họng',
  'Ngoại khoa',
]

const serviceCatalog = {
  'Nội tổng quát': ['Khám nội tổng quát', 'Khám nội tiết', 'Siêu âm tổng quát'],
  'Tim mạch': ['Khám tim mạch', 'Siêu âm tim', 'Điện tâm đồ'],
  'Nhi khoa': ['Khám nhi', 'Tiêm chủng', 'Tư vấn dinh dưỡng'],
  'Tai mũi họng': ['Khám tai mũi họng', 'Nội soi mũi họng', 'Tư vấn dị ứng'],
  'Ngoại khoa': ['Khám ngoại khoa', 'Khâu vết thương', 'Tư vấn phẫu thuật'],
}

const sessionTimes = {
  morning: ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
  afternoon: ['13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'],
}

const genderOptions = [
  { value: 'female', label: 'Nữ' },
  { value: 'male', label: 'Nam' },
  { value: 'other', label: 'Khác' },
]

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function readJson(response) {
  return response
    .json()
    .then((payload) => {
      if (!response.ok) {
        throw new Error(payload?.message || 'Không thể tải dữ liệu từ máy chủ.')
      }
      return payload?.data || payload
    })
}

function formatAppointmentDate(value) {
  if (!value) return 'Chưa chọn'
  const date = new Date(value)
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export default function ReceptionistCreateAppointmentPage() {
  const navigate = useNavigate()
  const auth = readStoredAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [patients, setPatients] = useState([])
  const [doctors, setDoctors] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientForm, setPatientForm] = useState({
    full_name: '',
    phone: '',
    dob: '',
    gender: 'female',
    identification: '',
    patient_code: '',
    address: '',
    notes: '',
  })
  const [selectedSpecialty, setSelectedSpecialty] = useState('Nội tổng quát')
  const [selectedService, setSelectedService] = useState(serviceCatalog['Nội tổng quát'][0])
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [selectedSession, setSelectedSession] = useState('morning')
  const [selectedTime, setSelectedTime] = useState('09:00')
  const [selectedRoom, setSelectedRoom] = useState('PK 1')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const [patientsResponse, doctorsResponse] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/patients?limit=200`),
          fetchWithAuth(`${API_BASE_URL}/staff/doctors?limit=100`),
        ])

        const patientPayload = await readJson(patientsResponse)
        const doctorPayload = await readJson(doctorsResponse)

        const patientItems = Array.isArray(patientPayload) ? patientPayload : patientPayload.items || []
        const doctorItems = Array.isArray(doctorPayload) ? doctorPayload : doctorPayload.items || []

        setPatients(patientItems)
        setDoctors(doctorItems)
        if (doctorItems.length > 0) {
          setSelectedDoctorId(doctorItems[0].user_id)
        }
      } catch (loadError) {
        setError(loadError.message || 'Không thể tải dữ liệu bác sĩ và bệnh nhân.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const services = serviceCatalog[selectedSpecialty] || []
    setSelectedService(services[0] || '')
  }, [selectedSpecialty])

  const filteredPatients = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase()
    if (!lower) return patients
    return patients.filter((patient) => {
      return [patient.full_name, patient.phone, patient.patient_code]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(lower))
    })
  }, [patients, searchTerm])

  const selectedDoctor = useMemo(() => doctors.find((item) => item.user_id === selectedDoctorId), [doctors, selectedDoctorId])
  const availableTimes = sessionTimes[selectedSession] || []

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient)
    setPatientForm({
      full_name: patient.full_name || '',
      phone: patient.phone || '',
      dob: '',
      gender: 'female',
      identification: patient.patient_code || '',
      patient_code: patient.patient_code || '',
      address: patient.address || '',
      notes: '',
    })
  }

  const handlePatientFieldChange = (field) => (event) => {
    setPatientForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selectedPatient) {
      setError('Vui lòng chọn bệnh nhân trước khi đặt lịch.')
      return
    }
    if (!selectedDoctor) {
      setError('Vui lòng chọn bác sĩ.')
      return
    }
    setError('')
    setMessage('')
    setSaving(true)

    try {
      const appointmentTime = `${selectedDate}T${selectedTime}:00`
      await appointmentAPI.createAppointmentByStaff({
        patient_id: selectedPatient._id || selectedPatient.patient_id,
        doctor_id: selectedDoctor.user_id,
        department_id: selectedDoctor.department_id,
        appointment_time: appointmentTime,
        appointment_type: 'outpatient',
        reason: selectedService,
        notes: patientForm.notes,
      })
      setMessage('Lưu lịch hẹn thành công. Đang chuyển sang trang lịch hẹn...')
      window.setTimeout(() => navigate('/receptionist/appointments'), 1500)
    } catch (submitError) {
      setError(submitError?.response?.data?.message || submitError?.message || 'Không thể đặt lịch mới ngay bây giờ.')
    } finally {
      setSaving(false)
    }
  }

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
      setSearchTerm('')
      return
    }
    navigate('/receptionist')
  }

  function handleLogout() {
    clearStoredAuth()
    navigate('/staff/login', { replace: true })
  }

  return (
    <ReceptionistShell
      title="Đặt lịch mới"
      subtitle="Tạo lịch khám mới cho bệnh nhân nhanh chóng và chính xác"
      activeSection="createAppointment"
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      onCreateAppointment={() => navigate('/receptionist/create')}
    >
      <div className="rd-content appointment-content create-appointment-content">
          <div className="create-main-panel">
            <div className="create-steps">
              <div className="create-step active">
                <strong>01</strong>
                <span>Thông tin bệnh nhân</span>
              </div>
              <div className="create-step">
                <strong>02</strong>
                <span>Thông tin khám</span>
              </div>
              <div className="create-step">
                <strong>03</strong>
                <span>Xác nhận lịch hẹn</span>
              </div>
            </div>

            <form className="create-form" onSubmit={handleSubmit}>
              <section className="form-card">
                <header>
                  <div>
                    <span className="form-step-label">1</span>
                    <div>
                      <h2>Thông tin bệnh nhân</h2>
                      <p>Nhập hoặc chọn thông tin bệnh nhân để tạo lịch mới.</p>
                    </div>
                  </div>
                </header>

                <div className="patient-search-results">
                  {searchTerm && filteredPatients.length > 0 ? (
                    filteredPatients.slice(0, 5).map((patient) => (
                      <button
                        type="button"
                        key={patient._id || patient.patient_id}
                        className={`patient-item ${selectedPatient && (selectedPatient._id || selectedPatient.patient_id) === (patient._id || patient.patient_id) ? 'selected' : ''}`}
                        onClick={() => handlePatientSelect(patient)}
                      >
                        <div>{patient.full_name || 'Bệnh nhân'}</div>
                        <small>{patient.phone || patient.patient_code}</small>
                      </button>
                    ))
                  ) : searchTerm ? (
                    <div className="empty-search">Không tìm thấy bệnh nhân phù hợp.</div>
                  ) : (
                    <div className="empty-search">Nhập tên, số điện thoại hoặc mã bệnh nhân để chọn bệnh nhân.</div>
                  )}
                </div>

                <div className="create-form-grid">
                  <label>
                    Họ và tên *
                    <input value={patientForm.full_name} onChange={handlePatientFieldChange('full_name')} placeholder="Nguyễn Thị Lan" />
                  </label>
                  <label>
                    Số điện thoại *
                    <input value={patientForm.phone} onChange={handlePatientFieldChange('phone')} placeholder="0912 345 678" />
                  </label>
                  <label>
                    Ngày sinh
                    <input type="date" value={patientForm.dob} onChange={handlePatientFieldChange('dob')} />
                  </label>
                  <label>
                    Giới tính
                    <select value={patientForm.gender} onChange={handlePatientFieldChange('gender')}>
                      {genderOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    BHYT / CCCD
                    <input value={patientForm.identification} onChange={handlePatientFieldChange('identification')} placeholder="012345678901" />
                  </label>
                  <label>
                    Mã bệnh nhân
                    <input value={patientForm.patient_code} onChange={handlePatientFieldChange('patient_code')} placeholder="BN25050017" />
                  </label>
                  <label className="full-width">
                    Địa chỉ
                    <input value={patientForm.address} onChange={handlePatientFieldChange('address')} placeholder="123 Nguyễn Trãi, Hà Nội" />
                  </label>
                  <label className="full-width">
                    Ghi chú
                    <textarea value={patientForm.notes} onChange={handlePatientFieldChange('notes')} placeholder="Nhập ghi chú về bệnh nhân (nếu có)..." rows="3" />
                  </label>
                </div>
              </section>

              <section className="form-card">
                <header>
                  <div>
                    <span className="form-step-label">2</span>
                    <div>
                      <h2>Thông tin khám</h2>
                      <p>Chọn chuyên khoa, bác sĩ và thời gian khám phù hợp.</p>
                    </div>
                  </div>
                </header>

                <div className="create-form-grid">
                  <label>
                    Chuyên khoa *
                    <select value={selectedSpecialty} onChange={(event) => setSelectedSpecialty(event.target.value)}>
                      {specialtyOptions.map((specialty) => (
                        <option key={specialty} value={specialty}>{specialty}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Dịch vụ *
                    <select value={selectedService} onChange={(event) => setSelectedService(event.target.value)}>
                      {(serviceCatalog[selectedSpecialty] || []).map((service) => (
                        <option key={service} value={service}>{service}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Bác sĩ *
                    <select value={selectedDoctorId} onChange={(event) => setSelectedDoctorId(event.target.value)}>
                      {doctors.map((doctor) => (
                        <option key={doctor.user_id} value={doctor.user_id}>
                          {doctor.full_name} {doctor.department_name ? `– ${doctor.department_name}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Ngày khám *
                    <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                  </label>
                  <label>
                    Buổi khám
                    <select value={selectedSession} onChange={(event) => setSelectedSession(event.target.value)}>
                      <option value="morning">Sáng (07:30 - 11:30)</option>
                      <option value="afternoon">Chiều (13:30 - 17:00)</option>
                    </select>
                  </label>
                  <label>
                    Phòng khám
                    <input value={selectedRoom} onChange={(event) => setSelectedRoom(event.target.value)} />
                  </label>
                </div>

                <div className="slot-panel">
                  <h3>Chọn giờ khám</h3>
                  <div className="slot-grid">
                    {availableTimes.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className={`slot-button ${selectedTime === slot ? 'selected' : ''}`}
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="form-actions">
                {error && <div className="form-error">{error}</div>}
                {message && <div className="form-success">{message}</div>}
                <div className="form-buttons">
                  <button type="button" className="secondary" onClick={() => navigate('/receptionist/appointments')}>
                    Hủy
                  </button>
                  <button type="button" className="secondary" disabled>
                    Lưu nháp
                  </button>
                  <button type="submit" className="primary" disabled={saving}>
                    {saving ? 'Đang lưu...' : 'Lưu lịch hẹn'}
                  </button>
                </div>
              </section>
            </form>
          </div>

          <aside className="create-summary-panel">
            <div className="summary-card">
              <div className="summary-status">Còn trống</div>
              <h3>Tóm tắt lịch hẹn</h3>
              <div className="summary-row">
                <span>Bệnh nhân</span>
                <strong>{patientForm.full_name || 'Chưa chọn bệnh nhân'}</strong>
              </div>
              <div className="summary-row">
                <span>SDT</span>
                <strong>{patientForm.phone || '—'}</strong>
              </div>
              <div className="summary-row">
                <span>Dịch vụ</span>
                <strong>{selectedService}</strong>
              </div>
              <div className="summary-row">
                <span>Bác sĩ</span>
                <strong>{selectedDoctor?.full_name || 'Chưa chọn bác sĩ'}</strong>
              </div>
              <div className="summary-row">
                <span>Phòng khám</span>
                <strong>{selectedRoom}</strong>
              </div>
              <div className="summary-row">
                <span>Thời gian</span>
                <strong>{formatAppointmentDate(selectedDate)} · {selectedTime}</strong>
              </div>
              <div className="summary-row summary-price">
                <span>Giá dịch vụ</span>
                <strong>250.000 ₫</strong>
              </div>
              <p className="summary-note">Vui lòng kiểm tra kỹ thông tin trước khi lưu lịch hẹn.</p>
            </div>
          </aside>
        </div>
      </ReceptionistShell>
  )
}
