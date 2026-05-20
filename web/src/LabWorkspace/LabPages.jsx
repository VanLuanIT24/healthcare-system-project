import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  FlaskConical,
  History,
  Microscope,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Siren,
  Timer,
  TimerOff,
  Trash2,
  X,
} from 'lucide-react';
import { labWorkspaceAPI, getLabErrorMessage } from './labApi';

const ORDER_STATUS_LABEL = {
  ordered: 'Chờ lấy mẫu',
  collected: 'Đã lấy mẫu',
  received: 'Đã nhận mẫu',
  in_progress: 'Đang xét nghiệm',
  recollection_required: 'Cần lấy lại mẫu',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  rejected: 'Bị từ chối',
};

const SPECIMEN_STATUS_LABEL = {
  planned: 'Mẫu chờ lấy',
  collected: 'Chờ nhận mẫu',
  received: 'Đã nhận mẫu',
  in_testing: 'Đang xét nghiệm',
  stored: 'Lưu kho',
  rejected: 'Bị từ chối',
  disposed: 'Đã hủy',
};

const RESULT_STATUS_LABEL = {
  preliminary: 'Chờ duyệt',
  final: 'Đã duyệt',
  amended: 'Đã sửa đổi',
  cancelled: 'Đã hủy',
  entered_in_error: 'Nhập sai',
};

const ABNORMAL_LABEL = {
  normal: 'Normal',
  low: 'Low',
  high: 'High',
  critical_low: 'Critical low',
  critical_high: 'Critical high',
  abnormal: 'Abnormal',
  unknown: 'Unknown',
};

const PRIORITY_LABEL = {
  stat: 'STAT',
  urgent: 'Urgent',
  routine: 'Routine',
};

export const LAB_PAGE_CONFIG = {
  orders: {
    title: 'Lab orders',
    subtitle: 'Toàn bộ chỉ định xét nghiệm, từ nhận order đến hoàn tất kết quả.',
    source: 'orders',
    query: {},
    mode: 'orders',
  },
  waitingCollection: {
    title: 'Chờ lấy mẫu',
    subtitle: 'Hàng đợi lấy mẫu theo ưu tiên, SLA và checklist an toàn người bệnh.',
    source: 'orders',
    query: { status: 'ordered' },
    mode: 'collection',
  },
  collected: {
    title: 'Đã lấy mẫu',
    subtitle: 'Theo dõi mẫu đã lấy, in nhãn lại và bàn giao khu nhận mẫu.',
    source: 'specimens',
    query: { status: 'collected' },
    mode: 'collected',
  },
  waitingReceive: {
    title: 'Chờ nhận mẫu',
    subtitle: 'Khu nhận mẫu, quét barcode, kiểm tra chất lượng và từ chối mẫu lỗi.',
    source: 'specimens',
    query: { status: 'collected' },
    mode: 'specimen_receive',
  },
  inTesting: {
    title: 'Đang xét nghiệm',
    subtitle: 'Điều phối mẫu đã nhận, đang chạy máy và result draft.',
    source: 'orders',
    query: { status: 'in_progress' },
    mode: 'testing',
  },
  resultEntry: {
    title: 'Nhập kết quả',
    subtitle: 'Grid nhập kết quả nhanh, flag bất thường và lưu preliminary result.',
    source: 'orders',
    query: { status: 'in_progress' },
    mode: 'result_entry',
  },
  pendingApproval: {
    title: 'Kết quả chờ duyệt',
    subtitle: 'Review preliminary result, abnormal/critical summary và finalize.',
    source: 'results',
    query: { status: 'preliminary' },
    mode: 'approval',
  },
  finalResults: {
    title: 'Kết quả đã duyệt',
    subtitle: 'Tra cứu result final/amended, in, release cho bệnh nhân và xem version.',
    source: 'results',
    query: { status: 'final' },
    mode: 'final',
  },
  corrections: {
    title: 'Kết quả cần sửa',
    subtitle: 'Quản lý yêu cầu sửa trước duyệt hoặc sau amend, theo owner và deadline.',
    source: 'corrections',
    query: {},
    mode: 'correction',
  },
  criticalResults: {
    title: 'Critical lab results',
    subtitle: 'Command center cho critical result chưa acknowledge và quá SLA xác nhận.',
    source: 'results',
    query: { is_critical: 'true' },
    mode: 'critical',
  },
  specimenList: {
    title: 'Danh sách mẫu',
    subtitle: 'Tất cả specimen theo barcode, loại mẫu, trạng thái và người xử lý.',
    source: 'specimens',
    query: {},
    mode: 'specimens',
  },
  specimenWaitingCollection: {
    title: 'Mẫu chờ lấy',
    subtitle: 'Specimen planned và các order cần lấy lại mẫu, ưu tiên theo SLA lấy mẫu.',
    source: 'specimens',
    query: { status: 'planned' },
    mode: 'specimen_waiting_collection',
  },
  specimenCollected: {
    title: 'Mẫu đã lấy',
    subtitle: 'Mẫu đã lấy, đang chờ bàn giao hoặc nhận tại lab.',
    source: 'specimens',
    query: { status: 'collected' },
    mode: 'specimen_collected',
  },
  specimenReceive: {
    title: 'Nhận mẫu',
    subtitle: 'Màn scan barcode tốc độ cao, checklist chất lượng và receive/reject mẫu.',
    source: 'specimens',
    query: { status: 'collected' },
    mode: 'specimen_receive',
  },
  specimenRejected: {
    title: 'Từ chối mẫu',
    subtitle: 'Trung tâm kiểm soát lỗi tiền phân tích, lý do từ chối và yêu cầu lấy lại mẫu.',
    source: 'specimens',
    query: { status: 'rejected' },
    mode: 'specimen_rejected',
  },
  specimenTesting: {
    title: 'Mẫu đang xét nghiệm',
    subtitle: 'Theo dõi mẫu đang chạy máy, workstation, result draft và SLA xét nghiệm.',
    source: 'specimens',
    query: { status: 'in_testing' },
    mode: 'specimen_testing',
  },
  specimenStored: {
    title: 'Mẫu lưu kho',
    subtitle: 'Quản lý vị trí lưu, hạn lưu, chuyển vị trí và hủy mẫu theo batch.',
    source: 'specimens',
    query: { status: 'stored' },
    mode: 'specimen_stored',
  },
  specimenDisposed: {
    title: 'Mẫu đã hủy',
    subtitle: 'Hồ sơ mẫu đã hủy, lý do, người hủy, nhân chứng và biên bản.',
    source: 'specimens',
    query: { status: 'disposed' },
    mode: 'specimen_disposed',
  },
  specimenHistory: {
    title: 'Lịch sử mẫu',
    subtitle: 'Timeline mẫu bệnh phẩm, audit log, chain-of-custody và liên kết result/file.',
    source: 'specimens',
    query: { sort: '-created_at' },
    mode: 'specimen_history',
  },
  catalog: {
    title: 'Danh mục xét nghiệm',
    subtitle: 'Catalog test, specimen mặc định, template result item và reference range.',
    source: 'catalog',
    query: { active: 'true' },
    mode: 'catalog',
  },
};

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

