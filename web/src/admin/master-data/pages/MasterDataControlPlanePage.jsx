import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  Banknote,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileClock,
  FileText,
  Fingerprint,
  Gauge,
  GitBranch,
  HeartPulse,
  Import,
  Layers3,
  Link2,
  MonitorCheck,
  PackageCheck,
  Pill,
  RefreshCw,
  Router,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Store,
  TableProperties,
  TestTube2,
  UploadCloud,
  Workflow,
} from 'lucide-react';
import {
  getMasterDataDependencyGraph,
  getMasterDataOverview,
  getMasterDataQualityDashboard,
  getMasterDataRecentChanges,
  listMasterDataEntity,
  runMasterDataQualityCheck,
} from '../masterDataApi';

const VIEW_CONFIG = {
  overview: {
    title: 'Tổng quan Master Data',
    eyebrow: 'Master Data Control Center',
    description: 'Điều hành dữ liệu nền ảnh hưởng billing, dược, xét nghiệm, CĐHA, thủ thuật, lịch khám và định danh.',
    icon: Gauge,
  },
  quality: {
    title: 'Data quality center',
    eyebrow: 'Quality & Readiness',
    description: 'Theo dõi lỗi mapping, dữ liệu thiếu, bản ghi hết hiệu lực, catalog hard-code và rủi ro vận hành.',
    icon: ShieldAlert,
  },
  services: {
    title: 'Dịch vụ y tế',
    eyebrow: 'Billing Catalog',
    description: 'Service catalog dùng cho charge, invoice, lab, thủ thuật, thuốc và patient-facing service mapping.',
    icon: HeartPulse,
    entity: 'services',
  },
  servicePrices: {
    title: 'Bảng giá dịch vụ',
    eyebrow: 'Price Versioning',
    description: 'Vòng đời giá dịch vụ, version, ngày hiệu lực, trạng thái duyệt và tác động doanh thu.',
    icon: Banknote,
    entity: 'service-prices',
  },
  medications: {
    title: 'Danh mục thuốc',
    eyebrow: 'Medication Master',
    description: 'Medication master, unit, dosage form, route, service billing, safety flags và controlled drug readiness.',
    icon: Pill,
    entity: 'medications',
  },
  medicationUnits: {
    title: 'Đơn vị thuốc',
    eyebrow: 'Medication Units',
    description: 'Đơn vị kê đơn, cấp phát, tồn kho, decimal policy, deprecated replacement và merge readiness.',
    icon: PackageCheck,
    entity: 'medication-units',
  },
  dosageForms: {
    title: 'Dạng bào chế',
    eyebrow: 'Dosage Forms',
    description: 'Dạng bào chế, default unit, default route, allowed routes, sterile/high-risk flags và label instruction.',
    icon: FileText,
    entity: 'dosage-forms',
  },
  administrationRoutes: {
    title: 'Đường dùng thuốc',
    eyebrow: 'Administration Routes',
    description: 'Route group, risk level, nurse administration, outpatient/inpatient boundary và compatibility policy.',
    icon: Router,
    entity: 'administration-routes',
  },
  suppliers: {
    title: 'Nhà cung cấp',
    eyebrow: 'Supplier Risk',
    description: 'Nhà cung cấp, giấy phép, trạng thái block, risk level, batches, transactions và duplicate controls.',
    icon: Store,
    entity: 'suppliers',
  },
  warehouses: {
    title: 'Kho dược',
    eyebrow: 'Warehouse Registry',
    description: 'Kho trung tâm, kho nhà thuốc, kho khoa/phòng, vị trí lưu kho, QR, quarantine và cold-chain readiness.',
    icon: Archive,
    entity: 'warehouses',
  },
  storageLocations: {
    title: 'Vị trí lưu kho',
    eyebrow: 'Storage Locations',
    description: 'Cây vị trí kho, shelf/bin/fridge/controlled cabinet, QR, lock state, quarantine và recall zones.',
    icon: Layers3,
    entity: 'storage-locations',
  },
  labTests: {
    title: 'Danh mục xét nghiệm',
    eyebrow: 'Lab Test Catalog',
    description: 'Lab test, specimen, container, result items, reference ranges, TAT và billing service mapping.',
    icon: TestTube2,
    entity: 'lab-tests',
  },
  specimenTypes: {
    title: 'Loại mẫu bệnh phẩm',
    eyebrow: 'Specimen Catalog',
    description: 'Loại mẫu, tube color, transport, stability, barcode prefix, label template và reject criteria.',
    icon: ClipboardCheck,
    entity: 'specimen-types',
  },
  imagingCatalog: {
    title: 'Danh mục CĐHA',
    eyebrow: 'Imaging Catalog',
    description: 'Modality hiện có và readiness để bổ sung ImagingCatalog chi tiết cho từng dịch vụ CĐHA.',
    icon: Activity,
    entity: 'imaging-catalog',
  },
  imagingEquipment: {
    title: 'Thiết bị CĐHA',
    eyebrow: 'Imaging Equipment',
    description: 'Thiết bị CĐHA, manufacturer, room linkage, maintenance/down status và lịch bảo trì.',
    icon: MonitorCheck,
    entity: 'imaging-equipment',
  },
  imagingRooms: {
    title: 'Phòng CĐHA',
    eyebrow: 'Imaging Rooms',
    description: 'Phòng CĐHA, modality, equipment, maintenance status, default duration và readiness đặt lịch.',
    icon: MonitorCheck,
    entity: 'imaging-rooms',
  },
  procedures: {
    title: 'Danh mục thủ thuật',
    eyebrow: 'Procedure Catalog',
    description: 'Thủ thuật, consent, preparation checklist, post observation, billing, locations và performer roles.',
    icon: Workflow,
    entity: 'procedures',
  },
  reportTemplates: {
    title: 'Mẫu báo cáo kết quả',
    eyebrow: 'Result Report Templates',
    description: 'Template lab, imaging, procedure, sections, structured fields, print layout, publish và default rules.',
    icon: FileText,
    entity: 'report-templates',
  },
  scheduleTypes: {
    title: 'Loại lịch / slot',
    eyebrow: 'Scheduling Catalog',
    description: 'Loại lịch hiện dùng từ hard-code catalog, kèm readiness cho ScheduleType model động.',
    icon: TableProperties,
    entity: 'schedule-types',
  },
  identifierRules: {
    title: 'Quy tắc mã định danh',
    eyebrow: 'Identifier Rules',
    description: 'Counter hiện có, preview format, sequence scope và readiness cho IdentifierRule model động.',
    icon: Fingerprint,
    entity: 'identifier-rules',
  },
  importExport: {
    title: 'Import / Export',
    eyebrow: 'Bulk Data Ops',
    description: 'Import job, map columns, validate, dry-run, commit và export snapshot cho Master Data.',
    icon: UploadCloud,
  },
  changeRequests: {
    title: 'Change requests',
    eyebrow: 'Approval Workflow',
    description: 'Diff, impact preview, approval, schedule apply và audit cho thay đổi dữ liệu nền nhạy cảm.',
    icon: GitBranch,
  },
  audit: {
    title: 'Audit Master Data',
    eyebrow: 'Compliance Trail',
    description: 'Dấu vết thao tác billing catalog, pharmacy config, clinical config và entity metadata.',
    icon: FileClock,
  },
};

