import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FlaskConical,
  Gauge,
  History,
  ListOrdered,
  MonitorPlay,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Stethoscope,
  TreePalm,
  WandSparkles,
} from 'lucide-react';

import { schedulingApi } from '../api/schedulingApi.js';

const VIEW_CONFIG = {
  general: {
    title: 'Cấu hình chung',
    eyebrow: 'Scheduling Settings Console',
    subtitle: 'Thiết lập mặc định cho lịch hẹn, lịch làm việc, slot, check-in và queue.',
  },
  scheduleTypes: {
    title: 'Loại lịch / schedule type',
    eyebrow: 'Schedule Type Catalog',
    subtitle: 'Quản lý loại lịch, thời lượng mặc định, online booking, queue và telehealth behavior.',
  },
  templates: {
    title: 'Mẫu lịch',
    eyebrow: 'Schedule Template Builder',
    subtitle: 'Xây mẫu lịch làm việc theo khoa, bác sĩ, ngày trong tuần, ca và rule slot.',
  },
  slotRules: {
    title: 'Quy tắc tạo slot',
    eyebrow: 'Slot Generation Rules',
    subtitle: 'Cấu hình duration, capacity, hold, overbook, break time và auto-generate.',
  },
  bookingRules: {
    title: 'Quy tắc đặt lịch',
    eyebrow: 'Booking Policy',
    subtitle: 'Kiểm soát cửa sổ đặt lịch, duplicate booking, portal booking và waitlist.',
  },
  checkInRules: {
    title: 'Quy tắc check-in',
    eyebrow: 'Check-in Policy',
    subtitle: 'Cấu hình cửa sổ check-in, walk-in, xác minh bệnh nhân và auto-create queue.',
  },
  cancelRules: {
    title: 'Quy tắc hủy / dời lịch / no-show',
    eyebrow: 'Change & Recovery Policy',
    subtitle: 'Điều khiển hủy, dời lịch, no-show, reopen slot và offer waitlist.',
  },
  queueRules: {
    title: 'Quy tắc queue',
    eyebrow: 'Queue Policy',
    subtitle: 'Thiết lập chiến lược gọi số, ưu tiên, missed call, no-show và public board.',
  },
  exceptions: {
    title: 'Ngày nghỉ / ngoại lệ',
    eyebrow: 'Scheduling Exceptions',
    subtitle: 'Quản lý ngày nghỉ, bác sĩ nghỉ phép, khoa đóng, phòng tạm ngưng và impact preview.',
  },
  telehealth: {
    title: 'Telehealth',
    eyebrow: 'Virtual Care Settings',
    subtitle: 'Cấu hình provider, meeting link, check-in online, bảo mật và hướng dẫn bệnh nhân.',
  },
  notifications: {
    title: 'Thông báo lịch hẹn',
    eyebrow: 'Notification Matrix',
    subtitle: 'Cấu hình kênh gửi, template và lịch nhắc cho appointment, queue và telehealth.',
  },
  advanced: {
    title: 'Cấu hình nâng cao',
    eyebrow: 'Advanced Operations',
    subtitle: 'Feature flags, realtime, job worker, idempotency, retention và tác vụ quản trị.',
  },
};

const SETTINGS_NAV = [
  { view: 'general', label: 'Cấu hình chung', to: '/scheduling/configuration', icon: Settings2 },
  { view: 'scheduleTypes', label: 'Loại lịch', to: '/scheduling/configuration/schedule-types', icon: CalendarDays },
  { view: 'templates', label: 'Mẫu lịch', to: '/scheduling/configuration/templates', icon: CalendarCheck2 },
  { view: 'slotRules', label: 'Tạo slot', to: '/scheduling/configuration/slot-rules', icon: Clock3 },
  { view: 'bookingRules', label: 'Đặt lịch', to: '/scheduling/configuration/booking-rules', icon: ClipboardList },
  { view: 'checkInRules', label: 'Check-in', to: '/scheduling/configuration/check-in-rules', icon: ClipboardCheck },
  { view: 'cancelRules', label: 'Hủy / dời / no-show', to: '/scheduling/configuration/cancel-reschedule-no-show', icon: AlertTriangle },
  { view: 'queueRules', label: 'Queue', to: '/scheduling/configuration/queue-rules', icon: ListOrdered },
  { view: 'exceptions', label: 'Ngoại lệ', to: '/scheduling/configuration/exceptions', icon: TreePalm },
  { view: 'telehealth', label: 'Telehealth', to: '/scheduling/configuration/telehealth', icon: MonitorPlay },
  { view: 'notifications', label: 'Thông báo', to: '/scheduling/configuration/notifications', icon: BellRing },
  { view: 'advanced', label: 'Nâng cao', to: '/scheduling/configuration/advanced', icon: SlidersHorizontal },
];

