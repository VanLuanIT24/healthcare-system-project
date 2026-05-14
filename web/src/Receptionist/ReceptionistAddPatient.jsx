import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import ReceptionistShell from './ReceptionistShell'
import './receptionist.css'

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function toDateInputValue(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString().slice(0, 10)
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.message || 'Không thể lưu dữ liệu.')
  return payload?.data || payload
}

export default function ReceptionistAddPatientPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [touched, setTouched] = useState({})

  const [formData, setFormData] = useState({
    full_name: '',
    patient_code: '',
    date_of_birth: '',
    gender: 'male',
    phone: '',
    email: '',
    address: '',
    national_id: '',
    insurance_number: '',
    emergency_contact: '',
    emergency_phone: '',
    notes: '',
  })

  function showNotice(msg) {
    setNotice(msg)
    window.setTimeout(() => setNotice(''), 3000)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function handleBlur(e) {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  const getFieldError = (fieldName) => {
    if (!touched[fieldName]) return ''
    const field = formData[fieldName]
    if (fieldName === 'full_name' && !field.trim()) return 'Vui lòng nhập tên bệnh nhân'
    if (fieldName === 'phone' && field && !/^[0-9]{9,11}$/.test(field.replace(/\D/g, ''))) return 'Số điện thoại không hợp lệ'
    if (fieldName === 'email' && field && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field)) return 'Email không hợp lệ'
    if (fieldName === 'date_of_birth' && !field) return 'Vui lòng nhập ngày sinh'
    if (fieldName === 'national_id' && field && !/^[0-9]{9,12}$/.test(field.replace(/\D/g, ''))) return 'CCCD/CMND không hợp lệ'
    return ''
  }

  const isFormValid = useCallback(() => {
    return (
      formData.full_name.trim() &&
      formData.date_of_birth &&
      formData.gender &&
      (!formData.phone || /^[0-9]{9,11}$/.test(formData.phone.replace(/\D/g, ''))) &&
      (!formData.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) &&
      (!formData.national_id || /^[0-9]{9,12}$/.test(formData.national_id.replace(/\D/g, '')))
    )
  }, [formData])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Mark all fields as touched
    const allTouched = {}
    Object.keys(formData).forEach((key) => {
      allTouched[key] = true
    })
    setTouched(allTouched)

    if (!isFormValid()) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        national_id: formData.national_id.trim() || null,
        insurance_number: formData.insurance_number.trim() || null,
        emergency_contact: formData.emergency_contact.trim() || null,
        emergency_phone: formData.emergency_phone.trim() || null,
        notes: formData.notes.trim() || null,
      }

      const response = await fetchWithAuth(`${API_BASE_URL}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await readJson(response)
      showNotice(`Đã thêm bệnh nhân: ${formData.full_name}`)
      setTimeout(() => {
        navigate('/receptionist/patients')
      }, 1500)
    } catch (err) {
      setError(err.message || 'Không thể thêm bệnh nhân.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    navigate('/receptionist/patients')
  }

  return (
    <ReceptionistShell
      title="Thêm bệnh nhân mới"
      subtitle="Nhập thông tin để đăng ký bệnh nhân mới vào hệ thống"
      activeSection="searchPatient"
    >
      {notice && <div className="rd-toast">{notice}</div>}
      <div className="rd-content appointment-content">
        <div className="appointment-filters">
          <h3 style={{ margin: '0 0 16px', color: '#121a3f' }}>Thông tin cơ bản</h3>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="appointment-table-card" style={{ padding: '20px' }}>
            {error && (
              <div style={{
                marginBottom: '16px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#fff1f3',
                color: '#d63b4f',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                  Họ và tên <span style={{ color: '#d63b4f' }}>*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Nhập tên bệnh nhân"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${getFieldError('full_name') ? '#d63b4f' : '#e0e4ef'}`,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                />
                {getFieldError('full_name') && (
                  <small style={{ display: 'block', marginTop: '4px', color: '#d63b4f' }}>{getFieldError('full_name')}</small>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                  Ngày sinh <span style={{ color: '#d63b4f' }}>*</span>
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${getFieldError('date_of_birth') ? '#d63b4f' : '#e0e4ef'}`,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                />
                {getFieldError('date_of_birth') && (
                  <small style={{ display: 'block', marginTop: '4px', color: '#d63b4f' }}>{getFieldError('date_of_birth')}</small>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                  Giới tính <span style={{ color: '#d63b4f' }}>*</span>
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e0e4ef',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="0123456789"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${getFieldError('phone') ? '#d63b4f' : '#e0e4ef'}`,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                />
                {getFieldError('phone') && (
                  <small style={{ display: 'block', marginTop: '4px', color: '#d63b4f' }}>{getFieldError('phone')}</small>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="example@email.com"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${getFieldError('email') ? '#d63b4f' : '#e0e4ef'}`,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                />
                {getFieldError('email') && (
                  <small style={{ display: 'block', marginTop: '4px', color: '#d63b4f' }}>{getFieldError('email')}</small>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                  CCCD/CMND
                </label>
                <input
                  type="text"
                  name="national_id"
                  value={formData.national_id}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="123456789012"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: `1px solid ${getFieldError('national_id') ? '#d63b4f' : '#e0e4ef'}`,
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                />
                {getFieldError('national_id') && (
                  <small style={{ display: 'block', marginTop: '4px', color: '#d63b4f' }}>{getFieldError('national_id')}</small>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                Địa chỉ
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Nhập địa chỉ"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e0e4ef',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                  Số BHYT
                </label>
                <input
                  type="text"
                  name="insurance_number"
                  value={formData.insurance_number}
                  onChange={handleChange}
                  placeholder="Nhập số BHYT"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e0e4ef',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                  Liên hệ khẩn cấp
                </label>
                <input
                  type="text"
                  name="emergency_contact"
                  value={formData.emergency_contact}
                  onChange={handleChange}
                  placeholder="Tên người liên hệ"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e0e4ef',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                SĐT khẩn cấp
              </label>
              <input
                type="tel"
                name="emergency_phone"
                value={formData.emergency_phone}
                onChange={handleChange}
                placeholder="Số điện thoại liên hệ"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e0e4ef',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#121a3f' }}>
                Ghi chú
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Thêm ghi chú nếu cần..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e0e4ef',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleCancel}
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
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? '#ccc' : '#514bff',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Đang lưu...' : 'Thêm bệnh nhân'}
            </button>
          </div>
        </form>
      </div>
    </ReceptionistShell>
  )
}
