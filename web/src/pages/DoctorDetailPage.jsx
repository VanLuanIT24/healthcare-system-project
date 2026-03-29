import { useParams } from 'react-router-dom';
import { PageHero } from '../components/PageHero';
import { doctors } from '../data/siteContent';

export function DoctorDetailPage() {
  const { slug } = useParams();
  const doctor = doctors.find((item) => item.slug === slug) || doctors[0];

  return (
    <div>
      <PageHero eyebrow="Chi tiết bác sĩ" title={doctor.name} description={`${doctor.specialty} • ${doctor.experience} • ${doctor.location}`} primaryLabel="Đặt lịch với bác sĩ này" />
      <section className="section">
        <div className="detail-grid">
          <article className="detail-card">
            <h3>Hồ sơ bác sĩ</h3>
            <p>{doctor.degree} - {doctor.experience}</p>
            <p>Giới tính: {doctor.gender}</p>
            <p>Chuyên môn: {doctor.highlight}</p>
          </article>
          <article className="detail-card">
            <h3>Lịch làm việc</h3>
            <p>{doctor.schedule}</p>
            <div className="slot-pills">
              {doctor.slots.map((slot) => (
                <span key={slot}>{slot}</span>
              ))}
            </div>
          </article>
          <article className="detail-card">
            <h3>Kinh nghiệm</h3>
            <p>Hồ sơ chi tiết có thể mở rộng thêm chứng chỉ, quá trình công tác và thế mạnh điều trị.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
