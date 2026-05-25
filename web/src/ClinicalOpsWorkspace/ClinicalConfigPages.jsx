import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BellRing,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  FileWarning,
  FlaskConical,
  Gauge,
  HardDrive,
  Import,
  LayoutGrid,
  ListChecks,
  Loader2,
  Microscope,
  MonitorUp,
  Pencil,
  RefreshCw,
  ScanLine,
  Search,
  Settings2,
  ShieldAlert,
  Stethoscope,
  Timer,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { clinicalConfigAPI, getClinicalConfigError } from './clinicalConfigApi';
import { downloadClinicalOpsJson, notifyClinicalOps, promptClinicalOpsText } from './clinicalOpsActions';
import './clinicalConfig.css';

const PAGE_CONFIG = {
  labTests: {
    title: 'Lab test catalog',
    eyebrow: 'Laboratory configuration',
    description: 'Danh mục xét nghiệm, loại mẫu, item template, reference range, critical range và service price.',
    icon: FlaskConical,
    tone: 'lab',
    loader: clinicalConfigAPI.labTests,
    create: clinicalConfigAPI.createLabTest,
    update: clinicalConfigAPI.updateLabTest,
    clone: clinicalConfigAPI.cloneLabTest,
    retire: clinicalConfigAPI.retireLabTest,
    columns: ['code', 'name', 'category', 'specimen', 'price', 'ranges', 'status', 'warnings'],
    createDefaults: { category: 'general', active: true },
  },
  specimenTypes: {
    title: 'Loại mẫu bệnh phẩm',
    eyebrow: 'Specimen quality',
    description: 'Chuẩn hóa container, tube color, volume, transport, reject criteria, barcode và disposal policy.',
    icon: Microscope,
    tone: 'specimen',
    loader: clinicalConfigAPI.specimenTypes,
    create: clinicalConfigAPI.createSpecimenType,
    update: clinicalConfigAPI.updateSpecimenType,
    clone: clinicalConfigAPI.cloneSpecimenType,
    retire: clinicalConfigAPI.retireSpecimenType,
    columns: ['code', 'name', 'category', 'container', 'transport', 'usage', 'status', 'warnings'],
    createDefaults: { category: 'blood', active: true },
  },
  imagingModalities: {
    title: 'Imaging modality',
    eyebrow: 'RIS configuration',
    description: 'Quản trị modality, duration, room requirement, template coverage và readiness scheduling.',
    icon: ScanLine,
    tone: 'imaging',
    loader: clinicalConfigAPI.imagingModalities,
    create: clinicalConfigAPI.createImagingModality,
    update: clinicalConfigAPI.updateImagingModality,
    clone: clinicalConfigAPI.cloneImagingModality,
    retire: clinicalConfigAPI.retireImagingModality,
    columns: ['code', 'name', 'duration', 'rooms', 'templates', 'status', 'warnings'],
    createDefaults: { room_required: true, duration_minutes: 30, active: true },
  },
  imagingRoomsEquipment: {
    title: 'Phòng / thiết bị CĐHA',
    eyebrow: 'Room and equipment readiness',
    description: 'Board vận hành phòng, thiết bị, trạng thái bảo trì, downtime và scheduling readiness.',
    icon: HardDrive,
    tone: 'imaging',
    loader: clinicalConfigAPI.imagingRoomsEquipment,
    create: clinicalConfigAPI.createImagingRoom,
    update: clinicalConfigAPI.updateImagingRoom,
    columns: ['code', 'name', 'modality', 'equipment', 'maintenance', 'status', 'warnings'],
    createDefaults: { modality: 'XRAY', active: true, default_duration_minutes: 30 },
  },
  procedures: {
    title: 'Danh mục thủ thuật',
    eyebrow: 'Procedure catalog',
    description: 'Chuẩn hóa code thủ thuật, duration, consent, checklist, phòng/thiết bị, vật tư và billing.',
    icon: Stethoscope,
    tone: 'procedure',
    loader: clinicalConfigAPI.procedures,
    create: clinicalConfigAPI.createProcedure,
    update: clinicalConfigAPI.updateProcedure,
    clone: clinicalConfigAPI.cloneProcedure,
    retire: clinicalConfigAPI.retireProcedure,
    columns: ['code', 'name', 'category', 'duration', 'checklist', 'price', 'status', 'warnings'],
    createDefaults: { category: 'general', requires_preparation: true, active: true, default_duration_minutes: 30 },
  },
  procedureChecklists: {
    title: 'Checklist thủ thuật',
    eyebrow: 'Checklist builder',
    description: 'Builder cho checklist identity, clinical, safety, document, material, handoff và điều kiện hiển thị.',
    icon: ClipboardCheck,
    tone: 'checklist',
    loader: clinicalConfigAPI.checklistTemplates,
    create: clinicalConfigAPI.createChecklistTemplate,
    update: clinicalConfigAPI.updateChecklistTemplate,
    clone: clinicalConfigAPI.cloneChecklistTemplate,
    columns: ['code', 'name', 'source', 'scope', 'items', 'default', 'status', 'warnings'],
    createDefaults: { source_type: 'procedure', is_active: true, version: 1, items: [] },
  },
  slaAlerts: {
    title: 'SLA & cảnh báo',
    eyebrow: 'SLA rule engine',
    description: 'Rule builder cho order, specimen, result, report, procedure, attachment và escalation.',
    icon: Timer,
    tone: 'sla',
    loader: clinicalConfigAPI.slaRules,
    create: clinicalConfigAPI.createSlaRule,
    update: clinicalConfigAPI.updateSlaRule,
    columns: ['module', 'stage', 'priority', 'threshold', 'warning', 'status', 'warnings'],
    createDefaults: { module: 'lab', stage: 'result_pending', priority: 'routine', threshold_minutes: 60, warning_minutes: 15, active: true },
  },
  reportTemplates: {
    title: 'Mẫu báo cáo kết quả',
    eyebrow: 'Result report designer',
    description: 'Template lab, imaging, procedure với section, structured fields, print layout và patient release layout.',
    icon: FileText,
    tone: 'template',
    loader: clinicalConfigAPI.reportTemplates,
    create: clinicalConfigAPI.createReportTemplate,
    update: clinicalConfigAPI.updateReportTemplate,
    clone: clinicalConfigAPI.cloneReportTemplate,
    retire: clinicalConfigAPI.retireReportTemplate,
    publish: clinicalConfigAPI.publishReportTemplate,
    columns: ['code', 'name', 'domain', 'scope', 'sections', 'default', 'status', 'warnings'],
    createDefaults: { domain: 'imaging', status: 'draft', version: 1, sections: [] },
  },
};

