import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Ban,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  History,
  Layers3,
  PackageCheck,
  PackagePlus,
  Pill,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
  WalletCards,
  X,
} from 'lucide-react';
import { getApiErrorMessage, prescriptionAPI } from '../utils/api';
import {
  loadPrescriptionRiskQueue,
  loadPrescriptionWorkbench,
} from './pharmacyApi';
import { downloadPharmacyJson, notifyPharmacy, printPharmacyView, promptPharmacyText } from './pharmacyActions';

const PAGE_CONFIG = {
  pending_verification: {
    eyebrow: 'Nhà thuốc & Kho dược / Đơn thuốc',
    title: 'Chờ duyệt dược',
    description: 'Duyệt đơn mới kê, kiểm tra dị ứng, tương tác, dữ liệu liều, tồn kho và khả năng tạo charge.',
    icon: ClipboardCheck,
    sort: 'sla',
  },
  need_review: {
    eyebrow: 'Nhà thuốc & Kho dược / Đơn thuốc',
    title: 'Cần kiểm tra',
    description: 'Risk queue gom các đơn có cảnh báo lâm sàng, thiếu tồn, thiếu giá, thiếu dữ liệu hoặc quá SLA.',
    icon: ShieldAlert,
    sort: 'risk',
    useRiskQueue: true,
  },
  waiting_dispense: {
    eyebrow: 'Nhà thuốc & Kho dược / Đơn thuốc',
    title: 'Chờ cấp phát',
    description: 'Đơn đã verified, sẵn sàng tạo phiếu cấp phát, xem lô FEFO và tồn khả dụng.',
    icon: PackageCheck,
    sort: 'sla',
  },
  partially_dispensed: {
    eyebrow: 'Nhà thuốc & Kho dược / Đơn thuốc',
    title: 'Cấp phát một phần',
    description: 'Theo dõi đơn còn thiếu thuốc, tiến độ cấp phát và khả năng cấp tiếp.',
    icon: Activity,
    sort: 'sla',
  },
  dispensed: {
    eyebrow: 'Nhà thuốc & Kho dược / Đơn thuốc',
    title: 'Đã cấp phát',
    description: 'Kiểm tra phiếu đã cấp, charge viện phí, hoàn trả thuốc và in lại chứng từ.',
    icon: CheckCircle2,
    sort: 'newest',
  },
  cancelled: {
    eyebrow: 'Nhà thuốc & Kho dược / Đơn thuốc',
    title: 'Bị hủy',
    description: 'Theo dõi lý do hủy, hoàn tồn, void charge và đơn thay thế.',
    icon: Ban,
    sort: 'newest',
  },
  refill: {
    eyebrow: 'Nhà thuốc & Kho dược / Đơn thuốc',
    title: 'Yêu cầu cấp lại thuốc',
    description: 'Duyệt refill request, chuyển bác sĩ xác nhận hoặc tạo đơn renew từ đơn gốc.',
    icon: PackagePlus,
    sort: 'newest',
  },
  history: {
    eyebrow: 'Nhà thuốc & Kho dược / Đơn thuốc',
    title: 'Lịch sử đơn thuốc',
    description: 'Tra cứu toàn bộ lịch sử kê, duyệt, cấp phát, hoàn trả, hủy, renew và charge.',
    icon: History,
    sort: 'newest',
  },
};

