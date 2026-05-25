import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bell,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  Eye,
  FileText,
  FlaskConical,
  Lock,
  MapPin,
  Merge,
  PackagePlus,
  Pill,
  PlayCircle,
  RefreshCw,
  Route as RouteIcon,
  Search,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  TimerOff,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { getApiErrorMessage, pharmacyConfigAPI, prescriptionAPI, unwrapData } from '../utils/api';
import { downloadPharmacyJson, notifyPharmacy } from './pharmacyActions';

const VIEW_META = {
  overview: {
    eyebrow: 'Nhà thuốc & Kho dược / Cấu hình dược',
    title: 'Tổng quan cấu hình dược',
    description: 'Dashboard đánh giá độ sạch catalog thuốc, kho, nhà cung cấp, cảnh báo và chính sách vận hành.',
    icon: Settings,
    tone: 'info',
  },
  units: {
    eyebrow: 'Cấu hình dược / Catalog thuốc',
    title: 'Đơn vị thuốc',
    description: 'Chuẩn hóa đơn vị kê đơn, cấp phát, tồn kho và in nhãn thuốc.',
    icon: Pill,
    createLabel: 'Tạo đơn vị',
    loader: pharmacyConfigAPI.units,
    quality: pharmacyConfigAPI.unitQuality,
    create: pharmacyConfigAPI.createUnit,
    columns: [
      ['code', 'Mã đơn vị'],
      ['name', 'Tên hiển thị'],
      ['symbol', 'Ký hiệu'],
      ['unit_type', 'Nhóm đơn vị'],
      ['is_prescribable', 'Kê đơn'],
      ['is_dispensable', 'Cấp phát'],
      ['medication_count', 'Số thuốc'],
      ['status', 'Trạng thái'],
    ],
  },
  dosageForms: {
    eyebrow: 'Cấu hình dược / Catalog thuốc',
    title: 'Dạng bào chế',
    description: 'Chuẩn hóa dạng thuốc để gợi ý đơn vị, route mặc định, nhãn và cảnh báo an toàn.',
    icon: FileText,
    createLabel: 'Tạo dạng',
    loader: pharmacyConfigAPI.dosageForms,
    quality: pharmacyConfigAPI.dosageFormQuality,
    create: pharmacyConfigAPI.createDosageForm,
    columns: [
      ['code', 'Mã dạng'],
      ['name', 'Tên dạng'],
      ['form_group', 'Nhóm dạng'],
      ['default_unit_id.name', 'Unit mặc định'],
      ['default_route_id.name', 'Route mặc định'],
      ['sterile_required', 'Vô khuẩn'],
      ['high_risk', 'Nguy cơ cao'],
      ['medication_count', 'Số thuốc'],
      ['status', 'Trạng thái'],
    ],
  },
  routes: {
    eyebrow: 'Cấu hình dược / Catalog thuốc',
    title: 'Đường dùng',
    description: 'Chuẩn hóa route cho kê đơn, cấp phát, eMAR và hướng dẫn bệnh nhân.',
    icon: RouteIcon,
    createLabel: 'Tạo route',
    loader: pharmacyConfigAPI.routes,
    quality: pharmacyConfigAPI.routeQuality,
    create: pharmacyConfigAPI.createRoute,
    columns: [
      ['code', 'Mã route'],
      ['name', 'Tên tiếng Việt'],
      ['english_name', 'Tên chuẩn'],
      ['route_group', 'Nhóm'],
      ['requires_site', 'Cần site'],
      ['requires_nurse_administration', 'Điều dưỡng'],
      ['risk_level', 'Mức rủi ro'],
      ['medication_count', 'Số thuốc'],
      ['status', 'Trạng thái'],
    ],
  },
  storageLocations: {
    eyebrow: 'Cấu hình dược / Kho thuốc',
    title: 'Vị trí lưu kho',
    description: 'Quản lý kho, kệ, tủ, ngăn, QR vị trí, điều kiện bảo quản và khu kiểm soát.',
    icon: MapPin,
    createLabel: 'Tạo vị trí',
    loader: pharmacyConfigAPI.storageLocations,
    quality: pharmacyConfigAPI.storageLocationQuality,
    create: pharmacyConfigAPI.createStorageLocation,
    columns: [
      ['code', 'Mã vị trí'],
      ['name', 'Tên vị trí'],
      ['location_type', 'Loại'],
      ['warehouse_id.name', 'Kho'],
      ['temperature_zone', 'Bảo quản'],
      ['capacity', 'Sức chứa'],
      ['batch_count', 'Số lô'],
      ['near_expiry_count', 'Sắp hết hạn'],
      ['status', 'Trạng thái'],
    ],
  },
  suppliers: {
    eyebrow: 'Cấu hình dược / Nguồn cung',
    title: 'Nhà cung cấp',
    description: 'Quản lý hồ sơ NCC, truy xuất nguồn gốc, recall, chi phí nhập và rủi ro chất lượng.',
    icon: Truck,
    createLabel: 'Tạo NCC',
    loader: pharmacyConfigAPI.suppliers,
    quality: pharmacyConfigAPI.supplierQuality,
    create: pharmacyConfigAPI.createSupplier,
    columns: [
      ['code', 'Mã NCC'],
      ['name', 'Tên NCC'],
      ['supplier_type', 'Loại'],
      ['tax_code', 'Mã số thuế'],
      ['contact_person', 'Liên hệ'],
      ['batch_count', 'Số lô'],
      ['inventory_value', 'Giá trị tồn'],
      ['risk_level', 'Risk'],
      ['status', 'Trạng thái'],
    ],
  },
  alertThresholds: {
    eyebrow: 'Cấu hình dược / Cảnh báo',
    title: 'Ngưỡng cảnh báo',
    description: 'Thiết lập ngưỡng tồn kho, hạn dùng, recall, severity, recipient và cooldown cảnh báo.',
    icon: Bell,
    createLabel: 'Tạo rule',
    loader: pharmacyConfigAPI.alertRules,
    create: pharmacyConfigAPI.createAlertRule,
    columns: [
      ['code', 'Mã rule'],
      ['name', 'Tên rule'],
      ['alert_type', 'Loại'],
      ['scope_type', 'Phạm vi'],
      ['threshold_value', 'Ngưỡng'],
      ['threshold_unit', 'Đơn vị'],
      ['severity', 'Severity'],
      ['recipient_roles', 'Người nhận'],
      ['status', 'Trạng thái'],
    ],
  },
  expiryPolicies: {
    eyebrow: 'Cấu hình dược / FEFO',
    title: 'Chính sách FEFO / expiry',
    description: 'Thiết lập chọn lô, chặn lô hết hạn, override, cảnh báo gần hạn và mô phỏng FEFO.',
    icon: TimerOff,
    createLabel: 'Tạo policy',
    loader: pharmacyConfigAPI.expiryPolicies,
    quality: pharmacyConfigAPI.expiryQualityCheck,
    create: pharmacyConfigAPI.createExpiryPolicy,
    columns: [
      ['code', 'Mã policy'],
      ['name', 'Tên policy'],
      ['scope_type', 'Phạm vi'],
      ['picking_strategy', 'Chiến lược'],
      ['block_expired_batch', 'Chặn hết hạn'],
      ['block_near_expiry_days', 'Chặn gần hạn'],
      ['allow_override', 'Override'],
      ['near_expiry_alert_days', 'Alert trước'],
      ['status', 'Trạng thái'],
    ],
  },
  controlledDrugs: {
    eyebrow: 'Cấu hình dược / Kiểm soát đặc biệt',
    title: 'Chính sách thuốc kiểm soát',
    description: 'Quy tắc tủ khóa, xác nhận 2 người, witness, kiểm kê cuối ca, hủy thuốc và ledger.',
    icon: ShieldAlert,
    createLabel: 'Tạo policy',
    loader: pharmacyConfigAPI.controlledDrugPolicies,
    create: pharmacyConfigAPI.createControlledDrugPolicy,
    columns: [
      ['code', 'Mã policy'],
      ['name', 'Tên policy'],
      ['controlled_type', 'Nhóm'],
      ['requires_locked_storage', 'Tủ khóa'],
      ['requires_double_check', 'Hai người'],
      ['requires_witness', 'Witness'],
      ['requires_shift_count', 'Kiểm kê ca'],
      ['medication_count', 'Số thuốc'],
      ['status', 'Trạng thái'],
    ],
  },
};

