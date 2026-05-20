import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileText,
  FileWarning,
  Filter,
  FlaskConical,
  History,
  LayoutGrid,
  MessageSquare,
  RefreshCw,
  ScanLine,
  Search,
  Settings2,
  ShieldAlert,
  Stethoscope,
  Timer,
  TimerOff,
  UploadCloud,
  UserRoundCheck,
  WalletCards,
  X,
} from 'lucide-react';
import { clinicalOrderCenterAPI, getClinicalOrderCenterError } from './clinicalOrderCenterApi';
import './clinicalOrderCenter.css';

const ORDER_TYPE_META = {
  lab: { label: 'Lab', icon: FlaskConical, tone: 'lab' },
  imaging: { label: 'CĐHA', icon: ScanLine, tone: 'imaging' },
  procedure: { label: 'Thủ thuật', icon: Stethoscope, tone: 'procedure' },
};

const PRIORITY_LABEL = {
  stat: 'STAT',
  urgent: 'Urgent',
  routine: 'Routine',
};

const STATUS_LABEL = {
  ordered: 'Chờ tiếp nhận',
  acknowledged: 'Đã tiếp nhận',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn tất',
  cancelled: 'Bị hủy',
  entered_in_error: 'Nhập sai',
};

const ACTION_LABEL = {
  view: 'Xem',
  timeline: 'Timeline',
  acknowledge: 'Tiếp nhận',
  assign: 'Gán',
  start: 'Bắt đầu',
  schedule: 'Xếp lịch',
  collect_specimen: 'Lấy mẫu',
  receive_specimen: 'Nhận mẫu',
  process_specimen: 'Chạy mẫu',
  create_result: 'Nhập kết quả',
  finalize_result: 'Duyệt kết quả',
  complete_technical: 'Hoàn tất kỹ thuật',
  upload_file: 'Upload file',
  create_report: 'Tạo báo cáo',
  finalize_report: 'Ký báo cáo',
  complete_procedure: 'Hoàn tất thủ thuật',
  create_charge: 'Tạo charge',
  release_to_doctor: 'Trả bác sĩ',
  release_to_patient: 'Release BN',
  notify_doctor: 'Báo bác sĩ',
  cancel: 'Hủy',
  entered_in_error: 'Nhập sai',
};

function todayKey() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPatientLine(row) {
  return [
    row?.patient?.gender,
    row?.patient?.date_of_birth ? `${Math.max(new Date().getFullYear() - new Date(row.patient.date_of_birth).getFullYear(), 0)} tuổi` : '',
    row?.encounter?.encounter_code,
  ].filter(Boolean).join(' · ');
}

function useOrderCenterFilters(defaults = {}) {
  const [filters, setFilters] = useState({
    date: todayKey(),
    scope: 'department',
    order_type: '',
    priority: '',
    status: '',
    child_status: '',
    result_status: '',
    report_status: '',
    has_attachment: '',
    has_charge: '',
    sla_status: '',
    search: '',
    page: 1,
    limit: 25,
    ...defaults,
  });

  function update(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: key === 'page' ? value : 1 }));
  }

  return [filters, update, setFilters];
}

function useOrderCenterData(loader, filters, fallback = { summary: {}, status_board: {}, items: [], pagination: {} }) {
  const [state, setState] = useState({ loading: true, error: '', data: fallback });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const key = JSON.stringify(filters || {});

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loader(filters)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data: data || fallback });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: getClinicalOrderCenterError(error), data: fallback });
      });
    return () => {
      active = false;
    };
  }, [loader, key, refreshIndex]);

  return { ...state, refresh: () => setRefreshIndex((current) => current + 1) };
}

function PriorityBadge({ priority }) {
  return <span className={`order-center-priority is-${priority || 'routine'}`}>{PRIORITY_LABEL[priority] || priority || '--'}</span>;
}

function OrderTypeBadge({ type }) {
  const meta = ORDER_TYPE_META[type] || { label: type || '--', icon: LayoutGrid, tone: 'neutral' };
  const Icon = meta.icon;
  return (
    <span className={`order-center-type is-${meta.tone}`}>
      <Icon size={13} strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }) {
  return <span className={`order-center-status is-${String(status || '').replace(/_/g, '-')}`}>{STATUS_LABEL[status] || status || '--'}</span>;
}