const defaultSettings = [
  { key: 'scheduling.timezone', label: 'Timezone vận hành', value: 'Asia/Ho_Chi_Minh', defaultValue: 'Asia/Ho_Chi_Minh', type: 'string', group: 'Thời gian & timezone', description: 'Timezone dùng để tính ngày vận hành, SLA và nhắc lịch.' },
  { key: 'scheduling.default_slot_duration_minutes', label: 'Slot duration mặc định', value: 30, defaultValue: 30, type: 'number', group: 'Mặc định slot', description: 'Thời lượng slot mặc định khi tạo lịch làm việc mới.' },
  { key: 'scheduling.default_schedule_publish_mode', label: 'Chế độ publish mặc định', value: 'manual', defaultValue: 'manual', type: 'string', group: 'Mặc định lịch làm việc', description: 'Manual giúp trưởng khoa kiểm tra trước khi mở đặt lịch.' },
  { key: 'scheduling.enable_waitlist', label: 'Bật danh sách chờ', value: true, defaultValue: true, type: 'boolean', group: 'Lịch hẹn', description: 'Cho phép đưa bệnh nhân vào waitlist khi slot hết.' },
  { key: 'scheduling.enable_telehealth', label: 'Bật telehealth', value: true, defaultValue: true, type: 'boolean', group: 'Lịch hẹn', description: 'Cho phép tạo lịch hẹn tư vấn từ xa.' },
  { key: 'scheduling.enable_queue_auto_create_on_checkin', label: 'Check-in tự tạo queue', value: true, defaultValue: true, type: 'boolean', group: 'Queue', description: 'Khi check-in lịch hẹn, tự tạo queue ticket nếu chưa có.' },
  { key: 'scheduling.default_checkin_window_before_minutes', label: 'Check-in sớm tối đa', value: 30, defaultValue: 30, type: 'number', group: 'Check-in', description: 'Số phút bệnh nhân được check-in trước giờ hẹn.' },
  { key: 'scheduling.default_checkin_window_after_minutes', label: 'Check-in trễ tối đa', value: 15, defaultValue: 15, type: 'number', group: 'Check-in', description: 'Số phút bệnh nhân vẫn được check-in sau giờ hẹn.' },
  { key: 'scheduling.alert.queue_wait_threshold_minutes', label: 'Ngưỡng cảnh báo queue', value: 30, defaultValue: 30, type: 'number', group: 'Cảnh báo vận hành', description: 'Queue chờ quá ngưỡng sẽ vào action center.' },
];

const scheduleTypeFallback = [
  { code: 'specialist_consultation', name: 'Khám chuyên khoa', category: 'clinical', duration: 30, capacity: 1, online: true, queue: true, telehealth: false, status: 'active' },
  { code: 'follow_up', name: 'Tái khám', category: 'clinical', duration: 20, capacity: 1, online: true, queue: true, telehealth: false, status: 'active' },
  { code: 'telemedicine', name: 'Tư vấn từ xa', category: 'telehealth', duration: 20, capacity: 1, online: true, queue: false, telehealth: true, status: 'active' },
  { code: 'procedure_minor', name: 'Thủ thuật / tiểu phẫu', category: 'procedure', duration: 45, capacity: 1, online: false, queue: true, telehealth: false, status: 'active' },
  { code: 'imaging', name: 'Chẩn đoán hình ảnh', category: 'diagnostics', duration: 30, capacity: 1, online: false, queue: true, telehealth: false, status: 'draft' },
  { code: 'lab_sample', name: 'Xét nghiệm / lấy mẫu', category: 'diagnostics', duration: 15, capacity: 1, online: true, queue: true, telehealth: false, status: 'active' },
];

const templateFallback = [
  { id: 'tpl-1', name: 'Nội tổng quát sáng T2-T6', scope: 'Khoa Nội tổng quát', days: ['T2', 'T3', 'T4', 'T5', 'T6'], start: '07:00', end: '11:30', duration: 30, scheduleType: 'Khám chuyên khoa', status: 'active', lastUsed: '2 ngày trước' },
  { id: 'tpl-2', name: 'Telehealth tối T3/T5', scope: 'Toàn viện', days: ['T3', 'T5'], start: '18:00', end: '21:00', duration: 20, scheduleType: 'Tư vấn từ xa', status: 'active', lastUsed: 'Tuần trước' },
  { id: 'tpl-3', name: 'Tái khám cuối tuần', scope: 'Khoa Tim mạch', days: ['T7'], start: '08:00', end: '11:00', duration: 20, scheduleType: 'Tái khám', status: 'draft', lastUsed: 'Chưa dùng' },
];

