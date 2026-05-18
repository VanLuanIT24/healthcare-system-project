import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  HeartPulse,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { doctorApi } from './doctorApi'
import { getInitials, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const DEFAULT_PAGE_SIZE = 5

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

function patientIdOf(patient = {}) {
  return patient.patient_id || patient.id || patient._id || ''
}

function patientName(patient = {}) {
  return patient.full_name || patient.fullName || patient.name || 'Bệnh nhân'
}

function patientCode(patient = {}) {
  return patient.patient_code || patient.patientCode || patient.code || patientIdOf(patient)
}

function genderLabel(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'male' || normalized === 'nam') return 'Nam'
  if (normalized === 'female' || normalized === 'nữ' || normalized === 'nu') return 'Nữ'
  return value || '--'
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

function statusInfo(patient = {}, extra = {}) {
  const status = String(patient.status || '').toLowerCase()
  if (extra.activeProblemsCount > 0) return { label: 'Cần theo dõi', tone: 'orange', group: 'watch' }
  if (status === 'active') return { label: 'Ổn định', tone: 'green', group: 'stable' }
  if (status === 'inactive') return { label: 'Ngừng theo dõi', tone: 'slate', group: 'other' }
  if (status === 'archived') return { label: 'Lưu trữ', tone: 'slate', group: 'other' }
  return { label: status || 'Đang theo dõi', tone: 'blue', group: 'follow' }
}

function problemName(item = {}) {
  return item.problem_name || item.name || item.diagnosis_name || item.title || item.icd10_code || 'Vấn đề'
}

function allergyName(item = {}) {
  return item.allergen || item.allergen_name || item.name || item.substance || 'Dị ứng'
}

function appointmentTime(appointment = {}) {
  return appointment.appointment_time || appointment.scheduled_at || appointment.date_time || appointment.created_at || ''
}

function encounterTime(encounter = {}) {
  return encounter.start_time || encounter.started_at || encounter.created_at || ''
}

function doctorNameFromAppointment(appointment = {}) {
  const doctor = appointment.doctor || appointment.attending_doctor || {}
  return appointment.doctor_name || doctor.full_name || doctor.name || ''
}

function specialtyText(patient = {}, extra = {}) {
  const appointment = extra.upcomingAppointment || extra.lastAppointment || {}
  const encounter = extra.lastEncounter || {}
  return patient.department_name
    || patient.specialty
    || appointment.department_name
    || appointment.specialty
    || encounter.department_name
    || encounter.department?.department_name
    || '--'
}

function nextAppointment(extra = {}) {
  const appointment = extra.upcomingAppointment || null
  return appointment ? `${formatDate(appointmentTime(appointment))}\n${formatTime(appointmentTime(appointment))}` : '-'
}

function lastVisit(extra = {}) {
  const encounter = extra.lastEncounter
  const appointment = extra.lastAppointment
  const source = encounterTime(encounter || {}) || appointmentTime(appointment || '')
  const doctor = doctorNameFromAppointment(appointment || {}) || encounter?.doctor_name || encounter?.attending_doctor?.full_name || ''
  return { date: formatDate(source), doctor }
}

function patientPhone(patient = {}) {
  return patient.phone || patient.mobile || patient.telephone || ''
}

function PatientAvatar({ patient }) {
  return <span className="doctor-patient-list-avatar">{getInitials(patientName(patient)) || 'BN'}</span>
}

function KpiCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <article className="doctor-patient-list-kpi">
      <span className={`doctor-patient-list-kpi__icon is-${tone}`}>
        <Icon size={29} strokeWidth={2.1} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  )
}

function StatusBadge({ patient, extra }) {
  const status = statusInfo(patient, extra)
  return <span className={`doctor-patient-list-status is-${status.tone}`}>{status.label}</span>
}

function Tag({ children, tone = 'green' }) {
  return <span className={`doctor-patient-list-tag is-${tone}`}>{children}</span>
}

