import {
  Activity,
  Building2,
  BellRing,
  CalendarClock,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CalendarX2,
  ChevronDown,
  ChevronUp,
  ChartNoAxesCombined,
  CheckCheck,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  DoorOpen,
  Download,
  FileClock,
  FileText,
  Gauge,
  Headphones,
  House,
  Hospital,
  Import,
  LayoutDashboard,
  Layers3,
  Bell,
  CircleCheck,
  ListChecks,
  ListOrdered,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MonitorPlay,
  Moon,
  Repeat2,
  Search,
  Send,
  Settings,
  Settings2,
  Shield,
  SlidersHorizontal,
  ShieldCheck,
  Stethoscope,
  Sun,
  TreePalm,
  TriangleAlert,
  UserCheck,
  UserCog,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  WandSparkles,
  Workflow,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppLogo, APP_BRAND_NAME } from '../../app/AppLogo';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';
import { SchedulingDataProvider } from '../context/SchedulingDataContext';

const THEME_STORAGE_KEY = 'healthcare.scheduling.theme';
const NOTIFICATION_STORAGE_KEY = 'healthcare.scheduling.notifications';
const SCHEDULING_NOTIFICATION_EVENT = 'healthcare:scheduling-notification';
const SCHEDULING_BULK_CREATE_FOCUS_EVENT = 'healthcare:scheduling-bulk-create-focus';
const DEFAULT_OPEN_NAV_GROUP = 'operations-overview';

