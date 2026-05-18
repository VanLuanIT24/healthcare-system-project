import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, adminDoctorProfileAPI, doctorProfileAPI, notificationAPI, preferenceAPI, unwrapData } from '../utils/api'
import { readStoredAuth, writeStoredAuth } from '../lib/storage'
import { doctorApi } from './doctorApi'
import { formatDate, formatTime, getInitials, safeArray } from './doctorData'
import { DoctorIcon, ErrorState, LoadingState } from './DoctorShell'

const DOCTOR_AUTH_CHANGED_EVENT = 'doctor-auth-changed'

function getId(value) {
  if (!value) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value.$oid === 'string') return value.$oid
  if (typeof value._id === 'string') return value._id
  if (typeof value.id === 'string') return value.id
  if (typeof value.profile_id === 'string') return value.profile_id
  if (typeof value.doctor_profile_id === 'string') return value.doctor_profile_id
  return ''
}

function getSettled(result, fallback = null) {
  return {
    data: result.status === 'fulfilled' ? result.value : fallback,
    error: result.status === 'rejected' ? result.reason?.message || 'Không thể tải dữ liệu.' : '',
  }
}

function normalizeMe(payload) {
  const data = payload || {}
  const currentProfile = data.profile?.user || data.profile?.patient || data.profile?.patient_account
    ? data.profile
    : data
  const user = currentProfile.user || currentProfile.staff || currentProfile.profile || data.user || data
  const doctorProfile =
    currentProfile.doctor_profile ||
    currentProfile.doctorProfile ||
    user?.doctor_profile ||
    user?.doctorProfile ||
    null
  const department = currentProfile.department || user?.department || null

  return {
    raw: currentProfile,
    user,
    doctorProfile,
    department,
    roles: currentProfile.roles || user?.roles || [],
    permissions: currentProfile.permissions || user?.permissions || [],
    actorType: currentProfile.actor_type || currentProfile.actorType || data.actor_type || data.actorType || '',
  }
}

function getProfileId(me, dashboard) {
  return (
    getId(me?.raw?.doctorProfileId) ||
    getId(me?.raw?.doctor_profile_id) ||
    getId(me?.raw?.profileId) ||
    getId(me?.raw?.profile_id) ||
    getId(me?.doctorProfile?._id) ||
    getId(me?.doctorProfile?.profile_id) ||
    getId(me?.doctorProfile?.doctor_profile_id) ||
    getId(me?.user?.doctor_profile_id) ||
    getId(me?.user?.doctorProfileId) ||
    getId(dashboard?.doctor_profile_id) ||
    getId(dashboard?.doctorProfileId) ||
    getId(dashboard?.profile_id) ||
    getId(dashboard?.profileId) ||
    getId(dashboard?.doctor?.doctor_profile_id) ||
    getId(dashboard?.doctor?.profile_id)
  )
}

function getUserId(me) {
  return getId(me?.user?._id) || getId(me?.user?.id) || getId(me?.user?.user_id)
}

function pickDepartmentName(me, profile, dashboard, shift) {
  return (
    profile?.department?.department_name ||
    profile?.department?.name ||
    profile?.department_name ||
    profile?.departmentName ||
    me?.department?.department_name ||
    me?.department?.name ||
    shift?.department_name ||
    dashboard?.doctor?.department_name ||
    'Chưa cập nhật'
  )
}

function pickRoomName(shift) {
  return shift?.room_name || shift?.room_code || shift?.location_name || shift?.location || 'Chưa cập nhật'
}

function buildCompletion(fields) {
  const total = fields.length || 1
  const done = fields.filter((value) => {
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && String(value).trim() !== ''
  }).length
  return Math.round((done / total) * 100)
}

function normalizeDoctorProfilePayload(payload) {
  return payload?.doctor_profile || payload?.doctorProfile || payload?.profile || payload || null
}

function getDoctorProfileList(payload) {
  return safeArray(payload?.items || payload?.doctor_profiles || payload?.doctorProfiles || payload)
}