const STATUS_META = {
  draft: { label: 'Draft', tone: 'warning' },
  active: { label: 'Chờ duyệt', tone: 'warning' },
  verified: { label: 'Chờ cấp phát', tone: 'info' },
  partially_dispensed: { label: 'Cấp một phần', tone: 'purple' },
  fully_dispensed: { label: 'Đã cấp', tone: 'success' },
  completed: { label: 'Hoàn tất', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
  pending: { label: 'Chờ xử lý', tone: 'warning' },
  approved: { label: 'Đã duyệt', tone: 'success' },
  rejected: { label: 'Từ chối', tone: 'danger' },
};

const PRIORITY_META = {
  critical: { label: 'Critical', tone: 'danger' },
  high: { label: 'High', tone: 'warning' },
  medium: { label: 'Medium', tone: 'info' },
  low: { label: 'Low', tone: 'muted' },
};

const DRAWER_TABS = ['Tổng quan', 'Thuốc trong đơn', 'Kiểm tra dược', 'Cấp phát', 'Tồn kho / lô', 'Viện phí', 'Timeline', 'Ghi chú'];

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function parseDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatDateTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusMeta(value) {
  return STATUS_META[String(value || '').toLowerCase()] || { label: value || 'Không rõ', tone: 'muted' };
}

function priorityMeta(value) {
  return PRIORITY_META[String(value || '').toLowerCase()] || PRIORITY_META.low;
}

function StatusBadge({ value }) {
  const meta = statusMeta(value);
  return <span className={`rx-status is-${meta.tone}`}>{meta.label}</span>;
}

function PriorityBadge({ value }) {
  const meta = priorityMeta(value);
  return <span className={`rx-priority is-${meta.tone}`}>{meta.label}</span>;
}

function riskItems(row) {
  const risk = row?.risk_summary || {};
  return [
    { key: 'allergy_count', label: 'Dị ứng', tone: 'danger' },
    { key: 'interaction_count', label: 'Tương tác', tone: 'warning' },
    { key: 'duplicate_count', label: 'Trùng thuốc', tone: 'info' },
    { key: 'stock_shortage_count', label: 'Thiếu tồn', tone: 'danger' },
    { key: 'missing_data_count', label: 'Thiếu liều', tone: 'warning' },
    { key: 'unpriced_medication_count', label: 'Thiếu giá', tone: 'purple' },
    { key: 'inactive_medication_count', label: 'Thuốc inactive', tone: 'danger' },
  ].filter((item) => Number(risk[item.key] || 0) > 0);
}

function RiskBadges({ row }) {
  const items = riskItems(row);
  if (!items.length) return <span className="rx-muted">Ổn</span>;
  return (
    <div className="rx-risk-pills">
      {items.slice(0, 4).map((item) => (
        <span key={item.key} className={`is-${item.tone}`}>{item.label}</span>
      ))}
      {items.length > 4 ? <em>+{items.length - 4}</em> : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint, tone = 'neutral' }) {
  return (
    <article className={`rx-metric is-${tone}`}>
      <Icon size={19} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function getMetrics(data, group) {
  const summary = data?.summary || {};
  if (group === 'refill') {
    return [
      { icon: PackagePlus, label: 'Yêu cầu', value: summary.total || 0, hint: 'tổng refill', tone: 'info' },
      { icon: Clock3, label: 'Chờ xử lý', value: summary.pending || 0, hint: 'pending', tone: 'warning' },
      { icon: BadgeCheck, label: 'Đã duyệt', value: summary.approved || 0, hint: 'approved', tone: 'success' },
      { icon: Ban, label: 'Từ chối', value: summary.rejected || 0, hint: 'rejected', tone: 'danger' },
      { icon: Timer, label: 'Quá SLA', value: summary.overdue_sla || 0, hint: 'cần rà soát', tone: 'warning' },
    ];
  }
  return [
    { icon: FileText, label: 'Tổng đơn', value: summary.total || 0, hint: 'trong bộ lọc', tone: 'neutral' },
    { icon: Clock3, label: 'Chờ duyệt', value: summary.pending_verification || 0, hint: 'draft / active', tone: 'warning' },
    { icon: Timer, label: 'Quá SLA', value: summary.overdue_sla || 0, hint: 'ưu tiên xử lý', tone: 'danger' },
    { icon: ShieldAlert, label: 'Dị ứng', value: summary.allergy_alerts || 0, hint: 'alert lâm sàng', tone: 'danger' },
    { icon: AlertTriangle, label: 'Tương tác', value: summary.interaction_warnings || 0, hint: 'manual review', tone: 'warning' },
    { icon: PackageCheck, label: 'Thiếu tồn', value: summary.stock_shortages || 0, hint: 'cần FEFO/đổi thuốc', tone: 'danger' },
    { icon: WalletCards, label: 'Charge lỗi', value: summary.charge_errors || 0, hint: 'thiếu giá/void', tone: 'purple' },
    { icon: CheckCircle2, label: 'Đủ tồn', value: summary.can_dispense_full || 0, hint: 'có thể cấp đủ', tone: 'success' },
  ];
}

function CommandHeader({ config, onRefresh, loading, onScan, onPrint, onExport }) {
  const Icon = config.icon;
  return (
    <section className="rx-command-header">
      <div className="rx-command-header__title">
        <span>{config.eyebrow}</span>
        <h1><Icon size={26} />{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <div className="rx-command-header__tools">
        <span className="rx-live"><Bell size={15} />Realtime: Đang bật</span>
        <button type="button" title="Quét mã đơn" onClick={onScan}><Search size={16} /></button>
        <button type="button" title="In danh sách" onClick={onPrint}><Printer size={16} /></button>
        <button type="button" title="Xuất Excel" onClick={onExport}><Download size={16} /></button>
        <button type="button" title="Làm mới" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
        </button>
      </div>
    </section>
  );
}

function FilterBar({ filters, setFilters, group }) {
  return (
    <section className="rx-filter-bar" aria-label="Bộ lọc đơn thuốc">
      <label className="is-wide">
        <Search size={15} />
        <input
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
          placeholder="Mã đơn, bệnh nhân, SĐT, thuốc, bác sĩ..."
        />
      </label>
      <label>
        <SlidersHorizontal size={15} />
        <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value, page: 1 }))}>
          <option value="">Ưu tiên</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      {group !== 'refill' ? (
        <label>
          <Filter size={15} />
          <select value={filters.riskType} onChange={(event) => setFilters((current) => ({ ...current, riskType: event.target.value, page: 1 }))}>
            <option value="">Loại rủi ro</option>
            <option value="allergy">Dị ứng</option>
            <option value="interaction">Tương tác</option>
            <option value="duplicate">Trùng thuốc</option>
            <option value="stock_shortage">Thiếu tồn</option>
            <option value="unpriced_medication">Thiếu giá</option>
          </select>
        </label>
      ) : null}
      <label><span>Từ</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value, page: 1 }))} /></label>
      <label><span>Đến</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value, page: 1 }))} /></label>
      <label><Pill size={15} /><input value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value, page: 1 }))} placeholder="Khoa/phòng" /></label>
      <button type="button" onClick={() => setFilters((current) => ({ ...current, search: '', priority: '', riskType: '', dateFrom: '', dateTo: '', department: '', page: 1 }))}>
        <RotateCcw size={15} />
        Xóa lọc
      </button>
    </section>
  );
}

