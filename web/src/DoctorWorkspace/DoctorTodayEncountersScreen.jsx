import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Beaker,
  CalendarDays,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Droplet,
  FilePenLine,
  FileText,
  FileSpreadsheet,
  FolderOpen,
  HeartPulse,
  Hourglass,
  Image as ImageIcon,
  Pause,
  Pill,
  Play,
  RotateCcw,
  Printer,
  Search,
  Stethoscope,
  Syringe,
  Thermometer,
  UserRound,
} from 'lucide-react'
import { doctorApi, getDoctorId } from './doctorApi'
import { formatTime, getInitials, safeArray, toLocalDateKey } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './toast/ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 10

const statusMeta = {
  planned: { label: 'Chờ bắt đầu', tone: 'blue', group: 'waiting' },
  waiting: { label: 'Chờ bắt đầu', tone: 'blue', group: 'waiting' },
  arrived: { label: 'Đã đến', tone: 'blue', group: 'waiting' },
  in_progress: { label: 'Đang khám', tone: 'green', group: 'active' },
  on_hold: { label: 'Tạm dừng', tone: 'orange', group: 'hold' },
  completed: { label: 'Đã hoàn tất', tone: 'green', group: 'completed' },
  cancelled: { label: 'Đã hủy', tone: 'red', group: 'cancelled' },
}

const typeLabels = {
  outpatient: 'Khám ngoại trú',
  inpatient: 'Tái khám nội trú',
  emergency: 'Khám cấp cứu',
  telemedicine: 'Tư vấn từ xa',
}

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

function idOf(encounter = {}) {
  return encounter.encounter_id || encounter.id || encounter._id || ''
}

function patientOf(encounter = {}) {
  return encounter.patient || {}
}

function patientName(encounter = {}) {
  const patient = patientOf(encounter)
  return encounter.patient_name || patient.full_name || patient.fullName || patient.name || 'Bệnh nhân'
}

function patientCode(encounter = {}) {
  const patient = patientOf(encounter)
  return encounter.patient_code || patient.patient_code || patient.patientCode || encounter.patient_id || ''
}

function getAge(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDiff = now.getMonth() - date.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age -= 1
  return age > 0 ? age : ''
}

function genderLabel(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'male' || normalized === 'nam') return 'Nam'
  if (normalized === 'female' || normalized === 'nữ' || normalized === 'nu') return 'Nữ'
  return value || ''
}

function patientMeta(encounter = {}) {
  const patient = patientOf(encounter)
  const age = encounter.patient_age || patient.age || getAge(patient.date_of_birth)
  return [
    genderLabel(encounter.patient_gender || patient.gender),
    age ? `${age} tuổi` : '',
    patientCode(encounter) ? `#${patientCode(encounter)}` : '',
  ].filter(Boolean).join(', ')
}

function doctorName(encounter = {}, user = {}) {
  const doctor = encounter.attending_doctor || encounter.doctor || {}
  return encounter.doctor_name || doctor.full_name || user.fullName || user.full_name || user.name || 'Bác sĩ'
}

function departmentName(encounter = {}) {
  const department = encounter.department || {}
  return encounter.department_name || department.department_name || department.name || '--'
}

function roomName(encounter = {}) {
  return encounter.room_name || encounter.clinic_room || encounter.room || encounter.location || '--'
}

function reasonText(encounter = {}) {
  return encounter.chief_reason || encounter.reason || typeLabels[encounter.encounter_type] || 'Khám định kỳ'
}

function specialtyText(encounter = {}) {
  return encounter.specialty || departmentName(encounter)
}

function statusInfo(encounter = {}) {
  const raw = String(encounter.status || encounter.raw_status || '').toLowerCase()
  return statusMeta[raw] || { label: raw ? raw.replace(/_/g, ' ') : 'Không rõ', tone: 'slate', group: 'other' }
}

function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function todayLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'short' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleDateString('vi-VN')}`
}

function elapsedText(encounter = {}) {
  const start = new Date(encounter.started_at || encounter.start_time || encounter.created_at)
  if (Number.isNaN(start.getTime())) return '--'
  const minutes = Math.max(0, Math.round((Date.now() - start.getTime()) / 60000))
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(0).padStart(2, '0')}`
}

function durationMinutes(encounter = {}) {
  const start = new Date(encounter.started_at || encounter.start_time || encounter.created_at)
  const end = encounter.end_time ? new Date(encounter.end_time) : new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function averageDuration(encounters = []) {
  const active = encounters.filter((item) => ['active', 'completed', 'hold'].includes(statusInfo(item).group))
  if (!active.length) return 0
  return Math.round(active.reduce((sum, item) => sum + durationMinutes(item), 0) / active.length)
}

function countFrom(value, keys = []) {
  for (const key of keys) {
    const numeric = Number(value?.[key])
    if (Number.isFinite(numeric)) return numeric
  }
  return 0
}

function latestVital(clinicalSummary) {
  return clinicalSummary?.latest_vital_signs || clinicalSummary?.latestVitals || null
}

function diagnosisText(clinicalSummary) {
  const primary = clinicalSummary?.primary_diagnosis
  if (primary?.diagnosis_name || primary?.icd10_code) {
    return {
      main: primary.diagnosis_name || primary.icd10_code,
      code: primary.icd10_code || '',
    }
  }
  return { main: 'Chưa có chẩn đoán chính', code: '' }
}

function actionLabel(action = '') {
  const normalized = String(action).replace(/^encounter\./, '')
  const labels = {
    create: 'Tạo phiên khám',
    arrive: 'Bệnh nhân đã đến',
    start: 'Bắt đầu consultation',
    hold: 'Tạm dừng phiên khám',
    resume: 'Tiếp tục phiên khám',
    complete: 'Hoàn tất phiên khám',
    reopen: 'Mở lại phiên khám',
    cancel: 'Hủy phiên khám',
    update: 'Cập nhật phiên khám',
  }
  return labels[normalized] || normalized.replace(/[_-]+/g, ' ')
}

function timeOrDash(value) {
  return value ? formatTime(value) : '--'
}

function pickSelected(encounters = [], selectedId = '') {
  if (selectedId) {
    const selected = encounters.find((item) => idOf(item) === selectedId)
    if (selected) return selected
  }
  return encounters.find((item) => statusInfo(item).group === 'active')
    || encounters.find((item) => statusInfo(item).group === 'hold')
    || encounters[0]
    || null
}

function StatCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <article className="doctor-encounter-ref-stat">
      <span className={`doctor-encounter-ref-stat__icon is-${tone}`}>
        <Icon size={30} strokeWidth={2.2} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  )
}

