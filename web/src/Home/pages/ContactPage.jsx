import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  HeartPulse,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { MarketingPageShell } from './MarketingPageShell';

const CONTACT_STATS = [
  { value: '<10 phút', label: 'phản hồi yêu cầu', icon: Clock3 },
  { value: '24/7', label: 'hotline điều phối', icon: HeartPulse },
  { value: '03 kênh', label: 'liên hệ trực tiếp', icon: MessageCircle },
];

const CONTACT_DETAILS = [
  {
    icon: MapPin,
    title: 'Địa chỉ trung tâm',
    lines: ['124 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng'],
    note: 'Gần trục tiếp nhận bệnh nhân quốc tế',
  },
  {
    icon: PhoneCall,
    title: 'Đường dây chăm sóc',
    lines: ['Hotline: +84 1800 1234', 'Cấp cứu: 115'],
    note: 'Điều phối viên trực 24/7',
  },
  {
    icon: Mail,
    title: 'Email hỗ trợ',
    lines: ['contact@sanctuaryhealth.vn', 'support@sanctuary.health'],
    note: 'Phản hồi trong giờ làm việc',
  },
  {
    icon: Clock3,
    title: 'Giờ tiếp nhận',
    lines: ['7:00 - 21:00 hằng ngày', 'Cấp cứu hoạt động cả ngày'],
    note: 'Ưu tiên lịch hẹn đã xác nhận',
  },
];

const CONTACT_PATHWAYS = [
  {
    icon: CalendarCheck,
    label: 'Đặt lịch khám',
    value: 'Xác nhận khung giờ phù hợp',
  },
  {
    icon: ShieldCheck,
    label: 'Bảo hiểm',
    value: 'Kiểm tra quyền lợi trước hẹn',
  },
  {
    icon: FileText,
    label: 'Hồ sơ y tế',
    value: 'Nhận kết quả và giấy tờ',
  },
];