const VIEW_TABS = [
  ['overview', 'Tổng quan cấu hình'],
  ['units', 'Đơn vị thuốc'],
  ['dosageForms', 'Dạng bào chế'],
  ['routes', 'Đường dùng'],
  ['storageLocations', 'Vị trí lưu kho'],
  ['suppliers', 'Nhà cung cấp'],
  ['alertThresholds', 'Ngưỡng cảnh báo'],
  ['expiryPolicies', 'FEFO / expiry'],
  ['controlledDrugs', 'Thuốc kiểm soát'],
];

const CREATE_FIELDS = {
  units: [
    ['code', 'Mã đơn vị'],
    ['name', 'Tên đơn vị', true],
    ['symbol', 'Ký hiệu'],
    ['unit_type', 'Nhóm', false, ['count', 'volume', 'mass', 'package', 'dose', 'other']],
  ],
  dosageForms: [
    ['code', 'Mã dạng'],
    ['name', 'Tên dạng', true],
    ['form_group', 'Nhóm', false, ['oral', 'injection', 'topical', 'ophthalmic', 'inhalation', 'other']],
  ],
  routes: [
    ['code', 'Mã route'],
    ['name', 'Tên route', true],
    ['english_name', 'Tên chuẩn'],
    ['route_group', 'Nhóm', false, ['enteral', 'parenteral', 'topical', 'inhalation', 'other']],
  ],
  storageLocations: [
    ['code', 'Mã vị trí'],
    ['name', 'Tên vị trí', true],
    ['location_type', 'Loại', false, ['warehouse', 'shelf', 'cabinet', 'fridge', 'controlled_cabinet', 'quarantine', 'recall', 'disposal']],
    ['capacity', 'Sức chứa'],
  ],
  suppliers: [
    ['code', 'Mã NCC'],
    ['name', 'Tên NCC', true],
    ['supplier_type', 'Loại', false, ['manufacturer', 'distributor', 'wholesaler', 'pharmacy_partner']],
    ['risk_level', 'Risk', false, ['low', 'medium', 'high']],
  ],
  alertThresholds: [
    ['code', 'Mã rule'],
    ['name', 'Tên rule', true],
    ['alert_type', 'Loại', true, ['low_stock', 'out_of_stock', 'near_expiry', 'expired', 'recall', 'waste']],
    ['threshold_value', 'Ngưỡng'],
    ['severity', 'Severity', false, ['low', 'medium', 'high', 'critical']],
  ],
  expiryPolicies: [
    ['code', 'Mã policy'],
    ['name', 'Tên policy', true],
    ['picking_strategy', 'Chiến lược', false, ['FEFO', 'FIFO', 'MANUAL']],
    ['near_expiry_alert_days', 'Alert trước hạn'],
  ],
  controlledDrugs: [
    ['code', 'Mã policy'],
    ['name', 'Tên policy', true],
    ['controlled_type', 'Nhóm', false, ['narcotic', 'psychotropic', 'precursor', 'high_alert', 'other']],
    ['requires_locked_storage', 'Cần tủ khóa', false, ['false', 'true']],
  ],
};

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('vi-VN');
}