const ruleFallback = {
  slotRules: [
    { name: 'Slot chuẩn outpatient', scope: 'Toàn viện', primary: '30 phút', secondary: 'Capacity 1', flags: ['Auto generate khi publish', 'Hold 10 phút', 'Không overbook'], status: 'active' },
    { name: 'Slot tái khám nhanh', scope: 'Khoa Tim mạch', primary: '20 phút', secondary: 'Capacity 1', flags: ['Break 09:30-09:45', 'Portal ON'], status: 'active' },
  ],
  bookingRules: [
    { name: 'Cửa sổ đặt lịch chuẩn', scope: 'Toàn viện', primary: 'Tối đa 30 ngày', secondary: 'Tối thiểu 60 phút', flags: ['Chặn trùng bệnh nhân cùng ngày', 'Validate doctor conflict', 'Cho phép waitlist'], status: 'active' },
    { name: 'Portal booking', scope: 'Patient portal', primary: 'Cần xác nhận nhân viên', secondary: 'Hold slot 10 phút', flags: ['Không cho đặt slot staff-only', 'Gửi confirmation'], status: 'active' },
  ],
  checkInRules: [
    { name: 'Check-in chuẩn', scope: 'Toàn viện', primary: '-30 / +15 phút', secondary: 'Auto queue ON', flags: ['Chặn duplicate active queue', 'Yêu cầu xác minh danh tính'], status: 'active' },
    { name: 'Walk-in giờ hành chính', scope: 'Reception', primary: '07:00-17:00', secondary: 'Queue normal', flags: ['Cần chọn khoa', 'Có thể ưu tiên nếu emergency'], status: 'active' },
  ],
  cancelRules: [
    { name: 'Hủy lịch bệnh nhân', scope: 'Portal', primary: 'Trước 120 phút', secondary: 'Reopen slot', flags: ['Cần lý do', 'Offer waitlist nếu có'], status: 'active' },
    { name: 'No-show tự động', scope: 'Queue + appointment', primary: 'Sau 20 phút', secondary: 'Staff confirm', flags: ['Không reopen nếu đã in_service', 'Ghi risk score'], status: 'draft' },
  ],
  queueRules: [
    { name: 'Gọi số theo ưu tiên', scope: 'Toàn viện', primary: 'VIP > Priority > Normal', secondary: 'Theo check-in time', flags: ['Không gọi nếu bác sĩ đang in_service', 'Skip called cũ'], status: 'active' },
    { name: 'Missed call', scope: 'Public board', primary: 'Recall tối đa 3 lần', secondary: 'No-show sau 10 phút', flags: ['Ẩn tên bệnh nhân', 'Highlight số mới gọi'], status: 'active' },
  ],
};

const exceptionFallback = [
  { id: 'ex-1', name: 'Nghỉ lễ Quốc khánh', type: 'Toàn viện', start: '2026-09-02', end: '2026-09-02', impact: '42 lịch · 520 slot', status: 'planned' },
  { id: 'ex-2', name: 'BS. Trần Thanh Hải nghỉ phép', type: 'Bác sĩ', start: '2026-06-03', end: '2026-06-04', impact: '3 lịch · 18 appointment cần dời', status: 'needs_review' },
  { id: 'ex-3', name: 'Phòng khám P.203 bảo trì', type: 'Phòng', start: '2026-05-30', end: '2026-05-30', impact: '2 queue board · 1 ca chiều', status: 'draft' },
];

const notificationFallback = [
  { event: 'Appointment created', email: true, push: true, inApp: true, sms: false, timing: 'Ngay khi tạo' },
  { event: 'Appointment reminder 24h', email: true, push: true, inApp: true, sms: false, timing: 'Trước 24 giờ' },
  { event: 'Appointment rescheduled', email: true, push: true, inApp: true, sms: false, timing: 'Ngay khi dời' },
  { event: 'Queue called', email: false, push: true, inApp: true, sms: false, timing: 'Khi gọi số' },
  { event: 'Telehealth link', email: true, push: true, inApp: true, sms: false, timing: 'Trước 2 giờ' },
];

const advancedFallback = [
  { key: 'patient_flow_enabled', label: 'Patient flow board', enabled: true, group: 'Feature flags' },
  { key: 'waitlist_enabled', label: 'Waitlist automation', enabled: true, group: 'Feature flags' },
  { key: 'broadcast_queue_changes', label: 'Realtime queue events', enabled: true, group: 'Realtime' },
  { key: 'broadcast_slot_changes', label: 'Realtime slot events', enabled: false, group: 'Realtime' },
  { key: 'release_expired_hold_enabled', label: 'Release expired held slots', enabled: true, group: 'Jobs' },
  { key: 'audit_verbose_enabled', label: 'Verbose scheduling audit', enabled: true, group: 'Audit' },
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.settings)) return value.settings;
  if (Array.isArray(value?.schedule_types)) return value.schedule_types;
  if (Array.isArray(value?.templates)) return value.templates;
  if (Array.isArray(value?.rules)) return value.rules;
  if (Array.isArray(value?.exceptions)) return value.exceptions;
  if (Array.isArray(value?.notifications)) return value.notifications;
  return [];
}

function unwrap(settled) {
  return settled?.status === 'fulfilled' ? settled.value : null;
}

