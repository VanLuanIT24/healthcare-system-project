import { PageHero } from '../components/PageHero';

export function ContactPage() {
  return (
    <div>
      <PageHero eyebrow="Liên hệ" title="Đầy đủ kênh liên lạc cho bệnh nhân, người nhà và các trường hợp cần hỗ trợ nhanh." description="Dù chưa nối backend cho form, bố cục đã sẵn sàng cho nhu cầu liên hệ thực tế." />
      <section className="section">
        <div className="contact-panel">
          <div>
            <h3>Thông tin liên hệ</h3>
            <p>Địa chỉ: 125 Nguyễn Đình Chiểu, Quận 3, TP.HCM</p>
            <p>Hotline: 1900 6868</p>
            <p>Email: support@healthcare.vn</p>
            <p>Liên hệ khẩn: 115 nội bộ</p>
          </div>
          <form className="contact-form">
            <input placeholder="Họ và tên" />
            <input placeholder="Email hoặc số điện thoại" />
            <textarea rows="5" placeholder="Nội dung cần hỗ trợ" />
            <button type="button" className="cta-button">Gửi liên hệ</button>
          </form>
        </div>
      </section>
    </div>
  );
}
