export const doctorNavItems = [
  { id: 'dashboard', label: 'Tổng quan', path: '/doctor/dashboard', icon: 'dashboard' },
  { id: 'queue', label: 'Hàng chờ', path: '/doctor/queue', icon: 'queue' },
  { id: 'appointments', label: 'Lịch hẹn', path: '/doctor/appointments', icon: 'calendar' },
  { id: 'schedules', label: 'Lịch làm việc', path: '/doctor/schedules', icon: 'clock' },
  { id: 'encounters', label: 'Phiên khám', path: '/doctor/encounters', icon: 'doctor' },
  { id: 'patients', label: 'Bệnh nhân', path: '/doctor/patients', icon: 'patients' },
  { id: 'profile', label: 'Hồ sơ', path: '/doctor/profile', icon: 'user' },
]

export const encounterTabs = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'timeline', label: 'Dòng thời gian' },
  { id: 'consultation', label: 'Phiếu khám' },
  { id: 'diagnosis', label: 'Chẩn đoán' },
  { id: 'vitals', label: 'Sinh hiệu' },
  { id: 'prescription', label: 'Đơn thuốc' },
  { id: 'notes', label: 'Ghi chú lâm sàng' },
]

export const statusToneMap = {
  waiting: { label: 'Đang chờ', tone: 'amber' },
  called: { label: 'Đã gọi', tone: 'indigo' },
  recalled: { label: 'Gọi lại', tone: 'indigo' },
  in_service: { label: 'Đang phục vụ', tone: 'blue' },
  in_progress: { label: 'Đang xử lý', tone: 'blue' },
  pending: { label: 'Chờ xử lý', tone: 'neutral' },
  on_hold: { label: 'Tạm dừng', tone: 'orange' },
  completed: { label: 'Hoàn tất', tone: 'green' },
  booked: { label: 'Đã đặt', tone: 'neutral' },
  confirmed: { label: 'Đã xác nhận', tone: 'teal' },
  checked_in: { label: 'Đã check-in', tone: 'indigo' },
  no_show: { label: 'Không đến', tone: 'red' },
  cancelled: { label: 'Đã hủy', tone: 'red' },
  skipped: { label: 'Đã bỏ qua', tone: 'neutral' },
  blocked: { label: 'Đã chặn', tone: 'red' },
  available: { label: 'Còn trống', tone: 'teal' },
  active: { label: 'Đang hoạt động', tone: 'teal' },
  signed: { label: 'Đã ký', tone: 'blue' },
  amended: { label: 'Đã bổ sung', tone: 'purple' },
  draft: { label: 'Bản nháp', tone: 'neutral' },
  provisional: { label: 'Tạm thời', tone: 'amber' },
  confirmed_diagnosis: { label: 'Đã xác nhận', tone: 'green' },
  discharge: { label: 'Ra viện', tone: 'blue' },
  secondary: { label: 'Thứ phát', tone: 'neutral' },
  resolved: { label: 'Đã giải quyết', tone: 'green' },
  observation: { label: 'Theo dõi', tone: 'teal' },
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