const CONTACT_FAQ = [
  {
    question: 'Tôi có thể đặt lịch hẹn trực tuyến không?',
    answer:
      'Có. Bạn có thể gửi yêu cầu ngay tại biểu mẫu liên hệ hoặc đặt lịch trực tiếp từ cổng bệnh nhân để đội ngũ điều phối xác nhận khung giờ phù hợp.',
  },
  {
    question: 'Bệnh viện có chấp nhận bảo hiểm không?',
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
      <section className="home-section site-page-section contact-page contact-page--premium">
        <section className="contact-hero-banner contact-hero-banner--premium">
          <div className="contact-hero-banner__copy">
            <span className="contact-hero-banner__badge">
              <Sparkles size={16} aria-hidden="true" />
              Trung tâm kết nối bệnh nhân
            </span>
            <h1>Liên hệ Bộ Y tế</h1>
            <p>
              Gửi yêu cầu, gọi hotline hoặc tìm đường đến trung tâm trong một trải nghiệm rõ ràng,
              nhanh và được điều phối bởi đội ngũ chăm sóc bệnh nhân chuyên nghiệp.
            </p>

            <div className="contact-hero-banner__actions">
              <button type="button">
                <PhoneCall size={18} aria-hidden="true" />
                Gọi hotline
              </button>
              <a
                href="https://www.google.com/maps/search/?api=1&query=124+Hai+Phong,+Thach+Thang,+Hai+Chau,+Da+Nang,+Vietnam"
                target="_blank"
                rel="noreferrer"
              >
                <Navigation size={18} aria-hidden="true" />
                Chỉ đường
              </a>
            </div>
          </div>

          <div className="contact-hero-banner__art" aria-label="Tóm tắt hỗ trợ liên hệ">
            <div className="contact-hero-dashboard">
              <div className="contact-hero-dashboard__top">
                <span>
                  <span aria-hidden="true" />
                  Care desk online
                </span>
                <strong>HP+</strong>
              </div>

              <div className="contact-hero-dashboard__patient">
                <span aria-hidden="true">
                  <UserRound size={24} />
                </span>
                <div>
                  <strong>Yêu cầu mới</strong>
                  <p>Lịch khám tổng quát và kiểm tra bảo hiểm</p>
                </div>
              </div>

              <div className="contact-hero-dashboard__flow">
                <span>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Tiếp nhận
                </span>
                <span>
                  <Stethoscope size={16} aria-hidden="true" />
                  Điều phối
                </span>
                <span>
                  <CalendarCheck size={16} aria-hidden="true" />
                  Xác nhận lịch
                </span>
              </div>
            </div>
          </div>

          <div className="contact-hero-stats" aria-label="Chỉ số liên hệ">
            {CONTACT_STATS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label}>
                  <Icon size={18} aria-hidden="true" />
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              );
            })}
          </div>
        </section>

        <section className="contact-main-grid contact-main-grid--premium">
          <form className="contact-message-card contact-message-card--premium">
            <div className="contact-message-card__heading">
              <span>
                <BadgeCheck size={16} aria-hidden="true" />
                Yêu cầu tư vấn
              </span>
              <h2>Gửi thông tin để được điều phối</h2>
              <p>Chúng tôi sẽ kiểm tra nhu cầu, chuyên khoa phù hợp và phản hồi qua kênh bạn chọn.</p>
            </div>

            <div className="contact-pathway-grid" aria-label="Nhu cầu hỗ trợ nhanh">
              {CONTACT_PATHWAYS.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} type="button">
                    <Icon size={18} aria-hidden="true" />
                    <strong>{item.label}</strong>
                    <small>{item.value}</small>
                  </button>
                );
              })}
            </div>

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
              <textarea rows="6" placeholder="Mô tả nhu cầu, thời gian mong muốn hoặc tình trạng cần hỗ trợ..." />
            </label>

            <div className="contact-message-card__footer">
              <button type="button">
                <span>Gửi yêu cầu ngay</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <small>
                <ShieldCheck size={15} aria-hidden="true" />
                Thông tin được bảo mật và chỉ dùng cho mục đích điều phối chăm sóc.
              </small>
            </div>
          </form>

          <div className="contact-side-stack">
            <article className="contact-info-card contact-info-card--premium">
              <div className="contact-info-card__heading">
                <span>
                  <MessageCircle size={16} aria-hidden="true" />
                  Kênh liên hệ
                </span>
                <h2>Thông tin liên lạc</h2>
              </div>

              <div className="contact-info-card__list">
                {CONTACT_DETAILS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="contact-info-card__item">
                      <span className="contact-info-card__icon" aria-hidden="true">
                        <Icon size={19} />
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        {item.lines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                        <small>{item.note}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="contact-emergency-card contact-emergency-card--premium">
              <span>
                <HeartPulse size={18} aria-hidden="true" />
                Ưu tiên khẩn cấp
              </span>
              <h3>Cần tư vấn ngay?</h3>
              <p>
                Nếu bạn đang gặp triệu chứng nghiêm trọng, hãy gọi đường dây nóng để được hướng dẫn
                đến đúng điểm tiếp nhận.
              </p>
              <button type="button">
                <PhoneCall size={18} aria-hidden="true" />
                Gọi ngay: +84 1800 1234
              </button>
            </article>
          </div>
        </section>

        <section className="contact-map-showcase contact-map-showcase--premium">
          <div className="contact-map-showcase__heading">
            <span>
              <MapPin size={16} aria-hidden="true" />
              Vị trí trung tâm
            </span>
            <h2>Dễ tìm, dễ đến, dễ kết nối</h2>
            <p>Trung tâm nằm tại lõi Đà Nẵng, thuận tiện tiếp cận từ sân bay, khách sạn và khu dân cư.</p>
          </div>

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
              <span aria-hidden="true">
                <MapPin size={20} />
              </span>
              <strong>Trung tâm Bộ Y tế</strong>
              <p>124 Hải Phòng, Thạch Thang, Hải Châu, Đà Nẵng.</p>
              <a
                href="https://www.google.com/maps/search/?api=1&query=124+Hai+Phong,+Thach+Thang,+Hai+Chau,+Da+Nang,+Vietnam"
                target="_blank"
                rel="noreferrer"
              >
                Mở chỉ đường
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section className="contact-faq-section contact-faq-section--premium">
          <div className="contact-faq-section__heading">
            <span>
              <BadgeCheck size={16} aria-hidden="true" />
              Hỗ trợ khách hàng
            </span>
            <h2>Câu hỏi thường gặp</h2>
          </div>

          <div className="contact-faq-section__list">
            {CONTACT_FAQ.map((item, index) => (
              <details key={item.question} className="contact-faq-section__item" open={index === 0}>
                <summary>
                  <span>{item.question}</span>
                  <span aria-hidden="true">
                    <ChevronDown size={19} />
                  </span>
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
