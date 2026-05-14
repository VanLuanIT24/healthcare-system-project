import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { useAuth } from './doctorAuth'
import { DoctorAppShell } from './DoctorShell'
import {
  DoctorAppointmentsScreen,
  DoctorEncountersScreen,
  DoctorPrescriptionsScreen,
  DoctorQueueScreen,
  DoctorSchedulesScreen,
} from './DoctorViews'
import { DoctorDashboardScreen } from './DoctorDashboardScreen'
import { DoctorEncounterDetailScreen, DoctorPatientDetailScreen, DoctorPatientsScreen } from './DoctorDetailViews'
import { DoctorOrderDetailScreen, DoctorOrdersScreen } from './DoctorOrderViews'
import { DoctorProfileScreen } from './DoctorProfileScreen'
import { ToastProvider } from './toast/ToastProvider'
import './doctor.css'

const routeMeta = [
  { match: '/doctor/dashboard', title: 'Tổng quan bác sĩ', subtitle: 'Chào mừng trở lại, chúc bạn một ngày làm việc hiệu quả!' },
  { match: '/doctor/queue', title: 'Quản lý hàng chờ', subtitle: 'Gọi, gọi lại và điều phối bệnh nhân vào khám.' },
  { match: '/doctor/appointments', title: 'Lịch hẹn bệnh nhân', subtitle: 'Xem lịch hẹn phía bác sĩ và trạng thái lượt khám.' },
  { match: '/doctor/schedules', title: 'Lịch làm việc', subtitle: 'Lịch làm việc và khung giờ của bác sĩ.' },
  { match: '/doctor/encounters', title: 'Không gian phiên khám', subtitle: 'Vòng đời encounter, tài liệu lâm sàng và order.' },
  { match: '/doctor/orders', title: 'Orders cua bac si', subtitle: 'Theo doi chi dinh can lam sang va tien do xu ly.' },
  { match: '/doctor/prescriptions', title: 'Đơn thuốc của tôi', subtitle: 'Theo dõi các đơn thuốc bác sĩ đã kê theo dữ liệu backend.' },
  { match: '/doctor/patients', title: 'Hồ sơ bệnh nhân', subtitle: 'Quản lý và theo dõi hồ sơ bệnh nhân nhanh chóng.' },
  { match: '/doctor/profile', title: 'Hồ sơ bác sĩ', subtitle: 'Quản lý thông tin cá nhân, bảo mật tài khoản và phiên làm việc.' },
]

export default function DoctorWorkspace() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const meta = useMemo(() => {
    const found = routeMeta.find((item) => location.pathname.startsWith(item.match))
    return found || routeMeta[0]
  }, [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/staff/login', { replace: true })
  }

  return (
    <ToastProvider>
      <DoctorAppShell
        title={meta.title}
        subtitle={meta.subtitle}
        searchPlaceholder="Tìm kiếm bệnh nhân, lịch hẹn, encounter..."
        user={user}
        onLogout={handleLogout}
        onNavigateHome={() => navigate('/')}
        compactTopbar={location.pathname === '/doctor/dashboard'}
        shellVariant={
          location.pathname === '/doctor/dashboard'
            ? 'dashboard'
            : location.pathname === '/doctor/encounters'
              ? 'encounters'
              : 'default'
        }
      >
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DoctorDashboardScreen user={user} />} />
          <Route path="queue" element={<DoctorQueueScreen user={user} />} />
          <Route path="appointments" element={<DoctorAppointmentsScreen user={user} />} />
          <Route path="schedules" element={<DoctorSchedulesScreen user={user} />} />
          <Route path="encounters" element={<DoctorEncountersScreen user={user} />} />
          <Route path="encounters/:encounterId" element={<DoctorEncounterDetailScreen user={user} />} />
          <Route path="orders" element={<DoctorOrdersScreen user={user} />} />
          <Route path="orders/:orderId" element={<DoctorOrderDetailScreen user={user} />} />
          <Route path="prescriptions" element={<DoctorPrescriptionsScreen user={user} />} />
          <Route path="patients" element={<DoctorPatientsScreen user={user} />} />
          <Route path="patients/:patientId" element={<DoctorPatientDetailScreen user={user} />} />
          <Route path="profile" element={<DoctorProfileScreen user={user} />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </DoctorAppShell>
    </ToastProvider>
  )
}
