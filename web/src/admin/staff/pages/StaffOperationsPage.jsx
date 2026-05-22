import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  FileClock,
  KeyRound,
  LockKeyhole,
  LogOut,
  MonitorCheck,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  forceLogoutStaff,
  getDepartments,
  getGlobalStaffLoginHistory,
  getStaffAccounts,
  getStaffDependencies,
  getStaffRiskProfile,
  getStaffSessions,
  requireStaffPasswordChange,
  resetStaffPassword,
  revokeStaffSession,
  transferStaffDepartment,
} from '../staffApi';
import {
  formatCompactDate,
  formatDateTime,
  formatNumber,
  getInitials,
  getRiskLabel,
  getRiskTone,
  getStatusLabel,
  getStatusTone,
} from '../staffUi';

const MODE_COPY = {
  transfer: {
    eyebrow: 'Workforce movement',
    title: 'Chuyển khoa / điều chuyển',
    subtitle: 'Kiểm tra blocker vận hành, session, rủi ro và điều chuyển nhân sự sang khoa/phòng mới.',
    icon: RefreshCw,
    tone: 'cyan',
  },
  passwordReset: {
    eyebrow: 'Credential recovery',
    title: 'Reset mật khẩu nhân sự',
    subtitle: 'Đặt lại mật khẩu tạm, bắt đổi mật khẩu lần sau và kiểm tra tín hiệu bảo mật trước khi thao tác.',
    icon: KeyRound,
    tone: 'amber',
  },
  forceLogout: {
    eyebrow: 'Session control',
    title: 'Force logout',
    subtitle: 'Xem phiên đăng nhập active, thu hồi từng phiên hoặc đăng xuất toàn bộ phiên của nhân sự.',
    icon: LogOut,
    tone: 'red',
  },
  loginHistory: {
    eyebrow: 'Access evidence',
    title: 'Lịch sử đăng nhập nhân viên',
    subtitle: 'Theo dõi toàn hệ thống các login, logout, refresh token và sự kiện thu hồi phiên của nhân sự.',
    icon: FileClock,
    tone: 'blue',
  },
};

function userIdOf(staff) {
  return staff?.user_id || staff?._id || staff?.id || '';
}

function departmentIdOf(department) {
  return department?.department_id || department?._id || department?.id || '';
}

function departmentNameOf(staff, departments = []) {
  if (staff?.department?.department_name) return staff.department.department_name;
  if (staff?.department_name) return staff.department_name;
  const departmentId = staff?.department_id || staff?.department?.department_id || staff?.department?._id;
  return departments.find((item) => departmentIdOf(item) === String(departmentId || ''))?.department_name || 'Chưa có khoa/phòng';
}

function normalizeStaff(item) {
  const source = item?.user || item || {};
  return {
    ...source,
    user_id: String(userIdOf(source)),
    full_name: source.full_name || source.name || source.username || 'Nhân sự',
    username: source.username || '',
    email: source.email || '',
    employee_code: source.employee_code || '',
    department_id: source.department_id || source.department?.department_id || source.department?._id || '',
    department: source.department || item?.department || null,
    status: source.status || 'active',
    last_login_at: source.last_login_at || null,
    must_change_password: Boolean(source.must_change_password),
    active_session_count: source.active_session_count || item?.signals?.active_session_count || 0,
  };
}

function buildQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  return query.toString();
}

function StatusBadge({ status }) {
  return (
    <span className={`staff-status-dot staff-status-dot--${getStatusTone(status)}`}>
      <span />
      {getStatusLabel(status)}
    </span>
  );
}

function RiskBadge({ risk }) {
  const level = risk?.risk_level || 'low';
  return <span className={`staff-risk-chip staff-risk-chip--${getRiskTone(level)}`}>{getRiskLabel(level)}</span>;
}

function StaffIdentityCard({ staff, departments, risk }) {
  if (!staff) {
    return (
      <div className="staff-ops-empty">
        <UserRound size={26} strokeWidth={2.25} />
        <strong>Chưa chọn nhân sự</strong>
        <span>Chọn một tài khoản để xem context vận hành trước khi thao tác.</span>
      </div>
    );
  }

  return (
    <article className="staff-ops-identity-card">
      <div className="admin-avatar">{getInitials(staff.full_name || staff.username)}</div>
      <div>
        <span>Nhân sự đang xử lý</span>
        <h2>{staff.full_name || staff.username}</h2>
        <p>{staff.email || staff.username} · {staff.employee_code || 'Chưa có mã NV'}</p>
        <div className="staff-ops-chip-row">
          <StatusBadge status={staff.status} />
          <span className="staff-ops-soft-chip">
            <Building2 size={13} strokeWidth={2.3} />
            {departmentNameOf(staff, departments)}
          </span>
          <RiskBadge risk={risk} />
        </div>
      </div>
    </article>
  );
}