function normalizeSetting(item) {
  return {
    key: item.setting_key || item.key || item.id,
    label: item.setting_name || item.name || item.label || item.setting_key || item.key,
    value: item.setting_value ?? item.value ?? item.default_value,
    defaultValue: item.default_value ?? item.defaultValue,
    type: item.value_type || item.type || typeof (item.setting_value ?? item.value),
    group: item.group || item.module_key || item.category || 'Scheduling',
    description: item.description || 'Cấu hình vận hành lịch.',
    sensitive: Boolean(item.is_sensitive || item.is_encrypted),
  };
}

function statusLabel(status) {
  const map = {
    active: 'Đang bật',
    draft: 'Nháp',
    planned: 'Đã lên kế hoạch',
    needs_review: 'Cần rà soát',
    inactive: 'Tạm tắt',
  };
  return map[status] || status || 'Đang bật';
}

function boolText(value) {
  return value ? 'ON' : 'OFF';
}

export function SchedulingSettingsCommandPage({ view = 'general' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.general;
  const [filters, setFilters] = useState({ scope: 'system', department: '', keyword: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState({
    overview: null,
    settings: defaultSettings,
    viewItems: [],
  });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');
      const params = { ...filters, module_key: 'scheduling' };
      const viewCall = getViewCall(view, params);
      const results = await Promise.allSettled([
        schedulingApi.getSchedulingConfigOverview?.(params),
        schedulingApi.getSchedulingConfigSettings?.(params),
        schedulingApi.getGroupedSystemSettings?.(params),
        schedulingApi.listSystemSettings?.(params),
        viewCall,
      ]);

      if (ignore) return;

      const overview = unwrap(results[0]) || {};
      const configSettings = asArray(unwrap(results[1]));
      const groupedSettings = flattenGroupedSettings(unwrap(results[2]));
      const systemSettings = asArray(unwrap(results[3]));
      const settings = [...configSettings, ...groupedSettings, ...systemSettings].map(normalizeSetting);
      const viewItems = asArray(unwrap(results[4]));

      setData({
        overview,
        settings: settings.length ? settings : defaultSettings,
        viewItems,
      });

      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length >= results.length - 1) {
        setError('Đang dùng dữ liệu mẫu vì API cấu hình vận hành chưa sẵn sàng.');
      }
      setLoading(false);
    }

    load().catch((err) => {
      if (ignore) return;
      setError(err?.message || 'Không tải được cấu hình vận hành.');
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [view, filters.scope, filters.department]);

  const kpis = useMemo(() => buildKpis(view, data), [view, data]);

  function handleSave(payload) {
    setNotice(`${payload?.label || 'Cấu hình'} đã được ghi nhận trong phiên làm việc. Backend sẽ lưu thật khi endpoint cấu hình được bật.`);
  }

  return (
    <section className="sched-settings-page">
      <SettingsHero
        config={config}
        filters={filters}
        onFilterChange={setFilters}
        onRefresh={() => setFilters((current) => ({ ...current }))}
      />

      <div className="sched-settings-kpis">
        {kpis.map((item) => (
          <article className="sched-settings-kpi" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.caption}</small>
          </article>
        ))}
      </div>

      <SettingsNav activeView={view} />

      {notice ? (
        <div className="sched-settings-notice">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>Đóng</button>
        </div>
      ) : null}

      {error ? (
        <div className="sched-settings-warning">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <SettingsView
          view={view}
          data={data}
          filters={filters}
          onSelect={setSelected}
          onSave={handleSave}
        />
      )}

      {selected ? (
        <SettingsDrawer item={selected} onClose={() => setSelected(null)} onSave={handleSave} />
      ) : null}
    </section>
  );
}

function getViewCall(view, params) {
  const calls = {
    scheduleTypes: schedulingApi.getSchedulingConfigScheduleTypes,
    templates: schedulingApi.getSchedulingConfigTemplates,
    slotRules: schedulingApi.getSchedulingConfigSlotRules,
    bookingRules: schedulingApi.getSchedulingConfigBookingRules,
    checkInRules: schedulingApi.getSchedulingConfigCheckInRules,
    cancelRules: schedulingApi.getSchedulingConfigCancelRescheduleNoShow,
    queueRules: schedulingApi.getSchedulingConfigQueueRules,
    exceptions: schedulingApi.getSchedulingConfigExceptions,
    telehealth: schedulingApi.getSchedulingConfigTelehealth,
    notifications: schedulingApi.getSchedulingConfigNotifications,
  };
  const call = calls[view];
  return call ? call(params) : Promise.resolve(null);
}

function flattenGroupedSettings(value) {
  if (!value || Array.isArray(value)) return asArray(value);
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.data)) return value.data;
  return Object.values(value).flatMap((group) => asArray(group));
}