function StatusPill({ encounter }) {
  const status = statusInfo(encounter)
  return <span className={`doctor-encounter-ref-status is-${status.tone}`}>{status.label}</span>
}

function Donut({ dashboard }) {
  const total = dashboard.total || 1
  const activeEnd = percent(dashboard.active, total)
  const waitingEnd = activeEnd + percent(dashboard.waiting, total)
  const completedEnd = waitingEnd + percent(dashboard.completed, total)
  const holdEnd = completedEnd + percent(dashboard.onHold, total)
  const style = {
    '--active-end': `${activeEnd}%`,
    '--waiting-end': `${waitingEnd}%`,
    '--completed-end': `${completedEnd}%`,
    '--hold-end': `${holdEnd}%`,
  }

  return (
    <div className="doctor-encounter-ref-donut" style={style}>
      <div>
        <strong>{dashboard.total}</strong>
        <span>Tổng phiên khám</span>
      </div>
    </div>
  )
}

function PatientAvatar({ encounter, size = 'md' }) {
  return (
    <span className={`doctor-encounter-ref-avatar is-${size}`}>
      {getInitials(patientName(encounter)) || 'BN'}
    </span>
  )
}

function Stepper({ encounter, enrichment }) {
  const status = String(encounter?.status || '').toLowerCase()
  const signed = Boolean(enrichment?.readiness?.has_signed_consultation)
  const completed = status === 'completed'
  const steps = [
    { label: 'Đến khám', time: timeOrDash(encounter?.start_time), done: true },
    { label: 'Consultation', time: timeOrDash(encounter?.started_at || encounter?.start_time), done: ['in_progress', 'on_hold', 'completed'].includes(status) },
    { label: 'Chỉ định', time: enrichment?.orderCount ? 'Đã có' : '--', done: enrichment?.orderCount > 0 || signed },
    { label: 'Kê đơn', time: enrichment?.prescriptionCount ? 'Đã có' : '--', done: enrichment?.prescriptionCount > 0 },
    { label: 'Hoàn tất', time: timeOrDash(encounter?.end_time), done: completed },
  ]

  return (
    <div className="doctor-encounter-ref-stepper">
      {steps.map((step) => (
        <div className={step.done ? 'is-done' : ''} key={step.label}>
          <span>{step.done ? <Check size={14} /> : null}</span>
          <strong>{step.label}</strong>
          <small>{step.time}</small>
        </div>
      ))}
    </div>
  )
}

async function enrichEncounter(encounter) {
  const encounterId = idOf(encounter)
  if (!encounterId) return null

  const [summary, orderSummary, readiness] = await Promise.all([
    settledValue(doctorApi.encounters.getSummary(encounterId), null),
    settledValue(doctorApi.orders.getEncounterSummary(encounterId), null),
    settledValue(doctorApi.encounters.getReadiness(encounterId), null),
  ])

  return [
    encounterId,
    {
      consultationCount: countFrom(summary, ['signed_consultations_count', 'consultations_count']),
      prescriptionCount: countFrom(summary, ['prescriptions_count', 'active_prescriptions_count']),
      diagnosisCount: countFrom(summary, ['diagnoses_count', 'active_diagnoses_count']),
      orderCount: countFrom(orderSummary, ['total_orders', 'orders_count', 'total']),
      labOrderCount: countFrom(orderSummary, ['lab_orders_count', 'lab_count']),
      imagingOrderCount: countFrom(orderSummary, ['imaging_orders_count', 'imaging_count']),
      queueTicket: summary?.queue_ticket || null,
      medicalRecord: summary?.medical_record || null,
      readiness,
    },
  ]
}

async function loadSelectedEncounter(encounter) {
  const encounterId = idOf(encounter)
  if (!encounterId) return null

  const [detail, summary, timeline, clinicalSummary, readiness, orderSummary] = await Promise.all([
    settledValue(doctorApi.encounters.getDetail(encounterId), null),
    settledValue(doctorApi.encounters.getSummary(encounterId), null),
    settledValue(doctorApi.encounters.getTimeline(encounterId, { limit: 6 }), []),
    settledValue(doctorApi.encounters.getClinicalSummary(encounterId), null),
    settledValue(doctorApi.encounters.getReadiness(encounterId), null),
    settledValue(doctorApi.orders.getEncounterSummary(encounterId), null),
  ])

  return {
    detail: detail || encounter,
    summary,
    timeline: safeArray(timeline),
    clinicalSummary,
    readiness,
    orderSummary,
  }
}

async function loadEncounters(user, view) {
  const today = getTodayDate()
  const doctorId = getDoctorId(user)
  const baseParams = { limit: 200, ...(doctorId ? { doctor_id: doctorId } : {}) }

  let encounters = []
  if (view === 'active' && doctorId) {
    encounters = await doctorApi.encounters.listActiveByDoctor(doctorId, { limit: 200 })
  } else if (view === 'completed') {
    encounters = await doctorApi.encounters.listToday({ ...baseParams, status: 'completed' })
  } else {
    encounters = await doctorApi.encounters.listToday(baseParams)
  }

  const deduped = new Map()
  safeArray(encounters).forEach((encounter) => {
    const id = idOf(encounter) || `${encounter.patient_id}-${encounter.start_time}`
    if (id) deduped.set(id, encounter)
  })

  const items = Array.from(deduped.values())
    .filter((encounter) => {
      if (view === 'active') return ['arrived', 'in_progress', 'on_hold', 'waiting'].includes(String(encounter.status || '').toLowerCase())
      if (view === 'completed') return String(encounter.status || '').toLowerCase() === 'completed'
      const key = toLocalDateKey(encounter.start_time || encounter.started_at || encounter.created_at)
      return key === today
    })
    .sort((left, right) => new Date(left.start_time || left.created_at) - new Date(right.start_time || right.created_at))

  return { today, encounters: items }
}

