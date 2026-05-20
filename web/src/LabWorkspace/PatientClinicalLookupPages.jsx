import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileSearch,
  FileWarning,
  FlaskConical,
  History,
  Loader2,
  MonitorUp,
  Printer,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  Stethoscope,
  TimerOff,
  UploadCloud,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { patientClinicalLookupAPI, getPatientClinicalLookupError } from './patientClinicalLookupApi';
import './patientClinicalLookup.css';

const PAGE_CONFIG = {
  byPatient: {
    eyebrow: 'Patient Clinical Investigation Cockpit',
    title: 'Tra cứu theo bệnh nhân',
    description: 'Mở toàn bộ ngữ cảnh cận lâm sàng theo bệnh nhân: order, result, critical, file, release và timeline.',
    icon: Users,
    tone: 'patient',
  },
  byEncounter: {
    eyebrow: 'Encounter Investigation Cockpit',
    title: 'Tra cứu theo lượt khám',
    description: 'Tập trung dữ liệu xét nghiệm, CĐHA, thủ thuật và file trong một encounter cụ thể.',
    icon: ClipboardList,
    tone: 'encounter',
  },
  labHistory: {
    eyebrow: 'Laboratory History',
    title: 'Lịch sử xét nghiệm',
    description: 'Theo dõi result, từng chỉ số abnormal/critical, specimen workflow, amend và release.',
    icon: FlaskConical,
    tone: 'lab',
    module: 'lab',
  },
  imagingHistory: {
    eyebrow: 'Imaging History',
    title: 'Lịch sử chẩn đoán hình ảnh',
    description: 'Theo dõi modality, PACS/report, critical finding, ký báo cáo, file và release.',
    icon: ScanLine,
    tone: 'imaging',
    module: 'imaging',
  },
  procedureHistory: {
    eyebrow: 'Procedure History',
    title: 'Lịch sử thủ thuật',
    description: 'Theo dõi lịch, lifecycle, structured result, file, charge, no-show và completion note.',
    icon: Stethoscope,
    tone: 'procedure',
    module: 'procedure',
  },
  clinicalSummary: {
    eyebrow: 'Unified Investigation Summary',
    title: 'Tổng hợp cận lâm sàng',
    description: 'Ma trận hợp nhất lab + CĐHA + thủ thuật cho bác sĩ nhìn nhanh mọi rủi ro và việc cần làm.',
    icon: FileSearch,
    tone: 'summary',
  },
};

const MODULE_META = {
  lab: { label: 'Xét nghiệm', icon: FlaskConical, tone: 'lab' },
  imaging: { label: 'CĐHA', icon: ScanLine, tone: 'imaging' },
  procedure: { label: 'Thủ thuật', icon: Stethoscope, tone: 'procedure' },
};

const KPI_CONFIG = [
  ['total_orders', 'Tổng order', ClipboardList, 'neutral'],
  ['pending_orders', 'Đang xử lý', Clock3, 'warning'],
  ['completed_orders', 'Hoàn tất', BadgeCheck, 'success'],
  ['critical_unacknowledged', 'Critical chưa ACK', ShieldAlert, 'critical'],
  ['new_results', 'Kết quả mới', FileCheck2, 'success'],
  ['waiting_signature', 'Chờ ký/duyệt', MonitorUp, 'review'],
  ['results_pending_release', 'Chưa release BN', BellRing, 'warning'],
  ['files_missing', 'Thiếu file', FileWarning, 'danger'],
  ['files_scan_failed', 'File lỗi scan', TimerOff, 'danger'],
  ['procedure_charges_missing', 'Thiếu charge', CreditCard, 'procedure'],
  ['no_show', 'No-show', AlertTriangle, 'danger'],
  ['sla_breached', 'SLA breached', TimerOff, 'critical'],
];

const STATUS_LABELS = {
  ordered: 'Ordered',
  acknowledged: 'Đã nhận',
  scheduled: 'Đã xếp lịch',
  in_progress: 'Đang làm',
  completed: 'Hoàn tất',
  final: 'Final',
  finalized: 'Final',
  signed: 'Đã ký',
  amended: 'Amended',
  cancelled: 'Đã hủy',
  no_show: 'No-show',
  draft: 'Draft',
  pending: 'Pending',
};

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
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
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ageText(dateOfBirth) {
  const dob = parseDate(dateOfBirth);
  if (!dob) return '--';
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) years -= 1;
  return `${years}t`;
}

