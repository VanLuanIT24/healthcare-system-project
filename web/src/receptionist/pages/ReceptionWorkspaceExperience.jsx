import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  CreditCard,
  FileText,
  Filter,
  Headset,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Route,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Ticket,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { receptionAppointmentsApi } from '../api/receptionAppointmentsApi';
import { receptionDataApi } from '../api/receptionDataApi';
import { receptionQueueApi } from '../api/receptionQueueApi';

export const RECEPTION_WORKSPACE_PAGE_KEYS = new Set([
  'overview-dashboard',
  'overview-tasks',
  'appointments-upcoming',
  'overview-waiting-patients',
  'checkin-done',
  'overview-queue-counter',
  'notifications-all',
  'patients-search',
  'patients-qr-scan',
  'patients-identity-lookup',
  'patients-duplicate-check',
  'patients-duplicate-review',
  'patients-recent-lookups',
  'patients-create',
  'patients-record',
  'patients-contact',
  'patients-emergency-contact',
  'patients-identifiers',
  'patients-portal-account',
  'patients-basic-insurance',
  'patients-profile-update-requests',
  'patients-missing-personal-info',
  'patients-missing-documents',
  'patients-missing-insurance',
  'patients-unverified-contact',
  'patients-uploaded-documents',
  'patients-edit-requests',
  'appointments-today',
  'appointments-create',
  'appointments-confirm',
  'appointments-reschedule',
  'appointments-cancelled',
  'appointments-waitlist',
  'appointments-slot-check',
  'appointments-conflict-check',
  'checkin-quick',
  'checkin-appointment',
  'checkin-qr',
  'checkin-walkin',
  'checkin-errors',
  'checkin-print',
  'checkin-history',
  'queue-board',
  'queue-call',
  'queue-recall',
  'queue-missed',
  'queue-priority',
  'queue-transfer',
  'queue-cancel',
  'queue-public-board',
  'transfer-nursing',
  'transfer-doctor',
  'transfer-cashier',
  'transfer-clinical-service',
  'transfer-pharmacy',
  'transfer-history',
  'payments-pending',
  'payments-status',
  'payments-qr-guide',
  'payments-confirmation',
  'payments-transfer-cashier',
  'support-tickets',
  'support-patient-messages',
  'support-send-notification',
  'support-portal-guide',
  'support-booking-guide',
  'support-complaints',
  'reports-daily',
  'reports-reception-volume',
  'reports-checkin',
  'reports-no-show',
  'reports-wait-time',
  'reports-transfer',
  'reports-counter-performance',
  'settings-account',
  'settings-ui',
  'settings-printer',
  'settings-shortcuts',
  'settings-notifications',
]);

