import { useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  appointmentCalendarDays,
  appointmentDoctors,
  appointmentHistory,
  appointmentTimeSlots,
} from '../data/patientPageData'
import { appointmentAPI, scheduleAPI } from '../../utils/api'
import '../styles/appointments.css'

const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const onlineDoctorAvatars = [
  'https://randomuser.me/api/portraits/men/32.jpg',
  'https://randomuser.me/api/portraits/women/44.jpg',
  'https://randomuser.me/api/portraits/men/46.jpg',
  'https://randomuser.me/api/portraits/men/75.jpg',
  'https://randomuser.me/api/portraits/women/65.jpg',
  'https://randomuser.me/api/portraits/men/52.jpg',
  'https://randomuser.me/api/portraits/women/68.jpg',
  'https://randomuser.me/api/portraits/men/85.jpg',
  'https://randomuser.me/api/portraits/women/17.jpg',
  'https://randomuser.me/api/portraits/men/22.jpg',
  'https://randomuser.me/api/portraits/women/32.jpg',
  'https://randomuser.me/api/portraits/men/41.jpg',
]

const appointmentShowcaseRows = [
  {
    id: 'showcase-apt-1',
    title: 'Khám chuyên khoa Tim mạch',
    doctor: 'BS. Nguyễn Văn An',
    specialty: 'Tim mạch',
    date: '28/05/2024',
    time: '09:30',
    facility: 'Bệnh viện Đa khoa HealthCare',
    location: 'Phòng 302 - Tầng 3',
    status: 'Sắp tới',
    tone: 'upcoming',
    isPast: false,
  },
  {
    id: 'showcase-apt-2',
    title: 'Tái khám',
    doctor: 'BS. Trần Thị Mai',
    specialty: 'Nội tổng quát',
    date: '31/05/2024',
    time: '10:00',
    facility: 'Bệnh viện Đa khoa HealthCare',
    location: 'Phòng 201 - Tầng 2',
    status: 'Sắp tới',
    tone: 'upcoming',
    isPast: false,
  },
  {
    id: 'showcase-apt-3',
    title: 'Khám tổng quát định kỳ',
    doctor: 'BS. Lê Hoàng Nam',
    specialty: 'Khám tổng quát',
    date: '10/06/2024',
    time: '08:00',
    facility: 'Bệnh viện Đa khoa HealthCare',
    location: 'Phòng 101 - Tầng 1',
    status: 'Đã xác nhận',
    tone: 'good',
    isPast: false,
  },
  {
    id: 'showcase-apt-4',
    title: 'Khám chuyên khoa Hô hấp',
    doctor: 'BS. Phạm Thị Thu',
    specialty: 'Hô hấp',
    date: '20/05/2024',
    time: '09:00',
    facility: 'Bệnh viện Đa khoa HealthCare',
    location: 'Phòng 205 - Tầng 2',
    status: 'Đã hoàn thành',
    tone: 'good',
    isPast: true,
  },
]

const defaultPatientSpecialties = [
  'Khám tổng quát',
  'Nội tổng quát',
  'Tim mạch',
  'Thần kinh',
  'Nội tiết',
  'Chấn thương chỉnh hình',
  'Nhi khoa',
  'Tai mũi họng',
  'Da liễu',
  'Tiêu hóa',
  'Hô hấp',
  'Sản phụ khoa',
  'Mắt',
  'Răng hàm mặt',
  'Tiết niệu',
]

const medicalLabelTranslations = {
  cardiology: 'Tim mạch',
  dermatology: 'Da liễu',
  dentistry: 'Răng hàm mặt',
  emergency: 'Cấp cứu',
  endocrinology: 'Nội tiết',
  ent: 'Tai mũi họng',
  gastroenterology: 'Tiêu hóa',
  general: 'Tổng quát',
  'general medicine': 'Nội tổng quát',
  internal: 'Nội khoa',
  'internal medicine': 'Nội khoa',
  neurology: 'Thần kinh',
  obstetrics: 'Sản khoa',
  oncology: 'Ung bướu',
  ophthalmology: 'Mắt',
  orthopedics: 'Chấn thương chỉnh hình',
  outpatient: 'Khám ngoại trú',
  pediatrics: 'Nhi khoa',
  pharmacy: 'Nhà thuốc',
  pulmonology: 'Hô hấp',
  surgery: 'Ngoại khoa',
  urology: 'Tiết niệu',
}

function translateMedicalLabel(value) {
  if (!value) {
    return ''
  }

  const normalized = String(value).trim()
  const translated = medicalLabelTranslations[normalized.toLowerCase()]

  return translated || normalized
}

function formatAppointmentDate(value) {
  if (!value) {
    return 'Chưa có ngày'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có ngày'
  }

  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(date)
}

function formatAppointmentTime(value) {
  if (!value) {
    return 'Chưa có giờ'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có giờ'
  }

  return new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(date)
}

function formatDateOnly(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(date)
}

function parseAppointmentDate(value, timeValue) {
  if (!value && !timeValue) {
    return null
  }

  const directDate = value instanceof Date ? value : new Date(value)

  if (!Number.isNaN(directDate.getTime())) {
    return directDate
  }

  const dateMatch = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)

  if (!dateMatch) {
    return null
  }

  const [, day, month, year] = dateMatch
  const timeMatch = String(timeValue || '').match(/^(\d{1,2}):(\d{2})$/)
  const hours = timeMatch ? Number.parseInt(timeMatch[1], 10) : 0
  const minutes = timeMatch ? Number.parseInt(timeMatch[2], 10) : 0

  const date = new Date(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    hours,
    minutes,
  )

  return Number.isNaN(date.getTime()) ? null : date
}

function getAppointmentDateParts(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return {
      day: '--',
      month: 'Tháng --',
      weekday: '--',
    }
  }

  const dayIndex = value.getDay()

  return {
    day: String(value.getDate()),
    month: `Tháng ${value.getMonth() + 1}`,
    weekday: dayIndex === 0 ? 'CN' : `Thứ ${dayIndex + 1}`,
  }
}

function getLocalDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getLocalMonthKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')

  return `${year}-${month}`
}

function getMonthStartFromKey(value) {
  const [year, month] = String(value || '')
    .split('-')
    .map((item) => Number.parseInt(item, 10))

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null
  }

  return new Date(year, month - 1, 1)
}

function buildCalendarDate(day, index) {
  if (day?.dateValue) {
    const date = new Date(day.dateValue)

    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  const numericDay = Number.parseInt(String(day?.label || ''), 10)

  if (!Number.isInteger(numericDay)) {
    return null
  }

  const today = new Date()
  const monthOffset = day?.muted && index < 7 && numericDay > 20 ? -1 : 0

  return new Date(today.getFullYear(), today.getMonth() + monthOffset, numericDay)
}

function formatMonthYear(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Tháng này'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatAvailableDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'Chưa có ngày'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function buildMonthCalendar(referenceDate, dateItems) {
  const base =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date()
  const year = base.getFullYear()
  const month = base.getMonth()
  const firstDay = new Date(year, month, 1)
  const firstOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const previousMonthDays = new Date(year, month, 0).getDate()
  const availableByKey = new Map(dateItems.map((item) => [item.dateKey, item]))
  const cells = []

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - firstOffset + 1
    const isPreviousMonth = dayNumber <= 0
    const isNextMonth = dayNumber > daysInMonth
    const date = isPreviousMonth
      ? new Date(year, month - 1, previousMonthDays + dayNumber)
      : isNextMonth
        ? new Date(year, month + 1, dayNumber - daysInMonth)
        : new Date(year, month, dayNumber)
    const dateKey = getLocalDateKey(date)
    const item = availableByKey.get(dateKey)

    cells.push({
      date,
      dateKey,
      dayNumber: date.getDate(),
      item,
      muted: isPreviousMonth || isNextMonth || !item || item.muted,
      available: Boolean(item && !item.muted),
      selected: Boolean(item?.selected),
    })
  }

  return cells
}

function isPastSlotTime(value) {
  const slotTime = new Date(value)

  return !Number.isNaN(slotTime.getTime()) && slotTime <= new Date()
}

function getAppointmentStatusMeta(status) {
  const map = {
    booked: { label: 'Sắp tới', tone: 'upcoming' },
    confirmed: { label: 'Đã xác nhận', tone: 'good' },
    checked_in: { label: 'Đã check-in', tone: 'good' },
    in_consultation: { label: 'Đang khám', tone: 'good' },
    completed: { label: 'Hoàn tất', tone: 'good' },
    cancelled: { label: 'Đã hủy', tone: 'rose' },
    no_show: { label: 'Không đến', tone: 'rose' },
    rescheduled: { label: 'Đã đổi lịch', tone: 'soft' },
  }

  return map[status] || { label: status || 'Chưa xác định', tone: 'soft' }
}

