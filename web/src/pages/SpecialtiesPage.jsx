import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { SectionTitle } from '../components/SectionTitle';
import { specialties } from '../data/siteContent';

export function SpecialtiesPage() {
  return (
    <div>
      <PageHero eyebrow="Danh sách chuyên khoa" title="Chọn đúng chuyên khoa để rút ngắn hành trình khám." description="Bệnh nhân có thể bắt đầu từ triệu chứng, nhu cầu khám định kỳ hoặc theo chỉ định cũ để tìm đúng khoa phù hợp." />
      <section className="section">
        <SectionTitle title="Tất cả chuyên khoa" description="Danh mục này có thể nối dữ liệu thật sau mà không cần thay đổi bố cục." />
        <div className="card-grid card-grid--three">
          {specialties.map((item) => (
            <Link key={item.slug} to={`/chuyen-khoa/${item.slug}`} className="feature-card">
              <h3>{item.name}</h3>
              <p>{item.summary}</p>
              <span>{item.accent}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
