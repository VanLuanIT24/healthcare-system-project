export default function StatusMessage({ type = 'info', children }) {
  if (!children) {
    return null;
  }

  return <div className={`status-message status-${type}`}>{children}</div>;
}
