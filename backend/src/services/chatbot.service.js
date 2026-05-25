const { randomBytes } = require('crypto');
const env = require('../config/env');
const {
  ChatbotAppointmentDraft,
  ChatbotEntityDictionary,
  ChatbotFallback,
  ChatbotIntent,
  ChatbotMessage,
  ChatbotSession,
  Department,
  DoctorProfile,
  DoctorSchedule,
  FacilityLocation,
  KnowledgeArticle,
  ScheduleSlot,
  ServiceCatalog,
  ServicePriceVersion,
  User,
} = require('../models');
const scheduleService = require('./schedule.service');
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

const DEFAULT_INTENTS = [
  ['greeting', 'Chào hỏi', ['xin chào', 'alo', 'có ai không', 'hello']],
  ['thanks', 'Cảm ơn', ['cảm ơn', 'thank you', 'ok cảm ơn']],
  ['goodbye', 'Tạm biệt', ['tạm biệt', 'hẹn gặp lại']],
  ['book_appointment', 'Đặt lịch khám', ['tôi muốn đặt lịch', 'đặt khám giúp tôi', 'tôi muốn khám da liễu chiều mai']],
  ['ask_available_slots', 'Hỏi lịch trống', ['mai còn lịch không', 'bác sĩ nào còn lịch hôm nay', 'xem lịch trống']],
  ['reschedule_appointment', 'Đổi lịch', ['tôi muốn đổi lịch', 'dời lịch hẹn', 'đổi giờ khám']],
  ['cancel_appointment', 'Hủy lịch', ['tôi muốn hủy lịch', 'hủy lịch hẹn']],
  ['find_department', 'Tìm chuyên khoa', ['tôi nên khám khoa nào', 'có khoa tiêu hóa không']],
  ['find_doctor', 'Tìm bác sĩ', ['bác sĩ tim mạch nào còn lịch', 'tìm bác sĩ da liễu']],
  ['find_service', 'Tìm dịch vụ', ['có xét nghiệm máu không', 'khám tổng quát gồm gì']],
  ['ask_symptom_department', 'Định hướng chuyên khoa theo triệu chứng', ['tôi đau bụng', 'tôi bị nổi mẩn', 'đau ngực nên khám gì']],
  ['emergency', 'Cấp cứu', ['đau ngực dữ dội khó thở', 'co giật', 'chảy máu nhiều']],
  ['ask_price', 'Hỏi giá', ['khám da liễu bao nhiêu tiền', 'phí khám tổng quát']],
  ['ask_payment', 'Thanh toán', ['có thanh toán QR không', 'tôi chuyển khoản rồi']],
  ['ask_insurance', 'Bảo hiểm', ['có nhận BHYT không', 'bảo hiểm tư nhân có dùng được không']],
  ['ask_patient_portal', 'Cổng bệnh nhân', ['quên mật khẩu', 'xem hóa đơn ở đâu', 'xem kết quả xét nghiệm']],
  ['human_support', 'Gặp nhân viên', ['cho tôi gặp nhân viên', 'gọi lại cho tôi']],
  ['complaint', 'Khiếu nại/góp ý', ['tôi muốn khiếu nại', 'góp ý dịch vụ']],
];

const DEFAULT_ENTITIES = [
  ['department', 'Tiêu hóa', ['tiêu hóa', 'bao tử', 'dạ dày', 'đau bụng', 'trào ngược', 'rối loạn tiêu hóa']],
  ['department', 'Da liễu', ['da liễu', 'mụn', 'nổi mẩn', 'dị ứng da', 'ngứa', 'phát ban']],
  ['department', 'Tim mạch', ['tim mạch', 'đau ngực', 'hồi hộp', 'huyết áp', 'khó thở']],
  ['department', 'Nhi khoa', ['nhi', 'trẻ em', 'con tôi', 'bé', 'sốt trẻ em']],
  ['department', 'Sản phụ khoa', ['sản', 'phụ khoa', 'thai', 'mang thai', 'ra máu khi mang thai']],
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
  ['pregnancy', ['thai phụ ra máu', 'mang thai ra máu', 'ra máu khi mang thai']],
  ['self_harm', ['tự tử', 'tu tu', 'tự hại', 'tu hai', 'muốn chết']],
];