function getId(item) {
  return item?._id || item?.id;
}

function populated(value) {
  return value && typeof value === 'object' ? value : {};
}

function patientOf(row) {
  return populated(row?.patient_id || row?.patient);
}

function labOrderOf(row) {
  return populated(row?.lab_order_id || row?.lab_order);
}

function specimenOf(row) {
  return populated(row?.specimen_id || row?.specimen);
}

function patientAge(patient) {
  const dob = parseDate(patient?.date_of_birth);
  if (!dob) return '';
  let age = new Date().getFullYear() - dob.getFullYear();
  if (new Date().getMonth() < dob.getMonth()) age -= 1;
  return age >= 0 ? `${age} tuổi` : '';
}

function patientLine(patient) {
  return [patient?.patient_code, patient?.gender, patientAge(patient)].filter(Boolean).join(' · ') || '--';
}

function classToken(value) {
  return String(value || 'unknown').replace(/_/g, '-');
}

function useLabList(config, filters) {
  const [state, setState] = useState({ loading: true, error: '', data: { items: [], pagination: {} } });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const key = JSON.stringify(filters || {});

  useEffect(() => {
    let active = true;
    const loaders = {
      orders: labWorkspaceAPI.listOrders,
      specimens: labWorkspaceAPI.listSpecimens,
      results: labWorkspaceAPI.listResults,
      corrections: labWorkspaceAPI.listCorrections,
      catalog: labWorkspaceAPI.listCatalogTests,
    };
    setState((current) => ({ ...current, loading: true, error: '' }));
    loaders[config.source](filters)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data: data || { items: [], pagination: {} } });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: getLabErrorMessage(error), data: { items: [], pagination: {} } });
      });
    return () => {
      active = false;
    };
  }, [config.source, key, refreshIndex]);

  return { ...state, refresh: () => setRefreshIndex((value) => value + 1) };
}

function normalizeSpecimenSummary(data = {}) {
  return {
    specimen: true,
    counters: {
      total_today: data.total_today,
      waiting_collection: data.planned,
      collected_waiting_receive: data.collected,
      received_waiting_testing: data.received,
      in_testing: data.in_testing,
      pending_approval: data.stored,
      critical_unacknowledged: data.stat_pending,
      rejected_specimens: data.rejected,
      overdue_orders: data.receive_overdue,
      final_today: data.disposed,
    },
    priority: {
      stat: data.stat_pending,
      urgent: data.receive_overdue,
      routine: data.stored,
    },
    turnaround_time: {
      median_minutes: data.avg_collection_to_receive_minutes,
      p90_minutes: data.avg_receive_to_testing_minutes,
    },
  };
}

function useLabSummary(source) {
  const [state, setState] = useState({ loading: true, error: '', data: { counters: {}, priority: {}, turnaround_time: {} } });
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    const loader = source === 'specimens' ? labWorkspaceAPI.specimenStats : labWorkspaceAPI.workspaceSummary;
    loader({ date: todayKey() })
      .then((data) => {
        if (active) setState({ loading: false, error: '', data: source === 'specimens' ? normalizeSpecimenSummary(data) : (data || { counters: {}, priority: {}, turnaround_time: {} }) });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: getLabErrorMessage(error), data: { counters: {}, priority: {}, turnaround_time: {} } });
      });
    return () => {
      active = false;
    };
  }, [refreshIndex, source]);

  return { ...state, refresh: () => setRefreshIndex((value) => value + 1) };
}

function Badge({ type = 'status', value, label }) {
  return <span className={`lab-work-badge lab-work-badge--${type} is-${classToken(value)}`}>{label || value || '--'}</span>;
}

function PriorityBadge({ priority }) {
  return <Badge type="priority" value={priority || 'routine'} label={PRIORITY_LABEL[priority] || priority || 'Routine'} />;
}

function StatusBadge({ status, kind = 'order' }) {
  const maps = { order: ORDER_STATUS_LABEL, specimen: SPECIMEN_STATUS_LABEL, result: RESULT_STATUS_LABEL };
  return <Badge type={kind} value={status} label={maps[kind]?.[status] || status || '--'} />;
}

function AbnormalBadge({ flag, critical }) {
  if (!flag && !critical) return null;
  return <Badge type="abnormal" value={critical ? 'critical' : flag} label={critical ? 'Critical' : ABNORMAL_LABEL[flag] || flag} />;
}

function SlaBadge({ sla }) {
  if (!sla) return <Badge type="sla" value="neutral" label="SLA --" />;
  const label = sla.is_overdue
    ? `Quá ${formatNumber(sla.breached_minutes)}p`
    : sla.remaining_minutes !== undefined
      ? `Còn ${formatNumber(sla.remaining_minutes)}p`
      : `${formatNumber(sla.age_minutes)}p`;
  return <Badge type="sla" value={sla.risk_level || sla.state || 'neutral'} label={label} />;
}

function KpiStrip({ summary, loading }) {
  const counters = summary?.counters || {};
  const priority = summary?.priority || {};
  const tat = summary?.turnaround_time || {};
  const items = summary?.specimen ? [
    ['Tổng mẫu hôm nay', counters.total_today, ClipboardList, 'neutral', `${formatNumber(priority.stat)} STAT pending`],
    ['Mẫu chờ lấy', counters.waiting_collection, Clock3, 'warning', 'planned'],
    ['Chờ nhận mẫu', counters.collected_waiting_receive, Microscope, 'info', 'collected'],
    ['Đã nhận mẫu', counters.received_waiting_testing, ClipboardCheck, 'primary', 'received'],
    ['Đang xét nghiệm', counters.in_testing, Activity, 'primary', 'in testing'],
    ['Mẫu lưu kho', counters.pending_approval, FileCheck2, 'success', 'stored'],
    ['Từ chối mẫu', counters.rejected_specimens, AlertTriangle, 'danger', `${formatNumber(counters.overdue_orders)} quá SLA nhận`],
    ['Đã hủy', counters.final_today, Trash2, 'neutral', `Nhận TB ${formatNumber(tat.median_minutes)}p`],
  ] : [
    ['Tổng hôm nay', counters.total_today, ClipboardList, 'neutral', `${formatNumber(priority.stat)} STAT · ${formatNumber(priority.urgent)} urgent`],
    ['Chờ lấy mẫu', counters.waiting_collection, Clock3, 'warning', 'Ordered'],
    ['Chờ nhận mẫu', counters.collected_waiting_receive, Microscope, 'info', 'Collected'],
    ['Đang xét nghiệm', counters.in_testing, Activity, 'primary', 'In progress'],
    ['Chờ duyệt', counters.pending_approval, ClipboardCheck, 'info', 'Preliminary'],
    ['Critical chưa ACK', counters.critical_unacknowledged, Siren, 'danger', 'Patient safety'],
    ['Quá SLA', counters.overdue_orders, TimerOff, 'danger', `${formatNumber(counters.rejected_specimens)} mẫu từ chối`],
    ['Final hôm nay', counters.final_today, BadgeCheck, 'success', `Median ${formatNumber(tat.median_minutes)}p`],
  ];

  return (
    <section className="lab-work-kpi-strip" aria-label="KPI xét nghiệm">
      {items.map(([label, value, Icon, tone, hint]) => (
        <div key={label} className={`lab-work-kpi is-${tone}`}>
          <Icon size={19} strokeWidth={2.25} />
          <span>
            <small>{label}</small>
            {loading ? <i className="lab-work-skeleton lab-work-skeleton--number" /> : <strong>{formatNumber(value)}</strong>}
            <em>{hint}</em>
          </span>
        </div>
      ))}
    </section>
  );
}

