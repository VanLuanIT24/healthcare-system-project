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

function getAppointmentStatusMeta(status) {
  const map = {
    booked: { label: 'Đã đặt', tone: 'soft' },
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

  return {
    id: appointment.appointment_id || `${appointment.doctor_id}-${appointment.appointment_time}`,
    doctor: appointment.doctor_name || `Bác sĩ ${String(appointment.doctor_id || '').slice(-6)}`,
    specialty:
      translateMedicalLabel(appointment.department_name) ||
      translateMedicalLabel(appointment.appointment_type) ||
      `Khoa ${String(appointment.department_id || '').slice(-6)}`,
    date: formatAppointmentDate(appointment.appointment_time),
    time: formatAppointmentTime(appointment.appointment_time),
    status: status.label,
    tone: status.tone,
    icon: 'medical_services',
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
  const preferredOrder = [
    'Chấn thương chỉnh hình',
    'Tim mạch',
    'Thần kinh',
    'Nội tổng quát',
    'Nhi khoa',
  ]

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
  const ratingMeta = buildScheduleRating(schedule)

  return {
    id: schedule.doctor_schedule_id,
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

export default function PatientAppointmentsPage({
  appointments = [],
  departments = [],
  loading = false,
  onAppointmentCreated,
  schedules = [],
}) {
  const defaultDoctor =
    appointmentDoctors.find((doctor) => doctor.id === 'doc-2')?.id || appointmentDoctors[0]?.id
  const defaultDate =
    appointmentCalendarDays.find((day) => day.selected)?.label || appointmentCalendarDays[0]?.label
  const defaultTime =
    appointmentTimeSlots.find((slot) => slot.selected)?.value || appointmentTimeSlots[0]?.value

  const [selectedDoctorId, setSelectedDoctorId] = useState(defaultDoctor)
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const [selectedTime, setSelectedTime] = useState(defaultTime)
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [step, setStep] = useState(1)
  const [reason, setReason] = useState('')
  const [availableSlots, setAvailableSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [confirmedAppointment, setConfirmedAppointment] = useState(null)
  const appointmentRows = useMemo(
    () => appointments.map(mapApiAppointment),
    [appointments],
  )
  const scheduleOptions = useMemo(
    () => schedules.map((schedule) => mapScheduleOption(schedule, departments)),
    [departments, schedules],
  )
  const usingApiSchedules = scheduleOptions.length > 0
  const doctorOptions = usingApiSchedules ? scheduleOptions : appointmentDoctors
  const specialtyOptions = useMemo(() => {
    const specialties = Array.from(
      new Set(doctorOptions.map((doctor) => doctor.specialty).filter(Boolean)),
    )

    return [
      { value: 'all', label: 'Tất cả' },
      ...sortSpecialtyOptions(specialties).map((specialty) => ({ value: specialty, label: specialty })),
    ]
  }, [doctorOptions])
  const filteredDoctorOptions = useMemo(
    () => {
      const keyword = doctorSearch.trim().toLowerCase()
      const bySpecialty =
        selectedSpecialty === 'all'
          ? doctorOptions
          : doctorOptions.filter((doctor) => doctor.specialty === selectedSpecialty)

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
  const selectedSchedule = selectedDoctor?.schedule
  const calendarDays = usingApiSchedules
    ? scheduleOptions.map((option) => ({
        label: formatAppointmentDate(option.schedule.work_date),
        value: option.id,
        muted: false,
        selected: option.id === selectedDoctorId,
      }))
    : appointmentCalendarDays
  const timeSlots = usingApiSchedules
    ? availableSlots.map((slot) => ({
        value: slot.slot_time,
        label: formatAppointmentTime(slot.slot_time),
        disabled: !slot.is_available || slot.is_booked || slot.is_blocked,
      }))
    : appointmentTimeSlots.map((slot) => ({
        value: slot.value,
        label: slot.value,
        disabled: false,
      }))
  const canBookSelectedSlot =
    !usingApiSchedules || timeSlots.some((slot) => slot.value === selectedTime && !slot.disabled)
  const selectedDateLabel = usingApiSchedules
    ? formatAppointmentDate(selectedSchedule?.work_date)
    : selectedDate
  const selectedTimeLabel = usingApiSchedules ? formatAppointmentTime(selectedTime) : selectedTime
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
      return
    }

    if (!scheduleOptions.some((option) => option.id === selectedDoctorId)) {
      setSelectedDoctorId(scheduleOptions[0]?.id)
    }
  }, [scheduleOptions, selectedDoctorId, usingApiSchedules])

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
      setSelectedDoctorId(filteredDoctorOptions[0].id)
    }
  }, [filteredDoctorOptions, selectedDoctorId])

  useEffect(() => {
    let cancelled = false

    async function loadSlots() {
      if (!selectedSchedule?.doctor_schedule_id) {
        setAvailableSlots([])
        return
      }

      setSlotsLoading(true)
      setBookingError('')

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
        appointment_type: 'outpatient',
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
                    }`}
                    type="button"
                    onClick={() => setSelectedSpecialty(specialty.value)}
                  >
                    {specialty.label}
                  </button>
                ))}
              </div>
              <div className="patient-doctor-grid">
                {filteredDoctorOptions.map((doctor) => {
                  const active = doctor.id === selectedDoctorId
                  return (
                    <article
                      key={doctor.id}
                      className={`patient-doctor-card${active ? ' is-selected' : ''}`}
                    >
                      <button
                        className="patient-doctor-main"
                        type="button"
                        onClick={() => setSelectedDoctorId(doctor.id)}
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
                        onClick={() => {
                          setSelectedDoctorId(doctor.id)
                          goTo(2)
                        }}
                      >
                        <PatientIcon name="event" aria-hidden="true" />
                        <span>Xem lịch</span>
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
                  <span>Thời gian khám ≈ 45 phút</span>
                </div>
              </div>

              <button
                className="patient-hero-button patient-next-button patient-sidebar-btn-full"
                type="button"
                onClick={() => goTo(2)}
              >
                Tiếp theo — Chọn ngày giờ
              </button>
            </section>
          </div>
        </section>

        <section className="patient-appointments-history">
          <div className="patient-appointments-headline">
            <div>
              <h2>Danh sách lịch đã đặt</h2>
              <p>Xem và quản lý các cuộc hẹn sắp tới của bạn</p>
            </div>
            <button className="patient-inline-link patient-inline-link-icon" type="button">
              <span>Xem tất cả lịch sử</span>
              <PatientIcon name="arrow_forward" aria-hidden="true" />
            </button>
          </div>

          <div className="patient-panel patient-appointments-table-shell">
            {loading ? (
              <div className="patient-empty-state">Đang tải lịch hẹn từ backend...</div>
            ) : appointmentRows.length === 0 ? (
              <div className="patient-empty-state">ChÆ°a cÃ³ lá»‹ch háº¹n nÃ o tá»« backend.</div>
            ) : (
              <table className="patient-appointments-table">
                <thead>
                  <tr>
                    <th>Bác sĩ và chuyên khoa</th>
                    <th>Ngày khám</th>
                    <th>Giờ</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {appointmentRows.map((appointment) => (
                    <tr key={appointment.id}>
                      <td data-label="Bác sĩ và chuyên khoa">
                        <div className="patient-history-doctor">
                          <div className="patient-history-icon">
                            <PatientIcon name={appointment.icon} aria-hidden="true" />
                          </div>
                          <div>
                            <strong>{appointment.doctor}</strong>
                            <p>{appointment.specialty}</p>
                          </div>
                        </div>
                      </td>
                      <td data-label="Ngày khám">{appointment.date}</td>
                      <td data-label="Giờ">{appointment.time}</td>
                      <td data-label="Trạng thái">
                        <span className={`patient-status-pill ${appointment.tone}`}>
                          {appointment.status}
                        </span>
                      </td>
                      <td className="patient-history-actions" data-label="Hành động">
                        <button type="button" aria-label="Tùy chọn khác">
                          <PatientIcon name="more_vert" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
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
                {selectedDoctor.initials}
              </div>
              <div>
                <p className="patient-step2-doctor-badge">Bác sĩ đã chọn</p>
                <h3 className="patient-step2-doctor-name">
                  {selectedDoctor.displayName || selectedDoctor.name}
                </h3>
                <p className="patient-step2-doctor-specialty">{selectedDoctor.specialty}</p>
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
                <h2 className="patient-calendar-h2">Chọn ngày khám</h2>
                <div className="patient-calendar-actions">
                  <button type="button" aria-label="Tháng trước">
                    <PatientIcon name="chevron_left" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label="Tháng sau">
                    <PatientIcon name="chevron_right" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="patient-week-grid">
                {weekDays.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="patient-date-grid">
                {calendarDays.map((day) => (
                  <button
                    key={day.value || day.label}
                    className={`patient-date-chip${
                      usingApiSchedules
                        ? day.selected
                          ? ' is-selected'
                          : ''
                        : selectedDate === day.label
                          ? ' is-selected'
                          : ''
                    }${day.muted ? ' is-muted' : ''}`}
                    type="button"
                    disabled={day.muted}
                    onClick={() => {
                      if (usingApiSchedules) {
                        setSelectedDoctorId(day.value)
                        return
                      }

                      setSelectedDate(day.label)
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slots */}
            <div className="patient-panel patient-time-panel">
              <div className="patient-time-header">
                <PatientIcon name="schedule" aria-hidden="true" />
                <h3 className="patient-time-h3">Khung giờ khả dụng</h3>
              </div>
              <div className="patient-time-grid">
                {slotsLoading ? <div className="patient-empty-state">Đang tải khung giờ trống...</div> : null}
                {!slotsLoading && timeSlots.length === 0 ? (
                  <div className="patient-empty-state">Chưa có khung giờ trống cho lịch này.</div>
                ) : null}
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
              <p className="patient-time-note">
                <PatientIcon name="info" aria-hidden="true" />
                Giờ hiển thị theo múi giờ địa phương của bạn.
              </p>
            </div>
          </div>

          {/* Right: Sticky Booking Details Sidebar */}
          <div className="patient-step2-sidebar">
            <div className="patient-panel patient-sidebar-panel">
              <h3 className="patient-sidebar-title">Chi tiết đặt lịch</h3>

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
                    <p className="patient-sidebar-detail-main">Cơ sở y tế St. Jude</p>
                    <p className="patient-sidebar-detail-sub">Cách 0,8 dặm | Cấp cứu 24/7</p>
                  </div>
                </div>
              </div>

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

              {/* Privacy note */}
              <div className="patient-privacy-note">
                <PatientIcon name="verified_user" aria-hidden="true" />
                <p className="patient-privacy-text">
                  Dữ liệu của bạn được mã hóa và bảo mật theo <strong>Chính sách Bảo mật Y tế</strong>. Hủy lịch miễn phí trước 24 giờ.
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
        <div className="patient-success-icon">
          <PatientIcon name="check" aria-hidden="true" />
        </div>
        <h1 className="patient-success-title">Đặt lịch thành công!</h1>
        <p className="patient-success-subtitle">
          Lịch hẹn của bạn đã được xác nhận. Chúng tôi đã gửi chi tiết lịch hẹn vào email của bạn.
        </p>
        <span className="patient-booking-id">
          ID: {confirmedAppointment?.appointment?.appointment_id || 'ETH-88291'}
        </span>
      </div>

      {/* Bento grid */}
      <div className="patient-bento-grid">
        {/* Left: Appointment details */}
        <div className="patient-panel patient-details-card">
          <div className="patient-details-grid">
            {/* Doctor */}
            <div>
              <p className="patient-detail-label">Bác sĩ phụ trách</p>
              <div className="patient-detail-doc-row">
                <div className="patient-detail-doc-avatar">
                  {selectedDoctor.initials}
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
              <p className="patient-detail-label">Thời gian khám</p>
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
