import { useMemo, useState } from 'react';
import {
  AlarmClock,
  Bell,
  Bot,
  BriefcaseMedical,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  FileDown,
  FileText,
  Flame,
  Gauge,
  History,
  Info,
  Layers3,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  UsersRound,
  Video,
  WandSparkles,
  Waves,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

const tabs = [
  { id: 'overview', label: 'Tổng quát', icon: CalendarCheck2 },
  { id: 'slots', label: 'Khung giờ & Slot', icon: Clock3 },
  { id: 'booking', label: 'Quy tắc đặt lịch', icon: CalendarDays },
  { id: 'holidays', label: 'Nghỉ / Ngoại lệ', icon: BriefcaseMedical },
  { id: 'telehealth', label: 'Telehealth', icon: Video },
  { id: 'notification', label: 'Thông báo', icon: Bell },
  { id: 'policy', label: 'Chính sách', icon: FileText },
  { id: 'advanced', label: 'Nâng cao', icon: Settings },
];

const pathToTab = {
  '/scheduling/configuration': 'slots',
  '/scheduling/configuration/templates': 'slots',
  '/scheduling/configuration/policies': 'booking',
  '/scheduling/configuration/exceptions': 'holidays',
  '/scheduling/configuration/telehealth': 'telehealth',
  '/scheduling/configuration/notifications': 'notification',
  '/scheduling/configuration/advanced': 'advanced',
};

const metricCards = [
  { label: 'Số mẫu lịch đang dùng', value: '5', delta: '+1 so với tuần trước', icon: CalendarDays, tone: 'blue', series: [18, 18, 18, 20, 24, 23, 23, 19, 28, 21, 22, 24] },
  { label: 'Thời lượng slot mặc định', value: '15 phút', delta: 'Không đổi', icon: Clock3, tone: 'violet', series: [14, 15, 14, 16, 14, 14, 19, 16, 22, 15, 18, 20] },
  { label: 'Tỷ lệ lấp đầy mục tiêu', value: '85%', delta: '+3% so với tuần trước', icon: Target, tone: 'green', series: [45, 46, 52, 61, 50, 42, 52, 48, 54, 51, 58, 69] },
  { label: 'Số ngày nghỉ đã cấu hình', value: '18 ngày', delta: '2 ngày', icon: Flame, tone: 'amber', series: [16, 16, 18, 24, 24, 24, 18, 24, 23, 22, 16, 28] },
  { label: 'Quy tắc xung đột', value: '12 quy tắc', delta: 'Không đổi', icon: Shuffle, tone: 'red', series: [22, 24, 30, 38, 28, 25, 28, 20, 35, 42, 34, 24] },
  { label: 'Telehealth đang bật', value: 'Có', delta: '100% hoạt động', icon: Video, tone: 'cyan', series: [16, 21, 16, 30, 15, 20, 17, 22, 40, 18, 24, 20] },
  { label: 'Mức quá tải cho phép', value: '120%', delta: '+10% so với trước', icon: Gauge, tone: 'sky', series: [18, 18, 30, 21, 24, 22, 25, 18, 28, 26, 36, 19] },
  { label: 'Tỷ lệ no-show mục tiêu', value: '8%', delta: '-1% so với trước', icon: UsersRound, tone: 'purple', series: [18, 19, 16, 22, 18, 23, 17, 30, 18, 18, 25, 20] },
];

const architectureCards = [
  { label: 'Bước 01', title: 'Nền lịch', copy: 'Giờ làm việc, slot, đệm khám', icon: Layers3, tone: 'blue' },
  { label: 'Bước 02', title: 'Quy tắc kiểm soát', copy: 'Xung đột, quá tải, no-show', icon: ShieldCheck, tone: 'green' },
  { label: 'Bước 03', title: 'Mô phỏng tác động', copy: 'Sức chứa, lấp đầy, cảnh báo', icon: Waves, tone: 'cyan' },
  { label: 'Bước 04', title: 'Triển khai mẫu', copy: 'Mẫu lịch, thao tác nhanh, AI', icon: Bot, tone: 'violet' },
];

const workDays = [
  { day: 'Thứ 2', enabled: true, start: '07:30', lunchStart: '12:00', lunchEnd: '13:30', end: '17:00', extra: '' },
  { day: 'Thứ 3', enabled: true, start: '07:30', lunchStart: '12:00', lunchEnd: '13:30', end: '17:00', extra: '' },
  { day: 'Thứ 4', enabled: true, start: '07:30', lunchStart: '12:00', lunchEnd: '13:30', end: '17:00', extra: '' },
  { day: 'Thứ 5', enabled: true, start: '07:30', lunchStart: '12:00', lunchEnd: '13:30', end: '17:00', extra: '' },
  { day: 'Thứ 6', enabled: true, start: '07:30', lunchStart: '12:00', lunchEnd: '13:30', end: '17:00', extra: '' },
  { day: 'Thứ 7', enabled: false, start: '07:30', lunchStart: '12:00', lunchEnd: '', end: '', extra: '20' },
  { day: 'Chủ nhật', enabled: false, start: 'Nghỉ cả ngày', lunchStart: '', lunchEnd: '', end: '', extra: '0' },
];

const smartRules = [
  { title: 'Chống trùng lịch bác sĩ', copy: 'Không cho phép 2 lịch trùng thời gian', icon: CalendarCheck2, tone: 'blue', enabled: true },
  { title: 'Cảnh báo quá tải', copy: 'Cảnh báo khi vượt quá 85% sức chứa', icon: Gauge, tone: 'red', enabled: true },
  { title: 'Khóa phòng khi quá tải', copy: 'Tự động khóa khi vượt quá 120%', icon: LockKeyhole, tone: 'amber', enabled: true },
  { title: 'Ưu tiên bệnh nhân tái khám', copy: 'Dành slot ưu tiên cho BN tái khám', icon: History, tone: 'orange', enabled: true },
  { title: 'Giới hạn no-show', copy: 'Cảnh báo khi no-show > 8%', icon: Info, tone: 'cyan', enabled: true },
];

const previewRows = [
  { time: '07:30', capacity: '24/30 (80%)', dots: ['green', 'green', 'green', 'green', 'green'] },
  { time: '07:45', capacity: '22/30 (73%)', dots: ['green', 'green', 'green', 'orange', 'gray'] },
  { time: '08:00', capacity: '28/30 (93%)', dots: ['orange', 'orange', 'orange', 'orange', 'gray'] },
  { time: '08:15', capacity: '27/30 (90%)', dots: ['orange', 'orange', 'orange', 'gray', 'gray'] },
  { time: '...', capacity: '...', dots: ['gray', 'gray', 'gray', 'gray', 'gray'] },
  { time: '11:45', capacity: '20/30 (67%)', dots: ['green', 'green', 'green', 'green', 'green'] },
  { time: '12:00 - 13:30', capacity: 'Nghỉ trưa', isBreak: true, dots: [] },
  { time: '13:30', capacity: '21/30 (70%)', dots: ['green', 'green', 'green', 'gray', 'gray'] },
  { time: '13:45', capacity: '19/30 (63%)', dots: ['green', 'green', 'green', 'gray', 'gray'] },
];

const templates = [
  { name: 'Mẫu tiêu chuẩn', icon: CalendarDays, tone: 'blue', status: 'Đang dùng', departments: '6 khoa', doctors: '28 bác sĩ', updated: '30/05/2025' },
  { name: 'Mẫu cuối tuần', icon: Clock3, tone: 'violet', status: 'Đang dùng', departments: '3 khoa', doctors: '12 bác sĩ', updated: '28/05/2025' },
  { name: 'Mẫu VIP', icon: Flame, tone: 'amber', status: 'Đang dùng', departments: '2 khoa', doctors: '6 bác sĩ', updated: '27/05/2025' },
  { name: 'Mẫu Telehealth', icon: Video, tone: 'green', status: 'Đang dùng', departments: '4 khoa', doctors: '18 bác sĩ', updated: '29/05/2025' },
  { name: 'Mẫu Nhi khoa', icon: UsersRound, tone: 'rose', status: 'Dự phòng', departments: '1 khoa', doctors: '8 bác sĩ', updated: '26/05/2025' },
];

const templateRows = [
  ['Mẫu tiêu chuẩn', '6 khoa, 28 bác sĩ', '48', '15 phút', 'Đang dùng', '30/05/2025 09:15'],
  ['Mẫu cuối tuần', '3 khoa, 12 bác sĩ', '24', '15 phút', 'Đang dùng', '28/05/2025 14:20'],
  ['Mẫu VIP', '2 khoa, 6 bác sĩ', '36', '20 phút', 'Đang dùng', '27/05/2025 10:05'],
  ['Mẫu Telehealth', '4 khoa, 18 bác sĩ', '40', '15 phút', 'Đang dùng', '29/05/2025 16:45'],
  ['Mẫu Nhi khoa', '1 khoa, 8 bác sĩ', '32', '15 phút', 'Dự phòng', '26/05/2025 11:30'],
];

const recentChanges = [
  ['Nguyễn Văn An', 'Admin', 'Cập nhật khung giờ Thứ 7', '30/05/2025 09:15'],
  ['Trần Thị Bình', 'Quản lý', 'Điều chỉnh giới hạn overbook', '29/05/2025 16:45'],
  ['Lê Minh Cường', 'Quản trị hệ thống', 'Thêm quy tắc cảnh báo quá tải', '29/05/2025 10:20'],
  ['Phạm Thu Hà', 'Quản lý lịch', 'Cập nhật mẫu cuối tuần', '28/05/2025 14:20'],
];

const aiRecommendations = [
  { title: 'Tăng thời lượng slot lên 20 phút', copy: 'vào khung giờ 08:00 - 11:00 để giảm quá tải.', icon: Clock3 },
  { title: 'Bật ưu tiên tái khám vào buổi chiều Thứ 2 - Thứ 6', copy: 'để tăng hiệu suất 8%.', icon: History },
  { title: 'Giảm overbook còn 15%', copy: 'để hạn chế rủi ro no-show.', icon: Gauge },
];

const templateMetrics = [
  { label: 'Tổng số mẫu', value: '48', delta: '+12 so với tháng trước', icon: CalendarDays, tone: 'blue', series: [32, 28, 31, 36, 34, 40, 37, 39, 35, 33, 38, 34] },
  { label: 'Mẫu đang áp dụng', value: '28', delta: '+8 so với tháng trước', icon: CheckCircle2, tone: 'green', series: [20, 19, 21, 28, 23, 24, 19, 28, 31, 30, 24, 22] },
  { label: 'Mẫu nháp', value: '12', delta: '-2 so với tháng trước', icon: SlidersHorizontal, tone: 'violet', series: [12, 17, 20, 21, 19, 13, 15, 20, 22, 19, 17, 18] },
  { label: 'Mẫu theo khoa', value: '22', delta: '+6 so với tháng trước', icon: BriefcaseMedical, tone: 'amber', series: [16, 18, 16, 28, 19, 24, 30, 22, 27, 18, 21, 25] },
  { label: 'Mẫu theo bác sĩ', value: '18', delta: '+5 so với tháng trước', icon: UsersRound, tone: 'rose', series: [13, 12, 16, 19, 18, 15, 13, 20, 22, 15, 18, 14] },
  { label: 'Tỉ lệ tái sử dụng', value: '76%', delta: '+9% so với tháng trước', icon: RefreshCcw, tone: 'cyan', series: [24, 22, 27, 31, 28, 30, 26, 29, 25, 28, 27, 31] },
];

const templateLibrary = [
  { name: 'Mẫu tiêu chuẩn', icon: CalendarDays, tone: 'blue', status: 'Đang dùng', scope: 'Toàn hệ thống', slots: 16, duration: '30 phút / slot', hours: '07:30 - 17:00', breakTime: 'Có nghỉ trưa', telehealth: 'Tắt', fill: 85, favorite: true },
  { name: 'Mẫu cuối tuần', icon: CalendarCheck2, tone: 'sky', status: 'Đang dùng', scope: 'Toàn hệ thống', slots: 10, duration: '30 phút / slot', hours: '07:30 - 12:00', breakTime: 'Không nghỉ trưa', telehealth: 'Tắt', fill: 62 },
  { name: 'Mẫu VIP', icon: Sparkles, tone: 'violet', status: 'Nháp', scope: 'Khoa Khám bệnh', slots: 20, duration: '30 phút / slot', hours: '07:00 - 17:30', breakTime: 'Có nghỉ trưa', telehealth: 'Tắt', fill: 90 },
  { name: 'Mẫu Telehealth', icon: Video, tone: 'cyan', status: 'Đang dùng', scope: 'Toàn hệ thống', slots: 12, duration: '30 phút / slot', hours: '08:00 - 17:00', breakTime: 'Có nghỉ trưa', telehealth: 'Bật', fill: 78 },
  { name: 'Mẫu Nhi khoa', icon: UsersRound, tone: 'rose', status: 'Đang dùng', scope: 'Khoa Nhi', slots: 14, duration: '30 phút / slot', hours: '07:30 - 16:30', breakTime: 'Có nghỉ trưa', telehealth: 'Tắt', fill: 74 },
  { name: 'Mẫu Ngoại trú chiều', icon: BriefcaseMedical, tone: 'amber', status: 'Tạm dừng', scope: 'Khoa Ngoại', slots: 12, duration: '30 phút / slot', hours: '12:00 - 17:00', breakTime: 'Không nghỉ trưa', telehealth: 'Tắt', fill: 49 },
  { name: 'Mẫu Sản phụ khoa', icon: UsersRound, tone: 'pink', status: 'Nháp', scope: 'Khoa Nhi', slots: 12, duration: '30 phút / slot', hours: '07:00 - 17:30', breakTime: 'Có nghỉ trưa', telehealth: 'Tắt', fill: 65 },
  { name: 'Mẫu Khám sức khỏe', icon: Gauge, tone: 'green', status: 'Nháp', scope: 'Khoa Khám bệnh', slots: 18, duration: '30 phút / slot', hours: '07:30 - 17:00', breakTime: 'Có nghỉ trưa', telehealth: 'Tắt', fill: 65 },
];

const templateDashboardRows = [
  ['Mẫu tiêu chuẩn', 'Chuẩn', 'Toàn hệ thống', '16', '30 phút', '07:30 - 17:00', 'Tắt', 'Đang dùng', '02/06/2025 14:32', 'Admin'],
  ['Mẫu cuối tuần', 'Chuẩn', 'Toàn hệ thống', '10', '30 phút', '07:30 - 12:00', 'Tắt', 'Đang dùng', '30/05/2025 09:15', 'Nguyễn Văn A'],
  ['Mẫu VIP', 'Đặc biệt', 'Khoa Khám bệnh', '20', '30 phút', '07:00 - 17:30', 'Tắt', 'Nháp', '01/06/2025 11:20', 'Trần Thị B'],
  ['Mẫu Telehealth', 'Telehealth', 'Toàn hệ thống', '12', '30 phút', '08:00 - 17:00', 'Bật', 'Đang dùng', '31/05/2025 16:45', 'Lê Minh C'],
  ['Mẫu Nhi khoa', 'Chuyên khoa', 'Khoa Nhi', '14', '30 phút', '07:30 - 16:30', 'Tắt', 'Đang dùng', '29/05/2025 10:05', 'Phạm Thu D'],
];

const templateTimeline = [
  { time: '07:30 - 09:00', label: '4 / 4 slot', type: 'green', width: 96 },
  { time: '09:00 - 10:30', label: '3 / 4 slot', type: 'blue', width: 78 },
  { time: '10:30 - 12:00', label: '1 / 4 slot', type: 'orange', width: 62 },
  { time: '12:00 - 13:00', label: 'Nghỉ trưa', type: 'break', width: 100 },
  { time: '13:00 - 14:30', label: '3 / 4 slot', type: 'blue', width: 80 },
  { time: '14:30 - 16:00', label: '2 / 4 slot', type: 'orange', width: 66 },
  { time: '16:00 - 17:00', label: '2 / 2 slot', type: 'cyan', width: 58 },
];

const templateSuggestionRules = [
  'Ưu tiên bác sĩ VIP',
  'Giới hạn bệnh nhân / slot',
  'Nghỉ trưa',
  'Tự động khóa slot đầy',
  'Cho phép overbook',
  'Tự động bố lịch',
];

const templateChangeHistory = [
  ['02/06/2025 14:32', 'Admin', 'Cập nhật thời gian làm việc của mẫu “Mẫu tiêu chuẩn”'],
  ['01/06/2025 11:20', 'Trần Thị B', 'Tạo mới nháp “Mẫu VIP”'],
  ['31/05/2025 16:45', 'Lê Minh C', 'Bật Telehealth cho “Mẫu Telehealth”'],
  ['30/05/2025 09:15', 'Nguyễn Văn A', 'Cập nhật số slot của “Mẫu cuối tuần”'],
];

const templateAiRecommendations = [
  { title: 'Tăng slot buổi sáng (07:30 - 10:30)', copy: 'ở Khoa Khám bệnh để giảm thời gian chờ.', icon: Clock3 },
  { title: 'Tạo mẫu riêng cho Telehealth', copy: 'với khung giờ linh hoạt hơn.', icon: Video },
  { title: 'Giảm overbook từ 10% xuống 5%', copy: 'ở Khoa Ngoại để giảm rủi ro trễ giờ.', icon: Gauge },
];

const policyMetrics = [
  { label: 'Tổng số quy tắc', value: '68', delta: '+8 so với tuần trước', icon: CalendarDays, tone: 'blue', series: [18, 18, 19, 23, 21, 30, 20, 29, 21, 19, 20, 22] },
  { label: 'Quy tắc đang hoạt động', value: '61', delta: '89.7% tổng số', icon: ShieldCheck, tone: 'green', series: [34, 34, 36, 38, 35, 37, 36, 42, 38, 48, 44, 55] },
  { label: 'Xung đột được chỉnh', value: '1.248', delta: '+15% so với tuần trước', icon: Shuffle, tone: 'violet', series: [22, 24, 28, 25, 30, 23, 35, 27, 38, 29, 32, 40] },
  { label: 'Tỷ lệ vi phạm', value: '3.6%', delta: '-0.8% so với tuần trước', icon: Gauge, tone: 'amber', series: [28, 18, 38, 30, 20, 25, 18, 24, 21, 36, 22, 19] },
  { label: 'Chính sách hủy', value: 'Đang bật', delta: '8 quy tắc áp dụng', icon: RefreshCcw, tone: 'cyan', series: [20, 18, 31, 20, 28, 19, 22, 18, 30, 24, 22, 20] },
  { label: 'Quy tắc overbooking', value: 'Đang bật', delta: '8 quy tắc áp dụng', icon: Flame, tone: 'green', series: [18, 28, 40, 30, 22, 28, 36, 24, 32, 22, 39, 21] },
  { label: 'Quy tắc ưu tiên', value: 'Đang bật', delta: '5 cấp độ ưu tiên', icon: Sparkles, tone: 'rose', series: [20, 30, 22, 38, 28, 24, 36, 18, 40, 21, 27, 36] },
  { label: 'Cảnh báo cần rà soát', value: '7', delta: '+3 so với tuần trước', icon: Info, tone: 'orange', series: [18, 22, 38, 24, 20, 23, 18, 34, 24, 29, 18, 21] },
];

const policyTabs = [
  { label: 'Tổng quát', icon: CalendarCheck2 },
  { label: 'Đặt lịch', icon: CalendarDays },
  { label: 'Hủy / Đổi lịch', icon: RefreshCcw },
  { label: 'Xung đột', icon: Shuffle },
  { label: 'Overbooking', icon: Flame },
  { label: 'Ưu tiên', icon: Sparkles },
  { label: 'Phê duyệt', icon: CheckCircle2 },
  { label: 'Chính sách nâng cao', icon: ShieldCheck, active: true },
];

const bookingPolicyRules = [
  ['Giới hạn đặt trước', 'Cho phép đặt trước tối đa 30 ngày', 'Tất cả khoa', 'Cao', true],
  ['Giới hạn số lịch / bệnh nhân / ngày', 'Tối đa 5 lịch / bệnh nhân / ngày', 'Tất cả khoa', 'Cao', true],
  ['Yêu cầu chọn bác sĩ theo khoa', 'Bắt buộc chọn bác sĩ thuộc khoa', 'Ngoại trú', 'Trung bình', true],
  ['Chặn trùng giờ bác sĩ', 'Không cho phép 2 lịch trùng giờ', 'Tất cả bác sĩ', 'Cao', true],
  ['Thời gian đệm giữa 2 slot', 'Tối thiểu 15 phút giữa 2 lịch', 'Tất cả khoa', 'Trung bình', true],
  ['Khóa đặt lịch sát giờ khám', 'Khóa trước 60 phút so với giờ khám', 'Ngoại trú', 'Cao', true],
  ['Giới hạn đặt ngoài giờ', 'Không cho phép ngoài 17:00', 'Tất cả khoa', 'Thấp', true],
];

const cancellationPolicies = [
  ['Thời gian tối thiểu được phép hủy', '60 phút', 'Trước giờ khám'],
  ['Số lần đổi lịch tối đa / tháng', '3 lần / tháng', ''],
  ['Phí hủy sát giờ', '50.000 VND', 'Nếu hủy < 60 phút'],
  ['Cảnh báo nhắc nhở', '24h, 2h, 30p', 'Trước giờ khám'],
  ['Chính sách với lịch VIP', 'Miễn phí hủy', 'Không tính phí'],
  ['Chính sách No-show', 'Tính phí 100%', 'Nếu không đến'],
  ['Tự động nhả slot', '15 phút', 'Sau giờ bắt đầu'],
  ['Waitlist fill tự động', '10 phút', 'Sau khi nhả slot'],
];

const policyImpactRows = [
  { time: '07:00 - 08:00', stats: '18 / 20 slot', dots: ['green', 'green', 'green', 'green', 'orange', 'gray'] },
  { time: '08:00 - 09:00', stats: '19 / 20 slot', dots: ['green', 'green', 'green', 'green', 'green', 'orange'] },
  { time: '09:00 - 10:00', stats: '16 / 20 slot', dots: ['orange', 'orange', 'orange', 'green', 'gray', 'gray'] },
  { time: '10:00 - 12:00', stats: '14 / 20 slot', dots: ['red', 'red', 'orange', 'orange', 'gray', 'gray'] },
  { time: '11:00 - 12:00', stats: '12 / 20 slot', dots: ['red', 'red', 'red', 'gray', 'gray', 'gray'] },
  { time: '13:30 - 14:30', stats: '17 / 20 slot', dots: ['green', 'green', 'green', 'orange', 'gray', 'gray'] },
  { time: '14:30 - 15:30', stats: '15 / 20 slot', dots: ['green', 'green', 'green', 'green', 'gray', 'gray'] },
  { time: '15:30 - 16:30', stats: '10 / 20 slot', dots: ['orange', 'orange', 'gray', 'gray', 'gray', 'gray'] },
  { time: '16:30 - 17:00', stats: '6 / 20 slot', dots: ['red', 'red', 'gray', 'gray', 'gray', 'gray'] },
];

const policyRuleRows = [
  ['Giới hạn đặt trước 30 ngày', 'Đặt lịch', 'Tất cả khoa', 'Cao', 'Đang hoạt động', '02/06/2025 09:15', 'Admin'],
  ['Chặn trùng giờ bác sĩ', 'Xung đột', 'Tất cả bác sĩ', 'Cao', 'Đang hoạt động', '01/06/2025 16:40', 'Nguyễn Văn An'],
  ['Thời gian đệm 15 phút', 'Đặt lịch', 'Tất cả khoa', 'Trung bình', 'Đang hoạt động', '30/05/2025 11:20', 'Lê Minh Cường'],
  ['Chính sách hủy 60 phút', 'Hủy / Đổi lịch', 'Ngoại trú', 'Cao', 'Đang hoạt động', '28/05/2025 14:05', 'Trần Thị Bình'],
  ['Overbooking tối đa 120%', 'Overbooking', 'Khoa Sản', 'Trung bình', 'Đang hoạt động', '28/05/2025 10:05', 'Phạm Thu Hà'],
  ['Ưu tiên cấp VIP', 'Ưu tiên', 'Nội trú, VIP', 'Cao', 'Đang hoạt động', '27/05/2025 10:12', 'Admin'],
  ['Khóa đặt lịch 60 phút', 'Đặt lịch', 'Ngoại trú', 'Cao', 'Đang hoạt động', '26/05/2025 08:50', 'Nguyễn Văn An'],
];

const approvalFlow = [
  ['Lễ tân', 'Tạo và gửi yêu cầu lịch'],
  ['Điều phối', 'Kiểm tra & xác nhận lịch'],
  ['Trưởng khoa', 'Phê duyệt cuối cùng'],
  ['Áp dụng tự động', 'Áp dụng theo quy tắc'],
];

const conflictChecks = [
  ['Xung đột bác sĩ', '3', 'Vấn đề', 'red'],
  ['Trùng phòng / thiết bị', '1', 'Cảnh báo', 'orange'],
  ['Vượt overbooking', '2', 'Cảnh báo', 'orange'],
  ['Vi phạm thời gian hủy', '5', 'Vấn đề', 'red'],
  ['Vượt giới hạn đặt trước', '0', 'Hợp lệ', 'green'],
  ['Vượt số lịch / bệnh nhân', '0', 'Hợp lệ', 'green'],
];

const conflictHeatmap = [
  ['BS. An', 'red', 'orange', 'gray', 'green', 'gray', 'red', 'green'],
  ['BS. Bình', 'orange', 'gray', 'orange', 'gray', 'red', 'gray', 'gray'],
  ['BS. Cường', 'gray', 'green', 'gray', 'orange', 'gray', 'green', 'orange'],
  ['BS. Dung', 'gray', 'gray', 'green', 'gray', 'gray', 'orange', 'gray'],
  ['BS. Hà', 'green', 'gray', 'gray', 'green', 'orange', 'gray', 'gray'],
];

const policyAiRecommendations = [
  { title: 'Giảm thời gian đệm xuống 10 phút', copy: 'Tăng 8% số slot trống.', icon: Clock3 },
  { title: 'Tăng overbooking Khoa Sản lên 130%', copy: 'Tối ưu hóa thời gian trống.', icon: Flame },
  { title: 'Thêm waitlist fill sau 5 phút', copy: 'Tăng tỷ lệ lấp đầy slot.', icon: RefreshCcw },
  { title: 'Điều chỉnh giờ khóa đặt lịch 45 phút', copy: 'Giảm hủy sát giờ 12%.', icon: AlarmClock },
  { title: 'Gộp lịch định kỳ theo ngày cố định', copy: 'Giảm xung đột lịch lặp lại.', icon: CalendarClock },
];

const policyRecentChanges = [
  ['Admin', 'Cập nhật quy tắc “Giới hạn đặt trước 30 ngày”'],
  ['Nguyễn Văn An', 'Bật quy tắc “Chặn trùng giờ bác sĩ”'],
  ['Trần Thị Bình', 'Chỉnh sửa chính sách hủy 60 phút'],
  ['Lê Minh Cường', 'Cập nhật thời gian đệm 15 phút'],
  ['Admin', 'Áp dụng cấu hình hàng loạt'],
];

const exceptionMetrics = [
  { label: 'Tổng ngoại lệ đang dùng', value: '128', delta: '+18% so với tháng trước', icon: CalendarDays, tone: 'violet', series: [22, 24, 21, 30, 24, 34, 28, 32, 26, 36, 30, 35] },
  { label: 'Ngày nghỉ lễ cấu hình', value: '16', delta: '+2 ngày so với tháng trước', icon: CalendarCheck2, tone: 'green', series: [16, 17, 16, 20, 18, 26, 19, 24, 20, 25, 22, 28] },
  { label: 'Ca nghỉ cá nhân', value: '346', delta: '+24 ca so với tháng trước', icon: UsersRound, tone: 'blue', series: [42, 48, 44, 60, 72, 50, 64, 58, 70, 54, 62, 48] },
  { label: 'Ngoại lệ theo khoa', value: '42', delta: '+6 so với tháng trước', icon: BriefcaseMedical, tone: 'amber', series: [20, 28, 24, 36, 29, 22, 30, 26, 20, 31, 24, 22] },
  { label: 'Phòng tạm khóa', value: '18', delta: '-3 so với tháng trước', icon: LockKeyhole, tone: 'cyan', series: [18, 24, 20, 30, 22, 28, 20, 34, 24, 30, 22, 21] },
  { label: 'Quy tắc lặp lại', value: '27', delta: '+5 so với tháng trước', icon: RefreshCcw, tone: 'purple', series: [14, 22, 18, 30, 20, 34, 24, 28, 20, 30, 31, 36] },
  { label: 'Yêu cầu chờ duyệt', value: '23', delta: '-4 so với tháng trước', icon: Clock3, tone: 'orange', series: [24, 38, 22, 34, 25, 24, 31, 26, 35, 24, 28, 30] },
  { label: 'Xung đột ngoại lệ', value: '7', delta: '-2 so với tháng trước', icon: Info, tone: 'red', series: [18, 20, 16, 26, 18, 30, 20, 25, 19, 27, 20, 18] },
];

const exceptionTabs = [
  { label: 'Tổng quan', icon: Shuffle, active: true },
  { label: 'Nghỉ lễ', icon: CalendarDays },
  { label: 'Nghỉ cá nhân', icon: UsersRound },
  { label: 'Ngoại lệ phòng/khoa', icon: BriefcaseMedical },
  { label: 'Sự kiện đặc biệt', icon: Sparkles },
  { label: 'Phê duyệt', icon: CheckCircle2, badge: '23' },
  { label: 'Đồng bộ', icon: RefreshCcw },
];

const exceptionCalendarWeeks = [
  ['26', '27', '28', '29', '30', '31', '1'],
  ['2', '3', '4', '5', '6', '7', '8'],
  ['9', '10', '11', '12', '13', '14', '15'],
  ['16', '17', '18', '19', '20', '21', '22'],
  ['23', '24', '25', '26', '27', '28', '29'],
  ['30', '1', '2', '3', '4', '5', '6'],
];

const exceptionCalendarMarks = {
  5: 'holiday',
  12: 'pending',
  19: 'maintenance',
  20: 'personal',
  21: 'lock',
  22: 'holiday',
};

const exceptionSyncSources = [
  ['Ngày nghỉ quốc gia', 'Đồng bộ tự động', 'Bật', true, 'holiday'],
  ['Ngày nghỉ bệnh viện', 'Cấu hình thủ công', 'Bật', true, 'hospital'],
  ['Import từ Excel', 'Cập nhật thủ công', 'Tắt', false, 'excel'],
  ['Đồng bộ HR (Nghỉ phép)', 'Kết nối với HRM', 'Bật', true, 'hr'],
  ['Google Calendar / ICS', 'Đồng bộ 2 chiều', 'Bật', true, 'google'],
];

const exceptionFilters = ['Tất cả', 'Nghỉ lễ', 'Nghỉ bác sĩ', 'Nghỉ khoa', 'Phòng bảo trì', 'Khóa slot', 'Chờ duyệt'];

const exceptionRows = [
  ['Tết Dương lịch 2025', 'Nghỉ lễ', 'Toàn bệnh viện', '01/01/2025', 'Hằng năm', 'Đã duyệt', 'Nguyễn Văn A', '20/12/2024 10:30'],
  ['Nghỉ phép BS. Trần Minh Hải', 'Nghỉ cá nhân', 'BS. Trần Minh Hải', '05/06/2025 - 07/06/2025', 'Không lặp lại', 'Đã duyệt', 'Phạm Thị B', '28/05/2025 14:22'],
  ['Khoa Nhi - Đào tạo nội bộ', 'Ngoại lệ khoa', 'Khoa Nhi', '12/06/2025', 'Không lặp lại', 'Chờ duyệt', '-', '30/05/2025 09:15'],
  ['Phòng 201 - Bảo trì máy lạnh', 'Bảo trì phòng', 'Phòng 201', '19/06/2025', 'Không lặp lại', 'Đã duyệt', 'Lê Văn C', '27/05/2025 16:40'],
  ['Hội nghị tim mạch miền Bắc', 'Sự kiện đặc biệt', 'TT Tim mạch', '20/06/2025 - 21/06/2025', 'Không lặp lại', 'Đã duyệt', 'Nguyễn Văn A', '25/05/2025 11:02'],
  ['Giờ giới nghiêm 22:00 - 06:00', 'Khóa slot', 'Toàn bệnh viện', '01/06/2025 - 30/06/2025', 'Hằng ngày', 'Đã duyệt', 'Hệ thống', '15/05/2025 08:00'],
];

const exceptionApprovalFlow = [
  ['Lễ tân', 'Tiếp nhận yêu cầu'],
  ['Điều phối', 'Kiểm tra đề xuất'],
  ['Trưởng khoa', 'Xem xét & phê duyệt'],
  ['Quản trị', 'Phê duyệt cuối cùng'],
];

const exceptionWarnings = [
  ['7 xung đột ngoại lệ cần xử lý', 'Xem chi tiết'],
  ['23 yêu cầu chờ phê duyệt', 'Xem ngay'],
  ['3 phòng sắp đến hạn bảo trì', 'Xem lịch'],
  ['2 nguồn đồng bộ đang lỗi', 'Kiểm tra'],
];

const exceptionCategoryStats = [
  ['Nghỉ lễ', 16, '12.5%', 'rose'],
  ['Nghỉ cá nhân', 46, '35.9%', 'blue'],
  ['Ngoại lệ khoa', 18, '14.1%', 'amber'],
  ['Bảo trì phòng', 12, '9.4%', 'violet'],
  ['Khóa slot', 24, '18.8%', 'green'],
  ['Sự kiện đặc biệt', 12, '9.4%', 'cyan'],
];

const exceptionHeatmapRows = [
  ['00-04', 1, 1, 1, 1, 2, 2, 1],
  ['04-08', 1, 2, 2, 2, 3, 3, 2],
  ['08-12', 2, 3, 4, 4, 5, 5, 4],
  ['12-16', 2, 3, 4, 5, 5, 5, 4],
  ['16-20', 3, 4, 5, 5, 5, 4, 3],
  ['20-24', 2, 3, 4, 4, 4, 3, 2],
];

const exceptionRecentChanges = [
  ['Phạm Thị B', 'Cập nhật nghỉ BS. Trần Minh Hải', '28/05/2025 14:22'],
  ['Lê Văn C', 'Tạo ngoại lệ bảo trì phòng 201', '27/05/2025 16:40'],
  ['Nguyễn Văn A', 'Phê duyệt Tết Dương lịch 2025', '20/12/2024 10:30'],
];

const exceptionAiRecommendations = [
  { title: 'Gộp 3 ngoại lệ trùng lặp', copy: 'Giảm xung đột đồng bộ nội bộ.', icon: Shuffle },
  { title: 'Đề xuất khóa slot ban đêm', copy: 'Tăng tỷ lệ giữ lịch lên 2.3%.', icon: LockKeyhole },
  { title: 'Tối ưu phân bổ bác sĩ', copy: 'Giảm 12% ca trống tuần sau.', icon: UsersRound },
];

const telehealthMetrics = [
  { label: 'Kênh Telehealth', value: '4', delta: '+2 so với tuần trước', icon: Video, tone: 'blue', series: [18, 22, 31, 20, 17, 24, 21, 29, 20, 24, 18, 20] },
  { label: 'Mẫu online đang dùng', value: '6', delta: '+1 so với tuần trước', icon: CalendarDays, tone: 'violet', series: [16, 30, 22, 34, 28, 29, 24, 31, 26, 27, 24, 28] },
  { label: 'Slot online mặc định', value: '48', delta: '+8 so với tuần trước', icon: AlarmClock, tone: 'sky', series: [20, 28, 35, 29, 22, 30, 25, 33, 24, 31, 20, 27] },
  { label: 'Tỷ lệ lấp đầy online', value: '82%', delta: '+9% so với tuần trước', icon: Target, tone: 'green', series: [38, 40, 45, 52, 48, 55, 60, 58, 64, 62, 68, 70] },
  { label: 'Tỷ lệ no-show online', value: '8%', delta: '-2% so với tuần trước', icon: UsersRound, tone: 'rose', series: [26, 18, 30, 21, 34, 18, 22, 20, 24, 18, 21, 19] },
  { label: 'Tỷ lệ xác nhận tự động', value: '76%', delta: '+6% so với tuần trước', icon: CheckCircle2, tone: 'cyan', series: [25, 31, 27, 36, 30, 42, 34, 39, 35, 43, 40, 46] },
  { label: 'Thời gian chờ phòng đợi', value: '6.2 phút', delta: '-0.8 phút so với tuần trước', icon: Clock3, tone: 'orange', series: [18, 34, 40, 25, 19, 24, 22, 20, 25, 21, 19, 18] },
  { label: 'Số cảnh báo cấu hình', value: '3', delta: '-2 so với tuần trước', icon: Info, tone: 'amber', series: [18, 30, 20, 35, 18, 28, 21, 32, 20, 18, 22, 20] },
];

const telehealthTabs = [
  { label: 'Tổng quan', icon: Video, active: true },
  { label: 'Kênh kết nối', icon: Waves },
  { label: 'Slot online', icon: Clock3 },
  { label: 'Check-in', icon: CheckCircle2 },
  { label: 'Nhắc hẹn', icon: Bell },
  { label: 'Thanh toán', icon: FileText },
  { label: 'Bảo mật', icon: ShieldCheck },
  { label: 'Nâng cao', icon: Settings },
];

const telehealthChannels = [
  ['Zoom', 'OAuth 2.0', 'medi-hoabinh@zoom.us', true, true, 'Đang bật', Video],
  ['Google Meet', 'Google Workspace', 'meet@hoabinh-hospital.vn', true, true, 'Đang bật', CalendarCheck2],
  ['WebRTC nội bộ', 'Nội bộ (WebRTC)', 'webrtc.hoabinh.vn', true, true, 'Đang bật', Waves],
  ['Microsoft Teams', 'Azure AD', 'telehealth@hoabinh.vn', false, true, 'Tắt', UsersRound],
];

const telehealthSmartRules = [
  { title: 'Chống trùng link', copy: 'Không cho phép 2 lịch trùng link', icon: ShieldCheck, tone: 'blue' },
  { title: 'Khóa link sau giờ khám', copy: 'Tự khóa link sau khi kết thúc', icon: LockKeyhole, tone: 'cyan' },
  { title: 'Cảnh báo đường truyền yếu', copy: 'Cảnh báo khi chất lượng < 70%', icon: Gauge, tone: 'amber' },
  { title: 'Ưu tiên BS đã xác thực', copy: 'Chỉ cho phép BS đã xác thực Telehealth', icon: CheckCircle2, tone: 'violet' },
  { title: 'Yêu cầu BN xác nhận trước', copy: 'BN xác nhận trước 2 giờ khám', icon: UsersRound, tone: 'rose' },
];

const telehealthPreviewRows = [
  { time: '07:30 - 08:00', stats: '4 / 4 slot', dots: ['green', 'green', 'green', 'green', 'cyan', 'gray'] },
  { time: '08:00 - 09:00', stats: '3 / 4 slot', dots: ['green', 'green', 'cyan', 'blue', 'gray', 'gray'] },
  { time: '09:00 - 10:00', stats: '2 / 4 slot', dots: ['orange', 'orange', 'blue', 'gray', 'gray', 'gray'] },
  { time: '10:00 - 11:00', stats: '4 / 4 slot', dots: ['blue', 'blue', 'blue', 'green', 'gray', 'gray'] },
  { time: '11:00 - 12:00', stats: '1 / 4 slot', dots: ['green', 'gray', 'gray', 'gray', 'gray', 'gray'] },
  { time: '13:00 - 14:00', stats: '3 / 4 slot', dots: ['green', 'orange', 'cyan', 'gray', 'gray', 'gray'] },
  { time: '14:00 - 15:00', stats: '2 / 4 slot', dots: ['orange', 'cyan', 'gray', 'gray', 'gray', 'gray'] },
  { time: '15:00 - 16:00', stats: '4 / 4 slot', dots: ['blue', 'blue', 'green', 'cyan', 'gray', 'gray'] },
  { time: '16:00 - 17:00', stats: '2 / 4 slot', dots: ['cyan', 'cyan', 'gray', 'gray', 'gray', 'gray'] },
];

const telehealthTemplates = [
  ['Mẫu Telehealth Chuẩn', 'Toàn hệ thống', '16 slot', '30 phút', '07:30 - 17:00', '15 phút trước giờ', 85, 'Đang dùng'],
  ['Mẫu Tái khám Online', 'Khoa Nội', '10 slot', '20 phút', '07:30 - 12:00', '10 phút trước giờ', 78, 'Đang dùng'],
  ['Mẫu Chuyên khoa Nhi Online', 'Khoa Nhi', '8 slot', '30 phút', '07:30 - 16:30', '15 phút trước giờ', 72, 'Đang dùng'],
  ['Mẫu Tư vấn VIP', 'Toàn bộ', '4 slot', '45 phút', '08:00 - 18:00', '5 phút trước giờ', 73, 'VIP'],
];

const telehealthRows = [
  ['Telehealth Khoa Nội', 'Khoa Nội', 'Zoom', '16', '30 phút', 'SMS + Email', 'Tự động', 'Đang dùng', '02/06/2025 14:32', 'Admin'],
  ['Telehealth Khoa Nhi', 'Khoa Nhi', 'Google Meet', '12', '30 phút', 'SMS', 'Tự động', 'Đang dùng', '31/05/2025 09:15', 'Nguyễn Văn A'],
  ['Tái khám Online - Nội', 'Khoa Nội', 'Google Meet', '10', '20 phút', 'SMS', 'Tự động', 'Đang dùng', '01/06/2025 11:20', 'Trần Thị Bình'],
  ['Chuyên khoa Tim mạch', 'Khoa Tim mạch', 'WebRTC', '8', '30 phút', 'Email', 'Thủ công', 'Đang dùng', '31/05/2025 16:45', 'Lê Minh C'],
  ['Tư vấn VIP', 'Toàn hệ thống', 'Teams', '4', '45 phút', 'SMS + Email', 'Tự động', 'Đang dùng', '29/05/2025 10:05', 'Phạm Thu D'],
  ['Khoa Ngoại - Online', 'Khoa Ngoại', 'Zoom', '10', '30 phút', 'SMS', 'Tự động', 'Tạm dừng', '28/05/2025 14:20', 'Nguyễn Văn A'],
  ['Tư vấn Dinh dưỡng', 'Khoa Dinh dưỡng', 'Google Meet', '6', '20 phút', 'Email', 'Tự động', 'Đang dùng', '27/05/2025 09:30', 'Trần Thị H'],
];

const telehealthCheckinSteps = [
  ['Xác thực bệnh nhân', 'Bắt buộc'],
  ['Kiểm tra camera / mic', 'Bắt buộc'],
  ['Thanh toán', 'Tùy chọn'],
  ['Vào phòng chờ', 'Bắt buộc'],
  ['Bắt đầu khám', 'Bắt buộc'],
];

const telehealthAiRecommendations = [
  { title: 'Tăng thời gian phòng chờ lên 15 phút', copy: 'giúp giảm no-show 12%.', icon: Clock3 },
  { title: 'Bật cảnh báo đường truyền yếu', copy: 'để giảm hủy lịch 6%.', icon: Gauge },
  { title: 'Giảm overbooking từ 20% -> 15%', copy: 'để tăng trải nghiệm BN.', icon: Flame },
];

const telehealthRecentChanges = [
  ['Admin', 'Cập nhật cấu hình Telehealth Khoa Nội', '02/06/2025 14:32'],
  ['Trần Minh Online', 'Bật kênh Google - Nội', '01/06/2025 11:20'],
  ['Lê Minh C', 'Bật kênh WebRTC - Chuyên khoa Tim mạch', '31/05/2025 16:45'],
];

const notificationMetrics = [
  { label: 'Tổng mẫu thông báo', value: '48', delta: '+12 so với tuần trước', icon: Bell, tone: 'blue', series: [20, 25, 34, 24, 20, 30, 27, 36, 28, 30, 24, 32] },
  { label: 'Quy tắc đang hoạt động', value: '32', delta: '+5 so với tuần trước', icon: CalendarDays, tone: 'violet', series: [18, 30, 25, 22, 21, 35, 27, 29, 23, 28, 24, 30] },
  { label: 'Tỷ lệ gửi thành công', value: '98.6%', delta: '+1.8% so với tuần trước', icon: CheckCircle2, tone: 'green', series: [44, 50, 54, 48, 58, 56, 61, 52, 58, 62, 55, 60] },
  { label: 'Tỷ lệ mở / đọc', value: '74.2%', delta: '+3.6% so với tuần trước', icon: FileText, tone: 'cyan', series: [30, 34, 39, 46, 42, 50, 45, 52, 48, 56, 54, 60] },
  { label: 'Nhắc hẹn đã gửi hôm nay', value: '1.248', delta: '+18% so với hôm qua', icon: CalendarClock, tone: 'orange', series: [24, 42, 30, 36, 34, 45, 38, 42, 36, 44, 39, 48] },
  { label: 'Tỷ lệ xác nhận tự động', value: '62.4%', delta: '+4.2% so với tuần trước', icon: Target, tone: 'sky', series: [25, 30, 28, 36, 32, 40, 35, 43, 39, 46, 42, 50] },
  { label: 'Tỷ lệ no-show mục tiêu', value: '8.0%', delta: '-0.6% so với tuần trước', icon: AlarmClock, tone: 'rose', series: [30, 18, 32, 20, 34, 22, 28, 20, 24, 18, 22, 19] },
  { label: 'Số cảnh báo gửi lỗi', value: '6', delta: '-3 so với hôm qua', icon: Info, tone: 'amber', series: [18, 28, 20, 34, 18, 26, 22, 32, 20, 24, 18, 20] },
];

const notificationTabs = [
  { label: 'Tổng quan', icon: Bell, active: true },
  { label: 'Kênh gửi', icon: Waves },
  { label: 'Mẫu thông báo', icon: FileText },
  { label: 'Quy tắc kích hoạt', icon: Settings },
  { label: 'Nhắc hẹn', icon: CalendarClock },
  { label: 'Xác nhận', icon: CheckCircle2 },
  { label: 'Leo thang', icon: Shuffle },
  { label: 'Giờ yên lặng', icon: Clock3 },
  { label: 'Báo cáo', icon: Gauge },
];

const notificationChannels = [
  ['SMS', 'Viettel SMS Gateway', 'Kết nối', '190 SMS/phút', '3 lần', true],
  ['Email', 'Amazon SES', 'Kết nối', '300 Email/phút', '3 lần', true],
  ['Ứng dụng di động', 'Firebase Cloud Messaging', 'Kết nối', '1.200 push/phút', '5 lần', true],
  ['Zalo OA', 'Zalo Official Account', 'Kết nối', '150 tin/phút', '3 lần', true],
  ['Cuộc gọi tự động', 'VNS Auto Call', 'Cảnh báo', '60 cuộc gọi/phút', '2 lần', true],
  ['Web push', 'OneSignal', 'Kết nối', '800 push/phút', '5 lần', true],
];

const notificationDefaultRules = [
  ['Nhắc trước 24 giờ', '24', 'giờ', 'SMS, App, Email', true],
  ['Nhắc trước 2 giờ', '2', 'giờ', 'SMS, App', true],
  ['Nhắc trước 30 phút', '30', 'phút', 'App Push', true],
  ['Tự gửi xác nhận sau khi đặt lịch', 'Ngay lập tức', '', '', true],
  ['Gửi lại khi chưa phản hồi sau', '6', 'giờ', 'SMS, Email', true],
  ['Số lần gửi lại tối đa', '2', 'lần', '', true],
  ['Kênh ưu tiên (theo thứ tự)', '1 SMS, 2 Ứng dụng, 3 Email', '', '', true],
  ['Chỉ gửi khi lịch ở trạng thái', 'Đã xác nhận', '', '', true],
  ['Tự dừng sau khi bệnh nhân xác nhận', '', '', '', true],
  ['Gửi thông báo đổi lịch / hủy lịch / một slot mới', 'Tất cả', '', '', true],
  ['Chặn gửi ngoài giờ yên lặng', 'Có', '', '', true],
  ['Ngôn ngữ mặc định', 'Tiếng Việt', 'Đa ngôn ngữ', 'Đa ngôn ngữ', true],
];

const notificationFlowRows = [
  ['Sau đặt lịch', 'Gửi xác nhận đặt lịch', ['sms', 'app', 'email'], 'Đã gửi'],
  ['- 24 giờ', 'Nhắc hẹn 24 giờ', ['sms', 'app', 'email'], 'Đã gửi'],
  ['- 2 giờ', 'Nhắc hẹn 2 giờ', ['sms', 'app'], 'Chờ gửi'],
  ['- 30 phút', 'Nhắc hẹn 30 phút', ['app'], 'Chờ gửi'],
  ['Khi đổi lịch', 'Thông báo đổi lịch', ['sms', 'email'], 'Chờ gửi'],
  ['Khi hủy lịch', 'Thông báo hủy lịch', ['sms', 'email'], 'Chờ gửi'],
  ['Mỗi slot mới', 'Thông báo slot mới', ['app'], 'Chờ gửi'],
];

const notificationTemplates = [
  ['Nhắc hẹn tiêu chuẩn', 'Toàn hệ thống', ['SMS', 'App', 'Email'], 92, '02/06/2025', Bell],
  ['Xác nhận đặt lịch', 'Toàn hệ thống', ['SMS', 'Email', 'App'], 95, '30/05/2025', CheckCircle2],
  ['Thông báo đổi lịch', 'Toàn hệ thống', ['SMS', 'Email', 'App'], 90, '28/05/2025', CalendarDays],
  ['Thông báo hủy lịch', 'Toàn hệ thống', ['SMS', 'Email', 'App'], 89, '28/05/2025', RotateCcw],
  ['Nhắc tái khám', 'Khoa Nội tổng hợp', ['SMS', 'App', 'Email'], 88, '01/06/2025', RefreshCcw],
  ['Nhắc telehealth', 'Telehealth', ['SMS', 'App', 'Email'], 90, '01/06/2025', Video],
];

const notificationRuleRows = [
  ['Mặc định toàn hệ thống', 'Toàn hệ thống', 'SMS + App', '7', '2', 'Đang bật', '06/06/2025 14:29', 'Admin'],
  ['Khoa Nội tổng hợp', 'Khoa Nội', 'SMS + Email', '6', '2', 'Đang bật', '05/06/2025 10:15', 'BS. Minh Anh'],
  ['Khoa Nhi', 'Khoa Nhi', 'App Push', '6', '2', 'Đang bật', '05/06/2025 09:40', 'BS. Thùy Vy'],
  ['Khoa Sản', 'Khoa Sản', 'SMS', '6', '2', 'Đang bật', '04/06/2025 16:05', 'BS. Lan Hương'],
  ['Nha khoa', 'Khoa RHM', 'SMS + Email', '5', '1', 'Đang bật', '04/06/2025 11:22', 'BS. Đức Nam'],
  ['Phòng khám VIP', 'Toàn hệ thống', 'SMS + App', '7', '3', 'Đang bật', '03/06/2025 15:30', 'Admin'],
];

const notificationConfirmSteps = [
  ['Gửi mã xác nhận (OTP)', true],
  ['Chờ phản hồi tối đa 2 giờ', true],
  ['Gọi nhắc nếu chưa phản hồi', true],
  ['Báo lễ tân nếu vẫn chưa xác nhận', true],
];

const notificationRecentChanges = [
  ['Admin', 'Cập nhật mẫu “Nhắc hẹn tiêu chuẩn”', '07/06/2025 09:15'],
  ['BS. Minh Anh', 'Tạo quy tắc “Khoa Nội tổng hợp”', '06/06/2025 15:20'],
  ['Admin', 'Bật kênh Cuộc gọi tự động', '06/06/2025 10:10'],
];

const notificationAiRecommendations = [
  { title: 'Tăng thời điểm nhắc 24h lên 30h', copy: 'để giảm no-show dự kiến 4%.', icon: AlarmClock },
  { title: 'Bật tin nhắn giờ chờ “Nhắc lịch theo chuẩn”', copy: 'tăng tỷ lệ mở/đọc lên ~3%.', icon: Bell },
  { title: 'Thiết lập giờ yên lặng cho CN từ 21:00 - 07:00', copy: 'giảm 65% khiếu nại ngoài giờ.', icon: Clock3 },
];

const advancedMetrics = [
  { label: 'Kịch bản tự động', value: '24', delta: '+20% so với tuần trước', icon: Bot, tone: 'blue', series: [18, 34, 22, 42, 28, 36, 24, 40, 32, 28, 24, 30] },
  { label: 'Luồng đồng bộ', value: '12', delta: '+9% so với tuần trước', icon: RefreshCcw, tone: 'violet', series: [18, 30, 28, 34, 26, 22, 31, 24, 34, 29, 24, 20] },
  { label: 'Webhook đang bật', value: '8', delta: '+14% so với tuần trước', icon: Waves, tone: 'green', series: [20, 22, 28, 24, 40, 32, 30, 24, 34, 38, 31, 24] },
  { label: 'Mô phỏng sandbox', value: '36', delta: '+18% so với tuần trước', icon: Settings, tone: 'cyan', series: [18, 25, 20, 38, 30, 42, 24, 32, 40, 34, 30, 28] },
  { label: 'Tối ưu AI', value: '91%', delta: '+16% so với tuần trước', icon: WandSparkles, tone: 'orange', series: [26, 44, 31, 48, 36, 42, 28, 45, 38, 42, 31, 26] },
  { label: 'Phiên bản cấu hình', value: 'v2.8', delta: '+1 phiên bản mới', icon: CheckCircle2, tone: 'sky', series: [24, 30, 28, 42, 34, 46, 30, 38, 35, 44, 32, 34] },
  { label: 'SLA phản hồi', value: '320ms', delta: '+12% so với tuần trước', icon: Clock3, tone: 'rose', series: [18, 30, 24, 46, 25, 20, 32, 28, 34, 29, 24, 26] },
  { label: 'Cảnh báo nâng cao', value: '5', delta: '-17% so với tuần trước', icon: Info, tone: 'amber', series: [18, 32, 24, 42, 22, 28, 20, 30, 24, 26, 22, 23] },
];

const advancedTabs = [
  { label: 'Tự động hóa', icon: Bot, active: true },
  { label: 'Đồng bộ', icon: RefreshCcw },
  { label: 'API & Webhook', icon: Waves },
  { label: 'Sandbox', icon: ShieldCheck },
  { label: 'AI tối ưu', icon: WandSparkles },
  { label: 'Phiên bản', icon: History },
  { label: 'Bảo mật', icon: LockKeyhole },
];

const advancedWorkflowRules = [
  ['Tự mở slot sáng', 'Khi tỷ lệ lấp đầy < 60%', 'Khoa khám bệnh', 'Cao', 'Đang bật'],
  ['Tự khóa slot quá tải', 'Khi overbooking > 120%', 'Toàn hệ thống', 'Cao', 'Đang bật'],
  ['Điều phối bác sĩ dự phòng', 'Khi bác sĩ nghỉ đột xuất', 'Khoa Nội tổng hợp', 'Trung bình', 'Đang bật'],
  ['Mở telehealth thay thế', 'Khi phòng khám offline', 'Telehealth', 'Trung bình', 'Bản nháp'],
  ['Gửi cảnh báo xung đột', 'Khi phát hiện trùng lịch', 'Toàn hệ thống', 'Cao', 'Đang bật'],
];

const advancedRuntimeSettings = [
  ['Run rule engine theo thời gian thực', 'toggle'],
  ['Batch xử lý mỗi', '5 phút'],
  ['Retry tối đa', '3 lần'],
  ['Timeout webhook', '10 giây'],
  ['Ưu tiên lịch VIP', 'toggle'],
  ['Tự rollback nếu lỗi', 'toggle'],
  ['Đồng bộ 2 chiều', 'toggle'],
  ['Hạn mức job song song', '12'],
];

const advancedSyncRows = [
  ['HIS/EMR', 'Đồng bộ 2 chiều', 'Realtime', 'Đồng bộ', '120ms'],
  ['CRM', 'Đồng bộ 1 chiều', '15 phút', 'Đồng bộ', '210ms'],
  ['Google Calendar', 'Đồng bộ 2 chiều', '5 phút', 'Đồng bộ', '150ms'],
  ['HRM', 'Đồng bộ 2 chiều', '30 phút', 'Cảnh báo', '1.2s'],
  ['Zalo OA', 'Đồng bộ 1 chiều', 'Realtime', 'Đồng bộ', '180ms'],
  ['SMS Gateway', 'Gửi 1 chiều', 'Realtime', 'Đồng bộ', '90ms'],
  ['Email Service', 'Gửi 1 chiều', 'Realtime', 'Đồng bộ', '110ms'],
];

const advancedWebhookRows = [
  ['POST', '/api/v1/schedule/created', 'HMAC', '02/06/2025 14:30:12', 'Thành công'],
  ['POST', '/api/v1/slot/updated', 'HMAC', '02/06/2025 14:29:48', 'Thành công'],
  ['POST', '/api/v1/doctor/offline', 'HMAC', '02/06/2025 14:28:02', 'Thành công'],
  ['GET', '/api/v1/telehealth/booked', 'Bearer', '02/06/2025 14:27:35', 'Thành công'],
  ['POST', '/api/v1/patient/no-show', 'HMAC', '02/06/2025 14:26:11', 'Thành công'],
];

const advancedSandboxHeatmap = [
  ['07:00', 1, 2, 2, 3, 3, 2, 1],
  ['09:00', 1, 2, 3, 4, 4, 3, 2],
  ['11:00', 2, 3, 4, 5, 5, 4, 2],
  ['13:00', 2, 3, 4, 5, 5, 4, 3],
  ['15:00', 1, 2, 3, 4, 4, 3, 2],
  ['17:00', 1, 1, 2, 3, 3, 2, 1],
];

const advancedVersions = [
  ['v2.8', 'Admin', '02/06/2025 14:31', 'Tối ưu AI, thêm rule mở slot sáng, tối ưu sandbox', 'Đang áp dụng'],
  ['v2.7', 'IT Support', '30/05/2025 16:45', 'Cập nhật webhook, thêm endpoint telehealth', 'Đã áp dụng'],
  ['v2.6', 'Admin', '28/05/2025 11:20', 'Điều chỉnh rule quá tải, cập nhật SLA', 'Đã áp dụng'],
  ['v2.5', 'IT Support', '24/05/2025 09:10', 'Thêm tích hợp Zalo OA, SMS Gateway', 'Đã áp dụng'],
];

const advancedAiRecommendations = [
  { title: 'Tăng slot telehealth vào khung 18:00-20:00', level: 'Cao', icon: Video },
  { title: 'Giảm overbooking tối đa từ 120% xuống 110%', level: 'Cao', icon: Flame },
  { title: 'Tự mở slot sáng sớm 05:30-07:00 khi lấp đầy < 50%', level: 'Trung bình', icon: AlarmClock },
  { title: 'Cân bằng lịch bác sĩ giữa các ngày trong tuần', level: 'Trung bình', icon: UsersRound },
  { title: 'Gửi nhắc lịch tự động trước 24h để giảm no-show', level: 'Trung bình', icon: Bell },
];

const advancedRecentActivities = [
  ['14:31', 'Admin', 'Cập nhật rule “Tự mở slot sáng”'],
  ['14:29', 'System', 'Đồng bộ lịch với HIS/EMR'],
  ['14:25', 'IT Support', 'Thêm endpoint /telehealth/booked'],
  ['14:20', 'Admin', 'Áp dụng phiên bản cấu hình v2.8'],
  ['14:18', 'System', 'Sandbox mô phỏng hoàn tất'],
];

const advancedSecurityControls = [
  ['IP allowlist', '32 IP được phép'],
  ['Ký request (HMAC)', 'Bắt buộc'],
  ['Token rotation', 'Mỗi 30 ngày'],
  ['Mã hóa payload', 'AES-256'],
  ['Audit verbose logging', 'Lưu 90 ngày'],
];

function Sparkline({ values = [] }) {
  const points = values.map((value, index) => `${index * 10},${40 - value / 2}`).join(' ');
  return (
    <svg viewBox="0 0 112 44" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function Toggle({ checked = true }) {
  return (
    <span className={`schedule-config-switch ${checked ? 'is-on' : ''}`}>
      <i />
    </span>
  );
}

function DotGroup({ dots }) {
  return (
    <span className="schedule-preview-dots">
      {dots.map((dot, index) => <i key={`${dot}-${index}`} className={`is-${dot}`} />)}
      {Array.from({ length: Math.max(0, 7 - dots.length) }).map((_, index) => <i key={`empty-${index}`} />)}
    </span>
  );
}

function TemplateFillRing({ value, compact = false }) {
  return (
    <span
      className={`schedule-template-fill-ring${compact ? ' is-compact' : ''}`}
      style={{ '--template-fill': `${value * 3.6}deg` }}
    >
      <b>{value}%</b>
      {!compact ? <small>Dự kiến lấp đầy</small> : null}
    </span>
  );
}

function SchedulingTemplateDashboardPage() {
  return (
    <main className="schedule-template-page">
      <section className="schedule-template-hero">
        <div>
          <h1>Mẫu lịch khám</h1>
          <p>Quản lý template lịch theo khoa, bác sĩ, phòng khám và tình huống vận hành.</p>
        </div>
        <div className="schedule-template-actions">
          <button type="button" className="is-primary"><Plus size={17} />Tạo mẫu mới</button>
          <button type="button"><Copy size={17} />Nhân bản mẫu</button>
          <button type="button"><Upload size={17} />Import mẫu</button>
          <button type="button"><FileDown size={17} />Xuất cấu hình</button>
        </div>
      </section>

      <section className="schedule-template-metrics" aria-label="Chỉ số mẫu lịch">
        {templateMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={`is-${metric.tone}`}>
              <span><Icon size={19} /></span>
              <div>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
                <em>{metric.delta}</em>
              </div>
              <Sparkline values={metric.series} />
            </article>
          );
        })}
      </section>

      <section className="schedule-template-layout">
        <div className="schedule-template-main">
          <section className="schedule-template-panel schedule-template-featured">
            <header>
              <div>
                <strong>Template nổi bật</strong>
                <Info size={14} />
              </div>
              <button type="button">Xem tất cả (48) <ChevronRight size={14} /></button>
            </header>
            <div className="schedule-template-card-grid">
              {templateLibrary.map((template, index) => {
                const Icon = template.icon;
                const statusClass = template.status === 'Đang dùng'
                  ? 'is-live'
                  : template.status === 'Tạm dừng'
                    ? 'is-paused'
                    : 'is-draft';

                return (
                  <article key={template.name} className={`schedule-template-item is-${template.tone}${index === 0 ? ' is-selected' : ''}`}>
                    {template.favorite ? <Sparkles className="schedule-template-star" size={15} /> : null}
                    <div className="schedule-template-item-head">
                      <span><Icon size={20} /></span>
                      <div>
                        <strong>{template.name}</strong>
                        <em className={statusClass}>{template.status}</em>
                      </div>
                    </div>
                    <dl>
                      <div><dt>Phạm vi</dt><dd>{template.scope}</dd></div>
                      <div><dt>Số slot</dt><dd>{template.slots} slot / ngày</dd></div>
                      <div><dt>Thời lượng</dt><dd>{template.duration}</dd></div>
                      <div><dt>Giờ làm việc</dt><dd>{template.hours}</dd></div>
                      <div><dt>Nghỉ</dt><dd>{template.breakTime}</dd></div>
                      <div><dt>Telehealth</dt><dd>{template.telehealth}</dd></div>
                    </dl>
                    <div className="schedule-template-item-bottom">
                      <div className="schedule-template-card-actions">
                        <button type="button" aria-label="Chỉnh sửa mẫu"><SlidersHorizontal size={14} /></button>
                        <button type="button" aria-label="Nhân bản mẫu"><Copy size={14} /></button>
                        <button type="button" aria-label="Liên kết mẫu"><FileText size={14} /></button>
                        <button type="button" aria-label="Xem mẫu"><CalendarClock size={14} /></button>
                        <button type="button" aria-label="Thêm thao tác"><MoreHorizontal size={14} /></button>
                      </div>
                      <TemplateFillRing value={template.fill} compact />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="schedule-template-panel schedule-template-list">
            <header>
              <strong>Danh sách mẫu lịch</strong>
            </header>
            <div className="schedule-template-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên mẫu</th>
                    <th>Loại mẫu</th>
                    <th>Phạm vi áp dụng</th>
                    <th>Số slot/ngày</th>
                    <th>Thời lượng</th>
                    <th>Giờ làm việc</th>
                    <th>Telehealth</th>
                    <th>Trạng thái</th>
                    <th>Cập nhật gần nhất</th>
                    <th>Người chỉnh sửa</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {templateDashboardRows.map((row) => {
                    const statusClass = row[7] === 'Đang dùng' ? 'is-live' : 'is-draft';
                    return (
                      <tr key={row[0]}>
                        <td><Sparkles size={13} />{row[0]}</td>
                        <td>{row[1]}</td>
                        <td>{row[2]}</td>
                        <td>{row[3]}</td>
                        <td>{row[4]}</td>
                        <td>{row[5]}</td>
                        <td>{row[6]}</td>
                        <td><span className={statusClass}>{row[7]}</span></td>
                        <td>{row[8]}</td>
                        <td>{row[9]}</td>
                        <td><MoreHorizontal size={16} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer>
              <span>Hiển thị 1 - 5 trong 48 kết quả</span>
              <div>
                <button type="button"><ChevronLeft size={14} /></button>
                <button type="button" className="is-active">1</button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button">4</button>
                <button type="button">5</button>
                <button type="button"><ChevronRight size={14} /></button>
                <button type="button">5 / trang</button>
              </div>
            </footer>
          </section>
        </div>

        <aside className="schedule-template-sidebar">
          <section className="schedule-template-panel schedule-template-preview">
            <header>
              <strong>Xem trước mẫu lịch</strong>
              <div>
                <span>Mẫu tiêu chuẩn</span>
                <em>Đang dùng</em>
              </div>
            </header>
            <div className="schedule-template-date">
              <button type="button"><ChevronLeft size={14} /></button>
              <strong>Thứ Ba, 03/06/2025</strong>
              <CalendarDays size={14} />
              <button type="button"><ChevronRight size={14} /></button>
            </div>
            <div className="schedule-template-preview-grid">
              <div className="schedule-template-summary">
                <strong>Tóm tắt</strong>
                <dl>
                  <div><dt>Số slot/ngày</dt><dd>16</dd></div>
                  <div><dt>Sức chứa/tuần</dt><dd>112</dd></div>
                </dl>
                <div>
                  <span>Tỷ lệ lấp đầy dự kiến</span>
                  <b>85%</b>
                </div>
                <TemplateFillRing value={85} />
                <p>Cho phép overbook <b>10% (2 slot)</b></p>
              </div>
              <div className="schedule-template-timeline">
                <strong>Timeline trong ngày</strong>
                <div className="schedule-template-legend">
                  <span className="is-green">Trống</span>
                  <span className="is-blue">Đã đặt</span>
                  <span className="is-orange">Gần đầy</span>
                  <span className="is-pink">Block</span>
                  <span className="is-cyan">Telehealth</span>
                </div>
                {templateTimeline.map((slot) => (
                  <div key={slot.time} className={`is-${slot.type}`}>
                    <time>{slot.time}</time>
                    <span>
                      <i style={{ width: `${slot.width}%` }} />
                      <b>{slot.label}</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button type="button" className="schedule-template-detail-button">
              Xem chi tiết & mô phỏng <CalendarClock size={14} />
            </button>
          </section>

          <section className="schedule-template-side-grid">
            <article className="schedule-template-panel schedule-template-rules">
              <header>
                <strong>Quy tắc gợi ý khi dùng mẫu</strong>
                <button type="button">Chỉnh sửa</button>
              </header>
              {templateSuggestionRules.map((rule) => (
                <div key={rule}>
                  <span><CalendarCheck2 size={14} />{rule}</span>
                  <Toggle checked />
                </div>
              ))}
            </article>

            <article className="schedule-template-panel schedule-template-quick">
              <header><strong>Tác vụ nhanh</strong></header>
              <div>
                <button type="button"><CalendarPlus size={17} />Tạo mẫu mới</button>
                <button type="button"><WandSparkles size={17} />Áp dụng hàng loạt</button>
                <button type="button"><Flame size={17} />Kiểm tra xung đột</button>
                <button type="button"><Copy size={17} />So sánh 2 mẫu</button>
                <button type="button"><History size={17} />Xem nhật ký</button>
                <button type="button"><Gauge size={17} />Phân tích hiệu quả</button>
              </div>
            </article>
          </section>

          <section className="schedule-template-side-grid">
            <article className="schedule-template-panel schedule-template-history">
              <header>
                <strong>Lịch sử thay đổi gần đây</strong>
                <button type="button">Xem tất cả</button>
              </header>
              {templateChangeHistory.map((item) => (
                <div key={`${item[0]}-${item[1]}`}>
                  <time>{item[0]}</time>
                  <span>{item[1].split(' ').slice(-2).map((part) => part[0]).join('')}</span>
                  <p><strong>{item[1]}</strong>{item[2]}</p>
                </div>
              ))}
            </article>

            <article className="schedule-template-panel schedule-template-ai">
              <header>
                <strong><Bot size={17} />Khuyến nghị tối ưu (AI)</strong>
                <Info size={14} />
              </header>
              {templateAiRecommendations.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title}>
                    <span><Icon size={16} /></span>
                    <p><strong>{item.title}</strong> {item.copy}</p>
                    <button type="button">Áp dụng</button>
                  </div>
                );
              })}
              <button type="button" className="schedule-template-more-button">Xem thêm khuyến nghị</button>
            </article>
          </section>
        </aside>
      </section>
    </main>
  );
}

function SchedulingRulesPolicyDashboardPage() {
  return (
    <main className="schedule-policy-page">
      <section className="schedule-policy-hero">
        <div>
          <h1>Quy tắc & Chính sách lịch khám <span>Đang áp dụng</span></h1>
          <p>Quản lý các quy tắc vận hành, đặt lịch, hủy lịch, xung đột, overbooking và phân quyền áp dụng.</p>
        </div>
        <div className="schedule-policy-actions">
          <button type="button" className="is-primary"><Save size={17} />Lưu thay đổi</button>
          <button type="button"><FileDown size={17} />Xuất cấu hình</button>
          <button type="button" className="is-danger"><RotateCcw size={17} />Khôi phục mặc định</button>
        </div>
      </section>

      <section className="schedule-policy-metrics" aria-label="Chỉ số quy tắc và chính sách">
        {policyMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={`is-${metric.tone}`}>
              <div>
                <span><Icon size={18} /></span>
                <small>{metric.label}</small>
              </div>
              <strong>{metric.value}</strong>
              <em>{metric.delta}</em>
              <Sparkline values={metric.series} />
            </article>
          );
        })}
      </section>

      <nav className="schedule-policy-tabs" aria-label="Nhóm quy tắc">
        {policyTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" className={item.active ? 'is-active' : ''}>
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <section className="schedule-policy-top-grid">
        <article className="schedule-policy-panel schedule-policy-booking">
          <header>
            <strong>Quy tắc đặt lịch</strong>
            <button type="button"><Plus size={15} />Thêm quy tắc</button>
          </header>
          <div className="schedule-policy-rule-list">
            <div className="schedule-policy-rule-head">
              <span>Quy tắc</span>
              <span>Điều kiện áp dụng</span>
              <span>Ưu tiên</span>
            </div>
            {bookingPolicyRules.map((rule) => (
              <div key={rule[0]}>
                <Toggle checked={rule[4]} />
                <p><strong>{rule[0]}</strong><small>{rule[1]}</small></p>
                <span>{rule[2]}</span>
                <em className={`is-${rule[3] === 'Cao' ? 'high' : rule[3] === 'Trung bình' ? 'medium' : 'low'}`}>{rule[3]}</em>
              </div>
            ))}
          </div>
          <button type="button" className="schedule-policy-text-button">Xem tất cả quy tắc đặt lịch (15)</button>
        </article>

        <article className="schedule-policy-panel schedule-policy-cancel">
          <header>
            <strong>Chính sách hủy / đổi lịch</strong>
            <button type="button">Chỉnh sửa</button>
          </header>
          <div>
            {cancellationPolicies.map((item, index) => (
              <label key={item[0]}>
                <span>{item[0]}</span>
                {index >= 6 ? <Toggle checked /> : <select defaultValue={item[1]}><option>{item[1]}</option></select>}
                <small>{item[2]}</small>
              </label>
            ))}
          </div>
          <button type="button" className="schedule-policy-text-button">Xem chi tiết chính sách (8)</button>
        </article>

        <article className="schedule-policy-panel schedule-policy-preview">
          <header>
            <strong>Xem trước tác động chính sách</strong>
            <button type="button">Thứ 2, 02/06/2025 <CalendarDays size={14} /></button>
          </header>
          <div className="schedule-policy-preview-grid">
            <div className="schedule-policy-timeline">
              <strong>Timeline trong ngày - Khoa Khám bệnh</strong>
              <div className="schedule-policy-legend">
                <span className="is-green">Hợp lệ</span>
                <span className="is-orange">Cần phê duyệt</span>
                <span className="is-red">Bị chặn</span>
                <span className="is-gray">Trống</span>
              </div>
              {policyImpactRows.map((row) => (
                <div key={row.time}>
                  <time>{row.time}</time>
                  <DotGroup dots={row.dots} />
                  <b>{row.stats}</b>
                </div>
              ))}
            </div>
            <div className="schedule-policy-impact">
              <strong>Tỷ lệ hợp lệ</strong>
              <div className="schedule-policy-donut" style={{ '--policy-ring': '295deg' }}><b>82%</b></div>
              <p><span className="is-green" />Hợp lệ <b>82%</b></p>
              <p><span className="is-orange" />Cần phê duyệt <b>10%</b></p>
              <p><span className="is-red" />Bị chặn <b>8%</b></p>
              <div>
                <span>Lịch bị chặn <strong>48</strong><em>+12%</em></span>
                <span>Lịch cần phê duyệt <strong>36</strong><em>+8%</em></span>
              </div>
            </div>
          </div>
          <footer>
            <strong>Cảnh báo chính sách (4)</strong>
            <span><Flame size={13} />3 slot bị khóa do trùng giờ bác sĩ</span>
            <span><Flame size={13} />5 lịch bị chặn do vi phạm thời gian hủy</span>
            <span><Flame size={13} />2 lịch vượt giới hạn số lần đổi / tháng</span>
            <span><Flame size={13} />1 bác sĩ vượt quá giới hạn overbooking</span>
          </footer>
        </article>

        <aside className="schedule-policy-panel schedule-policy-quick">
          <header><strong>Thao tác nhanh</strong></header>
          <div>
            <button type="button"><Plus size={17} />Tạo quy tắc mới</button>
            <button type="button"><Copy size={17} />Nhân bản quy tắc</button>
            <button type="button"><WandSparkles size={17} />Áp dụng hàng loạt</button>
            <button type="button"><Shuffle size={17} />Kiểm tra xung đột</button>
            <button type="button"><FileText size={17} />Xem nhật ký</button>
            <button type="button"><Upload size={17} />Import cấu hình</button>
          </div>
        </aside>
      </section>

      <section className="schedule-policy-bottom-grid">
        <article className="schedule-policy-panel schedule-policy-table">
          <header>
            <strong>Danh sách quy tắc</strong>
          </header>
          <div className="schedule-policy-filters">
            <select defaultValue="Tất cả nhóm"><option>Tất cả nhóm</option></select>
            <select defaultValue="Tất cả phạm vi"><option>Tất cả phạm vi</option></select>
            <select defaultValue="Tất cả trạng thái"><option>Tất cả trạng thái</option></select>
            <input placeholder="Tìm quy tắc..." />
            <button type="button">Bộ lọc</button>
          </div>
          <div className="schedule-policy-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên quy tắc</th>
                  <th>Nhóm</th>
                  <th>Phạm vi áp dụng</th>
                  <th>Mức ưu tiên</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật gần nhất</th>
                  <th>Người chỉnh sửa</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {policyRuleRows.map((row) => (
                  <tr key={row[0]}>
                    <td><Info size={13} />{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                    <td><em className={`is-${row[3] === 'Cao' ? 'high' : 'medium'}`}>{row[3]}</em></td>
                    <td><span>{row[4]}</span></td>
                    <td>{row[5]}</td>
                    <td>{row[6]}</td>
                    <td><MoreHorizontal size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer>
            <span>Hiển thị 1 - 7 trong 68 quy tắc</span>
            <div>
              <button type="button"><ChevronLeft size={14} /></button>
              <button type="button" className="is-active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">4</button>
              <button type="button">5</button>
              <button type="button">10</button>
              <button type="button"><ChevronRight size={14} /></button>
              <button type="button">7 / trang</button>
            </div>
          </footer>
        </article>

        <article className="schedule-policy-panel schedule-policy-approval">
          <header><strong>Luồng phê duyệt</strong></header>
          {approvalFlow.map((item, index) => (
            <div key={item[0]}>
              <span>{index + 1}</span>
              <p><strong>{item[0]}</strong><small>{item[1]}</small></p>
              <Toggle checked />
            </div>
          ))}
          <label><input type="checkbox" defaultChecked />Áp dụng cho các tình huống</label>
          <label><input type="checkbox" defaultChecked />Lịch ngoài giờ</label>
          <label><input type="checkbox" defaultChecked />Overbooking vượt mức</label>
          <label><input type="checkbox" defaultChecked />Lịch yêu cầu đặc biệt</label>
          <button type="button" className="schedule-policy-text-button">Xem chi tiết luồng phê duyệt</button>
        </article>

        <article className="schedule-policy-panel schedule-policy-simulation">
          <header><strong>Kiểm tra xung đột & mô phỏng</strong></header>
          <div className="schedule-policy-simulation-controls">
            <select defaultValue="Khoa Khám bệnh"><option>Khoa Khám bệnh</option></select>
            <select defaultValue="02/06/2025"><option>02/06/2025</option></select>
          </div>
          <div className="schedule-policy-simulation-grid">
            <div>
              {conflictChecks.map((item) => (
                <p key={item[0]} className={`is-${item[3]}`}>
                  <span>{item[0]}</span>
                  <b>{item[1]}</b>
                  <em>{item[2]}</em>
                </p>
              ))}
            </div>
            <div className="schedule-policy-heatmap">
              <div><span />{['07', '08', '09', '10', '11', '13', '14', '15'].map((hour) => <b key={hour}>{hour}</b>)}</div>
              {conflictHeatmap.map((row) => (
                <div key={row[0]}>
                  <span>{row[0]}</span>
                  {row.slice(1).map((cell, index) => <i key={`${row[0]}-${index}`} className={`is-${cell}`} />)}
                </div>
              ))}
            </div>
          </div>
          <footer>
            <button type="button" className="is-primary"><RefreshCcw size={16} />Chạy mô phỏng</button>
            <button type="button">Xem báo cáo chi tiết</button>
          </footer>
        </article>

        <article className="schedule-policy-panel schedule-policy-ai">
          <header>
            <strong><Bot size={17} />Khuyến nghị tối ưu (AI)</strong>
            <button type="button">Xem tất cả</button>
          </header>
          {policyAiRecommendations.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title}>
                <span><Icon size={16} /></span>
                <p><strong>{item.title}</strong>{item.copy}</p>
                <button type="button">Áp dụng</button>
              </div>
            );
          })}
        </article>

        <article className="schedule-policy-panel schedule-policy-recent">
          <header>
            <strong>Thay đổi gần đây</strong>
            <button type="button">Xem tất cả</button>
          </header>
          {policyRecentChanges.map((item) => (
            <div key={`${item[0]}-${item[1]}`}>
              <span>{item[0].split(' ').slice(-2).map((part) => part[0]).join('')}</span>
              <p><strong>{item[0]}</strong>{item[1]}</p>
            </div>
          ))}
          <button type="button" className="schedule-policy-text-button">Xem nhật ký chi tiết</button>
        </article>
      </section>
    </main>
  );
}

function SchedulingExceptionsDashboardPage() {
  return (
    <main className="schedule-exception-page">
      <section className="schedule-exception-hero">
        <div>
          <h1>Nghỉ / Ngoại lệ lịch khám</h1>
          <p>Cấu hình ngày nghỉ lễ, nghỉ cá nhân, khóa lịch, ngoại lệ đặc biệt ảnh hưởng đến việc tạo lịch tự động.</p>
        </div>
        <div className="schedule-exception-actions">
          <button type="button" className="is-primary"><Save size={17} />Lưu thay đổi</button>
          <button type="button"><FileDown size={17} />Xuất cấu hình</button>
          <button type="button" className="is-danger"><RotateCcw size={17} />Khôi phục mặc định</button>
        </div>
      </section>

      <section className="schedule-exception-metrics" aria-label="Chỉ số nghỉ và ngoại lệ">
        {exceptionMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={`is-${metric.tone}`}>
              <div>
                <span><Icon size={18} /></span>
                <small>{metric.label}</small>
              </div>
              <strong>{metric.value}</strong>
              <em>{metric.delta}</em>
              <Sparkline values={metric.series} />
            </article>
          );
        })}
      </section>

      <nav className="schedule-exception-tabs" aria-label="Nhóm nghỉ và ngoại lệ">
        {exceptionTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" className={item.active ? 'is-active' : ''}>
              <Icon size={16} />
              {item.label}
              {item.badge ? <span>{item.badge}</span> : null}
            </button>
          );
        })}
      </nav>

      <section className="schedule-exception-top-grid">
        <article className="schedule-exception-panel schedule-exception-calendar">
          <header>
            <strong>Lịch ngoại lệ - Tháng 6 / 2025</strong>
            <div>
              <button type="button">Hôm nay</button>
              <button type="button"><ChevronLeft size={14} /></button>
              <button type="button"><ChevronRight size={14} /></button>
            </div>
          </header>
          <div className="schedule-exception-month">
            <div className="schedule-exception-weekdays">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
            </div>
            {exceptionCalendarWeeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="schedule-exception-week">
                {week.map((day) => {
                  const mark = exceptionCalendarMarks[day];
                  return (
                    <button key={`${weekIndex}-${day}`} type="button" className={mark ? `is-${mark}` : ''}>
                      {day}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <footer>
            <span className="is-holiday">Nghỉ lễ</span>
            <span className="is-personal">Nghỉ cá nhân</span>
            <span className="is-pending">Chờ duyệt</span>
            <span className="is-lock">Khóa lịch/Phòng</span>
            <span className="is-maintenance">Bảo trì</span>
            <span className="is-event">Sự kiện</span>
          </footer>
        </article>

        <article className="schedule-exception-panel schedule-exception-impact">
          <header>
            <strong>Xem trước tác động</strong>
            <span>(01/06/2025 - 30/06/2025)</span>
          </header>
          <div className="schedule-exception-impact-body">
            <div className="schedule-exception-ring" style={{ '--exception-ring': '295deg' }}>
              <strong>82%</strong>
              <span>Tỷ lệ giữ lịch</span>
            </div>
            <div className="schedule-exception-impact-list">
              <p><span className="is-blue" />Số ca bị ảnh hưởng <strong>1.248</strong><em>+12%</em></p>
              <p><span className="is-cyan" />Bác sĩ bị ảnh hưởng <strong>68</strong><em>+8%</em></p>
              <p><span className="is-orange" />Phòng bị ảnh hưởng <strong>24</strong><em>+7%</em></p>
              <p><span className="is-red" />Slot bị khóa <strong>1.764</strong><em>+15%</em></p>
            </div>
          </div>
          <footer>
            <div><span>Tổng số ca dự kiến</span><strong>6.820</strong></div>
            <div><span>Số ca dự kiến còn lại</span><strong>5.572</strong></div>
            <div><span>Tỷ lệ giữ lịch</span><strong>82%</strong></div>
          </footer>
        </article>

        <article className="schedule-exception-panel schedule-exception-sync">
          <header><strong>Nguồn ngày nghỉ & đồng bộ</strong></header>
          {exceptionSyncSources.map((source) => (
            <div key={source[0]} className={`is-${source[4]}`}>
              <span><CalendarCheck2 size={15} /></span>
              <p><strong>{source[0]}</strong><small>{source[1]}</small></p>
              <em>{source[2]}</em>
              <Toggle checked={source[3]} />
            </div>
          ))}
          <button type="button" className="schedule-exception-text-button">Xem cấu hình đồng bộ <ChevronRight size={14} /></button>
        </article>
      </section>

      <section className="schedule-exception-main-grid">
        <section className="schedule-exception-left">
          <article className="schedule-exception-panel schedule-exception-table">
            <div className="schedule-exception-filter-row">
              <strong>Bộ lọc nhanh</strong>
              {exceptionFilters.map((filter) => (
                <button key={filter} type="button" className={`is-${filter === 'Tất cả' ? 'active' : ''}`}>{filter}</button>
              ))}
            </div>
            <header>
              <strong>Danh sách ngoại lệ & ngày nghỉ (128)</strong>
              <div>
                <input placeholder="Tìm kiếm ngoại lệ..." />
                <button type="button">Bộ lọc</button>
                <button type="button" className="is-primary"><Plus size={15} />Thêm mới</button>
              </div>
            </header>
            <div className="schedule-exception-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên ngoại lệ</th>
                    <th>Loại</th>
                    <th>Phạm vi áp dụng</th>
                    <th>Thời gian</th>
                    <th>Lặp lại</th>
                    <th>Trạng thái</th>
                    <th>Người duyệt</th>
                    <th>Cập nhật gần nhất</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {exceptionRows.map((row) => {
                    const typeClass = row[1].includes('lễ')
                      ? 'holiday'
                      : row[1].includes('cá nhân')
                        ? 'personal'
                        : row[1].includes('khoa')
                          ? 'department'
                          : row[1].includes('Bảo')
                            ? 'maintenance'
                            : row[1].includes('Khóa')
                              ? 'lock'
                              : 'event';
                    return (
                      <tr key={row[0]}>
                        <td>{row[0]}</td>
                        <td><em className={`is-${typeClass}`}>{row[1]}</em></td>
                        <td>{row[2]}</td>
                        <td>{row[3]}</td>
                        <td>{row[4]}</td>
                        <td><span className={row[5] === 'Chờ duyệt' ? 'is-pending' : ''}>{row[5]}</span></td>
                        <td>{row[6]}</td>
                        <td>{row[7]}</td>
                        <td><MoreHorizontal size={16} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer>
              <span>Hiển thị 1 - 6 của 128</span>
              <div>
                <button type="button"><ChevronLeft size={14} /></button>
                <button type="button" className="is-active">1</button>
                <button type="button">2</button>
                <button type="button">3</button>
                <button type="button">4</button>
                <button type="button">5</button>
                <button type="button">22</button>
                <button type="button"><ChevronRight size={14} /></button>
                <button type="button">Hiển thị 10</button>
              </div>
            </footer>
          </article>
        </section>

        <aside className="schedule-exception-right">
          <div className="schedule-exception-side-row">
            <article className="schedule-exception-panel schedule-exception-approval">
              <header><strong>Luồng phê duyệt</strong></header>
              {exceptionApprovalFlow.map((item, index) => (
                <div key={item[0]}>
                  <span>{index + 1}</span>
                  <p><strong>{item[0]}</strong><small>{item[1]}</small></p>
                  <Toggle checked />
                </div>
              ))}
              <button type="button" className="schedule-exception-text-button">Sửa luồng phê duyệt</button>
            </article>

            <article className="schedule-exception-panel schedule-exception-category">
              <header><strong>Phân bổ ngoại lệ theo loại</strong></header>
              <div className="schedule-exception-category-body">
                <div className="schedule-exception-category-ring">
                  <strong>128</strong>
                  <span>Tổng</span>
                </div>
                <div>
                  {exceptionCategoryStats.map((item) => (
                    <p key={item[0]} className={`is-${item[3]}`}>
                      <span>{item[0]}</span>
                      <b>{item[1]} ({item[2]})</b>
                    </p>
                  ))}
                </div>
              </div>
            </article>

            <article className="schedule-exception-panel schedule-exception-heatmap">
              <header><strong>Heatmap ảnh hưởng theo ngày / giờ</strong></header>
              <div>
                <div className="schedule-exception-heatmap-head">
                  <span>Giờ</span>
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <b key={day}>{day}</b>)}
                </div>
                {exceptionHeatmapRows.map((row) => (
                  <div key={row[0]}>
                    <span>{row[0]}</span>
                    {row.slice(1).map((cell, index) => <i key={`${row[0]}-${index}`} className={`is-${cell}`} />)}
                  </div>
                ))}
              </div>
              <footer>
                <span>Thấp</span>
                <i />
                <b>Cao</b>
                <button type="button">Xem tất cả</button>
              </footer>
            </article>
          </div>

          <div className="schedule-exception-side-row is-bottom">
            <article className="schedule-exception-panel schedule-exception-alerts">
              <header><strong>Cảnh báo cấu hình</strong></header>
              {exceptionWarnings.map((item, index) => (
                <p key={item[0]} className={index === 0 || index === 3 ? 'is-red' : ''}>
                  <Flame size={14} />
                  <span>{item[0]}</span>
                  <button type="button">{item[1]}</button>
                </p>
              ))}
            </article>

            <article className="schedule-exception-panel schedule-exception-quick">
              <header><strong>Thao tác nhanh</strong></header>
              <div>
                <button type="button"><Plus size={17} />Thêm ngày nghỉ</button>
                <button type="button"><CalendarPlus size={17} />Tạo ngoại lệ</button>
                <button type="button"><LockKeyhole size={17} />Khóa phòng</button>
                <button type="button"><Download size={17} />Import lịch</button>
                <button type="button"><Copy size={17} />Sao lưu tác động</button>
                <button type="button"><FileDown size={17} />Xuất báo cáo</button>
              </div>
            </article>

            <article className="schedule-exception-panel schedule-exception-recent">
              <header><strong>Thay đổi gần đây</strong></header>
              {exceptionRecentChanges.map((item) => (
                <div key={`${item[0]}-${item[2]}`}>
                  <span>{item[0].split(' ').slice(-2).map((part) => part[0]).join('')}</span>
                  <p><strong>{item[0]}</strong>{item[1]}<time>{item[2]}</time></p>
                </div>
              ))}
              <button type="button" className="schedule-exception-text-button">Xem tất cả hoạt động</button>
            </article>

            <article className="schedule-exception-panel schedule-exception-ai">
              <header><strong><Bot size={17} />Khuyến nghị tối ưu (AI)</strong></header>
              {exceptionAiRecommendations.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title}>
                    <span><Icon size={16} /></span>
                    <p><strong>{item.title}</strong>{item.copy}</p>
                    <button type="button">Áp dụng</button>
                  </div>
                );
              })}
              <button type="button" className="schedule-exception-text-button">Xem tất cả khuyến nghị</button>
            </article>
          </div>
        </aside>
      </section>
    </main>
  );
}

function SchedulingTelehealthDashboardPage() {
  return (
    <main className="schedule-telehealth-page">
      <section className="schedule-telehealth-hero">
        <div>
          <h1>Telehealth lịch khám</h1>
          <p>Cấu hình lịch khám trực tuyến: kênh kết nối, slot, quy trình check-in, nhắc hẹn và các quy tắc vận hành.</p>
        </div>
        <div className="schedule-telehealth-actions">
          <button type="button" className="is-primary"><Save size={17} />Lưu thay đổi</button>
          <button type="button"><FileDown size={17} />Xuất cấu hình</button>
          <button type="button" className="is-danger"><RotateCcw size={17} />Khôi phục mặc định</button>
        </div>
      </section>

      <section className="schedule-telehealth-metrics" aria-label="Chỉ số telehealth">
        {telehealthMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={`is-${metric.tone}`}>
              <div>
                <span><Icon size={18} /></span>
                <small>{metric.label}</small>
              </div>
              <strong>{metric.value}</strong>
              <em>{metric.delta}</em>
              <Sparkline values={metric.series} />
            </article>
          );
        })}
      </section>

      <nav className="schedule-telehealth-tabs" aria-label="Nhóm cấu hình telehealth">
        {telehealthTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" className={item.active ? 'is-active' : ''}>
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <section className="schedule-telehealth-top-grid">
        <article className="schedule-telehealth-panel schedule-telehealth-channels">
          <header>
            <strong>Nhà cung cấp & kênh kết nối</strong>
            <button type="button"><Plus size={15} />Thêm kênh</button>
          </header>
          <div className="schedule-telehealth-channel-head">
            <span>Kênh kết nối</span>
            <span>Loại tích hợp</span>
            <span>Tài khoản / Tenant</span>
            <span>Tự động tạo link</span>
            <span>Ghi log cuộc gọi</span>
            <span>Test kết nối</span>
            <span>Trạng thái</span>
          </div>
          {telehealthChannels.map((channel) => {
            const Icon = channel[6];
            return (
              <div key={channel[0]} className="schedule-telehealth-channel-row">
                <p><span><Icon size={16} /></span><strong>{channel[0]}</strong></p>
                <small>{channel[1]}</small>
                <small>{channel[2]}</small>
                <Toggle checked={channel[3]} />
                <Toggle checked={channel[4]} />
                <button type="button">Test</button>
                <em className={channel[5] === 'Tắt' ? 'is-off' : ''}>{channel[5]}</em>
              </div>
            );
          })}
          <footer>
            <Info size={15} />
            <span>Kiểm nhập định kì được ưu tiên khi tạo lịch Telehealth mới.</span>
          </footer>
        </article>

        <article className="schedule-telehealth-panel schedule-telehealth-slots">
          <header>
            <strong>Thiết lập slot telehealth mặc định</strong>
            <button type="button"><RefreshCcw size={14} />Đặt lại</button>
          </header>
          <div className="schedule-telehealth-slot-grid">
            <div className="schedule-telehealth-settings">
              <label><span>Thời lượng slot</span><select defaultValue="30 phút"><option>30 phút</option></select></label>
              <label><span>Đệm trước khám</span><select defaultValue="10 phút"><option>10 phút</option></select></label>
              <label><span>Đệm sau khám</span><select defaultValue="10 phút"><option>10 phút</option></select></label>
              <label><span>Giới hạn BN / slot</span><input defaultValue="1" /></label>
              <label><span>Thời gian mở phòng chờ</span><select defaultValue="15 phút trước giờ"><option>15 phút trước giờ</option></select></label>
              <label><span>Thời gian đóng link</span><select defaultValue="5 phút sau giờ"><option>5 phút sau giờ</option></select></label>
              <label><span>Tự động tạo Meeting ID</span><Toggle checked /></label>
              <label><span>Tự check-in cho BN</span><Toggle checked /></label>
              <label><span>Tự gửi link khám</span><Toggle checked /></label>
              <label><span>Cho phép overbook online</span><Toggle /></label>
              <label><span>Slot ưu tiên tái khám</span><Toggle checked /></label>
            </div>
            <div className="schedule-telehealth-rules">
              <header>
                <strong>Quy tắc thông minh</strong>
                <Info size={14} />
              </header>
              {telehealthSmartRules.map((rule) => {
                const Icon = rule.icon;
                return (
                  <article key={rule.title} className={`is-${rule.tone}`}>
                    <span><Icon size={16} /></span>
                    <p><strong>{rule.title}</strong><small>{rule.copy}</small></p>
                    <Toggle checked />
                  </article>
                );
              })}
              <button type="button" className="schedule-telehealth-text-button">Xem tất cả quy tắc (12)</button>
            </div>
          </div>
        </article>

        <article className="schedule-telehealth-panel schedule-telehealth-preview">
          <header>
            <strong>Xem trước lịch áp dụng</strong>
            <button type="button">Thứ 2, 02/06/2025 <CalendarDays size={14} /></button>
          </header>
          <div className="schedule-telehealth-preview-grid">
            <div className="schedule-telehealth-timeline">
              <div className="schedule-telehealth-legend">
                <span className="is-green">Trống</span>
                <span className="is-blue">Đã đặt</span>
                <span className="is-orange">Gần đầy</span>
                <span className="is-red">Block</span>
                <span className="is-cyan">Telehealth VIP</span>
              </div>
              {telehealthPreviewRows.map((row) => (
                <div key={row.time}>
                  <time>{row.time}</time>
                  <DotGroup dots={row.dots} />
                  <b>{row.stats}</b>
                </div>
              ))}
              <button type="button" className="schedule-telehealth-text-button">Xem chi tiết lịch (24 slot)</button>
            </div>
            <aside className="schedule-telehealth-preview-side">
              <strong>Tỷ lệ lấp đầy dự kiến</strong>
              <div className="schedule-telehealth-ring" style={{ '--telehealth-ring': '295deg' }}>
                <b>82%</b>
              </div>
              <p>Số slot / ngày <b>48</b></p>
              <p>Tổng sức chứa / tuần <b>240</b></p>
              <p>Tỷ lệ auto-confirm <b>76%</b></p>
              <p>Dự kiến no-show <b>8%</b></p>
              <div>
                <strong>Cảnh báo cấu hình</strong>
                <span><Flame size={13} />Thời gian đóng link &lt; 5 phút có thể gây trễ check-in</span>
                <span><Flame size={13} />Tỷ lệ overbooking đang cao (dự kiến &lt; 15%)</span>
                <span><Flame size={13} />Đường truyền trung bình thấp ở kênh nội bộ</span>
              </div>
            </aside>
          </div>
        </article>
      </section>

      <section className="schedule-telehealth-bottom-grid">
        <article className="schedule-telehealth-panel schedule-telehealth-template-cards">
          <header><strong>Mẫu telehealth đang dùng</strong></header>
          <div>
            {telehealthTemplates.map((template) => (
              <section key={template[0]}>
                <header>
                  <strong>{template[0]}</strong>
                  <em className={template[7] === 'VIP' ? 'is-vip' : ''}>{template[7]}</em>
                </header>
                <p><span>Phạm vi</span><b>{template[1]}</b></p>
                <p><span>Slot / ngày</span><b>{template[2]}</b></p>
                <p><span>Thời lượng</span><b>{template[3]}</b></p>
                <p><span>Giờ làm việc</span><b>{template[4]}</b></p>
                <p><span>Phòng chờ</span><b>{template[5]}</b></p>
                <TemplateFillRing value={template[6]} compact />
              </section>
            ))}
          </div>
        </article>

        <article className="schedule-telehealth-panel schedule-telehealth-table">
          <header>
            <strong>Danh sách cấu hình telehealth theo khoa / bác sĩ</strong>
            <button type="button">Xem tất cả</button>
          </header>
          <div className="schedule-telehealth-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên cấu hình</th>
                  <th>Phạm vi áp dụng</th>
                  <th>Kênh</th>
                  <th>Slot/ngày</th>
                  <th>Thời lượng</th>
                  <th>Nhắc hẹn</th>
                  <th>Check-in</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật gần nhất</th>
                  <th>Người chỉnh sửa</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {telehealthRows.map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                    <td>{row[3]}</td>
                    <td>{row[4]}</td>
                    <td>{row[5]}</td>
                    <td>{row[6]}</td>
                    <td><span className={row[7] === 'Tạm dừng' ? 'is-paused' : ''}>{row[7]}</span></td>
                    <td>{row[8]}</td>
                    <td>{row[9]}</td>
                    <td><MoreHorizontal size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer>
            <span>Hiển thị 1 - 7 trong 16 cấu hình</span>
            <div>
              <button type="button"><ChevronLeft size={14} /></button>
              <button type="button" className="is-active">1</button>
              <button type="button">2</button>
              <button type="button">3</button>
              <button type="button">4</button>
              <button type="button"><ChevronRight size={14} /></button>
              <button type="button">10 / trang</button>
            </div>
          </footer>
        </article>

        <aside className="schedule-telehealth-side">
          <article className="schedule-telehealth-panel schedule-telehealth-checkin">
            <header><strong>Quy trình check-in online</strong></header>
            {telehealthCheckinSteps.map((step, index) => (
              <div key={step[0]}>
                <span>{index + 1}</span>
                <p><strong>{step[0]}</strong><small>{step[1]}</small></p>
                <Toggle checked />
              </div>
            ))}
            <button type="button" className="schedule-telehealth-text-button">Chỉnh sửa quy trình</button>
          </article>

          <article className="schedule-telehealth-panel schedule-telehealth-quick">
            <header><strong>Tác vụ nhanh</strong></header>
            <div>
              <button type="button"><CalendarPlus size={17} />Tạo cấu hình mới</button>
              <button type="button"><WandSparkles size={17} />Áp dụng hàng loạt</button>
              <button type="button"><Video size={17} />Test kết nối</button>
              <button type="button"><RefreshCcw size={17} />Gửi link mẫu</button>
              <button type="button"><FileText size={17} />Xem nhật ký</button>
            </div>
          </article>

          <article className="schedule-telehealth-panel schedule-telehealth-ai">
            <header><strong><Bot size={17} />Khuyến nghị tối ưu (AI)</strong></header>
            {telehealthAiRecommendations.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title}>
                  <span><Icon size={16} /></span>
                  <p><strong>{item.title}</strong>{item.copy}</p>
                  <button type="button">Áp dụng</button>
                </div>
              );
            })}
            <button type="button" className="schedule-telehealth-text-button">Xem thêm gợi ý (6)</button>
          </article>

          <article className="schedule-telehealth-panel schedule-telehealth-recent">
            <header><strong>Thay đổi gần đây</strong></header>
            {telehealthRecentChanges.map((item) => (
              <div key={`${item[0]}-${item[2]}`}>
                <span>{item[0].split(' ').slice(-2).map((part) => part[0]).join('')}</span>
                <p><strong>{item[0]}</strong>{item[1]}<time>{item[2]}</time></p>
              </div>
            ))}
            <button type="button" className="schedule-telehealth-text-button">Xem tất cả nhật ký</button>
          </article>
        </aside>
      </section>

      <footer className="schedule-telehealth-footer">
        <span><RefreshCcw size={14} />Dữ liệu được đồng bộ lúc 14:32, 02/06/2025</span>
        <span><CheckCircle2 size={14} />Hệ thống hoạt động bình thường</span>
        <span>Hỗ trợ: <b>1900 1234</b></span>
        <span>help@medischedule.vn</span>
      </footer>
    </main>
  );
}