const DOMAIN_TONE = {
  billing: 'amber',
  pharmacy: 'emerald',
  clinical: 'cyan',
  scheduling: 'indigo',
  platform: 'slate',
};

const SEVERITY_LABEL = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

const ENTITY_ACTIONS = {
  services: ['Tạo dịch vụ', 'Tạo version giá', 'Retire impact', 'Xem charges'],
  'service-prices': ['Tạo version', 'So sánh giá', 'Simulate revenue', 'Xem timeline'],
  medications: ['Gắn unit', 'Gắn route', 'Gắn service', 'Controlled policy'],
  'medication-units': ['Deprecate', 'Merge', 'Xem thuốc', 'Bulk assign'],
  'dosage-forms': ['Route mapping', 'Merge', 'Compatibility', 'Xem thuốc'],
  'administration-routes': ['Compatibility check', 'Bulk assign', 'Merge', 'Xem thuốc'],
  suppliers: ['Block', 'Unblock', 'Risk dashboard', 'Merge'],
  warehouses: ['Tạo kho', 'Storage tree', 'Deactivate check', 'QR bulk'],
  'storage-locations': ['Lock', 'Unlock', 'Print QR', 'Start count'],
  'lab-tests': ['Link service', 'Reference ranges', 'Result items', 'Retire'],
  'specimen-types': ['Preview label', 'Reject reasons', 'Clone', 'Retire'],
  'imaging-catalog': ['Tạo modality', 'Retire', 'Link service', 'Catalog model'],
  'imaging-equipment': ['Mark down', 'Restore', 'Maintenance', 'Assign room'],
  'imaging-rooms': ['Set maintenance', 'Assign equipment', 'Restore', 'Schedule board'],
  procedures: ['Link service', 'Link checklist', 'Readiness', 'Clone'],
  'report-templates': ['Builder', 'Preview', 'Publish', 'Set default'],
  'schedule-types': ['Export config', 'Xem usage', 'DB model', 'Route guards'],
  'identifier-rules': ['Preview 10 mã', 'Test generate', 'Counters', 'DB model'],
};

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCurrency(value, currency = 'VND') {
  if (value === undefined || value === null || value === '') return 'Chưa có';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không hợp lệ';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function getItemId(item) {
  return item?._id || item?.id || item?.code || item?.service_code || item?.template_code || item?.version_code || item?.medication_code;
}

