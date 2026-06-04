import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Filter,
  History,
  Laptop,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getAuditLogs, getMyLoginHistory } from '../systemApi';
import { formatDateTime, formatNumber, formatRelativeTime, getBrowserLabel, getDeviceLabel, getInitials } from '../systemUi';

const PAGE_SIZE = 10;

function normalizeItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.logs)) return data.logs;
  return [];
}

function includesLoginAction(item) {
  const haystack = `${item.action || ''} ${item.event_type || ''} ${item.type || ''}`.toLowerCase();
  return haystack.includes('login') || haystack.includes('signin') || haystack.includes('auth');
}

function getActorLabel(item) {
  return item.actor_name || item.user_name || item.full_name || item.identity_label || item.actor?.full_name || item.user?.full_name || item.actor?.username || item.user?.username || item.username || 'Người dùng hệ thống';
}

function getActorEmail(item) {
  return item.actor_email || item.email || item.identity_email || item.actor?.email || item.user?.email || 'Chưa có email';
}

function getActorType(item) {
  return item.actor_type || item.user_type || item.actor?.actor_type || item.actor?.type || item.segment || 'staff';
}

function getIp(item) {
  return item.ip_address || item.ip || item.client_ip || item.metadata?.ip_address || item.context?.ip_address || 'N/A';
}

function getUserAgent(item) {
  return item.user_agent || item.userAgent || item.metadata?.user_agent || item.context?.user_agent || '';
}

function getCreatedAt(item) {
  return item.created_at || item.timestamp || item.logged_at || item.login_at || item.metadata?.created_at;
}

function getStatus(item) {
  const value = String(item.status || item.result || item.outcome || '').toLowerCase();
  if (['success', 'successful', 'ok', 'passed', 'pass'].includes(value)) return 'success';
  if (['failed', 'failure', 'error', 'denied', 'blocked'].includes(value)) return 'failed';
  if (value.includes('fail') || value.includes('deny') || value.includes('block')) return 'failed';
  return includesLoginAction(item) ? 'success' : 'unknown';
}

function getStatusInfo(status) {
  if (status === 'success') return { label: 'Thành công', tone: 'success', icon: CheckCircle2 };
  if (status === 'failed') return { label: 'Thất bại', tone: 'failed', icon: XCircle };
  return { label: 'Không rõ', tone: 'unknown', icon: AlertTriangle };
}

function getSegmentLabel(value) {
  const map = { staff: 'Cổng nhân sự', patient: 'Cổng bệnh nhân', admin: 'Quản trị', superadmin: 'Quản trị' };
  return map[String(value || '').toLowerCase()] || value || 'Hệ thống';
}

function getIpTag(ip) {
  const normalized = String(ip || '');
  if (!normalized || normalized === 'N/A') return 'NO-IP';
  if (normalized === '::1' || normalized.startsWith('127.') || normalized.startsWith('localhost')) return 'LOCAL';
  if (normalized.startsWith('10.') || normalized.startsWith('192.168.')) return 'LAN';
  return 'PUBLIC';
}

