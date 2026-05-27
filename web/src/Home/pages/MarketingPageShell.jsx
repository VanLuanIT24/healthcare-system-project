import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLogo, APP_BRAND_NAME } from '../../app/AppLogo';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';
import { MarketingHeader, useSiteLanguage } from '../marketingChrome';

const pageCopy = {
  vi: {
    hotline: 'Hotline 1900-8888',
    care: 'Chăm sóc 24/7',
    portal: 'Cổng bệnh nhân',
    status: 'Nơi y học chính xác gặp hành trình hồi phục.',
    hello: 'Xin chào',
    logout: 'Đăng xuất',
    book: 'Đặt lịch hẹn',
    login: 'Đăng nhập',
    register: 'Đăng ký',
    nav: [
      { key: 'home', label: 'Trang chủ', to: '/home' },
      { key: 'about', label: 'Giới thiệu', to: '/about' },
      { key: 'specialties', label: 'Chuyên khoa', to: '/specialties' },
      { key: 'doctors', label: 'Bác sĩ', to: '/doctors' },
      { key: 'news', label: 'Tin tức', to: '/news' },
      { key: 'faq', label: 'FAQ', to: '/faq' },
      { key: 'contact', label: 'Liên hệ', to: '/contact' },
    ],
    footerLead: 'Chăm sóc chính xác cho hành trình phục hồi hiện đại.',
    footerNote: 'Thiết kế cho trải nghiệm hiện đại, rõ ràng và lấy bệnh nhân làm trung tâm.',
    footerNav: 'Khám phá',
    footerContact: 'Liên hệ',
    footerCare: 'Dịch vụ chăm sóc',
    footerCareItems: ['Đặt lịch khám', 'Tìm bác sĩ phù hợp', 'Xem câu chuyện bệnh nhân'],
    footerCopyright: 'Bộ Y tế. Bảo lưu mọi quyền.',
    visitDetails: [
      '124 Hải Phòng, phường Thạch Thang, quận Hải Châu, Đà Nẵng',
      'support@healthcareplus.vn · +84 1800 1234',
      'Thứ 2 - Thứ 7 07:00 - 20:00 · Cấp cứu 24/7',
    ],
    directions: 'Chỉ đường',
    ctaSecondary: 'Tư vấn bác sĩ',
  },
  en: {
    hotline: 'Hotline 1900-8888',
    care: 'Care 24/7',
    portal: 'Patient Portal',
    status: 'Where precision care meets a restorative journey.',
    hello: 'Hello',
    logout: 'Logout',
    book: 'Book Appointment',
    login: 'Login',
    register: 'Register',
    nav: [
      { key: 'home', label: 'Home', to: '/home' },
      { key: 'about', label: 'About', to: '/about' },
      { key: 'specialties', label: 'Specialties', to: '/specialties' },
      { key: 'doctors', label: 'Doctors', to: '/doctors' },
      { key: 'news', label: 'News', to: '/news' },
      { key: 'faq', label: 'FAQ', to: '/faq' },
      { key: 'contact', label: 'Contact', to: '/contact' },
    ],
    footerLead: 'Precision care designed for modern recovery.',
    footerNote: 'Built for a clear, modern, patient-centered hospital experience.',
    footerNav: 'Explore',
    footerContact: 'Contact',
    footerCare: 'Care Services',
    footerCareItems: ['Book appointments', 'Find specialists', 'View patient stories'],
    footerCopyright: 'Ministry of Health. All rights reserved.',
    visitDetails: [
      '124 Hai Phong Street, Thach Thang Ward, Hai Chau District, Da Nang',
      'support@healthcareplus.vn · +84 1800 1234',
      'Mon-Sat 07:00 - 20:00 · Emergency 24/7',
    ],
    directions: 'Get Directions',
    ctaSecondary: 'Consult a Doctor',
  },
  ko: {
    hotline: '핫라인 1900-8888',
    care: '24/7 케어',
    portal: '환자 포털',
    status: '정밀 의료와 회복 여정이 만나는 곳.',
    hello: '안녕하세요',
    logout: '로그아웃',
    book: '예약하기',
    login: '로그인',
    register: '회원가입',
    nav: [
      { key: 'home', label: '홈', to: '/home' },
      { key: 'about', label: '병원 소개', to: '/about' },
      { key: 'specialties', label: '진료과', to: '/specialties' },
      { key: 'doctors', label: '의료진', to: '/doctors' },
      { key: 'news', label: '뉴스', to: '/news' },
      { key: 'faq', label: 'FAQ', to: '/faq' },
      { key: 'contact', label: '문의', to: '/contact' },
    ],
    footerLead: '현대적 회복을 위한 정밀 케어.',
    footerNote: '환자 중심의 현대적 병원 경험을 위해 설계되었습니다.',
    footerNav: '탐색',
    footerContact: '연락처',
    footerCare: '케어 서비스',
    footerCareItems: ['진료 예약', '전문의 찾기', '환자 이야기 보기'],
    footerCopyright: 'Ministry of Health. All rights reserved.',
    visitDetails: [
      '124 Hai Phong St, Thach Thang Ward, Hai Chau District, Da Nang',
      'support@healthcareplus.vn · +84 1800 1234',
      '월-토 07:00 - 20:00 · 응급 24/7',
    ],
    directions: '길찾기',
    ctaSecondary: '의사 상담',
  },
};

