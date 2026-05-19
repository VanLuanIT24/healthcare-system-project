import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  FlaskConical,
  Image as ImageIcon,
  Info,
  Link2,
  MoreVertical,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Scissors,
  XCircle,
} from 'lucide-react'
import { doctorApi, getDoctorId } from './doctorApi'
import { getInitials, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5

const PROCESSING_STATUSES = new Set([
  'pending',
  'ordered',
  'dispatched',
  'acknowledged',
  'accepted',
  'started',
  'in_progress',
  'processing',
  'collected',
])
const COMPLETE_STATUSES = new Set(['completed', 'complete', 'done', 'result_ready', 'resulted'])
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', 'voided'])
const NOT_STARTED_STATUSES = new Set(['draft', 'created', 'new', 'requested'])

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('vi-VN')
}

function formatTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function orderIdOf(order = {}) {
  return order.order_id || order.id || order._id || ''
}

function patientName(order = {}) {
  return order.patient_name || order.patient?.full_name || order.patient?.name || 'Bệnh nhân'
}

function orderCode(order = {}, index = 0) {
  return order.order_code || order.code || orderIdOf(order) || `ORD-${String(index + 1).padStart(3, '0')}`
}

function statusGroup(status) {
  const normalized = String(status || '').toLowerCase()
  if (COMPLETE_STATUSES.has(normalized)) return 'completed'
  if (CANCELLED_STATUSES.has(normalized)) return 'cancelled'
  if (PROCESSING_STATUSES.has(normalized)) return 'processing'
  return 'not_started'
}

function statusInfo(status) {
  const group = statusGroup(status)
  if (group === 'completed') return { label: 'Hoàn tất', tone: 'green', group }
  if (group === 'cancelled') return { label: 'Đã hủy', tone: 'red', group }
  if (group === 'processing') return { label: 'Đang xử lý', tone: 'orange', group }
  return { label: 'Chưa bắt đầu', tone: 'purple', group }
}

function typeInfo(type) {
  const normalized = String(type || '').toLowerCase()
  if (['imaging', 'diagnostic_imaging', 'radiology', 'image'].includes(normalized)) {
    return { label: 'Chẩn đoán hình ảnh', tone: 'blue', icon: ImageIcon }
  }
  if (['procedure', 'surgery', 'minor_procedure'].includes(normalized)) {
    return { label: 'Thủ thuật', tone: 'teal', icon: Scissors }
  }
  if (['medication', 'drug', 'pharmacy'].includes(normalized)) {
    return { label: 'Thuốc', tone: 'green', icon: FileText }
  }
  return { label: 'Xét nghiệm', tone: 'purple', icon: FlaskConical }
}

function serviceName(order = {}) {
  const items = safeArray(order.items)
  return order.service_name
    || order.service?.service_name
    || order.title
    || items[0]?.service_name
    || items[0]?.name
    || order.clinical_diagnosis
    || 'Dịch vụ chỉ định'
}

function roomName(order = {}) {
  return order.room_name
    || order.clinic_room
    || order.room?.room_name
    || order.receiving_department_name
    || order.department_name
    || '--'
}

function orderTime(order = {}) {
  return order.created_at || order.ordered_at || order.requested_at || order.updated_at || ''
}

function encounterIdOf(order = {}) {
  return order.encounter_id || order.encounter?.encounter_id || order.encounter?.id || ''
}

function encounterCodeOf(order = {}) {
  return order.encounter_code || order.encounter?.encounter_code || encounterIdOf(order) || '--'
}

function doctorName(order = {}) {
  return order.doctor_name || order.doctor?.full_name || order.requested_by_name || 'Bác sĩ'
}

function encounterRoom(order = {}) {
  return order.encounter_room || order.room_name || order.clinic_room || order.department_name || 'PK 101'
}

function encounterStatusFromOrders(orders = []) {
  if (!orders.length) return 'not_started'
  if (orders.some((order) => statusGroup(order.status) === 'processing')) return 'processing'
  if (orders.every((order) => statusGroup(order.status) === 'completed')) return 'completed'
  if (orders.every((order) => statusGroup(order.status) === 'cancelled')) return 'cancelled'
  return 'not_started'
}

function waitMinutes(order = {}) {
  const created = new Date(orderTime(order))
  if (Number.isNaN(created.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - created.getTime()) / 60000))
}

