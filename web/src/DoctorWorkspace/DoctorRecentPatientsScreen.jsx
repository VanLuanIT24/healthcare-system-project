import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FlaskConical,
  HeartPulse,
  Hourglass,
  MoreVertical,
  Pill,
  RefreshCw,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { doctorApi, getDoctorId } from './doctorApi'
import { getInitials, safeArray } from './doctorData'
import { getTodayDate } from './DoctorHooks'
import { useToast } from './ToastProvider'
import { getApiErrorMessage } from '../utils/api'

const PAGE_SIZE = 5

function settledValue(promise, fallback) {
  return promise.then((value) => value).catch(() => fallback)
}

function toDate(value) {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTime(value) {
  const date = toDate(value)
  if (!date) return '-'
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
}

function formatDate(value) {
  const date = toDate(value)
  return date ? date.toLocaleDateString('vi-VN') : '-'
}

function formatTime(value) {
  const date = toDate(value)
  return date ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-'
}

function todayLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`)
  const weekday = date.toLocaleDateString('vi-VN', { weekday: 'short' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date.toLocaleDateString('vi-VN')}`
}

function percent(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function patientIdOf(item = {}) {
  const patient = item.patient || {}
  return item.patient_id || patient.patient_id || patient.id || patient._id || ''
}

function patientName(item = {}) {
  const patient = item.patient || {}
  return item.patient_name || item.full_name || patient.full_name || patient.fullName || patient.name || 'Bệnh nhân'
}

function patientCode(item = {}) {
  const patient = item.patient || {}
  return item.patient_code || patient.patient_code || patient.patientCode || patientIdOf(item)
}

function genderLabel(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'male' || normalized === 'nam') return 'Nam'
  if (normalized === 'female' || normalized === 'nữ' || normalized === 'nu') return 'Nữ'
  return value || '--'
}

function getAge(value) {
  if (!value) return ''
  const date = toDate(value)
  if (!date) return ''
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDiff = now.getMonth() - date.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) age -= 1
  return age > 0 ? age : ''
}

function patientGender(item = {}) {
  const patient = item.patient || {}
  return item.patient_gender || item.gender || patient.gender || ''
}

function patientDob(item = {}) {
  const patient = item.patient || {}
  return item.date_of_birth || patient.date_of_birth || patient.dob || ''
}

function eventTime(item = {}) {
  return item.last_interaction_at
    || item.updated_at
    || item.end_time
    || item.start_time
    || item.started_at
    || item.appointment_time
    || item.scheduled_at
    || item.created_at
    || ''
}

function encounterTime(encounter = {}) {
  return encounter.start_time || encounter.started_at || encounter.created_at || ''
}

function appointmentTime(appointment = {}) {
  return appointment.appointment_time || appointment.scheduled_at || appointment.date_time || appointment.created_at || ''
}

function roomText(item = {}) {
  return item.room_name || item.clinic_room || item.room || item.location || item.department_name || item.department?.department_name || '--'
}

function diagnosisText(item = {}, timeline = []) {
  const direct = item.diagnosis_name || item.primary_diagnosis || item.diagnosis || item.reason || item.chief_reason
  if (direct) return direct
  const diagnosisEvent = timeline.find((entry) => /diagnos|chẩn đoán|chan doan|problem/i.test(`${entry.action || ''} ${entry.message || ''}`))
  return diagnosisEvent?.message || 'Chưa có chẩn đoán'
}

function followStatus(patient = {}) {
  if (patient.needsRevisit) return { label: 'Cần tái khám', tone: 'orange', group: 'revisit' }
  if (patient.hasUpcomingAppointment) return { label: 'Theo dõi', tone: 'blue', group: 'follow' }
  if (patient.lastEncounterStatus === 'completed') return { label: 'Hoàn tất', tone: 'green', group: 'done' }
  return { label: 'Theo dõi', tone: 'blue', group: 'follow' }
}

function timelineAction(entry = {}) {
  const raw = `${entry.action || ''} ${entry.message || ''}`.toLowerCase()
  if (/prescription|đơn thuốc|don thuoc/.test(raw)) return 'Kê đơn thuốc'
  if (/lab|xét nghiệm|xet nghiem|result|kết quả|ket qua/.test(raw)) return 'Có kết quả xét nghiệm mới'
  if (/appointment|tái khám|tai kham/.test(raw)) return 'Đặt lịch tái khám'
  if (/encounter|khám bệnh|kham benh|consultation/.test(raw)) return 'Khám bệnh'
  return entry.message || entry.action || 'Cập nhật hồ sơ'
}

