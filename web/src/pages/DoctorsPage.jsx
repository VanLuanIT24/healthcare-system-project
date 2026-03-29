import { Link } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { doctors } from '../data/siteContent';

export function DoctorsPage() {
  return (
    <div>
      <PageHero eyebrow="Danh sách bác sĩ" title="Tra cứu bác sĩ theo chuyên khoa, lịch làm việc và cơ sở." description="Giao diện được thiết kế sẵn cho bộ lọc, dù hiện tại mới hiển thị dữ liệu mẫu." />
      <section className="section">
        <div className="filter-bar">
          <span>Lọc theo chuyên khoa</span>
          <span>Lọc theo ngày làm việc</span>
          <span>Lọc theo cơ sở</span>
          <span>Giới tính / học hàm / kinh nghiệm</span>
        </div>
        <div className="card-grid card-grid--two">
          {doctors.map((doctor) => (
            <Link key={doctor.slug} to={`/bac-si/${doctor.slug}`} className="doctor-card">
              <div>
                <p className="doctor-card__meta">{doctor.specialty}</p>
                <h3>{doctor.name}</h3>
                <p>{doctor.highlight}</p>
              </div>
              <div className="doctor-card__footer">
                <span>{doctor.location}</span>
                <span>{doctor.experience}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
