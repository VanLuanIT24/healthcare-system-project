import {
  getScheduleStatusLabel,
  getScheduleTone,
  getSlotStatusLabel,
  getSlotTone,
  getUtilizationTone,
} from '../utils/schedulingUi';

export function SchedulingHero({ eyebrow, title, copy, actions }) {
  return (
    <section className="scheduling-hero">
      <div className="scheduling-hero__glow" aria-hidden="true" />
      <div className="scheduling-hero__content">
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {actions ? <div className="scheduling-hero__actions">{actions}</div> : null}
    </section>
  );
}

export function MetricCard({ label, value, delta, tone = 'blue', icon }) {
  return (
    <article className={`scheduling-metric scheduling-metric--${tone}`}>
      <div className="scheduling-metric__top">
        <span>{label}</span>
        <i aria-hidden="true">{icon || String(label || '').slice(0, 1)}</i>
      </div>
      <strong>{value}</strong>
      <small>{delta}</small>
    </article>
  );
}

export function StatusBadge({ children, type = 'schedule', value }) {
  const rawValue = value || children;
  const tone = type === 'slot' ? getSlotTone(rawValue) : getScheduleTone(rawValue);
  const label = type === 'slot' ? getSlotStatusLabel(rawValue) : getScheduleStatusLabel(rawValue);
  return <span className={`scheduling-badge scheduling-badge--${tone}`}>{label}</span>;
}

export function UtilizationBar({ value }) {
  const tone = getUtilizationTone(value);
  return (
    <div className="scheduling-util">
      <div className={`scheduling-util__bar scheduling-util__bar--${tone}`} style={{ width: `${Math.min(Number(value || 0), 100)}%` }} />
      <strong>{Math.round(Number(value || 0))}%</strong>
    </div>
  );
}

export function FilterBar({ children }) {
  return <section className="scheduling-filter-bar">{children}</section>;
}

export function EmptyState({ title, copy }) {
  return (
    <div className="scheduling-empty">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
