import { Component } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './doctorAuth'
import { DoctorAppShell } from './DoctorShell'
import { DoctorDashboardScreen } from './DoctorDashboardScreen'
import { DoctorEmptyScheduleScreen } from './DoctorEmptyScheduleScreen'
import { DoctorTodayScheduleScreen } from './DoctorTodayScheduleScreen'
import { DoctorWeekScheduleScreen } from './DoctorWeekScheduleScreen'
import { DoctorTodayAppointmentsScreen } from './DoctorTodayAppointmentsScreen'
import { DoctorUpcomingAppointmentsScreen } from './DoctorUpcomingAppointmentsScreen'
import { DoctorAllAppointmentsScreen } from './DoctorAllAppointmentsScreen'
import { DoctorScheduleDetailScreen } from './DoctorScheduleDetailScreen'
import { DoctorQueueBoardScreen } from './DoctorQueueBoardScreen'
import { DoctorQueueCallingScreen } from './DoctorQueueCallingScreen'
import { DoctorQueueHistoryScreen } from './DoctorQueueHistoryScreen'
import { DoctorTodayEncountersScreen } from './DoctorTodayEncountersScreen'
import { DoctorPatientListScreen } from './DoctorPatientListScreen'
import { DoctorRecentPatientsScreen } from './DoctorRecentPatientsScreen'
import { DoctorOrdersScreen } from './DoctorOrdersScreen'
import { DoctorMyPrescriptionsScreen } from './DoctorMyPrescriptionsScreen'
import { DoctorLabTestsScreen } from './DoctorLabTestsScreen'
import { DoctorImagingScreen } from './DoctorImagingScreen'
import { DoctorProcedureScreen } from './DoctorProcedureScreen'
import { DoctorPerformanceReportScreen } from './DoctorPerformanceReportScreen'
import { DoctorQueueReportScreen } from './DoctorQueueReportScreen'
import { DoctorDoctorReportScreen } from './DoctorDoctorReportScreen'
import { ToastProvider } from './ToastProvider'
import './doctor.css'
import './doctor-font.css'

const dashboardMeta = {
  title: 'Tổng quan bác sĩ',
  subtitle: 'Chào mừng trở lại, chúc bạn một ngày làm việc hiệu quả!',
}

const todayScheduleMeta = {
  title: 'Lịch làm việc hôm nay',
  subtitle: 'Theo dõi ca trực, slot khám và hiệu suất lịch trong ngày.',
}

const weekScheduleMeta = {
  title: 'Lịch làm việc tuần này',
  subtitle: 'Theo dõi ca trực, khung giờ khám và hiệu suất lịch làm việc trong tuần.',
}

const emptyScheduleMeta = {
  title: 'Lịch trống',
  subtitle: 'Quản lý các khung giờ trống và năng lực chưa được sử dụng.',
}

const todayAppointmentMeta = {
  title: 'Lịch hẹn hôm nay',
  subtitle: 'Quản lý và theo dõi danh sách lịch hẹn của bạn trong ngày hôm nay.',
}

const upcomingAppointmentMeta = {
  title: 'Lịch hẹn sắp tới',
  subtitle: 'Theo dõi các lịch hẹn sắp tới, xác nhận và chuẩn bị tiếp nhận bệnh nhân.',
}

const allAppointmentMeta = {
  title: 'Tất cả lịch hẹn',
  subtitle: 'Quản lý và theo dõi toàn bộ lịch hẹn theo thời gian thực, hỗ trợ xác nhận, check-in và xử lý lịch hẹn hiệu quả.',
}

const queueBoardMeta = {
  title: 'Bảng hàng đợi',
  subtitle: 'Quản lý hàng đợi bệnh nhân theo thời gian thực.',
}

const queueCallingMeta = {
  title: 'Gọi tiếp theo',
  subtitle: 'Gọi bệnh nhân tiếp theo và kiểm soát luồng hàng đợi hiệu quả.',
}

const queueHistoryMeta = {
  title: 'Lịch sử hàng đợi',
  subtitle: 'Xem lại lịch sử hoạt động của hàng đợi và các mốc xử lý.',
}

const encounterMeta = {
  today: {
    title: 'Phiên khám hôm nay',
    subtitle: 'Theo dõi các phiên khám trong ngày và trạng thái xử lý của từng bệnh nhân.',
  },
  active: {
    title: 'Phiên khám đang khám',
    subtitle: 'Quản lý các phiên khám đang hoạt động và cập nhật hồ sơ lâm sàng.',
  },
  completed: {
    title: 'Phiên khám đã hoàn tất',
    subtitle: 'Xem lại các phiên khám đã kết thúc và thông tin tổng kết điều trị.',
  },
}

