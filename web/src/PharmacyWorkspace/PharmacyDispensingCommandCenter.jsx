import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Layers3,
  Lock,
  PackageCheck,
  Pill,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Timer,
  Unlock,
  UserCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { getApiErrorMessage, pharmacyOverviewAPI, prescriptionAPI, unwrapData } from '../utils/api';
import {
  loadDispenseDetailForCommand,
  loadDispenseHolds,
  loadDispensePrintJobs,
  loadDispenseReturns,
  loadDispensesForCommand,
  loadDispensingAnalytics,
  loadDispensingQueue,
  loadDispensingQueueSummary,
} from './pharmacyApi';

const VIEW_CONFIG = {
  queue: {
    eyebrow: 'Nhà thuốc & Kho dược / Cấp phát thuốc',
    title: 'Queue cấp phát',
    description: 'Điều phối đơn đã duyệt, cảnh báo tồn kho, FEFO, tạo phiếu và xử lý nhanh trước khi soạn thuốc.',
    icon: PackageCheck,
  },
  preparing: {
    eyebrow: 'Nhà thuốc & Kho dược / Cấp phát thuốc',
    title: 'Phiếu đang chuẩn bị',
    description: 'Quản lý picking, checking, lock phiếu, checklist chuẩn bị, chọn lô và đưa sang sẵn sàng bàn giao.',
    icon: FileText,
  },
  pendingCompletion: {
    eyebrow: 'Nhà thuốc & Kho dược / Cấp phát thuốc',
    title: 'Chờ hoàn tất cấp phát',
    description: 'Final gate trước khi trừ kho thật: preview tồn kho, charge, checklist, cảnh báo cuối và hoàn tất phiếu.',
    icon: Clock3,
  },
  completed: {
    eyebrow: 'Nhà thuốc & Kho dược / Cấp phát thuốc',
    title: 'Đã cấp phát',
    description: 'Tra cứu phiếu đã cấp, batch, giao dịch kho, charge, in lại nhãn và tạo hoàn trả.',
    icon: CheckCircle2,
  },
  heldRejected: {
    eyebrow: 'Nhà thuốc & Kho dược / Cấp phát thuốc',
    title: 'Tạm giữ / từ chối',
    description: 'Theo dõi hold do thiếu tồn, dị ứng, tương tác, chờ bác sĩ, chờ thanh toán hoặc bệnh nhân từ chối.',
    icon: ShieldAlert,
  },
  returns: {
    eyebrow: 'Nhà thuốc & Kho dược / Cấp phát thuốc',
    title: 'Hoàn trả thuốc',
    description: 'Tìm phiếu đã cấp, preview hoàn kho, void/reduce charge, tạo biên bản và theo dõi lịch sử hoàn trả.',
    icon: RotateCcw,
  },
  labels: {
    eyebrow: 'Nhà thuốc & Kho dược / Cấp phát thuốc',
    title: 'In nhãn & hướng dẫn',
    description: 'Preview nhãn thuốc, hướng dẫn sử dụng, in lại, in hàng loạt và theo dõi print job.',
    icon: Printer,
  },
};

const STATUS_LABELS = {
  draft: 'Draft',
  created: 'Mới tạo',
  assigned: 'Đã gán',
  picking: 'Đang lấy thuốc',
  checking: 'Đang kiểm tra',
  ready_to_handover: 'Sẵn sàng bàn giao',
  blocked: 'Bị tạm giữ',
  partially_dispensed: 'Cấp một phần',
  dispensed: 'Đã cấp',
  returned: 'Hoàn trả',
  cancelled: 'Đã hủy',
  verified: 'Đã duyệt',
  active: 'Đang hoạt động',
  completed: 'Hoàn tất',
  active_hold: 'Hold active',
  requested: 'Requested',
  approved: 'Approved',
  printed: 'Đã in',
  queued: 'Chờ in',
  failed: 'Lỗi in',
  resolved: 'Đã xử lý',
  rejected: 'Từ chối',
};

const HOLD_TYPE_LABELS = {
  insufficient_stock: 'Thiếu tồn',
  allergy_risk: 'Dị ứng',
  interaction_risk: 'Tương tác',
  duplicate_medication: 'Trùng thuốc',
  waiting_payment: 'Chờ thanh toán',
  doctor_clarification: 'Chờ bác sĩ',
  patient_refused: 'BN từ chối',
  batch_recall: 'Lô recall',
  batch_quarantine: 'Lô cách ly',
  controlled_drug_policy: 'Thuốc kiểm soát',
  other: 'Khác',
};

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
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (['danger', 'warning', 'info', 'success', 'purple', 'muted'].includes(normalized)) return normalized;
  if (['critical', 'cancelled', 'failed', 'rejected', 'blocked'].includes(normalized)) return 'danger';
  if (['high', 'draft', 'created', 'assigned', 'picking', 'checking', 'requested', 'queued'].includes(normalized)) return 'warning';
  if (['verified', 'ready_to_handover', 'approved'].includes(normalized)) return 'info';
  if (['dispensed', 'completed', 'printed', 'resolved'].includes(normalized)) return 'success';
  if (['partially_dispensed'].includes(normalized)) return 'purple';
  return 'muted';
}

