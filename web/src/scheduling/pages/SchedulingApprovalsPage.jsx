import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  FileClock,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  MoreVertical,
  PencilLine,
  RefreshCw,
  Send,
  ShieldCheck,
  TimerReset,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';

const KPI_CARDS = [
  {
    label: 'Chờ duyệt',
    value: '126',
    delta: '+12% so với tuần trước',
    tone: 'blue',
    icon: Clock3,
    sparkline: '2,28 14,24 25,30 36,18 48,12 60,25 72,20 84,10 96,27 108,15 120,30',
  },
  {
    label: 'Đã duyệt hôm nay',
    value: '84',
    delta: '+8% so với hôm qua',
    tone: 'green',
    icon: ShieldCheck,
    sparkline: '2,25 14,29 25,21 36,24 48,18 60,26 72,15 84,17 96,21 108,25 120,28',
  },
  {
    label: 'Đã xuất bản',
    value: '42',
    delta: '+5% so với hôm qua',
    tone: 'cyan',
    icon: Send,
    sparkline: '2,26 14,21 25,25 36,11 48,27 60,29 72,20 84,24 96,18 108,13 120,20',
  },
  {
    label: 'Bị từ chối',
    value: '11',
    delta: '-3% so với tuần trước',
    tone: 'red',
    icon: XCircle,
    sparkline: '2,22 14,18 25,28 36,15 48,24 60,14 72,26 84,16 96,22 108,15 120,24',
  },
  {
    label: 'Có xung đột',
    value: '9',
    delta: '+2% so với tuần trước',
    tone: 'orange',
    icon: AlertTriangle,
    sparkline: '2,27 14,16 25,24 36,29 48,20 60,27 72,24 84,18 96,14 108,17 120,22',
  },
  {
    label: 'Sắp hết hạn duyệt',
    value: '18',
    delta: '+4% so với hôm qua',
    tone: 'amber',
    icon: TimerReset,
    sparkline: '2,18 14,25 25,14 36,28 48,17 60,27 72,16 84,25 96,18 108,28 120,15',
  },
  {
    label: 'Tỷ lệ duyệt đúng hạn',
    value: '94%',
    delta: '+6% so với tuần trước',
    tone: 'violet',
    icon: CheckCircle2,
    sparkline: '2,25 14,20 25,24 36,15 48,28 60,18 72,26 84,15 96,25 108,14 120,23',
  },
  {
    label: 'Thời gian duyệt TB',
    value: '18 phút',
    delta: '-5% so với tuần trước',
    tone: 'sky',
    icon: CalendarClock,
    sparkline: '2,18 14,22 25,16 36,27 48,18 60,26 72,14 84,23 96,16 108,29 120,19',
  },
];

const STATUS_META = {
  pending: { label: 'Chờ duyệt', tone: 'blue' },
  approved: { label: 'Đã duyệt', tone: 'green' },
  revision: { label: 'Cần chỉnh sửa', tone: 'violet' },
  conflict: { label: 'Có xung đột', tone: 'orange' },
  rejected: { label: 'Từ chối', tone: 'red' },
};

const PRIORITY_META = {
  urgent: { label: 'Khẩn', tone: 'red' },
  high: { label: 'Cao', tone: 'orange' },
  medium: { label: 'Trung bình', tone: 'amber' },
  low: { label: 'Thấp', tone: 'green' },
};

const STATUS_TABS = [
  { id: 'all', label: 'Tất cả', count: 126 },
  { id: 'pending', label: 'Chờ duyệt', count: 126 },
  { id: 'approved', label: 'Đã duyệt', count: 84 },
  { id: 'revision', label: 'Cần chỉnh sửa', count: 15 },
  { id: 'conflict', label: 'Có xung đột', count: 9 },
  { id: 'rejected', label: 'Từ chối', count: 11 },
];