function SlaBadge({ sla }) {
  if (!sla) return <span className="order-center-sla is-muted">Không SLA</span>;
  const state = sla.state || sla.status || 'normal';
  const label = state === 'breached'
    ? `Quá ${formatNumber(sla.breached_minutes)}p`
    : state === 'completed'
      ? 'Đúng SLA'
      : state === 'completed_breached'
        ? `Trễ ${formatNumber(sla.breached_minutes)}p`
        : `Còn ${formatNumber(sla.remaining_minutes)}p`;
  return (
    <span className={`order-center-sla is-${state}`}>
      <Timer size={13} strokeWidth={2.2} />
      {label}
    </span>
  );
}

function FlagBadges({ row }) {
  const flags = row.flags || {};
  return (
    <div className="order-center-flags">
      {flags.is_critical ? <span className="is-critical"><ShieldAlert size={12} />Critical</span> : null}
      {flags.missing_file ? <span className="is-warning"><FileWarning size={12} />Thiếu file</span> : null}
      {flags.has_charge ? <span className="is-charge"><WalletCards size={12} />Charge</span> : null}
      {flags.released_to_patient ? <span className="is-release"><FileCheck2 size={12} />Release</span> : null}
    </div>
  );
}

function PatientCell({ row }) {
  return (
    <div className="order-center-patient">
      <strong>{row.patient?.patient_code || '--'} - {row.patient?.full_name || 'Chưa rõ bệnh nhân'}</strong>
      <span>{getPatientLine(row) || 'Chưa có encounter'}</span>
    </div>
  );
}

function KpiStrip({ summary = {}, loading }) {
  const items = [
    ['Tổng order', summary.total_orders ?? summary.total, LayoutGrid, 'neutral', 'Tất cả lab/CĐHA/thủ thuật'],
    ['STAT', summary.stat, ShieldAlert, 'danger', 'Ưu tiên cao nhất'],
    ['Urgent', summary.urgent, Clock3, 'warning', 'Cần xử lý nhanh'],
    ['Chờ tiếp nhận', summary.ordered, ClipboardCheck, 'info', 'Order mới vào'],
    ['Đang thực hiện', summary.in_progress, Activity, 'primary', 'Live work queue'],
    ['Hoàn tất', summary.completed, BadgeCheck, 'success', 'Đã xong kỹ thuật/kết quả'],
    ['Critical', summary.critical_unacknowledged ?? summary.critical, ShieldAlert, 'critical', 'Chưa/đã xử lý critical'],
    ['Quá SLA', summary.overdue, TimerOff, 'danger', 'Cần escalation'],
    ['Thiếu file', summary.missing_file, FileWarning, 'warning', 'Imaging/procedure'],
    ['Chờ duyệt/ký', summary.pending_approval, FileText, 'info', 'Result/report sơ bộ'],
    ['Release BN', summary.released_to_patient, FileCheck2, 'success', 'Đã phát hành'],
    ['Lab/CĐHA/TT', `${formatNumber(summary.lab)} / ${formatNumber(summary.imaging)} / ${formatNumber(summary.procedure)}`, FlaskConical, 'neutral', 'Cơ cấu module'],
  ];

  return (
    <section className="order-center-kpi-strip">
      {items.map(([label, value, Icon, tone, hint]) => (
        <button key={label} type="button" className={`is-${tone}`}>
          <Icon size={19} strokeWidth={2.25} />
          <span>
            <small>{label}</small>
            {loading ? <i className="order-center-mini-skeleton" /> : <strong>{typeof value === 'string' ? value : formatNumber(value)}</strong>}
            <em>{hint}</em>
          </span>
        </button>
      ))}
    </section>
  );
}

