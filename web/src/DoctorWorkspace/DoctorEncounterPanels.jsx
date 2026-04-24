import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../utils/api'
import { calculateBmi, formatDateTime, safeArray } from './doctorData'
import { doctorApi } from './doctorApi'
import { toDateTimeInputValue, useAsyncResource } from './DoctorHooks'
import {
  ConfirmActionDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionCard,
  StatusBadge,
} from './DoctorShell'

function normalizeStatusList(items = [], getId) {
  return safeArray(items).map((item) => ({
    ...item,
    _key: getId(item),
  }))
}

function validateVitalsForm(form) {
  const errors = []

  if (form.recorded_at && Number.isNaN(new Date(form.recorded_at).getTime())) {
    errors.push('Thời gian ghi nhận không hợp lệ.')
  }
  if (form.temperature && Number(form.temperature) <= 0) {
    errors.push('Nhiệt độ phải lớn hơn 0.')
  }
  if (form.spo2 && (Number(form.spo2) < 0 || Number(form.spo2) > 100)) {
    errors.push('SpO2 phải nằm trong khoảng từ 0 đến 100.')
  }
  if (form.height && Number(form.height) <= 0) {
    errors.push('Chiều cao phải lớn hơn 0.')
  }
  if (form.weight && Number(form.weight) <= 0) {
    errors.push('Cân nặng phải lớn hơn 0.')
  }

  return errors
}