const REVIEW_ROWS = [
  {
    id: 'SCH250525-001',
    doctor: 'BS. Nguyễn Văn An',
    department: 'Tim mạch',
    room: 'PK Tim mạch 01 - Tầng 3',
    date: '20/05/2025',
    appliedDate: '20/05/2025 (Thứ Ba)',
    shift: 'Sáng (7:30 - 11:30)',
    slots: '20 slot (10 phút/slot)',
    type: 'Khám thường',
    createdBy: 'Phạm Thị Hường',
    status: 'pending',
    conflicts: 0,
    priority: 'high',
    deadline: '21/05/2025 23:59',
    reviewer: '-',
    avatar: '/images/scheduling/doctors/doctor-hanh.svg',
    tag: '',
    current: {
      date: '19/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '18 slot',
      slotTime: '15 phút',
      room: 'PK Tim mạch 01',
    },
    proposed: {
      date: '20/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '20 slot',
      slotTime: '10 phút',
      room: 'PK Tim mạch 01',
    },
    changes: ['+1 ngày', '=', '+2 slot', '-5 phút', '='],
  },
  {
    id: 'SCH250525-002',
    doctor: 'BS. Trần Thị Bình',
    department: 'Nội tiết',
    room: 'PK Nội tiết 02',
    date: '20/05/2025',
    appliedDate: '20/05/2025 (Thứ Ba)',
    shift: 'Chiều (13:30 - 17:00)',
    slots: '18 slot (12 phút/slot)',
    type: 'Khám thường',
    createdBy: 'Lê Minh Tuấn',
    status: 'conflict',
    conflicts: 2,
    priority: 'high',
    deadline: '21/05/2025 23:59',
    reviewer: '-',
    avatar: '/images/scheduling/doctors/doctor-lan.svg',
    tag: '',
    current: {
      date: '20/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '16 slot',
      slotTime: '15 phút',
      room: 'PK Nội tiết 01',
    },
    proposed: {
      date: '20/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '18 slot',
      slotTime: '12 phút',
      room: 'PK Nội tiết 02',
    },
    changes: ['=', '=', '+2 slot', '-3 phút', '+1 phòng'],
  },
  {
    id: 'SCH250525-003',
    doctor: 'BS. Lê Hoàng Nam',
    department: 'Ngoại tổng hợp',
    room: 'PK Ngoại tổng hợp 01',
    date: '20/05/2025',
    appliedDate: '20/05/2025 (Thứ Ba)',
    shift: 'Sáng (7:30 - 11:30)',
    slots: '20 slot (10 phút/slot)',
    type: 'Khám thường',
    createdBy: 'Nguyễn Thị Hoa',
    status: 'approved',
    conflicts: 0,
    priority: 'medium',
    deadline: '21/05/2025 23:59',
    reviewer: 'Admin',
    avatar: '/images/scheduling/doctors/doctor-khoa.svg',
    tag: '',
    current: {
      date: '19/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '18 slot',
      slotTime: '12 phút',
      room: 'PK Ngoại 01',
    },
    proposed: {
      date: '20/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '20 slot',
      slotTime: '10 phút',
      room: 'PK Ngoại 01',
    },
    changes: ['+1 ngày', '=', '+2 slot', '-2 phút', '='],
  },
  {
    id: 'SCH250525-004',
    doctor: 'BS. Phạm Thu Hà',
    department: 'Sản phụ khoa',
    room: 'PK Sản phụ khoa 02',
    date: '21/05/2025',
    appliedDate: '21/05/2025 (Thứ Tư)',
    shift: 'Chiều (13:30 - 17:00)',
    slots: '16 slot (12 phút/slot)',
    type: 'Khám thường',
    createdBy: 'Trần Văn Hùng',
    status: 'revision',
    conflicts: 0,
    priority: 'medium',
    deadline: '22/05/2025 23:59',
    reviewer: '-',
    avatar: '/images/scheduling/doctors/doctor-minh.svg',
    tag: '',
    current: {
      date: '21/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '16 slot',
      slotTime: '12 phút',
      room: 'PK Sản 01',
    },
    proposed: {
      date: '21/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '16 slot',
      slotTime: '12 phút',
      room: 'PK Sản 02',
    },
    changes: ['=', 'Đổi ca', '=', '=', '+1 phòng'],
  },
  {
    id: 'SCH250525-005',
    doctor: 'BS. Đỗ Minh Châu',
    department: 'Tai mũi họng',
    room: 'PK Tai mũi họng 01',
    date: '22/05/2025',
    appliedDate: '22/05/2025 (Thứ Năm)',
    shift: 'Sáng (7:30 - 11:30)',
    slots: '15 slot (15 phút/slot)',
    type: 'Khám thường',
    createdBy: 'Lê Minh Tuấn',
    status: 'rejected',
    conflicts: 1,
    priority: 'low',
    deadline: '23/05/2025 23:59',
    reviewer: 'Admin',
    avatar: '/images/scheduling/doctors/doctor-quang.svg',
    tag: 'Khẩn',
    current: {
      date: '22/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '15 slot',
      slotTime: '15 phút',
      room: 'PK TMH 01',
    },
    proposed: {
      date: '22/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '15 slot',
      slotTime: '15 phút',
      room: 'PK TMH 01',
    },
    changes: ['=', 'Đổi ca', '=', '=', '='],
  },
  {
    id: 'SCH250525-006',
    doctor: 'BS. Vũ Văn Minh',
    department: 'Nội soi',
    room: 'PK Nội soi 01',
    date: '22/05/2025',
    appliedDate: '22/05/2025 (Thứ Năm)',
    shift: 'Chiều (13:30 - 17:00)',
    slots: '12 slot (15 phút/slot)',
    type: 'Khám thường',
    createdBy: 'Ngô Thị Mai',
    status: 'approved',
    conflicts: 0,
    priority: 'low',
    deadline: '23/05/2025 23:59',
    reviewer: 'Admin',
    avatar: '/images/scheduling/doctors/doctor-ai-fallback.png',
    tag: '',
    current: {
      date: '22/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '10 slot',
      slotTime: '18 phút',
      room: 'PK Nội soi 01',
    },
    proposed: {
      date: '22/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '12 slot',
      slotTime: '15 phút',
      room: 'PK Nội soi 01',
    },
    changes: ['=', '=', '+2 slot', '-3 phút', '='],
  },
  {
    id: 'SCH250525-007',
    doctor: 'BS. Trần Văn Quân',
    department: 'Da liễu',
    room: 'PK Da liễu 02',
    date: '23/05/2025',
    appliedDate: '23/05/2025 (Thứ Sáu)',
    shift: 'Sáng (7:30 - 11:30)',
    slots: '20 slot (10 phút/slot)',
    type: 'Khám VIP',
    createdBy: 'Phạm Thị Hường',
    status: 'pending',
    conflicts: 0,
    priority: 'high',
    deadline: '24/05/2025 23:59',
    reviewer: '-',
    avatar: '/images/scheduling/doctors/doctor-hanh.svg',
    tag: 'VIP',
    current: {
      date: '23/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '18 slot',
      slotTime: '10 phút',
      room: 'PK Da liễu 01',
    },
    proposed: {
      date: '23/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '20 slot',
      slotTime: '10 phút',
      room: 'PK Da liễu 02',
    },
    changes: ['=', '=', '+2 slot', '=', '+1 phòng'],
  },
  {
    id: 'SCH250525-008',
    doctor: 'BS. Hoàng Quốc Bảo',
    department: 'Chẩn đoán hình ảnh',
    room: 'PK CĐHA 01',
    date: '23/05/2025',
    appliedDate: '23/05/2025 (Thứ Sáu)',
    shift: 'Chiều (13:30 - 17:00)',
    slots: '14 slot (15 phút/slot)',
    type: 'Telehealth',
    createdBy: 'Nguyễn Văn An',
    status: 'conflict',
    conflicts: 3,
    priority: 'medium',
    deadline: '24/05/2025 23:59',
    reviewer: '-',
    avatar: '/images/scheduling/doctors/doctor-lan.svg',
    tag: 'Tele',
    current: {
      date: '23/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '12 slot',
      slotTime: '15 phút',
      room: 'Online',
    },
    proposed: {
      date: '23/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '14 slot',
      slotTime: '15 phút',
      room: 'Online + PK CĐHA 01',
    },
    changes: ['=', '=', '+2 slot', '=', '+1 phòng'],
  },
  {
    id: 'SCH250525-009',
    doctor: 'BS. Lý Gia Bảo',
    department: 'Thần kinh',
    room: 'PK Thần kinh 01',
    date: '24/05/2025',
    appliedDate: '24/05/2025 (Thứ Bảy)',
    shift: 'Sáng (7:30 - 11:30)',
    slots: '16 slot (12 phút/slot)',
    type: 'Khám thường',
    createdBy: 'Trần Văn Hùng',
    status: 'revision',
    conflicts: 0,
    priority: 'low',
    deadline: '25/05/2025 23:59',
    reviewer: '-',
    avatar: '/images/scheduling/doctors/doctor-khoa.svg',
    tag: '',
    current: {
      date: '24/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '15 slot',
      slotTime: '12 phút',
      room: 'PK Thần kinh 01',
    },
    proposed: {
      date: '24/05/2025',
      shift: 'Sáng (7:30 - 11:30)',
      slots: '16 slot',
      slotTime: '12 phút',
      room: 'PK Thần kinh 01',
    },
    changes: ['=', '=', '+1 slot', '=', '='],
  },
  {
    id: 'SCH250525-010',
    doctor: 'BS. Phạm Minh Khang',
    department: 'Cơ xương khớp',
    room: 'PK Cơ xương khớp 01',
    date: '24/05/2025',
    appliedDate: '24/05/2025 (Thứ Bảy)',
    shift: 'Chiều (13:30 - 17:00)',
    slots: '18 slot (12 phút/slot)',
    type: 'Khám thường',
    createdBy: 'Lê Minh Tuấn',
    status: 'pending',
    conflicts: 0,
    priority: 'medium',
    deadline: '25/05/2025 23:59',
    reviewer: '-',
    avatar: '/images/scheduling/doctors/doctor-minh.svg',
    tag: '',
    current: {
      date: '24/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '16 slot',
      slotTime: '12 phút',
      room: 'PK CXK 01',
    },
    proposed: {
      date: '24/05/2025',
      shift: 'Chiều (13:30 - 17:00)',
      slots: '18 slot',
      slotTime: '12 phút',
      room: 'PK CXK 01',
    },
    changes: ['=', '=', '+2 slot', '=', '='],
  },
];