const operationsNavGroups = [
  {
    id: DEFAULT_OPEN_NAV_GROUP,
    section: '01',
    label: 'Tổng quan vận hành',
    hint: 'Dashboard, lịch hôm nay, tải và cảnh báo',
    icon: LayoutDashboard,
    items: [
      { label: 'Dashboard vận hành', to: '/scheduling/overview', hint: 'Bức tranh vận hành tổng thể', icon: House },
      { label: 'Lịch hôm nay', to: '/scheduling/today', hint: 'Lịch khám và điều phối trong ngày', icon: CalendarClock },
      { label: 'Queue hiện tại', to: '/scheduling/current-queue', hint: 'Hàng đợi đang phục vụ', icon: ListOrdered },
      { label: 'Tải khoa / bác sĩ / phòng', to: '/scheduling/load', hint: 'Tải theo khoa, bác sĩ và phòng', icon: Gauge },
      { label: 'Slot & công suất', to: '/scheduling/capacity', hint: 'Công suất slot đang mở', icon: Clock3 },
      { label: 'Cảnh báo vận hành', to: '/scheduling/alerts', hint: 'Việc cần xử lý ngay', icon: TriangleAlert },
    ],
  },
  {
    id: 'appointments',
    section: '02',
    label: 'Lịch hẹn',
    hint: 'Đặt, xác nhận, dời hủy và check-in',
    icon: CalendarCheck2,
    items: [
      { label: 'Quản lý lịch hẹn', to: '/scheduling/appointments', hint: 'Danh sách lịch hẹn bệnh nhân', icon: CalendarDays },
      { label: 'Lịch hẹn trực quan', to: '/scheduling/appointments/calendar', hint: 'Xem theo ngày, tuần, phòng khám', icon: CalendarCheck2 },
      { label: 'Tạo lịch hẹn', to: '/scheduling/appointments/create', hint: 'Đặt hẹn mới cho bệnh nhân', icon: CalendarPlus },
      { label: 'Xác nhận / nhắc lịch', to: '/scheduling/appointments/confirmation', hint: 'Xác nhận và nhắc hẹn', icon: BellRing },
      { label: 'Dời / hủy lịch', to: '/scheduling/appointments/reschedule-cancel', hint: 'Điều chỉnh lịch đã đặt', icon: CalendarX2 },
      { label: 'Check-in', to: '/scheduling/appointments/check-in', hint: 'Tiếp nhận bệnh nhân đến khám', icon: ClipboardCheck },
      { label: 'No-show', to: '/scheduling/appointments/no-show', hint: 'Theo dõi bệnh nhân không đến', icon: UserRoundX },
      { label: 'Danh sách chờ', to: '/scheduling/appointments/waitlist', hint: 'Bệnh nhân chờ slot phù hợp', icon: ListChecks },
    ],
  },
  {
    id: 'doctor-schedules',
    section: '03',
    label: 'Lịch làm việc bác sĩ',
    hint: 'Lập, duyệt, publish và kiểm tra xung đột',
    icon: Stethoscope,
    items: [
      { label: 'Quản lý lịch làm việc', to: '/scheduling/doctor-schedules', hint: 'Toàn bộ lịch làm việc bác sĩ', icon: CalendarDays },
      { label: 'Lịch trực quan', to: '/scheduling/doctor-schedules/calendar', hint: 'Lịch trực quan theo ngày / tuần', icon: CalendarCheck2 },
      { label: 'Tạo lịch làm việc', to: '/scheduling/doctor-schedules/create', hint: 'Tạo ca làm việc mới', icon: WandSparkles },
      { label: 'Tạo hàng loạt', to: '/scheduling/doctor-schedules/bulk-create', hint: 'Sinh lịch nhiều bác sĩ cùng lúc', icon: Layers3 },
      { label: 'Duyệt / publish lịch', to: '/scheduling/doctor-schedules/publish', hint: 'Duyệt và công bố lịch', icon: Send },
      { label: 'Kiểm tra xung đột', to: '/scheduling/doctor-schedules/conflicts', hint: 'Phát hiện trùng bác sĩ, phòng, slot', icon: TriangleAlert },
      { label: 'Tác động khi đổi lịch', to: '/scheduling/doctor-schedules/impact', hint: 'Ảnh hưởng tới bệnh nhân và slot', icon: Workflow },
    ],
  },
  {
    id: 'slots-capacity',
    section: '04',
    label: 'Slot & công suất',
    hint: 'Khung giờ, tạo slot, khóa mở và phân tích tải',
    icon: Clock3,
    items: [
      { label: 'Khung giờ & slot', to: '/scheduling/slots', hint: 'Quản lý slot khám', icon: Clock3 },
      { label: 'Tạo / generate slot', to: '/scheduling/slots/generate', hint: 'Sinh slot theo quy tắc', icon: WandSparkles },
      { label: 'Chặn / mở slot', to: '/scheduling/slots/blocking', hint: 'Khóa hoặc mở lại slot', icon: Shield },
      { label: 'Import / Export slot', to: '/scheduling/slots/import-export', hint: 'Nhập xuất danh sách slot', icon: Import },
      { label: 'Phân tích công suất', to: '/scheduling/slots/utilization', hint: 'Hiệu suất khai thác slot', icon: ChartNoAxesCombined },
      { label: 'Nhật ký slot', to: '/scheduling/slots/activity', hint: 'Lịch sử thay đổi slot', icon: FileClock },
    ],
  },
  {
    id: 'queue-calling',
    section: '05',
    label: 'Queue & gọi số',
    hint: 'Board hàng đợi, gọi bệnh nhân, ưu tiên queue',
    icon: ListOrdered,
    items: [
      { label: 'Queue board', to: '/scheduling/queue', hint: 'Bảng điều phối queue realtime', icon: ClipboardList },
      { label: 'Queue hôm nay', to: '/scheduling/queue/today', hint: 'Hàng đợi trong ngày', icon: ListOrdered },
      { label: 'Gọi bệnh nhân', to: '/scheduling/queue/call', hint: 'Call console cho phòng khám', icon: Megaphone },
      { label: 'Chuyển / ưu tiên queue', to: '/scheduling/queue/transfer-priority', hint: 'Điều chuyển và ưu tiên hàng đợi', icon: Repeat2 },
      { label: 'Xử lý missed call / no-show', to: '/scheduling/queue/missed-no-show', hint: 'Xử lý gọi nhỡ và vắng mặt', icon: UserRoundX },
      { label: 'Public queue board', to: '/scheduling/queue/public-board', hint: 'Màn hình queue công khai', icon: MonitorPlay },
    ],
  },
  {
    id: 'patient-flow',
    section: '06',
    label: 'Điều phối bệnh nhân trong ngày',
    hint: 'Theo dõi luồng check-in, chờ, khám và hoàn tất',
    icon: Activity,
    items: [
      { label: 'Patient flow board', to: '/scheduling/patient-flow', hint: 'Luồng bệnh nhân trong ngày', icon: Workflow },
      { label: 'Check-in monitor', to: '/scheduling/patient-flow/check-in', hint: 'Theo dõi trạng thái check-in', icon: ClipboardCheck },
      { label: 'Bệnh nhân đang chờ', to: '/scheduling/patient-flow/waiting', hint: 'Danh sách bệnh nhân chờ khám', icon: UsersRound },
      { label: 'Bệnh nhân đang khám', to: '/scheduling/patient-flow/in-consultation', hint: 'Bệnh nhân đang được phục vụ', icon: UserRoundCheck },
      { label: 'Bệnh nhân cần điều phối', to: '/scheduling/patient-flow/needs-action', hint: 'Các trường hợp cần xử lý', icon: TriangleAlert },
      { label: 'Bệnh nhân hoàn tất / rời hệ thống', to: '/scheduling/patient-flow/completed', hint: 'Đã hoàn tất quy trình', icon: DoorOpen },
    ],
  },
  {
    id: 'resources',
    section: '07',
    label: 'Khoa, bác sĩ & tài nguyên',
    hint: 'Khoa, phòng, bác sĩ, trạng thái tài nguyên',
    icon: Hospital,
    items: [
      { label: 'Khoa / phòng ban', to: '/scheduling/departments', hint: 'Danh sách khoa và phòng ban', icon: Building2 },
      { label: 'Bác sĩ', to: '/scheduling/doctors', hint: 'Lịch và tải từng bác sĩ', icon: Stethoscope },
      { label: 'Phòng khám / địa điểm', to: '/scheduling/rooms-locations', hint: 'Phòng khám và địa điểm phục vụ', icon: MapPin },
      { label: 'Tải lịch bác sĩ', to: '/scheduling/doctor-load', hint: 'Công suất lịch theo bác sĩ', icon: Gauge },
      { label: 'Trạng thái phòng', to: '/scheduling/room-status', hint: 'Phòng trống, đang dùng, cần chú ý', icon: Hospital },
      { label: 'Tài nguyên cần chú ý', to: '/scheduling/resources/attention', hint: 'Tài nguyên quá tải hoặc thiếu slot', icon: TriangleAlert },
    ],
  },
  {
    id: 'alerts',
    section: '08',
    label: 'Cảnh báo vận hành',
    hint: 'Cảnh báo lịch, queue, bác sĩ, no-show',
    icon: BellRing,
    items: [
      { label: 'Tất cả cảnh báo', to: '/scheduling/alerts', hint: 'Toàn bộ cảnh báo cần xử lý', icon: Bell },
      { label: 'Cảnh báo lịch / slot', to: '/scheduling/alerts/schedule-slot', hint: 'Lịch và slot bất thường', icon: CalendarX2 },
      { label: 'Cảnh báo queue', to: '/scheduling/alerts/queue', hint: 'Queue chờ lâu hoặc quá tải', icon: ListOrdered },
      { label: 'Cảnh báo bác sĩ / khoa', to: '/scheduling/alerts/doctor-department', hint: 'Tải bác sĩ và khoa cần chú ý', icon: Stethoscope },
      { label: 'Cảnh báo no-show', to: '/scheduling/alerts/no-show', hint: 'No-show vượt ngưỡng', icon: UserRoundX },
      { label: 'Cảnh báo cần xử lý ngay', to: '/scheduling/alerts/action-center', hint: 'Ưu tiên xử lý tức thời', icon: TriangleAlert },
    ],
  },
  {
    id: 'quick-reports',
    section: '09',
    label: 'Báo cáo nhanh',
    hint: 'Báo cáo lịch hẹn, queue, công suất và no-show',
    icon: ChartNoAxesCombined,
    items: [
      { label: 'Dashboard báo cáo vận hành', to: '/scheduling/reports', hint: 'Dashboard hiệu suất vận hành', icon: ChartNoAxesCombined },
      { label: 'Báo cáo lịch hẹn', to: '/scheduling/reports/appointments', hint: 'Đặt, xác nhận, dời hủy lịch', icon: CalendarCheck2 },
      { label: 'Báo cáo queue', to: '/scheduling/reports/queue', hint: 'Thời gian chờ và gọi số', icon: ListOrdered },
      { label: 'Báo cáo công suất', to: '/scheduling/reports/utilization', hint: 'Khai thác công suất theo tài nguyên', icon: Gauge },
      { label: 'Báo cáo no-show / hủy / dời lịch', to: '/scheduling/reports/no-show', hint: 'Biến động lịch hẹn', icon: CalendarX2 },
      { label: 'Xuất báo cáo', to: '/scheduling/reports/export', hint: 'Tải file báo cáo', icon: Download },
    ],
  },
  {
    id: 'activity-log',
    section: '10',
    label: 'Nhật ký hoạt động',
    hint: 'Audit trail lịch, slot, queue, check-in',
    icon: FileClock,
    items: [
      { label: 'Tất cả hoạt động', to: '/scheduling/activity', hint: 'Nhật ký toàn bộ thao tác', icon: FileText },
      { label: 'Nhật ký lịch làm việc', to: '/scheduling/activity/doctor-schedules', hint: 'Thay đổi lịch bác sĩ', icon: CalendarDays },
      { label: 'Nhật ký lịch hẹn', to: '/scheduling/activity/appointments', hint: 'Thao tác lịch hẹn', icon: CalendarCheck2 },
      { label: 'Nhật ký slot', to: '/scheduling/activity/slots', hint: 'Thao tác tạo, khóa, mở slot', icon: Clock3 },
      { label: 'Nhật ký queue', to: '/scheduling/activity/queue', hint: 'Điều phối queue và gọi số', icon: ListOrdered },
      { label: 'Nhật ký check-in / điều phối', to: '/scheduling/activity/check-in', hint: 'Check-in và luồng bệnh nhân', icon: UserCheck },
    ],
  },
  {
    id: 'operations-config',
    section: '11',
    label: 'Cấu hình vận hành lịch',
    hint: 'Quy tắc đặt lịch, slot, queue và thông báo',
    icon: Settings,
    items: [
      { label: 'Cấu hình chung', to: '/scheduling/configuration', hint: 'Thiết lập vận hành tổng quát', icon: Settings2 },
      { label: 'Loại lịch / schedule type', to: '/scheduling/configuration/schedule-types', hint: 'Danh mục loại lịch', icon: CalendarDays },
      { label: 'Mẫu lịch', to: '/scheduling/configuration/templates', hint: 'Template lịch làm việc', icon: CalendarCheck2 },
      { label: 'Quy tắc tạo slot', to: '/scheduling/configuration/slot-rules', hint: 'Cách sinh và phân bổ slot', icon: Clock3 },
      { label: 'Quy tắc đặt lịch', to: '/scheduling/configuration/booking-rules', hint: 'Điều kiện đặt và giữ chỗ', icon: ClipboardList },
      { label: 'Quy tắc check-in', to: '/scheduling/configuration/check-in-rules', hint: 'Điều kiện tiếp nhận trong ngày', icon: ClipboardCheck },
      { label: 'Quy tắc hủy / dời lịch / no-show', to: '/scheduling/configuration/cancel-reschedule-no-show', hint: 'Chính sách thay đổi lịch', icon: CalendarX2 },
      { label: 'Quy tắc queue', to: '/scheduling/configuration/queue-rules', hint: 'Ưu tiên và chuyển queue', icon: ListOrdered },
      { label: 'Ngày nghỉ / ngoại lệ', to: '/scheduling/configuration/exceptions', hint: 'Ngày nghỉ và ngoại lệ vận hành', icon: TreePalm },
      { label: 'Telehealth', to: '/scheduling/configuration/telehealth', hint: 'Cấu hình khám từ xa', icon: MonitorPlay },
      { label: 'Thông báo lịch hẹn', to: '/scheduling/configuration/notifications', hint: 'Mẫu và kênh nhắc lịch', icon: BellRing },
      { label: 'Cấu hình nâng cao', to: '/scheduling/configuration/advanced', hint: 'Thiết lập nâng cao', icon: SlidersHorizontal },
    ],
  },
];

