import React, { useMemo, useState } from 'react';
import { MarketingPageShell } from './MarketingPageShell';

function FaqCategoryIcon({ type }) {
  if (type === 'appointments') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="6.5" width="15" height="13" rx="3" />
        <path d="M8 4.5v4" />
        <path d="M16 4.5v4" />
        <path d="M4.5 10.5h15" />
      </svg>
    );
  }

  if (type === 'insurance') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5l6 2.7v4.5c0 4.2-2.4 6.8-6 7.8-3.6-1-6-3.6-6-7.8V7.2L12 4.5z" />
        <path d="M9.5 11.9l1.6 1.6 3.4-3.7" />
      </svg>
    );
  }

  if (type === 'process') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="3" />
        <path d="M12 8v8" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="5.5" width="9" height="5" rx="1.5" />
      <rect x="4.5" y="13.5" width="6.5" height="5" rx="1.5" />
      <path d="M15.5 14.5h4" />
      <path d="M15.5 17.5h4" />
      <path d="M15.5 10.5h4" />
    </svg>
  );
}

const FAQ_CATEGORIES = [
  {
    title: 'Lịch hẹn',
    icon: 'appointments',
    color: 'is-blue',
    description: 'Quản lý, thay đổi và chuẩn bị cho lần thăm khám sắp tới.',
  },
  {
    title: 'Bảo hiểm',
    icon: 'insurance',
    color: 'is-green',
    description: 'Thông tin về đối tác bảo hiểm và quy trình thanh toán trực tiếp.',
  },
  {
    title: 'Quy trình',
    icon: 'process',
    color: 'is-indigo',
    description: 'Các bước thăm khám từ lúc tiếp nhận đến khi xuất viện.',
  },
  {
    title: 'Dịch vụ',
    icon: 'services',
    color: 'is-slate',
    description: 'Chi tiết về các chuyên khoa và công nghệ y tế tiên tiến.',
  },
];

const FAQ_ITEMS = [
  {
    topic: 'appointments',
    question: 'Tôi cần chuẩn bị những gì trước khi đi khám tổng quát?',
    answer:
      'Bệnh nhân nên nhịn ăn ít nhất 8 tiếng trước khi lấy máu xét nghiệm. Hãy mang theo hồ sơ bệnh án cũ, toa thuốc đang dùng và thẻ bảo hiểm y tế nếu có. Chúng tôi cũng khuyến khích bạn mặc trang phục thoải mái để thuận tiện cho việc thăm khám lâm sàng.',
  },
  {
    topic: 'billing',
    question: 'Bệnh viện có chấp nhận bảo hiểm y tế tư nhân nước ngoài không?',
    answer:
      'Một số gói bảo hiểm quốc tế và bảo hiểm tư nhân được chấp nhận theo hình thức thanh toán trực tiếp hoặc hoàn trả sau. Đội ngũ hỗ trợ có thể kiểm tra nhanh quyền lợi trước ngày hẹn để bạn chủ động chuẩn bị giấy tờ cần thiết.',
  },
  {
    topic: 'records',
    question: 'Làm thế nào để lấy kết quả xét nghiệm trực tuyến?',
    answer:
      'Bạn có thể đăng nhập cổng bệnh nhân để xem kết quả xét nghiệm, đơn thuốc và các ghi chú sau khám. Những kết quả cần bác sĩ giải thích thêm sẽ được đánh dấu rõ và đội ngũ điều phối sẽ liên hệ nếu cần hẹn tư vấn bổ sung.',
  },
  {
    topic: 'appointments',
    question: 'Thời gian chờ đợi trung bình cho một ca khám chuyên khoa là bao lâu?',
    answer:
      'Với lịch hẹn đã xác nhận trước, thời gian chờ trung bình thường dưới 20 phút. Những ca có thêm chẩn đoán hình ảnh, xét nghiệm hoặc hội chẩn liên chuyên khoa sẽ cần thêm thời gian và được thông báo rõ ngay tại quầy điều phối.',
  },
  {
    topic: 'services',
    question: 'Người thân có thể đi cùng trong suốt quá trình thăm khám không?',
    answer:
      'Người thân có thể đồng hành ở phần lớn các khu vực tư vấn và chờ khám. Với một số phòng thủ thuật hoặc chẩn đoán hình ảnh, bệnh viện sẽ có hướng dẫn riêng để vừa đảm bảo an toàn vừa giữ sự riêng tư cho người bệnh.',
  },
  {
    topic: 'appointments',
    question: 'Tôi có thể đổi bác sĩ sau khi đã đặt lịch không?',
    answer:
      'Có. Nếu lịch của bác sĩ mới vẫn còn chỗ, đội ngũ hỗ trợ sẽ giúp bạn đổi sang khung giờ phù hợp mà không cần tạo lịch hẹn mới từ đầu. Việc đổi bác sĩ nên được thực hiện sớm để đảm bảo còn thời gian trống.',
  },
  {
    topic: 'services',
    question: 'Bệnh viện có hỗ trợ bệnh nhân quốc tế từ khâu đặt lịch đến phiên dịch không?',
    answer:
      'Có. Dịch vụ quốc tế hỗ trợ xác nhận lịch, chuẩn bị hồ sơ trước chuyến đi, đón tiếp tại viện và điều phối phiên dịch theo nhu cầu. Với những ca điều trị nhiều bước, đội ngũ điều phối sẽ cung cấp lộ trình rõ ràng để bệnh nhân và người nhà chủ động hơn.',
  },
  {
    topic: 'privacy',
    question: 'Dữ liệu khám chữa bệnh của tôi được bảo mật như thế nào?',
    answer:
      'Hồ sơ bệnh án và dữ liệu cổng bệnh nhân được quản lý theo quyền truy cập phân tầng. Chỉ những nhân sự có liên quan trực tiếp đến quá trình chăm sóc mới được xem thông tin phù hợp với nhiệm vụ của họ, đồng thời mọi truy cập đều được ghi nhận để kiểm soát nội bộ.',
  },
  {
    topic: 'billing',
    question: 'Tôi có thể thanh toán trực tuyến trước ngày khám hay không?',
    answer:
      'Bạn có thể thanh toán trước với một số dịch vụ, gói khám hoặc khoản đặt cọc theo hướng dẫn trong cổng bệnh nhân. Sau khi thanh toán thành công, hệ thống sẽ lưu biên nhận điện tử để bạn dễ theo dõi và đối chiếu tại quầy tiếp nhận.',
  },
];

