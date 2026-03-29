import { Link } from 'react-router-dom';

export function PageHero({
  eyebrow,
  title,
  description,
  primaryLabel = 'Đặt lịch khám',
  primaryTo = '/huong-dan-dat-lich',
  secondaryLabel,
  secondaryTo,
}) {
  return (
    <section className="page-hero">
      <div className="page-hero__content">
        <span className="section-title__eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="hero-actions">
          <Link className="cta-button" to={primaryTo}>
            {primaryLabel}
          </Link>
          {secondaryLabel ? (
            <Link className="ghost-button" to={secondaryTo}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
