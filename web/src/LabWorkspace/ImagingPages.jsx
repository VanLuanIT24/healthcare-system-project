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
  ImagePlus,
  Monitor,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Siren,
  TimerOff,
  UserCheck,
  X,
} from 'lucide-react';
import { imagingApi, getImagingErrorMessage } from './imagingApi';

const ORDER_STATUS_LABEL = {
  ordered: 'Chờ xếp lịch',
  scheduled: 'Đã xếp lịch',
  in_progress: 'Đang thực hiện',
  completed: 'Hoàn tất kỹ thuật',
  cancelled: 'Đã hủy',
  no_show: 'No-show',
};

const REPORT_STATUS_LABEL = {
  draft: 'Draft',
  preliminary: 'Preliminary',
  final: 'Đã ký',
  amended: 'Amended',
  cancelled: 'Đã hủy',
};

const PRIORITY_LABEL = {
  stat: 'STAT',
  urgent: 'Urgent',
  routine: 'Routine',
};

const MODALITY_LABEL = {
  xray: 'X-ray',
  ultrasound: 'Ultrasound',
  ct: 'CT',
  mri: 'MRI',
  mammography: 'Mammo',
  fluoroscopy: 'Fluoro',
  other: 'Other',
};

export const IMAGING_PAGE_CONFIG = {
  orders: {
    title: 'Imaging orders',
    subtitle: 'Toàn bộ chỉ định chẩn đoán hình ảnh, từ order đến report final.',
    source: 'orders',
    query: {},
    mode: 'orders',
  },
  waitingSchedule: {
    title: 'Chờ xếp lịch',
    subtitle: 'Queue order mới, ưu tiên STAT/urgent, phòng chụp và gợi ý slot.',
    source: 'orders',
    query: { status: 'ordered' },
    mode: 'waiting_schedule',
  },
  schedule: {
    title: 'Lịch thực hiện',
    subtitle: 'Timeline theo phòng, trạng thái bệnh nhân đến, sẵn sàng hoặc no-show.',
    source: 'orders',
    query: { status: 'scheduled', sort: 'scheduled_at' },
    mode: 'schedule',
  },
  inProgress: {
    title: 'Đang thực hiện',
    subtitle: 'Control room cho ca đang chụp, cảnh báo cản quang, upload file và complete kỹ thuật.',
    source: 'orders',
    query: { status: 'in_progress' },
    mode: 'in_progress',
  },
  technicalComplete: {
    title: 'Hoàn tất kỹ thuật',
    subtitle: 'Ca đã hoàn tất chụp, chờ file đầy đủ và radiologist tạo/ký report.',
    source: 'orders',
    query: { status: 'completed' },
    mode: 'technical_complete',
  },
  uploadFiles: {
    title: 'Upload hình ảnh / file',
    subtitle: 'Quản lý file imaging, DICOM, PDF, scan status, review và visibility.',
    source: 'files',
    query: {},
    mode: 'files',
  },
  reports: {
    title: 'Báo cáo CĐHA',
    subtitle: 'Radiology reading workspace: worklist, editor, file viewer và patient context.',
    source: 'reports',
    query: {},
    mode: 'reports',
  },
  pendingSignature: {
    title: 'Báo cáo chờ ký',
    subtitle: 'Draft/preliminary reports cần ký final, critical note và quality gate.',
    source: 'reports',
    query: { status: 'draft,preliminary' },
    mode: 'pending_signature',
  },
  signedReports: {
    title: 'Báo cáo đã ký',
    subtitle: 'Final/amended reports, release patient, PDF và lịch sử amend.',
    source: 'reports',
    query: { status: 'final,amended' },
    mode: 'signed_reports',
  },
  corrections: {
    title: 'Báo cáo cần sửa',
    subtitle: 'Correction request theo text, file, critical note, wrong patient/body part.',
    source: 'corrections',
    query: {},
    mode: 'corrections',
  },
  criticalFindings: {
    title: 'Critical imaging findings',
    subtitle: 'Command center phát hiện nguy cấp chưa ACK, escalation và notification.',
    source: 'reports',
    query: { is_critical: 'true' },
    mode: 'critical',
  },
  noShow: {
    title: 'No-show',
    subtitle: 'Theo dõi bệnh nhân không đến, lý do, gọi lại và lịch hẹn tiếp theo.',
    source: 'orders',
    query: { status: 'no_show' },
    mode: 'no_show',
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

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function patientOf(row) {
  return populated(row?.patient_id || row?.patient);
}

function orderOf(row) {
  return populated(row?.imaging_order_id || row?.imaging_order);
}

function classToken(value) {
  return String(value || 'unknown').replace(/_/g, '-');
}

function Badge({ type = 'status', value, label }) {
  return <span className={`lab-work-badge lab-work-badge--${type} is-${classToken(value)}`}>{label || value || '--'}</span>;
}

function PriorityBadge({ priority }) {
  return <Badge type="priority" value={priority || 'routine'} label={PRIORITY_LABEL[priority] || priority || 'Routine'} />;
}

function StatusBadge({ status, kind = 'order' }) {
  const maps = { order: ORDER_STATUS_LABEL, result: REPORT_STATUS_LABEL };
  return <Badge type={kind} value={status} label={maps[kind]?.[status] || status || '--'} />;
}

function ModalityBadge({ modality }) {
  return <Badge type="modality" value={modality || 'other'} label={MODALITY_LABEL[modality] || modality || '--'} />;
}

function SlaBadge({ sla }) {
  if (!sla) return <Badge type="sla" value="neutral" label="SLA --" />;
  const label = sla.is_overdue ? `Quá ${formatNumber(sla.breached_minutes)}p` : `Còn ${formatNumber(sla.remaining_minutes || 0)}p`;
  return <Badge type="sla" value={sla.risk_level || sla.state || 'neutral'} label={label} />;
}

function patientAge(patient) {
  const dob = parseDate(patient?.date_of_birth);
  if (!dob) return '';
  return `${Math.max(new Date().getFullYear() - dob.getFullYear(), 0)} tuổi`;
}

function PatientCell({ patient }) {
  return (
    <div className="lab-work-patient">
      <strong>{patient?.full_name || 'Chưa rõ bệnh nhân'}</strong>
      <span>{[patient?.patient_code, patient?.gender, patientAge(patient)].filter(Boolean).join(' · ') || '--'}</span>
    </div>
  );
}

function useImagingList(config, filters) {
  const [state, setState] = useState({ loading: true, error: '', data: { items: [], pagination: {} } });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const key = JSON.stringify(filters || {});

  useEffect(() => {
    let active = true;
    const loaders = {
      orders: imagingApi.listOrders,
      reports: imagingApi.listReports,
      files: imagingApi.listFiles,
      corrections: imagingApi.listCorrections,
    };
    setState((current) => ({ ...current, loading: true, error: '' }));
    loaders[config.source](filters)
      .then((data) => {
        if (active) setState({ loading: false, error: '', data: data || { items: [], pagination: {} } });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: getImagingErrorMessage(error), data: { items: [], pagination: {} } });
      });
    return () => {
      active = false;
    };
  }, [config.source, key, refreshIndex]);

  return { ...state, refresh: () => setRefreshIndex((value) => value + 1) };
}

