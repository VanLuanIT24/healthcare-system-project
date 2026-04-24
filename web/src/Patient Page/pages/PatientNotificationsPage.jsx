import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import { notificationFilters } from '../data/patientPageData'

export default function PatientNotificationsPage({ feed, onMarkAllAsRead, onMarkAsRead, onNavigate }) {
  const [activeFilter, setActiveFilter] = useState('all')

  const filteredFeed =
    activeFilter === 'all' ? feed : feed.filter((item) => item.category === activeFilter)

  return (
    <div className="patient-notifications-page">
      <section className="patient-notifications-header">
        <div>
          <h1>Thông báo</h1>
          <p>Cập nhật những thông tin mới nhất về hành trình sức khỏe của bạn.</p>
        </div>

        <button className="patient-notifications-read-all" type="button" onClick={onMarkAllAsRead}>
          <PatientIcon name="done_all" aria-hidden="true" />
          <span>Đánh dấu đã đọc</span>
        </button>
      </section>

      <div className="patient-notification-filterbar" role="tablist" aria-label="Bộ lọc thông báo">
        {notificationFilters.map((filter) => (
          <button
            key={filter.key}
            className={`patient-notification-filter${activeFilter === filter.key ? ' is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter.key}
            onClick={() => setActiveFilter(filter.key)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredFeed.length ? (
        <div className="patient-notification-list-page">
          {filteredFeed.map((item) => (
            <article
              key={item.id}
              className={`patient-notification-card-page${item.unread ? ' is-unread' : ' is-read'}`}
            >
              <div className={`patient-notification-card-mark ${item.iconTone}`}>
                <PatientIcon name={item.icon} aria-hidden="true" />
              </div>

              <div className="patient-notification-card-copy">
                <div className="patient-notification-card-head">
                  <h2>{item.title}</h2>

                  <div className="patient-notification-card-meta">
                    <span>{item.time}</span>
                    {item.unread ? <i aria-hidden="true" /> : null}
                  </div>
                </div>

                <p>{item.body}</p>

                <div className="patient-notification-actions">
                  {item.unread ? (
                    <button
                      className="patient-notification-action secondary"
                      type="button"
                      onClick={() => onMarkAsRead(item.id)}
                    >
                      <PatientIcon name="done" aria-hidden="true" />
                      <span>Đánh dấu đã đọc</span>
                    </button>
                  ) : null}

                  {item.actions?.map((action) => (
                    <button
                      key={action.label}
                      className={`patient-notification-action ${action.tone}`}
                      type="button"
                      onClick={() => {
                        if (action.targetSection && onNavigate) {
                          onNavigate(action.targetSection)
                        }
                      }}
                    >
                      {action.icon ? <PatientIcon name={action.icon} aria-hidden="true" /> : null}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="patient-notification-empty patient-panel">
          <div className="patient-notification-empty-visual">
            <PatientIcon name="notifications_off" aria-hidden="true" />
          </div>
          <h2>Chưa có thông báo nào</h2>
          <p>Khi có tin mới về sức khỏe hoặc lịch khám, chúng tôi sẽ hiển thị tại đây.</p>
        </section>
      )}

      <footer className="patient-notifications-footer">
        <p>Kết thúc danh sách</p>
      </footer>
    </div>
  )
}
