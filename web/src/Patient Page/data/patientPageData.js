export const navItems = [
  { key: 'dashboard', icon: 'dashboard', label: 'Tổng quan' },
  { key: 'trends', icon: 'insights', label: 'Xu hướng sức khỏe' },
  { key: 'medications', icon: 'medication', label: 'Theo dõi thuốc' },
  { key: 'directory', icon: 'medical_services', label: 'Danh bạ phòng khám' },
  { key: 'notifications', icon: 'notifications', label: 'Thông báo' },
  { key: 'messages', icon: 'forum', label: 'Tin nhắn' },
  { key: 'documents', icon: 'description', label: 'Kho tài liệu' },
  { key: 'appointments', icon: 'calendar_today', label: 'Lịch hẹn' },
  { key: 'history', icon: 'history_edu', label: 'Lịch sử khám' },
  { key: 'billing', icon: 'payments', label: 'Thanh toán' },
  { key: 'profile', icon: 'help_clinic', label: 'Hồ sơ' },
]

export const utilityItems = [
  { key: 'profile', icon: 'settings', label: 'Cài đặt' },
  { key: 'support', icon: 'help_outline', label: 'Hỗ trợ' },
]

export const metrics = [
  { label: 'Huyết áp', value: '120/80', unit: 'mmHg', state: 'Bình thường', tone: 'good' },
  { label: 'Nhịp tim', value: '72', unit: 'bpm', state: 'Ổn định', tone: 'good' },
  { label: 'Chỉ số BMI', value: '22.4', unit: 'kg/m²', state: 'Lý tưởng', tone: 'soft' },
]

export const healthTrendMetrics = [
  {
    id: 'blood-pressure',
    icon: 'monitor_heart',
    tone: 'primary',
    label: 'Huyết áp',
    badge: 'Tối ưu',
    badgeTone: 'good',
    value: '120',
    accent: '/',
    secondaryValue: '80',
    unit: 'mmHg',
    note: 'Đo lần cuối 2 giờ trước',
    trend: 'Ổn định từ tháng trước',
    trendIcon: 'trending_flat',
    trendTone: 'good',
  },
  {
    id: 'heart-rate',
    icon: 'favorite',
    tone: 'danger',
    label: 'Nhịp tim',
    badge: 'Nghỉ ngơi',
    badgeTone: 'soft',
    value: '72',
    unit: 'bpm',
    note: 'Trung bình: 68 - 75 bpm',
    trend: 'Thấp hơn 4% so với tuần trước',
    trendIcon: 'trending_down',
    trendTone: 'primary',
  },
  {
    id: 'bmi',
    icon: 'accessibility_new',
    tone: 'secondary',
    label: 'Chỉ số BMI',
    badge: 'Khỏe mạnh',
    badgeTone: 'good',
    value: '22.4',
    unit: '',
    note: 'Chiều cao: 182 cm | Cân nặng: 74 kg',
    trend: 'Trong ngưỡng mục tiêu (18,5 - 24,9)',
    trendIcon: 'check_circle',
    trendTone: 'good',
  },
]

export const healthTrendChartFilters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'bp', label: 'Huyết áp' },
  { key: 'hr', label: 'Nhịp tim' },
]

export const healthTrendSeries = [
  { month: 'Th1', bp: 72, hr: 54 },
  { month: 'Th2', bp: 78, hr: 60 },
  { month: 'Th3', bp: 84, hr: 68 },
  { month: 'Th4', bp: 70, hr: 46 },
  { month: 'Th5', bp: 90, hr: 74 },
  { month: 'Th6', bp: 80, hr: 62 },
]

export const healthRecommendations = {
  title: 'Khuyến nghị sức khỏe',
  body:
    'Dựa trên xu hướng huyết áp gần đây, chúng tôi khuyến nghị bạn tăng cường uống nước và kiểm soát lượng muối trong bữa ăn hằng ngày.',
  action: 'Xem kế hoạch hành động',
}

export const upcomingTests = [
  {
    id: 'test-1',
    icon: 'biotech',
    tone: 'soft',
    title: 'Xét nghiệm mỡ máu',
    subtitle: 'Dự kiến vào ngày 14/09/2023',
  },
  {
    id: 'test-2',
    icon: 'ecg_heart',
    tone: 'mint',
    title: 'Nghiệm pháp gắng sức',
    subtitle: 'Sẵn sàng để đặt lịch',
  },
]

export const historicalBiometrics = [
  {
    id: 'bio-1',
    date: '24/06/2023',
    category: 'Huyết áp',
    value: '118/78 mmHg',
    status: 'Tối ưu',
    tone: 'good',
    clinician: 'BS. Marcus Thorne',
  },
  {
    id: 'bio-2',
    date: '12/06/2023',
    category: 'Nhịp tim',
    value: '74 bpm',
    status: 'Tối ưu',
    tone: 'good',
    clinician: 'Tự cập nhật',
  },
  {
    id: 'bio-3',
    date: '28/05/2023',
    category: 'Huyết áp',
    value: '126/82 mmHg',
    status: 'Bình thường',
    tone: 'soft',
    clinician: 'BS. Marcus Thorne',
  },
  {
    id: 'bio-4',
    date: '15/05/2023',
    category: 'Cân nặng',
    value: '74.2 kg',
    status: 'Khỏe mạnh',
    tone: 'good',
    clinician: 'Cổng thông tin lâm sàng',
  },
]