const navItems = operationsNavGroups.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    group: group.label,
    groupId: group.id,
  })),
);

const adminQuickLinks = [
  { label: 'Tổng quan admin', to: '/admin/overview', hint: 'Dashboard quản trị', icon: LayoutDashboard },
  { label: 'Quản lý nhân sự', to: '/admin/staff', hint: 'Tài khoản và hồ sơ nhân sự', icon: UsersRound },
  { label: 'Hồ sơ quản trị', to: '/admin/profile', hint: 'Thông tin tài khoản của tôi', icon: UserCog },
  { label: 'Phân quyền', to: '/admin/roles', hint: 'Vai trò và quyền truy cập', icon: ShieldCheck },
  { label: 'Thiết lập hệ thống', to: '/admin/settings', hint: 'Cấu hình vận hành', icon: Settings },
];

const notificationSeed = [
  {
    id: 'approval-overdue',
    title: '3 lịch khám sắp quá hạn duyệt',
    body: 'Ưu tiên kiểm tra trước 17:30 hôm nay.',
    time: '5 phút trước',
    tone: 'danger',
    read: false,
    to: '/scheduling/approvals',
  },
  {
    id: 'schedule-published',
    title: 'Batch lịch Tim mạch đã xuất bản',
    body: '20 lịch đã sẵn sàng cho bệnh nhân đặt hẹn.',
    time: '18 phút trước',
    tone: 'success',
    read: false,
    to: '/scheduling/schedules',
  },
  {
    id: 'config-reminder',
    title: 'Cấu hình nghỉ lễ cần rà soát',
    body: 'Kiểm tra ngoại lệ lịch trước khi tạo lịch tháng mới.',
    time: '1 giờ trước',
    tone: 'info',
    read: false,
    to: '/scheduling/configuration/exceptions',
  },
];

