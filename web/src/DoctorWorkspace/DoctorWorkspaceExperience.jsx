import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  FileText,
  HeartPulse,
  Home,
  Hospital,
  Inbox,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Pill,
  PlusCircle,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { AppLogo, APP_BRAND_NAME } from '../app/AppLogo'
import { doctorWorkspaceAPI, getApiErrorMessage, unwrapData } from '../utils/api'
import './doctor-workspace-v2.css'

const EMPTY_OVERVIEW = {
  doctor: null,
  kpis: {},
  queue: [],
  appointments: [],
  active_encounters: [],
  orders: [],
  prescriptions: [],
  results: [],
  critical_results: [],
  tasks: [],
  notifications: [],
  workflow: [],
}

const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Tổng quan bác sĩ',
    icon: Home,
    items: [
      { key: 'dashboard', label: 'Dashboard của tôi', path: '/doctor/dashboard', description: 'Clinical command center cá nhân cho toàn bộ ca làm việc.' },
      { key: 'waiting-for-me', label: 'Bệnh nhân đang chờ tôi', path: '/doctor/queue?view=waiting', description: 'Queue khám theo readiness, ưu tiên và thời gian chờ.' },
      { key: 'today-schedule', label: 'Lịch khám hôm nay', path: '/doctor/schedules/today', description: 'Timeline lịch hẹn, check-in, no-show và encounter liên quan.' },
      { key: 'open-encounters', label: 'Encounter đang mở', path: '/doctor/encounters?view=active', description: 'Các encounter cần tiếp tục hoặc hoàn tất.' },
      { key: 'new-results', label: 'Kết quả mới', path: '/doctor/results?view=new', description: 'Kết quả vừa release, critical và chưa đọc.' },
      { key: 'pending-work', label: 'Việc cần hoàn tất', path: '/doctor/dashboard?panel=tasks', description: 'Task inbox lâm sàng: note, diagnosis, critical, refill, order.' },
    ],
  },
  {
    id: 'patients',
    label: 'Bệnh nhân của tôi',
    icon: UsersRound,
    items: [
      { key: 'patients-waiting', label: 'Bệnh nhân chờ khám', path: '/doctor/patients?view=waiting', description: 'Bệnh nhân sẵn sàng khám hoặc còn thiếu điều kiện lâm sàng.' },
      { key: 'patients-in-care', label: 'Bệnh nhân đang khám', path: '/doctor/patients?view=in-care', description: 'Encounter active theo giai đoạn hỏi bệnh, khám, order, kê đơn.' },
      { key: 'patients-seen-today', label: 'Bệnh nhân đã khám hôm nay', path: '/doctor/patients?view=seen-today', description: 'Review, in giấy tờ, release hồ sơ và hẹn tái khám.' },
      { key: 'follow-up-due', label: 'Follow-up đến hạn', path: '/doctor/patients?view=follow-up', description: 'Tái khám, refill, kết quả cần xem lại và bệnh mạn.' },
      { key: 'patient-history', label: 'Lịch sử bệnh nhân', path: '/doctor/patients?view=history', description: 'Timeline dọc theo encounter, diagnosis, order, result, prescription.' },
    ],
  },
  {
    id: 'encounter',
    label: 'Encounter',
    icon: Stethoscope,
    items: [
      { key: 'encounter-active', label: 'Encounter đang mở', path: '/doctor/encounters?view=active', description: 'Danh sách encounter chưa hoàn tất kèm completion checklist.' },
      { key: 'encounter-start', label: 'Tạo / bắt đầu encounter', path: '/doctor/encounters?view=start', description: 'Bắt đầu khám từ queue, appointment hoặc bệnh nhân được chọn.' },
      { key: 'clinical-note', label: 'Clinical note', path: '/doctor/encounters?view=note', description: 'SOAP note, autosave, ký note, insert sinh hiệu và kết quả.' },
      { key: 'diagnosis', label: 'Chẩn đoán', path: '/doctor/encounters?view=diagnosis', description: 'Chẩn đoán chính/phụ, ICD, chẩn đoán phân biệt và đã loại trừ.' },
      { key: 'problem-list', label: 'Problem list', path: '/doctor/encounters?view=problem-list', description: 'Vấn đề dài hạn, bệnh mạn, resolved và risk factors.' },
      { key: 'care-plan', label: 'Care plan', path: '/doctor/encounters?view=care-plan', description: 'Điều trị, theo dõi, dặn dò, tái khám và giáo dục bệnh nhân.' },
      { key: 'consultation', label: 'Consultation', path: '/doctor/encounters?view=consultation', description: 'Yêu cầu hội chẩn, trao đổi, recommendation và chèn vào note.' },
      { key: 'complete-encounter', label: 'Hoàn tất encounter', path: '/doctor/encounters?view=complete', description: 'Pre-submit review trước khi ký và kết thúc encounter.' },
    ],
  },
  {
    id: 'clinical-records',
    label: 'Hồ sơ lâm sàng',
    icon: HeartPulse,
    items: [
      { key: 'patient-summary', label: 'Tóm tắt bệnh nhân', path: '/doctor/clinical-records?view=summary', description: 'Một phút hiểu bệnh nhân: dị ứng, vấn đề, thuốc, vitals, kết quả.' },
      { key: 'history-allergy', label: 'Tiền sử / dị ứng', path: '/doctor/clinical-records?view=history-allergy', description: 'Tiền sử, dị ứng, thuốc đang dùng, tiêm chủng và audit.' },
      { key: 'vitals', label: 'Sinh hiệu', path: '/doctor/clinical-records?view=vitals', description: 'Sinh hiệu mới nhất, trend chart và yêu cầu đo lại.' },
      { key: 'medical-records', label: 'Hồ sơ bệnh án', path: '/doctor/clinical-records?view=medical-records', description: 'Encounter, admission, diagnosis, procedure, prescription, document history.' },
      { key: 'attachments', label: 'Tài liệu đính kèm', path: '/doctor/clinical-records?view=attachments', description: 'PDF, ảnh, external record, consent, referral letter và access log.' },
      { key: 'consent-access', label: 'Consent / access nếu cần', path: '/doctor/clinical-records?view=consent-access', description: 'Consent, access request, sensitive record và break-glass.' },
      { key: 'released-records', label: 'Hồ sơ đã release', path: '/doctor/clinical-records?view=released', description: 'Tài liệu đã release, kênh release, bệnh nhân đã xem và thu hồi.' },
    ],
  },
  {
    id: 'orders',
    label: 'Chỉ định',
    icon: ClipboardList,
    items: [
      { key: 'create-order', label: 'Tạo chỉ định', path: '/doctor/orders?view=create', description: 'Order cart nhanh cho xét nghiệm, CĐHA, thủ thuật và order set.' },
      { key: 'all-orders', label: 'Tất cả order', path: '/doctor/orders?view=all', description: 'Toàn bộ order theo status, result, charge và priority.' },
      { key: 'lab-orders', label: 'Chỉ định xét nghiệm', path: '/doctor/orders?view=lab', description: 'Specimen, collection, processing, result và turnaround time.' },
      { key: 'imaging-orders', label: 'Chỉ định CĐHA', path: '/doctor/orders?view=imaging', description: 'Modality, body part, contrast, schedule, report và image viewer.' },
      { key: 'procedure-orders', label: 'Chỉ định thủ thuật', path: '/doctor/orders?view=procedure', description: 'Consent, preparation checklist, performer, result và complication.' },
      { key: 'pending-orders', label: 'Order đang chờ', path: '/doctor/orders?view=pending', description: 'Lý do chờ: thanh toán, lấy mẫu, consent, lịch CĐHA, thực hiện.' },
      { key: 'completed-orders', label: 'Order đã hoàn tất', path: '/doctor/orders?view=completed', description: 'Review kết quả, copy order, follow-up và release nếu được phép.' },
    ],
  },
  {
    id: 'results',
    label: 'Kết quả',
    icon: Inbox,
    items: [
      { key: 'lab-results', label: 'Kết quả xét nghiệm', path: '/doctor/results?view=lab', description: 'Analyte, value, reference range, abnormal flag và trend.' },
      { key: 'imaging-results', label: 'Kết quả CĐHA', path: '/doctor/results?view=imaging', description: 'Findings, impression, recommendation và prior comparison.' },
      { key: 'procedure-results', label: 'Kết quả thủ thuật', path: '/doctor/results?view=procedure', description: 'Procedure note, findings, complication và post-procedure plan.' },
      { key: 'critical-results', label: 'Critical results', path: '/doctor/results?view=critical', description: 'Critical chưa xử lý, quá SLA, acknowledge và action note.' },
      { key: 'unread-results', label: 'Kết quả chưa đọc', path: '/doctor/results?view=unread', description: 'Inbox kết quả chưa mở, lọc critical và mark read.' },
      { key: 'read-results', label: 'Kết quả đã đọc', path: '/doctor/results?view=read', description: 'Audit đọc kết quả và hành động đã thực hiện.' },
    ],
  },
  {
    id: 'prescriptions',
    label: 'Đơn thuốc',
    icon: Pill,
    items: [
      { key: 'create-prescription', label: 'Kê đơn', path: '/doctor/prescriptions?view=create', description: 'Prescription cart, safety check, allergy và interaction warning.' },
      { key: 'draft-prescriptions', label: 'Đơn thuốc draft', path: '/doctor/prescriptions?view=draft', description: 'Draft cần ký, cảnh báo an toàn và cập nhật lần cuối.' },
      { key: 'signed-prescriptions', label: 'Đơn thuốc đã ký', path: '/doctor/prescriptions?view=signed', description: 'Đơn đã ký, in đơn, gửi nhà thuốc và hủy theo quy trình.' },
      { key: 'refill-request', label: 'Refill request', path: '/doctor/prescriptions?view=refill', description: 'Duyệt refill, từ chối, yêu cầu tái khám hoặc chỉnh số lượng.' },
      { key: 'dispense-status', label: 'Trạng thái cấp phát', path: '/doctor/prescriptions?view=dispense', description: 'Dược sĩ duyệt, thiếu thuốc, cấp phát một phần hoặc cần chỉnh đơn.' },
      { key: 'prescription-history', label: 'Lịch sử đơn thuốc', path: '/doctor/prescriptions?view=history', description: 'Timeline thuốc theo bệnh nhân, diagnosis, refill và adverse reaction.' },
    ],
  },
  {
    id: 'inpatient-emergency',
    label: 'Nội trú / cấp cứu nếu có quyền',
    icon: Hospital,
    permissionPrefix: ['inpatient_', 'emergency.', 'ward_board.'],
    items: [
      { key: 'inpatient-my-patients', label: 'Bệnh nhân nội trú của tôi', path: '/doctor/inpatient?view=my-patients', description: 'Ward board, bed, severity, active orders và discharge readiness.' },
      { key: 'inpatient-task', label: 'Inpatient task', path: '/doctor/inpatient?view=tasks', description: 'Review vitals, lab, medication, discharge summary và nurse request.' },
      { key: 'medication-administration', label: 'Medication administration', path: '/doctor/inpatient?view=mar', description: 'MAR timeline, missed dose, PRN, reaction và điều chỉnh y lệnh.' },
      { key: 'emergency-cases', label: 'Ca khẩn liên quan', path: '/doctor/inpatient?view=emergency', description: 'Emergency consult, STAT order, code response và emergency note.' },
    ],
  },
  {
    id: 'documents-forms',
    label: 'Tài liệu / biểu mẫu',
    icon: FileText,
    items: [
      { key: 'follow-up-letter', label: 'Giấy hẹn tái khám', path: '/doctor/documents?view=follow-up-letter', description: 'Lý do tái khám, ngày đề xuất, dặn dò và gửi portal.' },
      { key: 'certificate', label: 'Giấy chứng nhận', path: '/doctor/documents?view=certificate', description: 'Xác nhận khám, nghỉ ốm, sức khỏe, điều trị và ký điện tử.' },
      { key: 'visit-summary', label: 'Tóm tắt khám', path: '/doctor/documents?view=visit-summary', description: 'Visit summary tự sinh từ encounter, patient-friendly và clinical version.' },
      { key: 'export-records', label: 'Xuất hồ sơ', path: '/doctor/documents?view=export', description: 'Xuất PDF/ZIP theo encounter, khoảng ngày hoặc loại tài liệu.' },
      { key: 'release-patient', label: 'Release cho bệnh nhân', path: '/doctor/documents?view=release', description: 'Chọn tài liệu, kiểm tra quyền release, gửi thông báo và thu hồi.' },
    ],
  },
  {
    id: 'communication',
    label: 'Trao đổi',
    icon: MessageSquare,
    items: [
      { key: 'messages', label: 'Tin nhắn', path: '/doctor/communication?view=messages', description: 'Inbox theo nhân viên, bệnh nhân, encounter và attachment.' },
      { key: 'consultation-inbox', label: 'Hội chẩn', path: '/doctor/communication?view=consultation', description: 'Tôi yêu cầu, tôi được mời, đang chờ phản hồi và khẩn cấp.' },
      { key: 'clinical-support', label: 'Support clinical', path: '/doctor/communication?view=support', description: 'Ticket hỗ trợ quy trình, dược, cận lâm sàng, bảo hiểm, hồ sơ.' },
      { key: 'send-notification', label: 'Gửi thông báo', path: '/doctor/communication?view=send-notification', description: 'Thông báo cho bệnh nhân, điều dưỡng, dược sĩ, lab, imaging.' },
    ],
  },
]

