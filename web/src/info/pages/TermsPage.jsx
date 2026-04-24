import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InfoTopbar } from '../components/InfoTopbar';
export function TermsPage() {
  const tocItems = [
    {
      title: 'Điều kiện sử dụng dịch vụ',
      content: 'Người dùng phải cung cấp thông tin chính xác khi đăng ký và sử dụng hệ thống.',
      bullets: [
        'Không được giả mạo danh tính.',
        'Không được sử dụng trái phép hệ thống.',
        'Không được gây ảnh hưởng đến hoạt động của hệ thống.',
      ],
      closing: 'Hệ thống có quyền từ chối dịch vụ nếu phát hiện vi phạm.',
    },
    {
      title: 'Tài khoản người dùng',
      content: 'Người dùng chịu trách nhiệm bảo mật tài khoản.',
      bullets: ['Không được chia sẻ tài khoản.', 'Không được cho người khác sử dụng.'],
      closing: 'Nếu phát hiện truy cập bất thường, hệ thống có thể khóa tài khoản tạm thời.',
    },
    {
      title: 'Đặt lịch và sử dụng dịch vụ khám',
      content: 'Lịch khám phụ thuộc vào bác sĩ, chuyên khoa và thời gian trống.',
      bullets: ['Người dùng cần kiểm tra kỹ thông tin.', 'Người dùng cần đến đúng giờ.'],
      closing: 'Hệ thống không chịu trách nhiệm nếu người dùng nhập sai thông tin.',
    },
    {
      title: 'Thanh toán và hoàn phí',
      content: 'Chi phí sẽ hiển thị trước khi xác nhận.',
      bullets: ['Hoàn phí tùy theo từng trường hợp.', 'Không áp dụng cho mọi dịch vụ.'],
      closing: 'Người dùng cần kiểm tra kỹ trước khi thanh toán.',
    },
    {
      title: 'Quyền riêng tư và dữ liệu',
      content: 'Hệ thống thu thập dữ liệu để quản lý hồ sơ bệnh nhân, đặt lịch khám và cung cấp dịch vụ.',
      bullets: [
        'Dữ liệu được bảo mật theo tiêu chuẩn hệ thống.',
        'Một số dữ liệu có thể chia sẻ với bác sĩ.',
        'Một số dữ liệu có thể chia sẻ với cơ sở y tế.',
      ],
      closing: '',
    },
    {
      title: 'Trách nhiệm người dùng',
      content: 'Người dùng cần tuân thủ các quy định chung khi sử dụng hệ thống.',
      bullets: [
        'Cung cấp thông tin đúng.',
        'Không sử dụng sai mục đích.',
        'Tuân thủ quy định hệ thống.',
      ],
      closing: '',
    },
    {
      title: 'Giới hạn trách nhiệm',
      content: 'Hệ thống không đảm bảo không có lỗi kỹ thuật 100% hoặc luôn hoạt động liên tục.',
      bullets: ['Dịch vụ trực tuyến không thay thế khám trực tiếp tại bệnh viện.'],
      closing: '',
    },
  ];

  const faqItems = [
    {
      question: 'Điều khoản áp dụng cho ai?',
      answer: 'Áp dụng cho tất cả người dùng đăng ký và sử dụng hệ thống.',
    },
    {
      question: 'Tôi có thể đóng tài khoản không?',
      answer: 'Có. Bạn có thể gửi yêu cầu qua hỗ trợ để đóng tài khoản.',
    },
    {
      question: 'Dữ liệu của tôi được sử dụng như thế nào?',
      answer: 'Dữ liệu được dùng để cung cấp dịch vụ y tế và không sử dụng sai mục đích.',
    },
  ];

  const [selectedTermIndex, setSelectedTermIndex] = useState(0);
  const activeTerm = tocItems[selectedTermIndex] || tocItems[0];

  return (
    <main className="info-shell">
      <InfoTopbar />

      <section className="info-hero terms-hero">
        <div className="info-hero__copy">
          <h1>Điều khoản</h1>
          <div className="terms-meta">
            <p>Cập nhật lần cuối: 07/04/2026</p>
            <p>Phiên bản: v1.0</p>
          </div>
          <p>Vui lòng đọc kỹ các điều kiện sử dụng để hiểu rõ trách nhiệm, phạm vi dịch vụ và cách dữ liệu được bảo vệ trong hệ thống Healthcare.</p>
        </div>

        <div className="info-hero__art terms-art" aria-hidden="true">
          <div className="terms-art__panel" />
          <div className="terms-art__clipboard">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="terms-art__shield" />
          <div className="terms-art__gavel" />
          <div className="terms-art__plus" />
        </div>
      </section>

      <section className="terms-layout">
        <aside className="terms-toc">
          <h2>Mục lục</h2>
          <div className="terms-toc__card">
            {tocItems.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={index === selectedTermIndex ? 'is-active' : ''}
                onClick={() => setSelectedTermIndex(index)}
              >
                <span>{index + 1}.</span>
                <span>{item.title}</span>
              </button>
            ))}
          </div>
          <div className="terms-toc__illustration" aria-hidden="true">
            <span className="terms-toc__doc" />
            <span className="terms-toc__lock" />
          </div>
        </aside>

        <div className="terms-main">
          <article className="terms-article">
            <header>
              <span>{selectedTermIndex + 1}</span>
              <h3>{activeTerm.title}</h3>
            </header>
            <div className="terms-article__body">
              <p>{activeTerm.content}</p>
              <ul>
                {activeTerm.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {activeTerm.closing ? <p>{activeTerm.closing}</p> : null}
            </div>
          </article>

          <section className="terms-faq">
            <header>
              <span>?</span>
              <h3>Câu hỏi thường gặp</h3>
            </header>
            <div className="terms-faq__list">
              {faqItems.map((item) => (
                <article key={item.question} className="terms-faq__item">
                  <h4>{item.question}</h4>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      <footer className="info-footer">
        <nav>
          <Link to="/support">Hỗ trợ</Link>
          <Link to="/terms">Điều khoản</Link>
          <Link to="/forgot-password">Khôi phục</Link>
          <Link to="/login">Liên hệ</Link>
        </nav>
        <p>© 2026 Healthcare. All rights reserved.</p>
      </footer>
    </main>
  );
}