function mapApiAppointment(appointment) {
  const status = getAppointmentStatusMeta(appointment.status)
  const startsAt = parseAppointmentDate(appointment.appointment_time)
  const specialty =
    translateMedicalLabel(appointment.department_name) ||
    translateMedicalLabel(appointment.appointment_type) ||
    `Khoa ${String(appointment.department_id || '').slice(-6)}`
  const title =
    appointment.appointment_title ||
    appointment.reason ||
    appointment.visit_reason ||
    (specialty ? `Khám chuyên khoa ${specialty}` : 'Lịch hẹn khám')

  return {
    id: appointment.appointment_id || `${appointment.doctor_id}-${appointment.appointment_time}`,
    startsAt,
    isPast: Boolean(startsAt && startsAt.getTime() <= Date.now()),
    dateParts: getAppointmentDateParts(startsAt),
    facility: appointment.facility_name || appointment.hospital_name || 'Bệnh viện Đa khoa HealthCare',
    location:
      appointment.room_name ||
      appointment.room ||
      appointment.clinic_room ||
      appointment.department_name ||
      'Đang cập nhật',
    title,
    doctor: appointment.doctor_name || `Bác sĩ ${String(appointment.doctor_id || '').slice(-6)}`,
    specialty,
    date: formatAppointmentDate(appointment.appointment_time),
    time: formatAppointmentTime(appointment.appointment_time),
    status: status.label,
    tone: status.tone,
    icon: 'medical_services',
  }
}

function mapLegacyAppointment(appointment) {
  const startsAt = parseAppointmentDate(appointment.date, appointment.time)

  return {
    id: appointment.id,
    startsAt,
    isPast: appointment.isPast ?? Boolean(startsAt && startsAt.getTime() <= Date.now()),
    dateParts: getAppointmentDateParts(startsAt),
    facility: appointment.facility || 'Bệnh viện Đa khoa HealthCare',
    location: appointment.location || appointment.specialty || 'Khu khám chuyên khoa',
    title: appointment.title || `Khám chuyên khoa ${appointment.specialty || ''}`.trim(),
    doctor: appointment.doctor,
    specialty: appointment.specialty,
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    tone: appointment.tone || 'soft',
    icon: appointment.icon || 'medical_services',
  }
}

function getApiErrorMessage(error, fallback = 'Không thể xử lý yêu cầu. Vui lòng thử lại.') {
  return error?.response?.data?.message || error?.message || fallback
}

function getDepartmentName(departments, departmentId) {
  const department = departments.find((item) => {
    const id = item.department_id || item._id || item.id
    return String(id) === String(departmentId)
  })

  return (
    translateMedicalLabel(department?.department_name || department?.name) ||
    `Khoa ${String(departmentId || '').slice(-6)}`
  )
}

function getInitialsFromLabel(label = '') {
  return label
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function getStableAvatar(seed) {
  const text = String(seed || 'doctor')
  const hash = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0)

  return onlineDoctorAvatars[hash % onlineDoctorAvatars.length]
}

function getScheduleDoctorName(schedule) {
  return (
    schedule.doctor_name ||
    schedule.full_name ||
    schedule.doctor?.full_name ||
    schedule.doctor?.name ||
    schedule.user?.full_name ||
    schedule.user?.name ||
    ''
  )
}

function getScheduleDoctorCode(schedule) {
  return (
    schedule.doctor_code ||
    schedule.employee_code ||
    schedule.doctor?.employee_code ||
    schedule.user?.employee_code ||
    String(schedule.doctor_id || '').slice(-6)
  )
}

function getScheduleDoctorAvatar(schedule, fallbackSeed) {
  const avatar =
    schedule.avatar ||
    schedule.avatar_url ||
    schedule.profile_image ||
    schedule.doctor?.avatar ||
    schedule.doctor?.avatar_url ||
    schedule.user?.avatar ||
    schedule.user?.avatar_url

  if (avatar) {
    return avatar
  }

  return getStableAvatar(fallbackSeed || schedule.doctor_id)
}

function buildScheduleRating(schedule) {
  const seed = String(schedule.doctor_id || schedule.doctor_schedule_id || '0')
  const hash = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const rating = (4.5 + (hash % 5) / 10).toFixed(1)
  const reviews = 45 + (hash % 84)

  return {
    rating,
    reviews: `${reviews} đánh giá`,
  }
}

function sortSpecialtyOptions(specialties) {
  const preferredOrder = defaultPatientSpecialties

  return [...specialties].sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a)
    const bIndex = preferredOrder.indexOf(b)

    if (aIndex !== -1 || bIndex !== -1) {
      return (
        (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
        (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
      )
    }

    return a.localeCompare(b, 'vi')
  })
}

function buildDateFromSelection(dayLabel, timeLabel) {
  const day = Number.parseInt(String(dayLabel || '').trim(), 10)
  const [hours, minutes] = String(timeLabel || '')
    .split(':')
    .map((value) => Number.parseInt(value, 10))

  if (!Number.isInteger(day) || !Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null
  }

  const base = new Date()
  const monthOffset = day < base.getDate() ? 1 : 0
  return new Date(base.getFullYear(), base.getMonth() + monthOffset, day, hours, minutes, 0, 0)
}

function formatIcsDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function mapScheduleOption(schedule, departments) {
  const specialty = getDepartmentName(departments, schedule.department_id)
  const doctorCode = getScheduleDoctorCode(schedule)
  const doctorName = schedule.doctor_name || `Bác sĩ ${String(schedule.doctor_id || '').slice(-6)}`

  const resolvedDoctorName = getScheduleDoctorName(schedule) || doctorName
  const doctorKey = [
    schedule.doctor_id || doctorCode || resolvedDoctorName,
    schedule.department_id || specialty,
  ]
    .filter(Boolean)
    .map(String)
    .join('::')
  const ratingMeta = buildScheduleRating(schedule)

  return {
    id: schedule.doctor_schedule_id,
    scheduleId: schedule.doctor_schedule_id,
    doctorKey,
    name: resolvedDoctorName,
    displayName: resolvedDoctorName,
    doctorCode,
    specialty,
    rating: ratingMeta.rating,
    reviews: ratingMeta.reviews,
    nextAvailableLabel: formatAppointmentDate(schedule.work_date),
    availability: schedule.status === 'active' ? 'Đang mở' : 'Có lịch',
    initials: getInitialsFromLabel(resolvedDoctorName) || 'BS',
    avatar: getScheduleDoctorAvatar(schedule, resolvedDoctorName),
    schedule,
  }
}

function getDoctorGroupKey(option) {
  const schedule = option?.schedule || {}

  return String(
    option?.doctorKey ||
      schedule.doctor_id ||
      schedule.doctor?.doctor_id ||
      schedule.doctor?._id ||
      option?.doctorCode ||
      option?.displayName ||
      option?.name ||
      option?.id ||
      '',
  )
}

function getScheduleTimeValue(option) {
  const time = new Date(option?.schedule?.shift_start || option?.schedule?.work_date)

  return Number.isNaN(time.getTime()) ? Number.MAX_SAFE_INTEGER : time.getTime()
}

function buildUniqueDoctorOptions(scheduleOptions) {
  const groups = new Map()

  scheduleOptions.forEach((option) => {
    const doctorKey = getDoctorGroupKey(option)
    const current = groups.get(doctorKey)

    if (!current) {
      groups.set(doctorKey, {
        ...option,
        id: doctorKey,
        doctorKey,
        hasApiSchedule: true,
        schedules: [option],
      })
      return
    }

    current.schedules.push(option)
  })

  return Array.from(groups.values()).map((doctor) => {
    const schedules = [...doctor.schedules].sort((a, b) => getScheduleTimeValue(a) - getScheduleTimeValue(b))
    const firstSchedule = schedules[0] || doctor

    return {
      ...doctor,
      schedule: firstSchedule.schedule,
      scheduleId: firstSchedule.id,
      nextAvailableLabel: firstSchedule.nextAvailableLabel,
      availability: firstSchedule.availability,
      schedules,
    }
  })
}