export function MarketingPageShell({ activeKey, hero, children }) {
  const navigate = useNavigate();
  const auth = readStoredAuth();
  const profile = auth?.patient;
  const [language, setLanguage] = useSiteLanguage('vi');
  const t = useMemo(() => pageCopy[language] || pageCopy.vi, [language]);

  function handleLogout() {
    clearStoredAuth();
    navigate('/login', { replace: true });
  }

  return (
    <main className="home-shell site-page-shell">
      <MarketingHeader
        labels={t}
        language={language}
        setLanguage={setLanguage}
        profile={profile}
        onLogout={handleLogout}
        activeKey={activeKey}
        profileMenuVariant="compact"
      />

      {hero ? (
        <section className="home-section site-page-hero">
          <div className="site-page-hero__copy">
            <p className="home-kicker">{hero.kicker}</p>
            <h1>{hero.title}</h1>
            <p>{hero.lead}</p>
            {hero.footer ? <div className="site-page-hero__footer">{hero.footer}</div> : null}
          </div>
          <div className="site-page-hero__panel">{hero.panel}</div>
        </section>
      ) : null}

      {children}

      <footer className="home-footer">
        <div className="home-footer__main">
          <div className="home-footer__brand">
            <AppLogo variant="horizontal" />
            <span className="home-footer__eyebrow">{APP_BRAND_NAME}</span>
            <strong>{APP_BRAND_NAME}</strong>
            <p>{t.footerLead}</p>
            <span className="home-footer__note">{t.footerNote}</span>
          </div>
          <div className="home-footer__column">
            <h3>{t.footerNav}</h3>
            <div className="home-footer__links">
              {t.nav.map((item, index) => (
                <Link key={`${item.label || item}-${index}`} to={pageCopy[language].nav[index].to}>{item.label || item}</Link>
              ))}
            </div>
          </div>
          <div className="home-footer__column">
            <h3>{t.footerContact}</h3>
            <div className="home-footer__stack">
              {t.visitDetails.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <div className="home-footer__column">
            <h3>{t.footerCare}</h3>
            <div className="home-footer__stack">
              {t.footerCareItems.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
        </div>
        <div className="home-footer__bottom">
          <span>{t.footerCopyright}</span>
          <div className="home-footer__mini-links">
            <Link to="/contact">{t.directions}</Link>
            <Link to="/doctors">{t.ctaSecondary}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