function StatusBadge({ value, label }) {
  return (
    <span className={`dispensing-status is-${statusTone(value)}`}>
      {label || STATUS_LABELS[value] || value || '--'}
    </span>
  );
}

function riskTone(count) {
  return Number(count || 0) > 0 ? 'danger' : 'success';
}

function KpiCard({ icon: Icon, label, value, hint, tone = 'neutral' }) {
  return (
    <article className={`dispensing-kpi is-${tone}`}>
      <span><Icon size={20} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{hint}</em>
    </article>
  );
}

function EmptyState({ loading, title = 'Không có dữ liệu', body = 'Thử đổi bộ lọc hoặc làm mới.' }) {
  return (
    <section className="dispensing-empty">
      {loading ? <RefreshCw className="is-spinning" size={22} /> : <CheckCircle2 size={23} />}
      <strong>{loading ? 'Đang tải dữ liệu' : title}</strong>
      <span>{loading ? 'Đang gom prescription, dispense, tồn kho, charge và hold.' : body}</span>
    </section>
  );
}

function PageHeader({ config, filters, setFilters, onRefresh, loading, children }) {
  const Icon = config.icon;
  return (
    <section className="dispensing-header">
      <div className="dispensing-header__title">
        <span>{config.eyebrow}</span>
        <h1><Icon size={27} />{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <div className="dispensing-header__right">
        <div className="dispensing-live-strip">
          <span><Clock3 size={14} />Ngày làm việc {new Date().toLocaleDateString('vi-VN')}</span>
          <span><Boxes size={14} />Kho/quầy mặc định</span>
          <span><BadgeCheck size={14} />Realtime online</span>
        </div>
        <div className="dispensing-filters">
          <label className="is-wide">
            <Search size={15} />
            <input
              value={filters.search || ''}
              placeholder="Mã đơn, mã phiếu, bệnh nhân, SĐT..."
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
            />
          </label>
          <label>
            <Filter size={15} />
            <select value={filters.risk || ''} onChange={(event) => setFilters((current) => ({ ...current, risk: event.target.value, page: 1 }))}>
              <option value="">Cảnh báo</option>
              <option value="shortage">Thiếu tồn</option>
              <option value="allergy">Dị ứng</option>
              <option value="interaction">Tương tác</option>
              <option value="missing_price">Thiếu giá</option>
            </select>
          </label>
          {children}
          <button type="button" title="Quét barcode" aria-label="Quét barcode">
            <Barcode size={16} />
          </button>
          <button type="button" title="Làm mới" aria-label="Làm mới" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'is-spinning' : ''} />
          </button>
        </div>
      </div>
    </section>
  );
}

function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <section className="dispensing-error">
      <AlertTriangle size={17} />
      <span>{error}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </section>
  );
}

function getQueueMetrics(summary = {}, analytics = {}) {
  return [
    { icon: Clock3, label: 'Chờ cấp phát', value: summary.waiting_prescriptions, hint: 'đơn verified/partial', tone: 'info' },
    { icon: FileText, label: 'Đang chuẩn bị', value: summary.draft_dispenses, hint: 'dispense draft', tone: 'warning' },
    { icon: AlertTriangle, label: 'Thiếu tồn', value: summary.stock_shortage, hint: 'cần FEFO/đổi thuốc', tone: 'danger' },
    { icon: ShieldAlert, label: 'Cảnh báo dị ứng', value: summary.allergy_warning, hint: 'manual review', tone: 'danger' },
    { icon: WalletCards, label: 'Thiếu giá', value: summary.missing_price, hint: 'không tạo charge', tone: 'purple' },
    { icon: CheckCircle2, label: 'Đã cấp hôm nay', value: summary.completed_today || analytics.summary?.dispensed_count, hint: `${formatNumber(summary.avg_wait_minutes)} phút chờ TB`, tone: 'success' },
    { icon: RotateCcw, label: 'Hoàn trả hôm nay', value: summary.returned_today, hint: 'void/reduce charge', tone: 'muted' },
    { icon: Printer, label: 'Chờ in', value: summary.queued_print_jobs, hint: 'nhãn/hướng dẫn', tone: 'neutral' },
  ];
}