const GROUP_MODES = {
  overview: {
    label: 'Command center',
    focus: ['Tôi cần khám ai tiếp theo?', 'Encounter nào còn thiếu dữ liệu?', 'Critical result nào cần xử lý ngay?'],
    primaryActions: ['Gọi bệnh nhân tiếp theo', 'Bắt đầu encounter', 'Tạo chỉ định', 'Kê đơn'],
  },
  patients: {
    label: 'Patient flow',
    focus: ['Clinical readiness', 'Queue status', 'Follow-up đến hạn'],
    primaryActions: ['Bắt đầu khám', 'Xem tóm tắt', 'Tạo follow-up', 'Mở lịch sử'],
  },
  encounter: {
    label: 'Encounter workspace',
    focus: ['Clinical note', 'Diagnosis', 'Order/result', 'Prescription', 'Completion checklist'],
    primaryActions: ['Ghi note', 'Thêm chẩn đoán', 'Tạo order', 'Hoàn tất encounter'],
  },
  'clinical-records': {
    label: 'Clinical record',
    focus: ['Dị ứng và cảnh báo', 'Sinh hiệu mới nhất', 'Hồ sơ bệnh án', 'Consent/access'],
    primaryActions: ['Chèn vào note', 'Yêu cầu đo lại', 'Release hồ sơ', 'Export'],
  },
  orders: {
    label: 'Order center',
    focus: ['Order cart', 'Duplicate warning', 'Charge/result status', 'Turnaround time'],
    primaryActions: ['Tạo chỉ định', 'Order set', 'Hủy order', 'Xem kết quả'],
  },
  results: {
    label: 'Result inbox',
    focus: ['Critical result', 'Unread result', 'Trend', 'Acknowledge action note'],
    primaryActions: ['Acknowledge', 'Add to note', 'Tạo order follow-up', 'Notify patient'],
  },
  prescriptions: {
    label: 'ePrescription',
    focus: ['Allergy', 'Interaction', 'Draft/sign', 'Dispense status'],
    primaryActions: ['Kê đơn', 'Safety check', 'Ký đơn', 'Gửi nhà thuốc'],
  },
  'inpatient-emergency': {
    label: 'Inpatient / emergency',
    focus: ['Ward board', 'MAR', 'STAT order', 'Emergency consult'],
    primaryActions: ['Mở inpatient chart', 'Điều chỉnh y lệnh', 'Gửi task điều dưỡng', 'Nhận ca khẩn'],
  },
  'documents-forms': {
    label: 'Document studio',
    focus: ['Template', 'Auto-fill encounter', 'Preview', 'Sign/release'],
    primaryActions: ['Tạo giấy hẹn', 'Tạo tóm tắt khám', 'Ký tài liệu', 'Release portal'],
  },
  communication: {
    label: 'Clinical collaboration',
    focus: ['Message context', 'Consultation', 'Support ticket', 'Outbox'],
    primaryActions: ['Gửi tin nhắn', 'Tạo hội chẩn', 'Tạo ticket', 'Gửi thông báo'],
  },
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function formatTime(value) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatDateTime(value) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function routeSignature(location) {
  if (!location.pathname || location.pathname === '/doctor' || location.pathname === '/doctor/') return '/doctor/dashboard'
  const params = new URLSearchParams(location.search)
  const view = params.get('view')
  const panel = params.get('panel')
  if (view) return `${location.pathname}?view=${view}`
  if (panel) return `${location.pathname}?panel=${panel}`
  return location.pathname
}

function getUserPermissions(user) {
  return [
    ...(user?.permissions || []),
    ...(user?.permission_codes || []),
    ...(user?.roles || []).map((role) => String(role || '')),
  ].map((value) => String(value || '').toLowerCase())
}

function hasPermissionPrefix(user, prefixes = []) {
  if (!prefixes.length) return true
  const permissions = getUserPermissions(user)
  return prefixes.some((prefix) => permissions.some((permission) => permission.startsWith(prefix)))
}

function filterGroupsForUser(user) {
  return NAV_GROUPS.filter((group) => hasPermissionPrefix(user, group.permissionPrefix))
}

function findActiveNavigation(location, groups) {
  const signature = routeSignature(location)
  for (const group of groups) {
    const item = group.items.find((entry) => signature === entry.path || signature.startsWith(`${entry.path}&`))
    if (item) return { group, item }
  }
  return { group: groups[0], item: groups[0]?.items[0] }
}

function getInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'BS'
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase()
}

