import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { appointmentAPI, doctorWorkspaceAPI, encounterAPI, getApiErrorMessage, orderAPI, prescriptionAPI, unwrapData } from '../utils/api'
import {
  DoctorClinicalRecordsPage as DoctorClinicalRecordsCommandPage,
  DoctorEncounterCommandPage,
  DoctorPatientFlowPage as DoctorPatientCommandPage,
} from './DoctorClinicalCommandPages'
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
      { key: 'open-encounters', label: 'Encounter đang mở', path: '/doctor/dashboard?panel=open-encounters', description: 'Các encounter cần tiếp tục hoặc hoàn tất.' },
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
    path: '/doctor/encounters?view=active',
    compactSidebar: true,
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
  return Array.isArray(value) ? value.filter((item) => item !== null && item !== undefined) : []
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
  if (location.pathname === '/doctor/encounters') {
    const encounterGroup = groups.find((group) => group.id === 'encounter')
    const item = encounterGroup?.items.find((entry) => signature === entry.path || signature.startsWith(`${entry.path}&`))
    if (encounterGroup && item) return { group: encounterGroup, item }
  }
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

function ActionButton({ children, onClick, disabled, tone = 'neutral', type = 'button', title }) {
  return (
    <button
      type={type}
      className={`dw2-command-button is-${tone}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}

function SidebarBadge({ value, tone = 'neutral' }) {
  if (!Number(value)) return null
  return <span className={`dw2-sidebar-badge dw2-tone-${tone}`}>{value > 99 ? '99+' : value}</span>
}

function getGroupBadge(groupId, overview) {
  const kpis = overview?.kpis || {}
  const map = {
    overview: numberValue(kpis.pending_tasks) + numberValue(kpis.critical_unhandled),
    patients: numberValue(kpis.waiting_patients),
    encounter: numberValue(kpis.active_encounters),
    orders: numberValue(kpis.pending_orders),
    results: numberValue(kpis.new_results) + numberValue(kpis.critical_unhandled),
    prescriptions: numberValue(kpis.draft_prescriptions),
    communication: safeArray(overview?.notifications).length,
  }
  return map[groupId] || 0
}

function isSidebarItemCurrent(item, activeItemKey) {
  return item.key === activeItemKey || safeArray(item.activeKeys).includes(activeItemKey)
}

function Sidebar({ groups, activeGroupId, activeItemKey, expanded, onToggle, onNavigate, collapsed, onToggleCollapsed, onLogout, overview }) {
  const kpis = overview?.kpis || {}
  const criticalCount = numberValue(kpis.critical_unhandled)
  const waitingCount = numberValue(kpis.waiting_patients)
  const activeEncounterCount = numberValue(kpis.active_encounters)

  return (
    <aside className={`dw2-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="Menu workspace bác sĩ">
      <div className="dw2-sidebar__brand">
        <span className="dw2-sidebar__brand-mark" aria-hidden="true">
          <AppLogo variant="mark" alt="" />
        </span>
        <div className="dw2-sidebar__brand-copy">
          <p>{APP_BRAND_NAME}</p>
          <strong>Doctor Workspace</strong>
          <small>Clinical command center</small>
        </div>
        <button type="button" className="dw2-icon-button dw2-sidebar__toggle" onClick={onToggleCollapsed} aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}>
          <Menu size={18} />
        </button>
      </div>

      <div className="dw2-sidebar__mission">
        <span className="dw2-live-dot" />
        <div>
          <strong>Phiên khám đang hoạt động</strong>
          <small>{waitingCount} chờ khám · {activeEncounterCount} encounter mở</small>
        </div>
      </div>

      <div className="dw2-sidebar__quickstats" aria-label="Chỉ số nhanh workspace bác sĩ">
        <button type="button" onClick={() => onNavigate('/doctor/queue?view=waiting')}>
          <strong>{waitingCount}</strong>
          <span>Chờ</span>
        </button>
        <button type="button" onClick={() => onNavigate('/doctor/encounters?view=active')}>
          <strong>{activeEncounterCount}</strong>
          <span>Đang khám</span>
        </button>
        <button type="button" className={criticalCount ? 'is-danger' : ''} onClick={() => onNavigate('/doctor/results?view=critical')}>
          <strong>{criticalCount}</strong>
          <span>Critical</span>
        </button>
      </div>

      <nav className="dw2-sidebar__nav" aria-label="Doctor Workspace">
        {groups.map((group) => {
          const Icon = group.icon || ClipboardList
          const isOpen = expanded[group.id]
          const isGroupActive = activeGroupId === group.id
          const badgeValue = getGroupBadge(group.id, overview)
          const isCompactSidebarGroup = Boolean(group.compactSidebar && group.path)
          return (
            <div className={`dw2-nav-group ${isGroupActive ? 'is-active' : ''}`} key={group.id}>
              <button
                type="button"
                className={`dw2-nav-group__button ${isCompactSidebarGroup ? 'is-direct' : ''}`}
                onClick={() => (isCompactSidebarGroup ? onNavigate(group.path) : onToggle(group.id))}
                title={group.label}
              >
                <span className="dw2-nav-group__icon" aria-hidden="true"><Icon size={18} /></span>
                <span className="dw2-nav-group__label">{group.label}</span>
                <SidebarBadge value={badgeValue} tone={criticalCount && ['overview', 'results'].includes(group.id) ? 'critical' : 'neutral'} />
                {!isCompactSidebarGroup ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : null}
              </button>
              {!isCompactSidebarGroup ? (
                <div className={`dw2-nav-group__items ${isOpen ? 'is-open' : ''}`}>
                  {group.items.map((item) => {
                    const isCurrent = isSidebarItemCurrent(item, activeItemKey)
                    return (
                    <button
                      type="button"
                      className={`dw2-nav-item ${isCurrent ? 'is-current' : ''}`}
                      key={item.key}
                      title={item.description || item.label}
                      onClick={() => onNavigate(item.path)}
                    >
                      <span>{item.label}</span>
                      {isCurrent ? <small>Đang mở</small> : null}
                    </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="dw2-sidebar__footer">
        <div className="dw2-sidebar__access">
          <ShieldCheck size={17} />
          <span>
            <strong>Truy cập lâm sàng</strong>
            <small>Workspace bác sĩ · audit enabled</small>
          </span>
        </div>
        <div className="dw2-sidebar__footer-actions">
          <button type="button" onClick={() => onNavigate('/doctor/orders?view=create')}>
            <PlusCircle size={16} />
            <span>Chỉ định</span>
          </button>
          <button type="button" onClick={() => onNavigate('/doctor/prescriptions?view=create')}>
            <Pill size={16} />
            <span>Kê đơn</span>
          </button>
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
  const [accountOpen, setAccountOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const doctor = overview.doctor || user
  const activePatient = getActivePatient(overview)
  const criticalCount = numberValue(overview.kpis?.critical_unhandled)
  const notificationRows = safeArray(overview.notifications)

  function navigateAndClose(path) {
    setAccountOpen(false)
    setNotifyOpen(false)
    onNavigate(path)
  }

  return (
    <header className="dw2-topbar">
      <div className="dw2-topbar__left">
        <button type="button" className="dw2-icon-button dw2-mobile-menu" onClick={onOpenSidebar} aria-label="Mở menu bác sĩ">
          <Menu size={18} />
        </button>

        <div className="dw2-search">
          <Search size={18} />
          <input
            value={searchTerm}
            onChange={(event) => onSearchTerm(event.target.value)}
            placeholder="Tìm bệnh nhân, mã BA, encounter, order, kết quả..."
          />
          <kbd>Ctrl K</kbd>
          {searchTerm ? (
            <button type="button" onClick={() => onSearchTerm('')} aria-label="Xóa tìm kiếm">
              <X size={16} />
            </button>
          ) : null}
          {searchTerm.length >= 2 ? (
            <div className="dw2-search__dropdown">
              <div className="dw2-search__head">
                <strong>Clinical search</strong>
                <span>{searchState.loading ? 'Đang tìm...' : `${safeArray(searchState.groups).length} nhóm kết quả`}</span>
              </div>
              {searchState.loading ? <EmptyState label="Đang tìm kiếm..." /> : null}
              {!searchState.loading && searchState.error ? <EmptyState label={searchState.error} /> : null}
              {!searchState.loading && !searchState.error && !safeArray(searchState.groups).length ? <EmptyState label="Không tìm thấy kết quả phù hợp." /> : null}
              {safeArray(searchState.groups).map((group) => (
                <div className="dw2-search-group" key={group.id}>
                  <p>{group.label}</p>
                  {safeArray(group.items).map((item) => (
                    <button type="button" key={`${group.id}-${item.id}`} onClick={() => navigateAndClose(item.path)}>
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="dw2-topbar__center">
        <button type="button" className="dw2-active-patient" onClick={() => navigateAndClose('/doctor/clinical-records?view=summary')}>
          <UserRound size={18} />
          <div>
            <span>Bệnh nhân active</span>
            <strong>{patientLabel(activePatient)}</strong>
          </div>
        </button>
        <button type="button" className={`dw2-alert-button ${criticalCount ? 'has-critical' : ''}`} onClick={() => navigateAndClose('/doctor/results?view=critical')}>
          <AlertTriangle size={18} />
          <span>{criticalCount} critical</span>
        </button>
      </div>

      <div className="dw2-topbar__right">
        <button type="button" className="dw2-primary-action" onClick={() => navigateAndClose('/doctor/encounters?view=start')}>
          <PlusCircle size={18} />
          <span>Bắt đầu khám</span>
        </button>

        <div className="dw2-topbar-popover">
          <button type="button" className={`dw2-icon-button dw2-bell-button ${notificationRows.length ? 'has-unread' : ''}`} onClick={() => setNotifyOpen((value) => !value)} aria-label="Thông báo">
            <Bell size={18} />
          </button>
          {notifyOpen ? (
            <div className="dw2-popover-panel dw2-notify-menu">
              <div className="dw2-popover-panel__head">
                <strong>Thông báo lâm sàng</strong>
                <button type="button" onClick={() => navigateAndClose('/doctor/communication?view=messages')}>Xem tất cả</button>
              </div>
              {!notificationRows.length ? <EmptyState label="Chưa có thông báo mới." /> : notificationRows.slice(0, 5).map((notification) => (
                <button type="button" key={notification.notification_id || notification.id || notification.title} onClick={() => navigateAndClose(notification.path || '/doctor/communication?view=messages')}>
                  <span className="dw2-notify-dot" />
                  <span>
                    <strong>{notification.title || 'Thông báo'}</strong>
                    <small>{notification.message || notification.body || 'Mở để xem chi tiết'}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="dw2-account">
          <button type="button" className="dw2-user-chip" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen}>
            <span>{getInitials(doctor?.full_name || user?.full_name)}</span>
            <div>
              <strong>{doctor?.full_name || user?.full_name || 'Bác sĩ'}</strong>
              <small>{overview.doctor?.department?.department_name || user?.department_name || 'Workspace bác sĩ'}</small>
            </div>
            <ChevronDown size={16} />
          </button>
          {accountOpen ? (
            <div className="dw2-popover-panel dw2-account-menu">
              <div className="dw2-account-menu__profile">
                <span>{getInitials(doctor?.full_name || user?.full_name)}</span>
                <div>
                  <strong>{doctor?.full_name || user?.full_name || 'Bác sĩ'}</strong>
                  <small>{overview.doctor?.department?.department_name || user?.department_name || 'General Medicine'}</small>
                </div>
              </div>
              <button type="button" onClick={onNavigateHome}><Home size={16} />Không gian khác</button>
              <button type="button" onClick={() => navigateAndClose('/doctor/dashboard?panel=tasks')}><ListChecks size={16} />Việc cần hoàn tất</button>
              <button type="button" onClick={() => navigateAndClose('/doctor/communication?view=messages')}><MessageSquare size={16} />Tin nhắn & thông báo</button>
              <button type="button" onClick={() => navigateAndClose('/doctor/clinical-records?view=consent-access')}><ShieldCheck size={16} />Quyền truy cập hồ sơ</button>
              <button type="button" className="is-danger" onClick={onLogout}><LogOut size={16} />Đăng xuất</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

function PageHeader({ group, item, mode, overview, isLoading, error, onRefresh, compact = false }) {
  if (compact) return null

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
      {!compact ? <div className="dw2-page-header__workflow">
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
      </div> : null}
    </div>
  )
}

function PatientContextBar({ overview, onNavigate }) {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const requestedEncounterId = searchParams.get('encounterId') || ''
  const patient = getActivePatient(overview)
  const activeEncounter = safeArray(overview.active_encounters)[0] || null
  const activeEncounterId = activeEncounter?.encounter_id || activeEncounter?._id || activeEncounter?.id || requestedEncounterId
  const activePatientId = patientIdOf(patient)
  const canUseExamActions = Boolean(activeEncounterId)
  const latestVital = safeArray(overview.queue).find((ticket) => ticket.patient?.patient_id === patient?.patient_id)?.latest_vital
  const critical = safeArray(overview.critical_results)[0]
  const actions = [
    { label: 'Ghi note', path: '/doctor/encounters?view=active', requiresEncounter: true },
    { label: 'Chẩn đoán', path: '/doctor/encounters?view=active', requiresEncounter: true },
    { label: 'Tạo chỉ định', path: '/doctor/encounters?view=active', requiresEncounter: true },
    { label: 'Kê đơn', path: '/doctor/encounters?view=active', requiresEncounter: true },
    { label: 'Hoàn tất', path: '/doctor/encounters?view=active', requiresEncounter: true },
  ]

  function actionPath(path) {
    if (!activeEncounterId) return '/doctor/encounters?view=start'
    const separator = path.includes('?') ? '&' : '?'
    return `${path}${separator}encounterId=${encodeURIComponent(activeEncounterId)}`
  }

  function startPath() {
    return `/doctor/encounters?view=start${activePatientId ? `&patientId=${encodeURIComponent(activePatientId)}` : ''}`
  }

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
        {!activeEncounterId ? (
          <button type="button" onClick={() => onNavigate(startPath())}>
            Bat dau kham
          </button>
        ) : null}
        {actions.map((action) => (
          <button
            type="button"
            key={action.label}
            disabled={!canUseExamActions}
            title={action.requiresEncounter && !activeEncounterId ? 'Tạo hoặc bắt đầu encounter trước khi thao tác.' : action.label}
            onClick={() => {
              if (!canUseExamActions) return
              onNavigate(actionPath(action.path))
            }}
          >
            {action.label}
          </button>
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

function queueTicketIdOf(ticket = {}) {
  const value = ticket || {}
  return valueId(value.queue_ticket_id || value.id || value._id)
}

function patientIdOf(row = {}) {
  const value = row || {}
  return valueId(value.patient || value.patient_id || value)
}

async function startEncounterWithRecovery(encounterId, appointmentId = '') {
  if (!encounterId) return
  try {
    await encounterAPI.start(encounterId)
  } catch (startError) {
    try {
      await encounterAPI.arrive(encounterId)
      await encounterAPI.start(encounterId)
    } catch (arriveError) {
      if (!appointmentId) throw arriveError || startError
      await appointmentAPI.checkIn(appointmentId)
      await encounterAPI.start(encounterId)
    }
  }
}

function QueuePanel({ queue, onNavigate, onRefresh }) {
  const rows = safeArray(queue)
  const [busyTicketId, setBusyTicketId] = useState('')
  const [notice, setNotice] = useState({ error: '', success: '' })

  async function openQueueTicket(ticket) {
    const value = ticket || {}
    const existingEncounterId = valueId(value.encounter_id || value.encounter)
    if (existingEncounterId) {
      onNavigate(`/doctor/encounters?view=active&encounterId=${encodeURIComponent(existingEncounterId)}`)
      return
    }

    const ticketId = queueTicketIdOf(ticket)
    if (!ticketId) {
      const patientId = patientIdOf(ticket)
      onNavigate(`/doctor/encounters?view=start${patientId ? `&patientId=${encodeURIComponent(patientId)}` : ''}`)
      return
    }

    setBusyTicketId(ticketId)
    setNotice({ error: '', success: '' })
    try {
      const response = await encounterAPI.createFromQueue(ticketId)
      const payload = unwrapData(response) || {}
      const encounterId = valueId(payload.encounter || payload)
      if (encounterId) {
        try {
          await startEncounterWithRecovery(encounterId)
        } catch (startError) {
          // If start is blocked by readiness rules, still open the encounter workspace.
        }
        setNotice({ error: '', success: 'Da tao encounter tu queue.' })
        onRefresh?.({ silent: true })
        onNavigate(`/doctor/encounters?view=active&encounterId=${encodeURIComponent(encounterId)}`)
      } else {
        onRefresh?.({ silent: true })
        onNavigate(`/doctor/encounters?view=start&ticketId=${encodeURIComponent(ticketId)}`)
      }
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Khong the tao encounter tu queue ticket nay.'), success: '' })
    } finally {
      setBusyTicketId('')
    }
  }
  return (
    <Panel title="Queue bệnh nhân của tôi" subtitle="Ưu tiên clinical readiness, SLA và cảnh báo sinh hiệu.">
      {notice.error || notice.success ? <div className={`dw2-command-notice ${notice.error ? 'is-error' : 'is-success'}`}>{notice.error || notice.success}</div> : null}
      <div className="dw2-card-list">
        {!rows.length ? <EmptyState label="Không có bệnh nhân đang chờ trong queue." /> : rows.slice(0, 6).map((ticket) => (
          <button
            type="button"
            className="dw2-patient-card"
            key={queueTicketIdOf(ticket) || patientIdOf(ticket)}
            disabled={busyTicketId === queueTicketIdOf(ticket)}
            onClick={() => openQueueTicket(ticket)}
          >
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

function valueId(value) {
  if (!value) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return String(value.encounter_id || value.appointment_id || value.patient_id || value.id || value._id || '')
}

function appointmentIdOf(row = {}) {
  const value = row || {}
  return valueId(value.appointment || value.appointment_id || value)
}

function appointmentPatientIdOf(row = {}) {
  const value = row || {}
  return valueId(value.patient || value.patient_id || value)
}

function encounterIdFromAppointment(appointment = {}, encounters = []) {
  const value = appointment || {}
  const direct = valueId(value.encounter || value.active_encounter || value.encounter_id)
  if (direct) return direct
  const appointmentId = appointmentIdOf(value)
  const matched = safeArray(encounters).find((encounter) => valueId(encounter.appointment || encounter.appointment_id) === appointmentId)
  return valueId(matched)
}

function appointmentStartPath(appointment = {}) {
  const value = appointment || {}
  const params = new URLSearchParams({ view: 'start' })
  const appointmentId = appointmentIdOf(value)
  const patientId = appointmentPatientIdOf(value)
  if (appointmentId) params.set('appointmentId', appointmentId)
  if (patientId) params.set('patientId', patientId)
  return `/doctor/encounters?${params.toString()}`
}

function appointmentAutoExamPath(appointment = {}) {
  const value = appointment || {}
  const params = new URLSearchParams({ view: 'active' })
  const appointmentId = appointmentIdOf(value)
  const patientId = appointmentPatientIdOf(value)
  if (appointmentId) params.set('appointmentId', appointmentId)
  if (patientId) params.set('patientId', patientId)
  return `/doctor/encounters?${params.toString()}`
}

function appointmentExamPath(encounterId) {
  return `/doctor/encounters?view=active&encounterId=${encodeURIComponent(encounterId)}`
}

function encounterIdFromResponse(response) {
  const payload = unwrapData(response) || {}
  return valueId(payload.encounter || payload)
}

async function findTodayEncounterForAppointment(appointmentId) {
  if (!appointmentId) return ''
  try {
    const response = await encounterAPI.listToday({ limit: 100 })
    const payload = unwrapData(response)
    return encounterIdFromAppointment({ appointment_id: appointmentId }, safeArray(payload))
  } catch (error) {
    return ''
  }
}

async function startEncounterForExam(encounterId, appointmentId) {
  if (!encounterId) return null
  try {
    await startEncounterWithRecovery(encounterId, appointmentId)
    return null
  } catch (error) {
    return error
  }
}

async function createAppointmentEncounterForExam(appointmentId) {
  let response = null
  let createError = null
  try {
    response = await encounterAPI.createFromAppointment(appointmentId)
  } catch (error) {
    createError = error
    try {
      await appointmentAPI.checkIn(appointmentId)
    } catch (checkInError) {
      // The encounter endpoint may still be able to recover an existing encounter below.
    }
    try {
      response = await encounterAPI.createFromAppointment(appointmentId)
      createError = null
    } catch (retryError) {
      createError = retryError
    }
  }

  let encounterId = encounterIdFromResponse(response)
  if (!encounterId) {
    encounterId = await findTodayEncounterForAppointment(appointmentId)
  }
  if (!encounterId && createError) throw createError

  const startError = await startEncounterForExam(encounterId, appointmentId)
  return { encounterId, startError }
}

function AppointmentPanel({ appointments, encounters = [], onNavigate, onRefresh }) {
  const rows = safeArray(appointments)
  const [busyAppointmentId, setBusyAppointmentId] = useState('')
  const [error, setError] = useState('')

  async function openAppointment(appointment) {
    const existingEncounterId = encounterIdFromAppointment(appointment, encounters)
    if (existingEncounterId) {
      onNavigate(appointmentExamPath(existingEncounterId))
      return
    }

    const appointmentId = appointmentIdOf(appointment)
    if (!appointmentId) {
      onNavigate(appointmentStartPath(appointment))
      return
    }

    onNavigate(appointmentAutoExamPath(appointment))
    setBusyAppointmentId(appointmentId)
    setError('')
    try {
      const { encounterId: createdEncounterId } = await createAppointmentEncounterForExam(appointmentId)
      onRefresh?.()
      if (createdEncounterId) {
        onNavigate(appointmentExamPath(createdEncounterId))
      }
    } catch (createError) {
      setError(getApiErrorMessage(createError, 'Chưa thể tạo encounter từ lịch hẹn này.'))
    } finally {
      setBusyAppointmentId('')
    }
  }

  return (
    <Panel title="Lịch khám hôm nay" subtitle="Timeline lịch hẹn gắn với check-in và encounter.">
      {error ? <div className="dw2-command-notice is-error">{error}</div> : null}
      <div className="dw2-timeline">
        {!rows.length ? <EmptyState label="Không có lịch hẹn hôm nay." /> : rows.slice(0, 7).map((appointment) => (
          <button type="button" key={appointmentIdOf(appointment)} disabled={busyAppointmentId === appointmentIdOf(appointment)} onClick={() => openAppointment(appointment)}>
            <time>{formatTime(appointment.appointment_time)}</time>
            <div>
              <strong>{appointment.patient?.full_name || 'Bệnh nhân'}</strong>
              <span>{busyAppointmentId === appointmentIdOf(appointment) ? 'Đang mở màn khám...' : appointment.reason || statusLabel(appointment.status)}</span>
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

function encounterClinicalPath(encounter, view = 'active') {
  const encounterId = valueId(encounter.encounter_id || encounter.id || encounter._id)
  return `/doctor/encounters?view=${encodeURIComponent(view)}${encounterId ? `&encounterId=${encodeURIComponent(encounterId)}` : ''}`
}

function getEncounterActionSet(encounter = {}) {
  const status = String(encounter.status || '').toLowerCase()
  if (['planned', 'arrived', 'waiting'].includes(status)) return [{ key: 'start', label: 'Bat dau', tone: 'success' }]
  if (status === 'in_progress' || status === 'active') {
    return [
      { key: 'hold', label: 'Tam dung', tone: 'warning' },
      { key: 'complete', label: 'Hoan tat', tone: 'success' },
    ]
  }
  if (status === 'on_hold') {
    return [
      { key: 'resume', label: 'Tiep tuc', tone: 'success' },
      { key: 'complete', label: 'Hoan tat', tone: 'success' },
    ]
  }
  if (['completed', 'cancelled'].includes(status)) return [{ key: 'reopen', label: 'Mo lai', tone: 'warning' }]
  return [{ key: 'start', label: 'Bat dau', tone: 'success' }]
}

function LiveEncounterPanel({ encounters, onNavigate, onRefresh }) {
  const rows = safeArray(encounters)
  const [busyAction, setBusyAction] = useState('')
  const [notice, setNotice] = useState({ error: '', success: '' })

  async function runEncounterAction(encounter, action) {
    const encounterId = valueId(encounter.encounter_id || encounter.id || encounter._id)
    if (!encounterId) return
    setBusyAction(`${encounterId}:${action.key}`)
    setNotice({ error: '', success: '' })
    try {
      if (action.key === 'start') await startEncounterWithRecovery(encounterId, valueId(encounter.appointment_id))
      if (action.key === 'hold') await encounterAPI.hold(encounterId)
      if (action.key === 'resume') await encounterAPI.resume(encounterId)
      if (action.key === 'complete') await encounterAPI.complete(encounterId)
      if (action.key === 'reopen') await encounterAPI.reopen(encounterId)
      setNotice({ error: '', success: `${action.label} encounter thanh cong.` })
      await onRefresh?.({ silent: true })
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, `Khong the ${action.label.toLowerCase()} encounter.`), success: '' })
    } finally {
      setBusyAction('')
    }
  }

  return (
    <Panel title="Encounter dang mo" subtitle="Thao tac truc tiep bang API encounter va mo dung workspace lam sang.">
      {notice.error || notice.success ? <div className={`dw2-command-notice ${notice.error ? 'is-error' : 'is-success'}`}>{notice.error || notice.success}</div> : null}
      <div className="dw2-encounter-list">
        {!rows.length ? (
          <div className="dw2-command-empty-actions">
            <EmptyState label="Khong co encounter dang mo." />
            <ActionButton tone="success" onClick={() => onNavigate('/doctor/encounters?view=start')}>
              Bat dau kham
            </ActionButton>
          </div>
        ) : rows.slice(0, 5).map((encounter) => {
          const encounterId = valueId(encounter.encounter_id || encounter.id || encounter._id)
          return (
            <article key={encounterId} className="dw2-encounter-card">
              <button type="button" className="dw2-encounter-card__main" onClick={() => onNavigate(encounterClinicalPath(encounter))}>
                <div>
                  <strong>{encounter.encounter_code || 'Encounter'}</strong>
                  <span>{patientLabel(encounter.patient)}</span>
                </div>
                <div className="dw2-progress">
                  <span style={{ width: `${encounter.readiness?.score || 0}%` }} />
                </div>
                <small>{encounter.readiness?.score || 0}% complete - {safeArray(encounter.readiness?.missing).slice(0, 2).join(' / ') || 'Ready'}</small>
              </button>
              <div className="dw2-command-actions is-wide">
                {getEncounterActionSet(encounter).map((action) => {
                  const busy = busyAction === `${encounterId}:${action.key}`
                  return (
                    <ActionButton key={action.key} tone={action.tone} disabled={busy || Boolean(busyAction)} onClick={() => runEncounterAction(encounter, action)}>
                      {busy ? 'Dang xu ly...' : action.label}
                    </ActionButton>
                  )
                })}
                <ActionButton onClick={() => onNavigate(encounterClinicalPath(encounter, 'note'))}>Ghi note</ActionButton>
                <ActionButton onClick={() => onNavigate(encounterClinicalPath(encounter, 'diagnosis'))}>Chan doan</ActionButton>
                <ActionButton onClick={() => onNavigate(`/doctor/orders?view=create&encounterId=${encodeURIComponent(encounterId)}`)}>Chi dinh</ActionButton>
                <ActionButton onClick={() => onNavigate(`/doctor/prescriptions?view=create&encounterId=${encodeURIComponent(encounterId)}`)}>Ke don</ActionButton>
              </div>
            </article>
          )
        })}
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

function DashboardView({ overview, onNavigate, onRefresh }) {
  return (
    <>
      <KpiGrid overview={overview} />
      <PatientContextBar overview={overview} onNavigate={onNavigate} />
      <div className="dw2-main-grid">
        <QueuePanel queue={overview.queue} onNavigate={onNavigate} onRefresh={onRefresh} />
        <AppointmentPanel appointments={overview.appointments} encounters={overview.active_encounters} onNavigate={onNavigate} onRefresh={onRefresh} />
        <LiveEncounterPanel encounters={overview.active_encounters} onNavigate={onNavigate} onRefresh={onRefresh} />
        <ResultPanel results={overview.results} criticalResults={overview.critical_results} onNavigate={onNavigate} />
        <TaskPanel tasks={overview.tasks} onNavigate={onNavigate} />
      </div>
      <OrderPrescriptionPanel overview={overview} onNavigate={onNavigate} />
    </>
  )
}


function OverviewSubPage({ item, overview, onNavigate, onRefresh }) {
  if (item.key === 'waiting-for-me') {
    return (
      <>
        <PatientContextBar overview={overview} onNavigate={onNavigate} />
        <div className="dw2-workspace-layout">
          <div className="dw2-workspace-layout__main">
            <QueuePanel queue={overview.queue} onNavigate={onNavigate} onRefresh={onRefresh} />
            <LiveEncounterPanel encounters={overview.active_encounters} onNavigate={onNavigate} onRefresh={onRefresh} />
          </div>
          <aside className="dw2-workspace-layout__side">
            <Panel title="Logic backend áp dụng" subtitle="Màn hình này không dùng dữ liệu giả.">
              <div className="dw2-backend-logic">
                <span>QueueTicket.find theo doctor_id + queue_date hôm nay.</span>
                <span>Populate Patient và latest VitalSign.</span>
                <span>Ưu tiên ready_for_doctor_at, checkin_time, SLA và status.</span>
              </div>
            </Panel>
            <ActionPanel mode={GROUP_MODES.patients} onNavigate={onNavigate} disabled />
          </aside>
        </div>
      </>
    )
  }

  if (item.key === 'today-schedule') {
    return (
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <AppointmentPanel appointments={overview.appointments} encounters={overview.active_encounters} onNavigate={onNavigate} onRefresh={onRefresh} />
          <QueuePanel queue={overview.queue} onNavigate={onNavigate} onRefresh={onRefresh} />
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Timeline chuẩn khám" subtitle="Lịch hẹn → check-in → queue → encounter.">
            <div className="dw2-focus-list">
              <div><CheckCircle2 size={16} /><span>Hiển thị lịch theo giờ khám.</span></div>
              <div><CheckCircle2 size={16} /><span>Gắn trạng thái check-in/no-show nếu backend có dữ liệu.</span></div>
              <div><CheckCircle2 size={16} /><span>Mở nhanh encounter hoặc gọi bệnh nhân.</span></div>
            </div>
          </Panel>
          <TaskPanel tasks={overview.tasks} onNavigate={onNavigate} />
        </aside>
      </div>
    )
  }

  if (item.key === 'open-encounters') {
    return <DoctorEncounterFlowPage item={{ ...item, key: 'encounter-active' }} overview={overview} onNavigate={onNavigate} onRefresh={onRefresh} />
  }

  if (item.key === 'new-results') {
    return (
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <ResultPanel results={overview.results} criticalResults={overview.critical_results} onNavigate={onNavigate} />
          <TaskPanel tasks={overview.tasks} onNavigate={onNavigate} />
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Result safety" subtitle="Critical phải được acknowledge và có action note.">
            <div className="dw2-backend-logic">
              <span>LabResult, ImagingReport, ProcedureResult đã release/final.</span>
              <span>Lọc theo order hoặc encounter của bác sĩ.</span>
              <span>Đếm unread bằng doctor_viewed_at, critical bằng critical_acknowledged_at.</span>
            </div>
          </Panel>
        </aside>
      </div>
    )
  }

  if (item.key === 'pending-work') {
    return (
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <TaskPanel tasks={overview.tasks} onNavigate={onNavigate} />
          <LiveEncounterPanel encounters={overview.active_encounters} onNavigate={onNavigate} onRefresh={onRefresh} />
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Task inbox được tính từ backend" subtitle="Không phải menu tĩnh.">
            <div className="dw2-backend-logic">
              <span>Encounter thiếu note/chẩn đoán/care plan.</span>
              <span>Critical result chưa xử lý.</span>
              <span>Order đang chờ, đơn thuốc draft, refill request.</span>
            </div>
          </Panel>
          <OrderPrescriptionPanel overview={overview} onNavigate={onNavigate} />
        </aside>
      </div>
    )
  }

  return <DashboardView overview={overview} onNavigate={onNavigate} onRefresh={onRefresh} />
}

function DoctorPatientFlowPage({ item, overview, onNavigate }) {
  const queueRows = safeArray(overview.queue).map((ticket) => ({
    id: ticket.queue_ticket_id,
    patient: ticket.patient,
    status: ticket.status,
    primary: ticket.display_number || ticket.queue_number,
    meta: `Check-in ${formatTime(ticket.checkin_time)} · ${ticket.latest_vital ? `SpO2 ${ticket.latest_vital.spo2 || '--'}%` : 'Thiếu sinh hiệu'}`,
    action: '/doctor/encounters?view=start',
  }))
  const encounterRows = safeArray(overview.active_encounters).map((encounter) => ({
    id: encounter.encounter_id,
    patient: encounter.patient,
    status: encounter.status,
    primary: encounter.encounter_code,
    meta: `${encounter.readiness?.score || 0}% hoàn tất · ${safeArray(encounter.readiness?.missing).slice(0, 2).join(' · ') || 'Sẵn sàng hoàn tất'}`,
    action: `/doctor/encounters?view=active&encounterId=${encounter.encounter_id}`,
  }))
  const taskRows = safeArray(overview.tasks).filter((task) => task.patient).map((task) => ({
    id: task.task_id,
    patient: task.patient,
    status: task.priority,
    primary: task.title,
    meta: task.description,
    action: task.action_path || '/doctor/dashboard?panel=tasks',
  }))
  const historyRows = [
    ...safeArray(overview.appointments).map((appointment) => ({
      id: appointment.appointment_id,
      patient: appointment.patient,
      status: appointment.status,
      primary: formatDateTime(appointment.appointment_time),
      meta: appointment.reason || 'Lịch khám',
      action: '/doctor/schedules/today',
    })),
    ...safeArray(overview.results).map((result) => ({
      id: result.result_id,
      patient: result.patient,
      status: result.is_critical ? 'critical' : result.status,
      primary: result.title,
      meta: result.summary || formatDateTime(result.reported_at),
      action: `/doctor/results?view=new&resultId=${result.result_id}`,
    })),
  ]

  const rowsByKey = {
    'patients-waiting': queueRows,
    'patients-in-care': encounterRows,
    'patients-seen-today': safeArray(overview.appointments).filter((item) => ['completed', 'done'].includes(item.status)).map((appointment) => ({
      id: appointment.appointment_id,
      patient: appointment.patient,
      status: appointment.status,
      primary: formatDateTime(appointment.appointment_time),
      meta: appointment.reason || 'Đã hoàn tất lịch khám hôm nay',
      action: '/doctor/schedules/today',
    })),
    'follow-up-due': taskRows,
    'patient-history': historyRows,
  }
  const rows = rowsByKey[item.key] || queueRows

  return (
    <>
      <PatientContextBar overview={overview} onNavigate={onNavigate} />
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <Panel title={item.label} subtitle={item.description}>
            <div className="dw2-patient-flow-list">
              {!rows.length ? <EmptyState label="Chưa có bệnh nhân phù hợp với bộ lọc này." /> : rows.map((row) => (
                <button type="button" className="dw2-flow-card" key={row.id} onClick={() => onNavigate(row.action)}>
                  <span className="dw2-flow-card__avatar">{getInitials(row.patient?.full_name)}</span>
                  <span className="dw2-flow-card__body">
                    <strong>{row.patient?.full_name || 'Bệnh nhân'}</strong>
                    <small>{[row.patient?.patient_code, row.patient?.gender, row.patient?.age ? `${row.patient.age} tuổi` : null].filter(Boolean).join(' · ')}</small>
                    <em>{row.meta}</em>
                  </span>
                  <span className="dw2-flow-card__side">
                    <StatusPill tone={statusTone(row.status, row.status)}>{statusLabel(row.status)}</StatusPill>
                    <small>{row.primary}</small>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
          <TaskPanel tasks={overview.tasks} onNavigate={onNavigate} />
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Backend logic" subtitle="Mapping đúng từng tab bệnh nhân.">
            <div className="dw2-backend-logic">
              <span>Chờ khám: QueueTicket active + latest VitalSign.</span>
              <span>Đang khám: Encounter active/on-hold.</span>
              <span>Đã khám: Encounter/Appointment completed trong ngày.</span>
              <span>Follow-up: Task/refill/result cần xem lại.</span>
              <span>History: Encounter, result, prescription, appointment timeline.</span>
            </div>
          </Panel>
          <ActionPanel mode={GROUP_MODES.patients} onNavigate={onNavigate} />
        </aside>
      </div>
    </>
  )
}

function DoctorEncounterFlowPage({ item, overview, onNavigate, onRefresh }) {
  const activeEncounters = safeArray(overview.active_encounters)
  const queueCandidates = safeArray(overview.queue).filter((ticket) => !ticket.encounter_id)
  const subview = item.key

  if (subview === 'encounter-start') {
    return (
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <Panel title="Tạo / bắt đầu encounter" subtitle="Chọn bệnh nhân từ queue hoặc lịch hẹn đã check-in.">
            <div className="dw2-patient-flow-list">
              {!queueCandidates.length ? <EmptyState label="Không có bệnh nhân mới để bắt đầu encounter." /> : queueCandidates.map((ticket) => (
                <button type="button" className="dw2-flow-card" key={ticket.queue_ticket_id} onClick={() => onNavigate(`/doctor/encounters?view=note&patientId=${ticket.patient?.patient_id || ''}`)}>
                  <span className="dw2-flow-card__avatar">{getInitials(ticket.patient?.full_name)}</span>
                  <span className="dw2-flow-card__body">
                    <strong>{ticket.patient?.full_name || 'Bệnh nhân'}</strong>
                    <small>{[ticket.patient?.patient_code, ticket.patient?.gender, ticket.patient?.age ? `${ticket.patient.age} tuổi` : null].filter(Boolean).join(' · ')}</small>
                    <em>{ticket.latest_vital ? `Sinh hiệu đã có · SpO2 ${ticket.latest_vital.spo2 || '--'}%` : 'Cần kiểm tra sinh hiệu trước khi khám'}</em>
                  </span>
                  <span className="dw2-flow-card__side"><StatusPill>Bắt đầu</StatusPill><small>STT {ticket.display_number || ticket.queue_number}</small></span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
        <aside className="dw2-workspace-layout__side"><EncounterSafetyPanel /></aside>
      </div>
    )
  }

  const editorCopy = {
    'clinical-note': ['SOAP note', 'Autosave draft', 'Ký note', 'Chèn vitals/result vào note'],
    diagnosis: ['Chẩn đoán chính', 'Chẩn đoán phụ', 'ICD code', 'Chẩn đoán phân biệt'],
    'problem-list': ['Problem active', 'Resolved', 'Bệnh mạn', 'Risk factor'],
    'care-plan': ['Kế hoạch điều trị', 'Dặn dò', 'Tái khám', 'Theo dõi tại nhà'],
    consultation: ['Tạo hội chẩn', 'Gửi bác sĩ/khoa khác', 'Nhận recommendation', 'Chèn vào note'],
    'complete-encounter': ['Pre-submit review', 'Clinical note signed', 'Diagnosis chính', 'Không còn draft/order chờ'],
  }[subview]

  return (
    <>
      <PatientContextBar overview={overview} onNavigate={onNavigate} />
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <LiveEncounterPanel encounters={activeEncounters} onNavigate={onNavigate} onRefresh={onRefresh} />
          {editorCopy ? (
            <Panel title={item.label} subtitle={item.description}>
              <div className="dw2-encounter-editor-grid">
                {editorCopy.map((entry, index) => (
                  <button type="button" key={entry} onClick={() => onNavigate(index < 2 ? '/doctor/encounters?view=note' : '/doctor/encounters?view=complete')}>
                    {index === 0 ? <FileSignature size={18} /> : index === 1 ? <ClipboardCheck size={18} /> : index === 2 ? <ShieldCheck size={18} /> : <Send size={18} />}
                    <span>{entry}</span>
                  </button>
                ))}
              </div>
              <div className="dw2-blueprint-grid">
                <div><h4>Data đọc từ DB</h4><p>Encounter, ClinicalNote, Diagnosis, ProblemList, CarePlan, Consultation, Order, Prescription.</p></div>
                <div><h4>Write API nên dùng</h4><p>Các controller hiện có: encounter, clinical, order, prescription. Backend patch kèm thêm endpoint tổng hợp read theo view.</p></div>
                <div><h4>Chuẩn an toàn</h4><p>Không cho hoàn tất nếu thiếu note ký, chẩn đoán chính, care plan hoặc còn draft/order chưa xử lý.</p></div>
              </div>
            </Panel>
          ) : null}
          <TaskPanel tasks={overview.tasks} onNavigate={onNavigate} />
        </div>
        <aside className="dw2-workspace-layout__side">
          <EncounterSafetyPanel />
          <FocusPanel mode={GROUP_MODES.encounter} />
        </aside>
      </div>
    </>
  )
}

function EncounterSafetyPanel() {
  return (
    <Panel title="Safety gate" subtitle="Điều kiện tối thiểu trước khi kết thúc khám.">
      <div className="dw2-focus-list">
        <div><CheckCircle2 size={16} /><span>Clinical note đã ký.</span></div>
        <div><CheckCircle2 size={16} /><span>Có chẩn đoán chính.</span></div>
        <div><CheckCircle2 size={16} /><span>Có care plan / dặn dò.</span></div>
        <div><CheckCircle2 size={16} /><span>Không còn đơn thuốc draft hoặc order đang treo.</span></div>
      </div>
    </Panel>
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

function ActionPanel({ mode, onNavigate, disabled = false }) {
  return (
    <Panel title="Quick actions" subtitle="Các lệnh chính giữ cố định theo ngữ cảnh màn hình.">
      <div className="dw2-action-grid">
        {mode.primaryActions.map((action, index) => (
          <button
            type="button"
            key={action}
            disabled={disabled}
            title={disabled ? 'Thao tac kham thuc hien truc tiep trong Encounter dang mo.' : action}
            onClick={() => {
              if (disabled) return
              onNavigate(index < 2 ? '/doctor/encounters?view=active' : '/doctor/orders?view=create')
            }}
          >
            {index === 0 ? <PlusCircle size={18} /> : index === 1 ? <FileSignature size={18} /> : index === 2 ? <ClipboardList size={18} /> : <Send size={18} />}
            <span>{action}</span>
          </button>
        ))}
      </div>
    </Panel>
  )
}

function activeEncounterIdOf(row = {}) {
  return row?.encounter_id || row?._id || row?.id || ''
}

function activeEncounterFromOverview(overview, encounterId = '') {
  const encounters = safeArray(overview.active_encounters)
  if (encounterId) {
    return encounters.find((row) => activeEncounterIdOf(row) === encounterId) || null
  }
  return encounters[0] || null
}

function QuickOrderCreatePanel({ overview, onRefresh }) {
  const location = useLocation()
  const encounterId = new URLSearchParams(location.search).get('encounterId') || ''
  const selectedEncounter = activeEncounterFromOverview(overview, encounterId)
  const selectedEncounterId = activeEncounterIdOf(selectedEncounter)
  const [form, setForm] = useState({
    order_type: 'lab',
    priority: 'routine',
    clinical_indication: '',
    test_name: '',
    modality: 'xray',
    body_part: '',
    contrast_required: false,
    procedure_name: '',
  })
  const [notice, setNotice] = useState({ error: '', success: '' })
  const [busy, setBusy] = useState(false)

  async function submitOrder(event) {
    event.preventDefault()
    if (!selectedEncounterId) {
      setNotice({ error: 'Cần tạo hoặc bắt đầu encounter trước khi tạo chỉ định.', success: '' })
      return
    }
    setBusy(true)
    setNotice({ error: '', success: '' })
    try {
      const payload = {
        order_type: form.order_type,
        priority: form.priority,
        clinical_indication: form.clinical_indication,
      }
      if (form.order_type === 'lab') payload.test_name = form.test_name
      if (form.order_type === 'imaging') {
        payload.modality = form.modality
        payload.body_part = form.body_part
        payload.contrast_required = form.contrast_required
      }
      if (form.order_type === 'procedure') payload.procedure_name = form.procedure_name
      await orderAPI.createForEncounter(selectedEncounterId, payload)
      setNotice({ error: '', success: 'Đã tạo chỉ định cho encounter đang khám.' })
      setForm((current) => ({ ...current, clinical_indication: '', test_name: '', body_part: '', procedure_name: '', contrast_required: false }))
      onRefresh?.()
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Không tạo được chỉ định.'), success: '' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Tạo chỉ định" subtitle="Gọi POST /api/encounters/:encounterId/orders cho encounter đang chọn.">
      {notice.error || notice.success ? <div className={`dw2-command-notice ${notice.error ? 'is-error' : 'is-success'}`}>{notice.error || notice.success}</div> : null}
      {!selectedEncounterId ? <EmptyState label="Chưa có encounter đang mở. Hãy tạo hoặc bắt đầu encounter trước." /> : (
        <form className="dw2-command-form" onSubmit={submitOrder}>
          <label><span>Encounter</span><input value={selectedEncounter?.encounter_code || selectedEncounterId} readOnly /></label>
          <label><span>Loại chỉ định</span><select value={form.order_type} onChange={(event) => setForm((current) => ({ ...current, order_type: event.target.value }))}><option value="lab">Xét nghiệm</option><option value="imaging">CĐHA</option><option value="procedure">Thủ thuật</option></select></label>
          <label><span>Ưu tiên</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">STAT</option></select></label>
          <label><span>Chỉ định lâm sàng</span><textarea rows={3} value={form.clinical_indication} onChange={(event) => setForm((current) => ({ ...current, clinical_indication: event.target.value }))} required /></label>
          {form.order_type === 'lab' ? <label><span>Tên xét nghiệm</span><input value={form.test_name} onChange={(event) => setForm((current) => ({ ...current, test_name: event.target.value }))} required /></label> : null}
          {form.order_type === 'imaging' ? (
            <>
              <label><span>Modality</span><select value={form.modality} onChange={(event) => setForm((current) => ({ ...current, modality: event.target.value }))}><option value="xray">X-ray</option><option value="ct">CT</option><option value="mri">MRI</option><option value="ultrasound">Ultrasound</option></select></label>
              <label><span>Vùng khảo sát</span><input value={form.body_part} onChange={(event) => setForm((current) => ({ ...current, body_part: event.target.value }))} required /></label>
              <label><span>Cản quang</span><input type="checkbox" checked={form.contrast_required} onChange={(event) => setForm((current) => ({ ...current, contrast_required: event.target.checked }))} /></label>
            </>
          ) : null}
          {form.order_type === 'procedure' ? <label><span>Tên thủ thuật</span><input value={form.procedure_name} onChange={(event) => setForm((current) => ({ ...current, procedure_name: event.target.value }))} required /></label> : null}
          <button type="submit" className="dw2-command-button dw2-tone-success" disabled={busy}>{busy ? 'Đang tạo...' : 'Tạo chỉ định'}</button>
        </form>
      )}
    </Panel>
  )
}

function QuickPrescriptionCreatePanel({ overview, onRefresh }) {
  const location = useLocation()
  const encounterId = new URLSearchParams(location.search).get('encounterId') || ''
  const selectedEncounter = activeEncounterFromOverview(overview, encounterId)
  const selectedEncounterId = activeEncounterIdOf(selectedEncounter)
  const [form, setForm] = useState({
    medication_id: '',
    dose: '',
    route: 'oral',
    frequency: '',
    duration_days: '1',
    quantity: '1',
    unit: 'viên',
    instructions: '',
    note: '',
    status: 'draft',
  })
  const [notice, setNotice] = useState({ error: '', success: '' })
  const [busy, setBusy] = useState(false)

  async function submitPrescription(event) {
    event.preventDefault()
    if (!selectedEncounterId) {
      setNotice({ error: 'Cần tạo hoặc bắt đầu encounter trước khi kê đơn.', success: '' })
      return
    }
    setBusy(true)
    setNotice({ error: '', success: '' })
    try {
      await prescriptionAPI.createForEncounter(selectedEncounterId, {
        status: form.status,
        note: form.note,
        items: [{
          medication_id: form.medication_id,
          dose: form.dose,
          route: form.route,
          frequency: form.frequency,
          duration_days: Number(form.duration_days),
          quantity: Number(form.quantity),
          unit: form.unit,
          instructions: form.instructions,
        }],
      })
      setNotice({ error: '', success: 'Đã tạo đơn thuốc cho encounter đang khám.' })
      setForm((current) => ({ ...current, medication_id: '', dose: '', frequency: '', instructions: '', note: '' }))
      onRefresh?.()
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Không tạo được đơn thuốc.'), success: '' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Kê đơn" subtitle="Gọi POST /api/prescriptions/encounters/:encounterId/prescriptions kèm item thuốc.">
      {notice.error || notice.success ? <div className={`dw2-command-notice ${notice.error ? 'is-error' : 'is-success'}`}>{notice.error || notice.success}</div> : null}
      {!selectedEncounterId ? <EmptyState label="Chưa có encounter đang mở. Hãy tạo hoặc bắt đầu encounter trước." /> : (
        <form className="dw2-command-form" onSubmit={submitPrescription}>
          <label><span>Encounter</span><input value={selectedEncounter?.encounter_code || selectedEncounterId} readOnly /></label>
          <label><span>Medication ID</span><input value={form.medication_id} onChange={(event) => setForm((current) => ({ ...current, medication_id: event.target.value }))} required /></label>
          <label><span>Liều</span><input value={form.dose} onChange={(event) => setForm((current) => ({ ...current, dose: event.target.value }))} required /></label>
          <label><span>Đường dùng</span><input value={form.route} onChange={(event) => setForm((current) => ({ ...current, route: event.target.value }))} required /></label>
          <label><span>Tần suất</span><input value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))} required /></label>
          <label><span>Số ngày</span><input type="number" min="1" value={form.duration_days} onChange={(event) => setForm((current) => ({ ...current, duration_days: event.target.value }))} required /></label>
          <label><span>Số lượng</span><input type="number" min="1" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} required /></label>
          <label><span>Đơn vị</span><input value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} required /></label>
          <label><span>Hướng dẫn</span><textarea rows={2} value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} /></label>
          <label><span>Ghi chú đơn</span><textarea rows={2} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label>
          <label><span>Trạng thái</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">Draft</option><option value="active">Active</option></select></label>
          <button type="submit" className="dw2-command-button dw2-tone-success" disabled={busy}>{busy ? 'Đang kê...' : 'Kê đơn'}</button>
        </form>
      )}
    </Panel>
  )
}

function GenericWorkspacePage({ group, item, mode, overview, onNavigate, onRefresh }) {
  const isResults = group.id === 'results'
  const isOrders = group.id === 'orders'
  const isPrescriptions = group.id === 'prescriptions'
  const isEncounter = group.id === 'encounter'
  const isPatients = group.id === 'patients'
  const isClinicalRecords = group.id === 'clinical-records'
  const isOverview = group.id === 'overview'

  if (isOverview) {
    return <OverviewSubPage item={item} overview={overview} onNavigate={onNavigate} onRefresh={onRefresh} />
  }

  if (isPatients) {
    return <DoctorPatientCommandPage item={item} overview={overview} onNavigate={onNavigate} onRefresh={onRefresh} />
  }

  if (isEncounter) {
    return <DoctorEncounterCommandPage item={item} overview={overview} onNavigate={onNavigate} onRefresh={onRefresh} />
  }

  if (isClinicalRecords) {
    return <DoctorClinicalRecordsCommandPage item={item} overview={overview} onNavigate={onNavigate} onRefresh={onRefresh} />
  }

  if (isClinicalRecords) {
    return (
      <>
        <PatientContextBar overview={overview} onNavigate={onNavigate} />
        <Panel title={item.label} subtitle={item.description}>
          <div className="dw2-blueprint-grid">
            <div><h4>Backend đọc</h4><p>/doctor-workspace/patients/:patientId/summary đang tổng hợp allergy, problem, vitals, encounter, diagnosis, prescription, lab result, attachment và consent.</p></div>
            <div><h4>UI nên có</h4><p>Patient summary, timeline, allergy banner, vital trends, documents, consent/access và release status.</p></div>
            <div><h4>Thao tác</h4><p>Chèn vào note, yêu cầu đo lại, tạo follow-up, export/release hồ sơ nếu có quyền.</p></div>
          </div>
        </Panel>
      </>
    )
  }

  return (
    <>
      <PatientContextBar overview={overview} onNavigate={onNavigate} />
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          {isOrders ? (item.key === 'create-order' ? <QuickOrderCreatePanel overview={overview} onRefresh={onRefresh} /> : <OrderPrescriptionPanel overview={overview} onNavigate={onNavigate} />) : null}
          {isResults ? <ResultPanel results={overview.results} criticalResults={item.key === 'critical-results' ? overview.critical_results : []} onNavigate={onNavigate} /> : null}
          {isPrescriptions ? (item.key === 'create-prescription' ? <QuickPrescriptionCreatePanel overview={overview} onRefresh={onRefresh} /> : <OrderPrescriptionPanel overview={overview} onNavigate={onNavigate} />) : null}
          {!isOrders && !isResults && !isPrescriptions ? (
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

  const loadOverview = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await doctorWorkspaceAPI.overview({ date: todayString() })
      setOverview({ ...EMPTY_OVERVIEW, ...unwrapData(response) })
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError, 'Không tải được Doctor Workspace.'))
      setOverview((current) => ({ ...EMPTY_OVERVIEW, ...current }))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        loadOverview({ silent: true })
      }
    }, 15000)

    function handleVisibilityChange() {
      if (!document.hidden) {
        loadOverview({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadOverview])

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
        overview={overview}
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
            compact={active.group?.id === 'encounter'}
          />
          {(active.item?.key === 'dashboard' || routeSignature(location) === '/doctor/dashboard') ? (
            <DashboardView overview={overview} onNavigate={handleNavigate} onRefresh={loadOverview} />
          ) : (
            <GenericWorkspacePage group={active.group} item={active.item} mode={mode} overview={overview} onNavigate={handleNavigate} onRefresh={loadOverview} />
          )}
        </main>
      </div>
    </div>
  )
}
