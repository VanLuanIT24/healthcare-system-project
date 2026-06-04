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
  assignDepartmentHead,
  getFacilityOverview,
  getFacilityResourceBoard,
  removeDepartmentHead,
  updateDepartmentStatus,
} from '../../system/systemApi';
import { getStaffAccounts } from '../../staff/staffApi';
import {
  formatCompactDate,
  formatNumber,
  getDepartmentTypeLabel,
  getInitials,
} from '../../system/systemUi';
import '../../staff/staffWorkforcePro.css';

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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function textValue(...values) {
  const found = values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
  return found === undefined ? '' : String(found);
}

function resourceName(item) {
  return textValue(item.name, item.location_name, item.room_name, item.service_name, item.warehouse_name, item.procedure_name, item.code, item.service_code, item.department_name) || 'Chưa đặt tên';
}

function resourceType(item) {
  return textValue(item.type, item.location_type, item.room_type, item.service_type, item.modality, item.warehouse_type, item.procedure_type) || 'resource';
}

function resourceDepartment(item) {
  return textValue(item.department_name, item.department_code, item.department?.department_name) || 'Chưa gắn khoa';
}

function userIdOf(user) {
  return user?.user_id || user?._id || user?.id || user?.account_id || '';
}

function userNameOf(user) {
  return user?.full_name || user?.display_name || user?.username || user?.email || 'Nhân sự';
}