export const medicationSchedule = [
  {
    id: 'dose-1',
    medicationId: 'amoxicillin',
    icon: 'wb_sunny',
    time: '08:00',
    label: 'Buổi sáng',
    name: 'Amoxicillin',
    dose: '500 mg',
    note: 'Uống sau bữa sáng theo đợt kháng sinh',
    taken: true,
  },
  {
    id: 'dose-2',
    medicationId: 'paracetamol',
    icon: 'light_mode',
    time: '13:00',
    label: 'Buổi trưa',
    name: 'Paracetamol',
    dose: '500 mg',
    note: 'Giảm đau khi cần thiết',
    taken: false,
  },
  {
    id: 'dose-3',
    medicationId: 'amoxicillin',
    icon: 'wb_twilight',
    time: '19:00',
    label: 'Buổi tối',
    name: 'Amoxicillin',
    dose: '500 mg',
    note: 'Liều sau bữa tối',
    taken: true,
  },
  {
    id: 'dose-4',
    medicationId: 'melatonin',
    icon: 'bedtime',
    time: '22:00',
    label: 'Trước ngủ',
    name: 'Melatonin',
    dose: '3 mg',
    note: 'Hỗ trợ điều hòa giấc ngủ',
    taken: false,
  },
]

export const medicationInsights = {
  amoxicillin: {
    id: 'amoxicillin',
    name: 'Amoxicillin',
    classLabel: 'NHÓM KHÁNG SINH',
    prescribedBy: 'Kê đơn bởi BS. Vance',
    dosageBody:
      '500 mg mỗi liều, uống 2 lần mỗi ngày với một cốc nước đầy. Cần dùng đủ liệu trình 10 ngày ngay cả khi triệu chứng đã giảm.',
    timingTitle: 'Khung giờ dùng thuốc',
    timingBody: 'Duy trì uống lúc 08:00 và 19:00 để giữ nồng độ thuốc ổn định.',
    sideEffects: ['Buồn nôn', 'Chóng mặt nhẹ', 'Khó chịu tiêu hóa'],
    completionLabel: 'Tiến độ toa thuốc',
    completionTitle: 'Amoxicillin',
    completionPercent: 80,
    completionNote: 'Còn 8 ngày trong liệu trình 10 ngày',
  },
  paracetamol: {
    id: 'paracetamol',
    name: 'Paracetamol',
    classLabel: 'NHÓM GIẢM ĐAU',
    prescribedBy: 'Kê đơn bởi BS. Vance',
    dosageBody:
      '500 mg mỗi liều, uống sau ăn khi xuất hiện đau đầu hoặc đau nhức cơ thể. Không vượt quá giới hạn dùng trong ngày.',
    timingTitle: 'Khoảng cách liều',
    timingBody: 'Giãn cách tối thiểu 6 giờ giữa các lần dùng và chỉ ghi nhận khi thực sự có triệu chứng.',
    sideEffects: ['Khô miệng', 'Buồn ngủ nhẹ', 'Cồn cào dạ dày'],
    completionLabel: 'Kế hoạch giảm đau',
    completionTitle: 'Paracetamol',
    completionPercent: 46,
    completionNote: 'Toa dùng khi cần còn hiệu lực đến hết 31/10',
  },
  melatonin: {
    id: 'melatonin',
    name: 'Melatonin',
    classLabel: 'HỖ TRỢ GIẤC NGỦ',
    prescribedBy: 'Kê đơn bởi BS. Vance',
    dosageBody:
      '3 mg trước khi ngủ, dùng với nước khoảng 30 phút trước giờ đi ngủ và tránh dùng cùng đồ uống chứa caffeine vào buổi tối.',
    timingTitle: 'Thói quen đi ngủ',
    timingBody: 'Giảm ánh sáng sau 21:30 để duy trì khung giờ ngủ ổn định mỗi đêm.',
    sideEffects: ['Ngái ngủ buổi sáng', 'Mơ nhiều', 'Khô miệng'],
    completionLabel: 'Thói quen ban đêm',
    completionTitle: 'Melatonin',
    completionPercent: 68,
    completionNote: 'Duy trì đều đặn trong 2 tuần gần đây',
  },
}

export const medicationAdherence = {
  label: 'Tỷ lệ tuân thủ',
  title: 'Lịch sử tháng 10',
  percent: 94,
  note: 'Mức độ đều đặn rất tốt trong tháng này',
}

export const preferredPharmacy = {
  name: 'Nhà thuốc HealthFirst',
  meta: 'Cách 1,2 dặm | Đóng cửa lúc 20:00',
}