export function ConsultationPanel({ encounterId, doctorId, onChanged }) {
  const [consultationsState, reloadConsultations] = useAsyncResource(
    async () => doctorApi.consultations.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải phiếu khám.' },
  )
  const consultations = safeArray(consultationsState.data)
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({
    chief_complaint: '',
    history_present_illness: '',
    physical_exam: '',
    assessment: '',
    plan: '',
  })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [dialog, setDialog] = useState(null)

  const currentConsultation =
    consultations.find((item) => item.consultation_id === selectedId) || consultations[0] || null

  useEffect(() => {
    if (currentConsultation) {
      setSelectedId(currentConsultation.consultation_id)
      setForm({
        chief_complaint: currentConsultation.chief_complaint || '',
        history_present_illness: currentConsultation.history_present_illness || '',
        physical_exam: currentConsultation.physical_exam || '',
        assessment: currentConsultation.assessment || '',
        plan: currentConsultation.plan || '',
      })
      return
    }

    setSelectedId('')
    setForm({
      chief_complaint: '',
      history_present_illness: '',
      physical_exam: '',
      assessment: '',
      plan: '',
    })
  }, [currentConsultation?.consultation_id])

  const signBlocked = !String(form.assessment || '').trim() && !String(form.plan || '').trim()

  async function saveConsultation() {
    setSaving(true)
    setFeedback('')

    try {
      if (selectedId) {
        await doctorApi.consultations.update(selectedId, form)
        reloadConsultations()
        onChanged()
        setFeedback('Đã lưu bản nháp phiếu khám.')
        return selectedId
      } else {
        const created = await doctorApi.consultations.create({
          encounter_id: encounterId,
          doctor_id: doctorId,
          ...form,
        })
        const nextId = created?.consultation_id || ''
        setSelectedId(nextId)
        reloadConsultations()
        onChanged()
        setFeedback('Đã lưu bản nháp phiếu khám.')
        return nextId
      }
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể lưu phiếu khám.'))
      return ''
    } finally {
      setSaving(false)
    }
  }

  async function commitConsultationAction(action) {
    if (action === 'sign' && signBlocked) {
      setFeedback('Cần có đánh giá hoặc kế hoạch điều trị trước khi ký.')
      setDialog(null)
      return
    }

    let targetId = selectedId
    if (!targetId) {
      targetId = await saveConsultation()
    }

    if (!targetId) {
      setFeedback('Hãy lưu bản nháp phiếu khám trước khi tiếp tục.')
      setDialog(null)
      return
    }

    setSaving(true)
    setFeedback('')

    try {
      if (action === 'start') {
        await doctorApi.consultations.start(targetId)
      }
      if (action === 'sign') {
        await doctorApi.consultations.sign(targetId)
      }
      if (action === 'amend') {
        await doctorApi.consultations.amend(targetId, form)
      }

      reloadConsultations()
      onChanged()
      setDialog(null)
      const actionLabels = {
        start: 'Đã bắt đầu phiếu khám.',
        sign: 'Đã ký phiếu khám.',
        amend: 'Đã bổ sung phiếu khám.',
      }
      setFeedback(actionLabels[action] || 'Đã cập nhật phiếu khám.')
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể cập nhật phiếu khám.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="doctor-two-column doctor-consultation-layout">
      <div className="doctor-panel-stack">
        <SectionCard title="Phiếu khám" subtitle="Hồ sơ khám chính cho phiên khám đang hoạt động.">
          <div className="doctor-panel-toolbar">
            <div className="doctor-inline-actions doctor-inline-actions-wrap">
              {consultations.map((item) => (
                <button
                  key={item.consultation_id}
                  className={`doctor-secondary-button${selectedId === item.consultation_id ? ' is-active' : ''}`}
                  type="button"
                  onClick={() => setSelectedId(item.consultation_id)}
                >
                  {item.consultation_no || item.consultation_id}
                </button>
              ))}
              {consultations.length === 0 ? <span className="doctor-muted-text">Chưa có phiếu khám.</span> : null}
            </div>
            {currentConsultation?.status ? (
              <StatusBadge status={currentConsultation.status} />
            ) : (
              <span className="doctor-muted-text">--</span>
            )}
          </div>

          <div className="doctor-consultation-sections">
            <label className="doctor-section-field">
              <span>Lý do khám</span>
              <textarea value={form.chief_complaint} onChange={(event) => setForm((current) => ({ ...current, chief_complaint: event.target.value }))} placeholder="Mô tả ngắn lý do chính khiến bệnh nhân đến khám..." />
            </label>

            <div className="doctor-form-grid">
              <label className="doctor-section-field">
                <span>Bệnh sử hiện tại</span>
                <textarea value={form.history_present_illness} onChange={(event) => setForm((current) => ({ ...current, history_present_illness: event.target.value }))} placeholder="Mô tả chi tiết diễn tiến triệu chứng theo thời gian..." />
              </label>

              <label className="doctor-section-field">
                <span>Khám thực thể</span>
                <textarea value={form.physical_exam} onChange={(event) => setForm((current) => ({ ...current, physical_exam: event.target.value }))} placeholder="Kết quả khám lâm sàng..." />
              </label>
            </div>

            <label className="doctor-section-field">
              <span>Đánh giá</span>
              <textarea value={form.assessment} onChange={(event) => setForm((current) => ({ ...current, assessment: event.target.value }))} placeholder="Nhận định chẩn đoán và tóm tắt..." />
            </label>

            <label className="doctor-section-field">
              <span>Kế hoạch điều trị</span>
              <textarea value={form.plan} onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))} placeholder="Kế hoạch xử trí, kê đơn và tái khám..." />
            </label>
          </div>

          {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}
        </SectionCard>
      </div>

      <SectionCard title="Điều khiển phiên khám" subtitle="Lưu, ký và bổ sung với kiểm tra an toàn từ backend.">
        <div className="doctor-panel-stack">
          <div className="doctor-kpi-tile">
            <strong>{signBlocked ? 'Cần có đánh giá hoặc kế hoạch' : 'Sẵn sàng ký'}</strong>
            <span>{signBlocked ? 'Việc ký bị chặn cho đến khi nội dung lâm sàng đầy đủ.' : 'Phiếu khám có thể được ký.'}</span>
          </div>
          <button className="doctor-secondary-button" type="button" onClick={saveConsultation} disabled={saving}>
            Lưu nháp
          </button>
          <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'start' })} disabled={saving || !selectedId}>
            Bắt đầu phiếu khám
          </button>
          <button className="doctor-primary-button" type="button" onClick={() => setDialog({ action: 'sign' })} disabled={saving || signBlocked}>
            Ký và đóng
          </button>
          <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'amend' })} disabled={saving || !selectedId}>
            Bổ sung phiếu khám
          </button>
        </div>
      </SectionCard>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title={
          dialog?.action === 'sign'
            ? 'Ký phiếu khám?'
            : dialog?.action === 'amend'
              ? 'Bổ sung phiếu khám?'
              : 'Bắt đầu phiếu khám?'
        }
        description={
          dialog?.action === 'sign'
            ? 'Việc ký sẽ khóa hồ sơ lâm sàng của phiếu khám này cho đến khi được bổ sung.'
            : dialog?.action === 'amend'
              ? 'Thao tác này sẽ đánh dấu phiếu khám hiện tại là đã bổ sung với nội dung biểu mẫu hiện có.'
              : 'Thao tác này sẽ đánh dấu phiếu khám là đã bắt đầu cho phiên khám đang hoạt động.'
        }
        confirmLabel={
          dialog?.action === 'sign' ? 'Ký phiếu khám' : dialog?.action === 'amend' ? 'Bổ sung phiếu khám' : 'Bắt đầu phiếu khám'
        }
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitConsultationAction(dialog?.action)}
      />
    </div>
  )
}

