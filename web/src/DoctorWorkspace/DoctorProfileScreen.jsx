import { useEffect, useState } from 'react'
import { useAuth } from './doctorAuth'
import { useToast } from './toast/ToastProvider'
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

function getProfileFromResponse(response) {
  return response?.data?.data?.profile || response?.data?.data?.user || response?.data?.data || null
}

export function DoctorProfileScreen({ user }) {
  const { refreshProfile } = useAuth()
  const toast = useToast()
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
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  const doctorName = user?.fullName || user?.full_name || user?.email?.split('@')[0] || 'Bác sĩ'
  const avatarText = getInitials(doctorName) || 'BS'
  const doctorId = user?.doctorCode || user?.doctorId || user?.employee_code || 'Chưa cấp mã'

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

  async function loadAccountCollections() {
    if (!user) {
      setSessions([])
      setLoginHistory([])
      setAccountLoading(false)
      return
    }

    setAccountLoading(true)

    try {
      const [sessionsResponse, historyResponse] = await Promise.all([
        authAPI.getMySessions(),
        authAPI.getLoginHistory({ limit: 10 }),
      ])

      setSessions(sessionsResponse.data?.data?.items || [])
      setLoginHistory(historyResponse.data?.data?.items || [])
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải dữ liệu tài khoản.'))
    } finally {
      setAccountLoading(false)
    }
  }

  useEffect(() => {
    loadAccountCollections()
  }, [user?.id])

  const handleFieldChange = (field) => (event) => {
    setProfileForm((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  const handlePasswordFieldChange = (field) => (event) => {
    setPasswordForm((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()
    setProfileSaving(true)

    try {
      const payload = {
        full_name: String(profileForm.fullName || '').trim(),
        email: String(profileForm.email || '').trim(),
        phone: String(profileForm.phone || '').trim(),
      }

      if (!payload.full_name) {
        throw new Error('Họ và tên là bắt buộc.')
      }

      const response = await authAPI.updateMyProfile(payload)
      const responseProfile = getProfileFromResponse(response)
      let latestProfile = responseProfile

      try {
        latestProfile = (await refreshProfile()) || responseProfile
      } catch (refreshError) {
        console.warn('Refresh profile after update failed:', refreshError)
      }

      const nextProfile = latestProfile || responseProfile || payload
      setProfileForm((current) => ({
        ...current,
        fullName: nextProfile.full_name || nextProfile.fullName || payload.full_name,
        email: nextProfile.email ?? payload.email,
        phone: nextProfile.phone ?? payload.phone,
      }))

      toast.success('Cập nhật hồ sơ thành công.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể cập nhật hồ sơ bác sĩ.'))
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSave = async (event) => {
    event.preventDefault()
    setPasswordSaving(true)

    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
      })

      toast.success('Đổi mật khẩu thành công.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể cập nhật mật khẩu.'))
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    try {
      await authAPI.logoutAllDevices()
      toast.success('Đã đăng xuất tất cả thiết bị.')
      loadAccountCollections()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể đăng xuất tất cả thiết bị.'))
    }
  }

  const handleRevokeSession = async (sessionId) => {
    try {
      await authAPI.revokeSession(sessionId)
      setSessions((current) => current.filter((session) => session.id !== sessionId))
      toast.success('Đã hủy phiên làm việc.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể hủy phiên làm việc.'))
    }
  }

  return (
    <DoctorProfilePage
      activeSessionCount={sessions.filter((s) => !s.revokedAt).length}
      avatarText={avatarText}
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