function getValue(row, path) {
  const value = String(path).split('.').reduce((current, key) => current?.[key], row);
  if (Array.isArray(value)) return value.map((item) => item?.name || item?.code || item).join(', ');
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (path.includes('date')) return formatDate(value);
  if (path.includes('value') || path.includes('price')) return formatCurrency(value);
  if (value === undefined || value === null || value === '') return '--';
  return String(value);
}

function getRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.items || payload?.rows || payload?.data || [];
}

function getSummary(payload) {
  return payload?.summary || payload?.meta || {};
}

function getRowId(row) {
  return row?._id || row?.id || row?.code || row?.name;
}

function StatusPill({ value }) {
  const normalized = String(value || '').toLowerCase();
  const tone = ['active', 'available', 'low', 'ok'].includes(normalized)
    ? 'success'
    : ['critical', 'high', 'blocked', 'expired', 'recalled'].includes(normalized)
      ? 'danger'
      : ['medium', 'warning', 'deprecated', 'locked', 'maintenance', 'unmapped'].includes(normalized)
        ? 'warning'
        : 'muted';
  return <span className={`pharmacy-config-pill is-${tone}`}>{value || 'unknown'}</span>;
}

function MetricTile({ icon: Icon, label, value, hint, tone = 'info' }) {
  return (
    <article className={`pharmacy-config-metric is-${tone}`}>
      <span aria-hidden="true"><Icon size={20} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{hint}</em>
      </div>
    </article>
  );
}

