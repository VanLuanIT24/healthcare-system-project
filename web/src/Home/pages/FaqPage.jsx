import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Globe2,
  HeartPulse,
  MessageCircle,
  PhoneCall,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  WalletCards,
} from 'lucide-react';
import { MarketingPageShell } from './MarketingPageShell';

const FAQ_HERO_STATS = [
  {
    icon: Clock3,
    value: '<20 phút',
    label: 'phản hồi lịch hẹn',
  },
  {
    icon: ShieldCheck,
    value: '24/7',
    label: 'điều phối y tế',
  },
  {
    icon: FileText,
    value: '100%',
    label: 'hồ sơ lưu số',
  },
];

const FAQ_CATEGORIES = [
  {
    title: 'Lịch hẹn',
    icon: CalendarCheck,
    color: 'is-blue',
    metric: '15 phút',
    accent: 'Xác nhận nhanh',
    description: 'Quản lý, thay đổi và chuẩn bị cho lần thăm khám sắp tới.',
  },
  {
    title: 'Bảo hiểm',
    icon: ShieldCheck,
    color: 'is-green',
    metric: '30+ đối tác',
    accent: 'Kiểm tra quyền lợi',
    description: 'Thông tin về bảo hiểm và quy trình thanh toán trực tiếp.',
  },
  {
    title: 'Quy trình',
    icon: CheckCircle2,
    color: 'is-indigo',
    metric: '4 bước',
    accent: 'Rõ ràng từng chặng',
    description: 'Các bước thăm khám từ lúc tiếp nhận đến khi xuất viện.',
  },
  {
    title: 'Dịch vụ',
    icon: Stethoscope,
    color: 'is-slate',
    metric: '24/7',
    accent: 'Chuyên khoa kết nối',
    description: 'Chi tiết về chuyên khoa, công nghệ y tế và hỗ trợ quốc tế.',
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
  { id: 'all', label: 'Chủ đề phổ biến', icon: Sparkles },
  { id: 'records', label: 'Hồ sơ y tế điện tử', icon: FileText },
  { id: 'services', label: 'Dịch vụ quốc tế', icon: Globe2 },
  { id: 'privacy', label: 'Chính sách bảo mật', icon: ShieldCheck },
  { id: 'billing', label: 'Hướng dẫn thanh toán', icon: WalletCards },
  { id: 'appointments', label: 'Lịch hẹn & thăm khám', icon: CalendarCheck },
];

const FAQ_PRIORITY_CARDS = [
  {
    title: 'Dịch vụ ưu tiên',
    tone: 'dark',
    icon: BadgeCheck,
    badge: 'Care concierge',
    description:
      'Dành cho bệnh nhân quốc tế và khách hàng có nhu cầu chăm sóc đặc biệt với đội ngũ điều phối riêng biệt.',
    action: 'Tìm hiểu thêm',
  },
  {
    title: 'Hỗ trợ 24/7',
    tone: 'light',
    icon: HeartPulse,
    badge: 'Medical hotline',
    description:
      'Đội ngũ y tế luôn túc trực để giải đáp thắc mắc khẩn cấp, chuẩn bị hồ sơ và điều phối lịch phù hợp.',
    action: 'Liên hệ ngay',
  },
];

const FAQ_SUPPORT_CHANNELS = [
  {
    label: 'Gọi ngay',
    value: '1900 1234',
    icon: PhoneCall,
    className: 'is-call',
  },
  {
    label: 'Chat trực tuyến',
    value: 'Điều phối viên',
    icon: MessageCircle,
    className: 'is-chat',
  },
  {
    label: 'Yêu cầu hồ sơ',
    value: 'Kết quả & toa thuốc',
    icon: FileText,
    className: 'is-records',
  },
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
            <span className="faq-search-hero__badge">
              <Sparkles size={16} aria-hidden="true" />
              Trung tâm hỗ trợ
            </span>
            <h2>Giải đáp nhanh, chuẩn y khoa</h2>
            <p>
              Tìm câu trả lời về lịch hẹn, bảo hiểm, hồ sơ điện tử và dịch vụ quốc tế trong một
              không gian hỗ trợ được thiết kế cho bệnh nhân Healthcare Plus+.
            </p>

            <div className="faq-hero-stats" aria-label="Chỉ số hỗ trợ bệnh nhân">
              {FAQ_HERO_STATS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.label}>
                    <span aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <strong>{item.value}</strong>
                    <small>{item.label}</small>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="faq-search-hero__desk">
            <div className="faq-search-box" role="search">
              <span className="faq-search-box__icon" aria-hidden="true">
                <Search size={20} />
              </span>
              <input
                aria-label="Tìm kiếm câu hỏi thường gặp"
                type="search"
                placeholder="Tìm kiếm: bảo hiểm, lịch hẹn, hồ sơ..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button">
                <span>Tìm kiếm</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="faq-search-hero__quick-card">
              <div className="faq-quick-card__top">
                <span className="faq-live-indicator">
                  <span aria-hidden="true" />
                  Online
                </span>
                <strong>Care desk</strong>
              </div>
              <p>
                Điều phối viên hỗ trợ rà soát câu hỏi, chuẩn bị giấy tờ và kết nối đúng chuyên khoa.
              </p>

              <div className="faq-quick-card__timeline" aria-label="Quy trình hỗ trợ nhanh">
                <span>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Tiếp nhận
                </span>
                <span>
                  <FileText size={16} aria-hidden="true" />
                  Hồ sơ
                </span>
                <span>
                  <CalendarCheck size={16} aria-hidden="true" />
                  Lịch hẹn
                </span>
              </div>

              <div className="faq-quick-card__agent">
                <span aria-hidden="true">HP+</span>
                <div>
                  <strong>Điều phối viên trực</strong>
                  <small>Sẵn sàng hỗ trợ trong ngày</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="faq-category-grid" aria-label="Nhóm câu hỏi thường gặp">
          {FAQ_CATEGORIES.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="faq-category-card">
                <header>
                  <span className={`faq-category-card__icon ${item.color}`} aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <span className="faq-category-card__metric">{item.metric}</span>
                </header>
                <h3>{item.title}</h3>
                <strong>{item.accent}</strong>
                <p>{item.description}</p>
              </article>
            );
          })}
        </section>

        <section className="faq-answers">
          <div className="faq-answers__heading">
            <span className="faq-answers__eyebrow">
              <BadgeCheck size={16} aria-hidden="true" />
              Bộ câu hỏi đã kiểm duyệt
            </span>
            <h2>Câu hỏi phổ biến nhất</h2>
            <p>Những vấn đề bệnh nhân thường quan tâm khi đến thăm khám.</p>
          </div>

          <div className="faq-answers__layout">
            <aside className="faq-topic-sidebar">
              <span className="faq-topic-sidebar__eyebrow">Danh mục cần thiết</span>
              <div className="faq-topic-sidebar__list">
                {FAQ_TOPIC_GROUPS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === activeTopic ? 'is-active' : ''}
                      onClick={() => setActiveTopic(item.id)}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="faq-accordion-list">
              {filteredItems.length ? (
                filteredItems.map((item, index) => (
                  <details key={item.question} className="faq-accordion-item" open={index === 0}>
                    <summary>
                      <span className="faq-accordion-item__question">
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        <span>{item.question}</span>
                      </span>
                      <span className="faq-accordion-item__caret" aria-hidden="true">
                        <ChevronDown size={19} />
                      </span>
                    </summary>
                    <div className="faq-accordion-item__content">
                      <p>{item.answer}</p>
                    </div>
                  </details>
                ))
              ) : (
                <div className="faq-accordion-item faq-accordion-item--empty">
                  <div className="faq-accordion-item__content">
                    <Search size={24} aria-hidden="true" />
                    <p>Chưa có câu hỏi phù hợp với từ khóa hoặc chủ đề bạn đang chọn.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="faq-priority-grid" aria-label="Dịch vụ hỗ trợ ưu tiên">
          {FAQ_PRIORITY_CARDS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className={`faq-priority-card faq-priority-card--${item.tone}`}>
                <span className="faq-priority-card__badge">
                  <Icon size={17} aria-hidden="true" />
                  {item.badge}
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <button type="button">
                  <span>{item.action}</span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
                {item.tone === 'dark' ? <span className="faq-priority-card__pulse" aria-hidden="true" /> : null}
              </article>
            );
          })}
        </section>

        <section className="faq-support-cta">
          <div className="faq-support-cta__copy">
            <span>
              <HeartPulse size={17} aria-hidden="true" />
              Kết nối trực tiếp
            </span>
            <h2>Vẫn còn thắc mắc?</h2>
            <p>
              Đội ngũ hỗ trợ sẵn sàng giải đáp 24/7, kiểm tra thông tin trước ngày khám và giúp bạn
              đi đúng luồng chăm sóc ngay từ bước đầu.
            </p>
          </div>

          <div className="faq-support-cta__actions">
            {FAQ_SUPPORT_CHANNELS.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.label} type="button" className={`faq-support-cta__channel ${item.className}`}>
                  <span aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <strong>{item.label}</strong>
                  <small>{item.value}</small>
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </MarketingPageShell>
  );
}
