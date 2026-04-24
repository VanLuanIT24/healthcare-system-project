import { useEffect, useMemo, useState } from 'react';
import { getAuditLogs } from '../systemApi';
import { formatDateTime, formatNumber, getActionLabel, getInitials } from '../systemUi';

const PAGE_SIZE = 10;

function getModuleLabel(action = '') {
  const root = String(action || '').split('.')[0];
  const map = {
    auth: 'Hệ thống',
    department: 'Khoa phòng',
    staff: 'Nhân sự',
    role: 'Vai trò',
    permission: 'Phân quyền',
    patient: 'Bệnh nhân',
    schedule: 'Lịch',
    appointment: 'Lịch hẹn',
  };

  return map[root] || root || 'Khác';
}

function getModuleTone(action = '') {
  const root = String(action || '').split('.')[0];
  const map = {
    auth: 'slate',
    department: 'blue',
    staff: 'teal',
    role: 'violet',
    permission: 'indigo',
    patient: 'amber',
    schedule: 'blue',
    appointment: 'teal',
  };

  return map[root] || 'slate';
}

function getActorDisplay(item) {
  if (item.metadata?.login) return item.metadata.login;
  if (item.actor_type === 'system') return 'Tự động hệ thống';
  return `${item.actor_type || 'system'} • ${String(item.actor_id || 'N/A').slice(-6)}`;
}

function getActorRole(item) {
  if (item.actor_type === 'staff') return 'Quản trị viên cấp cao';
  if (item.actor_type === 'patient') return 'Cổng bệnh nhân';
  if (item.actor_type === 'system') return 'Tác vụ tự động';
  return 'Sự kiện hệ thống';
}

function getStatusInfo(status = '') {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') return { label: 'Thành công', tone: 'success' };
  if (normalized === 'failed' || normalized === 'failure') return { label: 'Cảnh báo', tone: 'warning' };
  return { label: status || 'Khác', tone: 'neutral' };
}

function getActionDotTone(action = '') {
  const normalized = String(action || '').toLowerCase();
  if (normalized.includes('create')) return 'green';
  if (normalized.includes('assign') || normalized.includes('grant')) return 'blue';
  if (normalized.includes('fail') || normalized.includes('delete') || normalized.includes('revoke')) return 'red';
  if (normalized.includes('update') || normalized.includes('sync') || normalized.includes('change')) return 'amber';
  return 'slate';
}

