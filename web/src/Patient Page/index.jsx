import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Home/context/AuthContext'
import { authAPI } from '../utils/api'
import PatientSidebar from './components/PatientSidebar'
import PatientTopbar from './components/PatientTopbar'
import PatientAppointmentsPage from './pages/PatientAppointmentsPage'
import PatientBillingPage from './pages/PatientBillingPage'
import PatientDashboardPage from './pages/PatientDashboardPage'
import PatientDirectoryPage from './pages/PatientDirectoryPage'
import PatientDocumentsPage from './pages/PatientDocumentsPage'
import PatientEmergencyIdentityPage from './pages/PatientEmergencyIdentityPage'
import PatientHealthTrendsPage from './pages/PatientHealthTrendsPage'
import PatientMedicalHistoryPage from './pages/PatientMedicalHistoryPage'
import PatientMedicationsPage from './pages/PatientMedicationsPage'
import PatientMessagesPage from './pages/PatientMessagesPage'
import PatientNotificationsPage from './pages/PatientNotificationsPage'
import PatientProfileSettingsPage from './pages/PatientProfileSettingsPage'
import PatientPlaceholderPage from './pages/PatientPlaceholderPage'
import PatientSupportPage from './pages/PatientSupportPage'
import { notificationFeed } from './data/patientPageData'
import { getInitials } from './utils/patientHelpers'
import './styles/base.css'
import './styles/appointments.css'
import './styles/billing.css'
import './styles/dashboard.css'
import './styles/directory.css'
import './styles/documents.css'
import './styles/emergency.css'
import './styles/history.css'
import './styles/medications.css'
import './styles/messages.css'
import './styles/notifications.css'
import './styles/profile-settings.css'
import './styles/support.css'
import './styles/trends.css'

function getApiErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback
}

