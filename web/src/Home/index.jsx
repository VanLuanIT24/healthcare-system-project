import { Link } from 'react-router-dom'
import { useAuth } from '../Home/context/AuthContext'
import { useState, useRef, useEffect } from 'react'

export default function HomePage() {
  const { user, logout } = useAuth()
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const doctors = [
    { id: 1, name: 'Phạm Văn An',     specialty: 'Tim mạch',   avatar: 'https://i.pravatar.cc/80?img=11' },
    { id: 2, name: 'Nguyễn Thị Bình', specialty: 'Nội khoa',   avatar: 'https://i.pravatar.cc/80?img=47' },
    { id: 3, name: 'Trần Văn Cường',  specialty: 'Ngoại khoa', avatar: 'https://i.pravatar.cc/80?img=12' },
  ]

  const facilities = [
    { id: 1, name: 'Phòng khám',       img: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=300&q=70' },
    { id: 2, name: 'Phòng X-Ray',      img: 'https://images.unsplash.com/photo-1551601651-09492b5468b6?w=300&q=70' },
    { id: 3, name: 'Phòng phẫu thuật', img: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=300&q=70' },
  ]

  const features = [
    { icon: '📋', title: 'Lịch sử hình thành',  desc: 'Lịch sử liên hệ bác sĩ từ cuộc gọi khám bệnh.' },
    { icon: '🧠', title: 'Tầm nhìn – Sứ mệnh',  desc: 'Tầm nhìn và sứ mệnh chăm sóc bệnh nhân tổng hợp.' },
    { icon: '❤️', title: 'Giá trị cốt lõi',      desc: 'Yêu Thương và Công Nghệ cùng nhau phát triển.' },
    { icon: '📊', title: 'Báo cáo chi tiết',      desc: 'Theo dõi sức khỏe, hồ sơ bệnh án số hóa đầy đủ.' },
    { icon: '💊', title: 'Toa thuốc điện tử',    desc: 'Kê đơn và quản lý thuốc nhanh chóng, chính xác.' },
    { icon: '🏥', title: 'Hệ thống toàn diện',   desc: 'Quản lý y tế hạng nhất, chăm sóc toàn diện.' },
  ]

  const faqItems = [
    { id: 1, question: 'Làm thế nào để đăng ký tài khoản?',          answer: 'Nhấp vào nút "Đăng ký" ở trên cùng và điền các thông tin cần thiết. Tài khoản của bạn sẽ được tạo ngay lập tức.' },
    { id: 2, question: 'Dữ liệu của tôi có an toàn không?',           answer: 'Có, chúng tôi sử dụng mã hóa end-to-end và tuân thủ các tiêu chuẩn bảo mật y tế quốc tế nhất.' },
    { id: 3, question: 'Tôi có thể truy cập từ thiết bị di động không?', answer: 'Có, HealthCare System hoàn toàn tương thích với các thiết bị di động và máy tính để bàn.' },
  ]

  const toggleFaq = (id) => setExpandedFaq(expandedFaq === id ? null : id)

  return (
    <div className="hc-page">

      {/* ====================================================
          HEADER — logo trái | nav giữa | actions phải
      ==================================================== */}
      <header className="hc-header">
        <div className="hc-header-inner">

          {/* Logo — trái */}
          <Link to="/" className="hc-logo">
            <img src="images/logo.png" alt="HealthCare Logo" className="hc-logo-icon" />
            <span className="hc-logo-text">HealthCare</span>
          </Link>

          {/* Nav — giữa */}
          <nav className="hc-nav-center">
            <a href="#"        className="hc-navlink">Trang Chủ</a>
            <a href="#features" className="hc-navlink">Chuyên Khoa <span className="nav-arrow">▾</span></a>
            <a href="#about"   className="hc-navlink">Bác Sĩ</a>
            <a href="#faq"     className="hc-navlink">Dịch vụ<span className="nav-arrow">▾</span></a>
            <a href="#support" className="hc-navlink">Tin Tức</a>
            <a href="#support" className="hc-navlink">Hướng Dẫn</a>
          </nav>

          {/* Actions — phải */}
          <div className="hc-header-actions">
            {user ? (
              /* ── Đã đăng nhập: avatar dropdown ── */
              <div className="hc-profile-wrap" ref={profileRef}>
                <button
                  className="hc-profile-btn"
                  onClick={() => setProfileOpen(o => !o)}
                  title="Hồ sơ cá nhân"
                >
                  <img
                    src={`https://i.pravatar.cc/40?u=${user.email || 'user'}`}
                    alt="Avatar"
                    className="hc-avatar-img"
                  />
                  <div className="hc-avatar-info">
                    <span className="hc-avatar-name">{user.fullName || user.email || 'Người dùng'}</span>
                    <span className="hc-avatar-role">Thành viên</span>
                  </div>
                  <span className="hc-avatar-caret">{profileOpen ? '▴' : '▾'}</span>
                </button>

                {profileOpen && (
                  <div className="hc-profile-dropdown">
                    <div className="hc-pd-header">
                      <img src={`https://i.pravatar.cc/48?u=${user.email || 'user'}`} alt="" className="hc-pd-avatar" />
                      <div>
                        <div className="hc-pd-name">{user.fullName || user.email}</div>
                        <div className="hc-pd-email">{user.email}</div>
                      </div>
                    </div>
                    <div className="hc-pd-divider" />
                    <Link to="/dashboard"  className="hc-pd-item" onClick={() => setProfileOpen(false)}>
                      <span>🏠</span> Dashboard
                    </Link>
                    <Link to="/ho-so"      className="hc-pd-item" onClick={() => setProfileOpen(false)}>
                      <span>👤</span> Hồ sơ cá nhân
                    </Link>
                    <Link to="/cai-dat"    className="hc-pd-item" onClick={() => setProfileOpen(false)}>
                      <span>⚙️</span> Cài đặt
                    </Link>
                    <div className="hc-pd-divider" />
                    <button className="hc-pd-item hc-pd-logout" onClick={() => { logout(); setProfileOpen(false) }}>
                      <span>🚪</span> Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* ── Chưa đăng nhập: nút đăng nhập + đăng ký ── */
              <>
                <Link to="/dang-nhap" className="hc-btn-login">Đăng nhập</Link>
                <Link to="/dang-ky"   className="hc-btn-register"> Đăng Ký</Link>
              </>
            )}
          </div>

        </div>
      </header>

      {/* ====================================================
          HERO — full BG image + centered glass card
      ==================================================== */}
      <section className="hc-hero">
        <img
          className="hc-hero-bg"
          src="images\30444580-c8b3-4021-b307-240422529353.jpg"
          alt="Hospital background"
        />


        {/* Floating decorative */}
        <div className="hf-deco hf-1">⏰</div>
        <div className="hf-deco hf-2">❤️‍🩹</div>
        <div className="hf-deco hf-3">🩺</div>
        <div className="hf-deco hf-4">💉</div>

        {/* Centered glass card */}
        <div className="hc-hero-card">
          <p className="hc-hero-label">Về Chúng Tôi</p>
          <h1 className="hc-hero-title">
            Hệ thống y tế hiện đại,<br />chăm sóc bệnh nhân toàn diện
          </h1>
          <p className="hc-hero-sub">Nơi Yêu Thương và Công Nghệ Gặp Nhau.</p>
          <div className="hc-hero-btns">
            {user ? (
              <Link to="/dashboard" className="hc-btn-teal">Dashboard</Link>
            ) : (
              <>
                <Link to="/dang-ky"   className="hc-btn-teal">Tìm Hiểu Thêm</Link>
                <Link to="/dang-nhap" className="hc-btn-ghost">Đặt Lịch Khám</Link>
              </>
            )}
          </div>
        </div>

        {/* Chips at bottom of hero */}
        <div className="hc-chips-wrap">
          {features.map((f, i) => (
            <div className="hc-chip" key={i}>
              <div className="hc-chip-icon">{f.icon}</div>
              <div>
                <div className="hc-chip-title">{f.title}</div>
                <div className="hc-chip-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ====================================================
          SECOND ROW: Stats / Doctors / Facilities
      ==================================================== */}
      <section className="hc-second-row">
        {/* Stats */}
        <div className="hc-panel">
          <p className="hc-panel-label">Số liệu nổi bật</p>
          <div className="hc-stats">
            <div className="hc-stat"><div className="hc-stat-num">10+</div><div className="hc-stat-sub">năm</div></div>
            <div className="hc-stat-div" />
            <div className="hc-stat"><div className="hc-stat-num">50+</div><div className="hc-stat-sub">bác sĩ</div></div>
            <div className="hc-stat-div" />
            <div className="hc-stat"><div className="hc-stat-num">100.000+</div><div className="hc-stat-sub">bệnh nhân</div></div>
          </div>
        </div>

        {/* Doctors */}
        <div className="hc-panel">
          <div className="hc-panel-head">
            <span className="hc-panel-title">Đội ngũ bác sĩ</span>
            <div className="hc-arrows"><button>‹</button><button>›</button></div>
          </div>
          <div className="hc-doctor-row">
            {doctors.map(d => (
              <div key={d.id} className="hc-doctor">
                <img src={d.avatar} alt={d.name} className="hc-doctor-img" />
                <div className="hc-doctor-name">{d.name}</div>
                <div className="hc-doctor-spec">{d.specialty}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Facilities */}
        <div className="hc-panel">
          <div className="hc-panel-head">
            <span className="hc-panel-title">Cơ sở vật chất</span>
            <div className="hc-arrows"><button>‹</button><button>›</button></div>
          </div>
          <div className="hc-facility-row">
            {facilities.map(f => (
              <div key={f.id} className="hc-facility">
                <img src={f.img} alt={f.name} className="hc-facility-img" />
                <div className="hc-facility-name">{f.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====================================================
          SUPPORT SECTION
      ==================================================== */}
      <section className="hc-support" id="support">
        <div className="hc-s-deco hc-sd1">🩺</div>
        <div className="hc-s-deco hc-sd2">⚛️</div>
        <div className="hc-s-deco hc-sd3">✚</div>
        <div className="hc-s-deco hc-sd4">⚛️</div>

        <div className="hc-support-inner">
          {/* Info */}
          <div className="hc-support-info">
            <p className="hc-s-eyebrow">LIÊN HỆ VỚI CHÚNG TÔI</p>
            <h2 className="hc-s-heading">Hỗ trợ 24/7</h2>
            <div className="hc-sinfo-grid">
              {[
                { color: 'teal',   icon: '📍', title: 'Địa chỉ',      desc: '123 Nguyễn Văn Linh, Đà Nẵng' },
                { color: 'orange', icon: '📞', title: 'Hotline',       desc: '09120 345 789' },
                { color: 'pink',   icon: '✉️', title: 'Email',         desc: 'support@healthcare.local' },
                { color: 'cyan',   icon: '🕐', title: 'Giờ làm việc', desc: 'Thứ 2 – Thứ 7\n08:00 – 17:00' },
              ].map((c, i) => (
                <div key={i} className="hc-sinfo-card">
                  <div className={`hc-sinfo-icon hc-sicon-${c.color}`}>{c.icon}</div>
                  <div>
                    <div className="hc-sinfo-title">{c.title}</div>
                    <div className="hc-sinfo-desc">{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          <div className="hc-support-map">
            <iframe
              title="Bản đồ"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3834.2765!2d108.2021!3d16.0544!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTbCsDAzJzE1LjkiTiAxMDjCsDEyJzA3LjYiRQ!5e0!3m2!1svi!2s!4v1"
              width="100%" height="100%"
              style={{ border: 0 }}
              allowFullScreen loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          {/* Form + FAQ */}
          <div className="hc-support-form">
            <h3 className="hc-sf-title">Form liên hệ</h3>
            <input    className="hc-sf-input"    type="text" placeholder="Họ tên" />
            <input    className="hc-sf-input"    type="text" placeholder="Email / SĐT" />
            <textarea className="hc-sf-textarea" placeholder="Nội dung" rows={3} />
            <select   className="hc-sf-select">
              <option>Tư vấn, Khiếu nại...</option>
              <option>Đặt lịch khám</option>
              <option>Hỏi về dịch vụ</option>
            </select>
            <button className="hc-sf-submit">Gửi yêu cầu</button>
          </div>
        </div>
      </section>

      {/* CTA */}

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>✚ HealthCare System</h4>
            <p>Nền tảng quản lý sức khỏe hiện đại, chăm sóc bệnh nhân toàn diện.</p>
          </div>
          <div className="footer-section">
            <h4>Liên Kết Nhanh</h4>
            <ul>
              <li><a href="#features">Tính năng</a></li>
              <li><a href="#about">Về chúng tôi</a></li>
              <li><a href="#support">Hỗ trợ</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Pháp Lý</h4>
            <ul>
              <li><Link to="/terms">Điều khoản Dịch vụ</Link></li>
              <li><Link to="/privacy">Chính sách Bảo mật</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Liên Hệ</h4>
            <ul>
              <li><a href="tel:+84123456789">📞 +84 123 456 789</a></li>
              <li><a href="mailto:support@healthcare.local">✉️ support@healthcare.local</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 HealthCare System. Tất cả các quyền được bảo lưu.</p>
        </div>
      </footer>
    </div>
  )
}
