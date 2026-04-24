import { useState } from 'react'
import PatientIcon from '../components/PatientIcon'
import {
  supportCategories,
  supportChannels,
  supportCta,
  supportFaqs,
  supportFooterLinks,
  supportHero,
} from '../data/supportPageData'

export default function PatientSupportPage() {
  const [openFaqId, setOpenFaqId] = useState(supportFaqs[0]?.id || '')

  return (
    <div className="patient-support-page">
      <section className="patient-support-hero">
        <div className="patient-support-hero-glow" aria-hidden="true" />
        <div className="patient-support-hero-copy">
          <p className="patient-eyebrow">Trung tâm hỗ trợ</p>
          <h1>{supportHero.title}</h1>
          <p>{supportHero.body}</p>
          <label className="patient-support-search" aria-label="Tìm kiếm hỗ trợ">
            <span className="patient-support-search-icon" aria-hidden="true">
              <PatientIcon name="search" />
            </span>
            <input type="text" placeholder={supportHero.placeholder} />
          </label>
        </div>
      </section>

      <section className="patient-support-categories">
        {supportCategories.map((category) => (
          <article key={category.id} className="patient-support-category">
            <div className={`patient-support-category-icon ${category.tone}`}>
              <PatientIcon name={category.icon} aria-hidden="true" />
            </div>
            <h2>{category.title}</h2>
            <p>{category.description}</p>
          </article>
        ))}
      </section>

      <section className="patient-support-faq panel-reset">
        <div className="patient-support-section-head">
          <div>
            <p className="patient-section-label">Câu hỏi thường gặp</p>
            <h2>Những thắc mắc phổ biến</h2>
          </div>

          <button className="patient-inline-link patient-support-inline" type="button">
            Xem toàn bộ FAQ
            <PatientIcon name="arrow_forward" aria-hidden="true" />
          </button>
        </div>

        <div className="patient-support-faq-list">
          {supportFaqs.map((faq) => {
            const expanded = faq.id === openFaqId

            return (
              <article key={faq.id} className={`patient-support-faq-item${expanded ? ' is-open' : ''}`}>
                <button
                  className="patient-support-faq-trigger"
                  type="button"
                  onClick={() => setOpenFaqId(expanded ? '' : faq.id)}
                  aria-expanded={expanded}
                >
                  <span>{faq.question}</span>
                  <PatientIcon name={expanded ? 'remove' : 'add'} aria-hidden="true" />
                </button>

                {expanded ? <p className="patient-support-faq-answer">{faq.answer}</p> : null}
              </article>
            )
          })}
        </div>
      </section>

      <section className="patient-support-cta">
        <div className="patient-support-cta-glow" aria-hidden="true" />
        <div className="patient-support-cta-copy">
          <p className="patient-eyebrow support-eyebrow">Hỗ trợ chuyên trách</p>
          <h2>{supportCta.title}</h2>
          <p>{supportCta.body}</p>
          <div className="patient-support-cta-actions">
            <button className="patient-support-cta-primary" type="button">
              {supportCta.primaryAction}
            </button>
            <button className="patient-support-cta-secondary" type="button">
              {supportCta.secondaryAction}
            </button>
          </div>
        </div>

        <div className="patient-support-channel-list">
          {supportChannels.map((channel) => (
            <article key={channel.id} className="patient-support-channel">
              <div className={`patient-support-channel-icon ${channel.tone}`}>
                <PatientIcon name={channel.icon} aria-hidden="true" />
              </div>
              <div>
                <h3>{channel.title}</h3>
                <p>{channel.meta}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="patient-support-footer">
        <div>
          <strong>Clinical Curator Patient Portal</strong>
          <p>© 2024 Clinical Curator. Bảo lưu mọi quyền.</p>
        </div>

        <div className="patient-support-footer-links">
          {supportFooterLinks.map((link) => (
            <button key={link.id} type="button">
              {link.label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  )
}
