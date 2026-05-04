import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
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
  MoreVertical,
  Minus,
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
import {
  DEFAULT_SCHEDULE_TYPE,
  getScheduleTypeMeta,
  getScheduleTypePrice,
  normalizeScheduleType,
  scheduleTypeCatalog,
} from '../data/scheduleTypes';

const SCHEDULING_NOTIFICATION_EVENT = 'healthcare:scheduling-notification';
const SCHEDULING_BULK_CREATE_FOCUS_EVENT = 'healthcare:scheduling-bulk-create-focus';

function emitSchedulingNotification({
  id,
  title,
  body,
  tone = 'info',
  to = '/scheduling/schedules',
  openMenu = false,
  focusTarget = null,
}) {
  window.dispatchEvent(new CustomEvent(SCHEDULING_NOTIFICATION_EVENT, {
    detail: {
      id: id || `schedule-bulk-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      body,
      tone,
      to,
      time: 'Vừa xong',
      openMenu,
      focusTarget,
    },
  }));
}

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

const aiAssistantPrompts = [
  ['Tạo lịch khoa Nhi từ 01-31/05', '31 ngày'],
  ['Ưu tiên bác sĩ chính buổi sáng', 'Ca sáng'],
  ['Tránh trùng ca', 'Không xung đột'],
  ['Cân bằng tải công việc', 'Tối ưu tải'],
];

const aiAssistantPromptIcons = [Stethoscope, ShieldCheck, CalendarDays, ClipboardList];

const initialAiChatMessages = [
  {
    id: 'ai-welcome',
    role: 'assistant',
    title: 'Xin chào Admin! 👋',
    content: 'Tôi sẽ giúp bạn tạo lịch hàng loạt tối ưu cho 18 bác sĩ và 8 khoa phòng.',
    time: '09:30',
  },
  {
    id: 'ai-user-seed-1',
    role: 'user',
    content: 'Tạo lịch khoa Nhi từ 01-31/05, ưu tiên bác sĩ chính buổi sáng và tránh trùng ca.',
    time: '09:32',
  },
  {
    id: 'ai-assistant-seed-1',
    role: 'assistant',
    content: 'Đã ghi nhận. Tôi sẽ ưu tiên phân ca sáng cho bác sĩ chính, kiểm tra xung đột và tối ưu tải công việc.',
    time: '09:32',
  },
  {
    id: 'ai-user-seed-2',
    role: 'user',
    content: 'Đảm bảo mỗi bác sĩ tối đa 2 ca/ngày.',
    time: '09:33',
  },
];

const aiProcessingSteps = [
  {
    title: 'Đọc dữ liệu',
    copy: 'Dữ liệu database',
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
    title: 'Tạo phương án',
    copy: 'Ước tính 00:23',
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
    title: 'Hoàn tất đề xuất',
    copy: 'Chờ xác nhận',
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

const aiQuickRuleCards = [
  { title: 'Ưu tiên BS > 5 năm KN', copy: 'Đã nhận', icon: Timer, tone: 'violet' },
  { title: 'Không trùng lịch khám', copy: 'Đã nhận', icon: ShieldCheck, tone: 'green' },
  { title: 'Ca sáng 07:30 - 11:30', copy: 'Đã nhận', icon: Clock3, tone: 'blue' },
  { title: 'Mỗi bác sĩ tối đa 2 ca/ngày', copy: 'Đã nhận', icon: UsersRound, tone: 'emerald' },
];

const aiQuickPreviewDays = [
  ['T6', '01/05'],
  ['T7', '02/05'],
  ['CN', '03/05'],
  ['T2', '04/05'],
  ['T3', '05/05'],
  ['T4', '06/05'],
  ['T5', '07/05'],
  ['T6', '08/05'],
  ['T7', '09/05'],
  ['CN', '10/05'],
];

const aiQuickPreviewGroups = [
  {
    department: 'Khoa Nhi',
    count: '4 bác sĩ',
    tone: 'purple',
    priority: 'Ưu tiên cao',
    icon: Stethoscope,
    doctors: [
      { name: 'BS. Trần Minh Anh', avatar: '/images/scheduling/doctors/doctor-lan.svg', shifts: ['Sáng', 'Sáng', 'Nghỉ', 'Sáng', 'Sáng', 'Chiều', 'Sáng', 'Sáng', 'Nghỉ', 'Sáng'] },
      { name: 'BS. Lê Hoàng Nam', avatar: '/images/scheduling/doctors/doctor-quang.svg', shifts: ['Chiều', 'Sáng', 'Nghỉ', 'Chiều', 'Sáng', 'Sáng', 'Chiều', 'Sáng', 'Nghỉ', 'Chiều'] },
      { name: 'BS. Võ Thành Công', avatar: '/images/scheduling/doctors/doctor-hanh.svg', shifts: ['Sáng', 'Chiều', 'Nghỉ', 'Sáng', 'Chiều', 'Chiều', 'Sáng', 'Sáng', 'Nghỉ', 'Sáng'] },
      { name: 'BS. Phạm Thu Hà', avatar: '/images/scheduling/doctors/doctor-minh.svg', shifts: ['Sáng', 'Sáng', 'Nghỉ', 'Sáng', 'Chiều', 'Sáng', 'Sáng', 'Sáng', 'Nghỉ', 'Sáng'] },
    ],
  },
  {
    department: 'Khoa Tim mạch',
    count: '3 bác sĩ',
    tone: 'rose',
    icon: HeartPulse,
    doctors: [
      { name: 'BS. Nguyễn Thùy Linh', avatar: '/images/scheduling/doctors/doctor-khoa.svg', shifts: ['Chiều', 'Chiều', 'Nghỉ', 'Chiều', 'Chiều', 'Sáng', 'Chiều', 'Sáng', 'Nghỉ', 'Sáng'] },
      { name: 'BS. Lê Thành Công', avatar: '/images/scheduling/doctors/doctor-quang.svg', shifts: ['Sáng', 'Sáng', 'Nghỉ', 'Sáng', 'Chiều', 'Sáng', 'Sáng', 'Sáng', 'Nghỉ', 'Chiều'] },
      { name: 'BS. Nguyễn Thu Hằng', avatar: '/images/scheduling/doctors/doctor-hanh.svg', shifts: ['Chiều', 'Sáng', 'Nghỉ', 'Chiều', 'Sáng', 'Sáng', 'Sáng', 'Sáng', 'Nghỉ', 'Chiều'] },
    ],
  },
];

const previewDotMap = {
  morning: ['is-morning', 'is-morning', 'is-morning'],
  afternoon: ['is-afternoon', 'is-afternoon', 'is-afternoon'],
  balanced: ['is-morning', 'is-afternoon', 'is-extra'],
};

const departmentOptions = ['Tim mạch', 'Nội tổng quát', 'Nhi khoa', 'Da liễu', 'Cơ xương khớp'];
const departmentOptionDetails = {
  'Tim mạch': ['Áp dụng cho lịch khám tim mạch định kỳ.', '5 bác sĩ phù hợp'],
  'Nội tổng quát': ['Phù hợp lịch lặp theo tuần cho lưu lượng ổn định.', '12 bác sĩ phù hợp'],
  'Nhi khoa': ['Ưu tiên khung giờ sáng và cuối tuần nếu có.', '6 bác sĩ phù hợp'],
  'Da liễu': ['Phù hợp lịch khám ngắn, nhiều slot mỗi khung.', '4 bác sĩ phù hợp'],
  'Cơ xương khớp': ['Phù hợp lịch tái khám và phục hồi chức năng.', '7 bác sĩ phù hợp'],
};
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = String(Math.floor(index / 2)).padStart(2, '0');
  const minute = index % 2 === 0 ? '00' : '30';
  return `${hour}:${minute}`;
});
const slotDurationOptions = ['10 phút', '15 phút', '20 phút', '30 phút'];
const slotCapacityOptions = ['4 slot', '6 slot', '8 slot', '10 slot', '12 slot'];
const repeatFrequencyOptions = ['Hàng ngày', 'Hàng tuần', 'Hàng tháng'];
const repeatFrequencyOptionDetails = {
  'Hàng ngày': 'Tạo lịch vào từng ngày trong khoảng áp dụng.',
  'Hàng tuần': 'Tạo lịch theo các thứ đã chọn, có thể lặp mỗi 1, 2 hoặc nhiều tuần.',
  'Hàng tháng': 'Tạo lịch theo chu kỳ tháng, phù hợp lịch cố định dài hạn.',
};
const rangePresetOptions = [
  { label: 'Tuần này', start: '2026-04-26', end: '2026-05-02' },
  { label: 'Tuần sau', start: '2026-05-03', end: '2026-05-09' },
  { label: '36 ngày tới', start: '2026-04-26', end: '2026-05-31' },
  { label: 'Tháng 5/2026', start: '2026-05-01', end: '2026-05-31' },
];
const repeatCountOptions = [3, 5, 8, 10, 12];
const exceptionReasonOptions = ['Nghỉ lễ', 'Bác sĩ bận', 'Bảo trì phòng khám', 'Họp khoa', 'Đào tạo nội bộ', 'Khác'];
const exceptionScopeOptions = [
  ['all', 'Tất cả bác sĩ'],
  ['selected', 'Bác sĩ đang chọn'],
  ['department', 'Khoa lọc hiện tại'],
];
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

const aiQuickSteps = [
  ['1', 'Thông tin cơ bản', 'Bác sĩ, khoa, thời gian'],
  ['2', 'Ý tưởng & ràng buộc', 'Quy tắc, ưu tiên, ca kíp'],
  ['3', 'AI phân tích & tối ưu', 'Đang xử lý dữ liệu...'],
  ['4', 'Xem trước & xác nhận', 'Kiểm tra & áp dụng'],
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
  ['4', 'Xem trước & lưu', 'Rà soát bảng phân bổ trước khi lưu lịch nháp.'],
];

const bulkSavedTemplates = [
  {
    id: 'standard-week',
    title: 'Ca sáng tiêu chuẩn',
    copy: 'T2 - T6, 07:30 - 11:30',
    method: 'weekly',
    days: ['T2', 'T3', 'T4', 'T5', 'T6'],
    badge: 'Khuyên dùng',
    tone: 'green',
    specs: ['Hàng tuần', 'Ngày làm việc', 'Có nghỉ giữa giờ'],
  },
  {
    id: 'cardio-month',
    title: 'Tim mạch trong tháng',
    copy: '36 ngày, 864 slot dự kiến',
    method: 'date-range',
    days: ['T2', 'T3', 'T4', 'T5', 'T6'],
    badge: 'Theo khoa',
    tone: 'blue',
    specs: ['Tháng hiện tại', 'Khoa Tim mạch', 'Kiểm tra trùng lịch'],
  },
  {
    id: 'ai-balanced',
    title: 'AI cân bằng tải',
    copy: 'Phân bổ đều theo công suất bác sĩ',
    method: 'ai',
    days: ['T2', 'T4', 'T6'],
    badge: 'Tối ưu',
    tone: 'purple',
    specs: ['Ưu tiên tải thấp', 'Tránh quá tải', 'Lưu nháp khi hợp lệ'],
  },
];

export function ScheduleBulkCreatePage() {
  const { doctors, departments, schedules, scheduleTypes, backendConnected, createResourcesLoaded, loading, error, actions } = useSchedulingData();
  const navigate = useNavigate();
  const [selectedDays, setSelectedDays] = useState(allWeekDays);
  const [selectedDoctors, setSelectedDoctors] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState('date-range');
  const [selectedTemplate, setSelectedTemplate] = useState('cardio-month');
  const [selectedDistribution, setSelectedDistribution] = useState('even');
  const [selectedRepeatEnd, setSelectedRepeatEnd] = useState('unlimited');
  const [selectedDayType, setSelectedDayType] = useState('all');
  const [selectedAdvancedTab, setSelectedAdvancedTab] = useState('repeat');
  const [isBreakEnabled, setIsBreakEnabled] = useState(true);
  const [openFieldMenu, setOpenFieldMenu] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('Tim mạch');
  const [selectedScheduleType, setSelectedScheduleType] = useState(DEFAULT_SCHEDULE_TYPE);
  const [dateRange, setDateRange] = useState({ start: '2026-05-01', end: '2026-05-31' });
  const [workStart, setWorkStart] = useState('07:30');
  const [workEnd, setWorkEnd] = useState('11:30');
  const [slotDuration, setSlotDuration] = useState('15 phút');
  const [slotCapacity, setSlotCapacity] = useState('8 slot');
  const [breakStart, setBreakStart] = useState('09:30');
  const [breakEnd, setBreakEnd] = useState('09:45');
  const [extraBreakDraftStart, setExtraBreakDraftStart] = useState('10:00');
  const [extraBreakDraftEnd, setExtraBreakDraftEnd] = useState('10:15');
  const [repeatFrequency, setRepeatFrequency] = useState('Hàng tuần');
  const [repeatEveryWeeks, setRepeatEveryWeeks] = useState(1);
  const [rangeInterval, setRangeInterval] = useState('Mỗi 2 ngày');
  const [dateRangeEveryDays, setDateRangeEveryDays] = useState(1);
  const [selectedDateRangePreset, setSelectedDateRangePreset] = useState('30 ngày');
  const [selectedCopySourceTab, setSelectedCopySourceTab] = useState('doctor');
  const [selectedCopyMode, setSelectedCopyMode] = useState('repeat-range');
  const [selectedCopyTargetPreset, setSelectedCopyTargetPreset] = useState('2 tuần');
  const [rangeRepeatStart, setRangeRepeatStart] = useState('2026-05-01');
  const [repeatEndDate, setRepeatEndDate] = useState('2026-05-31');
  const [repeatCount, setRepeatCount] = useState(5);
  const [exceptionDraftDate, setExceptionDraftDate] = useState('2026-05-01');
  const [exceptionDraftReason, setExceptionDraftReason] = useState('Nghỉ lễ');
  const [exceptionDraftScope, setExceptionDraftScope] = useState('all');
  const [exceptionDates, setExceptionDates] = useState([]);
  const [extraBreaks, setExtraBreaks] = useState([]);
  const [isExtraBreakFormOpen, setIsExtraBreakFormOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState({
    conflict: true,
    lightLoad: false,
  });
  const [isBasicDetailOpen, setIsBasicDetailOpen] = useState(false);
  const [activeCommandPanel, setActiveCommandPanel] = useState('');
  const [activeStep, setActiveStep] = useState(2);
  const [actionMessage, setActionMessage] = useState('');
  const [isDoctorPickerOpen, setIsDoctorPickerOpen] = useState(false);
  const [isPreviewDetailOpen, setIsPreviewDetailOpen] = useState(false);
  const [isRepeatPreviewExpanded, setIsRepeatPreviewExpanded] = useState(false);
  const [isAlertDetailOpen, setIsAlertDetailOpen] = useState(false);
  const [isCurrentTemplateSaved, setIsCurrentTemplateSaved] = useState(false);
  const [validationIssues, setValidationIssues] = useState([]);
  const [isCreatingSchedules, setIsCreatingSchedules] = useState(false);
  const [conflictResolutions, setConflictResolutions] = useState({});
  const [activeConflictKey, setActiveConflictKey] = useState('');
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
  const databaseDepartments = createResourcesLoaded ? (departments || []).filter((department) => department.id && department.name) : [];
  const databaseDoctors = createResourcesLoaded ? (doctors || []).filter((doctor) => doctor.id && doctor.name) : [];
  const databaseDoctorIdentityKey = databaseDoctors.map((doctor) => doctor.id).join('|');
  const databaseDepartmentIdentityKey = databaseDepartments.map((department) => department.name).join('|');
  const systemScheduleTypeOptions = (scheduleTypes?.length ? scheduleTypes : scheduleTypeCatalog).map((type) => ({
    ...type,
    value: normalizeScheduleType(type.value || type.label),
  }));
  const existingScheduleTypeOptions = (schedules || []).map((schedule) => normalizeScheduleType(schedule.scheduleType)).filter(Boolean);
  const scheduleTypeChoices = Array.from(new Set([
    ...systemScheduleTypeOptions.map((type) => type.value),
    ...existingScheduleTypeOptions,
  ]));
  const scheduleTypeMetaByValue = new Map(systemScheduleTypeOptions.map((type) => [type.value, type]));
  const selectedScheduleTypeMeta = scheduleTypeMetaByValue.get(selectedScheduleType) || getScheduleTypeMeta(selectedScheduleType);
  const departmentChoices = databaseDepartments.map((department) => department.name);
  const maxDoctorActiveSchedules = Math.max(1, ...databaseDoctors.map((doctor) => Number(doctor.activeSchedulesCount || doctor.schedulesCount || 0)));
  const getDoctorLoadFromDatabase = (doctor) => {
    const doctorSchedules = (schedules || []).filter(
      (schedule) => String(schedule.doctorId || '') === String(doctor.id) || schedule.doctor === doctor.name,
    );
    const totalSlots = doctorSchedules.reduce((total, schedule) => total + Number(schedule.totalSlots || 0), 0);
    const bookedSlots = doctorSchedules.reduce((total, schedule) => total + Number(schedule.bookedSlots || 0), 0);

    if (totalSlots > 0) {
      return clampPercent((bookedSlots / totalSlots) * 100);
    }

    const activeSchedules = Number(doctor.activeSchedulesCount || doctor.schedulesCount || 0);
    return activeSchedules ? clampPercent((activeSchedules / maxDoctorActiveSchedules) * 100) : 0;
  };
  const doctorSelectionOptions = databaseDoctors.map((doctor, index) => {
    const load = getDoctorLoadFromDatabase(doctor);
    const activeSchedulesCount = Number(doctor.activeSchedulesCount || doctor.schedulesCount || 0)
      || (schedules || []).filter((schedule) => String(schedule.doctorId || '') === String(doctor.id) || schedule.doctor === doctor.name).length;
    return {
      id: doctor.id,
      name: doctor.name,
      department: doctor.department,
      departmentId: doctor.departmentId || '',
      load,
      avatar: doctorAvatarMap[doctor.id] || fallbackDoctorAvatars[index % fallbackDoctorAvatars.length] || '/images/scheduling/doctors/doctor-ai-fallback.png',
      status: load >= 90 ? 'Gần kín lịch' : load <= 60 ? 'Còn nhiều lịch trống' : 'Có thể phân bổ',
      activeSchedulesCount,
    };
  });
  const selectedDoctorRecords = doctorSelectionOptions.filter((doctor) => selectedDoctors.includes(doctor.id));
  const normalizedDoctorSearch = doctorSearch.trim().toLocaleLowerCase('vi-VN');
  const filteredDoctorOptions = doctorSelectionOptions
    .filter((doctor) => {
      const matchesSearch = !normalizedDoctorSearch
        || `${doctor.name} ${doctor.department}`.toLocaleLowerCase('vi-VN').includes(normalizedDoctorSearch);
      const matchesFilter =
        doctorFilter === 'all'
        || (doctorFilter === 'department' && doctor.department === selectedDepartment)
        || (doctorFilter === 'available' && doctor.load < 90)
        || (doctorFilter === 'selected' && selectedDoctors.includes(doctor.id));
      return matchesSearch && matchesFilter;
    })
    .sort((first, second) => (advancedSettings.lightLoad ? Number(first.load || 0) - Number(second.load || 0) : 0));
  const projectedDoctors = selectedDoctorRecords.length;
  const effectiveScheduleEndDate = selectedRepeatEnd === 'date' && new Date(repeatEndDate) < new Date(dateRange.end)
    ? repeatEndDate
    : dateRange.end;
  const bulkAppliedDays = buildAllocationPreviewDays({
    method: selectedMethod,
    start: dateRange.start,
    end: effectiveScheduleEndDate,
    selectedDays,
    exceptionDates,
    repeatFrequency,
    repeatEveryWeeks,
    rangeInterval,
    rangeRepeatStart,
    dateRangeEveryDays,
    selectedRepeatEnd,
    repeatCount,
    maxDays: 366,
  });
  const projectedDays = bulkAppliedDays.filter((day) => !day.isExcluded).length;
  const appliedDayScopeLabel = selectedDayType === 'all'
    ? 'Tất cả các ngày'
    : selectedDayType === 'workdays'
      ? 'Ngày làm việc'
      : selectedDayType === 'weekend'
        ? 'Cuối tuần'
        : selectedDays.join(', ') || 'Tùy chỉnh';
  const scheduleRuleLabel = isRangeMethod
    ? `${rangeInterval} từ ${formatDateDisplay(rangeRepeatStart)}`
    : isDateRangeMethod
      ? `${appliedDayScopeLabel} trong dải ngày${dateRangeEveryDays > 1 ? ` · mỗi ${dateRangeEveryDays} ngày` : ''}`
      : repeatFrequency === 'Hàng tuần'
        ? `Mỗi ${repeatEveryWeeks} tuần`
        : repeatFrequency;
  const extraBreakMinutes = extraBreaks.reduce((total, item) => total + getClockRangeMinutes(item.start, item.end), 0);
  const projectedShiftMinutes = Math.max(
    0,
    getClockRangeMinutes(workStart, workEnd)
      - (isBreakEnabled ? getClockRangeMinutes(breakStart, breakEnd) : 0)
      - extraBreakMinutes,
  );
  const projectedSlotsPerDoctorDay = Math.max(0, Math.floor(projectedShiftMinutes / parseDurationMinutes(slotDuration)) * parseCapacity(slotCapacity));
  const projectedSlots = projectedDoctors * projectedDays * projectedSlotsPerDoctorDay;
  const projectedPatients = Math.round(projectedSlots * 0.83);
  const breakSummaryLabel = isBreakEnabled
    ? [breakStart && breakEnd ? `${breakStart}-${breakEnd}` : '', ...extraBreaks.map((item) => `${item.start}-${item.end}`)].filter(Boolean).join(', ') || 'Không nghỉ'
    : 'Không nghỉ';
  const selectedDepartmentRecord = databaseDepartments.find((department) => department.name === selectedDepartment);
  const selectedMethodInfo = bulkMethods.find((method) => method.id === selectedMethod) || bulkMethods[0];
  const selectedTemplateInfo = bulkSavedTemplates.find((template) => template.id === selectedTemplate) || bulkSavedTemplates[0];
  const selectedDoctorDepartments = Array.from(new Set(selectedDoctorRecords.map((doctor) => doctor.department).filter(Boolean)));
  const selectedDepartmentScope = selectedDoctorDepartments.length > 1
    ? `${selectedDoctorDepartments.length} khoa`
    : selectedDoctorDepartments[0] || selectedDepartment;
  const selectedDepartmentPreview = selectedDoctorDepartments.length > 2
    ? `${selectedDoctorDepartments.slice(0, 2).join(', ')} +${selectedDoctorDepartments.length - 2}`
    : selectedDoctorDepartments.join(', ') || selectedDepartment;
  const selectedDoctorLoadAverage = selectedDoctorRecords.length
    ? Math.round(selectedDoctorRecords.reduce((total, doctor) => total + Number(doctor.load || 0), 0) / selectedDoctorRecords.length)
    : 0;
  const sourceStatusLabel = loading
    ? 'Đang đồng bộ'
    : backendConnected
      ? createResourcesLoaded
        ? 'Database hệ thống'
        : 'Thiếu dữ liệu tạo lịch'
      : 'Chưa kết nối database';
  const basicSummaryItems = [
    [UsersRound, 'Bác sĩ', formatCompactNumber(projectedDoctors), selectedDepartmentScope],
    [HeartPulse, 'Khoa theo bác sĩ', selectedDepartmentScope, selectedDepartmentPreview],
    [CalendarDays, 'Ngày áp dụng', formatCompactNumber(projectedDays), scheduleRuleLabel],
    [CalendarCheck2, 'Slot dự kiến', formatCompactNumber(projectedSlots), `${projectedSlotsPerDoctorDay} slot/BS/ngày`],
  ];
  const basicDetailItems = [
    ['Phạm vi', `${selectedDepartmentPreview} · ${formatCompactNumber(projectedDoctors)} bác sĩ`],
    ['Loại lịch', selectedScheduleType],
    ['Khoảng áp dụng', `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`],
    ['Quy tắc lặp', scheduleRuleLabel],
    ['Phạm vi ngày', appliedDayScopeLabel],
    ['Cơ sở tính slot', `${workStart}-${workEnd} · ${slotDuration} · ${slotCapacity}`],
    ['Tải TB bác sĩ', selectedDoctorLoadAverage ? `${selectedDoctorLoadAverage}%` : 'Chưa có dữ liệu'],
    ['BN dự kiến', `${formatCompactNumber(projectedPatients)} · 83% lấp đầy`],
  ];
  const repeatCycleLabel = repeatFrequency === 'Hàng tuần'
    ? `${repeatEveryWeeks} tuần`
    : repeatFrequency === 'Hàng tháng'
      ? `${repeatCount} tháng`
      : repeatFrequency === 'Hàng ngày'
        ? `${repeatCount} ngày`
        : `${repeatCount} chu kỳ`;
  const repeatPreviewCollapsedRows = Math.max(6, selectedDoctorRecords.length || 1);
  const repeatPreviewMaxRows = isRepeatPreviewExpanded ? Number.POSITIVE_INFINITY : repeatPreviewCollapsedRows;
  const repeatPreviewResult = buildRepeatPreviewRows({
    start: dateRange.start,
    end: effectiveScheduleEndDate,
    selectedDays,
    doctors: selectedDoctorRecords,
    workStart,
    workEnd,
    selectedScheduleType,
    selectedDepartment,
    slotCount: projectedSlotsPerDoctorDay,
    exceptionDates,
    existingSchedules: schedules,
    conflictEnabled: advancedSettings.conflict,
    repeatFrequency,
    repeatEveryWeeks,
    appliedDays: bulkAppliedDays,
    maxRows: repeatPreviewMaxRows,
  });
  const repeatPreviewRows = repeatPreviewResult.rows;
  const repeatPreviewHiddenRows = Math.max(0, repeatPreviewResult.totalCount - repeatPreviewRows.length);
  const repeatPreviewExcludedCount = repeatPreviewResult.excludedCount;
  const repeatPreviewSchedules = repeatPreviewResult.validCount;
  const repeatPreviewSlots = repeatPreviewSchedules * projectedSlotsPerDoctorDay;
  const avatarDoctors = selectedDoctorRecords.length ? selectedDoctorRecords.slice(0, 3) : doctorSelectionOptions.slice(0, 3);
  const selectedAllocationDoctors = [...selectedDoctorRecords].sort((first, second) => {
    const departmentCompare = String(first.department || '').localeCompare(String(second.department || ''), 'vi-VN');
    return departmentCompare || Number(first.load || 0) - Number(second.load || 0);
  });
  const availableAllocationDoctors = doctorSelectionOptions.filter((doctor) => !selectedDoctors.includes(doctor.id));
  const allocationPreviewDays = bulkAppliedDays;
  const allocationRows = selectedAllocationDoctors.map((doctor, rowIndex) =>
    buildAllocationDoctorRow({
      doctor,
      rowIndex,
      days: allocationPreviewDays,
      workStart,
      workEnd,
      existingSchedules: schedules,
      conflictEnabled: advancedSettings.conflict,
      selectedDistribution,
      projectedSlotsPerDoctorDay,
      slotCapacity,
      slotDuration,
      selectedScheduleType,
      conflictResolutions,
    }),
  );
  const allocationConflictCells = allocationRows.flatMap((row) =>
    row.cells
      .map((cell, dayIndex) => ({
        row,
        doctor: row.doctor,
        rowIndex: row.rowIndex,
        cell,
        day: allocationPreviewDays[dayIndex],
        dayIndex,
      }))
      .filter(({ cell }) => Array.isArray(cell.conflicts) && cell.conflicts.length),
  );
  const allocationConflictCount = allocationConflictCells.filter(({ cell }) => cell.status === 'conflict').length;
  const allocationResolvedConflictCount = allocationConflictCells.length - allocationConflictCount;
  const activeConflictCell = activeConflictKey
    ? allocationConflictCells.find(({ cell }) => cell.conflictKey === activeConflictKey)
    : null;
  const nextConflictToReview = allocationConflictCells.find(({ cell }) => cell.status === 'conflict') || allocationConflictCells[0] || null;
  const activeConflictResolution = activeConflictCell?.cell?.resolution || '';
  const activeConflictBookedCount = activeConflictCell?.cell?.conflicts?.reduce((total, schedule) => total + Number(schedule.bookedSlots || 0), 0) || 0;
  const activeConflictBlockedCount = activeConflictCell?.cell?.conflicts?.reduce((total, schedule) => total + Number(schedule.blockedSlots || 0), 0) || 0;
  const activeConflictProposedSlots = activeConflictCell
    ? activeConflictCell.cell.slots || getDistributedSlotsForDoctor(
        projectedSlotsPerDoctorDay,
        activeConflictCell.doctor,
        activeConflictCell.rowIndex || 0,
        selectedDistribution,
        slotCapacity,
      )
    : 0;
  const activeConflictProposedCapacity = activeConflictProposedSlots * parseCapacity(slotCapacity);
  const activeConflictProposedPatients = activeConflictCell
    ? Number(activeConflictCell.cell.patients || activeConflictProposedCapacity)
    : 0;
  const activeConflictBreakWindows = activeConflictCell ? buildBulkBreakWindows() : [];
  const activeConflictExactMatchCount = activeConflictCell?.cell?.conflicts?.filter(
    (schedule) => schedule.start === workStart && schedule.end === workEnd,
  ).length || 0;
  const activeConflictReplacementEffect = activeConflictExactMatchCount
    ? 'Cập nhật lịch hiện tại trùng đúng khung giờ thành bản nháp theo cấu hình mới.'
    : 'Hủy lịch hiện tại đang trùng trong database rồi tạo lịch nháp mới.';
  const allocationTotalSlots = allocationRows.reduce((total, row) => total + row.totalSlots, 0);
  const allocationTotalPatients = allocationRows.reduce((total, row) => total + row.totalPatients, 0);
  const allocationExcludedCount = allocationRows.reduce(
    (total, row) => total + row.cells.filter((cell) => cell.status === 'exception').length,
    0,
  );
  const allocationAppliedDayCount = allocationPreviewDays.filter((day) => day.isApplicable && !day.isExcluded).length;
  const calendarWeeks = buildMonthCalendarWeeks(dateRange.start);
  const calendarAppliedDateSet = new Set(allocationPreviewDays.filter((day) => !day.isExcluded).map((day) => day.dateValue));
  const calendarExceptionDateSet = new Set(exceptionDates.map((item) => normalizeDateKey(item.value)).filter(Boolean));
  const calendarMonthLabel = formatMonthYear(dateRange.start);
  const allocationCellCount = allocationRows.reduce((total, row) => total + row.cells.length, 0);
  const databaseExcelPreviewRows = allocationRows
    .flatMap((row) =>
      row.cells.map((cell, dayIndex) => {
        const day = allocationPreviewDays[dayIndex];
        const statusMap = {
          scheduled: ['Hợp lệ', 'valid'],
          conflict: ['Cảnh báo', 'warning'],
          'resolved-new': ['Tạo mới', 'valid'],
          'resolved-existing': ['Giữ lịch cũ', 'warning'],
          exception: ['Loại trừ', 'warning'],
          off: ['Không áp dụng', 'error'],
        };
        const [status, tone] = statusMap[cell.status] || ['Cần kiểm tra', 'warning'];
        return [
          formatDateDisplay(day?.dateValue || ''),
          row.doctor.name,
          row.doctor.department || 'Chưa có khoa',
          selectedScheduleType,
          cell.timeRange || `${workStart}-${workEnd}`,
          cell.slots || 0,
          status,
          tone,
        ];
      }),
    )
    .slice(0, 5)
    .map((row, index) => [String(index + 1), ...row]);
  const displayedPreviewSlots = allocationTotalSlots;
  const displayedPreviewPatients = allocationTotalPatients;
  const potentialAllocationSlots = selectedAllocationDoctors.length * projectedDays * projectedSlotsPerDoctorDay;
  const scheduledFillRate = displayedPreviewSlots
    ? Math.round((displayedPreviewPatients / displayedPreviewSlots) * 100)
    : 0;
  const allocatedCapacityRate = potentialAllocationSlots
    ? Math.round((displayedPreviewSlots / potentialAllocationSlots) * 100)
    : 0;
  const distributionPerformanceBonus = selectedDistribution === 'ratio' ? 3 : selectedDistribution === 'even' ? 2 : 1;
  const performancePenalty =
    allocationConflictCount * 2
    + allocationExcludedCount
    + (projectedShiftMinutes > 0 ? 0 : 20);
  const projectedPerformanceScore = displayedPreviewSlots
    ? clampPercent(scheduledFillRate + distributionPerformanceBonus - performancePenalty)
    : 0;
  const servicePrice = getScheduleTypePrice(selectedScheduleType);
  const projectedRevenue = displayedPreviewPatients * servicePrice;
  const projectedRevenueCeiling = Math.max(
    projectedRevenue,
    Math.round((displayedPreviewSlots * servicePrice * 0.92) / 1000) * 1000,
  );
  const shiftSlotBreakdown = buildShiftSlotBreakdown({
    totalSlots: displayedPreviewSlots,
    workStart,
    workEnd,
    breaks: [
      ...(isBreakEnabled ? [{ start: breakStart, end: breakEnd }] : []),
      ...extraBreaks,
    ],
  });
  const missingDepartmentDoctorCount = selectedAllocationDoctors.filter((doctor) => !resolveDoctorDepartmentId(doctor)).length;
  const resolvedDepartmentDoctorCount = selectedAllocationDoctors.length - missingDepartmentDoctorCount;
  const breakMinutes = isBreakEnabled ? getClockRangeMinutes(breakStart, breakEnd) : 0;
  const isBreakInsideWork = !isBreakEnabled || getEffectiveOverlapMinutes({
    workRanges: splitClockRange(workStart, workEnd),
    compareRanges: splitClockRange(breakStart, breakEnd),
  }) === breakMinutes;
  const hasValidWorkRange = projectedShiftMinutes > 0;
  const reviewItemCount = allocationConflictCount + allocationExcludedCount + missingDepartmentDoctorCount + (isBreakInsideWork ? 0 : 1);
  const bulkAlertChecks = [
    {
      tone: allocationConflictCount ? 'danger' : 'success',
      message: allocationConflictCount
        ? `${allocationConflictCount} ô lịch đang trùng lịch hiện tại`
        : 'Không phát hiện xung đột lịch',
    },
    {
      tone: missingDepartmentDoctorCount ? 'warning' : 'success',
      message: missingDepartmentDoctorCount
        ? `${missingDepartmentDoctorCount} bác sĩ chưa có mã khoa từ database`
        : `${selectedDoctorDepartments.length || 1} khoa được tạo đúng theo từng bác sĩ`,
    },
    {
      tone: hasValidWorkRange ? 'success' : 'danger',
      message: hasValidWorkRange
        ? `Khung giờ ${workStart}-${workEnd} tạo được ${projectedSlotsPerDoctorDay} slot/BS/ngày`
        : 'Khung giờ làm việc chưa tạo được slot hợp lệ',
    },
    {
      tone: isBreakInsideWork ? 'success' : 'warning',
      message: isBreakEnabled
        ? isBreakInsideWork
          ? `Giờ nghỉ ${breakStart}-${breakEnd} nằm trong ca làm việc`
          : `Giờ nghỉ ${breakStart}-${breakEnd} nằm ngoài ca ${workStart}-${workEnd}`
        : 'Không cấu hình nghỉ giữa giờ',
    },
    {
      tone: allocationExcludedCount ? 'warning' : 'success',
      message: allocationExcludedCount
        ? `${allocationExcludedCount} ô lịch bị loại trừ theo ngày ngoại lệ`
        : 'Không có ngày ngoại lệ trong bảng phân bổ',
    },
  ];
  const bulkAlertDetailItems = [
    [allocationConflictCount, 'Xung đột lịch'],
    [`${resolvedDepartmentDoctorCount}/${selectedAllocationDoctors.length}`, 'Bác sĩ có mã khoa'],
    [reviewItemCount, 'Mục cần rà soát'],
  ];
  const aiProcessingStepRows = aiProcessingSteps.map((step) =>
    step.title === 'Đọc dữ liệu'
      ? { ...step, copy: `${formatCompactNumber(databaseDoctors.length)} bác sĩ, ${formatCompactNumber(databaseDepartments.length)} khoa từ database` }
      : step,
  );
  const activeAiProcessingStep = aiProcessing.activeIndex >= 0 ? aiProcessingStepRows[aiProcessing.activeIndex] : null;
  const aiProcessingStatusText =
    aiProcessing.status === 'running' && activeAiProcessingStep
      ? `Đang ${activeAiProcessingStep.title.toLocaleLowerCase('vi-VN')}...`
      : aiProcessing.status === 'complete'
        ? 'Hoàn tất tối ưu lịch'
        : 'Sẵn sàng đọc yêu cầu';
  const aiQuickProgress = aiProcessing.status === 'idle'
    ? 72
    : Math.max(0, Math.min(100, Math.round(aiProcessing.progress || 72)));
  const aiPreviewViewInfo = aiPreviewViewModes.find((mode) => mode.id === aiPreviewView) || aiPreviewViewModes[1];
  const aiPreviewColumnCount = aiPreviewViewInfo.days;
  const aiPreviewVisibleDays = buildAiPreviewDays(aiPreviewDate, aiPreviewColumnCount);
  const aiPreviewTitle =
    aiPreviewView === 'week'
      ? `Tuần ${formatAiPreviewDate(aiPreviewDate)} - ${formatAiPreviewDate(addDays(aiPreviewDate, aiPreviewColumnCount - 1))}`
      : aiPreviewView === 'gantt'
        ? `Gantt tối ưu ${formatAiPreviewMonth(aiPreviewDate)}`
        : formatAiPreviewMonth(aiPreviewDate);
  const aiPreviewDepartmentRows = databaseDepartments
    .map((department, departmentIndex) => {
      const departmentDoctors = selectedAllocationDoctors.filter((doctor) => doctor.department === department.name);
      const departmentRows = allocationRows.filter((row) => row.doctor.department === department.name);
      return {
        department: department.name,
        doctors: departmentDoctors.map((doctor) => doctor.name).slice(0, 4),
        blocks: departmentRows.slice(0, 6).map((row, rowIndex) => [
          row.doctor.name,
          `${workStart} - ${workEnd} · ${row.doctor.department}`,
          (departmentIndex * 2 + rowIndex) % Math.max(1, aiPreviewColumnCount - 1),
          Math.max(1, Math.min(3, Math.ceil((row.totalSlots || projectedSlotsPerDoctorDay || 1) / Math.max(1, projectedSlotsPerDoctorDay || 1)))),
          ['teal', 'blue', 'purple', 'amber'][rowIndex % 4],
        ]),
      };
    })
    .filter((row) => row.doctors.length || row.blocks.length);
  const aiDoctorOptions = Array.from(
    new Set(
      aiPreviewDepartmentRows.flatMap((row) => [
        ...row.doctors,
        ...row.blocks.map(([doctor]) => doctor),
      ]),
    ),
  );
  const filteredAiDepartmentRows = aiPreviewDepartmentRows
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
  const aiDoctorCoverage = Math.min(99, 88 + enabledAutomationCount * 2 + (aiProcessing.status === 'complete' ? 0 : -2));
  const aiConflictCount = aiAutomationState.conflict ? 0 : Math.max(2, Math.round(aiAppliedDays / 8));
  const aiEfficiencyScore = Math.min(100, 85 + enabledAutomationCount * 2 + (aiProcessing.status === 'complete' ? 0 : -1));
  const aiShiftCount = workStart < '12:00' && workEnd <= '11:30' ? 1 : 2;
  const aiSideStats = [
    {
      label: 'Tổng lịch tạo',
      value: formatCompactNumber(aiTotalSchedules),
      note: '22% so với trước',
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
      note: aiConflictCount === 0 ? 'Không xung đột' : 'Cần kiểm tra',
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
    [HeartPulse, 'Khoa / Phòng', '8 khoa phòng'],
    [CalendarDays, 'Khoảng thời gian', '01/05 - 31/05/2026'],
    [CalendarCheck2, 'Ngày áp dụng', '01/05/2026'],
    [Clock3, 'Số buổi / ngày', '2 buổi'],
    [ClipboardList, 'Tổng số slot', `${formatCompactNumber(aiTotalSchedules)} slot`],
  ];

  function toggleDay(day) {
    if (isDayDisabledByType(day, selectedDayType)) {
      setActionMessage(`${day} không nằm trong phạm vi ngày áp dụng hiện tại.`);
      return;
    }
    setSelectedDays((current) => {
      const nextDays = current.includes(day) ? current.filter((item) => item !== day) : [...current, day];
      setSelectedDayType(classifySelectedDays(nextDays));
      return nextDays;
    });
  }

  function updateRepeatEveryWeeks(nextValue) {
    const normalizedValue = Math.min(12, Math.max(1, Number(nextValue) || 1));
    setRepeatEveryWeeks(normalizedValue);
    setActionMessage(`Đã cập nhật chu kỳ lặp mỗi ${normalizedValue} tuần.`);
  }

  function updateDateRangeEveryDays(nextValue) {
    const normalizedValue = Math.min(31, Math.max(1, Number(nextValue) || 1));
    setDateRangeEveryDays(normalizedValue);
    setActionMessage(`Đã cập nhật dải ngày: tạo lịch mỗi ${normalizedValue} ngày.`);
  }

  function chooseRepeatFrequency(option) {
    setRepeatFrequency(option);
    if (option !== 'Hàng tuần') {
      setRepeatEveryWeeks(1);
    }
    setOpenFieldMenu('');
    setActionMessage(`Đã chọn chu kỳ lặp: ${option}.`);
  }

  function toggleDoctor(id) {
    setSelectedDoctors((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectVisibleDoctors() {
    const visibleIds = filteredDoctorOptions.map((doctor) => doctor.id);
    setSelectedDoctors((current) => Array.from(new Set([...current, ...visibleIds])));
    setActionMessage(`Đã chọn ${visibleIds.length} bác sĩ đang hiển thị.`);
  }

  function clearSelectedDoctors() {
    setSelectedDoctors([]);
    setActionMessage('Đã bỏ chọn toàn bộ bác sĩ.');
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
    if (getClockRangeMinutes(extraBreakDraftStart, extraBreakDraftEnd) <= 0) {
      setActionMessage('Khoảng nghỉ chưa hợp lệ.');
      return;
    }
    const nextBreak = {
      id: `break-${Date.now()}`,
      start: extraBreakDraftStart,
      end: extraBreakDraftEnd,
    };
    setExtraBreaks((current) => [...current, nextBreak]);
    setIsExtraBreakFormOpen(false);
    setActionMessage(`Đã thêm khoảng nghỉ ${nextBreak.start} - ${nextBreak.end}.`);
  }

  function updateExtraBreak(id, field, value) {
    setExtraBreaks((current) => current.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    setActionMessage('Đã cập nhật khoảng nghỉ bổ sung.');
  }

  function removeExtraBreak(id) {
    setExtraBreaks((current) => current.filter((item) => item.id !== id));
    setActionMessage('Đã xóa khoảng nghỉ bổ sung.');
  }

  function addExceptionDate(option) {
    const scopeLabel = exceptionScopeOptions.find(([id]) => id === (option.scope || exceptionDraftScope))?.[1] || 'Tất cả bác sĩ';
    const nextException = {
      value: option.value,
      label: option.label || formatDateDisplay(option.value),
      reason: option.reason || exceptionDraftReason,
      scope: option.scope || exceptionDraftScope,
      scopeLabel,
    };
    setExceptionDates((current) => (current.some((item) => item.value === nextException.value && item.scope === nextException.scope)
      ? current
      : [...current, nextException]));
    setOpenFieldMenu('');
    setActionMessage(`Đã thêm ngày loại trừ ${nextException.label}.`);
  }

  function removeExceptionDate(value, scope) {
    setExceptionDates((current) => current.filter((item) => item.value !== value || item.scope !== scope));
    setActionMessage('Đã xóa ngày ngoại lệ.');
  }

  function toggleAdvancedSetting(key) {
    setAdvancedSettings((current) => ({ ...current, [key]: !current[key] }));
    const labels = {
      conflict: 'kiểm tra xung đột tự động',
      lightLoad: 'ưu tiên bác sĩ ít lịch',
    };
    setActionMessage(`Đã cập nhật ${labels[key]}.`);
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
    const doctor = doctorSelectionOptions.find((item) => item.id === id);
    if (!doctor) {
      return;
    }

    setSelectedDoctors((current) => (current.includes(id) ? current : [...current, id]));
    setIsDoctorPickerOpen(false);
    setActionMessage(`Đã thêm ${doctor.name} vào phân bổ lịch.`);
  }

  function removeAllocationDoctor(id) {
    const doctor = doctorSelectionOptions.find((item) => item.id === id);

    if (selectedDoctors.length <= 1) {
      setActionMessage('Cần giữ ít nhất 1 bác sĩ trong lịch phân bổ.');
      return;
    }

    setSelectedDoctors((current) => current.filter((item) => item !== id));
    setActionMessage(`Đã gỡ ${doctor?.name || 'bác sĩ'} khỏi phân bổ lịch.`);
  }

  useEffect(() => {
    if (!createResourcesLoaded || !databaseDoctors.length) {
      setSelectedDoctors((current) => (current.length ? [] : current));
      return;
    }

    const databaseDoctorIds = new Set(databaseDoctors.map((doctor) => String(doctor.id)));
    setSelectedDoctors((current) => {
      const validSelectedDoctors = current.filter((doctorId) => databaseDoctorIds.has(String(doctorId)));
      if (validSelectedDoctors.length) {
        return validSelectedDoctors.length === current.length ? current : validSelectedDoctors;
      }

      const defaultDoctorIds = databaseDoctors.slice(0, 2).map((doctor) => doctor.id);
      return defaultDoctorIds.every((doctorId, index) => current[index] === doctorId) && current.length === defaultDoctorIds.length
        ? current
        : defaultDoctorIds;
    });
  }, [createResourcesLoaded, databaseDoctorIdentityKey]);

  useEffect(() => {
    if (!createResourcesLoaded || !databaseDepartments.length) {
      return;
    }

    if (!databaseDepartments.some((department) => department.name === selectedDepartment)) {
      setSelectedDepartment(databaseDepartments[0].name);
    }
  }, [createResourcesLoaded, databaseDepartmentIdentityKey, selectedDepartment]);

  useEffect(() => {
    setAiChatMessages((current) =>
      current.map((message) =>
        message.id === 'ai-welcome'
          ? {
              ...message,
              content: createResourcesLoaded
                ? `Tôi sẽ dùng ${formatCompactNumber(databaseDoctors.length)} bác sĩ và ${formatCompactNumber(databaseDepartments.length)} khoa từ database để tạo lịch hàng loạt.`
                : 'Tôi cần dữ liệu bác sĩ và khoa từ database trước khi tạo lịch hàng loạt.',
            }
          : message,
      ),
    );
  }, [createResourcesLoaded, databaseDoctorIdentityKey, databaseDepartmentIdentityKey]);

  useEffect(() => {
    if (scheduleTypeChoices.length && !scheduleTypeChoices.includes(selectedScheduleType)) {
      setSelectedScheduleType(scheduleTypeChoices[0]);
    }
  }, [scheduleTypeChoices, selectedScheduleType]);

  useEffect(() => {
    setValidationIssues([]);
    setConflictResolutions({});
    setActiveConflictKey('');
  }, [
    selectedMethod,
    selectedDoctors,
    selectedDepartment,
    selectedScheduleType,
    dateRange,
    workStart,
    workEnd,
    slotDuration,
    slotCapacity,
    breakStart,
    breakEnd,
    selectedDays,
    exceptionDates,
    extraBreaks,
    rangeInterval,
    rangeRepeatStart,
    dateRangeEveryDays,
    repeatFrequency,
    repeatEveryWeeks,
    selectedRepeatEnd,
    repeatEndDate,
    repeatCount,
    advancedSettings.conflict,
    advancedSettings.lightLoad,
  ]);

  useEffect(() => {
    function handleBulkCreateFocus(event) {
      focusValidationIssue(event.detail);
    }

    window.addEventListener(SCHEDULING_BULK_CREATE_FOCUS_EVENT, handleBulkCreateFocus);
    return () => {
      window.removeEventListener(SCHEDULING_BULK_CREATE_FOCUS_EVENT, handleBulkCreateFocus);
    };
  }, []);

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
          aiProcessingStepRows.length - 1,
          Math.floor(nextProgress / (100 / aiProcessingStepRows.length)),
        );

        return {
          ...current,
          progress: nextProgress,
          activeIndex: nextProgress >= 100 ? aiProcessingStepRows.length - 1 : nextActiveIndex,
        };
      });
    }, 420);

    return () => window.clearInterval(timer);
  }, [aiProcessing.status, aiProcessingStepRows.length]);

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
      activeIndex: aiProcessingStepRows.length - 1,
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

  function openConflictResolution(conflictKey) {
    if (!conflictKey) return;
    setActiveConflictKey(conflictKey);
    setIsPreviewDetailOpen(true);
    setIsAlertDetailOpen(true);
    setActiveStep(4);
    setQuickActionFeedback('Đã mở chi tiết xung đột. Chọn giữ lịch hiện tại hoặc thay bằng lịch nháp mới.');
    scrollToSection('bulk-conflict-resolution');
  }

  function applyConflictResolution(conflictKey, decision) {
    if (!conflictKey) return;

    setConflictResolutions((current) => {
      if (!decision) {
        const next = { ...current };
        delete next[conflictKey];
        return next;
      }

      return {
        ...current,
        [conflictKey]: {
          decision,
          decidedAt: Date.now(),
        },
      };
    });

    const messageMap = {
      'keep-existing': 'Đã chọn giữ lịch hiện tại và bỏ lịch mới cho ô trùng này.',
      'replace-new': 'Đã chọn tạo lịch nháp mới và hủy lịch hiện tại khi lưu.',
    };
    setQuickActionFeedback(messageMap[decision] || 'Đã đưa ô trùng về trạng thái cần xử lý.');
  }

  function clearAllConflictResolutions() {
    setConflictResolutions({});
    setActiveConflictKey('');
    setQuickActionFeedback('Đã đưa toàn bộ xung đột về trạng thái cần rà soát.');
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
      setDateRangeEveryDays(1);
      setRepeatEndDate('2026-05-31');
      setSelectedRepeatEnd('unlimited');
      setSelectedDayType('all');
      setSelectedDays(allWeekDays);
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
      setAiPreviewView('month');
      setAiProcessing((current) => ({
        ...current,
        status: 'showcase',
        progress: 78,
        activeIndex: 3,
        prompt: 'Tạo lịch khoa Nhi từ 01-31/05',
        runId: current.runId || Date.now(),
      }));
      return;
    }

    if (method.id === 'range') {
      setActiveStep(2);
      setSelectedAdvancedTab('repeat');
      setDateRange({ start: '2026-05-01', end: '2026-05-31' });
      setRangeInterval('Mỗi 2 ngày');
      setRangeRepeatStart('2026-05-01');
      setRepeatEndDate('2026-05-31');
      setSelectedRepeatEnd('date');
      setSelectedDayType('all');
      setSelectedDays(allWeekDays);
      setActiveCommandPanel('');
      return;
    }

    setActiveCommandPanel('');
  }

  function applyDateRangePreset(option) {
    if (option.label === 'Tùy chọn') {
      setSelectedDateRangePreset(option.label);
      setOpenFieldMenu('dateRange');
      setActionMessage('Đã mở chọn dải ngày tùy chỉnh.');
      return;
    }

    setSelectedDateRangePreset(option.label);
    setDateRange({ start: option.start, end: option.end });
    setRepeatEndDate(option.end);
    setOpenFieldMenu('');
    setActionMessage(`Đã áp dụng dải ngày: ${option.label}.`);
  }

  function updateDateRangeField(field, value) {
    setSelectedDateRangePreset('Tùy chọn');
    setDateRange((current) => ({ ...current, [field]: value }));
    if (field === 'end') {
      setRepeatEndDate(value);
    }
    if (field === 'start' && isRangeMethod) {
      setRangeRepeatStart(value);
    }
    setActionMessage(`Đã cập nhật ${field === 'start' ? 'ngày bắt đầu' : 'ngày kết thúc'} dải ngày.`);
  }

  function applySavedTemplate(template) {
    setSelectedTemplate(template.id);
    setSelectedMethod(template.method);
    setSelectedDays(template.days);
    if (template.method === 'date-range') {
      setDateRange({ start: '2026-05-01', end: '2026-05-31' });
      setSelectedDateRangePreset('30 ngày');
      setDateRangeEveryDays(1);
      setRepeatEndDate('2026-05-31');
      setSelectedRepeatEnd('unlimited');
      setSelectedDayType('all');
      setSelectedDays(allWeekDays);
    }
    setActiveCommandPanel('');
    setActionMessage(`Đã áp dụng mẫu: ${template.title}.`);
    scrollToSection('bulk-step-basic');
  }

  function exportPreviewFile() {
    const rows = [
      ['Bác sĩ', ...allocationPreviewDays.map((day) => `${day.day} ${day.label}`), 'Tổng slot', 'Tổng BN'],
      ...allocationRows.map((row) => [
        row.doctor.name,
        ...row.cells.map((cell) => (cell.slots ? String(cell.slots) : cell.label)),
        String(row.totalSlots),
        String(row.totalPatients),
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

  function countSelectedWeekdays(startValue, endValue, days) {
    const startDate = new Date(startValue);
    const endDate = new Date(endValue);
    const dayMap = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 };
    const selectedDayIndexes = new Set((days || []).map((day) => dayMap[day]).filter((day) => day !== undefined));

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || !selectedDayIndexes.size) {
      return 0;
    }

    let count = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      if (selectedDayIndexes.has(cursor.getDay())) {
        count += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  function parseRangeIntervalDays(value) {
    const interval = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
    return Number.isNaN(interval) || interval <= 0 ? 1 : interval;
  }

  function normalizeDateKey(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  function formatLocalDateKey(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function isDateWithinRange(dateValue, startValue, endValue) {
    const date = new Date(dateValue);
    const startDate = new Date(startValue);
    const endDate = new Date(endValue);
    if ([date, startDate, endDate].some((item) => Number.isNaN(item.getTime()))) return false;
    return date >= startDate && date <= endDate;
  }

  function isDateIncludedByRangeInterval(date, anchorDate, intervalDays) {
    if (date < anchorDate) return false;
    const daysFromAnchor = Math.floor((getStartOfLocalDay(date) - getStartOfLocalDay(anchorDate)) / 86400000);
    return daysFromAnchor % Math.max(1, intervalDays) === 0;
  }

  function getStartOfLocalDay(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  function buildMonthCalendarWeeks(monthValue) {
    const anchor = new Date(monthValue);
    const safeAnchor = Number.isNaN(anchor.getTime()) ? new Date(2026, 4, 1) : anchor;
    const firstDay = new Date(safeAnchor.getFullYear(), safeAnchor.getMonth(), 1);
    const lastDay = new Date(safeAnchor.getFullYear(), safeAnchor.getMonth() + 1, 0);
    const weeks = [];
    let week = Array((firstDay.getDay() + 6) % 7).fill(null);

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(safeAnchor.getFullYear(), safeAnchor.getMonth(), day);
      week.push({
        day: String(day),
        dateValue: formatLocalDateKey(date),
      });

      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    if (week.length) {
      weeks.push([...week, ...Array(7 - week.length).fill(null)]);
    }

    return weeks;
  }

  function formatMonthYear(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Tháng áp dụng';
    return `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
  }

  function buildAllocationPreviewDays({
    method,
    start,
    end,
    selectedDays: days,
    exceptionDates: exclusions,
    repeatFrequency: frequency,
    repeatEveryWeeks: everyWeeks,
    rangeInterval: intervalLabel,
    rangeRepeatStart: intervalStart,
    dateRangeEveryDays: everyDays,
    selectedRepeatEnd: repeatEndMode,
    repeatCount: maxOccurrences,
    maxDays = 366,
  }) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];

    const selectedDaySet = new Set((days || []).length ? days : allWeekDays);
    const exclusionSet = new Set((exclusions || []).map((item) => item.value));
    const intervalDays = parseRangeIntervalDays(intervalLabel);
    const dateRangeIntervalDays = Math.max(1, Number(everyDays) || 1);
    const rangeAnchor = new Date(intervalStart || start);
    const safeRangeAnchor = Number.isNaN(rangeAnchor.getTime()) ? startDate : rangeAnchor;
    const occurrenceLimit = repeatEndMode === 'count' ? Math.max(1, Number(maxOccurrences) || 1) : Number.POSITIVE_INFINITY;
    const result = [];
    const cursor = new Date(startDate);
    let occurrenceCount = 0;

    while (cursor <= endDate && result.length < maxDays && occurrenceCount < occurrenceLimit) {
      const dateValue = cursor.toISOString().slice(0, 10);
      const day = getVietnameseWeekday(cursor);
      const isInCycle = method === 'range'
        ? isDateIncludedByRangeInterval(cursor, safeRangeAnchor, intervalDays)
        : method === 'date-range'
          ? isDateIncludedByRangeInterval(cursor, startDate, dateRangeIntervalDays)
          : isDateIncludedByRepeatCycle(cursor, startDate, frequency, everyWeeks);
      const isApplicable = selectedDaySet.has(day) && isInCycle;
      const isExcluded = exclusionSet.has(dateValue);
      if (isApplicable) {
        occurrenceCount += 1;
        result.push({
          id: dateValue,
          dateValue,
          day,
          label: formatShortDate(dateValue),
          isApplicable,
          isExcluded,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  function buildAllocationDoctorRow({
    doctor,
    rowIndex,
    days,
    workStart: startTime,
    workEnd: endTime,
    existingSchedules,
    conflictEnabled,
    selectedDistribution: distribution,
    projectedSlotsPerDoctorDay: baseSlots,
    slotCapacity: capacityValue,
    slotDuration: durationValue,
    selectedScheduleType: scheduleType,
    conflictResolutions: resolutions,
  }) {
    const cells = days.map((day) => {
      if (!day.isApplicable) {
        return { status: 'off', label: 'Không áp dụng', slots: 0, patients: 0, note: 'Không nằm trong thứ đã chọn' };
      }

      if (day.isExcluded) {
        return { status: 'exception', label: 'Loại trừ', slots: 0, patients: 0, note: 'Ngày loại trừ ở tùy chọn nâng cao' };
      }

      const conflicts = conflictEnabled
        ? findScheduleConflicts({
            date: day.dateValue,
            doctor,
            startTime,
            endTime,
            existingSchedules,
          })
        : [];

      const slots = getDistributedSlotsForDoctor(baseSlots, doctor, rowIndex, distribution, capacityValue);
      const patients = Math.round(slots * 0.83);

      if (conflicts.length) {
        const conflictKey = buildConflictKey(doctor.id, day.dateValue, startTime, endTime);
        const resolution = resolutions?.[conflictKey]?.decision || '';
        const firstConflict = conflicts[0];
        const conflictNote = `${firstConflict.start}-${firstConflict.end} · ${firstConflict.scheduleType || firstConflict.status || 'Đã có lịch'}`;

        if (resolution === 'keep-existing') {
          return {
            status: 'resolved-existing',
            label: 'Giữ lịch cũ',
            slots: 0,
            patients: 0,
            note: `${conflicts.length} lịch hiện tại được giữ lại · bỏ lịch mới`,
            timeRange: `${startTime}-${endTime}`,
            capacityLabel: `${capacityValue} / ${durationValue}`,
            conflicts,
            conflictKey,
            resolution,
          };
        }

        if (resolution === 'replace-new') {
          return {
            status: 'resolved-new',
            label: 'Tạo mới',
            slots,
            patients,
            timeRange: `${startTime}-${endTime}`,
            capacityLabel: `${capacityValue} / ${durationValue}`,
            note: `Tạo lịch nháp mới · hủy ${conflicts.length} lịch hiện tại khi lưu`,
            conflicts,
            conflictKey,
            resolution,
          };
        }

        return {
          status: 'conflict',
          label: 'Trùng',
          slots: 0,
          patients: 0,
          note: conflicts.length > 1 ? `${conflicts.length} lịch trùng · ${conflictNote}` : conflictNote,
          timeRange: `${startTime}-${endTime}`,
          capacityLabel: `${capacityValue} / ${durationValue}`,
          conflicts,
          conflictKey,
          resolution: '',
        };
      }

      return {
        status: 'scheduled',
        label: 'Có lịch',
        slots,
        patients,
        timeRange: `${startTime}-${endTime}`,
        capacityLabel: `${capacityValue} / ${durationValue}`,
        note: `${scheduleType} · ${startTime}-${endTime} · ${capacityValue} mỗi ${durationValue}`,
      };
    });

    const totalSlots = cells.reduce((total, cell) => total + cell.slots, 0);
    const totalPatients = cells.reduce((total, cell) => total + cell.patients, 0);
    return { doctor, rowIndex, cells, totalSlots, totalPatients };
  }

  function getDistributedSlotsForDoctor(baseSlots, doctor, rowIndex, distribution, capacityValue) {
    const minimumStep = Math.max(1, parseCapacity(capacityValue));
    const normalizedBase = Math.max(0, baseSlots);
    if (!normalizedBase) return 0;

    if (distribution === 'ratio') {
      const load = Number(doctor.load || 70);
      const factor = load >= 90 ? 0.82 : load <= 60 ? 1.16 : load <= 75 ? 1.06 : 0.94;
      return Math.max(minimumStep, Math.round((normalizedBase * factor) / minimumStep) * minimumStep);
    }

    if (distribution === 'custom') {
      const factors = [1, 0.9, 1.1, 0.85, 1.05, 0.95];
      return Math.max(minimumStep, Math.round((normalizedBase * factors[rowIndex % factors.length]) / minimumStep) * minimumStep);
    }

    return normalizedBase;
  }

  function formatShortDate(value) {
    const [, month, day] = String(value).split('-');
    return day && month ? `${day}/${month}` : value;
  }

  function isDayDisabledByType(day, dayType) {
    if (dayType === 'workdays') return day === 'T7' || day === 'CN';
    if (dayType === 'weekend') return !['T7', 'CN'].includes(day);
    return false;
  }

  function classifySelectedDays(days) {
    const sortedDays = [...days].sort((a, b) => allWeekDays.indexOf(a) - allWeekDays.indexOf(b));
    const key = sortedDays.join(',');
    if (key === allWeekDays.join(',')) return 'all';
    if (key === weekDays.join(',')) return 'workdays';
    if (key === 'T7,CN') return 'weekend';
    return 'custom';
  }

  function getVietnameseWeekday(date) {
    return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
  }

  function buildRepeatPreviewRows({
    start,
    end,
    selectedDays: days,
    doctors: selectedDoctorList,
    workStart: startTime,
    workEnd: endTime,
    selectedScheduleType: scheduleType,
    selectedDepartment: department,
    slotCount,
    exceptionDates: exclusions,
    existingSchedules = [],
    conflictEnabled = true,
    repeatFrequency: frequency,
    repeatEveryWeeks: everyWeeks,
    appliedDays = null,
    maxRows,
  }) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const emptyResult = { rows: [], totalCount: 0, validCount: 0, conflictCount: 0, excludedCount: 0 };
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return emptyResult;
    const selectedDaySet = new Set(days);
    if (!selectedDaySet.size) return emptyResult;
    const exclusionSet = new Set((exclusions || []).map((item) => item.value));
    const doctorsForPreview = selectedDoctorList.length ? selectedDoctorList : [{ id: 'preview', name: 'Chưa chọn bác sĩ', department }];
    const rows = [];
    const result = { totalCount: 0, validCount: 0, conflictCount: 0, excludedCount: 0 };

    function addPreviewDate(dateValue, day, excludedFromAppliedDay = false) {
      doctorsForPreview.forEach((doctor) => {
        const excluded = excludedFromAppliedDay || exclusionSet.has(dateValue);
        const conflict = !excluded && conflictEnabled
          ? findScheduleConflict({
              date: dateValue,
              doctor,
              startTime,
              endTime,
              existingSchedules,
            })
          : null;
        const status = excluded ? 'Loại trừ' : conflict ? 'Trùng lịch' : 'Hợp lệ';
        result.totalCount += 1;
        if (excluded) result.excludedCount += 1;
        else if (conflict) result.conflictCount += 1;
        else result.validCount += 1;

        if (rows.length < maxRows) {
          rows.push({
            date: formatDateDisplay(dateValue),
            day,
            doctor: doctor.name,
            department: doctor.department || department,
            time: `${startTime}-${endTime}`,
            slots: slotCount,
            status,
            check: excluded
              ? 'Ngày loại trừ'
              : conflict
                ? `${conflict.start}-${conflict.end} · ${conflict.scheduleType || conflict.status || 'Đã có lịch'}`
                : 'Không xung đột',
          });
        }
      });
    }

    if (Array.isArray(appliedDays)) {
      appliedDays.forEach((item) => addPreviewDate(item.dateValue, item.day, item.isExcluded));
    } else {
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        const day = getVietnameseWeekday(cursor);
        const dateValue = cursor.toISOString().slice(0, 10);
        if (selectedDaySet.has(day) && isDateIncludedByRepeatCycle(cursor, startDate, frequency, everyWeeks)) {
          addPreviewDate(dateValue, day);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return { rows, ...result };
  }

  function isDateIncludedByRepeatCycle(date, startDate, frequency, everyWeeks) {
    if (frequency !== 'Hàng tuần') return true;
    const interval = Math.max(1, Number(everyWeeks) || 1);
    const daysFromStart = Math.floor((date - startDate) / 86400000);
    const weeksFromStart = Math.floor(Math.max(0, daysFromStart) / 7);
    return weeksFromStart % interval === 0;
  }

  function buildConflictKey(doctorId, date, startTime, endTime) {
    return [doctorId, date, startTime, endTime].map((item) => String(item || '').replaceAll('|', '-')).join('|');
  }

  function findScheduleConflict({ date, doctor, startTime, endTime, existingSchedules }) {
    return findScheduleConflicts({ date, doctor, startTime, endTime, existingSchedules })[0] || null;
  }

  function findScheduleConflicts({ date, doctor, startTime, endTime, existingSchedules }) {
    const proposedRanges = splitClockRange(startTime, endTime);

    return (existingSchedules || [])
      .filter((schedule) => {
        if (['cancelled', 'completed'].includes(String(schedule.status || '').toLowerCase())) return false;
        const sameDoctor = String(schedule.doctorId || '') === String(doctor.id || '') || schedule.doctor === doctor.name;
        if (!sameDoctor || schedule.date !== date) return false;
        return timeRangesOverlap(startTime, endTime, schedule.start, schedule.end);
      })
      .map((schedule) => ({
        ...schedule,
        overlapMinutes: getEffectiveOverlapMinutes({
          workRanges: proposedRanges,
          compareRanges: splitClockRange(schedule.start, schedule.end),
        }),
      }))
      .sort((first, second) => parseClockMinutes(first.start) - parseClockMinutes(second.start));
  }

  function timeRangesOverlap(startA, endA, startB, endB) {
    const rangesA = splitClockRange(startA, endA);
    const rangesB = splitClockRange(startB, endB);
    return rangesA.some(([aStart, aEnd]) => rangesB.some(([bStart, bEnd]) => aStart < bEnd && bStart < aEnd));
  }

  function splitClockRange(startValue, endValue) {
    const startMinutes = parseClockMinutes(startValue);
    const endMinutes = parseClockMinutes(endValue);
    if (startMinutes === endMinutes) return [[0, 24 * 60]];
    if (endMinutes > startMinutes) return [[startMinutes, endMinutes]];
    return [[startMinutes, 24 * 60], [0, endMinutes]];
  }

  function parseClockMinutes(value) {
    const [hour, minute] = String(value || '').split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return 0;
    return hour * 60 + minute;
  }

  function getClockRangeMinutes(startValue, endValue) {
    const startMinutes = parseClockMinutes(startValue);
    const endMinutes = parseClockMinutes(endValue);
    if (endMinutes === startMinutes) return 24 * 60;
    return endMinutes > startMinutes ? endMinutes - startMinutes : (24 * 60 - startMinutes) + endMinutes;
  }

  function parseDurationMinutes(value) {
    const minutes = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
    return Number.isNaN(minutes) || minutes <= 0 ? 15 : minutes;
  }

  function parseCapacity(value) {
    const capacity = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
    return Number.isNaN(capacity) || capacity <= 0 ? 1 : capacity;
  }

  function formatCompactNumber(value) {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(value))) + 'đ';
  }

  function formatScheduleStatus(status) {
    const normalized = String(status || '').toLowerCase();
    const statusMap = {
      draft: 'Bản nháp',
      published: 'Đã công khai',
      active: 'Đang hoạt động',
      cancelled: 'Đã hủy',
      completed: 'Hoàn tất',
    };
    return statusMap[normalized] || status || 'Chưa rõ';
  }

  function getReplacementConflictSchedules() {
    const scheduleMap = new Map();

    allocationRows.forEach((row) => {
      row.cells.forEach((cell) => {
        if (cell.status !== 'resolved-new') return;
        (cell.conflicts || []).forEach((schedule) => {
          if (schedule?.id && !scheduleMap.has(schedule.id)) {
            scheduleMap.set(schedule.id, schedule);
          }
        });
      });
    });

    return Array.from(scheduleMap.values());
  }

  function getReplacementConflictsWithoutScheduleIds() {
    return allocationRows.flatMap((row) =>
      row.cells.flatMap((cell) =>
        cell.status === 'resolved-new'
          ? (cell.conflicts || []).filter((schedule) => !schedule?.id)
          : [],
      ),
    );
  }

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  function buildShiftSlotBreakdown({ totalSlots, workStart: startTime, workEnd: endTime, breaks }) {
    const workRanges = splitClockRange(startTime, endTime);
    const breakRanges = (breaks || []).flatMap((item) => splitClockRange(item.start, item.end));
    const shiftSegments = [
      { id: 'morning', label: 'Ca sáng', className: 'is-morning', ranges: [[360, 720]] },
      { id: 'afternoon', label: 'Ca chiều', className: 'is-afternoon', ranges: [[720, 1050]] },
      { id: 'extra', label: 'Ngoài giờ', className: 'is-extra', ranges: [[0, 360], [1050, 1440]] },
    ];
    const segmentMinutes = shiftSegments.map((segment) => getEffectiveShiftMinutes(workRanges, breakRanges, segment.ranges));
    const totalMinutes = segmentMinutes.reduce((total, minutes) => total + minutes, 0);
    let assignedSlots = 0;

    return shiftSegments.map((segment, index) => {
      const isLast = index === shiftSegments.length - 1;
      const slots = totalMinutes && totalSlots
        ? isLast
          ? Math.max(0, totalSlots - assignedSlots)
          : Math.round((totalSlots * segmentMinutes[index]) / totalMinutes)
        : 0;
      const startPercent = totalSlots ? clampPercent((assignedSlots / totalSlots) * 100) : 0;
      assignedSlots += slots;
      const percent = totalSlots ? clampPercent((slots / totalSlots) * 100) : 0;

      return {
        ...segment,
        slots,
        percent,
        endPercent: totalSlots ? clampPercent(((assignedSlots) / totalSlots) * 100) : 0,
        startPercent,
      };
    });
  }

  function getEffectiveShiftMinutes(workRanges, breakRanges, segmentRanges) {
    const scheduledMinutes = workRanges.reduce(
      (total, workRange) => total + segmentRanges.reduce(
        (segmentTotal, segmentRange) => segmentTotal + getRangeOverlapMinutes(workRange, segmentRange),
        0,
      ),
      0,
    );
    const blockedMinutes = breakRanges.reduce(
      (total, breakRange) => total + workRanges.reduce(
        (workTotal, workRange) => workTotal + segmentRanges.reduce(
          (segmentTotal, segmentRange) => segmentTotal + getTripleRangeOverlapMinutes(workRange, breakRange, segmentRange),
          0,
        ),
        0,
      ),
      0,
    );

    return Math.max(0, scheduledMinutes - blockedMinutes);
  }

  function getEffectiveOverlapMinutes({ workRanges, compareRanges }) {
    return workRanges.reduce(
      (total, workRange) => total + compareRanges.reduce(
        (rangeTotal, compareRange) => rangeTotal + getRangeOverlapMinutes(workRange, compareRange),
        0,
      ),
      0,
    );
  }

  function getRangeOverlapMinutes([startA, endA], [startB, endB]) {
    return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
  }

  function getTripleRangeOverlapMinutes([startA, endA], [startB, endB], [startC, endC]) {
    return Math.max(0, Math.min(endA, endB, endC) - Math.max(startA, startB, startC));
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

  function makeValidationIssue(id, title, message, targetId, step, tone = 'danger') {
    return { id, title, message, targetId, step, tone };
  }

  function notifyBulkCreateIssues(issues) {
    if (!issues.length) return;

    const runId = Date.now();
    const issueCount = issues.length;
    const issueTone = issues.some((issue) => issue.tone === 'danger') ? 'danger' : 'warning';
    const issueLimit = 5;

    issues.slice(0, issueLimit).forEach((issue, index) => {
      emitSchedulingNotification({
        id: `bulk-create-issue-${runId}-${index}-${issue.id}`,
        title: issue.title,
        body: `${issue.message} Bấm để tới bước ${issue.step}.`,
        tone: issue.tone || 'danger',
        to: '/scheduling/bulk-create',
        focusTarget: issue,
      });
    });

    emitSchedulingNotification({
      id: `bulk-create-validation-${runId}`,
      title: 'Chưa thể tạo lịch',
      body: issueCount > issueLimit
        ? `${issueCount} lỗi cần sửa, đã đưa ${issueLimit} lỗi đầu vào thông báo. Bấm thông báo lỗi để tới đúng phần.`
        : `${issueCount} lỗi cần sửa. Bấm từng thông báo lỗi để tới đúng phần rồi tạo lại.`,
      tone: issueTone,
      to: '/scheduling/bulk-create',
      openMenu: true,
      focusTarget: issues[0],
    });
  }

  function notifyBulkCreateSuccess(createdCount, scheduleIds, conflictEffect = {}) {
    const cancelledConflictCount = Number(conflictEffect.cancelled || 0);
    const updatedConflictCount = Number(conflictEffect.updated || 0);
    const conflictMessage = [
      cancelledConflictCount ? `Đã hủy ${formatCompactNumber(cancelledConflictCount)} lịch hiện tại bị thay thế.` : '',
      updatedConflictCount ? `Đã cập nhật ${formatCompactNumber(updatedConflictCount)} lịch trùng cùng khung giờ thành bản nháp.` : '',
    ].filter(Boolean).join(' ');

    emitSchedulingNotification({
      id: `bulk-create-success-${Date.now()}`,
      title: 'Đã tạo lịch nháp hàng loạt',
      body: `Đã lưu ${formatCompactNumber(createdCount)} lịch ở trạng thái Bản nháp.${conflictMessage ? ` ${conflictMessage}` : ''} ${scheduleIds.length ? `${formatCompactNumber(scheduleIds.length)} mã lịch đã được máy chủ trả về.` : 'Mở danh sách lịch để rà soát và công khai sau.'}`,
      tone: 'success',
      to: '/scheduling/schedules',
      openMenu: true,
    });
  }

  function resolveDoctorDepartmentId(doctor) {
    if (doctor?.departmentId) return doctor.departmentId;

    const matchedDepartment = databaseDepartments.find((department) => department.name === doctor?.department);
    if (matchedDepartment?.id) return matchedDepartment.id;

    if (doctor?.department === selectedDepartment && selectedDepartmentRecord?.id) {
      return selectedDepartmentRecord.id;
    }

    return '';
  }

  function buildBulkDateTime(dateValue, timeValue) {
    return new Date(`${dateValue}T${timeValue}:00`).toISOString();
  }

  function buildBulkBreakWindows() {
    const windows = [];

    if (isBreakEnabled && breakStart && breakEnd) {
      windows.push({ start: breakStart, end: breakEnd, mode: 'Nghỉ giữa giờ' });
    }

    extraBreaks.forEach((item, index) => {
      if (item.start && item.end) {
        windows.push({
          start: item.start,
          end: item.end,
          mode: item.mode || `Nghỉ bổ sung ${index + 1}`,
        });
      }
    });

    return windows;
  }

  function buildBulkCreatePayloadItems() {
    const durationMinutes = parseDurationMinutes(slotDuration);
    const maxPatients = parseCapacity(slotCapacity);
    const breakWindows = buildBulkBreakWindows();

    return allocationRows.flatMap((row) =>
      row.cells
        .map((cell, dayIndex) => {
          const day = allocationPreviewDays[dayIndex];
          if (!day || !['scheduled', 'resolved-new'].includes(cell.status)) {
            return null;
          }

          const replaceConflictScheduleIds = cell.status === 'resolved-new'
            ? (cell.conflicts || []).map((schedule) => schedule?.id).filter(Boolean)
            : [];

          return {
            doctor_id: row.doctor.id,
            department_id: resolveDoctorDepartmentId(row.doctor),
            work_date: day.dateValue,
            shift_start: buildBulkDateTime(day.dateValue, workStart),
            shift_end: buildBulkDateTime(day.dateValue, workEnd),
            slot_duration_minutes: durationMinutes,
            max_patients: maxPatients,
            schedule_type: normalizeScheduleType(selectedScheduleType),
            patient_portal_enabled: selectedScheduleTypeMeta.patientPortalEnabled !== false,
            staff_only: selectedScheduleTypeMeta.staffOnly === true,
            return_visit_priority: selectedScheduleTypeMeta.returnVisitPriority === true,
            early_booking_enabled: true,
            internal_note: `Tạo hàng loạt từ màn phân bổ: ${selectedMethodInfo.title} · ${scheduleRuleLabel} · ${selectedTemplateInfo.title}.`,
            break_windows: breakWindows,
            status: 'draft',
            ...(replaceConflictScheduleIds.length ? { replace_conflict_schedule_ids: replaceConflictScheduleIds } : {}),
          };
        })
        .filter(Boolean),
    );
  }

  function buildBulkScheduleValidationIssues() {
    const issues = [];
    const selectedDoctorIds = new Set(databaseDoctors.map((doctor) => String(doctor.id)));
    const syntheticDoctors = selectedAllocationDoctors.filter((doctor) => !selectedDoctorIds.has(String(doctor.id)));
    const missingDepartmentDoctors = selectedAllocationDoctors.filter((doctor) => !resolveDoctorDepartmentId(doctor));
    const workStartMinutes = parseClockMinutes(workStart);
    const workEndMinutes = parseClockMinutes(workEnd);
    const durationMinutes = parseDurationMinutes(slotDuration);
    const maxPatients = parseCapacity(slotCapacity);
    const invalidBreaks = buildBulkBreakWindows().filter((item) => {
      const startMinutes = parseClockMinutes(item.start);
      const endMinutes = parseClockMinutes(item.end);
      return endMinutes <= startMinutes
        || startMinutes < workStartMinutes
        || endMinutes > workEndMinutes;
    });
    const replacementSchedules = getReplacementConflictSchedules();
    const replacementWithoutIds = getReplacementConflictsWithoutScheduleIds();
    const replacementWithBookedSlots = replacementSchedules.filter((schedule) => Number(schedule.bookedSlots || 0) > 0);

    if (!backendConnected || !createResourcesLoaded || !actions?.bulkCreateSchedules) {
      issues.push(makeValidationIssue(
        'resource-sync',
        'Chưa sẵn sàng tạo lịch trên database',
        'Cần đồng bộ được danh sách bác sĩ và khoa từ backend trước khi lưu lịch thật. Kiểm tra backend, đăng nhập và tải lại dữ liệu.',
        'bulk-step-basic',
        1,
      ));
    }

    if (!selectedAllocationDoctors.length) {
      issues.push(makeValidationIssue(
        'doctor-empty',
        'Chưa chọn bác sĩ',
        'Chọn ít nhất một bác sĩ có trong dữ liệu hệ thống để tạo lịch.',
        'bulk-step-basic',
        1,
      ));
    }

    if (syntheticDoctors.length) {
      issues.push(makeValidationIssue(
        'doctor-source',
        'Có bác sĩ chưa khớp database',
        `${syntheticDoctors.slice(0, 3).map((doctor) => doctor.name).join(', ')}${syntheticDoctors.length > 3 ? ` +${syntheticDoctors.length - 3}` : ''} là dữ liệu hiển thị hoặc chưa có trong danh sách backend. Gỡ các bác sĩ này hoặc chọn bác sĩ từ dữ liệu hệ thống.`,
        'bulk-step-basic',
        1,
      ));
    }

    if (missingDepartmentDoctors.length) {
      issues.push(makeValidationIssue(
        'department-source',
        'Có bác sĩ chưa có mã khoa database',
        `${missingDepartmentDoctors.slice(0, 3).map((doctor) => doctor.name).join(', ')}${missingDepartmentDoctors.length > 3 ? ` +${missingDepartmentDoctors.length - 3}` : ''} chưa có department_id hoặc khoa chưa khớp dữ liệu backend. Chọn bác sĩ từ dữ liệu hệ thống hoặc đồng bộ lại danh sách khoa.`,
        'bulk-step-basic',
        1,
      ));
    }

    const invalidDateRange = !dateRange.start
      || !dateRange.end
      || new Date(dateRange.start) > new Date(dateRange.end)
      || (selectedRepeatEnd === 'date' && new Date(dateRange.start) > new Date(repeatEndDate));

    if (invalidDateRange) {
      issues.push(makeValidationIssue(
        'date-range',
        'Khoảng thời gian áp dụng chưa hợp lệ',
        'Kiểm tra ngày bắt đầu, ngày kết thúc và ngày kết thúc lặp để bảo đảm ngày đầu nhỏ hơn hoặc bằng ngày cuối.',
        'bulk-step-basic',
        1,
      ));
    }

    if (isRangeMethod && !isDateWithinRange(rangeRepeatStart, dateRange.start, effectiveScheduleEndDate)) {
      issues.push(makeValidationIssue(
        'range-repeat-start',
        'Ngày bắt đầu khoảng lặp chưa nằm trong khoảng áp dụng',
        'Ngày bắt đầu lặp theo khoảng phải nằm trong khoảng ngày áp dụng để hệ thống tạo đúng chuỗi lịch.',
        'bulk-step-advanced',
        3,
      ));
    }

    if (isDateRangeMethod && (!Number.isFinite(Number(dateRangeEveryDays)) || Number(dateRangeEveryDays) < 1)) {
      issues.push(makeValidationIssue(
        'date-range-step',
        'Chu kỳ dải ngày chưa hợp lệ',
        'Số ngày lặp trong dải ngày phải lớn hơn hoặc bằng 1 để hệ thống tính đúng ngày tạo lịch.',
        'bulk-step-advanced',
        3,
      ));
    }

    if (!allocationAppliedDayCount || !allocationPreviewDays.length) {
      issues.push(makeValidationIssue(
        'applied-days',
        'Không có ngày áp dụng',
        isRangeMethod
          ? 'Điều chỉnh khoảng ngày, ngày bắt đầu lặp hoặc chu kỳ mỗi N ngày để còn ngày tạo lịch.'
          : 'Chọn ít nhất một thứ trong tuần hoặc điều chỉnh ngày loại trừ để còn ngày tạo lịch.',
        'bulk-step-advanced',
        3,
      ));
    }

    if (workEndMinutes <= workStartMinutes) {
      issues.push(makeValidationIssue(
        'work-time',
        'Khung giờ làm việc chưa hợp lệ',
        'Giờ kết thúc phải lớn hơn giờ bắt đầu trong cùng ngày để backend tạo lịch chính xác.',
        'bulk-step-work',
        2,
      ));
    }

    if (durationMinutes < 5 || durationMinutes > 240) {
      issues.push(makeValidationIssue(
        'slot-duration',
        'Thời lượng slot ngoài giới hạn',
        'Thời lượng mỗi slot phải nằm trong khoảng 5 đến 240 phút.',
        'bulk-step-work',
        2,
      ));
    }

    if (maxPatients < 1) {
      issues.push(makeValidationIssue(
        'slot-capacity',
        'Số bệnh nhân mỗi slot chưa hợp lệ',
        'Số bệnh nhân tối đa mỗi slot phải lớn hơn 0.',
        'bulk-step-work',
        2,
      ));
    }

    if (!hasValidWorkRange || projectedSlotsPerDoctorDay <= 0 || displayedPreviewSlots <= 0) {
      issues.push(makeValidationIssue(
        'no-slots',
        'Bảng phân bổ chưa tạo được slot',
        'Tăng khung giờ làm việc, giảm thời lượng slot hoặc kiểm tra các khoảng nghỉ để còn slot hợp lệ.',
        'bulk-step-work',
        2,
      ));
    }

    if (!isBreakInsideWork || invalidBreaks.length) {
      issues.push(makeValidationIssue(
        'break-window',
        'Khoảng nghỉ chưa nằm trong ca làm việc',
        'Mọi khoảng nghỉ phải có giờ bắt đầu nhỏ hơn giờ kết thúc và nằm trọn trong khung giờ làm việc.',
        'bulk-step-work',
        2,
        'warning',
      ));
    }

    if (allocationConflictCount) {
      issues.push(makeValidationIssue(
        'conflicts',
        'Còn xung đột lịch',
        `${allocationConflictCount} ô lịch đang trùng lịch hiện tại. Bấm từng ô trùng để chọn giữ lịch cũ hoặc thay bằng lịch nháp mới.`,
        'bulk-step-preview',
        4,
      ));
    }

    if (replacementWithBookedSlots.length) {
      issues.push(makeValidationIssue(
        'conflict-booked-existing',
        'Lịch hiện tại đã có hẹn',
        `${replacementWithBookedSlots.length} lịch được chọn thay thế đang có appointment. Không thể hủy hoặc cập nhật trực tiếp trên database; hãy giữ lịch hiện tại hoặc xử lý dời/hủy appointment trước.`,
        'bulk-step-preview',
        4,
      ));
    }

    if (replacementWithoutIds.length) {
      issues.push(makeValidationIssue(
        'conflict-missing-id',
        'Thiếu mã lịch cần xử lý',
        'Một số lịch hiện tại đang trùng chưa có mã database nên không thể hủy hoặc cập nhật an toàn trước khi tạo lịch mới.',
        'bulk-step-preview',
        4,
      ));
    }

    return issues;
  }

  function focusValidationIssue(issue) {
    if (!issue) return;

    setActiveStep(issue.step || 1);
    setActiveCommandPanel('');
    if (issue.targetId === 'bulk-step-basic') {
      setIsBasicDetailOpen(true);
      if (issue.id?.includes('doctor')) setOpenFieldMenu('doctors');
      else if (issue.id?.includes('department')) setOpenFieldMenu('department');
      else if (issue.id?.includes('date')) setOpenFieldMenu('dateRange');
      else setOpenFieldMenu('');
    }
    if (issue.targetId === 'bulk-step-work') {
      setIsBasicDetailOpen(false);
      if (issue.id === 'work-time') setOpenFieldMenu('workEnd');
      else if (issue.id === 'slot-duration') setOpenFieldMenu('slotDuration');
      else if (issue.id === 'slot-capacity') setOpenFieldMenu('slotCapacity');
      else if (issue.id === 'break-window') setOpenFieldMenu('breakStart');
      else setOpenFieldMenu('');
    }
    if (issue.targetId === 'bulk-step-advanced') {
      setSelectedAdvancedTab('repeat');
    }
    if (issue.targetId === 'bulk-step-preview') {
      setIsPreviewDetailOpen(true);
      setIsAlertDetailOpen(true);
      if (issue.id === 'conflicts' && nextConflictToReview?.cell?.conflictKey) {
        setActiveConflictKey(nextConflictToReview.cell.conflictKey);
      }
    }
    setQuickActionFeedback(issue.message);
    scrollToSection(issue.targetId || 'bulk-step-basic');
  }

  async function handleCreateBulkSchedules() {
    if (isCreatingSchedules) return;

    setActiveStep(4);
    setIsPreviewDetailOpen(true);

    const issues = buildBulkScheduleValidationIssues();
    setValidationIssues(issues);

    if (issues.length) {
      setActionMessage('');
      setQuickActionFeedback('Chưa thể tạo lịch. Mở thông báo và bấm từng lỗi để đi tới phần cần sửa.');
      notifyBulkCreateIssues(issues);
      return;
    }

    const items = buildBulkCreatePayloadItems();
    if (!items.length) {
      if (allocationResolvedConflictCount && !allocationConflictCount) {
        emitSchedulingNotification({
          id: `bulk-create-noop-${Date.now()}`,
          title: 'Không có lịch nháp mới cần tạo',
          body: 'Các xung đột đã được xử lý bằng cách giữ lịch hiện tại, nên hệ thống không gửi lịch mới lên database.',
          tone: 'info',
          to: '/scheduling/bulk-create',
          openMenu: true,
        });
        setQuickActionFeedback('Không có lịch nháp mới cần tạo vì bạn đã chọn giữ lịch hiện tại ở các ô trùng.');
        return;
      }

      const emptyIssue = makeValidationIssue(
        'payload-empty',
        'Không có lịch hợp lệ để gửi',
        'Bảng phân bổ không có ô lịch hợp lệ. Kiểm tra lại ngày áp dụng, xung đột và bác sĩ đã chọn.',
        'bulk-step-preview',
        4,
      );
      setValidationIssues([emptyIssue]);
      setActionMessage('');
      setQuickActionFeedback('Chưa thể tạo lịch. Mở thông báo lỗi để đi tới phần cần sửa.');
      notifyBulkCreateIssues([emptyIssue]);
      return;
    }

    setIsCreatingSchedules(true);
    setQuickActionFeedback(`Đang gửi ${items.length} lịch lên hệ thống...`);

    try {
      const schedulesToReplace = getReplacementConflictSchedules();
      const replaceScheduleIds = schedulesToReplace.map((schedule) => schedule.id).filter(Boolean);
      const result = await actions.bulkCreateSchedules({
        items,
        conflict_resolution: {
          mode: 'replace_selected',
          replace_schedule_ids: replaceScheduleIds,
          keep_existing_count: allocationResolvedConflictCount - replaceScheduleIds.length,
        },
      });
      const createdCount = Number(result?.created_count || result?.items?.length || items.length);
      const conflictEffect = {
        cancelled: Number(result?.cancelled_conflict_count || 0),
        updated: Number(result?.updated_conflict_count || 0),
      };
      const scheduleIds = (result?.items || [])
        .map((item) => item?.notification?.schedule_id || item?.doctor_schedule_id || item?.schedule_id)
        .filter(Boolean);

      setValidationIssues([]);
      setActiveCommandPanel('');
      setActionMessage('');
      setQuickActionFeedback('Lịch nháp đã được lưu vào hệ thống. Mở thông báo hoặc danh sách lịch để kiểm tra tiếp.');
      notifyBulkCreateSuccess(createdCount, scheduleIds, conflictEffect);
    } catch (createError) {
      const message = createError?.message || 'Máy chủ từ chối tạo lịch. Vui lòng kiểm tra lại dữ liệu và thử lại.';
      const serverIssue = makeValidationIssue(
        'server-create',
        'Tạo lịch không thành công',
        `${message} Kiểm tra phần được đánh dấu rồi bấm tạo lại.`,
        'bulk-step-preview',
        4,
      );
      setValidationIssues([serverIssue]);
      setActionMessage('');
      setQuickActionFeedback('Tạo lịch không thành công. Mở thông báo lỗi để kiểm tra lại dữ liệu.');
      notifyBulkCreateIssues([serverIssue]);
    } finally {
      setIsCreatingSchedules(false);
    }
  }

  function handleContinue() {
    handleCreateBulkSchedules();
  }

  function renderCreateActionIcon(size = 16, strokeWidth = 2.6) {
    return isCreatingSchedules
      ? <LoaderCircle className="scheduling-bulk-create-spin" size={size} strokeWidth={strokeWidth} aria-hidden="true" />
      : <Check size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
  }

  function renderCreateActionCopy() {
    return isCreatingSchedules ? 'Đang tạo lịch...' : 'Tạo lịch hàng loạt';
  }

  function renderCreateActionHint() {
    if (isCreatingSchedules) return 'Đang gửi dữ liệu lên hệ thống';
    if (validationIssues.length) return 'Mở thông báo lỗi để sửa rồi tạo lại';
    return 'Kiểm tra lỗi rồi lưu nháp nếu hợp lệ';
  }

  function openPreviewOnly() {
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
          <button type="button" className="is-primary" onClick={handleContinue} disabled={isCreatingSchedules}>
            {renderCreateActionIcon(16, 2.55)}
            {renderCreateActionCopy()}
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
            {(isAiMethod ? aiQuickSteps : bulkSteps).map(([number, title, copy], index) => {
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
            <div className="scheduling-ai-quick-shell">
              <section
                className="scheduling-ai-flow-panel"
                style={{ '--ai-quick-progress': `${aiQuickProgress}%` }}
                aria-label="Tiến trình tạo lịch với AI"
              >
                <div className="scheduling-ai-flow-hero">
                  <span className="scheduling-ai-flow-hero__icon" aria-hidden="true">
                    <Sparkles size={36} strokeWidth={2.2} />
                  </span>
                  <div>
                    <h2>Tiến trình tạo lịch với AI</h2>
                    <p>AI tối ưu lịch làm việc thông minh, chính xác và công bằng</p>
                  </div>
                  <div className="scheduling-ai-flow-confidence">
                    <ShieldCheck size={20} strokeWidth={2.35} aria-hidden="true" />
                    <span>Độ tin cậy</span>
                    <strong>96%</strong>
                  </div>
                </div>

                <div className="scheduling-ai-flow-track">
                  {aiProcessingStepRows.map((step, index) => {
                    const stepStatus = getAiProcessingStepStatus(index);

                    return (
                      <article key={step.title} className={`is-${stepStatus}`}>
                        {stepStatus === 'active' ? <em>Đang xử lý</em> : null}
                        <span aria-hidden="true">
                          {stepStatus === 'done' ? <CircleCheck size={31} strokeWidth={2.8} /> : index + 1}
                        </span>
                        <strong>{step.title}</strong>
                        <small>{stepStatus === 'active' ? 'Đang xử lý' : step.copy}</small>
                      </article>
                    );
                  })}
                </div>

                <div className="scheduling-ai-flow-footer">
                  <div className="scheduling-ai-flow-status">
                    <span aria-hidden="true"><Sparkles size={30} strokeWidth={2.25} /></span>
                    <p><i />AI đang kiểm tra xung đột giữa bác sĩ, phòng khám và khung giờ...</p>
                    <article>
                      <Clock3 size={24} strokeWidth={2.35} aria-hidden="true" />
                      <small>Ước tính còn lại</small>
                      <strong>00:28</strong>
                    </article>
                    <article className="is-danger">
                      <AlertTriangle size={26} strokeWidth={2.35} aria-hidden="true" />
                      <small>Xung đột phát hiện</small>
                      <strong>14</strong>
                    </article>
                    <div className="scheduling-ai-flow-percent">
                      <strong>{aiQuickProgress}%</strong>
                      <span>Tiến độ tổng thể</span>
                      <svg viewBox="0 0 100 36" aria-hidden="true">
                        <path d="M4 24 C18 8 30 34 44 18 S70 28 84 10 S96 16 100 4" />
                      </svg>
                    </div>
                  </div>

                  <div className="scheduling-ai-flow-progress">
                    <i><b /></i>
                  </div>

                  <div className="scheduling-ai-flow-live">
                    <span><CircleCheck size={18} strokeWidth={2.6} aria-hidden="true" />Đã đọc dữ liệu <time>10:12</time></span>
                    <span><CircleCheck size={18} strokeWidth={2.6} aria-hidden="true" />Đã phân tích 24 ràng buộc <time>10:13</time></span>
                    <span><LoaderCircle size={18} strokeWidth={2.6} aria-hidden="true" />Đang kiểm tra 126 slot <em>LIVE</em></span>
                  </div>
                </div>
              </section>
              <div className="scheduling-ai-quick-workspace">
                <div className="scheduling-ai-quick-left">
                  <aside className="scheduling-ai-copilot-context" aria-label="Ràng buộc AI đã nhận">
                    <section>
                      <h3><ClipboardCheck size={16} strokeWidth={2.45} aria-hidden="true" />Ràng buộc đã nhận</h3>
                      <div className="scheduling-ai-copilot-checks">
                        {[
                          'Khoa: Nhi',
                          'Thời gian: 01/05 - 31/05/2025',
                          'Ưu tiên bác sĩ chính buổi sáng',
                          'Tránh trùng lịch khám',
                          'Mỗi bác sĩ tối đa 2 ca/ngày',
                        ].map((item) => (
                          <span key={item}><CircleCheck size={13} strokeWidth={2.45} aria-hidden="true" />{item}</span>
                        ))}
                      </div>
                    </section>

                    <section className="scheduling-ai-copilot-understanding">
                      <div>
                        <h3><Sparkles size={15} strokeWidth={2.45} aria-hidden="true" />Yêu cầu đã hiểu</h3>
                        <strong>96%</strong>
                      </div>
                      <small>Độ tin cậy hiểu yêu cầu</small>
                      <i><b /></i>
                    </section>

                    <section>
                      <h3>Thực thể trích xuất</h3>
                      <dl className="scheduling-ai-copilot-entities">
                        {[
                          ['Khoa', 'Nhi'],
                          ['Thời gian', '01/05 - 31/05'],
                          ['Ưu tiên', 'Bác sĩ chính buổi sáng'],
                          ['Giới hạn', 'Tối đa 2 ca/ngày/bác sĩ'],
                          ['Mục tiêu', 'Tối ưu, không xung đột'],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>

                    <section>
                      <h3>Trạng thái</h3>
                      <div className="scheduling-ai-copilot-validity">
                        <span><CircleCheck size={12} strokeWidth={2.45} aria-hidden="true" />Hợp lệ</span>
                        <strong>5/5</strong>
                      </div>
                    </section>

                    <footer>
                      <span><Sparkles size={13} strokeWidth={2.45} aria-hidden="true" />AI Model: HospitalGPT 4.0</span>
                      <strong><i />Cập nhật: 09:33:24</strong>
                    </footer>
                  </aside>

                  <section className="scheduling-ai-copilot-chat" aria-label="Trò chuyện với AI tạo lịch">
                    <header className="scheduling-ai-copilot-chat-header">
                      <span aria-hidden="true"><Sparkles size={20} strokeWidth={2.45} /></span>
                      <div>
                        <strong>Trợ lý AI - Đặt lịch khám Copilot</strong>
                        <small>AI hiểu yêu cầu, ràng buộc và đề xuất lịch tối ưu cho khoa, không trùng lặp, cân bằng tải.</small>
                      </div>
                      <button type="button" onClick={() => setActionMessage(`Đang có ${aiSessionLog.length} phiên hội thoại AI gần nhất.`)}>
                        <Clock3 size={14} strokeWidth={2.35} aria-hidden="true" />
                        Lịch sử hội thoại
                      </button>
                      <button type="button" aria-label="Mở tùy chọn hội thoại AI" onClick={() => setActionMessage('Đã mở tùy chọn hội thoại AI.')}>
                        <MoreVertical size={16} strokeWidth={2.35} aria-hidden="true" />
                      </button>
                    </header>

                    <div className="scheduling-ai-copilot-thread" ref={aiChatListRef} aria-live="polite">
                      <article className="scheduling-ai-copilot-message is-admin">
                        <img src={doctorAvatarMap['dr-minh']} alt="" />
                        <div>
                          <strong>Admin</strong>
                          <p>Tạo lịch khoa Nhi từ 01/05-31/05, ưu tiên bác sĩ chính buổi sáng và tránh trùng lịch khám. Mỗi bác sĩ tối đa 2 ca/ngày.</p>
                          <time>09:30</time>
                        </div>
                      </article>

                      <article className="scheduling-ai-copilot-message is-ai">
                        <span aria-hidden="true"><Bot size={18} strokeWidth={2.45} /></span>
                        <div>
                          <strong>AI Assistant</strong>
                          <p>Đã ghi nhận yêu cầu. Tôi sẽ tạo lịch khoa Nhi theo các ràng buộc: 01/05-31/05, ưu tiên bác sĩ chính buổi sáng, tránh trùng lịch, tối đa 2 ca/ngày/bác sĩ. Vui lòng chờ trong giây lát.</p>
                          <time>09:31</time>
                        </div>
                      </article>

                      <article className="scheduling-ai-copilot-message is-ai is-result">
                        <span aria-hidden="true"><Bot size={18} strokeWidth={2.45} /></span>
                        <div>
                          <strong>AI Assistant</strong>
                          <time>09:33</time>
                          <p>Đã tạo lịch dự thảo thành công. Dưới đây là tóm tắt:</p>

                          <div className="scheduling-ai-copilot-result">
                            <section className="scheduling-ai-copilot-overview">
                              <header>Tổng quan</header>
                              <div>
                                {[
                                  ['56', 'Tổng ca'],
                                  ['18', 'Bác sĩ'],
                                  ['3', 'Khoa/đơn vị'],
                                  ['0', 'Xung đột'],
                                ].map(([value, label]) => (
                                  <article key={label}>
                                    <strong>{value}</strong>
                                    <small>{label}</small>
                                  </article>
                                ))}
                              </div>
                            </section>

                            <section className="scheduling-ai-copilot-score">
                              <header>Điểm tối ưu</header>
                              <strong>96%</strong>
                              <span><CircleCheck size={12} strokeWidth={2.45} aria-hidden="true" />Rất tốt</span>
                              <svg viewBox="0 0 120 44" aria-hidden="true">
                                <defs>
                                  <marker id="ai-score-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L8,4 L0,8 Z" />
                                  </marker>
                                </defs>
                                <polyline points="4,34 22,24 38,30 54,18 70,22 86,10 104,12 114,6" markerEnd="url(#ai-score-arrow)" />
                              </svg>
                            </section>
                          </div>

                          <div className="scheduling-ai-copilot-tags">
                            <strong>Ràng buộc đã đáp ứng</strong>
                            {[
                              'Không xung đột lịch',
                              'Ưu tiên bác sĩ chính buổi sáng',
                              'Mỗi bác sĩ tối đa 2 ca/ngày',
                              'Cân bằng tải hợp lý',
                              'Đủ nhân lực theo khung giờ',
                            ].map((item) => (
                              <span key={item}><Check size={12} strokeWidth={2.5} aria-hidden="true" />{item}</span>
                            ))}
                          </div>

                          <div className="scheduling-ai-copilot-next">
                            <p>Gợi ý tiếp theo<br />Bạn có muốn xem lịch chi tiết, so sánh phương án khác hoặc điều chỉnh ràng buộc không?</p>
                            <div>
                              <button type="button" onClick={() => setIsPreviewDetailOpen(true)}><CalendarDays size={14} strokeWidth={2.4} aria-hidden="true" />Xem lịch đề xuất</button>
                              <button type="button" onClick={() => setActionMessage('Đã mở bảng điều chỉnh ràng buộc AI.')}><SlidersHorizontal size={14} strokeWidth={2.4} aria-hidden="true" />Điều chỉnh ràng buộc</button>
                              <button type="button" onClick={() => setActionMessage('Đang so sánh phương án lịch AI.')}><ShieldCheck size={14} strokeWidth={2.4} aria-hidden="true" />So sánh phương án</button>
                              <button type="button" onClick={() => submitAiChat(undefined, 'Tối ưu lại lịch khoa Nhi')}><Sparkles size={14} strokeWidth={2.4} aria-hidden="true" />Tối ưu lại</button>
                            </div>
                          </div>
                        </div>
                      </article>
                    </div>

                    <div className="scheduling-ai-copilot-chipbar">
                      {['Thêm ràng buộc nghỉ lễ', 'Ưu tiên bác sĩ A buổi chiều', 'Tăng ca tối (17h-20h)', 'So sánh 2 phương án', 'Mẫu câu lệnh'].map((item) => (
                        <button key={item} type="button" onClick={() => submitAiChat(undefined, item)}>{item}</button>
                      ))}
                    </div>

                    <form className="scheduling-ai-copilot-composer" onSubmit={submitAiChat}>
                      <textarea
                        value={aiChatInput}
                        onChange={(event) => setAiChatInput(event.target.value)}
                        placeholder="Mô tả yêu cầu tạo lịch, ràng buộc, ưu tiên, khung giờ..."
                        aria-label="Mô tả yêu cầu tạo lịch cho AI"
                        rows={3}
                      />
                      <div>
                        <button type="button" onClick={() => setActionMessage('Đang chờ đính kèm tệp cho AI.')}><ClipboardList size={14} strokeWidth={2.35} aria-hidden="true" />Đính kèm</button>
                        <button type="button" aria-label="Ghi âm yêu cầu" onClick={handleAiVoiceFill}><Mic size={15} strokeWidth={2.35} aria-hidden="true" /></button>
                        <button type="button" onClick={() => setActionMessage('Đã chèn ngày 01/05 - 31/05/2025 vào yêu cầu.')}><CalendarDays size={14} strokeWidth={2.35} aria-hidden="true" />Chèn ngày</button>
                        <button type="button" onClick={() => setActionMessage('Đã mở thư viện mẫu câu lệnh AI.')}><SlidersHorizontal size={14} strokeWidth={2.35} aria-hidden="true" />Mẫu</button>
                        <button type="submit" aria-label="Gửi yêu cầu AI"><SendHorizontal size={20} strokeWidth={2.55} aria-hidden="true" /></button>
                      </div>
                    </form>

                    <footer className="scheduling-ai-copilot-footer">
                      <span>Gợi ý: Tạo lịch khoa Nhi từ 01/05-31/05</span>
                      <button type="button" onClick={() => submitAiChat(undefined, 'Tạo lại lịch khoa Nhi')}>
                        <CalendarPlus size={14} strokeWidth={2.35} aria-hidden="true" />
                        Tạo lại
                      </button>
                      <button type="button" onClick={() => submitAiChat(undefined, 'Tối ưu lại lịch khoa Nhi')}>
                        <Sparkles size={14} strokeWidth={2.35} aria-hidden="true" />
                        Tối ưu lại
                      </button>
                      <button type="button" onClick={() => exportPreviewFile()}>
                        <Download size={14} strokeWidth={2.35} aria-hidden="true" />
                        Xuất preview PDF
                      </button>
                      <strong><CircleCheck size={13} strokeWidth={2.45} aria-hidden="true" />AI đang hoạt động tốt</strong>
                    </footer>
                  </section>
                </div>

                <div className="scheduling-ai-quick-center">
                  <section
                    className="scheduling-ai-quick-processing"
                    style={{ '--ai-quick-progress': `${aiQuickProgress}%` }}
                  >
                    <div className="scheduling-ai-quick-card-title">
                      <WandSparkles size={16} strokeWidth={2.45} aria-hidden="true" />
                      <strong>AI đang xử lý & tối ưu lịch</strong>
                    </div>

                    <div className="scheduling-ai-quick-process-steps">
                      {aiProcessingStepRows.map((step, index) => {
                        const StepIcon = step.icon;
                        const stepStatus = getAiProcessingStepStatus(index);
                        const StatusIcon = stepStatus === 'active' ? LoaderCircle : stepStatus === 'done' ? CircleCheck : Clock3;

                        return (
                          <article key={step.title} className={`is-${stepStatus}`}>
                            <span aria-hidden="true"><StatusIcon size={18} strokeWidth={2.55} /></span>
                            <strong>{step.title}</strong>
                            <small>{stepStatus === 'active' ? 'Đang xử lý...' : stepStatus === 'done' ? step.copy : 'Chờ xử lý'}</small>
                            <em aria-hidden="true"><StepIcon size={14} strokeWidth={2.3} /></em>
                          </article>
                        );
                      })}
                    </div>

                    <div className="scheduling-ai-quick-brain" aria-hidden="true">
                      <Brain size={80} strokeWidth={1.8} />
                    </div>

                    <strong className="scheduling-ai-quick-processing-copy">Đang tối ưu phương án lịch từ ý tưởng người tạo...</strong>
                    <div className="scheduling-ai-quick-progress">
                      <i><b /></i>
                      <span>{aiQuickProgress}%</span>
                    </div>
                  </section>

                  <section className="scheduling-ai-quick-preview">
                    <div className="scheduling-ai-preview-hero">
                      <div>
                        <h2>
                          <Sparkles size={26} strokeWidth={2.35} aria-hidden="true" />
                          Xem trước lịch AI đề xuất
                          <span>AI</span>
                        </h2>
                        <p>Lịch được AI tối ưu dựa trên năng lực bác sĩ, nhu cầu khám và quy tắc vận hành.</p>
                      </div>
                      <div className="scheduling-ai-preview-status">
                        <span><i />Cập nhật lúc 08:45, 12/05/2026</span>
                        <strong><ShieldCheck size={14} strokeWidth={2.45} aria-hidden="true" />AI đã tối ưu 23 giây trước</strong>
                      </div>
                    </div>

                    <div className="scheduling-ai-preview-range">
                      <div className="scheduling-ai-preview-datebar">
                        <button type="button" aria-label="Khoảng lịch trước" onClick={() => moveAiPreviewDate(-1)}>
                          <ChevronLeft size={18} strokeWidth={2.65} aria-hidden="true" />
                        </button>
                        <strong><CalendarDays size={18} strokeWidth={2.45} aria-hidden="true" />12/05 - 31/05/2026</strong>
                        <button type="button" aria-label="Khoảng lịch sau" onClick={() => moveAiPreviewDate(1)}>
                          <ChevronRight size={18} strokeWidth={2.65} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="scheduling-ai-preview-summary">
                      {[
                        { icon: CalendarCheck2, label: 'Tổng ca khám', value: '1.464 ca', note: '↗ 8,6% so với kỳ trước', tone: 'violet' },
                        { icon: FileSpreadsheet, label: 'Bác sĩ tham gia', value: '14', note: '100% bác sĩ đăng ký', tone: 'green' },
                        { icon: HeartPulse, label: 'Khoa / Phòng', value: '2', note: 'Nhi, Tim mạch', tone: 'amber' },
                        { icon: Activity, label: 'Chất lượng tối ưu', value: '95%', note: 'Rất tốt', tone: 'blue', badge: '+5%' },
                        { icon: Ban, label: 'Xung đột lịch', value: '0', note: 'Không phát hiện', tone: 'rose', ok: true },
                        { icon: ShieldCheck, label: 'Độ phủ lịch', value: '96%', note: '↗ 4% so với kỳ trước', tone: 'teal', ring: true },
                      ].map(({ icon: MetricIcon, label, value, note, tone, badge, ok, ring }) => (
                        <article key={label} className={`is-${tone}`}>
                          <span aria-hidden="true"><MetricIcon size={20} strokeWidth={2.45} /></span>
                          <small>{label}</small>
                          <strong>{value}</strong>
                          <em>{note}{ok ? <CircleCheck size={12} strokeWidth={2.7} aria-hidden="true" /> : null}</em>
                          {badge ? <mark>{badge}</mark> : null}
                          {ring ? <i className="scheduling-ai-preview-ring" aria-hidden="true"><b /></i> : null}
                        </article>
                      ))}
                    </div>

                    <div className="scheduling-ai-quick-toolbar">
                      <div className="scheduling-ai-quick-tabs" role="tablist" aria-label="Chế độ xem lịch AI">
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
                      <select
                        value={aiPreviewDepartment}
                        onChange={(event) => setAiPreviewDepartment(event.target.value)}
                        aria-label="Lọc lịch AI theo khoa"
                      >
                        <option value="all">Tất cả khoa</option>
                        {aiPreviewDepartmentRows.map((row) => (
                          <option key={row.department} value={row.department}>{row.department}</option>
                        ))}
                      </select>
                      <select
                        value={aiPreviewDoctor}
                        onChange={(event) => setAiPreviewDoctor(event.target.value)}
                        aria-label="Lọc lịch AI theo bác sĩ"
                      >
                        <option value="all">Tất cả bác sĩ</option>
                        {aiDoctorOptions.map((doctor) => (
                          <option key={doctor} value={doctor}>{doctor}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setActionMessage('Đã chọn mốc ngày 01/05/2026 cho preview AI.')}>
                        <CalendarDays size={16} strokeWidth={2.45} aria-hidden="true" />
                        01/05/2026
                      </button>
                      <button type="button" aria-label="Làm mới lịch AI" onClick={searchAiPreviewSchedule}>
                        <LoaderCircle size={16} strokeWidth={2.45} aria-hidden="true" />
                      </button>
                      <div className="scheduling-ai-preview-actions">
                        <button type="button" onClick={() => setActionMessage('Đang so sánh các phương án lịch AI.')}>
                          <Activity size={16} strokeWidth={2.45} aria-hidden="true" />
                          So sánh phương án
                        </button>
                        <button type="button" onClick={exportAiPreviewSchedule}>
                          <Download size={16} strokeWidth={2.45} aria-hidden="true" />
                          Xuất báo cáo
                          <ChevronDown size={15} strokeWidth={2.45} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="scheduling-ai-preview-board">
                      <div className="scheduling-ai-quick-calendar">
                        <div className="scheduling-ai-quick-calendar-head">
                          <strong>Khoa / Bác sĩ <SlidersHorizontal size={16} strokeWidth={2.45} aria-hidden="true" /></strong>
                          {aiQuickPreviewDays.map(([day, date], index) => (
                            <span key={`${day}-${date}-${index}`} className={day === 'CN' ? 'is-weekend' : ''}>
                              {day}
                              {date ? <small>{date}</small> : null}
                            </span>
                          ))}
                        </div>

                        {aiQuickPreviewGroups.map((group) => {
                          const DepartmentIcon = group.icon || Stethoscope;

                          return (
                            <div className="scheduling-ai-quick-calendar-group" key={group.department}>
                              <div className={`scheduling-ai-quick-department is-${group.tone || 'purple'}`}>
                                <ChevronDown size={15} strokeWidth={2.55} aria-hidden="true" />
                                <span aria-hidden="true"><DepartmentIcon size={17} strokeWidth={2.45} /></span>
                                <strong>{group.department}</strong>
                                <small>{group.count}</small>
                                {group.priority ? <em>{group.priority}</em> : null}
                              </div>
                              {group.doctors.map((doctor) => (
                                <div className="scheduling-ai-quick-calendar-row" key={doctor.name}>
                                  <strong>
                                    <img src={doctor.avatar} alt="" />
                                    <span>{doctor.name}</span>
                                  </strong>
                                  {doctor.shifts.map((shift, index) => (
                                    <button
                                      key={`${doctor.name}-${index}`}
                                      type="button"
                                      className={
                                        shift === 'Sáng'
                                          ? 'is-morning'
                                          : shift === 'Chiều'
                                            ? 'is-afternoon'
                                            : shift === 'Nghỉ'
                                              ? 'is-off'
                                              : shift
                                                ? 'is-total'
                                                : 'is-empty'
                                      }
                                      onClick={() => shift && setActionMessage(`${doctor.name}: ${shift} ngày ${aiQuickPreviewDays[index]?.[1] || 'tiếp theo'}.`)}
                                    >
                                      {shift}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      <aside className="scheduling-ai-preview-insights" aria-label="Nhận định và gợi ý từ AI">
                        <h3><Sparkles size={17} strokeWidth={2.45} aria-hidden="true" />Nhận định & gợi ý từ AI</h3>
                        {[
                          { icon: ShieldCheck, title: 'Không phát hiện trùng lịch', copy: 'Lịch làm việc tuân thủ quy tắc và không có xung đột.', tone: 'green' },
                          { icon: Activity, title: 'Độ phủ tốt', copy: 'Độ phủ lịch đạt 96%, đáp ứng tốt nhu cầu khám.', tone: 'blue' },
                          { icon: Sparkles, title: 'Tối ưu tải', copy: 'Phân bổ ca khoa học, hạn chế quá tải vào buổi chiều.', tone: 'purple' },
                          { icon: Timer, title: 'Gợi ý thêm', copy: 'Có thể cân nhắc tăng ca sáng ngày 04/05 tại Khoa Tim mạch.', tone: 'amber', action: true },
                        ].map(({ icon: InsightIcon, title, copy, tone, action }) => (
                          <article key={title} className={`is-${tone}`}>
                            <InsightIcon size={16} strokeWidth={2.45} aria-hidden="true" />
                            <strong>{title}</strong>
                            <p>{copy}</p>
                            {action ? <button type="button" onClick={() => setActionMessage('Đã mở chi tiết gợi ý tăng ca sáng ngày 04/05.')}>Xem chi tiết gợi ý</button> : null}
                          </article>
                        ))}
                        <footer>
                          <strong>Tải sử dụng trung bình</strong>
                          <svg viewBox="0 0 210 34" aria-hidden="true">
                            <polyline points="2,18 14,13 26,22 38,10 50,18 62,12 74,21 86,11 98,19 110,13 122,22 134,10 146,17 158,12 170,21 182,13 194,18 208,11" />
                          </svg>
                          <span><b>78%</b><em>+ Tốt</em></span>
                          <i><b /></i>
                        </footer>
                      </aside>
                    </div>

                    <div className="scheduling-ai-preview-insight-strip">
                      <span aria-hidden="true"><Sparkles size={26} strokeWidth={2.45} /></span>
                      <div>
                        <strong>AI gợi ý tổng quan</strong>
                        <p>Lịch được tối ưu dựa trên 12 ràng buộc và mẫu nhu cầu khám.</p>
                      </div>
                      <article><ShieldCheck size={18} strokeWidth={2.45} aria-hidden="true" /><strong>Không phát hiện trùng lịch</strong><small>Tuân thủ 100% quy tắc</small></article>
                      <article><Activity size={18} strokeWidth={2.45} aria-hidden="true" /><strong>Độ phủ tốt</strong><small>96% ca khám được đáp ứng</small></article>
                      <article><Sparkles size={18} strokeWidth={2.45} aria-hidden="true" /><strong>Tối ưu tải</strong><small>Phân bổ hợp lý theo năng lực</small></article>
                      <button type="button" onClick={() => setActionMessage('Đã mở phân tích chi tiết lịch AI.')}>
                        Xem phân tích chi tiết
                        <ChevronRight size={16} strokeWidth={2.55} aria-hidden="true" />
                      </button>
                    </div>

                    <div className="scheduling-ai-quick-legend">
                      <span><i className="is-morning" />Sáng</span>
                      <span><i className="is-afternoon" />Chiều</span>
                      <span><i className="is-off" />Nghỉ</span>
                      <span><i className="is-holiday" />Ngày nghỉ</span>
                      <span><Sparkles size={13} strokeWidth={2.35} />Ưu tiên cao</span>
                      <span><SlidersHorizontal size={13} strokeWidth={2.35} />Tự động cân bằng</span>
                      <span><ShieldCheck size={13} strokeWidth={2.35} />Không trùng lịch</span>
                      <span><Timer size={13} strokeWidth={2.35} />Tối ưu tải</span>
                      <div>
                        <button type="button" onClick={() => setIsPreviewDetailOpen(true)}>
                          <CalendarCheck2 size={16} strokeWidth={2.45} aria-hidden="true" />
                          Xem chi tiết lịch
                        </button>
                        <button type="button" className="is-primary" onClick={() => setActionMessage('Đang so sánh phương án lịch AI.')}>
                          <Activity size={16} strokeWidth={2.45} aria-hidden="true" />
                          So sánh phương án
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <div className="scheduling-bulk-ai-workspace scheduling-ai-quick-legacy" aria-hidden="true">
              <section className="scheduling-bulk-ai-chat" aria-label="Trò chuyện với AI tạo lịch">
                <div className="scheduling-bulk-side-title scheduling-bulk-ai-chat__title">
                  <Sparkles size={15} strokeWidth={2.45} aria-hidden="true" />
                  <strong>Trò chuyện với AI trợ lý</strong>
                  <button type="button" aria-label="Thu gọn trợ lý AI" onClick={() => setActionMessage('Đã thu gọn trợ lý AI.')}>
                    <ArrowRight size={13} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>

                <div className="scheduling-bulk-ai-chat__body">
                  <div className="scheduling-bulk-ai-message-list" aria-live="polite">
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
                      {aiProcessingStepRows.map((step, index) => {
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
                        {aiPreviewDepartmentRows.map((row) => (
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
                    <strong>{formatCompactNumber(allocationCellCount)}</strong>
                  </article>
                  <article className="is-valid">
                    <span>Hợp lệ</span>
                    <strong>{formatCompactNumber(buildBulkCreatePayloadItems().length)} <small>lịch</small></strong>
                  </article>
                  <article className="is-warning">
                    <span>Cảnh báo</span>
                    <strong>{formatCompactNumber(allocationConflictCount + allocationExcludedCount)} <small>mục</small></strong>
                  </article>
                  <article className="is-error">
                    <span>Lỗi</span>
                    <strong>{formatCompactNumber(missingDepartmentDoctorCount)} <small>DB</small></strong>
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
                      {databaseExcelPreviewRows.map(([index, date, doctor, department, service, time, slots, status, tone]) => (
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
                  <span>Hiển thị {formatCompactNumber(databaseExcelPreviewRows.length)} dòng đầu tiên từ dữ liệu database hiện tại</span>
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
            <div className="scheduling-bulk-basic-head">
              <div className="scheduling-bulk-section-title">
                <span>1.</span>
                <strong>Thông tin cơ bản</strong>
              </div>

              {isDateRangeMethod ? (
                <div className="scheduling-bulk-date-range-presets" aria-label="Chọn nhanh dải ngày áp dụng">
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
            </div>

            <div className="scheduling-bulk-basic-grid">
              <label className="scheduling-bulk-field is-required">
                <span>Chọn bác sĩ</span>
                <button type="button" className="scheduling-bulk-field__control scheduling-bulk-doctor-select" onClick={() => toggleFieldMenu('doctors')}>
                  <span className="scheduling-bulk-avatar-stack">
                    {avatarDoctors.map((doctor, index) => (
                      <img
                        key={doctor.id || doctor.name}
                        src={doctor.avatar || doctorAvatarMap[doctor.id] || fallbackDoctorAvatars[index] || '/images/scheduling/doctors/doctor-ai-fallback.png'}
                        alt={doctor.name}
                      />
                    ))}
                    {selectedDoctorRecords.length > 3 ? <em>+{selectedDoctorRecords.length - 3}</em> : null}
                  </span>
                  <strong>{selectedDoctorRecords.length ? `${selectedDoctorRecords.length} bác sĩ đã chọn` : 'Chọn bác sĩ'}</strong>
                  <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
                {openFieldMenu === 'doctors' ? (
                  <div className="scheduling-bulk-field-menu scheduling-bulk-doctor-menu">
                    <div className="scheduling-bulk-doctor-menu__search">
                      <Search size={14} strokeWidth={2.35} aria-hidden="true" />
                      <input
                        type="search"
                        value={doctorSearch}
                        placeholder="Tìm tên bác sĩ hoặc chuyên khoa"
                        onChange={(event) => setDoctorSearch(event.target.value)}
                      />
                    </div>
                    <div className="scheduling-bulk-doctor-menu__filters">
                      {[
                        ['all', 'Tất cả'],
                        ['department', `Lọc ${selectedDepartment}`],
                        ['available', 'Còn trống'],
                        ['selected', 'Đã chọn'],
                      ].map(([id, label]) => (
                        <button key={id} type="button" className={doctorFilter === id ? 'is-selected' : ''} onClick={() => setDoctorFilter(id)}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="scheduling-bulk-doctor-menu__list">
                      {filteredDoctorOptions.length > 0 ? (
                        filteredDoctorOptions.map((doctor) => {
                          const isSelected = selectedDoctors.includes(doctor.id);
                          return (
                            <button key={doctor.id} type="button" className={isSelected ? 'is-selected' : ''} onClick={() => toggleDoctor(doctor.id)}>
                              <span className="scheduling-bulk-doctor-check" aria-hidden="true">
                                {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                              </span>
                              <img src={doctor.avatar} alt={doctor.name} />
                              <span>
                                <strong>{doctor.name}</strong>
                                <small>{doctor.department} · {doctor.status}</small>
                              </span>
                              <em>{doctor.load}% tải</em>
                            </button>
                          );
                        })
                      ) : (
                        <div className="scheduling-bulk-doctor-menu__empty">
                          {createResourcesLoaded
                            ? 'Không có bác sĩ database phù hợp bộ lọc.'
                            : 'Chưa tải được danh sách bác sĩ từ database.'}
                        </div>
                      )}
                    </div>
                    <div className="scheduling-bulk-doctor-menu__actions">
                      <span>{selectedDoctorRecords.length} / {doctorSelectionOptions.length} bác sĩ</span>
                      <button type="button" onClick={selectVisibleDoctors}>Chọn kết quả</button>
                      <button type="button" onClick={clearSelectedDoctors}>Bỏ chọn</button>
                    </div>
                  </div>
                ) : null}
              </label>

              <label className="scheduling-bulk-field">
                <span>Khoa lọc / tham chiếu</span>
                <button type="button" className="scheduling-bulk-field__control scheduling-bulk-selectlike" onClick={() => toggleFieldMenu('department')}>
                  <HeartPulse size={15} strokeWidth={2.4} aria-hidden="true" />
                  <strong>{selectedDepartment}</strong>
                  <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
                </button>
                {openFieldMenu === 'department' ? (
                  <div className="scheduling-bulk-field-menu scheduling-bulk-choice-menu">
                    {departmentChoices.length ? departmentChoices.map((option) => {
                      const departmentRecord = databaseDepartments.find((department) => department.name === option);
                      const [fallbackCopy, fallbackMeta] = departmentOptionDetails[option] || ['Dữ liệu khoa được đồng bộ từ hệ thống.', 'Có thể chọn'];
                      const copy = departmentRecord
                        ? `${departmentRecord.schedulesCount || departmentRecord.activeSchedulesCount || 0} lịch đang quản lý · ${departmentRecord.availableSlots || 0} slot trống`
                        : fallbackCopy;
                      const meta = departmentRecord?.utilization !== undefined ? `${Math.round(departmentRecord.utilization)}% tải` : fallbackMeta;
                      return (
                        <button key={option} type="button" className={selectedDepartment === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setSelectedDepartment, option, `Đã đổi khoa lọc: ${option}. Lịch vẫn lưu theo khoa thật của từng bác sĩ.`)}>
                          <span>
                            <strong>{option}</strong>
                            <small>{copy}</small>
                          </span>
                          <em>{meta}</em>
                        </button>
                      );
                    }) : (
                      <div className="scheduling-bulk-doctor-menu__empty">Chưa tải được danh sách khoa từ database.</div>
                    )}
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
                  <div className="scheduling-bulk-field-menu scheduling-bulk-choice-menu">
                    {scheduleTypeChoices.map((option) => {
                      const typeMeta = scheduleTypeMetaByValue.get(option) || getScheduleTypeMeta(option);
                      const copy = typeMeta.meta || 'Loại lịch được đồng bộ từ hệ thống.';
                      const meta = typeMeta.badge || 'Đang dùng';
                      return (
                        <button key={option} type="button" className={selectedScheduleType === option ? 'is-selected' : ''} onClick={() => chooseFieldValue(setSelectedScheduleType, option, `Đã chọn loại lịch: ${option}.`)}>
                          <span>
                            <strong>{option}</strong>
                            <small>{copy}</small>
                          </span>
                          <em>{meta}</em>
                        </button>
                      );
                    })}
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
                      <input type="date" value={dateRange.start} onChange={(event) => updateDateRangeField('start', event.target.value)} />
                    </div>
                    <div>
                      <span>Đến ngày</span>
                      <input type="date" value={dateRange.end} onChange={(event) => updateDateRangeField('end', event.target.value)} />
                    </div>
                    {rangePresetOptions.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => {
                          setDateRange({ start: option.start, end: option.end });
                          setRepeatEndDate(option.end);
                          if (isDateRangeMethod) {
                            setSelectedDateRangePreset('Tùy chọn');
                          }
                          setOpenFieldMenu('');
                          setActionMessage(`Đã áp dụng khoảng thời gian: ${option.label}.`);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </label>
            </div>

            <div className="scheduling-bulk-basic-metrics">
              {basicSummaryItems.map(([Icon, label, value, note]) => (
                <div key={label}>
                  <Icon size={14} strokeWidth={2.35} aria-hidden="true" />
                  <span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <em>{note}</em>
                  </span>
                </div>
              ))}
              <button
                type="button"
                className={isBasicDetailOpen ? 'is-selected' : ''}
                onClick={() => {
                  setIsBasicDetailOpen((current) => !current);
                  setActionMessage(isBasicDetailOpen ? 'Đã thu gọn chi tiết cấu hình.' : 'Đã mở chi tiết cấu hình hàng loạt.');
                }}
              >
                <span>{sourceStatusLabel}</span>
                Xem chi tiết
                <ChevronDown size={13} strokeWidth={2.35} aria-hidden="true" />
              </button>
            </div>
            {isBasicDetailOpen ? (
              <div className="scheduling-bulk-detail-strip">
                {basicDetailItems.map(([label, value]) => (
                  <span key={label}>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </span>
                ))}
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
                      setIsExtraBreakFormOpen(false);
                      setActionMessage('Đã xóa các khoảng nghỉ bổ sung.');
                    }}
                  >
                    Không nghỉ khác
                  </button>
                  <button
                    type="button"
                    className="is-add"
                    onClick={() => {
                      setIsExtraBreakFormOpen((current) => !current);
                      setActionMessage(isExtraBreakFormOpen ? 'Đã thu gọn thêm khoảng nghỉ.' : 'Đã mở thêm khoảng nghỉ bổ sung.');
                    }}
                    disabled={!isBreakEnabled}
                    aria-expanded={isExtraBreakFormOpen}
                  >
                    <Plus size={13} strokeWidth={2.45} aria-hidden="true" />
                    {isExtraBreakFormOpen ? 'Đang thêm nghỉ' : 'Thêm khoảng nghỉ'}
                  </button>
                </div>
                {isExtraBreakFormOpen ? (
                  <div className="scheduling-bulk-extra-break-form">
                    <label>
                      <span>Từ</span>
                      <input
                        type="time"
                        value={extraBreakDraftStart}
                        disabled={!isBreakEnabled}
                        onChange={(event) => setExtraBreakDraftStart(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Đến</span>
                      <input
                        type="time"
                        value={extraBreakDraftEnd}
                        disabled={!isBreakEnabled}
                        onChange={(event) => setExtraBreakDraftEnd(event.target.value)}
                      />
                    </label>
                    <div className="scheduling-bulk-extra-break-form__actions">
                      <button
                        type="button"
                        className="is-cancel"
                        onClick={() => {
                          setIsExtraBreakFormOpen(false);
                          setActionMessage('Đã hủy thêm khoảng nghỉ bổ sung.');
                        }}
                      >
                        Hủy
                      </button>
                      <button type="button" className="is-save" onClick={addExtraBreak} disabled={!isBreakEnabled}>
                      Lưu khoảng nghỉ
                      </button>
                    </div>
                  </div>
                ) : null}
                {extraBreaks.length ? (
                  <div className="scheduling-bulk-break-note">
                    {extraBreaks.map((item, index) => (
                      <span key={item.id}>
                        <strong>{index + 2}.</strong>
                        <input
                          type="time"
                          value={item.start}
                          onChange={(event) => updateExtraBreak(item.id, 'start', event.target.value)}
                        />
                        <em>-</em>
                        <input
                          type="time"
                          value={item.end}
                          onChange={(event) => updateExtraBreak(item.id, 'end', event.target.value)}
                        />
                        <button type="button" onClick={() => removeExtraBreak(item.id)} aria-label="Xóa khoảng nghỉ">×</button>
                      </span>
                    ))}
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
              <>
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
                          setSelectedDays(allWeekDays);
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
                      <button
                        type="button"
                        className={selectedDayType === 'custom' ? 'is-radio-selected' : ''}
                        onClick={() => {
                          setSelectedDayType('custom');
                          setActionMessage('Đã chuyển dải ngày sang tùy chỉnh theo thứ.');
                        }}
                      >
                        <span />
                        Tùy chỉnh theo thứ đã chọn
                      </button>

                      {selectedDayType === 'custom' ? (
                        <div className="scheduling-bulk-repeat-days scheduling-bulk-repeat-days--inline" aria-label="Tùy chỉnh thứ áp dụng trong dải ngày">
                          {allWeekDays.map((day) => (
                            <button
                              key={day}
                              type="button"
                              className={selectedDays.includes(day) ? 'is-selected' : ''}
                              onClick={() => toggleDay(day)}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      ) : null}

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
                                min={dateRange.start}
                                max={dateRange.end}
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
                        <div className="scheduling-bulk-day-stepper">
                          <button
                            type="button"
                            aria-label="Giảm số ngày lặp"
                            disabled={dateRangeEveryDays <= 1}
                            onClick={() => updateDateRangeEveryDays(dateRangeEveryDays - 1)}
                          >
                            <Minus size={13} strokeWidth={2.7} aria-hidden="true" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="31"
                            value={dateRangeEveryDays}
                            aria-label="Số ngày lặp trong dải ngày"
                            onChange={(event) => updateDateRangeEveryDays(event.target.value)}
                            onKeyDown={(event) => {
                              if (['e', 'E', '+', '-'].includes(event.key)) {
                                event.preventDefault();
                              }
                            }}
                          />
                          <button
                            type="button"
                            aria-label="Tăng số ngày lặp"
                            disabled={dateRangeEveryDays >= 31}
                            onClick={() => updateDateRangeEveryDays(dateRangeEveryDays + 1)}
                          >
                            <Plus size={13} strokeWidth={2.7} aria-hidden="true" />
                          </button>
                        </div>
                        <em>ngày</em>
                      </label>
                      <div className="scheduling-bulk-date-rule-summary">
                        <strong>{formatCompactNumber(projectedDays)} ngày áp dụng</strong>
                        <span>{scheduleRuleLabel} · {formatDateDisplay(dateRange.start)} - {formatDateDisplay(effectiveScheduleEndDate)}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                  <label className="scheduling-bulk-field">
                    <span>{isRangeMethod ? 'Áp dụng vào các ngày' : 'Chu kỳ lặp'}</span>
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
                            onClick={() => (isRangeMethod
                              ? chooseFieldValue(setRangeInterval, option, `Đã chọn khoảng lặp: ${option}.`)
                              : chooseRepeatFrequency(option))}
                          >
                            <strong>{option}</strong>
                            {!isRangeMethod ? <small>{repeatFrequencyOptionDetails[option]}</small> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>

                  {!isRangeMethod && repeatFrequency === 'Hàng tuần' ? (
                    <label className="scheduling-bulk-repeat-every">
                      <span>Chu kỳ tuần</span>
                      <div className="scheduling-bulk-repeat-stepper" role="group" aria-label="Chọn số tuần lặp">
                        <button
                          type="button"
                          onClick={() => updateRepeatEveryWeeks(repeatEveryWeeks - 1)}
                          disabled={repeatEveryWeeks <= 1}
                          aria-label="Giảm số tuần lặp"
                        >
                          -
                        </button>
                        <strong>{repeatEveryWeeks}</strong>
                        <button
                          type="button"
                          onClick={() => updateRepeatEveryWeeks(repeatEveryWeeks + 1)}
                          disabled={repeatEveryWeeks >= 12}
                          aria-label="Tăng số tuần lặp"
                        >
                          +
                        </button>
                      </div>
                      <em>Mỗi {repeatEveryWeeks} tuần</em>
                    </label>
                  ) : null}

                  {!isRangeMethod ? (
                    <div className="scheduling-bulk-repeat-explainer">
                      <strong>Cách hiểu chu kỳ</strong>
                      <span>
                        {repeatFrequency === 'Hàng tuần'
                          ? `Lịch sẽ được tạo vào ${selectedDays.join(', ') || 'các thứ đã chọn'} trong mỗi ${repeatEveryWeeks} tuần. Ví dụ mỗi 1 tuần là tuần nào cũng tạo, mỗi 2 tuần là cách 1 tuần tạo 1 lần.`
                          : repeatFrequency === 'Hàng ngày'
                            ? 'Lịch sẽ được tạo mỗi ngày trong khoảng áp dụng, sau đó vẫn loại trừ các ngày bạn thêm ở phần ngày loại trừ.'
                            : 'Lịch sẽ được tạo theo chu kỳ tháng trong khoảng áp dụng, phù hợp các lịch cố định dài hạn.'}
                      </span>
                    </div>
                  ) : null}

                  {isRangeMethod ? (
                    <label className="scheduling-bulk-range-start">
                      <span>Ngày bắt đầu</span>
                      <span>
                        <input
                          type="date"
                          value={rangeRepeatStart}
                          min={dateRange.start}
                          max={dateRange.end}
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
                        <button
                          key={day}
                          type="button"
                          className={selectedDays.includes(day) ? 'is-selected' : ''}
                          disabled={isDayDisabledByType(day, selectedDayType)}
                          onClick={() => toggleDay(day)}
                        >
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
                            min={dateRange.start}
                            max={dateRange.end}
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
                      {isRangeMethod ? 'Số chu kỳ' : 'Lặp lại'}
                      <strong>{repeatCycleLabel}</strong>
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
                            {repeatFrequency === 'Hàng tuần' ? `${option} tuần` : repeatFrequency === 'Hàng tháng' ? `${option} tháng` : `${option} chu kỳ`}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                    </>
                  )}
                </div>

                <div className="scheduling-bulk-day-type">
                  <strong>Phạm vi ngày áp dụng</strong>
                  <button
                    type="button"
                    className={selectedDayType === 'all' ? 'is-checked' : ''}
                    onClick={() => {
                      setSelectedDayType('all');
                      setSelectedDays(allWeekDays);
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
                  <button
                    type="button"
                    className={selectedDayType === 'custom' ? 'is-checked' : ''}
                    onClick={() => {
                      setSelectedDayType('custom');
                      setActionMessage('Đã chuyển sang tùy chỉnh theo thứ đã chọn.');
                    }}
                  >
                    <span />
                    Tùy chỉnh theo thứ đã chọn
                  </button>

                  {isRangeMethod && selectedDayType === 'custom' ? (
                    <div className="scheduling-bulk-repeat-days scheduling-bulk-repeat-days--inline" aria-label="Tùy chỉnh thứ áp dụng cho khoảng ngày">
                      {allWeekDays.map((day) => (
                        <button
                          key={day}
                          type="button"
                          className={selectedDays.includes(day) ? 'is-selected' : ''}
                          onClick={() => toggleDay(day)}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="scheduling-bulk-exception">
                    <span>Ngày loại trừ</span>
                    <button
                      type="button"
                      onClick={() => {
                        toggleFieldMenu('exceptionDate');
                        setActionMessage('Đã mở chọn ngày ngoại lệ.');
                      }}
                      aria-expanded={openFieldMenu === 'exceptionDate'}
                    >
                      <Plus size={13} strokeWidth={2.45} aria-hidden="true" />
                      Thêm ngày loại trừ
                    </button>
                    {openFieldMenu === 'exceptionDate' ? (
                      <div className="scheduling-bulk-field-menu scheduling-bulk-exception-menu">
                        <div>
                          <span>Chọn ngày loại trừ</span>
                          <input
                            type="date"
                            value={exceptionDraftDate}
                            min={dateRange.start}
                            max={dateRange.end}
                            onChange={(event) => setExceptionDraftDate(event.target.value)}
                          />
                          <select value={exceptionDraftReason} onChange={(event) => setExceptionDraftReason(event.target.value)}>
                            {exceptionReasonOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                          <select value={exceptionDraftScope} onChange={(event) => setExceptionDraftScope(event.target.value)}>
                            {exceptionScopeOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => addExceptionDate({ value: exceptionDraftDate, label: formatDateDisplay(exceptionDraftDate) })}
                          >
                            Thêm ngày
                          </button>
                        </div>
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
                          <button key={`${item.value}-${item.scope}`} type="button" onClick={() => removeExceptionDate(item.value, item.scope)}>
                            <strong>{item.label}</strong>
                            <small>{item.reason} · {item.scopeLabel}</small>
                            <span aria-hidden="true">×</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="scheduling-bulk-repeat-preview">
                <div className="scheduling-bulk-repeat-preview__head">
                  <strong>Dự kiến tạo lịch</strong>
                  <span>
                    {formatCompactNumber(repeatPreviewSchedules)} có thể tạo · {formatCompactNumber(repeatPreviewSlots)} slot · {allocationConflictCount} xung đột chưa xử lý · {repeatPreviewExcludedCount} loại trừ
                  </span>
                  {repeatPreviewHiddenRows > 0 || isRepeatPreviewExpanded ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsRepeatPreviewExpanded((current) => !current);
                        setActionMessage(isRepeatPreviewExpanded ? 'Đã thu gọn bảng dự kiến tạo lịch.' : 'Đã mở toàn bộ bảng dự kiến tạo lịch.');
                      }}
                    >
                      {isRepeatPreviewExpanded ? 'Thu gọn' : `Xem tất cả ${formatCompactNumber(repeatPreviewResult.totalCount)} dòng`}
                    </button>
                  ) : null}
                </div>
                <div className="scheduling-bulk-repeat-preview__meta">
                  <span>Quy tắc: <strong>{scheduleRuleLabel}</strong></span>
                  <span>Phạm vi ngày: <strong>{appliedDayScopeLabel}</strong></span>
                  <span>Thời gian: <strong>{workStart}-{workEnd}</strong></span>
                </div>
                <div className="scheduling-bulk-repeat-preview__table">
                  <div className="is-head">
                    <span>Ngày</span>
                    <span>Thứ</span>
                    <span>Bác sĩ</span>
                    <span>Khoa</span>
                    <span>Giờ</span>
                    <span>Slot</span>
                    <span>Trạng thái</span>
                    <span>Kiểm tra</span>
                  </div>
                  {repeatPreviewRows.map((row) => (
                    <div key={`${row.date}-${row.doctor}-${row.day}-${row.time}`}>
                      <span>{row.date}</span>
                      <span>{row.day}</span>
                      <span>{row.doctor}</span>
                      <span>{row.department}</span>
                      <span>{row.time}</span>
                      <span>{row.slots}</span>
                      <span className={row.status === 'Trùng lịch' ? 'is-danger' : row.status === 'Loại trừ' ? 'is-warning' : 'is-ok'}>{row.status}</span>
                      <span title={row.check}>{row.check}</span>
                    </div>
                  ))}
                </div>
                <div className="scheduling-bulk-repeat-preview__foot">
                  <span>
                    Đang hiển thị {formatCompactNumber(repeatPreviewRows.length)}/{formatCompactNumber(repeatPreviewResult.totalCount)} dòng · đủ {formatCompactNumber(selectedDoctorRecords.length)} bác sĩ đã chọn.
                  </span>
                  {repeatPreviewHiddenRows > 0 ? <strong>Còn {formatCompactNumber(repeatPreviewHiddenRows)} dòng, bấm “Xem tất cả” để xem tiếp.</strong> : <strong>Đã hiển thị toàn bộ dữ liệu preview.</strong>}
                </div>
              </div>
              </>
              ) : null}

              {selectedAdvancedTab === 'templates' ? (
                <div className="scheduling-bulk-template-panel">
                  <div className="scheduling-bulk-advanced-panel-head">
                    <div>
                      <strong>Mẫu cấu hình nhanh</strong>
                      <span>Chọn mẫu sẽ thiết lập phương thức, ngày áp dụng và các rule thường dùng.</span>
                    </div>
                    <em>{selectedTemplateInfo.title}</em>
                  </div>
                  <div className="scheduling-bulk-template-cards">
                    {bulkSavedTemplates.map((template) => (
                      <article key={template.id} className={`is-${template.tone} ${selectedTemplate === template.id ? 'is-selected' : ''}`}>
                        <div className="scheduling-bulk-template-card__top">
                          <span aria-hidden="true"><Save size={16} strokeWidth={2.35} /></span>
                          <em>{template.badge}</em>
                        </div>
                        <strong>{template.title}</strong>
                        <p>{template.copy}</p>
                        <div>
                          {template.specs.map((spec) => (
                            <small key={spec}><Check size={11} strokeWidth={2.6} aria-hidden="true" />{spec}</small>
                          ))}
                        </div>
                        <button type="button" onClick={() => applySavedTemplate(template)}>
                          {selectedTemplate === template.id ? 'Đang áp dụng' : 'Áp dụng mẫu'}
                        </button>
                      </article>
                    ))}
                  </div>
                  <div className="scheduling-bulk-template-impact">
                    <span>Áp dụng mẫu hiện tại</span>
                    <strong>{selectedTemplateInfo.days.join(', ')} · {workStart}-{workEnd} · {formatCompactNumber(repeatPreviewSchedules)} lịch có thể tạo</strong>
                  </div>
                </div>
              ) : null}

              {selectedAdvancedTab === 'settings' ? (
                <div className="scheduling-bulk-rules-panel">
                  <div className="scheduling-bulk-advanced-panel-head">
                    <div>
                      <strong>Rule vận hành</strong>
                      <span>Các rule này quyết định cách kiểm tra dữ liệu, cân bằng phân bổ và lưu lịch nháp.</span>
                    </div>
                    <em>{allocationConflictCount} xung đột</em>
                  </div>
                  <div className="scheduling-bulk-rule-cards">
                    <button type="button" className={advancedSettings.conflict ? 'is-selected' : ''} onClick={() => toggleAdvancedSetting('conflict')} aria-pressed={advancedSettings.conflict}>
                      <span aria-hidden="true"><CircleCheck size={16} strokeWidth={2.4} /></span>
                      <div>
                        <strong>Kiểm tra xung đột</strong>
                        <small>So sánh lịch hiện có, nghỉ phép và slot đã khóa trước khi tạo.</small>
                        <em>{allocationConflictCount ? `${allocationConflictCount} lịch cần xử lý` : 'Không còn xung đột chưa xử lý'}</em>
                      </div>
                      <i>{advancedSettings.conflict ? 'Bật' : 'Tắt'}</i>
                    </button>
                    <button type="button" className={advancedSettings.lightLoad ? 'is-selected' : ''} onClick={() => toggleAdvancedSetting('lightLoad')} aria-pressed={advancedSettings.lightLoad}>
                      <span aria-hidden="true"><UsersRound size={16} strokeWidth={2.4} /></span>
                      <div>
                        <strong>Ưu tiên bác sĩ ít lịch</strong>
                        <small>Sắp xếp bác sĩ theo tải lịch từ database để cân bằng phân bổ.</small>
                        <em>Tải TB hiện tại {selectedDoctorLoadAverage || 0}%</em>
                      </div>
                      <i>{advancedSettings.lightLoad ? 'Bật' : 'Tắt'}</i>
                    </button>
                    <button
                      type="button"
                      className="is-selected"
                      onClick={() => setActionMessage('Lịch hàng loạt sẽ được lưu bản nháp để rà soát trước khi công khai.')}
                      aria-pressed="true"
                    >
                      <span aria-hidden="true"><ShieldCheck size={16} strokeWidth={2.4} /></span>
                      <div>
                        <strong>Lưu bản nháp sau khi tạo</strong>
                        <small>Lịch hợp lệ được backend lưu nháp để điều phối rà soát trước khi mở đặt khám.</small>
                        <em>{formatCompactNumber(repeatPreviewSchedules)} lịch sẽ lưu nháp</em>
                      </div>
                      <i>Bật</i>
                    </button>
                  </div>
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
              {selectedAllocationDoctors.map((doctor, rowIndex) => (
                <article key={doctor.id} className="scheduling-bulk-doctor-pill">
                  <img src={doctor.avatar} alt={doctor.name} />
                  <span>
                    <strong>{doctor.name}</strong>
                    <small>{doctor.department}</small>
                  </span>
                  <em>{allocationRows[rowIndex]?.totalSlots || 0} slot · tải {doctor.load || 0}%</em>
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
                    const willOpen = !isDoctorPickerOpen;
                    setIsDoctorPickerOpen(willOpen);
                    setActionMessage(willOpen ? 'Đã mở danh sách thêm bác sĩ vào lịch hàng loạt.' : 'Đã đóng danh sách thêm bác sĩ.');
                  }}
                  aria-expanded={isDoctorPickerOpen}
                  aria-controls="bulk-allocation-doctor-picker"
                >
                  <Plus size={17} strokeWidth={2.5} aria-hidden="true" />
                  Thêm bác sĩ
                </button>
              </div>
            </div>

            {isDoctorPickerOpen ? (
              <div className="scheduling-bulk-doctor-picker scheduling-bulk-doctor-picker--inline" id="bulk-allocation-doctor-picker">
                <div className="scheduling-bulk-doctor-picker__head">
                  <div>
                    <strong>Bác sĩ có thể thêm</strong>
                    <small>{availableAllocationDoctors.length} bác sĩ phù hợp cấu hình hiện tại</small>
                  </div>
                  <button
                    type="button"
                    className="scheduling-bulk-doctor-picker__close"
                    onClick={() => {
                      setIsDoctorPickerOpen(false);
                      setActionMessage('Đã đóng danh sách thêm bác sĩ.');
                    }}
                    aria-label="Đóng danh sách thêm bác sĩ"
                  >
                    ×
                  </button>
                </div>
                <div className="scheduling-bulk-doctor-picker__list">
                  {availableAllocationDoctors.length > 0 ? (
                    availableAllocationDoctors.map((doctor) => (
                      <button
                        key={doctor.id}
                        type="button"
                        className="scheduling-bulk-doctor-option"
                        onClick={() => addAllocationDoctor(doctor.id)}
                      >
                        <img src={doctor.avatar} alt={doctor.name} />
                        <span>
                          <strong>{doctor.name}</strong>
                          <small>{doctor.department} · tải {doctor.load || 0}% · {doctor.status}</small>
                        </span>
                        <em>
                          <Plus size={13} strokeWidth={2.45} aria-hidden="true" />
                          Thêm
                        </em>
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      className="scheduling-bulk-doctor-option is-restore"
                      onClick={() => {
                        setSelectedDoctors(doctorSelectionOptions.slice(0, 2).map((doctor) => doctor.id));
                        setIsDoctorPickerOpen(false);
                        setActionMessage('Đã khôi phục danh sách bác sĩ mặc định.');
                      }}
                    >
                      <span>
                        <strong>Khôi phục danh sách mặc định</strong>
                        <small>Chọn lại 2 bác sĩ đầu tiên trong danh sách phân bổ.</small>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            <div className="scheduling-bulk-preview-card" id="bulk-step-preview">
              <div className="scheduling-bulk-preview-head scheduling-bulk-preview-head--allocation">
                <div className="scheduling-bulk-preview-title">
                  <CalendarCheck2 size={15} strokeWidth={2.35} aria-hidden="true" />
                  <span>
                    <strong>Bảng phân bổ chi tiết</strong>
                    <small>{allocationAppliedDayCount} ngày áp dụng · {selectedMethodInfo.title} · {scheduleRuleLabel}</small>
                  </span>
                </div>
                <div className="scheduling-bulk-preview-badges scheduling-bulk-preview-badges--allocation">
                  <span>
                    <strong>{allocationPreviewDays.length}</strong>
                    <small>Ngày đang xem</small>
                  </span>
                  <span>
                    <strong>{displayedPreviewSlots}</strong>
                    <small>Slot dự kiến</small>
                  </span>
                  <span>
                    <strong>{displayedPreviewPatients}</strong>
                    <small>BN dự kiến</small>
                  </span>
                  <span className={allocationConflictCount ? 'is-warning' : ''}>
                    <strong>{allocationConflictCount}</strong>
                    <small>Xung đột</small>
                  </span>
                  <span className={allocationResolvedConflictCount ? 'is-resolved' : ''}>
                    <strong>{allocationResolvedConflictCount}</strong>
                    <small>Đã xử lý</small>
                  </span>
                </div>
                <div className="scheduling-bulk-preview-tools">
                  <div className="scheduling-bulk-preview-legend">
                    <i className="is-morning" /> Có lịch
                    <i className="is-extra" /> Loại trừ
                    <i className="is-conflict" /> Trùng lịch
                    <i className="is-resolved" /> Đã xử lý
                    <i className="is-off" /> Không áp dụng
                  </div>
                  <div className="scheduling-bulk-preview-actions">
                    {allocationConflictCells.length ? (
                      <button
                        type="button"
                        className={`scheduling-bulk-preview-action--warning ${activeConflictCell ? 'is-selected' : ''}`}
                        onClick={() => openConflictResolution(nextConflictToReview?.cell?.conflictKey)}
                        aria-expanded={Boolean(activeConflictCell)}
                      >
                        Xử lý xung đột
                      </button>
                    ) : null}
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
                </div>
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
                  <div>
                    <strong>{allocationConflictCount}</strong>
                    <span>Xung đột cần xử lý</span>
                  </div>
                  <div>
                    <strong>{allocationExcludedCount}</strong>
                    <span>Ngày/bác sĩ bị loại trừ</span>
                  </div>
                </div>
              ) : null}

              {activeConflictCell ? (
                <section className="scheduling-bulk-conflict-panel" id="bulk-conflict-resolution" aria-live="polite">
                  <div className="scheduling-bulk-conflict-panel__head">
                    <div>
                      <AlertTriangle size={16} strokeWidth={2.45} aria-hidden="true" />
                      <span>
                        <strong>Xử lý xung đột lịch</strong>
                        <small>{activeConflictCell.doctor.name} · {formatDateDisplay(activeConflictCell.day?.dateValue)} · {activeConflictCell.cell.timeRange}</small>
                      </span>
                    </div>
                    <button type="button" onClick={() => setActiveConflictKey('')}>Đóng</button>
                  </div>

                  <div className="scheduling-bulk-conflict-review">
                    <article className="scheduling-bulk-conflict-card is-proposed">
                      <header>
                        <span>
                          <strong>Lịch muốn tạo</strong>
                          <small>Sẽ lưu dạng bản nháp nếu chọn tạo lịch mới</small>
                        </span>
                        <em>Bản nháp</em>
                      </header>
                      <dl className="scheduling-bulk-conflict-meta">
                        <div><dt>Bác sĩ</dt><dd>{activeConflictCell.doctor.name}</dd></div>
                        <div><dt>Khoa</dt><dd>{activeConflictCell.doctor.department || 'Chưa có khoa'}</dd></div>
                        <div><dt>Ngày</dt><dd>{activeConflictCell.day?.day || getVietnameseWeekday(new Date(activeConflictCell.day?.dateValue))} · {formatDateDisplay(activeConflictCell.day?.dateValue)}</dd></div>
                        <div><dt>Giờ làm việc</dt><dd>{activeConflictCell.cell.timeRange}</dd></div>
                        <div><dt>Loại lịch</dt><dd>{selectedScheduleType}</dd></div>
                        <div><dt>Slot</dt><dd>{formatCompactNumber(activeConflictProposedSlots)} slot · {slotDuration}</dd></div>
                        <div><dt>Sức chứa</dt><dd>{formatCompactNumber(activeConflictProposedPatients)} BN dự kiến · tối đa {formatCompactNumber(activeConflictProposedCapacity)}</dd></div>
                        <div><dt>Nghỉ giữa giờ</dt><dd>{activeConflictBreakWindows.length ? activeConflictBreakWindows.map((item) => `${item.start}-${item.end}`).join(', ') : 'Không nghỉ'}</dd></div>
                        <div><dt>Cổng bệnh nhân</dt><dd>Mở đặt lịch sau khi công khai</dd></div>
                        <div><dt>Nguồn tạo</dt><dd>{selectedMethodInfo.title} · {selectedTemplateInfo.title}</dd></div>
                      </dl>
                      <div className="scheduling-bulk-conflict-summary-row">
                        <span><CalendarCheck2 size={14} strokeWidth={2.45} aria-hidden="true" /> Payload mới</span>
                        <strong>{activeConflictCell.cell.status === 'resolved-new' ? 'Đã chọn tạo' : 'Chưa gửi tạo'}</strong>
                      </div>
                    </article>

                    <article className="scheduling-bulk-conflict-card is-current">
                      <header>
                        <span>
                          <strong>Lịch đang có trong database</strong>
                          <small>{activeConflictCell.cell.conflicts.length} lịch bị trùng với khung giờ muốn tạo</small>
                        </span>
                        <em>{activeConflictBookedCount > 0 ? 'Có appointment' : 'Có thể xử lý'}</em>
                      </header>
                      <div className="scheduling-bulk-conflict-current__list">
                        {activeConflictCell.cell.conflicts.map((schedule) => (
                          <div key={schedule.id || `${schedule.start}-${schedule.end}`} className={Number(schedule.bookedSlots || 0) ? 'has-booked' : ''}>
                            <div className="scheduling-bulk-conflict-current__title">
                              <span>
                                <strong>{schedule.start}-{schedule.end}</strong>
                                <small>{normalizeScheduleType(schedule.scheduleType)} · {formatScheduleStatus(schedule.status)}</small>
                              </span>
                              <em>{formatCompactNumber(schedule.overlapMinutes || 0)} phút trùng</em>
                            </div>
                            <dl className="scheduling-bulk-conflict-existing-meta">
                              <div><dt>ID</dt><dd>{schedule.id || 'Chưa có mã'}</dd></div>
                              <div><dt>Khoa</dt><dd>{schedule.department || activeConflictCell.doctor.department || 'Chưa có khoa'}</dd></div>
                              <div><dt>Slot</dt><dd>{formatCompactNumber(schedule.totalSlots || 0)} tổng · {formatCompactNumber(schedule.availableSlots || 0)} trống</dd></div>
                              <div><dt>Đã đặt</dt><dd>{formatCompactNumber(schedule.bookedSlots || 0)} appointment</dd></div>
                              <div><dt>Đã khóa</dt><dd>{formatCompactNumber(schedule.blockedSlots || 0)} slot</dd></div>
                              <div><dt>Sức chứa</dt><dd>{formatCompactNumber((schedule.totalSlots || 0) * (schedule.capacity || 1))} BN tối đa</dd></div>
                            </dl>
                          </div>
                        ))}
                      </div>
                      {activeConflictBookedCount || activeConflictBlockedCount ? (
                        <p>{formatCompactNumber(activeConflictBookedCount)} slot đã đặt và {formatCompactNumber(activeConflictBlockedCount)} slot đã khóa trong các lịch hiện tại.</p>
                      ) : null}
                    </article>
                  </div>

                  <div className="scheduling-bulk-conflict-impact">
                    <div>
                      <ShieldCheck size={15} strokeWidth={2.45} aria-hidden="true" />
                      <span>
                        <strong>Nếu giữ lịch hiện tại</strong>
                        <small>Không thay đổi database cho ô này, lịch muốn tạo sẽ bị bỏ khỏi payload.</small>
                      </span>
                    </div>
                    <div>
                      <CalendarCheck2 size={15} strokeWidth={2.45} aria-hidden="true" />
                      <span>
                        <strong>Nếu tạo lịch mới</strong>
                        <small>{activeConflictBookedCount > 0 ? 'Không khả dụng vì lịch hiện tại đã có appointment.' : activeConflictReplacementEffect}</small>
                      </span>
                    </div>
                  </div>

                  <div className="scheduling-bulk-conflict-actions" role="group" aria-label="Cách xử lý xung đột">
                    <button
                      type="button"
                      className={activeConflictResolution === 'keep-existing' ? 'is-selected' : ''}
                      onClick={() => applyConflictResolution(activeConflictCell.cell.conflictKey, 'keep-existing')}
                    >
                      <ShieldCheck size={15} strokeWidth={2.45} aria-hidden="true" />
                      <span>
                        <strong>Giữ lịch hiện tại</strong>
                        <small>Bỏ lịch mới ở ô này, không gửi payload tạo lịch mới.</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={activeConflictResolution === 'replace-new' ? 'is-selected' : ''}
                      onClick={() => applyConflictResolution(activeConflictCell.cell.conflictKey, 'replace-new')}
                      disabled={activeConflictBookedCount > 0}
                    >
                      <CalendarCheck2 size={15} strokeWidth={2.45} aria-hidden="true" />
                      <span>
                        <strong>Tạo lịch mới</strong>
                        <small>
                          {activeConflictBookedCount > 0
                            ? 'Lịch hiện tại đã có appointment nên không thể hủy trực tiếp.'
                            : activeConflictReplacementEffect}
                        </small>
                      </span>
                    </button>
                    <button type="button" onClick={() => applyConflictResolution(activeConflictCell.cell.conflictKey, '')}>
                      <AlertTriangle size={15} strokeWidth={2.45} aria-hidden="true" />
                      <span>
                        <strong>Rà soát sau</strong>
                        <small>Giữ trạng thái xung đột, hệ thống sẽ chưa cho tạo lịch.</small>
                      </span>
                    </button>
                  </div>

                  <div className="scheduling-bulk-conflict-panel__foot">
                    <span>{allocationConflictCount} chưa xử lý · {allocationResolvedConflictCount} đã xử lý</span>
                    <button type="button" onClick={clearAllConflictResolutions}>Đặt lại tất cả</button>
                  </div>
                </section>
              ) : null}

              <div
                className="scheduling-bulk-matrix"
                role="table"
                aria-label="Xem trước phân bổ lịch"
                style={{ '--bulk-preview-days': allocationPreviewDays.length }}
              >
                <div className="scheduling-bulk-matrix__header" role="row">
                  <span />
                  {allocationPreviewDays.map((day) => (
                    <strong key={day.id}>
                      {day.day}
                      <small>{day.label}</small>
                    </strong>
                  ))}
                  <strong>Tổng slot</strong>
                  <strong>Tổng BN</strong>
                </div>

                {allocationRows.map((row) => (
                  <div className="scheduling-bulk-matrix__row" role="row" key={row.doctor.id}>
                    <div className="scheduling-bulk-matrix__doctor">
                      <img src={row.doctor.avatar} alt={row.doctor.name} />
                      <span>
                        <strong>{row.doctor.name}</strong>
                        <small>{row.doctor.department} · tải {row.doctor.load || 0}%</small>
                      </span>
                    </div>
                    {row.cells.map((cell, dayIndex) => {
                      const isConflictCell = Array.isArray(cell.conflicts) && cell.conflicts.length > 0;
                      const cellClassName = [
                        'scheduling-bulk-matrix__cell',
                        `is-${cell.status}`,
                        isConflictCell ? 'is-actionable' : '',
                        activeConflictKey === cell.conflictKey ? 'is-active' : '',
                      ].filter(Boolean).join(' ');
                      const cellKey = `${row.doctor.id}-${allocationPreviewDays[dayIndex]?.id}`;
                      const cellContent = ['scheduled', 'resolved-new'].includes(cell.status) ? (
                        <>
                          <strong>{cell.slots}</strong>
                          <small>{cell.timeRange}</small>
                          <em>{cell.patients} BN · {cell.capacityLabel}</em>
                        </>
                      ) : (
                        <>
                          <span>{cell.label}</span>
                          <small>{cell.note}</small>
                        </>
                      );

                      return isConflictCell ? (
                        <button
                          type="button"
                          className={cellClassName}
                          key={cellKey}
                          title={cell.note}
                          onClick={() => openConflictResolution(cell.conflictKey)}
                        >
                          {cellContent}
                          <b>{cell.status === 'conflict' ? 'Chọn cách xử lý' : 'Đã xử lý'}</b>
                        </button>
                      ) : (
                        <div className={cellClassName} key={cellKey} title={cell.note}>
                          {cellContent}
                        </div>
                      );
                    })}
                    <strong>{row.totalSlots}</strong>
                    <strong>{row.totalPatients}</strong>
                  </div>
                ))}

                <div className="scheduling-bulk-matrix__row is-total" role="row">
                  <div className="scheduling-bulk-matrix__doctor">
                    <span>Tổng cộng</span>
                  </div>
                  {allocationPreviewDays.map((day, dayIndex) => (
                    <strong key={`total-${day.id}`}>{allocationRows.reduce((total, row) => total + (row.cells[dayIndex]?.slots || 0), 0)}</strong>
                  ))}
                  <strong>{allocationTotalSlots}</strong>
                  <strong>{allocationTotalPatients}</strong>
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className={`scheduling-bulk-side ${hasCalendarSummary ? 'scheduling-bulk-side--range' : ''} ${isDateRangeMethod ? 'scheduling-bulk-side--date-range' : ''} ${isCopyMethod ? 'scheduling-bulk-side--copy' : ''} ${isExcelMethod ? 'scheduling-bulk-side--excel' : ''} ${isAiMethod ? 'scheduling-bulk-side--ai' : ''}`} style={{ '--bulk-progress': '78%', '--bulk-performance': `${projectedPerformanceScore}%` }}>
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
                  <strong>Tóm tắt đề xuất</strong>
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
                      <em>Thành công</em>
                    </button>
                  ))}
                </div>
              </section>

              <button type="button" className="scheduling-bulk-ai-apply" onClick={handleContinue} disabled={isCreatingSchedules}>
                {renderCreateActionIcon(20, 2.6)}
                <strong>{isCreatingSchedules ? 'Đang áp dụng lịch...' : 'Áp dụng lịch này'}</strong>
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
                    [UsersRound, 'Bác sĩ database', `${formatCompactNumber(databaseDoctors.length)} bác sĩ`],
                    [HeartPulse, 'Khoa database', `${formatCompactNumber(databaseDepartments.length)} khoa`],
                    [CalendarDays, 'Khoảng ngày áp dụng', `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`],
                    [CalendarCheck2, 'Tổng số ngày', `${formatCompactNumber(allocationAppliedDayCount)} ngày`],
                    [ClipboardCheck, 'Tổng slot dự kiến', `${formatCompactNumber(displayedPreviewSlots)} slot`],
                    [CircleCheck, 'Tổng lịch hợp lệ', `${formatCompactNumber(buildBulkCreatePayloadItems().length)} lịch`],
                    [AlertTriangle, 'Tổng lịch cảnh báo', `${formatCompactNumber(allocationConflictCount + allocationExcludedCount)} mục`],
                    [Info, 'Thiếu dữ liệu DB', `${formatCompactNumber(missingDepartmentDoctorCount)} bác sĩ`],
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
                    <strong>{formatCompactNumber(displayedPreviewSlots)}</strong>
                    <span>Tổng slot</span>
                  </div>
                  <div className="scheduling-bulk-excel-doctors__legend">
                    {allocationRows.slice(0, 5).map((row, index) => (
                      <div key={row.doctor.id} style={{ '--legend-color': ['#2563eb', '#14b8a6', '#7c3aed', '#f97316', '#a78bfa'][index % 5] }}>
                        <i />
                        <span>{row.doctor.name}</span>
                        <strong>{formatCompactNumber(row.totalSlots)} slot</strong>
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
                  <div className="is-valid"><CircleCheck size={14} strokeWidth={2.55} aria-hidden="true" />{resolvedDepartmentDoctorCount} bác sĩ có mã khoa database</div>
                  <div className="is-warning"><AlertTriangle size={14} strokeWidth={2.55} aria-hidden="true" />{allocationConflictCount} ô trùng với lịch hiện tại</div>
                  <div className="is-error"><Info size={14} strokeWidth={2.55} aria-hidden="true" />{missingDepartmentDoctorCount} bác sĩ thiếu dữ liệu khoa</div>
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
                <button type="button" className="is-primary" onClick={handleContinue} disabled={isCreatingSchedules}>
                  {renderCreateActionIcon(16, 2.6)}
                  <span>
                    <strong>{renderCreateActionCopy()}</strong>
                    <small>{renderCreateActionHint()}</small>
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
                <button type="button" className="is-primary" onClick={handleContinue} disabled={isCreatingSchedules}>
                  {renderCreateActionIcon(16, 2.6)}
                  <span>
                    <strong>{renderCreateActionCopy()}</strong>
                    <small>{renderCreateActionHint()}</small>
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
                    [UsersRound, 'Bác sĩ', `${formatCompactNumber(projectedDoctors)} bác sĩ`],
                    [HeartPulse, 'Khoa theo bác sĩ', selectedDepartmentPreview],
                    [CalendarCheck2, 'Loại lịch', selectedScheduleType],
                    [CalendarDays, isDateRangeMethod ? 'Dải ngày áp dụng' : 'Khoảng ngày áp dụng', `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`],
                    [Sparkles, isDateRangeMethod ? 'Quy tắc ngày' : 'Lặp lại', `${scheduleRuleLabel} (${formatCompactNumber(projectedDays)} ngày)`],
                    [Clock3, 'Khung giờ', `${workStart} - ${workEnd} | Nghỉ ${breakSummaryLabel}`],
                    [Timer, 'Thời lượng slot', slotDuration],
                    [CalendarPlus, 'Số slot / khung giờ', slotCapacity],
                    [ClipboardCheck, 'Tổng slot dự kiến', `${formatCompactNumber(projectedSlots)} slot`],
                    [UsersRound, 'Tổng bệnh nhân dự kiến', `${formatCompactNumber(projectedPatients)} BN`],
                  ].map(([Icon, label, value]) => (
                    <div key={label}>
                      <span><Icon size={13} strokeWidth={2.4} aria-hidden="true" /></span>
                      <strong>{label}</strong>
                      <em>{value}</em>
                    </div>
                  ))}
                </div>
              </section>

              {hasCalendarSummary ? (
                <section className="scheduling-bulk-range-stats">
                  <div className="scheduling-bulk-side-title">
                    <CalendarCheck2 size={15} strokeWidth={2.4} aria-hidden="true" />
                    <strong>Thống kê nhanh</strong>
                  </div>
                  <div>
                    <article>
                      <strong>{formatCompactNumber(projectedDays)}</strong>
                      <span>Ngày áp dụng</span>
                    </article>
                    <article>
                      <strong>{formatCompactNumber(projectedSlots)}</strong>
                      <span>Tổng slot</span>
                    </article>
                    <article>
                      <strong>{formatCompactNumber(projectedPatients)}</strong>
                      <span>BN dự kiến</span>
                    </article>
                    <article>
                      <strong>{formatCompactNumber(projectedDoctors)}</strong>
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
                    {exceptionDates.length ? <span><i className="is-exception" />Ngoại lệ</span> : null}
                  </div>
                </div>

                <div className="scheduling-bulk-calendar-control">
                  <button type="button" aria-label="Tháng trước" onClick={() => setActionMessage(`Đang xem ${calendarMonthLabel}.`)}>
                    <ChevronLeft size={14} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                  <strong>{calendarMonthLabel}</strong>
                  <button type="button" aria-label="Tháng sau" onClick={() => setActionMessage(`Đang xem ${calendarMonthLabel}.`)}>
                    <ChevronRight size={14} strokeWidth={2.45} aria-hidden="true" />
                  </button>
                </div>

                <div className="scheduling-bulk-calendar-grid" aria-label="Lịch áp dụng theo khoảng ngày">
                  {allWeekDays.map((day) => <strong key={day}>{day}</strong>)}
                  {calendarWeeks.flatMap((week, weekIndex) =>
                    week.map((day, dayIndex) => {
                      const key = `${weekIndex}-${dayIndex}-${day?.dateValue || 'empty'}`;
                      const isApplied = day && calendarAppliedDateSet.has(day.dateValue);
                      const isException = day && calendarExceptionDateSet.has(day.dateValue);
                      const isInRange = day && isDateWithinRange(day.dateValue, dateRange.start, effectiveScheduleEndDate);
                      const isOff = day && isInRange && !isApplied && !isException;
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
                                  ? `Ngày ${formatDateDisplay(day.dateValue)} có lịch theo quy tắc ${scheduleRuleLabel}.`
                                  : isException
                                    ? `Ngày ${formatDateDisplay(day.dateValue)} đang được đánh dấu ngoại lệ.`
                                    : `Ngày ${formatDateDisplay(day.dateValue)} không nằm trong quy tắc tạo lịch.`,
                              );
                            }
                          }}
                        >
                          {day?.day}
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
                  <p>Hệ thống sẽ kiểm tra trùng lịch bác sĩ. Lịch hợp lệ sẽ được lưu bản nháp để rà soát trước khi công khai.</p>
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
                <button type="button" className="is-primary" onClick={handleContinue} disabled={isCreatingSchedules}>
                  {renderCreateActionIcon(16, 2.6)}
                  <span>
                    <strong>{renderCreateActionCopy()}</strong>
                    <small>{renderCreateActionHint()}</small>
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
              <div
                className="scheduling-bulk-donut"
                style={{
                  '--bulk-morning-end': `${shiftSlotBreakdown[0]?.endPercent || 0}%`,
                  '--bulk-afternoon-end': `${shiftSlotBreakdown[1]?.endPercent || 0}%`,
                }}
              >
                <strong>{formatCompactNumber(displayedPreviewSlots)}</strong>
                <span>Tổng slot dự kiến</span>
              </div>
              <div className="scheduling-bulk-legend">
                {shiftSlotBreakdown.map((shift) => (
                  <div key={shift.id}>
                    <i className={shift.className} />
                    <span>{shift.label}</span>
                    <strong>{formatCompactNumber(shift.slots)} slot ({shift.percent}%)</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="scheduling-bulk-summary__metrics">
              <div>
                <UsersRound size={16} strokeWidth={2.35} aria-hidden="true" />
                <strong>{formatCompactNumber(selectedAllocationDoctors.length)}</strong>
                <span>Bác sĩ</span>
              </div>
              <div>
                <CalendarDays size={16} strokeWidth={2.35} aria-hidden="true" />
                <strong>{formatCompactNumber(allocationAppliedDayCount)}</strong>
                <span>Ngày áp dụng</span>
              </div>
              <div>
                <Clock3 size={16} strokeWidth={2.35} aria-hidden="true" />
                <strong>{formatCompactNumber(displayedPreviewSlots)}</strong>
                <span>Slot dự kiến</span>
              </div>
              <div>
                <UsersRound size={16} strokeWidth={2.35} aria-hidden="true" />
                <strong>{formatCompactNumber(displayedPreviewPatients)}</strong>
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
                <strong>{projectedPerformanceScore}%</strong>
                <span>Hiệu suất dự kiến</span>
              </div>
              <div className="scheduling-bulk-performance-copy">
                <div>
                  <Save size={14} strokeWidth={2.35} aria-hidden="true" />
                  <span>Doanh thu dự kiến</span>
                  <strong>{formatCurrency(projectedRevenue)}</strong>
                  <small>~ {formatCurrency(projectedRevenueCeiling)}</small>
                </div>
                <div>
                  <CalendarCheck2 size={14} strokeWidth={2.35} aria-hidden="true" />
                  <span>Tỷ lệ lấp đầy trung bình</span>
                  <strong>{scheduledFillRate}% lấp đầy</strong>
                  <small>{allocatedCapacityRate}% công suất phân bổ</small>
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
              {bulkAlertChecks.map((check) => {
                const Icon = check.tone === 'success' ? CircleCheck : AlertTriangle;

                return (
                  <div key={check.message} className={check.tone === 'success' ? '' : `is-${check.tone}`}>
                    <Icon size={14} strokeWidth={2.45} aria-hidden="true" />
                    <span>{check.message}</span>
                  </div>
                );
              })}
            </div>
            {isAlertDetailOpen ? (
              <div className="scheduling-bulk-alert-detail">
                {bulkAlertDetailItems.map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
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

          <button type="button" className="scheduling-bulk-final-cta" onClick={handleContinue} disabled={isCreatingSchedules}>
            <span>
              {renderCreateActionIcon(17, 2.7)}
              <strong>{renderCreateActionCopy()}</strong>
              <small>{renderCreateActionHint()}</small>
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