function ProgressBar({ value }) {
  const percent = Math.max(0, Math.min(Number(value || 0), 100));
  return (
    <span className="rx-progress" aria-label={`Tiến độ ${percent}%`}>
      <i style={{ width: `${percent}%` }} />
      <em>{formatNumber(percent)}%</em>
    </span>
  );
}

function WorkbenchTable({ rows, loading, group, onSelect, onAction }) {
  if (loading) {
    return (
      <section className="rx-table-empty">
        <RefreshCw className="is-spinning" size={22} />
        <strong>Đang tải worklist</strong>
        <span>Đang gom đơn thuốc, tồn kho, cảnh báo và charge.</span>
      </section>
    );
  }
  if (!rows.length) {
    return (
      <section className="rx-table-empty">
        <CheckCircle2 size={24} />
        <strong>Không có dữ liệu phù hợp</strong>
        <span>Thử đổi bộ lọc hoặc làm mới dữ liệu.</span>
      </section>
    );
  }

  return (
    <div className="rx-table-scroll">
      <table className="rx-worklist-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>Mã đơn</th>
            <th>Bệnh nhân</th>
            <th>Encounter</th>
            <th>Bác sĩ kê</th>
            <th>Thời gian</th>
            <th>Trạng thái</th>
            <th>Cảnh báo</th>
            <th>Tồn kho</th>
            <th>Tiến độ</th>
            <th>Viện phí</th>
            <th>SLA</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.refill_request_id || row.prescription_id}>
              <td><PriorityBadge value={row.priority} /></td>
              <td>
                <strong>{row.prescription_no || row.refill_request_id || '--'}</strong>
                {row.risk_score ? <small>Risk {formatNumber(row.risk_score)}</small> : null}
              </td>
              <td>
                <span>{row.patient?.full_name || '--'}</span>
                <small>{[row.patient?.patient_code, row.patient?.age ? `${row.patient.age} tuổi` : '', row.patient?.gender].filter(Boolean).join(' · ') || '--'}</small>
              </td>
              <td>
                <span>{row.encounter?.encounter_code || '--'}</span>
                <small>{row.encounter?.department_name || row.encounter?.encounter_type || '--'}</small>
              </td>
              <td>{row.doctor?.full_name || '--'}</td>
              <td>{formatDateTime(row.prescribed_at || row.requested_at)}</td>
              <td><StatusBadge value={row.status} /></td>
              <td><RiskBadges row={row} /></td>
              <td>
                {row.stock_summary?.shortage_items_count ? (
                  <span className="rx-stock is-short">Thiếu {formatNumber(row.stock_summary.shortage_items_count)}</span>
                ) : <span className="rx-stock is-ok">Đủ</span>}
              </td>
              <td><ProgressBar value={row.dispense_progress?.percent} /></td>
              <td>
                <span>{row.billing_summary?.estimated_amount ? formatCurrency(row.billing_summary.estimated_amount) : '--'}</span>
                <small>{formatNumber(row.billing_summary?.charge_count || 0)} charge</small>
              </td>
              <td>
                <span className={`rx-sla is-${row.sla_status || 'on_track'}`}>{formatNumber(row.waiting_minutes || 0)} phút</span>
              </td>
              <td>
                <div className="rx-row-actions">
                  <button type="button" title="Xem chi tiết" onClick={() => onSelect(row)}><Eye size={15} /></button>
                  {group === 'refill' ? (
                    <>
                      <button type="button" title="Duyệt refill" onClick={() => onAction('approve_refill', row)}><BadgeCheck size={15} /></button>
                      <button type="button" title="Tạo đơn renew" onClick={() => onAction('convert_refill', row)}><PackagePlus size={15} /></button>
                    </>
                  ) : (
                    <>
                      {row.available_actions?.includes('verify') ? <button type="button" title="Duyệt đơn" onClick={() => onAction('verify', row)}><BadgeCheck size={15} /></button> : null}
                      {row.available_actions?.includes('create_dispense') ? <button type="button" title="Tạo phiếu cấp phát" onClick={() => onAction('create_dispense', row)}><PackageCheck size={15} /></button> : null}
                      {row.available_actions?.includes('complete') ? <button type="button" title="Hoàn tất đơn" onClick={() => onAction('complete', row)}><CheckCircle2 size={15} /></button> : null}
                      {row.available_actions?.includes('cancel') ? <button type="button" title="Hủy đơn" className="is-danger" onClick={() => onAction('cancel', row)}><Ban size={15} /></button> : null}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DrawerSection({ title, icon: Icon, children }) {
  return (
    <section className="rx-drawer-section">
      <h3>{Icon ? <Icon size={17} /> : null}{title}</h3>
      {children}
    </section>
  );
}

function DetailDrawer({ row, detail, loading, activeTab, setActiveTab, onClose, onAction }) {
  if (!row) return null;
  const items = row.item_details || detail?.items || [];
  return (
    <aside className="rx-drawer" aria-label="Chi tiết đơn thuốc">
      <header>
        <div>
          <span>{row.status_group === 'refill' ? 'Yêu cầu refill' : 'Chi tiết đơn thuốc'}</span>
          <h2>{row.prescription_no || row.refill_request_id || '--'}</h2>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </header>
      <nav className="rx-drawer-tabs">
        {DRAWER_TABS.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </nav>
      {loading ? <div className="rx-drawer-loading"><RefreshCw className="is-spinning" size={20} />Đang tải chi tiết...</div> : null}
      <div className="rx-drawer-body">
        {activeTab === 'Tổng quan' ? (
          <>
            <div className="rx-detail-grid">
              <article><small>Bệnh nhân</small><strong>{row.patient?.full_name || '--'}</strong><span>{row.patient?.patient_code || row.patient?.phone || '--'}</span></article>
              <article><small>Encounter</small><strong>{row.encounter?.encounter_code || '--'}</strong><span>{row.encounter?.department_name || '--'}</span></article>
              <article><small>Bác sĩ kê</small><strong>{row.doctor?.full_name || '--'}</strong><span>{row.doctor?.employee_code || '--'}</span></article>
              <article><small>Trạng thái</small><StatusBadge value={row.status} /></article>
              <article><small>Thời gian chờ</small><strong>{formatNumber(row.waiting_minutes)} phút</strong><span>{row.sla_status}</span></article>
              <article><small>Version</small><strong>{row.version || '--'}</strong><span>{row.is_current === false ? 'Đã thay thế' : 'Current'}</span></article>
            </div>
            <DrawerSection title="Action bar" icon={SlidersHorizontal}>
              <div className="rx-drawer-actions">
                {(row.available_actions || []).slice(0, 8).map((action) => (
                  <button key={action} type="button" onClick={() => onAction(action, row)}>{action.replace(/_/g, ' ')}</button>
                ))}
              </div>
            </DrawerSection>
          </>
        ) : null}

        {activeTab === 'Thuốc trong đơn' ? (
          <DrawerSection title="Medication lines" icon={Pill}>
            <div className="rx-med-lines">
              {items.length ? items.map((item) => (
                <article key={item.prescription_item_id || item._id}>
                  <div>
                    <strong>{item.medication_name || item.medication_id?.brand_name || item.medication_id?.generic_name || 'Thuốc'}</strong>
                    <small>{[item.dose, item.route, item.frequency, item.duration_days ? `${item.duration_days} ngày` : ''].filter(Boolean).join(' · ')}</small>
                  </div>
                  <span>{formatNumber(item.dispensed_quantity || 0)}/{formatNumber(item.quantity || 0)} {item.unit}</span>
                  <em>{formatNumber(item.available_quantity || 0)} khả dụng</em>
                </article>
              )) : <span className="rx-muted">Chưa có dòng thuốc.</span>}
            </div>
          </DrawerSection>
        ) : null}

        {activeTab === 'Kiểm tra dược' ? (
          <DrawerSection title="Risk evidence" icon={ShieldAlert}>
            <div className="rx-risk-detail">
              <RiskBadges row={row} />
              <p>{row.recommendation || 'Dữ liệu được tổng hợp từ dị ứng, số dòng thuốc, trạng thái thuốc, tồn kho và cấu hình giá.'}</p>
              {(row.risk_summary?.allergy_conflicts || []).map((conflict) => (
                <article key={`${conflict.allergy_id}-${conflict.medication_id}`}>
                  <strong>{conflict.medication_name}</strong>
                  <span>Dị ứng: {conflict.allergen} · {conflict.severity}</span>
                </article>
              ))}
            </div>
          </DrawerSection>
        ) : null}

        {activeTab === 'Cấp phát' ? (
          <DrawerSection title="Dispense progress" icon={PackageCheck}>
            <div className="rx-detail-grid">
              <article><small>Tổng SL</small><strong>{formatNumber(row.dispense_progress?.total_quantity)}</strong></article>
              <article><small>Đã cấp</small><strong>{formatNumber(row.dispense_progress?.dispensed_quantity)}</strong></article>
              <article><small>Còn lại</small><strong>{formatNumber(row.dispense_progress?.remaining_quantity)}</strong></article>
              <article><small>Phiếu gần nhất</small><strong>{row.latest_dispense?.dispense_no || '--'}</strong><span>{row.latest_dispense?.status || '--'}</span></article>
            </div>
            <ProgressBar value={row.dispense_progress?.percent} />
          </DrawerSection>
        ) : null}

        {activeTab === 'Tồn kho / lô' ? (
          <DrawerSection title="FEFO stock" icon={Layers3}>
            <div className="rx-med-lines">
              {items.map((item) => (
                <article key={`stock-${item.prescription_item_id || item._id}`}>
                  <div>
                    <strong>{item.medication_name || 'Thuốc'}</strong>
                    <small>{item.fefo_batch?.batch_no ? `Lô FEFO ${item.fefo_batch.batch_no}` : 'Chưa có lô khả dụng'}</small>
                  </div>
                  <span>{formatNumber(item.available_quantity || 0)} tồn</span>
                  <em>{item.fefo_batch?.expiry_date ? formatDateTime(item.fefo_batch.expiry_date) : '--'}</em>
                </article>
              ))}
            </div>
          </DrawerSection>
        ) : null}

        {activeTab === 'Viện phí' ? (
          <DrawerSection title="Billing" icon={WalletCards}>
            <div className="rx-detail-grid">
              <article><small>Tạm tính</small><strong>{formatCurrency(row.billing_summary?.estimated_amount)}</strong></article>
              <article><small>Charge</small><strong>{formatNumber(row.billing_summary?.charge_count)}</strong></article>
              <article><small>Lỗi charge</small><strong>{row.billing_summary?.has_charge_error ? 'Có' : 'Không'}</strong></article>
            </div>
          </DrawerSection>
        ) : null}

        {activeTab === 'Timeline' ? (
          <DrawerSection title="Timeline" icon={History}>
            <ol className="rx-timeline">
              <li><strong>Tạo đơn</strong><span>{formatDateTime(row.prescribed_at || row.requested_at)}</span></li>
              {row.verified_at ? <li><strong>Duyệt đơn</strong><span>{formatDateTime(row.verified_at)}</span></li> : null}
              {row.latest_dispense ? <li><strong>Cấp phát</strong><span>{row.latest_dispense.dispense_no} · {row.latest_dispense.status}</span></li> : null}
              {row.completed_at ? <li><strong>Hoàn tất</strong><span>{formatDateTime(row.completed_at)}</span></li> : null}
              {row.cancelled_at ? <li><strong>Hủy</strong><span>{formatDateTime(row.cancelled_at)}</span></li> : null}
            </ol>
          </DrawerSection>
        ) : null}

        {activeTab === 'Ghi chú' ? (
          <DrawerSection title="Ghi chú / trao đổi" icon={FileText}>
            <p className="rx-note">{row.note || row.reason || row.cancel_reason || 'Chưa có ghi chú.'}</p>
          </DrawerSection>
        ) : null}
      </div>
    </aside>
  );
}

export function PrescriptionCommandCenterPage({ group = 'history' }) {
  const config = PAGE_CONFIG[group] || PAGE_CONFIG.history;
  const [filters, setFilters] = useState({
    search: '',
    priority: '',
    riskType: '',
    dateFrom: '',
    dateTo: '',
    department: '',
    sort: config.sort,
    page: 1,
    limit: 25,
  });
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Tổng quan');
  const [toast, setToast] = useState('');

  const rows = state.data?.items || [];
  const pagination = state.data?.pagination || {};
  const metrics = useMemo(() => getMetrics(state.data, group), [state.data, group]);

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const loader = config.useRiskQueue ? loadPrescriptionRiskQueue : loadPrescriptionWorkbench;
      const data = await loader({ ...filters, statusGroup: group, sort: filters.sort || config.sort });
      setState({ loading: false, error: '', data });
    } catch (error) {
      setState({ loading: false, error: getApiErrorMessage(error, 'Không thể tải prescription workbench.'), data: null });
    }
  }

  useEffect(() => {
    refresh();
  }, [group, filters.search, filters.priority, filters.riskType, filters.dateFrom, filters.dateTo, filters.department, filters.sort, filters.page]);

  async function openDrawer(row) {
    setSelected(row);
    setActiveTab('Tổng quan');
    setDetail(null);
    if (!row.prescription_id || row.status_group === 'refill') return;
    setDetailLoading(true);
    try {
      const response = await prescriptionAPI.detail(row.prescription_id);
      setDetail(response?.data?.data || response?.data || null);
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể tải chi tiết đơn thuốc.'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function runAction(action, row) {
    try {
      if (action === 'verify' || action === 'override_verify') {
        const hasOverride = Number(row.risk_summary?.allergy_count || 0) > 0 || Number(row.risk_summary?.interaction_count || 0) > 0;
        const reason = hasOverride ? promptPharmacyText({ title: 'Override duyệt đơn', message: 'Nhập lý do override/duyệt đơn có cảnh báo.', defaultValue: '' }) : '';
        if (hasOverride && !reason) return;
        await prescriptionAPI.verify(row.prescription_id, {
          override_allergy: Number(row.risk_summary?.allergy_count || 0) > 0,
          override_allergy_reason: reason || undefined,
          override_interaction_warning_reason: Number(row.risk_summary?.interaction_count || 0) > 0 ? reason : undefined,
        });
        setToast('Đã duyệt đơn thuốc.');
      } else if (action === 'create_dispense' || action === 'dispense_preview') {
        await prescriptionAPI.createDispense(row.prescription_id, { allow_multiple_drafts: true, note: 'Tạo từ Prescription Command Center.' });
        setToast('Đã tạo phiếu cấp phát.');
      } else if (action === 'cancel') {
        const reason = promptPharmacyText({ title: 'Hủy đơn thuốc', message: row.prescription_no || row.prescription_id || '', defaultValue: '' });
        if (!reason) return;
        await prescriptionAPI.cancel(row.prescription_id, { reason });
        setToast('Đã hủy đơn thuốc.');
      } else if (action === 'complete') {
        await prescriptionAPI.complete(row.prescription_id, {});
        setToast('Đã hoàn tất đơn thuốc.');
      } else if (action === 'duplicate') {
        await prescriptionAPI.duplicate(row.prescription_id);
        setToast('Đã nhân bản đơn thuốc.');
      } else if (action === 'renew') {
        const reason = promptPharmacyText({ title: 'Renew đơn thuốc', message: row.prescription_no || row.prescription_id || '', defaultValue: '' });
        if (!reason) return;
        await prescriptionAPI.renew(row.prescription_id, { reason });
        setToast('Đã renew đơn thuốc.');
      } else if (action === 'approve_refill') {
        await prescriptionAPI.approveRefillRequest(row.refill_request_id, { note: 'Duyệt từ Prescription Command Center.' });
        setToast('Đã duyệt yêu cầu refill.');
      } else if (action === 'reject_refill') {
        const reason = promptPharmacyText({ title: 'Từ chối refill', message: row.request_no || row.refill_request_id || '', defaultValue: '' });
        if (!reason) return;
        await prescriptionAPI.rejectRefillRequest(row.refill_request_id, { reason });
        setToast('Đã từ chối yêu cầu refill.');
      } else if (action === 'convert_refill' || action === 'convert_to_prescription') {
        const reason = promptPharmacyText({ title: 'Tạo đơn renew từ refill', message: row.request_no || row.refill_request_id || '', defaultValue: '' });
        if (!reason) return;
        await prescriptionAPI.convertRefillRequestToPrescription(row.refill_request_id, { reason });
        setToast('Đã tạo đơn renew từ refill request.');
      } else if (action === 'send_to_doctor') {
        await prescriptionAPI.sendRefillRequestToDoctor(row.refill_request_id, { note: 'Cần bác sĩ xác nhận refill.' });
        setToast('Đã gửi yêu cầu cho bác sĩ.');
      } else {
        setToast('Workflow backend cho thao tác này đã được đánh dấu trong action bar.');
      }
      await refresh();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không thể thực hiện thao tác.');
      setToast(message);
      notifyPharmacy({ tone: 'danger', title: 'Đơn thuốc', message });
    }
  }

  return (
    <div className="rx-command-page">
      {toast ? <button type="button" className="rx-toast" onClick={() => setToast('')}><span>{toast}</span><X size={14} /></button> : null}
      <CommandHeader
        config={config}
        onRefresh={refresh}
        loading={state.loading}
        onScan={() => notifyPharmacy({ title: 'Quét mã đơn', message: 'Quét barcode hoặc nhập mã vào ô tìm kiếm để mở đúng đơn thuốc.' })}
        onPrint={() => printPharmacyView('In danh sách đơn thuốc')}
        onExport={() => downloadPharmacyJson(`don-thuoc-${group}.json`, { group, filters, rows }, 'Xuất danh sách đơn thuốc')}
      />
      <section className="rx-kpi-strip">
        {metrics.map((metric) => <Metric key={metric.label} {...metric} value={formatNumber(metric.value)} />)}
      </section>
      <FilterBar filters={filters} setFilters={setFilters} group={group} />
      {state.error ? (
        <section className="rx-error">
          <AlertTriangle size={18} />
          <span>{state.error}</span>
          <button type="button" onClick={refresh}>Thử lại</button>
        </section>
      ) : null}
      <section className="rx-worklist-shell">
        <header>
          <div>
            <span>Smart worklist</span>
            <h2>{config.title}</h2>
          </div>
          <div className="rx-worklist-meta">
            <select value={filters.sort} onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value }))}>
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="sla">SLA</option>
              <option value="risk">Risk score</option>
            </select>
            <span>{formatNumber(pagination.total_items || pagination.total || rows.length)} dòng</span>
          </div>
        </header>
        <WorkbenchTable rows={rows} loading={state.loading} group={group} onSelect={openDrawer} onAction={runAction} />
      </section>
      <DetailDrawer
        row={selected}
        detail={detail}
        loading={detailLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onClose={() => setSelected(null)}
        onAction={runAction}
      />
    </div>
  );
}