function toCsv(rows) {
  const header = ['user', 'email', 'time', 'ip', 'device', 'browser', 'status'];
  const body = rows.map((item) => [
    getActorLabel(item),
    getActorEmail(item),
    formatDateTime(getCreatedAt(item)),
    getIp(item),
    getDeviceLabel(getUserAgent(item)),
    getBrowserLabel(getUserAgent(item)),
    getStatusInfo(getStatus(item)).label,
  ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...body].join('\n');
}

function downloadCsv(rows) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `login-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function getTimeWindowDate(range) {
  const now = new Date();
  const days = Number(range || 7);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function LoginHistoryPage() {
  const [filters, setFilters] = useState({ keyword: '', status: '', actorType: '', range: '7' });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [items, setItems] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      let data;
      try {
        data = await getMyLoginHistory({ limit: 150 });
      } catch (myError) {
        data = await getAuditLogs({ limit: 150 });
      }
      const normalized = normalizeItems(data)
        .filter(includesLoginAction)
        .map((item) => ({ ...item, _login_status: getStatus(item), _actor_type: getActorType(item) }));
      setItems(normalized);
      setSelectedLog((current) => current || normalized[0] || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => items.filter((item) => {
    const keyword = appliedFilters.keyword.trim().toLowerCase();
    if (keyword) {
      const haystack = `${getActorLabel(item)} ${getActorEmail(item)} ${getIp(item)} ${getUserAgent(item)} ${item.action || ''}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    if (appliedFilters.status && item._login_status !== appliedFilters.status) return false;
    if (appliedFilters.actorType && item._actor_type !== appliedFilters.actorType) return false;
    const createdAt = getCreatedAt(item);
    if (createdAt && new Date(createdAt) < getTimeWindowDate(appliedFilters.range)) return false;
    return true;
  }), [appliedFilters, items]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogins = filtered.filter((item) => getCreatedAt(item) && new Date(getCreatedAt(item)) >= today);
    const failedLogins = filtered.filter((item) => item._login_status === 'failed');
    const staffLogins = filtered.filter((item) => String(item._actor_type).toLowerCase() === 'staff');
    const patientLogins = filtered.filter((item) => String(item._actor_type).toLowerCase() === 'patient');
    return [
      { label: 'Đăng nhập hôm nay', value: formatNumber(todayLogins.length), note: 'Theo thời gian hệ thống', icon: History, tone: 'indigo' },
      { label: 'Thất bại / bị chặn', value: formatNumber(failedLogins.length), note: failedLogins.length ? 'Cần rà soát' : 'An toàn', icon: ShieldAlert, tone: 'red' },
      { label: 'Nhân sự', value: formatNumber(staffLogins.length), note: 'Cổng nhân sự & admin', icon: UserRound, tone: 'violet' },
      { label: 'Bệnh nhân', value: formatNumber(patientLogins.length), note: filtered.length ? `${Math.round((patientLogins.length / filtered.length) * 100)}% tổng truy cập` : 'Chưa có dữ liệu', icon: Smartphone, tone: 'teal' },
    ];
  }, [filtered]);

  const totalPages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const pagedItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => { setPage(1); }, [appliedFilters]);

  function applyFilters() {
    setAppliedFilters(filters);
    setPage(1);
  }

  return (
    <section className="role-page system-admin-page login-audit-page">
      <section className="login-audit-hero">
        <div className="login-audit-hero__icon"><History size={30} /></div>
        <div>
          <p className="admin-page-header__eyebrow">Admin / Hệ thống / Lịch sử đăng nhập</p>
          <h1>Lịch sử đăng nhập</h1>
          <p>Theo dõi đăng nhập nhân sự, admin và bệnh nhân bằng dữ liệu audit/login thật từ backend để phát hiện bất thường nhanh hơn.</p>
        </div>
        <div className="login-audit-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={loadData} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /> Làm mới</button>
          <button type="button" className="staff-button staff-button--primary" onClick={() => downloadCsv(filtered)}><Download size={17} /> Xuất CSV</button>
        </div>
      </section>

      <section className="login-audit-stats">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`login-audit-stat login-audit-stat--${item.tone}`}>
              <span><Icon size={20} /></span>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          );
        })}
      </section>

      <section className="admin-panel login-audit-filter">
        <label className="login-audit-search"><Search size={17} /><input value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') applyFilters(); }} placeholder="Tìm theo tên, email, IP, thiết bị..." /></label>
        <label><Filter size={16} /><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Tất cả kết quả</option><option value="success">Thành công</option><option value="failed">Thất bại</option></select></label>
        <label><UserRound size={16} /><select value={filters.actorType} onChange={(event) => setFilters((current) => ({ ...current, actorType: event.target.value }))}><option value="">Tất cả đối tượng</option><option value="staff">Nhân sự</option><option value="patient">Bệnh nhân</option><option value="admin">Admin</option></select></label>
        <label><History size={16} /><select value={filters.range} onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))}><option value="7">7 ngày qua</option><option value="14">14 ngày qua</option><option value="30">30 ngày qua</option><option value="90">90 ngày qua</option></select></label>
        <button type="button" className="staff-button staff-button--primary" onClick={applyFilters}>Áp dụng</button>
      </section>

      <section className="login-audit-grid">
        <article className="admin-panel login-audit-table-card">
          <div className="login-audit-table-wrap">
            <table className="login-audit-table">
              <colgroup>
                <col className="login-audit-col-user" />
                <col className="login-audit-col-time" />
                <col className="login-audit-col-ip" />
                <col className="login-audit-col-device" />
                <col className="login-audit-col-segment" />
                <col className="login-audit-col-status" />
                <col className="login-audit-col-action" />
              </colgroup>
              <thead><tr><th>Người dùng</th><th>Thời gian</th><th>IP</th><th>Thiết bị</th><th>Đối tượng</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {pagedItems.map((item, index) => {
                  const status = getStatusInfo(item._login_status);
                  const StatusIcon = status.icon;
                  const isMobile = getDeviceLabel(getUserAgent(item)) === 'Di động';
                  return (
                    <tr key={`${item._id || item.audit_log_id || getCreatedAt(item)}-${index}`} onClick={() => setSelectedLog(item)} className={selectedLog === item ? 'is-selected' : ''}>
                      <td><div className="login-user-cell"><span>{getInitials(getActorLabel(item))}</span><div><strong>{getActorLabel(item)}</strong><small>{getActorEmail(item)}</small></div></div></td>
                      <td><strong>{formatRelativeTime(getCreatedAt(item))}</strong><small>{formatDateTime(getCreatedAt(item))}</small></td>
                      <td><strong>{getIp(item)}</strong><small>{getIpTag(getIp(item))}</small></td>
                      <td><div className="login-device-cell">{isMobile ? <Smartphone size={17} /> : <Laptop size={17} />}<div><strong>{getDeviceLabel(getUserAgent(item))}</strong><small>{getBrowserLabel(getUserAgent(item))}</small></div></div></td>
                      <td><span className="login-segment-chip">{getSegmentLabel(item._actor_type)}</span></td>
                      <td><span className={`login-status login-status--${status.tone}`}><StatusIcon size={14} /> {status.label}</span></td>
                      <td><button type="button" className="login-row-action" onClick={(event) => { event.stopPropagation(); setSelectedLog(item); }}>Chi tiết</button></td>
                    </tr>
                  );
                })}
                {!pagedItems.length && !loading ? <tr><td colSpan="7"><div className="login-empty-state">Không có bản ghi phù hợp.</div></td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="login-audit-footer">
            <p>Hiển thị {filtered.length === 0 ? '0' : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filtered.length)}`} / {formatNumber(filtered.length)} bản ghi</p>
            <div><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>‹</button><span>{page}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>›</button></div>
          </div>
          {error ? <p className="form-message error">{error}</p> : null}
        </article>

        <aside className="login-audit-detail">
          <article className="admin-panel login-detail-card">
            <div className="login-detail-card__head"><div><small>Selected login</small><h2>Chi tiết đăng nhập</h2></div><span><ShieldAlert size={20} /></span></div>
            {selectedLog ? (
              <div className="login-detail-list">
                <div><span>Người dùng</span><strong>{getActorLabel(selectedLog)}</strong></div>
                <div><span>Email</span><strong>{getActorEmail(selectedLog)}</strong></div>
                <div><span>Action</span><strong>{selectedLog.action || selectedLog.event_type || 'login'}</strong></div>
                <div><span>IP</span><strong>{getIp(selectedLog)} · {getIpTag(getIp(selectedLog))}</strong></div>
                <div><span>Thiết bị</span><strong>{getDeviceLabel(getUserAgent(selectedLog))} · {getBrowserLabel(getUserAgent(selectedLog))}</strong></div>
                <div><span>Thời gian</span><strong>{formatDateTime(getCreatedAt(selectedLog))}</strong></div>
              </div>
            ) : <p className="muted-copy">Chọn một bản ghi để xem chi tiết.</p>}
          </article>
        </aside>
      </section>
    </section>
  );
}