function buildKpis(view, data) {
  if (view === 'scheduleTypes') {
    const items = data.viewItems.length ? data.viewItems : scheduleTypeFallback;
    return [
      { label: 'Tổng loại lịch', value: items.length, caption: 'Catalog đang cấu hình' },
      { label: 'Đang active', value: items.filter((item) => (item.status || 'active') === 'active').length, caption: 'Có thể dùng khi tạo lịch' },
      { label: 'Telehealth', value: items.filter((item) => item.telehealth || item.is_telehealth).length, caption: 'Cho tư vấn từ xa' },
      { label: 'Portal booking', value: items.filter((item) => item.online || item.allow_online_booking).length, caption: 'Bệnh nhân tự đặt' },
    ];
  }
  if (view === 'templates') {
    const items = data.viewItems.length ? data.viewItems : templateFallback;
    return [
      { label: 'Tổng mẫu', value: items.length, caption: 'Template lịch làm việc' },
      { label: 'Active', value: items.filter((item) => (item.status || 'active') === 'active').length, caption: 'Có thể áp dụng' },
      { label: 'Có preview', value: items.length, caption: 'Xem trước trước khi tạo' },
      { label: 'Cần duyệt', value: items.filter((item) => item.status === 'draft').length, caption: 'Chưa dùng sản xuất' },
    ];
  }
  if (view === 'advanced') {
    return [
      { label: 'Feature flags', value: advancedFallback.length, caption: 'Được quản lý trong console' },
      { label: 'Realtime ON', value: 2, caption: 'Queue và patient flow' },
      { label: 'Jobs bật', value: 1, caption: 'Release hold / reminders' },
      { label: 'Audit verbose', value: 'ON', caption: 'Ghi chi tiết thay đổi' },
    ];
  }
  return [
    { label: 'Setting khả dụng', value: data.settings.length, caption: 'SystemSetting + scheduling-config' },
    { label: 'Scope', value: 'System', caption: 'Sẵn sàng mở rộng theo khoa' },
    { label: 'Rule test', value: 'ON', caption: 'Có panel mô phỏng' },
    { label: 'Audit', value: 'Bắt buộc', caption: 'Mọi thay đổi cần ghi log' },
  ];
}

function SettingsHero({ config, filters, onFilterChange, onRefresh }) {
  return (
    <header className="sched-settings-hero">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
        <small><i /> Settings schema + simulator + impact preview</small>
      </div>
      <div className="sched-settings-hero__tools">
        <label>
          Scope
          <select value={filters.scope} onChange={(event) => onFilterChange((current) => ({ ...current, scope: event.target.value }))}>
            <option value="system">Toàn viện</option>
            <option value="department">Theo khoa</option>
            <option value="doctor">Theo bác sĩ</option>
          </select>
        </label>
        <label>
          Khoa
          <input value={filters.department} onChange={(event) => onFilterChange((current) => ({ ...current, department: event.target.value }))} placeholder="Tất cả khoa" />
        </label>
        <button type="button" onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button>
        <Link to="/scheduling/activity"><History size={16} /> Nhật ký cấu hình</Link>
      </div>
    </header>
  );
}

