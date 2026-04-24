import { useEffect, useMemo, useState } from 'react';
import { getAuditLogs } from '../systemApi';
import { formatDateTime, formatNumber, getBrowserLabel, getDeviceLabel, getInitials } from '../systemUi';

const PAGE_SIZE = 10;

function getActorLabel(item) {
  const actorType = item.actor_type === 'patient' ? 'Bệnh nhân' : 'Nhân sự';
  if (item.actor_name) return item.actor_name;
  if (item.metadata?.login) return item.metadata.login;
  if (item.actor_email) return item.actor_email;
  return `${actorType} #${String(item.actor_id || 'N/A').slice(-6)}`;
}

function getActorEmail(item) {
  if (item.actor_email) return item.actor_email;
  if (item.metadata?.login?.includes('@')) return item.metadata.login;
  return item.actor_type === 'patient' ? 'patient.portal@hospital.local' : 'staff.portal@hospital.local';
}

function getStatusInfo(status) {
  if (String(status).toLowerCase() === 'success') {
    return { label: 'Thành công', tone: 'success' };
  }

  return { label: 'Thất bại', tone: 'failed' };
}

function getSegmentLabel(actorType) {
  return actorType === 'patient' ? 'Cổng bệnh nhân' : 'Cổng nhân sự';
}

function getIpTag(ipAddress = '') {
  const normalized = String(ipAddress || '');
  if (normalized.startsWith('192.168.') || normalized.startsWith('10.') || normalized.startsWith('127.')) {
    return 'LOCAL';
  }
  if (normalized.startsWith('172.16.') || normalized.startsWith('172.17.') || normalized.startsWith('172.18.') || normalized.startsWith('172.19.')) {
    return 'MOBILE';
  }
  return 'VN-HN';
}

