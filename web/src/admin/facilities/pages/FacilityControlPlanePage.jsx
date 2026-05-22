import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bed,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Database,
  DoorOpen,
  Eye,
  FlaskConical,
  Gauge,
  Hospital,
  MapPin,
  MonitorCheck,
  PackageCheck,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Store,
  TestTube2,
  UserCheck,
  UsersRound,
  Workflow,
} from 'lucide-react';
import {
  getFacilityDepartmentOperationsBoard,
  getFacilityDepartmentOperationalProfile,
  getFacilityOperationalStatus,
  getFacilityOverview,
  getFacilityResourceBoard,
  updateDepartmentStatus,
} from '../../system/systemApi';
import {
  formatCompactDate,
  formatNumber,
  getDepartmentTypeLabel,
  getInitials,
} from '../../system/systemUi';

const VIEW_META = {
  overview: {
    title: 'Tổng quan khoa phòng',
    eyebrow: 'Facility Control Plane',
    description: 'Giám sát cấu trúc khoa/phòng, địa điểm, phòng, giường, CĐHA, kho, service binding và cảnh báo vận hành.',
    icon: Gauge,
  },
  departments: {
    title: 'Danh sách khoa phòng',
    eyebrow: 'Department Operations Board',
    description: 'Registry khoa/phòng với head, staff, lịch, hẹn, queue, rooms, dependencies và can-deactivate.',
    icon: Building2,
  },
  heads: {
    title: 'Trưởng khoa',
    eyebrow: 'Department Ownership',
    description: 'Theo dõi khoa đã có trưởng khoa, thiếu trưởng khoa, trưởng khoa inactive và cảnh báo bổ nhiệm.',
    icon: UserCheck,
  },
  staff: {
    title: 'Nhân sự theo khoa',
    eyebrow: 'Department Workforce Matrix',
    description: 'Phân tích lực lượng nhân sự theo khoa, tài khoản active/locked, role vận hành và risk tài khoản.',
    icon: UsersRound,
  },
  profile: {
    title: 'Tổng quan khoa',
    eyebrow: 'Department Command Profile',
    description: 'Hồ sơ vận hành 360 độ cho từng khoa: nhân sự, địa điểm, phòng, dịch vụ, kho, warning và dependencies.',
    icon: Workflow,
  },
  locations: {
    title: 'Phòng khám / địa điểm',
    eyebrow: 'Facility Location Registry',
    description: 'Quản lý địa điểm clinic, reception, lab, imaging, procedure, pharmacy và public directory readiness.',
    icon: MapPin,
  },
  reception: {
    title: 'Khu vực tiếp nhận',
    eyebrow: 'Reception Operations',
    description: 'Bảng vận hành tiếp nhận dựa trên queue hiện có, khoa có tải chờ cao và tình trạng check-in.',
    icon: ClipboardList,
  },
  lab: {
    title: 'Phòng xét nghiệm',
    eyebrow: 'Laboratory Facility',
    description: 'Tổng hợp cấu hình lab hiện có: lab tests, specimen types, SLA rules, địa điểm lab và binding dịch vụ.',
    icon: TestTube2,
  },
  imaging: {
    title: 'Phòng CĐHA',
    eyebrow: 'Imaging Operations',
    description: 'Quản trị phòng CĐHA, thiết bị, modality, maintenance status và cảnh báo thiết bị.',
    icon: MonitorCheck,
  },
  procedure: {
    title: 'Phòng thủ thuật',
    eyebrow: 'Procedure Readiness',
    description: 'Theo dõi danh mục thủ thuật, allowed locations, checklist/service binding và readiness vận hành.',
    icon: Stethoscope,
  },
  warehouse: {
    title: 'Kho / nhà thuốc',
    eyebrow: 'Warehouse & Storage Control',
    description: 'Quản lý warehouse, storage location tree, locked locations, cold chain và quarantine/recall zones.',
    icon: Store,
  },
  status: {
    title: 'Trạng thái hoạt động',
    eyebrow: 'Facility Health Board',
    description: 'Health score, operational heatmap, blockers, warnings và trạng thái các nguồn lực vận hành.',
    icon: Activity,
  },
  bindings: {
    title: 'Cấu hình địa điểm dịch vụ',
    eyebrow: 'Service Location Binding',
    description: 'Liên kết Department -> Location/Room -> ServiceCatalog -> Queue/Schedule/Billing readiness.',
    icon: Settings,
  },
};

