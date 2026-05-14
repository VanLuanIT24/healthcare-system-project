import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  appointmentAPI,
  authAPI,
  billingAPI,
  departmentAPI,
  imagingAPI,
  labAPI,
  notificationAPI,
  patientAPI,
  prescriptionAPI,
  recordsAPI,
  scheduleAPI,
} from '../utils/api'
import { clearStoredAuth, readStoredAuth, writeStoredAuth } from '../lib/storage'
import PatientIcon from './components/PatientIcon'
import PatientSidebar from './components/PatientSidebar'
import PatientTopbar from './components/PatientTopbar'
import { notificationFeed } from './data/patientPageData'
import PatientAppointmentsPage from './pages/PatientAppointmentsPage'
import PatientBillingPage from './pages/PatientBillingPage'
import PatientDashboardPage from './pages/PatientDashboardPage'
import PatientDirectoryPage from './pages/PatientDirectoryPage'
import PatientDocumentsPage from './pages/PatientDocumentsPage'
import PatientEmergencyIdentityPage from './pages/PatientEmergencyIdentityPage'
import PatientImagingPage from './pages/PatientImagingPage'
import PatientInsurancePage from './pages/PatientInsurancePage'
import PatientLabResultsPage from './pages/PatientLabResultsPage'
import PatientMedicalHistoryPage from './pages/PatientMedicalHistoryPage'
import PatientMedicationsPage from './pages/PatientMedicationsPage'
import PatientMessagesPage from './pages/PatientMessagesPage'
import PatientNotificationsPage from './pages/PatientNotificationsPage'
import PatientProfileSettingsPage from './pages/PatientProfileSettingsPage'
import PatientPlaceholderPage from './pages/PatientPlaceholderPage'
import PatientSupportPage from './pages/PatientSupportPage'
import { getInitials } from './utils/patientHelpers'
import './styles/base.css'
import './styles/appointments.css'
import './styles/billing.css'
import './styles/dashboard.css'
import './styles/directory.css'
import './styles/documents.css'
import './styles/emergency.css'
import './styles/history.css'
import './styles/imaging.css'
import './styles/insurance.css'
import './styles/lab-results.css'
import './styles/medications.css'
import './styles/messages.css'
import './styles/notifications.css'
import './styles/profile-settings.css'
import './styles/support.css'
import './styles/compact-desktop.css'

function getApiErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback
}

function normalizeOptionalText(value) {
  const trimmed = String(value || '').trim()
  return trimmed ? trimmed : undefined
}

function normalizeClearableText(value) {
  const trimmed = String(value || '').trim()
  return trimmed ? trimmed : null
}

function getResponseData(result) {
  return result.status === 'fulfilled' ? result.value.data?.data : null
}