function patientLabel(patient) {
  if (!patient) return 'Chưa chọn bệnh nhân'
  return [patient.full_name, patient.gender, patient.age ? `${patient.age} tuổi` : null, patient.patient_code].filter(Boolean).join(' · ')
}

function statusLabel(status) {
  const labels = {
    waiting: 'Chờ khám',
    called: 'Đã gọi',
    recalled: 'Gọi lại',
    in_service: 'Đang khám',
    planned: 'Dự kiến',
    arrived: 'Đã đến',
    in_progress: 'Đang khám',
    on_hold: 'Tạm dừng',
    completed: 'Hoàn tất',
    draft: 'Draft',
    active: 'Hoạt động',
    verified: 'Đã duyệt',
    partially_dispensed: 'Cấp phát một phần',
    final: 'Final',
    amended: 'Amended',
  }
  return labels[status] || status || 'Chưa rõ'
}

function statusTone(status, priority) {
  if (priority === 'critical' || status === 'critical') return 'critical'
  if (['urgent', 'stat', 'high'].includes(priority) || ['on_hold', 'draft'].includes(status)) return 'warning'
  if (['completed', 'final', 'verified', 'active'].includes(status)) return 'success'
  return 'neutral'
}

function getActivePatient(overview) {
  return (
    safeArray(overview.active_encounters)[0]?.patient ||
    safeArray(overview.queue)[0]?.patient ||
    safeArray(overview.appointments)[0]?.patient ||
    null
  )
}

