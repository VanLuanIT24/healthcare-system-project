import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Filter,
  Loader2,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Stethoscope,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { receptionAppointmentsApi } from '../api/receptionAppointmentsApi';

const STATUS_META = {
  booked: { label: 'Booked', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  checked_in: { label: 'Checked-in', tone: 'teal' },
  in_consultation: { label: 'In consultation', tone: 'violet' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'warning' },
  no_show: { label: 'No-show', tone: 'danger' },
  rescheduled: { label: 'Rescheduled', tone: 'violet' },
};

const APPOINTMENT_TYPES = [
  { value: 'outpatient', label: 'Khám ngoại trú' },
  { value: 'inpatient_followup', label: 'Tái khám nội trú' },
  { value: 'emergency', label: 'Cấp cứu' },
  { value: 'telemedicine', label: 'Khám từ xa' },
  { value: 'vaccination', label: 'Tiêm chủng' },
  { value: 'procedure', label: 'Thủ thuật' },
];

const LIST_MODE_CONFIG = {
  all: {
    title: 'Tất cả lịch hẹn',
    subtitle: 'Quản lý, tìm kiếm và thao tác với toàn bộ lịch hẹn.',
    empty: 'Chưa có lịch hẹn phù hợp với bộ lọc hiện tại.',
  },
  today: {
    title: 'Lịch hẹn hôm nay',
    subtitle: 'Theo dõi lịch khám trong ngày và check-in nhanh tại quầy.',
    empty: 'Không có lịch hẹn trong ngày.',
  },
  upcoming: {
    title: 'Lịch sắp tới',
    subtitle: 'Theo dõi các lịch hẹn từ hiện tại trở đi để chủ động xác nhận và nhắc bệnh nhân.',
    empty: 'Không có lịch sắp tới phù hợp với bộ lọc hiện tại.',
  },
  confirm: {
    title: 'Xác nhận lịch',
    subtitle: 'Danh sách lịch booked cần lễ tân gọi điện hoặc xác nhận với bệnh nhân.',
    empty: 'Không có lịch nào đang chờ xác nhận.',
    forcedStatus: 'booked',
  },
  reschedule: {
    title: 'Dời lịch',
    subtitle: 'Tra cứu lịch còn hoạt động và thực hiện dời lịch theo chính sách backend.',
    empty: 'Không có lịch nào phù hợp để dời trong bộ lọc hiện tại.',
  },
  cancelled: {
    title: 'Lịch đã hủy',
    subtitle: 'Tra cứu lịch hủy, lý do hủy, timeline thao tác và đặt lại lịch khi cần.',
    empty: 'Không có lịch hủy trong khoảng thời gian này.',
    forcedStatus: 'cancelled',
  },
  no_show: {
    title: 'Lịch no-show',
    subtitle: 'Tra cứu bệnh nhân không đến khám theo lịch để xử lý chăm sóc hoặc đặt lại lịch.',
    empty: 'Không có lịch no-show trong khoảng thời gian này.',
    forcedStatus: 'no_show',
  },
};

const SUMMARY_ITEMS = [
  { key: 'total', label: 'Tổng lịch' },
  { key: 'booked', label: 'Booked' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Checked-in' },
  { key: 'in_consultation', label: 'Đang khám' },
  { key: 'completed', label: 'Hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: 'no_show', label: 'No-show' },
];

const TODAY_TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'booked', label: 'Cần xác nhận' },
  { key: 'confirmed', label: 'Chờ check-in' },
  { key: 'checked_in', label: 'Đã check-in' },
  { key: 'in_consultation', label: 'Đang khám' },
  { key: 'completed', label: 'Hoàn tất' },
  { key: 'late', label: 'Trễ giờ' },
];

const DATE_SORT_MODES = new Set(['today', 'upcoming', 'confirm', 'reschedule', 'cancelled', 'no_show']);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDaysToDateKey(value, amount) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return todayKey();
  base.setDate(base.getDate() + amount);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatDateHeading(value) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return 'Chưa chọn ngày';
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '--';
  return `${formatTime(value)} · ${formatDate(value)}`;
}

function formatInteger(value) {
  return new Intl.NumberFormat('vi-VN').format(toNumber(value));
}

function getAppointmentId(item) {
  return item?.appointment_id || item?.id || item?._id || '';
}

function getPatientId(item) {
  return item?.patient_id || item?.id || item?._id || '';
}

function getTypeLabel(type) {
  return APPOINTMENT_TYPES.find((item) => item.value === type)?.label || type || '--';
}

function getStatusMeta(status) {
  return STATUS_META[status] || { label: status || '--', tone: 'neutral' };
}

function getDefaultDateFilters(mode) {
  if (mode === 'all') {
    return {
      date_from: '',
      date_to: '',
    };
  }

  return {
    date_from: todayKey(),
    date_to: todayKey(),
  };
}

function getErrorMessage(error, fallback = 'Không thể xử lý yêu cầu.') {
  return error?.payload?.message || error?.message || fallback;
}

