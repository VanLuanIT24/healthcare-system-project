const DEFAULT_SCHEDULE_TYPE = 'Khám chuyên khoa';

const scheduleTypeCatalog = [
  {
    value: 'Khám chuyên khoa',
    label: 'Khám chuyên khoa',
    description: 'Khám mới, khám định kỳ tại phòng khám chuyên khoa.',
    badge: 'Ngoại trú',
    price: 23000,
    patient_portal_enabled: true,
    staff_only: false,
    return_visit_priority: false,
    suggested_duration_minutes: 15,
  },
  {
    value: 'Tái khám',
    label: 'Tái khám',
    description: 'Theo dõi sau điều trị, sau xuất viện hoặc theo hẹn bác sĩ.',
    badge: 'Theo hồ sơ',
    price: 18000,
    patient_portal_enabled: true,
    staff_only: false,
    return_visit_priority: true,
    suggested_duration_minutes: 15,
  },
  {
    value: 'Tư vấn từ xa',
    label: 'Tư vấn từ xa',
    description: 'Tư vấn qua video, điện thoại hoặc cổng bệnh nhân.',
    badge: 'Telehealth',
    price: 15000,
    patient_portal_enabled: true,
    staff_only: false,
    return_visit_priority: false,
    suggested_duration_minutes: 20,
  },
  {
    value: 'Khám sức khỏe định kỳ',
    label: 'Khám sức khỏe định kỳ',
    description: 'Lịch gói khám cá nhân, doanh nghiệp hoặc khám định kỳ.',
    badge: 'Gói khám',
    price: 20000,
    patient_portal_enabled: true,
    staff_only: false,
    return_visit_priority: false,
    suggested_duration_minutes: 15,
  },
  {
    value: 'Khám ngoài giờ',
    label: 'Khám ngoài giờ',
    description: 'Ca khám tối, cuối tuần hoặc ngày lễ có quy tắc vận hành riêng.',
    badge: 'Ngoài giờ',
    price: 30000,
    patient_portal_enabled: true,
    staff_only: false,
    return_visit_priority: false,
    suggested_duration_minutes: 15,
  },
  {
    value: 'Thủ thuật / tiểu phẫu',
    label: 'Thủ thuật / tiểu phẫu',
    description: 'Thủ thuật tại phòng chuyên môn, cần chuẩn bị phòng và ekip.',
    badge: 'Thủ thuật',
    price: 65000,
    patient_portal_enabled: true,
    staff_only: false,
    return_visit_priority: false,
    suggested_duration_minutes: 30,
  },
  {
    value: 'Chẩn đoán hình ảnh',
    label: 'Chẩn đoán hình ảnh',
    description: 'Siêu âm, X-quang, CT, MRI hoặc lịch sử dụng phòng máy.',
    badge: 'Cận lâm sàng',
    price: 45000,
    patient_portal_enabled: true,
    staff_only: false,
    return_visit_priority: false,
    suggested_duration_minutes: 20,
  },
  {
    value: 'Xét nghiệm / lấy mẫu',
    label: 'Xét nghiệm / lấy mẫu',
    description: 'Lấy mẫu, xét nghiệm theo khung giờ hoặc theo phòng lấy mẫu.',
    badge: 'Cận lâm sàng',
    price: 12000,
    patient_portal_enabled: true,
    staff_only: false,
    return_visit_priority: false,
    suggested_duration_minutes: 10,
  },
  {
    value: 'Hội chẩn chuyên khoa',
    label: 'Hội chẩn chuyên khoa',
    description: 'Lịch hội chẩn nội bộ cho ca bệnh cần phối hợp nhiều chuyên khoa.',
    badge: 'Nội bộ',
    price: 0,
    patient_portal_enabled: false,
    staff_only: true,
    return_visit_priority: false,
    suggested_duration_minutes: 30,
  },
  {
    value: 'Trực cấp cứu',
    label: 'Trực cấp cứu',
    description: 'Ca trực tiếp nhận cấp cứu và xử trí ban đầu 24/7.',
    badge: 'Trực ca',
    price: 0,
    patient_portal_enabled: false,
    staff_only: true,
    return_visit_priority: false,
    suggested_duration_minutes: 30,
  },
  {
    value: 'Trực nội trú',
    label: 'Trực nội trú',
    description: 'Theo dõi buồng bệnh, hội chẩn và xử lý phát sinh nội trú.',
    badge: 'Nội trú',
    price: 0,
    patient_portal_enabled: false,
    staff_only: true,
    return_visit_priority: false,
    suggested_duration_minutes: 30,
  },
  {
    value: 'Trực đêm',
    label: 'Trực đêm',
    description: 'Ca trực đêm vận hành bệnh viện, không mở đặt khám đại trà.',
    badge: 'Qua đêm',
    price: 0,
    patient_portal_enabled: false,
    staff_only: true,
    return_visit_priority: false,
    suggested_duration_minutes: 30,
  },
];

