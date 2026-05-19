import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BillingShell } from './BillingShell';
import { flattenBillingMenu, getBillingPageMeta } from './billingData';
import './billing.css';

const billingRoutes = flattenBillingMenu().map((item) => ({
  ...item,
  routePath: item.to.replace('/billing/', ''),
}));

function BillingTitleScreen({ item }) {
  const Icon = item.icon;

  return (
    <section className="billing-title-screen" aria-labelledby="billing-page-title">
      <div className="billing-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.2} />
      </div>
      <div>
        <span>{item.sectionLabel}</span>
        <h1 id="billing-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function BillingFallbackScreen() {
  const location = useLocation();
  return <BillingTitleScreen item={getBillingPageMeta(location.pathname)} />;
}

export default function BillingWorkspace() {
  return (
    <BillingShell>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        {billingRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<BillingTitleScreen item={item} />}
          />
        ))}
        <Route path="*" element={<BillingFallbackScreen />} />
      </Routes>
    </BillingShell>
  );
}
