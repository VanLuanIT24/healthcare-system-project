import { PageHero } from '../components/PageHero';

const steps = [
  { title: 'Chọn bác sĩ hoặc chuyên khoa', text: 'Hệ thống ưu tiên các điểm vào rõ ràng để bệnh nhân không bị lạc hướng ngay từ bước đầu.' },
  { title: 'Chọn ngày và khung giờ', text: 'Khung giờ còn trống được hiển thị trực tiếp theo bác sĩ hoặc dịch vụ liên quan.' },
  { title: 'Nhập thông tin bệnh nhân', text: 'Biểu mẫu nên ngắn gọn, ưu tiên thông tin đủ dùng cho tiếp đón và khám ban đầu.' },
  { title: 'Xác nhận và theo dõi', text: 'Sau khi xác nhận, bệnh nhân có thể kiểm tra lại lịch, hướng dẫn đến khám và chính sách liên quan.' },
];

export function BookingGuidePage() {
  return (
    <div>
      <PageHero eyebrow="Hướng dẫn đặt lịch" title="Một hành trình đặt lịch ít ma sát, ít bối rối và ít bỏ dở." description="Trang này giúp bệnh nhân hiểu trước các bước và chuẩn bị đúng kỳ vọng." />
      <section className="section">
        <div className="timeline">
          {steps.map((step, index) => (
            <article key={step.title} className="timeline__item timeline__item--rich">
              <strong>Bước {index + 1}</strong>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