export const emergencyIdentity = {
  badge: 'Truy cập khẩn cấp',
  title: 'Thông tin y tế cấp cứu',
  body:
    'Thông tin y tế quan trọng được chuẩn bị cho nhân viên sơ cứu, giúp ưu tiên xử lý đúng ngay trong tình huống khẩn cấp.',
  sosTitle: 'Phản hồi khẩn cấp SOS',
  sosBody:
    'Khi kích hoạt SOS, hệ thống sẽ ngay lập tức thông báo cho người liên hệ khẩn cấp, đơn vị cấp cứu địa phương và gửi vị trí GPS chính xác của bạn tới đội phản ứng.',
  locationLabel: 'Vị trí hiện tại',
  locationValue: '40.7128° B, 74.0060° T',
  dispatchLabel: 'Đơn vị tiếp nhận',
  dispatchValue: 'Trung tâm điều phối y tế',
  responderTitle: 'Mã truy cập cho cấp cứu',
  responderBody:
    'Nhân viên cấp cứu có thể quét mã bảo mật này để xem hồ sơ y khoa và toa thuốc đang còn hiệu lực của bạn.',
  verifiedLabel: 'Giao thức bảo mật đã xác minh',
}

export const emergencyProfile = {
  nearbyCount: 3,
  nearbyRadius: 5,
  bloodType: 'O+',
  bloodTypeNote: 'Nhóm máu phổ biến',
  allergyName: 'Penicillin',
  allergySeverity: 'Nguy cơ phản ứng nặng',
  conditions: ['Hen suyễn', 'Tăng huyết áp'],
  mapFacility: 'Trung tâm Y tế St. Jude',
  mapFacilityMeta: 'Cách 0,8 dặm | Cấp cứu 24/7',
}

export const emergencyContacts = [
  {
    id: 'contact-1',
    initials: 'SV',
    tone: 'mint',
    name: 'Sarah Vance',
    role: 'Liên hệ chính | Vợ',
  },
  {
    id: 'contact-2',
    initials: 'DR',
    tone: 'soft',
    name: 'BS. Marcus Chen',
    role: 'Bác sĩ gia đình',
  },
]

export const directorySpecialties = [
  { key: 'all', label: 'Tất cả' },
  { key: 'primary-care', label: 'Chăm sóc ban đầu' },
  { key: 'diagnostics', label: 'Chẩn đoán' },
  { key: 'pharmacy', label: 'Nhà thuốc' },
]

export const directoryProviders = [
  {
    id: 'saint-jude',
    type: 'clinic',
    specialty: 'primary-care',
    badge: 'Phòng khám liên kết',
    badgeTone: 'mint',
    distance: 1.2,
    name: 'Saint Jude Medical Plaza',
    address: '4422 Wellness Way, Suite 100, San Francisco, CA',
    phone: '(555) 012-3456',
    statusLabel: 'Mở cửa đến 20:00',
    statusTone: 'open',
    openNow: true,
    actionLabel: 'Đặt lịch khám',
    markerLabel: 'Saint Jude',
    markerIcon: 'local_hospital',
    markerTone: 'primary',
    markerTop: '26%',
    markerLeft: '34%',
  },
  {
    id: 'north-bay',
    type: 'clinic',
    specialty: 'diagnostics',
    badge: 'Y tế cộng đồng',
    badgeTone: 'soft',
    distance: 2.8,
    name: 'North Bay Diagnostic Center',
    address: '808 Pacific Heights Blvd, San Francisco, CA',
    phone: '(555) 998-0021',
    statusLabel: 'Mở cửa 24/7',
    statusTone: 'open',
    openNow: true,
    actionLabel: 'Đặt lịch khám',
    markerLabel: 'North Bay',
    markerIcon: 'medical_services',
    markerTone: 'active',
    markerTop: '49%',
    markerLeft: '51%',
  },
  {
    id: 'ethos-rx',
    type: 'pharmacy',
    specialty: 'pharmacy',
    badge: 'Nhà thuốc',
    badgeTone: 'blue',
    distance: 3.1,
    name: 'Ethos Select Pharmacy',
    address: '120 Geary Street, Floor 2, San Francisco, CA',
    phone: '(555) 441-2000',
    statusLabel: 'Đóng cửa sau 20 phút',
    statusTone: 'closing',
    openNow: true,
    actionLabel: 'Chuyển đơn thuốc',
    markerLabel: 'Ethos Rx',
    markerIcon: 'local_pharmacy',
    markerTone: 'secondary',
    markerTop: '68%',
    markerLeft: '73%',
  },
  {
    id: 'presidio',
    type: 'clinic',
    specialty: 'primary-care',
    badge: 'Phòng khám liên kết',
    badgeTone: 'mint',
    distance: 5.4,
    name: 'Presidio Family Practice',
    address: '981 Lincoln Blvd, San Francisco, CA',
    phone: '(555) 772-1011',
    statusLabel: 'Mở cửa đến 18:00',
    statusTone: 'open',
    openNow: true,
    actionLabel: 'Đặt lịch khám',
    markerLabel: 'Presidio',
    markerIcon: 'local_hospital',
    markerTone: 'mint',
    markerTop: '37%',
    markerLeft: '68%',
  },
  {
    id: 'sunset-walkin',
    type: 'clinic',
    specialty: 'primary-care',
    badge: 'Khám không hẹn trước',
    badgeTone: 'soft',
    distance: 6.6,
    name: 'Sunset Walk-In Clinic',
    address: '222 Irving Street, San Francisco, CA',
    phone: '(555) 208-7714',
    statusLabel: 'Đóng cửa đến 07:00',
    statusTone: 'closed',
    openNow: false,
    actionLabel: 'Đặt lịch hẹn',
    markerLabel: 'Sunset',
    markerIcon: 'medical_services',
    markerTone: 'slate',
    markerTop: '74%',
    markerLeft: '36%',
  },
]

