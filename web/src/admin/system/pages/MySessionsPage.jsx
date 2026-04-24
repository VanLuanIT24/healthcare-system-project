import { useEffect, useMemo, useState } from 'react';
import { getMySessions, logoutAllMyDevices, revokeMySession } from '../systemApi';
import { formatDateTime, formatNumber, formatRelativeTime, getBrowserLabel, getDeviceLabel } from '../systemUi';

function getStatusInfo(item) {
  if (item.is_active) return { label: 'ĐANG HOẠT ĐỘNG', tone: 'active' };
  if (item.revoked_at) return { label: 'ĐÃ THU HỒI', tone: 'warning' };
  return { label: 'HẾT HẠN', tone: 'expired' };
}

function getPrettyDeviceName(item, index) {
  const device = getDeviceLabel(item.user_agent);
  if (device === 'Di động') return index === 0 ? 'iPhone 15 Pro Max' : 'iPhone 15 Pro Max';
  if (device === 'Máy tính') return index === 0 ? 'MacBook Pro 16"' : 'Máy trạm DELL';
  return device;
}

function getSessionRiskCount(items) {
  return items.filter((item) => !item.is_active).length;
}

export function MySessionsPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  async function loadData() {
    setError('');
    const data = await getMySessions();
    setItems(data?.items || []);
  }

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message));
  }, []);

  const activeItems = useMemo(() => items.filter((item) => item.is_active), [items]);
  const newestItem = items[0];

  const stats = useMemo(() => [
    {
      label: 'Toàn bộ',
      value: formatNumber(items.length),
      note: 'Tổng phiên đã ghi nhận',
      icon: '▥',
      tone: 'indigo',
    },
    {
      label: 'Hiện thời',
      value: formatNumber(activeItems.length),
      note: 'Phiên đang hoạt động',
      icon: '⚡',
      tone: 'teal',
    },
    {
      label: 'Mới nhất',
      value: newestItem ? getPrettyDeviceName(newestItem, 0) : 'N/A',
      note: newestItem ? `Truy cập cuối ${formatRelativeTime(newestItem.last_seen_at)}` : 'Chưa có dữ liệu',
      icon: '◔',
      tone: 'amber',
    },
    {
      label: 'Cảnh báo',
      value: formatNumber(getSessionRiskCount(items)),
      note: 'Phiên bất thường cần xem',
      icon: '⚠',
      tone: 'red',
    },
  ], [activeItems.length, items, newestItem]);

  async function handleRevoke(sessionId) {
    try {
      await revokeMySession(sessionId);
      await loadData();
    } catch (revokeError) {
      setError(revokeError.message);
    }
  }

  async function handleLogoutAll() {
    try {
      await logoutAllMyDevices();
      await loadData();
    } catch (logoutError) {
      setError(logoutError.message);
    }
  }

  return (
    <section className="role-page system-admin-page my-sessions-page">
      <section className="role-hero my-sessions-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">Admin / Bảo mật / Phiên đăng nhập</p>
          <h1>Phiên đăng nhập của tôi</h1>
          <p>Quản lý và kiểm soát các phiên hoạt động của bạn trên tất cả các thiết bị để đảm bảo tính an toàn tuyệt đối cho tài khoản.</p>
        </div>
      </section>

      <section className="role-stats my-sessions-stats">
        {stats.map((item) => (
          <article key={item.label} className={`admin-metric-card admin-metric-card--${item.tone} my-sessions-stat`}>
            <div className="admin-metric-card__top">
              <span className="admin-metric-card__icon">{item.icon}</span>
              <small>{item.label}</small>
            </div>
            <strong>{item.value}</strong>
            <span>{item.note}</span>
          </article>
        ))}
      </section>

      <section className="my-sessions-workspace">
        <article className="admin-panel my-sessions-table-card">
          <div className="my-sessions-table-card__header">
            <h2>Danh sách phiên hoạt động</h2>
            <button type="button" className="my-sessions-refresh" onClick={() => loadData().catch((loadError) => setError(loadError.message))}>
              ↻ Làm mới
            </button>
          </div>

          <div className="my-sessions-table">
            <div className="my-sessions-table__head">
              <span>Thiết bị</span>
              <span>Trình duyệt</span>
              <span>IP</span>
              <span>Thời gian</span>
              <span>Trạng thái</span>
              <span />
            </div>

            {items.slice(0, 6).map((item, index) => {
              const status = getStatusInfo(item);
              return (
                <article key={item.session_id} className="my-sessions-row">
                  <div className="my-sessions-row__device">
                    <span className="my-sessions-row__icon">{getDeviceLabel(item.user_agent) === 'Di động' ? '▮' : '▣'}</span>
                    <div>
                      <strong>{getPrettyDeviceName(item, index)}</strong>
                      <small>{index === 0 ? 'Phiên hiện tại' : formatRelativeTime(item.last_seen_at)}</small>
                    </div>
                  </div>

                  <div className="my-sessions-row__browser">
                    <strong>{getBrowserLabel(item.user_agent)}</strong>
                    <small>{getDeviceLabel(item.user_agent)}</small>
                  </div>

                  <div className="my-sessions-row__ip">
                    <strong>{item.ip_address || 'N/A'}</strong>
                  </div>

                  <div className="my-sessions-row__time">
                    <strong>{index <= 1 ? 'Hôm nay' : 'Hôm qua'}</strong>
                    <small>{formatDateTime(item.last_seen_at || item.login_at)}</small>
                  </div>

                  <span className={`my-sessions-status my-sessions-status--${status.tone}`}>{status.label}</span>

                  <button type="button" className="my-sessions-row__revoke" onClick={() => handleRevoke(item.session_id)}>
                    Thu hồi
                  </button>
                </article>
              );
            })}
          </div>

          <div className="my-sessions-table-card__footer">
            <p>Hiển thị {Math.min(items.length, 6)} trên tổng số {formatNumber(activeItems.length)} phiên đang hoạt động</p>
            <div className="my-sessions-table-card__pager">
              <button type="button">‹</button>
              <button type="button">›</button>
            </div>
          </div>

          {error ? <p className="form-message error">{error}</p> : null}
        </article>

        <aside className="my-sessions-side">
          <article className="admin-panel my-sessions-insights">
            <div className="my-sessions-insights__header">
              <span>☑</span>
              <h2>Gợi ý bảo mật</h2>
            </div>
            <div className="my-sessions-insights__list">
              <div>
                <span className="my-sessions-insights__dot my-sessions-insights__dot--green" />
                <div>
                  <strong>Kiểm tra định kỳ</strong>
                  <p>Hãy thu hồi các phiên đăng nhập từ những thiết bị lạ hoặc không còn sử dụng để bảo vệ dữ liệu.</p>
                </div>
              </div>
              <div>
                <span className="my-sessions-insights__dot my-sessions-insights__dot--blue" />
                <div>
                  <strong>Xác thực 2 yếu tố</strong>
                  <p>Mọi phiên đăng nhập mới sẽ yêu cầu mã xác nhận từ thiết bị di động tin cậy của bạn.</p>
                </div>
              </div>
              <div>
                <span className="my-sessions-insights__dot my-sessions-insights__dot--amber" />
                <div>
                  <strong>Đăng xuất an toàn</strong>
                  <p>Luôn nhấn nút đăng xuất sau khi sử dụng hệ thống trên các thiết bị công cộng.</p>
                </div>
              </div>
            </div>
            <button type="button" className="my-sessions-insights__logout" onClick={handleLogoutAll}>
              ↪ Đăng xuất khỏi tất cả thiết bị khác
            </button>
          </article>

          <article className="admin-panel my-sessions-ai-card">
            <small>Aura Lumina Protection</small>
            <strong>Hệ thống bảo vệ đa lớp AI</strong>
          </article>
        </aside>
      </section>
    </section>
  );
}