function isLateAppointment(item) {
  if (!['booked', 'confirmed'].includes(item?.status)) return false;
  const time = new Date(item.appointment_time).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function isUpcomingAppointment(item) {
  const time = new Date(item?.appointment_time).getTime();
  return (
    Number.isFinite(time)
    && time >= Date.now()
    && ['booked', 'confirmed', 'rescheduled'].includes(item?.status)
  );
}

function isReschedulableAppointment(item) {
  const time = new Date(item?.appointment_time).getTime();
  return (
    Number.isFinite(time)
    && time >= Date.now()
    && ['booked', 'confirmed', 'rescheduled'].includes(item?.status)
  );
}

function buildAppointmentDateTime(date, time) {
  if (!date || !time) return '';
  const next = new Date(`${date}T${time}:00`);
  return Number.isNaN(next.getTime()) ? '' : next.toISOString();
}

function normalizePatient(item) {
  return {
    patient_id: getPatientId(item),
    patient_code: item?.patient_code || item?.code || '--',
    full_name: item?.full_name || item?.patient_name || item?.name || 'Bệnh nhân',
    phone: item?.phone || item?.patient_phone || '--',
    date_of_birth: item?.date_of_birth,
    gender: item?.gender,
  };
}

function normalizeDepartment(item) {
  return {
    department_id: item?.department_id || item?.id || item?._id || '',
    department_name: item?.department_name || item?.name || 'Khoa/phòng',
    department_code: item?.department_code || item?.code || '',
  };
}

function normalizeDoctor(item) {
  return {
    user_id: item?.user_id || item?.doctor_id || item?.id || item?._id || user?.user_id || user?.id || '',
    doctor_profile_id: item?.doctor_profile_id || item?.profile_id || '',
    full_name: item?.full_name || item?.doctor_name || item?.name || user?.full_name || 'Bác sĩ',
    department_id: item?.department_id || department?.department_id || '',
    department_name: item?.department_name || department?.department_name || '',
    specialty: item?.specialty || '',
    consultation_duration_minutes: item?.consultation_duration_minutes || null,
    active_schedules_count: item?.active_schedules_count || 0,
  };
}

function normalizeReferenceOptions(schedulingOptions, departmentsResult, doctorsResult) {
  const optionDepartments = safeArray(schedulingOptions?.departments);
  const optionDoctors = safeArray(schedulingOptions?.doctors);

  return {
    departments: (optionDepartments.length
      ? optionDepartments
      : departmentsResult.status === 'fulfilled'
        ? safeArray(departmentsResult.value?.items)
        : []
    ).map(normalizeDepartment),
    doctors: (optionDoctors.length
      ? optionDoctors
      : doctorsResult.status === 'fulfilled'
        ? safeArray(doctorsResult.value?.items)
        : []
    ).map(normalizeDoctor),
  };
}

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return (
    <span className={`reception-status-badge is-${meta.tone}`}>
      {meta.label}
    </span>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="reception-appointment-alert is-danger">
      <AlertCircle size={17} />
      <span>{message}</span>
    </div>
  );
}

function LoadingBlock({ label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="reception-appointment-loading">
      <Loader2 size={20} />
      <span>{label}</span>
    </div>
  );
}

export function ReceptionAppointmentsPanel({ mode = 'all', onNavigate }) {
  if (mode === 'create') {
    return <CreateAppointmentPanel onNavigate={onNavigate} />;
  }

  return <AppointmentListPanel mode={mode} onNavigate={onNavigate} />;
}