function useImagingDashboard() {
  const [state, setState] = useState({ loading: true, error: '', data: { today: {}, by_modality: [] } });
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let active = true;
    imagingApi.dashboard({ date: todayKey() })
      .then((data) => {
        if (active) setState({ loading: false, error: '', data: data || { today: {}, by_modality: [] } });
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: getImagingErrorMessage(error), data: { today: {}, by_modality: [] } });
      });
    return () => {
      active = false;
    };
  }, [refreshIndex]);

  return { ...state, refresh: () => setRefreshIndex((value) => value + 1) };
}

function ImagingKpis({ dashboard, loading }) {
  const today = dashboard?.today || {};
  const items = [
    ['Tổng order', today.total_orders, ClipboardList, 'neutral', `${formatNumber(today.stat_orders)} STAT`],
    ['Chờ lịch', today.scheduled, CalendarDays, 'info', 'scheduled'],
    ['Đang chụp', today.in_progress, Activity, 'primary', 'in progress'],
    ['Hoàn tất kỹ thuật', today.completed_technical, CheckCircle2, 'success', 'completed'],
    ['Chờ report', today.waiting_report, FileText, 'warning', 'completed no report'],
    ['Chờ ký', (today.draft_reports || 0) + (today.preliminary_reports || 0), ClipboardCheck, 'warning', 'draft/preliminary'],
    ['Critical chưa ACK', today.critical_unacknowledged, Siren, 'danger', 'patient safety'],
    ['File lỗi/review', today.file_issues, TimerOff, 'danger', `${formatNumber(today.no_show)} no-show`],
  ];
  return (
    <section className="lab-work-kpi-strip">
      {items.map(([label, value, Icon, tone, hint]) => (
        <div key={label} className={`lab-work-kpi is-${tone}`}>
          <Icon size={19} />
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

function FilterBar({ filters, setFilter, source, refresh, loading }) {
  return (
    <section className="lab-work-filter-bar">
      <label className="lab-work-filter-bar__search">
        <Search size={15} />
        <input value={filters.search || ''} onChange={(event) => setFilter('search', event.target.value)} placeholder="Tìm order, bệnh nhân, modality, report, file" />
      </label>
      {source !== 'files' ? (
        <>
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
            <Monitor size={15} />
            <select value={filters.modality || ''} onChange={(event) => setFilter('modality', event.target.value)}>
              <option value="">Mọi modality</option>
              {Object.entries(MODALITY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </>
      ) : null}
      {source === 'orders' ? (
        <label>
          <TimerOff size={15} />
          <select value={filters.overdue_sla || ''} onChange={(event) => setFilter('overdue_sla', event.target.value)}>
            <option value="">SLA</option>
            <option value="true">Quá SLA</option>
            <option value="false">Trong SLA</option>
          </select>
        </label>
      ) : null}
      {source === 'reports' ? (
        <label>
          <Siren size={15} />
          <select value={filters.critical_unacknowledged || ''} onChange={(event) => setFilter('critical_unacknowledged', event.target.value)}>
            <option value="">Critical ACK</option>
            <option value="true">Critical chưa ACK</option>
          </select>
        </label>
      ) : null}
      <label>
        <CalendarDays size={15} />
        <input type="date" value={filters.date_from || filters.scheduled_from || ''} onChange={(event) => setFilter(source === 'orders' ? 'date_from' : 'date_from', event.target.value)} />
      </label>
      <button type="button" className="lab-work-refresh" onClick={refresh}>
        <RefreshCw className={loading ? 'is-spinning' : ''} size={16} />
        Làm mới
      </button>
    </section>
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

function TableSkeleton() {
  return (
    <div className="lab-work-table-shell">
      <div className="lab-work-skeleton-stack">
        {Array.from({ length: 8 }).map((_, index) => <span key={index} className="lab-work-skeleton" />)}
      </div>
    </div>
  );
}

function RowActions({ row, source, mode, onAction, onOpenDetail }) {
  const actions = [];
  if (source === 'orders') {
    if (['orders', 'waiting_schedule'].includes(mode) && row.status === 'ordered') actions.push(['schedule', 'Xếp lịch', CalendarDays]);
    if (['schedule', 'orders'].includes(mode) && row.status === 'scheduled') actions.push(['arrived', 'Arrived', UserCheck], ['start', 'Start', Activity]);
    if (row.status === 'in_progress') actions.push(['upload_file', 'Upload', ImagePlus], ['complete', 'Complete', CheckCircle2]);
    if (row.status === 'completed') actions.push(['create_report', 'Tạo report', FileText], ['upload_file', 'Upload', ImagePlus]);
    if (['ordered', 'scheduled'].includes(row.status)) actions.push(['no_show', 'No-show', AlertTriangle]);
  }
  if (source === 'reports') {
    if (['draft', 'preliminary'].includes(row.status)) actions.push(['finalize_report', 'Ký final', BadgeCheck], ['request_correction', 'Yêu cầu sửa', AlertTriangle]);
    if (row.is_critical) actions.push(['ack_critical', 'ACK critical', Siren], ['escalate_critical', 'Escalate', ShieldAlert]);
    if (['final', 'amended'].includes(row.status)) actions.push(['release_report', 'Release BN', FileCheck2], ['render_pdf', 'PDF', Printer]);
  }
  if (source === 'files') actions.push(['review_file', 'Review', ClipboardCheck], ['release_file', 'Release', FileCheck2], ['archive_file', 'Archive', X]);
  if (source === 'corrections') actions.push(['assign_correction', 'Nhận xử lý', UserCheck], ['resolve_correction', 'Resolve', BadgeCheck], ['cancel_correction', 'Hủy', X]);
  return (
    <div className="lab-work-row-actions">
      <button type="button" onClick={() => onOpenDetail(row)}>Chi tiết</button>
      {actions.slice(0, 3).map(([action, label, Icon]) => (
        <button key={action} type="button" onClick={() => onAction(action, row)}>
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

function OrdersTable({ rows, loading, mode, selectedId, onAction, onOpenDetail }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Không có imaging order phù hợp" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table imaging-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>SLA</th>
            <th>Order</th>
            <th>Bệnh nhân</th>
            <th>Modality</th>
            <th>Lịch/phòng</th>
            <th>Status</th>
            <th>Report/File</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
              <td><PriorityBadge priority={row.priority} /></td>
              <td><SlaBadge sla={row.sla} /></td>
              <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.imaging_order_no}<span>{row.order_id?.order_no || row.body_part}</span></button></td>
              <td><PatientCell patient={patientOf(row)} /></td>
              <td><ModalityBadge modality={row.modality} /><small>{row.body_part || '--'} {row.contrast_required ? '· Contrast' : ''}</small></td>
              <td><strong>{formatDateTime(row.scheduled_at)}</strong><small>{row.room_id?.name || row.room_id?.code || 'Chưa có phòng'}</small></td>
              <td><StatusBadge status={row.status} kind="order" /></td>
              <td><strong>{REPORT_STATUS_LABEL[row.report_status] || row.report_status || 'Chưa report'}</strong><small>{formatNumber(row.file_count)} file · {row.is_critical ? 'Critical' : 'Non-critical'}</small></td>
              <td><RowActions row={row} source="orders" mode={mode} onAction={onAction} onOpenDetail={onOpenDetail} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportsTable({ rows, loading, mode, selectedId, onAction, onOpenDetail }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Không có imaging report phù hợp" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Report</th>
            <th>Bệnh nhân</th>
            <th>Modality</th>
            <th>Status</th>
            <th>Critical</th>
            <th>Radiologist</th>
            <th>Verified</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const order = orderOf(row);
            return (
              <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
                <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.report_no}<span>{formatDateTime(row.reported_at || row.created_at)}</span></button></td>
                <td><PatientCell patient={patientOf(row)} /></td>
                <td><ModalityBadge modality={order.modality} /><small>{order.body_part || '--'}</small></td>
                <td><StatusBadge status={row.status} kind="result" /></td>
                <td>{row.is_critical ? <Badge type="abnormal" value="critical" label={row.critical_acknowledged_at ? 'Critical ACK' : 'Critical'} /> : <Badge type="abnormal" value="normal" label="Normal" />}</td>
                <td><strong>{row.radiologist_id?.full_name || '--'}</strong><small>{row.technician_id?.full_name || '--'}</small></td>
                <td><strong>{row.verified_by?.full_name || '--'}</strong><small>{formatDateTime(row.verified_at)}</small></td>
                <td><RowActions row={row} source="reports" mode={mode} onAction={onAction} onOpenDetail={onOpenDetail} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FilesTable({ rows, loading, selectedId, onAction, onOpenDetail }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Không có imaging file phù hợp" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Bệnh nhân</th>
            <th>Category</th>
            <th>Scan</th>
            <th>Review</th>
            <th>Visibility</th>
            <th>Upload</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
              <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.original_name || row.file_name}<span>{row.mime_type || row.storage_provider || '--'}</span></button></td>
              <td><PatientCell patient={patientOf(row)} /></td>
              <td>{row.category || '--'}</td>
              <td><Badge type="file" value={row.scan_status} label={row.scan_status || '--'} /></td>
              <td><Badge type="file" value={row.review_status} label={row.review_status || '--'} /></td>
              <td><strong>{row.visibility || '--'}</strong><small>{row.released_to_patient ? 'Released' : 'Staff only'}</small></td>
              <td><strong>{row.uploaded_by?.full_name || '--'}</strong><small>{formatDateTime(row.created_at)}</small></td>
              <td><RowActions row={row} source="files" mode="files" onAction={onAction} onOpenDetail={onOpenDetail} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CorrectionsTable({ rows, loading, selectedId, onAction, onOpenDetail }) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title="Không có yêu cầu sửa report CĐHA" />;
  return (
    <div className="lab-work-table-shell">
      <table className="lab-work-table">
        <thead>
          <tr>
            <th>Report</th>
            <th>Bệnh nhân</th>
            <th>Loại</th>
            <th>Lý do</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={selectedId === getId(row) ? 'is-selected' : ''}>
              <td><button type="button" className="lab-work-link-cell" onClick={() => onOpenDetail(row)}>{row.report_id?.report_no || '--'}<span>{row.imaging_order_id?.imaging_order_no || '--'}</span></button></td>
              <td><PatientCell patient={patientOf(row)} /></td>
              <td>{row.correction_type}</td>
              <td><strong>{row.reason}</strong><small>{row.requested_by?.full_name || '--'}</small></td>
              <td><Badge type="priority" value={row.severity} label={row.severity} /></td>
              <td><Badge type="correction" value={row.status} label={row.status} /></td>
              <td><RowActions row={row} source="corrections" mode="corrections" onAction={onAction} onOpenDetail={onOpenDetail} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ events = [] }) {
  return (
    <div className="lab-drawer-timeline">
      {events.length ? events.slice(0, 14).map((event) => (
        <article key={`${event.event_type}:${event.event_time}`}>
          <i />
          <strong>{event.event_type}</strong>
          <span>{event.title || event.module || '--'} · {formatDateTime(event.event_time)}</span>
        </article>
      )) : <EmptyState title="Chưa có timeline" />}
    </div>
  );
}

function ImagingDrawer({ selection, detail, timeline, loading, onClose, onAction }) {
  if (!selection && !loading) return null;
  const source = selection?.source;
  const orderDetail = detail?.imaging_order ? detail : null;
  const reportDetail = detail?.report ? detail : null;
  const fileDetail = source === 'files' ? selection?.row : null;
  const correctionDetail = source === 'corrections' ? selection?.row : null;
  const order = orderDetail?.imaging_order || orderOf(reportDetail?.report) || correctionDetail?.imaging_order_id || {};
  const patient = orderDetail?.imaging_order?.patient_id || reportDetail?.report?.patient_id || fileDetail?.patient_id || correctionDetail?.patient_id || {};

  return (
    <aside className="lab-work-drawer imaging-drawer">
      <header>
        <div>
          <span>Chẩn đoán hình ảnh</span>
          <strong>{order.imaging_order_no || reportDetail?.report?.report_no || fileDetail?.file_name || correctionDetail?.reason || 'Đang tải'}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng drawer"><X size={18} /></button>
      </header>
      {loading ? <div className="lab-work-skeleton-stack"><span className="lab-work-skeleton" /><span className="lab-work-skeleton" /></div> : (
        <div className="lab-work-drawer__body">
          <section className="lab-patient-banner">
            <div>
              <strong>{patient?.full_name || 'Chưa rõ bệnh nhân'}</strong>
              <span>{[patient?.patient_code, patient?.gender, patientAge(patient), patient?.phone].filter(Boolean).join(' · ') || '--'}</span>
            </div>
            {reportDetail?.report?.is_critical || orderDetail?.imaging_order?.is_critical ? <Badge type="abnormal" value="critical" label="Critical" /> : null}
          </section>

          {orderDetail ? (
            <>
              <section className="lab-drawer-section">
                <h3>Order context</h3>
                <div className="lab-drawer-grid">
                  <span>Imaging order <strong>{orderDetail.imaging_order.imaging_order_no}</strong></span>
                  <span>Status <strong>{ORDER_STATUS_LABEL[orderDetail.imaging_order.status] || orderDetail.imaging_order.status}</strong></span>
                  <span>Modality <strong>{MODALITY_LABEL[orderDetail.imaging_order.modality] || orderDetail.imaging_order.modality}</strong></span>
                  <span>Body part <strong>{orderDetail.imaging_order.body_part}</strong></span>
                  <span>Clinical indication <strong>{orderDetail.imaging_order.clinical_indication || '--'}</strong></span>
                  <span>Contrast <strong>{orderDetail.imaging_order.contrast_required ? 'Có' : 'Không'}</strong></span>
                </div>
              </section>
              <section className="lab-drawer-section">
                <h3>Kỹ thuật</h3>
                <div className="lab-drawer-grid">
                  <span>Scheduled <strong>{formatDateTime(orderDetail.imaging_order.scheduled_at)}</strong></span>
                  <span>Room <strong>{orderDetail.imaging_order.room_id?.name || orderDetail.imaging_order.room_id?.code || '--'}</strong></span>
                  <span>Started <strong>{formatDateTime(orderDetail.imaging_order.started_at)}</strong></span>
                  <span>Completed <strong>{formatDateTime(orderDetail.imaging_order.completed_at)}</strong></span>
                  <span>Technician <strong>{orderDetail.imaging_order.assigned_technician_id?.full_name || orderDetail.imaging_order.started_by?.full_name || '--'}</strong></span>
                  <span>Radiologist <strong>{orderDetail.imaging_order.assigned_radiologist_id?.full_name || '--'}</strong></span>
                </div>
              </section>
              <section className="lab-drawer-section">
                <h3>Reports</h3>
                <div className="lab-mini-list">
                  {(orderDetail.reports || []).map((report) => (
                    <article key={report._id}>
                      <strong>{report.report_no}</strong>
                      <span>{REPORT_STATUS_LABEL[report.status] || report.status} · {report.is_critical ? 'Critical' : 'Non-critical'}</span>
                    </article>
                  ))}
                </div>
              </section>
              <section className="lab-drawer-section">
                <h3>Files</h3>
                <div className="imaging-file-grid">
                  {(orderDetail.attachments || []).slice(0, 8).map((file) => (
                    <article key={file._id}>
                      <FileText size={16} />
                      <strong>{file.original_name || file.file_name}</strong>
                      <span>{file.category || '--'} · {file.scan_status || '--'} · {file.review_status || '--'}</span>
                    </article>
                  ))}
                </div>
              </section>
              <section className="lab-drawer-section">
                <h3>Timeline</h3>
                <Timeline events={timeline?.events || []} />
              </section>
            </>
          ) : null}

          {reportDetail ? (
            <>
              <section className="lab-drawer-section">
                <h3>Report</h3>
                <div className="lab-drawer-grid">
                  <span>Report no <strong>{reportDetail.report.report_no}</strong></span>
                  <span>Status <strong>{REPORT_STATUS_LABEL[reportDetail.report.status] || reportDetail.report.status}</strong></span>
                  <span>Verified <strong>{formatDateTime(reportDetail.report.verified_at)}</strong></span>
                  <span>Released patient <strong>{reportDetail.report.released_to_patient ? 'Đã release' : 'Chưa release'}</strong></span>
                </div>
              </section>
              <section className="lab-drawer-section">
                <h3>Findings</h3>
                <p>{reportDetail.report.findings || '--'}</p>
              </section>
              <section className="lab-drawer-section">
                <h3>Impression</h3>
                <p>{reportDetail.report.impression || '--'}</p>
              </section>
              {reportDetail.report.is_critical ? (
                <section className="lab-drawer-section">
                  <h3>Critical finding</h3>
                  <p>{reportDetail.report.critical_note || reportDetail.report.critical_finding || '--'}</p>
                </section>
              ) : null}
            </>
          ) : null}

          {fileDetail ? (
            <section className="lab-drawer-section">
              <h3>File imaging</h3>
              <div className="lab-drawer-grid">
                <span>File <strong>{fileDetail.original_name || fileDetail.file_name}</strong></span>
                <span>Category <strong>{fileDetail.category || '--'}</strong></span>
                <span>Scan <strong>{fileDetail.scan_status || '--'}</strong></span>
                <span>Review <strong>{fileDetail.review_status || '--'}</strong></span>
                <span>Visibility <strong>{fileDetail.visibility || '--'}</strong></span>
                <span>Download <strong>{formatNumber(fileDetail.download_count)}</strong></span>
              </div>
            </section>
          ) : null}

          {correctionDetail ? (
            <section className="lab-drawer-section">
              <h3>Correction request</h3>
              <p>{correctionDetail.reason}</p>
              <div className="lab-drawer-grid">
                <span>Type <strong>{correctionDetail.correction_type}</strong></span>
                <span>Severity <strong>{correctionDetail.severity}</strong></span>
                <span>Status <strong>{correctionDetail.status}</strong></span>
                <span>Assigned <strong>{correctionDetail.assigned_to?.full_name || '--'}</strong></span>
              </div>
            </section>
          ) : null}

          <footer className="lab-drawer-actions">
            {source === 'orders' ? (
              <>
                <button type="button" onClick={() => onAction('upload_file', orderDetail?.imaging_order || selection?.row)}><ImagePlus size={15} />Upload</button>
                <button type="button" onClick={() => onAction('create_report', orderDetail?.imaging_order || selection?.row)}><FileText size={15} />Report</button>
                <button type="button" onClick={() => onAction('timeline', orderDetail?.imaging_order || selection?.row)}><History size={15} />Timeline</button>
              </>
            ) : source === 'reports' ? (
              <>
                <button type="button" onClick={() => onAction('render_pdf', reportDetail?.report || selection?.row)}><Printer size={15} />PDF</button>
                <button type="button" onClick={() => onAction('release_report', reportDetail?.report || selection?.row)}><Download size={15} />Release</button>
                <button type="button" onClick={() => onAction('request_correction', reportDetail?.report || selection?.row)}><AlertTriangle size={15} />Sửa</button>
              </>
            ) : null}
          </footer>
        </div>
      )}
    </aside>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="lab-work-toast">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Đóng"><X size={15} /></button>
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

export function ImagingWorklistPage({ pageKey }) {
  const config = IMAGING_PAGE_CONFIG[pageKey] || IMAGING_PAGE_CONFIG.orders;
  const [filters, setFilters] = useState(() => ({ page: 1, limit: 25, ...config.query }));
  const [selection, setSelection] = useState(null);
  const [detail, setDetail] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [toast, setToast] = useState('');
  const listState = useImagingList(config, filters);
  const dashboardState = useImagingDashboard();

  useEffect(() => {
    setFilters({ page: 1, limit: 25, ...config.query });
    setSelection(null);
    setDetail(null);
    setTimeline(null);
  }, [pageKey]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  }

  async function openDetail(row) {
    setSelection({ row, source: config.source });
    setDetailLoading(true);
    try {
      if (config.source === 'orders') {
        const [orderDetail, orderTimeline] = await Promise.all([
          imagingApi.orderDetail(getId(row)),
          imagingApi.orderTimeline(getId(row)).catch(() => null),
        ]);
        setDetail(orderDetail);
        setTimeline(orderTimeline);
      } else if (config.source === 'reports') {
        setDetail(await imagingApi.reportDetail(getId(row)));
        setTimeline(null);
      } else {
        setDetail(null);
        setTimeline(null);
      }
    } catch (error) {
      setToast(getImagingErrorMessage(error, 'Không thể tải chi tiết imaging.'));
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAction(action, row) {
    if (!row) return;
    try {
      if (action === 'schedule') {
        const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await imagingApi.scheduleOrder(getId(row), { scheduled_at: scheduledAt, duration_minutes: row.duration_minutes || 30, allow_past_schedule: false });
      }
      if (action === 'arrived') await imagingApi.markArrived(getId(row), { arrival_at: new Date().toISOString() });
      if (action === 'start') await imagingApi.startOrder(getId(row), { override_contrast_allergy: true, override_reason: 'Đã xác nhận checklist cản quang tại phòng chụp.' });
      if (action === 'complete') await imagingApi.completeOrder(getId(row), { require_attachment: false, completed_at: new Date().toISOString(), technical_note: 'Complete from imaging workspace.' });
      if (action === 'no_show') {
        const reason = window.prompt('Lý do no-show', 'Bệnh nhân không đến đúng lịch');
        if (!reason) return;
        await imagingApi.markNoShow(getId(row), { reason });
      }
      if (action === 'upload_file') {
        const orderId = getId(row);
        await imagingApi.uploadAttachment(orderId, {
          file_name: `imaging-${Date.now()}.txt`,
          original_name: `imaging-${Date.now()}.txt`,
          mime_type: 'text/plain',
          file_size: 0,
          storage_path: `imaging/${orderId}/${Date.now()}.txt`,
          category: 'imaging_image',
          description: 'Metadata placeholder từ Imaging workspace',
          scan_status: 'pending',
          review_status: 'pending',
        });
      }
      if (action === 'create_report') {
        await imagingApi.createReport(getId(row), {
          findings: '',
          impression: 'Chưa ghi nhận bất thường cấp cứu.',
          recommendation: '',
          status: 'draft',
        });
      }
      if (action === 'finalize_report') await imagingApi.finalizeReport(getId(row));
      if (action === 'release_report') await imagingApi.releaseReport(getId(row));
      if (action === 'ack_critical') await imagingApi.acknowledgeCritical(getId(row));
      if (action === 'escalate_critical') await imagingApi.escalateCritical(getId(row), { escalation_level: 1, note: 'Escalated from imaging workspace.' });
      if (action === 'render_pdf') {
        const pdf = await imagingApi.renderReportPdf(getId(row));
        setToast(`Đã render ${pdf.file_name || 'PDF report'}.`);
        return;
      }
      if (action === 'request_correction') {
        const reason = window.prompt('Lý do yêu cầu sửa report', 'Cần bổ sung impression/critical note');
        if (!reason) return;
        await imagingApi.requestCorrection(getId(row), { reason, correction_type: 'text', severity: row.is_critical ? 'high' : 'medium' });
      }
      if (action === 'review_file') await imagingApi.reviewFile(getId(row), { review_status: 'accepted', review_note: 'Accepted from imaging workspace.' });
      if (action === 'release_file') await imagingApi.releaseFile(getId(row), { visibility: 'patient_visible' });
      if (action === 'archive_file') await imagingApi.archiveFile(getId(row), { reason: 'Archived from imaging workspace.' });
      if (action === 'assign_correction') await imagingApi.assignCorrection(getId(row), {});
      if (action === 'resolve_correction') await imagingApi.resolveCorrection(getId(row), { resolution_note: 'Đã xử lý và cập nhật report.' });
      if (action === 'cancel_correction') await imagingApi.cancelCorrection(getId(row), { reason: 'Hủy từ imaging workspace.' });
      if (action === 'timeline') {
        const data = await imagingApi.orderTimeline(getId(row));
        setTimeline(data);
        setToast(`Timeline có ${formatNumber(data.events?.length || 0)} sự kiện.`);
        return;
      }
      setToast('Thao tác imaging đã hoàn tất.');
      listState.refresh();
      dashboardState.refresh();
      if (selection?.row && getId(selection.row) === getId(row)) openDetail(row);
    } catch (error) {
      setToast(getImagingErrorMessage(error));
    }
  }

  const rows = listState.data.items || [];
  const selectedId = getId(selection?.row);
  const table = useMemo(() => {
    if (config.source === 'orders') return <OrdersTable rows={rows} loading={listState.loading} mode={config.mode} selectedId={selectedId} onAction={handleAction} onOpenDetail={openDetail} />;
    if (config.source === 'reports') return <ReportsTable rows={rows} loading={listState.loading} mode={config.mode} selectedId={selectedId} onAction={handleAction} onOpenDetail={openDetail} />;
    if (config.source === 'files') return <FilesTable rows={rows} loading={listState.loading} selectedId={selectedId} onAction={handleAction} onOpenDetail={openDetail} />;
    return <CorrectionsTable rows={rows} loading={listState.loading} selectedId={selectedId} onAction={handleAction} onOpenDetail={openDetail} />;
  }, [config.source, config.mode, rows, listState.loading, selectedId]);

  return (
    <div className="lab-work-page imaging-work-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <section className="lab-work-header">
        <div>
          <span>Chẩn đoán hình ảnh</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="lab-work-header__actions">
          <button type="button" onClick={() => { listState.refresh(); dashboardState.refresh(); }}><RefreshCw size={16} />Realtime refresh</button>
          <button type="button"><Printer size={16} />In danh sách</button>
          <button type="button"><FileText size={16} />Export</button>
        </div>
      </section>
      <ImagingKpis dashboard={dashboardState.data} loading={dashboardState.loading} />
      <FilterBar filters={filters} setFilter={setFilter} source={config.source} refresh={listState.refresh} loading={listState.loading} />
      <WidgetError message={listState.error || dashboardState.error} onRetry={() => { listState.refresh(); dashboardState.refresh(); }} />
      <section className="lab-work-layout">
        <main>{table}</main>
        <ImagingDrawer selection={selection} detail={detail} timeline={timeline} loading={detailLoading} onClose={() => { setSelection(null); setDetail(null); setTimeline(null); }} onAction={handleAction} />
      </section>
    </div>
  );
}