function riskTone(severity) {
  if (['critical', 'high'].includes(severity)) return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}

function FacilityHero({ view, onRefresh, loading }) {
  const meta = VIEW_META[view] || VIEW_META.overview;
  const Icon = meta.icon;
  return (
    <section className="facility-pro-hero">
      <div className="facility-pro-hero__icon"><Icon size={26} strokeWidth={2.25} /></div>
      <div>
        <span>{meta.eyebrow}</span>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      <div className="facility-pro-hero__actions">
        <button type="button" className="staff-button staff-button--ghost" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} /> Làm mới
        </button>
        <Link to="/admin/departments/create" className="staff-button staff-button--primary">
          <Sparkles size={16} /> Tạo khoa phòng
        </Link>
      </div>
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone = 'blue' }) {
  return (
    <article className={`facility-pro-metric facility-pro-metric--${tone}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function StatusBadge({ status }) {
  return <span className={`facility-pro-status facility-pro-status--${status || 'unknown'}`}>{status || 'unknown'}</span>;
}

function RiskBadge({ value }) {
  return <span className={`facility-pro-risk facility-pro-risk--${riskTone(value)}`}>{value}</span>;
}

function DepartmentDrawer({ department, profile, onOpen }) {
  if (!department) {
    return (
      <aside className="facility-pro-drawer facility-pro-drawer--empty">
        <Hospital size={30} />
        <strong>Chọn một khoa/phòng</strong>
        <p>Drawer sẽ hiển thị head, dependency, staff, phòng, địa điểm, service binding và warning.</p>
      </aside>
    );
  }

  return (
    <aside className="facility-pro-drawer">
      <div className="facility-pro-drawer__head">
        <span>{department.department_code}</span>
        <h2>{department.department_name}</h2>
        <StatusBadge status={department.status} />
      </div>
      <div className="facility-pro-drawer__grid">
        <div><span>Staff active</span><strong>{formatNumber(department.staff?.active)}</strong></div>
        <div><span>Doctors</span><strong>{formatNumber(department.doctors_count)}</strong></div>
        <div><span>Queue</span><strong>{formatNumber(department.queue_waiting)}</strong></div>
        <div><span>Score</span><strong>{formatNumber(department.config_score)}</strong></div>
      </div>
      <section className="facility-pro-head-card">
        <strong>Trưởng khoa</strong>
        {department.head ? (
          <div>
            <i>{getInitials(department.head.full_name || department.head.username)}</i>
            <span>{department.head.full_name || department.head.username}<small>{department.head.email || department.head.status}</small></span>
          </div>
        ) : <p>Chưa gán trưởng khoa.</p>}
      </section>
      <section className="facility-pro-risk-list">
        {(department.risk_badges || []).length ? department.risk_badges.map((badge) => <RiskBadge key={badge} value={badge} />) : <RiskBadge value="ok" />}
      </section>
      <section className="facility-pro-resource-mini">
        <div><DoorOpen size={16} /><span>Rooms</span><strong>{formatNumber(department.rooms_count)}</strong></div>
        <div><Bed size={16} /><span>Beds</span><strong>{formatNumber(department.beds_count)}</strong></div>
        <div><MapPin size={16} /><span>Locations</span><strong>{formatNumber(department.locations_count)}</strong></div>
        <div><PackageCheck size={16} /><span>Services</span><strong>{formatNumber(department.services_count)}</strong></div>
      </section>
      {profile ? (
        <section className="facility-pro-profile-mini">
          <strong>Operational profile</strong>
          <span>{formatNumber(profile.staff?.length)} staff loaded</span>
          <span>{formatNumber(profile.service_bindings?.length)} service bindings</span>
          <span>{formatNumber(profile.warehouses?.length)} warehouses</span>
        </section>
      ) : null}
      <button type="button" className="staff-button staff-button--primary" onClick={() => onOpen(department.department_id)}>
        Mở hồ sơ khoa
      </button>
    </aside>
  );
}

function DepartmentOperationsTable({ departments, onSelect, selectedId, onOpen, onToggleStatus }) {
  return (
    <section className="facility-pro-table">
      <div className="facility-pro-table__head facility-pro-table__head--departments">
        <span>Khoa phòng</span><span>Head</span><span>Staff</span><span>Schedule</span><span>Resources</span><span>Risk</span><span>Actions</span>
      </div>
      {departments.map((item) => (
        <div key={item.department_id} className={`facility-pro-table__row facility-pro-table__row--departments ${selectedId === item.department_id ? 'is-selected' : ''}`} onClick={() => onSelect(item.department_id)}>
          <span className="facility-pro-dept-cell">
            <i>{item.department_code?.slice(0, 2)}</i>
            <span>
              <strong>{item.department_name}</strong>
              <small>{item.department_code} · {getDepartmentTypeLabel(item.department_type)} · {item.location_note || 'Chưa có ghi chú vị trí'}</small>
            </span>
          </span>
          <span>{item.head ? <><strong>{item.head.full_name || item.head.username}</strong><small>{item.head.status}</small></> : <RiskBadge value="missing_head" />}</span>
          <span><strong>{formatNumber(item.staff?.active)}/{formatNumber(item.staff?.total)}</strong><small>{formatNumber(item.doctors_count)} bác sĩ</small></span>
          <span><strong>{formatNumber(item.appointments_today)} hôm nay</strong><small>{formatNumber(item.future_schedules_count + item.future_appointments_count)} tương lai</small></span>
          <span><strong>{formatNumber(item.rooms_count)} phòng · {formatNumber(item.beds_count)} giường</strong><small>{formatNumber(item.locations_count)} location · {formatNumber(item.services_count)} service</small></span>
          <span className="facility-pro-risk-inline">{(item.risk_badges || []).slice(0, 3).map((badge) => <RiskBadge key={badge} value={badge} />)}</span>
          <span className="facility-pro-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" title="Hồ sơ khoa" onClick={() => onOpen(item.department_id)}><Eye size={15} /></button>
            <button type="button" title="Đổi trạng thái" onClick={() => onToggleStatus(item)}><Activity size={15} /></button>
          </span>
        </div>
      ))}
    </section>
  );
}

function OverviewView({ overview, board, status, onSelect, selectedId, onOpen, onToggleStatus }) {
  const summary = overview?.summary || board?.summary || {};
  return (
    <>
      <section className="facility-pro-metrics">
        <MetricCard icon={Gauge} label="Health score" value={summary.health_score || status?.health_score || 0} note="facility health" tone="green" />
        <MetricCard icon={Building2} label="Khoa active" value={summary.active || 0} note={`${formatNumber(summary.total)} total`} />
        <MetricCard icon={ShieldAlert} label="Blocked" value={summary.blocked_deactivation || 0} note="cannot deactivate" tone="red" />
        <MetricCard icon={MapPin} label="Locations" value={summary.locations || 0} tone="cyan" />
        <MetricCard icon={DoorOpen} label="Rooms" value={summary.rooms || 0} tone="violet" />
        <MetricCard icon={Store} label="Warehouses" value={summary.warehouses || 0} tone="amber" />
      </section>
      <section className="facility-pro-grid-two">
        <section className="facility-pro-panel">
          <div className="facility-pro-panel__head"><h2>Top cảnh báo vận hành</h2><span>{formatNumber(overview?.warnings?.length || 0)}</span></div>
          <div className="facility-pro-warning-list">
            {(overview?.warnings || []).slice(0, 10).map((warning, index) => (
              <article key={`${warning.resource_id}-${index}`}>
                <RiskBadge value={warning.severity} />
                <strong>{warning.title}</strong>
                <p>{warning.message}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="facility-pro-panel">
          <div className="facility-pro-panel__head"><h2>Operational heatmap</h2><span>live</span></div>
          <FacilityHeatmap heatmap={overview?.heatmap || status?.heatmap || []} compact />
        </section>
      </section>
      <DepartmentOperationsTable departments={(board?.items || []).slice(0, 12)} onSelect={onSelect} selectedId={selectedId} onOpen={onOpen} onToggleStatus={onToggleStatus} />
    </>
  );
}

function FacilityHeatmap({ heatmap = [], compact = false }) {
  const columns = ['head', 'staff', 'schedule', 'appointment', 'queue', 'location', 'room', 'bed', 'service', 'warehouse'];
  return (
    <div className={`facility-pro-heatmap ${compact ? 'facility-pro-heatmap--compact' : ''}`}>
      <div className="facility-pro-heatmap__row facility-pro-heatmap__head">
        <span>Department</span>
        {columns.map((column) => <b key={column}>{column}</b>)}
      </div>
      {heatmap.map((row) => (
        <div key={row.department_id} className="facility-pro-heatmap__row">
          <span><strong>{row.department_code}</strong><small>{row.department_name}</small></span>
          {columns.map((column) => <i key={column} className={`is-${row.cells?.[column] || 'info'}`} title={`${column}: ${row.cells?.[column] || 'info'}`} />)}
        </div>
      ))}
    </div>
  );
}

function HeadsView({ departments, onSelect, selectedId, onOpen, onToggleStatus }) {
  const missing = departments.filter((item) => !item.head);
  const withHead = departments.filter((item) => item.head);
  return (
    <>
      <section className="facility-pro-metrics">
        <MetricCard icon={Building2} label="Tổng khoa" value={departments.length} />
        <MetricCard icon={UserCheck} label="Đã có head" value={withHead.length} tone="green" />
        <MetricCard icon={AlertTriangle} label="Thiếu head" value={missing.length} tone="red" />
        <MetricCard icon={ShieldAlert} label="Head inactive" value={withHead.filter((item) => item.head?.status !== 'active').length} tone="amber" />
      </section>
      <DepartmentOperationsTable departments={[...missing, ...withHead]} onSelect={onSelect} selectedId={selectedId} onOpen={onOpen} onToggleStatus={onToggleStatus} />
    </>
  );
}

function StaffView({ departments, profile, selectedDepartmentId, setSelectedDepartmentId, onOpen }) {
  const selected = departments.find((item) => item.department_id === selectedDepartmentId) || departments[0];
  return (
    <section className="facility-pro-workforce">
      <aside className="facility-pro-workforce__nav">
        {departments.map((department) => (
          <button key={department.department_id} type="button" className={selected?.department_id === department.department_id ? 'is-active' : ''} onClick={() => setSelectedDepartmentId(department.department_id)}>
            <strong>{department.department_name}</strong>
            <span>{formatNumber(department.staff?.active)}/{formatNumber(department.staff?.total)} active</span>
          </button>
        ))}
      </aside>
      <main className="facility-pro-panel">
        <div className="facility-pro-panel__head">
          <h2>{selected?.department_name || 'Nhân sự theo khoa'}</h2>
          <button type="button" className="staff-button staff-button--ghost" onClick={() => selected && onOpen(selected.department_id)}>Mở hồ sơ khoa</button>
        </div>
        <section className="facility-pro-metrics facility-pro-metrics--compact">
          <MetricCard icon={UsersRound} label="Total staff" value={selected?.staff?.total || 0} />
          <MetricCard icon={CheckCircle2} label="Active" value={selected?.staff?.active || 0} tone="green" />
          <MetricCard icon={ShieldAlert} label="Locked" value={selected?.staff?.locked || 0} tone="red" />
          <MetricCard icon={Stethoscope} label="Doctors" value={selected?.doctors_count || 0} tone="violet" />
        </section>
        <div className="facility-pro-mini-table">
          {(profile?.staff || []).map((user) => (
            <div key={user.user_id}>
              <span className="facility-pro-avatar">{getInitials(user.full_name || user.username)}</span>
              <strong>{user.full_name || user.username}</strong>
              <small>{user.email || user.employee_code}</small>
              <StatusBadge status={user.status} />
              <Link to={`/admin/staff/${user.user_id}`}>Staff 360</Link>
            </div>
          ))}
          {profile && !profile.staff?.length ? <p className="facility-pro-empty-text">Khoa này chưa có nhân sự trong dữ liệu trả về.</p> : null}
        </div>
      </main>
    </section>
  );
}

function ProfileView({ departments, profile, selectedDepartmentId, setSelectedDepartmentId }) {
  const selected = departments.find((item) => item.department_id === selectedDepartmentId) || departments[0];
  return (
    <section className="facility-pro-profile">
      <aside className="facility-pro-profile__selector">
        {departments.map((department) => (
          <button key={department.department_id} type="button" className={selected?.department_id === department.department_id ? 'is-active' : ''} onClick={() => setSelectedDepartmentId(department.department_id)}>
            <strong>{department.department_code}</strong>
            <span>{department.department_name}</span>
          </button>
        ))}
      </aside>
      <main className="facility-pro-profile__main">
        <section className="facility-pro-profile-hero">
          <div>
            <span>{selected?.department_code}</span>
            <h2>{selected?.department_name}</h2>
            <p>{getDepartmentTypeLabel(selected?.department_type)} · {selected?.location_note || 'Chưa cấu hình vị trí'}</p>
          </div>
          <StatusBadge status={selected?.status} />
        </section>
        <section className="facility-pro-map">
          {[
            ['Head', selected?.head?.full_name || 'Chưa gán', UserCheck],
            ['Staff', `${formatNumber(selected?.staff?.total)} nhân sự`, UsersRound],
            ['Locations', `${formatNumber(profile?.facility_locations?.length || selected?.locations_count)} địa điểm`, MapPin],
            ['Rooms', `${formatNumber(profile?.rooms?.length || selected?.rooms_count)} phòng`, DoorOpen],
            ['Services', `${formatNumber(profile?.service_bindings?.length || selected?.services_count)} dịch vụ`, PackageCheck],
            ['Warehouses', `${formatNumber(profile?.warehouses?.length || selected?.warehouses_count)} kho`, Store],
          ].map(([label, value, Icon]) => (
            <article key={label}>
              <Icon size={18} />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>
        <ResourceList title="Địa điểm" items={profile?.facility_locations || []} primary="name" secondary="type" statusKey="status" />
        <ResourceList title="Phòng / phòng bệnh" items={profile?.rooms || []} primary="room_name" secondary="room_code" statusKey="status" />
        <ResourceList title="Dịch vụ" items={profile?.service_bindings || []} primary="service_name" secondary="service_code" statusKey="status" />
      </main>
    </section>
  );
}

function ResourceList({ title, items = [], primary, secondary, statusKey }) {
  return (
    <section className="facility-pro-resource-list">
      <div className="facility-pro-panel__head"><h2>{title}</h2><span>{formatNumber(items.length)}</span></div>
      {items.slice(0, 10).map((item, index) => (
        <div key={item.location_id || item.room_id || item.service_id || index}>
          <strong>{item[primary]}</strong>
          <small>{item[secondary] || 'N/A'}</small>
          {statusKey ? <StatusBadge status={item[statusKey]} /> : null}
        </div>
      ))}
    </section>
  );
}

function ResourceBoardView({ view, resources }) {
  if (view === 'locations') {
    return <GenericResourceBoard icon={MapPin} title="Facility locations" items={resources?.locations || []} columns={['name', 'type', 'department_name', 'status', 'public_visible']} />;
  }
  if (view === 'reception') {
    const items = (resources?.departments || []).map((department) => ({
      name: department.department_name,
      department_name: department.department_code,
      type: 'queue department',
      status: department.status,
      public_visible: 'queue-ready',
    }));
    return <GenericResourceBoard icon={ClipboardList} title="Reception areas từ queue/department" items={items} columns={['name', 'type', 'department_name', 'status', 'public_visible']} />;
  }
  if (view === 'lab') {
    const labLocations = (resources?.locations || []).filter((item) => item.type === 'lab');
    return (
      <>
        <section className="facility-pro-metrics">
          <MetricCard icon={TestTube2} label="Lab tests" value={resources?.lab?.tests_count || 0} />
          <MetricCard icon={FlaskConical} label="Specimen types" value={resources?.lab?.specimen_types_count || 0} tone="violet" />
          <MetricCard icon={Gauge} label="SLA rules" value={resources?.lab?.sla_rules_count || 0} tone="green" />
          <MetricCard icon={MapPin} label="Lab locations" value={labLocations.length} tone="cyan" />
        </section>
        <GenericResourceBoard icon={TestTube2} title="Lab locations" items={labLocations} columns={['name', 'type', 'department_name', 'status', 'public_visible']} />
      </>
    );
  }
  if (view === 'imaging') {
    return (
      <>
        <GenericResourceBoard icon={MonitorCheck} title="Imaging rooms" items={resources?.imaging_rooms || []} columns={['code', 'name', 'modality', 'maintenance_status', 'active']} />
        <GenericResourceBoard icon={Activity} title="Imaging equipment" items={resources?.imaging_equipment || []} columns={['code', 'name', 'modality', 'manufacturer', 'status']} />
      </>
    );
  }
  if (view === 'procedure') {
    return <GenericResourceBoard icon={Stethoscope} title="Procedure catalog readiness" items={resources?.procedure_rooms?.catalog || []} columns={['procedure_code', 'procedure_name', 'status', 'location_count', 'service_id']} />;
  }
  if (view === 'warehouse') {
    return (
      <>
        <GenericResourceBoard icon={Store} title="Warehouses" items={resources?.warehouses || []} columns={['warehouse_code', 'name', 'type', 'department_name', 'status']} />
        <GenericResourceBoard icon={PackageCheck} title="Storage locations" items={resources?.storage_locations || []} columns={['location_code', 'name', 'location_type', 'status', 'is_locked']} />
      </>
    );
  }
  return <GenericResourceBoard icon={Settings} title="Service bindings" items={resources?.services || []} columns={['service_code', 'service_name', 'service_type', 'department_name', 'status']} />;
}

function GenericResourceBoard({ icon: Icon, title, items = [], columns = [] }) {
  return (
    <section className="facility-pro-panel">
      <div className="facility-pro-panel__head"><h2><Icon size={18} /> {title}</h2><span>{formatNumber(items.length)}</span></div>
      <div className="facility-pro-resource-table">
        <div className="facility-pro-resource-table__head" style={{ '--facility-columns': columns.length }}>
          {columns.map((column) => <span key={column}>{column}</span>)}
        </div>
        {items.map((item, index) => (
          <div key={item.location_id || item.room_id || item.equipment_id || item.warehouse_id || item.service_id || index} className="facility-pro-resource-table__row" style={{ '--facility-columns': columns.length }}>
            {columns.map((column) => {
              const value = item[column];
              if (column.includes('status') || column === 'active') return <StatusBadge key={column} status={String(value)} />;
              return <span key={column}>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || 'N/A'}</span>;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusView({ status }) {
  return (
    <>
      <section className="facility-pro-metrics">
        <MetricCard icon={Gauge} label="Health score" value={status?.health_score || 0} tone="green" />
        <MetricCard icon={ShieldAlert} label="Critical blockers" value={status?.summary?.critical_blockers || 0} tone="red" />
        <MetricCard icon={AlertTriangle} label="Warnings" value={status?.summary?.warnings || 0} tone="amber" />
        <MetricCard icon={DoorOpen} label="Rooms active" value={status?.summary?.rooms_active || 0} tone="violet" />
        <MetricCard icon={Bed} label="Beds available" value={status?.summary?.beds_available || 0} tone="cyan" />
        <MetricCard icon={Store} label="Warehouses active" value={status?.summary?.warehouses_active || 0} tone="blue" />
      </section>
      <section className="facility-pro-grid-two">
        <section className="facility-pro-panel">
          <div className="facility-pro-panel__head"><h2>Facility heatmap</h2><span>{formatNumber(status?.heatmap?.length || 0)}</span></div>
          <FacilityHeatmap heatmap={status?.heatmap || []} />
        </section>
        <section className="facility-pro-panel">
          <div className="facility-pro-panel__head"><h2>Critical blockers</h2><span>{formatNumber(status?.critical_blockers?.length || 0)}</span></div>
          <div className="facility-pro-warning-list">
            {(status?.critical_blockers || []).map((warning, index) => (
              <article key={`${warning.resource_id}-${index}`}>
                <RiskBadge value={warning.severity} />
                <strong>{warning.title}</strong>
                <p>{warning.suggested_action}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}

export function FacilityControlPlanePage({ view = 'overview' }) {
  const navigate = useNavigate();
  const { departmentId: routeDepartmentId } = useParams();
  const [overview, setOverview] = useState(null);
  const [board, setBoard] = useState(null);
  const [resources, setResources] = useState(null);
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [overviewData, boardData, resourcesData, statusData] = await Promise.all([
        getFacilityOverview().catch(() => null),
        getFacilityDepartmentOperationsBoard(),
        getFacilityResourceBoard().catch(() => null),
        getFacilityOperationalStatus().catch(() => null),
      ]);
      setOverview(overviewData);
      setBoard(boardData);
      setResources(resourcesData);
      setStatus(statusData);
      const firstDepartmentId = routeDepartmentId || selectedDepartmentId || boardData?.items?.[0]?.department_id || '';
      setSelectedDepartmentId(firstDepartmentId);
      if (firstDepartmentId) {
        setProfile(await getFacilityDepartmentOperationalProfile(firstDepartmentId).catch(() => null));
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [routeDepartmentId]);

  useEffect(() => {
    if (!selectedDepartmentId) return;
    getFacilityDepartmentOperationalProfile(selectedDepartmentId)
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [selectedDepartmentId]);

  const departments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (board?.items || []).filter((item) => {
      if (filter === 'warning' && !item.risk_badges?.length) return false;
      if (filter === 'missing_head' && item.head) return false;
      if (filter === 'blocked' && item.can_deactivate) return false;
      if (!keyword) return true;
      return `${item.department_code} ${item.department_name} ${item.department_type}`.toLowerCase().includes(keyword);
    });
  }, [board, filter, search]);

  async function openDepartmentProfile(departmentId) {
    setSelectedDepartmentId(departmentId);
    navigate(`/admin/facilities/departments/${departmentId}`);
  }

  async function toggleDepartmentStatus(department) {
    setError('');
    try {
      await updateDepartmentStatus(department.department_id, department.status === 'active' ? 'inactive' : 'active');
      await load();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  const actualView = view === 'departmentProfile' ? 'profile' : view;

  return (
    <section className="facility-pro-page">
      <FacilityHero view={actualView} onRefresh={load} loading={loading} />
      {error ? <p className="form-message error">{error}</p> : null}
      <section className="facility-pro-commandbar">
        <label>
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khoa, mã khoa, loại khoa..." />
        </label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">Mọi trạng thái</option>
          <option value="warning">Có warning</option>
          <option value="missing_head">Thiếu trưởng khoa</option>
          <option value="blocked">Không thể deactivate</option>
        </select>
        <span>Last sync {formatCompactDate(overview?.generated_at || board?.generated_at || new Date())}</span>
      </section>
      {loading ? <div className="staff-loading-panel">Đang tải Facility Control Plane...</div> : null}
      {!loading && actualView === 'overview' ? <OverviewView overview={overview} board={board} status={status} onSelect={setSelectedDepartmentId} selectedId={selectedDepartmentId} onOpen={openDepartmentProfile} onToggleStatus={toggleDepartmentStatus} /> : null}
      {!loading && actualView === 'departments' ? (
        <section className="facility-pro-layout">
          <main>
            <section className="facility-pro-metrics">
              <MetricCard icon={Building2} label="Tổng khoa" value={board?.summary?.total || 0} />
              <MetricCard icon={CheckCircle2} label="Active" value={board?.summary?.active || 0} tone="green" />
              <MetricCard icon={AlertTriangle} label="Thiếu head" value={board?.summary?.missing_head || 0} tone="amber" />
              <MetricCard icon={ShieldAlert} label="Blocked" value={board?.summary?.blocked_deactivation || 0} tone="red" />
              <MetricCard icon={UsersRound} label="Active staff" value={board?.summary?.active_staff || 0} tone="cyan" />
              <MetricCard icon={Activity} label="Queue waiting" value={board?.summary?.queue_waiting || 0} tone="violet" />
            </section>
            <DepartmentOperationsTable departments={departments} onSelect={setSelectedDepartmentId} selectedId={selectedDepartmentId} onOpen={openDepartmentProfile} onToggleStatus={toggleDepartmentStatus} />
          </main>
          <DepartmentDrawer department={(board?.items || []).find((item) => item.department_id === selectedDepartmentId)} profile={profile} onOpen={openDepartmentProfile} />
        </section>
      ) : null}
      {!loading && actualView === 'heads' ? <HeadsView departments={departments} onSelect={setSelectedDepartmentId} selectedId={selectedDepartmentId} onOpen={openDepartmentProfile} onToggleStatus={toggleDepartmentStatus} /> : null}
      {!loading && actualView === 'staff' ? <StaffView departments={departments} profile={profile} selectedDepartmentId={selectedDepartmentId} setSelectedDepartmentId={setSelectedDepartmentId} onOpen={openDepartmentProfile} /> : null}
      {!loading && actualView === 'profile' ? <ProfileView departments={board?.items || []} profile={profile} selectedDepartmentId={selectedDepartmentId} setSelectedDepartmentId={setSelectedDepartmentId} /> : null}
      {!loading && ['locations', 'reception', 'lab', 'imaging', 'procedure', 'warehouse', 'bindings'].includes(actualView) ? <ResourceBoardView view={actualView} resources={resources} /> : null}
      {!loading && actualView === 'status' ? <StatusView status={status} /> : null}
    </section>
  );
}