function AppointmentListPanel({ mode, onNavigate }) {
  const config = LIST_MODE_CONFIG[mode] || LIST_MODE_CONFIG.all;
  const showDateSortBar = DATE_SORT_MODES.has(mode);
  const [filters, setFilters] = useState(() => ({
    q: '',
    ...getDefaultDateFilters(mode),
    department_id: '',
    doctor_id: '',
    status: config.forcedStatus || '',
    appointment_type: '',
    page: 1,
    limit: mode === 'today' ? 100 : 25,
  }));
  const [refs, setRefs] = useState({ departments: [], doctors: [] });
  const [state, setState] = useState({
    loading: true,
    error: '',
    items: [],
    pagination: null,
    summary: null,
  });
  const [todayTab, setTodayTab] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [selectedIds, setSelectedIds] = useState([]);
  const [capabilities, setCapabilities] = useState({});
  const [activeActions, setActiveActions] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [contactStatus, setContactStatus] = useState({});
  const [detailState, setDetailState] = useState({ loading: false, error: '', data: null, timeline: [] });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const nextConfig = LIST_MODE_CONFIG[mode] || LIST_MODE_CONFIG.all;
    setFilters({
      q: '',
      ...getDefaultDateFilters(mode),
      department_id: '',
      doctor_id: '',
      status: nextConfig.forcedStatus || '',
      appointment_type: '',
      page: 1,
      limit: mode === 'today' ? 100 : 25,
    });
    setSelectedIds([]);
    setCapabilities({});
    setActiveActions('');
    setDetailState({ loading: false, error: '', data: null, timeline: [] });
  }, [mode]);

  useEffect(() => {
    let mounted = true;

    async function loadRefs() {
      const [schedulingOptionsResult, departmentsResult, doctorsResult] = await Promise.allSettled([
        receptionAppointmentsApi.getSchedulingOptions({ limit: 100 }),
        receptionAppointmentsApi.listDepartments({ limit: 100 }),
        receptionAppointmentsApi.listDoctors({ limit: 100 }),
      ]);

      if (!mounted) return;
      setRefs(normalizeReferenceOptions(
        schedulingOptionsResult.status === 'fulfilled' ? schedulingOptionsResult.value : null,
        departmentsResult,
        doctorsResult,
      ));
    }

    loadRefs();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      const params = {
        page: filters.page,
        limit: filters.limit,
        date_from: filters.date_from,
        date_to: filters.date_to,
        department_id: filters.department_id,
        doctor_id: filters.doctor_id,
        status: config.forcedStatus || filters.status,
        appointment_type: filters.appointment_type,
      };

      try {
        const selectedDate = filters.date_from || todayKey();
        const isCurrentTodayView = mode === 'today' && selectedDate === todayKey() && filters.date_to === todayKey();
        const summaryParams = mode === 'today'
          ? { date: selectedDate, department_id: filters.department_id, doctor_id: filters.doctor_id }
          : params;
        const listParams = isCurrentTodayView
          ? { limit: filters.limit, department_id: filters.department_id, doctor_id: filters.doctor_id }
          : params;
        const listRequest = isCurrentTodayView
          ? receptionAppointmentsApi.getTodayAppointments(listParams)
          : mode === 'upcoming' && !filters.q.trim()
            ? receptionAppointmentsApi.getUpcomingAppointments(listParams)
          : filters.q.trim()
            ? receptionAppointmentsApi.searchAppointments({ ...params, q: filters.q.trim() })
            : receptionAppointmentsApi.listAppointments(params);

        const [listData, summaryData] = await Promise.all([
          listRequest,
          receptionAppointmentsApi.getSummary(summaryParams).catch(() => null),
        ]);

        if (!mounted) return;
        setState({
          loading: false,
          error: '',
          items: safeArray(listData?.items),
          pagination: listData?.pagination || null,
          summary: summaryData,
        });
      } catch (error) {
        if (!mounted) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: getErrorMessage(error, 'Không tải được danh sách lịch hẹn.'),
        }));
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [
    mode,
    config.forcedStatus,
    filters.q,
    filters.date_from,
    filters.date_to,
    filters.department_id,
    filters.doctor_id,
    filters.status,
    filters.appointment_type,
    filters.page,
    filters.limit,
    refreshToken,
  ]);

  const visibleItems = useMemo(() => {
    if (mode === 'upcoming') {
      return state.items.filter(isUpcomingAppointment);
    }

    if (mode === 'reschedule') {
      return state.items.filter(isReschedulableAppointment);
    }

    if (mode !== 'today') return state.items;
    return state.items.filter((item) => {
      if (todayTab === 'all') return true;
      if (todayTab === 'late') return isLateAppointment(item);
      if (todayTab === 'upcoming') {
        const time = new Date(item.appointment_time).getTime();
        return Number.isFinite(time) && time >= Date.now() && ['booked', 'confirmed'].includes(item.status);
      }
      return item.status === todayTab;
    });
  }, [mode, state.items, todayTab]);

  const selectedRows = useMemo(
    () => state.items.filter((item) => selectedIds.includes(getAppointmentId(item))),
    [selectedIds, state.items],
  );

  function updateFilter(key, value) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: 1,
    }));
  }

  function setSingleDayFilter(dateKey) {
    setFilters((current) => ({
      ...current,
      date_from: dateKey,
      date_to: dateKey,
      page: 1,
    }));
  }

  function shiftDay(amount) {
    setSingleDayFilter(addDaysToDateKey(filters.date_from || todayKey(), amount));
  }

  function toggleSelected(appointmentId) {
    setSelectedIds((current) => (
      current.includes(appointmentId)
        ? current.filter((item) => item !== appointmentId)
        : [...current, appointmentId]
    ));
  }

  async function loadCapabilities(item) {
    const appointmentId = getAppointmentId(item);
    if (!appointmentId) return null;
    if (capabilities[appointmentId]) return capabilities[appointmentId];

    const results = await Promise.allSettled([
      receptionAppointmentsApi.getCanUpdate(appointmentId),
      receptionAppointmentsApi.getCanCancel(appointmentId),
      receptionAppointmentsApi.getCanReschedule(appointmentId),
      receptionAppointmentsApi.getCanCheckIn(appointmentId),
    ]);

    const [update, cancel, reschedule, checkin] = results.map((result) => (
      result.status === 'fulfilled' ? result.value : null
    ));
    const next = {
      can_update: Boolean(update?.can_update),
      can_cancel: Boolean(cancel?.can_cancel),
      can_reschedule: Boolean(reschedule?.can_reschedule ?? reschedule?.can_update),
      can_check_in: Boolean(checkin?.can_check_in ?? checkin?.can_checkin),
      reasons: [
        ...safeArray(update?.reasons),
        ...safeArray(cancel?.reasons),
        ...safeArray(reschedule?.reasons),
        ...safeArray(checkin?.reasons),
      ],
    };

    setCapabilities((current) => ({
      ...current,
      [appointmentId]: next,
    }));
    return next;
  }

  async function openActions(item) {
    const appointmentId = getAppointmentId(item);
    setActiveActions((current) => (current === appointmentId ? '' : appointmentId));
    await loadCapabilities(item).catch(() => null);
  }

  async function openDetail(item) {
    const appointmentId = getAppointmentId(item);
    if (!appointmentId) return;
    setDetailState({ loading: true, error: '', data: null, timeline: [] });
    try {
      const [detail, timeline] = await Promise.all([
        receptionAppointmentsApi.getAppointmentDetail(appointmentId),
        receptionAppointmentsApi.getAppointmentTimeline(appointmentId, { limit: 50 }).catch(() => null),
      ]);
      setDetailState({
        loading: false,
        error: '',
        data: detail,
        timeline: safeArray(timeline?.items),
      });
    } catch (error) {
      setDetailState({
        loading: false,
        error: getErrorMessage(error, 'Không tải được chi tiết lịch hẹn.'),
        data: null,
        timeline: [],
      });
    }
  }

  async function runAction(type, item) {
    const appointmentId = getAppointmentId(item);
    if (!appointmentId) return;

    const busyKey = `${type}:${appointmentId}`;
    setActionBusy(busyKey);

    try {
      if (type === 'confirm') {
        await receptionAppointmentsApi.confirmAppointment(appointmentId);
      }
      if (type === 'check-in') {
        await receptionAppointmentsApi.checkInAppointment(appointmentId);
      }
      if (type === 'no-show') {
        await receptionAppointmentsApi.markNoShow(appointmentId);
      }
      if (type === 'cancel') {
        const reason = window.prompt('Nhập lý do hủy lịch hẹn:');
        if (reason === null) return;
        await receptionAppointmentsApi.cancelAppointment(appointmentId, {
          reason: reason.trim() || 'Lễ tân hủy lịch theo yêu cầu.',
        });
      }
      if (type === 'reschedule') {
        const nextTime = window.prompt('Nhập thời gian mới theo định dạng YYYY-MM-DD HH:mm');
        if (!nextTime) return;
        const normalized = new Date(nextTime.replace(' ', 'T'));
        if (Number.isNaN(normalized.getTime())) {
          throw new Error('Thời gian mới không hợp lệ.');
        }
        await receptionAppointmentsApi.rescheduleAppointment(appointmentId, {
          appointment_time: normalized.toISOString(),
          reason: 'Đổi lịch từ màn lễ tân.',
        });
      }

      setCapabilities({});
      setActiveActions('');
      setSelectedIds([]);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setActionBusy('');
    }
  }

  async function runBulk(type) {
    if (!selectedIds.length) return;
    setActionBusy(`bulk:${type}`);

    try {
      if (type === 'confirm') {
        await receptionAppointmentsApi.bulkConfirm(selectedIds);
      }
      if (type === 'cancel') {
        const reason = window.prompt('Nhập lý do hủy hàng loạt:');
        if (reason === null) return;
        await receptionAppointmentsApi.bulkCancel(selectedIds, {
          reason: reason.trim() || 'Hủy hàng loạt từ màn lễ tân.',
        });
      }
      setSelectedIds([]);
      setCapabilities({});
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(getErrorMessage(error));
    } finally {
      setActionBusy('');
    }
  }

  return (
    <section className="reception-appointment-module">
      <div className="reception-appointment-hero">
        <div>
          <span className="reception-appointment-eyebrow">
            <CalendarDays size={16} />
            Appointment workflow
          </span>
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
        </div>
        <div className="reception-panel__actions">
          <button
            type="button"
            className="reception-btn reception-btn--ghost"
            onClick={() => setRefreshToken((current) => current + 1)}
          >
            <RefreshCw size={16} />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            className="reception-btn reception-btn--ghost"
            disabled
            title="Export sẽ được nối khi backend có endpoint xuất file."
          >
            <Download size={16} />
            <span>Export</span>
          </button>
          <button
            type="button"
            className="reception-btn reception-btn--primary"
            onClick={() => onNavigate?.('appointments-create')}
          >
            <Plus size={16} />
            <span>Tạo lịch</span>
          </button>
        </div>
      </div>

      {mode === 'today' ? (
        <div className="reception-appointment-tabs">
          {TODAY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={todayTab === tab.key ? 'is-active' : ''}
              onClick={() => setTodayTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="reception-appointment-toolbar">
        <label className="reception-appointment-search">
          <Search size={18} />
          <input
            type="search"
            value={filters.q}
            onChange={(event) => updateFilter('q', event.target.value)}
            placeholder="Tìm theo tên bệnh nhân, SĐT, mã lịch, bác sĩ..."
          />
        </label>
        <div className="reception-filter-grid">
          <input
            type="date"
            value={filters.date_from}
            onChange={(event) => updateFilter('date_from', event.target.value)}
            aria-label="Từ ngày"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(event) => updateFilter('date_to', event.target.value)}
            aria-label="Đến ngày"
          />
          <select value={filters.department_id} onChange={(event) => updateFilter('department_id', event.target.value)}>
            <option value="">Tất cả khoa</option>
            {refs.departments.map((department) => (
              <option key={department.department_id} value={department.department_id}>
                {department.department_name}
              </option>
            ))}
          </select>
          <select value={filters.doctor_id} onChange={(event) => updateFilter('doctor_id', event.target.value)}>
            <option value="">Tất cả bác sĩ</option>
            {refs.doctors
              .filter((doctor) => !filters.department_id || doctor.department_id === filters.department_id)
              .map((doctor) => (
                <option key={doctor.user_id} value={doctor.user_id}>
                  {doctor.full_name}
                </option>
              ))}
          </select>
          <select
            value={config.forcedStatus || filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            disabled={Boolean(config.forcedStatus) || mode === 'today'}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>{meta.label}</option>
            ))}
          </select>
          <select value={filters.appointment_type} onChange={(event) => updateFilter('appointment_type', event.target.value)}>
            <option value="">Tất cả loại lịch</option>
            {APPOINTMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="reception-appointment-summary-grid">
        {SUMMARY_ITEMS.map((item) => (
          <article key={item.key} className="reception-appointment-summary-card">
            <span>{item.label}</span>
            <strong>{formatInteger(state.summary?.[item.key] || 0)}</strong>
          </article>
        ))}
        <article className="reception-appointment-summary-card is-rate">
          <span>Tỷ lệ no-show</span>
          <strong>{toNumber(state.summary?.no_show_rate).toFixed(1)}%</strong>
        </article>
        <article className="reception-appointment-summary-card is-rate">
          <span>Tỷ lệ hủy</span>
          <strong>{toNumber(state.summary?.cancellation_rate).toFixed(1)}%</strong>
        </article>
      </div>

      {mode === 'today' ? (
        <div className="reception-view-switch">
          <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}>
            Danh sách gọn
          </button>
          <button type="button" className={viewMode === 'timeline' ? 'is-active' : ''} onClick={() => setViewMode('timeline')}>
            Timeline
          </button>
        </div>
      ) : null}

      <InlineError message={state.error} />

      {selectedIds.length ? (
        <div className="reception-bulk-bar">
          <span>Đã chọn {selectedRows.length} lịch</span>
          <button
            type="button"
            className="reception-btn reception-btn--ghost"
            onClick={() => runBulk('confirm')}
            disabled={actionBusy === 'bulk:confirm'}
          >
            <CheckCircle2 size={16} />
            <span>Xác nhận hàng loạt</span>
          </button>
          <button
            type="button"
            className="reception-btn reception-btn--ghost"
            onClick={() => runBulk('cancel')}
            disabled={actionBusy === 'bulk:cancel'}
          >
            <XCircle size={16} />
            <span>Hủy hàng loạt</span>
          </button>
        </div>
      ) : null}

      <article className="reception-panel">
        <header className="reception-panel__header reception-panel__header--compact">
          <div>
            <h2>{mode === 'today' && viewMode === 'timeline' ? 'Timeline lịch hôm nay' : 'Danh sách lịch hẹn'}</h2>
            <p>
              {state.pagination
                ? `${formatInteger(state.pagination.total || 0)} bản ghi theo bộ lọc hiện tại`
                : `${formatInteger(visibleItems.length)} bản ghi`}
            </p>
          </div>
          {showDateSortBar ? (
            <div className="reception-appointment-datebar">
              <div>
                <span>Sắp xếp {config.title.toLowerCase()}</span>
                <strong>{formatDateHeading(filters.date_from || todayKey())}</strong>
              </div>
              <div className="reception-appointment-datebar__actions">
                <button type="button" onClick={() => setSingleDayFilter(todayKey())}>
                  Hôm nay
                </button>
                <button type="button" aria-label="Ngày trước" onClick={() => shiftDay(-1)}>
                  {'<'}
                </button>
                <button type="button" aria-label="Ngày sau" onClick={() => shiftDay(1)}>
                  {'>'}
                </button>
                <label aria-label="Chọn ngày">
                  <CalendarDays size={16} />
                  <input
                    type="date"
                    value={filters.date_from || todayKey()}
                    onChange={(event) => setSingleDayFilter(event.target.value || todayKey())}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </header>

        {state.loading ? (
          <LoadingBlock />
        ) : viewMode === 'timeline' && mode === 'today' ? (
          <AppointmentTimeline
            items={visibleItems}
            capabilities={capabilities}
            actionBusy={actionBusy}
            onOpenDetail={openDetail}
            onAction={runAction}
            onLoadCapabilities={loadCapabilities}
          />
        ) : (
          <AppointmentTable
            items={visibleItems}
            mode={mode}
            selectedIds={selectedIds}
            capabilities={capabilities}
            activeActions={activeActions}
            actionBusy={actionBusy}
            contactStatus={contactStatus}
            onToggleSelected={toggleSelected}
            onOpenActions={openActions}
            onOpenDetail={openDetail}
            onAction={runAction}
            onContactStatus={setContactStatus}
          />
        )}

        {!state.loading && !visibleItems.length && !state.error ? (
          <div className="reception-empty-panel">{config.empty}</div>
        ) : null}
      </article>

      <AppointmentDetailDrawer
        state={detailState}
        onClose={() => setDetailState({ loading: false, error: '', data: null, timeline: [] })}
        onAction={runAction}
      />
    </section>
  );
}

function AppointmentTable({
  items,
  mode,
  selectedIds,
  capabilities,
  activeActions,
  actionBusy,
  contactStatus,
  onToggleSelected,
  onOpenActions,
  onOpenDetail,
  onAction,
  onContactStatus,
}) {
  return (
    <div className="reception-appointment-list">
      {items.map((item) => {
        const appointmentId = getAppointmentId(item);
        const cap = capabilities[appointmentId] || {};
        const isBusy = actionBusy.endsWith(`:${appointmentId}`);

        return (
          <article key={appointmentId} className={`reception-appointment-row ${mode === 'confirm' ? 'has-contact' : ''} ${isLateAppointment(item) ? 'is-late' : ''}`}>
            <label className="reception-appointment-row__check">
              <input
                type="checkbox"
                checked={selectedIds.includes(appointmentId)}
                onChange={() => onToggleSelected(appointmentId)}
                aria-label={`Chọn lịch ${appointmentId}`}
              />
            </label>

            <div className="reception-appointment-row__time">
              <strong>{formatTime(item.appointment_time)}</strong>
              <span>{formatDate(item.appointment_time)}</span>
              {isLateAppointment(item) ? <em className="reception-late-note">Trễ giờ</em> : null}
            </div>

            <div className="reception-appointment-row__main">
              <div className="reception-appointment-row__title">
                <button type="button" className="reception-inline-link" onClick={() => onOpenDetail(item)}>
                  {item.patient_name || 'Bệnh nhân'}
                </button>
                <StatusBadge status={item.status} />
              </div>
              <div className="reception-appointment-row__meta">
                <span>{item.doctor_name || '--'}</span>
                <span>{item.department_name || '--'}</span>
                <span>{getTypeLabel(item.appointment_type)}</span>
              </div>
              <div className="reception-appointment-row__submeta">
                <span className="reception-phone-cell">
                  <Phone size={14} />
                  {item.patient_phone || '--'}
                </span>
                <span>Mã lịch {appointmentId.slice(-8).toUpperCase()}</span>
              </div>
              {mode === 'cancelled' ? (
                <p className="reception-appointment-row__note">{item.cancel_reason || item.reason || 'Xem chi tiết lý do hủy'}</p>
              ) : null}
            </div>

            {mode === 'confirm' ? (
              <select
                className="reception-contact-select reception-appointment-row__contact"
                value={contactStatus[appointmentId] || 'not_called'}
                onChange={(event) => onContactStatus((current) => ({
                  ...current,
                  [appointmentId]: event.target.value,
                }))}
              >
                <option value="not_called">Chưa gọi</option>
                <option value="confirmed_call">Đã gọi - xác nhận</option>
                <option value="no_answer">Không nghe máy</option>
                <option value="callback">Cần gọi lại</option>
                <option value="reschedule_requested">Muốn dời lịch</option>
              </select>
            ) : null}

            <div className="reception-row-actions reception-appointment-row__actions">
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onOpenDetail(item)}>
                <Eye size={15} />
                <span>Xem</span>
              </button>
              <div className={`reception-action-menu ${activeActions === appointmentId ? 'is-open' : ''}`}>
                <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onOpenActions(item)}>
                  {isBusy ? <Loader2 size={15} /> : <MoreHorizontal size={15} />}
                  <span>Thao tác</span>
                </button>
                {activeActions === appointmentId ? (
                  <div className="reception-action-menu__list">
                    <ActionButton
                      disabled={item.status !== 'booked'}
                      onClick={() => onAction('confirm', item)}
                      label="Xác nhận"
                    />
                    <ActionButton
                      disabled={!cap.can_check_in}
                      title={cap.reasons?.join(' ') || 'Lịch chưa đủ điều kiện check-in'}
                      onClick={() => onAction('check-in', item)}
                      label="Check-in"
                    />
                    <ActionButton
                      disabled={!cap.can_reschedule}
                      title={cap.reasons?.join(' ') || 'Lịch không thể dời'}
                      onClick={() => onAction('reschedule', item)}
                      label="Dời lịch"
                    />
                    <ActionButton
                      disabled={!cap.can_cancel}
                      title={cap.reasons?.join(' ') || 'Lịch không thể hủy'}
                      onClick={() => onAction('cancel', item)}
                      label="Hủy"
                    />
                    <ActionButton
                      disabled={!['booked', 'confirmed'].includes(item.status)}
                      onClick={() => onAction('no-show', item)}
                      label="No-show"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ActionButton({ disabled, title, onClick, label }) {
  return (
    <button type="button" disabled={disabled} title={title} onClick={onClick}>
      {label}
    </button>
  );
}

function AppointmentTimeline({ items, capabilities, actionBusy, onOpenDetail, onAction, onLoadCapabilities }) {
  return (
    <div className="reception-timeline-list">
      {items
        .slice()
        .sort((a, b) => new Date(a.appointment_time).getTime() - new Date(b.appointment_time).getTime())
        .map((item) => {
          const appointmentId = getAppointmentId(item);
          const cap = capabilities[appointmentId] || {};
          return (
            <div key={appointmentId} className={`reception-timeline-item ${isLateAppointment(item) ? 'is-late' : ''}`}>
              <div className="reception-timeline-item__time">
                <strong>{formatTime(item.appointment_time)}</strong>
                <span>{isLateAppointment(item) ? 'Trễ giờ' : formatDate(item.appointment_time)}</span>
              </div>
              <div className="reception-timeline-item__body">
                <div>
                  <strong>{item.patient_name || 'Bệnh nhân'}</strong>
                  <span>{item.doctor_name || '--'} · {item.department_name || '--'}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="reception-timeline-item__actions">
                <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onOpenDetail(item)}>
                  <Eye size={15} />
                  <span>Chi tiết</span>
                </button>
                {item.status === 'booked' ? (
                  <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('confirm', item)}>
                    Xác nhận
                  </button>
                ) : null}
                {item.status === 'confirmed' ? (
                  <button
                    type="button"
                    className="reception-btn reception-btn--primary"
                    disabled={actionBusy === `check-in:${appointmentId}`}
                    onMouseEnter={() => onLoadCapabilities(item)}
                    onClick={() => onAction('check-in', item)}
                    title={cap.reasons?.join(' ') || ''}
                  >
                    Check-in
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
    </div>
  );
}

function AppointmentDetailDrawer({ state, onClose, onAction }) {
  if (!state.loading && !state.error && !state.data) return null;
  const appointment = state.data?.appointment;
  const timeline = state.timeline;

  return (
    <aside className="reception-appointment-drawer" aria-label="Chi tiết lịch hẹn">
      <div className="reception-appointment-drawer__header">
        <div>
          <span>Thông tin lịch</span>
          <h3>{appointment ? appointment.patient_name : 'Đang tải...'}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết">
          <XCircle size={20} />
        </button>
      </div>

      {state.loading ? <LoadingBlock label="Đang tải chi tiết lịch hẹn..." /> : null}
      <InlineError message={state.error} />

      {appointment ? (
        <>
          <div className="reception-detail-grid">
            <div><span>Mã lịch</span><strong>{appointment.appointment_id?.slice(-8).toUpperCase()}</strong></div>
            <div><span>Thời gian</span><strong>{formatDateTime(appointment.appointment_time)}</strong></div>
            <div><span>Bệnh nhân</span><strong>{appointment.patient_name || '--'}</strong></div>
            <div><span>SĐT</span><strong>{appointment.patient_phone || '--'}</strong></div>
            <div><span>Bác sĩ</span><strong>{appointment.doctor_name || '--'}</strong></div>
            <div><span>Khoa</span><strong>{appointment.department_name || '--'}</strong></div>
            <div><span>Loại lịch</span><strong>{getTypeLabel(appointment.appointment_type)}</strong></div>
            <div><span>Nguồn</span><strong>{appointment.source || '--'}</strong></div>
          </div>

          <div className="reception-detail-status">
            <StatusBadge status={appointment.status} />
            {state.data?.queue_ticket ? (
              <span>Queue: {state.data.queue_ticket.queue_number} · {state.data.queue_ticket.status}</span>
            ) : null}
            {state.data?.encounter ? (
              <span>Encounter: {state.data.encounter.encounter_code} · {state.data.encounter.status}</span>
            ) : null}
          </div>

          <div className="reception-detail-actions">
            {appointment.status === 'booked' ? (
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('confirm', appointment)}>
                Xác nhận
              </button>
            ) : null}
            {appointment.status === 'confirmed' ? (
              <button type="button" className="reception-btn reception-btn--primary" onClick={() => onAction('check-in', appointment)}>
                Check-in
              </button>
            ) : null}
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('reschedule', appointment)}>
              Dời lịch
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('cancel', appointment)}>
              Hủy lịch
            </button>
            {['booked', 'confirmed'].includes(appointment.status) ? (
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction('no-show', appointment)}>
                No-show
              </button>
            ) : null}
          </div>

          <div className="reception-detail-notes">
            <h4>Lý do khám / ghi chú</h4>
            <p>{appointment.reason || appointment.notes || 'Chưa có ghi chú.'}</p>
            {appointment.cancel_reason ? <p>Lý do hủy: {appointment.cancel_reason}</p> : null}
            {appointment.reschedule_reason ? <p>Lý do dời: {appointment.reschedule_reason}</p> : null}
          </div>

          <div className="reception-detail-timeline">
            <h4>Timeline thao tác</h4>
            {timeline.length ? timeline.map((item) => (
              <div key={item.audit_log_id} className="reception-detail-timeline__item">
                <span>{formatDateTime(item.created_at)}</span>
                <strong>{item.message || item.action}</strong>
                <small>{item.actor_label || item.actor_type || 'system'}</small>
              </div>
            )) : (
              <div className="reception-empty-panel reception-empty-panel--compact">Chưa có timeline.</div>
            )}
          </div>
        </>
      ) : null}
    </aside>
  );
}

function CreateAppointmentPanel({ onNavigate }) {
  const [step, setStep] = useState(1);
  const [refs, setRefs] = useState({ departments: [], doctors: [] });
  const [patientQuery, setPatientQuery] = useState('');
  const [patientState, setPatientState] = useState({ loading: false, error: '', items: [] });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState({
    department_id: '',
    appointment_type: 'outpatient',
    reason: '',
    notes: '',
    doctor_id: '',
    appointment_date: todayKey(),
    appointment_time: '08:00',
  });
  const [validation, setValidation] = useState({ loading: false, items: [], error: '' });
  const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    let mounted = true;
    async function loadRefs() {
      const [schedulingOptionsResult, departmentsResult, doctorsResult] = await Promise.allSettled([
        receptionAppointmentsApi.getSchedulingOptions({ limit: 100 }),
        receptionAppointmentsApi.listDepartments({ limit: 100 }),
        receptionAppointmentsApi.listDoctors({ limit: 100 }),
      ]);
      if (!mounted) return;
      setRefs(normalizeReferenceOptions(
        schedulingOptionsResult.status === 'fulfilled' ? schedulingOptionsResult.value : null,
        departmentsResult,
        doctorsResult,
      ));
    }
    loadRefs();
    return () => {
      mounted = false;
    };
  }, []);

  const availableDoctors = useMemo(
    () => refs.doctors.filter((doctor) => !form.department_id || doctor.department_id === form.department_id),
    [refs.doctors, form.department_id],
  );

  const appointmentDateTime = useMemo(
    () => buildAppointmentDateTime(form.appointment_date, form.appointment_time),
    [form.appointment_date, form.appointment_time],
  );

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'department_id' ? { doctor_id: '' } : {}),
    }));
  }

  async function searchPatients(event, queryOverride) {
    event?.preventDefault?.();
    const query = queryOverride ?? patientQuery;

    if (!query.trim()) {
      setPatientState({ loading: false, error: '', items: [] });
      return;
    }

    setPatientState({ loading: true, error: '', items: [] });
    try {
      const data = await receptionAppointmentsApi.searchPatients({
        search: query.trim(),
        limit: 10,
      });
      setPatientState({
        loading: false,
        error: '',
        items: safeArray(data?.items).map(normalizePatient),
      });
    } catch (error) {
      setPatientState({
        loading: false,
        error: getErrorMessage(error, 'Không tìm được bệnh nhân.'),
        items: [],
      });
    }
  }

  useEffect(() => {
    const query = patientQuery.trim();
    if (!query) {
      setPatientState({ loading: false, error: '', items: [] });
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      searchPatients(null, query);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [patientQuery]);

  async function runValidation() {
    if (!selectedPatient || !form.department_id || !form.doctor_id || !appointmentDateTime) {
      setValidation({
        loading: false,
        error: 'Vui lòng chọn đủ bệnh nhân, khoa, bác sĩ và thời gian.',
        items: [],
      });
      return false;
    }

    const payload = {
      patient_id: selectedPatient.patient_id,
      department_id: form.department_id,
      doctor_id: form.doctor_id,
      appointment_time: appointmentDateTime,
      appointment_type: form.appointment_type,
    };

    const checks = [
      { key: 'time', label: 'Thời gian hợp lệ', fn: () => receptionAppointmentsApi.validateTime(payload) },
      { key: 'slot', label: 'Slot còn trống', fn: () => receptionAppointmentsApi.validateSlot(payload) },
      { key: 'doctor', label: 'Bác sĩ có lịch khả dụng', fn: () => receptionAppointmentsApi.checkDoctorAvailability(payload) },
      { key: 'doctor_conflict', label: 'Không trùng lịch bác sĩ', fn: () => receptionAppointmentsApi.checkDoctorConflict(payload) },
      { key: 'patient_conflict', label: 'Không trùng lịch bệnh nhân', fn: () => receptionAppointmentsApi.checkPatientConflict(payload) },
      { key: 'duplicate', label: 'Không phát hiện lịch duplicate', fn: () => receptionAppointmentsApi.checkPatientDuplicate(payload) },
    ];

    setValidation({ loading: true, error: '', items: checks.map((item) => ({ ...item, status: 'pending' })) });
    const results = [];

    for (const check of checks) {
      try {
        const result = await check.fn();
        const failed = result?.has_conflict || result?.has_duplicate;
        results.push({
          key: check.key,
          label: check.label,
          status: failed ? 'failed' : 'passed',
          message: failed ? result?.message || 'Backend phát hiện xung đột.' : 'Đạt',
        });
      } catch (error) {
        results.push({
          key: check.key,
          label: check.label,
          status: 'failed',
          message: getErrorMessage(error),
        });
      }
    }

    const hasFailed = results.some((item) => item.status === 'failed');
    setValidation({
      loading: false,
      error: hasFailed ? 'Một số điều kiện chưa đạt. Vui lòng chọn lại slot hoặc thông tin phù hợp.' : '',
      items: results,
    });
    return !hasFailed;
  }

  async function goToStep(nextStep) {
    if (nextStep === 4) {
      setStep(4);
      await runValidation();
      return;
    }
    setStep(nextStep);
  }

  async function submitCreate(strategy = 'create') {
    setSubmitState({ loading: true, error: '', success: '' });
    try {
      const body = {
        patient_id: selectedPatient.patient_id,
        department_id: form.department_id,
        doctor_id: form.doctor_id,
        appointment_time: appointmentDateTime,
        appointment_type: form.appointment_type,
        reason: form.reason,
        notes: form.notes,
        source: 'staff',
      };
      const created = await receptionAppointmentsApi.createByStaff(body);
      const appointmentId = created?.appointment?.appointment_id || created?.appointment_id || created?.id;

      if (appointmentId && ['confirm', 'checkin'].includes(strategy)) {
        await receptionAppointmentsApi.confirmAppointment(appointmentId);
      }
      if (appointmentId && strategy === 'checkin') {
        await receptionAppointmentsApi.checkInAppointment(appointmentId);
      }

      setSubmitState({
        loading: false,
        error: '',
        success: strategy === 'checkin'
          ? 'Đã tạo lịch, xác nhận và check-in bệnh nhân.'
          : strategy === 'confirm'
            ? 'Đã tạo và xác nhận lịch hẹn.'
            : 'Đã tạo lịch hẹn thành công.',
      });
      setTimeout(() => onNavigate?.('appointments-today'), 700);
    } catch (error) {
      setSubmitState({
        loading: false,
        error: getErrorMessage(error, 'Tạo lịch hẹn thất bại.'),
        success: '',
      });
    }
  }

  const canStep1 = Boolean(selectedPatient);
  const canStep2 = Boolean(form.department_id && form.appointment_type);
  const canStep3 = Boolean(form.doctor_id && appointmentDateTime);
  const allValid = validation.items.length > 0 && validation.items.every((item) => item.status === 'passed');

  return (
    <section className="reception-appointment-module">
      <div className="reception-appointment-hero">
        <div>
          <span className="reception-appointment-eyebrow">
            <UserPlus size={16} />
            Staff appointment creation
          </span>
          <h2>Tạo lịch hẹn mới</h2>
          <p>Wizard nhiều bước để chọn bệnh nhân, khoa, bác sĩ, slot và kiểm tra điều kiện backend trước khi tạo lịch.</p>
        </div>
        <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onNavigate?.('appointments-all')}>
          <ArrowLeft size={16} />
          <span>Quay lại danh sách</span>
        </button>
      </div>

      <div className="reception-wizard-stepper">
        {[
          'Bệnh nhân',
          'Khoa / dịch vụ',
          'Bác sĩ & thời gian',
          'Kiểm tra',
          'Xác nhận',
        ].map((label, index) => {
          const number = index + 1;
          return (
            <button
              key={label}
              type="button"
              className={step === number ? 'is-active' : step > number ? 'is-complete' : ''}
              onClick={() => setStep(number)}
            >
              <span>{step > number ? <CheckCircle2 size={16} /> : number}</span>
              {label}
            </button>
          );
        })}
      </div>

      <article className="reception-panel reception-create-panel">
        {step === 1 ? (
          <div className="reception-create-step">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>1. Chọn bệnh nhân</h2>
                <p>Tìm bệnh nhân theo tên, số điện thoại hoặc mã bệnh nhân.</p>
              </div>
            </header>
            <form className="reception-appointment-search" onSubmit={searchPatients}>
              <Search size={18} />
              <input
                type="search"
                value={patientQuery}
                onChange={(event) => setPatientQuery(event.target.value)}
                placeholder="Nhập tên, SĐT hoặc mã bệnh nhân..."
              />
              <button type="submit" className="reception-btn reception-btn--primary">Tìm</button>
            </form>
            <InlineError message={patientState.error} />
            {patientState.loading ? <LoadingBlock label="Đang tìm bệnh nhân..." /> : null}
            <div className="reception-patient-results">
              {patientState.items.map((patient) => (
                <button
                  key={patient.patient_id}
                  type="button"
                  className={selectedPatient?.patient_id === patient.patient_id ? 'is-selected' : ''}
                  onClick={() => setSelectedPatient(patient)}
                >
                  <span className="reception-avatar-badge reception-avatar-badge--cyan">
                    {patient.full_name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{patient.full_name}</strong>
                    <span>{patient.patient_code} · {patient.phone} · {patient.gender || '--'}</span>
                  </div>
                </button>
              ))}
            </div>
            <button type="button" className="reception-btn reception-btn--ghost" disabled>
              <Plus size={16} />
              <span>Tạo hồ sơ bệnh nhân mới</span>
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="reception-create-step">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>2. Chọn khoa / dịch vụ</h2>
                <p>Xác định khoa phụ trách, loại lịch hẹn và lý do khám.</p>
              </div>
            </header>
            <div className="reception-form-grid">
              <label>
                <span>Khoa / phòng *</span>
                <select value={form.department_id} onChange={(event) => updateForm('department_id', event.target.value)}>
                  <option value="">Chọn khoa</option>
                  {refs.departments.map((department) => (
                    <option key={department.department_id} value={department.department_id}>
                      {department.department_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Loại lịch hẹn *</span>
                <select value={form.appointment_type} onChange={(event) => updateForm('appointment_type', event.target.value)}>
                  {APPOINTMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>
              <label className="is-span-2">
                <span>Lý do khám</span>
                <textarea value={form.reason} onChange={(event) => updateForm('reason', event.target.value)} placeholder="Triệu chứng, nhu cầu khám hoặc ghi chú chính..." />
              </label>
              <label className="is-span-2">
                <span>Ghi chú lễ tân</span>
                <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Thông tin ưu tiên, yêu cầu hỗ trợ..." />
              </label>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="reception-create-step">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>3. Chọn bác sĩ và slot</h2>
                <p>Chọn bác sĩ thuộc khoa đã chọn và thời gian hẹn.</p>
              </div>
            </header>
            <div className="reception-create-split">
              <div>
                <h3>Bác sĩ</h3>
                <div className="reception-doctor-picker">
                  {availableDoctors.map((doctor) => (
                    <button
                      key={doctor.user_id}
                      type="button"
                      className={form.doctor_id === doctor.user_id ? 'is-selected' : ''}
                      onClick={() => updateForm('doctor_id', doctor.user_id)}
                    >
                      <Stethoscope size={18} />
                      <div>
                        <strong>{doctor.full_name}</strong>
                        <span>
                          {[doctor.specialty, doctor.department_name].filter(Boolean).join(' · ') || 'Theo khoa đã chọn'}
                        </span>
                      </div>
                    </button>
                  ))}
                  {!availableDoctors.length ? (
                    <div className="reception-empty-panel reception-empty-panel--compact">
                      Chưa tải được danh sách bác sĩ hoặc tài khoản thiếu quyền đọc nhân sự.
                    </div>
                  ) : null}
                </div>
              </div>
              <div>
                <h3>Thời gian hẹn</h3>
                <div className="reception-form-grid reception-form-grid--single">
                  <label>
                    <span>Ngày hẹn *</span>
                    <input type="date" value={form.appointment_date} onChange={(event) => updateForm('appointment_date', event.target.value)} />
                  </label>
                  <label>
                    <span>Giờ hẹn *</span>
                    <input type="time" value={form.appointment_time} onChange={(event) => updateForm('appointment_time', event.target.value)} />
                  </label>
                </div>
                <div className="reception-slot-preview">
                  <Clock3 size={18} />
                  <span>{appointmentDateTime ? formatDateTime(appointmentDateTime) : 'Chưa chọn thời gian hợp lệ'}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="reception-create-step">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>4. Kiểm tra điều kiện</h2>
                <p>Frontend gọi các API validate backend trước khi cho tạo lịch.</p>
              </div>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={runValidation}>
                <RefreshCw size={16} />
                <span>Kiểm tra lại</span>
              </button>
            </header>
            {validation.loading ? <LoadingBlock label="Đang kiểm tra slot, lịch bác sĩ và trùng lịch bệnh nhân..." /> : null}
            <InlineError message={validation.error} />
            <div className="reception-validation-list">
              {validation.items.map((item) => (
                <div key={item.key} className={`is-${item.status}`}>
                  {item.status === 'passed' ? <CheckCircle2 size={18} /> : item.status === 'failed' ? <XCircle size={18} /> : <Loader2 size={18} />}
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.message || 'Đang kiểm tra...'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="reception-create-step">
            <header className="reception-panel__header reception-panel__header--compact">
              <div>
                <h2>5. Xác nhận tạo lịch</h2>
                <p>Kiểm tra thông tin cuối cùng trước khi gửi `POST /appointments/staff-create`.</p>
              </div>
            </header>
            <div className="reception-preview-grid">
              <div><span>Bệnh nhân</span><strong>{selectedPatient?.full_name || '--'}</strong></div>
              <div><span>Mã bệnh nhân</span><strong>{selectedPatient?.patient_code || '--'}</strong></div>
              <div><span>Khoa</span><strong>{refs.departments.find((item) => item.department_id === form.department_id)?.department_name || '--'}</strong></div>
              <div><span>Bác sĩ</span><strong>{refs.doctors.find((item) => item.user_id === form.doctor_id)?.full_name || '--'}</strong></div>
              <div><span>Thời gian</span><strong>{formatDateTime(appointmentDateTime)}</strong></div>
              <div><span>Loại lịch</span><strong>{getTypeLabel(form.appointment_type)}</strong></div>
            </div>
            <InlineError message={submitState.error} />
            {submitState.success ? (
              <div className="reception-appointment-alert is-success">
                <CheckCircle2 size={17} />
                <span>{submitState.success}</span>
              </div>
            ) : null}
            <div className="reception-create-submit-row">
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => submitCreate('create')} disabled={submitState.loading}>
                Tạo lịch
              </button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => submitCreate('confirm')} disabled={submitState.loading}>
                Tạo và xác nhận
              </button>
              <button type="button" className="reception-btn reception-btn--primary" onClick={() => submitCreate('checkin')} disabled={submitState.loading}>
                Tạo, xác nhận và check-in
              </button>
            </div>
          </div>
        ) : null}

        <footer className="reception-wizard-footer">
          <button type="button" className="reception-btn reception-btn--ghost" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))}>
            <ArrowLeft size={16} />
            <span>Quay lại</span>
          </button>
          {step < 5 ? (
            <button
              type="button"
              className="reception-btn reception-btn--primary"
              disabled={(step === 1 && !canStep1) || (step === 2 && !canStep2) || (step === 3 && !canStep3) || (step === 4 && !allValid)}
              onClick={() => goToStep(step + 1)}
            >
              <span>Tiếp tục</span>
              <ArrowRight size={16} />
            </button>
          ) : null}
        </footer>
      </article>
    </section>
  );
}
