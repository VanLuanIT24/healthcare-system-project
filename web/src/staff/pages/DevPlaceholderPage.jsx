import { ArrowLeft, Construction, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DevPlaceholderPage({ title, route, description }) {
  return (
    <main className="dev-placeholder-shell">
      <section className="dev-placeholder-card">
        <span className="dev-placeholder-icon" aria-hidden="true">
          <Construction size={34} strokeWidth={2.2} />
        </span>
        <div>
          <p>Dev route</p>
          <h1>{title}</h1>
          <code>{route}</code>
        </div>
        <p>
          {description ||
            'Màn hình này đã được gắn link để Super Admin có thể điều hướng trong quá trình phát triển. Nội dung nghiệp vụ sẽ được hoàn thiện sau.'}
        </p>
        <div className="dev-placeholder-actions">
          <Link to="/super-admin/access">
            <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
            Về cổng Super Admin
          </Link>
          <Link to="/scheduling/approvals">
            <ExternalLink size={16} strokeWidth={2.25} aria-hidden="true" />
            Mở dashboard duyệt lịch
          </Link>
        </div>
      </section>
    </main>
  );
}
