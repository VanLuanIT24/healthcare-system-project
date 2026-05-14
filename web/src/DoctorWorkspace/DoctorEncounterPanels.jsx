import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../utils/api'
import { calculateBmi, formatDateTime, safeArray } from './doctorData'
import { doctorApi } from './doctorApi'
import { toDateTimeInputValue, useAsyncResource } from './DoctorHooks'
import { useToast } from './toast/ToastProvider'
import { handleDoctorApiError, notifyDoctorSuccess, showDoctorToast } from './doctorFeedback'
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

function isFinalStatus(status) {
  return ['signed', 'completed', 'cancelled', 'stopped', 'entered_in_error'].includes(String(status || '').toLowerCase())
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

export function ConsultationPanel({ encounterId, doctorId, readOnly = false, onChanged }) {
  const toast = useToast()
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

    try {
      if (selectedId) {
        await doctorApi.consultations.update(selectedId, form)
        reloadConsultations()
        onChanged()
        notifyDoctorSuccess(toast, 'Đã lưu bản nháp phiếu khám.', 'Phiếu khám đã cập nhật')
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
        notifyDoctorSuccess(toast, 'Đã tạo và lưu bản nháp phiếu khám.', 'Phiếu khám đã cập nhật')
        return nextId
      }
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể lưu phiếu khám.', { permission: 'consultations.write' })
      return ''
    } finally {
      setSaving(false)
    }
  }

  async function commitConsultationAction(action) {
    if (action === 'sign' && signBlocked) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Chưa đủ nội dung',
        message: 'Cần có đánh giá hoặc kế hoạch điều trị trước khi ký.',
      })
      setDialog(null)
      return
    }

    let targetId = selectedId
    if (!targetId) {
      targetId = await saveConsultation()
    }

    if (!targetId) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Chưa có bản nháp',
        message: 'Hãy lưu bản nháp phiếu khám trước khi tiếp tục.',
      })
      setDialog(null)
      return
    }

    setSaving(true)

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
      if (action === 'cancel') {
        await doctorApi.consultations.cancel(targetId)
      }

      reloadConsultations()
      onChanged?.()
      setDialog(null)
      const actionLabels = {
        start: 'Đã bắt đầu phiếu khám.',
        sign: 'Đã ký phiếu khám.',
        amend: 'Đã bổ sung phiếu khám.',
        cancel: 'Đã hủy mềm phiếu khám.',
      }
      notifyDoctorSuccess(toast, actionLabels[action] || 'Đã cập nhật phiếu khám.', 'Phiếu khám đã cập nhật')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể cập nhật phiếu khám.', { permission: 'consultations.write' })
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
              <textarea value={form.chief_complaint} onChange={(event) => setForm((current) => ({ ...current, chief_complaint: event.target.value }))} disabled={readOnly} placeholder="Mô tả ngắn lý do chính khiến bệnh nhân đến khám..." />
            </label>

            <div className="doctor-form-grid">
              <label className="doctor-section-field">
                <span>Bệnh sử hiện tại</span>
                <textarea value={form.history_present_illness} onChange={(event) => setForm((current) => ({ ...current, history_present_illness: event.target.value }))} disabled={readOnly} placeholder="Mô tả chi tiết diễn tiến triệu chứng theo thời gian..." />
              </label>

              <label className="doctor-section-field">
                <span>Khám thực thể</span>
                <textarea value={form.physical_exam} onChange={(event) => setForm((current) => ({ ...current, physical_exam: event.target.value }))} disabled={readOnly} placeholder="Kết quả khám lâm sàng..." />
              </label>
            </div>

            <label className="doctor-section-field">
              <span>Đánh giá</span>
              <textarea value={form.assessment} onChange={(event) => setForm((current) => ({ ...current, assessment: event.target.value }))} disabled={readOnly} placeholder="Nhận định chẩn đoán và tóm tắt..." />
            </label>

            <label className="doctor-section-field">
              <span>Kế hoạch điều trị</span>
              <textarea value={form.plan} onChange={(event) => setForm((current) => ({ ...current, plan: event.target.value }))} disabled={readOnly} placeholder="Kế hoạch xử trí, kê đơn và tái khám..." />
            </label>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Điều khiển phiên khám" subtitle="Lưu, ký và bổ sung với kiểm tra an toàn từ backend.">
        <div className="doctor-panel-stack">
          <div className="doctor-kpi-tile">
            <strong>{signBlocked ? 'Cần có đánh giá hoặc kế hoạch' : 'Sẵn sàng ký'}</strong>
            <span>{signBlocked ? 'Việc ký bị chặn cho đến khi nội dung lâm sàng đầy đủ.' : 'Phiếu khám có thể được ký.'}</span>
          </div>
          <button className="doctor-secondary-button" type="button" onClick={saveConsultation} disabled={saving || readOnly}>
            Lưu nháp
          </button>
          <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'start' })} disabled={saving || readOnly || !selectedId || currentConsultation?.status !== 'draft'}>
            Bắt đầu phiếu khám
          </button>
          <button className="doctor-primary-button" type="button" onClick={() => setDialog({ action: 'sign' })} disabled={saving || readOnly || signBlocked || currentConsultation?.status === 'cancelled'}>
            Ký và đóng
          </button>
          <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'amend' })} disabled={saving || readOnly || !selectedId || currentConsultation?.status !== 'signed'}>
            Bổ sung phiếu khám
          </button>
          <button className="doctor-secondary-button doctor-button-danger-soft" type="button" onClick={() => setDialog({ action: 'cancel' })} disabled={saving || readOnly || !selectedId || !['draft', 'in_progress'].includes(currentConsultation?.status)}>
            Hủy phiếu khám
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
              : dialog?.action === 'cancel'
                ? 'Hủy phiếu khám?'
              : 'Bắt đầu phiếu khám?'
        }
        description={
          dialog?.action === 'sign'
            ? 'Việc ký sẽ khóa hồ sơ lâm sàng của phiếu khám này cho đến khi được bổ sung.'
            : dialog?.action === 'amend'
              ? 'Thao tác này sẽ đánh dấu phiếu khám hiện tại là đã bổ sung với nội dung biểu mẫu hiện có.'
              : dialog?.action === 'cancel'
                ? 'Thao tác này hủy mềm phiếu khám theo lifecycle backend.'
              : 'Thao tác này sẽ đánh dấu phiếu khám là đã bắt đầu cho phiên khám đang hoạt động.'
        }
        confirmLabel={
          dialog?.action === 'sign' ? 'Ký phiếu khám' : dialog?.action === 'amend' ? 'Bổ sung phiếu khám' : dialog?.action === 'cancel' ? 'Hủy phiếu khám' : 'Bắt đầu phiếu khám'
        }
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitConsultationAction(dialog?.action)}
      />
    </div>
  )
}

