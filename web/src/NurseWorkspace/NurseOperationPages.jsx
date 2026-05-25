import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Filter,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  Loader2,
  Monitor,
  Pill,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Stethoscope,
  Table2,
  UserCheck,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { nurseOperationsApi } from './nurseApi';
import { downloadNurseJson, notifyNurse, promptNurseText, runNurseAction } from './nurseActions';

const priorityLabels = {
  critical: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  normal: 'Bình thường',
  low: 'Thấp',
};

const statusLabels = {
  pending: 'Đang chờ',
  waiting: 'Đang chờ',
  called: 'Đã gọi',
  recalled: 'Gọi lại',
  in_service: 'Đang phục vụ',
  skipped: 'Bỏ qua',
  completed: 'Hoàn tất',
  no_show: 'Không đến',
  todo: 'Chưa nhận',
  in_progress: 'Đang làm',
  overdue: 'Quá hạn',
  done: 'Hoàn tất',
  needs_attention: 'Cần xử lý',
  doctor_notified: 'Đã báo bác sĩ',
  created: 'Mới',
  acknowledged: 'Đã nhận',
  triaged: 'Đã phân loại',
  dispatched: 'Đã điều phối',
  breached: 'Quá hạn',
  warning: 'Cảnh báo',
  normal: 'Bình thường',
  cancelled: 'Đã hủy',
  entered_in_error: 'Nhập sai',
  ready_for_doctor: 'Sẵn sàng gặp bác sĩ',
  waiting_doctor: 'Chờ bác sĩ phản hồi',
  assigned: 'Đã phân công',
  unassigned: 'Chưa phân công',
};

const sourceLabels = {
  queue: 'Hàng đợi',
  vital_sign: 'Sinh hiệu',
  emergency_case: 'Cấp cứu',
  nursing_task: 'Việc điều dưỡng',
  inpatient_task: 'Nội trú',
  order: 'Chỉ định dịch vụ',
  medication_administration: 'Thuốc',
  encounter: 'Lượt khám',
  admission: 'Nội trú',
  lab_order: 'Chỉ định xét nghiệm',
  imaging_order: 'Chỉ định chẩn đoán hình ảnh',
  procedure_order: 'Chỉ định thủ thuật',
  manual: 'Tạo thủ công',
};

const actionLabels = {
  record_vital: 'Nhập sinh hiệu',
  create_nursing_note: 'Ghi chú',
  create_note: 'Ghi chú',
  notify_doctor: 'Báo bác sĩ',
  acknowledge: 'Xác nhận',
  open_patient: 'Mở hồ sơ',
  assign_to_me: 'Giao tôi',
  start_task: 'Bắt đầu',
  complete_task: 'Hoàn tất',
  create_triage: 'Phân loại',
  open_checklist: 'Bảng kiểm',
  acknowledge_emergency: 'Nhận ca',
  open_case: 'Mở ca',
  mark_ready_for_doctor: 'Sẵn sàng gặp bác sĩ',
  cancel_task: 'Hủy việc',
  reopen_task: 'Mở lại',
  resolve: 'Đánh dấu đã xử lý',
  dismiss: 'Bỏ qua cảnh báo',
  complete_preparation: 'Hoàn tất chuẩn bị',
  administer_medication: 'Dùng thuốc',
};

const typeLabels = {
  all: 'Tất cả',
  mine: 'Của tôi',
  unassigned: 'Chưa phân công',
  critical: 'Khẩn cấp',
  triage_pending: 'Chờ phân loại',
  vital_pending: 'Chờ sinh hiệu',
  abnormal_vital: 'Sinh hiệu bất thường',
  preparation_pending: 'Chờ chuẩn bị',
  emergency: 'Cấp cứu',
  long_waiting: 'Chờ quá lâu',
  task_overdue: 'Việc quá hạn',
  medication_overdue: 'Thuốc quá giờ',
  medication_due: 'Thuốc đến giờ',
  queue_sla: 'Hàng đợi quá hạn',
  doctor_escalation: 'Cần báo bác sĩ',
  order_stat: 'Chỉ định khẩn',
  service_preparation: 'Chuẩn bị dịch vụ',
  need_doctor: 'Cần báo bác sĩ',
  overdue: 'Quá hạn',
  medium: 'Trung bình',
  high: 'Cao',
};

const nursingStageLabels = {
  checked_in: 'Đã tiếp nhận',
  not_started: 'Chưa bắt đầu',
  waiting_nurse: 'Chờ điều dưỡng',
  triage_pending: 'Chờ phân loại',
  triage_done: 'Đã phân loại',
  vital_pending: 'Chờ sinh hiệu',
  vital_done: 'Đã đo sinh hiệu',
  preparation_pending: 'Chờ chuẩn bị',
  ready_for_doctor: 'Sẵn sàng gặp bác sĩ',
  doctor_in_service: 'Bác sĩ đang khám',
  completed: 'Hoàn tất',
};

const flagLabels = {
  spo2: 'SpO2 thấp',
  critical: 'Khẩn cấp',
  high: 'Cao',
  lab: 'Xét nghiệm',
  stat: 'Khẩn',
  waiting_over_15m: 'Chờ trên 15 phút',
  medication: 'Thuốc',
  emergency: 'Cấp cứu',
};

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '--/--/----';
  return date.toLocaleDateString('vi-VN');
}

function minutesAgo(value) {
  if (!value) return 'vừa xong';
  const diff = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diff < 1) return 'vừa xong';
  if (diff < 60) return `${diff} phút trước`;
  return `${Math.floor(diff / 60)} giờ trước`;
}

function waitText(value) {
  const minutes = Number(value || 0);
  if (minutes < 60) return `${minutes} phút`;
  return `${Math.floor(minutes / 60)}g ${minutes % 60}p`;
}

function patientName(item = {}) {
  return item.patient_name || item.patient?.patient_name || item.patient?.full_name || 'Chưa rõ bệnh nhân';
}

function queryParams({ date, shift, priority, type, status, owner, search }) {
  return {
    date,
    shift,
    priority: priority === 'all' ? undefined : priority,
    type: type === 'all' ? undefined : type,
    status: status === 'all' ? undefined : status,
    nurse_id: owner === 'me' ? 'me' : undefined,
    assigned_to: owner === 'unassigned' ? 'unassigned' : undefined,
    search: search || undefined,
  };
}

