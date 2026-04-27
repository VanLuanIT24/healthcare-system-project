import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  CopyPlus,
  Eye,
  FileText,
  Filter,
  Globe2,
  Grid2X2,
  Info,
  List,
  Link2Off,
  LockKeyhole,
  MoreHorizontal,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { schedulingApi } from '../api/schedulingApi';
import { StatusBadge } from '../components/SchedulingPrimitives';
import { useSchedulingData } from '../context/SchedulingDataContext';

const INITIAL_FILTERS = {
  search: '',
  doctor: '',
  department: '',
  fromDate: '2026-04-24',
  toDate: '2026-04-30',
  status: '',
  publishStatus: '',
  slotState: '',
  utilization: '',
};

const LIST_FILTER_STORAGE_KEY = 'healthcare.scheduling.list.filters';
const DOCTOR_AVATAR = '/images/scheduling/doctors/doctor-ai-fallback.png';
const DOCTOR_AVATAR_PATHS = {
  'dr-minh': '/images/scheduling/doctors/doctor-minh.svg',
  'dr-lan': '/images/scheduling/doctors/doctor-lan.svg',
  'dr-khoa': '/images/scheduling/doctors/doctor-khoa.svg',
  'dr-hanh': '/images/scheduling/doctors/doctor-hanh.svg',
  'dr-quang': '/images/scheduling/doctors/doctor-quang.svg',
};
const DOCTOR_AVATAR_POOL = Object.values(DOCTOR_AVATAR_PATHS);
const departmentColors = ['#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'];

function getTodayKey() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function getDuplicateDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function formatRatio(value, total) {
  if (!total) return '0%';
  const ratio = (Number(value || 0) / total) * 100;
  return `${Number.isInteger(ratio) ? ratio.toFixed(0) : ratio.toFixed(1)}%`;
}

function formatCompactDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatWeekday(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date);
}

function buildSparkPoints(seed = 1) {
  const values = Array.from({ length: 18 }, (_, index) => 26 + ((seed * (index + 5) + index * index * 7) % 46));
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 34 - ((value - min) / range) * 26;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function getRadarPoint(value, index, total, center, radius) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  const ratio = Math.max(0, Math.min(Number(value || 0), 100)) / 100;
  return {
    axisX: center + Math.cos(angle) * radius,
    axisY: center + Math.sin(angle) * radius,
    labelX: center + Math.cos(angle) * (radius + 17),
    labelY: center + Math.sin(angle) * (radius + 17),
    pointX: center + Math.cos(angle) * radius * ratio,
    pointY: center + Math.sin(angle) * radius * ratio,
  };
}

function getScheduleSlotState(item) {
  if (Number(item.blockedSlots || 0) > 0) return 'blocked';
  if (Number(item.availableSlots || 0) <= 0) return 'full';
  return 'available';
}

function getScheduleCode(item, index) {
  return item.code || item.id || `NK-${String(index + 1).padStart(6, '0')}`;
}

function getDoctorAvatar(item, index = 0) {
  const directAvatar = item.avatar || item.avatarUrl || item.photoUrl || item.imageUrl;
  if (directAvatar) return directAvatar;
  if (item.doctorId && DOCTOR_AVATAR_PATHS[item.doctorId]) return DOCTOR_AVATAR_PATHS[item.doctorId];

  const key = String(item.doctorId || item.doctor || item.id || index);
  const hash = [...key].reduce((total, character) => total + character.charCodeAt(0), index);
  return DOCTOR_AVATAR_POOL[Math.abs(hash) % DOCTOR_AVATAR_POOL.length] || DOCTOR_AVATAR;
}

function handleDoctorAvatarError(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = DOCTOR_AVATAR;
}

function getUtilizationClass(value) {
  const number = Number(value || 0);
  if (number >= 95) return 'is-danger';
  if (number >= 75) return 'is-good';
  if (number <= 35) return 'is-low';
  return 'is-normal';
}

function getWeekDays(anchorDate) {
  const current = new Date(anchorDate);
  const day = current.getDay() || 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - day + 1);

  return ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return { label, date: localDate, day: date.getDate() };
  });
}

