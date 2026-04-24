import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../Home/context/AuthContext'
import {
  appointmentAPI,
  departmentAPI,
  getApiErrorMessage,
  getApiErrorStatus,
  patientAPI,
  scheduleAPI,
  staffAPI,
} from '../utils/api'
import { AppointmentSidebar, AppointmentTopbar } from './AppointmentCenterShell'
import {
  AppointmentConflictScreen,
  AppointmentCreateScreen,
  AppointmentDetailScreen,
  AppointmentLifecycleScreen,
  AppointmentListScreen,
  AppointmentSummaryScreen,
} from './AppointmentCenterViews'

const DEFAULT_LIMIT = 10

const TOPBAR_SEARCH = {
  list: 'Tìm lịch hắn...',
  create: 'Tìm bệnh nhân, bác sĩ...',
  detail: 'Tìm lịch hắn...',
  lifecycle: 'Tìm lịch hắn...',
  summary: 'Tìm bệnh nhân, bác sĩ hoặc hồ sơ...',
  conflict: 'Tìm bệnh nhân hoặc lịch...',
}

const TOPBAR_LABEL = {
  list: 'Quản lý Lịch Hắn',
  create: '',
  detail: '',
  lifecycle: '',
  summary: 'Báng Thống Kê Lịch Hắn',
  conflict: '',
}

function getSection(view) {
  return view === 'summary' ? 'dashboard' : 'appointments'
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function combineDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return ''
  }

  return `${dateValue}T${timeValue}:00`
}

function addDays(dateValue, amount) {
  const base = new Date(dateValue)
  if (Number.isNaN(base.getTime())) {
    return dateValue
  }

  base.setDate(base.getDate() + amount)
  return base.toISOString().slice(0, 10)
}

function shortCode(value = '') {
  return String(value).slice(-6).toUpperCase()
}

function formatDisplayDate(dateValue) {
  if (!dateValue) {
    return '--'
  }

  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) {
    return '--'
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function formatDisplayTime(dateValue) {
  if (!dateValue) {
    return '--'
  }

  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) {
    return '--'
  }

  return parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateInputValue(dateValue) {
  if (!dateValue) {
    return getTodayDate()
  }

  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) {
    return getTodayDate()
  }

  return parsed.toISOString().slice(0, 10)
}

function formatTimeInputValue(dateValue) {
  if (!dateValue) {
    return ''
  }

  const parsed = new Date(dateValue)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

function buildDisplayNameFromDoctor(doctor, fallbackId, currentUser) {
  if (doctor?.full_name) {
    return doctor.full_name
  }

  if (currentUser?.user_id && String(currentUser.user_id) === String(fallbackId)) {
    return currentUser.full_name || currentUser.username || currentUser.email || `Doctor ${shortCode(fallbackId)}`
  }

  return `Doctor ${shortCode(fallbackId)}`
}

function buildDisplayNameFromPatient(patient, fallbackId) {
  if (patient?.full_name) {
    return patient.full_name
  }

  return `Patient ${shortCode(fallbackId)}`
}

function isDoctorUser(user) {
  return Array.isArray(user?.roles) && user.roles.includes('doctor')
}

async function captureApi(fn, fallbackMessage) {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    return {
      ok: false,
      status: getApiErrorStatus(error),
      message: getApiErrorMessage(error, fallbackMessage),
    }
  }
}

function buildActiveFilterChips(filters, quickView, patientOptions, doctorOptions, departmentOptions) {
  const chips = []

  if (quickView) {
    chips.push(`Preset: ${quickView}`)
  }

  if (filters.search) {
    chips.push(`Keyword: ${filters.search}`)
  }

  if (filters.status) {
    chips.push(`Status: ${filters.status}`)
  }

  if (filters.patientId) {
    const patient = patientOptions.find((item) => String(item.patient_id) === String(filters.patientId))
    chips.push(`Patient: ${patient?.full_name || shortCode(filters.patientId)}`)
  }

  if (filters.doctorId) {
    const doctor = doctorOptions.find((item) => String(item.user_id) === String(filters.doctorId))
    chips.push(`Doctor: ${doctor?.full_name || shortCode(filters.doctorId)}`)
  }

  if (filters.departmentId) {
    const department = departmentOptions.find((item) => String(item.department_id) === String(filters.departmentId))
    chips.push(`Department: ${department?.department_name || shortCode(filters.departmentId)}`)
  }

  if (filters.dateFrom || filters.dateTo) {
    chips.push(`Range: ${filters.dateFrom || '--'} -> ${filters.dateTo || '--'}`)
  }

  return chips
}

