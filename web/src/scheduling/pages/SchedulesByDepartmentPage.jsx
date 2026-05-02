import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Filter,
  HeartPulse,
  Hospital,
  ListChecks,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  MoreVertical,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldPlus,
  SmilePlus,
  Sparkles,
  Stethoscope,
  UsersRound,
  Video,
  WandSparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSchedulingData } from '../context/SchedulingDataContext';

const numberFormatter = new Intl.NumberFormat('vi-VN');

const departmentProfiles = {
  internal: {
    displayName: 'Khoa Nội tổng quát',
    shortName: 'Nội tổng quát',
    manager: 'TS.BS. Nguyễn Văn An',
    title: 'Trưởng khoa',
    icon: Stethoscope,
    tone: 'blue',
    status: 'Hoạt động',
    image: '/images/scheduling/hero-calendar.png',
    rooms: ['Phòng 101', 'Phòng 102', 'Phòng 103', 'Telehealth', 'Phòng thủ thuật', 'Phòng 105'],
    doctors: 18,
    roomCount: 5,
    hotline: '024 1234 5678',
    hours: '07:00 - 17:00 (T2 - T7)',
    noShow: '4,3%',
    avgTime: '18 phút',
    satisfaction: '4,7/5',
    telehealth: 156,
    tags: ['Nội tổng quát', 'Tiêu hóa', 'Hô hấp', 'Huyết áp', '+2'],
  },
  cardiology: {
    displayName: 'Khoa Tim mạch',
    shortName: 'Tim mạch',
    manager: 'ThS.BS. Trần Thùy Lan',
    title: 'Phụ trách Tim mạch',
    icon: HeartPulse,
    tone: 'rose',
    status: 'Hoạt động',
    image: '/images/scheduling/hero-bg.png',
    rooms: ['Tim mạch 1', 'Tim mạch 2', 'Điện tim', 'Telehealth', 'Can thiệp', 'Phòng 209'],
    doctors: 12,
    roomCount: 3,
    hotline: '024 2234 8899',
    hours: '07:30 - 17:30 (T2 - T7)',
    noShow: '3,8%',
    avgTime: '20 phút',
    satisfaction: '4,8/5',
    telehealth: 98,
    tags: ['Tim mạch', 'ECG', 'Tăng huyết áp', 'Can thiệp'],
  },
  pediatrics: {
    displayName: 'Khoa Nhi',
    shortName: 'Nhi khoa',
    manager: 'BS.CKII. Phạm Anh Khoa',
    title: 'Trưởng nhóm Nhi',
    icon: SmilePlus,
    tone: 'mint',
    status: 'Hoạt động',
    image: '/images/scheduling/hero-calendar.png',
    rooms: ['Nhi 01', 'Nhi 02', 'Nhi 03', 'Telehealth', 'Tiêm chủng', 'Phòng 116'],
    doctors: 16,
    roomCount: 4,
    hotline: '024 3345 7788',
    hours: '07:00 - 16:30 (T2 - T7)',
    noShow: '5,1%',
    avgTime: '16 phút',
    satisfaction: '4,7/5',
    telehealth: 74,
    tags: ['Nhi tổng quát', 'Hô hấp', 'Dinh dưỡng', 'Tiêm chủng'],
  },
  dermatology: {
    displayName: 'Khoa Da liễu',
    shortName: 'Da liễu',
    manager: 'ThS.BS. Lê Ngọc Hạnh',
    title: 'Phụ trách Da liễu',
    icon: Sparkles,
    tone: 'violet',
    status: 'Hoạt động',
    image: '/images/scheduling/hero-bg.png',
    rooms: ['Da liễu 1', 'Da liễu 2', 'Soi da', 'Telehealth', 'Thủ thuật', 'Phòng 410'],
    doctors: 10,
    roomCount: 3,
    hotline: '024 4456 9900',
    hours: '08:00 - 15:30 (T2 - T6)',
    noShow: '2,9%',
    avgTime: '14 phút',
    satisfaction: '4,8/5',
    telehealth: 61,
    tags: ['Da liễu', 'Dị ứng', 'Soi da', 'Thủ thuật'],
  },
  orthopedic: {
    displayName: 'Khoa Cơ xương khớp',
    shortName: 'Cơ xương khớp',
    manager: 'BS. Võ Minh Quang',
    title: 'Phụ trách Cơ xương khớp',
    icon: ShieldPlus,
    tone: 'cyan',
    status: 'Hoạt động',
    image: '/images/scheduling/hero-calendar.png',
    rooms: ['CXK 1', 'CXK 2', 'Vật lý trị liệu', 'Telehealth', 'Thủ thuật', 'Phòng 506'],
    doctors: 15,
    roomCount: 3,
    hotline: '024 5567 1000',
    hours: '07:30 - 18:00 (T2 - T7)',
    noShow: '4,8%',
    avgTime: '19 phút',
    satisfaction: '4,7/5',
    telehealth: 82,
    tags: ['Cơ xương khớp', 'Đau mạn tính', 'Phục hồi', 'Chấn thương'],
  },
};