function getRelativeTime(value) {
  if (!value) {
    return 'Chưa có thời gian'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Chưa có thời gian'
  }

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000))
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} giờ trước`
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date)
}

function getNotificationCategory(item) {
  const type = String(item.notification_type || item.created_by_module || '').toLowerCase()
  if (type.includes('appointment') || type.includes('schedule')) return 'appointments'
  if (type.includes('lab') || type.includes('result')) return 'labs'
  return 'hospital'
}

function mapApiNotification(item) {
  const category = getNotificationCategory(item)
  const iconByCategory = {
    appointments: 'calendar_today',
    labs: 'biotech',
    hospital: 'campaign',
  }

  return {
    id: item.notification_id || item._id,
    category,
    icon: iconByCategory[category] || 'notifications',
    iconTone: category === 'appointments' ? 'mint' : category === 'labs' ? 'soft' : 'neutral',
    title: item.title || 'Thông báo',
    time: getRelativeTime(item.created_at || item.sent_at || item.delivered_at),
    body: item.message || '',
    unread: item.status !== 'read' && !item.read_at,
    actions: [],
    apiBacked: Boolean(item.notification_id || item._id),
  }
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

const patientSectionKeys = new Set([
  'dashboard',
  'book-appointment',
  'appointments',
  'medical-records',
  'emergency',
  'imaging',
  'lab-results',
  'insurance',
  'medications',
  'directory',
  'notifications',
  'messages',
  'documents',
  'history',
  'billing',
  'profile',
  'settings',
  'support',
])

function getPatientSectionFromSearch(search) {
  const section = new URLSearchParams(search || '').get('section')
  return patientSectionKeys.has(section) ? section : ''
}

function getInitialPatientSection(search) {
  return getPatientSectionFromSearch(search) || 'dashboard'
}

export default function PatientPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const mainColumnRef = useRef(null)
  const [authState, setAuthState] = useState(readPatientAuth)

  const [activeSection, setActiveSection] = useState(() => getInitialPatientSection(location.search))
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    nationalId: '',
    insuranceNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    gender: 'unknown',
    dateOfBirth: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
  })
  const [sessions, setSessions] = useState([])
  const [loginHistory, setLoginHistory] = useState([])
  const [notificationItems, setNotificationItems] = useState(() => notificationFeed)
  const [patientProfile, setPatientProfile] = useState(null)
  const [patientAppointments, setPatientAppointments] = useState([])
  const [patientEncounters, setPatientEncounters] = useState([])
  const [patientPrescriptions, setPatientPrescriptions] = useState([])
  const [patientDepartments, setPatientDepartments] = useState([])
  const [patientSchedules, setPatientSchedules] = useState([])
  const [patientMedicalRecords, setPatientMedicalRecords] = useState([])
  const [patientDocuments, setPatientDocuments] = useState([])
  const [patientDocumentTimeline, setPatientDocumentTimeline] = useState([])
  const [patientLabResults, setPatientLabResults] = useState([])
  const [patientImagingReports, setPatientImagingReports] = useState([])
  const [patientBillingSummary, setPatientBillingSummary] = useState(null)
  const [patientInvoices, setPatientInvoices] = useState([])
  const [patientPayments, setPatientPayments] = useState([])
  const [patientInsurancePolicies, setPatientInsurancePolicies] = useState([])
  const [patientInsuranceClaims, setPatientInsuranceClaims] = useState([])
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

  useEffect(() => {
    const nextSection = getPatientSectionFromSearch(location.search)
    if (!nextSection) return
    setActiveSection((current) => (current === nextSection ? current : nextSection))
  }, [location.search])

  const markAllNotificationsAsRead = async () => {
    const shouldSyncApi = notificationItems.some((item) => item.apiBacked && item.unread)

    setNotificationItems((current) =>
      current.map((item) => ({
        ...item,
        unread: false,
      })),
    )

    if (!shouldSyncApi) {
      return
    }

    try {
      await notificationAPI.markAllRead()
    } catch (error) {
      setPatientDataError(getApiErrorMessage(error, 'Không thể đồng bộ trạng thái thông báo đã đọc.'))
    }
  }

  const markNotificationAsRead = async (notificationId) => {
    const notification = notificationItems.find((item) => item.id === notificationId)

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

    if (!notification?.apiBacked) {
      return
    }

    try {
      await notificationAPI.markRead(notificationId)
    } catch (error) {
      setPatientDataError(getApiErrorMessage(error, 'Không thể đồng bộ trạng thái thông báo đã đọc.'))
    }
  }

  useEffect(() => {
    const patient = patientProfile?.patient

    setProfileForm((current) => ({
      ...current,
      fullName: patient?.full_name || user?.fullName || '',
      phone: patient?.phone || user?.phone || '',
      email: patient?.email || user?.email || '',
      address: patient?.address || current.address || '',
      nationalId: patient?.national_id || current.nationalId || '',
      insuranceNumber: patient?.insurance_number || current.insuranceNumber || '',
      emergencyContactName: patient?.emergency_contact_name || current.emergencyContactName || '',
      emergencyContactPhone: patient?.emergency_contact_phone || current.emergencyContactPhone || '',
      gender: patient?.gender || current.gender || 'unknown',
      dateOfBirth: patient?.date_of_birth ? patient.date_of_birth.slice(0, 10) : current.dateOfBirth || '',
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
      setPatientMedicalRecords([])
      setPatientDocuments([])
      setPatientDocumentTimeline([])
      setPatientLabResults([])
      setPatientImagingReports([])
      setPatientBillingSummary(null)
      setPatientInvoices([])
      setPatientPayments([])
      setPatientInsurancePolicies([])
      setPatientInsuranceClaims([])
      setNotificationItems(notificationFeed)
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
      appointmentAPI.getMyAppointments({ limit: 100 }),
      patientAPI.getMyEncounters({ limit: 30 }),
      prescriptionAPI.getMyPrescriptions({ limit: 30 }),
      departmentAPI.getActiveDepartments(),
      scheduleAPI.getByDateRange({
        date_from: dateFrom,
        date_to: dateTo,
        status: 'published,active',
        limit: 50,
      }),
      recordsAPI.getMyMedicalRecords({ limit: 30 }),
      recordsAPI.getMyAttachments({ limit: 100 }),
      recordsAPI.getMyDocumentTimeline({ limit: 50 }),
      labAPI.getMyResults({ limit: 30 }),
      imagingAPI.getMyReports({ limit: 30 }),
      billingAPI.getMySummary(),
      billingAPI.getMyInvoices({ limit: 100 }),
      billingAPI.getMyPayments({ limit: 50 }),
      billingAPI.getMyInsurancePolicies(),
      billingAPI.getMyInsuranceClaims({ limit: 50 }),
      notificationAPI.getMyNotifications({ limit: 20 }),
    ])

    const profileData = getResponseData(results[0])
    const appointmentsData = getResponseData(results[1])
    const encountersData = getResponseData(results[2])
    const prescriptionsData = getResponseData(results[3])
    const departmentsData = getResponseData(results[4])
    const schedulesData = getResponseData(results[5])
    const medicalRecordsData = getResponseData(results[6])
    const documentsData = getResponseData(results[7])
    const documentTimelineData = getResponseData(results[8])
    const labResultsData = getResponseData(results[9])
    const imagingReportsData = getResponseData(results[10])
    const billingSummaryData = getResponseData(results[11])
    const invoicesData = getResponseData(results[12])
    const paymentsData = getResponseData(results[13])
    const insurancePoliciesData = getResponseData(results[14])
    const insuranceClaimsData = getResponseData(results[15])
    const notificationsData = getResponseData(results[16])

    setPatientProfile(profileData || null)
    setPatientAppointments(appointmentsData?.items || [])
    setPatientEncounters(encountersData?.items || [])
    setPatientPrescriptions(prescriptionsData?.items || [])
    setPatientDepartments(departmentsData?.items || [])
    setPatientSchedules(schedulesData?.items || [])
    setPatientMedicalRecords(medicalRecordsData?.items || [])
    setPatientDocuments(documentsData?.items || [])
    setPatientDocumentTimeline(documentTimelineData?.items || [])
    setPatientLabResults(labResultsData?.items || [])
    setPatientImagingReports(imagingReportsData?.items || [])
    setPatientBillingSummary(billingSummaryData || null)
    setPatientInvoices(invoicesData?.items || [])
    setPatientPayments(paymentsData?.items || [])
    setPatientInsurancePolicies(Array.isArray(insurancePoliciesData) ? insurancePoliciesData : insurancePoliciesData?.items || [])
    setPatientInsuranceClaims(insuranceClaimsData?.items || [])
    if (Array.isArray(notificationsData?.items)) {
      setNotificationItems(notificationsData.items.map(mapApiNotification))
    }

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

  const handlePasswordFieldChange = (field) => (event) => {
    setFeedback(null)
    setPasswordForm((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  const handleProfileSave = async (formValues) => {
    setProfileSaving(true)
    setFeedback(null)

    try {
      const nextProfilePatch = {
        full_name: normalizeOptionalText(formValues.fullName),
        email: normalizeOptionalText(formValues.email),
        phone: normalizeOptionalText(formValues.phone),
        address: normalizeClearableText(formValues.address),
        national_id: normalizeClearableText(formValues.nationalId),
        insurance_number: normalizeClearableText(formValues.insuranceNumber),
        emergency_contact_name: normalizeClearableText(formValues.emergencyContactName),
        emergency_contact_phone: normalizeClearableText(formValues.emergencyContactPhone),
        gender: formValues.gender || 'unknown',
        date_of_birth: normalizeClearableText(formValues.dateOfBirth),
      }

      const profileResponse = await patientAPI.updateMyProfile(nextProfilePatch)
      const responseData = profileResponse.data?.data
      const refreshedProfile =
        responseData?.patient || responseData?.medical_profile
          ? responseData
          : responseData?.profile || responseData

      let refreshedUser = null
      try {
        refreshedUser = await refreshProfile()
      } catch (error) {
        refreshedUser = null
      }

      setPatientProfile((current) => ({
        ...(current || {}),
        ...(refreshedProfile || {}),
        patient: {
          ...(current?.patient || {}),
          ...(refreshedProfile?.patient || {}),
          full_name: nextProfilePatch.full_name || current?.patient?.full_name || '',
          email: nextProfilePatch.email || current?.patient?.email || '',
          phone: nextProfilePatch.phone || current?.patient?.phone || '',
          address: nextProfilePatch.address || '',
          national_id: nextProfilePatch.national_id || '',
          insurance_number: nextProfilePatch.insurance_number || '',
          emergency_contact_name: nextProfilePatch.emergency_contact_name || '',
          emergency_contact_phone: nextProfilePatch.emergency_contact_phone || '',
          gender: nextProfilePatch.gender || current?.patient?.gender || 'unknown',
          date_of_birth: nextProfilePatch.date_of_birth || '',
        },
      }))

      setProfileForm((current) => ({
        ...current,
        fullName: refreshedUser?.fullName || nextProfilePatch.full_name || current.fullName,
        phone: refreshedUser?.phone || nextProfilePatch.phone || current.phone,
        email: refreshedUser?.email || nextProfilePatch.email || current.email,
        address: nextProfilePatch.address ?? '',
        nationalId: nextProfilePatch.national_id ?? '',
        insuranceNumber: nextProfilePatch.insurance_number ?? '',
        emergencyContactName: nextProfilePatch.emergency_contact_name ?? '',
        emergencyContactPhone:
          refreshedProfile?.patient?.emergency_contact_phone ??
          nextProfilePatch.emergency_contact_phone ??
          '',
        gender: nextProfilePatch.gender || current.gender,
        dateOfBirth: nextProfilePatch.date_of_birth ?? '',
      }))

      setFeedback({ type: 'success', text: 'Đã cập nhật hồ sơ tài khoản.' })
      return true
    } catch (error) {
      setFeedback({
        type: 'error',
        text: getApiErrorMessage(error, 'Không thể cập nhật hồ sơ tài khoản.'),
      })
      return false
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

  const handleDocumentDownload = async (attachmentId) => {
    if (!attachmentId) {
      throw new Error('Tài liệu này chưa có mã attachment từ backend.')
    }

    const response = await recordsAPI.getMyAttachmentDownloadMetadata(attachmentId)
    return response.data?.data
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
          onBookAppointment={() => openSection('book-appointment')}
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

    if (activeSection === 'book-appointment') {
      return (
        <PatientAppointmentsPage
          appointments={patientAppointments}
          departments={patientDepartments}
          loading={patientDataLoading}
          onAppointmentCreated={loadPatientPortalData}
          patientProfile={patientProfile}
          schedules={patientSchedules}
          user={user}
          viewMode="booking"
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
          patientProfile={patientProfile}
          schedules={patientSchedules}
          user={user}
          viewMode="history"
        />
      )
    }

    if (activeSection === 'medical-records') {
      return (
        <PatientMedicalHistoryPage
          encounters={patientEncounters}
          labResults={patientLabResults}
          loading={patientDataLoading}
          medicalRecords={patientMedicalRecords}
          prescriptions={patientPrescriptions}
          viewMode="records"
        />
      )
    }

    if (activeSection === 'emergency') {
      return <PatientEmergencyIdentityPage />
    }

    if (activeSection === 'imaging') {
      return (
        <PatientImagingPage
          loading={patientDataLoading}
          reports={patientImagingReports}
        />
      )
    }

    if (activeSection === 'lab-results') {
      return (
        <PatientLabResultsPage
          labResults={patientLabResults}
          loading={patientDataLoading}
        />
      )
    }

    if (activeSection === 'insurance') {
      return (
        <PatientInsurancePage
          claims={patientInsuranceClaims}
          error={patientDataError}
          loading={patientDataLoading}
          onBackToDashboard={() => setActiveSection('dashboard')}
          policies={patientInsurancePolicies}
        />
      )
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
      return (
        <PatientDocumentsPage
          documents={patientDocuments}
          error={patientDataError}
          loading={patientDataLoading}
          onBookAppointment={() => openSection('book-appointment')}
          onDownloadDocument={handleDocumentDownload}
        />
      )
    }

    if (activeSection === 'history') {
      return (
        <PatientMedicalHistoryPage
          encounters={patientEncounters}
          labResults={patientLabResults}
          loading={patientDataLoading}
          medicalRecords={patientMedicalRecords}
          prescriptions={patientPrescriptions}
          viewMode="history"
        />
      )
    }

    if (activeSection === 'billing') {
      return (
        <PatientBillingPage
          billingSummary={patientBillingSummary}
          error={patientDataError}
          invoices={patientInvoices}
          loading={patientDataLoading}
          payments={patientPayments}
        />
      )
    }

    if (activeSection === 'profile' || activeSection === 'settings') {
      return (
        <PatientProfileSettingsPage
          accountError={accountError}
          activeSessionCount={sessions.filter((session) => session.is_active).length}
          avatarText={avatarText}
          feedback={feedback}
          loginHistory={loginHistory}
          onLogoutAllDevices={handleLogoutAllDevices}
          onPasswordFieldChange={handlePasswordFieldChange}
          onPasswordSave={handlePasswordSave}
          onProfileSave={handleProfileSave}
          onRevokeSession={handleRevokeSession}
          passwordForm={passwordForm}
            passwordSaving={passwordSaving}
            patientAppointments={patientAppointments}
            patientEncounters={patientEncounters}
            patientPrescriptions={patientPrescriptions}
            patientDataLoading={patientDataLoading}
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