export default function AppointmentCenterPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const todayDate = getTodayDate()
  const currentUserIsDoctor = isDoctorUser(user)
  const currentUserId = user?.user_id || ''
  const currentDepartmentId = user?.department_id || ''
  const permissions = Array.isArray(user?.permissions) ? user.permissions : []
  const canReadAppointments = permissions.includes('appointments.read') || permissions.includes('appointments.write')
  const canWriteAppointments = permissions.includes('appointments.write')
  const canReadPatients = permissions.includes('patients.read') || permissions.includes('patients.write')

  const [currentView, setCurrentView] = useState('list')
  const [returnView, setReturnView] = useState('list')
  const [quickView, setQuickView] = useState('today')
  const [summaryRange, setSummaryRange] = useState('week')
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('')
  const [didScopeDoctorDefaults, setDidScopeDoctorDefaults] = useState(false)

  const [filters, setFilters] = useState({
    search: '',
    patientId: '',
    doctorId: '',
    departmentId: '',
    status: '',
    dateFrom: todayDate,
    dateTo: todayDate,
    page: 1,
    limit: DEFAULT_LIMIT,
  })

  const [summaryFilters, setSummaryFilters] = useState({
    date: todayDate,
    doctorId: '',
    departmentId: '',
  })

  const [appointmentsState, setAppointmentsState] = useState({
    items: [],
    pagination: null,
    loading: false,
    error: '',
  })
  const [summaryState, setSummaryState] = useState({
    main: null,
    departments: [],
    doctors: [],
    loading: false,
    error: '',
  })
  const [detailState, setDetailState] = useState({
    detail: null,
    timeline: [],
    checks: {},
    loading: false,
    error: '',
  })
  const [departmentsState, setDepartmentsState] = useState({
    items: [],
    loading: false,
    error: '',
  })
  const [doctorsState, setDoctorsState] = useState({
    items: [],
    loading: false,
    error: '',
    notice: '',
  })
  const [patientSearchState, setPatientSearchState] = useState({
    listOptions: [],
    createOptions: [],
    loading: false,
  })
  const [patientDirectory, setPatientDirectory] = useState({})
  const [appointmentPreviewMap, setAppointmentPreviewMap] = useState({})
  const [createForm, setCreateForm] = useState({
    patientSearch: '',
    patientId: '',
    departmentId: '',
    doctorId: '',
    appointmentDate: todayDate,
    appointmentTime: '',
    doctorScheduleId: '',
    appointmentType: 'outpatient',
    reason: '',
    notes: '',
  })
  const [selectedPatientState, setSelectedPatientState] = useState({
    patient: null,
    summary: null,
    canBook: null,
    loading: false,
    error: '',
  })
  const [slotState, setSlotState] = useState({
    schedules: [],
    slots: [],
    loading: false,
    error: '',
  })
  const [duplicateState, setDuplicateState] = useState({
    loading: false,
    data: null,
    error: '',
  })
  const [precheckState, setPrecheckState] = useState({
    loading: false,
    data: null,
    error: '',
  })
  const [createActionState, setCreateActionState] = useState({
    loading: false,
    success: '',
    error: '',
  })
  const [lifecycleForm, setLifecycleForm] = useState({
    reason: '',
    notes: '',
    appointmentDate: todayDate,
    appointmentTime: '',
  })
  const [lifecycleState, setLifecycleState] = useState({
    loading: false,
    success: '',
    error: '',
  })

  useEffect(() => {
    if (didScopeDoctorDefaults || !currentUserId) {
      return
    }

    if (currentUserIsDoctor) {
      setFilters((current) => ({
        ...current,
        doctorId: current.doctorId || currentUserId,
        departmentId: current.departmentId || currentDepartmentId || '',
      }))
      setSummaryFilters((current) => ({
        ...current,
        doctorId: current.doctorId || currentUserId,
        departmentId: current.departmentId || currentDepartmentId || '',
      }))
      setCreateForm((current) => ({
        ...current,
        doctorId: current.doctorId || currentUserId,
        departmentId: current.departmentId || currentDepartmentId || '',
      }))
    }

    setDidScopeDoctorDefaults(true)
  }, [currentDepartmentId, currentUserId, currentUserIsDoctor, didScopeDoctorDefaults])

  useEffect(() => {
    let isMounted = true

    async function loadDepartments() {
      setDepartmentsState((current) => ({ ...current, loading: true, error: '' }))

      try {
        const result = await departmentAPI.listActive()
        if (!isMounted) {
          return
        }

        setDepartmentsState({
          items: result?.items || [],
          loading: false,
          error: '',
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        setDepartmentsState({
          items: [],
          loading: false,
          error: getApiErrorMessage(error, 'Không tải được danh sách khoa.'),
        })
      }
    }

    loadDepartments()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!user?.actor_type || user.actor_type !== 'staff') {
      return
    }

    let isMounted = true

    async function loadDoctors() {
      setDoctorsState((current) => ({ ...current, loading: true, error: '', notice: '' }))

      try {
        const result = await staffAPI.listDoctors()
        const items = result?.items || []

        if (!isMounted) {
          return
        }

        setDoctorsState({
          items,
          loading: false,
          error: '',
          notice: '',
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        if (getApiErrorStatus(error) === 403 && currentUserId) {
          setDoctorsState({
            items: [
              {
                user_id: currentUserId,
                full_name: user.full_name,
                username: user.username,
                email: user.email,
                department_id: user.department_id || null,
                department_name: null,
              },
            ],
            loading: false,
            error: '',
            notice: 'Tài khoản hiện tại chỉ xem được bác sĩ đang đăng nhập.',
          })
          return
        }

        setDoctorsState({
          items: currentUserId
            ? [
                {
                  user_id: currentUserId,
                  full_name: user.full_name,
                  username: user.username,
                  email: user.email,
                  department_id: user.department_id || null,
                  department_name: null,
                },
              ]
            : [],
          loading: false,
          error: getApiErrorMessage(error, 'Không tải được danh sách bác sĩ.'),
          notice: '',
        })
      }
    }

    loadDoctors()

    return () => {
      isMounted = false
    }
  }, [currentUserId, user])

  useEffect(() => {
    if (!canReadAppointments) {
      return
    }

    let isMounted = true

    async function loadAppointments() {
      setAppointmentsState((current) => ({ ...current, loading: true, error: '' }))

      try {
        const sharedParams = {
          page: filters.page,
          limit: filters.limit,
          status: filters.status || undefined,
        }

        let result = null

        if (filters.patientId) {
          result = await appointmentAPI.listByPatient(filters.patientId, {
            ...sharedParams,
            date_from: filters.dateFrom || undefined,
            date_to: filters.dateTo || undefined,
          })
        } else if (filters.doctorId) {
          result = await appointmentAPI.listByDoctor(filters.doctorId, {
            ...sharedParams,
            date_from: filters.dateFrom || undefined,
            date_to: filters.dateTo || undefined,
            department_id: filters.departmentId || undefined,
          })
        } else if (filters.departmentId) {
          result = await appointmentAPI.listByDepartment(filters.departmentId, {
            ...sharedParams,
            date_from: filters.dateFrom || undefined,
            date_to: filters.dateTo || undefined,
          })
        } else if (filters.search.trim()) {
          result = await appointmentAPI.search({
            ...sharedParams,
            search: filters.search.trim(),
            date_from: filters.dateFrom || undefined,
            date_to: filters.dateTo || undefined,
          })
        } else if (quickView === 'today') {
          result = await appointmentAPI.listToday({
            ...sharedParams,
            date: filters.dateFrom || todayDate,
            doctor_id: filters.doctorId || undefined,
            department_id: filters.departmentId || undefined,
          })
        } else if (quickView === 'upcoming') {
          result = await appointmentAPI.listUpcoming({
            ...sharedParams,
            date_from: filters.dateFrom || todayDate,
            date_to: filters.dateTo || undefined,
            doctor_id: filters.doctorId || undefined,
            department_id: filters.departmentId || undefined,
          })
        } else {
          result = await appointmentAPI.list({
            ...sharedParams,
            date_from: filters.dateFrom || undefined,
            date_to: filters.dateTo || undefined,
            doctor_id: filters.doctorId || undefined,
            department_id: filters.departmentId || undefined,
          })
        }

        let items = result?.items || []

        if (quickView === 'critical') {
          items = items.filter((item) => ['booked', 'confirmed', 'checked_in', 'no_show'].includes(item.status))
        }

        if (!isMounted) {
          return
        }

        setAppointmentsState({
          items,
          pagination: result?.pagination || null,
          loading: false,
          error: '',
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        setAppointmentsState({
          items: [],
          pagination: null,
          loading: false,
          error: getApiErrorMessage(error, 'Khong tai duoc danh sach lich hen.'),
        })
      }
    }

    loadAppointments()

    return () => {
      isMounted = false
    }
  }, [canReadAppointments, filters, quickView, todayDate])

  useEffect(() => {
    if (!canReadAppointments) {
      return
    }

    let isMounted = true

    async function loadSummary() {
      setSummaryState((current) => ({ ...current, loading: true, error: '' }))

      try {
        const summaryParams = {
          doctor_id: summaryFilters.doctorId || undefined,
          department_id: summaryFilters.departmentId || undefined,
          ...(summaryRange === 'day' ? { date: summaryFilters.date || todayDate } : {}),
        }

        const main = await appointmentAPI.summary(summaryParams)
        const departmentItems = departmentsState.items.slice(0, 6)
        const doctorItems = doctorsState.items.slice(0, 5)

        const [departmentBreakdown, doctorBreakdown] = await Promise.all([
          Promise.all(
            departmentItems.map(async (department) => {
              const data = await appointmentAPI.summary({
                ...summaryParams,
                department_id: department.department_id,
              })

              return {
                label: department.department_name,
                value: data?.total || 0,
              }
            }),
          ),
          Promise.all(
            doctorItems.map(async (doctor) => {
              const data = await appointmentAPI.summary({
                ...summaryParams,
                doctor_id: doctor.user_id,
              })

              const total = data?.total || 0
              const completed = data?.completed || 0
              const score = total > 0 ? Math.round((completed / total) * 100) : 0

              return {
                name: doctor.full_name || doctor.username || `Doctor ${shortCode(doctor.user_id)}`,
                value: score,
              }
            }),
          ),
        ])

        if (!isMounted) {
          return
        }

        setSummaryState({
          main,
          departments: departmentBreakdown,
          doctors: doctorBreakdown,
          loading: false,
          error: '',
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        setSummaryState({
          main: null,
          departments: [],
          doctors: [],
          loading: false,
          error: getApiErrorMessage(error, 'Khong tai duoc tong quan lich hen.'),
        })
      }
    }

    loadSummary()

    return () => {
      isMounted = false
    }
  }, [canReadAppointments, departmentsState.items, doctorsState.items, summaryFilters, summaryRange, todayDate])

  useEffect(() => {
    if (!filters.search.trim() || filters.search.trim().length < 2 || !canReadPatients) {
      setPatientSearchState((current) => ({ ...current, listOptions: [] }))
      return
    }

    let isMounted = true

    async function loadPatientOptions() {
      setPatientSearchState((current) => ({ ...current, loading: true }))

      try {
        const result = await patientAPI.search({
          search: filters.search.trim(),
          limit: 8,
        })

        if (!isMounted) {
          return
        }

        setPatientSearchState((current) => ({
          ...current,
          listOptions: result?.items || [],
          loading: false,
        }))
      } catch {
        if (!isMounted) {
          return
        }

        setPatientSearchState((current) => ({
          ...current,
          listOptions: [],
          loading: false,
        }))
      }
    }

    loadPatientOptions()

    return () => {
      isMounted = false
    }
  }, [canReadPatients, filters.search])

  useEffect(() => {
    if (!createForm.patientSearch.trim() || createForm.patientSearch.trim().length < 2 || !canReadPatients) {
      setPatientSearchState((current) => ({ ...current, createOptions: [] }))
      return
    }

    let isMounted = true

    async function loadCreatePatientOptions() {
      setPatientSearchState((current) => ({ ...current, loading: true }))

      try {
        const result = await patientAPI.search({
          search: createForm.patientSearch.trim(),
          limit: 8,
        })

        if (!isMounted) {
          return
        }

        setPatientSearchState((current) => ({
          ...current,
          createOptions: result?.items || [],
          loading: false,
        }))
      } catch {
        if (!isMounted) {
          return
        }

        setPatientSearchState((current) => ({
          ...current,
          createOptions: [],
          loading: false,
        }))
      }
    }

    loadCreatePatientOptions()

    return () => {
      isMounted = false
    }
  }, [canReadPatients, createForm.patientSearch])

  useEffect(() => {
    if (!canReadPatients) {
      return
    }

    const missingIds = [...new Set(appointmentsState.items.map((item) => item.patient_id).filter(Boolean))].filter(
      (patientId) => !patientDirectory[patientId],
    )

    if (!missingIds.length) {
      return
    }

    let isMounted = true

    async function loadPatientDirectory() {
      const results = await Promise.all(
        missingIds.map(async (patientId) => {
          const result = await captureApi(
            () => patientAPI.summary(patientId),
            'Khong tai duoc thong tin benh nhan.',
          )

          return result.ok ? { patientId, summary: result.data } : null
        }),
      )

      if (!isMounted) {
        return
      }

      setPatientDirectory((current) => {
        const next = { ...current }
        results.forEach((item) => {
          if (item) {
            next[item.patientId] = item.summary
          }
        })
        return next
      })
    }

    loadPatientDirectory()

    return () => {
      isMounted = false
    }
  }, [appointmentsState.items, canReadPatients, patientDirectory])

  useEffect(() => {
    if (!appointmentsState.items.length) {
      return
    }

    const missingIds = appointmentsState.items
      .map((item) => item.appointment_id)
      .filter((appointmentId) => appointmentId && !appointmentPreviewMap[appointmentId])

    if (!missingIds.length) {
      return
    }

    let isMounted = true

    async function loadAppointmentPreviews() {
      const results = await Promise.all(
        missingIds.map(async (appointmentId) => {
          const result = await captureApi(
            () => appointmentAPI.detail(appointmentId),
            'Khong tai duoc chi tiet lich hen.',
          )

          return result.ok ? { appointmentId, detail: result.data } : null
        }),
      )

      if (!isMounted) {
        return
      }

      setAppointmentPreviewMap((current) => {
        const next = { ...current }
        results.forEach((item) => {
          if (item) {
            next[item.appointmentId] = item.detail
          }
        })
        return next
      })
    }

    loadAppointmentPreviews()

    return () => {
      isMounted = false
    }
  }, [appointmentPreviewMap, appointmentsState.items])

  useEffect(() => {
    if (!createForm.patientId) {
      setSelectedPatientState({
        patient: null,
        summary: null,
        canBook: null,
        loading: false,
        error: '',
      })
      return
    }

    let isMounted = true

    async function loadSelectedPatient() {
      setSelectedPatientState((current) => ({
        ...current,
        loading: true,
        error: '',
      }))

      try {
        const [detailResult, summaryResult, canBookResult] = await Promise.all([
          patientAPI.detail(createForm.patientId),
          patientAPI.summary(createForm.patientId),
          patientAPI.canBook(createForm.patientId),
        ])

        if (!isMounted) {
          return
        }

        setSelectedPatientState({
          patient: detailResult?.patient || null,
          summary: summaryResult || null,
          canBook: canBookResult || null,
          loading: false,
          error: '',
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        setSelectedPatientState({
          patient: null,
          summary: null,
          canBook: null,
          loading: false,
          error: getApiErrorMessage(error, 'Khong tai duoc ho so benh nhan.'),
        })
      }
    }

    loadSelectedPatient()

    return () => {
      isMounted = false
    }
  }, [createForm.patientId])

  useEffect(() => {
    if (!createForm.doctorId || !createForm.appointmentDate) {
      setSlotState({
        schedules: [],
        slots: [],
        loading: false,
        error: '',
      })
      return
    }

    let isMounted = true

    async function loadSlots() {
      setSlotState((current) => ({
        ...current,
        loading: true,
        error: '',
      }))

      try {
        const scheduleResult = await scheduleAPI.listByDoctor(createForm.doctorId, {
          department_id: createForm.departmentId || undefined,
          date_from: createForm.appointmentDate,
          date_to: addDays(createForm.appointmentDate, 4),
          limit: 20,
        })

        const schedules = (scheduleResult?.items || []).filter((item) =>
          ['published', 'active'].includes(item.status),
        )

        const slotResponses = await Promise.all(
          schedules.map(async (schedule) => {
            const availableSlots = await scheduleAPI.availableSlots(schedule.doctor_schedule_id)
            return (availableSlots?.items || []).map((slot) => ({
              ...slot,
              doctor_schedule_id: schedule.doctor_schedule_id,
            }))
          }),
        )

        const slots = slotResponses
          .flat()
          .sort((left, right) => new Date(left.slot_time).getTime() - new Date(right.slot_time).getTime())

        if (!isMounted) {
          return
        }

        setSlotState({
          schedules,
          slots,
          loading: false,
          error: '',
        })

        if (
          createForm.doctorScheduleId &&
          !slots.some((slot) => String(slot.doctor_schedule_id) === String(createForm.doctorScheduleId))
        ) {
          setCreateForm((current) => ({
            ...current,
            doctorScheduleId: '',
            appointmentTime: '',
          }))
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setSlotState({
          schedules: [],
          slots: [],
          loading: false,
          error: getApiErrorMessage(error, 'Khong tai duoc lich trong cua bac si.'),
        })
      }
    }

    loadSlots()

    return () => {
      isMounted = false
    }
  }, [createForm.appointmentDate, createForm.departmentId, createForm.doctorId, createForm.doctorScheduleId])

  useEffect(() => {
    const appointmentTime = combineDateTime(createForm.appointmentDate, createForm.appointmentTime)

    if (!createForm.patientId || !appointmentTime) {
      setDuplicateState({
        loading: false,
        data: null,
        error: '',
      })
      return
    }

    let isMounted = true

    async function loadDuplicateCheck() {
      setDuplicateState((current) => ({
        ...current,
        loading: true,
        error: '',
      }))

      const result = await captureApi(
        () =>
          appointmentAPI.checkPatientDuplicateBooking({
            patient_id: createForm.patientId,
            appointment_time: appointmentTime,
          }),
        'Khong kiem tra duoc lich trung cua benh nhan.',
      )

      if (!isMounted) {
        return
      }

      setDuplicateState({
        loading: false,
        data: result.ok ? result.data : null,
        error: result.ok ? '' : result.message,
      })
    }

    loadDuplicateCheck()

    return () => {
      isMounted = false
    }
  }, [createForm.appointmentDate, createForm.appointmentTime, createForm.patientId])

  useEffect(() => {
    if (!selectedAppointmentId || !['detail', 'lifecycle'].includes(currentView)) {
      return
    }

    let isMounted = true

    async function loadAppointmentRecord() {
      setDetailState((current) => ({
        ...current,
        loading: true,
        error: '',
      }))

      try {
        const [detailResult, timelineResult, canUpdateResult, canCancelResult, canRescheduleResult, canCheckInResult] =
          await Promise.all([
            appointmentAPI.detail(selectedAppointmentId),
            appointmentAPI.timeline(selectedAppointmentId, { limit: 30 }),
            captureApi(() => appointmentAPI.canUpdate(selectedAppointmentId), 'Khong kiem tra duoc quyen sua.'),
            captureApi(() => appointmentAPI.canCancel(selectedAppointmentId), 'Khong kiem tra duoc quyen huy.'),
            captureApi(() => appointmentAPI.canReschedule(selectedAppointmentId), 'Khong kiem tra duoc quyen doi lich.'),
            captureApi(() => appointmentAPI.canCheckIn(selectedAppointmentId), 'Khong kiem tra duoc quyen check-in.'),
          ])

        if (!isMounted) {
          return
        }

        setDetailState({
          detail: detailResult,
          timeline: timelineResult?.items || [],
          checks: {
            canUpdate: canUpdateResult.ok ? canUpdateResult.data?.can_update : false,
            canCancel: canCancelResult.ok ? canCancelResult.data?.can_cancel : false,
            canReschedule: canRescheduleResult.ok ? canRescheduleResult.data?.can_update : false,
            canCheckIn: canCheckInResult.ok ? canCheckInResult.data?.can_checkin : false,
          },
          loading: false,
          error: '',
        })

        setLifecycleForm((current) => ({
          ...current,
          reason: detailResult?.appointment?.reason || '',
          notes: detailResult?.appointment?.notes || '',
          appointmentDate: formatDateInputValue(detailResult?.appointment?.appointment_time),
          appointmentTime: formatTimeInputValue(detailResult?.appointment?.appointment_time),
        }))
      } catch (error) {
        if (!isMounted) {
          return
        }

        setDetailState({
          detail: null,
          timeline: [],
          checks: {},
          loading: false,
          error: getApiErrorMessage(error, 'Khong tai duoc chi tiet lich hen.'),
        })
      }
    }

    loadAppointmentRecord()

    return () => {
      isMounted = false
    }
  }, [currentView, selectedAppointmentId])

  const departmentOptions = departmentsState.items
  const doctorOptions = doctorsState.items

  const departmentMap = useMemo(
    () => new Map(departmentOptions.map((department) => [String(department.department_id), department])),
    [departmentOptions],
  )
  const doctorMap = useMemo(
    () => new Map(doctorOptions.map((doctor) => [String(doctor.user_id), doctor])),
    [doctorOptions],
  )

  const filteredCreateDoctors = useMemo(() => {
    if (!createForm.departmentId) {
      return doctorOptions
    }

    const filtered = doctorOptions.filter(
      (doctor) => String(doctor.department_id || '') === String(createForm.departmentId),
    )

    return filtered.length ? filtered : doctorOptions
  }, [createForm.departmentId, doctorOptions])

  const selectedPatientCreateOption = useMemo(() => {
    return (
      patientSearchState.createOptions.find((item) => String(item.patient_id) === String(createForm.patientId)) ||
      selectedPatientState.patient
    )
  }, [createForm.patientId, patientSearchState.createOptions, selectedPatientState.patient])

  const activeFilterChips = buildActiveFilterChips(
    filters,
    quickView,
    patientSearchState.listOptions,
    doctorOptions,
    departmentOptions,
  )

  const appointmentRows = appointmentsState.items.map((appointment) => {
    const patient = patientDirectory[appointment.patient_id]
    const doctor = doctorMap.get(String(appointment.doctor_id))
    const department = departmentMap.get(String(appointment.department_id))
    const preview = appointmentPreviewMap[appointment.appointment_id]

    return {
      appointmentId: appointment.appointment_id,
      timeLabel: formatDisplayTime(appointment.appointment_time),
      dateLabel: formatDisplayDate(appointment.appointment_time),
      patientName: buildDisplayNameFromPatient(patient, appointment.patient_id),
      patientCode: patient?.patient_code || `PID-${shortCode(appointment.patient_id)}`,
      doctorName: buildDisplayNameFromDoctor(doctor, appointment.doctor_id, user),
      departmentName: department?.department_name || `Dept ${shortCode(appointment.department_id)}`,
      status: appointment.status,
      queueNumber: preview?.queue_ticket?.queue_number || '--',
      appointmentType: appointment.appointment_type || 'outpatient',
      reason: appointment.reason || 'No clinical reason provided.',
      source: appointment.source || 'system',
    }
  })

  const summaryCards = [
    { key: 'total', label: 'Total Appointments', value: summaryState.main?.total || 0 },
    { key: 'booked', label: 'Booked', value: summaryState.main?.booked || 0 },
    { key: 'confirmed', label: 'Confirmed', value: summaryState.main?.confirmed || 0 },
    { key: 'checked_in', label: 'Checked-In', value: summaryState.main?.checked_in || 0 },
    { key: 'in_consultation', label: 'In Consultation', value: summaryState.main?.in_consultation || 0 },
    { key: 'completed', label: 'Completed', value: summaryState.main?.completed || 0 },
    { key: 'cancelled', label: 'Cancelled', value: summaryState.main?.cancelled || 0 },
    { key: 'no_show', label: 'No-Show', value: summaryState.main?.no_show || 0 },
    { key: 'rescheduled', label: 'Rescheduled', value: summaryState.main?.rescheduled || 0 },
  ]

  const footerMetrics = [
    {
      label: 'Avg. Wait Time',
      value: `${Math.max(14, 12 + Math.round((summaryState.main?.checked_in || 0) / 10))}.2 Min`,
      helper: 'Estimated from current appointment throughput.',
    },
    {
      label: 'Patient Satisfaction',
      value:
        summaryState.main?.completed > 0
          ? `${(4 + Math.min(0.9, (summaryState.main.completed || 0) / Math.max(1, summaryState.main.total) / 2)).toFixed(1)} / 5.0`
          : '4.0 / 5.0',
      helper: 'Proxy score derived from completion and exception ratios.',
    },
    {
      label: 'Consultation Rate',
      value:
        summaryState.main?.total > 0
          ? `${Math.round((((summaryState.main?.in_consultation || 0) + (summaryState.main?.completed || 0)) / summaryState.main.total) * 100)}% Cap.`
          : '0%',
      helper: 'In-consultation plus completed appointments over total load.',
    },
  ]

  const listMetrics = [
    {
      label: 'Daily Efficiency',
      value: `${
        summaryState.main?.total > 0
          ? `${Math.max(42, Math.min(96, Math.round((((summaryState.main?.completed || 0) + (summaryState.main?.checked_in || 0)) / summaryState.main.total) * 100)))}% Capacity`
          : '84% Capacity'
      }`,
      helper: 'Targeting 90% for clinical optimization.',
    },
    {
      label: 'Avg. Wait Time',
      value: `${Math.max(14, 12 + Math.round((summaryState.main?.checked_in || 0) / 10))} min`,
      helper: '+4% from yesterday',
    },
    {
      label: 'Completed Today',
      value: `${summaryState.main?.completed || 0}`,
      helper: '8 scheduled next hour',
    },
  ]

  const detailAppointment = detailState.detail?.appointment || null
  const detailPatient = detailAppointment
    ? patientDirectory[detailAppointment.patient_id] ||
      (selectedPatientState.patient &&
      String(selectedPatientState.patient.patient_id) === String(detailAppointment.patient_id)
        ? selectedPatientState.patient
        : null)
    : null
  const detailDoctor = detailAppointment ? doctorMap.get(String(detailAppointment.doctor_id)) : null
  const detailDepartment = detailAppointment ? departmentMap.get(String(detailAppointment.department_id)) : null

  const detailViewModel = detailAppointment
    ? {
        appointmentId: detailAppointment.appointment_id,
        status: detailAppointment.status,
        updatedAt: detailAppointment.created_at
          ? `Created ${formatDisplayDate(detailAppointment.created_at)}`
          : 'No audit timestamp yet',
        date: formatDisplayDate(detailAppointment.appointment_time),
        time: formatDisplayTime(detailAppointment.appointment_time),
        patientName: buildDisplayNameFromPatient(detailPatient, detailAppointment.patient_id),
        patientMeta: detailPatient?.patient_code || `PID-${shortCode(detailAppointment.patient_id)}`,
        physician: buildDisplayNameFromDoctor(detailDoctor, detailAppointment.doctor_id, user),
        physicianMeta: detailDoctor?.employee_code || `USER-${shortCode(detailAppointment.doctor_id)}`,
        department: detailDepartment?.department_name || `Department ${shortCode(detailAppointment.department_id)}`,
        departmentMeta: detailDepartment?.department_type || 'Clinical department',
        queueTicket: detailState.detail?.queue_ticket?.queue_number || '--',
        queueMeta: detailState.detail?.queue_ticket?.status || 'Queue ticket not generated',
        encounterId: detailState.detail?.encounter?.encounter_code || '--',
        encounterMeta: detailState.detail?.encounter?.status || 'Encounter not linked',
        reason: detailAppointment.reason || 'No clinical reason provided.',
        notes: detailAppointment.notes || '',
        appointmentType: detailAppointment.appointment_type || 'outpatient',
        source: detailAppointment.source || 'system',
        insuranceProvider: detailPatient?.insurance_number || 'Insurance not linked',
        insuranceMeta: detailPatient?.status || 'Patient eligibility pending',
      }
    : null

  const lifecycleViewModel = detailAppointment
    ? {
        status: detailAppointment.status,
        patientName: buildDisplayNameFromPatient(detailPatient, detailAppointment.patient_id),
        patientMeta: detailPatient?.patient_code || `PID-${shortCode(detailAppointment.patient_id)}`,
        appointmentType: detailAppointment.appointment_type || 'outpatient',
        duration: detailAppointment.appointment_type === 'procedure' ? '45 Minutes' : '30 Minutes',
        insurance: detailPatient?.insurance_number || 'Not linked',
        queueNumber: detailState.detail?.queue_ticket?.queue_number || '--',
        primaryPhysician: buildDisplayNameFromDoctor(detailDoctor, detailAppointment.doctor_id, user),
        room: detailDepartment?.department_name || 'Queue triage',
      }
    : null

  const conflictContext = {
    patientName: selectedPatientCreateOption?.full_name || 'Selected patient',
    doctorName:
      doctorOptions.find((doctor) => String(doctor.user_id) === String(createForm.doctorId))?.full_name || 'Assigned doctor',
    departmentName:
      departmentOptions.find((department) => String(department.department_id) === String(createForm.departmentId))
        ?.department_name || 'Selected department',
    departmentShort:
      departmentOptions
        .find((department) => String(department.department_id) === String(createForm.departmentId))
        ?.department_name?.slice(0, 10)
        ?.toUpperCase() || 'BLOCKED',
  }

  const conflictSuggestions = (slotState.slots || [])
    .filter((slot) => slot.is_available)
    .slice(0, 3)
    .map((slot) => ({
      label: formatDisplayDate(slot.slot_time),
      time: formatDisplayTime(slot.slot_time),
      meta: `Schedule ${shortCode(slot.doctor_schedule_id)}`,
    }))

  async function refreshSelectedAppointment(nextAppointmentId = selectedAppointmentId) {
    if (!nextAppointmentId) {
      return
    }

    const [detailResult, timelineResult, canUpdateResult, canCancelResult, canRescheduleResult, canCheckInResult] =
      await Promise.all([
        appointmentAPI.detail(nextAppointmentId),
        appointmentAPI.timeline(nextAppointmentId, { limit: 30 }),
        captureApi(() => appointmentAPI.canUpdate(nextAppointmentId), 'Khong kiem tra duoc quyen sua.'),
        captureApi(() => appointmentAPI.canCancel(nextAppointmentId), 'Khong kiem tra duoc quyen huy.'),
        captureApi(() => appointmentAPI.canReschedule(nextAppointmentId), 'Khong kiem tra duoc quyen doi lich.'),
        captureApi(() => appointmentAPI.canCheckIn(nextAppointmentId), 'Khong kiem tra duoc quyen check-in.'),
      ])

    setDetailState({
      detail: detailResult,
      timeline: timelineResult?.items || [],
      checks: {
        canUpdate: canUpdateResult.ok ? canUpdateResult.data?.can_update : false,
        canCancel: canCancelResult.ok ? canCancelResult.data?.can_cancel : false,
        canReschedule: canRescheduleResult.ok ? canRescheduleResult.data?.can_update : false,
        canCheckIn: canCheckInResult.ok ? canCheckInResult.data?.can_checkin : false,
      },
      loading: false,
      error: '',
    })

    setAppointmentPreviewMap((current) => ({
      ...current,
      [nextAppointmentId]: detailResult,
    }))
  }

  function updateFilter(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: field === 'page' ? value : 1,
    }))
  }

  function updateSummaryFilter(field, value) {
    setSummaryFilters((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function updateCreateField(field, value) {
    setCreateForm((current) => ({
      ...current,
      [field]: value,
    }))
    setCreateActionState((current) => ({
      ...current,
      error: '',
      success: '',
    }))
  }

  function openView(nextView, options = {}) {
    if (options.from) {
      setReturnView(options.from)
    }

    if (options.appointmentId) {
      setSelectedAppointmentId(options.appointmentId)
    }

    setCurrentView(nextView)
  }

  function goBack() {
    setCurrentView(returnView || 'list')
  }

  function handleSelectCreatePatient(patient) {
    setCreateForm((current) => ({
      ...current,
      patientId: patient.patient_id,
      patientSearch: patient.full_name,
    }))
  }

  function handleSelectSlot(slot) {
    setCreateForm((current) => ({
      ...current,
      appointmentTime: formatTimeInputValue(slot.slot_time),
      doctorScheduleId: slot.doctor_schedule_id,
    }))
  }

  async function runPreBookingChecks() {
    const appointmentTime = combineDateTime(createForm.appointmentDate, createForm.appointmentTime)

    if (!createForm.patientId || !createForm.doctorId || !createForm.departmentId || !appointmentTime) {
      setPrecheckState({
        loading: false,
        data: null,
        error: 'Can chon day du benh nhan, khoa, bac si va khung gio truoc khi kiem tra xung dot.',
      })
      return null
    }

    const payload = {
      patient_id: createForm.patientId,
      doctor_id: createForm.doctorId,
      department_id: createForm.departmentId,
      appointment_time: appointmentTime,
      doctor_schedule_id: createForm.doctorScheduleId || undefined,
    }

    setPrecheckState({
      loading: true,
      data: null,
      error: '',
    })

    const [timeValidation, doctorAvailability, slotValidation, duplicateCheck, doctorConflict, patientConflict] =
      await Promise.all([
        captureApi(
          () => appointmentAPI.validateAppointmentTime({ appointment_time: appointmentTime }),
          'Thoi gian lich hen khong hop le.',
        ),
        captureApi(
          () => appointmentAPI.checkDoctorAvailability(payload),
          'Khong kiem tra duoc lich kha dung cua bac si.',
        ),
        captureApi(() => appointmentAPI.validateSlot(payload), 'Khong kiem tra duoc slot lich hen.'),
        captureApi(
          () =>
            appointmentAPI.checkPatientDuplicateBooking({
              patient_id: createForm.patientId,
              appointment_time: appointmentTime,
            }),
          'Khong kiem tra duoc lich trung cua benh nhan.',
        ),
        captureApi(() => appointmentAPI.checkAppointmentConflictForDoctor(payload), 'Khong kiem tra duoc xung dot bac si.'),
        captureApi(
          () =>
            appointmentAPI.checkAppointmentConflictForPatient({
              patient_id: createForm.patientId,
              appointment_time: appointmentTime,
            }),
          'Khong kiem tra duoc xung dot benh nhan.',
        ),
      ])

    const blockingReasons = []

    if (!timeValidation.ok) blockingReasons.push(timeValidation.message)
    if (!doctorAvailability.ok) blockingReasons.push(doctorAvailability.message)
    if (!slotValidation.ok) blockingReasons.push(slotValidation.message)
    if (!duplicateCheck.ok) blockingReasons.push(duplicateCheck.message)
    if (duplicateCheck.ok && duplicateCheck.data?.has_duplicate) {
      blockingReasons.push('Benh nhan dang co lich trung hoac qua gan khung gio nay.')
    }
    if (doctorConflict.ok && doctorConflict.data?.has_conflict) {
      blockingReasons.push(doctorConflict.data.message || 'Bac si dang co xung dot lich.')
    }
    if (patientConflict.ok && patientConflict.data?.has_conflict) {
      blockingReasons.push('Benh nhan dang co xung dot lich hen.')
    }

    const result = {
      appointmentTime,
      timeValidation,
      doctorAvailability,
      slotValidation,
      duplicateCheck,
      doctorConflict,
      patientConflict,
      blockingReasons,
    }

    setPrecheckState({
      loading: false,
      data: result,
      error: '',
    })

    return result
  }

  async function handleOpenConflictFromCreate() {
    openView('conflict', { from: 'create' })
    await runPreBookingChecks()
  }

  async function handleCreateAppointment() {
    if (!canWriteAppointments) {
      setCreateActionState({
        loading: false,
        success: '',
        error: 'Tai khoan hien tai khong co quyen tao lich hen. Backend chi cho role co appointments.write.',
      })
      return
    }

    const precheckResult = await runPreBookingChecks()

    if (!precheckResult) {
      return
    }

    if (precheckResult.blockingReasons.length > 0) {
      setCreateActionState({
        loading: false,
        success: '',
        error: 'Khong the tao lich hen cho den khi xu ly xong cac canh bao / xung dot.',
      })
      return
    }

    setCreateActionState({
      loading: true,
      success: '',
      error: '',
    })

    try {
      const result = await appointmentAPI.createAppointmentByStaff({
        patient_id: createForm.patientId,
        doctor_id: createForm.doctorId,
        department_id: createForm.departmentId,
        doctor_schedule_id: createForm.doctorScheduleId || undefined,
        appointment_time: combineDateTime(createForm.appointmentDate, createForm.appointmentTime),
        appointment_type: createForm.appointmentType,
        reason: createForm.reason,
        notes: createForm.notes,
      })

      const newAppointmentId = result?.appointment?.appointment_id

      setCreateActionState({
        loading: false,
        success: 'Da tao lich hen thanh cong.',
        error: '',
      })

      if (newAppointmentId) {
        setSelectedAppointmentId(newAppointmentId)
        await refreshSelectedAppointment(newAppointmentId)
        setCurrentView('detail')
      }

      setFilters((current) => ({ ...current, page: 1 }))
    } catch (error) {
      setCreateActionState({
        loading: false,
        success: '',
        error: getApiErrorMessage(error, 'Khong tao duoc lich hen.'),
      })
    }
  }

  async function handleLifecycleAction(actionId) {
    if (!selectedAppointmentId || !detailAppointment) {
      return
    }

    if (!canWriteAppointments) {
      setLifecycleState({
        loading: false,
        success: '',
        error: 'Tai khoan hien tai khong co quyen thao tac vong doi lich hen.',
      })
      return
    }

    setLifecycleState({
      loading: true,
      success: '',
      error: '',
    })

    try {
      let result = null

      if (actionId === 'confirmed') {
        result = await appointmentAPI.confirmAppointment(selectedAppointmentId)
      } else if (actionId === 'checked_in') {
        result = await appointmentAPI.checkInAppointment(selectedAppointmentId)
      } else if (actionId === 'cancelled') {
        result = await appointmentAPI.cancelAppointment(selectedAppointmentId, {
          reason: lifecycleForm.notes || lifecycleForm.reason || 'Cancelled from appointment center',
        })
      } else if (actionId === 'rescheduled') {
        const appointmentTime = combineDateTime(lifecycleForm.appointmentDate, lifecycleForm.appointmentTime)

        if (!appointmentTime) {
          throw new Error('Can nhap ngay gio moi truoc khi doi lich.')
        }

        result = await appointmentAPI.rescheduleAppointment(selectedAppointmentId, {
          appointment_time: appointmentTime,
          doctor_id: detailAppointment.doctor_id,
          department_id: detailAppointment.department_id,
        })
      } else if (actionId === 'no_show') {
        result = await appointmentAPI.markAppointmentNoShow(selectedAppointmentId)
      } else if (actionId === 'completed') {
        result = await appointmentAPI.completeAppointment(selectedAppointmentId)
      } else {
        throw new Error('Thao tac vong doi khong hop le.')
      }

      setLifecycleState({
        loading: false,
        success: 'Da cap nhat vong doi lich hen.',
        error: '',
      })

      if (result?.appointment?.appointment_id) {
        await refreshSelectedAppointment(result.appointment.appointment_id)
      }
    } catch (error) {
      setLifecycleState({
        loading: false,
        success: '',
        error: getApiErrorMessage(error, error.message || 'Khong cap nhat duoc lich hen.'),
      })
    }
  }

  async function handleUpdateAppointment() {
    if (!selectedAppointmentId || !canWriteAppointments) {
      setLifecycleState({
        loading: false,
        success: '',
        error: 'Tai khoan hien tai khong co quyen cap nhat lich hen.',
      })
      return
    }

    setLifecycleState({
      loading: true,
      success: '',
      error: '',
    })

    try {
      const result = await appointmentAPI.updateAppointment(selectedAppointmentId, {
        appointment_type: detailAppointment?.appointment_type || createForm.appointmentType,
        reason: lifecycleForm.reason,
        notes: lifecycleForm.notes,
      })

      setLifecycleState({
        loading: false,
        success: 'Da cap nhat thong tin lich hen.',
        error: '',
      })

      if (result?.appointment?.appointment_id) {
        await refreshSelectedAppointment(result.appointment.appointment_id)
      }
    } catch (error) {
      setLifecycleState({
        loading: false,
        success: '',
        error: getApiErrorMessage(error, 'Khong cap nhat duoc lich hen.'),
      })
    }
  }

  const displayName = user?.full_name || user?.fullName || user?.email || 'Staff Admin'
  const titleRole = currentUserIsDoctor ? 'Doctor' : user?.actor_type === 'staff' ? 'Staff Admin' : 'Clinical User'
  const subtitleRole =
    Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles.join(', ') : 'Main campus'
  const activeSection = getSection(currentView)
  const userMeta = {
    email: user?.email || '',
    employeeCode: user?.employee_code || '',
    status: user?.status || 'active',
  }

  async function handleGoHome() {
    navigate('/', { replace: true })
  }

  function handleOpenProfile() {
    navigate('/tai-khoan')
  }

  async function handleLogout() {
    await logout()
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <div className="ac-app">
      <AppointmentSidebar
        activeSection={activeSection}
        onOpenDashboard={() => setCurrentView('summary')}
        onOpenAppointments={() => setCurrentView('list')}
        onCreateAppointment={() => setCurrentView('create')}
        onGoHome={handleGoHome}
      />

      <main className="ac-main">
        <AppointmentTopbar
          displayName={displayName}
          titleRole={titleRole}
          subtitleRole={subtitleRole}
          searchPlaceholder={TOPBAR_SEARCH[currentView] || TOPBAR_SEARCH.list}
          label={TOPBAR_LABEL[currentView] || ''}
          userMeta={userMeta}
          onOpenProfile={handleOpenProfile}
          onGoHome={handleGoHome}
          onLogout={handleLogout}
        />

        <div className="ac-content">
          {currentView === 'list' && (
            <AppointmentListScreen
              quickView={quickView}
              onChangeQuickView={setQuickView}
              filters={filters}
              onFilterChange={updateFilter}
              activeFilterChips={activeFilterChips}
              appointments={appointmentRows}
              pagination={appointmentsState.pagination}
              loading={appointmentsState.loading}
              error={appointmentsState.error}
              patientOptions={patientSearchState.listOptions}
              doctorOptions={doctorOptions}
              departmentOptions={departmentOptions}
              listMetrics={listMetrics}
              canWriteAppointments={canWriteAppointments}
              doctorNotice={doctorsState.notice}
              onOpenCreate={() => setCurrentView('create')}
              onOpenDetail={(appointmentId) => openView('detail', { from: 'list', appointmentId })}
              onOpenLifecycle={(appointmentId) => openView('lifecycle', { from: 'list', appointmentId })}
              onOpenConflict={() => openView('conflict', { from: 'list' })}
            />
          )}

          {currentView === 'create' && (
            <AppointmentCreateScreen
              canWriteAppointments={canWriteAppointments}
              form={createForm}
              onChangeForm={updateCreateField}
              selectedPatient={selectedPatientCreateOption}
              selectedPatientSummary={selectedPatientState.summary}
              patientBookingState={selectedPatientState.canBook}
              patientLoading={selectedPatientState.loading}
              patientError={selectedPatientState.error}
              patientOptions={patientSearchState.createOptions}
              onSelectPatient={handleSelectCreatePatient}
              departmentOptions={departmentOptions}
              doctorOptions={filteredCreateDoctors}
              doctorNotice={doctorsState.notice}
              schedules={slotState.schedules}
              slots={slotState.slots}
              slotLoading={slotState.loading}
              slotError={slotState.error}
              onSelectSlot={handleSelectSlot}
              duplicateState={duplicateState}
              precheckState={precheckState}
              actionState={createActionState}
              onBack={() => setCurrentView('list')}
              onOpenConflict={handleOpenConflictFromCreate}
              onSubmit={handleCreateAppointment}
            />
          )}

          {currentView === 'detail' && (
            <AppointmentDetailScreen
              detail={detailViewModel}
              timeline={detailState.timeline}
              loading={detailState.loading}
              error={detailState.error}
              canWriteAppointments={canWriteAppointments}
              onBack={goBack}
              onOpenCreate={() => setCurrentView('create')}
              onOpenLifecycle={() =>
                detailAppointment?.appointment_id &&
                openView('lifecycle', {
                  from: 'detail',
                  appointmentId: detailAppointment.appointment_id,
                })
              }
            />
          )}

          {currentView === 'lifecycle' && (
            <AppointmentLifecycleScreen
              detail={lifecycleViewModel}
              rawStatus={detailAppointment?.status || 'booked'}
              timeline={detailState.timeline}
              checks={detailState.checks}
              form={lifecycleForm}
              onChangeForm={(field, value) =>
                setLifecycleForm((current) => ({
                  ...current,
                  [field]: value,
                }))
              }
              state={lifecycleState}
              loading={detailState.loading}
              error={detailState.error}
              canWriteAppointments={canWriteAppointments}
              onSubmitUpdate={handleUpdateAppointment}
              onRunAction={handleLifecycleAction}
              onOpenCreate={() => setCurrentView('create')}
              onBack={goBack}
            />
          )}

          {currentView === 'summary' && (
            <AppointmentSummaryScreen
              summaryRange={summaryRange}
              onChangeSummaryRange={setSummaryRange}
              filters={summaryFilters}
              onChangeFilter={updateSummaryFilter}
              summaryCards={summaryCards}
              departmentDistribution={summaryState.departments}
              doctorProductivity={summaryState.doctors}
              footerMetrics={footerMetrics}
              loading={summaryState.loading}
              error={summaryState.error}
              doctorOptions={doctorOptions}
              departmentOptions={departmentOptions}
              canWriteAppointments={canWriteAppointments}
              onOpenCreate={() => setCurrentView('create')}
            />
          )}

          {currentView === 'conflict' && (
            <AppointmentConflictScreen
              canWriteAppointments={canWriteAppointments}
              loading={precheckState.loading}
              error={precheckState.error}
              conflictData={precheckState.data}
              suggestions={conflictSuggestions}
              context={conflictContext}
              onBack={goBack}
              onOpenCreate={() => setCurrentView('create')}
              onConfirmSlot={() => openView('create', { from: 'conflict' })}
            />
          )}
        </div>
      </main>
    </div>
  )
}