export const directoryViewMeta = {
  radiusLabel:
    'Đang hiển thị các cơ sở y tế trong bán kính 10 dặm tính từ địa chỉ chính của bạn tại Pacific Heights.',
}

export const notifications = [
  {
    icon: 'lab_research',
    title: 'Kết quả xét nghiệm máu',
    body: 'Mẫu sinh hóa và tổng phân tích đã sẵn sàng để xem trong hồ sơ.',
    time: '2 giờ trước',
    tone: 'slate',
  },
  {
    icon: 'pill',
    title: 'Nhắc nhở uống thuốc',
    body: 'Vitamin tổng hợp cần được uống sau bữa sáng hôm nay.',
    time: '6 giờ trước',
    tone: 'mint',
  },
  {
    icon: 'warning',
    title: 'Thanh toán cần xử lý',
    body: 'Hóa đơn dịch vụ răng hàm mặt ngày 01/10 chưa được xác nhận.',
    time: 'Hôm qua',
    tone: 'rose',
  },
]

export const notificationFilters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'appointments', label: 'Lịch hẹn' },
  { key: 'labs', label: 'Kết quả xét nghiệm' },
  { key: 'hospital', label: 'Bệnh viện' },
]

export const notificationFeed = [
  {
    id: 'notice-1',
    category: 'appointments',
    icon: 'calendar_today',
    iconTone: 'mint',
    title: 'Nhắc nhở lịch khám sắp tới',
    time: '2 giờ trước',
    body:
      'Lịch hẹn của bạn với BS. Nguyễn Văn A chuyên khoa tim mạch sẽ diễn ra lúc 09:00 sáng mai. Vui lòng có mặt trước 15 phút.',
    unread: true,
    actions: [
      { label: 'Xem chi tiết', tone: 'primary', targetSection: 'appointments' },
      { label: 'Thay đổi lịch', tone: 'secondary', targetSection: 'appointments' },
    ],
  },
  {
    id: 'notice-2',
    category: 'labs',
    icon: 'biotech',
    iconTone: 'soft',
    title: 'Kết quả xét nghiệm mới',
    time: '5 giờ trước',
    body:
      'Kết quả xét nghiệm tổng quát ngày 20/10/2023 đã sẵn sàng. Bạn có thể xem và tải xuống báo cáo đầy đủ ngay bây giờ.',
    unread: true,
    actions: [{ label: 'Tải báo cáo PDF', tone: 'solid', icon: 'download', targetSection: 'documents' }],
  },
  {
    id: 'notice-3',
    category: 'hospital',
    icon: 'campaign',
    iconTone: 'neutral',
    title: 'Thông báo bảo trì hệ thống',
    time: 'Hôm qua',
    body:
      'Ứng dụng Clinical Curator sẽ bảo trì định kỳ từ 01:00 đến 03:00 sáng Chủ nhật tuần này. Một số tính năng có thể bị gián đoạn.',
    unread: false,
  },
  {
    id: 'notice-4',
    category: 'hospital',
    icon: 'apartment',
    iconTone: 'neutral',
    title: 'Cập nhật giờ làm việc Khoa Nhi',
    time: '2 ngày trước',
    body:
      'Khoa Nhi tại cơ sở Quận 1 thông báo thay đổi khung giờ làm việc buổi tối, bắt đầu từ tháng 11/2023.',
    unread: false,
  },
]