function readStoredNotifications() {
  try {
    const rawValue = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    const storedItems = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(storedItems)) return notificationSeed;
    const mergedItems = [...storedItems, ...notificationSeed];
    const seenIds = new Set();
    return mergedItems.filter((item) => {
      if (!item?.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  } catch (error) {
    return notificationSeed;
  }
}

function storeNotifications(items) {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(items.slice(0, 30)));
  } catch (error) {
    // Ignore storage failures in private browsing.
  }
}

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'light';
  } catch (error) {
    return 'light';
  }
}

function normalizeSearchValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getRoleLabel(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  if (roles.includes('super_admin')) return 'Super Admin';
  if (roles.includes('admin')) return 'Quản trị viên';
  if (roles.includes('doctor')) return 'Bác sĩ';
  if (roles.includes('receptionist')) return 'Lễ tân';
  return 'Quản trị viên';
}

function buildSearchItems() {
  return [
    ...navItems,
    ...adminQuickLinks.map((item) => ({ ...item, group: 'Quản trị' })),
  ];
}

const searchItems = buildSearchItems();

function parseNavigationTarget(to) {
  const target = String(to || '');
  const [pathWithSearch, hashValue = ''] = target.split('#');
  const [pathname, searchValue = ''] = pathWithSearch.split('?');

  return {
    pathname,
    search: searchValue ? `?${searchValue}` : '',
    hash: hashValue ? `#${hashValue}` : '',
  };
}