export function DiagnosisPanel({ encounterId, onChanged }) {
  const [diagnosisState, reloadDiagnoses] = useAsyncResource(
    async () => doctorApi.diagnoses.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải chẩn đoán.' },
  )
  const diagnoses = normalizeStatusList(diagnosisState.data, (item) => item.diagnosis_id)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    icd10_code: '',
    diagnosis_name: '',
    diagnosis_type: 'provisional',
    is_primary: false,
    onset_date: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    const diagnosis = diagnoses.find((item) => item.diagnosis_id === editingId)
    if (!diagnosis) {
      return
    }

    setForm({
      icd10_code: diagnosis.icd10_code || '',
      diagnosis_name: diagnosis.diagnosis_name || '',
      diagnosis_type: diagnosis.diagnosis_type || 'provisional',
      is_primary: Boolean(diagnosis.is_primary),
      onset_date: diagnosis.onset_date ? String(diagnosis.onset_date).slice(0, 10) : '',
      notes: diagnosis.notes || '',
    })
  }, [diagnoses, editingId])

  async function saveDiagnosis() {
    if (!form.icd10_code.trim() || !form.diagnosis_name.trim() || !form.diagnosis_type) {
      setFeedback('Mã ICD-10, tên chẩn đoán và loại chẩn đoán là bắt buộc.')
      return
    }
    if (form.onset_date && new Date(form.onset_date).getTime() > Date.now()) {
      setFeedback('Ngày khởi phát không được ở tương lai.')
      return
    }

    setSaving(true)
    setFeedback('')

    try {
      if (editingId) {
        await doctorApi.diagnoses.update(editingId, form)
      } else {
        await doctorApi.diagnoses.create({
          encounter_id: encounterId,
          ...form,
        })
      }

      setEditingId('')
      setForm({
        icd10_code: '',
        diagnosis_name: '',
        diagnosis_type: 'provisional',
        is_primary: false,
        onset_date: '',
        notes: '',
      })
      reloadDiagnoses()
      onChanged()
      setFeedback('Đã lưu chẩn đoán.')
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể lưu chẩn đoán.'))
    } finally {
      setSaving(false)
    }
  }

  async function commitDiagnosisAction(action, diagnosisId) {
    setSaving(true)
    setFeedback('')
    try {
      if (action === 'primary') {
        await doctorApi.diagnoses.setPrimary(diagnosisId)
      }
      if (action === 'resolve') {
        await doctorApi.diagnoses.resolve(diagnosisId)
      }

      reloadDiagnoses()
      onChanged()
      setDialog(null)
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể cập nhật chẩn đoán.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="doctor-two-column">
      <SectionCard title="Danh sách chẩn đoán" subtitle="Chẩn đoán chính được làm nổi bật để rà nhanh.">
        {diagnoses.length === 0 ? (
          <EmptyState title="Chưa có chẩn đoán" description="Hãy ghi nhận chẩn đoán cho phiên khám này." />
        ) : (
          <div className="doctor-list-stack">
            {diagnoses.map((diagnosis) => (
              <div key={diagnosis._key} className="doctor-list-row">
                <div>
                  <strong>{diagnosis.diagnosis_name}</strong>
                  <p>{diagnosis.icd10_code} | {diagnosis.diagnosis_type}</p>
                </div>
                <div className="doctor-inline-actions doctor-inline-actions-wrap">
                  {diagnosis.is_primary ? <StatusBadge status="confirmed_diagnosis" /> : null}
                  <button className="doctor-secondary-button" type="button" onClick={() => setEditingId(diagnosis.diagnosis_id)}>
                    Chỉnh sửa
                  </button>
                  {!diagnosis.is_primary ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'primary', id: diagnosis.diagnosis_id })}>
                      Đặt chẩn đoán chính
                    </button>
                  ) : null}
                  {diagnosis.status !== 'resolved' ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'resolve', id: diagnosis.diagnosis_id })}>
                      Đánh dấu đã giải quyết
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={editingId ? 'Chỉnh sửa chẩn đoán' : 'Thêm chẩn đoán'} subtitle="Nhập liệu trực tiếp tối ưu cho tốc độ thao tác của bác sĩ.">
        <div className="doctor-form-grid">
          <label><span>Mã ICD-10</span><input value={form.icd10_code} onChange={(event) => setForm((current) => ({ ...current, icd10_code: event.target.value }))} /></label>
          <label><span>Tên chẩn đoán</span><input value={form.diagnosis_name} onChange={(event) => setForm((current) => ({ ...current, diagnosis_name: event.target.value }))} /></label>
          <label><span>Loại chẩn đoán</span><select value={form.diagnosis_type} onChange={(event) => setForm((current) => ({ ...current, diagnosis_type: event.target.value }))}><option value="provisional">Tạm thời</option><option value="confirmed">Xác định</option><option value="discharge">Ra viện</option><option value="secondary">Thứ phát</option></select></label>
          <label><span>Ngày khởi phát</span><input type="date" value={form.onset_date} onChange={(event) => setForm((current) => ({ ...current, onset_date: event.target.value }))} /></label>
          <label className="doctor-checkbox-field"><input type="checkbox" checked={form.is_primary} onChange={(event) => setForm((current) => ({ ...current, is_primary: event.target.checked }))} /><span>Đặt làm chẩn đoán chính</span></label>
          <label><span>Ghi chú</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
        </div>
        {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}
        <div className="doctor-inline-actions">
          <button className="doctor-primary-button" type="button" onClick={saveDiagnosis} disabled={saving}>{editingId ? 'Cập nhật chẩn đoán' : 'Thêm chẩn đoán'}</button>
          {editingId ? <button className="doctor-secondary-button" type="button" onClick={() => setEditingId('')}>Hủy</button> : null}
        </div>
      </SectionCard>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title={dialog?.action === 'resolve' ? 'Đánh dấu chẩn đoán đã giải quyết?' : 'Đặt chẩn đoán chính?'}
        description={
          dialog?.action === 'resolve'
            ? 'Thao tác này sẽ đánh dấu chẩn đoán đã chọn là đã giải quyết.'
            : 'Thao tác này sẽ đặt chẩn đoán đã chọn làm chẩn đoán chính cho phiên khám.'
        }
        confirmLabel={dialog?.action === 'resolve' ? 'Đánh dấu đã giải quyết' : 'Đặt chẩn đoán chính'}
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitDiagnosisAction(dialog?.action, dialog?.id)}
      />
    </div>
  )
}