export const messageThreads = [
  {
    id: 'thread-1',
    doctor: 'BS. Phạm Minh Hoàng',
    specialty: 'Tim mạch',
    preview: 'Vâng, kết quả xét nghiệm của bạn đã có...',
    time: '10:42',
    online: true,
    experience: 'Chuyên khoa tim mạch | 15 năm kinh nghiệm',
    aiPrompt:
      'Bác sĩ vừa nhắc đến việc thay đổi lối sống. Bạn có muốn tôi liệt kê danh sách thực phẩm giúp giảm cholesterol không?',
    snapshot: [
      {
        id: 'heart-rate',
        icon: 'favorite',
        tone: 'danger',
        label: 'Nhịp tim',
        value: '78',
        unit: 'bpm',
        trend: 'Giảm 2% so với tuần trước',
      },
      {
        id: 'blood-pressure',
        icon: 'water_drop',
        tone: 'primary',
        label: 'Huyết áp',
        value: '120/80',
        unit: 'mmHg',
        trend: 'Ổn định',
      },
    ],
    documents: [
      {
        id: 'doc-1',
        name: 'Xet_nghiem_mau_Q3.pdf',
        size: '2.4 MB',
        date: '09/10/2023',
        icon: 'picture_as_pdf',
        tone: 'pdf',
      },
      {
        id: 'doc-2',
        name: 'Dien_tam_do_ECG.jpg',
        size: '1.1 MB',
        date: '09/10/2023',
        icon: 'analytics',
        tone: 'chart',
      },
    ],
    messages: [
      {
        id: 'm-1',
        sender: 'doctor',
        text: 'Chào Minh Anh, tôi đã xem qua các kết quả xét nghiệm máu và điện tim đồ bạn gửi hôm qua. Nhìn chung các chỉ số đều nằm trong ngưỡng an toàn.',
        time: '10:35',
      },
      {
        id: 'm-2',
        sender: 'doctor',
        text: 'Tuy nhiên, chỉ số cholesterol hơi cao một chút. Bạn có đang duy trì chế độ ăn ít béo như chúng ta đã trao đổi lần trước không?',
        time: '10:35',
      },
      {
        id: 'm-3',
        sender: 'patient',
        text: 'Dạ thưa bác sĩ, dạo này công việc hơi bận nên thỉnh thoảng em vẫn ăn ngoài. Em sẽ cố gắng điều chỉnh lại.',
        time: '10:38',
        seen: true,
      },
      {
        id: 'm-4',
        sender: 'patient',
        text: 'Bác sĩ cho em hỏi chỉ số này có cần phải dùng thuốc ngay không ạ?',
        time: '10:38',
        seen: true,
      },
      {
        id: 'm-5',
        sender: 'doctor',
        text: 'Hiện tại chưa cần dùng thuốc ngay. Chúng ta sẽ theo dõi thêm trong 2 tháng tới và kết hợp vận động 30 phút mỗi ngày.',
        time: '10:42',
      },
      {
        id: 'm-6',
        sender: 'doctor',
        text: 'Kết quả xét nghiệm của bạn đã có bản PDF chi tiết trong mục tài liệu. Bạn có thể tải về để xem kỹ hơn nhé.',
        time: '10:42',
      },
      {
        id: 'm-7',
        type: 'ai',
        prompt:
          'Bác sĩ vừa nhắc đến việc thay đổi lối sống. Bạn có muốn tôi liệt kê danh sách thực phẩm giúp giảm cholesterol không?',
        options: ['Có, hãy liệt kê', 'Để sau'],
      },
    ],
  },
  {
    id: 'thread-2',
    doctor: 'ThS. BS. Lê Thu Hà',
    specialty: 'Nội tiết',
    preview: 'Hẹn gặp bạn vào thứ Ba tới nhé.',
    time: '08:15',
    online: false,
    experience: 'Chuyên khoa nội tiết | 11 năm kinh nghiệm',
    aiPrompt: 'Bạn có muốn tôi tổng hợp lại hướng dẫn ăn uống cho lịch hẹn tới không?',
    snapshot: [
      {
        id: 'glucose',
        icon: 'bloodtype',
        tone: 'primary',
        label: 'Đường huyết',
        value: '96',
        unit: 'mg/dL',
        trend: 'Cân bằng',
      },
    ],
    documents: [
      {
        id: 'doc-3',
        name: 'Ke_hoach_dinh_duong.pdf',
        size: '1.6 MB',
        date: '07/10/2023',
        icon: 'description',
        tone: 'pdf',
      },
    ],
    messages: [
      {
        id: 'm2-1',
        sender: 'doctor',
        text: 'Tôi đã xác nhận lịch tái khám của bạn vào thứ Ba tuần tới lúc 08:30.',
        time: '08:12',
      },
      {
        id: 'm2-2',
        sender: 'patient',
        text: 'Dạ, em sẽ đến đúng giờ. Cảm ơn bác sĩ.',
        time: '08:14',
        seen: true,
      },
      {
        id: 'm2-3',
        sender: 'doctor',
        text: 'Hẹn gặp bạn vào thứ Ba tới nhé.',
        time: '08:15',
      },
    ],
  },
  {
    id: 'thread-3',
    doctor: 'BS. Nguyễn Văn Nam',
    specialty: 'Nhi khoa',
    preview: 'Bé đã bớt sốt chưa ạ?',
    time: 'Hôm qua',
    online: true,
    experience: 'Chuyên khoa nhi | 9 năm kinh nghiệm',
    aiPrompt: 'Bạn có muốn tôi nhắc lại lịch dùng thuốc cho bé không?',
    snapshot: [
      {
        id: 'temperature',
        icon: 'thermometer',
        tone: 'danger',
        label: 'Thân nhiệt',
        value: '37.2',
        unit: '°C',
        trend: 'Đã giảm',
      },
    ],
    documents: [
      {
        id: 'doc-4',
        name: 'Don_thuoc_nhi_khoa.pdf',
        size: '840 KB',
        date: '08/10/2023',
        icon: 'picture_as_pdf',
        tone: 'pdf',
      },
    ],
    messages: [
      {
        id: 'm3-1',
        sender: 'doctor',
        text: 'Tôi muốn theo dõi thêm phản ứng của bé sau 24 giờ. Tình hình hiện tại thế nào rồi ạ?',
        time: '09:10',
      },
      {
        id: 'm3-2',
        sender: 'patient',
        text: 'Dạ bé đã bớt sốt và ăn được hơn từ tối qua ạ.',
        time: '09:18',
        seen: true,
      },
      {
        id: 'm3-3',
        sender: 'doctor',
        text: 'Rất tốt, nếu đêm nay không sốt lại thì tiếp tục phác đồ hiện tại nhé.',
        time: '09:21',
      },
    ],
  },
]

export const documentCategories = [
  {
    id: 'records',
    label: 'Hồ sơ bệnh án',
    icon: 'folder_shared',
    tone: 'blue',
  },
  {
    id: 'prescriptions',
    label: 'Đơn thuốc PDF',
    icon: 'pill',
    tone: 'green',
  },
  {
    id: 'labs',
    label: 'Kết quả xét nghiệm',
    icon: 'science',
    tone: 'amber',
  },
  {
    id: 'billing',
    label: 'Hóa đơn',
    icon: 'receipt_long',
    tone: 'slate',
  },
]

