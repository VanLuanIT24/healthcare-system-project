import React from 'react';
import { Link } from 'react-router-dom';
import { openHealthcareChatbot } from '../../components/HealthcareChatbot';
import { MarketingPageShell } from './MarketingPageShell';

const doctorList = [
  {
    name: 'BS.CKII Nguyễn Hoàng Minh',
    role: 'Giám đốc y khoa',
    specialty: 'Tim mạch - Quản trị chất lượng',
    experience: '18 năm kinh nghiệm',
    schedule: 'Còn lịch hôm nay 15:30',
    rating: '4.9',
    tag: 'Đang nhận lịch',
    image:
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=900&q=84',
    position: 'center 18%',
  },
  {
    name: 'ThS.BS Trần Thu Hương',
    role: 'Trưởng khoa Nội tổng quát',
    specialty: 'Sàng lọc bệnh mạn tính',
    experience: '15 năm kinh nghiệm',
    schedule: 'Còn lịch trong tuần',
    rating: '4.9',
    tag: 'Nghiên cứu',
    image:
      'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=900&q=84',
    position: 'center 12%',
  },
  {
    name: 'TS.BS Lê Anh Dũng',
    role: 'Trưởng khoa Chẩn đoán hình ảnh',
    specialty: 'MRI, CT và siêu âm chuyên sâu',
    experience: '16 năm kinh nghiệm',
    schedule: 'Lịch gần nhất: Thứ 5',
    rating: '4.8',
    tag: 'Nổi bật',
    image:
      'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=900&q=84',
    position: 'center 16%',
  },
  {
    name: 'BS.CKI Phạm Thị Mai',
    role: 'Bác sĩ Sản phụ khoa',
    specialty: 'Chăm sóc thai kỳ và sức khỏe sinh sản',
    experience: '14 năm kinh nghiệm',
    schedule: 'Còn 4 khung giờ trống',
    rating: '4.8',
    tag: 'Mới',
    image:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=84',
    position: 'center 10%',
  },
  {
    name: 'BS. Lê Minh Quân',
    role: 'Bác sĩ Nhi khoa',
    specialty: 'Theo dõi tăng trưởng và tiêm chủng',
    experience: '11 năm kinh nghiệm',
    schedule: 'Còn lịch sáng mai',
    rating: '4.9',
    tag: 'Thân thiện gia đình',
    image:
      'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=900&q=84',
    position: 'center 16%',
  },
  {
    name: 'ThS.BS Đỗ An Nhiên',
    role: 'Bác sĩ Thần kinh',
    specialty: 'Đau đầu, mất ngủ và phục hồi thần kinh',
    experience: '13 năm kinh nghiệm',
    schedule: 'Lịch gần nhất: Thứ 6',
    rating: '4.8',
    tag: 'Liên chuyên khoa',
    image:
      'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=900&q=82',
    position: 'center 18%',
  },
];

const filters = ['Tất cả', 'Tim mạch', 'Nội tổng quát', 'Nhi khoa', 'Sản phụ khoa', 'Chẩn đoán hình ảnh'];

const strengths = [
  'Hồ sơ chuyên môn rõ ràng',
  'Lịch khám được cập nhật theo ngày',
  'Phối hợp liên khoa khi cần',
  'Theo dõi sau khám và tái khám',
];