function normalizeDoctorName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeSpecialtyKey(value) {
  const normalized = translateMedicalLabel(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized
}

function isPatientVisibleSpecialty(value) {
  const normalized = normalizeSpecialtyKey(value)

  if (!normalized) {
    return false
  }

  return ![
    'rbac',
    'test',
    'end to end',
    'e2e',
    'seed',
    'demo',
    'dummy',
  ].some((keyword) => normalized.includes(keyword))
}

function getSpecialtyAliases(value) {
  const key = normalizeSpecialtyKey(value)
  const aliases = new Set([key])

  if (key.startsWith('chuyen khoa ')) {
    aliases.add(key.replace('chuyen khoa ', ''))
  }

  if (key.startsWith('khoa ')) {
    aliases.add(key.replace('khoa ', ''))
  }

  if (key.endsWith(' khoa')) {
    aliases.add(key.replace(' khoa', ''))
  }

  return Array.from(aliases).filter(Boolean)
}

function buildSpecialtyLookup(specialties) {
  const lookup = new Map()

  specialties.forEach((specialty) => {
    getSpecialtyAliases(specialty).forEach((alias) => {
      if (!lookup.has(alias)) {
        lookup.set(alias, specialty)
      }
    })
  })

  return lookup
}

function getDepartmentLabel(department) {
  const label = translateMedicalLabel(department?.department_name || department?.name)

  return isPatientVisibleSpecialty(label) ? label : ''
}

function buildBackendSpecialtyLabels(departments, scheduleOptions) {
  const departmentLabels = departments.map(getDepartmentLabel).filter(Boolean)
  const source = departmentLabels.length
    ? departmentLabels
    : scheduleOptions.map((option) => option.specialty).filter(isPatientVisibleSpecialty)

  return sortSpecialtyOptions(Array.from(new Set([...defaultPatientSpecialties, ...source])))
}

function resolveSpecialtyLabel(value, specialtyLookup) {
  const matchedAlias = getSpecialtyAliases(value).find((alias) => specialtyLookup.has(alias))
  const label = matchedAlias ? specialtyLookup.get(matchedAlias) : translateMedicalLabel(value)

  return isPatientVisibleSpecialty(label) ? label : ''
}

function withResolvedSpecialty(doctor, specialtyLookup) {
  const specialty = resolveSpecialtyLabel(doctor.specialty, specialtyLookup)

  return {
    ...doctor,
    specialty,
    specialtyFilterValue: specialty,
  }
}

function buildDisplayDoctorOptions(apiDoctorOptions, fallbackDoctors, hasApiSchedules, specialtyLookup) {
  const visibleApiDoctorOptions = apiDoctorOptions
    .map((doctor) => withResolvedSpecialty(doctor, specialtyLookup))
    .filter((doctor) => isPatientVisibleSpecialty(doctor.specialty))

  if (!hasApiSchedules) {
    return fallbackDoctors
      .map((doctor) => ({
        ...withResolvedSpecialty(doctor, specialtyLookup),
        hasApiSchedule: false,
      }))
      .filter((doctor) => isPatientVisibleSpecialty(doctor.specialty))
  }

  const apiNames = new Set(
    visibleApiDoctorOptions.map((doctor) => normalizeDoctorName(doctor.displayName || doctor.name)),
  )
  const fallbackOnlyDoctors = fallbackDoctors
    .filter((doctor) => !apiNames.has(normalizeDoctorName(doctor.displayName || doctor.name)))
    .map((doctor) => ({
      ...withResolvedSpecialty(doctor, specialtyLookup),
      availability: 'Chưa có lịch',
      nextAvailableLabel: 'Chưa có lịch từ hệ thống',
      hasApiSchedule: false,
    }))
    .filter((doctor) => isPatientVisibleSpecialty(doctor.specialty))

  return [
    ...visibleApiDoctorOptions.map((doctor) => ({ ...doctor, hasApiSchedule: true })),
    ...fallbackOnlyDoctors,
  ]
}

export default function PatientAppointmentsPage({
  appointments = [],
  departments = [],
  loading = false,
  onAppointmentCreated,
  patientProfile,
  schedules = [],
  user,
  viewMode = 'booking',
}) {
  const defaultDoctor =
    appointmentDoctors.find((doctor) => doctor.id === 'doc-2')?.id || appointmentDoctors[0]?.id
  const defaultDate =
    appointmentCalendarDays.find((day) => day.selected)?.label || appointmentCalendarDays[0]?.label
  const defaultTime =
    appointmentTimeSlots.find((slot) => slot.selected)?.value || appointmentTimeSlots[0]?.value

  const [selectedDoctorId, setSelectedDoctorId] = useState(defaultDoctor)
  const [selectedScheduleId, setSelectedScheduleId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const [calendarViewMonth, setCalendarViewMonth] = useState('')
  const [selectedTime, setSelectedTime] = useState(defaultTime)
  const [visitMode, setVisitMode] = useState('outpatient')
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [step, setStep] = useState(1)
  const [reason, setReason] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [confirmedAppointment, setConfirmedAppointment] = useState(null)
  const [hasSyncedApiDefaultDoctor, setHasSyncedApiDefaultDoctor] = useState(false)
  const [appointmentTab, setAppointmentTab] = useState('upcoming')
  const appointmentRows = useMemo(
    () => appointments.map(mapApiAppointment),
    [appointments],
  )
  const appointmentTimelineRows = useMemo(() => {
    const fallbackRows = appointmentShowcaseRows.length ? appointmentShowcaseRows : appointmentHistory
    const source = appointmentRows.length > 0 ? appointmentRows : fallbackRows.map(mapLegacyAppointment)

    return [...source].sort((left, right) => {
      const leftTime = left.startsAt instanceof Date ? left.startsAt.getTime() : 0
      const rightTime = right.startsAt instanceof Date ? right.startsAt.getTime() : 0

      return leftTime - rightTime
    })
  }, [appointmentRows])
  const upcomingAppointments = useMemo(
    () => appointmentTimelineRows.filter((appointment) => !appointment.isPast),
    [appointmentTimelineRows],
  )
  const pastAppointments = useMemo(
    () => appointmentTimelineRows.filter((appointment) => appointment.isPast),
    [appointmentTimelineRows],
  )
  const appointmentSections = useMemo(
    () => [
      {
        key: 'upcoming',
        label: 'Lịch hẹn sắp tới',
        description: 'Các cuộc hẹn chưa diễn ra và những lượt cần theo dõi tiếp theo.',
        icon: 'event',
        rows: upcomingAppointments,
      },
      {
        key: 'past',
        label: 'Lịch hẹn đã qua',
        description: 'Lịch sử khám gần đây và các cuộc hẹn đã hoàn tất.',
        icon: 'calendar_today',
        rows: pastAppointments,
      },
    ],
    [pastAppointments, upcomingAppointments],
  )
  const appointmentSummaryCards = useMemo(() => {
    const pendingCount = appointmentTimelineRows.filter((appointment) => {
      const status = String(appointment.status || '').toLowerCase()
      return appointment.tone === 'soft' || status.includes('chờ') || status.includes('pending')
    }).length

    return [
      {
        id: 'upcoming',
        icon: 'calendar_today',
        tone: 'blue',
        label: 'Sắp tới',
        count: upcomingAppointments.length,
        unit: 'lịch hẹn',
      },
      {
        id: 'completed',
        icon: 'check_circle',
        tone: 'green',
        label: 'Đã hoàn thành',
        count: pastAppointments.length,
        unit: 'lịch hẹn',
      },
      {
        id: 'pending',
        icon: 'schedule',
        tone: 'orange',
        label: 'Đang chờ',
        count: pendingCount,
        unit: 'lịch hẹn',
      },
      {
        id: 'reminder',
        icon: 'info',
        tone: 'soft',
        label: 'Nhắc nhở',
        note: 'Vui lòng đến sớm 15 phút trước giờ hẹn và mang theo giấy tờ tùy thân.',
      },
    ]
  }, [appointmentTimelineRows, pastAppointments.length, upcomingAppointments.length])
  const orderedAppointmentSections = useMemo(() => {
    const activeSection = appointmentSections.find((section) => section.key === appointmentTab)
    const otherSections = appointmentSections.filter((section) => section.key !== appointmentTab)

    return activeSection ? [activeSection, ...otherSections] : appointmentSections
  }, [appointmentSections, appointmentTab])
  const scheduleOptions = useMemo(
    () =>
      schedules
        .map((schedule) => mapScheduleOption(schedule, departments))
        .filter((option) => isPatientVisibleSpecialty(option.specialty)),
    [departments, schedules],
  )
  const usingApiSchedules = scheduleOptions.length > 0
  const uniqueDoctorOptions = useMemo(
    () => buildUniqueDoctorOptions(scheduleOptions),
    [scheduleOptions],
  )
  const backendSpecialtyLabels = useMemo(
    () => buildBackendSpecialtyLabels(departments, scheduleOptions),
    [departments, scheduleOptions],
  )
  const specialtyLookup = useMemo(
    () => buildSpecialtyLookup(backendSpecialtyLabels),
    [backendSpecialtyLabels],
  )
  const doctorOptions = useMemo(
    () => buildDisplayDoctorOptions(uniqueDoctorOptions, appointmentDoctors, usingApiSchedules, specialtyLookup),
    [specialtyLookup, uniqueDoctorOptions, usingApiSchedules],
  )
  const specialtyOptions = useMemo(() => {
    const specialtyDoctors = usingApiSchedules
      ? doctorOptions.filter((doctor) => doctor.hasApiSchedule)
      : doctorOptions
    const doctorSpecialtySet = new Set(
      specialtyDoctors
        .map((doctor) => doctor.specialtyFilterValue || doctor.specialty)
        .filter(isPatientVisibleSpecialty),
    )
    const specialties = sortSpecialtyOptions(Array.from(
      new Set([...defaultPatientSpecialties, ...doctorSpecialtySet]),
    ))

    return [
      { value: 'all', label: 'Tất cả' },
      ...specialties.map((specialty) => ({
        value: specialty,
        label: specialty,
        hasDoctor: doctorSpecialtySet.has(specialty),
      })),
    ]
  }, [doctorOptions, usingApiSchedules])
  const filteredDoctorOptions = useMemo(
    () => {
      const keyword = doctorSearch.trim().toLowerCase()
      const bySpecialty =
        selectedSpecialty === 'all'
          ? doctorOptions
          : doctorOptions.filter((doctor) => doctor.specialtyFilterValue === selectedSpecialty)

      if (!keyword) {
        return bySpecialty
      }

      return bySpecialty.filter((doctor) => {
        const text = [
          doctor.displayName,
          doctor.name,
          doctor.specialty,
          doctor.doctorCode,
          doctor.reviews,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return text.includes(keyword)
      })
    },
    [doctorOptions, doctorSearch, selectedSpecialty],
  )
  const selectedDoctor =
    filteredDoctorOptions.find((d) => d.id === selectedDoctorId) ||
    filteredDoctorOptions[0] ||
    doctorOptions[0]
  const selectedDoctorGroupKey = usingApiSchedules ? selectedDoctor?.id : getDoctorGroupKey(selectedDoctor)
  const selectedDoctorScheduleOptions = useMemo(
    () =>
      usingApiSchedules
        ? scheduleOptions
            .filter((option) => getDoctorGroupKey(option) === selectedDoctorGroupKey)
            .sort((a, b) => getScheduleTimeValue(a) - getScheduleTimeValue(b))
        : [],
    [scheduleOptions, selectedDoctorGroupKey, usingApiSchedules],
  )
  const selectedDoctorUniqueScheduleOptions = usingApiSchedules
    ? Array.from(
        new Map(
          selectedDoctorScheduleOptions.map((option) => {
            const date = new Date(option.schedule?.work_date)
            const dateKey = getLocalDateKey(date) || option.id

            return [dateKey, option]
          }),
        ).values(),
      )
    : []
  const selectedScheduleOption =
    selectedDoctorScheduleOptions.find((option) => option.id === selectedScheduleId) ||
    selectedDoctorScheduleOptions[0] ||
    null
  const selectedSchedule = usingApiSchedules ? selectedScheduleOption?.schedule : selectedDoctor?.schedule
  const calendarDays = usingApiSchedules
    ? selectedDoctorUniqueScheduleOptions.map((option) => ({
        label: formatAppointmentDate(option.schedule.work_date),
        value: option.id,
        dateValue: option.schedule.work_date,
        muted: false,
        selected: option.id === selectedScheduleOption?.id,
      }))
    : appointmentCalendarDays
  const timeSlots = usingApiSchedules
    ? availableSlots.map((slot) => ({
        value: slot.slot_time,
        label: formatAppointmentTime(slot.slot_time),
        disabled: !slot.is_available || slot.is_booked || slot.is_blocked || isPastSlotTime(slot.slot_time),
      }))
    : appointmentTimeSlots.map((slot) => ({
        value: slot.value,
        label: slot.value,
        disabled: false,
      }))
  const calendarDateItems = calendarDays
    .map((day, index) => {
      const date = buildCalendarDate(day, index)

      return {
        ...day,
        date,
        dateKey: getLocalDateKey(date),
        dayNumber: date?.getDate() || day.label,
        listLabel: formatAvailableDate(date),
        selected:
          usingApiSchedules
            ? day.selected
            : selectedDate === day.label,
      }
    })
    .filter((item) => item.dateKey)
  const selectedDateItem =
    calendarDateItems.find((item) => item.selected) ||
    calendarDateItems.find((item) => !item.muted) ||
    calendarDateItems[0]
  const calendarReferenceDate = getMonthStartFromKey(calendarViewMonth) || selectedDateItem?.date
  const calendarMonthLabel = formatMonthYear(calendarReferenceDate)
  const monthCalendarCells = buildMonthCalendar(calendarReferenceDate, calendarDateItems)
  const availableDateItems = calendarDateItems.filter((item) => !item.muted).slice(0, 7)
  const canBookSelectedSlot =
    !usingApiSchedules || timeSlots.some((slot) => slot.value === selectedTime && !slot.disabled)
  const selectedDoctorCanBook =
    !usingApiSchedules || Boolean(selectedDoctor?.hasApiSchedule && selectedScheduleOption)
  const visitModeLabel = visitMode === 'telemedicine' ? 'Tư vấn trực tuyến' : 'Khám tại bệnh viện'
  const selectedDateLabel = usingApiSchedules
    ? formatAppointmentDate(selectedSchedule?.work_date)
    : selectedDate
  const selectedTimeLabel = usingApiSchedules ? formatAppointmentTime(selectedTime) : selectedTime
  const patient = patientProfile?.patient || {}
  const patientDisplayName = patient.full_name || user?.fullName || 'Chưa cập nhật'
  const patientPhone = patient.phone || user?.phone || 'Chưa cập nhật'
  const patientEmail = patient.email || user?.email || ''
  const patientBirthDate = formatDateOnly(patient.date_of_birth)
  const appointmentNote = reason.trim() || 'Chưa có ghi chú'
  const shiftCalendarMonth = (offset) => {
    const base = getMonthStartFromKey(calendarViewMonth) || selectedDateItem?.date || new Date()
    const nextMonth = new Date(base.getFullYear(), base.getMonth() + offset, 1)

    setCalendarViewMonth(getLocalMonthKey(nextMonth))
  }
  const calendarEvent = useMemo(() => {
    const appointmentRecord = confirmedAppointment?.appointment || confirmedAppointment || null
    const rawStartTime =
      appointmentRecord?.appointment_time || selectedTime || selectedSchedule?.work_date || null

    let startDate = rawStartTime ? new Date(rawStartTime) : null

    if (!startDate || Number.isNaN(startDate.getTime())) {
      startDate = buildDateFromSelection(selectedDate, selectedTime)
    }

    if (!startDate || Number.isNaN(startDate.getTime())) {
      return null
    }

    const endDate = new Date(startDate.getTime() + 45 * 60 * 1000)
    const doctorName = selectedDoctor?.displayName || selectedDoctor?.name || 'Bác sĩ phụ trách'
    const specialty =
      selectedDoctor?.specialty || translateMedicalLabel(appointmentRecord?.department_name) || ''
    const appointmentId = appointmentRecord?.appointment_id || ''
    const appointmentReason = reason.trim() || appointmentRecord?.reason || 'Khám ngoại trú'

    return {
      title: `Lịch khám với ${doctorName}`,
      description: [
        specialty ? `Chuyên khoa: ${specialty}` : '',
        appointmentId ? `Mã lịch hẹn: ${appointmentId}` : '',
        appointmentReason ? `Lý do: ${appointmentReason}` : '',
        'Vui lòng đến sớm 15 phút để làm thủ tục check-in.',
      ]
        .filter(Boolean)
        .join('\n'),
      fileName: `lich-kham-${appointmentId || formatIcsDate(startDate).slice(0, 8)}.ics`,
      location: 'Cơ sở y tế St. Jude, 245 Healthcare Plaza, Quận 1, TP. Hồ Chí Minh',
      startDate,
      endDate,
    }
  }, [confirmedAppointment, reason, selectedDate, selectedDoctor, selectedSchedule, selectedTime])

  const handleAddToCalendar = () => {
    if (!calendarEvent) {
      window.alert('Chưa đủ dữ liệu để thêm lịch hẹn này vào lịch.')
      return
    }

    const uid = `${Date.now()}-${calendarEvent.fileName}@healthcare-system-project`
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'PRODID:-//HealthCare//Patient Portal//VI',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(calendarEvent.startDate)}`,
      `DTEND:${formatIcsDate(calendarEvent.endDate)}`,
      `SUMMARY:${escapeIcsText(calendarEvent.title)}`,
      `DESCRIPTION:${escapeIcsText(calendarEvent.description)}`,
      `LOCATION:${escapeIcsText(calendarEvent.location)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = calendarEvent.fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    window.setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 1000)
  }

  const goTo = (n) => {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!usingApiSchedules) {
      setHasSyncedApiDefaultDoctor(false)
      return
    }

    if (!hasSyncedApiDefaultDoctor && uniqueDoctorOptions.length > 0) {
      const nextDoctor = uniqueDoctorOptions[0]

      setSelectedDoctorId(nextDoctor.id)
      setSelectedScheduleId(nextDoctor.scheduleId || nextDoctor.schedule?.doctor_schedule_id || null)
      setHasSyncedApiDefaultDoctor(true)
      return
    }

    if (!doctorOptions.some((option) => option.id === selectedDoctorId)) {
      const nextDoctor = doctorOptions[0]
      setSelectedDoctorId(nextDoctor?.id)
      setSelectedScheduleId(nextDoctor?.scheduleId || nextDoctor?.schedule?.doctor_schedule_id || null)
    }
  }, [
    doctorOptions,
    hasSyncedApiDefaultDoctor,
    selectedDoctorId,
    uniqueDoctorOptions,
    usingApiSchedules,
  ])

  useEffect(() => {
    if (
      selectedSpecialty !== 'all' &&
      !specialtyOptions.some((specialty) => specialty.value === selectedSpecialty)
    ) {
      setSelectedSpecialty('all')
    }
  }, [selectedSpecialty, specialtyOptions])

  useEffect(() => {
    if (filteredDoctorOptions.length === 0) {
      return
    }

    if (!filteredDoctorOptions.some((doctor) => doctor.id === selectedDoctorId)) {
      const nextDoctor = filteredDoctorOptions[0]
      setSelectedDoctorId(nextDoctor.id)
      setSelectedScheduleId(
        usingApiSchedules
          ? nextDoctor.scheduleId || nextDoctor.schedule?.doctor_schedule_id || null
          : null,
      )
    }
  }, [filteredDoctorOptions, selectedDoctorId, usingApiSchedules])

  useEffect(() => {
    if (!usingApiSchedules) {
      return
    }

    if (selectedDoctorScheduleOptions.length === 0) {
      setSelectedScheduleId(null)
      return
    }

    if (!selectedDoctorScheduleOptions.some((option) => option.id === selectedScheduleId)) {
      setSelectedScheduleId(selectedDoctorScheduleOptions[0].id)
    }
  }, [selectedDoctorScheduleOptions, selectedScheduleId, usingApiSchedules])

  useEffect(() => {
    if (!selectedDateItem?.date) {
      return
    }

    setCalendarViewMonth(getLocalMonthKey(selectedDateItem.date))
  }, [selectedDateItem?.dateKey])

  useEffect(() => {
    let cancelled = false

    async function loadSlots() {
      if (!selectedSchedule?.doctor_schedule_id) {
        setAvailableSlots([])
        setSelectedTime('')
        return
      }

      setSlotsLoading(true)
      setBookingError('')
      setAvailableSlots([])

      try {
        const response = await scheduleAPI.getAvailableSlots(selectedSchedule.doctor_schedule_id)
        const items = response.data?.data?.items || []

        if (!cancelled) {
          setAvailableSlots(items)
        }
      } catch (error) {
        if (!cancelled) {
          setAvailableSlots([])
          setBookingError(getApiErrorMessage(error, 'Không tải được khung giờ trống.'))
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false)
        }
      }
    }

    loadSlots()

    return () => {
      cancelled = true
    }
  }, [selectedSchedule?.doctor_schedule_id])

  useEffect(() => {
    if (!usingApiSchedules || timeSlots.length === 0) {
      return
    }

    const firstAvailable = timeSlots.find((slot) => !slot.disabled)
    const stillValid = timeSlots.some((slot) => slot.value === selectedTime && !slot.disabled)

    if (!stillValid && firstAvailable) {
      setSelectedTime(firstAvailable.value)
    }
  }, [selectedTime, timeSlots, usingApiSchedules])

  const handleConfirmBooking = async () => {
    if (bookingLoading) {
      return
    }

    if (!usingApiSchedules) {
      goTo(3)
      return
    }

    if (!selectedSchedule || !canBookSelectedSlot) {
      setBookingError('Vui lòng chọn lịch bác sĩ và khung giờ còn trống.')
      return
    }

    setBookingLoading(true)
    setBookingError('')

    try {
      const response = await appointmentAPI.createFromPortal({
        doctor_id: selectedSchedule.doctor_id,
        department_id: selectedSchedule.department_id,
        doctor_schedule_id: selectedSchedule.doctor_schedule_id,
        appointment_time: selectedTime,
        appointment_type: visitMode,
        reason: reason.trim() || 'Đặt lịch từ cổng bệnh nhân',
      })

      setConfirmedAppointment(response.data?.data || null)
      await onAppointmentCreated?.()
      goTo(3)
    } catch (error) {
      setBookingError(getApiErrorMessage(error, 'Không thể đặt lịch khám.'))
    } finally {
      setBookingLoading(false)
    }
  }

  /* ---- PROGRESS BAR ---- */
  const ProgressBar = () => (
    <div className="patient-panel patient-booking-progress">
      <div className="patient-progress-steps">
        <div className={`patient-progress-step ${step >= 1 ? 'is-active' : ''}`}>
          {step > 1 ? <PatientIcon name="check" aria-hidden="true" /> : <span>1</span>}
          <strong>Chọn bác sĩ</strong>
        </div>
        <div className={`patient-progress-step ${step >= 2 ? 'is-active' : ''}`}>
          {step > 2 ? <PatientIcon name="check" aria-hidden="true" /> : <span>2</span>}
          <strong>Ngày &amp; Giờ</strong>
        </div>
        <div className={`patient-progress-step ${step >= 3 ? 'is-active' : ''}`}>
          <span>3</span>
          <strong>Hoàn tất</strong>
        </div>
      </div>
      <div className="patient-progress-state">
        <PatientIcon name="check_circle" aria-hidden="true" />
        <span>Lịch trống hôm nay</span>
      </div>
    </div>
  )

  /* ===== STEP 1: DOCTOR SELECTION ===== */
  if (step === 1) {
    return (
      <>
        {viewMode !== 'history' && (
        <section className="patient-booking-layout">
          <ProgressBar />
          <div className="patient-booking-grid">
            <section className="patient-panel patient-doctor-panel">
              <div className="patient-doctor-toolbar">
                <h2>Chọn bác sĩ chuyên khoa</h2>
                <label className="patient-doctor-search">
                  <PatientIcon name="search" aria-hidden="true" />
                  <input
                    type="search"
                    value={doctorSearch}
                    onChange={(event) => setDoctorSearch(event.target.value)}
                    placeholder="Tìm bác sĩ..."
                    aria-label="Tìm bác sĩ"
                  />
                </label>
              </div>
              <div className="patient-specialty-filter" aria-label="Lọc bác sĩ theo chuyên khoa">
                {specialtyOptions.map((specialty) => (
                  <button
                    key={specialty.value}
                    className={`patient-specialty-chip${
                      selectedSpecialty === specialty.value ? ' is-active' : ''
                    }${specialty.hasDoctor === false ? ' is-disabled' : ''}`}
                    type="button"
                    disabled={specialty.hasDoctor === false}
                    onClick={() => setSelectedSpecialty(specialty.value)}
                  >
                    {specialty.label}
                  </button>
                ))}
              </div>
              <div className="patient-doctor-grid">
                {filteredDoctorOptions.map((doctor) => {
                  const active = doctor.id === selectedDoctorId
                  const canOpenSchedule = !usingApiSchedules || doctor.hasApiSchedule
                  return (
                    <article
                      key={doctor.id}
                      className={`patient-doctor-card${active ? ' is-selected' : ''}`}
                    >
                      <button
                        className="patient-doctor-main"
                        type="button"
                        onClick={() => {
                          setSelectedDoctorId(doctor.id)
                          if (usingApiSchedules) {
                            setSelectedScheduleId(
                              doctor.hasApiSchedule
                                ? doctor.scheduleId || doctor.schedule?.doctor_schedule_id || null
                                : null,
                            )
                          }
                        }}
                      >
                        <div className="patient-doctor-avatar">
                          {doctor.avatar ? (
                            <img src={doctor.avatar} alt={doctor.displayName || doctor.name} />
                          ) : (
                            <span>{doctor.initials}</span>
                          )}
                        </div>
                        <div className="patient-doctor-content">
                          <div className="patient-doctor-head">
                            <h3>{doctor.displayName || doctor.name}</h3>
                            <span>{doctor.availability}</span>
                          </div>
                          <p>{doctor.specialty}</p>
                          <div className="patient-doctor-rating">
                            <PatientIcon name="star" aria-hidden="true" />
                            <strong>{doctor.rating} ({doctor.reviews})</strong>
                          </div>
                          <div className="patient-doctor-next-slot">
                            <PatientIcon name="event" aria-hidden="true" />
                            <span>
                              Lịch gần nhất: {doctor.nextAvailableLabel || doctor.latestSlot || doctor.reviews}
                            </span>
                          </div>
                        </div>
                      </button>
                      <button
                        className="patient-doctor-schedule-button"
                        type="button"
                        disabled={!canOpenSchedule}
                        onClick={() => {
                          if (!canOpenSchedule) {
                            return
                          }

                          setSelectedDoctorId(doctor.id)
                          if (usingApiSchedules) {
                            setSelectedScheduleId(doctor.scheduleId || doctor.schedule?.doctor_schedule_id || null)
                          }
                          goTo(2)
                        }}
                      >
                        <PatientIcon name="event" aria-hidden="true" />
                        <span>{canOpenSchedule ? 'Xem lịch' : 'Chưa có lịch'}</span>
                      </button>
                    </article>
                  )
                })}
                {filteredDoctorOptions.length === 0 ? (
                  <div className="patient-empty-state">
                    Chưa có bác sĩ thuộc chuyên khoa này.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="patient-panel patient-step1-sidebar">
              <div>
                <p className="patient-section-label">Bác sĩ đã chọn</p>
                <h2>Tóm tắt lựa chọn</h2>
              </div>

              {/* Doctor summary */}
              <div className="patient-selected-doctor-card">
                <div className="patient-selected-doctor-avatar">
                  {selectedDoctor.avatar ? (
                    <img
                      src={selectedDoctor.avatar}
                      alt={selectedDoctor.displayName || selectedDoctor.name}
                    />
                  ) : (
                    <span>{selectedDoctor.initials}</span>
                  )}
                </div>
                <div>
                  <p className="patient-selected-doctor-label">Bác sĩ phụ trách</p>
                  <p className="patient-selected-doctor-name">
                    {selectedDoctor.displayName || selectedDoctor.name}
                  </p>
                  <p className="patient-selected-doctor-specialty">{selectedDoctor.specialty}</p>
                  <div className="patient-selected-doctor-meta">
                    <span>{selectedDateLabel}</span>
                    <span>{usingApiSchedules ? 'Lịch từ hệ thống' : 'Lịch mẫu'}</span>
                  </div>
                  {selectedDoctor.doctorCode ? (
                    <p className="patient-selected-doctor-code">
                      Mã bác sĩ: {selectedDoctor.doctorCode}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="patient-booking-perks">
                <div className="patient-booking-perk">
                  <PatientIcon name="check_circle" aria-hidden="true" />
                  <span>Đặt lịch trực tuyến miễn phí</span>
                </div>
                <div className="patient-booking-perk">
                  <PatientIcon name="verified_user" aria-hidden="true" />
                  <span>Hủy lịch miễn phí trước 24 giờ</span>
                </div>
                <div className="patient-booking-perk">
                  <PatientIcon name="schedule" aria-hidden="true" />
                  <span>Thời gian khám â‰ˆ 45 phút</span>
                </div>
              </div>

              <button
                className="patient-hero-button patient-next-button patient-sidebar-btn-full"
                type="button"
                disabled={!selectedDoctorCanBook}
                onClick={() => goTo(2)}
              >
                {selectedDoctorCanBook ? 'Tiếp theo — Chọn ngày giờ' : 'Chưa có lịch từ hệ thống'}
              </button>
            </section>
          </div>
        </section>
        )}

        {viewMode !== 'booking' && (
        <section className="patient-panel patient-appointments-history patient-appointments-shell">
          <div className="patient-appointments-hero">
            <div>
              <h1>Lịch hẹn</h1>
            </div>
            <div className="patient-appointments-tabs" role="tablist" aria-label="Lịch hẹn">
              {appointmentSections.map((section) => {
                const active = section.key === appointmentTab

                return (
                  <button
                    key={section.key}
                    className={`patient-appointments-tab${active ? ' is-active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setAppointmentTab(section.key)}
                  >
                    <span>{section.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="patient-appointments-summary-grid" aria-label="Tổng quan lịch hẹn">
            {appointmentSummaryCards.map((card) => (
              <article
                key={card.id}
                className={`patient-appointments-summary-card ${card.tone}${card.note ? ' is-reminder' : ''}`}
              >
                <span className="patient-appointments-summary-icon" aria-hidden="true">
                  <PatientIcon name={card.icon} />
                </span>
                <div>
                  <strong>{card.label}</strong>
                  {card.note ? (
                    <p>{card.note}</p>
                  ) : (
                    <span>
                      <b>{card.count}</b>
                      {card.unit}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="patient-appointments-stack">
            {loading ? (
              <div className="patient-appointments-history-shell">
                <div className="patient-empty-state">Đang tải lịch hẹn từ backend...</div>
              </div>
            ) : null}

            {!loading &&
              orderedAppointmentSections.map((section) => (
                <div key={section.key} className="patient-appointments-group">
                  <div className="patient-appointments-section-head">
                    <div className="patient-appointments-section-title">
                      <span className="patient-appointments-section-icon">
                        <PatientIcon name={section.icon} aria-hidden="true" />
                      </span>
                      <div>
                        <h3>{section.label}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="patient-appointments-history-shell">
                    {section.rows.length === 0 ? (
                      <div className="patient-empty-state">
                        {section.key === 'upcoming'
                          ? 'Chưa có lịch hẹn sắp tới.'
                          : 'Chưa có lịch hẹn đã qua.'}
                      </div>
                    ) : (
                      <div className="patient-appointment-list">
                        {section.rows.map((appointment) => (
                          <article key={appointment.id} className="patient-appointment-card">
                            <div className="patient-appointment-date">
                              <span>{appointment.dateParts.weekday}</span>
                              <strong>{appointment.dateParts.day}</strong>
                              <em>{appointment.dateParts.month}</em>
                            </div>

                            <div className="patient-appointment-body">
                              <div className="patient-appointment-title-row">
                                <div>
                                  <h4>{appointment.title}</h4>
                                  <p>{appointment.doctor}</p>
                                  <span>{appointment.facility}</span>
                                </div>
                              </div>

                              <div className="patient-appointment-meta">
                                <div className="patient-appointment-meta-item">
                                  <PatientIcon name="schedule" aria-hidden="true" />
                                  <span>{appointment.time}</span>
                                </div>
                                <div className="patient-appointment-meta-item">
                                  <PatientIcon name="location_on" aria-hidden="true" />
                                  <span>{appointment.location}</span>
                                </div>
                              </div>
                            </div>

                            <div className="patient-appointment-aside">
                              <span className={`patient-status-pill ${appointment.tone}`}>
                                {appointment.status}
                              </span>
                              <button
                                className="patient-appointment-action"
                                type="button"
                                aria-label={`Xem chi tiết lịch hẹn ${appointment.title}`}
                              >
                                <PatientIcon name="chevron_right" aria-hidden="true" />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            <div className="patient-appointments-note">
              <div className="patient-appointments-note-icon">
                <PatientIcon name="info" aria-hidden="true" />
              </div>
              <p>
                Vui lòng đến sớm 15 phút trước giờ hẹn và mang theo giấy tờ tùy thân. Nếu bạn không thể
                đến, hãy hủy hoặc đổi lịch sớm để hệ thống cập nhật kịp thời.
              </p>
            </div>

          </div>
        </section>
        )}
      </>
    )
  }

  /* ===== STEP 2: DATE & TIME + STICKY SIDEBAR ===== */
  if (step === 2) {
    return (
      <>
        <section className="patient-booking-layout">
          <ProgressBar />
        </section>

        {/* Doctor summary card */}
        <div className="patient-step2-doctor-wrap">
          <div className="patient-panel patient-step2-doctor-card">
            <div className="patient-step2-doctor-inner">
              <div className="patient-step2-doctor-avatar">
                {selectedDoctor.avatar ? (
                  <img
                    src={selectedDoctor.avatar}
                    alt={selectedDoctor.displayName || selectedDoctor.name}
                  />
                ) : (
                  <span>{selectedDoctor.initials}</span>
                )}
              </div>
              <div>
                <p className="patient-step2-doctor-badge">Bác sĩ đã chọn</p>
                <h3 className="patient-step2-doctor-name">
                  {selectedDoctor.displayName || selectedDoctor.name}
                </h3>
                <p className="patient-step2-doctor-specialty">{selectedDoctor.specialty}</p>
                <div className="patient-step2-doctor-meta">
                  <span>
                    <PatientIcon name="star" aria-hidden="true" />
                    {selectedDoctor.rating || '4.8'} ({selectedDoctor.reviews || '98 đánh giá'})
                  </span>
                  <span>
                    <PatientIcon name="verified_user" aria-hidden="true" />
                    {selectedDoctor.doctorCode ? `Mã ${selectedDoctor.doctorCode}` : 'Đã xác minh'}
                  </span>
                  <span>
                    <PatientIcon name="local_hospital" aria-hidden="true" />
                    Cơ sở y tế St. Jude
                  </span>
                </div>
              </div>
            </div>
            <div className="patient-step2-support-box">
              <p>Bảo hiểm hỗ trợ</p>
              <div>
                <span>BHYT</span>
                <span>Bảo Việt</span>
                <span>PVI Care</span>
              </div>
            </div>
            <button
              type="button"
              className="patient-inline-link patient-step2-edit-btn"
              onClick={() => goTo(1)}
            >
              <PatientIcon name="edit" aria-hidden="true" />
              Đổi bác sĩ
            </button>
          </div>
        </div>

        {/* Main two-column layout */}
        <div className="patient-step2-layout">
          {/* Left: Calendar + Time */}
          <div className="patient-step2-left">
            {/* Calendar */}
            <div className="patient-panel patient-calendar-panel-inner">
              <div className="patient-panel-head patient-panel-head-mb">
                <div>
                  <span className="patient-step-number">1</span>
                  <h2 className="patient-calendar-h2">Chọn ngày khám</h2>
                </div>
                <div className="patient-calendar-actions">
                  <button type="button" aria-label="Tháng trước" onClick={() => shiftCalendarMonth(-1)}>
                    <PatientIcon name="chevron_left" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Tháng sau" onClick={() => shiftCalendarMonth(1)}>
                    <PatientIcon name="chevron_right" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="patient-date-picker-grid">
                <div className="patient-month-card">
                  <div className="patient-month-title">{calendarMonthLabel}</div>
                  <div className="patient-week-grid">
                    {weekDays.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  <div className="patient-date-grid">
                    {monthCalendarCells.map((day) => (
                      <button
                        key={day.dateKey}
                        className={`patient-date-chip${day.selected ? ' is-selected' : ''}${
                          day.available ? ' is-available' : ''
                        }${day.muted ? ' is-muted' : ''}`}
                        type="button"
                        disabled={!day.available}
                        onClick={() => {
                          if (!day.item) return

                          if (usingApiSchedules) {
                            setSelectedScheduleId(day.item.value)
                            return
                          }

                          setSelectedDate(day.item.label)
                        }}
                      >
                        <span>{day.dayNumber}</span>
                      </button>
                    ))}
                  </div>
                  <div className="patient-calendar-legend">
                    <span><i />Còn lịch</span>
                    <span><i />Hết lịch</span>
                  </div>
                </div>

                <div className="patient-available-date-list">
                  <p>Ngày có lịch</p>
                  {availableDateItems.map((day) => (
                    <button
                      key={day.dateKey}
                      className={day.selected ? 'is-selected' : ''}
                      type="button"
                      onClick={() => {
                        if (usingApiSchedules) {
                          setSelectedScheduleId(day.value)
                          return
                        }

                        setSelectedDate(day.label)
                      }}
                    >
                      <span />
                      {day.listLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Time Slots */}
            <div className="patient-panel patient-time-panel">
              <div className="patient-time-header">
                <div>
                  <span className="patient-step-number">2</span>
                  <h3 className="patient-time-h3">Chọn giờ khám cho {selectedDateLabel}</h3>
                </div>
              </div>

              <div className="patient-visit-mode-switch">
                <button
                  className={visitMode === 'outpatient' ? 'is-selected' : ''}
                  type="button"
                  onClick={() => setVisitMode('outpatient')}
                >
                  <PatientIcon name="local_hospital" aria-hidden="true" />
                  Khám tại bệnh viện
                </button>
                <button
                  className={visitMode === 'telemedicine' ? 'is-selected' : ''}
                  type="button"
                  onClick={() => setVisitMode('telemedicine')}
                >
                  <PatientIcon name="videocam" aria-hidden="true" />
                  Tư vấn trực tuyến
                </button>
              </div>

              {slotsLoading ? <div className="patient-empty-state">Đang tải khung giờ trống...</div> : null}
              {!slotsLoading && timeSlots.length === 0 ? (
                <div className="patient-empty-state">Chưa có khung giờ trống cho lịch này.</div>
              ) : null}
              {!slotsLoading && timeSlots.length > 0 ? (
                <div className="patient-time-grid patient-time-grid-flat">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.value}
                      className={`patient-time-chip${selectedTime === slot.value ? ' is-selected' : ''}`}
                      type="button"
                      disabled={slot.disabled}
                      onClick={() => setSelectedTime(slot.value)}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="patient-time-note">
                <PatientIcon name="info" aria-hidden="true" />
                Giờ hiển thị theo múi giờ địa phương của bạn.
              </p>
            </div>
          </div>

          {/* Right: Sticky Booking Details Sidebar */}
          <div className="patient-step2-sidebar">
            <div className="patient-panel patient-sidebar-panel">
              <div className="patient-sidebar-title-row">
                <h3 className="patient-sidebar-title">Thông tin đặt khám</h3>
                <button className="patient-inline-link" type="button" onClick={() => goTo(1)}>
                  <PatientIcon name="edit" aria-hidden="true" />
                  Sửa
                </button>
              </div>

              <div className="patient-sidebar-doctor-card">
                <div className="patient-sidebar-doctor-avatar">
                  {selectedDoctor.avatar ? (
                    <img
                      src={selectedDoctor.avatar}
                      alt={selectedDoctor.displayName || selectedDoctor.name}
                    />
                  ) : (
                    <span>{selectedDoctor.initials}</span>
                  )}
                </div>
                <div>
                  <strong>{selectedDoctor.displayName || selectedDoctor.name}</strong>
                  <p>{selectedDoctor.specialty}</p>
                </div>
              </div>

              <div className="patient-sidebar-patient-card">
                <div>
                  <PatientIcon name="person" aria-hidden="true" />
                  <span>Bệnh nhân</span>
                  <strong>{patientDisplayName}</strong>
                </div>
                <div>
                  <PatientIcon name="phone" aria-hidden="true" />
                  <span>Số điện thoại</span>
                  <strong>{patientPhone}</strong>
                </div>
                {patientEmail ? (
                  <div>
                    <PatientIcon name="mail" aria-hidden="true" />
                    <span>Email</span>
                    <strong>{patientEmail}</strong>
                  </div>
                ) : null}
                {patientBirthDate ? (
                  <div>
                    <PatientIcon name="cake" aria-hidden="true" />
                    <span>Ngày sinh</span>
                    <strong>{patientBirthDate}</strong>
                  </div>
                ) : null}
              </div>

              <div className="patient-sidebar-details">
                {/* Date & Time */}
                <div className="patient-sidebar-detail-row">
                  <div className="patient-sidebar-icon">
                    <PatientIcon name="event" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="patient-sidebar-detail-label">Ngày &amp; Giờ</p>
                    <p className="patient-sidebar-detail-main">{selectedDateLabel}</p>
                    <p className="patient-sidebar-detail-sub">{selectedTimeLabel}</p>
                  </div>
                </div>

                {/* Location */}
                <div className="patient-sidebar-detail-row">
                  <div className="patient-sidebar-icon">
                    <PatientIcon name="location_on" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="patient-sidebar-detail-label">Địa điểm</p>
                    <p className="patient-sidebar-detail-main">Bệnh viện Bạch Mai</p>
                    <p className="patient-sidebar-detail-sub">78 Giải Phóng, Đống Đa, Hà Nội</p>
                  </div>
                </div>

                <div className="patient-sidebar-detail-row">
                  <div className="patient-sidebar-icon">
                    <PatientIcon name="medical_services" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="patient-sidebar-detail-label">Hình thức khám</p>
                    <p className="patient-sidebar-detail-main">{visitModeLabel}</p>
                  </div>
                </div>
              </div>

              <label className="patient-sidebar-note-field">
                <span>Ghi chú / Lý do khám</span>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ví dụ: Kiểm tra định kỳ, đau ngực, tái khám..."
                  rows={2}
                />
                <small>{appointmentNote}</small>
              </label>

              {/* Fee breakdown */}
              <div className="patient-sidebar-fees">
                <div className="patient-fee-row">
                  <span className="patient-fee-label">Phí khám</span>
                  <strong className="patient-fee-value">350.000 ₫</strong>
                </div>
                <div className="patient-fee-row">
                  <span className="patient-fee-label">Phí admin</span>
                  <strong className="patient-fee-value">15.000 ₫</strong>
                </div>
                <div className="patient-fee-row-last">
                  <strong className="patient-fee-total-label">Tổng cộng</strong>
                  <strong className="patient-fee-total-value">365.000 ₫</strong>
                </div>
              </div>

              {/* Buttons */}
              <div className="patient-sidebar-actions">
                <button
                  className="patient-hero-button patient-sidebar-btn-full"
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={bookingLoading || !canBookSelectedSlot}
                >
                  Xác nhận &amp; Đặt lịch
                </button>
                {bookingError ? (
                  <div className="patient-dashboard-state patient-dashboard-state-error">
                    {bookingError}
                  </div>
                ) : null}
                <button
                  className="patient-outline-button patient-sidebar-btn-full"
                  type="button"
                  onClick={() => goTo(1)}
                >
                  <PatientIcon name="arrow_back" aria-hidden="true" />
                  <span>Quay lại chọn bác sĩ</span>
                </button>
              </div>

              <div className="patient-visit-reminders">
                <h4>Lưu ý trước khi khám</h4>
                <p>
                  <PatientIcon name="schedule" aria-hidden="true" />
                  Vui lòng đến sớm 15 phút để làm thủ tục.
                </p>
                <p>
                  <PatientIcon name="badge" aria-hidden="true" />
                  Mang theo giấy tờ tùy thân và thẻ bảo hiểm y tế.
                </p>
                <p>
                  <PatientIcon name="event_busy" aria-hidden="true" />
                  Hủy hoặc đổi lịch trước ít nhất 4 giờ để tránh phí.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  /* ===== STEP 3: SUCCESS ===== */
  return (
    <>
      <section className="patient-booking-layout">
        <ProgressBar />
      </section>

      {/* Progress label */}
      <div className="patient-step3-progress">
        <div className="patient-step3-progress-labels">
          <span className="patient-step3-progress-step">Bước 03 / 03</span>
          <span className="patient-step3-progress-label">Xác nhận &amp; Hoàn tất</span>
        </div>
        <div className="patient-step3-progress-track">
          <div className="patient-step3-progress-fill" />
        </div>
      </div>

      {/* Success hero */}
      <div className="patient-success-hero">
        <div className="patient-success-confetti" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => (
            <i key={index} />
          ))}
        </div>
        <div className="patient-success-icon" aria-hidden="true">
          <span className="patient-success-ring" />
          <PatientIcon name="check" />
        </div>
        <p className="patient-success-eyebrow">Lịch hẹn đã được xác nhận</p>
        <h1 className="patient-success-title">Đặt lịch thành công!</h1>
        <p className="patient-success-subtitle">
          Bạn vui lòng kiểm tra lại thông tin bên dưới và đến sớm 15 phút để hoàn tất thủ tục.
        </p>
      </div>

      {/* Bento grid */}
      <div className="patient-bento-grid">
        {/* Left: Appointment details */}
        <div className="patient-panel patient-details-card">
          <div className="patient-details-card-head">
            <div>
              <p className="patient-section-label">Thông tin lịch hẹn</p>
              <h2>Chi tiết đặt khám</h2>
            </div>
            <span className="patient-booking-id">
              Mã lịch: {confirmedAppointment?.appointment?.appointment_id || 'ETH-88291'}
            </span>
          </div>

          <div className="patient-details-grid">
            {/* Doctor */}
            <div>
              <p className="patient-detail-label">Bác sĩ phụ trách</p>
              <div className="patient-detail-doc-row">
                <div className="patient-detail-doc-avatar">
                  {selectedDoctor.avatar ? (
                    <img
                      src={selectedDoctor.avatar}
                      alt={selectedDoctor.displayName || selectedDoctor.name}
                    />
                  ) : (
                    <span>{selectedDoctor.initials}</span>
                  )}
                </div>
                <div>
                  <p className="patient-detail-doc-name">
                    {selectedDoctor.displayName || selectedDoctor.name}
                  </p>
                  <p className="patient-detail-doc-specialty">{selectedDoctor.specialty}</p>
                </div>
              </div>
            </div>

            {/* Time */}
            <div>
              <p className="patient-detail-label">Ngày &amp; giờ khám</p>
              <div className="patient-detail-doc-row">
                <div className="patient-detail-time-icon">
                  <span>Ngày</span>
                  <span>{selectedDateLabel?.split(' ')[0] || '16'}</span>
                </div>
                <div>
                  <p className="patient-detail-time-main">{selectedTimeLabel}</p>
                  <p className="patient-detail-time-sub">{selectedDateLabel}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="patient-detail-label">Bệnh nhân</p>
              <div className="patient-detail-doc-row">
                <div className="patient-detail-soft-icon">
                  <PatientIcon name="person" aria-hidden="true" />
                </div>
                <div>
                  <p className="patient-detail-doc-name">{patientDisplayName}</p>
                  <p className="patient-detail-doc-specialty">{patientPhone}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="patient-detail-label">Hình thức khám</p>
              <div className="patient-detail-doc-row">
                <div className="patient-detail-soft-icon">
                  <PatientIcon name={visitMode === 'telemedicine' ? 'videocam' : 'local_hospital'} aria-hidden="true" />
                </div>
                <div>
                  <p className="patient-detail-doc-name">{visitModeLabel}</p>
                  <p className="patient-detail-doc-specialty">Phí dự kiến: 365.000 ₫</p>
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="patient-location-section">
            <p className="patient-detail-label">Địa điểm phòng khám</p>
            <div className="patient-location-row">
              <div>
                <p className="patient-location-name">Cơ sở y tế St. Jude</p>
                <p className="patient-location-address">245 Healthcare Plaza, Quận 1, TP. Hồ Chí Minh</p>
              </div>
              <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="patient-map-link">
                <PatientIcon name="map" aria-hidden="true" />
                Xem bản đồ chỉ đường
              </a>
            </div>
          </div>
        </div>

        {/* Right: Prep + Actions */}
        <div className="patient-right-col">
          {/* Preparation tips */}
          <div className="patient-panel patient-prep-card">
            <h3 className="patient-prep-title">Chuẩn bị tiếp theo</h3>
            <ul className="patient-prep-list">
              <li className="patient-prep-item">
                <PatientIcon name="badge" aria-hidden="true" className="patient-prep-icon" />
                <p className="patient-prep-text">Mang theo CCCD và Thẻ bảo hiểm y tế bản gốc.</p>
              </li>
              <li className="patient-prep-item">
                <PatientIcon name="schedule" aria-hidden="true" className="patient-prep-icon" />
                <p className="patient-prep-text">Đến sớm 15 phút để hoàn tất thủ tục check-in.</p>
              </li>
              <li className="patient-prep-item">
                <PatientIcon name="verified_user" aria-hidden="true" className="patient-prep-icon" />
                <p className="patient-prep-text">Hủy lịch miễn phí trước <strong>24 giờ</strong> qua ứng dụng.</p>
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <button className="patient-hero-button patient-action-btn-full" type="button" onClick={handleAddToCalendar}>
            <PatientIcon name="calendar_add_on" aria-hidden="true" />
            <span>Thêm vào lịch</span>
          </button>
          <button className="patient-outline-button patient-action-btn-full" type="button" onClick={() => goTo(1)}>
            <PatientIcon name="dashboard" aria-hidden="true" />
            <span>Đặt lịch mới</span>
          </button>
        </div>
      </div>

      {/* Support note */}
      <p className="patient-support-note">
        Cần hỗ trợ thay đổi lịch hẹn? Liên hệ hotline <strong className="patient-support-hotline">1900 8829</strong>
      </p>
    </>
  )
}