function Donut({ stats }) {
  const total = stats.total || 1
  const followEnd = percent(stats.following, total)
  const stableEnd = followEnd + percent(stats.stable, total)
  const watchEnd = stableEnd + percent(stats.watch, total)
  const treatingEnd = watchEnd + percent(stats.treating, total)
  return (
    <div
      className="doctor-patient-list-donut"
      style={{
        '--follow-end': `${followEnd}%`,
        '--stable-end': `${stableEnd}%`,
        '--watch-end': `${watchEnd}%`,
        '--treating-end': `${treatingEnd}%`,
      }}
    >
      <div>
        <strong>{stats.total}</strong>
        <span>Tổng bệnh nhân</span>
      </div>
    </div>
  )
}

async function enrichPatient(patient) {
  const patientId = patientIdOf(patient)
  if (!patientId) return null

  const [summary, problems, allergies, appointments, encounters, prescriptions, canBook] = await Promise.all([
    settledValue(doctorApi.patients.getSummary(patientId), null),
    settledValue(doctorApi.patients.getProblems(patientId, { limit: 5 }), []),
    settledValue(doctorApi.patients.getAllergies(patientId, { limit: 5 }), []),
    settledValue(doctorApi.patients.getAppointmentsHistory(patientId, { limit: 5, sort_order: 'desc' }), { items: [] }),
    settledValue(doctorApi.patients.getEncountersHistory(patientId, { limit: 5, sort_order: 'desc' }), { items: [] }),
    settledValue(doctorApi.patients.getPrescriptionsHistory(patientId, { limit: 5, sort_order: 'desc' }), { items: [] }),
    settledValue(doctorApi.patients.canBookAppointment(patientId), null),
  ])

  const summaryPatient = summary?.patient || null
  const appointmentItems = safeArray(appointments?.items || appointments)
  const encounterItems = safeArray(encounters?.items || encounters)
  const prescriptionItems = safeArray(prescriptions?.items || prescriptions)
  const activeProblems = safeArray(summary?.active_problems || problems)
  const activeAllergies = safeArray(summary?.active_allergies || allergies)
  const upcomingAppointment = summary?.upcoming_appointment
    || appointmentItems
      .filter((item) => {
        const date = new Date(appointmentTime(item))
        return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now()
      })
      .sort((left, right) => new Date(appointmentTime(left)) - new Date(appointmentTime(right)))[0]
    || null

  return [
    patientId,
    {
      detailPatient: summaryPatient,
      activeProblems,
      activeAllergies,
      appointments: appointmentItems,
      encounters: encounterItems,
      prescriptions: prescriptionItems,
      upcomingAppointment,
      lastAppointment: appointmentItems[0] || null,
      lastEncounter: summary?.last_encounter || encounterItems[0] || null,
      lastPrescription: summary?.last_prescription || prescriptionItems[0] || null,
      activeProblemsCount: Number(summary?.active_problems_count ?? activeProblems.length),
      activeAllergiesCount: Number(summary?.active_allergies_count ?? activeAllergies.length),
      canBook,
    },
  ]
}

async function loadPatientDetail(patient) {
  const patientId = patientIdOf(patient)
  if (!patientId) return null

  const [detail, summary, timeline] = await Promise.all([
    settledValue(doctorApi.patients.getDetail(patientId), null),
    settledValue(doctorApi.patients.getSummary(patientId), null),
    settledValue(doctorApi.patients.getTimeline(patientId), []),
  ])

  return { detail: detail || patient, summary, timeline: safeArray(timeline) }
}