function useNursingData(loader, fallback, params) {
  const [data, setData] = useState(fallback);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((payload) => {
        if (cancelled) return;
        setData(payload || fallback);
        setIsDemo(false);
        setError('');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setData(fallback);
        setIsDemo(true);
        setError(loadError?.message || 'Không thể tải dữ liệu điều dưỡng.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, params);

  return { data, loading, isDemo, error };
}

function PageShell({ eyebrow, title, description, meta, loading, isDemo, error, actions, children }) {
  return (
    <section className="nurse-operation-page">
      <header className="nurse-operation-hero">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="nurse-operation-meta">
            <em>{meta?.department_name || 'Khoa/phòng được phân quyền'}</em>
            <em>{meta?.shift === 'morning' ? 'Ca sáng' : meta?.shift === 'afternoon' ? 'Ca chiều' : meta?.shift === 'night' ? 'Ca đêm' : 'Tất cả ca'}</em>
            <em>{formatDate(meta?.date)}</em>
            <em>{isDemo ? 'Dữ liệu mẫu' : 'Đã kết nối thời gian thực'}</em>
          </div>
        </div>
        <aside>
          <span className={`nurse-realtime-badge${isDemo ? ' is-offline' : ''}`}>
            {isDemo ? <WifiOff size={15} /> : <Wifi size={15} />}
            {isDemo ? 'Dữ liệu mẫu ngoại tuyến' : 'Đã kết nối thời gian thực'}
          </span>
          <small>Cập nhật {formatTime(meta?.generated_at)}</small>
          <div className="nurse-operation-actions">
            {actions}
          </div>
        </aside>
      </header>
      {isDemo && error ? (
        <div className="nurse-dashboard-demo-note">
          <AlertTriangle size={16} />
          API chưa phản hồi nên đang hiển thị dữ liệu mẫu. {error}
        </div>
      ) : null}
      {loading ? (
        <div className="nurse-operation-loading"><Loader2 className="is-spinning" size={18} />Đang đồng bộ dữ liệu...</div>
      ) : null}
      {children}
    </section>
  );
}

function FilterBar({ filters, setFilters, children }) {
  return (
    <section className="nurse-operation-filters">
      <label>
        <span>Ngày</span>
        <input type="date" value={filters.date} onChange={(event) => setFilters((value) => ({ ...value, date: event.target.value }))} />
      </label>
      <label>
        <span>Ca trực</span>
        <select value={filters.shift} onChange={(event) => setFilters((value) => ({ ...value, shift: event.target.value }))}>
          <option value="morning">Ca sáng</option>
          <option value="afternoon">Ca chiều</option>
          <option value="night">Ca đêm</option>
          <option value="all">Tất cả</option>
        </select>
      </label>
      <label>
        <span>Ưu tiên</span>
        <select value={filters.priority} onChange={(event) => setFilters((value) => ({ ...value, priority: event.target.value }))}>
          <option value="all">Tất cả</option>
          <option value="critical">Khẩn cấp</option>
          <option value="high">Cao</option>
          <option value="medium">Trung bình</option>
          <option value="low">Thấp</option>
        </select>
      </label>
      <label>
        <span>Phụ trách</span>
        <select value={filters.owner} onChange={(event) => setFilters((value) => ({ ...value, owner: event.target.value }))}>
          <option value="all">Tất cả</option>
          <option value="me">Của tôi</option>
          <option value="unassigned">Chưa phân công</option>
        </select>
      </label>
      {children}
    </section>
  );
}

function KpiStrip({ items }) {
  return (
    <section className="nurse-operation-kpis">
      {items.map((item) => {
        const Icon = item.icon || Activity;
        return (
          <button key={item.label} type="button" className={`nurse-operation-kpi nurse-operation-kpi--${item.tone || 'teal'}`} onClick={item.onClick || (() => notifyNurse({ title: item.label, message: item.detail || 'Đã chọn chỉ số vận hành.' }))}>
            <Icon size={19} />
            <span>{item.label}</span>
            <strong>{item.value ?? 0}</strong>
            <small>{item.detail}</small>
          </button>
        );
      })}
    </section>
  );
}

function PatientDrawer({ item, onClose, onAction }) {
  if (!item) return null;
  return (
    <aside className="nurse-detail-drawer" aria-label="Chi tiết bệnh nhân">
      <header>
        <button type="button" onClick={onClose}>Đóng</button>
        <span className={`nurse-priority-pill nurse-priority-pill--${item.priority || 'medium'}`}>{priorityLabels[item.priority] || item.priority}</span>
        <h2>{patientName(item)}</h2>
        <p>{item.patient_code || 'Chưa có mã'} · {item.metadata?.queue_number || item.encounter_id || '--'}</p>
      </header>
      <section>
        <h3>Cảnh báo nhanh</h3>
        <div className="nurse-drawer-alerts">
          {(item.flags || ['waiting']).slice(0, 4).map((flag) => <span key={flag}>{flagLabels[flag] || statusLabels[flag] || flag}</span>)}
        </div>
      </section>
      <section>
        <h3>Ngữ cảnh xử lý</h3>
        <dl>
        <div><dt>Nguồn việc</dt><dd>{sourceLabels[item.source_type] || typeLabels[item.type] || item.source_type}</dd></div>
          <div><dt>Lý do</dt><dd>{item.reason}</dd></div>
          <div><dt>Chờ</dt><dd>{waitText(item.waiting_minutes || item.overdue_minutes)}</dd></div>
          <div><dt>Thời hạn</dt><dd>{statusLabels[item.sla_status] || item.sla_status}</dd></div>
          <div><dt>Phụ trách</dt><dd>{item.assigned_to_name || 'Chưa phân công'}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Dòng thời gian</h3>
        <ol className="nurse-drawer-timeline">
          <li><span>{formatTime(item.waiting_since)}</span><strong>Phát sinh việc cần xử lý</strong></li>
          <li><span>{formatTime(item.sla_due_at)}</span><strong>Thời hạn dự kiến</strong></li>
          <li><span>Hiện tại</span><strong>{item.sla_status === 'breached' ? 'Đã quá hạn' : 'Đang theo dõi'}</strong></li>
        </ol>
      </section>
      <section>
        <h3>Hành động nhanh</h3>
        <div className="nurse-row-actions">
          {(item.actions || ['open_patient']).slice(0, 5).map((action) => <button key={action} type="button" onClick={() => onAction?.(action, item)}>{actionLabels[action] || action}</button>)}
        </div>
      </section>
    </aside>
  );
}

const demoPendingPatients = {
  meta: { date: toLocalDateKey(), shift: 'morning', generated_at: new Date().toISOString(), department_name: 'Nội tổng quát' },
  summary: { total: 28, critical: 3, high: 8, triage_pending: 5, vital_pending: 9, abnormal_vitals: 3, preparation_pending: 7, need_doctor: 4, unassigned: 6, sla_breached: 4 },
  priority_lane: { immediate: [], longest_waiting: [], unassigned: [], stat: [] },
  items: [
    { id: 'abnormal_vital_demo1', priority: 'critical', patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', age: 45, gender: 'male', source_type: 'vital_sign', type: 'abnormal_vital', reason: 'SpO2 88%', status: 'needs_attention', waiting_minutes: 3, sla_status: 'breached', location: 'Phòng khám 01', assigned_to_name: 'Điều dưỡng Lan', flags: ['spo2', 'critical'], actions: ['notify_doctor', 'acknowledge', 'open_patient'], waiting_since: new Date(Date.now() - 180000).toISOString(), metadata: { queue_number: 'Q012' } },
    { id: 'vital_pending_demo2', priority: 'high', patient_name: 'Trần Thị B', patient_code: 'BN0002', age: 32, gender: 'female', source_type: 'queue', type: 'vital_pending', reason: 'Chờ đo sinh hiệu', status: 'pending', waiting_minutes: 18, sla_status: 'warning', location: 'Nội 02', flags: ['waiting_over_15m'], actions: ['record_vital', 'create_nursing_note', 'assign_to_me'], waiting_since: new Date(Date.now() - 1080000).toISOString(), metadata: { queue_number: 'Q014' } },
    { id: 'preparation_demo3', priority: 'medium', patient_name: 'Lê Văn C', patient_code: 'BN0003', age: 51, gender: 'male', source_type: 'order', type: 'preparation_pending', reason: 'Chuẩn bị xét nghiệm máu', status: 'pending', waiting_minutes: 11, sla_status: 'normal', location: 'Phòng xét nghiệm', flags: ['lab', 'stat'], actions: ['open_checklist', 'assign_to_me'], waiting_since: new Date(Date.now() - 660000).toISOString(), metadata: { queue_number: 'Q015', order_type: 'lab' } },
  ],
  activity_feed: [],
};
demoPendingPatients.priority_lane = {
  immediate: demoPendingPatients.items.slice(0, 2),
  longest_waiting: [...demoPendingPatients.items].sort((a, b) => b.waiting_minutes - a.waiting_minutes),
  unassigned: demoPendingPatients.items.filter((item) => !item.assigned_to_name),
  stat: demoPendingPatients.items.filter((item) => item.flags?.includes('stat')),
};

export function PendingPatientsPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', owner: 'all', type: 'all', status: 'all', search: '' });
  const [viewMode, setViewMode] = useState('table');
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const params = queryParams(filters);
  const { data, loading, isDemo, error } = useNursingData(
    () => nurseOperationsApi.getPendingPatients(params),
    demoPendingPatients,
    [filters.date, filters.shift, filters.priority, filters.owner, filters.type, filters.status, refresh],
  );
  const filteredItems = useMemo(() => (data.items || []).filter((item) => !filters.search || patientName(item).toLowerCase().includes(filters.search.toLowerCase()) || item.patient_code?.toLowerCase().includes(filters.search.toLowerCase())), [data, filters.search]);
  const active = selected || filteredItems[0];

  async function runPendingAction(action, item = active) {
    if (!item) return;
    const ticketId = item.queue_ticket_id || item.metadata?.queue_ticket_id || item.ticket_id;
    if (action === 'record_vital') {
      window.location.assign('/nurse/vitals-records/entry');
      return;
    }
    if (action === 'create_nursing_note') {
      window.location.assign('/nurse/vitals-records/nursing-notes');
      return;
    }
    if (action === 'open_checklist') {
      window.location.assign('/nurse/service-preparation/checklists');
      return;
    }
    if (action === 'open_patient') {
      window.location.assign('/nurse/patient-lookup/profile');
      return;
    }
    await runNurseAction({
      label: actionLabels[action] || 'Thao tác bệnh nhân',
      isDemo: isDemo || String(item.id || '').includes('demo'),
      demoMessage: 'Dữ liệu mẫu hoặc thiếu ID backend nên thao tác chưa gửi hệ thống.',
      confirm: { title: actionLabels[action] || 'Xác nhận thao tác', message: `${patientName(item)} - ${item.reason || ''}` },
      run: async () => {
        if (action === 'assign_to_me') return nurseOperationsApi.assignWorkItemToMe(item.id);
        if (action === 'acknowledge') return nurseOperationsApi.acknowledgeAlert(item.id);
        if (action === 'notify_doctor') return nurseOperationsApi.notifyDoctor(ticketId || item.id, { message: item.reason || item.message || 'Cần bác sĩ xem lại.' });
        return nurseOperationsApi.completeWorkItem(item.id, { result_note: 'Cập nhật từ workspace điều dưỡng.' });
      },
      successMessage: 'Đã cập nhật bệnh nhân chờ xử lý.',
      onSuccess: () => setRefresh((v) => v + 1),
    });
  }

  return (
    <PageShell
      eyebrow="Danh sách ưu tiên bệnh nhân"
      title="Bệnh nhân chờ xử lý"
      description="Theo dõi toàn bộ bệnh nhân đang cần điều dưỡng can thiệp trong ca trực."
      meta={data.meta}
      loading={loading}
      isDemo={isDemo}
      error={error}
      actions={<><button type="button" onClick={() => runPendingAction('assign_to_me')}><UserCheck size={16} />Giao cho tôi</button><button type="button" onClick={() => notifyNurse({ title: 'Tạo việc', message: 'Chọn bệnh nhân và mở màn Nhiệm vụ để tạo việc điều dưỡng chi tiết.' })}><Plus size={16} />Tạo việc</button><button type="button" onClick={() => runPendingAction('create_nursing_note')}><FileText size={16} />Ghi chú</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button><button type="button" onClick={() => downloadNurseJson('benh-nhan-cho-xu-ly.json', { filters, summary: data.summary, items: filteredItems })}><Download size={16} />Xuất</button></>}
    >
      <FilterBar filters={filters} setFilters={setFilters}>
        <label><span>Loại việc</span><select value={filters.type} onChange={(event) => setFilters((value) => ({ ...value, type: event.target.value }))}><option value="all">Tất cả</option><option value="triage_pending">Chờ phân loại</option><option value="vital_pending">Chờ sinh hiệu</option><option value="abnormal_vital">Bất thường</option><option value="preparation_pending">Chờ chuẩn bị</option><option value="emergency">Cấp cứu</option></select></label>
        <label><span>Thời hạn</span><select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}><option value="all">Tất cả</option><option value="pending">Đang chờ</option><option value="overdue">Quá hạn</option><option value="needs_attention">Cần xử lý</option></select></label>
        <label className="nurse-filter-search"><span>Tìm bệnh nhân</span><div><Search size={15} /><input value={filters.search} onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value }))} placeholder="Tên, mã bệnh nhân, số hàng đợi..." /></div></label>
      </FilterBar>

      <KpiStrip items={[
        { label: 'Tổng chờ xử lý', value: data.summary?.total, detail: '+6 việc mới trong 30 phút', icon: Users, tone: 'blue' },
        { label: 'Khẩn cấp', value: data.summary?.critical, detail: 'Cần xử lý ngay', icon: ShieldAlert, tone: 'red' },
        { label: 'Chờ phân loại', value: data.summary?.triage_pending, detail: 'Ưu tiên phân loại', icon: ClipboardCheck, tone: 'violet' },
        { label: 'Chờ sinh hiệu', value: data.summary?.vital_pending, detail: 'Theo dõi thời hạn 15 phút', icon: HeartPulse, tone: 'cyan' },
        { label: 'Chờ chuẩn bị', value: data.summary?.preparation_pending, detail: 'Chỉ định / bảng kiểm', icon: ListChecks, tone: 'indigo' },
        { label: 'Quá hạn', value: data.summary?.sla_breached, detail: 'Cần điều phối lại', icon: Clock3, tone: 'amber' },
      ]} />

      <section className="nurse-pending-layout">
        <aside className="nurse-priority-lane">
          {[
            ['Cần xử lý ngay', data.priority_lane?.immediate || [], ShieldAlert],
            ['Chờ lâu nhất', data.priority_lane?.longest_waiting || [], Clock3],
            ['Chưa phân công', data.priority_lane?.unassigned || [], Users],
          ].map(([title, items, Icon]) => (
            <section key={title}>
              <h2><Icon size={16} />{title}</h2>
              {items.slice(0, 4).map((item) => (
                <button key={item.id} type="button" onClick={() => setSelected(item)}>
                  <strong>{patientName(item)}</strong>
                  <span>{item.reason} · {waitText(item.waiting_minutes)}</span>
                  <em>{priorityLabels[item.priority] || item.priority}</em>
                </button>
              ))}
            </section>
          ))}
        </aside>
        <main className="nurse-operation-table-card">
          <div className="nurse-table-toolbar">
            <div>
              {['all', 'mine', 'unassigned', 'critical', 'triage_pending', 'vital_pending', 'abnormal_vital', 'preparation_pending', 'emergency'].map((tab) => (
                <button key={tab} type="button" onClick={() => setFilters((value) => ({ ...value, type: tab === 'all' || tab === 'mine' || tab === 'unassigned' || tab === 'critical' ? 'all' : tab, owner: tab === 'mine' ? 'me' : tab === 'unassigned' ? 'unassigned' : value.owner, priority: tab === 'critical' ? 'critical' : value.priority }))}>{typeLabels[tab] || tab}</button>
              ))}
            </div>
            <aside>
              <button type="button" className={viewMode === 'table' ? 'is-active' : ''} onClick={() => setViewMode('table')}><Table2 size={15} />Bảng</button>
              <button type="button" className={viewMode === 'card' ? 'is-active' : ''} onClick={() => setViewMode('card')}><LayoutGrid size={15} />Thẻ</button>
            </aside>
          </div>
          {viewMode === 'table' ? (
            <div className="nurse-worklist-table-wrap">
              <table className="nurse-worklist-table nurse-worklist-table--wide">
                <thead><tr><th>Ưu tiên</th><th>Bệnh nhân</th><th>Mã bệnh nhân / hàng đợi</th><th>Nguồn việc</th><th>Lý do cần xử lý</th><th>Trạng thái điều dưỡng</th><th>Chờ</th><th>Thời hạn</th><th>Khoa/phòng</th><th>Phụ trách</th><th>Cờ</th><th>Hành động</th></tr></thead>
                <tbody>{filteredItems.map((item) => <tr key={item.id} onClick={() => setSelected(item)}><td><span className={`nurse-priority-pill nurse-priority-pill--${item.priority}`}>{priorityLabels[item.priority] || item.priority}</span></td><td><strong>{patientName(item)}</strong><small>{item.age || '--'} tuổi</small></td><td>{item.metadata?.queue_number || item.patient_code || '--'}</td><td>{sourceLabels[item.source_type] || typeLabels[item.type] || item.source_type}</td><td>{item.reason}</td><td><span className="nurse-status-pill">{statusLabels[item.status] || item.status}</span></td><td>{waitText(item.waiting_minutes)}</td><td><span className={`nurse-sla-pill nurse-sla-pill--${item.sla_status}`}>{statusLabels[item.sla_status] || item.sla_status}</span></td><td>{item.location || 'Chưa gán'}</td><td>{item.assigned_to_name || 'Chưa phân công'}</td><td>{(item.flags || []).slice(0, 2).map((flag) => flagLabels[flag] || flag).join(', ') || '--'}</td><td><div className="nurse-row-actions">{(item.actions || []).slice(0, 2).map((action) => <button key={action} type="button" onClick={(event) => { event.stopPropagation(); runPendingAction(action, item); }}>{actionLabels[action] || action}</button>)}</div></td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div className="nurse-patient-card-grid">{filteredItems.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item)} className={`nurse-patient-card nurse-patient-card--${item.priority}`}><header><span>{priorityLabels[item.priority]}</span><strong>{item.metadata?.queue_number || item.patient_code || '--'} · {patientName(item)}</strong></header><p>{item.reason}</p><dl><div><dt>Chờ</dt><dd>{waitText(item.waiting_minutes)}</dd></div><div><dt>Thời hạn</dt><dd>{statusLabels[item.sla_status]}</dd></div><div><dt>Vị trí</dt><dd>{item.location || 'Chưa gán'}</dd></div></dl><footer>{(item.flags || []).slice(0, 3).map((flag) => <em key={flag}>{flagLabels[flag] || flag}</em>)}</footer></button>)}</div>
          )}
        </main>
      </section>
      <PatientDrawer item={selected} onClose={() => setSelected(null)} onAction={runPendingAction} />
    </PageShell>
  );
}

