import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Phone,
  RotateCcw,
  Stethoscope,
  XCircle,
} from 'lucide-react';

const REASON_PRESETS = [
  { value: 'patient_request', label: 'Bệnh nhân yêu cầu', text: 'Bệnh nhân yêu cầu dời lịch.' },
  { value: 'doctor_schedule', label: 'Điều chỉnh lịch bác sĩ', text: 'Điều chỉnh theo lịch làm việc của bác sĩ.' },
  { value: 'slot_conflict', label: 'Trùng khung giờ', text: 'Dời lịch do trùng khung giờ.' },
  { value: 'reception_followup', label: 'Lễ tân sắp xếp lại', text: 'Lễ tân sắp xếp lại lịch hẹn.' },
  { value: 'other', label: 'Khác', text: 'Dời lịch hẹn.' },
];

function pad(value) {
  return String(value).padStart(2, '0');
}

function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function dateKeyFromDate(date) {
  if (!isValidDate(date)) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeKeyFromDate(date) {
  if (!isValidDate(date)) return '';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function todayKey() {
  return dateKeyFromDate(new Date());
}

function parseAppointmentTime(value) {
  const date = value ? new Date(value) : null;
  return isValidDate(date) ? date : null;
}

function roundToFiveMinutes(date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const remainder = next.getMinutes() % 5;
  if (remainder) next.setMinutes(next.getMinutes() + (5 - remainder));
  return next;
}

function getSeedDate(appointment) {
  const current = parseAppointmentTime(appointment?.appointment_time);
  const baseTime = current && current.getTime() > Date.now() ? current.getTime() : Date.now();
  return roundToFiveMinutes(new Date(baseTime + 30 * 60 * 1000));
}

function buildLocalDateTime(dateKey, timeKey) {
  if (!dateKey || !timeKey) return null;
  const normalized = new Date(`${dateKey}T${timeKey}:00`);
  return isValidDate(normalized) ? normalized : null;
}

function sameMinute(left, right) {
  if (!isValidDate(left) || !isValidDate(right)) return false;
  return Math.abs(left.getTime() - right.getTime()) < 60 * 1000;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!isValidDate(date)) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getErrorMessage(error, fallback = 'Không dời được lịch hẹn.') {
  return (
    error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || fallback
  );
}

function getAppointmentId(appointment) {
  return String(appointment?.appointment_id || appointment?.id || appointment?._id || '');
}

export function RescheduleAppointmentModal({ appointment, onClose, onSubmit, sourceLabel = 'Lễ tân' }) {
  const [form, setForm] = useState({
    date: '',
    time: '',
    reasonPreset: REASON_PRESETS[0].value,
    note: '',
  });
  const [state, setState] = useState({ loading: false, error: '' });

  useEffect(() => {
    if (!appointment) return;
    const seed = getSeedDate(appointment);
    setForm({
      date: dateKeyFromDate(seed),
      time: timeKeyFromDate(seed),
      reasonPreset: REASON_PRESETS[0].value,
      note: '',
    });
    setState({ loading: false, error: '' });
  }, [appointment]);

  const currentTime = useMemo(
    () => parseAppointmentTime(appointment?.appointment_time),
    [appointment],
  );
  const newTime = useMemo(
    () => buildLocalDateTime(form.date, form.time),
    [form.date, form.time],
  );
  const selectedReason = REASON_PRESETS.find((item) => item.value === form.reasonPreset) || REASON_PRESETS[0];
  const appointmentId = getAppointmentId(appointment);

  if (!appointment) return null;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyShortcut(kind) {
    const current = parseAppointmentTime(appointment?.appointment_time) || new Date();
    let next = new Date(current);

    if (kind === 'plus30') {
      const baseTime = current.getTime() > Date.now() ? current.getTime() : Date.now();
      next = new Date(baseTime + 30 * 60 * 1000);
    }

    if (kind === 'tomorrow') {
      next.setDate(next.getDate() + 1);
    }

    if (kind === 'nextWeek') {
      next.setDate(next.getDate() + 7);
    }

    if (kind === 'tomorrowMorning') {
      next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0);
    }

    const rounded = roundToFiveMinutes(next);
    setForm((currentForm) => ({
      ...currentForm,
      date: dateKeyFromDate(rounded),
      time: timeKeyFromDate(rounded),
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (!newTime) {
      setState({ loading: false, error: 'Vui lòng chọn ngày và giờ mới hợp lệ.' });
      return;
    }

    if (newTime.getTime() <= Date.now() - 60 * 1000) {
      setState({ loading: false, error: 'Thời gian mới phải sau thời điểm hiện tại.' });
      return;
    }

    if (sameMinute(currentTime, newTime)) {
      setState({ loading: false, error: 'Thời gian mới đang trùng với giờ hẹn hiện tại.' });
      return;
    }

    if (form.reasonPreset === 'other' && !form.note.trim()) {
      setState({ loading: false, error: 'Vui lòng nhập ghi chú khi chọn lý do khác.' });
      return;
    }

    const reason = form.note.trim()
      ? `${selectedReason.text} ${form.note.trim()}`
      : selectedReason.text;

    setState({ loading: true, error: '' });
    try {
      await onSubmit?.({
        appointment_time: newTime.toISOString(),
        reason,
      });
    } catch (error) {
      setState({ loading: false, error: getErrorMessage(error) });
    }
  }

  return (
    <div className="reception-modal-backdrop" role="presentation">
      <form
        className="reception-modal reception-reschedule-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reception-reschedule-title"
        onSubmit={submit}
      >
        <header className="reception-modal__header reception-reschedule-modal__header">
          <div>
            <span className="reception-modal__eyebrow">
              <RotateCcw size={15} />
              Dời lịch hẹn
            </span>
            <h3 id="reception-reschedule-title">Chọn thời gian mới</h3>
            <p>{sourceLabel} · Mã lịch {appointmentId ? appointmentId.slice(-8).toUpperCase() : '--'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" disabled={state.loading}>
            <XCircle size={20} />
          </button>
        </header>

        <section className="reception-reschedule-modal__summary" aria-label="Thông tin lịch hiện tại">
          <div className="reception-reschedule-modal__patient">
            <span className="reception-avatar-badge reception-avatar-badge--cyan">
              {(appointment.patient_name || 'B').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{appointment.patient_name || 'Bệnh nhân'}</strong>
              <span>
                <Phone size={14} />
                {appointment.patient_phone || '--'}
              </span>
            </div>
          </div>
          <div>
            <span>Giờ hiện tại</span>
            <strong>{formatDateTime(currentTime)}</strong>
          </div>
          <div>
            <span>Bác sĩ</span>
            <strong>
              <Stethoscope size={14} />
              {appointment.doctor_name || '--'}
            </strong>
          </div>
          <div>
            <span>Khoa phụ trách</span>
            <strong>{appointment.department_name || '--'}</strong>
          </div>
        </section>

        <div className="reception-reschedule-modal__quick">
          <button type="button" onClick={() => applyShortcut('plus30')}>+30 phút</button>
          <button type="button" onClick={() => applyShortcut('tomorrow')}>Ngày mai cùng giờ</button>
          <button type="button" onClick={() => applyShortcut('tomorrowMorning')}>Sáng mai 08:00</button>
          <button type="button" onClick={() => applyShortcut('nextWeek')}>Tuần sau</button>
        </div>

        <div className="reception-form-grid">
          <label>
            <span>Ngày mới *</span>
            <input
              type="date"
              min={todayKey()}
              value={form.date}
              onChange={(event) => update('date', event.target.value)}
              required
            />
          </label>
          <label>
            <span>Giờ mới *</span>
            <input
              type="time"
              step="300"
              value={form.time}
              onChange={(event) => update('time', event.target.value)}
              required
            />
          </label>
          <label className="is-span-2">
            <span>Lý do dời lịch</span>
            <select value={form.reasonPreset} onChange={(event) => update('reasonPreset', event.target.value)}>
              {REASON_PRESETS.map((reason) => (
                <option key={reason.value} value={reason.value}>{reason.label}</option>
              ))}
            </select>
          </label>
          <label className="is-span-2">
            <span>Ghi chú thêm</span>
            <textarea
              value={form.note}
              onChange={(event) => update('note', event.target.value)}
              placeholder="Ví dụ: bệnh nhân xin đổi sang buổi sáng, bác sĩ bận hội chẩn..."
            />
          </label>
        </div>

        <div className="reception-reschedule-modal__preview" aria-label="Xem trước lịch mới">
          <span>
            <Clock3 size={16} />
            Lịch mới
          </span>
          <strong>{newTime ? formatDateTime(newTime) : 'Chưa chọn thời gian'}</strong>
        </div>

        {state.error ? (
          <div className="reception-appointment-alert is-danger">
            <AlertCircle size={17} />
            <span>{state.error}</span>
          </div>
        ) : null}

        <footer className="reception-modal__actions reception-reschedule-modal__actions">
          <button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}>
            {state.loading ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
            <span>{state.loading ? 'Đang dời lịch...' : 'Xác nhận dời lịch'}</span>
          </button>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={onClose} disabled={state.loading}>
            <CalendarDays size={16} />
            <span>Giữ lịch cũ</span>
          </button>
        </footer>
      </form>
    </div>
  );
}