function normalizeStatus(value) {
  if (value === true) return 'active';
  if (value === false) return 'inactive';
  return textValue(value, 'unknown').toLowerCase();
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
  const normalized = normalizeStatus(status);
  return <span className={`facility-pro-status facility-pro-status--${normalized}`}>{normalized}</span>;
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

function HeadsView({ departments, profile, selectedDepartmentId, setSelectedDepartmentId, headCandidates, onAssignHead, onRemoveHead, onOpen, assigning }) {
  const selected = departments.find((item) => item.department_id === selectedDepartmentId) || departments[0];
  const currentHeadId = selected?.head?.user_id || selected?.head_user_id || '';
  const selectedDepartmentStaff = asArray(profile?.staff);
  const candidates = selectedDepartmentStaff.length ? selectedDepartmentStaff : headCandidates;
  const validCandidates = candidates.filter((user) => normalizeStatus(user.status || 'active') === 'active');
  const [candidateId, setCandidateId] = useState('');

  useEffect(() => {
    setCandidateId(currentHeadId || '');
  }, [currentHeadId, selectedDepartmentId]);

  const missing = departments.filter((item) => !item.head);
  const withHead = departments.filter((item) => item.head);

  return (
    <section className="facility-heads-pro">
      <section className="facility-pro-metrics">
        <MetricCard icon={Building2} label="Tổng khoa" value={departments.length} />
        <MetricCard icon={UserCheck} label="Đã có head" value={withHead.length} tone="green" />
        <MetricCard icon={AlertTriangle} label="Thiếu head" value={missing.length} tone="red" />
        <MetricCard icon={ShieldAlert} label="Head inactive" value={withHead.filter((item) => normalizeStatus(item.head?.status) !== 'active').length} tone="amber" />
      </section>

      <section className="facility-heads-pro__layout">
        <aside className="facility-heads-pro__departments">
          <div className="facility-pro-panel__head"><h2>Khoa cần bổ nhiệm</h2><span>{formatNumber(departments.length)}</span></div>
          <div className="facility-heads-pro__list">
            {[...missing, ...withHead].map((department) => (
              <button key={department.department_id} type="button" className={selected?.department_id === department.department_id ? 'is-active' : ''} onClick={() => setSelectedDepartmentId(department.department_id)}>
                <strong>{department.department_code}</strong>
                <span>{department.department_name}</span>
                {department.head ? <small>{department.head.full_name || department.head.username}</small> : <RiskBadge value="missing_head" />}
              </button>
            ))}
          </div>
        </aside>

        <main className="facility-heads-pro__console">
          <section className="facility-heads-pro__hero-card">
            <div>
              <span>Department ownership</span>
              <h2>{selected?.department_name || 'Chọn khoa/phòng'}</h2>
              <p>{selected?.department_code || 'N/A'} · {getDepartmentTypeLabel(selected?.department_type)} · {selected?.location_note || 'Chưa cấu hình vị trí'}</p>
            </div>
            <StatusBadge status={selected?.status} />
          </section>

          <section className="facility-heads-pro__assign-card">
            <div className="facility-heads-pro__current">
              <span>Trưởng khoa hiện tại</span>
              {selected?.head ? (
                <div>
                  <i>{getInitials(selected.head.full_name || selected.head.username)}</i>
                  <strong>{selected.head.full_name || selected.head.username}</strong>
                  <small>{selected.head.email || selected.head.status}</small>
                </div>
              ) : (
                <p>Chưa có trưởng khoa. Hãy chọn một nhân sự active của khoa để nâng cấp/gán làm trưởng khoa.</p>
              )}
            </div>
            <label className="facility-heads-pro__picker">
              <span>Chọn nhân sự để gán trưởng khoa</span>
              <select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
                <option value="">-- Chọn nhân sự active --</option>
                {validCandidates.map((candidate) => (
                  <option key={userIdOf(candidate)} value={userIdOf(candidate)}>
                    {userNameOf(candidate)} · {candidate.employee_code || candidate.email || candidate.role_code || 'staff'}
                  </option>
                ))}
              </select>
              <small>{selectedDepartmentStaff.length ? 'Danh sách lấy từ operational profile của khoa đã chọn.' : 'Backend chưa trả staff theo khoa, đang dùng danh sách nhân sự active làm nguồn dự phòng.'}</small>
            </label>
            <div className="facility-heads-pro__actions">
              <button type="button" className="staff-button staff-button--primary" disabled={!selected || !candidateId || assigning} onClick={() => onAssignHead(selected.department_id, candidateId)}>
                <UserCheck size={16} /> {assigning ? 'Đang gán...' : 'Gán / nâng cấp trưởng khoa'}
              </button>
              <button type="button" className="staff-button staff-button--ghost" disabled={!selected?.head || assigning} onClick={() => onRemoveHead(selected.department_id)}>
                Gỡ trưởng khoa
              </button>
              <button type="button" className="staff-button staff-button--ghost" disabled={!selected} onClick={() => onOpen(selected.department_id)}>
                Mở hồ sơ khoa
              </button>
            </div>
          </section>

          <section className="facility-heads-pro__candidate-grid">
            {validCandidates.slice(0, 12).map((candidate) => (
              <button key={userIdOf(candidate)} type="button" className={candidateId === userIdOf(candidate) ? 'is-active' : ''} onClick={() => setCandidateId(userIdOf(candidate))}>
                <i>{getInitials(userNameOf(candidate))}</i>
                <strong>{userNameOf(candidate)}</strong>
                <small>{candidate.email || candidate.employee_code || candidate.role_code || 'active staff'}</small>
                <StatusBadge status={candidate.status || 'active'} />
              </button>
            ))}
            {!validCandidates.length ? <p className="facility-pro-empty-text">Chưa có nhân sự active phù hợp để gán trưởng khoa.</p> : null}
          </section>
        </main>
      </section>
    </section>
  );
}

function StaffView({ departments, profile, selectedDepartmentId, setSelectedDepartmentId, onOpen }) {
  const selected = departments.find((item) => item.department_id === selectedDepartmentId) || departments[0];
  const staffRows = profile?.staff || [];
  const roleMix = staffRows.reduce((acc, user) => {
    const roleLabel = user.primary_role || user.role_code || user.role_name || user.role || 'Chưa rõ role';
    acc[roleLabel] = (acc[roleLabel] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="facility-pro-workforce facility-pro-workforce--select">
      <section className="facility-pro-panel facility-pro-workforce-console">
        <div className="facility-pro-workforce-console__top">
          <div>
            <span>Department Workforce Matrix</span>
            <h2>{selected?.department_name || 'Nhân sự theo khoa'}</h2>
            <p>Chọn khoa bằng dropdown để tránh sidebar phụ dài, đồng thời xem nhanh staff active, locked, bác sĩ và danh sách Staff 360.</p>
          </div>
          <div className="facility-pro-department-picker">
            <label htmlFor="facility-workforce-department">Khoa/phòng đang xem</label>
            <select
              id="facility-workforce-department"
              value={selected?.department_id || ''}
              onChange={(event) => setSelectedDepartmentId(event.target.value)}
            >
              {departments.map((department) => (
                <option key={department.department_id} value={department.department_id}>
                  {department.department_name} · {formatNumber(department.staff?.active)}/{formatNumber(department.staff?.total)} active
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="facility-pro-workforce-summary">
          <article>
            <UsersRound size={18} />
            <span>Total staff</span>
            <strong>{formatNumber(selected?.staff?.total || 0)}</strong>
            <small>{formatNumber(selected?.staff?.active || 0)} đang active</small>
          </article>
          <article>
            <CheckCircle2 size={18} />
            <span>Active</span>
            <strong>{formatNumber(selected?.staff?.active || 0)}</strong>
            <small>Sẵn sàng nhận lịch/queue</small>
          </article>
          <article>
            <ShieldAlert size={18} />
            <span>Locked</span>
            <strong>{formatNumber(selected?.staff?.locked || 0)}</strong>
            <small>Cần kiểm tra bảo mật</small>
          </article>
          <article>
            <Stethoscope size={18} />
            <span>Doctors</span>
            <strong>{formatNumber(selected?.doctors_count || 0)}</strong>
            <small>Lực lượng khám chính</small>
          </article>
        </section>

        <section className="facility-pro-workforce-content">
          <div className="facility-pro-mini-table facility-pro-mini-table--staff">
            <div className="facility-pro-mini-table__head">
              <span>Nhân sự</span>
              <span>Email / mã NV</span>
              <span>Trạng thái</span>
              <span>Hành động</span>
            </div>
            {staffRows.map((user) => (
              <div key={user.user_id}>
                <span className="facility-pro-avatar">{getInitials(user.full_name || user.username)}</span>
                <strong>{user.full_name || user.username}</strong>
                <small>{user.email || user.employee_code}</small>
                <StatusBadge status={user.status} />
                <Link to={`/admin/staff/${user.user_id}`}>Staff 360</Link>
              </div>
            ))}
            {profile && !staffRows.length ? <p className="facility-pro-empty-text">Khoa này chưa có nhân sự trong dữ liệu trả về.</p> : null}
          </div>

          <aside className="facility-pro-workforce-side">
            <button type="button" className="staff-button staff-button--primary" onClick={() => selected && onOpen(selected.department_id)}>
              Mở hồ sơ khoa
            </button>
            <div>
              <span>Mã khoa</span>
              <strong>{selected?.department_code || 'N/A'}</strong>
            </div>
            <div>
              <span>Loại khoa</span>
              <strong>{getDepartmentTypeLabel(selected?.department_type)}</strong>
            </div>
            <div>
              <span>Role mix</span>
              {Object.keys(roleMix).length ? Object.entries(roleMix).slice(0, 6).map(([role, count]) => (
                <em key={role}>{role}: {formatNumber(count)}</em>
              )) : <em>Chưa có dữ liệu role từ profile.</em>}
            </div>
          </aside>
        </section>
      </section>
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

function LocationCard({ item }) {
  const status = item.status || (item.active ? 'active' : 'inactive');
  const hasPhone = Boolean(item.phone || item.telephone || item.hotline);
  const hasHours = Boolean(item.opening_hours || item.working_hours || item.hours);
  const publicVisible = Boolean(item.public_visible || item.is_public || item.visible_on_portal);
  return (
    <article className="facility-location-card">
      <div className="facility-location-card__top">
        <strong>{resourceName(item)}</strong>
        <StatusBadge status={status} />
      </div>
      <p>{resourceDepartment(item)} · {item.address || item.full_address || item.location_note || 'Chưa có địa chỉ/ghi chú địa điểm'}</p>
      <div className="facility-location-card__chips">
        <span>{resourceType(item)}</span>
        <span className={hasPhone ? 'is-ready' : 'is-missing'}>{hasPhone ? 'PHONE' : 'NO PHONE'}</span>
        <span className={hasHours ? 'is-ready' : 'is-missing'}>{hasHours ? 'HOURS' : 'NO HOURS'}</span>
        <span className={publicVisible ? 'is-ready' : 'is-muted'}>{publicVisible ? 'PUBLIC' : 'INTERNAL'}</span>
      </div>
    </article>
  );
}

function ResourceBoardView({ view, resources, departments = [] }) {
  const locations = asArray(resources?.locations);
  if (view === 'locations') {
    const lanes = [
      ['clinic', 'Clinic', Hospital],
      ['reception', 'Reception', ClipboardList],
      ['lab', 'Lab', TestTube2],
      ['imaging', 'Imaging', MonitorCheck],
      ['procedure', 'Procedure', Stethoscope],
      ['pharmacy', 'Kho / nhà thuốc', Store],
    ];
    return (
      <section className="facility-location-board">
        <section className="facility-pro-metrics">
          <MetricCard icon={MapPin} label="Tổng địa điểm" value={locations.length} tone="cyan" />
          <MetricCard icon={CheckCircle2} label="Active" value={locations.filter((item) => normalizeStatus(item.status || item.active) === 'active').length} tone="green" />
          <MetricCard icon={Building2} label="Chưa gắn khoa" value={locations.filter((item) => !item.department_id && !item.department_name).length} tone="amber" />
          <MetricCard icon={Eye} label="Public portal" value={locations.filter((item) => item.public_visible || item.is_public || item.visible_on_portal).length} tone="blue" />
        </section>
        <div className="facility-location-board__lanes">
          {lanes.map(([type, label, Icon]) => {
            const laneItems = locations.filter((item) => {
              const normalizedType = resourceType(item).toLowerCase();
              if (type === 'pharmacy') return ['pharmacy', 'warehouse', 'storage'].some((keyword) => normalizedType.includes(keyword));
              if (type === 'reception') return normalizedType.includes('reception') || normalizedType.includes('front');
              return normalizedType.includes(type);
            });
            return (
              <section key={type} className="facility-location-lane">
                <div className="facility-location-lane__head"><Icon size={17} /><h2>{label}</h2><span>{formatNumber(laneItems.length)}</span></div>
                <div className="facility-location-lane__list">
                  {laneItems.slice(0, 12).map((item, index) => <LocationCard key={item.location_id || item.id || index} item={item} />)}
                  {!laneItems.length ? <p>Chưa có địa điểm {label.toLowerCase()}.</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    );
  }

  if (view === 'reception') {
    const receptionLocations = locations.filter((item) => resourceType(item).toLowerCase().includes('reception') || resourceType(item).toLowerCase().includes('clinic'));
    const queueDepartments = asArray(resources?.departments).length ? asArray(resources?.departments) : departments;
    return (
      <section className="facility-resource-console">
        <section className="facility-pro-metrics">
          <MetricCard icon={ClipboardList} label="Reception/clinic points" value={receptionLocations.length} />
          <MetricCard icon={Activity} label="Queue departments" value={queueDepartments.length} tone="violet" />
          <MetricCard icon={AlertTriangle} label="Thiếu địa điểm" value={queueDepartments.filter((item) => !item.locations_count).length} tone="amber" />
        </section>
        <GenericResourceBoard icon={ClipboardList} title="Khu vực tiếp nhận & queue-ready departments" items={receptionLocations.length ? receptionLocations : queueDepartments} columns={['name', 'department_name', 'type', 'status', 'public_visible']} />
      </section>
    );
  }

  if (view === 'lab') {
    const labLocations = locations.filter((item) => resourceType(item).toLowerCase().includes('lab'));
    return (
      <section className="facility-resource-console">
        <section className="facility-pro-metrics">
          <MetricCard icon={TestTube2} label="Lab tests" value={resources?.lab?.tests_count || 0} />
          <MetricCard icon={FlaskConical} label="Specimen types" value={resources?.lab?.specimen_types_count || 0} tone="violet" />
          <MetricCard icon={Gauge} label="SLA rules" value={resources?.lab?.sla_rules_count || 0} tone="green" />
          <MetricCard icon={MapPin} label="Lab locations" value={labLocations.length} tone="cyan" />
        </section>
        <GenericResourceBoard icon={TestTube2} title="Lab readiness board" items={labLocations} columns={['name', 'department_name', 'address', 'status', 'public_visible']} />
      </section>
    );
  }

  if (view === 'imaging') {
    return (
      <section className="facility-resource-console">
        <GenericResourceBoard icon={MonitorCheck} title="Imaging rooms" items={asArray(resources?.imaging_rooms)} columns={['code', 'name', 'modality', 'maintenance_status', 'active']} />
        <GenericResourceBoard icon={Activity} title="Imaging equipment" items={asArray(resources?.imaging_equipment)} columns={['code', 'name', 'modality', 'manufacturer', 'status']} />
      </section>
    );
  }

  if (view === 'procedure') {
    const catalog = asArray(resources?.procedure_rooms?.catalog);
    const rooms = asArray(resources?.procedure_rooms?.rooms);
    return (
      <section className="facility-resource-console">
        <section className="facility-pro-metrics">
          <MetricCard icon={Stethoscope} label="Procedure catalog" value={catalog.length} />
          <MetricCard icon={DoorOpen} label="Procedure rooms" value={rooms.length} tone="violet" />
        </section>
        <GenericResourceBoard icon={Stethoscope} title="Procedure catalog readiness" items={catalog.length ? catalog : rooms} columns={catalog.length ? ['procedure_code', 'procedure_name', 'status', 'location_count', 'service_id'] : ['room_code', 'room_name', 'room_type', 'status', 'department_name']} />
      </section>
    );
  }

  if (view === 'warehouse') {
    return (
      <section className="facility-resource-console">
        <GenericResourceBoard icon={Store} title="Warehouses" items={asArray(resources?.warehouses)} columns={['warehouse_code', 'name', 'type', 'department_name', 'status']} />
        <GenericResourceBoard icon={PackageCheck} title="Storage locations" items={asArray(resources?.storage_locations)} columns={['location_code', 'name', 'location_type', 'status', 'is_locked']} />
      </section>
    );
  }

  const services = asArray(resources?.services);
  return (
    <section className="facility-bindings-pro">
      <section className="facility-pro-metrics">
        <MetricCard icon={Settings} label="Service catalog" value={services.length} />
        <MetricCard icon={Building2} label="Có gắn khoa" value={services.filter((item) => item.department_id || item.department_name).length} tone="green" />
        <MetricCard icon={MapPin} label="Có địa điểm/phòng" value={services.filter((item) => item.location_id || item.room_id || item.location_name || item.room_name).length} tone="cyan" />
        <MetricCard icon={PackageCheck} label="Billable" value={services.filter((item) => item.is_billable || item.billable).length} tone="violet" />
      </section>
      <section className="facility-bindings-pro__flow">
        <article><Building2 size={18} /><strong>Department</strong><small>Khoa/phòng sở hữu dịch vụ</small></article>
        <article><MapPin size={18} /><strong>Location / Room</strong><small>Nơi bệnh nhân đến nhận dịch vụ</small></article>
        <article><PackageCheck size={18} /><strong>ServiceCatalog</strong><small>Mã dịch vụ, loại dịch vụ, billable</small></article>
        <article><CalendarClock size={18} /><strong>Queue / Schedule / Billing</strong><small>Điều kiện sẵn sàng vận hành</small></article>
      </section>
      <GenericResourceBoard icon={Settings} title="Service bindings" items={services} columns={['service_code', 'service_name', 'service_type', 'department_name', 'status', 'is_billable']} />
    </section>
  );
}

function GenericResourceBoard({ icon: Icon, title, items = [], columns = [] }) {
  const rows = asArray(items);
  return (
    <section className="facility-pro-panel facility-pro-panel--resource">
      <div className="facility-pro-panel__head"><h2><Icon size={18} /> {title}</h2><span>{formatNumber(rows.length)}</span></div>
      {rows.length ? (
        <div className="facility-pro-resource-table-wrap">
          <div className="facility-pro-resource-table" style={{ '--facility-columns': columns.length }}>
            <div className="facility-pro-resource-table__head">
              {columns.map((column) => <span key={column}>{column}</span>)}
            </div>
            {rows.map((item, index) => (
              <div key={item.location_id || item.room_id || item.equipment_id || item.warehouse_id || item.service_id || item.id || index} className="facility-pro-resource-table__row">
                {columns.map((column) => {
                  let value = item[column];
                  if (column === 'name') value = resourceName(item);
                  if (column === 'type') value = resourceType(item);
                  if (column === 'department_name') value = resourceDepartment(item);
                  if (column.includes('status') || column === 'active') return <StatusBadge key={column} status={value} />;
                  if (column === 'public_visible' || column === 'is_billable' || column === 'is_locked') return <span key={column} className={value ? 'facility-pro-yes' : 'facility-pro-no'}>{value ? 'Yes' : 'No'}</span>;
                  return <span key={column}>{textValue(value, 'N/A')}</span>;
                })}
              </div>
            ))}
          </div>
        </div>
      ) : <p className="facility-pro-empty-text">Chưa có dữ liệu cho bảng này từ backend.</p>}
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
          <div className="facility-pro-warning-list facility-pro-warning-list--scroll">
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
  const [headCandidates, setHeadCandidates] = useState([]);
  const [assigningHead, setAssigningHead] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [overviewData, boardData, resourcesData, statusData, staffData] = await Promise.all([
        getFacilityOverview().catch(() => null),
        getFacilityDepartmentOperationsBoard(),
        getFacilityResourceBoard().catch(() => null),
        getFacilityOperationalStatus().catch(() => null),
        getStaffAccounts('limit=200&status=active').catch(() => ({ items: [] })),
      ]);
      setOverview(overviewData);
      setBoard(boardData);
      setResources(resourcesData);
      setStatus(statusData);
      setHeadCandidates(staffData?.items || []);
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

  async function handleAssignHead(departmentId, headUserId) {
    if (!departmentId || !headUserId) return;
    setAssigningHead(true);
    setError('');
    try {
      await assignDepartmentHead(departmentId, headUserId);
      await load();
    } catch (assignError) {
      setError(assignError.message);
    } finally {
      setAssigningHead(false);
    }
  }

  async function handleRemoveHead(departmentId) {
    if (!departmentId) return;
    setAssigningHead(true);
    setError('');
    try {
      await removeDepartmentHead(departmentId);
      await load();
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setAssigningHead(false);
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
      {!loading && actualView === 'heads' ? <HeadsView departments={departments} profile={profile} selectedDepartmentId={selectedDepartmentId} setSelectedDepartmentId={setSelectedDepartmentId} headCandidates={headCandidates} onAssignHead={handleAssignHead} onRemoveHead={handleRemoveHead} onOpen={openDepartmentProfile} assigning={assigningHead} /> : null}
      {!loading && actualView === 'staff' ? <StaffView departments={departments} profile={profile} selectedDepartmentId={selectedDepartmentId} setSelectedDepartmentId={setSelectedDepartmentId} onOpen={openDepartmentProfile} /> : null}
      {!loading && actualView === 'profile' ? <ProfileView departments={board?.items || []} profile={profile} selectedDepartmentId={selectedDepartmentId} setSelectedDepartmentId={setSelectedDepartmentId} /> : null}
      {!loading && ['locations', 'reception', 'lab', 'imaging', 'procedure', 'warehouse', 'bindings'].includes(actualView) ? <ResourceBoardView view={actualView} resources={resources} departments={board?.items || []} /> : null}
      {!loading && actualView === 'status' ? <StatusView status={status} /> : null}
    </section>
  );
}