function ErrorState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="pharmacy-config-error">
      <AlertTriangle size={17} />
      <span>{error}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function EmptyState({ title = 'Chưa có dữ liệu', body = 'Dữ liệu sẽ hiển thị khi backend trả kết quả phù hợp.' }) {
  return (
    <div className="pharmacy-config-empty">
      <Database size={26} />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

function QualityBanner({ quality }) {
  const recommendations = quality?.recommendations || [];
  const headline = recommendations[0]?.title || 'Chưa phát hiện lỗi cấu hình nghiêm trọng trong dữ liệu đã tải.';
  return (
    <section className={`pharmacy-config-quality ${recommendations.length ? 'is-warning' : 'is-success'}`}>
      <div>
        {recommendations.length ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}
        <strong>{headline}</strong>
      </div>
      <div>
        {recommendations.slice(0, 4).map((item) => (
          <span key={item.title}>{item.title}</span>
        ))}
        {!recommendations.length ? <span>Catalog, lô tồn và policy đang ở trạng thái ổn định.</span> : null}
      </div>
    </section>
  );
}

function ConfigHeader({ meta, view, filters, setFilters, onRefresh, onRunQuality, onCreate, onExport, onImport }) {
  const Icon = meta.icon;
  return (
    <section className="pharmacy-config-header">
      <div className="pharmacy-config-header__copy">
        <span>{meta.eyebrow}</span>
        <h1><Icon size={30} /> {meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      <div className="pharmacy-config-header__actions">
        <button type="button" title="Import" onClick={onImport}><Upload size={16} />Import</button>
        <button type="button" title="Export" onClick={onExport}><Download size={16} />Export</button>
        <button type="button" title="Kiểm tra dữ liệu" onClick={onRunQuality}><PlayCircle size={16} />Kiểm tra dữ liệu</button>
        {view !== 'overview' ? <button type="button" className="is-primary" onClick={onCreate}>+ {meta.createLabel || 'Tạo mới'}</button> : null}
      </div>
      <div className="pharmacy-config-toolbar">
        <label className="is-search">
          <Search size={15} />
          <input value={filters.search} placeholder="Tìm cấu hình, mã, tên, mapping" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
        </label>
        <label>
          <BadgeCheck size={15} />
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deprecated">Deprecated</option>
            <option value="blocked">Blocked</option>
            <option value="locked">Locked</option>
          </select>
        </label>
        <label>
          <SlidersHorizontal size={15} />
          <select value={filters.includeDerived} onChange={(event) => setFilters((current) => ({ ...current, includeDerived: event.target.value }))}>
            <option value="true">Gồm text chưa chuẩn</option>
            <option value="false">Chỉ catalog chuẩn</option>
          </select>
        </label>
        <button type="button" title="Làm mới" onClick={onRefresh}><RefreshCw size={17} /></button>
      </div>
    </section>
  );
}

function ConfigTable({ columns = [], rows = [], loading, onSelect, onMerge }) {
  if (loading) return <EmptyState title="Đang tải cấu hình" body="Đang tổng hợp catalog chuẩn và dữ liệu text đang dùng." />;
  if (!rows.length) return <EmptyState />;
  return (
    <div className="pharmacy-config-table-wrap">
      <table className="pharmacy-config-table">
        <thead>
          <tr>
            <th><input type="checkbox" aria-label="Chọn tất cả" /></th>
            {columns.map(([key, label]) => <th key={key}>{label}</th>)}
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)} className={row._derived ? 'is-derived' : ''}>
              <td><input type="checkbox" aria-label={`Chọn ${row.name || row.code}`} /></td>
              {columns.map(([key]) => (
                <td key={key}>
                  {key === 'status' || key === 'severity' || key === 'risk_level'
                    ? <StatusPill value={getValue(row, key)} />
                    : getValue(row, key)}
                </td>
              ))}
              <td>
                <div className="pharmacy-config-row-actions">
                  <button type="button" title="Chi tiết" aria-label="Chi tiết" onClick={() => onSelect(row)}><Eye size={15} /></button>
                  <button type="button" title="Gộp / chuẩn hóa" aria-label="Gộp / chuẩn hóa" onClick={() => onMerge?.(row)}><Merge size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({ row, view, onClose, onMerge, onExport }) {
  if (!row) return null;
  const fields = Object.entries(row)
    .filter(([key, value]) => !key.startsWith('_') && value !== null && value !== undefined && typeof value !== 'object')
    .slice(0, 16);
  return (
    <aside className="pharmacy-config-drawer">
      <header>
        <div>
          <span>{VIEW_META[view]?.title}</span>
          <strong>{row.name || row.code || row.rule_code || row.batch_no || 'Chi tiết cấu hình'}</strong>
          <small>{row._derived ? 'Giá trị đang tồn tại dạng text tự do, chưa có catalog chuẩn.' : 'Đang dùng catalog chuẩn của backend.'}</small>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </header>
      <nav>
        {['Thông tin', 'Mapping sử dụng', 'Cảnh báo cấu hình', 'Audit'].map((tab) => <span key={tab}>{tab}</span>)}
      </nav>
      <div className="pharmacy-config-drawer__body">
        <section>
          <h3>Thông tin chính</h3>
          <dl>
            {fields.map(([key, value]) => (
              <div key={key}>
                <dt>{key.replace(/_/g, ' ')}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3>Mapping và ảnh hưởng</h3>
          <div className="pharmacy-config-impact-list">
            <span>Thuốc liên kết: {formatNumber(row.medication_count || row.linked_count || 0)}</span>
            <span>Lô liên quan: {formatNumber(row.batch_count || 0)}</span>
            <span>Giá trị tồn: {formatCurrency(row.inventory_value || 0)}</span>
            <span>Quality flag: {(row.quality_flags || []).join(', ') || 'OK'}</span>
          </div>
        </section>
      </div>
      <footer>
        <button type="button" onClick={() => onMerge?.(row)}><Merge size={16} />Gộp trùng</button>
        <button type="button" onClick={() => onExport?.(row)}><Download size={16} />Export mapping</button>
      </footer>
    </aside>
  );
}

function CreateDialog({ view, onClose, onSubmit }) {
  const fields = CREATE_FIELDS[view] || [];
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(([key, , required, options]) => [key, options?.[0] || (required ? '' : '')])));
  if (!fields.length) return null;
  return (
    <div className="pharmacy-config-modal" role="dialog" aria-modal="true">
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
        <header>
          <strong>{VIEW_META[view]?.createLabel || 'Tạo mới'}</strong>
          <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </header>
        <div>
          {fields.map(([key, label, required, options]) => (
            <label key={key}>
              <span>{label}</span>
              {options ? (
                <select value={form[key] || ''} required={required} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}>
                  {options.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input value={form[key] || ''} required={required} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
              )}
            </label>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" className="is-primary">Lưu cấu hình</button>
        </footer>
      </form>
    </div>
  );
}

function OverviewPage({ quality, navigate, onRunQuality }) {
  const score = Number(quality?.score || 0);
  const urgent = quality?.recommendations || [];
  const impactItems = [
    ['Đơn thuốc', 'Unit, route_default và dosage_form ảnh hưởng kê đơn, tính số lượng và hướng dẫn dùng thuốc.', Pill],
    ['Cấp phát', 'FEFO, batch expiry và vị trí lưu kho quyết định lô được chọn khi cấp phát.', PackagePlus],
    ['Kho thuốc', 'Supplier, location và min_stock_level ảnh hưởng nhập xuất tồn, kiểm kê và recall.', Boxes],
    ['Dùng thuốc nội trú', 'Route, dose, unit và policy high-alert ảnh hưởng eMAR và double-check.', Activity],
    ['Báo cáo', 'Catalog chuẩn giúp tồn kho, chi phí, hạn dùng và NCC không bị phân mảnh.', FileText],
  ];
  return (
    <div className="pharmacy-config-overview">
      <section className="pharmacy-config-score">
        <div>
          <span>Mức hoàn thiện cấu hình</span>
          <strong>{score}%</strong>
          <i><b style={{ width: `${score}%` }} /></i>
        </div>
        <button type="button" onClick={onRunQuality}><PlayCircle size={17} />Chạy kiểm tra dữ liệu</button>
      </section>
      <section className="pharmacy-config-metric-grid">
        <MetricTile icon={Pill} label="Thuốc thiếu đơn vị" value={formatNumber(quality?.medication_missing_unit)} hint="MedicationMaster.unit" tone="warning" />
        <MetricTile icon={FileText} label="Thiếu dạng bào chế" value={formatNumber(quality?.medication_missing_dosage_form)} hint="MedicationMaster.dosage_form" tone="warning" />
        <MetricTile icon={RouteIcon} label="Thiếu đường dùng" value={formatNumber(quality?.medication_missing_route)} hint="MedicationMaster.route_default" tone="warning" />
        <MetricTile icon={MapPin} label="Lô thiếu vị trí" value={formatNumber(quality?.batch_missing_location)} hint="StockBatch.storage_location" tone="danger" />
        <MetricTile icon={Truck} label="Lô thiếu NCC" value={formatNumber(quality?.batch_missing_supplier)} hint="StockBatch.supplier_name" tone="warning" />
        <MetricTile icon={TimerOff} label="Lô sắp hết hạn" value={formatNumber(quality?.near_expiry_batches)} hint="FEFO window" tone="danger" />
      </section>
      <section className="pharmacy-config-overview-grid">
        <div className="pharmacy-config-panel">
          <header><span>Cần xử lý ngay</span><h2>Data quality queue</h2></header>
          <div className="pharmacy-config-action-list">
            {urgent.map((item) => (
              <button key={item.title} type="button" onClick={() => navigate(item.to || '/pharmacy/config')}>
                <AlertTriangle size={16} />
                <span>{item.title}</span>
                <strong>{item.action?.replace(/_/g, ' ')}</strong>
              </button>
            ))}
            {!urgent.length ? <EmptyState title="Không có lỗi nghiêm trọng" body="Các chỉ báo chính đang trong ngưỡng ổn định." /> : null}
          </div>
        </div>
        <div className="pharmacy-config-panel">
          <header><span>Ảnh hưởng vận hành</span><h2>Operational impact</h2></header>
          <div className="pharmacy-config-impact-cards">
            {impactItems.map(([title, body, Icon]) => (
              <article key={title}>
                <Icon size={18} />
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FefoSimulator({ medications }) {
  const [input, setInput] = useState({ medication_id: '', quantity: 1, storage_location: '', allow_partial: 'true' });
  const [state, setState] = useState({ loading: false, data: null, error: '' });

  async function simulate() {
    if (!input.medication_id) {
      setState({ loading: false, data: null, error: 'Chọn thuốc hoặc nhập medication_id để test FEFO.' });
      return;
    }
    setState({ loading: true, data: null, error: '' });
    try {
      const response = await pharmacyConfigAPI.fefoSimulator(input);
      setState({ loading: false, data: unwrapData(response), error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: getApiErrorMessage(error, 'Không thể mô phỏng FEFO.') });
    }
  }

  return (
    <section className="pharmacy-config-panel pharmacy-config-fefo">
      <header>
        <span>FEFO simulator</span>
        <h2>Mô phỏng chọn lô xuất trước theo hạn dùng</h2>
      </header>
      <div className="pharmacy-config-fefo__form">
        <label>
          <span>Thuốc</span>
          <select value={input.medication_id} onChange={(event) => setInput((current) => ({ ...current, medication_id: event.target.value }))}>
            <option value="">Chọn thuốc</option>
            {medications.map((item) => (
              <option key={item._id || item.id} value={item._id || item.id}>
                {[item.medication_code, item.generic_name || item.brand_name, item.strength].filter(Boolean).join(' - ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Số lượng</span>
          <input type="number" min="1" value={input.quantity} onChange={(event) => setInput((current) => ({ ...current, quantity: event.target.value }))} />
        </label>
        <label>
          <span>Vị trí</span>
          <input value={input.storage_location} placeholder="Kho A, Kệ A1" onChange={(event) => setInput((current) => ({ ...current, storage_location: event.target.value }))} />
        </label>
        <label>
          <span>Cấp một phần</span>
          <select value={input.allow_partial} onChange={(event) => setInput((current) => ({ ...current, allow_partial: event.target.value }))}>
            <option value="true">Cho phép</option>
            <option value="false">Không</option>
          </select>
        </label>
        <button type="button" onClick={simulate}><FlaskConical size={16} />Test FEFO</button>
      </div>
      <ErrorState error={state.error} onRetry={simulate} />
      {state.loading ? <EmptyState title="Đang mô phỏng FEFO" body="Backend đang chạy selectStockBatch theo FEFO hiện có." /> : null}
      {state.data?.rows?.length ? (
        <div className="pharmacy-config-table-wrap">
          <table className="pharmacy-config-table is-compact">
            <thead>
              <tr><th>Thứ tự</th><th>Lô</th><th>Hạn dùng</th><th>Vị trí</th><th>Tồn</th><th>Đề xuất lấy</th><th>Lý do</th></tr>
            </thead>
            <tbody>
              {state.data.rows.map((row) => (
                <tr key={`${row.stock_batch_id}-${row.order}`}>
                  <td>{row.order}</td>
                  <td>{row.batch_no || '--'}</td>
                  <td>{formatDate(row.expiry_date)}</td>
                  <td>{row.storage_location || '--'}</td>
                  <td>{formatNumber(row.quantity_on_hand)}</td>
                  <td>{formatNumber(row.suggested_quantity)}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ControlledLedgerPanel() {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    let mounted = true;
    pharmacyConfigAPI.controlledDrugLedger({ limit: 8 })
      .then((response) => { if (mounted) setState({ loading: false, data: unwrapData(response), error: '' }); })
      .catch((error) => { if (mounted) setState({ loading: false, data: null, error: getApiErrorMessage(error, 'Không thể tải ledger thuốc kiểm soát.') }); });
    return () => { mounted = false; };
  }, []);
  const rows = getRows(state.data);
  return (
    <section className="pharmacy-config-panel">
      <header>
        <span>Controlled ledger</span>
        <h2>Sổ thuốc kiểm soát gần đây</h2>
      </header>
      <ErrorState error={state.error} />
      {state.loading ? <EmptyState title="Đang tải ledger" /> : null}
      {!state.loading && rows.length ? (
        <div className="pharmacy-config-ledger">
          {rows.map((row) => (
            <article key={row._id || row.id}>
              <Lock size={16} />
              <strong>{row.action_type}</strong>
              <span>{row.medication_id?.generic_name || row.medication_id?.medication_code || '--'}</span>
              <em>{formatNumber(row.quantity)} · {formatDate(row.occurred_at)}</em>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PharmacyConfigPage({ view = 'overview' }) {
  const navigate = useNavigate();
  const meta = VIEW_META[view] || VIEW_META.overview;
  const [filters, setFilters] = useState({ search: '', status: '', includeDerived: 'true' });
  const [state, setState] = useState({ loading: true, data: null, quality: null, error: '' });
  const [drawer, setDrawer] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [medications, setMedications] = useState([]);

  const rows = useMemo(() => getRows(state.data), [state.data]);
  const summary = getSummary(state.data);
  const quality = state.quality || (view === 'overview' ? state.data : null);

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const params = {
        search: filters.search || undefined,
        status: filters.status || undefined,
        include_derived: filters.includeDerived,
        limit: 80,
      };
      if (view === 'overview') {
        const response = await pharmacyConfigAPI.qualityDashboard();
        setState({ loading: false, data: unwrapData(response), quality: unwrapData(response), error: '' });
        return;
      }
      const [dataResult, qualityResult] = await Promise.allSettled([
        meta.loader(params),
        meta.quality ? meta.quality() : pharmacyConfigAPI.qualityDashboard(),
      ]);
      if (dataResult.status === 'rejected') throw dataResult.reason;
      setState({
        loading: false,
        data: unwrapData(dataResult.value),
        quality: qualityResult.status === 'fulfilled' ? unwrapData(qualityResult.value)?.dashboard || unwrapData(qualityResult.value) : null,
        error: '',
      });
    } catch (error) {
      setState({ loading: false, data: null, quality: null, error: getApiErrorMessage(error, 'Không thể tải cấu hình dược.') });
    }
  }

  useEffect(() => {
    load();
  }, [view, filters.search, filters.status, filters.includeDerived]);

  useEffect(() => {
    if (view !== 'expiryPolicies') return;
    let mounted = true;
    prescriptionAPI.listMedications({ limit: 30, status: 'active' })
      .then((response) => { if (mounted) setMedications(getRows(unwrapData(response))); })
      .catch(() => { if (mounted) setMedications([]); });
    return () => { mounted = false; };
  }, [view]);

  async function runQuality() {
    try {
      const response = await pharmacyConfigAPI.runQualityCheck({});
      setState((current) => ({ ...current, quality: unwrapData(response), data: view === 'overview' ? unwrapData(response) : current.data }));
      notifyPharmacy({ tone: 'success', title: 'Kiểm tra dữ liệu', message: 'Đã chạy kiểm tra chất lượng cấu hình dược.' });
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: 'Kiểm tra dữ liệu', message: getApiErrorMessage(error, 'Không thể chạy kiểm tra dữ liệu.') });
    }
  }

  function exportData() {
    downloadPharmacyJson(`pharmacy-config-${view}.json`, { view, filters, data: state.data, quality }, 'Xuất cấu hình dược');
  }

  function importData() {
    notifyPharmacy({
      tone: 'info',
      title: 'Import cấu hình dược',
      message: 'Import hàng loạt cần file mẫu và kiểm duyệt dữ liệu. Hiện backend đang hỗ trợ tạo từng cấu hình từ nút Tạo mới.',
    });
  }

  function mergeRow(row) {
    notifyPharmacy({
      tone: 'info',
      title: 'Gộp / chuẩn hóa cấu hình',
      message: row?._derived
        ? 'Hãy tạo catalog chuẩn hoặc chọn bản ghi chuẩn trước khi gộp giá trị text tự do.'
        : 'Bản ghi catalog chuẩn đã được chọn. Chức năng merge hàng loạt sẽ yêu cầu chọn thêm bản ghi nguồn.',
    });
    setDrawer(row);
  }

  async function submitCreate(form) {
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => {
        if (value === 'true') return [key, true];
        if (value === 'false') return [key, false];
        return [key, value];
      }));
      await meta.create(payload);
      setShowCreate(false);
      notifyPharmacy({ tone: 'success', title: VIEW_META[view]?.createLabel || 'Tạo cấu hình', message: 'Đã tạo cấu hình dược mới.' });
      load();
    } catch (error) {
      notifyPharmacy({ tone: 'danger', title: VIEW_META[view]?.createLabel || 'Tạo cấu hình', message: getApiErrorMessage(error, 'Không thể tạo cấu hình.') });
    }
  }

  const metricCards = [
    { icon: Database, label: 'Tổng cấu hình', value: formatNumber(summary.total_config || rows.length || quality?.total_medications), hint: 'catalog + text đang dùng', tone: 'info' },
    { icon: CheckCircle2, label: 'Active', value: formatNumber(summary.active), hint: 'đang khả dụng', tone: 'success' },
    { icon: ClipboardCheck, label: 'Đang được dùng', value: formatNumber(summary.linked || summary.controlled_medications), hint: 'liên kết thuốc/lô', tone: 'neutral' },
    { icon: AlertTriangle, label: 'Thiếu mapping', value: formatNumber(summary.missing_mapping || quality?.batch_missing_location || 0), hint: 'cần chuẩn hóa', tone: 'warning' },
  ];

  return (
    <div className="pharmacy-config-page">
      <ConfigHeader
        meta={meta}
        view={view}
        filters={filters}
        setFilters={setFilters}
        onRefresh={load}
        onRunQuality={runQuality}
        onCreate={() => setShowCreate(true)}
        onExport={exportData}
        onImport={importData}
      />
      <nav className="pharmacy-config-tabs">
        {VIEW_TABS.map(([key, label]) => (
          <button key={key} type="button" className={key === view ? 'is-active' : ''} onClick={() => navigate(key === 'overview' ? '/pharmacy/config' : `/pharmacy/config/${key === 'dosageForms' ? 'dosage-forms' : key === 'storageLocations' ? 'storage-locations' : key === 'alertThresholds' ? 'alert-thresholds' : key === 'expiryPolicies' ? 'expiry-policies' : key === 'controlledDrugs' ? 'controlled-drugs' : key}`)}>
            {label}
          </button>
        ))}
      </nav>
      <ErrorState error={state.error} onRetry={load} />
      <QualityBanner quality={quality} />
      {view === 'overview' ? (
        <OverviewPage quality={quality || {}} navigate={navigate} onRunQuality={runQuality} />
      ) : (
        <>
          <section className="pharmacy-config-metric-grid">
            {metricCards.map((item) => <MetricTile key={item.label} {...item} />)}
          </section>
          {view === 'expiryPolicies' ? <FefoSimulator medications={medications} /> : null}
          {view === 'controlledDrugs' ? <ControlledLedgerPanel /> : null}
          <section className="pharmacy-config-panel">
            <header>
              <span>Data table</span>
              <h2>{meta.title}</h2>
            </header>
            <ConfigTable columns={meta.columns || []} rows={rows} loading={state.loading} onSelect={setDrawer} onMerge={mergeRow} />
          </section>
        </>
      )}
      <DetailDrawer
        row={drawer}
        view={view}
        onClose={() => setDrawer(null)}
        onMerge={mergeRow}
        onExport={(row) => downloadPharmacyJson(`pharmacy-config-${view}-mapping.json`, { view, row }, 'Xuất mapping cấu hình')}
      />
      {showCreate ? <CreateDialog view={view} onClose={() => setShowCreate(false)} onSubmit={submitCreate} /> : null}
    </div>
  );
}
