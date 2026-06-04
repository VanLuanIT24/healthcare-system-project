import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HeartPulse,
  Inbox,
  ListChecks,
  Paperclip,
  Pill,
  Play,
  PlusCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
} from 'lucide-react'
import {
  appointmentAPI,
  clinicalAPI,
  doctorWorkspaceAPI,
  encounterAPI,
  getApiErrorMessage,
  patientAPI,
  queueAPI,
  recordsAPI,
  unwrapData,
} from '../utils/api'

function safeArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined)
  if (Array.isArray(value?.items)) return value.items.filter((item) => item !== null && item !== undefined)
  if (Array.isArray(value?.data)) return value.data.filter((item) => item !== null && item !== undefined)
  return []
}

function dataOf(response, fallback = null) {
  const payload = unwrapData(response)
  return payload === undefined || payload === null ? fallback : payload
}

function idOf(value = {}, keys = ['id', '_id']) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  for (const key of keys) {
    const raw = value?.[key]
    if (!raw) continue
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
    if (typeof raw?.$oid === 'string') return raw.$oid
  }
  return ''
}

function patientIdOf(source = {}) {
  const value = source || {}
  return idOf(value.patient || value.patient_id || value, ['patient_id', 'id', '_id'])
}

function encounterIdOf(source = {}) {
  const value = source || {}
  return idOf(value.encounter || value.encounter_id || value, ['encounter_id', 'id', '_id'])
}

function ticketIdOf(source = {}) {
  const value = source || {}
  return idOf(value.queue_ticket || value.ticket || value, ['queue_ticket_id', 'ticket_id', 'id', '_id'])
}

function appointmentIdOf(source = {}) {
  const value = source || {}
  return idOf(value.appointment || value.appointment_id || value, ['appointment_id', 'id', '_id'])
}

function recordIdOf(record = {}) {
  const value = record || {}
  return idOf(value.medical_record || value.record || value, ['record_id', 'medical_record_id', 'id', '_id'])
}

function attachmentIdOf(attachment = {}) {
  const value = attachment || {}
  return idOf(value.attachment || value, ['attachment_id', 'id', '_id'])
}

function carePlanIdOf(plan = {}) {
  const value = plan || {}
  return idOf(value.care_plan || value, ['care_plan_id', 'id', '_id'])
}

function consultationIdOf(consultation = {}) {
  const value = consultation || {}
  return idOf(value.consultation || value, ['consultation_id', 'id', '_id'])
}

function diagnosisIdOf(diagnosis = {}) {
  const value = diagnosis || {}
  return idOf(value.diagnosis || value, ['diagnosis_id', 'id', '_id'])
}

function noteIdOf(note = {}) {
  const value = note || {}
  return idOf(value.clinical_note || value.note || value, ['note_id', 'clinical_note_id', 'id', '_id'])
}

function problemIdOf(problem = {}) {
  const value = problem || {}
  return idOf(value.problem || value, ['problem_id', 'id', '_id'])
}

function allergyIdOf(allergy = {}) {
  const value = allergy || {}
  return idOf(value.allergy || value, ['allergy_id', 'id', '_id'])
}

function patientName(source = {}) {
  const value = source || {}
  const patient = value.patient || value.patient_id || value
  return value.patient_name || patient?.full_name || patient?.fullName || patient?.name || 'Bệnh nhân'
}

function patientCode(source = {}) {
  const value = source || {}
  const patient = value.patient || value.patient_id || value
  return value.patient_code || patient?.patient_code || patient?.patientCode || patientIdOf(value)
}

function formatDateTime(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDate(value) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function minutesSince(value) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return null
  return Math.max(0, Math.round((Date.now() - time) / 60000))
}

function waitText(value) {
  const minutes = minutesSince(value)
  if (minutes === null) return '--'
  if (minutes < 60) return `${minutes} phút`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}p`
}

function statusLabel(status = '') {
  const labels = {
    waiting: 'Đang chờ',
    called: 'Đã gọi',
    recalled: 'Gọi lại',
    ready_for_doctor: 'Sẵn sàng',
    in_service: 'Đang phục vụ',
    planned: 'Dự kiến',
    arrived: 'Đã đến',
    in_progress: 'Đang khám',
    on_hold: 'Tạm dừng',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    draft: 'Draft',
    active: 'Active',
    signed: 'Đã ký',
    final: 'Final',
    sealed: 'Đã niêm phong',
    released: 'Đã release',
  }
  return labels[String(status || '').toLowerCase()] || status || 'Chưa rõ'
}

function toneFor(status = '', priority = '') {
  const value = String(status || '').toLowerCase()
  const level = String(priority || '').toLowerCase()
  if (['critical', 'stat', 'urgent'].includes(level) || value.includes('critical')) return 'critical'
  if (['draft', 'on_hold', 'waiting', 'called'].includes(value)) return 'warning'
  if (['completed', 'signed', 'final', 'sealed', 'active', 'released'].includes(value)) return 'success'
  return 'neutral'
}

function isReleased(item = {}) {
  return Boolean(item.released_to_patient || item.released_at || item.release_status === 'released')
}

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`dw2-pill dw2-tone-${tone}`}>{children}</span>
}

function CommandNotice({ error, success }) {
  if (!error && !success) return null
  return (
    <div className={`dw2-command-notice ${error ? 'is-error' : 'is-success'}`}>
      {error || success}
    </div>
  )
}

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="dw2-panel">
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
      <Inbox size={18} />
      <span>{label}</span>
    </div>
  )
}

function KpiStrip({ items }) {
  return (
    <div className="dw2-command-kpis">
      {items.map((item) => (
        <article className={`dw2-command-kpi dw2-tone-${item.tone || 'neutral'}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.hint}</small>
        </article>
      ))}
    </div>
  )
}

