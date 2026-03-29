export function AuthCard({ eyebrow, title, description, children, aside }) {
  return (
    <section className="auth-page">
      <div className="auth-page__card">
        <div className="auth-page__main">
          <span className="section-title__eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          {children}
        </div>
        <div className="auth-page__aside">{aside}</div>
      </div>
    </section>
  );
}
