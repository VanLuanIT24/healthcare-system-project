import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SITE_LANGUAGE_STORAGE_KEY = 'healthcare.siteLanguage';
const AUTH_STORAGE_KEY = 'healthcare.auth';

function readStoredSiteLanguage() {
  try {
    return localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY) || 'vi';
  } catch (error) {
    return 'vi';
  }
}

function writeStoredSiteLanguage(language) {
  localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, language);
}

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function getLanguageLabel(language) {
  if (language === 'en') return 'English';
  if (language === 'ko') return '한국어';
  return 'Tiếng Việt';
}

const pageCopy = {
  vi: {
    hotline: 'Hotline 1900-8888',
    care: 'Chăm sóc 24/7',
    portal: 'Cổng bệnh nhân',
    status: 'Nơi y học chính xác gặp hành trình hồi phục.',
    hello: 'Xin chào',
    logout: 'Đăng xuất',
    book: 'Đặt lịch hẹn',
    nav: [
      { key: 'home', label: 'Trang chủ', to: '/home' },
      { key: 'about', label: 'Giới thiệu', to: '/about' },
      { key: 'specialties', label: 'Chuyên khoa', to: '/home#departments' },
      { key: 'doctors', label: 'Bác sĩ', to: '/home#doctors' },
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
    footerCopyright: 'Sanctuary Health. Bảo lưu mọi quyền.',
    visitDetails: [
      '124 Hải Phòng, phường Thạch Thang, quận Hải Châu, Đà Nẵng',
      'support@sanctuary.health · +84 1800 1234',
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
    nav: [
      { key: 'home', label: 'Home', to: '/home' },
      { key: 'about', label: 'About', to: '/about' },
      { key: 'specialties', label: 'Specialties', to: '/home#departments' },
      { key: 'doctors', label: 'Doctors', to: '/home#doctors' },
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
    footerCopyright: 'Sanctuary Health. All rights reserved.',
    visitDetails: [
      '124 Hai Phong Street, Thach Thang Ward, Hai Chau District, Da Nang',
      'support@sanctuary.health · +84 1800 1234',
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
    nav: [
      { key: 'home', label: '홈', to: '/home' },
      { key: 'about', label: '병원 소개', to: '/about' },
      { key: 'specialties', label: '진료과', to: '/home#departments' },
      { key: 'doctors', label: '의료진', to: '/home#doctors' },
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
    footerCopyright: 'Sanctuary Health. All rights reserved.',
    visitDetails: [
      '124 Hai Phong St, Thach Thang Ward, Hai Chau District, Da Nang',
      'support@sanctuary.health · +84 1800 1234',
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
  const [language, setLanguageState] = useState(() => readStoredSiteLanguage());
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const t = useMemo(() => pageCopy[language] || pageCopy.vi, [language]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsLanguageMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function setLanguage(nextLanguage) {
    setLanguageState(nextLanguage);
    writeStoredSiteLanguage(nextLanguage);
  }

  function handleLogout() {
    clearStoredAuth();
    navigate('/login', { replace: true });
  }

  return (
    <main className="home-shell site-page-shell">
      <div className="home-topbar">
        <div className="home-topbar__left">
          <span>✆ {t.hotline}</span>
          <span>✚ {t.care}</span>
        </div>
        <div className="home-topbar__right">
          <div className="home-language" ref={menuRef}>
            <button
              type="button"
              className="home-language__trigger"
              onClick={() => setIsLanguageMenuOpen((current) => !current)}
              aria-expanded={isLanguageMenuOpen}
            >
              <span className="home-language__icon" aria-hidden="true">🌐</span>
              <span>{getLanguageLabel(language)}</span>
              <span className="home-language__caret" aria-hidden="true">▾</span>
            </button>
            {isLanguageMenuOpen ? (
              <div className="home-language__menu">
                <button type="button" className={language === 'en' ? 'is-active' : ''} onClick={() => { setLanguage('en'); setIsLanguageMenuOpen(false); }}>English</button>
                <button type="button" className={language === 'vi' ? 'is-active' : ''} onClick={() => { setLanguage('vi'); setIsLanguageMenuOpen(false); }}>Tiếng Việt</button>
                <button type="button" className={language === 'ko' ? 'is-active' : ''} onClick={() => { setLanguage('ko'); setIsLanguageMenuOpen(false); }}>한국어</button>
              </div>
            ) : null}
          </div>
          <span>{t.portal}</span>
        </div>
      </div>

      <header className="home-header">
        <div className="home-header__brand">
          <Link className="home-header__brandmark home-header__brandmark--link" to="/home">
            <span className="home-header__logo-icon" aria-hidden="true">
              <span className="home-header__logo-orbit home-header__logo-orbit--outer" />
              <span className="home-header__logo-orbit home-header__logo-orbit--inner" />
              <span className="home-header__logo-core" />
              <span className="home-header__logo-plus home-header__logo-plus--vertical" />
              <span className="home-header__logo-plus home-header__logo-plus--horizontal" />
              <span className="home-header__logo-spark home-header__logo-spark--one" />
              <span className="home-header__logo-spark home-header__logo-spark--two" />
            </span>
            <span className="home-header__logo">Healthcare Plus+</span>
          </Link>
          <span className="home-header__status">{t.status}</span>
        </div>

        <nav className="home-header__nav">
          {t.nav.map((item, index) => {
            const keys = ['home', 'about', 'specialties', 'doctors', 'news', 'faq', 'contact'];
            const key = keys[index];
            return (
              <Link key={key} className={activeKey === key ? 'is-active' : ''} to={t.nav[index] === item ? pageCopy[language].nav[index].to : '/home'}>
                {item.label || item}
              </Link>
            );
          })}
        </nav>

        <div className="home-header__actions">
          {profile ? <span className="home-header__welcome">{t.hello}, {profile.full_name}</span> : null}
          <Link className="home-header__button" to="/support">{t.book}</Link>
          {profile ? <button type="button" className="home-header__ghost" onClick={handleLogout}>{t.logout}</button> : null}
        </div>
      </header>

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
            <span className="home-footer__eyebrow">Sanctuary Health</span>
            <strong>Healthcare Plus+</strong>
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
            <Link to="/home#doctors">{t.ctaSecondary}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
