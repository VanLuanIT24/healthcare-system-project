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
  History,
  Paperclip,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Timer,
  Upload,
  WalletCards,
  X,
} from 'lucide-react';
import { downloadClinicalOpsCsv, notifyClinicalOps, printClinicalOpsView, promptClinicalOpsText } from '../ClinicalOpsWorkspace/clinicalOpsActions';
import { getProcedureErrorMessage, procedureApi } from './procedureApi';

const ORDER_STATUS_LABEL = {
  ordered: 'Chờ xếp lịch',
  scheduled: 'Đã xếp lịch',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  no_show: 'No-show',
};

const RESULT_STATUS_LABEL = {
  draft: 'Draft',
  preliminary: 'Preliminary',
  final: 'Final',
  amended: 'Amended',
  cancelled: 'Đã hủy',
};

const PREPARATION_STATUS_LABEL = {
  pending: 'Chờ chuẩn bị',
  assigned: 'Đã phân công',
  in_progress: 'Đang chuẩn bị',
  ready: 'Ready',
  blocked: 'Blocked',
  transferred: 'Đã chuyển',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

const PRIORITY_LABEL = {
  stat: 'STAT',
  urgent: 'Urgent',
  routine: 'Routine',
};

export const PROCEDURE_PAGE_CONFIG = {
  orders: {
    title: 'Procedure orders',
    subtitle: 'Trung tâm điều phối toàn bộ chỉ định thủ thuật từ order, lịch, thực hiện, kết quả, file đến chi phí.',
    source: 'orders',
    query: {},
    mode: 'orders',
  },
  waitingSchedule: {
    title: 'Chờ xếp lịch',
    subtitle: 'Queue order mới theo priority, SLA, bác sĩ chỉ định và trạng thái chuẩn bị.',
    source: 'orders',
    query: { status: 'ordered' },
    mode: 'waiting_schedule',
  },
  calendar: {
    title: 'Lịch thủ thuật',
    subtitle: 'Timeline các ca đã xếp lịch, nhóm theo performer và khoa thực hiện.',
    source: 'calendar',
    query: {},
    mode: 'calendar',
  },
  preparation: {
    title: 'Chuẩn bị thủ thuật',
    subtitle: 'Worklist điều dưỡng chuẩn bị, checklist, consent, safety risk và readiness score.',
    source: 'preparations',
    query: {},
    mode: 'preparation',
  },
  inProgress: {
    title: 'Đang thực hiện',
    subtitle: 'Active board cho thủ thuật đang diễn ra, file, ghi chú kỹ thuật, hoàn tất và tạo phí.',
    source: 'orders',
    query: { status: 'in_progress' },
    mode: 'in_progress',
  },
  results: {
    title: 'Kết quả thủ thuật',
    subtitle: 'Structured result, ký, release, critical note và lịch sử amend.',
    source: 'results',
    query: {},
    mode: 'results',
  },
  completed: {
    title: 'Hoàn tất thủ thuật',
    subtitle: 'Kiểm soát hậu hoàn tất: thiếu file, thiếu charge, kết quả chưa release và theo dõi hậu thủ thuật.',
    source: 'orders',
    query: { status: 'completed' },
    mode: 'completed',
  },
  noShow: {
    title: 'No-show',
    subtitle: 'Theo dõi bệnh nhân không đến, lý do, charge bị void và nhu cầu xếp lại lịch.',
    source: 'orders',
    query: { status: 'no_show' },
    mode: 'no_show',
  },
  files: {
    title: 'File thủ thuật',
    subtitle: 'Quản lý file thủ thuật, scan status, review, visibility và release cho bệnh nhân.',
    source: 'files',
    query: {},
    mode: 'files',
  },
  charges: {
    title: 'Chi phí thủ thuật',
    subtitle: 'Theo dõi charge thủ thuật, completed chưa có charge, invoice linkage và cảnh báo billing.',
    source: 'charges',
    query: {},
    mode: 'charges',
  },
};

function getId(row) {
  return row?._id || row?.id;
}

function populated(value) {
  return value && typeof value === 'object' ? value : {};
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function classToken(value) {
  return String(value || 'unknown').replace(/_/g, '-');
}

function patientOf(row) {
  return populated(row?.patient_id || row?.patient || row?.procedure_order?.patient_id);
}

function procedureOf(row) {
  return populated(row?.procedure_order_id || row?.procedure_order || row);
}

function patientAge(patient) {
  const dob = parseDate(patient?.date_of_birth);
  if (!dob) return '';
  return `${Math.max(new Date().getFullYear() - dob.getFullYear(), 0)} tuổi`;
}

function Badge({ type = 'order', value, label }) {
  return <span className={`lab-work-badge lab-work-badge--${type} is-${classToken(value)}`}>{label || value || '--'}</span>;
}

function PriorityBadge({ priority }) {
  return <Badge type="priority" value={priority || 'routine'} label={PRIORITY_LABEL[priority] || priority || 'Routine'} />;
}

function StatusBadge({ status, kind = 'order' }) {
  const maps = { order: ORDER_STATUS_LABEL, result: RESULT_STATUS_LABEL, preparation: PREPARATION_STATUS_LABEL, file: {} };
  return <Badge type={kind} value={status} label={maps[kind]?.[status] || status || '--'} />;
}

function SlaBadge({ sla }) {
  if (!sla) return <Badge type="sla" value="neutral" label="SLA --" />;
  if (sla.state === 'done') return <Badge type="sla" value="normal" label="SLA done" />;
  const label = sla.is_overdue ? `Quá ${formatNumber(sla.breached_minutes)}p` : `Còn ${formatNumber(sla.remaining_minutes || 0)}p`;
  return <Badge type="sla" value={sla.risk_level || 'neutral'} label={label} />;
}

function PatientCell({ patient }) {
  return (
    <div className="lab-work-patient">
      <strong>{patient?.full_name || 'Chưa rõ bệnh nhân'}</strong>
      <span>{[patient?.patient_code, patient?.gender, patientAge(patient)].filter(Boolean).join(' · ') || '--'}</span>
    </div>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="lab-work-toast" role="status">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Đóng thông báo"><X size={15} /></button>
    </div>
  );
}

function WidgetError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="lab-work-error">
      <AlertTriangle size={17} />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function EmptyState({ title = 'Chưa có dữ liệu', description = 'Thay đổi bộ lọc hoặc làm mới danh sách.' }) {
  return (
    <div className="lab-work-empty">
      <ClipboardList size={28} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function useProcedureDashboard() {
  const [state, setState] = useState({ loading: true, error: '', data: {} });
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    procedureApi.dashboardSummary()
      .then((data) => {
        if (active) setState({ loading: false, error: '', data: data || {} });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: getProcedureErrorMessage(error), data: {} });
      });
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  return { ...state, refresh: () => setRefreshIndex((value) => value + 1) };
}

function useProcedureList(config, filters) {
  const [state, setState] = useState({ loading: true, error: '', data: { items: [], pagination: {} } });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const key = JSON.stringify(filters || {});

  useEffect(() => {
    let active = true;
    const loaders = {
      orders: procedureApi.listOrders,
      calendar: procedureApi.calendar,
      preparations: procedureApi.listPreparations,
      files: procedureApi.listFiles,
      charges: procedureApi.listCharges,
      results: procedureApi.listResults,
    };
    setState((current) => ({ ...current, loading: true, error: '' }));
    loaders[config.source](filters)
      .then((data) => {
        const items = data?.items || data?.preparations || [];
        if (active) setState({ loading: false, error: '', data: { ...data, items } });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: getProcedureErrorMessage(error), data: { items: [], pagination: {} } });
      });
    return () => {
      active = false;
    };
  }, [config.source, key, refreshIndex]);

  return { ...state, refresh: () => setRefreshIndex((value) => value + 1) };
}

