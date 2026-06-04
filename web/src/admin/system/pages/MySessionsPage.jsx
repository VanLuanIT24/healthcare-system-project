import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Laptop,
  LogOut,
  MonitorCheck,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getMySessions, logoutAllMyDevices, revokeMySession } from '../systemApi';
import { formatDateTime, formatNumber, formatRelativeTime, getBrowserLabel, getDeviceLabel } from '../systemUi';

function normalizeSessions(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.sessions)) return data.sessions;
  return [];
}

function getSessionId(item) {
  return item.session_id || item._id || item.id || item.jti;
}

function getStatusInfo(item) {
  if (item.revoked_at) return { label: 'Đã thu hồi', tone: 'warning', icon: XCircle };
  if (item.is_active === false) return { label: 'Hết hạn', tone: 'expired', icon: Clock3 };
  return { label: 'Đang hoạt động', tone: 'active', icon: CheckCircle2 };
}

function getDeviceIcon(userAgent) {
  const label = getDeviceLabel(userAgent);
  if (label === 'Di động') return Smartphone;
  if (label === 'Máy tính bảng') return Tablet;
  return Laptop;
}

function getRiskLabel(item) {
  if (item.revoked_at) return 'Đã xử lý';
  if (item.is_active === false) return 'Cũ';
  if (!item.ip_address) return 'Thiếu IP';
  if (String(item.ip_address).startsWith('::1') || String(item.ip_address).startsWith('127.')) return 'Local';
  return 'Tin cậy';
}

function getRiskTone(item) {
  const label = getRiskLabel(item);
  if (label === 'Tin cậy' || label === 'Local') return 'safe';
  if (label === 'Đã xử lý') return 'muted';
  return 'watch';
}

