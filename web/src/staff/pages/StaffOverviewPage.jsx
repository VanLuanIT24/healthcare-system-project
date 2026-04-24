import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDefaultRouteForAuth, isSuperAdminSession } from '../../lib/authSession';
import { clearStoredAuth, readStoredAuth } from '../../lib/storage';

export function StaffOverviewPage() {
  const navigate = useNavigate();
  const auth = readStoredAuth();
  const user = auth?.user;

  const profileCards = useMemo(() => {
    return [
      { label: 'Tài khoản', value: user?.username || 'N/A' },
      { label: 'Họ tên', value: user?.full_name || 'N/A' },
      { label: 'Vai trò', value: (user?.roles || []).join(', ') || 'N/A' },
      { label: 'Trạng thái', value: user?.status || 'N/A' },
    ];
  }, [user]);

  useEffect(() => {
    if (isSuperAdminSession(auth)) {
      navigate(getDefaultRouteForAuth(auth), { replace: true });
    }
  }, [auth, navigate]);

  function handleLogout() {
    clearStoredAuth();
    navigate('/staff/login', { replace: true });
  }

  if (isSuperAdminSession(auth)) {
    return null;
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="admin-kicker">Staff Workspace</p>
          <h1>Tổng quan nhân sự</h1>
        </div>
        <div className="admin-topbar__actions">
          <Link to="/home">Trang chủ</Link>
          <button type="button" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <section className="admin-grid">
        {profileCards.map((item) => (
          <article key={item.label} className="admin-stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-panel-grid">
        <article className="admin-panel-card">
          <h2>Phiên làm việc hiện tại</h2>
          <p>
            Bạn đã đăng nhập thành công bằng tài khoản nhân sự. Giao diện chuyên sâu cho từng role có
            thể được mở rộng tiếp từ route này.
          </p>
        </article>

        <article className="admin-panel-card">
          <h2>Quyền hiện có</h2>
          <div className="admin-chip-list">
            {(user?.permissions || []).slice(0, 10).map((permission) => (
              <span key={permission}>{permission}</span>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
