export const doctorNavItems = [
  { id: 'dashboard', label: 'Tổng quan', path: '/doctor/dashboard', icon: 'dashboard' },
  { id: 'appointments', label: 'Lịch hẹn', path: '/doctor/appointments', icon: 'calendar' },
  { id: 'encounters', label: 'Encounter', path: '/doctor/encounters', icon: 'doctor' },
  { id: 'patients', label: 'Bệnh nhân', path: '/doctor/patients', icon: 'patients' },
  { id: 'orders', label: 'Orders', path: '/doctor/orders', icon: 'clipboard' },
  { id: 'queue', label: 'Hàng chờ', path: '/doctor/queue', icon: 'queue' },
  { id: 'schedules', label: 'Lịch làm việc', path: '/doctor/schedules', icon: 'clock' },
  { id: 'prescriptions', label: 'Đơn thuốc', path: '/doctor/prescriptions', icon: 'pill' },
  { id: 'profile', label: 'Hồ sơ', path: '/doctor/profile', icon: 'user' },
]

export const encounterTabs = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'timeline', label: 'Dòng thời gian' },
  { id: 'consultation', label: 'Phiếu khám' },
  { id: 'diagnosis', label: 'Chẩn đoán' },
  { id: 'vitals', label: 'Sinh hiệu' },
  { id: 'orders', label: 'Orders' },
  { id: 'prescription', label: 'Đơn thuốc' },
  { id: 'notes', label: 'Ghi chú lâm sàng' },
]

export const statusToneMap = {
  waiting: { label: 'Dang cho', tone: 'amber' },
  called: { label: 'Da goi', tone: 'indigo' },
  recalled: { label: 'Goi lai', tone: 'indigo' },
  in_service: { label: 'Dang phuc vu', tone: 'blue' },
  in_progress: { label: 'Dang xu ly', tone: 'blue' },
  pending: { label: 'Cho xu ly', tone: 'neutral' },
  on_hold: { label: 'Tam dung', tone: 'orange' },
  completed: { label: 'Hoan tat', tone: 'green' },
  booked: { label: 'Da dat', tone: 'neutral' },
  confirmed: { label: 'Da xac nhan', tone: 'teal' },
  checked_in: { label: 'Da check-in', tone: 'indigo' },
  no_show: { label: 'Khong den', tone: 'red' },
  cancelled: { label: 'Da huy', tone: 'red' },
  skipped: { label: 'Da bo qua', tone: 'neutral' },
  blocked: { label: 'Da chan', tone: 'red' },
  available: { label: 'Con trong', tone: 'teal' },
  active: { label: 'Dang hoat dong', tone: 'teal' },
  signed: { label: 'Da ky', tone: 'blue' },
  amended: { label: 'Da bo sung', tone: 'purple' },
  draft: { label: 'Ban nhap', tone: 'neutral' },
  provisional: { label: 'Tam thoi', tone: 'amber' },
  confirmed_diagnosis: { label: 'Da xac nhan', tone: 'green' },
  discharge: { label: 'Ra vien', tone: 'blue' },
  secondary: { label: 'Thu phat', tone: 'neutral' },
  resolved: { label: 'Da giai quyet', tone: 'green' },
  observation: { label: 'Theo doi', tone: 'teal' },
  result_ready: { label: 'Co ket qua', tone: 'purple' },
}

export function getInitials(name = '') {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function formatDate(value, options = {}) {
  if (!value) {
    return '--'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '--'
  }

  return parsed.toLocaleDateString('vi-VN', {
    month: options.month || 'short',
    day: options.day || '2-digit',
    year: options.year === undefined ? 'numeric' : options.year,
  })
}

export function formatTime(value) {
  if (!value) {
    return '--'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return '--'
  }

  return parsed.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(value) {
  if (!value) {
    return '--'
  }

  return `${formatDate(value)} | ${formatTime(value)}`
}

export function parseDateValue(value) {
  if (!value) {
    return new Date()
  }

  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export function toLocalDateKey(value = new Date()) {
  const parsed = parseDateValue(value)
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function safeArray(value) {
  return Array.isArray(value) ? value : []
}

export function calculateBmi(weight, heightCm) {
  const numericWeight = Number(weight)
  const numericHeight = Number(heightCm)

  if (!numericWeight || !numericHeight) {
    return ''
  }

  const heightInMeters = numericHeight / 100
  if (heightInMeters <= 0) {
    return ''
  }

  return (numericWeight / (heightInMeters * heightInMeters)).toFixed(1)
}
