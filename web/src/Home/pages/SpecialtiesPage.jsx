import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingPageShell } from './MarketingPageShell';

const specialtyGroups = [
  {
    title: 'Tim mạch chuyên sâu',
    tag: 'Chẩn đoán sớm',
    description:
      'Tầm soát nguy cơ tim mạch, siêu âm tim, điện tim và điều trị theo lộ trình cá nhân hóa.',
    image:
      'https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?auto=format&fit=crop&w=1200&q=86',
    stats: ['15+ bác sĩ', '4.9 đánh giá', 'Có lịch hôm nay'],
  },
  {
    title: 'Thần kinh',
    tag: 'Liên chuyên khoa',
    description:
      'Đánh giá đau đầu, rối loạn tiền đình, đột quỵ, thần kinh ngoại biên và phục hồi chức năng.',
    image:
      'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=1200&q=86',
    stats: ['MRI/CT', 'Hội chẩn nhanh', 'Theo dõi dài hạn'],
  },
  {
    title: 'Nhi khoa',
    tag: 'Thân thiện gia đình',
    description:
      'Khám tổng quát, tiêm chủng, theo dõi tăng trưởng và chăm sóc bệnh lý thường gặp ở trẻ.',
    image:
      'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?auto=format&fit=crop&w=1200&q=86',
    stats: ['Không gian trẻ em', 'Bác sĩ nhẹ nhàng', 'Nhắc lịch tự động'],
  },
  {
    title: 'Sản phụ khoa',
    tag: 'Đồng hành thai kỳ',
    description:
      'Khám phụ khoa, sàng lọc trước sinh, siêu âm thai và tư vấn sức khỏe sinh sản.',
    image:
      'https://images.unsplash.com/photo-1576765607924-077ef071d5b5?auto=format&fit=crop&w=1200&q=86',
    stats: ['Siêu âm 4D', 'Theo dõi thai kỳ', 'Tư vấn riêng tư'],
  },
  {
    title: 'Cấp cứu & Chấn thương',
    tag: 'Phản ứng 24/7',
    description:
      'Tiếp nhận cấp cứu, xử trí chấn thương, hồi sức ban đầu và điều phối chuyên khoa nhanh.',
    image:
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=86',
    stats: ['24/7', 'Ưu tiên xử trí', 'Hotline 1900 8888'],
  },
  {
    title: 'Chẩn đoán hình ảnh',
    tag: 'Công nghệ cao',
    description:
      'MRI, CT, X-quang, siêu âm và đọc kết quả bởi đội ngũ bác sĩ chẩn đoán hình ảnh.',
    image:
      'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=86',
    stats: ['MRI/CT', 'Kết quả số', 'Đọc phim chuyên sâu'],
  },
];

const carePath = [
  'Chọn chuyên khoa phù hợp',
  'Đặt lịch với bác sĩ',
  'Khám và làm xét nghiệm cần thiết',
  'Nhận lộ trình điều trị và tái khám',
];

export function SpecialtiesPage() {
  return (
    <MarketingPageShell activeKey="specialties">
      <div className="specialties-page">
        <section className="home-section specialties-hero">
          <div className="specialties-hero__copy">
            <span>Trung tâm chuyên khoa Bộ Y tế</span>
            <h1>Chăm sóc chuyên sâu, phối hợp liền mạch cho từng nhu cầu sức khỏe.</h1>
            <p>
              Từ khám tổng quát đến điều trị chuyên sâu, mỗi chuyên khoa được kết nối trong
              cùng một quy trình điều phối để người bệnh được hướng dẫn rõ ràng, ít chờ đợi và
              theo dõi liên tục.
            </p>
            <div className="specialties-hero__actions">
              <Link to="/contact">Đặt lịch khám</Link>
              <a href="#specialty-list">Xem chuyên khoa</a>
            </div>
          </div>
          <div className="specialties-hero__visual" aria-hidden="true">
            <div className="specialties-hero__image" />
            <div className="specialties-hero__card specialties-hero__card--top">
              <strong>24/7</strong>
              <span>Cấp cứu và điều phối chuyên khoa</span>
            </div>
            <div className="specialties-hero__card specialties-hero__card--bottom">
              <strong>12</strong>
              <span>chuyên khoa đang tiếp nhận lịch hôm nay</span>
            </div>
          </div>
        </section>

        <section className="home-section specialties-trust">
          <article>
            <strong>JCI</strong>
            <span>Quy trình chuẩn quốc tế</span>
          </article>
          <article>
            <strong>BHYT</strong>
            <span>Hỗ trợ bảo hiểm trực tiếp</span>
          </article>
          <article>
            <strong>98%</strong>
            <span>Khách hàng hài lòng</span>
          </article>
          <article>
            <strong>EMR</strong>
            <span>Hồ sơ điện tử bảo mật</span>
          </article>
        </section>

        <section className="home-section specialties-featured" id="specialty-list">
          <div className="specialties-section-heading">
            <span>Các chuyên khoa nổi bật</span>
            <h2>Lựa chọn đúng chuyên khoa ngay từ bước đầu</h2>
            <p>
              Mỗi card bên dưới tập trung vào một nhu cầu khám thường gặp, kèm thông tin giúp
              người bệnh hiểu nhanh nên bắt đầu từ đâu.
            </p>
          </div>

          <div className="specialties-grid">
            {specialtyGroups.map((item, index) => (
              <article
                key={item.title}
                className={`specialties-card ${index === 0 ? 'is-featured' : ''}`}
              >
                <div
                  className="specialties-card__image"
                  style={{ backgroundImage: `url(${item.image})` }}
                  aria-hidden="true"
                />
                <div className="specialties-card__body">
                  <span>{item.tag}</span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="specialties-card__stats">
                    {item.stats.map((stat) => (
                      <small key={stat}>{stat}</small>
                    ))}
                  </div>
                  <div className="specialties-card__actions">
                    <Link to="/contact">Đặt lịch</Link>
                    <Link to="/home#doctors">Tìm bác sĩ</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section specialties-pathway">
          <div>
            <span>Quy trình khám</span>
            <h2>Đi từ triệu chứng đến kế hoạch điều trị rõ ràng</h2>
            <p>
              Đội ngũ điều phối giúp bạn chọn chuyên khoa, đặt lịch, chuẩn bị hồ sơ và nhận
              kết quả sau khám trên cùng một hành trình.
            </p>
          </div>
          <div className="specialties-pathway__steps">
            {carePath.map((item, index) => (
              <article key={item}>
                <strong>{`0${index + 1}`}</strong>
                <span>{item}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section specialties-cta">
          <div>
            <span>Chưa biết nên chọn chuyên khoa nào?</span>
            <h2>Để Bộ Y tế tư vấn lộ trình khám phù hợp.</h2>
            <p>
              Chia sẻ triệu chứng hoặc nhu cầu khám, đội ngũ chăm sóc sẽ gợi ý chuyên khoa,
              bác sĩ và khung giờ phù hợp nhất.
            </p>
          </div>
          <div className="specialties-cta__actions">
            <Link to="/contact">Liên hệ tư vấn</Link>
            <a href="tel:+8419008888">Gọi 1900 8888</a>
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
