import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentAPI, authAPI, departmentAPI, patientAPI, scheduleAPI } from '../utils/api'
import { clearStoredAuth, readStoredAuth, writeStoredAuth } from '../lib/storage'
import PatientIcon from './components/PatientIcon'
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
import './styles/compact-desktop.css'

function getApiErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback
}

function normalizeOptionalText(value) {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function getResponseData(result) {
  return result.status === 'fulfilled' ? result.value.data?.data : null
}

function normalizePatientUser(patient) {
  if (!patient) {
    return null
  }

  return {
    ...patient,
    patientId: patient.patient_id,
    patientCode: patient.patient_code,
    patientAccountId: patient.patient_account_id,
    fullName: patient.full_name,
    lastLoginAt: patient.last_login_at,
  }
}

function readPatientAuth() {
  const auth = readStoredAuth()

  if (auth?.actorType !== 'patient' || !auth?.tokens?.access_token) {
    return { auth: null, user: null }
  }

  return {
    auth,
    user: normalizePatientUser(auth.patient),
  }
}

export default function PatientPage() {
  const navigate = useNavigate()
  const mainColumnRef = useRef(null)
  const [authState, setAuthState] = useState(readPatientAuth)

  const [activeSection, setActiveSection] = useState('dashboard')
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    emergencyContactPhone: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [sessions, setSessions] = useState([])
  const [loginHistory, setLoginHistory] = useState([])
  const [notificationItems, setNotificationItems] = useState(notificationFeed)
  const [patientProfile, setPatientProfile] = useState(null)
  const [patientAppointments, setPatientAppointments] = useState([])
  const [patientEncounters, setPatientEncounters] = useState([])
  const [patientPrescriptions, setPatientPrescriptions] = useState([])
  const [patientDepartments, setPatientDepartments] = useState([])
  const [patientSchedules, setPatientSchedules] = useState([])
  const [accountLoading, setAccountLoading] = useState(true)
  const [patientDataLoading, setPatientDataLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const [patientDataError, setPatientDataError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const authLoading = false
  const user = authState.user
  const patientName = user?.fullName || user?.email?.split('@')[0] || 'Bệnh nhân'
  const avatarText = getInitials(patientName) || 'BN'
  const patientId = user?.patientCode || user?.patientId || 'Chưa cấp mã'

  const refreshProfile = async () => {
    const response = await authAPI.getMe()
    const profile = response.data?.data?.profile
    const patient = normalizePatientUser(profile)

    if (profile) {
      setAuthState((current) => {
        const nextAuth = {
          ...(current.auth || readStoredAuth() || {}),
          actorType: 'patient',
          patient: profile,
        }

        writeStoredAuth(nextAuth)
        return { auth: nextAuth, user: patient }
      })
    }

    return patient
  }

  const logout = async ({ skipRequest = false } = {}) => {
    const refreshToken = authState.auth?.tokens?.refresh_token

    if (!skipRequest) {
      try {
        await authAPI.logout(refreshToken)
      } catch (error) {
        // The local session should be cleared even if the server session is already gone.
      }
    }

    clearStoredAuth()
    setAuthState({ auth: null, user: null })
  }

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
    const patient = patientProfile?.patient

    setProfileForm((current) => ({
      ...current,
      fullName: patient?.full_name || user?.fullName || '',
      phone: patient?.phone || user?.phone || '',
      email: patient?.email || user?.email || '',
      address: patient?.address || current.address || '',
      emergencyContactPhone: patient?.emergency_contact_phone || current.emergencyContactPhone || '',
    }))
  }, [patientProfile, user?.fullName, user?.phone, user?.email])

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
    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (authLoading) {
      return
    }

    loadAccountCollections()
  }, [authLoading, user?.patientId])

  async function loadPatientPortalData() {
    if (!user) {
      setPatientProfile(null)
      setPatientAppointments([])
      setPatientEncounters([])
      setPatientPrescriptions([])
      setPatientDepartments([])
      setPatientSchedules([])
      setPatientDataLoading(false)
      return
    }

    setPatientDataLoading(true)
    setPatientDataError('')

    const today = new Date()
    const dateFrom = today.toISOString().slice(0, 10)
    const dateTo = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const results = await Promise.allSettled([
      patientAPI.getMyProfile(),
      appointmentAPI.getMyAppointments({ limit: 30 }),
      patientAPI.getMyEncounters({ limit: 30 }),
      patientAPI.getMyPrescriptions({ limit: 30 }),
      departmentAPI.getActiveDepartments(),
      scheduleAPI.getByDateRange({
        date_from: dateFrom,
        date_to: dateTo,
        status: 'published,active',
        limit: 50,
      }),
    ])

    const profileData = getResponseData(results[0])
    const appointmentsData = getResponseData(results[1])
    const encountersData = getResponseData(results[2])
    const prescriptionsData = getResponseData(results[3])
    const departmentsData = getResponseData(results[4])
    const schedulesData = getResponseData(results[5])

    setPatientProfile(profileData || null)
    setPatientAppointments(appointmentsData?.items || [])
    setPatientEncounters(encountersData?.items || [])
    setPatientPrescriptions(prescriptionsData?.items || [])
    setPatientDepartments(departmentsData?.items || [])
    setPatientSchedules(schedulesData?.items || [])

    const failed = results.find((result) => result.status === 'rejected')
    if (failed) {
      setPatientDataError(
        getApiErrorMessage(failed.reason, 'Một phần dữ liệu bệnh nhân chưa tải được.'),
      )
    }

    setPatientDataLoading(false)
  }

  useEffect(() => {
    if (authLoading) {
      return
    }

    loadPatientPortalData()
  }, [authLoading, user?.patientId])

  const handleLogout = async (options = {}) => {
    await logout(options)
    navigate('/login', { replace: true })
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

      const profileResponse = await patientAPI.updateMyProfile({
        full_name: normalizeOptionalText(profileForm.fullName),
        email: normalizeOptionalText(profileForm.email),
        phone: normalizeOptionalText(profileForm.phone),
        address,
        emergency_contact_phone: normalizeOptionalText(profileForm.emergencyContactPhone),
      })

      const refreshedUser = await refreshProfile()
      const refreshedProfile = profileResponse.data?.data

      if (refreshedProfile) {
        setPatientProfile(refreshedProfile)
      }

      setProfileForm((current) => ({
        ...current,
        fullName: refreshedUser?.fullName || current.fullName,
        phone: refreshedUser?.phone || current.phone,
        email: refreshedUser?.email || current.email,
        address,
        emergencyContactPhone:
          refreshedProfile?.patient?.emergency_contact_phone || current.emergencyContactPhone,
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
          appointments={patientAppointments}
          encounters={patientEncounters}
          loginHistory={loginHistory}
          loading={accountLoading || authLoading}
          notifications={notificationItems}
          onBookAppointment={() => openSection('appointments')}
          onOpenHistory={() => openSection('history')}
          onOpenNotifications={() => openSection('notifications')}
          onOpenProfile={() => openSection('profile')}
          patientName={patientName}
          patientProfile={patientProfile}
          patientDataError={patientDataError}
          patientDataLoading={patientDataLoading}
          sessions={sessions}
          user={user}
        />
      )
    }

    if (activeSection === 'appointments') {
      return (
        <PatientAppointmentsPage
          appointments={patientAppointments}
          departments={patientDepartments}
          loading={patientDataLoading}
          onAppointmentCreated={loadPatientPortalData}
          schedules={patientSchedules}
        />
      )
    }

    if (activeSection === 'emergency') {
      return <PatientEmergencyIdentityPage />
    }

    if (activeSection === 'trends') {
      return <PatientHealthTrendsPage patientName={patientName} />
    }

    if (activeSection === 'medications') {
      return (
        <PatientMedicationsPage
          loading={patientDataLoading}
          prescriptions={patientPrescriptions}
        />
      )
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
      return (
        <PatientMedicalHistoryPage
          encounters={patientEncounters}
          loading={patientDataLoading}
          prescriptions={patientPrescriptions}
        />
      )
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
          patientProfile={patientProfile}
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
          onHomeOpen={() => navigate('/home')}
          onMarkAllNotificationsAsRead={markAllNotificationsAsRead}
          onMarkNotificationAsRead={markNotificationAsRead}
          onMessagesOpen={() => openSection('messages')}
          onNotificationsOpen={() => openSection('notifications')}
          onLogout={handleLogout}
          onProfileOpen={() => openSection('profile')}
          onSectionChange={openSection}
          patientName={patientName}
        />

        <main className="patient-content">{renderContent()}</main>

        <section className="patient-mobile-tail-actions">
          <button
            className={`patient-muted-link${activeSection === 'profile' ? ' is-active' : ''}`}
            type="button"
            onClick={() => openSection('profile')}
          >
            <span className="patient-nav-icon" aria-hidden="true">
              <PatientIcon name="settings" />
            </span>
            <span>Cài đặt</span>
          </button>

          <button
            className={`patient-muted-link${activeSection === 'support' ? ' is-active' : ''}`}
            type="button"
            onClick={() => openSection('support')}
          >
            <span className="patient-nav-icon" aria-hidden="true">
              <PatientIcon name="help_outline" />
            </span>
            <span>Hỗ trợ</span>
          </button>

          <div className="patient-sidebar-cta patient-mobile-tail-cta">
            <button
              className="patient-danger-button"
              type="button"
              onClick={() => openSection('emergency')}
            >
              <PatientIcon name="emergency" aria-hidden="true" />
              <span>Cấp cứu</span>
            </button>
          </div>

          <button className="patient-muted-link" type="button" onClick={handleLogout}>
            <span className="patient-nav-icon" aria-hidden="true">
              <PatientIcon name="logout" />
            </span>
            <span>Đăng xuất</span>
          </button>
        </section>
      </div>
    </div>
  )
}