function getCode(item = {}) {
  return item.service_code || item.version_code || item.medication_code || item.warehouse_code || item.location_code || item.template_code || item.code || item.code_type || item.value || 'N/A';
}

function getName(item = {}) {
  return item.service_name
    || item.generic_name
    || item.brand_name
    || item.display_name
    || item.name
    || item.label
    || item.version_code
    || item.location_code
    || 'Chưa đặt tên';
}

function getSecondary(item = {}) {
  return item.service_type
    || item.change_type
    || item.brand_name
    || item.strength
    || item.unit_type
    || item.form_group
    || item.route_group
    || item.supplier_type
    || item.location_type
    || item.category
    || item.domain
    || item.modality
    || item.source
    || 'core';
}

function getStatus(item = {}) {
  return item.status_resolved || item.status || (item.active === false ? 'inactive' : 'active');
}

function getMappingLabel(item = {}, entity) {
  if (entity === 'services') return item.department_id?.department_name || item.department_id?.name || 'Chưa gắn khoa';
  if (entity === 'service-prices') return item.service_id?.service_name || item.service_id?.service_code || 'Chưa gắn dịch vụ';
  if (entity === 'medications') return item.service_id?.service_name || item.unit_id?.symbol || item.unit || 'Thiếu mapping';
  if (entity === 'medication-units') return `${item.medication_count || item.linked_count || 0} thuốc`;
  if (entity === 'dosage-forms') return item.default_route_id?.name || item.default_unit_id?.symbol || 'Thiếu default';
  if (entity === 'administration-routes') return `${item.allowed_dosage_form_ids?.length || 0} dạng bào chế`;
  if (entity === 'suppliers') return item.license_no || item.tax_code || item.contact_person || 'Thiếu hồ sơ';
  if (entity === 'warehouses') return item.department_id?.department_name || item.department_id?.name || item.type || 'Không gắn khoa';
  if (entity === 'storage-locations') return item.warehouse_id?.name || item.warehouse_id?.warehouse_code || 'Chưa gắn kho';
  if (entity === 'lab-tests') return item.price_service_id?.service_name || item.specimen_type_id?.name || item.specimen_type || 'Thiếu mapping';
  if (entity === 'specimen-types') return item.barcode_prefix || item.container_type || 'Thiếu label/container';
  if (entity === 'imaging-catalog') return item.room_required ? 'Cần phòng' : 'Không bắt buộc phòng';
  if (entity === 'imaging-equipment') return item.serial_no || item.manufacturer || item.modality || 'Thiếu serial';
  if (entity === 'imaging-rooms') return item.equipment_id?.name || item.maintenance_status || 'Chưa gắn thiết bị';
  if (entity === 'procedures') return item.default_service_id?.service_name || item.checklist_template_id?.name || 'Thiếu readiness';
  if (entity === 'report-templates') return `${item.sections?.length || item.section_count || 0} section`;
  if (entity === 'schedule-types') return item.patient_portal_enabled ? 'Portal enabled' : 'Staff only';
  if (entity === 'identifier-rules') return item.next_preview || item.counter_key || 'Counter chưa có';
  return 'Mapping';
}

