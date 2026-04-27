import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Baby,
  BarChart3,
  Bone,
  Building2,
  CalendarClock,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChartColumnIncreasing,
  ChartPie,
  ChartSpline,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  CopyPlus,
  Download,
  EllipsisVertical,
  Eye,
  Flower2,
  GaugeCircle,
  Globe2,
  HeartPulse,
  Headphones,
  Hospital,
  LoaderCircle,
  LockKeyhole,
  Radar,
  RefreshCw,
  ShieldCheck,
  Square,
  Stethoscope,
  Table2,
  TrendingUp,
  UploadCloud,
  UserRoundCheck,
  UsersRound,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { schedulingApi } from '../api/schedulingApi';
import { MetricCard, StatusBadge } from '../components/SchedulingPrimitives';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { formatDate, formatPercent } from '../utils/schedulingUi';

function getTodayKey() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getActivityTitle(action) {
  const labels = {
    'schedule.create': 'Đã tạo lịch khám',
    'schedule.update': 'Đã cập nhật lịch khám',
    'schedule.publish': 'Đã công khai lịch khám',
    'schedule.cancel': 'Đã hủy lịch khám',
    'schedule.complete': 'Đã hoàn tất lịch khám',
    'schedule.block_slot': 'Đã khóa khung giờ',
    'schedule.reopen_slot': 'Đã mở lại khung giờ',
    'schedule.batch_block_slots': 'Đã khóa nhiều khung giờ',
    'schedule.batch_reopen_slots': 'Đã mở lại nhiều khung giờ',
  };

  return labels[action] || 'Hoạt động lịch khám';
}

function formatClock(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value || '').slice(0, 5);
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function buildFallbackActivities(schedules, alerts) {
  const scheduleActivities = schedules.slice(0, 4).map((item) => ({
    id: `lich-${item.id}`,
    time: item.updatedAt ? formatClock(item.updatedAt) : item.start,
    title: item.publishStatus === 'Hidden' ? 'Lịch đang chờ công khai' : 'Đã rà soát lịch khám',
    actor: item.createdBy || 'Hệ thống lịch khám',
    body: `${item.doctor} - ${item.department} - ${formatDate(item.date)}.`,
  }));

  const alertActivities = alerts.slice(0, 2).map((item, index) => ({
    id: `canh-bao-${index}`,
    time: 'Gần đây',
    title: item.title,
    actor: 'Trung tâm điều phối',
    body: item.body,
  }));

  return [...scheduleActivities, ...alertActivities].slice(0, 6);
}

function getScheduleNeedText(item) {
  if (item.publishStatus === 'Hidden') return 'Cần công khai để bệnh nhân có thể đặt lịch.';
  if (item.status === 'cancelled') return 'Cần rà soát các lịch hẹn bị ảnh hưởng.';
  if (Number(item.utilization || 0) >= 90) return 'Sắp kín lịch, cân nhắc mở thêm ca.';
  if (Number(item.availableSlots || 0) === 0) return 'Không còn khung giờ trống.';
  if (Number(item.blockedSlots || 0) > 0) return 'Có khung giờ bị khóa cần theo dõi.';
  return 'Đang vận hành ổn định.';
}

function getDashboardMetricVisual(label) {
  const visuals = {
    'Lịch hôm nay': { icon: CalendarCheck2, tone: 'blue', label },
    'Lịch trong tuần': { icon: CalendarDays, tone: 'indigo', label },
    'Chưa công khai': { icon: LockKeyhole, tone: 'amber', label },
    'Tổng khung giờ': { icon: Clock3, tone: 'blue', label },
    'Đã đặt': { icon: CheckCircle2, tone: 'green', label },
    'Còn trống': { icon: Square, tone: 'blue', label },
    'Đã khóa': { icon: LockKeyhole, tone: 'red', label },
    'Lấp đầy trung bình': { icon: GaugeCircle, tone: 'violet', label: 'Lấp đầy TB' },
  };

  return visuals[label] || { icon: ClipboardList, tone: 'blue', label };
}

function getDepartmentIcon(name = '') {
  const normalized = name.toLowerCase();

  if (normalized.includes('tim')) return HeartPulse;
  if (normalized.includes('nhi')) return Baby;
  if (normalized.includes('xương') || normalized.includes('khớp') || normalized.includes('co xuong')) return Bone;
  if (normalized.includes('da')) return Flower2;
  if (normalized.includes('nội') || normalized.includes('noi')) return Stethoscope;
  return Hospital;
}

const DOCTOR_AI_AVATAR = '/images/scheduling/doctors/doctor-ai-fallback.png';
const DOCTOR_AVATAR_PATHS = {
  'dr-lan': DOCTOR_AI_AVATAR,
  'dr-minh': DOCTOR_AI_AVATAR,
  'dr-quang': DOCTOR_AI_AVATAR,
  'dr-khoa': DOCTOR_AI_AVATAR,
  'dr-hanh': DOCTOR_AI_AVATAR,
};

const DOCTOR_AVATAR_POOL = Object.values(DOCTOR_AVATAR_PATHS);
const DOCTOR_AVATAR_FALLBACK = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="bg" x1="10" y1="8" x2="86" y2="92" gradientUnits="userSpaceOnUse">
      <stop stop-color="#e0f2fe"/>
      <stop offset="1" stop-color="#ccfbf1"/>
    </linearGradient>
    <linearGradient id="coat" x1="24" y1="58" x2="72" y2="94" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffffff"/>
      <stop offset="1" stop-color="#e8f4ff"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="24" fill="url(#bg)"/>
  <circle cx="48" cy="42" r="23" fill="#14324a"/>
  <path d="M23 89c2-20 13-31 25-31s23 11 25 31H23Z" fill="url(#coat)"/>
  <path d="M38 58h20l-3 13-7 6-7-6-3-13Z" fill="#e6b18f"/>
  <circle cx="48" cy="43" r="17" fill="#f3c3a2"/>
  <path d="M31 39c7-16 22-20 36-6-5 5-13 7-24 6-4 0-8 0-12 0Z" fill="#14324a"/>
  <circle cx="42" cy="45" r="2" fill="#12233f"/>
  <circle cx="54" cy="45" r="2" fill="#12233f"/>
  <path d="M42 53c4 4 8 4 12 0" fill="none" stroke="#7c2d12" stroke-width="2" stroke-linecap="round"/>
  <path d="M32 72l11 15 5-10 5 10 11-15" fill="none" stroke="#93c5fd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="69" cy="30" r="8" fill="#ffffff" opacity=".72"/>
</svg>
`)}`;

