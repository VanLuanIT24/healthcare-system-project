import PatientIcon from '../components/PatientIcon'
import {
  emergencyProfile,
  metrics as healthMetrics,
  notifications,
  records,
} from '../data/patientPageData'
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

export default function PatientDashboardPage({
  accountError,
  loading,
  onBookAppointment,
  onOpenHistory,
  onOpenNotifications,
  onOpenProfile,
  patientName,
  user,
}) {
  const latestLogin = user?.lastLoginAt
  const statusMeta = getStatusMeta(user?.status)
  const summaryMetrics = [
    {
      label: 'Mã bệnh nhân',
      value: user?.patientCode || 'Chưa cấp mã',
      unit: '',
      state: 'Dữ liệu từ /auth/me',
      tone: 'soft',
      icon: 'badge',
      accent: 'blue',
      kicker: 'Hồ sơ định danh',
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

  return (
    <>
      <section className="patient-hero">
        <div>
          <p className="patient-eyebrow">Chào mừng bạn đến với hệ thống</p>
          <h1>Xin chào, {patientName}!</h1>
          <p className="patient-hero-copy">
            Chào mừng bạn đến với trang bệnh nhân. Tại đây bạn có thể theo dõi hồ sơ cá
            nhân, quản lý tài khoản và xem nhanh các cập nhật sức khỏe quan trọng.
          </p>
        </div>

        <button className="patient-hero-button" type="button" onClick={onBookAppointment}>
          <PatientIcon name="calendar_add_on" aria-hidden="true" />
          <span>Đặt lịch khám ngay</span>
        </button>
      </section>

      {accountError ? (
        <div className="patient-dashboard-state patient-dashboard-state-error">{accountError}</div>
      ) : null}

      <div className="patient-grid">
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

                  <div className="patient-metric-value patient-metric-value-compact">
                    <strong>{metric.value}</strong>
                    {metric.unit ? <span>{metric.unit}</span> : null}
                  </div>

                  <span className={`patient-pill ${metric.tone}`}>{metric.state}</span>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="patient-panel patient-notification-panel patient-notification-panel-featured">
          <div className="patient-panel-head patient-panel-head-compact">
            <div className="patient-notification-title-wrap">
              <h2>Thông báo mới nhất</h2>
              <span className="patient-notify-dot static-dot" />
            </div>
          </div>

          <div className="patient-notification-list patient-notification-list-featured">
            {notifications.map((item) => (
              <article
                key={item.title}
                className="patient-notification-item patient-notification-item-featured"
              >
                <div className={`patient-notification-icon ${item.tone}`}>
                  <PatientIcon name={item.icon} aria-hidden="true" />
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <span>{item.time}</span>
                </div>
              </article>
            ))}
          </div>

          <button
            className="patient-outline-button patient-outline-button-featured"
            type="button"
            onClick={onOpenNotifications}
          >
            Xem tất cả thông báo
          </button>
        </aside>

        <section className="patient-panel patient-appointment-card patient-account-highlight">
          <p className="patient-section-label">Tài khoản hiện tại</p>
          <h2>Liên hệ chính</h2>

          <div className="patient-account-lines">
            <div className="patient-account-line">
              <span>Email</span>
              <strong>{user?.email || 'Chưa cập nhật'}</strong>
            </div>
            <div className="patient-account-line">
              <span>Số điện thoại</span>
              <strong>{user?.phone || 'Chưa cập nhật'}</strong>
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
            <h2>{emergencyProfile?.bloodType || 'O+'}</h2>
            <p>Nhóm máu</p>
          </div>
        </section>
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

        {records.length === 0 ? (
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
                {records.map((record) => (
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
