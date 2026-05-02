import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlarmClock,
  ArrowRight,
  AlertTriangle,
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
import { buildSlotPreview, translateDepartmentName } from '../utils/schedulingUi';

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

function getTodayInputValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function timeToMinutes(value) {
  const [hour = 0, minute = 0] = String(value || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildBreakWindows(form, extraBreaks) {
  if (!form.hasBreak) return [];
  const windows = [];
  if (form.breakStart && form.breakEnd) {
    windows.push({ start: form.breakStart, end: form.breakEnd, mode: form.breakSlotMode });
  }
  extraBreaks.forEach((item) => {
    if (item.start && item.end) {
      windows.push({ start: item.start, end: item.end, mode: item.mode || form.breakSlotMode });
    }
  });
  return windows;
}

function getServerTimeLabel(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

function FieldSelect({
  name,
  value,
  options,
  placeholder,
  disabled = false,
  openSelect,
  setOpenSelect,
  onSelect,
  className = '',
}) {
  const isOpen = openSelect === name;
  const selectedOption = options.find((item) => String(item.value) === String(value));
  const displayOption = selectedOption || { label: placeholder, meta: '' };

  function closeMenu() {
    setOpenSelect((current) => (current === name ? '' : current));
  }

  return (
    <div
      className={`scheduling-create-select ${className} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeMenu();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          closeMenu();
        }
      }}
    >
      <button
        type="button"
        className="scheduling-create-select__control"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpenSelect((current) => (current === name ? '' : name))}
      >
        <span>
          <strong>{displayOption.label}</strong>
          {displayOption.meta ? <small>{displayOption.meta}</small> : null}
        </span>
        <ChevronDown size={16} strokeWidth={2.45} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="scheduling-create-select__menu" role="listbox">
          {options.length ? options.map((item) => {
            const selected = String(item.value) === String(value);
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={selected ? 'is-selected' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(name, item.value);
                  closeMenu();
                }}
              >
                <span>
                  <strong>{item.label}</strong>
                  {item.meta ? <small>{item.meta}</small> : null}
                </span>
                {selected ? <Check size={14} strokeWidth={2.7} aria-hidden="true" /> : null}
              </button>
            );
          }) : (
            <div className="scheduling-create-select__empty">{placeholder}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ScheduleCreatePage() {
  const {
    actions,
    createResourcesLoaded,
    departments,
    doctors,
    error,
    loading,
  } = useSchedulingData();
  const availableDoctors = createResourcesLoaded ? doctors : [];
  const availableDepartments = createResourcesLoaded ? departments : [];
  const defaultDoctor = availableDoctors[0] || { id: '', departmentId: '', department: '' };
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [createdScheduleId, setCreatedScheduleId] = useState('');
  const [isPublishMenuOpen, setIsPublishMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [previewResult, setPreviewResult] = useState(null);
  const [openSelect, setOpenSelect] = useState('');
  const [createStep, setCreateStep] = useState(1);
  const [advancedOptions, setAdvancedOptions] = useState({
    patientPortal: true,
    staffOnly: false,
    returnVisit: true,
    earlyBooking: true,
  });
  const [extraBreaks, setExtraBreaks] = useState([]);
  const [selectedPreviewSlots, setSelectedPreviewSlots] = useState([]);
  const previewRef = useRef(null);
  const formRef = useRef(null);
  const sectionRefs = useRef({});
  const previewRequestRef = useRef(0);
  const [form, setForm] = useState({
    doctor: defaultDoctor.id,
    department: defaultDoctor.departmentId || '',
    date: getTodayInputValue(),
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
  const selectedSlotSet = useMemo(() => new Set(selectedPreviewSlots), [selectedPreviewSlots]);
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
  const selectedDoctor = availableDoctors.find((item) => item.id === form.doctor) || defaultDoctor;
  const selectedDepartment = availableDepartments.find((item) => item.id === form.department)
    || availableDepartments.find((item) => item.id === selectedDoctor.departmentId)
    || null;
  const serverSlotSummary = previewResult?.slots_summary || {};
  const totalSlotCount = Number(serverSlotSummary.total_slots || slotPreview.length);
  const blockedBreakSlots = Number(serverSlotSummary.blocked_slots || 0);
  const availableSlotCount = Number(serverSlotSummary.available_slots || Math.max(totalSlotCount - blockedBreakSlots, 0));
  const totalCapacity = Number(serverSlotSummary.total_capacity || totalSlotCount * Number(form.capacity || 1));
  const availabilityRate = totalSlotCount ? Math.round((availableSlotCount / totalSlotCount) * 100) : 0;
  const summaryProgress = Math.min(100, Math.max(18, availabilityRate || (slotPreview.length / 24) * 100));
  const conflictCount = Number(previewResult?.conflicts?.length || 0);
  const realDataReady = createResourcesLoaded && availableDoctors.length > 0 && availableDepartments.length > 0;
  const breakWindows = useMemo(() => buildBreakWindows(form, extraBreaks), [extraBreaks, form]);
  const localWarnings = useMemo(() => {
    const warnings = [];
    if (!createResourcesLoaded) warnings.push('Chưa tải được dữ liệu bác sĩ/khoa từ hệ thống.');
    if (createResourcesLoaded && availableDoctors.length === 0) warnings.push('Chưa có bác sĩ active có role doctor.');
    if (createResourcesLoaded && availableDepartments.length === 0) warnings.push('Chưa có khoa active.');
    if (!form.doctor) warnings.push('Cần chọn bác sĩ.');
    if (!form.department) warnings.push('Cần chọn khoa.');
    if (!form.date) warnings.push('Cần chọn ngày khám.');
    if (timeToMinutes(form.start) >= timeToMinutes(form.end)) warnings.push('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
    if (Number(form.duration || 0) < 5) warnings.push('Thời lượng slot phải từ 5 phút trở lên.');
    if (Number(form.capacity || 0) < 1) warnings.push('Sức chứa mỗi slot phải từ 1 bệnh nhân trở lên.');
    breakWindows.forEach((window, index) => {
      const start = timeToMinutes(window.start);
      const end = timeToMinutes(window.end);
      if (start >= end) warnings.push(`Khoảng nghỉ ${index + 1} không hợp lệ.`);
      if (start < timeToMinutes(form.start) || end > timeToMinutes(form.end)) {
        warnings.push(`Khoảng nghỉ ${index + 1} phải nằm trong giờ làm việc.`);
      }
    });
    return warnings;
  }, [
    availableDepartments.length,
    availableDoctors.length,
    breakWindows,
    createResourcesLoaded,
    form.capacity,
    form.date,
    form.department,
    form.doctor,
    form.duration,
    form.end,
    form.start,
  ]);
  const serverWarnings = previewResult?.warnings || [];
  const canSubmit = realDataReady && localWarnings.length === 0 && conflictCount === 0 && totalSlotCount > 0 && !isSubmitting;
  const serverNotice = createResourcesLoaded ? '' : error;
  const noticeMessage = actionMessage || actionError || serverNotice;
  const noticeIsWarning = Boolean(actionError || serverNotice);
  const doctorOptions = availableDoctors.map((doctor) => ({
    value: doctor.id,
    label: doctor.name,
    meta: `${doctor.employeeCode || 'Chưa có mã NV'} • ${doctor.department || 'Chưa có khoa'} • ${doctor.activeSchedulesCount || 0} lịch đang mở`,
  }));
  const departmentOptions = availableDepartments.map((department) => ({
    value: department.id,
    label: translateDepartmentName(department.name),
    meta: [department.code, department.type].filter(Boolean).join(' • '),
  }));
  const scheduleTypeOptions = [
    { value: 'Lịch khám', label: 'Lịch khám', meta: 'Khám mới và khám thông thường' },
    { value: 'Tái khám', label: 'Tái khám', meta: 'Ưu tiên bệnh nhân quay lại' },
    { value: 'Tư vấn', label: 'Tư vấn', meta: 'Tư vấn trực tiếp hoặc từ xa' },
  ];
  const durationOptions = [
    { value: 10, label: '10 phút', meta: 'Khám nhanh' },
    { value: 15, label: '15 phút', meta: 'Mặc định' },
    { value: 20, label: '20 phút', meta: 'Tư vấn chi tiết hơn' },
    { value: 30, label: '30 phút', meta: 'Ca khám dài' },
  ];
  const capacityOptions = [1, 2, 3, 4].map((number) => ({
    value: number,
    label: `${number}`,
    meta: `${number} bệnh nhân / slot`,
  }));
  const breakSlotModeOptions = [
    { value: 'Giữ nguyên', label: 'Giữ nguyên', meta: 'Không đổi thời lượng slot' },
    { value: 'Tăng 5 phút', label: 'Tăng 5 phút', meta: 'Nới thời lượng sau nghỉ' },
    { value: 'Giảm tải', label: 'Giảm tải', meta: 'Ưu tiên ít slot hơn' },
  ];
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
    if (availableDoctors.length > 0 && !availableDoctors.some((doctor) => doctor.id === form.doctor)) {
      setForm((current) => ({
        ...current,
        doctor: availableDoctors[0].id,
        department: availableDoctors[0].departmentId || '',
      }));
    }
  }, [availableDoctors, form.doctor]);

  const buildActionForm = useCallback(
    (status = form.status) => ({
      ...form,
      status,
      extraBreaks,
      patientPortalEnabled: advancedOptions.patientPortal,
      staffOnly: advancedOptions.staffOnly,
      returnVisitPriority: advancedOptions.returnVisit,
      earlyBookingEnabled: advancedOptions.earlyBooking,
    }),
    [advancedOptions, extraBreaks, form],
  );

  const runPreviewCheck = useCallback(async () => {
    if (!realDataReady || localWarnings.length > 0) {
      setPreviewResult(null);
      return null;
    }

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setIsChecking(true);
    try {
      const result = await actions.previewCreateScheduleFromForm(buildActionForm());
      if (previewRequestRef.current === requestId) {
        setPreviewResult(result);
      }
      return result;
    } catch (previewError) {
      if (previewRequestRef.current === requestId) {
        setPreviewResult(null);
        setActionError(previewError.message);
      }
      return null;
    } finally {
      if (previewRequestRef.current === requestId) {
        setIsChecking(false);
      }
    }
  }, [actions, buildActionForm, localWarnings.length, realDataReady]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      runPreviewCheck();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [runPreviewCheck]);

  useEffect(() => {
    const sections = Object.entries(sectionRefs.current)
      .map(([step, node]) => ({ step: Number(step), node }))
      .filter((item) => item.node);

    if (!sections.length || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

        if (activeEntry?.target?.dataset?.createStep) {
          setCreateStep(Number(activeEntry.target.dataset.createStep));
        }
      },
      {
        root: null,
        rootMargin: '-22% 0px -55% 0px',
        threshold: [0.2, 0.45, 0.7],
      },
    );

    sections.forEach(({ node }) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  function getStepSectionProps(step) {
    return {
      ref: (node) => {
        if (node) sectionRefs.current[step] = node;
      },
      'data-create-step': step,
      onFocusCapture: () => setCreateStep(step),
      onPointerDown: () => setCreateStep(step),
    };
  }

  function handleStepSelect(step) {
    setCreateStep(step);
    window.requestAnimationFrame(() => {
      const target = step === 4 ? previewRef.current || sectionRefs.current[4] : sectionRefs.current[step];
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    updateFormValue(name, value);
  }

  function updateFormValue(name, value) {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'doctor') {
        const doctor = availableDoctors.find((item) => item.id === value);
        next.department = doctor?.departmentId || '';
      }
      return next;
    });
    setCreatedScheduleId('');
    setSelectedPreviewSlots([]);
    setActionError('');
    setActionMessage('');
  }

  async function handleCreate(status) {
    setActionError('');
    setActionMessage('');
    setIsPublishMenuOpen(false);

    if (localWarnings.length > 0) {
      setActionError(localWarnings[0]);
      return;
    }

    setIsSubmitting(true);
    try {
      const preview = await runPreviewCheck();
      if (!preview) {
        setActionError('Không kiểm tra được lịch với máy chủ. Vui lòng thử lại trước khi tạo.');
        return;
      }
      if (preview && preview.can_create === false) {
        setActionError(preview.warnings?.[0]?.message || 'Lịch chưa đạt điều kiện để tạo.');
        return;
      }

      const result = await actions.createScheduleFromForm(buildActionForm(status));
      const scheduleId = result?.schedule?.doctor_schedule_id || result?.schedule?.id || result?.doctor_schedule_id || '';
      setCreatedScheduleId(scheduleId);
      setActionMessage(status === 'published' ? 'Đã tạo và công khai lịch thật trên máy chủ.' : 'Đã lưu bản nháp lịch thật trên máy chủ.');
      setCreateStep(CREATE_STEPS.length);
    } catch (createError) {
      setActionError(createError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePreviewSchedule() {
    handleStepSelect(CREATE_STEPS.length);
    runPreviewCheck();
  }

  function handleEditFromSummary() {
    handleStepSelect(1);
  }

  function handleContinueStep() {
    const next = Math.min(CREATE_STEPS.length, createStep + 1);
    handleStepSelect(next);
  }

  function toggleAdvancedOption(key) {
    setCreatedScheduleId('');
    setAdvancedOptions((current) => ({ ...current, [key]: !current[key] }));
  }

  function handleAddBreak() {
    setCreatedScheduleId('');
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
    setCreatedScheduleId('');
    setExtraBreaks((current) => current.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function handleRemoveBreak(id) {
    setCreatedScheduleId('');
    setExtraBreaks((current) => current.filter((item) => item.id !== id));
  }

  function togglePreviewSlot(slot) {
    setSelectedPreviewSlots((current) => (
      current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot]
    ));
  }

  async function handleDuplicateSchedule() {
    setActionError('');
    setActionMessage('');
    if (!createdScheduleId) {
      setActionError('Hãy lưu nháp hoặc công khai lịch trước, sau đó mới nhân bản từ lịch thật đã tạo.');
      return;
    }

    try {
      const targetDate = addDays(form.date, 1);
      const result = await actions.duplicateSchedule(createdScheduleId, {
        work_date: targetDate,
        status: 'draft',
      });
      const duplicatedId = result?.schedule?.doctor_schedule_id || result?.doctor_schedule_id || '';
      if (duplicatedId) setCreatedScheduleId(duplicatedId);
      setActionMessage(`Đã nhân bản lịch sang ngày ${formatVietnameseDate(targetDate)}.`);
    } catch (duplicateError) {
      setActionError(duplicateError.message);
    }
  }

  async function handleBatchSlotAction(action) {
    setActionError('');
    setActionMessage('');
    if (!createdScheduleId) {
      setActionError('Hãy lưu nháp hoặc công khai lịch trước, sau đó mới khóa/mở slot trên lịch thật.');
      return;
    }
    if (selectedPreviewSlots.length === 0) {
      setActionError('Chọn ít nhất một slot trong bản xem trước để thao tác.');
      return;
    }

    try {
      if (action === 'lock') {
        const result = await actions.batchBlockSlots(createdScheduleId, {
          slot_times: selectedPreviewSlots,
          reason: 'Khóa từ màn tạo lịch',
        });
        setActionMessage(`Đã khóa ${result?.changed_count ?? selectedPreviewSlots.length} slot trên lịch thật.`);
      } else {
        const result = await actions.batchReopenSlots(createdScheduleId, {
          slot_times: selectedPreviewSlots,
        });
        setActionMessage(`Đã mở lại ${result?.changed_count ?? selectedPreviewSlots.length} slot trên lịch thật.`);
      }
      setSelectedPreviewSlots([]);
      runPreviewCheck();
    } catch (slotError) {
      setActionError(slotError.message);
    }
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
          <button type="button" onClick={handlePreviewSchedule} disabled={!realDataReady || isChecking}>
            <Eye size={16} strokeWidth={2.35} aria-hidden="true" />
            {isChecking ? 'Đang kiểm tra' : 'Xem trước lịch'}
          </button>
          <button type="button" onClick={() => handleCreate('draft')} disabled={!canSubmit}>
            <Save size={16} strokeWidth={2.35} aria-hidden="true" />
            {isSubmitting ? 'Đang lưu' : 'Lưu nháp'}
          </button>
          <div className="scheduling-create-command__publish">
            <button type="button" className="is-primary" onClick={() => handleCreate('published')} disabled={!canSubmit}>
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
              {isSubmitting ? 'Đang xử lý' : 'Công khai lịch'}
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
                <button type="button" disabled={!canSubmit} onClick={() => {
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

      {noticeMessage ? (
        <section className={`scheduling-sync-banner ${noticeIsWarning ? 'is-warning' : ''}`}>
          <strong>{actionMessage ? 'Thao tác thành công' : 'Thông báo máy chủ'}</strong>
          <span>{noticeMessage}</span>
        </section>
      ) : null}

      <section className="scheduling-create-workspace">
        <div className="scheduling-create-body">
          <form className="scheduling-create-left" ref={formRef}>
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
                  onClick={() => handleStepSelect(stepNumber)}
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

            <section className="scheduling-create-card scheduling-create-card--basic" {...getStepSectionProps(1)}>
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
                    <FieldSelect
                      name="doctor"
                      value={form.doctor}
                      options={doctorOptions}
                      placeholder={loading ? 'Đang tải bác sĩ...' : 'Chưa có bác sĩ active'}
                      disabled={!realDataReady}
                      openSelect={openSelect}
                      setOpenSelect={setOpenSelect}
                      onSelect={updateFormValue}
                      className="has-avatar"
                    />
                  </div>
                </label>

                <label className="scheduling-create-field is-required">
                  <span>Khoa</span>
                  <div>
                    <i aria-hidden="true"><HeartPulse size={17} strokeWidth={2.25} /></i>
                    <FieldSelect
                      name="department"
                      value={form.department}
                      options={departmentOptions}
                      placeholder="Chưa có khoa active"
                      disabled={!realDataReady}
                      openSelect={openSelect}
                      setOpenSelect={setOpenSelect}
                      onSelect={updateFormValue}
                      className="has-icon"
                    />
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
                    <FieldSelect
                      name="scheduleType"
                      value={form.scheduleType}
                      options={scheduleTypeOptions}
                      placeholder="Chọn loại lịch"
                      openSelect={openSelect}
                      setOpenSelect={setOpenSelect}
                      onSelect={updateFormValue}
                      className="has-icon"
                    />
                  </div>
                </label>
              </div>
            </section>

            <section className="scheduling-create-card scheduling-create-card--time" {...getStepSectionProps(2)}>
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
                      <FieldSelect
                        name="duration"
                        value={form.duration}
                        options={durationOptions}
                        placeholder="Chọn thời lượng"
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onSelect={updateFormValue}
                      />
                    </label>
                    <label className="scheduling-create-field">
                      <span>Sức chứa / slot</span>
                      <FieldSelect
                        name="capacity"
                        value={form.capacity}
                        options={capacityOptions}
                        placeholder="Chọn sức chứa"
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onSelect={updateFormValue}
                      />
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
                        onChange={(event) => {
                          setCreatedScheduleId('');
                          setForm((current) => ({ ...current, hasBreak: event.target.checked }));
                        }}
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
                      <FieldSelect
                        name="breakSlotMode"
                        value={form.breakSlotMode}
                        options={breakSlotModeOptions}
                        placeholder="Chọn chế độ"
                        disabled={!form.hasBreak}
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onSelect={updateFormValue}
                      />
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
                      onClick={() => {
                        setCreatedScheduleId('');
                        setForm((current) => ({ ...current, hasBreak: false }));
                      }}
                    >
                      <Trash2 size={15} strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="scheduling-create-card scheduling-create-card--options" {...getStepSectionProps(3)}>
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
                  <button type="button" onClick={() => handleCreate('draft')} disabled={!canSubmit}>Lưu nháp</button>
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

            <section
              className="scheduling-create-card scheduling-create-slot-preview"
              data-create-step="4"
              ref={(node) => {
                if (node) {
                  sectionRefs.current[4] = node;
                  previewRef.current = node;
                }
              }}
              onFocusCapture={() => setCreateStep(4)}
              onPointerDown={() => setCreateStep(4)}
            >
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
                  <button
                    key={`${slot.type}-${slot.value}-${index}`}
                    type="button"
                    className={`${slot.type === 'break' ? 'is-break' : ''} ${selectedSlotSet.has(slot.value) ? 'is-selected' : ''}`}
                    disabled={slot.type === 'break'}
                    onClick={() => togglePreviewSlot(slot.value)}
                  >
                    {slot.type === 'break' ? (
                      <>
                        <strong>Nghỉ</strong>
                        <small>{slot.value}</small>
                      </>
                    ) : slot.value}
                  </button>
                ))}
              </div>
            </section>
          </form>

          <aside
            className="scheduling-create-right"
            onFocusCapture={() => setCreateStep(4)}
            onPointerDown={() => setCreateStep(4)}
            style={{ '--summary-progress': `${summaryProgress}%`, '--expected-utilization': `${availabilityRate}%` }}
          >
            <section className="scheduling-create-summary">
              <div className="scheduling-create-summary__head">
                <div>
                  <span aria-hidden="true"><CalendarCheck2 size={17} strokeWidth={2.35} /></span>
                  <h2>Tổng quan lịch</h2>
                </div>
                <button type="button" onClick={handleEditFromSummary}>
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
                    <div><dt>Khoa</dt><dd>{selectedDepartment?.name || selectedDoctor.department || 'Chưa chọn'}</dd></div>
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
                  <strong>{totalSlotCount}</strong>
                  <span>Slot dự kiến</span>
                </div>
              </div>

              <div className="scheduling-create-summary__metrics">
                <div>
                  <ListChecks size={16} strokeWidth={2.35} />
                  <strong>{totalSlotCount}</strong>
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
                <h3>Khả dụng thực tế</h3>
              </div>
              <div className="scheduling-create-performance__body">
                <div className="scheduling-create-performance__donut">
                  <strong>{availabilityRate}%</strong>
                  <span>Slot khả dụng</span>
                </div>
                <dl>
                  <div>
                    <dt>Slot có thể đặt</dt>
                    <dd>{availableSlotCount} / {totalSlotCount} slot</dd>
                  </div>
                  <div>
                    <dt>Slot khóa do nghỉ</dt>
                    <dd>{blockedBreakSlots} slot</dd>
                  </div>
                  <div>
                    <dt>Xung đột lịch</dt>
                    <dd>{conflictCount} lịch trùng</dd>
                  </div>
                </dl>
              </div>
              <strong className="scheduling-create-performance__level">
                {isChecking ? 'Đang kiểm tra' : conflictCount ? 'Cần xử lý' : 'Sẵn sàng'}
              </strong>
            </section>

            <section className="scheduling-create-side-card scheduling-create-warning">
              <div className="scheduling-create-side-card__head">
                <span aria-hidden="true"><ShieldCheck size={16} strokeWidth={2.35} /></span>
                <h3>Cảnh báo hệ thống</h3>
              </div>
              <ul>
                {localWarnings.map((warning) => (
                  <li key={warning} className="is-warning"><AlertTriangle size={14} strokeWidth={2.6} />{warning}</li>
                ))}
                {serverWarnings.map((warning) => (
                  <li key={`${warning.type}-${warning.message}`} className={warning.tone === 'danger' ? 'is-warning' : ''}>
                    <AlertTriangle size={14} strokeWidth={2.6} />{warning.message}
                  </li>
                ))}
                {!localWarnings.length && !serverWarnings.length ? (
                  <>
                    <li><Check size={14} strokeWidth={2.6} />Không phát hiện xung đột lịch</li>
                    <li><Check size={14} strokeWidth={2.6} />Bác sĩ thuộc khoa đã chọn</li>
                    <li><Check size={14} strokeWidth={2.6} />Khung giờ làm việc hợp lệ</li>
                  </>
                ) : null}
                {previewResult?.conflicts?.map((conflict) => (
                  <li key={conflict.schedule_id} className="is-warning">
                    <AlertTriangle size={14} strokeWidth={2.6} />
                    Trùng {getServerTimeLabel(conflict.shift_start)} - {getServerTimeLabel(conflict.shift_end)}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={runPreviewCheck} disabled={!realDataReady || isChecking}>
                <ShieldCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                {isChecking ? 'Đang kiểm tra' : 'Kiểm tra chi tiết'}
              </button>
            </section>

            <section className="scheduling-create-side-card scheduling-create-quick">
              <div className="scheduling-create-side-card__head">
                <span aria-hidden="true"><Settings2 size={16} strokeWidth={2.35} /></span>
              <h3>Thao tác nhanh</h3>
              </div>
              <div>
                <button type="button" className="is-copy" onClick={handleDuplicateSchedule}>
                  <span aria-hidden="true"><Copy size={16} strokeWidth={2.35} /></span>
                  <strong>Nhân bản lịch</strong>
                  <small>{createdScheduleId ? 'Tạo bản nháp ngày kế tiếp' : 'Cần lịch đã lưu'}</small>
                </button>
                <Link to="/scheduling/bulk-create" className="is-bulk">
                  <span aria-hidden="true"><CalendarPlus size={16} strokeWidth={2.35} /></span>
                  <strong>Tạo nhiều lịch</strong>
                  <small>Tạo lịch hàng loạt</small>
                </Link>
                <button type="button" className="is-lock" onClick={() => handleBatchSlotAction('lock')}>
                  <span aria-hidden="true"><LockKeyhole size={16} strokeWidth={2.35} /></span>
                  <strong>Khóa slot</strong>
                  <small>{selectedPreviewSlots.length ? `${selectedPreviewSlots.length} slot đã chọn` : 'Chọn slot trước'}</small>
                </button>
                <button type="button" className="is-open" onClick={() => handleBatchSlotAction('open')}>
                  <span aria-hidden="true"><UnlockKeyhole size={16} strokeWidth={2.35} /></span>
                  <strong>Mở khóa slot</strong>
                  <small>{selectedPreviewSlots.length ? 'Mở slot đã chọn' : 'Chọn slot trước'}</small>
                </button>
              </div>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