function StaffPicker({ staffItems, departments, selectedId, onSelect, search, setSearch }) {
  const visibleStaff = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return staffItems;
    return staffItems.filter((item) => [
      item.full_name,
      item.username,
      item.email,
      item.employee_code,
      departmentNameOf(item, departments),
    ].join(' ').toLowerCase().includes(keyword));
  }, [departments, search, staffItems]);

  return (
    <section className="staff-ops-panel staff-ops-picker">
      <div className="staff-ops-panel__head">
        <div>
          <span>Staff directory</span>
          <strong>Chọn nhân sự</strong>
        </div>
        <small>{formatNumber(visibleStaff.length)} tài khoản</small>
      </div>

      <label className="staff-command-search">
        <Search size={17} strokeWidth={2.2} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm tên, username, email, mã NV..."
        />
      </label>

      <div className="staff-ops-staff-list">
        {visibleStaff.map((staff) => (
          <button
            key={staff.user_id}
            type="button"
            className={`staff-ops-staff-item${selectedId === staff.user_id ? ' is-active' : ''}`}
            onClick={() => onSelect(staff.user_id)}
          >
            <div className="admin-avatar">{getInitials(staff.full_name || staff.username)}</div>
            <span>
              <strong>{staff.full_name || staff.username}</strong>
              <small>{departmentNameOf(staff, departments)} · {staff.employee_code || staff.username}</small>
            </span>
            <StatusBadge status={staff.status} />
          </button>
        ))}
      </div>
    </section>
  );
}