function queueRowId(row) {
  return row.prescription?.prescription_id || row.dispense?.dispense_id || row.id || row._id;
}

function patientLabel(row) {
  const patient = row.patient || row.patient_id || {};
  return patient.full_name || patient.patient_code || row.patient_name || '--';
}

function prescriptionNo(row) {
  return row.prescription?.prescription_no || row.prescription_id?.prescription_no || row.prescription_no || '--';
}

function dispenseNo(row) {
  return row.dispense?.dispense_no || row.dispense_id?.dispense_no || row.dispense_no || '--';
}

function dispenseIdFromRow(row) {
  return row.dispense?.dispense_id || row.dispense_id?._id || row.dispense_id || row._id || row.id;
}

function QueueTable({ rows, loading, onSelect, onAction }) {
  if (loading || !rows.length) return <EmptyState loading={loading} title="Queue đang trống" body="Chưa có đơn phù hợp để cấp phát." />;
  return (
    <div className="dispensing-table-scroll">
      <table className="dispensing-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>Chờ</th>
            <th>Đơn / phiếu</th>
            <th>Bệnh nhân</th>
            <th>Khoa / bác sĩ</th>
            <th>Thuốc</th>
            <th>Tồn kho</th>
            <th>An toàn</th>
            <th>Viện phí</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={queueRowId(row)}>
              <td><StatusBadge value={row.priority} label={String(row.priority || 'low').toUpperCase()} /></td>
              <td><strong>{formatNumber(row.sla?.waiting_minutes)} phút</strong><small>{row.sla?.is_overdue ? 'Quá SLA' : 'Đúng hạn'}</small></td>
              <td>
                <strong>{prescriptionNo(row)}</strong>
                <small>{row.dispense?.dispense_no || 'Chưa tạo phiếu'}</small>
              </td>
              <td>
                <span>{patientLabel(row)}</span>
                <small>{[row.patient?.patient_code, row.patient?.phone].filter(Boolean).join(' · ') || '--'}</small>
              </td>
              <td>
                <span>{row.encounter?.department_id?.department_name || row.encounter?.encounter_code || '--'}</span>
                <small>{row.doctor?.full_name || '--'}</small>
              </td>
              <td>
                <span>{formatNumber(row.items_summary?.remaining_items)} dòng còn lại</span>
                <small>{formatNumber(row.items_summary?.dispensed_quantity)}/{formatNumber(row.items_summary?.total_quantity)} {row.items_summary?.remaining_quantity ? 'đã cấp' : ''}</small>
              </td>
              <td>
                <StatusBadge value={riskTone(row.stock_summary?.shortage_items_count)} label={row.stock_summary?.shortage_items_count ? `Thiếu ${row.stock_summary.shortage_items_count}` : 'Đủ tồn'} />
                <small>{row.stock_summary?.near_expiry_items_count ? `${row.stock_summary.near_expiry_items_count} gần hết hạn` : 'FEFO OK'}</small>
              </td>
              <td>
                <div className="dispensing-risk-pills">
                  {row.safety_summary?.has_allergy_warning ? <span className="is-danger">Dị ứng</span> : null}
                  {row.safety_summary?.has_interaction_warning ? <span className="is-warning">Tương tác</span> : null}
                  {row.safety_summary?.has_duplicate_warning ? <span className="is-purple">Trùng thuốc</span> : null}
                  {!row.safety_summary?.has_allergy_warning && !row.safety_summary?.has_duplicate_warning ? <em>Ổn</em> : null}
                </div>
              </td>
              <td>
                <span>{row.billing_summary?.missing_price_count ? 'Thiếu giá' : 'Có thể charge'}</span>
                <small>{formatNumber(row.billing_summary?.missing_price_count)} lỗi</small>
              </td>
              <td>
                <div className="dispensing-row-actions">
                  <button type="button" title="Xem xử lý" onClick={() => onSelect(row)}><Eye size={15} /></button>
                  {!row.dispense ? <button type="button" title="Tạo phiếu" onClick={() => onAction('create_dispense', row)}><PackageCheck size={15} /></button> : null}
                  {row.dispense ? <button type="button" title="Tiếp tục" onClick={() => onAction('start', row)}><UserCheck size={15} /></button> : null}
                  {row.dispense ? <button type="button" title="Preview FEFO" onClick={() => onAction('preview', row)}><Layers3 size={15} /></button> : null}
                  <button type="button" title="Tạm giữ" onClick={() => onAction('hold', row)}><Ban size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DispenseTable({ rows, loading, view, onSelect, onAction }) {
  if (loading || !rows.length) return <EmptyState loading={loading} title="Chưa có phiếu phù hợp" body="Danh sách sẽ cập nhật khi có phiếu trong trạng thái này." />;
  return (
    <div className="dispensing-table-scroll">
      <table className="dispensing-table">
        <thead>
          <tr>
            <th>Mã phiếu</th>
            <th>Mã đơn</th>
            <th>Bệnh nhân</th>
            <th>Workflow</th>
            <th>Dược sĩ</th>
            <th>Lock</th>
            <th>Hold</th>
            <th>Thời gian</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id || row.id}>
              <td><strong>{dispenseNo(row)}</strong><small>{row.priority || 'medium'}</small></td>
              <td>{prescriptionNo(row)}</td>
              <td><span>{patientLabel(row)}</span><small>{row.patient_id?.patient_code || '--'}</small></td>
              <td><StatusBadge value={row.workflow_stage || row.status} /></td>
              <td>{row.assigned_to?.full_name || row.dispensed_by?.full_name || '--'}</td>
              <td>{row.locked_by ? <StatusBadge value="warning" label={row.locked_by.full_name || 'Locked'} /> : <span className="dispensing-muted">Mở</span>}</td>
              <td>{formatNumber(row.active_hold_count || 0)}</td>
              <td><span>{formatDateTime(row.created_at)}</span><small>{row.completed_at ? formatDateTime(row.completed_at) : '--'}</small></td>
              <td><StatusBadge value={row.status} /></td>
              <td>
                <div className="dispensing-row-actions">
                  <button type="button" title="Chi tiết" onClick={() => onSelect(row)}><Eye size={15} /></button>
                  {view !== 'completed' ? <button type="button" title="Gán cho tôi" onClick={() => onAction('assign', row)}><UserCheck size={15} /></button> : null}
                  {view !== 'completed' ? <button type="button" title="Khóa phiếu" onClick={() => onAction('lock', row)}><Lock size={15} /></button> : null}
                  {view !== 'completed' ? <button type="button" title="Mở khóa" onClick={() => onAction('unlock', row)}><Unlock size={15} /></button> : null}
                  {view === 'preparing' ? <button type="button" title="Sẵn sàng bàn giao" onClick={() => onAction('ready', row)}><ClipboardCheck size={15} /></button> : null}
                  {view !== 'preparing' ? <button type="button" title="Preview" onClick={() => onAction('preview', row)}><Layers3 size={15} /></button> : null}
                  {view === 'pendingCompletion' ? <button type="button" title="Hoàn tất" onClick={() => onAction('complete', row)}><CheckCircle2 size={15} /></button> : null}
                  {view === 'completed' ? <button type="button" title="Hoàn trả" onClick={() => onAction('return', row)}><RotateCcw size={15} /></button> : null}
                  <button type="button" title="In nhãn" onClick={() => onAction('print_label', row)}><Printer size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HoldTable({ rows, loading, onSelect, onAction }) {
  if (loading || !rows.length) return <EmptyState loading={loading} title="Không có case hold" body="Chưa có tạm giữ hoặc từ chối trong bộ lọc hiện tại." />;
  return (
    <div className="dispensing-table-scroll">
      <table className="dispensing-table">
        <thead>
          <tr>
            <th>Mức độ</th>
            <th>Mã hold</th>
            <th>Loại</th>
            <th>Phiếu / đơn</th>
            <th>Bệnh nhân</th>
            <th>Lý do</th>
            <th>SLA</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id || row.id}>
              <td><StatusBadge value={row.severity} label={String(row.severity || '').toUpperCase()} /></td>
              <td><strong>{row.hold_no}</strong><small>{formatDateTime(row.created_at)}</small></td>
              <td>{HOLD_TYPE_LABELS[row.hold_type] || row.hold_type}</td>
              <td><span>{row.dispense_id?.dispense_no || '--'}</span><small>{row.prescription_id?.prescription_no || '--'}</small></td>
              <td>{patientLabel(row)}</td>
              <td><span>{row.reason}</span><small>{row.note || '--'}</small></td>
              <td><span className={parseDate(row.due_at) && parseDate(row.due_at) < new Date() ? 'dispensing-sla is-overdue' : 'dispensing-sla'}>{formatDateTime(row.due_at)}</span></td>
              <td><StatusBadge value={row.status} /></td>
              <td>
                <div className="dispensing-row-actions">
                  <button type="button" title="Chi tiết" onClick={() => onSelect(row)}><Eye size={15} /></button>
                  {row.status === 'active' ? <button type="button" title="Gỡ hold" onClick={() => onAction('resolve_hold', row)}><CheckCircle2 size={15} /></button> : null}
                  {row.status === 'active' ? <button type="button" title="Từ chối" onClick={() => onAction('reject_hold', row)}><Ban size={15} /></button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReturnsTable({ rows, loading, onSelect, onAction }) {
  if (loading || !rows.length) return <EmptyState loading={loading} title="Chưa có hoàn trả" body="Tạo hoàn trả từ phiếu đã cấp hoặc đổi bộ lọc." />;
  return (
    <div className="dispensing-table-scroll">
      <table className="dispensing-table">
        <thead>
          <tr>
            <th>Mã hoàn trả</th>
            <th>Phiếu cấp phát</th>
            <th>Bệnh nhân</th>
            <th>Lý do</th>
            <th>Người yêu cầu</th>
            <th>Thời điểm</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id || row.id}>
              <td><strong>{row.return_no}</strong></td>
              <td>{row.dispense_id?.dispense_no || '--'}</td>
              <td>{patientLabel(row)}</td>
              <td>{row.reason}</td>
              <td>{row.requested_by?.full_name || '--'}</td>
              <td><span>{formatDateTime(row.requested_at)}</span><small>{row.completed_at ? formatDateTime(row.completed_at) : '--'}</small></td>
              <td><StatusBadge value={row.status} /></td>
              <td>
                <div className="dispensing-row-actions">
                  <button type="button" title="Chi tiết" onClick={() => onSelect(row)}><Eye size={15} /></button>
                  {row.status !== 'completed' ? <button type="button" title="Hoàn tất" onClick={() => onAction('complete_return', row)}><CheckCircle2 size={15} /></button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrintJobsPanel({ printJobs = [], loading }) {
  return (
    <aside className="dispensing-side-panel">
      <header>
        <span>Print history</span>
        <h2>Nhật ký in</h2>
      </header>
      {loading ? <EmptyState loading /> : null}
      {!loading && printJobs.map((job) => (
        <article key={job._id || job.id}>
          <Printer size={16} />
          <div>
            <strong>{job.print_job_no}</strong>
            <span>{job.print_type} · {job.dispense_id?.dispense_no || '--'}</span>
          </div>
          <StatusBadge value={job.status} />
        </article>
      ))}
      {!loading && !printJobs.length ? <span className="dispensing-muted">Chưa có print job.</span> : null}
    </aside>
  );
}

function PreviewDrawer({ preview, onClose }) {
  if (!preview) return null;
  return (
    <aside className="dispensing-drawer is-wide">
      <header>
        <div>
          <span>Preview hoàn tất cấp phát</span>
          <h2>{preview.can_complete === false ? 'Không đủ điều kiện' : 'Có thể hoàn tất'}</h2>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="dispensing-drawer__body">
        <section className={`dispensing-preview-state ${preview.can_complete === false ? 'is-danger' : 'is-success'}`}>
          {preview.can_complete === false ? 'Có lỗi chặn hoàn tất cấp phát' : 'FEFO, tồn kho và charge đã được preview'}
        </section>
        {(preview.shortages || []).map((item) => (
          <article key={item.medication_id} className="dispensing-warning-card">
            <AlertTriangle size={17} />
            <div>
              <strong>{item.message}</strong>
              <span>Thiếu {formatNumber(item.shortage)} / cần {formatNumber(item.requested_quantity)}</span>
            </div>
          </article>
        ))}
        {(preview.allocations || []).map((allocation) => (
          <section key={allocation.prescription_item_id} className="dispensing-preview-block">
            <h3>{allocation.medication_name}</h3>
            <span>Cấp {formatNumber(allocation.requested_quantity)} {allocation.unit || ''}</span>
            <table className="dispensing-table is-compact">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>Lot</th>
                  <th>Hạn dùng</th>
                  <th>Vị trí</th>
                  <th>SL</th>
                  <th>Tồn sau</th>
                </tr>
              </thead>
              <tbody>
                {(allocation.batches || []).map((batch) => (
                  <tr key={batch.stock_batch_id}>
                    <td>{batch.batch_no || '--'}</td>
                    <td>{batch.lot_no || '--'}</td>
                    <td>{formatDateTime(batch.expiry_date)}</td>
                    <td>{batch.storage_location || '--'}</td>
                    <td>{formatNumber(batch.quantity)}</td>
                    <td>{formatNumber(batch.quantity_on_hand_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <footer className="dispensing-charge-preview">
          <span>Charge dự kiến</span>
          <strong>{formatCurrency(preview.charge_preview?.total_amount || 0)}</strong>
        </footer>
      </div>
    </aside>
  );
}

function DetailDrawer({ row, detailState, onClose, onAction }) {
  if (!row) return null;
  const detail = detailState?.detail?.detail || detailState?.detail || {};
  const dispense = detail.dispense || row.dispense || row;
  const items = row.item_details || detail.items || [];
  const checklist = detailState?.checklist?.items || [];
  const timeline = detailState?.timeline?.events || [];
  const charges = detail.charges || [];
  const transactions = detail.inventory_transactions || [];
  return (
    <aside className="dispensing-drawer">
      <header>
        <div>
          <span>{dispense?.dispense_no ? 'Chi tiết phiếu cấp phát' : 'Chi tiết queue cấp phát'}</span>
          <h2>{dispense?.dispense_no || prescriptionNo(row)}</h2>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="dispensing-drawer__tabs">
        {['Tổng quan', 'Thuốc', 'Tồn kho / FEFO', 'Checklist', 'Charge', 'Timeline', 'In nhãn'].map((tab) => <span key={tab}>{tab}</span>)}
      </div>
      <div className="dispensing-drawer__body">
        <section className="dispensing-detail-grid">
          <article><small>Bệnh nhân</small><strong>{patientLabel(row) || dispense?.patient_id?.full_name}</strong><span>{row.patient?.patient_code || dispense?.patient_id?.patient_code || '--'}</span></article>
          <article><small>Đơn thuốc</small><strong>{prescriptionNo(row)}</strong><span>{row.prescription?.status || dispense?.prescription_id?.status || '--'}</span></article>
          <article><small>Phiếu</small><strong>{dispense?.dispense_no || '--'}</strong><StatusBadge value={dispense?.workflow_stage || dispense?.status} /></article>
          <article><small>Hold active</small><strong>{formatNumber(row.hold_summary?.active_hold_count || dispense?.active_hold_count || 0)}</strong><span>{row.hold_summary?.latest_reason || dispense?.last_hold_reason || '--'}</span></article>
        </section>

        <section className="dispensing-drawer-section">
          <h3><Pill size={17} />Thuốc trong đơn / phiếu</h3>
          <div className="dispensing-med-lines">
            {items.map((item) => (
              <article key={item.prescription_item_id || item._id}>
                <div>
                  <strong>{item.medication_name || item.medication_id?.brand_name || item.medication_id?.generic_name || 'Thuốc'}</strong>
                  <small>{[item.dose || item.prescription_item_id?.dose, item.route || item.prescription_item_id?.route, item.frequency || item.prescription_item_id?.frequency].filter(Boolean).join(' · ') || item.instructions || '--'}</small>
                </div>
                <span>{formatNumber(item.dispensed_quantity ?? item.quantity)}/{formatNumber(item.quantity)} {item.unit}</span>
                <em>{item.stock?.fefo_batch?.batch_no || item.stock_batch_id?.batch_no || '--'}</em>
              </article>
            ))}
            {!items.length ? <span className="dispensing-muted">Chưa có dòng thuốc.</span> : null}
          </div>
        </section>

        <section className="dispensing-drawer-section">
          <h3><ClipboardCheck size={17} />Checklist chuẩn bị</h3>
          <div className="dispensing-checklist">
            {checklist.map((item) => (
              <button key={item.code} type="button" className={item.status === 'checked' ? 'is-checked' : ''} onClick={() => dispense?._id && onAction('check_item', { ...row, checklistCode: item.code, _id: dispense._id })}>
                <CheckCircle2 size={15} />
                <span>{item.label}</span>
                <em>{item.status}</em>
              </button>
            ))}
            {!checklist.length ? <span className="dispensing-muted">Checklist sẽ xuất hiện khi mở phiếu draft.</span> : null}
          </div>
        </section>

        <section className="dispensing-drawer-section">
          <h3><WalletCards size={17} />Charge / giao dịch kho</h3>
          <div className="dispensing-detail-grid">
            <article><small>Charge</small><strong>{formatNumber(charges.length)}</strong><span>{formatCurrency(charges.reduce((sum, charge) => sum + Number(charge.total_amount || 0), 0))}</span></article>
            <article><small>Inventory tx</small><strong>{formatNumber(transactions.length)}</strong><span>{transactions[0]?.transaction_no || '--'}</span></article>
          </div>
        </section>

        <section className="dispensing-drawer-section">
          <h3><Timer size={17} />Timeline</h3>
          <ol className="dispensing-timeline">
            {timeline.slice(0, 12).map((event, index) => (
              <li key={`${event.type}-${event.at}-${index}`}>
                <strong>{event.title}</strong>
                <span>{formatDateTime(event.at)} · {event.ref || event.type}</span>
              </li>
            ))}
            {!timeline.length ? <li><strong>Chưa có timeline chi tiết</strong><span>Dữ liệu sẽ có sau khi phiếu phát sinh thao tác.</span></li> : null}
          </ol>
        </section>
      </div>
    </aside>
  );
}

function buildDispenseLoaderParams(view, filters) {
  if (view === 'preparing') {
    return { ...filters, status: 'draft', workflowStage: filters.workflowStage || 'created,assigned,picking,checking,blocked' };
  }
  if (view === 'pendingCompletion') {
    return { ...filters, status: 'draft,partially_dispensed', workflowStage: filters.workflowStage || 'ready_to_handover' };
  }
  if (view === 'completed' || view === 'labels') {
    return { ...filters, status: 'dispensed' };
  }
  return filters;
}

export function PharmacyDispensingCommandCenterPage({ view = 'queue' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.queue;
  const [filters, setFilters] = useState({ search: '', risk: '', status: '', workflowStage: '', page: 1, limit: 25, range: 'today' });
  const [state, setState] = useState({ loading: true, error: '', data: null, summary: null, analytics: null });
  const [selected, setSelected] = useState(null);
  const [detailState, setDetailState] = useState(null);
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState('');

  const rows = state.data?.items || [];
  const printRows = state.data?.printJobs || [];
  const metrics = useMemo(() => getQueueMetrics(state.summary || {}, state.analytics || {}), [state.summary, state.analytics]);

  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      let data = null;
      let summary = await loadDispensingQueueSummary(filters);
      let analytics = null;
      if (view === 'queue') {
        [data, analytics] = await Promise.all([
          loadDispensingQueue(filters),
          loadDispensingAnalytics(filters).catch(() => null),
        ]);
      } else if (view === 'heldRejected') {
        data = await loadDispenseHolds(filters);
      } else if (view === 'returns') {
        data = await loadDispenseReturns(filters);
      } else if (view === 'labels') {
        const [dispenses, printJobs] = await Promise.all([
          loadDispensesForCommand(buildDispenseLoaderParams(view, filters)),
          loadDispensePrintJobs(filters),
        ]);
        data = { ...dispenses, printJobs: printJobs.items || [], printSummary: printJobs.summary };
      } else {
        data = await loadDispensesForCommand(buildDispenseLoaderParams(view, filters));
      }
      setState({ loading: false, error: '', data, summary, analytics });
    } catch (error) {
      setState({ loading: false, error: getApiErrorMessage(error, 'Không thể tải command center cấp phát.'), data: null, summary: null, analytics: null });
    }
  }

  useEffect(() => {
    refresh();
  }, [view, filters.search, filters.risk, filters.status, filters.workflowStage, filters.page]);

  async function openDrawer(row) {
    setSelected(row);
    setDetailState(null);
    const dispenseId = dispenseIdFromRow(row);
    if (!dispenseId || row.prescription) return;
    try {
      setDetailState(await loadDispenseDetailForCommand(dispenseId));
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể tải chi tiết phiếu.'));
    }
  }

  async function runAction(action, row) {
    const dispenseId = dispenseIdFromRow(row);
    try {
      if (action === 'create_dispense') {
        await prescriptionAPI.createDispense(row.prescription.prescription_id, { note: 'Tạo từ Queue cấp phát.', allow_multiple_drafts: false });
        setToast('Đã tạo phiếu cấp phát.');
      } else if (action === 'assign') {
        await prescriptionAPI.assignDispense(dispenseId, {});
        setToast('Đã gán phiếu cho bạn.');
      } else if (action === 'start') {
        await prescriptionAPI.startDispensePreparation(row.dispense?.dispense_id || dispenseId, {});
        setToast('Đã bắt đầu chuẩn bị phiếu.');
      } else if (action === 'lock') {
        await prescriptionAPI.lockDispense(dispenseId, {});
        setToast('Đã khóa phiếu.');
      } else if (action === 'unlock') {
        await prescriptionAPI.unlockDispense(dispenseId, {});
        setToast('Đã mở khóa phiếu.');
      } else if (action === 'ready') {
        await prescriptionAPI.changeDispenseStage(dispenseId, { stage: 'ready_to_handover' });
        await prescriptionAPI.completeDispenseChecklist(dispenseId, { override: true, override_reason: 'Hoàn tất từ UI chuẩn bị.' });
        setToast('Phiếu đã sẵn sàng bàn giao.');
      } else if (action === 'preview') {
        const response = await prescriptionAPI.previewDispenseCompletionPlan(row.dispense?.dispense_id || dispenseId, { create_charge: true });
        setPreview(unwrapData(response));
        return;
      } else if (action === 'complete') {
        if (!window.confirm(`Hoàn tất cấp phát phiếu ${dispenseNo(row)}?`)) return;
        await prescriptionAPI.completeDispense(dispenseId, { create_charge: true, allow_zero_price_charge: false });
        setToast('Đã hoàn tất cấp phát.');
      } else if (action === 'hold') {
        const targetDispenseId = row.dispense?.dispense_id || dispenseId;
        if (!targetDispenseId) {
          setToast('Cần tạo phiếu trước khi tạm giữ.');
          return;
        }
        const reason = window.prompt('Nhập lý do tạm giữ / từ chối');
        if (!reason) return;
        await prescriptionAPI.createDispenseHold(targetDispenseId, { hold_type: 'other', severity: 'medium', reason });
        setToast('Đã tạo hold cấp phát.');
      } else if (action === 'return') {
        const reason = window.prompt('Nhập lý do hoàn trả thuốc');
        if (!reason) return;
        await prescriptionAPI.createDispenseReturn(dispenseId, { reason, auto_complete: true });
        setToast('Đã tạo hoàn trả thuốc.');
      } else if (action === 'print_label') {
        await prescriptionAPI.printLabels(dispenseId, { copy_count: 1 });
        setToast('Đã tạo print job nhãn thuốc.');
      } else if (action === 'print_instruction') {
        await prescriptionAPI.printInstructions(dispenseId, { copy_count: 1 });
        setToast('Đã tạo print job hướng dẫn.');
      } else if (action === 'resolve_hold') {
        await pharmacyOverviewAPI.resolveDispenseHold(row._id || row.id, { resolution_type: 'continue_dispense', note: 'Gỡ hold từ UI.' });
        setToast('Đã gỡ hold.');
      } else if (action === 'reject_hold') {
        const note = window.prompt('Nhập lý do từ chối');
        if (!note) return;
        await pharmacyOverviewAPI.rejectDispenseHold(row._id || row.id, { resolution_type: 'rejected', note });
        setToast('Đã từ chối case hold.');
      } else if (action === 'complete_return') {
        await pharmacyOverviewAPI.completeDispenseReturn(row._id || row.id, { note: 'Hoàn tất từ UI.' });
        setToast('Đã hoàn tất hoàn trả.');
      } else if (action === 'check_item') {
        await prescriptionAPI.updateDispenseChecklistItem(row._id, row.checklistCode, { status: 'checked' });
        setToast('Đã cập nhật checklist.');
        setDetailState(await loadDispenseDetailForCommand(row._id));
      }
      await refresh();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể thực hiện thao tác.'));
    }
  }

  return (
    <div className="dispensing-command-page">
      {toast ? <button type="button" className="dispensing-toast" onClick={() => setToast('')}><span>{toast}</span><X size={14} /></button> : null}
      <PageHeader config={config} filters={filters} setFilters={setFilters} onRefresh={refresh} loading={state.loading}>
        {view === 'preparing' || view === 'pendingCompletion' ? (
          <label>
            <SlidersHorizontal size={15} />
            <select value={filters.workflowStage || ''} onChange={(event) => setFilters((current) => ({ ...current, workflowStage: event.target.value, page: 1 }))}>
              <option value="">Stage</option>
              <option value="created">Mới tạo</option>
              <option value="assigned">Đã gán</option>
              <option value="picking">Đang lấy</option>
              <option value="checking">Đang kiểm</option>
              <option value="ready_to_handover">Sẵn sàng</option>
              <option value="blocked">Bị giữ</option>
            </select>
          </label>
        ) : null}
      </PageHeader>
      <section className="dispensing-kpi-grid">
        {metrics.map((metric) => <KpiCard key={metric.label} {...metric} value={formatNumber(metric.value)} />)}
      </section>
      <ErrorBanner error={state.error} onRetry={refresh} />
      <section className={`dispensing-workspace${view === 'labels' ? ' has-side' : ''}`}>
        <main className="dispensing-main-panel">
          <header>
            <div>
              <span>Operational worklist</span>
              <h2>{config.title}</h2>
            </div>
            <div className="dispensing-panel-tools">
              <span>{formatNumber(state.data?.pagination?.total || state.data?.pagination?.total_items || rows.length)} dòng</span>
              <button type="button" onClick={refresh}><RefreshCw size={15} /></button>
            </div>
          </header>
          {view === 'queue' ? <QueueTable rows={rows} loading={state.loading} onSelect={openDrawer} onAction={runAction} /> : null}
          {['preparing', 'pendingCompletion', 'completed', 'labels'].includes(view) ? (
            <DispenseTable rows={rows} loading={state.loading} view={view} onSelect={openDrawer} onAction={runAction} />
          ) : null}
          {view === 'heldRejected' ? <HoldTable rows={rows} loading={state.loading} onSelect={openDrawer} onAction={runAction} /> : null}
          {view === 'returns' ? <ReturnsTable rows={rows} loading={state.loading} onSelect={openDrawer} onAction={runAction} /> : null}
        </main>
        {view === 'labels' ? <PrintJobsPanel printJobs={printRows} loading={state.loading} /> : null}
      </section>
      <DetailDrawer row={selected} detailState={detailState} onClose={() => setSelected(null)} onAction={runAction} />
      <PreviewDrawer preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