const scheduleTypeByValue = new Map(scheduleTypeCatalog.map((item) => [item.value, item]));

const legacyScheduleTypeMap = new Map(
  [
    ['Lịch khám', 'Khám chuyên khoa'],
    ['Kham chuyen khoa', 'Khám chuyên khoa'],
    ['Khám mới', 'Khám chuyên khoa'],
    ['Kham moi', 'Khám chuyên khoa'],
    ['Tái khám', 'Tái khám'],
    ['Tai kham', 'Tái khám'],
    ['Tư vấn', 'Tư vấn từ xa'],
    ['Tu van', 'Tư vấn từ xa'],
    ['Tư vấn online', 'Tư vấn từ xa'],
    ['Tu van online', 'Tư vấn từ xa'],
    ['Telehealth', 'Tư vấn từ xa'],
    ['Khám ngoài giờ', 'Khám ngoài giờ'],
    ['Kham ngoai gio', 'Khám ngoài giờ'],
    ['Thủ thuật', 'Thủ thuật / tiểu phẫu'],
    ['Thu thuat', 'Thủ thuật / tiểu phẫu'],
    ['Thủ thuật / tiểu phẫu', 'Thủ thuật / tiểu phẫu'],
    ['Chẩn đoán hình ảnh', 'Chẩn đoán hình ảnh'],
    ['Chan doan hinh anh', 'Chẩn đoán hình ảnh'],
    ['Xét nghiệm', 'Xét nghiệm / lấy mẫu'],
    ['Xet nghiem', 'Xét nghiệm / lấy mẫu'],
    ['Xét nghiệm / lấy mẫu', 'Xét nghiệm / lấy mẫu'],
    ['Hội chẩn', 'Hội chẩn chuyên khoa'],
    ['Hoi chan', 'Hội chẩn chuyên khoa'],
    ['Hội chẩn chuyên khoa', 'Hội chẩn chuyên khoa'],
    ['Trực cấp cứu', 'Trực cấp cứu'],
    ['Truc cap cuu', 'Trực cấp cứu'],
    ['Trực nội trú', 'Trực nội trú'],
    ['Truc noi tru', 'Trực nội trú'],
    ['Trực đêm', 'Trực đêm'],
    ['Truc dem', 'Trực đêm'],
  ].map(([key, value]) => [key.toLowerCase(), value]),
);

function normalizeScheduleType(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_SCHEDULE_TYPE;
  if (scheduleTypeByValue.has(raw)) return raw;
  return legacyScheduleTypeMap.get(raw.toLowerCase()) || DEFAULT_SCHEDULE_TYPE;
}

function getScheduleTypeDefinition(value) {
  return scheduleTypeByValue.get(normalizeScheduleType(value)) || scheduleTypeByValue.get(DEFAULT_SCHEDULE_TYPE);
}

function getScheduleTypeCatalog() {
  return scheduleTypeCatalog.map((item) => ({ ...item }));
}

module.exports = {
  DEFAULT_SCHEDULE_TYPE,
  getScheduleTypeCatalog,
  getScheduleTypeDefinition,
  normalizeScheduleType,
  scheduleTypeCatalog,
};
