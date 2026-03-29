import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import StatusMessage from '../components/StatusMessage';

export default function AuditLogsPage() {
  const { session } = useAuth();
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadLogs() {
    setLoading(true);
    setError('');

    try {
      const response = await api.getAuditLogs({}, session?.accessToken);
      setLogs(response.data.items);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.accessToken) {
      loadLogs();
    }
  }, [session?.accessToken]);

  return (
    <section className="dashboard-page">
      <div className="page-headline">
        <span className="eyebrow">Security Visibility</span>
        <h1>Audit logs</h1>
        <p>Nhật ký của các hành động bảo mật quan trọng như đăng nhập, logout, reset password và thay đổi tài khoản.</p>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>

      <div className="glass-card">
        <div className="section-header-inline">
          <h2>Lịch sử bảo mật</h2>
          <button className="button secondary-button" type="button" onClick={loadLogs}>
            Tải lại
          </button>
        </div>

        {loading ? (
          <div className="auth-loading">Đang tải audit logs...</div>
        ) : (
          <div className="audit-list">
            {logs.map((log) => (
              <article key={log._id} className="audit-item">
                <div className="audit-item-head">
                  <strong>{log.action}</strong>
                  <span className={`tag ${log.status === 'success' ? 'success-tag' : 'danger-tag'}`}>{log.status}</span>
                </div>
                <p>{log.message}</p>
                <small>
                  {new Date(log.created_at).toLocaleString('vi-VN')} | actor: {log.actor_type} | target: {log.target_type || 'n/a'}
                </small>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
