import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../lib/api'
import { fetchWithAuth } from '../lib/authSession'
import { clearStoredAuth, readStoredAuth } from '../lib/storage'
import './receptionist.css'

const GRID_START_HOUR = 6
const GRID_END_HOUR = 21
const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60
const GRID_HEIGHT_PX = 600
const PX_PER_MINUTE = GRID_HEIGHT_PX / GRID_TOTAL_MINUTES
const APPOINTMENT_MARKER_SIZE = 24
const APPOINTMENT_MARKER_GAP = 4
const APPOINTMENT_SLOT_MINUTES = 15

const clinicHours = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, index) => `${String(index + GRID_START_HOUR).padStart(2, '0')}:00`)

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
  { title: 'Cài đặt', items: [{ key: 'settings', label: 'Trạng thái hệ thống', icon: 'settings' }, { key: 'account', label: 'Tài khoản của tôi', icon: 'users' }] },
]

const receptionistRoutes = {
  dashboard: '/receptionist',
  appointments: '/receptionist/appointments',
  createAppointment: '/receptionist/create',
  waitingList: '/receptionist/waiting-list',
  queue: '/receptionist/queue',
  searchPatient: '/receptionist/patients',
  patientRecords: '/receptionist/patient-records',
  cashier: '/receptionist/cashier',
  paymentHistory: '/receptionist/payment-history',
  dailyReport: '/receptionist/daily-report',
  productivity: '/receptionist/productivity',
  settings: '/receptionist/settings',
  account: '/receptionist/account',
}

const statusOptions = [
  ['all', 'Tat ca trang thai'],
  ['booked', 'Da dat'],
  ['confirmed', 'Da xac nhan'],
  ['checked_in', 'Da check-in'],
  ['in_consultation', 'Dang kham'],
  ['completed', 'Hoan thanh'],
  ['cancelled', 'Da huy'],
]

function Icon({ name }) {
  return <span className={`rd-icon rd-icon-${name}`} aria-hidden="true" />
}

function formatTime(value) {
  if (!value) return '--:--'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function toDateInputValue(value) {
  const date = value ? new Date(value) : new Date()
  return date.toISOString().slice(0, 10)
}

function isSameDay(left, right) {
  const leftDate = left instanceof Date ? left : new Date(left)
  const rightDate = right instanceof Date ? right : new Date(right)
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  )
}

function isSameWeek(value, selectedDate) {
  const date = value instanceof Date ? value : new Date(value)
  const reference = new Date(selectedDate)
  const start = new Date(reference)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return date >= start && date <= end
}

function isSameMonth(value, selectedDate) {
  const date = value instanceof Date ? value : new Date(value)
  const reference = new Date(selectedDate)
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth()
}

function isInViewRange(value, selectedDate, viewMode) {
  if (viewMode === 'week') return isSameWeek(value, selectedDate)
  if (viewMode === 'month') return isSameMonth(value, selectedDate)
  return isSameDay(value, selectedDate)
}

function addDays(value, amount) {
  const date = new Date(value)
  date.setDate(date.getDate() + amount)
  return date
}

function appointmentMinutes(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return GRID_START_HOUR * 60
  return date.getHours() * 60 + date.getMinutes()
}

function statusTone(status = '') {
  const normalized = status.toLowerCase()
  if (normalized.includes('checked')) return 'green'
  if (normalized.includes('complete')) return 'blue'
  if (normalized.includes('cancel') || normalized.includes('no_show')) return 'red'
  if (normalized.includes('consult')) return 'purple'
  if (normalized.includes('confirm')) return 'blue'
  return 'violet'
}

function statusLabel(status = '') {
  const labels = {
    booked: 'BOOKED',
    confirmed: 'CONFIRMED',
    checked_in: 'CHECKED IN',
    in_consultation: 'IN ROOM',
    completed: 'DONE',
    cancelled: 'CANCELLED',
    no_show: 'NO SHOW',
  }
  return labels[status] || status.toUpperCase() || 'BOOKED'
}

function doctorInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'BS'
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase()
}

function buildRooms(doctors, appointments) {
  const doctorRooms = doctors.slice(0, 4).map((doctor, index) => ({
    id: doctor.id || doctor._id || `doctor-${index}`,
    title: `Phong kham ${index + 1}`,
    doctor: doctor.name || doctor.full_name || 'Bac si',
    avatar: doctorInitials(doctor.name || doctor.full_name),
  }))

  if (doctorRooms.length > 0) return doctorRooms

  const names = [...new Set(appointments.map((item) => item.doctorName || item.doctor).filter(Boolean))]
  const rooms = names.slice(0, 4).map((name, index) => ({
    id: name,
    title: `Phong kham ${index + 1}`,
    doctor: name,
    avatar: doctorInitials(name),
  }))

  while (rooms.length < 4) {
    const index = rooms.length
    rooms.push({ id: `room-${index + 1}`, title: `Phong kham ${index + 1}`, doctor: 'Chua co bac si', avatar: 'BS' })
  }

  return rooms
}

function getAppointmentRoomIndex(appointment, rooms) {
  const doctorKey = appointment.raw?.doctor_id || appointment.doctorName || appointment.doctor
  const index = rooms.findIndex(
    (room) => room.id === doctorKey || room.doctor === appointment.doctorName || room.doctor === appointment.doctor,
  )
  return index >= 0 ? index : 0
}

