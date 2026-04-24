import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InfoTopbar } from '../components/InfoTopbar';
export function SupportPage() {
  const supportGroups = [
    {
      id: 'forgot-password',
      title: 'Quên mật khẩu',
      description: 'Hướng dẫn đặt lại quyền truy cập an toàn cho tài khoản bệnh nhân và nhân sự.',
      icon: '◔',
      keywords: ['quên mật khẩu', 'khôi phục', 'reset', 'mật khẩu', 'đăng nhập'],
      intro: 'Nếu bạn quên mật khẩu, bạn có thể khôi phục quyền truy cập tài khoản bằng email hoặc số điện thoại đã đăng ký.',
      steps: [
        'Nhấn vào "Quên mật khẩu" tại trang đăng nhập.',
        'Nhập email hoặc số điện thoại của bạn.',
        'Hệ thống sẽ gửi mã xác thực (OTP).',
        'Nhập mã OTP để xác minh danh tính.',
        'Tạo mật khẩu mới và xác nhận.',
      ],
      notes: [
        'Mã OTP chỉ có hiệu lực trong 5 phút.',
        'Không chia sẻ mã OTP cho bất kỳ ai.',
        'Nếu không nhận được OTP, hãy kiểm tra spam hoặc thử lại sau 60 giây.',
      ],
    },
    {
      id: 'register-account',
      title: 'Đăng ký tài khoản',
      description: 'Các bước tạo mới tài khoản và kích hoạt hồ sơ khám chữa bệnh trực tuyến.',
      icon: '◫',
      keywords: ['đăng ký', 'tạo tài khoản', 'mở tài khoản', 'đăng kí', 'register'],
      intro: 'Bạn có thể tạo tài khoản để sử dụng các dịch vụ như đặt lịch khám, quản lý hồ sơ bệnh nhân và theo dõi lịch sử khám.',
      steps: [
        'Nhấn "Tạo tài khoản mới".',
        'Nhập thông tin cá nhân (họ tên, số điện thoại, email).',
        'Tạo mật khẩu.',
        'Xác nhận bằng mã OTP.',
        'Hoàn tất đăng ký.',
      ],
      after: [
        'Bạn có thể đăng nhập và cập nhật hồ sơ bệnh nhân.',
        'Có thể đặt lịch khám ngay.',
      ],
      notes: ['Thông tin phải chính xác để phục vụ khám chữa bệnh.'],
    },
    {
      id: 'booking',
      title: 'Đặt lịch khám',
      description: 'Hướng dẫn đặt lịch, đổi lịch và theo dõi trạng thái lịch hẹn trên hệ thống.',
      icon: '◧',
      keywords: ['đặt lịch', 'lịch khám', 'đổi lịch', 'hẹn khám', 'booking'],
      intro: 'Bạn có thể đặt lịch khám trực tuyến nhanh chóng.',
      steps: [
        'Chọn chuyên khoa.',
        'Chọn bác sĩ.',
        'Chọn ngày và khung giờ.',
        'Nhập thông tin bệnh nhân.',
        'Xác nhận lịch hẹn.',
      ],
      after: [
        'Xem lịch hẹn trong "Lịch của tôi".',
        'Đổi lịch hoặc hủy nếu cần.',
      ],
      notes: [
        'Đến sớm 10-15 phút trước giờ khám.',
        'Một số lịch có thể không hoàn tiền khi hủy muộn.',
      ],
    },
    {
      id: 'payment-insurance',
      title: 'Thanh toán & bảo hiểm',
      description: 'Tra cứu chi phí, phương thức thanh toán và đồng bộ thông tin bảo hiểm.',
      icon: '◈',
      keywords: ['thanh toán', 'bảo hiểm', 'chi phí', 'hoàn phí', 'bảo hiểm y tế'],
      intro: 'Hệ thống hỗ trợ nhiều hình thức thanh toán.',
      methods: ['Thanh toán online', 'Thanh toán tại bệnh viện', 'Bảo hiểm y tế (nếu áp dụng)'],
      after: [
        'Xem chi phí trước khi xác nhận.',
        'Theo dõi trạng thái thanh toán.',
      ],
      notes: [
        'Một số dịch vụ không áp dụng bảo hiểm.',
        'Hoàn tiền tùy theo chính sách từng lịch hẹn.',
      ],
    },
    {
      id: 'patient-record',
      title: 'Hồ sơ bệnh nhân',
      description: 'Quản lý thông tin cá nhân, hồ sơ sức khỏe và lịch sử sử dụng dịch vụ.',
      icon: '◎',
      keywords: ['hồ sơ', 'bệnh án', 'thông tin cá nhân', 'hồ sơ bệnh nhân', 'patient'],
      intro: 'Bạn có thể quản lý toàn bộ thông tin y tế tại đây.',
      includes: ['Thông tin cá nhân', 'Lịch sử khám', 'Kết quả xét nghiệm', 'Đơn thuốc'],
      after: [
        'Cập nhật thông tin.',
        'Xem lại lịch sử khám.',
        'Tải xuống tài liệu.',
      ],
      notes: ['Thông tin cần chính xác để đảm bảo an toàn y tế.'],
    },
    {
      id: 'online-service',
      title: 'Dịch vụ trực tuyến',
      description: 'Kết nối các nhu cầu phổ biến như tư vấn, tiếp nhận yêu cầu và hỗ trợ nhanh.',
      icon: '◌',
      keywords: ['trực tuyến', 'chat', 'tư vấn', 'hỗ trợ nhanh', 'dịch vụ online'],
      intro: 'Hệ thống cung cấp các dịch vụ trực tuyến tiện lợi:',
      services: ['Tư vấn từ xa', 'Gửi yêu cầu hỗ trợ', 'Chat với nhân viên', 'Theo dõi hồ sơ'],
      after: [
        'Gửi yêu cầu bất cứ lúc nào.',
        'Nhận phản hồi trong vòng 24h.',
      ],
      notes: ['Không dùng cho trường hợp cấp cứu.'],
    },
  ];

  const supportFaqs = [
    {
      question: 'Tôi quên mật khẩu thì làm sao?',
      answer: 'Bạn có thể sử dụng chức năng "Quên mật khẩu" và nhập email hoặc số điện thoại để nhận mã OTP và tạo mật khẩu mới.',
    },
    {
      question: 'Tôi có thể đổi lịch khám không?',
      answer: 'Có. Bạn vào "Lịch của tôi", chọn lịch cần đổi và thực hiện thay đổi nếu hệ thống cho phép.',
    },
    {
      question: 'Tôi có thể hủy lịch khám không?',
      answer: 'Bạn có thể hủy lịch trước thời gian quy định. Một số trường hợp hủy muộn có thể không được hoàn tiền.',
    },
    {
      question: 'Tôi không nhận được OTP?',
      answer: 'Hãy kiểm tra email spam hoặc đợi 60 giây rồi thử lại. Nếu vẫn không nhận được, hãy liên hệ hỗ trợ.',
    },
    {
      question: 'Tôi có thể đăng ký bằng số điện thoại không?',
      answer: 'Có. Bạn có thể đăng ký bằng email hoặc số điện thoại đều được.',
    },
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupportId, setSelectedSupportId] = useState(supportGroups[0].id);

  const selectedSupport = supportGroups.find((item) => item.id === selectedSupportId) || supportGroups[0];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchedSupport = normalizedQuery
    ? supportGroups.find(
        (item) =>
          item.title.toLowerCase().includes(normalizedQuery) ||
          item.description.toLowerCase().includes(normalizedQuery) ||
          item.keywords.some((keyword) => keyword.includes(normalizedQuery) || normalizedQuery.includes(keyword)),
      )
    : null;

  const answerTitle = matchedSupport ? `Kết quả cho: ${searchQuery.trim()}` : 'Nội dung hỗ trợ đang chọn';
  const answerDescription = matchedSupport
    ? `Healthcare đã tìm thấy mục gần nhất với câu hỏi của bạn trong nhóm "${matchedSupport.title}".`
    : `Bạn có thể bấm trực tiếp từng mục bên dưới để mở hướng dẫn chi tiết ngay trên trang này.`;
  const activeSupport = matchedSupport || selectedSupport;
  const activeSupportId = activeSupport.id;

  const contactChannels = [
    {
      title: 'Hỗ trợ qua điện thoại',
      detail: 'Đường dây nóng hoạt động xuyên suốt trong giờ hành chính và khi cần hỗ trợ khẩn.',
      action: '1800 1234',
      meta: 'Miễn phí cước gọi',
      icon: '✆',
    },
    {
      title: 'Hỗ trợ qua email',
      detail: 'Gửi yêu cầu chi tiết để đội ngũ chăm sóc khách hàng phản hồi theo từng trường hợp.',
      action: 'support@healthcare.vn',
      meta: 'Phản hồi trong ngày',
      icon: '✉',
    },
    {
      title: 'Trợ chuyện trực tuyến',
      detail: 'Mở phiên chat để được điều phối đến đúng bộ phận đăng ký, hồ sơ hoặc thanh toán.',
      action: 'Bắt đầu chat',
      meta: 'Tư vấn thời gian thực',
      icon: '⌁',
    },
  ];

  function handleSupportSearch(event) {
    event.preventDefault();
    if (matchedSupport) {
      setSelectedSupportId(matchedSupport.id);
      return;
    }

    setSelectedSupportId(supportGroups[0].id);
  }

  return (
    <main className="info-shell">
      <InfoTopbar />

      <section className="info-hero support-hero">
        <div className="info-hero__copy">
          <h1>Hỗ trợ</h1>
          <p>
            Tìm hướng dẫn nhanh về sử dụng hệ thống, khôi phục tài khoản, đặt lịch và các câu hỏi phổ biến từ đội ngũ hỗ trợ Healthcare.
          </p>

          <form className="support-search" onSubmit={handleSupportSearch}>
            <div className="support-search__input">
              <span aria-hidden="true">⌕</span>
              <input
                type="text"
                placeholder="Nhập câu hỏi của bạn..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <button type="submit">Tìm kiếm</button>
          </form>
        </div>

        <div className="info-hero__art support-art" aria-hidden="true">
          <div className="support-art__bubble support-art__bubble--one" />
          <div className="support-art__bubble support-art__bubble--two" />
          <div className="support-art__bubble support-art__bubble--three" />
          <div className="support-art__screen" />
          <div className="support-art__person">
            <span className="support-art__head" />
            <span className="support-art__body" />
            <span className="support-art__arm support-art__arm--left" />
            <span className="support-art__arm support-art__arm--right" />
            <span className="support-art__headset" />
          </div>
          <div className="support-art__card support-art__card--camera">⌘</div>
          <div className="support-art__card support-art__card--light">✦</div>
          <div className="support-art__card support-art__card--mail">@</div>
          <div className="support-art__card support-art__card--chat">☰</div>
        </div>
      </section>

      <section className="info-section">
        <div className="section-heading">
          <h2>Hỗ trợ</h2>
        </div>
        <div className="support-grid">
          {supportGroups.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`support-card${activeSupportId === item.id ? ' is-active' : ''}`}
              onClick={() => setSelectedSupportId(item.id)}
            >
              <span className="support-card__icon" aria-hidden="true">
                {item.icon}
              </span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="info-section">
        <div className="support-answer">
          <div className="support-answer__head">
            <div>
              <p className="support-answer__kicker">Healthcare Support</p>
              <h3>{activeSupport.title}</h3>
            </div>
            <span className="support-answer__badge">{matchedSupport ? 'Tìm thấy câu trả lời' : 'Hướng dẫn chi tiết'}</span>
          </div>
          <p className="support-answer__title">{answerTitle}</p>
          <p className="support-answer__description">{answerDescription}</p>
          <div className="support-answer__body">
            <section className="support-answer__section">
              <h4>{activeSupport.title}</h4>
              <p>{activeSupport.intro}</p>
            </section>

            {activeSupport.steps ? (
              <section className="support-answer__section">
                <h5>Các bước thực hiện</h5>
                <ol>
                  {activeSupport.steps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </section>
            ) : null}

            {activeSupport.methods ? (
              <section className="support-answer__section">
                <h5>Các hình thức</h5>
                <ul>
                  {activeSupport.methods.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {activeSupport.includes ? (
              <section className="support-answer__section">
                <h5>Bao gồm</h5>
                <ul>
                  {activeSupport.includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {activeSupport.services ? (
              <section className="support-answer__section">
                <h5>Dịch vụ có sẵn</h5>
                <ul>
                  {activeSupport.services.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {activeSupport.after ? (
              <section className="support-answer__section">
                <h5>Bạn có thể</h5>
                <ul>
                  {activeSupport.after.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {activeSupport.notes ? (
              <section className="support-answer__section">
                <h5>Lưu ý</h5>
                <ul>
                  {activeSupport.notes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </section>

      <section className="info-section">
        <div className="support-faq">
          <div className="section-heading">
            <h2>Câu hỏi thường gặp</h2>
          </div>
          <div className="support-faq__list">
            {supportFaqs.map((item) => (
              <article key={item.question} className="support-faq__item">
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="info-section info-section--contacts">
        <div className="section-heading">
          <h2>Liên hệ với chúng tôi</h2>
        </div>
        <div className="contact-grid">
          {contactChannels.map((item) => (
            <article key={item.title} className="contact-card">
              <div className="contact-card__header">
                <span className="contact-card__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <h3>{item.title}</h3>
              </div>
              <p>{item.detail}</p>
              <div className="contact-card__footer">
                <span>{item.meta}</span>
                <button type="button">{item.action}</button>
              </div>
            </article>
          ))}
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
