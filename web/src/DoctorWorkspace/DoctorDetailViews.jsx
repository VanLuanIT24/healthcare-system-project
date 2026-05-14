import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowUpDown, CalendarDays, Check, ChevronDown, Filter, MoreHorizontal, Search, Stethoscope, Users } from 'lucide-react'
import { useToast } from './toast/ToastProvider'
import {
  ClinicalNotesPanel,
  ConsultationPanel,
  DiagnosisPanel,
  PrescriptionPanel,
  VitalSignsPanel,
} from './DoctorEncounterPanels'
import { EncounterOrdersPanel } from './DoctorOrderViews'
import {
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PatientSummaryCard,
  SectionCard,
  StatusBadge,
  SurfaceHint,
} from './DoctorShell'
import { encounterTabs, formatDate, formatDateTime, formatTime, getInitials, safeArray } from './doctorData'
import { doctorApi, getDoctorCapabilities, getDoctorId } from './doctorApi'
import { guardDoctorAction, handleDoctorApiError, notifyDoctorSuccess, showDoctorToast } from './doctorFeedback'
import { useAsyncResource, usePatientMap } from './DoctorHooks'

function calculatePatientAge(value) {
  if (!value) {
    return ''
  }

  const dob = new Date(value)
  if (Number.isNaN(dob.getTime())) {
    return ''
  }

  const now = new Date()
  let age = now.getFullYear() - dob.getFullYear()
  const monthDiff = now.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1
  }

  return age >= 0 ? `${age} tuổi` : ''
}

function resolveTimelineDate(item = {}) {
  return item.occurred_at || item.created_at || item.event_time || item.start_time || item.appointment_time || item.prescribed_at || ''
}

function getPatientLastSeen(encounters = [], appointments = [], timeline = []) {
  const values = [
    ...encounters.map((item) => item.start_time),
    ...appointments.map((item) => item.appointment_time),
    ...timeline.map((item) => resolveTimelineDate(item)),
  ].filter(Boolean)

  if (!values.length) {
    return ''
  }

  return values
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0]
    ?.toISOString()
}

function getTimelineTitle(item = {}) {
  if (item.title) {
    return item.title
  }

  const typeMap = {
    appointment: 'Cập nhật lịch hẹn',
    encounter: 'Sự kiện phiên khám',
    prescription: 'Sự kiện đơn thuốc',
  }

  return typeMap[item.type] || item.event_type || 'Sự kiện lâm sàng'
}

function getTimelineDescription(item = {}) {
  if (item.description || item.note) {
    return item.description || item.note
  }

  if (item.type === 'appointment') {
    return item.status ? `Trạng thái lịch hẹn: ${item.status}` : 'Mục lịch sử lịch hẹn'
  }

  if (item.type === 'encounter') {
    return item.status ? `Trạng thái phiên khám: ${item.status}` : 'Mục lịch sử phiên khám'
  }

  if (item.type === 'prescription') {
    return item.status ? `Trạng thái đơn thuốc: ${item.status}` : 'Mục lịch sử đơn thuốc'
  }

  return '--'
}

function getCompletionBlockers(readiness) {
  if (!readiness) {
    return ['Đang kiểm tra điều kiện hoàn tất từ backend.']
  }

  if (readiness.can_complete) {
    return []
  }

  const blockers = []
  if (!readiness.has_signed_consultation) {
    blockers.push('Chưa có consultation đã ký')
  }
  if (!Number(readiness.active_diagnoses_count || 0)) {
    blockers.push('Chưa có chẩn đoán active')
  }
  if (!readiness.has_active_prescription) {
    blockers.push('Chưa có đơn thuốc active')
  }

  return blockers.length ? blockers : ['Backend chưa cho phép hoàn tất phiên khám.']
}

function PatientHistoryList({ items, emptyTitle, emptyDescription, renderMeta }) {
  if (!items.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="doctor-list-stack">
      {items.map((item, index) => {
        const meta = renderMeta(item)

        return (
          <div key={item.encounter_id || item.appointment_id || item.prescription_id || item.id || index} className="doctor-list-row">
            <div>
              <strong>{meta.title}</strong>
              <p>{meta.description}</p>
            </div>
            {meta.status ? <StatusBadge status={meta.status} /> : <span className="doctor-muted-text">--</span>}
          </div>
        )
      })}
    </div>
  )
}