const PAGE_CONFIG = {
  'overview-tasks': {
    eyebrow: 'Worklist',
    title: 'Việc cần xử lý',
    subtitle: 'Gom các việc mở tại quầy theo SLA để lễ tân xử lý ngay trong ca.',
    icon: ClipboardList,
    tone: 'warning',
    primaryAction: { label: 'Tạo ticket hỗ trợ', icon: Plus, target: 'support-tickets' },
    filters: ['Loại việc', 'Ưu tiên', 'SLA', 'Nguồn'],
    columns: ['Ưu tiên', 'Loại việc', 'Bệnh nhân', 'Mô tả', 'SLA', 'Trạng thái'],
  },
  'patients-qr-scan': {
    eyebrow: 'QR identity',
    title: 'Quét QR bệnh nhân',
    subtitle: 'Xác minh token QR và mở đúng bệnh nhân, lịch hẹn, queue hoặc thanh toán liên quan.',
    icon: QrCode,
    tone: 'info',
    primaryAction: { label: 'Nhập token thủ công', icon: Search },
    filters: ['Loại token', 'Trạng thái', 'Nguồn', 'Thời gian'],
    columns: ['Thời gian', 'Loại QR', 'Bệnh nhân', 'Entity', 'Trạng thái', 'Thao tác'],
  },
  'patients-identity-lookup': {
    eyebrow: 'Identity lookup',
    title: 'Tra cứu theo CCCD / SĐT',
    subtitle: 'Ưu tiên exact match theo số điện thoại và CCCD trước khi tạo mới hồ sơ.',
    icon: Search,
    tone: 'info',
    primaryAction: { label: 'Kiểm tra trùng', icon: ShieldAlert, target: 'patients-duplicate-check' },
    filters: ['SĐT', 'CCCD', 'Có lịch hôm nay', 'Trạng thái xác minh'],
    columns: ['Định danh', 'Bệnh nhân', 'SĐT', 'CCCD', 'Hồ sơ', 'Action'],
  },
  'patients-duplicate-check': {
    eyebrow: 'Duplicate control',
    title: 'Kiểm tra trùng hồ sơ',
    subtitle: 'So khớp họ tên, ngày sinh, CCCD, SĐT và email trước khi tạo hoặc cập nhật hồ sơ.',
    icon: ShieldAlert,
    tone: 'danger',
    primaryAction: { label: 'Chạy kiểm tra', icon: RefreshCw },
    filters: ['Độ tin cậy', 'Nguồn phát hiện', 'Có bill', 'Có lịch hôm nay'],
    columns: ['Điểm giống', 'Hồ sơ A', 'Hồ sơ B', 'Trường trùng', 'Nguồn', 'Trạng thái'],
  },
  'patients-duplicate-review': {
    eyebrow: 'Duplicate queue',
    title: 'Hồ sơ nghi trùng',
    subtitle: 'Danh sách cụm hồ sơ cần rà soát, đánh dấu không trùng hoặc chuyển duyệt gộp.',
    icon: ShieldAlert,
    tone: 'danger',
    primaryAction: { label: 'Gửi duyệt gộp', icon: Send },
    filters: ['Tin cậy', 'Trạng thái', 'Nguồn', 'Người phụ trách'],
    columns: ['Cụm hồ sơ', 'Bệnh nhân chính', 'Số hồ sơ', 'Điểm giống', 'Nguồn', 'Action'],
  },
  'patients-recent-lookups': {
    eyebrow: 'Lookup history',
    title: 'Lịch sử tra cứu gần đây',
    subtitle: 'Quay lại nhanh các bệnh nhân, lịch hẹn và queue vừa được tra cứu trong ca.',
    icon: History,
    tone: 'neutral',
    primaryAction: { label: 'Làm mới', icon: RefreshCw },
    filters: ['Người tra cứu', 'Loại tra cứu', 'Action sau tra cứu', 'Thời gian'],
    columns: ['Thời gian', 'Từ khóa', 'Loại tra cứu', 'Bệnh nhân mở', 'Action sau đó', 'Người tra cứu'],
  },
  'patients-contact': {
    eyebrow: 'Administrative profile',
    title: 'Thông tin liên hệ',
    subtitle: 'Quản lý SĐT, email, địa chỉ liên hệ và kênh nhận thông báo của bệnh nhân.',
    icon: Phone,
    tone: 'success',
    primaryAction: { label: 'Xác minh liên hệ', icon: UserCheck },
    filters: ['Chưa xác minh', 'Có lịch hôm nay', 'Portal active', 'Nguồn cập nhật'],
    columns: ['Bệnh nhân', 'SĐT', 'Email', 'Địa chỉ', 'Xác minh', 'Action'],
  },
  'patients-emergency-contact': {
    eyebrow: 'Relatives',
    title: 'Người thân / liên hệ khẩn cấp',
    subtitle: 'Theo dõi người thân, liên hệ khẩn cấp và quyền hỗ trợ đặt lịch cho bệnh nhân.',
    icon: Users,
    tone: 'success',
    primaryAction: { label: 'Thêm liên hệ', icon: Plus },
    filters: ['Quan hệ', 'Khẩn cấp', 'Có quyền portal', 'Trạng thái'],
    columns: ['Bệnh nhân', 'Người liên hệ', 'Quan hệ', 'SĐT', 'Quyền', 'Trạng thái'],
  },
  'patients-identifiers': {
    eyebrow: 'Identifiers',
    title: 'Định danh bệnh nhân',
    subtitle: 'Quản lý CCCD, hộ chiếu, mã BHYT, định danh nội bộ và giấy tờ xác minh.',
    icon: FileText,
    tone: 'info',
    primaryAction: { label: 'Thêm định danh', icon: Plus },
    filters: ['Loại định danh', 'Primary', 'Chưa xác minh', 'Hết hạn'],
    columns: ['Bệnh nhân', 'Loại định danh', 'Giá trị', 'Primary', 'Xác minh', 'Tài liệu'],
  },
  'patients-portal-account': {
    eyebrow: 'Portal',
    title: 'Tài khoản portal',
    subtitle: 'Tạo, liên kết và gửi hướng dẫn portal cho bệnh nhân hoặc người thân được ủy quyền.',
    icon: UserCheck,
    tone: 'info',
    primaryAction: { label: 'Gửi invite portal', icon: Send },
    filters: ['Chưa có tài khoản', 'Chờ kích hoạt', 'Bị khóa', 'Đã link'],
    columns: ['Bệnh nhân', 'Email/SĐT', 'Portal', 'Kích hoạt', 'Đăng nhập gần nhất', 'Action'],
  },
  'patients-basic-insurance': {
    eyebrow: 'Insurance',
    title: 'Bảo hiểm cơ bản',
    subtitle: 'Nhập thông tin bảo hiểm ban đầu và chuyển xác minh cho bộ phận phụ trách.',
    icon: CreditCard,
    tone: 'warning',
    primaryAction: { label: 'Thêm bảo hiểm', icon: Plus },
    filters: ['Thiếu bảo hiểm', 'Chờ xác minh', 'Sắp hết hạn', 'Có ảnh thẻ'],
    columns: ['Bệnh nhân', 'Số thẻ', 'Loại BH', 'Hiệu lực', 'Xác minh', 'Action'],
  },
  'patients-profile-update-requests': {
    eyebrow: 'Change requests',
    title: 'Yêu cầu cập nhật hồ sơ',
    subtitle: 'So sánh giá trị cũ và mới trước khi duyệt, từ chối hoặc yêu cầu bổ sung.',
    icon: ClipboardList,
    tone: 'warning',
    primaryAction: { label: 'Duyệt thay đổi', icon: CheckCircle2 },
    filters: ['Chờ duyệt', 'Cần bổ sung', 'Nguồn portal', 'Có tài liệu'],
    columns: ['Bệnh nhân', 'Trường thay đổi', 'Giá trị cũ', 'Giá trị mới', 'Nguồn', 'Trạng thái'],
  },
  'patients-missing-personal-info': {
    eyebrow: 'Profile completion',
    title: 'Thiếu thông tin cá nhân',
    subtitle: 'Danh sách hồ sơ còn thiếu trường hành chính bắt buộc trước khi check-in hoặc đặt lịch.',
    icon: ShieldAlert,
    tone: 'warning',
    primaryAction: { label: 'Bổ sung nhanh', icon: Plus },
    filters: ['Trường thiếu', 'Bắt buộc', 'Ảnh hưởng check-in', 'Có lịch hôm nay'],
    columns: ['Bệnh nhân', 'Trường thiếu', 'Bắt buộc', 'Lịch gần nhất', 'Ảnh hưởng', 'Action'],
  },
  'patients-missing-documents': {
    eyebrow: 'Documents',
    title: 'Thiếu giấy tờ',
    subtitle: 'Theo dõi giấy tờ bắt buộc theo hồ sơ, dịch vụ, bảo hiểm và lịch hẹn liên quan.',
    icon: FileText,
    tone: 'warning',
    primaryAction: { label: 'Yêu cầu upload', icon: Send },
    filters: ['Loại giấy tờ', 'Rule', 'SLA', 'Nguồn'],
    columns: ['Bệnh nhân', 'Giấy tờ thiếu', 'Rule', 'Lịch/Dịch vụ', 'SLA', 'Action'],
  },
  'patients-missing-insurance': {
    eyebrow: 'Insurance gap',
    title: 'Thiếu bảo hiểm',
    subtitle: 'Phát hiện bệnh nhân cần bổ sung hoặc cập nhật bảo hiểm trước khi thực hiện dịch vụ.',
    icon: CreditCard,
    tone: 'warning',
    primaryAction: { label: 'Thêm bảo hiểm', icon: Plus },
    filters: ['Không có BH', 'Hết hạn', 'Thiếu ảnh thẻ', 'Chờ xác minh'],
    columns: ['Bệnh nhân', 'Lịch liên quan', 'Bảo hiểm cần có', 'Hiện trạng', 'Tài liệu', 'Action'],
  },
  'patients-unverified-contact': {
    eyebrow: 'Contact verification',
    title: 'Chưa xác minh SĐT / email',
    subtitle: 'Theo dõi liên hệ chưa xác minh để giảm lỗi nhắc lịch, portal và thông báo thanh toán.',
    icon: Mail,
    tone: 'warning',
    primaryAction: { label: 'Gửi mã xác minh', icon: Send },
    filters: ['SĐT chưa xác minh', 'Email chưa xác minh', 'Thất bại nhiều lần', 'Portal'],
    columns: ['Bệnh nhân', 'SĐT', 'Email', 'Lần gửi mã', 'Số lần lỗi', 'Action'],
  },
  'patients-uploaded-documents': {
    eyebrow: 'Patient uploads',
    title: 'Tài liệu bệnh nhân gửi lên',
    subtitle: 'Duyệt, từ chối hoặc yêu cầu gửi lại các tài liệu bệnh nhân upload qua portal.',
    icon: FileText,
    tone: 'info',
    primaryAction: { label: 'Duyệt tài liệu', icon: CheckCircle2 },
    filters: ['Chờ duyệt', 'Loại tài liệu', 'Nguồn', 'Có bảo hiểm'],
    columns: ['Bệnh nhân', 'Tài liệu', 'Nguồn', 'Ngày gửi', 'Trạng thái', 'Action'],
  },
  'patients-edit-requests': {
    eyebrow: 'Pending edits',
    title: 'Yêu cầu chỉnh sửa chờ duyệt',
    subtitle: 'Rà soát thay đổi bệnh nhân gửi lên và yêu cầu thêm giấy tờ khi cần.',
    icon: ClipboardList,
    tone: 'warning',
    primaryAction: { label: 'So sánh thay đổi', icon: FileText },
    filters: ['Trường thay đổi', 'Nguồn', 'Risk', 'Có chứng minh'],
    columns: ['Bệnh nhân', 'Field', 'Hiện tại', 'Đề xuất', 'Risk', 'Action'],
  },
  'appointments-waitlist': {
    eyebrow: 'Waitlist',
    title: 'Danh sách chờ',
    subtitle: 'Quản lý bệnh nhân đang chờ slot phù hợp và gửi offer khi có lịch trống.',
    icon: CalendarDays,
    tone: 'info',
    primaryAction: { label: 'Offer slot', icon: Send },
    filters: ['Khoa', 'Bác sĩ', 'Độ ưu tiên', 'Hết hạn'],
    columns: ['Bệnh nhân', 'Khoa/Bác sĩ', 'Khung giờ mong muốn', 'Ưu tiên', 'SLA', 'Action'],
  },
  'appointments-slot-check': {
    eyebrow: 'Slot finder',
    title: 'Kiểm tra slot trống',
    subtitle: 'Tìm slot gần nhất theo khoa, bác sĩ, loại lịch, thời lượng và khung giờ mong muốn.',
    icon: CalendarDays,
    tone: 'info',
    primaryAction: { label: 'Tìm slot', icon: Search },
    filters: ['Khoa', 'Bác sĩ', 'Ngày', 'Thời lượng'],
    columns: ['Ngày', 'Khung giờ', 'Bác sĩ', 'Khoa', 'Slot còn lại', 'Action'],
  },
  'appointments-conflict-check': {
    eyebrow: 'Conflict check',
    title: 'Kiểm tra xung đột lịch',
    subtitle: 'Kiểm tra trùng lịch bệnh nhân, bác sĩ, slot và schedule trước khi xác nhận.',
    icon: ShieldAlert,
    tone: 'warning',
    primaryAction: { label: 'Kiểm tra', icon: RefreshCw },
    filters: ['Patient', 'Doctor', 'Slot', 'Schedule'],
    columns: ['Đối tượng', 'Loại xung đột', 'Thời gian', 'Mức độ', 'Khuyến nghị', 'Action'],
  },
  'checkin-qr': {
    eyebrow: 'QR check-in',
    title: 'Check-in theo QR',
    subtitle: 'Quét QR appointment, verify token, check-in và tạo queue ticket trong một luồng.',
    icon: QrCode,
    tone: 'success',
    primaryAction: { label: 'Mở scanner', icon: QrCode },
    filters: ['Token hợp lệ', 'Hết hạn', 'Đã dùng', 'Lỗi'],
    columns: ['Thời gian', 'Token', 'Bệnh nhân', 'Appointment', 'Kết quả', 'Action'],
  },
  'checkin-walkin': {
    eyebrow: 'Walk-in',
    title: 'Check-in vãng lai',
    subtitle: 'Tiếp nhận bệnh nhân không có lịch, chọn điểm đến và tạo queue hoặc encounter phù hợp.',
    icon: UserPlus,
    tone: 'success',
    primaryAction: { label: 'Tạo lượt vãng lai', icon: Plus },
    filters: ['Khoa', 'Luồng xử lý', 'Ưu tiên', 'Có hồ sơ'],
    columns: ['Bệnh nhân', 'Lý do đến', 'Điểm đến', 'Ưu tiên', 'Queue', 'Action'],
  },
  'checkin-errors': {
    eyebrow: 'Exception handling',
    title: 'Check-in lỗi / cần xử lý',
    subtitle: 'Theo dõi lỗi QR, lỗi appointment, lỗi queue hoặc hồ sơ thiếu trong quá trình check-in.',
    icon: AlertTriangle,
    tone: 'danger',
    primaryAction: { label: 'Thử lại lỗi', icon: RefreshCw },
    filters: ['Lỗi QR', 'Appointment', 'Queue', 'Payment blocking'],
    columns: ['Thời gian', 'Bệnh nhân', 'Nguồn', 'Lỗi', 'Entity', 'Action'],
  },
  'checkin-history': {
    eyebrow: 'Check-in audit',
    title: 'Lịch sử check-in',
    subtitle: 'Tra cứu lịch sử check-in theo ngày, quầy, nhân viên, nguồn và kết quả.',
    icon: History,
    tone: 'neutral',
    primaryAction: { label: 'Xuất dữ liệu', icon: FileText },
    filters: ['Ngày', 'Quầy', 'Nhân viên', 'Kiểu check-in'],
    columns: ['Thời gian', 'Bệnh nhân', 'Appointment', 'Queue', 'Kiểu', 'Kết quả'],
  },
  'queue-priority': {
    eyebrow: 'Priority queue',
    title: 'Ưu tiên',
    subtitle: 'Đặt mức ưu tiên có lý do và theo dõi bệnh nhân cần phục vụ trước trong queue.',
    icon: ShieldAlert,
    tone: 'warning',
    primaryAction: { label: 'Đặt ưu tiên', icon: ShieldCheck },
    filters: ['Loại ưu tiên', 'Khoa', 'Thời gian chờ', 'Nguồn'],
    columns: ['Số queue', 'Bệnh nhân', 'Loại ưu tiên', 'Lý do', 'Thời gian chờ', 'Action'],
  },
  'queue-public-board': {
    eyebrow: 'Public board',
    title: 'Bảng queue công khai',
    subtitle: 'Màn hình công khai số đang gọi, phòng/quầy và danh sách sắp tới.',
    icon: Ticket,
    tone: 'info',
    primaryAction: { label: 'Mở bảng công khai', icon: ArrowRight },
    filters: ['Khoa', 'Phòng', 'Quầy', 'Trạng thái'],
    columns: ['Đang gọi', 'Phòng/Quầy', 'Sắp tới', 'Khoa', 'Cập nhật', 'Action'],
  },
  'transfer-history': {
    eyebrow: 'Routing timeline',
    title: 'Lịch sử chuyển tuyến',
    subtitle: 'Theo dõi luồng bệnh nhân từ lễ tân sang điều dưỡng, bác sĩ, thu ngân, cận lâm sàng hoặc nhà thuốc.',
    icon: History,
    tone: 'neutral',
    primaryAction: { label: 'Tìm theo bệnh nhân', icon: Search },
    filters: ['Điểm đến', 'Trạng thái', 'Nhân viên', 'Thời gian'],
    columns: ['Thời gian', 'Bệnh nhân', 'Từ', 'Đến', 'Lý do', 'Trạng thái'],
  },
  'payments-status': {
    eyebrow: 'Payment status',
    title: 'Trạng thái thanh toán',
    subtitle: 'Tra cứu hóa đơn, payment intent, trạng thái QR và biên nhận để hướng dẫn bệnh nhân.',
    icon: CreditCard,
    tone: 'warning',
    primaryAction: { label: 'Tìm hóa đơn', icon: Search },
    filters: ['Unpaid', 'Partial', 'Paid', 'Manual review'],
    columns: ['Bệnh nhân', 'Hóa đơn', 'Số tiền', 'Trạng thái', 'QR/Provider', 'Action'],
  },
  'payments-qr-guide': {
    eyebrow: 'QR payment',
    title: 'Hướng dẫn QR thanh toán',
    subtitle: 'Hiển thị QR, nội dung chuyển khoản, thời hạn và trạng thái realtime cho bệnh nhân.',
    icon: QrCode,
    tone: 'warning',
    primaryAction: { label: 'Tạo QR', icon: QrCode },
    filters: ['Còn hạn', 'Hết hạn', 'Đã thanh toán', 'Lỗi provider'],
    columns: ['Hóa đơn', 'Bệnh nhân', 'Số tiền', 'QR', 'Hết hạn', 'Action'],
  },
  'payments-confirmation': {
    eyebrow: 'Payment review',
    title: 'Payment cần xác nhận',
    subtitle: 'Theo dõi payment pending và chuyển thu ngân xác nhận khi cần.',
    icon: Banknote,
    tone: 'warning',
    primaryAction: { label: 'Chuyển thu ngân', icon: Route },
    filters: ['Manual review', 'Bank QR', 'Quá hạn', 'Provider'],
    columns: ['Payment', 'Bệnh nhân', 'Invoice', 'Số tiền', 'Provider', 'Action'],
  },
  'payments-transfer-cashier': {
    eyebrow: 'Cashier routing',
    title: 'Chuyển sang thu ngân',
    subtitle: 'Tạo luồng chuyển bệnh nhân và ghi chú cho thu ngân xử lý hóa đơn.',
    icon: Route,
    tone: 'warning',
    primaryAction: { label: 'Tạo chuyển thu ngân', icon: Send },
    filters: ['Hóa đơn chờ thu', 'Ưu tiên', 'Khoa', 'Nguồn'],
    columns: ['Bệnh nhân', 'Invoice', 'Số tiền', 'Lý do chuyển', 'Priority', 'Action'],
  },
  'support-tickets': {
    eyebrow: 'Support desk',
    title: 'Support tickets',
    subtitle: 'Tạo, phân công và xử lý ticket hỗ trợ bệnh nhân tại quầy.',
    icon: Headset,
    tone: 'info',
    primaryAction: { label: 'Tạo ticket', icon: Plus },
    filters: ['Mới', 'Đang xử lý', 'Quá SLA', 'Ưu tiên cao'],
    columns: ['Ticket', 'Bệnh nhân', 'Chủ đề', 'Priority', 'SLA', 'Trạng thái'],
  },
  'support-patient-messages': {
    eyebrow: 'Patient inbox',
    title: 'Tin nhắn bệnh nhân',
    subtitle: 'Inbox bệnh nhân với context hồ sơ, lịch hẹn, queue và ticket liên quan.',
    icon: MessageSquare,
    tone: 'info',
    primaryAction: { label: 'Trả lời', icon: Send },
    filters: ['Chưa đọc', 'Được giao cho tôi', 'Portal', 'Escalated'],
    columns: ['Cuộc hội thoại', 'Bệnh nhân', 'Tin nhắn cuối', 'Kênh', 'Assignee', 'Trạng thái'],
  },
  'support-send-notification': {
    eyebrow: 'Notification',
    title: 'Gửi thông báo',
    subtitle: 'Gửi thông báo theo bệnh nhân, lịch hẹn, queue hoặc invoice với template phù hợp.',
    icon: Bell,
    tone: 'info',
    primaryAction: { label: 'Soạn thông báo', icon: Send },
    filters: ['Template', 'Kênh', 'Người nhận', 'Lên lịch'],
    columns: ['Template', 'Người nhận', 'Kênh', 'Entity', 'Trạng thái', 'Action'],
  },
  'support-portal-guide': {
    eyebrow: 'Portal guide',
    title: 'Hướng dẫn portal',
    subtitle: 'Gửi invite, in hướng dẫn và kiểm tra trạng thái portal của bệnh nhân.',
    icon: UserCheck,
    tone: 'success',
    primaryAction: { label: 'Gửi hướng dẫn', icon: Send },
    filters: ['Chưa kích hoạt', 'Đã kích hoạt', 'Bị khóa', 'Cần invite'],
    columns: ['Bệnh nhân', 'Portal', 'Email/SĐT', 'Kích hoạt', 'Đăng nhập cuối', 'Action'],
  },
  'support-booking-guide': {
    eyebrow: 'Booking guide',
    title: 'Hướng dẫn đặt lịch',
    subtitle: 'Hỗ trợ bệnh nhân tra slot, gửi link đặt lịch và in hướng dẫn thao tác.',
    icon: CalendarDays,
    tone: 'success',
    primaryAction: { label: 'Gửi link đặt lịch', icon: Send },
    filters: ['Khoa', 'Bác sĩ', 'Slot còn trống', 'Kênh gửi'],
    columns: ['Bệnh nhân', 'Khoa', 'Slot gợi ý', 'Kênh gửi', 'Trạng thái', 'Action'],
  },
  'support-complaints': {
    eyebrow: 'Complaint desk',
    title: 'Khiếu nại / yêu cầu hỗ trợ',
    subtitle: 'Theo dõi khiếu nại, escalation và SLA xử lý tại quầy.',
    icon: AlertTriangle,
    tone: 'danger',
    primaryAction: { label: 'Tạo khiếu nại', icon: Plus },
    filters: ['Mới', 'Quá SLA', 'Escalated', 'Đã giải quyết'],
    columns: ['Ticket', 'Bệnh nhân', 'Loại', 'Mức độ', 'SLA', 'Action'],
  },
  'reports-reception-volume': {
    eyebrow: 'Reception reports',
    title: 'Số lượt tiếp đón',
    subtitle: 'Thống kê lượt tiếp đón theo giờ, quầy, nhân viên, nguồn và khoa.',
    icon: ClipboardList,
    tone: 'info',
    primaryAction: { label: 'Xuất báo cáo', icon: FileText },
    filters: ['Ngày', 'Quầy', 'Nhân viên', 'Nguồn'],
    columns: ['Thời gian', 'Bệnh nhân', 'Nguồn', 'Nhân viên', 'Kết quả', 'Khoa'],
  },
  'reports-no-show': {
    eyebrow: 'No-show',
    title: 'No-show',
    subtitle: 'Theo dõi no-show theo khoa, bác sĩ, khung giờ và nguồn đặt lịch.',
    icon: AlertTriangle,
    tone: 'warning',
    primaryAction: { label: 'Gửi follow-up', icon: Send },
    filters: ['Khoa', 'Bác sĩ', 'Khung giờ', 'Nguồn'],
    columns: ['Bệnh nhân', 'Giờ hẹn', 'Khoa/Bác sĩ', 'Lý do', 'Follow-up', 'Action'],
  },
  'reports-wait-time': {
    eyebrow: 'Wait time',
    title: 'Thời gian chờ',
    subtitle: 'Đo thời gian chờ check-in, queue, gọi và chuyển tuyến theo từng khu vực.',
    icon: Clock3,
    tone: 'warning',
    primaryAction: { label: 'Xuất báo cáo', icon: FileText },
    filters: ['Ngày', 'Khoa', 'Quầy', 'Ngưỡng SLA'],
    columns: ['Khoa/Quầy', 'Chờ check-in', 'Chờ queue', 'Chờ gọi', 'Quá SLA', 'Xu hướng'],
  },
  'reports-transfer': {
    eyebrow: 'Routing reports',
    title: 'Chuyển tuyến',
    subtitle: 'Theo dõi luồng chuyển từ lễ tân sang các workspace khác và thời gian tiếp nhận.',
    icon: Route,
    tone: 'info',
    primaryAction: { label: 'Xuất báo cáo', icon: FileText },
    filters: ['Điểm đến', 'Trạng thái', 'Khoa', 'Ngày'],
    columns: ['Luồng chuyển', 'Số lượt', 'Thành công', 'Bị trả lại', 'Thời gian TB', 'Action'],
  },
  'reports-counter-performance': {
    eyebrow: 'Counter performance',
    title: 'Hiệu suất quầy',
    subtitle: 'Theo dõi số lượt xử lý, check-in, hồ sơ bổ sung, ticket và lỗi thao tác theo nhân viên/quầy.',
    icon: SlidersHorizontal,
    tone: 'success',
    primaryAction: { label: 'Xuất báo cáo', icon: FileText },
    filters: ['Nhân viên', 'Quầy', 'Ngày', 'Loại việc'],
    columns: ['Nhân viên/Quầy', 'Lượt xử lý', 'Check-in', 'Hồ sơ bổ sung', 'Ticket', 'Lỗi'],
  },
  'settings-printer': {
    eyebrow: 'Print setup',
    title: 'Máy in / mẫu in',
    subtitle: 'Cấu hình máy in, mẫu phiếu queue, mẫu hướng dẫn thanh toán và test print.',
    icon: Printer,
    tone: 'neutral',
    primaryAction: { label: 'Test print', icon: Printer },
    filters: ['Máy in', 'Mẫu in', 'Khổ giấy', 'Trạng thái'],
    columns: ['Mẫu in', 'Máy in', 'Khổ giấy', 'Preview', 'Mặc định', 'Action'],
  },
  'settings-shortcuts': {
    eyebrow: 'Shortcuts',
    title: 'Phím tắt thao tác',
    subtitle: 'Tùy biến phím tắt cho tìm bệnh nhân, tạo lịch, check-in, in số và tạo ticket.',
    icon: Settings,
    tone: 'neutral',
    primaryAction: { label: 'Lưu shortcut', icon: CheckCircle2 },
    filters: ['Nhóm thao tác', 'Đang bật', 'Xung đột', 'Cá nhân'],
    columns: ['Thao tác', 'Phím tắt', 'Nhóm', 'Trạng thái', 'Xung đột', 'Action'],
  },
  'settings-notifications': {
    eyebrow: 'Notification prefs',
    title: 'Tùy chọn thông báo',
    subtitle: 'Cấu hình popup, âm thanh, email, push cho lịch hẹn, queue, payment và support.',
    icon: Bell,
    tone: 'neutral',
    primaryAction: { label: 'Lưu tùy chọn', icon: CheckCircle2 },
    filters: ['Loại thông báo', 'Popup', 'Âm thanh', 'Email/Push'],
    columns: ['Loại', 'Popup', 'Âm thanh', 'Email', 'Push', 'Trạng thái'],
  },
};