export function DiagnosisPanel({ encounterId, readOnly = false, onChanged }) {
  const toast = useToast()
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
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Thiếu dữ liệu bắt buộc',
        message: 'Mã ICD-10, tên chẩn đoán và loại chẩn đoán là bắt buộc.',
      })
      return
    }
    if (form.onset_date && new Date(form.onset_date).getTime() > Date.now()) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Ngày không hợp lệ',
        message: 'Ngày khởi phát không được ở tương lai.',
      })
      return
    }

    setSaving(true)

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
      notifyDoctorSuccess(toast, 'Đã lưu chẩn đoán.', 'Chẩn đoán đã cập nhật')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể lưu chẩn đoán.', { permission: 'diagnoses.write' })
    } finally {
      setSaving(false)
    }
  }

  async function commitDiagnosisAction(action, diagnosisId) {
    setSaving(true)
    try {
      if (action === 'primary') {
        await doctorApi.diagnoses.setPrimary(diagnosisId)
      }
      if (action === 'resolve') {
        await doctorApi.diagnoses.resolve(diagnosisId)
      }
      if (action === 'remove') {
        await doctorApi.diagnoses.remove(diagnosisId)
      }

      setEditingId('')
      reloadDiagnoses()
      onChanged?.()
      setDialog(null)
      notifyDoctorSuccess(toast, 'Đã cập nhật trạng thái chẩn đoán.', 'Chẩn đoán đã cập nhật')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể cập nhật chẩn đoán.', { permission: 'diagnoses.write' })
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
                  <button className="doctor-secondary-button" type="button" onClick={() => setEditingId(diagnosis.diagnosis_id)} disabled={readOnly || saving}>
                    Chỉnh sửa
                  </button>
                  {!diagnosis.is_primary ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'primary', id: diagnosis.diagnosis_id })} disabled={readOnly || saving}>
                      Đặt chẩn đoán chính
                    </button>
                  ) : null}
                  {diagnosis.status !== 'resolved' ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'resolve', id: diagnosis.diagnosis_id })} disabled={readOnly || saving}>
                      Đánh dấu đã giải quyết
                    </button>
                  ) : null}
                  {diagnosis.status !== 'entered_in_error' ? (
                    <button className="doctor-secondary-button doctor-button-danger-soft" type="button" onClick={() => setDialog({ action: 'remove', id: diagnosis.diagnosis_id })} disabled={readOnly || saving}>
                      Gỡ mềm
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
          <label><span>Mã ICD-10</span><input value={form.icd10_code} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, icd10_code: event.target.value }))} /></label>
          <label><span>Tên chẩn đoán</span><input value={form.diagnosis_name} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, diagnosis_name: event.target.value }))} /></label>
          <label><span>Loại chẩn đoán</span><select value={form.diagnosis_type} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, diagnosis_type: event.target.value }))}><option value="provisional">Tạm thời</option><option value="confirmed">Xác định</option><option value="discharge">Ra viện</option><option value="secondary">Thứ phát</option></select></label>
          <label><span>Ngày khởi phát</span><input type="date" value={form.onset_date} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, onset_date: event.target.value }))} /></label>
          <label className="doctor-checkbox-field"><input type="checkbox" checked={form.is_primary} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, is_primary: event.target.checked }))} /><span>Đặt làm chẩn đoán chính</span></label>
          <label><span>Ghi chú</span><textarea value={form.notes} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
        </div>
        <div className="doctor-inline-actions">
          <button className="doctor-primary-button" type="button" onClick={saveDiagnosis} disabled={saving || readOnly}>{editingId ? 'Cập nhật chẩn đoán' : 'Thêm chẩn đoán'}</button>
          {editingId ? <button className="doctor-secondary-button" type="button" onClick={() => setEditingId('')}>Hủy</button> : null}
        </div>
      </SectionCard>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title={dialog?.action === 'resolve' ? 'Đánh dấu chẩn đoán đã giải quyết?' : dialog?.action === 'remove' ? 'Gỡ mềm chẩn đoán?' : 'Đặt chẩn đoán chính?'}
        description={
          dialog?.action === 'resolve'
            ? 'Thao tác này sẽ đánh dấu chẩn đoán đã chọn là đã giải quyết.'
            : dialog?.action === 'remove'
              ? 'Backend sẽ chuyển chẩn đoán sang entered_in_error thay vì xóa vật lý.'
            : 'Thao tác này sẽ đặt chẩn đoán đã chọn làm chẩn đoán chính cho phiên khám.'
        }
        confirmLabel={dialog?.action === 'resolve' ? 'Đánh dấu đã giải quyết' : dialog?.action === 'remove' ? 'Gỡ mềm' : 'Đặt chẩn đoán chính'}
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitDiagnosisAction(dialog?.action, dialog?.id)}
      />
    </div>
  )
}