const DEPARTMENT_DEMAND = [
  { name: 'Tim mạch', value: 56 },
  { name: 'Nội tiết', value: 48 },
  { name: 'Sản phụ khoa', value: 42 },
  { name: 'Ngoại tổng hợp', value: 38 },
  { name: 'Tai mũi họng', value: 25 },
  { name: 'Khác', value: 23 },
];

const PUBLISH_TIMELINE = [
  { time: '08:00', title: 'Xuất bản lịch Tim mạch', detail: '20 lịch' },
  { time: '10:00', title: 'Xuất bản lịch BS. Nội tiết', detail: '18 lịch' },
  { time: '13:30', title: 'Xuất bản lịch Sản phụ khoa', detail: '22 lịch' },
  { time: '16:00', title: 'Xuất bản lịch Ngoại tổng hợp', detail: '16 lịch' },
];

const RISK_ALERTS = [
  { tone: 'red', title: '2 yêu cầu đang gần hạn', action: 'Xem ngay' },
  { tone: 'orange', title: '3 lịch sắp hết hạn duyệt', action: 'Xem ngay' },
  { tone: 'amber', title: '1 yêu cầu vi phạm quy tắc', action: 'Xem ngay' },
  { tone: 'red', title: '18 lịch chờ quá hạn duyệt', action: 'Xem ngay' },
];

