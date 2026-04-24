import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { readStoredSiteLanguage, writeStoredSiteLanguage } from '../lib/storage';
export function useSiteLanguage(defaultLanguage = 'vi') {
  const [language, setLanguageState] = useState(() => readStoredSiteLanguage() || defaultLanguage);
  function setLanguage(nextLanguage) {
    setLanguageState(nextLanguage);
    writeStoredSiteLanguage(nextLanguage);
  }
  return [language, setLanguage];
}
function getLanguageLabel(language) {
  if (language === 'en') return 'English';
  if (language === 'ko') return '한국어';
  return 'Tieng Viet';
}
function getMarketingNavItems(labels) {
  return [
    { key: 'home', label: labels.nav[0], to: '/home' },
    { key: 'about', label: labels.nav[1], to: '/about' },
    { key: 'specialties', label: labels.nav[2], to: '/home#departments' },
    { key: 'doctors', label: labels.nav[3], to: '/home#doctors' },
    { key: 'news', label: labels.nav[4], to: '/news' },
    { key: 'faq', label: labels.nav[5], to: '/faq' },
    { key: 'contact', label: labels.nav[6], to: '/contact' },
  ];
}function MarketingTopbar({ labels, language, setLanguage }) {
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsLanguageMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="home-topbar">
      <div className="home-topbar__left">
        <span>✆ {labels.hotline}</span>
        <span>✚ {labels.care}</span>
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
              <button type="button" className={language === 'en' ? 'is-active' : ''} onClick={() => { setLanguage('en'); setIsLanguageMenuOpen(false); }}>
                English
              </button>
              <button type="button" className={language === 'vi' ? 'is-active' : ''} onClick={() => { setLanguage('vi'); setIsLanguageMenuOpen(false); }}>
                Tiếng Việt
              </button>
              <button type="button" className={language === 'ko' ? 'is-active' : ''} onClick={() => { setLanguage('ko'); setIsLanguageMenuOpen(false); }}>
                한국어
              </button>
            </div>
          ) : null}
        </div>
        <span>{labels.portal}</span>
      </div>
    </div>
  );
}

export function MarketingHeader({ labels, language, setLanguage, profile, onLogout, activeKey = 'home' }) {
  const navItems = getMarketingNavItems(labels);

  return (
    <>
      <MarketingTopbar labels={labels} language={language} setLanguage={setLanguage} />

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
          <span className="home-header__status">{labels.status}</span>
        </div>

        <nav className="home-header__nav">
          {navItems.map((item) => (
            <Link key={item.key} className={item.key === activeKey ? 'is-active' : ''} to={item.to}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="home-header__actions">
          {profile ? <span className="home-header__welcome">{labels.hello}, {profile.full_name}</span> : null}
          <Link className="home-header__button" to="/support">
            {labels.book}
          </Link>
          {profile && onLogout ? (
            <button type="button" className="home-header__ghost" onClick={onLogout}>
              {labels.logout}
            </button>
          ) : null}
        </div>
      </header>
    </>
  );
}

export function MarketingFooter({ labels, footerLead, visitDetails, directionsLabel, secondaryLabel }) {
  const navItems = getMarketingNavItems(labels);

  return (
    <footer className="home-footer">
      {/* Main Footer Content */}
      <div className="home-footer__main">
        <div className="home-footer__brand">
          <span className="home-footer__eyebrow">Healthcare Plus+</span>
          <strong>Your Trusted Health Partner</strong>
          <p>{footerLead}</p>
          <span className="home-footer__note">{labels.footerNote}</span>
          {/* Social Links */}
          <div className="home-footer__social">
            <a href="#facebook" title="Facebook" aria-label="Follow us on Facebook">f</a>
            <a href="#twitter" title="Twitter" aria-label="Follow us on Twitter">𝕏</a>
            <a href="#instagram" title="Instagram" aria-label="Follow us on Instagram">📷</a>
            <a href="#linkedin" title="LinkedIn" aria-label="Connect on LinkedIn">in</a>
          </div>
        </div>

        <div className="home-footer__column">
          <h3>{labels.footerNav}</h3>
          <div className="home-footer__links">
            {navItems.map((item) => (
              <Link key={item.key} to={item.to} className="home-footer__link">{item.label}</Link>
            ))}
          </div>
        </div>

        <div className="home-footer__column">
          <h3>{labels.footerContact}</h3>
          <div className="home-footer__stack">
            <span className="home-footer__item">📞 1900-8888</span>
            <span className="home-footer__item">📧 support@healthcareplus.vn</span>
            <span className="home-footer__item">📍 124 Hải Phòng, Đà Nẵng</span>
          </div>
        </div>

        <div className="home-footer__column">
          <h3>{labels.footerCare}</h3>
          <div className="home-footer__stack">
            <span className="home-footer__item">❤️ Cardiology</span>
            <span className="home-footer__item">🧠 Neurology</span>
            <span className="home-footer__item">👶 Pediatrics</span>
            <span className="home-footer__item">🚑 Emergency 24/7</span>
          </div>
        </div>
      </div>

      {/* Footer Divider */}
      <div className="home-footer__divider"></div>

      {/* Bottom Footer */}
      <div className="home-footer__bottom">
        <div className="home-footer__copyright">
          <span>&copy; 2026 Healthcare Plus+. All rights reserved.</span>
        </div>
        <div className="home-footer__mini-links">
          <Link to="/contact" className="home-footer__mini-link">{directionsLabel}</Link>
          <Link to="/about" className="home-footer__mini-link">About Us</Link>
          <Link to="/contact" className="home-footer__mini-link">Privacy Policy</Link>
          <Link to="/contact" className="home-footer__mini-link">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