function StatusBoard({ board = {}, onSelect }) {
  const columns = [
    ['ordered', 'Ordered', ClipboardCheck],
    ['acknowledged', 'Acknowledged', UserRoundCheck],
    ['in_progress', 'In progress', Activity],
    ['completed', 'Completed', BadgeCheck],
    ['cancelled', 'Cancelled', AlertTriangle],
    ['entered_in_error', 'Entered in error', FileWarning],
  ];
  return (
    <section className="order-center-status-board">
      {columns.map(([status, label, Icon]) => {
        const bucket = board[status] || {};
        return (
          <button key={status} type="button" onClick={() => onSelect?.(status)}>
            <header>
              <Icon size={17} strokeWidth={2.25} />
              <strong>{label}</strong>
              <b>{formatNumber(bucket.total)}</b>
            </header>
            <div>
              <span>STAT {formatNumber(bucket.stat)}</span>
              <span>Urgent {formatNumber(bucket.urgent)}</span>
              <span>SLA {formatNumber(bucket.overdue)}</span>
              <span>Critical {formatNumber(bucket.critical)}</span>
            </div>
          </button>
        );
      })}
    </section>
  );
}

function FilterBar({ filters, update, refresh, loading, statusLocked = false }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  return (
    <section className="order-center-filters">
      <label>
        <CalendarDays size={15} />
        <input type="date" value={filters.date || ''} onChange={(event) => update('date', event.target.value)} />
      </label>
      <label>
        <LayoutGrid size={15} />
        <select value={filters.order_type || ''} onChange={(event) => update('order_type', event.target.value)}>
          <option value="">Lab + CĐHA + Thủ thuật</option>
          <option value="lab">Lab</option>
          <option value="imaging">CĐHA</option>
          <option value="procedure">Thủ thuật</option>
        </select>
      </label>
      <label>
        <ShieldAlert size={15} />
        <select value={filters.priority || ''} onChange={(event) => update('priority', event.target.value)}>
          <option value="">Mọi ưu tiên</option>
          <option value="stat">STAT</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
      </label>
      {!statusLocked ? (
        <label>
          <Filter size={15} />
          <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
            <option value="">Mọi trạng thái mẹ</option>
            <option value="ordered">Chờ tiếp nhận</option>
            <option value="acknowledged">Đã tiếp nhận</option>
            <option value="in_progress">Đang thực hiện</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Bị hủy</option>
            <option value="entered_in_error">Nhập sai</option>
          </select>
        </label>
      ) : null}
      <label className="order-center-filters__search">
        <Search size={15} />
        <input
          value={filters.search || ''}
          onChange={(event) => update('search', event.target.value)}
          placeholder="Order, BN, SĐT, encounter, xét nghiệm, body part, thủ thuật"
        />
      </label>
      <button type="button" className="order-center-filter-toggle" onClick={() => setAdvancedOpen((current) => !current)}>
        <Settings2 size={16} />
        Nâng cao
        <ChevronDown size={15} />
      </button>
      <button type="button" className="order-center-refresh" onClick={refresh}>
        <RefreshCw className={loading ? 'is-spinning' : ''} size={16} />
        Làm mới
      </button>
      {advancedOpen ? (
        <div className="order-center-advanced">
          <label>
            <span>Order con</span>
            <select value={filters.child_status || ''} onChange={(event) => update('child_status', event.target.value)}>
              <option value="">Mọi trạng thái con</option>
              <option value="ordered">Ordered</option>
              <option value="scheduled">Scheduled</option>
              <option value="collected">Collected</option>
              <option value="received">Received</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="no_show">No-show</option>
            </select>
          </label>
          <label>
            <span>Result lab</span>
            <select value={filters.result_status || ''} onChange={(event) => update('result_status', event.target.value)}>
              <option value="">Mọi result</option>
              <option value="preliminary">Preliminary</option>
              <option value="final">Final</option>
              <option value="amended">Amended</option>
            </select>
          </label>
          <label>
            <span>Report CĐHA</span>
            <select value={filters.report_status || ''} onChange={(event) => update('report_status', event.target.value)}>
              <option value="">Mọi report</option>
              <option value="draft">Draft</option>
              <option value="preliminary">Preliminary</option>
              <option value="final">Final</option>
              <option value="amended">Amended</option>
            </select>
          </label>
          <label>
            <span>File</span>
            <select value={filters.has_attachment || ''} onChange={(event) => update('has_attachment', event.target.value)}>
              <option value="">Mọi file</option>
              <option value="true">Có file</option>
              <option value="false">Thiếu file</option>
            </select>
          </label>
          <label>
            <span>Charge</span>
            <select value={filters.has_charge || ''} onChange={(event) => update('has_charge', event.target.value)}>
              <option value="">Mọi charge</option>
              <option value="true">Có charge</option>
              <option value="false">Chưa có charge</option>
            </select>
          </label>
          <label>
            <span>SLA</span>
            <select value={filters.sla_status || ''} onChange={(event) => update('sla_status', event.target.value)}>
              <option value="">Mọi SLA</option>
              <option value="normal">Trong hạn</option>
              <option value="warning">Sắp quá hạn</option>
              <option value="breached">Quá hạn</option>
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}

function WidgetError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="order-center-error">
      <AlertTriangle size={16} />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function EmptyState({ title = 'Không có order phù hợp', description = 'Bộ lọc hiện tại không có dữ liệu cần xử lý.' }) {
  return (
    <div className="order-center-empty">
      <CheckCircle2 size={25} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function ExpandedPanel({ row }) {
  const details = row.child?.details || {};
  const fields = row.order_type === 'lab'
    ? [
      ['Lab order', row.child?.no],
      ['Test code', details.test_code],
      ['Specimen', [details.specimen_no, details.specimen_status].filter(Boolean).join(' · ')],
      ['Result', [details.result_no, details.result_status].filter(Boolean).join(' · ')],
      ['Abnormal/Critical', `${formatNumber(details.abnormal_items)} / ${formatNumber(details.critical_items)}`],
      ['Release', details.released_to_patient ? 'Đã release BN' : 'Chưa release BN'],
    ]
    : row.order_type === 'imaging'
      ? [
        ['Imaging order', row.child?.no],
        ['Modality', details.modality?.toUpperCase()],
        ['Body part', details.body_part],
        ['Schedule', formatDateTime(details.scheduled_at)],
        ['Room', row.assigned_room?.room_name || details.room_id || '--'],
        ['Report/PACS', [details.report_no, details.report_status, details.pacs_url ? 'PACS' : 'Chưa PACS'].filter(Boolean).join(' · ')],
      ]
      : [
        ['Procedure order', row.child?.no],
        ['Code', details.procedure_code],
        ['Lịch', [formatDateTime(details.scheduled_start), formatDateTime(details.scheduled_end)].join(' - ')],
        ['Thực hiện', [formatDateTime(details.performed_start), formatDateTime(details.performed_end)].join(' - ')],
        ['Result note', details.result_note ? 'Đã có' : 'Thiếu'],
        ['Charge/File', `${row.charge_summary?.active_charge_count || 0} charge · ${row.file_summary?.attachment_count || 0} file`],
      ];

  return (
    <div className="order-center-expanded">
      {fields.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value || '--'}</strong>
        </div>
      ))}
    </div>
  );
}

function ActionMenu({ row, onAction }) {
  return (
    <div className="order-center-actions">
      {(row.allowed_actions || []).slice(0, 5).map((action) => (
        <button key={action} type="button" onClick={() => onAction?.(row, action)}>
          {ACTION_LABEL[action] || action}
        </button>
      ))}
    </div>
  );
}

function OrderTable({ rows = [], loading, onAction, onOpenDetail, selectedOrderId }) {
  const [expanded, setExpanded] = useState('');
  if (loading) {
    return (
      <section className="order-center-table-shell">
        <div className="order-center-skeleton-stack">
          {Array.from({ length: 8 }).map((_, index) => <span key={index} className="order-center-skeleton" />)}
        </div>
      </section>
    );
  }
  if (!rows.length) return <section className="order-center-table-shell"><EmptyState /></section>;

  return (
    <section className="order-center-table-shell">
      <div className="order-center-table">
        <div className="order-center-table__head">
          <span>Priority / SLA</span>
          <span>Order</span>
          <span>Dịch vụ</span>
          <span>Bệnh nhân</span>
          <span>Trạng thái</span>
          <span>File / charge</span>
          <span>Thời gian</span>
          <span>Thao tác</span>
        </div>
        {rows.map((row) => {
          const isExpanded = expanded === row.order_id;
          return (
            <article key={row.order_id} className={`order-center-row${selectedOrderId === row.order_id ? ' is-selected' : ''}`}>
              <button type="button" className="order-center-row__main" onClick={() => setExpanded(isExpanded ? '' : row.order_id)}>
                <div className="order-center-stack">
                  <PriorityBadge priority={row.priority} />
                  <SlaBadge sla={row.sla} />
                </div>
                <div className="order-center-order-no">
                  <strong>{row.order_no}</strong>
                  <span>{row.clinical_indication || 'Không có ghi chú chỉ định'}</span>
                </div>
                <div className="order-center-service">
                  <OrderTypeBadge type={row.order_type} />
                  <strong>{row.service_label}</strong>
                  <span>{row.child?.no || '--'} · {row.child?.status || '--'}</span>
                </div>
                <PatientCell row={row} />
                <div className="order-center-stage">
                  <StatusBadge status={row.status} />
                  <span>Next: {ACTION_LABEL[row.next_action] || row.next_action || '--'}</span>
                </div>
                <div className="order-center-file-charge">
                  <FlagBadges row={row} />
                  <span>{formatNumber(row.file_summary?.attachment_count)} file · {formatNumber(row.charge_summary?.active_charge_count)} charge</span>
                </div>
                <div className="order-center-time">
                  <strong>{formatDateTime(row.ordered_at)}</strong>
                  <span>{row.owner?.name || row.ordered_by?.name || '--'}</span>
                </div>
                <ChevronDown className={isExpanded ? 'is-open' : ''} size={16} />
              </button>
              {isExpanded ? (
                <div className="order-center-row__details">
                  <ExpandedPanel row={row} />
                  <div className="order-center-row__detail-actions">
                    <button type="button" onClick={() => onOpenDetail?.(row)}>Mở detail drawer</button>
                    <ActionMenu row={row} onAction={onAction} />
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DetailDrawer({ detail, loading, onClose }) {
  if (!detail && !loading) return null;
  const row = detail?.row;
  return (
    <aside className="order-center-drawer">
      <header>
        <div>
          <span>Order detail</span>
          <strong>{row?.order_no || 'Đang tải...'}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng detail"><X size={18} /></button>
      </header>
      {loading ? (
        <div className="order-center-skeleton-stack"><span className="order-center-skeleton" /><span className="order-center-skeleton" /></div>
      ) : (
        <div className="order-center-drawer__body">
          <section>
            <h3>Bệnh nhân</h3>
            <PatientCell row={row} />
          </section>
          <section>
            <h3>Chỉ định</h3>
            <p>{row?.clinical_indication || 'Không có ghi chú chỉ định.'}</p>
            <div className="order-center-drawer-grid">
              <span>Order mẹ <strong>{row?.status}</strong></span>
              <span>Order con <strong>{row?.child?.status || '--'}</strong></span>
              <span>SLA <strong>{row?.sla?.state || '--'}</strong></span>
              <span>Next <strong>{ACTION_LABEL[row?.next_action] || row?.next_action || '--'}</strong></span>
            </div>
          </section>
          <section>
            <h3>Kết quả / file / charge</h3>
            <div className="order-center-drawer-grid">
              <span>Result/report <strong>{row?.child?.result_status || '--'}</strong></span>
              <span>File <strong>{formatNumber(row?.file_summary?.attachment_count)}</strong></span>
              <span>Charge <strong>{formatNumber(row?.charge_summary?.active_charge_count)}</strong></span>
              <span>Critical <strong>{row?.flags?.is_critical ? 'Có' : 'Không'}</strong></span>
            </div>
          </section>
          <section>
            <h3>Audit gần nhất</h3>
            <p>{detail?.audit_summary?.latest_event?.message || 'Chưa có audit gần đây.'}</p>
          </section>
        </div>
      )}
    </aside>
  );
}

function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <section className="order-center-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="order-center-header__actions">
        {actions}
      </div>
    </section>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="order-center-toast">
      <span>{message}</span>
      <button type="button" onClick={onClose}><X size={15} /></button>
    </div>
  );
}

function OrderCenterPage({
  title,
  description,
  endpoint = clinicalOrderCenterAPI.list,
  defaultFilters = {},
  statusLocked = false,
  showBoard = true,
}) {
  const [filters, update] = useOrderCenterFilters(defaultFilters);
  const state = useOrderCenterData(endpoint, filters);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');

  async function openDetail(row) {
    setDetailLoading(true);
    try {
      const payload = await clinicalOrderCenterAPI.fullDetail(row.order_id);
      setDetail(payload);
    } catch (error) {
      setToast(getClinicalOrderCenterError(error, 'Không thể tải detail order.'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAction(row, action) {
    try {
      if (action === 'acknowledge') {
        await clinicalOrderCenterAPI.accept(row.order_id, { accept_note: 'Tiếp nhận từ Trung tâm order.' });
        setToast(`Đã tiếp nhận ${row.order_no}.`);
      } else if (action === 'assign') {
        await clinicalOrderCenterAPI.assign(row.order_id, { assignment_status: 'assigned' });
        setToast(`Đã cập nhật assignment ${row.order_no}.`);
      } else if (action === 'notify_doctor') {
        await clinicalOrderCenterAPI.notifyDoctor(row.order_id, { message: `${row.order_no} cần được chú ý.` });
        setToast(`Đã gửi thông báo bác sĩ cho ${row.order_no}.`);
      } else {
        openDetail(row);
        return;
      }
      state.refresh();
    } catch (error) {
      setToast(getClinicalOrderCenterError(error));
    }
  }

  return (
    <div className="order-center-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="Cận lâm sàng & Thủ thuật / Trung tâm order"
        title={title}
        description={description}
        actions={(
          <>
            <button type="button"><ClipboardCheck size={16} />Tạo chỉ định</button>
            <button type="button"><Search size={16} />Tìm BN</button>
            <button type="button"><FileText size={16} />Xuất Excel</button>
          </>
        )}
      />
      <KpiStrip summary={state.data.summary || {}} loading={state.loading} />
      {showBoard ? <StatusBoard board={state.data.status_board || {}} onSelect={(status) => update('status', status)} /> : null}
      <FilterBar filters={filters} update={update} refresh={state.refresh} loading={state.loading} statusLocked={statusLocked} />
      <WidgetError message={state.error} onRetry={state.refresh} />
      <OrderTable
        rows={state.data.items || []}
        loading={state.loading}
        onAction={handleAction}
        onOpenDetail={openDetail}
        selectedOrderId={detail?.row?.order_id}
      />
      <DetailDrawer detail={detail} loading={detailLoading} onClose={() => setDetail(null)} />
    </div>
  );
}

export function ClinicalOrdersAllPage() {
  return (
    <OrderCenterPage
      title="Tất cả order cận lâm sàng"
      description="Tổng điều hành order lab, chẩn đoán hình ảnh và thủ thuật với SLA, critical, file, charge và next action."
    />
  );
}

export function ClinicalOrdersPendingPage() {
  return (
    <OrderCenterPage
      title="Order chờ tiếp nhận"
      description="Hàng đợi ưu tiên STAT/Urgent, sort theo SLA và thời gian chờ để tiếp nhận nhanh."
      endpoint={clinicalOrderCenterAPI.pending}
      defaultFilters={{ status: 'ordered', sort_by: 'oldest' }}
      statusLocked
      showBoard={false}
    />
  );
}

export function ClinicalOrdersAcknowledgedPage() {
  return (
    <OrderCenterPage
      title="Order đã tiếp nhận"
      description="Work queue cho order đã nhận nhưng chưa bắt đầu: lấy mẫu, xếp lịch CĐHA, chuẩn bị thủ thuật."
      endpoint={clinicalOrderCenterAPI.acknowledged}
      defaultFilters={{ status: 'acknowledged' }}
      statusLocked
      showBoard={false}
    />
  );
}

export function ClinicalOrdersInProgressPage() {
  return (
    <OrderCenterPage
      title="Order đang thực hiện"
      description="Live board theo dõi lab đang xét nghiệm, CĐHA đang thực hiện và thủ thuật đang làm."
      endpoint={clinicalOrderCenterAPI.inProgressLive}
      defaultFilters={{ status: 'in_progress' }}
      statusLocked
      showBoard={false}
    />
  );
}

export function ClinicalOrdersCompletedPage() {
  return (
    <OrderCenterPage
      title="Order hoàn tất"
      description="Tra cứu kết quả đã xong, file đã có, report đã ký, release bệnh nhân và TAT."
      endpoint={clinicalOrderCenterAPI.completed}
      defaultFilters={{ status: 'completed' }}
      statusLocked
    />
  );
}

export function ClinicalOrdersCancelledPage() {
  return (
    <OrderCenterPage
      title="Order bị hủy"
      description="Theo dõi order hủy, lý do hủy, charge impact và audit để kiểm soát vận hành."
      endpoint={clinicalOrderCenterAPI.cancelled}
      defaultFilters={{ status: 'cancelled' }}
      statusLocked
    />
  );
}

export function ClinicalOrdersEnteredInErrorPage() {
  return (
    <OrderCenterPage
      title="Order nhập sai"
      description="Kiểm soát order nhập sai, audit risk, lý do và nhu cầu tạo order thay thế."
      endpoint={clinicalOrderCenterAPI.enteredInError}
      defaultFilters={{ status: 'entered_in_error' }}
      statusLocked
    />
  );
}

export function ClinicalOrderTimelinePage() {
  const [filters, update] = useOrderCenterFilters({ limit: 12 });
  const state = useOrderCenterData(clinicalOrderCenterAPI.list, filters);
  const [selected, setSelected] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  useEffect(() => {
    const first = state.data.items?.[0];
    if (!selected && first) setSelected(first);
  }, [selected, state.data.items]);

  useEffect(() => {
    if (!selected?.order_id) return;
    let active = true;
    setLoadingTimeline(true);
    clinicalOrderCenterAPI.fullTimeline(selected.order_id)
      .then((data) => {
        if (active) setTimeline(data);
      })
      .catch(() => {
        if (active) setTimeline(null);
      })
      .finally(() => {
        if (active) setLoadingTimeline(false);
      });
    return () => {
      active = false;
    };
  }, [selected?.order_id]);

  return (
    <div className="order-center-page">
      <PageHeader
        eyebrow="Forensic timeline"
        title="Timeline order"
        description="Timeline hợp nhất order mẹ, order con, specimen/result/report, file, charge, critical và audit."
        actions={<button type="button" onClick={state.refresh}><RefreshCw size={16} />Làm mới</button>}
      />
      <FilterBar filters={filters} update={update} refresh={state.refresh} loading={state.loading} />
      <section className="order-center-timeline-layout">
        <div className="order-center-timeline-list">
          {(state.data.items || []).map((row) => (
            <button key={row.order_id} type="button" className={selected?.order_id === row.order_id ? 'is-active' : ''} onClick={() => setSelected(row)}>
              <PriorityBadge priority={row.priority} />
              <strong>{row.order_no}</strong>
              <span>{row.service_label}</span>
              <small>{row.patient?.patient_code} · {formatDateTime(row.ordered_at)}</small>
            </button>
          ))}
          {!state.data.items?.length ? <EmptyState /> : null}
        </div>
        <div className="order-center-timeline-panel">
          {loadingTimeline ? (
            <div className="order-center-skeleton-stack"><span className="order-center-skeleton" /><span className="order-center-skeleton" /></div>
          ) : timeline?.events?.length ? (
            <>
              <header>
                <div>
                  <span>{selected?.order_type}</span>
                  <strong>{selected?.order_no}</strong>
                </div>
                <SlaBadge sla={selected?.sla} />
              </header>
              <div className="order-center-timeline-events">
                {timeline.events.map((event) => (
                  <article key={event.event_id}>
                    <i className={`is-${event.category}`} />
                    <div>
                      <strong>{event.title}</strong>
                      <span>{event.category} · {event.actor_type || 'system'} · {formatDateTime(event.event_time)}</span>
                      {event.metadata ? <pre>{JSON.stringify(event.metadata, null, 2)}</pre> : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="Chưa có timeline" description="Chọn một order để xem audit timeline hợp nhất." />
          )}
        </div>
      </section>
    </div>
  );
}