export function VitalSignsPanel({ encounterId, readOnly = false, onChanged }) {
  const toast = useToast()
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
  const [dialog, setDialog] = useState(null)

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
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Sinh hiệu chưa hợp lệ',
        message: errors[0],
      })
      return
    }

    setSaving(true)

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
      notifyDoctorSuccess(toast, 'Đã lưu sinh hiệu.', 'Sinh hiệu đã cập nhật')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể lưu sinh hiệu.', { permission: 'vitals.write' })
    } finally {
      setSaving(false)
    }
  }

  async function removeVitals(vitalSignId) {
    if (!vitalSignId) {
      return
    }

    setSaving(true)
    try {
      await doctorApi.vitals.remove(vitalSignId)
      if (editingId === vitalSignId) {
        setEditingId('')
      }
      reloadHistory()
      reloadLatest()
      onChanged?.()
      setDialog(null)
      notifyDoctorSuccess(toast, 'Đã gỡ mềm sinh hiệu.', 'Sinh hiệu đã cập nhật')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể gỡ sinh hiệu.', { permission: 'vitals.write' })
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
                  <div className="doctor-inline-actions">
                    <button className="doctor-secondary-button" type="button" onClick={() => setEditingId(entry.vital_sign_id)} disabled={readOnly || saving}>
                      Chỉnh sửa
                    </button>
                    {entry.status !== 'entered_in_error' ? (
                      <button className="doctor-secondary-button doctor-button-danger-soft" type="button" onClick={() => setDialog({ id: entry.vital_sign_id })} disabled={readOnly || saving}>
                        Gỡ mềm
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title={editingId ? 'Cập nhật sinh hiệu' : 'Ghi nhận sinh hiệu'} subtitle="BMI được tự động tính từ cân nặng và chiều cao.">
        <div className="doctor-form-grid doctor-form-grid-compact">
          <label><span>Nhiệt độ</span><input type="number" step="0.1" value={form.temperature} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, temperature: event.target.value }))} /></label>
          <label><span>Nhịp tim</span><input type="number" value={form.heart_rate} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, heart_rate: event.target.value }))} /></label>
          <label><span>Nhịp thở</span><input type="number" value={form.respiratory_rate} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, respiratory_rate: event.target.value }))} /></label>
          <label><span>Huyết áp tâm thu</span><input type="number" value={form.systolic_bp} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, systolic_bp: event.target.value }))} /></label>
          <label><span>Huyết áp tâm trương</span><input type="number" value={form.diastolic_bp} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, diastolic_bp: event.target.value }))} /></label>
          <label><span>SpO2</span><input type="number" value={form.spo2} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, spo2: event.target.value }))} /></label>
          <label><span>Cân nặng (kg)</span><input type="number" step="0.1" value={form.weight} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, weight: event.target.value }))} /></label>
          <label><span>Chiều cao (cm)</span><input type="number" step="0.1" value={form.height} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, height: event.target.value }))} /></label>
          <label><span>Thời gian ghi nhận</span><input type="datetime-local" value={form.recorded_at} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, recorded_at: event.target.value }))} /></label>
          <div className="doctor-kpi-tile"><strong>BMI đã tính</strong><span>{bmi || '--'}</span></div>
        </div>
        <div className="doctor-inline-actions">
          <button className="doctor-primary-button" type="button" onClick={saveVitals} disabled={saving || readOnly}>{editingId ? 'Cập nhật sinh hiệu' : 'Lưu sinh hiệu'}</button>
          {editingId ? <button className="doctor-secondary-button" type="button" onClick={() => setEditingId('')}>Hủy chỉnh sửa</button> : null}
        </div>
      </SectionCard>
      <ConfirmActionDialog
        open={Boolean(dialog)}
        title="Gỡ mềm sinh hiệu?"
        description="Backend sẽ đánh dấu bản ghi sinh hiệu là entered_in_error thay vì xóa vật lý."
        confirmLabel="Gỡ mềm"
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => removeVitals(dialog?.id)}
      />
    </div>
  )
}

