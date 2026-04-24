import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ClinicalNotesPanel,
  ConsultationPanel,
  DiagnosisPanel,
  PrescriptionPanel,
  VitalSignsPanel,
} from './DoctorEncounterPanels'
import {
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PatientSummaryCard,
  SectionCard,
  StatusBadge,
} from './DoctorShell'
import { encounterTabs, formatDate, formatDateTime, safeArray } from './doctorData'
import { doctorApi, getDoctorCapabilities, getDoctorId } from './doctorApi'
import { useAsyncResource } from './DoctorHooks'

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
  const doctorId = getDoctorId(user)
  const capabilities = getDoctorCapabilities(user)
  const [activeTab, setActiveTab] = useState('overview')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

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
  const [consultationState, reloadConsultations] = useAsyncResource(
    async () => doctorApi.consultations.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải phiếu khám.' },
  )
  const [latestVitalsState] = useAsyncResource(
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
  const [diagnosesState] = useAsyncResource(
    async () => doctorApi.diagnoses.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải chẩn đoán.' },
  )

  const latestVitals = latestVitalsState.data || null
  const consultations = safeArray(consultationState.data)
  const prescriptions = safeArray(prescriptionsState.data)
  const diagnoses = safeArray(diagnosesState.data)
  const timelineItems = safeArray(timelineState.data)
  const patient = patientState.data
  const overviewConsultation = consultations[0]
  const activePrescription = prescriptions[0]
  const primaryDiagnosis = diagnoses.find((item) => item.is_primary) || diagnoses[0]

  function refreshAll() {
    reloadEncounter()
    reloadTimeline()
    reloadConsultations()
    reloadPrescriptions()
  }

  async function runEncounterAction(action) {
    setBusy(true)
    setFeedback('')

    try {
      if (action === 'start') {
        await doctorApi.encounters.start(encounterId)
      }
      if (action === 'hold') {
        await doctorApi.encounters.hold(encounterId)
      }
      if (action === 'complete') {
        await doctorApi.encounters.complete(encounterId)
      }

      refreshAll()
      setConfirmOpen(false)
    } catch (error) {
      setFeedback(error?.response?.data?.message || error?.message || 'Không thể cập nhật vòng đời phiên khám.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="doctor-page-stack">
      {encounterState.loading ? <LoadingState label="Đang tải phiên khám..." /> : null}
      {encounterState.error && !encounter ? (
        <ErrorState title="Không tìm thấy phiên khám" message={encounterState.error} onRetry={reloadEncounter} />
      ) : null}
      {encounter ? (
        <>
          {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}
          {!capabilities.canEncounterActions ? (
            <div className="doctor-permission-banner">
              Các thao tác vòng đời phiên khám đang ở chế độ chỉ xem vì tài khoản hiện tại thiếu quyền <code>encounters.write</code>.
            </div>
          ) : null}

          <section className="doctor-encounter-hero">
            <div className="doctor-encounter-head">
              <div>
                <span className="doctor-card-eyebrow">Phiên khám đang hoạt động</span>
                <h2>{patient?.full_name || patientId || 'Phiên khám bệnh nhân'}</h2>
                <p>{encounter.encounter_code || encounterId} | {patient?.patient_code || patientId} | {patient?.blood_type || '--'}</p>
              </div>
              <div className="doctor-inline-actions">
                <StatusBadge status={encounter.status || 'waiting'} />
                {encounter.status !== 'in_progress' ? (
                  <button className="doctor-secondary-button" type="button" onClick={() => runEncounterAction('start')} disabled={busy || !capabilities.canEncounterActions}>
                    Bắt đầu
                  </button>
                ) : null}
                {encounter.status === 'in_progress' ? (
                  <button className="doctor-secondary-button" type="button" onClick={() => runEncounterAction('hold')} disabled={busy || !capabilities.canEncounterActions}>
                    Tạm dừng
                  </button>
                ) : null}
                {encounter.status !== 'completed' ? (
                  <button className="doctor-primary-button doctor-primary-green" type="button" onClick={() => setConfirmOpen(true)} disabled={busy || !capabilities.canEncounterActions}>
                    Hoàn tất phiên khám
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

          {activeTab === 'consultation' ? <ConsultationPanel encounterId={encounterId} doctorId={doctorId} onChanged={refreshAll} /> : null}
          {activeTab === 'diagnosis' ? <DiagnosisPanel encounterId={encounterId} onChanged={refreshAll} /> : null}
          {activeTab === 'vitals' ? <VitalSignsPanel encounterId={encounterId} onChanged={refreshAll} /> : null}
          {activeTab === 'prescription' ? <PrescriptionPanel encounterId={encounterId} patientId={patientId} doctorId={doctorId} onChanged={refreshAll} /> : null}
          {activeTab === 'notes' ? <ClinicalNotesPanel encounterId={encounterId} doctorId={doctorId} onChanged={refreshAll} /> : null}
        </>
      ) : null}

      <ConfirmActionDialog
        open={confirmOpen}
        title="Hoàn tất phiên khám?"
        description="Thao tác này sẽ kết thúc vòng đời khám đang hoạt động của phiên khám đã chọn."
        confirmLabel="Hoàn tất phiên khám"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => runEncounterAction('complete')}
      />
    </div>
  )
}

export function DoctorPatientsScreen() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [patientState, reloadPatients] = useAsyncResource(
    async () =>
      doctorApi.patients.search({
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(status !== 'all' ? { status } : {}),
      }),
    [search, status],
    [],
    { fallbackMessage: 'Không thể tìm kiếm bệnh nhân.' },
  )
  const patients = useMemo(
    () =>
      safeArray(patientState.data)
        .slice()
        .sort((left, right) => {
          const leftKey = left.patient_code || left.full_name || left.patient_id || ''
          const rightKey = right.patient_code || right.full_name || right.patient_id || ''
          return leftKey.localeCompare(rightKey, 'vi', { numeric: true, sensitivity: 'base' })
        }),
    [patientState.data],
  )

  useEffect(() => {
    if (!patients.length) {
      if (selectedPatientId) {
        setSelectedPatientId('')
      }
      return
    }

    const hasSelected = patients.some((patient) => (patient.patient_id || patient.id) === selectedPatientId)
    if (!hasSelected) {
      setSelectedPatientId(patients[0].patient_id || patients[0].id || '')
    }
  }, [patients, selectedPatientId])

  const selectedPatientFromList = useMemo(
    () => patients.find((item) => (item.patient_id || item.id) === selectedPatientId) || null,
    [patients, selectedPatientId],
  )

  const [previewPatientState, reloadPreviewPatient] = useAsyncResource(
    async () => (selectedPatientId ? doctorApi.patients.getDetail(selectedPatientId) : null),
    [selectedPatientId],
    null,
    { fallbackMessage: 'Không thể tải bản xem trước bệnh nhân.' },
  )
  const [previewEncounterState] = useAsyncResource(
    async () => (selectedPatientId ? doctorApi.patients.getEncounters(selectedPatientId) : []),
    [selectedPatientId],
    [],
    { fallbackMessage: 'Không thể tải các phiên khám gần đây.' },
  )
  const [previewAppointmentState] = useAsyncResource(
    async () => (selectedPatientId ? doctorApi.patients.getAppointments(selectedPatientId) : []),
    [selectedPatientId],
    [],
    { fallbackMessage: 'Không thể tải các lịch hẹn gần đây.' },
  )
  const [previewPrescriptionState] = useAsyncResource(
    async () => (selectedPatientId ? doctorApi.patients.getPrescriptions(selectedPatientId) : []),
    [selectedPatientId],
    [],
    { fallbackMessage: 'Không thể tải các đơn thuốc gần đây.' },
  )
  const [previewTimelineState] = useAsyncResource(
    async () => (selectedPatientId ? doctorApi.patients.getTimeline(selectedPatientId) : []),
    [selectedPatientId],
    [],
    { fallbackMessage: 'Không thể tải dòng thời gian bệnh nhân.' },
  )

  const selectedPatient = previewPatientState.data || selectedPatientFromList
  const selectedEncounters = safeArray(previewEncounterState.data)
  const selectedAppointments = safeArray(previewAppointmentState.data)
  const selectedPrescriptions = safeArray(previewPrescriptionState.data)
  const selectedTimeline = safeArray(previewTimelineState.data)
  const lastSeen = getPatientLastSeen(selectedEncounters, selectedAppointments, selectedTimeline)
  const activePatients = patients.filter((item) => item.status === 'active').length
  const previewLoading =
    previewPatientState.loading ||
    previewEncounterState.loading ||
    previewAppointmentState.loading ||
    previewPrescriptionState.loading ||
    previewTimelineState.loading

  return (
    <div className="doctor-page-stack">
      <section className="doctor-page-heading">
        <div>
          <span className="doctor-card-eyebrow">Xem hồ sơ chỉ đọc</span>
          <h2>Hồ sơ bệnh nhân</h2>
          <p>Tìm kiếm, xem trước và mở bệnh sử lâm sàng mà không chỉnh sửa hồ sơ hành chính bệnh nhân.</p>
        </div>
      </section>

      <section className="doctor-patients-hub">
        <SectionCard
          title="Tìm kiếm bệnh nhân"
          subtitle="Tra cứu nhanh theo tên bệnh nhân, mã hồ sơ, số điện thoại hoặc số bảo hiểm."
          className="doctor-patient-search-card"
          actions={
            <button className="doctor-secondary-button" type="button" onClick={reloadPatients}>
              Làm mới
            </button>
          }
        >
          <div className="doctor-filter-bar doctor-filter-bar-patient-search">
            <label className="doctor-search-input">
              <span>Tìm bệnh nhân</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên bệnh nhân, mã hồ sơ, số điện thoại hoặc số bảo hiểm"
              />
            </label>
            <label>
              <span>Trạng thái</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Không hoạt động</option>
                <option value="archived">Lưu trữ</option>
                <option value="deceased">Đã mất</option>
              </select>
            </label>
          </div>

          <div className="doctor-patient-search-summary">
            <div className="doctor-patient-search-stat">
              <strong>{patients.length}</strong>
              <span>Kết quả trong bộ lọc hiện tại</span>
            </div>
            <div className="doctor-patient-search-stat">
              <strong>{activePatients}</strong>
              <span>Hồ sơ đang hoạt động</span>
            </div>
            <div className="doctor-patient-search-stat">
              <strong>{search.trim() ? 'Tra cứu tập trung' : 'Danh sách trực tiếp'}</strong>
              <span>{search.trim() ? 'Đang hiển thị tập bệnh nhân đã thu hẹp' : 'Đang duyệt các hồ sơ bệnh nhân có thể truy cập'}</span>
            </div>
          </div>

          {patientState.loading ? <LoadingState label="Đang tìm bệnh nhân..." /> : null}
          {patientState.error && !patients.length ? (
            <ErrorState title="Không thể tìm bệnh nhân" message={patientState.error} onRetry={reloadPatients} />
          ) : null}
          {!patientState.loading && patients.length === 0 ? (
            <EmptyState title="Không có bệnh nhân phù hợp" description="Hãy thử tìm theo tên bệnh nhân, mã hồ sơ, số điện thoại hoặc số bảo hiểm." />
          ) : null}
          {!patientState.loading && patients.length > 0 ? (
            <div className="doctor-patient-results-grid">
              {patients.map((patient) => {
                const patientId = patient.patient_id || patient.id
                const age = calculatePatientAge(patient.date_of_birth)
                return (
                  <button
                    key={patientId}
                    type="button"
                    className={`doctor-patient-result-card${selectedPatientId === patientId ? ' is-selected' : ''}`}
                    onClick={() => setSelectedPatientId(patientId)}
                  >
                    <div className="doctor-patient-result-head">
                      <div className="doctor-patient-chip">{(patient.full_name || 'PT').split(' ').filter(Boolean).slice(0, 2).map((item) => item[0]).join('').toUpperCase() || 'PT'}</div>
                      <div>
                        <strong>{patient.full_name || 'Chưa rõ bệnh nhân'}</strong>
                        <p>{patient.patient_code || patientId}</p>
                      </div>
                    </div>
                    <div className="doctor-patient-result-meta">
                      <span>{age || 'Chưa có tuổi'}</span>
                      <span>{patient.gender || 'Chưa có giới tính'}</span>
                      <span>{patient.phone || 'Chưa có số điện thoại'}</span>
                    </div>
                    <div className="doctor-patient-result-footer">
                      <StatusBadge status={patient.status || ''} />
                      <span>Xem trước hồ sơ</span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </SectionCard>

        <div className="doctor-panel-stack">
          <SectionCard
            title="Xem trước bệnh nhân"
            subtitle="Tóm tắt chỉ đọc để quét nhanh trước khi mở toàn bộ hồ sơ."
            actions={
              selectedPatientId ? (
                <button className="doctor-primary-button" type="button" onClick={() => navigate(`/doctor/patients/${selectedPatientId}`)}>
                  Mở toàn bộ hồ sơ
                </button>
              ) : null
            }
          >
            {!selectedPatientId && !previewLoading ? (
              <EmptyState title="Chọn bệnh nhân" description="Chọn một thẻ bệnh nhân từ kết quả tìm kiếm để xem trước thông tin và bệnh sử." />
            ) : null}
            {previewLoading ? <LoadingState label="Đang tải xem trước bệnh nhân..." /> : null}
            {previewPatientState.error && !selectedPatient ? (
              <ErrorState title="Không thể xem trước bệnh nhân" message={previewPatientState.error} onRetry={reloadPreviewPatient} />
            ) : null}
            {selectedPatient ? (
              <div className="doctor-patient-preview">
                <div className="doctor-patient-preview-hero">
                  <div className="doctor-patient-preview-head">
                    <div className="doctor-patient-avatar">
                      {(selectedPatient.full_name || 'PT')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((item) => item[0])
                        .join('')
                        .toUpperCase() || 'PT'}
                    </div>
                    <div>
                      <span className="doctor-card-eyebrow">Hồ sơ bệnh nhân</span>
                      <h3>{selectedPatient.full_name || 'Chưa rõ bệnh nhân'}</h3>
                      <p>
                        {[selectedPatient.patient_code || selectedPatient.patient_id, calculatePatientAge(selectedPatient.date_of_birth), selectedPatient.gender]
                          .filter(Boolean)
                          .join(' | ')}
                      </p>
                    </div>
                  </div>
                  <div className="doctor-patient-preview-status">
                    <StatusBadge status={selectedPatient.status || ''} />
                    <small>Lần khám gần nhất {lastSeen ? formatDate(lastSeen) : '--'}</small>
                  </div>
                </div>

                <div className="doctor-patient-preview-stats">
                  <div className="doctor-kpi-tile">
                    <strong>{selectedEncounters.length}</strong>
                    <span>Phiên khám</span>
                  </div>
                  <div className="doctor-kpi-tile">
                    <strong>{selectedAppointments.length}</strong>
                    <span>Lịch hẹn</span>
                  </div>
                  <div className="doctor-kpi-tile">
                    <strong>{selectedPrescriptions.length}</strong>
                    <span>Đơn thuốc</span>
                  </div>
                </div>

                <div className="doctor-patient-preview-grid">
                  <div className="doctor-panel-stack">
                    <div className="doctor-patient-info-block">
                      <h4>Thông tin hành chính & liên hệ</h4>
                      <div className="doctor-detail-grid">
                        <div><span>Ngày sinh</span><strong>{formatDate(selectedPatient.date_of_birth)}</strong></div>
                        <div><span>Số điện thoại</span><strong>{selectedPatient.phone || '--'}</strong></div>
                        <div><span>Email</span><strong>{selectedPatient.email || '--'}</strong></div>
                        <div><span>Bảo hiểm</span><strong>{selectedPatient.insurance_number || '--'}</strong></div>
                        <div><span>Liên hệ khẩn cấp</span><strong>{selectedPatient.emergency_contact_name || '--'}</strong></div>
                        <div><span>Số điện thoại khẩn cấp</span><strong>{selectedPatient.emergency_contact_phone || '--'}</strong></div>
                      </div>
                    </div>

                    <div className="doctor-patient-info-block">
                      <h4>Dòng thời gian gần đây</h4>
                      {selectedTimeline.length === 0 ? (
                        <EmptyState title="Chưa có sự kiện dòng thời gian" description="Lịch sử bệnh nhân gần đây sẽ xuất hiện tại đây khi có hoạt động lâm sàng." />
                      ) : (
                        <div className="doctor-list-stack">
                          {selectedTimeline.slice(0, 4).map((item, index) => (
                            <div key={item.event_id || item.id || index} className="doctor-list-row">
                              <div>
                                <strong>{getTimelineTitle(item)}</strong>
                                <p>{getTimelineDescription(item)}</p>
                              </div>
                              <span className="doctor-muted-text">{formatDateTime(resolveTimelineDate(item))}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="doctor-panel-stack">
                    <div className="doctor-patient-info-block">
                      <h4>Phiên khám gần đây</h4>
                      <PatientHistoryList
                        items={selectedEncounters.slice(0, 3)}
                        emptyTitle="Không có phiên khám"
                        emptyDescription="Lịch sử phiên khám của bệnh nhân này đang trống."
                        renderMeta={(item) => ({
                          title: item.encounter_code || item.encounter_id || 'Phiên khám',
                          description: `${formatDateTime(item.start_time)} | ${item.encounter_type || '--'}`,
                          status: item.status || '',
                        })}
                      />
                    </div>

                    <div className="doctor-patient-info-block">
                      <h4>Đơn thuốc gần đây</h4>
                      <PatientHistoryList
                        items={selectedPrescriptions.slice(0, 3)}
                        emptyTitle="Không có đơn thuốc"
                        emptyDescription="Lịch sử đơn thuốc của bệnh nhân này đang trống."
                        renderMeta={(item) => ({
                          title: item.prescription_no || item.prescription_id || 'Đơn thuốc',
                          description: `${formatDate(item.created_at)} | ${item.note || '--'}`,
                          status: item.status || '',
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="doctor-readonly-note">
                  Bản xem trước này ở chế độ chỉ đọc cho vai trò Bác sĩ. Không thể chỉnh sửa dữ liệu hành chính và đăng ký bệnh nhân từ màn hình này.
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>
      </section>
    </div>
  )
}

export function DoctorPatientDetailScreen() {
  const { patientId } = useParams()
  const [activeTab, setActiveTab] = useState('overview')
  const [patientState, reloadPatient] = useAsyncResource(
    async () => doctorApi.patients.getDetail(patientId),
    [patientId],
    null,
    { fallbackMessage: 'Không thể tải hồ sơ bệnh nhân.' },
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
  const encounters = safeArray(encountersState.data)
  const appointments = safeArray(appointmentsState.data)
  const prescriptions = safeArray(prescriptionsState.data)
  const timeline = safeArray(timelineState.data)
  const patientLastSeen = getPatientLastSeen(encounters, appointments, timeline)

  const historyTabs = useMemo(
    () => [
      { id: 'overview', label: 'Tổng quan' },
      { id: 'encounters', label: 'Lịch sử phiên khám' },
      { id: 'appointments', label: 'Lịch sử lịch hẹn' },
      { id: 'prescriptions', label: 'Lịch sử đơn thuốc' },
      { id: 'timeline', label: 'Dòng thời gian' },
    ],
    [],
  )

  return (
    <div className="doctor-page-stack">
      {patientState.loading ? <LoadingState label="Đang tải hồ sơ bệnh nhân..." /> : null}
      {patientState.error && !patient ? (
        <ErrorState title="Không tìm thấy bệnh nhân" message={patientState.error} onRetry={reloadPatient} />
      ) : null}
      {patient ? (
        <>
          <section className="doctor-encounter-hero">
            <div className="doctor-encounter-head">
              <div>
                <span className="doctor-card-eyebrow">Hồ sơ bệnh nhân chỉ đọc</span>
                <h2>{patient.full_name}</h2>
                <p>
                  {[patient.patient_code || patient.patient_id, calculatePatientAge(patient.date_of_birth), patient.gender || '--']
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              </div>
              <div className="doctor-patient-preview-status">
                <StatusBadge status={patient.status || ''} />
                <small>Lần khám gần nhất {patientLastSeen ? formatDate(patientLastSeen) : '--'}</small>
              </div>
            </div>
            <div className="doctor-tab-strip">
              {historyTabs.map((tab) => (
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
            <div className="doctor-patient-detail-layout">
              <SectionCard title="Hành trình lâm sàng" subtitle="Tóm tắt cấp cao để rà nhanh hồ sơ.">
                {timeline.length > 0 ? (
                  <div className="doctor-list-stack">
                    {timeline.slice(0, 5).map((item, index) => (
                      <div key={item.event_id || item.id || index} className="doctor-list-row">
                        <div>
                          <strong>{getTimelineTitle(item)}</strong>
                          <p>{getTimelineDescription(item)}</p>
                        </div>
                        <span className="doctor-muted-text">{formatDateTime(resolveTimelineDate(item))}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Chưa có dòng thời gian bệnh nhân" description="Các mục dòng thời gian sẽ xuất hiện khi hoạt động lâm sàng được ghi nhận." />
                )}
              </SectionCard>

              <div className="doctor-panel-stack">
                <PatientSummaryCard patient={patient}>
                  <div className="doctor-summary-meta-grid">
                    <div>
                      <span>Phiên khám</span>
                      <strong>{encounters.length}</strong>
                    </div>
                    <div>
                      <span>Lịch hẹn</span>
                      <strong>{appointments.length}</strong>
                    </div>
                    <div>
                      <span>Đơn thuốc</span>
                      <strong>{prescriptions.length}</strong>
                    </div>
                    <div>
                      <span>Bảo hiểm</span>
                      <strong>{patient.insurance_number || '--'}</strong>
                    </div>
                  </div>
                  <div className="doctor-readonly-note">Hồ sơ bệnh nhân này ở chế độ chỉ đọc đối với vai trò Bác sĩ.</div>
                </PatientSummaryCard>

                <SectionCard title="Liên hệ & đăng ký" subtitle="Thông tin hiển thị cho Bác sĩ mà không có quyền chỉnh sửa.">
                  <div className="doctor-detail-grid">
                    <div><span>Ngày sinh</span><strong>{formatDate(patient.date_of_birth)}</strong></div>
                    <div><span>Số điện thoại</span><strong>{patient.phone || '--'}</strong></div>
                    <div><span>Email</span><strong>{patient.email || '--'}</strong></div>
                    <div><span>Địa chỉ</span><strong>{patient.address || '--'}</strong></div>
                    <div><span>Liên hệ khẩn cấp</span><strong>{patient.emergency_contact_name || '--'}</strong></div>
                    <div><span>Số điện thoại khẩn cấp</span><strong>{patient.emergency_contact_phone || '--'}</strong></div>
                  </div>
                </SectionCard>

                <SectionCard title="Thuốc gần đây" subtitle="Xem nhanh hoạt động kê đơn gần đây.">
                  <PatientHistoryList
                    items={prescriptions.slice(0, 3)}
                    emptyTitle="Chưa có lịch sử thuốc"
                    emptyDescription="Lịch sử đơn thuốc của bệnh nhân này đang trống."
                    renderMeta={(item) => ({
                      title: item.prescription_no || item.prescription_id || item.id,
                      description: `${formatDate(item.created_at)} | ${item.note || '--'}`,
                      status: item.status || '',
                    })}
                  />
                </SectionCard>
              </div>
            </div>
          ) : null}

          {activeTab === 'encounters' ? (
            <SectionCard title="Lịch sử phiên khám" subtitle="Danh sách lịch sử phiên khám của bệnh nhân này.">
              {encounters.length === 0 ? <EmptyState title="Không có phiên khám" description="Lịch sử phiên khám của bệnh nhân này đang trống." /> : (
                <div className="doctor-list-stack">
                  {encounters.map((item) => (
                    <div key={item.encounter_id || item.id} className="doctor-list-row">
                      <div>
                        <strong>{item.encounter_code || item.encounter_id || item.id}</strong>
                        <p>{formatDateTime(item.start_time)} | {item.encounter_type || '--'}</p>
                      </div>
                      <StatusBadge status={item.status || ''} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          {activeTab === 'appointments' ? (
            <SectionCard title="Lịch sử lịch hẹn" subtitle="Lịch sử lịch hẹn chỉ đọc của bệnh nhân này.">
              {appointments.length === 0 ? <EmptyState title="Không tìm thấy lịch hẹn" description="Lịch sử lịch hẹn của bệnh nhân này đang trống." /> : (
                <div className="doctor-list-stack">
                  {appointments.map((item) => (
                    <div key={item.appointment_id || item.id} className="doctor-list-row">
                      <div>
                        <strong>{formatDateTime(item.appointment_time)}</strong>
                        <p>{item.appointment_type || item.visit_type || '--'}</p>
                      </div>
                      <StatusBadge status={item.status || ''} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          {activeTab === 'prescriptions' ? (
            <SectionCard title="Lịch sử đơn thuốc" subtitle="Lịch sử đơn thuốc của bệnh nhân đã chọn.">
              {prescriptions.length === 0 ? <EmptyState title="Không có đơn thuốc" description="Lịch sử đơn thuốc của bệnh nhân này đang trống." /> : (
                <div className="doctor-list-stack">
                  {prescriptions.map((item) => (
                    <div key={item.prescription_id || item.id} className="doctor-list-row">
                      <div>
                        <strong>{item.prescription_no || item.prescription_id || item.id}</strong>
                        <p>{formatDate(item.created_at)} | {item.note || '--'}</p>
                      </div>
                      <StatusBadge status={item.status || ''} />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}

          {activeTab === 'timeline' ? (
            <SectionCard title="Dòng thời gian bệnh nhân" subtitle="Các sự kiện theo thời gian và lịch sử chăm sóc của bệnh nhân.">
              {timeline.length === 0 ? <EmptyState title="Chưa có mục dòng thời gian" description="Dữ liệu dòng thời gian bệnh nhân chưa sẵn sàng." /> : (
                <div className="doctor-list-stack">
                  {timeline.map((item, index) => (
                    <div key={item.event_id || item.id || index} className="doctor-list-row">
                      <div>
                        <strong>{getTimelineTitle(item)}</strong>
                        <p>{getTimelineDescription(item)}</p>
                      </div>
                      <span className="doctor-muted-text">{formatDateTime(resolveTimelineDate(item))}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

