const { randomBytes } = require('crypto');
const env = require('../config/env');
const {
  ChatbotAppointmentDraft,
  ChatbotEntityDictionary,
  ChatbotFallback,
  ChatbotIntent,
  ChatbotMessage,
  ChatbotSession,
  Appointment,
  Conversation,
  ConversationParticipant,
  Department,
  DoctorProfile,
  DoctorSchedule,
  FacilityLocation,
  ImagingReport,
  Invoice,
  KnowledgeArticle,
  LabResult,
  Notification,
  Patient,
  PaymentIntent,
  Role,
  ScheduleSlot,
  ServiceCatalog,
  ServicePriceVersion,
  SupportTicket,
  User,
  UserRole,
  Message,
} = require('../models');
const appointmentService = require('./appointment.service');
const notificationService = require('./notification.service');
const patientService = require('./patient.service');
const scheduleService = require('./schedule.service');
const supportTicketService = require('./support-ticket.service');
const {
  ACTOR_TYPE,
  APPOINTMENT_STATUS,
  CONVERSATION_STATUS,
  CONVERSATION_PARTICIPANT_ROLE,
  MESSAGE_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_RECIPIENT_TYPE,
  NOTIFICATION_STATUS,
  ROLE_STATUS,
  SCHEDULE_SLOT_STATUS,
  SUPPORT_TICKET_STATUS,
  SUPPORT_CATEGORY,
  SUPPORT_TICKET_PRIORITY,
  USER_STATUS,
} = require('../constants/statuses');
const { PERMISSION, ROLE_CODE } = require('../constants/permissions');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
  getStartOfDay,
  getEndOfDay,
} = require('./core.service');
const { isValidObjectId } = require('../common/helpers/object-id.helper');

const rateLimitStore = new Map();
const DEFAULT_LANGUAGE = 'vi';
const LOW_CONFIDENCE_THRESHOLD = 0.52;
const HIGH_CONFIDENCE_THRESHOLD = 0.78;
const CHATBOT_HANDOFF_NOTIFICATION_TYPE = 'chatbot.handoff.requested';
const DEFAULT_HANDOFF_PRIMARY_ROLES = [ROLE_CODE.RECEPTIONIST, ROLE_CODE.SCHEDULER];
const DEFAULT_HANDOFF_FALLBACK_ROLES = [ROLE_CODE.MANAGER, ROLE_CODE.ADMIN, ROLE_CODE.SUPER_ADMIN];

const DEFAULT_INTENTS = [
  ['greeting', 'Chào hỏi', ['xin chào', 'alo', 'có ai không', 'hello']],
  ['thanks', 'Cảm ơn', ['cảm ơn', 'thank you', 'ok cảm ơn']],
  ['goodbye', 'Tạm biệt', ['tạm biệt', 'hẹn gặp lại']],
  ['book_appointment', 'Đặt lịch khám', ['tôi muốn đặt lịch', 'đặt khám giúp tôi', 'tôi muốn khám da liễu chiều mai']],
  ['ask_available_slots', 'Hỏi lịch trống', ['mai còn lịch không', 'bác sĩ nào còn lịch hôm nay', 'xem lịch trống']],
  ['check_appointment_status', 'Kiểm tra lịch hẹn', ['kiểm tra lịch hẹn', 'lịch hẹn của tôi', 'mã lịch hẹn của tôi']],
  ['reschedule_appointment', 'Đổi lịch', ['tôi muốn đổi lịch', 'dời lịch hẹn', 'đổi giờ khám']],
  ['cancel_appointment', 'Hủy lịch', ['tôi muốn hủy lịch', 'hủy lịch hẹn']],
  ['find_department', 'Tìm chuyên khoa', ['tôi nên khám khoa nào', 'có khoa tiêu hóa không']],
  ['find_doctor', 'Tìm bác sĩ', ['bác sĩ tim mạch nào còn lịch', 'tìm bác sĩ da liễu']],
  ['find_service', 'Tìm dịch vụ', ['có xét nghiệm máu không', 'khám tổng quát gồm gì']],
  ['ask_symptom_department', 'Định hướng chuyên khoa theo triệu chứng', ['tôi đau bụng', 'tôi bị nổi mẩn', 'đau ngực nên khám gì']],
  ['emergency', 'Cấp cứu', ['đau ngực dữ dội khó thở', 'co giật', 'chảy máu nhiều']],
  ['ask_price', 'Hỏi giá', ['khám da liễu bao nhiêu tiền', 'phí khám tổng quát']],
  ['ask_payment', 'Thanh toán', ['có thanh toán QR không', 'tôi chuyển khoản rồi']],
  ['ask_qr_payment', 'Thanh toán QR', ['cho tôi mã QR thanh toán', 'thanh toán qr như thế nào']],
  ['ask_invoice', 'Hóa đơn/biên lai', ['lấy hóa đơn ở đâu', 'xuất hóa đơn giúp tôi']],
  ['check_payment_status', 'Kiểm tra thanh toán', ['tôi chuyển khoản rồi', 'kiểm tra thanh toán', 'thanh toán của tôi đã được xác nhận chưa']],
  ['ask_insurance', 'Bảo hiểm', ['có nhận BHYT không', 'bảo hiểm tư nhân có dùng được không']],
  ['insurance_eligibility_check', 'Kiểm tra điều kiện bảo hiểm', ['thẻ BHYT của tôi dùng được không', 'bảo hiểm này có áp dụng không']],
  ['ask_working_hours', 'Giờ làm việc', ['bệnh viện làm việc mấy giờ', 'chủ nhật có khám không', 'mấy giờ mở cửa']],
  ['ask_location', 'Địa chỉ/cơ sở', ['địa chỉ ở đâu', 'cơ sở gần nhất', 'có chi nhánh đà nẵng không']],
  ['branch_recommendation', 'Gợi ý cơ sở', ['cơ sở nào gần tôi', 'nên khám ở chi nhánh nào']],
  ['ask_patient_portal', 'Cổng bệnh nhân', ['quên mật khẩu', 'xem hóa đơn ở đâu', 'xem kết quả xét nghiệm']],
  ['ask_preparation', 'Hướng dẫn trước khám', ['trước khi khám cần chuẩn bị gì', 'có cần nhịn ăn không']],
  ['ask_required_documents', 'Giấy tờ cần mang', ['đi khám cần giấy tờ gì', 'cần mang CCCD không']],
  ['check_result_status', 'Kiểm tra trạng thái kết quả', ['kết quả của tôi có chưa', 'kiểm tra kết quả xét nghiệm', 'kết quả chẩn đoán hình ảnh']],
  ['upload_document_help', 'Hướng dẫn upload giấy tờ', ['tải CCCD lên', 'upload bảo hiểm', 'gửi giấy chuyển tuyến', 'gửi hồ sơ khám cũ']],
  ['compare_services', 'So sánh dịch vụ', ['so sánh gói khám', 'gói nào khác nhau']],
  ['recommend_package', 'Gợi ý gói khám', ['nên chọn gói khám nào', 'tư vấn gói khám tổng quát']],
  ['doctor_recommendation', 'Gợi ý bác sĩ', ['nên khám bác sĩ nào', 'bác sĩ nào phù hợp']],
  ['human_support', 'Gặp nhân viên', ['cho tôi gặp nhân viên', 'gọi lại cho tôi']],
  ['callback_request', 'Yêu cầu gọi lại', ['gọi lại cho tôi', 'liên hệ lại giúp tôi', 'tư vấn gọi lại']],
  ['lead_capture', 'Thu thập lead', ['tôi để lại số điện thoại', 'liên hệ tư vấn giúp tôi']],
  ['abandoned_booking_recovery', 'Tiếp tục đặt lịch dang dở', ['tiếp tục đặt lịch cũ', 'lần trước tôi đang đặt lịch']],
  ['returning_patient_support', 'Hỗ trợ bệnh nhân quay lại', ['tôi đã từng khám ở đây', 'tôi muốn tái khám']],
  ['family_booking', 'Đặt lịch cho người thân', ['đặt lịch cho mẹ tôi', 'đặt lịch cho con tôi']],
  ['corporate_health_check', 'Khám sức khỏe doanh nghiệp', ['khám sức khỏe công ty', 'đặt lịch cho nhân viên công ty']],
  ['complaint', 'Khiếu nại/góp ý', ['tôi muốn khiếu nại', 'góp ý dịch vụ']],
  ['feedback', 'Phản hồi dịch vụ', ['tôi muốn góp ý', 'dịch vụ rất tốt', 'nhân viên hỗ trợ tốt']],
  ['casual_chat', 'Trò chuyện tự nhiên', ['em là ai', 'nói chuyện với tôi chút', 'tôi hơi lo', 'bot vui tính không']],
];

const DEFAULT_ENTITIES = [
  ['department', 'Tiêu hóa', ['tiêu hóa', 'bao tử', 'dạ dày', 'đau bụng', 'trào ngược', 'rối loạn tiêu hóa']],
  ['department', 'Da liễu', ['da liễu', 'mụn', 'nổi mẩn', 'dị ứng da', 'ngứa', 'phát ban']],
  ['department', 'Tim mạch', ['tim mạch', 'đau ngực', 'hồi hộp', 'huyết áp', 'khó thở']],
  ['department', 'Nhi khoa', ['nhi', 'trẻ em', 'con tôi', 'bé', 'sốt trẻ em']],
  ['department', 'Sản phụ khoa', ['sản', 'phụ khoa', 'thai', 'mang thai', 'ra máu khi mang thai']],
  ['department', 'Tai Mũi Họng', ['tai mũi họng', 'nghẹt mũi', 'sổ mũi', 'đau họng', 'viêm họng', 'ù tai']],
  ['department', 'Cơ xương khớp', ['cơ xương khớp', 'đau lưng', 'đau khớp', 'đau vai gáy', 'thoái hóa']],
  ['department', 'Thần kinh', ['thần kinh', 'đau đầu', 'chóng mặt', 'tê tay', 'mất ngủ']],
  ['department', 'Nội tổng quát', ['nội tổng quát', 'khám tổng quát', 'mệt mỏi', 'sốt', 'đau đầu']],
  ['service', 'Khám tổng quát', ['khám tổng quát', 'gói khám sức khỏe', 'checkup']],
  ['service', 'Xét nghiệm máu', ['xét nghiệm máu', 'máu', 'công thức máu']],
  ['branch', 'Đà Nẵng', ['đà nẵng', 'da nang', 'danang']],
  ['branch', 'Hà Nội', ['hà nội', 'ha noi', 'hanoi']],
  ['branch', 'TP. Hồ Chí Minh', ['hồ chí minh', 'hcm', 'sài gòn', 'sai gon']],
];

const DEFAULT_KNOWLEDGE = [
  {
    title: 'Quy trình khám lần đầu',
    category: 'procedure',
    keywords: ['khám lần đầu', 'quy trình', 'giấy tờ', 'check-in'],
    content: 'Bệnh nhân nên đặt lịch trước trên website hoặc qua hotline. Khi đến cơ sở, vui lòng đến trước 15 phút để check-in và mang CCCD, thẻ BHYT nếu có, hồ sơ khám cũ, đơn thuốc cũ hoặc kết quả xét nghiệm liên quan.',
  },
  {
    title: 'Hướng dẫn thanh toán QR/chuyển khoản',
    category: 'payment',
    keywords: ['thanh toán', 'qr', 'chuyển khoản', 'biên lai', 'hóa đơn'],
    content: 'Hệ thống hỗ trợ thanh toán tiền mặt tại quầy và QR/chuyển khoản khi hóa đơn đã được tạo. Sau khi chuyển khoản, giao dịch được ghi nhận khi nhân viên xác nhận hoặc khi webhook thanh toán tự động đối soát thành công.',
  },
  {
    title: 'Thông tin bảo hiểm',
    category: 'insurance',
    keywords: ['bhyt', 'bảo hiểm', 'bảo lãnh viện phí', 'giấy chuyển tuyến'],
    content: 'Khi đi khám bảo hiểm, bệnh nhân nên mang CCCD, thẻ BHYT còn hiệu lực, giấy chuyển tuyến nếu trường hợp cần đúng tuyến và giấy tờ bảo hiểm tư nhân nếu có. Một số dịch vụ có thể không nằm trong phạm vi thanh toán bảo hiểm, nên trường hợp chi tiết cần nhân viên kiểm tra.',
  },
  {
    title: 'Cổng bệnh nhân',
    category: 'portal',
    keywords: ['portal', 'đăng nhập', 'quên mật khẩu', 'hồ sơ', 'kết quả', 'hóa đơn'],
    content: 'Thông tin cá nhân như lịch hẹn, hóa đơn, tài liệu và kết quả chỉ hiển thị sau khi đăng nhập cổng bệnh nhân. Nếu quên mật khẩu, sử dụng chức năng Quên mật khẩu tại màn hình đăng nhập.',
  },
  {
    title: 'Hỗ trợ giờ làm việc và địa chỉ',
    category: 'facility',
    keywords: ['giờ làm việc', 'mở cửa', 'địa chỉ', 'cơ sở', 'chi nhánh', 'chủ nhật'],
    content: 'Chatbot ưu tiên lấy giờ làm việc, địa chỉ và số điện thoại từ dữ liệu cơ sở đang active/public trong hệ thống. Nếu cơ sở chưa cấu hình giờ làm việc, chatbot sẽ đề nghị chuyển nhân viên để xác minh.',
  },
  {
    title: 'Phạm vi an toàn y tế của chatbot',
    category: 'medical_safety',
    keywords: ['thuốc', 'liều dùng', 'chẩn đoán', 'xét nghiệm', 'điều trị'],
    content: 'Chatbot chỉ hỗ trợ hành chính, giáo dục sức khỏe tổng quát và định hướng chuyên khoa để đặt lịch. Chatbot không chẩn đoán, không kê thuốc, không đưa liều dùng, không khuyên ngừng thuốc và không kết luận kết quả xét nghiệm thay bác sĩ.',
  },
];

const RED_FLAG_PATTERNS = [
  ['chest_pain', ['đau ngực dữ dội', 'dau nguc du doi', 'đau thắt ngực', 'tuc nguc']],
  ['breathing', ['khó thở', 'kho tho', 'thở không được', 'nghẹt thở']],
  ['seizure', ['co giật', 'co giat']],
  ['stroke', ['méo miệng', 'meo mieng', 'liệt nửa người', 'liet nua nguoi', 'nói khó', 'noi kho']],
  ['bleeding', ['chảy máu nhiều', 'chay mau nhieu', 'nôn ra máu', 'non ra mau', 'đi ngoài ra máu', 'di ngoai ra mau']],
  ['syncope', ['ngất', 'ngat', 'bất tỉnh', 'bat tinh']],
  ['shock', ['sốc phản vệ', 'soc phan ve', 'phản vệ']],
  ['injury', ['tai nạn nặng', 'tai nan nang', 'bỏng nặng', 'bong nang']],
  ['severe_headache', ['đau đầu dữ dội đột ngột', 'dau dau du doi dot ngot', 'đau đầu như búa bổ']],
  ['severe_abdominal_pain', ['đau bụng dữ dội', 'dau bung du doi', 'bụng đau không chịu nổi']],
  ['child_high_fever', ['trẻ sốt cao co giật', 'be sot cao co giat', 'con tôi sốt cao co giật']],
  ['newborn_cyanosis', ['trẻ sơ sinh tím tái', 'tre so sinh tim tai', 'em bé tím tái']],
  ['pregnancy', ['thai phụ ra máu', 'mang thai ra máu', 'ra máu khi mang thai']],
  ['self_harm', ['tự tử', 'tu tu', 'tự hại', 'tu hai', 'muốn chết']],
];

const MEDICAL_BLOCK_PATTERNS = [
  ['prescription', ['kê thuốc', 'ke thuoc', 'uống thuốc gì', 'uong thuoc gi', 'thuốc gì']],
  ['dosage', ['liều', 'lieu', 'bao nhiêu viên', 'mấy viên', 'mg/ngày']],
  ['stop_medication', ['ngừng thuốc', 'ngung thuoc', 'dừng thuốc', 'dung thuoc', 'bỏ thuốc', 'bo thuoc']],
  ['diagnosis', ['tôi bị bệnh gì', 'toi bi benh gi', 'có phải tôi bị', 'chẩn đoán']],
  ['lab_interpretation', ['đọc xét nghiệm', 'doc xet nghiem', 'kết quả xét nghiệm của tôi', 'chi so xet nghiem']],
  ['treatment_plan', ['phác đồ', 'phac do', 'điều trị như thế nào', 'dieu tri nhu the nao']],
];

const INTENT_KEYWORDS = {
  greeting: ['xin chao', 'chao', 'alo', 'hello', 'hi'],
  thanks: ['cam on', 'thank'],
  goodbye: ['tam biet', 'bye', 'hen gap'],
  book_appointment: ['dat lich', 'dang ky kham', 'muon kham', 'dat kham', 'kham', 'lich kham'],
  ask_available_slots: ['lich trong', 'con lich', 'con slot', 'hom nay con', 'ngay mai con'],
  check_appointment_status: ['kiem tra lich hen', 'lich hen cua toi', 'ma lich hen', 'xem lich hen', 'lich kham cua toi', 'trang thai lich'],
  reschedule_appointment: ['doi lich', 'doi gio', 'doi ngay', 'doi khung gio', 'doi appointment', 'doi hen'],
  cancel_appointment: ['huy lich', 'huy hen', 'cancel'],
  find_department: ['khoa nao', 'chuyen khoa nao', 'co khoa', 'tim khoa', 'kham khoa'],
  find_doctor: ['bac si', 'doctor', 'bs.', 'bs '],
  find_service: ['dich vu', 'xet nghiem', 'sieu am', 'noi soi', 'goi kham'],
  ask_symptom_department: ['dau', 'sot', 'ngua', 'noi man', 'phat ban', 'kho tho', 'dau bung', 'dau dau', 'met moi'],
  ask_price: ['gia', 'phi', 'bao nhieu tien', 'chi phi', 'bang gia'],
  ask_payment: ['thanh toan', 'qr', 'chuyen khoan', 'hoa don', 'bien lai'],
  ask_qr_payment: ['ma qr', 'qr thanh toan', 'quet qr', 'qr chuyen khoan'],
  ask_invoice: ['xuat hoa don', 'lay hoa don', 'bien lai', 'invoice', 'hoa don dien tu'],
  check_payment_status: ['toi chuyen khoan roi', 'da chuyen khoan', 'kiem tra thanh toan', 'thanh toan chua', 'da thanh toan chua', 'payment status'],
  ask_insurance: ['bhyt', 'bao hiem', 'bao lanh vien phi'],
  insurance_eligibility_check: ['kiem tra bao hiem', 'the bhyt cua toi', 'bao hiem nay co ap dung', 'dung duoc bao hiem khong', 'quyen loi bao hiem'],
  ask_working_hours: ['gio lam viec', 'mo cua', 'dong cua', 'chu nhat', 'cuoi tuan', 'may gio', 'lam viec khong'],
  ask_location: ['dia chi', 'o dau', 'co so', 'chi nhanh', 'duong di', 'gan nhat', 'ban do'],
  branch_recommendation: ['co so nao', 'chi nhanh nao', 'gan toi', 'gan nhat', 'nen kham o dau'],
  ask_patient_portal: ['portal', 'dang nhap', 'quen mat khau', 'ho so', 'ket qua', 'upload', 'cccd'],
  ask_preparation: ['chuan bi gi', 'can chuan bi', 'nhi an', 'nhin an', 'truoc khi kham', 'truoc khi xet nghiem'],
  ask_required_documents: ['giay to gi', 'can mang gi', 'mang cccd', 'the bhyt', 'giay chuyen tuyen', 'ho so cu'],
  check_result_status: ['ket qua cua toi', 'ket qua xet nghiem', 'ket qua cdha', 'ket qua chan doan hinh anh', 'co ket qua chua', 'result status'],
  upload_document_help: ['upload', 'tai len', 'gui anh', 'gui file', 'cccd', 'giay chuyen tuyen', 'ho so kham cu', 'the bhyt'],
  compare_services: ['so sanh', 'khac nhau', 'goi nao hon', 'nen chon goi nao giua'],
  recommend_package: ['goi kham nao', 'goi nao phu hop', 'tu van goi kham', 'kham tong quat goi nao'],
  doctor_recommendation: ['bac si nao phu hop', 'nen kham bac si nao', 'bac si gioi', 'bac si tot'],
  human_support: ['gap nhan vien', 'nhan vien tu van', 'goi lai', 'hotline', 'nguoi that'],
  callback_request: ['goi lai cho toi', 'lien he lai', 'tu van goi lai', 'de lai so', 'callback'],
  lead_capture: ['de lai so dien thoai', 'so cua toi la', 'lien he tu van', 'tu van giup toi'],
  abandoned_booking_recovery: ['tiep tuc dat lich', 'lich cu', 'lan truoc toi dang dat', 'dat tiep'],
  returning_patient_support: ['tai kham', 'tung kham', 'da kham o day', 'benh nhan cu', 'quay lai kham'],
  family_booking: ['dat lich cho me', 'dat lich cho ba', 'dat lich cho bo', 'dat lich cho con', 'dat cho nguoi than', 'cho vo toi', 'cho chong toi'],
  corporate_health_check: ['kham suc khoe cong ty', 'kham doanh nghiep', 'nhan vien cong ty', 'hop dong kham suc khoe'],
  complaint: ['khieu nai', 'gop y', 'phan anh', 'khong hai long'],
  feedback: ['cam nhan', 'danh gia', 'feedback', 'gop y', 'hai long', 'dich vu tot', 'nhan vien tot'],
  casual_chat: ['em la ai', 'ban la ai', 'tro chuyen', 'noi chuyen', 'tam su', 'lo qua', 'hoi lo', 'so qua', 'buon', 'chan', 'haha', 'hehe'],
};

const LEAD_CAPTURE_INTENTS = new Set([
  'callback_request',
  'lead_capture',
  'family_booking',
  'corporate_health_check',
]);

const REAL_DATA_RESPONSE_TYPES = new Set([
  'slot_picker',
  'appointment_summary',
  'appointment_confirmed',
  'payment_status',
  'result_status',
  'service_cards',
  'doctor_cards',
  'department_cards',
  'facility_info',
  'emergency_card',
]);