function KpiStrip({ summary = {}, loading }) {
  const status = summary.by_status || {};
  const resultStatus = summary.result_by_status || {};
  const kpis = [
    ['Tổng order', summary.total_procedure_orders, ClipboardList, 'primary'],
    ['Chờ xếp lịch', status.ordered, Clock3, 'warning'],
    ['Đã xếp lịch', status.scheduled || summary.upcoming_scheduled, CalendarDays, 'info'],
    ['Đang thực hiện', status.in_progress, Activity, 'info'],
    ['Hoàn tất', status.completed, CheckCircle2, 'success'],
    ['No-show', status.no_show, AlertTriangle, 'danger'],
    ['Thiếu file', summary.completed_missing_attachment, Paperclip, 'warning'],
    ['Thiếu charge', summary.completed_missing_charge, WalletCards, 'warning'],
    ['Final result', (resultStatus.final || 0) + (resultStatus.amended || 0), BadgeCheck, 'success'],
    ['Critical', summary.critical_unacknowledged, ShieldAlert, 'danger'],
  ];

  return (
    <section className="lab-work-kpi-strip">
      {kpis.map(([label, value, Icon, tone]) => (
        <article key={label} className={`lab-work-kpi is-${tone}`}>
          <Icon size={20} />
          <span>{label}</span>
          <strong>{loading ? <span className="lab-work-skeleton--number" /> : formatNumber(value || 0)}</strong>
        </article>
      ))}
    </section>
  );
}

