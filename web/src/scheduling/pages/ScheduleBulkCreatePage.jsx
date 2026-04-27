import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Bot,
  Brain,
  CalendarCog,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Database,
  FileSpreadsheet,
  Download,
  Eye,
  HeartPulse,
  Info,
  Layers3,
  LoaderCircle,
  Mic,
  Plus,
  Save,
  Search,
  SendHorizontal,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Timer,
  UploadCloud,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSchedulingData } from '../context/SchedulingDataContext';

const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6'];
const allWeekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const doctorAvatarMap = {
  'dr-minh': '/images/scheduling/doctors/doctor-minh.svg',
  'dr-lan': '/images/scheduling/doctors/doctor-lan.svg',
  'dr-khoa': '/images/scheduling/doctors/doctor-khoa.svg',
  'dr-hanh': '/images/scheduling/doctors/doctor-hanh.svg',
  'dr-quang': '/images/scheduling/doctors/doctor-quang.svg',
};
const fallbackDoctorAvatars = [
  '/images/scheduling/doctors/doctor-minh.svg',
  '/images/scheduling/doctors/doctor-lan.svg',
  '/images/scheduling/doctors/doctor-khoa.svg',
];

const bulkAllocationDoctors = [
  {
    id: 'bulk-cong',
    name: 'TS.BS. Vũ Thành Công',
    department: 'Tim mạch',
    avatar: '/images/scheduling/doctors/doctor-minh.svg',
    growth: '+48 slot/ngày',
  },
  {
    id: 'bulk-anh',
    name: 'BS. Trần Minh Anh',
    department: 'Tim mạch',
    avatar: '/images/scheduling/doctors/doctor-lan.svg',
    growth: '+48 slot/ngày',
  },
  {
    id: 'bulk-nam',
    name: 'BS. Lê Hoàng Nam',
    department: 'Tim mạch',
    avatar: '/images/scheduling/doctors/doctor-quang.svg',
    growth: '+48 slot/ngày',
  },
  {
    id: 'bulk-ha',
    name: 'BS. Phạm Thu Hà',
    department: 'Tim mạch',
    avatar: '/images/scheduling/doctors/doctor-hanh.svg',
    growth: '+48 slot/ngày',
  },
];

const extraBulkDoctorOptions = [
  {
    id: 'bulk-phuong',
    name: 'BS. Nguyễn Mai Phương',
    department: 'Nhi khoa',
    avatar: '/images/scheduling/doctors/doctor-khoa.svg',
    growth: '+36 slot/ngày',
  },
  {
    id: 'bulk-tuan',
    name: 'BS. Đỗ Minh Tuấn',
    department: 'Nội tổng quát',
    avatar: '/images/scheduling/doctors/doctor-quang.svg',
    growth: '+40 slot/ngày',
  },
];

const bulkDoctorOptions = [...bulkAllocationDoctors, ...extraBulkDoctorOptions];

const weeklyPreviewDays = [
  ['T2', '26/04', 'morning'],
  ['T3', '27/04', 'afternoon'],
  ['T4', '28/04', 'morning'],
  ['T5', '29/04', 'balanced'],
  ['T6', '30/04', 'morning'],
  ['T7', '01/05', 'off'],
  ['CN', '02/05', 'off'],
  ['T2', '03/05', 'morning'],
  ['T3', '04/05', 'afternoon'],
  ['T4', '05/05', 'balanced'],
  ['T5', '06/05', 'morning'],
  ['T6', '07/05', 'balanced'],
  ['T7', '08/05', 'off'],
  ['CN', '10/05', 'off'],
];

const rangePreviewDays = [
  ['T6', '01/05', 'morning'],
  ['CN', '03/05', 'off'],
  ['T3', '05/05', 'afternoon'],
  ['T5', '07/05', 'balanced'],
  ['T7', '09/05', 'morning'],
  ['T2', '11/05', 'balanced'],
  ['T4', '13/05', 'afternoon'],
  ['T6', '15/05', 'balanced'],
  ['CN', '17/05', 'off'],
  ['T3', '19/05', 'morning'],
  ['T5', '21/05', 'balanced'],
  ['T7', '23/05', 'afternoon'],
  ['T2', '25/05', 'morning'],
  ['T4', '27/05', 'balanced'],
  ['T6', '29/05', 'afternoon'],
  ['CN', '31/05', 'balanced'],
];

const dateRangePreviewDays = Array.from({ length: 31 }, (_, index) => {
  const date = index + 1;
  const weekday = ['T6', 'T7', 'CN', 'T2', 'T3', 'T4', 'T5'][index % 7];
  const label = `${String(date).padStart(2, '0')}/05`;
  const isOff = [2, 10, 17, 24, 31].includes(date);
  const mode = isOff ? 'off' : date % 5 === 0 ? 'balanced' : date % 2 === 0 ? 'afternoon' : 'morning';

  return [weekday, label, mode];
});

const copySourceDays = [
  ['T2', '28/04', '07:30', '11:30', 'morning'],
  ['T3', '29/04', '07:30', '11:30', 'morning'],
  ['T4', '30/04', '07:30', '11:30', 'morning'],
  ['T5', '01/05', 'Nghỉ lễ', '', 'off'],
  ['T6', '02/05', '07:30', '11:30', 'morning'],
  ['T7', '03/05', '07:30', '11:30', 'morning'],
  ['CN', '04/05', '07:30', '11:30', 'morning'],
];

const copyPreviewColumns = [
  ['T2', '05/05'],
  ['T3', '06/05'],
  ['T4', '07/05'],
  ['T5', '08/05'],
  ['T6', '09/05'],
  ['T7', '10/05'],
  ['CN', '11/05'],
];
const copyPreviewTimes = ['07:30', '11:30', '13:30', '17:30', '19:00'];

const excelPreviewRows = [
  ['1', '28/04/2026', 'BS. Trần Minh Anh', 'Tim mạch', 'Khám tim mạch', '07:30 - 11:30', '8', 'Hợp lệ', 'valid'],
  ['2', '28/04/2026', 'BS. Lê Hoàng Nam', 'Tim mạch', 'Khám tim mạch', '13:30 - 17:30', '8', 'Hợp lệ', 'valid'],
  ['3', '28/04/2026', 'BS. Phạm Thu Hà', 'Nhi khoa', 'Khám nhi', '07:30 - 11:30', '10', 'Cảnh báo', 'warning'],
  ['4', '29/04/2026', 'BS. Vũ Thành Công', 'Tai mũi họng', 'Khám tai mũi họng', '07:30 - 11:30', '8', 'Hợp lệ', 'valid'],
  ['5', '29/04/2026', 'BS. Trần Minh Anh', 'Tim mạch', 'Khám tim mạch', '13:30 - 17:30', '8', 'Lỗi', 'error'],
];

const excelDoctorDistribution = [
  ['BS. Trần Minh Anh', '2.560 (21%)', '#2563eb'],
  ['BS. Lê Hoàng Nam', '2.240 (18%)', '#14b8a6'],
  ['BS. Phạm Thu Hà', '1.920 (16%)', '#7c3aed'],
  ['BS. Vũ Thành Công', '1.600 (13%)', '#f97316'],
  ['Khác (14 bác sĩ)', '3.860 (32%)', '#a78bfa'],
];

const aiAssistantPrompts = [
  ['Tạo lịch cho tất cả bác sĩ', '01/05 - 31/05'],
  ['Ưu tiên BS > 5 năm KN', 'Buổi sáng'],
  ['Ca sáng 07:30 - 11:30', 'Tối đa 28 buổi/ngày'],
  ['Tránh trùng ca', 'đảm bảo nghỉ cuối tuần'],
];

const aiAssistantPromptIcons = [Stethoscope, ShieldCheck, CalendarDays, ClipboardList];

const initialAiChatMessages = [
  {
    id: 'ai-welcome',
    role: 'assistant',
    title: 'Xin chào Admin!',
    content: 'Tôi sẽ giúp bạn tạo lịch hàng loạt tối ưu cho 18 bác sĩ và 8 khoa phòng.',
    time: '09:30',
  },
];

const aiProcessingSteps = [
  {
    title: 'Đọc dữ liệu',
    copy: '18 bác sĩ, 8 khoa',
    icon: Database,
    tone: 'data',
  },
  {
    title: 'Phân tích ràng buộc',
    copy: 'Ca kíp, ngày nghỉ',
    icon: ShieldCheck,
    tone: 'rules',
  },
  {
    title: 'Tối ưu xếp lịch',
    copy: 'AI Genetic Algorithm',
    icon: WandSparkles,
    tone: 'optimize',
  },
  {
    title: 'Kiểm tra xung đột',
    copy: 'Trùng ca, quá tải',
    icon: CalendarCheck2,
    tone: 'conflict',
  },
  {
    title: 'Tính điểm hiệu suất',
    copy: 'Cân bằng công việc',
    icon: Activity,
    tone: 'score',
  },
];

const aiTimelineDays = [
  ['T6', '01'],
  ['T7', '02'],
  ['CN', '03'],
  ['T2', '04'],
  ['T3', '05'],
  ['T4', '06'],
  ['T5', '07'],
  ['T6', '08'],
  ['T7', '09'],
  ['CN', '10'],
  ['T2', '11'],
  ['T3', '12'],
  ['T4', '13'],
  ['T5', '14'],
  ['T6', '15'],
  ['T7', '16'],
];

const aiDepartmentRows = [
  {
    department: 'Khoa Nhi',
    doctors: ['BS. Lê sĩ', 'BS. Kiệt', 'BS. Xu đi'],
    blocks: [
      ['BS. Trần Minh Anh', '07:30 - 11:30 · Phòng 01', 0, 2, 'teal'],
      ['BS. Lê Hoàng Nam', '13:30 - 17:30 · Phòng 02', 1, 2, 'blue'],
      ['BS. Lê Hoàng Nhật', '07:30 - 11:30 · Phòng 01', 7, 2, 'teal'],
      ['BS. Lê Hoàng Nam', '13:30 - 17:30 · Phòng 02', 8, 2, 'blue'],
      ['BS. Lê Hoàng Nam', '07:30 - 11:30 · Phòng 02', 11, 2, 'teal'],
      ['BS. Lê Thành', '07:30 - 11:30 · Phòng 04', 13, 2, 'blue'],
    ],
  },
  {
    department: 'Khoa Tim mạch',
    doctors: ['BS. Đức', 'BS. Hòa', 'BS. Khôi'],
    blocks: [
      ['BS. Phạm Thu Hà', '07:30 - 11:30 · Phòng 03', 2, 2, 'violet'],
      ['BS. Vũ Thành Công', '13:30 - 17:30 · Phòng 04', 2, 2, 'pink'],
      ['BS. Vũ Thành Công', '13:30 - 17:30 · Phòng 06', 8, 2, 'violet'],
      ['BS. Vũ Thành Công', '13:30 - 17:30 · Phòng 04', 9, 2, 'pink'],
      ['BS. Trần Phúc', '07:30 - 11:30 · Phòng 02', 13, 2, 'blue'],
    ],
  },
  {
    department: 'Khoa Da liễu',
    doctors: ['BS. Kiều Hân', 'BS. Hồng', 'BS. Khả Ngọc'],
    blocks: [
      ['BS. Nguyễn Thùy Linh', '07:30 - 11:30 · Phòng 05', 4, 2, 'amber'],
      ['BS. Nguyễn Thùy Linh', '07:30 - 11:30 · Phòng 05', 7, 2, 'amber'],
      ['BS. Nguyễn Thùy Linh', '07:30 - 11:30 · Phòng 05', 11, 3, 'amber'],
      ['BS. Lê Thành Công', '07:30 - 11:30 · Phòng 08', 5, 2, 'blue'],
      ['BS. Lê Hoàng', '13:30 - 11:30', 9, 2, 'blue'],
      ['BS. Lê Thành Công', '13:30 - 11:30 · Phòng 05', 12, 2, 'blue'],
    ],
  },
];

const aiPreviewViewModes = [
  { id: 'week', label: 'Tuần', days: 7 },
  { id: 'month', label: 'Tháng', days: 16 },
  { id: 'gantt', label: 'Gantt', days: 16 },
];

const aiAutomationRules = [
  { id: 'balance', label: 'Tự cân bằng ca kíp', icon: SlidersHorizontal },
  { id: 'conflict', label: 'Tránh trùng lịch khám', icon: ShieldCheck },
  { id: 'rest', label: 'Đảm bảo ngày nghỉ', icon: CalendarCheck2 },
  { id: 'senior', label: 'Ưu tiên bác sĩ chính', icon: Stethoscope },
  { id: 'dispatch', label: 'Gợi ý điều phối nhân sự', icon: UsersRound },
];

const initialAiSessionHistory = [
  { id: 'history-24-04', title: 'Phiên 24/04 · 10:32', copy: 'Tạo lịch khoa Nhi (31 ngày)', prompt: 'Tạo lịch khoa Nhi' },
  { id: 'history-23-04', title: 'Phiên 23/04 · 14:20', copy: 'Cân bằng ca toàn hệ thống', prompt: 'Cân bằng ca toàn hệ thống' },
  { id: 'history-22-04', title: 'Phiên 22/04 · 09:15', copy: 'Tối ưu lịch BS Tim mạch', prompt: 'Tối ưu lịch BS Tim mạch' },
];

const previewDotMap = {
  morning: ['is-morning', 'is-morning', 'is-morning'],
  afternoon: ['is-afternoon', 'is-afternoon', 'is-afternoon'],
  balanced: ['is-morning', 'is-afternoon', 'is-extra'],
};

const doctorGroupOptions = [
  '12 bác sĩ đã chọn',
  '5 bác sĩ Tim mạch',
  'Tất cả bác sĩ đang rảnh',
  'Theo danh sách phân bổ',
];

const departmentOptions = ['Tim mạch', 'Nội tổng quát', 'Nhi khoa', 'Da liễu', 'Cơ xương khớp'];
const scheduleTypeOptions = ['Lịch khám', 'Tái khám', 'Tư vấn online', 'Khám ngoài giờ'];
const timeOptions = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:30', '13:30', '17:30'];
const slotDurationOptions = ['10 phút', '15 phút', '20 phút', '30 phút'];
const slotCapacityOptions = ['4 slot', '6 slot', '8 slot', '10 slot', '12 slot'];
const repeatFrequencyOptions = ['Hàng ngày', 'Hàng tuần', 'Hai tuần/lần', 'Hàng tháng'];
const rangePresetOptions = [
  { label: 'Tuần này', start: '2026-04-26', end: '2026-05-02' },
  { label: '36 ngày tới', start: '2026-04-26', end: '2026-05-31' },
  { label: 'Tháng 5/2026', start: '2026-05-01', end: '2026-05-31' },
];
const repeatCountOptions = [3, 5, 8, 10, 12];
const exceptionDateOptions = [
  { label: '01/05/2026', value: '2026-05-01' },
  { label: '02/05/2026', value: '2026-05-02' },
  { label: '10/05/2026', value: '2026-05-10' },
  { label: '15/05/2026', value: '2026-05-15' },
];
const rangeIntervalOptions = ['Mỗi 2 ngày', 'Mỗi 3 ngày', 'Mỗi 5 ngày'];
const dateRangePresetOptions = [
  { label: '7 ngày', start: '2026-05-01', end: '2026-05-07' },
  { label: '14 ngày', start: '2026-05-01', end: '2026-05-14' },
  { label: '30 ngày', start: '2026-05-01', end: '2026-05-31' },
  { label: 'Tùy chọn', start: '2026-05-01', end: '2026-05-31' },
];
const rangeCalendarWeeks = [
  ['', '', '', '', '1', '2', '3'],
  ['4', '5', '6', '7', '8', '9', '10'],
  ['11', '12', '13', '14', '15', '16', '17'],
  ['18', '19', '20', '21', '22', '23', '24'],
  ['25', '26', '27', '28', '29', '30', '31'],
];
const rangeAppliedDates = new Set(['1', '3', '5', '7', '9', '11', '13', '15', '17', '19', '21', '23', '25', '27', '29', '31']);
const dateRangeOffDates = new Set(['2']);
const dateRangeExceptionDates = new Set(['3', '10', '17', '24', '31']);
const dateRangeScheduledDates = new Set(
  Array.from({ length: 31 }, (_, index) => String(index + 1)).filter(
    (day) => !dateRangeOffDates.has(day) && !dateRangeExceptionDates.has(day),
  ),
);

const bulkSteps = [
  ['1', 'Thông tin cơ bản', 'Bác sĩ, khoa, thời gian'],
  ['2', 'Cấu hình lịch', 'Khung giờ, slot, nghỉ'],
  ['3', 'Tùy chọn nâng cao', 'Lặp lại, mẫu, thiết lập'],
  ['4', 'Xem trước & xác nhận', 'Kiểm tra & lưu lịch'],
];

