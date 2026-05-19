import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PharmacyShell } from './PharmacyShell';
import {
  flattenPharmacyMenu,
  getPharmacyPageMeta,
} from './pharmacyData';
import './pharmacy.css';

const pharmacyRoutes = flattenPharmacyMenu().map((item) => ({
  ...item,
  routePath: item.to.replace('/pharmacy/', ''),
}));

function PharmacyTitleScreen({ item }) {
  const Icon = item.icon;
  const groupLabel = item.groupLabel || 'Nhà thuốc và kho dược';

  return (
    <section className="pharmacy-title-screen" aria-labelledby="pharmacy-page-title">
      <div className="pharmacy-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.25} />
      </div>
      <div>
        <span>{groupLabel}</span>
        <h1 id="pharmacy-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function PharmacyFallbackScreen() {
  const location = useLocation();
  const item = getPharmacyPageMeta(location.pathname);
  return <PharmacyTitleScreen item={item} />;
}

export default function PharmacyWorkspace() {
  return (
    <PharmacyShell>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="dashboard" element={<Navigate to="/pharmacy/overview" replace />} />
        {pharmacyRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<PharmacyTitleScreen item={item} />}
          />
        ))}
        <Route path="*" element={<PharmacyFallbackScreen />} />
      </Routes>
    </PharmacyShell>
  );
}