const SUPPLEMENTAL_PAGE_CONFIG = {
  'appointments-upcoming': {
    eyebrow: 'Upcoming',
    title: 'Lịch hẹn sắp tới',
    subtitle: 'Theo dõi bệnh nhân sắp tới quầy trong 2-4 giờ tới, trạng thái hồ sơ, check-in và thanh toán liên quan.',
    icon: CalendarDays,
    tone: 'info',
    primaryAction: { label: 'Check-in nhanh', icon: CheckCircle2, target: 'checkin-quick' },
    filters: ['Khung giờ', 'Khoa', 'Bác sĩ', 'Hồ sơ thiếu'],
    columns: ['Giờ', 'Bệnh nhân', 'Khoa', 'Bác sĩ', 'Trạng thái', 'Action'],
  },
  'overview-waiting-patients': {
    eyebrow: 'Patient flow',
    title: 'Bệnh nhân đang chờ',
    subtitle: 'Danh sách bệnh nhân đã tới nhưng chưa hoàn tất luồng tiếp đón, queue hoặc chuyển tuyến.',
    icon: Users,
    tone: 'warning',
    primaryAction: { label: 'Gọi bệnh nhân', icon: Phone, target: 'queue-call' },
    filters: ['Chờ check-in', 'Đã check-in', 'Missed call', 'Chờ chuyển'],
    columns: ['Số queue', 'Bệnh nhân', 'Đích đến', 'Thời gian chờ', 'Trạng thái', 'Action'],
  },
  'checkin-done': {
    eyebrow: 'Check-in audit',
    title: 'Check-in gần đây',
    subtitle: 'Audit nhanh các lượt check-in theo lịch, QR, vãng lai và thao tác staff manual.',
    icon: CheckCircle2,
    tone: 'success',
    primaryAction: { label: 'In lại số', icon: Printer, target: 'checkin-print' },
    filters: ['Nguồn', 'Quầy', 'Nhân viên', 'Kết quả'],
    columns: ['Thời gian', 'Bệnh nhân', 'Appointment', 'Queue', 'Kiểu', 'Kết quả'],
  },
  'overview-queue-counter': {
    eyebrow: 'Counter queue',
    title: 'Queue tại quầy',
    subtitle: 'Mini board queue cho lễ tân, tập trung vào số đang chờ, đang gọi, missed call và chuyển tuyến.',
    icon: Ticket,
    tone: 'warning',
    primaryAction: { label: 'Gọi tiếp theo', icon: Phone, target: 'queue-call' },
    filters: ['Quầy', 'Khoa', 'Phòng', 'Ưu tiên'],
    columns: ['Số queue', 'Bệnh nhân', 'Đích đến', 'Thời gian chờ', 'Trạng thái', 'Action'],
  },
  'notifications-all': {
    eyebrow: 'Counter alerts',
    title: 'Thông báo tại quầy',
    subtitle: 'Thông báo liên quan tới lịch hẹn, check-in, queue, thanh toán, support và hệ thống tại quầy.',
    icon: Bell,
    tone: 'info',
    primaryAction: { label: 'Đánh dấu đã đọc', icon: CheckCircle2 },
    filters: ['Chưa đọc', 'Lịch hẹn', 'Queue', 'Khẩn cấp'],
    columns: ['Thời gian', 'Tiêu đề', 'Bệnh nhân', 'Loại', 'Priority', 'Trạng thái'],
  },
  'patients-search': {
    eyebrow: 'Patient search',
    title: 'Tìm bệnh nhân',
    subtitle: 'Tìm theo tên, SĐT, mã BN, CCCD, email, ngày sinh hoặc QR, có cảnh báo hồ sơ nghi trùng.',
    icon: Search,
    tone: 'info',
    primaryAction: { label: 'Tạo bệnh nhân', icon: UserPlus, target: 'patients-create' },
    filters: ['Exact match', 'Có lịch hôm nay', 'Nghi trùng', 'Portal'],
    columns: ['Độ khớp', 'Loại', 'Bệnh nhân', 'Thông tin', 'Hồ sơ', 'Action'],
  },
  'patients-create': {
    eyebrow: 'New patient',
    title: 'Tạo bệnh nhân mới',
    subtitle: 'Wizard tạo hồ sơ hành chính với bước kiểm tra trùng bắt buộc trước khi lưu.',
    icon: UserPlus,
    tone: 'success',
    primaryAction: { label: 'Kiểm tra trùng', icon: ShieldAlert, target: 'patients-duplicate-check' },
    filters: ['Thông tin cơ bản', 'Liên hệ', 'Định danh', 'Portal'],
    columns: ['Bước', 'Dữ liệu', 'Bắt buộc', 'Trạng thái', 'Cảnh báo', 'Action'],
  },
  'patients-record': {
    eyebrow: 'Admin profile',
    title: 'Hồ sơ hành chính',
    subtitle: 'Trang hồ sơ hành chính tập trung thông tin cá nhân, liên hệ, định danh, bảo hiểm, portal và tài liệu.',
    icon: FileText,
    tone: 'success',
    primaryAction: { label: 'Cập nhật hồ sơ', icon: FileText },
    filters: ['Tổng quan', 'Liên hệ', 'Định danh', 'Timeline'],
    columns: ['Bệnh nhân', 'Thông tin', 'Liên hệ', 'Định danh', 'Hồ sơ', 'Action'],
  },
  'appointments-today': {
    eyebrow: 'Today',
    title: 'Lịch hẹn hôm nay',
    subtitle: 'Quản lý lịch hẹn trong ngày, xác nhận, check-in, no-show, queue và timeline.',
    icon: CalendarDays,
    tone: 'info',
    primaryAction: { label: 'Tạo lịch hẹn', icon: Plus, target: 'appointments-create' },
    filters: ['Khoa', 'Bác sĩ', 'Trạng thái', 'Check-in'],
    columns: ['Giờ', 'Bệnh nhân', 'Khoa', 'Bác sĩ', 'Trạng thái', 'Action'],
  },
  'appointments-create': {
    eyebrow: 'Booking',
    title: 'Tạo lịch hẹn',
    subtitle: 'Booking wizard chọn bệnh nhân, khoa, bác sĩ, slot trống, kiểm tra xung đột và gửi thông báo.',
    icon: CalendarDays,
    tone: 'success',
    primaryAction: { label: 'Tìm slot', icon: Search, target: 'appointments-slot-check' },
    filters: ['Bệnh nhân', 'Khoa', 'Bác sĩ', 'Ngày'],
    columns: ['Bước', 'Thông tin', 'Slot', 'Xung đột', 'Trạng thái', 'Action'],
  },
  'appointments-confirm': {
    eyebrow: 'Confirmation',
    title: 'Xác nhận lịch',
    subtitle: 'Danh sách lịch cần xác nhận, không liên hệ được, muốn dời lịch hoặc có nguy cơ no-show.',
    icon: Phone,
    tone: 'warning',
    primaryAction: { label: 'Gửi nhắc lịch', icon: Send },
    filters: ['Chờ xác nhận', 'Không liên hệ', 'Muốn dời', 'No-show risk'],
    columns: ['Giờ hẹn', 'Bệnh nhân', 'Khoa/Bác sĩ', 'Lần nhắc', 'Trạng thái', 'Action'],
  },
  'appointments-reschedule': {
    eyebrow: 'Reschedule',
    title: 'Dời lịch',
    subtitle: 'Dời lịch có kiểm tra slot, xung đột bác sĩ, lịch bệnh nhân, queue và invoice liên quan.',
    icon: RefreshCw,
    tone: 'warning',
    primaryAction: { label: 'Tìm slot mới', icon: CalendarDays, target: 'appointments-slot-check' },
    filters: ['Lý do', 'Khoa', 'Bác sĩ', 'Ảnh hưởng'],
    columns: ['Lịch hiện tại', 'Bệnh nhân', 'Slot đề xuất', 'Xung đột', 'Impact', 'Action'],
  },
  'appointments-cancelled': {
    eyebrow: 'Cancellation',
    title: 'Hủy lịch',
    subtitle: 'Hủy lịch có lý do, ghi nhận người yêu cầu, thông báo bệnh nhân và chuyển thu ngân nếu có payment.',
    icon: XCircle,
    tone: 'danger',
    primaryAction: { label: 'Hủy lịch đã chọn', icon: XCircle },
    filters: ['Lý do', 'Nguồn yêu cầu', 'Có payment', 'Waitlist'],
    columns: ['Giờ hẹn', 'Bệnh nhân', 'Khoa/Bác sĩ', 'Payment', 'Lý do', 'Action'],
  },
  'checkin-quick': {
    eyebrow: 'Fast lane',
    title: 'Check-in nhanh',
    subtitle: 'Tìm bệnh nhân hoặc mã lịch, kiểm tra điều kiện, check-in, tạo queue và in số trong một luồng.',
    icon: CheckCircle2,
    tone: 'success',
    primaryAction: { label: 'Quét QR', icon: QrCode, target: 'checkin-qr' },
    filters: ['Có lịch hôm nay', 'Đủ hồ sơ', 'Payment blocking', 'Có queue'],
    columns: ['Giờ', 'Bệnh nhân', 'Khoa', 'Điều kiện', 'Queue', 'Action'],
  },
  'checkin-appointment': {
    eyebrow: 'Appointment check-in',
    title: 'Check-in theo lịch hẹn',
    subtitle: 'Danh sách appointment có thể check-in, đến sớm, trễ, quá giờ hoặc đã check-in.',
    icon: CalendarDays,
    tone: 'success',
    primaryAction: { label: 'Check-in', icon: CheckCircle2 },
    filters: ['Đúng giờ', 'Đến sớm', 'Trễ', 'Không thể check-in'],
    columns: ['Giờ', 'Bệnh nhân', 'Khoa/Bác sĩ', 'Hồ sơ', 'Payment', 'Action'],
  },
  'checkin-print': {
    eyebrow: 'Print',
    title: 'In số thứ tự',
    subtitle: 'In hoặc in lại phiếu queue với QR, tên bệnh nhân, khoa/phòng, bác sĩ và lưu ý.',
    icon: Printer,
    tone: 'neutral',
    primaryAction: { label: 'In phiếu', icon: Printer },
    filters: ['Mã queue', 'Mã BN', 'Mã lịch', 'Mẫu in'],
    columns: ['Số queue', 'Bệnh nhân', 'Khoa/phòng', 'QR', 'Lần in', 'Action'],
  },
  'queue-board': {
    eyebrow: 'Queue board',
    title: 'Queue hiện tại',
    subtitle: 'Kanban queue theo trạng thái đang chờ, đang gọi, missed call, đang phục vụ, hoàn tất và hủy.',
    icon: Ticket,
    tone: 'warning',
    primaryAction: { label: 'Gọi tiếp theo', icon: Phone, target: 'queue-call' },
    filters: ['Khoa', 'Phòng', 'Trạng thái', 'Auto refresh'],
    columns: ['Số queue', 'Bệnh nhân', 'Đích đến', 'Thời gian chờ', 'Trạng thái', 'Action'],
  },
  'queue-call': {
    eyebrow: 'Operator mode',
    title: 'Gọi bệnh nhân',
    subtitle: 'Chế độ operator để gọi số tiếp theo, gọi lại, bỏ qua, bắt đầu phục vụ hoặc chuyển tuyến.',
    icon: Phone,
    tone: 'success',
    primaryAction: { label: 'Gọi tiếp theo', icon: Phone },
    filters: ['Khoa', 'Phòng', 'Quầy', 'Ưu tiên'],
    columns: ['Số tiếp theo', 'Bệnh nhân', 'Phòng/quầy', 'Trạng thái loa', 'Có mặt', 'Action'],
  },
  'queue-recall': {
    eyebrow: 'Recall',
    title: 'Gọi lại',
    subtitle: 'Danh sách ticket đã gọi nhưng bệnh nhân chưa tới quầy để gọi lại, skip hoặc hủy.',
    icon: RefreshCw,
    tone: 'warning',
    primaryAction: { label: 'Gọi lại', icon: Phone },
    filters: ['Lần gọi', 'Thời gian chờ', 'Khoa', 'Trạng thái'],
    columns: ['Số queue', 'Bệnh nhân', 'Lần gọi gần nhất', 'Số lần gọi', 'Thời gian chờ', 'Action'],
  },
  'queue-missed': {
    eyebrow: 'Missed call',
    title: 'Missed call',
    subtitle: 'Quản lý lượt bị lỡ: gọi lại, đưa về cuối queue, no-show hoặc hủy ticket.',
    icon: AlertTriangle,
    tone: 'danger',
    primaryAction: { label: 'Gọi lại', icon: Phone },
    filters: ['Missed hôm nay', 'Đã gọi lại', 'No-show', 'Đã hủy'],
    columns: ['Số queue', 'Bệnh nhân', 'Lần gọi', 'Lý do', 'Trạng thái', 'Action'],
  },
  'queue-transfer': {
    eyebrow: 'Queue routing',
    title: 'Chuyển khoa / chuyển phòng',
    subtitle: 'Chuyển queue sang khoa, phòng hoặc bác sĩ khác với lý do, giữ số, in lại và thông báo.',
    icon: Route,
    tone: 'info',
    primaryAction: { label: 'Chuyển tuyến', icon: Route },
    filters: ['Đích mới', 'Giữ số', 'In lại', 'Thông báo'],
    columns: ['Ticket hiện tại', 'Bệnh nhân', 'Đích cũ', 'Đích mới', 'Lý do', 'Action'],
  },
  'queue-cancel': {
    eyebrow: 'Queue cancel',
    title: 'Hủy queue ticket',
    subtitle: 'Hủy lượt queue có lý do, ghi nhận bệnh nhân rời đi, no-show hoặc rollback nếu cần.',
    icon: XCircle,
    tone: 'danger',
    primaryAction: { label: 'Hủy ticket', icon: XCircle },
    filters: ['Lý do', 'No-show', 'Rollback', 'Khoa'],
    columns: ['Số queue', 'Bệnh nhân', 'Trạng thái', 'Lý do', 'Ảnh hưởng', 'Action'],
  },
  'payments-pending': {
    eyebrow: 'Receivables',
    title: 'Hóa đơn chờ thu',
    subtitle: 'Lễ tân xem, hướng dẫn, in QR hoặc chuyển thu ngân, không thu tiền hoặc hoàn tiền.',
    icon: CreditCard,
    tone: 'warning',
    primaryAction: { label: 'Hướng dẫn QR', icon: QrCode, target: 'payments-qr-guide' },
    filters: ['Unpaid', 'Partial', 'Overdue', 'Có QR'],
    columns: ['Bệnh nhân', 'Hóa đơn', 'Số tiền', 'Trạng thái', 'QR/Provider', 'Action'],
  },
  'reports-daily': {
    eyebrow: 'Daily overview',
    title: 'Tổng quan ngày',
    subtitle: 'KPI ngày cho lượt tiếp đón, check-in, walk-in, no-show, thời gian chờ, support và payment guidance.',
    icon: BarChart3,
    tone: 'info',
    primaryAction: { label: 'Xuất báo cáo', icon: FileText },
    filters: ['Ngày', 'Quầy', 'Khoa', 'Nhân viên'],
    columns: ['Chỉ số', 'Hôm nay', 'Hôm qua', 'Xu hướng', 'SLA', 'Ghi chú'],
  },
  'reports-checkin': {
    eyebrow: 'Check-in reports',
    title: 'Check-in',
    subtitle: 'Báo cáo check-in theo giờ, loại, lỗi, trễ giờ, nguồn và nhân viên thực hiện.',
    icon: CheckCircle2,
    tone: 'success',
    primaryAction: { label: 'Xuất báo cáo', icon: FileText },
    filters: ['Ngày', 'Nguồn', 'Khoa', 'Nhân viên'],
    columns: ['Bệnh nhân', 'Appointment', 'Giờ hẹn', 'Giờ check-in', 'Độ trễ', 'Nguồn'],
  },
  'settings-account': {
    eyebrow: 'Account',
    title: 'Tài khoản của tôi',
    subtitle: 'Thông tin tài khoản, role, workspace, phiên đăng nhập, đổi mật khẩu và đăng xuất.',
    icon: Settings,
    tone: 'neutral',
    primaryAction: { label: 'Đổi mật khẩu', icon: Settings },
    filters: ['Hồ sơ', 'Phiên đăng nhập', 'Bảo mật', 'Workspace'],
    columns: ['Mục', 'Giá trị', 'Trạng thái', 'Cập nhật', 'Bảo mật', 'Action'],
  },
  'settings-ui': {
    eyebrow: 'Interface',
    title: 'Giao diện',
    subtitle: 'Tùy chọn dark/light/system, mật độ hiển thị, cỡ chữ, ngôn ngữ và sidebar.',
    icon: SlidersHorizontal,
    tone: 'neutral',
    primaryAction: { label: 'Lưu giao diện', icon: CheckCircle2 },
    filters: ['Theme', 'Density', 'Font size', 'Language'],
    columns: ['Tùy chọn', 'Giá trị', 'Preview', 'Áp dụng', 'Đồng bộ', 'Action'],
  },
};

