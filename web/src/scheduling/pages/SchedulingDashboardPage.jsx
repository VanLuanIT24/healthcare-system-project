import { useEffect, useMemo, useRef, useState } from 'react';
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
    return '';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatShortDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function formatActivityMoment(value) {
  const dateLabel = formatShortDate(value);
  const clockLabel = formatClock(value);

  if (!dateLabel && !clockLabel) return '';
  if (!dateLabel) return clockLabel;
  if (!clockLabel) return dateLabel;
  return `${dateLabel} ${clockLabel}`;
}

function getActivityTimestamp(value) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getScheduleActivityTimestamp(schedule) {
  return Math.max(getActivityTimestamp(schedule.updatedAt), getActivityTimestamp(schedule.createdAt));
}

function getScheduleShiftTimestamp(schedule) {
  if (!schedule.date) return 0;
  const startTime = String(schedule.start || '').slice(0, 5);
  const value = startTime ? `${schedule.date}T${startTime}:00` : `${schedule.date}T00:00:00`;
  return getActivityTimestamp(value);
}

function getScheduleActivityMoment(schedule) {
  const auditTimestamp = getScheduleActivityTimestamp(schedule);

  if (auditTimestamp) {
    return {
      timestamp: auditTimestamp,
      label: formatActivityMoment(auditTimestamp),
    };
  }

  const shiftTimestamp = getScheduleShiftTimestamp(schedule);

  if (shiftTimestamp) {
    return {
      timestamp: shiftTimestamp,
      label: formatActivityMoment(shiftTimestamp),
    };
  }

  return {
    timestamp: 0,
    label: 'Chưa rõ',
  };
}

function getScheduleDateDistance(schedule, todayKey) {
  const scheduleDate = new Date(`${schedule.date}T00:00:00`).getTime();
  const todayDate = new Date(`${todayKey}T00:00:00`).getTime();

  if (!Number.isFinite(scheduleDate) || !Number.isFinite(todayDate)) return Number.MAX_SAFE_INTEGER;
  return Math.abs(scheduleDate - todayDate);
}

function getFallbackActivityTitle(item) {
  if (item.publishStatus === 'Hidden') return 'Cần công khai lịch khám';
  if (item.status === 'cancelled') return 'Lịch hủy cần rà soát';
  if (Number(item.utilization || 0) >= 85) return 'Công suất cao cần theo dõi';
  if (Number(item.availableSlots || 0) <= 2 && Number(item.totalSlots || 0) > 0) return 'Sắp hết khung giờ trống';
  if (Number(item.blockedSlots || 0) > 0) return 'Có khung giờ bị khóa';
  return 'Lịch cần rà soát gần đây';
}

function buildActivityCandidateSchedules(schedules, todayKey) {
  return [...schedules]
    .sort((first, second) => {
      const secondTimestamp = getScheduleActivityTimestamp(second);
      const firstTimestamp = getScheduleActivityTimestamp(first);

      if (secondTimestamp !== firstTimestamp) return secondTimestamp - firstTimestamp;

      const firstDistance = getScheduleDateDistance(first, todayKey);
      const secondDistance = getScheduleDateDistance(second, todayKey);

      if (firstDistance !== secondDistance) return firstDistance - secondDistance;
      return String(first.start || '').localeCompare(String(second.start || ''));
    })
    .slice(0, 8);
}

function buildFallbackActivities(schedules, alerts) {
  const scheduleActivities = schedules.slice(0, 4).map((item) => {
    const moment = getScheduleActivityMoment(item);

    return {
      id: `lich-${item.id}`,
      timestamp: moment.timestamp,
      time: moment.label,
      title: getFallbackActivityTitle(item),
      actor: item.createdBy || 'Hệ thống lịch khám',
      body: `${item.doctor} - ${item.department} - ${formatDate(item.date)}. ${getScheduleNeedText(item)}`,
    };
  });

  const alertActivities = alerts.slice(0, 2).map((item, index) => ({
    id: `canh-bao-${index}`,
    timestamp: Date.now() - index,
    time: formatActivityMoment(Date.now() - index),
    title: item.title,
    actor: 'Trung tâm điều phối',
    body: item.body,
  }));

  return [...alertActivities, ...scheduleActivities]
    .sort((first, second) => Number(second.timestamp || 0) - Number(first.timestamp || 0))
    .slice(0, 6);
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
  { id: '7d', label: '7 ngày', days: 7 },
  { id: '1m', label: '1 tháng', days: 30 },
  { id: '1q', label: '1 quý', days: 90 },
  { id: '1y', label: '1 năm', days: 365 },
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

function asNumber(value, fallback = 0) {
  if (typeof value === 'string') {
    const normalized = value.replace('%', '').replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getOverviewNumber(overview, key, fallback = 0) {
  return overview && overview[key] !== undefined && overview[key] !== null
    ? asNumber(overview[key], fallback)
    : fallback;
}

function getRate(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + Math.max(Number(days || 1) - 1, 0));
  return date.toISOString().slice(0, 10);
}

function isDateInRange(dateKey, startKey, endKey) {
  return Boolean(dateKey) && dateKey >= startKey && dateKey <= endKey;
}

function buildDashboardDepartmentMetrics(schedules) {
  const grouped = new Map();

  schedules.forEach((schedule) => {
    const key = schedule.departmentId || schedule.department || 'unknown-department';
    const current = grouped.get(key) || {
      id: key,
      name: schedule.department || 'Chưa xác định khoa',
      bookings: 0,
      totalSlots: 0,
      availableSlots: 0,
    };

    current.bookings += asNumber(schedule.bookedSlots);
    current.totalSlots += asNumber(schedule.totalSlots);
    current.availableSlots += asNumber(schedule.availableSlots);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    utilization: getRate(item.bookings, item.totalSlots),
  }));
}

function buildDashboardDoctorMetrics(schedules) {
  const grouped = new Map();

  schedules.forEach((schedule) => {
    const key = schedule.doctorId || schedule.doctor || 'unknown-doctor';
    const current = grouped.get(key) || {
      id: key,
      name: schedule.doctor || 'Chưa xác định bác sĩ',
      department: schedule.department || 'Chưa xác định khoa',
      bookedSlots: 0,
      totalSlots: 0,
      avatar: schedule.doctorAvatar || schedule.avatar,
    };

    current.bookedSlots += asNumber(schedule.bookedSlots);
    current.totalSlots += asNumber(schedule.totalSlots);
    grouped.set(key, current);
  });

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    load: getRate(item.bookedSlots, item.totalSlots),
  }));
}

