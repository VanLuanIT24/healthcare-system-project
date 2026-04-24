import React from 'react';
import { MarketingPageShell } from './MarketingPageShell';

const CONTACT_DETAILS = [
  {
    icon: '📍',
    title: 'Địa chỉ phòng khám',
    lines: ['124 Hải Phòng, phường Thạch Thang, quận Hải Châu, Đà Nẵng, Việt Nam'],
  },
  {
    icon: '📞',
    title: 'Số điện thoại',
    lines: ['Hotline: +84 1800 1234', 'Cấp cứu: 115'],
  },
  {
    icon: '✉️',
    title: 'Email hỗ trợ',
    lines: ['contact@sanctuaryhealth.vn', 'support@sanctuary.health'],
  },
];

const CONTACT_FAQ = [
  {
    question: 'Tôi có thể đặt lịch hẹn trực tuyến không?',
    answer:
      'Có. Bạn có thể gửi yêu cầu ngay tại biểu mẫu liên hệ hoặc đặt lịch trực tiếp từ cổng bệnh nhân để đội ngũ điều phối xác nhận khung giờ phù hợp.',
  },
  {
    question: 'Phòng khám có chấp nhận bảo hiểm không?',
    answer:
      'Bệnh viện làm việc với nhiều đối tác bảo hiểm và có thể hỗ trợ kiểm tra quyền lợi trước ngày hẹn để bạn chủ động hơn về chi phí.',
  },
  {
    question: 'Cần chuẩn bị gì trước khi đến khám tổng quát?',
    answer:
      'Bạn nên mang theo giấy tờ tùy thân, hồ sơ khám cũ và đơn thuốc đang sử dụng. Với một số xét nghiệm, đội ngũ hỗ trợ sẽ nhắc thêm về yêu cầu nhịn ăn hoặc thời điểm đến viện.',
  },
];

export function ContactPage() {
  return (
    <MarketingPageShell activeKey="contact">
      <section className="home-section site-page-section contact-page">
        <section className="contact-hero-banner">
          <div className="contact-hero-banner__copy">
            <h1>Liên hệ với chúng tôi</h1>
            <p>
              Chúng tôi ở đây để lắng nghe và chăm sóc sức khỏe của bạn. Đội ngũ chuyên gia của
              Sanctuary Health luôn sẵn sàng hỗ trợ mọi thắc mắc về dịch vụ và đặt lịch hẹn.
            </p>
          </div>
          <div className="contact-hero-banner__art" aria-hidden="true">
            <span className="contact-hero-banner__line" />
            <span className="contact-hero-banner__cross" />
          </div>
        </section>

        <section className="contact-main-grid">
          <form className="contact-message-card">
            <h2>Gửi tin nhắn cho chúng tôi</h2>
            <div className="contact-message-card__grid">
              <label>
                <span>Họ và tên</span>
                <input type="text" placeholder="Nguyễn Văn A" />
              </label>
              <label>
                <span>Email</span>
                <input type="email" placeholder="example@gmail.com" />
              </label>
              <label>
                <span>Số điện thoại</span>
                <input type="text" placeholder="0123 456 789" />
              </label>
              <label>
                <span>Chuyên khoa quan tâm</span>
                <select defaultValue="Tổng quát">
                  <option>Tổng quát</option>
                  <option>Tim mạch</option>
                  <option>Thần kinh</option>
                  <option>Nhi khoa</option>
                  <option>Ung bướu</option>
                </select>
              </label>
            </div>

            <label className="contact-message-card__textarea">
              <span>Lời nhắn</span>
              <textarea rows="6" placeholder="Chúng tôi có thể giúp gì cho bạn?" />
            </label>

            <button type="button">Gửi yêu cầu ngay</button>
          </form>

          <div className="contact-side-stack">
            <article className="contact-info-card">
              <h2>Thông tin liên lạc</h2>
              <div className="contact-info-card__list">
                {CONTACT_DETAILS.map((item) => (
                  <div key={item.title} className="contact-info-card__item">
                    <span className="contact-info-card__icon" aria-hidden="true">{item.icon}</span>
                    <div>
                      <strong>{item.title}</strong>
                      {item.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <span className="contact-info-card__hours">Giờ làm việc: 7:00 - 21:00 (Hằng ngày)</span>
            </article>

            <article className="contact-emergency-card">
              <h3>Cần tư vấn khẩn cấp?</h3>
              <p>
                Nếu bạn đang gặp các triệu chứng nghiêm trọng, vui lòng liên hệ ngay với đường dây nóng
                của chúng tôi.
              </p>
              <button type="button">📞 Gọi ngay: +84 1800 1234</button>
            </article>
          </div>
        </section>

        <section className="contact-map-showcase">
          <div className="contact-map-showcase__frame">
            <div className="contact-map-showcase__embed">
              <iframe
                title="Hospital location in Da Nang"
                src="https://www.google.com/maps?q=124%20Hai%20Phong%2C%20Thach%20Thang%2C%20Hai%20Chau%2C%20Da%20Nang%2C%20Vietnam&z=16&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <div className="contact-map-showcase__card">
              <strong>Sanctuary Health Center</strong>
              <p>Chúng tôi tọa lạc tại trung tâm thành phố, thuận tiện cho việc di chuyển của bệnh nhân.</p>
              <a
                href="https://www.google.com/maps/search/?api=1&query=124+Hai+Phong,+Thach+Thang,+Hai+Chau,+Da+Nang,+Vietnam"
                target="_blank"
                rel="noreferrer"
              >
                ⟡ Chỉ đường
              </a>
            </div>
          </div>
        </section>

        <section className="contact-faq-section">
          <div className="contact-faq-section__heading">
            <span>Hỗ trợ khách hàng</span>
            <h2>Câu hỏi thường gặp</h2>
          </div>

          <div className="contact-faq-section__list">
            {CONTACT_FAQ.map((item, index) => (
              <details key={item.question} className="contact-faq-section__item" open={index === 0}>
                <summary>
                  <span>{item.question}</span>
                  <span aria-hidden="true">⌄</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </MarketingPageShell>
  );
}