function layoutAppointmentsForCalendar(appointments, rooms) {
  return appointments
    .map((appointment) => {
      const roomIndex = getAppointmentRoomIndex(appointment, rooms)
      const minutesFromStart = appointmentMinutes(appointment.appointmentTime) - GRID_START_HOUR * 60
      const slotIndex = Math.max(0, Math.floor(minutesFromStart / APPOINTMENT_SLOT_MINUTES))
      const slotKey = `${roomIndex}-${slotIndex}`
      const naturalTop = Math.max(
        0,
        Math.min(
          GRID_HEIGHT_PX - APPOINTMENT_MARKER_SIZE,
          minutesFromStart * PX_PER_MINUTE,
        ),
      )
      return { appointment, roomIndex, top: naturalTop, slotKey }
    })
    .reduce((items, item) => {
      const slotCount = items.filter((candidate) => candidate.slotKey === item.slotKey).length
      items.push({ ...item, laneIndex: slotCount })
      return items
    }, [])
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || 'Khong the tai du lieu.')
  }
  return payload?.data || payload
}

async function fetchDashboardResource(path) {
  return fetchWithAuth(`${API_BASE_URL}${path}`).then(readJson)
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

function transformDoctor(item, index) {
  const id = item.user_id || item._id || `doctor-${index}`
  return {
    id,
    _id: id,
    name: item.full_name || item.username || 'Bac si',
    department: item.department_name || item.department || 'Phong kham',
  }
}

function transformAppointment(item, patientMap, doctorMap) {
  const id = item.appointment_id || item._id
  const appointmentTime = new Date(item.appointment_time)
  const patientId = String(item.patient_id || '')
  const doctorId = String(item.doctor_id || '')
  const patientName = patientMap.get(patientId) || item.patient_name || item.patientName || `BN ${patientId.slice(-6) || ''}`
  const doctorName = doctorMap.get(doctorId) || item.doctor_name || item.doctorName || 'Bac si'

  return {
    id,
    appointmentTime,
    patientName,
    doctorName,
    doctor: doctorName,
    status: item.status || 'booked',
    type: item.appointment_type || 'outpatient',
    reason: item.reason || item.department_name || '',
    raw: item,
  }
}

function transformQueue(item, index, patientMap) {
  const patientId = String(item.patient_id || '')
  return {
    id: item.queue_ticket_id || item._id || index,
    name: patientMap.get(patientId) || item.patientName || `BN ${patientId.slice(-6) || index + 1}`,
    ticket: item.queue_number || `Q-${index + 1}`,
    status: item.status,
  }
}

export default function ReceptionistDashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const dateInputRef = useRef(null)
  const searchInputRef = useRef(null)
  const auth = readStoredAuth()
  const authUser = auth?.user || {}
  const [doctors, setDoctors] = useState([])
  const [appointments, setAppointments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [patientRecords, setPatientRecords] = useState([])
  const [queueDepartments, setQueueDepartments] = useState([])
  const [doctorStatus, setDoctorStatus] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [selectedRoom, setSelectedRoom] = useState('all')
  const [viewMode, setViewMode] = useState('day')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeHeaderPanel, setActiveHeaderPanel] = useState('')

  const activeSection = location.pathname.includes('/receptionist/appointments') ? 'appointments' : 'dashboard'
  const isAppointmentsPage = activeSection === 'appointments'

  function handleMenuSelection(item) {
    const route = receptionistRoutes[item.key]
    if (route) {
      navigate(route)
      return
    }
    showNotice(`Da chon: ${item.label}`)
  }

  const refetch = useCallback(async () => {
    setLoading(true)
    setError('')

    const results = await Promise.allSettled([
      fetchDashboardResource('/patients?limit=100'),
      fetchDashboardResource('/staff/doctors'),
      fetchDashboardResource('/appointments?limit=100'),
      fetchDashboardResource(`/queue?limit=50&date=${new Date().toISOString().slice(0, 10)}`),
      fetchDashboardResource('/invoices?page=1&limit=100&encounter_only=true'),
    ])

    const [patientsResult, doctorsResult, appointmentsResult, queueResult, invoicesResult] = results
    const failed = results.filter((result) => result.status === 'rejected')

    if (failed.length > 0) {
      setError(`Co ${failed.length} nguon du lieu chua tai duoc. Cac phan con lai van hien thi binh thuong.`)
    }

    try {
      const patientsPayload = patientsResult.status === 'fulfilled' ? patientsResult.value : []
      const doctorsPayload = doctorsResult.status === 'fulfilled' ? doctorsResult.value : []
      const appointmentsPayload = appointmentsResult.status === 'fulfilled' ? appointmentsResult.value : []
      const queuePayload = queueResult.status === 'fulfilled' ? queueResult.value : []
      const invoicesPayload = invoicesResult.status === 'fulfilled' ? invoicesResult.value : []

      const patientItems = itemsFrom(patientsPayload)
      const patientMap = new Map(
        patientItems.map((patient) => [
          String(patient.patient_id || patient._id || ''),
          patient.full_name || patient.name || 'Benh nhan',
        ]),
      )
      const doctorItems = itemsFrom(doctorsPayload).map(transformDoctor)
      const doctorMap = new Map(doctorItems.map((doctor) => [String(doctor.id), doctor.name]))

      setPatientRecords(patientItems)
      setDoctors(doctorItems)
      setAppointments(itemsFrom(appointmentsPayload).map((item) => transformAppointment(item, patientMap, doctorMap)))
      setQueueDepartments(itemsFrom(queuePayload).map((item, index) => transformQueue(item, index, patientMap)))
      setInvoices(itemsFrom(invoicesPayload))
      setDoctorStatus(doctorItems.map((doctor) => ({ name: doctor.name, status: 'available' })))
    } catch (err) {
      setError(err.message || 'Khong the tai du lieu receptionist.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const visibleAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => isInViewRange(appointment.appointmentTime, selectedDate, viewMode))
        .sort((a, b) => appointmentMinutes(a.appointmentTime) - appointmentMinutes(b.appointmentTime)),
    [appointments, selectedDate, viewMode],
  )

  const rooms = useMemo(() => buildRooms(doctors, visibleAppointments), [doctors, visibleAppointments])

  const filteredAppointments = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return visibleAppointments.filter((appointment) => {
      const matchesKeyword =
        !keyword ||
        [appointment.patientName, appointment.doctorName, appointment.reason, appointment.status]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(keyword))
      const roomIndex = getAppointmentRoomIndex(appointment, rooms)
      const matchesRoom = selectedRoom === 'all' || rooms[roomIndex]?.id === selectedRoom
      const matchesStatus = statusFilter === 'all' || appointment.status === statusFilter
      return matchesKeyword && matchesRoom && matchesStatus
    })
  }, [searchTerm, visibleAppointments, rooms, selectedRoom, statusFilter])

  const commandItems = useMemo(() => {
    const now = new Date()
    return visibleAppointments
      .filter((appointment) => !['completed', 'cancelled', 'no_show'].includes(appointment.status))
      .map((appointment) => {
        const minutesUntil = Math.round((appointment.appointmentTime - now) / 60000)
        let tone = 'blue'
        let label = 'Sap den'
        let action = appointment.status === 'booked' ? 'Xac nhan' : 'Check-in'
        if (minutesUntil < 0 && ['booked', 'confirmed'].includes(appointment.status)) {
          tone = 'red'
          label = `Tre ${Math.abs(minutesUntil)} phut`
        } else if (['checked_in'].includes(appointment.status)) {
          tone = 'green'
          label = 'Dang cho kham'
          action = 'Dieu phoi'
        } else if (['in_consultation'].includes(appointment.status)) {
          tone = 'purple'
          label = 'Dang kham'
          action = 'Xem ho so'
        } else if (minutesUntil <= 60) {
          tone = 'orange'
          label = `${Math.max(minutesUntil, 0)} phut nua`
        }
        return { ...appointment, tone, label, action, priority: minutesUntil < 0 ? 0 : minutesUntil }
      })
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 6)
  }, [visibleAppointments])

  const flowColumns = useMemo(() => {
    const source = statusFilter === 'all'
      ? visibleAppointments
      : visibleAppointments.filter((appointment) => appointment.status === statusFilter)
    const definitions = [
      ['booked', 'Da dat'],
      ['confirmed', 'Da xac nhan'],
      ['checked_in', 'Check-in'],
      ['in_consultation', 'Dang kham'],
      ['completed', 'Hoan tat'],
    ]
    return definitions.map(([status, label]) => {
      const items = source.filter((appointment) => appointment.status === status)
      return { status, label, items, count: items.length }
    })
  }, [statusFilter, visibleAppointments])

  const hourlyLoad = useMemo(() => {
    return Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, index) => {
      const hour = GRID_START_HOUR + index
      const items = visibleAppointments.filter((appointment) => {
        const minutes = appointmentMinutes(appointment.appointmentTime)
        return minutes >= hour * 60 && minutes < (hour + 1) * 60
      })
      const delayed = items.filter((appointment) => ['booked', 'confirmed'].includes(appointment.status) && appointment.appointmentTime < new Date()).length
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00`,
        count: items.length,
        delayed,
        level: items.length >= 12 ? 'high' : items.length >= 7 ? 'medium' : 'normal',
      }
    }).filter((slot) => slot.count > 0)
  }, [visibleAppointments])

  const maxHourlyLoad = Math.max(1, ...hourlyLoad.map((slot) => slot.count))

  const roomLoads = useMemo(() => {
    return rooms.map((room, index) => {
      const items = visibleAppointments.filter((appointment) => getAppointmentRoomIndex(appointment, rooms) === index)
      const active = items.filter((appointment) => ['checked_in', 'in_consultation'].includes(appointment.status)).length
      const load = Math.min(100, Math.round((items.length / 12) * 100))
      const tone = load >= 85 ? 'high' : load >= 55 ? 'medium' : 'normal'
      return { ...room, count: items.length, active, load, tone }
    })
  }, [rooms, visibleAppointments])

  const checkedInCount = visibleAppointments.filter((item) => item.status === 'checked_in').length
  const completedCount = visibleAppointments.filter((item) => item.status === 'completed').length
  const waitingCount = queueDepartments.length
  const cancelledCount = visibleAppointments.filter((item) => ['cancelled', 'no_show'].includes(item.status)).length
  const pendingCheckInCount = visibleAppointments.filter((item) => ['booked', 'confirmed'].includes(item.status)).length
  const payableInvoiceCount = invoices.filter((invoice) => ['pending', 'partial'].includes(invoice?.status) && Number(invoice?.amount_due || 0) > 0).length
  const totalForRate = Math.max(visibleAppointments.length, 1)

  const operationAssistantItems = useMemo(() => {
    const busiestSlot = [...hourlyLoad].sort((a, b) => b.count - a.count)[0]
    return [
      {
        id: 'pending-checkin',
        label: `${pendingCheckInCount} lịch cần tiếp nhận`,
        detail: pendingCheckInCount > 0 ? 'Ưu tiên xác nhận/check-in bệnh nhân đã có lịch.' : 'Không có lịch chờ tiếp nhận.',
        tone: pendingCheckInCount > 0 ? 'orange' : 'green',
        action: () => navigate('/receptionist/appointments'),
      },
      {
        id: 'payable-invoices',
        label: `${payableInvoiceCount} hóa đơn chờ thu`,
        detail: payableInvoiceCount > 0 ? 'Mở thu ngân để xử lý hóa đơn còn phải thu.' : 'Không có hóa đơn chờ thu từ dữ liệu tải được.',
        tone: payableInvoiceCount > 0 ? 'blue' : 'green',
        action: () => navigate('/receptionist/cashier'),
      },
      {
        id: 'queue',
        label: `${waitingCount} bệnh nhân trong danh sách chờ`,
        detail: waitingCount > 0 ? 'Theo dõi điều phối phòng khám.' : 'Danh sách chờ đang trống.',
        tone: waitingCount > 5 ? 'red' : waitingCount > 0 ? 'orange' : 'green',
        action: () => navigate('/receptionist/queue'),
      },
      {
        id: 'busiest',
        label: busiestSlot ? `Khung đông nhất: ${busiestSlot.label}` : 'Chưa có khung giờ đông',
        detail: busiestSlot ? `${busiestSlot.count} lịch trong khung giờ này.` : 'Chưa có lịch hẹn trong ngày đang xem.',
        tone: busiestSlot?.level === 'high' ? 'red' : busiestSlot ? 'blue' : 'green',
        action: () => navigate('/receptionist/daily-report'),
      },
    ]
  }, [hourlyLoad, navigate, payableInvoiceCount, pendingCheckInCount, waitingCount])

  const actionableItems = useMemo(() => {
    return [
      pendingCheckInCount > 0 && {
        id: 'pending-checkin',
        label: `${pendingCheckInCount} lịch cần tiếp nhận`,
        detail: 'Xác nhận hoặc check-in lịch hẹn hôm nay.',
        tone: 'orange',
        action: () => navigate('/receptionist/appointments'),
      },
      payableInvoiceCount > 0 && {
        id: 'payable-invoices',
        label: `${payableInvoiceCount} hóa đơn chờ thu`,
        detail: 'Thu tiền các hóa đơn đã hoàn tất khám.',
        tone: 'blue',
        action: () => navigate('/receptionist/cashier'),
      },
      waitingCount > 0 && {
        id: 'queue',
        label: `${waitingCount} bệnh nhân trong queue hôm nay`,
        detail: 'Theo dõi và điều phối danh sách chờ.',
        tone: waitingCount > 5 ? 'red' : 'orange',
        action: () => navigate('/receptionist/queue'),
      },
      cancelledCount > 0 && {
        id: 'cancelled',
        label: `${cancelledCount} lịch hủy/no-show`,
        detail: 'Kiểm tra các lịch cần theo dõi lại.',
        tone: 'red',
        action: () => navigate('/receptionist/appointments'),
      },
    ].filter(Boolean)
  }, [cancelledCount, navigate, payableInvoiceCount, pendingCheckInCount, waitingCount])

  const notifications = useMemo(() => {
    const items = []
    if (error) {
      items.push({ id: 'error', tone: 'danger', title: 'Không thể tải dữ liệu', body: error })
    }
    if (pendingCheckInCount > 0) {
      items.push({
        id: 'pending-checkin',
        tone: 'warning',
        title: `${pendingCheckInCount} lịch hẹn chờ check-in`,
        body: 'Có bệnh nhân đã đặt lịch nhưng chưa được tiếp nhận hôm nay.',
      })
    }
    if (waitingCount > 5) {
      items.push({
        id: 'queue-high',
        tone: 'warning',
        title: `Hàng đợi đông (${waitingCount} người)`,
        body: 'Cần điều phối thêm để giảm thời gian chờ.',
      })
    }
    if (cancelledCount > 0) {
      items.push({
        id: 'cancelled',
        tone: 'info',
        title: `${cancelledCount} lịch hẹn đã hủy/no-show`,
        body: 'Có thể sắp xếp lại khung giờ trống cho bệnh nhân khác.',
      })
    }
    return items
  }, [error, pendingCheckInCount, waitingCount, cancelledCount])
  const receptionRate = Math.round((checkedInCount / totalForRate) * 100)
  const completionRate = Math.round((completedCount / totalForRate) * 100)
  const activeDoctorCount = doctors.filter((doctor) => doctor.status !== 'inactive').length || doctors.length
  const displayUser = authUser?.fullName || authUser?.username || 'Nguyen Linh'
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const searchResults = useMemo(() => {
    if (!normalizedSearchTerm) return []

    const patientMatches = patientRecords
      .filter((patient) =>
        [patient.full_name, patient.name, patient.phone, patient.phone_number, patient.patient_code, patient.medical_record_number]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearchTerm)),
      )
      .slice(0, 4)
      .map((patient) => ({
        id: `patient-${patient.patient_id || patient._id}`,
        type: 'Benh nhan',
        title: patient.full_name || patient.name || 'Benh nhan',
        meta: patient.phone || patient.phone_number || patient.patient_code || 'Ho so benh nhan',
        action: () => showNotice(`Da chon benh nhan: ${patient.full_name || patient.name || 'Benh nhan'}`),
      }))

    const appointmentMatches = appointments
      .filter((appointment) =>
        [appointment.patientName, appointment.doctorName, appointment.reason, appointment.type, appointment.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearchTerm)),
      )
      .slice(0, 4)
      .map((appointment) => ({
        id: `appointment-${appointment.id}`,
        type: 'Lịch hẹn',
        title: appointment.patientName,
        meta: `${formatTime(appointment.appointmentTime)} - ${appointment.doctorName}`,
        action: () => {
          setSelectedDate(appointment.appointmentTime)
          showNotice(`Da mo lich hen cua ${appointment.patientName}.`)
        },
      }))

    const queueMatches = queueDepartments
      .filter((item) =>
        [item.name, item.ticket, item.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearchTerm)),
      )
      .slice(0, 3)
      .map((item) => ({
        id: `queue-${item.id}`,
        type: 'Hang doi',
        title: item.name,
        meta: item.ticket,
        action: () => showNotice(`Da chon phieu hang doi ${item.ticket}.`),
      }))

    return [...patientMatches, ...appointmentMatches, ...queueMatches].slice(0, 7)
  }, [appointments, normalizedSearchTerm, patientRecords, queueDepartments])

  const stats = [
    {
      label: viewMode === 'day' ? 'Lich hen trong ngay' : 'Lich hen dang xem',
      value: visibleAppointments.length,
      detail: cancelledCount > 0 ? `${cancelledCount} lich huy/no-show can theo doi` : 'Tat ca lich dang trong trang thai hop le',
      meta: 'Ke hoach tiep don',
      progress: visibleAppointments.length > 0 ? 100 : 0,
      icon: 'calendar',
      tone: 'purple',
    },
    {
      label: 'Da tiep nhan',
      value: checkedInCount,
      detail: `${receptionRate}% tren tong lich`,
      meta: checkedInCount > 0 ? 'Benh nhan da den quay' : 'Chua co benh nhan check-in',
      progress: receptionRate,
      icon: 'check',
      tone: 'green',
    },
    {
      label: 'Hang doi hien tai',
      value: waitingCount,
      detail: waitingCount > 0 ? 'Can dieu phoi phong kham' : 'Khong co benh nhan dang doi',
      meta: 'Theo queue thoi gian thuc',
      progress: Math.min(100, waitingCount * 10),
      icon: 'clock',
      tone: waitingCount > 8 ? 'orange' : 'blue',
    },
    {
      label: 'Da hoan tat',
      value: completedCount,
      detail: `${completionRate}% lich da ket thuc`,
      meta: 'Ket qua xu ly trong khung xem',
      progress: completionRate,
      icon: 'done',
      tone: 'blue',
    },
    {
      label: 'Bac si san sang',
      value: activeDoctorCount,
      detail: activeDoctorCount > 0 ? `${rooms.length} phong dang cau hinh` : 'Chua co bac si active',
      meta: 'Nguon luc kham benh',
      progress: Math.min(100, (activeDoctorCount / Math.max(rooms.length, 1)) * 100),
      icon: 'patient',
      tone: 'violet',
    },
  ]

  function showNotice(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2500)
  }

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        setActiveHeaderPanel('search')
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function moveDate(direction) {
    const step = viewMode === 'month' ? 30 : viewMode === 'week' ? 7 : 1
    setSelectedDate((current) => addDays(current, direction * step))
  }

  function goToday() {
    setSelectedDate(new Date())
    setViewMode('day')
  }

  async function handleCheckIn(appointmentId) {
    if (!appointmentId) return
    try {
      await fetchWithAuth(`${API_BASE_URL}/appointments/${appointmentId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      await refetch()
      showNotice('Check-in thanh cong.')
    } catch (err) {
      console.error('Check-in failed:', err)
      showNotice('Check-in that bai. Vui long kiem tra trang thai lich hen.')
    }
  }

  async function handleConfirmAppointment(appointmentId) {
    if (!appointmentId) return
    try {
      await fetchWithAuth(`${API_BASE_URL}/appointments/${appointmentId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      await refetch()
      showNotice('Xac nhan lich hen thanh cong.')
    } catch (err) {
      console.error('Confirm appointment failed:', err)
      showNotice('Xac nhan lich hen that bai. Vui long kiem tra trang thai lich hen.')
    }
  }

  async function handleCancelAppointment(appointmentId) {
    if (!appointmentId) return
    try {
      await fetchWithAuth(`${API_BASE_URL}/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      await refetch()
      showNotice('Huy lich hen thanh cong.')
    } catch (err) {
      console.error('Cancel appointment failed:', err)
      showNotice('Huy lich hen that bai. Vui long kiem tra trang thai lich hen.')
    }
  }

  function handleCommandAction(appointment, action) {
    if (!appointment?.id) return
    if (action === 'confirm') {
      handleConfirmAppointment(appointment.id)
      return
    }
    if (action === 'check-in') {
      handleCheckIn(appointment.id)
      return
    }
    if (action === 'cancel') {
      handleCancelAppointment(appointment.id)
      return
    }
    if (appointment.status === 'checked_in') {
      showNotice(`Dieu phoi: ${appointment.patientName}`)
      return
    }
    if (appointment.status === 'in_consultation') {
      showNotice(`Mo ho so: ${appointment.patientName}`)
      return
    }
    showNotice(`${statusLabel(appointment.status)}: ${appointment.patientName}`)
  }

  function commandActionsFor(appointment) {
    if (appointment.status === 'booked') {
      return [
        { action: 'confirm', label: 'Xac nhan', tone: 'green' },
        { action: 'cancel', label: 'Huy lich', tone: 'red' },
      ]
    }
    if (appointment.status === 'confirmed') {
      return [
        { action: 'check-in', label: 'Check-in tiep nhan', tone: 'blue' },
        { action: 'cancel', label: 'Huy lich', tone: 'red' },
      ]
    }
    if (appointment.status === 'checked_in') {
      return [{ action: 'dispatch', label: 'Dieu phoi', tone: 'blue' }]
    }
    if (appointment.status === 'in_consultation') {
      return [{ action: 'record', label: 'Xem ho so', tone: 'blue' }]
    }
    return []
  }

  async function handleLogout() {
    clearStoredAuth()
    navigate('/staff/login', { replace: true })
  }

  function handleQuickAction(label) {
    setActiveHeaderPanel('')

    if (label.startsWith('Dat lich')) {
      navigate('/receptionist/create')
      return
    }

    if (label.startsWith('Check-in')) {
      const nextAppointment = visibleAppointments.find((appointment) => appointment.status === 'confirmed')
      if (nextAppointment) {
        handleCheckIn(nextAppointment.id)
      } else {
        showNotice('Khong co lich da xac nhan phu hop de check-in.')
      }
      return
    }

    if (label.startsWith('Tim')) {
      searchInputRef.current?.focus()
      setActiveHeaderPanel('search')
      showNotice('Nhap ten, so dien thoai hoac ma ho so de tim kiem.')
      return
    }

    if (label.startsWith('Danh sach cho')) {
      navigate('/receptionist/queue')
      return
    }

    showNotice(`Da mo chuc nang: ${label}`)
  }

  function toggleHeaderPanel(panel) {
    setActiveHeaderPanel((current) => (current === panel ? '' : panel))
  }

  return (
    <main className={`rd-app ${sidebarCollapsed ? 'rd-sidebar-collapsed' : ''}`}>
      {notice && <div className="rd-toast">{notice}</div>}
      <aside className="rd-sidebar">
        <div className="rd-brand">
          <div className="rd-logo"><Icon name="logo" /></div>
          <strong>MediCare+</strong>
          <button aria-label="Thu gon" onClick={() => setSidebarCollapsed((value) => !value)}>x</button>
        </div>

        <nav className="rd-nav" aria-label="Receptionist navigation">
          {menuGroups.map((group) => (
            <section key={group.title || 'main'}>
              {group.title && <p>{group.title}</p>}
              {group.items.map((item) => (
                <button
                  type="button"
                  className={activeSection === item.key ? 'active' : ''}
                  key={item.key}
                  onClick={() => handleMenuSelection(item)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.count && <b>{item.count}</b>}
                </button>
              ))}
            </section>
          ))}
        </nav>

        <div className="rd-ai-mini rd-ops-mini">
          <strong>Trợ lý vận hành</strong>
          <p>{pendingCheckInCount + payableInvoiceCount + waitingCount} việc cần theo dõi từ dữ liệu hiện tại</p>
          <button type="button" onClick={() => navigate('/receptionist/daily-report')}>Xem báo cáo ngày</button>
        </div>
      </aside>

      <section className="rd-main">
        <header className="rd-header">
          <div>
            <h1>{activeSection === 'appointments' ? 'Lịch hẹn' : 'Receptionist Dashboard'}</h1>
            <p>
              {activeSection === 'appointments'
                ? 'Quản lý lịch hẹn và phòng khám'
                : `Good morning, ${displayUser}`}
            </p>
          </div>
          <div className={`rd-search-wrap ${activeHeaderPanel === 'search' ? 'open' : ''}`}>
            <label className="rd-search">
              <Icon name="search" />
              <input
                ref={searchInputRef}
                value={searchTerm}
                onFocus={() => setActiveHeaderPanel('search')}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setActiveHeaderPanel('search')
                }}
                placeholder="Tim benh nhan, so dien thoai, ma ho so..."
              />
              {searchTerm ? (
                <button type="button" aria-label="Xoa tim kiem" onClick={() => setSearchTerm('')}>x</button>
              ) : (
                <kbd>Ctrl K</kbd>
              )}
            </label>
            {activeHeaderPanel === 'search' && (
              <div className="rd-header-panel rd-search-panel">
                <header>
                  <strong>Tim nhanh</strong>
                  <button type="button" onClick={() => setActiveHeaderPanel('')}>Dong</button>
                </header>
                {normalizedSearchTerm ? (
                  searchResults.length ? (
                    searchResults.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          item.action()
                          setActiveHeaderPanel('')
                        }}
                      >
                        <span>{item.type}</span>
                        <strong>{item.title}</strong>
                        <small>{item.meta}</small>
                      </button>
                    ))
                  ) : (
                    <p>Khong tim thay ket qua phu hop.</p>
                  )
                ) : (
                  <p>Nhap ten benh nhan, so dien thoai, ma ho so hoac ten bac si.</p>
                )}
              </div>
            )}
          </div>
          <div className="rd-user-actions">
            <div className="rd-action-slot">
              <button aria-label="Mo thao tac nhanh" className="rd-primary-action" onClick={() => toggleHeaderPanel('actions')}><Icon name="plus" /></button>
              {activeHeaderPanel === 'actions' && (
                <div className="rd-header-panel rd-action-panel">
                  <header><strong>Thao tac nhanh</strong><button type="button" onClick={() => setActiveHeaderPanel('')}>Dong</button></header>
                  <button type="button" onClick={() => handleQuickAction('Dat lich moi')}><Icon name="calendar" /><span><strong>Dat lich moi</strong><small>Mo man hinh tao lich kham</small></span></button>
                  <button type="button" onClick={() => handleQuickAction('Check-in benh nhan')}><Icon name="check" /><span><strong>Check-in benh nhan</strong><small>Tiep nhan lich gan nhat</small></span></button>
                  <button type="button" onClick={() => handleQuickAction('Tim benh nhan')}><Icon name="search" /><span><strong>Tim benh nhan</strong><small>Tra cuu ho so va lich hen</small></span></button>
                </div>
              )}
            </div>
            <div className="rd-action-slot">
              <button aria-label="Thong bao" onClick={() => toggleHeaderPanel('notifications')}>
                <Icon name="bell" />
                {notifications.length > 0 && <b>{notifications.length}</b>}
              </button>
              {activeHeaderPanel === 'notifications' && (
                <div className="rd-header-panel rd-notification-panel">
                  <header>
                    <strong>Thông báo</strong>
                    <button type="button" onClick={() => setActiveHeaderPanel('')}>Đóng</button>
                  </header>
                  {notifications.length === 0 ? (
                    <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--rd-muted, #888)' }}>
                      Không có thông báo nào.
                    </p>
                  ) : (
                    notifications.map((item) => (
                      <article key={item.id} className={item.tone}>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </article>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="rd-action-slot">
              <button aria-label="Tin nhan" onClick={() => toggleHeaderPanel('messages')}><Icon name="message" /><b>{waitingCount > 0 ? 1 : 0}</b></button>
              {activeHeaderPanel === 'messages' && (
                <div className="rd-header-panel rd-notification-panel">
                  <header><strong>Tin nhan noi bo</strong><button type="button" onClick={() => setActiveHeaderPanel('')}>Dong</button></header>
                  <article><strong>Phong kham</strong><p>{waitingCount > 0 ? 'Co benh nhan dang cho dieu phoi.' : 'Khong co tin nhan moi.'}</p></article>
                  <button type="button" className="rd-panel-link" onClick={() => handleQuickAction('Danh sach cho')}>Mo danh sach cho</button>
                </div>
              )}
            </div>
            <div className="rd-profile rd-action-slot">
              <button className="rd-profile-trigger" type="button" onClick={() => toggleHeaderPanel('profile')}>
                <div>{doctorInitials(displayUser)}</div>
                <span><strong>{displayUser}</strong><small>Receptionist</small></span>
              </button>
              {activeHeaderPanel === 'profile' && (
                <div className="rd-header-panel rd-profile-panel">
                  <header><strong>Tai khoan nhan su</strong><button type="button" onClick={() => setActiveHeaderPanel('')}>Dong</button></header>
                  <div className="rd-profile-card">
                    <div>{doctorInitials(displayUser)}</div>
                    <span>
                      <strong>{displayUser}</strong>
                      <small>Receptionist Portal</small>
                    </span>
                    <b>Online</b>
                  </div>
                  <button type="button" onClick={() => showNotice('Ho so ca nhan se duoc dong bo voi backend.')}>
                    <Icon name="patient" />
                    <span><strong>Xem ho so</strong><small>Thong tin ca nhan va ca truc</small></span>
                  </button>
                  <button type="button" onClick={() => showNotice('Dang hien thi trang thai phien hien tai.')}>
                    <Icon name="clock" />
                    <span><strong>Phien dang nhap</strong><small>Dang hoat dong tren thiet bi nay</small></span>
                  </button>
                  <button type="button" className="danger" onClick={handleLogout}>
                    <Icon name="logout" />
                    <span><strong>Dang xuat</strong><small>Ket thuc phien lam viec</small></span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {error && (
          <div className="rd-error">
            <span>Khong the tai du lieu: {error}</span>
            <button onClick={refetch}>Tai lai</button>
          </div>
        )}

        <div className="rd-content">
          <section className="rd-dashboard">
            <div className="rd-stats">
              {stats.map((stat) => (
                <article className={`rd-stat ${stat.tone}`} key={stat.label}>
                  <div className="rd-stat-head">
                    <div className={`rd-stat-icon ${stat.tone}`}><Icon name={stat.icon} /></div>
                    <span>{stat.meta}</span>
                  </div>
                  <div className="rd-stat-body">
                    <p>{stat.label}</p>
                    <strong>{loading ? '...' : stat.value}</strong>
                    <span>{stat.detail}</span>
                  </div>
                  <div className="rd-stat-track" aria-hidden="true">
                    <i style={{ width: `${Math.max(6, Math.min(100, stat.progress))}%` }} />
                  </div>
                </article>
              ))}
            </div>

            <section className="rd-command-center">
              <header className="rd-command-head">
                <div>
                  <span>Dieu phoi ca truc</span>
                  <strong>{formatDate(selectedDate)}</strong>
                </div>
                <div>
                  <button onClick={goToday}>Hom nay</button>
                  <button aria-label="Ngay truoc" onClick={() => moveDate(-1)}>{'<'}</button>
                  <button aria-label="Ngay sau" onClick={() => moveDate(1)}>{'>'}</button>
                  <button aria-label="Chon ngay" onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}>
                    <Icon name="calendar" />
                  </button>
                  <input
                    ref={dateInputRef}
                    className="rd-hidden-date"
                    type="date"
                    value={toDateInputValue(selectedDate)}
                    onChange={(event) => setSelectedDate(new Date(`${event.target.value}T00:00:00`))}
                  />
                </div>
              </header>

              <div className="rd-command-grid">
                <section className="rd-worklist">
                  <header>
                    <div>
                      <h2>Viec can xu ly ngay</h2>
                      <p>{commandItems.length} muc uu tien trong ca</p>
                    </div>
                    <button type="button" onClick={refetch}>Lam moi</button>
                  </header>
                  <div>
                    {commandItems.length ? commandItems.map((item) => (
                      <article key={item.id} className={`rd-work-item ${item.tone}`}>
                        <time>{formatTime(item.appointmentTime)}</time>
                        <div>
                          <strong>{item.patientName}</strong>
                          <span>{item.doctorName} - {item.reason || item.type || 'Lich kham'}</span>
                        </div>
                        <b>{item.label}</b>
                        <div className="rd-work-actions">
                          {commandActionsFor(item).map((action) => (
                            <button
                              key={action.action}
                              type="button"
                              className={`is-${action.tone}`}
                              onClick={() => handleCommandAction(item, action.action)}
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </article>
                    )) : (
                      <p className="rd-command-empty">Khong co viec uu tien can xu ly.</p>
                    )}
                  </div>
                </section>

                <section className="rd-room-load">
                  <header>
                    <h2>Tai phong kham</h2>
                    <span>{rooms.length} phong</span>
                  </header>
                  {roomLoads.map((room) => (
                    <article key={room.id}>
                      <div>
                        <strong>{room.title}</strong>
                        <span>{room.doctor}</span>
                      </div>
                      <b className={`is-${room.tone}`}>{room.count} lich</b>
                      <div className="rd-room-meter"><i style={{ width: `${Math.max(6, room.load)}%` }} /></div>
                      <small>{room.active} dang xu ly</small>
                    </article>
                  ))}
                </section>
              </div>

              <section className="rd-flow-board">
                <header>
                  <h2>Luong benh nhan hom nay</h2>
                  <button type="button" onClick={() => setShowFilters((value) => !value)}>
                    <Icon name="filter" /> Loc trang thai
                  </button>
                </header>
                {showFilters && (
                  <div className="rd-filterbar">
                    {statusOptions.map(([value, label]) => (
                      <button key={value} className={statusFilter === value ? 'active' : ''} onClick={() => setStatusFilter(value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <div>
                  {flowColumns.map((column) => (
                    <article key={column.status} className={`rd-flow-column ${statusTone(column.status)}`}>
                      <header>
                        <span>{column.label}</span>
                        <strong>{column.count}</strong>
                      </header>
                      {column.items.slice(0, 3).map((item) => (
                        <button key={item.id} type="button" onClick={() => showNotice(`${item.patientName} - ${statusLabel(item.status)}`)}>
                          <b>{formatTime(item.appointmentTime)}</b>
                          <span>{item.patientName}</span>
                        </button>
                      ))}
                      {column.items.length === 0 && <p>Trong</p>}
                    </article>
                  ))}
                </div>
              </section>

              <section className="rd-hourly-load">
                <header>
                  <h2>Tai theo khung gio</h2>
                  <span>{visibleAppointments.length} lich dang xem</span>
                </header>
                {hourlyLoad.length ? hourlyLoad.map((slot) => (
                  <article key={slot.hour} className={`is-${slot.level}`}>
                    <time>{slot.label}</time>
                    <div><i style={{ width: `${Math.max(8, (slot.count / maxHourlyLoad) * 100)}%` }} /></div>
                    <strong>{slot.count} lich</strong>
                    <span>{slot.delayed ? `${slot.delayed} tre` : slot.level === 'high' ? 'Cao diem' : 'On dinh'}</span>
                  </article>
                )) : (
                  <p className="rd-command-empty">Chua co lich trong khoang thoi gian dang xem.</p>
                )}
              </section>
            </section>

            <section className="rd-quick">
              <h2>Thao tac nhanh</h2>
              <div>
                {['Dat lich moi', 'Check-in benh nhan', 'Tim benh nhan', `Danh sach cho (${waitingCount})`, 'Thu ngan', 'Ghi chu nhanh'].map((item, index) => (
                  <button key={item} onClick={() => handleQuickAction(item)}>
                    <Icon name={['calendar', 'check', 'search', 'queue', 'wallet', 'file'][index]} />{item}
                  </button>
                ))}
              </div>
            </section>
          </section>

          <aside className="rd-right">
            <section className="rd-ai-card rd-ops-card">
              <header>
                <div>
                  <strong>Trợ lý vận hành</strong>
                  <p>{operationAssistantItems.filter((item) => !item.label.startsWith('0 ') && !item.label.startsWith('Chưa')).length} gợi ý từ dữ liệu thật</p>
                </div>
                <span><Icon name="spark" /></span>
              </header>
              <div className="rd-ops-list">
                {operationAssistantItems.map((item) => (
                  <button type="button" key={item.id} className={`is-${item.tone}`} onClick={item.action}>
                    <i />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rd-card-list rd-actionable">
              <header>
                <h2>Việc cần xử lý</h2>
                <span>{actionableItems.length}</span>
              </header>
              {actionableItems.map((item) => (
                <article key={item.id} className={`rd-actionable-row is-${item.tone}`} onClick={item.action}>
                  <i />
                  <div><strong>{item.label}</strong><p>{item.detail}</p></div>
                  <button type="button">Mở</button>
                </article>
              ))}
              {!actionableItems.length && <p className="rd-muted">Không có việc cần xử lý ngay.</p>}
            </section>

            <section className="rd-card-list rd-system">
              <header>
                <h2>Trạng thái dữ liệu</h2>
              </header>
              <article><i className="green" /><div><strong>Lịch hẹn</strong><p>{appointments.length} bản ghi đã tải.</p></div></article>
              <article><i className="green" /><div><strong>Bác sĩ</strong><p>{doctorStatus.length || doctors.length} bản ghi đang hiển thị.</p></div></article>
              <article><i className={waitingCount > 0 ? 'orange' : 'green'} /><div><strong>Queue hôm nay</strong><p>{waitingCount} bệnh nhân đang chờ.</p></div></article>
              <article><i className={payableInvoiceCount > 0 ? 'orange' : 'green'} /><div><strong>Hóa đơn chờ thu</strong><p>{payableInvoiceCount} hóa đơn cần xử lý.</p></div></article>
            </section>
          </aside>
        </div>

        <button className="rd-chat" aria-label="Mo chat" onClick={() => showNotice('Da mo tro ly chat.')}>
          <Icon name="message" />
        </button>
      </section>
    </main>
  )
}