function getDoctorAvatar(doctor = {}, index = 0) {
  const directAvatar = doctor.avatar || doctor.avatarUrl || doctor.photoUrl || doctor.imageUrl;

  if (directAvatar) return directAvatar;
  if (doctor.id && DOCTOR_AVATAR_PATHS[doctor.id]) return DOCTOR_AVATAR_PATHS[doctor.id];

  const key = String(doctor.id || doctor.name || index);
  const hash = [...key].reduce((total, character) => total + character.charCodeAt(0), index);
  return DOCTOR_AVATAR_POOL[Math.abs(hash) % DOCTOR_AVATAR_POOL.length];
}

function handleDoctorAvatarError(event) {
  const image = event.currentTarget;

  if (image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = DOCTOR_AVATAR_FALLBACK;
}

function getAnalysisScoreState(value) {
  const score = Number(value || 0);

  if (score >= 85) return { label: 'Cao', className: 'is-high' };
  if (score >= 60) return { label: 'Ổn định', className: 'is-good' };
  return { label: 'Cần theo dõi', className: 'is-low' };
}

function buildRadarPoint(item, index, total, center, radius) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(total, 1);
  const value = Math.max(0, Math.min(Number(item.value || 0), 100));
  const ratio = value / 100;

  return {
    ...item,
    angle,
    value,
    axisX: center + Math.cos(angle) * radius,
    axisY: center + Math.sin(angle) * radius,
    pointX: center + Math.cos(angle) * radius * ratio,
    pointY: center + Math.sin(angle) * radius * ratio,
    labelX: center + Math.cos(angle) * (radius + 28),
    labelY: center + Math.sin(angle) * (radius + 28),
  };
}

function escapeSvgText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildExportBarChart({ title, rangeLabel, items, width = 960, height = 540 }) {
  const chartX = 86;
  const chartY = 124;
  const chartWidth = width - 132;
  const chartHeight = 292;
  const barSlot = chartWidth / Math.max(items.length, 1);
  const bars = items
    .map((item, index) => {
      const value = Math.max(0, Math.min(Number(item.value || 0), 100));
      const barHeight = Math.max(18, (value / 100) * chartHeight);
      const barWidth = Math.min(74, barSlot * 0.44);
      const x = chartX + index * barSlot + (barSlot - barWidth) / 2;
      const y = chartY + chartHeight - barHeight;
      const label = escapeSvgText(item.name);

      return `
        <text x="${x + barWidth / 2}" y="${y - 16}" text-anchor="middle" fill="#12233f" font-size="18" font-weight="800">${Math.round(value)}%</text>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="16" fill="${item.color}" opacity="0.92"/>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="16" fill="url(#barGloss)"/>
        <text x="${x + barWidth / 2}" y="${chartY + chartHeight + 42}" text-anchor="middle" fill="#44566f" font-size="16" font-weight="800">${label}</text>
      `;
    })
    .join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#f8fbff"/>
          <stop offset="1" stop-color="#ecfeff"/>
        </linearGradient>
        <linearGradient id="barGloss" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#ffffff" stop-opacity="0.28"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="28" fill="url(#bg)"/>
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="24" fill="#ffffff" stroke="#dbe7f3"/>
      <text x="56" y="76" fill="#12233f" font-size="26" font-weight="900">${escapeSvgText(title)}</text>
      <text x="56" y="104" fill="#7a8ba3" font-size="16" font-weight="700">Khoảng thời gian: ${escapeSvgText(rangeLabel)}</text>
      ${[0, 25, 50, 75, 100]
        .map((tick) => {
          const y = chartY + chartHeight - (tick / 100) * chartHeight;
          return `<line x1="${chartX}" y1="${y}" x2="${chartX + chartWidth}" y2="${y}" stroke="#e6edf6"/><text x="${chartX - 16}" y="${y + 5}" text-anchor="end" fill="#8a9bb2" font-size="13" font-weight="800">${tick}%</text>`;
        })
        .join('')}
      ${bars}
      <text x="${width / 2}" y="${height - 44}" text-anchor="middle" fill="#0f766e" font-size="15" font-weight="900">Scheduling dashboard export</text>
    </svg>
  `;
}

function buildExportRadarChart({ title, rangeLabel, items, width = 960, height = 540 }) {
  const size = 340;
  const center = size / 2;
  const radius = 112;
  const points = items.slice(0, 8).map((item, index) => buildRadarPoint(item, index, Math.min(items.length, 8), center, radius));
  const polygon = points.map((item) => `${item.pointX},${item.pointY}`).join(' ');
  const ringPoints = (scale) =>
    points
      .map((item) => `${center + Math.cos(item.angle) * radius * scale},${center + Math.sin(item.angle) * radius * scale}`)
      .join(' ');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" rx="28" fill="#f8fbff"/>
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="24" fill="#ffffff" stroke="#dbe7f3"/>
      <text x="56" y="76" fill="#12233f" font-size="26" font-weight="900">${escapeSvgText(title)} - Biểu đồ nhện</text>
      <text x="56" y="104" fill="#7a8ba3" font-size="16" font-weight="700">Khoảng thời gian: ${escapeSvgText(rangeLabel)}</text>
      <g transform="translate(72 130)">
        ${[0.25, 0.5, 0.75, 1].map((scale) => `<polygon points="${ringPoints(scale)}" fill="none" stroke="#dbe7f3" stroke-width="1.5"/>`).join('')}
        ${points.map((item) => `<line x1="${center}" y1="${center}" x2="${item.axisX}" y2="${item.axisY}" stroke="#dbe7f3" stroke-dasharray="4 6"/>`).join('')}
        <polygon points="${polygon}" fill="rgba(20,184,166,.22)" stroke="#0f9f9a" stroke-width="4" stroke-linejoin="round"/>
        ${points
          .map(
            (item) => `
              <circle cx="${item.pointX}" cy="${item.pointY}" r="6" fill="${item.color}" stroke="#ffffff" stroke-width="3"/>
              <text x="${item.labelX}" y="${item.labelY}" text-anchor="${item.labelX > center + 8 ? 'start' : item.labelX < center - 8 ? 'end' : 'middle'}" dominant-baseline="middle" fill="#44566f" font-size="13" font-weight="800">${escapeSvgText(item.name)}</text>
            `,
          )
          .join('')}
      </g>
      <g transform="translate(520 152)">
        <text x="0" y="0" fill="#0f766e" font-size="17" font-weight="900">Tóm tắt hiệu suất</text>
        ${points
          .slice(0, 6)
          .map(
            (item, index) => `
              <circle cx="8" cy="${38 + index * 36}" r="6" fill="${item.color}"/>
              <text x="28" y="${43 + index * 36}" fill="#44566f" font-size="15" font-weight="800">${escapeSvgText(item.name)}</text>
              <text x="300" y="${43 + index * 36}" text-anchor="end" fill="#12233f" font-size="15" font-weight="900">${Math.round(item.value)}%</text>
            `,
          )
          .join('')}
      </g>
    </svg>
  `;
}