function getRiskLabel(item = {}, entity) {
  if (item.quality_flags?.length) return item.quality_flags[0].replace(/_/g, ' ');
  if (entity === 'services' && item.is_billable) return 'billable';
  if (entity === 'medications' && (item.high_alert_medication || item.controlled_drug || item.is_controlled_drug)) return 'high-alert';
  if (entity === 'suppliers') return item.risk_level || 'low';
  if (entity === 'imaging-equipment') return item.status === 'available' ? 'ready' : item.status;
  if (entity === 'report-templates' && item.is_default) return 'default';
  return 'normal';
}

function MetricCard({ icon: Icon, label, value, hint, tone = 'default' }) {
  return (
    <article className={`master-data-pro-metric master-data-pro-metric--${tone}`}>
      <span aria-hidden="true">
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {hint ? <em>{hint}</em> : null}
      </div>
    </article>
  );
}

function StatusBadge({ value }) {
  const normalized = String(value || 'unknown').toLowerCase();
  const tone = ['active', 'available', 'success'].includes(normalized)
    ? 'success'
    : ['retired', 'deprecated', 'inactive', 'cancelled', 'blocked', 'out_of_service'].includes(normalized)
      ? 'danger'
      : ['draft', 'pending', 'maintenance', 'hard_coded'].includes(normalized)
        ? 'warning'
        : 'default';
  return <span className={`master-data-pro-badge master-data-pro-badge--${tone}`}>{String(value || 'unknown')}</span>;
}

function QualityFlag({ value }) {
  return <span className="master-data-pro-flag">{String(value || 'quality').replace(/_/g, ' ')}</span>;
}

