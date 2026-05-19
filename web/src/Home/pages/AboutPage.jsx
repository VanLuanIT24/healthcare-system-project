import React from 'react';
import {
  Activity,
  ArrowRight,
  Brain,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Hospital,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { MarketingPageShell } from './MarketingPageShell';

const proofItems = [
  {
    icon: ShieldCheck,
    title: 'Hội đồng chuyên môn đa khoa',
    description: 'Mọi ca cần phối hợp đều có bác sĩ đầu mối và tiêu chí hội chẩn rõ ràng.',
  },
  {
    icon: ClipboardCheck,
    title: 'Quy trình theo chuẩn quốc tế',
    description: 'Tiếp nhận, khám, xét nghiệm và tái khám được chuẩn hóa thành một luồng.',
  },
  {
    icon: FileText,
    title: 'Đặt lịch và hồ sơ số',
    description: 'Lịch hẹn, kết quả và chỉ định được lưu lại để người bệnh theo dõi liên tục.',
  },
  {
    icon: HeartPulse,
    title: 'Tư vấn trước và sau khám',
    description: 'Đội ngũ điều phối luôn nhắc lịch, giải thích bước tiếp theo và hỗ trợ 24/7.',
  },
];

const heroMetrics = [
  { value: '12+', label: 'Năm vận hành', note: 'Mô hình chăm sóc gia đình hiện đại' },
  { value: '50k+', label: 'Hồ sơ chăm sóc', note: 'Theo dõi xuyên suốt nhiều lần khám' },
  { value: '98%', label: 'Hài lòng dịch vụ', note: 'Khảo sát sau khám và tái khám' },
  { value: '24/7', label: 'Điều phối hỗ trợ', note: 'Hotline, cổng bệnh nhân, nhắc lịch' },
];

const insightCards = [
  {
    icon: Sparkles,
    tone: 'is-blue',
    title: 'Tầm nhìn',
    description:
      'Trở thành điểm đến y tế đáng tin cậy cho gia đình đô thị, nơi người bệnh được chủ động theo dõi sức khỏe bằng dữ liệu rõ ràng và tư vấn dễ hiểu.',
  },
  {
    icon: HeartPulse,
    tone: 'is-teal',
    title: 'Sứ mệnh',
    description:
      'Rút ngắn khoảng cách giữa chuyên môn y khoa và trải nghiệm dịch vụ bằng quy trình đặt lịch nhanh, khám đúng nhu cầu và chăm sóc liên tục sau điều trị.',
  },
];

const careJourney = [
  {
    icon: CalendarCheck,
    title: 'Tiếp nhận thông minh',
    description:
      'Điều phối viên ghi nhận triệu chứng, tiền sử, lịch rảnh và ưu tiên để đề xuất chuyên khoa phù hợp.',
  },
  {
    icon: Stethoscope,
    title: 'Khám đúng trọng tâm',
    description:
      'Bác sĩ có hồ sơ trước buổi khám, giảm hỏi lặp lại và tập trung vào quyết định chuyên môn.',
  },
  {
    icon: Activity,
    title: 'Theo dõi chủ động',
    description:
      'Sau khám, hệ thống nhắc thuốc, lịch tái khám, xét nghiệm bổ sung và kênh hỗ trợ gia đình.',
  },
];

const doctorProfiles = [
  {
    name: 'BS.CKII Nguyễn Hoàng Minh',
    role: 'Giám đốc y khoa',
    focus: 'Tim mạch - quản trị chất lượng',
    image:
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=900&q=82',
    position: 'center 18%',
  },
  {
    name: 'ThS.BS Trần Thu Hương',
    role: 'Trưởng khoa Nội tổng quát',
    focus: 'Sàng lọc bệnh mạn tính',
    image:
      'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=900&q=80',
    position: 'center 12%',
  },
  {
    name: 'TS.BS Lê Anh Dũng',
    role: 'Trưởng khoa Chẩn đoán hình ảnh',
    focus: 'MRI, CT và siêu âm chuyên sâu',
    image:
      'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=900&q=82',
    position: 'center 16%',
  },
];

const coreValues = [
  {
    index: '01',
    icon: HeartPulse,
    title: 'Tận tâm',
    description:
      'Mỗi tiếp xúc đều bắt đầu bằng lắng nghe, giải thích rõ ràng và theo sát người bệnh đến khi ổn định.',
  },
  {
    index: '02',
    icon: Brain,
    title: 'Chính xác',
    description:
      'Dữ liệu khám, xét nghiệm và chẩn đoán được kết nối để bác sĩ có quyết định nhanh và đáng tin cậy.',
  },
  {
    index: '03',
    icon: ShieldCheck,
    title: 'Minh bạch',
    description:
      'Phác đồ, chi phí và lịch tái khám được trình bày rõ, giúp gia đình chủ động trong mọi quyết định.',
  },
  {
    index: '04',
    icon: Users,
    title: 'Liên tục',
    description:
      'Chăm sóc không dừng lại sau buổi khám; đội ngũ điều phối luôn nhắc lịch và hỗ trợ sau điều trị.',
  },
];

const careCapabilities = [
  {
    icon: CalendarCheck,
    title: 'Điều phối một cửa',
    description:
      'Người bệnh được hướng dẫn từ chọn chuyên khoa, chuẩn bị hồ sơ, đặt lịch xét nghiệm đến nhận kết quả sau khám.',
  },
  {
    icon: Users,
    title: 'Hội chẩn liên khoa',
    description:
      'Các ca phức tạp được kết nối giữa bác sĩ nội, tim mạch, nhi, sản, chẩn đoán hình ảnh và điều dưỡng điều phối.',
  },
  {
    icon: HeartPulse,
    title: 'Theo dõi sau khám',
    description:
      'Đội ngũ chăm sóc nhắc lịch tái khám, hướng dẫn dùng thuốc và hỗ trợ giải thích kết quả khi người bệnh cần.',
  },
  {
    icon: FileText,
    title: 'Hồ sơ sức khỏe số',
    description:
      'Thông tin khám, xét nghiệm, đơn thuốc và lịch hẹn được lưu trữ rõ ràng để theo dõi liên tục qua nhiều lần khám.',
  },
];

const facilityHighlights = [
  { icon: CalendarCheck, title: 'Khu tiếp đón riêng cho đặt lịch trước' },
  { icon: Hospital, title: 'Phòng khám chuyên khoa kết nối xét nghiệm và hình ảnh' },
  { icon: Sparkles, title: 'Không gian chờ yên tĩnh, giảm cảm giác quá tải' },
  { icon: HeartPulse, title: 'Kênh tư vấn trực tuyến cho gia đình bận rộn' },
];

const milestones = [
  {
    year: '2014',
    title: 'Khởi đầu trung tâm y khoa',
    description:
      'Xây dựng mô hình phòng khám tập trung vào trải nghiệm đặt lịch nhanh, khám đúng giờ và hồ sơ rõ ràng.',
  },
  {
    year: '2018',
    title: 'Mở rộng hệ chuyên khoa',
    description:
      'Kết nối đội ngũ bác sĩ nội, tim mạch, nhi, sản và chẩn đoán hình ảnh trong cùng một quy trình.',
  },
  {
    year: '2021',
    title: 'Chuẩn hóa vận hành số',
    description:
      'Triển khai hồ sơ điện tử, nhắc lịch tự động và bảng điều phối để giảm thời gian chờ cho người bệnh.',
  },
  {
    year: '2024',
    title: 'Nâng cấp trải nghiệm cao cấp',
    description:
      'Tối ưu không gian tiếp đón, chăm sóc sau khám và hệ thống tư vấn từ xa cho gia đình bận rộn.',
  },
];

export function AboutPage() {
  return (
    <MarketingPageShell activeKey="about">
      <div className="about-page about-page--premium">
        <section className="home-section about-hero about-hero--premium about-hero--complete">
          <div className="about-hero__backdrop" />
          <svg className="about-hero__ecg" viewBox="0 0 760 120" aria-hidden="true">
            <path d="M0 70H130L154 70L176 34L204 98L234 18L264 70H380L412 70L438 46L466 88L498 70H760" />
          </svg>
          <div className="about-hero__content">
            <span className="about-hero__badge">Về Healthcare Plus+</span>
            <h1>Chăm sóc sức khỏe chuẩn quốc tế, gần gũi hơn</h1>
            <p>
              Healthcare Plus+ kết hợp bác sĩ chuyên môn cao, điều phối lịch khám rõ ràng và
              hồ sơ số để mỗi lần thăm khám đều nhanh, chính xác và an tâm.
            </p>
            <div className="about-hero__actions">
              <Link to="/contact" className="about-hero__cta">
                <CalendarCheck size={19} strokeWidth={2.5} aria-hidden="true" />
                <span>Đặt lịch tư vấn</span>
              </Link>
              <Link to="/specialties" className="about-hero__ghost">
                <Stethoscope size={19} strokeWidth={2.5} aria-hidden="true" />
                <span>Xem chuyên khoa</span>
              </Link>
            </div>
            <div className="about-hero__trust-line" aria-label="Các điểm nổi bật của Healthcare Plus+">
              <span>
                <ShieldCheck size={16} strokeWidth={2.4} aria-hidden="true" />
                Kiểm soát chất lượng
              </span>
              <span>
                <FileText size={16} strokeWidth={2.4} aria-hidden="true" />
                Hồ sơ số liên tục
              </span>
              <span>
                <HeartPulse size={16} strokeWidth={2.4} aria-hidden="true" />
                Điều phối 24/7
              </span>
            </div>
          </div>
          <div className="about-hero__visual about-hero__visual--complete" aria-label="Đội ngũ bác sĩ Healthcare Plus+">
            <div className="about-hero__image">
              <img
                src="https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&w=1500&q=86"
                alt="Đội ngũ bác sĩ chuyên nghiệp"
              />
            </div>
            <div className="about-hero__metric-stack" aria-hidden="true">
              <article>
                <strong>15'</strong>
                <span>Điều phối lịch hẹn trung bình</span>
              </article>
              <article>
                <strong>4.9</strong>
                <span>Đánh giá trải nghiệm sau khám</span>
              </article>
            </div>
            <div className="about-hero__visual-ribbon" aria-hidden="true">
              <span>Connected care</span>
              <strong>Doctor · Lab · Follow-up</strong>
            </div>
            <div className="about-hero__glass-note">
              <span className="about-hero__glass-icon">
                <HeartPulse size={22} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <div>
                <strong>International care desk</strong>
                <span>Điều phối lịch khám, kết quả và tái khám trong một quy trình.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="home-section about-metric-row">
          {heroMetrics.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <small>{item.note}</small>
            </article>
          ))}
        </section>

        <section className="home-section about-proof-strip">
          {proofItems.map((item) => (
            <article key={item.title}>
              <span>
                <item.icon size={18} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="home-section about-insights about-insights--premium">
          {insightCards.map((item) => (
            <article key={item.title} className="about-insight-card">
              <span className={`about-insight-card__icon ${item.tone}`}>
                <item.icon size={25} strokeWidth={2.35} aria-hidden="true" />
              </span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </article>
          ))}
        </section>

        <section className="home-section about-care-system">
          <div className="about-care-system__heading">
            <span>Hệ điều phối chăm sóc</span>
            <h2>Mỗi lần khám là một hành trình có người phụ trách, dữ liệu và bước tiếp theo</h2>
            <p>
              Healthcare Plus+ tổ chức trải nghiệm theo ba lớp: hiểu đúng nhu cầu, khám đúng
              trọng tâm và theo dõi sau khám bằng lịch hẹn rõ ràng.
            </p>
          </div>
          <div className="about-care-system__board">
            {careJourney.map((step, index) => (
              <article key={step.title}>
                <div className="about-care-system__topline">
                  <span>{`0${index + 1}`}</span>
                  <step.icon size={25} strokeWidth={2.3} aria-hidden="true" />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section about-story">
          <div className="about-story__content">
            <span>Healthcare Plus+ được xây dựng vì điều gì?</span>
            <h2>Một mô hình chăm sóc nơi chuyên môn y khoa và trải nghiệm người bệnh đi cùng nhau</h2>
            <p>
              Chúng tôi bắt đầu từ một vấn đề rất thực tế: nhiều gia đình không thiếu nơi khám,
              nhưng thiếu một hành trình đủ rõ ràng. Người bệnh thường phải tự chọn chuyên khoa,
              tự nhớ lịch tái khám, tự giữ kết quả và tự kết nối thông tin giữa nhiều bác sĩ.
            </p>
            <p>
              Healthcare Plus+ được thiết kế để giảm sự rời rạc đó. Mỗi lần khám được điều phối
              như một quy trình: tiếp nhận nhu cầu, chọn đúng chuyên khoa, chuẩn bị xét nghiệm
              cần thiết, giải thích kết quả và tiếp tục theo dõi sau điều trị.
            </p>
          </div>
          <div className="about-story__media" aria-hidden="true">
            <div className="about-story__image about-story__image--main" />
            <div className="about-story__image about-story__image--side" />
          </div>
        </section>

        <section className="home-section about-capabilities">
          <div className="about-section-heading">
            <span>Năng lực vận hành</span>
            <h2>Không chỉ khám bệnh, chúng tôi quản lý toàn bộ hành trình chăm sóc</h2>
            <p>
              Mục tiêu là giúp người bệnh hiểu mình đang ở bước nào, cần làm gì tiếp theo và
              được ai phụ trách trong từng giai đoạn.
            </p>
          </div>
          <div className="about-capabilities__grid">
            {careCapabilities.map((item, index) => (
              <article key={item.title} className="about-capability-card">
                <div className="about-capability-card__head">
                  <strong>{`0${index + 1}`}</strong>
                  <span>
                    <item.icon size={22} strokeWidth={2.35} aria-hidden="true" />
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section about-facilities">
          <div className="about-facilities__visual" aria-hidden="true" />
          <div className="about-facilities__content">
            <span>Cơ sở vật chất & trải nghiệm</span>
            <h2>Không gian khám được tổ chức để giảm chờ đợi và tăng sự riêng tư</h2>
            <p>
              Từ quầy tiếp đón, khu chờ, phòng khám đến khu xét nghiệm, các điểm chạm được sắp
              xếp để người bệnh dễ di chuyển, dễ hỏi thông tin và luôn biết bước tiếp theo.
            </p>
            <div className="about-facilities__list">
              {facilityHighlights.map((item) => (
                <article key={item.title}>
                  <span>
                    <item.icon size={17} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <strong>{item.title}</strong>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="home-section about-values">
          <div className="about-section-heading">
            <span>Giá trị vận hành</span>
            <h2>Những nguyên tắc giúp trải nghiệm khám tốt hơn</h2>
            <p>Tập trung vào sự rõ ràng, tốc độ và cảm giác an tâm của người bệnh.</p>
          </div>
          <div className="about-values__grid">
            {coreValues.map((item) => (
              <article key={item.index} className="about-value-card">
                <span className="about-value-card__index">{item.index}</span>
                <span className="about-value-card__icon">
                  <item.icon size={22} strokeWidth={2.45} aria-hidden="true" />
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section about-team">
          <div className="about-team__header">
            <div>
              <span>Hội đồng chuyên môn</span>
              <h2>Đội ngũ bác sĩ dẫn dắt chất lượng điều trị</h2>
              <p>Hồ sơ chuyên môn rõ ràng, lịch khám minh bạch và phối hợp liên khoa khi cần.</p>
            </div>
            <Link to="/doctors">
              <span>Tất cả bác sĩ</span>
              <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
            </Link>
          </div>
          <div className="about-team__grid">
            {doctorProfiles.map((doctor) => (
              <article key={doctor.name} className="about-doctor-card">
                <div
                  className="about-doctor-card__photo"
                  style={{
                    backgroundImage: `url(${doctor.image})`,
                    backgroundPosition: doctor.position,
                  }}
                />
                <div className="about-doctor-card__body">
                  <span>{doctor.role}</span>
                  <h3>{doctor.name}</h3>
                  <p>{doctor.focus}</p>
                  <div className="about-doctor-card__meta">
                    <strong>4.9 / 5</strong>
                    <small>
                      <CheckCircle2 size={14} strokeWidth={2.6} aria-hidden="true" />
                      Có lịch trong tuần
                    </small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section about-stats-band">
          <article>
            <strong>12+</strong>
            <span>Năm kinh nghiệm</span>
          </article>
          <article>
            <strong>50,000+</strong>
            <span>Bệnh nhân tin chọn</span>
          </article>
          <article>
            <strong>200+</strong>
            <span>Bác sĩ và điều dưỡng</span>
          </article>
          <article>
            <strong>24/7</strong>
            <span>Hỗ trợ điều phối</span>
          </article>
        </section>

        <section className="home-section about-timeline">
          <div className="about-section-heading">
            <span>Hành trình phát triển</span>
            <h2>Từ phòng khám gia đình đến hệ sinh thái chăm sóc chủ động</h2>
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
            <svg className="about-cta__ecg" viewBox="0 0 640 96" aria-hidden="true">
              <path d="M0 54H116L140 22L170 82L202 38L232 54H350L382 54L410 28L444 74L478 54H640" />
            </svg>
            <span className="about-cta__eyebrow">Chăm sóc chủ động</span>
            <h2>Sẵn sàng để mỗi lần khám trở nên nhẹ nhàng hơn?</h2>
            <p>
              Đội ngũ điều phối sẽ giúp bạn chọn chuyên khoa, bác sĩ và khung giờ phù hợp nhất
              với tình trạng sức khỏe hiện tại.
            </p>
            <div className="about-cta__actions">
              <Link to="/contact">
                <CalendarCheck size={19} strokeWidth={2.5} aria-hidden="true" />
                <span>Đặt lịch hẹn ngay</span>
              </Link>
              <a href="tel:+8419008888">
                <HeartPulse size={19} strokeWidth={2.5} aria-hidden="true" />
                <span>Gọi tư vấn: 1900 8888</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
