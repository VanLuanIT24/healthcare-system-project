import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AccountPage } from './pages/AccountPage';
import { AboutPage } from './pages/AboutPage';
import { AdminStaffPage } from './pages/AdminStaffPage';
import { BookingGuidePage } from './pages/BookingGuidePage';
import { ContactPage } from './pages/ContactPage';
import { DoctorDetailPage } from './pages/DoctorDetailPage';
import { DoctorsPage } from './pages/DoctorsPage';
import { FaqPage } from './pages/FaqPage';
import { HomePage } from './pages/HomePage';
import { NewsArticlePage } from './pages/NewsArticlePage';
import { NewsPage } from './pages/NewsPage';
import { LogoutPage } from './pages/LogoutPage';
import { PatientLoginPage } from './pages/PatientLoginPage';
import { PatientRegisterPage } from './pages/PatientRegisterPage';
import { ServiceDetailPage } from './pages/ServiceDetailPage';
import { ServicesPage } from './pages/ServicesPage';
import { StaffLoginPage } from './pages/StaffLoginPage';
import { SpecialtiesPage } from './pages/SpecialtiesPage';
import { SpecialtyDetailPage } from './pages/SpecialtyDetailPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/dang-nhap-nhan-su" element={<StaffLoginPage />} />
        <Route path="/dang-nhap-benh-nhan" element={<PatientLoginPage />} />
        <Route path="/dang-ky-benh-nhan" element={<PatientRegisterPage />} />
        <Route path="/dang-xuat" element={<LogoutPage />} />
        <Route path="/khong-co-quyen" element={<UnauthorizedPage />} />
        <Route path="/gioi-thieu" element={<AboutPage />} />
        <Route path="/chuyen-khoa" element={<SpecialtiesPage />} />
        <Route path="/chuyen-khoa/:slug" element={<SpecialtyDetailPage />} />
        <Route path="/bac-si" element={<DoctorsPage />} />
        <Route path="/bac-si/:slug" element={<DoctorDetailPage />} />
        <Route path="/dich-vu" element={<ServicesPage />} />
        <Route path="/dich-vu/:slug" element={<ServiceDetailPage />} />
        <Route path="/huong-dan-dat-lich" element={<BookingGuidePage />} />
        <Route path="/lien-he" element={<ContactPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/tin-tuc" element={<NewsPage />} />
        <Route path="/tin-tuc/:slug" element={<NewsArticlePage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/tai-khoan" element={<AccountPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['super_admin', 'admin']} />}>
          <Route path="/quan-tri/tai-khoan-nhan-su" element={<AdminStaffPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