function FilterBar({ filters, setFilter, refresh, loading, source, onLookupSpecimen }) {
  const [barcode, setBarcode] = useState('');
  return (
    <section className="lab-work-filter-bar" aria-label="Bộ lọc xét nghiệm">
      {source === 'specimens' ? (
        <form className="lab-specimen-scanner" onSubmit={(event) => {
          event.preventDefault();
          onLookupSpecimen?.(barcode);
        }}>
          <Search size={15} />
          <input value={barcode} onChange={(event) => setBarcode(event.target.value)} placeholder="Scan barcode / specimen no" />
          <button type="submit">Scan</button>
        </form>
      ) : null}
      <label className="lab-work-filter-bar__search">
        <Search size={15} />
        <input value={filters.search || ''} onChange={(event) => setFilter('search', event.target.value)} placeholder="Tìm mã, bệnh nhân, test, barcode" />
      </label>
      <label>
        <ShieldAlert size={15} />
        <select value={filters.priority || ''} onChange={(event) => setFilter('priority', event.target.value)}>
          <option value="">Mọi ưu tiên</option>
          <option value="stat">STAT</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
      </label>
      <label>
        <CalendarDays size={15} />
        <input type="date" value={filters.date_from || ''} onChange={(event) => setFilter('date_from', event.target.value)} />
      </label>
      {source === 'results' ? (
        <label>
          <FileCheck2 size={15} />
          <select value={filters.critical_acknowledged || ''} onChange={(event) => setFilter('critical_acknowledged', event.target.value)}>
            <option value="">ACK critical</option>
            <option value="false">Chưa ACK</option>
            <option value="true">Đã ACK</option>
          </select>
        </label>
      ) : null}
      {source === 'specimens' ? (
        <>
          <label>
            <FlaskConical size={15} />
            <select value={filters.status || ''} onChange={(event) => setFilter('status', event.target.value)}>
              <option value="">Mọi trạng thái mẫu</option>
              {Object.entries(SPECIMEN_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <TimerOff size={15} />
            <select value={filters.is_overdue || ''} onChange={(event) => setFilter('is_overdue', event.target.value)}>
              <option value="">SLA</option>
              <option value="true">Quá SLA</option>
              <option value="false">Trong SLA</option>
            </select>
          </label>
        </>
      ) : null}
      <button type="button" className="lab-work-refresh" onClick={refresh}>
        <RefreshCw className={loading ? 'is-spinning' : ''} size={16} />
        Làm mới
      </button>
    </section>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="lab-work-toast">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Đóng thông báo"><X size={15} /></button>
    </div>
  );
}

function WidgetError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="lab-work-error">
      <AlertTriangle size={16} />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function EmptyState({ title = 'Không có dữ liệu phù hợp' }) {
  return (
    <div className="lab-work-empty">
      <CheckCircle2 size={25} />
      <strong>{title}</strong>
      <span>Bộ lọc hiện tại không có item trong hàng đợi.</span>
    </div>
  );
}

function PatientCell({ patient }) {
  return (
    <div className="lab-work-patient">
      <strong>{patient?.full_name || 'Chưa rõ bệnh nhân'}</strong>
      <span>{patientLine(patient)}</span>
    </div>
  );
}

function RowActions({ row, mode, source, onAction, onOpenDetail }) {
  const actions = [];
  if (source === 'orders') {
    if (['orders', 'collection'].includes(mode)) actions.push(['acknowledge', 'Tiếp nhận', ClipboardCheck]);
    if (mode === 'collection') actions.push(['collect', 'Lấy mẫu', Microscope]);
    if (mode === 'orders') actions.push(['print_order_labels', 'In nhãn', Printer]);
    if (['testing', 'result_entry'].includes(mode)) actions.push(['create_result', 'Nhập kết quả', FileText]);
  }
  if (source === 'specimens') {
    if (row.allowed_actions?.can_collect || row.status === 'planned') actions.push(['collect_specimen', 'Lấy mẫu', Microscope]);
    if (row.allowed_actions?.can_receive || row.status === 'collected') actions.push(['receive_specimen', 'Nhận mẫu', CheckCircle2]);
    if (row.allowed_actions?.can_reject || ['planned', 'collected', 'received'].includes(row.status)) actions.push(['reject_specimen', 'Từ chối', AlertTriangle]);
    if (row.allowed_actions?.can_process || row.status === 'received') actions.push(['process_specimen', 'Chạy mẫu', Activity]);
    if (row.allowed_actions?.can_store || ['received', 'in_testing'].includes(row.status)) actions.push(['store_specimen', 'Lưu kho', FileCheck2]);
    if (row.allowed_actions?.can_dispose || ['stored', 'in_testing'].includes(row.status)) actions.push(['dispose_specimen', 'Hủy mẫu', Trash2]);
    if (row.status === 'rejected') actions.push(['request_recollection', 'Lấy lại', RefreshCw]);
    actions.push(['print_specimen_label', 'In nhãn', Printer], ['specimen_timeline', 'Timeline', History]);
  }
  if (source === 'results') {
    if (mode === 'approval') actions.push(['finalize_result', 'Duyệt', BadgeCheck], ['request_correction', 'Yêu cầu sửa', AlertTriangle]);
    if (mode === 'critical') actions.push(['ack_critical', 'ACK critical', Siren]);
    if (mode === 'final') actions.push(['release_result', 'Release BN', FileCheck2], ['print_result', 'In', Printer], ['versions', 'Versions', History]);
  }
  if (source === 'corrections') actions.push(['resolve_correction', 'Resolve', BadgeCheck], ['cancel_correction', 'Hủy', X]);
  if (source === 'catalog') actions.push([row.active ? 'deactivate_catalog' : 'activate_catalog', row.active ? 'Deactivate' : 'Activate', BadgeCheck]);

  return (
    <div className="lab-work-row-actions">
      <button type="button" onClick={() => onOpenDetail(row)}>Chi tiết</button>
      {actions.slice(0, source === 'specimens' ? 4 : 3).map(([action, label, Icon]) => (
        <button key={action} type="button" onClick={() => onAction(action, row)}>
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

function OrdersTable({ rows, loading, mode, onAction, onOpenDetail, selectedId }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Không có lab order phù hợp" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>Lab order</th>
            <th>Bệnh nhân</th>
            <th>Test</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const patient = patientOf(row);
            return (
              <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
                <td><PriorityBadge priority={row.priority} /></td>
                <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.lab_order_no || '--'}<span>{row.order_id?.order_no || row.test_code || '--'}</span></button></td>
                <td><PatientCell patient={patient} /></td>
                <td><strong>{row.test_name || '--'}</strong><small>{row.test_code || row.specimen_type || '--'}</small></td>
                <td><StatusBadge status={row.status} kind="order" /></td>
                <td><strong>{formatDateTime(row.ordered_at)}</strong><small>{row.ordered_by?.full_name || row.ordered_by?.username || '--'}</small></td>
                <td><RowActions row={row} mode={mode} source="orders" onAction={onAction} onOpenDetail={onOpenDetail} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpecimensTable({ rows, loading, mode, onAction, onOpenDetail, selectedId }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Không có specimen phù hợp" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>Mẫu</th>
            <th>Bệnh nhân</th>
            <th>Order/Test</th>
            <th>Loại mẫu</th>
            <th>Trạng thái</th>
            <th>SLA</th>
            <th>Thời gian</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const order = labOrderOf(row);
            return (
              <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
                <td><PriorityBadge priority={order.priority} /></td>
                <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.specimen_no || '--'}<span>{row.barcode_value || row.barcode || '--'}</span></button></td>
                <td><PatientCell patient={patientOf(row)} /></td>
                <td><strong>{order.lab_order_no || '--'}</strong><small>{order.test_name || '--'}</small></td>
                <td><strong>{row.specimen_type || '--'}</strong><small>{row.container_type || '--'}</small></td>
                <td><StatusBadge status={row.status} kind="specimen" /></td>
                <td><SlaBadge sla={row.sla} /></td>
                <td><strong>{formatDateTime(row.collected_at || row.received_at || row.stored_at || row.created_at)}</strong><small>{row.collected_by?.full_name || row.received_by?.full_name || row.stored_by?.full_name || '--'}</small></td>
                <td><RowActions row={row} mode={mode} source="specimens" onAction={onAction} onOpenDetail={onOpenDetail} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultsTable({ rows, loading, mode, onAction, onOpenDetail, selectedId }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Không có result phù hợp" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Bệnh nhân</th>
            <th>Test/Specimen</th>
            <th>Trạng thái</th>
            <th>Critical</th>
            <th>Người duyệt</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const order = labOrderOf(row);
            const specimen = specimenOf(row);
            return (
              <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
                <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.result_no || '--'}<span>{formatDateTime(row.reported_at)}</span></button></td>
                <td><PatientCell patient={patientOf(row)} /></td>
                <td><strong>{order.test_name || '--'}</strong><small>{specimen.specimen_no || order.lab_order_no || '--'}</small></td>
                <td><StatusBadge status={row.status} kind="result" /></td>
                <td><AbnormalBadge critical={row.is_critical} flag={row.is_critical ? 'critical_high' : ''} />{row.critical_acknowledged_at ? <Badge type="ack" value="done" label="ACK" /> : null}</td>
                <td><strong>{row.verified_by?.full_name || '--'}</strong><small>{formatDateTime(row.verified_at)}</small></td>
                <td><RowActions row={row} mode={mode} source="results" onAction={onAction} onOpenDetail={onOpenDetail} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CorrectionsTable({ rows, loading, onAction, onOpenDetail, selectedId }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Không có yêu cầu sửa" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Bệnh nhân</th>
            <th>Lý do</th>
            <th>Người yêu cầu</th>
            <th>Deadline</th>
            <th>Status</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
              <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.lab_result_id?.result_no || '--'}<span>{row.lab_order_id?.test_name || '--'}</span></button></td>
              <td><PatientCell patient={patientOf(row)} /></td>
              <td><strong>{row.reason_code || 'Correction'}</strong><small>{row.reason_text || '--'}</small></td>
              <td><strong>{row.requested_by?.full_name || '--'}</strong><small>{formatDateTime(row.requested_at)}</small></td>
              <td><PriorityBadge priority={row.priority} /><small>{formatDateTime(row.due_at)}</small></td>
              <td><Badge type="correction" value={row.status} label={row.status || '--'} /></td>
              <td><RowActions row={row} mode="correction" source="corrections" onAction={onAction} onOpenDetail={onOpenDetail} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CatalogTable({ rows, loading, onAction, onOpenDetail, selectedId }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Chưa có danh mục xét nghiệm" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Tên xét nghiệm</th>
            <th>Category</th>
            <th>Mẫu mặc định</th>
            <th>Template</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
              <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.code}<span>{row.unit || '--'}</span></button></td>
              <td><strong>{row.name}</strong><small>{row.collection_instruction || '--'}</small></td>
              <td>{row.category || '--'}</td>
              <td><strong>{row.specimen_type || '--'}</strong><small>{row.container_type || '--'}</small></td>
              <td>{formatNumber(row.result_items?.length || 0)} chỉ số</td>
              <td><Badge type="catalog" value={row.active ? 'active' : 'inactive'} label={row.active ? 'Active' : 'Inactive'} /></td>
              <td><RowActions row={row} mode="catalog" source="catalog" onAction={onAction} onOpenDetail={onOpenDetail} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="lab-work-table-shell">
      <div className="lab-work-skeleton-stack">
        {Array.from({ length: 8 }).map((_, index) => <span key={index} className="lab-work-skeleton" />)}
      </div>
    </div>
  );
}

function LabAuditTimeline({ items = [] }) {
  return (
    <div className="lab-drawer-timeline">
      {items.length ? items.map((item) => (
        <article key={item._id || `${item.action}:${item.created_at}`}>
          <i />
          <strong>{item.action || 'activity'}</strong>
          <span>{item.message || item.status || '--'} · {formatDateTime(item.created_at)}</span>
        </article>
      )) : <EmptyState title="Chưa có audit gần đây" />}
    </div>
  );
}

function ResultItems({ items = [] }) {
  if (!items.length) return <EmptyState title="Chưa có result item" />;
  return (
    <div className="lab-result-items">
      {items.map((item) => (
        <article key={item._id || item.item_code || item.item_name}>
          <div>
            <strong>{item.item_name}</strong>
            <span>{item.item_code || '--'} · {item.reference_range || '--'}</span>
          </div>
          <b>{item.result_value || item.numeric_value || '--'} {item.unit || ''}</b>
          <AbnormalBadge flag={item.abnormal_flag} critical={item.is_critical} />
        </article>
      ))}
    </div>
  );
}

const SPECIMEN_FLOW = ['planned', 'collected', 'received', 'in_testing', 'stored', 'disposed'];

function SpecimenWorkflowStepper({ status }) {
  const activeIndex = SPECIMEN_FLOW.indexOf(status);
  return (
    <div className="lab-specimen-stepper">
      {SPECIMEN_FLOW.map((step, index) => (
        <div key={step} className={index <= activeIndex ? 'is-active' : ''}>
          <i />
          <span>{SPECIMEN_STATUS_LABEL[step]}</span>
        </div>
      ))}
      {status === 'rejected' ? <strong>Từ chối mẫu</strong> : null}
    </div>
  );
}

function SpecimenQualityPanel({ specimen }) {
  const quality = specimen?.quality_check || {};
  const checks = [
    ['Đúng nhãn', quality.label_verified],
    ['Đúng bệnh nhân', quality.patient_identity_verified],
    ['Ống nguyên vẹn', quality.container_intact],
    ['Đủ thể tích', quality.volume_adequate],
    ['Không đông', quality.clot_detected === undefined ? undefined : !quality.clot_detected],
    ['Không rò rỉ', quality.leak_detected === undefined ? undefined : !quality.leak_detected],
  ];
  return (
    <section className="lab-drawer-section">
      <h3>Chất lượng mẫu</h3>
      <div className="lab-quality-grid">
        {checks.map(([label, value]) => (
          <span key={label} className={value === false ? 'is-failed' : value === true ? 'is-passed' : ''}>
            {value === true ? <CheckCircle2 size={14} /> : value === false ? <AlertTriangle size={14} /> : <Clock3 size={14} />}
            {label}
          </span>
        ))}
      </div>
      <div className="lab-drawer-grid">
        <span>Sample quality <strong>{quality.sample_quality || '--'}</strong></span>
        <span>Nhiệt độ <strong>{quality.temperature_celsius ?? '--'} °C</strong></span>
        <span>Hemolysis <strong>{quality.hemolysis_level || '--'}</strong></span>
        <span>Ghi chú <strong>{quality.note || '--'}</strong></span>
      </div>
    </section>
  );
}

function SpecimenStoragePanel({ specimen }) {
  return (
    <section className="lab-drawer-section">
      <h3>Lưu kho</h3>
      <div className="lab-drawer-grid">
        <span>Location <strong>{specimen.storage_location || '--'}</strong></span>
        <span>Unit <strong>{specimen.storage_unit || '--'}</strong></span>
        <span>Rack / Box / Slot <strong>{[specimen.storage_rack, specimen.storage_box, specimen.storage_slot].filter(Boolean).join(' / ') || '--'}</strong></span>
        <span>Retention until <strong>{formatDateTime(specimen.retention_until)}</strong></span>
        <span>Stored by <strong>{specimen.stored_by?.full_name || '--'}</strong></span>
        <span>Stored at <strong>{formatDateTime(specimen.stored_at)}</strong></span>
      </div>
    </section>
  );
}

function SpecimenTimelinePreview({ detail }) {
  const events = detail?.timeline || (detail?.recent_custody || []).map((item) => ({
    action: `custody.${item.event_type}`,
    message: item.note,
    at: item.event_at || item.created_at,
  }));
  return (
    <section className="lab-drawer-section">
      <h3>Lịch sử mẫu</h3>
      <div className="lab-drawer-timeline">
        {events?.length ? events.slice(0, 10).map((item, index) => (
          <article key={item._id || `${item.action}:${item.at}:${index}`}>
            <i />
            <strong>{item.action}</strong>
            <span>{item.message || item.status || '--'} · {formatDateTime(item.at || item.created_at)}</span>
          </article>
        )) : <EmptyState title="Chưa có timeline mẫu" />}
      </div>
    </section>
  );
}

function ResultEditor({ detail, onSaved }) {
  const labOrder = detail?.lab_order;
  const specimens = detail?.specimens || [];
  const [interpretation, setInterpretation] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { item_code: '', item_name: labOrder?.test_name || '', numeric_value: '', result_value: '', unit: '', reference_range: '', abnormal_flag: 'unknown', is_critical: false, comment: '' },
  ]);
  const specimen = specimens.find((item) => ['received', 'in_testing', 'stored'].includes(item.status)) || specimens[0];

  useEffect(() => {
    setItems([{ item_code: labOrder?.test_code || '', item_name: labOrder?.test_name || '', numeric_value: '', result_value: '', unit: '', reference_range: '', abnormal_flag: 'unknown', is_critical: false, comment: '' }]);
  }, [labOrder?._id]);

  function updateItem(index, key, value) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  async function saveDraft() {
    if (!labOrder?._id || !specimen?._id) return;
    const payload = {
      specimen_id: specimen._id,
      interpretation,
      notes,
      result_items: items
        .filter((item) => item.item_name)
        .map((item, index) => ({
          ...item,
          numeric_value: item.numeric_value === '' ? undefined : Number(item.numeric_value),
          display_order: index + 1,
        })),
    };
    await labWorkspaceAPI.createResult(labOrder._id, payload);
    onSaved?.('Đã lưu preliminary result.');
  }

  return (
    <section className="lab-result-editor">
      <header>
        <div>
          <span>Result grid</span>
          <h3>{labOrder?.test_name || 'Nhập kết quả'}</h3>
        </div>
        <button type="button" onClick={saveDraft} disabled={!specimen?._id}>
          <Save size={15} />
          Lưu draft
        </button>
      </header>
      <div className="lab-result-editor__grid">
        <div className="lab-result-editor__head">
          <span>Code</span><span>Chỉ số</span><span>Value</span><span>Unit</span><span>Range</span><span>Flag</span><span>Critical</span><span />
        </div>
        {items.map((item, index) => (
          <div key={index} className="lab-result-editor__row">
            <input value={item.item_code} onChange={(event) => updateItem(index, 'item_code', event.target.value)} />
            <input value={item.item_name} onChange={(event) => updateItem(index, 'item_name', event.target.value)} />
            <input value={item.numeric_value} onChange={(event) => updateItem(index, 'numeric_value', event.target.value)} />
            <input value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} />
            <input value={item.reference_range} onChange={(event) => updateItem(index, 'reference_range', event.target.value)} />
            <select value={item.abnormal_flag} onChange={(event) => updateItem(index, 'abnormal_flag', event.target.value)}>
              {Object.keys(ABNORMAL_LABEL).map((flag) => <option key={flag} value={flag}>{ABNORMAL_LABEL[flag]}</option>)}
            </select>
            <input type="checkbox" checked={item.is_critical} onChange={(event) => updateItem(index, 'is_critical', event.target.checked)} />
            <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Xóa dòng">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <footer>
        <button type="button" onClick={() => setItems((current) => [...current, { item_code: '', item_name: '', numeric_value: '', result_value: '', unit: '', reference_range: '', abnormal_flag: 'unknown', is_critical: false, comment: '' }])}>
          <Plus size={15} />
          Thêm dòng
        </button>
        <label>
          <span>Diễn giải</span>
          <textarea value={interpretation} onChange={(event) => setInterpretation(event.target.value)} />
        </label>
        <label>
          <span>Ghi chú</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </footer>
    </section>
  );
}

function DetailDrawer({ selection, detail, loading, mode, onClose, onAction, onSaved }) {
  if (!selection && !loading) return null;
  const source = selection?.source;
  const orderDetail = detail?.lab_order ? detail : null;
  const resultDetail = detail?.result ? detail : null;
  const specimenDetail = detail?.specimen ? detail : null;
  const correctionDetail = detail?.correction ? detail : null;
  const catalogDetail = detail?.item ? detail : null;
  const order = orderDetail?.lab_order || labOrderOf(resultDetail?.result) || labOrderOf(specimenDetail?.specimen) || correctionDetail?.correction?.lab_order_id || catalogDetail?.item || {};
  const patient = orderDetail?.lab_order?.patient_id || resultDetail?.result?.patient_id || specimenDetail?.specimen?.patient_id || correctionDetail?.correction?.patient_id || {};

  return (
    <aside className="lab-work-drawer">
      <header>
        <div>
          <span>{source || 'Detail'}</span>
          <strong>{order.lab_order_no || resultDetail?.result?.result_no || specimenDetail?.specimen?.specimen_no || correctionDetail?.correction?.reason_code || catalogDetail?.item?.code || 'Đang tải'}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng drawer"><X size={18} /></button>
      </header>
      {loading ? <div className="lab-work-skeleton-stack"><span className="lab-work-skeleton" /><span className="lab-work-skeleton" /></div> : (
        <div className="lab-work-drawer__body">
          <section className="lab-patient-banner">
            <div>
              <strong>{patient?.full_name || 'Chưa rõ bệnh nhân'}</strong>
              <span>{patientLine(patient)} · {patient?.phone || '--'}</span>
            </div>
            {resultDetail?.result?.is_critical ? <Badge type="abnormal" value="critical" label="Critical" /> : null}
          </section>

          {orderDetail ? (
            <>
              <section className="lab-drawer-section">
                <h3>Order information</h3>
                <div className="lab-drawer-grid">
                  <span>Lab order <strong>{orderDetail.lab_order.lab_order_no}</strong></span>
                  <span>Test <strong>{orderDetail.lab_order.test_name}</strong></span>
                  <span>Priority <strong>{PRIORITY_LABEL[orderDetail.lab_order.priority] || orderDetail.lab_order.priority}</strong></span>
                  <span>Status <strong>{ORDER_STATUS_LABEL[orderDetail.lab_order.status] || orderDetail.lab_order.status}</strong></span>
                </div>
              </section>
              <section className="lab-drawer-section">
                <h3>Specimen timeline</h3>
                <div className="lab-mini-list">
                  {(orderDetail.specimens || []).map((item) => (
                    <article key={item._id}>
                      <strong>{item.specimen_no}</strong>
                      <span>{SPECIMEN_STATUS_LABEL[item.status] || item.status} · {formatDateTime(item.collected_at || item.received_at)}</span>
                    </article>
                  ))}
                </div>
              </section>
              <section className="lab-drawer-section">
                <h3>Result timeline</h3>
                <div className="lab-mini-list">
                  {(orderDetail.results || []).map((item) => (
                    <article key={item._id}>
                      <strong>{item.result_no}</strong>
                      <span>{RESULT_STATUS_LABEL[item.status] || item.status} · {formatDateTime(item.reported_at)}</span>
                    </article>
                  ))}
                </div>
              </section>
              {mode === 'result_entry' ? <ResultEditor detail={orderDetail} onSaved={onSaved} /> : null}
              <section className="lab-drawer-section">
                <h3>Audit activity</h3>
                <LabAuditTimeline items={orderDetail.activity || []} />
              </section>
            </>
          ) : null}

          {resultDetail ? (
            <>
              <section className="lab-drawer-section">
                <h3>Result review</h3>
                <div className="lab-drawer-grid">
                  <span>Result no <strong>{resultDetail.result.result_no}</strong></span>
                  <span>Status <strong>{RESULT_STATUS_LABEL[resultDetail.result.status] || resultDetail.result.status}</strong></span>
                  <span>Verified <strong>{formatDateTime(resultDetail.result.verified_at)}</strong></span>
                  <span>Released <strong>{resultDetail.result.released_to_patient ? 'Đã release' : 'Chưa release'}</strong></span>
                </div>
              </section>
              <ResultItems items={resultDetail.items || []} />
            </>
          ) : null}

          {specimenDetail ? (
            <>
              <section className="lab-drawer-section">
                <h3>Specimen identity</h3>
                <div className="lab-drawer-grid">
                  <span>Specimen no <strong>{specimenDetail.specimen.specimen_no}</strong></span>
                  <span>Barcode <strong>{specimenDetail.specimen.barcode_value || specimenDetail.specimen.barcode || '--'}</strong></span>
                  <span>Type <strong>{specimenDetail.specimen.specimen_type}</strong></span>
                  <span>Container <strong>{specimenDetail.specimen.container_type || '--'}</strong></span>
                  <span>Status <strong>{SPECIMEN_STATUS_LABEL[specimenDetail.specimen.status] || specimenDetail.specimen.status}</strong></span>
                  <span>SLA <strong><SlaBadge sla={specimenDetail.specimen.sla} /></strong></span>
                </div>
                <SpecimenWorkflowStepper status={specimenDetail.specimen.status} />
              </section>
              <section className="lab-drawer-section">
                <h3>Lab order</h3>
                <div className="lab-drawer-grid">
                  <span>Lab order <strong>{specimenDetail.lab_order?.lab_order_no || specimenDetail.specimen.lab_order?.lab_order_no || '--'}</strong></span>
                  <span>Test <strong>{specimenDetail.lab_order?.test_name || specimenDetail.specimen.lab_order?.test_name || '--'}</strong></span>
                  <span>Priority <strong>{PRIORITY_LABEL[specimenDetail.lab_order?.priority || specimenDetail.specimen.lab_order?.priority] || '--'}</strong></span>
                  <span>Order status <strong>{ORDER_STATUS_LABEL[specimenDetail.lab_order?.status || specimenDetail.specimen.lab_order?.status] || specimenDetail.lab_order?.status || '--'}</strong></span>
                </div>
              </section>
              <SpecimenQualityPanel specimen={specimenDetail.specimen} />
              <section className="lab-drawer-section">
                <h3>Testing</h3>
                <div className="lab-drawer-grid">
                  <span>Started <strong>{formatDateTime(specimenDetail.specimen.testing_started_at)}</strong></span>
                  <span>Performer <strong>{specimenDetail.specimen.testing_started_by?.full_name || '--'}</strong></span>
                  <span>Instrument <strong>{specimenDetail.specimen.instrument_id || '--'}</strong></span>
                  <span>Workstation <strong>{specimenDetail.specimen.workstation_id || '--'}</strong></span>
                </div>
              </section>
              <SpecimenStoragePanel specimen={specimenDetail.specimen} />
              {specimenDetail.specimen.status === 'rejected' ? (
                <section className="lab-drawer-section">
                  <h3>Từ chối mẫu</h3>
                  <div className="lab-drawer-grid">
                    <span>Lý do <strong>{specimenDetail.specimen.rejection_reason || '--'}</strong></span>
                    <span>Reason code <strong>{specimenDetail.specimen.rejection_reason_code || '--'}</strong></span>
                    <span>Need recollection <strong>{specimenDetail.specimen.need_recollection ? 'Có' : 'Không'}</strong></span>
                    <span>Rejected at <strong>{formatDateTime(specimenDetail.specimen.rejected_at)}</strong></span>
                  </div>
                </section>
              ) : null}
              <section className="lab-drawer-section">
                <h3>Kết quả liên quan</h3>
                <div className="lab-mini-list">
                  {(specimenDetail.linked_results || specimenDetail.specimen.linked_results || []).map((item) => (
                    <article key={item._id}>
                      <strong>{item.result_no || '--'}</strong>
                      <span>{RESULT_STATUS_LABEL[item.status] || item.status} · {item.is_critical ? 'Critical' : 'Non-critical'}</span>
                    </article>
                  ))}
                </div>
              </section>
              <SpecimenTimelinePreview detail={specimenDetail} />
            </>
          ) : null}

          {correctionDetail ? (
            <section className="lab-drawer-section">
              <h3>Correction request</h3>
              <p>{correctionDetail.correction.reason_text}</p>
              <div className="lab-drawer-grid">
                <span>Status <strong>{correctionDetail.correction.status}</strong></span>
                <span>Assigned <strong>{correctionDetail.correction.assigned_to?.full_name || '--'}</strong></span>
                <span>Due <strong>{formatDateTime(correctionDetail.correction.due_at)}</strong></span>
                <span>Resolved <strong>{formatDateTime(correctionDetail.correction.resolved_at)}</strong></span>
              </div>
            </section>
          ) : null}

          {catalogDetail ? (
            <section className="lab-drawer-section">
              <h3>Catalog template</h3>
              <div className="lab-drawer-grid">
                <span>Specimen <strong>{catalogDetail.item.specimen_type || '--'}</strong></span>
                <span>Container <strong>{catalogDetail.item.container_type || '--'}</strong></span>
                <span>TAT <strong>{catalogDetail.item.turnaround_minutes || '--'} phút</strong></span>
                <span>Reference <strong>{formatNumber(catalogDetail.item.reference_ranges?.length || 0)}</strong></span>
              </div>
              <ResultItems items={(catalogDetail.item.result_items || []).map((item) => ({ ...item, abnormal_flag: 'unknown' }))} />
            </section>
          ) : null}

          <footer className="lab-drawer-actions">
            {source === 'specimens' ? (
              <>
                <button type="button" onClick={() => onAction('print_specimen_label', specimenDetail?.specimen || selection?.row)}><Printer size={15} />In nhãn</button>
                <button type="button" onClick={() => onAction('specimen_timeline', specimenDetail?.specimen || selection?.row)}><History size={15} />Timeline</button>
                {specimenDetail?.specimen?.status === 'rejected' ? <button type="button" onClick={() => onAction('request_recollection', specimenDetail?.specimen || selection?.row)}><RefreshCw size={15} />Lấy lại</button> : null}
              </>
            ) : source === 'results' ? (
              <>
                <button type="button" onClick={() => onAction('print_result', resultDetail?.result || selection?.row)}><Printer size={15} />In</button>
                <button type="button" onClick={() => onAction('versions', resultDetail?.result || selection?.row)}><History size={15} />Version</button>
                <button type="button" onClick={() => onAction('download', selection?.row)}><Download size={15} />Tải</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => onAction('print_order_labels', orderDetail?.lab_order || selection?.row)}><Printer size={15} />In nhãn</button>
                <button type="button" onClick={() => onAction('download', selection?.row)}><Download size={15} />Tải</button>
              </>
            )}
          </footer>
        </div>
      )}
    </aside>
  );
}

export function LabWorklistPage({ pageKey }) {
  const config = LAB_PAGE_CONFIG[pageKey] || LAB_PAGE_CONFIG.orders;
  const [filters, setFilters] = useState(() => ({ page: 1, limit: 25, ...config.query }));
  const [selection, setSelection] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');
  const listState = useLabList(config, filters);
  const summaryState = useLabSummary(config.source);

  useEffect(() => {
    setFilters({ page: 1, limit: 25, ...config.query });
    setSelection(null);
    setDetail(null);
  }, [pageKey]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  async function openDetail(row) {
    setSelection({ row, source: config.source });
    setDetailLoading(true);
    try {
      const id = getId(row);
      const data = config.source === 'orders'
        ? await labWorkspaceAPI.orderDetail(id)
        : config.source === 'specimens'
          ? await Promise.all([
              labWorkspaceAPI.specimenDetail(id),
              labWorkspaceAPI.specimenTimeline(id).catch(() => null),
            ]).then(([specimenDetail, timeline]) => ({ ...specimenDetail, timeline: timeline?.timeline || [] }))
          : config.source === 'results'
            ? await labWorkspaceAPI.resultDetail(id)
            : config.source === 'corrections'
              ? await labWorkspaceAPI.correctionDetail(id)
              : await labWorkspaceAPI.catalogTestDetail(id);
      setDetail(data);
    } catch (error) {
      setToast(getLabErrorMessage(error, 'Không thể tải drawer chi tiết.'));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAction(action, row) {
    if (!row) return;
    try {
      if (action === 'acknowledge') await labWorkspaceAPI.acknowledgeOrder(getId(row));
      if (action === 'collect') await labWorkspaceAPI.collectOrder(getId(row), { specimen_type: row.specimen_type || row.test_name, container_type: row.container_type || '', storage_location: 'Rack nhận mẫu' });
      if (action === 'print_order_labels') await labWorkspaceAPI.printOrderLabels(getId(row));
      if (action === 'create_result') {
        setToast('Mở drawer để nhập result grid.');
        await openDetail(row);
        return;
      }
      if (action === 'collect_specimen') {
        const labOrder = labOrderOf(row);
        const labOrderId = labOrder._id || row.lab_order_id?._id || row.lab_order_id;
        await labWorkspaceAPI.collectOrder(labOrderId, {
          specimen_type: row.specimen_type || labOrder.specimen_type || labOrder.test_name,
          container_type: row.container_type || '',
          collected_at: new Date().toISOString(),
          collection_condition: row.collection_condition || 'acceptable',
        });
      }
      if (action === 'receive_specimen') await labWorkspaceAPI.receiveSpecimen(getId(row), {
        received_at: new Date().toISOString(),
        quality_check: {
          label_verified: true,
          patient_identity_verified: true,
          container_intact: true,
          volume_adequate: true,
          sample_quality: 'acceptable',
          clot_detected: false,
          leak_detected: false,
        },
      });
      if (action === 'reject_specimen') {
        const reason = window.prompt('Lý do từ chối mẫu', 'Mẫu không đạt điều kiện xét nghiệm');
        if (!reason) return;
        await labWorkspaceAPI.rejectSpecimen(getId(row), {
          reason,
          reason_code: 'pre_analytical_issue',
          stage: row.status === 'collected' ? 'receiving' : 'collection',
          severity: 'medium',
          need_recollection: true,
          cancel_order: false,
          notify_doctor: true,
          notify_nurse: true,
        });
      }
      if (action === 'process_specimen') await labWorkspaceAPI.processSpecimen(getId(row), {
        testing_started_at: new Date().toISOString(),
        workstation_id: 'lab-workstation',
        testing_note: 'Started from specimen workspace.',
      });
      if (action === 'store_specimen') await labWorkspaceAPI.storeSpecimen(getId(row), {
        storage_location: row.storage_location || 'Lab storage',
        stored_at: new Date().toISOString(),
        storage_note: 'Stored from specimen workspace.',
      });
      if (action === 'dispose_specimen') {
        const reason = window.prompt('Lý do hủy mẫu', 'Hết nhu cầu lưu mẫu');
        if (!reason) return;
        await labWorkspaceAPI.disposeSpecimen(getId(row), { reason, dispose_method: 'standard', force: row.status === 'in_testing' });
      }
      if (action === 'request_recollection') await labWorkspaceAPI.requestSpecimenRecollection(getId(row), { reason: 'Yêu cầu lấy lại mẫu từ workspace.', create_specimen: true });
      if (action === 'print_specimen_label') await labWorkspaceAPI.printSpecimenLabel(getId(row));
      if (action === 'specimen_timeline') {
        const timeline = await labWorkspaceAPI.specimenTimeline(getId(row));
        setToast(`Timeline mẫu có ${formatNumber(timeline.timeline?.length || 0)} event.`);
        await openDetail(row);
        return;
      }
      if (action === 'finalize_result') await labWorkspaceAPI.finalizeResult(getId(row));
      if (action === 'ack_critical') await labWorkspaceAPI.acknowledgeCritical(getId(row));
      if (action === 'release_result') await labWorkspaceAPI.releaseResult(getId(row));
      if (action === 'print_result') await labWorkspaceAPI.printResult(getId(row));
      if (action === 'request_correction') {
        const reason = window.prompt('Lý do yêu cầu sửa kết quả', 'Cần kiểm tra lại giá trị bất thường trước khi duyệt');
        if (!reason) return;
        await labWorkspaceAPI.requestCorrection(getId(row), { reason_text: reason, priority: row.lab_order_id?.priority || 'urgent' });
      }
      if (action === 'resolve_correction') await labWorkspaceAPI.resolveCorrection(getId(row), { resolution_note: 'Đã cập nhật kết quả và gửi lại hàng đợi duyệt.' });
      if (action === 'cancel_correction') await labWorkspaceAPI.cancelCorrection(getId(row), { reason: 'Hủy từ workspace xét nghiệm.' });
      if (action === 'activate_catalog') await labWorkspaceAPI.activateCatalogTest(getId(row));
      if (action === 'deactivate_catalog') await labWorkspaceAPI.deactivateCatalogTest(getId(row));
      if (action === 'versions') {
        const resultId = getId(row);
        if (resultId) {
          const versions = await labWorkspaceAPI.resultVersions(resultId);
          setToast(`Có ${formatNumber(versions.versions?.length || 0)} version result.`);
        }
        return;
      }
      setToast('Thao tác đã hoàn tất.');
      listState.refresh();
      summaryState.refresh();
      if (selection?.row && getId(selection.row) === getId(row)) openDetail(row);
    } catch (error) {
      setToast(getLabErrorMessage(error));
    }
  }

  async function lookupSpecimen(barcode) {
    if (!barcode?.trim()) return;
    try {
      const data = await labWorkspaceAPI.lookupSpecimen({ barcode: barcode.trim() });
      if (data?.specimen) {
        setToast(`Đã scan ${data.specimen.specimen_no}.`);
        await openDetail(data.specimen);
      }
    } catch (error) {
      setToast(getLabErrorMessage(error, 'Không tìm thấy specimen theo barcode.'));
    }
  }

  const rows = listState.data.items || [];
  const selectedId = getId(selection?.row);
  const table = useMemo(() => {
    if (config.source === 'orders') return <OrdersTable rows={rows} loading={listState.loading} mode={config.mode} onAction={handleAction} onOpenDetail={openDetail} selectedId={selectedId} />;
    if (config.source === 'specimens') return <SpecimensTable rows={rows} loading={listState.loading} mode={config.mode} onAction={handleAction} onOpenDetail={openDetail} selectedId={selectedId} />;
    if (config.source === 'results') return <ResultsTable rows={rows} loading={listState.loading} mode={config.mode} onAction={handleAction} onOpenDetail={openDetail} selectedId={selectedId} />;
    if (config.source === 'corrections') return <CorrectionsTable rows={rows} loading={listState.loading} onAction={handleAction} onOpenDetail={openDetail} selectedId={selectedId} />;
    return <CatalogTable rows={rows} loading={listState.loading} onAction={handleAction} onOpenDetail={openDetail} selectedId={selectedId} />;
  }, [config.source, config.mode, rows, listState.loading, selectedId]);

  return (
    <div className="lab-work-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <section className="lab-work-header">
        <div>
          <span>Xét nghiệm</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="lab-work-header__actions">
          <button type="button" onClick={() => { listState.refresh(); summaryState.refresh(); }}><RefreshCw size={16} />Làm mới</button>
          <button type="button"><Printer size={16} />In danh sách</button>
          <button type="button"><FileText size={16} />Export Excel</button>
        </div>
      </section>
      <KpiStrip summary={summaryState.data} loading={summaryState.loading} />
      <FilterBar filters={filters} setFilter={setFilter} refresh={listState.refresh} loading={listState.loading} source={config.source} onLookupSpecimen={lookupSpecimen} />
      <WidgetError message={listState.error || summaryState.error} onRetry={() => { listState.refresh(); summaryState.refresh(); }} />
      <section className="lab-work-layout">
        <main>{table}</main>
        <DetailDrawer
          selection={selection}
          detail={detail}
          loading={detailLoading}
          mode={config.mode}
          onClose={() => { setSelection(null); setDetail(null); }}
          onAction={handleAction}
          onSaved={(message) => {
            setToast(message);
            listState.refresh();
            summaryState.refresh();
            if (selection?.row) openDetail(selection.row);
          }}
        />
      </section>
    </div>
  );
}