export function DoctorTodayEncountersScreen({ user, view = 'today' }) {
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, error: '', data: { today: getTodayDate(), encounters: [] } })
  const [page, setPage] = useState(1)
  const [actingId, setActingId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [enrichment, setEnrichment] = useState({})
  const [selectedData, setSelectedData] = useState({ loading: false, data: null })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadEncounters(user, view)
      .then((data) => {
        setPage(1)
        setState({ loading: false, error: '', data })
      })
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải danh sách phiên khám.'),
        data: { today: getTodayDate(), encounters: [] },
      }))
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadEncounters(user, view)
      .then((data) => {
        if (active) {
          setPage(1)
          setState({ loading: false, error: '', data })
        }
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải danh sách phiên khám.'),
            data: { today: getTodayDate(), encounters: [] },
          })
        }
      })

    return () => {
      active = false
    }
  }, [user, view])

  const encounterIds = useMemo(
    () => safeArray(state.data.encounters).map(idOf).filter(Boolean).join('|'),
    [state.data.encounters],
  )

  useEffect(() => {
    let active = true
    const missing = safeArray(state.data.encounters).filter((encounter) => {
      const id = idOf(encounter)
      return id && !enrichment[id]
    })

    if (!missing.length) return undefined

    Promise.all(missing.map(enrichEncounter)).then((entries) => {
      if (!active) return
      setEnrichment((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(Boolean)),
      }))
    })

    return () => {
      active = false
    }
  }, [encounterIds, enrichment, state.data.encounters])

  const dashboard = useMemo(() => {
    const encounters = safeArray(state.data.encounters)
    const active = encounters.filter((item) => statusInfo(item).group === 'active').length
    const waiting = encounters.filter((item) => statusInfo(item).group === 'waiting').length
    const completed = encounters.filter((item) => statusInfo(item).group === 'completed').length
    const onHold = encounters.filter((item) => statusInfo(item).group === 'hold').length
    const total = encounters.length
    const needSign = encounters.filter((item) => {
      const info = enrichment[idOf(item)]
      return info?.readiness && !info.readiness.has_signed_consultation
    }).length
    const activePrescription = encounters.filter((item) => enrichment[idOf(item)]?.readiness?.has_active_prescription).length
    const first = encounters[0] || null

    return {
      encounters,
      total,
      active,
      waiting,
      completed,
      onHold,
      needSign,
      activePrescription,
      activeRate: percent(active, total),
      waitingRate: percent(waiting, total),
      completedRate: percent(completed, total),
      onHoldRate: percent(onHold, total),
      needSignRate: percent(needSign, total),
      activePrescriptionRate: percent(activePrescription, total),
      averageMinutes: averageDuration(encounters),
      first,
    }
  }, [state.data.encounters, enrichment])

  const filterOptions = useMemo(() => {
    const encounters = safeArray(state.data.encounters)
    return {
      specialties: Array.from(new Set(encounters.map(specialtyText).filter((value) => value && value !== '--'))),
      rooms: Array.from(new Set(encounters.map(roomName).filter((value) => value && value !== '--'))),
    }
  }, [state.data.encounters])

  const displayEncounters = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase()
    return dashboard.encounters.filter((encounter) => {
      const searchable = [
        patientName(encounter),
        patientCode(encounter),
        encounter.encounter_code,
        reasonText(encounter),
        specialtyText(encounter),
      ].filter(Boolean).join(' ').toLowerCase()

      return (!keyword || searchable.includes(keyword))
        && (specialtyFilter === 'all' || specialtyText(encounter) === specialtyFilter)
        && (roomFilter === 'all' || roomName(encounter) === roomFilter)
    })
  }, [dashboard.encounters, roomFilter, searchTerm, specialtyFilter])

  const selectedEncounter = useMemo(() => pickSelected(dashboard.encounters, selectedId), [dashboard.encounters, selectedId])
  const selectedEncounterId = idOf(selectedEncounter || {})

  useEffect(() => {
    if (!selectedEncounterId) {
      setSelectedData({ loading: false, data: null })
      return undefined
    }

    let active = true
    setSelectedData((current) => ({ ...current, loading: true }))
    loadSelectedEncounter(selectedEncounter).then((data) => {
      if (active) setSelectedData({ loading: false, data })
    })

    return () => {
      active = false
    }
  }, [selectedEncounterId])

  const totalPages = Math.max(1, Math.ceil(displayEncounters.length / PAGE_SIZE))
  const pageRows = displayEncounters.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selected = selectedData.data?.detail || selectedEncounter || {}
  const selectedExtra = {
    ...(enrichment[selectedEncounterId] || {}),
    ...(selectedData.data?.readiness ? { readiness: selectedData.data.readiness } : {}),
  }
  const clinicalSummary = selectedData.data?.clinicalSummary || null
  const vital = latestVital(clinicalSummary)
  const diagnosis = diagnosisText(clinicalSummary)

  async function runAction(encounter, type) {
    const encounterId = idOf(encounter)
    if (!encounterId) {
      toast.error('Không tìm thấy mã phiên khám.')
      return
    }

    setActingId(`${type}:${encounterId}`)
    try {
      if (type === 'arrive') await doctorApi.encounters.arrive(encounterId)
      if (type === 'start') await doctorApi.encounters.start(encounterId)
      if (type === 'hold') await doctorApi.encounters.hold(encounterId)
      if (type === 'resume') await doctorApi.encounters.resume(encounterId)
      if (type === 'complete') await doctorApi.encounters.complete(encounterId)
      if (type === 'reopen') await doctorApi.encounters.reopen(encounterId)
      toast.success('Đã cập nhật phiên khám.')
      setEnrichment((current) => {
        const next = { ...current }
        delete next[encounterId]
        return next
      })
      reload()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác phiên khám.'))
    } finally {
      setActingId('')
    }
  }

  function primaryAction(encounter) {
    const status = String(encounter.status || '').toLowerCase()
    if (['planned', 'arrived', 'waiting'].includes(status)) return { label: 'Bắt đầu', type: 'start', icon: Play, primary: true }
    if (status === 'on_hold') return { label: 'Tiếp tục', type: 'resume', icon: Play, primary: true }
    if (status === 'completed') return { label: 'Mở hồ sơ', type: 'record', icon: FolderOpen, primary: false }
    if (status === 'in_progress') return { label: 'Tiếp tục', type: 'open', icon: Play, primary: true }
    return { label: 'Tiếp tục', type: 'open', icon: Play, primary: false }
  }

  function handlePrimary(encounter) {
    const action = primaryAction(encounter)
    setSelectedId(idOf(encounter))
    if (action.type === 'open' || action.type === 'record') {
      toast.info('Đã chọn phiên khám để xem chi tiết dữ liệu thật.')
      return
    }
    runAction(encounter, action.type)
  }

  const completedSummary = useMemo(() => {
    const completed = dashboard.encounters.filter((item) => statusInfo(item).group === 'completed')
    const signed = completed.filter((item) => {
      const extra = enrichment[idOf(item)] || {}
      return extra.readiness?.has_signed_consultation || extra.consultationCount > 0
    }).length
    const withPrescription = completed.filter((item) => (enrichment[idOf(item)]?.prescriptionCount || 0) > 0).length
    const needSupplement = Math.max(0, completed.length - signed)
    const noPrescription = Math.max(0, completed.length - withPrescription)

    return {
      total: completed.length,
      signed,
      withPrescription,
      needSupplement,
      noPrescription,
      signedRate: percent(signed, completed.length),
      prescriptionRate: percent(withPrescription, completed.length),
      supplementRate: percent(needSupplement, completed.length),
      noPrescriptionRate: percent(noPrescription, completed.length),
      averageMinutes: averageDuration(completed),
    }
  }, [dashboard.encounters, enrichment])

  function conclusionLabel(encounter) {
    return encounter.conclusion || encounter.disposition || encounter.outcome || (enrichment[idOf(encounter)]?.medicalRecord?.status || 'Chưa ghi nhận')
  }

  function conclusionTone(label = '') {
    const value = String(label).toLowerCase()
    if (value.includes('xuất') || value.includes('closed')) return 'green'
    if (value.includes('theo') || value.includes('pending')) return 'orange'
    if (value.includes('tái') || value.includes('active')) return 'blue'
    return 'slate'
  }

  function exportCompletedCsv() {
    const rows = [
      ['Gio kham', 'Benh nhan', 'Ma benh nhan', 'Chuyen khoa', 'Hoan tat luc', 'Consultation', 'Don thuoc', 'Chi dinh', 'Ket luan'],
      ...displayEncounters.map((encounter) => {
        const extra = enrichment[idOf(encounter)] || {}
        return [
          formatTime(encounter.start_time || encounter.started_at),
          patientName(encounter),
          patientCode(encounter),
          specialtyText(encounter),
          formatTime(encounter.end_time || encounter.updated_at),
          extra.readiness?.has_signed_consultation || extra.consultationCount > 0 ? 'Da ky' : 'Chua ky',
          extra.prescriptionCount > 0 ? 'Co toa' : 'Khong toa',
          extra.orderCount > 0 ? 'Co chi dinh' : 'Khong chi dinh',
          conclusionLabel(encounter),
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `completed-encounters-${state.data.today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (view === 'completed') {
    return (
      <div className="doctor-encounter-ref-page is-completed">
        <header className="doctor-encounter-ref-header">
          <div>
            <h1>Phiên khám đã hoàn tất</h1>
            <p>Theo dõi lịch sử các phiên khám đã hoàn tất, hồ sơ đã ký và kết quả xử lý.</p>
          </div>
          <div className="doctor-encounter-ref-header__right">
            <button className="doctor-encounter-ref-date" type="button">
              <CalendarDays size={18} />
              <span>{todayLabel(state.data.today)}</span>
              <ChevronDown size={15} />
            </button>
            <div className="doctor-encounter-ref-profile">
              <span>{getInitials(doctorName({}, user)) || 'BS'}</span>
              <div>
                <strong>{doctorName({}, user)}</strong>
                <small>{departmentName(dashboard.first || {})}</small>
              </div>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>

        {state.error ? <div className="doctor-encounter-ref-error">{state.error}</div> : null}

        <section className="doctor-encounter-ref-stats" aria-label="Tổng quan phiên khám đã hoàn tất">
          <StatCard icon={CheckCircle2} tone="purple" label="Đã hoàn tất hôm nay" value={completedSummary.total} hint={`${completedSummary.total ? percent(completedSummary.total, dashboard.total || completedSummary.total) : 0}% tổng số`} />
          <StatCard icon={FilePenLine} tone="green" label="Đã ký consultation" value={completedSummary.signed} hint={`${completedSummary.signedRate}% tổng số`} />
          <StatCard icon={Pill} tone="blue" label="Có đơn thuốc" value={completedSummary.withPrescription} hint={`${completedSummary.prescriptionRate}% tổng số`} />
          <StatCard icon={Clock3} tone="orange" label="Thời gian khám TB" value={`${completedSummary.averageMinutes} phút`} hint="Dựa trên start_time và end_time thật" />
        </section>

        <section className="doctor-encounter-completed-grid">
          <article className="doctor-encounter-ref-panel doctor-encounter-completed-list">
            <header>
              <h2>Danh sách phiên đã hoàn tất</h2>
            </header>

            <div className="doctor-encounter-completed-filters">
              <label className="doctor-encounter-completed-search">
                <Search size={14} />
                <input
                  value={searchTerm}
                  placeholder="Tìm kiếm bệnh nhân, mã HSBA, lý do khám..."
                  onChange={(event) => {
                    setSearchTerm(event.target.value)
                    setPage(1)
                  }}
                />
              </label>
              <button type="button">
                <CalendarDays size={14} />
                <span>{state.data.today} - {state.data.today}</span>
                <ChevronDown size={14} />
              </button>
              <select value={specialtyFilter} onChange={(event) => { setSpecialtyFilter(event.target.value); setPage(1) }}>
                <option value="all">Tất cả chuyên khoa</option>
                {filterOptions.specialties.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value="completed" disabled>
                <option value="completed">Tất cả trạng thái</option>
              </select>
              <select value={roomFilter} onChange={(event) => { setRoomFilter(event.target.value); setPage(1) }}>
                <option value="all">Tất cả phòng</option>
                {filterOptions.rooms.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className="doctor-encounter-completed-table-head">
              <span>Giờ khám</span>
              <span>Bệnh nhân</span>
              <span>Chuyên khoa / Lý do khám</span>
              <span>Hoàn tất lúc</span>
              <span>Consultation</span>
              <span>Đơn thuốc</span>
              <span>Chỉ định</span>
              <span>Kết luận</span>
              <span>Thao tác</span>
            </div>

            <div className="doctor-encounter-completed-table">
              {state.loading ? (
                <div className="doctor-encounter-ref-empty">Đang tải danh sách phiên khám đã hoàn tất...</div>
              ) : pageRows.length ? pageRows.map((encounter, index) => {
                const encounterId = idOf(encounter) || `completed-${index}`
                const extra = enrichment[encounterId] || {}
                const signed = extra.readiness?.has_signed_consultation || extra.consultationCount > 0
                const hasPrescription = extra.prescriptionCount > 0
                const hasOrders = extra.orderCount > 0
                const conclusion = conclusionLabel(encounter)
                return (
                  <div
                    className={`doctor-encounter-completed-row${encounterId === selectedEncounterId ? ' is-selected' : ''}`}
                    key={encounterId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(encounterId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedId(encounterId)
                      }
                    }}
                  >
                    <strong>{timeOrDash(encounter.start_time || encounter.started_at)}</strong>
                    <span className="doctor-encounter-ref-patient">
                      <PatientAvatar encounter={encounter} size="sm" />
                      <span>
                        <b>{patientName(encounter)}</b>
                        <small>{patientMeta(encounter)}</small>
                      </span>
                    </span>
                    <span className="doctor-encounter-ref-reason">
                      <b>{specialtyText(encounter)}</b>
                      <small>{reasonText(encounter)}</small>
                    </span>
                    <strong>{timeOrDash(encounter.end_time || encounter.updated_at)}</strong>
                    <span className={`doctor-encounter-completed-badge ${signed ? 'is-green' : 'is-orange'}`}>{signed ? 'Đã ký' : 'Chưa ký'}</span>
                    <span className={`doctor-encounter-completed-badge ${hasPrescription ? 'is-green' : 'is-slate'}`}>{hasPrescription ? 'Có toa' : 'Không toa'}</span>
                    <span className={`doctor-encounter-completed-badge ${hasOrders ? 'is-green' : 'is-slate'}`}>{hasOrders ? 'Có chỉ định' : 'Không chỉ định'}</span>
                    <span className={`doctor-encounter-completed-badge is-${conclusionTone(conclusion)}`}>{conclusion}</span>
                    <span className="doctor-encounter-completed-actions" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => setSelectedId(encounterId)}>Xem hồ sơ</button>
                      <button type="button" onClick={() => toast.info('Dữ liệu tóm tắt lấy từ API encounter summary.')}>
                        <Printer size={12} /> In tóm tắt
                      </button>
                      <button type="button" aria-label="Tùy chọn">
                        <ChevronDown size={13} />
                      </button>
                    </span>
                  </div>
                )
              }) : (
                <div className="doctor-encounter-ref-empty">Chưa có phiên khám đã hoàn tất phù hợp.</div>
              )}
            </div>

            <footer className="doctor-encounter-ref-footer">
              <button type="button">
                Hiển thị <strong>{PAGE_SIZE}</strong> dòng <ChevronDown size={14} />
              </button>
              <div>
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, item) => item + 1).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    className={pageNumber === page ? 'is-active' : ''}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                  <ChevronRight size={15} />
                </button>
              </div>
              <span>
                Hiển thị {displayEncounters.length ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, displayEncounters.length)}` : '0'} của {displayEncounters.length} phiên đã hoàn tất
              </span>
            </footer>
          </article>

          <aside className="doctor-encounter-ref-side">
            <article className="doctor-encounter-ref-panel doctor-encounter-ref-overview">
              <header>
                <h2>Tổng quan hoàn tất</h2>
              </header>
              <div className="doctor-encounter-completed-overview-top">
                <div
                  className="doctor-encounter-completed-donut"
                  style={{
                    '--signed-end': `${completedSummary.signedRate}%`,
                    '--rx-end': `${completedSummary.signedRate + completedSummary.prescriptionRate}%`,
                    '--supplement-end': `${completedSummary.signedRate + completedSummary.prescriptionRate + completedSummary.supplementRate}%`,
                  }}
                >
                  <div>
                    <strong>{completedSummary.total}</strong>
                    <span>Phiên hoàn tất</span>
                  </div>
                </div>
                <dl>
                  <div><dt><i className="is-green" /> Đã ký consultation</dt><dd>{completedSummary.signed} ({completedSummary.signedRate}%)</dd></div>
                  <div><dt><i className="is-blue" /> Có đơn thuốc</dt><dd>{completedSummary.withPrescription} ({completedSummary.prescriptionRate}%)</dd></div>
                  <div><dt><i className="is-orange" /> Cần bổ sung hồ sơ</dt><dd>{completedSummary.needSupplement} ({completedSummary.supplementRate}%)</dd></div>
                  <div><dt><i className="is-slate" /> Không có toa</dt><dd>{completedSummary.noPrescription} ({completedSummary.noPrescriptionRate}%)</dd></div>
                </dl>
              </div>
              <div className="doctor-encounter-ref-overview__list">
                <div><CheckCircle2 size={17} /><span>Tỷ lệ ký</span><strong>{completedSummary.signedRate}% ({completedSummary.signed}/{completedSummary.total})</strong></div>
                <div><Pill size={17} /><span>Tỷ lệ có đơn thuốc</span><strong>{completedSummary.prescriptionRate}% ({completedSummary.withPrescription}/{completedSummary.total})</strong></div>
                <div><UserRound size={17} /><span>Bác sĩ phụ trách</span><strong>{doctorName(dashboard.first || {}, user)}</strong></div>
                <div><Clock3 size={17} /><span>Thời gian khám TB</span><strong>{completedSummary.averageMinutes} phút</strong></div>
              </div>
            </article>

            <article className="doctor-encounter-ref-panel doctor-encounter-ref-quick">
              <h2>Thao tác nhanh</h2>
              <button type="button" onClick={exportCompletedCsv} disabled={!displayEncounters.length}>
                <span><FileSpreadsheet size={20} /></span>
                <b>Xuất danh sách</b>
                <small>Xuất file Excel danh sách đã hoàn tất</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => navigate('/doctor/reports?view=performance')}>
                <span><BarChart3 size={20} /></span>
                <b>Xem báo cáo</b>
                <small>Báo cáo hiệu suất và thống kê</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => selectedEncounterId && toast.info('Tóm tắt được lấy từ /encounters/:id/summary.') } disabled={!selectedEncounterId}>
                <span><Printer size={20} /></span>
                <b>In summary</b>
                <small>In tóm tắt các phiên đã hoàn tất</small>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={() => selectedEncounterId && setSelectedId(selectedEncounterId)} disabled={!selectedEncounterId}>
                <span><FileText size={20} /></span>
                <b>Mở bệnh án</b>
                <small>Truy cập hồ sơ bệnh án điện tử</small>
                <ChevronRight size={18} />
              </button>
            </article>
          </aside>
        </section>

        <section className="doctor-encounter-ref-bottom">
          <article className="doctor-encounter-ref-panel">
            <header>
              <h2>Consultation cần bổ sung</h2>
              <button type="button">Xem tất cả</button>
            </header>
            <div className="doctor-encounter-ref-watch-list">
              {dashboard.encounters.filter((item) => {
                const extra = enrichment[idOf(item)] || {}
                return !(extra.readiness?.has_signed_consultation || extra.consultationCount > 0)
              }).slice(0, 4).map((encounter) => (
                <button type="button" key={`unsigned-${idOf(encounter)}`} onClick={() => setSelectedId(idOf(encounter))}>
                  <PatientAvatar encounter={encounter} size="sm" />
                  <span>
                    <b>{patientName(encounter)}</b>
                    <small>{genderLabel(patientOf(encounter).gender)}, {patientCode(encounter)}</small>
                  </span>
                  <small>{specialtyText(encounter)}</small>
                  <strong>{timeOrDash(encounter.end_time || encounter.updated_at)}</strong>
                  <em>Chưa ký</em>
                </button>
              ))}
            </div>
          </article>
          <article className="doctor-encounter-ref-panel doctor-encounter-ref-timeline-panel">
            <header>
              <h2>Hoạt động hoàn tất gần đây</h2>
              <button type="button">Xem tất cả</button>
            </header>
            <div className="doctor-encounter-ref-timeline is-completed">
              {displayEncounters.slice(0, 4).map((encounter) => (
                <div key={`done-${idOf(encounter)}`}>
                  <time>{timeOrDash(encounter.end_time || encounter.updated_at)}</time>
                  <PatientAvatar encounter={encounter} size="xs" />
                  <strong>{patientName(encounter)}</strong>
                  <span>Hoàn tất phiên khám</span>
                  <b>{conclusionLabel(encounter)}</b>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    )
  }

  return (
    <div className={`doctor-encounter-ref-page is-${view || 'today'}`}>
      <header className="doctor-encounter-ref-header">
        <div>
          <h1>{view === 'active' ? 'Phiên khám đang khám' : view === 'completed' ? 'Phiên khám đã hoàn tất' : 'Phiên khám hôm nay'}</h1>
          <p>Theo dõi các phiên khám đang hoạt động, tiến trình điều trị và thông tin lâm sàng theo thời gian thực.</p>
        </div>
        <div className="doctor-encounter-ref-header__right">
          <button className="doctor-encounter-ref-date" type="button">
            <CalendarDays size={18} />
            <span>{todayLabel(state.data.today)}</span>
            <ChevronDown size={15} />
          </button>
          <div className="doctor-encounter-ref-profile">
            <span>{getInitials(doctorName({}, user)) || 'BS'}</span>
            <div>
              <strong>{doctorName({}, user)}</strong>
              <small>{departmentName(dashboard.first || {})}</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </header>

      {state.error ? <div className="doctor-encounter-ref-error">{state.error}</div> : null}

      <section className="doctor-encounter-ref-stats" aria-label={view === 'active' ? 'Tổng quan phiên khám đang khám' : 'Tổng quan phiên khám hôm nay'}>
        {view === 'active' ? (
          <>
            <StatCard icon={Stethoscope} tone="green" label="Đang khám" value={dashboard.active} hint={`${dashboard.activeRate}% tổng số`} />
            <StatCard icon={CirclePause} tone="orange" label="Tạm dừng" value={dashboard.onHold} hint={`${dashboard.onHoldRate}% tổng số`} />
            <StatCard icon={FilePenLine} tone="purple" label="Chờ ký consultation" value={dashboard.needSign} hint={`${dashboard.needSignRate}% tổng số`} />
            <StatCard icon={Pill} tone="blue" label="Có đơn thuốc hoạt động" value={dashboard.activePrescription} hint={`${dashboard.activePrescriptionRate}% tổng số`} />
          </>
        ) : (
          <>
            <StatCard icon={CalendarDays} tone="blue" label="Tổng phiên khám" value={dashboard.total} hint="100% tổng số hôm nay" />
            <StatCard icon={Stethoscope} tone="green" label="Đang khám" value={dashboard.active} hint={`${dashboard.activeRate}% tổng số`} />
            <StatCard icon={Hourglass} tone="orange" label="Chờ bắt đầu" value={dashboard.waiting} hint={`${dashboard.waitingRate}% tổng số`} />
            <StatCard icon={CheckCircle2} tone="purple" label="Đã hoàn tất" value={dashboard.completed} hint={`${dashboard.completedRate}% tổng số`} />
          </>
        )}
      </section>

      <section className="doctor-encounter-ref-main-grid">
        <article className="doctor-encounter-ref-panel doctor-encounter-ref-list">
          <header>
            <h2>{view === 'active' ? 'Danh sách đang khám' : 'Danh sách phiên khám hôm nay'}</h2>
          </header>

          <div className="doctor-encounter-ref-table-head">
            <span>{view === 'active' ? 'Giờ bắt đầu' : 'Giờ khám'}</span>
            <span>Bệnh nhân</span>
            <span>{view === 'active' ? 'Chuyên khoa / Chẩn đoán chính' : 'Chuyên khoa / Lý do khám'}</span>
            <span>Trạng thái</span>
            <span>Bác sĩ</span>
            <span>Phòng khám</span>
            <span>Consultation</span>
            <span>Đơn thuốc</span>
            <span>Chỉ định</span>
            <span>Thao tác</span>
          </div>

          <div className="doctor-encounter-ref-table">
            {state.loading ? (
              <div className="doctor-encounter-ref-empty">Đang tải danh sách phiên khám...</div>
            ) : pageRows.length ? pageRows.map((encounter, index) => {
              const encounterId = idOf(encounter) || `encounter-${index}`
              const action = primaryAction(encounter)
              const ActionIcon = action.icon
              const extra = enrichment[encounterId] || {}
              return (
                <div
                  className={`doctor-encounter-ref-row${encounterId === selectedEncounterId ? ' is-selected' : ''}`}
                  key={encounterId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(encounterId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(encounterId)
                    }
                  }}
                >
                  <strong>{formatTime(encounter.start_time || encounter.started_at || encounter.created_at)}</strong>
                  <span className="doctor-encounter-ref-patient">
                    <PatientAvatar encounter={encounter} size="sm" />
                    <span>
                      <b>{patientName(encounter)}</b>
                      <small>{patientMeta(encounter)}</small>
                    </span>
                  </span>
                  <span className="doctor-encounter-ref-reason">
                    <b>{specialtyText(encounter)}</b>
                    <small>{reasonText(encounter)}</small>
                  </span>
                  <span><StatusPill encounter={encounter} /></span>
                  <span className="doctor-encounter-ref-cell-strong">{doctorName(encounter, user)}</span>
                  <span className="doctor-encounter-ref-cell-strong">{roomName(encounter)}</span>
                  <span className="doctor-encounter-ref-count">{extra.consultationCount ?? '-'}</span>
                  <span className="doctor-encounter-ref-count">{extra.prescriptionCount ?? '-'}</span>
                  <span className="doctor-encounter-ref-count">{extra.orderCount ?? '-'}</span>
                  <span className="doctor-encounter-ref-actions" onClick={(event) => event.stopPropagation()}>
                    <button
                      className={action.primary ? 'is-primary' : ''}
                      type="button"
                      onClick={() => handlePrimary(encounter)}
                      disabled={Boolean(actingId)}
                    >
                      <ActionIcon size={14} />
                      {action.label}
                    </button>
                    <button type="button" aria-label="Tùy chọn phiên khám">
                      <ChevronDown size={14} />
                    </button>
                  </span>
                </div>
              )
            }) : (
              <div className="doctor-encounter-ref-empty">Chưa có phiên khám phù hợp.</div>
            )}
          </div>

          <footer className="doctor-encounter-ref-footer">
            <button type="button">
              Hiển thị <strong>{PAGE_SIZE}</strong> dòng <ChevronDown size={14} />
            </button>
            <div>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.min(4, totalPages) }, (_, item) => item + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  className={pageNumber === page ? 'is-active' : ''}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                <ChevronRight size={15} />
              </button>
            </div>
            <span>
              Hiển thị {dashboard.total ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, dashboard.total)}` : '0'} của {dashboard.total} {view === 'active' ? 'phiên đang khám' : 'phiên khám'}
            </span>
          </footer>
        </article>

        <article className="doctor-encounter-ref-panel doctor-encounter-ref-processing">
          <header>
            <h2>Bệnh nhân đang được xử lý</h2>
          </header>
          {selectedEncounterId ? (
            <>
              <div className="doctor-encounter-ref-selected">
                <PatientAvatar encounter={selected} size="lg" />
                <div>
                  <div className="doctor-encounter-ref-selected-title">
                    <h3>{patientName(selected)}</h3>
                    <StatusPill encounter={selected} />
                  </div>
                  <p>{patientMeta(selected)}</p>
                </div>
                <dl>
                  <div>
                    <dt>Mã encounter</dt>
                    <dd>{selected.encounter_code || selectedEncounterId}</dd>
                  </div>
                  <div>
                    <dt>Phòng khám</dt>
                    <dd>{roomName(selected)}</dd>
                  </div>
                  <div>
                    <dt>Bắt đầu</dt>
                    <dd>{timeOrDash(selected.start_time || selected.started_at)}</dd>
                  </div>
                  <div>
                    <dt>Thời gian khám</dt>
                    <dd>{elapsedText(selected)}</dd>
                  </div>
                </dl>
              </div>

              <Stepper encounter={selected} enrichment={selectedExtra} />

              <div className="doctor-encounter-ref-clinical-grid">
                <article>
                  <header>
                    <h3>Sinh hiệu mới nhất</h3>
                    <span>{timeOrDash(vital?.recorded_at || vital?.created_at)}</span>
                  </header>
                  <p><HeartPulse size={15} /> HA <b>{vital?.systolic_bp && vital?.diastolic_bp ? `${vital.systolic_bp}/${vital.diastolic_bp} mmHg` : '--'}</b></p>
                  <p><Activity size={15} /> Mạch <b>{vital?.heart_rate ? `${vital.heart_rate} lần/phút` : '--'}</b></p>
                  <p><Thermometer size={15} /> Nhiệt độ <b>{vital?.temperature ? `${vital.temperature} °C` : '--'}</b></p>
                  <p><Droplet size={15} /> SpO2 <b>{vital?.spo2 ? `${vital.spo2}%` : '--'}</b></p>
                </article>
                <article>
                  <header>
                    <h3>Chẩn đoán</h3>
                  </header>
                  <p><ClipboardCheck size={15} /> Chính <b>{diagnosis.main}</b></p>
                  <p><Syringe size={15} /> Mã ICD <b>{diagnosis.code || '--'}</b></p>
                </article>
                <article>
                  <header>
                    <h3>Orders / chỉ định</h3>
                  </header>
                  <p><Beaker size={15} /> Xét nghiệm <b>{selectedExtra.labOrderCount ?? 0}</b></p>
                  <p><ImageIcon size={15} /> Hình ảnh <b>{selectedExtra.imagingOrderCount ?? 0}</b></p>
                </article>
                <article>
                  <header>
                    <h3>Đơn thuốc</h3>
                  </header>
                  <p><Pill size={15} /> {selectedExtra.readiness?.has_active_prescription ? 'Có đơn thuốc hoạt động' : 'Chưa có đơn thuốc hoạt động'}</p>
                  <p><ClipboardList size={15} /> <b>{selectedExtra.prescriptionCount ?? 0}</b> đơn thuốc</p>
                </article>
              </div>
            </>
          ) : (
            <div className="doctor-encounter-ref-empty">Chưa có bệnh nhân đang xử lý.</div>
          )}
        </article>

        <aside className="doctor-encounter-ref-side">
          <article className="doctor-encounter-ref-panel doctor-encounter-ref-overview">
            <header>
              <h2>{view === 'active' ? 'Tổng quan đang khám' : 'Tổng quan hôm nay'}</h2>
            </header>
            <div className="doctor-encounter-ref-overview__top">
              <Donut dashboard={dashboard} />
              <dl>
                {view === 'active' ? (
                  <>
                    <div><dt><i className="is-green" /> Đang khám</dt><dd>{dashboard.active} ({dashboard.activeRate}%)</dd></div>
                    <div><dt><i className="is-orange" /> Tạm dừng</dt><dd>{dashboard.onHold} ({dashboard.onHoldRate}%)</dd></div>
                    <div><dt><i className="is-purple" /> Cần ký</dt><dd>{dashboard.needSign} ({dashboard.needSignRate}%)</dd></div>
                    <div><dt><i className="is-yellow" /> Có toa thuốc</dt><dd>{dashboard.activePrescription} ({dashboard.activePrescriptionRate}%)</dd></div>
                  </>
                ) : (
                  <>
                    <div><dt><i className="is-green" /> Đang khám</dt><dd>{dashboard.active} ({dashboard.activeRate}%)</dd></div>
                    <div><dt><i className="is-orange" /> Chờ bắt đầu</dt><dd>{dashboard.waiting} ({dashboard.waitingRate}%)</dd></div>
                    <div><dt><i className="is-purple" /> Đã hoàn tất</dt><dd>{dashboard.completed} ({dashboard.completedRate}%)</dd></div>
                    <div><dt><i className="is-yellow" /> Tạm dừng</dt><dd>{dashboard.onHold} ({dashboard.onHoldRate}%)</dd></div>
                  </>
                )}
              </dl>
            </div>
            <div className="doctor-encounter-ref-overview__list">
              <div><UserRound size={17} /><span>Bác sĩ phụ trách</span><strong>{doctorName(dashboard.first || {}, user)}</strong></div>
              {view === 'active' ? (
                <>
                  <div><ClipboardList size={17} /><span>Phòng khám hiện tại</span><strong>{roomName(selected) !== '--' ? roomName(selected) : roomName(dashboard.first || {})}</strong></div>
                  <div><Clock3 size={17} /><span>Thời gian khám TB</span><strong>{dashboard.averageMinutes} phút</strong></div>
                  <div><CheckCircle2 size={17} /><span>Có thể hoàn tất</span><strong>{selectedExtra.readiness?.can_complete ? 'Có' : 'Chưa'}</strong></div>
                </>
              ) : (
                <>
                  <div><ClipboardList size={17} /><span>Khoa / Phòng khám</span><strong>{departmentName(dashboard.first || {})} / {roomName(dashboard.first || {})}</strong></div>
                  <div><Activity size={17} /><span>Tỷ lệ hoàn tất</span><strong>{dashboard.completedRate}% ({dashboard.completed}/{dashboard.total || 0})</strong></div>
                  <div><Clock3 size={17} /><span>Khung giờ cao điểm</span><strong>08:00 - 11:00</strong></div>
                </>
              )}
            </div>
          </article>

          <article className="doctor-encounter-ref-panel doctor-encounter-ref-quick">
            <h2>Thao tác nhanh</h2>
            {view === 'active' ? (
              <>
                <button type="button" onClick={() => selectedEncounterId && runAction(selected, statusInfo(selected).group === 'hold' ? 'resume' : 'start')} disabled={!selectedEncounterId || Boolean(actingId)}>
                  <span><Play size={20} /></span>
                  <b>Tiếp tục encounter</b>
                  <small>Tiếp tục phiên khám đang chọn</small>
                  <ChevronRight size={18} />
                </button>
                <button type="button" onClick={() => selectedEncounterId && runAction(selected, 'complete')} disabled={!selectedEncounterId || Boolean(actingId)}>
                  <span><CheckCircle2 size={20} /></span>
                  <b>Hoàn tất khám</b>
                  <small>Hoàn tất và kết thúc phiên khám</small>
                  <ChevronRight size={18} />
                </button>
                <button type="button" onClick={() => selectedEncounterId && loadSelectedEncounter(selected).then((data) => setSelectedData({ loading: false, data }))} disabled={!selectedEncounterId}>
                  <span><Activity size={20} /></span>
                  <b>Xem timeline</b>
                  <small>Xem tiến trình chi tiết của encounter</small>
                  <ChevronRight size={18} />
                </button>
                <button type="button" onClick={() => navigate('/doctor/orders?view=encounter')} disabled={!selectedEncounterId}>
                  <span><FilePenLine size={20} /></span>
                  <b>Mở consultation</b>
                  <small>Xem và chỉnh sửa consultation hiện tại</small>
                  <ChevronRight size={18} />
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => navigate('/doctor/encounters?view=active')}>
                  <span><CalendarDays size={20} /></span>
                  <b>Tạo encounter</b>
                  <small>Tạo phiên khám mới cho bệnh nhân</small>
                  <ChevronRight size={18} />
                </button>
                <button type="button" onClick={reload}>
                  <span><RotateCcw size={20} /></span>
                  <b>Làm mới danh sách</b>
                  <small>Cập nhật danh sách phiên khám</small>
                  <ChevronRight size={18} />
                </button>
                <button type="button" onClick={() => navigate('/doctor/encounters?view=active')}>
                  <span><UserRound size={20} /></span>
                  <b>Xem đang khám</b>
                  <small>Xem danh sách các phiên đang khám</small>
                  <ChevronRight size={18} />
                </button>
                <button type="button" onClick={exportCompletedCsv}>
                  <span><FileSpreadsheet size={20} /></span>
                  <b>Xuất danh sách</b>
                  <small>Xuất file danh sách phiên khám</small>
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </article>
        </aside>
      </section>

      <section className="doctor-encounter-ref-bottom">
        <article className="doctor-encounter-ref-panel">
          <header>
            <h2>Phiên cần theo dõi</h2>
            <button type="button" onClick={() => navigate('/doctor/encounters?view=active')}>Xem tất cả</button>
          </header>
          <div className="doctor-encounter-ref-watch-list">
            {dashboard.encounters.filter((item) => statusInfo(item).group !== 'completed').slice(0, 3).map((encounter) => {
              const extra = enrichment[idOf(encounter)] || {}
              return (
                <button type="button" key={`watch-${idOf(encounter)}`} onClick={() => setSelectedId(idOf(encounter))}>
                  <PatientAvatar encounter={encounter} size="sm" />
                  <span>
                    <b>{patientName(encounter)}</b>
                    <small>{patientMeta(encounter)}</small>
                  </span>
                  <em>{extra.readiness?.has_signed_consultation ? 'Đã ký' : 'Chờ ký'}</em>
                  <strong>{timeOrDash(encounter.start_time)}</strong>
                </button>
              )
            })}
          </div>
        </article>
        <article className="doctor-encounter-ref-panel doctor-encounter-ref-timeline-panel">
          <header>
            <h2>Timeline hoạt động gần đây</h2>
            <button type="button" onClick={() => selectedEncounterId && loadSelectedEncounter(selected).then((data) => setSelectedData({ loading: false, data }))}>Làm mới</button>
          </header>
          <div className="doctor-encounter-ref-timeline">
            {selectedData.loading ? (
              <div className="doctor-encounter-ref-empty">Đang tải timeline...</div>
            ) : safeArray(selectedData.data?.timeline).length ? safeArray(selectedData.data.timeline).slice(0, 4).map((item, index) => (
              <div key={item.audit_log_id || `${item.action}-${index}`}>
                <time>{timeOrDash(item.created_at)}</time>
                <PatientAvatar encounter={selected} size="xs" />
                <strong>{patientName(selected)}</strong>
                <span>{item.message || actionLabel(item.action)}</span>
                <b>{doctorName(selected, user)}</b>
              </div>
            )) : (
              <div className="doctor-encounter-ref-empty">Chưa có timeline cho phiên khám đang chọn.</div>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
