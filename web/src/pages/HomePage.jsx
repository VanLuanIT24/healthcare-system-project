import { Link } from 'react-router-dom';
import { SectionTitle } from '../components/SectionTitle';
import { articles, doctors, faqs, paymentPolicies, services, specialties } from '../data/siteContent';

const timelines = [
  '1. Chọn chuyên khoa hoặc bác sĩ phù hợp.',
  '2. Chọn khung giờ còn trống và xác nhận lịch hẹn.',
  '3. Đến trước 15 phút để check-in nhanh.',
  '4. Khám, nhận chỉ định và theo dõi kết quả trong cùng hành trình.',
];

export function HomePage() {
  return (
    <div>
      <section className="hero">
        <div className="hero__content">
          <span className="section-title__eyebrow">Chăm sóc chủ động, đặt lịch chủ động</span>
          <h1>Trải nghiệm y tế hiện đại, rõ ràng và thân thiện ngay từ lần truy cập đầu tiên.</h1>
          <p>
            Tìm bác sĩ, chọn chuyên khoa, xem lịch trống và đặt lịch khám chỉ trong vài bước. Giao diện được xây để dẫn bệnh nhân tới hành động chính một cách tự nhiên.
          </p>
          <div className="hero-actions">
            <Link className="cta-button" to="/huong-dan-dat-lich">
              Đặt lịch khám ngay
            </Link>
            <Link className="ghost-button" to="/bac-si">
              Tìm bác sĩ nhanh
            </Link>
          </div>
          <div className="hero-search">
            <input placeholder="Tìm bác sĩ, chuyên khoa hoặc dịch vụ..." />
            <button>Tìm kiếm</button>
          </div>
        </div>
        <div className="hero__panel">
          <div className="glass-card">
            <h3>Lịch sẵn sàng đặt hôm nay</h3>
            <ul className="slot-list">
              <li><strong>Tim mạch</strong><span>07:30, 08:00, 09:30</span></li>
              <li><strong>Nhi khoa</strong><span>08:30, 10:30, 14:30</span></li>
              <li><strong>Da liễu</strong><span>09:00, 11:00, 15:00</span></li>
            </ul>
          </div>
          <div className="hero__stats">
            <div><strong>35+</strong><span>Bác sĩ cộng tác</span></div>
            <div><strong>12</strong><span>Chuyên khoa trọng điểm</span></div>
            <div><strong>4.9/5</strong><span>Đánh giá trung bình</span></div>
          </div>
        </div>
      </section>

      <section className="section">
        <SectionTitle eyebrow="Chuyên khoa nổi bật" title="Đi đúng nơi ngay từ đầu" description="Danh mục chuyên khoa được trình bày theo nhu cầu tra cứu phổ biến của bệnh nhân." />
        <div className="card-grid card-grid--three">
          {specialties.slice(0, 6).map((item) => (
            <Link key={item.slug} to={`/chuyen-khoa/${item.slug}`} className="feature-card">
              <h3>{item.name}</h3>
              <p>{item.summary}</p>
              <span>{item.accent}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section--alt">
        <SectionTitle eyebrow="Bác sĩ nổi bật" title="Đội ngũ chuyên môn đáng tin cậy" description="Mỗi hồ sơ bác sĩ đều hiển thị chuyên môn, kinh nghiệm và lịch làm việc rõ ràng." />
        <div className="card-grid card-grid--two">
          {doctors.map((doctor) => (
            <Link key={doctor.slug} to={`/bac-si/${doctor.slug}`} className="doctor-card">
              <div>
                <p className="doctor-card__meta">{doctor.specialty}</p>
                <h3>{doctor.name}</h3>
                <p>{doctor.highlight}</p>
              </div>
              <div className="doctor-card__footer">
                <span>{doctor.experience}</span>
                <span>{doctor.schedule}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <SectionTitle eyebrow="Dịch vụ y tế" title="Dễ hiểu, dễ chọn, dễ hành động" />
        <div className="card-grid card-grid--three">
          {services.map((service) => (
            <Link key={service.slug} to={`/dich-vu/${service.slug}`} className="service-card">
              <h3>{service.name}</h3>
              <p>{service.summary}</p>
              <strong>{service.price}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section--highlight">
        <SectionTitle eyebrow="Quy trình khám bệnh" title="Hành trình rõ ràng trước khi bệnh nhân bước tới quầy tiếp đón" />
        <div className="timeline">
          {timelines.map((item) => (
            <div key={item} className="timeline__item">{item}</div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="two-column">
          <div>
            <SectionTitle eyebrow="Bảo hiểm và thanh toán" title="Chính sách minh bạch, dễ tra cứu" />
            <ul className="bullet-list">
              {paymentPolicies.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <SectionTitle eyebrow="FAQ" title="Những câu hỏi được quan tâm nhiều nhất" />
            <div className="faq-stack">
              {faqs.slice(0, 4).map((item) => (
                <article key={item.question} className="faq-card">
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section section--alt">
        <SectionTitle eyebrow="Tin tức sức khỏe" title="Bài viết hữu ích cho người bệnh và gia đình" />
        <div className="card-grid card-grid--three">
          {articles.map((article) => (
            <Link key={article.slug} to={`/tin-tuc/${article.slug}`} className="news-card">
              <span>{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <strong>{article.readTime}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section--contact">
        <div className="contact-panel">
          <div>
            <span className="section-title__eyebrow">Liên hệ nhanh</span>
            <h2>Trung tâm điều phối khám bệnh luôn sẵn sàng hỗ trợ.</h2>
            <p>Địa chỉ: 125 Nguyễn Đình Chiểu, Quận 3, TP.HCM</p>
            <p>Hotline: 1900 6868</p>
            <p>Liên hệ khẩn: 115 nội bộ</p>
          </div>
          <div className="map-placeholder">Bản đồ / vị trí cơ sở</div>
        </div>
      </section>
    </div>
  );
}
