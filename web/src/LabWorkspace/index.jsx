import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LabShell } from './LabShell';
import { flattenLabMenu, getLabPageMeta } from './labData';
import './lab.css';

const labRoutes = flattenLabMenu().map((item) => ({
  ...item,
  routePath: item.to.replace('/lab/', ''),
}));

function LabTitleScreen({ item }) {
  const Icon = item.icon;

  return (
    <section className="lab-title-screen" aria-labelledby="lab-page-title">
      <div className="lab-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.2} />
      </div>
      <div>
        <span>{item.sectionLabel}</span>
        <h1 id="lab-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function LabFallbackScreen() {
  const location = useLocation();
  return <LabTitleScreen item={getLabPageMeta(location.pathname)} />;
}

export default function LabWorkspace() {
  return (
    <LabShell>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        {labRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<LabTitleScreen item={item} />}
          />
        ))}
        <Route path="*" element={<LabFallbackScreen />} />
      </Routes>
    </LabShell>
  );
}
