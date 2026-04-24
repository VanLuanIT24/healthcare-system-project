import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { useAuth } from '../Home/context/AuthContext'
import { DoctorAppShell } from './DoctorShell'
import {
  DoctorAppointmentsScreen,
  DoctorDashboardScreen,
  DoctorEncountersScreen,
  DoctorQueueScreen,
  DoctorSchedulesScreen,
} from './DoctorViews'
import { DoctorEncounterDetailScreen, DoctorPatientDetailScreen, DoctorPatientsScreen } from './DoctorDetailViews'
import { DoctorProfileScreen } from './DoctorProfileScreen'
import './doctor.css'

const routeMeta = [
  { match: '/doctor/dashboard', title: 'Tổng quan lâm sàng', subtitle: 'Khối lượng công việc và luồng chăm sóc hôm nay của bác sĩ.' },
  { match: '/doctor/queue', title: 'Quản lý hàng chờ', subtitle: 'Gọi, gọi lại và điều phối bệnh nhân vào khám.' },
  { match: '/doctor/appointments', title: 'Lịch hẹn bệnh nhân', subtitle: 'Xem lịch hẹn phía bác sĩ và trạng thái lượt khám.' },
  { match: '/doctor/schedules', title: 'Lịch làm việc', subtitle: 'Lịch lâm sàng chỉ đọc và khả năng hiển thị khung giờ.' },
  { match: '/doctor/encounters', title: 'Không gian phiên khám', subtitle: 'Vòng đời phiên khám, tài liệu và y lệnh.' },
  { match: '/doctor/patients', title: 'Hồ sơ bệnh nhân', subtitle: 'Xem hồ sơ bệnh nhân chỉ đọc dành cho bác sĩ.' },
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
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <DoctorAppShell
      title={meta.title}
      subtitle={meta.subtitle}
      searchPlaceholder="Tìm bệnh nhân, hồ sơ hoặc phiên khám..."
      user={user}
      onLogout={handleLogout}
      onNavigateHome={() => navigate('/')}
    >
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DoctorDashboardScreen user={user} />} />
        <Route path="queue" element={<DoctorQueueScreen user={user} />} />
        <Route path="appointments" element={<DoctorAppointmentsScreen user={user} />} />
        <Route path="schedules" element={<DoctorSchedulesScreen user={user} />} />
        <Route path="encounters" element={<DoctorEncountersScreen user={user} />} />
        <Route path="encounters/:encounterId" element={<DoctorEncounterDetailScreen user={user} />} />
        <Route path="patients" element={<DoctorPatientsScreen user={user} />} />
        <Route path="patients/:patientId" element={<DoctorPatientDetailScreen user={user} />} />
        <Route path="profile" element={<DoctorProfileScreen user={user} />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </DoctorAppShell>
  )
}
