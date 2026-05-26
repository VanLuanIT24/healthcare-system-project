import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { appointmentAPI, scheduleAPI } from '../../utils/api'
import { HealthcareChatAssistCard } from '../../components/HealthcareChatbot'
import '../styles/appointments.css'

const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const stableAvatarPalettes = [
  ['#2563eb', '#0f766e'],
  ['#7c3aed', '#2563eb'],
  ['#0891b2', '#16a34a'],
  ['#db2777', '#7c3aed'],
  ['#ea580c', '#dc2626'],
  ['#0f766e', '#047857'],
  ['#4f46e5', '#0ea5e9'],
  ['#be123c', '#9333ea'],
]

const patientSpecialtyDisplayOrder = [
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

function formatVnd(value, emptyLabel = '0 ₫') {
  const amount = Number(value || 0)

  if (!amount) {
    return emptyLabel
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
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
      year: '',
    }
  }

  const dayIndex = value.getDay()

  return {
    day: String(value.getDate()),
    month: `Tháng ${value.getMonth() + 1}`,
    weekday: dayIndex === 0 ? 'CN' : `Thứ ${dayIndex + 1}`,
    year: String(value.getFullYear()),
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
    booked: { label: 'Đang chờ', tone: 'pending' },
    confirmed: { label: 'Đã xác nhận', tone: 'good' },
    checked_in: { label: 'Đã check-in', tone: 'good' },
    in_consultation: { label: 'Đang khám', tone: 'good' },
    completed: { label: 'Đã hoàn thành', tone: 'good' },
    cancelled: { label: 'Đã hủy', tone: 'rose' },
    no_show: { label: 'Không đến', tone: 'rose' },
    rescheduled: { label: 'Đã đổi lịch', tone: 'soft' },
  }

  return map[status] || { label: status || 'Chưa xác định', tone: 'soft' }
}

const terminalAppointmentStatuses = new Set(['cancelled', 'completed', 'no_show', 'rescheduled'])

const appointmentStatusFilterOptions = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'booked', label: 'Đang chờ' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'checked_in', label: 'Đã check-in' },
  { value: 'in_consultation', label: 'Đang khám' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'no_show', label: 'Không đến' },
  { value: 'rescheduled', label: 'Đã đổi lịch' },
]

const appointmentTabOptions = [
  { key: 'all', label: 'Tất cả', icon: 'dashboard', empty: 'Chưa có lịch hẹn phù hợp.' },
  { key: 'upcoming', label: 'Sắp tới', icon: 'event', empty: 'Chưa có lịch hẹn sắp tới.' },
  { key: 'pending', label: 'Chờ xác nhận', icon: 'schedule', empty: 'Chưa có lịch hẹn chờ xác nhận.' },
  { key: 'confirmed', label: 'Đã xác nhận', icon: 'verified', empty: 'Chưa có lịch hẹn đã xác nhận.' },
  { key: 'payment_due', label: 'Cần thanh toán', icon: 'payments', empty: 'Không có lịch hẹn cần thanh toán.' },
  { key: 'today', label: 'Hôm nay', icon: 'calendar_today', empty: 'Hôm nay chưa có lịch hẹn.' },
  { key: 'checked_in', label: 'Đã check-in', icon: 'check_circle', empty: 'Chưa có lịch đã check-in.' },
  { key: 'completed', label: 'Đã hoàn thành', icon: 'check_circle', empty: 'Chưa có lịch hẹn đã hoàn thành.' },
  { key: 'cancelled', label: 'Đã hủy', icon: 'close', empty: 'Chưa có lịch hẹn đã hủy.' },
  { key: 'no_show', label: 'Không đến', icon: 'warning', empty: 'Chưa có lịch hẹn không đến.' },
]

const appointmentDateFilterOptions = [
  { value: 'all', label: 'Tất cả thời gian' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'next7', label: '7 ngày tới' },
  { value: 'next30', label: '30 ngày tới' },
  { value: 'past', label: 'Đã qua' },
]

const appointmentPaymentFilterOptions = [
  { value: 'all', label: 'Tất cả thanh toán' },
  { value: 'unpaid', label: 'Chưa thanh toán' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'paid', label: 'Đã thanh toán' },
  { value: 'none', label: 'Chưa phát sinh' },
]

function canCancelAppointmentStatus(status) {
  return status && !terminalAppointmentStatuses.has(status) && status !== 'in_consultation'
}

function canRescheduleAppointmentStatus(status) {
  return ['booked', 'confirmed'].includes(status)
}

function isTerminalAppointmentStatus(status) {
  return terminalAppointmentStatuses.has(status)
}

function formatAppointmentDateTime(value) {
  if (!value) {
    return 'Chưa có thời gian'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có thời gian'
  }

  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getQueueStatusMeta(status) {
  const map = {
    waiting: { label: 'Đang chờ', tone: 'upcoming' },
    called: { label: 'Đang gọi', tone: 'upcoming' },
    recalled: { label: 'Gọi lại', tone: 'soft' },
    skipped: { label: 'Bỏ qua lượt', tone: 'soft' },
    in_service: { label: 'Đang phục vụ', tone: 'good' },
    completed: { label: 'Hoàn tất', tone: 'good' },
    cancelled: { label: 'Đã hủy', tone: 'rose' },
  }

  return map[status] || { label: status || 'Chưa có hàng đợi', tone: 'soft' }
}

function unwrapApiPayload(response) {
  return response?.data?.data ?? response?.data ?? response
}

function normalizeAppointmentFilterValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeAppointmentStatus(value) {
  return String(value || '').trim().toLowerCase()
}

function isSameLocalDate(left, right = new Date()) {
  if (!(left instanceof Date) || Number.isNaN(left.getTime())) {
    return false
  }

  return getLocalDateKey(left) === getLocalDateKey(right)
}

function getAppointmentPaymentMeta(appointment) {
  const rawStatus =
    appointment?.payment_status ||
    appointment?.paymentStatus ||
    appointment?.invoice_status ||
    appointment?.billing_status ||
    appointment?.payment?.status ||
    appointment?.invoice?.status ||
    ''
  const status = normalizeAppointmentStatus(rawStatus)
  const balanceDue = Number(
    appointment?.balance_due ??
      appointment?.balanceDue ??
      appointment?.amount_due ??
      appointment?.remaining_amount ??
      appointment?.invoice?.balance_due ??
      appointment?.invoice?.remaining_amount ??
      0,
  )

  if (['paid', 'settled', 'completed'].includes(status) || appointment?.is_paid || appointment?.paid_at) {
    return { key: 'paid', label: 'Đã thanh toán', tone: 'good' }
  }

  if (['pending', 'pending_manual_confirmation', 'processing', 'submitted'].includes(status)) {
    return { key: 'pending', label: 'Chờ xác nhận', tone: 'pending' }
  }

  if (
    balanceDue > 0 ||
    appointment?.requires_payment ||
    ['unpaid', 'issued', 'partially_paid', 'overdue', 'payment_due', 'pending_payment'].includes(status)
  ) {
    return { key: 'unpaid', label: 'Chưa thanh toán', tone: 'rose' }
  }

  return { key: 'none', label: 'Chưa phát sinh', tone: 'soft' }
}

function getAppointmentCheckinMeta(appointment, statusKey) {
  const queueTicket = appointment?.queue_ticket || appointment?.queueTicket || null
  const checkedInAt = appointment?.checked_in_at || appointment?.checkin_time || queueTicket?.checkin_time
  const normalizedStatus = normalizeAppointmentStatus(statusKey)

  if (checkedInAt || queueTicket || ['checked_in', 'in_consultation'].includes(normalizedStatus)) {
    return { key: 'checked_in', label: 'Đã check-in', tone: 'good' }
  }

  if (normalizedStatus === 'completed') {
    return { key: 'completed', label: 'Hoàn tất', tone: 'good' }
  }

  if (['cancelled', 'no_show'].includes(normalizedStatus)) {
    return { key: 'not_applicable', label: 'Không áp dụng', tone: 'soft' }
  }

  return { key: 'not_checked_in', label: 'Chưa check-in', tone: 'pending' }
}

function getAppointmentTimeRemainingText(startsAt, statusKey) {
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    return 'Chưa có thời gian'
  }

  const normalizedStatus = normalizeAppointmentStatus(statusKey)

  if (terminalAppointmentStatuses.has(normalizedStatus)) {
    return 'Đã kết thúc'
  }

  const diff = startsAt.getTime() - Date.now()

  if (diff <= 0) {
    return 'Đã đến giờ hẹn'
  }

  const totalMinutes = Math.ceil(diff / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return hours > 0 ? `Còn ${days} ngày ${hours} giờ` : `Còn ${days} ngày`
  }

  if (hours > 0) {
    return minutes > 0 ? `Còn ${hours} giờ ${minutes} phút` : `Còn ${hours} giờ`
  }

  return `Còn ${Math.max(minutes, 1)} phút`
}

function hasAppointmentPaymentDue(appointment) {
  return ['unpaid', 'pending'].includes(appointment?.paymentStatusKey)
}

const pendingAppointmentStatuses = new Set([
  'booked',
  'pending',
  'waiting',
])

const confirmedAppointmentStatuses = new Set(['confirmed'])

const upcomingAppointmentStatuses = new Set(['scheduled', 'upcoming'])

const completedAppointmentStatuses = new Set(['completed'])

function getAppointmentCategoryKey(appointment) {
  const status = String(appointment?.statusKey || '').toLowerCase()
  const label = normalizeAppointmentFilterValue(appointment?.status)

  if (completedAppointmentStatuses.has(status) || label.includes('hoan thanh') || label.includes('hoan tat')) {
    return 'completed'
  }

  if (
    pendingAppointmentStatuses.has(status) ||
    label.includes('dang cho')
  ) {
    return 'pending'
  }

  if (confirmedAppointmentStatuses.has(status) || label.includes('da xac nhan')) {
    return 'confirmed'
  }

  if (upcomingAppointmentStatuses.has(status) || label.includes('sap toi')) {
    return 'upcoming'
  }

  if (!status) {
    return appointment?.isPast ? 'completed' : 'upcoming'
  }

  if (terminalAppointmentStatuses.has(status)) {
    return 'other'
  }

  return 'other'
}

function appointmentMatchesTab(appointment, tabKey) {
  const status = normalizeAppointmentStatus(appointment?.statusKey)
  const startsAt = appointment?.startsAt
  const isFuture = startsAt instanceof Date && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() >= Date.now()

  switch (tabKey) {
    case 'all':
      return true
    case 'upcoming':
      return isFuture && !['cancelled', 'completed', 'no_show'].includes(status)
    case 'pending':
      return pendingAppointmentStatuses.has(status)
    case 'confirmed':
      return status === 'confirmed'
    case 'payment_due':
      return hasAppointmentPaymentDue(appointment)
    case 'today':
      return isSameLocalDate(startsAt)
    case 'checked_in':
      return ['checked_in', 'in_consultation'].includes(status) || appointment?.checkinStatusKey === 'checked_in'
    case 'completed':
      return status === 'completed'
    case 'cancelled':
      return status === 'cancelled'
    case 'no_show':
      return status === 'no_show'
    default:
      return true
  }
}