const FAQ_TOPIC_GROUPS = [
  { id: 'all', label: 'Chủ đề phổ biến' },
  { id: 'records', label: 'Hồ sơ y tế điện tử' },
  { id: 'services', label: 'Dịch vụ quốc tế' },
  { id: 'privacy', label: 'Chính sách bảo mật' },
  { id: 'billing', label: 'Hướng dẫn thanh toán' },
  { id: 'appointments', label: 'Lịch hẹn & thăm khám' },
];

export function FaqPage() {
  const [query, setQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('all');
  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      const matchesTopic = activeTopic === 'all' || item.topic === activeTopic;
      const matchesKeyword =
        !keyword ||
        item.question.toLowerCase().includes(keyword) ||
        item.answer.toLowerCase().includes(keyword);
      return matchesTopic && matchesKeyword;
    });
  }, [activeTopic, query]);

  return (
    <MarketingPageShell activeKey="faq">
      <section className="home-section site-page-section faq-page">
        <section className="faq-search-hero">
          <div className="faq-search-hero__content">
            <span className="faq-search-hero__badge">Trung tâm hỗ trợ</span>
            <h2>Câu hỏi thường gặp</h2>
            <p>
              Mọi thứ bạn cần biết về các thủ tục y tế, quy trình thăm khám và chăm sóc sức khỏe tại
              Healthcare Plus+.
            </p>
          </div>

          <div className="faq-search-box">
            <span className="faq-search-box__icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Tìm kiếm theo từ khóa (ví dụ: bảo hiểm, lịch hẹn...)"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="button">Tìm kiếm</button>
          </div>
        </section>

        <section className="faq-category-grid">
          {FAQ_CATEGORIES.map((item) => (
            <article key={item.title} className="faq-category-card">
              <span className={`faq-category-card__icon ${item.color}`} aria-hidden="true">
                <FaqCategoryIcon type={item.icon} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </section>

        <section className="faq-answers">
          <div className="faq-answers__heading">
            <h2>Câu hỏi phổ biến nhất</h2>
            <p>Những vấn đề bệnh nhân thường quan tâm khi đến thăm khám.</p>
          </div>

          <div className="faq-answers__layout">
            <aside className="faq-topic-sidebar">
              <span className="faq-topic-sidebar__eyebrow">Danh mục cần thiết</span>
              <div className="faq-topic-sidebar__list">
                {FAQ_TOPIC_GROUPS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.id === activeTopic ? 'is-active' : ''}
                    onClick={() => setActiveTopic(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </aside>

            <div className="faq-accordion-list">
              {filteredItems.length ? (
                filteredItems.map((item, index) => (
                  <details key={item.question} className="faq-accordion-item" open={index === 0}>
                    <summary>
                      <span>{item.question}</span>
                      <span className="faq-accordion-item__caret" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="faq-accordion-item__content">
                      <p>{item.answer}</p>
                    </div>
                  </details>
                ))
              ) : (
                <div className="faq-accordion-item faq-accordion-item--empty">
                  <div className="faq-accordion-item__content">
                    <p>Chưa có câu hỏi phù hợp với từ khóa hoặc chủ đề bạn đang chọn.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="faq-priority-grid">
          <article className="faq-priority-card faq-priority-card--dark">
            <h3>Dịch vụ ưu tiên</h3>
            <p>
              Dành cho bệnh nhân quốc tế và khách hàng có nhu cầu chăm sóc đặc biệt với đội ngũ điều
              phối riêng biệt.
            </p>
            <button type="button">Tìm hiểu thêm ↗</button>
            <span className="faq-priority-card__pulse" aria-hidden="true" />
          </article>

          <article className="faq-priority-card faq-priority-card--light">
            <h3>Hỗ trợ 24/7</h3>
            <p>
              Đội ngũ y tế của chúng tôi luôn túc trực để giải đáp mọi thắc mắc khẩn cấp của bạn bất cứ
              lúc nào.
            </p>
            <button type="button">Liên hệ ngay ↗</button>
          </article>
        </section>

        <section className="faq-support-cta">
          <div className="faq-support-cta__copy">
            <h2>Vẫn còn thắc mắc?</h2>
            <p>
              Đội ngũ hỗ trợ của chúng tôi luôn sẵn sàng giải đáp mọi câu hỏi của bạn 24/7. Hãy liên hệ
              qua các kênh dưới đây để được tư vấn trực tiếp.
            </p>
          </div>

          <div className="faq-support-cta__actions">
            <button type="button" className="faq-support-cta__call">
              <span>📞</span>
              <strong>Gọi ngay: 1900 1234</strong>
            </button>
            <button type="button" className="faq-support-cta__chat">
              <span>💬</span>
              <strong>Chat trực tuyến</strong>
            </button>
          </div>
        </section>
      </section>
    </MarketingPageShell>
  );
}