export function VitalSignsPanel({ encounterId, onChanged }) {
  const [historyState, reloadHistory] = useAsyncResource(
    async () => doctorApi.vitals.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải lịch sử sinh hiệu.' },
  )
  const [latestState, reloadLatest] = useAsyncResource(
    async () => doctorApi.vitals.getLatest(encounterId),
    [encounterId],
    null,
    { fallbackMessage: 'Không thể tải sinh hiệu mới nhất.' },
  )

  const history = safeArray(historyState.data)
  const latest = latestState.data || history[0] || null
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState({
    temperature: '',
    heart_rate: '',
    respiratory_rate: '',
    systolic_bp: '',
    diastolic_bp: '',
    spo2: '',
    weight: '',
    height: '',
    recorded_at: toDateTimeInputValue(),
  })
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    if (!editingId) {
      return
    }

    const current = history.find((item) => item.vital_sign_id === editingId)
    if (!current) {
      return
    }

    setForm({
      temperature: current.temperature || '',
      heart_rate: current.heart_rate || '',
      respiratory_rate: current.respiratory_rate || '',
      systolic_bp: current.systolic_bp || '',
      diastolic_bp: current.diastolic_bp || '',
      spo2: current.spo2 || '',
      weight: current.weight || '',
      height: current.height || '',
      recorded_at: toDateTimeInputValue(current.recorded_at),
    })
  }, [editingId, history])

  const bmi = calculateBmi(form.weight, form.height)

  async function saveVitals() {
    const errors = validateVitalsForm(form)
    if (errors.length > 0) {
      setFeedback(errors[0])
      return
    }

    setSaving(true)
    setFeedback('')

    try {
      const payload = {
        ...form,
        encounter_id: encounterId,
        bmi: bmi ? Number(bmi) : undefined,
        recorded_at: new Date(form.recorded_at).toISOString(),
      }

      if (editingId) {
        await doctorApi.vitals.update(editingId, payload)
      } else {
        await doctorApi.vitals.create(payload)
      }

      setEditingId('')
      setForm({
        temperature: '',
        heart_rate: '',
        respiratory_rate: '',
        systolic_bp: '',
        diastolic_bp: '',
        spo2: '',
        weight: '',
        height: '',
        recorded_at: toDateTimeInputValue(),
      })
      reloadHistory()
      reloadLatest()
      onChanged()
      setFeedback('Đã lưu sinh hiệu.')
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể lưu sinh hiệu.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="doctor-two-column">
      <div className="doctor-panel-stack">
        <SectionCard title="Sinh hiệu mới nhất" subtitle="Bộ sinh hiệu mới nhất của phiên khám hiện tại.">
          {!latest ? (
            <EmptyState title="Chưa ghi nhận sinh hiệu" description="Hãy thêm bộ sinh hiệu đầu tiên để bắt đầu ghi hồ sơ lâm sàng." />
          ) : (
            <div className="doctor-vitals-grid">
              <div><strong>Temp</strong><span>{latest.temperature || '--'} C</span></div>
              <div><strong>HR</strong><span>{latest.heart_rate || '--'} bpm</span></div>
              <div><strong>Resp</strong><span>{latest.respiratory_rate || '--'} /min</span></div>
              <div><strong>BP</strong><span>{latest.systolic_bp || '--'}/{latest.diastolic_bp || '--'}</span></div>
              <div><strong>SpO2</strong><span>{latest.spo2 || '--'} %</span></div>
              <div><strong>BMI</strong><span>{latest.bmi || '--'}</span></div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Lịch sử sinh hiệu" subtitle="Các lần đo được ghi nhận theo thời gian trong phiên khám.">
          {history.length === 0 ? (
            <EmptyState title="Chưa có lịch sử" description="Lịch sử sinh hiệu sẽ xuất hiện sau lần ghi nhận đầu tiên." />
          ) : (
            <div className="doctor-list-stack">
              {history.map((entry) => (
                <div key={entry.vital_sign_id} className="doctor-list-row">
                  <div>
                    <strong>{formatDateTime(entry.recorded_at)}</strong>
                    <p>Temp {entry.temperature || '--'} C | HR {entry.heart_rate || '--'} bpm | BP {entry.systolic_bp || '--'}/{entry.diastolic_bp || '--'}</p>
                  </div>
                  <button className="doctor-secondary-button" type="button" onClick={() => setEditingId(entry.vital_sign_id)}>
                    Chỉnh sửa
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={editingId ? 'Cập nhật sinh hiệu' : 'Ghi nhận sinh hiệu'} subtitle="BMI được tự động tính từ cân nặng và chiều cao.">
        <div className="doctor-form-grid doctor-form-grid-compact">
          <label><span>Nhiệt độ</span><input type="number" step="0.1" value={form.temperature} onChange={(event) => setForm((current) => ({ ...current, temperature: event.target.value }))} /></label>
          <label><span>Nhịp tim</span><input type="number" value={form.heart_rate} onChange={(event) => setForm((current) => ({ ...current, heart_rate: event.target.value }))} /></label>
          <label><span>Nhịp thở</span><input type="number" value={form.respiratory_rate} onChange={(event) => setForm((current) => ({ ...current, respiratory_rate: event.target.value }))} /></label>
          <label><span>Huyết áp tâm thu</span><input type="number" value={form.systolic_bp} onChange={(event) => setForm((current) => ({ ...current, systolic_bp: event.target.value }))} /></label>
          <label><span>Huyết áp tâm trương</span><input type="number" value={form.diastolic_bp} onChange={(event) => setForm((current) => ({ ...current, diastolic_bp: event.target.value }))} /></label>
          <label><span>SpO2</span><input type="number" value={form.spo2} onChange={(event) => setForm((current) => ({ ...current, spo2: event.target.value }))} /></label>
          <label><span>Cân nặng (kg)</span><input type="number" step="0.1" value={form.weight} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></label>
          <label><span>Chiều cao (cm)</span><input type="number" step="0.1" value={form.height} onChange={(event) => setForm((current) => ({ ...current, height: event.target.value }))} /></label>
          <label><span>Thời gian ghi nhận</span><input type="datetime-local" value={form.recorded_at} onChange={(event) => setForm((current) => ({ ...current, recorded_at: event.target.value }))} /></label>
          <div className="doctor-kpi-tile"><strong>BMI đã tính</strong><span>{bmi || '--'}</span></div>
        </div>
        {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}
        <div className="doctor-inline-actions">
          <button className="doctor-primary-button" type="button" onClick={saveVitals} disabled={saving}>{editingId ? 'Cập nhật sinh hiệu' : 'Lưu sinh hiệu'}</button>
          {editingId ? <button className="doctor-secondary-button" type="button" onClick={() => setEditingId('')}>Hủy chỉnh sửa</button> : null}
        </div>
      </SectionCard>
    </div>
  )
}

export function PrescriptionPanel({ encounterId, patientId, doctorId, onChanged }) {
  const [prescriptionsState, reloadPrescriptions] = useAsyncResource(
    async () => doctorApi.prescriptions.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải đơn thuốc.' },
  )
  const [historyState] = useAsyncResource(
    async () => (patientId ? doctorApi.prescriptions.listByPatient(patientId) : []),
    [patientId],
    [],
    { fallbackMessage: 'Không thể tải lịch sử đơn thuốc của bệnh nhân.' },
  )
  const prescriptions = safeArray(prescriptionsState.data)
  const activePrescription = prescriptions[0] || null
  const prescriptionId = activePrescription?.prescription_id || ''
  const patientHistory = safeArray(historyState.data)
  const [search, setSearch] = useState('')
  const [searchState, setSearchState] = useState({
    loading: false,
    error: '',
    results: [],
  })
  const [selectedMedication, setSelectedMedication] = useState(null)
  const [itemForm, setItemForm] = useState({
    dose: '',
    frequency: '',
    route: 'oral',
    duration_days: '7',
    instructions: '',
  })
  const [note, setNote] = useState('')
  const [feedback, setFeedback] = useState('')
  const [allergyCheck, setAllergyCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!search.trim()) {
      setSearchState({ loading: false, error: '', results: [] })
      return
    }

    let active = true

    const timeoutId = window.setTimeout(async () => {
      setSearchState((current) => ({ ...current, loading: true, error: '' }))
      try {
        const results = await doctorApi.prescriptions.searchMedications(search.trim())
        if (active) {
          setSearchState({ loading: false, error: '', results: safeArray(results) })
        }
      } catch (error) {
        if (active) {
          setSearchState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tìm thuốc.'),
            results: [],
          })
        }
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [search])

  async function ensurePrescription() {
    if (prescriptionId) {
      return prescriptionId
    }

    const created = await doctorApi.prescriptions.create({
      encounter_id: encounterId,
      prescribed_by: doctorId,
      note,
    })

    return created?.prescription_id || created?.prescription?.prescription_id || ''
  }

  async function runAllergyCheck(targetPrescriptionId) {
    if (!targetPrescriptionId || !patientId) {
      setAllergyCheck(null)
      return null
    }

    const result = await doctorApi.prescriptions.checkAllergyConflict({
      prescription_id: targetPrescriptionId,
      patient_id: patientId,
    })
    setAllergyCheck(result)
    return result
  }

  async function handleAddMedication() {
    if (!selectedMedication) {
      setFeedback('Hãy chọn thuốc trước khi thêm vào bản nháp.')
      return
    }
    if (!itemForm.dose.trim() || !itemForm.frequency.trim() || !itemForm.duration_days.trim()) {
      setFeedback('Liều dùng, tần suất và thời gian dùng là bắt buộc.')
      return
    }

    setBusy(true)
    setFeedback('')
    try {
      const targetPrescriptionId = await ensurePrescription()
      await doctorApi.prescriptions.addItem({
        prescription_id: targetPrescriptionId,
        medication_id: selectedMedication.medication_id || selectedMedication.id,
        dose: itemForm.dose,
        frequency: itemForm.frequency,
        route: itemForm.route,
        duration_days: Number(itemForm.duration_days),
        instructions: itemForm.instructions,
      })

      await runAllergyCheck(targetPrescriptionId)
      reloadPrescriptions()
      onChanged()
      setSelectedMedication(null)
      setSearch('')
      setItemForm({
        dose: '',
        frequency: '',
        route: 'oral',
        duration_days: '7',
        instructions: '',
      })
      setFeedback('Đã thêm thuốc vào bản nháp đơn thuốc.')
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể thêm thuốc vào đơn.'))
    } finally {
      setBusy(false)
    }
  }

  async function commitPrescriptionAction(action) {
    setBusy(true)
    setFeedback('')
    try {
      if (action === 'activate') {
        const targetPrescriptionId = await ensurePrescription()
        const conflict = await runAllergyCheck(targetPrescriptionId)
        if (conflict?.has_conflict) {
          setFeedback('Hãy xử lý cảnh báo xung đột dị ứng trước khi kích hoạt đơn thuốc.')
          setDialog(null)
          return
        }
        await doctorApi.prescriptions.activate(targetPrescriptionId)
      }
      if (action === 'cancel' && prescriptionId) {
        await doctorApi.prescriptions.cancel(prescriptionId)
      }
      if (action === 'duplicate' && prescriptionId) {
        await doctorApi.prescriptions.duplicate(prescriptionId)
      }

      reloadPrescriptions()
      onChanged()
      setDialog(null)
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể cập nhật đơn thuốc.'))
    } finally {
      setBusy(false)
    }
  }

  const prescriptionItems = safeArray(activePrescription?.items)

  return (
    <div className="doctor-two-column">
      <div className="doctor-panel-stack">
        <SectionCard title="Tìm kiếm thuốc" subtitle="Tìm trong danh mục thuốc và thêm thuốc vào bản nháp hiện tại.">
          <div className="doctor-search-form">
            <label className="doctor-search-input">
              <span>Từ khóa thuốc</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên thuốc hoặc mã thuốc" />
            </label>
            <label>
              <span>Ghi chú đơn thuốc</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú tùy chọn cho đơn thuốc này" />
            </label>
          </div>
          {searchState.loading ? <LoadingState label="Đang tìm thuốc..." /> : null}
          {searchState.error ? <ErrorState title="Tìm thuốc thất bại" message={searchState.error} /> : null}

          {searchState.results.length > 0 ? (
            <div className="doctor-list-stack">
              {searchState.results.map((item) => {
                const medicationId = item.medication_id || item.id
                const isSelected = (selectedMedication?.medication_id || selectedMedication?.id) === medicationId
                return (
                  <button key={medicationId} className={`doctor-list-row doctor-list-select${isSelected ? ' is-selected' : ''}`} type="button" onClick={() => setSelectedMedication(item)}>
                    <div>
                      <strong>{item.generic_name || item.brand_name || item.name || medicationId}</strong>
                      <p>{item.strength || item.form || item.category || 'Mục trong danh mục thuốc'}</p>
                    </div>
                    <span>{isSelected ? 'Đã chọn' : 'Chọn'}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Bản nháp đơn thuốc hiện tại" subtitle="Xem lại các thuốc đã thêm và trạng thái sẵn sàng kích hoạt.">
          {!activePrescription ? (
            <EmptyState title="Chưa có bản nháp đơn thuốc" description="Hãy tạo bản nháp bằng cách thêm thuốc đầu tiên cho phiên khám này." />
          ) : (
            <>
              <div className="doctor-inline-actions">
                {activePrescription.status ? (
                  <StatusBadge status={activePrescription.status} />
                ) : (
                  <span className="doctor-muted-text">--</span>
                )}
                <span className="doctor-muted-text">{activePrescription.prescription_no || activePrescription.prescription_id}</span>
              </div>
              {prescriptionItems.length === 0 ? (
                <EmptyState title="Bản nháp đang trống" description="Hãy tìm và thêm thuốc để tạo đơn." />
              ) : (
                <div className="doctor-table-wrap">
                  <table className="doctor-table">
                    <thead>
                      <tr>
                        <th>Thuốc</th>
                        <th>Liều dùng</th>
                        <th>Tần suất</th>
                        <th>Đường dùng</th>
                        <th>Thời lượng</th>
                        <th>Hướng dẫn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescriptionItems.map((item) => (
                        <tr key={item.prescription_item_id || item.id}>
                          <td>{item.medication_name || item.generic_name || item.medication_id}</td>
                          <td>{item.dose || '--'}</td>
                          <td>{item.frequency || '--'}</td>
                          <td>{item.route || '--'}</td>
                          <td>{item.duration_days ? `${item.duration_days} ngày` : '--'}</td>
                          <td>{item.instructions || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {allergyCheck?.has_conflict ? (
            <div className="doctor-alert-card doctor-alert-danger">
              <div className="doctor-alert-head">
                <StatusBadge status="cancelled" />
                <strong>Cảnh báo xung đột dị ứng</strong>
              </div>
              <p>{allergyCheck.message || 'Phát hiện nguy cơ tương tác dị ứng.'}</p>
            </div>
          ) : null}

          {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}
          <div className="doctor-inline-actions doctor-inline-actions-wrap">
            <button className="doctor-primary-button" type="button" onClick={() => setDialog({ action: 'activate' })} disabled={busy}>
              Kích hoạt đơn thuốc
            </button>
            <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'duplicate' })} disabled={busy || !prescriptionId}>
              Nhân bản
            </button>
            <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'cancel' })} disabled={busy || !prescriptionId}>
              Hủy đơn thuốc
            </button>
          </div>
        </SectionCard>
      </div>

      <div className="doctor-panel-stack">
        <SectionCard title="Thêm thuốc vào đơn" subtitle="Hoàn thiện liều dùng và hướng dẫn trước khi lưu.">
          {selectedMedication ? (
            <div className="doctor-selected-card">
              <strong>{selectedMedication.generic_name || selectedMedication.brand_name || selectedMedication.name}</strong>
              <p>{selectedMedication.strength || selectedMedication.form || 'Thuốc đã được chọn từ kết quả tìm kiếm.'}</p>
            </div>
          ) : (
            <div className="doctor-muted-card">
              Hãy chọn thuốc từ kết quả tìm kiếm để nhập chi tiết liều dùng.
            </div>
          )}

          <div className="doctor-form-grid doctor-form-grid-compact">
            <label><span>Liều dùng</span><input value={itemForm.dose} onChange={(event) => setItemForm((current) => ({ ...current, dose: event.target.value }))} placeholder="ví dụ: 500 mg" /></label>
            <label><span>Tần suất</span><input value={itemForm.frequency} onChange={(event) => setItemForm((current) => ({ ...current, frequency: event.target.value }))} placeholder="ví dụ: ngày 2 lần" /></label>
            <label><span>Đường dùng</span><input value={itemForm.route} onChange={(event) => setItemForm((current) => ({ ...current, route: event.target.value }))} placeholder="ví dụ: uống" /></label>
            <label><span>Số ngày dùng</span><input type="number" value={itemForm.duration_days} onChange={(event) => setItemForm((current) => ({ ...current, duration_days: event.target.value }))} /></label>
            <label><span>Hướng dẫn</span><textarea value={itemForm.instructions} onChange={(event) => setItemForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Hướng dẫn sử dụng" /></label>
          </div>

          <div className="doctor-inline-actions">
            <button className="doctor-primary-button" type="button" onClick={handleAddMedication} disabled={busy}>
              Thêm thuốc
            </button>
            <button className="doctor-secondary-button" type="button" onClick={() => prescriptionId && runAllergyCheck(prescriptionId)} disabled={busy || !prescriptionId}>
              Kiểm tra dị ứng
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Lịch sử đơn thuốc" subtitle="Các đơn thuốc gần đây của bệnh nhân này.">
          {patientHistory.length === 0 ? (
            <EmptyState title="Không tìm thấy lịch sử" description="Chưa có lịch sử đơn thuốc của bệnh nhân." />
          ) : (
            <div className="doctor-list-stack">
              {patientHistory.slice(0, 4).map((item) => (
                <div key={item.prescription_id || item.id} className="doctor-list-row">
                  <div>
                    <strong>{item.prescription_no || item.prescription_id || item.id}</strong>
                    <p>{item.note || '--'}</p>
                  </div>
                  {item.status ? <StatusBadge status={item.status} /> : <span className="doctor-muted-text">--</span>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title={
          dialog?.action === 'activate'
            ? 'Kích hoạt đơn thuốc?'
            : dialog?.action === 'duplicate'
              ? 'Nhân bản đơn thuốc?'
              : 'Hủy đơn thuốc?'
        }
        description={
          dialog?.action === 'activate'
            ? 'Bản nháp sẽ được kiểm tra xung đột dị ứng trước khi kích hoạt.'
            : dialog?.action === 'duplicate'
              ? 'Thao tác này sẽ tạo bản nháp mới dựa trên đơn thuốc hiện tại.'
              : 'Thao tác này sẽ đánh dấu đơn thuốc hiện tại là đã hủy.'
        }
        confirmLabel={
          dialog?.action === 'activate' ? 'Kích hoạt đơn thuốc' : dialog?.action === 'duplicate' ? 'Nhân bản đơn thuốc' : 'Hủy đơn thuốc'
        }
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitPrescriptionAction(dialog?.action)}
      />
    </div>
  )
}

export function ClinicalNotesPanel({ encounterId, doctorId, onChanged }) {
  const [notesState, reloadNotes] = useAsyncResource(
    async () => doctorApi.notes.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải ghi chú lâm sàng.' },
  )
  const notes = safeArray(notesState.data)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [dialog, setDialog] = useState(null)

  async function handleCreateNote() {
    if (!noteText.trim()) {
      setFeedback('Nội dung ghi chú lâm sàng là bắt buộc.')
      return
    }

    setSaving(true)
    setFeedback('')
    try {
      await doctorApi.notes.create({
        encounter_id: encounterId,
        doctor_id: doctorId,
        note_text: noteText.trim(),
      })
      setNoteText('')
      reloadNotes()
      onChanged()
      setFeedback('Đã lưu ghi chú lâm sàng.')
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể tạo ghi chú lâm sàng.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSign(noteId) {
    setSaving(true)
    setFeedback('')
    try {
      await doctorApi.notes.sign(noteId)
      reloadNotes()
      onChanged()
      setDialog(null)
      setFeedback('Đã ký ghi chú lâm sàng.')
    } catch (error) {
      setFeedback(getApiErrorMessage(error, 'Không thể ký ghi chú lâm sàng.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="doctor-two-column">
      <SectionCard title="Ghi chú lâm sàng" subtitle="Các ghi chú bổ sung và ngữ cảnh lâm sàng.">
        {notesState.loading ? <LoadingState label="Đang tải ghi chú..." /> : null}
        {notesState.error && !notesState.loading ? (
          <ErrorState title="Không thể tải ghi chú" message={notesState.error} onRetry={reloadNotes} />
        ) : null}
        {!notesState.loading && !notesState.error && notes.length === 0 ? (
          <EmptyState title="Chưa có ghi chú lâm sàng" description="Ghi nhận thêm quan sát lâm sàng cho phiên khám này." />
        ) : null}
        {notes.length > 0 ? (
          <div className="doctor-list-stack">
            {notes.map((note) => (
              <div key={note.note_id} className="doctor-list-row">
                <div>
                  <strong>{note.author_name || note.created_by_name || 'Ghi chú lâm sàng'}</strong>
                  <p>{note.note_text || '--'}</p>
                  <span className="doctor-muted-text">{formatDateTime(note.created_at)}</span>
                </div>
                <div className="doctor-inline-actions">
                  {note.status ? <StatusBadge status={note.status} /> : <span className="doctor-muted-text">--</span>}
                  {note.status !== 'signed' ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ id: note.note_id })} disabled={saving}>
                      Ký
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Tạo ghi chú lâm sàng" subtitle="Ghi chú ngắn cho ngữ cảnh phiên khám hoặc bàn giao.">
        <label className="doctor-note-field">
          <span>Nội dung ghi chú</span>
          <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Nhập quan sát lâm sàng, ghi chú bàn giao hoặc ngữ cảnh tái khám" />
        </label>
        {feedback ? <div className="doctor-inline-feedback">{feedback}</div> : null}
        <div className="doctor-inline-actions">
          <button className="doctor-primary-button" type="button" onClick={handleCreateNote} disabled={saving}>
            Lưu ghi chú
          </button>
        </div>
      </SectionCard>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title="Ký ghi chú lâm sàng?"
        description="Thao tác này xác nhận ghi chú là hồ sơ lâm sàng đã ký."
        confirmLabel="Ký ghi chú"
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => handleSign(dialog?.id)}
      />
    </div>
  )
}