const demoTasks = {
  meta: demoPendingPatients.meta,
  summary: { total: 42, mine: 11, unassigned: 8, in_progress: 6, overdue: 5, done: 23, waiting_doctor: 3, handover: 4 },
  columns: {
    unassigned: [{ id: 'task_demo1', priority: 'high', title: 'Đo sinh hiệu', patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', due_at: new Date(Date.now() - 480000).toISOString(), status: 'overdue', type: 'vital', source_type: 'queue', actions: ['assign_to_me', 'record_vital'] }],
    todo: [{ id: 'task_demo2', priority: 'medium', title: 'Chuẩn bị xét nghiệm máu', patient_name: 'Trần Thị B', patient_code: 'BN0002', due_at: new Date(Date.now() + 720000).toISOString(), status: 'todo', type: 'preparation', source_type: 'order', actions: ['open_checklist', 'start_task'] }],
    in_progress: [],
    overdue: [],
    waiting_doctor: [{ id: 'task_demo3', priority: 'critical', title: 'Báo bác sĩ SpO2 88%', patient_name: 'Lê Văn C', due_at: new Date().toISOString(), status: 'waiting_doctor', type: 'vital', actions: ['notify_doctor'] }],
    done: [],
  },
  timeline: [{ hour: '08:00', total: 12, overdue: 2, completed: 8, vital: 5, preparation: 3, emergency: 1 }],
  table: [],
};
demoTasks.table = Object.values(demoTasks.columns).flat();

export function TodayWorkPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', owner: 'all', type: 'all', status: 'all' });
  const [refresh, setRefresh] = useState(0);
  const params = queryParams(filters);
  const { data, loading, isDemo, error } = useNursingData(() => nurseOperationsApi.getTasksBoard(params), demoTasks, [filters.date, filters.shift, filters.priority, filters.owner, refresh]);
  const columns = data.columns || {};

  async function runTaskAction(action, task = {}) {
    const taskId = task.id || task.task_id || task._id;
    if (action === 'record_vital') {
      window.location.assign('/nurse/vitals-records/entry');
      return;
    }
    if (action === 'open_checklist') {
      window.location.assign('/nurse/service-preparation/checklists');
      return;
    }
    if (action === 'notify_doctor') {
      notifyNurse({ tone: 'info', title: 'Báo bác sĩ', message: task.title || 'Chọn nhiệm vụ để báo bác sĩ chi tiết.' });
      return;
    }
    await runNurseAction({
      label: actionLabels[action] || 'Cập nhật việc',
      isDemo: isDemo || !taskId || String(taskId).includes('demo'),
      demoMessage: 'Dữ liệu mẫu hoặc thiếu task_id nên thao tác chưa gửi backend.',
      confirm: ['complete_task', 'cancel_task'].includes(action) ? { title: actionLabels[action], message: task.title } : null,
      run: async () => {
        if (action === 'assign_to_me') return nurseOperationsApi.assignTaskToMe(taskId);
        if (action === 'start_task') return nurseOperationsApi.startTask(taskId);
        if (action === 'complete_task') return nurseOperationsApi.completeTask(taskId, { result_note: 'Hoàn tất từ bảng việc hôm nay.' });
        return nurseOperationsApi.startTask(taskId);
      },
      successMessage: 'Đã cập nhật việc điều dưỡng.',
      onSuccess: () => setRefresh((v) => v + 1),
    });
  }

  return (
    <PageShell eyebrow="Bảng điều phối việc điều dưỡng" title="Việc cần làm hôm nay" description="Điều phối việc theo ca trực, người phụ trách, thời hạn xử lý và bảng kiểm." meta={data.meta} loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => window.location.assign('/nurse/tasks-handover/assigned')}><Plus size={16} />Tạo việc</button><button type="button" onClick={() => notifyNurse({ title: 'Giao hàng loạt', message: 'Dùng màn nhiệm vụ được giao để chọn người nhận và phân bổ hàng loạt.' })}><Users size={16} />Giao hàng loạt</button><button type="button" onClick={() => window.location.assign('/nurse/tasks-handover/shift-handover')}><ClipboardCheck size={16} />Bàn giao ca</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      <KpiStrip items={[
        { label: 'Tổng việc', value: data.summary?.total, detail: 'Tất cả nguồn trong ca', icon: ClipboardList, tone: 'blue' },
        { label: 'Của tôi', value: data.summary?.mine, detail: 'Đang giao cho tôi', icon: UserCheck, tone: 'teal' },
        { label: 'Chưa gán', value: data.summary?.unassigned, detail: 'Cần phân công', icon: Users, tone: 'amber' },
        { label: 'Đang làm', value: data.summary?.in_progress, detail: 'Việc đã bắt đầu', icon: Activity, tone: 'indigo' },
        { label: 'Quá hạn', value: data.summary?.overdue, detail: 'Cần xử lý ngay', icon: AlertTriangle, tone: 'red' },
        { label: 'Hoàn tất', value: data.summary?.done, detail: 'Trong ngày', icon: CheckCircle2, tone: 'green' },
      ]} />
      <FilterBar filters={filters} setFilters={setFilters}><label><span>Loại việc</span><select value={filters.type} onChange={(event) => setFilters((value) => ({ ...value, type: event.target.value }))}><option value="all">Tất cả</option><option value="vital">Sinh hiệu</option><option value="preparation">Chuẩn bị</option><option value="medication">Thuốc</option><option value="handover">Bàn giao</option></select></label><label><span>Nguồn</span><select><option>Hàng đợi / Chỉ định / Nội trú</option></select></label></FilterBar>
      <section className="nurse-kanban-board">
        {[['unassigned', 'Chưa nhận'], ['todo', 'Đã nhận'], ['in_progress', 'Đang làm'], ['overdue', 'Quá hạn'], ['waiting_doctor', 'Chờ phản hồi'], ['done', 'Hoàn tất']].map(([key, title]) => (
          <section key={key} className={`nurse-kanban-column nurse-kanban-column--${key}`}>
            <header><strong>{title}</strong><span>{columns[key]?.length || 0}</span></header>
            {(columns[key] || []).slice(0, 8).map((task) => <article key={task.id} className={`nurse-task-card nurse-task-card--${task.priority}`}><span>{priorityLabels[task.priority] || task.priority}</span><h3>{task.title}</h3><p>{patientName(task)} · {task.patient_code || '--'}</p><small>Hạn {formatTime(task.due_at)} · {task.overdue_minutes ? `quá ${task.overdue_minutes} phút` : 'đúng hạn'}</small><div className="nurse-task-progress"><em style={{ width: task.status === 'done' ? '100%' : task.status === 'in_progress' ? '55%' : '18%' }} /></div><footer>{(task.actions || ['start_task']).slice(0, 2).map((action) => <button key={action} type="button" onClick={() => runTaskAction(action, task)}>{actionLabels[action] || action}</button>)}</footer></article>)}
          </section>
        ))}
      </section>
      <section className="nurse-task-lower-grid">
        <div className="nurse-command-panel"><div className="nurse-panel-header"><div><span className="nurse-panel-header__icon"><Clock3 size={16} /></span><strong>Dòng thời gian công việc</strong></div></div><div className="nurse-day-timeline">{(data.timeline || []).map((bucket) => <article key={bucket.hour}><strong>{bucket.hour}</strong><span>{bucket.total} việc</span><small>{bucket.vital} sinh hiệu · {bucket.preparation} chuẩn bị · {bucket.overdue} quá hạn</small></article>)}</div></div>
        <div className="nurse-command-panel"><div className="nurse-panel-header"><div><span className="nurse-panel-header__icon"><Table2 size={16} /></span><strong>Bảng chi tiết</strong></div></div><div className="nurse-compact-table">{(data.table || []).slice(0, 8).map((task) => <button key={task.id} type="button" onClick={() => runTaskAction(task.status === 'todo' ? 'start_task' : 'complete_task', task)}><span className={`nurse-priority-pill nurse-priority-pill--${task.priority}`}>{priorityLabels[task.priority]}</span><strong>{task.title}</strong><small>{patientName(task)} · {statusLabels[task.status] || task.status}</small></button>)}</div></div>
      </section>
    </PageShell>
  );
}

