import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileSearch,
  FileText,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { billingPriceListAPI, getPriceListErrorMessage } from './billingPriceListApi';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

const SERVICE_TYPE_LABELS = {
  consultation: 'Khám bệnh',
  lab: 'Xét nghiệm',
  imaging: 'CĐHA',
  procedure: 'Thủ thuật',
  pharmacy: 'Nhà thuốc',
  room: 'Phòng/giường',
  nursing: 'Điều dưỡng',
  other: 'Khác',
};

const STATUS_LABELS = {
  active: 'Đang hiệu lực',
  inactive: 'Tạm ngừng',
  retired: 'Ngừng sử dụng',
  draft: 'Nháp',
  pending_approval: 'Chờ duyệt',
  expired: 'Hết hiệu lực',
  cancelled: 'Đã hủy',
};

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function idOf(value) {
  if (!value) return null;
  if (typeof value === 'object') return value._id || value.id || null;
  return value;
}

function departmentName(row = {}) {
  const department = row.department_id || row.department || {};
  return department.department_name || department.department_code || row.department_name || 'Không có khoa';
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function statusTone(status = '') {
  if (['active'].includes(status)) return 'success';
  if (['retired', 'cancelled'].includes(status)) return 'danger';
  if (['inactive', 'pending_approval', 'expired'].includes(status)) return 'warning';
  return 'info';
}

function StatusBadge({ status }) {
  return <span className={`bo-status bo-status--${statusTone(status)}`}>{STATUS_LABELS[status] || status || '-'}</span>;
}

function TypeBadge({ type }) {
  return <span className="pl-type">{SERVICE_TYPE_LABELS[type] || type || '-'}</span>;
}

function BillableBadge({ value }) {
  return <span className={value ? 'pl-billable is-on' : 'pl-billable'}>{value ? 'Billable' : 'Non-billable'}</span>;
}

function RiskFlags({ flags = [] }) {
  if (!flags.length) return <span className="pl-risk is-ok"><BadgeCheck size={14} />Ổn</span>;
  const important = flags.slice(0, 2).join(', ');
  const tone = flags.some((flag) => ['zero_price', 'expired_but_active', 'has_charges'].includes(flag)) ? 'danger' : 'warning';
  return <span className={`pl-risk is-${tone}`}><ShieldAlert size={14} />{important}</span>;
}

function EmptyState({ label = 'Chưa có dữ liệu.', compact = false }) {
  return (
    <div className={compact ? 'bo-empty bo-empty--compact' : 'bo-empty'}>
      <FileSearch size={compact ? 18 : 28} />
      <span>{label}</span>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, meta, money = false, tone = 'blue' }) {
  return (
    <article className={`bo-kpi bo-kpi--${tone}`}>
      <div className="bo-kpi__icon" aria-hidden="true"><Icon size={20} /></div>
      <div className="bo-kpi__body">
        <span>{label}</span>
        <strong>{money ? formatMoney(value) : formatNumber(value)}</strong>
        <small>{meta}</small>
      </div>
    </article>
  );
}

function usePriceResource(loader, params = {}, enabled = true) {
  const [state, setState] = useState({ data: null, loading: Boolean(enabled), error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: '' });
      return undefined;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loader(params)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error: getPriceListErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [loader, key, version, enabled]);

  return { ...state, refresh: () => setVersion((current) => current + 1) };
}

const loadSummary = (params) => billingPriceListAPI.summary(params);
const loadServices = (params) => billingPriceListAPI.services(params);
const loadEffective = (params) => billingPriceListAPI.effective(params);
const loadDepartmentSummary = (params) => billingPriceListAPI.departmentSummary(params);

function PriceHeader({ title, kicker, loading, onRefresh, onCreate, actions }) {
  return (
    <header className="rv-page-header pl-header">
      <div>
        <span>{kicker}</span>
        <h1>{title}</h1>
        <p>Quản trị danh mục dịch vụ, hiệu lực giá, usage từ charge/invoice snapshot, version giá và rủi ro vận hành.</p>
      </div>
      <div className="rv-header-actions">
        {actions}
        {onCreate && (
          <button type="button" className="pl-primary" onClick={onCreate}>
            <Plus size={17} />
            Tạo dịch vụ
          </button>
        )}
        <button type="button" className="bo-icon-action" onClick={onRefresh} aria-label="Tải lại">
          {loading ? <Loader2 size={17} className="bo-spin" /> : <RefreshCcw size={17} />}
        </button>
      </div>
    </header>
  );
}