function MetricCard({ label, value, detail, icon: Icon = Activity, tone = 'neutral' }) {
  return (
    <div className={`dw2-metric dw2-tone-${tone}`}>
      <span className="dw2-metric__icon"><Icon size={18} /></span>
      <div>
        <strong>{value ?? 0}</strong>
        <span>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
    </div>
  )
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`dw2-pill dw2-tone-${tone}`}>{children}</span>
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`dw2-panel ${className}`}>
      <div className="dw2-panel__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="dw2-panel__action">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ label = 'Chưa có dữ liệu phù hợp.' }) {
  return (
    <div className="dw2-empty">
      <Inbox size={20} />
      <span>{label}</span>
    </div>
  )
}

function Sidebar({ groups, activeGroupId, activeItemKey, expanded, onToggle, onNavigate, collapsed, onToggleCollapsed, onLogout }) {
  return (
    <aside className={`dw2-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Menu workspace bác sĩ">
      <div className="dw2-sidebar__brand">
        <span className="dw2-sidebar__brand-mark" aria-hidden="true">
          <AppLogo variant="mark" alt="" />
        </span>
        <div>
          <p>{APP_BRAND_NAME}</p>
          <strong>Doctor Workspace</strong>
        </div>
        <button type="button" className="dw2-icon-button dw2-sidebar__toggle" onClick={onToggleCollapsed} aria-label="Thu gọn sidebar">
          <Menu size={18} />
        </button>
      </div>

      <nav className="dw2-sidebar__nav" aria-label="Doctor Workspace">
        {groups.map((group) => {
          const Icon = group.icon || ClipboardList
          const isOpen = expanded[group.id]
          const isGroupActive = activeGroupId === group.id
          return (
            <div className={`dw2-nav-group ${isGroupActive ? 'is-active' : ''}`} key={group.id}>
              <button type="button" className="dw2-nav-group__button" onClick={() => onToggle(group.id)}>
                <span className="dw2-nav-group__icon" aria-hidden="true"><Icon size={18} /></span>
                <span className="dw2-nav-group__label">{group.label}</span>
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <div className={`dw2-nav-group__items ${isOpen ? 'is-open' : ''}`}>
                {group.items.map((item) => (
                  <button
                    type="button"
                    className={`dw2-nav-item ${activeItemKey === item.key ? 'is-current' : ''}`}
                    key={item.key}
                    title={item.label}
                    onClick={() => onNavigate(item.path)}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="dw2-sidebar__footer">
        <div className="dw2-sidebar__access">
          <ShieldCheck size={17} />
          <span>
            <strong>Truy cập lâm sàng</strong>
            <small>Workspace bác sĩ</small>
          </span>
        </div>
        <button type="button" className="dw2-sidebar__logout" onClick={onLogout}>
          <LogOut size={17} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  )
}

function Topbar({ user, overview, searchTerm, onSearchTerm, searchState, onNavigate, onLogout, onNavigateHome, onOpenSidebar }) {
  const doctor = overview.doctor || user
  const activePatient = getActivePatient(overview)
  const criticalCount = numberValue(overview.kpis?.critical_unhandled)

  return (
    <header className="dw2-topbar">
      <button type="button" className="dw2-icon-button dw2-mobile-menu" onClick={onOpenSidebar} aria-label="Mở menu bác sĩ">
        <Menu size={18} />
      </button>

      <div className="dw2-search">
        <Search size={18} />
        <input
          value={searchTerm}
          onChange={(event) => onSearchTerm(event.target.value)}
          placeholder="Tìm bệnh nhân, encounter, order, kết quả, đơn thuốc..."
        />
        {searchTerm ? (
          <button type="button" onClick={() => onSearchTerm('')} aria-label="Xóa tìm kiếm">
            <X size={16} />
          </button>
        ) : null}
        {searchTerm.length >= 2 ? (
          <div className="dw2-search__dropdown">
            {searchState.loading ? <EmptyState label="Đang tìm kiếm..." /> : null}
            {!searchState.loading && searchState.error ? <EmptyState label={searchState.error} /> : null}
            {!searchState.loading && !searchState.error && !safeArray(searchState.groups).length ? <EmptyState label="Không tìm thấy kết quả phù hợp." /> : null}
            {safeArray(searchState.groups).map((group) => (
              <div className="dw2-search-group" key={group.id}>
                <p>{group.label}</p>
                {safeArray(group.items).map((item) => (
                  <button type="button" key={`${group.id}-${item.id}`} onClick={() => onNavigate(item.path)}>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="dw2-active-patient">
        <UserRound size={18} />
        <div>
          <span>Bệnh nhân active</span>
          <strong>{patientLabel(activePatient)}</strong>
        </div>
      </div>

      <button type="button" className={`dw2-alert-button ${criticalCount ? 'has-critical' : ''}`} onClick={() => onNavigate('/doctor/results?view=critical')}>
        <AlertTriangle size={18} />
        <span>{criticalCount} critical</span>
      </button>

      <button type="button" className="dw2-icon-button" onClick={() => onNavigate('/doctor/communication?view=messages')} aria-label="Thông báo">
        <Bell size={18} />
      </button>

      <button type="button" className="dw2-user-chip" onClick={onNavigateHome}>
        <span>{getInitials(doctor?.full_name || user?.full_name)}</span>
        <div>
          <strong>{doctor?.full_name || user?.full_name || 'Bác sĩ'}</strong>
          <small>{overview.doctor?.department?.department_name || user?.department_name || 'Workspace bác sĩ'}</small>
        </div>
      </button>

      <button type="button" className="dw2-icon-button" onClick={onLogout} aria-label="Đăng xuất">
        <LogOut size={18} />
      </button>
    </header>
  )
}

function PageHeader({ group, item, mode, overview, isLoading, error, onRefresh }) {
  return (
    <div className="dw2-page-header">
      <div>
        <span className="dw2-page-header__eyebrow">{mode.label}</span>
        <h1>{item.label}</h1>
        <p>{item.description}</p>
      </div>
      <div className="dw2-page-header__aside">
        {error ? <StatusPill tone="warning">{error}</StatusPill> : <StatusPill tone="success">Backend connected</StatusPill>}
        <button type="button" className="dw2-secondary-button" onClick={onRefresh}>
          {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>
      <div className="dw2-page-header__workflow">
        {safeArray(overview.workflow).length ? safeArray(overview.workflow).map((step) => (
          <div key={step.key}>
            <strong>{step.count}</strong>
            <span>{step.label}</span>
          </div>
        )) : mode.focus.map((focus) => (
          <div key={focus}>
            <strong>0</strong>
            <span>{focus}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PatientContextBar({ overview, onNavigate }) {
  const patient = getActivePatient(overview)
  const latestVital = safeArray(overview.queue).find((ticket) => ticket.patient?.patient_id === patient?.patient_id)?.latest_vital
  const critical = safeArray(overview.critical_results)[0]

  return (
    <div className="dw2-patient-context">
      <div className="dw2-patient-context__identity">
        <span>{getInitials(patient?.full_name)}</span>
        <div>
          <strong>{patient?.full_name || 'Chưa có bệnh nhân active'}</strong>
          <p>{patient ? [patient.gender, patient.age ? `${patient.age} tuổi` : null, patient.patient_code, patient.insurance_number ? 'BHYT: Có' : null].filter(Boolean).join(' · ') : 'Chọn bệnh nhân từ queue, encounter hoặc tìm kiếm.'}</p>
        </div>
      </div>
      <div className="dw2-patient-context__signals">
        <StatusPill tone={critical ? 'critical' : 'success'}>{critical ? 'Critical chưa xử lý' : 'Không có critical active'}</StatusPill>
        <StatusPill tone={latestVital ? 'neutral' : 'warning'}>{latestVital ? `HA ${latestVital.blood_pressure_systolic || '--'}/${latestVital.blood_pressure_diastolic || '--'} · SpO2 ${latestVital.spo2 || '--'}%` : 'Chưa có sinh hiệu mới'}</StatusPill>
      </div>
      <div className="dw2-patient-context__actions">
        {['Ghi note', 'Chẩn đoán', 'Tạo chỉ định', 'Kê đơn', 'Hoàn tất'].map((label) => (
          <button type="button" key={label} onClick={() => onNavigate('/doctor/encounters?view=active')}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function KpiGrid({ overview }) {
  const kpis = overview.kpis || {}
  return (
    <div className="dw2-kpi-grid">
      <MetricCard label="Bệnh nhân chờ tôi" value={numberValue(kpis.waiting_patients)} detail="Queue sẵn sàng hoặc đã gọi" icon={UsersRound} tone="neutral" />
      <MetricCard label="Đang khám" value={numberValue(kpis.active_encounters)} detail="Encounter active/on-hold" icon={Stethoscope} tone="success" />
      <MetricCard label="Đã khám hôm nay" value={numberValue(kpis.completed_today)} detail={`${numberValue(kpis.appointments_today)} lịch hẹn hôm nay`} icon={CheckCircle2} tone="success" />
      <MetricCard label="Cần hoàn tất" value={numberValue(kpis.pending_tasks)} detail={`${numberValue(kpis.draft_notes)} note draft`} icon={ListChecks} tone="warning" />
      <MetricCard label="Kết quả mới" value={numberValue(kpis.new_results)} detail="Lab/CĐHA/thủ thuật" icon={Inbox} tone="neutral" />
      <MetricCard label="Critical" value={numberValue(kpis.critical_unhandled)} detail="Cần acknowledge" icon={AlertTriangle} tone={numberValue(kpis.critical_unhandled) ? 'critical' : 'success'} />
    </div>
  )
}

function QueuePanel({ queue, onNavigate }) {
  const rows = safeArray(queue)
  return (
    <Panel title="Queue bệnh nhân của tôi" subtitle="Ưu tiên clinical readiness, SLA và cảnh báo sinh hiệu.">
      <div className="dw2-card-list">
        {!rows.length ? <EmptyState label="Không có bệnh nhân đang chờ trong queue." /> : rows.slice(0, 6).map((ticket) => (
          <button type="button" className="dw2-patient-card" key={ticket.queue_ticket_id} onClick={() => onNavigate('/doctor/encounters?view=start')}>
            <div>
              <StatusPill tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</StatusPill>
              <strong>{ticket.patient?.full_name || 'Bệnh nhân'}</strong>
              <span>{[ticket.patient?.gender, ticket.patient?.age ? `${ticket.patient.age} tuổi` : null, ticket.patient?.patient_code].filter(Boolean).join(' · ')}</span>
            </div>
            <div>
              <small>STT {ticket.display_number || ticket.queue_number || '--'}</small>
              <small>Check-in {formatTime(ticket.checkin_time)}</small>
              <small>{ticket.latest_vital ? `SpO2 ${ticket.latest_vital.spo2 || '--'}% · Mạch ${ticket.latest_vital.pulse || ticket.latest_vital.heart_rate || '--'}` : 'Thiếu sinh hiệu'}</small>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function AppointmentPanel({ appointments, onNavigate }) {
  const rows = safeArray(appointments)
  return (
    <Panel title="Lịch khám hôm nay" subtitle="Timeline lịch hẹn gắn với check-in và encounter.">
      <div className="dw2-timeline">
        {!rows.length ? <EmptyState label="Không có lịch hẹn hôm nay." /> : rows.slice(0, 7).map((appointment) => (
          <button type="button" key={appointment.appointment_id} onClick={() => onNavigate('/doctor/schedules/today')}>
            <time>{formatTime(appointment.appointment_time)}</time>
            <div>
              <strong>{appointment.patient?.full_name || 'Bệnh nhân'}</strong>
              <span>{appointment.reason || statusLabel(appointment.status)}</span>
            </div>
            <StatusPill tone={statusTone(appointment.status)}>{statusLabel(appointment.status)}</StatusPill>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function EncounterPanel({ encounters, onNavigate }) {
  const rows = safeArray(encounters)
  return (
    <Panel title="Encounter đang mở" subtitle="Completion score cho note, diagnosis, order, prescription và care plan.">
      <div className="dw2-encounter-list">
        {!rows.length ? <EmptyState label="Không có encounter đang mở." /> : rows.slice(0, 5).map((encounter) => (
          <button type="button" key={encounter.encounter_id} className="dw2-encounter-card" onClick={() => onNavigate(`/doctor/encounters?view=active&encounterId=${encounter.encounter_id}`)}>
            <div>
              <strong>{encounter.encounter_code || 'Encounter'}</strong>
              <span>{patientLabel(encounter.patient)}</span>
            </div>
            <div className="dw2-progress">
              <span style={{ width: `${encounter.readiness?.score || 0}%` }} />
            </div>
            <small>{encounter.readiness?.score || 0}% hoàn tất · {safeArray(encounter.readiness?.missing).slice(0, 2).join(' · ') || 'Sẵn sàng hoàn tất'}</small>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function ResultPanel({ results, criticalResults, onNavigate }) {
  const rows = safeArray(criticalResults).length ? safeArray(criticalResults) : safeArray(results)
  return (
    <Panel title="Kết quả mới / critical" subtitle="Kết quả chưa đọc và critical cần acknowledge bằng action note.">
      <div className="dw2-result-list">
        {!rows.length ? <EmptyState label="Không có kết quả mới." /> : rows.slice(0, 6).map((result) => (
          <button type="button" className="dw2-result-row" key={`${result.result_type}-${result.result_id}`} onClick={() => onNavigate(`/doctor/results?view=${result.is_critical ? 'critical' : 'new'}&resultId=${result.result_id}`)}>
            <span className={`dw2-result-row__mark ${result.is_critical ? 'is-critical' : ''}`} />
            <div>
              <strong>{result.title}</strong>
              <span>{patientLabel(result.patient)}</span>
            </div>
            <div>
              <StatusPill tone={result.is_critical ? 'critical' : 'neutral'}>{result.is_critical ? 'Critical' : statusLabel(result.status)}</StatusPill>
              <small>{formatDateTime(result.reported_at || result.released_to_doctor_at)}</small>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function TaskPanel({ tasks, onNavigate }) {
  const rows = safeArray(tasks)
  return (
    <Panel title="Việc cần hoàn tất" subtitle="Task inbox lâm sàng theo mức độ khẩn và encounter liên quan.">
      <div className="dw2-task-board">
        {!rows.length ? <EmptyState label="Không có việc cần hoàn tất." /> : rows.slice(0, 8).map((task) => (
          <button type="button" className="dw2-task-card" key={task.task_id} onClick={() => onNavigate(task.action_path || '/doctor/dashboard?panel=tasks')}>
            <StatusPill tone={statusTone(task.type, task.priority)}>{task.priority || 'normal'}</StatusPill>
            <strong>{task.title}</strong>
            <span>{task.description}</span>
            <small>{patientLabel(task.patient)} · {formatDateTime(task.due_at)}</small>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function OrderPrescriptionPanel({ overview, onNavigate }) {
  const orders = safeArray(overview.orders)
  const prescriptions = safeArray(overview.prescriptions)
  return (
    <div className="dw2-two-panels">
      <Panel title="Chỉ định đang chờ" subtitle="Theo dõi order, charge và result status.">
        <div className="dw2-compact-list">
          {!orders.length ? <EmptyState label="Không có order đang chờ." /> : orders.slice(0, 5).map((order) => (
            <button type="button" key={order.order_id} onClick={() => onNavigate(`/doctor/orders?view=pending&orderId=${order.order_id}`)}>
              <ClipboardCheck size={16} />
              <span><strong>{order.order_no || order.order_type}</strong><small>{patientLabel(order.patient)} · {statusLabel(order.status)}</small></span>
              <StatusPill tone={statusTone(order.status, order.priority)}>{order.priority || 'routine'}</StatusPill>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="Đơn thuốc" subtitle="Draft, ký đơn và trạng thái cấp phát.">
        <div className="dw2-compact-list">
          {!prescriptions.length ? <EmptyState label="Không có đơn thuốc cần xử lý." /> : prescriptions.slice(0, 5).map((prescription) => (
            <button type="button" key={prescription.prescription_id} onClick={() => onNavigate(`/doctor/prescriptions?prescriptionId=${prescription.prescription_id}`)}>
              <Pill size={16} />
              <span><strong>{prescription.prescription_no || 'Đơn thuốc'}</strong><small>{patientLabel(prescription.patient)} · {statusLabel(prescription.status)}</small></span>
              <StatusPill tone={statusTone(prescription.status)}>{statusLabel(prescription.status)}</StatusPill>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function DashboardView({ overview, onNavigate }) {
  return (
    <>
      <KpiGrid overview={overview} />
      <PatientContextBar overview={overview} onNavigate={onNavigate} />
      <div className="dw2-main-grid">
        <QueuePanel queue={overview.queue} onNavigate={onNavigate} />
        <AppointmentPanel appointments={overview.appointments} onNavigate={onNavigate} />
        <EncounterPanel encounters={overview.active_encounters} onNavigate={onNavigate} />
        <ResultPanel results={overview.results} criticalResults={overview.critical_results} onNavigate={onNavigate} />
        <TaskPanel tasks={overview.tasks} onNavigate={onNavigate} />
      </div>
      <OrderPrescriptionPanel overview={overview} onNavigate={onNavigate} />
    </>
  )
}

function FocusPanel({ mode }) {
  return (
    <Panel title="Checklist nghiệp vụ" subtitle="Các điểm UI phải trả lời rõ trước khi bác sĩ thao tác.">
      <div className="dw2-focus-list">
        {mode.focus.map((focus) => (
          <div key={focus}>
            <CheckCircle2 size={16} />
            <span>{focus}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function ActionPanel({ mode, onNavigate }) {
  return (
    <Panel title="Quick actions" subtitle="Các lệnh chính giữ cố định theo ngữ cảnh màn hình.">
      <div className="dw2-action-grid">
        {mode.primaryActions.map((action, index) => (
          <button type="button" key={action} onClick={() => onNavigate(index < 2 ? '/doctor/encounters?view=active' : '/doctor/orders?view=create')}>
            {index === 0 ? <PlusCircle size={18} /> : index === 1 ? <FileSignature size={18} /> : index === 2 ? <ClipboardList size={18} /> : <Send size={18} />}
            <span>{action}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function GenericWorkspacePage({ group, item, mode, overview, onNavigate }) {
  const isResults = group.id === 'results'
  const isOrders = group.id === 'orders'
  const isPrescriptions = group.id === 'prescriptions'
  const isEncounter = group.id === 'encounter'
  const isPatients = group.id === 'patients'

  return (
    <>
      <PatientContextBar overview={overview} onNavigate={onNavigate} />
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          {isPatients ? <QueuePanel queue={overview.queue} onNavigate={onNavigate} /> : null}
          {isEncounter ? <EncounterPanel encounters={overview.active_encounters} onNavigate={onNavigate} /> : null}
          {isOrders ? <OrderPrescriptionPanel overview={overview} onNavigate={onNavigate} /> : null}
          {isResults ? <ResultPanel results={overview.results} criticalResults={item.key === 'critical-results' ? overview.critical_results : []} onNavigate={onNavigate} /> : null}
          {isPrescriptions ? <OrderPrescriptionPanel overview={overview} onNavigate={onNavigate} /> : null}
          {!isPatients && !isEncounter && !isOrders && !isResults && !isPrescriptions ? (
            <Panel title={item.label} subtitle={item.description}>
              <div className="dw2-blueprint-grid">
                <div>
                  <h4>Luồng dữ liệu chính</h4>
                  <p>{mode.focus.join(' · ')}</p>
                </div>
                <div>
                  <h4>Backend đang dùng</h4>
                  <p>Doctor workspace aggregation, encounter, clinical, order/result, prescription, records, notification.</p>
                </div>
                <div>
                  <h4>Trạng thái UI</h4>
                  <p>Đã có shell, command panels, context bar, quick actions và empty state chuyên nghiệp.</p>
                </div>
              </div>
            </Panel>
          ) : null}
          <TaskPanel tasks={overview.tasks} onNavigate={onNavigate} />
        </div>
        <aside className="dw2-workspace-layout__side">
          <FocusPanel mode={mode} />
          <ActionPanel mode={mode} onNavigate={onNavigate} />
          <Panel title="Thông báo mới" subtitle="Critical, result, encounter, đơn thuốc và trao đổi.">
            <div className="dw2-compact-list">
              {!safeArray(overview.notifications).length ? <EmptyState label="Chưa có thông báo mới." /> : safeArray(overview.notifications).slice(0, 5).map((notification) => (
                <button type="button" key={notification.notification_id} onClick={() => onNavigate(notification.path || '/doctor/communication?view=messages')}>
                  <Bell size={16} />
                  <span><strong>{notification.title}</strong><small>{notification.message}</small></span>
                </button>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  )
}

export function DoctorWorkspaceExperience({ user, onLogout, onNavigateHome }) {
  const location = useLocation()
  const navigate = useNavigate()
  const groups = useMemo(() => filterGroupsForUser(user), [user])
  const active = useMemo(() => findActiveNavigation(location, groups), [location, groups])
  const [overview, setOverview] = useState(EMPTY_OVERVIEW)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(() => Object.fromEntries(groups.slice(0, 3).map((group) => [group.id, true])))
  const [searchTerm, setSearchTerm] = useState('')
  const [searchState, setSearchState] = useState({ loading: false, error: '', groups: [] })

  const mode = GROUP_MODES[active.group?.id] || GROUP_MODES.overview

  useEffect(() => {
    setExpandedGroups((current) => ({ ...current, [active.group?.id]: true }))
  }, [active.group?.id])

  async function loadOverview() {
    setLoading(true)
    setError('')
    try {
      const response = await doctorWorkspaceAPI.overview({ date: todayString() })
      setOverview({ ...EMPTY_OVERVIEW, ...unwrapData(response) })
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError, 'Không tải được Doctor Workspace.'))
      setOverview((current) => ({ ...EMPTY_OVERVIEW, ...current }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOverview()
  }, [])

  useEffect(() => {
    const q = searchTerm.trim()
    if (q.length < 2) {
      setSearchState({ loading: false, error: '', groups: [] })
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setSearchState((current) => ({ ...current, loading: true, error: '' }))
      try {
        const response = await doctorWorkspaceAPI.search({ q })
        if (!cancelled) {
          setSearchState({ loading: false, error: '', groups: safeArray(unwrapData(response)?.groups) })
        }
      } catch (searchError) {
        if (!cancelled) {
          setSearchState({ loading: false, error: getApiErrorMessage(searchError, 'Không tìm kiếm được.'), groups: [] })
        }
      }
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchTerm])

  function handleNavigate(path) {
    setSearchTerm('')
    setMobileSidebarOpen(false)
    navigate(path)
  }

  function handleToggleGroup(groupId) {
    setExpandedGroups((current) => ({ ...current, [groupId]: !current[groupId] }))
  }

  return (
    <div className={`dw2-shell ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${mobileSidebarOpen ? 'is-mobile-sidebar-open' : ''}`}>
      <button
        type="button"
        className="dw2-sidebar-backdrop"
        aria-label="Đóng menu bác sĩ"
        onClick={() => setMobileSidebarOpen(false)}
      />
      <Sidebar
        groups={groups}
        activeGroupId={active.group?.id}
        activeItemKey={active.item?.key}
        expanded={expandedGroups}
        onToggle={handleToggleGroup}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onLogout={onLogout}
      />
      <div className="dw2-app">
        <Topbar
          user={user}
          overview={overview}
          searchTerm={searchTerm}
          onSearchTerm={setSearchTerm}
          searchState={searchState}
          onNavigate={handleNavigate}
          onLogout={onLogout}
          onNavigateHome={onNavigateHome}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />
        <main className="dw2-content">
          <PageHeader
            group={active.group}
            item={active.item || groups[0]?.items[0]}
            mode={mode}
            overview={overview}
            isLoading={loading}
            error={error}
            onRefresh={loadOverview}
          />
          {(active.item?.key === 'dashboard' || routeSignature(location) === '/doctor/dashboard') ? (
            <DashboardView overview={overview} onNavigate={handleNavigate} />
          ) : (
            <GenericWorkspacePage group={active.group} item={active.item} mode={mode} overview={overview} onNavigate={handleNavigate} />
          )}
        </main>
      </div>
    </div>
  )
}