function appointmentMatchesDateFilter(appointment, filterKey) {
  const startsAt = appointment?.startsAt

  if (filterKey === 'all') {
    return true
  }

  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    return false
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (filterKey === 'today') {
    return isSameLocalDate(startsAt)
  }

  if (filterKey === 'past') {
    return startsAt < today
  }

  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + (filterKey === 'next7' ? 7 : 30))

  return startsAt >= today && startsAt <= maxDate
}

function buildAppointmentSearchText(appointment) {
  return [
    appointment?.id,
    appointment?.appointmentCode,
    appointment?.title,
    appointment?.doctor,
    appointment?.specialty,
    appointment?.facility,
    appointment?.location,
    appointment?.reason,
    appointment?.status,
    appointment?.statusKey,
    appointment?.paymentStatusLabel,
    appointment?.checkinStatusLabel,
    appointment?.date,
    appointment?.time,
  ]
    .filter(Boolean)
    .join(' ')
}

function getAppointmentActionItems(appointment) {
  const status = normalizeAppointmentStatus(appointment?.statusKey)
  const actions = [{ id: 'detail', label: 'Chi tiết', icon: 'chevron_right', tone: 'soft' }]

  if (status === 'booked') {
    actions.unshift(
      { id: 'reschedule', label: 'Dời lịch', icon: 'calendar_add_on', tone: 'primary' },
      { id: 'cancel', label: 'Hủy lịch', icon: 'close', tone: 'danger' },
    )
    actions.push({ id: 'pending', label: 'Chờ xác nhận', icon: 'schedule', tone: 'muted', disabled: true })
    return actions
  }

  if (status === 'confirmed') {
    actions.unshift(
      { id: 'checkin', label: 'Check-in online', icon: 'check_circle', tone: 'primary' },
      { id: 'reschedule', label: 'Dời lịch', icon: 'calendar_add_on', tone: 'soft' },
      { id: 'cancel', label: 'Hủy lịch', icon: 'close', tone: 'danger' },
      { id: 'directions', label: 'Hướng dẫn đến phòng', icon: 'directions', tone: 'soft' },
    )

    if (hasAppointmentPaymentDue(appointment)) {
      actions.splice(1, 0, { id: 'pay', label: 'Thanh toán trước', icon: 'payments', tone: 'primary' })
    }

    return actions
  }

  if (['checked_in', 'in_consultation'].includes(status)) {
    actions.unshift(
      { id: 'queue', label: 'Xem queue', icon: 'receipt_long', tone: 'primary' },
      { id: 'directions', label: 'Xem phòng khám', icon: 'directions', tone: 'soft' },
    )
    return actions
  }

  if (status === 'completed') {
    actions.unshift(
      { id: 'visit', label: 'Xem lượt khám', icon: 'clinical_notes', tone: 'primary' },
      { id: 'results', label: 'Xem kết quả', icon: 'science', tone: 'soft' },
      { id: 'prescription', label: 'Xem đơn thuốc', icon: 'medication', tone: 'soft' },
      { id: 'invoice', label: 'Xem hóa đơn', icon: 'receipt_long', tone: 'soft' },
      { id: 'feedback', label: 'Đánh giá dịch vụ', icon: 'star', tone: 'soft' },
    )
    return actions
  }

  if (status === 'cancelled') {
    actions.unshift(
      { id: 'rebook', label: 'Đặt lại lịch', icon: 'calendar_add_on', tone: 'primary' },
      { id: 'support', label: 'Liên hệ hỗ trợ', icon: 'support_agent', tone: 'soft' },
    )
    return actions
  }

  if (status === 'no_show') {
    actions.unshift(
      { id: 'rebook', label: 'Đặt lại lịch', icon: 'calendar_add_on', tone: 'primary' },
      { id: 'support', label: 'Liên hệ hỗ trợ', icon: 'support_agent', tone: 'soft' },
    )
  }

  return actions
}

function mapApiAppointment(appointment) {
  const status = getAppointmentStatusMeta(appointment.status)
  const startsAt = parseAppointmentDate(appointment.appointment_time)
  const statusKey = appointment.status || ''
  const paymentStatus = getAppointmentPaymentMeta(appointment)
  const checkinStatus = getAppointmentCheckinMeta(appointment, statusKey)
  const doctorName = appointment.doctor_name || `Bác sĩ ${String(appointment.doctor_id || '').slice(-6)}`
  const specialty =
    translateMedicalLabel(appointment.department_name) ||
    translateMedicalLabel(appointment.appointment_type) ||
    `Khoa ${String(appointment.department_id || '').slice(-6)}`
  const title =
    appointment.appointment_title ||
    appointment.reason ||
    appointment.visit_reason ||
    (specialty ? `Khám chuyên khoa ${specialty}` : 'Lịch hẹn khám')
  const location =
    appointment.room_name ||
    appointment.room ||
    appointment.clinic_room ||
    appointment.location_name ||
    appointment.department_name ||
    'Đang cập nhật'

  return {
    id: appointment.appointment_id || `${appointment.doctor_id}-${appointment.appointment_time}`,
    appointmentCode:
      appointment.appointment_code ||
      appointment.appointment_no ||
      appointment.code ||
      appointment.appointment_id ||
      `${appointment.doctor_id || 'APT'}-${formatDateOnly(appointment.appointment_time) || 'NEW'}`,
    startsAt,
    isPast: Boolean(isTerminalAppointmentStatus(statusKey) || (startsAt && startsAt.getTime() <= Date.now())),
    dateParts: getAppointmentDateParts(startsAt),
    facility: appointment.facility_name || appointment.hospital_name || 'Bệnh viện Đa khoa Bộ Y tế',
    location,
    title,
    doctor: doctorName,
    doctorAvatar:
      appointment.doctor_avatar ||
      appointment.doctor_avatar_url ||
      appointment.avatar_url ||
      appointment.doctor?.avatar ||
      appointment.doctor?.avatar_url ||
      getStableAvatar(doctorName || appointment.doctor_id),
    specialty,
    date: formatAppointmentDate(appointment.appointment_time),
    shortDate: formatDateOnly(appointment.appointment_time),
    time: formatAppointmentTime(appointment.appointment_time),
    status: status.label,
    statusKey,
    tone: status.tone,
    paymentStatusKey: paymentStatus.key,
    paymentStatusLabel: paymentStatus.label,
    paymentTone: paymentStatus.tone,
    checkinStatusKey: checkinStatus.key,
    checkinStatusLabel: checkinStatus.label,
    checkinTone: checkinStatus.tone,
    reason: appointment.reason || appointment.visit_reason || appointment.chief_complaint || 'Chưa có lý do khám',
    preparationNote:
      appointment.preparation_note ||
      appointment.preparation_instructions ||
      appointment.instructions ||
      'Đến sớm 15 phút và mang theo giấy tờ tùy thân.',
    remainingText: getAppointmentTimeRemainingText(startsAt, statusKey),
    queueTicketNo:
      appointment.queue_ticket?.queue_number ||
      appointment.queue_ticket?.ticket_no ||
      appointment.queue_number ||
      appointment.ticket_no ||
      '',
    invoiceId: appointment.invoice_id || appointment.invoice?.invoice_id || appointment.billing_invoice_id || '',
    encounterId: appointment.encounter_id || appointment.encounter?.encounter_id || '',
    icon: 'medical_services',
    apiBacked: Boolean(appointment.appointment_id),
    raw: appointment,
    doctorId: appointment.doctor_id,
    departmentId: appointment.department_id,
    doctorScheduleId: appointment.doctor_schedule_id,
    appointmentTime: appointment.appointment_time,
  }
}

function mapLegacyAppointment(appointment) {
  const startsAt = parseAppointmentDate(appointment.date, appointment.time)
  const statusKey = appointment.statusKey || ''
  const paymentStatus = getAppointmentPaymentMeta(appointment)
  const checkinStatus = getAppointmentCheckinMeta(appointment, statusKey)

  return {
    id: appointment.id,
    appointmentCode: appointment.code || appointment.id,
    startsAt,
    isPast: appointment.isPast ?? Boolean(startsAt && startsAt.getTime() <= Date.now()),
    dateParts: getAppointmentDateParts(startsAt),
    facility: appointment.facility || 'Bệnh viện Đa khoa Bộ Y tế',
    location: appointment.location || appointment.specialty || 'Khu khám chuyên khoa',
    title: appointment.title || `Khám chuyên khoa ${appointment.specialty || ''}`.trim(),
    doctor: appointment.doctor,
    doctorAvatar: appointment.avatar || appointment.doctorAvatar || getStableAvatar(appointment.doctor),
    specialty: appointment.specialty,
    date: appointment.date,
    shortDate: formatDateOnly(startsAt) || appointment.date,
    time: appointment.time,
    status: appointment.status,
    statusKey,
    tone: appointment.tone || 'soft',
    paymentStatusKey: paymentStatus.key,
    paymentStatusLabel: paymentStatus.label,
    paymentTone: paymentStatus.tone,
    checkinStatusKey: checkinStatus.key,
    checkinStatusLabel: checkinStatus.label,
    checkinTone: checkinStatus.tone,
    reason: appointment.reason || appointment.title || 'Chưa có lý do khám',
    preparationNote: appointment.preparationNote || 'Đến sớm 15 phút và mang theo giấy tờ tùy thân.',
    remainingText: getAppointmentTimeRemainingText(startsAt, statusKey),
    queueTicketNo: appointment.queueTicketNo || '',
    invoiceId: appointment.invoiceId || '',
    encounterId: appointment.encounterId || '',
    icon: appointment.icon || 'medical_services',
    apiBacked: false,
    raw: appointment,
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

function escapeSvgText(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return map[char] || char
  })
}

