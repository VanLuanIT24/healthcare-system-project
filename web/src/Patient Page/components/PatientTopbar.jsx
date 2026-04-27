import { useEffect, useRef, useState } from 'react'
import { navItems } from '../data/patientPageData'
import PatientIcon from './PatientIcon'

const mobileNavItems = [
  navItems.find((item) => item.key === 'trends'),
  navItems.find((item) => item.key === 'dashboard'),
  navItems.find((item) => item.key === 'appointments'),
  navItems.find((item) => item.key === 'directory'),
  navItems.find((item) => item.key === 'notifications'),
  navItems.find((item) => item.key === 'messages'),
  navItems.find((item) => item.key === 'documents'),
  navItems.find((item) => item.key === 'history'),
  navItems.find((item) => item.key === 'billing'),
  { key: 'emergency', label: 'Khẩn cấp' },
].filter(Boolean)

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
    emergency: 'Thông tin y tế cấp cứu',
    trends: 'Xu hướng sức khỏe',
    medications: 'Theo dõi thuốc',
    directory: 'Danh bạ phòng khám',
    documents: 'Kho tài liệu',
    messages: 'Tin nhắn',
    notifications: 'Thông báo',
    appointments: 'Lịch hẹn',
    history: 'Lịch sử khám',
    billing: 'Thanh toán và hóa đơn',
    profile: 'Hồ sơ và cài đặt',
    support: 'Hỗ trợ',
  }

  const searchPlaceholderMap = {
    profile: 'Tìm kiếm hồ sơ...',
    emergency: 'Tìm thông tin cấp cứu...',
    trends: 'Tìm dữ liệu sức khỏe...',
    medications: 'Tìm thuốc và phác đồ...',
    directory: 'Tìm phòng khám hoặc nhà thuốc...',
    appointments: 'Tìm lịch hẹn...',
    documents: 'Tìm tài liệu...',
    messages: 'Tìm cuộc trò chuyện...',
    notifications: 'Tìm thông báo...',
    history: 'Tìm lịch sử khám...',
    billing: 'Tìm kiếm hóa đơn...',
  }

  const searchPlaceholder =
    searchPlaceholderMap[activeSection] || 'Tìm hồ sơ và tài liệu y tế...'

  const handleNotificationItemClick = (notificationId) => {
    onMarkNotificationAsRead(notificationId)
    setOpenMenu(null)
    onNotificationsOpen()
  }

  return (
    <header className="patient-topbar">
      <div className="patient-topbar-title">
        <span className="patient-topbar-brand patient-topbar-brand-desktop">
          {titleMap[activeSection] || 'Tổng quan'}
        </span>
        <span className="patient-topbar-brand patient-topbar-brand-mobile">HealthCare</span>
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
                <h4>Thông báo</h4>
                <button
                  className="patient-topbar-dropdown-link"
                  type="button"
                  onClick={onMarkAllNotificationsAsRead}
                >
                  Đánh dấu tất cả đã đọc
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
                        <span>{item.time}</span>
                        <small>Chi tiết</small>
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
                  Xem tất cả
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
              {item.label}
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