function PriceKpis({ summary = {} }) {
  return (
    <section className="bo-kpi-grid rv-kpi-grid">
      <KpiCard icon={FileText} label="Tổng dịch vụ" value={summary.total} meta="ServiceCatalog" tone="blue" />
      <KpiCard icon={BadgeCheck} label="Đang hiệu lực" value={summary.active} meta={`${formatNumber(summary.billable)} billable`} tone="green" />
      <KpiCard icon={Ban} label="Ngừng sử dụng" value={summary.retired} meta={`${formatNumber(summary.inactive)} inactive`} tone="rose" />
      <KpiCard icon={AlertTriangle} label="Giá = 0" value={summary.zero_price} meta="Cần kiểm tra" tone="danger" />
      <KpiCard icon={Clock3} label="Sắp hết hiệu lực" value={summary.expiring_soon} meta="Trong 30 ngày" tone="amber" />
      <KpiCard icon={Activity} label="Có charge" value={summary.with_charges} meta={`${formatNumber(summary.without_charges)} chưa phát sinh`} tone="violet" />
      <KpiCard icon={CheckCircle2} label="Không tính phí" value={summary.non_billable} meta="Non-billable" tone="amber" />
      <KpiCard icon={FileSearch} label="Loại dịch vụ" value={summary.by_service_type?.length || 0} meta="Nhóm giá" tone="blue" />
    </section>
  );
}