function FilterBar({ filters, setFilter, refresh, loading, source }) {
  return (
    <section className="lab-work-filter-bar">
      <label className="lab-work-filter-bar__search">
        <Search size={16} />
        <input
          value={filters.search || ''}
          onChange={(event) => setFilter('search', event.target.value)}
          placeholder="Tìm mã, tên thủ thuật, file hoặc bệnh nhân"
        />
      </label>
      {source === 'orders' ? (
        <label>
          Trạng thái
          <select value={filters.status || ''} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      ) : null}
      {['orders', 'calendar'].includes(source) ? (
        <label>
          Priority
          <select value={filters.priority || ''} onChange={(event) => setFilter('priority', event.target.value)}>
            <option value="">Tất cả</option>
            <option value="stat">STAT</option>
            <option value="urgent">Urgent</option>
            <option value="routine">Routine</option>
          </select>
        </label>
      ) : null}
      {source === 'results' ? (
        <label>
          Result
          <select value={filters.status || ''} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="">Tất cả</option>
            {Object.entries(RESULT_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      ) : null}
      {source === 'files' ? (
        <label>
          Review
          <select value={filters.review_status || ''} onChange={(event) => setFilter('review_status', event.target.value)}>
            <option value="">Tất cả</option>
            <option value="pending">Chờ review</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      ) : null}
      {source === 'charges' ? (
        <label>
          Charge
          <select value={filters.missing || ''} onChange={(event) => setFilter('missing', event.target.value)}>
            <option value="">Đã tạo charge</option>
            <option value="true">Completed thiếu charge</option>
          </select>
        </label>
      ) : null}
      {source === 'calendar' ? (
        <label>
          Ngày
          <input type="date" value={filters.date || ''} onChange={(event) => setFilter('date', event.target.value)} />
        </label>
      ) : null}
      <button type="button" className="lab-work-refresh" onClick={refresh}>
        <RefreshCw className={loading ? 'is-spinning' : ''} size={16} />
        Làm mới
      </button>
    </section>
  );
}

function RowActions({ row, mode, onAction }) {
  const status = row?.status;
  const resultStatus = row?.result_summary?.status;
  return (
    <div className="lab-work-row-actions">
      <button type="button" onClick={() => onAction('detail', row)}><FileText size={14} />Chi tiết</button>
      {['orders', 'waiting_schedule'].includes(mode) && ['ordered', 'scheduled'].includes(status) ? (
        <button type="button" onClick={() => onAction(status === 'scheduled' ? 'reschedule' : 'schedule', row)}><CalendarDays size={14} />Xếp lịch</button>
      ) : null}
      {['ordered', 'scheduled'].includes(status) ? (
        <button type="button" onClick={() => onAction('start', row)}><Play size={14} />Bắt đầu</button>
      ) : null}
      {status === 'in_progress' ? (
        <button type="button" onClick={() => onAction('complete', row)}><CheckCircle2 size={14} />Hoàn tất</button>
      ) : null}
      {status === 'completed' && !resultStatus ? (
        <button type="button" onClick={() => onAction('create_result', row)}><FileCheck2 size={14} />Result</button>
      ) : null}
      {status === 'completed' ? (
        <button type="button" onClick={() => onAction('create_charge', row)}><WalletCards size={14} />Tạo phí</button>
      ) : null}
      {!['cancelled', 'no_show', 'completed'].includes(status) ? (
        <button type="button" onClick={() => onAction('cancel', row)}><AlertTriangle size={14} />Hủy</button>
      ) : null}
    </div>
  );
}

function OrdersTable({ rows, loading, selectedId, mode, onOpenDetail, onAction }) {
  if (loading) return <div className="lab-work-table-shell"><div className="lab-work-skeleton-stack"><span /><span /><span /></div></div>;
  if (!rows.length) return <EmptyState title="Không có order thủ thuật phù hợp" />;

  return (
    <section className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Priority</th>
            <th>Procedure</th>
            <th>Bệnh nhân</th>
            <th>Trạng thái</th>
            <th>Lịch / thực tế</th>
            <th>File</th>
            <th>Charge</th>
            <th>SLA</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const patient = patientOf(row);
            const isSelected = selectedId === getId(row);
            return (
              <tr key={getId(row)} className={isSelected ? 'is-selected' : ''} onClick={() => onOpenDetail(row)}>
                <td><PriorityBadge priority={row.priority} /></td>
                <td>
                  <div className="lab-work-link-cell">
                    <strong>{row.procedure_order_no || '--'}</strong>
                    <span>{row.procedure_name || row.procedure_code || '--'}</span>
                  </div>
                </td>
                <td><PatientCell patient={patient} /></td>
                <td><StatusBadge status={row.status} /></td>
                <td>
                  <strong>{formatDateTime(row.scheduled_start)}</strong>
                  <small>{row.performed_start ? `Start ${formatDateTime(row.performed_start)}` : row.completed_at ? `Done ${formatDateTime(row.completed_at)}` : 'Chưa có thực tế'}</small>
                </td>
                <td><Badge type="file" value={row.attachment_summary?.attachment_count ? 'accepted' : 'pending'} label={`${row.attachment_summary?.attachment_count || 0} file`} /></td>
                <td><Badge type="file" value={row.charge_summary?.charge_count ? 'accepted' : 'pending'} label={row.charge_summary?.charge_count ? formatMoney(row.charge_summary.total_amount) : 'Chưa phí'} /></td>
                <td><SlaBadge sla={row.sla} /></td>
                <td onClick={(event) => event.stopPropagation()}><RowActions row={row} mode={mode} onAction={onAction} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function CalendarBoard({ data, loading, onOpenDetail, onAction }) {
  const items = data.items || [];
  if (loading) return <div className="lab-work-table-shell"><div className="lab-work-skeleton-stack"><span /><span /><span /></div></div>;
  if (!items.length) return <EmptyState title="Chưa có ca thủ thuật trong lịch" description="Chọn ngày khác hoặc xếp lịch từ queue chờ." />;

  const groups = data.performers?.length ? data.performers : [{ performer_id: 'all', items }];
  return (
    <section className="procedure-calendar-board">
      {groups.map((group) => (
        <article key={group.performer_id} className="procedure-calendar-lane">
          <header>
            <span>Performer</span>
            <strong>{group.performer_id === 'unassigned' ? 'Chưa phân công' : `${group.items.length} ca`}</strong>
          </header>
          <div className="procedure-calendar-lane__items">
            {group.items.map((row) => (
              <button key={getId(row)} type="button" className="procedure-calendar-card" onClick={() => onOpenDetail(row)}>
                <time>{formatDateTime(row.scheduled_start)}</time>
                <strong>{row.procedure_name}</strong>
                <span>{patientOf(row)?.full_name || 'Chưa rõ bệnh nhân'}</span>
                <div>
                  <PriorityBadge priority={row.priority} />
                  <SlaBadge sla={row.sla} />
                </div>
                <div className="procedure-calendar-card__actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onAction('start', row)}><Play size={13} />Start</button>
                  <button type="button" onClick={() => onAction('no_show', row)}><AlertTriangle size={13} />No-show</button>
                </div>
              </button>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function PreparationBoard({ rows, loading, selectedId, onOpenDetail, onAction }) {
  if (loading) return <div className="lab-work-table-shell"><div className="lab-work-skeleton-stack"><span /><span /><span /></div></div>;
  if (!rows.length) return <EmptyState title="Chưa có bệnh nhân cần chuẩn bị thủ thuật" />;
  const lanes = ['pending', 'assigned', 'in_progress', 'ready', 'blocked', 'transferred'];

  return (
    <section className="procedure-kanban">
      {lanes.map((lane) => {
        const laneRows = rows.filter((row) => row.status === lane);
        return (
          <article key={lane} className="procedure-kanban-lane">
            <header>
              <span>{PREPARATION_STATUS_LABEL[lane]}</span>
              <strong>{laneRows.length}</strong>
            </header>
            {laneRows.map((row) => (
              <button key={getId(row)} type="button" className={`procedure-prep-card${selectedId === getId(row) ? ' is-selected' : ''}`} onClick={() => onOpenDetail(row)}>
                <div>
                  <PriorityBadge priority={row.priority} />
                  <StatusBadge status={row.status} kind="preparation" />
                </div>
                <strong>{row.title || 'Chuẩn bị thủ thuật'}</strong>
                <span>{patientOf(row)?.full_name || row.patient_id?.full_name || 'Bệnh nhân'}</span>
                <small>Checklist {row.checklist_required_done || 0}/{row.checklist_required_total || 0} · readiness {row.readiness_score || 0}%</small>
                <div className="procedure-card-meter"><i style={{ width: `${Math.min(row.readiness_score || 0, 100)}%` }} /></div>
                <footer onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => onAction('prep_start', row)}>Start</button>
                  <button type="button" onClick={() => onAction('prep_ready', row)}>Ready</button>
                  <button type="button" onClick={() => onAction('prep_block', row)}>Block</button>
                </footer>
              </button>
            ))}
          </article>
        );
      })}
    </section>
  );
}

function ResultsTable({ rows, loading, selectedId, onOpenDetail, onAction }) {
  if (loading) return <div className="lab-work-table-shell"><div className="lab-work-skeleton-stack"><span /><span /><span /></div></div>;
  if (!rows.length) return <EmptyState title="Chưa có structured procedure result" />;
  return (
    <section className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Procedure</th>
            <th>Bệnh nhân</th>
            <th>Status</th>
            <th>Kết luận</th>
            <th>Ký / release</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''} onClick={() => onOpenDetail(row)}>
              <td><strong>{row.result_no || '--'}</strong></td>
              <td>
                <div className="lab-work-link-cell">
                  <strong>{procedureOf(row)?.procedure_order_no || '--'}</strong>
                  <span>{procedureOf(row)?.procedure_name || '--'}</span>
                </div>
              </td>
              <td><PatientCell patient={patientOf(row)} /></td>
              <td><StatusBadge status={row.status} kind="result" /></td>
              <td><small>{row.conclusion || row.findings || '--'}</small></td>
              <td>
                <Badge type="file" value={row.signed_at ? 'accepted' : 'pending'} label={row.signed_at ? 'Đã ký' : 'Chưa ký'} />
                <Badge type="file" value={row.released_to_patient ? 'accepted' : 'pending'} label={row.released_to_patient ? 'Patient' : 'Chưa release'} />
              </td>
              <td onClick={(event) => event.stopPropagation()}>
                <div className="lab-work-row-actions">
                  <button type="button" onClick={() => onOpenDetail(row)}><FileText size={14} />Chi tiết</button>
                  {['draft', 'preliminary'].includes(row.status) ? <button type="button" onClick={() => onAction('finalize_result', row)}><BadgeCheck size={14} />Final</button> : null}
                  {['final', 'amended'].includes(row.status) && !row.signed_at ? <button type="button" onClick={() => onAction('sign_result', row)}><FileCheck2 size={14} />Ký</button> : null}
                  {['final', 'amended'].includes(row.status) ? <button type="button" onClick={() => onAction('release_result_patient', row)}><Download size={14} />Release</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FilesTable({ rows, loading, selectedId, onOpenDetail, onAction }) {
  if (loading) return <div className="lab-work-table-shell"><div className="lab-work-skeleton-stack"><span /><span /><span /></div></div>;
  if (!rows.length) return <EmptyState title="Chưa có file thủ thuật" />;
  return (
    <section className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Bệnh nhân</th>
            <th>Scan</th>
            <th>Review</th>
            <th>Visibility</th>
            <th>Upload</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''} onClick={() => onOpenDetail(row)}>
              <td>
                <div className="lab-work-link-cell">
                  <strong>{row.original_name || row.file_name}</strong>
                  <span>{row.category || row.mime_type || '--'} · {formatNumber(row.file_size || 0)} bytes</span>
                </div>
              </td>
              <td><PatientCell patient={patientOf(row)} /></td>
              <td><Badge type="file" value={row.scan_status || 'pending'} label={row.scan_status || 'pending'} /></td>
              <td><Badge type="file" value={row.review_status || 'pending'} label={row.review_status || 'pending'} /></td>
              <td><Badge type="file" value={row.released_to_patient ? 'accepted' : 'pending'} label={row.released_to_patient ? 'Patient' : row.visibility || 'staff'} /></td>
              <td><small>{formatDateTime(row.created_at)}</small></td>
              <td onClick={(event) => event.stopPropagation()}>
                <div className="lab-work-row-actions">
                  <button type="button" onClick={() => onAction('file_approve', row)}><CheckCircle2 size={14} />Approve</button>
                  <button type="button" onClick={() => onAction('file_release', row)}><Download size={14} />Release</button>
                  <button type="button" onClick={() => onAction('file_archive', row)}><History size={14} />Archive</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ChargesTable({ rows, loading, selectedId, onOpenDetail, onAction }) {
  if (loading) return <div className="lab-work-table-shell"><div className="lab-work-skeleton-stack"><span /><span /><span /></div></div>;
  if (!rows.length) return <EmptyState title="Không có dòng phí thủ thuật phù hợp" />;
  return (
    <section className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Procedure</th>
            <th>Bệnh nhân</th>
            <th>Service / charge</th>
            <th>Thành tiền</th>
            <th>Status</th>
            <th>Invoice</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const procedure = row.procedure_order || row.procedure_order_id || {};
            const charge = row.missing_charge ? null : row;
            return (
              <tr key={getId(row) || getId(procedure)} className={selectedId === (getId(row) || getId(procedure)) ? 'is-selected' : ''} onClick={() => onOpenDetail(row)}>
                <td>
                  <div className="lab-work-link-cell">
                    <strong>{procedure.procedure_order_no || charge?.order_id?.order_no || '--'}</strong>
                    <span>{procedure.procedure_name || charge?.description || 'Chi phí thủ thuật'}</span>
                  </div>
                </td>
                <td><PatientCell patient={patientOf(row) || patientOf(procedure)} /></td>
                <td>{charge ? <small>{charge.service_id?.service_name || charge.description}</small> : <Badge type="file" value="pending" label="Thiếu charge" />}</td>
                <td><strong>{charge ? formatMoney(charge.total_amount) : '--'}</strong></td>
                <td>{charge ? <Badge type="file" value={charge.status} label={charge.status} /> : <Badge type="file" value="pending" label="missing" />}</td>
                <td><small>{charge?.invoice_id || 'Chưa lên hóa đơn'}</small></td>
                <td onClick={(event) => event.stopPropagation()}>
                  <div className="lab-work-row-actions">
                    {row.missing_charge ? <button type="button" onClick={() => onAction('create_charge', procedure)}><WalletCards size={14} />Tạo phí</button> : null}
                    <button type="button" onClick={() => onOpenDetail(row)}><FileText size={14} />Chi tiết</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="lab-drawer-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function DetailDrawer({ selection, detail, loading, onClose, onAction }) {
  if (!selection) return <aside className="lab-work-drawer lab-work-drawer--empty"><EmptyState title="Chọn một hồ sơ thủ thuật" description="Drawer sẽ hiển thị tổng quan, chuẩn bị, file, chi phí, kết quả và timeline." /></aside>;
  const order = detail?.procedure_order || detail?.order || selection.row?.procedure_order || selection.row;
  const result = detail?.result || selection.row?.result || (selection.source === 'results' ? selection.row : null);
  const file = detail?.file || (selection.source === 'files' ? selection.row : null);
  const charge = detail?.charge || (selection.source === 'charges' ? selection.row : null);
  const patient = patientOf(order) || patientOf(result) || patientOf(file) || patientOf(charge);
  const allowed = detail?.allowed_actions || {};

  return (
    <aside className="lab-work-drawer">
      <header>
        <span>{selection.source === 'results' ? 'Procedure result' : 'Procedure order'}</span>
        <strong>{result?.result_no || order?.procedure_order_no || file?.file_name || charge?.charge_no || 'Chi tiết'}</strong>
        <button type="button" onClick={onClose} aria-label="Đóng drawer"><X size={18} /></button>
      </header>
      <div className="lab-work-drawer__body">
        {loading ? (
          <div className="lab-work-skeleton-stack"><span /><span /><span /></div>
        ) : (
          <>
            <DetailSection title="Tổng quan">
              <div className="lab-drawer-grid">
                <span>Bệnh nhân<strong>{patient?.full_name || '--'}</strong></span>
                <span>Mã BN<strong>{patient?.patient_code || '--'}</strong></span>
                <span>Thủ thuật<strong>{order?.procedure_name || result?.procedure_order_id?.procedure_name || '--'}</strong></span>
                <span>Trạng thái<strong>{ORDER_STATUS_LABEL[order?.status] || RESULT_STATUS_LABEL[result?.status] || order?.status || '--'}</strong></span>
                <span>Priority<strong>{PRIORITY_LABEL[order?.priority] || order?.priority || '--'}</strong></span>
                <span>Lịch<strong>{formatDateTime(order?.scheduled_start)}</strong></span>
                <span>Bắt đầu<strong>{formatDateTime(order?.performed_start)}</strong></span>
                <span>Hoàn tất<strong>{formatDateTime(order?.performed_end || order?.completed_at)}</strong></span>
              </div>
            </DetailSection>

            <DetailSection title="Chỉ định và kết quả">
              <p>{order?.clinical_indication || order?.order_id?.clinical_indication || 'Chưa có chỉ định lâm sàng.'}</p>
              <div className="procedure-result-panel">
                <strong>{result?.conclusion || order?.result_note || 'Chưa có kết quả structured.'}</strong>
                <span>{result?.findings || result?.technique || 'Result note và file sẽ hiển thị tại đây khi hoàn tất.'}</span>
              </div>
            </DetailSection>

            {detail?.preparation ? (
              <DetailSection title="Chuẩn bị thủ thuật">
                <div className="lab-drawer-grid">
                  <span>Status<strong>{PREPARATION_STATUS_LABEL[detail.preparation.status] || detail.preparation.status}</strong></span>
                  <span>Checklist<strong>{detail.preparation.checklist_required_done || 0}/{detail.preparation.checklist_required_total || 0}</strong></span>
                  <span>Readiness<strong>{detail.preparation.readiness_score || 0}%</strong></span>
                  <span>Safety risk<strong>{detail.preparation.has_safety_risk ? 'Có' : 'Không'}</strong></span>
                </div>
              </DetailSection>
            ) : null}

            <DetailSection title="File và chi phí">
              <div className="procedure-mini-list">
                {(detail?.attachments || []).slice(0, 5).map((item) => (
                  <span key={getId(item)}><Paperclip size={14} />{item.original_name || item.file_name}<Badge type="file" value={item.review_status} label={item.review_status} /></span>
                ))}
                {!(detail?.attachments || []).length ? <p>Chưa có file thủ thuật.</p> : null}
              </div>
              <div className="procedure-mini-list">
                {(detail?.charges || []).slice(0, 4).map((item) => (
                  <span key={getId(item)}><WalletCards size={14} />{item.charge_no}<strong>{formatMoney(item.total_amount)}</strong></span>
                ))}
                {!(detail?.charges || []).length && !charge ? <p>Chưa có charge thủ thuật.</p> : null}
              </div>
            </DetailSection>

            {detail?.post_procedure_observations?.length ? (
              <DetailSection title="Hậu thủ thuật">
                <div className="procedure-mini-list">
                  {detail.post_procedure_observations.slice(0, 5).map((item) => (
                    <span key={getId(item)}>
                      <Timer size={14} />
                      Pain {item.pain_score ?? '--'} · {item.bleeding_level} · {item.severity}
                    </span>
                  ))}
                </div>
              </DetailSection>
            ) : null}

            <DetailSection title="Timeline">
              <div className="lab-drawer-timeline">
                {(detail?.activity || detail?.timeline?.events || []).slice(0, 8).map((item, index) => (
                  <article key={getId(item) || `${item.event_type}-${index}`}>
                    <i />
                    <div>
                      <strong>{item.message || item.title || item.action || item.event_type}</strong>
                      <span>{formatDateTime(item.created_at || item.event_time)}</span>
                    </div>
                  </article>
                ))}
                {!(detail?.activity || detail?.timeline?.events || []).length ? <p>Chưa có timeline.</p> : null}
              </div>
            </DetailSection>

            <footer className="lab-drawer-actions">
              {allowed.can_schedule ? <button type="button" onClick={() => onAction('schedule', order)}><CalendarDays size={15} />Xếp lịch</button> : null}
              {allowed.can_start ? <button type="button" onClick={() => onAction('start', order)}><Play size={15} />Bắt đầu</button> : null}
              {allowed.can_complete ? <button type="button" onClick={() => onAction('complete', order)}><CheckCircle2 size={15} />Hoàn tất</button> : null}
              {allowed.can_upload_attachment ? <button type="button" onClick={() => onAction('upload_file', order)}><Upload size={15} />Upload</button> : null}
              {allowed.can_create_charge ? <button type="button" onClick={() => onAction('create_charge', order)}><WalletCards size={15} />Tạo phí</button> : null}
              {allowed.can_create_result ? <button type="button" onClick={() => onAction('create_result', order)}><FileCheck2 size={15} />Tạo result</button> : null}
              {result && ['draft', 'preliminary'].includes(result.status) ? <button type="button" onClick={() => onAction('finalize_result', result)}><BadgeCheck size={15} />Final</button> : null}
              {result && ['final', 'amended'].includes(result.status) ? <button type="button" onClick={() => onAction('release_result_patient', result)}><Download size={15} />Release</button> : null}
            </footer>
          </>
        )}
      </div>
    </aside>
  );
}

function defaultScheduleWindow() {
  const start = new Date(Date.now() + 30 * 60 * 1000);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 45 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function ProcedureWorklistPage({ pageKey }) {
  const config = PROCEDURE_PAGE_CONFIG[pageKey] || PROCEDURE_PAGE_CONFIG.orders;
  const [filters, setFilters] = useState(() => ({ page: 1, limit: 25, ...config.query }));
  const [selection, setSelection] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');
  const listState = useProcedureList(config, filters);
  const dashboardState = useProcedureDashboard();

  useEffect(() => {
    setFilters({ page: 1, limit: 25, ...config.query });
    setSelection(null);
    setDetail(null);
  }, [pageKey]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  async function openDetail(row) {
    const source = config.source;
    setSelection({ row, source });
    setDetailLoading(true);
    try {
      let data = null;
      if (source === 'orders' || source === 'calendar') {
        data = await procedureApi.orderDetail(getId(row));
      } else if (source === 'results') {
        data = await procedureApi.resultDetail(getId(row));
      } else if (source === 'preparations') {
        const id = getId(row);
        const [preparation, checklist, timeline] = await Promise.all([
          procedureApi.preparationDetail(id),
          procedureApi.preparationChecklist(id).catch(() => null),
          procedureApi.preparationTimeline(id).catch(() => null),
        ]);
        data = { preparation: preparation?.preparation || preparation, checklist, timeline };
      } else if (source === 'files' && row.entity_id) {
        data = await procedureApi.orderDetail(row.entity_id).catch(() => ({ file: row }));
        data.file = row;
      } else if (source === 'charges' && row.procedure_order?._id) {
        data = await procedureApi.orderDetail(row.procedure_order._id);
        data.charge = row;
      } else {
        data = { [source.slice(0, -1) || 'row']: row };
      }
      setDetail(data);
    } catch (error) {
      setToast(getProcedureErrorMessage(error, 'Không thể tải drawer chi tiết thủ thuật.'));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshAll(rowForDetail = null) {
    listState.refresh();
    dashboardState.refresh();
    if (rowForDetail || selection?.row) await openDetail(rowForDetail || selection.row);
  }

  async function handleAction(action, row) {
    if (action === 'detail') return openDetail(row);
    try {
      const orderId = getId(row?.procedure_order || row);
      const resultId = getId(row);
      if (action === 'schedule' || action === 'reschedule') {
        const windowValue = defaultScheduleWindow();
        const scheduledStart = promptClinicalOpsText({ title: action === 'reschedule' ? 'Dời lịch thủ thuật' : 'Xếp lịch thủ thuật', message: 'Thời gian bắt đầu thủ thuật ISO', defaultValue: windowValue.start });
        if (!scheduledStart) return;
        const scheduledEnd = promptClinicalOpsText({ title: action === 'reschedule' ? 'Dời lịch thủ thuật' : 'Xếp lịch thủ thuật', message: 'Thời gian kết thúc dự kiến ISO', defaultValue: windowValue.end });
        const payload = { scheduled_start: scheduledStart, scheduled_end: scheduledEnd || undefined, allow_past_schedule: false };
        if (action === 'reschedule') await procedureApi.rescheduleOrder(orderId, payload);
        else await procedureApi.scheduleOrder(orderId, payload);
      }
      if (action === 'start') await procedureApi.startOrder(orderId, { performed_start: new Date().toISOString() });
      if (action === 'complete') {
        const resultNote = promptClinicalOpsText({ title: 'Hoàn tất thủ thuật', message: 'Ghi chú hoàn tất thủ thuật', defaultValue: row?.result_note || 'Thủ thuật hoàn tất, bệnh nhân ổn định.' });
        if (!resultNote) return;
        await procedureApi.completeOrder(orderId, { result_note: resultNote, create_charge: true, allow_empty_result_note: false });
      }
      if (action === 'cancel') {
        const reason = promptClinicalOpsText({ title: 'Hủy thủ thuật', message: 'Lý do hủy thủ thuật', defaultValue: 'Hủy theo yêu cầu vận hành' });
        if (!reason) return;
        await procedureApi.cancelOrder(orderId, { reason });
      }
      if (action === 'no_show') {
        const reason = promptClinicalOpsText({ title: 'Ghi nhận no-show', message: 'Lý do no-show', defaultValue: 'Bệnh nhân không đến đúng lịch' });
        if (!reason) return;
        await procedureApi.markNoShow(orderId, { reason, force: true });
      }
      if (action === 'upload_file') {
        const fileName = promptClinicalOpsText({ title: 'Upload file thủ thuật', message: 'Tên file thủ thuật', defaultValue: `procedure-${Date.now()}.pdf` });
        if (!fileName) return;
        await procedureApi.uploadAttachment(orderId, {
          file_name: fileName,
          original_name: fileName,
          mime_type: 'application/pdf',
          storage_path: `procedure/${orderId}/${fileName}`,
          category: 'procedure_result',
          description: 'Upload từ procedure workspace',
        });
      }
      if (action === 'create_charge') await procedureApi.createCharge(orderId, { quantity: 1, status: 'posted' });
      if (action === 'create_result') {
        const conclusion = promptClinicalOpsText({ title: 'Tạo kết quả thủ thuật', message: 'Kết luận thủ thuật', defaultValue: row?.result_note || 'Thủ thuật hoàn tất, chưa ghi nhận biến chứng.' });
        if (!conclusion) return;
        await procedureApi.createResult(orderId, {
          technique: row?.procedure_name,
          findings: row?.result_note,
          conclusion,
          status: 'draft',
        });
      }
      if (action === 'finalize_result') await procedureApi.finalizeResult(resultId);
      if (action === 'sign_result') await procedureApi.signResult(resultId);
      if (action === 'release_result_patient') await procedureApi.releaseResultToPatient(resultId);
      if (action === 'file_approve') await procedureApi.reviewFile(getId(row), { review_status: 'accepted', review_note: 'Approved from procedure workspace' });
      if (action === 'file_release') await procedureApi.releaseFile(getId(row), { visibility: 'patient_visible' });
      if (action === 'file_archive') {
        const reason = promptClinicalOpsText({ title: 'Archive file thủ thuật', message: 'Lý do archive file', defaultValue: 'Lưu trữ từ procedure workspace' });
        if (!reason) return;
        await procedureApi.archiveFile(getId(row), { reason });
      }
      if (action === 'prep_start') await procedureApi.startPreparation(getId(row));
      if (action === 'prep_ready') await procedureApi.readyPreparation(getId(row));
      if (action === 'prep_block') {
        const reason = promptClinicalOpsText({ title: 'Block chuẩn bị thủ thuật', message: 'Lý do block chuẩn bị', defaultValue: 'Thiếu consent hoặc checklist bắt buộc' });
        if (!reason) return;
        await procedureApi.blockPreparation(getId(row), { reason, blocked_reason_text: reason });
      }
      setToast('Thao tác thủ thuật đã hoàn tất.');
      await refreshAll(row);
    } catch (error) {
      setToast(getProcedureErrorMessage(error));
    }
  }

  const rows = listState.data.items || [];
  const selectedId = getId(selection?.row);
  const content = useMemo(() => {
    if (config.source === 'calendar') return <CalendarBoard data={listState.data} loading={listState.loading} onOpenDetail={openDetail} onAction={handleAction} />;
    if (config.source === 'preparations') return <PreparationBoard rows={rows} loading={listState.loading} selectedId={selectedId} onOpenDetail={openDetail} onAction={handleAction} />;
    if (config.source === 'results') return <ResultsTable rows={rows} loading={listState.loading} selectedId={selectedId} onOpenDetail={openDetail} onAction={handleAction} />;
    if (config.source === 'files') return <FilesTable rows={rows} loading={listState.loading} selectedId={selectedId} onOpenDetail={openDetail} onAction={handleAction} />;
    if (config.source === 'charges') return <ChargesTable rows={rows} loading={listState.loading} selectedId={selectedId} onOpenDetail={openDetail} onAction={handleAction} />;
    return <OrdersTable rows={rows} loading={listState.loading} selectedId={selectedId} mode={config.mode} onOpenDetail={openDetail} onAction={handleAction} />;
  }, [config.source, config.mode, rows, listState.data, listState.loading, selectedId]);

  return (
    <div className="lab-work-page procedure-work-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <section className="lab-work-header procedure-hero">
        <div>
          <span>Thủ thuật</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="lab-work-header__actions">
          <button type="button" onClick={() => { listState.refresh(); dashboardState.refresh(); }}><RefreshCw size={16} />Làm mới</button>
          <button type="button" onClick={() => printClinicalOpsView('In danh sách thủ thuật')}><Printer size={16} />In danh sách</button>
          <button type="button" onClick={() => downloadClinicalOpsCsv(`procedure-${pageKey}.csv`, rows, 'Xuất danh sách thủ thuật')}><FileText size={16} />Export</button>
          <button type="button" onClick={() => notifyClinicalOps({ title: 'Tạo order thủ thuật', message: 'Tạo chỉ định mới cần thực hiện từ encounter/bác sĩ để bảo toàn chỉ định lâm sàng.' })}><Plus size={16} />Tạo order</button>
        </div>
      </section>
      <KpiStrip summary={dashboardState.data} loading={dashboardState.loading} />
      <FilterBar filters={filters} setFilter={setFilter} refresh={listState.refresh} loading={listState.loading} source={config.source} />
      <WidgetError message={listState.error || dashboardState.error} onRetry={() => { listState.refresh(); dashboardState.refresh(); }} />
      <section className="lab-work-layout">
        <main>{content}</main>
        <DetailDrawer
          selection={selection}
          detail={detail}
          loading={detailLoading}
          onClose={() => { setSelection(null); setDetail(null); }}
          onAction={handleAction}
        />
      </section>
    </div>
  );
}