const fallbackProfile = {
  displayName: 'Khoa chuyên môn',
  shortName: 'Khoa',
  manager: 'Trưởng khoa',
  title: 'Phụ trách khoa',
  icon: Hospital,
  tone: 'blue',
  status: 'Hoạt động',
  image: '/images/scheduling/hero-calendar.png',
  rooms: ['Phòng 101', 'Phòng 102', 'Phòng 103', 'Telehealth', 'Phòng thủ thuật', 'Phòng 105'],
  doctors: 8,
  roomCount: 3,
  hotline: '024 0000 0000',
  hours: '07:00 - 17:00',
  noShow: '4,3%',
  avgTime: '18 phút',
  satisfaction: '4,7/5',
  telehealth: 64,
  tags: ['Khám chuyên khoa', 'Tái khám', 'Telehealth'],
};

const viewTabs = [
  { id: 'room', label: 'Theo phòng', icon: Building2 },
  { id: 'shift', label: 'Theo ca', icon: CalendarClock },
  { id: 'capacity', label: 'Công suất', icon: Activity },
  { id: 'staff', label: 'Nhân sự', icon: UsersRound },
  { id: 'patients', label: 'Bệnh nhân', icon: ClipboardList },
  { id: 'activity', label: 'Hoạt động', icon: ListChecks },
];

