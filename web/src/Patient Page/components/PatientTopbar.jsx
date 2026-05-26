import { useEffect, useRef, useState } from 'react'
import { AppLogo } from '../../app/AppLogo'
import { sidebarSections } from '../data/patientPageData'
import PatientIcon from './PatientIcon'

const mobileNavItems = [
  { key: 'dashboard', icon: 'dashboard', label: 'Tổng quan' },
  ...sidebarSections.flatMap((section) => section.items),
  { key: 'emergency', icon: 'emergency', label: 'Cấp cứu' },
]

export default function PatientTopbar({
  activeSection,
  avatarText,
  notificationItems,
  onEmergencyOpen,
  onHomeOpen,
  onMarkAllNotificationsAsRead,
  onMarkNotificationAsRead,
  onMessagesOpen,
  onNotificationsOpen,
  onLogout,
  onProfileOpen,
  onSectionChange,
  patientName,
}) {
  const [openMenu, setOpenMenu] = useState(null)
  const notificationMenuRef = useRef(null)
  const profileMenuRef = useRef(null)
  const quickNotifications = notificationItems.slice(0, 3)
  const hasUnreadNotifications = notificationItems.some((item) => item.unread)
  const unreadNotificationCount = notificationItems.filter((item) => item.unread).length

  useEffect(() => {
    function handleClickOutside(event) {
      const clickedNotificationMenu =
        notificationMenuRef.current && notificationMenuRef.current.contains(event.target)
      const clickedProfileMenu = profileMenuRef.current && profileMenuRef.current.contains(event.target)

      if (!clickedNotificationMenu && !clickedProfileMenu) {
        setOpenMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const titleMap = {
    dashboard: 'Tổng quan',
    'book-appointment': 'Đặt lịch khám',
    'checkin-queue': 'Check-in / Queue',
    'lab-results': '',
    emergency: 'Thông tin y tế cấp cứu',
    imaging: 'Chẩn đoán hình ảnh',
    medications: 'Theo dõi thuốc',
    directory: 'Danh bạ phòng khám',
    documents: 'Kho tài liệu',
    'medical-records': 'Hồ sơ y tế',
    inpatient: 'Nội trú',
    procedures: 'Thủ thuật',
    messages: 'Tin nhắn',
    notifications: 'Thông báo',
    appointments: '',
    history: 'Lịch sử khám',
    billing: 'Thanh toán và hóa đơn',
    'billing-receipts': 'Hóa đơn / Biên lai',
    insurance: 'Bảo hiểm',
    'relatives-authorizations': 'Người thân / Ủy quyền',
    profile: 'Hồ sơ cá nhân',
    support: 'Hỗ trợ',
    settings: 'Cài đặt',
  }

  const searchPlaceholderMap = {
    profile: 'Tìm kiếm hồ sơ...',
    settings: 'Tìm cài đặt...',
    emergency: 'Tìm thông tin cấp cứu...',
    'book-appointment': 'Tìm lịch khám phù hợp...',
    'checkin-queue': 'Tìm số thứ tự, trạng thái check-in...',
    'lab-results': 'Tìm kết quả xét nghiệm...',
    imaging: 'Tìm chẩn đoán hình ảnh...',
    inpatient: 'Tìm lần nhập viện, khoa điều trị...',
    procedures: 'Tìm thủ thuật, kết quả...',
    'medical-records': 'Tìm hồ sơ y tế...',
    medications: 'Tìm thuốc và phác đồ...',
    directory: 'Tìm phòng khám hoặc nhà thuốc...',
    appointments: 'Tìm hồ sơ y tế...',
    documents: 'Tìm tài liệu...',
    messages: 'Tìm cuộc trò chuyện...',
    notifications: 'Tìm thông báo...',
    history: 'Tìm lịch sử khám...',
    billing: 'Tìm dịch vụ, hóa đơn, hoặc mã thanh toán...',
    'billing-receipts': 'Tìm hóa đơn, biên lai, hoặc mã giao dịch...',
    insurance: 'Tìm thông tin bảo hiểm...',
    'relatives-authorizations': 'Tìm người thân hoặc quyền ủy quyền...',
  }

  const searchPlaceholder =
    searchPlaceholderMap[activeSection] || 'Tìm hồ sơ và tài liệu y tế...'
  const topbarTitle = titleMap[activeSection] ?? 'Tổng quan'

  const handleNotificationItemClick = (notificationId) => {
    onMarkNotificationAsRead(notificationId)
    setOpenMenu(null)
    onNotificationsOpen()
  }

  return (
    <header className="patient-topbar">
      <div className="patient-topbar-title">
        {topbarTitle ? (
          <span className="patient-topbar-brand patient-topbar-brand-desktop">
            {topbarTitle}
          </span>
        ) : null}
        <span className="patient-topbar-brand patient-topbar-brand-mobile">
          <AppLogo variant="mark" alt="Bộ Y tế" />
        </span>
      </div>

      <div className="patient-topbar-actions">
        <button
          className={`patient-notify patient-topbar-chat${
            activeSection === 'messages' ? ' is-active' : ''
          }`}
          type="button"
          aria-label="Tin nhắn"
          onClick={onMessagesOpen}
        >
          <PatientIcon name="chat" aria-hidden="true" />
        </button>

        <div className="patient-topbar-menu patient-topbar-menu-notify" ref={notificationMenuRef}>
          <button
            className={`patient-notify${activeSection === 'notifications' ? ' is-active' : ''}`}
            type="button"
            aria-label="Thông báo"
            aria-expanded={openMenu === 'notifications'}
            onClick={() =>
              setOpenMenu((current) => (current === 'notifications' ? null : 'notifications'))
            }
          >
            <PatientIcon name="notifications" aria-hidden="true" />
            {hasUnreadNotifications ? <span className="patient-notify-dot" /> : null}
          </button>

          {openMenu === 'notifications' ? (
            <div className="patient-topbar-dropdown patient-topbar-dropdown-notifications">
              <div className="patient-topbar-dropdown-head">
                <span className="patient-topbar-dropdown-head-icon">
                  <PatientIcon name="notifications" aria-hidden="true" />
                </span>
                <div className="patient-topbar-dropdown-title">
                  <h4>Thông báo</h4>
                  {unreadNotificationCount > 0 ? (
                    <span>{unreadNotificationCount} chưa đọc</span>
                  ) : null}
                </div>
                <button
                  className="patient-topbar-dropdown-link"
                  type="button"
                  aria-label="Đánh dấu tất cả đã đọc"
                  title="Đánh dấu tất cả đã đọc"
                  data-tooltip="Đánh dấu tất cả đã đọc"
                  onClick={onMarkAllNotificationsAsRead}
                >
                  <PatientIcon name="done_all" aria-hidden="true" />
                  <span>Đã đọc</span>
                </button>
              </div>

              <div className="patient-notification-menu-list">
                {quickNotifications.map((item) => (
                  <button
                    key={item.id}
                    className={`patient-notification-menu-item${item.unread ? ' is-unread' : ''}`}
                    type="button"
                    onClick={() => handleNotificationItemClick(item.id)}
                  >
                    <div className={`patient-notification-menu-icon ${item.iconTone}`}>
                      <PatientIcon name={item.icon} aria-hidden="true" />
                    </div>

                    <div className="patient-notification-menu-copy">
                      <h5>{item.title}</h5>
                      <p>{item.body}</p>
                      <div className="patient-notification-menu-meta">
                        <span>
                          <PatientIcon name="schedule" aria-hidden="true" />
                          {item.time}
                        </span>
                        <small>
                          Chi tiết
                          <PatientIcon name="chevron_right" aria-hidden="true" />
                        </small>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="patient-topbar-dropdown-footer">
                <button
                  className="patient-topbar-dropdown-footer-button"
                  type="button"
                  onClick={() => {
                    setOpenMenu(null)
                    onNotificationsOpen()
                  }}
                >
                  <PatientIcon name="format_list_bulleted" aria-hidden="true" />
                  Xem tất cả
                  <PatientIcon name="chevron_right" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <button
          className="patient-emergency patient-topbar-emergency"
          type="button"
          onClick={onEmergencyOpen}
        >
          Khẩn cấp
        </button>

        <div className="patient-topbar-menu" ref={profileMenuRef}>
          <button
            className="patient-profile-card patient-profile-trigger"
            type="button"
            onClick={() => setOpenMenu((current) => (current === 'profile' ? null : 'profile'))}
            aria-label="Mở menu tài khoản"
            aria-expanded={openMenu === 'profile'}
          >
            <div className="patient-avatar">{avatarText}</div>
            <div className="patient-profile-copy">
              <p>{patientName}</p>
              <span>Bệnh nhân ưu tiên</span>
            </div>
            <span className="patient-profile-caret" aria-hidden="true">
              <PatientIcon name={openMenu === 'profile' ? 'expand_less' : 'expand_more'} />
            </span>
          </button>

          {openMenu === 'profile' ? (
            <div className="patient-topbar-dropdown">
              <button
                className="patient-topbar-dropdown-item"
                type="button"
                onClick={() => {
                  setOpenMenu(null)
                  onHomeOpen()
                }}
              >
                <PatientIcon name="home" aria-hidden="true" />
                <span>Trang chủ</span>
              </button>

              <button
                className="patient-topbar-dropdown-item"
                type="button"
                onClick={() => {
                  setOpenMenu(null)
                  onProfileOpen()
                }}
              >
                <PatientIcon name="person" aria-hidden="true" />
                <span>Hồ sơ và cài đặt</span>
              </button>

              <button
                className="patient-topbar-dropdown-item is-danger"
                type="button"
                onClick={() => {
                  setOpenMenu(null)
                  onLogout()
                }}
              >
                <PatientIcon name="logout" aria-hidden="true" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="patient-topbar-mobile-nav" aria-label="Điều hướng nhanh trên điện thoại">
        {mobileNavItems.map((item) => {
          const isEmergency = item.key === 'emergency'
          const isActive = activeSection === item.key

          return (
            <button
              key={item.key}
              className={`patient-mobile-nav-pill${isActive ? ' is-active' : ''}${
                isEmergency ? ' is-emergency' : ''
              }`}
              type="button"
              onClick={() => (isEmergency ? onEmergencyOpen() : onSectionChange(item.key))}
            >
              <span className="patient-mobile-nav-pill-icon" aria-hidden="true">
                <PatientIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      <label className="patient-search" aria-label="Tìm kiếm hồ sơ">
        <span className="patient-search-icon" aria-hidden="true">
          <PatientIcon name="search" />
        </span>
        <input type="text" placeholder={searchPlaceholder} />
      </label>
    </header>
  )
}