function SchedulingNotificationsDashboardPage() {
  return (
    <main className="schedule-notification-page">
      <section className="schedule-notification-hero">
        <div>
          <h1>Thông báo lịch khám</h1>
          <p>Cấu hình thông báo và nhắc hẹn cho lịch khám, thay đổi lịch, xác nhận, nhắc hẹn và quy tắc leo thang.</p>
        </div>
        <div className="schedule-notification-actions">
          <button type="button" className="is-primary"><Save size={17} />Lưu thay đổi</button>
          <button type="button"><FileDown size={17} />Xuất cấu hình</button>
          <button type="button" className="is-danger"><RotateCcw size={17} />Khôi phục mặc định</button>
        </div>
      </section>

      <section className="schedule-notification-metrics" aria-label="Chỉ số thông báo lịch khám">
        {notificationMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={`is-${metric.tone}`}>
              <div>
                <span><Icon size={18} /></span>
                <small>{metric.label}</small>
              </div>
              <strong>{metric.value}</strong>
              <em>{metric.delta}</em>
              <Sparkline values={metric.series} />
            </article>
          );
        })}
      </section>

      <nav className="schedule-notification-tabs" aria-label="Nhóm cấu hình thông báo">
        {notificationTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" className={item.active ? 'is-active' : ''}>
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <section className="schedule-notification-top-grid">
        <article className="schedule-notification-panel schedule-notification-channels">
          <header>
            <strong>Kênh gửi & trạng thái kết nối</strong>
            <Info size={14} />
          </header>
          <div className="schedule-notification-channel-head">
            <span>Kênh</span>
            <span>Nhà cung cấp</span>
            <span>Trạng thái</span>
            <span>Tốc độ gửi</span>
            <span>Retry</span>
            <span>Bật/Tắt</span>
            <span>Thao tác</span>
          </div>
          {notificationChannels.map((channel) => (
            <div key={channel[0]} className="schedule-notification-channel-row">
              <p><span><Bell size={15} /></span><strong>{channel[0]}</strong></p>
              <small>{channel[1]}</small>
              <em className={channel[2] === 'Cảnh báo' ? 'is-warning' : ''}>{channel[2]}</em>
              <small>{channel[3]}</small>
              <small>{channel[4]}</small>
              <Toggle checked={channel[5]} />
              <button type="button">Test</button>
            </div>
          ))}
          <footer>
            <span>Cập nhật lần cuối: 07/06/2025 09:15</span>
            <button type="button">Xem chi tiết kênh gửi <ChevronRight size={14} /></button>
          </footer>
        </article>

        <article className="schedule-notification-panel schedule-notification-rules">
          <header>
            <strong>Thiết lập quy tắc nhắc hẹn mặc định</strong>
            <Info size={14} />
          </header>
          <div>
            {notificationDefaultRules.map((rule) => (
              <label key={rule[0]}>
                <span>{rule[0]}</span>
                {rule[1] ? <input defaultValue={rule[1]} /> : <input defaultValue="" />}
                {rule[2] ? <select defaultValue={rule[2]}><option>{rule[2]}</option></select> : <span />}
                {rule[3] ? <select defaultValue={rule[3]}><option>{rule[3]}</option></select> : <span />}
                <Toggle checked={rule[4]} />
              </label>
            ))}
          </div>
          <footer>
            <button type="button" className="schedule-notification-text-button">Thiết lập giờ yên lặng</button>
            <button type="button" className="schedule-notification-text-button">Xem trước & lưu quy tắc</button>
          </footer>
        </article>

        <article className="schedule-notification-panel schedule-notification-preview">
          <header>
            <strong>Xem trước luồng thông báo áp dụng</strong>
            <button type="button">Thứ 7, 07/06/2025 <CalendarDays size={14} /></button>
          </header>
          <div className="schedule-notification-preview-grid">
            <div className="schedule-notification-flow">
              <div className="schedule-notification-flow-head">
                <span>Thời điểm</span>
                <span>Sự kiện</span>
                <span>Kênh</span>
                <span>Trạng thái</span>
              </div>
              {notificationFlowRows.map((row) => (
                <div key={`${row[0]}-${row[1]}`}>
                  <time>{row[0]}</time>
                  <p>{row[1]}</p>
                  <span>
                    {row[2].map((channel) => <i key={channel} className={`is-${channel}`} />)}
                  </span>
                  <em className={row[3] === 'Chờ gửi' ? 'is-waiting' : ''}>{row[3]}</em>
                </div>
              ))}
              <footer>
                <span className="is-green">Đã gửi</span>
                <span className="is-blue">Chờ gửi</span>
                <span className="is-red">Lỗi</span>
                <span className="is-cyan">Xác nhận</span>
                <span className="is-gray">Hủy</span>
              </footer>
            </div>
            <aside className="schedule-notification-rate">
              <strong>Tỷ lệ dự kiến</strong>
              <div className="schedule-notification-ring" style={{ '--notification-ring': '331deg' }}>
                <b>92%</b>
                <span>Tổng</span>
              </div>
              <p><span className="is-green" />92% <b>Gửi thành công</b></p>
              <p><span className="is-red" />4% <b>Lỗi gửi</b></p>
              <p><span className="is-blue" />3% <b>Chưa phản hồi</b></p>
              <p><span className="is-gray" />1% <b>Hủy trước hẹn</b></p>
              <div>
                <strong>Cảnh báo cấu hình (2)</strong>
                <span><Flame size={13} />Kênh Cuộc gọi tự động đang cảnh báo kết nối</span>
                <span><Flame size={13} />Giờ yên lặng chưa được thiết lập cho CN</span>
              </div>
              <button type="button" className="schedule-notification-text-button">Xem tất cả cảnh báo</button>
            </aside>
          </div>
        </article>
      </section>

      <section className="schedule-notification-bottom-grid">
        <article className="schedule-notification-panel schedule-notification-templates">
          <header>
            <strong>Mẫu thông báo đang dùng</strong>
            <button type="button">Xem tất cả <ChevronRight size={14} /></button>
          </header>
          <div>
            {notificationTemplates.map((template) => {
              const Icon = template[5];
              return (
                <section key={template[0]}>
                  <header>
                    <span><Icon size={17} /></span>
                    <div>
                      <strong>{template[0]}</strong>
                      <small>Phạm vi: {template[1]}</small>
                    </div>
                  </header>
                  <p>{template[2].map((channel) => <em key={channel}>{channel}</em>)}</p>
                  <small>Cập nhật: {template[4]}</small>
                  <TemplateFillRing value={template[3]} compact />
                </section>
              );
            })}
          </div>
        </article>

        <article className="schedule-notification-panel schedule-notification-table">
          <header>
            <strong>Danh sách quy tắc theo khoa / bác sĩ</strong>
            <button type="button">Xem tất cả</button>
          </header>
          <div className="schedule-notification-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên cấu hình</th>
                  <th>Phạm vi áp dụng</th>
                  <th>Kênh</th>
                  <th>Triggers</th>
                  <th>Retry</th>
                  <th>Tự động</th>
                  <th>Trạng thái</th>
                  <th>Cập nhật gần nhất</th>
                  <th>Người chỉnh sửa</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {notificationRuleRows.map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                    <td>{row[3]}</td>
                    <td>{row[4]}</td>
                    <td><CheckCircle2 size={13} /></td>
                    <td><span>{row[5]}</span></td>
                    <td>{row[6]}</td>
                    <td>{row[7]}</td>
                    <td><MoreHorizontal size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer>
            <button type="button"><ChevronLeft size={14} /></button>
            <button type="button" className="is-active">1</button>
            <button type="button">2</button>
            <button type="button">3</button>
            <button type="button"><ChevronRight size={14} /></button>
            <button type="button">10 / trang</button>
          </footer>
        </article>

        <aside className="schedule-notification-side">
          <article className="schedule-notification-panel schedule-notification-confirm">
            <header><strong>Quy trình xác nhận bệnh nhân</strong></header>
            {notificationConfirmSteps.map((step, index) => (
              <div key={step[0]}>
                <span>{index + 1}</span>
                <p><strong>{step[0]}</strong></p>
                <Toggle checked={step[1]} />
                <button type="button">Sửa</button>
              </div>
            ))}
            <button type="button" className="schedule-notification-text-button">Xem tất cả bước bắn</button>
          </article>

          <article className="schedule-notification-panel schedule-notification-quick">
            <header><strong>Tác vụ nhanh</strong></header>
            <div>
              <button type="button"><FileText size={17} />Tạo mẫu mới</button>
              <button type="button"><WandSparkles size={17} />Áp dụng hàng loạt</button>
              <button type="button"><Waves size={17} />Test kênh</button>
              <button type="button"><Bell size={17} />Gửi thử</button>
              <button type="button"><History size={17} />Xem nhật ký</button>
              <button type="button"><Clock3 size={17} />Cài đặt giờ yên lặng</button>
            </div>
          </article>

          <article className="schedule-notification-panel schedule-notification-recent">
            <header><strong>Thay đổi gần đây</strong></header>
            {notificationRecentChanges.map((item) => (
              <div key={`${item[0]}-${item[2]}`}>
                <span>{item[0].split(' ').slice(-2).map((part) => part[0]).join('')}</span>
                <p><strong>{item[0]}</strong>{item[1]}<time>{item[2]}</time></p>
              </div>
            ))}
            <button type="button" className="schedule-notification-text-button">Xem tất cả hoạt động</button>
          </article>

          <article className="schedule-notification-panel schedule-notification-ai">
            <header><strong><Bot size={17} />Khuyến nghị tối ưu (AI)</strong></header>
            {notificationAiRecommendations.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title}>
                  <span><Icon size={16} /></span>
                  <p><strong>{item.title}</strong>{item.copy}</p>
                  <button type="button">Áp dụng</button>
                </div>
              );
            })}
            <button type="button" className="schedule-notification-text-button">Xem tất cả khuyến nghị</button>
          </article>
        </aside>
      </section>

      <footer className="schedule-notification-footer">
        <span><RefreshCcw size={14} />Dữ liệu được đồng bộ lúc 09:15 07/06/2025</span>
        <span><CheckCircle2 size={14} />Hệ thống hoạt động bình thường</span>
        <span><ShieldCheck size={14} />Sao lưu gần nhất: 07/06/2025 02:00</span>
        <span>Hỗ trợ: <b>1900 1234</b></span>
        <span>help@medischedule.vn</span>
      </footer>
    </main>
  );
}