function ContextPanel({ dependencies, sessions, risk, loading }) {
  const blockers = dependencies?.blocking_reasons || [];
  const sessionItems = sessions?.items || [];

  return (
    <section className="staff-ops-panel">
      <div className="staff-ops-panel__head">
        <div>
          <span>Runtime context</span>
          <strong>Phụ thuộc, session, risk</strong>
        </div>
        {loading ? <small>Đang tải...</small> : null}
      </div>

      <div className="staff-ops-context-grid">
        <div className={`staff-dependency-verdict ${dependencies?.can_transfer ? 'is-clear' : 'is-blocked'}`}>
          <span>Transfer readiness</span>
          <strong>{dependencies?.can_transfer ? 'Có thể chuyển' : 'Cần xử lý blocker'}</strong>
        </div>
        <div className="staff-dependency-verdict">
          <span>Active sessions</span>
          <strong>{formatNumber(sessions?.active_count || 0)}</strong>
        </div>
        <div className="staff-dependency-verdict">
          <span>Risk score</span>
          <strong>{formatNumber(risk?.risk_score || 0)}</strong>
        </div>
      </div>

      <div className="staff-ops-mini-section">
        <h3>Blockers</h3>
        {blockers.length ? (
          <ul className="staff-ops-list">
            {blockers.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <p className="staff-muted-text">Không có blocker nghiệp vụ từ dependency check hiện tại.</p>
        )}
      </div>

      <div className="staff-ops-mini-section">
        <h3>Risk reasons</h3>
        {risk?.reasons?.length ? (
          <ul className="staff-ops-list">
            {risk.reasons.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <p className="staff-muted-text">Chưa có dữ liệu risk profile.</p>
        )}
      </div>

      <div className="staff-ops-mini-section">
        <h3>Phiên gần đây</h3>
        {sessionItems.length ? (
          <div className="staff-inspector-stack">
            {sessionItems.slice(0, 3).map((session) => (
              <div key={session.session_id} className="staff-session-row">
                <div>
                  <strong>{session.device_name || session.browser || 'Thiết bị không rõ'}</strong>
                  <small>{session.last_ip || session.ip_address || 'Không có IP'} · {formatDateTime(session.last_used_at || session.created_at)}</small>
                </div>
                <span className={session.is_active ? 'is-active' : ''}>{session.is_active ? 'active' : 'revoked'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="staff-muted-text">Không có phiên đăng nhập được ghi nhận.</p>
        )}
      </div>
    </section>
  );
}

function TransferConsole({ selectedStaff, departments, dependencies, onSubmit, submitting }) {
  const [departmentId, setDepartmentId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    setDepartmentId('');
    setReason('');
  }, [selectedStaff?.user_id]);

  const targetDepartment = departments.find((item) => departmentIdOf(item) === departmentId);
  const canSubmit = Boolean(selectedStaff?.user_id && departmentId && departmentId !== String(selectedStaff.department_id || ''));

  return (
    <section className="staff-ops-panel staff-ops-action-panel">
      <div className="staff-ops-panel__head">
        <div>
          <span>Transfer wizard</span>
          <strong>Xác nhận điều chuyển</strong>
        </div>
        <RefreshCw size={18} strokeWidth={2.3} />
      </div>

      <div className="staff-ops-form-grid">
        <label>
          <span>Khoa/phòng đích</span>
          <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">Chọn khoa/phòng active</option>
            {departments.map((department) => (
              <option key={departmentIdOf(department)} value={departmentIdOf(department)}>
                {department.department_name} ({department.department_code || 'no-code'})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Lý do điều chuyển</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Điều phối nhân sự sang khoa Nội tổng hợp từ ngày..."
          />
        </label>
      </div>

      <div className="staff-ops-impact">
        <strong>Impact preview</strong>
        <span>Khoa hiện tại: {selectedStaff ? selectedStaff.department?.department_name || selectedStaff.department_name || 'Chưa rõ' : 'Chưa chọn'}</span>
        <span>Khoa đích: {targetDepartment?.department_name || 'Chưa chọn'}</span>
        <span>Phiên đăng nhập sẽ bị backend thu hồi sau khi đổi department.</span>
        {dependencies?.blocking_reasons?.length ? <em>{dependencies.blocking_reasons.length} blocker cần xử lý trước.</em> : null}
      </div>

      <button
        type="button"
        className="staff-button staff-button--primary"
        disabled={!canSubmit || submitting}
        onClick={() => onSubmit({ department_id: departmentId, reason })}
      >
        <CheckCircle2 size={16} strokeWidth={2.25} />
        <span>Thực hiện điều chuyển</span>
      </button>
    </section>
  );
}

function PasswordResetConsole({ selectedStaff, onReset, onRequireChange, submitting, result }) {
  const [password, setPassword] = useState('');
  const [mustChangePassword, setMustChangePassword] = useState(true);

  useEffect(() => {
    setPassword('');
    setMustChangePassword(true);
  }, [selectedStaff?.user_id]);

  return (
    <section className="staff-ops-panel staff-ops-action-panel">
      <div className="staff-ops-panel__head">
        <div>
          <span>Password control</span>
          <strong>Reset mật khẩu</strong>
        </div>
        <KeyRound size={18} strokeWidth={2.3} />
      </div>

      <div className="staff-ops-form-grid">
        <label>
          <span>Mật khẩu mới</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Để trống để backend tự sinh mật khẩu mạnh"
          />
        </label>
        <label className="staff-ops-check">
          <input
            type="checkbox"
            checked={mustChangePassword}
            onChange={(event) => setMustChangePassword(event.target.checked)}
          />
          <span>Bắt đổi mật khẩu ở lần đăng nhập tiếp theo</span>
        </label>
      </div>

      <div className="staff-ops-impact">
        <strong>Security impact</strong>
        <span>Failed login counter sẽ được reset nếu backend reset thành công.</span>
        <span>Các phiên hiện tại bị vô hiệu hóa theo logic reset password hiện có.</span>
        <span>Mật khẩu tạm chỉ hiển thị một lần nếu backend tự sinh.</span>
      </div>

      {result?.temporary_password ? (
        <div className="staff-ops-secret">
          <span>Mật khẩu tạm</span>
          <strong>{result.temporary_password}</strong>
        </div>
      ) : null}

      <div className="staff-ops-button-row">
        <button
          type="button"
          className="staff-button staff-button--primary"
          disabled={!selectedStaff?.user_id || submitting}
          onClick={() => onReset({ new_password: password || undefined, must_change_password: mustChangePassword })}
        >
          <LockKeyhole size={16} strokeWidth={2.25} />
          <span>Reset mật khẩu</span>
        </button>
        <button
          type="button"
          className="staff-button staff-button--ghost"
          disabled={!selectedStaff?.user_id || submitting}
          onClick={onRequireChange}
        >
          <KeyRound size={16} strokeWidth={2.25} />
          <span>Chỉ bắt đổi mật khẩu</span>
        </button>
      </div>
    </section>
  );
}

function ForceLogoutConsole({ selectedStaff, sessions, onForceLogout, onRevokeSession, submitting }) {
  const sessionItems = sessions?.items || [];

  return (
    <section className="staff-ops-panel staff-ops-action-panel">
      <div className="staff-ops-panel__head">
        <div>
          <span>Session revocation</span>
          <strong>Thu hồi phiên đăng nhập</strong>
        </div>
        <MonitorCheck size={18} strokeWidth={2.3} />
      </div>

      <div className="staff-ops-impact">
        <strong>Active sessions: {formatNumber(sessions?.active_count || 0)}</strong>
        <span>Force logout sẽ revoke toàn bộ refresh token family của nhân sự.</span>
        <span>Realtime event AUTH_FORCE_LOGOUT được backend phát cho client liên quan.</span>
      </div>

      <div className="staff-inspector-stack">
        {sessionItems.length ? sessionItems.map((session) => (
          <div key={session.session_id} className="staff-session-row">
            <div>
              <strong>{session.device_name || session.browser || 'Thiết bị không rõ'}</strong>
              <small>{session.last_ip || session.ip_address || 'Không có IP'} · {session.browser || 'browser n/a'} · {session.os || 'os n/a'}</small>
              <small>Last used: {formatDateTime(session.last_used_at || session.created_at)}</small>
            </div>
            <div className="staff-ops-session-actions">
              <span className={session.is_active ? 'is-active' : ''}>{session.is_active ? 'active' : 'revoked'}</span>
              <button
                type="button"
                className="staff-icon-button"
                title="Thu hồi phiên này"
                disabled={!session.is_active || submitting}
                onClick={() => onRevokeSession(session.session_id)}
              >
                <LogOut size={15} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        )) : <p className="staff-muted-text">Không có session để hiển thị.</p>}
      </div>

      <button
        type="button"
        className="staff-button staff-button--danger"
        disabled={!selectedStaff?.user_id || submitting}
        onClick={onForceLogout}
      >
        <LogOut size={16} strokeWidth={2.25} />
        <span>Force logout toàn bộ phiên</span>
      </button>
    </section>
  );
}

function LoginHistoryConsole({ departments }) {
  const [filters, setFilters] = useState({ keyword: '', department_id: '', action: '', status: '', ip: '' });
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState({ items: [], pagination: { page: 1, total_pages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadHistory() {
      setLoading(true);
      setError('');
      try {
        const query = buildQuery({ ...filters, page, limit: 25 });
        const result = await getGlobalStaffLoginHistory(query);
        if (!active) return;
        setHistory(result || { items: [], pagination: { page: 1, total_pages: 1, total: 0 } });
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadHistory();
    return () => {
      active = false;
    };
  }, [filters, page]);

  const totalPages = Math.max(history.pagination?.total_pages || 1, 1);

  return (
    <section className="staff-ops-login-panel">
      <div className="staff-command-filters">
        <label className="staff-command-search">
          <Search size={17} strokeWidth={2.2} />
          <input
            type="search"
            value={filters.keyword}
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({ ...current, keyword: event.target.value }));
            }}
            placeholder="Tìm nhân sự trong login history..."
          />
        </label>

        <div className="staff-command-filter-grid">
          <label>
            <Building2 size={15} strokeWidth={2.2} />
            <select value={filters.department_id} onChange={(event) => {
              setPage(1);
              setFilters((current) => ({ ...current, department_id: event.target.value }));
            }}>
              <option value="">Tất cả khoa/phòng</option>
              {departments.map((department) => (
                <option key={departmentIdOf(department)} value={departmentIdOf(department)}>
                  {department.department_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FileClock size={15} strokeWidth={2.2} />
            <select value={filters.action} onChange={(event) => {
              setPage(1);
              setFilters((current) => ({ ...current, action: event.target.value }));
            }}>
              <option value="">Mọi action</option>
              <option value="auth.login">auth.login</option>
              <option value="auth.login_failed">auth.login_failed</option>
              <option value="auth.logout">auth.logout</option>
              <option value="auth.refresh_token">auth.refresh_token</option>
              <option value="auth.session.revoke">auth.session.revoke</option>
            </select>
          </label>
          <label>
            <CheckCircle2 size={15} strokeWidth={2.2} />
            <select value={filters.status} onChange={(event) => {
              setPage(1);
              setFilters((current) => ({ ...current, status: event.target.value }));
            }}>
              <option value="">Mọi trạng thái</option>
              <option value="success">success</option>
              <option value="failure">failure</option>
            </select>
          </label>
          <label>
            <MonitorCheck size={15} strokeWidth={2.2} />
            <input
              value={filters.ip}
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({ ...current, ip: event.target.value }));
              }}
              placeholder="Lọc theo IP"
            />
          </label>
        </div>
      </div>

      <section className="staff-command-table-panel">
        {error ? <p className="form-message error">{error}</p> : null}
        <div className="staff-ops-history-table">
          <div className="staff-ops-history-table__head">
            <span>Thời gian</span>
            <span>Nhân sự</span>
            <span>Action</span>
            <span>IP / User agent</span>
            <span>Status</span>
          </div>
          {history.items?.length ? history.items.map((item) => (
            <div key={item._id || item.audit_log_id} className="staff-ops-history-table__row">
              <span>
                <strong>{formatDateTime(item.created_at)}</strong>
                <small>{item.request_id || item.session_id || 'No request id'}</small>
              </span>
              <span>
                <strong>{item.actor?.full_name || item.actor?.username || 'Staff actor'}</strong>
                <small>{item.actor?.status || 'unknown'}</small>
              </span>
              <span>{item.action}</span>
              <span>
                <strong>{item.ip_address || 'Không có IP'}</strong>
                <small>{item.user_agent || 'Không có user agent'}</small>
              </span>
              <span className={`staff-risk-chip staff-risk-chip--${item.status === 'success' ? 'low' : 'high'}`}>
                {item.status || 'unknown'}
              </span>
            </div>
          )) : (
            <div className="staff-ops-empty">
              <Clock3 size={24} strokeWidth={2.25} />
              <strong>{loading ? 'Đang tải login history...' : 'Chưa có bản ghi phù hợp'}</strong>
            </div>
          )}
        </div>

        <footer className="staff-pagination">
          <span>Trang {history.pagination?.page || page} / {totalPages} · {formatNumber(history.pagination?.total)} bản ghi</span>
          <div>
            <button type="button" className="staff-button staff-button--ghost" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
              Trước
            </button>
            <button type="button" className="staff-button staff-button--ghost" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>
              Sau
            </button>
          </div>
        </footer>
      </section>
    </section>
  );
}

export function StaffOperationsPage({ mode = 'transfer' }) {
  const copy = MODE_COPY[mode] || MODE_COPY.transfer;
  const HeroIcon = copy.icon;
  const isLoginHistory = mode === 'loginHistory';
  const [staffItems, setStaffItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [context, setContext] = useState({ dependencies: null, sessions: null, risk: null, loading: false });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [passwordResult, setPasswordResult] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadMeta() {
      setLoading(true);
      setError('');
      try {
        const [staffData, departmentsData] = await Promise.all([
          getStaffAccounts('limit=80&sort_by=updated_at'),
          getDepartments('limit=150'),
        ]);
        if (!active) return;
        const normalized = (staffData?.items || []).map(normalizeStaff);
        setStaffItems(normalized);
        setDepartments(departmentsData?.items || []);
        if (!selectedId && normalized[0]) setSelectedId(normalized[0].user_id);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  const selectedStaff = useMemo(() => staffItems.find((item) => item.user_id === selectedId) || null, [selectedId, staffItems]);

  useEffect(() => {
    if (!selectedId || isLoginHistory) return undefined;
    let active = true;
    async function loadContext() {
      setContext((current) => ({ ...current, loading: true }));
      try {
        const [dependencies, sessions, risk] = await Promise.allSettled([
          getStaffDependencies(selectedId),
          getStaffSessions(selectedId, 'limit=8'),
          getStaffRiskProfile(selectedId),
        ]);
        if (!active) return;
        setContext({
          dependencies: dependencies.status === 'fulfilled' ? dependencies.value : null,
          sessions: sessions.status === 'fulfilled' ? sessions.value : null,
          risk: risk.status === 'fulfilled' ? risk.value : null,
          loading: false,
        });
      } catch {
        if (!active) return;
        setContext({ dependencies: null, sessions: null, risk: null, loading: false });
      }
    }
    loadContext();
    return () => {
      active = false;
    };
  }, [isLoginHistory, selectedId]);

  async function reloadContext() {
    if (!selectedId) return;
    const [dependencies, sessions, risk] = await Promise.allSettled([
      getStaffDependencies(selectedId),
      getStaffSessions(selectedId, 'limit=8'),
      getStaffRiskProfile(selectedId),
    ]);
    setContext({
      dependencies: dependencies.status === 'fulfilled' ? dependencies.value : null,
      sessions: sessions.status === 'fulfilled' ? sessions.value : null,
      risk: risk.status === 'fulfilled' ? risk.value : null,
      loading: false,
    });
  }

  async function runAction(action) {
    if (!selectedStaff) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    setPasswordResult(null);
    try {
      if (action.type === 'transfer') {
        await transferStaffDepartment(selectedStaff.user_id, action.payload);
        setMessage('Điều chuyển khoa/phòng thành công. Backend đã bump permission_version và revoke session liên quan.');
      }
      if (action.type === 'reset_password') {
        const result = await resetStaffPassword(selectedStaff.user_id, action.payload);
        setPasswordResult(result);
        setMessage('Reset mật khẩu thành công.');
      }
      if (action.type === 'require_password_change') {
        await requireStaffPasswordChange(selectedStaff.user_id);
        setMessage('Đã yêu cầu nhân sự đổi mật khẩu ở lần đăng nhập tiếp theo.');
      }
      if (action.type === 'force_logout') {
        await forceLogoutStaff(selectedStaff.user_id);
        setMessage('Đã force logout toàn bộ phiên của nhân sự.');
      }
      if (action.type === 'revoke_session') {
        await revokeStaffSession(selectedStaff.user_id, action.sessionId);
        setMessage('Đã thu hồi phiên đăng nhập được chọn.');
      }
      await reloadContext();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className={`staff-command-hero staff-ops-hero staff-ops-hero--${copy.tone}`}>
        <div className="staff-command-hero__copy">
          <span>{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="staff-command-hero__actions">
          <Link to="/admin/staff" className="staff-button staff-button--ghost">
            <UserRound size={16} strokeWidth={2.25} />
            <span>Tất cả nhân sự</span>
          </Link>
          <Link to="/admin/staff/create" className="staff-button staff-button--primary">
            <HeroIcon size={16} strokeWidth={2.25} />
            <span>{copy.title}</span>
          </Link>
        </div>
      </section>

      {message ? (
        <section className="staff-ops-alert staff-ops-alert--success">
          <CheckCircle2 size={18} strokeWidth={2.25} />
          <span>{message}</span>
        </section>
      ) : null}
      {error ? (
        <section className="staff-ops-alert staff-ops-alert--error">
          <AlertTriangle size={18} strokeWidth={2.25} />
          <span>{error}</span>
        </section>
      ) : null}

      {isLoginHistory ? (
        <LoginHistoryConsole departments={departments} />
      ) : (
        <section className="staff-ops-layout">
          <StaffPicker
            staffItems={staffItems}
            departments={departments}
            selectedId={selectedId}
            onSelect={(nextId) => {
              setSelectedId(nextId);
              setPasswordResult(null);
              setMessage('');
              setError('');
            }}
            search={staffSearch}
            setSearch={setStaffSearch}
          />

          <main className="staff-ops-main">
            <StaffIdentityCard staff={selectedStaff} departments={departments} risk={context.risk} />

            {loading ? (
              <section className="staff-ops-panel">
                <p className="staff-muted-text">Đang tải dữ liệu nhân sự...</p>
              </section>
            ) : null}

            {mode === 'transfer' ? (
              <TransferConsole
                selectedStaff={selectedStaff}
                departments={departments}
                dependencies={context.dependencies}
                submitting={submitting}
                onSubmit={(payload) => runAction({ type: 'transfer', payload })}
              />
            ) : null}

            {mode === 'passwordReset' ? (
              <PasswordResetConsole
                selectedStaff={selectedStaff}
                submitting={submitting}
                result={passwordResult}
                onReset={(payload) => runAction({ type: 'reset_password', payload })}
                onRequireChange={() => runAction({ type: 'require_password_change' })}
              />
            ) : null}

            {mode === 'forceLogout' ? (
              <ForceLogoutConsole
                selectedStaff={selectedStaff}
                sessions={context.sessions}
                submitting={submitting}
                onForceLogout={() => runAction({ type: 'force_logout' })}
                onRevokeSession={(sessionId) => runAction({ type: 'revoke_session', sessionId })}
              />
            ) : null}
          </main>

          <ContextPanel
            dependencies={context.dependencies}
            sessions={context.sessions}
            risk={context.risk}
            loading={context.loading}
          />
        </section>
      )}
    </>
  );
}
