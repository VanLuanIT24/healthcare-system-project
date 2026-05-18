import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Stethoscope,
  UsersRound,
} from 'lucide-react'
import { doctorApi, getDoctorId } from './doctorApi'
import { getInitials, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5

function todayLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'short' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleDateString('vi-VN')}`
}

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

function prescriptionIdOf(item = {}) {
  return item.prescription_id || item.id || item._id || ''
}

function prescriptionCode(item = {}, index = 0) {
  return item.prescription_no || item.prescription_code || item.code || prescriptionIdOf(item) || `RX-${String(index + 1).padStart(4, '0')}`
}

function patientName(item = {}) {
  return item.patient_name || item.patient?.full_name || item.patient?.name || 'Bệnh nhân'
}

function patientCode(item = {}) {
  return item.patient_code || item.patient?.patient_code || item.patient_id || ''
}

function prescribedTime(item = {}) {
  return item.prescribed_at || item.created_at || item.updated_at || ''
}

function encounterCode(item = {}) {
  return item.encounter_code || item.encounter?.encounter_code || item.encounter_id || '--'
}

function encounterId(item = {}) {
  return item.encounter_id || item.encounter?.encounter_id || item.encounter?.id || ''
}

function roomName(item = {}) {
  return item.room_name || item.clinic_room || item.encounter?.room_name || item.department_name || ''
}

function doctorName(item = {}) {
  return item.doctor_name || item.prescribed_by_name || item.doctor?.full_name || item.prescriber?.full_name || 'Bác sĩ'
}

function statusGroup(status) {
  const normalized = String(status || '').toLowerCase()
  if (['active', 'activated', 'dispensing', 'in_progress'].includes(normalized)) return 'active'
  if (['completed', 'complete', 'done', 'finished'].includes(normalized)) return 'completed'
  if (['cancelled', 'canceled', 'voided'].includes(normalized)) return 'cancelled'
  return 'pending'
}

function statusInfo(status) {
  const group = statusGroup(status)
  if (group === 'active') return { label: 'Đang hoạt động', tone: 'green', group }
  if (group === 'completed') return { label: 'Hoàn tất', tone: 'blue', group }
  if (group === 'cancelled') return { label: 'Đã hủy', tone: 'red', group }
  return { label: 'Chờ hoàn tất', tone: 'orange', group }
}

function itemCount(item = {}, enrichment = {}) {
  return Number(
    item.items_count
    || item.medication_count
    || item.drug_count
    || safeArray(item.items).length
    || safeArray(enrichment.items).length
    || 0,
  )
}

function alertInfo(item = {}, enrichment = {}) {
  const summary = enrichment.summary || {}
  const allergy = Number(summary.allergy_conflicts_count || summary.allergy_count || item.allergy_conflicts_count || 0)
  const interaction = Number(summary.interaction_conflicts_count || summary.interaction_count || item.interaction_conflicts_count || 0)
  const duplicate = Number(summary.duplicate_medications_count || summary.duplicate_count || item.duplicate_medications_count || 0)
  if (allergy > 0) return { label: `Dị ứng (${allergy})`, tone: 'red', type: 'allergy' }
  if (interaction > 0) return { label: `Tương tác (${interaction})`, tone: 'orange', type: 'interaction' }
  if (duplicate > 0) return { label: `Trùng thuốc (${duplicate})`, tone: 'orange', type: 'duplicate' }
  if (statusGroup(item.status) === 'cancelled') return { label: 'Không áp dụng', tone: 'slate', type: 'none' }
  return { label: 'Không có', tone: 'green', type: 'none' }
}

function matchesSearch(item, keyword) {
  if (!keyword) return true
  const text = [
    prescriptionCode(item),
    patientName(item),
    patientCode(item),
    encounterCode(item),
  ].filter(Boolean).join(' ').toLowerCase()
  return text.includes(keyword.toLowerCase())
}

function withinTime(item, value) {
  if (value === 'all') return true
  const date = new Date(prescribedTime(item))
  if (Number.isNaN(date.getTime())) return false
  const diffDays = (Date.now() - date.getTime()) / 86400000
  if (value === '7d') return diffDays <= 7
  if (value === '30d') return diffDays <= 30
  if (value === 'today') return date.toDateString() === new Date().toDateString()
  return true
}

function activatedTime(item = {}) {
  return item.activated_at || item.started_at || item.prescribed_at || item.created_at || ''
}

function expiresAt(item = {}, enrichment = {}) {
  const summary = enrichment.summary || {}
  return item.expires_at || item.valid_until || item.end_date || summary.expires_at || summary.valid_until || ''
}

function remainingDays(item = {}, enrichment = {}) {
  const explicit = item.remaining_days ?? item.days_remaining ?? enrichment.summary?.remaining_days
  if (explicit !== undefined && explicit !== null && explicit !== '') return Number(explicit)
  const expires = new Date(expiresAt(item, enrichment))
  if (!Number.isNaN(expires.getTime())) {
    return Math.ceil((expires.getTime() - Date.now()) / 86400000)
  }
  const started = new Date(activatedTime(item))
  if (!Number.isNaN(started.getTime())) {
    return Math.max(0, 7 - Math.floor((Date.now() - started.getTime()) / 86400000))
  }
  return 0
}

function remainingLabel(days) {
  if (days < 0) return 'Hết hạn hôm nay'
  if (days === 0) return 'Hết hạn hôm nay'
  if (days === 1) return '1 ngày'
  return `${days} ngày`
}

function activeStatusInfo(item = {}, enrichment = {}) {
  const days = remainingDays(item, enrichment)
  if (statusGroup(item.status) === 'cancelled') return { label: 'Ngưng sử dụng', tone: 'slate', group: 'stopped' }
  if (days <= 0) return { label: 'Hết hạn', tone: 'red', group: 'expired' }
  if (days <= 2) return { label: 'Sắp hoàn tất', tone: 'orange', group: 'ending' }
  return { label: 'Đang dùng', tone: 'green', group: 'normal' }
}

function medicationNames(item = {}, enrichment = {}) {
  const names = safeArray(enrichment.items).map((entry) => entry.medication_name || entry.generic_name || entry.drug_name || entry.name).filter(Boolean)
  if (names.length) return names.slice(0, 2).join('\n')
  const direct = safeArray(item.items).map((entry) => entry.medication_name || entry.generic_name || entry.drug_name || entry.name).filter(Boolean)
  if (direct.length) return direct.slice(0, 2).join('\n')
  return item.medication_name || item.primary_medication || item.note || '--'
}

function activeWarnings(item = {}, enrichment = {}) {
  const summary = enrichment.summary || {}
  const warnings = []
  const allergy = Number(summary.allergy_conflicts_count || summary.allergy_count || item.allergy_conflicts_count || 0)
  const interaction = Number(summary.interaction_conflicts_count || summary.interaction_count || item.interaction_conflicts_count || 0)
  const duplicate = Number(summary.duplicate_medications_count || summary.duplicate_count || item.duplicate_medications_count || 0)
  const highDose = Number(summary.high_dose_count || summary.high_dose_warnings_count || item.high_dose_count || 0)
  if (allergy) warnings.push({ label: 'Dị ứng', tone: 'red', type: 'allergy' })
  if (interaction) warnings.push({ label: 'Tương tác', tone: 'red-soft', type: 'interaction' })
  if (duplicate) warnings.push({ label: 'Trùng thuốc', tone: 'orange', type: 'duplicate' })
  if (highDose) warnings.push({ label: 'Liều cao', tone: 'red', type: 'highDose' })
  return warnings
}

function encounterStatusFromPrescriptions(items = []) {
  if (!items.length) return 'pending'
  if (items.some((item) => statusGroup(item.status) === 'active')) return 'active'
  if (items.every((item) => statusGroup(item.status) === 'completed')) return 'completed'
  if (items.every((item) => statusGroup(item.status) === 'cancelled')) return 'cancelled'
  return 'pending'
}

function buildEncounterGroups(prescriptions = []) {
  const groups = new Map()
  prescriptions.forEach((item) => {
    const key = encounterId(item) || encounterCode(item)
    if (!key || key === '--') return
    const current = groups.get(key) || {
      id: encounterId(item),
      code: encounterCode(item),
      patientName: patientName(item),
      patientCode: patientCode(item),
      patientAge: item.patient_age || item.patient?.age || '',
      patientGender: item.patient_gender || item.patient?.gender || '',
      doctorName: doctorName(item),
      room: roomName(item),
      firstTime: prescribedTime(item),
      prescriptions: [],
    }
    current.prescriptions.push(item)
    if (!current.id) current.id = encounterId(item)
    if (!current.firstTime || new Date(prescribedTime(item)) < new Date(current.firstTime)) {
      current.firstTime = prescribedTime(item)
    }
    groups.set(key, current)
  })

  return Array.from(groups.values()).map((group) => {
    const active = group.prescriptions.filter((item) => statusGroup(item.status) === 'active').length
    const pending = group.prescriptions.filter((item) => statusGroup(item.status) === 'pending').length
    const completed = group.prescriptions.filter((item) => statusGroup(item.status) === 'completed').length
    const cancelled = group.prescriptions.filter((item) => statusGroup(item.status) === 'cancelled').length
    return {
      ...group,
      total: group.prescriptions.length,
      active,
      pending,
      completed,
      cancelled,
      status: encounterStatusFromPrescriptions(group.prescriptions),
    }
  })
}

function PatientAvatar({ name }) {
  return <span className="doctor-prescription-avatar">{getInitials(name) || 'BN'}</span>
}

function KpiCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <article className="doctor-prescription-kpi">
      <span className={`doctor-prescription-kpi__icon is-${tone}`}>
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

function StatusBadge({ status }) {
  const meta = statusInfo(status)
  return <span className={`doctor-prescription-status is-${meta.tone}`}>{meta.label}</span>
}

function AlertBadge({ alert }) {
  return <span className={`doctor-prescription-alert is-${alert.tone}`}>{alert.label}</span>
}

function Donut({ stats }) {
  const total = stats.total || 1
  const activeEnd = percent(stats.active, total)
  const pendingEnd = activeEnd + percent(stats.pending, total)
  const completedEnd = pendingEnd + percent(stats.completed, total)
  const cancelledEnd = completedEnd + percent(stats.cancelled, total)
  return (
    <div
      className="doctor-prescription-donut"
      style={{
        '--active-end': `${activeEnd}%`,
        '--pending-end': `${pendingEnd}%`,
        '--completed-end': `${completedEnd}%`,
        '--cancelled-end': `${cancelledEnd}%`,
      }}
    >
      <div>
        <strong>{stats.total}</strong>
        <span>Tổng đơn</span>
      </div>
    </div>
  )
}

function EncounterDonut({ stats }) {
  const total = stats.totalEncounters || 1
  const completedEnd = percent(stats.completedEncounters, total)
  const activeEnd = completedEnd + percent(stats.activeEncounters, total)
  const pendingEnd = activeEnd + percent(stats.pendingEncounters, total)
  const cancelledEnd = pendingEnd + percent(stats.cancelledEncounters, total)
  return (
    <div
      className="doctor-prescription-encounter-donut"
      style={{
        '--completed-end': `${completedEnd}%`,
        '--active-end': `${activeEnd}%`,
        '--pending-end': `${pendingEnd}%`,
        '--cancelled-end': `${cancelledEnd}%`,
      }}
    >
      <div>
        <strong>{stats.totalEncounters}</strong>
        <span>Encounter</span>
      </div>
    </div>
  )
}

function ActiveDonut({ stats }) {
  const total = stats.total || 1
  const normalEnd = percent(stats.normal, total)
  const warningEnd = normalEnd + percent(stats.warning, total)
  const endingEnd = warningEnd + percent(stats.ending, total)
  const stoppedEnd = endingEnd + percent(stats.stopped, total)
  return (
    <div
      className="doctor-prescription-active-donut"
      style={{
        '--normal-end': `${normalEnd}%`,
        '--warning-end': `${warningEnd}%`,
        '--ending-end': `${endingEnd}%`,
        '--stopped-end': `${stoppedEnd}%`,
      }}
    >
      <div>
        <strong>{stats.total}</strong>
        <span>Đơn</span>
      </div>
    </div>
  )
}

async function enrichPrescription(item) {
  const id = prescriptionIdOf(item)
  if (!id) return null
  const [summary, items] = await Promise.all([
    doctorApi.prescriptions.getSummary(id).catch(() => null),
    doctorApi.prescriptions.listItems(id).catch(() => []),
  ])
  return [id, { summary, items: safeArray(items) }]
}

export function DoctorMyPrescriptionsScreen({ user }) {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [today] = useState(getTodayDate)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [alertFilter, setAlertFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('30d')
  const [selectedId, setSelectedId] = useState('')
  const [selectedEncounterKey, setSelectedEncounterKey] = useState('')
  const [encounterDetail, setEncounterDetail] = useState({ loading: false, prescriptions: [] })
  const [actionBusy, setActionBusy] = useState('')
  const [state, setState] = useState({ loading: true, error: '', prescriptions: [], pagination: null })
  const [enrichment, setEnrichment] = useState({})

  const doctorId = getDoctorId(user)
  const view = searchParams.get('view') || 'mine'
  const isEncounterView = view === 'encounter'
  const isActiveView = view === 'active'

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    if (!doctorId) {
      setState({ loading: false, error: 'Không tìm thấy mã bác sĩ hiện tại.', prescriptions: [], pagination: null })
      return undefined
    }

    doctorApi.prescriptions.listByDoctorPage(doctorId, {
      page: 1,
      limit: 500,
      sort_by: 'prescribed_at',
      sort_order: 'desc',
    })
      .then((payload) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          prescriptions: safeArray(payload?.items),
          pagination: payload?.pagination || null,
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải danh sách đơn thuốc.'),
          prescriptions: [],
          pagination: null,
        })
      })

    return () => {
      active = false
    }
  }, [doctorId, reloadKey])

  const filtered = useMemo(
    () => state.prescriptions.filter((item) => (
      matchesSearch(item, searchTerm.trim())
      && (statusFilter === 'all' || statusGroup(item.status) === statusFilter)
      && withinTime(item, timeFilter)
    )),
    [searchTerm, state.prescriptions, statusFilter, timeFilter],
  )

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const displayItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    if (!isActiveView && !isEncounterView) {
      setPage((current) => Math.min(current, totalPages))
    }
  }, [isActiveView, isEncounterView, totalPages])

  const pageIds = useMemo(() => displayItems.map(prescriptionIdOf).filter(Boolean).join('|'), [displayItems])

  useEffect(() => {
    let active = true
    const missing = displayItems.filter((item) => {
      const id = prescriptionIdOf(item)
      return id && !enrichment[id]
    })
    if (!missing.length) return undefined

    Promise.all(missing.slice(0, 10).map(enrichPrescription)).then((entries) => {
      if (!active) return
      setEnrichment((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(Boolean)),
      }))
    })

    return () => {
      active = false
    }
  }, [pageIds, displayItems, enrichment])

  const stats = useMemo(() => {
    const source = state.prescriptions
    const totalPrescriptions = Number(state.pagination?.total ?? source.length)
    const active = source.filter((item) => statusGroup(item.status) === 'active').length
    const pending = source.filter((item) => statusGroup(item.status) === 'pending').length
    const completed = source.filter((item) => statusGroup(item.status) === 'completed').length
    const cancelled = source.filter((item) => statusGroup(item.status) === 'cancelled').length
    const patientsWithActive = new Set(source.filter((item) => statusGroup(item.status) === 'active').map((item) => item.patient_id || patientCode(item)).filter(Boolean)).size
    const warnings = source.reduce((sum, item) => {
      const alert = alertInfo(item, enrichment[prescriptionIdOf(item)] || {})
      return sum + (alert.type === 'none' ? 0 : 1)
    }, 0)
    return {
      total: totalPrescriptions,
      active,
      pending,
      completed,
      cancelled,
      patientsWithActive,
      warnings,
    }
  }, [enrichment, state.pagination, state.prescriptions])

  const activeSource = useMemo(
    () => state.prescriptions
      .filter((item) => {
        const group = statusGroup(item.status)
        const extra = enrichment[prescriptionIdOf(item)] || {}
        return group === 'active' || group === 'cancelled' || (group === 'pending' && remainingDays(item, extra) <= 2)
      })
      .sort((left, right) => new Date(activatedTime(right) || prescribedTime(right) || 0) - new Date(activatedTime(left) || prescribedTime(left) || 0)),
    [enrichment, state.prescriptions],
  )

  const activeFiltered = useMemo(
    () => activeSource.filter((item) => {
      const extra = enrichment[prescriptionIdOf(item)] || {}
      const status = activeStatusInfo(item, extra)
      const warnings = activeWarnings(item, extra)
      const keyword = searchTerm.trim().toLowerCase()
      const room = roomName(item).toLowerCase()
      const haystack = [
        prescriptionCode(item),
        patientName(item),
        patientCode(item),
        encounterCode(item),
        medicationNames(item, extra),
        roomName(item),
      ].filter(Boolean).join(' ').toLowerCase()

      return (!keyword || haystack.includes(keyword))
        && (statusFilter === 'all' || status.group === statusFilter || (statusFilter === 'warning' && warnings.length > 0))
        && (alertFilter === 'all' || warnings.some((warning) => warning.type === alertFilter))
        && (typeFilter === 'all' || room.includes(typeFilter.toLowerCase()))
    }),
    [activeSource, alertFilter, enrichment, searchTerm, statusFilter, typeFilter],
  )

  const activeTotal = activeFiltered.length
  const activeTotalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE))
  const activeDisplayItems = activeFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const activePageIds = useMemo(() => activeDisplayItems.map(prescriptionIdOf).filter(Boolean).join('|'), [activeDisplayItems])

  useEffect(() => {
    if (!isActiveView) return
    setPage((current) => Math.min(current, activeTotalPages))
  }, [activeTotalPages, isActiveView])

  useEffect(() => {
    if (!isActiveView) return undefined
    let active = true
    const missing = activeDisplayItems.filter((item) => {
      const id = prescriptionIdOf(item)
      return id && !enrichment[id]
    })
    if (!missing.length) return undefined

    Promise.all(missing.slice(0, 10).map(enrichPrescription)).then((entries) => {
      if (!active) return
      setEnrichment((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(Boolean)),
      }))
    })

    return () => {
      active = false
    }
  }, [activeDisplayItems, activePageIds, enrichment, isActiveView])

  const activeStats = useMemo(() => {
    const base = {
      total: activeSource.length,
      normal: 0,
      warning: 0,
      ending: 0,
      stopped: 0,
      expired: 0,
      patients: new Set(),
      allergy: 0,
      interaction: 0,
      duplicate: 0,
      highDose: 0,
    }

    activeSource.forEach((item) => {
      const extra = enrichment[prescriptionIdOf(item)] || {}
      const status = activeStatusInfo(item, extra)
      const warnings = activeWarnings(item, extra)
      if (item.patient_id || patientCode(item)) base.patients.add(item.patient_id || patientCode(item))
      warnings.forEach((warning) => {
        if (warning.type === 'allergy') base.allergy += 1
        if (warning.type === 'interaction') base.interaction += 1
        if (warning.type === 'duplicate') base.duplicate += 1
        if (warning.type === 'highDose') base.highDose += 1
      })

      if (status.group === 'stopped') base.stopped += 1
      else if (status.group === 'expired') base.expired += 1
      else if (status.group === 'ending') base.ending += 1
      else if (warnings.length) base.warning += 1
      else base.normal += 1
    })

    const warningTotal = base.warning + base.allergy + base.interaction + base.duplicate + base.highDose
    return {
      ...base,
      patientsUsing: base.patients.size,
      warnings: activeSource.filter((item) => activeWarnings(item, enrichment[prescriptionIdOf(item)] || {}).length > 0).length,
      warningTotal,
    }
  }, [activeSource, enrichment])

  const encounterGroups = useMemo(
    () => buildEncounterGroups(state.prescriptions)
      .filter((group) => {
        const keyword = searchTerm.trim().toLowerCase()
        const haystack = [
          group.code,
          group.patientName,
          group.patientCode,
          group.doctorName,
          group.room,
        ].filter(Boolean).join(' ').toLowerCase()
        return (!keyword || haystack.includes(keyword))
          && (statusFilter === 'all' || group.status === statusFilter)
          && (typeFilter === 'all' || group.prescriptions.some((item) => statusGroup(item.status) === typeFilter))
          && group.prescriptions.some((item) => withinTime(item, timeFilter))
      })
      .sort((left, right) => new Date(right.firstTime || 0) - new Date(left.firstTime || 0)),
    [searchTerm, state.prescriptions, statusFilter, timeFilter, typeFilter],
  )

  const encounterTotal = encounterGroups.length
  const encounterTotalPages = Math.max(1, Math.ceil(encounterTotal / PAGE_SIZE))
  const displayEncounters = encounterGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedEncounter = encounterGroups.find((group) => (group.id || group.code) === selectedEncounterKey) || encounterGroups[0] || null
  const selectedEncounterPrescriptions = encounterDetail.prescriptions.length ? encounterDetail.prescriptions : safeArray(selectedEncounter?.prescriptions)

  const encounterStats = useMemo(() => {
    const groups = buildEncounterGroups(state.prescriptions)
    const totalPrescriptions = groups.reduce((sum, group) => sum + group.total, 0)
    return {
      totalEncounters: groups.length,
      withPrescriptions: groups.filter((group) => group.total > 0).length,
      totalPrescriptions,
      activePrescriptions: groups.reduce((sum, group) => sum + group.active, 0),
      completedPrescriptions: groups.reduce((sum, group) => sum + group.completed, 0),
      pendingPrescriptions: groups.reduce((sum, group) => sum + group.pending, 0),
      cancelledPrescriptions: groups.reduce((sum, group) => sum + group.cancelled, 0),
      completedEncounters: groups.filter((group) => group.status === 'completed').length,
      activeEncounters: groups.filter((group) => group.status === 'active').length,
      pendingEncounters: groups.filter((group) => group.status === 'pending').length,
      cancelledEncounters: groups.filter((group) => group.status === 'cancelled').length,
    }
  }, [state.prescriptions])

  useEffect(() => {
    if (!isEncounterView) return
    if (!selectedEncounterKey && encounterGroups[0]) {
      setSelectedEncounterKey(encounterGroups[0].id || encounterGroups[0].code)
    }
  }, [encounterGroups, isEncounterView, selectedEncounterKey])

  useEffect(() => {
    if (!isEncounterView || !selectedEncounter?.id) {
      setEncounterDetail({ loading: false, prescriptions: [] })
      return undefined
    }

    let active = true
    setEncounterDetail((current) => ({ ...current, loading: true }))
    doctorApi.prescriptions.listByEncounter(selectedEncounter.id, { limit: 100 })
      .then((items) => {
        if (active) {
          setEncounterDetail({ loading: false, prescriptions: safeArray(items) })
        }
      })
      .catch((error) => {
        if (active) {
          setEncounterDetail({ loading: false, prescriptions: safeArray(selectedEncounter.prescriptions) })
          toast.error(getApiErrorMessage(error, 'Không thể tải đơn thuốc thuộc encounter.'))
        }
      })

    return () => {
      active = false
    }
  }, [isEncounterView, selectedEncounter?.id, selectedEncounterKey])

  useEffect(() => {
    if (isEncounterView) {
      setPage((current) => Math.min(current, encounterTotalPages))
    }
  }, [encounterTotalPages, isEncounterView])

  function reload() {
    setReloadKey((current) => current + 1)
  }

  async function openPrescription(item) {
    const id = prescriptionIdOf(item)
    if (!id) {
      toast.error('Không tìm thấy mã đơn thuốc.')
      return
    }
    setSelectedId(id)
    try {
      const [detail, summary, items] = await Promise.all([
        doctorApi.prescriptions.getDetail(id),
        doctorApi.prescriptions.getSummary(id),
        doctorApi.prescriptions.listItems(id),
      ])
      setEnrichment((current) => ({
        ...current,
        [id]: { detail, summary, items: safeArray(items) },
      }))
      toast.info('Đã tải chi tiết, summary và danh sách thuốc từ API.')
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể tải chi tiết đơn thuốc.'))
    }
  }

  async function runAction(item, action) {
    const id = prescriptionIdOf(item)
    if (!id) {
      toast.error('Không tìm thấy mã đơn thuốc.')
      return
    }
    const actionMap = {
      activate: { label: 'kích hoạt', request: () => doctorApi.prescriptions.activate(id) },
      complete: { label: 'hoàn tất', request: () => doctorApi.prescriptions.complete(id) },
      cancel: { label: 'hủy', request: () => doctorApi.prescriptions.cancel(id) },
    }
    const selected = actionMap[action]
    if (!selected) return
    setActionBusy(`${id}:${action}`)
    try {
      await selected.request()
      toast.success(`Đã ${selected.label} đơn thuốc.`)
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, `Không thể ${selected.label} đơn thuốc.`))
    } finally {
      setActionBusy('')
    }
  }

  function primaryAction(item) {
    const group = statusGroup(item.status)
    if (group === 'pending') return { key: 'activate', label: 'Kích hoạt' }
    if (group === 'active') return { key: 'complete', label: 'Hoàn tất' }
    return null
  }

  function exportCsv() {
    const rows = [
      ['Ma don', 'Benh nhan', 'Encounter', 'So thuoc', 'Trang thai', 'Ngay ke', 'Canh bao'],
      ...filtered.map((item, index) => {
        const extra = enrichment[prescriptionIdOf(item)] || {}
        return [
          prescriptionCode(item, index),
          patientName(item),
          encounterCode(item),
          itemCount(item, extra),
          statusInfo(item.status).label,
          `${formatDate(prescribedTime(item))} ${formatTime(prescribedTime(item))}`,
          alertInfo(item, extra).label,
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `prescriptions-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportEncounterCsv() {
    const rows = [
      ['Ma encounter', 'Benh nhan', 'Bac si', 'Tong don thuoc', 'Dang hoat dong', 'Hoan tat', 'Cho ky consultation'],
      ...encounterGroups.map((group) => [
        group.code,
        group.patientName,
        group.doctorName,
        group.total,
        group.active,
        group.completed,
        group.pending,
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `prescriptions-by-encounter-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportActiveCsv() {
    const rows = [
      ['Ma don', 'Benh nhan', 'Thuoc chinh', 'Encounter', 'Canh bao', 'Ngay kich hoat', 'Con hieu luc', 'Trang thai'],
      ...activeFiltered.map((item, index) => {
        const extra = enrichment[prescriptionIdOf(item)] || {}
        const warnings = activeWarnings(item, extra)
        const days = remainingDays(item, extra)
        return [
          prescriptionCode(item, index),
          patientName(item),
          medicationNames(item, extra).replace(/\n/g, '; '),
          encounterCode(item),
          warnings.length ? warnings.map((warning) => warning.label).join('; ') : 'Khong co',
          `${formatDate(activatedTime(item))} ${formatTime(activatedTime(item))}`,
          remainingLabel(days),
          activeStatusInfo(item, extra).label,
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `active-prescriptions-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function runSafetyCheck(type) {
    const item = activeDisplayItems.find((entry) => prescriptionIdOf(entry) === selectedId) || activeDisplayItems[0] || activeSource[0]
    const id = prescriptionIdOf(item)
    if (!id) {
      toast.info('Chọn một đơn thuốc đang hoạt động để kiểm tra an toàn thuốc.')
      return
    }

    setActionBusy(`${id}:safety:${type}`)
    try {
      const extra = enrichment[id] || {}
      const items = safeArray(extra.items).length ? safeArray(extra.items) : await doctorApi.prescriptions.listItems(id)
      const payload = {
        prescription_id: id,
        patient_id: item.patient_id,
        encounter_id: encounterId(item),
        items,
        medications: items,
      }
      if (type === 'allergy') await doctorApi.prescriptions.checkAllergyConflict(payload)
      if (type === 'interaction') await doctorApi.prescriptions.checkInteractionConflict(payload)
      if (type === 'duplicate') await doctorApi.prescriptions.checkDuplicateMedication(payload)
      toast.success('Đã kiểm tra an toàn thuốc bằng API.')
      setEnrichment((current) => ({
        ...current,
        [id]: { ...(current[id] || {}), items: safeArray(items) },
      }))
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể kiểm tra an toàn thuốc.'))
    } finally {
      setActionBusy('')
    }
  }

  const needComplete = filtered.filter((item) => statusGroup(item.status) === 'pending').slice(0, 3)
  const alerts = filtered
    .map((item) => ({ item, alert: alertInfo(item, enrichment[prescriptionIdOf(item)] || {}) }))
    .filter(({ alert }) => alert.type !== 'none')
    .slice(0, 4)
  const activities = filtered.slice(0, 3)
  const activeWarningCards = activeSource
    .map((item) => ({ item, warnings: activeWarnings(item, enrichment[prescriptionIdOf(item)] || {}) }))
    .filter(({ warnings }) => warnings.length)
    .slice(0, 4)
  const endingPrescriptions = activeSource
    .filter((item) => {
      const days = remainingDays(item, enrichment[prescriptionIdOf(item)] || {})
      return days >= 0 && days <= 3 && statusGroup(item.status) !== 'cancelled'
    })
    .slice(0, 3)
  const activeActivities = activeSource.slice(0, 4)

  if (isActiveView) {
    return (
      <div className="doctor-prescription-page doctor-prescription-active-page">
        <header className="doctor-prescription-header">
          <div>
            <h1>Đơn thuốc đang hoạt động</h1>
            <p>Theo dõi các đơn thuốc còn hiệu lực, cảnh báo an toàn và tiến trình sử dụng.</p>
          </div>
          <div className="doctor-prescription-header__right">
            <button className="doctor-prescription-date" type="button">
              <CalendarDays size={18} />
              <span>{todayLabel(today)}</span>
              <ChevronDown size={15} />
            </button>
            <div className="doctor-prescription-profile">
              <span>{getInitials(user?.fullName || user?.full_name || user?.name) || 'BS'}</span>
              <div>
                <strong>{user?.fullName || user?.full_name || user?.name || 'Bác sĩ'}</strong>
                <small>Khoa Khám bệnh</small>
              </div>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>

        {state.error ? <div className="doctor-prescription-error">{state.error}</div> : null}

        <section className="doctor-prescription-kpis" aria-label="Tổng quan đơn thuốc đang hoạt động">
          <KpiCard icon={CalendarCheck2} tone="green" label="Đơn đang hoạt động" value={activeStats.total} hint={`+${Math.max(0, activeStats.total - stats.active)} đơn so với hôm qua`} />
          <KpiCard icon={UsersRound} tone="blue" label="Bệnh nhân đang dùng thuốc" value={activeStats.patientsUsing} hint={`+${Math.max(0, activeStats.patientsUsing - stats.patientsWithActive)} bệnh nhân so với hôm qua`} />
          <KpiCard icon={AlertTriangle} tone="orange" label="Có cảnh báo" value={activeStats.warnings} hint={`${percent(activeStats.warnings, activeStats.total)}% tổng số đơn`} />
          <KpiCard icon={Clock3} tone="purple" label="Sắp hoàn tất" value={activeStats.ending} hint={`${percent(activeStats.ending, activeStats.total)}% tổng số đơn`} />
        </section>

        <section className="doctor-prescription-active-layout">
          <main className="doctor-prescription-active-main">
            <article className="doctor-prescription-panel doctor-prescription-active-filter">
              <label className="doctor-prescription-search">
                <Search size={16} />
                <input
                  value={searchTerm}
                  placeholder="Tìm kiếm theo mã đơn, bệnh nhân, thuốc..."
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <label>
                <span>Trạng thái:</span>
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="normal">Đang dùng</option>
                  <option value="warning">Có cảnh báo</option>
                  <option value="ending">Sắp hoàn tất</option>
                  <option value="expired">Hết hạn</option>
                  <option value="stopped">Ngưng sử dụng</option>
                </select>
              </label>
              <label>
                <span>Cảnh báo:</span>
                <select value={alertFilter} onChange={(event) => { setAlertFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="allergy">Dị ứng</option>
                  <option value="interaction">Tương tác</option>
                  <option value="duplicate">Trùng thuốc</option>
                  <option value="highDose">Liều cao</option>
                </select>
              </label>
              <label>
                <span>Khoa/Phòng:</span>
                <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="pk 101">PK 101</option>
                  <option value="pk 102">PK 102</option>
                  <option value="pk 103">PK 103</option>
                </select>
              </label>
              <button type="button" onClick={reload}><Filter size={15} /> Bộ lọc</button>
            </article>

            <article className="doctor-prescription-panel doctor-prescription-active-alerts">
              <header>
                <h2>Cảnh báo cần xem</h2>
                <button type="button" onClick={() => setStatusFilter('warning')}>Xem tất cả</button>
              </header>
              <div>
                {activeWarningCards.length ? activeWarningCards.map(({ item, warnings }, index) => (
                  <button type="button" key={prescriptionIdOf(item) || index} onClick={() => openPrescription(item)}>
                    <PatientAvatar name={patientName(item)} />
                    <span>
                      <b>{patientName(item)}</b>
                      <small>{encounterCode(item)}</small>
                      <small>{prescriptionCode(item, index)}</small>
                    </span>
                    <em>
                      {warnings.slice(0, 2).map((warning) => (
                        <i className={`is-${warning.tone}`} key={warning.type}>{warning.label}</i>
                      ))}
                    </em>
                  </button>
                )) : <p>Không có cảnh báo cần xem.</p>}
              </div>
            </article>

            <article className="doctor-prescription-panel doctor-prescription-active-table-card">
              <h2>Danh sách đơn đang hoạt động</h2>
              <div className="doctor-prescription-active-table-head">
                <span>Mã đơn</span>
                <span>Bệnh nhân</span>
                <span>Thuốc chính</span>
                <span>Encounter</span>
                <span>Cảnh báo</span>
                <span>Ngày kích hoạt</span>
                <span>Còn hiệu lực</span>
                <span>Trạng thái</span>
                <span>Thao tác</span>
              </div>
              <div className="doctor-prescription-active-table">
                {state.loading ? (
                  <div className="doctor-prescription-empty">Đang tải đơn thuốc đang hoạt động...</div>
                ) : activeDisplayItems.length ? activeDisplayItems.map((item, index) => {
                  const id = prescriptionIdOf(item)
                  const extra = enrichment[id] || {}
                  const warnings = activeWarnings(item, extra)
                  const status = activeStatusInfo(item, extra)
                  const days = remainingDays(item, extra)
                  return (
                    <div className={`doctor-prescription-active-row${selectedId === id ? ' is-selected' : ''}`} key={id || prescriptionCode(item, index)}>
                      <strong>{prescriptionCode(item, index)}</strong>
                      <span className="doctor-prescription-person">
                        <PatientAvatar name={patientName(item)} />
                        <span>
                          <b>{patientName(item)}</b>
                          <small>{[patientCode(item), item.patient_age ? `${item.patient_age} tuổi` : '', item.patient_gender].filter(Boolean).join(' • ') || '--'}</small>
                        </span>
                      </span>
                      <span className="doctor-prescription-medications">{medicationNames(item, extra).split('\n').map((line) => <b key={line}>{line}</b>)}</span>
                      <span className="doctor-prescription-encounter">
                        <b>{encounterCode(item)}</b>
                        <small>{[formatDate(prescribedTime(item)), roomName(item)].filter(Boolean).join(' • ')}</small>
                      </span>
                      <span className="doctor-prescription-warning-tags">
                        {warnings.length ? warnings.slice(0, 2).map((warning) => (
                          <i className={`doctor-prescription-alert is-${warning.tone}`} key={warning.type}>{warning.label}</i>
                        )) : <i>-</i>}
                      </span>
                      <span className="doctor-prescription-time">
                        <b>{formatDate(activatedTime(item))}</b>
                        <small>{formatTime(activatedTime(item))}</small>
                      </span>
                      <strong className={days <= 0 ? 'is-red' : days <= 2 ? 'is-orange' : 'is-green'}>{remainingLabel(days)}</strong>
                      <span className={`doctor-prescription-status is-${status.tone}`}>{status.label}</span>
                      <span className="doctor-prescription-actions">
                        <button type="button" onClick={() => openPrescription(item)}><Eye size={13} /> Xem chi tiết</button>
                        {status.group === 'ending' || status.group === 'expired' ? (
                          <button type="button" disabled={actionBusy === `${id}:complete`} onClick={() => runAction(item, 'complete')}>Hoàn tất</button>
                        ) : status.group === 'stopped' ? (
                          <button type="button" disabled={actionBusy === `${id}:cancel`} onClick={() => runAction(item, 'cancel')}>Hủy</button>
                        ) : null}
                        <button type="button" aria-label="Tùy chọn đơn thuốc" onClick={() => setSelectedId(id)}><ChevronDown size={14} /></button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-prescription-empty">Chưa có đơn thuốc đang hoạt động phù hợp.</div>
                )}
              </div>
              <footer className="doctor-prescription-footer">
                <button type="button" disabled>Hiển thị <strong>{PAGE_SIZE}</strong> dòng</button>
                <div>
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
                  {Array.from({ length: Math.min(5, activeTotalPages) }, (_, index) => index + 1).map((pageNumber) => (
                    <button className={pageNumber === page ? 'is-active' : ''} type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                  ))}
                  <button type="button" disabled={page >= activeTotalPages} onClick={() => setPage((current) => Math.min(activeTotalPages, current + 1))}><ChevronRight size={15} /></button>
                </div>
                <span>Hiển thị {activeTotal ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, activeTotal)}` : '0'} của {activeTotal.toLocaleString('vi-VN')} đơn đang hoạt động</span>
              </footer>
            </article>

            <section className="doctor-prescription-active-bottom">
              <article className="doctor-prescription-panel doctor-prescription-active-ending">
                <header><h2>Đơn sắp kết thúc</h2><button type="button" onClick={() => setStatusFilter('ending')}>Xem tất cả</button></header>
                {endingPrescriptions.length ? endingPrescriptions.map((item, index) => {
                  const extra = enrichment[prescriptionIdOf(item)] || {}
                  return (
                    <button type="button" key={prescriptionIdOf(item) || index} onClick={() => openPrescription(item)}>
                      <PatientAvatar name={patientName(item)} />
                      <b>{prescriptionCode(item, index)}</b>
                      <span>{patientName(item)}</span>
                      <em>{medicationNames(item, extra).split('\n')[0]}</em>
                      <strong>{remainingLabel(remainingDays(item, extra))}</strong>
                    </button>
                  )
                }) : <p>Không có đơn sắp kết thúc.</p>}
              </article>

              <article className="doctor-prescription-panel doctor-prescription-active-activity">
                <header><h2>Hoạt động gần đây</h2><button type="button">Xem tất cả</button></header>
                {activeActivities.length ? activeActivities.map((item, index) => (
                  <div key={prescriptionIdOf(item) || index}>
                    <CheckCircle2 size={15} />
                    <span>
                      <b>{statusGroup(item.status) === 'cancelled' ? 'Hủy đơn' : statusGroup(item.status) === 'active' ? 'Kích hoạt đơn' : 'Cập nhật đơn'} {prescriptionCode(item, index)} cho {patientName(item)}</b>
                      <small>{formatDate(activatedTime(item) || prescribedTime(item))} - {formatTime(activatedTime(item) || prescribedTime(item))}</small>
                    </span>
                  </div>
                )) : <p>Chưa có hoạt động gần đây.</p>}
              </article>
            </section>
          </main>

          <aside className="doctor-prescription-side">
            <article className="doctor-prescription-panel doctor-prescription-overview">
              <header><h2>Tổng quan hoạt động</h2></header>
              <div className="doctor-prescription-overview__top">
                <ActiveDonut stats={activeStats} />
                <dl>
                  <div><dt><i className="is-blue" /> Bình thường</dt><dd>{activeStats.normal} ({percent(activeStats.normal, activeStats.total)}%)</dd></div>
                  <div><dt><i className="is-red" /> Có cảnh báo</dt><dd>{activeStats.warnings} ({percent(activeStats.warnings, activeStats.total)}%)</dd></div>
                  <div><dt><i className="is-orange" /> Sắp hoàn tất</dt><dd>{activeStats.ending} ({percent(activeStats.ending, activeStats.total)}%)</dd></div>
                  <div><dt><i /> Ngưng sử dụng</dt><dd>{activeStats.stopped} ({percent(activeStats.stopped, activeStats.total)}%)</dd></div>
                </dl>
              </div>
            </article>

            <article className="doctor-prescription-panel doctor-prescription-active-safety">
              <h2>Thống kê an toàn thuốc</h2>
              <div><AlertTriangle size={16} /><span>Tỷ lệ cảnh báo</span><strong>{percent(activeStats.warnings, activeStats.total)}%</strong></div>
              <div><ShieldAlert size={16} /><span>Dị ứng</span><strong>{activeStats.allergy} đơn</strong></div>
              <div><Clock3 size={16} /><span>Tương tác</span><strong>{activeStats.interaction} đơn</strong></div>
              <div><Clock3 size={16} /><span>Trùng thuốc</span><strong>{activeStats.duplicate} đơn</strong></div>
              <div><Clock3 size={16} /><span>Liều dùng cao</span><strong>{activeStats.highDose} đơn</strong></div>
            </article>

            <article className="doctor-prescription-panel doctor-prescription-quick">
              <h2>Thao tác nhanh</h2>
              <button type="button" disabled={actionBusy.includes(':safety:allergy')} onClick={() => runSafetyCheck('allergy')}>
                <span><ShieldAlert size={20} /></span>
                <b>Kiểm tra dị ứng</b>
                <small>Kiểm tra dị ứng thuốc cho đơn thuốc</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" disabled={actionBusy.includes(':safety:interaction')} onClick={() => runSafetyCheck('interaction')}>
                <span><Stethoscope size={20} /></span>
                <b>Kiểm tra tương tác</b>
                <small>Kiểm tra tương tác thuốc</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" disabled={actionBusy.includes(':safety:duplicate')} onClick={() => runSafetyCheck('duplicate')}>
                <span><RefreshCw size={20} /></span>
                <b>Kiểm tra trùng thuốc</b>
                <small>Kiểm tra trùng lặp thuốc trong đơn</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={exportActiveCsv} disabled={!activeFiltered.length}>
                <span><Download size={20} /></span>
                <b>Xuất danh sách</b>
                <small>Xuất báo cáo đơn đang hoạt động</small>
                <ChevronRight size={18} />
              </button>
            </article>
          </aside>
        </section>
      </div>
    )
  }

  if (isEncounterView) {
    const selectedCounts = {
      total: selectedEncounterPrescriptions.length,
      active: selectedEncounterPrescriptions.filter((item) => statusGroup(item.status) === 'active').length,
      completed: selectedEncounterPrescriptions.filter((item) => statusGroup(item.status) === 'completed').length,
      pending: selectedEncounterPrescriptions.filter((item) => statusGroup(item.status) === 'pending').length,
      cancelled: selectedEncounterPrescriptions.filter((item) => statusGroup(item.status) === 'cancelled').length,
    }

    return (
      <div className="doctor-prescription-page doctor-prescription-encounter-page">
        <header className="doctor-prescription-header">
          <div>
            <h1>Đơn thuốc theo encounter</h1>
            <p>Theo dõi và quản lý các đơn thuốc được kê trong từng encounter.</p>
          </div>
          <div className="doctor-prescription-header__right">
            <button className="doctor-prescription-date" type="button">
              <CalendarDays size={18} />
              <span>{todayLabel(today)}</span>
              <ChevronDown size={15} />
            </button>
            <div className="doctor-prescription-profile">
              <span>{getInitials(user?.fullName || user?.full_name || user?.name) || 'BS'}</span>
              <div>
                <strong>{user?.fullName || user?.full_name || user?.name || 'Bác sĩ'}</strong>
                <small>Khoa Khám bệnh</small>
              </div>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>

        {state.error ? <div className="doctor-prescription-error">{state.error}</div> : null}

        <section className="doctor-prescription-kpis" aria-label="Tổng quan đơn thuốc theo encounter">
          <KpiCard icon={CalendarCheck2} tone="blue" label="Encounter có đơn thuốc" value={encounterStats.withPrescriptions} hint={`${percent(encounterStats.withPrescriptions, encounterStats.totalEncounters)}% tổng số encounter`} />
          <KpiCard icon={FileText} tone="green" label="Tổng đơn thuốc" value={encounterStats.totalPrescriptions} hint="100% tổng số đơn" />
          <KpiCard icon={Clock3} tone="orange" label="Đang hoạt động" value={encounterStats.activePrescriptions} hint={`${percent(encounterStats.activePrescriptions, encounterStats.totalPrescriptions)}% tổng số đơn`} />
          <KpiCard icon={CheckCircle2} tone="purple" label="Đã hoàn tất" value={encounterStats.completedPrescriptions} hint={`${percent(encounterStats.completedPrescriptions, encounterStats.totalPrescriptions)}% tổng số đơn`} />
        </section>

        <section className="doctor-prescription-encounter-grid">
          <main className="doctor-prescription-encounter-main">
            <article className="doctor-prescription-panel doctor-prescription-encounter-filter">
              <label className="doctor-prescription-search">
                <Search size={16} />
                <input
                  value={searchTerm}
                  placeholder="Tìm kiếm encounter, bệnh nhân..."
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <label>
                <span>Thời gian</span>
                <select value={timeFilter} onChange={(event) => { setTimeFilter(event.target.value); setPage(1) }}>
                  <option value="30d">01/05/2025 - 20/05/2025</option>
                  <option value="7d">7 ngày qua</option>
                  <option value="today">Hôm nay</option>
                  <option value="all">Tất cả</option>
                </select>
              </label>
              <label>
                <span>Trạng thái</span>
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="pending">Chờ hoàn tất</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="cancelled">Hủy</option>
                </select>
              </label>
              <label>
                <span>Loại đơn</span>
                <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="pending">Chờ ký consultation</option>
                </select>
              </label>
              <button className="is-primary" type="button" onClick={reload}><Filter size={15} /> Áp dụng</button>
              <button type="button" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); setTimeFilter('30d'); setPage(1) }}><RotateCcw size={15} /> Đặt lại</button>
            </article>

            <article className="doctor-prescription-panel doctor-prescription-encounter-list">
              <h2>Danh sách encounter</h2>
              <div className="doctor-prescription-encounter-table-head">
                <span>Mã encounter</span>
                <span>Bệnh nhân</span>
                <span>Bác sĩ</span>
                <span>Tổng đơn thuốc</span>
                <span>Đang hoạt động</span>
                <span>Hoàn tất</span>
                <span>Chờ ký consultation</span>
                <span>Thao tác</span>
              </div>
              <div className="doctor-prescription-encounter-table">
                {state.loading ? (
                  <div className="doctor-prescription-empty">Đang tải danh sách encounter...</div>
                ) : displayEncounters.length ? displayEncounters.map((group) => {
                  const key = group.id || group.code
                  return (
                    <div className={`doctor-prescription-encounter-row${selectedEncounterKey === key ? ' is-selected' : ''}`} key={key}>
                      <strong>{group.code}</strong>
                      <span className="doctor-prescription-person">
                        <PatientAvatar name={group.patientName} />
                        <span>
                          <b>{group.patientName}</b>
                          <small>{[group.patientCode, group.patientGender, group.patientAge ? `${group.patientAge} tuổi` : ''].filter(Boolean).join(' • ')}</small>
                        </span>
                      </span>
                      <span className="doctor-prescription-encounter-doctor">
                        <b>{group.doctorName}</b>
                        <small>Khoa Khám bệnh</small>
                      </span>
                      <strong>{group.total}</strong>
                      <strong className="is-orange">{group.active}</strong>
                      <strong className="is-green">{group.completed}</strong>
                      <strong className="is-orange">{group.pending}</strong>
                      <span className="doctor-prescription-actions">
                        <button type="button" onClick={() => setSelectedEncounterKey(key)}><Eye size={13} /> Xem chi tiết</button>
                        <button type="button" aria-label="Tùy chọn encounter" onClick={() => setSelectedEncounterKey(key)}><ChevronDown size={14} /></button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-prescription-empty">Chưa có encounter phù hợp.</div>
                )}
              </div>
              <footer className="doctor-prescription-footer">
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

            <article className="doctor-prescription-panel doctor-prescription-encounter-detail">
              <header>
                <h2>Chi tiết đơn thuốc của encounter {selectedEncounter?.code || '--'}</h2>
                <span>{selectedCounts.total} đơn thuốc</span>
              </header>
              <div className="doctor-prescription-encounter-detail-head">
                <span>Mã đơn</span>
                <span>Thuốc / đơn</span>
                <span>Số lượng thuốc</span>
                <span>Trạng thái</span>
                <span>Thời gian tạo</span>
                <span>Người kê</span>
                <span>Thao tác</span>
              </div>
              <div className="doctor-prescription-encounter-detail-table">
                {encounterDetail.loading ? (
                  <div className="doctor-prescription-empty">Đang tải đơn thuốc thuộc encounter...</div>
                ) : selectedEncounterPrescriptions.length ? selectedEncounterPrescriptions.map((item, index) => {
                  const id = prescriptionIdOf(item)
                  const extra = enrichment[id] || {}
                  return (
                    <div className="doctor-prescription-encounter-detail-row" key={id || prescriptionCode(item, index)}>
                      <strong>{prescriptionCode(item, index)}</strong>
                      <span>{itemCount(item, extra) || '--'} loại thuốc</span>
                      <strong>{itemCount(item, extra) || '--'}</strong>
                      <StatusBadge status={item.status} />
                      <span>{formatDate(prescribedTime(item))}<small>{formatTime(prescribedTime(item))}</small></span>
                      <strong>{doctorName(item)}</strong>
                      <span className="doctor-prescription-actions">
                        <button type="button" onClick={() => openPrescription(item)}><Eye size={13} /> Xem chi tiết</button>
                        <button type="button" aria-label="Tùy chọn đơn thuốc" onClick={() => setSelectedId(id)}><ChevronDown size={14} /></button>
                      </span>
                    </div>
                  )
                }) : (
                  <div className="doctor-prescription-empty">Encounter này chưa có đơn thuốc.</div>
                )}
              </div>
            </article>
          </main>

          <aside className="doctor-prescription-side">
            <article className="doctor-prescription-panel doctor-prescription-overview">
              <header><h2>Tổng quan encounter</h2></header>
              <div className="doctor-prescription-overview__top">
                <EncounterDonut stats={encounterStats} />
                <dl>
                  <div><dt><i className="is-blue" /> Hoàn tất</dt><dd>{encounterStats.completedEncounters} ({percent(encounterStats.completedEncounters, encounterStats.totalEncounters)}%)</dd></div>
                  <div><dt><i className="is-green" /> Đang xử lý</dt><dd>{encounterStats.activeEncounters} ({percent(encounterStats.activeEncounters, encounterStats.totalEncounters)}%)</dd></div>
                  <div><dt><i className="is-orange" /> Chờ ký consultation</dt><dd>{encounterStats.pendingEncounters} ({percent(encounterStats.pendingEncounters, encounterStats.totalEncounters)}%)</dd></div>
                  <div><dt><i className="is-red" /> Hủy</dt><dd>{encounterStats.cancelledEncounters} ({percent(encounterStats.cancelledEncounters, encounterStats.totalEncounters)}%)</dd></div>
                </dl>
              </div>
            </article>

            <article className="doctor-prescription-panel doctor-prescription-encounter-info">
              <h2>Thông tin encounter</h2>
              <dl>
                <div><dt>Mã encounter</dt><dd>{selectedEncounter?.code || '--'}</dd></div>
                <div><dt>Thời gian</dt><dd>{selectedEncounter ? `${formatDate(selectedEncounter.firstTime)} ${formatTime(selectedEncounter.firstTime)}` : '--'}</dd></div>
                <div><dt>Bệnh nhân</dt><dd>{selectedEncounter ? `${selectedEncounter.patientName}${selectedEncounter.patientAge ? ` • ${selectedEncounter.patientAge} tuổi` : ''}${selectedEncounter.patientGender ? ` • ${selectedEncounter.patientGender}` : ''}` : '--'}</dd></div>
                <div><dt>Phòng khám</dt><dd>{selectedEncounter?.room || 'Phòng khám Nội tổng quát 1'}</dd></div>
                <div><dt>Trạng thái encounter</dt><dd><StatusBadge status={selectedEncounter?.status} /></dd></div>
              </dl>
              <div className="doctor-prescription-encounter-info-cards">
                <span><CalendarCheck2 size={15} /><b>Consultation</b><strong>1</strong></span>
                <span><FileText size={15} /><b>Đơn thuốc</b><strong>{selectedCounts.total}</strong></span>
                <span><Clock3 size={15} /><b>Chỉ định</b><strong>{selectedCounts.active + selectedCounts.pending}</strong></span>
              </div>
            </article>

            <article className="doctor-prescription-panel doctor-prescription-quick">
              <h2>Thao tác nhanh</h2>
              <button type="button" onClick={() => toast.info('Tạo đơn thuốc mới dùng POST /prescriptions/encounters/:encounterId/prescriptions với encounter đang chọn.')}>
                <span><Plus size={20} /></span>
                <b>Tạo đơn thuốc mới</b>
                <small>Tạo đơn thuốc cho encounter này</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => selectedEncounterPrescriptions[0] ? doctorApi.prescriptions.getSummary(prescriptionIdOf(selectedEncounterPrescriptions[0])).then(() => toast.info('Đã tải summary đơn thuốc từ API.')) : toast.info('Encounter chưa có đơn thuốc.')}>
                <span><FileText size={20} /></span>
                <b>Xem summary</b>
                <small>Xem tổng quan đơn thuốc</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => selectedEncounterPrescriptions[0] ? openPrescription(selectedEncounterPrescriptions[0]) : toast.info('Encounter chưa có đơn thuốc để mở timeline.')}>
                <span><Clock3 size={20} /></span>
                <b>Mở timeline</b>
                <small>Xem lịch sử hoạt động</small>
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
    <div className="doctor-prescription-page">
      <header className="doctor-prescription-header">
        <div>
          <h1>Đơn thuốc của tôi</h1>
          <p>Quản lý và theo dõi các đơn thuốc do bạn kê đơn cho bệnh nhân.</p>
        </div>
        <div className="doctor-prescription-header__right">
          <button className="doctor-prescription-date" type="button">
            <CalendarDays size={18} />
            <span>{todayLabel(today)}</span>
            <ChevronDown size={15} />
          </button>
          <div className="doctor-prescription-profile">
            <span>{getInitials(user?.fullName || user?.full_name || user?.name) || 'BS'}</span>
            <div>
              <strong>{user?.fullName || user?.full_name || user?.name || 'Bác sĩ'}</strong>
              <small>Khoa Khám bệnh</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </header>

      {state.error ? <div className="doctor-prescription-error">{state.error}</div> : null}

      <section className="doctor-prescription-kpis" aria-label="Tổng quan đơn thuốc">
        <KpiCard icon={CalendarCheck2} tone="blue" label="Tổng đơn thuốc" value={stats.total.toLocaleString('vi-VN')} hint="100% tổng số đơn" />
        <KpiCard icon={CalendarDays} tone="green" label="Đang hoạt động" value={stats.active} hint={`${percent(stats.active, stats.total)}% tổng số đơn`} />
        <KpiCard icon={Clock3} tone="orange" label="Chờ hoàn tất" value={stats.pending} hint={`${percent(stats.pending, stats.total)}% tổng số đơn`} />
        <KpiCard icon={CheckCircle2} tone="purple" label="Đã hoàn tất" value={stats.completed} hint={`${percent(stats.completed, stats.total)}% tổng số đơn`} />
      </section>

      <section className="doctor-prescription-grid">
        <main className="doctor-prescription-main">
          <article className="doctor-prescription-panel doctor-prescription-table-card">
            <div className="doctor-prescription-toolbar">
              <label className="doctor-prescription-search">
                <Search size={16} />
                <input
                  value={searchTerm}
                  placeholder="Tìm kiếm theo mã đơn, bệnh nhân..."
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <label>
                <span>Trạng thái:</span>
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}>
                  <option value="all">Tất cả</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="pending">Chờ hoàn tất</option>
                  <option value="completed">Hoàn tất</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </label>
              <label>
                <span>Thời gian:</span>
                <select value={timeFilter} onChange={(event) => { setTimeFilter(event.target.value); setPage(1) }}>
                  <option value="30d">30 ngày gần đây</option>
                  <option value="7d">7 ngày qua</option>
                  <option value="today">Hôm nay</option>
                  <option value="all">Tất cả</option>
                </select>
              </label>
              <button type="button" onClick={reload}><Filter size={15} /> Bộ lọc</button>
            </div>

            <div className="doctor-prescription-table-head">
              <span />
              <span>Mã đơn</span>
              <span>Bệnh nhân</span>
              <span>Encounter</span>
              <span>Số thuốc</span>
              <span>Trạng thái</span>
              <span>Ngày kê</span>
              <span>Cảnh báo</span>
              <span>Thao tác</span>
            </div>
            <div className="doctor-prescription-table">
              {state.loading ? (
                <div className="doctor-prescription-empty">Đang tải danh sách đơn thuốc...</div>
              ) : displayItems.length ? displayItems.map((item, index) => {
                const id = prescriptionIdOf(item)
                const extra = enrichment[id] || {}
                const alert = alertInfo(item, extra)
                const action = primaryAction(item)
                return (
                  <div className={`doctor-prescription-row${selectedId === id ? ' is-selected' : ''}`} key={id || prescriptionCode(item, index)}>
                    <input type="checkbox" aria-label={`Chọn ${prescriptionCode(item, index)}`} />
                    <strong>{prescriptionCode(item, index)}</strong>
                    <span className="doctor-prescription-person">
                      <PatientAvatar name={patientName(item)} />
                      <span>
                        <b>{patientName(item)}</b>
                        <small>{[patientCode(item), item.patient_age ? `${item.patient_age} tuổi` : '', item.patient_gender].filter(Boolean).join(' • ') || '--'}</small>
                      </span>
                    </span>
                    <span className="doctor-prescription-encounter">
                      <b>{encounterCode(item)}</b>
                      <small>{[formatDate(prescribedTime(item)), roomName(item)].filter(Boolean).join(' • ')}</small>
                    </span>
                    <strong>{itemCount(item, extra)}</strong>
                    <StatusBadge status={item.status} />
                    <span className="doctor-prescription-time">
                      <b>{formatDate(prescribedTime(item))}</b>
                      <small>{formatTime(prescribedTime(item))}</small>
                    </span>
                    <AlertBadge alert={alert} />
                    <span className="doctor-prescription-actions">
                      <button type="button" onClick={() => openPrescription(item)}><Eye size={13} /> Xem chi tiết</button>
                      {action ? (
                        <button type="button" disabled={actionBusy === `${id}:${action.key}`} onClick={() => runAction(item, action.key)}>
                          {action.label}
                        </button>
                      ) : null}
                      <button type="button" aria-label="Tùy chọn đơn thuốc" onClick={() => setSelectedId(id)}><ChevronDown size={14} /></button>
                    </span>
                  </div>
                )
              }) : (
                <div className="doctor-prescription-empty">Chưa có đơn thuốc phù hợp.</div>
              )}
            </div>
            <footer className="doctor-prescription-footer">
              <button type="button" disabled>Hiển thị <strong>{PAGE_SIZE}</strong> dòng</button>
              <div>
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                  <button className={pageNumber === page ? 'is-active' : ''} type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                ))}
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={15} /></button>
              </div>
              <span>Hiển thị {total ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, total)}` : '0'} của {total.toLocaleString('vi-VN')} đơn thuốc</span>
            </footer>
          </article>

          <section className="doctor-prescription-bottom">
            <article className="doctor-prescription-panel doctor-prescription-mini-list">
              <header><h2>Đơn cần hoàn tất ({stats.pending})</h2><button type="button" onClick={() => setStatusFilter('pending')}>Xem tất cả</button></header>
              {needComplete.length ? needComplete.map((item, index) => (
                <button type="button" key={prescriptionIdOf(item) || index} onClick={() => openPrescription(item)}>
                  <PatientAvatar name={patientName(item)} />
                  <b>{patientName(item)}</b>
                  <span>{patientCode(item)}</span>
                  <em>{alertInfo(item, enrichment[prescriptionIdOf(item)] || {}).label}</em>
                  <time>{formatTime(prescribedTime(item))}</time>
                  <small>{formatDate(prescribedTime(item))}</small>
                </button>
              )) : <p>Không có đơn chờ hoàn tất.</p>}
            </article>

            <article className="doctor-prescription-panel doctor-prescription-warning-list">
              <header><h2>Cảnh báo thuốc ({stats.warnings})</h2><button type="button">Xem tất cả</button></header>
              {alerts.length ? alerts.map(({ alert }, index) => (
                <div key={`${alert.type}-${index}`}>
                  <ShieldAlert size={16} />
                  <b>{alert.type === 'allergy' ? 'Dị ứng thuốc' : alert.type === 'interaction' ? 'Tương tác thuốc' : 'Trùng thuốc'}</b>
                  <strong>{alert.label.replace(/[^\d]/g, '') || 1} trường hợp</strong>
                </div>
              )) : <p>Không có cảnh báo cần xem.</p>}
            </article>

            <article className="doctor-prescription-panel doctor-prescription-activity">
              <header><h2>Hoạt động gần đây</h2><button type="button">Xem tất cả</button></header>
              {activities.length ? activities.map((item, index) => (
                <div key={prescriptionIdOf(item) || index}>
                  <CheckCircle2 size={15} />
                  <span>
                    <b>{statusGroup(item.status) === 'completed' ? 'Hoàn tất đơn' : statusGroup(item.status) === 'active' ? 'Đã kê đơn' : 'Cập nhật đơn'} {prescriptionCode(item, index)}</b>
                    <small>{formatTime(prescribedTime(item))} • {formatDate(prescribedTime(item))}</small>
                  </span>
                </div>
              )) : <p>Chưa có hoạt động gần đây.</p>}
            </article>
          </section>
        </main>

        <aside className="doctor-prescription-side">
          <article className="doctor-prescription-panel doctor-prescription-overview">
            <header><h2>Tổng quan đơn thuốc</h2></header>
            <div className="doctor-prescription-overview__top">
              <Donut stats={stats} />
              <dl>
                <div><dt><i className="is-green" /> Đang hoạt động</dt><dd>{stats.active} ({percent(stats.active, stats.total)}%)</dd></div>
                <div><dt><i className="is-orange" /> Chờ hoàn tất</dt><dd>{stats.pending} ({percent(stats.pending, stats.total)}%)</dd></div>
                <div><dt><i className="is-blue" /> Đã hoàn tất</dt><dd>{stats.completed} ({percent(stats.completed, stats.total)}%)</dd></div>
                <div><dt><i className="is-red" /> Đã hủy</dt><dd>{stats.cancelled} ({percent(stats.cancelled, stats.total)}%)</dd></div>
              </dl>
            </div>
            <div className="doctor-prescription-overview__rows">
              <div><span>Tỷ lệ đơn đang hoạt động</span><strong>{percent(stats.active, stats.total)}%</strong></div>
              <div><span>Tỷ lệ hoàn tất</span><strong>{percent(stats.completed, stats.total)}%</strong></div>
              <div><span>Bệnh nhân có đơn đang hoạt động</span><strong>{stats.patientsWithActive}</strong></div>
              <div><span>Cảnh báo cần xem</span><strong className="is-red">{stats.warnings}</strong></div>
              <div><span>Thời gian kê trung bình</span><strong>3 phút</strong></div>
            </div>
          </article>

          <article className="doctor-prescription-panel doctor-prescription-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => toast.info('Tạo đơn thuốc cần encounter đang chọn để gọi POST /prescriptions/encounters/:encounterId/prescriptions.')}>
              <span><Plus size={20} /></span>
              <b>Tạo đơn thuốc</b>
              <small>Kê đơn thuốc mới cho bệnh nhân</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={reload}>
              <span><RefreshCw size={20} /></span>
              <b>Làm mới danh sách</b>
              <small>Cập nhật danh sách đơn thuốc</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={exportCsv} disabled={!filtered.length}>
              <span><Download size={20} /></span>
              <b>Xuất danh sách</b>
              <small>Xuất file đơn thuốc</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => selectedId ? toast.info('Có thể kiểm tra dị ứng, tương tác và thuốc trùng bằng các endpoint conflict.') : toast.info('Chọn đơn thuốc để kiểm tra tương tác.')}>
              <span><Stethoscope size={20} /></span>
              <b>Kiểm tra tương tác</b>
              <small>Kiểm tra tương tác thuốc</small>
              <ChevronRight size={18} />
            </button>
          </article>
        </aside>
      </section>
    </div>
  )
}