export const documentLibrary = [
  {
    id: 'file-1',
    title: 'Đơn thuốc - 15/10/2023',
    subtitle: 'Đơn thuốc ngoại trú | PDF',
    category: 'prescriptions',
    date: '15/10/2023',
    size: '1.2 MB',
    icon: 'picture_as_pdf',
    tone: 'pdf',
  },
  {
    id: 'file-2',
    title: 'Kết quả chụp X-quang phổi',
    subtitle: 'Chẩn đoán hình ảnh | JPG',
    category: 'labs',
    date: '12/10/2023',
    size: '4.5 MB',
    icon: 'image',
    tone: 'image',
  },
  {
    id: 'file-3',
    title: 'Hóa đơn khám tổng quát',
    subtitle: 'Thanh toán | PDF',
    category: 'billing',
    date: '10/10/2023',
    size: '640 KB',
    icon: 'picture_as_pdf',
    tone: 'pdf',
  },
  {
    id: 'file-4',
    title: 'Xét nghiệm máu định kỳ',
    subtitle: 'Kết quả xét nghiệm | PDF',
    category: 'labs',
    date: '05/09/2023',
    size: '2.8 MB',
    icon: 'lab_research',
    tone: 'lab',
  },
  {
    id: 'file-5',
    title: 'Đơn thuốc - 20/08/2023',
    subtitle: 'Đơn thuốc ngoại trú | PDF',
    category: 'prescriptions',
    date: '20/08/2023',
    size: '1.1 MB',
    icon: 'picture_as_pdf',
    tone: 'pdf',
  },
  {
    id: 'file-6',
    title: 'Hồ sơ bệnh án tổng hợp',
    subtitle: 'Hồ sơ bệnh án | PDF',
    category: 'records',
    date: '18/07/2023',
    size: '3.2 MB',
    icon: 'description',
    tone: 'record',
  },
]

export const defaultSelectedDocumentIds = ['file-1', 'file-3', 'file-5']

export const records = [
  {
    date: '12/10/2023',
    test: 'Xét nghiệm lipid máu',
    doctor: 'BS. Phạm Minh Hoàng',
    status: 'Hoàn thành',
    ready: true,
  },
  {
    date: '05/10/2023',
    test: 'Chụp X-quang phổi',
    doctor: 'BS. Lê Thị Mai',
    status: 'Hoàn thành',
    ready: true,
  },
  {
    date: '28/09/2023',
    test: 'Tổng phân tích nước tiểu',
    doctor: 'BS. Nguyễn Văn A',
    status: 'Đang chờ',
    ready: false,
  },
]

export const appointmentDoctors = [
  {
    id: 'doc-1',
    name: 'BS. Lê Minh Tâm',
    specialty: 'Chuyên khoa nội tiết',
    rating: '4.9',
    reviews: '120+',
    availability: 'Sẵn sàng',
    initials: 'LT',
    avatar: 'https://api.dicebear.com/7.x/personas/svg?seed=LeMinhTam&backgroundColor=b6e3f4',
  },
  {
    id: 'doc-2',
    name: 'BS. Nguyễn Thùy',
    specialty: 'Chuyên khoa tim mạch',
    rating: '5.0',
    reviews: '85+',
    availability: 'Sẵn sàng',
    initials: 'NT',
    avatar: 'https://api.dicebear.com/7.x/personas/svg?seed=NguyenThuy&backgroundColor=c0aede',
  },
  {
    id: 'doc-3',
    name: 'BS. Trần Hoàng',
    specialty: 'Chuyên khoa ngoại',
    rating: '4.8',
    reviews: '210+',
    availability: 'Sẵn sàng',
    initials: 'TH',
    avatar: 'https://api.dicebear.com/7.x/personas/svg?seed=TranHoang&backgroundColor=d1d4f9',
  },
  {
    id: 'doc-4',
    name: 'BS. Phạm My',
    specialty: 'Chuyên khoa nhi',
    rating: '4.9',
    reviews: '92+',
    availability: 'Sẵn sàng',
    initials: 'PM',
    avatar: 'https://api.dicebear.com/7.x/personas/svg?seed=PhamMy&backgroundColor=ffd5dc',
  },
]

export const appointmentCalendarDays = [
  { label: '28', muted: true },
  { label: '29', muted: true },
  { label: '30', muted: true },
  { label: '31', muted: true },
  { label: '1' },
  { label: '2' },
  { label: '3' },
  { label: '4' },
  { label: '5', selected: true },
  { label: '6' },
  { label: '7' },
  { label: '8' },
  { label: '9' },
  { label: '10' },
]

export const appointmentTimeSlots = [
  { value: '08:00', selected: true },
  { value: '09:30' },
  { value: '10:45' },
  { value: '13:30' },
  { value: '15:00' },
  { value: '16:30' },
]