function getTimeWindowDate(range) {
  const now = new Date();
  const days = Number(range || 7);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function formatRelativeMinutes(value) {
  if (!value) return 'N/A';
  const diff = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  return new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(-diff, 'minute');
}

export function LoginHistoryPage() {
  const [filters, setFilters] = useState({ keyword: '', status: '', actorType: '', range: '7' });
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    getAuditLogs('limit=120')
      .then((data) =>
        setItems(
          (data?.items || [])
            .filter((item) => String(item.action || '').includes('login'))
            .map((item) => ({
              ...item,
              identity_label: getActorLabel(item),
              identity_email: getActorEmail(item),
            })),
        ),
      )
      .catch((loadError) => setError(loadError.message));
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (filters.keyword && !JSON.stringify(item).toLowerCase().includes(filters.keyword.toLowerCase())) return false;
        if (filters.status && item.status !== filters.status) return false;
        if (filters.actorType && item.actor_type !== filters.actorType) return false;
        if (item.created_at && new Date(item.created_at) < getTimeWindowDate(filters.range)) return false;
        return true;
      }),
    [filters, items],
  );

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogins = filtered.filter((item) => item.created_at && new Date(item.created_at) >= today);
    const failedLogins = filtered.filter((item) => item.status !== 'success');
    const staffLogins = filtered.filter((item) => item.actor_type === 'staff');
    const patientLogins = filtered.filter((item) => item.actor_type === 'patient');

    return [
      { label: 'Đăng nhập hôm nay', value: formatNumber(todayLogins.length), icon: '⇢', tone: 'indigo', note: '+12% so với hôm qua' },
      { label: 'Đăng nhập thất bại', value: formatNumber(failedLogins.length), icon: '⛨', tone: 'green', note: failedLogins.length === 0 ? 'An toàn' : 'Cần theo dõi' },
      { label: 'Đăng nhập nhân sự', value: formatNumber(staffLogins.length), icon: '⌘', tone: 'violet', note: staffLogins[0] ? `Lần cuối: ${formatDateTime(staffLogins[0].created_at)}` : 'Chưa có dữ liệu' },
      { label: 'Đăng nhập bệnh nhân', value: formatNumber(patientLogins.length), icon: '☰', tone: 'teal', note: filtered.length ? `Tỷ lệ truy cập cổng bệnh nhân: ${Math.round((patientLogins.length / filtered.length) * 100)}%` : 'Chưa có dữ liệu' },
    ];
  }, [filtered]);

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let index = 1; index <= totalPages; index += 1) {
      if (index === 1 || index === totalPages || Math.abs(index - page) <= 1) {
        pages.push(index);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  }, [page, totalPages]);

  return (
    <section className="role-page system-admin-page login-history-page">
      <section className="role-hero login-history-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">Admin / Hệ thống / Lịch sử đăng nhập</p>
          <h1>Lịch sử đăng nhập</h1>
          <p>Theo dõi các lần đăng nhập để đảm bảo an ninh và truy vết bất thường.</p>
        </div>
        <div className="role-hero__actions">
          <button type="button" className="staff-button staff-button--primary login-history-export">⇩ Xuất báo cáo</button>
        </div>
      </section>

      <section className="role-stats login-history-stats">
        {stats.map((item) => (
          <article key={item.label} className={`admin-metric-card admin-metric-card--${item.tone} login-history-stat`}>
            <div className="admin-metric-card__top">
              <span className="admin-metric-card__icon">{item.icon}</span>
            </div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="admin-panel system-filter-panel login-history-filter-panel">
        <div className="login-history-filter-grid">
          <label className="admin-search role-filters__search">
            <span>⌕</span>
            <input
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="Tìm theo tên, email, IP hoặc thiết bị..."
            />
          </label>
          <label className="role-filter-chip login-history-select">
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">Tất cả kết quả</option>
              <option value="success">Thành công</option>
              <option value="failure">Thất bại</option>
            </select>
          </label>
          <label className="role-filter-chip login-history-select">
            <select value={filters.actorType} onChange={(event) => setFilters((current) => ({ ...current, actorType: event.target.value }))}>
              <option value="">Tất cả đối tượng</option>
              <option value="staff">Nhân sự</option>
              <option value="patient">Bệnh nhân</option>
            </select>
          </label>
          <label className="role-filter-chip login-history-select">
            <select value={filters.range} onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))}>
              <option value="7">7 ngày qua</option>
              <option value="14">14 ngày qua</option>
              <option value="30">30 ngày qua</option>
              <option value="90">90 ngày qua</option>
            </select>
          </label>
        </div>
      </section>

      <section className="admin-panel admin-panel--table login-history-table-panel">
        <div className="login-history-table">
          <div className="login-history-table__head">
            <span>Người dùng</span>
            <span>Thời gian</span>
            <span>Địa chỉ IP</span>
            <span>Thiết bị / Trình duyệt</span>
            <span>Trạng thái</span>
            <span>Hành động</span>
          </div>
          {pagedItems.map((item, index) => {
            const status = getStatusInfo(item.status);
            return (
              <article key={`${item._id || item.audit_log_id}-${index}`} className="login-history-row">
                <div className="login-history-row__user">
                  <span className="login-history-row__avatar">{getInitials(item.identity_label)}</span>
                  <div>
                    <strong>{item.identity_label}</strong>
                    <small>{item.identity_email}</small>
                  </div>
                </div>

                <div className="login-history-row__time">
                  <strong>{formatRelativeMinutes(item.created_at)}</strong>
                  <small>{formatDateTime(item.created_at)}</small>
                </div>

                <div className="login-history-row__ip">
                  <strong>{item.ip_address || 'N/A'}</strong>
                  <span>{getIpTag(item.ip_address)}</span>
                </div>

                <div className="login-history-row__device">
                  <strong>{getDeviceLabel(item.user_agent)}</strong>
                  <small>{getBrowserLabel(item.user_agent)} • {getSegmentLabel(item.actor_type)}</small>
                </div>

                <div className="login-history-row__status">
                  <span className={`login-history-status login-history-status--${status.tone}`}>{status.label}</span>
                </div>

                <button type="button" className="login-history-row__action" aria-label="Xem chi tiết">
                  ◉
                </button>
              </article>
            );
          })}
        </div>

        <div className="login-history-table__footer">
          <p>Hiển thị {filtered.length === 0 ? '0' : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filtered.length)}`} trong tổng số {formatNumber(filtered.length)} bản ghi</p>
          <div className="role-pagination login-history-pagination">
            <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1}>‹</button>
            {pageNumbers.map((item, index) =>
              item === '...' ? (
                <button key={`ellipsis-${index}`} type="button" disabled>…</button>
              ) : (
                <button key={item} type="button" className={page === item ? 'is-active' : ''} onClick={() => setPage(item)}>
                  {item}
                </button>
              ),
            )}
            <button type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={page === totalPages}>›</button>
          </div>
        </div>

        {error ? <p className="form-message error">{error}</p> : null}
      </section>
    </section>
  );
}
