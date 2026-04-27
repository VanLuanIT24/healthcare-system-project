import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Copy,
  Edit3,
  Eye,
  HeartPulse,
  Link2,
  ListChecks,
  LockKeyhole,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Timer,
  Trash2,
  UnlockKeyhole,
  UsersRound,
} from 'lucide-react';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { buildSlotPreview } from '../utils/schedulingUi';

const DOCTOR_AVATAR = '/images/scheduling/doctors/doctor-ai-fallback.png';
const CREATE_STEPS = [
  ['01', 'Thông tin cơ bản', 'Bác sĩ, khoa, ngày khám'],
  ['02', 'Thời gian & Khung giờ', 'Thiết lập giờ làm việc'],
  ['03', 'Tùy chọn nâng cao', 'Cấu hình mở rộng'],
  ['04', 'Xem trước & Công khai', 'Kiểm tra & xác nhận'],
];

function getWorkingDuration(start, end) {
  const [startHour, startMinute] = String(start || '00:00').split(':').map(Number);
  const [endHour, endMinute] = String(end || '00:00').split(':').map(Number);
  const minutes = Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
  const hours = Math.round((minutes / 60) * 10) / 10;
  return Number.isInteger(hours) ? `${hours} giờ` : `${hours.toFixed(1)} giờ`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatVietnameseDate(value) {
  if (!value) return 'Chưa chọn';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatVietnameseWeekday(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(new Date(value));
}

function formatSummaryDate(value) {
  const weekday = formatVietnameseWeekday(value);
  const date = formatVietnameseDate(value);
  return weekday ? `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${date}` : date;
}

export function ScheduleCreatePage() {
  const { actions, departments, doctors, error } = useSchedulingData();
  const defaultDoctor = doctors[0] || { id: '', department: '' };
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isPublishMenuOpen, setIsPublishMenuOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [advancedOptions, setAdvancedOptions] = useState({
    patientPortal: true,
    staffOnly: false,
    returnVisit: true,
    earlyBooking: true,
  });
  const [extraBreaks, setExtraBreaks] = useState([]);
  const previewRef = useRef(null);
  const [form, setForm] = useState({
    doctor: defaultDoctor.id,
    department: defaultDoctor.department,
    date: '2026-04-26',
    start: '07:30',
    end: '11:30',
    duration: 15,
    capacity: 1,
    hasBreak: true,
    breakStart: '09:30',
    breakEnd: '09:45',
    breakSlotMode: 'Giữ nguyên',
    breakMinutes: 0,
    status: 'draft',
    scheduleType: 'Lịch khám',
    note: '',
  });

  const slotPreview = useMemo(() => buildSlotPreview(form), [form]);
  const visualSlotPreview = useMemo(() => {
    const preview = slotPreview.slice(0, 16);
    if (!form.hasBreak || !form.breakStart || !form.breakEnd) {
      return preview.map((slot) => ({ type: 'slot', value: slot }));
    }

    return preview.map((slot) => (
      slot === form.breakStart
        ? { type: 'break', value: `${form.breakStart} - ${form.breakEnd}` }
        : { type: 'slot', value: slot }
    ));
  }, [form.breakEnd, form.breakStart, form.hasBreak, slotPreview]);
  const selectedDoctor = doctors.find((item) => item.id === form.doctor) || defaultDoctor;
  const totalCapacity = slotPreview.length * Number(form.capacity || 1);
  const summaryProgress = Math.min(100, Math.max(18, (slotPreview.length / 24) * 100));
  const expectedBookedMin = Math.max(1, Math.round(totalCapacity * 0.75));
  const expectedBookedMax = Math.max(expectedBookedMin, Math.round(totalCapacity * 0.82));
  const expectedUtilization = totalCapacity
    ? Math.round(((expectedBookedMin + expectedBookedMax) / 2 / totalCapacity) * 100)
    : 0;
  const expectedGapMin = Math.max(0, Math.round(slotPreview.length * 0.12));
  const expectedGapMax = Math.max(expectedGapMin, Math.round(slotPreview.length * 0.18));
  const expectedRevenueMin = expectedBookedMin * 300000;
  const expectedRevenueMax = expectedBookedMax * 300000;
  const isCreateReady = createStep >= CREATE_STEPS.length;
  const advancedOptionItems = [
    {
      key: 'patientPortal',
      title: 'Mở cho cổng bệnh nhân',
      copy: 'Bệnh nhân có thể tự lịch sau khi công khai.',
      icon: <UsersRound size={18} strokeWidth={2.35} />,
      tone: 'teal',
    },
    {
      key: 'staffOnly',
      title: 'Chỉ cho nhân sự đặt hộ',
      copy: 'Dùng khi cần kiểm soát lịch hẹn.',
      icon: <CalendarDays size={18} strokeWidth={2.35} />,
      tone: 'violet',
    },
    {
      key: 'returnVisit',
      title: 'Ưu tiên lịch tái khám',
      copy: 'Dành dấu lịch dành cho bệnh nhân quay lại.',
      icon: <CalendarPlus size={18} strokeWidth={2.35} />,
      tone: 'amber',
    },
    {
      key: 'earlyBooking',
      title: 'Cho phép đặt trước',
      copy: 'Cho phép bệnh nhân đặt thời gian khám.',
      icon: <CalendarCheck2 size={18} strokeWidth={2.35} />,
      tone: 'blue',
    },
  ];

  useEffect(() => {
    if (doctors.length > 0 && !doctors.some((doctor) => doctor.id === form.doctor)) {
      setForm((current) => ({
        ...current,
        doctor: doctors[0].id,
        department: doctors[0].department,
      }));
    }
  }, [doctors, form.doctor]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'doctor') {
        const doctor = doctors.find((item) => item.id === value);
        next.department = doctor?.department || current.department;
      }
      return next;
    });
  }

  async function handleCreate(status) {
    setActionError('');
    setActionMessage('');

    if (!isCreateReady) {
      setIsPublishMenuOpen(false);
      setActionError('Vui lòng hoàn tất đủ 4 bước trước khi tạo hoặc công khai lịch.');
      return;
    }

    try {
      await actions.createScheduleFromForm({ ...form, status });
      setActionMessage(status === 'published' ? 'Đã tạo và công khai lịch.' : 'Đã lưu bản nháp lịch.');
    } catch (createError) {
      setActionError(createError.message);
    }
  }

  function handlePreviewSchedule() {
    setCreateStep(CREATE_STEPS.length);
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleContinueStep() {
    setCreateStep((current) => {
      const next = Math.min(CREATE_STEPS.length, current + 1);
      if (next === CREATE_STEPS.length) {
        window.requestAnimationFrame(() => {
          previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      return next;
    });
  }

  function toggleAdvancedOption(key) {
    setAdvancedOptions((current) => ({ ...current, [key]: !current[key] }));
  }

  function handleAddBreak() {
    setExtraBreaks((current) => [
      ...current,
      {
        id: window.crypto?.randomUUID?.() || `${Date.now()}-${current.length}`,
        start: '10:30',
        end: '10:45',
      },
    ]);
  }

  function handleExtraBreakChange(id, field, value) {
    setExtraBreaks((current) => current.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function handleRemoveBreak(id) {
    setExtraBreaks((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      <section className="scheduling-create-command">
        <div className="scheduling-create-command__title">
          <h1>
            Tạo lịch bác sĩ mới
            <span aria-hidden="true"><Sparkles size={17} strokeWidth={2.35} /></span>
          </h1>
          <p>Tạo lịch cụ thể, tự động kiểm tra xung đột và cảnh báo trước khi công khai cho bệnh nhân.</p>
        </div>

        <div className="scheduling-create-command__actions">
          <button type="button" onClick={handlePreviewSchedule}>
            <Eye size={16} strokeWidth={2.35} aria-hidden="true" />
            Xem trước lịch
          </button>
          <button type="button" onClick={() => handleCreate('draft')}>
            <Save size={16} strokeWidth={2.35} aria-hidden="true" />
            Lưu nháp
          </button>
          <div className="scheduling-create-command__publish">
            <button type="button" className="is-primary" onClick={() => handleCreate('published')}>
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
              Công khai lịch
            </button>
            <button
              type="button"
              className="is-caret"
              aria-label="Mở tùy chọn công khai lịch"
              aria-expanded={isPublishMenuOpen}
              onClick={() => setIsPublishMenuOpen((current) => !current)}
            >
              <ChevronDown size={17} strokeWidth={2.45} aria-hidden="true" />
            </button>

            {isPublishMenuOpen ? (
              <div className="scheduling-create-command__menu">
                <button type="button" onClick={() => {
                  setIsPublishMenuOpen(false);
                  handleCreate('published');
                }}>
                  <Check size={14} strokeWidth={2.45} aria-hidden="true" />
                  Công khai ngay
                </button>
                <Link to="/scheduling/bulk-create" onClick={() => setIsPublishMenuOpen(false)}>
                  <CalendarDays size={14} strokeWidth={2.35} aria-hidden="true" />
                  Tạo hàng loạt
                </Link>
                <Link to="/scheduling/schedules" onClick={() => setIsPublishMenuOpen(false)}>
                  <ListChecks size={14} strokeWidth={2.35} aria-hidden="true" />
                  Về danh sách
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {error || actionError || actionMessage ? (
        <section className={`scheduling-sync-banner ${error || actionError ? 'is-warning' : ''}`}>
          <strong>{actionMessage ? 'Thao tác thành công' : 'Thông báo máy chủ'}</strong>
          <span>{actionMessage || actionError || error}</span>
        </section>
      ) : null}

      <section className="scheduling-create-workspace">
        <div className="scheduling-create-body">
          <form className="scheduling-create-left">
            <div className="scheduling-create-steps" aria-label="Quy trình tạo lịch">
              {CREATE_STEPS.map(([number, title, copy], index) => {
                const stepNumber = index + 1;
                const isReached = stepNumber <= createStep;
                const isActive = stepNumber === createStep;

                return (
                <button
                  key={number}
                  type="button"
                  className={`scheduling-create-step ${isReached ? 'is-reached' : ''} ${isActive ? 'is-active' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => setCreateStep(stepNumber)}
                >
                  <span>{number}</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{copy}</small>
                  </div>
                </button>
                );
              })}
            </div>

            <section className="scheduling-create-card scheduling-create-card--basic">
              <div className="scheduling-create-card__head">
                <span aria-hidden="true"><ClipboardCheck size={18} strokeWidth={2.35} /></span>
                <div>
                  <h2>Thông tin cơ bản</h2>
                  <p>Chọn bác sĩ, khoa và ngày khám để bắt đầu tạo lịch</p>
                </div>
              </div>

              <div className="scheduling-create-basic-grid">
                <label className="scheduling-create-field is-required is-doctor">
                  <span>Bác sĩ</span>
                  <div>
                    <img src={DOCTOR_AVATAR} alt="" />
                    <select name="doctor" value={form.doctor} onChange={handleChange}>
                      {doctors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <small>{selectedDoctor.department || form.department} • 12 năm kinh nghiệm</small>
                  </div>
                </label>

                <label className="scheduling-create-field is-required">
                  <span>Khoa</span>
                  <div>
                    <i aria-hidden="true"><HeartPulse size={17} strokeWidth={2.25} /></i>
                    <select name="department" value={form.department} onChange={handleChange}>
                      {departments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    </select>
                    <small>{form.department}</small>
                  </div>
                </label>

                <label className="scheduling-create-field is-required">
                  <span>Ngày khám</span>
                  <div>
                    <i aria-hidden="true"><CalendarDays size={17} strokeWidth={2.25} /></i>
                    <input type="date" name="date" value={form.date} onChange={handleChange} />
                    <small>{formatVietnameseWeekday(form.date)}</small>
                  </div>
                </label>

                <label className="scheduling-create-field is-required">
                  <span>Loại lịch</span>
                  <div>
                    <i aria-hidden="true"><CalendarCheck2 size={17} strokeWidth={2.25} /></i>
                    <select name="scheduleType" value={form.scheduleType} onChange={handleChange}>
                      <option value="Lịch khám">Lịch khám</option>
                      <option value="Tái khám">Tái khám</option>
                      <option value="Tư vấn">Tư vấn</option>
                    </select>
                  </div>
                </label>
              </div>
            </section>

            <section className="scheduling-create-card scheduling-create-card--time">
              <div className="scheduling-create-card__head">
                <span className="scheduling-create-card__number">02</span>
                <div>
                  <h2>Thời gian làm việc & sức chứa</h2>
                  <p>Thiết lập khung giờ, số lượng slot và sức chứa cho lịch khám.</p>
                </div>
              </div>

              <div className="scheduling-create-time-board">
                <div className="scheduling-create-time-main">
                  <strong>Khung giờ làm việc</strong>
                  <div className="scheduling-create-time-grid">
                    <label className="scheduling-create-field is-required">
                      <span>Giờ bắt đầu</span>
                      <input type="time" name="start" value={form.start} onChange={handleChange} />
                    </label>
                    <label className="scheduling-create-field is-required">
                      <span>Giờ kết thúc</span>
                      <input type="time" name="end" value={form.end} onChange={handleChange} />
                    </label>
                    <label className="scheduling-create-field is-required">
                      <span>Thời lượng / slot</span>
                      <select name="duration" value={form.duration} onChange={handleChange}>
                        <option value="10">10 phút</option>
                        <option value="15">15 phút</option>
                        <option value="20">20 phút</option>
                        <option value="30">30 phút</option>
                      </select>
                    </label>
                    <label className="scheduling-create-field">
                      <span>Sức chứa / slot</span>
                      <select name="capacity" value={form.capacity} onChange={handleChange}>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                      </select>
                    </label>
                  </div>

                  <div className="scheduling-create-time-stats">
                    <div>
                      <Clock3 size={17} strokeWidth={2.35} aria-hidden="true" />
                      <span>Tổng thời lượng</span>
                      <strong>{getWorkingDuration(form.start, form.end)}</strong>
                    </div>
                    <div>
                      <CalendarDays size={17} strokeWidth={2.35} aria-hidden="true" />
                      <span>Số slot dự kiến</span>
                      <strong>{slotPreview.length} slot</strong>
                    </div>
                    <div>
                      <UsersRound size={17} strokeWidth={2.35} aria-hidden="true" />
                      <span>Tổng sức chứa</span>
                      <strong>{totalCapacity} bệnh nhân</strong>
                    </div>
                  </div>
                </div>

                <div className="scheduling-create-break-card">
                  <div className="scheduling-create-break-card__top">
                    <strong>+ Nghỉ giữa khung giờ (tùy chọn)</strong>
                    <label className="scheduling-create-switch">
                      <input
                        type="checkbox"
                        checked={Boolean(form.hasBreak)}
                        onChange={(event) => setForm((current) => ({ ...current, hasBreak: event.target.checked }))}
                      />
                      <span />
                    </label>
                  </div>

                  <div className="scheduling-create-break-grid">
                    <label className="scheduling-create-field is-required">
                      <span>Bắt đầu nghỉ</span>
                      <input type="time" name="breakStart" value={form.breakStart} onChange={handleChange} disabled={!form.hasBreak} />
                    </label>
                    <label className="scheduling-create-field is-required">
                      <span>Kết thúc nghỉ</span>
                      <input type="time" name="breakEnd" value={form.breakEnd} onChange={handleChange} disabled={!form.hasBreak} />
                    </label>
                    <label className="scheduling-create-field">
                      <span>Kích thước slot sau nghỉ</span>
                      <select name="breakSlotMode" value={form.breakSlotMode} onChange={handleChange} disabled={!form.hasBreak}>
                        <option value="Giữ nguyên">Giữ nguyên</option>
                        <option value="Tăng 5 phút">Tăng 5 phút</option>
                        <option value="Giảm tải">Giảm tải</option>
                      </select>
                    </label>
                  </div>

                  {extraBreaks.length ? (
                    <div className="scheduling-create-extra-breaks">
                      {extraBreaks.map((item) => (
                        <div key={item.id}>
                          <input
                            type="time"
                            value={item.start}
                            aria-label="Bắt đầu nghỉ bổ sung"
                            onChange={(event) => handleExtraBreakChange(item.id, 'start', event.target.value)}
                          />
                          <input
                            type="time"
                            value={item.end}
                            aria-label="Kết thúc nghỉ bổ sung"
                            onChange={(event) => handleExtraBreakChange(item.id, 'end', event.target.value)}
                          />
                          <button type="button" aria-label="Xóa khoảng nghỉ" onClick={() => handleRemoveBreak(item.id)}>
                            <Trash2 size={14} strokeWidth={2.35} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="scheduling-create-break-actions">
                    <button type="button" onClick={handleAddBreak} disabled={!form.hasBreak}>
                      <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                      Thêm khoảng nghỉ khác
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      aria-label="Tắt nghỉ giữa khung giờ"
                      onClick={() => setForm((current) => ({ ...current, hasBreak: false }))}
                    >
                      <Trash2 size={15} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="scheduling-create-card scheduling-create-card--options">
              <div className="scheduling-create-card__head">
                <span className="scheduling-create-card__number">03</span>
                <div>
                  <h2>Tùy chọn nâng cao</h2>
                  <p>Cấu hình cách lịch hiển thị và ghi chú nội bộ cho bộ phận vận hành.</p>
                </div>
              </div>
              <div className="scheduling-create-options">
                {advancedOptionItems.map((item) => (
                  <label
                    key={item.key}
                    className={`scheduling-create-option-card is-${item.tone} ${advancedOptions[item.key] ? 'is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={advancedOptions[item.key]}
                      onChange={() => toggleAdvancedOption(item.key)}
                    />
                    <span aria-hidden="true"><Check size={13} strokeWidth={2.6} /></span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.copy}</small>
                    </div>
                    <i aria-hidden="true">{item.icon}</i>
                  </label>
                ))}
              </div>

              <div className="scheduling-create-note-wrap">
                <label className="scheduling-create-field scheduling-create-note">
                  <span>Ghi chú nội bộ (không hiển thị cho bệnh nhân)</span>
                  <textarea
                    name="note"
                    value={form.note}
                    maxLength={500}
                    onChange={handleChange}
                    placeholder="Ví dụ: ưu tiên tái khám, giới hạn loại khám..."
                  />
                </label>
                <small>{form.note.length}/500</small>
              </div>

              <div className="scheduling-create-form-actions">
                <Link to="/scheduling/schedules">Hủy tạo</Link>
                <div>
                  <button type="button" onClick={() => handleCreate('draft')}>Lưu nháp</button>
                  <button type="button" className="is-primary" onClick={handleContinueStep}>
                    <span>
                      {createStep >= CREATE_STEPS.length ? 'Xem trước' : 'Tiếp tục'}
                      <small>{CREATE_STEPS[Math.min(createStep, CREATE_STEPS.length - 1)]?.[1]}</small>
                    </span>
                    <ArrowRight size={15} strokeWidth={2.55} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </section>

            <section className="scheduling-create-card scheduling-create-slot-preview">
              <div className="scheduling-create-slot-preview__head">
                <div>
                  <span aria-hidden="true"><Link2 size={16} strokeWidth={2.45} /></span>
                  <strong>Xem trước lịch ({slotPreview.length} slot)</strong>
                </div>
                <div className="scheduling-create-slot-preview__legend" aria-label="Chú thích slot">
                  <span><i className="is-active" /> Slot hoạt động</span>
                  <span><i className="is-break" /> Nghỉ giải lao</span>
                </div>
              </div>
              <div className="scheduling-create-slot-list">
                {visualSlotPreview.map((slot, index) => (
                  <span
                    key={`${slot.type}-${slot.value}-${index}`}
                    className={slot.type === 'break' ? 'is-break' : ''}
                  >
                    {slot.type === 'break' ? (
                      <>
                        <strong>Nghỉ</strong>
                        <small>{slot.value}</small>
                      </>
                    ) : slot.value}
                  </span>
                ))}
              </div>
            </section>
          </form>

          <aside className="scheduling-create-right" ref={previewRef} style={{ '--summary-progress': `${summaryProgress}%`, '--expected-utilization': `${expectedUtilization}%` }}>
            <section className="scheduling-create-summary">
              <div className="scheduling-create-summary__head">
                <div>
                  <span aria-hidden="true"><CalendarCheck2 size={17} strokeWidth={2.35} /></span>
                  <h2>Tổng quan lịch</h2>
                </div>
                <button type="button" onClick={handlePreviewSchedule}>
                  <Edit3 size={13} strokeWidth={2.35} />
                  Sửa
                </button>
              </div>

              <div className="scheduling-create-summary__body">
                <dl>
                  <div>
                    <span aria-hidden="true"><Stethoscope size={13} strokeWidth={2.35} /></span>
                    <div><dt>Bác sĩ</dt><dd>{selectedDoctor.name || 'Chưa chọn'}</dd></div>
                  </div>
                  <div>
                    <span aria-hidden="true"><HeartPulse size={13} strokeWidth={2.35} /></span>
                    <div><dt>Khoa</dt><dd>{form.department || 'Chưa chọn'}</dd></div>
                  </div>
                  <div>
                    <span aria-hidden="true"><CalendarDays size={13} strokeWidth={2.35} /></span>
                    <div><dt>Ngày khám</dt><dd>{formatSummaryDate(form.date)}</dd></div>
                  </div>
                  <div>
                    <span aria-hidden="true"><CalendarCheck2 size={13} strokeWidth={2.35} /></span>
                    <div><dt>Loại lịch</dt><dd>{form.scheduleType}</dd></div>
                  </div>
                  <div>
                    <span aria-hidden="true"><Clock3 size={13} strokeWidth={2.35} /></span>
                    <div><dt>Thời gian làm việc</dt><dd>{form.start} - {form.end} ({getWorkingDuration(form.start, form.end)})</dd></div>
                  </div>
                </dl>

                <div className="scheduling-create-summary__donut">
                  <strong>{slotPreview.length}</strong>
                  <span>Slot dự kiến</span>
                </div>
              </div>

              <div className="scheduling-create-summary__metrics">
                <div>
                  <ListChecks size={16} strokeWidth={2.35} />
                  <strong>{slotPreview.length}</strong>
                  <span>Tổng slot dự kiến</span>
                </div>
                <div>
                  <Timer size={16} strokeWidth={2.35} />
                  <strong>{form.duration} phút</strong>
                  <span>Thời lượng / slot</span>
                </div>
                <div>
                  <UsersRound size={16} strokeWidth={2.35} />
                  <strong>{totalCapacity}</strong>
                  <span>Tổng sức chứa</span>
                </div>
              </div>

            </section>

            <section className="scheduling-create-side-card scheduling-create-performance">
              <div className="scheduling-create-side-card__head">
                <span aria-hidden="true"><AlarmClock size={16} strokeWidth={2.35} /></span>
                <h3>Hiệu suất dự kiến</h3>
              </div>
              <div className="scheduling-create-performance__body">
                <div className="scheduling-create-performance__donut">
                  <strong>{expectedUtilization}%</strong>
                  <span>Hiệu suất dự kiến</span>
                </div>
                <dl>
                  <div>
                    <dt>Đặt lịch dự kiến</dt>
                    <dd>{expectedBookedMin} - {expectedBookedMax} bệnh nhân</dd>
                  </div>
                  <div>
                    <dt>Có thể bỏ trống</dt>
                    <dd>{expectedGapMin} - {expectedGapMax} slot</dd>
                  </div>
                  <div>
                    <dt>Doanh thu dự kiến</dt>
                    <dd>{formatCurrency(expectedRevenueMin)}đ - {formatCurrency(expectedRevenueMax)}đ</dd>
                  </div>
                </dl>
              </div>
              <strong className="scheduling-create-performance__level">Trung bình</strong>
            </section>

            <section className="scheduling-create-side-card scheduling-create-warning">
              <div className="scheduling-create-side-card__head">
                <span aria-hidden="true"><ShieldCheck size={16} strokeWidth={2.35} /></span>
                <h3>Cảnh báo hệ thống</h3>
              </div>
              <ul>
                <li><Check size={14} strokeWidth={2.6} />Không phát hiện xung đột lịch</li>
                <li><Check size={14} strokeWidth={2.6} />Bác sĩ thuộc khoa đã chọn</li>
                <li><Check size={14} strokeWidth={2.6} />Khung giờ làm việc hợp lệ</li>
              </ul>
              <button type="button" onClick={() => setActionMessage('Đã kiểm tra chi tiết cấu hình lịch.')}>
                <ShieldCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                Kiểm tra chi tiết
              </button>
            </section>

            <section className="scheduling-create-side-card scheduling-create-quick">
              <div className="scheduling-create-side-card__head">
                <span aria-hidden="true"><Settings2 size={16} strokeWidth={2.35} /></span>
                <h3>Thao tác nhanh</h3>
              </div>
              <div>
                <button type="button" className="is-copy" onClick={() => setActionMessage('Đã nhân bản cấu hình lịch hiện tại.')}>
                  <span aria-hidden="true"><Copy size={16} strokeWidth={2.35} /></span>
                  <strong>Nhân bản lịch</strong>
                  <small>Sao chép lịch nhanh</small>
                </button>
                <Link to="/scheduling/bulk-create" className="is-bulk">
                  <span aria-hidden="true"><CalendarPlus size={16} strokeWidth={2.35} /></span>
                  <strong>Tạo nhiều lịch</strong>
                  <small>Tạo lịch hàng loạt</small>
                </Link>
                <button type="button" className="is-lock" onClick={() => setActionMessage('Đã khóa slot đã chọn trong bản xem trước.')}>
                  <span aria-hidden="true"><LockKeyhole size={16} strokeWidth={2.35} /></span>
                  <strong>Khóa slot</strong>
                  <small>Khóa khung giờ</small>
                </button>
                <button type="button" className="is-open" onClick={() => setActionMessage('Đã mở khóa slot đã chọn trong bản xem trước.')}>
                  <span aria-hidden="true"><UnlockKeyhole size={16} strokeWidth={2.35} /></span>
                  <strong>Mở khóa slot</strong>
                  <small>Mở lại khung giờ</small>
                </button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