export function MySessionsPage() {
  const [items, setItems] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busySessionId, setBusySessionId] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const data = await getMySessions();
      const normalized = normalizeSessions(data);
      setItems(normalized);
      setSelectedSession((current) => current ? normalized.find((item) => getSessionId(item) === getSessionId(current)) || null : normalized[0] || null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const activeItems = useMemo(() => items.filter((item) => item.is_active !== false && !item.revoked_at), [items]);
  const revokedItems = useMemo(() => items.filter((item) => item.revoked_at || item.is_active === false), [items]);
  const newestItem = items[0];
  const suspiciousItems = useMemo(() => items.filter((item) => getRiskTone(item) === 'watch'), [items]);

  const stats = useMemo(() => [
    { label: 'Tổng phiên', value: formatNumber(items.length), note: 'Ghi nhận từ backend', icon: MonitorCheck, tone: 'indigo' },
    { label: 'Đang hoạt động', value: formatNumber(activeItems.length), note: 'Có thể thu hồi', icon: Activity, tone: 'teal' },
    { label: 'Thiết bị mới nhất', value: newestItem ? getDeviceLabel(newestItem.user_agent) : 'N/A', note: newestItem ? formatRelativeTime(newestItem.last_seen_at || newestItem.login_at || newestItem.created_at) : 'Chưa có dữ liệu', icon: Wifi, tone: 'amber' },
    { label: 'Cần kiểm tra', value: formatNumber(suspiciousItems.length), note: `${formatNumber(revokedItems.length)} phiên cũ/thu hồi`, icon: AlertTriangle, tone: 'red' },
  ], [activeItems.length, items, newestItem, revokedItems.length, suspiciousItems.length]);

  async function handleRevoke(session) {
    const sessionId = getSessionId(session);
    if (!sessionId) return setError('Phiên này không có session_id để thu hồi.');
    setBusySessionId(sessionId);
    setError('');
    try {
      await revokeMySession(sessionId);
      await loadData();
    } catch (revokeError) {
      setError(revokeError.message);
    } finally {
      setBusySessionId('');
    }
  }

  async function handleLogoutAll() {
    setBusySessionId('all');
    setError('');
    try {
      await logoutAllMyDevices();
      await loadData();
    } catch (logoutError) {
      setError(logoutError.message);
    } finally {
      setBusySessionId('');
    }
  }

  return (
    <section className="role-page system-admin-page session-control-page">
      <section className="session-control-hero">
        <div className="session-control-hero__icon"><MonitorCheck size={30} /></div>
        <div>
          <p className="admin-page-header__eyebrow">Admin / Bảo mật / Phiên đăng nhập</p>
          <h1>Phiên đăng nhập của tôi</h1>
          <p>Kiểm soát thiết bị, trình duyệt, IP và trạng thái phiên đăng nhập bằng dữ liệu thật từ backend.</p>
        </div>
        <div className="session-control-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={loadData} disabled={loading}>
            <RefreshCw size={17} className={loading ? 'spin' : ''} /> Làm mới
          </button>
          <button type="button" className="staff-button staff-button--danger" onClick={handleLogoutAll} disabled={busySessionId === 'all'}>
            <LogOut size={17} /> Đăng xuất thiết bị khác
          </button>
        </div>
      </section>

      <section className="session-control-stats">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={`session-stat session-stat--${item.tone}`}>
              <span><Icon size={20} /></span>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          );
        })}
      </section>

      <section className="session-control-grid">
        <article className="admin-panel session-control-list-card">
          <div className="session-control-list-card__head">
            <div><small>Session inventory</small><h2>Danh sách phiên</h2></div>
            <span>{formatNumber(items.length)} bản ghi</span>
          </div>

          <div className="session-control-table-wrap">
            <table className="session-control-table">
              <thead>
                <tr>
                  <th>Thiết bị</th>
                  <th>Trình duyệt</th>
                  <th>IP</th>
                  <th>Lần cuối</th>
                  <th>Rủi ro</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const sessionId = getSessionId(item) || `session-${index}`;
                  const status = getStatusInfo(item);
                  const StatusIcon = status.icon;
                  const DeviceIcon = getDeviceIcon(item.user_agent);
                  const isSelected = selectedSession && getSessionId(selectedSession) === getSessionId(item);
                  return (
                    <tr key={sessionId} className={isSelected ? 'is-selected' : ''} onClick={() => setSelectedSession(item)}>
                      <td>
                        <div className="session-device-cell">
                          <span><DeviceIcon size={18} /></span>
                          <div><strong>{getDeviceLabel(item.user_agent)}</strong><small>{index === 0 ? 'Phiên mới nhất' : 'Phiên đã ghi nhận'}</small></div>
                        </div>
                      </td>
                      <td><strong>{getBrowserLabel(item.user_agent)}</strong><small>{String(item.user_agent || 'Không có user-agent').slice(0, 38)}</small></td>
                      <td><strong>{item.ip_address || 'Chưa có IP'}</strong><small>{item.location || item.country || 'Chưa định vị'}</small></td>
                      <td><strong>{formatRelativeTime(item.last_seen_at || item.login_at || item.created_at)}</strong><small>{formatDateTime(item.last_seen_at || item.login_at || item.created_at)}</small></td>
                      <td><span className={`session-risk session-risk--${getRiskTone(item)}`}>{getRiskLabel(item)}</span></td>
                      <td><span className={`session-status session-status--${status.tone}`}><StatusIcon size={14} /> {status.label}</span></td>
                      <td>
                        <button type="button" className="session-revoke-btn" onClick={(event) => { event.stopPropagation(); handleRevoke(item); }} disabled={busySessionId === sessionId || Boolean(item.revoked_at)}>
                          {busySessionId === sessionId ? 'Đang thu hồi' : 'Thu hồi'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!items.length && !loading ? (
                  <tr><td colSpan="7"><div className="session-empty-state">Chưa có dữ liệu phiên từ backend.</div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {error ? <p className="form-message error">{error}</p> : null}
        </article>

        <aside className="session-control-detail">
          <article className="admin-panel session-detail-card">
            <div className="session-detail-card__head">
              <div><small>Selected session</small><h2>Chi tiết phiên</h2></div>
              <span><ShieldCheck size={20} /></span>
            </div>
            {selectedSession ? (
              <div className="session-detail-list">
                <div><span>Session ID</span><strong>{getSessionId(selectedSession) || 'N/A'}</strong></div>
                <div><span>Thiết bị</span><strong>{getDeviceLabel(selectedSession.user_agent)}</strong></div>
                <div><span>Trình duyệt</span><strong>{getBrowserLabel(selectedSession.user_agent)}</strong></div>
                <div><span>IP</span><strong>{selectedSession.ip_address || 'Chưa có IP'}</strong></div>
                <div><span>Đăng nhập</span><strong>{formatDateTime(selectedSession.login_at || selectedSession.created_at)}</strong></div>
                <div><span>Lần cuối</span><strong>{formatDateTime(selectedSession.last_seen_at || selectedSession.updated_at)}</strong></div>
              </div>
            ) : <p className="muted-copy">Chọn một phiên để xem chi tiết.</p>}
          </article>

          <article className="admin-panel session-guidance-card">
            <div><CheckCircle2 size={20} /><strong>Khuyến nghị vận hành</strong></div>
            <p>Thu hồi phiên không có IP, phiên từ thiết bị công cộng hoặc phiên không còn sử dụng. Backend sẽ xử lý bằng endpoint revoke session.</p>
          </article>
        </aside>
      </section>
    </section>
  );
}