function PriceFilters({ filters, setFilters, inactiveMode = false }) {
  return (
    <section className="bo-command-bar rv-command-bar" aria-label="Bộ lọc bảng giá">
      <div className="bo-command-bar__filters">
        <label className="bo-command-bar__search">
          <Search size={16} />
          <input
            value={filters.q || ''}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            placeholder="Tìm mã dịch vụ, tên dịch vụ, mô tả"
          />
        </label>
        <label>
          <span>Loại dịch vụ</span>
          <select value={filters.service_type || ''} onChange={(event) => setFilters((current) => ({ ...current, service_type: event.target.value }))}>
            <option value="">Tất cả</option>
            {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">{inactiveMode ? 'Inactive + retired' : 'Tất cả'}</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="retired">Retired</option>
          </select>
        </label>
        <label>
          <span>Billable</span>
          <select value={filters.is_billable || ''} onChange={(event) => setFilters((current) => ({ ...current, is_billable: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="true">Có tính phí</option>
            <option value="false">Không tính phí</option>
          </select>
        </label>
        <label>
          <span>Ngày hiệu lực</span>
          <input type="date" value={filters.effective_date || ''} onChange={(event) => setFilters((current) => ({ ...current, effective_date: event.target.value }))} />
        </label>
        <label>
          <span>Giá từ</span>
          <input type="number" min="0" value={filters.price_min || ''} onChange={(event) => setFilters((current) => ({ ...current, price_min: event.target.value }))} />
        </label>
      </div>
      <div className="bo-command-bar__actions">
        <button type="button" onClick={() => setFilters({ limit: 50 })}><SlidersHorizontal size={16} />Reset</button>
        <button type="button"><Download size={16} />Export</button>
      </div>
    </section>
  );
}

function ServiceTable({ items = [], loading, selected, onSelect, onEdit, onPrice, onRetire, onReactivate }) {
  if (loading) return <EmptyState label="Đang tải bảng giá..." />;
  if (!items.length) return <EmptyState label="Không có dịch vụ phù hợp bộ lọc." />;
  return (
    <div className="bo-table-wrap rv-table-wrap">
      <table className="bo-table rv-table pl-table">
        <thead>
          <tr>
            <th>Mã / Tên</th>
            <th>Loại</th>
            <th>Khoa</th>
            <th>Đơn vị</th>
            <th>Đơn giá</th>
            <th>Billable</th>
            <th>Hiệu lực</th>
            <th>Status</th>
            <th>Usage</th>
            <th>Risk</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={idOf(row)} className={idOf(row) === idOf(selected) ? 'is-selected' : ''} onClick={() => onSelect(row)}>
              <td><strong>{row.service_code}</strong><small>{row.service_name}</small></td>
              <td><TypeBadge type={row.service_type} /></td>
              <td>{departmentName(row)}</td>
              <td>{row.unit || '-'}</td>
              <td><strong>{formatMoney(row.unit_price)}</strong><small>{row.currency || 'VND'}</small></td>
              <td><BillableBadge value={row.is_billable} /></td>
              <td><small>{formatDate(row.effective_from)} → {formatDate(row.effective_to)}</small></td>
              <td><StatusBadge status={row.status} /></td>
              <td><strong>{formatNumber(row.charge_count)}</strong><small>{formatDateTime(row.last_charge_at)}</small></td>
              <td><RiskFlags flags={row.risk_flags || []} /></td>
              <td>
                <div className="rv-action-row">
                  <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(row); }}><Pencil size={14} /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onPrice(row); }}><History size={14} /></button>
                  {row.status === 'retired'
                    ? <button type="button" onClick={(event) => { event.stopPropagation(); onReactivate(row); }}><RotateCcw size={14} /></button>
                    : <button type="button" onClick={(event) => { event.stopPropagation(); onRetire(row); }}><Ban size={14} /></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ServiceDrawer({ service, onClose, onEdit, onPrice, onRetire, onReactivate }) {
  const detail = usePriceResource(() => billingPriceListAPI.detail(idOf(service)), {}, Boolean(service));
  if (!service) return null;
  const row = detail.data || service;
  return (
    <aside className="bo-drawer rv-drawer pl-drawer" aria-label="Chi tiết dịch vụ">
      <header>
        <div>
          <span>Service catalog</span>
          <h2>{row.service_code}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
      </header>
      <div className="bo-drawer__body rv-drawer-body">
        <div className="rv-drawer-hero">
          <FileText size={26} />
          <div>
            <strong>{row.service_name}</strong>
            <small>{departmentName(row)} · {SERVICE_TYPE_LABELS[row.service_type] || row.service_type}</small>
          </div>
          <StatusBadge status={row.status} />
        </div>
        <div className="pl-detail-grid">
          <section>
            <h3>Tổng quan</h3>
            <dl>
              <div><dt>Đơn giá</dt><dd>{formatMoney(row.unit_price)}</dd></div>
              <div><dt>Đơn vị</dt><dd>{row.unit || '-'}</dd></div>
              <div><dt>Billable</dt><dd>{row.is_billable ? 'Có' : 'Không'}</dd></div>
              <div><dt>Hiệu lực</dt><dd>{formatDate(row.effective_from)} → {formatDate(row.effective_to)}</dd></div>
            </dl>
          </section>
          <section>
            <h3>Sử dụng</h3>
            <dl>
              <div><dt>Tổng charge</dt><dd>{formatNumber(row.charge_count_total || row.charge_count)}</dd></div>
              <div><dt>Charge 7 ngày</dt><dd>{formatNumber(row.charge_count_7d)}</dd></div>
              <div><dt>Charge 30 ngày</dt><dd>{formatNumber(row.charge_count_30d)}</dd></div>
              <div><dt>Doanh thu 30 ngày</dt><dd>{formatMoney(row.revenue_30d)}</dd></div>
            </dl>
          </section>
        </div>
        <section>
          <h3>Price versions</h3>
          <div className="pl-version-list">
            {(row.price_versions || []).map((version) => (
              <article key={version._id || version.id}>
                <strong>{version.version_code}</strong>
                <span>{formatMoney(version.unit_price)} · {STATUS_LABELS[version.status] || version.status}</span>
                <small>{formatDate(version.effective_from)} → {formatDate(version.effective_to)} · {version.reason || '-'}</small>
              </article>
            ))}
            {!(row.price_versions || []).length && <EmptyState compact label="Chưa có version giá." />}
          </div>
        </section>
        <section>
          <h3>Risk flags</h3>
          <div className="pl-risk-box">
            {(row.risk_flags || []).map((flag) => <span key={flag}>{flag}</span>)}
            {!(row.risk_flags || []).length && <span>Không có rủi ro nổi bật</span>}
          </div>
        </section>
      </div>
      <div className="bo-drawer__actions">
        <button type="button" onClick={() => onEdit(row)}><Pencil size={16} />Sửa</button>
        <button type="button" onClick={() => onPrice(row)}><History size={16} />Phiên bản giá</button>
        {row.status === 'retired'
          ? <button type="button" onClick={() => onReactivate(row)}><RotateCcw size={16} />Kích hoạt</button>
          : <button type="button" onClick={() => onRetire(row)}><Ban size={16} />Ngừng sử dụng</button>}
      </div>
    </aside>
  );
}

const emptyServiceForm = {
  service_code: '',
  service_name: '',
  service_type: 'other',
  department_id: '',
  description: '',
  unit: 'service',
  unit_price: '',
  currency: 'VND',
  is_billable: true,
  effective_from: todayInputValue(),
  effective_to: '',
  status: 'active',
};

function ServiceModal({ service, onClose, onDone }) {
  const [form, setForm] = useState(service ? {
    ...emptyServiceForm,
    ...service,
    department_id: idOf(service.department_id) || '',
    effective_from: service.effective_from ? String(service.effective_from).slice(0, 10) : '',
    effective_to: service.effective_to ? String(service.effective_to).slice(0, 10) : '',
  } : emptyServiceForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(service);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        ...form,
        unit_price: Number(form.unit_price || 0),
        department_id: form.department_id || undefined,
        effective_to: form.effective_to || undefined,
      };
      if (editing) await billingPriceListAPI.update(idOf(service), body);
      else await billingPriceListAPI.create(body);
      onDone();
      onClose();
    } catch (submitError) {
      setError(getPriceListErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bo-modal-backdrop" role="presentation">
      <form className="bo-modal rv-action-form pl-modal" onSubmit={submit}>
        <header className="pl-modal-header">
          <div>
            <span>{editing ? 'Sửa dịch vụ' : 'Tạo dịch vụ'}</span>
            <h2>{editing ? service.service_code : 'ServiceCatalog'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>
        {error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{error}</div>}
        <label><span>Mã dịch vụ *</span><input required disabled={editing} value={form.service_code} onChange={(event) => setForm((current) => ({ ...current, service_code: event.target.value }))} /></label>
        <label><span>Tên dịch vụ *</span><input required value={form.service_name} onChange={(event) => setForm((current) => ({ ...current, service_name: event.target.value }))} /></label>
        <label><span>Loại</span><select value={form.service_type} onChange={(event) => setForm((current) => ({ ...current, service_type: event.target.value }))}>{Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Khoa</span><input value={form.department_id || ''} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))} placeholder="departmentId" /></label>
        <label><span>Đơn vị</span><input value={form.unit || ''} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} /></label>
        <label><span>Đơn giá *</span><input required type="number" min="0" value={form.unit_price} onChange={(event) => setForm((current) => ({ ...current, unit_price: event.target.value }))} /></label>
        <label><span>Hiệu lực từ</span><input type="date" value={form.effective_from || ''} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></label>
        <label><span>Hiệu lực đến</span><input type="date" value={form.effective_to || ''} onChange={(event) => setForm((current) => ({ ...current, effective_to: event.target.value }))} /></label>
        <label><span>Trạng thái</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option><option value="retired">Retired</option></select></label>
        <label className="rv-check"><input type="checkbox" checked={Boolean(form.is_billable)} onChange={(event) => setForm((current) => ({ ...current, is_billable: event.target.checked }))} /><span>Có tính phí</span></label>
        <label className="rv-form-wide"><span>Mô tả</span><textarea rows={3} value={form.description || ''} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
        <div className="rv-action-row"><button type="submit" disabled={busy}>{busy ? <Loader2 className="bo-spin" size={16} /> : <CheckCircle2 size={16} />}Lưu</button><button type="button" onClick={onClose}>Hủy</button></div>
      </form>
    </div>
  );
}

function PriceVersionModal({ service, onClose, onDone }) {
  const [form, setForm] = useState({
    unit_price: service?.unit_price || '',
    effective_from: todayInputValue(),
    effective_to: '',
    reason: 'Điều chỉnh bảng giá theo quyết định mới.',
    retire_old: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!service) return null;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await billingPriceListAPI.newVersion(idOf(service), {
        ...form,
        unit_price: Number(form.unit_price || 0),
        effective_to: form.effective_to || undefined,
      });
      onDone();
      onClose();
    } catch (submitError) {
      setError(getPriceListErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bo-modal-backdrop" role="presentation">
      <form className="bo-modal rv-action-form pl-modal" onSubmit={submit}>
        <header className="pl-modal-header"><div><span>Phiên bản giá mới</span><h2>{service.service_code}</h2></div><button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></header>
        {error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{error}</div>}
        <label><span>Giá mới *</span><input required type="number" min="0" value={form.unit_price} onChange={(event) => setForm((current) => ({ ...current, unit_price: event.target.value }))} /></label>
        <label><span>Áp dụng từ *</span><input required type="date" value={form.effective_from} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></label>
        <label><span>Hiệu lực đến</span><input type="date" value={form.effective_to} onChange={(event) => setForm((current) => ({ ...current, effective_to: event.target.value }))} /></label>
        <label className="rv-check"><input type="checkbox" checked={form.retire_old} onChange={(event) => setForm((current) => ({ ...current, retire_old: event.target.checked }))} /><span>Đóng phiên bản giá cũ trước thời điểm áp dụng</span></label>
        <label className="rv-form-wide"><span>Lý do *</span><textarea required rows={3} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
        <div className="rv-warning"><AlertTriangle size={16} />Nếu dịch vụ đã phát sinh charge, UI khuyến nghị dùng phiên bản giá mới thay vì cập nhật trực tiếp.</div>
        <div className="rv-action-row"><button type="submit" disabled={busy}>{busy ? <Loader2 className="bo-spin" size={16} /> : <History size={16} />}Tạo version</button><button type="button" onClick={onClose}>Hủy</button></div>
      </form>
    </div>
  );
}

function RetireModal({ service, mode = 'retire', onClose, onDone }) {
  const [reason, setReason] = useState(mode === 'reactivate' ? 'Kích hoạt lại dịch vụ theo quyết định bảng giá.' : 'Ngừng sử dụng dịch vụ theo quyết định bảng giá.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!service) return null;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'reactivate') await billingPriceListAPI.reactivate(idOf(service), { reason });
      else await billingPriceListAPI.retire(idOf(service), { reason });
      onDone();
      onClose();
    } catch (submitError) {
      setError(getPriceListErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bo-modal-backdrop" role="presentation">
      <form className="bo-modal rv-action-form pl-modal" onSubmit={submit}>
        <header className="pl-modal-header"><div><span>{mode === 'reactivate' ? 'Kích hoạt dịch vụ' : 'Ngừng sử dụng'}</span><h2>{service.service_code}</h2></div><button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button></header>
        {error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{error}</div>}
        <label className="rv-form-wide"><span>Lý do *</span><textarea required rows={4} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="rv-action-row"><button type="submit" disabled={busy}>{busy ? <Loader2 className="bo-spin" size={16} /> : mode === 'reactivate' ? <RotateCcw size={16} /> : <Ban size={16} />}{mode === 'reactivate' ? 'Kích hoạt' : 'Retire'}</button><button type="button" onClick={onClose}>Hủy</button></div>
      </form>
    </div>
  );
}

function PriceListWorkbench({ title, kicker, preset = {}, source = 'services', inactiveMode = false, departmentMode = false }) {
  const [filters, setFilters] = useState({ limit: 50, ...preset });
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState({ type: '', service: null });
  const params = useMemo(() => ({ limit: 50, ...filters }), [filters]);
  const listLoader = source === 'effective' ? loadEffective : loadServices;
  const summary = usePriceResource(loadSummary, params);
  const list = usePriceResource(listLoader, params);
  const departmentSummary = usePriceResource(loadDepartmentSummary, params, departmentMode);
  const items = list.data?.items || [];

  function refreshAll() {
    summary.refresh();
    list.refresh();
    departmentSummary.refresh();
    setSelected(null);
  }

  return (
    <main className="rv-workbench pl-workbench">
      <PriceHeader
        title={title}
        kicker={kicker}
        loading={summary.loading || list.loading}
        onRefresh={refreshAll}
        onCreate={() => setModal({ type: 'service', service: null })}
        actions={<button type="button" className="bo-icon-action" aria-label="Copy route"><Copy size={17} /></button>}
      />
      <PriceKpis summary={summary.data || {}} />
      <PriceFilters filters={filters} setFilters={setFilters} inactiveMode={inactiveMode} />
      {(summary.error || list.error) && <div className="rv-warning is-danger"><AlertTriangle size={16} />{summary.error || list.error}</div>}
      {departmentMode && (
        <section className="pl-department-strip">
          {(departmentSummary.data?.items || []).slice(0, 8).map((row) => (
            <article key={idOf(row.department_id) || row.department_name}>
              <strong>{row.department_name}</strong>
              <span>{formatNumber(row.total_services)} dịch vụ · {formatMoney(row.avg_price)}</span>
              <small>{formatNumber(row.total_charges_30d)} charge 30 ngày · {formatMoney(row.revenue_30d)}</small>
            </article>
          ))}
        </section>
      )}
      <section className="rv-split rv-split--wide">
        <section className="bo-panel bo-panel--wide">
          <header className="bo-panel__header">
            <h2>{title}</h2>
            <span>{formatNumber(list.data?.pagination?.total || items.length)} services</span>
          </header>
          <ServiceTable
            items={items}
            loading={list.loading}
            selected={selected}
            onSelect={setSelected}
            onEdit={(service) => setModal({ type: 'service', service })}
            onPrice={(service) => setModal({ type: 'price', service })}
            onRetire={(service) => setModal({ type: 'retire', service })}
            onReactivate={(service) => setModal({ type: 'reactivate', service })}
          />
        </section>
        <aside className="rv-side-panel">
          <header><span>Risk engine</span><strong>Kiểm tra bảng giá</strong></header>
          <div className="rv-risk-list">
            <span><AlertTriangle size={16} /><strong>Giá = 0</strong><small>Cho phép nhưng cần xác nhận</small></span>
            <span><AlertTriangle size={16} /><strong>Đã có charge</strong><small>Khuyến nghị tạo version mới</small></span>
            <span><AlertTriangle size={16} /><strong>Hết hiệu lực</strong><small>Không dùng để tạo charge</small></span>
            <span><AlertTriangle size={16} /><strong>Không billable</strong><small>Chặn assertServiceBillable</small></span>
          </div>
          <div className="rv-rule-box">
            <strong>Charge pricing</strong>
            <span>Backend resolve `ServicePriceVersion` theo `charged_at`; invoice item vẫn snapshot giá tại thời điểm phát hành.</span>
          </div>
        </aside>
      </section>
      <ServiceDrawer
        service={selected}
        onClose={() => setSelected(null)}
        onEdit={(service) => setModal({ type: 'service', service })}
        onPrice={(service) => setModal({ type: 'price', service })}
        onRetire={(service) => setModal({ type: 'retire', service })}
        onReactivate={(service) => setModal({ type: 'reactivate', service })}
      />
      {modal.type === 'service' && <ServiceModal service={modal.service} onClose={() => setModal({ type: '', service: null })} onDone={refreshAll} />}
      {modal.type === 'price' && <PriceVersionModal service={modal.service} onClose={() => setModal({ type: '', service: null })} onDone={refreshAll} />}
      {modal.type === 'retire' && <RetireModal service={modal.service} onClose={() => setModal({ type: '', service: null })} onDone={refreshAll} />}
      {modal.type === 'reactivate' && <RetireModal mode="reactivate" service={modal.service} onClose={() => setModal({ type: '', service: null })} onDone={refreshAll} />}
    </main>
  );
}

export function ServiceCatalogPage() {
  return <PriceListWorkbench title="Danh mục dịch vụ" kicker="Service catalog" />;
}

export function DepartmentPriceListPage() {
  return <PriceListWorkbench title="Bảng giá theo khoa" kicker="Department price matrix" departmentMode />;
}

export function ActiveServicesPage() {
  return (
    <PriceListWorkbench
      title="Dịch vụ đang hiệu lực"
      kicker="Active & billable"
      source="effective"
      preset={{ status: 'active', is_billable: 'true', effective_date: todayInputValue() }}
    />
  );
}

export function InactiveServicesPage() {
  return (
    <PriceListWorkbench
      title="Dịch vụ ngừng sử dụng"
      kicker="Retired / inactive services"
      preset={{ status: 'inactive,retired' }}
      inactiveMode
    />
  );
}