const KPI_CARDS = [
  ['lab_tests_active', 'Lab tests active', FlaskConical, 'lab'],
  ['specimen_types_active', 'Specimen types', Microscope, 'specimen'],
  ['imaging_modalities_active', 'Modalities', ScanLine, 'imaging'],
  ['imaging_rooms_active', 'Imaging rooms', MonitorUp, 'imaging'],
  ['imaging_equipment_active', 'Equipment ready', HardDrive, 'imaging'],
  ['procedure_catalog_active', 'Procedures', Stethoscope, 'procedure'],
  ['checklist_templates_active', 'Checklists', ClipboardCheck, 'checklist'],
  ['sla_rules_active', 'SLA rules', Timer, 'sla'],
  ['report_templates_active', 'Report templates', FileText, 'template'],
  ['config_issues', 'Cấu hình lỗi', FileWarning, 'danger'],
];

const CONFIG_ROUTES = {
  labTests: '/clinical-ops/config/lab-tests',
  specimenTypes: '/clinical-ops/config/specimen-types',
  imagingModalities: '/clinical-ops/config/imaging-modalities',
  imagingRoomsEquipment: '/clinical-ops/config/imaging-rooms-equipment',
  procedures: '/clinical-ops/config/procedures',
  procedureChecklists: '/clinical-ops/config/procedure-checklists',
  slaAlerts: '/clinical-ops/config/sla-alerts',
  reportTemplates: '/clinical-ops/config/result-report-templates',
};

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function getId(row) {
  return row?.id || row?._id;
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getCode(row) {
  return row.code || row.template_code || row.service_code || row.module || row.room_code || '--';
}

function getStatus(row) {
  if (row.status) return row.status;
  if (row.active !== undefined) return row.active ? 'active' : 'retired';
  if (row.is_active !== undefined) return row.is_active ? 'active' : 'inactive';
  if (row.maintenance_status) return row.maintenance_status;
  return '--';
}

function getWarnings(row) {
  return row.config_warnings || [];
}

function normalizeRows(pageKey, payload) {
  if (pageKey === 'imagingRoomsEquipment') {
    const rooms = (payload.rooms || []).map((row) => ({ ...row, config_kind: 'room', name: row.name, equipment_name: row.equipment_id?.name || row.equipment_id?.code }));
    const equipment = (payload.equipment || []).map((row) => ({ ...row, config_kind: 'equipment', active: row.status === 'available', maintenance_status: row.status, equipment_name: [row.manufacturer, row.model].filter(Boolean).join(' ') }));
    return [...rooms, ...equipment];
  }
  return payload.items || [];
}

function renderCell(row, column) {
  if (column === 'code') return <strong>{getCode(row)}</strong>;
  if (column === 'name') return <span className="clinical-config-main-cell"><strong>{row.name || row.service_name || '--'}</strong><em>{row.description || row.patient_instructions || row.metadata?.note || '--'}</em></span>;
  if (column === 'category') return row.category || '--';
  if (column === 'specimen') return row.specimen_type_id?.name || row.specimen_type || '--';
  if (column === 'container') return [row.container_type, row.tube_color, row.additive].filter(Boolean).join(' · ') || '--';
  if (column === 'transport') return [row.storage_temperature, row.transport_max_minutes ? `${row.transport_max_minutes}p` : null].filter(Boolean).join(' · ') || '--';
  if (column === 'usage') return `${formatNumber(row.test_count || row.usage_30d)} dùng`;
  if (column === 'price') return row.price_service_id?.service_name || row.default_service_id?.service_name || 'Thiếu giá';
  if (column === 'ranges') return `${formatNumber(row.reference_ranges?.length)} range · ${formatNumber(row.result_items?.length)} item`;
  if (column === 'duration') return row.duration_minutes || row.default_duration_minutes ? `${row.duration_minutes || row.default_duration_minutes}p` : '--';
  if (column === 'rooms') return `${formatNumber(row.room_count)} phòng`;
  if (column === 'templates') return `${formatNumber(row.template_count)} mẫu`;
  if (column === 'equipment') return row.equipment_name || row.equipment_id?.name || '--';
  if (column === 'maintenance') return row.maintenance_status || row.status || '--';
  if (column === 'modality') return row.modality || '--';
  if (column === 'checklist') return row.checklist_template_id?.name || 'Thiếu checklist';
  if (column === 'source') return row.source_type || '--';
  if (column === 'scope') return [row.procedure_code, row.modality, row.test_code, row.specimen_type, row.department_id?.name].filter(Boolean).join(' · ') || '--';
  if (column === 'items') return `${formatNumber(row.item_count || row.items?.length)} item · ${formatNumber(row.required_count)} required`;
  if (column === 'default') return row.is_default ? 'Default' : '--';
  if (column === 'module') return row.module || row.domain || '--';
  if (column === 'stage') return row.stage || '--';
  if (column === 'priority') return String(row.priority || 'routine').toUpperCase();
  if (column === 'threshold') return row.threshold_minutes ? `${row.threshold_minutes}p` : '--';
  if (column === 'warning') return row.warning_minutes ? `${row.warning_minutes}p` : '--';
  if (column === 'domain') return row.domain || '--';
  if (column === 'sections') return `${formatNumber(row.section_count || row.sections?.length)} section · ${formatNumber(row.structured_field_count)} field`;
  if (column === 'status') return <StatusBadge status={getStatus(row)} />;
  if (column === 'warnings') return <WarningStack warnings={getWarnings(row)} />;
  return row[column] || '--';
}

function StatusBadge({ status }) {
  return <span className={cx('clinical-config-status', `is-${String(status || 'none').replace(/_/g, '-')}`)}>{status || '--'}</span>;
}

function WarningStack({ warnings = [] }) {
  if (!warnings.length) return <span className="clinical-config-ok"><CheckCircle2 size={13} strokeWidth={2.3} />OK</span>;
  return (
    <span className="clinical-config-warning-stack">
      {warnings.slice(0, 2).map((item) => <em key={item.code} className={`is-${item.severity}`}>{item.label}</em>)}
      {warnings.length > 2 ? <em>+{warnings.length - 2}</em> : null}
    </span>
  );
}

function PageHeader({ config, loading, onRefresh, onCreate, onImport, onValidate }) {
  const Icon = config.icon;
  return (
    <header className={cx('clinical-config-header', `is-${config.tone}`)}>
      <div>
        <span><Icon size={16} strokeWidth={2.3} />{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <div className="clinical-config-header__actions">
        <button type="button" onClick={onCreate}><Settings2 size={16} strokeWidth={2.25} />Tạo mới</button>
        <button type="button" onClick={onImport}><Import size={16} strokeWidth={2.25} />Import Excel</button>
        <button type="button" onClick={onValidate}><BadgeCheck size={16} strokeWidth={2.25} />Validate</button>
        <button type="button" className="primary" onClick={onRefresh}><RefreshCw className={loading ? 'is-spinning' : ''} size={16} strokeWidth={2.25} />Refresh</button>
      </div>
    </header>
  );
}

function FilterBar({ filters, setFilters }) {
  return (
    <section className="clinical-config-filters">
      <label><Search size={15} strokeWidth={2.25} /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Tìm theo mã / tên / scope" /></label>
      <label><Activity size={15} strokeWidth={2.25} /><select value={filters.active} onChange={(event) => setFilters((current) => ({ ...current, active: event.target.value }))}><option value="">Tất cả trạng thái</option><option value="true">Active</option><option value="false">Inactive/retired</option></select></label>
      <label><FileWarning size={15} strokeWidth={2.25} /><select value={filters.warning} onChange={(event) => setFilters((current) => ({ ...current, warning: event.target.value }))}><option value="">Mọi cấu hình</option><option value="has_warning">Có cảnh báo</option><option value="clean">Sạch</option></select></label>
    </section>
  );
}

function ConfigTable({ config, rows, loading, selected, onSelect, actioning, onAction }) {
  if (loading && !rows.length) {
    return <div className="clinical-config-skeleton-stack">{Array.from({ length: 8 }).map((_, index) => <span key={index} className="clinical-config-skeleton" />)}</div>;
  }
  if (!rows.length) {
    return <section className="clinical-config-empty"><CheckCircle2 size={30} strokeWidth={2.25} /><strong>Không có cấu hình phù hợp</strong><span>Danh sách hiện không có bản ghi theo bộ lọc.</span></section>;
  }
  return (
    <section className="clinical-config-table-shell">
      <div className="clinical-config-table">
        <div className="clinical-config-table__head" style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(120px, 1fr)) 230px` }}>
          {config.columns.map((column) => <span key={column}>{column.replace(/_/g, ' ')}</span>)}
          <span>Actions</span>
        </div>
        {rows.map((row) => (
          <div
            key={`${getCode(row)}:${getId(row)}`}
            role="button"
            tabIndex={0}
            className={cx('clinical-config-row', selected && getId(selected) === getId(row) && 'is-selected')}
            style={{ gridTemplateColumns: `repeat(${config.columns.length}, minmax(120px, 1fr)) 230px` }}
            onClick={() => onSelect(row)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelect(row);
            }}
          >
            {config.columns.map((column) => <span key={column}>{renderCell(row, column)}</span>)}
            <span className="clinical-config-row-actions" onClick={(event) => event.stopPropagation()}>
              <button type="button" title="Sửa" onClick={() => onAction('edit', row)}><Pencil size={13} strokeWidth={2.25} />Sửa</button>
              {config.clone ? <button type="button" title="Clone" disabled={actioning === `clone:${getId(row)}`} onClick={() => onAction('clone', row)}>{actioning === `clone:${getId(row)}` ? <Loader2 className="is-spinning" size={13} /> : <Copy size={13} strokeWidth={2.25} />}Clone</button> : null}
              {config.publish && row.status === 'draft' ? <button type="button" title="Publish" onClick={() => onAction('publish', row)}><BadgeCheck size={13} strokeWidth={2.25} />Publish</button> : null}
              {config.retire ? <button type="button" title="Retire" disabled={actioning === `retire:${getId(row)}`} onClick={() => onAction('retire', row)}><Trash2 size={13} strokeWidth={2.25} />Retire</button> : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DetailDrawer({ config, row }) {
  const Icon = config.icon;
  if (!row) {
    return <aside className="clinical-config-detail is-empty"><Settings2 size={30} strokeWidth={2.25} /><strong>Chọn cấu hình</strong><span>Dependency, audit, usage và cảnh báo cấu hình sẽ hiển thị tại đây.</span></aside>;
  }
  const warnings = getWarnings(row);
  return (
    <aside className="clinical-config-detail">
      <header>
        <span className={`clinical-config-kind is-${config.tone}`}><Icon size={14} strokeWidth={2.25} />{config.title}</span>
        <h2>{row.name || row.service_name || row.stage || getCode(row)}</h2>
        <p>{getCode(row)} · {getStatus(row)} · updated {formatDateTime(row.updated_at)}</p>
      </header>
      <section className="clinical-config-detail-grid">
        <div><span>Code</span><strong>{getCode(row)}</strong></div>
        <div><span>Status</span><strong>{getStatus(row)}</strong></div>
        <div><span>Usage</span><strong>{formatNumber(row.usage_30d || row.test_count || row.room_count || row.template_count || 0)}</strong></div>
        <div><span>Warnings</span><strong>{formatNumber(warnings.length)}</strong></div>
      </section>
      <section className="clinical-config-detail-section">
        <strong>Config warnings</strong>
        {warnings.length ? warnings.map((item) => <p key={item.code}>{item.label} · {item.impact}</p>) : <p>Không có cảnh báo cấu hình.</p>}
      </section>
      <section className="clinical-config-detail-section">
        <strong>Dependency / billing / workflow</strong>
        <p>Service: {row.price_service_id?.service_name || row.default_service_id?.service_name || 'Chưa gắn'}</p>
        <p>Checklist: {row.checklist_template_id?.name || row.template_code || 'Chưa gắn'}</p>
        <p>Scope: {[row.category, row.source_type, row.domain, row.modality, row.procedure_code, row.test_code].filter(Boolean).join(' · ') || '--'}</p>
      </section>
      <section className="clinical-config-detail-section">
        <strong>Metadata</strong>
        <pre>{JSON.stringify(row.metadata || {}, null, 2)}</pre>
      </section>
    </aside>
  );
}

function LandingKpis({ summary = {}, loading }) {
  return (
    <section className="clinical-config-kpis">
      {KPI_CARDS.map(([key, label, Icon, tone]) => (
        <article key={key} className={`clinical-config-kpi is-${tone}`}>
          <span><Icon size={19} strokeWidth={2.25} /></span>
          <div>
            <small>{label}</small>
            {loading ? <em className="clinical-config-skeleton value" /> : <strong>{formatNumber(summary[key])}</strong>}
          </div>
        </article>
      ))}
    </section>
  );
}

export function ClinicalConfigLandingPage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: '', data: {} });
  const [refreshIndex, setRefreshIndex] = useState(0);
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    clinicalConfigAPI.overview()
      .then((data) => active && setState({ loading: false, error: '', data }))
      .catch((error) => active && setState({ loading: false, error: getClinicalConfigError(error), data: {} }));
    return () => { active = false; };
  }, [refreshIndex]);

  const data = state.data || {};
  const quickActions = [
    ['Tạo lab test', FlaskConical, 'labTests'],
    ['Tạo loại mẫu', Microscope, 'specimenTypes'],
    ['Tạo modality', ScanLine, 'imagingModalities'],
    ['Tạo phòng CĐHA', MonitorUp, 'imagingRoomsEquipment'],
    ['Tạo thủ thuật', Stethoscope, 'procedures'],
    ['Tạo checklist', ClipboardCheck, 'procedureChecklists'],
    ['Tạo SLA rule', Timer, 'slaAlerts'],
    ['Tạo report template', FileText, 'reportTemplates'],
  ];
  return (
    <main className="clinical-config-page">
      <PageHeader
        config={{ title: 'Danh mục & cấu hình cận lâm sàng', eyebrow: 'Configuration Command Center', description: 'Trung tâm cấu hình catalog, checklist, SLA, phòng/thiết bị, report template và billing readiness.', icon: Settings2, tone: 'command' }}
        loading={state.loading}
        onRefresh={() => setRefreshIndex((value) => value + 1)}
        onCreate={() => navigate('/clinical-ops/config/lab-tests')}
        onImport={() => notifyClinicalOps({ title: 'Import cấu hình', message: 'Import Excel cần file mẫu và kiểm duyệt schema; hiện có thể tạo từng cấu hình từ màn catalog.' })}
        onValidate={() => {
          notifyClinicalOps({ title: 'Validate cấu hình', message: 'Đã làm mới dashboard chất lượng cấu hình.' });
          setRefreshIndex((value) => value + 1);
        }}
      />
      {state.error ? <div className="clinical-config-error"><AlertTriangle size={16} />{state.error}</div> : null}
      <LandingKpis summary={data.summary} loading={state.loading} />
      <section className="clinical-config-health">
        {(data.health || []).map((item) => (
          <article key={item.key}>
            <div><strong>{item.label}</strong><span>{item.score}%</span></div>
            <i><b style={{ width: `${item.score}%` }} /></i>
          </article>
        ))}
      </section>
      <section className="clinical-config-landing-grid">
        <section className="clinical-config-issue-center">
          <header><span><FileWarning size={16} strokeWidth={2.25} />Cấu hình cần xử lý</span><strong>{formatNumber(data.issues?.length)}</strong></header>
          <div>
            {(data.issues || []).slice(0, 18).map((issue) => (
              <article key={`${issue.type}:${issue.item_id}:${issue.code}`}>
                <span className={`clinical-config-severity is-${issue.severity}`}>{issue.severity}</span>
                <strong>{issue.name}</strong>
                <em>{issue.type} · {issue.code}</em>
                <p>{issue.label}</p>
              </article>
            ))}
            {!data.issues?.length ? <div className="clinical-config-empty compact">Không có issue cấu hình.</div> : null}
          </div>
        </section>
        <section className="clinical-config-quick-actions">
          <header><span><Wrench size={16} strokeWidth={2.25} />Quick actions</span></header>
          {quickActions.map(([label, Icon, key]) => (
            <button key={label} type="button" onClick={() => navigate(CONFIG_ROUTES[key])}>
              <Icon size={16} strokeWidth={2.25} />{label}
            </button>
          ))}
        </section>
      </section>
    </main>
  );
}

export function ClinicalConfigCatalogPage({ pageKey }) {
  const config = PAGE_CONFIG[pageKey] || PAGE_CONFIG.labTests;
  const [filters, setFilters] = useState({ search: '', active: '', warning: '' });
  const [state, setState] = useState({ loading: true, error: '', rows: [] });
  const [selected, setSelected] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [actioning, setActioning] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));
    config.loader({ search: filters.search, active: filters.active, is_active: filters.active, limit: 100 })
      .then((payload) => {
        if (!active) return;
        const rows = normalizeRows(pageKey, payload);
        setState({ loading: false, error: '', rows });
        if (!selected || !rows.some((row) => getId(row) === getId(selected))) setSelected(rows[0] || null);
      })
      .catch((error) => active && setState({ loading: false, error: getClinicalConfigError(error), rows: [] }));
    return () => { active = false; };
  }, [pageKey, config, filters.search, filters.active, refreshIndex]);

  const visibleRows = useMemo(() => {
    let rows = state.rows;
    if (filters.warning === 'has_warning') rows = rows.filter((row) => getWarnings(row).length);
    if (filters.warning === 'clean') rows = rows.filter((row) => !getWarnings(row).length);
    return rows;
  }, [state.rows, filters.warning]);

  async function handleCreate() {
    const code = promptClinicalOpsText({ title: 'Tạo cấu hình mới', message: 'Mã cấu hình mới' });
    if (!code) return;
    const name = promptClinicalOpsText({ title: 'Tạo cấu hình mới', message: 'Tên cấu hình mới', defaultValue: code });
    if (!name) return;
    try {
      await config.create({ ...config.createDefaults, code, template_code: code, name });
      setToast('Tạo cấu hình thành công');
      notifyClinicalOps({ tone: 'success', title: 'Tạo cấu hình', message: `${name} đã được tạo.` });
      setRefreshIndex((value) => value + 1);
    } catch (error) {
      setToast(getClinicalConfigError(error, 'Không thể tạo cấu hình.'));
      notifyClinicalOps({ tone: 'danger', title: 'Tạo cấu hình', message: getClinicalConfigError(error, 'Không thể tạo cấu hình.') });
    }
  }

  async function handleAction(action, row) {
    const id = getId(row);
    setActioning(`${action}:${id}`);
    try {
      if (action === 'clone' && config.clone) await config.clone(id, {});
      if (action === 'retire' && config.retire) await config.retire(id);
      if (action === 'publish' && config.publish) await config.publish(id);
      if (action === 'edit' && config.update) {
        const name = promptClinicalOpsText({ title: 'Sửa cấu hình', message: 'Tên cấu hình', defaultValue: row.name || row.service_name || '' });
        if (!name) return;
        if (pageKey === 'imagingRoomsEquipment' && row.config_kind === 'equipment') {
          await clinicalConfigAPI.updateImagingEquipment(id, { name });
        } else {
          await config.update(id, { name });
        }
      }
      setToast('Thao tác cấu hình thành công');
      notifyClinicalOps({ tone: 'success', title: 'Cấu hình cận lâm sàng', message: 'Thao tác cấu hình thành công.' });
      setRefreshIndex((value) => value + 1);
    } catch (error) {
      setToast(getClinicalConfigError(error, 'Không thể xử lý cấu hình.'));
      notifyClinicalOps({ tone: 'danger', title: 'Cấu hình cận lâm sàng', message: getClinicalConfigError(error, 'Không thể xử lý cấu hình.') });
    } finally {
      setActioning('');
    }
  }

  return (
    <main className={cx('clinical-config-page', `is-${config.tone}`)}>
      {toast ? <div className="clinical-config-toast"><CheckCircle2 size={16} strokeWidth={2.25} /><span>{toast}</span><button type="button" onClick={() => setToast('')}><X size={13} /></button></div> : null}
      <PageHeader
        config={config}
        loading={state.loading}
        onRefresh={() => setRefreshIndex((value) => value + 1)}
        onCreate={handleCreate}
        onImport={() => notifyClinicalOps({ title: 'Import Excel', message: 'Import hàng loạt cần template chuẩn. Hãy dùng tạo mới/sửa để đảm bảo validate backend trước.' })}
        onValidate={() => {
          notifyClinicalOps({ title: 'Validate cấu hình', message: 'Đã lọc các bản ghi có cảnh báo cấu hình.' });
          setFilters((current) => ({ ...current, warning: 'has_warning' }));
        }}
      />
      <FilterBar filters={filters} setFilters={setFilters} />
      {state.error ? <div className="clinical-config-error"><AlertTriangle size={16} />{state.error}</div> : null}
      <section className="clinical-config-workbench">
        <div className="clinical-config-list-pane">
          <header className="clinical-config-pane-header">
            <div><span><LayoutGrid size={16} strokeWidth={2.25} />Config table</span><strong>{formatNumber(visibleRows.length)} bản ghi</strong></div>
            <div>
              <button type="button" onClick={() => downloadClinicalOpsJson(`clinical-config-${pageKey}.json`, { pageKey, filters, rows: visibleRows }, 'Xuất saved view')}>
                <BellRing size={15} />Saved view
              </button>
              <button type="button" onClick={() => notifyClinicalOps({ title: 'Bulk action', message: 'Chọn các bản ghi và hành động cụ thể sẽ được bổ sung theo quyền quản trị cấu hình.' })}>
                <Boxes size={15} />Bulk action
              </button>
            </div>
          </header>
          <ConfigTable config={config} rows={visibleRows} loading={state.loading} selected={selected} onSelect={setSelected} actioning={actioning} onAction={handleAction} />
        </div>
        <DetailDrawer config={config} row={selected} />
      </section>
    </main>
  );
}