const demoAlerts = {
  meta: demoPendingPatients.meta,
  summary: { total: 21, critical: 3, high: 8, unacknowledged: 12, need_doctor: 4, sla_breached: 2, resolved_today: 25 },
  severity_heat: { critical: 3, high: 8, medium: 10 },
  type_chart: { abnormal_vital: 4, emergency: 2, long_waiting: 8, task_overdue: 5, medication_overdue: 2 },
  items: [
    { id: 'alert_vital_demo', severity: 'critical', type: 'abnormal_vital', patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', message: 'SpO2 88%', created_at: new Date(Date.now() - 180000).toISOString(), source_type: 'vital_sign', sla_status: 'breached', actions: ['acknowledge', 'notify_doctor', 'open_patient'] },
    { id: 'alert_queue_demo', severity: 'high', type: 'long_waiting', patient_name: 'Trần Thị B', patient_code: 'BN0002', message: 'Chờ đo sinh hiệu 32 phút', created_at: new Date(Date.now() - 1920000).toISOString(), source_type: 'queue', sla_status: 'breached', actions: ['assign_to_me', 'record_vital'] },
  ],
};
demoAlerts.selected = demoAlerts.items[0];

export function PriorityAlertsPage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', owner: 'all', type: 'all', status: 'all' });
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useNursingData(() => nurseOperationsApi.getPriorityAlerts(queryParams(filters)), demoAlerts, [filters.date, filters.shift, filters.priority, filters.owner, refresh]);
  const activeAlert = selected || data.selected || data.items?.[0];
  const alerts = (data.items || []).filter((alert) => tab === 'all' || alert.severity === tab || alert.type?.includes(tab) || (tab === 'need_doctor' && alert.actions?.includes('notify_doctor')) || (tab === 'overdue' && alert.sla_status === 'breached'));

  async function runAlertAction(action, alert = activeAlert) {
    if (!alert) return;
    if (action === 'open_patient') {
      window.location.assign('/nurse/patient-lookup/profile');
      return;
    }
    if (action === 'record_vital') {
      window.location.assign('/nurse/vitals-records/entry');
      return;
    }
    await runNurseAction({
      label: actionLabels[action] || 'Cảnh báo ưu tiên',
      isDemo: isDemo || String(alert.id || '').includes('demo'),
      demoMessage: 'Cảnh báo mẫu hoặc thiếu alert_id nên chưa gửi backend.',
      confirm: { title: actionLabels[action] || 'Xác nhận cảnh báo', message: `${patientName(alert)} - ${alert.message}` },
      run: async () => {
        if (action === 'acknowledge' || action === 'assign_to_me') return nurseOperationsApi.acknowledgeAlert(alert.id);
        if (action === 'notify_doctor') return nurseOperationsApi.notifyDoctorAlert(alert.id);
        if (action === 'resolve') return nurseOperationsApi.resolveAlert(alert.id, { resolution_note: 'Đã xử lý từ trung tâm cảnh báo điều dưỡng.' });
        return nurseOperationsApi.acknowledgeAlert(alert.id);
      },
      successMessage: 'Đã cập nhật cảnh báo.',
      onSuccess: () => setRefresh((v) => v + 1),
    });
  }

  return (
    <PageShell eyebrow="Trung tâm cảnh báo lâm sàng và vận hành" title="Cảnh báo ưu tiên" description="Trung tâm cảnh báo lâm sàng và vận hành theo mức độ nguy hiểm, thời hạn xử lý và hành động cần làm." meta={data.meta} loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => runAlertAction('acknowledge')}><CheckCircle2 size={16} />Xác nhận theo bộ lọc</button><button type="button" onClick={() => runAlertAction('notify_doctor')}><Send size={16} />Báo bác sĩ</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button></>}>
      <KpiStrip items={[
        { label: 'Khẩn cấp', value: data.summary?.critical, detail: 'Đang mở', icon: ShieldAlert, tone: 'red' },
        { label: 'Mức cao', value: data.summary?.high, detail: 'Cần ưu tiên', icon: AlertTriangle, tone: 'amber' },
        { label: 'Chưa nhận', value: data.summary?.unacknowledged, detail: 'Chưa xác nhận', icon: Bell, tone: 'blue' },
        { label: 'Cần báo bác sĩ', value: data.summary?.need_doctor, detail: 'Hành động bắt buộc', icon: Send, tone: 'violet' },
        { label: 'Quá hạn', value: data.summary?.sla_breached, detail: 'Đã quá hạn', icon: Clock3, tone: 'red' },
        { label: 'Đã xử lý', value: data.summary?.resolved_today, detail: 'Trong ngày', icon: CheckCircle2, tone: 'green' },
      ]} />
      <div className="nurse-alert-tabs">{['all', 'critical', 'high', 'medium', 'overdue', 'need_doctor'].map((item) => <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => setTab(item)}>{item === 'all' ? 'Tất cả' : item === 'critical' ? 'Khẩn cấp' : item === 'high' ? 'Cao' : item === 'medium' ? 'Trung bình' : item === 'overdue' ? 'Quá hạn' : 'Cần báo bác sĩ'}</button>)}</div>
      <section className="nurse-alert-center-layout">
        <aside className="nurse-alert-feed">{alerts.map((alert) => <button key={alert.id} type="button" className={`nurse-alert-card nurse-alert-card--${alert.severity}`} onClick={() => setSelected(alert)}><header><span>{priorityLabels[alert.severity] || alert.severity}</span><strong>{alert.message}</strong></header><p>{patientName(alert)} · {alert.patient_code || '--'}</p><small>Nguồn: {sourceLabels[alert.source_type] || typeLabels[alert.type] || alert.type} · {minutesAgo(alert.created_at)} · Thời hạn {statusLabels[alert.sla_status] || alert.sla_status}</small><footer>{(alert.actions || []).slice(0, 3).map((action) => <em key={action}>{actionLabels[action] || action}</em>)}</footer></button>)}</aside>
        <main className="nurse-alert-detail-panel"><header><span className={`nurse-priority-pill nurse-priority-pill--${activeAlert?.severity}`}>{priorityLabels[activeAlert?.severity]}</span><h2>{activeAlert?.message || 'Chưa chọn cảnh báo'}</h2><p>{patientName(activeAlert)} · {activeAlert?.patient_code || '--'}</p></header><section><h3>Thông tin cảnh báo</h3><dl><div><dt>Loại</dt><dd>{typeLabels[activeAlert?.type] || activeAlert?.type}</dd></div><div><dt>Nguồn</dt><dd>{sourceLabels[activeAlert?.source_type] || typeLabels[activeAlert?.type] || activeAlert?.source_type}</dd></div><div><dt>Phát sinh</dt><dd>{minutesAgo(activeAlert?.created_at)}</dd></div><div><dt>Thời hạn</dt><dd>{statusLabels[activeAlert?.sla_status] || activeAlert?.sla_status}</dd></div></dl></section><section><h3>Dữ liệu nguồn</h3><p>{activeAlert?.message}</p></section><section><h3>Hành động</h3><div className="nurse-row-actions">{(activeAlert?.actions || []).map((action) => <button key={action} type="button" onClick={() => runAlertAction(action, activeAlert)}>{actionLabels[action] || action}</button>)}</div></section></main>
      </section>
    </PageShell>
  );
}