const bulkMethods = [
  {
    id: 'weekly',
    title: 'Lặp theo tuần',
    copy: 'Tạo lịch lặp lại theo các ngày trong tuần',
    hint: 'VD: Thứ 2, 4, 6 hằng tuần',
    icon: CalendarDays,
    tone: 'violet',
  },
  {
    id: 'range',
    title: 'Lặp theo khoảng ngày',
    copy: 'Tạo lịch lặp lại theo khoảng thời gian',
    hint: 'VD: Mỗi 2 ngày, 3 ngày/lần',
    icon: CalendarPlus,
    tone: 'blue',
  },
  {
    id: 'date-range',
    title: 'Lặp theo dải ngày',
    copy: 'Tạo lịch liên tục trong khoảng thời gian',
    hint: 'VD: Từ 01/05 đến 31/05',
    icon: CalendarCheck2,
    tone: 'green',
  },
  {
    id: 'copy',
    title: 'Sao chép từ lịch có sẵn',
    copy: 'Sao chép và áp dụng lịch hiện có',
    hint: 'VD: Sao chép lịch tuần này',
    icon: ClipboardCheck,
    tone: 'purple',
  },
  {
    id: 'excel',
    title: 'Import từ Excel',
    copy: 'Tải file Excel để tạo lịch hàng loạt',
    hint: 'VD: Upload file .xlsx',
    icon: FileSpreadsheet,
    tone: 'emerald',
  },
  {
    id: 'ai',
    title: 'Tạo nhanh (AI)',
    copy: 'AI gợi ý lịch dựa trên dữ liệu lịch sử & nhu cầu',
    hint: 'VD: Dựa trên lịch sử khám',
    icon: Bot,
    tone: 'amber',
    badge: 'AI',
  },
];

const bulkGuideSteps = [
  ['1', 'Chọn phương thức', 'Chọn kiểu tạo lịch phù hợp: theo tuần, theo khoảng ngày, import Excel hoặc AI.'],
  ['2', 'Nhập dữ liệu cơ bản', 'Xác định bác sĩ, khoa, loại lịch và khoảng thời gian áp dụng.'],
  ['3', 'Cấu hình quy tắc', 'Thiết lập khung giờ, nghỉ giữa ca, ngày lặp và ngày ngoại lệ.'],
  ['4', 'Xem trước & lưu', 'Rà soát bảng phân bổ trước khi lưu hoặc công khai lịch.'],
];

const bulkSavedTemplates = [
  { id: 'standard-week', title: 'Ca sáng tiêu chuẩn', copy: 'T2 - T6, 07:30 - 11:30', method: 'weekly', days: ['T2', 'T3', 'T4', 'T5', 'T6'] },
  { id: 'cardio-month', title: 'Tim mạch trong tháng', copy: '36 ngày, 864 slot dự kiến', method: 'date-range', days: ['T2', 'T3', 'T4', 'T5', 'T6'] },
  { id: 'ai-balanced', title: 'AI cân bằng tải', copy: 'Phân bổ đều theo công suất bác sĩ', method: 'ai', days: ['T2', 'T4', 'T6'] },
];

