import { PageHero } from '../components/PageHero';
import { SectionTitle } from '../components/SectionTitle';
import { doctors } from '../data/siteContent';

export function AboutPage() {
  return (
    <div>
      <PageHero eyebrow="Giới thiệu" title="Một hệ thống y tế đặt trọng tâm vào trải nghiệm bệnh nhân." description="Trang giới thiệu được thiết kế để tạo niềm tin: rõ sứ mệnh, rõ đội ngũ, rõ năng lực vận hành và đầy đủ thông tin pháp lý." secondaryLabel="Xem đội ngũ bác sĩ" secondaryTo="/bac-si" />
      <section className="section">
        <div className="two-column">
          <div>
            <SectionTitle eyebrow="Sứ mệnh" title="Làm cho việc tiếp cận dịch vụ y tế trở nên minh bạch và ít áp lực hơn." />
            <p className="body-copy">Từ bước đặt lịch đầu tiên đến lúc tái khám, bệnh nhân luôn biết mình cần làm gì tiếp theo, cần chuẩn bị gì và được hỗ trợ ở đâu.</p>
          </div>
          <div>
            <SectionTitle eyebrow="Tầm nhìn" title="Trở thành nền tảng khám chữa bệnh ngoại trú hiện đại, gọn và dễ dùng." />
            <p className="body-copy">Không chỉ đẹp về giao diện, hệ thống còn tổ chức nội dung để bệnh nhân dễ ra quyết định và giảm sai sót trong hành trình khám.</p>
          </div>
        </div>
      </section>
      <section className="section section--alt">
        <SectionTitle eyebrow="Cơ sở vật chất" title="Không gian khám tinh gọn, sạch và trực quan" />
        <div className="card-grid card-grid--three">
          <article className="feature-card"><h3>Khu tiếp đón</h3><p>Quầy check-in nhanh, hướng dẫn rõ, phân luồng bệnh nhân hợp lý.</p></article>
          <article className="feature-card"><h3>Phòng khám</h3><p>Thiết kế kín đáo, dễ tiếp cận, tối ưu trải nghiệm cho khám ngoại trú.</p></article>
          <article className="feature-card"><h3>Khu cận lâm sàng</h3><p>Xét nghiệm và chẩn đoán hình ảnh đồng bộ với bác sĩ điều trị.</p></article>
        </div>
      </section>
      <section className="section">
        <SectionTitle eyebrow="Đội ngũ bác sĩ" title="Nhân sự chủ lực của hệ thống" />
        <div className="card-grid card-grid--two">
          {doctors.map((doctor) => (
            <article key={doctor.slug} className="doctor-card">
              <div>
                <p className="doctor-card__meta">{doctor.specialty}</p>
                <h3>{doctor.name}</h3>
                <p>{doctor.highlight}</p>
              </div>
              <div className="doctor-card__footer">
                <span>{doctor.degree}</span>
                <span>{doctor.experience}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