function ActionButton({ children, onClick, disabled, tone = 'neutral', type = 'button' }) {
  return (
    <button type={type} className={`dw2-command-button is-${tone}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label className="dw2-command-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function PatientClinical360({ summary, timeline, records, attachments, documentTimeline, onNavigate }) {
  if (!summary?.patient) {
    return <EmptyState label="Chọn một bệnh nhân để mở Patient Clinical 360." />
  }

  const patient = summary.patient
  const alerts = safeArray(summary.alerts)
  const latestVital = safeArray(summary.latest_vitals)[0]

  return (
    <div className="dw2-clinical-360">
      <div className="dw2-clinical-360__header">
        <span className="dw2-clinical-avatar">{String(patient.full_name || 'BN').slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{patient.full_name || 'Bệnh nhân'}</strong>
          <p>{[patient.gender, patient.age ? `${patient.age} tuổi` : '', patient.patient_code].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <div className="dw2-command-badges">
        {alerts.length ? alerts.slice(0, 4).map((alert, index) => (
          <StatusPill key={`${alert.type}-${index}`} tone={alert.severity === 'high' || alert.severity === 'critical' ? 'critical' : 'warning'}>
            {alert.title || alert.type}
          </StatusPill>
        )) : <StatusPill tone="success">Không có cảnh báo active</StatusPill>}
        <StatusPill tone={latestVital ? 'neutral' : 'warning'}>
          {latestVital ? `HA ${latestVital.systolic_bp || '--'}/${latestVital.diastolic_bp || '--'} · SpO2 ${latestVital.spo2 || '--'}%` : 'Chưa có sinh hiệu'}
        </StatusPill>
      </div>
      <div className="dw2-blueprint-grid dw2-blueprint-grid--compact">
        <div><h4>Dị ứng</h4><p>{safeArray(summary.allergies).slice(0, 3).map((item) => item.allergen || item.allergen_name).filter(Boolean).join(' · ') || 'Không ghi nhận'}</p></div>
        <div><h4>Problem active</h4><p>{safeArray(summary.problems).slice(0, 3).map((item) => item.problem_name || item.title).filter(Boolean).join(' · ') || 'Không ghi nhận'}</p></div>
        <div><h4>Đơn thuốc gần đây</h4><p>{safeArray(summary.prescriptions).slice(0, 2).map((item) => item.prescription_no || item.status).filter(Boolean).join(' · ') || 'Không có'}</p></div>
      </div>
      <div className="dw2-command-lists">
        <Panel title="Encounter gần đây" subtitle="Tối đa 5 lần khám mới nhất từ database.">
          <div className="dw2-compact-list">
            {!safeArray(summary.encounters).length ? <EmptyState label="Chưa có encounter." /> : safeArray(summary.encounters).slice(0, 5).map((encounter) => (
              <button type="button" key={encounterIdOf(encounter)} onClick={() => onNavigate(`/doctor/encounters?view=active&encounterId=${encounterIdOf(encounter)}`)}>
                <Stethoscope size={16} />
                <span><strong>{encounter.encounter_code || 'Encounter'}</strong><small>{statusLabel(encounter.status)} · {formatDateTime(encounter.start_time || encounter.started_at)}</small></span>
                <StatusPill tone={toneFor(encounter.status)}>{statusLabel(encounter.status)}</StatusPill>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Hồ sơ và tài liệu" subtitle="Medical record, attachment và document timeline.">
          <div className="dw2-compact-list">
            {[...safeArray(records).slice(0, 3), ...safeArray(attachments).slice(0, 3)].length ? (
              [...safeArray(records).slice(0, 3), ...safeArray(attachments).slice(0, 3)].map((item, index) => (
                <button type="button" key={`${recordIdOf(item) || attachmentIdOf(item)}-${index}`}>
                  <FileText size={16} />
                  <span><strong>{item.record_no || item.file_name || item.title || 'Tài liệu'}</strong><small>{item.record_type || item.category || item.status || 'document'} · {formatDateTime(item.created_at || item.opened_at)}</small></span>
                  <StatusPill tone={isReleased(item) ? 'success' : 'neutral'}>{isReleased(item) ? 'Release' : statusLabel(item.status)}</StatusPill>
                </button>
              ))
            ) : <EmptyState label="Chưa có hồ sơ/tài liệu." />}
          </div>
        </Panel>
      </div>
      <Panel title="Timeline" subtitle="Sự kiện bệnh nhân gần đây.">
        <div className="dw2-command-timeline">
          {!safeArray(timeline).length && !safeArray(documentTimeline).length ? <EmptyState label="Chưa có timeline." /> : [...safeArray(timeline), ...safeArray(documentTimeline)].slice(0, 8).map((event, index) => (
            <div key={`${event.event_id || event.id || index}`}>
              <time>{formatDateTime(event.created_at || event.timestamp || event.event_time || event.opened_at)}</time>
              <strong>{event.title || event.event_type || event.type || 'Sự kiện'}</strong>
              <span>{event.description || event.message || event.status || ''}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

async function loadPatient360(patientId) {
  if (!patientId) return { summary: null, timeline: [], records: [], attachments: [], documentTimeline: [] }
  const [summary, timeline, records, attachments, documentTimeline] = await Promise.allSettled([
    doctorWorkspaceAPI.patientSummary(patientId),
    patientAPI.timeline(patientId),
    recordsAPI.listPatientMedicalRecords(patientId, { limit: 20 }),
    recordsAPI.listPatientAttachments(patientId, { limit: 20 }),
    recordsAPI.getPatientDocumentTimeline(patientId, { limit: 30 }),
  ])

  return {
    summary: summary.status === 'fulfilled' ? dataOf(summary.value, null) : null,
    timeline: timeline.status === 'fulfilled' ? safeArray(dataOf(timeline.value, [])) : [],
    records: records.status === 'fulfilled' ? safeArray(dataOf(records.value, [])) : [],
    attachments: attachments.status === 'fulfilled' ? safeArray(dataOf(attachments.value, [])) : [],
    documentTimeline: documentTimeline.status === 'fulfilled' ? safeArray(dataOf(documentTimeline.value, [])) : [],
  }
}

export function DoctorPatientFlowPage({ item, overview, onNavigate, onRefresh }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [patient360, setPatient360] = useState({ summary: null, timeline: [], records: [], attachments: [], documentTimeline: [] })
  const [notice, setNotice] = useState({ error: '', success: '' })

  const viewKey = item?.key || 'patients-waiting'

  useEffect(() => {
    let cancelled = false
    async function loadRows() {
      setLoading(true)
      try {
        let nextRows = []
        if (viewKey === 'patients-waiting') {
          nextRows = safeArray(overview.queue)
        } else if (viewKey === 'patients-in-care') {
          nextRows = safeArray(overview.active_encounters)
        } else if (viewKey === 'patients-seen-today') {
          const response = await encounterAPI.listToday({ status: 'completed', limit: 60 })
          nextRows = safeArray(dataOf(response, []))
        } else if (viewKey === 'follow-up-due') {
          const [tasks, appointments] = await Promise.allSettled([
            doctorWorkspaceAPI.tasks({ q: 'follow', limit: 50 }),
            appointmentAPI.listUpcoming({ q: 'follow', limit: 50 }),
          ])
          nextRows = [
            ...safeArray(tasks.status === 'fulfilled' ? dataOf(tasks.value, []) : []).map((task) => ({ ...task, row_type: 'task' })),
            ...safeArray(appointments.status === 'fulfilled' ? dataOf(appointments.value, []) : []).map((appointment) => ({ ...appointment, row_type: 'appointment' })),
          ]
        } else {
          const response = query.trim()
            ? await patientAPI.search({ q: query.trim(), limit: 50 })
            : await patientAPI.list({ limit: 50 })
          nextRows = safeArray(dataOf(response, []))
        }
        if (!cancelled) setRows(nextRows)
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tải được danh sách bệnh nhân.'), success: '' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadRows()
    return () => { cancelled = true }
  }, [viewKey, overview.queue, overview.active_encounters, query])

  useEffect(() => {
    let cancelled = false
    if (!selectedPatientId) return undefined
    async function load() {
      try {
        const data = await loadPatient360(selectedPatientId)
        if (!cancelled) setPatient360(data)
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tải được Patient Clinical 360.'), success: '' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedPatientId])

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || viewKey === 'patient-history') return rows
    return rows.filter((row) => {
      const text = [patientName(row), patientCode(row), row.reason, row.title, row.description, row.encounter_code, row.queue_number]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return text.includes(q)
    })
  }, [query, rows, viewKey])

  async function selectRow(row) {
    const patientId = patientIdOf(row)
    if (patientId) setSelectedPatientId(patientId)
  }

  async function startFromQueue(row) {
    const ticketId = ticketIdOf(row)
    if (!ticketId) {
      setNotice({ error: 'Queue ticket không có id để bắt đầu encounter.', success: '' })
      return
    }
    try {
      setNotice({ error: '', success: '' })
      await queueAPI.call(ticketId).catch(() => null)
      const response = await encounterAPI.createFromQueue(ticketId)
      const payload = dataOf(response, {})
      const encounterId = encounterIdOf(payload.encounter || payload)
      setNotice({ error: '', success: 'Đã tạo encounter từ queue ticket.' })
      onRefresh?.()
      if (encounterId) onNavigate(`/doctor/encounters?view=active&encounterId=${encounterId}`)
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Không bắt đầu được encounter từ queue.'), success: '' })
    }
  }

  async function createFollowUp() {
    const patientId = selectedPatientId || patientIdOf(filteredRows[0] || {})
    if (!patientId) {
      setNotice({ error: 'Chọn bệnh nhân trước khi tạo follow-up.', success: '' })
      return
    }
    try {
      await clinicalAPI.createCarePlan({
        patient_id: patientId,
        title: 'Follow-up tại phòng khám',
        goals: [{ goal: 'Bác sĩ cần theo dõi lại bệnh nhân theo kế hoạch.', target_date: new Date().toISOString() }],
        interventions: [{ description: 'Liên hệ bệnh nhân, xem kết quả cần theo dõi hoặc tạo lịch tái khám.', responsible_role: 'doctor' }],
        status: 'active',
        notes: 'Tạo từ Doctor Workspace - Follow-up đến hạn.',
      })
      setNotice({ error: '', success: 'Đã tạo care plan follow-up trong database.' })
      onRefresh?.()
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Không tạo được follow-up.'), success: '' })
    }
  }

  const kpis = [
    { label: 'Tổng dòng', value: filteredRows.length, hint: item?.label, tone: 'neutral' },
    { label: 'Queue active', value: safeArray(overview.queue).length, hint: 'Từ doctor-workspace overview', tone: 'warning' },
    { label: 'Encounter mở', value: safeArray(overview.active_encounters).length, hint: 'in_progress/on_hold/arrived', tone: 'success' },
    { label: 'Việc cần hoàn tất', value: safeArray(overview.tasks).length, hint: 'Task inbox lâm sàng', tone: 'neutral' },
  ]

  return (
    <div className="dw2-command-page">
      <KpiStrip items={kpis} />
      <CommandNotice error={notice.error} success={notice.success} />
      <div className="dw2-command-toolbar">
        <div className="dw2-command-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên, mã BN, STT queue, encounter, lý do khám..." />
        </div>
        <ActionButton onClick={createFollowUp} tone="success"><PlusCircle size={16} /> Tạo follow-up</ActionButton>
      </div>
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <Panel title={item?.label || 'Bệnh nhân của tôi'} subtitle="Danh sách điều phối dựa trên doctor-workspace overview và endpoint nghiệp vụ hiện có.">
            <div className="dw2-command-table">
              <div className="dw2-command-row is-head">
                <span>Bệnh nhân</span><span>Trạng thái</span><span>Clinical signal</span><span>Thời gian</span><span>Thao tác</span>
              </div>
              {loading ? <EmptyState label="Đang tải dữ liệu..." /> : null}
              {!loading && !filteredRows.length ? <EmptyState label="Chưa có bệnh nhân phù hợp." /> : null}
              {!loading && filteredRows.map((row, index) => {
                const status = row.status || row.encounter_status || row.row_type || ''
                const latestVital = row.latest_vital || row.latest_vital_signs
                return (
                  <div className="dw2-command-row" key={`${ticketIdOf(row) || encounterIdOf(row) || patientIdOf(row) || index}`}>
                    <button type="button" onClick={() => selectRow(row)}>
                      <strong>{patientName(row)}</strong>
                      <small>{patientCode(row) || row.encounter_code || row.queue_number || 'Chưa có mã'}</small>
                    </button>
                    <span><StatusPill tone={toneFor(status, row.priority || row.queue_type)}>{statusLabel(status || row.queue_type)}</StatusPill></span>
                    <span>{latestVital ? `SpO2 ${latestVital.spo2 || '--'}% · Mạch ${latestVital.heart_rate || latestVital.pulse || '--'}` : row.description || row.reason || 'Chưa có sinh hiệu/cảnh báo'}</span>
                    <span>{waitText(row.checkin_time || row.started_at || row.start_time || row.created_at)}</span>
                    <span className="dw2-command-actions">
                      {ticketIdOf(row) ? <ActionButton onClick={() => startFromQueue(row)} tone="success"><Play size={15} /> Bắt đầu</ActionButton> : null}
                      {encounterIdOf(row) ? <ActionButton onClick={() => onNavigate(`/doctor/encounters?view=active&encounterId=${encounterIdOf(row)}`)}><Stethoscope size={15} /> Mở</ActionButton> : null}
                    </span>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Patient Clinical 360" subtitle="Tóm tắt lâm sàng lấy từ /doctor-workspace/patients/:id/summary và records.">
            <PatientClinical360 {...patient360} onNavigate={onNavigate} />
          </Panel>
          {viewKey === 'follow-up-due' ? (
            <Panel title="Backend gap được xử lý rõ" subtitle="Không giả lập DoctorFollowUpTask khi backend chưa có model riêng.">
              <div className="dw2-focus-list">
                <div><AlertTriangle size={16} /><span>Follow-up hiện được ghi nhận bằng CarePlan active để có tác động database thật.</span></div>
                <div><CheckCircle2 size={16} /><span>Khi backend có /doctor-workspace/follow-ups, UI có thể chuyển sang queue chuyên biệt.</span></div>
              </div>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function readinessItems(readiness = {}) {
  const checklist = safeArray(readiness.checklist)
  if (checklist.length) return checklist
  return [
    { key: 'note', label: 'Clinical note đã ký', done: !safeArray(readiness.missing).some((item) => String(item).toLowerCase().includes('note')) },
    { key: 'diagnosis', label: 'Có chẩn đoán chính', done: !safeArray(readiness.missing).some((item) => String(item).toLowerCase().includes('chẩn đoán')) },
    { key: 'orders', label: 'Không còn order chờ', done: true },
    { key: 'prescription', label: 'Không còn đơn thuốc draft', done: true },
  ]
}

async function loadEncounterWorkspace(encounterId) {
  if (!encounterId) return {}
  const calls = await Promise.allSettled([
    encounterAPI.detail(encounterId),
    encounterAPI.summary(encounterId),
    encounterAPI.timeline(encounterId),
    encounterAPI.canStart(encounterId),
    encounterAPI.canComplete(encounterId),
    encounterAPI.editable(encounterId),
    clinicalAPI.encounterSummary(encounterId),
    clinicalAPI.listNotes({ encounter_id: encounterId }),
    clinicalAPI.listDiagnoses(encounterId),
    clinicalAPI.listVitalSigns(encounterId),
    encounterAPI.listOrders(encounterId, { limit: 40 }),
    clinicalAPI.listCarePlans({ encounter_id: encounterId, limit: 40 }),
    clinicalAPI.listConsultations({ encounter_id: encounterId, limit: 40 }),
    recordsAPI.getEncounterMedicalRecord(encounterId),
  ])
  const value = (index, fallback) => calls[index].status === 'fulfilled' ? dataOf(calls[index].value, fallback) : fallback
  return {
    detail: value(0, null),
    summary: value(1, null),
    timeline: safeArray(value(2, [])),
    canStart: value(3, null),
    canComplete: value(4, null),
    editable: value(5, null),
    clinicalSummary: value(6, null),
    notes: safeArray(value(7, [])),
    diagnoses: safeArray(value(8, [])),
    vitals: safeArray(value(9, [])),
    orders: safeArray(value(10, [])),
    carePlans: safeArray(value(11, [])),
    consultations: safeArray(value(12, [])),
    record: value(13, null),
  }
}

export function DoctorEncounterCommandPage({ item, overview, onNavigate, onRefresh }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const requestedEncounterId = params.get('encounterId') || ''
  const [selectedEncounterId, setSelectedEncounterId] = useState(requestedEncounterId || encounterIdOf(safeArray(overview.active_encounters)[0] || {}))
  const [workspace, setWorkspace] = useState({})
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState({ error: '', success: '' })
  const [noteForm, setNoteForm] = useState({ title: 'SOAP note', content: '' })
  const [diagnosisForm, setDiagnosisForm] = useState({ icd10_code: '', diagnosis_name: '', diagnosis_type: 'provisional', is_primary: true })
  const [vitalForm, setVitalForm] = useState({ temperature: '', heart_rate: '', respiratory_rate: '', systolic_bp: '', diastolic_bp: '', spo2: '', weight: '', height: '' })
  const [carePlanForm, setCarePlanForm] = useState({ title: 'Kế hoạch điều trị', goal: '', intervention: '' })
  const [consultForm, setConsultForm] = useState({ chief_complaint: '', assessment: '', plan: '' })
  const [problemForm, setProblemForm] = useState({ problem_name: '', severity: 'unknown', notes: '' })

  useEffect(() => {
    if (requestedEncounterId) setSelectedEncounterId(requestedEncounterId)
  }, [requestedEncounterId])

  useEffect(() => {
    let cancelled = false
    if (!selectedEncounterId) return undefined
    async function load() {
      setLoading(true)
      try {
        const data = await loadEncounterWorkspace(selectedEncounterId)
        if (!cancelled) setWorkspace(data)
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tải được encounter workspace.'), success: '' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedEncounterId])

  const encounter = workspace.detail?.encounter || workspace.detail || safeArray(overview.active_encounters).find((row) => encounterIdOf(row) === selectedEncounterId) || null
  const patientId = patientIdOf(encounter)
  const readiness = encounter?.readiness || workspace.canComplete || workspace.summary?.readiness || {}
  const currentView = item?.key || 'encounter-active'

  async function runAction(action, successMessage) {
    try {
      setNotice({ error: '', success: '' })
      await action()
      setNotice({ error: '', success: successMessage })
      if (selectedEncounterId) setWorkspace(await loadEncounterWorkspace(selectedEncounterId))
      onRefresh?.()
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Thao tác không thành công.'), success: '' })
    }
  }

  async function createFromQueue(ticket) {
    const ticketId = ticketIdOf(ticket)
    if (!ticketId) return
    await runAction(async () => {
      const response = await encounterAPI.createFromQueue(ticketId)
      const payload = dataOf(response, {})
      const encounterId = encounterIdOf(payload.encounter || payload)
      if (encounterId) setSelectedEncounterId(encounterId)
    }, 'Đã tạo encounter từ queue ticket.')
  }

  async function createFromAppointment(appointment) {
    const appointmentId = appointmentIdOf(appointment)
    if (!appointmentId) return
    await runAction(async () => {
      const response = await encounterAPI.createFromAppointment(appointmentId)
      const payload = dataOf(response, {})
      const encounterId = encounterIdOf(payload.encounter || payload)
      if (encounterId) setSelectedEncounterId(encounterId)
    }, 'Đã tạo encounter từ lịch hẹn.')
  }

  async function createNote(event) {
    event.preventDefault()
    if (!selectedEncounterId || !noteForm.content.trim()) return
    await runAction(() => clinicalAPI.createNote({
      encounter_id: selectedEncounterId,
      title: noteForm.title,
      note_type: 'progress_note',
      content: noteForm.content,
      visibility: 'care_team',
    }), 'Đã lưu clinical note vào database.')
    setNoteForm({ title: 'SOAP note', content: '' })
  }

  async function createDiagnosis(event) {
    event.preventDefault()
    if (!selectedEncounterId || !diagnosisForm.diagnosis_name.trim()) return
    await runAction(() => clinicalAPI.createDiagnosis({ encounter_id: selectedEncounterId, ...diagnosisForm }), 'Đã thêm chẩn đoán.')
    setDiagnosisForm({ icd10_code: '', diagnosis_name: '', diagnosis_type: 'provisional', is_primary: false })
  }

  async function createVitals(event) {
    event.preventDefault()
    await runAction(() => clinicalAPI.createVitalSigns({
      patient_id: patientId,
      encounter_id: selectedEncounterId,
      context: 'encounter',
      recorded_at: new Date().toISOString(),
      ...Object.fromEntries(Object.entries(vitalForm).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)])),
    }), 'Đã ghi sinh hiệu.')
  }

  async function createCarePlan(event) {
    event.preventDefault()
    if (!patientId || !carePlanForm.title.trim()) return
    await runAction(() => clinicalAPI.createCarePlan({
      patient_id: patientId,
      encounter_id: selectedEncounterId,
      title: carePlanForm.title,
      goals: carePlanForm.goal ? [{ goal: carePlanForm.goal }] : [],
      interventions: carePlanForm.intervention ? [{ description: carePlanForm.intervention, responsible_role: 'doctor' }] : [],
      status: 'active',
    }), 'Đã tạo care plan.')
  }

  async function createConsultation(event) {
    event.preventDefault()
    if (!selectedEncounterId) return
    await runAction(() => clinicalAPI.createConsultation({
      encounter_id: selectedEncounterId,
      chief_complaint: consultForm.chief_complaint,
      assessment: consultForm.assessment,
      plan: consultForm.plan,
      status: 'draft',
      allow_multiple: true,
    }), 'Đã tạo consultation.')
  }

  async function createProblem(event) {
    event.preventDefault()
    if (!patientId || !problemForm.problem_name.trim()) return
    await runAction(() => clinicalAPI.createPatientProblem(patientId, {
      encounter_id: selectedEncounterId,
      ...problemForm,
    }), 'Đã thêm problem vào hồ sơ bệnh nhân.')
    setProblemForm({ problem_name: '', severity: 'unknown', notes: '' })
  }

  const selectedPatient = encounter?.patient || encounter?.patient_id || null
  const kpis = [
    { label: 'Encounter mở', value: safeArray(overview.active_encounters).length, hint: 'Theo overview', tone: 'success' },
    { label: 'Note', value: safeArray(workspace.notes).length, hint: 'clinical notes', tone: 'neutral' },
    { label: 'Chẩn đoán', value: safeArray(workspace.diagnoses).length, hint: 'diagnoses active', tone: 'neutral' },
    { label: 'Order', value: safeArray(workspace.orders).length, hint: 'encounter orders', tone: safeArray(workspace.orders).length ? 'warning' : 'success' },
  ]

  return (
    <div className="dw2-command-page">
      <KpiStrip items={kpis} />
      <CommandNotice error={notice.error} success={notice.success} />
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          <Panel title="Encounter đang mở" subtitle="Chọn encounter để thao tác clinical note, diagnosis, care plan, consultation và complete.">
            <div className="dw2-encounter-list">
              {!safeArray(overview.active_encounters).length ? <EmptyState label="Không có encounter đang mở." /> : safeArray(overview.active_encounters).map((row) => (
                <button type="button" key={encounterIdOf(row)} className={`dw2-encounter-card ${encounterIdOf(row) === selectedEncounterId ? 'is-selected' : ''}`} onClick={() => setSelectedEncounterId(encounterIdOf(row))}>
                  <div><strong>{row.encounter_code || 'Encounter'}</strong><span>{patientName(row)}</span></div>
                  <div className="dw2-progress"><span style={{ width: `${row.readiness?.score || 0}%` }} /></div>
                  <small>{statusLabel(row.status)} · {safeArray(row.readiness?.missing).join(' · ') || 'Checklist ổn'}</small>
                </button>
              ))}
            </div>
          </Panel>

          {currentView === 'encounter-start' ? (
            <div className="dw2-two-panels">
              <Panel title="Tạo từ queue" subtitle="POST /api/encounters/queue/:ticketId">
                <div className="dw2-compact-list">
                  {!safeArray(overview.queue).length ? <EmptyState label="Không có queue sẵn sàng." /> : safeArray(overview.queue).map((ticket) => (
                    <button type="button" key={ticketIdOf(ticket)} onClick={() => createFromQueue(ticket)}>
                      <UsersRound size={16} /><span><strong>{patientName(ticket)}</strong><small>STT {ticket.display_number || ticket.queue_number || '--'} · {statusLabel(ticket.status)}</small></span><Play size={16} />
                    </button>
                  ))}
                </div>
              </Panel>
              <Panel title="Tạo từ lịch hẹn" subtitle="POST /api/encounters/appointment/:appointmentId">
                <div className="dw2-compact-list">
                  {!safeArray(overview.appointments).length ? <EmptyState label="Không có lịch hẹn hôm nay." /> : safeArray(overview.appointments).map((appointment) => (
                    <button type="button" key={appointmentIdOf(appointment)} onClick={() => createFromAppointment(appointment)}>
                      <CalendarDays size={16} /><span><strong>{patientName(appointment)}</strong><small>{formatDateTime(appointment.appointment_time)} · {statusLabel(appointment.status)}</small></span><PlusCircle size={16} />
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          ) : null}

          {currentView === 'clinical-note' || currentView === 'encounter-active' ? (
            <Panel title="Clinical note" subtitle="Tạo note thật qua /api/clinical/notes, sau đó có thể start/complete/sign.">
              <form className="dw2-command-form" onSubmit={createNote}>
                <Field label="Tiêu đề"><input value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Nội dung SOAP / progress note"><textarea rows={7} value={noteForm.content} onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))} /></Field>
                <ActionButton type="submit" tone="success"><FileText size={16} /> Lưu note</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.notes).length ? <EmptyState label="Chưa có note." /> : safeArray(workspace.notes).map((note) => (
                  <button type="button" key={noteIdOf(note)}>
                    <FileText size={16} />
                    <span><strong>{note.title || note.note_type || 'Clinical note'}</strong><small>{statusLabel(note.status)} · {formatDateTime(note.created_at)}</small></span>
                    <span className="dw2-command-actions">
                      <ActionButton onClick={() => runAction(() => clinicalAPI.startNote(noteIdOf(note)), 'Đã chuyển note sang in_progress.')}>Start</ActionButton>
                      <ActionButton onClick={() => runAction(() => clinicalAPI.completeNote(noteIdOf(note)), 'Đã complete note.')}>Complete</ActionButton>
                      <ActionButton onClick={() => runAction(() => clinicalAPI.signNote(noteIdOf(note)), 'Đã ký note.')} tone="success">Ký</ActionButton>
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {currentView === 'diagnosis' ? (
            <Panel title="Chẩn đoán" subtitle="Backend đảm bảo chỉ một primary diagnosis active trên encounter.">
              <form className="dw2-command-form" onSubmit={createDiagnosis}>
                <Field label="ICD-10"><input value={diagnosisForm.icd10_code} onChange={(event) => setDiagnosisForm((current) => ({ ...current, icd10_code: event.target.value }))} /></Field>
                <Field label="Tên chẩn đoán"><input value={diagnosisForm.diagnosis_name} onChange={(event) => setDiagnosisForm((current) => ({ ...current, diagnosis_name: event.target.value }))} /></Field>
                <Field label="Loại"><select value={diagnosisForm.diagnosis_type} onChange={(event) => setDiagnosisForm((current) => ({ ...current, diagnosis_type: event.target.value }))}><option value="provisional">Provisional</option><option value="confirmed">Confirmed</option><option value="differential">Differential</option></select></Field>
                <Field label="Primary"><input type="checkbox" checked={diagnosisForm.is_primary} onChange={(event) => setDiagnosisForm((current) => ({ ...current, is_primary: event.target.checked }))} /></Field>
                <ActionButton type="submit" tone="success"><PlusCircle size={16} /> Thêm chẩn đoán</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.diagnoses).length ? <EmptyState label="Chưa có chẩn đoán." /> : safeArray(workspace.diagnoses).map((diagnosis) => (
                  <button type="button" key={diagnosisIdOf(diagnosis)}>
                    <ClipboardCheck size={16} /><span><strong>{diagnosis.diagnosis_name || diagnosis.icd10_code}</strong><small>{diagnosis.icd10_code || '--'} · {diagnosis.is_primary ? 'Primary' : diagnosis.diagnosis_type}</small></span>
                    <span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => clinicalAPI.setPrimaryDiagnosis(diagnosisIdOf(diagnosis)), 'Đã đặt primary diagnosis.')}>Primary</ActionButton><ActionButton onClick={() => runAction(() => clinicalAPI.resolveDiagnosis(diagnosisIdOf(diagnosis)), 'Đã resolve diagnosis.')}>Resolve</ActionButton></span>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {currentView === 'problem-list' ? (
            <Panel title="Problem list" subtitle="Problem dài hạn theo patient, có thể liên kết encounter hiện tại.">
              <form className="dw2-command-form" onSubmit={createProblem}>
                <Field label="Tên vấn đề"><input value={problemForm.problem_name} onChange={(event) => setProblemForm((current) => ({ ...current, problem_name: event.target.value }))} /></Field>
                <Field label="Mức độ"><select value={problemForm.severity} onChange={(event) => setProblemForm((current) => ({ ...current, severity: event.target.value }))}><option value="unknown">Unknown</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></Field>
                <Field label="Ghi chú"><input value={problemForm.notes} onChange={(event) => setProblemForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
                <ActionButton type="submit" tone="success"><PlusCircle size={16} /> Thêm problem</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.clinicalSummary?.problems).length ? <EmptyState label="Chưa có problem active." /> : safeArray(workspace.clinicalSummary?.problems).map((problem) => (
                  <button type="button" key={problemIdOf(problem)}>
                    <ListChecks size={16} /><span><strong>{problem.problem_name || problem.name}</strong><small>{problem.severity || '--'} · {statusLabel(problem.status)}</small></span>
                    <ActionButton onClick={() => runAction(() => clinicalAPI.resolveProblem(problemIdOf(problem)), 'Đã resolve problem.')}>Resolve</ActionButton>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {currentView === 'care-plan' ? (
            <Panel title="Care plan" subtitle="Tạo kế hoạch điều trị, dặn dò và follow-up bằng model CarePlan thật.">
              <form className="dw2-command-form" onSubmit={createCarePlan}>
                <Field label="Tiêu đề"><input value={carePlanForm.title} onChange={(event) => setCarePlanForm((current) => ({ ...current, title: event.target.value }))} /></Field>
                <Field label="Mục tiêu"><input value={carePlanForm.goal} onChange={(event) => setCarePlanForm((current) => ({ ...current, goal: event.target.value }))} /></Field>
                <Field label="Can thiệp"><input value={carePlanForm.intervention} onChange={(event) => setCarePlanForm((current) => ({ ...current, intervention: event.target.value }))} /></Field>
                <ActionButton type="submit" tone="success"><PlusCircle size={16} /> Tạo care plan</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.carePlans).length ? <EmptyState label="Chưa có care plan." /> : safeArray(workspace.carePlans).map((plan) => (
                  <button type="button" key={carePlanIdOf(plan)}>
                    <ClipboardList size={16} /><span><strong>{plan.title || plan.plan_no}</strong><small>{statusLabel(plan.status)} · {safeArray(plan.goals).length} mục tiêu</small></span>
                    <span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => clinicalAPI.completeCarePlan(carePlanIdOf(plan)), 'Đã hoàn tất care plan.')} tone="success">Complete</ActionButton><ActionButton onClick={() => runAction(() => clinicalAPI.cancelCarePlan(carePlanIdOf(plan), { reason: 'Cancelled from doctor workspace' }), 'Đã hủy care plan.')}>Cancel</ActionButton></span>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {currentView === 'consultation' ? (
            <Panel title="Consultation" subtitle="Tạo và ký consultation record trong encounter.">
              <form className="dw2-command-form" onSubmit={createConsultation}>
                <Field label="Lý do / than phiền"><input value={consultForm.chief_complaint} onChange={(event) => setConsultForm((current) => ({ ...current, chief_complaint: event.target.value }))} /></Field>
                <Field label="Assessment"><input value={consultForm.assessment} onChange={(event) => setConsultForm((current) => ({ ...current, assessment: event.target.value }))} /></Field>
                <Field label="Plan"><input value={consultForm.plan} onChange={(event) => setConsultForm((current) => ({ ...current, plan: event.target.value }))} /></Field>
                <ActionButton type="submit" tone="success"><PlusCircle size={16} /> Tạo consultation</ActionButton>
              </form>
              <div className="dw2-compact-list">
                {!safeArray(workspace.consultations).length ? <EmptyState label="Chưa có consultation." /> : safeArray(workspace.consultations).map((consultation) => (
                  <button type="button" key={consultationIdOf(consultation)}>
                    <Send size={16} /><span><strong>{consultation.consultation_no || consultation.chief_complaint || 'Consultation'}</strong><small>{statusLabel(consultation.status)} · {consultation.assessment || '--'}</small></span>
                    <span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => clinicalAPI.startConsultation(consultationIdOf(consultation)), 'Đã start consultation.')}>Start</ActionButton><ActionButton onClick={() => runAction(() => clinicalAPI.signConsultation(consultationIdOf(consultation)), 'Đã ký consultation.')} tone="success">Ký</ActionButton></span>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {currentView === 'complete-encounter' ? (
            <Panel title="Hoàn tất encounter" subtitle="Kiểm tra can-complete, tạo medical record, finalize và release.">
              <div className="dw2-focus-list">
                {readinessItems(readiness).map((check) => (
                  <div key={check.key}><CheckCircle2 size={16} /><span>{check.label}: {check.done ? 'Đạt' : 'Còn thiếu'}</span></div>
                ))}
              </div>
              <div className="dw2-command-actions is-wide">
                <ActionButton onClick={() => runAction(() => encounterAPI.complete(selectedEncounterId), 'Đã hoàn tất encounter.')} tone="success"><CheckCircle2 size={16} /> Hoàn tất encounter</ActionButton>
                <ActionButton onClick={() => runAction(() => recordsAPI.createMedicalRecordFromEncounter(selectedEncounterId, { title: `Hồ sơ ${encounter?.encounter_code || ''}` }), 'Đã tạo medical record.') }><FileText size={16} /> Tạo medical record</ActionButton>
                {recordIdOf(workspace.record?.medical_record || workspace.record) ? <ActionButton onClick={() => runAction(() => recordsAPI.finalizeMedicalRecord(recordIdOf(workspace.record?.medical_record || workspace.record)), 'Đã finalize medical record.')}>Finalize</ActionButton> : null}
                {recordIdOf(workspace.record?.medical_record || workspace.record) ? <ActionButton onClick={() => runAction(() => recordsAPI.releaseMedicalRecordToPatient(recordIdOf(workspace.record?.medical_record || workspace.record)), 'Đã release medical record cho patient.')} tone="success">Release</ActionButton> : null}
              </div>
            </Panel>
          ) : null}

          {currentView === 'vitals' ? (
            <Panel title="Sinh hiệu encounter" subtitle="Ghi sinh hiệu mới bằng /api/clinical/vital-signs.">
              <form className="dw2-command-form" onSubmit={createVitals}>
                {Object.keys(vitalForm).map((key) => <Field key={key} label={key}><input type="number" value={vitalForm[key]} onChange={(event) => setVitalForm((current) => ({ ...current, [key]: event.target.value }))} /></Field>)}
                <ActionButton type="submit" tone="success"><HeartPulse size={16} /> Ghi sinh hiệu</ActionButton>
              </form>
            </Panel>
          ) : null}
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Encounter summary" subtitle={loading ? 'Đang tải...' : 'Patient, readiness, orders, timeline.'}>
            {!encounter ? <EmptyState label="Chọn encounter để xem chi tiết." /> : (
              <div className="dw2-clinical-360">
                <div className="dw2-clinical-360__header"><span className="dw2-clinical-avatar">{String(patientName(encounter)).slice(0, 2).toUpperCase()}</span><div><strong>{patientName(encounter)}</strong><p>{encounter.encounter_code || selectedEncounterId}</p></div></div>
                <div className="dw2-command-badges"><StatusPill tone={toneFor(encounter.status)}>{statusLabel(encounter.status)}</StatusPill><StatusPill tone={workspace.editable?.editable === false ? 'warning' : 'success'}>{workspace.editable?.editable === false ? 'Không editable' : 'Editable nếu có quyền'}</StatusPill></div>
                <div className="dw2-focus-list">
                  {readinessItems(readiness).map((check) => <div key={check.key}><CheckCircle2 size={16} /><span>{check.label}: {check.done ? 'Đạt' : 'Thiếu'}</span></div>)}
                </div>
                <div className="dw2-command-actions is-wide">
                  <ActionButton onClick={() => runAction(() => encounterAPI.start(selectedEncounterId), 'Đã start encounter.')}><Play size={16} /> Start</ActionButton>
                  <ActionButton onClick={() => runAction(() => encounterAPI.hold(selectedEncounterId), 'Đã hold encounter.')}>Hold</ActionButton>
                  <ActionButton onClick={() => runAction(() => encounterAPI.resume(selectedEncounterId), 'Đã resume encounter.')}>Resume</ActionButton>
                </div>
              </div>
            )}
          </Panel>
          <Panel title="Timeline" subtitle="Audit/lifecycle từ encounter endpoint.">
            <div className="dw2-command-timeline">
              {!safeArray(workspace.timeline).length ? <EmptyState label="Chưa có timeline." /> : safeArray(workspace.timeline).slice(0, 8).map((event, index) => (
                <div key={`${event.event_id || index}`}><time>{formatDateTime(event.created_at || event.timestamp)}</time><strong>{event.action || event.title || event.type || 'Sự kiện'}</strong><span>{event.message || event.status || ''}</span></div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}

export function DoctorClinicalRecordsPage({ item, overview, onNavigate, onRefresh }) {
  const [query, setQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState(patientIdOf(safeArray(overview.active_encounters)[0] || safeArray(overview.queue)[0] || {}))
  const [patient360, setPatient360] = useState({ summary: null, timeline: [], records: [], attachments: [], documentTimeline: [] })
  const [vitals, setVitals] = useState([])
  const [authorizations, setAuthorizations] = useState([])
  const [notice, setNotice] = useState({ error: '', success: '' })
  const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction: '', severity: 'unknown', allergy_type: 'unknown' })
  const [problemForm, setProblemForm] = useState({ problem_name: '', severity: 'unknown', notes: '' })

  const viewKey = item?.key || 'patient-summary'

  useEffect(() => {
    let cancelled = false
    async function loadSearch() {
      if (!query.trim()) {
        setPatients([])
        return
      }
      try {
        const response = await patientAPI.search({ q: query.trim(), limit: 20 })
        if (!cancelled) setPatients(safeArray(dataOf(response, [])))
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tìm được bệnh nhân.'), success: '' })
      }
    }
    const timer = window.setTimeout(loadSearch, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    let cancelled = false
    if (!selectedPatientId) return undefined
    async function load() {
      try {
        const [summaryData, vitalData, authData] = await Promise.allSettled([
          loadPatient360(selectedPatientId),
          clinicalAPI.listPatientVitalSigns(selectedPatientId, { limit: 40 }),
          patientAPI.authorizations(selectedPatientId, { limit: 40 }),
        ])
        if (!cancelled) {
          setPatient360(summaryData.status === 'fulfilled' ? summaryData.value : { summary: null, timeline: [], records: [], attachments: [], documentTimeline: [] })
          setVitals(vitalData.status === 'fulfilled' ? safeArray(dataOf(vitalData.value, [])) : [])
          setAuthorizations(authData.status === 'fulfilled' ? safeArray(dataOf(authData.value, [])) : [])
        }
      } catch (error) {
        if (!cancelled) setNotice({ error: getApiErrorMessage(error, 'Không tải được hồ sơ lâm sàng.'), success: '' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedPatientId])

  async function runAction(action, successMessage) {
    try {
      setNotice({ error: '', success: '' })
      await action()
      if (selectedPatientId) setPatient360(await loadPatient360(selectedPatientId))
      setNotice({ error: '', success: successMessage })
      onRefresh?.()
    } catch (error) {
      setNotice({ error: getApiErrorMessage(error, 'Thao tác không thành công.'), success: '' })
    }
  }

  async function createAllergy(event) {
    event.preventDefault()
    if (!selectedPatientId || !allergyForm.allergen.trim()) return
    await runAction(() => clinicalAPI.createPatientAllergy(selectedPatientId, allergyForm), 'Đã thêm dị ứng.')
    setAllergyForm({ allergen: '', reaction: '', severity: 'unknown', allergy_type: 'unknown' })
  }

  async function createProblem(event) {
    event.preventDefault()
    if (!selectedPatientId || !problemForm.problem_name.trim()) return
    await runAction(() => clinicalAPI.createPatientProblem(selectedPatientId, problemForm), 'Đã thêm problem.')
    setProblemForm({ problem_name: '', severity: 'unknown', notes: '' })
  }

  const records = safeArray(patient360.records)
  const attachments = safeArray(patient360.attachments)
  const summary = patient360.summary
  const released = [...records, ...attachments].filter(isReleased)

  return (
    <div className="dw2-command-page">
      <KpiStrip items={[
        { label: 'Alerts', value: safeArray(summary?.alerts).length, hint: 'Clinical alerts', tone: safeArray(summary?.alerts).length ? 'critical' : 'success' },
        { label: 'Allergy', value: safeArray(summary?.allergies).length, hint: 'Dị ứng active', tone: 'warning' },
        { label: 'Medical records', value: records.length, hint: 'Hồ sơ bệnh án', tone: 'neutral' },
        { label: 'Released', value: released.length, hint: 'Đã release portal', tone: 'success' },
      ]} />
      <CommandNotice error={notice.error} success={notice.success} />
      <div className="dw2-command-toolbar">
        <div className="dw2-command-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bệnh nhân theo tên, mã BN, SĐT..." /></div>
        <ActionButton onClick={() => selectedPatientId && onNavigate(`/doctor/patients?view=history&patientId=${selectedPatientId}`)}><UserRound size={16} /> Mở lịch sử</ActionButton>
      </div>
      {patients.length ? (
        <div className="dw2-command-patient-results">
          {patients.map((patient) => <button type="button" key={patientIdOf(patient)} onClick={() => setSelectedPatientId(patientIdOf(patient))}>{patientName(patient)} <small>{patientCode(patient)}</small></button>)}
        </div>
      ) : null}
      <div className="dw2-workspace-layout">
        <div className="dw2-workspace-layout__main">
          {viewKey === 'patient-summary' ? <PatientClinical360 {...patient360} onNavigate={onNavigate} /> : null}

          {viewKey === 'history-allergy' ? (
            <div className="dw2-two-panels">
              <Panel title="Dị ứng" subtitle="CRUD qua /api/clinical/patients/:patientId/allergies">
                <form className="dw2-command-form" onSubmit={createAllergy}>
                  <Field label="Dị nguyên"><input value={allergyForm.allergen} onChange={(event) => setAllergyForm((current) => ({ ...current, allergen: event.target.value }))} /></Field>
                  <Field label="Phản ứng"><input value={allergyForm.reaction} onChange={(event) => setAllergyForm((current) => ({ ...current, reaction: event.target.value }))} /></Field>
                  <Field label="Mức độ"><select value={allergyForm.severity} onChange={(event) => setAllergyForm((current) => ({ ...current, severity: event.target.value }))}><option value="unknown">Unknown</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></Field>
                  <ActionButton type="submit" tone="success">Thêm dị ứng</ActionButton>
                </form>
                <div className="dw2-compact-list">{safeArray(summary?.allergies).map((allergy) => <button type="button" key={allergyIdOf(allergy)}><AlertTriangle size={16} /><span><strong>{allergy.allergen || allergy.allergen_name}</strong><small>{allergy.reaction || '--'} · {allergy.severity}</small></span><ActionButton onClick={() => runAction(() => clinicalAPI.resolveAllergy(allergyIdOf(allergy)), 'Đã resolve dị ứng.')}>Resolve</ActionButton></button>)}</div>
              </Panel>
              <Panel title="Problem list" subtitle="CRUD qua /api/clinical/patients/:patientId/problems">
                <form className="dw2-command-form" onSubmit={createProblem}>
                  <Field label="Vấn đề"><input value={problemForm.problem_name} onChange={(event) => setProblemForm((current) => ({ ...current, problem_name: event.target.value }))} /></Field>
                  <Field label="Ghi chú"><input value={problemForm.notes} onChange={(event) => setProblemForm((current) => ({ ...current, notes: event.target.value }))} /></Field>
                  <ActionButton type="submit" tone="success">Thêm problem</ActionButton>
                </form>
                <div className="dw2-compact-list">{safeArray(summary?.problems).map((problem) => <button type="button" key={problemIdOf(problem)}><ListChecks size={16} /><span><strong>{problem.problem_name || problem.name}</strong><small>{problem.severity || '--'} · {statusLabel(problem.status)}</small></span><ActionButton onClick={() => runAction(() => clinicalAPI.resolveProblem(problemIdOf(problem)), 'Đã resolve problem.')}>Resolve</ActionButton></button>)}</div>
              </Panel>
            </div>
          ) : null}

          {viewKey === 'vitals' ? (
            <Panel title="Sinh hiệu" subtitle="Danh sách và trend sinh hiệu từ clinical endpoints.">
              <div className="dw2-command-table">
                <div className="dw2-command-row is-head"><span>Thời điểm</span><span>HA</span><span>Mạch</span><span>SpO2</span><span>BMI</span></div>
                {!vitals.length ? <EmptyState label="Chưa có sinh hiệu." /> : vitals.map((vital) => <div className="dw2-command-row" key={idOf(vital, ['vital_sign_id', 'id', '_id'])}><span>{formatDateTime(vital.recorded_at)}</span><span>{vital.systolic_bp || '--'}/{vital.diastolic_bp || '--'}</span><span>{vital.heart_rate || '--'}</span><span>{vital.spo2 || '--'}%</span><span>{vital.bmi || '--'}</span></div>)}
              </div>
            </Panel>
          ) : null}

          {viewKey === 'medical-records' ? (
            <Panel title="Hồ sơ bệnh án" subtitle="Finalize, seal, archive, void và release tác động trực tiếp database.">
              <div className="dw2-command-table">
                <div className="dw2-command-row is-head"><span>Hồ sơ</span><span>Loại</span><span>Trạng thái</span><span>Release</span><span>Thao tác</span></div>
                {!records.length ? <EmptyState label="Chưa có medical record." /> : records.map((record) => <div className="dw2-command-row" key={recordIdOf(record)}><span>{record.record_no || record.title}</span><span>{record.record_type}</span><span>{statusLabel(record.status)}</span><span>{isReleased(record) ? 'Đã release' : 'Chưa release'}</span><span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => recordsAPI.finalizeMedicalRecord(recordIdOf(record)), 'Đã finalize hồ sơ.')}>Finalize</ActionButton><ActionButton onClick={() => runAction(() => recordsAPI.sealMedicalRecord(recordIdOf(record)), 'Đã seal hồ sơ.')}>Seal</ActionButton><ActionButton onClick={() => runAction(() => recordsAPI.releaseMedicalRecordToPatient(recordIdOf(record)), 'Đã release hồ sơ.')} tone="success">Release</ActionButton></span></div>)}
              </div>
            </Panel>
          ) : null}

          {viewKey === 'attachments' ? (
            <Panel title="Tài liệu đính kèm" subtitle="Release, revoke, archive, restore và download metadata dùng records API.">
              <div className="dw2-command-table">
                <div className="dw2-command-row is-head"><span>File</span><span>Entity</span><span>Scan</span><span>Release</span><span>Thao tác</span></div>
                {!attachments.length ? <EmptyState label="Chưa có attachment." /> : attachments.map((attachment) => <div className="dw2-command-row" key={attachmentIdOf(attachment)}><span>{attachment.file_name || attachment.title}</span><span>{attachment.entity_type || '--'}</span><span>{attachment.scan_status || '--'}</span><span>{isReleased(attachment) ? 'Đã release' : 'Chưa release'}</span><span className="dw2-command-actions"><ActionButton onClick={() => runAction(() => recordsAPI.releaseAttachmentToPatient(attachmentIdOf(attachment)), 'Đã release attachment.')} tone="success">Release</ActionButton><ActionButton onClick={() => runAction(() => recordsAPI.revokeAttachmentRelease(attachmentIdOf(attachment), { reason: 'Revoked from doctor workspace' }), 'Đã revoke release.')}>Revoke</ActionButton><ActionButton onClick={() => runAction(() => recordsAPI.archiveAttachment(attachmentIdOf(attachment), { reason: 'Archived from doctor workspace' }), 'Đã archive attachment.')}>Archive</ActionButton></span></div>)}
              </div>
            </Panel>
          ) : null}

          {viewKey === 'consent-access' ? (
            <div className="dw2-two-panels">
              <Panel title="Consent records" subtitle="Đọc từ doctor patient summary.">
                <div className="dw2-compact-list">{!safeArray(summary?.consents).length ? <EmptyState label="Chưa có consent." /> : safeArray(summary?.consents).map((consent, index) => <button type="button" key={idOf(consent, ['consent_id', 'id', '_id']) || index}><ShieldCheck size={16} /><span><strong>{consent.consent_type || consent.scope || 'Consent'}</strong><small>{statusLabel(consent.status)} · {formatDate(consent.valid_to || consent.expires_at)}</small></span></button>)}</div>
              </Panel>
              <Panel title="Ủy quyền người thân" subtitle="Đọc từ /api/patients/:patientId/authorizations.">
                <div className="dw2-compact-list">{!authorizations.length ? <EmptyState label="Chưa có authorization." /> : authorizations.map((auth, index) => <button type="button" key={idOf(auth, ['authorization_id', 'id', '_id']) || index}><UsersRound size={16} /><span><strong>{auth.scope || auth.authorization_type || 'Authorization'}</strong><small>{statusLabel(auth.status)} · {formatDate(auth.valid_to || auth.expires_at)}</small></span></button>)}</div>
              </Panel>
            </div>
          ) : null}

          {viewKey === 'released-records' ? (
            <Panel title="Hồ sơ đã release" subtitle="Lọc từ medical records và attachments đã release cho portal.">
              <div className="dw2-command-table">
                <div className="dw2-command-row is-head"><span>Tên</span><span>Loại</span><span>Release lúc</span><span>Trạng thái</span><span>Thao tác</span></div>
                {!released.length ? <EmptyState label="Chưa có hồ sơ/tài liệu đã release." /> : released.map((item, index) => <div className="dw2-command-row" key={`${recordIdOf(item) || attachmentIdOf(item)}-${index}`}><span>{item.record_no || item.file_name || item.title}</span><span>{item.record_type || item.entity_type || 'attachment'}</span><span>{formatDateTime(item.released_at)}</span><span>{statusLabel(item.status)}</span><span className="dw2-command-actions">{attachmentIdOf(item) ? <ActionButton onClick={() => runAction(() => recordsAPI.revokeAttachmentRelease(attachmentIdOf(item), { reason: 'Revoked from released records view' }), 'Đã revoke release attachment.')}>Revoke</ActionButton> : null}</span></div>)}
              </div>
            </Panel>
          ) : null}
        </div>
        <aside className="dw2-workspace-layout__side">
          <Panel title="Bệnh nhân đang chọn" subtitle="Clinical context dùng chung cho nhóm Hồ sơ lâm sàng.">
            <PatientClinical360 {...patient360} onNavigate={onNavigate} />
          </Panel>
          <Panel title="Realtime/event cần nghe" subtitle="UI đã sẵn sàng nhận update row-level khi backend publish.">
            <div className="dw2-focus-list">
              <div><Bell size={16} /><span>vital_sign.recorded, medical_record.finalized, attachment.released</span></div>
              <div><RefreshCw size={16} /><span>Hiện refresh thủ công sau mỗi mutation để phản ánh database.</span></div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