export function DoctorEncounterDetailScreen({ user }) {
  const { encounterId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const requestedTab = useMemo(
    () => location.state?.activeTab || new URLSearchParams(location.search).get('tab') || 'overview',
    [location.search, location.state],
  )
  const [activeTab, setActiveTab] = useState(encounterTabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'overview')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setActiveTab(encounterTabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'overview')
  }, [requestedTab])

  const [encounterState, reloadEncounter] = useAsyncResource(
    async () => doctorApi.encounters.getDetail(encounterId),
    [encounterId],
    null,
    { fallbackMessage: 'Không thể tải chi tiết phiên khám.' },
  )

  const encounter = encounterState.data
  const patientId = encounter?.patient_id

  const [patientState] = useAsyncResource(
    async () => (patientId ? doctorApi.patients.getDetail(patientId) : null),
    [patientId],
    null,
    { fallbackMessage: 'Không thể tải tóm tắt bệnh nhân.' },
  )
  const [timelineState, reloadTimeline] = useAsyncResource(
    async () => doctorApi.encounters.getTimeline(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải dòng thời gian phiên khám.' },
  )
  const [readinessState, reloadReadiness] = useAsyncResource(
    async () => doctorApi.encounters.getReadiness(encounterId),
    [encounterId],
    null,
    { fallbackMessage: 'Không thể tải điều kiện vòng đời phiên khám.' },
  )
  const [clinicalSummaryState, reloadClinicalSummary] = useAsyncResource(
    async () => doctorApi.encounters.getClinicalSummary(encounterId),
    [encounterId],
    null,
    { fallbackMessage: 'Không thể tải tổng quan lâm sàng.' },
  )
  const [consultationState, reloadConsultations] = useAsyncResource(
    async () => doctorApi.consultations.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải phiếu khám.' },
  )
  const [latestVitalsState, reloadLatestVitals] = useAsyncResource(
    async () => doctorApi.vitals.getLatest(encounterId),
    [encounterId],
    null,
    { fallbackMessage: 'Không thể tải sinh hiệu mới nhất.' },
  )
  const [prescriptionsState, reloadPrescriptions] = useAsyncResource(
    async () => doctorApi.prescriptions.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải đơn thuốc.' },
  )
  const [diagnosesState, reloadDiagnoses] = useAsyncResource(
    async () => doctorApi.diagnoses.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải chẩn đoán.' },
  )

  const clinicalSummary = clinicalSummaryState.data || null
  const readiness = readinessState.data || null
  const latestVitals = clinicalSummary?.latest_vital_signs || latestVitalsState.data || null
  const consultations = safeArray(consultationState.data)
  const prescriptions = safeArray(prescriptionsState.data)
  const diagnoses = safeArray(diagnosesState.data)
  const timelineItems = safeArray(timelineState.data)
  const patient = patientState.data
  const encounterStatus = encounter?.raw_status || encounter?.status || ''
  const overviewConsultation = clinicalSummary?.consultation || consultations[0]
  const activePrescription = prescriptions[0]
  const primaryDiagnosis = clinicalSummary?.primary_diagnosis || diagnoses.find((item) => item.is_primary) || diagnoses[0]
  const canStartEncounter = capabilities.canEncounterActions && readiness?.can_start
  const canCompleteEncounter = capabilities.canEncounterActions && readiness?.can_complete
  const encounterEditable = readiness?.editable !== false
  const completionBlockers = getCompletionBlockers(readiness)
  const completionBlockedMessage = completionBlockers.join(' • ')
  const readinessChecklist = [
    {
      label: 'Consultation đã ký',
      ok: Boolean(readiness?.has_signed_consultation),
      hint: 'Điều kiện từ has-signed-consultation',
    },
    {
      label: 'Chẩn đoán active',
      ok: Number(readiness?.active_diagnoses_count || 0) > 0,
      hint: `${Number(readiness?.active_diagnoses_count || 0)} chẩn đoán active`,
    },
    {
      label: 'Đơn thuốc active',
      ok: Boolean(readiness?.has_active_prescription),
      hint: 'Điều kiện từ has-active-prescription',
    },
  ]

  function refreshAll() {
    reloadEncounter()
    reloadTimeline()
    reloadReadiness()
    reloadClinicalSummary()
    reloadConsultations()
    reloadLatestVitals()
    reloadPrescriptions()
    reloadDiagnoses()
  }

  async function runEncounterAction(action) {
    if (
      !guardDoctorAction({
        allowed: capabilities.canEncounterActions,
        toast,
        permission: 'encounters.write',
      })
    ) {
      setConfirmOpen(false)
      return
    }

    if (action === 'complete' && (!canCompleteEncounter || !encounterEditable)) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Chưa thể hoàn tất',
        message: `Chưa thể hoàn tất phiên khám: ${completionBlockedMessage}.`,
      })
      setConfirmOpen(false)
      reloadReadiness()
      return
    }

    setBusy(true)

    try {
      if (action === 'start') {
        await doctorApi.encounters.start(encounterId)
      }
      if (action === 'arrive') {
        await doctorApi.encounters.arrive(encounterId)
      }
      if (action === 'hold') {
        await doctorApi.encounters.hold(encounterId)
      }
      if (action === 'complete') {
        await doctorApi.encounters.complete(encounterId)
      }
      if (action === 'cancel') {
        await doctorApi.encounters.cancel(encounterId)
      }
      if (action === 'reopen') {
        await doctorApi.encounters.reopen(encounterId)
      }

      refreshAll()
      setConfirmOpen(false)
      notifyDoctorSuccess(
        toast,
        action === 'arrive'
          ? 'Đã chuyển phiên khám sang trạng thái đã đến.'
          : action === 'start'
            ? 'Đã bắt đầu phiên khám.'
            : action === 'hold'
              ? 'Đã tạm dừng phiên khám.'
              : action === 'complete'
                ? 'Đã hoàn tất phiên khám.'
                : action === 'cancel'
                  ? 'Đã hủy phiên khám.'
                  : 'Đã mở lại phiên khám.',
        'Phiên khám đã cập nhật',
      )
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể cập nhật vòng đời phiên khám.', {
        permission: 'encounters.write',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="doctor-page-stack doctor-encounter-detail-redesign">
      {encounterState.loading ? <LoadingState label="Đang tải phiên khám..." /> : null}
      {encounterState.error && !encounter ? (
        <ErrorState title="Không tìm thấy phiên khám" message={encounterState.error} onRetry={reloadEncounter} />
      ) : null}
      {encounter ? (
        <>
          <section className="doctor-encounter-hero">
            <div className="doctor-encounter-head">
              <div>
                <button className="doctor-link-button doctor-encounter-back-button" type="button" onClick={() => navigate('/doctor/encounters')}>
                  ← Quay lại danh sách encounter
                </button>
                <span className="doctor-card-eyebrow">Phiên khám đang hoạt động</span>
                <h2>{patient?.full_name || patientId || 'Phiên khám bệnh nhân'}</h2>
                <p>{encounter.encounter_code || encounterId} | {patient?.patient_code || patientId} | {patient?.blood_type || '--'}</p>
              </div>
              <div className="doctor-inline-actions">
                <StatusBadge status={encounter.status || 'waiting'} />
                {!capabilities.canEncounterActions ? <SurfaceHint tone="warning">Chỉ xem</SurfaceHint> : null}
                {!encounterEditable ? <SurfaceHint tone="warning">Encounter đã khóa</SurfaceHint> : null}
                {readinessState.error ? <SurfaceHint tone="warning">{readinessState.error}</SurfaceHint> : null}
                {capabilities.canEncounterActions && encounterStatus === 'planned' ? (
                  <button className="doctor-secondary-button" type="button" onClick={() => runEncounterAction('arrive')} disabled={busy || !encounterEditable}>
                    Đã đến
                  </button>
                ) : null}
                {capabilities.canEncounterActions && encounterStatus !== 'in_progress' && encounterStatus !== 'completed' && encounterStatus !== 'cancelled' ? (
                  <button className="doctor-secondary-button" type="button" onClick={() => runEncounterAction('start')} disabled={busy || !canStartEncounter || !encounterEditable}>
                    Bắt đầu
                  </button>
                ) : null}
                {capabilities.canEncounterActions && encounterStatus === 'in_progress' ? (
                  <button className="doctor-secondary-button" type="button" onClick={() => runEncounterAction('hold')} disabled={busy || !encounterEditable}>
                    Tạm dừng
                  </button>
                ) : null}
                {capabilities.canEncounterActions && encounterStatus === 'completed' ? (
                  <button className="doctor-secondary-button" type="button" onClick={() => runEncounterAction('reopen')} disabled={busy}>
                    Mở lại
                  </button>
                ) : null}
                {capabilities.canEncounterActions && !['completed', 'cancelled'].includes(encounterStatus) ? (
                  <button className="doctor-secondary-button doctor-button-danger-soft" type="button" onClick={() => runEncounterAction('cancel')} disabled={busy || !encounterEditable}>
                    Hủy phiên khám
                  </button>
                ) : null}
                {capabilities.canEncounterActions && !['completed', 'cancelled'].includes(encounterStatus) && canCompleteEncounter && encounterEditable ? (
                  <button className="doctor-primary-button doctor-primary-green" type="button" onClick={() => setConfirmOpen(true)} disabled={busy}>
                    Hoàn tất phiên khám
                  </button>
                ) : null}
                {capabilities.canEncounterActions && !['completed', 'cancelled'].includes(encounterStatus) && (!canCompleteEncounter || !encounterEditable) ? (
                  <button className="doctor-secondary-button" type="button" disabled title={completionBlockedMessage}>
                    Chưa thể hoàn tất
                  </button>
                ) : null}
              </div>
            </div>

            <div className="doctor-tab-strip">
              {encounterTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`doctor-tab-button${activeTab === tab.id ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeTab === 'overview' ? (
            <div className="doctor-dashboard-grid">
              <div className="doctor-panel-stack">
                <SectionCard title="Tổng quan" subtitle="Sinh hiệu hiện tại, tóm tắt phiếu khám, chẩn đoán và trạng thái đơn thuốc.">
                  {clinicalSummaryState.loading ? <LoadingState label="Đang tải clinical summary..." /> : null}
                  {clinicalSummaryState.error ? <SurfaceHint tone="warning">{clinicalSummaryState.error}</SurfaceHint> : null}
                  <div className="doctor-kpi-mini-grid">
                    <div className="doctor-kpi-tile"><strong>{readiness?.can_start ? 'Có' : 'Không'}</strong><span>Sẵn sàng bắt đầu</span></div>
                    <div className="doctor-kpi-tile"><strong>{readiness?.can_complete ? 'Có' : 'Không'}</strong><span>Sẵn sàng hoàn tất</span></div>
                    <div className="doctor-kpi-tile"><strong>{encounterEditable ? 'Có' : 'Không'}</strong><span>Có thể chỉnh sửa</span></div>
                    <div className="doctor-kpi-tile"><strong>{consultations.length}</strong><span>Consultation</span></div>
                    <div className="doctor-kpi-tile"><strong>{diagnoses.length}</strong><span>Chẩn đoán</span></div>
                    <div className="doctor-kpi-tile"><strong>{prescriptions.length}</strong><span>Đơn thuốc</span></div>
                  </div>
                  {readiness ? (
                    <div className={`doctor-readiness-card${canCompleteEncounter ? ' is-ready' : ' is-blocked'}`}>
                      <div className="doctor-readiness-card-head">
                        <div>
                          <span className="doctor-card-eyebrow">Điều kiện hoàn tất</span>
                          <strong>{canCompleteEncounter ? 'Backend đã cho phép hoàn tất' : 'Chưa đủ điều kiện hoàn tất'}</strong>
                        </div>
                        <StatusBadge status={canCompleteEncounter ? 'completed' : 'waiting'} />
                      </div>
                      <div className="doctor-readiness-list">
                        {readinessChecklist.map((item) => (
                          <div key={item.label} className={`doctor-readiness-row${item.ok ? ' is-ok' : ' is-missing'}`}>
                            <span>{item.ok ? 'Đủ' : 'Thiếu'}</span>
                            <div>
                              <strong>{item.label}</strong>
                              <p>{item.hint}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {!canCompleteEncounter ? <p>{completionBlockedMessage}</p> : null}
                    </div>
                  ) : null}
                  <div className="doctor-kpi-mini-grid">
                    <div className="doctor-kpi-tile"><strong>{latestVitals?.systolic_bp || '--'}/{latestVitals?.diastolic_bp || '--'}</strong><span>Huyết áp</span></div>
                    <div className="doctor-kpi-tile"><strong>{latestVitals?.heart_rate || '--'} bpm</strong><span>Nhịp tim</span></div>
                    <div className="doctor-kpi-tile"><strong>{latestVitals?.spo2 || '--'}%</strong><span>SpO2</span></div>
                  </div>

                  {patient?.allergies?.length ? (
                    <div className="doctor-alert-card doctor-alert-danger">
                      <div className="doctor-alert-head">
                        <StatusBadge status="cancelled" />
                        <strong>Cảnh báo dị ứng đang hoạt động</strong>
                      </div>
                      <p>Bệnh nhân được ghi nhận dị ứng với {patient.allergies.join(', ')}.</p>
                    </div>
                  ) : null}

                  <div className="doctor-overview-panel">
                    <div>
                      <h4>Tóm tắt phiếu khám</h4>
                      <p>{overviewConsultation?.chief_complaint || 'Chưa có tóm tắt phiếu khám.'}</p>
                      <p>{overviewConsultation?.assessment || overviewConsultation?.plan || '--'}</p>
                    </div>
                    <div>
                      <h4>Đơn thuốc hiện tại</h4>
                      <p>{activePrescription?.prescription_no || activePrescription?.prescription_id || 'Chưa có đơn thuốc.'}</p>
                      {activePrescription?.status ? <StatusBadge status={activePrescription.status} /> : null}
                    </div>
                  </div>

                  <div className="doctor-overview-panel">
                    <div>
                      <h4>Chẩn đoán chính</h4>
                      <p>{primaryDiagnosis?.diagnosis_name || 'Chưa có chẩn đoán.'}</p>
                      <p>{primaryDiagnosis?.icd10_code || '--'}</p>
                    </div>
                    <div>
                      <h4>Sự kiện gần nhất</h4>
                      <p>{timelineItems[0]?.title || 'Chưa có sự kiện nào.'}</p>
                      <p>{timelineItems[0]?.description || '--'}</p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Dòng thời gian gần đây" subtitle="Các sự kiện mới nhất của phiên khám và mốc lâm sàng.">
                  {timelineState.error ? <SurfaceHint tone="warning">{timelineState.error}</SurfaceHint> : null}
                  {timelineItems.length === 0 ? (
                    <EmptyState title="Chưa có sự kiện dòng thời gian" description="Các mục dòng thời gian sẽ xuất hiện khi các thao tác lâm sàng được hoàn tất." />
                  ) : (
                    <div className="doctor-list-stack">
                      {timelineItems.slice(0, 6).map((item, index) => (
                        <div key={item.event_id || item.id || index} className="doctor-list-row">
                          <div>
                            <strong>{item.title || item.event_type || 'Sự kiện lâm sàng'}</strong>
                            <p>{item.description || item.note || '--'}</p>
                          </div>
                          <span className="doctor-muted-text">{formatDateTime(item.created_at || item.event_time)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>

              <PatientSummaryCard patient={patient} />
            </div>
          ) : null}

          {activeTab === 'timeline' ? (
            <SectionCard title="Dòng thời gian phiên khám" subtitle="Bản ghi theo trình tự thời gian của các thao tác và cập nhật lâm sàng.">
              {timelineState.loading ? <LoadingState label="Đang tải dòng thời gian..." /> : null}
              {timelineState.error ? <SurfaceHint tone="warning">{timelineState.error}</SurfaceHint> : null}
              {timelineItems.length === 0 && !timelineState.loading ? (
                <EmptyState title="Chưa có sự kiện dòng thời gian" description="Các mục dòng thời gian sẽ xuất hiện sau khi các thao tác lâm sàng được ghi nhận." />
              ) : (
                <div className="doctor-list-stack">
                  {timelineItems.map((item, index) => (
                    <div key={item.event_id || item.id || index} className="doctor-list-row">
                      <div>
                        <strong>{item.title || item.event_type || 'Sự kiện lâm sàng'}</strong>
                        <p>{item.description || item.note || '--'}</p>
                      </div>
                      <span className="doctor-muted-text">{formatDateTime(item.created_at || item.event_time)}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          {activeTab === 'consultation' ? <ConsultationPanel encounterId={encounterId} doctorId={doctorId} readOnly={!encounterEditable} onChanged={refreshAll} /> : null}
          {activeTab === 'diagnosis' ? <DiagnosisPanel encounterId={encounterId} readOnly={!encounterEditable} onChanged={refreshAll} /> : null}
          {activeTab === 'vitals' ? <VitalSignsPanel encounterId={encounterId} readOnly={!encounterEditable} onChanged={refreshAll} /> : null}
          {activeTab === 'orders' ? <EncounterOrdersPanel encounterId={encounterId} readOnly={!encounterEditable} onChanged={refreshAll} /> : null}
          {activeTab === 'prescription' ? <PrescriptionPanel encounterId={encounterId} patientId={patientId} doctorId={doctorId} readOnly={!encounterEditable} onChanged={refreshAll} /> : null}
          {activeTab === 'notes' ? <ClinicalNotesPanel encounterId={encounterId} doctorId={doctorId} readOnly={!encounterEditable} onChanged={refreshAll} /> : null}
        </>
      ) : null}

      <ConfirmActionDialog
        open={confirmOpen}
        title="Hoàn tất phiên khám?"
        description={
          canCompleteEncounter
            ? 'Backend đã xác nhận phiên khám đủ điều kiện hoàn tất.'
            : `Chưa thể hoàn tất: ${completionBlockedMessage}.`
        }
        confirmLabel="Hoàn tất phiên khám"
        busy={busy}
        confirmDisabled={!canCompleteEncounter || !encounterEditable}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => runEncounterAction('complete')}
      />
    </div>
  )
}

export function DoctorPatientsScreen({ user }) {
  const navigate = useNavigate()
  const doctorId = getDoctorId(user)
  const canCreatePatients = Array.isArray(user?.permissions) && user.permissions.includes('patients.write')
  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [pageSize, setPageSize] = useState(5)
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [status, setStatus] = useState('all')
  const [sortMode, setSortMode] = useState('newest')
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setPage(1)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const [patientState, reloadPatients] = useAsyncResource(
    async () =>
      doctorApi.patients.searchPage({
        page,
        limit: pageSize,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(status !== 'all' ? { status } : {}),
      }),
    [page, pageSize, searchTerm, status],
    { items: [], pagination: null },
    { fallbackMessage: 'Không thể tìm kiếm bệnh nhân.' },
  )
  const [patientSummaryState] = useAsyncResource(
    async () => {
      const [total, active, archived, inactive] = await Promise.all([
        doctorApi.patients.searchPage({ limit: 1 }),
        doctorApi.patients.searchPage({ status: 'active', limit: 1 }),
        doctorApi.patients.searchPage({ status: 'archived', limit: 1 }),
        doctorApi.patients.searchPage({ status: 'inactive', limit: 1 }),
      ])

      return {
        total: Number(total?.pagination?.total || 0),
        active: Number(active?.pagination?.total || 0),
        archived: Number(archived?.pagination?.total || 0),
        inactive: Number(inactive?.pagination?.total || 0),
      }
    },
    [],
    { total: 0, active: 0, archived: 0, inactive: 0 },
    { fallbackMessage: 'Không thể tải tổng quan bệnh nhân.' },
  )
  const [todayAppointmentsState] = useAsyncResource(
    async () => doctorApi.dashboard.getAppointmentsToday(doctorId, { date: todayDate, limit: 50 }),
    [doctorId, todayDate],
    [],
    { fallbackMessage: 'Không thể tải lịch hẹn hôm nay.' },
  )
  const [todayEncountersState] = useAsyncResource(
    async () => doctorApi.dashboard.getEncountersToday(doctorId, { date_from: todayDate, date_to: todayDate, limit: 50 }),
    [doctorId, todayDate],
    [],
    { fallbackMessage: 'Không thể tải phiên khám hôm nay.' },
  )

  const patientPagination = patientState.data?.pagination || null
  const currentPage = Number(patientPagination?.page || page)
  const totalPages = Math.max(Number(patientPagination?.total_pages || 1), 1)
  const totalPatients = Number(patientPagination?.total || 0)
  const patientSummary = patientSummaryState.data || { total: 0, active: 0, archived: 0, inactive: 0 }
  const patientItems = safeArray(patientState.data?.items)
  const todayAppointments = safeArray(todayAppointmentsState.data)
  const todayEncounters = safeArray(todayEncountersState.data)
  const contextPatientMap = usePatientMap(
    [...todayAppointments, ...todayEncounters]
      .map((item) => item.patient_id || item.patient?.patient_id || item.patient?.id)
      .filter(Boolean),
  )
  const patients = useMemo(() => {
    const sorted = patientItems.slice()
    if (sortMode === 'name') {
      return sorted.sort((left, right) =>
        (left.full_name || '').localeCompare(right.full_name || '', 'vi', { numeric: true, sensitivity: 'base' }),
      )
    }
    if (sortMode === 'code') {
      return sorted.sort((left, right) =>
        (left.patient_code || left.patient_id || '').localeCompare(right.patient_code || right.patient_id || '', 'vi', {
          numeric: true,
          sensitivity: 'base',
        }),
      )
    }
    return sorted
  }, [patientItems, sortMode])
  const patientSummaryKey = useMemo(() => patients.map((patient) => patient.patient_id || patient.id).filter(Boolean).join('|'), [patients])
  const [visiblePatientSummariesState] = useAsyncResource(
    async () => {
      if (!patientSummaryKey) {
        return {}
      }

      const entries = await Promise.all(
        patients.map(async (patient) => {
          const patientId = patient.patient_id || patient.id
          if (!patientId) {
            return null
          }

          try {
            const summary = await doctorApi.patients.getSummary(patientId)
            return [patientId, summary]
          } catch {
            return [patientId, null]
          }
        }),
      )

      return Object.fromEntries(entries.filter(Boolean))
    },
    [patientSummaryKey],
    {},
    { fallbackMessage: 'Không thể tải lần khám gần nhất của bệnh nhân.' },
  )

  useEffect(() => {
    if (patientPagination && patientPagination.total_pages > 0 && page > patientPagination.total_pages) {
      setPage(patientPagination.total_pages)
    }
  }, [page, patientPagination])

  const statusFilters = [
    { value: 'all', label: 'Tất cả' },
    { value: 'active', label: 'Đang hoạt động' },
    { value: 'archived', label: 'Ngừng theo dõi' },
    { value: 'inactive', label: 'Không hoạt động' },
  ]
  const sortOptions = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'name', label: 'Theo tên' },
    { value: 'code', label: 'Theo mã hồ sơ' },
  ]
  const selectedSortLabel = sortOptions.find((item) => item.value === sortMode)?.label || 'Mới nhất'
  const paginationItems = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
    const items = [1]
    const middleStart = Math.max(2, currentPage - 1)
    const middleEnd = Math.min(totalPages - 1, currentPage + 1)
    if (middleStart > 2) items.push('start-ellipsis')
    for (let item = middleStart; item <= middleEnd; item += 1) items.push(item)
    if (middleEnd < totalPages - 1) items.push('end-ellipsis')
    items.push(totalPages)
    return items
  }, [currentPage, totalPages])
  const pageStart = totalPatients === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = totalPatients === 0 ? 0 : Math.min(pageStart + patients.length - 1, totalPatients)

  function getPatientNameFromRecord(record) {
    const patientId = record?.patient_id || record?.patient?.patient_id || record?.patient?.id
    const patient = patientId ? contextPatientMap[patientId] : null
    return (
      record?.patient_name ||
      record?.patient_full_name ||
      record?.patient?.full_name ||
      record?.patient?.name ||
      patient?.full_name ||
      patient?.patient_code ||
      patientId ||
      'Bệnh nhân'
    )
  }

  const recentActivities = useMemo(() => {
    const appointmentActivities = todayAppointments.slice(0, 3).map((item, index) => ({
      id: item.appointment_id || `appointment-${index}`,
      title: item.status === 'completed' ? 'Hoàn tất lịch hẹn' : 'Lịch hẹn hôm nay',
      subject: getPatientNameFromRecord(item),
      time: item.appointment_time,
      tone: 'blue',
    }))
    const encounterActivities = todayEncounters.slice(0, 3).map((item, index) => ({
      id: item.encounter_id || `encounter-${index}`,
      title: item.status === 'completed' ? 'Hoàn tất phiên khám' : 'Cập nhật phiên khám',
      subject: getPatientNameFromRecord(item) || item.encounter_code || 'Phiên khám',
      time: item.updated_at || item.start_time,
      tone: 'teal',
    }))

    return [...appointmentActivities, ...encounterActivities]
      .filter((item) => item.time)
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .slice(0, 4)
  }, [contextPatientMap, todayAppointments, todayEncounters])

  const statCards = [
    { label: 'Tổng bệnh nhân', value: patientSummaryState.loading ? '...' : patientSummary.total, hint: 'Tất cả hồ sơ', tone: 'blue', icon: <Users size={20} /> },
    { label: 'Đang hoạt động', value: patientSummaryState.loading ? '...' : patientSummary.active, hint: patientSummary.total ? `${Math.round((patientSummary.active / patientSummary.total) * 100)}% tổng số` : '--', tone: 'teal', icon: <Activity size={20} /> },
    { label: 'Lịch hẹn hôm nay', value: todayAppointmentsState.loading ? '...' : todayAppointments.length, hint: todayAppointmentsState.error ? 'Không tải được' : 'Theo lịch bác sĩ', tone: 'purple', icon: <CalendarDays size={20} /> },
    { label: 'Phiên khám hôm nay', value: todayEncountersState.loading ? '...' : todayEncounters.length, hint: 'Đang diễn ra', tone: 'orange', icon: <Stethoscope size={20} /> },
  ]

  function formatGender(value) {
    const normalized = String(value || '').toLowerCase()
    if (normalized === 'male') return 'Nam'
    if (normalized === 'female') return 'Nữ'
    return value || '--'
  }

  return (
    <div className="doctor-page-stack doctor-patients-page doctor-patients-final-layout">
      <section className="doctor-patient-kpi-row">
        {statCards.map((item) => (
          <article key={item.label} className={`doctor-patient-kpi-card is-${item.tone}`}>
            <span className="doctor-patient-kpi-icon">{item.icon}</span>
            <span className="doctor-patient-kpi-copy">
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <em>{item.hint}</em>
            </span>
          </article>
        ))}
      </section>

      <section className="doctor-patient-dashboard-grid">
        <SectionCard
          title="Danh sách bệnh nhân"
          className="doctor-patient-table-panel"
          actions={
            <div className="doctor-patient-table-actions">
              <div
                className="doctor-patient-sort-menu"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setSortMenuOpen(false)
                  }
                }}
              >
                <button
                  className={`doctor-patient-sort-trigger${sortMenuOpen ? ' is-open' : ''}`}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={sortMenuOpen}
                  onClick={() => setSortMenuOpen((current) => !current)}
                >
                  <ArrowUpDown size={15} />
                  <span>{selectedSortLabel}</span>
                  <ChevronDown size={15} />
                </button>
                {sortMenuOpen ? (
                  <div className="doctor-patient-sort-dropdown" role="menu" aria-label="Sắp xếp danh sách bệnh nhân">
                    {sortOptions.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={sortMode === item.value}
                        className={sortMode === item.value ? 'is-active' : ''}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSortMode(item.value)
                          setSortMenuOpen(false)
                        }}
                      >
                        <span>{item.label}</span>
                        {sortMode === item.value ? <Check size={14} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {canCreatePatients ? (
                <button className="doctor-primary-button doctor-patient-add-button" type="button">
                  + Thêm bệnh nhân
                </button>
              ) : null}
            </div>
          }
        >
          <div className="doctor-patient-table-controls">
            <label className="doctor-patient-table-search">
              <Search size={18} />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setSearchTerm(searchInput.trim())
                    setPage(1)
                  }
                }}
                placeholder="Tìm theo tên, mã hồ sơ, SĐT..."
              />
            </label>
            <button className="doctor-patient-filter-control" type="button" onClick={() => { setSearchInput(''); setSearchTerm(''); setStatus('all'); setPage(1) }}>
              <Filter size={16} />
              Bộ lọc
            </button>
          </div>

          <div className="doctor-patient-table-tabs" role="tablist" aria-label="Lọc trạng thái bệnh nhân">
            {statusFilters.map((item) => (
              <button key={item.value} type="button" className={status === item.value ? 'is-active' : ''} onClick={() => { setStatus(item.value); setPage(1) }}>
                {item.label}
              </button>
            ))}
          </div>

          {patientState.loading ? <LoadingState label="Đang tìm bệnh nhân..." /> : null}
          {patientState.error && !patients.length ? <ErrorState title="Không thể tìm bệnh nhân" message={patientState.error} onRetry={reloadPatients} /> : null}
          {!patientState.loading && patients.length === 0 ? <EmptyState title="Không có bệnh nhân phù hợp" description="Hãy thử tìm theo tên bệnh nhân, mã hồ sơ hoặc số điện thoại." /> : null}
          {!patientState.loading && patients.length > 0 ? (
            <div className="doctor-patient-table-wrap">
              <table className="doctor-patient-table">
                <colgroup>
                  <col className="doctor-patient-col-person" />
                  <col className="doctor-patient-col-code" />
                  <col className="doctor-patient-col-age" />
                  <col className="doctor-patient-col-gender" />
                  <col className="doctor-patient-col-phone" />
                  <col className="doctor-patient-col-last" />
                  <col className="doctor-patient-col-status" />
                  <col className="doctor-patient-col-actions" />
                </colgroup>
                <thead>
                  <tr><th>Bệnh nhân</th><th>Mã hồ sơ</th><th>Tuổi</th><th>Giới tính</th><th>Số điện thoại</th><th>Lần khám gần nhất</th><th>Trạng thái</th><th>Thao tác</th></tr>
                </thead>
                <tbody>
                  {patients.map((patient) => {
                    const patientId = patient.patient_id || patient.id
                    const age = calculatePatientAge(patient.date_of_birth)
                    const patientSummary = visiblePatientSummariesState.data?.[patientId] || null
                    const lastSeen =
                      patientSummary?.last_encounter?.start_time ||
                      patientSummary?.last_encounter?.started_at ||
                      patient.last_visit ||
                      patient.last_seen ||
                      patient.updated_at
                    const phone = patient.phone || patient.phone_number || patient.mobile || '--'
                    return (
                      <tr key={patientId}>
                        <td><button className="doctor-patient-table-person" type="button" onClick={() => navigate(`/doctor/patients/${patientId}`)}><span className="doctor-patient-chip">{getInitials(patient.full_name || 'PT') || 'PT'}</span><span><strong>{patient.full_name || 'Chưa rõ bệnh nhân'}</strong><small>{patient.patient_code || patientId}</small></span></button></td>
                        <td>{patient.patient_code || patientId}</td><td>{age || '--'}</td><td>{formatGender(patient.gender)}</td><td>{phone}</td><td><span className="doctor-patient-last-visit">{lastSeen ? <><strong>{formatDate(lastSeen)}</strong><small>{formatTime(lastSeen)}</small></> : '--'}</span></td><td><StatusBadge status={patient.status || ''} /></td>
                        <td><button className="doctor-patient-table-menu" type="button" aria-label={`Mở hồ sơ ${patient.full_name || patientId}`} onClick={() => navigate(`/doctor/patients/${patientId}`)}><MoreHorizontal size={18} /></button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {patientPagination ? (
            <div className="doctor-patient-table-footer">
              <span>Hiển thị {pageStart} - {pageEnd} trong tổng số {totalPatients} bệnh nhân</span>
              <div className="doctor-patient-table-pagination">
                <label><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value={5}>5 / trang</option><option value={10}>10 / trang</option><option value={20}>20 / trang</option></select></label>
                <button type="button" onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={patientState.loading || currentPage <= 1}>‹</button>
                {paginationItems.map((item) => typeof item === 'number' ? <button key={item} type="button" className={item === currentPage ? 'is-active' : ''} onClick={() => setPage(item)} disabled={patientState.loading}>{item}</button> : <span key={item}>...</span>)}
                <button type="button" onClick={() => setPage((current) => Math.min(current + 1, totalPages))} disabled={patientState.loading || currentPage >= totalPages}>›</button>
              </div>
            </div>
          ) : null}
        </SectionCard>

        <aside className="doctor-patient-side-panels">
          <SectionCard title={<span className="doctor-panel-title-with-icon"><CalendarDays size={16} /> Lịch hẹn hôm nay</span>} className="doctor-patient-side-panel doctor-patient-appointments-panel" actions={<button className="doctor-link-button" type="button" onClick={() => navigate('/doctor/appointments')}>Xem tất cả</button>}>
            {todayAppointmentsState.loading ? <LoadingState label="Đang tải lịch hẹn..." /> : null}
            {todayAppointmentsState.error && !todayAppointments.length ? <ErrorState title="Không thể tải lịch hẹn" message={todayAppointmentsState.error} /> : null}
            {!todayAppointmentsState.loading && todayAppointments.length === 0 ? <EmptyState title="Không có lịch hẹn" description="Không có lịch hẹn nào của bác sĩ trong hôm nay." /> : null}
            {!todayAppointmentsState.loading && todayAppointments.length > 0 ? <div className="doctor-patient-today-list">{todayAppointments.slice(0, 5).map((item, index) => <article key={item.appointment_id || index}><time>{formatTime(item.appointment_time)}</time><span><strong>{getPatientNameFromRecord(item)}</strong><small>{item.appointment_type || item.reason || item.note || 'Lịch hẹn'}</small></span><StatusBadge status={item.status || ''} /></article>)}</div> : null}
          </SectionCard>

          <SectionCard title={<span className="doctor-panel-title-with-icon"><Activity size={16} /> Hoạt động gần đây</span>} className="doctor-patient-side-panel doctor-patient-activity-panel" actions={<button className="doctor-link-button" type="button" onClick={() => navigate('/doctor/encounters')}>Xem tất cả</button>}>
            {(todayAppointmentsState.loading || todayEncountersState.loading) ? <LoadingState label="Đang tải hoạt động..." /> : null}
            {!(todayAppointmentsState.loading || todayEncountersState.loading) && recentActivities.length === 0 ? <EmptyState title="Chưa có hoạt động" description="Chưa phát sinh lịch hẹn hoặc phiên khám nào của bác sĩ trong hôm nay." /> : null}
            {!(todayAppointmentsState.loading || todayEncountersState.loading) && recentActivities.length > 0 ? <div className="doctor-patient-activity-feed">{recentActivities.map((item) => <article key={item.id} className={`is-${item.tone}`}><span className="doctor-patient-activity-feed-icon" /><span><strong>{item.title}</strong><small>{item.subject}</small></span><time>{formatTime(item.time)}</time></article>)}</div> : null}
          </SectionCard>
        </aside>
      </section>
    </div>
  )
}
export function DoctorPatientDetailScreen() {
  const navigate = useNavigate()
  const { patientId } = useParams()
  const [activeTab, setActiveTab] = useState('encounters')
  const [patientState, reloadPatient] = useAsyncResource(
    async () => doctorApi.patients.getDetail(patientId),
    [patientId],
    null,
    { fallbackMessage: 'Không thể tải hồ sơ bệnh nhân.' },
  )
  const [summaryState] = useAsyncResource(
    async () => doctorApi.patients.getSummary(patientId),
    [patientId],
    null,
    { fallbackMessage: 'Không thể tải tóm tắt bệnh nhân.' },
  )
  const [encountersState] = useAsyncResource(
    async () => doctorApi.patients.getEncounters(patientId),
    [patientId],
    [],
    { fallbackMessage: 'Không thể tải lịch sử phiên khám.' },
  )
  const [appointmentsState] = useAsyncResource(
    async () => doctorApi.patients.getAppointments(patientId),
    [patientId],
    [],
    { fallbackMessage: 'Không thể tải lịch sử lịch hẹn.' },
  )
  const [prescriptionsState] = useAsyncResource(
    async () => doctorApi.patients.getPrescriptions(patientId),
    [patientId],
    [],
    { fallbackMessage: 'Không thể tải lịch sử đơn thuốc.' },
  )
  const [timelineState] = useAsyncResource(
    async () => doctorApi.patients.getTimeline(patientId),
    [patientId],
    [],
    { fallbackMessage: 'Không thể tải dòng thời gian bệnh nhân.' },
  )

  const patient = patientState.data
  const summary = summaryState.data || {}
  const encounters = safeArray(encountersState.data)
  const appointments = safeArray(appointmentsState.data)
  const prescriptions = safeArray(prescriptionsState.data)
  const timeline = safeArray(timelineState.data)
  const allergies = safeArray(patient?.allergies)
  const activePrescriptions = prescriptions.filter((item) =>
    ['active', 'verified', 'partially_dispensed', 'fully_dispensed'].includes(String(item.status || '').toLowerCase()),
  )
  const activeMedicationItems = activePrescriptions.flatMap((prescription) =>
    safeArray(prescription.items).map((item) => ({
      ...item,
      prescription_no: prescription.prescription_no || prescription.prescription_id,
    })),
  )
  const primaryMedications = activeMedicationItems.length ? activeMedicationItems : activePrescriptions
  const latestEncounter = encounters
    .slice()
    .sort((left, right) => new Date(right.start_time || 0).getTime() - new Date(left.start_time || 0).getTime())[0] || null
  const latestAppointment = appointments
    .slice()
    .sort((left, right) => new Date(right.appointment_time || 0).getTime() - new Date(left.appointment_time || 0).getTime())[0] || null
  const latestPrescription = prescriptions
    .slice()
    .sort((left, right) => new Date(right.prescribed_at || right.created_at || 0).getTime() - new Date(left.prescribed_at || left.created_at || 0).getTime())[0] || null
  const patientName = patient?.full_name || 'Chưa rõ bệnh nhân'
  const patientMeta = [
    patient?.patient_code || patient?.patient_id,
    calculatePatientAge(patient?.date_of_birth),
    patient?.gender || '--',
    patient?.blood_type ? `Nhóm máu ${patient.blood_type}` : '',
  ].filter(Boolean)
  const recordStats = [
    { label: 'Phiên khám', value: summary.encounter_count ?? summary.encounters_count ?? encounters.length },
    { label: 'Lịch hẹn', value: summary.appointment_count ?? summary.appointments_count ?? appointments.length },
    { label: 'Đơn thuốc', value: summary.prescription_count ?? summary.prescriptions_count ?? prescriptions.length },
    { label: 'Dị ứng', value: allergies.length },
  ]

  const historyTabs = useMemo(
    () => [
      { id: 'encounters', label: 'Lịch sử khám' },
      { id: 'prescriptions', label: 'Đơn thuốc' },
      { id: 'appointments', label: 'Lịch hẹn' },
      { id: 'timeline', label: 'Dòng thời gian' },
      { id: 'labs', label: 'Xét nghiệm' },
      { id: 'documents', label: 'Tài liệu' },
    ],
    [],
  )

  return (
    <div className="doctor-page-stack doctor-patient-record-page">
      {patientState.loading ? <LoadingState label="Đang tải hồ sơ bệnh nhân..." /> : null}
      {patientState.error && !patient ? (
        <ErrorState title="Không tìm thấy bệnh nhân" message={patientState.error} onRetry={reloadPatient} />
      ) : null}
      {patient ? (
        <>
          <section className="doctor-patient-record-header">
            <div>
              <span className="doctor-card-eyebrow">Bệnh nhân / Hồ sơ #{patient.patient_code || patient.patient_id || patientId}</span>
              <h2>{patientName}</h2>
              <p>{patientMeta.join(' | ')}</p>
            </div>
            <div className="doctor-patient-record-actions">
              <span className="doctor-patient-chip-soft">DOB: {formatDate(patient.date_of_birth)}</span>
              {patient.gender ? <span className="doctor-patient-chip-soft is-purple">{patient.gender}</span> : null}
              <StatusBadge status={patient.status || 'active'} />
            </div>
          </section>

          <section className="doctor-patient-record-layout">
            <aside className="doctor-patient-profile-card">
              <div className="doctor-patient-profile-hero">
                <div className="doctor-patient-profile-avatar">{getInitials(patientName) || 'BN'}</div>
                <h3>{patientName}</h3>
                <p>{patient.blood_type ? `Nhóm máu: ${patient.blood_type}` : 'Nhóm máu: --'}</p>
              </div>

              <div className="doctor-patient-stat-strip">
                {recordStats.map((item) => (
                  <div key={item.label}>
                    <strong>{item.value ?? 0}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="doctor-patient-record-section">
                <h4>Thông tin liên hệ</h4>
                <dl className="doctor-patient-contact-list">
                  <div>
                    <dt>Điện thoại</dt>
                    <dd>{patient.phone || '--'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{patient.email || '--'}</dd>
                  </div>
                  <div>
                    <dt>Địa chỉ</dt>
                    <dd>{patient.address || '--'}</dd>
                  </div>
                  <div>
                    <dt>Bảo hiểm</dt>
                    <dd>{patient.insurance_number || '--'}</dd>
                  </div>
                </dl>
              </div>

              <div className="doctor-patient-record-section">
                <h4>Dị ứng</h4>
                {allergies.length ? (
                  <div className="doctor-patient-allergy-list">
                    {allergies.map((item, index) => {
                      const allergyName =
                        typeof item === 'string'
                          ? item
                          : item?.name || item?.allergen || item?.allergy || item?.substance || 'Dị ứng'
                      const severity = typeof item === 'string' ? '' : String(item?.severity || item?.reaction || '').toLowerCase()
                      const isSevere = index === 0 || severity.includes('severe') || severity.includes('nặng')

                      return (
                        <span key={`${allergyName}-${index}`} className={isSevere ? 'is-severe' : ''}>
                          {allergyName}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <p className="doctor-muted-text">Không ghi nhận dị ứng.</p>
                )}
              </div>

              <div className="doctor-patient-record-section">
                <h4>Thuốc đang dùng</h4>
                {primaryMedications.length ? (
                  <div className="doctor-patient-med-list">
                    {primaryMedications.slice(0, 5).map((item, index) => (
                      <article key={item.medication_id || item.prescription_id || item.prescription_no || index}>
                        <strong>{item.medication_name || item.drug_name || item.prescription_no || 'Đơn thuốc'}</strong>
                        <span>
                          {[
                            item.dose,
                            item.frequency,
                            item.duration_days ? `${item.duration_days} ngày` : '',
                            item.note,
                            item.status,
                          ].filter(Boolean).join(' | ') || '--'}
                        </span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="doctor-muted-text">Chưa có thuốc đang dùng.</p>
                )}
              </div>

              <SurfaceHint tone="neutral">Chỉ xem</SurfaceHint>
            </aside>

            <main className="doctor-patient-record-main">
              {summaryState.error ? <SurfaceHint tone="warning">{summaryState.error}</SurfaceHint> : null}
              <div className="doctor-overview-panel">
                <div>
                  <h4>Lần khám gần nhất</h4>
                  <p>{latestEncounter ? formatDateTime(latestEncounter.start_time) : 'Chưa có dữ liệu'}</p>
                  <div className="doctor-inline-actions doctor-inline-actions-wrap">
                    {latestEncounter ? (
                      <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${latestEncounter.encounter_id || latestEncounter.id}`)}>
                        Mở phiên khám gần nhất
                      </button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <h4>Lịch hẹn gần nhất</h4>
                  <p>{latestAppointment ? formatDateTime(latestAppointment.appointment_time) : 'Chưa có dữ liệu'}</p>
                  <div className="doctor-inline-actions doctor-inline-actions-wrap">
                    {latestAppointment ? (
                      <button
                        className="doctor-secondary-button"
                        type="button"
                        onClick={() =>
                          navigate('/doctor/appointments', {
                            state: {
                              selectedAppointmentId: latestAppointment.appointment_id || latestAppointment.id,
                              focusDate: latestAppointment.appointment_time,
                            },
                          })
                        }
                      >
                        Mở lịch hẹn gần nhất
                      </button>
                    ) : null}
                  </div>
                </div>
                <div>
                  <h4>Đơn thuốc gần nhất</h4>
                  <p>{latestPrescription ? formatDate(latestPrescription.prescribed_at || latestPrescription.created_at) : 'Chưa có dữ liệu'}</p>
                  <div className="doctor-inline-actions doctor-inline-actions-wrap">
                    {latestPrescription ? (
                      <button
                        className="doctor-secondary-button"
                        type="button"
                        onClick={() =>
                          navigate('/doctor/prescriptions', {
                            state: {
                              selectedPrescriptionId: latestPrescription.prescription_id || latestPrescription.id,
                            },
                          })
                        }
                      >
                        Mở đơn thuốc gần nhất
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="doctor-record-tab-strip">
                {historyTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`doctor-record-tab${activeTab === tab.id ? ' is-active' : ''}`}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'encounters' ? (
                <section className="doctor-record-timeline">
                  {encountersState.loading ? <LoadingState label="Đang tải lịch sử phiên khám..." /> : null}
                  {encountersState.error && !encounters.length ? <ErrorState title="Không thể tải lịch sử phiên khám" message={encountersState.error} /> : null}
                  {!encountersState.error && encounters.length === 0 ? (
                    <EmptyState title="Không có phiên khám" description="Lịch sử phiên khám của bệnh nhân này đang trống." />
                  ) : (
                    encounters.map((item, index) => (
                      <article key={item.encounter_id || item.id || index} className="doctor-record-event-card">
                        <div className="doctor-record-event-marker" />
                        <div className="doctor-record-event-card-inner">
                          <div className="doctor-record-event-head">
                            <div>
                              <span>{formatDateTime(item.start_time)}</span>
                              <h3>{item.encounter_type || item.encounter_code || 'Phiên khám'}</h3>
                            </div>
                            <StatusBadge status={item.status || ''} />
                          </div>
                          <div className="doctor-record-event-grid">
                            <div>
                              <strong>Lý do khám</strong>
                              <p>{item.reason || item.note || item.encounter_code || 'Thông tin lý do khám chưa được ghi nhận.'}</p>
                            </div>
                            <div>
                              <strong>Kết quả / kế hoạch</strong>
                              <p>{item.outcome || item.plan || item.diagnosis || item.status || 'Chưa có kế hoạch kết thúc trong dữ liệu hiện tại.'}</p>
                            </div>
                          </div>
                          <div className="doctor-inline-actions doctor-inline-actions-wrap">
                            <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${item.encounter_id || item.id}`)}>
                              Mở phiên khám
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              ) : null}

              {activeTab === 'prescriptions' ? (
                <section className="doctor-record-timeline">
                  {prescriptionsState.loading ? <LoadingState label="Đang tải lịch sử đơn thuốc..." /> : null}
                  {prescriptionsState.error && !prescriptions.length ? <ErrorState title="Không thể tải lịch sử đơn thuốc" message={prescriptionsState.error} /> : null}
                  {!prescriptionsState.error && prescriptions.length === 0 ? (
                    <EmptyState title="Không có đơn thuốc" description="Lịch sử đơn thuốc của bệnh nhân này đang trống." />
                  ) : (
                    prescriptions.map((item, index) => (
                      <article key={item.prescription_id || item.id || index} className="doctor-record-event-card">
                        <div className="doctor-record-event-marker is-medication" />
                        <div className="doctor-record-event-card-inner">
                          <div className="doctor-record-event-head">
                            <div>
                              <span>{formatDate(item.created_at)}</span>
                              <h3>{item.prescription_no || item.prescription_id || 'Đơn thuốc'}</h3>
                            </div>
                            <StatusBadge status={item.status || ''} />
                          </div>
                          {safeArray(item.items).length ? (
                            <div className="doctor-record-med-grid">
                              {safeArray(item.items).map((medication, medIndex) => (
                                <div key={medication.medication_id || medIndex}>
                                  <strong>{medication.medication_name || medication.drug_name || 'Thuốc'}</strong>
                                  <span>{[medication.dose, medication.frequency, medication.duration_days].filter(Boolean).join(' | ') || '--'}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="doctor-muted-text">{item.note || 'Chưa có danh sách thuốc chi tiết.'}</p>
                          )}
                          <div className="doctor-inline-actions doctor-inline-actions-wrap">
                            <button
                              className="doctor-secondary-button"
                              type="button"
                              onClick={() =>
                                navigate('/doctor/prescriptions', {
                                  state: {
                                    selectedPrescriptionId: item.prescription_id || item.id,
                                  },
                                })
                              }
                            >
                              Mở đơn thuốc
                            </button>
                            {item.encounter_id ? (
                              <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${item.encounter_id}?tab=prescription`, { state: { activeTab: 'prescription' } })}>
                                Mở phiên khám liên quan
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              ) : null}

              {activeTab === 'appointments' ? (
                <section className="doctor-record-timeline">
                  {appointmentsState.loading ? <LoadingState label="Đang tải lịch sử lịch hẹn..." /> : null}
                  {appointmentsState.error && !appointments.length ? <ErrorState title="Không thể tải lịch sử lịch hẹn" message={appointmentsState.error} /> : null}
                  {!appointmentsState.error && appointments.length === 0 ? (
                    <EmptyState title="Không tìm thấy lịch hẹn" description="Lịch sử lịch hẹn của bệnh nhân này đang trống." />
                  ) : (
                    appointments.map((item, index) => (
                      <article key={item.appointment_id || item.id || index} className="doctor-record-event-card">
                        <div className="doctor-record-event-marker is-appointment" />
                        <div className="doctor-record-event-card-inner">
                          <div className="doctor-record-event-head">
                            <div>
                              <span>{formatDateTime(item.appointment_time)}</span>
                              <h3>{item.appointment_type || item.visit_type || 'Lịch hẹn'}</h3>
                            </div>
                            <StatusBadge status={item.status || ''} />
                          </div>
                          <p className="doctor-muted-text">{item.note || 'Không có ghi chú lịch hẹn.'}</p>
                          <div className="doctor-inline-actions doctor-inline-actions-wrap">
                            <button
                              className="doctor-secondary-button"
                              type="button"
                              onClick={() =>
                                navigate('/doctor/appointments', {
                                  state: {
                                    selectedAppointmentId: item.appointment_id || item.id,
                                    focusDate: item.appointment_time,
                                    worklistView: item.status === 'completed' ? 'completed' : 'active',
                                  },
                                })
                              }
                            >
                              Mở lịch hẹn
                            </button>
                            {item.encounter_id ? (
                              <button className="doctor-secondary-button" type="button" onClick={() => navigate(`/doctor/encounters/${item.encounter_id}`)}>
                                Mở phiên khám liên quan
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              ) : null}

              {activeTab === 'timeline' ? (
                <section className="doctor-record-timeline">
                  {timelineState.loading ? <LoadingState label="Đang tải dòng thời gian bệnh nhân..." /> : null}
                  {timelineState.error && !timeline.length ? <ErrorState title="Không thể tải dòng thời gian bệnh nhân" message={timelineState.error} /> : null}
                  {!timelineState.error && timeline.length === 0 ? (
                    <EmptyState title="Chưa có mục dòng thời gian" description="Dữ liệu dòng thời gian bệnh nhân chưa sẵn sàng." />
                  ) : (
                    timeline.map((item, index) => (
                      <article key={item.event_id || item.id || index} className="doctor-record-event-card">
                        <div className="doctor-record-event-marker is-timeline" />
                        <div className="doctor-record-event-card-inner">
                          <div className="doctor-record-event-head">
                            <div>
                              <span>{formatDateTime(resolveTimelineDate(item))}</span>
                              <h3>{getTimelineTitle(item)}</h3>
                            </div>
                          </div>
                          <p>{getTimelineDescription(item)}</p>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              ) : null}

              {activeTab === 'labs' ? (
                <section className="doctor-record-event-card doctor-record-static-card">
                  <div className="doctor-record-event-card-inner">
                    <div className="doctor-record-event-head">
                      <div>
                        <span>Chỉ đọc</span>
                        <h3>Kết quả xét nghiệm</h3>
                      </div>
                    </div>
                    <EmptyState title="Chưa có API kết quả xét nghiệm" description="Module bác sĩ hiện chỉ có API bệnh nhân, phiên khám, lịch hẹn, đơn thuốc và timeline." />
                  </div>
                </section>
              ) : null}

              {activeTab === 'documents' ? (
                <section className="doctor-record-event-card doctor-record-static-card">
                  <div className="doctor-record-event-card-inner">
                    <div className="doctor-record-event-head">
                      <div>
                        <span>Chỉ đọc</span>
                        <h3>Tài liệu</h3>
                      </div>
                    </div>
                    <EmptyState title="Chưa có API tài liệu" description="Không hiển thị chức năng upload/sửa tài liệu vì Doctor không có quyền quản lý hồ sơ bệnh nhân." />
                  </div>
                </section>
              ) : null}
            </main>
          </section>
        </>
      ) : null}
    </div>
  )
}