function patientId(patient) {
  return patient?.patient_id || patient?.id || patient?._id;
}

function patientLine(patient) {
  return [patient?.patient_code, patient?.gender, ageText(patient?.date_of_birth)].filter(Boolean).join(' · ') || '--';
}

function moduleMeta(type) {
  return MODULE_META[type] || { label: type || 'Khác', icon: Activity, tone: 'neutral' };
}

function slaLabel(row) {
  const sla = row?.sla || {};
  if (sla.status === 'breached') return `Quá ${formatNumber(sla.breached_minutes)}p`;
  if (sla.status === 'warning') return `Còn ${formatNumber(sla.remaining_minutes)}p`;
  if (sla.status === 'normal') return `Còn ${formatNumber(sla.remaining_minutes)}p`;
  return 'Không SLA';
}

function resultStatus(row) {
  return row?.result_status || row?.order_status || '--';
}

function filterMatrix(items, config, filters) {
  let rows = items || [];
  if (config.module) rows = rows.filter((item) => item.type === config.module);
  if (filters.module !== 'all') rows = rows.filter((item) => item.type === filters.module);
  if (filters.status === 'critical') rows = rows.filter((item) => item.is_critical);
  if (filters.status === 'unreleased') rows = rows.filter((item) => item.result_id && !item.released_to_patient);
  if (filters.status === 'file_gap') rows = rows.filter((item) => item.has_file_gap);
  if (filters.status === 'sla') rows = rows.filter((item) => item.sla?.status === 'breached');
  if (filters.search) {
    const needle = filters.search.toLowerCase();
    rows = rows.filter((item) => [
      item.display_name,
      item.code,
      item.order_no,
      item.result_no,
      item.order_status,
      item.result_status,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }
  return rows;
}

function EmptyPanel({ title = 'Chưa có dữ liệu', message = 'Chọn bệnh nhân hoặc điều chỉnh bộ lọc để xem dữ liệu.' }) {
  return (
    <section className="patient-lookup-empty">
      <FileSearch size={30} strokeWidth={2.25} />
      <strong>{title}</strong>
      <span>{message}</span>
    </section>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="patient-lookup-toast">
      <CheckCircle2 size={17} strokeWidth={2.25} />
      <span>{message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={onClose}>
        <X size={14} strokeWidth={2.25} />
      </button>
    </div>
  );
}

function SearchRail({ searchTerm, setSearchTerm, searchResults, selectedPatient, onSelect, searching, onSearch }) {
  return (
    <aside className="patient-lookup-rail">
      <header>
        <span>
          <Search size={16} strokeWidth={2.25} />
          Tìm bệnh nhân
        </span>
        <button type="button" onClick={onSearch} title="Tìm lại">
          <RefreshCw className={searching ? 'is-spinning' : ''} size={15} strokeWidth={2.25} />
        </button>
      </header>
      <label className="patient-lookup-search">
        <Search size={16} strokeWidth={2.25} />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Tên, mã BN, SĐT, CCCD, BHYT"
        />
      </label>
      <div className="patient-lookup-search-results">
        {searchResults.map((patient) => {
          const active = patientId(selectedPatient) === patientId(patient);
          return (
            <button
              key={patientId(patient)}
              type="button"
              className={active ? 'is-active' : ''}
              onClick={() => onSelect(patient)}
            >
              <span className="patient-lookup-avatar"><UserRound size={17} strokeWidth={2.25} /></span>
              <span>
                <strong>{patient.full_name || 'Chưa rõ tên'}</strong>
                <em>{patientLine(patient)}</em>
              </span>
              <ChevronRight size={15} strokeWidth={2.25} />
            </button>
          );
        })}
        {!searchResults.length ? (
          <div className="patient-lookup-rail-empty">
            {searching ? 'Đang tìm bệnh nhân...' : 'Nhập từ khóa để tra cứu.'}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function PageHeader({ config, loading, onRefresh }) {
  const Icon = config.icon;
  return (
    <header className={cx('patient-lookup-page-header', `is-${config.tone}`)}>
      <div>
        <span>
          <Icon size={16} strokeWidth={2.35} />
          {config.eyebrow}
        </span>
        <h1>{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <div className="patient-lookup-header-actions">
        <button type="button">
          <Printer size={16} strokeWidth={2.25} />
          In tổng hợp
        </button>
        <button type="button">
          <Download size={16} strokeWidth={2.25} />
          Export PDF
        </button>
        <button type="button" className="primary" onClick={onRefresh}>
          <RefreshCw className={loading ? 'is-spinning' : ''} size={16} strokeWidth={2.25} />
          Refresh
        </button>
      </div>
    </header>
  );
}

function PatientIdentity({ patient, context, activeEncounter }) {
  if (!patient) {
    return <EmptyPanel title="Chưa chọn bệnh nhân" message="Tìm theo tên, mã bệnh nhân, SĐT, CCCD hoặc BHYT để mở cockpit cận lâm sàng." />;
  }
  const summary = context?.summary || {};
  return (
    <section className="patient-lookup-identity">
      <div className="patient-lookup-identity__main">
        <span className="patient-lookup-identity__avatar">
          <UserRound size={24} strokeWidth={2.25} />
        </span>
        <div>
          <span className="patient-lookup-eyebrow">{patient.patient_code || 'Patient'}</span>
          <h2>{patient.full_name || 'Chưa rõ tên'}</h2>
          <p>{patientLine(patient)} · {patient.phone || 'SĐT đã ẩn/không có'}</p>
        </div>
      </div>
      <div className="patient-lookup-risk-badges">
        {summary.active_allergies_count ? <span className="is-critical">Dị ứng {summary.active_allergies_count}</span> : <span>Không ghi nhận dị ứng</span>}
        {summary.active_problems_count ? <span className="is-warning">Vấn đề {summary.active_problems_count}</span> : <span>Problem list sạch</span>}
        {activeEncounter?.encounter_code ? <span className="is-info">{activeEncounter.encounter_code}</span> : null}
        {activeEncounter?.department?.name ? <span>{activeEncounter.department.name}</span> : null}
      </div>
    </section>
  );
}

function KpiStrip({ counters = {}, loading }) {
  return (
    <section className="patient-lookup-kpis">
      {KPI_CONFIG.map(([key, label, Icon, tone]) => (
        <article key={key} className={cx('patient-lookup-kpi', `is-${tone}`)}>
          <span>
            <Icon size={19} strokeWidth={2.25} />
          </span>
          <div>
            <small>{label}</small>
            {loading ? <em className="patient-lookup-skeleton value" /> : <strong>{formatNumber(counters[key])}</strong>}
          </div>
        </article>
      ))}
    </section>
  );
}

function FilterBar({ filters, setFilter }) {
  return (
    <section className="patient-lookup-filters">
      <label>
        <Activity size={15} strokeWidth={2.25} />
        <select value={filters.module} onChange={(event) => setFilter('module', event.target.value)}>
          <option value="all">Tất cả module</option>
          <option value="lab">Xét nghiệm</option>
          <option value="imaging">CĐHA</option>
          <option value="procedure">Thủ thuật</option>
        </select>
      </label>
      <label>
        <ShieldAlert size={15} strokeWidth={2.25} />
        <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">Mọi trạng thái</option>
          <option value="critical">Critical</option>
          <option value="unreleased">Chưa release BN</option>
          <option value="file_gap">Thiếu file</option>
          <option value="sla">SLA breached</option>
        </select>
      </label>
      <label>
        <CalendarClock size={15} strokeWidth={2.25} />
        <input type="date" value={filters.date_from} onChange={(event) => setFilter('date_from', event.target.value)} />
      </label>
      <label>
        <CalendarClock size={15} strokeWidth={2.25} />
        <input type="date" value={filters.date_to} onChange={(event) => setFilter('date_to', event.target.value)} />
      </label>
      <label className="patient-lookup-filter-search">
        <Search size={15} strokeWidth={2.25} />
        <input
          value={filters.search}
          onChange={(event) => setFilter('search', event.target.value)}
          placeholder="Tìm order/result/service"
        />
      </label>
    </section>
  );
}

function EncounterSelector({ encounters = [], selectedEncounterId, onSelect }) {
  if (!encounters.length) return null;
  return (
    <section className="patient-lookup-encounters">
      <header>
        <span>
          <History size={16} strokeWidth={2.25} />
          Lượt khám
        </span>
        <strong>{formatNumber(encounters.length)}</strong>
      </header>
      <div>
        {encounters.map((encounter) => (
          <button
            key={encounter.encounter_id}
            type="button"
            className={selectedEncounterId === encounter.encounter_id ? 'is-active' : ''}
            onClick={() => onSelect(encounter.encounter_id)}
          >
            <strong>{encounter.encounter_code}</strong>
            <span>{formatDateTime(encounter.start_time)} · {encounter.department?.name || '--'}</span>
            <em>{STATUS_LABELS[encounter.status] || encounter.status}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function ModuleBadge({ type }) {
  const meta = moduleMeta(type);
  const Icon = meta.icon;
  return (
    <span className={cx('patient-lookup-module', `is-${meta.tone}`)}>
      <Icon size={13} strokeWidth={2.25} />
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }) {
  return <span className={cx('patient-lookup-status', `is-${String(status || 'none').replace(/_/g, '-')}`)}>{STATUS_LABELS[status] || status || '--'}</span>;
}

function MatrixActions({ row, actioning, onAction }) {
  const disabled = (action) => actioning === `${row.id}:${action}`;
  const actions = [
    row.allowed_actions?.acknowledge_critical && row.type !== 'procedure' ? ['ack', ShieldAlert, 'ACK'] : null,
    row.allowed_actions?.release_to_patient ? ['release', FileCheck2, 'Release'] : null,
    row.type === 'procedure' && row.has_charge_gap ? ['charge', CreditCard, 'Charge'] : null,
    ['view', Eye, 'View'],
  ].filter(Boolean);
  return (
    <span className="patient-lookup-row-actions" onClick={(event) => event.stopPropagation()}>
      {actions.map(([action, Icon, label]) => (
        <button
          key={action}
          type="button"
          title={label}
          disabled={disabled(action)}
          onClick={() => onAction(action, row)}
        >
          {disabled(action) ? <Loader2 className="is-spinning" size={13} strokeWidth={2.25} /> : <Icon size={13} strokeWidth={2.25} />}
          <span>{label}</span>
        </button>
      ))}
    </span>
  );
}

function ResultMatrix({ rows, loading, selectedRow, onSelect, actioning, onAction }) {
  if (loading) {
    return (
      <section className="patient-lookup-table-shell">
        <div className="patient-lookup-skeleton-stack">
          {Array.from({ length: 8 }).map((_, index) => <span key={index} className="patient-lookup-skeleton" />)}
        </div>
      </section>
    );
  }
  if (!rows.length) return <EmptyPanel title="Không có kết quả phù hợp" message="Bộ lọc hiện tại không có order/result cận lâm sàng." />;
  return (
    <section className="patient-lookup-table-shell">
      <div className="patient-lookup-table">
        <div className="patient-lookup-table__head">
          <span>Loại</span>
          <span>Dịch vụ</span>
          <span>Order/result</span>
          <span>SLA</span>
          <span>Trạng thái</span>
          <span>Risk/file/release</span>
          <span>Thao tác</span>
        </div>
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className={cx('patient-lookup-row', selectedRow?.id === row.id && 'is-selected')}
            onClick={() => onSelect(row)}
          >
            <span><ModuleBadge type={row.type} /></span>
            <span className="patient-lookup-service-cell">
              <strong>{row.display_name || '--'}</strong>
              <em>{[row.code, row.specimen_type, row.performer?.name].filter(Boolean).join(' · ') || '--'}</em>
            </span>
            <span className="patient-lookup-service-cell">
              <strong>{row.order_no || '--'}</strong>
              <em>{row.result_no || row.child_order_id || '--'} · {formatDateTime(row.ordered_at)}</em>
            </span>
            <span>
              <span className={cx('patient-lookup-sla', `is-${row.sla?.status || 'none'}`)}>{slaLabel(row)}</span>
            </span>
            <span className="patient-lookup-status-stack">
              <StatusBadge status={row.order_status} />
              <StatusBadge status={resultStatus(row)} />
            </span>
            <span className="patient-lookup-risk-stack">
              {row.is_critical ? <span className="is-critical">Critical</span> : <span>Non-critical</span>}
              {row.has_file_gap ? <span className="is-danger">Thiếu file</span> : <span>{formatNumber(row.file_count)} file</span>}
              {row.released_to_patient ? <span className="is-success">Released</span> : <span className="is-warning">Chưa release</span>}
            </span>
            <MatrixActions row={row} actioning={actioning} onAction={onAction} />
          </button>
        ))}
      </div>
    </section>
  );
}

function DetailDrawer({ row }) {
  if (!row) {
    return (
      <aside className="patient-lookup-detail is-empty">
        <FileSearch size={30} strokeWidth={2.25} />
        <strong>Chọn một dòng</strong>
        <span>Chi tiết order, kết quả, critical, file và action sẽ hiển thị tại đây.</span>
      </aside>
    );
  }
  return (
    <aside className="patient-lookup-detail">
      <header>
        <ModuleBadge type={row.type} />
        <h2>{row.display_name}</h2>
        <p>{[row.order_no, row.result_no, row.priority?.toUpperCase()].filter(Boolean).join(' · ')}</p>
      </header>
      <section className="patient-lookup-detail-grid">
        <div><span>Ordered at</span><strong>{formatDateTime(row.ordered_at)}</strong></div>
        <div><span>Completed</span><strong>{formatDateTime(row.completed_at || row.reported_at)}</strong></div>
        <div><span>Order status</span><strong>{STATUS_LABELS[row.order_status] || row.order_status || '--'}</strong></div>
        <div><span>Result status</span><strong>{STATUS_LABELS[row.result_status] || row.result_status || '--'}</strong></div>
        <div><span>Release</span><strong>{row.released_to_patient ? formatDateTime(row.released_at) : 'Chưa release'}</strong></div>
        <div><span>Files</span><strong>{formatNumber(row.file_count)} file</strong></div>
      </section>
      {row.type === 'lab' ? (
        <section className="patient-lookup-detail-section">
          <strong>Result items critical/abnormal</strong>
          {(row.critical_items || []).length ? row.critical_items.map((item) => (
            <p key={item.item_code || item.item_name}>
              {item.item_name}: <b>{item.result_value}</b> {item.unit || ''} · {item.abnormal_flag || '--'} · {item.reference_range || '--'}
            </p>
          )) : <p>Không có critical item trong snapshot.</p>}
          <p>Mẫu: {formatNumber(row.specimen_count)} · Rejected: {formatNumber(row.rejected_specimen_count)}</p>
        </section>
      ) : null}
      {row.type === 'imaging' ? (
        <section className="patient-lookup-detail-section">
          <strong>Report/PACS</strong>
          <p>{row.critical_summary || 'Không có critical note.'}</p>
          <p>{row.pacs_url ? `PACS: ${row.pacs_url}` : 'Chưa có PACS URL trong snapshot.'}</p>
        </section>
      ) : null}
      {row.type === 'procedure' ? (
        <section className="patient-lookup-detail-section">
          <strong>Procedure context</strong>
          <p>Performer: {row.performer?.name || '--'}</p>
          <p>Charge: {formatNumber(row.charge_count)} · {row.has_charge_gap ? 'Cần tạo charge' : 'Đã có charge hoặc không bắt buộc'}</p>
        </section>
      ) : null}
      <section className="patient-lookup-detail-section">
        <strong>Allowed actions</strong>
        <div className="patient-lookup-action-chips">
          {Object.entries(row.allowed_actions || {}).filter(([, value]) => value).map(([key]) => <span key={key}>{key.replace(/_/g, ' ')}</span>)}
        </div>
      </section>
    </aside>
  );
}

function SidePanel({ title, icon: Icon, items = [], empty, render }) {
  return (
    <section className="patient-lookup-side-panel">
      <header>
        <span>
          <Icon size={16} strokeWidth={2.25} />
          {title}
        </span>
        <strong>{formatNumber(items.length)}</strong>
      </header>
      <div>
        {items.slice(0, 8).map(render)}
        {!items.length ? <p className="patient-lookup-muted">{empty}</p> : null}
      </div>
    </section>
  );
}

function ContextPanels({ data = {} }) {
  return (
    <section className="patient-lookup-context-panels">
      <SidePanel
        title="Critical alert"
        icon={ShieldAlert}
        items={data.critical_alerts || []}
        empty="Không có critical chưa ACK."
        render={(item) => (
          <article key={item.id} className="patient-lookup-alert-card">
            <strong>{item.title}</strong>
            <span>{item.message || item.result_no || '--'}</span>
            <em>{formatDateTime(item.reported_at)}</em>
          </article>
        )}
      />
      <SidePanel
        title="Việc cần xử lý"
        icon={BellRing}
        items={data.pending_actions || []}
        empty="Không có pending action."
        render={(item) => (
          <article key={item.id} className={cx('patient-lookup-action-card', `is-${item.severity || 'warning'}`)}>
            <strong>{item.title}</strong>
            <span>{item.message || item.type}</span>
            <em>{formatDateTime(item.due_at)}</em>
          </article>
        )}
      />
      <SidePanel
        title="File gaps"
        icon={FileWarning}
        items={data.file_gaps || []}
        empty="Không có thiếu/lỗi file."
        render={(item) => (
          <article key={item.id} className="patient-lookup-file-card">
            <strong>{item.title}</strong>
            <span>{item.status || item.type}</span>
            <em>{item.module}</em>
          </article>
        )}
      />
      <SidePanel
        title="Timeline"
        icon={History}
        items={data.timeline || []}
        empty="Chưa có timeline."
        render={(item) => (
          <article key={item.id} className="patient-lookup-timeline-card">
            <i className={`is-${item.module}`} />
            <strong>{item.title}</strong>
            <span>{item.subtitle || item.status || '--'}</span>
            <em>{formatDateTime(item.occurred_at)}</em>
          </article>
        )}
      />
    </section>
  );
}

function usePatientClinicalLookup(pageKey) {
  const config = PAGE_CONFIG[pageKey] || PAGE_CONFIG.byPatient;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState('');
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState({ module: 'all', status: '', date_from: '', date_to: '', search: '' });
  const [dataState, setDataState] = useState({ loading: false, error: '', data: {} });
  const [refreshIndex, setRefreshIndex] = useState(0);

  function runSearch() {
    setSearching(true);
    patientClinicalLookupAPI.searchPatients({ keyword: searchTerm, limit: 10 })
      .then((payload) => {
        const items = payload.items || [];
        setSearchResults(items);
        if (!selectedPatient && items.length) setSelectedPatient(items[0]);
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false));
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchTerm || searchTerm.trim().length >= 2) runSearch();
    }, 280);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const selectedPatientId = patientId(selectedPatient);
  const queryKey = JSON.stringify({
    date_from: filters.date_from,
    date_to: filters.date_to,
    refreshIndex,
    selectedEncounterId: pageKey === 'byEncounter' ? selectedEncounterId : '',
  });

  useEffect(() => {
    let active = true;
    if (!selectedPatientId) {
      setDataState({ loading: false, error: '', data: {} });
      return undefined;
    }
    setDataState((current) => ({ ...current, loading: true, error: '' }));
    const params = { date_from: filters.date_from, date_to: filters.date_to, limit: 240 };
    const loader = pageKey === 'byEncounter' && selectedEncounterId
      ? patientClinicalLookupAPI.encounterOverview(selectedEncounterId, params)
      : patientClinicalLookupAPI.patientOverview(selectedPatientId, params);

    loader
      .then((payload) => {
        if (active) {
          setDataState({ loading: false, error: '', data: payload || {} });
          if (payload?.patient && patientId(payload.patient) !== selectedPatientId) setSelectedPatient(payload.patient);
        }
      })
      .catch((error) => {
        if (active) setDataState({ loading: false, error: getPatientClinicalLookupError(error), data: {} });
      });
    return () => {
      active = false;
    };
  }, [selectedPatientId, pageKey, queryKey]);

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return {
    config,
    searchTerm,
    setSearchTerm,
    searchResults,
    selectedPatient,
    setSelectedPatient: (patient) => {
      setSelectedPatient(patient);
      setSelectedEncounterId('');
    },
    selectedEncounterId,
    setSelectedEncounterId,
    searching,
    runSearch,
    filters,
    setFilter,
    refresh: () => setRefreshIndex((current) => current + 1),
    ...dataState,
  };
}

export function PatientClinicalLookupPage({ pageKey = 'byPatient' }) {
  const {
    config,
    searchTerm,
    setSearchTerm,
    searchResults,
    selectedPatient,
    setSelectedPatient,
    selectedEncounterId,
    setSelectedEncounterId,
    searching,
    runSearch,
    filters,
    setFilter,
    refresh,
    loading,
    error,
    data,
  } = usePatientClinicalLookup(pageKey);
  const [selectedRow, setSelectedRow] = useState(null);
  const [actioning, setActioning] = useState('');
  const [toast, setToast] = useState('');

  const visibleRows = useMemo(
    () => filterMatrix(data.result_matrix || [], config, filters),
    [data.result_matrix, config, filters],
  );

  useEffect(() => {
    if (!visibleRows.length) {
      setSelectedRow(null);
      return;
    }
    if (!selectedRow || !visibleRows.some((item) => item.id === selectedRow.id)) setSelectedRow(visibleRows[0]);
  }, [visibleRows, selectedRow]);

  async function handleAction(action, row) {
    if (action === 'view') {
      setSelectedRow(row);
      return;
    }
    setActioning(`${row.id}:${action}`);
    try {
      if (action === 'ack' && row.type === 'lab') {
        await patientClinicalLookupAPI.acknowledgeLabCritical(row.result_id, { note: 'ACK từ Tra cứu cận lâm sàng.' });
      } else if (action === 'ack' && row.type === 'imaging') {
        await patientClinicalLookupAPI.acknowledgeImagingCritical(row.result_id, { note: 'ACK từ Tra cứu cận lâm sàng.' });
      } else if (action === 'release' && row.type === 'lab') {
        await patientClinicalLookupAPI.releaseLabResult(row.result_id, { note: 'Release từ Tra cứu cận lâm sàng.' });
      } else if (action === 'release' && row.type === 'imaging') {
        await patientClinicalLookupAPI.releaseImagingReport(row.result_id, { note: 'Release từ Tra cứu cận lâm sàng.' });
      } else if (action === 'release' && row.type === 'procedure') {
        await patientClinicalLookupAPI.releaseProcedureResult(row.result_id, { note: 'Release từ Tra cứu cận lâm sàng.' });
      } else if (action === 'charge' && row.type === 'procedure') {
        await patientClinicalLookupAPI.createProcedureCharge(row.child_order_id, { note: 'Tạo charge từ Tra cứu cận lâm sàng.' });
      } else {
        throw new Error('Thao tác này chưa đủ điều kiện thực hiện trên dòng hiện tại.');
      }
      setToast('Thao tác thành công');
      refresh();
    } catch (actionError) {
      setToast(getPatientClinicalLookupError(actionError, 'Không thể xử lý thao tác.'));
    } finally {
      setActioning('');
    }
  }

  return (
    <div className={cx('patient-lookup-page', `is-${config.tone}`)}>
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader config={config} loading={loading} onRefresh={refresh} />
      <section className="patient-lookup-shell">
        <SearchRail
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchResults={searchResults}
          selectedPatient={selectedPatient}
          onSelect={setSelectedPatient}
          searching={searching}
          onSearch={runSearch}
        />
        <main className="patient-lookup-main">
          <PatientIdentity patient={data.patient || selectedPatient} context={data.patient_context} activeEncounter={data.active_encounter} />
          <KpiStrip counters={data.counters} loading={loading} />
          <FilterBar filters={filters} setFilter={setFilter} />
          {error ? <div className="patient-lookup-error"><AlertTriangle size={16} strokeWidth={2.25} />{error}</div> : null}
          {pageKey === 'byEncounter' ? (
            <EncounterSelector
              encounters={data.encounters || []}
              selectedEncounterId={selectedEncounterId}
              onSelect={setSelectedEncounterId}
            />
          ) : null}
          <section className="patient-lookup-board">
            <div className="patient-lookup-matrix-pane">
              <header className="patient-lookup-pane-header">
                <div>
                  <span>Unified result matrix</span>
                  <strong>{formatNumber(visibleRows.length)} dòng cận lâm sàng</strong>
                </div>
                <div>
                  <button type="button"><UploadCloud size={15} strokeWidth={2.25} /> Upload file</button>
                  <button type="button"><BellRing size={15} strokeWidth={2.25} /> Notify</button>
                </div>
              </header>
              <ResultMatrix
                rows={visibleRows}
                loading={loading}
                selectedRow={selectedRow}
                onSelect={setSelectedRow}
                actioning={actioning}
                onAction={handleAction}
              />
            </div>
            <DetailDrawer row={selectedRow} />
          </section>
          <ContextPanels data={data} />
        </main>
      </section>
    </div>
  );
}