export const appointmentHistory = [
  {
    id: 'apt-1',
    doctor: 'BS. Nguyễn Thùy',
    specialty: 'Tim mạch',
    icon: 'favorite',
    date: '24/05/2024',
    time: '09:30',
    status: 'Đã xác nhận',
    tone: 'confirmed',
  },
  {
    id: 'apt-2',
    doctor: 'BS. Lê Minh Tâm',
    specialty: 'Nội tiết',
    icon: 'medical_services',
    date: '28/05/2024',
    time: '14:00',
    status: 'Đang chờ',
    tone: 'pending',
  },
  {
    id: 'apt-3',
    doctor: 'BS. Trần Hoàng',
    specialty: 'Ngoại tổng quát',
    icon: 'health_and_safety',
    date: '15/05/2024',
    time: '11:00',
    status: 'Đã hủy',
    tone: 'cancelled',
  },
]

export const medicalVisits = [
  {
    id: 'visit-1',
    doctor: 'BS. Nguyễn An',
    specialty: 'Chuyên khoa tiêu hóa',
    date: '24/10/2023',
    diagnosis: 'Viêm dạ dày cấp',
    latest: true,
    recordId: '#REC-2023-1024',
    summaryTitle: 'Tóm tắt khám lâm sàng',
    symptoms:
      'Bệnh nhân xuất hiện đau vùng bụng trên, buồn nôn kéo dài và khó chịu sau ăn trong 3 ngày gần đây. Có ghi nhận mức độ căng thẳng cao.',
    conclusion:
      'Viêm dạ dày mức độ vừa, bùng phát do chế độ ăn không phù hợp và căng thẳng kéo dài.',
    notes: [
      'Khám bụng thấy đau vùng thượng vị khi ấn.',
      'Chưa ghi nhận dấu hiệu xuất huyết tiêu hóa hoặc mất nước nặng.',
      'Khuyến nghị điều chỉnh chế độ ăn và kiểm soát căng thẳng.',
    ],
  },
  {
    id: 'visit-2',
    doctor: 'BS. Elena Smith',
    specialty: 'Khám sức khỏe tổng quát',
    date: '12/09/2023',
    diagnosis: 'Tầm soát định kỳ - Sức khỏe ổn định',
    recordId: '#REC-2023-0912',
    summaryTitle: 'Đánh giá sức khỏe định kỳ',
    symptoms:
      'Bệnh nhân đến khám định kỳ hằng năm, không có triệu chứng cấp tính. Giấc ngủ, khẩu vị và mức độ vận động ổn định.',
    conclusion:
      'Kết quả tầm soát trong giới hạn dự kiến. Tiếp tục duy trì chăm sóc dự phòng và tái khám hằng năm.',
    notes: [
      'Huyết áp và mạch trong giới hạn bình thường.',
      'Không ghi nhận vấn đề hô hấp hay tim mạch trong thăm khám thực thể.',
      'Khuyến nghị duy trì tần suất vận động và thói quen uống đủ nước.',
    ],
  },
  {
    id: 'visit-3',
    doctor: 'BS. Trần Minh',
    specialty: 'Khoa tim mạch',
    date: '05/06/2023',
    diagnosis: 'Rối loạn nhịp nhẹ',
    recordId: '#REC-2023-0605',
    summaryTitle: 'Ghi chú theo dõi tim mạch',
    symptoms:
      'Bệnh nhân thỉnh thoảng hồi hộp khi mệt mỏi, không kèm đau ngực hay khó thở.',
    conclusion:
      'Có ghi nhận rối loạn nhịp nhẹ. Khuyến nghị theo dõi bảo tồn và giảm sử dụng chất kích thích.',
    notes: [
      'Điện tim cho thấy nhịp không đều nhẹ, chưa có dấu hiệu nguy cấp.',
      'Khuyên bệnh nhân hạn chế caffeine và cải thiện giờ ngủ.',
      'Tái khám nếu cơn hồi hộp tăng về tần suất hoặc mức độ.',
    ],
  },
]

export const prescriptionItems = [
  {
    id: 'rx-1',
    medication: 'Esomeprazole 40 mg',
    dosage: '1 viên',
    usage: 'Uống trước bữa sáng 30 phút, duy trì trong 14 ngày.',
    quantity: '14',
  },
  {
    id: 'rx-2',
    medication: 'Gaviscon Dual Action',
    dosage: '1 gói',
    usage: 'Uống sau bữa ăn và trước khi đi ngủ khi có triệu chứng ợ chua.',
    quantity: '20',
  },
  {
    id: 'rx-3',
    medication: 'Buscopan 10 mg',
    dosage: '1 viên',
    usage: 'Uống khi đau bụng co thắt, không quá 3 lần/ngày.',
    quantity: '10',
  },
]

export const labResultCards = [
  {
    id: 'lab-1',
    title: 'Phân tích máu',
    subtitle: 'Hemoglobin và Glucose',
    icon: 'bloodtype',
    tone: 'danger',
    badge: 'Bình thường',
    badgeTone: 'confirmed',
    details: [
      { label: 'Glucose lúc đói', value: '94 mg/dL' },
      { label: 'Hemoglobin', value: '14.2 g/dL' },
    ],
    action: 'Xem báo cáo PDF',
    actionIcon: 'attach_file',
  },
  {
    id: 'lab-2',
    title: 'Chẩn đoán hình ảnh',
    subtitle: 'X-quang đường tiêu hóa trên',
    icon: 'radiology',
    tone: 'primary',
    badge: 'Cần xem lại',
    badgeTone: 'pending',
    preview: true,
    action: 'Tải tệp DICOM',
    actionIcon: 'download',
  },
]