function normalizeOptionalText(value) {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export default function PatientPage() {
  const { user, logout, refreshProfile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const mainColumnRef = useRef(null)

  const [activeSection, setActiveSection] = useState('dashboard')
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [sessions, setSessions] = useState([])
  const [loginHistory, setLoginHistory] = useState([])
  const [notificationItems, setNotificationItems] = useState(notificationFeed)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const patientName = user?.fullName || user?.email?.split('@')[0] || 'Bệnh nhân'
  const avatarText = getInitials(patientName) || 'BN'
  const patientId = user?.patientCode || user?.patientId || 'Chưa cấp mã'

  const openSection = (sectionKey) => {
    setActiveSection(sectionKey)

    if (mainColumnRef.current) {
      mainColumnRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }

  const markAllNotificationsAsRead = () => {
    setNotificationItems((current) =>
      current.map((item) => ({
        ...item,
        unread: false,
      })),
    )
  }

  const markNotificationAsRead = (notificationId) => {
    setNotificationItems((current) =>
      current.map((item) =>
        item.id === notificationId
          ? {
              ...item,
              unread: false,
            }
          : item,
      ),
    )
  }

  useEffect(() => {
    setProfileForm((current) => ({
      ...current,
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      email: user?.email || '',
    }))
  }, [user?.fullName, user?.phone, user?.email])

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
    if (authLoading) {
      return
    }

    loadAccountCollections()
  }, [authLoading, user?.patientId])

  const handleLogout = async (options = {}) => {
    await logout(options)
    navigate('/dang-nhap', { replace: true })
  }

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
      const address = profileForm.address.trim()

      await authAPI.updateMyProfile({
        full_name: normalizeOptionalText(profileForm.fullName),
        email: normalizeOptionalText(profileForm.email),
        phone: normalizeOptionalText(profileForm.phone),
        address,
      })

      const refreshedUser = await refreshProfile()

      setProfileForm((current) => ({
        ...current,
        fullName: refreshedUser?.fullName || current.fullName,
        phone: refreshedUser?.phone || current.phone,
        email: refreshedUser?.email || current.email,
        address,
      }))

      setFeedback({ type: 'success', text: 'Đã cập nhật hồ sơ tài khoản.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể cập nhật hồ sơ tài khoản.'),
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
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      })

      setPasswordForm({ currentPassword: '', newPassword: '' })
      setFeedback({
        type: 'success',
        text: 'Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã bị thu hồi.',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể đổi mật khẩu.'),
      })
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleRevokeSession = async (sessionId) => {
    setFeedback(null)

    try {
      await authAPI.revokeSession(sessionId)
      await loadAccountCollections()
      setFeedback({ type: 'success', text: 'Đã thu hồi phiên đăng nhập.' })
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể thu hồi phiên đăng nhập.'),
      })
    }
  }

  const handleLogoutAllDevices = async () => {
    setFeedback(null)

    try {
      await authAPI.logoutAllDevices()
      await handleLogout({ skipRequest: true })
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể đăng xuất khỏi tất cả thiết bị.'),
      })
    }
  }

  const renderContent = () => {
    if (activeSection === 'dashboard') {
      return (
        <PatientDashboardPage
          accountError={accountError}
          loginHistory={loginHistory}
          loading={accountLoading || authLoading}
          notifications={notificationItems}
          onBookAppointment={() => openSection('appointments')}
          onOpenHistory={() => openSection('history')}
          onOpenNotifications={() => openSection('notifications')}
          onOpenProfile={() => openSection('profile')}
          patientName={patientName}
          sessions={sessions}
          user={user}
        />
      )
    }

    if (activeSection === 'appointments') {
      return <PatientAppointmentsPage />
    }

    if (activeSection === 'emergency') {
      return <PatientEmergencyIdentityPage />
    }

    if (activeSection === 'trends') {
      return <PatientHealthTrendsPage patientName={patientName} />
    }

    if (activeSection === 'medications') {
      return <PatientMedicationsPage />
    }

    if (activeSection === 'directory') {
      return <PatientDirectoryPage />
    }

    if (activeSection === 'notifications') {
      return (
        <PatientNotificationsPage
          feed={notificationItems}
          onMarkAllAsRead={markAllNotificationsAsRead}
          onMarkAsRead={markNotificationAsRead}
          onNavigate={openSection}
        />
      )
    }

    if (activeSection === 'messages') {
      return <PatientMessagesPage />
    }

    if (activeSection === 'documents') {
      return <PatientDocumentsPage />
    }

    if (activeSection === 'history') {
      return <PatientMedicalHistoryPage />
    }

    if (activeSection === 'billing') {
      return <PatientBillingPage />
    }

    if (activeSection === 'profile') {
      return (
        <PatientProfileSettingsPage
          accountError={accountError}
          activeSessionCount={sessions.filter((session) => session.is_active).length}
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
          patientId={patientId}
          patientName={patientName}
          profileForm={profileForm}
          profileSaving={profileSaving}
          sessions={sessions}
          sessionsLoading={accountLoading || authLoading}
          user={user}
        />
      )
    }

    if (activeSection === 'support') {
      return <PatientSupportPage />
    }

    return (
      <PatientPlaceholderPage
        activeSection={activeSection}
        onBackToDashboard={() => setActiveSection('dashboard')}
      />
    )
  }

  return (
    <div className="patient-shell">
      <PatientSidebar
        activeSection={activeSection}
        onSectionChange={openSection}
        onLogout={handleLogout}
      />

      <div className="patient-main-column" ref={mainColumnRef}>
        <PatientTopbar
          activeSection={activeSection}
          avatarText={avatarText}
          notificationItems={notificationItems}
          onEmergencyOpen={() => openSection('emergency')}
          onHomeOpen={() => navigate('/')}
          onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
          onMarkNotificationAsRead={markNotificationAsRead}
          onMessagesOpen={() => openSection('messages')}
          onNotificationsOpen={() => openSection('notifications')}
          onLogout={handleLogout}
          onProfileOpen={() => openSection('profile')}
          patientName={patientName}
        />

        <main className="patient-content">{renderContent()}</main>
      </div>
    </div>
  )
}
