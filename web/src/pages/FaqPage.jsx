import { PageHero } from '../components/PageHero';
import { faqs } from '../data/siteContent';

export function FaqPage() {
  return (
    <div>
      <PageHero eyebrow="FAQ" title="Giải đáp nhanh những băn khoăn phổ biến trước ngày khám." description="Trang này giúp giảm cuộc gọi lặp lại và tăng tỷ lệ bệnh nhân đến khám đúng giờ." />
      <section className="section">
        <div className="faq-stack">
          {faqs.map((item) => (
            <article key={item.question} className="faq-card">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
