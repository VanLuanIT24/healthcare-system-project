import { Link, useParams } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { doctors, services, specialties } from '../data/siteContent';

export function SpecialtyDetailPage() {
  const { slug } = useParams();
  const specialty = specialties.find((item) => item.slug === slug) || specialties[0];
  const matchingDoctors = doctors.filter((doctor) => doctor.specialty === specialty.name);

  return (
    <div>
      <PageHero eyebrow="Chi tiết chuyên khoa" title={specialty.name} description={specialty.summary} secondaryLabel="Xem bác sĩ" secondaryTo="/bac-si" />
      <section className="section">
        <div className="detail-grid">
          <article className="detail-card">
            <h3>Mô tả chuyên khoa</h3>
            <p>{specialty.summary}</p>
            <p>{specialty.accent}</p>
          </article>
          <article className="detail-card">
            <h3>Thời gian làm việc</h3>
            <p>Thứ 2 - Thứ 7, 07:30 - 17:30</p>
            <p>Luôn hiển thị khung giờ còn trống trước khi xác nhận lịch.</p>
          </article>
          <article className="detail-card">
            <h3>Đặt lịch nhanh</h3>
            <p>Hệ thống sẽ ưu tiên bác sĩ đang còn slot trong ngày hoặc gần nhất.</p>
          </article>
        </div>
      </section>
      <section className="section section--alt">
        <h2 className="section-heading">Bác sĩ thuộc chuyên khoa</h2>
        <div className="card-grid card-grid--two">
          {matchingDoctors.map((doctor) => (
            <Link key={doctor.slug} to={`/bac-si/${doctor.slug}`} className="doctor-card">
              <div>
                <p className="doctor-card__meta">{doctor.specialty}</p>
                <h3>{doctor.name}</h3>
                <p>{doctor.highlight}</p>
              </div>
              <div className="doctor-card__footer">
                <span>{doctor.schedule}</span>
                <span>{doctor.location}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="section">
        <h2 className="section-heading">Dịch vụ trong chuyên khoa</h2>
        <div className="card-grid card-grid--three">
          {services.slice(0, 3).map((service) => (
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
