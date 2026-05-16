import { Link } from 'react-router-dom'
import PatientIcon from '../components/PatientIcon'
import {
  appointmentDoctors as fallbackRecommendedDoctors,
  emergencyProfile,
  metrics as healthMetrics,
  notifications as fallbackNotifications,
} from '../data/patientPageData'
import { NEWS_ARTICLES } from '../../Home/pages/newsData'
import { formatDateTime } from '../utils/patientHelpers'

function getStatusMeta(status) {
  if (status === 'active') {
    return { label: 'Đang hoạt động', tone: 'good' }
  }

  if (status === 'locked') {
    return { label: 'Đang khóa', tone: 'rose' }
  }

  if (status === 'inactive') {
    return { label: 'Tạm ngưng', tone: 'soft' }
  }

  return { label: status || 'Chưa xác định', tone: 'soft' }
}

const dashboardNotificationVisuals = [
  { tone: 'danger', icon: 'calendar_today', actionLabel: '' },
  { tone: 'warning', icon: 'biotech', actionLabel: 'Xem ngay' },
  { tone: 'info', icon: 'medication', actionLabel: 'Xem chi tiết' },
  { tone: 'success', icon: 'campaign', actionLabel: 'Xem chi tiết' },
]

export default function PatientDashboardPage({
  accountError,
  appointments = [],
  encounters = [],
  loading,
  notifications = fallbackNotifications,
  onBookAppointment,
  onOpenHistory,
  onOpenNotifications,
  onOpenProfile,
  patientDataError,
  patientDataLoading,
  patientName,
  patientProfile,
  user,
}) {
  const latestLogin = user?.lastLoginAt
  const statusMeta = getStatusMeta(user?.status)
  const patient = patientProfile?.patient
  const latestRecords =
    encounters.length > 0
      ? encounters.slice(0, 4).map((encounter) => ({
          date: formatDateTime(encounter.start_time, { dateStyle: 'medium', timeStyle: 'short' }),
          test: encounter.chief_reason || `Lượt khám ${encounter.encounter_code || ''}`.trim(),
          doctor: encounter.attending_doctor_id
            ? `Mã bác sĩ ${String(encounter.attending_doctor_id).slice(-6)}`
            : 'Bác sĩ phụ trách',
          status:
            encounter.status === 'completed'
              ? 'Hoàn tất'
              : encounter.status === 'cancelled'
                ? 'Đã hủy'
                : 'Đang xử lý',
          ready: encounter.status === 'completed',
        }))
      : []
  const summaryMetrics = [
    {
      label: 'Mã bệnh nhân',
      value: patient?.patient_code || user?.patientCode || 'Chưa cấp mã',
      unit: '',
      state: 'Dữ liệu từ /auth/me',
      tone: 'soft',
      icon: 'badge',
      accent: 'blue',
      kicker: 'Hồ sơ định danh',
      valueClass: 'patient-metric-value-id',
    },
    {
      label: 'Trạng thái tài khoản',
      value: statusMeta.label,
      unit: '',
      state: 'Tài khoản hiện tại',
      tone: statusMeta.tone,
      icon: 'verified_user',
      accent: 'mint',
      kicker: 'Bảo mật tài khoản',
    },
    {
      label: healthMetrics[0]?.label || 'Huyết áp',
      value: healthMetrics[0]?.value || '120/80',
      unit: healthMetrics[0]?.unit || 'mmHg',
      state: 'Chỉ số gần nhất',
      tone: healthMetrics[0]?.tone || 'good',
      icon: 'water_drop',
      accent: 'sky',
      kicker: 'Theo dõi sinh hiệu',
    },
    {
      label: healthMetrics[1]?.label || 'Nhịp tim',
      value: healthMetrics[1]?.value || '72',
      unit: healthMetrics[1]?.unit || 'bpm',
      state: 'Theo dõi hôm nay',
      tone: healthMetrics[1]?.tone || 'good',
      icon: 'favorite',
      accent: 'rose',
      kicker: 'Theo dõi tim mạch',
    },
  ]
  const dashboardNotifications = (notifications.length > 0 ? notifications : fallbackNotifications).slice(0, 4)
  const recommendedDoctors = fallbackRecommendedDoctors.slice(1, 4)
  const healthNewsItems = NEWS_ARTICLES.slice(1, 3)

  return (
    <>
      {accountError ? (
        <div className="patient-dashboard-state patient-dashboard-state-error">{accountError}</div>
      ) : null}

      <div className="patient-dashboard-shell">
        <div className="patient-dashboard-main-column">
          <section className="patient-dashboard-media-panel" aria-label="Không gian chăm sóc sức khỏe">
            <video
              className="patient-dashboard-media-video"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260417_061226_74f0749c-a22d-42b3-895e-5d6203bc741c.mp4"
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="patient-dashboard-media-shade" />
            <div className="patient-dashboard-media-content">
              <p className="patient-eyebrow">Chào mừng bạn đến với hệ thống</p>
              <h1>Xin chào, {patientName}!</h1>
              <p>
                Theo dõi hồ sơ cá nhân, quản lý tài khoản và xem nhanh các cập nhật sức khỏe quan trọng.
              </p>
              <button
                className="patient-hero-button patient-dashboard-media-button"
                type="button"
                onClick={onBookAppointment}
              >
                <PatientIcon name="calendar_add_on" aria-hidden="true" />
                <span>Đặt lịch khám ngay</span>
              </button>
            </div>
          </section>

          <section className="patient-panel patient-panel-wide patient-account-summary-panel">
            <div className="patient-panel-head">
              <div>
                <p className="patient-section-label">Tổng quan tài khoản</p>
                <h2>Thông tin của bệnh nhân</h2>
              </div>

              <button className="patient-inline-link" type="button" onClick={onOpenProfile}>
                Chi tiết
              </button>
            </div>

            {loading ? (
              <div className="patient-dashboard-state">Đang đồng bộ dữ liệu tài khoản...</div>
            ) : (
              <div className="patient-metric-grid patient-metric-grid-account">
                {summaryMetrics.map((metric) => (
                  <article
                    key={metric.label}
                    className={`patient-metric-card patient-metric-card-${metric.accent}`}
                  >
                    <div className="patient-metric-card-head">
                      <div className="patient-metric-symbol">
                        <PatientIcon name={metric.icon} aria-hidden="true" />
                      </div>
                      <span className="patient-metric-kicker">{metric.kicker}</span>
                    </div>

                    <p className="patient-metric-card-label">{metric.label}</p>

                    <div
                      className={`patient-metric-value patient-metric-value-compact ${metric.valueClass || ''}`}
                    >
                      <strong>{metric.value}</strong>
                      {metric.unit ? <span>{metric.unit}</span> : null}
                    </div>

                    <span className={`patient-pill ${metric.tone}`}>{metric.state}</span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="patient-dashboard-side-cards">
            <section className="patient-panel patient-appointment-card patient-account-highlight">
              <p className="patient-section-label">Tài khoản hiện tại</p>
              <h2>Liên hệ chính</h2>

              <div className="patient-account-lines">
                <div className="patient-account-line">
                  <span>Email</span>
                  <strong>{patient?.email || user?.email || 'Chưa cập nhật'}</strong>
                </div>
                <div className="patient-account-line">
                  <span>Số điện thoại</span>
                  <strong>{patient?.phone || user?.phone || 'Chưa cập nhật'}</strong>
                </div>
                <div className="patient-account-line">
                  <span>Lần đăng nhập gần nhất</span>
                  <strong>{formatDateTime(latestLogin)}</strong>
                </div>
              </div>
            </section>

            <section className="patient-panel patient-blood-card patient-account-role-card">
              <div className="patient-blood-mark">
                <PatientIcon name="bloodtype" aria-hidden="true" />
              </div>
              <div>
                <h2>{patient?.blood_type || emergencyProfile?.bloodType || 'O+'}</h2>
                <p>Nhóm máu</p>
              </div>
            </section>
          </div>

          {patientDataError ? (
            <div className="patient-dashboard-state patient-dashboard-state-error">
              {patientDataError}
            </div>
          ) : null}
        </div>

        <div className="patient-dashboard-side-column patient-dashboard-right-rail">
          <aside className="patient-dashboard-mini-card patient-dashboard-notification-card">
            <div className="patient-dashboard-card-head">
              <h2>Thông báo</h2>
              <button className="patient-dashboard-card-link" type="button" onClick={onOpenNotifications}>
                Xem tất cả
              </button>
            </div>

            <div className="patient-dashboard-notice-list">
              {dashboardNotifications.map((item, index) => {
                const visual = dashboardNotificationVisuals[index % dashboardNotificationVisuals.length]

                return (
                  <button
                    key={item.id || `${item.title}-${item.time}-${index}`}
                    className="patient-dashboard-notice-row"
                    type="button"
                    onClick={onOpenNotifications}
                  >
                    <span className={`patient-dashboard-notice-icon ${visual.tone}`} aria-hidden="true">
                      <PatientIcon name={item.icon || visual.icon} />
                    </span>

                    <span className="patient-dashboard-notice-copy">
                      <span className="patient-dashboard-notice-title">{item.title}</span>
                      <span className="patient-dashboard-notice-body">{item.body}</span>
                      {visual.actionLabel ? (
                        <span className="patient-dashboard-notice-action">{visual.actionLabel}</span>
                      ) : null}
                    </span>

                    <span className="patient-dashboard-notice-meta">
                      <span>{item.time}</span>
                      <PatientIcon name="chevron_right" aria-hidden="true" />
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <aside className="patient-dashboard-mini-card patient-dashboard-interest-card">
            <div className="patient-dashboard-card-head">
              <div className="patient-dashboard-card-title">
                <PatientIcon name="medical_services" aria-hidden="true" />
                <h2>Bác sĩ bạn quan tâm</h2>
              </div>
              <button className="patient-dashboard-card-link" type="button" onClick={onBookAppointment}>
                Xem tất cả
              </button>
            </div>

            <div className="patient-dashboard-interest-list">
              {recommendedDoctors.map((doctor) => (
                <article className="patient-dashboard-doctor-row" key={doctor.id || doctor.name}>
                  <img src={doctor.avatar} alt={doctor.name} loading="lazy" />
                  <div>
                    <h3>{doctor.name}</h3>
                    <p>{doctor.specialty}</p>
                    <span className="patient-dashboard-doctor-rating">
                      <PatientIcon name="star" aria-hidden="true" />
                      {doctor.rating} ({doctor.reviews})
                    </span>
                  </div>
                  <button
                    className="patient-dashboard-favorite-button"
                    type="button"
                    aria-label={`Lưu ${doctor.name}`}
                  >
                    <PatientIcon name="favorite" aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          </aside>

          <aside className="patient-dashboard-mini-card patient-dashboard-news-card">
            <div className="patient-dashboard-card-head">
              <div className="patient-dashboard-card-title">
                <PatientIcon name="description" aria-hidden="true" />
                <h2>Tin tức sức khỏe</h2>
              </div>
              <Link className="patient-dashboard-card-link" to="/news">
                Xem tất cả
              </Link>
            </div>

            <div className="patient-dashboard-news-list">
              {healthNewsItems.map((article) => (
                <Link className="patient-dashboard-news-row" key={article.slug} to={`/news/${article.slug}`}>
                  <img src={article.image} alt={article.title} loading="lazy" />
                  <span>
                    <strong>{article.title}</strong>
                    <small>{article.publishedAt}</small>
                  </span>
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <section className="patient-records patient-panel">
        <div className="patient-panel-head">
          <div>
            <p className="patient-section-label">Hồ sơ lâm sàng</p>
            <h2>Hồ sơ bệnh án mới nhất</h2>
          </div>

          <button
            className="patient-inline-link patient-records-link"
            type="button"
            onClick={onOpenHistory}
          >
            Xem toàn bộ lịch sử
          </button>
        </div>

        {patientDataLoading ? (
          <div className="patient-dashboard-state">Đang tải hồ sơ bệnh án từ backend...</div>
        ) : latestRecords.length === 0 ? (
          <div className="patient-dashboard-state">Chưa có hồ sơ bệnh án nào để hiển thị.</div>
        ) : (
          <div className="patient-table-wrap">
            <table className="patient-table patient-records-table">
              <thead>
                <tr>
                  <th>Ngày thực hiện</th>
                  <th>Loại xét nghiệm</th>
                  <th>Bác sĩ chỉ định</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {latestRecords.map((record) => (
                  <tr key={`${record.date}-${record.test}`}>
                    <td className="patient-table-date">{record.date}</td>
                    <td>{record.test}</td>
                    <td className="patient-records-doctor">{record.doctor}</td>
                    <td>
                      <span className={`patient-pill ${record.ready ? 'good' : 'soft'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="patient-records-action"
                        type="button"
                        disabled={!record.ready}
                        aria-label={`Tải hồ sơ ${record.test}`}
                      >
                        <PatientIcon name="download" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
