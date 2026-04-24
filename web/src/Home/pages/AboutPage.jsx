import React from 'react';
import { Link } from 'react-router-dom';
import { MarketingPageShell } from './MarketingPageShell';

const doctorProfiles = [
  {
    name: 'PGS. TS. Nguyễn Văn A',
    role: 'Giám đốc y khoa',
    image:
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'GS. TS. Trần Thị B',
    role: 'Trưởng khoa nội',
    image:
      'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=900&q=80',
  },
  {
    name: 'TS. BS. Lê Hoàng C',
    role: 'Trưởng khoa chẩn đoán hình ảnh',
    image:
      'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=900&q=80',
  },
];

const coreValues = [
  {
    index: '01',
    title: 'Tâm',
    description: 'Luôn đặt an toàn và lợi ích của bệnh nhân lên hàng đầu, phục vụ bằng sự tử tế.',
  },
  {
    index: '02',
    title: 'Tầm',
    description: 'Xây dựng mô hình tiên tiến định cao một trung tâm y tế hiện đại và nhân văn.',
  },
  {
    index: '03',
    title: 'Tài',
    description: 'Nuôi dưỡng chuyên gia xuất sắc, không ngừng học hỏi và làm chủ công nghệ mới.',
  },
  {
    index: '04',
    title: 'Tín',
    description: 'Xây dựng niềm tin bằng minh bạch, chính xác và trung thực trong từng quyết định.',
  },
];

const milestones = [
  {
    year: '2014',
    title: 'Đặt nền móng',
    description:
      'Thành lập trung tâm nghiên cứu y khoa tiên phong, tập trung vào công nghệ chẩn đoán sớm.',
  },
  {
    year: '2018',
    title: 'Khai trương Sanctuary Health',
    description:
      'Chính thức đi vào hoạt động với mô hình phòng khám cao cấp và dịch vụ liền mạch.',
  },
  {
    year: '2021',
    title: 'Hợp tác quốc tế',
    description:
      'Ký kết thỏa thuận chiến lược với các bệnh viện hàng đầu tại Singapore và Hoa Kỳ.',
  },
  {
    year: '2024',
    title: 'Số hóa y tế',
    description:
      'Triển khai hệ thống AI trong phân tích hình ảnh và quản lý hồ sơ sức khỏe điện tử.',
  },
];

export function AboutPage() {
  return (
    <MarketingPageShell activeKey="about">
      <div className="about-page">
        <section className="home-section about-hero">
          <div className="about-hero__backdrop" />
          <div className="about-hero__content">
            <span className="about-hero__badge">Về chúng tôi</span>
            <h1>Về Sanctuary Health: Nơi y đức hội tụ cùng công nghệ</h1>
            <p>
              Kiến tạo một tiêu chuẩn mới cho chăm sóc sức khỏe hiện đại, nơi sự
              chính xác của công nghệ hòa quyện cùng sự thấu cảm trong y đức.
            </p>
            <Link to="/contact" className="about-hero__cta">
              Tìm hiểu dịch vụ
            </Link>
          </div>
        </section>

        <section className="home-section about-insights">
          <article className="about-insight-card">
            <span className="about-insight-card__icon">◎</span>
            <h2>Tầm nhìn</h2>
            <p>
              Trở thành biểu tượng của y học hiện đại tại Việt Nam, nơi mỗi bệnh
              nhân được trải nghiệm quy trình chăm sóc cá nhân hóa tuyệt đối với
              những công nghệ tiên tiến nhất thế giới.
            </p>
          </article>
          <article className="about-insight-card">
            <span className="about-insight-card__icon is-teal">◌</span>
            <h2>Sứ mệnh</h2>
            <p>
              Chúng tôi cam kết mang lại giải pháp y tế tối ưu thông qua việc kết
              hợp đội ngũ chuyên gia đầu ngành cùng nền tảng dữ liệu, y khoa chính
              xác và sự bền bỉ trong chăm sóc cộng đồng.
            </p>
          </article>
        </section>

        <section className="home-section about-values">
          <div className="about-section-heading">
            <h2>Giá trị cốt lõi</h2>
            <p>Kinh chỉ nam cho mọi hoạt động và quyết định tại Sanctuary Health.</p>
          </div>
          <div className="about-values__grid">
            {coreValues.map((item) => (
              <article key={item.index} className="about-value-card">
                <span className="about-value-card__index">{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section about-team">
          <div className="about-team__header">
            <div>
              <h2>Đội ngũ chuyên gia</h2>
              <p>Những người dẫn dắt mệnh chăm sóc sức khỏe tại Sanctuary.</p>
            </div>
            <Link to="/contact">Tất cả chuyên gia</Link>
          </div>
          <div className="about-team__grid">
            {doctorProfiles.map((doctor) => (
              <article key={doctor.name} className="about-doctor-card">
                <div
                  className="about-doctor-card__photo"
                  style={{ backgroundImage: `url(${doctor.image})` }}
                />
                <div className="about-doctor-card__body">
                  <h3>{doctor.name}</h3>
                  <p>{doctor.role}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section about-stats-band">
          <article>
            <strong>10+</strong>
            <span>Năm kinh nghiệm</span>
          </article>
          <article>
            <strong>50,000+</strong>
            <span>Bệnh nhân tin tưởng</span>
          </article>
          <article>
            <strong>100+</strong>
            <span>Chuyên gia đầu ngành</span>
          </article>
        </section>

        <section className="home-section about-timeline">
          <div className="about-section-heading">
            <h2>Hành trình phát triển</h2>
          </div>
          <div className="about-timeline__track">
            {milestones.map((item, index) => (
              <article key={item.year} className="about-timeline__item">
                <div
                  className={`about-timeline__content ${
                    index % 2 === 0 ? 'is-left' : 'is-right'
                  }`}
                >
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <div className="about-timeline__year">{item.year}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section about-cta">
          <div className="about-cta__panel">
            <span className="about-cta__eyebrow">Chăm sóc chủ động</span>
            <h2>Bắt đầu hành trình chăm sóc sức khỏe chủ động ngay hôm nay</h2>
            <p>
              Liên hệ với đội ngũ tư vấn của Sanctuary Health để được hỗ trợ thông
              tin và đặt lịch hẹn ưu tiên.
            </p>
            <div className="about-cta__actions">
              <Link to="/contact">Đặt lịch hẹn ngay</Link>
              <a href="tel:+8418001234">Gọi tư vấn: 1900 xxxx</a>
            </div>
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