const demoQueue = {
  meta: demoPendingPatients.meta,
  summary: { total: 42, waiting: 12, called: 4, in_service: 3, skipped: 2, completed: 22, no_show: 1, recalled: 1, transferred: 0, sla_breached: 3 },
  metrics: { average_wait_minutes: 13, longest_wait_minutes: 42, throughput_per_hour: 8, estimated_clear_time: '11:45', bottleneck_status: 'vital_pending', no_show_rate: 4.2, skip_rate: 3.1, sla_breached: 3 },
  board: {
    waiting: [{ queue_ticket_id: 'q1', queue_number: 'Q012', patient_name: 'Nguyễn Văn A', patient_code: 'BN0001', age: 45, waiting_minutes: 18, status: 'waiting', nursing_stage: 'vital_pending', doctor_name: 'Bác sĩ Minh', department_name: 'Nội 01' }],
    called: [{ queue_ticket_id: 'q2', queue_number: 'Q010', patient_name: 'Trần Thị B', waiting_minutes: 2, status: 'called', nursing_stage: 'ready_for_doctor', doctor_name: 'Bác sĩ Lan' }],
    recalled: [], in_service: [], skipped: [], completed: [], no_show: [], transferred: [],
  },
  table: [],
  tv_display: {},
};
demoQueue.table = Object.values(demoQueue.board).flat();
demoQueue.tv_display = { calling: demoQueue.board.called[0], next: demoQueue.board.waiting, in_service: [] };