const timeRows = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const baseRoomEvents = [
  { id: 'r1-1', room: 0, row: 2, span: 1, title: 'BS. Lê Văn Nam', time: '07:00 - 08:00', booked: 3, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r1-2', room: 0, row: 3, span: 1, title: 'BS. Trần Thị Hoa', time: '08:00 - 09:00', booked: 8, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r1-3', room: 0, row: 4, span: 1, title: 'BS. Phạm Văn Hùng', time: '09:00 - 10:00', booked: 10, total: 10, tone: 'full', badge: 'Đã đầy' },
  { id: 'r1-4', room: 0, row: 5, span: 1, title: 'BS. Nguyễn Thị Mai', time: '10:00 - 11:00', booked: 9, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r1-5', room: 0, row: 6, span: 1, title: 'BS. Hoàng Văn Tuấn', time: '11:00 - 12:00', booked: 10, total: 10, tone: 'full', badge: 'Đã đầy' },
  { id: 'r1-6', room: 0, row: 8, span: 1, title: 'BS. Phạm Quang Huy', time: '13:00 - 14:00', booked: 7, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r1-7', room: 0, row: 9, span: 1, title: 'BS. Lê Văn Nam', time: '14:00 - 15:00', booked: 4, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r1-8', room: 0, row: 10, span: 1, title: 'BS. Trần Thị Hoa', time: '15:00 - 16:00', booked: 4, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r1-9', room: 0, row: 11, span: 1, title: 'BS. Nguyễn Văn Hòa', time: '16:00 - 17:00', booked: 5, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r2-1', room: 1, row: 2, span: 1, title: 'BS. Nguyễn Minh Đức', time: '07:00 - 08:00', booked: 2, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r2-2', room: 1, row: 3, span: 1, title: 'BS. Đỗ Thị Loan', time: '08:00 - 09:00', booked: 9, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r2-3', room: 1, row: 4, span: 1, title: 'BS. Lê Quang Huy', time: '09:00 - 10:00', booked: 10, total: 10, tone: 'full', badge: 'Đã đầy' },
  { id: 'r2-4', room: 1, row: 5, span: 1, title: 'BS. Phùng Thy Lam', time: '10:00 - 11:00', booked: 4, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r2-5', room: 1, row: 6, span: 1, title: 'BS. Trần Minh Anh', time: '11:00 - 12:00', booked: 7, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r2-6', room: 1, row: 7, span: 1, title: 'BS. Nguyễn Anh Đức', time: '12:00 - 13:00', booked: 5, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r2-7', room: 1, row: 8, span: 1, title: 'BS. Đỗ Thị Loan', time: '14:00 - 15:00', booked: 6, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r2-8', room: 1, row: 10, span: 1, title: 'BS. Lê Quang Huy', time: '15:00 - 16:00', booked: 4, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r2-9', room: 1, row: 11, span: 1, title: 'BS. Phùng Thy Lan', time: '16:00 - 17:00', booked: 4, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r3-1', room: 2, row: 2, span: 1, title: 'BS. Phạm Văn Sơn', time: '07:00 - 08:00', booked: 4, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r3-2', room: 2, row: 3, span: 1, title: 'BS. Vũ Thị Hạnh', time: '08:00 - 09:00', booked: 8, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r3-3', room: 2, row: 4, span: 1, title: 'BS. Trần Văn Dũng', time: '09:00 - 10:00', booked: 10, total: 10, tone: 'full', badge: 'Đã đầy' },
  { id: 'r3-4', room: 2, row: 5, span: 1, title: 'BS. Nguyễn Văn Bình', time: '10:00 - 11:00', booked: 5, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r3-5', room: 2, row: 6, span: 1, title: 'BS. Phạm Văn Sơn', time: '11:00 - 12:00', booked: 6, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r3-6', room: 2, row: 8, span: 1, title: 'BS. Vũ Thị Hạnh', time: '14:00 - 15:00', booked: 7, total: 10, tone: 'near', badge: 'Gần đầy' },
  { id: 'r3-7', room: 2, row: 9, span: 1, title: 'BS. Trần Văn Dũng', time: '15:00 - 16:00', booked: 5, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r3-8', room: 2, row: 10, span: 1, title: 'BS. Nguyễn Văn Bình', time: '15:00 - 16:00', booked: 4, total: 10, tone: 'open', badge: 'Còn trống' },
  { id: 'r3-9', room: 2, row: 11, span: 1, title: 'Dự phòng', time: '16:00 - 17:00', booked: 0, total: 0, tone: 'locked', badge: 'Dự phòng' },
  { id: 'tel-1', room: 3, row: 2, span: 1, title: 'BS. Lê Minh Anh', time: '07:00 - 08:00', booked: 12, total: 12, tone: 'telehealth', badge: 'Telehealth' },
  { id: 'tel-2', room: 3, row: 3, span: 1, title: 'BS. Hoàng Thu Hà', time: '08:00 - 09:00', booked: 14, total: 14, tone: 'telehealth', badge: 'Telehealth' },
  { id: 'tel-3', room: 3, row: 4, span: 1, title: 'BS. Lê Minh Anh', time: '09:00 - 10:00', booked: 18, total: 18, tone: 'telehealth', badge: 'Telehealth' },
  { id: 'tel-4', room: 3, row: 5, span: 1, title: 'BS. Hoàng Thu Hà', time: '10:00 - 11:00', booked: 15, total: 15, tone: 'telehealth', badge: 'Telehealth' },
  { id: 'tel-5', room: 3, row: 6, span: 1, title: 'BS. Lê Minh Anh', time: '11:00 - 12:00', booked: 12, total: 12, tone: 'telehealth', badge: 'Telehealth' },
  { id: 'tel-6', room: 3, row: 7, span: 1, title: 'BS. Hoàng Thu Hà', time: '12:00 - 13:00', booked: 10, total: 10, tone: 'telehealth', badge: 'Telehealth' },
  { id: 'tel-7', room: 3, row: 8, span: 1, title: 'BS. Lê Minh Anh', time: '14:00 - 15:00', booked: 18, total: 18, tone: 'telehealth', badge: 'Telehealth' },
  { id: 'tel-8', room: 3, row: 9, span: 1, title: 'BS. Hoàng Thu Hà', time: '15:00 - 16:00', booked: 12, total: 12, tone: 'telehealth', badge: 'Telehealth' },
  { id: 'tel-9', room: 3, row: 10, span: 1, title: 'Dự phòng', time: '16:00 - 17:00', booked: 0, total: 0, tone: 'locked', badge: 'Dự phòng' },
  { id: 'op-1', room: 4, row: 2, span: 1, title: 'Nội soi dạ dày', time: '07:00 - 08:30', booked: 1, total: 1, tone: 'priority', badge: 'Ưu tiên' },
  { id: 'op-2', room: 4, row: 3, span: 1, title: 'Siêu âm bụng', time: '09:00 - 10:00', booked: 1, total: 2, tone: 'near', badge: 'Gần đầy' },
  { id: 'op-3', room: 4, row: 5, span: 1, title: 'Nội soi dạ dày', time: '10:00 - 11:30', booked: 2, total: 2, tone: 'full', badge: 'Đã đầy' },
  { id: 'op-4', room: 4, row: 7, span: 1, title: 'Hội chẩn chuyên môn', time: '12:00 - 13:00', booked: 0, total: 0, tone: 'locked', badge: 'Nghỉ' },
  { id: 'op-5', room: 4, row: 8, span: 1, title: 'Sinh thiết', time: '13:00 - 14:30', booked: 1, total: 2, tone: 'near', badge: 'Gần đầy' },
  { id: 'op-6', room: 4, row: 10, span: 1, title: 'Vệ sinh phòng', time: '16:00 - 17:00', booked: 0, total: 0, tone: 'locked', badge: 'Nghỉ' },
  { id: 'r6-1', room: 5, row: 2, span: 1, title: 'BS. Nguyễn Hữu Tuấn', time: '07:00 - 08:00', booked: 8, total: 8, tone: 'open', badge: 'Còn trống' },
  { id: 'r6-2', room: 5, row: 3, span: 1, title: 'BS. Phạm Thu Hằng', time: '08:00 - 09:00', booked: 8, total: 8, tone: 'near', badge: 'Gần đầy' },
  { id: 'r6-3', room: 5, row: 4, span: 1, title: 'BS. Nguyễn Hữu Tuấn', time: '09:00 - 10:00', booked: 8, total: 8, tone: 'near', badge: 'Gần đầy' },
  { id: 'r6-4', room: 5, row: 5, span: 1, title: 'Khóa khám nội bộ', time: '10:00 - 11:00', booked: 0, total: 0, tone: 'locked', badge: 'Khóa' },
  { id: 'r6-5', room: 5, row: 6, span: 1, title: 'Khóa lịch họp', time: '11:00 - 12:00', booked: 0, total: 0, tone: 'locked', badge: 'Khóa' },
  { id: 'r6-6', room: 5, row: 8, span: 1, title: 'BS. Phạm Thu Hằng', time: '13:00 - 14:00', booked: 8, total: 8, tone: 'near', badge: 'Gần đầy' },
  { id: 'r6-7', room: 5, row: 9, span: 1, title: 'BS. Nguyễn Hữu Tuấn', time: '14:00 - 15:00', booked: 8, total: 8, tone: 'open', badge: 'Còn trống' },
  { id: 'r6-8', room: 5, row: 10, span: 1, title: 'BS. Phạm Thu Hằng', time: '15:00 - 16:00', booked: 4, total: 8, tone: 'open', badge: 'Còn trống' },
  { id: 'r6-9', room: 5, row: 11, span: 1, title: 'Dự phòng', time: '16:00 - 17:00', booked: 0, total: 0, tone: 'open', badge: 'Còn trống' },
];

const todayAppointments = [
  { time: '08:00', label: 'BS. Lê Văn Nam', meta: 'Nội soi dạ dày - Phòng TT', status: 'Còn trống', tone: 'open' },
  { time: '09:30', label: 'Nội soi dạ dày - Phòng TT', meta: 'Ưu tiên', status: 'Ưu tiên', tone: 'priority' },
  { time: '10:00', label: 'BS. Nguyễn Thị Mai', meta: 'Phòng 101', status: 'Gần đầy', tone: 'near' },
  { time: '11:30', label: 'BS. Trần Văn Dũng', meta: 'Phòng 103', status: 'Đã đầy', tone: 'full' },
  { time: '13:00', label: 'BS. Phạm Quang Huy', meta: 'Phòng 105', status: 'Còn trống', tone: 'open' },
];

const hourlyLoad = [
  ['07h', 28],
  ['08h', 56],
  ['09h', 74],
  ['10h', 91],
  ['11h', 68],
  ['12h', 55],
  ['13h', 41],
  ['14h', 32],
  ['15h', 24],
  ['16h', 18],
];

function resolveProfile(department) {
  const name = String(department?.name || '').toLowerCase();
  return (
    departmentProfiles[department?.id] ||
    Object.values(departmentProfiles).find((profile) => name.includes(profile.shortName.toLowerCase())) ||
    fallbackProfile
  );
}

function getUtilizationTone(value) {
  if (value >= 90) return 'critical';
  if (value >= 76) return 'busy';
  if (value <= 45) return 'light';
  return 'normal';
}

function getUtilizationLabel(value) {
  if (value >= 90) return 'Quá tải';
  if (value >= 76) return 'Gần đầy';
  if (value <= 45) return 'Còn nhiều';
  return 'Hoạt động';
}

function hashId(value = '') {
  return String(value)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function buildDepartmentCards(departments, schedules, doctors) {
  return departments.map((department) => {
    const profile = resolveProfile(department);
    const departmentSchedules = schedules.filter(
      (schedule) => schedule.departmentId === department.id || schedule.department === department.name,
    );
    const totalSlots = departmentSchedules.reduce((sum, schedule) => sum + Number(schedule.totalSlots || 0), 0);
    const bookedSlots = departmentSchedules.reduce((sum, schedule) => sum + Number(schedule.bookedSlots || 0), 0);
    const availableSlots = departmentSchedules.reduce((sum, schedule) => sum + Number(schedule.availableSlots || 0), 0);
    const doctorCount =
      doctors.filter((doctor) => doctor.department === department.name).length ||
      departmentSchedules.reduce((set, schedule) => set.add(schedule.doctorId || schedule.doctor), new Set()).size ||
      profile.doctors;
    const utilization =
      totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : Math.round(Number(department.utilization || 0));

    return {
      ...profile,
      id: department.id,
      rawName: department.name,
      displayName: profile.displayName || `Khoa ${department.name}`,
      shortName: department.name,
      bookings: Number(department.bookings || bookedSlots || 0),
      totalSlots: totalSlots || 590,
      bookedSlots: bookedSlots || Math.round(((utilization || 72) / 100) * 590),
      availableSlots: availableSlots || Math.max(0, 590 - Math.round(((utilization || 72) / 100) * 590)),
      utilization: utilization || Number(department.utilization || 72),
      doctorCount,
      roomCount: Number(department.schedulesCount || profile.roomCount || 3),
      statusTone: getUtilizationTone(utilization || Number(department.utilization || 72)),
      statusLabel: getUtilizationLabel(utilization || Number(department.utilization || 72)),
    };
  });
}

function createRoomEvents(departmentId) {
  const offset = hashId(departmentId) % 4;
  return baseRoomEvents.map((event, index) => {
    if (event.total === 0) return { ...event, id: `${departmentId}-${event.id}` };
    const adjustment = (index + offset) % 5 === 0 ? -1 : offset === 2 ? 1 : 0;
    const booked = Math.max(0, Math.min(event.total, event.booked + adjustment));
    return { ...event, id: `${departmentId}-${event.id}`, booked };
  });
}

export function SchedulesByDepartmentPage() {
  const navigate = useNavigate();
  const { departments, doctors, error, schedules } = useSchedulingData();
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(departments[0]?.id || 'internal');
  const [activeView, setActiveView] = useState('room');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [notice, setNotice] = useState('');

  const departmentCards = useMemo(
    () => buildDepartmentCards(departments, schedules, doctors),
    [departments, doctors, schedules],
  );
  const selectedDepartment =
    departmentCards.find((department) => department.id === selectedDepartmentId) || departmentCards[0];
  const roomEvents = useMemo(
    () => createRoomEvents(selectedDepartment?.id || 'internal'),
    [selectedDepartment?.id],
  );
  const selectedEvent = roomEvents.find((event) => event.id === selectedEventId) || roomEvents[0];

  const scheduleTotal = roomEvents.reduce((sum, event) => sum + event.total, 0);
  const scheduleBooked = roomEvents.reduce((sum, event) => sum + event.booked, 0);
  const scheduleAvailable = Math.max(0, scheduleTotal - scheduleBooked);
  const fillRate = scheduleTotal > 0 ? Math.round((scheduleBooked / scheduleTotal) * 100) : selectedDepartment?.utilization || 0;

  function handleAction(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  if (!selectedDepartment) {
    return (
      <section className="department-dispatch-empty">
        <Hospital size={30} />
        <strong>Chưa có dữ liệu khoa</strong>
        <span>Vui lòng đồng bộ dữ liệu lịch khám hoặc tạo khoa trước khi xem lịch.</span>
      </section>
    );
  }

  const DepartmentIcon = selectedDepartment.icon || Hospital;

  return (
    <main className="department-dispatch-page">
      <section className="department-dispatch-top">
        <div className="department-dispatch-title">
          <span aria-hidden="true"><Building2 size={18} /></span>
          <div>
            <h1>Điều phối lịch theo khoa</h1>
            <p>Quản lý và tối ưu lịch khám theo từng khoa, phòng, bác sĩ và ca làm việc.</p>
          </div>
        </div>
        <div className="department-dispatch-actions">
          <button type="button" onClick={() => navigate('/scheduling/bulk-create')}>
            <UsersRound size={17} />
            Phân công lịch
          </button>
          <button type="button" className="is-primary" onClick={() => navigate('/scheduling/create')}>
            <Plus size={17} />
            Tạo lịch
          </button>
          <button type="button" onClick={() => handleAction('Đã mở bảng điều phối nhanh theo khoa.')}>
            <WandSparkles size={17} />
            Điều phối nhanh
          </button>
          <button type="button" onClick={() => handleAction('Đã chuẩn bị báo cáo lịch theo khoa.')}>
            <Download size={17} />
            Xuất báo cáo
          </button>
        </div>
      </section>

      {error ? (
        <section className="scheduling-sync-banner is-warning">
          <strong>Đang dùng dữ liệu mẫu</strong>
          <span>{error}</span>
        </section>
      ) : null}

      {notice ? (
        <section className="department-dispatch-toast">
          <BadgeCheck size={18} />
          <span>{notice}</span>
        </section>
      ) : null}

      <section className="department-picker-strip" aria-label="Chọn khoa">
        <div className="department-picker-row">
          {departmentCards.map((department) => {
            const Icon = department.icon || Hospital;
            return (
              <button
                key={department.id}
                type="button"
                className={`department-picker-card is-${department.tone} ${department.id === selectedDepartment.id ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedDepartmentId(department.id);
                  setSelectedEventId('');
                }}
              >
                <span className="department-picker-icon"><Icon size={28} /></span>
                <span>
                  <strong>{department.displayName}</strong>
                  <small>{department.status}</small>
                  <em className={`is-${department.statusTone}`}>{department.statusLabel}</em>
                </span>
                <i style={{ '--department-ring': `${department.utilization * 3.6}deg` }}>
                  <b>{department.utilization}%</b>
                </i>
                <small>{department.doctorCount} BS</small>
                <small>{department.roomCount} Phòng</small>
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Khoa tiếp theo"><ChevronRight size={18} /></button>
      </section>

      <section className="department-dispatch-layout">
        <div className="department-main-column">
          <section className="department-summary-band">
            <article className="department-hero-card">
              <div className="department-hero-media">
                <img src={selectedDepartment.image} alt="" />
                <button type="button" onClick={() => handleAction('Đang mở ảnh khu khám trong khoa.')}>
                  <Search size={14} />
                  Xem 12 ảnh
                </button>
              </div>
              <div className="department-hero-copy">
                <div>
                  <h2>{selectedDepartment.displayName}</h2>
                  <em className={`is-${selectedDepartment.statusTone}`}>{selectedDepartment.status}</em>
                </div>
                <span>Trưởng khoa</span>
                <strong>
                  <DepartmentIcon size={15} />
                  {selectedDepartment.manager}
                  <BadgeCheck size={15} />
                </strong>
                <div className="department-hero-meta">
                  <span><UsersRound size={15} /> {selectedDepartment.doctorCount} Bác sĩ</span>
                  <span><Building2 size={15} /> {selectedDepartment.roomCount} Phòng khám</span>
                  <span><Clock3 size={15} /> {selectedDepartment.hours}</span>
                </div>
                <div className="department-tags">
                  {selectedDepartment.tags.map((tag) => <b key={tag}>{tag}</b>)}
                </div>
              </div>
            </article>

            <div className="department-stat-grid">
              <article>
                <span>Tổng ca tuần</span>
                <strong>{numberFormatter.format(selectedDepartment.bookings || 1254)}</strong>
                <small className="is-up">+12% so với tuần trước</small>
              </article>
              <article>
                <span>Đã đặt</span>
                <strong>{numberFormatter.format(scheduleBooked)}</strong>
                <small>{fillRate}%</small>
              </article>
              <article>
                <span>Còn trống</span>
                <strong>{numberFormatter.format(scheduleAvailable)}</strong>
                <small>{100 - fillRate}%</small>
              </article>
              <article className="is-trend">
                <span>Tỷ lệ lấp đầy</span>
                <strong>{fillRate}%</strong>
                <small className="is-up">+5%</small>
                <svg viewBox="0 0 120 42" aria-hidden="true">
                  <polyline points="2,31 14,29 26,26 38,24 50,19 62,18 74,13 86,15 98,9 118,5" />
                </svg>
              </article>
              <article>
                <span>Telehealth</span>
                <strong>{selectedDepartment.telehealth}</strong>
                <small>12%</small>
              </article>
              <article>
                <span>No-show rate</span>
                <strong>{selectedDepartment.noShow}</strong>
                <small className="is-up">+0,6%</small>
              </article>
              <article>
                <span>Thời gian chờ TB</span>
                <strong>{selectedDepartment.avgTime}</strong>
                <small className="is-up">-2 phút</small>
              </article>
              <article>
                <span>Đánh giá hài lòng</span>
                <strong>{selectedDepartment.satisfaction}</strong>
                <small className="is-up">+0,2</small>
              </article>
            </div>
          </section>

          <section className="department-board-panel">
            <div className="department-board-tabs">
              {viewTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={activeView === tab.id ? 'is-active' : ''}
                    onClick={() => setActiveView(tab.id)}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="department-board-toolbar">
              <button type="button"><MoreHorizontal size={16} /> Mật độ</button>
              <div className="department-segmented">
                <button type="button" className="is-active">Ngày</button>
                <button type="button">Tuần</button>
              </div>
              <button type="button"><Filter size={16} /> Tất cả phòng</button>
              <button type="button"><ListChecks size={16} /> Sắp xếp: Thời gian</button>
              <button type="button" className="is-primary" onClick={() => navigate('/scheduling/create')}>
                <Plus size={16} />
                Tạo slot nhanh
              </button>
              <button type="button"><CalendarCheck2 size={16} /> Tác vụ hàng loạt</button>
              <button type="button"><ShieldCheck size={16} /> Kiểm tra xung đột</button>
              <button type="button" className="is-ai" onClick={() => handleAction('AI đang đề xuất phương án phân bổ lại phòng/ca.')}>
                <Sparkles size={16} />
                AI Tối ưu
              </button>
            </div>

            <div className="department-legend">
              <span><i className="is-open" /> Còn trống</span>
              <span><i className="is-near" /> Gần đầy</span>
              <span><i className="is-full" /> Đã đầy</span>
              <span><i className="is-telehealth" /> Telehealth</span>
              <span><i className="is-priority" /> Ưu tiên</span>
              <span><i className="is-rest" /> Nghỉ</span>
              <span><i className="is-locked" /> Đã khóa</span>
            </div>

            <div className="department-board-scroll">
              <div className="department-room-board">
                <div className="department-time-head">Giờ</div>
                {selectedDepartment.rooms.map((room, index) => (
                  <div key={room} className="department-room-head" style={{ gridColumn: index + 2 }}>
                    <strong>{room}</strong>
                    <span>{index === 3 ? 'Không giới hạn' : index === 4 ? '2 giờ + TT' : '4 giờ'}</span>
                  </div>
                ))}
                {timeRows.map((time, index) => (
                  <div key={time} className="department-time-cell" style={{ gridRow: index + 2, gridColumn: 1 }}>
                    {time}
                  </div>
                ))}
                <div className="department-now-marker" style={{ gridRow: 5, gridColumn: '1 / -1' }}>
                  <span>10:35</span>
                </div>
                {selectedDepartment.rooms.map((room, index) => (
                  <div
                    key={`${room}-lane`}
                    className="department-room-lane"
                    style={{ gridColumn: index + 2, gridRow: '2 / span 11' }}
                  />
                ))}
                {roomEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`department-room-event is-${event.tone} ${selectedEvent.id === event.id ? 'is-selected' : ''}`}
                    style={{ gridColumn: event.room + 2, gridRow: `${event.row} / span ${event.span}` }}
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <span>
                      <time>{event.time}</time>
                      <em>{event.booked}/{event.total || '-'}</em>
                    </span>
                    <strong>{event.title}</strong>
                    <small>{event.badge}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="department-side-column">
          <article className="department-side-card department-info-card">
            <header>
              <strong>Thông tin khoa</strong>
              <button type="button" aria-label="Tùy chọn"><MoreVertical size={16} /></button>
            </header>
            <div className="department-manager">
              <span><DepartmentIcon size={28} /></span>
              <div>
                <strong>{selectedDepartment.manager}</strong>
                <small>{selectedDepartment.title}</small>
              </div>
            </div>
            <div className="department-side-list">
              <span><UsersRound size={15} /> {selectedDepartment.doctorCount} Bác sĩ</span>
              <span><Building2 size={15} /> {selectedDepartment.roomCount} Phòng khám</span>
              <span><Phone size={15} /> Hotline khoa {selectedDepartment.hotline}</span>
              <span><Clock3 size={15} /> {selectedDepartment.hours}</span>
            </div>
            <button type="button" className="department-wide-button">Xem chi tiết <ArrowUpRight size={14} /></button>
          </article>

          <article className="department-side-card department-today-card">
            <header>
              <strong>Lịch hôm nay (22/04/2026)</strong>
              <button type="button" onClick={() => setActiveView('room')}>Xem tất cả</button>
            </header>
            <div className="department-today-list">
              {todayAppointments.map((appointment) => (
                <div key={`${appointment.time}-${appointment.label}`}>
                  <time>{appointment.time}</time>
                  <span>
                    <strong>{appointment.label}</strong>
                    <small>{appointment.meta}</small>
                  </span>
                  <em className={`is-${appointment.tone}`}>{appointment.status}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="department-side-card department-quick-actions">
            <header><strong>Thao tác nhanh</strong></header>
            <div>
              <button type="button" onClick={() => navigate('/scheduling/calendar')}><CalendarPlus size={18} />Sửa lịch</button>
              <button type="button" onClick={() => handleAction('Đã mở bảng đổi phòng.')}><Building2 size={18} />Đổi phòng</button>
              <button type="button" onClick={() => handleAction('Đã mở phân phối bác sĩ.')}><UsersRound size={18} />Điều phối BS</button>
              <button type="button" onClick={() => handleAction('Đã gửi nhắc lịch.')}><Bell size={18} />Gửi nhắc lịch</button>
              <button type="button" onClick={() => handleAction('Đã khóa lịch đã chọn.')}><LockKeyhole size={18} />Khóa lịch</button>
              <button type="button" onClick={() => handleAction('Đã bật ca Telehealth.')}><Video size={18} />Telehealth</button>
              <button type="button" onClick={() => handleAction('Đã mở ghi chú vận hành.')}><FileText size={18} />Ghi chú</button>
              <button type="button" onClick={() => handleAction('Đã gửi danh sách tới máy in.')}><Printer size={18} />In danh sách</button>
            </div>
          </article>

          <article className="department-side-card department-capacity-card">
            <header>
              <strong>Công suất hôm nay</strong>
              <span>{fillRate}%</span>
            </header>
            <i style={{ '--department-capacity': `${fillRate}%` }}><b /></i>
            <div>
              <span><strong>{numberFormatter.format(scheduleBooked)}</strong>Đã đặt</span>
              <span><strong>{numberFormatter.format(scheduleAvailable)}</strong>Còn trống</span>
              <span><strong>{numberFormatter.format(scheduleTotal)}</strong>Tổng ca</span>
            </div>
          </article>
        </aside>
      </section>

      <section className="department-analytics-row">
        <article>
          <span>Tổng bệnh nhân tuần này</span>
          <strong>{numberFormatter.format(selectedDepartment.bookings || 1254)}</strong>
          <small className="is-up">+12% so với tuần trước</small>
          <svg viewBox="0 0 120 38" aria-hidden="true">
            <polyline points="2,28 14,22 26,25 38,18 50,16 62,8 74,20 86,15 98,27 118,13" />
          </svg>
        </article>
        <article className="is-donut" style={{ '--department-donut': `${fillRate * 3.6}deg` }}>
          <span>Tỷ lệ lấp đầy</span>
          <div><strong>{fillRate}%</strong></div>
          <small>Đã đặt {numberFormatter.format(scheduleBooked)} - Còn trống {numberFormatter.format(scheduleAvailable)}</small>
        </article>
        <article>
          <span>No-show rate</span>
          <strong>{selectedDepartment.noShow}</strong>
          <small className="is-up">+0,6% so với tuần trước</small>
          <svg viewBox="0 0 120 38" aria-hidden="true">
            <polyline points="2,24 14,12 26,24 38,16 50,20 62,20 74,26 86,13 98,21 118,20" />
          </svg>
        </article>
        <article>
          <span>Thời gian chờ trung bình</span>
          <strong>{selectedDepartment.avgTime}</strong>
          <small className="is-up">-2 phút so với tuần trước</small>
          <svg viewBox="0 0 120 38" aria-hidden="true">
            <polyline points="2,24 14,16 26,28 38,19 50,27 62,10 74,23 86,12 98,26 118,18" />
          </svg>
        </article>
        <article className="is-peak">
          <span>Giờ cao điểm</span>
          <strong>10:00 - 11:00</strong>
          <small>Công suất lấp đầy cao: 92%</small>
          <i><b /></i>
        </article>
        <article className="is-bars">
          <span>Lịch hẹn theo giờ</span>
          <div>
            {hourlyLoad.map(([label, value]) => (
              <b key={label} style={{ '--department-hour': `${value}%` }}>
                <i />
                <small>{label}</small>
                <em>{value}</em>
              </b>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