function getStableAvatar(label = 'TK') {
  const source = String(label || 'TK').trim() || 'TK'
  const hash = [...source].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const [from, to] = stableAvatarPalettes[hash % stableAvatarPalettes.length]
  const initials = (getInitialsFromLabel(source) || 'TK').slice(0, 2)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${from}"/>
          <stop offset="1" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="80" fill="url(#g)"/>
      <circle cx="118" cy="42" r="26" fill="rgba(255,255,255,.14)"/>
      <circle cx="38" cy="128" r="34" fill="rgba(255,255,255,.10)"/>
      <text x="80" y="94" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" font-weight="700" fill="#fff">${escapeSvgText(initials)}</text>
    </svg>
  `

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
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

function getScheduleDoctorAvatar(schedule) {
  const avatar =
    schedule.doctor_avatar_url ||
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

  return ''
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
  const preferredOrder = patientSpecialtyDisplayOrder

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

function getSpecialtyIconName(label) {
  const key = normalizeSpecialtyKey(label)

  if (!key || key === 'tat ca') return 'local_hospital'
  if (key.includes('tim mach')) return 'ecg_heart'
  if (key.includes('ho hap')) return 'pulmonology'
  if (key.includes('huyet hoc') || key.includes('xet nghiem')) return 'lab_research'
  if (key.includes('chan doan') || key.includes('hinh anh')) return 'radiology'
  if (key.includes('than kinh')) return 'psychology'
  if (key.includes('hoi suc') || key.includes('cap cuu')) return 'emergency'
  if (key.includes('san') || key.includes('phu khoa')) return 'favorite'
  if (key.includes('nhi')) return 'help_clinic'
  if (key.includes('tieu hoa')) return 'gastroenterology'
  if (key.includes('noi tiet') || key.includes('dai thao duong')) return 'bloodtype'

  return 'medical_services'
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
  const specialty = translateMedicalLabel(schedule.specialty) || getDepartmentName(departments, schedule.department_id)
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
    avatar: getScheduleDoctorAvatar(schedule),
    consultationFee: Number(schedule.consultation_fee || 0),
    consultationDurationMinutes: Number(schedule.consultation_duration_minutes || schedule.slot_duration_minutes || 15),
    locationNote: schedule.location_note || '',
    schedule,
  }
}

function mapBookingDoctorOption(doctor) {
  const specialty = translateMedicalLabel(doctor.specialty || doctor.department_name) || 'Khám tổng quát'
  const doctorName = doctor.full_name || doctor.name || `Bác sĩ ${String(doctor.doctor_id || '').slice(-6)}`
  const doctorCode = doctor.doctor_code || doctor.employee_code || ''
  const doctorKey = [
    doctor.doctor_id || doctorCode || doctorName,
    doctor.department_id || specialty,
  ]
    .filter(Boolean)
    .map(String)
    .join('::')
  const ratingMeta = buildScheduleRating({
    doctor_id: doctor.doctor_id || doctor.doctor_profile_id || doctorCode || doctorName,
  })
  const nextAvailableLabel = doctor.next_available_at ? formatAppointmentDate(doctor.next_available_at) : ''

  return {
    id: doctorKey,
    scheduleId: doctor.next_schedule_id || null,
    doctorKey,
    name: doctorName,
    displayName: doctorName,
    doctorCode,
    specialty,
    rating: ratingMeta.rating,
    reviews: ratingMeta.reviews,
    nextAvailableLabel,
    availability: doctor.next_schedule_id ? 'Có lịch' : 'Chưa có lịch',
    initials: getInitialsFromLabel(doctorName) || 'BS',
    avatar: doctor.avatar_url || doctor.avatar || getStableAvatar(doctorName || doctor.doctor_id),
    consultationFee: Number(doctor.consultation_fee || 0),
    consultationDurationMinutes: Number(doctor.consultation_duration_minutes || 15),
    locationNote: doctor.location_note || '',
    hasApiSchedule: Boolean(doctor.next_schedule_id),
    schedule: null,
    schedules: [],
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

function mergeDoctorOptions(scheduleDoctorOptions, bookingDoctorOptions) {
  const groups = new Map()

  scheduleDoctorOptions.forEach((doctor) => {
    groups.set(getDoctorGroupKey(doctor), doctor)
  })

  bookingDoctorOptions.forEach((doctor) => {
    const key = getDoctorGroupKey(doctor)
    if (!groups.has(key)) {
      groups.set(key, doctor)
    }
  })

  return Array.from(groups.values())
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

  return sortSpecialtyOptions(Array.from(new Set(source)))
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

function buildDisplayDoctorOptions(apiDoctorOptions, specialtyLookup) {
  return apiDoctorOptions
    .map((doctor) => withResolvedSpecialty(doctor, specialtyLookup))
    .filter((doctor) => isPatientVisibleSpecialty(doctor.specialty))
}

export default function PatientAppointmentsPage({
  appointments = [],
  authorizations = [],
  bookingDoctors = [],
  departments = [],
  loading = false,
  onAppointmentCreated,
  onBookAppointment,
  onNavigate,
  onOpenSupportChat,
  patientProfile,
  relatives = [],
  schedules = [],
  user,
  viewMode = 'booking',
}) {
  const [selectedDoctorId, setSelectedDoctorId] = useState('')
  const [selectedScheduleId, setSelectedScheduleId] = useState(null)
  const [calendarViewMonth, setCalendarViewMonth] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [visitMode, setVisitMode] = useState('outpatient')
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [bookingFor, setBookingFor] = useState('self')
  const [selectedRelativeId, setSelectedRelativeId] = useState('')
  const [step, setStep] = useState(1)
  const [reason, setReason] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [confirmedAppointment, setConfirmedAppointment] = useState(null)
  const [hasSyncedApiDefaultDoctor, setHasSyncedApiDefaultDoctor] = useState(false)
  const [appointmentTab, setAppointmentTab] = useState('upcoming')
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [appointmentDetail, setAppointmentDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [appointmentActionLoading, setAppointmentActionLoading] = useState('')
  const [appointmentActionFeedback, setAppointmentActionFeedback] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rescheduleScheduleId, setRescheduleScheduleId] = useState('')
  const [rescheduleSlots, setRescheduleSlots] = useState([])
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false)
  const [rescheduleSlotsError, setRescheduleSlotsError] = useState('')
  const [rescheduleSlotValue, setRescheduleSlotValue] = useState('')
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [appointmentSearchTerm, setAppointmentSearchTerm] = useState('')
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all')
  const [appointmentDateFilter, setAppointmentDateFilter] = useState('all')
  const [appointmentSpecialtyFilter, setAppointmentSpecialtyFilter] = useState('all')
  const [appointmentDoctorFilter, setAppointmentDoctorFilter] = useState('all')
  const [appointmentPaymentFilter, setAppointmentPaymentFilter] = useState('all')
  const [waitlistItems, setWaitlistItems] = useState([])
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  const deferredAppointmentSearchTerm = useDeferredValue(appointmentSearchTerm)
  const appointmentRows = useMemo(
    () => appointments.map(mapApiAppointment),
    [appointments],
  )
  const appointmentTimelineRows = useMemo(() => {
    return [...appointmentRows].sort((left, right) => {
      const leftTime = left.startsAt instanceof Date ? left.startsAt.getTime() : 0
      const rightTime = right.startsAt instanceof Date ? right.startsAt.getTime() : 0

      return leftTime - rightTime
    })
  }, [appointmentRows])
  const appointmentSpecialtyOptions = useMemo(() => {
    const values = Array.from(
      new Set(appointmentTimelineRows.map((appointment) => appointment.specialty).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right, 'vi'))

    return [{ value: 'all', label: 'Tất cả chuyên khoa' }, ...values.map((value) => ({ value, label: value }))]
  }, [appointmentTimelineRows])
  const appointmentDoctorOptions = useMemo(() => {
    const values = Array.from(
      new Set(appointmentTimelineRows.map((appointment) => appointment.doctor).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right, 'vi'))

    return [{ value: 'all', label: 'Tất cả bác sĩ' }, ...values.map((value) => ({ value, label: value }))]
  }, [appointmentTimelineRows])
  const appointmentSummaryCards = useMemo(() => {
    const upcomingCount = appointmentTimelineRows.filter(
      (appointment) => appointmentMatchesTab(appointment, 'upcoming'),
    ).length
    const completedCount = appointmentTimelineRows.filter(
      (appointment) => appointmentMatchesTab(appointment, 'completed'),
    ).length
    const confirmedCount = appointmentTimelineRows.filter(
      (appointment) => appointmentMatchesTab(appointment, 'confirmed'),
    ).length
    const pendingCount = appointmentTimelineRows.filter(
      (appointment) => appointmentMatchesTab(appointment, 'pending'),
    ).length
    const todayCount = appointmentTimelineRows.filter(
      (appointment) => appointmentMatchesTab(appointment, 'today'),
    ).length
    const cancelledCount = appointmentTimelineRows.filter(
      (appointment) => appointmentMatchesTab(appointment, 'cancelled'),
    ).length

    return [
      {
        id: 'upcoming',
        icon: 'calendar_today',
        tone: 'blue',
        label: 'Sắp tới',
        count: upcomingCount,
        unit: 'lịch hẹn',
        filter: { tab: 'upcoming', status: 'all' },
        ariaLabel: 'Xem lịch hẹn sắp tới',
      },
      {
        id: 'pending',
        icon: 'schedule',
        tone: 'orange',
        label: 'Chờ xác nhận',
        count: pendingCount,
        unit: 'lịch hẹn',
        filter: { tab: 'pending', status: 'all' },
        ariaLabel: 'Xem lịch hẹn đang chờ',
      },
      {
        id: 'confirmed',
        icon: 'verified',
        tone: 'soft',
        label: 'Đã xác nhận',
        count: confirmedCount,
        unit: 'lịch hẹn',
        filter: { tab: 'confirmed', status: 'all' },
        ariaLabel: 'Xem lịch hẹn đã xác nhận',
      },
      {
        id: 'today',
        icon: 'calendar_today',
        tone: 'soft',
        label: 'Hôm nay',
        count: todayCount,
        unit: 'lịch hẹn',
        filter: { tab: 'today', status: 'all' },
        ariaLabel: 'Xem lịch hẹn hôm nay',
      },
      {
        id: 'completed',
        icon: 'check_circle',
        tone: 'green',
        label: 'Đã hoàn thành',
        count: completedCount,
        unit: 'lịch hẹn',
        filter: { tab: 'completed', status: 'all' },
        ariaLabel: 'Xem lịch hẹn đã hoàn thành',
      },
      {
        id: 'cancelled',
        icon: 'close',
        tone: 'rose',
        label: 'Đã hủy',
        count: cancelledCount,
        unit: 'lịch hẹn',
        filter: { tab: 'cancelled', status: 'all' },
        ariaLabel: 'Xem lịch hẹn đã hủy',
      },
    ]
  }, [appointmentTimelineRows])
  const activeAppointmentTab = useMemo(
    () => appointmentTabOptions.find((tab) => tab.key === appointmentTab) || appointmentTabOptions[0],
    [appointmentTab],
  )
  const filteredAppointmentRows = useMemo(() => {
    const query = normalizeAppointmentFilterValue(deferredAppointmentSearchTerm.trim())

    return appointmentTimelineRows.filter((appointment) => {
      if (!appointmentMatchesTab(appointment, appointmentTab)) {
        return false
      }

      if (appointmentStatusFilter !== 'all' && normalizeAppointmentStatus(appointment.statusKey) !== appointmentStatusFilter) {
        return false
      }

      if (!appointmentMatchesDateFilter(appointment, appointmentDateFilter)) {
        return false
      }

      if (appointmentSpecialtyFilter !== 'all' && appointment.specialty !== appointmentSpecialtyFilter) {
        return false
      }

      if (appointmentDoctorFilter !== 'all' && appointment.doctor !== appointmentDoctorFilter) {
        return false
      }

      if (appointmentPaymentFilter !== 'all' && appointment.paymentStatusKey !== appointmentPaymentFilter) {
        return false
      }

      if (!query) {
        return true
      }

      return normalizeAppointmentFilterValue(buildAppointmentSearchText(appointment)).includes(query)
    })
  }, [
    appointmentDateFilter,
    appointmentDoctorFilter,
    appointmentPaymentFilter,
    appointmentSpecialtyFilter,
    appointmentStatusFilter,
    appointmentTab,
    appointmentTimelineRows,
    deferredAppointmentSearchTerm,
  ])
  const appointmentFiltersActive =
    appointmentDateFilter !== 'all' ||
    appointmentDoctorFilter !== 'all' ||
    appointmentPaymentFilter !== 'all' ||
    appointmentSpecialtyFilter !== 'all' ||
    appointmentStatusFilter !== 'all' ||
    appointmentSearchTerm.trim().length > 0
  const filteredAppointmentCount = filteredAppointmentRows.length
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
  const bookingDoctorOptions = useMemo(
    () =>
      bookingDoctors
        .map(mapBookingDoctorOption)
        .filter((option) => isPatientVisibleSpecialty(option.specialty)),
    [bookingDoctors],
  )
  const mergedDoctorOptions = useMemo(
    () => mergeDoctorOptions(uniqueDoctorOptions, bookingDoctorOptions),
    [bookingDoctorOptions, uniqueDoctorOptions],
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
    () => buildDisplayDoctorOptions(mergedDoctorOptions, specialtyLookup),
    [mergedDoctorOptions, specialtyLookup],
  )
  const specialtyOptions = useMemo(() => {
    const doctorSpecialtySet = new Set(
      doctorOptions
        .map((doctor) => doctor.specialtyFilterValue || doctor.specialty)
        .filter(isPatientVisibleSpecialty),
    )
    const specialties = sortSpecialtyOptions(Array.from(
      new Set(doctorSpecialtySet),
    ))

    return [
      { value: 'all', label: 'Tất cả' },
      ...specialties.map((specialty) => ({
        value: specialty,
        label: specialty,
        hasDoctor: doctorSpecialtySet.has(specialty),
      })),
    ]
  }, [doctorOptions])
  const specialtyDoctorCounts = useMemo(() => {
    const counts = new Map()

    doctorOptions.forEach((doctor) => {
      const specialty = doctor.specialtyFilterValue || doctor.specialty

      if (!isPatientVisibleSpecialty(specialty)) {
        return
      }

      counts.set(specialty, (counts.get(specialty) || 0) + 1)
    })

    return counts
  }, [doctorOptions])
  const selectedSpecialtyMeta = useMemo(() => {
    const option =
      specialtyOptions.find((specialty) => specialty.value === selectedSpecialty) ||
      specialtyOptions[0] ||
      { value: 'all', label: 'Tất cả' }
    const doctorCount =
      option.value === 'all'
        ? doctorOptions.length
        : specialtyDoctorCounts.get(option.value) || 0

    return {
      ...option,
      doctorCount,
      iconName: getSpecialtyIconName(option.label),
    }
  }, [doctorOptions.length, selectedSpecialty, specialtyDoctorCounts, specialtyOptions])
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
    doctorOptions.find((d) => d.id === selectedDoctorId) ||
    filteredDoctorOptions[0] ||
    (!doctorSearch.trim() && selectedSpecialty === 'all' ? doctorOptions[0] : null) ||
    null
  const selectedDoctorGroupKey = selectedDoctor?.id || getDoctorGroupKey(selectedDoctor)
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
  const selectedSchedule = selectedScheduleOption?.schedule || null
  const calendarDays =
    selectedDoctorUniqueScheduleOptions.map((option) => ({
        label: formatAppointmentDate(option.schedule.work_date),
        value: option.id,
        dateValue: option.schedule.work_date,
        muted: false,
        selected: option.id === selectedScheduleOption?.id,
      }))
  const timeSlots =
    availableSlots.map((slot) => ({
        value: slot.slot_time,
        label: formatAppointmentTime(slot.slot_time),
        disabled: !slot.is_available || slot.is_booked || slot.is_blocked || isPastSlotTime(slot.slot_time),
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
        selected: day.selected,
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
    Boolean(selectedSchedule && timeSlots.some((slot) => slot.value === selectedTime && !slot.disabled))
  const selectedDoctorCanBook = Boolean(selectedDoctor?.hasApiSchedule && selectedScheduleOption)
  const visitModeLabel = visitMode === 'telemedicine' ? 'Tư vấn trực tuyến' : 'Khám tại bệnh viện'
  const selectedDateLabel = formatAppointmentDate(selectedSchedule?.work_date)
  const selectedTimeLabel = formatAppointmentTime(selectedTime)
  const consultationFee = Number(selectedSchedule?.consultation_fee || selectedDoctor?.consultationFee || 0)
  const adminFee = consultationFee > 0 ? 15000 : 0
  const totalEstimatedFee = consultationFee + adminFee
  const selectedLocationName = selectedSchedule?.department_name || selectedDoctor?.specialty || 'Cơ sở y tế'
  const selectedLocationNote = selectedSchedule?.location_note || selectedDoctor?.locationNote || 'Thông tin vị trí sẽ được cập nhật theo lịch khám.'
  const detailAppointmentRecord = appointmentDetail?.appointment || selectedAppointment?.raw || null
  const detailAppointmentRow = useMemo(() => {
    if (appointmentDetail?.appointment) {
      return {
        ...selectedAppointment,
        ...mapApiAppointment(appointmentDetail.appointment),
      }
    }

    return selectedAppointment
  }, [appointmentDetail?.appointment, selectedAppointment])
  const detailAppointmentId = detailAppointmentRecord?.appointment_id || selectedAppointment?.id || ''
  const detailStatusKey = detailAppointmentRecord?.status || selectedAppointment?.statusKey || ''
  const detailDoctorId = String(detailAppointmentRecord?.doctor_id || selectedAppointment?.doctorId || '')
  const detailDepartmentId = String(detailAppointmentRecord?.department_id || selectedAppointment?.departmentId || '')
  const detailCurrentScheduleId = String(
    detailAppointmentRecord?.doctor_schedule_id || selectedAppointment?.doctorScheduleId || '',
  )
  const detailIsApiBacked = Boolean(selectedAppointment?.apiBacked && detailAppointmentId)
  const detailCanCancel = detailIsApiBacked && canCancelAppointmentStatus(detailStatusKey)
  const detailCanReschedule = detailIsApiBacked && canRescheduleAppointmentStatus(detailStatusKey)
  const detailQueueTicket = appointmentDetail?.queue_ticket || null
  const detailQueueStatus = getQueueStatusMeta(detailQueueTicket?.status)
  const detailCheckedInAt = detailAppointmentRecord?.checked_in_at || detailQueueTicket?.checkin_time
  const detailHasQueueInfo = Boolean(
    detailQueueTicket ||
      detailCheckedInAt ||
      ['checked_in', 'in_consultation'].includes(detailStatusKey),
  )
  const detailIsConfirmedOnly = detailStatusKey === 'confirmed' && !detailHasQueueInfo
  const detailIsPendingOnly = pendingAppointmentStatuses.has(detailStatusKey) && !detailHasQueueInfo
  const rescheduleScheduleOptions = useMemo(() => {
    if (!detailDoctorId || !detailDepartmentId) {
      return []
    }

    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    return scheduleOptions
      .filter((option) => {
        const schedule = option.schedule || {}
        const scheduleDate = new Date(schedule.work_date || schedule.shift_start || schedule.shift_end)
        const isVisibleDate = Number.isNaN(scheduleDate.getTime()) || scheduleDate >= dayStart

        return (
          String(schedule.doctor_id || '') === detailDoctorId &&
          String(schedule.department_id || '') === detailDepartmentId &&
          isVisibleDate
        )
      })
      .sort((a, b) => getScheduleTimeValue(a) - getScheduleTimeValue(b))
  }, [detailDepartmentId, detailDoctorId, scheduleOptions])
  const rescheduleScheduleOption =
    rescheduleScheduleOptions.find((option) => String(option.id) === String(rescheduleScheduleId)) ||
    rescheduleScheduleOptions[0] ||
    null
  const rescheduleSelectedSlot = rescheduleSlots.find((slot) => slot.slot_time === rescheduleSlotValue) || null
  const patient = patientProfile?.patient || {}
  const patientDisplayName = patient.full_name || user?.fullName || 'Chưa cập nhật'
  const patientPhone = patient.phone || user?.phone || 'Chưa cập nhật'
  const patientEmail = patient.email || user?.email || ''
  const patientBirthDate = formatDateOnly(patient.date_of_birth)
  const authorizedRelativeOptions = useMemo(() => {
    const relativeMap = new Map()

    relatives.forEach((relative, index) => {
      const id = relative.relative_id || relative._id || relative.id || `relative-${index}`
      relativeMap.set(String(id), {
        id: String(id),
        fullName: relative.full_name || relative.name || relative.relative_name || 'Người thân',
        relationship: relative.relationship || relative.relation || 'Người thân',
        phone: relative.phone || relative.mobile || '',
      })
    })

    authorizations.forEach((authorization, index) => {
      const relative = authorization.relative || authorization.relative_id || {}
      const id =
        authorization.relative_id?._id ||
        authorization.relative_id ||
        relative.relative_id ||
        relative._id ||
        relative.id ||
        authorization.authorization_id ||
        authorization._id ||
        `authorization-${index}`

      if (!relativeMap.has(String(id))) {
        relativeMap.set(String(id), {
          id: String(id),
          fullName:
            relative.full_name ||
            authorization.relative_name ||
            authorization.grantee_name ||
            'Người thân được ủy quyền',
          relationship:
            relative.relationship ||
            authorization.relationship ||
            authorization.authorization_type ||
            'Ủy quyền',
          phone: relative.phone || authorization.relative_phone || '',
        })
      }
    })

    return Array.from(relativeMap.values())
  }, [authorizations, relatives])
  const selectedRelative =
    authorizedRelativeOptions.find((relative) => relative.id === selectedRelativeId) ||
    authorizedRelativeOptions[0] ||
    null
  const hasAuthorizedRelativeBooking = authorizedRelativeOptions.length > 0
  const bookingForRelative =
    hasAuthorizedRelativeBooking && bookingFor === 'authorized_relative' && Boolean(selectedRelative)
  const bookingPatientDisplayName = bookingForRelative ? selectedRelative.fullName : patientDisplayName
  const bookingPatientPhone = bookingForRelative ? selectedRelative.phone || patientPhone : patientPhone
  const bookingPatientRelation = bookingForRelative ? selectedRelative.relationship : 'Tôi'
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
      location: [selectedLocationName, selectedLocationNote].filter(Boolean).join(', '),
      startDate,
      endDate,
    }
  }, [confirmedAppointment, reason, selectedDoctor, selectedLocationName, selectedLocationNote, selectedSchedule, selectedTime])

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
      'PRODID:-//BoYTe//Patient Portal//VI',
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
      setSelectedDoctorId('')
      setSelectedScheduleId(null)
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
    if (step > 1 && !selectedDoctorCanBook) {
      setStep(1)
    }
  }, [selectedDoctorCanBook, step])

  useEffect(() => {
    if (viewMode === 'booking' || !appointmentAPI.getMyWaitlist) {
      return
    }

    let cancelled = false

    async function loadWaitlist() {
      setWaitlistLoading(true)
      setWaitlistError('')

      try {
        const response = await appointmentAPI.getMyWaitlist({ limit: 20 })
        const payload = unwrapApiPayload(response)
        const items = payload?.items || payload?.data || payload || []

        if (!cancelled) {
          setWaitlistItems(Array.isArray(items) ? items : [])
        }
      } catch (error) {
        if (!cancelled) {
          setWaitlistItems([])
          setWaitlistError(getApiErrorMessage(error, 'Không tải được danh sách chờ.'))
        }
      } finally {
        if (!cancelled) {
          setWaitlistLoading(false)
        }
      }
    }

    loadWaitlist()

    return () => {
      cancelled = true
    }
  }, [viewMode])

  useEffect(() => {
    if (filteredDoctorOptions.length === 0) {
      return
    }

    if (!filteredDoctorOptions.some((doctor) => doctor.id === selectedDoctorId)) {
      const nextDoctor = filteredDoctorOptions[0]
      setSelectedDoctorId(nextDoctor.id)
      setSelectedScheduleId(nextDoctor.scheduleId || nextDoctor.schedule?.doctor_schedule_id || null)
    }
  }, [filteredDoctorOptions, selectedDoctorId])

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
    if (!selectedAppointment) {
      return
    }

    if (rescheduleScheduleOptions.length === 0) {
      setRescheduleScheduleId('')
      setRescheduleSlots([])
      setRescheduleSlotValue('')
      return
    }

    const stillValid = rescheduleScheduleOptions.some(
      (option) => String(option.id) === String(rescheduleScheduleId),
    )

    if (stillValid) {
      return
    }

    const currentSchedule =
      rescheduleScheduleOptions.find((option) => String(option.id) === detailCurrentScheduleId) ||
      rescheduleScheduleOptions[0]

    setRescheduleScheduleId(currentSchedule?.id || '')
  }, [detailCurrentScheduleId, rescheduleScheduleId, rescheduleScheduleOptions, selectedAppointment])

  useEffect(() => {
    let cancelled = false

    async function loadRescheduleSlots() {
      if (!selectedAppointment || !rescheduleScheduleId || !detailCanReschedule) {
        setRescheduleSlots([])
        setRescheduleSlotValue('')
        return
      }

      setRescheduleSlotsLoading(true)
      setRescheduleSlotsError('')
      setRescheduleSlots([])

      try {
        const response = await scheduleAPI.getAvailableSlots(rescheduleScheduleId)
        const currentAppointmentTime = new Date(
          detailAppointmentRecord?.appointment_time || selectedAppointment?.appointmentTime || '',
        ).getTime()
        const items = (response.data?.data?.items || []).filter((slot) => {
          const slotTime = new Date(slot.slot_time).getTime()
          const isCurrentSlot =
            !Number.isNaN(currentAppointmentTime) && !Number.isNaN(slotTime) && slotTime === currentAppointmentTime

          return !isPastSlotTime(slot.slot_time) && !isCurrentSlot
        })

        if (!cancelled) {
          setRescheduleSlots(items)
          setRescheduleSlotValue((currentValue) => {
            const stillValid = items.some((slot) => slot.slot_time === currentValue)
            return stillValid ? currentValue : items[0]?.slot_time || ''
          })
        }
      } catch (error) {
        if (!cancelled) {
          setRescheduleSlots([])
          setRescheduleSlotValue('')
          setRescheduleSlotsError(getApiErrorMessage(error, 'Không tải được khung giờ đổi lịch.'))
        }
      } finally {
        if (!cancelled) {
          setRescheduleSlotsLoading(false)
        }
      }
    }

    loadRescheduleSlots()

    return () => {
      cancelled = true
    }
  }, [detailAppointmentRecord?.appointment_time, detailCanReschedule, rescheduleScheduleId, selectedAppointment])

  useEffect(() => {
    if (timeSlots.length === 0) {
      return
    }

    const firstAvailable = timeSlots.find((slot) => !slot.disabled)
    const stillValid = timeSlots.some((slot) => slot.value === selectedTime && !slot.disabled)

    if (!stillValid && firstAvailable) {
      setSelectedTime(firstAvailable.value)
    }
  }, [selectedTime, timeSlots])

  const handleAppointmentTabChange = (nextTab) => {
    setAppointmentTab(nextTab)
  }

  const handleAppointmentSummaryCardClick = (card) => {
    if (!card?.filter) {
      return
    }

    setAppointmentTab(card.filter.tab)
    setAppointmentStatusFilter(card.filter.status)
    setAppointmentSearchTerm('')
    setAppointmentDateFilter('all')
    setAppointmentSpecialtyFilter('all')
    setAppointmentDoctorFilter('all')
    setAppointmentPaymentFilter('all')
  }

  const handleResetAppointmentFilters = () => {
    setAppointmentSearchTerm('')
    setAppointmentStatusFilter('all')
    setAppointmentDateFilter('all')
    setAppointmentSpecialtyFilter('all')
    setAppointmentDoctorFilter('all')
    setAppointmentPaymentFilter('all')
  }

  const handleCloseAppointmentDetail = () => {
    setSelectedAppointment(null)
    setAppointmentDetail(null)
    setDetailLoading(false)
    setDetailError('')
    setAppointmentActionFeedback(null)
    setCancelReason('')
    setRescheduleReason('')
    setRescheduleScheduleId('')
    setRescheduleSlots([])
    setRescheduleSlotValue('')
    setRescheduleSlotsError('')
  }

  const handleOpenAppointmentDetail = async (appointment) => {
    setSelectedAppointment(appointment)
    setAppointmentDetail(null)
    setDetailLoading(false)
    setDetailError('')
    setAppointmentActionFeedback(null)
    setCancelReason('')
    setRescheduleReason('')
    setRescheduleSlots([])
    setRescheduleSlotValue('')
    setRescheduleSlotsError('')

    if (!appointment?.apiBacked || !appointment?.id) {
      return
    }

    setDetailLoading(true)

    try {
      const response = await appointmentAPI.getMyAppointmentDetail(appointment.id)
      setAppointmentDetail(unwrapApiPayload(response))
    } catch (error) {
      setDetailError(getApiErrorMessage(error, 'Không tải được chi tiết lịch hẹn.'))
    } finally {
      setDetailLoading(false)
    }
  }

  const applyAppointmentActionResult = async (response, message) => {
    const payload = unwrapApiPayload(response)

    setAppointmentDetail(payload)
    if (payload?.appointment) {
      setSelectedAppointment(mapApiAppointment(payload.appointment))
    }
    setAppointmentActionFeedback({ type: 'success', message })
    await onAppointmentCreated?.()
  }

  const handleQuickCancelAppointment = async (appointment) => {
    if (!appointment?.apiBacked || !canCancelAppointmentStatus(appointment.statusKey) || appointmentActionLoading) {
      return
    }

    const confirmed = window.confirm('Bạn chắc chắn muốn hủy lịch hẹn này?')
    if (!confirmed) {
      return
    }

    const reasonText = 'Bệnh nhân hủy từ danh sách lịch hẹn'
    setAppointmentActionLoading(`cancel:${appointment.id}`)
    setAppointmentActionFeedback(null)

    try {
      const response = await appointmentAPI.cancelMyAppointment(appointment.id, {
        reason: reasonText,
        cancel_reason: reasonText,
      })
      const payload = unwrapApiPayload(response)
      setAppointmentDetail(payload)
      setAppointmentActionFeedback({ type: 'success', message: 'Đã hủy lịch hẹn thành công.' })
      await onAppointmentCreated?.()
    } catch (error) {
      setAppointmentActionFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Không thể hủy lịch hẹn.'),
      })
    } finally {
      setAppointmentActionLoading('')
    }
  }

  const handleQuickCheckInAppointment = async (appointment) => {
    if (!appointment?.apiBacked || appointmentActionLoading) {
      return
    }

    setAppointmentActionLoading(`checkin:${appointment.id}`)
    setAppointmentActionFeedback(null)

    try {
      const response = await appointmentAPI.checkInMyAppointment(appointment.id, {
        method: 'online',
        source: 'patient_portal',
      })
      const payload = unwrapApiPayload(response)
      setAppointmentDetail(payload)
      setAppointmentActionFeedback({ type: 'success', message: 'Đã check-in online thành công.' })
      await onAppointmentCreated?.()
      onNavigate?.('checkin-queue')
    } catch (error) {
      setAppointmentActionFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Không thể check-in online.'),
      })
    } finally {
      setAppointmentActionLoading('')
    }
  }

  const handleAppointmentCardAction = (event, appointment, actionId) => {
    event.stopPropagation()

    if (!appointment || actionId === 'pending') {
      return
    }

    if (actionId === 'detail' || actionId === 'reschedule') {
      handleOpenAppointmentDetail(appointment)
      return
    }

    if (actionId === 'cancel') {
      handleQuickCancelAppointment(appointment)
      return
    }

    if (actionId === 'checkin') {
      handleQuickCheckInAppointment(appointment)
      return
    }

    if (actionId === 'rebook') {
      onBookAppointment?.()
      onNavigate?.('book-appointment')
      return
    }

    const navigationMap = {
      directions: 'checkin-queue',
      feedback: 'support',
      invoice: 'billing-receipts',
      pay: 'billing',
      prescription: 'medications',
      queue: 'checkin-queue',
      results: 'lab-results',
      support: 'support',
      visit: 'history',
    }

    if (actionId === 'feedback' || actionId === 'support') {
      onOpenSupportChat?.()
    }

    const targetSection = navigationMap[actionId]
    if (targetSection) {
      onNavigate?.(targetSection)
    }
  }

  const handleCancelAppointment = async () => {
    if (!detailCanCancel || appointmentActionLoading) {
      return
    }

    const confirmed = window.confirm('Bạn chắc chắn muốn hủy lịch hẹn này?')
    if (!confirmed) {
      return
    }

    const reasonText = cancelReason.trim() || 'Bệnh nhân hủy từ cổng bệnh nhân'
    setAppointmentActionLoading('cancel')
    setAppointmentActionFeedback(null)

    try {
      const response = await appointmentAPI.cancelMyAppointment(detailAppointmentId, {
        reason: reasonText,
        cancel_reason: reasonText,
      })
      await applyAppointmentActionResult(response, 'Đã hủy lịch hẹn thành công.')
    } catch (error) {
      setAppointmentActionFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Không thể hủy lịch hẹn.'),
      })
    } finally {
      setAppointmentActionLoading('')
    }
  }

  const handleRescheduleAppointment = async () => {
    if (!detailCanReschedule || appointmentActionLoading) {
      return
    }

    if (!rescheduleScheduleOption || !rescheduleSlotValue) {
      setAppointmentActionFeedback({
        type: 'error',
        message: 'Vui lòng chọn ngày và khung giờ còn trống để đổi lịch.',
      })
      return
    }

    const schedule = rescheduleScheduleOption.schedule || {}
    const reasonText = rescheduleReason.trim() || 'Bệnh nhân đổi lịch từ cổng bệnh nhân'
    const payload = {
      doctor_id: schedule.doctor_id,
      department_id: schedule.department_id,
      doctor_schedule_id: schedule.doctor_schedule_id,
      appointment_time: rescheduleSlotValue,
      appointment_type: detailAppointmentRecord?.appointment_type,
      reschedule_reason: reasonText,
    }

    if (rescheduleSelectedSlot?.schedule_slot_id) {
      payload.schedule_slot_id = rescheduleSelectedSlot.schedule_slot_id
    }

    setAppointmentActionLoading('reschedule')
    setAppointmentActionFeedback(null)

    try {
      const response = await appointmentAPI.rescheduleMyAppointment(detailAppointmentId, payload)
      await applyAppointmentActionResult(response, 'Đã đổi lịch hẹn thành công.')
    } catch (error) {
      setAppointmentActionFeedback({
        type: 'error',
        message: getApiErrorMessage(error, 'Không thể đổi lịch hẹn.'),
      })
    } finally {
      setAppointmentActionLoading('')
    }
  }

  const handleConfirmBooking = async () => {
    if (bookingLoading) {
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
        notes: bookingForRelative
          ? `Đặt qua portal cho người thân được ủy quyền: ${bookingPatientDisplayName}`
          : undefined,
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

  const appointmentDetailOverlay = selectedAppointment ? (
    <div
      className="patient-appointment-detail-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleCloseAppointmentDetail()
        }
      }}
    >
      <section
        className="patient-appointment-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-appointment-detail-title"
      >
        <header className="patient-appointment-detail-header">
          <div>
            <p className="patient-section-label">Chi tiết lịch hẹn</p>
            <h2 id="patient-appointment-detail-title">
              {detailAppointmentRow?.title || 'Lịch hẹn khám'}
            </h2>
          </div>
          <div className="patient-appointment-detail-header-actions">
            <span className={`patient-status-pill ${detailAppointmentRow?.tone || 'soft'}`}>
              {detailAppointmentRow?.status || 'Chưa xác định'}
            </span>
            <button
              className="patient-appointment-detail-close"
              type="button"
              aria-label="Đóng chi tiết lịch hẹn"
              onClick={handleCloseAppointmentDetail}
            >
              <PatientIcon name="close" aria-hidden="true" />
            </button>
          </div>
        </header>

        {detailLoading ? (
          <div className="patient-appointment-detail-state">Đang tải chi tiết từ backend...</div>
        ) : null}

        {detailError ? (
          <div className="patient-dashboard-state patient-dashboard-state-error">{detailError}</div>
        ) : null}

        <div className="patient-appointment-detail-body">
          <section className="patient-appointment-detail-summary">
            <div className="patient-appointment-detail-date">
              <span>{detailAppointmentRow?.dateParts?.weekday || '--'}</span>
              <strong>{detailAppointmentRow?.dateParts?.day || '--'}</strong>
              <em>{detailAppointmentRow?.dateParts?.month || 'Tháng --'}</em>
            </div>
            <div>
              <h3>{detailAppointmentRow?.doctor || 'Bác sĩ phụ trách'}</h3>
              <p>{detailAppointmentRow?.specialty || detailAppointmentRow?.location || 'Chuyên khoa đang cập nhật'}</p>
              <span>{formatAppointmentDateTime(detailAppointmentRecord?.appointment_time || detailAppointmentRow?.appointmentTime)}</span>
            </div>
          </section>

          <div className="patient-appointment-detail-grid">
            <div>
              <span>Mã lịch</span>
              <strong>{detailAppointmentId || 'Chưa có mã'}</strong>
            </div>
            <div>
              <span>Cơ sở</span>
              <strong>{detailAppointmentRow?.facility || 'Bệnh viện Đa khoa Bộ Y tế'}</strong>
            </div>
            <div>
              <span>Địa điểm</span>
              <strong>{detailAppointmentRow?.location || 'Đang cập nhật'}</strong>
            </div>
            <div>
              <span>Lý do khám</span>
              <strong>{detailAppointmentRecord?.reason || 'Chưa có ghi chú'}</strong>
            </div>
          </div>

          <section className="patient-appointment-queue-card">
            <div className="patient-appointment-queue-head">
              <span className="patient-appointment-queue-icon">
                <PatientIcon
                  name={detailHasQueueInfo ? 'receipt_long' : detailIsConfirmedOnly ? 'verified' : 'schedule'}
                  aria-hidden="true"
                />
              </span>
              <div>
                <h3>
                  {detailHasQueueInfo
                    ? 'Check-in / hàng đợi'
                    : detailIsConfirmedOnly
                      ? 'Lịch đã xác nhận'
                      : detailIsPendingOnly
                        ? 'Đang chờ xác nhận'
                        : 'Thông tin tiếp nhận'}
                </h3>
                <p>
                  {detailHasQueueInfo
                    ? 'Backend đã ghi nhận thông tin tiếp nhận cho lịch hẹn này.'
                    : detailIsConfirmedOnly
                      ? 'Lịch hẹn đã được xác nhận, chưa phát sinh thông tin check-in hoặc số hàng đợi.'
                      : detailIsPendingOnly
                        ? 'Lịch hẹn đang chờ bệnh viện xác nhận, chưa có thông tin check-in hoặc hàng đợi.'
                        : 'Chưa có thông tin tiếp nhận từ backend cho lịch hẹn này.'}
                </p>
              </div>
            </div>

            {detailQueueTicket ? (
              <div className="patient-appointment-queue-grid">
                <div>
                  <span>Số thứ tự</span>
                  <strong>{detailQueueTicket.queue_number || '--'}</strong>
                </div>
                <div>
                  <span>Trạng thái</span>
                  <strong>{detailQueueStatus.label}</strong>
                </div>
                <div>
                  <span>Giờ check-in</span>
                  <strong>{formatAppointmentDateTime(detailQueueTicket.checkin_time)}</strong>
                </div>
              </div>
            ) : (
              <div className="patient-appointment-queue-empty">
                {detailCheckedInAt
                  ? `Đã check-in lúc ${formatAppointmentDateTime(detailCheckedInAt)}.`
                  : detailIsConfirmedOnly
                    ? 'Vui lòng đến trước giờ hẹn 15 phút để làm thủ tục check-in tại quầy.'
                    : detailIsPendingOnly
                      ? 'Khi lịch được xác nhận, bạn sẽ thấy trạng thái mới trong danh sách lịch hẹn.'
                      : 'Thông tin check-in và số hàng đợi sẽ chỉ hiển thị sau khi quầy tiếp nhận cập nhật.'}
              </div>
            )}
          </section>

          {appointmentActionFeedback ? (
            <div
              className={`patient-dashboard-state${
                appointmentActionFeedback.type === 'error'
                  ? ' patient-dashboard-state-error'
                  : ' patient-appointment-action-success'
              }`}
            >
              {appointmentActionFeedback.message}
            </div>
          ) : null}

          <section className="patient-appointment-actions-grid">
            <div className="patient-appointment-action-box">
              <div className="patient-appointment-action-box-head">
                <PatientIcon name="close" aria-hidden="true" />
                <div>
                  <h3>Hủy lịch</h3>
                  <p>Áp dụng khi lịch hẹn chưa kết thúc và backend cho phép hủy.</p>
                </div>
              </div>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Lý do hủy lịch"
                disabled={!detailCanCancel || appointmentActionLoading === 'cancel'}
              />
              <button
                className="patient-danger-button"
                type="button"
                onClick={handleCancelAppointment}
                disabled={!detailCanCancel || appointmentActionLoading === 'cancel'}
              >
                {appointmentActionLoading === 'cancel' ? 'Đang hủy...' : 'Hủy lịch'}
              </button>
              {!detailCanCancel ? (
                <p className="patient-appointment-action-hint">Lịch hẹn hiện không còn ở trạng thái được hủy.</p>
              ) : null}
            </div>

            <div className="patient-appointment-action-box">
              <div className="patient-appointment-action-box-head">
                <PatientIcon name="calendar_add_on" aria-hidden="true" />
                <div>
                  <h3>Đổi lịch</h3>
                  <p>Chọn lịch trống cùng bác sĩ/khoa theo dữ liệu backend.</p>
                </div>
              </div>

              {detailCanReschedule && rescheduleScheduleOptions.length > 0 ? (
                <>
                  <label className="patient-appointment-field">
                    <span>Ngày khám mới</span>
                    <select
                      value={rescheduleScheduleId}
                      onChange={(event) => setRescheduleScheduleId(event.target.value)}
                      disabled={appointmentActionLoading === 'reschedule'}
                    >
                      {rescheduleScheduleOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {formatAppointmentDate(option.schedule?.work_date || option.schedule?.shift_start)}
                          {String(option.id) === detailCurrentScheduleId ? ' - lịch hiện tại' : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  {rescheduleSlotsLoading ? (
                    <div className="patient-appointment-detail-state">Đang tải khung giờ trống...</div>
                  ) : null}

                  {rescheduleSlotsError ? (
                    <div className="patient-dashboard-state patient-dashboard-state-error">{rescheduleSlotsError}</div>
                  ) : null}

                  {!rescheduleSlotsLoading && rescheduleSlots.length > 0 ? (
                    <div className="patient-appointment-reschedule-slots">
                      {rescheduleSlots.map((slot) => (
                        <button
                          key={slot.slot_time}
                          className={`patient-appointment-slot-chip${
                            rescheduleSlotValue === slot.slot_time ? ' is-selected' : ''
                          }`}
                          type="button"
                          onClick={() => setRescheduleSlotValue(slot.slot_time)}
                          disabled={appointmentActionLoading === 'reschedule'}
                        >
                          {formatAppointmentTime(slot.slot_time)}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {!rescheduleSlotsLoading && rescheduleSlots.length === 0 ? (
                    <div className="patient-empty-state">Chưa có khung giờ trống cho ngày này.</div>
                  ) : null}

                  <textarea
                    value={rescheduleReason}
                    onChange={(event) => setRescheduleReason(event.target.value)}
                    placeholder="Lý do đổi lịch"
                    disabled={appointmentActionLoading === 'reschedule'}
                  />

                  <button
                    className="patient-hero-button"
                    type="button"
                    onClick={handleRescheduleAppointment}
                    disabled={!rescheduleSlotValue || appointmentActionLoading === 'reschedule'}
                  >
                    {appointmentActionLoading === 'reschedule' ? 'Đang đổi lịch...' : 'Đổi lịch'}
                  </button>
                </>
              ) : (
                <p className="patient-appointment-action-hint">
                  {detailCanReschedule
                    ? 'Backend chưa có lịch trống phù hợp để đổi.'
                    : 'Lịch hẹn hiện không còn ở trạng thái được đổi.'}
                </p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  ) : null

  const bookingWizardSteps = hasAuthorizedRelativeBooking
    ? [
        'Chọn bệnh nhân',
        'Chọn chuyên khoa',
        'Chọn bác sĩ',
        'Chọn ngày giờ',
        'Nhập lý do khám',
        'Xác nhận thông tin',
        'Thanh toán trước nếu cần',
        'Nhận mã lịch hẹn',
      ]
    : [
        'Chọn chuyên khoa',
        'Chọn bác sĩ',
        'Chọn ngày giờ',
        'Nhập lý do khám',
        'Xác nhận thông tin',
        'Thanh toán trước nếu cần',
        'Nhận mã lịch hẹn',
      ]
  const activeWizardStep = hasAuthorizedRelativeBooking
    ? step === 1 ? 1 : step === 2 ? (reason.trim() ? 6 : 4) : 8
    : step === 1 ? 1 : step === 2 ? (reason.trim() ? 5 : 3) : 7
  const specialtyStepNumber = hasAuthorizedRelativeBooking ? 2 : 1
  const dateTimeStepNumber = hasAuthorizedRelativeBooking ? 4 : 3
  const reasonStepNumber = hasAuthorizedRelativeBooking ? 5 : 4

  /* ---- PROGRESS BAR ---- */
  const ProgressBar = () => (
    <div className="patient-panel patient-booking-progress patient-booking-progress--wizard">
      <div className="patient-progress-steps patient-progress-steps--wizard">
        {bookingWizardSteps.map((label, index) => {
          const number = index + 1
          const isDone = activeWizardStep > number
          const isActive = activeWizardStep >= number

          return (
            <div className={`patient-progress-step ${isActive ? 'is-active' : ''}`} key={label}>
              {isDone ? <PatientIcon name="check" aria-hidden="true" /> : <span>{number}</span>}
              <strong>{label}</strong>
            </div>
          )
        })}
      </div>
      <div className="patient-progress-state">
        <PatientIcon name="check_circle" aria-hidden="true" />
        <span>Đặt lịch khám</span>
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
              {hasAuthorizedRelativeBooking ? (
              <div className="patient-booking-patient-step">
                <div>
                  <span className="patient-step-number">1</span>
                  <div>
                    <p className="patient-section-label">Bước 1</p>
                    <h2>Chọn bệnh nhân</h2>
                  </div>
                </div>
                <div className="patient-booking-for-switch" role="group" aria-label="Chọn người được đặt lịch">
                  <button
                    className={bookingFor === 'self' ? 'is-selected' : ''}
                    type="button"
                    onClick={() => setBookingFor('self')}
                  >
                    <PatientIcon name="person" aria-hidden="true" />
                    Đặt cho tôi
                  </button>
                  <button
                    className={bookingFor === 'authorized_relative' ? 'is-selected' : ''}
                    type="button"
                    onClick={() => setBookingFor('authorized_relative')}
                    disabled={authorizedRelativeOptions.length === 0}
                  >
                    <PatientIcon name="shield_plus" aria-hidden="true" />
                    Đặt cho người thân được ủy quyền
                  </button>
                </div>
                <div className="patient-booking-patient-summary">
                  <div>
                    <span>Người được đặt lịch</span>
                    <strong>{bookingPatientDisplayName}</strong>
                    <small>{bookingPatientRelation}</small>
                  </div>
                  {bookingFor === 'authorized_relative' ? (
                    authorizedRelativeOptions.length ? (
                      <label>
                        <span>Hồ sơ ủy quyền</span>
                        <select
                          value={selectedRelative?.id || ''}
                          onChange={(event) => setSelectedRelativeId(event.target.value)}
                          aria-label="Chọn người thân được ủy quyền"
                        >
                          {authorizedRelativeOptions.map((relative) => (
                            <option key={relative.id} value={relative.id}>
                              {relative.fullName} - {relative.relationship}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p>Chưa có người thân được ủy quyền đặt lịch.</p>
                    )
                  ) : null}
                </div>
              </div>
              ) : null}

              <div className="patient-doctor-toolbar">
                <div>
                  <span className="patient-step-number">{specialtyStepNumber}</span>
                  <h2>Chọn chuyên khoa và bác sĩ</h2>
                </div>
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
              <div className="patient-specialty-selector" aria-label="Chọn chuyên khoa khám">
                <div className="patient-specialty-selector-head">
                  <div className="patient-specialty-current">
                    <span className="patient-specialty-current-icon">
                      <PatientIcon name={selectedSpecialtyMeta.iconName} aria-hidden="true" />
                    </span>
                    <div>
                      <span>Đang chọn khoa</span>
                      <strong>{selectedSpecialtyMeta.label}</strong>
                      <small>
                        {selectedSpecialtyMeta.doctorCount
                          ? `${selectedSpecialtyMeta.doctorCount} bác sĩ phù hợp`
                          : 'Chưa có bác sĩ khả dụng'}
                      </small>
                    </div>
                  </div>
                  <span className="patient-specialty-count">
                    {specialtyOptions.length} lựa chọn
                  </span>
                </div>
                <div className="patient-specialty-filter" aria-label="Danh sách chuyên khoa">
                  {specialtyOptions.map((specialty) => {
                    const active = selectedSpecialty === specialty.value
                    const doctorCount =
                      specialty.value === 'all'
                        ? doctorOptions.length
                        : specialtyDoctorCounts.get(specialty.value) || 0

                    return (
                      <button
                        key={specialty.value}
                        className={`patient-specialty-chip${active ? ' is-active' : ''}${
                          specialty.hasDoctor === false ? ' is-disabled' : ''
                        }`}
                        type="button"
                        disabled={specialty.hasDoctor === false}
                        aria-pressed={active}
                        title={specialty.label}
                        onClick={() => setSelectedSpecialty(specialty.value)}
                      >
                        <span className="patient-specialty-chip-icon">
                          <PatientIcon name={getSpecialtyIconName(specialty.label)} aria-hidden="true" />
                        </span>
                        <span className="patient-specialty-chip-copy">
                          <strong>{specialty.label}</strong>
                          <small>
                            {doctorCount
                              ? `${doctorCount} bác sĩ`
                              : specialty.hasDoctor === false ? 'Chưa có lịch' : 'Đang cập nhật'}
                          </small>
                        </span>
                        {active ? (
                          <PatientIcon name="check_circle" className="patient-specialty-chip-check" aria-hidden="true" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="patient-doctor-grid">
                {filteredDoctorOptions.map((doctor) => {
                  const active = doctor.id === selectedDoctorId
                  const canOpenSchedule = doctor.hasApiSchedule
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
                          setSelectedScheduleId(
                            doctor.hasApiSchedule
                              ? doctor.scheduleId || doctor.schedule?.doctor_schedule_id || null
                              : null,
                          )
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
                          setSelectedScheduleId(doctor.scheduleId || doctor.schedule?.doctor_schedule_id || null)
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
                <p className="patient-section-label">Tóm tắt lịch đang chọn</p>
                <h2>Tóm tắt lựa chọn</h2>
              </div>

              <div className="patient-selected-patient-card">
                <PatientIcon name={bookingForRelative ? 'shield_plus' : 'person'} aria-hidden="true" />
                <div>
                  <span>Bệnh nhân</span>
                  <strong>{bookingPatientDisplayName}</strong>
                  <small>{bookingPatientRelation}</small>
                </div>
              </div>

              {selectedDoctor ? (
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
                      <span>Lịch từ hệ thống</span>
                    </div>
                    {selectedDoctor.doctorCode ? (
                      <p className="patient-selected-doctor-code">
                        Mã bác sĩ: {selectedDoctor.doctorCode}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="patient-empty-state">Chưa có lịch khám công khai từ hệ thống.</div>
              )}

              <HealthcareChatAssistCard
                compact
                context="booking"
                title="Chatbot hỗ trợ đặt lịch"
                description="Có thể đặt theo chuyên khoa, bác sĩ, triệu chứng, dịch vụ hoặc ngày giờ mong muốn."
                prompts={['Chuyên khoa', 'Bác sĩ', 'Triệu chứng', 'Dịch vụ', 'Ngày giờ']}
              />

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
                  <span>Thời gian khám ≈ 45 phút</span>
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
          <div className="patient-appointments-hero patient-appointments-workspace-hero">
            <div>
              <p className="patient-section-label">Chăm sóc</p>
              <h1>Lịch hẹn của tôi</h1>
              <p>Quản lý lịch khám, dời lịch, hủy lịch và theo dõi trạng thái xác nhận.</p>
            </div>
            <div className="patient-appointment-workspace-actions">
              <button
                className="patient-hero-button"
                type="button"
                onClick={() => {
                  onBookAppointment?.()
                  onNavigate?.('book-appointment')
                }}
              >
                <PatientIcon name="calendar_add_on" aria-hidden="true" />
                Đặt lịch mới
              </button>
              <button
                className="patient-soft-button"
                type="button"
                onClick={() => handleAppointmentTabChange('completed')}
              >
                <PatientIcon name="history_edu" aria-hidden="true" />
                Lịch sử lịch hẹn
              </button>
              <button
                className="patient-soft-button"
                type="button"
                onClick={() => handleAppointmentTabChange('pending')}
              >
                <PatientIcon name="schedule" aria-hidden="true" />
                Danh sách chờ
                {waitlistItems.length > 0 ? <b>{waitlistItems.length}</b> : null}
              </button>
            </div>
          </div>

          <div className="patient-appointments-summary-grid" aria-label="Tổng quan lịch hẹn">
            {appointmentSummaryCards.map((card) => {
              const active =
                card.filter?.tab === appointmentTab &&
                card.filter?.status === appointmentStatusFilter &&
                !appointmentFiltersActive

              return (
                <button
                  key={card.id}
                  className={`patient-appointments-summary-card ${card.tone}${active ? ' is-active' : ''}`}
                  type="button"
                  aria-label={card.ariaLabel}
                  aria-pressed={active}
                  onClick={() => handleAppointmentSummaryCardClick(card)}
                >
                  <span className="patient-appointments-summary-icon" aria-hidden="true">
                    <PatientIcon name={card.icon} />
                  </span>
                  <div>
                    <strong>{card.label}</strong>
                    <span>
                      <b>{card.count}</b>
                      {card.unit}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="patient-appointments-tabs" role="tablist" aria-label="Lọc lịch hẹn theo trạng thái">
            {appointmentTabOptions.map((tab) => {
              const active = tab.key === appointmentTab

              return (
                <button
                  key={tab.key}
                  className={`patient-appointments-tab${active ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleAppointmentTabChange(tab.key)}
                >
                  <PatientIcon name={tab.icon} aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="patient-appointments-filter-bar" aria-label="Bộ lọc lịch hẹn">
            <label className="patient-appointment-filter-field patient-appointment-filter-field-wide">
              <span>Từ khóa</span>
              <div className="patient-appointment-search-shell">
                <PatientIcon name="search" aria-hidden="true" />
                <input
                  value={appointmentSearchTerm}
                  onChange={(event) => setAppointmentSearchTerm(event.target.value)}
                  placeholder="Mã lịch, bác sĩ, chuyên khoa, lý do khám..."
                />
              </div>
            </label>
            <label className="patient-appointment-filter-field">
              <span>Thời gian</span>
              <select value={appointmentDateFilter} onChange={(event) => setAppointmentDateFilter(event.target.value)}>
                {appointmentDateFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="patient-appointment-filter-field">
              <span>Chuyên khoa</span>
              <select
                value={appointmentSpecialtyFilter}
                onChange={(event) => setAppointmentSpecialtyFilter(event.target.value)}
              >
                {appointmentSpecialtyOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="patient-appointment-filter-field">
              <span>Bác sĩ</span>
              <select value={appointmentDoctorFilter} onChange={(event) => setAppointmentDoctorFilter(event.target.value)}>
                {appointmentDoctorOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="patient-appointment-filter-field">
              <span>Trạng thái</span>
              <select value={appointmentStatusFilter} onChange={(event) => setAppointmentStatusFilter(event.target.value)}>
                {appointmentStatusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="patient-appointment-filter-field">
              <span>Thanh toán</span>
              <select value={appointmentPaymentFilter} onChange={(event) => setAppointmentPaymentFilter(event.target.value)}>
                {appointmentPaymentFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button className="patient-soft-button patient-appointment-filter-reset" type="button" onClick={handleResetAppointmentFilters}>
              <PatientIcon name="filter_list" aria-hidden="true" />
              Xóa lọc
            </button>
          </div>

          {appointmentActionFeedback ? (
            <div
              className={`patient-dashboard-state${
                appointmentActionFeedback.type === 'error'
                  ? ' patient-dashboard-state-error'
                  : ' patient-appointment-action-success'
              }`}
            >
              {appointmentActionFeedback.message}
            </div>
          ) : null}

          {waitlistItems.length > 0 || waitlistLoading || waitlistError ? (
            <section className="patient-appointment-waitlist-panel" aria-label="Danh sách chờ">
              <div className="patient-appointment-waitlist-head">
                <div>
                  <h3>Danh sách chờ</h3>
                  <p>Theo dõi các yêu cầu chờ slot trống từ backend.</p>
                </div>
                <span>{waitlistLoading ? 'Đang tải...' : `${waitlistItems.length} yêu cầu`}</span>
              </div>
              {waitlistError ? (
                <div className="patient-dashboard-state patient-dashboard-state-error">{waitlistError}</div>
              ) : null}
              {!waitlistLoading && waitlistItems.length > 0 ? (
                <div className="patient-appointment-waitlist-list">
                  {waitlistItems.slice(0, 3).map((item) => (
                    <div key={item.waitlist_id || item.appointment_waitlist_id || item.id} className="patient-appointment-waitlist-item">
                      <strong>
                        {translateMedicalLabel(item.department_name || item.specialty || item.appointment_type) || 'Chuyên khoa đang cập nhật'}
                      </strong>
                      <span>
                        {item.doctor_name || 'Bác sĩ bất kỳ'} · {formatAppointmentDate(item.preferred_date || item.created_at)}
                      </span>
                      <em>{getAppointmentStatusMeta(item.status || 'booked').label}</em>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="patient-appointments-stack">
            <div className="patient-appointments-group">
              <div className="patient-appointments-section-head">
                <div className="patient-appointments-section-title">
                  <span className="patient-appointments-section-icon">
                    <PatientIcon name={activeAppointmentTab.icon} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{activeAppointmentTab.label}</h3>
                    <p>
                      {filteredAppointmentCount} lịch hẹn phù hợp
                      {appointmentFiltersActive ? ' sau khi áp dụng bộ lọc' : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="patient-appointments-history-shell">
                {loading ? (
                  <div className="patient-empty-state">Đang tải lịch hẹn từ backend...</div>
                ) : null}

                {!loading && filteredAppointmentRows.length === 0 ? (
                  <div className="patient-empty-state">{activeAppointmentTab.empty}</div>
                ) : null}

                {!loading && filteredAppointmentRows.length > 0 ? (
                  <div className="patient-appointment-list">
                    {filteredAppointmentRows.map((appointment) => {
                      const openAppointmentDetail = () => handleOpenAppointmentDetail(appointment)
                      const actionItems = getAppointmentActionItems(appointment)

                      return (
                        <article
                          key={appointment.id}
                          className="patient-appointment-card patient-appointment-rich-card"
                          role="button"
                          tabIndex={0}
                          onClick={openAppointmentDetail}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              openAppointmentDetail()
                            }
                          }}
                          aria-label={`Xem chi tiết lịch hẹn ${appointment.title}`}
                        >
                          <div className="patient-appointment-date">
                            <span>{appointment.dateParts.weekday}</span>
                            <strong>{appointment.dateParts.day}</strong>
                            <em>{appointment.dateParts.month}</em>
                            <small>{appointment.dateParts.year}</small>
                          </div>

                          <div className="patient-appointment-doctor-avatar">
                            <img src={appointment.doctorAvatar} alt={appointment.doctor} loading="lazy" />
                            <span aria-hidden="true" />
                          </div>

                          <div className="patient-appointment-body">
                            <div className="patient-appointment-title-row">
                              <div>
                                <span className="patient-appointment-code">Mã lịch hẹn: {appointment.appointmentCode}</span>
                                <h4>{appointment.title}</h4>
                                <div className="patient-appointment-doctor-line">
                                  <p>{appointment.doctor}</p>
                                  {appointment.specialty ? (
                                    <span className="patient-appointment-specialty-pill">{appointment.specialty}</span>
                                  ) : null}
                                </div>
                                <span>{appointment.facility}</span>
                              </div>
                            </div>

                            <div className="patient-appointment-info-grid">
                              <div>
                                <span>Ngày giờ khám</span>
                                <strong>{appointment.time} · {appointment.shortDate || appointment.date}</strong>
                              </div>
                              <div>
                                <span>Phòng khám</span>
                                <strong>{appointment.location}</strong>
                              </div>
                              <div>
                                <span>Lý do khám</span>
                                <strong>{appointment.reason}</strong>
                              </div>
                              <div>
                                <span>Thời gian còn lại</span>
                                <strong>{appointment.remainingText}</strong>
                              </div>
                            </div>

                            <div className="patient-appointment-status-row">
                              <span className={`patient-status-pill ${appointment.tone}`}>
                                <PatientIcon name="calendar_today" aria-hidden="true" />
                                {appointment.status}
                              </span>
                              <span className={`patient-status-pill ${appointment.paymentTone}`}>
                                <PatientIcon name="payments" aria-hidden="true" />
                                {appointment.paymentStatusLabel}
                              </span>
                              <span className={`patient-status-pill ${appointment.checkinTone}`}>
                                <PatientIcon name="check_circle" aria-hidden="true" />
                                {appointment.checkinStatusLabel}
                              </span>
                            </div>

                            <div className="patient-appointment-prep-note">
                              <PatientIcon name="info" aria-hidden="true" />
                              <span>{appointment.preparationNote}</span>
                            </div>
                          </div>

                          <div className="patient-appointment-aside patient-appointment-action-column">
                            {appointment.queueTicketNo ? (
                              <span className="patient-appointment-queue-chip">Số {appointment.queueTicketNo}</span>
                            ) : null}
                            <div className="patient-appointment-card-actions">
                              {actionItems.map((action) => {
                                const busy =
                                  appointmentActionLoading === `${action.id}:${appointment.id}` ||
                                  (action.id === 'cancel' && appointmentActionLoading === `cancel:${appointment.id}`) ||
                                  (action.id === 'checkin' && appointmentActionLoading === `checkin:${appointment.id}`)

                                return (
                                  <button
                                    key={action.id}
                                    className={`patient-appointment-card-action is-${action.tone}`}
                                    type="button"
                                    disabled={action.disabled || busy}
                                    onClick={(event) => handleAppointmentCardAction(event, appointment, action.id)}
                                  >
                                    <PatientIcon name={action.icon} aria-hidden="true" />
                                    <span>{busy ? 'Đang xử lý...' : action.label}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>

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
        {appointmentDetailOverlay}
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
                    {selectedLocationName}
                  </span>
                </div>
              </div>
            </div>
            <div className="patient-step2-support-box">
              <p>Bảo hiểm</p>
              <div>
                <span>Xác minh tại quầy</span>
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
            <div className="patient-panel patient-booking-left-summary" aria-label="Thông tin chọn lịch">
              <div>
                <span>Chuyên khoa</span>
                <strong>{selectedDoctor.specialty}</strong>
              </div>
              <div>
                <span>Bác sĩ</span>
                <strong>{selectedDoctor.displayName || selectedDoctor.name}</strong>
              </div>
              <div>
                <span>Ngày khám</span>
                <strong>{selectedDateLabel}</strong>
              </div>
              <div>
                <span>Slot còn trống</span>
                <strong>{timeSlots.filter((slot) => !slot.disabled).length}</strong>
              </div>
            </div>

            {/* Calendar */}
            <div className="patient-panel patient-calendar-panel-inner">
              <div className="patient-panel-head patient-panel-head-mb">
                <div>
                  <span className="patient-step-number">{dateTimeStepNumber}</span>
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

                          setSelectedScheduleId(day.item.value)
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
                        setSelectedScheduleId(day.value)
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
                  <span className="patient-step-number">{dateTimeStepNumber}</span>
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
                <h3 className="patient-sidebar-title">Tóm tắt lịch đang chọn</h3>
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
                  <strong>{bookingPatientDisplayName}</strong>
                </div>
                <div>
                  <PatientIcon name="phone" aria-hidden="true" />
                  <span>Số điện thoại</span>
                  <strong>{bookingPatientPhone || 'Chưa cập nhật'}</strong>
                </div>
                <div>
                  <PatientIcon name="shield_plus" aria-hidden="true" />
                  <span>Hình thức đặt</span>
                  <strong>{bookingForRelative ? 'Người thân được ủy quyền' : 'Đặt cho tôi'}</strong>
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
                    <p className="patient-sidebar-detail-main">{selectedLocationName}</p>
                    <p className="patient-sidebar-detail-sub">{selectedLocationNote}</p>
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
                <span>Bước {reasonStepNumber}: Nhập lý do khám</span>
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
                <h4 className="patient-sidebar-section-title">Phí dự kiến</h4>
                <div className="patient-fee-row">
                  <span className="patient-fee-label">Phí khám</span>
                  <strong className="patient-fee-value">{formatVnd(consultationFee, 'Chưa cập nhật')}</strong>
                </div>
                <div className="patient-fee-row">
                  <span className="patient-fee-label">Phí admin</span>
                  <strong className="patient-fee-value">{formatVnd(adminFee)}</strong>
                </div>
                <div className="patient-fee-row-last">
                  <strong className="patient-fee-total-label">Tổng cộng</strong>
                  <strong className="patient-fee-total-value">{formatVnd(totalEstimatedFee)}</strong>
                </div>
              </div>

              {/* Buttons */}
              <div className="patient-sidebar-actions">
                <h4 className="patient-sidebar-section-title">Nút xác nhận</h4>
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
                <h4>Điều kiện chuẩn bị</h4>
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
                  Chính sách dời/hủy: hủy hoặc đổi lịch trước ít nhất 4 giờ để tránh phí.
                </p>
              </div>

              <HealthcareChatAssistCard
                compact
                context="booking"
                title="Cần kiểm tra trước khi xác nhận?"
                description="Chatbot có thể nhắc giấy tờ, hướng dẫn thanh toán và chuyển nhân viên khi cần."
                prompts={['Giấy tờ cần mang', 'Phí khám', 'Thanh toán QR', 'Gặp nhân viên']}
              />
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
          <span className="patient-step3-progress-step">
            Bước {bookingWizardSteps.length.toString().padStart(2, '0')} / {bookingWizardSteps.length.toString().padStart(2, '0')}
          </span>
          <span className="patient-step3-progress-label">Nhận mã lịch hẹn</span>
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
                  <p className="patient-detail-doc-name">{bookingPatientDisplayName}</p>
                  <p className="patient-detail-doc-specialty">{bookingPatientPhone || 'Chưa cập nhật'}</p>
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
                  <p className="patient-detail-doc-specialty">Phí dự kiến: {formatVnd(totalEstimatedFee, 'Chưa cập nhật')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="patient-location-section">
            <p className="patient-detail-label">Địa điểm phòng khám</p>
            <div className="patient-location-row">
              <div>
                <p className="patient-location-name">{selectedLocationName}</p>
                <p className="patient-location-address">{selectedLocationNote}</p>
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