function isNavigationItemActive(item, location) {
  const target = parseNavigationTarget(item.to);
  const isSamePath = location.pathname === target.pathname;

  if (target.search || target.hash) {
    return isSamePath && (location.search || '') === target.search && (location.hash || '') === target.hash;
  }

  if (location.search || location.hash) {
    return false;
  }

  if (target.pathname === '/scheduling/schedules') {
    return location.pathname === target.pathname || location.pathname.startsWith('/scheduling/schedules/');
  }

  return isSamePath;
}

function getActiveNavGroupIds(location) {
  return operationsNavGroups
    .filter((group) => group.items.some((item) => isNavigationItemActive(item, location)))
    .map((group) => group.id);
}

function buildOpenNavGroups(location) {
  const activeGroupIds = getActiveNavGroupIds(location);
  const openGroupIds = activeGroupIds.length > 0 ? activeGroupIds : [DEFAULT_OPEN_NAV_GROUP];

  return openGroupIds.reduce((groups, groupId) => ({ ...groups, [groupId]: true }), {});
}

export function SchedulingShell() {
  const auth = readStoredAuth();
  const user = auth?.user;
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(readStoredTheme);
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [isMobileRailOpen, setIsMobileRailOpen] = useState(false);
  const [isTopbarAdminMenuOpen, setIsTopbarAdminMenuOpen] = useState(false);
  const [isRailAdminMenuOpen, setIsRailAdminMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(readStoredNotifications);
  const [toastNotification, setToastNotification] = useState(null);
  const [openNavGroups, setOpenNavGroups] = useState(() => buildOpenNavGroups(location));
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const topbarAdminMenuRef = useRef(null);
  const railAdminMenuRef = useRef(null);
  const notificationsRef = useRef(null);
  const userName = user?.full_name || user?.username || 'Admin';
  const roleLabel = getRoleLabel(user);
  const unreadCount = notifications.filter((item) => !item.read).length;

  const searchResults = useMemo(() => {
    const query = normalizeSearchValue(searchQuery);

    if (!query) return searchItems.slice(0, 7);

    return searchItems
      .filter((item) => {
        const haystack = normalizeSearchValue(`${item.label} ${item.hint || ''} ${item.group || ''}`);
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      // Ignore storage failures in private browsing.
    }
  }, [theme]);

  useEffect(() => {
    storeNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    function handleSchedulingNotification(event) {
      const detail = event.detail || {};
      const notification = {
        id: detail.id || `schedule-${Date.now()}`,
        title: detail.title || 'Thông báo lịch khám',
        body: detail.body || '',
        time: detail.time || 'Vừa xong',
        tone: detail.tone || 'info',
        read: false,
        to: detail.to || '/scheduling/schedules',
        focusTarget: detail.focusTarget || null,
      };

      setNotifications((current) => [notification, ...current].slice(0, 30));
      setToastNotification(notification);
      if (detail.openMenu) {
        setIsNotificationsOpen(true);
      }
      window.clearTimeout(handleSchedulingNotification.dismissTimer);
      handleSchedulingNotification.dismissTimer = window.setTimeout(() => {
        setToastNotification((current) => (current?.id === notification.id ? null : current));
      }, 5200);
    }

    window.addEventListener(SCHEDULING_NOTIFICATION_EVENT, handleSchedulingNotification);
    return () => {
      window.removeEventListener(SCHEDULING_NOTIFICATION_EVENT, handleSchedulingNotification);
      window.clearTimeout(handleSchedulingNotification.dismissTimer);
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }

      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }

      if (topbarAdminMenuRef.current && !topbarAdminMenuRef.current.contains(event.target)) {
        setIsTopbarAdminMenuOpen(false);
      }

      if (railAdminMenuRef.current && !railAdminMenuRef.current.contains(event.target)) {
        setIsRailAdminMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      const isSearchShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';

      if (isSearchShortcut) {
        event.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      }

      if (event.key === 'Escape') {
        setIsSearchOpen(false);
        setIsNotificationsOpen(false);
        setIsTopbarAdminMenuOpen(false);
        setIsRailAdminMenuOpen(false);
        setIsMobileRailOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setIsMobileRailOpen(false);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setIsTopbarAdminMenuOpen(false);
    setIsRailAdminMenuOpen(false);
    setOpenNavGroups((current) => ({ ...current, ...buildOpenNavGroups(location) }));
  }, [location.pathname, location.search, location.hash]);

  function closeFloatingUi() {
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
    setIsTopbarAdminMenuOpen(false);
    setIsRailAdminMenuOpen(false);
  }

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  function handleMenuToggle() {
    const isNarrow = window.matchMedia?.('(max-width: 1200px)').matches;

    if (isNarrow) {
      setIsMobileRailOpen((current) => !current);
      return;
    }

    setIsRailCollapsed((current) => !current);
  }

  function handleNavigate(to) {
    navigate(to);
    setSearchQuery('');
    closeFloatingUi();
    setIsMobileRailOpen(false);
  }

  function toggleNavGroup(groupId) {
    setOpenNavGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  }

  function handleSearchKeyDown(event) {
    if (event.key !== 'Enter') return;
    const [firstResult] = searchResults;

    if (firstResult) {
      event.preventDefault();
      handleNavigate(firstResult.to);
    }
  }

  function handleNotificationOpen() {
    setIsNotificationsOpen((current) => !current);
    setIsTopbarAdminMenuOpen(false);
  }

  function handleNotificationClick(item) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === item.id ? { ...notification, read: true } : notification,
      ),
    );

    if (item.focusTarget) {
      handleNavigate(item.to || '/scheduling/bulk-create');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(SCHEDULING_BULK_CREATE_FOCUS_EVENT, {
          detail: item.focusTarget,
        }));
      }, 180);
      return;
    }

    handleNavigate(item.to);
  }

  function markAllNotificationsRead() {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }

  function closeAdminMenus() {
    setIsTopbarAdminMenuOpen(false);
    setIsRailAdminMenuOpen(false);
  }

  const moduleClassName = [
    'scheduling-module',
    theme === 'dark' ? 'is-dark-mode' : '',
    isRailCollapsed ? 'is-rail-collapsed' : '',
    isMobileRailOpen ? 'is-rail-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <SchedulingDataProvider>
      <div className={moduleClassName}>
        <aside className="scheduling-rail" aria-label="Điều hướng điều phối lịch và vận hành">
          <div className="scheduling-rail__head">
            <span className="scheduling-rail__brand-icon" aria-hidden="true">
              <AppLogo variant="mark" alt="" aria-hidden="true" />
            </span>
            <div>
              <strong>ĐIỀU PHỐI LỊCH & VẬN HÀNH</strong>
              <span>{APP_BRAND_NAME}</span>
            </div>
          </div>

          <nav className="scheduling-rail__nav">
            {operationsNavGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupOpen = Boolean(openNavGroups[group.id]);
              const isGroupActive = group.items.some((item) => isNavigationItemActive(item, location));
              const menuId = `scheduling-nav-group-${group.id}`;

              return (
                <div
                  key={group.id}
                  className={`scheduling-nav-group${isGroupOpen ? ' is-open' : ''}${isGroupActive ? ' is-active' : ''}`}
                >
                  <button
                    type="button"
                    className="scheduling-nav-group__trigger"
                    aria-controls={menuId}
                    aria-expanded={isGroupOpen}
                    onClick={() => toggleNavGroup(group.id)}
                  >
                    <span className="scheduling-nav-group__icon" aria-hidden="true">
                      <GroupIcon size={20} strokeWidth={2.15} />
                    </span>
                    <span className="scheduling-nav-group__copy">
                      <strong>
                        <span className="scheduling-nav-group__section">{group.section}</span>
                        <span className="scheduling-nav-group__title">{group.label}</span>
                      </strong>
                      <small>{group.hint}</small>
                    </span>
                    {isGroupOpen ? (
                      <ChevronUp size={15} strokeWidth={2.35} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
                    )}
                  </button>

                  {isGroupOpen ? (
                    <div className="scheduling-nav-group__menu" id={menuId}>
                      {group.items.map((item) => {
                        const Icon = item.icon;

                        return (
                          <Link
                            key={`${group.id}-${item.to}-${item.label}`}
                            to={item.to}
                            className={isNavigationItemActive(item, location) ? 'is-active' : ''}
                            onClick={() => setIsMobileRailOpen(false)}
                            title={item.hint || item.label}
                          >
                            <Icon size={15} strokeWidth={2.15} aria-hidden="true" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="scheduling-rail__footer">
            <div className="scheduling-rail__support">
              <div className="scheduling-rail__support-main">
                <span aria-hidden="true">
                  <Headphones size={18} strokeWidth={2.25} />
                </span>
                <div>
                  <small>Trung tâm hỗ trợ</small>
                  <strong>1900 1234</strong>
                </div>
              </div>
              <div className="scheduling-rail__support-line">
                <Clock3 size={14} strokeWidth={2.2} aria-hidden="true" />
                <span>08:30 - 24/04/2026</span>
              </div>
              <div className="scheduling-rail__support-status">
                <CircleCheck size={14} strokeWidth={2.45} aria-hidden="true" />
                <span>Hệ thống hoạt động tốt</span>
              </div>
            </div>

            <div className="scheduling-rail__admin" ref={railAdminMenuRef}>
              <button
                type="button"
                className="scheduling-rail__admin-trigger"
                aria-controls="scheduling-rail-admin-menu"
                aria-expanded={isRailAdminMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsRailAdminMenuOpen((current) => !current)}
              >
                <img src="/images/scheduling/admin-avatar.png" alt="" />
                <div>
                  <strong>{userName}</strong>
                  <small>{roleLabel}</small>
                </div>
                <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
              </button>

              {isRailAdminMenuOpen ? (
                <div className="scheduling-rail__admin-menu" id="scheduling-rail-admin-menu" role="menu">
                  {adminQuickLinks
                    .filter((item) => item.to !== '/admin/staff')
                    .map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link key={item.to} to={item.to} role="menuitem" onClick={closeAdminMenus}>
                          <Icon size={15} strokeWidth={2.25} aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                  <button type="button" role="menuitem" onClick={handleLogout}>
                    <LogOut size={15} strokeWidth={2.25} aria-hidden="true" />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </aside>

        {isMobileRailOpen ? (
          <button
            type="button"
            className="scheduling-rail-backdrop"
            aria-label="Đóng điều hướng"
            onClick={() => setIsMobileRailOpen(false)}
          />
        ) : null}

        <section className="scheduling-workspace">
          {toastNotification ? (
            <button
              type="button"
              className={`scheduling-toast scheduling-toast--${toastNotification.tone}`}
              onClick={() => {
                setIsNotificationsOpen(true);
                setToastNotification(null);
              }}
            >
              <span className={`scheduling-notification-dot scheduling-notification-dot--${toastNotification.tone}`} />
              <div>
                <strong>{toastNotification.title}</strong>
                <small>{toastNotification.body}</small>
              </div>
              <X size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : null}

          <header className="scheduling-topbar">
            <button
              type="button"
              className="scheduling-topbar__menu"
              aria-label={isRailCollapsed || isMobileRailOpen ? 'Mở điều hướng' : 'Thu gọn điều hướng'}
              aria-pressed={isRailCollapsed || isMobileRailOpen}
              onClick={handleMenuToggle}
            >
              {isMobileRailOpen ? (
                <X size={19} strokeWidth={2.25} aria-hidden="true" />
              ) : (
                <Menu size={19} strokeWidth={2.25} aria-hidden="true" />
              )}
            </button>

            <div className="scheduling-topbar__search-wrap" ref={searchRef}>
              <label className={`scheduling-topbar__search${isSearchOpen ? ' is-open' : ''}`}>
                <Search size={18} strokeWidth={2.2} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  placeholder="Tìm lịch hẹn, slot, queue, bác sĩ, cấu hình..."
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="scheduling-search-clear"
                    aria-label="Xóa tìm kiếm"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                  >
                    <X size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                ) : (
                  <kbd>Ctrl + K</kbd>
                )}
              </label>

              {isSearchOpen ? (
                <div className="scheduling-search-popover" role="listbox" aria-label="Kết quả tìm kiếm nhanh">
                  <div className="scheduling-search-popover__head">
                    <span>{searchQuery ? `Kết quả cho "${searchQuery}"` : 'Truy cập nhanh'}</span>
                    <small>Enter để mở kết quả đầu tiên</small>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="scheduling-search-results">
                      {searchResults.map((item) => {
                        const Icon = item.icon;

                        return (
                          <button key={`${item.group}-${item.to}`} type="button" onClick={() => handleNavigate(item.to)}>
                            <span aria-hidden="true">
                              <Icon size={16} strokeWidth={2.25} />
                            </span>
                            <div>
                              <strong>{item.label}</strong>
                              <small>{item.group} • {item.hint || item.to}</small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="scheduling-search-empty">
                      <Search size={18} strokeWidth={2.25} aria-hidden="true" />
                      <span>Không tìm thấy màn hình phù hợp.</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="scheduling-topbar__user">
              <button
                type="button"
                className={`scheduling-topbar__theme${theme === 'dark' ? ' is-active' : ''}`}
                aria-label={theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              >
                {theme === 'dark' ? (
                  <Sun size={18} strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Moon size={18} strokeWidth={2.2} aria-hidden="true" />
                )}
              </button>

              <div className="scheduling-topbar__notifications" ref={notificationsRef}>
                <button
                  type="button"
                  className="scheduling-topbar__notify"
                  aria-label="Thông báo"
                  aria-controls="scheduling-notification-menu"
                  aria-expanded={isNotificationsOpen}
                  aria-haspopup="menu"
                  onClick={handleNotificationOpen}
                >
                  <Bell size={18} strokeWidth={2.2} aria-hidden="true" />
                  {unreadCount > 0 ? <span>{unreadCount}</span> : null}
                </button>

                {isNotificationsOpen ? (
                  <div className="scheduling-notification-menu" id="scheduling-notification-menu" role="menu">
                    <header>
                      <div>
                        <strong>Thông báo</strong>
                        <span>{unreadCount} chưa đọc</span>
                      </div>
                      <button type="button" onClick={markAllNotificationsRead}>
                        <CheckCheck size={15} strokeWidth={2.35} aria-hidden="true" />
                        Đã đọc
                      </button>
                    </header>

                    <div className="scheduling-notification-list">
                      {notifications.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={!item.read ? 'is-unread' : ''}
                          role="menuitem"
                          onClick={() => handleNotificationClick(item)}
                        >
                          <span className={`scheduling-notification-dot scheduling-notification-dot--${item.tone}`} />
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.body}</small>
                            <time>{item.time}</time>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="scheduling-topbar__admin" ref={topbarAdminMenuRef}>
                <button
                  type="button"
                  className="scheduling-topbar__admin-trigger"
                  aria-controls="scheduling-admin-menu"
                  aria-expanded={isTopbarAdminMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    setIsTopbarAdminMenuOpen((current) => !current);
                    setIsNotificationsOpen(false);
                  }}
                >
                  <div>
                    <strong>{userName}</strong>
                    <small>{roleLabel}</small>
                  </div>
                  <img src="/images/scheduling/admin-avatar.png" alt="" />
                  <ChevronDown size={15} strokeWidth={2.35} aria-hidden="true" />
                </button>

                {isTopbarAdminMenuOpen ? (
                  <div className="scheduling-topbar__admin-menu" id="scheduling-admin-menu" role="menu">
                    {adminQuickLinks.map((item) => {
                      const Icon = item.icon;

                      return (
                        <Link key={item.to} to={item.to} role="menuitem" onClick={closeAdminMenus}>
                          <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                    <button type="button" role="menuitem" onClick={handleLogout}>
                      <LogOut size={16} strokeWidth={2.25} aria-hidden="true" />
                      Đăng xuất
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </header>
          <Outlet />
        </section>
      </div>
    </SchedulingDataProvider>
  );
}
