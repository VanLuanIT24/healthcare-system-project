import { useParams } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { services } from '../data/siteContent';

export function ServiceDetailPage() {
  const { slug } = useParams();
  const service = services.find((item) => item.slug === slug) || services[0];

  return (
    <div>
      <PageHero eyebrow="Chi tiết dịch vụ" title={service.name} description={service.summary} />
      <section className="section">
        <div className="detail-grid">
          <article className="detail-card">
            <h3>Chi phí tham khảo</h3>
            <p>{service.price}</p>
            <p>Chi phí thực tế có thể thay đổi theo chỉ định và danh mục cận lâm sàng đi kèm.</p>
          </article>
          <article className="detail-card">
            <h3>Thời gian thực hiện</h3>
            <p>{service.duration}</p>
            <p>Hệ thống sẽ ưu tiên khung giờ phù hợp với bác sĩ và dịch vụ liên quan.</p>
          </article>
          <article className="detail-card">
            <h3>Chuẩn bị trước khi khám</h3>
            <p>Giữ lịch sử bệnh án, toa thuốc cũ và giấy tờ cần thiết để bác sĩ đánh giá đầy đủ hơn.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