const TRANSFER_CONFIG = {
  'transfer-nursing': ['Chuyển sang Điều dưỡng', 'Điều dưỡng', 'Đo sinh hiệu / triage', UserCheck],
  'transfer-doctor': ['Chuyển sang Bác sĩ', 'Bác sĩ', 'Sẵn sàng khám', Stethoscope],
  'transfer-cashier': ['Chuyển sang Thu ngân', 'Thu ngân', 'Hóa đơn chờ thu', CreditCard],
  'transfer-clinical-service': ['Chuyển sang Cận lâm sàng', 'Cận lâm sàng', 'Order đang chờ', FileText],
  'transfer-pharmacy': ['Chuyển sang Nhà thuốc', 'Nhà thuốc', 'Đơn thuốc chờ cấp', Banknote],
};

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function unwrapItems(payload) {
  if (Array.isArray(payload)) return payload;
  return safeArray(payload?.items || payload?.patients || payload?.appointments || payload?.queue_tickets || payload?.invoices);
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatInteger(value) {
  return new Intl.NumberFormat('vi-VN').format(toNumber(value));
}

function formatTime(value) {
  if (!value) return '--:--';
  const textValue = String(value);
  if (/^\d{1,2}:\d{2}/.test(textValue)) return textValue.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function getPatientId(patient) {
  return patient?.patient_id || patient?.id || patient?._id || '';
}

function normalizePatient(patient = {}) {
  return {
    ...patient,
    patient_id: getPatientId(patient),
    patient_code: patient.patient_code || patient.code || patient.medical_record_number || '--',
    full_name: patient.full_name || patient.name || patient.patient_name || 'Bệnh nhân',
    phone: patient.phone || patient.phone_number || patient.mobile || patient.patient_phone || '--',
    email: patient.email || '--',
    national_id: patient.national_id || patient.citizen_id || patient.identity_number || '--',
    gender: patient.gender || '--',
    date_of_birth: patient.date_of_birth || patient.dob || '',
    status: patient.status || 'active',
  };
}

function getPatientFromAppointment(item = {}) {
  return normalizePatient(item.patient || {
    patient_id: item.patient_id,
    patient_code: item.patient_code,
    full_name: item.patient_name || item.patientName,
    phone: item.patient_phone || item.patientPhone,
  });
}

function getPatientFromQueue(item = {}) {
  return normalizePatient(item.patient || {
    patient_id: item.patient_id,
    patient_code: item.patient_code,
    full_name: item.patient_name,
    phone: item.patient_phone,
  });
}

function getAge(patient) {
  const dob = patient?.date_of_birth ? new Date(patient.date_of_birth) : null;
  if (!dob || Number.isNaN(dob.getTime())) return '--';
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : '--';
}

function pickFirstValue(values, fallback = '--') {
  return values.find((value) => value !== undefined && value !== null && value !== '') || fallback;
}

function getPageConfig(mode) {
  if (TRANSFER_CONFIG[mode]) {
    const [title, destination, readiness, Icon] = TRANSFER_CONFIG[mode];
    return {
      eyebrow: 'Internal routing',
      title,
      subtitle: `Tạo luồng chuyển bệnh nhân sang ${destination} với ghi chú, ưu tiên và trạng thái sẵn sàng.`,
      icon: Icon,
      tone: 'info',
      primaryAction: { label: 'Tạo chuyển tuyến', icon: Send },
      filters: ['Bệnh nhân', 'Queue', 'Ưu tiên', 'Điểm đến'],
      columns: ['Bệnh nhân', 'Queue', 'Điểm đến', 'Điều kiện', 'Ghi chú', 'Action'],
      readiness,
    };
  }

  return PAGE_CONFIG[mode] || SUPPLEMENTAL_PAGE_CONFIG[mode] || PAGE_CONFIG['overview-tasks'];
}

function getDashboardCounts(data = {}) {
  const metrics = safeArray(data?.metrics);
  const getMetric = (key, fallback = 0) => metrics.find((item) => item.key === key)?.value || fallback;
  const scoped = data.scopedDashboard || {};
  const kpis = scoped.kpis || {};
  const counters = scoped.counters || {};
  const appointmentRows = safeArray(data?.tables?.appointments);
  const queueRows = safeArray(data?.tables?.queue);
  const notifications = safeArray(data?.notifications);
  const worklist = safeArray(data?.worklist);
  const paymentAlerts = safeArray(data?.paymentAlerts);
  const missingFromWorklist = worklist.filter((item) => ['missing_document', 'profile_change_request'].includes(item.type)).length;
  const paymentsFromWorklist = worklist.filter((item) => ['unpaid_invoice', 'payment_review'].includes(item.type)).length;
  const supportFromWorklist = worklist.filter((item) => item.type === 'support_ticket').length;

  return {
    appointments: getMetric('appointments', appointmentRows.length),
    checkedIn: getMetric('checked-in', 0),
    queue: getMetric('queue', queueRows.length),
    notifications: getMetric('notifications', notifications.length),
    waiting: toNumber(kpis.queue_waiting) || queueRows.filter((item) => ['waiting', 'called', 'recalled'].includes(item.status)).length,
    missing: toNumber(kpis.missing_profile) || toNumber(counters.missing_documents) + toNumber(counters.profile_change_requests) || missingFromWorklist,
    payments: toNumber(kpis.unpaid_invoices) + toNumber(kpis.payment_reviews) || paymentAlerts.length || paymentsFromWorklist,
    support: toNumber(kpis.support_open) || supportFromWorklist,
  };
}

function textIncludesAny(value, terms = []) {
  const normalized = String(value || '').toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function getWorkbenchPatient(item = {}) {
  return normalizePatient(item.patient || {
    patient_id: item.patient_id,
    patient_code: item.patient_code,
    full_name: item.patient_name,
    phone: item.patient_phone,
  });
}

function getGenericWorkbenchItems(config, data = {}) {
  const label = `${config.eyebrow || ''} ${config.title || ''}`.toLowerCase();
  const worklist = safeArray(data?.worklist);
  const paymentAlerts = safeArray(data?.paymentAlerts);

  if (textIncludesAny(label, ['việc', 'worklist', 'cần xử lý'])) return worklist;
  if (textIncludesAny(label, ['hồ sơ', 'giấy tờ', 'bảo hiểm', 'xác minh', 'tài liệu'])) {
    return worklist.filter((item) => ['missing_document', 'profile_change_request', 'unpaid_invoice'].includes(item.type));
  }
  if (textIncludesAny(label, ['thanh toán', 'payment', 'thu ngân', 'hóa đơn'])) {
    const worklistPayments = worklist.filter((item) => ['unpaid_invoice', 'payment_review'].includes(item.type));
    return [...paymentAlerts, ...worklistPayments];
  }
  if (textIncludesAny(label, ['support', 'hỗ trợ', 'tin nhắn', 'khiếu nại'])) {
    return worklist.filter((item) => item.type === 'support_ticket');
  }
  return [];
}

function getWorkbenchStats(rows = []) {
  const sources = rows.map((row) => row.source || {});
  const dueSoon = sources.filter((item) => ['overdue', 'due_soon'].includes(item.sla_state)).length;
  const resolved = sources.filter((item) => ['resolved', 'closed', 'completed', 'paid', 'done'].includes(String(item.status || '').toLowerCase())).length;
  const alerts = sources.filter((item) => {
    const priority = String(item.priority || '').toLowerCase();
    const status = String(item.status || '').toLowerCase();
    return ['urgent', 'high'].includes(priority) || item.sla_state === 'overdue' || ['failed', 'error', 'pending_review'].includes(status);
  }).length;
  return { open: rows.length, dueSoon, resolved, alerts };
}

function buildRows(config, data = {}) {
  const appointmentRows = safeArray(data?.tables?.appointments);
  const queueRows = safeArray(data?.tables?.queue);
  const notifications = safeArray(data?.notifications);

  if (config.title.includes('lịch') || config.title.includes('Lịch') || config.title.includes('No-show')) {
    return appointmentRows.slice(0, 6).map((item, index) => ({
      id: item.id || item.appointment_id || `apt-${index}`,
      cells: [
        formatTime(item.time || item.appointment_time),
        item.patientName || item.patient_name || item.patient || '--',
        item.department || item.departmentName || item.department_name || '--',
        item.doctor || item.doctorName || item.doctor_name || '--',
        item.statusLabel || item.status || '--',
        item.can_checkin ? 'Check-in' : 'Mở hồ sơ',
      ],
      patient: getPatientFromAppointment(item),
      source: item,
    }));
  }

  if (config.title.includes('Queue') || config.title.includes('queue') || config.title.includes('Chuyển')) {
    return queueRows.slice(0, 6).map((item, index) => ({
      id: item.id || item.queue_ticket_id || `queue-${index}`,
      cells: [
        item.queueNumber || item.queue_number || '--',
        item.patientName || item.patient_name || '--',
        item.department || item.department_name || item.destination || '--',
        item.waitTime || item.waiting_time || '--',
        item.statusLabel || item.status || '--',
        'Gọi / Chuyển',
      ],
      patient: getPatientFromQueue(item),
      source: item,
    }));
  }

  if (config.title.includes('Thông báo') || config.title.includes('Support') || config.title.includes('Tin nhắn') || config.title.includes('Khiếu nại')) {
    return notifications.slice(0, 6).map((item, index) => ({
      id: item.id || item.notification_id || `noti-${index}`,
      cells: [
        formatDateTime(item.created_at),
        item.title || item.subject || `Yêu cầu hỗ trợ #${index + 1}`,
        item.patient_name || item.patientName || 'Bệnh nhân',
        item.category || item.type || 'support',
        item.priority || 'normal',
        item.read_at ? 'Đã xử lý' : 'Mở',
      ],
      source: item,
    }));
  }

  return getGenericWorkbenchItems(config, data).slice(0, 8).map((item, index) => {
    const patient = getWorkbenchPatient(item);
    return {
      id: item.id || item.worklist_id || item.invoice_id || item.payment_intent_id || item.ticket_id || `${config.title}-${index}`,
      cells: [
        item.priority || item.priority_label || '--',
        item.type_label || item.type || config.eyebrow || '--',
        patient.full_name !== '--' ? patient.full_name : item.patient_name || '--',
        item.title || item.description || item.invoice_code || item.subject || '--',
        item.sla_state || item.sla_label || item.status || '--',
        item.status_label || item.status || 'open',
      ],
      patient,
      source: item,
    };
  });
}

function MetricCard({ icon: Icon, label, value, hint, tone = 'info' }) {
  return (
    <article className={`reception-workspace-metric is-${tone}`}>
      <span className="reception-workspace-metric__icon"><Icon size={18} /></span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function WorkspaceHero({ config, onNavigate }) {
  const Icon = config.icon;
  const ActionIcon = config.primaryAction?.icon || ArrowRight;
  return (
    <section className={`reception-workspace-hero is-${config.tone || 'info'}`}>
      <div>
        <span>{config.eyebrow}</span>
        <h2>{config.title}</h2>
        <p>{config.subtitle}</p>
      </div>
      {config.primaryAction ? (
        <button
          type="button"
          className="reception-btn reception-btn--primary"
          onClick={() => config.primaryAction.target && onNavigate?.(config.primaryAction.target)}
        >
          <ActionIcon size={16} />
          <span>{config.primaryAction.label}</span>
        </button>
      ) : null}
      <span className="reception-workspace-hero__mark" aria-hidden="true">
        <Icon size={34} />
      </span>
    </section>
  );
}

function DashboardCommandCenter({ data, onNavigate, onSelectPatient }) {
  const counts = getDashboardCounts(data);
  const appointments = safeArray(data?.tables?.appointments).slice(0, 5);
  const queue = safeArray(data?.tables?.queue).slice(0, 5);
  const notifications = safeArray(data?.notifications).slice(0, 5);
  const worklist = [
    ['Hồ sơ cần bổ sung', counts.missing, 'Thiếu CCCD, bảo hiểm hoặc liên hệ', 'patients-missing-personal-info'],
    ['Payment cần xác nhận', counts.payments, 'Cần hướng dẫn hoặc chuyển thu ngân', 'payments-confirmation'],
    ['Support tickets', counts.support, 'Tin nhắn và yêu cầu hỗ trợ mở', 'support-tickets'],
  ];

  return (
    <div className="reception-command-center">
      <section className="reception-command-actions">
        <div>
          <span>Command center</span>
          <h2>Lễ tân & Tiếp đón</h2>
          <p>Tập trung tìm bệnh nhân, check-in, queue, hồ sơ thiếu, thanh toán liên quan và hỗ trợ tại quầy.</p>
        </div>
        <div className="reception-command-actions__grid">
          {[
            ['Tạo bệnh nhân', UserPlus, 'patients-create'],
            ['Tạo lịch hẹn', CalendarDays, 'appointments-create'],
            ['Check-in nhanh', CheckCircle2, 'checkin-quick'],
            ['Quét QR', QrCode, 'patients-qr-scan'],
            ['In số', Printer, 'checkin-print'],
            ['Support ticket', Headset, 'support-tickets'],
          ].map(([label, Icon, target]) => (
            <button type="button" key={label} onClick={() => onNavigate?.(target)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="reception-workspace-metrics">
        <MetricCard icon={CalendarDays} label="Lịch hẹn hôm nay" value={counts.appointments} hint="Cần theo dõi check-in" tone="info" />
        <MetricCard icon={CheckCircle2} label="Đã check-in" value={counts.checkedIn} hint="Theo lịch, QR, vãng lai" tone="success" />
        <MetricCard icon={Users} label="Queue đang chờ" value={counts.queue} hint={`${counts.waiting} lượt cần gọi`} tone="warning" />
        <MetricCard icon={ShieldAlert} label="Hồ sơ cần bổ sung" value={counts.missing} hint="Giấy tờ, bảo hiểm, xác minh" tone="danger" />
        <MetricCard icon={CreditCard} label="Thanh toán liên quan" value={counts.payments} hint="Hướng dẫn hoặc chuyển thu ngân" tone="warning" />
        <MetricCard icon={Headset} label="Support mở" value={counts.support} hint="Tin nhắn và ticket tại quầy" tone="info" />
      </section>

      <section className="reception-operation-board">
        <article className="reception-operation-column">
          <header>
            <span>Danh sách lịch hẹn</span>
            <button type="button" onClick={() => onNavigate?.('appointments-upcoming')}>Mở</button>
          </header>
          {appointments.map((item, index) => {
            const patient = getPatientFromAppointment(item);
            return (
              <button type="button" className="reception-operation-card" key={item.id || index} onClick={() => onSelectPatient?.(patient)}>
                <span>{formatTime(item.time || item.appointment_time)}</span>
                <strong>{patient.full_name}</strong>
                <small>{pickFirstValue([item.department, item.departmentName, item.department_name])} · {pickFirstValue([item.doctor, item.doctorName, item.doctor_name])}</small>
              </button>
            );
          })}
          {!appointments.length ? <div className="reception-empty-panel reception-empty-panel--compact">Chưa có lịch hẹn phù hợp.</div> : null}
        </article>

        <article className="reception-operation-column">
          <header>
            <span>Bệnh nhân đang chờ</span>
            <button type="button" onClick={() => onNavigate?.('queue-board')}>Mở</button>
          </header>
          {queue.map((item, index) => {
            const patient = getPatientFromQueue(item);
            return (
              <button type="button" className="reception-operation-card" key={item.id || index} onClick={() => onSelectPatient?.(patient)}>
                <span>{item.queueNumber || item.queue_number || `Q${String(index + 1).padStart(3, '0')}`}</span>
                <strong>{patient.full_name}</strong>
                <small>{pickFirstValue([item.department, item.department_name])} · {item.statusLabel || item.status || 'waiting'}</small>
              </button>
            );
          })}
          {!queue.length ? <div className="reception-empty-panel reception-empty-panel--compact">Queue đang trống.</div> : null}
        </article>

        <article className="reception-operation-column">
          <header>
            <span>Việc cần xử lý</span>
            <button type="button" onClick={() => onNavigate?.('overview-tasks')}>Mở</button>
          </header>
          {worklist.map(([title, count, desc, target]) => (
            <button type="button" className="reception-operation-card" key={title} onClick={() => onNavigate?.(target)}>
              <span>{formatInteger(count)}</span>
              <strong>{title}</strong>
              <small>{desc}</small>
            </button>
          ))}
        </article>
      </section>

      <section className="reception-workspace-feed">
        <header>
          <div>
            <span>Activity feed</span>
            <h3>Thông báo tại quầy</h3>
          </div>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onNavigate?.('notifications-all')}>
            <Bell size={16} />
            <span>Xem tất cả</span>
          </button>
        </header>
        <div className="reception-workspace-feed__list">
          {notifications.map((item, index) => (
            <div key={item.id || index} className="reception-workspace-feed__item">
              <span><Bell size={15} /></span>
              <div>
                <strong>{item.title || item.message || 'Thông báo vận hành'}</strong>
                <small>{formatDateTime(item.created_at)} · {item.type || item.category || 'system'}</small>
              </div>
            </div>
          ))}
          {!notifications.length ? <div className="reception-empty-panel reception-empty-panel--compact">Chưa có thông báo mới.</div> : null}
        </div>
      </section>
    </div>
  );
}

function WorkbenchTable({ config, rows, onSelectPatient, onRefresh }) {
  return (
    <section className="reception-panel reception-workbench-table">
      <header className="reception-panel__header reception-panel__header--compact">
        <div>
          <h2>Danh sách xử lý</h2>
          <p>{formatInteger(rows.length)} dòng hiển thị trong phiên làm việc hiện tại.</p>
        </div>
        <button type="button" className="reception-btn reception-btn--ghost" onClick={onRefresh}>
          <RefreshCw size={16} />
          <span>Làm mới</span>
        </button>
      </header>
      <div className="reception-workbench-table__scroll">
        <table>
          <thead>
            <tr>
              {config.columns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {config.columns.map((column, index) => (
                  <td key={`${row.id}-${column}`}>
                    {index === 2 && row.patient ? (
                      <button type="button" className="reception-link-button" onClick={() => onSelectPatient?.(row.patient)}>
                        {row.cells[index] || row.patient.full_name}
                      </button>
                    ) : row.cells[index] || '--'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <div className="reception-empty-panel">Không có dữ liệu phù hợp với bộ lọc.</div> : null}
      </div>
    </section>
  );
}

function WorkbenchSidePanel({ config, onNavigate }) {
  const readiness = config.readiness || 'Đủ điều kiện xử lý';
  const guide = [
    ['Bước 1', 'Xác định đúng bệnh nhân và entity liên quan.'],
    ['Bước 2', readiness],
    ['Bước 3', 'Thực hiện action, ghi chú và cập nhật trạng thái.'],
  ];

  return (
    <aside className="reception-workbench-side">
      <section className="reception-panel">
        <div className="reception-side-title">
          <span>Checklist</span>
          <h3>Trước khi xử lý</h3>
        </div>
        <div className="reception-workbench-checklist">
          {guide.map(([step, text]) => (
            <div key={step}>
              <span>{step}</span>
              <strong>{text}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="reception-panel">
        <div className="reception-side-title">
          <span>Quick actions</span>
          <h3>Thao tác liên quan</h3>
        </div>
        <div className="reception-workbench-actions">
          {[
            ['Mở hồ sơ', FileText, 'patients-search'],
            ['Tạo lịch hẹn', CalendarDays, 'appointments-create'],
            ['Check-in', CheckCircle2, 'checkin-quick'],
            ['In số', Printer, 'checkin-print'],
            ['Gửi thông báo', Send, 'support-notification'],
          ].map(([label, Icon, target]) => (
            <button type="button" key={label} onClick={() => onNavigate?.(target)}>
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

export function ReceptionWorkspacePage({ mode, data, onNavigate, onSelectPatient, onRefresh }) {
  const safeData = data || {};

  if (mode === 'overview-dashboard') {
    return <DashboardCommandCenter data={safeData} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  }

  const config = getPageConfig(mode);
  const rows = buildRows(config, safeData);
  const stats = getWorkbenchStats(rows);

  return (
    <div className="reception-workspace-page">
      <WorkspaceHero config={config} onNavigate={onNavigate} />
      <section className="reception-workbench-toolbar">
        <label className="reception-workbench-search">
          <Search size={17} />
          <input type="search" placeholder="Tìm theo bệnh nhân, mã hồ sơ, SĐT, ticket hoặc entity liên quan..." />
        </label>
        <div className="reception-workbench-filters">
          {config.filters.map((filter) => (
            <button type="button" key={filter}>
              <Filter size={14} />
              <span>{filter}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="reception-workspace-metrics">
        <MetricCard icon={ClipboardList} label="Đang mở" value={stats.open} hint="Từ dữ liệu backend hiện tại" tone={config.tone} />
        <MetricCard icon={Clock3} label="Sắp quá SLA" value={stats.dueSoon} hint="Theo sla_state từ backend" tone="warning" />
        <MetricCard icon={CheckCircle2} label="Đã xử lý" value={stats.resolved} hint="Theo trạng thái nguồn" tone="success" />
        <MetricCard icon={Bell} label="Cảnh báo" value={stats.alerts} hint="Ưu tiên cao, quá hạn hoặc lỗi" tone="danger" />
      </section>
      <div className="reception-workbench-layout">
        <WorkbenchTable config={config} rows={rows} onSelectPatient={onSelectPatient} onRefresh={onRefresh} />
        <WorkbenchSidePanel config={config} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function ReceptionGlobalSearch({ onNavigate, onSelectPatient }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState({
    loading: false,
    error: '',
    patients: [],
    appointments: [],
    queue: [],
    invoices: [],
  });

  useEffect(() => {
    const keyword = query.trim();
    if (keyword.length < 2) {
      setState({ loading: false, error: '', patients: [], appointments: [], queue: [], invoices: [] });
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const payload = await receptionDataApi.globalSearch({ q: keyword, limit: 5 });
        const results = payload?.results || {};
        if (!active) return;
        setState({
          loading: false,
          error: '',
          patients: safeArray(results.patients).map(normalizePatient),
          appointments: safeArray(results.appointments),
          queue: safeArray(results.queue_tickets),
          invoices: safeArray(results.invoices),
        });
        return;
      } catch (error) {
        // Fallback to the original split endpoints when the reception aggregation API is not available.
      }
      const [patients, appointments, queue, invoices] = await Promise.allSettled([
        receptionAppointmentsApi.searchPatients({ search: keyword, limit: 5 }),
        receptionAppointmentsApi.searchAppointments({ q: keyword, search: keyword, limit: 5 }),
        receptionQueueApi.listQueue({ search: keyword, q: keyword, limit: 5 }),
        receptionDataApi.listInvoices({ search: keyword, q: keyword, limit: 5 }),
      ]);
      if (!active) return;
      setState({
        loading: false,
        error: '',
        patients: patients.status === 'fulfilled' ? unwrapItems(patients.value).map(normalizePatient) : [],
        appointments: appointments.status === 'fulfilled' ? unwrapItems(appointments.value) : [],
        queue: queue.status === 'fulfilled' ? unwrapItems(queue.value) : [],
        invoices: invoices.status === 'fulfilled' ? unwrapItems(invoices.value) : [],
      });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const hasResults = state.patients.length || state.appointments.length || state.queue.length || state.invoices.length;

  return (
    <div className={`reception-global-search ${focused || query ? 'is-active' : ''}`}>
      <label className="reception-global-search__field">
        <Search size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Tìm bệnh nhân / SĐT / CCCD / mã BN / mã lịch hẹn / QR"
        />
        {state.loading ? <Loader2 size={17} className="is-spinning" /> : null}
      </label>

      {focused && query.trim().length >= 2 ? (
        <div className="reception-global-search__panel" onMouseDown={(event) => event.preventDefault()}>
          {!state.loading && !hasResults ? (
            <div className="reception-global-search__empty">
              <strong>Không có kết quả phù hợp</strong>
              <span>Có thể tạo hồ sơ mới hoặc kiểm tra lại CCCD/SĐT.</span>
              <button type="button" onClick={() => onNavigate?.('patients-create')}>Tạo bệnh nhân</button>
            </div>
          ) : null}

          {state.patients.length ? (
            <SearchGroup title="Bệnh nhân" icon={Users}>
              {state.patients.map((patient) => (
                <button
                  type="button"
                  key={patient.patient_id || patient.patient_code}
                  onClick={() => {
                    onSelectPatient?.(patient);
                    setFocused(false);
                  }}
                >
                  <span className="reception-avatar-badge reception-avatar-badge--cyan">{patient.full_name.slice(0, 1)}</span>
                  <span>
                    <strong>{patient.full_name}</strong>
                    <small>{patient.patient_code} · {patient.phone} · {patient.national_id}</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </SearchGroup>
          ) : null}

          {state.appointments.length ? (
            <SearchGroup title="Lịch hẹn" icon={CalendarDays}>
              {state.appointments.map((item, index) => {
                const patient = getPatientFromAppointment(item);
                return (
                  <button type="button" key={item.appointment_id || item.id || index} onClick={() => onNavigate?.('appointments-today')}>
                    <CalendarDays size={18} />
                    <span>
                      <strong>{patient.full_name}</strong>
                      <small>{formatTime(item.appointment_time || item.time)} · {item.department_name || item.department || '--'} · {item.status || '--'}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                );
              })}
            </SearchGroup>
          ) : null}

          {state.queue.length ? (
            <SearchGroup title="Queue" icon={Ticket}>
              {state.queue.map((item, index) => {
                const patient = getPatientFromQueue(item);
                return (
                  <button type="button" key={item.queue_ticket_id || item.id || index} onClick={() => onNavigate?.('queue-board')}>
                    <Ticket size={18} />
                    <span>
                      <strong>{item.queue_number || `Q${String(index + 1).padStart(3, '0')}`} · {patient.full_name}</strong>
                      <small>{item.department_name || '--'} · {item.status || '--'}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                );
              })}
            </SearchGroup>
          ) : null}

          {state.invoices.length ? (
            <SearchGroup title="Hóa đơn" icon={CreditCard}>
              {state.invoices.map((item, index) => (
                <button type="button" key={item.invoice_id || item.id || index} onClick={() => onNavigate?.('payments-status')}>
                  <CreditCard size={18} />
                  <span>
                    <strong>{item.invoice_code || item.code || `Invoice ${index + 1}`}</strong>
                    <small>{item.patient_name || 'Bệnh nhân'} · {formatCurrency(item.total_amount || item.amount_due || item.amount)}</small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </SearchGroup>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SearchGroup({ title, icon: Icon, children }) {
  return (
    <section className="reception-global-search__group">
      <header>
        <Icon size={15} />
        <span>{title}</span>
      </header>
      <div>{children}</div>
    </section>
  );
}

export function PatientQuickDrawer({ patient, onClose, onNavigate }) {
  const normalizedPatient = patient ? normalizePatient(patient) : null;
  const patientId = getPatientId(normalizedPatient);
  const [state, setState] = useState({
    loading: false,
    error: '',
    detail: null,
    summary: null,
    appointments: [],
  });

  useEffect(() => {
    if (!patientId) return undefined;
    let active = true;
    async function loadPatientCard() {
      setState({ loading: true, error: '', detail: null, summary: null, appointments: [] });
      try {
        const card = await receptionDataApi.getPatientCard(patientId, { timeline_limit: 8 });
        if (!active) return;
        setState({
          loading: false,
          error: '',
          detail: card?.patient || card?.detail?.patient || null,
          summary: card?.summary || null,
          appointments: safeArray(card?.appointments),
        });
        return;
      } catch (error) {
        // Keep the drawer useful even if the aggregation endpoint is disabled.
      }
      const [detail, summary, appointments] = await Promise.allSettled([
        receptionAppointmentsApi.getPatientDetail(patientId),
        receptionAppointmentsApi.getPatientSummary(patientId),
        receptionAppointmentsApi.getPatientAppointments(patientId, { limit: 5, sort_order: 'desc' }),
      ]);
      if (!active) return;
      setState({
        loading: false,
        error: detail.status === 'rejected' ? detail.reason?.message || 'Không tải được hồ sơ bệnh nhân.' : '',
        detail: detail.status === 'fulfilled' ? detail.value?.patient || detail.value || null : null,
        summary: summary.status === 'fulfilled' ? summary.value?.summary || summary.value || null : null,
        appointments: appointments.status === 'fulfilled' ? unwrapItems(appointments.value) : [],
      });
    }
    loadPatientCard();
    return () => {
      active = false;
    };
  }, [patientId]);

  if (!normalizedPatient) return null;

  const detail = normalizePatient(state.detail || normalizedPatient);
  const activeAppointment = state.appointments[0] || null;

  function copyPatientCode() {
    navigator.clipboard?.writeText(detail.patient_code).catch(() => null);
  }

  return (
    <aside className="reception-patient-quick-drawer" aria-label="Patient quick drawer">
      <div className="reception-patient-quick-drawer__header">
        <div>
          <span className="reception-avatar-badge reception-avatar-badge--cyan">{detail.full_name.slice(0, 1)}</span>
          <div>
            <strong>{detail.full_name}</strong>
            <small>{detail.patient_code} · {getAge(detail)} tuổi · {detail.gender}</small>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng hồ sơ nhanh">
          <XCircle size={20} />
        </button>
      </div>

      <div className="reception-patient-quick-drawer__badges">
        <span className="reception-status-badge is-success">Hồ sơ active</span>
        <span className="reception-status-badge is-info">Portal</span>
        <span className="reception-status-badge is-warning">Cần rà soát</span>
      </div>

      {state.loading ? (
        <div className="reception-appointment-loading reception-appointment-loading--inline">
          <Loader2 size={18} />
          <span>Đang tải patient card...</span>
        </div>
      ) : null}
      {state.error ? (
        <div className="reception-appointment-alert is-danger">
          <AlertTriangle size={18} />
          <span>{state.error}</span>
        </div>
      ) : null}

      <section className="reception-patient-quick-drawer__grid">
        <div>
          <span>SĐT</span>
          <strong>{detail.phone}</strong>
        </div>
        <div>
          <span>CCCD</span>
          <strong>{detail.national_id}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{detail.email}</strong>
        </div>
        <div>
          <span>Lịch gần nhất</span>
          <strong>{activeAppointment ? formatDateTime(activeAppointment.appointment_time || activeAppointment.time) : '--'}</strong>
        </div>
      </section>

      <section className="reception-patient-quick-drawer__cards">
        {[
          ['Lịch hẹn hôm nay', activeAppointment?.status || state.summary?.today_appointment_status || '--', CalendarDays],
          ['Trạng thái check-in', state.summary?.checkin_status || '--', CheckCircle2],
          ['Queue ticket', state.summary?.queue_status || '--', Ticket],
          ['Thanh toán', state.summary?.payment_status || '--', CreditCard],
          ['Hồ sơ thiếu', state.summary?.missing_documents_count ?? 0, ShieldAlert],
          ['Support gần đây', state.summary?.support_ticket_count ?? 0, Headset],
        ].map(([label, value, Icon]) => (
          <article key={label}>
            <Icon size={17} />
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="reception-patient-quick-drawer__actions">
        {[
          ['Copy mã BN', Copy, copyPatientCode],
          ['Sửa hồ sơ', FileText, () => onNavigate?.('patients-record')],
          ['Tạo lịch hẹn', CalendarDays, () => onNavigate?.('appointments-create')],
          ['Check-in', CheckCircle2, () => onNavigate?.('checkin-quick')],
          ['In số', Printer, () => onNavigate?.('checkin-print')],
          ['Chuyển tuyến', Route, () => onNavigate?.('transfer-nursing')],
          ['Gửi thông báo', Send, () => onNavigate?.('support-send-notification')],
          ['Tạo ticket', Headset, () => onNavigate?.('support-tickets')],
        ].map(([label, Icon, action]) => (
          <button type="button" key={label} onClick={action}>
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </section>
    </aside>
  );
}