export function SchedulingListPage() {
  const { actions, departments, doctors, error, loading, refresh, schedules } = useSchedulingData();
  const [actionError, setActionError] = useState('');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [activeFilters, setActiveFilters] = useState(INITIAL_FILTERS);
  const [filterNotice, setFilterNotice] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [tableTab, setTableTab] = useState('all');
  const [sortMode, setSortMode] = useState('newest');
  const [viewMode, setViewMode] = useState('table');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [openRowMenuId, setOpenRowMenuId] = useState('');
  const [isTodayCardVisible, setIsTodayCardVisible] = useState(true);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getTodayKey);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const createMenuRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LIST_FILTER_STORAGE_KEY) || 'null');
      if (saved) {
        const nextFilters = { ...INITIAL_FILTERS, ...saved };
        setDraftFilters(nextFilters);
        setActiveFilters(nextFilters);
      }
    } catch {
      localStorage.removeItem(LIST_FILTER_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!isCreateMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target)) {
        setIsCreateMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsCreateMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateMenuOpen]);

  const todayKey = getTodayKey();
  const totalSchedules = schedules.length || 1;
  const selectedDateSchedules = schedules.filter((item) => item.date === selectedCalendarDate);
  const visibleTodaySchedules = selectedDateSchedules.length ? selectedDateSchedules : schedules.slice(0, 3);
  const weekDays = getWeekDays(todayKey);

  const overviewStats = useMemo(() => {
    const publishedCount = schedules.filter((item) => item.publishStatus === 'Visible').length;
    const draftCount = schedules.filter((item) => item.publishStatus === 'Hidden' && normalize(item.status) !== 'cancelled').length;
    const cancelledCount = schedules.filter((item) => normalize(item.status) === 'cancelled').length;
    const upcomingCount = schedules.filter((item) => item.date >= todayKey && !['cancelled', 'completed'].includes(normalize(item.status))).length;
    const completedCount = schedules.filter((item) => normalize(item.status) === 'completed').length;

    return [
      { id: 'total', label: 'Tổng số lịch', value: schedules.length, ratio: '100%', tone: '#0f9f9a', bg: '#e6fffb', icon: CalendarCheck2, points: buildSparkPoints(schedules.length + 11) },
      { id: 'published', label: 'Đã công khai', value: publishedCount, ratio: formatRatio(publishedCount, totalSchedules), tone: '#3b82f6', bg: '#eff6ff', icon: CheckCircle2, points: buildSparkPoints(publishedCount + 17) },
      { id: 'draft', label: 'Bản nháp', value: draftCount, ratio: formatRatio(draftCount, totalSchedules), tone: '#f59e0b', bg: '#fff7ed', icon: ClipboardList, points: buildSparkPoints(draftCount + 23) },
      { id: 'cancelled', label: 'Đã hủy', value: cancelledCount, ratio: formatRatio(cancelledCount, totalSchedules), tone: '#ef4444', bg: '#fff1f2', icon: XCircle, points: buildSparkPoints(cancelledCount + 31) },
      { id: 'upcoming', label: 'Sắp diễn ra', value: upcomingCount, ratio: formatRatio(upcomingCount, totalSchedules), tone: '#8b5cf6', bg: '#f5f3ff', icon: Clock3, points: buildSparkPoints(upcomingCount + 41) },
      { id: 'completed', label: 'Hoàn thành hôm nay', value: completedCount, ratio: formatRatio(completedCount, totalSchedules), tone: '#10b981', bg: '#ecfdf5', icon: ShieldCheck, points: buildSparkPoints(completedCount + 53) },
    ];
  }, [schedules, todayKey, totalSchedules]);

  const headerSummaryStats = useMemo(() => {
    const publishedCount = schedules.filter((item) => item.publishStatus === 'Visible').length;
    const draftCount = schedules.filter((item) => item.publishStatus === 'Hidden' && normalize(item.status) !== 'cancelled').length;
    const averageUtilization = schedules.length
      ? Math.round(schedules.reduce((total, item) => total + Number(item.utilization || 0), 0) / schedules.length)
      : 0;

    return [
      { id: 'total', label: 'Tổng lịch', value: schedules.length, color: '#0f9f9a', icon: CalendarCheck2 },
      { id: 'published', label: 'Đã công khai', value: publishedCount, color: '#2563eb', icon: Globe2 },
      { id: 'draft', label: 'Bản nháp', value: draftCount, color: '#f97316', icon: FileText },
      { id: 'utilization', label: 'Hiệu suất TB', value: `${averageUtilization}%`, color: '#0f9f9a', icon: TrendingUp },
    ];
  }, [schedules]);

  const departmentPerformance = useMemo(() => {
    const rows = departments.length
      ? departments
      : Array.from(new Set(schedules.map((item) => item.department))).map((name) => ({ id: name, name }));

    return rows.slice(0, 5).map((department, index) => {
      const departmentSchedules = schedules.filter((item) => item.department === department.name);
      const totalSlots = departmentSchedules.reduce((total, item) => total + Number(item.totalSlots || 0), 0);
      const bookedSlots = departmentSchedules.reduce((total, item) => total + Number(item.bookedSlots || 0), 0);
      const availableSlots = departmentSchedules.reduce((total, item) => total + Number(item.availableSlots || 0), 0);
      const blockedSlots = departmentSchedules.reduce((total, item) => total + Number(item.blockedSlots || 0), 0);
      const utilization = totalSlots ? Math.round((bookedSlots / totalSlots) * 100) : Number(department.utilization || 0);
      const bookedRatio = totalSlots ? Math.round((bookedSlots / totalSlots) * 100) : utilization;
      const availableRatio = totalSlots ? Math.round((availableSlots / totalSlots) * 100) : Math.max(20, 100 - utilization);
      const blockedRatio = totalSlots ? Math.round((blockedSlots / totalSlots) * 100) : Math.max(12, Math.round(utilization / 3));

      return {
        id: department.id || department.name,
        name: department.name,
        value: utilization,
        color: departmentColors[index % departmentColors.length],
        radarValues: [
          utilization,
          bookedRatio,
          availableRatio,
          blockedRatio,
          Math.min(100, Math.round((utilization + bookedRatio + Math.max(0, 100 - blockedRatio)) / 3)),
        ],
      };
    });
  }, [departments, schedules]);

  const radarAxes = ['Lấp đầy', 'Đã đặt', 'Còn trống', 'Đã khóa', 'Hiệu suất'];
  const radarCenter = 76;
  const radarRadius = 48;
  const radarAxisPoints = radarAxes.map((axis, index) =>
    getRadarPoint(100, index, radarAxes.length, radarCenter, radarRadius),
  );

  const filteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      const query = normalize(activeFilters.search);
      const text = normalize(`${item.id} ${item.doctor} ${item.department}`);
      const status = normalize(item.status);

      if (query && !text.includes(query)) return false;
      if (activeFilters.doctor && item.doctor !== activeFilters.doctor) return false;
      if (activeFilters.department && item.department !== activeFilters.department) return false;
      if (activeFilters.fromDate && item.date < activeFilters.fromDate) return false;
      if (activeFilters.toDate && item.date > activeFilters.toDate) return false;
      if (activeFilters.status && status !== normalize(activeFilters.status)) return false;
      if (activeFilters.publishStatus && item.publishStatus !== activeFilters.publishStatus) return false;
      if (activeFilters.slotState && getScheduleSlotState(item) !== activeFilters.slotState) return false;
      if (activeFilters.utilization === 'high' && Number(item.utilization || 0) < 80) return false;
      if (activeFilters.utilization === 'medium' && (Number(item.utilization || 0) < 40 || Number(item.utilization || 0) >= 80)) return false;
      if (activeFilters.utilization === 'low' && Number(item.utilization || 0) >= 40) return false;

      return true;
    });
  }, [activeFilters, schedules]);

  const tabCounts = {
    all: filteredSchedules.length,
    published: filteredSchedules.filter((item) => item.publishStatus === 'Visible').length,
    draft: filteredSchedules.filter((item) => item.publishStatus === 'Hidden' && normalize(item.status) !== 'cancelled').length,
    cancelled: filteredSchedules.filter((item) => normalize(item.status) === 'cancelled').length,
    blocked: filteredSchedules.filter((item) => Number(item.blockedSlots || 0) > 0).length,
  };

  const tableRows = useMemo(() => {
    const tabbed = filteredSchedules.filter((item) => {
      if (tableTab === 'published') return item.publishStatus === 'Visible';
      if (tableTab === 'draft') return item.publishStatus === 'Hidden' && normalize(item.status) !== 'cancelled';
      if (tableTab === 'cancelled') return normalize(item.status) === 'cancelled';
      if (tableTab === 'blocked') return Number(item.blockedSlots || 0) > 0;
      return true;
    });

    return [...tabbed].sort((first, second) => {
      if (sortMode === 'oldest') return `${first.date} ${first.start}`.localeCompare(`${second.date} ${second.start}`);
      if (sortMode === 'utilization') return Number(second.utilization || 0) - Number(first.utilization || 0);
      if (sortMode === 'doctor') return first.doctor.localeCompare(second.doctor);
      return `${second.date} ${second.start}`.localeCompare(`${first.date} ${first.start}`);
    });
  }, [filteredSchedules, sortMode, tableTab]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = tableRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allPageSelected = pagedRows.length > 0 && pagedRows.every((item) => selectedIds.includes(item.id));
  const selectedRows = schedules.filter((item) => selectedIds.includes(item.id));

  const recentActivities = schedules.slice(0, 4).map((item, index) => ({
    id: `${item.id}-${index}`,
    avatar: index === 1 ? null : getDoctorAvatar(item, index),
    icon: index === 1 ? LockKeyhole : null,
    title:
      index === 0
        ? `${item.doctor} tạo lịch mới`
        : index === 1
          ? `${item.doctor} khóa ${Math.max(1, item.blockedSlots || 3)} slot`
          : normalize(item.status) === 'cancelled'
            ? `${item.doctor} hủy lịch`
            : `${item.doctor} công khai lịch`,
    time: ['2 phút trước', '15 phút trước', '32 phút trước', '1 giờ trước'][index] || 'Gần đây',
  }));

  function updateDraftFilter(key, value) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
    setFilterNotice('');
  }

  function applyFilters() {
    setActiveFilters(draftFilters);
    setPage(1);
    setFilterNotice('Đã áp dụng bộ lọc');
  }

  function resetFilters() {
    setDraftFilters(INITIAL_FILTERS);
    setActiveFilters(INITIAL_FILTERS);
    setPage(1);
    localStorage.removeItem(LIST_FILTER_STORAGE_KEY);
    setFilterNotice('Đã xóa tất cả bộ lọc');
  }

  function saveFilters() {
    localStorage.setItem(LIST_FILTER_STORAGE_KEY, JSON.stringify(draftFilters));
    setActiveFilters(draftFilters);
    setFilterNotice('Đã lưu bộ lọc');
  }

  function toggleRowSelection(scheduleId) {
    setSelectedIds((current) =>
      current.includes(scheduleId)
        ? current.filter((id) => id !== scheduleId)
        : [...current, scheduleId],
    );
  }

  function togglePageSelection() {
    const pageIds = pagedRows.map((item) => item.id);
    setSelectedIds((current) => {
      if (pageIds.every((id) => current.includes(id))) {
        return current.filter((id) => !pageIds.includes(id));
      }
      return Array.from(new Set([...current, ...pageIds]));
    });
  }

  async function runAction(work, successMessage) {
    setActionError('');
    try {
      await work();
      if (successMessage) setFilterNotice(successMessage);
    } catch (actionFailure) {
      setActionError(actionFailure.message);
    }
  }

  function runBulkPublish() {
    if (!selectedIds.length) return;
    runAction(async () => {
      await actions.bulkPublishSchedules(selectedIds);
      setSelectedIds([]);
    }, 'Đã công khai lịch đã chọn');
  }

  function runBulkCancel() {
    if (!selectedIds.length) return;
    runAction(async () => {
      await Promise.all(selectedIds.map((id) => actions.cancelSchedule(id)));
      setSelectedIds([]);
    }, 'Đã hủy lịch đã chọn');
  }

  function runBulkComplete() {
    if (!selectedIds.length) return;
    runAction(
      async () => {
        await Promise.all(selectedIds.map((id) => schedulingApi.updateSchedule(id, { status: 'completed' })));
        await refresh();
        setSelectedIds([]);
      },
      'Đã hoàn thành lịch đã chọn',
    );
  }

  function runBulkBlock() {
    if (!selectedRows.length) return;
    runAction(
      async () => {
        await Promise.all(
          selectedRows.map((item) =>
            actions.batchBlockSlots(item.id, {
              from_time: item.start,
              to_time: item.end,
              reason: 'Khóa slot từ danh sách lịch',
            }),
          ),
        );
        setSelectedIds([]);
      },
      'Đã khóa slot lịch đã chọn',
    );
  }

  function runBulkReopen() {
    if (!selectedRows.length) return;
    runAction(
      async () => {
        await Promise.all(
          selectedRows.map((item) =>
            actions.batchReopenSlots(item.id, {
              from_time: item.start,
              to_time: item.end,
              reason: 'Mở khóa slot từ thao tác nhanh',
            }),
          ),
        );
        setSelectedIds([]);
      },
      'Đã mở khóa slot lịch đã chọn',
    );
  }

  function runBulkDuplicate() {
    if (!selectedRows.length) return;
    runAction(async () => {
      await Promise.all(
        selectedRows.map((item) =>
          actions.duplicateSchedule(item.id, {
            work_date: getDuplicateDate(item.date),
          }),
        ),
      );
      setSelectedIds([]);
      setIsBulkMenuOpen(false);
    }, 'Đã sao chép lịch đã chọn sang tuần sau');
  }

  function runRowBlock(item) {
    runAction(
      () =>
        actions.batchBlockSlots(item.id, {
          from_time: item.start,
          to_time: item.end,
          reason: 'Khóa nhanh từ danh sách lịch',
        }),
      'Đã khóa khung giờ',
    );
  }

  return (
    <main className="scheduling-list-page">
      <section className="scheduling-list-header">
        <div className="scheduling-list-header__visual" aria-hidden="true">
          <CalendarClock size={52} strokeWidth={2.05} />
          <Sparkles size={14} strokeWidth={2.4} />
        </div>

        <div className="scheduling-list-header__content">
          <div className="scheduling-list-header__title">
            <h1>
              Danh sách lịch bác sĩ
              <span aria-hidden="true">
                <Sparkles size={16} strokeWidth={2.45} />
              </span>
            </h1>
            <p>Quản lý toàn bộ lịch khám, theo dõi trạng thái và hiệu suất của từng lịch.</p>
          </div>

          <div className="scheduling-list-header__summary" aria-label="Tóm tắt danh sách lịch">
            {headerSummaryStats.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.id} className="scheduling-list-header__summary-item" style={{ '--summary-color': item.color }}>
                  <span aria-hidden="true">
                    <Icon size={18} strokeWidth={2.35} />
                  </span>
                  <div>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="scheduling-list-header__actions">
          <button type="button" onClick={() => runAction(refresh, 'Đã làm mới dữ liệu')} disabled={loading}>
            <RefreshCw size={15} strokeWidth={2.25} aria-hidden="true" />
            Làm mới
          </button>
          <Link to="/scheduling/calendar">
            <CalendarDays size={15} strokeWidth={2.25} aria-hidden="true" />
            Lịch trực quan
          </Link>
          <div className="scheduling-list-header__create" ref={createMenuRef}>
            <Link to="/scheduling/create" className="is-primary">
              <Plus size={16} strokeWidth={2.35} aria-hidden="true" />
              Tạo lịch mới
            </Link>
            <button
              type="button"
              aria-controls="scheduling-create-menu"
              aria-expanded={isCreateMenuOpen}
              aria-label="Mở tùy chọn tạo lịch"
              onClick={() => setIsCreateMenuOpen((current) => !current)}
            >
              <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
            </button>

            {isCreateMenuOpen ? (
              <div className="scheduling-list-header__create-menu" id="scheduling-create-menu" role="menu">
                <Link to="/scheduling/create" role="menuitem" onClick={() => setIsCreateMenuOpen(false)}>
                  <Plus size={15} strokeWidth={2.25} aria-hidden="true" />
                  Tạo một lịch
                </Link>
                <Link to="/scheduling/bulk-create" role="menuitem" onClick={() => setIsCreateMenuOpen(false)}>
                  <CalendarDays size={15} strokeWidth={2.25} aria-hidden="true" />
                  Tạo hàng loạt
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {loading || error || actionError ? (
        <section className={`scheduling-sync-banner ${error || actionError ? 'is-warning' : ''}`}>
          <div className="scheduling-sync-banner__icon" aria-hidden="true">
            <ShieldAlert size={39} strokeWidth={2.15} />
          </div>
          <div className="scheduling-sync-banner__copy">
            <strong>{loading ? 'Đang tải danh sách lịch từ máy chủ...' : 'Thông báo đồng bộ'}</strong>
            <span>{actionError || error || 'Danh sách đang được cập nhật.'}</span>
            <small>{loading ? 'Hệ thống đang đồng bộ dữ liệu lịch mới nhất.' : 'Bạn đang xem dữ liệu cục bộ. Một số chức năng có thể bị hạn chế.'}</small>
          </div>
          <div className="scheduling-sync-banner__visual" aria-hidden="true">
            <span><Link2Off size={24} strokeWidth={2.25} /></span>
            <i />
            <span><Server size={28} strokeWidth={2.1} /></span>
          </div>
          <button type="button" onClick={refresh}>
            <RefreshCw size={16} strokeWidth={2.35} aria-hidden="true" />
            Tải lại
          </button>
        </section>
      ) : null}

      <section className="scheduling-list-overview">
        <div className="scheduling-list-stat-grid">
          {overviewStats.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.id} className="scheduling-list-stat-card" style={{ '--stat-color': item.tone, '--stat-bg': item.bg }}>
                <span aria-hidden="true">
                  <Icon size={17} strokeWidth={2.3} />
                </span>
                <div>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                  <b>{item.ratio}</b>
                </div>
                <svg className="scheduling-list-stat-card__chart" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
                  <polygon points={`${item.points} 100,38 0,38`} />
                  <polyline points={item.points} />
                </svg>
              </article>
            );
          })}
        </div>

        <aside className="scheduling-list-performance">
          <h2>Hiệu suất tổng quan</h2>
          <div className="scheduling-list-radar" aria-label="Biểu đồ hiệu suất tổng quan">
            <svg viewBox="0 0 152 152" role="img">
              {[0.25, 0.5, 0.75, 1].map((scale) => (
                <polygon
                  key={scale}
                  points={radarAxisPoints
                    .map((point, index) => {
                      const axisPoint = getRadarPoint(100 * scale, index, radarAxes.length, radarCenter, radarRadius);
                      return `${axisPoint.pointX},${axisPoint.pointY}`;
                    })
                    .join(' ')}
                  className="scheduling-list-radar__ring"
                />
              ))}
              {radarAxisPoints.map((point, index) => (
                <line key={radarAxes[index]} x1={radarCenter} y1={radarCenter} x2={point.axisX} y2={point.axisY} className="scheduling-list-radar__axis" />
              ))}
              {departmentPerformance.map((item) => (
                <polygon
                  key={item.id}
                  points={item.radarValues
                    .map((value, index) => {
                      const point = getRadarPoint(value, index, radarAxes.length, radarCenter, radarRadius);
                      return `${point.pointX},${point.pointY}`;
                    })
                    .join(' ')}
                  fill={`${item.color}18`}
                  stroke={item.color}
                  className="scheduling-list-radar__shape"
                />
              ))}
              {radarAxisPoints.map((point, index) => (
                <text key={radarAxes[index]} x={point.labelX} y={point.labelY}>
                  {radarAxes[index]}
                </text>
              ))}
            </svg>
          </div>
          <div className="scheduling-list-performance__legend">
            {departmentPerformance.map((item) => (
              <div key={item.id}>
                <i style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
                <b>{item.value}%</b>
              </div>
            ))}
          </div>
        </aside>

        <section className="scheduling-list-filter-card">
          <div className="scheduling-list-filter-main">
            <label className="scheduling-list-filter-field is-search">
              <span>Tìm bác sĩ hoặc mã lịch...</span>
              <div>
                <Search size={15} strokeWidth={2.2} aria-hidden="true" />
                <input
                  type="search"
                  value={draftFilters.search}
                  placeholder="Tìm bác sĩ hoặc mã lịch..."
                  onChange={(event) => updateDraftFilter('search', event.target.value)}
                />
              </div>
            </label>

            <label className="scheduling-list-filter-field">
              <span>Bác sĩ</span>
              <select value={draftFilters.doctor} onChange={(event) => updateDraftFilter('doctor', event.target.value)}>
                <option value="">Tất cả bác sĩ</option>
                {doctors.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </label>

            <label className="scheduling-list-filter-field">
              <span>Khoa</span>
              <select value={draftFilters.department} onChange={(event) => updateDraftFilter('department', event.target.value)}>
                <option value="">Tất cả khoa</option>
                {departments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </label>

            <label className="scheduling-list-filter-field">
              <span>Từ ngày</span>
              <div>
                <input type="date" value={draftFilters.fromDate} onChange={(event) => updateDraftFilter('fromDate', event.target.value)} />
              </div>
            </label>

            <label className="scheduling-list-filter-field">
              <span>Đến ngày</span>
              <div>
                <input type="date" value={draftFilters.toDate} onChange={(event) => updateDraftFilter('toDate', event.target.value)} />
              </div>
            </label>

            <label className="scheduling-list-filter-field">
              <span>Trạng thái</span>
              <select value={draftFilters.status} onChange={(event) => updateDraftFilter('status', event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="Published">Đã công khai</option>
                <option value="Draft">Bản nháp</option>
                <option value="Cancelled">Đã hủy</option>
                <option value="Completed">Hoàn tất</option>
              </select>
            </label>
          </div>

          <div className="scheduling-list-filter-tools">
            <button type="button" className="scheduling-list-filter-toggle" onClick={() => setIsAdvancedFiltersOpen((current) => !current)}>
              <Filter size={14} strokeWidth={2.25} aria-hidden="true" />
              Bộ lọc nâng cao
              <ChevronDown size={13} strokeWidth={2.35} aria-hidden="true" />
            </button>
            <span>Trạng thái: {draftFilters.status || 'Tất cả'}</span>
            <span>Khoa: {draftFilters.department || 'Tất cả'}</span>
            <span>Hiệu suất: {draftFilters.utilization || 'Tất cả'}</span>
            <button type="button" className="is-add" onClick={() => setIsAdvancedFiltersOpen(true)}>
              <Plus size={14} strokeWidth={2.35} aria-hidden="true" />
              Thêm bộ lọc
            </button>
            <div className="scheduling-list-filter-actions">
              <button type="button" onClick={applyFilters}>
                <SlidersHorizontal size={14} strokeWidth={2.25} aria-hidden="true" />
                Áp dụng
              </button>
              <button type="button" onClick={saveFilters}>
                <Save size={14} strokeWidth={2.25} aria-hidden="true" />
                Lưu bộ lọc
              </button>
              <button type="button" onClick={resetFilters}>
                <RotateCcw size={14} strokeWidth={2.25} aria-hidden="true" />
                Xóa tất cả
              </button>
            </div>
          </div>

          {isAdvancedFiltersOpen ? (
            <div className="scheduling-list-filter-extra">
              <label>
                <span>Hiển thị</span>
                <select value={draftFilters.publishStatus} onChange={(event) => updateDraftFilter('publishStatus', event.target.value)}>
                  <option value="">Tất cả trạng thái hiển thị</option>
                  <option value="Visible">Đang hiển thị</option>
                  <option value="Hidden">Đang ẩn</option>
                </select>
              </label>
              <label>
                <span>Tình trạng khung giờ</span>
                <select value={draftFilters.slotState} onChange={(event) => updateDraftFilter('slotState', event.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="available">Còn khung giờ</option>
                  <option value="full">Đã kín</option>
                  <option value="blocked">Có khung giờ bị khóa</option>
                </select>
              </label>
              <label>
                <span>Hiệu suất</span>
                <select value={draftFilters.utilization} onChange={(event) => updateDraftFilter('utilization', event.target.value)}>
                  <option value="">Tất cả hiệu suất</option>
                  <option value="high">Cao từ 80%</option>
                  <option value="medium">Trung bình 40-79%</option>
                  <option value="low">Thấp dưới 40%</option>
                </select>
              </label>
              {filterNotice ? <small>{filterNotice}</small> : null}
            </div>
          ) : filterNotice ? (
            <small className="scheduling-list-filter-notice">{filterNotice}</small>
          ) : null}
        </section>
      </section>

      <section className="scheduling-list-workspace">
        <section className="scheduling-list-board">
          <div className="scheduling-list-bulkbar">
            <div className="scheduling-list-selection-state">
              <button type="button" className={selectedIds.length ? 'is-selected' : ''} onClick={togglePageSelection} aria-label="Chọn trang hiện tại">
                <CheckCircle2 size={15} strokeWidth={2.55} aria-hidden="true" />
              </button>
              <strong>Đã chọn {selectedIds.length} lịch</strong>
              <button type="button" onClick={() => setSelectedIds([])}>Xóa chọn</button>
            </div>

            <div className="scheduling-list-bulk-actions">
              <button type="button" onClick={runBulkPublish} disabled={!selectedIds.length}>
                <CheckCircle2 size={14} strokeWidth={2.35} aria-hidden="true" />
                Công khai
              </button>
              <button type="button" className="is-danger" onClick={runBulkCancel} disabled={!selectedIds.length}>
                <Ban size={14} strokeWidth={2.35} aria-hidden="true" />
                Hủy lịch
              </button>
              <button type="button" className="is-warning" onClick={runBulkComplete} disabled={!selectedIds.length}>
                <CheckCircle2 size={14} strokeWidth={2.35} aria-hidden="true" />
                Hoàn thành
              </button>
              <button type="button" className="is-lock" onClick={runBulkBlock} disabled={!selectedIds.length}>
                <LockKeyhole size={14} strokeWidth={2.35} aria-hidden="true" />
                Khóa slot
              </button>
              <div className="scheduling-list-bulk-more">
                <button
                  type="button"
                  className="is-icon"
                  aria-label="Thêm thao tác"
                  aria-expanded={isBulkMenuOpen}
                  onClick={() => setIsBulkMenuOpen((current) => !current)}
                >
                  <MoreHorizontal size={15} strokeWidth={2.35} aria-hidden="true" />
                </button>
                {isBulkMenuOpen ? (
                  <div>
                    <button type="button" onClick={runBulkDuplicate} disabled={!selectedIds.length}>
                      <CopyPlus size={13} strokeWidth={2.25} aria-hidden="true" />
                      Sao chép sang tuần sau
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds([]);
                        setIsBulkMenuOpen(false);
                      }}
                    >
                      <X size={13} strokeWidth={2.25} aria-hidden="true" />
                      Xóa vùng chọn
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="scheduling-list-table-toolbar">
            <div className="scheduling-list-tabs">
              {[
                ['all', 'Tất cả', tabCounts.all],
                ['published', 'Đã công khai', tabCounts.published],
                ['draft', 'Bản nháp', tabCounts.draft],
                ['cancelled', 'Đã hủy', tabCounts.cancelled],
                ['blocked', 'Khóa khung giờ', tabCounts.blocked],
              ].map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  className={tableTab === id ? 'is-active' : ''}
                  onClick={() => {
                    setTableTab(id);
                    setPage(1);
                  }}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>

            <div className="scheduling-list-table-tools">
              <label>
                Sắp xếp:
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="utilization">Hiệu suất cao</option>
                  <option value="doctor">Theo bác sĩ</option>
                </select>
              </label>
              <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')} aria-label="Xem dạng lưới">
                <Grid2X2 size={15} strokeWidth={2.2} aria-hidden="true" />
              </button>
              <button type="button" className={viewMode === 'table' ? 'is-active' : ''} onClick={() => setViewMode('table')} aria-label="Xem dạng danh sách">
                <List size={15} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
          </div>

          {actionError || error ? (
            <div className="scheduling-list-message is-error">
              {actionError || error}
            </div>
          ) : null}

          <div className={`scheduling-list-data-table is-${viewMode}`}>
            <div className="scheduling-list-data-head">
              <span>
                <button type="button" className={allPageSelected ? 'is-checked' : ''} onClick={togglePageSelection} aria-label="Chọn tất cả dòng đang hiển thị" />
              </span>
              <span>Lịch / Bác sĩ</span>
              <span>Khoa</span>
              <span>Ngày</span>
              <span>Giờ</span>
              <span>Tổng</span>
              <span>Đã đặt</span>
              <span>Còn trống</span>
              <span>Trạng thái</span>
              <span>Hiệu suất</span>
              <span>Thao tác</span>
            </div>

            {pagedRows.map((item, index) => {
              const rowIndex = (safePage - 1) * pageSize + index;
              const isSelected = selectedIds.includes(item.id);

              return (
                <div key={item.id} className={`scheduling-list-data-row ${isSelected ? 'is-selected' : ''}`}>
                  <button
                    type="button"
                    className={`scheduling-list-checkbox ${isSelected ? 'is-checked' : ''}`}
                    onClick={() => toggleRowSelection(item.id)}
                    aria-label={`Chọn ${item.doctor}`}
                  />
                  <div className="scheduling-list-doctor-cell">
                    <img src={getDoctorAvatar(item, rowIndex)} alt="" loading="lazy" onError={handleDoctorAvatarError} />
                    <div>
                      <strong>{item.doctor}</strong>
                      <span>{getScheduleCode(item, rowIndex)}</span>
                    </div>
                  </div>
                  <span>{item.department}</span>
                  <span>
                    <b>{formatCompactDate(item.date)}</b>
                    <small>{formatWeekday(item.date)}</small>
                  </span>
                  <span>
                    <b>{item.start}</b>
                    <small>{item.end}</small>
                  </span>
                  <span>{item.totalSlots}</span>
                  <span>{item.bookedSlots}</span>
                  <span>{item.availableSlots}</span>
                  <StatusBadge>{item.status}</StatusBadge>
                  <div className={`scheduling-list-util-cell ${getUtilizationClass(item.utilization)}`}>
                    <strong>{Math.round(Number(item.utilization || 0))}%</strong>
                    <i>
                      <span style={{ width: `${Math.min(Number(item.utilization || 0), 100)}%` }} />
                    </i>
                  </div>
                  <div className="scheduling-list-row-actions">
                    <Link to={`/scheduling/schedules/${item.id}`} aria-label={`Xem ${item.doctor}`} title="Xem">
                      <Eye size={14} strokeWidth={2.25} />
                    </Link>
                    <Link to={`/scheduling/schedules/${item.id}`} aria-label={`Sửa ${item.doctor}`} title="Sửa">
                      <PencilLine size={14} strokeWidth={2.25} />
                    </Link>
                    <div className="scheduling-list-row-menu">
                      <button type="button" onClick={() => setOpenRowMenuId((current) => (current === item.id ? '' : item.id))} aria-label="Mở thao tác">
                        <MoreHorizontal size={14} strokeWidth={2.25} />
                      </button>
                      {openRowMenuId === item.id ? (
                        <div>
                          <button type="button" onClick={() => {
                            setOpenRowMenuId('');
                            runAction(() => actions.duplicateSchedule(item.id, { work_date: getDuplicateDate(item.date) }), 'Đã sao chép lịch');
                          }}>
                            <CopyPlus size={13} strokeWidth={2.25} />
                            Sao chép
                          </button>
                          <button type="button" onClick={() => {
                            setOpenRowMenuId('');
                            runRowBlock(item);
                          }}>
                            <LockKeyhole size={13} strokeWidth={2.25} />
                            Khóa slot
                          </button>
                          <button type="button" onClick={() => {
                            setOpenRowMenuId('');
                            runAction(() => actions.cancelSchedule(item.id), 'Đã hủy lịch');
                          }}>
                            <Ban size={13} strokeWidth={2.25} />
                            Hủy lịch
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}

            {!pagedRows.length ? (
              <div className="scheduling-list-empty-row">
                <ClipboardList size={18} strokeWidth={2.2} aria-hidden="true" />
                <strong>Không có lịch phù hợp</strong>
                <span>Thử thay đổi bộ lọc hoặc tạo lịch mới để tiếp tục vận hành.</span>
              </div>
            ) : null}
          </div>

          <div className="scheduling-list-pagination">
            <span>
              Hiển thị {(safePage - 1) * pageSize + 1} - {Math.min(safePage * pageSize, tableRows.length)} trong tổng số {tableRows.length} lịch
            </span>
            <div>
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                <option value={5}>5 / trang</option>
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
              </select>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>
                <ChevronLeft size={14} strokeWidth={2.3} />
              </button>
              {[1, 2, 3].filter((item) => item <= totalPages).map((item) => (
                <button key={item} type="button" className={safePage === item ? 'is-active' : ''} onClick={() => setPage(item)}>
                  {item}
                </button>
              ))}
              {totalPages > 4 ? <span>...</span> : null}
              {totalPages > 3 ? (
                <button type="button" className={safePage === totalPages ? 'is-active' : ''} onClick={() => setPage(totalPages)}>
                  {totalPages}
                </button>
              ) : null}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>
                <ChevronRight size={14} strokeWidth={2.3} />
              </button>
            </div>
          </div>
        </section>

        <aside className="scheduling-list-side">
          {isTodayCardVisible ? (
          <section className="scheduling-list-today-card">
            <div>
              <h3>Lịch hôm nay</h3>
              <button type="button" aria-label="Ẩn lịch hôm nay" onClick={() => setIsTodayCardVisible(false)}>
                <X size={13} strokeWidth={2.4} />
              </button>
            </div>
            <p>{formatWeekday(selectedCalendarDate)}, {formatCompactDate(selectedCalendarDate)}</p>
            <div className="scheduling-list-week">
              {weekDays.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  className={day.date === selectedCalendarDate ? 'is-active' : ''}
                  onClick={() => setSelectedCalendarDate(day.date)}
                >
                  <span>{day.label}</span>
                  <strong>{day.day}</strong>
                </button>
              ))}
            </div>
            <div className="scheduling-list-today-stats">
              <div><span>Lịch hôm nay</span><strong>{visibleTodaySchedules.length}</strong></div>
              <div><span>Đã đặt</span><strong>{visibleTodaySchedules.reduce((total, item) => total + Number(item.bookedSlots || 0), 0)}</strong></div>
              <div><span>Còn trống</span><strong>{visibleTodaySchedules.reduce((total, item) => total + Number(item.availableSlots || 0), 0)}</strong></div>
            </div>
          </section>
          ) : null}

          <section className="scheduling-list-activity-card">
            <div>
              <h3>Hoạt động gần đây</h3>
              <Link to="/scheduling/schedules">Xem tất cả</Link>
            </div>
            <div className="scheduling-list-activity-list">
              {recentActivities.map((item) => (
                <article key={item.id}>
                  {item.avatar ? <img src={item.avatar} alt="" onError={handleDoctorAvatarError} /> : <span><LockKeyhole size={14} strokeWidth={2.3} /></span>}
                  <strong>{item.title}</strong>
                  <small>{item.time}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="scheduling-list-quick-card">
            <h3>Thao tác nhanh</h3>
            <div className="scheduling-list-quick-grid">
              <button
                type="button"
                className="is-copy"
                onClick={runBulkDuplicate}
                disabled={!selectedRows.length}
                title={selectedRows.length ? 'Sao chép lịch đã chọn sang tuần sau' : 'Chọn lịch trong bảng để nhân bản'}
              >
                <span aria-hidden="true"><CopyPlus size={15} strokeWidth={2.35} /></span>
                <strong>Nhân bản lịch</strong>
                <small>Sao chép lịch hiện có</small>
              </button>
              <Link to="/scheduling/bulk-create" className="is-bulk">
                <span aria-hidden="true"><CalendarDays size={15} strokeWidth={2.35} /></span>
                <strong>Tạo nhiều lịch</strong>
                <small>Tạo lịch hàng loạt</small>
              </Link>
              <button
                type="button"
                className="is-lock"
                onClick={runBulkBlock}
                disabled={!selectedRows.length}
                title={selectedRows.length ? 'Khóa slot của lịch đã chọn' : 'Chọn lịch trong bảng để khóa slot'}
              >
                <span aria-hidden="true"><LockKeyhole size={15} strokeWidth={2.35} /></span>
                <strong>Khóa slot</strong>
                <small>Khóa khung giờ</small>
              </button>
              <button
                type="button"
                className="is-open"
                onClick={runBulkReopen}
                disabled={!selectedRows.length}
                title={selectedRows.length ? 'Mở khóa slot của lịch đã chọn' : 'Chọn lịch trong bảng để mở khóa slot'}
              >
                <span aria-hidden="true"><LockKeyhole size={15} strokeWidth={2.35} /></span>
                <strong>Mở khóa slot</strong>
                <small>Mở lại khung giờ</small>
              </button>
            </div>
          </section>
        </aside>
      </section>

      <section className="scheduling-list-tip">
        <Info size={15} strokeWidth={2.35} aria-hidden="true" />
        <strong>Mẹo:</strong>
        <span>Sử dụng bộ lọc để tìm kiếm nhanh hoặc chọn nhiều lịch để thao tác hàng loạt.</span>
      </section>
    </main>
  );
}