export const billingOverview = {
  outstandingLabel: 'Tổng dư nợ hiện tại',
  outstandingAmount: '2.450.000',
  outstandingCurrency: '₫',
  settledLabel: 'Đã quyết toán',
  settledAmount: '14.200.000₫',
  settledPeriod: 'Trong 6 tháng gần nhất',
  supportTitle: 'Cần hỗ trợ thanh toán?',
  supportBody:
    'Liên hệ bộ phận kế toán của chúng tôi tại số nội bộ #102 để được giải đáp thắc mắc về hóa đơn.',
}

export const billingInvoices = [
  {
    id: 'bill-1',
    service: 'Khám tổng quát định kỳ',
    meta: '15/05/2024 | BS. Nguyễn Văn A',
    icon: 'medical_services',
    iconTone: 'primary',
    amount: '1.250.000₫',
    status: 'Chưa thanh toán',
    tone: 'unpaid',
  },
  {
    id: 'bill-2',
    service: 'Xét nghiệm máu và nước tiểu',
    meta: '15/05/2024 | Khoa xét nghiệm',
    icon: 'biotech',
    iconTone: 'primary',
    amount: '1.200.000₫',
    status: 'Chưa thanh toán',
    tone: 'unpaid',
  },
  {
    id: 'bill-3',
    service: 'Điều trị nha khoa',
    meta: '02/04/2024 | BS. Trần Thị B',
    icon: 'dentistry',
    iconTone: 'secondary',
    amount: '3.500.000₫',
    status: 'Đã thanh toán',
    tone: 'paid',
  },
]

export const paymentMethods = [
  {
    id: 'vnpay',
    label: 'VNPay',
    badge: 'VNPAY',
    badgeTone: 'vnpay',
  },
  {
    id: 'momo',
    label: 'MoMo',
    badge: 'MoMo',
    badgeTone: 'momo',
  },
  {
    id: 'card',
    label: 'Thẻ quốc tế (Visa/Master)',
    badge: 'VISA',
    badgeTone: 'card',
    badgeSecondary: 'MC',
  },
]

export const sectionMeta = {
  emergency: {
    eyebrow: 'Khẩn cấp',
    title: 'Thông tin y tế cấp cứu',
    body: 'Thông tin y tế ưu tiên dành cho tình huống khẩn cấp, giúp đội cấp cứu truy cập nhanh dữ liệu cần thiết.',
  },
  trends: {
    eyebrow: 'Phân tích',
    title: 'Xu hướng sức khỏe',
    body: 'Tổng hợp xu hướng sinh hiệu, lịch sử đo và khuyến nghị để bệnh nhân theo dõi sức khỏe liên tục.',
  },
  directory: {
    eyebrow: 'Mạng lưới chăm sóc',
    title: 'Danh bạ phòng khám',
    body: 'Danh bạ phòng khám, trung tâm chẩn đoán và nhà thuốc liên kết để bạn tìm nhanh địa điểm phù hợp.',
  },
  medications: {
    eyebrow: 'Điều trị',
    title: 'Theo dõi thuốc',
    body: 'Lịch dùng thuốc, tiến độ tuân thủ và thông tin toa thuốc được theo dõi tập trung tại đây.',
  },
  appointments: {
    eyebrow: 'Điều phối khám',
    title: 'Lịch hẹn',
    body: 'Khu vực quản lý lịch hẹn để đặt lịch, đổi lịch và theo dõi trạng thái khám của bạn.',
  },
  history: {
    eyebrow: 'Lưu trữ lâm sàng',
    title: 'Lịch sử khám',
    body: 'Lịch sử bệnh án, kết quả cận lâm sàng và toa thuốc được tập trung tại đây để bạn xem nhanh.',
  },
  messages: {
    eyebrow: 'Đội ngũ chăm sóc',
    title: 'Tin nhắn',
    body: 'Khu vực nhắn tin và tư vấn với đội ngũ bác sĩ, kèm tài liệu và tóm tắt chỉ số liên quan.',
  },
  documents: {
    eyebrow: 'Lưu trữ bảo mật',
    title: 'Kho tài liệu',
    body: 'Kho tài liệu để lưu, tìm kiếm và tải về hồ sơ y tế, hóa đơn và kết quả xét nghiệm của bạn.',
  },
  notifications: {
    eyebrow: 'Hộp thư',
    title: 'Thông báo',
    body: 'Tất cả cập nhật về lịch hẹn, kết quả xét nghiệm và thông báo từ bệnh viện sẽ hiển thị tại đây.',
  },
  billing: {
    eyebrow: 'Thanh toán',
    title: 'Hóa đơn',
    body: 'Màn hình hóa đơn và thanh toán hiển thị trạng thái xử lý, khoản cần thanh toán và phương thức chi trả.',
  },
  support: {
    eyebrow: 'Hỗ trợ bệnh nhân',
    title: 'Hỗ trợ',
    body: 'Khu vực hướng dẫn, câu hỏi thường gặp và liên hệ với bộ phận chăm sóc đang được chuẩn bị.',
  },
}