export function PrescriptionPanel({ encounterId, patientId, doctorId, readOnly = false, onChanged }) {
  const toast = useToast()
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
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState('')
  const activePrescription =
    prescriptions.find((item) => (item.prescription_id || item.id) === selectedPrescriptionId) ||
    prescriptions.find((item) => item.status === 'draft') ||
    prescriptions.find((item) => item.status === 'active') ||
    prescriptions[0] ||
    null
  const prescriptionId = activePrescription?.prescription_id || ''
  const patientHistory = safeArray(historyState.data)
  const [itemsState, reloadItems] = useAsyncResource(
    async () => (prescriptionId ? doctorApi.prescriptions.listItems(prescriptionId) : []),
    [prescriptionId],
    [],
    { fallbackMessage: 'Không thể tải danh sách thuốc trong đơn.' },
  )
  const [summaryState, reloadSummary] = useAsyncResource(
    async () => (prescriptionId ? doctorApi.prescriptions.getSummary(prescriptionId) : null),
    [prescriptionId],
    null,
    { fallbackMessage: 'Không thể tải tóm tắt đơn thuốc.' },
  )
  const [search, setSearch] = useState('')
  const [searchState, setSearchState] = useState({
    loading: false,
    error: '',
    results: [],
    pagination: null,
    query: '',
  })
  const [selectedMedication, setSelectedMedication] = useState(null)
  const [editingItemId, setEditingItemId] = useState('')
  const [itemForm, setItemForm] = useState({
    dose: '',
    frequency: '',
    route: 'oral',
    duration_days: '7',
    instructions: '',
  })
  const [note, setNote] = useState('')
  const [allergyCheck, setAllergyCheck] = useState(null)
  const [interactionCheck, setInteractionCheck] = useState(null)
  const [duplicateCheck, setDuplicateCheck] = useState(null)
  const [quantityCheck, setQuantityCheck] = useState(null)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!prescriptions.length) {
      if (selectedPrescriptionId) {
        setSelectedPrescriptionId('')
      }
      return
    }

    const hasSelected = prescriptions.some((item) => (item.prescription_id || item.id) === selectedPrescriptionId)
    if (!hasSelected) {
      const preferred =
        prescriptions.find((item) => item.status === 'draft') ||
        prescriptions.find((item) => item.status === 'active') ||
        prescriptions[0]
      setSelectedPrescriptionId(preferred?.prescription_id || preferred?.id || '')
    }
  }, [prescriptions, selectedPrescriptionId])

  useEffect(() => {
    if (activePrescription) {
      setNote(activePrescription.note || '')
    }
    setAllergyCheck(null)
    setInteractionCheck(null)
    setDuplicateCheck(null)
    setQuantityCheck(null)
    setEditingItemId('')
  }, [prescriptionId])

  useEffect(() => {
    if (!search.trim()) {
      setSearchState({ loading: false, error: '', results: [], pagination: null, query: '' })
      return
    }

    let active = true

    const timeoutId = window.setTimeout(async () => {
      setSearchState((current) => ({ ...current, loading: true, error: '' }))
      try {
        const result = await doctorApi.prescriptions.searchMedicationsPage(search.trim(), { page: 1, limit: 25 })
        if (active) {
          setSearchState({
            loading: false,
            error: '',
            results: safeArray(result?.items),
            pagination: result?.pagination || null,
            query: search.trim(),
          })
        }
      } catch (error) {
        if (active) {
          setSearchState({
            loading: false,
            error: getApiErrorMessage(error, 'Không thể tìm thuốc.'),
            results: [],
            pagination: null,
            query: search.trim(),
          })
        }
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [search])

  async function loadMoreMedications() {
    const pagination = searchState.pagination
    if (!searchState.query || !pagination || pagination.page >= pagination.total_pages) {
      return
    }

    setSearchState((current) => ({ ...current, loading: true, error: '' }))
    try {
      const result = await doctorApi.prescriptions.searchMedicationsPage(searchState.query, {
        page: Number(pagination.page || 1) + 1,
        limit: Number(pagination.limit || 25),
      })
      setSearchState((current) => ({
        loading: false,
        error: '',
        results: Array.from(
          new Map(
            [...safeArray(current.results), ...safeArray(result?.items)].map((item) => [
              item.medication_id || item.id || `${item.generic_name}-${item.strength}`,
              item,
            ]),
          ).values(),
        ),
        pagination: result?.pagination || current.pagination,
        query: current.query,
      }))
    } catch (error) {
      setSearchState((current) => ({
        ...current,
        loading: false,
        error: getApiErrorMessage(error, 'Không thể tải thêm thuốc.'),
      }))
    }
  }

  async function ensurePrescription() {
    if (prescriptionId) {
      return prescriptionId
    }

    const created = await doctorApi.prescriptions.create({
      encounter_id: encounterId,
      prescribed_by: doctorId,
      note,
    })

    const createdId = created?.prescription_id || created?.prescription?.prescription_id || ''
    if (createdId) {
      setSelectedPrescriptionId(createdId)
      reloadPrescriptions()
    }
    return createdId
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

  async function runPrescriptionSafetyChecks(targetPrescriptionId, medicationId, excludeItemId = null) {
    const basePayload = {
      prescription_id: targetPrescriptionId,
      medication_id: medicationId,
      exclude_item_id: excludeItemId || undefined,
      dose: itemForm.dose,
      frequency: itemForm.frequency,
      route: itemForm.route,
      duration_days: Number(itemForm.duration_days),
      instructions: itemForm.instructions,
    }

    const [duplicate, interaction, quantity] = await Promise.all([
      doctorApi.prescriptions.checkDuplicateMedication(basePayload),
      doctorApi.prescriptions.checkInteractionConflict(basePayload),
      doctorApi.prescriptions.calculateItemQuantity(basePayload),
    ])

    setDuplicateCheck(duplicate)
    setInteractionCheck(interaction)
    setQuantityCheck(quantity)

    return { duplicate, interaction, quantity }
  }

  function resetMedicationForm() {
    setSelectedMedication(null)
    setEditingItemId('')
    setSearch('')
    setItemForm({
      dose: '',
      frequency: '',
      route: 'oral',
      duration_days: '7',
      instructions: '',
    })
  }

  function editPrescriptionItem(item) {
    setEditingItemId(item.prescription_item_id || item.id || '')
    setSelectedMedication({
      medication_id: item.medication_id,
      generic_name: item.medication_name || item.generic_name || item.drug_name || item.medication_id,
      strength: item.strength || '',
    })
    setItemForm({
      dose: item.dose || '',
      frequency: item.frequency || '',
      route: item.route || 'oral',
      duration_days: item.duration_days ? String(item.duration_days) : '7',
      instructions: item.instructions || '',
    })
  }

  async function handleAddMedication() {
    if (!selectedMedication) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Chưa chọn thuốc',
        message: 'Hãy chọn thuốc trước khi thêm vào bản nháp.',
      })
      return
    }
    if (!itemForm.dose.trim() || !itemForm.frequency.trim() || !itemForm.duration_days.trim()) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Thiếu thông tin kê đơn',
        message: 'Liều dùng, tần suất và thời gian dùng là bắt buộc.',
      })
      return
    }

    setBusy(true)
    try {
      const targetPrescriptionId = await ensurePrescription()
      const medicationId = selectedMedication.medication_id || selectedMedication.id
      const safety = await runPrescriptionSafetyChecks(targetPrescriptionId, medicationId, editingItemId)
      if (safety.duplicate?.has_duplicate) {
        showDoctorToast(toast, {
          type: 'warning',
          title: 'Thuốc đã tồn tại',
          message: 'Backend phát hiện thuốc đã tồn tại trong đơn. Hãy sửa item hiện có hoặc chọn thuốc khác.',
        })
        return
      }

      const quantity = safety.quantity?.quantity
      const payload = {
        prescription_id: targetPrescriptionId,
        medication_id: medicationId,
        dose: itemForm.dose,
        frequency: itemForm.frequency,
        route: itemForm.route,
        duration_days: Number(itemForm.duration_days),
        quantity: quantity !== undefined ? Number(quantity) : undefined,
        instructions: itemForm.instructions,
      }

      if (editingItemId) {
        await doctorApi.prescriptions.updateItem(editingItemId, payload)
      } else {
        await doctorApi.prescriptions.addItem(payload)
      }

      await runAllergyCheck(targetPrescriptionId)
      reloadPrescriptions()
      reloadItems()
      reloadSummary()
      onChanged?.()
      resetMedicationForm()
      notifyDoctorSuccess(
        toast,
        editingItemId ? 'Đã cập nhật thuốc trong đơn.' : 'Đã thêm thuốc vào bản nháp đơn thuốc.',
        'Đơn thuốc đã cập nhật',
      )
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể thêm thuốc vào đơn.', { permission: 'prescriptions.write' })
    } finally {
      setBusy(false)
    }
  }

  async function commitPrescriptionAction(action) {
    setBusy(true)
    try {
      if (action === 'activate') {
        if (activePrescription?.status !== 'draft') {
          showDoctorToast(toast, {
            type: 'warning',
            title: 'Chưa thể kích hoạt',
            message: 'Backend chỉ cho activate prescription ở trạng thái draft.',
          })
          setDialog(null)
          return
        }
        if (prescriptionItems.length === 0) {
          showDoctorToast(toast, {
            type: 'warning',
            title: 'Chưa thể kích hoạt',
            message: 'Prescription phải có ít nhất một item trước khi activate.',
          })
          setDialog(null)
          return
        }
        const targetPrescriptionId = await ensurePrescription()
        const [allergyConflict, interactionConflict] = await Promise.all([
          runAllergyCheck(targetPrescriptionId),
          doctorApi.prescriptions.checkInteractionConflict({ prescription_id: targetPrescriptionId, patient_id: patientId }),
        ])
        setInteractionCheck(interactionConflict)
        if (allergyConflict?.has_conflict || interactionConflict?.has_conflict) {
          showDoctorToast(toast, {
            type: 'warning',
            title: 'Cần xử lý cảnh báo an toàn',
            message: 'Hãy xử lý cảnh báo dị ứng hoặc tương tác thuốc trước khi kích hoạt đơn thuốc.',
          })
          setDialog(null)
          return
        }
        await doctorApi.prescriptions.activate(targetPrescriptionId)
      }
      if (action === 'cancel' && prescriptionId) {
        await doctorApi.prescriptions.cancel(prescriptionId)
      }
      if (action === 'duplicate' && prescriptionId) {
        const duplicated = await doctorApi.prescriptions.duplicate(prescriptionId)
        const nextId = duplicated?.prescription_id || duplicated?.prescription?.prescription_id || ''
        if (nextId) setSelectedPrescriptionId(nextId)
      }
      if (action === 'renew' && prescriptionId) {
        const renewed = await doctorApi.prescriptions.renew(prescriptionId, { note })
        const nextId = renewed?.prescription_id || renewed?.prescription?.prescription_id || ''
        if (nextId) setSelectedPrescriptionId(nextId)
      }
      if (action === 'complete' && prescriptionId) {
        await doctorApi.prescriptions.complete(prescriptionId)
      }

      reloadPrescriptions()
      reloadItems()
      reloadSummary()
      onChanged?.()
      setDialog(null)
      notifyDoctorSuccess(toast, 'Đã cập nhật trạng thái đơn thuốc.', 'Đơn thuốc đã cập nhật')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể cập nhật đơn thuốc.', { permission: 'prescriptions.write' })
    } finally {
      setBusy(false)
    }
  }

  async function commitPrescriptionItemAction(action, itemId) {
    if (!itemId) {
      return
    }

    setBusy(true)
    try {
      if (action === 'stop') {
        await doctorApi.prescriptions.stopItem(itemId)
      }
      if (action === 'cancel') {
        await doctorApi.prescriptions.cancelItem(itemId)
      }
      if (action === 'complete') {
        await doctorApi.prescriptions.completeItem(itemId)
      }
      if (action === 'delete') {
        await doctorApi.prescriptions.removeItem(itemId)
      }

      reloadItems()
      reloadPrescriptions()
      reloadSummary()
      onChanged?.()
      setDialog(null)
      notifyDoctorSuccess(toast, 'Đã cập nhật item thuốc.', 'Đơn thuốc đã cập nhật')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể cập nhật item thuốc.', { permission: 'prescriptions.write' })
    } finally {
      setBusy(false)
    }
  }

  const prescriptionItems = safeArray(itemsState.data).length ? safeArray(itemsState.data) : safeArray(activePrescription?.items)
  const prescriptionSummary = summaryState.data || null
  const prescriptionStatus = activePrescription?.status || ''
  const canActivatePrescription = Boolean(prescriptionId && prescriptionStatus === 'draft' && prescriptionItems.length > 0)
  const activateBlockReason =
    !prescriptionId
      ? 'Chưa có bản nháp đơn thuốc.'
      : prescriptionStatus !== 'draft'
        ? `Backend chỉ cho activate từ trạng thái draft. Trạng thái hiện tại: ${prescriptionStatus || '--'}.`
        : prescriptionItems.length === 0
          ? 'Prescription phải có ít nhất một item trước khi activate.'
          : ''

  return (
    <div className="doctor-two-column">
      <div className="doctor-panel-stack">
        <SectionCard title="Đơn thuốc trong phiên khám" subtitle="Chọn đúng prescription record trước khi thêm thuốc hoặc thao tác lifecycle.">
          {prescriptionsState.loading ? <LoadingState label="Đang tải danh sách đơn thuốc..." /> : null}
          {prescriptionsState.error ? <ErrorState title="Không thể tải đơn thuốc" message={prescriptionsState.error} /> : null}
          {prescriptions.length === 0 ? (
            <EmptyState title="Chưa có đơn thuốc" description="Đơn thuốc draft sẽ được tạo khi bác sĩ thêm thuốc đầu tiên." />
          ) : (
            <div className="doctor-prescription-selector">
              {prescriptions.map((item) => {
                const itemId = item.prescription_id || item.id
                const isSelected = itemId === prescriptionId
                return (
                  <button
                    key={itemId}
                    className={`doctor-prescription-choice${isSelected ? ' is-selected' : ''}`}
                    type="button"
                    onClick={() => setSelectedPrescriptionId(itemId)}
                  >
                    <div>
                      <strong>{item.prescription_no || itemId}</strong>
                      <p>{item.note || 'Không có ghi chú đơn thuốc'}</p>
                    </div>
                    <StatusBadge status={item.status || 'draft'} />
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Tìm kiếm thuốc" subtitle="Tìm trong danh mục thuốc và thêm thuốc vào bản nháp hiện tại.">
          <div className="doctor-search-form">
            <label className="doctor-search-input">
              <span>Từ khóa thuốc</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} disabled={readOnly} placeholder="Tìm theo tên thuốc hoặc mã thuốc" />
            </label>
            <label>
              <span>Ghi chú đơn thuốc</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={readOnly} placeholder="Ghi chú tùy chọn cho đơn thuốc này" />
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
                  <button key={medicationId} className={`doctor-list-row doctor-list-select${isSelected ? ' is-selected' : ''}`} type="button" onClick={() => setSelectedMedication(item)} disabled={readOnly}>
                    <div>
                      <strong>{item.generic_name || item.brand_name || item.name || medicationId}</strong>
                      <p>{item.strength || item.form || item.category || 'Mục trong danh mục thuốc'}</p>
                    </div>
                    <span>{isSelected ? 'Đã chọn' : 'Chọn'}</span>
                  </button>
                )
              })}
              {searchState.pagination && searchState.pagination.page < searchState.pagination.total_pages ? (
                <button className="doctor-secondary-button doctor-load-more-button" type="button" onClick={loadMoreMedications} disabled={searchState.loading}>
                  Tải thêm thuốc ({searchState.results.length}/{searchState.pagination.total})
                </button>
              ) : null}
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
                  {itemsState.loading ? <LoadingState label="Đang tải item thuốc..." /> : null}
                  <table className="doctor-table">
                    <thead>
                      <tr>
                        <th>Thuốc</th>
                        <th>Liều dùng</th>
                        <th>Tần suất</th>
                        <th>Đường dùng</th>
                        <th>Thời lượng</th>
                        <th>SL</th>
                        <th>Trạng thái</th>
                        <th>Hướng dẫn</th>
                        <th>Thao tác</th>
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
                          <td>{item.quantity ?? '--'}</td>
                          <td>{item.status ? <StatusBadge status={item.status} /> : '--'}</td>
                          <td>{item.instructions || '--'}</td>
                          <td>
                            <div className="doctor-inline-actions doctor-inline-actions-wrap">
                              <button className="doctor-secondary-button" type="button" onClick={() => editPrescriptionItem(item)} disabled={busy || readOnly || isFinalStatus(item.status)}>
                                Sửa
                              </button>
                              <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ scope: 'item', action: 'stop', id: item.prescription_item_id || item.id })} disabled={busy || readOnly || isFinalStatus(item.status)}>
                                Dừng
                              </button>
                              <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ scope: 'item', action: 'complete', id: item.prescription_item_id || item.id })} disabled={busy || readOnly || isFinalStatus(item.status)}>
                                Hoàn tất
                              </button>
                              <button className="doctor-secondary-button doctor-button-danger-soft" type="button" onClick={() => setDialog({ scope: 'item', action: 'cancel', id: item.prescription_item_id || item.id })} disabled={busy || readOnly || isFinalStatus(item.status)}>
                                Hủy
                              </button>
                              <button className="doctor-secondary-button doctor-button-danger-soft" type="button" onClick={() => setDialog({ scope: 'item', action: 'delete', id: item.prescription_item_id || item.id })} disabled={busy || readOnly || isFinalStatus(item.status)}>
                                Gỡ item
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {prescriptionSummary ? (
                <div className="doctor-kpi-mini-grid">
                  <div className="doctor-kpi-tile"><strong>{prescriptionSummary.items_count ?? prescriptionItems.length}</strong><span>Tổng item</span></div>
                  <div className="doctor-kpi-tile"><strong>{prescriptionSummary.active_items_count ?? prescriptionItems.filter((item) => item.status === 'active').length}</strong><span>Item active</span></div>
                  <div className="doctor-kpi-tile"><strong>{prescriptionSummary.total_medications ?? '--'}</strong><span>Hoạt chất/thuốc</span></div>
                </div>
              ) : null}
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
          {interactionCheck?.has_conflict ? (
            <div className="doctor-alert-card doctor-alert-danger">
              <div className="doctor-alert-head">
                <StatusBadge status="cancelled" />
                <strong>Cảnh báo tương tác thuốc</strong>
              </div>
              <p>{interactionCheck.message || 'Backend phát hiện nguy cơ tương tác thuốc.'}</p>
            </div>
          ) : null}
          {duplicateCheck?.has_duplicate ? (
            <div className="doctor-alert-card doctor-alert-danger">
              <div className="doctor-alert-head">
                <StatusBadge status="cancelled" />
                <strong>Cảnh báo thuốc trùng</strong>
              </div>
              <p>Thuốc này đã có trong đơn hiện tại. UI đang dùng endpoint check-duplicate-medication.</p>
            </div>
          ) : null}
          {quantityCheck?.quantity !== undefined ? (
            <div className="doctor-muted-card">
              Số lượng backend gợi ý: <strong>{quantityCheck.quantity}</strong>
            </div>
          ) : null}
          {activateBlockReason ? (
            <div className="doctor-muted-card">
              Điều kiện kích hoạt: <strong>{activateBlockReason}</strong>
            </div>
          ) : null}

          <div className="doctor-inline-actions doctor-inline-actions-wrap">
            <button className="doctor-primary-button" type="button" onClick={() => setDialog({ scope: 'prescription', action: 'activate' })} disabled={busy || readOnly || !canActivatePrescription} title={activateBlockReason}>
              Kích hoạt đơn thuốc
            </button>
            <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ scope: 'prescription', action: 'complete' })} disabled={busy || readOnly || !prescriptionId || isFinalStatus(prescriptionStatus)}>
              Hoàn tất đơn
            </button>
            <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ scope: 'prescription', action: 'renew' })} disabled={busy || readOnly || !prescriptionId || prescriptionStatus === 'draft'}>
              Gia hạn
            </button>
            <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ scope: 'prescription', action: 'duplicate' })} disabled={busy || readOnly || !prescriptionId}>
              Nhân bản
            </button>
            <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ scope: 'prescription', action: 'cancel' })} disabled={busy || readOnly || !prescriptionId || isFinalStatus(prescriptionStatus)}>
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
            <label><span>Liều dùng</span><input value={itemForm.dose} disabled={readOnly} onChange={(event) => setItemForm((current) => ({ ...current, dose: event.target.value }))} placeholder="ví dụ: 500 mg" /></label>
            <label><span>Tần suất</span><input value={itemForm.frequency} disabled={readOnly} onChange={(event) => setItemForm((current) => ({ ...current, frequency: event.target.value }))} placeholder="ví dụ: ngày 2 lần" /></label>
            <label><span>Đường dùng</span><input value={itemForm.route} disabled={readOnly} onChange={(event) => setItemForm((current) => ({ ...current, route: event.target.value }))} placeholder="ví dụ: uống" /></label>
            <label><span>Số ngày dùng</span><input type="number" value={itemForm.duration_days} disabled={readOnly} onChange={(event) => setItemForm((current) => ({ ...current, duration_days: event.target.value }))} /></label>
            <label><span>Hướng dẫn</span><textarea value={itemForm.instructions} disabled={readOnly} onChange={(event) => setItemForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Hướng dẫn sử dụng" /></label>
          </div>

          <div className="doctor-inline-actions">
            <button className="doctor-primary-button" type="button" onClick={handleAddMedication} disabled={busy || readOnly}>
              {editingItemId ? 'Cập nhật thuốc' : 'Thêm thuốc'}
            </button>
            {editingItemId ? (
              <button className="doctor-secondary-button" type="button" onClick={resetMedicationForm} disabled={busy}>
                Hủy sửa item
              </button>
            ) : null}
            <button className="doctor-secondary-button" type="button" onClick={() => prescriptionId && runAllergyCheck(prescriptionId)} disabled={busy || !prescriptionId}>
              Kiểm tra dị ứng
            </button>
            <button className="doctor-secondary-button" type="button" onClick={() => prescriptionId && doctorApi.prescriptions.checkInteractionConflict({ prescription_id: prescriptionId, patient_id: patientId }).then(setInteractionCheck).catch((error) => handleDoctorApiError(error, toast, 'Không thể kiểm tra tương tác thuốc.', { permission: 'prescriptions.write' }))} disabled={busy || !prescriptionId}>
              Kiểm tra tương tác
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
          dialog?.scope === 'item'
            ? dialog?.action === 'delete'
              ? 'Gỡ item thuốc?'
              : 'Cập nhật item thuốc?'
            : dialog?.action === 'activate'
              ? 'Kích hoạt đơn thuốc?'
              : dialog?.action === 'duplicate'
                ? 'Nhân bản đơn thuốc?'
                : dialog?.action === 'renew'
                  ? 'Gia hạn đơn thuốc?'
                  : dialog?.action === 'complete'
                    ? 'Hoàn tất đơn thuốc?'
                    : 'Hủy đơn thuốc?'
        }
        description={
          dialog?.scope === 'item'
            ? dialog?.action === 'delete'
              ? 'Backend sẽ hủy/gỡ item theo cơ chế soft cancel của prescription item, không xóa cứng dữ liệu.'
              : 'Thao tác này dùng endpoint lifecycle riêng của prescription item và sẽ refresh danh sách thuốc.'
            : dialog?.action === 'activate'
              ? 'Bản nháp sẽ được kiểm tra xung đột dị ứng và tương tác thuốc trước khi kích hoạt.'
              : dialog?.action === 'duplicate'
                ? 'Thao tác này sẽ tạo bản nháp mới dựa trên đơn thuốc hiện tại.'
                : dialog?.action === 'renew'
                  ? 'Thao tác này tạo đơn thuốc gia hạn từ đơn hiện tại.'
                  : dialog?.action === 'complete'
                    ? 'Thao tác này đánh dấu đơn thuốc đã hoàn tất.'
                    : 'Thao tác này sẽ đánh dấu đơn thuốc hiện tại là đã hủy.'
        }
        confirmLabel={
          dialog?.scope === 'item'
            ? dialog?.action === 'delete'
              ? 'Gỡ item'
              : 'Cập nhật item'
            : dialog?.action === 'activate'
              ? 'Kích hoạt đơn thuốc'
              : dialog?.action === 'duplicate'
                ? 'Nhân bản đơn thuốc'
                : dialog?.action === 'renew'
                  ? 'Gia hạn đơn thuốc'
                  : dialog?.action === 'complete'
                    ? 'Hoàn tất đơn thuốc'
                    : 'Hủy đơn thuốc'
        }
        busy={busy}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          dialog?.scope === 'item'
            ? commitPrescriptionItemAction(dialog?.action, dialog?.id)
            : commitPrescriptionAction(dialog?.action)
        }
      />
    </div>
  )
}

