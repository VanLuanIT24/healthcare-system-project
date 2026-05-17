import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PharmacyShell } from './PharmacyShell';
import {
  flattenPharmacyMenu,
  getPharmacyPageMeta,
} from './pharmacyData';
import { PharmacyOverview } from './PharmacyOverview';
import {
  DispenseCreateScreen,
  DispenseQueueScreen,
  PrescriptionDetailScreen,
  PrescriptionListScreen,
} from './PharmacyPrescriptionViews';
import './pharmacy.css';

const featureRoutes = flattenPharmacyMenu()
  .filter((item) => item.to !== '/pharmacy/overview')
  .map((item) => ({
    ...item,
    routePath: item.to.replace('/pharmacy/', ''),
  }));

function PharmacyFeatureScreen({ item }) {
  const Icon = item.icon;
  const groupLabel = item.groupLabel || 'Pharmacy Workspace';

  return (
    <div className="pharmacy-page">
      <section className="pharmacy-feature-head">
        <span aria-hidden="true">
          <Icon size={24} strokeWidth={2.25} />
        </span>
        <div>
          <small>{groupLabel}</small>
          <h1>{item.label}</h1>
          <p>{item.hint || 'Màn hình nghiệp vụ trong dashboard nhà thuốc.'}</p>
        </div>
      </section>

      <section className="pharmacy-panel pharmacy-feature-panel">
        <header>
          <div>
            <span>Workspace</span>
            <h2>{item.label}</h2>
          </div>
          {item.badge ? <strong>{item.badge} mục</strong> : <strong>Sẵn sàng</strong>}
        </header>
        <div className="pharmacy-feature-empty">
          <p>Chưa có dữ liệu hiển thị trong phiên hiện tại. Các bản ghi mới sẽ xuất hiện khi module nghiệp vụ được kết nối dữ liệu.</p>
        </div>
      </section>
    </div>
  );
}

function PharmacyFallbackScreen() {
  const location = useLocation();
  const item = getPharmacyPageMeta(location.pathname);
  return <PharmacyFeatureScreen item={item} />;
}

export default function PharmacyWorkspace() {
  return (
    <PharmacyShell>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="dashboard" element={<Navigate to="/pharmacy/overview" replace />} />
        <Route path="overview" element={<PharmacyOverview />} />
        <Route path="prescriptions" element={<PrescriptionListScreen mode="all" />} />
        <Route path="prescriptions/pending-verification" element={<PrescriptionListScreen mode="pending" />} />
        <Route path="prescriptions/verify" element={<Navigate to="/pharmacy/prescriptions/pending-verification" replace />} />
        <Route path="prescriptions/ready-to-dispense" element={<PrescriptionListScreen mode="ready" />} />
        <Route path="prescriptions/ready" element={<Navigate to="/pharmacy/prescriptions/ready-to-dispense" replace />} />
        <Route path="prescriptions/dispensed" element={<PrescriptionListScreen mode="dispensed" />} />
        <Route path="prescriptions/cancelled" element={<PrescriptionListScreen mode="cancelled" />} />
        <Route path="prescriptions/:prescriptionId" element={<PrescriptionDetailScreen />} />
        <Route path="dispensing/queue" element={<DispenseQueueScreen mode="queue" />} />
        <Route path="dispensing/create" element={<DispenseCreateScreen />} />
        <Route path="dispensing/completed" element={<DispenseQueueScreen mode="completed" />} />
        {featureRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<PharmacyFeatureScreen item={item} />}
          />
        ))}
        <Route path="*" element={<PharmacyFallbackScreen />} />
      </Routes>
    </PharmacyShell>
  );
}