function toId(value) {
  return value ? String(value) : null;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s:/.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function normalizeList(value, fallback = []) {
  if (Array.isArray(value)) return value.map(normalizeString).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map(normalizeString).filter(Boolean);
  }
  return fallback;
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskPhone(value) {
  const text = String(value || '');
  return text.replace(/(\+?84|0)(\d{2})(\d{3})(\d{3,4})/g, (match, p1, p2, p3, p4) => `${p1}${p2}***${String(p4).slice(-3)}`);
}

function maskSensitiveText(value) {
  let text = String(value || '');
  if (env.chatbot.maskPhoneInLogs) text = maskPhone(text);
  if (env.chatbot.maskEmailInLogs) text = text.replace(/([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***$2');
  if (env.chatbot.maskPersonalIdInLogs) text = text.replace(/\b\d{9,12}\b/g, (match) => `${match.slice(0, 3)}***${match.slice(-3)}`);
  return text;
}

function formatMoney(amount, currency = 'VND') {
  if (amount === undefined || amount === null) return null;
  if (currency === 'VND') return `${Number(amount).toLocaleString('vi-VN')}đ`;
  return `${Number(amount).toLocaleString('vi-VN')} ${currency}`;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

function formatOpeningHours(openingHours) {
  if (!openingHours) return '';
  if (typeof openingHours === 'string') return openingHours;
  if (Array.isArray(openingHours)) {
    return openingHours
      .map((item) => {
        if (typeof item === 'string') return item;
        const day = item.day || item.weekday || item.label || 'Ngày làm việc';
        const open = item.open || item.open_time || item.from;
        const close = item.close || item.close_time || item.to;
        return [day, open && close ? `${open}-${close}` : item.text].filter(Boolean).join(': ');
      })
      .filter(Boolean)
      .join('; ');
  }
  if (typeof openingHours === 'object') {
    return Object.entries(openingHours)
      .map(([day, value]) => {
        if (!value) return null;
        if (typeof value === 'string') return `${day}: ${value}`;
        const open = value.open || value.open_time || value.from;
        const close = value.close || value.close_time || value.to;
        return `${day}: ${open && close ? `${open}-${close}` : JSON.stringify(value)}`;
      })
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function chatbotSystemActor() {
  return {
    actorType: 'system',
    actor_type: 'system',
    actorId: 'chatbot',
    actor_id: 'chatbot',
    serviceName: 'chatbot',
    service_name: 'chatbot',
    userId: null,
    permissions: [
      PERMISSION.SYSTEM.FULL_ACCESS,
      PERMISSION.MESSAGES.MANAGE,
      PERMISSION.PATIENTS.CREATE,
      PERMISSION.PATIENTS.READ,
      PERMISSION.APPOINTMENTS.CREATE,
      PERMISSION.APPOINTMENTS.READ,
    ],
  };
}

function chatbotRequestMeta(session = {}, extra = {}) {
  return {
    source: 'chatbot',
    channel: session.channel || 'website',
    chatbot_session_id: toId(session._id || session.id),
    source_page: session.source_page,
    ...extra,
  };
}

function chatbotHoldOwner(session) {
  return `chatbot_session:${toId(session?._id || session?.id)}`;
}

function formatLocalDateIso(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getVietnamToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return getStartOfDay(new Date(Number(lookup.year), Number(lookup.month) - 1, Number(lookup.day)));
}

function currentVietnamDateIso() {
  return formatLocalDateIso(getVietnamToday());
}

function sessionExpiresAt() {
  return addMinutes(new Date(), env.chatbot.sessionTtlMinutes);
}

function draftExpiresAt() {
  return addMinutes(new Date(), env.chatbot.appointmentDraftTtlMinutes);
}

function getMetaIp(meta = {}) {
  return meta.ipAddress || meta.ip || 'unknown';
}

function assertChatbotEnabled() {
  if (!env.chatbot.enabled) throw createError('Chatbot đang tạm tắt.', 503);
}

function assertWidgetAccess(meta = {}) {
  if (!env.chatbot.widgetTokenRequired) return true;
  if (!env.chatbot.widgetToken) {
    if (env.nodeEnv !== 'production') return true;
    throw createError('Widget token chưa được cấu hình.', 503);
  }
  const token = meta.widgetToken || meta.widget_token;
  if (token !== env.chatbot.widgetToken) throw createError('Widget token không hợp lệ.', 401);
  return true;
}

function assertOrigin(meta = {}) {
  if (!env.chatbot.corsStrict || !env.chatbot.allowedOrigins.length) return true;
  const origin = meta.origin;
  if (!origin || env.chatbot.allowedOrigins.includes(origin)) return true;
  throw createError('Origin không được phép gọi chatbot.', 403);
}

function rateLimitKey(scope, ip, sessionId = '') {
  return `${scope}:${ip}:${sessionId}`;
}

function assertRateLimit({ scope, ip, sessionId, limit, windowMs }) {
  if (!env.chatbot.rateLimitEnabled) return true;
  const key = rateLimitKey(scope, ip, sessionId);
  const now = Date.now();
  const bucket = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateLimitStore.set(key, bucket);
  if (bucket.count > limit) {
    throw createError('Bạn đang gửi quá nhiều yêu cầu chatbot. Vui lòng thử lại sau.', 429);
  }
  return true;
}

function assertPublicRequest(meta = {}, sessionId = null) {
  assertChatbotEnabled();
  assertWidgetAccess(meta);
  assertOrigin(meta);
  const ip = getMetaIp(meta);
  assertRateLimit({
    scope: sessionId ? 'message' : 'session',
    ip,
    sessionId: sessionId || '',
    limit: sessionId ? env.chatbot.rateLimitMaxMessages : env.chatbot.rateLimitMaxSessionsPerIp,
    windowMs: env.chatbot.rateLimitWindowMs,
  });
}

function emptyEntities() {
  return {
    patient_name: null,
    phone: null,
    email: null,
    date_text: null,
    date_iso: null,
    time_text: null,
    time_preference: null,
    department: null,
    department_id: null,
    doctor: null,
    doctor_id: null,
    service: null,
    service_id: null,
    branch: null,
    branch_id: null,
    symptoms: [],
    severity: null,
    red_flags: [],
    insurance_type: null,
    payment_method: null,
    appointment_code: null,
    invoice_code: null,
    result_code: null,
  };
}

function detectPatterns(normalized, patterns) {
  const matches = [];
  for (const [code, variants] of patterns) {
    if (variants.some((variant) => normalized.includes(normalizeText(variant)))) {
      matches.push(code);
    }
  }
  return matches;
}

function detectPromptInjection(normalized) {
  return [
    'ignore previous',
    'bo qua huong dan',
    'bo qua tat ca',
    'system prompt',
    'in prompt',
    'hien prompt',
    'developer message',
    'jailbreak',
    'gia vo la bac si',
    'dong vai bac si',
    'viet lai prompt',
    'xoa quy tac',
    'ke thuoc cho toi',
  ].some((item) => normalized.includes(item));
}

function detectTimePreference(text) {
  const raw = String(text || '').toLowerCase();
  const normalized = normalizeText(text);
  if (/\bsáng\b/i.test(raw) || normalized.includes('buoi sang') || /\bsang\b/.test(normalized) || normalized.includes('morning')) {
    return 'morning';
  }
  if (/\bchiều\b/i.test(raw) || normalized.includes('buoi chieu') || /\bchieu\b/.test(normalized) || normalized.includes('afternoon')) {
    return 'afternoon';
  }
  if (/\btối\b/i.test(raw) || normalized.includes('buoi toi') || normalized.includes('toi nay') || normalized.includes('toi mai') || normalized.includes('evening')) {
    return 'evening';
  }
  return null;
}

function detectExplicitTimeText(text) {
  const raw = String(text || '').toLowerCase();
  const match = raw.match(/\b(?:sau\s*)?(\d{1,2})(?:(?::|h| giờ)\s*(\d{1,2})?)?\b/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = match[2] === undefined || match[2] === '' ? 0 : Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  const hasTimeMarker = /[:h]|giờ|gio|sau\s*\d{1,2}/i.test(match[0]) || /\b(sáng|sang|chiều|chieu|tối|toi)\b/i.test(raw);
  let normalizedHour = hour;
  if (/\b(chiều|chieu|tối|toi)\b/i.test(raw) && normalizedHour > 0 && normalizedHour < 12) normalizedHour += 12;
  return hasTimeMarker ? `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : null;
}

function minutesFromTimeText(timeText) {
  const match = String(timeText || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function dateFromVietnameseText(text) {
  const normalized = normalizeText(text);
  const raw = String(text || '').toLowerCase();
  const today = getVietnamToday();
  const iso = normalized.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return getStartOfDay(new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const slash = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  if (slash) {
    const year = slash[3] ? Number(slash[3]) : today.getFullYear();
    return getStartOfDay(new Date(year, Number(slash[2]) - 1, Number(slash[1])));
  }
  if (normalized.includes('hom nay') || normalized.includes('today')) return today;
  if (normalized.includes('ngay mai') || /\bmai\b/.test(normalized) || normalized.includes('tomorrow')) {
    return getStartOfDay(addMinutes(today, 24 * 60));
  }
  if (normalized.includes('ngay kia') || raw.includes('mốt') || normalized.includes('ngay mot')) {
    return getStartOfDay(addMinutes(today, 2 * 24 * 60));
  }
  if (normalized.includes('cuoi tuan') || normalized.includes('weekend')) {
    const next = new Date(today);
    const diff = (6 - today.getDay() + 7) % 7 || 7;
    next.setDate(today.getDate() + diff);
    return getStartOfDay(next);
  }
  const weekdayMap = [
    ['chu nhat', 0],
    ['thu hai', 1],
    ['thu 2', 1],
    ['thu ba', 2],
    ['thu 3', 2],
    ['thu tu', 3],
    ['thu 4', 3],
    ['thu nam', 4],
    ['thu 5', 4],
    ['thu sau', 5],
    ['thu 6', 5],
    ['thu bay', 6],
    ['thu 7', 6],
  ];
  for (const [label, day] of weekdayMap) {
    if (normalized.includes(label)) {
      const next = new Date(today);
      const diff = (day - today.getDay() + 7) % 7 || 7;
      next.setDate(today.getDate() + diff);
      return getStartOfDay(next);
    }
  }
  return null;
}

function detectPhone(text) {
  const match = String(text || '').match(/(?:\+?84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}/);
  return match ? normalizePhone(match[0]) : null;
}

function detectEmail(text) {
  const match = String(text || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

function detectAppointmentCode(text) {
  const raw = String(text || '').trim();
  const matches = raw.match(/\bAPT[-\s]?[a-fA-F0-9]{6,24}\b|\bCB-\d{8}-[a-fA-F0-9]{6}\b|\b[a-fA-F0-9]{24}\b/i);
  if (!matches) return null;
  return matches[0].replace(/\s+/g, '').toUpperCase();
}

function detectInvoiceCode(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/\b(?:INV|HD|HĐ|HOA DON|HÓA ĐƠN)[-\s:]?[A-Za-z0-9-]{4,32}\b/i);
  return match ? match[0].replace(/\s+/g, '').toUpperCase() : null;
}

function detectResultCode(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/\b(?:LAB|XN|KQ|IMG|CDHA|CĐHA)[-\s:]?[A-Za-z0-9-]{4,32}\b/i);
  return match ? match[0].replace(/\s+/g, '').toUpperCase() : null;
}

function detectInsuranceType(text) {
  const normalized = normalizeText(text);
  if (/(bhyt|bao hiem y te|the bao hiem y te)/.test(normalized)) return 'bhyt';
  if (/(bao hiem tu nhan|bao lanh vien phi|bao hiem cong ty|prudential|bao viet|pvi|aia|manulife)/.test(normalized)) return 'private';
  if (/(bao hiem)/.test(normalized)) return 'unknown';
  return null;
}

function detectPaymentMethod(text) {
  const normalized = normalizeText(text);
  if (/(qr|quet ma|ma qr)/.test(normalized)) return 'qr';
  if (/(chuyen khoan|bank transfer|ngan hang)/.test(normalized)) return 'bank_transfer';
  if (/(tien mat|cash)/.test(normalized)) return 'cash';
  if (/(the|card|visa|master)/.test(normalized)) return 'card';
  return null;
}

function detectSeverity(text) {
  const normalized = normalizeText(text);
  if (/(du doi|khong chiu noi|rat nang|ngay cang nang|ngat|kho tho|co giat)/.test(normalized)) return 'high';
  if (/(nhieu ngay|may ngay|hoi dau|hoi met|am i|keo dai)/.test(normalized)) return 'medium';
  if (/(nhe|hoi|thinh thoang)/.test(normalized)) return 'low';
  return null;
}

function detectConversationMood(text) {
  const normalized = normalizeText(text);
  if (/(khieu nai|phan anh|buc|uc che|khong hai long|te qua|chan qua)/.test(normalized)) return 'frustrated';
  if (/(lo|so|hoang mang|bat an|khong yen tam)/.test(normalized)) return 'worried';
  if (/(cam on|tot qua|hai long|de thuong|ok|duoc roi)/.test(normalized)) return 'positive';
  if (/(haha|hehe|hihi|noi chuyen|tam su)/.test(normalized)) return 'casual';
  return 'neutral';
}

function detectNameFromText(text) {
  const raw = String(text || '').trim();
  const explicit = raw.match(/(?:tên|ten|bệnh nhân|benh nhan|họ tên|ho ten)\s*(?:là|la|:)?\s*([A-Za-zÀ-ỹ\s]{4,60})/i);
  if (explicit) return explicit[1].replace(/\s+/g, ' ').trim();
  const phone = detectPhone(raw);
  if (!phone) return null;
  const beforePhone = raw.slice(0, raw.indexOf(phone.slice(-6)) > -1 ? raw.indexOf(phone.slice(-6)) : raw.length);
  const candidate = beforePhone
    .replace(/[,+-]/g, ' ')
    .replace(/\b(sdt|số điện thoại|so dien thoai|phone)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return candidate.length >= 4 && /[A-Za-zÀ-ỹ]/.test(candidate) ? candidate : null;
}

function mergeEntities(...entityObjects) {
  const merged = emptyEntities();
  for (const entities of entityObjects) {
    if (!entities || typeof entities !== 'object') continue;
    Object.entries(entities).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        merged[key] = [...new Set([...(merged[key] || []), ...value].filter(Boolean))];
      } else if (value !== undefined && value !== null && value !== '') {
        merged[key] = value;
      }
    });
  }
  return merged;
}

async function ensureDefaultTraining() {
  const [intentCount, entityCount, articleCount] = await Promise.all([
    ChatbotIntent.estimatedDocumentCount(),
    ChatbotEntityDictionary.estimatedDocumentCount(),
    KnowledgeArticle.estimatedDocumentCount(),
  ]);

  if (intentCount === 0) {
    await ChatbotIntent.insertMany(DEFAULT_INTENTS.map(([code, name, examples], index) => ({
      code,
      name,
      examples,
      description: `Intent mặc định: ${name}`,
      priority: DEFAULT_INTENTS.length - index,
    })));
  }

  if (entityCount === 0) {
    await ChatbotEntityDictionary.insertMany(DEFAULT_ENTITIES.map(([entity_type, canonical_value, synonyms]) => ({
      entity_type,
      canonical_value,
      synonyms,
    })));
  }

  if (articleCount === 0) {
    await KnowledgeArticle.insertMany(DEFAULT_KNOWLEDGE.map((article) => ({
      ...article,
      status: 'published',
      approved_at: new Date(),
      effective_from: new Date('2026-01-01T00:00:00.000Z'),
    })));
  }
}

let defaultTrainingPromise = null;

function ensureDefaultTrainingInBackground() {
  if (!defaultTrainingPromise) {
    defaultTrainingPromise = ensureDefaultTraining().catch((error) => {
      defaultTrainingPromise = null;
      console.error('Failed to seed chatbot default training', error);
    });
  }
  return defaultTrainingPromise;
}

async function matchDictionaryEntities(text) {
  const normalized = normalizeText(text);
  const dictionaries = await ChatbotEntityDictionary.find({ enabled: true, is_deleted: false }).lean();
  const entities = emptyEntities();

  dictionaries.forEach((item) => {
    const candidates = [item.canonical_value, ...(item.synonyms || [])].map(normalizeText).filter(Boolean);
    if (!candidates.some((candidate) => normalized.includes(candidate))) return;
    if (item.entity_type === 'department') {
      entities.department = item.canonical_value;
      if (item.mapped_id) entities.department_id = toId(item.mapped_id);
    }
    if (item.entity_type === 'service') {
      entities.service = item.canonical_value;
      if (item.mapped_id) entities.service_id = toId(item.mapped_id);
    }
    if (item.entity_type === 'branch') {
      entities.branch = item.canonical_value;
      if (item.mapped_id) entities.branch_id = toId(item.mapped_id);
    }
  });

  return entities;
}

async function enrichEntitiesFromDatabase(text, entities = emptyEntities()) {
  const normalized = normalizeText(text);
  const enriched = { ...entities };
  const pattern = escapeRegex(normalized.slice(0, 80));

  if (!enriched.department) {
    const departments = await Department.find({ status: 'active', is_deleted: false })
      .select('department_name department_code')
      .limit(80)
      .lean();
    const department = departments.find((item) => {
      const haystack = normalizeText(`${item.department_name} ${item.department_code}`);
      return haystack && (normalized.includes(haystack) || haystack.includes(normalized));
    });
    if (department) {
      enriched.department = department.department_name;
      enriched.department_id = toId(department._id);
    }
  }

  if (!enriched.doctor && normalized.includes('bac si')) {
    const doctors = await User.find({
      is_deleted: false,
      status: 'active',
      full_name: { $regex: pattern, $options: 'i' },
    })
      .select('full_name')
      .limit(1)
      .lean();
    if (doctors[0]) {
      enriched.doctor = doctors[0].full_name;
      enriched.doctor_id = toId(doctors[0]._id);
    }
  }

  if (!enriched.service) {
    const services = await ServiceCatalog.find({
      is_deleted: false,
      status: 'active',
      $or: [
        { service_name: { $regex: pattern, $options: 'i' } },
        { description: { $regex: pattern, $options: 'i' } },
      ],
    })
      .select('service_name')
      .limit(1)
      .lean();
    if (services[0]) {
      enriched.service = services[0].service_name;
      enriched.service_id = toId(services[0]._id);
    }
  }

  if (!enriched.branch) {
    const locations = await FacilityLocation.find({ is_deleted: false, public_visible: true, status: 'active' })
      .select('name address')
      .limit(60)
      .lean();
    const branch = locations.find((item) => {
      const haystack = normalizeText(`${item.name} ${item.address || ''}`);
      return normalized.includes(haystack) || haystack.includes(normalized);
    });
    if (branch) {
      enriched.branch = branch.name;
      enriched.branch_id = toId(branch._id);
    }
  }

  return enriched;
}

function localIntentScore(normalized, intent) {
  const keywords = INTENT_KEYWORDS[intent] || [];
  const hits = keywords.filter((keyword) => normalized.includes(keyword)).length;
  if (!hits) return 0;
  return Math.min(0.95, 0.42 + hits * 0.18);
}

async function localAnalyzeMessage(text, session = {}) {
  const normalized = normalizeText(text);
  const dictionaryEntities = await matchDictionaryEntities(text);
  const date = dateFromVietnameseText(text);
  const entities = await enrichEntitiesFromDatabase(text, {
    ...dictionaryEntities,
    date_text: date ? String(text).match(/hôm nay|hom nay|ngày mai|ngay mai|mai|ngày kia|ngay kia|cuối tuần|cuoi tuan|\d{1,2}\/\d{1,2}(?:\/\d{4})?|\d{4}-\d{1,2}-\d{1,2}/i)?.[0] || null : null,
    date_iso: date ? formatLocalDateIso(date) : null,
    time_text: detectExplicitTimeText(text),
    time_preference: detectTimePreference(text),
    phone: detectPhone(text),
    email: detectEmail(text),
    patient_name: detectNameFromText(text),
    severity: detectSeverity(text),
    insurance_type: detectInsuranceType(text),
    payment_method: detectPaymentMethod(text),
    appointment_code: detectAppointmentCode(text),
    invoice_code: detectInvoiceCode(text),
    result_code: detectResultCode(text),
  });

  const redFlags = env.chatbot.redFlagDetectionEnabled ? detectPatterns(normalized, RED_FLAG_PATTERNS) : [];
  const medicalBlocks = env.chatbot.medicalSafetyEnabled ? detectPatterns(normalized, MEDICAL_BLOCK_PATTERNS) : [];
  const resultStatusQuestion = /(co ket qua chua|kiem tra ket qua|trang thai ket qua|ket qua cua toi|da co ket qua)/.test(normalized);
  const effectiveMedicalBlocks = medicalBlocks.filter((block) => !(block === 'lab_interpretation' && resultStatusQuestion));
  if (redFlags.length) {
    return {
      intent: 'emergency',
      confidence: 0.98,
      language: 'vi',
      entities: mergeEntities(entities, { red_flags: redFlags }),
      risk_level: 'emergency',
      red_flags: redFlags,
      medical_blocks: [],
      needs_human: true,
      next_action: 'show_emergency',
      missing_fields: [],
      source: 'local_safety',
    };
  }

  if (effectiveMedicalBlocks.length) {
    return {
      intent: 'medical_safety_block',
      confidence: 0.95,
      language: 'vi',
      entities,
      risk_level: 'medium',
      red_flags: [],
      medical_blocks: effectiveMedicalBlocks,
      needs_human: false,
      next_action: 'safe_redirect',
      missing_fields: [],
      source: 'local_safety',
    };
  }

  if (detectPromptInjection(normalized)) {
    return {
      intent: 'prompt_injection',
      confidence: 0.92,
      language: 'vi',
      entities,
      risk_level: 'medium',
      red_flags: [],
      medical_blocks: [],
      needs_human: false,
      next_action: 'refuse_prompt_injection',
      missing_fields: [],
      source: 'local_safety',
    };
  }

  let bestIntent = 'unknown';
  let confidence = 0.2;
  Object.keys(INTENT_KEYWORDS).forEach((intent) => {
    const score = localIntentScore(normalized, intent);
    if (score > confidence) {
      bestIntent = intent;
      confidence = score;
    }
  });

  if (/(gio lam viec|mo cua|dong cua|chu nhat|cuoi tuan|may gio)/.test(normalized) && !/(dat lich|dat kham|muon kham)/.test(normalized)) {
    bestIntent = 'ask_working_hours';
    confidence = Math.max(confidence, 0.82);
  }
  if (/(dia chi|o dau|co so|chi nhanh|duong di|gan nhat|ban do)/.test(normalized)) {
    bestIntent = 'ask_location';
    confidence = Math.max(confidence, 0.82);
  }
  if (/(goi lai cho toi|lien he lai|tu van goi lai|de lai so)/.test(normalized)) {
    bestIntent = 'callback_request';
    confidence = Math.max(confidence, 0.86);
  }
  if (/(de lai so dien thoai|so cua toi la|lien he tu van)/.test(normalized) && (entities.phone || entities.patient_name)) {
    bestIntent = 'lead_capture';
    confidence = Math.max(confidence, 0.84);
  }
  if (/(dat lich cho|dat cho nguoi than|cho me toi|cho ba toi|cho bo toi|cho con toi|cho vo toi|cho chong toi)/.test(normalized)) {
    bestIntent = 'family_booking';
    confidence = Math.max(confidence, 0.84);
  }
  if (/(kham suc khoe cong ty|kham doanh nghiep|nhan vien cong ty|hop dong kham suc khoe)/.test(normalized)) {
    bestIntent = 'corporate_health_check';
    confidence = Math.max(confidence, 0.88);
  }
  if (/(tiep tuc dat lich|lan truoc toi dang dat|dat tiep|lich cu)/.test(normalized)) {
    bestIntent = 'abandoned_booking_recovery';
    confidence = Math.max(confidence, 0.84);
  }
  if (/(tai kham|tung kham|da kham o day|benh nhan cu|quay lai kham)/.test(normalized)) {
    bestIntent = 'returning_patient_support';
    confidence = Math.max(confidence, 0.82);
  }
  if (/(lich hen cua toi|kiem tra lich hen|trang thai lich|ma lich hen)/.test(normalized)) {
    bestIntent = 'check_appointment_status';
    confidence = Math.max(confidence, 0.86);
  }
  if (/(xuat hoa don|lay hoa don|hoa don dien tu|bien lai)/.test(normalized)) {
    bestIntent = 'ask_invoice';
    confidence = Math.max(confidence, 0.84);
  }
  if (/(ma qr|qr thanh toan|quet qr|qr chuyen khoan)/.test(normalized)) {
    bestIntent = 'ask_qr_payment';
    confidence = Math.max(confidence, 0.84);
  }
  if (/(da chuyen khoan|kiem tra thanh toan|da thanh toan chua|thanh toan cua toi)/.test(normalized)) {
    bestIntent = 'check_payment_status';
    confidence = Math.max(confidence, 0.86);
  }
  if (/(kiem tra bao hiem|bao hiem nay co ap dung|the bhyt cua toi|quyen loi bao hiem|dung duoc bao hiem khong)/.test(normalized)) {
    bestIntent = 'insurance_eligibility_check';
    confidence = Math.max(confidence, 0.84);
  }
  if (/(chuan bi gi|can chuan bi|nhin an|nhi an|truoc khi kham|truoc khi xet nghiem)/.test(normalized)) {
    bestIntent = 'ask_preparation';
    confidence = Math.max(confidence, 0.84);
  }
  if (/(giay to gi|can mang gi|mang cccd|the bhyt|giay chuyen tuyen|ho so cu)/.test(normalized)) {
    bestIntent = 'ask_required_documents';
    confidence = Math.max(confidence, 0.84);
  }
  if (/(ket qua cua toi|co ket qua chua|kiem tra ket qua|trang thai ket qua)/.test(normalized)) {
    bestIntent = 'check_result_status';
    confidence = Math.max(confidence, 0.86);
  }
  if (/(so sanh|khac nhau|goi nao hon|nen chon goi nao giua)/.test(normalized)) {
    bestIntent = 'compare_services';
    confidence = Math.max(confidence, 0.78);
  }
  if (/(goi kham nao|goi nao phu hop|tu van goi kham|kham tong quat goi nao)/.test(normalized)) {
    bestIntent = 'recommend_package';
    confidence = Math.max(confidence, 0.82);
  }
  if (/(bac si nao phu hop|nen kham bac si nao|bac si gioi|bac si tot)/.test(normalized)) {
    bestIntent = 'doctor_recommendation';
    confidence = Math.max(confidence, 0.82);
  }
  if (/(co so nao|chi nhanh nao|gan toi|nen kham o dau)/.test(normalized)) {
    bestIntent = 'branch_recommendation';
    confidence = Math.max(confidence, 0.8);
  }
  if (/(cam nhan|danh gia|feedback|dich vu tot|nhan vien tot)/.test(normalized)) {
    bestIntent = 'feedback';
    confidence = Math.max(confidence, 0.78);
  }

  if (entities.department && ['unknown', 'find_department', 'ask_symptom_department'].includes(bestIntent)) {
    bestIntent = normalized.includes('dat') || normalized.includes('lich') || normalized.includes('kham')
      ? 'book_appointment'
      : 'ask_symptom_department';
    confidence = Math.max(confidence, 0.72);
  }
  if (entities.date_iso && ['unknown', 'ask_symptom_department'].includes(bestIntent)) {
    bestIntent = 'book_appointment';
    confidence = Math.max(confidence, 0.68);
  }
  if (session.current_intent === 'book_appointment' && (entities.date_iso || entities.phone || entities.patient_name)) {
    bestIntent = 'book_appointment';
    confidence = Math.max(confidence, 0.74);
  }

  const missingFields = [];
  if (bestIntent === 'book_appointment' || bestIntent === 'ask_available_slots') {
    if (!entities.department && !entities.doctor && !session.context?.booking?.department_id) missingFields.push('department');
    if (!entities.date_iso && !session.context?.booking?.date_iso) missingFields.push('date');
    if (env.chatbot.appointmentRequirePatientName && !entities.patient_name && !session.context?.booking?.patient_name) missingFields.push('patient_name');
    if (env.chatbot.appointmentRequirePhone && !entities.phone && !session.context?.booking?.phone) missingFields.push('phone');
  }
  if (bestIntent === 'callback_request') {
    if (!entities.patient_name && !session.context?.lead?.patient_name) missingFields.push('patient_name');
    if (!entities.phone && !session.context?.lead?.phone) missingFields.push('phone');
  }
  if (LEAD_CAPTURE_INTENTS.has(bestIntent) && bestIntent !== 'insurance_eligibility_check') {
    if (!entities.patient_name && !session.context?.lead?.patient_name) missingFields.push('patient_name');
    if (!entities.phone && !session.context?.lead?.phone) missingFields.push('phone');
  }
  if (bestIntent === 'insurance_eligibility_check' && !entities.insurance_type && !session.context?.lead?.insurance_type) {
    missingFields.push('insurance_type');
  }

  return {
    intent: bestIntent,
    confidence,
    language: 'vi',
    entities,
    risk_level: confidence < LOW_CONFIDENCE_THRESHOLD ? 'medium' : 'low',
    red_flags: [],
    medical_blocks: [],
    needs_human: bestIntent === 'human_support' || bestIntent === 'complaint',
    next_action: resolveNextAction(bestIntent, entities, missingFields),
    missing_fields: missingFields,
    source: 'local_classifier',
  };
}

function resolveNextAction(intent, entities, missingFields = []) {
  if (intent === 'emergency') return 'show_emergency';
  if (intent === 'medical_safety_block') return 'safe_redirect';
  if (intent === 'human_support' || intent === 'complaint') return 'handoff';
  if (intent === 'callback_request') return missingFields.length ? 'collect_callback' : 'create_callback_ticket';
  if (['lead_capture', 'family_booking', 'corporate_health_check'].includes(intent)) return missingFields.length ? 'collect_lead' : 'create_lead_ticket';
  if (intent === 'feedback') return 'collect_feedback';
  if (intent === 'insurance_eligibility_check') return missingFields.length ? 'ask_insurance_type' : 'answer_kb';
  if (intent === 'abandoned_booking_recovery') return 'recover_booking';
  if (intent === 'returning_patient_support') return 'returning_patient_support';
  if (intent === 'check_appointment_status') return 'lookup_appointment';
  if (intent === 'reschedule_appointment') return entities.date_iso ? 'find_reschedule_slots' : 'ask_reschedule_date';
  if (intent === 'cancel_appointment') return 'confirm_cancel_appointment';
  if (intent === 'book_appointment' || intent === 'ask_available_slots') {
    if (missingFields.includes('department') && !entities.doctor) return 'ask_department';
    if (missingFields.includes('date')) return 'ask_date';
    return 'find_available_slots';
  }
  if (intent === 'find_doctor') return 'search_doctors';
  if (intent === 'doctor_recommendation') return 'search_doctors';
  if (intent === 'find_department' || intent === 'ask_symptom_department') return 'suggest_departments';
  if (intent === 'find_service') return 'search_services';
  if (intent === 'compare_services' || intent === 'recommend_package') return 'search_services';
  if (intent === 'ask_price') return 'search_price';
  if (intent === 'ask_working_hours') return 'answer_facility_hours';
  if (intent === 'ask_location') return 'answer_facility_location';
  if (intent === 'branch_recommendation') return 'answer_facility_location';
  if (intent === 'casual_chat') return 'small_talk';
  if (intent === 'check_payment_status') return 'lookup_payment_status';
  if (intent === 'check_result_status') return 'lookup_result_status';
  if (intent === 'upload_document_help') return 'upload_document_help';
  if (['ask_payment', 'ask_qr_payment', 'ask_invoice', 'ask_insurance', 'ask_patient_portal', 'ask_preparation', 'ask_required_documents'].includes(intent)) return 'answer_kb';
  return 'fallback';
}

function cleanJsonText(value) {
  return String(value || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function normalizeAnalysisShape(value = {}, fallback = {}) {
  const base = {
    intent: 'unknown',
    confidence: 0.2,
    language: DEFAULT_LANGUAGE,
    entities: emptyEntities(),
    risk_level: 'low',
    red_flags: [],
    medical_blocks: [],
    needs_human: false,
    next_action: 'fallback',
    missing_fields: [],
  };
  const merged = {
    ...base,
    ...fallback,
    ...value,
    entities: mergeEntities(base.entities, fallback.entities, value.entities),
  };
  if (fallback.entities?.date_iso) {
    merged.entities.date_iso = fallback.entities.date_iso;
    merged.entities.date_text = fallback.entities.date_text || merged.entities.date_text;
  }
  merged.confidence = Math.max(0, Math.min(1, Number(merged.confidence || 0)));
  merged.red_flags = Array.isArray(merged.red_flags) ? merged.red_flags : [];
  merged.medical_blocks = Array.isArray(merged.medical_blocks) ? merged.medical_blocks : [];
  merged.missing_fields = Array.isArray(merged.missing_fields) ? merged.missing_fields : [];
  return merged;
}

async function callGeminiForAnalysis(text, session, history, localFallback) {
  if (
    env.aiProvider !== 'gemini'
    || !env.chatbot.aiEnabled
    || !env.geminiApiKey
    || localFallback.intent === 'emergency'
    || localFallback.intent === 'medical_safety_block'
    || localFallback.intent === 'prompt_injection'
  ) {
    return localFallback;
  }

  const aiCallCount = Number(session.context?.ai_call_count || 0);
  if (aiCallCount >= env.chatbot.rateLimitMaxAiCallsPerSession) {
    return { ...localFallback, source: 'local_ai_limit' };
  }

  const prompt = [
    'Bạn là bộ phân tích JSON cho chatbot tư vấn & đặt lịch y tế.',
    'Chỉ trả JSON hợp lệ, không markdown, không giải thích.',
    `Ngày hiện tại tại Việt Nam là ${currentVietnamDateIso()} (Asia/Saigon). Resolve "hôm nay", "ngày mai", "mai", "ngày kia" dựa trên ngày này.`,
    'Giới hạn bắt buộc: không chẩn đoán, không kê thuốc, không đưa liều dùng, không đọc xét nghiệm thay bác sĩ, không tự bịa lịch/giá/bác sĩ.',
    'Nếu thấy cấp cứu/red flag, intent phải là "emergency", risk_level "emergency", next_action "show_emergency".',
    'Schema: {"intent":"book_appointment|ask_available_slots|check_appointment_status|reschedule_appointment|cancel_appointment|find_department|find_doctor|doctor_recommendation|find_service|compare_services|recommend_package|ask_symptom_department|emergency|ask_price|ask_payment|ask_qr_payment|ask_invoice|check_payment_status|ask_insurance|insurance_eligibility_check|ask_working_hours|ask_location|branch_recommendation|ask_patient_portal|ask_preparation|ask_required_documents|check_result_status|upload_document_help|human_support|callback_request|lead_capture|abandoned_booking_recovery|returning_patient_support|family_booking|corporate_health_check|complaint|feedback|casual_chat|greeting|thanks|goodbye|unknown","confidence":0.0,"language":"vi|en","entities":{"patient_name":null,"phone":null,"email":null,"date_text":null,"date_iso":null,"time_text":null,"time_preference":null,"department":null,"doctor":null,"service":null,"branch":null,"symptoms":[],"severity":null,"insurance_type":null,"payment_method":null,"appointment_code":null,"invoice_code":null,"result_code":null},"risk_level":"low|medium|high|emergency","red_flags":[],"needs_human":false,"next_action":"find_available_slots|ask_department|ask_date|lookup_appointment|ask_reschedule_date|find_reschedule_slots|confirm_cancel_appointment|search_doctors|search_services|search_price|answer_kb|lookup_payment_status|lookup_result_status|upload_document_help|answer_facility_hours|answer_facility_location|small_talk|collect_callback|create_callback_ticket|collect_lead|create_lead_ticket|collect_feedback|recover_booking|returning_patient_support|handoff|fallback|show_emergency","missing_fields":[]}',
    `Ngữ cảnh session: ${JSON.stringify({ current_intent: session.current_intent, current_step: session.current_step, context: session.context || {} })}`,
    `Lịch sử gần nhất: ${JSON.stringify(history.slice(-env.chatbot.maxHistoryMessages).map((item) => ({ role: item.sender_type, text: item.content })))}`,
    `Tin nhắn user: ${text}`,
  ].join('\n');

  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const request = ai.models.generateContent({
      model: env.geminiFastModel,
      contents: prompt,
      config: {
        temperature: env.geminiTemperature,
        topP: env.geminiTopP,
        topK: env.geminiTopK,
        maxOutputTokens: env.geminiMaxOutputTokens,
        responseMimeType: 'application/json',
      },
    });
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini timeout')), env.geminiTimeoutMs);
    });
    const response = await Promise.race([request, timeout]);
    const parsed = JSON.parse(cleanJsonText(response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'));
    return {
      ...normalizeAnalysisShape(parsed, localFallback),
      source: 'gemini',
      provider: 'gemini',
      model: env.geminiFastModel,
    };
  } catch (error) {
    return {
      ...localFallback,
      source: 'local_after_gemini_error',
      provider_error: error.message,
    };
  }
}

async function analyzeMessage(text, session, history = []) {
  const startedAt = Date.now();
  const local = await localAnalyzeMessage(text, session);
  const analysis = await callGeminiForAnalysis(text, session, history, local);
  analysis.latency_ms = Date.now() - startedAt;
  analysis.prompt_version = env.chatbot.promptVersion;
  return normalizeAnalysisShape(analysis, local);
}

function buildQuickReplies(items) {
  return items.map((item) => (typeof item === 'string' ? { label: item, value: item } : item));
}

function botText(content, payload = {}) {
  return {
    message_type: payload.type && payload.type !== 'text' ? 'card' : 'text',
    content,
    structured_payload: payload,
  };
}

function contextualQuickReplies(sourcePage = '', pageContext = {}) {
  const normalized = normalizeText(sourcePage);
  const replies = [];
  if (pageContext?.doctor_id || normalized.includes('doctor') || normalized.includes('bac-si') || normalized.includes('bac_si')) {
    replies.push(
      { label: 'Xem lịch bác sĩ này', value: 'Bác sĩ này còn lịch ngày mai không?' },
      { label: 'Hỏi phí khám', value: 'Phí khám với bác sĩ này bao nhiêu?' },
    );
  }
  if (pageContext?.department_id || normalized.includes('department') || normalized.includes('chuyen-khoa') || normalized.includes('chuyen_khoa')) {
    replies.push(
      { label: 'Đặt lịch chuyên khoa này', value: 'Tôi muốn đặt lịch chuyên khoa này ngày mai' },
      { label: 'Xem bác sĩ', value: 'Chuyên khoa này có bác sĩ nào?' },
    );
  }
  if (normalized.includes('bang-gia') || normalized.includes('pricing') || normalized.includes('billing')) {
    replies.push(
      { label: 'Hỏi giá dịch vụ', value: 'Tôi muốn hỏi giá dịch vụ này' },
      { label: 'Hỏi bảo hiểm', value: 'Dịch vụ này có áp dụng bảo hiểm không?' },
    );
  }
  if (normalized.includes('dat-lich') || normalized.includes('appointment')) {
    replies.push(
      { label: 'Tìm slot gần nhất', value: 'Tôi muốn tìm lịch khám gần nhất' },
      { label: 'Kiểm tra lịch hẹn', value: 'Tôi muốn kiểm tra lịch hẹn của tôi' },
    );
  }
  return replies;
}

function welcomePayload(sourcePage = '', pageContext = {}) {
  const contextual = contextualQuickReplies(sourcePage, pageContext);
  const base = [
    { label: 'Đặt lịch khám', value: 'Tôi muốn đặt lịch khám' },
    { label: 'Tìm chuyên khoa', value: 'Tôi nên khám chuyên khoa nào?' },
    { label: 'Tìm bác sĩ', value: 'Tôi muốn tìm bác sĩ' },
    { label: 'Hỏi giá dịch vụ', value: 'Khám tổng quát bao nhiêu tiền?' },
    { label: 'Bảo hiểm', value: 'Có nhận BHYT không?' },
    { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
    { label: 'Cấp cứu', value: 'Tôi cần cấp cứu' },
  ];
  return {
    type: 'quick_replies',
    quick_replies: buildQuickReplies([...contextual, ...base].slice(0, 8)),
  };
}

function buildWelcomeMessage(sourcePage = '', pageContext = {}) {
  const suffix = sourcePage ? ' Em đang theo ngữ cảnh trang hiện tại để hỗ trợ nhanh hơn.' : '';
  return botText(
    `Xin chào anh/chị, em là ${env.chatbot.botDisplayName}. Em có thể hỗ trợ đặt lịch, tìm chuyên khoa/bác sĩ, hỏi thông tin dịch vụ, bảo hiểm, thanh toán hoặc chuyển nhân viên tư vấn.${suffix}`,
    welcomePayload(sourcePage, pageContext),
  );
}

function leadScoreForAnalysis(analysis = {}, text = '') {
  const normalized = normalizeText(text);
  let score = 0;
  if (['book_appointment', 'ask_available_slots', 'family_booking', 'corporate_health_check'].includes(analysis.intent)) score += 45;
  if (['ask_price', 'ask_insurance', 'doctor_recommendation', 'recommend_package'].includes(analysis.intent)) score += 25;
  if (analysis.entities?.phone) score += 25;
  if (analysis.entities?.patient_name) score += 10;
  if (analysis.entities?.date_iso || analysis.entities?.time_preference) score += 10;
  if (/(muon dat|dat lich|con lich|chieu mai|sang mai|goi lai|lien he)/.test(normalized)) score += 15;
  return Math.max(0, Math.min(100, score));
}

function leadPriorityFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function updateConversationInsights(session, analysis = {}, text = '') {
  const context = session.context || {};
  const mood = detectConversationMood(text);
  const score = leadScoreForAnalysis(analysis, text);
  const tags = new Set([...(context.insights?.tags || [])]);
  if (analysis.intent) tags.add(analysis.intent);
  if (analysis.risk_level === 'emergency') tags.add('emergency');
  if (analysis.intent === 'book_appointment' || analysis.intent === 'ask_available_slots') tags.add('appointment_intent');
  if (['ask_payment', 'ask_qr_payment', 'ask_invoice', 'check_payment_status'].includes(analysis.intent)) tags.add('billing_issue');
  if (['ask_insurance', 'insurance_eligibility_check'].includes(analysis.intent)) tags.add('insurance_question');
  if (['complaint', 'feedback'].includes(analysis.intent) || mood === 'frustrated') tags.add('feedback_or_complaint');
  if (score >= 70) tags.add('high_intent_lead');
  if (mood !== 'neutral') tags.add(`mood_${mood}`);

  session.context = {
    ...context,
    insights: {
      ...(context.insights || {}),
      last_intent: analysis.intent,
      last_confidence: analysis.confidence,
      last_mood: mood,
      lead_score: Math.max(score, Number(context.insights?.lead_score || 0)),
      lead_priority: leadPriorityFromScore(Math.max(score, Number(context.insights?.lead_score || 0))),
      tags: [...tags].slice(0, 16),
      updated_at: new Date().toISOString(),
    },
  };
}

function canRewriteNaturalTone(reply = {}, analysis = {}) {
  if (!env.chatbot.naturalToneEnabled || !env.chatbot.aiEnabled || !env.geminiApiKey) return false;
  if (!analysis || analysis.source === 'local_ai_limit') return false;
  if (['emergency', 'medical_safety_block', 'prompt_injection'].includes(analysis.intent)) return false;
  const content = normalizeString(reply.content);
  if (!content || content.length > env.chatbot.naturalToneMaxChars) return false;
  const payloadType = reply.structured_payload?.type;
  if (REAL_DATA_RESPONSE_TYPES.has(payloadType)) return false;
  if (/\b(APT|CB|INV|LAB|IMG|XN|KQ|CDHA|CĐHA)[-\s:]?[A-Z0-9-]{4,}\b/i.test(content)) return false;
  if (/\d{1,3}(?:[.,]\d{3})+đ|\d+\s*(?:phút|ngày|giờ)/i.test(content)) return false;
  return true;
}

async function rewriteReplyTone(reply = {}, session = {}, analysis = {}, userText = '', history = []) {
  if (!canRewriteNaturalTone(reply, analysis)) return reply;
  const toneCallCount = Number(session.context?.tone_ai_call_count || 0);
  if (toneCallCount >= Math.max(3, Math.floor(env.chatbot.rateLimitMaxAiCallsPerSession / 3))) return reply;

  const prompt = [
    'Bạn là bộ viết lại giọng điệu cho chatbot lễ tân y tế tiếng Việt.',
    'Nhiệm vụ: viết lại câu trả lời sao cho tự nhiên, ấm áp, người đối người, ngắn gọn.',
    'Ràng buộc tuyệt đối: không thêm dữ kiện mới, không thêm giá/lịch/bác sĩ/chính sách, không chẩn đoán, không kê thuốc, không đổi ý nghĩa, không đổi nút/hành động.',
    'Nếu câu gốc đã ổn, chỉ làm mềm câu chữ. Trả về đúng phần nội dung text, không markdown.',
    `Intent: ${analysis.intent || 'unknown'}`,
    `Mood user: ${detectConversationMood(userText)}`,
    `Lịch sử gần nhất: ${JSON.stringify((history || []).slice(-4).map((item) => ({ role: item.sender_type, text: item.content })))}`,
    `User vừa nói: ${userText}`,
    `Câu gốc: ${reply.content}`,
  ].join('\n');

  try {
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
    const request = ai.models.generateContent({
      model: env.geminiFastModel,
      contents: prompt,
      config: {
        temperature: 0.35,
        topP: env.geminiTopP,
        topK: env.geminiTopK,
        maxOutputTokens: 220,
      },
    });
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini tone timeout')), Math.min(env.geminiTimeoutMs, 8000));
    });
    const response = await Promise.race([request, timeout]);
    const rewritten = cleanJsonText(response.text || response.candidates?.[0]?.content?.parts?.[0]?.text || '').replace(/^["']|["']$/g, '').trim();
    if (!rewritten || rewritten.length > env.chatbot.naturalToneMaxChars * 1.2) return reply;
    session.context = {
      ...(session.context || {}),
      tone_ai_call_count: toneCallCount + 1,
    };
    return {
      ...reply,
      content: rewritten,
      structured_payload: {
        ...(reply.structured_payload || {}),
        natural_tone: {
          enabled: true,
          provider: 'gemini',
          model: env.geminiFastModel,
        },
      },
    };
  } catch (error) {
    return reply;
  }
}

async function getSessionOrThrow(sessionId) {
  if (!isValidObjectId(sessionId)) throw createError('session_id không hợp lệ.', 400);
  const session = await ChatbotSession.findOne({ _id: sessionId, is_deleted: false });
  if (!session) throw createError('Không tìm thấy phiên chatbot.', 404);
  return session;
}

async function createSession(payload = {}, actor = {}, meta = {}) {
  assertPublicRequest(meta);
  ensureDefaultTrainingInBackground();

  const sourcePage = normalizeString(payload.source_page || payload.sourcePage);
  const pageContext = payload.page_context || payload.pageContext || {};
  const language = normalizeString(payload.language) || env.chatbot.defaultLanguage || DEFAULT_LANGUAGE;
  const anonymousId = payload.anonymous_id || payload.anonymousId || meta.deviceId || randomBytes(8).toString('hex');
  const previousSession = env.chatbot.abandonedBookingRecoveryEnabled
    ? await ChatbotSession.findOne({
      anonymous_id: anonymousId,
      is_deleted: false,
      status: { $in: ['active', 'handoff'] },
      'context.booking': { $exists: true },
      $or: [
        { 'context.booking.department': { $exists: true, $ne: null } },
        { 'context.booking.doctor': { $exists: true, $ne: null } },
        { 'context.booking.date_iso': { $exists: true, $ne: null } },
        { 'context.booking.selected_slot': { $exists: true, $ne: null } },
      ],
    }).sort({ last_message_at: -1, created_at: -1 }).lean()
    : null;
  const previousBooking = previousSession?.context?.booking || null;
  const session = await ChatbotSession.create({
    channel: payload.channel || 'website',
    source_page: sourcePage,
    anonymous_id: anonymousId,
    patient_id: actor?.patientId,
    status: 'active',
    language,
    risk_level: 'low',
    context: {
      booking: {},
      fallback_count: 0,
      ai_call_count: 0,
      page_context: pageContext,
      previous_booking: previousBooking ? {
        department: previousBooking.department,
        doctor: previousBooking.doctor,
        date_iso: previousBooking.date_iso,
        time_preference: previousBooking.time_preference,
        selected_slot: previousBooking.selected_slot,
        source_session_id: toId(previousSession._id),
      } : undefined,
    },
    metadata: {
      ip: getMetaIp(meta),
      user_agent: meta.userAgent,
      referrer: payload.referrer || payload.referrer_url,
      source_page: sourcePage,
      page_context: pageContext,
    },
    last_message_at: new Date(),
    expires_at: sessionExpiresAt(),
  });

  const welcome = previousBooking
    ? botText(
      `Chào mừng anh/chị quay lại. Lần trước mình đang trao đổi về ${previousBooking.department || previousBooking.doctor || 'lịch khám'}${previousBooking.date_iso ? ` ngày ${formatDate(`${previousBooking.date_iso}T00:00:00`)}` : ''}. Anh/chị muốn tiếp tục hay bắt đầu nhu cầu mới ạ?`,
      {
        type: 'quick_replies',
        quick_replies: buildQuickReplies([
          { label: 'Tiếp tục đặt lịch', value: 'Tôi muốn tiếp tục đặt lịch lần trước' },
          { label: 'Đặt lịch mới', value: 'Tôi muốn đặt lịch khám mới' },
          { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
        ]),
      },
    )
    : buildWelcomeMessage(sourcePage, pageContext);
  const message = await ChatbotMessage.create({
    session_id: session._id,
    sender_type: 'bot',
    message_type: welcome.message_type,
    content: welcome.content,
    structured_payload: welcome.structured_payload,
  });

  return {
    session: session.toJSON(),
    messages: [message.toJSON()],
  };
}

async function getSession(sessionId) {
  const session = await getSessionOrThrow(sessionId);
  return session.toJSON();
}

async function listMessages(sessionId, query = {}) {
  await getSessionOrThrow(sessionId);
  const { page, limit, skip } = getPagination(query, 40, 100);
  const [items, total] = await Promise.all([
    ChatbotMessage.find({ session_id: sessionId, is_deleted: false })
      .sort({ created_at: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ChatbotMessage.countDocuments({ session_id: sessionId, is_deleted: false }),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function findDepartmentsForEntities(entities = {}, text = '') {
  const filter = { is_deleted: false, status: 'active' };
  const terms = [entities.department, text].map(normalizeString).filter(Boolean);
  if (entities.department_id && isValidObjectId(entities.department_id)) {
    filter._id = entities.department_id;
  } else if (terms.length) {
    const regex = new RegExp(terms.map(escapeRegex).join('|'), 'i');
    filter.$or = [{ department_name: regex }, { department_code: regex }, { department_type: regex }];
  }
  const departments = await Department.find(filter)
    .select('department_name department_code department_type location_note')
    .limit(8)
    .lean();
  if (departments.length) return departments;
  return Department.find({ is_deleted: false, status: 'active' })
    .select('department_name department_code department_type location_note')
    .limit(6)
    .lean();
}

async function findDoctorsForEntities(entities = {}, text = '') {
  const normalized = normalizeText([entities.doctor, entities.department, entities.service, text].filter(Boolean).join(' '));
  const doctorFilter = { is_deleted: false, status: 'active' };
  if (entities.doctor_id && isValidObjectId(entities.doctor_id)) doctorFilter.user_id = entities.doctor_id;
  if (entities.department_id && isValidObjectId(entities.department_id)) doctorFilter.department_id = entities.department_id;

  const doctors = await DoctorProfile.find({
    ...doctorFilter,
    public_profile_enabled: true,
  })
    .populate('user_id', 'full_name employee_code avatar_url')
    .populate('department_id', 'department_name department_code')
    .sort({ years_of_experience: -1, updated_at: -1 })
    .limit(20)
    .lean();

  return doctors
    .filter((profile) => {
      if (!normalized || entities.department_id || entities.doctor_id) return true;
      const haystack = normalizeText(`${profile.user_id?.full_name || ''} ${profile.specialty || ''} ${profile.subspecialty || ''} ${profile.department_id?.department_name || ''}`);
      return normalized.split(' ').some((part) => part.length > 2 && haystack.includes(part));
    })
    .slice(0, 6)
    .map((profile) => ({
      doctor_id: toId(profile.user_id?._id || profile.user_id),
      doctor_name: profile.user_id?.full_name || 'Bác sĩ',
      specialty: profile.specialty,
      subspecialty: profile.subspecialty,
      department_id: toId(profile.department_id?._id || profile.department_id),
      department_name: profile.department_id?.department_name,
      years_of_experience: profile.years_of_experience,
      consultation_fee: profile.consultation_fee,
      fee_display: formatMoney(profile.consultation_fee),
      avatar_url: profile.avatar_url,
      biography: profile.biography,
    }));
}

async function findServicesForEntities(entities = {}, text = '') {
  const filter = { is_deleted: false, status: 'active' };
  if (entities.service_id && isValidObjectId(entities.service_id)) filter._id = entities.service_id;
  if (entities.department_id && isValidObjectId(entities.department_id)) filter.department_id = entities.department_id;
  const keyword = normalizeString(entities.service || entities.department || text);
  if (keyword && !filter._id) {
    const regex = new RegExp(escapeRegex(keyword), 'i');
    filter.$or = [{ service_name: regex }, { service_code: regex }, { description: regex }, { service_type: regex }];
  }
  const services = await ServiceCatalog.find(filter)
    .populate('department_id', 'department_name department_code')
    .sort({ updated_at: -1 })
    .limit(8)
    .lean();
  return services.map((service) => ({
    service_id: toId(service._id),
    service_name: service.service_name,
    service_type: service.service_type,
    department_id: toId(service.department_id?._id || service.department_id),
    department_name: service.department_id?.department_name,
    description: service.description,
    unit_price: service.unit_price,
    currency: service.currency || 'VND',
    price_display: formatMoney(service.unit_price, service.currency || 'VND'),
  }));
}

function timePreferenceFilter(slot, timePreference) {
  if (!timePreference) return true;
  const hour = new Date(slot.slot_time).getHours();
  if (timePreference === 'morning') return hour >= 6 && hour < 12;
  if (timePreference === 'afternoon') return hour >= 12 && hour < 18;
  if (timePreference === 'evening') return hour >= 18 && hour < 22;
  return true;
}

function explicitTimeFilter(slot, timeText) {
  const requestedMinutes = minutesFromTimeText(timeText);
  if (requestedMinutes === null) return true;
  const slotDate = new Date(slot.slot_time);
  const slotMinutes = slotDate.getHours() * 60 + slotDate.getMinutes();
  return Math.abs(slotMinutes - requestedMinutes) <= 30;
}

async function findAvailableSlots(entities = {}, session = {}) {
  const booking = session.context?.booking || {};
  const dateIso = entities.date_iso || booking.date_iso;
  const date = dateIso ? new Date(`${dateIso}T00:00:00`) : getStartOfDay(new Date());
  const start = getStartOfDay(date);
  const end = getEndOfDay(date);
  const filter = {
    is_deleted: false,
    status: { $in: ['published', 'active'] },
    patient_portal_enabled: true,
    staff_only: { $ne: true },
    shift_start: { $lte: end },
    shift_end: { $gte: start },
  };
  const departmentId = entities.department_id || booking.department_id;
  const doctorId = entities.doctor_id || booking.doctor_id;
  if (departmentId && isValidObjectId(departmentId)) filter.department_id = departmentId;
  if (doctorId && isValidObjectId(doctorId)) filter.doctor_id = doctorId;

  const schedules = await DoctorSchedule.find(filter)
    .sort({ shift_start: 1 })
    .limit(20)
    .lean();

  const doctorIds = [...new Set(schedules.map((item) => toId(item.doctor_id)).filter(Boolean))];
  const departmentIds = [...new Set(schedules.map((item) => toId(item.department_id)).filter(Boolean))];
  const [doctors, departments, profiles] = await Promise.all([
    doctorIds.length ? User.find({ _id: { $in: doctorIds }, is_deleted: false }).select('full_name employee_code').lean() : [],
    departmentIds.length ? Department.find({ _id: { $in: departmentIds }, is_deleted: false }).select('department_name department_code').lean() : [],
    doctorIds.length ? DoctorProfile.find({ user_id: { $in: doctorIds }, is_deleted: false }).select('user_id consultation_fee specialty').lean() : [],
  ]);
  const doctorMap = new Map(doctors.map((item) => [toId(item._id), item]));
  const departmentMap = new Map(departments.map((item) => [toId(item._id), item]));
  const profileMap = new Map(profiles.map((item) => [toId(item.user_id), item]));

  const slots = [];
  for (const schedule of schedules) {
    const available = await scheduleService.getAvailableSlots(schedule._id, { publicView: true, onlyAvailable: true });
    (available.items || [])
      .filter((slot) => new Date(slot.slot_time) >= new Date())
      .filter((slot) => timePreferenceFilter(slot, entities.time_preference || booking.time_preference))
      .filter((slot) => explicitTimeFilter(slot, entities.time_text || booking.time_text))
      .slice(0, 8)
      .forEach((slot) => {
        const doctor = doctorMap.get(toId(schedule.doctor_id));
        const department = departmentMap.get(toId(schedule.department_id));
        const profile = profileMap.get(toId(schedule.doctor_id));
        slots.push({
          slot_id: `${toId(schedule._id)}:${new Date(slot.slot_time).toISOString()}`,
          doctor_schedule_id: toId(schedule._id),
          doctor_id: toId(schedule.doctor_id),
          department_id: toId(schedule.department_id),
          appointment_time: new Date(slot.slot_time).toISOString(),
          slot_end: new Date(slot.slot_end).toISOString(),
          date: formatDate(slot.slot_time),
          time: formatTime(slot.slot_time),
          schedule_window: `${formatTime(schedule.shift_start)} - ${formatTime(schedule.shift_end)}`,
          doctor_name: doctor?.full_name || 'Bác sĩ',
          department_name: department?.department_name || entities.department || 'Chuyên khoa',
          specialty: profile?.specialty,
          fee_display: formatMoney(profile?.consultation_fee),
          remaining: 1,
          remaining_label: 'Còn trống',
          source: 'doctor_schedule',
        });
      });
  }

  return slots.sort((first, second) => new Date(first.appointment_time) - new Date(second.appointment_time)).slice(0, 9);
}

async function searchKnowledgeBase(text, intent = 'unknown') {
  const normalized = normalizeText(text);
  const now = new Date();
  const articles = await KnowledgeArticle.find({
    is_deleted: false,
    status: 'published',
    $and: [
      { $or: [{ effective_from: { $exists: false } }, { effective_from: null }, { effective_from: { $lte: now } }] },
      { $or: [{ effective_to: { $exists: false } }, { effective_to: null }, { effective_to: { $gte: now } }] },
    ],
  })
    .sort({ updated_at: -1 })
    .limit(80)
    .lean();

  const queryTerms = new Set(normalized.split(' ').filter((item) => item.length >= 3));
  const scored = articles.map((article) => {
    const haystack = normalizeText(`${article.title} ${article.category} ${(article.keywords || []).join(' ')} ${article.content}`);
    let score = 0;
    queryTerms.forEach((term) => {
      if (haystack.includes(term)) score += 1;
    });
    if (['ask_payment', 'ask_qr_payment', 'ask_invoice', 'check_payment_status'].includes(intent) && article.category === 'payment') score += 3;
    if (['ask_insurance', 'insurance_eligibility_check'].includes(intent) && article.category === 'insurance') score += 3;
    if (intent === 'ask_patient_portal' && article.category === 'portal') score += 3;
    if (['ask_preparation', 'ask_required_documents'].includes(intent) && ['procedure', 'preparation', 'documents'].includes(article.category)) score += 3;
    if (intent === 'medical_safety_block' && article.category === 'medical_safety') score += 3;
    return { article, score };
  }).filter((item) => item.score > 0);

  return scored
    .sort((first, second) => second.score - first.score)
    .slice(0, env.chatbot.kbTopK)
    .map(({ article, score }) => ({
      article_id: toId(article._id),
      title: article.title,
      category: article.category,
      content: article.content,
      score,
    }));
}

function answerFromKnowledge(sources, fallbackText) {
  if (!sources.length) return fallbackText;
  const snippets = sources.slice(0, 3).map((source) => {
    const content = String(source.content || '').trim();
    const clipped = content.length > 420 ? `${content.slice(0, 420)}...` : content;
    return clipped;
  }).filter(Boolean);
  return `Dạ, em kiểm tra theo Knowledge Base hiện có: ${snippets.join('\n')}`;
}

async function buildPriceResponse(analysis, text) {
  const services = await findServicesForEntities(analysis.entities, text);
  if (!services.length) {
    return botText('Dạ, hiện em chưa có giá chính xác của dịch vụ này trong hệ thống. Em có thể chuyển anh/chị đến nhân viên tư vấn để kiểm tra giúp mình.', {
      type: 'handoff_notice',
      reason: 'price_not_found',
      queue: env.chatbot.handoffQueueBilling,
      actions: buildQuickReplies([
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên kiểm tra giá' },
        { label: 'Đặt lịch', value: 'Tôi muốn đặt lịch khám' },
      ]),
    });
  }

  const serviceIds = services.map((item) => item.service_id).filter(isValidObjectId);
  const activePrices = serviceIds.length
    ? await ServicePriceVersion.find({
      service_id: { $in: serviceIds },
      status: 'active',
      effective_from: { $lte: new Date() },
      $or: [{ effective_to: null }, { effective_to: { $exists: false } }, { effective_to: { $gte: new Date() } }],
    }).sort({ effective_from: -1 }).lean()
    : [];
  const priceMap = new Map(activePrices.map((item) => [toId(item.service_id), item]));
  const enriched = services.map((service) => {
    const price = priceMap.get(service.service_id);
    return {
      ...service,
      unit_price: price?.unit_price ?? service.unit_price,
      currency: price?.currency || service.currency || 'VND',
      price_display: formatMoney(price?.unit_price ?? service.unit_price, price?.currency || service.currency || 'VND'),
    };
  });
  const first = enriched[0];
  return botText(
    `Dạ, ${first.service_name} hiện có phí tham khảo ${first.price_display}. Chi phí có thể thay đổi nếu phát sinh dịch vụ khác sau khi bác sĩ thăm khám. Anh/chị muốn em tìm lịch phù hợp không ạ?`,
    {
      type: 'service_cards',
      services: enriched,
      quick_replies: buildQuickReplies([
        { label: 'Đặt lịch', value: `Tôi muốn đặt lịch ${first.service_name}` },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn giá' },
      ]),
    },
  );
}

async function facilityInfoResponse(analysis, text, mode = 'location') {
  const normalized = normalizeText([analysis.entities?.branch, text].filter(Boolean).join(' '));
  const filter = { is_deleted: false, public_visible: true, status: 'active' };
  const locations = await FacilityLocation.find(filter)
    .populate('department_id', 'department_name department_code')
    .sort({ name: 1 })
    .limit(20)
    .lean();
  const matched = locations.filter((location) => {
    if (!normalized) return true;
    const haystack = normalizeText(`${location.name} ${location.address || ''} ${location.phone || ''}`);
    return normalized.split(' ').some((part) => part.length >= 3 && haystack.includes(part));
  });
  const items = (matched.length ? matched : locations).slice(0, 5).map((location) => ({
    location_id: toId(location._id),
    name: location.name,
    type: location.type,
    department_name: location.department_id?.department_name,
    address: location.address,
    phone: location.phone,
    opening_hours: formatOpeningHours(location.opening_hours),
  }));

  if (!items.length) {
    return botText('Dạ, hiện hệ thống chưa có dữ liệu cơ sở public để em trả lời chắc chắn. Em có thể chuyển anh/chị đến nhân viên tư vấn để kiểm tra địa chỉ/giờ làm việc.', {
      type: 'handoff_notice',
      reason: 'facility_not_found',
      queue: env.chatbot.handoffQueueDefault,
      actions: buildQuickReplies([{ label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' }]),
    });
  }

  const lines = items.map((item) => {
    const details = [
      item.address ? `địa chỉ ${item.address}` : null,
      item.opening_hours ? `giờ làm việc ${item.opening_hours}` : null,
      item.phone ? `điện thoại ${item.phone}` : null,
    ].filter(Boolean).join(', ');
    return `${item.name}${details ? `: ${details}` : ''}`;
  });
  const prefix = mode === 'hours'
    ? 'Dạ, em kiểm tra dữ liệu giờ làm việc hiện có trong hệ thống:'
    : 'Dạ, em tìm thấy thông tin cơ sở trong hệ thống:';
  return botText(`${prefix}\n${lines.map((line) => `- ${line}`).join('\n')}`, {
    type: 'facility_info',
    facilities: items,
    quick_replies: buildQuickReplies([
      { label: 'Đặt lịch tại cơ sở này', value: `${items[0]?.name || ''} ngày mai còn lịch không?`.trim() },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
    ]),
  });
}

function casualChatResponse(text) {
  const normalized = normalizeText(text);
  if (normalized.includes('em la ai') || normalized.includes('ban la ai')) {
    return botText(`Em là ${env.chatbot.botDisplayName}, lễ tân AI hỗ trợ đặt lịch, tìm bác sĩ/chuyên khoa, hỏi giá, bảo hiểm, thanh toán và chuyển nhân viên khi cần. Em không thay bác sĩ chẩn đoán hay kê thuốc.`, welcomePayload());
  }
  if (['lo qua', 'hoi lo', 'so qua', 'buon', 'chan'].some((item) => normalized.includes(item))) {
    return botText('Em hiểu cảm giác lo lắng khi sức khỏe không ổn. Anh/chị có thể mô tả triệu chứng, thời gian xuất hiện và mức độ khó chịu; em sẽ giúp định hướng chuyên khoa và đặt lịch an toàn, còn tình huống nguy hiểm thì em sẽ ưu tiên hướng dẫn cấp cứu ngay.', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Mô tả triệu chứng', value: 'Tôi muốn mô tả triệu chứng để tìm chuyên khoa' },
        { label: 'Đặt lịch gần nhất', value: 'Tôi muốn đặt lịch khám gần nhất' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
      ]),
    });
  }
  return botText('Dạ, em vẫn ở đây để hỗ trợ anh/chị. Mình có thể hỏi tự nhiên như “mai còn lịch da liễu không”, “khám tổng quát bao nhiêu”, “có nhận BHYT không” hoặc “cho tôi gặp nhân viên”.', welcomePayload());
}

function emergencyResponse(analysis) {
  return botText(
    `Triệu chứng anh/chị mô tả có thể cần cấp cứu. Vui lòng gọi ${env.chatbot.emergencyPhone} hoặc đến cơ sở y tế gần nhất ngay.${env.chatbot.emergencyHotline ? ` Nếu cần hỗ trợ từ cơ sở của chúng tôi, anh/chị có thể gọi hotline cấp cứu: ${env.chatbot.emergencyHotline}.` : ''}`,
    {
      type: 'emergency_card',
      risk_level: 'emergency',
      red_flags: analysis.red_flags || [],
      emergency_phone: env.chatbot.emergencyPhone,
      emergency_hotline: env.chatbot.emergencyHotline,
      actions: [
        { label: `Gọi ${env.chatbot.emergencyPhone}`, href: `tel:${env.chatbot.emergencyPhone}`, intent: 'emergency_call' },
        ...(env.chatbot.emergencyHotline ? [{ label: 'Gọi hotline', href: `tel:${env.chatbot.emergencyHotline}`, intent: 'hotline_call' }] : []),
      ],
    },
  );
}

function medicalSafetyResponse() {
  return botText(
    'Em chưa thể tư vấn thuốc, liều dùng, chẩn đoán, phác đồ điều trị hoặc kết luận kết quả xét nghiệm thay bác sĩ. Em có thể giúp anh/chị chọn chuyên khoa phù hợp để đặt lịch hoặc chuyển nhân viên tư vấn.',
    {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Tìm chuyên khoa', value: 'Tôi muốn tìm chuyên khoa phù hợp' },
        { label: 'Đặt lịch khám', value: 'Tôi muốn đặt lịch khám' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
      ]),
    },
  );
}

function promptInjectionResponse() {
  return botText(
    'Em chỉ hỗ trợ tư vấn hành chính, đặt lịch và thông tin y tế an toàn trong phạm vi hệ thống. Anh/chị cần hỗ trợ đặt lịch, tìm bác sĩ hay gặp nhân viên ạ?',
    welcomePayload(),
  );
}

const CHATBOT_ACTIVE_APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS.BOOKED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.IN_CONSULTATION,
];

function patientIdFromActor(actor = {}) {
  return actor?.patientId || actor?.patient_id || actor?.patient?.id || actor?.patient?._id || null;
}

function isPatientAuth(actor = {}) {
  return actor?.actorType === 'patient' || actor?.actor_type === 'patient';
}

function sessionOwnedAppointmentId(session = {}) {
  const id = session.context?.booking?.appointment_id;
  return id && isValidObjectId(id) ? toId(id) : null;
}

function normalizeAppointmentLookupCode(value) {
  const code = normalizeString(value);
  if (!code) return null;
  return code.replace(/^APT[-\s]?/i, '').trim().toUpperCase();
}

function appointmentPublicCode(appointment = {}) {
  const id = toId(appointment._id || appointment.appointment_id);
  return id ? `APT-${id.slice(-6).toUpperCase()}` : null;
}

function appointmentStatusLabel(status) {
  const labels = {
    [APPOINTMENT_STATUS.BOOKED]: 'đã đặt, chờ xác nhận',
    [APPOINTMENT_STATUS.CONFIRMED]: 'đã xác nhận',
    [APPOINTMENT_STATUS.CHECKED_IN]: 'đã check-in',
    [APPOINTMENT_STATUS.IN_CONSULTATION]: 'đang khám',
    [APPOINTMENT_STATUS.COMPLETED]: 'đã hoàn tất',
    [APPOINTMENT_STATUS.CANCELLED]: 'đã hủy',
    [APPOINTMENT_STATUS.NO_SHOW]: 'không đến',
    [APPOINTMENT_STATUS.RESCHEDULED]: 'đã dời lịch',
  };
  return labels[status] || status || 'chưa rõ';
}

function appointmentSummary(appointment = {}) {
  return {
    appointment_code: appointmentPublicCode(appointment),
    patient_code: appointment.patient_id?.patient_code,
    patient_name: appointment.patient_id?.full_name,
    phone: appointment.patient_id?.phone ? maskPhone(appointment.patient_id.phone) : undefined,
    department_name: appointment.department_id?.department_name,
    doctor_name: appointment.doctor_id?.full_name,
    date: formatDate(appointment.appointment_time),
    time: formatTime(appointment.appointment_time),
    status: appointmentStatusLabel(appointment.status),
    note: appointment.reason,
  };
}

function loginRequiredResponse(scope = 'thông tin cá nhân') {
  return botText(
    `Dạ, để xem hoặc thao tác ${scope}, anh/chị vui lòng đăng nhập tài khoản bệnh nhân trước để bảo vệ dữ liệu cá nhân.`,
    {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Đăng nhập', href: '/login' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
      ]),
    },
  );
}

function appointmentLookupHelpResponse(actionLabel = 'kiểm tra lịch hẹn') {
  return botText(
    `Dạ, em chưa xác định được lịch hẹn cần ${actionLabel}. Anh/chị có thể đăng nhập cổng bệnh nhân hoặc gửi mã lịch hẹn dạng APT-xxxxxx để em kiểm tra trong phạm vi được phép.`,
    {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Đăng nhập', href: '/login' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
      ]),
    },
  );
}

function appointmentLookupIdentityFormResponse(actionLabel = 'kiểm tra') {
  return botText(
    `Dạ, để ${actionLabel} lịch hẹn từ database mà vẫn bảo vệ thông tin cá nhân, anh/chị vui lòng nhập họ tên và số điện thoại đã dùng khi đặt lịch. Nếu có mã lịch hẹn APT-xxxxxx thì nhập thêm để lọc chính xác hơn.`,
    {
      type: 'booking_form',
      submit_action: 'submit_appointment_lookup_identity',
      submit_label: 'Gửi thông tin kiểm tra lịch hẹn',
      submit_value: 'Tôi gửi thông tin kiểm tra lịch hẹn',
      button_label: 'Kiểm tra lịch hẹn',
      fields: [
        { name: 'patient_name', label: 'Họ tên bệnh nhân', required: true },
        { name: 'phone', label: 'Số điện thoại đã đặt lịch', required: true },
        { name: 'appointment_code', label: 'Mã lịch hẹn (nếu có)', required: false },
      ],
    },
  );
}

function appointmentListResponse(appointments = [], actionLabel = 'kiểm tra') {
  const summaries = appointments.slice(0, 6).map(appointmentSummary);
  if (summaries.length === 1) {
    return botText('Dạ, em tìm thấy lịch hẹn trong hệ thống:', {
      type: 'appointment_summary',
      summary: summaries[0],
      actions: buildQuickReplies([
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
        { label: 'Đặt lịch mới', value: 'Tôi muốn đặt lịch khám' },
      ]),
    });
  }
  return botText(
    `Dạ, em tìm thấy ${summaries.length} lịch hẹn gần nhất trong hệ thống. Anh/chị kiểm tra danh sách bên dưới nhé.`,
    {
      type: 'appointment_list',
      appointments: summaries,
      actions: buildQuickReplies([
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
        { label: 'Đặt lịch mới', value: 'Tôi muốn đặt lịch khám' },
      ]),
      action_label: actionLabel,
    },
  );
}

async function loadAppointmentForDisplay(appointmentId) {
  if (!appointmentId || !isValidObjectId(appointmentId)) return null;
  return Appointment.findOne({ _id: appointmentId, is_deleted: false })
    .populate('patient_id', 'full_name phone patient_code')
    .populate('doctor_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .lean();
}

function canAccessAppointment(session, appointment, actor = {}) {
  if (!appointment) return false;
  const ownedAppointmentId = sessionOwnedAppointmentId(session);
  if (ownedAppointmentId && String(ownedAppointmentId) === String(appointment._id)) return true;
  const patientId = patientIdFromActor(actor);
  return Boolean(patientId && String(patientId) === String(appointment.patient_id?._id || appointment.patient_id));
}

function appointmentIdentityComplete(identity = {}) {
  const phone = normalizePhone(identity.phone);
  const patientName = normalizeString(identity.patient_name || identity.patientName);
  const code = normalizeAppointmentLookupCode(identity.appointment_code || identity.appointmentCode);
  if (!env.chatbot.requirePhoneVerificationForAppointmentLookup) return Boolean(phone || patientName || code);
  return Boolean(phone && (patientName || code));
}

async function findAppointmentsByVerifiedIdentity(identity = {}, options = {}) {
  const phone = normalizePhone(identity.phone);
  const patientName = normalizeString(identity.patient_name || identity.patientName);
  const normalizedName = normalizeText(patientName);
  const code = normalizeAppointmentLookupCode(identity.appointment_code || identity.appointmentCode);
  if (!appointmentIdentityComplete({ phone, patient_name: patientName, appointment_code: code })) {
    return { identityRequired: true };
  }

  const patientFilter = { is_deleted: false };
  if (phone) {
    const phoneTail = phone.replace(/\D/g, '').slice(-9);
    patientFilter.$or = [
      { phone },
      ...(phoneTail.length >= 8 ? [{ phone: { $regex: `${escapeRegExp(phoneTail)}$` } }] : []),
    ];
  }
  const patients = await Patient.find(patientFilter).select('full_name phone patient_code').limit(10).lean();
  const matchedPatients = patients.filter((patient) => {
    if (!normalizedName) return true;
    const candidate = normalizeText(patient.full_name);
    if (!candidate) return false;
    return candidate === normalizedName
      || candidate.includes(normalizedName)
      || normalizedName.split(' ').filter((part) => part.length >= 2).every((part) => candidate.includes(part));
  });
  if (!matchedPatients.length) return { appointments: [] };

  const filter = {
    patient_id: { $in: matchedPatients.map((patient) => patient._id) },
    is_deleted: false,
  };
  if (!options.includeInactive) filter.status = { $in: CHATBOT_ACTIVE_APPOINTMENT_STATUSES };
  if (!code) filter.appointment_time = { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };

  const candidates = await Appointment.find(filter)
    .populate('patient_id', 'full_name phone patient_code')
    .populate('doctor_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .sort({ appointment_time: 1 })
    .limit(30)
    .lean();

  const appointments = code
    ? candidates.filter((appointment) => {
      const publicCode = normalizeAppointmentLookupCode(appointmentPublicCode(appointment));
      return publicCode === code || String(appointment._id).toUpperCase().endsWith(code);
    })
    : candidates;

  const now = Date.now();
  return {
    appointments: appointments
      .sort((first, second) => {
        const firstTime = new Date(first.appointment_time).getTime();
        const secondTime = new Date(second.appointment_time).getTime();
        const firstFuture = firstTime >= now ? 0 : 1;
        const secondFuture = secondTime >= now ? 0 : 1;
        if (firstFuture !== secondFuture) return firstFuture - secondFuture;
        return firstFuture === 0 ? firstTime - secondTime : secondTime - firstTime;
      })
      .slice(0, 6),
  };
}

async function findAccessibleAppointment(session, entities = {}, actor = {}, options = {}) {
  const code = normalizeAppointmentLookupCode(entities.appointment_code);
  const ownedAppointmentId = sessionOwnedAppointmentId(session);

  if (code?.startsWith('CB-')) {
    const draft = await ChatbotAppointmentDraft.findOne({ draft_code: code, is_deleted: false }).lean();
    if (draft?.appointment_id) {
      const appointment = await loadAppointmentForDisplay(draft.appointment_id);
      if (canAccessAppointment(session, appointment, actor)) return { appointment };
      return { accessRequired: true };
    }
  }

  if (ownedAppointmentId) {
    const appointment = await loadAppointmentForDisplay(ownedAppointmentId);
    if (!code || normalizeAppointmentLookupCode(appointmentPublicCode(appointment)) === code || String(appointment?._id).toUpperCase() === code) {
      return appointment ? { appointment } : { notFound: true };
    }
  }

  const patientId = patientIdFromActor(actor);
  if (env.chatbot.requireLoginForPersonalData && (!isPatientAuth(actor) || !patientId)) {
    return { accessRequired: true };
  }
  if (!patientId) return { notFound: true };

  if (code && isValidObjectId(code)) {
    const appointment = await loadAppointmentForDisplay(code);
    if (!appointment) return { notFound: true };
    return canAccessAppointment(session, appointment, actor) ? { appointment } : { accessRequired: true };
  }

  const filter = { patient_id: patientId, is_deleted: false };
  if (!options.includeInactive) filter.status = { $in: CHATBOT_ACTIVE_APPOINTMENT_STATUSES };
  if (!code) filter.appointment_time = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };

  const candidates = await Appointment.find(filter)
    .populate('patient_id', 'full_name phone patient_code')
    .populate('doctor_id', 'full_name employee_code')
    .populate('department_id', 'department_name department_code')
    .sort(code ? { appointment_time: -1 } : { appointment_time: 1 })
    .limit(30)
    .lean();
  if (!code) return candidates[0] ? { appointment: candidates[0] } : { notFound: true };

  const matched = candidates.find((appointment) => {
    const publicCode = normalizeAppointmentLookupCode(appointmentPublicCode(appointment));
    return publicCode === code || String(appointment._id).toUpperCase().endsWith(code);
  });
  return matched ? { appointment: matched } : { notFound: true };
}

async function appointmentStatusResponse(session, analysis, actor = {}) {
  const lookup = await findAccessibleAppointment(session, analysis.entities, actor, { includeInactive: true });
  if (lookup.accessRequired) {
    const lookupIdentity = {
      ...(session.context?.lookup_identity || {}),
      appointment_code: analysis.entities?.appointment_code || session.context?.lookup_identity?.appointment_code,
    };
    if (!appointmentIdentityComplete(lookupIdentity)) return appointmentLookupIdentityFormResponse('kiểm tra');
    const verified = await findAppointmentsByVerifiedIdentity(lookupIdentity, { includeInactive: true });
    if (verified.identityRequired) return appointmentLookupIdentityFormResponse('kiểm tra');
    if (!verified.appointments?.length) return appointmentLookupHelpResponse('kiểm tra');
    return appointmentListResponse(verified.appointments, 'kiểm tra');
  }
  if (!lookup.appointment) {
    const lookupIdentity = {
      ...(session.context?.lookup_identity || {}),
      appointment_code: analysis.entities?.appointment_code || session.context?.lookup_identity?.appointment_code,
    };
    if (appointmentIdentityComplete(lookupIdentity)) {
      const verified = await findAppointmentsByVerifiedIdentity(lookupIdentity, { includeInactive: true });
      if (verified.appointments?.length) return appointmentListResponse(verified.appointments, 'kiểm tra');
    }
    return appointmentLookupIdentityFormResponse('kiểm tra');
  }

  const actions = [];
  if (env.chatbot.appointmentAllowReschedule && CHATBOT_ACTIVE_APPOINTMENT_STATUSES.includes(lookup.appointment.status)) {
    actions.push({ label: 'Dời lịch', value: 'Tôi muốn dời lịch hẹn này' });
  }
  if (env.chatbot.appointmentAllowCancel && CHATBOT_ACTIVE_APPOINTMENT_STATUSES.includes(lookup.appointment.status)) {
    actions.push({ label: 'Hủy lịch', value: 'Tôi muốn hủy lịch hẹn này' });
  }
  actions.push({ label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' });

  return botText('Dạ, em tìm thấy lịch hẹn trong hệ thống:', {
    type: 'appointment_summary',
    summary: appointmentSummary(lookup.appointment),
    actions: buildQuickReplies(actions),
  });
}

async function cancelAppointmentIntentResponse(session, analysis, actor = {}) {
  if (!env.chatbot.appointmentAllowCancel) return handoffResponse(session, 'appointment');
  const lookup = await findAccessibleAppointment(session, analysis.entities, actor);
  if (lookup.accessRequired) return loginRequiredResponse('hủy lịch hẹn');
  if (!lookup.appointment) return appointmentLookupHelpResponse('hủy');
  if (!CHATBOT_ACTIVE_APPOINTMENT_STATUSES.includes(lookup.appointment.status)) {
    return botText(`Dạ, lịch hẹn này hiện ${appointmentStatusLabel(lookup.appointment.status)} nên không thể hủy qua chatbot.`, {
      type: 'appointment_summary',
      summary: appointmentSummary(lookup.appointment),
      actions: buildQuickReplies([{ label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' }]),
    });
  }

  return botText('Dạ, em có thể hủy lịch hẹn này trên hệ thống sau khi anh/chị xác nhận.', {
    type: 'appointment_summary',
    summary: appointmentSummary(lookup.appointment),
    actions: buildQuickReplies([
      {
        label: 'Xác nhận hủy lịch',
        value: 'Xác nhận hủy lịch hẹn',
        action: {
          type: 'confirm_cancel_appointment',
          appointment_id: toId(lookup.appointment._id),
          reason: 'Khách yêu cầu hủy qua chatbot',
        },
      },
      { label: 'Không hủy nữa', value: 'Không hủy lịch nữa' },
    ]),
  });
}

async function confirmCancelAppointmentAction(session, action = {}, actor = {}, meta = {}) {
  if (!env.chatbot.appointmentAllowCancel) return handoffResponse(session, 'appointment');
  const appointment = await loadAppointmentForDisplay(action.appointment_id || sessionOwnedAppointmentId(session));
  if (!appointment) return appointmentLookupHelpResponse('hủy');
  if (!canAccessAppointment(session, appointment, actor)) return loginRequiredResponse('hủy lịch hẹn');

  const result = await appointmentService.cancelAppointment(
    appointment._id,
    { reason: action.reason || 'Khách yêu cầu hủy qua chatbot' },
    chatbotSystemActor(),
    chatbotRequestMeta(session, { action: 'chatbot.appointment.cancel', ip: getMetaIp(meta) }),
  );
  session.context = {
    ...(session.context || {}),
    booking: {
      ...(session.context?.booking || {}),
      appointment_status: APPOINTMENT_STATUS.CANCELLED,
      cancelled_at: new Date().toISOString(),
    },
  };
  session.current_step = 'appointment_cancelled';
  await session.save();
  return botText('Dạ, em đã hủy lịch hẹn thật trong hệ thống. Nếu cần đặt lịch mới, em có thể tìm khung giờ phù hợp cho anh/chị.', {
    type: 'appointment_summary',
    summary: appointmentSummary(result.appointment || appointment),
    actions: buildQuickReplies([
      { label: 'Đặt lịch mới', value: 'Tôi muốn đặt lịch khám' },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
    ]),
  });
}

async function rescheduleAppointmentIntentResponse(session, analysis, text, actor = {}) {
  if (!env.chatbot.appointmentAllowReschedule) return handoffResponse(session, 'appointment');
  const lookup = await findAccessibleAppointment(session, analysis.entities, actor);
  if (lookup.accessRequired) return loginRequiredResponse('dời lịch hẹn');
  if (!lookup.appointment) return appointmentLookupHelpResponse('dời');
  if (!CHATBOT_ACTIVE_APPOINTMENT_STATUSES.includes(lookup.appointment.status)) {
    return botText(`Dạ, lịch hẹn này hiện ${appointmentStatusLabel(lookup.appointment.status)} nên không thể dời qua chatbot.`, {
      type: 'appointment_summary',
      summary: appointmentSummary(lookup.appointment),
      actions: buildQuickReplies([{ label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' }]),
    });
  }
  if (!analysis.entities.date_iso) {
    return botText('Dạ, anh/chị muốn dời lịch sang ngày nào ạ?', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Ngày mai', value: 'Tôi muốn dời lịch sang ngày mai' },
        { label: 'Ngày kia', value: 'Tôi muốn dời lịch sang ngày kia' },
        { label: 'Cuối tuần', value: 'Tôi muốn dời lịch sang cuối tuần' },
      ]),
    });
  }

  const rescheduleBooking = mergeEntities(session.context?.booking || {}, analysis.entities, {
    department_id: toId(lookup.appointment.department_id?._id || lookup.appointment.department_id),
    department: lookup.appointment.department_id?.department_name,
    doctor_id: toId(lookup.appointment.doctor_id?._id || lookup.appointment.doctor_id),
    doctor: lookup.appointment.doctor_id?.full_name,
    reschedule_appointment_id: toId(lookup.appointment._id),
  });
  session.context = {
    ...(session.context || {}),
    booking: rescheduleBooking,
  };

  const slots = (await findAvailableSlots(rescheduleBooking, session)).map((slot) => ({
    ...slot,
    action_type: 'select_reschedule_slot',
    appointment_id: toId(lookup.appointment._id),
  }));
  if (!slots.length) {
    return botText('Dạ, em chưa thấy khung giờ mới phù hợp. Anh/chị muốn thử ngày khác hoặc gặp nhân viên hỗ trợ dời lịch không ạ?', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Ngày khác', value: 'Tôi muốn dời lịch sang ngày khác' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
      ]),
    });
  }

  return botText('Dạ, em tìm thấy các khung giờ mới phù hợp. Anh/chị chọn một khung giờ để em dời lịch thật trên hệ thống sau bước xác nhận.', {
    type: 'slot_picker',
    slots,
    quick_replies: slots.slice(0, 3).map((slot) => ({
      label: `${slot.time} - ${slot.doctor_name}`,
      value: `Tôi chọn dời lịch sang ${slot.time} ${slot.date}`,
      action: { type: 'select_reschedule_slot', slot, appointment_id: toId(lookup.appointment._id) },
    })),
  });
}

function rescheduleSummaryResponse(session) {
  const booking = session.context?.booking || {};
  const slot = booking.reschedule_slot || {};
  return botText('Em xin xác nhận khung giờ mới trước khi dời lịch trong hệ thống.', {
    type: 'appointment_summary',
    summary: {
      appointment_code: booking.reschedule_appointment_id ? `APT-${String(booking.reschedule_appointment_id).slice(-6).toUpperCase()}` : undefined,
      department_name: slot.department_name || booking.department,
      doctor_name: slot.doctor_name || booking.doctor,
      date: slot.date,
      time: slot.time,
      status: 'chờ xác nhận dời lịch',
    },
    actions: buildQuickReplies([
      { label: 'Xác nhận dời lịch', value: 'Xác nhận dời lịch', action: { type: 'confirm_reschedule_appointment' } },
      { label: 'Chọn giờ khác', value: `${booking.department || 'Chuyên khoa'} ${booking.date_iso || 'ngày mai'} còn lịch không?` },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
    ]),
  });
}

async function confirmRescheduleAppointmentAction(session, actor = {}, meta = {}) {
  if (!env.chatbot.appointmentAllowReschedule) return handoffResponse(session, 'appointment');
  const booking = session.context?.booking || {};
  const slot = booking.reschedule_slot || {};
  const appointment = await loadAppointmentForDisplay(booking.reschedule_appointment_id);
  if (!appointment || !slot.appointment_time) return appointmentLookupHelpResponse('dời');
  if (!canAccessAppointment(session, appointment, actor)) return loginRequiredResponse('dời lịch hẹn');

  let result;
  try {
    result = await appointmentService.rescheduleAppointment(
      appointment._id,
      {
        doctor_id: slot.doctor_id,
        department_id: slot.department_id,
        doctor_schedule_id: slot.doctor_schedule_id,
        schedule_slot_id: slot.schedule_slot_id,
        appointment_time: slot.appointment_time,
        reason: 'Khách yêu cầu dời lịch qua chatbot',
      },
      chatbotSystemActor(),
      chatbotRequestMeta(session, { action: 'chatbot.appointment.reschedule', ip: getMetaIp(meta) }),
    );
  } catch (error) {
    if ([409, 422].includes(Number(error.statusCode || error.status))) {
      return botText(`${error.message || 'Khung giờ mới không còn khả dụng.'} Em có thể tìm khung giờ khác cho anh/chị.`, {
        type: 'quick_replies',
        quick_replies: buildQuickReplies([
          { label: 'Tìm giờ khác', value: `${booking.department || 'Chuyên khoa'} ${booking.date_iso || 'ngày mai'} còn lịch không?` },
          { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
        ]),
      });
    }
    throw error;
  }

  session.context = {
    ...(session.context || {}),
    booking: {
      ...booking,
      appointment_id: result.appointment?.appointment_id || result.appointment?._id,
      appointment_status: result.appointment?.status,
      rescheduled_at: new Date().toISOString(),
    },
  };
  session.current_step = 'appointment_rescheduled';
  await session.save();
  return botText('Dạ, em đã dời lịch hẹn thật trong hệ thống. Anh/chị vui lòng kiểm tra lại thời gian mới bên dưới.', {
    type: 'appointment_confirmed',
    summary: {
      appointment_code: result.appointment?.appointment_id ? `APT-${String(result.appointment.appointment_id).slice(-6).toUpperCase()}` : undefined,
      department_name: result.appointment?.department_name || slot.department_name,
      doctor_name: result.appointment?.doctor_name || slot.doctor_name,
      date: formatDate(result.appointment?.appointment_time || slot.appointment_time),
      time: formatTime(result.appointment?.appointment_time || slot.appointment_time),
      status: appointmentStatusLabel(result.appointment?.status),
    },
    actions: buildQuickReplies([
      { label: 'Xem hướng dẫn đi khám', value: 'Tôi cần mang giấy tờ gì khi đi khám?' },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
    ]),
  });
}

async function paymentStatusResponse(session, analysis, actor = {}) {
  const patientId = patientIdFromActor(actor);
  if (env.chatbot.requireLoginForPersonalData && (!isPatientAuth(actor) || !patientId)) {
    return loginRequiredResponse('hóa đơn và thanh toán');
  }
  if (!patientId) return loginRequiredResponse('hóa đơn và thanh toán');

  const invoiceFilter = { patient_id: patientId };
  if (analysis.entities.invoice_code) {
    invoiceFilter.invoice_no = { $regex: escapeRegex(analysis.entities.invoice_code), $options: 'i' };
  }
  const invoices = await Invoice.find(invoiceFilter).sort({ issued_at: -1, created_at: -1 }).limit(3).lean();
  const invoiceIds = invoices.map((item) => item._id);
  const intents = await PaymentIntent.find({
    patient_id: patientId,
    ...(invoiceIds.length ? { invoice_id: { $in: invoiceIds } } : {}),
  }).sort({ created_at: -1 }).limit(3).lean();

  if (!invoices.length && !intents.length) {
    return botText('Dạ, em chưa thấy hóa đơn hoặc phiên thanh toán gần đây trong tài khoản của anh/chị.', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Mở hóa đơn', href: '/portal/dashboard?section=billing' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên thanh toán' },
      ]),
    });
  }

  const invoiceLines = invoices.map((invoice) => {
    const due = formatMoney(invoice.balance_due, invoice.currency);
    return `- Hóa đơn ${invoice.invoice_no}: trạng thái ${invoice.status}, còn phải thu ${due}`;
  });
  const intentLines = intents.map((intent) => {
    const amount = formatMoney(intent.amount, intent.currency);
    return `- Thanh toán ${intent.intent_code}: ${intent.status}, số tiền ${amount}${intent.confirmed_at ? `, xác nhận lúc ${formatTime(intent.confirmed_at)} ${formatDate(intent.confirmed_at)}` : ''}`;
  });
  return botText(`Dạ, em kiểm tra dữ liệu thanh toán trong hệ thống:\n${[...invoiceLines, ...intentLines].join('\n')}`, {
    type: 'payment_status',
    invoices,
    payment_intents: intents,
    quick_replies: buildQuickReplies([
      { label: 'Mở hóa đơn', href: '/portal/dashboard?section=billing' },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên thanh toán' },
    ]),
  });
}

async function resultStatusResponse(session, analysis, actor = {}) {
  const patientId = patientIdFromActor(actor);
  if (env.chatbot.requireLoginForPersonalData && (!isPatientAuth(actor) || !patientId)) {
    return loginRequiredResponse('trạng thái kết quả');
  }
  if (!patientId) return loginRequiredResponse('trạng thái kết quả');

  const resultCode = analysis.entities.result_code;
  const labFilter = { patient_id: patientId, is_current: true };
  const imagingFilter = { patient_id: patientId, is_current: true };
  if (resultCode) {
    labFilter.result_no = { $regex: escapeRegex(resultCode), $options: 'i' };
    imagingFilter.report_no = { $regex: escapeRegex(resultCode), $options: 'i' };
  }
  const [labResults, imagingReports] = await Promise.all([
    LabResult.find(labFilter).sort({ reported_at: -1, created_at: -1 }).limit(3).lean(),
    ImagingReport.find(imagingFilter).sort({ reported_at: -1, created_at: -1 }).limit(3).lean(),
  ]);

  if (!labResults.length && !imagingReports.length) {
    return botText('Dạ, em chưa thấy kết quả xét nghiệm/chẩn đoán hình ảnh phù hợp trong tài khoản của anh/chị. Em không thể tự kết luận kết quả; nếu cần kiểm tra chi tiết, em sẽ chuyển nhân viên hỗ trợ.', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Mở kết quả', href: '/portal/dashboard?section=lab-results' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn kết quả' },
      ]),
    });
  }

  const lines = [
    ...labResults.map((item) => `- Xét nghiệm ${item.result_no}: ${item.status}, ${item.released_to_patient ? 'đã phát hành cho bệnh nhân' : 'chưa phát hành cho bệnh nhân'}`),
    ...imagingReports.map((item) => `- CĐHA ${item.report_no}: ${item.status}, ${item.released_to_patient ? 'đã phát hành cho bệnh nhân' : 'chưa phát hành cho bệnh nhân'}`),
  ];
  return botText(`Dạ, em chỉ kiểm tra trạng thái phát hành, không diễn giải nội dung kết quả:\n${lines.join('\n')}`, {
    type: 'result_status',
    lab_results: labResults,
    imaging_reports: imagingReports,
    quick_replies: buildQuickReplies([
      { label: 'Mở kết quả', href: '/portal/dashboard?section=lab-results' },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn kết quả' },
    ]),
  });
}

function uploadDocumentResponse() {
  return botText('Dạ, anh/chị có thể upload CCCD, thẻ BHYT, giấy chuyển tuyến hoặc hồ sơ khám cũ trong cổng bệnh nhân. Nếu gửi ảnh giấy tờ qua chat, nội dung cần nhân viên kiểm tra để đảm bảo chính xác; em không tự kết luận từ ảnh y tế.', {
    type: 'quick_replies',
    quick_replies: buildQuickReplies([
      { label: 'Mở hồ sơ', href: '/portal/dashboard?section=documents' },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên kiểm tra giấy tờ' },
    ]),
  });
}

async function createCallbackTicket(session, lead = {}, reason = 'callback_request') {
  const patient = await ensurePatientForIdentity(session, {
    patient_name: lead.patient_name,
    phone: lead.phone,
    email: lead.email,
  });
  const description = [
    reason === 'feedback' ? 'Khách gửi phản hồi từ chatbot.' : 'Khách yêu cầu nhân viên liên hệ từ chatbot.',
    lead.concern ? `Nhu cầu: ${lead.concern}` : null,
    lead.insurance_type ? `Loại bảo hiểm: ${lead.insurance_type}` : null,
    session.source_page ? `Trang nguồn: ${session.source_page}` : null,
    `Kênh: ${session.channel || 'website'}`,
  ].filter(Boolean).join('\n');
  const ticket = await supportTicketService.createTicket({
    patient_id: patient._id,
    category: supportCategoryForHandoff(reason),
    priority: supportPriorityForHandoff(session, reason),
    subject: supportSubjectForHandoff(reason),
    description,
    metadata: {
      source: 'chatbot',
      chatbot_session_id: toId(session._id),
      lead_source: session.source_page,
      lead_priority: session.context?.insights?.lead_priority || (lead.phone ? 'high' : 'medium'),
      handoff_reason: reason,
      lead,
      conversation_insights: session.context?.insights || {},
    },
  }, chatbotSystemActor(), chatbotRequestMeta(session, { action: 'chatbot.callback.create_ticket' }));

  const context = session.context || {};
  session.context = {
    ...context,
    lead: {
      ...(context.lead || {}),
      ...lead,
      patient_id: toId(patient._id),
      support_ticket_id: toId(ticket._id || ticket.id || ticket.ticket_id),
      support_ticket_code: ticket.ticket_code,
      status: 'callback_ticket_created',
    },
  };
  session.current_step = 'callback_ticket_created';
  await session.save();
  return ticket;
}

function leadResponseIntro(reason = 'callback_request') {
  if (reason === 'family_booking') return 'Dạ, em có thể tạo yêu cầu đặt lịch cho người thân để nhân viên hỗ trợ đúng thông tin.';
  if (reason === 'corporate_health_check') return 'Dạ, em có thể tạo lead khám sức khỏe doanh nghiệp để bộ phận phụ trách liên hệ lại.';
  if (reason === 'lead_capture') return 'Dạ, em có thể lưu yêu cầu tư vấn thật trong hệ thống để nhân viên liên hệ lại.';
  if (reason === 'feedback') return 'Dạ, em có thể ghi nhận phản hồi này thành ticket để bộ phận phụ trách xem lại.';
  return 'Dạ, em có thể tạo yêu cầu gọi lại thật cho nhân viên.';
}

async function callbackRequestResponse(session, analysis, text, reason = 'callback_request') {
  if (!env.chatbot.leadCaptureEnabled) return handoffResponse(session, reason);
  const context = session.context || {};
  const lead = {
    ...(context.lead || {}),
    patient_name: analysis.entities.patient_name || context.lead?.patient_name,
    phone: analysis.entities.phone || context.lead?.phone,
    email: analysis.entities.email || context.lead?.email,
    insurance_type: analysis.entities.insurance_type || context.lead?.insurance_type,
    concern: normalizeString(text) || context.lead?.concern,
  };
  session.context = { ...context, lead };

  if (!lead.patient_name || !lead.phone) {
    session.current_step = reason === 'feedback' ? 'collect_feedback' : 'collect_callback';
    await session.save();
    return botText(`${leadResponseIntro(reason)} Anh/chị cho em xin họ tên và số điện thoại nhé.`, {
      type: 'callback_form',
      submit_action: reason === 'feedback' ? 'submit_feedback_request' : 'submit_lead_request',
      submit_label: reason === 'feedback' ? 'Gửi phản hồi' : 'Gửi yêu cầu tư vấn',
      submit_value: reason === 'feedback' ? 'Tôi gửi phản hồi' : 'Tôi gửi yêu cầu tư vấn',
      button_label: reason === 'feedback' ? 'Gửi phản hồi' : 'Gửi yêu cầu',
      fields: [
        { name: 'patient_name', label: 'Họ tên', required: true },
        { name: 'phone', label: 'Số điện thoại', required: true },
        { name: 'concern', label: reason === 'feedback' ? 'Nội dung phản hồi' : 'Nhu cầu cần tư vấn', required: false, multiline: true },
      ],
    });
  }

  const ticket = await createCallbackTicket(session, lead, reason);
  const doneText = reason === 'feedback'
    ? `Dạ, em đã ghi nhận phản hồi trong hệ thống${ticket.ticket_code ? `, mã ticket ${ticket.ticket_code}` : ''}. Cảm ơn anh/chị đã gửi thông tin để cơ sở cải thiện dịch vụ.`
    : `Dạ, em đã tạo yêu cầu trong hệ thống${ticket.ticket_code ? `, mã ticket ${ticket.ticket_code}` : ''}. Nhân viên tư vấn sẽ kiểm tra và liên hệ lại theo số ${maskPhone(lead.phone)}.`;
  return botText(doneText, {
    type: 'handoff_notice',
    queue: env.chatbot.handoffQueueDefault,
    reason,
    support_ticket: {
      support_ticket_id: toId(ticket._id || ticket.id || ticket.ticket_id),
      support_ticket_code: ticket.ticket_code,
    },
    quick_replies: buildQuickReplies([
      { label: 'Đặt lịch ngay', value: 'Tôi muốn đặt lịch khám' },
      { label: 'Hỏi thêm', value: 'Tôi cần hỏi thêm thông tin' },
    ]),
  });
}

async function abandonedBookingRecoveryResponse(session, text) {
  const context = session.context || {};
  const previous = context.previous_booking || {};
  if (!previous.department && !previous.doctor && !previous.date_iso && !previous.selected_slot) {
    return botText('Dạ, em chưa tìm thấy phiên đặt lịch dang dở gần đây. Mình có thể bắt đầu đặt lịch mới ngay bây giờ ạ.', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Đặt lịch mới', value: 'Tôi muốn đặt lịch khám' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
      ]),
    });
  }

  session.context = {
    ...context,
    booking: {
      ...(context.booking || {}),
      ...previous,
    },
  };
  session.current_intent = 'book_appointment';
  session.current_step = previous.selected_slot ? 'collect_identity' : 'recover_booking';
  await session.save();

  if (previous.selected_slot) {
    return bookingFormResponse(previous.selected_slot);
  }
  return slotPickerResponse({ entities: previous }, session, text || 'tiếp tục đặt lịch');
}

function returningPatientResponse(actor = {}) {
  if (env.chatbot.requireLoginForPersonalData && !isPatientAuth(actor)) {
    return botText('Dạ, nếu anh/chị đã từng khám tại hệ thống, mình đăng nhập tài khoản bệnh nhân để em kiểm tra lịch hẹn, hóa đơn, kết quả hoặc hỗ trợ tái khám chính xác hơn nhé.', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Đăng nhập', href: '/login' },
        { label: 'Đặt lịch tái khám', value: 'Tôi muốn đặt lịch tái khám' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
      ]),
    });
  }
  return botText('Dạ, em có thể hỗ trợ anh/chị kiểm tra lịch hẹn hiện có, đặt lịch tái khám hoặc xem hướng dẫn hồ sơ sau khi đăng nhập.', {
    type: 'quick_replies',
    quick_replies: buildQuickReplies([
      { label: 'Xem lịch hẹn', value: 'Kiểm tra lịch hẹn của tôi' },
      { label: 'Đặt lịch tái khám', value: 'Tôi muốn đặt lịch tái khám' },
      { label: 'Xem kết quả', value: 'Kết quả của tôi có chưa?' },
    ]),
  });
}

function handoffReasonFromText(text = '', session = {}) {
  const normalized = normalizeText([text, session.current_intent].filter(Boolean).join(' '));
  if (/(cap cuu|emergency)/.test(normalized)) return 'emergency';
  if (/(dat lich|lich kham|doi lich|huy lich|appointment)/.test(normalized)) return 'appointment';
  if (/(thanh toan|hoa don|qr|chuyen khoan|gia|phi|billing|payment)/.test(normalized)) return 'billing';
  if (/(bao hiem|bhyt|insurance)/.test(normalized)) return 'insurance';
  if (/(khieu nai|phan anh|khong hai long)/.test(normalized)) return 'complaint';
  if (/(feedback|gop y|danh gia|hai long)/.test(normalized)) return 'feedback';
  if (/(cong ty|doanh nghiep|corporate)/.test(normalized)) return 'corporate_health_check';
  return 'user_request';
}

async function departmentSuggestionResponse(analysis, text) {
  const departments = await findDepartmentsForEntities(analysis.entities, text);
  const cards = departments.slice(0, 6).map((department) => ({
    department_id: toId(department._id),
    department_name: department.department_name,
    department_code: department.department_code,
    description: department.location_note || 'Có thể đặt lịch theo ngày giờ mong muốn.',
  }));
  if (!cards.length) {
    return botText('Dạ, em chưa tìm được chuyên khoa phù hợp trong hệ thống. Anh/chị có thể mô tả triệu chứng rõ hơn hoặc gặp nhân viên tư vấn.', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([{ label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' }]),
    });
  }
  return botText(
    'Dạ, em có thể giúp anh/chị định hướng chuyên khoa để đặt lịch, nhưng không thay thế bác sĩ chẩn đoán. Anh/chị có thể chọn một chuyên khoa bên dưới hoặc mô tả thêm triệu chứng.',
    {
      type: 'department_cards',
      departments: cards,
      quick_replies: cards.slice(0, 3).map((item) => ({
        label: `Đặt lịch ${item.department_name}`,
        value: `Tôi muốn đặt lịch ${item.department_name}`,
      })),
    },
  );
}

async function doctorSearchResponse(analysis, text) {
  const doctors = await findDoctorsForEntities(analysis.entities, text);
  if (!doctors.length) {
    return botText('Dạ, hiện em chưa tìm thấy bác sĩ phù hợp theo thông tin này. Anh/chị muốn em tìm theo chuyên khoa hoặc chuyển nhân viên tư vấn không ạ?', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Tìm chuyên khoa', value: 'Tìm chuyên khoa phù hợp' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên' },
      ]),
    });
  }
  return botText('Dạ, em tìm thấy một số bác sĩ phù hợp. Lịch trống chính xác sẽ lấy từ hệ thống khi anh/chị chọn bác sĩ/ngày khám.', {
    type: 'doctor_cards',
    doctors,
    quick_replies: doctors.slice(0, 3).map((doctor) => ({
      label: `Đặt với ${doctor.doctor_name}`,
      value: `Tôi muốn đặt lịch với ${doctor.doctor_name}`,
    })),
  });
}

async function serviceSearchResponse(analysis, text) {
  const services = await findServicesForEntities(analysis.entities, text);
  if (!services.length) {
    return botText('Dạ, em chưa tìm thấy dịch vụ phù hợp trong danh mục. Anh/chị có thể nhập tên dịch vụ cụ thể hơn hoặc gặp nhân viên tư vấn.', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([{ label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn dịch vụ' }]),
    });
  }
  return botText('Dạ, em tìm thấy các dịch vụ liên quan trong hệ thống.', {
    type: 'service_cards',
    services,
    quick_replies: services.slice(0, 3).map((service) => ({
      label: `Hỏi giá ${service.service_name}`,
      value: `${service.service_name} bao nhiêu tiền?`,
    })),
  });
}

async function slotPickerResponse(analysis, session, text) {
  const mergedBooking = mergeEntities(session.context?.booking || {}, analysis.entities);
  const hasRequestedDateOrTime = Boolean(
    mergedBooking.date_iso
    || mergedBooking.time_text
    || mergedBooking.time_preference
    || analysis.entities?.date_iso
    || analysis.entities?.time_text
    || analysis.entities?.time_preference,
  );
  if (!hasRequestedDateOrTime && !mergedBooking.department_id && !mergedBooking.department && !mergedBooking.doctor_id && !mergedBooking.doctor) {
    return departmentSuggestionResponse(analysis, text);
  }
  if (!mergedBooking.date_iso) {
    return botText('Dạ, anh/chị muốn khám ngày nào ạ?', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Hôm nay', value: `${mergedBooking.department || ''} hôm nay còn lịch không?`.trim() },
        { label: 'Ngày mai', value: `${mergedBooking.department || ''} ngày mai còn lịch không?`.trim() },
        { label: 'Cuối tuần', value: `${mergedBooking.department || ''} cuối tuần còn lịch không?`.trim() },
      ]),
    });
  }

  const slots = await findAvailableSlots(mergedBooking, session);
  if (!slots.length) {
    return botText('Dạ, hiện em chưa thấy lịch trống phù hợp với lựa chọn này. Anh/chị muốn đổi ngày/khung giờ hoặc gặp nhân viên tư vấn không ạ?', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'Đổi ngày', value: `${mergedBooking.department || 'Chuyên khoa'} ngày mai còn lịch không?` },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
      ]),
    });
  }

  return botText(
    `Dạ, ${mergedBooking.date_iso ? `ngày ${formatDate(`${mergedBooking.date_iso}T00:00:00`)}` : 'thời gian anh/chị chọn'} còn các khung giờ trống sau từ lịch làm việc bác sĩ trong database. Anh/chị có thể thấy bác sĩ, chuyên khoa và chọn trực tiếp để đặt lịch.`,
    {
      type: 'slot_picker',
      slots,
      quick_replies: slots.slice(0, 3).map((slot) => ({
        label: `${slot.time} - ${slot.doctor_name}`,
        value: `Tôi chọn ${slot.time} ${slot.doctor_name}`,
        action: { type: 'select_slot', slot },
      })),
    },
  );
}

function bookingFormResponse(slot) {
  const holdNote = slot.hold_expires_at
    ? ` Em đang giữ tạm slot này trong ${slot.hold_ttl_minutes || env.chatbot.appointmentSlotHoldTtlMinutes} phút để tránh người khác đặt trùng.`
    : '';
  return botText(
    `Dạ, em đã chọn khung ${slot.time} ngày ${slot.date} với ${slot.doctor_name}.${holdNote} Anh/chị cho em xin họ tên và số điện thoại để lập lịch hẹn thật trong hệ thống ạ.`,
    {
      type: 'booking_form',
      submit_label: 'Gửi thông tin đặt lịch',
      submit_value: 'Tôi gửi thông tin đặt lịch',
      button_label: 'Gửi để xác nhận',
      selected_slot: slot,
      fields: [
        { name: 'patient_name', label: 'Họ tên bệnh nhân', required: env.chatbot.appointmentRequirePatientName },
        { name: 'phone', label: 'Số điện thoại', required: env.chatbot.appointmentRequirePhone },
        { name: 'note', label: 'Ghi chú triệu chứng / nhu cầu', required: false },
      ],
    },
  );
}

function appointmentSummaryResponse(session) {
  const booking = session.context?.booking || {};
  const slot = booking.selected_slot || {};
  return botText(
    'Em xin xác nhận lại thông tin đặt lịch. Anh/chị kiểm tra và bấm xác nhận nếu thông tin đã đúng.',
    {
      type: 'appointment_summary',
      summary: {
        patient_name: booking.patient_name,
        phone: booking.phone ? maskPhone(booking.phone) : '',
        department_name: slot.department_name || booking.department,
        doctor_name: slot.doctor_name || booking.doctor,
        date: slot.date || formatDate(booking.date_iso),
        time: slot.time,
        fee_display: slot.fee_display,
        note: booking.symptoms_note || booking.note,
      },
      actions: buildQuickReplies([
        { label: 'Xác nhận đặt lịch', value: 'Xác nhận đặt lịch', action: { type: 'confirm_booking' } },
        { label: 'Đổi giờ', value: `${slot.department_name || booking.department || 'Chuyên khoa'} ${booking.date_iso || 'ngày mai'} còn lịch không?` },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
      ]),
    },
  );
}

async function holdSelectedSlotForSession(session, slot = {}) {
  if (!env.chatbot.appointmentSlotHoldEnabled) return slot;
  if (!slot.doctor_schedule_id || !slot.appointment_time) {
    throw createError('Thiếu thông tin slot để giữ lịch.', 422);
  }

  const schedule = await DoctorSchedule.findOne({
    _id: slot.doctor_schedule_id,
    is_deleted: false,
    status: { $in: ['published', 'active'] },
    patient_portal_enabled: true,
    staff_only: { $ne: true },
  }).lean();
  if (!schedule) throw createError('Lịch này không còn mở để đặt khám.', 409);

  const holdOwner = chatbotHoldOwner(session);
  const now = new Date();
  const slotTime = new Date(slot.appointment_time);
  const slotEnd = slot.slot_end ? new Date(slot.slot_end) : addMinutes(slotTime, 15);
  const existingSlot = await ScheduleSlot.findOne({
    doctor_schedule_id: schedule._id,
    start_time: slotTime,
    is_deleted: false,
  });

  const ownActiveHold = existingSlot
    && existingSlot.status === SCHEDULE_SLOT_STATUS.HELD
    && existingSlot.block_reason === holdOwner
    && existingSlot.hold_expires_at
    && new Date(existingSlot.hold_expires_at) > now;
  const heldByOther = existingSlot
    && existingSlot.status === SCHEDULE_SLOT_STATUS.HELD
    && !ownActiveHold
    && existingSlot.hold_expires_at
    && new Date(existingSlot.hold_expires_at) > now;
  const unavailable = existingSlot
    && (
      heldByOther
      || existingSlot.appointment_id
      || existingSlot.booked_count >= existingSlot.capacity
      || [SCHEDULE_SLOT_STATUS.BOOKED, SCHEDULE_SLOT_STATUS.BLOCKED, SCHEDULE_SLOT_STATUS.CANCELLED, SCHEDULE_SLOT_STATUS.COMPLETED, SCHEDULE_SLOT_STATUS.NO_SHOW].includes(existingSlot.status)
    );
  if (unavailable) {
    throw createError('Khung giờ này vừa được giữ hoặc đặt bởi người khác. Anh/chị vui lòng chọn khung giờ khác.', 409);
  }

  if (!ownActiveHold) {
    const available = await scheduleService.getAvailableSlots(schedule._id, { publicView: true, onlyAvailable: true });
    const stillAvailable = (available.items || []).some((item) => new Date(item.slot_time).getTime() === slotTime.getTime());
    if (!stillAvailable) {
      throw createError('Khung giờ này không còn khả dụng. Anh/chị vui lòng chọn khung giờ khác.', 409);
    }
  }

  const holdExpiresAt = addMinutes(now, env.chatbot.appointmentSlotHoldTtlMinutes);
  const heldSlot = existingSlot || await ScheduleSlot.findOneAndUpdate(
    {
      doctor_schedule_id: schedule._id,
      start_time: slotTime,
      is_deleted: false,
    },
    {
      $setOnInsert: {
        doctor_schedule_id: schedule._id,
        created_by: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  heldSlot.doctor_id = slot.doctor_id || schedule.doctor_id;
  heldSlot.department_id = slot.department_id || schedule.department_id;
  heldSlot.start_time = slotTime;
  heldSlot.end_time = slotEnd;
  heldSlot.capacity = 1;
  heldSlot.booked_count = 0;
  heldSlot.status = SCHEDULE_SLOT_STATUS.HELD;
  heldSlot.hold_expires_at = holdExpiresAt;
  heldSlot.block_reason = holdOwner;
  heldSlot.appointment_id = undefined;
  heldSlot.patient_id = undefined;
  await heldSlot.save();

  return {
    ...slot,
    schedule_slot_id: toId(heldSlot._id),
    hold_expires_at: holdExpiresAt.toISOString(),
    hold_ttl_minutes: env.chatbot.appointmentSlotHoldTtlMinutes,
  };
}

async function ensurePatientForBooking(session, booking = {}) {
  if (session.patient_id && isValidObjectId(session.patient_id)) {
    const patient = await Patient.findOne({ _id: session.patient_id, is_deleted: false, status: 'active' });
    if (patient) return patient;
  }

  const phone = normalizePhone(booking.phone);
  const patientName = normalizeString(booking.patient_name);
  if (!patientName || !phone) throw createError('Thiếu họ tên hoặc số điện thoại để tạo hồ sơ bệnh nhân.', 422);

  const existing = await Patient.findOne({
    is_deleted: false,
    status: 'active',
    phone,
  }).sort({ updated_at: -1, created_at: -1 });
  if (existing) {
    if (!session.patient_id) {
      session.patient_id = existing._id;
      await session.save();
    }
    return existing;
  }

  const detail = await patientService.createPatient({
    full_name: patientName,
    phone,
    email: normalizeString(booking.email),
    status: 'active',
    source: 'chatbot',
    confirm_duplicate_checked: true,
  }, chatbotSystemActor(), chatbotRequestMeta(session, { action: 'chatbot.patient.create' }));
  const patientId = detail.patient_id || detail.patient?.patient_id || detail.patient?._id;
  const patient = patientId
    ? await Patient.findById(patientId)
    : await Patient.findOne({ is_deleted: false, phone }).sort({ created_at: -1 });
  if (!patient) throw createError('Không thể tạo hồ sơ bệnh nhân từ chatbot.', 409);
  session.patient_id = patient._id;
  await session.save();
  return patient;
}

async function ensurePatientForIdentity(session, identity = {}) {
  const phone = normalizePhone(identity.phone);
  const patientName = normalizeString(identity.patient_name || identity.patientName);
  if (!patientName || !phone) throw createError('Thiếu họ tên hoặc số điện thoại để tạo hồ sơ bệnh nhân.', 422);

  const existing = await Patient.findOne({
    is_deleted: false,
    status: 'active',
    phone,
  }).sort({ updated_at: -1, created_at: -1 });
  if (existing) {
    session.patient_id = existing._id;
    await session.save();
    return existing;
  }

  const detail = await patientService.createPatient({
    full_name: patientName,
    phone,
    email: normalizeString(identity.email),
    status: 'active',
    source: 'chatbot',
    confirm_duplicate_checked: true,
  }, chatbotSystemActor(), chatbotRequestMeta(session, { action: 'chatbot.patient.create_from_identity' }));
  const patientId = detail.patient_id || detail.patient?.patient_id || detail.patient?._id;
  const patient = patientId
    ? await Patient.findById(patientId)
    : await Patient.findOne({ is_deleted: false, phone }).sort({ created_at: -1 });
  if (!patient) throw createError('Không thể tạo hồ sơ bệnh nhân từ chatbot.', 409);
  session.patient_id = patient._id;
  await session.save();
  return patient;
}

async function createRealAppointmentFromSession(session) {
  const booking = session.context?.booking || {};
  const slot = booking.selected_slot || {};
  if (!slot.appointment_time || !booking.patient_name || !booking.phone) {
    throw createError('Thiếu thông tin để tạo phiếu đặt lịch.', 422);
  }

  if (booking.appointment_id && isValidObjectId(booking.appointment_id)) {
    const existingAppointment = await Appointment.findOne({ _id: booking.appointment_id, is_deleted: false }).lean();
    if (existingAppointment) {
      const detail = await appointmentService.getAppointmentDetail(existingAppointment._id, chatbotSystemActor());
      return {
        draft: booking.appointment_draft_id
          ? await ChatbotAppointmentDraft.findById(booking.appointment_draft_id)
          : null,
        appointment: detail.appointment,
        reused: true,
      };
    }
  }

  const patient = await ensurePatientForBooking(session, booking);
  const appointmentResult = await appointmentService.createAppointment({
    patient_id: patient._id,
    doctor_id: slot.doctor_id,
    department_id: slot.department_id,
    doctor_schedule_id: slot.doctor_schedule_id,
    schedule_slot_id: slot.schedule_slot_id,
    appointment_time: slot.appointment_time,
    appointment_type: 'outpatient',
    reason: booking.symptoms_note || booking.note || 'Đặt lịch từ chatbot',
    notes: `Chatbot session ${toId(session._id)}${booking.symptoms_note ? ` - ${booking.symptoms_note}` : ''}`,
    source: 'chatbot',
    status: env.chatbot.appointmentConfirmationRequired ? APPOINTMENT_STATUS.BOOKED : APPOINTMENT_STATUS.CONFIRMED,
    allow_held_slot: Boolean(slot.schedule_slot_id && env.chatbot.appointmentSlotHoldEnabled),
    held_by: chatbotHoldOwner(session),
  }, chatbotSystemActor(), chatbotRequestMeta(session, { action: 'chatbot.appointment.create' }));
  const appointment = appointmentResult.appointment;
  const draftCode = `CB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const draft = await ChatbotAppointmentDraft.create({
    session_id: session._id,
    draft_code: draftCode,
    status: 'confirmed',
    patient_id: patient._id,
    patient_name: booking.patient_name,
    phone: booking.phone,
    department_id: slot.department_id,
    doctor_id: slot.doctor_id,
    doctor_schedule_id: slot.doctor_schedule_id,
    schedule_slot_id: appointment.schedule_slot_id || slot.schedule_slot_id,
    appointment_id: appointment.appointment_id,
    appointment_time: slot.appointment_time,
    selected_slot: slot,
    symptoms_note: booking.symptoms_note || booking.note,
    confirmation_snapshot: {
      appointment_id: appointment.appointment_id,
      patient_code: appointment.patient_code,
      patient_name: booking.patient_name,
      phone: maskPhone(booking.phone),
      department_name: slot.department_name,
      doctor_name: slot.doctor_name,
      date: slot.date,
      time: slot.time,
      fee_display: slot.fee_display,
      status: appointment.status,
    },
    expires_at: draftExpiresAt(),
    confirmed_at: new Date(),
  });
  session.context = {
    ...(session.context || {}),
    booking: {
      ...booking,
      appointment_draft_id: toId(draft._id),
      appointment_draft_code: draftCode,
      appointment_id: appointment.appointment_id,
      patient_id: toId(patient._id),
      patient_code: appointment.patient_code,
    },
  };
  session.current_step = 'appointment_created';
  await session.save();
  return { draft, appointment, reused: false };
}

async function confirmBookingResponse(session) {
  let result;
  try {
    result = await createRealAppointmentFromSession(session);
  } catch (error) {
    if ([409, 422].includes(Number(error.statusCode || error.status))) {
      session.current_step = 'booking_slot_conflict';
      await session.save();
      return botText(`${error.message || 'Khung giờ này không còn khả dụng.'} Em có thể tìm lại lịch trống gần nhất cho anh/chị.`, {
        type: 'quick_replies',
        quick_replies: buildQuickReplies([
          { label: 'Tìm giờ khác', value: `${session.context?.booking?.department || 'Chuyên khoa'} ${session.context?.booking?.date_iso || 'ngày mai'} còn lịch không?` },
          { label: 'Ngày khác', value: `${session.context?.booking?.department || 'Chuyên khoa'} ngày kia còn lịch không?` },
          { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
        ]),
      });
    }
    throw error;
  }
  const { draft, appointment } = result;
  const appointmentCode = appointment?.appointment_id
    ? `APT-${String(appointment.appointment_id).slice(-6).toUpperCase()}`
    : draft?.draft_code || 'APT';
  const draftPayload = draft?.toJSON ? draft.toJSON() : draft;
  const booking = session.context?.booking || {};
  const statusText = appointment?.status === APPOINTMENT_STATUS.CONFIRMED
    ? 'đã được xác nhận'
    : 'đã được tạo và đang chờ xác nhận vận hành';
  return botText(
    `Em đã tạo lịch hẹn thật trong hệ thống. Mã lịch hẹn: ${appointmentCode}. Lịch ${statusText}. Khi đi khám, anh/chị vui lòng đến trước 15 phút và mang CCCD/BHYT nếu có.`,
    {
      type: 'appointment_confirmed',
      draft: draftPayload,
      appointment,
      summary: {
        appointment_code: appointmentCode,
        patient_name: appointment?.patient_name || draft?.patient_name || booking.patient_name,
        patient_code: appointment?.patient_code,
        phone: maskPhone(draft?.phone || booking.phone),
        department_name: appointment?.department_name || draft?.confirmation_snapshot?.department_name,
        doctor_name: appointment?.doctor_name || draft?.confirmation_snapshot?.doctor_name,
        date: formatDate(appointment?.appointment_time || draft?.appointment_time),
        time: formatTime(appointment?.appointment_time || draft?.appointment_time),
        status: appointment?.status,
      },
      actions: buildQuickReplies([
        { label: 'Xem hướng dẫn đi khám', value: 'Tôi cần mang giấy tờ gì khi đi khám?' },
        { label: 'Hỏi thanh toán', value: 'Tôi muốn hỏi cách thanh toán QR' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
      ]),
    },
  );
}

function buildHandoffSummary(session = {}, reason = 'user_request') {
  const booking = session.context?.booking || {};
  const lead = session.context?.lead || {};
  const insights = session.context?.insights || {};
  const known = [
    booking.department ? `Chuyên khoa: ${booking.department}` : null,
    booking.doctor ? `Bác sĩ: ${booking.doctor}` : null,
    booking.date_iso ? `Ngày mong muốn: ${booking.date_iso}` : null,
    booking.time_preference ? `Khung giờ: ${booking.time_preference}` : null,
    booking.patient_name || lead.patient_name ? `Họ tên: ${booking.patient_name || lead.patient_name}` : null,
    booking.phone || lead.phone ? `SĐT: ${maskPhone(booking.phone || lead.phone)}` : null,
    booking.symptoms_note ? `Ghi chú: ${booking.symptoms_note}` : null,
    lead.concern ? `Nhu cầu lead: ${lead.concern}` : null,
    lead.insurance_type ? `Bảo hiểm: ${lead.insurance_type}` : null,
  ].filter(Boolean);
  const missing = [];
  if (!booking.patient_name && !lead.patient_name) missing.push('Họ tên');
  if (!booking.phone && !lead.phone) missing.push('SĐT');
  if (!booking.department && !booking.doctor) missing.push('Chuyên khoa/bác sĩ');
  if (!booking.date_iso) missing.push('Ngày khám mong muốn');
  return {
    summary: [
      session.current_intent ? `Intent gần nhất: ${session.current_intent}` : null,
      `Lý do chuyển: ${reason}`,
      known.length ? `Đã có: ${known.join('; ')}` : null,
      missing.length ? `Còn thiếu: ${missing.join(', ')}` : null,
      `Mức rủi ro: ${session.risk_level || 'low'}`,
      insights.lead_score !== undefined ? `Lead score: ${insights.lead_score}/100 (${insights.lead_priority || 'unknown'})` : null,
      insights.last_mood ? `Cảm xúc gần nhất: ${insights.last_mood}` : null,
      Array.isArray(insights.tags) && insights.tags.length ? `Tags: ${insights.tags.join(', ')}` : null,
    ].filter(Boolean).join('\n'),
    known,
    missing,
    insights,
  };
}

function supportCategoryForHandoff(reason = '') {
  if (reason === 'appointment' || reason === 'fallback_limit') return SUPPORT_CATEGORY.APPOINTMENT;
  if (reason === 'billing' || reason === 'price_not_found') return SUPPORT_CATEGORY.BILLING;
  if (reason === 'insurance') return SUPPORT_CATEGORY.INSURANCE;
  if (reason === 'complaint') return SUPPORT_CATEGORY.COMPLAINT;
  if (reason === 'feedback') return SUPPORT_CATEGORY.OTHER;
  if (reason === 'family_booking' || reason === 'lead_capture' || reason === 'callback_request') return SUPPORT_CATEGORY.APPOINTMENT;
  if (reason === 'corporate_health_check') return SUPPORT_CATEGORY.OTHER;
  return SUPPORT_CATEGORY.OTHER;
}

function supportPriorityForHandoff(session = {}, reason = '') {
  if (reason === 'emergency' || session.risk_level === 'emergency') return SUPPORT_TICKET_PRIORITY.URGENT;
  if (reason === 'complaint' || session.risk_level === 'high') return SUPPORT_TICKET_PRIORITY.HIGH;
  if (reason === 'corporate_health_check') return SUPPORT_TICKET_PRIORITY.HIGH;
  return SUPPORT_TICKET_PRIORITY.NORMAL;
}

function supportSubjectForHandoff(reason = '') {
  if (reason === 'appointment') return 'Chatbot chuyển nhân viên đặt lịch';
  if (reason === 'billing' || reason === 'price_not_found') return 'Chatbot chuyển nhân viên thanh toán';
  if (reason === 'insurance') return 'Chatbot chuyển nhân viên bảo hiểm';
  if (reason === 'complaint') return 'Chatbot chuyển khiếu nại khách hàng';
  if (reason === 'emergency') return 'Chatbot phát hiện tình huống khẩn cấp';
  if (reason === 'callback_request') return 'Chatbot yêu cầu gọi lại';
  if (reason === 'lead_capture') return 'Chatbot tạo lead tư vấn';
  if (reason === 'family_booking') return 'Chatbot lead đặt lịch cho người thân';
  if (reason === 'corporate_health_check') return 'Chatbot lead khám sức khỏe doanh nghiệp';
  if (reason === 'feedback') return 'Chatbot ghi nhận phản hồi khách hàng';
  return 'Chatbot chuyển nhân viên hỗ trợ';
}

function handoffIdentityFormResponse(reason = 'user_request') {
  return botText(
    'Dạ, để chuyển đúng nhân viên hỗ trợ và mở hộp tin nhắn cho lễ tân, anh/chị cho em xin họ tên, số điện thoại và nội dung cần hỗ trợ.',
    {
      type: 'booking_form',
      submit_action: 'submit_handoff_identity',
      submit_label: 'Gửi yêu cầu gặp nhân viên',
      submit_value: 'Tôi gửi yêu cầu gặp nhân viên',
      button_label: 'Chuyển nhân viên',
      reason,
      fields: [
        { name: 'patient_name', label: 'Họ tên', required: true },
        { name: 'phone', label: 'Số điện thoại', required: true },
        { name: 'note', label: 'Nội dung cần hỗ trợ', required: false, multiline: true },
      ],
    },
  );
}

function sessionHasHandoffIdentity(session = {}) {
  const booking = session.context?.booking || {};
  const lead = session.context?.lead || {};
  return Boolean(
    (session.patient_id || booking.patient_id || lead.patient_id)
    || ((booking.patient_name || lead.patient_name) && (booking.phone || lead.phone)),
  );
}

function requestedHandoffTime(session = {}) {
  const booking = session.context?.booking || {};
  const slot = booking.selected_slot || booking.reschedule_slot || {};
  const explicit = slot.appointment_time || booking.appointment_time;
  if (explicit) {
    const date = new Date(explicit);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (booking.date_iso) {
    const minutes = minutesFromTimeText(booking.time_text);
    const date = new Date(`${booking.date_iso}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      if (minutes !== null) date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return date;
    }
  }
  return new Date();
}

function handoffConversationUrl(conversationId) {
  const id = toId(conversationId);
  return id
    ? `/reception/dashboard?menu=support-patient-messages&conversation_id=${encodeURIComponent(id)}`
    : '/reception/dashboard?menu=support-patient-messages';
}

function notificationPriorityForHandoff(session = {}, reason = '') {
  if (reason === 'emergency' || session.risk_level === 'emergency') return NOTIFICATION_PRIORITY.URGENT;
  if (reason === 'complaint' || session.risk_level === 'high') return NOTIFICATION_PRIORITY.HIGH;
  return NOTIFICATION_PRIORITY.NORMAL;
}

function staffActorId(actor = {}) {
  return actor.userId || actor.user_id || actor.actorId || actor.actor_id || actor.user?._id || actor.user?.id || null;
}

function isStaffActor(actor = {}) {
  return actor?.actorType === ACTOR_TYPE.STAFF || actor?.actor_type === ACTOR_TYPE.STAFF || Boolean(staffActorId(actor));
}

async function findHandoffStaffCandidates(session = {}, queue = '') {
  const booking = session.context?.booking || {};
  const requestedAt = requestedHandoffTime(session);
  const departmentId = toId(booking.department_id || booking.selected_slot?.department_id || booking.reschedule_slot?.department_id);
  const primaryRoles = normalizeList(env.chatbot.handoffPrimaryRoleCodes, DEFAULT_HANDOFF_PRIMARY_ROLES);
  const fallbackRoles = normalizeList(env.chatbot.handoffFallbackRoleCodes, DEFAULT_HANDOFF_FALLBACK_ROLES);
  const roleCodes = [...new Set([...primaryRoles, ...fallbackRoles])];
  const roles = await Role.find({
    role_code: { $in: roleCodes },
    status: ROLE_STATUS.ACTIVE,
    is_deleted: false,
  }).select('_id role_code priority_level').lean();
  if (!roles.length) return [];

  const roleCodeById = new Map(roles.map((role) => [toId(role._id), role.role_code]));
  const roleRank = new Map(roleCodes.map((roleCode, index) => [roleCode, roleCodes.length - index]));
  const assignments = await UserRole.find({
    role_id: { $in: roles.map((role) => role._id) },
    is_active: true,
  }).select('user_id role_id').lean();
  const userRoles = new Map();
  assignments.forEach((assignment) => {
    const userId = toId(assignment.user_id);
    const roleCode = roleCodeById.get(toId(assignment.role_id));
    if (!userId || !roleCode) return;
    userRoles.set(userId, [...(userRoles.get(userId) || []), roleCode]);
  });
  const userIds = [...userRoles.keys()];
  if (!userIds.length) return [];

  const users = await User.find({
    _id: { $in: userIds },
    status: USER_STATUS.ACTIVE,
    is_deleted: false,
  }).select('full_name employee_code department_id last_login_at').lean();
  if (!users.length) return [];

  const openStatuses = [
    SUPPORT_TICKET_STATUS.OPEN,
    SUPPORT_TICKET_STATUS.WAITING_STAFF,
    SUPPORT_TICKET_STATUS.WAITING_PATIENT,
  ];
  const ticketLoads = await SupportTicket.aggregate([
    { $match: { assigned_user_id: { $in: users.map((user) => user._id) }, status: { $in: openStatuses } } },
    { $group: { _id: '$assigned_user_id', count: { $sum: 1 } } },
  ]);
  const loadMap = new Map(ticketLoads.map((item) => [toId(item._id), Number(item.count || 0)]));
  const dayStart = getStartOfDay(new Date());
  const requestedDayStart = getStartOfDay(requestedAt);
  const requestedDayEnd = getEndOfDay(requestedAt);
  const hasDepartmentCoverage = departmentId
    ? Boolean(await DoctorSchedule.exists({
      department_id: departmentId,
      is_deleted: false,
      status: { $in: ['published', 'active'] },
      shift_start: { $lte: requestedDayEnd },
      shift_end: { $gte: requestedDayStart },
    }))
    : true;

  return users
    .map((user) => {
      const id = toId(user._id);
      const rolesForUser = userRoles.get(id) || [];
      const sameDepartment = Boolean(departmentId && toId(user.department_id) === departmentId);
      const loggedInToday = user.last_login_at && new Date(user.last_login_at) >= dayStart;
      const openTicketCount = loadMap.get(id) || 0;
      const bestRoleScore = Math.max(...rolesForUser.map((roleCode) => roleRank.get(roleCode) || 0), 0);
      const coverageMatch = !departmentId || sameDepartment || hasDepartmentCoverage;
      const score = (sameDepartment ? 80 : 0)
        + (loggedInToday ? 40 : 0)
        + (coverageMatch ? 20 : 0)
        + bestRoleScore
        - openTicketCount;
      return {
        user_id: id,
        full_name: user.full_name,
        employee_code: user.employee_code,
        department_id: toId(user.department_id),
        role_codes: rolesForUser,
        same_department: sameDepartment,
        on_duty_today: Boolean(loggedInToday),
        matched_requested_time: coverageMatch,
        open_ticket_count: openTicketCount,
        queue,
        score,
      };
    })
    .sort((first, second) => second.score - first.score)
    .slice(0, Math.max(1, Number(env.chatbot.handoffMaxEscalationStaff || 2)));
}

async function assignTicketToHandoffStaff(handoff = {}, candidate = {}, reason = '') {
  const ticketId = handoff.support_ticket_id;
  const conversationId = handoff.support_conversation_id;
  if (!ticketId || !candidate.user_id) return;
  const now = new Date();
  const ticket = await SupportTicket.findById(ticketId);
  if (ticket) {
    ticket.assigned_user_id = candidate.user_id;
    if (!ticket.assigned_department_id && candidate.department_id) ticket.assigned_department_id = candidate.department_id;
    ticket.status = SUPPORT_TICKET_STATUS.WAITING_STAFF;
    ticket.metadata = {
      ...(ticket.metadata || {}),
      chatbot_handoff: {
        ...(ticket.metadata?.chatbot_handoff || {}),
        primary_staff_id: candidate.user_id,
        reason,
        assigned_at: now.toISOString(),
      },
    };
    await ticket.save();
  }
  if (conversationId && isValidObjectId(conversationId)) {
    await Conversation.updateOne(
      { _id: conversationId, is_deleted: false },
      {
        $set: {
          assigned_user_id: candidate.user_id,
          ...(candidate.department_id ? { assigned_department_id: candidate.department_id } : {}),
          last_message_at: now,
        },
      },
    );
    await ConversationParticipant.updateOne(
      {
        conversation_id: conversationId,
        actor_type: ACTOR_TYPE.STAFF,
        actor_id: candidate.user_id,
      },
      {
        $set: {
          actor_role_code: candidate.role_codes?.[0] || ROLE_CODE.RECEPTIONIST,
          role_in_conversation: CONVERSATION_PARTICIPANT_ROLE.ASSIGNEE,
          left_at: null,
          archived: false,
        },
        $setOnInsert: {
          joined_at: now,
        },
      },
      { upsert: true },
    );
  }
}

async function createHandoffCandidateNotification(session, handoff, candidate, rank, reason, handoffSummary) {
  const booking = session.context?.booking || {};
  const requestedAt = requestedHandoffTime(session);
  const scheduledAt = rank === 1
    ? null
    : addMinutes(new Date(), env.chatbot.handoffFirstResponseTimeoutMinutes || 2);
  const conversationId = handoff.support_conversation_id;
  const actionUrl = handoffConversationUrl(conversationId);
  const ticketCode = handoff.support_ticket_code || handoff.ticket_code || '';
  const patientName = booking.patient_name || session.context?.lead?.patient_name || 'Khách chatbot';
  const phone = booking.phone || session.context?.lead?.phone;
  const notification = await notificationService.createNotification({
    recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
    recipient_id: candidate.user_id,
    recipient_user_id: candidate.user_id,
    channel: NOTIFICATION_CHANNEL.IN_APP,
    notification_type: CHATBOT_HANDOFF_NOTIFICATION_TYPE,
    priority: notificationPriorityForHandoff(session, reason),
    title: rank === 1 ? 'Chatbot cần lễ tân tiếp nhận khách' : 'Chatbot chuyển tiếp yêu cầu chưa được nhận',
    message: [
      `${patientName} cần nhân viên hỗ trợ qua chatbot.`,
      ticketCode ? `Ticket: ${ticketCode}.` : null,
      `Thời điểm khách yêu cầu: ${formatTime(requestedAt)} ${formatDate(requestedAt)}.`,
      phone ? `SĐT: ${maskPhone(phone)}.` : null,
    ].filter(Boolean).join(' '),
    payload: {
      action: 'accept_chatbot_handoff',
      chatbot_session_id: toId(session._id),
      support_ticket_id: handoff.support_ticket_id,
      support_ticket_code: ticketCode,
      conversation_id: conversationId,
      queue: handoff.queue,
      reason,
      rank,
      patient_name: patientName,
      phone: phone ? maskPhone(phone) : undefined,
      requested_at: requestedAt.toISOString(),
      on_duty_today: candidate.on_duty_today,
      matched_requested_time: candidate.matched_requested_time,
      handoff_summary: handoffSummary,
    },
    action_url: actionUrl,
    scheduled_at: scheduledAt ? scheduledAt.toISOString() : undefined,
    send_immediately: rank === 1,
    dedupe_key: `chatbot-handoff:${toId(session._id)}:${candidate.user_id}:${rank}`,
    created_by_module: 'chatbot',
  }, chatbotSystemActor(), chatbotRequestMeta(session, { action: 'chatbot.handoff.notify_staff' }), { skipAudit: false });
  return {
    notification_id: toId(notification._id),
    user_id: candidate.user_id,
    rank,
    scheduled_at: scheduledAt ? scheduledAt.toISOString() : null,
    action_url: actionUrl,
  };
}

async function notifyHandoffStaff(session, handoff = {}, reason = '', queue = '', handoffSummary = {}) {
  if (!handoff.support_ticket_id || handoff.notified_at) return handoff;
  const candidates = await findHandoffStaffCandidates(session, queue);
  if (!candidates.length) {
    return {
      ...handoff,
      notification_status: 'no_staff_candidate',
      candidate_staff: [],
    };
  }

  await assignTicketToHandoffStaff(handoff, candidates[0], reason);
  const notifications = [];
  for (let index = 0; index < candidates.length; index += 1) {
    notifications.push(await createHandoffCandidateNotification(
      session,
      handoff,
      candidates[index],
      index + 1,
      reason,
      handoffSummary,
    ));
  }
  return {
    ...handoff,
    candidate_staff: candidates.map((candidate, index) => ({
      user_id: candidate.user_id,
      full_name: candidate.full_name,
      role_codes: candidate.role_codes,
      rank: index + 1,
      on_duty_today: candidate.on_duty_today,
      matched_requested_time: candidate.matched_requested_time,
      open_ticket_count: candidate.open_ticket_count,
    })),
    primary_staff_id: candidates[0].user_id,
    notification_ids: notifications.map((item) => item.notification_id).filter(Boolean),
    notifications,
    conversation_url: handoffConversationUrl(handoff.support_conversation_id),
    notified_at: new Date().toISOString(),
  };
}

async function ensureHandoffSupportTicket(session, reason, queue, handoffSummary) {
  const context = session.context || {};
  const booking = context.booking || {};
  const existingHandoff = context.handoff || {};
  if (existingHandoff.support_ticket_id) {
    const routedHandoff = await notifyHandoffStaff(session, existingHandoff, reason, queue, handoffSummary);
    session.context = { ...context, handoff: routedHandoff };
    return routedHandoff;
  }

  let patientId = session.patient_id || booking.patient_id;
  if (!patientId && booking.patient_name && booking.phone) {
    try {
      const patient = await ensurePatientForBooking(session, booking);
      patientId = patient?._id;
    } catch (error) {
      patientId = null;
    }
  }

  if (!patientId || !isValidObjectId(patientId)) {
    const handoff = {
      ...existingHandoff,
      support_ticket_skipped: 'missing_patient_identity',
      queue,
      reason,
    };
    session.context = { ...context, handoff };
    return handoff;
  }

  try {
    const ticket = await supportTicketService.createTicket({
      patient_id: patientId,
      category: supportCategoryForHandoff(reason),
      priority: supportPriorityForHandoff(session, reason),
      subject: supportSubjectForHandoff(reason),
      description: [
        handoffSummary.summary,
        session.source_page ? `Trang nguồn: ${session.source_page}` : null,
        `Kênh: ${session.channel || 'website'}`,
      ].filter(Boolean).join('\n'),
      metadata: {
        source: 'chatbot',
        chatbot_session_id: toId(session._id),
        chatbot_queue: queue,
        handoff_reason: reason,
        handoff_summary: handoffSummary,
        booking,
      },
    }, chatbotSystemActor(), chatbotRequestMeta(session, { action: 'chatbot.handoff.create_ticket' }));
    const handoff = {
      ...existingHandoff,
      support_ticket_id: toId(ticket._id || ticket.id || ticket.ticket_id),
      support_ticket_code: ticket.ticket_code,
      support_conversation_id: toId(ticket.conversation_id?._id || ticket.conversation_id?.id || ticket.conversation_id),
      queue,
      reason,
      created_at: new Date().toISOString(),
    };
    const routedHandoff = await notifyHandoffStaff(session, handoff, reason, queue, handoffSummary);
    session.context = { ...(session.context || {}), handoff: routedHandoff };
    return routedHandoff;
  } catch (error) {
    const handoff = {
      ...existingHandoff,
      support_ticket_skipped: 'create_failed',
      support_ticket_error: error.message,
      queue,
      reason,
    };
    session.context = { ...(session.context || {}), handoff };
    return handoff;
  }
}

async function handoffResponse(session, reason = 'user_request') {
  if (reason !== 'emergency' && !sessionHasHandoffIdentity(session)) {
    session.current_step = 'collect_handoff_identity';
    await session.save();
    return handoffIdentityFormResponse(reason);
  }
  const queue = reason === 'emergency'
    ? env.chatbot.handoffQueueEmergency
    : reason === 'billing'
      ? env.chatbot.handoffQueueBilling
      : reason === 'appointment'
        ? env.chatbot.handoffQueueAppointment
        : env.chatbot.handoffQueueDefault;
  session.status = 'handoff';
  session.assigned_queue = queue;
  session.handoff_reason = reason;
  session.current_step = 'handoff';
  const handoffSummary = buildHandoffSummary(session, reason);
  const supportTicket = await ensureHandoffSupportTicket(session, reason, queue, handoffSummary);
  await session.save();
  return botText(
    `Dạ, em đã tạo yêu cầu hỗ trợ trong hệ thống và gửi thông báo cho nhân viên phù hợp đang trực/đang phụ trách hàng đợi. Nếu nhân viên đầu tiên chưa nhận trong ${env.chatbot.handoffFirstResponseTimeoutMinutes || 2} phút, hệ thống sẽ chuyển tiếp cho nhân viên kế tiếp. Thời gian phản hồi dự kiến khoảng ${env.chatbot.handoffExpectedWaitMinutes} phút.`,
    {
      type: 'handoff_notice',
      queue,
      reason,
      expected_wait_minutes: env.chatbot.handoffExpectedWaitMinutes,
      handoff_summary: handoffSummary,
      support_ticket: supportTicket,
    },
  );
}

async function kbResponse(analysis, text) {
  const sources = await searchKnowledgeBase(text, analysis.intent);
  const fallback = 'Dạ, hiện em chưa có thông tin chính xác về nội dung này trong hệ thống. Em có thể chuyển anh/chị đến nhân viên tư vấn để kiểm tra giúp mình.';
  const answer = answerFromKnowledge(sources, fallback);
  return botText(answer, {
    type: 'knowledge_answer',
    sources: env.chatbot.kbShowSourceToPatient ? sources.map((item) => ({ title: item.title, category: item.category })) : [],
    admin_sources: env.chatbot.kbShowSourceToAdmin ? sources : [],
    quick_replies: sources.length ? buildQuickReplies([
      { label: 'Đặt lịch', value: 'Tôi muốn đặt lịch khám' },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
    ]) : buildQuickReplies([{ label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' }]),
  });
}

function insuranceEligibilityResponse(analysis) {
  if (!analysis.entities?.insurance_type || analysis.entities.insurance_type === 'unknown') {
    return botText('Dạ, để kiểm tra đúng hướng, anh/chị đang hỏi BHYT hay bảo hiểm tư nhân/bảo lãnh viện phí ạ?', {
      type: 'quick_replies',
      quick_replies: buildQuickReplies([
        { label: 'BHYT', value: 'Tôi muốn hỏi BHYT có áp dụng không?' },
        { label: 'Bảo hiểm tư nhân', value: 'Tôi muốn hỏi bảo hiểm tư nhân có áp dụng không?' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn bảo hiểm' },
      ]),
    });
  }
  return null;
}

async function fallbackResponse(session, analysis, text, userMessage) {
  const context = session.context || {};
  const fallbackCount = Number(context.fallback_count || 0) + 1;
  session.context = { ...context, fallback_count: fallbackCount };
  await session.save();

  if (env.chatbot.saveFallbacks) {
    await ChatbotFallback.create({
      session_id: session._id,
      message_id: userMessage?._id,
      user_text: maskSensitiveText(text),
      predicted_intent: analysis.intent || 'unknown',
      confidence: analysis.confidence || 0,
      reason: analysis.confidence < LOW_CONFIDENCE_THRESHOLD ? 'low_confidence' : 'unsupported_flow',
    });
  }

  if (env.chatbot.humanHandoffEnabled && fallbackCount >= env.chatbot.maxFallbackBeforeHandoff) {
    return handoffResponse(session, 'fallback_limit');
  }

  return botText('Em chưa chắc anh/chị muốn đặt lịch, hỏi thông tin dịch vụ hay gặp nhân viên. Anh/chị muốn em hỗ trợ theo hướng nào ạ?', {
    type: 'quick_replies',
    quick_replies: buildQuickReplies([
      { label: 'Đặt lịch', value: 'Tôi muốn đặt lịch khám' },
      { label: 'Hỏi giá', value: 'Tôi muốn hỏi giá dịch vụ' },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên' },
    ]),
  });
}

function mergeBookingContext(session, analysis) {
  const current = session.context || {};
  const booking = mergeEntities(current.booking || {}, analysis.entities || {});
  session.context = {
    ...current,
    booking,
  };
  return booking;
}

async function buildBotReply(session, analysis, text, userMessage = null, actor = {}) {
  const previousStep = session.current_step;
  mergeBookingContext(session, analysis);
  updateConversationInsights(session, analysis, text);
  session.current_intent = analysis.intent;
  session.risk_level = analysis.risk_level || 'low';
  session.current_step = analysis.next_action || session.current_step;

  if (analysis.source === 'gemini') {
    session.context = {
      ...(session.context || {}),
      ai_call_count: Number(session.context?.ai_call_count || 0) + 1,
    };
  }

  if (analysis.intent === 'emergency') return emergencyResponse(analysis);
  if (analysis.intent === 'medical_safety_block') return medicalSafetyResponse();
  if (analysis.intent === 'prompt_injection') return promptInjectionResponse();
  if (analysis.intent === 'casual_chat') return casualChatResponse(text);
  if (analysis.intent === 'greeting') return buildWelcomeMessage(session.source_page, session.context?.page_context || {});
  if (analysis.intent === 'thanks') return botText('Dạ, em luôn sẵn sàng hỗ trợ anh/chị đặt lịch, tìm bác sĩ hoặc gặp nhân viên tư vấn khi cần.');
  if (analysis.intent === 'goodbye') return botText('Dạ, cảm ơn anh/chị. Chúc anh/chị nhiều sức khỏe.');
  if (analysis.intent === 'human_support' || analysis.intent === 'complaint') return handoffResponse(session, analysis.intent === 'complaint' ? 'complaint' : handoffReasonFromText(text, session));
  if (analysis.intent === 'feedback' || previousStep === 'collect_feedback') return callbackRequestResponse(session, analysis, text, 'feedback');
  if (LEAD_CAPTURE_INTENTS.has(analysis.intent) || previousStep === 'collect_callback') {
    if (analysis.intent === 'insurance_eligibility_check' && analysis.entities.insurance_type) return kbResponse(analysis, text);
    return callbackRequestResponse(session, analysis, text, analysis.intent || 'callback_request');
  }
  if (analysis.intent === 'abandoned_booking_recovery') return abandonedBookingRecoveryResponse(session, text);
  if (analysis.intent === 'returning_patient_support') return returningPatientResponse(actor);
  if (analysis.intent === 'check_appointment_status') return appointmentStatusResponse(session, analysis, actor);
  if (analysis.intent === 'cancel_appointment') return cancelAppointmentIntentResponse(session, analysis, actor);
  if (analysis.intent === 'reschedule_appointment') return rescheduleAppointmentIntentResponse(session, analysis, text, actor);
  if (analysis.intent === 'ask_price') return buildPriceResponse(analysis, text);
  if (analysis.intent === 'ask_working_hours') return facilityInfoResponse(analysis, text, 'hours');
  if (analysis.intent === 'ask_location' || analysis.intent === 'branch_recommendation') return facilityInfoResponse(analysis, text, 'location');
  if (analysis.intent === 'find_doctor' || analysis.intent === 'doctor_recommendation') return doctorSearchResponse(analysis, text);
  if (['find_service', 'compare_services', 'recommend_package'].includes(analysis.intent)) return serviceSearchResponse(analysis, text);
  if (['find_department', 'ask_symptom_department'].includes(analysis.intent) && analysis.next_action !== 'find_available_slots') {
    return departmentSuggestionResponse(analysis, text);
  }
  if (['book_appointment', 'ask_available_slots', 'ask_symptom_department'].includes(analysis.intent)) {
    return slotPickerResponse(analysis, session, text);
  }
  if (analysis.intent === 'insurance_eligibility_check') {
    const clarify = insuranceEligibilityResponse(analysis);
    if (clarify) return clarify;
  }
  if (['ask_payment', 'ask_qr_payment', 'ask_invoice', 'ask_insurance', 'insurance_eligibility_check', 'ask_patient_portal', 'ask_preparation', 'ask_required_documents'].includes(analysis.intent)) {
    return kbResponse(analysis, text);
  }
  if (analysis.intent === 'check_payment_status') return paymentStatusResponse(session, analysis, actor);
  if (analysis.intent === 'check_result_status') return resultStatusResponse(session, analysis, actor);
  if (analysis.intent === 'upload_document_help') return uploadDocumentResponse();

  return fallbackResponse(session, analysis, text, userMessage);
}

function normalizeSlotAction(action = {}) {
  if (action.type !== 'select_slot' || !action.slot) return null;
  return action.slot;
}

async function handleAction(session, payload = {}, actor = {}, meta = {}) {
  const action = payload.action || {};
  const context = session.context || {};
  const booking = context.booking || {};

  if (action.type === 'select_slot') {
    let slot = normalizeSlotAction(action);
    if (!slot) throw createError('slot không hợp lệ.', 422);
    slot = await holdSelectedSlotForSession(session, slot);
    session.context = {
      ...context,
      booking: {
        ...booking,
        selected_slot: slot,
        department_id: slot.department_id,
        department: slot.department_name,
        doctor_id: slot.doctor_id,
        doctor: slot.doctor_name,
        date_iso: new Date(slot.appointment_time).toISOString().slice(0, 10),
        slot_hold_expires_at: slot.hold_expires_at,
      },
    };
    session.current_intent = 'book_appointment';
    session.current_step = 'collect_identity';
    await session.save();
    return bookingFormResponse(slot);
  }

  if (action.type === 'select_reschedule_slot') {
    const slot = normalizeSlotAction({ type: 'select_slot', slot: action.slot });
    if (!slot) throw createError('slot đổi lịch không hợp lệ.', 422);
    session.context = {
      ...context,
      booking: {
        ...booking,
        reschedule_slot: slot,
        reschedule_appointment_id: action.appointment_id || slot.appointment_id || booking.reschedule_appointment_id,
        department_id: slot.department_id,
        department: slot.department_name,
        doctor_id: slot.doctor_id,
        doctor: slot.doctor_name,
        date_iso: new Date(slot.appointment_time).toISOString().slice(0, 10),
      },
    };
    session.current_intent = 'reschedule_appointment';
    session.current_step = 'confirm_reschedule';
    await session.save();
    return rescheduleSummaryResponse(session);
  }

  if (action.type === 'submit_booking_identity') {
    const data = action.data || payload.data || {};
    const patientName = normalizeString(data.patient_name || data.patientName);
    const phone = normalizePhone(data.phone);
    if (env.chatbot.appointmentRequirePatientName && !patientName) throw createError('Vui lòng nhập họ tên bệnh nhân.', 422);
    if (env.chatbot.appointmentRequirePhone && !phone) throw createError('Vui lòng nhập số điện thoại.', 422);
    session.context = {
      ...context,
      booking: {
        ...booking,
        patient_name: patientName,
        phone,
        note: normalizeString(data.note),
        symptoms_note: normalizeString(data.note) || booking.symptoms_note,
      },
    };
    session.current_step = 'confirm_booking';
    await session.save();
    return appointmentSummaryResponse(session);
  }

  if (action.type === 'submit_appointment_lookup_identity') {
    const data = action.data || payload.data || {};
    const lookupIdentity = {
      patient_name: normalizeString(data.patient_name || data.patientName),
      phone: normalizePhone(data.phone),
      appointment_code: normalizeAppointmentLookupCode(data.appointment_code || data.appointmentCode),
    };
    if (!appointmentIdentityComplete(lookupIdentity)) {
      throw createError('Vui lòng nhập số điện thoại và họ tên hoặc mã lịch hẹn để kiểm tra.', 422);
    }
    session.context = {
      ...context,
      lookup_identity: lookupIdentity,
    };
    session.current_intent = 'check_appointment_status';
    session.current_step = 'lookup_appointment';
    await session.save();
    const verified = await findAppointmentsByVerifiedIdentity(lookupIdentity, { includeInactive: true });
    if (!verified.appointments?.length) return appointmentLookupHelpResponse('kiểm tra');
    return appointmentListResponse(verified.appointments, 'kiểm tra');
  }

  if (action.type === 'submit_handoff_identity') {
    const data = action.data || payload.data || {};
    const patientName = normalizeString(data.patient_name || data.patientName);
    const phone = normalizePhone(data.phone);
    if (!patientName) throw createError('Vui lòng nhập họ tên để chuyển nhân viên.', 422);
    if (!phone) throw createError('Vui lòng nhập số điện thoại để chuyển nhân viên.', 422);
    const note = normalizeString(data.note || data.concern);
    session.context = {
      ...context,
      booking: {
        ...booking,
        patient_name: patientName,
        phone,
        note: note || booking.note,
        symptoms_note: note || booking.symptoms_note,
      },
      lead: {
        ...(context.lead || {}),
        patient_name: patientName,
        phone,
        concern: note || context.lead?.concern,
      },
    };
    session.current_step = 'handoff';
    await session.save();
    return handoffResponse(session, action.reason || 'user_request');
  }

  if (['submit_callback_request', 'submit_lead_request', 'submit_feedback_request'].includes(action.type)) {
    const data = action.data || payload.data || {};
    const reason = action.type === 'submit_feedback_request'
      ? 'feedback'
      : (session.current_intent && LEAD_CAPTURE_INTENTS.has(session.current_intent) ? session.current_intent : 'callback_request');
    const callbackAnalysis = {
      entities: {
        ...emptyEntities(),
        patient_name: normalizeString(data.patient_name || data.patientName),
        phone: normalizePhone(data.phone),
        email: normalizeString(data.email),
      },
    };
    return callbackRequestResponse(session, callbackAnalysis, normalizeString(data.concern || data.note) || 'Yêu cầu tư vấn', reason);
  }

  if (action.type === 'confirm_booking') {
    return confirmBookingResponse(session);
  }

  if (action.type === 'confirm_cancel_appointment') {
    return confirmCancelAppointmentAction(session, action, actor, meta);
  }

  if (action.type === 'confirm_reschedule_appointment') {
    return confirmRescheduleAppointmentAction(session, actor, meta);
  }

  return null;
}

async function handleMessage(sessionId, payload = {}, actor = {}, meta = {}) {
  assertPublicRequest(meta, sessionId);
  await ensureDefaultTraining();
  const session = await getSessionOrThrow(sessionId);
  if (session.status === 'closed' || session.status === 'expired') {
    throw createError('Phiên chatbot đã đóng.', 409);
  }

  const text = normalizeString(payload.content || payload.text || payload.message) || '';
  const rawText = text || payload.action?.label || payload.action?.type || '';
  if (!rawText) throw createError('Nội dung tin nhắn là bắt buộc.', 422);

  const userMessage = await ChatbotMessage.create({
    session_id: session._id,
    sender_type: 'user',
    message_type: payload.action ? 'quick_reply' : 'text',
    content: maskSensitiveText(rawText),
    structured_payload: payload.action ? { action: payload.action } : {},
    metadata: {
      ip: getMetaIp(meta),
      source: payload.source,
    },
  });

  const history = await ChatbotMessage.find({ session_id: session._id, is_deleted: false })
    .sort({ created_at: -1 })
    .limit(env.chatbot.maxHistoryMessages)
    .lean();

  let analysis = null;
  let reply = await handleAction(session, payload, actor, meta);
  if (!reply) {
    const orderedHistory = history.reverse();
    analysis = await analyzeMessage(rawText, session, orderedHistory);
    reply = await buildBotReply(session, analysis, rawText, userMessage, actor);
    reply = await rewriteReplyTone(reply, session, analysis, rawText, orderedHistory);
  }

  session.last_message_at = new Date();
  session.expires_at = sessionExpiresAt();
  await session.save();

  const botMessage = await ChatbotMessage.create({
    session_id: session._id,
    sender_type: 'bot',
    message_type: reply.message_type,
    content: reply.content,
    structured_payload: reply.structured_payload,
    ai_trace: analysis && env.chatbot.saveAiTrace ? {
      provider: analysis.provider || analysis.source,
      model: analysis.model,
      prompt_version: analysis.prompt_version,
      intent: analysis.intent,
      confidence: analysis.confidence,
      entities: analysis.entities,
      risk_level: analysis.risk_level,
      red_flags: analysis.red_flags,
      medical_blocks: analysis.medical_blocks,
      next_action: analysis.next_action,
      missing_fields: analysis.missing_fields,
      latency_ms: analysis.latency_ms,
      source: analysis.source,
      provider_error: analysis.provider_error,
    } : {},
  });

  return {
    session: session.toJSON(),
    user_message: userMessage.toJSON(),
    bot_message: botMessage.toJSON(),
    analysis,
  };
}

async function escalateSession(sessionId, payload = {}, actor = {}, meta = {}) {
  const session = await getSessionOrThrow(sessionId);
  const reply = await handoffResponse(session, payload.reason || 'user_request');
  const botMessage = await ChatbotMessage.create({
    session_id: session._id,
    sender_type: 'bot',
    message_type: reply.message_type,
    content: reply.content,
    structured_payload: reply.structured_payload,
  });
  session.last_message_at = new Date();
  await session.save();
  return { session: session.toJSON(), bot_message: botMessage.toJSON() };
}

async function acceptHandoff(sessionId, payload = {}, actor = {}, meta = {}) {
  const userId = staffActorId(actor);
  if (!isStaffActor(actor) || !userId) throw createError('Chỉ nhân viên đã đăng nhập mới có thể nhận yêu cầu chatbot.', 403);
  const session = await getSessionOrThrow(sessionId);
  const handoff = session.context?.handoff || {};
  const ticketId = payload.support_ticket_id || handoff.support_ticket_id;
  const conversationId = payload.conversation_id || handoff.support_conversation_id;
  if (!ticketId || !conversationId) throw createError('Phiên chatbot chưa có ticket/hội thoại hỗ trợ để tiếp nhận.', 404);

  const candidate = {
    user_id: toId(userId),
    department_id: actor.departmentId || actor.department_id || actor.user?.department_id,
    role_codes: actor.roles || actor.role_codes || [ROLE_CODE.RECEPTIONIST],
  };
  await assignTicketToHandoffStaff({
    ...handoff,
    support_ticket_id: ticketId,
    support_conversation_id: conversationId,
  }, candidate, handoff.reason || session.handoff_reason || 'user_request');

  await Promise.all([
    SupportTicket.updateOne(
      { _id: ticketId },
      {
        $set: {
          assigned_user_id: userId,
          status: SUPPORT_TICKET_STATUS.OPEN,
          'metadata.chatbot_handoff.accepted_by_staff_id': userId,
          'metadata.chatbot_handoff.accepted_at': new Date(),
        },
      },
    ),
    Conversation.updateOne(
      { _id: conversationId, is_deleted: false },
      {
        $set: {
          assigned_user_id: userId,
          status: CONVERSATION_STATUS.OPEN,
          last_message_at: new Date(),
        },
      },
    ),
  ]);

  const notificationIds = (handoff.notification_ids || []).filter(isValidObjectId);
  if (notificationIds.length) {
    await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        recipient_user_id: { $ne: userId },
        status: NOTIFICATION_STATUS.QUEUED,
        scheduled_at: { $gt: new Date() },
      },
      {
        $set: {
          status: NOTIFICATION_STATUS.CANCELLED,
          updated_by: userId,
          failure_reason: 'chatbot_handoff_accepted_by_primary_or_other_staff',
        },
      },
    );
  }
  if (payload.notification_id && isValidObjectId(payload.notification_id)) {
    try {
      await notificationService.markNotificationRead(payload.notification_id, actor, chatbotRequestMeta(session, {
        ...meta,
        action: 'chatbot.handoff.notification_read',
      }));
    } catch (error) {
      await Notification.updateOne(
        { _id: payload.notification_id, recipient_user_id: userId },
        { $set: { status: NOTIFICATION_STATUS.READ, read_at: new Date(), updated_by: userId } },
      );
    }
  }

  const staffName = actor.fullName || actor.full_name || actor.user?.full_name || 'Nhân viên hỗ trợ';
  await Message.create({
    conversation_id: conversationId,
    sender_actor_type: ACTOR_TYPE.SYSTEM,
    sender_actor_id: 'chatbot',
    message_type: MESSAGE_TYPE.SYSTEM,
    body: `${staffName} đã nhận yêu cầu từ chatbot và sẽ tiếp tục trao đổi với khách hàng.`,
    status: 'sent',
  });

  session.assigned_staff_id = userId;
  session.context = {
    ...(session.context || {}),
    handoff: {
      ...handoff,
      support_ticket_id: toId(ticketId),
      support_conversation_id: toId(conversationId),
      accepted_by_staff_id: toId(userId),
      accepted_by_staff_name: staffName,
      accepted_at: new Date().toISOString(),
      conversation_url: handoffConversationUrl(conversationId),
    },
  };
  await session.save();

  return {
    session: session.toJSON(),
    support_ticket_id: toId(ticketId),
    conversation_id: toId(conversationId),
    action_url: handoffConversationUrl(conversationId),
  };
}

async function closeSession(sessionId) {
  const session = await getSessionOrThrow(sessionId);
  session.status = 'closed';
  session.current_step = 'closed';
  await session.save();
  return session.toJSON();
}

async function getDashboard() {
  await ensureDefaultTraining();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [
    totalSessions,
    todaySessions,
    handoffSessions,
    emergencySessions,
    totalMessages,
    fallbackCount,
    intentCount,
    entityCount,
    articleCount,
    draftCount,
    appointmentCount,
    todayFallbackCount,
    highIntentLeadCount,
    topIntents,
  ] = await Promise.all([
    ChatbotSession.countDocuments({ is_deleted: false }),
    ChatbotSession.countDocuments({ is_deleted: false, created_at: { $gte: since } }),
    ChatbotSession.countDocuments({ is_deleted: false, status: 'handoff', created_at: { $gte: since } }),
    ChatbotSession.countDocuments({ is_deleted: false, risk_level: 'emergency', created_at: { $gte: since } }),
    ChatbotMessage.countDocuments({ is_deleted: false, created_at: { $gte: since } }),
    ChatbotFallback.countDocuments({ is_deleted: false, resolved_at: { $exists: false } }),
    ChatbotIntent.countDocuments({ is_deleted: false, enabled: true }),
    ChatbotEntityDictionary.countDocuments({ is_deleted: false, enabled: true }),
    KnowledgeArticle.countDocuments({ is_deleted: false, status: 'published' }),
    ChatbotAppointmentDraft.countDocuments({ is_deleted: false, created_at: { $gte: since } }),
    Appointment.countDocuments({ is_deleted: false, source: 'chatbot', created_at: { $gte: since } }),
    ChatbotFallback.countDocuments({ is_deleted: false, created_at: { $gte: since } }),
    ChatbotSession.countDocuments({ is_deleted: false, created_at: { $gte: since }, 'context.insights.tags': 'high_intent_lead' }),
    ChatbotMessage.aggregate([
      { $match: { is_deleted: false, 'ai_trace.intent': { $exists: true, $ne: null }, created_at: { $gte: since } } },
      { $group: { _id: '$ai_trace.intent', count: { $sum: 1 }, avg_confidence: { $avg: '$ai_trace.confidence' } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  return {
    kpis: {
      total_sessions: totalSessions,
      today_sessions: todaySessions,
      messages_today: totalMessages,
      handoff_today: handoffSessions,
      emergency_today: emergencySessions,
      open_fallbacks: fallbackCount,
      active_intents: intentCount,
      active_entities: entityCount,
      published_articles: articleCount,
      appointment_drafts_today: draftCount,
      appointments_created_today: appointmentCount,
      self_service_rate: todaySessions ? Number((((todaySessions - handoffSessions) / todaySessions) * 100).toFixed(1)) : 100,
      handoff_rate: todaySessions ? Number(((handoffSessions / todaySessions) * 100).toFixed(1)) : 0,
      fallback_rate: todaySessions ? Number(((todayFallbackCount / todaySessions) * 100).toFixed(1)) : 0,
      booking_conversion_rate: todaySessions ? Number(((appointmentCount / todaySessions) * 100).toFixed(1)) : 0,
      high_intent_leads_today: highIntentLeadCount,
    },
    top_intents: topIntents.map((item) => ({
      intent: item._id,
      count: item.count,
      avg_confidence: Number((item.avg_confidence || 0).toFixed(2)),
    })),
    health: {
      provider: env.aiProvider,
      ai_enabled: env.chatbot.aiEnabled && Boolean(env.geminiApiKey),
      rag_enabled: env.chatbot.ragEnabled,
      safety_enabled: env.chatbot.medicalSafetyEnabled,
      widget_token_required: env.chatbot.widgetTokenRequired,
      vector_store: env.chatbot.vectorStoreProvider,
    },
  };
}

async function listConversations(query = {}) {
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.risk_level) filter.risk_level = query.risk_level;
  if (query.intent) filter.current_intent = query.intent;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ anonymous_id: regex }, { current_intent: regex }, { assigned_queue: regex }];
  }
  const [items, total] = await Promise.all([
    ChatbotSession.find(filter).sort({ last_message_at: -1, created_at: -1 }).skip(skip).limit(limit).lean(),
    ChatbotSession.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function getConversation(sessionId) {
  const session = await getSessionOrThrow(sessionId);
  const [messages, drafts, fallbacks] = await Promise.all([
    ChatbotMessage.find({ session_id: session._id, is_deleted: false }).sort({ created_at: 1 }).lean(),
    ChatbotAppointmentDraft.find({ session_id: session._id, is_deleted: false }).sort({ created_at: -1 }).lean(),
    ChatbotFallback.find({ session_id: session._id, is_deleted: false }).sort({ created_at: -1 }).lean(),
  ]);
  return { session: session.toJSON(), messages, drafts, fallbacks };
}

async function listIntents(query = {}) {
  const { page, limit, skip } = getPagination(query, 50, 200);
  const filter = { is_deleted: false };
  if (query.enabled !== undefined && query.enabled !== '') filter.enabled = query.enabled === 'true' || query.enabled === true;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ code: regex }, { name: regex }, { description: regex }, { examples: regex }];
  }
  const [items, total] = await Promise.all([
    ChatbotIntent.find(filter).sort({ priority: -1, code: 1 }).skip(skip).limit(limit).lean(),
    ChatbotIntent.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function createIntent(payload = {}, actor = {}) {
  const code = normalizeString(payload.code)?.toLowerCase();
  const name = normalizeString(payload.name);
  if (!code || !name) throw createError('code và name là bắt buộc.', 422);
  return ChatbotIntent.create({
    code,
    name,
    description: normalizeString(payload.description),
    examples: Array.isArray(payload.examples) ? payload.examples.map(normalizeString).filter(Boolean) : [],
    enabled: payload.enabled !== false,
    priority: Number(payload.priority || 10),
    created_by: actor.userId,
    updated_by: actor.userId,
  });
}

async function updateIntent(intentId, payload = {}, actor = {}) {
  const intent = await ChatbotIntent.findById(intentId);
  if (!intent || intent.is_deleted) throw createError('Không tìm thấy intent.', 404);
  for (const field of ['name', 'description', 'priority', 'enabled']) {
    if (payload[field] !== undefined) intent[field] = payload[field];
  }
  if (payload.code) intent.code = normalizeString(payload.code).toLowerCase();
  if (Array.isArray(payload.examples)) intent.examples = payload.examples.map(normalizeString).filter(Boolean);
  intent.updated_by = actor.userId;
  await intent.save();
  return intent.toJSON();
}

async function listEntities(query = {}) {
  const { page, limit, skip } = getPagination(query, 50, 200);
  const filter = { is_deleted: false };
  if (query.entity_type) filter.entity_type = query.entity_type;
  if (query.enabled !== undefined && query.enabled !== '') filter.enabled = query.enabled === 'true' || query.enabled === true;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ canonical_value: regex }, { synonyms: regex }, { entity_type: regex }];
  }
  const [items, total] = await Promise.all([
    ChatbotEntityDictionary.find(filter).sort({ entity_type: 1, canonical_value: 1 }).skip(skip).limit(limit).lean(),
    ChatbotEntityDictionary.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function createEntity(payload = {}, actor = {}) {
  const entityType = normalizeString(payload.entity_type || payload.entityType)?.toLowerCase();
  const canonical = normalizeString(payload.canonical_value || payload.canonicalValue);
  if (!entityType || !canonical) throw createError('entity_type và canonical_value là bắt buộc.', 422);
  return ChatbotEntityDictionary.create({
    entity_type: entityType,
    canonical_value: canonical,
    synonyms: Array.isArray(payload.synonyms) ? payload.synonyms.map(normalizeString).filter(Boolean) : [],
    mapped_id: payload.mapped_id && isValidObjectId(payload.mapped_id) ? payload.mapped_id : undefined,
    mapped_model: normalizeString(payload.mapped_model),
    enabled: payload.enabled !== false,
    created_by: actor.userId,
    updated_by: actor.userId,
  });
}

async function updateEntity(entityId, payload = {}, actor = {}) {
  const entity = await ChatbotEntityDictionary.findById(entityId);
  if (!entity || entity.is_deleted) throw createError('Không tìm thấy entity.', 404);
  if (payload.entity_type || payload.entityType) entity.entity_type = normalizeString(payload.entity_type || payload.entityType).toLowerCase();
  if (payload.canonical_value || payload.canonicalValue) entity.canonical_value = normalizeString(payload.canonical_value || payload.canonicalValue);
  if (Array.isArray(payload.synonyms)) entity.synonyms = payload.synonyms.map(normalizeString).filter(Boolean);
  if (payload.enabled !== undefined) entity.enabled = payload.enabled;
  if (payload.mapped_id !== undefined) entity.mapped_id = payload.mapped_id && isValidObjectId(payload.mapped_id) ? payload.mapped_id : undefined;
  if (payload.mapped_model !== undefined) entity.mapped_model = normalizeString(payload.mapped_model);
  entity.updated_by = actor.userId;
  await entity.save();
  return entity.toJSON();
}

async function listKnowledgeArticles(query = {}) {
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = { is_deleted: false };
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ title: regex }, { content: regex }, { keywords: regex }, { category: regex }];
  }
  const [items, total] = await Promise.all([
    KnowledgeArticle.find(filter).sort({ updated_at: -1 }).skip(skip).limit(limit).lean(),
    KnowledgeArticle.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function createKnowledgeArticle(payload = {}, actor = {}) {
  const title = normalizeString(payload.title);
  const content = normalizeString(payload.content);
  const category = normalizeString(payload.category)?.toLowerCase() || 'general';
  if (!title || !content) throw createError('title và content là bắt buộc.', 422);
  return KnowledgeArticle.create({
    title,
    category,
    content,
    keywords: Array.isArray(payload.keywords) ? payload.keywords.map((item) => normalizeText(item)).filter(Boolean) : [],
    branch_id: payload.branch_id && isValidObjectId(payload.branch_id) ? payload.branch_id : undefined,
    department_id: payload.department_id && isValidObjectId(payload.department_id) ? payload.department_id : undefined,
    status: payload.status || 'draft',
    effective_from: payload.effective_from ? new Date(payload.effective_from) : undefined,
    effective_to: payload.effective_to ? new Date(payload.effective_to) : undefined,
    source_url: normalizeString(payload.source_url),
    created_by: actor.userId,
    updated_by: actor.userId,
  });
}

async function updateKnowledgeArticle(articleId, payload = {}, actor = {}) {
  const article = await KnowledgeArticle.findById(articleId);
  if (!article || article.is_deleted) throw createError('Không tìm thấy knowledge article.', 404);
  for (const field of ['title', 'content', 'category', 'status', 'source_url']) {
    if (payload[field] !== undefined) article[field] = field === 'category' ? normalizeString(payload[field]).toLowerCase() : payload[field];
  }
  if (Array.isArray(payload.keywords)) article.keywords = payload.keywords.map((item) => normalizeText(item)).filter(Boolean);
  if (payload.effective_from !== undefined) article.effective_from = payload.effective_from ? new Date(payload.effective_from) : undefined;
  if (payload.effective_to !== undefined) article.effective_to = payload.effective_to ? new Date(payload.effective_to) : undefined;
  article.updated_by = actor.userId;
  await article.save();
  return article.toJSON();
}

async function publishKnowledgeArticle(articleId, actor = {}) {
  const article = await KnowledgeArticle.findById(articleId);
  if (!article || article.is_deleted) throw createError('Không tìm thấy knowledge article.', 404);
  article.status = 'published';
  article.approved_by = actor.userId;
  article.approved_at = new Date();
  article.updated_by = actor.userId;
  await article.save();
  return article.toJSON();
}

async function archiveKnowledgeArticle(articleId, actor = {}) {
  const article = await KnowledgeArticle.findById(articleId);
  if (!article || article.is_deleted) throw createError('Không tìm thấy knowledge article.', 404);
  article.status = 'archived';
  article.updated_by = actor.userId;
  await article.save();
  return article.toJSON();
}

async function reindexKnowledge() {
  return {
    provider: env.chatbot.vectorStoreProvider,
    index_name: env.chatbot.vectorIndexName,
    applied: true,
    message: 'MongoDB text index/RAG-lite đã sẵn sàng. Vector embedding thật có thể bật ở phase tiếp theo.',
  };
}

async function listFallbacks(query = {}) {
  const { page, limit, skip } = getPagination(query, 30, 100);
  const filter = { is_deleted: false };
  if (query.resolved === 'true') filter.resolved_at = { $exists: true };
  if (query.resolved === 'false') filter.resolved_at = { $exists: false };
  if (query.intent) filter.predicted_intent = query.intent;
  if (query.search) filter.user_text = { $regex: escapeRegex(query.search), $options: 'i' };
  const [items, total] = await Promise.all([
    ChatbotFallback.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ChatbotFallback.countDocuments(filter),
  ]);
  return { items, pagination: buildPagination(page, limit, total) };
}

async function resolveFallback(fallbackId, payload = {}, actor = {}) {
  const fallback = await ChatbotFallback.findById(fallbackId);
  if (!fallback || fallback.is_deleted) throw createError('Không tìm thấy fallback.', 404);
  fallback.corrected_intent = normalizeString(payload.corrected_intent || payload.intent) || fallback.corrected_intent;
  fallback.corrected_entities = payload.corrected_entities || payload.entities || fallback.corrected_entities;
  fallback.added_to_training = payload.added_to_training !== undefined ? payload.added_to_training : fallback.added_to_training;
  fallback.resolved_at = new Date();
  fallback.resolved_by = actor.userId;
  fallback.updated_by = actor.userId;
  await fallback.save();

  if (fallback.added_to_training && fallback.corrected_intent) {
    await ChatbotIntent.updateOne(
      { code: fallback.corrected_intent, is_deleted: false },
      { $addToSet: { examples: fallback.user_text }, $setOnInsert: { name: fallback.corrected_intent, enabled: true } },
      { upsert: true },
    );
  }

  return fallback.toJSON();
}

async function testChatbot(payload = {}) {
  await ensureDefaultTraining();
  const fakeSession = {
    current_intent: payload.current_intent,
    current_step: payload.current_step,
    source_page: '/admin/support-communication/ai-chatbot',
    context: payload.context || { booking: {}, fallback_count: 0, ai_call_count: 0 },
    save: async () => null,
  };
  const analysis = await analyzeMessage(payload.text || payload.message || '', fakeSession, []);
  const reply = await buildBotReply(fakeSession, analysis, payload.text || payload.message || '', null);
  return { analysis, reply, context: fakeSession.context };
}

module.exports = {
  createSession,
  getSession,
  listMessages,
  handleMessage,
  escalateSession,
  acceptHandoff,
  closeSession,
  getDashboard,
  listConversations,
  getConversation,
  listIntents,
  createIntent,
  updateIntent,
  listEntities,
  createEntity,
  updateEntity,
  listKnowledgeArticles,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  publishKnowledgeArticle,
  archiveKnowledgeArticle,
  reindexKnowledge,
  listFallbacks,
  resolveFallback,
  testChatbot,
};