const patientMeta = {
  list: {
    title: 'Danh sách bệnh nhân',
    subtitle: 'Tra cứu hồ sơ, lịch sử khám và thông tin liên hệ của bệnh nhân.',
  },
  recent: {
    title: 'Bệnh nhân gần đây',
    subtitle: 'Theo dõi các bệnh nhân vừa được tiếp nhận hoặc vừa có hoạt động lâm sàng.',
  },
}

const orderMeta = {
  list: {
    title: 'Đơn chỉ định',
    subtitle: 'Quản lý chỉ định xét nghiệm, chẩn đoán hình ảnh và thủ thuật.',
  },
  encounter: {
    title: 'Chỉ định theo encounter',
    subtitle: 'Theo dõi các chỉ định được tạo trong từng phiên khám.',
  },
  pending: {
    title: 'Chỉ định đang chờ xử lý',
    subtitle: 'Kiểm tra các chỉ định cần xác nhận, thực hiện hoặc theo dõi kết quả.',
  },
}

const prescriptionMeta = {
  list: {
    title: 'Đơn thuốc của tôi',
    subtitle: 'Quản lý đơn thuốc đã kê và theo dõi trạng thái xử lý thuốc.',
  },
  encounter: {
    title: 'Đơn thuốc theo encounter',
    subtitle: 'Xem đơn thuốc được kê trong từng phiên khám của bệnh nhân.',
  },
  active: {
    title: 'Đơn thuốc đang hoạt động',
    subtitle: 'Theo dõi các đơn thuốc còn hiệu lực và cảnh báo cần xử lý.',
  },
}

const clinicalMeta = {
  lab: {
    title: 'Xét nghiệm',
    subtitle: 'Theo dõi chỉ định xét nghiệm, kết quả mới và các mục cần xác nhận.',
  },
  imaging: {
    title: 'Chẩn đoán hình ảnh',
    subtitle: 'Quản lý kết quả hình ảnh, báo cáo mới và cảnh báo quan trọng.',
  },
  procedure: {
    title: 'Thủ thuật',
    subtitle: 'Theo dõi các thủ thuật được chỉ định và mức độ ưu tiên thực hiện.',
  },
}

const reportMeta = {
  performance: {
    title: 'Hiệu suất khám bệnh',
    subtitle: 'Phân tích hiệu suất khám, khối lượng công việc và xu hướng vận hành.',
  },
  queue: {
    title: 'Báo cáo hàng đợi',
    subtitle: 'Theo dõi thời gian chờ, tốc độ xử lý và chất lượng luồng tiếp nhận.',
  },
  doctor: {
    title: 'Báo cáo bác sĩ',
    subtitle: 'Tổng hợp dữ liệu hoạt động, hiệu suất và kết quả xử lý theo bác sĩ.',
  },
}

function getPageMeta(pathname, views = {}) {
  if (pathname.startsWith('/doctor/appointments')) {
    if (views.appointmentView === 'upcoming') return upcomingAppointmentMeta
    if (views.appointmentView === 'today') return todayAppointmentMeta
    return allAppointmentMeta
  }
  if (pathname.startsWith('/doctor/queue')) {
    if (views.queueView === 'calling') return queueCallingMeta
    if (views.queueView === 'history') return queueHistoryMeta
    return queueBoardMeta
  }
  if (pathname.startsWith('/doctor/encounters')) return encounterMeta[views.encounterView] || encounterMeta.today
  if (pathname.startsWith('/doctor/patients')) return patientMeta[views.patientView] || patientMeta.list
  if (pathname.startsWith('/doctor/orders')) return orderMeta[views.orderView] || orderMeta.list
  if (pathname.startsWith('/doctor/prescriptions')) return prescriptionMeta[views.prescriptionView] || prescriptionMeta.list
  if (pathname.startsWith('/doctor/clinical')) return clinicalMeta[views.clinicalView] || clinicalMeta.lab
  if (pathname.startsWith('/doctor/reports')) return reportMeta[views.reportView] || reportMeta.performance
  if (pathname.startsWith('/doctor/schedules/empty')) return emptyScheduleMeta
  if (pathname.startsWith('/doctor/schedules/week')) return weekScheduleMeta
  if (pathname.startsWith('/doctor/schedules')) return todayScheduleMeta
  return dashboardMeta
}

class ReportErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Doctor report screen crashed', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="doctor-performance-page">
          <div className="doctor-performance-error">
            Không thể hiển thị báo cáo lúc này. Dữ liệu backend trả về chưa đúng định dạng hoặc thiếu trường bắt buộc.
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function DoctorReportRoute({ view, user }) {
  const screen = view === 'doctor'
    ? <DoctorDoctorReportScreen user={user} />
    : view === 'queue'
      ? <DoctorQueueReportScreen user={user} />
      : <DoctorPerformanceReportScreen user={user} />

  return (
    <ReportErrorBoundary key={view}>
      {screen}
    </ReportErrorBoundary>
  )
}

export default function DoctorWorkspace() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const appointmentView = location.pathname.startsWith('/doctor/appointments') ? searchParams.get('view') : ''
  const queueView = location.pathname.startsWith('/doctor/queue') ? searchParams.get('view') : ''
  const encounterView = location.pathname.startsWith('/doctor/encounters') ? searchParams.get('view') || 'today' : ''
  const patientView = location.pathname.startsWith('/doctor/patients') ? searchParams.get('view') || 'list' : ''
  const orderView = location.pathname.startsWith('/doctor/orders') ? searchParams.get('view') || 'list' : ''
  const prescriptionView = location.pathname.startsWith('/doctor/prescriptions') ? searchParams.get('view') || 'list' : ''
  const clinicalView = location.pathname.startsWith('/doctor/clinical') ? searchParams.get('view') || 'lab' : ''
  const reportView = location.pathname.startsWith('/doctor/reports') ? searchParams.get('view') || 'performance' : ''
  const isUpcomingAppointments = appointmentView === 'upcoming'
  const isTodayAppointments = appointmentView === 'today'
  const isQueueCalling = queueView === 'calling'
  const isQueueHistory = queueView === 'history'
  const meta = getPageMeta(location.pathname, {
    appointmentView,
    queueView,
    encounterView,
    patientView,
    orderView,
    prescriptionView,
    clinicalView,
    reportView,
  })

  async function handleLogout() {
    await logout()
    navigate('/staff/login', { replace: true })
  }

  return (
    <div className="doctor-workspace-font-root">
      <ToastProvider>
        <DoctorAppShell
          title={meta.title}
          subtitle={meta.subtitle}
          searchPlaceholder="Tìm kiếm bệnh nhân, lịch hẹn, encounter..."
          user={user}
          onLogout={handleLogout}
          onNavigateHome={() => navigate('/home')}
          compactTopbar
          shellVariant="dashboard"
        >
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DoctorDashboardScreen user={user} />} />
            <Route path="schedules" element={<Navigate to="today" replace />} />
            <Route path="schedules/today" element={<DoctorTodayScheduleScreen user={user} />} />
            <Route path="schedules/week" element={<DoctorWeekScheduleScreen user={user} />} />
            <Route path="schedules/empty" element={<DoctorEmptyScheduleScreen user={user} />} />
            <Route path="schedules/:scheduleId" element={<DoctorScheduleDetailScreen user={user} />} />
            <Route path="appointments" element={isUpcomingAppointments ? <DoctorUpcomingAppointmentsScreen user={user} /> : isTodayAppointments ? <DoctorTodayAppointmentsScreen user={user} /> : <DoctorAllAppointmentsScreen user={user} />} />
            <Route path="queue" element={isQueueHistory ? <DoctorQueueHistoryScreen user={user} /> : isQueueCalling ? <DoctorQueueCallingScreen user={user} /> : <DoctorQueueBoardScreen user={user} />} />
            <Route path="encounters" element={<DoctorTodayEncountersScreen user={user} view={encounterView} />} />
            <Route path="encounters/:encounterId" element={<DoctorTodayEncountersScreen user={user} view="active" />} />
            <Route path="patients" element={patientView === 'recent' ? <DoctorRecentPatientsScreen user={user} /> : <DoctorPatientListScreen user={user} />} />
            <Route path="patients/:patientId" element={<DoctorPatientListScreen user={user} />} />
            <Route path="orders" element={<DoctorOrdersScreen user={user} />} />
            <Route path="orders/:orderId" element={<DoctorOrdersScreen user={user} />} />
            <Route path="prescriptions" element={<DoctorMyPrescriptionsScreen user={user} />} />
            <Route path="clinical" element={clinicalView === 'procedure' ? <DoctorProcedureScreen user={user} /> : clinicalView === 'imaging' ? <DoctorImagingScreen user={user} /> : <DoctorLabTestsScreen user={user} />} />
            <Route path="reports" element={<DoctorReportRoute view={reportView} user={user} />} />
            <Route path="profile" element={<Navigate to="dashboard?panel=profile" replace />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </DoctorAppShell>
      </ToastProvider>
    </div>
  )
}