function SchedulingAdvancedDashboardPage() {
  return (
    <main className="schedule-advanced-page">
      <section className="schedule-advanced-hero">
        <div>
          <h1>Nâng cao lịch khám <span>Đang áp dụng</span></h1>
          <p>Thiết lập tự động hóa, đồng bộ, tối ưu AI, sandbox mô phỏng, API và quản trị phiên bản cho module schedule.</p>
        </div>
        <div className="schedule-advanced-actions">
          <button type="button" className="is-primary"><Save size={17} />Lưu thay đổi</button>
          <button type="button"><FileDown size={17} />Xuất cấu hình</button>
          <button type="button" className="is-danger"><RotateCcw size={17} />Khôi phục mặc định</button>
        </div>
      </section>

      <section className="schedule-advanced-metrics" aria-label="Chỉ số nâng cao lịch khám">
        {advancedMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={`is-${metric.tone}`}>
              <div>
                <span><Icon size={18} /></span>
                <small>{metric.label}</small>
              </div>
              <strong>{metric.value}</strong>
              <em>{metric.delta}</em>
              <Sparkline values={metric.series} />
            </article>
          );
        })}
      </section>

      <nav className="schedule-advanced-tabs" aria-label="Nhóm cấu hình nâng cao">
        {advancedTabs.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" className={item.active ? 'is-active' : ''}>
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <section className="schedule-advanced-top-grid">
        <article className="schedule-advanced-panel schedule-advanced-workflow">
          <header>
            <strong>Workflow tự động hóa</strong>
            <div>
              <input placeholder="Tìm kịch bản..." />
              <button type="button"><Plus size={15} />Thêm kịch bản</button>
            </div>
          </header>
          <div className="schedule-advanced-workflow-head">
            <span>Kịch bản</span>
            <span>Điều kiện kích hoạt</span>
            <span>Phạm vi</span>
            <span>Độ ưu tiên</span>
            <span>Trạng thái</span>
            <span>Thao tác</span>
          </div>
          {advancedWorkflowRules.map((row) => (
            <div key={row[0]} className="schedule-advanced-workflow-row">
              <p><span><Bot size={14} /></span><strong>{row[0]}</strong></p>
              <small>{row[1]}</small>
              <small>{row[2]}</small>
              <em className={row[3] === 'Cao' ? 'is-high' : ''}>{row[3]}</em>
              <b className={row[4] === 'Bản nháp' ? 'is-draft' : ''}>{row[4]}</b>
              <span>
                <Toggle checked={row[4] !== 'Bản nháp'} />
                <button type="button"><MoreHorizontal size={14} /></button>
              </span>
            </div>
          ))}
          <footer>
            <span>Hiển thị 1 - 5 trong 9 kịch bản</span>
            <button type="button">10 / trang</button>
          </footer>
        </article>

        <article className="schedule-advanced-panel schedule-advanced-runtime">
          <header><strong>Bộ điều khiển thực thi</strong></header>
          {advancedRuntimeSettings.map((setting) => (
            <label key={setting[0]}>
              <span>{setting[0]}</span>
              {setting[1] === 'toggle' ? <Toggle checked /> : <input defaultValue={setting[1]} />}
            </label>
          ))}
        </article>

        <article className="schedule-advanced-panel schedule-advanced-impact">
          <header>
            <strong>Xem trước tác động</strong>
            <select defaultValue="7 ngày tới"><option>7 ngày tới</option></select>
          </header>
          <div className="schedule-advanced-impact-grid">
            <div className="schedule-advanced-ring" style={{ '--advanced-ring': '328deg' }}>
              <strong>91%</strong>
              <span>Hiệu quả tối ưu dự kiến</span>
            </div>
            <div className="schedule-advanced-impact-list">
              <p><span className="is-green" />Slot dự kiến tối ưu <strong>148</strong></p>
              <p><span className="is-blue" />Lịch được cân bằng <strong>64</strong></p>
              <p><span className="is-orange" />Cảnh báo tránh được <strong>23</strong></p>
              <p><span className="is-red" />Thời gian phản hồi <strong>320ms</strong></p>
            </div>
            <div className="schedule-advanced-chart">
              <strong>Tác động 7 ngày</strong>
              <Sparkline values={[60, 44, 82, 28, 72, 95, 118]} />
              <div>{['26/05', '27/05', '28/05', '29/05', '30/05', '31/05', '01/06'].map((day) => <span key={day}>{day}</span>)}</div>
            </div>
          </div>
          <footer>Dự báo dựa trên dữ liệu 30 ngày gần nhất và kịch bản hiện tại.</footer>
        </article>
      </section>

      <section className="schedule-advanced-middle-grid">
        <article className="schedule-advanced-panel schedule-advanced-sync">
          <header>
            <strong>Luồng đồng bộ & tích hợp</strong>
            <input placeholder="Tìm nguồn tích hợp..." />
          </header>
          <table>
            <thead>
              <tr><th>Nguồn</th><th>Kiểu đồng bộ</th><th>Tần suất</th><th>Trạng thái</th><th>Độ trễ</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {advancedSyncRows.map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td><span className={row[3] === 'Cảnh báo' ? 'is-warning' : ''}>{row[3]}</span></td>
                  <td>{row[4]}</td>
                  <td><MoreHorizontal size={15} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="schedule-advanced-panel schedule-advanced-webhook">
          <header>
            <strong>Webhook & API endpoint</strong>
            <input placeholder="Tìm endpoint..." />
          </header>
          <table>
            <thead>
              <tr><th>Method</th><th>Endpoint</th><th>Xác thực</th><th>Lần chạy cuối</th><th>Trạng thái</th></tr>
            </thead>
            <tbody>
              {advancedWebhookRows.map((row) => (
                <tr key={row[1]}>
                  <td><em>{row[0]}</em></td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                  <td><span>{row[4]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer>Hiển thị 1 - 7 trong 12 endpoint</footer>
        </article>

        <article className="schedule-advanced-panel schedule-advanced-sandbox">
          <header><strong>Mô phỏng sandbox</strong></header>
          <div className="schedule-advanced-sandbox-grid">
            <div className="schedule-advanced-sandbox-form">
              <label><span>Kịch bản</span><select defaultValue="Tối ưu cân bằng tải"><option>Tối ưu cân bằng tải</option></select></label>
              <label><span>Khoa</span><select defaultValue="Khoa Nội tổng hợp"><option>Khoa Nội tổng hợp</option></select></label>
              <label><span>Bác sĩ</span><select defaultValue="Tất cả bác sĩ"><option>Tất cả bác sĩ</option></select></label>
              <label><span>Khoảng thời gian</span><select defaultValue="03/06/2025 - 09/06/2025"><option>03/06/2025 - 09/06/2025</option></select></label>
              <label><input type="checkbox" defaultChecked />Bao gồm overbooking</label>
              <label><input type="checkbox" defaultChecked />Bao gồm nghỉ đột xuất</label>
              <button type="button" className="is-primary"><Video size={16} />Chạy mô phỏng</button>
            </div>
            <div className="schedule-advanced-heatmap">
              <strong>Ma trận xung đột (mức độ)</strong>
              <div className="schedule-advanced-heatmap-head">
                <span />
                {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <b key={day}>{day}</b>)}
              </div>
              {advancedSandboxHeatmap.map((row) => (
                <div key={row[0]}>
                  <span>{row[0]}</span>
                  {row.slice(1).map((cell, index) => <i key={`${row[0]}-${index}`} className={`is-${cell}`} />)}
                </div>
              ))}
              <footer>
                <span>Thấp</span><span>Trung bình</span><span>Cao</span><span>Rất cao</span>
              </footer>
            </div>
          </div>
        </article>
      </section>

      <section className="schedule-advanced-bottom-grid">
        <article className="schedule-advanced-panel schedule-advanced-versions">
          <header><strong>Lịch sử phiên bản cấu hình</strong></header>
          <table>
            <thead>
              <tr><th>Phiên bản</th><th>Người tạo</th><th>Thời gian áp dụng</th><th>Tóm tắt thay đổi</th><th>Trạng thái</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {advancedVersions.map((row) => (
                <tr key={row[0]}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                  <td><span>{row[4]}</span></td>
                  <td><button type="button">Xem diff</button><button type="button">Khôi phục</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="schedule-advanced-panel schedule-advanced-ai">
          <header><strong><Bot size={17} />Khuyến nghị tối ưu (AI)</strong></header>
          {advancedAiRecommendations.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title}>
                <span><Icon size={16} /></span>
                <p>{item.title}</p>
                <em className={item.level === 'Cao' ? 'is-high' : ''}>{item.level}</em>
                <button type="button">Áp dụng</button>
              </div>
            );
          })}
        </article>

        <article className="schedule-advanced-panel schedule-advanced-activity">
          <header><strong>Hoạt động gần đây</strong></header>
          {advancedRecentActivities.map((item) => (
            <div key={`${item[0]}-${item[2]}`}>
              <time>{item[0]}</time>
              <span>{item[1].split(' ').slice(-2).map((part) => part[0]).join('')}</span>
              <p><strong>{item[1]}</strong>{item[2]}</p>
            </div>
          ))}
        </article>

        <article className="schedule-advanced-panel schedule-advanced-security">
          <header><strong>Bảo mật & kiểm soát</strong></header>
          {advancedSecurityControls.map((item) => (
            <div key={item[0]}>
              <p><ShieldCheck size={14} /><span>{item[0]}</span></p>
              <small>{item[1]}</small>
              <Toggle checked />
            </div>
          ))}
          <button type="button" className="schedule-advanced-text-button">Xem nhật ký kiểm soát <ChevronRight size={14} /></button>
        </article>
      </section>

      <footer className="schedule-advanced-footer">
        <span><RefreshCcw size={14} />Dữ liệu được đồng bộ lúc 14:32, 02/06/2025</span>
        <span><CheckCircle2 size={14} />Hệ thống hoạt động bình thường</span>
        <span>Server: sg-sched-02</span>
        <span>Timezone: Asia/Ho_Chi_Minh</span>
        <span>Hỗ trợ: <b>support@medsched.vn</b></span>
        <span>Hotline: <b>1900 1234</b></span>
      </footer>
    </main>
  );
}

export function SchedulingConfigurationPage() {
  const location = useLocation();
  const initialTab = pathToTab[location.pathname] || 'slots';
  const [activeTab, setActiveTab] = useState(initialTab);

  const currentTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTab) || tabs[1],
    [activeTab],
  );

  if (location.pathname === '/scheduling/configuration/templates') {
    return <SchedulingTemplateDashboardPage />;
  }

  if (location.pathname === '/scheduling/configuration/policies') {
    return <SchedulingRulesPolicyDashboardPage />;
  }

  if (location.pathname === '/scheduling/configuration/exceptions') {
    return <SchedulingExceptionsDashboardPage />;
  }

  if (location.pathname === '/scheduling/configuration/telehealth') {
    return <SchedulingTelehealthDashboardPage />;
  }

  if (location.pathname === '/scheduling/configuration/notifications') {
    return <SchedulingNotificationsDashboardPage />;
  }

  if (location.pathname === '/scheduling/configuration/advanced') {
    return <SchedulingAdvancedDashboardPage />;
  }

  return (
    <main className="schedule-config-page">
      <section className="schedule-config-top">
        <div>
          <h1>Cấu hình lịch khám <span>Đang áp dụng</span></h1>
          <p>Thiết lập khung giờ, slot, quy tắc đặt lịch, telehealth, thông báo và các quy định vận hành.</p>
        </div>
        <div className="schedule-config-actions">
          <button type="button" className="is-primary"><Save size={17} />Lưu thay đổi</button>
          <button type="button"><FileDown size={17} />Xuất cấu hình</button>
          <button type="button" className="is-danger"><RotateCcw size={17} />Khôi phục mặc định</button>
        </div>
      </section>

      <section className="schedule-config-metrics">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={`is-${card.tone}`}>
              <div className="schedule-config-metric-head">
                <span><Icon size={18} /></span>
                <small>{card.label}</small>
              </div>
              <strong>{card.value}</strong>
              <em>{card.delta}</em>
              <Sparkline values={card.series} />
            </article>
          );
        })}
      </section>

      <nav className="schedule-config-tabs" aria-label="Nhóm cấu hình lịch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={currentTab.id === tab.id ? 'is-active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <section className="schedule-config-architecture" aria-label="Luồng kiến trúc cấu hình">
        {architectureCards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className={`is-${item.tone}`}>
              <span><Icon size={18} /></span>
              <div>
                <small>{item.label}</small>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="schedule-config-stack">
        <section className="schedule-config-section schedule-config-section-core">
          <header className="schedule-config-section-head">
            <div>
              <span>Nền tảng vận hành</span>
              <h2>Thiết lập cốt lõi</h2>
            </div>
            <p>Chốt khung làm việc, thời lượng slot và các quy tắc giữ lịch ổn định trước khi áp dụng hàng loạt.</p>
          </header>
          <div className="schedule-config-core-grid">
          <section className="schedule-config-card schedule-work-hours">
            <header>
              <div>
                <strong>Giờ làm việc theo ngày</strong>
                <Info size={14} />
              </div>
              <button type="button"><Plus size={15} />Thêm phiên</button>
            </header>
            <div className="schedule-work-table">
              {workDays.map((item) => (
                <div key={item.day} className={!item.enabled ? 'is-muted' : ''}>
                  <span>{item.day}</span>
                  <Toggle checked={item.enabled} />
                  <button type="button">{item.start}</button>
                  {item.enabled ? <small>→</small> : null}
                  {item.enabled ? <button type="button">{item.lunchStart}</button> : null}
                  {item.enabled && item.lunchEnd ? <button type="button">{item.lunchEnd}</button> : null}
                  {item.enabled && item.end ? <button type="button">{item.end}</button> : null}
                  {item.day === 'Thứ 2' ? <em>Nghỉ trưa <b>12:00 → 13:30</b> 30 phút</em> : null}
                  {item.extra ? <button type="button">{item.extra}</button> : null}
                  <button type="button" className="is-icon"><Plus size={15} /></button>
                </div>
              ))}
            </div>
            <footer>
              <Info size={15} />
              <span>Thiết lập nhiều phiên làm việc trong ngày. Kéo để sắp xếp hoặc nhấn “+” để thêm phiên.</span>
            </footer>
          </section>

          <section className="schedule-config-card schedule-slot-rules">
            <div className="schedule-slot-settings">
              <header>
                <div>
                  <strong>Thiết lập slot mặc định</strong>
                  <Info size={14} />
                </div>
              </header>
              <label><span>Thời lượng slot</span><select defaultValue="15 phút"><option>15 phút</option><option>20 phút</option><option>30 phút</option></select></label>
              <label><span>Đệm trước khám</span><select defaultValue="10 phút"><option>10 phút</option><option>15 phút</option></select></label>
              <label><span>Đệm sau khám</span><select defaultValue="5 phút"><option>5 phút</option><option>10 phút</option></select></label>
              <label><span>Giới hạn bệnh nhân / slot</span><input defaultValue="1" /></label>
              <label><span>Tự động chia slot</span><Toggle checked /></label>
              <label><span>Cho phép overbook <Info size={13} /></span><Toggle checked /></label>
              <label><span>Giới hạn overbook</span><input defaultValue="20 %" /></label>
              <label><span>Ưu tiên khám nhanh <Info size={13} /></span><select defaultValue="Ưu tiên cao"><option>Ưu tiên cao</option><option>Tiêu chuẩn</option></select></label>
              <label><span>Thời gian khóa trước lịch</span><select defaultValue="60 phút"><option>60 phút</option><option>120 phút</option></select></label>
              <label><span>Tự động đóng đặt lịch <Info size={13} /></span><Toggle checked /></label>
            </div>

            <div className="schedule-smart-rules">
              <header>
                <strong>Quy tắc thông minh</strong>
                <button type="button"><Plus size={15} />Thêm quy tắc</button>
              </header>
              {smartRules.map((rule) => {
                const Icon = rule.icon;
                return (
                  <article key={rule.title} className={`is-${rule.tone}`}>
                    <span><Icon size={17} /></span>
                    <div>
                      <strong>{rule.title}</strong>
                      <small>{rule.copy}</small>
                    </div>
                    <Toggle checked={rule.enabled} />
                  </article>
                );
              })}
              <button type="button" className="schedule-text-button">Xem tất cả quy tắc (12)</button>
            </div>
          </section>

          </div>
        </section>

        <section className="schedule-config-section schedule-config-section-template">
          <header className="schedule-config-section-head">
            <div>
              <span>Chuẩn triển khai</span>
              <h2>Thư viện mẫu lịch</h2>
            </div>
            <p>Quản lý các bộ cấu hình đã chuẩn hóa theo khoa, bác sĩ và hình thức khám để tái sử dụng nhanh.</p>
          </header>
          <section className="schedule-config-template-grid">
            <article className="schedule-config-card schedule-template-cards">
              <header>
                <strong>Mẫu lịch đang dùng</strong>
                <button type="button">Xem tất cả <ChevronRight size={14} /></button>
              </header>
              <div>
                {templates.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button key={template.name} type="button" className={`is-${template.tone}`}>
                      <MoreHorizontal size={15} />
                      <span><Icon size={18} /></span>
                      <strong>{template.name}</strong>
                      <em>{template.status}</em>
                      <small>Áp dụng: {template.departments}<br />{template.doctors}</small>
                      <small>Cập nhật:<br />{template.updated}</small>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="schedule-config-card schedule-template-table">
              <header>
                <strong>Danh sách mẫu lịch</strong>
              </header>
              <table>
                <thead>
                  <tr>
                    <th>Tên mẫu</th>
                    <th>Phạm vi áp dụng</th>
                    <th>Slot/ngày</th>
                    <th>Thời lượng</th>
                    <th>Trạng thái</th>
                    <th>Cập nhật gần nhất</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {templateRows.map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                      <td><span className={row[4] === 'Dự phòng' ? 'is-draft' : ''}>{row[4]}</span></td>
                      <td>{row[5]}</td>
                      <td><MoreHorizontal size={16} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <footer>
                <span>Hiển thị 1 - 5 trong 5 mẫu</span>
                <div>
                  <button type="button"><ChevronLeft size={14} /></button>
                  <button type="button" className="is-active">1</button>
                  <button type="button"><ChevronRight size={14} /></button>
                </div>
              </footer>
            </article>
          </section>
        </section>

        <section className="schedule-config-section schedule-config-section-control">
          <header className="schedule-config-section-head">
            <div>
              <span>Kiểm soát trước áp dụng</span>
              <h2>Mô phỏng & cảnh báo</h2>
            </div>
            <p>Xem trước tải lịch sau thay đổi, ước lượng tác động và khóa các cấu hình có rủi ro vận hành.</p>
          </header>
          <div className="schedule-config-control-grid">
          <section className="schedule-config-card schedule-preview-card">
            <header>
              <strong>Xem trước lịch áp dụng</strong>
              <button type="button">Thứ 2, 02/06/2025 <CalendarDays size={14} /></button>
            </header>
            <div className="schedule-preview-grid">
              <div className="schedule-preview-table">
                <div className="schedule-preview-head"><span>Giờ</span><span>Slot</span><span>Sức chứa</span><span>Đặt trước</span></div>
                {previewRows.map((row) => (
                  <div key={row.time} className={row.isBreak ? 'is-break' : ''}>
                    <span>{row.time}</span>
                    {row.isBreak ? (
                      <strong>{row.capacity}</strong>
                    ) : (
                      <>
                        <DotGroup dots={row.dots} />
                        <span className="schedule-preview-capacity">{row.capacity}</span>
                      </>
                    )}
                  </div>
                ))}
                <footer>
                  <span><i className="is-green" />Trống</span>
                  <span><i className="is-orange" />Gần đầy</span>
                  <span><i className="is-red" />Quá tải</span>
                </footer>
              </div>
              <div className="schedule-preview-donut">
                <div>
                  <span>Số slot / ngày</span>
                  <strong>48</strong>
                </div>
                <div>
                  <span>Sức chứa / tuần</span>
                  <strong>1.440</strong>
                </div>
                <div className="schedule-donut" style={{ '--config-ring': '295deg' }}>
                  <strong>Dự kiến<br />82%</strong>
                </div>
                <p>Tỷ lệ lấp đầy dự kiến <b>82%</b></p>
                <p>Overbook dự kiến <b>18%</b></p>
                <small>Slot trống / ngày <b>9</b></small>
              </div>
            </div>
          </section>

          <section className="schedule-config-side-grid">
            <article className="schedule-config-card schedule-impact-card">
              <strong>Tác động ước tính (7 ngày tới)</strong>
              {['Số lượt khám dự kiến', 'Doanh thu dự kiến', 'Hiệu suất bác sĩ', 'No-show dự kiến'].map((item, index) => (
                <div key={item}>
                  <span>{item}</span>
                  <em>{index === 3 ? '-0.8%' : `+${[12, 15, 8][index]}%`}</em>
                  <Sparkline values={[18, 24, 20, 26, 22, 30, 24]} />
                </div>
              ))}
            </article>

            <article className="schedule-config-card schedule-warning-card">
              <strong>Cảnh báo cấu hình</strong>
              <span><Flame size={14} />Thứ 7 chỉ có buổi sáng, có thể gây thiếu slot</span>
              <span><Flame size={14} />Tỷ lệ overbook (20%) đang khá cao</span>
              <span><Flame size={14} />Nên bật khóa phòng khi vượt 120%</span>
              <button type="button">Xem tất cả (3)</button>
            </article>
          </section>

          </div>
        </section>

        <section className="schedule-config-section schedule-config-section-ops">
          <header className="schedule-config-section-head">
            <div>
              <span>Vận hành hằng ngày</span>
              <h2>Thao tác, nhật ký & tối ưu</h2>
            </div>
            <p>Nhóm các thao tác thực thi, lịch sử chỉnh sửa và gợi ý tối ưu để đội điều phối xử lý sau khi cấu hình.</p>
          </header>
          <section className="schedule-config-side-bottom">
            <article className="schedule-config-card schedule-quick-actions">
              <header><strong>Thao tác nhanh</strong></header>
              <div>
                <button type="button"><Copy size={17} />Nhân bản cấu hình</button>
                <button type="button"><WandSparkles size={17} />Áp dụng hàng loạt</button>
                <button type="button"><Upload size={17} />Import từ Excel</button>
                <button type="button"><ShieldCheck size={17} />Kiểm tra xung đột</button>
                <button type="button"><RefreshCcw size={17} />Xem nhật ký</button>
                <button type="button"><Download size={17} />Xuất cấu hình</button>
              </div>
            </article>

            <article className="schedule-config-card schedule-recent-card">
              <header><strong>Thay đổi gần đây</strong></header>
              {recentChanges.map((item) => (
                <div key={`${item[0]}-${item[3]}`}>
                  <span>{item[0].split(' ').slice(-2).map((part) => part[0]).join('')}</span>
                  <div>
                    <strong>{item[0]}</strong>
                    <small>{item[1]}</small>
                    <p>{item[2]}</p>
                  </div>
                  <time>{item[3]}</time>
                </div>
              ))}
            </article>

            <article className="schedule-config-card schedule-ai-card">
              <header>
                <strong><Bot size={17} />Khuyến nghị tối ưu (AI)</strong>
              </header>
              {aiRecommendations.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title}>
                    <span><Icon size={16} /></span>
                    <p><strong>{item.title}</strong> {item.copy}</p>
                    <button type="button">Áp dụng</button>
                  </div>
                );
              })}
              <button type="button" className="schedule-text-button">Xem thêm gợi ý khác (5)</button>
            </article>
          </section>
        </section>
      </section>
    </main>
  );
}