export function DoctorsPage() {
  return (
    <MarketingPageShell activeKey="doctors">
      <div className="doctors-page">
        <section className="home-section doctors-hero">
          <div className="doctors-hero__content">
            <span>Đội ngũ bác sĩ Bộ Y tế</span>
            <h1>Gặp đúng chuyên gia, bắt đầu đúng hướng điều trị.</h1>
            <p>
              Chọn bác sĩ theo chuyên khoa, kinh nghiệm và lịch trống gần nhất. Đội ngũ điều phối
              sẽ hỗ trợ bạn chuẩn bị hồ sơ trước khám và theo dõi sau buổi hẹn.
            </p>
            <div className="doctors-hero__actions">
              <Link to="/contact">Đặt lịch khám</Link>
              <Link to="/specialties">Tìm theo chuyên khoa</Link>
            </div>
          </div>
          <div className="doctors-hero__visual" aria-hidden="true">
            <div className="doctors-hero__image" />
            <article className="doctors-hero__panel">
              <strong>38</strong>
              <span>bác sĩ đang tiếp nhận lịch hôm nay</span>
            </article>
            <article className="doctors-hero__panel is-bottom">
              <strong>08 phút</strong>
              <span>thời gian phản hồi trung bình</span>
            </article>
          </div>
        </section>

        <section className="home-section doctors-trust">
          {strengths.map((item) => (
            <article key={item}>
              <span>✓</span>
              <strong>{item}</strong>
            </article>
          ))}
        </section>

        <section className="home-section doctors-directory">
          <div className="doctors-directory__header">
            <div>
              <span>Danh sách bác sĩ</span>
              <h2>Chọn bác sĩ phù hợp với nhu cầu khám của bạn</h2>
              <p>Lọc nhanh theo chuyên khoa, xem lịch gần nhất và đặt hẹn trực tiếp.</p>
            </div>
            <Link to="/contact">Cần tư vấn chọn bác sĩ?</Link>
          </div>
          <div className="doctors-filter" aria-label="Lọc chuyên khoa">
            {filters.map((filter, index) => (
              <button key={filter} className={index === 0 ? 'is-active' : ''} type="button">
                {filter}
              </button>
            ))}
          </div>
          <div className="doctors-grid">
            {doctorList.map((doctor) => (
              <article className="doctor-profile-card" key={doctor.name}>
                <div
                  className="doctor-profile-card__photo"
                  style={{
                    backgroundImage: `url(${doctor.image})`,
                    backgroundPosition: doctor.position,
                  }}
                >
                  <span>{doctor.tag}</span>
                </div>
                <div className="doctor-profile-card__body">
                  <small>{doctor.role}</small>
                  <h3>{doctor.name}</h3>
                  <p>{doctor.specialty}</p>
                  <div className="doctor-profile-card__meta">
                    <span>{doctor.experience}</span>
                    <span>{doctor.rating} ★</span>
                  </div>
                  <div className="doctor-profile-card__schedule">{doctor.schedule}</div>
                  <div className="doctor-profile-card__actions">
                    <Link to="/contact">Đặt lịch</Link>
                    <Link to="/about">Xem hồ sơ</Link>
                    <button
                      className="doctor-profile-card__chat"
                      type="button"
                      onClick={() =>
                        openHealthcareChatbot({
                          context: 'doctor',
                          doctorName: doctor.name,
                          specialty: doctor.specialty,
                        })
                      }
                    >
                      Hỏi lễ tân ảo
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section doctors-care-flow">
          <div>
            <span>Quy trình hỗ trợ</span>
            <h2>Từ chọn bác sĩ đến tái khám đều có điều phối rõ ràng</h2>
          </div>
          <div className="doctors-care-flow__steps">
            <article>
              <strong>01</strong>
              <span>Chọn chuyên khoa hoặc mô tả triệu chứng</span>
            </article>
            <article>
              <strong>02</strong>
              <span>Điều phối gợi ý bác sĩ và khung giờ phù hợp</span>
            </article>
            <article>
              <strong>03</strong>
              <span>Chuẩn bị hồ sơ, xét nghiệm và lịch tái khám</span>
            </article>
          </div>
        </section>

        <section className="home-section doctors-cta">
          <div>
            <span>Chưa biết nên gặp bác sĩ nào?</span>
            <h2>Để Bộ Y tế tư vấn chuyên gia phù hợp với tình trạng của bạn.</h2>
          </div>
          <div className="doctors-cta__actions">
            <Link to="/contact">Liên hệ tư vấn</Link>
            <a href="tel:+8419008888">Gọi 1900 8888</a>
          </div>
        </section>
      </div>
    </MarketingPageShell>
  );
}