function getTimeWindowDate(range) {
  const now = new Date();
  const days = Number(range || 7);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState({ keyword: '', module: '', action: '', range: '7' });
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  async function loadData() {
    setError('');
    const data = await getAuditLogs('limit=120');
    setItems(
      (data?.items || []).map((item) => ({
        ...item,
        actor_display: getActorDisplay(item),
        actor_role: getActorRole(item),
        module_label: getModuleLabel(item.action),
        module_tone: getModuleTone(item.action),
      })),
    );
  }

  useEffect(() => {
    loadData().catch((loadError) => setError(loadError.message));
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (filters.keyword && !JSON.stringify(item).toLowerCase().includes(filters.keyword.toLowerCase())) return false;
        if (filters.module && getModuleLabel(item.action) !== filters.module) return false;
        if (filters.action && !String(item.action || '').toLowerCase().includes(filters.action.toLowerCase())) return false;
        if (item.created_at && new Date(item.created_at) < getTimeWindowDate(filters.range)) return false;
        return true;
      }),
    [filters, items],
  );

  const stats = useMemo(() => {
    const createCount = filtered.filter((item) => /(create)/i.test(item.action || '')).length;
    const updateCount = filtered.filter((item) => /(update|sync|change)/i.test(item.action || '')).length;
    const securityAlerts = filtered.filter((item) => /(failed|failure)/i.test(item.status || '') || /(password|login|session)/i.test(item.action || '')).length;

    return [
      { label: 'Tổng số bản ghi', value: formatNumber(filtered.length), icon: '◫', tone: 'indigo', note: '+12% so với tháng trước' },
      { label: 'Hành động tạo mới', value: formatNumber(createCount), icon: '⊕', tone: 'green', note: 'Trong 24 giờ qua' },
      { label: 'Cập nhật hệ thống', value: formatNumber(updateCount), icon: '◔', tone: 'blue', note: 'Dữ liệu đồng bộ thành công' },
      { label: 'Cảnh báo bảo mật', value: formatNumber(securityAlerts), icon: '⛨', tone: 'red', note: securityAlerts > 0 ? `${Math.min(securityAlerts, 2)} yêu cầu cần xử lý ngay` : 'Không có cảnh báo mới' },
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

  useEffect(() => {
    if (!selected && filtered[0]) {
      setSelected(filtered[0]);
    }
  }, [filtered, selected]);

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
    <section className="role-page system-admin-page audit-logs-page">
      <section className="role-hero audit-logs-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">Admin / Hệ thống / Nhật ký kiểm toán</p>
          <h1>Nhật ký hệ thống</h1>
          <p>Theo dõi các hoạt động quản trị, thay đổi cấu hình và bảo mật toàn hệ thống.</p>
        </div>
        <div className="role-hero__actions">
          <button type="button" className="staff-button staff-button--ghost audit-logs-button" onClick={() => loadData().catch((loadError) => setError(loadError.message))}>⟳ Làm mới</button>
          <button type="button" className="staff-button staff-button--primary audit-logs-button">⇩ Xuất báo cáo</button>
        </div>
      </section>

      <section className="role-stats audit-logs-stats">
        {stats.map((item) => (
          <article key={item.label} className={`admin-metric-card admin-metric-card--${item.tone} audit-logs-stat`}>
            <div className="admin-metric-card__top">
              <span className="admin-metric-card__icon">{item.icon}</span>
            </div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </section>

      <section className="admin-panel system-filter-panel audit-logs-filter-panel">
        <div className="audit-logs-filter-grid">
          <label className="admin-search role-filters__search">
            <span>⌕</span>
            <input value={filters.keyword} onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))} placeholder="Tìm người thao tác, đối tượng..." />
          </label>
          <label className="role-filter-chip audit-logs-select">
            <select value={filters.module} onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}>
                  <option value="">Tất cả module</option>
              <option value="Nhân sự">Nhân sự</option>
              <option value="Vai trò">Vai trò</option>
              <option value="Khoa phòng">Khoa phòng</option>
              <option value="Hệ thống">Hệ thống</option>
              <option value="Bệnh nhân">Bệnh nhân</option>
            </select>
          </label>
          <label className="role-filter-chip audit-logs-select">
            <select value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}>
              <option value="">Mọi hành động</option>
              <option value="create">Tạo mới</option>
              <option value="update">Cập nhật</option>
              <option value="assign">Gán quyền</option>
              <option value="login">Đăng nhập</option>
              <option value="delete">Xóa</option>
            </select>
          </label>
          <label className="role-filter-chip audit-logs-select">
            <select value={filters.range} onChange={(event) => setFilters((current) => ({ ...current, range: event.target.value }))}>
              <option value="7">7 ngày qua</option>
              <option value="14">14 ngày qua</option>
              <option value="30">30 ngày qua</option>
              <option value="90">90 ngày qua</option>
            </select>
          </label>
        </div>
      </section>

      <section className="system-split-grid system-split-grid--wide audit-logs-workspace">
        <article className="admin-panel admin-panel--table audit-logs-table-panel">
          <div className="audit-logs-table">
            <div className="audit-logs-table__head">
              <span>Thời gian</span>
              <span>Người thao tác</span>
              <span>Module</span>
              <span>Hành động</span>
              <span>Đối tượng</span>
              <span>Trạng thái</span>
              <span>Chi tiết</span>
            </div>
            {pagedItems.map((item, index) => {
              const status = getStatusInfo(item.status);
              return (
                <article key={`${item._id || index}`} className="audit-logs-row">
                  <div className="audit-logs-row__time">
                    <strong>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(item.created_at))}</strong>
                    <small>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(item.created_at))}</small>
                  </div>
                  <div className="audit-logs-row__actor">
                    <span className="audit-logs-row__avatar">{getInitials(item.actor_display)}</span>
                    <div>
                      <strong>{item.actor_display}</strong>
                      <small>{item.actor_role}</small>
                    </div>
                  </div>
                  <span className={`role-chip role-chip--${item.module_tone}`}>{item.module_label}</span>
                  <div className="audit-logs-row__action">
                    <span className={`audit-logs-row__dot audit-logs-row__dot--${getActionDotTone(item.action)}`} />
                    <strong>{getActionLabel(item.action)}</strong>
                  </div>
                  <div className="audit-logs-row__target">
                    <strong>{item.target_type || 'system'}</strong>
                    <small>{item.target_id || item.message || 'N/A'}</small>
                  </div>
                  <span className={`audit-logs-status audit-logs-status--${status.tone}`}>{status.label}</span>
                  <button type="button" className="audit-logs-row__action-button" onClick={() => setSelected(item)} aria-label="Xem chi tiết">
                    ◉
                  </button>
                </article>
              );
            })}
          </div>

          <div className="audit-logs-table__footer">
            <p>Hiển thị {filtered.length === 0 ? '0' : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filtered.length)}`} trên {formatNumber(filtered.length)} bản ghi</p>
            <div className="role-pagination audit-logs-pagination">
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
        </article>

        <aside className="admin-panel audit-logs-drawer">
          <div className="admin-panel__heading"><h2>Chi tiết nhật ký</h2></div>
          {selected ? (
            <div className="audit-logs-drawer__stack">
              <div className="audit-logs-drawer__hero">
                <span className="audit-logs-row__avatar">{getInitials(selected.actor_display || getActorDisplay(selected))}</span>
                <div>
                  <strong>{selected.actor_display || getActorDisplay(selected)}</strong>
                  <small>{selected.actor_role || getActorRole(selected)}</small>
                </div>
              </div>
              <div className="system-stat-list">
                <div><span>Người thao tác</span><strong>{selected.actor_type} • {selected.actor_id || 'N/A'}</strong></div>
                <div><span>Hành động</span><strong>{selected.action}</strong></div>
                <div><span>Module</span><strong>{getModuleLabel(selected.action)}</strong></div>
                <div><span>Đối tượng</span><strong>{selected.target_type || 'system'} • {selected.target_id || 'N/A'}</strong></div>
                <div><span>IP</span><strong>{selected.ip_address || 'N/A'}</strong></div>
                <div><span>Thiết bị / trình duyệt</span><strong>{selected.user_agent || 'N/A'}</strong></div>
                <div><span>Thời điểm</span><strong>{formatDateTime(selected.created_at)}</strong></div>
                <div><span>Mô tả</span><strong>{selected.message || 'Không có mô tả bổ sung'}</strong></div>
              </div>
            </div>
          ) : (
            <p className="permission-side-empty">Chọn một nhật ký để xem người thao tác, đối tượng, IP và metadata.</p>
          )}
          {error ? <p className="form-message error">{error}</p> : null}
        </aside>
      </section>
    </section>
  );
}