function isCurrentUserProfile(item, userId) {
  if (!userId) return false
  return getId(item?.user_id) === userId || getId(item?.user?.user_id) === userId || getId(item?.user?.id) === userId || getId(item?.user?._id) === userId
}

function optionalText(value) {
  const text = String(value ?? '').trim()
  return text || undefined
}

function buildProfessionalPayload(form) {
  return {
    qualification: optionalText(form.qualification),
    academic_title: optionalText(form.academic_title),
    specialty: optionalText(form.specialty),
    license_number: optionalText(form.license_number),
    years_of_experience: form.years_of_experience === '' ? undefined : Number(form.years_of_experience),
    languages: form.languages.split(',').map((item) => item.trim()).filter(Boolean),
  }
}

function formatStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (['active', 'enabled', 'verified'].includes(normalized)) return 'Đang hoạt động'
  if (['pending', 'draft', 'invited'].includes(normalized)) return 'Chờ cập nhật'
  if (['inactive', 'disabled', 'blocked', 'suspended', 'locked'].includes(normalized)) return 'Tạm khóa'
  return status || 'Chưa rõ'
}

function formatLanguages(languages) {
  return safeArray(languages).filter(Boolean).join(', ') || 'Chưa cập nhật'
}

function toDateInputValue(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function syncStoredDoctorUser(nextUser) {
  const currentAuth = readStoredAuth()
  if (!currentAuth || !nextUser) return

  writeStoredAuth({
    ...currentAuth,
    user: {
      ...(currentAuth.user || {}),
      ...nextUser,
    },
  })
  window.dispatchEvent(new Event(DOCTOR_AUTH_CHANGED_EVENT))
}

function formatScheduleRange(schedule) {
  if (!schedule?.shift_start || !schedule?.shift_end) return 'Chưa có giờ'
  return `${formatTime(schedule.shift_start)} - ${formatTime(schedule.shift_end)}`
}

function getScheduleTitle(schedule, index) {
  const text = String(schedule?.shift_name || schedule?.shift_code || '').toLowerCase()
  if (text.includes('morning') || text.includes('sáng')) return 'Ca sáng'
  if (text.includes('afternoon') || text.includes('chiều')) return 'Ca chiều'
  if (text.includes('night') || text.includes('tối')) return 'Ca tối'
  return `Ca ${index + 1}`
}

function getScheduleState(schedule) {
  const now = Date.now()
  const start = new Date(schedule?.shift_start).getTime()
  const end = new Date(schedule?.shift_end).getTime()
  if (schedule?.status === 'cancelled') return { label: 'Đã hủy', tone: 'red' }
  if (!Number.isNaN(start) && !Number.isNaN(end) && start <= now && now <= end) return { label: 'Đang diễn ra', tone: 'green' }
  if (!Number.isNaN(start) && now < start) return { label: 'Sắp tới', tone: 'blue' }
  return { label: formatStatus(schedule?.status), tone: 'slate' }
}

function getDashboardNumber(dashboard, keys, fallback = 0) {
  for (const key of keys) {
    const value = dashboard?.kpis?.[key] ?? dashboard?.[key]
    if (value !== undefined && value !== null && value !== '') return Number(value) || 0
  }
  return fallback
}

async function loadDoctorProfilePanel() {
  const meResponse = await authAPI.getMe()
  const me = normalizeMe(unwrapData(meResponse))
  const today = new Date().toISOString().slice(0, 10)

  const firstResults = await Promise.allSettled([
    doctorApi.dashboard.getMe({ date: today }),
    doctorApi.schedules.myToday({ date: today }),
    doctorApi.schedules.myWeek({ limit: 100 }),
    notificationAPI.getUnreadCount().then((response) => unwrapData(response)),
    notificationAPI.getCounters().then((response) => unwrapData(response)),
    preferenceAPI.getMe().then((response) => unwrapData(response)),
  ])

  const dashboardResult = getSettled(firstResults[0], null)
  const scheduleResult = getSettled(firstResults[1], [])
  const weekScheduleResult = getSettled(firstResults[2], [])
  const unreadResult = getSettled(firstResults[3], null)
  const counterResult = getSettled(firstResults[4], null)
  const preferenceResult = getSettled(firstResults[5], null)
  const dashboard = dashboardResult.data
  const schedules = scheduleResult.data
  const weekSchedules = weekScheduleResult.data
  const unreadPayload = unreadResult.data
  const counters = counterResult.data
  const preferences = preferenceResult.data
  const profileId = getProfileId(me, dashboard)

  const selfProfileResult = await Promise.allSettled([
    doctorProfileAPI.getMe().then((response) => unwrapData(response)),
  ])
  const selfProfile = getSettled(selfProfileResult[0], null)

  let profile = normalizeDoctorProfilePayload(selfProfile.data) || me.doctorProfile || null
  let profileError = selfProfile.error
  if (selfProfile.error && profileId) {
    const detailResult = await Promise.allSettled([
      adminDoctorProfileAPI.detail(profileId).then((response) => unwrapData(response)),
    ])
    const detail = getSettled(detailResult[0], null)
    profile = normalizeDoctorProfilePayload(detail.data) || profile
    profileError = detail.error
  } else if (selfProfile.error) {
    const userId = getUserId(me)
    const listResult = await Promise.allSettled([
      adminDoctorProfileAPI.list(userId ? { user_id: userId, limit: 1 } : { limit: 1 }).then((response) => unwrapData(response)),
    ])
    const list = getSettled(listResult[0], null)
    profile = getDoctorProfileList(list.data).find((item) => isCurrentUserProfile(item, userId)) || profile
    profileError = list.error
  }

  return {
    me,
    dashboard,
    schedules: safeArray(schedules),
    weekSchedules: safeArray(weekSchedules),
    unreadCount: Number(unreadPayload?.unread_count ?? unreadPayload?.count ?? unreadPayload?.total ?? unreadPayload ?? 0),
    counters,
    preferences,
    profile,
    errors: {
      dashboard: dashboardResult.error,
      schedules: scheduleResult.error,
      weekSchedules: weekScheduleResult.error,
      unreadCount: unreadResult.error,
      counters: counterResult.error,
      preferences: preferenceResult.error,
      profile: profileError,
    },
  }
}

function InfoLine({ label, value }) {
  return (
    <div className="doctor-profile-new-info-line">
      <span>{label}</span>
      <strong>{value || 'Chưa cập nhật'}</strong>
    </div>
  )
}

function ProfileCard({ title, action, children, className = '' }) {
  return (
    <article className={`doctor-profile-new-card ${className}`}>
      <header className="doctor-profile-new-card-head">
        <h3>{title}</h3>
        {action}
      </header>
      {children}
    </article>
  )
}

function CardActions({ editing, saving, editLabel = 'Chỉnh sửa', onEdit, onSave, onCancel }) {
  if (!editing) {
    return <button type="button" onClick={onEdit}>{editLabel}</button>
  }

  return (
    <div className="doctor-profile-new-card-actions">
      <button type="button" className="is-muted" onClick={onCancel} disabled={saving}>Hủy</button>
      <button type="button" onClick={onSave} disabled={saving}>Lưu</button>
    </div>
  )
}

function StatTile({ icon, label, value, tone = 'blue' }) {
  return (
    <div className={`doctor-profile-new-stat is-${tone}`}>
      <span><DoctorIcon name={icon} /></span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text', disabled = false }) {
  return (
    <label className="doctor-profile-new-edit-field">
      <span>{label}</span>
      <input
        type={type}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  )
}

export function DoctorProfilePanel({ user }) {
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [editingPersonal, setEditingPersonal] = useState(false)
  const [editingProfessional, setEditingProfessional] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [personalForm, setPersonalForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    avatar_url: '',
    date_of_birth: '',
    gender: '',
    address: '',
  })
  const [professionalForm, setProfessionalForm] = useState({
    qualification: '',
    academic_title: '',
    specialty: '',
    license_number: '',
    years_of_experience: '',
    languages: '',
  })

  async function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const data = await loadDoctorProfilePanel()
      setState({ loading: false, error: '', data })
    } catch (error) {
      setState({ loading: false, error: error?.message || 'Không thể tải hồ sơ bác sĩ.', data: null })
    }
  }

  useEffect(() => {
    reload()
  }, [])

  const data = state.data
  const me = data?.me
  const account = { ...(user || {}), ...(me?.user || {}) }
  const profile = data?.profile || me?.doctorProfile || {}
  const dashboard = data?.dashboard || {}
  const schedules = safeArray(data?.schedules)
  const weekSchedules = safeArray(data?.weekSchedules)
  const errors = data?.errors || {}
  const shift = dashboard?.today_shift || schedules[0] || null
  const departmentName = pickDepartmentName(me, profile, dashboard, shift)
  const fullName = account.full_name || account.fullName || account.username || 'Bác sĩ'
  const avatar = account.avatar_url || account.avatar || profile.avatar_url || ''
  const showAvatar = Boolean(avatar && !avatarFailed)
  const doctorCode = account.employee_code || account.staff_code || profile.doctor_code || profile.doctorCode || profile.license_code || ''
  const completion = buildCompletion([
    fullName,
    account.email,
    account.phone,
    doctorCode,
    profile.qualification,
    profile.specialty,
    profile.license_number,
    profile.years_of_experience,
    profile.languages,
    departmentName !== 'Chưa cập nhật' ? departmentName : '',
  ])

  const metrics = useMemo(() => {
    const appointments = getDashboardNumber(dashboard, ['appointments_today'], safeArray(dashboard.appointments_today).length)
    const waiting = getDashboardNumber(dashboard, ['waiting_patients'], safeArray(dashboard.waiting_queue).length)
    const active = getDashboardNumber(dashboard, ['active_encounters'], safeArray(dashboard.active_encounters).length)
    const completed = getDashboardNumber(dashboard, ['completed_encounters', 'encounters_completed', 'completed_today'], 0)
    const upcoming = getDashboardNumber(dashboard, ['upcoming_appointments', 'appointments_upcoming'], appointments)
    const visits = getDashboardNumber(dashboard, ['patients_today', 'visits_today', 'encounters_today'], active + completed)
    return { appointments, waiting, active, completed, upcoming, visits }
  }, [dashboard])
  const counters = data?.counters || {}

  useEffect(() => {
    setPersonalForm({
      full_name: fullName || '',
      email: account.email || '',
      phone: account.phone || '',
      avatar_url: account.avatar_url || account.avatar || '',
      date_of_birth: toDateInputValue(account.date_of_birth || account.dob),
      gender: account.gender || '',
      address: account.address || '',
    })
    setProfessionalForm({
      qualification: profile.qualification || '',
      academic_title: profile.academic_title || '',
      specialty: profile.specialty || '',
      license_number: profile.license_number || '',
      years_of_experience: profile.years_of_experience ?? '',
      languages: safeArray(profile.languages).join(', '),
    })
  }, [
    fullName,
    account.email,
    account.phone,
    account.avatar_url,
    account.avatar,
    account.date_of_birth,
    account.dob,
    account.gender,
    account.address,
    profile.profile_id,
    profile.doctor_profile_id,
  ])

  useEffect(() => {
    setAvatarFailed(false)
  }, [avatar])

  async function savePersonal() {
    setSaving(true)
    setSaveError('')
    try {
      const response = await authAPI.updateMyProfile({
        full_name: personalForm.full_name,
        email: personalForm.email,
        phone: personalForm.phone,
        avatar_url: personalForm.avatar_url,
        date_of_birth: personalForm.date_of_birth,
        gender: personalForm.gender,
        address: personalForm.address,
      })
      const updatedPayload = unwrapData(response)
      syncStoredDoctorUser(updatedPayload?.profile || updatedPayload?.user || updatedPayload)
      setEditingPersonal(false)
      await reload()
    } finally {
      setSaving(false)
    }
  }

  async function saveProfessional() {
    const profileId = getProfileId(me, dashboard) || getId(profile.profile_id) || getId(profile.doctor_profile_id)
    setSaving(true)
    setSaveError('')
    const payload = buildProfessionalPayload(professionalForm)
    try {
      await doctorProfileAPI.updateMe(payload)
      setEditingProfessional(false)
      await reload()
    } catch (error) {
      if (error?.response?.status === 404) {
        if (!profileId) {
          setSaveError('Không tìm thấy hồ sơ chuyên môn để cập nhật.')
          return
        }

        try {
          await adminDoctorProfileAPI.update(profileId, payload)
          setEditingProfessional(false)
          await reload()
        } catch (fallbackError) {
          setSaveError(fallbackError?.response?.data?.message || fallbackError?.message || 'Không thể cập nhật hồ sơ chuyên môn.')
        }
        return
      }
      setSaveError(error?.response?.data?.message || error?.message || 'Không thể cập nhật hồ sơ chuyên môn.')
    } finally {
      setSaving(false)
    }
  }

  if (state.loading && !data) {
    return (
      <div className="doctor-profile-new-page">
        <LoadingState label="Đang tải hồ sơ bác sĩ từ backend..." />
      </div>
    )
  }

  if (state.error && !data) {
    return (
      <div className="doctor-profile-new-page">
        <ErrorState title="Không thể tải hồ sơ bác sĩ" message={state.error} />
      </div>
    )
  }

  return (
    <div className="doctor-profile-new-page">
      <section className="doctor-profile-new-hero">
        <div className="doctor-profile-new-avatar">
          {showAvatar ? <img src={avatar} alt="" onError={() => setAvatarFailed(true)} /> : <span>{getInitials(fullName) || 'BS'}</span>}
          <i />
        </div>
        <div className="doctor-profile-new-identity">
          <div>
            <h2>{fullName}</h2>
            <b><DoctorIcon name="check_circle" /> {formatStatus(profile.status || account.status)}</b>
          </div>
          <p>{profile.academic_title || profile.qualification || 'Bác sĩ'} · {profile.specialty || departmentName}</p>
          <div className="doctor-profile-new-meta">
            <span><DoctorIcon name="user" /> Mã bác sĩ: {doctorCode || 'Chưa cập nhật'}</span>
            <span><DoctorIcon name="message" /> {account.email || 'Chưa cập nhật email'}</span>
            <span><DoctorIcon name="bell" /> {account.phone || 'Chưa cập nhật SĐT'}</span>
            <span><DoctorIcon name="pulse" /> Khoa: {departmentName}</span>
            <span><DoctorIcon name="clock" /> {profile.years_of_experience ?? 0} năm kinh nghiệm</span>
            <span><DoctorIcon name="pin" /> {pickRoomName(shift)}</span>
          </div>
        </div>
        <div className="doctor-profile-new-actions">
          <button type="button" onClick={() => setEditingPersonal(true)}><DoctorIcon name="settings" /> Chỉnh sửa hồ sơ</button>
          <button type="button" onClick={() => navigate('/doctor/schedules/week')}><DoctorIcon name="calendar" /> Xem lịch làm việc</button>
        </div>
      </section>

      <section className="doctor-profile-new-grid">
        <ProfileCard
          title="Thông tin cá nhân"
          action={
            <CardActions
              editing={editingPersonal}
              saving={saving}
              onEdit={() => setEditingPersonal(true)}
              onSave={savePersonal}
              onCancel={() => setEditingPersonal(false)}
            />
          }
        >
          {editingPersonal ? (
            <div className="doctor-profile-new-edit-grid">
              <EditField label="Họ tên" value={personalForm.full_name} onChange={(value) => setPersonalForm((form) => ({ ...form, full_name: value }))} />
              <EditField label="Số điện thoại" value={personalForm.phone} onChange={(value) => setPersonalForm((form) => ({ ...form, phone: value }))} />
              <EditField label="Email" value={personalForm.email} onChange={(value) => setPersonalForm((form) => ({ ...form, email: value }))} />
              <EditField label="Avatar URL" value={personalForm.avatar_url} onChange={(value) => setPersonalForm((form) => ({ ...form, avatar_url: value }))} />
              <EditField label="Ngày sinh" type="date" value={personalForm.date_of_birth} onChange={(value) => setPersonalForm((form) => ({ ...form, date_of_birth: value }))} />
              <EditField label="Giới tính" value={personalForm.gender} onChange={(value) => setPersonalForm((form) => ({ ...form, gender: value }))} />
              <EditField label="Địa chỉ" value={personalForm.address} onChange={(value) => setPersonalForm((form) => ({ ...form, address: value }))} />
              <EditField label="Trạng thái tài khoản" value={formatStatus(account.status)} disabled />
            </div>
          ) : (
            <div className="doctor-profile-new-info-list">
              <InfoLine label="Họ tên" value={fullName} />
              <InfoLine label="Số điện thoại" value={account.phone} />
              <InfoLine label="Email" value={account.email} />
              <InfoLine label="Avatar" value={account.avatar_url || account.avatar} />
              <InfoLine label="Ngày sinh" value={formatDate(account.date_of_birth || account.dob)} />
              <InfoLine label="Giới tính" value={account.gender} />
              <InfoLine label="Địa chỉ" value={account.address} />
              <InfoLine label="Trạng thái tài khoản" value={formatStatus(account.status)} />
            </div>
          )}
        </ProfileCard>

        <ProfileCard
          title="Chuyên môn & chứng chỉ"
          action={
            <CardActions
              editing={editingProfessional}
              saving={saving}
              editLabel="Cập nhật"
              onEdit={() => setEditingProfessional(true)}
              onSave={saveProfessional}
              onCancel={() => setEditingProfessional(false)}
            />
          }
        >
          {editingProfessional ? (
            <div className="doctor-profile-new-edit-grid">
              <EditField label="Học vị" value={professionalForm.qualification} onChange={(value) => setProfessionalForm((form) => ({ ...form, qualification: value }))} />
              <EditField label="Chức danh" value={professionalForm.academic_title} onChange={(value) => setProfessionalForm((form) => ({ ...form, academic_title: value }))} />
              <EditField label="Chuyên khoa" value={professionalForm.specialty} onChange={(value) => setProfessionalForm((form) => ({ ...form, specialty: value }))} />
              <EditField label="Số giấy phép" value={professionalForm.license_number} onChange={(value) => setProfessionalForm((form) => ({ ...form, license_number: value }))} />
              <EditField label="Kinh nghiệm" type="number" value={professionalForm.years_of_experience} onChange={(value) => setProfessionalForm((form) => ({ ...form, years_of_experience: value }))} />
              <EditField label="Ngôn ngữ" value={professionalForm.languages} onChange={(value) => setProfessionalForm((form) => ({ ...form, languages: value }))} />
            </div>
          ) : (
            <div className="doctor-profile-new-info-list">
              <InfoLine label="Mã bác sĩ" value={doctorCode} />
              <InfoLine label="Học vị" value={profile.qualification || profile.academic_title} />
              <InfoLine label="Chuyên khoa" value={profile.specialty || departmentName} />
              <InfoLine label="Khoa/phòng ban" value={departmentName} />
              <InfoLine label="Số giấy phép hành nghề" value={profile.license_number} />
              <InfoLine label="Kinh nghiệm" value={profile.years_of_experience !== undefined ? `${profile.years_of_experience} năm` : ''} />
              <InfoLine label="Ngôn ngữ" value={formatLanguages(profile.languages)} />
              <InfoLine label="Chứng chỉ nổi bật" value={safeArray(profile.certifications).join(', ') || profile.subspecialty || profile.biography} />
              <InfoLine label="Trạng thái hồ sơ" value={formatStatus(profile.status)} />
            </div>
          )}
          {saveError ? <p className="doctor-profile-new-muted">{saveError}</p> : null}
          {errors.profile ? <p className="doctor-profile-new-muted">Không thể tải chi tiết hồ sơ chuyên môn. Đang hiển thị dữ liệu tài khoản hiện có.</p> : null}
        </ProfileCard>

        <ProfileCard title="Hoàn tất hồ sơ" className="doctor-profile-new-completion-card">
          <div className="doctor-profile-new-completion-main">
            <div className="doctor-profile-new-progress" style={{ '--profile-progress': `${completion}%` }}>
              <span><strong>{completion}%</strong><small>Hoàn tất</small></span>
            </div>
            <p>Hồ sơ bác sĩ đang được tính trực tiếp từ thông tin tài khoản, hồ sơ chuyên môn và dữ liệu vận hành.</p>
          </div>
          <button type="button" className="doctor-profile-new-completion-button" onClick={() => setEditingProfessional(true)}>
            Bổ sung hồ sơ <DoctorIcon name="chevron_right" />
          </button>
        </ProfileCard>
      </section>

      <section className="doctor-profile-new-lower-grid">
        <ProfileCard title="Lịch làm việc hôm nay">
          <div className="doctor-profile-new-schedule-list">
            {schedules.length ? schedules.slice(0, 3).map((schedule, index) => {
              const scheduleState = getScheduleState(schedule)
              return (
                <div key={schedule.schedule_id || schedule.id || index} className="doctor-profile-new-schedule-row">
                  <span><DoctorIcon name={index === 0 ? 'pulse' : 'clock'} /></span>
                  <div>
                    <strong>{getScheduleTitle(schedule, index)}</strong>
                    <small>{formatScheduleRange(schedule)}</small>
                  </div>
                  <em>{pickRoomName(schedule)}</em>
                  <b className={`is-${scheduleState.tone}`}>{scheduleState.label}</b>
                </div>
              )
            }) : <p className="doctor-profile-new-muted">{errors.schedules ? 'Không thể tải lịch làm việc hôm nay.' : 'Chưa có ca làm việc hôm nay.'}</p>}
          </div>
          <button type="button" className="doctor-profile-new-link" onClick={() => navigate('/doctor/schedules/today')}>Xem chi tiết <DoctorIcon name="chevron_right" /></button>
          {errors.weekSchedules ? <p className="doctor-profile-new-muted">Không thể tải lịch tuần từ /api/schedules/my/week.</p> : null}
        </ProfileCard>

        <ProfileCard title="Hiệu suất hôm nay">
          <div className="doctor-profile-new-stat-grid">
            <StatTile icon="calendar" label="Lịch hẹn" value={metrics.appointments} tone="blue" />
            <StatTile icon="patients" label="Hàng đợi" value={metrics.waiting} tone="orange" />
            <StatTile icon="doctor" label="Đang khám" value={metrics.active} tone="purple" />
            <StatTile icon="check_circle" label="Đã hoàn tất" value={metrics.completed} tone="green" />
          </div>
          {errors.dashboard ? <p className="doctor-profile-new-muted">Không thể tải hiệu suất hôm nay, các chỉ số đang dùng giá trị an toàn.</p> : null}
        </ProfileCard>

        <ProfileCard title="Dữ liệu hệ thống đồng bộ">
          <div className="doctor-profile-new-sync-grid">
            <StatTile icon="bell" label="Thông báo chưa đọc" value={data?.unreadCount ?? counters.unread_notifications ?? 0} tone="blue" />
            <StatTile icon="doctor" label="Lượt khám hôm nay" value={metrics.visits} tone="green" />
            <StatTile icon="calendar" label="Cuộc hẹn sắp tới" value={metrics.upcoming} tone="purple" />
            <StatTile icon="clock" label="Tin nhắn chưa đọc" value={counters.unread_messages ?? 0} tone="orange" />
          </div>
          {errors.unreadCount || errors.counters ? <p className="doctor-profile-new-muted">Một phần dữ liệu thông báo chưa tải được.</p> : null}
          {errors.preferences ? <p className="doctor-profile-new-muted">Không thể tải cài đặt cá nhân từ /api/preferences/me.</p> : null}
        </ProfileCard>
      </section>

      <section className="doctor-profile-new-support">
        <strong><DoctorIcon name="message" /> Liên hệ khẩn cấp / Hỗ trợ nội bộ</strong>
        <div>
          <span>Ca trong tuần <b>{weekSchedules.length}</b></span>
          <span>Phòng hôm nay <b>{pickRoomName(shift)}</b></span>
          <span>Khoa <b>{departmentName}</b></span>
        </div>
      </section>
    </div>
  )
}