function timelineTone(entry = {}) {
  const raw = `${entry.action || ''} ${entry.message || ''}`.toLowerCase()
  if (/prescription|đơn thuốc|don thuoc/.test(raw)) return 'purple'
  if (/lab|xét nghiệm|result|kết quả/.test(raw)) return 'green'
  if (/appointment|tái khám/.test(raw)) return 'orange'
  return 'blue'
}

function PatientAvatar({ patient, size = 'md' }) {
  return <span className={`doctor-recent-patient-avatar is-${size}`}>{getInitials(patient.name) || 'BN'}</span>
}

function KpiCard({ icon: Icon, tone, label, value, hint }) {
  return (
    <article className="doctor-recent-patient-kpi">
      <span className={`doctor-recent-patient-kpi__icon is-${tone}`}>
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

function StatusBadge({ patient }) {
  const status = followStatus(patient)
  return <span className={`doctor-recent-patient-status is-${status.tone}`}>{status.label}</span>
}

function Donut({ stats }) {
  return (
    <div
      className="doctor-recent-patient-donut"
      style={{
        '--revisit-end': `${stats.revisitRate}%`,
        '--follow-end': `${stats.revisitRate + stats.followRate}%`,
        '--done-end': `${stats.revisitRate + stats.followRate + stats.doneRate}%`,
      }}
    >
      <div>
        <strong>{stats.total}</strong>
        <span>Tổng bệnh nhân</span>
      </div>
    </div>
  )
}

function compactPatientFromSource(source = {}, type = 'encounter') {
  const id = patientIdOf(source)
  if (!id) return null
  return {
    patient_id: id,
    patient_code: patientCode(source),
    name: patientName(source),
    gender: patientGender(source),
    date_of_birth: patientDob(source),
    sourceType: type,
    lastInteractionAt: type === 'appointment' ? appointmentTime(source) : encounterTime(source),
    lastInteractionLabel: type === 'appointment' ? 'Lịch hẹn' : 'Khám bệnh',
    lastEncounterStatus: type === 'encounter' ? source.status : '',
    room: roomText(source),
    latestDiagnosis: source.chief_reason || source.reason || source.note || '',
    nextAppointmentAt: type === 'appointment' ? appointmentTime(source) : '',
    encounterCode: source.encounter_code || '',
    appointmentId: source.appointment_id || '',
    raw: source,
  }
}

async function loadRecentPatients(user) {
  const doctorId = getDoctorId(user)
  const [doctorEncounters, activeEncounters, todayEncounters, doctorAppointments, todayAppointments] = await Promise.all([
    doctorId ? settledValue(doctorApi.encounters.listByDoctor(doctorId, { limit: 120 }), []) : Promise.resolve([]),
    doctorId ? settledValue(doctorApi.encounters.listActiveByDoctor(doctorId, { limit: 40 }), []) : Promise.resolve([]),
    settledValue(doctorApi.encounters.listToday({ limit: 120, ...(doctorId ? { doctor_id: doctorId } : {}) }), []),
    doctorId ? settledValue(doctorApi.appointments.listByDoctor(doctorId, { limit: 120 }), []) : Promise.resolve([]),
    settledValue(doctorApi.appointments.listToday({ limit: 120, ...(doctorId ? { doctor_id: doctorId } : {}) }), []),
  ])

  const map = new Map()
  function upsert(source, type) {
    const patient = compactPatientFromSource(source, type)
    if (!patient) return
    const current = map.get(patient.patient_id)
    const currentTime = toDate(current?.lastInteractionAt)?.getTime() || 0
    const incomingTime = toDate(patient.lastInteractionAt)?.getTime() || 0
    const merged = {
      ...(current || {}),
      ...patient,
      lastInteractionAt: incomingTime >= currentTime ? patient.lastInteractionAt : current?.lastInteractionAt,
      recentEncounters: [
        ...safeArray(current?.recentEncounters),
        ...(type === 'encounter' ? [source] : []),
      ],
      recentAppointments: [
        ...safeArray(current?.recentAppointments),
        ...(type === 'appointment' ? [source] : []),
      ],
    }
    const appointments = safeArray(merged.recentAppointments)
      .filter((item) => toDate(appointmentTime(item)) && toDate(appointmentTime(item)).getTime() >= Date.now())
      .sort((left, right) => toDate(appointmentTime(left)).getTime() - toDate(appointmentTime(right)).getTime())
    merged.nextAppointmentAt = appointments[0] ? appointmentTime(appointments[0]) : merged.nextAppointmentAt
    merged.hasUpcomingAppointment = Boolean(appointments[0])
    map.set(patient.patient_id, merged)
  }

  safeArray(doctorEncounters).forEach((item) => upsert(item, 'encounter'))
  safeArray(activeEncounters).forEach((item) => upsert(item, 'encounter'))
  safeArray(todayEncounters).forEach((item) => upsert(item, 'encounter'))
  safeArray(doctorAppointments).forEach((item) => upsert(item, 'appointment'))
  safeArray(todayAppointments).forEach((item) => upsert(item, 'appointment'))

  const patients = Array.from(map.values()).sort((left, right) => (toDate(right.lastInteractionAt)?.getTime() || 0) - (toDate(left.lastInteractionAt)?.getTime() || 0))

  const timelineEntries = await Promise.all(
    patients.slice(0, 40).map(async (patient) => {
      const timeline = await settledValue(doctorApi.patients.getTimeline(patient.patient_id), [])
      return [patient.patient_id, safeArray(timeline)]
    }),
  )
  const timelineMap = Object.fromEntries(timelineEntries)

  return patients.map((patient) => {
    const timeline = timelineMap[patient.patient_id] || []
    const hasPrescription = timeline.some((entry) => /prescription|đơn thuốc|don thuoc/i.test(`${entry.action || ''} ${entry.message || ''}`))
    const hasNewResult = timeline.some((entry) => /lab|xét nghiệm|result|kết quả|imaging|chẩn đoán hình ảnh/i.test(`${entry.action || ''} ${entry.message || ''}`))
    const latestDiagnosis = diagnosisText(patient, timeline)
    const last30 = safeArray(patient.recentEncounters).filter((entry) => {
      const date = toDate(encounterTime(entry))
      return date && Date.now() - date.getTime() <= 30 * 24 * 60 * 60 * 1000
    }).length
    return {
      ...patient,
      timeline,
      latestDiagnosis,
      hasPrescription,
      hasNewResult,
      interactionCount: timeline.length || safeArray(patient.recentAppointments).length + safeArray(patient.recentEncounters).length,
      encountersLast30: last30,
      needsRevisit: !patient.hasUpcomingAppointment && patient.lastEncounterStatus !== 'completed',
    }
  })
}

export function DoctorRecentPatientsScreen({ user }) {
  const toast = useToast()
  const [today] = useState(getTodayDate)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const [state, setState] = useState({ loading: true, error: '', patients: [] })

  function reload() {
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadRecentPatients(user)
      .then((patients) => {
        setPage(1)
        setState({ loading: false, error: '', patients })
      })
      .catch((error) => setState({
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải bệnh nhân gần đây.'),
        patients: [],
      }))
  }

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadRecentPatients(user)
      .then((patients) => {
        if (active) setState({ loading: false, error: '', patients })
      })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tải bệnh nhân gần đây.'),
            patients: [],
          })
        }
      })
    return () => {
      active = false
    }
  }, [user])

  const totalPages = Math.max(1, Math.ceil(state.patients.length / PAGE_SIZE))
  const pageRows = state.patients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selected = state.patients.find((patient) => patient.patient_id === selectedId) || state.patients[0] || null

  const dashboard = useMemo(() => {
    const total = state.patients.length
    const revisit = state.patients.filter((patient) => followStatus(patient).group === 'revisit').length
    const follow = state.patients.filter((patient) => followStatus(patient).group === 'follow').length
    const done = state.patients.filter((patient) => followStatus(patient).group === 'done').length
    const noAppointment = state.patients.filter((patient) => !patient.hasUpcomingAppointment).length
    const female = state.patients.filter((patient) => genderLabel(patient.gender) === 'Nữ').length
    const averageAge = total
      ? Math.round((state.patients.reduce((sum, patient) => sum + Number(getAge(patient.date_of_birth) || 0), 0) / total) * 10) / 10
      : 0
    const averageInteractions = total
      ? Math.round((state.patients.reduce((sum, patient) => sum + Number(patient.interactionCount || 0), 0) / total) * 10) / 10
      : 0
    return {
      total,
      revisit,
      follow,
      done,
      noAppointment,
      activePrescriptions: state.patients.filter((patient) => patient.hasPrescription).length,
      newResults: state.patients.filter((patient) => patient.hasNewResult).length,
      female,
      averageAge,
      averageInteractions,
      encountersLast30: state.patients.filter((patient) => patient.encountersLast30 > 0).length,
      revisitRate: percent(revisit, total),
      followRate: percent(follow, total),
      doneRate: percent(done, total),
      noAppointmentRate: percent(noAppointment, total),
      femaleRate: percent(female, total),
    }
  }, [state.patients])

  const recentActivities = useMemo(
    () => state.patients.flatMap((patient) => {
      const timelineItems = safeArray(patient.timeline).slice(0, 2).map((entry) => ({
        patient,
        entry,
        at: entry.created_at || entry.occurred_at || patient.lastInteractionAt,
      }))
      if (timelineItems.length) return timelineItems
      return [{ patient, entry: { action: patient.lastInteractionLabel, message: patient.latestDiagnosis }, at: patient.lastInteractionAt }]
    }).sort((left, right) => (toDate(right.at)?.getTime() || 0) - (toDate(left.at)?.getTime() || 0)).slice(0, 5),
    [state.patients],
  )

  function exportCsv() {
    const rows = [
      ['Benh nhan', 'Tuoi', 'Gioi tinh', 'Chan doan gan nhat', 'Lan tuong tac cuoi', 'Encounter gan nhat', 'Lich hen tiep theo', 'Follow up'],
      ...state.patients.map((patient) => [
        patient.name,
        getAge(patient.date_of_birth),
        genderLabel(patient.gender),
        patient.latestDiagnosis,
        formatDateTime(patient.lastInteractionAt),
        patient.room,
        formatDateTime(patient.nextAppointmentAt),
        followStatus(patient).label,
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `recent-patients-${today}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="doctor-recent-patient-page">
      <header className="doctor-recent-patient-header">
        <div>
          <h1>Bệnh nhân gần đây</h1>
          <p>Theo dõi và quản lý các bệnh nhân bạn đã tương tác gần đây</p>
        </div>
        <div className="doctor-recent-patient-header__right">
          <button className="doctor-recent-patient-date" type="button">
            <CalendarDays size={18} />
            <span>{todayLabel(today)}</span>
            <ChevronDown size={15} />
          </button>
          <div className="doctor-recent-patient-profile">
            <span>{getInitials(user?.fullName || user?.full_name || user?.name) || 'BS'}</span>
            <div>
              <strong>{user?.fullName || user?.full_name || user?.name || 'Bác sĩ'}</strong>
              <small>Khoa Khám bệnh</small>
            </div>
            <ChevronDown size={15} />
          </div>
        </div>
      </header>

      {state.error ? <div className="doctor-recent-patient-error">{state.error}</div> : null}

      <section className="doctor-recent-patient-kpis">
        <KpiCard icon={UsersRound} tone="blue" label="Đã xem gần đây" value={dashboard.total} hint="100% tổng số hôm nay" />
        <KpiCard icon={CalendarDays} tone="green" label="Cần tái khám" value={dashboard.revisit} hint={`${dashboard.revisitRate}% tổng số`} />
        <KpiCard icon={Hourglass} tone="orange" label="Có kết quả mới" value={dashboard.newResults} hint={`${percent(dashboard.newResults, dashboard.total)}% tổng số`} />
        <KpiCard icon={FileText} tone="purple" label="Đơn thuốc đang hoạt động" value={dashboard.activePrescriptions} hint={`${percent(dashboard.activePrescriptions, dashboard.total)}% tổng số`} />
      </section>

      <section className="doctor-recent-patient-grid">
        <article className="doctor-recent-patient-panel doctor-recent-patient-table-card">
          <header>
            <h2>Bệnh nhân gần đây (Sắp xếp theo lần tương tác cuối)</h2>
          </header>
          <div className="doctor-recent-patient-table-head">
            <span>Bệnh nhân</span>
            <span>Tuổi/Giới tính</span>
            <span>Chẩn đoán gần nhất</span>
            <span>Lần tương tác cuối</span>
            <span>Encounter gần nhất</span>
            <span>Lịch hẹn tiếp theo</span>
            <span>Trạng thái follow-up</span>
          </div>
          <div className="doctor-recent-patient-table">
            {state.loading ? (
              <div className="doctor-recent-patient-empty">Đang tải bệnh nhân gần đây...</div>
            ) : pageRows.length ? pageRows.map((patient) => (
              <button className={`doctor-recent-patient-row${selected?.patient_id === patient.patient_id ? ' is-selected' : ''}`} type="button" key={patient.patient_id} onClick={() => setSelectedId(patient.patient_id)}>
                <span className="doctor-recent-patient-person">
                  <PatientAvatar patient={patient} />
                  <span>
                    <b>{patient.name}</b>
                    <small>{getAge(patient.date_of_birth)} tuổi · {genderLabel(patient.gender)}</small>
                  </span>
                </span>
                <span>{getAge(patient.date_of_birth) || '--'} tuổi · {genderLabel(patient.gender)}</span>
                <strong>{patient.latestDiagnosis}</strong>
                <strong>{formatDateTime(patient.lastInteractionAt)}</strong>
                <strong>{patient.room || '--'}</strong>
                <strong>{patient.nextAppointmentAt ? formatDateTime(patient.nextAppointmentAt) : '—'}</strong>
                <StatusBadge patient={patient} />
              </button>
            )) : (
              <div className="doctor-recent-patient-empty">Chưa có bệnh nhân gần đây từ encounter hoặc lịch hẹn.</div>
            )}
          </div>
          <footer className="doctor-recent-patient-footer">
            <button type="button" disabled>Hiển thị <strong>{PAGE_SIZE}</strong> dòng</button>
            <div>
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={15} /></button>
              {Array.from({ length: Math.min(3, totalPages) }, (_, index) => index + 1).map((pageNumber) => (
                <button className={pageNumber === page ? 'is-active' : ''} type="button" key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
              ))}
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={15} /></button>
            </div>
            <span>Hiển thị {dashboard.total ? `${(page - 1) * PAGE_SIZE + 1} đến ${Math.min(page * PAGE_SIZE, dashboard.total)}` : '0'} của {dashboard.total} bệnh nhân</span>
          </footer>
        </article>

        <aside className="doctor-recent-patient-side">
          <article className="doctor-recent-patient-panel doctor-recent-patient-overview">
            <header><h2>Tổng quan bệnh nhân gần đây</h2></header>
            <div className="doctor-recent-patient-overview__top">
              <Donut stats={dashboard} />
              <dl>
                <div><dt><i className="is-green" /> Cần tái khám</dt><dd>{dashboard.revisit} ({dashboard.revisitRate}%)</dd></div>
                <div><dt><i className="is-blue" /> Theo dõi</dt><dd>{dashboard.follow} ({dashboard.followRate}%)</dd></div>
                <div><dt><i className="is-purple" /> Hoàn tất</dt><dd>{dashboard.done} ({dashboard.doneRate}%)</dd></div>
                <div><dt><i className="is-orange" /> Chưa có lịch hẹn</dt><dd>{dashboard.noAppointment} ({dashboard.noAppointmentRate}%)</dd></div>
              </dl>
            </div>
            <div className="doctor-recent-patient-overview__rows">
              <div><UserRound size={17} /><span>Tuổi trung bình</span><strong>{dashboard.averageAge} tuổi</strong></div>
              <div><HeartPulse size={17} /><span>Tỷ lệ nữ</span><strong>{dashboard.femaleRate}% ({dashboard.female}/{dashboard.total})</strong></div>
              <div><RefreshCw size={17} /><span>Lần tương tác TB</span><strong>{dashboard.averageInteractions} lần/bệnh nhân</strong></div>
              <div><Stethoscope size={17} /><span>Encounter trong 30 ngày</span><strong>{dashboard.encountersLast30}</strong></div>
            </div>
          </article>

          <article className="doctor-recent-patient-panel doctor-recent-patient-quick">
            <h2>Thao tác nhanh</h2>
            <button type="button" onClick={() => selected ? toast.info(`Đã chọn hồ sơ ${selected.name}.`) : toast.info('Chưa có bệnh nhân để mở.')}>
              <span><CalendarDays size={20} /></span>
              <b>Mở hồ sơ gần nhất</b>
              <small>Truy cập nhanh hồ sơ bệnh nhân</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => selected ? toast.info('Timeline bệnh nhân đã lấy từ /patients/:patientId/timeline.') : toast.info('Chọn bệnh nhân để xem timeline.')}>
              <span><RefreshCw size={20} /></span>
              <b>Xem timeline</b>
              <small>Xem toàn bộ lịch sử tương tác</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => selected ? toast.info('Đặt lịch tái khám dùng dữ liệu lịch hẹn của bệnh nhân đang chọn.') : toast.info('Chọn bệnh nhân để đặt lịch.')}>
              <span><CalendarDays size={20} /></span>
              <b>Đặt lịch tái khám</b>
              <small>Tạo lịch hẹn mới cho bệnh nhân</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => selected ? toast.info('Kết quả cận lâm sàng được nhận diện từ timeline thật.') : toast.info('Chọn bệnh nhân để xem kết quả.')}>
              <span><FlaskConical size={20} /></span>
              <b>Xem kết quả cận lâm sàng</b>
              <small>Xem kết quả xét nghiệm/chẩn đoán</small>
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={exportCsv} disabled={!state.patients.length}>
              <span><Download size={20} /></span>
              <b>Xuất báo cáo</b>
              <small>Xuất báo cáo bệnh nhân gần đây</small>
              <ChevronRight size={18} />
            </button>
          </article>
        </aside>
      </section>

      <section className="doctor-recent-patient-bottom">
        <article className="doctor-recent-patient-panel doctor-recent-patient-activity">
          <header><h2>Hoạt động gần đây</h2></header>
          <div>
            {recentActivities.map(({ patient, entry, at }, index) => (
              <span className={`is-${timelineTone(entry)}`} key={`${patient.patient_id}-${entry.audit_log_id || entry.id || index}`}>
                <time>{formatTime(at)}</time>
                <i />
                <b>{timelineAction(entry)}</b>
                <small>{patient.name} · {entry.message || patient.latestDiagnosis}</small>
                <em>{formatDate(at)}</em>
              </span>
            ))}
          </div>
          <button type="button">Xem toàn bộ hoạt động <ChevronRight size={14} /></button>
        </article>

        <article className="doctor-recent-patient-panel doctor-recent-patient-alerts">
          <header><h2>Cảnh báo &amp; lưu ý</h2></header>
          <button type="button"><AlertTriangle size={18} /><span><b>Dị ứng thuốc</b><small>{state.patients.filter((patient) => /dị ứng|di ung|allergy/i.test(patient.latestDiagnosis)).length} bệnh nhân có ghi nhận dị ứng nghiêm trọng</small></span><ChevronRight size={15} /></button>
          <button type="button"><Hourglass size={18} /><span><b>Kết quả chưa xem</b><small>{dashboard.newResults} kết quả xét nghiệm/chẩn đoán hình ảnh chưa xem</small></span><ChevronRight size={15} /></button>
          <button type="button"><CalendarDays size={18} /><span><b>Quá hạn tái khám</b><small>{dashboard.revisit} bệnh nhân đã quá hạn lịch tái khám</small></span><ChevronRight size={15} /></button>
          <a>Xem tất cả cảnh báo <ChevronRight size={14} /></a>
        </article>

        <article className="doctor-recent-patient-panel doctor-recent-patient-summary">
          <header><h2>Tóm tắt bệnh nhân</h2><button type="button">Xem tất cả</button></header>
          <div>
            {state.patients.slice(0, 2).map((patient) => (
              <section key={`summary-${patient.patient_id}`}>
                <PatientAvatar patient={patient} />
                <div>
                  <h3>{patient.name}</h3>
                  <p>{getAge(patient.date_of_birth)} tuổi · {genderLabel(patient.gender)}</p>
                  <strong>{patient.latestDiagnosis}</strong>
                  <small>Lần khám cuối: {formatDate(patient.lastInteractionAt)}</small>
                </div>
                <StatusBadge patient={patient} />
              </section>
            ))}
          </div>
          <button type="button">Xem thêm tóm tắt <ChevronRight size={14} /></button>
        </article>
      </section>
    </div>
  )
}