function waitLabel(minutes) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`
  }
  return `${minutes} phút`
}

function priorityInfo(order = {}) {
  const normalized = String(order.priority || order.urgency || '').toLowerCase()
  if (['stat', 'urgent', 'high', 'cao', 'emergency'].includes(normalized)) return { label: 'Cao', tone: 'red', score: 3 }
  if (['medium', 'normal', 'routine', 'trung_binh', 'trung bình'].includes(normalized)) return { label: 'Trung bình', tone: 'orange', score: 2 }
  return { label: 'Thấp', tone: 'green', score: 1 }
}

function pendingBucket(order = {}) {
  const status = String(order.status || '').toLowerCase()
  const minutes = waitMinutes(order)
  if (minutes >= 60 || order.is_overdue) return 'overdue'
  if (NOT_STARTED_STATUSES.has(status)) return 'confirm'
  if (['pending', 'ordered', 'dispatched'].includes(status)) return 'dispatch'
  if (['acknowledged', 'accepted', 'started', 'in_progress', 'processing', 'collected'].includes(status)) return 'performing'
  return 'confirm'
}

function pendingStatusInfo(order = {}) {
  const bucket = pendingBucket(order)
  if (bucket === 'overdue') return { label: 'Quá hạn', tone: 'red', bucket }
  if (bucket === 'dispatch') return { label: 'Chờ gửi xử lý', tone: 'orange', bucket }
  if (bucket === 'performing') return { label: 'Đang thực hiện', tone: 'green', bucket }
  return { label: 'Chờ xác nhận', tone: 'blue', bucket }
}

function matchSearch(order, keyword) {
  if (!keyword) return true
  const haystack = [
    orderCode(order),
    patientName(order),
    order.patient_code,
    order.encounter_code,
    serviceName(order),
    order.clinical_diagnosis,
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(keyword.toLowerCase())
}

function matchDateRange(order, value) {
  if (value === 'all') return true
  const created = new Date(orderTime(order))
  if (Number.isNaN(created.getTime())) return false
  const now = new Date()
  const diffDays = (now.getTime() - created.getTime()) / 86400000
  if (value === 'today') return created.toDateString() === now.toDateString()
  if (value === '7d') return diffDays <= 7
  if (value === '30d') return diffDays <= 30
  return true
}

function KpiCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <article className="doctor-order-list-kpi">
      <span className={`doctor-order-list-kpi__icon is-${tone}`}>
        <Icon size={28} strokeWidth={2.1} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  )
}

function PatientAvatar({ name, size = 'sm' }) {
  return <span className={`doctor-order-list-avatar is-${size}`}>{getInitials(name) || 'BN'}</span>
}

function StatusBadge({ status }) {
  const meta = statusInfo(status)
  return <span className={`doctor-order-list-status is-${meta.tone}`}>{meta.label}</span>
}

function TypeBadge({ type }) {
  const meta = typeInfo(type)
  return <span className={`doctor-order-list-type is-${meta.tone}`}>{meta.label}</span>
}

function Donut({ stats }) {
  const total = stats.total || 1
  const processingEnd = percent(stats.processing, total)
  const completedEnd = processingEnd + percent(stats.completed, total)
  const cancelledEnd = completedEnd + percent(stats.cancelled, total)
  return (
    <div
      className="doctor-order-list-donut"
      style={{
        '--processing-end': `${processingEnd}%`,
        '--completed-end': `${completedEnd}%`,
        '--cancelled-end': `${cancelledEnd}%`,
      }}
    >
      <div>
        <strong>{stats.total}</strong>
        <span>Tổng chỉ định</span>
      </div>
    </div>
  )
}

function EncounterDonut({ stats }) {
  const total = stats.total || 1
  const completedEnd = percent(stats.completed, total)
  const processingEnd = completedEnd + percent(stats.processing, total)
  const signedEnd = processingEnd + percent(stats.needSignature, total)
  return (
    <div
      className="doctor-order-encounter-donut"
      style={{
        '--completed-end': `${completedEnd}%`,
        '--processing-end': `${processingEnd}%`,
        '--signed-end': `${signedEnd}%`,
      }}
    >
      <div>
        <strong>{stats.total}</strong>
        <span>Tổng chỉ định</span>
      </div>
    </div>
  )
}

function PendingDonut({ stats }) {
  const total = stats.total || 1
  const confirmEnd = percent(stats.confirm, total)
  const dispatchEnd = confirmEnd + percent(stats.dispatch, total)
  const performingEnd = dispatchEnd + percent(stats.performing, total)
  const overdueEnd = performingEnd + percent(stats.overdue, total)
  return (
    <div
      className="doctor-order-pending-donut"
      style={{
        '--confirm-end': `${confirmEnd}%`,
        '--dispatch-end': `${dispatchEnd}%`,
        '--performing-end': `${performingEnd}%`,
        '--overdue-end': `${overdueEnd}%`,
      }}
    >
      <div>
        <strong>{stats.total}</strong>
        <span>Tổng chỉ định</span>
      </div>
    </div>
  )
}

function buildEncounterGroups(orders = []) {
  const groups = new Map()
  orders.forEach((order) => {
    const key = encounterIdOf(order) || encounterCodeOf(order)
    if (!key || key === '--') return
    const existing = groups.get(key) || {
      id: encounterIdOf(order),
      code: encounterCodeOf(order),
      patientName: patientName(order),
      patientCode: order.patient_code || '',
      patientPhone: order.patient_phone || order.patient?.phone || '',
      patientGender: order.patient_gender || '',
      patientAge: order.patient_age || '',
      doctorName: doctorName(order),
      room: encounterRoom(order),
      firstTime: orderTime(order),
      orders: [],
    }
    existing.orders.push(order)
    if (!existing.id) existing.id = encounterIdOf(order)
    if (!existing.firstTime || new Date(orderTime(order)) < new Date(existing.firstTime)) {
      existing.firstTime = orderTime(order)
    }
    groups.set(key, existing)
  })

  return Array.from(groups.values()).map((group) => {
    const completed = group.orders.filter((order) => statusGroup(order.status) === 'completed').length
    const processing = group.orders.filter((order) => statusGroup(order.status) === 'processing').length
    const cancelled = group.orders.filter((order) => statusGroup(order.status) === 'cancelled').length
    const needSignature = group.orders.filter((order) => statusGroup(order.status) === 'not_started').length
    return {
      ...group,
      total: group.orders.length,
      completed,
      processing,
      cancelled,
      needSignature,
      status: encounterStatusFromOrders(group.orders),
    }
  })
}

export function DoctorOrdersScreen({ user }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const searchParamKey = searchParams.toString()
  const [today] = useState(getTodayDate)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') || 'all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('7d')
  const [selectedId, setSelectedId] = useState('')
  const [selectedEncounterKey, setSelectedEncounterKey] = useState('')
  const [encounterDetail, setEncounterDetail] = useState({ loading: false, orders: [], summary: null })
  const [actionBusy, setActionBusy] = useState('')
  const [state, setState] = useState({ loading: true, error: '', orders: [], pagination: null })

  const doctorId = getDoctorId(user)
  const ordersView = searchParams.get('view') || 'list'
  const isEncounterView = ordersView === 'encounter'
  const isPendingView = ordersView === 'pending'

  useEffect(() => {
    const type = searchParams.get('type') || 'all'
    const view = searchParams.get('view')
    setTypeFilter(type)
    setStatusFilter(view === 'pending' ? 'all' : 'all')
    setPriorityFilter('all')
    setRoomFilter('all')
    setPage(1)
  }, [searchParamKey])

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))

    if (!doctorId) {
      setState({ loading: false, error: 'Không tìm thấy mã bác sĩ hiện tại.', orders: [], pagination: null })
      return undefined
    }

    doctorApi.orders.listByDoctorPage(doctorId, {
      page: 1,
      limit: 500,
      sort_by: 'created_at',
      sort_order: 'desc',
    })
      .then((payload) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          orders: safeArray(payload?.items),
          pagination: payload?.pagination || null,
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải danh sách chỉ định.'),
          orders: [],
          pagination: null,
        })
      })

    return () => {
      active = false
    }
  }, [doctorId, reloadKey])

  const orderTypes = useMemo(
    () => Array.from(new Set(state.orders.map((order) => order.order_type || 'lab').filter(Boolean))),
    [state.orders],
  )

  const roomOptions = useMemo(
    () => Array.from(new Set(state.orders.map(roomName).filter((value) => value && value !== '--'))),
    [state.orders],
  )

  const filteredOrders = useMemo(
    () => state.orders.filter((order) => {
      const group = statusGroup(order.status)
      const type = String(order.order_type || 'lab').toLowerCase()
      return matchSearch(order, searchTerm.trim())
        && (statusFilter === 'all' || group === statusFilter)
        && (typeFilter === 'all' || type === String(typeFilter).toLowerCase())
        && matchDateRange(order, dateFilter)
    }),
    [dateFilter, searchTerm, state.orders, statusFilter, typeFilter],
  )

  const total = filteredOrders.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const displayOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const stats = useMemo(() => {
    const source = state.orders
    const totalOrders = Number(state.pagination?.total ?? source.length)
    const processing = source.filter((order) => statusGroup(order.status) === 'processing').length
    const completed = source.filter((order) => statusGroup(order.status) === 'completed').length
    const cancelled = source.filter((order) => statusGroup(order.status) === 'cancelled').length
    return {
      total: totalOrders,
      processing,
      completed,
      cancelled,
      notStarted: Math.max(0, totalOrders - processing - completed - cancelled),
    }
  }, [state.orders, state.pagination])

  const encounterGroups = useMemo(
    () => buildEncounterGroups(state.orders)
      .filter((group) => {
        const keyword = searchTerm.trim().toLowerCase()
        const haystack = [
          group.code,
          group.patientName,
          group.patientPhone,
          group.doctorName,
          group.room,
        ].filter(Boolean).join(' ').toLowerCase()
        return (!keyword || haystack.includes(keyword))
          && (statusFilter === 'all' || group.status === statusFilter)
          && (typeFilter === 'all' || group.orders.some((order) => String(order.order_type || 'lab').toLowerCase() === String(typeFilter).toLowerCase()))
          && group.orders.some((order) => matchDateRange(order, dateFilter))
      })
      .sort((left, right) => new Date(right.firstTime || 0) - new Date(left.firstTime || 0)),
    [dateFilter, searchTerm, state.orders, statusFilter, typeFilter],
  )

  const encounterTotal = encounterGroups.length
  const encounterTotalPages = Math.max(1, Math.ceil(encounterTotal / PAGE_SIZE))
  const displayEncounters = encounterGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedEncounter = encounterGroups.find((group) => (group.id || group.code) === selectedEncounterKey) || encounterGroups[0] || null

  const encounterStats = useMemo(() => {
    const groups = buildEncounterGroups(state.orders)
    const withOrders = groups.filter((group) => group.total > 0).length
    return {
      totalEncounters: groups.length,
      withOrders,
      totalOrders: groups.reduce((sum, group) => sum + group.total, 0),
      processing: groups.reduce((sum, group) => sum + group.processing, 0),
      completed: groups.reduce((sum, group) => sum + group.completed, 0),
      cancelled: groups.reduce((sum, group) => sum + group.cancelled, 0),
      needSignature: groups.reduce((sum, group) => sum + group.needSignature, 0),
    }
  }, [state.orders])

  const selectedOrders = encounterDetail.orders.length ? encounterDetail.orders : safeArray(selectedEncounter?.orders)
  const selectedSummary = encounterDetail.summary || {}
  const selectedOrderStats = {
    total: Number(selectedSummary.total_orders ?? selectedSummary.total ?? selectedOrders.length),
    completed: Number(selectedSummary.completed_orders ?? selectedSummary.completed ?? selectedOrders.filter((order) => statusGroup(order.status) === 'completed').length),
    processing: Number(selectedSummary.processing_orders ?? selectedSummary.processing ?? selectedOrders.filter((order) => statusGroup(order.status) === 'processing').length),
    cancelled: Number(selectedSummary.cancelled_orders ?? selectedSummary.cancelled ?? selectedOrders.filter((order) => statusGroup(order.status) === 'cancelled').length),
    needSignature: Number(selectedSummary.pending_signature_orders ?? selectedSummary.need_signature ?? selectedOrders.filter((order) => statusGroup(order.status) === 'not_started').length),
  }

  const pendingOrders = useMemo(
    () => state.orders
      .filter((order) => !['completed', 'cancelled'].includes(statusGroup(order.status)))
      .filter((order) => {
        const bucket = pendingBucket(order)
        const type = String(order.order_type || 'lab').toLowerCase()
        const priority = priorityInfo(order).tone
        return matchSearch(order, searchTerm.trim())
          && (statusFilter === 'all' || bucket === statusFilter)
          && (typeFilter === 'all' || type === String(typeFilter).toLowerCase())
          && (priorityFilter === 'all' || priority === priorityFilter)
          && (roomFilter === 'all' || roomName(order) === roomFilter)
      })
      .sort((left, right) => {
        const leftPriority = priorityInfo(left).score
        const rightPriority = priorityInfo(right).score
        if (rightPriority !== leftPriority) return rightPriority - leftPriority
        return waitMinutes(right) - waitMinutes(left)
      }),
    [priorityFilter, roomFilter, searchTerm, state.orders, statusFilter, typeFilter],
  )

  const pendingTotal = pendingOrders.length
  const pendingTotalPages = Math.max(1, Math.ceil(pendingTotal / PAGE_SIZE))
  const displayPendingOrders = pendingOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const pendingStats = useMemo(() => {
    const source = state.orders.filter((order) => !['completed', 'cancelled'].includes(statusGroup(order.status)))
    const confirm = source.filter((order) => pendingBucket(order) === 'confirm').length
    const dispatch = source.filter((order) => pendingBucket(order) === 'dispatch').length
    const performing = source.filter((order) => pendingBucket(order) === 'performing').length
    const overdue = source.filter((order) => pendingBucket(order) === 'overdue').length
    const averageWait = source.length
      ? Math.round(source.reduce((sum, order) => sum + waitMinutes(order), 0) / source.length)
      : 0
    const byType = source.reduce((acc, order) => {
      const label = typeInfo(order.order_type).label
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {})
    return {
      total: source.length,
      confirm,
      dispatch,
      performing,
      overdue,
      other: Math.max(0, source.length - confirm - dispatch - performing - overdue),
      averageWait,
      byType: Object.entries(byType).sort((left, right) => right[1] - left[1]).slice(0, 4),
    }
  }, [state.orders])

  useEffect(() => {
    if (isEncounterView) {
      setPage((current) => Math.min(current, encounterTotalPages))
    } else if (isPendingView) {
      setPage((current) => Math.min(current, pendingTotalPages))
    }
  }, [encounterTotalPages, isEncounterView, isPendingView, pendingTotalPages])

  useEffect(() => {
    if (!isEncounterView) return
    if (!selectedEncounterKey && encounterGroups[0]) {
      setSelectedEncounterKey(encounterGroups[0].id || encounterGroups[0].code)
    }
  }, [encounterGroups, isEncounterView, selectedEncounterKey])

  useEffect(() => {
    if (!isEncounterView || !selectedEncounter?.id) {
      setEncounterDetail({ loading: false, orders: [], summary: null })
      return undefined
    }

    let active = true
    setEncounterDetail((current) => ({ ...current, loading: true }))
    Promise.all([
      doctorApi.orders.listByEncounter(selectedEncounter.id, { limit: 100 }),
      doctorApi.orders.getEncounterSummary(selectedEncounter.id),
    ])
      .then(([orders, summary]) => {
        if (active) {
          setEncounterDetail({ loading: false, orders: safeArray(orders), summary: summary || null })
        }
      })
      .catch((error) => {
        if (active) {
          setEncounterDetail({ loading: false, orders: safeArray(selectedEncounter.orders), summary: null })
          toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết chỉ định của encounter.'))
        }
      })

    return () => {
      active = false
    }
  }, [isEncounterView, selectedEncounter?.id, selectedEncounterKey])

  async function reload() {
    setReloadKey((current) => current + 1)
  }

  async function openOrder(order) {
    const id = orderIdOf(order)
    if (!id) {
      toast.error('Không tìm thấy mã chỉ định.')
      return
    }
    setSelectedId(id)
    try {
      await Promise.all([
        doctorApi.orders.getDetail(id),
        doctorApi.orders.getTimeline(id),
      ])
      toast.info('Đã tải chi tiết và timeline chỉ định từ API.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết chỉ định.'))
    }
  }

  async function runAction(order, action) {
    const id = orderIdOf(order)
    if (!id) {
      toast.error('Không tìm thấy mã chỉ định.')
      return
    }

    const actionMap = {
      dispatch: { label: 'gửi xử lý', request: () => doctorApi.orders.dispatch(id) },
      acknowledge: { label: 'xác nhận', request: () => doctorApi.orders.acknowledge(id) },
      start: { label: 'bắt đầu xử lý', request: () => doctorApi.orders.start(id) },
      complete: { label: 'hoàn tất', request: () => doctorApi.orders.complete(id) },
      cancel: { label: 'hủy', request: () => doctorApi.orders.cancel(id, { reason: 'Cancelled from doctor dashboard' }) },
    }
    const selected = actionMap[action]
    if (!selected) return

    setActionBusy(`${id}:${action}`)
    try {
      await selected.request()
      toast.success(`Đã ${selected.label} chỉ định.`)
      await reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Không thể ${selected.label} chỉ định.`))
    } finally {
      setActionBusy('')
    }
  }

  function primaryAction(order) {
    const status = String(order.status || '').toLowerCase()
    if (NOT_STARTED_STATUSES.has(status)) return { key: 'dispatch', label: 'Bắt đầu' }
    if (['pending', 'ordered', 'dispatched'].includes(status)) return { key: 'start', label: 'Bắt đầu' }
    if (['acknowledged', 'accepted', 'started', 'in_progress', 'processing', 'collected'].includes(status)) {
      return { key: 'complete', label: 'Hoàn tất' }
    }
    return null
  }

  function pendingAction(order) {
    const bucket = pendingBucket(order)
    const status = String(order.status || '').toLowerCase()
    if (bucket === 'confirm') return { key: 'acknowledge', label: 'Xác nhận', tone: 'blue' }
    if (bucket === 'dispatch') return { key: status === 'dispatched' ? 'start' : 'dispatch', label: 'Gửi xử lý', tone: 'orange' }
    if (bucket === 'performing') return { key: 'complete', label: 'Hoàn tất', tone: 'green' }
    return { key: status === 'dispatched' ? 'start' : 'dispatch', label: 'Xử lý', tone: 'red' }
  }

  function exportCsv() {
    const rows = [
      ['Ma chi dinh', 'Benh nhan', 'Encounter', 'Loai chi dinh', 'Dich vu', 'Trang thai', 'Tao luc', 'Phong kham'],
      ...filteredOrders.map((order, index) => [
        orderCode(order, index),
        patientName(order),
        order.encounter_code || order.encounter_id || '',
        typeInfo(order.order_type).label,
        serviceName(order),
        statusInfo(order.status).label,
        `${formatDate(orderTime(order))} ${formatTime(orderTime(order))}`,
        roomName(order),
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `orders-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportEncounterCsv() {
    const rows = [
      ['Ma encounter', 'Benh nhan', 'Bac si', 'Tong chi dinh', 'Dang xu ly', 'Hoan tat', 'Can ky consultation', 'Phong kham'],
      ...encounterGroups.map((group) => [
        group.code,
        group.patientName,
        group.doctorName,
        group.total,
        group.processing,
        group.completed,
        group.needSignature,
        group.room,
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `orders-by-encounter-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isPendingView) {
    const urgentOrders = pendingOrders
      .filter((order) => priorityInfo(order).score >= 2 || pendingBucket(order) === 'overdue')
      .slice(0, 4)

    return (
      <div className="doctor-order-list-page doctor-order-pending-page">
        {state.error ? <div className="doctor-order-list-error">{state.error}</div> : null}

        <section className="doctor-order-pending-layout">
          <main className="doctor-order-pending-main">
            <section className="doctor-order-pending-kpis" aria-label="Tổng quan chờ xử lý">
              <KpiCard icon={ClipboardCheck} tone="blue" label="Chờ xác nhận" value={pendingStats.confirm} hint={`${percent(pendingStats.confirm, pendingStats.total)}% tổng số`} />
              <KpiCard icon={Send} tone="orange" label="Chờ gửi xử lý" value={pendingStats.dispatch} hint={`${percent(pendingStats.dispatch, pendingStats.total)}% tổng số`} />
              <KpiCard icon={PlayCircle} tone="green" label="Đang thực hiện" value={pendingStats.performing} hint={`${percent(pendingStats.performing, pendingStats.total)}% tổng số`} />
              <KpiCard icon={Clock3} tone="red" label="Quá hạn" value={pendingStats.overdue} hint={`${percent(pendingStats.overdue, pendingStats.total)}% tổng số`} />
            </section>

            <article className="doctor-order-list-panel doctor-order-pending-filter">
              <label>
                <span>Trạng thái</span>
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="confirm">Chờ xác nhận</option>
                  <option value="dispatch">Chờ gửi xử lý</option>
                  <option value="performing">Đang thực hiện</option>
                  <option value="overdue">Quá hạn</option>
                </select>
              </label>
              <label>
                <span>Mức ưu tiên</span>
                <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="red">Cao</option>
                  <option value="orange">Trung bình</option>
                  <option value="green">Thấp</option>
                </select>
              </label>
              <label>
                <span>Loại chỉ định</span>
                <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  {orderTypes.map((type) => <option key={type} value={type}>{typeInfo(type).label}</option>)}
                </select>
              </label>
              <label>
                <span>Phòng khám</span>
                <select value={roomFilter} onChange={(event) => { setRoomFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  {roomOptions.map((room) => <option key={room} value={room}>{room}</option>)}
                </select>
              </label>
              <label className="doctor-order-list-search">
                <Search size={16} />
                <input
                  value={searchTerm}
                  placeholder="Tìm kiếm mã chỉ định, bệnh nhân, dịch vụ..."
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <button type="button" onClick={reload}><Filter size={15} /> Bộ lọc</button>
            </article>

            <article className="doctor-order-list-panel doctor-order-pending-priority">
              <header>
                <h2>Ưu tiên xử lý</h2>
                <button type="button" onClick={() => setStatusFilter('overdue')}>Xem tất cả <ChevronRight size={15} /></button>
              </header>
              <div>
                {urgentOrders.length ? urgentOrders.map((order, index) => (
                  <button type="button" key={orderIdOf(order) || index} onClick={() => openOrder(order)}>
                    <PatientAvatar name={patientName(order)} />
                    <span>
                      <b>{orderCode(order, index)}</b>
                      <strong>{patientName(order)}</strong>
                      <small>{serviceName(order)}</small>
                    </span>
                    <em>{waitLabel(waitMinutes(order))}</em>
                  </button>
                )) : (
                  <p>Không có chỉ định ưu tiên cao trong dữ liệu hiện tại.</p>
                )}
              </div>
            </article>

            <article className="doctor-order-list-panel doctor-order-pending-table-card">
              <h2>Danh sách chỉ định đang chờ xử lý ({pendingTotal})</h2>
              <div className="doctor-order-pending-table-head">
                <span />
                <span>Mã chỉ định</span>
                <span>Bệnh nhân</span>
                <span>Encounter</span>
                <span>Loại</span>
                <span>Dịch vụ</span>
                <span>Mức ưu tiên</span>
                <span>Thời gian chờ</span>
                <span>Trạng thái</span>
                <span>Phòng khám</span>
                <span>Thao tác</span>
              </div>
              <div className="doctor-order-pending-table">
                {state.loading ? (
                  <div className="doctor-order-list-empty">Đang tải danh sách chỉ định chờ xử lý...</div>
                ) : displayPendingOrders.length ? displayPendingOrders.map((order, index) => {
                  const id = orderIdOf(order)
                  const action = pendingAction(order)
                  const priority = priorityInfo(order)
                  const pendingStatus = pendingStatusInfo(order)
                  const type = typeInfo(order.order_type)
                  const TypeIcon = type.icon
                  return (
                    <div className="doctor-order-pending-row" key={id || orderCode(order, index)}>
                      <input type="checkbox" aria-label={`Chọn ${orderCode(order, index)}`} />
                      <strong>{orderCode(order, index)}</strong>
                      <span className="doctor-order-list-person">
                        <PatientAvatar name={patientName(order)} />
                        <span>
                          <b>{patientName(order)}</b>
                          <small>{[order.patient_gender, order.patient_age ? `${order.patient_age} tuổi` : ''].filter(Boolean).join(', ') || order.patient_code || '--'}</small>
                        </span>
                      </span>
                      <strong>{encounterCodeOf(order)}</strong>
                      <span className="doctor-order-list-service"><TypeIcon size={13} /><b>{type.label}</b></span>
                      <strong>{serviceName(order)}</strong>
                      <span className={`doctor-order-pending-priority-badge is-${priority.tone}`}>{priority.label}</span>
                      <span className="doctor-order-pending-wait"><Clock3 size={13} /> {waitLabel(waitMinutes(order))}</span>
                      <span className={`doctor-order-pending-status is-${pendingStatus.tone}`}>{pendingStatus.label}</span>
                      <strong>{roomName(order)}</strong>
                      <span className="doctor-order-pending-actions">
                        <button
                          className={`is-${action.tone}`}
                          type="button"
                          disabled={actionBusy === `${id}:${action.key}`}
                          onClick={() => runAction(order, action.key)}
                        >
                          {action.label}
                        </button>
                        <button type="button" aria-label="Tùy chọn chỉ định" onClick={() => openOrder(order)}><ChevronDown size={15} /></button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-order-list-empty">Chưa có chỉ định đang chờ xử lý phù hợp.</div>
                )}
              </div>
              <footer className="doctor-order-list-footer">
                <button type="button" disabled>Hiển thị <strong>{PAGE_SIZE}</strong> dòng</button>
                <div>
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
                  {Array.from({ length: Math.min(7, pendingTotalPages) }, (_, index) => index + 1).map((pageNumber) => (
                    <button className={pageNumber === page ? 'is-active' : ''} type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                  ))}
                  <button type="button" disabled={page >= pendingTotalPages} onClick={() => setPage((current) => Math.min(pendingTotalPages, current + 1))}><ChevronRight size={15} /></button>
                </div>
                <span>Hiển thị {pendingTotal ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, pendingTotal)}` : '0'} của {pendingTotal.toLocaleString('vi-VN')} chỉ định</span>
              </footer>
            </article>
          </main>

          <aside className="doctor-order-list-side doctor-order-pending-side">
            <article className="doctor-order-list-panel doctor-order-list-overview">
              <header><h2>Tổng quan chờ xử lý</h2></header>
              <div className="doctor-order-list-overview__top">
                <PendingDonut stats={pendingStats} />
                <dl>
                  <div><dt><i className="is-blue" /> Chờ xác nhận</dt><dd>{pendingStats.confirm} ({percent(pendingStats.confirm, pendingStats.total)}%)</dd></div>
                  <div><dt><i className="is-orange" /> Chờ gửi xử lý</dt><dd>{pendingStats.dispatch} ({percent(pendingStats.dispatch, pendingStats.total)}%)</dd></div>
                  <div><dt><i className="is-green" /> Đang thực hiện</dt><dd>{pendingStats.performing} ({percent(pendingStats.performing, pendingStats.total)}%)</dd></div>
                  <div><dt><i className="is-red" /> Quá hạn</dt><dd>{pendingStats.overdue} ({percent(pendingStats.overdue, pendingStats.total)}%)</dd></div>
                </dl>
              </div>
            </article>

            <article className="doctor-order-list-panel doctor-order-pending-stats">
              <h2>Thống kê</h2>
              <div><span>Thời gian chờ trung bình</span><strong>{waitLabel(pendingStats.averageWait)}</strong></div>
              <div><span>Số chỉ định quá hạn</span><strong className="is-red">{pendingStats.overdue}</strong></div>
              <div><span>Tỷ lệ quá hạn</span><strong className="is-red">{percent(pendingStats.overdue, pendingStats.total)}%</strong></div>
              <h3>Top loại chỉ định</h3>
              {pendingStats.byType.length ? pendingStats.byType.map(([label, count], index) => (
                <section key={label}>
                  <span>{label}</span>
                  <i style={{ '--bar': `${percent(count, pendingStats.total)}%`, '--bar-color': ['#7a35f2', '#0b66f0', '#13a85d', '#9aa5b8'][index] }} />
                  <strong>{count} ({percent(count, pendingStats.total)}%)</strong>
                </section>
              )) : <p>Chưa có dữ liệu loại chỉ định.</p>}
            </article>

            <article className="doctor-order-list-panel doctor-order-list-quick">
              <h2>Thao tác nhanh</h2>
              <button type="button" onClick={() => toast.info('Có thể chọn nhiều chỉ định để xử lý hàng loạt khi backend mở batch action.')}>
                <span><ClipboardCheck size={20} /></span>
                <b>Xử lý hàng loạt</b>
                <small>Xác nhận, gửi xử lý hoặc hủy nhiều chỉ định</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={reload}>
                <span><RefreshCw size={20} /></span>
                <b>Làm mới danh sách</b>
                <small>Cập nhật danh sách mới nhất</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={exportCsv} disabled={!pendingOrders.length}>
                <span><Download size={20} /></span>
                <b>Xuất báo cáo</b>
                <small>Xuất danh sách chỉ định chờ xử lý</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => displayPendingOrders[0] ? openOrder(displayPendingOrders[0]) : toast.info('Chưa có chỉ định để xem timeline.')}>
                <span><Clock3 size={20} /></span>
                <b>Xem timeline</b>
                <small>Xem lịch sử theo dõi chỉ định</small>
                <ChevronRight size={18} />
              </button>
            </article>
          </aside>
        </section>
      </div>
    )
  }

  if (isEncounterView) {
    return (
      <div className="doctor-order-list-page doctor-order-encounter-page">
        {state.error ? <div className="doctor-order-list-error">{state.error}</div> : null}

        <section className="doctor-order-list-kpis" aria-label="Tổng quan chỉ định theo encounter">
          <KpiCard icon={CalendarCheck2} tone="blue" label="Encounter có chỉ định" value={encounterStats.withOrders} hint={`${percent(encounterStats.withOrders, encounterStats.totalEncounters)}% tổng encounter`} />
          <KpiCard icon={ClipboardCheck} tone="green" label="Tổng chỉ định" value={encounterStats.totalOrders} hint="100% tổng số" />
          <KpiCard icon={Clock3} tone="orange" label="Đang xử lý" value={encounterStats.processing} hint={`${percent(encounterStats.processing, encounterStats.totalOrders)}% tổng số`} />
          <KpiCard icon={CheckCircle2} tone="purple" label="Hoàn tất" value={encounterStats.completed} hint={`${percent(encounterStats.completed, encounterStats.totalOrders)}% tổng số`} />
        </section>

        <section className="doctor-order-encounter-grid">
          <div className="doctor-order-encounter-main">
            <article className="doctor-order-list-panel doctor-order-encounter-filter">
              <label className="doctor-order-list-search">
                <Search size={16} />
                <input
                  value={searchTerm}
                  placeholder="Tìm mã UE, tên hoặc SĐT bệnh nhân..."
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <label>
                <span>Khoảng thời gian</span>
                <select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }}>
                  <option value="7d">13/05/2025 - 20/05/2025</option>
                  <option value="today">Hôm nay</option>
                  <option value="30d">30 ngày qua</option>
                  <option value="all">Tất cả</option>
                </select>
              </label>
              <label>
                <span>Trạng thái</span>
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="processing">Đang xử lý</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="cancelled">Hủy</option>
                  <option value="not_started">Chờ ký consultation</option>
                </select>
              </label>
              <label>
                <span>Loại chỉ định</span>
                <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  {orderTypes.map((type) => <option key={type} value={type}>{typeInfo(type).label}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); setDateFilter('7d'); setPage(1) }}>
                <RotateCcw size={15} /> Đặt lại
              </button>
              <button className="is-primary" type="button" onClick={reload}>
                <Filter size={15} /> Áp dụng
              </button>
            </article>

            <article className="doctor-order-list-panel doctor-order-encounter-list">
              <h2>Danh sách encounter</h2>
              <div className="doctor-order-encounter-table-head">
                <span>Mã encounter</span>
                <span>Bệnh nhân</span>
                <span>Bác sĩ</span>
                <span>Tổng chỉ định</span>
                <span>Đang xử lý</span>
                <span>Hoàn tất</span>
                <span>Cần ký consultation</span>
                <span>Thao tác</span>
              </div>
              <div className="doctor-order-encounter-table">
                {state.loading ? (
                  <div className="doctor-order-list-empty">Đang tải danh sách encounter...</div>
                ) : displayEncounters.length ? displayEncounters.map((group) => {
                  const key = group.id || group.code
                  return (
                    <div className={`doctor-order-encounter-row${selectedEncounterKey === key ? ' is-selected' : ''}`} key={key}>
                      <button type="button" aria-label="Chọn encounter" onClick={() => setSelectedEncounterKey(key)}><ChevronRight size={15} /></button>
                      <strong><b>{group.code}</b><small>{formatDate(group.firstTime)} {formatTime(group.firstTime)}</small></strong>
                      <span className="doctor-order-list-person">
                        <PatientAvatar name={group.patientName} />
                        <span>
                          <b>{group.patientName}</b>
                          <small>{[group.patientGender, group.patientAge ? `${group.patientAge} tuổi` : '', group.patientPhone].filter(Boolean).join(' • ') || '--'}</small>
                        </span>
                      </span>
                      <span className="doctor-order-list-person">
                        <PatientAvatar name={group.doctorName} />
                        <span>
                          <b>{group.doctorName}</b>
                          <small>Khoa Khám bệnh</small>
                        </span>
                      </span>
                      <strong>{group.total}</strong>
                      <strong className="is-orange">{group.processing}</strong>
                      <strong className="is-green">{group.completed}</strong>
                      <strong className="is-red">{group.needSignature}</strong>
                      <span className="doctor-order-list-actions">
                        <button type="button" onClick={() => setSelectedEncounterKey(key)}><Eye size={13} /> Xem chi tiết</button>
                        <button type="button" aria-label="Tùy chọn encounter" onClick={() => setSelectedEncounterKey(key)}><ChevronDown size={14} /></button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-order-list-empty">Chưa có encounter phù hợp.</div>
                )}
              </div>
              <footer className="doctor-order-list-footer">
                <button type="button" disabled>Hiển thị <strong>{PAGE_SIZE}</strong> dòng</button>
                <div>
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
                  {Array.from({ length: Math.min(5, encounterTotalPages) }, (_, index) => index + 1).map((pageNumber) => (
                    <button className={pageNumber === page ? 'is-active' : ''} type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                  ))}
                  <button type="button" disabled={page >= encounterTotalPages} onClick={() => setPage((current) => Math.min(encounterTotalPages, current + 1))}><ChevronRight size={15} /></button>
                </div>
                <span>Hiển thị {encounterTotal ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, encounterTotal)}` : '0'} của {encounterTotal.toLocaleString('vi-VN')} encounter</span>
              </footer>
            </article>

            <article className="doctor-order-list-panel doctor-order-encounter-detail">
              <header>
                <h2>Chi tiết chỉ định của encounter {selectedEncounter?.code || '--'}</h2>
                <span>{selectedOrderStats.total} chỉ định</span>
              </header>
              <div className="doctor-order-encounter-detail-head">
                <span>Loại chỉ định</span>
                <span>Dịch vụ / Chỉ định</span>
                <span>Đơn vị</span>
                <span>Trạng thái</span>
                <span>Thời gian tạo</span>
                <span>Người tạo</span>
                <span>Thao tác</span>
              </div>
              <div className="doctor-order-encounter-detail-table">
                {encounterDetail.loading ? (
                  <div className="doctor-order-list-empty">Đang tải chi tiết encounter...</div>
                ) : selectedOrders.length ? selectedOrders.map((order, index) => {
                  const action = primaryAction(order)
                  const type = typeInfo(order.order_type)
                  const TypeIcon = type.icon
                  const id = orderIdOf(order)
                  return (
                    <div className="doctor-order-encounter-detail-row" key={id || orderCode(order, index)}>
                      <span className="doctor-order-list-service"><TypeIcon size={15} /><b>{type.label}</b></span>
                      <strong>{serviceName(order)}</strong>
                      <span>{order.receiving_department_name || order.department_name || type.label}</span>
                      <StatusBadge status={order.status} />
                      <span>{formatDate(orderTime(order))} {formatTime(orderTime(order))}</span>
                      <strong>{doctorName(order)}</strong>
                      <span className="doctor-order-list-actions">
                        <button type="button" onClick={() => openOrder(order)}><Eye size={13} /> {statusGroup(order.status) === 'completed' ? 'Xem kết quả' : action?.key === 'complete' ? 'Theo dõi' : 'Yêu cầu ký'}</button>
                        <button type="button" aria-label="Tùy chọn chỉ định" onClick={() => setSelectedId(id)}><ChevronDown size={14} /></button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-order-list-empty">Encounter này chưa có chỉ định.</div>
                )}
              </div>
              <button className="doctor-order-encounter-link" type="button" onClick={() => selectedEncounter?.id ? doctorApi.orders.listByEncounter(selectedEncounter.id).then(() => toast.info('Đã tải lại danh sách chỉ định của encounter từ API.')) : null}>
                Xem tất cả {selectedOrderStats.total} chỉ định của encounter này
              </button>
            </article>
          </div>

          <aside className="doctor-order-list-side">
            <article className="doctor-order-list-panel doctor-order-list-overview">
              <header><h2>Tổng quan encounter</h2></header>
              <div className="doctor-order-list-overview__top">
                <EncounterDonut stats={selectedOrderStats} />
                <dl>
                  <div><dt><i className="is-green" /> Hoàn tất</dt><dd>{selectedOrderStats.completed} ({percent(selectedOrderStats.completed, selectedOrderStats.total)}%)</dd></div>
                  <div><dt><i className="is-orange" /> Đang xử lý</dt><dd>{selectedOrderStats.processing} ({percent(selectedOrderStats.processing, selectedOrderStats.total)}%)</dd></div>
                  <div><dt><i className="is-purple" /> Chờ ký consultation</dt><dd>{selectedOrderStats.needSignature} ({percent(selectedOrderStats.needSignature, selectedOrderStats.total)}%)</dd></div>
                  <div><dt><i className="is-red" /> Hủy</dt><dd>{selectedOrderStats.cancelled} ({percent(selectedOrderStats.cancelled, selectedOrderStats.total)}%)</dd></div>
                </dl>
              </div>
            </article>

            <article className="doctor-order-list-panel doctor-order-encounter-info">
              <h2>Thông tin encounter</h2>
              <dl>
                <div><dt>Mã encounter</dt><dd>{selectedEncounter?.code || '--'}</dd></div>
                <div><dt>Thời gian</dt><dd>{selectedEncounter ? `${formatDate(selectedEncounter.firstTime)} ${formatTime(selectedEncounter.firstTime)}` : '--'}</dd></div>
                <div>
                  <dt>Bệnh nhân</dt>
                  <dd className="doctor-order-list-person">
                    <PatientAvatar name={selectedEncounter?.patientName} />
                    <span><b>{selectedEncounter?.patientName || '--'}</b><small>{[selectedEncounter?.patientGender, selectedEncounter?.patientAge ? `${selectedEncounter.patientAge} tuổi` : '', selectedEncounter?.patientPhone].filter(Boolean).join(' • ')}</small></span>
                  </dd>
                </div>
                <div><dt>Phòng khám</dt><dd>{selectedEncounter?.room || '--'}</dd></div>
                <div><dt>Trạng thái encounter</dt><dd><StatusBadge status={selectedEncounter?.status} /></dd></div>
              </dl>
              <div className="doctor-order-encounter-info-cards">
                <span><Clock3 size={15} /><b>Consultation</b><strong>{Number(selectedSummary.consultation_count ?? 1)}</strong></span>
                <span><FileText size={15} /><b>Đơn thuốc</b><strong>{Number(selectedSummary.prescription_count ?? 0)}</strong></span>
                <span><ClipboardList size={15} /><b>Chỉ định</b><strong>{selectedOrderStats.total}</strong></span>
              </div>
            </article>

            <article className="doctor-order-list-panel doctor-order-list-quick">
              <h2>Thao tác nhanh</h2>
              <button type="button" onClick={() => toast.info('Tạo chỉ định mới dùng POST /encounters/:encounterId/orders với encounter đang chọn.')}>
                <span><ClipboardPlus size={20} /></span>
                <b>Tạo chỉ định mới</b>
                <small>Tạo chỉ định cho encounter này</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => selectedEncounter?.id ? doctorApi.orders.getEncounterSummary(selectedEncounter.id).then(() => toast.info('Đã tải summary chỉ định của encounter từ API.')) : null}>
                <span><ClipboardCheck size={20} /></span>
                <b>Xem summary</b>
                <small>Xem summary chỉ định của encounter</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => selectedOrders[0] ? doctorApi.orders.getTimeline(orderIdOf(selectedOrders[0])).then(() => toast.info('Đã tải timeline order đầu tiên của encounter.')) : toast.info('Encounter chưa có order để xem timeline.')}>
                <span><Clock3 size={20} /></span>
                <b>Mở timeline</b>
                <small>Xem timeline của encounter</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={exportEncounterCsv} disabled={!encounterGroups.length}>
                <span><Download size={20} /></span>
                <b>Xuất danh sách</b>
                <small>Xuất danh sách encounter ra file</small>
                <ChevronRight size={18} />
              </button>
            </article>
          </aside>
        </section>
      </div>
    )
  }

  return (
    <div className="doctor-order-list-page">
      {state.error ? <div className="doctor-order-list-error">{state.error}</div> : null}

      <section className="doctor-order-list-kpis" aria-label="Tổng quan chỉ định">
        <KpiCard icon={ClipboardList} tone="blue" label="Tổng chỉ định" value={stats.total.toLocaleString('vi-VN')} hint="100% tổng số" />
        <KpiCard icon={Clock3} tone="green" label="Đang xử lý" value={stats.processing} hint={`${percent(stats.processing, stats.total)}% tổng số`} />
        <KpiCard icon={CheckCircle2} tone="purple" label="Hoàn tất" value={stats.completed} hint={`${percent(stats.completed, stats.total)}% tổng số`} />
        <KpiCard icon={XCircle} tone="red" label="Đã hủy" value={stats.cancelled} hint={`${percent(stats.cancelled, stats.total)}% tổng số`} />
      </section>

      <section className="doctor-order-list-grid">
        <article className="doctor-order-list-panel doctor-order-list-table-card">
          <div className="doctor-order-list-toolbar">
            <label className="doctor-order-list-search">
              <Search size={16} />
              <input
                value={searchTerm}
                placeholder="Tìm kiếm mã chỉ định, bệnh nhân, dịch vụ..."
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <label>
              <span>Trạng thái</span>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                <option value="all">Tất cả</option>
                <option value="processing">Đang xử lý</option>
                <option value="completed">Hoàn tất</option>
                <option value="cancelled">Đã hủy</option>
                <option value="not_started">Chưa bắt đầu</option>
              </select>
            </label>
            <label>
              <span>Loại chỉ định</span>
              <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}>
                <option value="all">Tất cả</option>
                {orderTypes.map((type) => <option key={type} value={type}>{typeInfo(type).label}</option>)}
              </select>
            </label>
            <label>
              <span>Khoảng thời gian</span>
              <select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1) }}>
                <option value="7d">7 ngày qua</option>
                <option value="today">Hôm nay</option>
                <option value="30d">30 ngày qua</option>
                <option value="all">Tất cả</option>
              </select>
            </label>
            <button type="button" onClick={reload}><Filter size={15} /> Bộ lọc</button>
          </div>

          <div className="doctor-order-list-table-head">
            <span>Mã chỉ định</span>
            <span>Bệnh nhân</span>
            <span>Encounter</span>
            <span>Loại chỉ định</span>
            <span>Dịch vụ</span>
            <span>Trạng thái</span>
            <span>Tạo lúc</span>
            <span>Phòng khám</span>
            <span>Thao tác</span>
          </div>

          <div className="doctor-order-list-table">
            {state.loading ? (
              <div className="doctor-order-list-empty">Đang tải danh sách chỉ định...</div>
            ) : displayOrders.length ? displayOrders.map((order, index) => {
              const id = orderIdOf(order)
              const typeMeta = typeInfo(order.order_type)
              const action = primaryAction(order)
              const TypeIcon = typeMeta.icon
              return (
                <div className={`doctor-order-list-row${selectedId === id ? ' is-selected' : ''}`} key={id || orderCode(order, index)}>
                  <strong>{orderCode(order, index)}</strong>
                  <span className="doctor-order-list-person">
                    <PatientAvatar name={patientName(order)} />
                    <span>
                      <b>{patientName(order)}</b>
                      <small>{[order.patient_gender, order.patient_age ? `${order.patient_age} tuổi` : ''].filter(Boolean).join(', ') || order.patient_code || '--'}</small>
                    </span>
                  </span>
                  <strong>{order.encounter_code || order.encounter_id || '--'}</strong>
                  <TypeBadge type={order.order_type} />
                  <span className="doctor-order-list-service">
                    <TypeIcon size={13} />
                    <b>{serviceName(order)}</b>
                  </span>
                  <StatusBadge status={order.status} />
                  <span className="doctor-order-list-time">
                    <b>{formatDate(orderTime(order))}</b>
                    <small>{formatTime(orderTime(order))}</small>
                  </span>
                  <strong>{roomName(order)}</strong>
                  <span className="doctor-order-list-actions">
                    <button type="button" onClick={() => openOrder(order)}><Eye size={13} /> Xem chi tiết</button>
                    {action ? (
                      <button
                        className="is-primary"
                        type="button"
                        disabled={actionBusy === `${id}:${action.key}`}
                        onClick={() => runAction(order, action.key)}
                      >
                        {action.key === 'complete' ? <CheckCircle2 size={13} /> : <PlayCircle size={13} />}
                        {action.label}
                      </button>
                    ) : null}
                    <button type="button" aria-label="Tùy chọn chỉ định" onClick={() => setSelectedId(id)}><MoreVertical size={14} /></button>
                  </span>
                </div>
              )
            }) : (
              <div className="doctor-order-list-empty">Chưa có chỉ định phù hợp.</div>
            )}
          </div>

          <footer className="doctor-order-list-footer">
            <button type="button" disabled>Hiển thị <strong>{PAGE_SIZE}</strong> dòng</button>
            <div>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  className={pageNumber === page ? 'is-active' : ''}
                  type="button"
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={15} /></button>
            </div>
            <span>Hiển thị {total ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, total)}` : '0'} của {total.toLocaleString('vi-VN')} chỉ định</span>
          </footer>
        </article>

        <aside className="doctor-order-list-side">
          <article className="doctor-order-list-panel doctor-order-list-overview">
            <header><h2>Tổng quan chỉ định</h2></header>
            <div className="doctor-order-list-overview__top">
              <Donut stats={stats} />
              <dl>
                <div><dt><i className="is-orange" /> Đang xử lý</dt><dd>{stats.processing} ({percent(stats.processing, stats.total)}%)</dd></div>
                <div><dt><i className="is-green" /> Hoàn tất</dt><dd>{stats.completed} ({percent(stats.completed, stats.total)}%)</dd></div>
                <div><dt><i className="is-red" /> Đã hủy</dt><dd>{stats.cancelled} ({percent(stats.cancelled, stats.total)}%)</dd></div>
                <div><dt><i className="is-purple" /> Chưa bắt đầu</dt><dd>{stats.notStarted} ({percent(stats.notStarted, stats.total)}%)</dd></div>
              </dl>
            </div>
          </article>

          <article className="doctor-order-list-panel doctor-order-list-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => toast.info('Tạo chỉ định cần encounter đang chọn để gọi POST /encounters/:encounterId/orders.')}>
              <span><ClipboardPlus size={20} /></span>
              <b>Tạo chỉ định</b>
              <small>Tạo mới đơn chỉ định cho bệnh nhân</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={reload}>
              <span><RefreshCw size={20} /></span>
              <b>Làm mới danh sách</b>
              <small>Cập nhật danh sách chỉ định</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={exportCsv} disabled={!filteredOrders.length}>
              <span><Download size={20} /></span>
              <b>Xuất danh sách</b>
              <small>Xuất file danh sách chỉ định</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => navigate('/doctor/orders?view=encounter')}>
              <span><Link2 size={20} /></span>
              <b>Xem theo encounter</b>
              <small>Xem tất cả chỉ định theo encounter</small>
              <ChevronRight size={18} />
            </button>
          </article>

          <article className="doctor-order-list-note">
            <Info size={18} />
            <div>
              <strong>Ghi chú</strong>
              <p>Trạng thái được cập nhật theo thời gian thực khi khoa/phòng thực hiện chỉ định.</p>
            </div>
          </article>
        </aside>
      </section>
    </div>
  )
}