const RECENT_ACTIVITIES = [
  { actor: 'Admin đã duyệt lịch', item: 'SCH250525-003', time: '10 phút trước', avatar: '/images/scheduling/admin-avatar.png' },
  { actor: 'Lê Minh Tuấn đã tạo lịch', item: 'SCH250525-002', time: '25 phút trước', avatar: '/images/scheduling/doctors/doctor-lan.svg' },
  { actor: 'Phạm Thị Hường tạo lịch mới', item: 'SCH250525-001', time: '45 phút trước', avatar: '/images/scheduling/doctors/doctor-hanh.svg' },
  { actor: 'Nguyễn Văn An từ chối lịch', item: 'SCH250525-005', time: '1 giờ trước', avatar: '/images/scheduling/doctors/doctor-khoa.svg' },
];

const AI_RECOMMENDATIONS = [
  { icon: AlertTriangle, title: 'Ưu tiên duyệt các lịch có nhãn "khẩn"', action: 'Xem 3 lịch' },
  { icon: CalendarDays, title: 'Gom 4 lịch cùng khoa Tim mạch để xuất bản batch.', action: 'Gom batch' },
  { icon: CheckCircle2, title: '2 lịch có thể tự động duyệt vì không có xung đột.', action: 'Xem chi tiết' },
];

const QUEUE_ITEMS = [
  {
    time: '20/05/2025 08:00',
    id: 'SCH250525-001',
    title: 'Lịch khám Tim mạch',
    doctor: 'BS. Nguyễn Văn An',
    department: 'Tim mạch',
    shift: 'Sáng (7:30 - 11:30)',
    slots: 20,
    status: 'Sắp tới',
  },
];

