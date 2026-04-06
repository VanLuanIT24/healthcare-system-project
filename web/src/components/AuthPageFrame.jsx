export default function AuthPageFrame({ eyebrow, title, description, side, children }) {
  return (
    <section className="auth-frame">
      <div className="auth-frame-panel auth-frame-intro">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {side}
      </div>
      <div className="auth-frame-panel auth-frame-form">{children}</div>
    </section>
  );
}