export function ClinicalNotesPanel({ encounterId, doctorId, readOnly = false, onChanged }) {
  const toast = useToast()
  const [notesState, reloadNotes] = useAsyncResource(
    async () => doctorApi.notes.listByEncounter(encounterId),
    [encounterId],
    [],
    { fallbackMessage: 'Không thể tải ghi chú lâm sàng.' },
  )
  const notes = safeArray(notesState.data)
  const [noteText, setNoteText] = useState('')
  const [editingNoteId, setEditingNoteId] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialog, setDialog] = useState(null)

  async function handleSaveNote() {
    if (!noteText.trim()) {
      showDoctorToast(toast, {
        type: 'warning',
        title: 'Thiếu nội dung',
        message: 'Nội dung ghi chú lâm sàng là bắt buộc.',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        encounter_id: encounterId,
        author_id: doctorId,
        content: noteText.trim(),
      }

      if (editingNoteId) {
        await doctorApi.notes.update(editingNoteId, payload)
      } else {
        await doctorApi.notes.create(payload)
      }
      setNoteText('')
      setEditingNoteId('')
      reloadNotes()
      onChanged()
      notifyDoctorSuccess(
        toast,
        editingNoteId ? 'Đã cập nhật ghi chú lâm sàng.' : 'Đã lưu ghi chú lâm sàng.',
        'Ghi chú lâm sàng đã cập nhật',
      )
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể tạo ghi chú lâm sàng.', { permission: 'consultations.write' })
    } finally {
      setSaving(false)
    }
  }

  function editNote(note) {
    setEditingNoteId(note.note_id)
    setNoteText(note.content || note.note_text || '')
  }

  async function commitNoteAction(action, noteId) {
    setSaving(true)
    try {
      if (action === 'start') {
        await doctorApi.notes.start(noteId)
      }
      if (action === 'complete') {
        await doctorApi.notes.complete(noteId)
      }
      if (action === 'sign') {
        await doctorApi.notes.sign(noteId)
      }
      if (action === 'amend') {
        const note = notes.find((item) => item.note_id === noteId)
        await doctorApi.notes.amend(noteId, { content: noteText.trim() || note?.content || note?.note_text || '' })
      }
      if (action === 'cancel') {
        await doctorApi.notes.cancel(noteId)
      }
      reloadNotes()
      onChanged()
      setDialog(null)
      notifyDoctorSuccess(toast, 'Đã cập nhật lifecycle ghi chú lâm sàng.', 'Ghi chú lâm sàng đã cập nhật')
    } catch (error) {
      handleDoctorApiError(error, toast, 'Không thể cập nhật ghi chú lâm sàng.', { permission: 'consultations.write' })
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
                  <button className="doctor-secondary-button" type="button" onClick={() => editNote(note)} disabled={saving || readOnly || !['draft', 'in_progress', 'amended'].includes(note.status)}>
                    Sửa
                  </button>
                  {note.status === 'draft' ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'start', id: note.note_id })} disabled={saving || readOnly}>
                      Bắt đầu
                    </button>
                  ) : null}
                  {['draft', 'in_progress'].includes(note.status) ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'complete', id: note.note_id })} disabled={saving || readOnly}>
                      Hoàn tất & ký
                    </button>
                  ) : null}
                  {note.status !== 'signed' && note.status !== 'cancelled' ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'sign', id: note.note_id })} disabled={saving || readOnly}>
                      Ký/xác nhận
                    </button>
                  ) : null}
                  {note.status === 'signed' ? (
                    <button className="doctor-secondary-button" type="button" onClick={() => setDialog({ action: 'amend', id: note.note_id })} disabled={saving || readOnly}>
                      Bổ sung
                    </button>
                  ) : null}
                  {['draft', 'in_progress'].includes(note.status) ? (
                    <button className="doctor-secondary-button doctor-button-danger-soft" type="button" onClick={() => setDialog({ action: 'cancel', id: note.note_id })} disabled={saving || readOnly}>
                      Hủy
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
          <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} disabled={readOnly} placeholder="Nhập quan sát lâm sàng, ghi chú bàn giao hoặc ngữ cảnh tái khám" />
        </label>
        <div className="doctor-inline-actions">
          <button className="doctor-primary-button" type="button" onClick={handleSaveNote} disabled={saving || readOnly}>
            {editingNoteId ? 'Cập nhật ghi chú' : 'Lưu ghi chú'}
          </button>
          {editingNoteId ? (
            <button className="doctor-secondary-button" type="button" onClick={() => { setEditingNoteId(''); setNoteText('') }} disabled={saving}>
              Hủy sửa
            </button>
          ) : null}
        </div>
      </SectionCard>

      <ConfirmActionDialog
        open={Boolean(dialog)}
        title={
          dialog?.action === 'complete'
            ? 'Hoàn tất và ký ghi chú?'
            : dialog?.action === 'sign'
              ? 'Ký ghi chú lâm sàng?'
              : dialog?.action === 'amend'
                ? 'Bổ sung ghi chú đã ký?'
                : dialog?.action === 'cancel'
                  ? 'Hủy ghi chú lâm sàng?'
                  : 'Bắt đầu ghi chú lâm sàng?'
        }
        description={
          dialog?.action === 'complete'
            ? 'Endpoint complete của backend hoàn tất nội dung và xác nhận ghi chú theo lifecycle hiện có.'
            : dialog?.action === 'sign'
              ? 'Thao tác ký dùng endpoint sign riêng để xác nhận ghi chú chưa bị hủy.'
              : dialog?.action === 'amend'
                ? 'Thao tác này bổ sung nội dung cho ghi chú đã ký.'
                : dialog?.action === 'cancel'
                  ? 'Thao tác này hủy ghi chú theo lifecycle backend.'
                  : 'Thao tác này chuyển ghi chú từ nháp sang đang xử lý.'
        }
        confirmLabel={
          dialog?.action === 'complete'
            ? 'Hoàn tất & ký'
            : dialog?.action === 'sign'
              ? 'Ký ghi chú'
              : dialog?.action === 'amend'
                ? 'Bổ sung ghi chú'
                : dialog?.action === 'cancel'
                  ? 'Hủy ghi chú'
                  : 'Bắt đầu ghi chú'
        }
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => commitNoteAction(dialog?.action, dialog?.id)}
      />
    </div>
  )
}

