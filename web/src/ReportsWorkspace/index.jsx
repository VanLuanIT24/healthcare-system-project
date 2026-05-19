import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ReportsShell } from './ReportsShell';
import { flattenReportsMenu, getReportsPageMeta } from './reportsData';
import './reports.css';

const reportsRoutes = flattenReportsMenu().map((item) => ({
  ...item,
  routePath: item.to.replace('/reports/', ''),
}));

function ReportsTitleScreen({ item }) {
  const Icon = item.icon;

  return (
    <section className="reports-title-screen" aria-labelledby="reports-page-title">
      <div className="reports-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.2} />
      </div>
      <div>
        <span>{item.sectionLabel}</span>
        <h1 id="reports-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function ReportsFallbackScreen() {
  const location = useLocation();
  return <ReportsTitleScreen item={getReportsPageMeta(location.pathname)} />;
}

export default function ReportsWorkspace() {
  return (
    <ReportsShell>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        {reportsRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<ReportsTitleScreen item={item} />}
          />
        ))}
        <Route path="*" element={<ReportsFallbackScreen />} />
      </Routes>
    </ReportsShell>
  );
}