export function RealtimeQueuePage() {
  const [filters, setFilters] = useState({ date: toLocalDateKey(), shift: 'morning', priority: 'all', owner: 'all', type: 'all', status: 'all' });
  const [view, setView] = useState('board');
  const [refresh, setRefresh] = useState(0);
  const { data, loading, isDemo, error } = useNursingData(() => nurseOperationsApi.getQueueBoard(queryParams(filters)), demoQueue, [filters.date, filters.shift, refresh]);
  const board = data.board || {};

  async function runQueueAction(action, item = {}) {
    const id = item.queue_ticket_id || item.id || item._id;
    if (!id && action !== 'call_next') {
      notifyNurse({ tone: 'warning', title: 'Hàng đợi', message: 'Chưa có queue_ticket_id hợp lệ.' });
      return;
    }
    const transferTo = action === 'transfer'
      ? promptNurseText({ title: 'Chuyển hàng đợi', message: 'Nhập target_department_id hoặc để trống nếu chỉ ghi nhận yêu cầu chuyển.', defaultValue: '' })
      : null;
    if (action === 'transfer' && transferTo === null) return;
    await runNurseAction({
      label: action === 'call_next' ? 'Gọi tiếp theo' : action === 'call' ? 'Gọi bệnh nhân' : action === 'skip' ? 'Bỏ qua' : 'Chuyển hàng đợi',
      isDemo: isDemo || (id && String(id).startsWith('q')),
      demoMessage: 'Dữ liệu mẫu hoặc thiếu queue_ticket_id nên chưa gửi backend.',
      confirm: { title: 'Xác nhận hàng đợi', message: action === 'call_next' ? 'Gọi số tiếp theo?' : `${item.queue_number || ''} - ${patientName(item)}` },
      run: async () => {
        if (action === 'call_next') return nurseOperationsApi.callNextQueue();
        if (action === 'call') return nurseOperationsApi.callQueue(id);
        if (action === 'skip') return nurseOperationsApi.skipQueue(id, { reason: 'Điều dưỡng bỏ qua từ bảng hàng đợi.' });
        return nurseOperationsApi.transferQueue(id, { target_department_id: transferTo || undefined, reason: 'Chuyển từ bảng hàng đợi điều dưỡng.' });
      },
      successMessage: 'Đã cập nhật hàng đợi.',
      onSuccess: () => setRefresh((v) => v + 1),
    });
  }

  function renderColumn(key, title) {
    const items = board[key] || [];
    return <section key={key} className={`nurse-live-queue-column nurse-live-queue-column--${key}`}><header><strong>{title}</strong><span>{items.length}</span></header>{items.map((item) => <article key={item.queue_ticket_id || item.queue_number}><strong>{item.queue_number}</strong><h3>{patientName(item)}</h3><p>{item.patient_code || '--'} · {item.doctor_name || 'Chưa gán bác sĩ'}</p><small>Chờ {waitText(item.waiting_minutes)} · Bước điều dưỡng {nursingStageLabels[item.nursing_stage] || item.nursing_stage || '--'}</small><footer><button type="button" onClick={() => runQueueAction('call', item)}>Gọi</button><button type="button" onClick={() => runQueueAction('skip', item)}>Bỏ qua</button><button type="button" onClick={() => runQueueAction('transfer', item)}>Chuyển</button></footer></article>)}</section>;
  }

  return (
    <PageShell eyebrow="Trung tâm điều phối hàng đợi trực tiếp" title="Hàng đợi thời gian thực" description="Bảng điều phối hàng đợi theo trạng thái, bước điều dưỡng, thời hạn xử lý và tốc độ xử lý." meta={data.meta} loading={loading} isDemo={isDemo} error={error} actions={<><button type="button" onClick={() => runQueueAction('call_next')}><Zap size={16} />Gọi tiếp theo</button><button type="button" onClick={() => setView('tv')}><Monitor size={16} />Màn hình gọi số</button><button type="button" onClick={() => setRefresh((v) => v + 1)}><RefreshCw size={16} />Làm mới</button><button type="button" onClick={() => notifyNurse({ title: 'Cấu hình thời hạn', message: 'Cấu hình SLA đang dùng theo chính sách khoa/phòng backend.' })}><Filter size={16} />Cấu hình thời hạn</button></>}>
      <KpiStrip items={[
        { label: 'Tổng hàng đợi', value: data.summary?.total, detail: 'Trong ngày', icon: Users, tone: 'blue' },
        { label: 'Đang chờ', value: data.summary?.waiting, detail: 'Chưa được gọi', icon: Clock3, tone: 'amber' },
        { label: 'Đã gọi', value: data.summary?.called, detail: 'Đang chờ vào phòng', icon: Bell, tone: 'violet' },
        { label: 'Đang phục vụ', value: data.summary?.in_service, detail: 'Đang xử lý', icon: Stethoscope, tone: 'teal' },
        { label: 'Bỏ qua', value: data.summary?.skipped, detail: 'Cần gọi lại', icon: AlertTriangle, tone: 'red' },
        { label: 'Không đến', value: data.summary?.no_show, detail: 'Vắng mặt', icon: ShieldAlert, tone: 'slate' },
      ]} />
      <section className="nurse-queue-metrics"><span><strong>{data.metrics?.average_wait_minutes} phút</strong>Chờ trung bình</span><span><strong>{data.metrics?.longest_wait_minutes} phút</strong>Chờ lâu nhất</span><span><strong>{data.metrics?.throughput_per_hour}/giờ</strong>Tốc độ xử lý</span><span><strong>{data.metrics?.estimated_clear_time}</strong>Dự kiến xong</span><span><strong>{nursingStageLabels[data.metrics?.bottleneck_status] || data.metrics?.bottleneck_status}</strong>Điểm nghẽn</span><span><strong>{data.metrics?.sla_breached}</strong>Quá hạn</span></section>
      <div className="nurse-alert-tabs">{['board', 'table', 'tv'].map((item) => <button key={item} type="button" className={view === item ? 'is-active' : ''} onClick={() => setView(item)}>{item === 'board' ? 'Bảng cột' : item === 'table' ? 'Bảng chi tiết' : 'Màn hình gọi số'}</button>)}</div>
      {view === 'board' ? <section className="nurse-live-queue-board">{[['waiting', 'Đang chờ'], ['called', 'Đã gọi'], ['recalled', 'Gọi lại'], ['in_service', 'Đang phục vụ'], ['skipped', 'Bỏ qua'], ['completed', 'Hoàn tất'], ['no_show', 'Không đến']].map(([key, title]) => renderColumn(key, title))}</section> : null}
      {view === 'table' ? <div className="nurse-worklist-table-wrap"><table className="nurse-worklist-table nurse-worklist-table--wide"><thead><tr><th>Số hàng đợi</th><th>Bệnh nhân</th><th>Mã bệnh nhân</th><th>Bác sĩ</th><th>Khoa/phòng</th><th>Trạng thái</th><th>Bước điều dưỡng</th><th>Chờ</th><th>Thời hạn</th><th>Hành động</th></tr></thead><tbody>{(data.table || []).map((item) => <tr key={item.queue_ticket_id}><td><strong>{item.queue_number}</strong></td><td>{patientName(item)}</td><td>{item.patient_code || '--'}</td><td>{item.doctor_name || '--'}</td><td>{item.department_name || '--'}</td><td>{statusLabels[item.status] || item.status}</td><td>{nursingStageLabels[item.nursing_stage] || item.nursing_stage || '--'}</td><td>{waitText(item.waiting_minutes)}</td><td><span className={`nurse-sla-pill nurse-sla-pill--${item.waiting_minutes >= 30 ? 'breached' : item.waiting_minutes >= 15 ? 'warning' : 'normal'}`}>{item.waiting_minutes >= 30 ? 'Quá hạn' : item.waiting_minutes >= 15 ? 'Cảnh báo' : 'Bình thường'}</span></td><td><div className="nurse-row-actions"><button type="button" onClick={() => runQueueAction('call', item)}>Gọi</button><button type="button" onClick={() => runQueueAction('skip', item)}>Bỏ qua</button></div></td></tr>)}</tbody></table></div> : null}
      {view === 'tv' ? <section className="nurse-tv-preview"><div><span>ĐANG GỌI</span><strong>{data.tv_display?.calling?.queue_number || '--'}</strong><p>{patientName(data.tv_display?.calling || {})}</p><small>{data.tv_display?.calling?.department_name || 'Phòng khám'}</small></div><aside><span>SẮP TỚI</span>{(data.tv_display?.next || []).slice(0, 5).map((item) => <strong key={item.queue_ticket_id || item.queue_number}>{item.queue_number}</strong>)}</aside></section> : null}
    </PageShell>
  );
}