const MEDICAL_BLOCK_PATTERNS = [
  ['prescription', ['kê thuốc', 'ke thuoc', 'uống thuốc gì', 'uong thuoc gi', 'thuốc gì']],
  ['dosage', ['liều', 'lieu', 'bao nhiêu viên', 'mấy viên', 'mg/ngày']],
  ['stop_medication', ['ngừng thuốc', 'ngung thuoc', 'dừng thuốc', 'dung thuoc']],
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
  reschedule_appointment: ['doi lich', 'doi gio', 'doi ngay', 'doi khung gio', 'doi appointment', 'doi hen'],
  cancel_appointment: ['huy lich', 'huy hen', 'cancel'],
  find_department: ['khoa nao', 'chuyen khoa nao', 'co khoa', 'tim khoa', 'kham khoa'],
  find_doctor: ['bac si', 'doctor', 'bs.', 'bs '],
  find_service: ['dich vu', 'xet nghiem', 'sieu am', 'noi soi', 'goi kham'],
  ask_symptom_department: ['dau', 'sot', 'ngua', 'noi man', 'phat ban', 'kho tho', 'dau bung', 'dau dau', 'met moi'],
  ask_price: ['gia', 'phi', 'bao nhieu tien', 'chi phi', 'bang gia'],
  ask_payment: ['thanh toan', 'qr', 'chuyen khoan', 'hoa don', 'bien lai'],
  ask_insurance: ['bhyt', 'bao hiem', 'bao lanh vien phi'],
  ask_patient_portal: ['portal', 'dang nhap', 'quen mat khau', 'ho so', 'ket qua', 'upload', 'cccd'],
  human_support: ['gap nhan vien', 'nhan vien tu van', 'goi lai', 'hotline', 'nguoi that'],
  complaint: ['khieu nai', 'gop y', 'phan anh', 'khong hai long'],
};

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

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
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
    'system prompt',
    'developer message',
    'jailbreak',
    'viet lai prompt',
    'xoa quy tac',
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
    date_text: date ? String(text).match(/hôm nay|hom nay|ngày mai|ngay mai|mai|ngày kia|ngay kia|\d{1,2}\/\d{1,2}(?:\/\d{4})?|\d{4}-\d{1,2}-\d{1,2}/i)?.[0] || null : null,
    date_iso: date ? formatLocalDateIso(date) : null,
    time_preference: detectTimePreference(text),
    phone: detectPhone(text),
    email: detectEmail(text),
    patient_name: detectNameFromText(text),
  });

  const redFlags = env.chatbot.redFlagDetectionEnabled ? detectPatterns(normalized, RED_FLAG_PATTERNS) : [];
  const medicalBlocks = env.chatbot.medicalSafetyEnabled ? detectPatterns(normalized, MEDICAL_BLOCK_PATTERNS) : [];
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

  if (medicalBlocks.length) {
    return {
      intent: 'medical_safety_block',
      confidence: 0.95,
      language: 'vi',
      entities,
      risk_level: 'medium',
      red_flags: [],
      medical_blocks: medicalBlocks,
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
  if (intent === 'book_appointment' || intent === 'ask_available_slots') {
    if (missingFields.includes('department') && !entities.doctor) return 'ask_department';
    if (missingFields.includes('date')) return 'ask_date';
    return 'find_available_slots';
  }
  if (intent === 'find_doctor') return 'search_doctors';
  if (intent === 'find_department' || intent === 'ask_symptom_department') return 'suggest_departments';
  if (intent === 'find_service') return 'search_services';
  if (intent === 'ask_price') return 'search_price';
  if (intent === 'ask_payment' || intent === 'ask_insurance' || intent === 'ask_patient_portal') return 'answer_kb';
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
    'Schema: {"intent":"book_appointment|ask_available_slots|find_department|find_doctor|find_service|ask_symptom_department|emergency|ask_price|ask_payment|ask_insurance|ask_patient_portal|human_support|complaint|greeting|thanks|goodbye|unknown","confidence":0.0,"language":"vi|en","entities":{"patient_name":null,"phone":null,"email":null,"date_text":null,"date_iso":null,"time_text":null,"time_preference":null,"department":null,"doctor":null,"service":null,"branch":null,"symptoms":[],"appointment_code":null,"invoice_code":null},"risk_level":"low|medium|high|emergency","red_flags":[],"needs_human":false,"next_action":"find_available_slots|ask_department|ask_date|search_doctors|search_services|search_price|answer_kb|handoff|fallback|show_emergency","missing_fields":[]}',
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

function welcomePayload() {
  return {
    type: 'quick_replies',
    quick_replies: buildQuickReplies([
      { label: 'Đặt lịch khám', value: 'Tôi muốn đặt lịch khám' },
      { label: 'Tìm chuyên khoa', value: 'Tôi nên khám chuyên khoa nào?' },
      { label: 'Tìm bác sĩ', value: 'Tôi muốn tìm bác sĩ' },
      { label: 'Hỏi giá dịch vụ', value: 'Khám tổng quát bao nhiêu tiền?' },
      { label: 'Bảo hiểm', value: 'Có nhận BHYT không?' },
      { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên tư vấn' },
      { label: 'Cấp cứu', value: 'Tôi cần cấp cứu' },
    ]),
  };
}

function buildWelcomeMessage(sourcePage = '') {
  const suffix = sourcePage ? ' Em đang theo ngữ cảnh trang hiện tại để hỗ trợ nhanh hơn.' : '';
  return botText(
    `Xin chào anh/chị, em là ${env.chatbot.botDisplayName}. Em có thể hỗ trợ đặt lịch, tìm chuyên khoa/bác sĩ, hỏi thông tin dịch vụ, bảo hiểm, thanh toán hoặc chuyển nhân viên tư vấn.${suffix}`,
    welcomePayload(),
  );
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
  const language = normalizeString(payload.language) || env.chatbot.defaultLanguage || DEFAULT_LANGUAGE;
  const session = await ChatbotSession.create({
    channel: payload.channel || 'website',
    source_page: sourcePage,
    anonymous_id: payload.anonymous_id || payload.anonymousId || meta.deviceId || randomBytes(8).toString('hex'),
    patient_id: actor?.patientId,
    status: 'active',
    language,
    risk_level: 'low',
    context: {
      booking: {},
      fallback_count: 0,
      ai_call_count: 0,
    },
    metadata: {
      ip: getMetaIp(meta),
      user_agent: meta.userAgent,
      referrer: payload.referrer || payload.referrer_url,
      source_page: sourcePage,
    },
    last_message_at: new Date(),
    expires_at: sessionExpiresAt(),
  });

  const welcome = buildWelcomeMessage(sourcePage);
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
          doctor_name: doctor?.full_name || 'Bác sĩ',
          department_name: department?.department_name || entities.department || 'Chuyên khoa',
          specialty: profile?.specialty,
          fee_display: formatMoney(profile?.consultation_fee),
          remaining: 1,
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
    if (intent === 'ask_payment' && article.category === 'payment') score += 3;
    if (intent === 'ask_insurance' && article.category === 'insurance') score += 3;
    if (intent === 'ask_patient_portal' && article.category === 'portal') score += 3;
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
  const content = sources[0].content;
  const clipped = content.length > 620 ? `${content.slice(0, 620)}...` : content;
  return `Dạ, theo thông tin hiện có: ${clipped}`;
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
  if (!mergedBooking.department_id && !mergedBooking.department && !mergedBooking.doctor_id && !mergedBooking.doctor) {
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
    `Dạ, ${mergedBooking.date_iso ? `ngày ${formatDate(`${mergedBooking.date_iso}T00:00:00`)}` : 'thời gian anh/chị chọn'} còn các khung giờ sau. Anh/chị chọn một khung giờ để em giữ thông tin đặt lịch nhé.`,
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
  return botText(
    `Dạ, em đã chọn khung ${slot.time} ngày ${slot.date} với ${slot.doctor_name}. Anh/chị cho em xin họ tên và số điện thoại để lập phiếu yêu cầu đặt lịch ạ.`,
    {
      type: 'booking_form',
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

async function createAppointmentDraftFromSession(session) {
  const booking = session.context?.booking || {};
  const slot = booking.selected_slot || {};
  if (!slot.appointment_time || !booking.patient_name || !booking.phone) {
    throw createError('Thiếu thông tin để tạo phiếu đặt lịch.', 422);
  }
  const draftCode = `CB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const draft = await ChatbotAppointmentDraft.create({
    session_id: session._id,
    draft_code: draftCode,
    status: 'pending_staff_confirmation',
    patient_name: booking.patient_name,
    phone: booking.phone,
    department_id: slot.department_id,
    doctor_id: slot.doctor_id,
    doctor_schedule_id: slot.doctor_schedule_id,
    appointment_time: slot.appointment_time,
    selected_slot: slot,
    symptoms_note: booking.symptoms_note || booking.note,
    confirmation_snapshot: {
      patient_name: booking.patient_name,
      phone: maskPhone(booking.phone),
      department_name: slot.department_name,
      doctor_name: slot.doctor_name,
      date: slot.date,
      time: slot.time,
      fee_display: slot.fee_display,
    },
    expires_at: draftExpiresAt(),
  });
  session.context = {
    ...(session.context || {}),
    booking: {
      ...booking,
      appointment_draft_id: toId(draft._id),
      appointment_draft_code: draftCode,
    },
  };
  session.current_step = 'booking_pending_staff_confirmation';
  await session.save();
  return draft;
}

async function confirmBookingResponse(session) {
  const draft = await createAppointmentDraftFromSession(session);
  return botText(
    `Em đã ghi nhận yêu cầu đặt lịch của anh/chị. Mã yêu cầu là ${draft.draft_code}. Nhân viên sẽ kiểm tra slot và xác nhận chính thức trong khoảng ${env.chatbot.handoffExpectedWaitMinutes} phút. Khi đi khám, anh/chị vui lòng đến trước 15 phút và mang CCCD/BHYT nếu có.`,
    {
      type: 'handoff_notice',
      draft: draft.toJSON(),
      queue: env.chatbot.handoffQueueAppointment,
      actions: buildQuickReplies([
        { label: 'Xem hướng dẫn đi khám', value: 'Tôi cần mang giấy tờ gì khi đi khám?' },
        { label: 'Gặp nhân viên', value: 'Cho tôi gặp nhân viên đặt lịch' },
      ]),
    },
  );
}

async function handoffResponse(session, reason = 'user_request') {
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
  await session.save();
  return botText(
    `Dạ, nội dung này cần nhân viên tư vấn kiểm tra thêm. Em sẽ chuyển anh/chị đến bộ phận hỗ trợ. Thời gian phản hồi dự kiến khoảng ${env.chatbot.handoffExpectedWaitMinutes} phút.`,
    {
      type: 'handoff_notice',
      queue,
      reason,
      expected_wait_minutes: env.chatbot.handoffExpectedWaitMinutes,
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

async function buildBotReply(session, analysis, text, userMessage = null) {
  mergeBookingContext(session, analysis);
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
  if (analysis.intent === 'greeting') return buildWelcomeMessage(session.source_page);
  if (analysis.intent === 'thanks') return botText('Dạ, em luôn sẵn sàng hỗ trợ anh/chị đặt lịch, tìm bác sĩ hoặc gặp nhân viên tư vấn khi cần.');
  if (analysis.intent === 'goodbye') return botText('Dạ, cảm ơn anh/chị. Chúc anh/chị nhiều sức khỏe.');
  if (analysis.intent === 'human_support' || analysis.intent === 'complaint') return handoffResponse(session, analysis.intent === 'complaint' ? 'complaint' : 'user_request');
  if (analysis.intent === 'ask_price') return buildPriceResponse(analysis, text);
  if (analysis.intent === 'find_doctor') return doctorSearchResponse(analysis, text);
  if (analysis.intent === 'find_service') return serviceSearchResponse(analysis, text);
  if (['find_department', 'ask_symptom_department'].includes(analysis.intent) && analysis.next_action !== 'find_available_slots') {
    return departmentSuggestionResponse(analysis, text);
  }
  if (['book_appointment', 'ask_available_slots', 'ask_symptom_department'].includes(analysis.intent)) {
    return slotPickerResponse(analysis, session, text);
  }
  if (['ask_payment', 'ask_insurance', 'ask_patient_portal'].includes(analysis.intent)) {
    return kbResponse(analysis, text);
  }

  return fallbackResponse(session, analysis, text, userMessage);
}

function normalizeSlotAction(action = {}) {
  if (action.type !== 'select_slot' || !action.slot) return null;
  return action.slot;
}

async function handleAction(session, payload = {}) {
  const action = payload.action || {};
  const context = session.context || {};
  const booking = context.booking || {};

  if (action.type === 'select_slot') {
    const slot = normalizeSlotAction(action);
    if (!slot) throw createError('slot không hợp lệ.', 422);
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
      },
    };
    session.current_intent = 'book_appointment';
    session.current_step = 'collect_identity';
    await session.save();
    return bookingFormResponse(slot);
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

  if (action.type === 'confirm_booking') {
    return confirmBookingResponse(session);
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
  let reply = await handleAction(session, payload);
  if (!reply) {
    analysis = await analyzeMessage(rawText, session, history.reverse());
    reply = await buildBotReply(session, analysis, rawText, userMessage);
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
      self_service_rate: todaySessions ? Number((((todaySessions - handoffSessions) / todaySessions) * 100).toFixed(1)) : 100,
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