export function ScheduleBulkCreatePage() {
  const { doctors, error } = useSchedulingData();
  const navigate = useNavigate();
  const [selectedDays, setSelectedDays] = useState(weekDays);
  const [selectedDoctors, setSelectedDoctors] = useState(() =>
    [doctors[0]?.id || 'dr-minh', doctors[1]?.id || 'dr-khoa'].filter(Boolean),
  );
  const [selectedMethod, setSelectedMethod] = useState('date-range');
  const [selectedTemplate, setSelectedTemplate] = useState('cardio-month');
  const [selectedDistribution, setSelectedDistribution] = useState('even');
  const [selectedRepeatEnd, setSelectedRepeatEnd] = useState('unlimited');
  const [selectedDayType, setSelectedDayType] = useState('all');
  const [selectedAdvancedTab, setSelectedAdvancedTab] = useState('repeat');
  const [isBreakEnabled, setIsBreakEnabled] = useState(true);
  const [openFieldMenu, setOpenFieldMenu] = useState('');
  const [selectedDoctorGroup, setSelectedDoctorGroup] = useState(doctorGroupOptions[0]);
  const [selectedDepartment, setSelectedDepartment] = useState('Tim mạch');
  const [selectedScheduleType, setSelectedScheduleType] = useState('Lịch khám');
  const [dateRange, setDateRange] = useState({ start: '2026-05-01', end: '2026-05-31' });
  const [workStart, setWorkStart] = useState('07:30');
  const [workEnd, setWorkEnd] = useState('11:30');
  const [slotDuration, setSlotDuration] = useState('15 phút');
  const [slotCapacity, setSlotCapacity] = useState('8 slot');
  const [breakStart, setBreakStart] = useState('09:30');
  const [breakEnd, setBreakEnd] = useState('09:45');
  const [repeatFrequency, setRepeatFrequency] = useState('Hàng tuần');
  const [rangeInterval, setRangeInterval] = useState('Mỗi 2 ngày');
  const [selectedDateRangePreset, setSelectedDateRangePreset] = useState('30 ngày');
  const [selectedCopySourceTab, setSelectedCopySourceTab] = useState('doctor');
  const [selectedCopyMode, setSelectedCopyMode] = useState('repeat-range');
  const [selectedCopyTargetPreset, setSelectedCopyTargetPreset] = useState('2 tuần');
  const [rangeRepeatStart, setRangeRepeatStart] = useState('2026-05-01');
  const [repeatEndDate, setRepeatEndDate] = useState('2026-05-31');
  const [repeatCount, setRepeatCount] = useState(5);
  const [exceptionDates, setExceptionDates] = useState([]);
  const [extraBreaks, setExtraBreaks] = useState([]);
  const [isBasicDetailOpen, setIsBasicDetailOpen] = useState(false);
  const [activeCommandPanel, setActiveCommandPanel] = useState('');
  const [activeStep, setActiveStep] = useState(2);
  const [actionMessage, setActionMessage] = useState('');
  const [selectedAllocationDoctorIds, setSelectedAllocationDoctorIds] = useState(() => bulkAllocationDoctors.map((doctor) => doctor.id));
  const [isDoctorPickerOpen, setIsDoctorPickerOpen] = useState(false);
  const [isPreviewDetailOpen, setIsPreviewDetailOpen] = useState(false);
  const [isAlertDetailOpen, setIsAlertDetailOpen] = useState(false);
  const [isCurrentTemplateSaved, setIsCurrentTemplateSaved] = useState(false);
  const [quickActionFeedback, setQuickActionFeedback] = useState('');
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatMessages, setAiChatMessages] = useState(initialAiChatMessages);
  const [aiProcessing, setAiProcessing] = useState({
    status: 'idle',
    progress: 0,
    activeIndex: -1,
    prompt: '',
    runId: 0,
  });
  const [aiPreviewView, setAiPreviewView] = useState('month');
  const [aiPreviewDate, setAiPreviewDate] = useState(() => new Date(2026, 4, 1));
  const [aiPreviewDepartment, setAiPreviewDepartment] = useState('all');
  const [aiPreviewDoctor, setAiPreviewDoctor] = useState('all');
  const [savedAiPreview, setSavedAiPreview] = useState(false);
  const [aiAutomationState, setAiAutomationState] = useState(() =>
    aiAutomationRules.reduce((state, rule) => ({ ...state, [rule.id]: true }), {}),
  );
  const [aiSessionLog, setAiSessionLog] = useState(initialAiSessionHistory);
  const aiChatListRef = useRef(null);
  const completedAiRunsRef = useRef(new Set());
  const isRangeMethod = selectedMethod === 'range';
  const isDateRangeMethod = selectedMethod === 'date-range';
  const isCopyMethod = selectedMethod === 'copy';
  const isExcelMethod = selectedMethod === 'excel';
  const isAiMethod = selectedMethod === 'ai';
  const hasCalendarSummary = isRangeMethod || isDateRangeMethod;
  const previewDays = isRangeMethod ? rangePreviewDays : isDateRangeMethod ? dateRangePreviewDays : weeklyPreviewDays;
  const rangeAppliedCount = rangeAppliedDates.size;
  const projectedDoctors = 12;
  const projectedDays = isRangeMethod ? rangeAppliedCount : isDateRangeMethod ? 31 : 36;
  const projectedSlots = 864;
  const projectedPatients = 720;
  const avatarDoctors = doctors.length
    ? doctors.slice(0, 3)
    : [
        { id: 'dr-minh', name: 'BS. Nguyễn Hoàng Minh' },
        { id: 'dr-lan', name: 'BS. Trần Thùy Lan' },
        { id: 'dr-khoa', name: 'BS. Phạm Anh Khoa' },
      ];
  const selectedMethodInfo = bulkMethods.find((method) => method.id === selectedMethod) || bulkMethods[0];
  const selectedTemplateInfo = bulkSavedTemplates.find((template) => template.id === selectedTemplate) || bulkSavedTemplates[0];
  const selectedAllocationDoctors = bulkDoctorOptions.filter((doctor) => selectedAllocationDoctorIds.includes(doctor.id));
  const availableAllocationDoctors = bulkDoctorOptions.filter((doctor) => !selectedAllocationDoctorIds.includes(doctor.id));
  const allocationTotalSlots = selectedAllocationDoctors.reduce((total, _doctor, rowIndex) => total + getAllocationDoctorSlots(rowIndex), 0);
  const allocationTotalPatients = selectedAllocationDoctors.reduce((total, _doctor, rowIndex) => total + getAllocationDoctorPatients(rowIndex), 0);
  const displayedPreviewSlots = isDateRangeMethod ? projectedSlots : allocationTotalSlots;
  const displayedPreviewPatients = isDateRangeMethod ? projectedPatients : allocationTotalPatients;
  const activeAiProcessingStep = aiProcessing.activeIndex >= 0 ? aiProcessingSteps[aiProcessing.activeIndex] : null;
  const aiProcessingStatusText =
    aiProcessing.status === 'running' && activeAiProcessingStep
      ? `Đang ${activeAiProcessingStep.title.toLocaleLowerCase('vi-VN')}...`
      : aiProcessing.status === 'complete'
        ? 'Hoàn tất tối ưu lịch'
        : 'Sẵn sàng đọc yêu cầu';
  const aiPreviewViewInfo = aiPreviewViewModes.find((mode) => mode.id === aiPreviewView) || aiPreviewViewModes[1];
  const aiPreviewColumnCount = aiPreviewViewInfo.days;
  const aiPreviewVisibleDays = buildAiPreviewDays(aiPreviewDate, aiPreviewColumnCount);
  const aiPreviewTitle =
    aiPreviewView === 'week'
      ? `Tuần ${formatAiPreviewDate(aiPreviewDate)} - ${formatAiPreviewDate(addDays(aiPreviewDate, aiPreviewColumnCount - 1))}`
      : aiPreviewView === 'gantt'
        ? `Gantt tối ưu ${formatAiPreviewMonth(aiPreviewDate)}`
        : formatAiPreviewMonth(aiPreviewDate);
  const aiDoctorOptions = Array.from(
    new Set(
      aiDepartmentRows.flatMap((row) => [
        ...row.doctors,
        ...row.blocks.map(([doctor]) => doctor),
      ]),
    ),
  );
  const filteredAiDepartmentRows = aiDepartmentRows
    .filter((row) => aiPreviewDepartment === 'all' || row.department === aiPreviewDepartment)
    .map((row) => {
      const rowDoctors = row.doctors.filter((doctor) => aiPreviewDoctor === 'all' || doctor === aiPreviewDoctor);
      const rowBlocks = row.blocks.filter(([doctor]) => aiPreviewDoctor === 'all' || doctor === aiPreviewDoctor);

      return {
        ...row,
        doctors: aiPreviewDoctor === 'all' ? row.doctors : rowDoctors,
        blocks: rowBlocks.filter(([, , start]) => start < aiPreviewColumnCount),
      };
    })
    .filter((row) => aiPreviewDoctor === 'all' || row.doctors.length > 0 || row.blocks.length > 0);
  const enabledAutomationCount = aiAutomationRules.filter((rule) => aiAutomationState[rule.id]).length;
  const aiAppliedDays = getInclusiveDays(dateRange.start, dateRange.end) || 31;
  const aiSlotsPerDay = aiAutomationState.balance ? 384 : 336;
  const aiTotalSchedules = aiAppliedDays * aiSlotsPerDay + enabledAutomationCount * 55 + (enabledAutomationCount === aiAutomationRules.length ? 1 : 0);
  const aiDoctorCoverage = Math.min(99, 86 + enabledAutomationCount * 2 + (aiProcessing.status === 'complete' ? 0 : -2));
  const aiConflictCount = aiAutomationState.conflict ? 0 : Math.max(2, Math.round(aiAppliedDays / 8));
  const aiEfficiencyScore = Math.min(100, 84 + enabledAutomationCount * 2 + (aiProcessing.status === 'complete' ? 0 : -1));
  const aiShiftCount = workStart < '12:00' && workEnd <= '11:30' ? 1 : 2;
  const aiSideStats = [
    {
      label: 'Tổng lịch tạo',
      value: formatCompactNumber(aiTotalSchedules),
      note: '+ 22% vs trước',
      tone: 'green',
      icon: CalendarCheck2,
    },
    {
      label: 'Độ phủ bác sĩ',
      value: `${aiDoctorCoverage}%`,
      note: aiDoctorCoverage >= 94 ? 'Cân bằng tốt' : 'Cần bổ sung ca',
      tone: 'blue',
      icon: UsersRound,
    },
    {
      label: 'Xung đột',
      value: String(aiConflictCount),
      note: aiConflictCount === 0 ? 'Đã xử lý' : 'Cần kiểm tra',
      tone: aiConflictCount === 0 ? 'amber' : 'red',
      icon: ShieldCheck,
    },
    {
      label: 'Hiệu suất',
      value: `${aiEfficiencyScore}/100`,
      note: aiEfficiencyScore >= 94 ? 'Rất tối ưu' : 'Đang tối ưu',
      tone: 'teal',
      icon: Activity,
    },
  ];
  const aiConfigSummary = [
    [HeartPulse, 'Khoa / Phòng', aiPreviewDepartment === 'all' ? '8 khoa phòng' : aiPreviewDepartment],
    [CalendarDays, 'Khoảng thời gian', `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`],
    [CalendarCheck2, 'Ngày áp dụng', selectedDays.join(', ') || 'T2, T3, T4, T5, T6'],
    [Clock3, 'Số buổi / ngày', aiShiftCount === 1 ? '1 buổi (Sáng)' : '2 buổi (Sáng + Chiều)'],
    [ClipboardList, 'Tổng số ngày', `${aiAppliedDays} ngày`],
    [Timer, 'Tổng số slot / ngày', `${aiSlotsPerDay} slot`],
    [CircleCheck, 'Tổng lịch dự kiến', formatCompactNumber(aiTotalSchedules)],
  ];

  function toggleDay(day) {
    setSelectedDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  }

  function toggleDoctor(id) {
    setSelectedDoctors((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function formatDateDisplay(value) {
    const [year, month, day] = String(value).split('-');
    if (!year || !month || !day) {
      return 'Chọn ngày';
    }
    return `${day}/${month}/${year}`;
  }

  function toggleFieldMenu(name) {
    setOpenFieldMenu((current) => (current === name ? '' : name));
  }

  function chooseFieldValue(callback, value, message) {
    callback(value);
    setOpenFieldMenu('');
    setActionMessage(message);
  }

  function addExtraBreak() {
    const nextBreak = {
      id: `break-${Date.now()}`,
      label: `${extraBreaks.length + 2}. ${breakStart} - ${breakEnd}`,
    };
    setExtraBreaks((current) => [...current, nextBreak]);
    setActionMessage(`Đã thêm khoảng nghỉ ${nextBreak.label}.`);
  }

  function addExceptionDate(option) {
    setExceptionDates((current) => (current.some((item) => item.value === option.value) ? current : [...current, option]));
    setOpenFieldMenu('');
    setActionMessage(`Đã thêm ngày ngoại lệ ${option.label}.`);
  }

  function removeExceptionDate(value) {
    setExceptionDates((current) => current.filter((item) => item.value !== value));
    setActionMessage('Đã xóa ngày ngoại lệ.');
  }

  function handleDistributionChange(type) {
    const labels = {
      even: 'phân bổ đồng đều cho tất cả bác sĩ',
      ratio: 'phân bổ theo tỷ lệ công suất',
      custom: 'phân bổ tùy chỉnh',
    };
    setSelectedDistribution(type);
    setActionMessage(`Đã áp dụng ${labels[type]}.`);
  }

  function addAllocationDoctor(id) {
    const doctor = bulkDoctorOptions.find((item) => item.id === id);
    if (!doctor) {
      return;
    }

    setSelectedAllocationDoctorIds((current) => (current.includes(id) ? current : [...current, id]));
    setIsDoctorPickerOpen(false);
    setActionMessage(`Đã thêm ${doctor.name} vào phân bổ lịch.`);
  }

  function removeAllocationDoctor(id) {
    const doctor = bulkDoctorOptions.find((item) => item.id === id);

    if (selectedAllocationDoctorIds.length <= 1) {
      setActionMessage('Cần giữ ít nhất 1 bác sĩ trong lịch phân bổ.');
      return;
    }

    setSelectedAllocationDoctorIds((current) => current.filter((item) => item !== id));
    setActionMessage(`Đã gỡ ${doctor?.name || 'bác sĩ'} khỏi phân bổ lịch.`);
  }

  function getAllocationBaseSlots(rowIndex) {
    if (selectedDistribution === 'ratio') {
      return [30, 26, 22, 18, 16, 14][rowIndex % 6];
    }

    if (selectedDistribution === 'custom') {
      return [24, 18, 28, 20, 22, 16][rowIndex % 6];
    }

    return 24;
  }

  function getAllocationCellSlots(rowIndex, mode) {
    if (mode === 'off') {
      return 0;
    }

    const baseSlots = getAllocationBaseSlots(rowIndex);
    return mode === 'balanced' ? Math.max(baseSlots, Math.round(baseSlots * 1.08)) : baseSlots;
  }

  function getAllocationDoctorSlots(rowIndex) {
    return previewDays.reduce((total, [, , mode]) => total + getAllocationCellSlots(rowIndex, mode), 0);
  }

  function getAllocationDoctorPatients(rowIndex) {
    return Math.round(getAllocationDoctorSlots(rowIndex) * 0.83);
  }

  function getPreviewDayTotal(mode) {
    return selectedAllocationDoctors.reduce((total, _doctor, rowIndex) => total + getAllocationCellSlots(rowIndex, mode), 0);
  }

  useEffect(() => {
    if (doctors.length > 0 && selectedDoctors.every((doctorId) => !doctors.some((doctor) => doctor.id === doctorId))) {
      setSelectedDoctors(doctors.slice(0, 2).map((doctor) => doctor.id));
    }
  }, [doctors, selectedDoctors]);

  useEffect(() => {
    const chatList = aiChatListRef.current;
    if (chatList) {
      chatList.scrollTop = chatList.scrollHeight;
    }
  }, [aiChatMessages]);

  useEffect(() => {
    if (aiProcessing.status !== 'running') {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setAiProcessing((current) => {
        if (current.status !== 'running') {
          return current;
        }

        const nextProgress = Math.min(
          100,
          current.progress + (current.progress < 34 ? 5 : current.progress < 72 ? 4 : 3),
        );
        const nextActiveIndex = Math.min(
          aiProcessingSteps.length - 1,
          Math.floor(nextProgress / (100 / aiProcessingSteps.length)),
        );

        return {
          ...current,
          progress: nextProgress,
          activeIndex: nextProgress >= 100 ? aiProcessingSteps.length - 1 : nextActiveIndex,
        };
      });
    }, 420);

    return () => window.clearInterval(timer);
  }, [aiProcessing.status]);

  useEffect(() => {
    if (aiProcessing.status !== 'running' || aiProcessing.progress < 100) {
      return;
    }

    if (completedAiRunsRef.current.has(aiProcessing.runId)) {
      return;
    }

    completedAiRunsRef.current.add(aiProcessing.runId);
    const now = formatAiChatTime();
    const completedPrompt = aiProcessing.prompt;

    setAiProcessing((current) => ({
      ...current,
      status: 'complete',
      progress: 100,
      activeIndex: aiProcessingSteps.length - 1,
    }));
    setAiChatMessages((current) => [
      ...current,
      {
        id: `ai-assistant-${aiProcessing.runId}`,
        role: 'assistant',
        title: 'Đề xuất lịch đã sẵn sàng',
        content: buildAiAssistantReply(completedPrompt),
        time: now,
      },
    ]);
    setAiSessionLog((current) => [
      {
        id: `history-${aiProcessing.runId}`,
        title: `Phiên ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date())} · ${now}`,
        copy: summarizeAiSessionPrompt(completedPrompt),
        prompt: completedPrompt,
      },
      ...current.filter((session) => session.id !== `history-${aiProcessing.runId}`),
    ].slice(0, 5));
    setQuickActionFeedback('AI đã hoàn tất tối ưu và cập nhật bản xem trước dựa trên nội dung chat.');
    setActionMessage('AI đã hoàn tất đọc yêu cầu, phân tích ràng buộc và tối ưu lịch.');
  }, [aiProcessing.progress, aiProcessing.prompt, aiProcessing.runId, aiProcessing.status]);

  function scrollToSection(id) {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function openCommandPanel(panel, message) {
    setActiveCommandPanel((current) => (current === panel ? '' : panel));
    setActionMessage(message);
  }

  function toggleAlertDetails() {
    setIsAlertDetailOpen((current) => !current);
    setActionMessage(isAlertDetailOpen ? 'Đã thu gọn chi tiết kiểm tra.' : 'Đã mở chi tiết kiểm tra và cảnh báo.');
  }

  function saveBulkTemplate() {
    setIsCurrentTemplateSaved(true);
    setActiveCommandPanel('templates');
    setQuickActionFeedback('Mẫu lịch hiện tại đã được lưu vào danh sách mẫu.');
    setActionMessage('Đã lưu mẫu lịch hàng loạt này và mở danh sách mẫu.');
  }

  function duplicateBulkSchedule() {
    setSelectedMethod('copy');
    setActiveCommandPanel('copy');
    setActiveStep(1);
    setIsCurrentTemplateSaved(false);
    setQuickActionFeedback('Đã tạo bản sao lịch để chỉnh sửa. Bắt đầu kiểm tra lại từ thông tin cơ bản.');
    setActionMessage('Đã nhân bản lịch để chỉnh sửa.');
    scrollToSection('bulk-step-basic');
  }

  function goToStep(stepNumber) {
    setActiveStep(stepNumber);
    const sectionIds = {
      1: 'bulk-step-basic',
      2: 'bulk-step-work',
      3: 'bulk-step-advanced',
      4: 'bulk-step-preview',
    };
    scrollToSection(sectionIds[stepNumber]);
  }

  function handleMethodSelect(method) {
    setSelectedMethod(method.id);
    setActionMessage(`Đã chọn phương thức: ${method.title}.`);

    if (method.id === 'date-range') {
      setActiveStep(2);
      setSelectedTemplate('cardio-month');
      setSelectedAdvancedTab('repeat');
      setDateRange({ start: '2026-05-01', end: '2026-05-31' });
      setSelectedDateRangePreset('30 ngày');
      setRangeRepeatStart('2026-05-01');
      setRepeatEndDate('2026-05-31');
      setSelectedRepeatEnd('unlimited');
      setSelectedDayType('all');
      setActiveCommandPanel('');
      return;
    }

    if (method.id === 'copy') {
      setActiveStep(3);
      setSelectedTemplate('standard-week');
      setSelectedAdvancedTab('repeat');
      setSelectedCopySourceTab('doctor');
      setSelectedCopyMode('repeat-range');
      setSelectedCopyTargetPreset('2 tuần');
      setDateRange({ start: '2026-05-05', end: '2026-05-31' });
      setRepeatEndDate('2026-05-31');
      setSelectedRepeatEnd('unlimited');
      setActiveCommandPanel('');
      return;
    }

    if (method.id === 'excel') {
      setActiveStep(2);
      setDateRange({ start: '2026-04-28', end: '2026-05-31' });
      setSelectedAdvancedTab('repeat');
      setActiveCommandPanel('');
      return;
    }

    if (method.id === 'ai') {
      setActiveStep(3);
      setSelectedTemplate('ai-balanced');
      setDateRange({ start: '2026-05-01', end: '2026-05-31' });
      setSelectedAdvancedTab('repeat');
      setActiveCommandPanel('');
      return;
    }

    if (method.id === 'range') {
      setActiveStep(2);
      setSelectedAdvancedTab('repeat');
      setDateRange({ start: '2026-05-01', end: '2026-05-31' });
      setRangeRepeatStart('2026-05-01');
      setRepeatEndDate('2026-05-31');
      setSelectedRepeatEnd('date');
      setActiveCommandPanel('');
      return;
    }

    setActiveCommandPanel('');
  }

  function applyDateRangePreset(option) {
    setSelectedDateRangePreset(option.label);
    setDateRange({ start: option.start, end: option.end });
    setRepeatEndDate(option.end);
    setActionMessage(`Đã áp dụng dải ngày: ${option.label}.`);
  }

  function applySavedTemplate(template) {
    setSelectedTemplate(template.id);
    setSelectedMethod(template.method);
    setSelectedDays(template.days);
    if (template.method === 'date-range') {
      setDateRange({ start: '2026-05-01', end: '2026-05-31' });
      setSelectedDateRangePreset('30 ngày');
      setRepeatEndDate('2026-05-31');
      setSelectedRepeatEnd('unlimited');
      setSelectedDayType('all');
    }
    setActiveCommandPanel('');
    setActionMessage(`Đã áp dụng mẫu: ${template.title}.`);
    scrollToSection('bulk-step-basic');
  }

  function exportPreviewFile() {
    const rows = [
      ['Bác sĩ', ...previewDays.map(([day, date]) => `${day} ${date}`), 'Tổng slot', 'Tổng BN'],
      ...selectedAllocationDoctors.map((doctor, rowIndex) => [
        doctor.name,
        ...previewDays.map(([, , mode]) => (mode === 'off' ? 'Nghỉ' : String(getAllocationCellSlots(rowIndex, mode)))),
        String(getAllocationDoctorSlots(rowIndex)),
        String(getAllocationDoctorPatients(rowIndex)),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lich-hang-loat-du-kien.csv';
    link.click();
    URL.revokeObjectURL(url);
    setQuickActionFeedback(`Đã xuất ${selectedAllocationDoctors.length} bác sĩ với ${allocationTotalSlots} slot dự kiến.`);
    setActionMessage('Đã xuất file lịch hàng loạt. File CSV có thể mở bằng Excel.');
  }

  function formatAiChatTime() {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  }

  function getInclusiveDays(startValue, endValue) {
    const startDate = new Date(startValue);
    const endDate = new Date(endValue);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return 0;
    }

    return Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
  }

  function formatCompactNumber(value) {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  function summarizeAiSessionPrompt(prompt) {
    const normalizedPrompt = prompt.toLocaleLowerCase('vi-VN');

    if (normalizedPrompt.includes('nhi')) {
      return `Tạo lịch khoa Nhi (${aiAppliedDays} ngày)`;
    }

    if (normalizedPrompt.includes('tim')) {
      return `Tối ưu lịch BS Tim mạch (${aiAppliedDays} ngày)`;
    }

    if (normalizedPrompt.includes('tất cả') || normalizedPrompt.includes('toàn')) {
      return `Cân bằng ca toàn hệ thống (${aiAppliedDays} ngày)`;
    }

    return `Tạo lịch AI (${aiAppliedDays} ngày)`;
  }

  function addDays(date, amount) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + amount);
    return nextDate;
  }

  function formatAiPreviewDate(date) {
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  function formatAiPreviewMonth(date) {
    return `Tháng ${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  function buildAiPreviewDays(startDate, count) {
    return Array.from({ length: count }, (_, index) => {
      const date = addDays(startDate, index);
      const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];

      return {
        id: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        day: weekday,
        date: String(date.getDate()).padStart(2, '0'),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      };
    });
  }

  function chooseAiPreviewView(view) {
    setAiPreviewView(view);
    const selectedView = aiPreviewViewModes.find((mode) => mode.id === view);
    setActionMessage(`Đã chuyển xem trước lịch AI sang chế độ ${selectedView?.label || view}.`);
  }

  function moveAiPreviewDate(direction) {
    setAiPreviewDate((current) => {
      if (aiPreviewView === 'week') {
        return addDays(current, direction * 7);
      }

      const nextDate = new Date(current);
      nextDate.setMonth(nextDate.getMonth() + direction);
      return nextDate;
    });
    setActionMessage(direction > 0 ? 'Đã chuyển sang mốc lịch tiếp theo.' : 'Đã quay về mốc lịch trước.');
  }

  function saveAiPreviewSchedule() {
    setSavedAiPreview(true);
    setQuickActionFeedback('Đã lưu bản xem trước lịch AI vào danh sách lịch nháp.');
    setActionMessage('Đã lưu lịch AI đề xuất.');
  }

  function searchAiPreviewSchedule() {
    setActionMessage('Đã rà soát lịch AI đang hiển thị theo bộ lọc hiện tại.');
  }

  function exportAiPreviewSchedule() {
    const rows = [
      ['Khoa', 'Bác sĩ', 'Thời gian', 'Ngày bắt đầu cột', 'Số ngày', 'Nhóm màu'],
      ...filteredAiDepartmentRows.flatMap((row) =>
        row.blocks.map(([doctor, time, start, span, tone]) => [
          row.department,
          doctor,
          time,
          aiPreviewVisibleDays[start]?.date || start + 1,
          Math.min(span, aiPreviewColumnCount - start),
          tone,
        ]),
      ),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lich-ai-${aiPreviewView}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setActionMessage('Đã xuất bản xem trước lịch AI ra file CSV.');
  }

  function buildAiAssistantReply(prompt) {
    const normalizedPrompt = prompt.toLocaleLowerCase('vi-VN');
    const rules = [];
    const enabledRules = aiAutomationRules
      .filter((rule) => aiAutomationState[rule.id])
      .map((rule) => rule.label.toLocaleLowerCase('vi-VN'));

    if (normalizedPrompt.includes('nhi')) {
      rules.push('ưu tiên bác sĩ khoa Nhi và giữ phòng khám phù hợp cho trẻ em');
    }

    if (normalizedPrompt.includes('sáng') || normalizedPrompt.includes('07:30')) {
      rules.push('xếp ca sáng 07:30 - 11:30 làm khung chính');
    }

    if (normalizedPrompt.includes('5 năm') || normalizedPrompt.includes('kinh nghiệm')) {
      rules.push('đưa bác sĩ trên 5 năm kinh nghiệm vào các slot cao điểm');
    }

    if (normalizedPrompt.includes('trùng') || normalizedPrompt.includes('xung đột')) {
      rules.push('chạy kiểm tra trùng ca, trùng phòng và quá tải bác sĩ');
    }

    if (normalizedPrompt.includes('cuối tuần') || normalizedPrompt.includes('nghỉ')) {
      rules.push('giữ ngày nghỉ cuối tuần theo quy tắc cân bằng tải');
    }

    if (normalizedPrompt.includes('tất cả') || normalizedPrompt.includes('toàn')) {
      rules.push('áp dụng cho toàn bộ bác sĩ đang hoạt động');
    }

    const ruleSummary = rules.length
      ? ` Các ràng buộc chính: ${rules.join('; ')}.`
      : ' Tôi sẽ dùng cấu hình mặc định: dải ngày 01/05 - 31/05, ca sáng, cân bằng tải và kiểm tra xung đột.';

    return `Đã nhận yêu cầu "${prompt}". Tôi đã cập nhật bản xem trước theo ${aiAppliedDays} ngày, dự kiến ${formatCompactNumber(aiTotalSchedules)} lịch và ${aiSlotsPerDay} slot/ngày.${ruleSummary} Tự động hóa đang bật: ${enabledRules.join(', ')}.`;
  }

  function toggleAiAutomation(rule) {
    setAiAutomationState((current) => {
      const nextValue = !current[rule.id];
      setActionMessage(`${nextValue ? 'Đã bật' : 'Đã tắt'} quy tắc AI: ${rule.label}.`);
      return { ...current, [rule.id]: nextValue };
    });
  }

  function openAiHistorySession(session) {
    setAiChatInput(session.prompt);
    setActionMessage(`Đã mở lại ${session.title}: ${session.copy}.`);

    if (session.copy.toLocaleLowerCase('vi-VN').includes('nhi')) {
      setAiPreviewDepartment('Khoa Nhi');
    } else if (session.copy.toLocaleLowerCase('vi-VN').includes('tim')) {
      setAiPreviewDepartment('Khoa Tim mạch');
    }
  }

  function getAiProcessingStepStatus(index) {
    if (aiProcessing.status === 'idle') {
      return 'pending';
    }

    if (aiProcessing.status === 'complete') {
      return 'done';
    }

    if (index < aiProcessing.activeIndex) {
      return 'done';
    }

    if (index === aiProcessing.activeIndex) {
      return 'active';
    }

    return 'pending';
  }

  function startAiProcessing(prompt, runId) {
    setAiProcessing({
      status: 'running',
      progress: 4,
      activeIndex: 0,
      prompt,
      runId,
    });
  }

  function cancelAiProcessing() {
    setAiProcessing({
      status: 'idle',
      progress: 0,
      activeIndex: -1,
      prompt: '',
      runId: 0,
    });
    setActionMessage('Đã hủy phiên AI đang xử lý.');
  }

  function submitAiChat(event, presetPrompt) {
    event?.preventDefault();
    const prompt = String(presetPrompt ?? aiChatInput).trim();

    if (!prompt) {
      setActionMessage('Vui lòng nhập yêu cầu trước khi gửi cho AI.');
      return;
    }

    const now = formatAiChatTime();
    const nextId = Date.now();

    setAiChatMessages((current) => [
      ...current,
      {
        id: `ai-user-${nextId}`,
        role: 'user',
        content: prompt,
        time: now,
      },
    ]);
    startAiProcessing(prompt, nextId);
    setAiChatInput('');
    setActiveStep(3);
    setSelectedTemplate('ai-balanced');
    setDateRange({ start: '2026-05-01', end: '2026-05-31' });
    setQuickActionFeedback('AI đang đọc yêu cầu và chạy quy trình tối ưu lịch.');
    setActionMessage(`AI đã nhận yêu cầu và bắt đầu đọc dữ liệu: ${prompt}.`);
  }

  function handleAiVoiceFill() {
    setAiChatInput('Tạo lịch khám từ 01/05 đến 31/05, ưu tiên ca sáng và tránh trùng ca');
    setActionMessage('Đã điền mẫu yêu cầu bằng nút ghi âm để bạn gửi thử.');
  }

  function handleContinue() {
    setActiveStep(4);
    setActiveCommandPanel('preview');
    setIsPreviewDetailOpen(true);
    setQuickActionFeedback('Đã mở màn xem trước để kiểm tra trước khi lưu.');
    setActionMessage('Đã mở bản xem trước lịch hàng loạt.');
    scrollToSection('bulk-step-preview');
  }

  return (
    <section className={`scheduling-bulk-page ${isRangeMethod ? 'is-range-mode' : ''} ${isDateRangeMethod ? 'is-date-range-mode' : ''} ${isCopyMethod ? 'is-copy-mode' : ''} ${isExcelMethod ? 'is-excel-mode' : ''} ${isAiMethod ? 'is-ai-mode' : ''}`}>
      <header className="scheduling-bulk-command">
        <div className="scheduling-bulk-command__title">
          <h1>
            Tạo lịch hàng loạt
            <span aria-hidden="true"><Sparkles size={17} strokeWidth={2.35} /></span>
          </h1>
          <p>Tạo nhiều lịch khám cùng lúc, lặp lại theo mẫu với xem trước chi tiết trước khi lưu</p>
        </div>

        <div className="scheduling-bulk-command__actions">
          <button
            type="button"
            className={activeCommandPanel === 'guide' ? 'is-selected' : ''}
            aria-expanded={activeCommandPanel === 'guide'}
            onClick={() => openCommandPanel('guide', 'Đang mở hướng dẫn tạo lịch hàng loạt.')}
          >
            <BookOpenCheck size={15} strokeWidth={2.35} aria-hidden="true" />
            Hướng dẫn
          </button>
          <button
            type="button"
            className={activeCommandPanel === 'templates' ? 'is-selected' : ''}
            aria-expanded={activeCommandPanel === 'templates'}
            onClick={() => openCommandPanel('templates', 'Đã tải danh sách mẫu lịch đã lưu.')}
          >
            <Save size={15} strokeWidth={2.35} aria-hidden="true" />
            Mẫu lịch đã lưu
          </button>
          <button type="button" className="is-primary" onClick={handleContinue}>
            <Check size={16} strokeWidth={2.55} aria-hidden="true" />
            Xem trước & tiếp tục
            <ArrowRight size={17} strokeWidth={2.45} aria-hidden="true" />
          </button>
        </div>
      </header>

      {error || actionMessage ? (
        <section className={`scheduling-sync-banner ${error ? 'is-warning' : ''}`}>
          <strong>{actionMessage ? 'Thao tác thành công' : 'Thông báo máy chủ'}</strong>
          <span>{actionMessage || error}</span>
        </section>
      ) : null}

      {activeCommandPanel ? (
        <section className={`scheduling-bulk-action-panel is-${activeCommandPanel}`} aria-live="polite">
          {activeCommandPanel === 'guide' ? (
            <>
              <div className="scheduling-bulk-action-panel__head">
                <BookOpenCheck size={17} strokeWidth={2.35} aria-hidden="true" />
                <div>
                  <strong>Hướng dẫn tạo lịch hàng loạt</strong>
                  <span>Quy trình thao tác nhanh để tạo nhiều lịch mà không bỏ sót bước kiểm tra.</span>
                </div>
              </div>
              <div className="scheduling-bulk-guide-grid">
                {bulkGuideSteps.map(([number, title, copy]) => (
                  <button key={number} type="button" onClick={() => goToStep(Number(number))}>
                    <span>{number}</span>
                    <strong>{title}</strong>
                    <small>{copy}</small>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {activeCommandPanel === 'templates' ? (
            <>
              <div className="scheduling-bulk-action-panel__head">
                <Save size={17} strokeWidth={2.35} aria-hidden="true" />
                <div>
                  <strong>Mẫu lịch đã lưu</strong>
                  <span>Chọn một mẫu để áp dụng ngay phương thức, ngày lặp và cấu hình preview.</span>
                </div>
              </div>
              <div className="scheduling-bulk-template-grid">
                {bulkSavedTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={selectedTemplate === template.id ? 'is-selected' : ''}
                    onClick={() => applySavedTemplate(template)}
                  >
                    <CalendarCheck2 size={16} strokeWidth={2.35} aria-hidden="true" />
                    <strong>{template.title}</strong>
                    <small>{template.copy}</small>
                    <span>{selectedTemplate === template.id ? 'Đang dùng' : 'Áp dụng'}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {['copy', 'excel', 'ai', 'preview'].includes(activeCommandPanel) ? (
            <>
              <div className="scheduling-bulk-action-panel__head">
                <selectedMethodInfo.icon size={17} strokeWidth={2.35} aria-hidden="true" />
                <div>
                  <strong>
                    {activeCommandPanel === 'preview' ? 'Bản xem trước đã sẵn sàng' : selectedMethodInfo.title}
                  </strong>
                  <span>
                    {activeCommandPanel === 'preview'
                      ? `${selectedTemplateInfo.title} • ${projectedSlots} slot • ${projectedPatients} bệnh nhân dự kiến.`
                      : selectedMethodInfo.copy}
                  </span>
                </div>
              </div>
              <div className="scheduling-bulk-method-actions">
                <button type="button" onClick={() => scrollToSection('bulk-step-basic')}>
                  <Layers3 size={15} strokeWidth={2.35} aria-hidden="true" />
                  Cấu hình dữ liệu
                </button>
                <button type="button" onClick={() => scrollToSection('bulk-step-preview')}>
                  <CalendarCheck2 size={15} strokeWidth={2.35} aria-hidden="true" />
                  Xem bảng preview
                </button>
                <button type="button" onClick={exportPreviewFile}>
                  <FileSpreadsheet size={15} strokeWidth={2.35} aria-hidden="true" />
                  Xuất file Excel
                </button>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="scheduling-bulk-layout">
        <main className="scheduling-bulk-main">
          <nav className="scheduling-bulk-steps" aria-label="Quy trình tạo lịch hàng loạt">
            {bulkSteps.map(([number, title, copy], index) => {
              const stepNumber = index + 1;
              const reached = stepNumber <= activeStep;

              return (
                <button
                  key={number}
                  type="button"
                  className={reached ? 'is-reached' : ''}
                  aria-current={stepNumber === activeStep ? 'step' : undefined}
                  onClick={() => goToStep(stepNumber)}
                >
                  <span>{number}</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{copy}</small>
                  </div>
                </button>
              );
            })}
          </nav>

          <section className="scheduling-bulk-method-panel">
            <div className="scheduling-bulk-method-panel__head">
              <div>
                <CalendarCheck2 size={16} strokeWidth={2.4} aria-hidden="true" />
                <strong>Chọn phương thức tạo lịch hàng loạt</strong>
              </div>
            </div>

            <div className="scheduling-bulk-method-grid">
              {bulkMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedMethod === method.id;

                return (
                  <button
                    key={method.id}
                    type="button"
                    className={`is-${method.tone} ${isSelected ? 'is-selected' : 'is-muted'}`}
                    aria-pressed={isSelected}
                    onClick={() => handleMethodSelect(method)}
                  >
                    {method.badge ? <em>{method.badge}</em> : null}
                    {isSelected ? (
                      <b className="scheduling-bulk-method-check" aria-hidden="true">
                        <CircleCheck size={16} strokeWidth={2.7} />
                      </b>
                    ) : null}
                    <span aria-hidden="true"><Icon size={24} strokeWidth={2.35} /></span>
                    <strong>{method.title}</strong>
                    <small>{method.copy}</small>
                    <mark>{method.hint}</mark>
                  </button>
                );
              })}
            </div>
          </section>

          {isAiMethod ? (
            <div className="scheduling-bulk-ai-workspace">
              <section className="scheduling-bulk-ai-chat" aria-label="Trò chuyện với AI tạo lịch">
                <div className="scheduling-bulk-side-title scheduling-bulk-ai-chat__title">
                  <Sparkles size={15} strokeWidth={2.45} aria-hidden="true" />
                  <strong>Trò chuyện với AI trợ lý</strong>
                  <button type="button" aria-label="Thu gọn trợ lý AI" onClick={() => setActionMessage('Đã thu gọn trợ lý AI.')}>
                    <ArrowRight size={13} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>

                <div className="scheduling-bulk-ai-chat__body">
                  <div className="scheduling-bulk-ai-message-list" ref={aiChatListRef} aria-live="polite">
                    {aiChatMessages.map((message) => (
                      <div key={message.id} className={`scheduling-bulk-ai-message is-${message.role}`}>
                        {message.role === 'assistant' ? (
                          <span aria-hidden="true"><Bot size={18} strokeWidth={2.35} /></span>
                        ) : null}
                        <div>
                          {message.title ? <strong>{message.title}</strong> : null}
                          <p>{message.content}</p>
                          <small>{message.time}</small>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="scheduling-bulk-ai-hints">
                    <strong>Bạn có thể mô tả nhu cầu, ví dụ:</strong>
                    <p>"Tạo lịch khám khoa Nhi từ 01-31/05"</p>
                    <p>"Ưu tiên bác sĩ giàu kinh nghiệm buổi sáng"</p>
                    <p>"Cân bằng tải công việc, tránh trùng ca"</p>
                  </div>

                  <div className="scheduling-bulk-ai-prompt-list">
                    {aiAssistantPrompts.map(([title, subtitle], index) => {
                      const PromptIcon = aiAssistantPromptIcons[index] || SlidersHorizontal;

                      return (
                        <button
                          key={title}
                          type="button"
                          onClick={() => submitAiChat(undefined, `${title} ${subtitle}`)}
                        >
                          <span aria-hidden="true">
                            <PromptIcon size={18} strokeWidth={2.45} />
                          </span>
                          <strong>{title}</strong>
                          <small>{subtitle}</small>
                          <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <form className="scheduling-bulk-ai-input" onSubmit={submitAiChat}>
                  <CalendarCog size={15} strokeWidth={2.4} aria-hidden="true" />
                  <input
                    value={aiChatInput}
                    onChange={(event) => setAiChatInput(event.target.value)}
                    placeholder="Nhập yêu cầu của bạn..."
                    aria-label="Nhập yêu cầu cho AI"
                  />
                  <button type="button" aria-label="Ghi âm yêu cầu" onClick={handleAiVoiceFill}>
                    <Mic size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                  <button type="submit" aria-label="Gửi yêu cầu AI">
                    <SendHorizontal size={15} strokeWidth={2.55} aria-hidden="true" />
                  </button>
                </form>
              </section>

              <div className="scheduling-bulk-ai-board">
                <section
                  className={`scheduling-bulk-ai-processing is-${aiProcessing.status}`}
                  style={{ '--ai-process-progress': `${aiProcessing.progress}%` }}
                >
                  <div className="scheduling-bulk-ai-processing__content">
                    <div className="scheduling-bulk-section-title">
                      <span><WandSparkles size={15} strokeWidth={2.45} aria-hidden="true" /></span>
                      <strong>AI đang xử lý & tối ưu lịch</strong>
                    </div>
                    <div className="scheduling-bulk-ai-step-grid">
                      {aiProcessingSteps.map((step, index) => {
                        const StepIcon = step.icon;
                        const stepStatus = getAiProcessingStepStatus(index);
                        const StatusIcon = stepStatus === 'active' ? LoaderCircle : CircleCheck;

                        return (
                          <article
                            key={step.title}
                            className={`is-${stepStatus} is-${step.tone}`}
                            aria-current={stepStatus === 'active' ? 'step' : undefined}
                          >
                            <em className="scheduling-bulk-ai-step-status" aria-hidden="true">
                              <StatusIcon size={14} strokeWidth={2.55} />
                            </em>
                            <span className="scheduling-bulk-ai-step-icon" aria-hidden="true">
                              <StepIcon size={17} strokeWidth={2.35} />
                            </span>
                            <strong>{step.title}</strong>
                            <small>{step.copy}</small>
                          </article>
                        );
                      })}
                    </div>
                    <div className="scheduling-bulk-ai-progress">
                      <span><i />{aiProcessingStatusText} <strong>{Math.round(aiProcessing.progress)}%</strong></span>
                      <button type="button" onClick={cancelAiProcessing}>Hủy</button>
                    </div>
                  </div>
                  <div className={`scheduling-bulk-ai-brain is-${aiProcessing.status}`} aria-hidden="true">
                    <div className="scheduling-bulk-ai-brain__core">
                      <Brain size={62} strokeWidth={1.85} />
                    </div>
                    <span className="is-calendar"><CalendarDays size={17} strokeWidth={2.4} /></span>
                    <span className="is-users"><UsersRound size={17} strokeWidth={2.4} /></span>
                    <span className="is-rules"><ShieldCheck size={17} strokeWidth={2.4} /></span>
                    <span className="is-time"><Clock3 size={17} strokeWidth={2.4} /></span>
                  </div>
                </section>

                <section className={`scheduling-bulk-ai-preview is-${aiPreviewView}-view`}>
                  <div className="scheduling-bulk-ai-preview__head">
                    <div className="scheduling-bulk-section-title">
                      <span><Sparkles size={15} strokeWidth={2.45} aria-hidden="true" /></span>
                      <strong>Xem trước lịch được AI đề xuất</strong>
                    </div>
                    <div>
                      <button type="button" aria-label="Tìm kiếm lịch AI" onClick={searchAiPreviewSchedule}>
                        <Search size={14} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={savedAiPreview ? 'is-saved' : ''}
                        aria-label="Lưu lịch AI"
                        onClick={saveAiPreviewSchedule}
                      >
                        {savedAiPreview ? <Check size={14} strokeWidth={2.4} aria-hidden="true" /> : <Save size={14} strokeWidth={2.4} aria-hidden="true" />}
                      </button>
                      <button type="button" aria-label="Xuất lịch AI" onClick={exportAiPreviewSchedule}>
                        <Download size={14} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="scheduling-bulk-ai-toolbar">
                    <div className="scheduling-bulk-ai-segmented">
                      {aiPreviewViewModes.map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          className={aiPreviewView === mode.id ? 'is-active' : ''}
                          onClick={() => chooseAiPreviewView(mode.id)}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                    <label className="scheduling-bulk-ai-filter">
                      <select
                        value={aiPreviewDepartment}
                        onChange={(event) => {
                          setAiPreviewDepartment(event.target.value);
                          setActionMessage(event.target.value === 'all' ? 'Đã hiển thị tất cả khoa.' : `Đã lọc lịch AI theo ${event.target.value}.`);
                        }}
                        aria-label="Lọc lịch AI theo khoa"
                      >
                        <option value="all">Tất cả khoa</option>
                        {aiDepartmentRows.map((row) => (
                          <option key={row.department} value={row.department}>{row.department}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} strokeWidth={2.45} aria-hidden="true" />
                    </label>
                    <label className="scheduling-bulk-ai-filter">
                      <select
                        value={aiPreviewDoctor}
                        onChange={(event) => {
                          setAiPreviewDoctor(event.target.value);
                          setActionMessage(event.target.value === 'all' ? 'Đã hiển thị tất cả bác sĩ.' : `Đã lọc lịch AI theo ${event.target.value}.`);
                        }}
                        aria-label="Lọc lịch AI theo bác sĩ"
                      >
                        <option value="all">Tất cả bác sĩ</option>
                        {aiDoctorOptions.map((doctor) => (
                          <option key={doctor} value={doctor}>{doctor}</option>
                        ))}
                      </select>
                      <ChevronDown size={13} strokeWidth={2.45} aria-hidden="true" />
                    </label>
                    <div className="scheduling-bulk-ai-date-control">
                      <button type="button" aria-label="Mốc lịch trước" onClick={() => moveAiPreviewDate(-1)}>
                        <ChevronLeft size={13} strokeWidth={2.45} aria-hidden="true" />
                      </button>
                      <strong>
                        {formatAiPreviewDate(aiPreviewDate)}
                        <CalendarDays size={13} strokeWidth={2.35} aria-hidden="true" />
                      </strong>
                      <button type="button" aria-label="Mốc lịch sau" onClick={() => moveAiPreviewDate(1)}>
                        <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div
                    className="scheduling-bulk-ai-timeline"
                    style={{
                      '--ai-preview-columns': aiPreviewColumnCount,
                      '--ai-preview-min-width': aiPreviewView === 'week' ? '680px' : '920px',
                    }}
                  >
                    <div className="scheduling-bulk-ai-timeline__title">{aiPreviewTitle}</div>
                    <div className="scheduling-bulk-ai-timeline__days">
                      <span />
                      {aiPreviewVisibleDays.map(({ id, day, date, isWeekend }) => (
                        <strong key={id} className={isWeekend ? 'is-weekend' : ''}>{day}<small>{date}</small></strong>
                      ))}
                    </div>
                    {filteredAiDepartmentRows.length === 0 ? (
                      <div className="scheduling-bulk-ai-empty">
                        <Search size={18} strokeWidth={2.35} aria-hidden="true" />
                        <strong>Không có lịch phù hợp bộ lọc</strong>
                        <span>Thử chọn lại khoa hoặc bác sĩ để xem đề xuất khác.</span>
                      </div>
                    ) : null}
                    {filteredAiDepartmentRows.map((row) => (
                      <div className="scheduling-bulk-ai-row" key={row.department}>
                        <div className="scheduling-bulk-ai-row__label">
                          <strong>{row.department}</strong>
                          <small>{Math.max(row.doctors.length, new Set(row.blocks.map(([doctor]) => doctor)).size)} bác sĩ</small>
                          {row.doctors.map((doctor, index) => (
                            <span key={doctor}>
                              <img src={fallbackDoctorAvatars[index % fallbackDoctorAvatars.length]} alt="" />
                              {doctor}
                            </span>
                          ))}
                        </div>
                        <div className="scheduling-bulk-ai-row__grid">
                          {aiPreviewVisibleDays.map(({ id }) => <i key={id} />)}
                          {row.blocks.map(([doctor, time, start, span, tone]) => {
                            const visibleSpan = Math.min(span, aiPreviewColumnCount - start);

                            if (visibleSpan <= 0) {
                              return null;
                            }

                            return (
                              <button
                                key={`${row.department}-${doctor}-${time}-${start}`}
                                type="button"
                                className={`is-${tone}`}
                                style={{ gridColumn: `${start + 1} / span ${visibleSpan}` }}
                                onClick={() => setActionMessage(`Đã chọn lịch AI đề xuất cho ${doctor}: ${time}.`)}
                              >
                                <img src={doctorAvatarMap['dr-lan']} alt="" />
                                <strong>{doctor}</strong>
                                <small>{time}</small>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {isExcelMethod ? (
            <div className="scheduling-bulk-excel-workspace">
              <section className="scheduling-bulk-excel-import">
                <div className="scheduling-bulk-section-title">
                  <span>1.</span>
                  <strong>Import file Excel</strong>
                </div>
                <p className="scheduling-bulk-excel-copy">
                  Tải lên file Excel chứa dữ liệu lịch khám. Hệ thống sẽ kiểm tra và hiển thị dữ liệu để bạn xác nhận.
                </p>

                <div className="scheduling-bulk-excel-import-grid">
                  <div className="scheduling-bulk-excel-dropzone">
                    <div className="scheduling-bulk-excel-art" aria-hidden="true">
                      <FileSpreadsheet size={46} strokeWidth={1.9} />
                    </div>
                    <strong>Kéo & thả file Excel vào đây</strong>
                    <span>hoặc</span>
                    <button
                      type="button"
                      onClick={() => setActionMessage('Đang chờ chọn file Excel từ máy tính.')}
                    >
                      <UploadCloud size={15} strokeWidth={2.4} aria-hidden="true" />
                      Chọn file từ máy tính
                    </button>
                    <small>Hỗ trợ định dạng: .xlsx, .xls • Dung lượng tối đa: 10MB</small>
                  </div>

                  <div className="scheduling-bulk-excel-helper-stack">
                    <article className="scheduling-bulk-excel-template">
                      <div>
                        <span aria-hidden="true"><FileSpreadsheet size={18} strokeWidth={2.35} /></span>
                        <strong>Tải file mẫu để bắt đầu</strong>
                        <p>Sử dụng file mẫu chuẩn của hệ thống để đảm bảo dữ liệu được import chính xác.</p>
                        <button type="button" onClick={exportPreviewFile}>
                          <Download size={14} strokeWidth={2.45} aria-hidden="true" />
                          Tải mẫu file Excel
                        </button>
                      </div>
                      <div className="scheduling-bulk-excel-mini-sheet" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                    </article>

                    <article className="scheduling-bulk-excel-guide">
                      <div className="scheduling-bulk-side-title">
                        <BookOpenCheck size={15} strokeWidth={2.4} aria-hidden="true" />
                        <strong>Hướng dẫn import</strong>
                      </div>
                      <ul>
                        <li><Check size={13} strokeWidth={2.5} aria-hidden="true" />Đọc hướng dẫn chi tiết</li>
                        <li><Check size={13} strokeWidth={2.5} aria-hidden="true" />Xem video hướng dẫn</li>
                        <li><Check size={13} strokeWidth={2.5} aria-hidden="true" />Các lưu ý quan trọng</li>
                      </ul>
                      <button
                        type="button"
                        onClick={() => openCommandPanel('guide', 'Đang mở hướng dẫn import file Excel.')}
                      >
                        <Eye size={14} strokeWidth={2.4} aria-hidden="true" />
                        Xem hướng dẫn
                      </button>
                    </article>
                  </div>
                </div>
              </section>

              <section className="scheduling-bulk-excel-preview">
                <div className="scheduling-bulk-section-title">
                  <span>2.</span>
                  <strong>Dữ liệu trong file (xem trước)</strong>
                </div>
                <strong className="scheduling-bulk-excel-preview__label">Kết quả kiểm tra</strong>

                <div className="scheduling-bulk-excel-stats">
                  <article>
                    <span>Tổng dòng</span>
                    <strong>12.480</strong>
                  </article>
                  <article className="is-valid">
                    <span>Hợp lệ</span>
                    <strong>12.180 <small>(97.59%)</small></strong>
                  </article>
                  <article className="is-warning">
                    <span>Cảnh báo</span>
                    <strong>180 <small>(1.44%)</small></strong>
                  </article>
                  <article className="is-error">
                    <span>Lỗi</span>
                    <strong>120 <small>(0.96%)</small></strong>
                  </article>
                </div>

                <div className="scheduling-bulk-excel-table-wrap">
                  <table className="scheduling-bulk-excel-table">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <th>Ngày khám</th>
                        <th>Bác sĩ</th>
                        <th>Khoa / Phòng</th>
                        <th>Dịch vụ</th>
                        <th>Khung giờ</th>
                        <th>Slot</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelPreviewRows.map(([index, date, doctor, department, service, time, slots, status, tone]) => (
                        <tr key={`${index}-${doctor}-${time}`}>
                          <td>{index}</td>
                          <td>{date}</td>
                          <td>{doctor}</td>
                          <td>{department}</td>
                          <td>{service}</td>
                          <td>{time}</td>
                          <td>{slots}</td>
                          <td><span className={`is-${tone}`}>{status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="scheduling-bulk-excel-preview__footer">
                  <span>Hiển thị 5 dòng đầu tiên</span>
                  <button type="button" onClick={() => setActionMessage('Đã mở toàn bộ dữ liệu import để kiểm tra.')}>
                    Xem tất cả dữ liệu
                    <ArrowRight size={14} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {isCopyMethod ? (
            <div className="scheduling-bulk-copy-workspace">
              <section className="scheduling-bulk-copy-source">
                <div className="scheduling-bulk-section-title">
                  <span>1.</span>
                  <strong>Chọn lịch nguồn (lịch để sao chép)</strong>
                </div>

                <div className="scheduling-bulk-copy-tabs" role="tablist" aria-label="Chọn loại lịch nguồn">
                  {[
                    ['doctor', 'Theo bác sĩ'],
                    ['department', 'Theo khoa phòng'],
                    ['template', 'Theo mẫu lịch đã lưu'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={selectedCopySourceTab === id ? 'is-active' : ''}
                      onClick={() => {
                        setSelectedCopySourceTab(id);
                        setActionMessage(`Đã chọn lịch nguồn: ${label}.`);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="scheduling-bulk-copy-picker-grid">
                  <label className="scheduling-bulk-field is-required">
                    <span>Chọn bác sĩ</span>
                    <button type="button" className="scheduling-bulk-field__control scheduling-bulk-copy-doctor">
                      <img src="/images/scheduling/doctors/doctor-lan.svg" alt="BS. Trần Minh Anh" />
                      <strong>BS. Trần Minh Anh</strong>
                      <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
                    </button>
                  </label>
                  <label className="scheduling-bulk-field">
                    <span>Chuyên khoa</span>
                    <button type="button" className="scheduling-bulk-field__control scheduling-bulk-selectlike">
                      <HeartPulse size={15} strokeWidth={2.35} aria-hidden="true" />
                      <strong>{selectedDepartment}</strong>
                      <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
                    </button>
                  </label>
                </div>

                <label className="scheduling-bulk-field is-required scheduling-bulk-copy-source-range">
                  <span>Chọn khoảng thời gian nguồn</span>
                  <button type="button" className="scheduling-bulk-field__control scheduling-bulk-date-range">
                    <CalendarDays size={15} strokeWidth={2.4} aria-hidden="true" />
                    <strong>28/04/2026</strong>
                    <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
                    <strong>04/05/2026</strong>
                    <CalendarCheck2 size={14} strokeWidth={2.35} aria-hidden="true" />
                  </button>
                  <div className="scheduling-bulk-copy-presets">
                    {['Tuần này', 'Tuần trước', 'Tháng này', 'Khoảng tùy chọn'].map((label) => (
                      <button key={label} type="button" onClick={() => setActionMessage(`Đã chọn nhanh nguồn: ${label}.`)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </label>

                <div className="scheduling-bulk-source-calendar">
                  <div>
                    <strong>Lịch nguồn</strong>
                    <span>(28/04 - 04/05/2026)</span>
                  </div>
                  <div className="scheduling-bulk-source-calendar__legend">
                    <span><i className="is-morning" />Ca sáng</span>
                    <span><i className="is-afternoon" />Ca chiều</span>
                    <span><i className="is-off" />Nghỉ</span>
                  </div>
                  <div className="scheduling-bulk-source-week">
                    {copySourceDays.map(([day, date, start, end, mode]) => (
                      <article key={`${day}-${date}`} className={mode === 'off' ? 'is-off' : ''}>
                        <strong>{day}</strong>
                        <span>{date}</span>
                        <em>{start}</em>
                        {end ? <em>{end}</em> : null}
                      </article>
                    ))}
                  </div>
                  <button type="button" onClick={() => setActionMessage('Đã mở chi tiết lịch nguồn.')}>
                    <CalendarCheck2 size={14} strokeWidth={2.35} aria-hidden="true" />
                    Xem chi tiết lịch nguồn
                  </button>
                </div>
              </section>

              <section className="scheduling-bulk-copy-setup">
                <div className="scheduling-bulk-section-title">
                  <span>2.</span>
                  <strong>Thiết lập sao chép</strong>
                </div>

                <div className="scheduling-bulk-copy-setup-grid">
                  <label className="scheduling-bulk-field is-required">
                    <span>Áp dụng cho</span>
                    <button type="button" className="scheduling-bulk-field__control scheduling-bulk-selectlike">
                      <Layers3 size={14} strokeWidth={2.35} aria-hidden="true" />
                      <strong>Khoảng dài ngày</strong>
                      <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
                    </button>
                  </label>
                  <label className="scheduling-bulk-field is-required">
                    <span>Khoảng dài ngày áp dụng</span>
                    <button type="button" className="scheduling-bulk-field__control scheduling-bulk-date-range">
                      <strong>{formatDateDisplay(dateRange.start)}</strong>
                      <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
                      <strong>{formatDateDisplay(dateRange.end)}</strong>
                      <CalendarDays size={14} strokeWidth={2.35} aria-hidden="true" />
                    </button>
                  </label>
                </div>

                <div className="scheduling-bulk-copy-presets">
                  {['1 tuần', '2 tuần', '4 tuần', 'Tùy chọn'].map((label) => (
                    <button
                      key={label}
                      type="button"
                      className={selectedCopyTargetPreset === label ? 'is-selected' : ''}
                      onClick={() => {
                        setSelectedCopyTargetPreset(label);
                        setActionMessage(`Đã chọn khoảng áp dụng: ${label}.`);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="scheduling-bulk-copy-mode">
                  <strong>Lặp lại lịch nguồn</strong>
                  {[
                    ['keep', 'Giữ nguyên cấu trúc lịch', 'Giữ nguyên các ngày trong tuần và khung giờ như lịch nguồn'],
                    ['repeat-range', 'Lặp lại tuần đến khi hết khoảng dài ngày', 'Lặp lại tuần nguồn theo thứ tự cho đến khi hết khoảng áp dụng'],
                    ['custom', 'Tùy chỉnh nâng cao', 'Cho phép chọn ngày và khung giờ cụ thể'],
                  ].map(([id, title, copy]) => (
                    <button
                      key={id}
                      type="button"
                      className={selectedCopyMode === id ? 'is-radio-selected' : ''}
                      onClick={() => {
                        setSelectedCopyMode(id);
                        setActionMessage(`Đã chọn kiểu sao chép: ${title}.`);
                      }}
                    >
                      <span />
                      <strong>{title}</strong>
                      <small>{copy}</small>
                    </button>
                  ))}
                </div>

                <div className="scheduling-bulk-copy-end">
                  <strong>Kết thúc</strong>
                  <button
                    type="button"
                    className={selectedRepeatEnd === 'unlimited' ? 'is-radio-selected' : ''}
                    onClick={() => setSelectedRepeatEnd('unlimited')}
                  >
                    <span />
                    Không giới hạn
                  </button>
                  <button
                    type="button"
                    className={selectedRepeatEnd === 'date' ? 'is-radio-selected' : ''}
                    onClick={() => setSelectedRepeatEnd('date')}
                  >
                    <span />
                    Kết thúc vào ngày
                    <strong>{formatDateDisplay(repeatEndDate)}</strong>
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          <section className="scheduling-bulk-basic-card" id="bulk-step-basic">
            <div className="scheduling-bulk-section-title">
              <span>1.</span>
              <strong>Thông tin cơ bản</strong>
            </div>

            <div className="scheduling-bulk-basic-grid">
              <label className="scheduling-bulk-field is-required">
                <span>Chọn bác sĩ</span>
                <button type="button" className="scheduling-bulk-field__control scheduling-bulk-doctor-select" onClick={() => toggleFieldMenu('doctors')}>
                  <span className="scheduling-bulk-avatar-stack">
                    {avatarDoctors.map((doctor, index) => (
                      <img
                        key={doctor.id || doctor.name}
                        src={doctorAvatarMap[doctor.id] || fallbackDoctorAvatars[index] || '/images/scheduling/doctors/doctor-ai-fallback.png'}
                        alt={doctor.name}
                      />
                    ))}
                    <em>+8</em>
                  </span>
                  <strong>{selectedDoctorGroup}</strong>
                  <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
                {openFieldMenu === 'doctors' ? (
                  <div className="scheduling-bulk-field-menu">
                    {doctorGroupOptions.map((option) => (
                      <button key={option} type="button" className={selectedDoctorGroup === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setSelectedDoctorGroup, option, `Đã chọn nhóm bác sĩ: ${option}.`)}>
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>

              <label className="scheduling-bulk-field is-required">
                <span>Chọn khoa</span>
                <button type="button" className="scheduling-bulk-field__control scheduling-bulk-selectlike" onClick={() => toggleFieldMenu('department')}>
                  <HeartPulse size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>{selectedDepartment}</strong>
                  <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
                {openFieldMenu === 'department' ? (
                  <div className="scheduling-bulk-field-menu">
                    {departmentOptions.map((option) => (
                      <button key={option} type="button" className={selectedDepartment === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setSelectedDepartment, option, `Đã chọn khoa: ${option}.`)}>
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>

              <label className="scheduling-bulk-field is-required">
                <span>Loại lịch</span>
                <button type="button" className="scheduling-bulk-field__control scheduling-bulk-selectlike" onClick={() => toggleFieldMenu('scheduleType')}>
                  <CalendarCheck2 size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>{selectedScheduleType}</strong>
                  <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
                {openFieldMenu === 'scheduleType' ? (
                  <div className="scheduling-bulk-field-menu">
                    {scheduleTypeOptions.map((option) => (
                      <button key={option} type="button" className={selectedScheduleType === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setSelectedScheduleType, option, `Đã chọn loại lịch: ${option}.`)}>
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>

              <label className="scheduling-bulk-field is-required">
                <span>{isDateRangeMethod ? 'Dải ngày áp dụng' : 'Khoảng thời gian áp dụng'}</span>
                <button type="button" className="scheduling-bulk-field__control scheduling-bulk-date-range" onClick={() => toggleFieldMenu('dateRange')}>
                  <CalendarDays size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>{formatDateDisplay(dateRange.start)}</strong>
                  <ArrowRight size={13} strokeWidth={2.5} aria-hidden="true" />
                  <strong>{formatDateDisplay(dateRange.end)}</strong>
                  <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
                {openFieldMenu === 'dateRange' ? (
                  <div className="scheduling-bulk-field-menu scheduling-bulk-date-menu">
                    <div>
                      <span>Từ ngày</span>
                      <input type="date" value={dateRange.start} onChange={(event) => setDateRange((current) => ({ ...current, start: event.target.value }))} />
                    </div>
                    <div>
                      <span>Đến ngày</span>
                      <input type="date" value={dateRange.end} onChange={(event) => setDateRange((current) => ({ ...current, end: event.target.value }))} />
                    </div>
                    {rangePresetOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => {
                          setDateRange({ start: option.start, end: option.end });
                          setOpenFieldMenu('');
                          setActionMessage(`Đã áp dụng khoảng thời gian: ${option.label}.`);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {isDateRangeMethod ? (
                  <div className="scheduling-bulk-date-range-presets">
                    {dateRangePresetOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        className={selectedDateRangePreset === option.label ? 'is-selected' : ''}
                        onClick={() => applyDateRangePreset(option)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>
            </div>

            <div className="scheduling-bulk-basic-metrics">
              <div>
                <UsersRound size={14} strokeWidth={2.35} aria-hidden="true" />
                <span>Tổng bác sĩ: <strong>{projectedDoctors}</strong></span>
              </div>
              <div>
                <CalendarDays size={14} strokeWidth={2.35} aria-hidden="true" />
                <span>Tổng ngày áp dụng: <strong>{projectedDays} ngày</strong></span>
              </div>
              <div>
                <CalendarCheck2 size={14} strokeWidth={2.35} aria-hidden="true" />
                <span>Tổng slot dự kiến: <strong>{projectedSlots}</strong></span>
              </div>
              <div>
                <UsersRound size={14} strokeWidth={2.35} aria-hidden="true" />
                <span>Tổng bệnh nhân dự kiến: <strong>{projectedPatients}</strong></span>
              </div>
              <button
                type="button"
                className={isBasicDetailOpen ? 'is-selected' : ''}
                onClick={() => {
                  setIsBasicDetailOpen((current) => !current);
                  setActionMessage(isBasicDetailOpen ? 'Đã thu gọn chi tiết cấu hình.' : 'Đã mở chi tiết cấu hình hàng loạt.');
                }}
              >
                Xem chi tiết
                <ChevronDown size={13} strokeWidth={2.35} aria-hidden="true" />
              </button>
            </div>
            {isBasicDetailOpen ? (
              <div className="scheduling-bulk-detail-strip">
                <span>Phương thức: <strong>{selectedMethodInfo.title}</strong></span>
                <span>Mẫu: <strong>{selectedTemplateInfo.title}</strong></span>
                <span>Khoảng ngày: <strong>{formatDateDisplay(dateRange.start)} - {formatDateDisplay(dateRange.end)}</strong></span>
                <span>Ngày lặp: <strong>{selectedDays.join(', ') || 'Chưa chọn'}</strong></span>
              </div>
            ) : null}
          </section>

          <div className="scheduling-bulk-detail-grid">
            <section className="scheduling-bulk-work-card" id="bulk-step-work">
              <div className="scheduling-bulk-section-title">
                <span>2.</span>
                <strong>Cấu hình lịch làm việc</strong>
              </div>

              <div className="scheduling-bulk-card-kicker">Khung giờ làm việc</div>
              <div className="scheduling-bulk-work-grid">
                <label className="scheduling-bulk-field is-required">
                  <span>Giờ bắt đầu</span>
                  <button type="button" className="scheduling-bulk-field__control" onClick={() => toggleFieldMenu('workStart')}>
                    <strong>{workStart}</strong>
                    <Clock3 size={13} strokeWidth={2.35} aria-hidden="true" />
                  </button>
                  {openFieldMenu === 'workStart' ? (
                    <div className="scheduling-bulk-field-menu">
                      {timeOptions.map((option) => (
                        <button key={option} type="button" className={workStart === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setWorkStart, option, `Đã chọn giờ bắt đầu: ${option}.`)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label className="scheduling-bulk-field is-required">
                  <span>Giờ kết thúc</span>
                  <button type="button" className="scheduling-bulk-field__control" onClick={() => toggleFieldMenu('workEnd')}>
                    <strong>{workEnd}</strong>
                    <Clock3 size={13} strokeWidth={2.35} aria-hidden="true" />
                  </button>
                  {openFieldMenu === 'workEnd' ? (
                    <div className="scheduling-bulk-field-menu">
                      {timeOptions.map((option) => (
                        <button key={option} type="button" className={workEnd === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setWorkEnd, option, `Đã chọn giờ kết thúc: ${option}.`)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label className="scheduling-bulk-field is-required">
                  <span>Thời lượng mỗi slot</span>
                  <button type="button" className="scheduling-bulk-field__control" onClick={() => toggleFieldMenu('slotDuration')}>
                    <strong>{slotDuration}</strong>
                    <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
                  </button>
                  {openFieldMenu === 'slotDuration' ? (
                    <div className="scheduling-bulk-field-menu">
                      {slotDurationOptions.map((option) => (
                        <button key={option} type="button" className={slotDuration === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setSlotDuration, option, `Đã chọn thời lượng mỗi slot: ${option}.`)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>
                <label className="scheduling-bulk-field is-required">
                  <span>Số slot mỗi khung giờ</span>
                  <button type="button" className="scheduling-bulk-field__control" onClick={() => toggleFieldMenu('slotCapacity')}>
                    <strong>{slotCapacity}</strong>
                    <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
                  </button>
                  {openFieldMenu === 'slotCapacity' ? (
                    <div className="scheduling-bulk-field-menu">
                      {slotCapacityOptions.map((option) => (
                        <button key={option} type="button" className={slotCapacity === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setSlotCapacity, option, `Đã chọn số slot mỗi khung giờ: ${option}.`)}>
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>
              </div>

              <div className="scheduling-bulk-break-panel">
                <div className="scheduling-bulk-break-head">
                  <strong>Nghỉ giữa khung giờ</strong>
                  <button
                    type="button"
                    className={isBreakEnabled ? 'is-on' : ''}
                    aria-label="Bật nghỉ giữa khung giờ"
                    aria-pressed={isBreakEnabled}
                    onClick={() => {
                      setIsBreakEnabled((current) => !current);
                      setOpenFieldMenu('');
                      setActionMessage(isBreakEnabled ? 'Đã tắt nghỉ giữa khung giờ.' : 'Đã bật nghỉ giữa khung giờ.');
                    }}
                  >
                    <span />
                  </button>
                </div>
                <div className="scheduling-bulk-break-grid">
                  <label className="scheduling-bulk-field">
                    <span>Bắt đầu nghỉ</span>
                    <button type="button" className="scheduling-bulk-field__control" disabled={!isBreakEnabled} onClick={() => toggleFieldMenu('breakStart')}>
                      <strong>{breakStart}</strong>
                      <Clock3 size={13} strokeWidth={2.35} aria-hidden="true" />
                    </button>
                    {openFieldMenu === 'breakStart' ? (
                      <div className="scheduling-bulk-field-menu">
                        {timeOptions.map((option) => (
                          <button key={option} type="button" className={breakStart === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setBreakStart, option, `Đã chọn giờ bắt đầu nghỉ: ${option}.`)}>
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                  <label className="scheduling-bulk-field is-required">
                    <span>Kết thúc nghỉ</span>
                    <button type="button" className="scheduling-bulk-field__control" disabled={!isBreakEnabled} onClick={() => toggleFieldMenu('breakEnd')}>
                      <strong>{breakEnd}</strong>
                      <Clock3 size={13} strokeWidth={2.35} aria-hidden="true" />
                    </button>
                    {openFieldMenu === 'breakEnd' ? (
                      <div className="scheduling-bulk-field-menu">
                        {timeOptions.map((option) => (
                          <button key={option} type="button" className={breakEnd === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setBreakEnd, option, `Đã chọn giờ kết thúc nghỉ: ${option}.`)}>
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                </div>
                <div className="scheduling-bulk-break-actions">
                  <button
                    type="button"
                    className="is-muted"
                    onClick={() => {
                      setExtraBreaks([]);
                      setActionMessage('Đã xóa các khoảng nghỉ bổ sung.');
                    }}
                  >
                    Không nghỉ khác
                  </button>
                  <button type="button" className="is-add" onClick={addExtraBreak}>
                    <Plus size={13} strokeWidth={2.45} aria-hidden="true" />
                    Thêm khoảng nghỉ
                  </button>
                </div>
                {extraBreaks.length ? (
                  <div className="scheduling-bulk-break-note">
                    {extraBreaks.map((item) => <span key={item.id}>{item.label}</span>)}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="scheduling-bulk-advanced-card" id="bulk-step-advanced">
              <div className="scheduling-bulk-section-title">
                <span>3.</span>
                <strong>Tùy chọn nâng cao</strong>
              </div>

              <div className="scheduling-bulk-advanced-tabs" role="tablist" aria-label="Tùy chọn nâng cao">
                <button
                  type="button"
                  className={selectedAdvancedTab === 'repeat' ? 'is-active' : ''}
                  onClick={() => {
                    setSelectedAdvancedTab('repeat');
                    setActionMessage('Đã mở cấu hình lặp lại lịch.');
                  }}
                >
                  Lặp lại lịch
                </button>
                <button
                  type="button"
                  className={selectedAdvancedTab === 'templates' ? 'is-active' : ''}
                  onClick={() => {
                    setSelectedAdvancedTab('templates');
                    setActiveCommandPanel('templates');
                    setActionMessage('Đã mở mẫu có sẵn.');
                  }}
                >
                  Mẫu có sẵn
                </button>
                <button
                  type="button"
                  className={selectedAdvancedTab === 'settings' ? 'is-active' : ''}
                  onClick={() => {
                    setSelectedAdvancedTab('settings');
                    setActionMessage('Đã mở thiết lập khác.');
                  }}
                >
                  Thiết lập khác
                </button>
              </div>

              {selectedAdvancedTab === 'repeat' ? (
              <div className="scheduling-bulk-advanced-grid">
                <div className="scheduling-bulk-repeat-column">
                  {isDateRangeMethod ? (
                    <div className="scheduling-bulk-date-rule">
                      <strong>Áp dụng cho các ngày</strong>
                      <button
                        type="button"
                        className={selectedDayType === 'all' ? 'is-radio-selected' : ''}
                        onClick={() => {
                          setSelectedDayType('all');
                          setActionMessage('Đã áp dụng lịch cho tất cả các ngày trong dải.');
                        }}
                      >
                        <span />
                        Tất cả các ngày
                      </button>
                      <button
                        type="button"
                        className={selectedDayType === 'workdays' ? 'is-radio-selected' : ''}
                        onClick={() => {
                          setSelectedDayType('workdays');
                          setSelectedDays(['T2', 'T3', 'T4', 'T5', 'T6']);
                          setActionMessage('Đã áp dụng lịch cho ngày làm việc trong dải.');
                        }}
                      >
                        <span />
                        Chỉ ngày làm việc (T2 - T6)
                      </button>
                      <button
                        type="button"
                        className={selectedDayType === 'weekend' ? 'is-radio-selected' : ''}
                        onClick={() => {
                          setSelectedDayType('weekend');
                          setSelectedDays(['T7', 'CN']);
                          setActionMessage('Đã áp dụng lịch cho cuối tuần trong dải.');
                        }}
                      >
                        <span />
                        Chỉ cuối tuần (T7 - CN)
                      </button>

                      <div className="scheduling-bulk-repeat-end scheduling-bulk-repeat-end--date-range">
                        <strong>Kết thúc</strong>
                        <button
                          type="button"
                          className={selectedRepeatEnd === 'unlimited' ? 'is-radio-selected' : ''}
                          onClick={() => {
                            setSelectedRepeatEnd('unlimited');
                            setActionMessage('Đã chọn không giới hạn trong dải ngày áp dụng.');
                          }}
                        >
                          <span />
                          Không giới hạn
                        </button>
                        <button
                          type="button"
                          className={selectedRepeatEnd === 'date' ? 'is-radio-selected' : ''}
                          onClick={() => {
                            setSelectedRepeatEnd('date');
                            toggleFieldMenu('repeatEndDate');
                            setActionMessage(`Đã chọn kết thúc vào ngày ${formatDateDisplay(repeatEndDate)}.`);
                          }}
                          aria-expanded={openFieldMenu === 'repeatEndDate'}
                        >
                          <span />
                          Kết thúc vào ngày
                          <strong>{formatDateDisplay(repeatEndDate)}</strong>
                        </button>
                        {openFieldMenu === 'repeatEndDate' ? (
                          <div className="scheduling-bulk-field-menu scheduling-bulk-repeat-menu">
                            <div>
                              <span>Ngày kết thúc</span>
                              <input
                                type="date"
                                value={repeatEndDate}
                                onChange={(event) => {
                                  setRepeatEndDate(event.target.value);
                                  setActionMessage(`Đã đổi ngày kết thúc lặp thành ${formatDateDisplay(event.target.value)}.`);
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setRepeatEndDate(dateRange.end);
                                setOpenFieldMenu('');
                                setActionMessage('Đã đồng bộ ngày kết thúc với dải ngày áp dụng.');
                              }}
                            >
                              Theo ngày kết thúc áp dụng
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <label className="scheduling-bulk-date-step">
                        <span>Lặp lại mỗi</span>
                        <input
                          type="number"
                          min="1"
                          value="1"
                          onChange={() => setActionMessage('Dải ngày đang lặp liên tục từng ngày.')}
                        />
                        <em>ngày</em>
                      </label>
                    </div>
                  ) : (
                    <>
                  <label className="scheduling-bulk-field">
                    <span>{isRangeMethod ? 'Áp dụng vào các ngày' : 'Lặp theo'}</span>
                    <button
                      type="button"
                      className="scheduling-bulk-field__control scheduling-bulk-selectlike"
                      onClick={() => toggleFieldMenu(isRangeMethod ? 'rangeInterval' : 'repeatFrequency')}
                    >
                      <Layers3 size={14} strokeWidth={2.35} aria-hidden="true" />
                      <strong>{isRangeMethod ? rangeInterval : repeatFrequency}</strong>
                      <ChevronDown size={14} strokeWidth={2.35} aria-hidden="true" />
                    </button>
                    {openFieldMenu === (isRangeMethod ? 'rangeInterval' : 'repeatFrequency') ? (
                      <div className="scheduling-bulk-field-menu">
                        {(isRangeMethod ? rangeIntervalOptions : repeatFrequencyOptions).map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={(isRangeMethod ? rangeInterval : repeatFrequency) === option ? 'is-selected' : ''}
                            onClick={() => chooseFieldValue(
                              isRangeMethod ? setRangeInterval : setRepeatFrequency,
                              option,
                              isRangeMethod ? `Đã chọn khoảng lặp: ${option}.` : `Đã chọn kiểu lặp: ${option}.`,
                            )}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>

                  {isRangeMethod ? (
                    <label className="scheduling-bulk-range-start">
                      <span>Ngày bắt đầu</span>
                      <span>
                        <input
                          type="date"
                          value={rangeRepeatStart}
                          onChange={(event) => {
                            setRangeRepeatStart(event.target.value);
                            setActionMessage(`Đã chọn ngày bắt đầu khoảng lặp: ${formatDateDisplay(event.target.value)}.`);
                          }}
                        />
                        <CalendarDays size={13} strokeWidth={2.35} aria-hidden="true" />
                      </span>
                    </label>
                  ) : (
                    <div className="scheduling-bulk-repeat-days" aria-label="Ngày lặp lịch">
                      {allWeekDays.map((day) => (
                        <button key={day} type="button" className={selectedDays.includes(day) ? 'is-selected' : ''} onClick={() => toggleDay(day)}>
                          {day}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="scheduling-bulk-repeat-end">
                    <strong>{isRangeMethod ? 'Lặp đến' : 'Kết thúc'}</strong>
                    {!isRangeMethod ? (
                      <button
                        type="button"
                        className={selectedRepeatEnd === 'unlimited' ? 'is-radio-selected' : ''}
                        onClick={() => {
                          setSelectedRepeatEnd('unlimited');
                          setActionMessage('Đã chọn không giới hạn lịch lặp.');
                        }}
                      >
                        <span />
                        Không giới hạn
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={selectedRepeatEnd === 'date' ? 'is-radio-selected' : ''}
                      onClick={() => {
                        setSelectedRepeatEnd('date');
                        toggleFieldMenu('repeatEndDate');
                        setActionMessage(`Đã chọn kết thúc vào ngày ${formatDateDisplay(repeatEndDate)}.`);
                      }}
                      aria-expanded={openFieldMenu === 'repeatEndDate'}
                    >
                      <span />
                      {isRangeMethod ? 'Ngày kết thúc' : 'Kết thúc vào ngày'}
                      <strong>{formatDateDisplay(repeatEndDate)}</strong>
                    </button>
                    {openFieldMenu === 'repeatEndDate' ? (
                      <div className="scheduling-bulk-field-menu scheduling-bulk-repeat-menu">
                        <div>
                          <span>Ngày kết thúc</span>
                          <input
                            type="date"
                            value={repeatEndDate}
                            onChange={(event) => {
                              setRepeatEndDate(event.target.value);
                              setActionMessage(`Đã đổi ngày kết thúc lặp thành ${formatDateDisplay(event.target.value)}.`);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRepeatEndDate(dateRange.end);
                            setOpenFieldMenu('');
                            setActionMessage('Đã đồng bộ ngày kết thúc với khoảng áp dụng.');
                          }}
                        >
                          Theo ngày kết thúc áp dụng
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={selectedRepeatEnd === 'count' ? 'is-radio-selected' : ''}
                      onClick={() => {
                        setSelectedRepeatEnd('count');
                        toggleFieldMenu('repeatCount');
                        setActionMessage(`Đã chọn lặp lại ${repeatCount} lần.`);
                      }}
                      aria-expanded={openFieldMenu === 'repeatCount'}
                    >
                      <span />
                      {isRangeMethod ? 'Số lần lặp' : 'Lặp lại'}
                      <strong>{repeatCount} lần</strong>
                    </button>
                    {openFieldMenu === 'repeatCount' ? (
                      <div className="scheduling-bulk-field-menu scheduling-bulk-repeat-menu is-count-menu">
                        {repeatCountOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={repeatCount === option ? 'is-selected' : ''}
                            onClick={() => {
                              setRepeatCount(option);
                              setOpenFieldMenu('');
                              setActionMessage(`Đã đặt số lần lặp là ${option} lần.`);
                            }}
                          >
                            {option} lần
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                    </>
                  )}
                </div>

                <div className="scheduling-bulk-day-type">
                  <strong>Loại ngày</strong>
                  <button
                    type="button"
                    className={selectedDayType === 'all' ? 'is-checked' : ''}
                    onClick={() => {
                      setSelectedDayType('all');
                      setActionMessage('Đã áp dụng tất cả các ngày.');
                    }}
                  >
                    <Check size={13} strokeWidth={2.6} aria-hidden="true" />
                    Tất cả các ngày
                  </button>
                  <button
                    type="button"
                    className={selectedDayType === 'workdays' ? 'is-checked' : ''}
                    onClick={() => {
                      setSelectedDayType('workdays');
                      setSelectedDays(['T2', 'T3', 'T4', 'T5', 'T6']);
                      setActionMessage('Đã chỉ áp dụng ngày làm việc.');
                    }}
                  >
                    <span />
                    Chỉ ngày làm việc (T2 - T6)
                  </button>
                  <button
                    type="button"
                    className={selectedDayType === 'weekend' ? 'is-checked' : ''}
                    onClick={() => {
                      setSelectedDayType('weekend');
                      setSelectedDays(['T7', 'CN']);
                      setActionMessage('Đã chỉ áp dụng cuối tuần.');
                    }}
                  >
                    <span />
                    Chỉ cuối tuần (T7 - CN)
                  </button>

                  <div className="scheduling-bulk-exception">
                    <span>Ngày ngoại lệ</span>
                    <button
                      type="button"
                      onClick={() => {
                        toggleFieldMenu('exceptionDate');
                        setActionMessage('Đã mở chọn ngày ngoại lệ.');
                      }}
                      aria-expanded={openFieldMenu === 'exceptionDate'}
                    >
                      <Plus size={13} strokeWidth={2.45} aria-hidden="true" />
                      Thêm ngày ngoại lệ
                    </button>
                    {openFieldMenu === 'exceptionDate' ? (
                      <div className="scheduling-bulk-field-menu scheduling-bulk-exception-menu">
                        {exceptionDateOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            className={exceptionDates.some((item) => item.value === option.value) ? 'is-selected' : ''}
                            onClick={() => addExceptionDate(option)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {exceptionDates.length > 0 ? (
                      <div className="scheduling-bulk-exception-list">
                        {exceptionDates.map((item) => (
                          <button key={item.value} type="button" onClick={() => removeExceptionDate(item.value)}>
                            {item.label}
                            <span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              ) : null}

              {selectedAdvancedTab === 'templates' ? (
                <div className="scheduling-bulk-tab-panel">
                  {bulkSavedTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className={selectedTemplate === template.id ? 'is-selected' : ''}
                      onClick={() => applySavedTemplate(template)}
                    >
                      <Save size={15} strokeWidth={2.35} aria-hidden="true" />
                      <strong>{template.title}</strong>
                      <span>{template.copy}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {selectedAdvancedTab === 'settings' ? (
                <div className="scheduling-bulk-setting-grid">
                  <button type="button" className="is-selected" onClick={() => setActionMessage('Đã bật kiểm tra xung đột tự động.')}>
                    <CircleCheck size={15} strokeWidth={2.4} aria-hidden="true" />
                    Kiểm tra xung đột tự động
                  </button>
                  <button type="button" onClick={() => setActionMessage('Đã bật ưu tiên bác sĩ ít lịch.')}>
                    <UsersRound size={15} strokeWidth={2.4} aria-hidden="true" />
                    Ưu tiên bác sĩ ít lịch
                  </button>
                  <button type="button" onClick={() => setActionMessage('Đã bật nhắc kiểm tra trước khi công khai.')}>
                    <ShieldCheck size={15} strokeWidth={2.4} aria-hidden="true" />
                    Nhắc trước khi công khai
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          <section className="scheduling-bulk-allocation-card">
            <div className="scheduling-bulk-allocation-head">
              <div className="scheduling-bulk-section-title">
                <span>{isCopyMethod ? '3.' : '4.'}</span>
                <strong>Chọn bác sĩ & phân bổ lịch</strong>
              </div>

              <div className="scheduling-bulk-distribution-tabs" role="group" aria-label="Kiểu phân bổ lịch">
                <button
                  type="button"
                  className={selectedDistribution === 'even' ? 'is-selected' : ''}
                  onClick={() => handleDistributionChange('even')}
                >
                  <span />
                  Áp dụng đồng đều cho tất cả
                </button>
                <button
                  type="button"
                  className={selectedDistribution === 'ratio' ? 'is-selected' : ''}
                  onClick={() => handleDistributionChange('ratio')}
                >
                  <span />
                  Phân bổ theo tỷ lệ
                </button>
                <button
                  type="button"
                  className={selectedDistribution === 'custom' ? 'is-selected' : ''}
                  onClick={() => handleDistributionChange('custom')}
                >
                  <span />
                  Phân bổ tùy chỉnh
                </button>
              </div>
            </div>

            <div className="scheduling-bulk-doctor-pool">
              {selectedAllocationDoctors.map((doctor) => (
                <article key={doctor.id} className="scheduling-bulk-doctor-pill">
                  <img src={doctor.avatar} alt={doctor.name} />
                  <span>
                    <strong>{doctor.name}</strong>
                    <small>{doctor.department}</small>
                  </span>
                  <em>{doctor.growth}</em>
                  <button
                    type="button"
                    className="scheduling-bulk-doctor-pill__remove"
                    aria-label={`Gỡ ${doctor.name}`}
                    onClick={() => removeAllocationDoctor(doctor.id)}
                  >
                    ×
                  </button>
                </article>
              ))}

              <div className="scheduling-bulk-add-doctor-wrap">
                <button
                  type="button"
                  className="scheduling-bulk-add-doctor"
                  onClick={() => {
                    setIsDoctorPickerOpen((current) => !current);
                    setActionMessage('Đã mở danh sách thêm bác sĩ vào lịch hàng loạt.');
                  }}
                  aria-expanded={isDoctorPickerOpen}
                >
                  <Plus size={17} strokeWidth={2.5} aria-hidden="true" />
                  Thêm bác sĩ
                </button>
                {isDoctorPickerOpen ? (
                  <div className="scheduling-bulk-doctor-picker">
                    {availableAllocationDoctors.length > 0 ? (
                      availableAllocationDoctors.map((doctor) => (
                        <button key={doctor.id} type="button" onClick={() => addAllocationDoctor(doctor.id)}>
                          <img src={doctor.avatar} alt={doctor.name} />
                          <span>
                            <strong>{doctor.name}</strong>
                            <small>{doctor.department}</small>
                          </span>
                          <Plus size={14} strokeWidth={2.45} aria-hidden="true" />
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAllocationDoctorIds(bulkAllocationDoctors.map((doctor) => doctor.id));
                          setIsDoctorPickerOpen(false);
                          setActionMessage('Đã khôi phục danh sách bác sĩ mặc định.');
                        }}
                      >
                        Khôi phục danh sách mặc định
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="scheduling-bulk-preview-card" id="bulk-step-preview">
              <div className="scheduling-bulk-preview-head">
                <div>
                  <CalendarCheck2 size={15} strokeWidth={2.35} aria-hidden="true" />
                  <strong>Xem trước lịch <span>({projectedDays} ngày)</span></strong>
                </div>
                <div className="scheduling-bulk-preview-badges">
                  {isDateRangeMethod ? <span>{projectedDays} ngày</span> : null}
                  <span>{displayedPreviewSlots} slot dự kiến</span>
                  <span>{displayedPreviewPatients} bệnh nhân dự kiến</span>
                </div>
                <div className="scheduling-bulk-preview-legend">
                  {isDateRangeMethod ? (
                    <>
                      <i className="is-morning" /> Có lịch
                      <i className="is-off" /> Nghỉ
                      <i className="is-extra" /> Ngoại lệ
                    </>
                  ) : (
                    <>
                      <i className="is-morning" /> Ca sáng
                      <i className="is-afternoon" /> Ca chiều
                      <i className="is-extra" /> Ngoài giờ
                      <i className="is-off" /> Nghỉ
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className={isPreviewDetailOpen ? 'is-selected' : ''}
                  onClick={() => {
                    setIsPreviewDetailOpen((current) => !current);
                    setActionMessage(isPreviewDetailOpen ? 'Đã thu gọn chi tiết xem trước.' : 'Đã mở chi tiết xem trước lịch hàng loạt.');
                  }}
                  aria-expanded={isPreviewDetailOpen}
                >
                  Chi tiết
                </button>
              </div>

              {isPreviewDetailOpen ? (
                <div className="scheduling-bulk-preview-detail">
                  <div>
                    <strong>{selectedAllocationDoctors.length}</strong>
                    <span>Bác sĩ đang phân bổ</span>
                  </div>
                  <div>
                    <strong>{displayedPreviewSlots}</strong>
                    <span>Slot theo kiểu {selectedDistribution === 'even' ? 'đồng đều' : selectedDistribution === 'ratio' ? 'tỷ lệ' : 'tùy chỉnh'}</span>
                  </div>
                  <div>
                    <strong>{displayedPreviewPatients}</strong>
                    <span>Bệnh nhân dự kiến</span>
                  </div>
                </div>
              ) : null}

              <div
                className="scheduling-bulk-matrix"
                role="table"
                aria-label="Xem trước phân bổ lịch"
                style={{ '--bulk-preview-days': previewDays.length }}
              >
                <div className="scheduling-bulk-matrix__header" role="row">
                  <span />
                  {previewDays.map(([day, date]) => (
                    <strong key={`${day}-${date}`}>
                      {day}
                      <small>{date}</small>
                    </strong>
                  ))}
                  <strong>Tổng slot</strong>
                  <strong>Tổng BN</strong>
                </div>

                {selectedAllocationDoctors.map((doctor, rowIndex) => (
                  <div className="scheduling-bulk-matrix__row" role="row" key={doctor.id}>
                    <div className="scheduling-bulk-matrix__doctor">
                      <img src={doctor.avatar} alt={doctor.name} />
                      <span>{doctor.name}</span>
                    </div>
                    {previewDays.map(([day, date, mode], dayIndex) => (
                      <div className={mode === 'off' ? 'is-off' : ''} key={`${doctor.id}-${day}-${date}`}>
                        {mode === 'off' ? (
                          <span>Nghỉ</span>
                        ) : (
                          previewDotMap[mode].map((tone, dotIndex) => (
                            <i
                              key={`${tone}-${dotIndex}`}
                              className={tone}
                              style={{ opacity: rowIndex === 2 && dayIndex % 4 === 1 && dotIndex === 2 ? 0.32 : 1 }}
                            />
                          ))
                        )}
                      </div>
                    ))}
                    <strong>{getAllocationDoctorSlots(rowIndex)}</strong>
                    <strong>{getAllocationDoctorPatients(rowIndex)}</strong>
                  </div>
                ))}

                <div className="scheduling-bulk-matrix__row is-total" role="row">
                  <div className="scheduling-bulk-matrix__doctor">
                    <span>Tổng cộng</span>
                  </div>
                  {previewDays.map(([day, date, mode]) => (
                    <strong key={`total-${day}-${date}`}>{getPreviewDayTotal(mode)}</strong>
                  ))}
                  <strong>{allocationTotalSlots}</strong>
                  <strong>{allocationTotalPatients}</strong>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className={`scheduling-bulk-side ${hasCalendarSummary ? 'scheduling-bulk-side--range' : ''} ${isDateRangeMethod ? 'scheduling-bulk-side--date-range' : ''} ${isCopyMethod ? 'scheduling-bulk-side--copy' : ''} ${isExcelMethod ? 'scheduling-bulk-side--excel' : ''} ${isAiMethod ? 'scheduling-bulk-side--ai' : ''}`} style={{ '--bulk-progress': '78%', '--bulk-performance': '85%' }}>
          {isAiMethod ? (
            <>
              <section className="scheduling-bulk-ai-stats">
                <div className="scheduling-bulk-side-title">
                  <Sparkles size={15} strokeWidth={2.45} aria-hidden="true" />
                  <strong>Thống kê sau tối ưu</strong>
                  <button type="button" aria-label="Cập nhật thống kê AI" onClick={() => setActionMessage('Thống kê đã đồng bộ với bản lịch AI hiện tại.')}>
                    <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>
                <div className="scheduling-bulk-ai-stat-grid">
                  {aiSideStats.map(({ label, value, note, tone, icon: StatIcon }) => (
                    <article key={label} className={`is-${tone}`}>
                      <em aria-hidden="true"><StatIcon size={13} strokeWidth={2.45} /></em>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <small className={tone === 'green' || tone === 'teal' || tone === 'amber' ? 'is-good' : ''}>{note}</small>
                    </article>
                  ))}
                </div>
              </section>

              <section className="scheduling-bulk-ai-config-summary">
                <div className="scheduling-bulk-side-title">
                  <SlidersHorizontal size={15} strokeWidth={2.45} aria-hidden="true" />
                  <strong>Tóm tắt cấu hình</strong>
                  <button type="button" aria-label="Đồng bộ tóm tắt cấu hình" onClick={() => setActionMessage('Tóm tắt cấu hình đang khớp với lịch AI đề xuất.')}>
                    <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>
                <div className="scheduling-bulk-ai-config-list">
                  {aiConfigSummary.map(([Icon, label, value]) => (
                    <div key={label}>
                      <Icon size={13} strokeWidth={2.35} aria-hidden="true" />
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="scheduling-bulk-ai-automation">
                <div className="scheduling-bulk-side-title">
                  <WandSparkles size={15} strokeWidth={2.45} aria-hidden="true" />
                  <strong>Tự động hóa</strong>
                  <button type="button" aria-label="Mở tự động hóa AI" onClick={() => setActionMessage(`${enabledAutomationCount}/${aiAutomationRules.length} quy tắc AI đang bật.`)}>
                    <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>
                <div className="scheduling-bulk-ai-toggle-list">
                  {aiAutomationRules.map((rule) => {
                    const RuleIcon = rule.icon;
                    const enabled = aiAutomationState[rule.id];

                    return (
                    <button
                      key={rule.id}
                      type="button"
                      className={enabled ? 'is-enabled' : 'is-disabled'}
                      onClick={() => toggleAiAutomation(rule)}
                      aria-pressed={enabled}
                    >
                      <RuleIcon size={14} strokeWidth={2.35} aria-hidden="true" />
                      <span>{rule.label}</span>
                      <i aria-hidden="true" />
                    </button>
                    );
                  })}
                </div>
                <p><Sparkles size={13} strokeWidth={2.4} aria-hidden="true" />AI sẽ tự động áp dụng {enabledAutomationCount} quy tắc khi bạn xác nhận</p>
              </section>

              <section className="scheduling-bulk-ai-history">
                <div className="scheduling-bulk-side-title">
                  <ClipboardCheck size={15} strokeWidth={2.45} aria-hidden="true" />
                  <strong>Lịch sử phiên AI</strong>
                  <button type="button" aria-label="Mở lịch sử AI" onClick={() => setActionMessage(`Đang có ${aiSessionLog.length} phiên AI gần nhất.`)}>
                    <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>
                <div className="scheduling-bulk-ai-history-list">
                  {aiSessionLog.map((session, index) => (
                    <button key={session.id} type="button" onClick={() => openAiHistorySession(session)}>
                      <span aria-hidden="true"><CalendarCheck2 size={15} strokeWidth={2.45} /></span>
                      <strong>{session.title}</strong>
                      <small>{session.copy}</small>
                      <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>

              <button type="button" className="scheduling-bulk-ai-apply" onClick={handleContinue}>
                <CircleCheck size={20} strokeWidth={2.6} aria-hidden="true" />
                <strong>Áp dụng lịch này</strong>
                <Sparkles size={20} strokeWidth={2.35} aria-hidden="true" />
              </button>
            </>
          ) : isExcelMethod ? (
            <>
              <section className="scheduling-bulk-excel-side-summary">
                <div className="scheduling-bulk-side-title">
                  <WandSparkles size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>Tóm tắt lịch sẽ tạo</strong>
                </div>
                <div className="scheduling-bulk-excel-summary-list">
                  {[
                    [UsersRound, 'Bác sĩ', '18 bác sĩ'],
                    [HeartPulse, 'Khoa / Phòng', '8 khoa phòng'],
                    [CalendarDays, 'Khoảng ngày áp dụng', '28/04 - 31/05/2026'],
                    [CalendarCheck2, 'Tổng số ngày', '34 ngày'],
                    [ClipboardCheck, 'Tổng slot dự kiến', '12.864 slot'],
                    [CircleCheck, 'Tổng lịch hợp lệ', '12.180 slot'],
                    [AlertTriangle, 'Tổng lịch cảnh báo', '384 slot'],
                    [Info, 'Tổng lịch lỗi', '300 slot'],
                  ].map(([Icon, label, value]) => (
                    <div key={label}>
                      <Icon size={13} strokeWidth={2.35} aria-hidden="true" />
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <section className="scheduling-bulk-excel-doctors">
                <div className="scheduling-bulk-side-title">
                  <UsersRound size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>Phân bổ theo bác sĩ (dự kiến)</strong>
                </div>
                <div className="scheduling-bulk-excel-doctors__body">
                  <div className="scheduling-bulk-excel-doctors__donut">
                    <strong>12.180</strong>
                    <span>Tổng slot</span>
                  </div>
                  <div className="scheduling-bulk-excel-doctors__legend">
                    {excelDoctorDistribution.map(([doctor, amount, color]) => (
                      <div key={doctor} style={{ '--legend-color': color }}>
                        <i />
                        <span>{doctor}</span>
                        <strong>{amount}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="scheduling-bulk-excel-check-card">
                <div className="scheduling-bulk-side-title">
                  <ShieldCheck size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>Kiểm tra dữ liệu</strong>
                </div>
                <div className="scheduling-bulk-excel-check-list">
                  <div className="is-valid"><CircleCheck size={14} strokeWidth={2.55} aria-hidden="true" />Không phát hiện xung đột lịch</div>
                  <div className="is-warning"><AlertTriangle size={14} strokeWidth={2.55} aria-hidden="true" />384 slot trùng với slot đã tồn tại</div>
                  <div className="is-error"><Info size={14} strokeWidth={2.55} aria-hidden="true" />300 dòng bị lỗi dữ liệu</div>
                </div>
                <button type="button" onClick={() => setActionMessage('Đã mở chi tiết kết quả kiểm tra dữ liệu import.')}>
                  <Info size={14} strokeWidth={2.4} aria-hidden="true" />
                  Xem chi tiết kết quả kiểm tra
                  <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
                </button>
              </section>

              <section className="scheduling-bulk-excel-important">
                <AlertTriangle size={18} strokeWidth={2.35} aria-hidden="true" />
                <strong>Lưu ý quan trọng</strong>
                <p>Vui lòng kiểm tra kỹ dữ liệu trước khi tạo lịch. Các lịch được tạo với lỗi dữ liệu sẽ không được lưu.</p>
              </section>

              <div className="scheduling-bulk-excel-actions">
                <button type="button" onClick={() => handleMethodSelect(bulkMethods[0])}>
                  <ChevronLeft size={15} strokeWidth={2.45} aria-hidden="true" />
                  Quay lại
                </button>
                <button type="button" className="is-primary" onClick={handleContinue}>
                  <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                  <span>
                    <strong>Xem trước & tiếp tục</strong>
                    <small>Kiểm tra và xác nhận trước khi lưu</small>
                  </span>
                  <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : isCopyMethod ? (
            <>
              <section className="scheduling-bulk-copy-summary">
                <div className="scheduling-bulk-side-title">
                  <WandSparkles size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>Tóm tắt lịch tạo</strong>
                </div>
                <div className="scheduling-bulk-range-summary__list">
                  {[
                    [UsersRound, 'Bác sĩ', 'BS. Trần Minh Anh'],
                    [HeartPulse, 'Chuyên khoa', selectedDepartment],
                    [ClipboardCheck, 'Phương thức', 'Sao chép từ lịch có sẵn'],
                    [CalendarDays, 'Lịch nguồn', '28/04 - 04/05/2026'],
                    [CalendarCheck2, 'Khoảng áp dụng', `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`],
                    [Timer, 'Tổng số ngày', '27 ngày'],
                    [CalendarPlus, 'Tổng slot dự kiến', `${projectedSlots} slot`],
                    [UsersRound, 'Tổng bệnh nhân dự kiến', `${projectedPatients} BN`],
                  ].map(([Icon, label, value]) => (
                    <div key={label}>
                      <span><Icon size={13} strokeWidth={2.4} aria-hidden="true" /></span>
                      <strong>{label}</strong>
                      <em>{value}</em>
                    </div>
                  ))}
                </div>
              </section>

              <section className="scheduling-bulk-copy-preview">
                <div className="scheduling-bulk-side-title">
                  <CalendarDays size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>Xem trước lịch sau khi sao chép</strong>
                </div>
                <div className="scheduling-bulk-copy-preview__nav">
                  <button type="button" aria-label="Tuần trước" onClick={() => setActionMessage('Đang xem tuần 05/05 - 11/05/2026.')}>
                    <ChevronLeft size={14} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                  <strong>05/05 - 11/05/2026 <span>(Tuần 1)</span></strong>
                  <button type="button" aria-label="Tuần sau" onClick={() => setActionMessage('Đang xem tuần 05/05 - 11/05/2026.')}>
                    <ChevronRight size={14} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>
                <div className="scheduling-bulk-copy-preview__grid">
                  <span />
                  {copyPreviewColumns.map(([day, date]) => (
                    <strong key={`${day}-${date}`}>
                      {day}
                      <small>{date}</small>
                    </strong>
                  ))}
                  {copyPreviewTimes.flatMap((time, rowIndex) => [
                    <em key={`${time}-label`}>{time}</em>,
                    ...copyPreviewColumns.map(([day, date], colIndex) => (
                      <i
                        key={`${time}-${day}-${date}`}
                        className={colIndex === 5 ? 'is-off' : rowIndex >= 2 ? 'is-afternoon' : 'is-morning'}
                      />
                    )),
                  ])}
                </div>
                <div className="scheduling-bulk-copy-preview__legend">
                  <span><i className="is-morning" />Ca sáng</span>
                  <span><i className="is-afternoon" />Ca chiều</span>
                  <span><i className="is-extra" />Ca tối</span>
                  <span><i className="is-off" />Nghỉ</span>
                </div>
                <button type="button" onClick={() => scrollToSection('bulk-step-preview')}>
                  <CalendarCheck2 size={14} strokeWidth={2.35} aria-hidden="true" />
                  Xem toàn bộ lịch preview
                </button>
              </section>

              <section className="scheduling-bulk-copy-warning">
                <AlertTriangle size={18} strokeWidth={2.35} aria-hidden="true" />
                <strong>Lưu ý quan trọng</strong>
                <p>Lịch sẽ được sao chép dựa trên cấu trúc và khung giờ của lịch nguồn. Bạn có thể điều chỉnh trước khi xác nhận tạo lịch.</p>
              </section>

              <div className="scheduling-bulk-range-actions">
                <button type="button" onClick={() => navigate('/scheduling/schedules')}>Hủy bỏ</button>
                <button type="button" className="is-primary" onClick={handleContinue}>
                  <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                  <span>
                    <strong>Xem trước & tiếp tục</strong>
                    <small>Kiểm tra và xác nhận trước khi lưu</small>
                  </span>
                  <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : hasCalendarSummary ? (
            <>
              <section className="scheduling-bulk-range-summary">
                <div className="scheduling-bulk-side-title">
                  <WandSparkles size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>Tóm tắt lịch tạo</strong>
                </div>
                <div className="scheduling-bulk-range-summary__list">
                  {[
                    [UsersRound, 'Bác sĩ', `${projectedDoctors} bác sĩ`],
                    [HeartPulse, 'Khoa', selectedDepartment],
                    [CalendarCheck2, 'Loại lịch', selectedScheduleType],
                    [CalendarDays, isDateRangeMethod ? 'Dải ngày áp dụng' : 'Khoảng ngày áp dụng', `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`],
                    [Sparkles, isDateRangeMethod ? 'Tổng số ngày' : 'Lặp lại', isDateRangeMethod ? `${projectedDays} ngày` : `${rangeInterval} (${projectedDays} ngày)`],
                    [Clock3, 'Khung giờ', `${workStart} - ${workEnd} | Nghỉ ${breakStart} - ${breakEnd}`],
                    [Timer, 'Thời lượng slot', slotDuration],
                    [CalendarPlus, 'Số slot / khung giờ', slotCapacity],
                    [ClipboardCheck, 'Tổng slot dự kiến', `${projectedSlots} slot`],
                    [UsersRound, 'Tổng bệnh nhân dự kiến', `${projectedPatients} BN`],
                  ].map(([Icon, label, value]) => (
                    <div key={label}>
                      <span><Icon size={13} strokeWidth={2.4} aria-hidden="true" /></span>
                      <strong>{label}</strong>
                      <em>{value}</em>
                    </div>
                  ))}
                </div>
              </section>

              {isDateRangeMethod ? (
                <section className="scheduling-bulk-range-stats">
                  <div className="scheduling-bulk-side-title">
                    <CalendarCheck2 size={15} strokeWidth={2.4} aria-hidden="true" />
                    <strong>Thống kê nhanh</strong>
                  </div>
                  <div>
                    <article>
                      <strong>{projectedDays}</strong>
                      <span>Tổng số ngày</span>
                    </article>
                    <article>
                      <strong>{projectedSlots}</strong>
                      <span>Tổng slot</span>
                    </article>
                    <article>
                      <strong>{projectedPatients}</strong>
                      <span>BN dự kiến</span>
                    </article>
                    <article>
                      <strong>{projectedDoctors}</strong>
                      <span>Số bác sĩ</span>
                    </article>
                  </div>
                </section>
              ) : null}

              <section className="scheduling-bulk-range-calendar">
                <div className="scheduling-bulk-range-calendar__head">
                  <div className="scheduling-bulk-side-title">
                    <CalendarDays size={15} strokeWidth={2.4} aria-hidden="true" />
                    <strong>{isDateRangeMethod ? 'Lịch theo dải ngày' : 'Lịch theo khoảng ngày'}</strong>
                  </div>
                  <div className="scheduling-bulk-calendar-legend">
                    <span><i className="is-applied" />{isDateRangeMethod ? 'Có lịch' : 'Áp dụng lịch'}</span>
                    <span><i className="is-off" />Nghỉ</span>
                    {isDateRangeMethod ? <span><i className="is-exception" />Ngoại lệ</span> : null}
                  </div>
                </div>

                <div className="scheduling-bulk-calendar-control">
                  <button type="button" aria-label="Tháng trước" onClick={() => setActionMessage('Đang xem lịch tháng 5/2026.')}>
                    <ChevronLeft size={14} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                  <strong>Tháng 5, 2026</strong>
                  <button type="button" aria-label="Tháng sau" onClick={() => setActionMessage('Đang xem lịch tháng 5/2026.')}>
                    <ChevronRight size={14} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>

                <div className="scheduling-bulk-calendar-grid" aria-label="Lịch áp dụng theo khoảng ngày">
                  {allWeekDays.map((day) => <strong key={day}>{day}</strong>)}
                  {rangeCalendarWeeks.flatMap((week, weekIndex) =>
                    week.map((day, dayIndex) => {
                      const key = `${weekIndex}-${dayIndex}-${day || 'empty'}`;
                      const isApplied = day && (isDateRangeMethod ? dateRangeScheduledDates.has(day) : rangeAppliedDates.has(day));
                      const isOff = day && isDateRangeMethod && dateRangeOffDates.has(day);
                      const isException = day && isDateRangeMethod && dateRangeExceptionDates.has(day);
                      const isWeekend = dayIndex >= 5;

                      return (
                        <button
                          key={key}
                          type="button"
                          className={`${isApplied ? 'is-applied' : ''} ${isOff ? 'is-off-day' : ''} ${isException ? 'is-exception' : ''} ${isWeekend ? 'is-weekend' : ''}`}
                          disabled={!day}
                          onClick={() => {
                            if (day) {
                              setActionMessage(
                                isApplied
                                  ? `Ngày ${day}/05/2026 có lịch trong dải ngày.`
                                  : isException
                                    ? `Ngày ${day}/05/2026 đang được đánh dấu ngoại lệ.`
                                    : `Ngày ${day}/05/2026 là ngày nghỉ.`,
                              );
                            }
                          }}
                        >
                          {day}
                        </button>
                      );
                    }),
                  )}
                </div>
              </section>

              {isDateRangeMethod ? (
                <section className="scheduling-bulk-range-note scheduling-bulk-range-note--important">
                  <AlertTriangle size={19} strokeWidth={2.35} aria-hidden="true" />
                  <strong>Lưu ý quan trọng</strong>
                  <p>Hệ thống sẽ kiểm tra trùng lịch bác sĩ. Lịch sẽ được tạo ở trạng thái nháp và có thể chỉnh sửa trước khi xuất bản.</p>
                </section>
              ) : (
                <section className="scheduling-bulk-range-note">
                  <Sparkles size={19} strokeWidth={2.35} aria-hidden="true" />
                  <strong>Ghi chú</strong>
                  <p>Lịch sẽ được tạo dựa trên các cấu hình đã chọn. Bạn có thể xem trước để kiểm tra trước khi lưu.</p>
                </section>
              )}

              <div className="scheduling-bulk-range-actions">
                <button type="button" onClick={() => navigate('/scheduling/schedules')}>Hủy bỏ</button>
                <button type="button" className="is-primary" onClick={handleContinue}>
                  <Check size={16} strokeWidth={2.6} aria-hidden="true" />
                  <span>
                    <strong>Xem trước & tiếp tục</strong>
                    <small>Kiểm tra và xác nhận trước khi lưu</small>
                  </span>
                  <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <>
          <section className="scheduling-bulk-summary">
            <div className="scheduling-bulk-summary__head">
              <div>
                <WandSparkles size={16} strokeWidth={2.4} aria-hidden="true" />
                <strong>Tổng quan lịch dự kiến</strong>
              </div>
            </div>

            <div className="scheduling-bulk-summary__chart">
              <div className="scheduling-bulk-donut">
                <strong>{projectedSlots}</strong>
                <span>Tổng slot dự kiến</span>
              </div>
              <div className="scheduling-bulk-legend">
                <div><i className="is-morning" /><span>Ca sáng</span><strong>432 slot (50%)</strong></div>
                <div><i className="is-afternoon" /><span>Ca chiều</span><strong>288 slot (33%)</strong></div>
                <div><i className="is-extra" /><span>Ngoài giờ</span><strong>144 slot (17%)</strong></div>
              </div>
            </div>

            <div className="scheduling-bulk-summary__metrics">
              <div>
                <UsersRound size={16} strokeWidth={2.35} aria-hidden="true" />
                <strong>{projectedDoctors}</strong>
                <span>Bác sĩ</span>
              </div>
              <div>
                <CalendarDays size={16} strokeWidth={2.35} aria-hidden="true" />
                <strong>{projectedDays}</strong>
                <span>Ngày áp dụng</span>
              </div>
              <div>
                <Clock3 size={16} strokeWidth={2.35} aria-hidden="true" />
                <strong>{projectedSlots}</strong>
                <span>Slot dự kiến</span>
              </div>
              <div>
                <UsersRound size={16} strokeWidth={2.35} aria-hidden="true" />
                <strong>{projectedPatients}</strong>
                <span>BN dự kiến</span>
              </div>
            </div>
          </section>

          <section className="scheduling-bulk-side-card scheduling-bulk-side-card--performance">
            <div className="scheduling-bulk-side-title">
              <Timer size={15} strokeWidth={2.4} aria-hidden="true" />
              <strong>Hiệu suất dự kiến</strong>
            </div>
            <div className="scheduling-bulk-performance-body">
              <div className="scheduling-bulk-performance-donut">
                <strong>85%</strong>
                <span>Hiệu suất dự kiến</span>
              </div>
              <div className="scheduling-bulk-performance-copy">
                <div>
                  <Save size={14} strokeWidth={2.35} aria-hidden="true" />
                  <span>Doanh thu dự kiến</span>
                  <strong>18.720.000đ</strong>
                  <small>~ 20.500.000đ</small>
                </div>
                <div>
                  <CalendarCheck2 size={14} strokeWidth={2.35} aria-hidden="true" />
                  <span>Tỷ lệ lấp đầy trung bình</span>
                  <strong>85% - 95%</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="scheduling-bulk-side-card scheduling-bulk-side-card--alerts">
            <div className="scheduling-bulk-side-title">
              <ShieldCheck size={15} strokeWidth={2.4} aria-hidden="true" />
              <strong>Kiểm tra & cảnh báo</strong>
            </div>
            <div className="scheduling-bulk-alert-list">
              <div><CircleCheck size={14} strokeWidth={2.45} aria-hidden="true" /><span>Không phát hiện xung đột lịch</span></div>
              <div><CircleCheck size={14} strokeWidth={2.45} aria-hidden="true" /><span>Bác sĩ thuộc khoa đã chọn</span></div>
              <div><CircleCheck size={14} strokeWidth={2.45} aria-hidden="true" /><span>Khung giờ làm việc hợp lệ</span></div>
              <div><CircleCheck size={14} strokeWidth={2.45} aria-hidden="true" /><span>Không có lịch hẹn trong thời gian nghỉ giữa giờ</span></div>
              <div className="is-warning"><AlertTriangle size={14} strokeWidth={2.45} aria-hidden="true" /><span>2 ngày có thể bị giới hạn do lịch hiện tại</span></div>
            </div>
            {isAlertDetailOpen ? (
              <div className="scheduling-bulk-alert-detail">
                <div>
                  <strong>0</strong>
                  <span>Xung đột lịch</span>
                </div>
                <div>
                  <strong>{selectedAllocationDoctors.length}</strong>
                  <span>Bác sĩ hợp lệ</span>
                </div>
                <div>
                  <strong>{exceptionDates.length || 2}</strong>
                  <span>Ngày cần rà soát</span>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className={isAlertDetailOpen ? 'is-selected' : ''}
              onClick={toggleAlertDetails}
              aria-expanded={isAlertDetailOpen}
            >
              {isAlertDetailOpen ? 'Thu gọn' : 'Xem chi tiết'}
              <ChevronRight size={13} strokeWidth={2.45} aria-hidden="true" />
            </button>
          </section>

          <div className="scheduling-bulk-final-actions">
          <section className="scheduling-bulk-quick-actions-card">
            <div className="scheduling-bulk-side-title">
              <ClipboardCheck size={15} strokeWidth={2.4} aria-hidden="true" />
              <strong>Tác vụ nhanh</strong>
            </div>
            <button
              type="button"
              className={isCurrentTemplateSaved ? 'is-complete' : ''}
              onClick={saveBulkTemplate}
            >
              {isCurrentTemplateSaved ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : <Save size={15} strokeWidth={2.35} aria-hidden="true" />}
              <span>{isCurrentTemplateSaved ? 'Đã lưu mẫu này' : 'Lưu mẫu lịch này'}</span>
              <ChevronRight size={14} strokeWidth={2.45} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={duplicateBulkSchedule}
            >
              <ClipboardCheck size={15} strokeWidth={2.35} aria-hidden="true" />
              <span>Nhân bản & chỉnh sửa</span>
              <ChevronRight size={14} strokeWidth={2.45} aria-hidden="true" />
            </button>
            <button type="button" onClick={exportPreviewFile}>
              <FileSpreadsheet size={15} strokeWidth={2.35} aria-hidden="true" />
              <span>Xuất file Excel</span>
              <ChevronRight size={14} strokeWidth={2.45} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickActionFeedback('Đang chuyển sang trang lịch theo bác sĩ.');
                navigate('/scheduling/doctors');
              }}
            >
              <CalendarDays size={15} strokeWidth={2.35} aria-hidden="true" />
              <span>Xem lịch của bác sĩ</span>
              <ChevronRight size={14} strokeWidth={2.45} aria-hidden="true" />
            </button>
            {quickActionFeedback ? (
              <div className="scheduling-bulk-quick-feedback">
                <CircleCheck size={14} strokeWidth={2.45} aria-hidden="true" />
                <span>{quickActionFeedback}</span>
              </div>
            ) : null}
          </section>

          <button type="button" className="scheduling-bulk-final-cta" onClick={handleContinue}>
            <span>
              <Check size={17} strokeWidth={2.7} aria-hidden="true" />
              <strong>Xem trước & tiếp tục</strong>
              <small>Kiểm tra và xác nhận trước khi lưu</small>
            </span>
            <ArrowRight size={20} strokeWidth={2.55} aria-hidden="true" />
          </button>
          </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
