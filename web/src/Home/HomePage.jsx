import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearStoredAuth, readStoredAuth } from '../lib/storage';
import { MarketingFooter, MarketingHeader, useSiteLanguage } from './marketingChrome';
export function HomePage() {
  const navigate = useNavigate();
  const storedAuth = readStoredAuth();
  const profile = storedAuth?.patient;
  const [language, setLanguage] = useSiteLanguage('vi');
  const [openAppointmentPicker, setOpenAppointmentPicker] = useState('');
  const [appointmentForm, setAppointmentForm] = useState({
    service: 'Dental Therapy',
    doctor: 'Dr. Sarah Williams',
    date: '2026-04-15',
    time: '10:30',
  });

  const copy = {
    en: {
      status: 'Where Precision Meets Recovery.',
      hotline: 'Hotline 1900-8888',
      care: '24/7 Care Available',
      portal: 'Patient Portal',
      nav: ['Home', 'About', 'Specialties', 'Doctors', 'News', 'FAQ', 'Contact'],
      support: 'Support',
      book: 'Book Appointment',
      logout: 'Logout',
      hello: 'Hello',
      heroKicker: 'Sanctuary Health Institute',
      heroTitle: 'Precision Medicine, Personalized Care',
      heroLead:
        'Experience the next generation of healthcare with Sanctuary Health. Advanced diagnostics meet restorative hospitality in a medical campus built for recovery.',
      heroBadge: '24/7 care available',
      heroPrimary: 'Start Your Journey',
      heroSecondary: 'Our Virtual Tour',
      partnerKicker: 'Trusted healthcare network',
      partners: [
        { name: 'MED-GLOBAL', icon: 'cross' },
        { name: 'ALLIANCE MEDICAL', icon: 'network' },
        { name: 'HEAL CORP', icon: 'pulse' },
        { name: 'PRIMARY CARE UNITY', icon: 'shield' },
        { name: 'TRUST HEALTH', icon: 'trust' },
      ],
      appointmentKicker: 'Quick Appointment',
      appointmentDepartment: 'Department',
      appointmentDoctor: 'Select Doctor',
      appointmentDate: 'Date',
      appointmentTime: 'Time',
      appointmentButton: 'Explore Availability',
      departmentsKicker: 'Our Departments',
      departmentsTitle: 'Pioneering Care Across Specialties',
      learnMore: 'Learn More',
      excellenceKicker: 'Excellence in Care',
      excellenceTitle: 'Why the World Trusts Sanctuary Health',
      excellenceLead:
        'We combine hospitality-grade environments, precision medicine pathways, and deeply collaborative clinical teams to create a seamless care journey.',
      satisfaction: 'Patient satisfaction',
      stats: ['Happy patients', 'Professional doctors', 'Years of experience', 'Care commitment'],
      portalKicker: 'Patient Digital Hub',
      portalTitle: 'Built for modern recovery',
      portalLead:
        'Manage appointments, review lab history, request prescription renewals, and stay informed through one coordinated portal.',
      portalButton: 'Launch Portal',
      portalItems: ['My Records', 'Test Results', 'Active Prescriptions', 'Upcoming Appointments'],
      doctorsKicker: 'Our Physicians',
      doctorsTitle: 'The Minds Behind Your Recovery',
      philosophyKicker: 'Healing Ethos',
      philosophyTitle: 'The Sanctuary Philosophy',
      philosophyP1:
        'Healing is more than a medical procedure; it is a holistic continuum defined by the environment in which it occurs.',
      philosophyP2:
        'Every room, pathway, and recovery program has been composed to reduce stress and support measurable healing outcomes through light, calm, and coordinated care.',
      philosophyLink: 'Explore Sanctuary',
      insightsKicker: 'Health Insights',
      insightsTitle: 'What we are learning now',
      insightsLink: 'View More Insights',
      faqKicker: 'Common Questions',
      faqTitle: 'Frequently Asked Questions',
      storiesKicker: 'Patient Stories',
      storiesTitle: 'Voices of Restoration',
      ctaTitle: 'Ready to Begin Your Healing Journey?',
      ctaLead:
        'Our specialists are available for in-person and virtual consultations. Take the first step toward a healthier, more defined care experience.',
      ctaPrimary: 'Book Appointment Now',
      ctaSecondary: 'Consult a Doctor',
      visitKicker: 'Visit Our Sanctuary',
      visitTitle: 'Visit Our Sanctuary',
      visitLead:
        'Explore a real hospital location in Da Nang with direct map access, contact details, and on-site directions for easier planning.',
      visitPoints: ['Da Nang Hospital', 'Contact', 'Hours'],
      visitDetails: [
        '124 Hai Phong Street, Thach Thang Ward, Hai Chau District, Da Nang',
        'support@sanctuary.health · +84 1800 1234',
        'Mon-Sat 07:00 - 20:00 · Emergency Unit 24/7',
      ],
      parking: 'Parking Locator',
      directions: 'Get Directions',
      footerLead: 'Precision care designed for modern recovery.',
      doctors: [
        { name: 'Dr. Olivia Vance', role: 'Cardiologist', tag: 'Available', visual: 'doctor-one' },
        { name: 'Dr. Marcus Thorne', role: 'Neurology Chief', tag: 'Research Lead', visual: 'doctor-two' },
        { name: 'Dr. Sarah Chen', role: 'Pediatrician', tag: 'Featured', visual: 'doctor-three' },
        { name: 'Dr. Julian Arlo', role: 'Oncology Consultant', tag: 'New', visual: 'doctor-four' },
      ],
      specialties: [
        {
          title: 'Advanced Cardiology',
          description: 'Comprehensive cardiac screening by leading diagnostics and minimally invasive intervention specialists.',
          tone: 'blue',
          icon: '♥',
          badge: 'High precision',
          metric: 'Same-week diagnostic planning',
        },
        {
          title: 'Neurology',
          description: 'Precision diagnostics and modern neuro-recovery pathways led by cross-disciplinary teams.',
          tone: 'soft',
          icon: '◉',
          badge: 'Integrated care',
          metric: 'Multi-specialty case review',
        },
        {
          title: 'Pediatrics',
          description: 'Warm, family-centered pediatric care for every stage from infancy through adolescence.',
          tone: 'green',
          icon: '◌',
          badge: 'Family centered',
          metric: 'Dedicated child-friendly pathways',
        },
        {
          title: 'Oncology',
          description: 'Coordinated oncology plans designed around patient comfort, safety, and long-term monitoring.',
          tone: 'white',
          icon: '✦',
          badge: 'Longitudinal care',
          metric: 'Treatment and follow-up in one flow',
        },
        {
          title: 'Emergency & Trauma Hub',
          description: '24/7 rapid response and specialist triage backed by advanced emergency infrastructure.',
          tone: 'featured',
          icon: '✚',
          badge: '24/7 response',
          metric: 'Immediate triage and intervention',
        },
        {
          title: 'Genomics',
          description: 'Predictive care models powered by genetic screening and precision medicine insights.',
          tone: 'white',
          icon: '◎',
          badge: 'Future ready',
          metric: 'Preventive risk profiling',
        },
      ],
      insights: [
        {
          title: 'Personalized Genomics in Routine Checkups',
          text: 'How precision screening is moving from specialist programs into preventive care pathways.',
          tone: 'insight-one',
        },
        {
          title: 'Natural Room Connection Advances Recovery',
          text: 'Why calming spatial design and daylight exposure remain essential for patient healing.',
          tone: 'insight-two',
        },
        {
          title: 'Enhanced Diagnostic Accuracy',
          text: 'A look at multidisciplinary workflows that shorten review time without losing reliability.',
          tone: 'insight-three',
        },
      ],
      testimonials: [
        {
          quote: 'The care at Sanctuary Health felt coordinated from the moment I walked in. Every step was clear and calm.',
          name: 'James Turner',
          role: 'Cardiology Patient',
        },
        {
          quote: 'The pediatric team explained everything with patience. We felt informed, reassured, and genuinely cared for.',
          name: 'Mia Harper',
          role: 'Mother of patient',
        },
        {
          quote: 'World-class medical service, thoughtful spaces, and responsive follow-up made a difficult week much easier.',
          name: 'Daniel Miller',
          role: 'Recovery Program',
        },
      ],
      faqs: [
        {
          question: 'How do I book my first appointment?',
          answer: 'Choose your department, preferred doctor, and available time slot from the quick appointment card or contact our support team for guided scheduling.',
        },
        {
          question: 'Can I access my records online?',
          answer: 'Yes. The patient digital hub provides access to visit summaries, test results, prescriptions, and upcoming appointments in one place.',
        },
        {
          question: 'Do you support emergency cases?',
          answer: 'Yes. Our emergency and trauma hub operates 24/7, but you should still contact local emergency services immediately for critical situations.',
        },
      ],
    },
    vi: {
      status: 'Nơi y học chính xác gặp hành trình hồi phục.',
      hotline: 'Hotline 1900-8888',
      care: 'Chăm sóc 24/7',
      portal: 'Cổng bệnh nhân',
      nav: ['Trang chủ', 'Giới thiệu', 'Chuyên khoa', 'Bác sĩ', 'Tin tức', 'FAQ', 'Liên hệ'],
      support: 'Hỗ trợ',
      book: 'Đặt lịch hẹn',
      logout: 'Đăng xuất',
      hello: 'Xin chào',
      heroKicker: 'Viện Y khoa Healthcare Plus+',
      heroTitle: 'Chăm sóc sức khỏe - Tận tâm & Chuyên nghiệp',
      heroLead:
        'Chúng tôi mang đến dịch vụ chăm sóc sức khỏe tận tâm và chuyên nghiệp, đặt bạn làm trung tâm. Sức khỏe của bạn luôn là ưu tiên hàng đầu của chúng tôi.',
      heroBadge: 'Dịch vụ 24/7',
      heroPrimary: 'Đặt lịch khám ngay',
      heroSecondary: 'Xem giới thiệu',
      partnerKicker: 'Mạng lưới y tế tin cậy',
      partners: [
        { name: 'Y TẾ TOÀN CẦU', icon: 'cross' },
        { name: 'LIÊN MINH Y KHOA', icon: 'network' },
        { name: 'TẬP ĐOÀN HEAL', icon: 'pulse' },
        { name: 'CHĂM SÓC BAN ĐẦU', icon: 'shield' },
        { name: 'Y TẾ TÍN NHIỆM', icon: 'trust' },
      ],
      appointmentKicker: 'Đặt lịch nhanh',
      appointmentDepartment: 'Chuyên khoa',
      appointmentDoctor: 'Chọn bác sĩ',
      appointmentDate: 'Ngày khám',
      appointmentTime: 'Giờ khám',
      appointmentButton: 'Xem lịch trống',
      departmentsKicker: 'Các chuyên khoa',
      departmentsTitle: 'Chăm sóc tiên phong trên nhiều chuyên ngành',
      learnMore: 'Xem thêm',
      excellenceKicker: 'Chuẩn mực điều trị',
      excellenceTitle: 'Vì sao bệnh nhân tin tưởng Sanctuary Health',
      excellenceLead:
        'Chúng tôi kết hợp không gian chuẩn phục hồi, lộ trình điều trị cá nhân hóa và đội ngũ chuyên gia liên ngành để tạo ra hành trình chăm sóc liền mạch.',
      satisfaction: 'Mức hài lòng của bệnh nhân',
      stats: ['Bệnh nhân hài lòng', 'Bác sĩ chuyên nghiệp', 'Năm kinh nghiệm', 'Tận tâm chăm sóc'],
      portalKicker: 'Trung tâm số cho bệnh nhân',
      portalTitle: 'Xây dựng cho quá trình phục hồi hiện đại',
      portalLead:
        'Quản lý lịch hẹn, xem kết quả xét nghiệm, gia hạn đơn thuốc và theo dõi toàn bộ hành trình điều trị trên một cổng duy nhất.',
      portalButton: 'Mở cổng bệnh nhân',
      portalItems: ['Hồ sơ của tôi', 'Kết quả xét nghiệm', 'Đơn thuốc đang dùng', 'Lịch hẹn sắp tới'],
      doctorsKicker: 'Đội ngũ bác sĩ',
      doctorsTitle: 'Những chuyên gia đồng hành cùng quá trình hồi phục',
      philosophyKicker: 'Triết lý chữa lành',
      philosophyTitle: 'Triết lý Sanctuary',
      philosophyP1:
        'Chữa lành không chỉ là một thủ thuật y khoa, mà là hành trình toàn diện được định hình bởi chính môi trường chăm sóc.',
      philosophyP2:
        'Từng không gian, từng lộ trình phục hồi được xây dựng để giảm căng thẳng và hỗ trợ hiệu quả điều trị bằng ánh sáng, sự tĩnh tại và phối hợp y khoa chặt chẽ.',
      philosophyLink: 'Khám phá Sanctuary',
      insightsKicker: 'Góc nhìn sức khỏe',
      insightsTitle: 'Những điều chúng tôi đang phát triển',
      insightsLink: 'Xem thêm bài viết',
      faqKicker: 'Câu hỏi chung',
      faqTitle: 'Câu hỏi thường gặp',
      storiesKicker: 'Câu chuyện bệnh nhân',
      storiesTitle: 'Những tiếng nói của sự hồi phục',
      ctaTitle: 'Sẵn sàng bắt đầu hành trình chữa lành?',
      ctaLead:
        'Đội ngũ chuyên gia luôn sẵn sàng cho cả tư vấn trực tiếp và trực tuyến. Hãy bắt đầu hành trình chăm sóc sức khỏe của bạn ngay hôm nay.',
      ctaPrimary: 'Đặt lịch ngay',
      ctaSecondary: 'Tư vấn bác sĩ',
      visitKicker: 'Đến với Sanctuary',
      visitTitle: 'Thăm trung tâm Sanctuary',
      visitLead:
        'Xem nhanh một địa điểm bệnh viện thực tế tại Đà Nẵng với bản đồ, thông tin liên hệ và hướng dẫn đường đi trực tiếp.',
      visitPoints: ['Bệnh viện tại Đà Nẵng', 'Liên hệ', 'Giờ hoạt động'],
      visitDetails: [
        '124 Hải Phòng, phường Thạch Thang, quận Hải Châu, Đà Nẵng',
        'support@sanctuary.health · +84 1800 1234',
        'Thứ 2 - Thứ 7 07:00 - 20:00 · Cấp cứu 24/7',
      ],
      parking: 'Bãi đỗ xe',
      directions: 'Chỉ đường',
      footerLead: 'Chăm sóc chính xác cho hành trình phục hồi hiện đại.',
      doctors: [
        { name: 'BS. Olivia Vance', role: 'Chuyên khoa tim mạch', tag: 'Đang nhận lịch', visual: 'doctor-one' },
        { name: 'BS. Marcus Thorne', role: 'Trưởng khoa thần kinh', tag: 'Nghiên cứu', visual: 'doctor-two' },
        { name: 'BS. Sarah Chen', role: 'Bác sĩ nhi khoa', tag: 'Nổi bật', visual: 'doctor-three' },
        { name: 'BS. Julian Arlo', role: 'Tư vấn ung bướu', tag: 'Mới', visual: 'doctor-four' },
      ],
      specialties: [
        { title: 'Tim mạch chuyên sâu', description: 'Tầm soát tim mạch toàn diện cùng đội ngũ chẩn đoán và can thiệp ít xâm lấn.', tone: 'blue', icon: '♥', badge: 'Chẩn đoán sớm', metric: 'Lộ trình đánh giá trong tuần' },
        { title: 'Thần kinh', description: 'Chẩn đoán chính xác và các lộ trình phục hồi thần kinh do đội ngũ liên ngành dẫn dắt.', tone: 'soft', icon: '◉', badge: 'Liên chuyên khoa', metric: 'Hội chẩn phối hợp đa tầng' },
        { title: 'Nhi khoa', description: 'Chăm sóc thân thiện và an toàn cho trẻ từ giai đoạn sơ sinh đến vị thành niên.', tone: 'green', icon: '◌', badge: 'Thân thiện gia đình', metric: 'Không gian và quy trình riêng cho trẻ' },
        { title: 'Ung bướu', description: 'Phác đồ phối hợp lấy sự an toàn, thoải mái và theo dõi dài hạn làm trung tâm.', tone: 'white', icon: '✦', badge: 'Theo dõi dài hạn', metric: 'Điều trị và chăm sóc sau điều trị liền mạch' },
        { title: 'Cấp cứu & Chấn thương', description: 'Hệ thống phản ứng nhanh 24/7 với nền tảng cấp cứu hiện đại và chuyên gia tại chỗ.', tone: 'featured', icon: '✚', badge: 'Phản ứng 24/7', metric: 'Tiếp nhận nhanh và can thiệp ngay' },
        { title: 'Genomics', description: 'Mô hình dự báo điều trị từ sàng lọc di truyền và phân tích y học chính xác.', tone: 'white', icon: '◎', badge: 'Y học chính xác', metric: 'Sàng lọc nguy cơ và cá nhân hóa điều trị' },
      ],
      insights: [
        { title: 'Genomics cá nhân hóa trong khám định kỳ', text: 'Cách sàng lọc chính xác đang dần trở thành một phần của chăm sóc dự phòng hiện đại.', tone: 'insight-one' },
        { title: 'Không gian tự nhiên hỗ trợ hồi phục', text: 'Vì sao thiết kế tĩnh tại và ánh sáng tự nhiên vẫn là nền tảng quan trọng của điều trị.', tone: 'insight-two' },
        { title: 'Nâng cao độ chính xác chẩn đoán', text: 'Nhìn vào quy trình liên ngành giúp rút ngắn thời gian đánh giá nhưng vẫn đảm bảo độ tin cậy.', tone: 'insight-three' },
      ],
      testimonials: [
        { quote: 'Ngay từ khi bước vào Sanctuary Health, tôi đã cảm nhận được sự phối hợp rất chuyên nghiệp. Mọi bước đều rõ ràng và nhẹ nhàng.', name: 'James Turner', role: 'Bệnh nhân tim mạch' },
        { quote: 'Đội ngũ nhi khoa giải thích rất kiên nhẫn. Gia đình tôi cảm thấy yên tâm và được đồng hành thực sự.', name: 'Mia Harper', role: 'Phụ huynh bệnh nhi' },
        { quote: 'Dịch vụ chuẩn quốc tế, không gian tinh tế và phản hồi nhanh đã giúp tuần điều trị khó khăn của tôi trở nên dễ chịu hơn.', name: 'Daniel Miller', role: 'Chương trình hồi phục' },
      ],
      faqs: [
        {
          question: 'Làm sao để đặt lịch khám lần đầu?',
          answer: 'Bạn có thể chọn chuyên khoa, bác sĩ và khung giờ ngay trong khu vực đặt lịch nhanh hoặc liên hệ đội ngũ hỗ trợ để được hướng dẫn.',
        },
        {
          question: 'Tôi có xem hồ sơ trực tuyến được không?',
          answer: 'Có. Cổng bệnh nhân cho phép bạn xem kết quả, đơn thuốc, lịch hẹn và các tóm tắt điều trị trong một nơi duy nhất.',
        },
        {
          question: 'Trung tâm có hỗ trợ cấp cứu không?',
          answer: 'Có. Khu cấp cứu và chấn thương hoạt động 24/7, tuy nhiên với tình huống nguy kịch bạn vẫn nên gọi cấp cứu địa phương ngay lập tức.',
        },
      ],
    },
    ko: {
      status: '정밀 의학과 회복이 만나는 곳.',
      hotline: '핫라인 1900-8888',
      care: '24시간 케어',
      portal: '환자 포털',
      nav: ['홈', '소개', '진료과', '의료진', '뉴스', 'FAQ', '문의'],
      support: '지원',
      book: '진료 예약',
      logout: '로그아웃',
      hello: '안녕하세요',
      heroKicker: 'Sanctuary Health Institute',
      heroTitle: '정밀 의학, 맞춤형 케어',
      heroLead:
        'Sanctuary Health에서 차세대 의료를 경험해 보세요. 첨단 진단과 회복 중심의 프리미엄 환경이 하나의 의료 시스템 안에서 조화를 이룹니다.',
      heroBadge: '24시간 케어',
      heroPrimary: '여정 시작하기',
      heroSecondary: '서비스 둘러보기',
      partnerKicker: '신뢰받는 의료 네트워크',
      partners: [
        { name: '메드 글로벌', icon: 'cross' },
        { name: '얼라이언스 메디컬', icon: 'network' },
        { name: '힐 코프', icon: 'pulse' },
        { name: '프라이머리 케어 유니티', icon: 'shield' },
        { name: '트러스트 헬스', icon: 'trust' },
      ],
      appointmentKicker: '빠른 예약',
      appointmentDepartment: '진료과',
      appointmentDoctor: '의사 선택',
      appointmentDate: '날짜',
      appointmentTime: '시간',
      appointmentButton: '가능 시간 보기',
      departmentsKicker: '진료과 안내',
      departmentsTitle: '전문 분야 전반의 선도적 케어',
      learnMore: '자세히 보기',
      excellenceKicker: '치료의 기준',
      excellenceTitle: '왜 세계가 Sanctuary Health를 신뢰하는가',
      excellenceLead:
        '회복 중심의 공간, 정밀 의료 프로세스, 다학제 전문팀이 결합되어 환자에게 끊김 없는 케어 경험을 제공합니다.',
      satisfaction: '환자 만족도',
      stats: ['만족한 환자', '전문 의료진', '년의 경험', '케어 약속'],
      portalKicker: '환자 디지털 허브',
      portalTitle: '현대적 회복을 위한 설계',
      portalLead:
        '예약 관리, 검사 결과 확인, 처방 갱신 요청, 치료 여정 추적을 하나의 포털에서 간편하게 이용할 수 있습니다.',
      portalButton: '포털 열기',
      portalItems: ['내 기록', '검사 결과', '현재 처방', '다가오는 예약'],
      doctorsKicker: '의료진',
      doctorsTitle: '회복을 이끄는 전문가들',
      philosophyKicker: '힐링 철학',
      philosophyTitle: 'Sanctuary 철학',
      philosophyP1:
        '회복은 단순한 의료 행위가 아니라, 케어 환경 전반이 함께 만드는 통합적 과정입니다.',
      philosophyP2:
        '모든 공간과 동선, 회복 프로그램은 긴장을 낮추고 빛과 안정감, 협진을 통해 실제 치료 성과를 돕도록 설계되었습니다.',
      philosophyLink: 'Sanctuary 살펴보기',
      insightsKicker: '헬스 인사이트',
      insightsTitle: '지금 우리가 주목하는 변화',
      insightsLink: '더 많은 인사이트 보기',
      faqKicker: '자주 묻는 질문',
      faqTitle: 'FAQ',
      storiesKicker: '환자 이야기',
      storiesTitle: '회복의 목소리',
      ctaTitle: '회복 여정을 시작할 준비가 되셨나요?',
      ctaLead:
        '전문의들이 대면 및 비대면 상담을 모두 지원합니다. 더 나은 건강 여정을 지금 시작해 보세요.',
      ctaPrimary: '지금 예약하기',
      ctaSecondary: '의사 상담',
      visitKicker: 'Sanctuary 방문',
      visitTitle: 'Sanctuary 센터 방문',
      visitLead:
        '다낭의 실제 병원 위치를 지도와 함께 확인하고 연락처 및 길찾기 정보를 바로 볼 수 있습니다.',
      visitPoints: ['다낭 병원 위치', '연락처', '운영 시간'],
      visitDetails: [
        '124 Hai Phong St, Thach Thang Ward, Hai Chau District, Da Nang',
        'support@sanctuary.health · +84 1800 1234',
        '월-토 07:00 - 20:00 · 응급실 24/7',
      ],
      parking: '주차 안내',
      directions: '길찾기',
      footerLead: '현대적 회복을 위한 정밀 케어.',
      doctors: [
        { name: 'Dr. Olivia Vance', role: '심장내과 전문의', tag: '예약 가능', visual: 'doctor-one' },
        { name: 'Dr. Marcus Thorne', role: '신경과 센터장', tag: '연구 책임', visual: 'doctor-two' },
        { name: 'Dr. Sarah Chen', role: '소아과 전문의', tag: '추천', visual: 'doctor-three' },
        { name: 'Dr. Julian Arlo', role: '종양학 컨설턴트', tag: '신규', visual: 'doctor-four' },
      ],
      specialties: [
        { title: '심장내과', description: '최신 진단과 최소침습 중재를 기반으로 한 포괄적 심장 검진 프로그램입니다.', tone: 'blue', icon: '♥', badge: '조기 진단', metric: '주간 평가 플로우 운영' },
        { title: '신경과', description: '다학제 팀이 이끄는 정밀 진단과 현대적 신경 회복 경로를 제공합니다.', tone: 'soft', icon: '◉', badge: '통합 협진', metric: '다학제 케이스 리뷰' },
        { title: '소아과', description: '영유아부터 청소년까지 모든 성장 단계에 맞춘 따뜻한 진료를 제공합니다.', tone: 'green', icon: '◌', badge: '가족 중심', metric: '소아 전용 진료 동선' },
        { title: '종양학', description: '안전성과 편안함, 장기 추적 관리에 초점을 둔 통합 종양 치료입니다.', tone: 'white', icon: '✦', badge: '장기 관리', metric: '치료부터 추적관리까지 일관 운영' },
        { title: '응급·외상 허브', description: '24시간 신속 대응 체계와 전문 응급 인프라를 갖춘 핵심 센터입니다.', tone: 'featured', icon: '✚', badge: '24시간 대응', metric: '즉시 분류 및 현장 처치' },
        { title: '유전체 의학', description: '유전 정보와 정밀 의학 분석을 바탕으로 한 예측형 치료 모델입니다.', tone: 'white', icon: '◎', badge: '정밀 의료', metric: '예방 중심 위험 예측' },
      ],
      insights: [
        { title: '정기 검진에 적용되는 맞춤형 유전체 검사', text: '정밀 스크리닝이 예방 중심 진료의 핵심 요소로 확장되는 흐름을 살펴봅니다.', tone: 'insight-one' },
        { title: '자연 친화 공간이 회복을 돕는 이유', text: '차분한 공간 설계와 자연광이 왜 치료 환경에서 중요한지 다시 확인합니다.', tone: 'insight-two' },
        { title: '더 높아진 진단 정확도', text: '다학제 워크플로가 속도와 신뢰도를 동시에 끌어올리는 방법을 소개합니다.', tone: 'insight-three' },
      ],
      testimonials: [
        { quote: '처음 방문한 순간부터 모든 과정이 체계적이고 차분했습니다. 정말 신뢰할 수 있는 의료 경험이었습니다.', name: 'James Turner', role: '심장내과 환자' },
        { quote: '소아과 팀은 매우 친절했고 설명도 충분했습니다. 가족 모두가 안심할 수 있었습니다.', name: 'Mia Harper', role: '소아 환자 보호자' },
        { quote: '수준 높은 의료 서비스와 세심한 후속 관리 덕분에 힘든 치료 기간을 훨씬 안정적으로 보낼 수 있었습니다.', name: 'Daniel Miller', role: '회복 프로그램' },
      ],
      faqs: [
        {
          question: '처음 예약은 어떻게 하나요?',
          answer: '빠른 예약 카드에서 진료과, 의사, 시간을 선택하거나 지원팀에 문의하여 안내를 받을 수 있습니다.',
        },
        {
          question: '온라인으로 기록을 볼 수 있나요?',
          answer: '네. 환자 포털에서 검사 결과, 처방, 방문 기록, 예정된 예약을 한곳에서 확인할 수 있습니다.',
        },
        {
          question: '응급 진료도 가능한가요?',
          answer: '네. 응급·외상 허브는 24시간 운영되지만 위급 상황에서는 지역 응급 서비스에 즉시 연락해야 합니다.',
        },
      ],
    },
  };

  const t = copy[language];
  const specialties = t.specialties;
  const doctors = t.doctors;
  const insights = t.insights;
  const testimonials = t.testimonials;
  const faqs = t.faqs;
  const partners = t.partners;
  const portalFeatureMeta = {
    en: [
      { icon: '▣', detail: 'Centralized health timeline' },
      { icon: '◌', detail: 'Clear lab summaries and updates' },
      { icon: '✚', detail: 'Prescription tracking in one place' },
      { icon: '◔', detail: 'Upcoming visits and reminders' },
    ],
    vi: [
      { icon: '▣', detail: 'Theo dõi hồ sơ trong một dòng thời gian' },
      { icon: '◌', detail: 'Kết quả xét nghiệm rõ ràng, dễ xem' },
      { icon: '✚', detail: 'Quản lý đơn thuốc trên cùng một cổng' },
      { icon: '◔', detail: 'Nhắc lịch và lần khám sắp tới' },
    ],
    ko: [
      { icon: '▣', detail: '하나의 타임라인으로 기록 관리' },
      { icon: '◌', detail: '검사 결과를 쉽게 확인' },
      { icon: '✚', detail: '처방 이력을 한곳에서 추적' },
      { icon: '◔', detail: '예정된 방문과 알림 확인' },
    ],
  };
  const portalFeatures = t.portalItems.map((item, index) => ({
    title: item,
    ...portalFeatureMeta[language][index],
  }));
  const doctorSectionCopy = {
    en: {
      lead: 'Meet the multidisciplinary doctors guiding each patient through diagnosis, treatment planning, and long-term recovery.',
      action: 'View Profile',
    },
    vi: {
      lead: 'Gặp gỡ đội ngũ bác sĩ liên chuyên khoa đồng hành cùng người bệnh từ chẩn đoán, điều trị đến theo dõi hồi phục dài hạn.',
      action: 'Xem hồ sơ',
    },
    ko: {
      lead: '진단, 치료 계획, 회복 추적까지 함께하는 다학제 의료진을 소개합니다.',
      action: '프로필 보기',
    },
  };
  const doctorSection = doctorSectionCopy[language];
  const insightMeta = {
    en: [
      { label: 'Precision medicine', accent: 'Screening trends' },
      { label: 'Healing environment', accent: 'Recovery design' },
      { label: 'Multidisciplinary care', accent: 'Diagnostic flow' },
    ],
    vi: [
      { label: 'Y học chính xác', accent: 'Xu hướng sàng lọc' },
      { label: 'Không gian hồi phục', accent: 'Thiết kế chữa lành' },
      { label: 'Liên chuyên khoa', accent: 'Quy trình chẩn đoán' },
    ],
    ko: [
      { label: '정밀 의료', accent: '스크리닝 트렌드' },
      { label: '회복 공간', accent: '힐링 디자인' },
      { label: '다학제 진료', accent: '진단 프로세스' },
    ],
  };
  const faqLead = {
    en: 'Key answers that help patients navigate booking, records, and urgent care with more confidence.',
    vi: 'Những thông tin quan trọng giúp bệnh nhân nắm rõ đặt lịch, hồ sơ trực tuyến và hỗ trợ khẩn cấp.',
    ko: '예약, 온라인 기록, 응급 지원에 대해 환자가 빠르게 이해할 수 있도록 핵심 답변을 정리했습니다.',
  };
  const testimonialMeta = {
    en: [
      { badge: 'Care journey', visual: 'testimonial-one' },
      { badge: 'Family support', visual: 'testimonial-two' },
      { badge: 'Recovery program', visual: 'testimonial-three' },
    ],
    vi: [
      { badge: 'Hành trình điều trị', visual: 'testimonial-one' },
      { badge: 'Đồng hành gia đình', visual: 'testimonial-two' },
      { badge: 'Chương trình hồi phục', visual: 'testimonial-three' },
    ],
    ko: [
      { badge: '치료 여정', visual: 'testimonial-one' },
      { badge: '가족 지원', visual: 'testimonial-two' },
      { badge: '회복 프로그램', visual: 'testimonial-three' },
    ],
  };
  const storiesLead = {
    en: 'Experiences from patients and families who moved through diagnosis, treatment, and recovery with coordinated support.',
    vi: 'Những chia sẻ từ bệnh nhân và gia đình đã đi qua chẩn đoán, điều trị và hồi phục với sự đồng hành liên tục.',
    ko: '진단부터 치료, 회복까지 통합적인 지원을 경험한 환자와 가족의 이야기를 소개합니다.',
  };
  const ctaMeta = {
    en: ['Consultation in 24 hours', 'On-site and virtual support', 'Coordinated specialist team'],
    vi: ['Tư vấn trong 24 giờ', 'Hỗ trợ trực tiếp và trực tuyến', 'Đội ngũ chuyên khoa phối hợp'],
    ko: ['24시간 내 상담', '대면 및 비대면 지원', '협진 전문팀'],
  };
  const footerMeta = {
    en: {
      footerNav: 'Explore',
      footerContact: 'Contact',
      footerCare: 'Care Services',
      footerCareItems: ['Book appointments', 'Find specialists', 'View patient stories'],
      footerNote: 'Designed for modern, patient-centered recovery.',
      footerCopyright: 'Sanctuary Health. All rights reserved.',
    },
    vi: {
      footerNav: 'Khám phá',
      footerContact: 'Liên hệ',
      footerCare: 'Dịch vụ chăm sóc',
      footerCareItems: ['Đặt lịch khám', 'Tìm bác sĩ phù hợp', 'Xem câu chuyện bệnh nhân'],
      footerNote: 'Thiết kế cho hành trình phục hồi hiện đại, lấy bệnh nhân làm trung tâm.',
      footerCopyright: 'Sanctuary Health. Bảo lưu mọi quyền.',
    },
    ko: {
      footerNav: '탐색',
      footerContact: '연락처',
      footerCare: '케어 서비스',
      footerCareItems: ['진료 예약', '전문의 찾기', '환자 이야기 보기'],
      footerNote: '환자 중심의 현대적 회복 경험을 위해 설계되었습니다.',
      footerCopyright: 'Sanctuary Health. All rights reserved.',
    },
  };
  const visitMapQuery = '124 Hai Phong, Thach Thang, Hai Chau, Da Nang, Vietnam';
  const visitMapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(visitMapQuery)}&z=16&output=embed`;
  const visitMapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visitMapQuery)}`;
  const visitParkingLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`parking near ${visitMapQuery}`)}`;
  const footer = footerMeta[language];
  const specialtyPanelCopy = {
    en: {
      lead:
        'A curated network of programs designed for prevention, acute response, and high-complexity treatment in one cohesive experience.',
      bullets: ['6 flagship specialties', '24/7 emergency readiness', 'Personalized care pathways'],
      emphasis: 'Built to move patients from screening to treatment without friction.',
    },
    vi: {
      lead:
        'Một hệ thống chuyên khoa được tuyển chọn để bao phủ từ dự phòng, cấp cứu đến điều trị chuyên sâu trong cùng một trải nghiệm xuyên suốt.',
      bullets: ['6 chuyên khoa nổi bật', 'Vận hành cấp cứu 24/7', 'Lộ trình điều trị cá nhân hóa'],
      emphasis: 'Thiết kế để người bệnh đi từ sàng lọc đến điều trị mà không bị đứt quãng.',
    },
    ko: {
      lead:
        '예방, 응급 대응, 고난도 치료를 하나의 일관된 경험으로 연결한 핵심 진료 프로그램 포트폴리오입니다.',
      bullets: ['6개 대표 진료과', '24시간 응급 대응', '개인 맞춤 진료 경로'],
      emphasis: '검진부터 치료까지 끊김 없이 이어지는 흐름을 목표로 설계되었습니다.',
    },
  };
  const specialtyPanel = specialtyPanelCopy[language];
  const appointmentServices = ['Dental Therapy', 'Advanced Cardiology', 'Pediatrics', 'Neurology'];
  const appointmentDoctors = ['Dr. Sarah Williams', 'Dr. Olivia Vance', 'Dr. Marcus Thorne', 'Dr. Sarah Chen'];
  const appointmentTimes = ['08:00', '09:30', '10:30', '13:30', '15:00', '16:30'];
  const appointmentDates = ['2026-04-15', '2026-04-16', '2026-04-17', '2026-04-20', '2026-04-21', '2026-04-22'];
  const appointmentWeekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const appointmentCalendarDays = Array.from({ length: 21 }, (_, index) => {
    const day = index + 8;
    return `2026-04-${String(day).padStart(2, '0')}`;
  });

  function handleAppointmentChange(event) {
    const { name, value } = event.target;
    setAppointmentForm((current) => ({ ...current, [name]: value }));
  }

  function handleAppointmentSelect(name, value) {
    setAppointmentForm((current) => ({ ...current, [name]: value }));
    setOpenAppointmentPicker('');
  }

function formatAppointmentDate(value) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function PartnerIcon({ type }) {
  const icons = {
    cross: (
      <svg viewBox="0 0 32 32" role="img">
        <path d="M13 5h6v8h8v6h-8v8h-6v-8H5v-6h8V5Z" />
      </svg>
    ),
    shield: (
      <svg viewBox="0 0 32 32" role="img">
        <path d="M16 4 26 8v7.1c0 6.1-3.8 10.8-10 12.9C9.8 25.9 6 21.2 6 15.1V8l10-4Z" />
        <path d="m11.5 16.1 3.1 3.1 6.4-7" />
      </svg>
    ),
    pulse: (
      <svg viewBox="0 0 32 32" role="img">
        <path d="M4 17h5l2.2-5.7 4.2 12.2 3.5-14L22 17h6" />
      </svg>
    ),
    network: (
      <svg viewBox="0 0 32 32" role="img">
        <circle cx="9" cy="10" r="4" />
        <circle cx="23" cy="10" r="4" />
        <circle cx="16" cy="23" r="4" />
        <path d="M12.4 12.3 14 19M19.6 12.3 18 19M13 23h6" />
      </svg>
    ),
    trust: (
      <svg viewBox="0 0 32 32" role="img">
        <path d="M8 17.5 13.2 23 24 9" />
        <path d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24Z" />
      </svg>
    ),
  };

  return <span className={`home-partners__mark home-partners__mark--${type}`} aria-hidden="true">{icons[type]}</span>;
}

  function handleLogout() {
    clearStoredAuth();
    navigate('/login', { replace: true });
  }

  return (
    <main className="home-shell" id="top">
      <MarketingHeader labels={t} language={language} setLanguage={setLanguage} profile={profile} onLogout={handleLogout} activeKey="home" />

      <section className="home-hero">
        <div className="home-hero__backdrop" aria-hidden="true" />
        <div className="home-hero__badge" aria-label={t.heroBadge}>
          <span aria-hidden="true">✚</span>
          {t.heroBadge}
        </div>

        <div className="home-hero__content">
          <p className="home-kicker">{t.heroKicker}</p>
          <h1>{t.heroTitle}</h1>
          <p className="home-hero__lead">{t.heroLead}</p>

          <div className="home-hero__buttons">
            <a className="home-btn home-btn--primary" href="#departments">
              <span className="home-btn__icon home-btn__icon--calendar" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M7 2.75v3M17 2.75v3M4.75 9.25h14.5" />
                  <path d="M6.4 5h11.2c1.35 0 2.4 1.08 2.4 2.45v10.1c0 1.37-1.05 2.45-2.4 2.45H6.4C5.05 20 4 18.92 4 17.55V7.45C4 6.08 5.05 5 6.4 5Z" />
                  <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.25h.01M12 16.25h.01" />
                </svg>
              </span>
              {t.heroPrimary}
            </a>
            <a className="home-btn home-btn--secondary" href="#services">
              <span className="home-btn__icon home-btn__icon--play" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M9 7.6v8.8c0 .72.78 1.16 1.4.8l7.15-4.4a.94.94 0 0 0 0-1.6L10.4 6.8A.92.92 0 0 0 9 7.6Z" />
                </svg>
              </span>
              {t.heroSecondary}
            </a>
          </div>
        </div>

        <aside className="home-appointment">
          <p className="home-appointment__kicker">{t.appointmentKicker}</p>
          <form className="home-appointment__form">
            <label className="home-appointment-field">
              <span>{t.appointmentDepartment}</span>
              <div className="home-picker">
                <button type="button" className="home-picker__trigger" onClick={() => setOpenAppointmentPicker(openAppointmentPicker === 'service' ? '' : 'service')}>
                  <span>{appointmentForm.service}</span>
                  <span aria-hidden="true">⌄</span>
                </button>
                {openAppointmentPicker === 'service' ? (
                  <div className="home-picker__menu">
                    {appointmentServices.map((item) => (
                      <button key={item} type="button" className={appointmentForm.service === item ? 'is-active' : ''} onClick={() => handleAppointmentSelect('service', item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
            <label className="home-appointment-field">
              <span>{t.appointmentDoctor}</span>
              <div className="home-picker">
                <button type="button" className="home-picker__trigger" onClick={() => setOpenAppointmentPicker(openAppointmentPicker === 'doctor' ? '' : 'doctor')}>
                  <span>{appointmentForm.doctor}</span>
                  <span aria-hidden="true">⌄</span>
                </button>
                {openAppointmentPicker === 'doctor' ? (
                  <div className="home-picker__menu">
                    {appointmentDoctors.map((item) => (
                      <button key={item} type="button" className={appointmentForm.doctor === item ? 'is-active' : ''} onClick={() => handleAppointmentSelect('doctor', item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </label>
            <div className="home-appointment__row">
              <label className="home-appointment-field">
                <span>{t.appointmentDate}</span>
                <div className="home-picker">
                  <button type="button" className="home-picker__trigger home-picker__trigger--compact" onClick={() => setOpenAppointmentPicker(openAppointmentPicker === 'date' ? '' : 'date')}>
                    <span>{formatAppointmentDate(appointmentForm.date)}</span>
                    <span aria-hidden="true">▣</span>
                  </button>
                  {openAppointmentPicker === 'date' ? (
                    <div className="home-picker__menu home-picker__menu--calendar">
                      <div className="home-mini-calendar__head">
                        <strong>April 2026</strong>
                        <span>Available days</span>
                      </div>
                      <div className="home-mini-calendar__weekdays">
                        {appointmentWeekdays.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                      <div className="home-mini-calendar__grid">
                        {appointmentCalendarDays.map((item) => (
                          <button key={item} type="button" className={appointmentForm.date === item ? 'is-active' : ''} disabled={!appointmentDates.includes(item)} onClick={() => handleAppointmentSelect('date', item)}>
                            {item.split('-')[2]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </label>
              <label className="home-appointment-field">
                <span>{t.appointmentTime}</span>
                <div className="home-picker">
                  <button type="button" className="home-picker__trigger home-picker__trigger--compact" onClick={() => setOpenAppointmentPicker(openAppointmentPicker === 'time' ? '' : 'time')}>
                    <span>{appointmentForm.time}</span>
                    <span aria-hidden="true">◷</span>
                  </button>
                  {openAppointmentPicker === 'time' ? (
                    <div className="home-picker__menu home-picker__menu--time">
                      {appointmentTimes.map((item) => (
                        <button key={item} type="button" className={appointmentForm.time === item ? 'is-active' : ''} onClick={() => handleAppointmentSelect('time', item)}>
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>
            </div>
            <button type="button" className="home-appointment__submit">{t.appointmentButton}</button>
          </form>
        </aside>
      </section>

      <section className="home-partners">
        <div className="home-partners__intro">
          <span>{t.partnerKicker}</span>
        </div>
        <div className="home-partners__track">
          {partners.map((partner) => (
            <article key={partner.name} className="home-partners__card">
              <PartnerIcon type={partner.icon} />
              <strong>{partner.name}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-section--specialties" id="departments">
        <div className="specialty-showcase">
          <div className="specialty-header specialty-header--centered">
            <div className="home-section__heading-main specialty-heading specialty-heading--centered">
              <p className="home-kicker">{t.departmentsKicker}</p>
              <h2>{t.departmentsTitle}</h2>
              <p className="specialty-heading__lead">{specialtyPanel.lead}</p>
            </div>
            <div className="specialty-intro specialty-intro--inline">
              {specialtyPanel.bullets.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="specialty-grid specialty-grid--editorial">
            {specialties.map((item) => (
              <article key={item.title} className={`specialty-card specialty-card--editorial specialty-card--${item.tone}`}>
              <div className="specialty-card__top">
                <span className="specialty-card__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="specialty-card__badge">{item.badge}</span>
              </div>
              <div className="specialty-card__content">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <div className="specialty-card__footer">
                <span className="specialty-card__metric">{item.metric}</span>
                <a href="#services">
                  {t.learnMore}
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section home-excellence">
        <div className="home-excellence__media">
          <div className="home-excellence__image home-excellence__image--main" />
          <div className="home-excellence__panel home-excellence__panel--primary" aria-hidden="true" />
          <div className="home-excellence__panel home-excellence__panel--secondary" aria-hidden="true" />
          <div className="home-excellence__spark home-excellence__spark--one" aria-hidden="true" />
          <div className="home-excellence__spark home-excellence__spark--two" aria-hidden="true" />
          <div className="home-excellence__badge">
            <strong>99.8%</strong>
            <span>{t.satisfaction}</span>
          </div>
        </div>

        <div className="home-excellence__content">
          <p className="home-kicker">{t.excellenceKicker}</p>
          <h2>{t.excellenceTitle}</h2>
          <p>{t.excellenceLead}</p>

          <div className="home-stats">
            <article className="home-stats__card home-stats__card--patients">
              <span className="home-stats__icon" aria-hidden="true">♡</span>
              <strong>50,000+</strong>
              <span>{t.stats[0]}</span>
            </article>
            <article className="home-stats__card home-stats__card--doctors">
              <span className="home-stats__icon" aria-hidden="true">✚</span>
              <strong>200+</strong>
              <span>{t.stats[1]}</span>
            </article>
            <article className="home-stats__card home-stats__card--years">
              <span className="home-stats__icon" aria-hidden="true">◎</span>
              <strong>25+</strong>
              <span>{t.stats[2]}</span>
            </article>
            <article className="home-stats__card home-stats__card--care">
              <span className="home-stats__icon" aria-hidden="true">✓</span>
              <strong>100%</strong>
              <span>{t.stats[3]}</span>
            </article>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="home-portal">
          <div className="home-portal__copy">
            <p className="home-kicker">{t.portalKicker}</p>
            <h2>{t.portalTitle}</h2>
            <p>{t.portalLead}</p>
            <a className="home-btn home-btn--light" href="#visit">
              {t.portalButton}
            </a>
          </div>

          <div className="home-portal__features">
            {portalFeatures.map((item) => (
              <article key={item.title}>
                <span className="home-portal__feature-icon" aria-hidden="true">{item.icon}</span>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section" id="doctors">
        <div className="home-section__heading home-section__heading--split doctor-section__heading">
          <div>
            <p className="home-kicker">{t.doctorsKicker}</p>
            <h2>{t.doctorsTitle}</h2>
          </div>
          <p className="doctor-section__lead">{doctorSection.lead}</p>
        </div>

        <div className="doctor-grid">
          {doctors.map((doctor) => (
            <article key={doctor.name} className="doctor-card">
              <div className={`doctor-card__visual ${doctor.visual}`}>
                <span className="doctor-card__tag">{doctor.tag}</span>
              </div>
              <div className="doctor-card__body">
                <h3>{doctor.name}</h3>
                <p>{doctor.role}</p>
                <div className="doctor-card__footer">
                  <span>{doctor.tag}</span>
                  <a href="#visit">{doctorSection.action}</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-philosophy" id="services">
        <div className="home-philosophy__copy">
          <p className="home-kicker">{t.philosophyKicker}</p>
          <h2>{t.philosophyTitle}</h2>
          <p>{t.philosophyP1}</p>
          <p>{t.philosophyP2}</p>
          <a className="home-philosophy__link" href="#visit">
            {t.philosophyLink}
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="home-philosophy__gallery">
          <div className="gallery-card gallery-card--large">
            <div className="gallery-card__overlay">
              <span>{language === 'vi' ? 'Không gian hồi phục' : language === 'ko' ? '회복 공간' : 'Recovery spaces'}</span>
              <strong>{language === 'vi' ? 'Ánh sáng, tĩnh tại và riêng tư' : language === 'ko' ? '빛, 안정감, 프라이버시' : 'Light, calm, and privacy'}</strong>
            </div>
          </div>
          <div className="gallery-card gallery-card--small-top">
            <div className="gallery-card__overlay gallery-card__overlay--compact">
              <strong>{language === 'vi' ? 'Phối hợp liên chuyên khoa' : language === 'ko' ? '다학제 협진' : 'Multidisciplinary care'}</strong>
            </div>
          </div>
          <div className="gallery-card gallery-card--small-bottom">
            <div className="gallery-card__overlay gallery-card__overlay--compact">
              <strong>{language === 'vi' ? 'Lộ trình phục hồi cá nhân hóa' : language === 'ko' ? '개인 맞춤 회복 경로' : 'Personalized recovery path'}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section home-insights" id="insights">
        <div className="home-section__heading home-section__heading--split">
          <div>
            <p className="home-kicker">{t.insightsKicker}</p>
            <h2>{t.insightsTitle}</h2>
          </div>
          <a className="home-insights__link" href="#insights">
            {t.insightsLink}
          </a>
        </div>

        <div className="insight-grid">
          {insights.map((item, index) => (
            <article key={item.title} className="insight-card">
              <div className={`insight-card__visual ${item.tone}`}>
                <div className="insight-card__eyebrow">
                  <span>{insightMeta[language][index].label}</span>
                  <strong>{`0${index + 1}`}</strong>
                </div>
              </div>
              <div className="insight-card__body">
                <span className="insight-card__accent">{insightMeta[language][index].accent}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-faq" id="faq">
        <div className="home-section__heading home-section__heading--center">
          <p className="home-kicker">{t.faqKicker}</p>
          <h2>{t.faqTitle}</h2>
          <p className="home-faq__lead">{faqLead[language]}</p>
        </div>

        <div className="home-faq-grid">
          {faqs.map((item, index) => (
            <article key={item.question} className="home-faq-card">
              <div className="home-faq-card__top">
                <span className="home-faq-card__index">{`0${index + 1}`}</span>
                <span className="home-faq-card__icon" aria-hidden="true">
                  +
                </span>
              </div>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-stories">
        <div className="home-section__heading home-section__heading--center">
          <p className="home-kicker">{t.storiesKicker}</p>
          <h2>{t.storiesTitle}</h2>
          <p className="home-stories__lead">{storiesLead[language]}</p>
        </div>

        <div className="testimonial-grid">
          {testimonials.map((item, index) => (
            <article key={item.name} className="testimonial-card">
              <div className={`testimonial-card__visual ${testimonialMeta[language][index].visual}`}>
                <span className="testimonial-card__badge">{testimonialMeta[language][index].badge}</span>
                <span className="testimonial-card__quote-mark" aria-hidden="true">
                  "
                </span>
              </div>
              <div className="testimonial-card__body">
                <p>{item.quote}</p>
                <div className="testimonial-card__person">
                  <div className="testimonial-card__avatar" aria-hidden="true">
                    {item.name.charAt(0)}
                  </div>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.role}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-cta-section">
        <div className="home-cta">
          <div className="home-cta__copy">
            <p className="home-kicker">{t.ctaPrimary}</p>
            <h2>{t.ctaTitle}</h2>
            <p>{t.ctaLead}</p>
            <div className="home-cta__highlights">
              {ctaMeta[language].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="home-cta__actions">
            <a className="home-btn home-btn--secondary" href="#visit">
              {t.ctaPrimary}
            </a>
            <a className="home-btn home-btn--ghost" href="#doctors">
              {t.ctaSecondary}
            </a>
          </div>
        </div>
      </section>

      <section className="home-section home-visit" id="visit">
        <div className="home-visit__copy">
          <p className="home-kicker">{t.visitKicker}</p>
          <h2>{t.visitTitle}</h2>
          <p>{t.visitLead}</p>

          <div className="visit-points">
            <article>
              <span className="visit-points__icon" aria-hidden="true">
                ◎
              </span>
              <strong>{t.visitPoints[0]}</strong>
              <span>{t.visitDetails[0]}</span>
            </article>
            <article>
              <span className="visit-points__icon" aria-hidden="true">
                ◌
              </span>
              <strong>{t.visitPoints[1]}</strong>
              <span>{t.visitDetails[1]}</span>
            </article>
            <article>
              <span className="visit-points__icon" aria-hidden="true">
                ◔
              </span>
              <strong>{t.visitPoints[2]}</strong>
              <span>{t.visitDetails[2]}</span>
            </article>
          </div>
        </div>

        <div className="home-map-card">
          <div className="home-map-card__map">
            <iframe
              title="Google Map Da Nang Hospital"
              src={visitMapEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="home-map-card__floating">
              <strong>{t.visitPoints[0]}</strong>
              <span>{t.visitDetails[0]}</span>
            </div>
          </div>
          <div className="home-map-card__actions">
            <a href={visitParkingLink} target="_blank" rel="noreferrer">
              {t.parking}
            </a>
            <a href={visitMapLink} target="_blank" rel="noreferrer">
              {t.directions}
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter labels={{ ...t, ...footer }} footerLead={t.footerLead} visitDetails={t.visitDetails} directionsLabel={t.directions} secondaryLabel={t.ctaSecondary} />
    </main>
  );
}