function SettingsNav({ activeView }) {
  return (
    <nav className="sched-settings-nav" aria-label="Scheduling settings sections">
      {SETTINGS_NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link className={activeView === item.view ? 'is-active' : ''} key={item.view} to={item.to}>
            <Icon size={16} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsView({ view, data, filters, onSelect, onSave }) {
  if (view === 'scheduleTypes') {
    return <ScheduleTypesView items={data.viewItems.length ? data.viewItems : scheduleTypeFallback} onSelect={onSelect} />;
  }
  if (view === 'templates') {
    return <TemplatesView items={data.viewItems.length ? data.viewItems : templateFallback} onSelect={onSelect} />;
  }
  if (['slotRules', 'bookingRules', 'checkInRules', 'cancelRules', 'queueRules'].includes(view)) {
    return <RuleConsole view={view} items={data.viewItems.length ? data.viewItems : ruleFallback[view]} onSelect={onSelect} onSave={onSave} />;
  }
  if (view === 'exceptions') {
    return <ExceptionsView items={data.viewItems.length ? data.viewItems : exceptionFallback} onSelect={onSelect} />;
  }
  if (view === 'telehealth') {
    return <TelehealthView onSave={onSave} />;
  }
  if (view === 'notifications') {
    return <NotificationsView items={data.viewItems.length ? data.viewItems : notificationFallback} onSave={onSave} />;
  }
  if (view === 'advanced') {
    return <AdvancedView onSave={onSave} />;
  }
  return <GeneralSettingsView settings={data.settings} filters={filters} onSave={onSave} onSelect={onSelect} />;
}

function GeneralSettingsView({ settings, onSave, onSelect }) {
  const grouped = settings.reduce((acc, item) => {
    const group = item.group || 'Scheduling';
    acc[group] = acc[group] || [];
    acc[group].push(item);
    return acc;
  }, {});

  return (
    <div className="sched-settings-layout">
      <div className="sched-settings-main">
        {Object.entries(grouped).map(([group, items]) => (
          <section className="sched-settings-section" key={group}>
            <header>
              <h2>{group}</h2>
              <p>{items.length} cấu hình · có audit khi thay đổi</p>
            </header>
            <div className="sched-settings-grid">
              {items.map((setting) => (
                <article className="sched-setting-card" key={setting.key}>
                  <div>
                    <span>{setting.key}</span>
                    <h3>{setting.label}</h3>
                    <p>{setting.description}</p>
                  </div>
                  <SettingControl setting={setting} />
                  <footer>
                    <small>Default: {String(setting.defaultValue ?? '-')}</small>
                    <button type="button" onClick={() => onSelect(setting)}>Chi tiết</button>
                    <button type="button" onClick={() => onSave(setting)}><Save size={14} /> Lưu</button>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <SettingsPreviewPanel />
    </div>
  );
}

function SettingControl({ setting }) {
  if (setting.sensitive) {
    return <input type="password" defaultValue="********" aria-label={setting.label} />;
  }
  if (setting.type === 'boolean') {
    return (
      <label className="sched-settings-toggle">
        <input type="checkbox" defaultChecked={Boolean(setting.value)} />
        <span>{boolText(Boolean(setting.value))}</span>
      </label>
    );
  }
  if (setting.type === 'number') {
    return <input type="number" defaultValue={Number(setting.value) || 0} aria-label={setting.label} />;
  }
  return <input defaultValue={String(setting.value ?? '')} aria-label={setting.label} />;
}

function ScheduleTypesView({ items, onSelect }) {
  return (
    <div className="sched-settings-main">
      <section className="sched-settings-section">
        <header>
          <h2>Catalog loại lịch</h2>
          <p>Loại lịch là nơi gắn duration, portal behavior, queue behavior và telehealth.</p>
        </header>
        <div className="sched-schedule-type-grid">
          {items.map((item) => (
            <article className="sched-schedule-type-card" key={item.id || item.code || item.name}>
              <header>
                <span>{item.code || item.category}</span>
                <strong>{item.name}</strong>
              </header>
              <div className="sched-type-metrics">
                <span><Clock3 size={15} /> {item.duration || item.default_duration_minutes || 30} phút</span>
                <span><Gauge size={15} /> Capacity {item.capacity || item.default_capacity || 1}</span>
              </div>
              <div className="sched-type-badges">
                <b>{item.online || item.allow_online_booking ? 'Portal ON' : 'Staff only'}</b>
                <b>{item.queue || item.auto_create_queue_on_checkin ? 'Queue ON' : 'No queue'}</b>
                <b>{item.telehealth || item.is_telehealth ? 'Telehealth' : 'Onsite'}</b>
              </div>
              <footer>
                <small>{statusLabel(item.status)}</small>
                <button type="button" onClick={() => onSelect(item)}>Mở cấu hình</button>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function TemplatesView({ items, onSelect }) {
  const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  return (
    <div className="sched-settings-layout">
      <div className="sched-settings-main">
        <section className="sched-settings-section">
          <header>
            <h2>Template lịch làm việc</h2>
            <p>Template giúp tạo lịch nhiều bác sĩ theo tuần/tháng nhưng vẫn preview conflict trước khi áp dụng.</p>
          </header>
          <div className="sched-template-list">
            {items.map((item) => (
              <article className="sched-template-card" key={item.id || item.name}>
                <header>
                  <span>{item.scope}</span>
                  <strong>{item.name}</strong>
                </header>
                <div className="sched-template-days">
                  {weekdays.map((day) => <b className={item.days?.includes(day) ? 'is-on' : ''} key={day}>{day}</b>)}
                </div>
                <p>{item.start} - {item.end} · {item.duration} phút/slot · {item.scheduleType}</p>
                <footer>
                  <small>{statusLabel(item.status)} · {item.lastUsed}</small>
                  <button type="button" onClick={() => onSelect(item)}>Preview / áp dụng</button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside className="sched-template-builder">
        <span><WandSparkles size={16} /> Builder preview</span>
        <h3>Tuần mẫu</h3>
        <div className="sched-week-grid">
          {weekdays.map((day, index) => (
            <button className={index < 5 ? 'is-on' : ''} type="button" key={day}>
              <strong>{day}</strong>
              <small>{index < 5 ? '07:00-11:30' : 'Nghỉ'}</small>
            </button>
          ))}
        </div>
        <div className="sched-impact-preview">
          <b>Preview impact</b>
          <span>56 lịch sẽ tạo · 1 conflict · 840 slot dự kiến</span>
        </div>
      </aside>
    </div>
  );
}

function RuleConsole({ view, items, onSelect, onSave }) {
  const simulator = {
    slotRules: { title: 'Preview sinh slot', result: 'Ca 08:00-12:00 tạo 7 slot, bỏ qua break 10:00-10:15.' },
    bookingRules: { title: 'Test booking rule', result: 'Pass · Slot hợp lệ · Không trùng lịch bệnh nhân.' },
    checkInRules: { title: 'Test check-in', result: 'Allowed · Bệnh nhân đến sớm 20 phút, nằm trong cửa sổ.' },
    cancelRules: { title: 'Impact preview', result: '42 lịch 30 ngày qua sẽ bị chặn hủy nếu áp rule mới.' },
    queueRules: { title: 'Simulate call-next', result: 'Ticket NTQ-P012 được gọi vì priority cao hơn normal.' },
  }[view];

  return (
    <div className="sched-settings-layout">
      <div className="sched-settings-main">
        <section className="sched-settings-section">
          <header>
            <h2>Rule cards</h2>
            <p>Rule nên có scope, priority, preview/test và audit trước khi bật sản xuất.</p>
          </header>
          <div className="sched-rule-grid">
            {items.map((item) => (
              <article className="sched-rule-card" key={item.id || item.name}>
                <header>
                  <span>{item.scope}</span>
                  <strong>{item.name}</strong>
                </header>
                <div className="sched-rule-primary">
                  <b>{item.primary}</b>
                  <small>{item.secondary}</small>
                </div>
                <ul>
                  {(item.flags || []).map((flag) => <li key={flag}>{flag}</li>)}
                </ul>
                <footer>
                  <small>{statusLabel(item.status)}</small>
                  <button type="button" onClick={() => onSelect(item)}>Chi tiết</button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside className="sched-rule-simulator">
        <span><FlaskConical size={16} /> Simulator</span>
        <h3>{simulator.title}</h3>
        <label>
          Bệnh nhân / bác sĩ / khoa
          <input defaultValue="BN000123 · BS. Trần Thanh Hải · Nội tổng quát" />
        </label>
        <label>
          Ngày giờ giả lập
          <input defaultValue="2026-05-23 09:00" />
        </label>
        <button type="button" onClick={() => onSave({ label: simulator.title })}>Chạy kiểm tra</button>
        <div className="sched-simulator-result">
          <CheckCircle2 size={18} />
          <span>{simulator.result}</span>
        </div>
      </aside>
    </div>
  );
}

function ExceptionsView({ items, onSelect }) {
  return (
    <div className="sched-settings-layout">
      <div className="sched-settings-main">
        <section className="sched-settings-section">
          <header>
            <h2>Ngoại lệ vận hành</h2>
            <p>Tạo ngoại lệ phải có impact preview tới lịch, slot, appointment và notification.</p>
          </header>
          <div className="sched-exception-list">
            {items.map((item) => (
              <article className="sched-exception-card" key={item.id || item.name}>
                <header>
                  <span>{item.type}</span>
                  <strong>{item.name}</strong>
                </header>
                <p>{item.start} → {item.end}</p>
                <div><AlertTriangle size={16} /> {item.impact}</div>
                <footer>
                  <small>{statusLabel(item.status)}</small>
                  <button type="button" onClick={() => onSelect(item)}>Preview impact</button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside className="sched-calendar-preview">
        <span><CalendarClock size={16} /> Month view</span>
        <div className="sched-month-grid">
          {Array.from({ length: 35 }).map((_, index) => (
            <button className={[3, 14, 21].includes(index) ? 'has-exception' : ''} type="button" key={index}>
              {index + 1}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function TelehealthView({ onSave }) {
  return (
    <div className="sched-settings-layout">
      <div className="sched-settings-main">
        <section className="sched-settings-section">
          <header>
            <h2>Telehealth provider & room rules</h2>
            <p>Cấu hình link khám online, mở phòng trước giờ hẹn và kiểm tra danh tính bệnh nhân.</p>
          </header>
          <div className="sched-settings-grid">
            {[
              ['Trạng thái', 'Enabled', 'Cho phép lịch tư vấn từ xa'],
              ['Provider', 'Internal / Manual', 'Có thể nối Zoom/Google Meet sau'],
              ['Mở phòng trước', '15 phút', 'Bệnh nhân vào phòng chờ online'],
              ['Đóng phòng sau', '30 phút', 'Tự hết hạn link sau giờ khám'],
              ['Identity check', 'Required', 'Yêu cầu xác minh bệnh nhân'],
              ['Recording', 'OFF', 'Không ghi hình mặc định'],
            ].map(([label, value, desc]) => (
              <article className="sched-setting-card" key={label}>
                <div>
                  <span>telehealth</span>
                  <h3>{label}</h3>
                  <p>{desc}</p>
                </div>
                <strong>{value}</strong>
                <footer>
                  <small>Scope: toàn viện</small>
                  <button type="button" onClick={() => onSave({ label })}>Lưu</button>
                </footer>
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside className="sched-telehealth-preview">
        <span><MonitorPlay size={16} /> Patient preview</span>
        <h3>Link khám online</h3>
        <p>Phòng tư vấn sẽ mở trước giờ hẹn 15 phút. Bệnh nhân cần xác minh danh tính trước khi vào phòng.</p>
        <button type="button" onClick={() => onSave({ label: 'Test provider' })}>Test provider</button>
      </aside>
    </div>
  );
}

function NotificationsView({ items, onSave }) {
  return (
    <div className="sched-settings-layout">
      <div className="sched-settings-main">
        <section className="sched-settings-section">
          <header>
            <h2>Notification matrix</h2>
            <p>SMS mặc định tắt để kiểm soát chi phí; email, push và in-app dùng cho lịch/queue.</p>
          </header>
          <div className="sched-notification-table">
            <div className="sched-notification-row is-head">
              <span>Event</span><span>Email</span><span>Push</span><span>In-app</span><span>SMS</span><span>Thời điểm</span>
            </div>
            {items.map((item) => (
              <div className="sched-notification-row" key={item.event || item.id}>
                <strong>{item.event || item.name}</strong>
                <b>{boolText(item.email)}</b>
                <b>{boolText(item.push)}</b>
                <b>{boolText(item.inApp || item.in_app)}</b>
                <b>{boolText(item.sms)}</b>
                <span>{item.timing || item.schedule || 'Theo event'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <aside className="sched-template-editor">
        <span><BellRing size={16} /> Template preview</span>
        <h3>Appointment reminder 24h</h3>
        <p>Xin chào {'{{patient_name}}'}, bạn có lịch khám với {'{{doctor_name}}'} lúc {'{{appointment_time}}'}.</p>
        <button type="button" onClick={() => onSave({ label: 'Notification test' })}>Gửi test</button>
      </aside>
    </div>
  );
}

function AdvancedView({ onSave }) {
  return (
    <div className="sched-settings-layout">
      <div className="sched-settings-main">
        <section className="sched-settings-section">
          <header>
            <h2>Feature flags & system controls</h2>
            <p>Chỉ admin/super admin nên có quyền chỉnh phần này vì ảnh hưởng realtime, jobs và audit.</p>
          </header>
          <div className="sched-advanced-grid">
            {advancedFallback.map((item) => (
              <article className="sched-advanced-card" key={item.key}>
                <span>{item.group}</span>
                <strong>{item.label}</strong>
                <label className="sched-settings-toggle">
                  <input type="checkbox" defaultChecked={item.enabled} />
                  <span>{boolText(item.enabled)}</span>
                </label>
              </article>
            ))}
          </div>
        </section>
      </div>
      <aside className="sched-danger-zone">
        <span><ShieldAlert size={16} /> Danger zone</span>
        <h3>Tác vụ quản trị</h3>
        {['Rebuild slot utilization cache', 'Release expired held slots', 'Recompute queue SLA', 'Recompute no-show stats'].map((action) => (
          <button type="button" key={action} onClick={() => onSave({ label: action })}>{action}</button>
        ))}
      </aside>
    </div>
  );
}

function SettingsPreviewPanel() {
  return (
    <aside className="sched-settings-preview">
      <span><Gauge size={16} /> Impact preview</span>
      <h3>Thay đổi cấu hình cần kiểm tra tác động</h3>
      <ul>
        <li>42 lịch trong 30 ngày gần nhất dùng rule này.</li>
        <li>18 appointment có thể bị đổi trạng thái nếu bật auto no-show.</li>
        <li>Queue board cần realtime event để đồng bộ public board.</li>
      </ul>
      <button type="button">Xem thay đổi</button>
    </aside>
  );
}

function SettingsDrawer({ item, onClose, onSave }) {
  return (
    <aside className="sched-settings-drawer">
      <header>
        <div>
          <span>Configuration detail</span>
          <h2>{item.label || item.name || item.key || item.code}</h2>
        </div>
        <button type="button" onClick={onClose}>Đóng</button>
      </header>
      <section>
        <h3>Tổng quan</h3>
        <dl>
          {Object.entries(item).slice(0, 10).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{Array.isArray(value) ? value.join(', ') : String(value ?? '-')}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>Checklist trước khi lưu</h3>
        <ul>
          <li>Validate rule bằng simulator.</li>
          <li>Preview impact với lịch/slot/appointment hiện có.</li>
          <li>Ghi audit settings.update hoặc scheduling-config.update.</li>
        </ul>
      </section>
      <footer>
        <button type="button" onClick={() => onSave(item)}><Save size={15} /> Lưu thay đổi</button>
        <button type="button" onClick={onClose}>Hủy</button>
      </footer>
    </aside>
  );
}

function SettingsSkeleton() {
  return (
    <div className="sched-settings-skeleton">
      {Array.from({ length: 6 }).map((_, index) => <span key={index} />)}
    </div>
  );
}