function downloadSvgAsPng(svgMarkup, filename, width, height) {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(downloadUrl);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

const ANALYSIS_RANGE_OPTIONS = [
  { id: '7d', label: '7 ngày', multiplier: 1 },
  { id: '1m', label: '1 tháng', multiplier: 4 },
  { id: '1q', label: '1 quý', multiplier: 12 },
  { id: '1y', label: '1 năm', multiplier: 52 },
];

const ANALYSIS_TABS = [
  {
    id: 'department',
    label: 'Công suất theo khoa',
    icon: ChartColumnIncreasing,
    title: 'Công suất theo khoa',
    listTitle: 'Khoa',
  },
  {
    id: 'slots',
    label: 'Tỷ lệ khung giờ',
    icon: ChartPie,
    title: 'Tỷ lệ khung giờ',
    listTitle: 'Trạng thái',
  },
  {
    id: 'trend',
    label: 'Xu hướng 7 ngày',
    icon: ChartSpline,
    title: 'Xu hướng lấp đầy',
    listTitle: 'Ngày',
  },
  {
    id: 'doctors',
    label: 'Top bác sĩ',
    icon: UserRoundCheck,
    title: 'Top bác sĩ',
    listTitle: 'Bác sĩ',
  },
  {
    id: 'departments',
    label: 'Top khoa',
    icon: Hospital,
    title: 'Top khoa',
    listTitle: 'Khoa',
  },
];

export function SchedulingDashboardPage() {
  const {
    actions,
    backendConnected,
    departments,
    doctors,
    error,
    loading,
    operationAlerts,
    refresh,
    scheduleStats,
    schedules,
  } = useSchedulingData();

  const [actionMessage, setActionMessage] = useState('');
  const [recentActivities, setRecentActivities] = useState([]);
  const [activeAnalysis, setActiveAnalysis] = useState('department');
  const [analysisView, setAnalysisView] = useState('chart');
  const [analysisRange, setAnalysisRange] = useState('7d');
  const [isAnalysisRangeOpen, setIsAnalysisRangeOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const todayKey = getTodayKey();

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((first, second) => {
      const firstKey = `${first.date || ''} ${first.start || ''}`;
      const secondKey = `${second.date || ''} ${second.start || ''}`;
      return firstKey.localeCompare(secondKey);
    });
  }, [schedules]);

  const todaySchedules = sortedSchedules.filter((item) => item.date === todayKey);

  const visibleTodaySchedules = todaySchedules.length
    ? todaySchedules
    : sortedSchedules.slice(0, 6);

  const unpublishedSchedules = sortedSchedules.filter(
    (item) =>
      item.publishStatus === 'Hidden' &&
      item.status !== 'cancelled' &&
      item.status !== 'completed',
  );

  const highPressureSchedules = sortedSchedules
    .filter(
      (item) =>
        Number(item.totalSlots || 0) > 0 &&
        (Number(item.utilization || 0) >= 85 || Number(item.availableSlots || 0) <= 2),
    )
    .slice(0, 4);

  const conflictWatchSchedules = sortedSchedules
    .filter(
      (item) =>
        item.doctor?.includes('Chưa xác định') ||
        item.department?.includes('Chưa xác định') ||
        String(item.start || '').localeCompare(String(item.end || '')) >= 0,
    )
    .slice(0, 3);

  const impactSchedules = sortedSchedules
    .filter((item) => item.date >= todayKey && Number(item.bookedSlots || 0) > 0)
    .slice(0, 3);

  const busyDoctors = [...doctors]
    .sort((first, second) => Number(second.load || 0) - Number(first.load || 0))
    .slice(0, 5);

  const watchedDepartments = [...departments]
    .sort((first, second) => Number(second.utilization || 0) - Number(first.utilization || 0))
    .slice(0, 5);

  const slotTotals = schedules.reduce(
    (total, item) => ({
      booked: total.booked + Number(item.bookedSlots || 0),
      available: total.available + Number(item.availableSlots || 0),
      blocked: total.blocked + Number(item.blockedSlots || 0),
    }),
    { booked: 0, available: 0, blocked: 0 },
  );

  const totalSlotCount = Math.max(
    slotTotals.booked + slotTotals.available + slotTotals.blocked,
    1,
  );

  const departmentColors = ['#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'];
  const activeRange = ANALYSIS_RANGE_OPTIONS.find((item) => item.id === analysisRange) || ANALYSIS_RANGE_OPTIONS[0];
  const activeAnalysisTab = ANALYSIS_TABS.find((item) => item.id === activeAnalysis) || ANALYSIS_TABS[0];
  const activeAnalysisIndex = ANALYSIS_TABS.findIndex((item) => item.id === activeAnalysis);
  const activeAnalysisTabIndex = activeAnalysisIndex >= 0 ? activeAnalysisIndex : 0;

  const analysisDepartments = watchedDepartments.map((item, index) => {
    const adjusted = Math.min(
      100,
      Math.max(8, Number(item.utilization || 0) + (activeRange.multiplier > 1 ? index * 1.5 : 0)),
    );

    return {
      id: item.id,
      name: item.name,
      caption: `${Math.round(Number(item.bookings || 0) * activeRange.multiplier)} lượt đặt`,
      value: adjusted,
      color: departmentColors[index % departmentColors.length],
      icon: getDepartmentIcon(item.name),
    };
  });

  const analysisSlotItems = [
    { id: 'booked', name: 'Đã đặt', caption: `${slotTotals.booked} slot`, value: (slotTotals.booked / totalSlotCount) * 100, color: '#0ea5e9', icon: CheckCircle2 },
    { id: 'available', name: 'Còn trống', caption: `${slotTotals.available} slot`, value: (slotTotals.available / totalSlotCount) * 100, color: '#10b981', icon: Square },
    { id: 'blocked', name: 'Đã khóa', caption: `${slotTotals.blocked} slot`, value: (slotTotals.blocked / totalSlotCount) * 100, color: '#ef4444', icon: LockKeyhole },
  ];

  const analysisTrendItems = [
    { id: 't2', name: 'T2', badge: 'MON', caption: activeRange.label, value: 62, color: '#14b8a6', icon: TrendingUp },
    { id: 't3', name: 'T3', badge: 'TUE', caption: activeRange.label, value: 68, color: '#0ea5e9', icon: TrendingUp },
    { id: 't4', name: 'T4', badge: 'WED', caption: activeRange.label, value: 74, color: '#8b5cf6', icon: TrendingUp },
    { id: 't5', name: 'T5', badge: 'THU', caption: activeRange.label, value: 81, color: '#10b981', icon: TrendingUp },
    { id: 't6', name: 'T6', badge: 'FRI', caption: activeRange.label, value: 77, color: '#f59e0b', icon: TrendingUp },
    { id: 't7', name: 'T7', badge: 'SAT', caption: activeRange.label, value: 72, color: '#ef4444', icon: TrendingUp },
    { id: 'cn', name: 'CN', badge: 'SUN', caption: activeRange.label, value: 65, color: '#ec4899', icon: TrendingUp },
  ];

  const analysisDoctorItems = busyDoctors.map((item, index) => ({
    id: item.id,
    name: item.name,
    caption: item.department,
    value: Number(item.load || 0),
    color: departmentColors[index % departmentColors.length],
    avatar: getDoctorAvatar(item, index),
    icon: UserRoundCheck,
  }));

  const analysisTopDepartmentItems = watchedDepartments.map((item, index) => ({
    id: item.id,
    name: item.name,
    caption: `${Math.round(Number(item.bookings || 0) * activeRange.multiplier)} lượt đặt`,
    value: Number(item.utilization || 0),
    color: departmentColors[index % departmentColors.length],
    icon: getDepartmentIcon(item.name),
  }));

  const analysisDatasets = {
    department: analysisDepartments,
    slots: analysisSlotItems,
    trend: analysisTrendItems,
    doctors: analysisDoctorItems,
    departments: analysisTopDepartmentItems,
  };

  const activeAnalysisItems = analysisDatasets[activeAnalysis] || analysisDepartments;
  const activeAnalysisAverage =
    activeAnalysisItems.reduce((total, item) => total + Number(item.value || 0), 0) /
    Math.max(activeAnalysisItems.length, 1);
  const ActiveAnalysisIcon = activeAnalysisTab.icon;
  const radarSize = 280;
  const radarCenter = radarSize / 2;
  const radarRadius = 88;
  const radarItems = activeAnalysisItems.slice(0, 8);
  const radarPoints = radarItems.map((item, index) =>
    buildRadarPoint(item, index, radarItems.length, radarCenter, radarRadius),
  );
  const radarPolygon = radarPoints.map((item) => `${item.pointX},${item.pointY}`).join(' ');
  const getRadarRingPoints = (scale) =>
    radarPoints
      .map(
        (item) =>
          `${radarCenter + Math.cos(item.angle) * radarRadius * scale},${radarCenter + Math.sin(item.angle) * radarRadius * scale}`,
      )
      .join(' ');

  const bookedAngle = (slotTotals.booked / totalSlotCount) * 360;
  const availableAngle = (slotTotals.available / totalSlotCount) * 360;

  const donutStyle = {
    background: `conic-gradient(
      #0ea5e9 0deg ${bookedAngle}deg,
      #10b981 ${bookedAngle}deg ${bookedAngle + availableAngle}deg,
      #ef4444 ${bookedAngle + availableAngle}deg 360deg
    )`,
  };

  const lastUpdatedText = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date());

  const dashboardStats = scheduleStats.slice(0, 8).map((item) => {
    const visual = getDashboardMetricVisual(item.label);
    const Icon = visual.icon;

    return {
      ...item,
      label: visual.label,
      tone: visual.tone,
      icon: <Icon size={18} strokeWidth={2.25} />,
    };
  });

  const operationFlowSteps = [
    {
      label: 'Tạo lịch',
      body: 'Bác sĩ tạo lịch và khung giờ.',
      icon: CalendarPlus,
      tone: 'teal',
    },
    {
      label: 'Công khai',
      body: 'Lịch hiển thị cho bệnh nhân.',
      icon: Globe2,
      tone: 'blue',
    },
    {
      label: 'Bệnh nhân đặt',
      body: 'Bệnh nhân đặt lịch trực tuyến.',
      icon: UsersRound,
      tone: 'violet',
    },
    {
      label: 'Lễ tân hỗ trợ',
      body: 'Xác nhận, hỗ trợ và nhắc lịch.',
      icon: Headphones,
      tone: 'orange',
    },
  ];

  const systemRows = [
    { label: 'Đang hoạt động', value: totalSlotCount, tone: 'green' },
    { label: 'Còn trống', value: slotTotals.available, tone: 'blue' },
    { label: 'Đã khóa', value: slotTotals.blocked, tone: 'red' },
  ];

  function handleExportCurrentChart() {
    const svg =
      analysisView === 'radar'
        ? buildExportRadarChart({
            title: activeAnalysisTab.title,
            rangeLabel: activeRange.label,
            items: activeAnalysisItems,
          })
        : buildExportBarChart({
            title: activeAnalysisTab.title,
            rangeLabel: activeRange.label,
            items: activeAnalysisItems,
          });

    downloadSvgAsPng(svg, `bieu-do-${activeAnalysis}-${analysisView}.png`, 960, 540);
    setIsExportMenuOpen(false);
  }

  function handleExportAllCharts() {
    const width = 1400;
    const cardWidth = 640;
    const cardHeight = 250;
    const cards = ANALYSIS_TABS.map((tab, index) => {
      const items = analysisDatasets[tab.id] || [];
      const x = 48 + (index % 2) * (cardWidth + 32);
      const y = 92 + Math.floor(index / 2) * (cardHeight + 32);
      const chartX = x + 52;
      const chartY = y + 76;
      const chartW = cardWidth - 92;
      const chartH = 112;
      const slot = chartW / Math.max(items.length, 1);

      return `
        <g>
          <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="22" fill="#ffffff" stroke="#dbe7f3"/>
          <text x="${x + 28}" y="${y + 42}" fill="#12233f" font-size="20" font-weight="900">${escapeSvgText(tab.title)}</text>
          ${items
            .map((item, itemIndex) => {
              const value = Math.max(0, Math.min(Number(item.value || 0), 100));
              const barW = Math.min(46, slot * 0.44);
              const barH = Math.max(12, (value / 100) * chartH);
              const barX = chartX + itemIndex * slot + (slot - barW) / 2;
              const barY = chartY + chartH - barH;
              return `
                <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="10" fill="${item.color}" opacity=".9"/>
                <text x="${barX + barW / 2}" y="${barY - 8}" text-anchor="middle" fill="#12233f" font-size="12" font-weight="900">${Math.round(value)}%</text>
                <text x="${barX + barW / 2}" y="${chartY + chartH + 28}" text-anchor="middle" fill="#60728a" font-size="11" font-weight="800">${escapeSvgText(item.badge || item.name)}</text>
              `;
            })
            .join('')}
        </g>
      `;
    }).join('');
    const height = 940;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#f8fbff"/>
        <text x="48" y="52" fill="#12233f" font-size="30" font-weight="900">Tất cả biểu đồ phân tích vận hành</text>
        <text x="48" y="78" fill="#7a8ba3" font-size="16" font-weight="700">Khoảng thời gian: ${escapeSvgText(activeRange.label)}</text>
        ${cards}
      </svg>
    `;

    downloadSvgAsPng(svg, 'tat-ca-bieu-do-phan-tich-van-hanh.png', width, height);
    setIsExportMenuOpen(false);
  }

  useEffect(() => {
    let isActive = true;

    async function loadActivities() {
      const fallback = buildFallbackActivities(sortedSchedules, operationAlerts);

      if (!backendConnected || !sortedSchedules.length) {
        setRecentActivities(fallback);
        return;
      }

      const results = await Promise.allSettled(
        sortedSchedules
          .slice(0, 5)
          .map((item) => schedulingApi.getScheduleActivity(item.id, { limit: 4 })),
      );

      if (!isActive) return;

      const mapped = results
        .flatMap((result) => (result.status === 'fulfilled' ? result.value?.items || [] : []))
        .sort(
          (first, second) =>
            new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
        )
        .slice(0, 6)
        .map((item, index) => ({
          id: item.audit_log_id || `${item.action}-${index}`,
          time: formatClock(item.created_at),
          title: getActivityTitle(item.action),
          actor: item.actor_name || item.actor_type || 'Hệ thống',
          body: item.message || 'Không có mô tả bổ sung.',
        }));

      setRecentActivities(mapped.length ? mapped : fallback);
    }

    loadActivities();

    return () => {
      isActive = false;
    };
  }, [backendConnected, operationAlerts, sortedSchedules]);

  async function runAction(successMessage, callback) {
    setActionMessage('Đang xử lý yêu cầu...');

    try {
      await callback();
      setActionMessage(successMessage);
    } catch (actionError) {
      setActionMessage(actionError.message || 'Không thể xử lý thao tác.');
    }
  }

  const SyncIcon = loading ? LoaderCircle : error ? AlertTriangle : ShieldCheck;

  return (
    <main className="scheduling-dashboard-page">
      <section className="scheduling-dashboard-hero">
        <div className="scheduling-dashboard-hero__content">
          <span>Trung tâm điều phối</span>
          <h1>
            Trung tâm vận hành <b>lịch khám</b>
          </h1>
          <p>
            Theo dõi lịch bác sĩ, khung giờ khám, trạng thái công khai và công suất đặt lịch trong toàn hệ thống.
          </p>

          <div className="scheduling-dashboard-hero__actions">
            <Link to="/scheduling/create" className="is-primary">
              <CalendarPlus size={17} strokeWidth={2.3} aria-hidden="true" />
              Tạo lịch
            </Link>
            <Link to="/scheduling/bulk-create">
              <CopyPlus size={16} strokeWidth={2.2} aria-hidden="true" />
              Tạo hàng loạt
            </Link>
            <Link to="/scheduling/calendar">
              <CalendarDays size={16} strokeWidth={2.2} aria-hidden="true" />
              Mở lịch trực quan
            </Link>
          </div>
        </div>

        <div className="scheduling-dashboard-hero__visual" aria-hidden="true">
          <img src="/images/scheduling/hero-calendar.png" alt="" />
        </div>

        <div className="scheduling-dashboard-hero__console" aria-label="Tổng quan vận hành nhanh">
          <div>
            <i aria-hidden="true">
              <CalendarCheck2 size={22} strokeWidth={2.1} />
            </i>
            <span>Lịch hôm nay</span>
            <strong>{todaySchedules.length}</strong>
            <small>
              +8 so với hôm qua
              <TrendingUp size={14} strokeWidth={2.4} aria-hidden="true" />
            </small>
          </div>
          <div>
            <i aria-hidden="true">
              <LockKeyhole size={21} strokeWidth={2.1} />
            </i>
            <span>Chưa công khai</span>
            <strong>{unpublishedSchedules.length}</strong>
            <small>
              cần duyệt
              <Eye size={14} strokeWidth={2.4} aria-hidden="true" />
            </small>
          </div>
          <div>
            <i aria-hidden="true">
              <BarChart3 size={22} strokeWidth={2.1} />
            </i>
            <span>Lấp đầy cao</span>
            <strong>{highPressureSchedules.length}</strong>
            <small>
              &gt; 85% công suất
              <TrendingUp size={14} strokeWidth={2.4} aria-hidden="true" />
            </small>
          </div>
        </div>
      </section>

      <section className={`scheduling-sync-banner ${error ? 'is-warning' : ''} ${loading ? 'is-loading' : ''}`}>
        <div className="scheduling-sync-banner__content">
          <span className="scheduling-sync-banner__icon" aria-hidden="true">
            <SyncIcon size={21} strokeWidth={2.25} />
          </span>
          <div>
            <strong>
              {loading
                ? 'Đang đồng bộ dữ liệu lịch khám'
                : error
                  ? 'Đang dùng dữ liệu mẫu'
                  : 'Hệ thống lịch đang hoạt động ổn định'}
            </strong>
            <span>{error || `Dữ liệu được cập nhật lần cuối lúc ${lastUpdatedText}.`}</span>
          </div>
        </div>
        <button type="button" onClick={refresh}>
          <RefreshCw size={15} strokeWidth={2.35} aria-hidden="true" />
          Làm mới dữ liệu
        </button>
      </section>

      {actionMessage ? (
        <section className="scheduling-dashboard-toast">
          <strong>Thông báo thao tác</strong>
          <span>{actionMessage}</span>
        </section>
      ) : null}

      <section className="scheduling-command-strip scheduling-command-strip--dashboard">
        <article className="scheduling-command-card scheduling-command-card--flow">
          <div className="scheduling-command-card__head">
            <span>Luồng vận hành</span>
            <p>Quy trình vận hành lịch khám</p>
          </div>

          <div className="scheduling-operation-flow">
            {operationFlowSteps.map((step, index) => {
              const StepIcon = step.icon;

              return (
                <div key={step.label} className={`scheduling-operation-step is-${step.tone}`}>
                  <div className="scheduling-operation-step__icon">
                    <StepIcon size={25} strokeWidth={2.2} aria-hidden="true" />
                  </div>
                  {index < operationFlowSteps.length - 1 ? <i aria-hidden="true" /> : null}
                  <strong>{step.label}</strong>
                  <small>{step.body}</small>
                </div>
              );
            })}
          </div>

          <div className="scheduling-operation-status">
            <Activity size={15} strokeWidth={2.35} aria-hidden="true" />
            Hệ thống vận hành ổn định
          </div>
        </article>

        <article className="scheduling-command-card scheduling-command-card--warning">
          <div className="scheduling-command-card__head">
            <span>Ưu tiên hôm nay</span>
          </div>
          <strong>{unpublishedSchedules.length}</strong>
          <small>
            <RefreshCw size={13} strokeWidth={2.35} aria-hidden="true" />
            Cần xử lý
          </small>
          <p>lịch chưa công khai cần duyệt trước khi hiển thị cho bệnh nhân.</p>
          <div className="scheduling-command-list">
            <Link to="/scheduling/schedules">
              <CalendarClock size={16} strokeWidth={2.25} aria-hidden="true" />
              Chưa công khai
              <b>{unpublishedSchedules.length}</b>
              <ChevronRight size={15} strokeWidth={2.3} aria-hidden="true" />
            </Link>
            <Link to="/scheduling/schedules">
              <Clock3 size={16} strokeWidth={2.25} aria-hidden="true" />
              Sắp hết lịch
              <b>{highPressureSchedules.length}</b>
              <ChevronRight size={15} strokeWidth={2.3} aria-hidden="true" />
            </Link>
          </div>
        </article>

        <article className="scheduling-command-card scheduling-command-card--system">
          <div className="scheduling-command-card__head">
            <span>Tình trạng hệ thống</span>
          </div>
          <div className="scheduling-system-visual" aria-hidden="true">
            <ShieldCheck size={34} strokeWidth={2.3} />
          </div>
          <strong>{totalSlotCount}</strong>
          <p>Khung giờ đang hoạt động</p>
          <div className="scheduling-system-rows">
            {systemRows.map((item) => (
              <div key={item.label} className={`is-${item.tone}`}>
                <i />
                <span>{item.label}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
          <div className="scheduling-system-pill">
            <Activity size={15} strokeWidth={2.35} aria-hidden="true" />
            Hệ thống đang hoạt động tốt
          </div>
        </article>
      </section>

      <section className="scheduling-metrics-grid scheduling-metrics-grid--dashboard">
        {dashboardStats.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      <section className="scheduling-dashboard-main-grid">
        <section className="scheduling-action-board">
          <article className="scheduling-panel scheduling-panel--wide">
            <div className="scheduling-panel__head scheduling-panel__head--priority">
              <div>
                <h2>Việc cần xử lý ngay</h2>
              </div>
              <Link to="/scheduling/schedules">Xem tất cả</Link>
            </div>

            <div className="scheduling-priority-grid">
              <div className="scheduling-priority-card scheduling-priority-card--amber">
                <div className="scheduling-priority-card__summary">
                  <div>
                    <span>Lịch chưa công khai</span>
                    <strong>{unpublishedSchedules.length}</strong>
                    <p>Cần công khai để bệnh nhân và lễ tân nhìn thấy khung giờ.</p>
                  </div>
                </div>

                {unpublishedSchedules.slice(0, 3).map((item) => (
                  <div key={item.id} className="scheduling-priority-item">
                    <span>{item.doctor}</span>
                    <small>
                      {item.department} - {formatDate(item.date)}
                    </small>
                    <button
                      type="button"
                      onClick={() =>
                        runAction('Đã công khai lịch khám.', () => actions.publishSchedule(item.id))
                      }
                    >
                      Công khai
                    </button>
                  </div>
                ))}
              </div>

              <div className="scheduling-priority-card scheduling-priority-card--red">
                <div className="scheduling-priority-card__summary">
                  <div>
                    <span>Lịch sắp hết khung giờ</span>
                    <strong>{highPressureSchedules.length}</strong>
                    <p>Theo dõi bác sĩ/khoa có tỷ lệ đặt cao để mở thêm ca.</p>
                  </div>
                </div>

                {highPressureSchedules.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    to={`/scheduling/schedules/${item.id}`}
                    className="scheduling-priority-item"
                  >
                    <span>{item.doctor}</span>
                    <small>
                      {item.department} - {formatDate(item.date)}
                    </small>
                    <b>{formatPercent(item.utilization)}</b>
                  </Link>
                ))}
              </div>

              <div className="scheduling-priority-card scheduling-priority-card--blue">
                <div className="scheduling-priority-card__summary">
                  <div>
                    <span>Lịch cần rà soát</span>
                    <strong>{conflictWatchSchedules.length + impactSchedules.length}</strong>
                    <p>Kiểm tra xung đột, khả năng cập nhật hoặc hủy nếu có bệnh nhân đặt.</p>
                  </div>
                </div>

                {[...conflictWatchSchedules, ...impactSchedules].slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    to={`/scheduling/schedules/${item.id}`}
                    className="scheduling-priority-item"
                  >
                    <span>{item.doctor}</span>
                    <small>
                      {item.department} - {formatDate(item.date)}
                    </small>
                    <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section className="scheduling-panel scheduling-today-board">
          <div className="scheduling-panel__head">
            <div>
              <span>Lịch khám hôm nay</span>
              <h2>Bảng điều phối theo ca khám</h2>
            </div>
            <Link to="/scheduling/schedules">Xem toàn bộ</Link>
          </div>

          <div className="scheduling-table scheduling-table--today">
            <div className="scheduling-table__head">
              <span>Giờ</span>
              <span>Bác sĩ</span>
              <span>Khoa</span>
              <span>Tổng</span>
              <span>Đã đặt</span>
              <span>Còn trống</span>
              <span>Đã khóa</span>
              <span>Trạng thái</span>
              <span>Hành động</span>
            </div>

            {visibleTodaySchedules.map((item) => (
              <div key={item.id} className="scheduling-table__row">
                <strong>
                  {item.start} - {item.end}
                </strong>
                <span>{item.doctor}</span>
                <span>{item.department}</span>
                <span>{item.totalSlots}</span>
                <span>{item.bookedSlots}</span>
                <span>{item.availableSlots}</span>
                <span>{item.blockedSlots}</span>
                <StatusBadge value={item.status}>{item.status}</StatusBadge>

                <div className="scheduling-actions">
                  <Link to={`/scheduling/schedules/${item.id}`} aria-label={`Xem ${item.doctor}`} title="Xem">
                    <Eye size={14} strokeWidth={2.25} />
                  </Link>
                  <Link to="/scheduling/slots" aria-label="Khung giờ" title="Khung giờ">
                    <CalendarClock size={14} strokeWidth={2.25} />
                  </Link>

                  {item.publishStatus === 'Hidden' ? (
                    <button
                      type="button"
                      aria-label="Công khai"
                      title="Công khai"
                      onClick={() =>
                        runAction('Đã công khai lịch khám.', () => actions.publishSchedule(item.id))
                      }
                    >
                      <UploadCloud size={14} strokeWidth={2.25} />
                    </button>
                  ) : null}

                  {item.status !== 'cancelled' ? (
                    <button
                      type="button"
                      className="is-danger"
                      aria-label="Hủy"
                      title="Hủy"
                      onClick={() =>
                        runAction('Đã hủy lịch khám.', () => actions.cancelSchedule(item.id))
                      }
                    >
                      <X size={14} strokeWidth={2.35} />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="scheduling-operations-analysis">
        <div className="scheduling-operations-analysis__head">
          <div>
            <h2>Phân tích vận hành</h2>
            <p>Theo dõi toàn diện hiệu suất lịch khám</p>
          </div>

          <div className="scheduling-operations-analysis__tools">
            <div className="scheduling-analysis-range">
              <button
                type="button"
                className="scheduling-analysis-range__button"
                aria-expanded={isAnalysisRangeOpen}
                onClick={() => setIsAnalysisRangeOpen((current) => !current)}
              >
                <CalendarRange size={15} strokeWidth={2.25} aria-hidden="true" />
                {activeRange.label}
                <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
              </button>

              {isAnalysisRangeOpen ? (
                <div className="scheduling-analysis-range__menu">
                  {ANALYSIS_RANGE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === analysisRange ? 'is-active' : ''}
                      onClick={() => {
                        setAnalysisRange(item.id);
                        setIsAnalysisRangeOpen(false);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button type="button" aria-label="Tùy chọn">
              <EllipsisVertical size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </div>

        <nav className="scheduling-analysis-tabs" aria-label="Bộ lọc phân tích vận hành">
          {ANALYSIS_TABS.map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                className={tab.id === activeAnalysis ? 'is-active' : ''}
                onClick={() => setActiveAnalysis(tab.id)}
              >
                <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <article className="scheduling-analysis-main-card">
          <button
            type="button"
            className="scheduling-analysis-arrow scheduling-analysis-arrow--left"
            aria-label="Trước"
            onClick={() =>
              setActiveAnalysis(
                ANALYSIS_TABS[(activeAnalysisTabIndex - 1 + ANALYSIS_TABS.length) % ANALYSIS_TABS.length].id,
              )
            }
          >
            <ChevronLeft size={18} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="scheduling-analysis-arrow scheduling-analysis-arrow--right"
            aria-label="Sau"
            onClick={() =>
              setActiveAnalysis(ANALYSIS_TABS[(activeAnalysisTabIndex + 1) % ANALYSIS_TABS.length].id)
            }
          >
            <ChevronRight size={18} strokeWidth={2.25} aria-hidden="true" />
          </button>

          <div className="scheduling-analysis-card-head">
            <div>
              <h3>
                {activeAnalysisTab.title}
                <ActiveAnalysisIcon size={15} strokeWidth={2.25} aria-hidden="true" />
              </h3>
            </div>

            <div className="scheduling-analysis-view-toggle" aria-label="Chế độ xem">
              <button
                type="button"
                className={analysisView === 'chart' ? 'is-active' : ''}
                onClick={() => setAnalysisView('chart')}
              >
                <BarChart3 size={14} strokeWidth={2.2} aria-hidden="true" />
                Biểu đồ
              </button>
              <button
                type="button"
                className={analysisView === 'radar' ? 'is-active' : ''}
                onClick={() => setAnalysisView('radar')}
              >
                <Radar size={14} strokeWidth={2.2} aria-hidden="true" />
                Nhện
              </button>
              <button
                type="button"
                className={analysisView === 'table' ? 'is-active' : ''}
                onClick={() => setAnalysisView('table')}
              >
                <Table2 size={14} strokeWidth={2.2} aria-hidden="true" />
                Bảng
              </button>
            </div>

            <div className="scheduling-analysis-export-menu">
              <button
                type="button"
                className="scheduling-analysis-export"
                aria-expanded={isExportMenuOpen}
                onClick={() => setIsExportMenuOpen((current) => !current)}
              >
                <Download size={14} strokeWidth={2.2} aria-hidden="true" />
                Xuất
                <ChevronDown size={13} strokeWidth={2.35} aria-hidden="true" />
              </button>

              {isExportMenuOpen ? (
                <div className="scheduling-analysis-export-menu__list">
                  <button type="button" onClick={handleExportCurrentChart}>
                    <BarChart3 size={15} strokeWidth={2.25} aria-hidden="true" />
                    Xuất hình đang xem
                  </button>
                  <button type="button" onClick={handleExportAllCharts}>
                    <CopyPlus size={15} strokeWidth={2.25} aria-hidden="true" />
                    Xuất tất cả vào 1 file
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="scheduling-analysis-main-grid">
            <div className="scheduling-analysis-department-list">
              {activeAnalysisItems.map((item) => {
                const ItemIcon = item.icon || Activity;

                return (
                <div key={item.id} className="scheduling-analysis-department">
                  {item.avatar ? (
                    <img className="scheduling-analysis-avatar" src={item.avatar} alt="" loading="lazy" onError={handleDoctorAvatarError} />
                  ) : item.badge ? (
                    <i
                      className="scheduling-analysis-day-badge"
                      style={{ color: item.color, backgroundColor: `${item.color}16` }}
                      aria-hidden="true"
                    >
                      {item.badge}
                    </i>
                  ) : (
                    <i style={{ color: item.color, backgroundColor: `${item.color}18` }} aria-hidden="true">
                      <ItemIcon size={16} strokeWidth={2.25} />
                    </i>
                  )}
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.caption}</span>
                  </div>
                  <b>{formatPercent(item.value)}</b>
                  <em>
                    <span style={{ width: `${Math.min(Number(item.value || 0), 100)}%`, backgroundColor: item.color }} />
                  </em>
                </div>
                );
              })}
            </div>

            {analysisView === 'chart' ? (
              <div
                className={`scheduling-analysis-chart ${activeAnalysis === 'trend' ? 'scheduling-analysis-chart--trend' : ''}`}
                aria-label={`Biểu đồ ${activeAnalysisTab.title}`}
              >
                <div className="scheduling-analysis-chart__axis">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>

                <div className="scheduling-analysis-chart__bars">
                  {activeAnalysisItems.map((item) => {
                    const chartValue = Math.max(8, Math.min(Number(item.value || 0), 100));

                    return (
                      <div key={item.id}>
                        <strong>{Math.round(Number(item.value || 0))}%</strong>
                        <span
                          style={{
                            height: `${chartValue}%`,
                            background: `linear-gradient(180deg, ${item.color}, ${item.color}88)`,
                          }}
                        />
                        <small>{item.name}</small>
                      </div>
                    );
                  })}
                </div>

                <div className="scheduling-analysis-chart__legend">
                  <i />
                  {activeAnalysisTab.title}: {formatPercent(activeAnalysisAverage)} trong {activeRange.label}
                </div>
              </div>
            ) : analysisView === 'radar' ? (
              <div className="scheduling-analysis-radar" aria-label={`Biểu đồ nhện ${activeAnalysisTab.title}`}>
                <div className="scheduling-analysis-radar__canvas">
                  {radarPoints.length > 2 ? (
                    <svg viewBox={`0 0 ${radarSize} ${radarSize}`} role="img" aria-label={`Radar ${activeAnalysisTab.title}`}>
                      {[0.25, 0.5, 0.75, 1].map((scale) => (
                        <polygon
                          key={scale}
                          points={getRadarRingPoints(scale)}
                          className="scheduling-analysis-radar__ring"
                        />
                      ))}

                      {radarPoints.map((item) => (
                        <line
                          key={`axis-${item.id}`}
                          x1={radarCenter}
                          y1={radarCenter}
                          x2={item.axisX}
                          y2={item.axisY}
                          className="scheduling-analysis-radar__axis"
                        />
                      ))}

                      <polygon points={radarPolygon} className="scheduling-analysis-radar__shape" />

                      {radarPoints.map((item) => (
                        <g key={`point-${item.id}`}>
                          <circle
                            cx={item.pointX}
                            cy={item.pointY}
                            r="5"
                            fill={item.color}
                            className="scheduling-analysis-radar__point"
                          />
                          <text
                            x={item.labelX}
                            y={item.labelY}
                            textAnchor={item.labelX > radarCenter + 8 ? 'start' : item.labelX < radarCenter - 8 ? 'end' : 'middle'}
                            dominantBaseline="middle"
                          >
                            {item.name}
                          </text>
                        </g>
                      ))}
                    </svg>
                  ) : (
                    <div className="scheduling-analysis-radar__empty">Chưa đủ dữ liệu để hiển thị biểu đồ nhện.</div>
                  )}
                </div>

                <div className="scheduling-analysis-radar__summary">
                  <span>
                    <Radar size={15} strokeWidth={2.25} aria-hidden="true" />
                    Radar hiệu suất
                  </span>
                  <strong>{formatPercent(activeAnalysisAverage)}</strong>
                  <p>{activeAnalysisTab.title} trong {activeRange.label}</p>
                  <div>
                    {radarPoints.slice(0, 5).map((item) => (
                      <em key={item.id}>
                        <i style={{ backgroundColor: item.color }} />
                        {item.name}
                        <b>{formatPercent(item.value)}</b>
                      </em>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="scheduling-analysis-insight-table" role="table" aria-label={`Bảng ${activeAnalysisTab.title}`}>
                <div className="scheduling-analysis-insight-table__head" role="row">
                  <span>Đối tượng</span>
                  <span>Chỉ số</span>
                  <span>Tỷ lệ</span>
                  <span>Đánh giá</span>
                </div>

                {activeAnalysisItems.map((item) => {
                  const ItemIcon = item.icon || Activity;
                  const scoreState = getAnalysisScoreState(item.value);
                  const cappedValue = Math.max(0, Math.min(Number(item.value || 0), 100));

                  return (
                    <div key={item.id} className="scheduling-analysis-insight-row" role="row">
                      <div>
                        {item.avatar ? (
                          <img className="scheduling-analysis-avatar" src={item.avatar} alt="" loading="lazy" onError={handleDoctorAvatarError} />
                        ) : item.badge ? (
                          <i
                            className="scheduling-analysis-day-badge"
                            style={{ color: item.color, backgroundColor: `${item.color}16` }}
                            aria-hidden="true"
                          >
                            {item.badge}
                          </i>
                        ) : (
                          <i style={{ color: item.color, backgroundColor: `${item.color}18` }} aria-hidden="true">
                            <ItemIcon size={17} strokeWidth={2.25} />
                          </i>
                        )}
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.caption}</span>
                        </div>
                      </div>
                      <b>{formatPercent(item.value)}</b>
                      <em>
                        <span style={{ width: `${cappedValue}%`, backgroundColor: item.color }} />
                      </em>
                      <small className={scoreState.className}>{scoreState.label}</small>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="scheduling-analysis-dots" aria-label="Chọn nhóm phân tích">
            {ANALYSIS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={tab.id === activeAnalysis ? 'is-active' : ''}
                aria-label={tab.label}
                onClick={() => setActiveAnalysis(tab.id)}
              />
            ))}
          </div>
        </article>

        <div className="scheduling-analysis-bottom-grid">
          <article className="scheduling-analysis-mini-card scheduling-analysis-doctor-card">
            <div className="scheduling-analysis-mini-card__head">
              <h3>Top bác sĩ cần theo dõi</h3>
              <Link to="/scheduling/doctors">Xem tất cả</Link>
            </div>

            <div className="scheduling-analysis-doctor-list">
              {busyDoctors.map((item, index) => {
                const avatar = getDoctorAvatar(item, index);

                return (
                  <div key={item.id}>
                    <img
                      className="scheduling-analysis-avatar scheduling-analysis-avatar--small"
                      src={avatar}
                      alt=""
                      loading="lazy"
                      onError={handleDoctorAvatarError}
                    />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.department}</span>
                    </div>
                    <b>{formatPercent(item.load)}</b>
                    <em>
                      <span style={{ width: `${Math.min(Number(item.load || 0), 100)}%`, backgroundColor: departmentColors[index % departmentColors.length] }} />
                    </em>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="scheduling-analysis-mini-card scheduling-analysis-slot-card">
            <div className="scheduling-analysis-mini-card__head">
              <h3>Tỷ lệ khung giờ</h3>
            </div>

            <div className="scheduling-analysis-donut-layout">
              <div className="scheduling-donut" style={donutStyle}>
                <strong>{formatPercent((slotTotals.booked / totalSlotCount) * 100)}</strong>
                <span>Đã đặt</span>
              </div>

              <div className="scheduling-donut-legend">
                <span>
                  <i className="is-booked" />
                  Đã đặt <b>{slotTotals.booked} ({formatPercent((slotTotals.booked / totalSlotCount) * 100)})</b>
                </span>
                <span>
                  <i className="is-available" />
                  Còn trống <b>{slotTotals.available} ({formatPercent((slotTotals.available / totalSlotCount) * 100)})</b>
                </span>
                <span>
                  <i className="is-blocked" />
                  Đã khóa <b>{slotTotals.blocked} ({formatPercent((slotTotals.blocked / totalSlotCount) * 100)})</b>
                </span>
              </div>
            </div>
          </article>

          <article className="scheduling-analysis-mini-card scheduling-analysis-activity-card">
            <div className="scheduling-analysis-mini-card__head">
              <h3>Hoạt động gần đây</h3>
              <Link to="/scheduling/schedules">Xem tất cả</Link>
            </div>

            <div className="scheduling-analysis-activity-list">
              {recentActivities.slice(0, 5).map((item) => (
                <div key={item.id}>
                  <time>{item.time}</time>
                  <i aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