function buildDashboardTrendMetrics(schedules) {
  const grouped = new Map();

  schedules.forEach((schedule) => {
    const key = schedule.date;
    if (!key) return;

    const current = grouped.get(key) || { date: key, bookedSlots: 0, totalSlots: 0 };
    current.bookedSlots += asNumber(schedule.bookedSlots);
    current.totalSlots += asNumber(schedule.totalSlots);
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .sort((first, second) => first.date.localeCompare(second.date))
    .map((item) => ({
      label: formatDate(item.date),
      value: getRate(item.bookedSlots, item.totalSlots),
    }));
}

function normalizeStatus(value) {
  return String(value || '').toLowerCase();
}

function isScheduleCancelled(item) {
  const status = normalizeStatus(item.status);
  return status === 'cancelled' || status === 'canceled';
}

function isScheduleCompleted(item) {
  return normalizeStatus(item.status) === 'completed';
}

function isScheduleVisible(item) {
  return item.publishStatus === 'Visible' || item.raw?.publish_status === 'visible';
}

function getAssessmentFromLevel(level, label, body) {
  return { tone: level, label, body };
}

function getMetricAssessment(label, signals) {
  if (label === 'Lịch hôm nay') {
    if (signals.todayCount === 0) {
      return getAssessmentFromLevel('warning', 'Cần kiểm tra', 'Không có lịch vận hành hôm nay.');
    }
    return getAssessmentFromLevel('good', 'Ổn định', `${signals.todayCount} lịch đang trong ngày.`);
  }

  if (label === 'Lịch trong tuần') {
    if (signals.totalSchedules === 0) {
      return getAssessmentFromLevel('warning', 'Thiếu dữ liệu', 'Chưa có lịch trong khoảng theo dõi.');
    }
    return getAssessmentFromLevel('good', 'Có dữ liệu', `${signals.totalSchedules} lịch đang được theo dõi.`);
  }

  if (label === 'Chưa công khai') {
    if (signals.unpublishedCount >= 10 || signals.unpublishedRate >= 20) {
      return getAssessmentFromLevel('danger', 'Báo động', 'Tỷ lệ lịch chưa công khai cao.');
    }
    if (signals.unpublishedCount > 0) {
      return getAssessmentFromLevel('warning', 'Cần duyệt', 'Có lịch chưa hiển thị cho bệnh nhân.');
    }
    return getAssessmentFromLevel('good', 'Đã sạch', 'Không còn lịch chờ công khai.');
  }

  if (label === 'Tổng khung giờ') {
    if (signals.totalSlots === 0) {
      return getAssessmentFromLevel('danger', 'Không có slot', 'Chưa có khung giờ khả dụng.');
    }
    return getAssessmentFromLevel('good', 'Sẵn sàng', `${signals.totalSlots} khung giờ trong hệ thống.`);
  }

  if (label === 'Đã đặt') {
    if (signals.utilizationRate >= 92) {
      return getAssessmentFromLevel('danger', 'Gần quá tải', 'Công suất đặt lịch rất cao.');
    }
    if (signals.utilizationRate >= 80) {
      return getAssessmentFromLevel('warning', 'Theo dõi sát', 'Nên chuẩn bị phương án mở thêm ca.');
    }
    if (signals.utilizationRate < 30 && signals.totalSlots > 0) {
      return getAssessmentFromLevel('watch', 'Nhu cầu thấp', 'Cần đẩy hiển thị hoặc điều phối.');
    }
    return getAssessmentFromLevel('good', 'Cân bằng', 'Tỷ lệ đặt lịch trong vùng an toàn.');
  }

  if (label === 'Còn trống') {
    if (signals.totalSlots > 0 && signals.availableRate < 8) {
      return getAssessmentFromLevel('danger', 'Sắp kín', 'Nguồn slot trống đang rất thấp.');
    }
    if (signals.totalSlots > 0 && signals.availableRate < 18) {
      return getAssessmentFromLevel('warning', 'Cần mở thêm', 'Slot trống thấp hơn ngưỡng khuyến nghị.');
    }
    return getAssessmentFromLevel('good', 'Đủ nguồn', 'Còn slot để tiếp nhận đặt lịch.');
  }

  if (label === 'Đã khóa') {
    if (signals.blockedRate >= 15) {
      return getAssessmentFromLevel('danger', 'Khóa cao', 'Tỷ lệ slot khóa vượt ngưỡng an toàn.');
    }
    if (signals.blockedRate > 5) {
      return getAssessmentFromLevel('warning', 'Cần rà soát', 'Có nhiều slot bị khóa vận hành.');
    }
    return getAssessmentFromLevel('good', 'Bình thường', 'Tỷ lệ slot khóa thấp.');
  }

  if (label === 'Lấp đầy TB') {
    if (signals.utilizationRate >= 92) {
      return getAssessmentFromLevel('danger', 'Quá tải', 'Công suất trung bình vượt ngưỡng.');
    }
    if (signals.utilizationRate >= 80) {
      return getAssessmentFromLevel('warning', 'Cao', 'Cần theo dõi các khoa đang nóng.');
    }
    if (signals.utilizationRate < 30 && signals.totalSlots > 0) {
      return getAssessmentFromLevel('watch', 'Thấp', 'Công suất thấp hơn kỳ vọng.');
    }
    return getAssessmentFromLevel('good', 'Ổn định', 'Công suất ở vùng vận hành tốt.');
  }

  return getAssessmentFromLevel('good', 'Đã ghi nhận', 'Thông số đang được theo dõi.');
}

function getScheduleAssessment(item) {
  if (isScheduleCancelled(item) && Number(item.bookedSlots || 0) > 0) {
    return { tone: 'danger', label: 'Cần gọi đổi lịch' };
  }
  if (!isScheduleVisible(item) && !isScheduleCancelled(item) && !isScheduleCompleted(item)) {
    return { tone: 'warning', label: 'Chưa công khai' };
  }
  if (Number(item.availableSlots || 0) === 0 && Number(item.totalSlots || 0) > 0) {
    return { tone: 'danger', label: 'Đã kín slot' };
  }
  if (Number(item.utilization || 0) >= 85) {
    return { tone: 'warning', label: 'Công suất cao' };
  }
  if (Number(item.utilization || 0) < 30 && Number(item.totalSlots || 0) > 0) {
    return { tone: 'watch', label: 'Lấp đầy thấp' };
  }
  return { tone: 'good', label: 'Ổn định' };
}

function getSystemHealth(signals, hasError) {
  if (hasError) {
    return {
      tone: 'warning',
      title: 'Đang dùng dữ liệu dự phòng',
      body: 'Không kết nối được dữ liệu lịch khám mới nhất.',
      label: 'Cần kiểm tra kết nối',
    };
  }

  if (signals.totalSlots === 0) {
    return {
      tone: 'danger',
      title: 'Chưa có khung giờ vận hành',
      body: 'Hệ thống chưa có slot khả dụng cho bệnh nhân đặt lịch.',
      label: 'Cần tạo lịch',
    };
  }

  if (signals.criticalIssues > 0) {
    return {
      tone: 'danger',
      title: 'Có chỉ số vượt ngưỡng báo động',
      body: `${signals.criticalIssues} nhóm chỉ số cần xử lý ngay.`,
      label: 'Cần can thiệp',
    };
  }

  if (signals.warningIssues > 0) {
    return {
      tone: 'warning',
      title: 'Hệ thống cần theo dõi',
      body: `${signals.warningIssues} nhóm chỉ số đang ở vùng cảnh báo.`,
      label: 'Theo dõi sát',
    };
  }

  return {
    tone: 'good',
    title: 'Hệ thống lịch đang hoạt động ổn định',
    body: 'Các chỉ số chính nằm trong ngưỡng vận hành.',
    label: 'Đang hoạt động tốt',
  };
}

function buildComputedAlerts({ signals, unpublishedSchedules, highPressureSchedules, lowDemandDepartments, cancelledBookedSchedules }) {
  const alerts = [];

  if (signals.unpublishedCount > 0) {
    alerts.push({
      id: 'unpublished',
      tone: signals.unpublishedCount >= 10 || signals.unpublishedRate >= 20 ? 'danger' : 'warning',
      title: 'Lịch chưa công khai',
      body: `${signals.unpublishedCount} lịch cần duyệt trước khi bệnh nhân nhìn thấy khung giờ.`,
      count: signals.unpublishedCount,
      to: '/scheduling/approvals',
      icon: LockKeyhole,
      items: unpublishedSchedules,
    });
  }

  if (highPressureSchedules.length > 0) {
    alerts.push({
      id: 'high-pressure',
      tone: highPressureSchedules.length >= 5 ? 'danger' : 'warning',
      title: 'Lịch sắp kín khung giờ',
      body: `${highPressureSchedules.length} lịch đạt từ 85% công suất hoặc gần hết slot trống.`,
      count: highPressureSchedules.length,
      to: '/scheduling/schedules',
      icon: Clock3,
      items: highPressureSchedules,
    });
  }

  if (signals.blockedRate >= 8) {
    alerts.push({
      id: 'blocked-rate',
      tone: signals.blockedRate >= 15 ? 'danger' : 'warning',
      title: 'Tỷ lệ slot khóa cao',
      body: `${formatPercent(signals.blockedRate)} khung giờ đang bị khóa, cần rà soát nguyên nhân.`,
      count: signals.blockedSlots,
      to: '/scheduling/slots',
      icon: LockKeyhole,
      items: [],
    });
  }

  if (lowDemandDepartments.length > 0) {
    alerts.push({
      id: 'low-demand',
      tone: 'info',
      title: 'Khoa có lấp đầy thấp',
      body: `${lowDemandDepartments.length} khoa dưới 35% công suất, nên ưu tiên hiển thị hoặc điều phối.`,
      count: lowDemandDepartments.length,
      to: '/scheduling/departments',
      icon: Activity,
      items: lowDemandDepartments,
    });
  }

  if (cancelledBookedSchedules.length > 0) {
    alerts.push({
      id: 'cancelled-booked',
      tone: 'danger',
      title: 'Lịch hủy còn bệnh nhân',
      body: `${cancelledBookedSchedules.length} lịch đã hủy nhưng còn lượt đặt cần gọi đổi lịch.`,
      count: cancelledBookedSchedules.length,
      to: '/scheduling/schedules',
      icon: AlertTriangle,
      items: cancelledBookedSchedules,
    });
  }

  return alerts;
}

export function SchedulingDashboardPage() {
  const {
    actions,
    backendConnected,
    departments,
    doctors,
    error,
    loading,
    operationAlerts,
    rawSummary,
    refresh,
    schedules,
    utilizationSeries,
  } = useSchedulingData();

  const [actionMessage, setActionMessage] = useState('');
  const [recentActivities, setRecentActivities] = useState([]);
  const [activeAnalysis, setActiveAnalysis] = useState('department');
  const [analysisView, setAnalysisView] = useState('chart');
  const [analysisRange, setAnalysisRange] = useState('7d');
  const [isAnalysisRangeOpen, setIsAnalysisRangeOpen] = useState(false);
  const [isAnalysisActionsOpen, setIsAnalysisActionsOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const analysisToolsRef = useRef(null);

  const todayKey = getTodayKey();

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((first, second) => {
      const firstKey = `${first.date || ''} ${first.start || ''}`;
      const secondKey = `${second.date || ''} ${second.start || ''}`;
      return firstKey.localeCompare(secondKey);
    });
  }, [schedules]);

  const todaySchedules = sortedSchedules.filter((item) => item.date === todayKey);

  const visibleTodaySchedules = todaySchedules;

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
    );

  const conflictWatchSchedules = sortedSchedules
    .filter(
      (item) =>
        item.doctor?.includes('Chưa xác định') ||
        item.department?.includes('Chưa xác định') ||
        String(item.start || '').localeCompare(String(item.end || '')) >= 0,
    );

  const impactSchedules = sortedSchedules
    .filter(
      (item) =>
        item.date >= todayKey &&
        Number(item.bookedSlots || 0) > 0 &&
        (Number(item.blockedSlots || 0) > 0 || !isScheduleVisible(item)),
    );

  const busyDoctors = [...doctors]
    .sort((first, second) => Number(second.load || 0) - Number(first.load || 0))
    .slice(0, 5);

  const watchedDepartments = [...departments]
    .sort((first, second) => Number(second.utilization || 0) - Number(first.utilization || 0))
    .slice(0, 5);

  const computedSlotTotals = schedules.reduce(
    (total, item) => ({
      booked: total.booked + Number(item.bookedSlots || 0),
      available: total.available + Number(item.availableSlots || 0),
      blocked: total.blocked + Number(item.blockedSlots || 0),
    }),
    { booked: 0, available: 0, blocked: 0 },
  );

  const rawOverview = rawSummary?.overview || null;
  const slotTotals = {
    booked: getOverviewNumber(rawOverview, 'booked_slots', computedSlotTotals.booked),
    available: getOverviewNumber(rawOverview, 'available_slots', computedSlotTotals.available),
    blocked: getOverviewNumber(rawOverview, 'blocked_slots', computedSlotTotals.blocked),
  };
  const actualTotalSlotCount = getOverviewNumber(
    rawOverview,
    'total_slots',
    computedSlotTotals.booked + computedSlotTotals.available + computedSlotTotals.blocked,
  );
  const totalSlotCount = Math.max(actualTotalSlotCount, 1);
  const visibleSchedulesCount = sortedSchedules.filter((item) => isScheduleVisible(item)).length;
  const cancelledBookedSchedules = sortedSchedules.filter(
    (item) => isScheduleCancelled(item) && Number(item.bookedSlots || 0) > 0,
  );
  const lowDemandDepartments = departments.filter(
    (item) => Number(item.totalSlots || 0) > 0 && Number(item.utilization || 0) < 35,
  );
  const overCapacityDepartments = departments.filter((item) => Number(item.utilization || 0) >= 90);
  const busyDoctorWarnings = doctors.filter((item) => Number(item.load || 0) >= 90);
  const utilizationRate = getOverviewNumber(
    rawOverview,
    'utilization_rate',
    getRate(slotTotals.booked, totalSlotCount),
  );
  const operationalSignals = {
    todayCount: getOverviewNumber(rawOverview, 'today_schedules', todaySchedules.length),
    totalSchedules: getOverviewNumber(rawOverview, 'schedules_count', sortedSchedules.length),
    visibleSchedulesCount,
    unpublishedCount: getOverviewNumber(rawOverview, 'unpublished_schedules', unpublishedSchedules.length),
    totalSlots: actualTotalSlotCount,
    bookedSlots: slotTotals.booked,
    availableSlots: slotTotals.available,
    blockedSlots: slotTotals.blocked,
    utilizationRate,
    availableRate: getRate(slotTotals.available, totalSlotCount),
    blockedRate: getRate(slotTotals.blocked, totalSlotCount),
    unpublishedRate: getRate(
      getOverviewNumber(rawOverview, 'unpublished_schedules', unpublishedSchedules.length),
      Math.max(getOverviewNumber(rawOverview, 'schedules_count', sortedSchedules.length), 1),
    ),
    highPressureCount: highPressureSchedules.length,
    cancelledBookedCount: cancelledBookedSchedules.length,
    lowDemandDepartmentCount: lowDemandDepartments.length,
    overCapacityDepartmentCount: overCapacityDepartments.length,
    busyDoctorCount: busyDoctorWarnings.length,
  };
  operationalSignals.criticalIssues = [
    operationalSignals.totalSlots === 0,
    operationalSignals.utilizationRate >= 92,
    operationalSignals.availableRate < 8 && operationalSignals.totalSlots > 0,
    operationalSignals.blockedRate >= 15,
    operationalSignals.cancelledBookedCount > 0,
  ].filter(Boolean).length;
  operationalSignals.warningIssues = [
    operationalSignals.unpublishedCount > 0,
    operationalSignals.utilizationRate >= 80 && operationalSignals.utilizationRate < 92,
    operationalSignals.availableRate >= 8 && operationalSignals.availableRate < 18,
    operationalSignals.blockedRate >= 8 && operationalSignals.blockedRate < 15,
    operationalSignals.highPressureCount > 0,
    operationalSignals.lowDemandDepartmentCount > 0,
  ].filter(Boolean).length;
  const systemHealth = getSystemHealth(operationalSignals, Boolean(error));
  const computedAlerts = buildComputedAlerts({
    signals: operationalSignals,
    unpublishedSchedules,
    highPressureSchedules,
    lowDemandDepartments,
    cancelledBookedSchedules,
  });
  const backendAlerts = backendConnected
    ? operationAlerts.map((item, index) => ({
        id: `backend-${index}`,
        tone: item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : 'info',
        title: item.title,
        body: item.body,
        count: null,
        to: '/scheduling/schedules',
        icon: AlertTriangle,
        items: [],
      }))
    : [];
  const alertSeverity = { danger: 3, warning: 2, info: 1, good: 0 };
  const operationalAlerts = [...computedAlerts, ...backendAlerts]
    .sort(
      (first, second) =>
        (alertSeverity[second.tone] || 0) - (alertSeverity[first.tone] || 0) ||
        Number(second.count || 0) - Number(first.count || 0),
    )
    .slice(0, 6);

  const departmentColors = ['#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'];
  const activeRange = ANALYSIS_RANGE_OPTIONS.find((item) => item.id === analysisRange) || ANALYSIS_RANGE_OPTIONS[0];
  const activeAnalysisTab = ANALYSIS_TABS.find((item) => item.id === activeAnalysis) || ANALYSIS_TABS[0];
  const activeAnalysisIndex = ANALYSIS_TABS.findIndex((item) => item.id === activeAnalysis);
  const activeAnalysisTabIndex = activeAnalysisIndex >= 0 ? activeAnalysisIndex : 0;
  const analysisRangeEndKey = addDaysToDateKey(todayKey, activeRange.days);
  const analysisSchedules = sortedSchedules.filter((item) => isDateInRange(item.date, todayKey, analysisRangeEndKey));
  const analysisDepartmentMetrics = buildDashboardDepartmentMetrics(analysisSchedules)
    .sort((first, second) => Number(second.utilization || 0) - Number(first.utilization || 0))
    .slice(0, 5);
  const analysisDoctorMetrics = buildDashboardDoctorMetrics(analysisSchedules)
    .sort((first, second) => Number(second.load || 0) - Number(first.load || 0))
    .slice(0, 5);
  const analysisSlotTotals = analysisSchedules.reduce(
    (total, item) => ({
      booked: total.booked + Number(item.bookedSlots || 0),
      available: total.available + Number(item.availableSlots || 0),
      blocked: total.blocked + Number(item.blockedSlots || 0),
    }),
    { booked: 0, available: 0, blocked: 0 },
  );
  const analysisTotalSlotCount = Math.max(
    analysisSlotTotals.booked + analysisSlotTotals.available + analysisSlotTotals.blocked,
    1,
  );

  const analysisDepartments = analysisDepartmentMetrics.map((item, index) => ({
    id: item.id,
    name: item.name,
    caption: `${Math.round(Number(item.bookings || 0))} lượt đặt`,
    value: Math.max(0, Math.min(100, Number(item.utilization || 0))),
    color: departmentColors[index % departmentColors.length],
    icon: getDepartmentIcon(item.name),
  }));

  const analysisSlotItems = [
    { id: 'booked', name: 'Đã đặt', caption: `${analysisSlotTotals.booked} slot`, value: (analysisSlotTotals.booked / analysisTotalSlotCount) * 100, color: '#0ea5e9', icon: CheckCircle2 },
    { id: 'available', name: 'Còn trống', caption: `${analysisSlotTotals.available} slot`, value: (analysisSlotTotals.available / analysisTotalSlotCount) * 100, color: '#10b981', icon: Square },
    { id: 'blocked', name: 'Đã khóa', caption: `${analysisSlotTotals.blocked} slot`, value: (analysisSlotTotals.blocked / analysisTotalSlotCount) * 100, color: '#ef4444', icon: LockKeyhole },
  ];

  const analysisTrendSource = analysisRange === '7d' && utilizationSeries.length
    ? utilizationSeries
    : buildDashboardTrendMetrics(analysisSchedules);
  const analysisTrendItems = analysisTrendSource.map((item, index) => ({
        id: `trend-${item.label}-${index}`,
        name: item.label,
        badge: String(item.label || '').slice(0, 3).toUpperCase(),
        caption: activeRange.label,
        value: Number(item.value || 0),
        color: departmentColors[index % departmentColors.length],
        icon: TrendingUp,
      }));

  const analysisDoctorItems = analysisDoctorMetrics.map((item, index) => ({
    id: item.id,
    name: item.name,
    caption: item.department,
    value: Number(item.load || 0),
    color: departmentColors[index % departmentColors.length],
    avatar: getDoctorAvatar(item, index),
    icon: UserRoundCheck,
  }));

  const analysisTopDepartmentItems = analysisDepartmentMetrics.map((item, index) => ({
    id: item.id,
    name: item.name,
    caption: `${Math.round(Number(item.bookings || 0))} lượt đặt`,
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

  const bookedAngle = (analysisSlotTotals.booked / analysisTotalSlotCount) * 360;
  const availableAngle = (analysisSlotTotals.available / analysisTotalSlotCount) * 360;

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

  const dashboardSourceStats = [
    {
      label: 'Lịch hôm nay',
      value: operationalSignals.todayCount,
      delta: operationalSignals.todayCount > 0 ? 'đang vận hành' : 'cần bổ sung lịch',
    },
    {
      label: 'Lịch trong tuần',
      value: operationalSignals.totalSchedules,
      delta: backendConnected ? 'theo dữ liệu hệ thống' : 'dữ liệu dự phòng',
    },
    {
      label: 'Chưa công khai',
      value: operationalSignals.unpublishedCount,
      delta: operationalSignals.unpublishedCount > 0 ? 'cần duyệt' : 'không còn tồn đọng',
    },
    {
      label: 'Tổng khung giờ',
      value: operationalSignals.totalSlots,
      delta: 'toàn hệ thống',
    },
    {
      label: 'Đã đặt',
      value: operationalSignals.bookedSlots,
      delta: `${formatPercent(operationalSignals.utilizationRate)} lấp đầy`,
    },
    {
      label: 'Còn trống',
      value: operationalSignals.availableSlots,
      delta: `${formatPercent(operationalSignals.availableRate)} nguồn slot`,
    },
    {
      label: 'Đã khóa',
      value: operationalSignals.blockedSlots,
      delta: `${formatPercent(operationalSignals.blockedRate)} bị khóa`,
    },
    {
      label: 'Lấp đầy trung bình',
      value: `${Math.round(operationalSignals.utilizationRate)}%`,
      delta: 'theo khoảng ngày',
    },
  ];

  const dashboardStats = dashboardSourceStats.map((item) => {
    const visual = getDashboardMetricVisual(item.label);
    const Icon = visual.icon;
    const assessment = getMetricAssessment(visual.label, operationalSignals);

    return {
      ...item,
      label: visual.label,
      tone: visual.tone,
      icon: <Icon size={18} strokeWidth={2.25} />,
      assessment,
    };
  });

  const operationFlowSteps = [
    {
      label: 'Tạo lịch',
      value: operationalSignals.totalSchedules,
      body: `${operationalSignals.totalSchedules} lịch trong kỳ theo dõi.`,
      icon: CalendarPlus,
      tone: 'teal',
    },
    {
      label: 'Công khai',
      value: operationalSignals.visibleSchedulesCount,
      body: `${operationalSignals.visibleSchedulesCount} lịch đang hiển thị cho bệnh nhân.`,
      icon: Globe2,
      tone: 'blue',
    },
    {
      label: 'Bệnh nhân đặt',
      value: operationalSignals.bookedSlots,
      body: `${operationalSignals.bookedSlots} lượt đặt hợp lệ ghi nhận từ hệ thống.`,
      icon: UsersRound,
      tone: 'violet',
    },
    {
      label: 'Lễ tân hỗ trợ',
      value: operationalAlerts.length,
      body: `${operationalAlerts.length} nhắc nhở/cảnh báo cần theo dõi.`,
      icon: Headphones,
      tone: 'orange',
    },
  ];

  const systemRows = [
    { label: 'Đang hoạt động', value: operationalSignals.totalSlots, tone: 'green' },
    { label: 'Còn trống', value: operationalSignals.availableSlots, tone: 'blue' },
    { label: 'Đã khóa', value: operationalSignals.blockedSlots, tone: 'red' },
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
    setIsAnalysisActionsOpen(false);
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
    setIsAnalysisActionsOpen(false);
  }

  useEffect(() => {
    let isActive = true;

    async function loadActivities() {
      const activityCandidates = buildActivityCandidateSchedules(sortedSchedules, todayKey);
      const fallback = buildFallbackActivities(activityCandidates, operationAlerts);

      if (!backendConnected || !activityCandidates.length) {
        setRecentActivities(fallback);
        return;
      }

      const results = await Promise.allSettled(
        activityCandidates
          .slice(0, 5)
          .map((item) => schedulingApi.getScheduleActivity(item.id, { limit: 4 })),
      );

      if (!isActive) return;

      const mapped = results
        .flatMap((result) => (result.status === 'fulfilled' ? result.value?.items || [] : []))
        .sort(
          (first, second) =>
            getActivityTimestamp(second.created_at) - getActivityTimestamp(first.created_at),
        )
        .slice(0, 6)
        .map((item, index) => ({
          id: item.audit_log_id || `${item.action}-${index}`,
          time: formatActivityMoment(item.created_at) || 'Chưa rõ',
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
  }, [backendConnected, operationAlerts, sortedSchedules, todayKey]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (analysisToolsRef.current && !analysisToolsRef.current.contains(event.target)) {
        setIsAnalysisRangeOpen(false);
        setIsAnalysisActionsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsAnalysisRangeOpen(false);
        setIsAnalysisActionsOpen(false);
        setIsExportMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  async function runAction(successMessage, callback) {
    setActionMessage('Đang xử lý yêu cầu...');

    try {
      await callback();
      setActionMessage(successMessage);
    } catch (actionError) {
      setActionMessage(actionError.message || 'Không thể xử lý thao tác.');
    }
  }

  function handleAnalysisRefresh() {
    setIsAnalysisActionsOpen(false);
    setIsExportMenuOpen(false);
    runAction('Đã làm mới dữ liệu phân tích vận hành.', refresh);
  }

  function handleAnalysisViewFromMenu(nextView) {
    setAnalysisView(nextView);
    setIsAnalysisActionsOpen(false);
    setIsExportMenuOpen(false);
  }

  const todayMetricAssessment = getMetricAssessment('Lịch hôm nay', operationalSignals);
  const unpublishedMetricAssessment = getMetricAssessment('Chưa công khai', operationalSignals);
  const capacityMetricAssessment = getMetricAssessment('Lấp đầy TB', operationalSignals);
  const topOperationalAlert = operationalAlerts[0] || {
    id: 'stable',
    tone: 'good',
    title: systemHealth.label,
    body: systemHealth.body,
    count: 0,
    to: '/scheduling/schedules',
    icon: ShieldCheck,
    items: [],
  };
  const SyncIcon = loading ? LoaderCircle : systemHealth.tone === 'danger' ? AlertTriangle : ShieldCheck;

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
            <strong>{operationalSignals.todayCount}</strong>
            <small>
              {todayMetricAssessment.label}
              <TrendingUp size={14} strokeWidth={2.4} aria-hidden="true" />
            </small>
          </div>
          <div>
            <i aria-hidden="true">
              <LockKeyhole size={21} strokeWidth={2.1} />
            </i>
            <span>Chưa công khai</span>
            <strong>{operationalSignals.unpublishedCount}</strong>
            <small>
              {unpublishedMetricAssessment.label}
              <Eye size={14} strokeWidth={2.4} aria-hidden="true" />
            </small>
          </div>
          <div>
            <i aria-hidden="true">
              <BarChart3 size={22} strokeWidth={2.1} />
            </i>
            <span>Lấp đầy cao</span>
            <strong>{operationalSignals.highPressureCount}</strong>
            <small>
              {capacityMetricAssessment.label}
              <TrendingUp size={14} strokeWidth={2.4} aria-hidden="true" />
            </small>
          </div>
        </div>
      </section>

      <section className={`scheduling-sync-banner is-${systemHealth.tone} ${loading ? 'is-loading' : ''}`}>
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
                  : systemHealth.title}
            </strong>
            <span>
              {error || `${systemHealth.body} Dữ liệu được cập nhật lần cuối lúc ${lastUpdatedText}.`}
            </span>
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
                  <b>{step.value}</b>
                  <small>{step.body}</small>
                </div>
              );
            })}
          </div>

          <div className={`scheduling-operation-status is-${systemHealth.tone}`}>
            <Activity size={15} strokeWidth={2.35} aria-hidden="true" />
            {systemHealth.label}
          </div>
        </article>

        <article className={`scheduling-command-card scheduling-command-card--warning is-${topOperationalAlert.tone}`}>
          <div className="scheduling-command-card__head">
            <span>Ưu tiên hôm nay</span>
          </div>
          <strong>{topOperationalAlert.count ?? operationalAlerts.length}</strong>
          <small>
            <RefreshCw size={13} strokeWidth={2.35} aria-hidden="true" />
            {topOperationalAlert.tone === 'danger' ? 'Báo động' : topOperationalAlert.tone === 'warning' ? 'Cần xử lý' : 'Nhắc nhở'}
          </small>
          <p>{topOperationalAlert.body}</p>
          <div className="scheduling-command-list">
            {(operationalAlerts.length ? operationalAlerts : [topOperationalAlert]).slice(0, 3).map((alert) => {
              const AlertIcon = alert.icon || CalendarClock;

              return (
                <Link key={alert.id} to={alert.to} className={`is-${alert.tone}`}>
                  <AlertIcon size={16} strokeWidth={2.25} aria-hidden="true" />
                  {alert.title}
                  <b>{alert.count ?? '!'}</b>
                  <ChevronRight size={15} strokeWidth={2.3} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </article>

        <article className="scheduling-command-card scheduling-command-card--system">
          <div className="scheduling-command-card__head">
            <span>Tình trạng hệ thống</span>
          </div>
          <div className="scheduling-system-visual" aria-hidden="true">
            <ShieldCheck size={34} strokeWidth={2.3} />
          </div>
          <strong>{operationalSignals.totalSlots}</strong>
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
          <div className={`scheduling-system-pill is-${systemHealth.tone}`}>
            <Activity size={15} strokeWidth={2.35} aria-hidden="true" />
            {systemHealth.label}
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
              <Link to="/scheduling/tasks">Xem tất cả</Link>
            </div>

            <div className="scheduling-priority-grid">
              <div className="scheduling-priority-card scheduling-priority-card--amber">
                <div className="scheduling-priority-card__summary">
                  <div>
                    <span>Lịch chưa công khai</span>
                    <strong>{operationalSignals.unpublishedCount}</strong>
                    <p>Cần công khai để bệnh nhân và lễ tân nhìn thấy khung giờ.</p>
                    <em className={`scheduling-priority-assessment is-${unpublishedMetricAssessment.tone}`}>
                      {unpublishedMetricAssessment.label}: {unpublishedMetricAssessment.body}
                    </em>
                  </div>
                </div>

                {unpublishedSchedules.length ? unpublishedSchedules.slice(0, 3).map((item) => (
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
                )) : (
                  <div className="scheduling-priority-empty">Không có lịch chờ công khai.</div>
                )}
              </div>

              <div className="scheduling-priority-card scheduling-priority-card--red">
                <div className="scheduling-priority-card__summary">
                  <div>
                    <span>Lịch sắp hết khung giờ</span>
                    <strong>{operationalSignals.highPressureCount}</strong>
                    <p>Theo dõi bác sĩ/khoa có tỷ lệ đặt cao để mở thêm ca.</p>
                    <em className={`scheduling-priority-assessment is-${capacityMetricAssessment.tone}`}>
                      {capacityMetricAssessment.label}: {capacityMetricAssessment.body}
                    </em>
                  </div>
                </div>

                {highPressureSchedules.length ? highPressureSchedules.slice(0, 3).map((item) => (
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
                )) : (
                  <div className="scheduling-priority-empty">Không có lịch vượt ngưỡng công suất.</div>
                )}
              </div>

              <div className="scheduling-priority-card scheduling-priority-card--blue">
                <div className="scheduling-priority-card__summary">
                  <div>
                    <span>Lịch cần rà soát</span>
                    <strong>{conflictWatchSchedules.length + impactSchedules.length + cancelledBookedSchedules.length}</strong>
                    <p>Kiểm tra xung đột, khả năng cập nhật hoặc hủy nếu có bệnh nhân đặt.</p>
                    <em className={`scheduling-priority-assessment is-${cancelledBookedSchedules.length ? 'danger' : 'good'}`}>
                      {cancelledBookedSchedules.length ? 'Báo động' : 'Ổn định'}: {cancelledBookedSchedules.length ? 'Có lịch hủy còn bệnh nhân.' : 'Chưa phát hiện xung đột nghiêm trọng.'}
                    </em>
                  </div>
                </div>

                {[...cancelledBookedSchedules, ...conflictWatchSchedules, ...impactSchedules].length ? [...cancelledBookedSchedules, ...conflictWatchSchedules, ...impactSchedules].slice(0, 3).map((item) => (
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
                )) : (
                  <div className="scheduling-priority-empty">Không có lịch cần rà soát khẩn.</div>
                )}
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
            <Link to="/scheduling/today">Xem toàn bộ</Link>
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
              <span>Đánh giá</span>
              <span>Hành động</span>
            </div>

            {visibleTodaySchedules.length ? visibleTodaySchedules.map((item) => {
              const scheduleAssessment = getScheduleAssessment(item);

              return (
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
                  <span className={`scheduling-row-assessment is-${scheduleAssessment.tone}`}>
                    {scheduleAssessment.label}
                  </span>

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

                    {!isScheduleCancelled(item) ? (
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
              );
            }) : (
              <div className="scheduling-table-empty">
                <CalendarCheck2 size={20} strokeWidth={2.25} aria-hidden="true" />
                <strong>Không có lịch hôm nay</strong>
                <span>Hệ thống chưa ghi nhận ca khám trong ngày {formatDate(todayKey)}.</span>
              </div>
            )}
          </div>
        </section>
      </section>

      <section className="scheduling-operations-analysis">
        <div className="scheduling-operations-analysis__head">
          <div>
            <h2>Phân tích vận hành</h2>
            <p>Theo dõi toàn diện hiệu suất lịch khám</p>
          </div>

          <div className="scheduling-operations-analysis__tools" ref={analysisToolsRef}>
            <div className="scheduling-analysis-range">
              <button
                type="button"
                className="scheduling-analysis-range__button"
                aria-expanded={isAnalysisRangeOpen}
                onClick={() => {
                  setIsAnalysisRangeOpen((current) => !current);
                  setIsAnalysisActionsOpen(false);
                }}
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

            <div className="scheduling-analysis-actions-menu">
              <button
                type="button"
                className="scheduling-analysis-actions-menu__button"
                aria-label="Tùy chọn phân tích vận hành"
                aria-expanded={isAnalysisActionsOpen}
                onClick={() => {
                  setIsAnalysisActionsOpen((current) => !current);
                  setIsAnalysisRangeOpen(false);
                }}
              >
                <EllipsisVertical size={17} strokeWidth={2.2} aria-hidden="true" />
              </button>

              {isAnalysisActionsOpen ? (
                <div className="scheduling-analysis-actions-menu__list" role="menu">
                  <button type="button" role="menuitem" onClick={handleAnalysisRefresh}>
                    <RefreshCw size={15} strokeWidth={2.25} aria-hidden="true" />
                    Làm mới phân tích
                  </button>
                  <button type="button" role="menuitem" onClick={() => handleAnalysisViewFromMenu('chart')}>
                    <BarChart3 size={15} strokeWidth={2.25} aria-hidden="true" />
                    Xem dạng biểu đồ
                  </button>
                  <button type="button" role="menuitem" onClick={() => handleAnalysisViewFromMenu('table')}>
                    <Table2 size={15} strokeWidth={2.25} aria-hidden="true" />
                    Xem dạng bảng
                  </button>
                  <button type="button" role="menuitem" onClick={handleExportCurrentChart}>
                    <Download size={15} strokeWidth={2.25} aria-hidden="true" />
                    Xuất hình đang xem
                  </button>
                  <Link to="/scheduling/utilization" role="menuitem" onClick={() => setIsAnalysisActionsOpen(false)}>
                    <ChartSpline size={15} strokeWidth={2.25} aria-hidden="true" />
                    Báo cáo chi tiết
                  </Link>
                  <Link to="/scheduling/activity" role="menuitem" onClick={() => setIsAnalysisActionsOpen(false)}>
                    <ClipboardList size={15} strokeWidth={2.25} aria-hidden="true" />
                    Nhật ký hoạt động
                  </Link>
                </div>
              ) : null}
            </div>
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
                onClick={() => {
                  setIsExportMenuOpen((current) => !current);
                  setIsAnalysisActionsOpen(false);
                }}
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
              {activeAnalysisItems.length ? activeAnalysisItems.map((item) => {
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
              }) : (
                <p className="scheduling-analysis-empty">Chưa có dữ liệu phân tích trong {activeRange.label}.</p>
              )}
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
                  {activeAnalysisItems.length ? activeAnalysisItems.map((item) => {
                    const rawChartValue = Math.max(0, Math.min(Number(item.value || 0), 100));
                    const chartValue = rawChartValue > 0 ? Math.max(8, rawChartValue) : 0;

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
                  }) : (
                    <p className="scheduling-analysis-empty scheduling-analysis-empty--chart">
                      Chưa có dữ liệu biểu đồ trong {activeRange.label}.
                    </p>
                  )}
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

                {activeAnalysisItems.length ? activeAnalysisItems.map((item) => {
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
                }) : (
                  <div className="scheduling-analysis-insight-empty" role="row">
                    Chưa có dữ liệu bảng trong {activeRange.label}.
                  </div>
                )}
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
              {analysisDoctorItems.length ? analysisDoctorItems.map((item) => (
                  <div key={item.id}>
                    <img
                      className="scheduling-analysis-avatar scheduling-analysis-avatar--small"
                      src={item.avatar}
                      alt=""
                      loading="lazy"
                      onError={handleDoctorAvatarError}
                    />
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.caption}</span>
                    </div>
                    <b>{formatPercent(item.value)}</b>
                    <em>
                      <span style={{ width: `${Math.min(Number(item.value || 0), 100)}%`, backgroundColor: item.color }} />
                    </em>
                  </div>
              )) : (
                <p className="scheduling-analysis-empty">Chưa có bác sĩ cần theo dõi trong {activeRange.label}.</p>
              )}
            </div>
          </article>

          <article className="scheduling-analysis-mini-card scheduling-analysis-slot-card">
            <div className="scheduling-analysis-mini-card__head">
              <h3>Tỷ lệ khung giờ</h3>
            </div>

              <div className="scheduling-analysis-donut-layout">
                <div className="scheduling-donut" style={donutStyle}>
                <strong>{formatPercent((analysisSlotTotals.booked / analysisTotalSlotCount) * 100)}</strong>
                <span>Đã đặt</span>
              </div>

              <div className="scheduling-donut-legend">
                <span>
                  <i className="is-booked" />
                  Đã đặt <b>{analysisSlotTotals.booked} ({formatPercent((analysisSlotTotals.booked / analysisTotalSlotCount) * 100)})</b>
                </span>
                <span>
                  <i className="is-available" />
                  Còn trống <b>{analysisSlotTotals.available} ({formatPercent((analysisSlotTotals.available / analysisTotalSlotCount) * 100)})</b>
                </span>
                <span>
                  <i className="is-blocked" />
                  Đã khóa <b>{analysisSlotTotals.blocked} ({formatPercent((analysisSlotTotals.blocked / analysisTotalSlotCount) * 100)})</b>
                </span>
              </div>
            </div>
          </article>

          <article className="scheduling-analysis-mini-card scheduling-analysis-activity-card">
            <div className="scheduling-analysis-mini-card__head">
              <h3>Hoạt động gần đây</h3>
              <Link to="/scheduling/activity">Xem tất cả</Link>
            </div>

            <div className={`scheduling-analysis-activity-list ${recentActivities.length ? '' : 'is-empty'}`}>
              {recentActivities.length ? recentActivities.slice(0, 5).map((item) => (
                <div key={item.id}>
                  <time>{item.time}</time>
                  <i aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.body}</span>
                  </div>
                </div>
              )) : (
                <p className="scheduling-analysis-empty">Chưa có hoạt động gần đây từ hệ thống.</p>
              )}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
