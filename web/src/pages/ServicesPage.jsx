import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { services } from '../data/siteContent';

export function ServicesPage() {
  return (
    <div>
      <PageHero eyebrow="Dịch vụ y tế" title="Danh mục dịch vụ trình bày rõ mục tiêu, chi phí và thời gian." description="Ngay cả khi chưa nối backend, cấu trúc trang đã sẵn sàng cho việc quản trị dịch vụ sau này." />
      <section className="section">
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
    </div>
  );
}