export function DoctorPatientListScreen({ user }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [today] = useState(getTodayDate)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [specialtyFilter, setSpecialtyFilter] = useState('all')
  const [sortMode, setSortMode] = useState('updated_desc')
  const [filterRevision, setFilterRevision] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [specialtyOpen, setSpecialtyOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [state, setState] = useState({ loading: true, error: '', patients: [], pagination: null })
  const [statsState, setStatsState] = useState({ patients: [], pagination: null })
  const [enrichment, setEnrichment] = useState({})
  const [selectedDetail, setSelectedDetail] = useState({ loading: false, data: null })

  const sortConfig = useMemo(() => {
    if (sortMode === 'created_desc') return { sort_by: 'created_at', sort_order: 'desc' }
    if (sortMode === 'created_asc') return { sort_by: 'created_at', sort_order: 'asc' }
    return { sort_by: 'updated_at', sort_order: 'desc' }
  }, [sortMode])

  const queryKey = `${page}|${pageSize}|${searchTerm}|${statusFilter}|${sortMode}|${filterRevision}`

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))

    const params = {
      page,
      limit: pageSize,
      ...sortConfig,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }
    const request = searchTerm.trim()
      ? doctorApi.patients.searchPage({ ...params, search: searchTerm.trim() })
      : doctorApi.patients.listPage(params)

    request
      .then((payload) => {
        if (!active) return
        setState({
          loading: false,
          error: '',
          patients: safeArray(payload?.items),
          pagination: payload?.pagination || null,
        })
      })
      .catch((error) => {
        if (!active) return
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Không thể tải danh sách bệnh nhân.'),
          patients: [],
          pagination: null,
        })
      })

    return () => {
      active = false
    }
  }, [queryKey, sortConfig])

  useEffect(() => {
    let active = true
    doctorApi.patients.listPage({ page: 1, limit: 100, sort_by: 'updated_at', sort_order: 'desc' })
      .then((payload) => {
        if (active) setStatsState({ patients: safeArray(payload?.items), pagination: payload?.pagination || null })
      })
      .catch(() => {
        if (active) setStatsState({ patients: [], pagination: null })
      })
    return () => {
      active = false
    }
  }, [])

  const pageIds = useMemo(() => state.patients.map(patientIdOf).filter(Boolean).join('|'), [state.patients])
  const statsIds = useMemo(() => statsState.patients.slice(0, 24).map(patientIdOf).filter(Boolean).join('|'), [statsState.patients])

  useEffect(() => {
    let active = true
    const candidates = [...state.patients, ...statsState.patients.slice(0, 24)]
    const missing = candidates.filter((patient) => {
      const id = patientIdOf(patient)
      return id && !enrichment[id]
    })

    if (!missing.length) return undefined

    Promise.all(missing.slice(0, 34).map(enrichPatient)).then((entries) => {
      if (!active) return
      setEnrichment((current) => ({
        ...current,
        ...Object.fromEntries(entries.filter(Boolean)),
      }))
    })

    return () => {
      active = false
    }
  }, [pageIds, statsIds, enrichment, state.patients, statsState.patients])

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail({ loading: false, data: null })
      return undefined
    }

    const selected = [...state.patients, ...statsState.patients].find((patient) => patientIdOf(patient) === selectedId)
    if (!selected) return undefined

    let active = true
    setSelectedDetail((current) => ({ ...current, loading: true }))
    loadPatientDetail(selected).then((data) => {
      if (active) setSelectedDetail({ loading: false, data })
    })
    return () => {
      active = false
    }
  }, [selectedId, state.patients, statsState.patients])

  const specialties = useMemo(
    () => Array.from(new Set(
      [...state.patients, ...statsState.patients]
        .map((patient) => specialtyText(patient, enrichment[patientIdOf(patient)] || {}))
        .filter((value) => value && value !== '--'),
    )),
    [enrichment, state.patients, statsState.patients],
  )

  const displayPatients = useMemo(() => {
    const loadedPatients = specialtyFilter === 'all'
      ? state.patients
      : Array.from(new Map(
        [...state.patients, ...statsState.patients].map((patient) => [patientIdOf(patient) || patientCode(patient), patient]),
      ).values())

    return loadedPatients.filter((patient) => {
      const extra = enrichment[patientIdOf(patient)] || {}
      const matchesSpecialty = specialtyFilter === 'all' || specialtyText(patient, extra) === specialtyFilter
      const matchesStatus = statusFilter === 'all' || String(patient.status || '').toLowerCase() === statusFilter
      const keyword = searchTerm.trim().toLowerCase()
      const matchesSearch = !keyword || [
        patientCode(patient),
        patientName(patient),
        patientPhone(patient),
      ].some((value) => String(value || '').toLowerCase().includes(keyword))

      return matchesSpecialty && matchesStatus && matchesSearch
    })
  }, [enrichment, searchTerm, specialtyFilter, state.patients, statsState.patients, statusFilter])

  const total = Number(state.pagination?.total ?? statsState.pagination?.total ?? state.patients.length)
  const totalPages = Math.max(1, Number(state.pagination?.totalPages || Math.ceil(total / pageSize) || 1))

  const dashboard = useMemo(() => {
    const statPatients = statsState.patients.length ? statsState.patients : state.patients
    const known = statPatients.map((patient) => ({
      patient,
      extra: enrichment[patientIdOf(patient)] || {},
    }))
    const now = new Date()
    const newThisMonth = statPatients.filter((patient) => {
      const created = new Date(patient.created_at || patient.createdAt || '')
      return !Number.isNaN(created.getTime())
        && created.getMonth() === now.getMonth()
        && created.getFullYear() === now.getFullYear()
    }).length
    const withTodayAppointment = known.filter(({ extra }) => {
      const appointment = extra.upcomingAppointment || extra.lastAppointment
      return appointment && formatDate(appointmentTime(appointment)) === formatDate(now)
    }).length
    const watch = known.filter(({ extra }) => extra.activeProblemsCount > 0 || extra.activeAllergiesCount > 0).length
    const stable = known.filter(({ patient, extra }) => statusInfo(patient, extra).group === 'stable').length
    const treating = known.filter(({ extra }) => safeArray(extra.encounters).some((item) => ['in_progress', 'on_hold'].includes(String(item.status).toLowerCase()))).length
    const oldPatients = statPatients.filter((patient) => Number(getAge(patient.date_of_birth)) > 60).length
    const chronic = known.filter(({ extra }) => extra.activeProblemsCount > 0).length

    return {
      total,
      newThisMonth,
      withTodayAppointment,
      watch,
      stable,
      treating,
      oldPatients,
      chronic,
      following: Math.max(0, total - stable - watch - treating),
      newRate: percent(newThisMonth, statPatients.length || total),
      todayAppointmentRate: percent(withTodayAppointment, statPatients.length || total),
      watchRate: percent(watch, statPatients.length || total),
      stableRate: percent(stable, statPatients.length || total),
      treatingRate: percent(treating, statPatients.length || total),
      oldRate: percent(oldPatients, statPatients.length || total),
      chronicRate: percent(chronic, statPatients.length || total),
    }
  }, [enrichment, state.patients, statsState.patients, total])

  function handleOpenPatient(patient) {
    const id = patientIdOf(patient)
    if (!id) {
      toast.error('Không tìm thấy mã bệnh nhân.')
      return
    }
    setSelectedId(id)
    toast.info('Đã tải hồ sơ, summary và timeline bệnh nhân từ API.')
  }

  function exportCsv() {
    const rows = [
      ['Ma BN', 'Benh nhan', 'SDT', 'Tuoi', 'Gioi tinh', 'Chuyen khoa', 'Lan kham gan nhat', 'Lich hen tiep theo', 'Canh bao', 'Trang thai'],
      ...displayPatients.map((patient) => {
        const extra = enrichment[patientIdOf(patient)] || {}
        const visit = lastVisit(extra)
        const status = statusInfo(patient, extra)
        return [
          patientCode(patient),
          patientName(patient),
          patientPhone(patient),
          getAge(patient.date_of_birth),
          genderLabel(patient.gender),
          specialtyText(patient, extra),
          visit.date,
          nextAppointment(extra).replace('\n', ' '),
          [...safeArray(extra.activeAllergies).map(allergyName), ...safeArray(extra.activeProblems).map(problemName)].join('; '),
          status.label,
        ]
      }),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `patients-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function applyFilters() {
    setPage(1)
    setFilterRevision((current) => current + 1)
    setFilterOpen(false)
    toast.info('Đã áp dụng bộ lọc từ API danh sách bệnh nhân.')
  }

  function resetFilters() {
    setSearchTerm('')
    setStatusFilter('all')
    setSpecialtyFilter('all')
    setSortMode('updated_desc')
    setPage(1)
    setFilterRevision((current) => current + 1)
    setFilterOpen(false)
  }

  function chooseSortMode(nextSortMode) {
    setSortMode(nextSortMode)
    setPage(1)
    setFilterOpen(false)
  }

  function chooseSpecialty(nextSpecialty) {
    setSpecialtyFilter(nextSpecialty)
    setPage(1)
    setSpecialtyOpen(false)
  }

  function chooseStatus(nextStatus) {
    setStatusFilter(nextStatus)
    setPage(1)
    setStatusOpen(false)
  }

  return (
    <div className="doctor-patient-list-page">
      {state.error ? <div className="doctor-patient-list-error">{state.error}</div> : null}

      <section className="doctor-patient-list-kpis" aria-label="Tổng quan bệnh nhân">
        <KpiCard icon={UsersRound} tone="blue" label="Tổng bệnh nhân" value={dashboard.total.toLocaleString('vi-VN')} hint="100% tổng số" />
        <KpiCard icon={UserPlus} tone="green" label="Bệnh nhân mới" value={dashboard.newThisMonth} hint={`${dashboard.newRate}% trong mẫu tải`} />
        <KpiCard icon={CalendarDays} tone="orange" label="Có lịch hôm nay" value={dashboard.withTodayAppointment} hint={`${dashboard.todayAppointmentRate}% dữ liệu đã tải`} />
        <KpiCard icon={HeartPulse} tone="purple" label="Cần theo dõi" value={dashboard.watch} hint={`${dashboard.watchRate}% dữ liệu đã tải`} />
      </section>

      <section className="doctor-patient-list-grid">
        <article className="doctor-patient-list-panel doctor-patient-list-table-card">
          <div className="doctor-patient-list-toolbar">
            <label className="doctor-patient-list-search" onFocus={() => { setFilterOpen(false); setSpecialtyOpen(false); setStatusOpen(false) }}>
              <Search size={15} />
              <input
                value={searchTerm}
                placeholder="Tìm kiếm bệnh nhân (Tên, SĐT, Mã BN...)"
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setPage(1)
                }}
              />
            </label>
            <div className="doctor-patient-list-select-menu">
              <button
                type="button"
                className={specialtyOpen ? 'is-open' : ''}
                aria-haspopup="menu"
                aria-expanded={specialtyOpen}
                onClick={() => { setSpecialtyOpen((open) => !open); setStatusOpen(false); setFilterOpen(false) }}
              >
                <span>{specialtyFilter === 'all' ? 'Tất cả chuyên khoa' : specialtyFilter}</span>
                <ChevronDown size={13} />
              </button>
              {specialtyOpen ? (
                <div className="doctor-patient-list-select-dropdown" role="menu">
                  {[{ value: 'all', label: 'Tất cả chuyên khoa' }, ...specialties.map((specialty) => ({ value: specialty, label: specialty }))].map((item) => (
                    <button
                      type="button"
                      className={specialtyFilter === item.value ? 'is-active' : ''}
                      key={item.value}
                      onClick={() => chooseSpecialty(item.value)}
                    >
                      <Check size={12} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="doctor-patient-list-select-menu">
              <button
                type="button"
                className={statusOpen ? 'is-open' : ''}
                aria-haspopup="menu"
                aria-expanded={statusOpen}
                onClick={() => { setStatusOpen((open) => !open); setSpecialtyOpen(false); setFilterOpen(false) }}
              >
                <span>{statusFilter === 'all' ? 'Tất cả trạng thái' : statusFilter === 'active' ? 'Đang hoạt động' : statusFilter === 'inactive' ? 'Ngừng hoạt động' : 'Lưu trữ'}</span>
                <ChevronDown size={13} />
              </button>
              {statusOpen ? (
                <div className="doctor-patient-list-select-dropdown" role="menu">
                  {[
                    { value: 'all', label: 'Tất cả trạng thái' },
                    { value: 'active', label: 'Đang hoạt động' },
                    { value: 'inactive', label: 'Ngừng hoạt động' },
                    { value: 'archived', label: 'Lưu trữ' },
                  ].map((item) => (
                    <button
                      type="button"
                      className={statusFilter === item.value ? 'is-active' : ''}
                      key={item.value}
                      onClick={() => chooseStatus(item.value)}
                    >
                      <Check size={12} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="doctor-patient-list-filter-menu">
              <button
                type="button"
                className={filterOpen ? 'is-open' : ''}
                aria-haspopup="menu"
                aria-expanded={filterOpen}
                onClick={() => { setFilterOpen((open) => !open); setSpecialtyOpen(false); setStatusOpen(false) }}
              >
                <Filter size={15} />
                <span>Bộ lọc</span>
                <ChevronDown size={12} />
              </button>
              {filterOpen ? (
                <div className="doctor-patient-list-filter-dropdown" role="menu">
                  <button type="button" className={sortMode === 'updated_desc' ? 'is-active' : ''} onClick={() => chooseSortMode('updated_desc')}><Check size={12} /><span>Mới cập nhật</span></button>
                  <button type="button" className={sortMode === 'created_desc' ? 'is-active' : ''} onClick={() => chooseSortMode('created_desc')}><Check size={12} /><span>Mới nhất</span></button>
                  <button type="button" className={sortMode === 'created_asc' ? 'is-active' : ''} onClick={() => chooseSortMode('created_asc')}><Check size={12} /><span>Cũ nhất</span></button>
                </div>
              ) : null}
            </div>
            <button type="button" aria-label="Tải xuống danh sách" onClick={exportCsv}><Download size={15} /></button>
          </div>

          <div className="doctor-patient-list-table-scroll">
            <div className="doctor-patient-list-table-head">
              <span>Mã BN</span>
              <span>Bệnh nhân</span>
              <span>SĐT</span>
              <span>Tuổi / Giới tính</span>
              <span>Chuyên khoa</span>
              <span>Lần khám gần nhất</span>
              <span>Lịch hẹn tiếp theo</span>
              <span>Dị ứng / Vấn đề</span>
              <span>Trạng thái</span>
              <span>Thao tác</span>
            </div>

            <div className="doctor-patient-list-table">
              {state.loading ? (
                <div className="doctor-patient-list-empty">Đang tải danh sách bệnh nhân...</div>
              ) : displayPatients.length ? displayPatients.map((patient) => {
                const id = patientIdOf(patient)
                const extra = enrichment[id] || {}
                const visit = lastVisit(extra)
                const alerts = [
                  ...safeArray(extra.activeAllergies).map((item) => ({ label: allergyName(item), tone: 'red' })),
                  ...safeArray(extra.activeProblems).map((item) => ({ label: problemName(item), tone: 'orange' })),
                ].slice(0, 2)

                return (
                  <div className={`doctor-patient-list-row${selectedId === id ? ' is-selected' : ''}`} key={id || patientCode(patient)}>
                    <strong>{patientCode(patient)}</strong>
                    <span className="doctor-patient-list-person">
                      <PatientAvatar patient={patient} />
                      <span>
                        <b>{patientName(patient)}</b>
                      </span>
                    </span>
                    <span className="doctor-patient-list-phone">{patientPhone(patient) || 'Chưa có SĐT'}</span>
                    <span className="doctor-patient-list-age">
                      <b>{getAge(patient.date_of_birth) ? `${getAge(patient.date_of_birth)} tuổi` : '--'}</b>
                      <small>{genderLabel(patient.gender)}</small>
                    </span>
                    <strong>{specialtyText(patient, extra)}</strong>
                    <span className="doctor-patient-list-visit">
                      <b>{visit.date}</b>
                      <small>{visit.doctor || '--'}</small>
                    </span>
                    <span className="doctor-patient-list-visit">
                      <b>{nextAppointment(extra).split('\n')[0]}</b>
                      <small>{nextAppointment(extra).split('\n')[1] || ''}</small>
                    </span>
                    <span className="doctor-patient-list-tags">
                      {alerts.length ? alerts.map((item) => <Tag key={`${id}-${item.label}`} tone={item.tone}>{item.label}</Tag>) : <Tag>Không có</Tag>}
                    </span>
                    <StatusBadge patient={patient} extra={extra} />
                    <span className="doctor-patient-list-actions">
                      <button type="button" onClick={() => handleOpenPatient(patient)}><Eye size={13} /> Xem hồ sơ</button>
                      <button type="button" aria-label="Tùy chọn bệnh nhân" onClick={() => setSelectedId(id)}><MoreVertical size={14} /></button>
                    </span>
                  </div>
                )
              }) : (
                <div className="doctor-patient-list-empty">Chưa có bệnh nhân phù hợp.</div>
              )}
            </div>

          </div>

          <footer className="doctor-patient-list-footer">
            <div className="doctor-patient-list-page-size">
              <button type="button" disabled>
                Hiển thị <strong>{pageSize}</strong> dòng
              </button>
            </div>
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
            <span>Hiển thị {total ? `${(page - 1) * pageSize + 1} đến ${Math.min(page * pageSize, total)}` : '0'} của {total.toLocaleString('vi-VN')} bệnh nhân</span>
          </footer>
        </article>

        <aside className="doctor-patient-list-side">
          <article className="doctor-patient-list-panel doctor-patient-list-overview">
            <header><h2>Tổng quan bệnh nhân</h2></header>
            <div className="doctor-patient-list-overview__top">
              <Donut stats={dashboard} />
              <dl>
                <div><dt><i className="is-green" /> Đang theo dõi</dt><dd>{dashboard.following} ({percent(dashboard.following, dashboard.total)}%)</dd></div>
                <div><dt><i className="is-blue" /> Ổn định</dt><dd>{dashboard.stable} ({dashboard.stableRate}%)</dd></div>
                <div><dt><i className="is-orange" /> Cần theo dõi</dt><dd>{dashboard.watch} ({dashboard.watchRate}%)</dd></div>
                <div><dt><i className="is-purple" /> Đang điều trị</dt><dd>{dashboard.treating} ({dashboard.treatingRate}%)</dd></div>
                <div><dt><i className="is-slate" /> Khác</dt><dd>{Math.max(0, dashboard.total - dashboard.following - dashboard.stable - dashboard.watch - dashboard.treating)}</dd></div>
              </dl>
            </div>
            <div className="doctor-patient-list-overview__rows">
              <div><UserPlus size={17} /><span>Bệnh nhân mới (tháng này)</span><strong>{dashboard.newThisMonth}</strong></div>
              <div><RefreshCw size={17} /><span>Bệnh nhân tái khám</span><strong>{dashboard.withTodayAppointment} ({dashboard.todayAppointmentRate}%)</strong></div>
              <div><UsersRound size={17} /><span>Bệnh nhân cao tuổi (&gt; 60 tuổi)</span><strong>{dashboard.oldPatients} ({dashboard.oldRate}%)</strong></div>
              <div><HeartPulse size={17} /><span>Bệnh nhân có bệnh mạn tính</span><strong>{dashboard.chronic} ({dashboard.chronicRate}%)</strong></div>
            </div>
          </article>

          <article className="doctor-patient-list-panel doctor-patient-list-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => toast.info('Tạo bệnh nhân dùng POST /patients; form nhập liệu sẽ mở ở module tiếp nhận.')}>
              <span><CalendarDays size={20} /></span>
              <b>Tạo bệnh nhân</b>
              <small>Thêm bệnh nhân mới vào hệ thống</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => selectedDetail.data ? toast.info('Timeline đã được tải từ /patients/:patientId/timeline.') : toast.info('Chọn bệnh nhân để xem lịch sử.')}>
              <span><RefreshCw size={20} /></span>
              <b>Xem lịch sử khám</b>
              <small>Xem lịch sử khám của bệnh nhân</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={exportCsv} disabled={!displayPatients.length}>
              <span><Download size={20} /></span>
              <b>Xuất danh sách</b>
              <small>Xuất danh sách bệnh nhân ra file</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => selectedId ? handleOpenPatient([...state.patients, ...statsState.patients].find((patient) => patientIdOf(patient) === selectedId) || {}) : toast.info('Chọn bệnh nhân để mở hồ sơ gần đây.')}>
              <span><Stethoscope size={20} /></span>
              <b>Mở hồ sơ gần đây</b>
              <small>Truy cập nhanh hồ sơ đã xem gần đây</small>
              <ChevronRight size={18} />
            </button>
          </article>
        </aside>
      </section>
    </div>
  )
}
