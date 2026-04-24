import { useEffect, useState } from 'react'
import { authAPI } from '../utils/api'
import DoctorProfilePage from './DoctorProfilePage'

function getApiErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback
}

function getInitials(name = '') {
  return String(name || '')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
}

export function DoctorProfileScreen({ user }) {
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    specialization: '',
    licenseNumber: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [sessions, setSessions] = useState([])
  const [loginHistory, setLoginHistory] = useState([])
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const doctorName = user?.fullName || user?.full_name || user?.email?.split('@')[0] || 'Bác sĩ'
  const avatarText = getInitials(doctorName) || 'BS'
  const doctorId = user?.doctorCode || user?.doctorId || user?.employee_code || 'Chưa cấp mã'

  // Initialize profile form with user data
  useEffect(() => {
    setProfileForm((current) => ({
      ...current,
      fullName: user?.fullName || user?.full_name || '',
      phone: user?.phone || '',
      email: user?.email || '',
      address: user?.address || current.address || '',
      specialization: user?.specialization || current.specialization || '',
      licenseNumber: user?.licenseNumber || current.licenseNumber || '',
    }))
  }, [user?.fullName, user?.full_name, user?.phone, user?.email])

  // Load sessions and login history
  async function loadAccountCollections() {
    if (!user) {
      setSessions([])
      setLoginHistory([])
      setAccountLoading(false)
      return
    }

    setAccountLoading(true)
    setAccountError('')

    try {
      const [sessionsResponse, historyResponse] = await Promise.all([
        authAPI.getMySessions(),
        authAPI.getLoginHistory({ limit: 10 }),
      ])

      setSessions(sessionsResponse.data?.data?.items || [])
      setLoginHistory(historyResponse.data?.data?.items || [])
    } catch (error) {
      setAccountError(getApiErrorMessage(error, 'Không thể tải dữ liệu tài khoản.'))
    } finally {
      setAccountLoading(false)
    }
  }

  useEffect(() => {
    loadAccountCollections()
  }, [user?.id])

  const handleFieldChange = (field) => (event) => {
    setFeedback(null)
    setProfileForm((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  const handlePasswordFieldChange = (field) => (event) => {
    setFeedback(null)
    setPasswordForm((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()
    setProfileSaving(true)
    setFeedback(null)

    try {
      // TODO: Replace with actual doctor profile update API
      // await doctorAPI.updateMyProfile(profileForm)
      
      setFeedback({ type: 'success', text: 'Đã cập nhật hồ sơ bác sĩ.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể cập nhật hồ sơ bác sĩ.'),
      })
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSave = async (event) => {
    event.preventDefault()
    setPasswordSaving(true)
    setFeedback(null)

    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
      })

      setFeedback({ type: 'success', text: 'Đã cập nhật mật khẩu.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể cập nhật mật khẩu.'),
      })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    setFeedback(null)

    try {
      await authAPI.logoutAllDevices()
      setFeedback({ type: 'success', text: 'Đã đăng xuất tất cả thiết bị.' })
      loadAccountCollections()
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể đăng xuất tất cả thiết bị.'),
      })
    }
  }

  const handleRevokeSession = async (sessionId) => {
    try {
      await authAPI.revokeSession(sessionId)
      setSessions((current) => current.filter((session) => session.id !== sessionId))
      setFeedback({ type: 'success', text: 'Đã hủy phiên làm việc.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể hủy phiên làm việc.'),
      })
    }
  }

  return (
    <DoctorProfilePage
      accountError={accountError}
      activeSessionCount={sessions.filter((s) => !s.revokedAt).length}
      avatarText={avatarText}
      feedback={feedback}
      loginHistory={loginHistory}
      onFieldChange={handleFieldChange}
      onLogoutAllDevices={handleLogoutAllDevices}
      onPasswordFieldChange={handlePasswordFieldChange}
      onPasswordSave={handlePasswordSave}
      onProfileSave={handleProfileSave}
      onRevokeSession={handleRevokeSession}
      passwordForm={passwordForm}
      passwordSaving={passwordSaving}
      doctorId={doctorId}
      doctorName={doctorName}
      doctorProfile={null}
      profileForm={profileForm}
      profileSaving={profileSaving}
      sessions={sessions}
      sessionsLoading={accountLoading}
      user={user}
    />
  )
}