function Sparkline({ points, tone }) {
  return (
    <svg className={`approval-sparkline approval-sparkline--${tone}`} viewBox="0 0 122 34" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function Pill({ children, tone = 'blue' }) {
  return <span className={`approval-pill approval-pill--${tone}`}>{children}</span>;
}

function MiniSelect({ label, value, wide = false }) {
  return (
    <label className={`approval-filter-field${wide ? ' approval-filter-field--wide' : ''}`}>
      <span>{label}</span>
      <button type="button">
        {value}
        <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
      </button>
    </label>
  );
}

function IconButton({ label, icon: Icon, children, className = '', onClick }) {
  return (
    <button type="button" className={`approval-command ${className}`} onClick={onClick}>
      <Icon size={16} strokeWidth={2.35} aria-hidden="true" />
      {children || label}
    </button>
  );
}

function getAutoChecks(item) {
  return [
    {
      label: 'Trùng lịch bác sĩ',
      value: item.conflicts > 0 ? `${item.conflicts} xung đột cần xử lý` : 'Không xung đột',
      ok: item.conflicts === 0,
    },
    { label: 'Quá tải slot', value: 'Trong giới hạn (80%)', ok: true },
    { label: 'Vi phạm quy tắc', value: item.priority === 'high' ? 'Cần kiểm tra ưu tiên' : 'Không vi phạm', ok: item.priority !== 'high' },
    { label: 'Bác sĩ nghỉ phép', value: 'Không có lịch nghỉ', ok: true },
    { label: 'Phòng khám bận', value: item.conflicts >= 3 ? 'Phòng đang được giữ' : 'Phòng khả dụng', ok: item.conflicts < 3 },
  ];
}

function SchedulingTableRow({ row, selected, onSelect }) {
  const status = STATUS_META[row.status];
  const priority = PRIORITY_META[row.priority];

  return (
    <div
      className={`approval-table-row${selected ? ' is-selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(row.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(row.id);
        }
      }}
    >
      <span className="approval-table-check">
        <input type="checkbox" checked={selected} readOnly aria-label={`Chọn ${row.id}`} />
      </span>
      <span className="approval-schedule-id">
        {row.tag ? <em>{row.tag}</em> : null}
        <b>{row.id}</b>
      </span>
      <span className="approval-doctor-cell">
        <img src={row.avatar} alt="" />
        <span>{row.doctor}</span>
      </span>
      <span>{row.department}</span>
      <span>{row.date}</span>
      <span>{row.shift}</span>
      <span>{row.createdBy}</span>
      <span>
        <Pill tone={status.tone}>{status.label}</Pill>
      </span>
      <span>
        <Pill tone={row.conflicts > 0 ? 'red' : 'green'}>{row.conflicts}</Pill>
      </span>
      <span>
        <Pill tone={priority.tone}>{priority.label}</Pill>
      </span>
      <span>{row.deadline}</span>
      <span>{row.reviewer}</span>
      <span className="approval-row-actions">
        <button type="button" aria-label={`Xem ${row.id}`} onClick={(event) => event.stopPropagation()}>
          <Eye size={15} strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button type="button" aria-label={`Thêm thao tác ${row.id}`} onClick={(event) => event.stopPropagation()}>
          <MoreVertical size={15} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

export function SchedulingApprovalsPage() {
  const [rows, setRows] = useState(REVIEW_ROWS);
  const [selectedId, setSelectedId] = useState(REVIEW_ROWS[0].id);
  const [activeStatus, setActiveStatus] = useState('all');
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(true);

  const selected = rows.find((item) => item.id === selectedId) || rows[0];
  const selectedStatus = STATUS_META[selected.status];

  const visibleRows = useMemo(() => {
    if (activeStatus === 'all') return rows;
    return rows.filter((item) => item.status === activeStatus);
  }, [activeStatus, rows]);

  const distribution = useMemo(
    () => [
      { label: 'Chờ duyệt', value: 126, percent: 37, tone: 'blue' },
      { label: 'Đã duyệt', value: 84, percent: 25, tone: 'green' },
      { label: 'Cần chỉnh sửa', value: 15, percent: 4, tone: 'violet' },
      { label: 'Có xung đột', value: 9, percent: 3, tone: 'orange' },
      { label: 'Từ chối', value: 11, percent: 3, tone: 'red' },
      { label: 'Khác', value: 85, percent: 26, tone: 'slate' },
    ],
    [],
  );

  const comparisonRows = [
    ['Ngày áp dụng', selected.current.date, selected.proposed.date, selected.changes[0]],
    ['Ca khám', selected.current.shift, selected.proposed.shift, selected.changes[1]],
    ['Số slot', selected.current.slots, selected.proposed.slots, selected.changes[2]],
    ['Thời gian/slot', selected.current.slotTime, selected.proposed.slotTime, selected.changes[3]],
    ['Phòng khám', selected.current.room, selected.proposed.room, selected.changes[4]],
  ];

  const autoChecks = getAutoChecks(selected);

  function updateSelectedStatus(nextStatus) {
    setRows((currentRows) =>
      currentRows.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              status: nextStatus,
              reviewer: nextStatus === 'pending' ? '-' : 'Admin',
            }
          : item,
      ),
    );
  }

  function handleSelectRow(rowId) {
    setSelectedId(rowId);
    setIsReviewPanelOpen(true);
  }

  return (
    <main className="approval-dashboard-page">
      <div className={`approval-dashboard-layout${isReviewPanelOpen ? '' : ' is-review-closed'}`}>
        <section className="approval-main">
          <header className="approval-page-head">
            <div>
              <h1>Duyệt &amp; xuất bản lịch khám</h1>
              <p>Kiểm duyệt, xác minh và công bố lịch làm việc của bác sĩ trước khi áp dụng toàn hệ thống.</p>
            </div>
            <button type="button" className="approval-help-button">
              <HelpCircle size={16} strokeWidth={2.25} aria-hidden="true" />
              Hướng dẫn
            </button>
          </header>

          <section className="approval-kpi-grid" aria-label="Chỉ số kiểm duyệt lịch khám">
            {KPI_CARDS.map((item) => {
              const Icon = item.icon;

              return (
                <article className={`approval-kpi-card approval-kpi-card--${item.tone}`} key={item.label}>
                  <div>
                    <span className="approval-kpi-icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={2.3} />
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <strong>{item.value}</strong>
                  <small>{item.delta}</small>
                  <Sparkline points={item.sparkline} tone={item.tone} />
                </article>
              );
            })}
          </section>

          <section className="approval-toolbar" aria-label="Thao tác duyệt và xuất bản">
            <div className="approval-toolbar__primary">
              <IconButton icon={Check} className="approval-command--primary">
                Duyệt hàng loạt
              </IconButton>
              <IconButton icon={Send}>Xuất bản ngay</IconButton>
              <IconButton icon={CalendarClock}>Lên lịch xuất bản</IconButton>
              <IconButton icon={FileSpreadsheet}>Xuất Excel</IconButton>
              <IconButton icon={FileClock}>Nhật ký kiểm duyệt</IconButton>
            </div>
            <div className="approval-toolbar__secondary">
              <button type="button">
                Hành động nhanh
                <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
              </button>
              <button type="button">
                Workflow: 2 cấp duyệt
                <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
              </button>
            </div>
          </section>

          <section className="approval-table-card">
            <nav className="approval-status-tabs" aria-label="Trạng thái kiểm duyệt">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={activeStatus === tab.id ? 'is-active' : ''}
                  onClick={() => setActiveStatus(tab.id)}
                >
                  {tab.label}
                  <span>{tab.count}</span>
                </button>
              ))}
            </nav>

            <div className="approval-filters">
              <MiniSelect label="Trạng thái" value="Tất cả" />
              <MiniSelect label="Khoa" value="Tất cả khoa" />
              <MiniSelect label="Bác sĩ" value="Tất cả bác sĩ" />
              <MiniSelect label="Người gửi" value="Tất cả người gửi" />
              <MiniSelect label="Ưu tiên" value="Tất cả mức" />
              <MiniSelect label="Thời gian" value="20/05/2025 - 26/05/2025" wide />
              <button type="button" className="approval-filter-action">
                <Filter size={15} strokeWidth={2.25} aria-hidden="true" />
                Bộ lọc
              </button>
              <button type="button" className="approval-filter-action">
                <RefreshCw size={15} strokeWidth={2.25} aria-hidden="true" />
                Đặt lại
              </button>
            </div>

            <div className="approval-table-wrap">
              <div className="approval-table-head" role="row">
                <span>
                  <input type="checkbox" aria-label="Chọn tất cả" />
                </span>
                <span>Mã lịch</span>
                <span>Bác sĩ</span>
                <span>Khoa</span>
                <span>Ngày áp dụng</span>
                <span>Ca/khung giờ</span>
                <span>Người tạo</span>
                <span>Trạng thái kiểm duyệt</span>
                <span>Xung đột</span>
                <span>Ưu tiên</span>
                <span>Hạn duyệt</span>
                <span>Người duyệt</span>
                <span>Hành động</span>
              </div>

              {visibleRows.map((row) => (
                <SchedulingTableRow
                  key={row.id}
                  row={row}
                  selected={row.id === selected.id}
                  onSelect={handleSelectRow}
                />
              ))}
            </div>

            <footer className="approval-table-footer">
              <span>Hiển thị 1 đến 10 của 126 kết quả</span>
              <div className="approval-pagination" aria-label="Phân trang">
                <button type="button" disabled>
                  ‹
                </button>
                <button type="button" className="is-active">
                  1
                </button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button">4</button>
                <button type="button">5</button>
                <button type="button">...</button>
                <button type="button">13</button>
                <button type="button">›</button>
              </div>
              <button type="button" className="approval-page-size">
                10 / trang
                <ChevronDown size={13} strokeWidth={2.35} aria-hidden="true" />
              </button>
            </footer>
          </section>

          <section className="approval-insight-grid" aria-label="Tổng hợp kiểm duyệt">
            <article className="approval-insight-card approval-flow-card">
              <h2>Quy trình kiểm duyệt</h2>
              <div className="approval-flow-steps">
                {[
                  ['Tạo yêu cầu', 256, 'blue'],
                  ['Chờ duyệt', 126, 'orange'],
                  ['Đang duyệt', 84, 'green'],
                  ['Đã xuất bản', 42, 'cyan'],
                ].map(([label, value, tone], index) => (
                  <div key={label} className={`approval-flow-step approval-flow-step--${tone}`}>
                    <i>{index + 1}</i>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="approval-progress">
                <span>Tỷ lệ hoàn thành</span>
                <b>67%</b>
                <em>
                  <i style={{ width: '67%' }} />
                </em>
              </div>
            </article>

            <article className="approval-insight-card approval-donut-card">
              <h2>Phân bố trạng thái kiểm duyệt</h2>
              <div className="approval-donut-layout">
                <div className="approval-donut" aria-label="Tổng 339 lịch">
                  <strong>Tổng</strong>
                  <b>339</b>
                </div>
                <div className="approval-donut-legend">
                  {distribution.map((item) => (
                    <span key={item.label}>
                      <i className={`approval-dot approval-dot--${item.tone}`} />
                      {item.label}
                      <b>
                        {item.value} ({item.percent}%)
                      </b>
                    </span>
                  ))}
                </div>
              </div>
            </article>

            <article className="approval-insight-card">
              <div className="approval-card-headline">
                <h2>Yêu cầu theo khoa</h2>
                <button type="button">Xem chi tiết</button>
              </div>
              <div className="approval-demand-list">
                {DEPARTMENT_DEMAND.map((item) => (
                  <div key={item.name}>
                    <span>{item.name}</span>
                    <em>
                      <i style={{ width: `${item.value}%` }} />
                    </em>
                    <b>{item.value}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="approval-insight-card">
              <h2>Lịch xuất bản hôm nay</h2>
              <div className="approval-publish-timeline">
                {PUBLISH_TIMELINE.map((item) => (
                  <div key={`${item.time}-${item.title}`}>
                    <time>{item.time}</time>
                    <i />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </div>
                ))}
              </div>
              <button type="button" className="approval-text-link">
                Xem tất cả lịch xuất bản
              </button>
            </article>
          </section>

          <section className="approval-secondary-grid">
            <article className="approval-insight-card">
              <h2>Cảnh báo &amp; rủi ro</h2>
              <div className="approval-risk-list">
                {RISK_ALERTS.map((item) => (
                  <div key={item.title} className={`approval-risk approval-risk--${item.tone}`}>
                    <AlertTriangle size={17} strokeWidth={2.25} aria-hidden="true" />
                    <span>{item.title}</span>
                    <button type="button">{item.action}</button>
                  </div>
                ))}
              </div>
            </article>

            <article className="approval-insight-card">
              <div className="approval-card-headline">
                <h2>Hoạt động gần đây</h2>
                <button type="button">Xem tất cả</button>
              </div>
              <div className="approval-activity-list">
                {RECENT_ACTIVITIES.map((item) => (
                  <div key={`${item.actor}-${item.item}`}>
                    <img src={item.avatar} alt="" />
                    <span>
                      <strong>{item.actor}</strong>
                      <small>{item.item}</small>
                    </span>
                    <time>{item.time}</time>
                  </div>
                ))}
              </div>
            </article>

            <article className="approval-insight-card">
              <h2>Khuyến nghị AI</h2>
              <div className="approval-ai-list">
                {AI_RECOMMENDATIONS.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.title}>
                      <span>
                        <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
                      </span>
                      <p>{item.title}</p>
                      <button type="button">{item.action}</button>
                    </div>
                  );
                })}
              </div>
            </article>
          </section>

          <section className="approval-queue-card">
            <div className="approval-card-headline">
              <h2>Lịch xuất bản sắp tới (Queue)</h2>
              <button type="button">Xem tất cả queue</button>
            </div>
            <div className="approval-queue-layout">
              <div className="approval-queue-table">
                <div className="approval-queue-head">
                  <span>Thời gian xuất bản</span>
                  <span>Mã lịch</span>
                  <span>Nội dung</span>
                  <span>Bác sĩ</span>
                  <span>Khoa</span>
                  <span>Ca/khung giờ</span>
                  <span>Số slot</span>
                  <span>Trạng thái</span>
                </div>
                {QUEUE_ITEMS.map((item) => (
                  <div key={item.id} className="approval-queue-row">
                    <span>{item.time}</span>
                    <b>{item.id}</b>
                    <span>{item.title}</span>
                    <span>{item.doctor}</span>
                    <span>{item.department}</span>
                    <span>{item.shift}</span>
                    <span>{item.slots}</span>
                    <Pill tone="amber">{item.status}</Pill>
                  </div>
                ))}
              </div>
              <div className="approval-queue-stats">
                <div>
                  <span>Tổng lịch trong queue</span>
                  <strong>18</strong>
                </div>
                <div>
                  <span>Sẽ xuất bản hôm nay</span>
                  <strong>5</strong>
                </div>
                <div>
                  <span>Sẽ xuất bản ngày mai</span>
                  <strong>13</strong>
                </div>
              </div>
            </div>
          </section>
        </section>

        {isReviewPanelOpen ? (
        <aside className="approval-review-panel" aria-label="Chi tiết lịch cần duyệt">
          <header className="approval-review-head">
            <div>
              <h2>Chi tiết lịch cần duyệt</h2>
              <strong>{selected.id}</strong>
            </div>
            <div>
              <Pill tone={selectedStatus.tone}>{selectedStatus.label}</Pill>
              <button type="button" aria-label="Đóng chi tiết" onClick={() => setIsReviewPanelOpen(false)}>
                <X size={16} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </div>
          </header>

          <nav className="approval-detail-tabs" aria-label="Chi tiết kiểm duyệt">
            <button type="button" className="is-active">
              Thông tin lịch
            </button>
            <button type="button">Lịch sử kiểm duyệt</button>
          </nav>

          <section className="approval-detail-section">
            <h3>Thông tin lịch</h3>
            <dl className="approval-detail-list">
              <div>
                <dt>Bác sĩ</dt>
                <dd>{selected.doctor}</dd>
              </div>
              <div>
                <dt>Khoa</dt>
                <dd>{selected.department}</dd>
              </div>
              <div>
                <dt>Phòng khám</dt>
                <dd>{selected.room}</dd>
              </div>
              <div>
                <dt>Ngày áp dụng</dt>
                <dd>{selected.appliedDate}</dd>
              </div>
              <div>
                <dt>Ca/khung giờ</dt>
                <dd>{selected.shift}</dd>
              </div>
              <div>
                <dt>Số slot</dt>
                <dd>{selected.slots}</dd>
              </div>
              <div>
                <dt>Loại lịch</dt>
                <dd>
                  <span className="approval-blue-dot" />
                  {selected.type}
                </dd>
              </div>
            </dl>
          </section>

          <section className="approval-detail-section">
            <h3>So sánh thay đổi</h3>
            <div className="approval-compare-table">
              <div>
                <span>Nội dung</span>
                <span>Phiên bản hiện tại</span>
                <span>Đề xuất mới</span>
                <span>Thay đổi</span>
              </div>
              {comparisonRows.map(([label, current, proposed, change]) => (
                <div key={label}>
                  <span>{label}</span>
                  <span>{current}</span>
                  <span>{proposed}</span>
                  <b className={String(change).startsWith('+') ? 'is-positive' : String(change).startsWith('-') ? 'is-negative' : ''}>
                    {change}
                  </b>
                </div>
              ))}
            </div>
          </section>

          <section className="approval-detail-section">
            <h3>Kiểm tra tự động</h3>
            <div className="approval-auto-checks">
              {autoChecks.map((item) => (
                <div key={item.label} className={item.ok ? 'is-ok' : 'is-warning'}>
                  {item.ok ? (
                    <CheckCircle2 size={15} strokeWidth={2.35} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={15} strokeWidth={2.35} aria-hidden="true" />
                  )}
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="approval-detail-section">
            <h3>Ghi chú của người duyệt</h3>
            <label className="approval-note-box">
              <textarea placeholder="Nhập ghi chú, nhận xét (nếu có)..." maxLength={500} />
              <span>0/500</span>
            </label>
          </section>

          <footer className="approval-review-actions">
            <button type="button" className="is-approve" onClick={() => updateSelectedStatus('approved')}>
              <Check size={16} strokeWidth={2.4} aria-hidden="true" />
              Phê duyệt
            </button>
            <button type="button" className="is-revision" onClick={() => updateSelectedStatus('revision')}>
              <PencilLine size={16} strokeWidth={2.25} aria-hidden="true" />
              Yêu cầu chỉnh sửa
            </button>
            <button type="button" className="is-reject" onClick={() => updateSelectedStatus('rejected')}>
              <X size={16} strokeWidth={2.35} aria-hidden="true" />
              Từ chối
            </button>
            <button type="button" className="is-publish" onClick={() => updateSelectedStatus('approved')}>
              <UploadCloud size={16} strokeWidth={2.25} aria-hidden="true" />
              Xuất bản ngay
            </button>
          </footer>

          <div className="approval-panel-footnote">
            <Bot size={15} strokeWidth={2.25} aria-hidden="true" />
            AI đã kiểm tra xung đột lịch, phòng khám, nghỉ phép và quy tắc slot.
          </div>
        </aside>
        ) : null}
      </div>
    </main>
  );
}