function Header({ meta, onRefresh, onRunQuality, isLoading }) {
  const Icon = meta.icon || Database;

  return (
    <header className="master-data-pro-hero">
      <div className="master-data-pro-hero__icon" aria-hidden="true">
        <Icon size={28} strokeWidth={2.2} />
      </div>
      <div className="master-data-pro-hero__copy">
        <span>{meta.eyebrow}</span>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      <div className="master-data-pro-hero__actions">
        <button type="button" onClick={onRunQuality} disabled={isLoading}>
          <Sparkles size={16} strokeWidth={2.25} />
          <span>Quality check</span>
        </button>
        <button type="button" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw size={16} strokeWidth={2.25} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
}

function OverviewView({ overview, quality }) {
  const summary = overview?.summary || {};
  const domains = overview?.domains || quality?.domains || [];
  const issueBoard = overview?.issue_board || {};
  const graph = overview?.dependency_graph || {};

  return (
    <>
      <section className="master-data-pro-metrics">
        <MetricCard icon={Database} label="Tổng dữ liệu nền" value={formatNumber(summary.total_entities)} hint="core records" tone="blue" />
        <MetricCard icon={CheckCircle2} label="Active records" value={formatNumber(summary.active_records)} hint="đang vận hành" tone="green" />
        <MetricCard icon={Gauge} label="Quality score" value={`${summary.data_quality_score || quality?.score || 0}%`} hint="weighted readiness" tone="cyan" />
        <MetricCard icon={AlertTriangle} label="Critical issues" value={formatNumber(summary.critical_issues || quality?.summary?.critical)} hint="cần xử lý" tone="red" />
        <MetricCard icon={FileClock} label="Changes 24h" value={formatNumber(summary.changes_24h)} hint="audit stream" tone="amber" />
        <MetricCard icon={GitBranch} label="Pending approvals" value={formatNumber(summary.pending_approvals)} hint="price/change" tone="violet" />
      </section>

      <section className="master-data-pro-domain-grid">
        {domains.map((domain) => (
          <article key={domain.domain} className={`master-data-pro-domain master-data-pro-domain--${DOMAIN_TONE[domain.domain] || 'slate'}`}>
            <div>
              <span>{domain.label}</span>
              <strong>{domain.score}%</strong>
            </div>
            <div className="master-data-pro-progress" aria-hidden="true">
              <span style={{ width: `${Math.max(Math.min(domain.score || 0, 100), 0)}%` }} />
            </div>
            <dl>
              {Object.entries(domain.summary || {}).slice(0, 6).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replace(/_/g, ' ')}</dt>
                  <dd>{formatNumber(value)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>

      <section className="master-data-pro-grid">
        <IssueBoard title="Critical" items={issueBoard.critical || []} tone="critical" />
        <IssueBoard title="Warning" items={issueBoard.warning || []} tone="warning" />
        <IssueBoard title="Info" items={issueBoard.info || []} tone="info" />
      </section>

      <section className="master-data-pro-panel">
        <div className="master-data-pro-panel__head">
          <div>
            <span>Dependency map</span>
            <strong>Dữ liệu nền liên kết liên module</strong>
          </div>
          <span className="master-data-pro-panel__count">{formatNumber(graph.edges?.length)} relations</span>
        </div>
        <div className="master-data-pro-graph">
          {(graph.edges || []).slice(0, 14).map((edge) => (
            <div key={`${edge.from}-${edge.to}-${edge.relation}`}>
              <span>{edge.from}</span>
              <ChevronRight size={14} strokeWidth={2.35} />
              <strong>{edge.to}</strong>
              <em>{edge.relation}</em>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function IssueBoard({ title, items, tone }) {
  return (
    <article className={`master-data-pro-issues master-data-pro-issues--${tone}`}>
      <div className="master-data-pro-issues__head">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      {items.length ? (
        items.slice(0, 6).map((item, index) => (
          <div key={`${item.domain}-${item.entity}-${item.title}-${index}`} className="master-data-pro-issue">
            <span>{item.domain}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
        ))
      ) : (
        <div className="master-data-pro-empty-mini">Không có vấn đề</div>
      )}
    </article>
  );
}

function QualityView({ quality }) {
  const domains = quality?.domains || [];
  const issues = quality?.issues || [];

  return (
    <>
      <section className="master-data-pro-metrics">
        <MetricCard icon={Gauge} label="Quality score" value={`${quality?.score || 0}%`} hint="toàn bộ Master Data" tone="cyan" />
        <MetricCard icon={AlertTriangle} label="Critical" value={formatNumber(quality?.summary?.critical)} hint="blocker" tone="red" />
        <MetricCard icon={ShieldAlert} label="Warning" value={formatNumber(quality?.summary?.warning)} hint="cần xử lý" tone="amber" />
        <MetricCard icon={CheckCircle2} label="Domains" value={formatNumber(quality?.summary?.domains)} hint="đang scan" tone="blue" />
      </section>

      <section className="master-data-pro-quality">
        {domains.map((domain) => (
          <article key={domain.domain}>
            <div>
              <strong>{domain.label}</strong>
              <span>{domain.score}%</span>
            </div>
            <div className="master-data-pro-progress">
              <span style={{ width: `${domain.score}%` }} />
            </div>
            <ul>
              {domain.issues.slice(0, 4).map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <StatusBadge value={item.severity} />
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="master-data-pro-panel">
        <div className="master-data-pro-panel__head">
          <div>
            <span>Issue board</span>
            <strong>Các lỗi dữ liệu nền đang ảnh hưởng vận hành</strong>
          </div>
          <span className="master-data-pro-panel__count">{formatNumber(issues.length)} issues</span>
        </div>
        <div className="master-data-pro-issue-table">
          {issues.map((item, index) => (
            <div key={`${item.domain}-${item.entity}-${item.title}-${index}`}>
              <StatusBadge value={SEVERITY_LABEL[item.severity] || item.severity} />
              <strong>{item.title}</strong>
              <span>{item.domain} · {item.entity}</span>
              <p>{item.detail}</p>
              <em>{item.suggested_action}</em>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function EntityView({ config, data, selectedItem, setSelectedItem, searchTerm, setSearchTerm, statusFilter, setStatusFilter, onApplyFilters, isLoading }) {
  const entity = config.entity;
  const items = data?.items || [];
  const summary = data?.summary || {};
  const meta = data?.meta || {};

  return (
    <>
      <section className="master-data-pro-metrics master-data-pro-metrics--compact">
        <MetricCard icon={Database} label="Tổng bản ghi" value={formatNumber(summary.total)} hint={`${formatNumber(summary.filtered_total ?? summary.total)} đang lọc`} tone="blue" />
        <MetricCard icon={CheckCircle2} label="Active" value={formatNumber(summary.active)} hint="sẵn sàng dùng" tone="green" />
        <MetricCard icon={Archive} label="Inactive / retired" value={formatNumber((summary.inactive || 0) + (summary.retired || 0))} hint="không vận hành" tone="slate" />
        <MetricCard icon={AlertTriangle} label="Cảnh báo" value={formatNumber(summary.warning_items)} hint="quality flags" tone="amber" />
      </section>

      <section className="master-data-pro-commandbar">
        <label>
          <Search size={16} strokeWidth={2.25} />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onApplyFilters();
            }}
            placeholder="Tìm mã, tên, loại, mapping..."
          />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="retired">Retired</option>
          <option value="deprecated">Deprecated</option>
          <option value="draft">Draft</option>
          <option value="blocked">Blocked</option>
        </select>
        <button type="button" className="staff-button staff-button--primary" onClick={onApplyFilters} disabled={isLoading}>
          Áp dụng
        </button>
        <div className="master-data-pro-commandbar__chips">
          {(ENTITY_ACTIONS[entity] || ['Create', 'Export', 'Audit']).map((action) => (
            <span key={action}>{action}</span>
          ))}
        </div>
      </section>

      <section className="master-data-pro-entity-layout">
        <div className="master-data-pro-panel master-data-pro-table-panel">
          <div className="master-data-pro-panel__head">
            <div>
              <span>{meta.domain || 'master-data'}</span>
              <strong>{meta.title || config.title}</strong>
            </div>
            <span className="master-data-pro-panel__count">{meta.backend_status || 'available'}</span>
          </div>
          <div className="master-data-pro-table">
            <div className="master-data-pro-table__head">
              <span>Định danh</span>
              <span>Mapping / cấu hình</span>
              <span>Trạng thái</span>
              <span>Risk / quality</span>
              <span>Cập nhật</span>
            </div>
            {items.length ? items.map((item) => (
              <button
                type="button"
                key={getItemId(item)}
                className={`master-data-pro-row${getItemId(selectedItem) === getItemId(item) ? ' is-selected' : ''}`}
                onClick={() => setSelectedItem(item)}
              >
                <span className="master-data-pro-row__identity">
                  <strong>{getCode(item)}</strong>
                  <em>{getName(item)}</em>
                  <small>{getSecondary(item)}</small>
                </span>
                <span>{getMappingLabel(item, entity)}</span>
                <span><StatusBadge value={getStatus(item)} /></span>
                <span className="master-data-pro-row__flags">
                  {item.quality_flags?.length ? item.quality_flags.slice(0, 2).map((flag) => <QualityFlag key={flag} value={flag} />) : <QualityFlag value={getRiskLabel(item, entity)} />}
                </span>
                <span>{formatDate(item.updated_at || item.created_at || item.published_at || item.effective_from)}</span>
              </button>
            )) : (
              <div className="master-data-pro-empty">Không có dữ liệu phù hợp bộ lọc hiện tại.</div>
            )}
          </div>
        </div>

        <DetailDrawer item={selectedItem || items[0]} entity={entity} meta={meta} />
      </section>
    </>
  );
}

function DetailDrawer({ item, entity, meta }) {
  if (!item) {
    return (
      <aside className="master-data-pro-drawer">
        <div className="master-data-pro-empty">Chọn một bản ghi để xem chi tiết.</div>
      </aside>
    );
  }

  return (
    <aside className="master-data-pro-drawer">
      <div className="master-data-pro-drawer__head">
        <span>{getCode(item)}</span>
        <strong>{getName(item)}</strong>
        <StatusBadge value={getStatus(item)} />
      </div>

      <div className="master-data-pro-drawer__section">
        <span>Tổng quan</span>
        <dl>
          <div><dt>Domain</dt><dd>{meta.domain || 'master-data'}</dd></div>
          <div><dt>Mapping</dt><dd>{getMappingLabel(item, entity)}</dd></div>
          <div><dt>Risk</dt><dd>{getRiskLabel(item, entity)}</dd></div>
          <div><dt>Created</dt><dd>{formatDate(item.created_at)}</dd></div>
          <div><dt>Updated</dt><dd>{formatDate(item.updated_at)}</dd></div>
        </dl>
      </div>

      <div className="master-data-pro-drawer__section">
        <span>Quality flags</span>
        <div className="master-data-pro-drawer__flags">
          {item.quality_flags?.length ? item.quality_flags.map((flag) => <QualityFlag key={flag} value={flag} />) : <QualityFlag value="ready" />}
        </div>
      </div>

      <div className="master-data-pro-drawer__section">
        <span>Thông tin nghiệp vụ</span>
        <dl>
          {[
            ['Giá', item.unit_price !== undefined ? formatCurrency(item.unit_price, item.currency || 'VND') : null],
            ['Hiệu lực từ', item.effective_from ? formatDate(item.effective_from) : null],
            ['Hiệu lực đến', item.effective_to ? formatDate(item.effective_to) : null],
            ['Billable', item.is_billable !== undefined ? (item.is_billable ? 'Có' : 'Không') : null],
            ['High alert', item.high_alert_medication ? 'Có' : null],
            ['Controlled', item.controlled_drug || item.is_controlled_drug ? 'Có' : null],
            ['Sections', item.sections ? formatNumber(item.sections.length) : null],
            ['Result items', item.result_items ? formatNumber(item.result_items.length) : null],
            ['Reference ranges', item.reference_ranges ? formatNumber(item.reference_ranges.length) : null],
            ['Counter', item.counter_seq !== undefined ? formatNumber(item.counter_seq) : null],
          ].filter(([, value]) => value !== null && value !== undefined).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
          ))}
        </dl>
      </div>

      <div className="master-data-pro-drawer__section">
        <span>Raw JSON</span>
        <pre>{JSON.stringify(item, null, 2)}</pre>
      </div>
    </aside>
  );
}

function AuditView({ recentChanges }) {
  const items = recentChanges?.items || [];
  return (
    <section className="master-data-pro-panel">
      <div className="master-data-pro-panel__head">
        <div>
          <span>Audit stream</span>
          <strong>Thay đổi Master Data gần đây</strong>
        </div>
        <span className="master-data-pro-panel__count">{formatNumber(items.length)} events</span>
      </div>
      <div className="master-data-pro-audit">
        {items.map((item) => (
          <article key={item.id || `${item.action}-${item.time}`}>
            <span>{formatDate(item.time)}</span>
            <strong>{item.action}</strong>
            <em>{item.target_type || item.module_key || 'master_data'}</em>
            <p>{item.message || item.request_id || item.ip_address || 'Không có mô tả'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlaceholderOpsView({ type, overview }) {
  const flows = type === 'importExport'
    ? ['Chọn entity', 'Upload CSV/XLSX/JSON', 'Map columns', 'Validate', 'Dry-run impact', 'Commit import', 'Audit result']
    : ['Tạo change request', 'Diff before/after', 'Impact preview', 'Approve/Reject', 'Schedule apply', 'Apply now', 'Audit'];
  const backend = type === 'importExport'
    ? ['MasterDataImportJob model', 'Validate endpoint', 'Commit endpoint', 'Export endpoint']
    : ['ApprovalRequest integration', 'Entity diff builder', 'Impact-before-change', 'Scheduled apply worker'];

  return (
    <section className="master-data-pro-placeholder">
      <article>
        <span>{type === 'importExport' ? 'Bulk Data Ops' : 'Approval Workflow'}</span>
        <strong>{type === 'importExport' ? 'Import / Export framework' : 'Change requests cho Master Data'}</strong>
        <p>UI đã đặt trong control-plane để đồng bộ navigation và readiness. Backend facade hiện trả quality, dependency, audit và entity list; các mutation có kiểm duyệt nên tách thành workflow riêng.</p>
        <div>
          {flows.map((flow, index) => (
            <span key={flow}>{index + 1}. {flow}</span>
          ))}
        </div>
      </article>
      <article>
        <span>Backend cần bổ sung</span>
        <strong>Production write path</strong>
        <ul>
          {backend.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </article>
      <article>
        <span>Current signal</span>
        <strong>{overview?.summary?.data_quality_score || 0}% quality</strong>
        <p>{formatNumber(overview?.summary?.critical_issues)} critical · {formatNumber(overview?.summary?.warning_issues)} warning · {formatNumber(overview?.summary?.changes_24h)} changes 24h</p>
      </article>
    </section>
  );
}

export function MasterDataControlPlanePage({ view = 'overview' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.overview;
  const [overview, setOverview] = useState(null);
  const [quality, setQuality] = useState(null);
  const [entityData, setEntityData] = useState(null);
  const [recentChanges, setRecentChanges] = useState(null);
  const [dependencyGraph, setDependencyGraph] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedStatusFilter, setAppliedStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const entity = config.entity;
  const entityQuery = useMemo(() => {
    const params = new URLSearchParams({ limit: '80' });
    if (appliedSearchTerm.trim()) params.set('search', appliedSearchTerm.trim());
    if (appliedStatusFilter) params.set('status', appliedStatusFilter);
    return params.toString();
  }, [appliedSearchTerm, appliedStatusFilter]);

  function applyEntityFilters() {
    setAppliedSearchTerm(searchTerm);
    setAppliedStatusFilter(statusFilter);
  }

  async function loadData() {
    setIsLoading(true);
    setError('');
    try {
      if (view === 'overview') {
        const [overviewData, qualityData, graphData] = await Promise.all([
          getMasterDataOverview(),
          getMasterDataQualityDashboard(),
          getMasterDataDependencyGraph(),
        ]);
        setOverview(overviewData);
        setQuality(qualityData);
        setDependencyGraph(graphData);
        setEntityData(null);
      } else if (view === 'quality') {
        const qualityData = await getMasterDataQualityDashboard();
        setQuality(qualityData);
        setEntityData(null);
      } else if (view === 'audit') {
        const changes = await getMasterDataRecentChanges('limit=60');
        setRecentChanges(changes);
        setEntityData(null);
      } else if (entity) {
        const [data, qualityData] = await Promise.all([
          listMasterDataEntity(entity, entityQuery),
          getMasterDataQualityDashboard(),
        ]);
        setEntityData(data);
        setQuality(qualityData);
        setSelectedItem(data.items?.[0] || null);
      } else {
        const overviewData = await getMasterDataOverview();
        setOverview(overviewData);
        setEntityData(null);
      }
    } catch (loadError) {
      setError(loadError.message || 'Không thể tải Master Data.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, entityQuery]);

  async function handleRunQuality() {
    setIsLoading(true);
    setError('');
    try {
      const result = await runMasterDataQualityCheck();
      setQuality(result);
      if (view === 'overview') {
        const overviewData = await getMasterDataOverview();
        setOverview(overviewData);
      }
    } catch (runError) {
      setError(runError.message || 'Không thể chạy quality check.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="master-data-pro">
      <Header meta={config} onRefresh={loadData} onRunQuality={handleRunQuality} isLoading={isLoading} />

      {error ? (
        <div className="master-data-pro-error">
          <AlertTriangle size={18} strokeWidth={2.25} />
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="master-data-pro-loading">
          <RefreshCw size={22} strokeWidth={2.25} />
          <span>Đang tải Master Data...</span>
        </div>
      ) : null}

      {!isLoading && view === 'overview' ? <OverviewView overview={overview} quality={quality} dependencyGraph={dependencyGraph} /> : null}
      {!isLoading && view === 'quality' ? <QualityView quality={quality} /> : null}
      {!isLoading && entity ? (
        <EntityView
          config={config}
          data={entityData}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onApplyFilters={applyEntityFilters}
          isLoading={isLoading}
        />
      ) : null}
      {!isLoading && view === 'audit' ? <AuditView recentChanges={recentChanges} /> : null}
      {!isLoading && ['importExport', 'changeRequests'].includes(view) ? <PlaceholderOpsView type={view} overview={overview} /> : null}
    </main>
  );
}
