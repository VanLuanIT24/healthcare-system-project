import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  appointmentCalendarDays,
  appointmentDoctors,
  appointmentHistory,
  appointmentTimeSlots,
} from '../data/patientPageData'
import '../styles/appointments.css'

const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

export default function PatientAppointmentsPage() {
  const defaultDoctor =
    appointmentDoctors.find((doctor) => doctor.id === 'doc-2')?.id || appointmentDoctors[0]?.id
  const defaultDate =
    appointmentCalendarDays.find((day) => day.selected)?.label || appointmentCalendarDays[0]?.label
  const defaultTime =
    appointmentTimeSlots.find((slot) => slot.selected)?.value || appointmentTimeSlots[0]?.value

  const [selectedDoctorId, setSelectedDoctorId] = useState(defaultDoctor)
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const [selectedTime, setSelectedTime] = useState(defaultTime)
  const [step, setStep] = useState(1)
  const [reason, setReason] = useState('')

  const goTo = (n) => {
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectedDoctor = appointmentDoctors.find((d) => d.id === selectedDoctorId) || appointmentDoctors[0]

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
              <h2>Chọn bác sĩ chuyên khoa</h2>
              <div className="patient-doctor-grid">
                {appointmentDoctors.map((doctor) => {
                  const active = doctor.id === selectedDoctorId
                  return (
                    <button
                      key={doctor.id}
                      className={`patient-doctor-card${active ? ' is-selected' : ''}`}
                      type="button"
                      onClick={() => setSelectedDoctorId(doctor.id)}
                    >
                      <div className="patient-doctor-avatar">{doctor.initials}</div>
                      <div className="patient-doctor-content">
                        <div className="patient-doctor-head">
                          <h3>{doctor.name}</h3>
                          <span>{doctor.availability}</span>
                        </div>
                        <p>{doctor.specialty}</p>
                        <div className="patient-doctor-rating">
                          <PatientIcon name="star" aria-hidden="true" />
                          <strong>{doctor.rating} ({doctor.reviews})</strong>
                        </div>
                      </div>
                    </button>
                  )
                })}
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
                  {selectedDoctor.initials}
                </div>
                <div>
                  <p className="patient-selected-doctor-label">Bác sĩ phụ trách</p>
                  <p className="patient-selected-doctor-name">{selectedDoctor.name}</p>
                  <p className="patient-selected-doctor-specialty">{selectedDoctor.specialty}</p>
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
                style={{ marginTop: 'auto' }}
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
                {appointmentHistory.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
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
                    <td>{appointment.date}</td>
                    <td>{appointment.time}</td>
                    <td>
                      <span className={`patient-status-pill ${appointment.tone}`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="patient-history-actions">
                      <button type="button" aria-label="Tùy chọn khác">
                        <PatientIcon name="more_vert" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <h3 className="patient-step2-doctor-name">{selectedDoctor.name}</h3>
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
                {appointmentCalendarDays.map((day) => (
                  <button
                    key={day.label}
                    className={`patient-date-chip${selectedDate === day.label ? ' is-selected' : ''}${day.muted ? ' is-muted' : ''}`}
                    type="button"
                    disabled={day.muted}
                    onClick={() => setSelectedDate(day.label)}
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
                {appointmentTimeSlots.map((slot) => (
                  <button
                    key={slot.value}
                    className={`patient-time-chip${selectedTime === slot.value ? ' is-selected' : ''}`}
                    type="button"
                    onClick={() => setSelectedTime(slot.value)}
                  >
                    {slot.value}
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
                    <p className="patient-sidebar-detail-main">{selectedDate}</p>
                    <p className="patient-sidebar-detail-sub">{selectedTime}</p>
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
                  onClick={() => goTo(3)}
                >
                  Xác nhận &amp; Đặt lịch
                </button>
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
          ID: ETH-88291
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
                  <p className="patient-detail-doc-name">{selectedDoctor.name}</p>
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
                  <span>{selectedDate?.split(' ')[0] || '16'}</span>
                </div>
                <div>
                  <p className="patient-detail-time-main">{selectedTime}</p>
                  <p className="patient-detail-time-sub">{selectedDate}</p>
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
          <button className="patient-hero-button patient-action-btn-full" type="button">
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
