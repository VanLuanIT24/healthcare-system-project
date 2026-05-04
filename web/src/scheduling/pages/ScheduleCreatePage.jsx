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
import { DEFAULT_SCHEDULE_TYPE, getScheduleTypeMeta, normalizeScheduleType, scheduleTypeCatalog } from '../data/scheduleTypes';
import { translateDepartmentName } from '../utils/schedulingUi';

const DOCTOR_AVATAR = '/images/scheduling/doctors/doctor-ai-fallback.png';
const CREATE_STEPS = [
  ['01', 'Thông tin cơ bản', 'Bác sĩ, khoa, ngày khám'],
  ['02', 'Thời gian & Khung giờ', 'Thiết lập giờ làm việc'],
  ['03', 'Tùy chọn nâng cao', 'Cấu hình mở rộng'],
  ['04', 'Xem trước & Công khai', 'Kiểm tra & xác nhận'],
];
const CLINIC_SHIFT_WINDOWS = [
  { key: 'morning', label: 'Ca sáng', start: '07:00', end: '11:45', bookable: true },
  { key: 'afternoon', label: 'Ca chiều', start: '13:30', end: '17:00', bookable: true },
  { key: 'evening', label: 'Ca tối', start: '18:00', end: '22:00', bookable: true },
  { key: 'nightDuty', label: 'Trực đêm', start: '22:00', end: '23:59', bookable: false },
];
const SHIFT_GAPS = [
  { start: '11:45', end: '13:30', label: 'Nghỉ / chuyển ca' },
  { start: '17:00', end: '18:00', label: 'Nghỉ / chuyển ca' },
];
const SCHEDULING_NOTIFICATION_EVENT = 'healthcare:scheduling-notification';

function emitSchedulingNotification({ title, body, tone = 'info', to = '/scheduling/schedules' }) {
  window.dispatchEvent(new CustomEvent(SCHEDULING_NOTIFICATION_EVENT, {
    detail: {
      id: `schedule-create-${Date.now()}`,
      title,
      body,
      tone,
      to,
      time: 'Vừa xong',
    },
  }));
}

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

function minutesToTime(totalMinutes) {
  const normalized = Math.max(0, Number(totalMinutes || 0));
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getShiftWindowForSlot(startMinute, endMinute) {
  return CLINIC_SHIFT_WINDOWS.find((shift) => {
    const shiftStart = timeToMinutes(shift.start);
    const shiftEnd = timeToMinutes(shift.end);
    return startMinute >= shiftStart && endMinute <= shiftEnd;
  }) || null;
}

function isInsideBreakWindow(startMinute, breakWindows = []) {
  return breakWindows.some((window) => {
    const breakStart = timeToMinutes(window.start);
    const breakEnd = timeToMinutes(window.end);
    return startMinute >= breakStart && startMinute < breakEnd;
  });
}

function buildOperationalSlotPreview(form, breakWindows = []) {
  const startMinute = timeToMinutes(form.start);
  const endMinute = timeToMinutes(form.end);
  const duration = Math.max(Number(form.duration || 15), 5);
  const slots = [];
  const insertedClosedRanges = new Set();

  for (let cursor = startMinute; cursor + duration <= endMinute && slots.length < 96; cursor += duration) {
    const slotEnd = cursor + duration;
    const value = minutesToTime(cursor);
    const shift = getShiftWindowForSlot(cursor, slotEnd);

    if (isInsideBreakWindow(cursor, breakWindows)) {
      slots.push({
        type: 'break',
        value,
        label: 'Nghỉ',
        range: `${value} - ${minutesToTime(slotEnd)}`,
      });
      continue;
    }

    if (!shift) {
      const nextShift = CLINIC_SHIFT_WINDOWS.find((item) => timeToMinutes(item.start) > cursor);
      const closedEnd = nextShift ? Math.min(timeToMinutes(nextShift.start), endMinute) : Math.min(slotEnd, endMinute);
      const key = `${cursor}-${closedEnd}`;
      if (!insertedClosedRanges.has(key)) {
        insertedClosedRanges.add(key);
        slots.push({
          type: 'closed',
          value: key,
          label: 'Nghỉ / chuyển ca',
          range: `${minutesToTime(cursor)} - ${minutesToTime(closedEnd)}`,
        });
      }
      cursor = Math.max(cursor, closedEnd - duration);
      continue;
    }

    slots.push({
      type: shift.bookable ? 'slot' : 'duty',
      shift: shift.key,
      shiftLabel: shift.label,
      value,
      range: `${value} - ${minutesToTime(slotEnd)}`,
    });
  }

  return slots;
}

function buildOperationalWarnings(form, previewSlots) {
  const warnings = [];
  const startMinute = timeToMinutes(form.start);
  const endMinute = timeToMinutes(form.end);
  const hasMorning = previewSlots.some((slot) => slot.shift === 'morning' && slot.type === 'slot');
  const hasAfternoon = previewSlots.some((slot) => slot.shift === 'afternoon' && slot.type === 'slot');
  const hasDuty = previewSlots.some((slot) => slot.type === 'duty');
  const hasClosed = previewSlots.some((slot) => slot.type === 'closed');

  if (startMinute < timeToMinutes('07:00')) {
    warnings.push('Trước 07:00 là trực đêm, không mở slot đặt lịch khám thông thường.');
  }
  if (hasClosed) {
    warnings.push('Khung giờ đi qua khoảng nghỉ/chuyển ca; hệ thống sẽ không mở slot đặt khám trong khoảng này.');
  }
  if (hasDuty) {
    warnings.push('Sau 22:00 là trực đêm, không mở slot đặt lịch khám.');
  }
  if (hasMorning && hasAfternoon) {
    warnings.push('Bác sĩ đang được xếp nhiều ca trong ngày; xem trước đã tách màu ca sáng, chiều và tối.');
  }

  return warnings;
}

function buildOperationalBreaks(form, breakWindows = []) {
  const startMinute = timeToMinutes(form.start);
  const endMinute = timeToMinutes(form.end);
  const windows = [...breakWindows];

  [
    ...SHIFT_GAPS.map((gap) => [gap.start, gap.end, gap.label]),
    ['22:00', '23:59', 'Trực đêm'],
  ].forEach(([start, end, mode]) => {
    const windowStart = Math.max(startMinute, timeToMinutes(start));
    const windowEnd = Math.min(endMinute, timeToMinutes(end));
    if (windowStart < windowEnd) {
      windows.push({
        start: minutesToTime(windowStart),
        end: minutesToTime(windowEnd),
        mode,
      });
    }
  });

  return windows;
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toInputDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthLabel(date) {
  return new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(date);
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return {
      date: day,
      value: toInputDateValue(day),
      inCurrentMonth: day.getMonth() === month,
    };
  });
}

function formatTimeDisplay(value) {
  const [rawHour = 0, rawMinute = 0] = String(value || '00:00').split(':').map(Number);
  const period = rawHour >= 12 ? 'CH' : 'SA';
  const hour12 = rawHour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(rawMinute).padStart(2, '0')} ${period}`;
}

function toTimeValue(hour12, minute, period) {
  const normalizedHour = Number(hour12) % 12;
  const hour24 = period === 'CH' ? normalizedHour + 12 : normalizedHour;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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

function buildScheduleCreateMessage(notification, fallbackStatus) {
  if (!notification) {
    return fallbackStatus === 'published' ? 'Đã tạo và công khai lịch thật trên máy chủ.' : 'Đã lưu bản nháp lịch thật trên máy chủ.';
  }

  const date = formatVietnameseDate(notification.work_date);
  const start = getServerTimeLabel(notification.shift_start);
  const end = getServerTimeLabel(notification.shift_end);
  const doctor = notification.doctor_name || 'Bác sĩ';
  const department = notification.department_name || 'Khoa';
  const slots = Number(notification.available_slots ?? notification.total_slots ?? 0);
  const blocked = Number(notification.blocked_slots || 0);
  const title = notification.title || (fallbackStatus === 'published' ? 'Đã tạo và công khai lịch bác sĩ' : 'Đã lưu nháp lịch bác sĩ');

  return `${title}: ${doctor} - ${department}, ngày ${date}, ${start} - ${end}, ${slots} slot đặt khám, ${blocked} slot nghỉ/chuyển ca hoặc trực.`;
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

function DatePickerField({ name, value, openSelect, setOpenSelect, onSelect }) {
  const isOpen = openSelect === name;
  const selectedDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewDate, setViewDate] = useState(selectedDate);
  const todayValue = getTodayInputValue();
  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate]);

  useEffect(() => {
    if (isOpen && value) {
      setViewDate(new Date(`${value}T00:00:00`));
    }
  }, [isOpen, value]);

  function closeMenu() {
    setOpenSelect((current) => (current === name ? '' : current));
  }

  function moveMonth(direction) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  return (
    <div
      className={`scheduling-create-date-picker ${isOpen ? 'is-open' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeMenu();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeMenu();
      }}
    >
      <button
        type="button"
        className="scheduling-create-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setOpenSelect((current) => (current === name ? '' : name))}
      >
        <span>
          <strong>{formatVietnameseDate(value)}</strong>
          <small>{formatVietnameseWeekday(value) || 'Chọn ngày khám'}</small>
        </span>
        <ChevronDown size={15} strokeWidth={2.45} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="scheduling-create-date-menu" role="dialog" aria-label="Chọn ngày khám">
          <header>
            <button type="button" aria-label="Tháng trước" onClick={() => moveMonth(-1)}>‹</button>
            <strong>{getMonthLabel(viewDate)}</strong>
            <button type="button" aria-label="Tháng sau" onClick={() => moveMonth(1)}>›</button>
          </header>
          <div className="scheduling-create-date-weekdays" aria-hidden="true">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="scheduling-create-date-grid">
            {days.map((day) => (
              <button
                key={day.value}
                type="button"
                className={`${day.inCurrentMonth ? '' : 'is-muted'} ${day.value === value ? 'is-selected' : ''} ${day.value === todayValue ? 'is-today' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(name, day.value);
                  closeMenu();
                }}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>
          <footer>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(name, todayValue);
                closeMenu();
              }}
            >
              Hôm nay
            </button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}

function TimePickerField({ name, value, openSelect, setOpenSelect, onSelect, disabled = false }) {
  const isOpen = openSelect === name;
  const [rawHour = 0, rawMinute = 0] = String(value || '00:00').split(':').map(Number);
  const period = rawHour >= 12 ? 'CH' : 'SA';
  const hour12 = rawHour % 12 || 12;
  const hours = Array.from({ length: 12 }, (_, index) => index + 1);
  const minutes = Array.from({ length: 60 }, (_, index) => index);

  function closeMenu() {
    setOpenSelect((current) => (current === name ? '' : current));
  }

  function choose(nextHour, nextMinute, nextPeriod) {
    onSelect(name, toTimeValue(nextHour, nextMinute, nextPeriod));
  }

  return (
    <div
      className={`scheduling-create-time-picker ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          closeMenu();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeMenu();
      }}
    >
      <button
        type="button"
        className="scheduling-create-picker-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpenSelect((current) => (current === name ? '' : name))}
      >
        <strong>{formatTimeDisplay(value)}</strong>
        <Clock3 size={15} strokeWidth={2.45} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="scheduling-create-time-menu" role="dialog" aria-label="Chọn giờ">
          <div>
            <span>Giờ</span>
            <div role="listbox">
              {hours.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className={hour === hour12 ? 'is-selected' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(hour, rawMinute, period)}
                >
                  {String(hour).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span>Phút</span>
            <div role="listbox">
              {minutes.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  className={minute === rawMinute ? 'is-selected' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(hour12, minute, period)}
                >
                  {String(minute).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span>Buổi</span>
            <div role="listbox">
              {['SA', 'CH'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={item === period ? 'is-selected' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(hour12, rawMinute, item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <footer>
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={closeMenu}>Xong</button>
          </footer>
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
    scheduleTypes,
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
    returnVisit: false,
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
    scheduleType: DEFAULT_SCHEDULE_TYPE,
    note: '',
  });

  const breakWindows = useMemo(() => buildBreakWindows(form, extraBreaks), [extraBreaks, form]);
  const visualSlotPreview = useMemo(() => buildOperationalSlotPreview(form, breakWindows), [breakWindows, form]);
  const slotPreview = useMemo(() => visualSlotPreview.filter((slot) => slot.type === 'slot').map((slot) => slot.value), [visualSlotPreview]);
  const dutySlotCount = useMemo(() => visualSlotPreview.filter((slot) => slot.type === 'duty').length, [visualSlotPreview]);
  const closedRangeCount = useMemo(() => visualSlotPreview.filter((slot) => slot.type === 'closed').length, [visualSlotPreview]);
  const operationalWarnings = useMemo(() => buildOperationalWarnings(form, visualSlotPreview), [form, visualSlotPreview]);
  const selectedSlotSet = useMemo(() => new Set(selectedPreviewSlots), [selectedPreviewSlots]);
  const selectedDoctor = availableDoctors.find((item) => item.id === form.doctor) || defaultDoctor;
  const selectedDepartment = availableDepartments.find((item) => item.id === form.department)
    || availableDepartments.find((item) => item.id === selectedDoctor.departmentId)
    || null;
  const blockedBreakSlots = visualSlotPreview.filter((slot) => slot.type === 'break' || slot.type === 'closed' || slot.type === 'duty').length;
  const totalSlotCount = slotPreview.length;
  const availableSlotCount = slotPreview.length;
  const totalCapacity = totalSlotCount * Number(form.capacity || 1);
  const availabilityRate = totalSlotCount ? Math.round((availableSlotCount / totalSlotCount) * 100) : 0;
  const summaryProgress = Math.min(100, Math.max(18, availabilityRate || (slotPreview.length / 24) * 100));
  const conflictCount = Number(previewResult?.conflicts?.length || 0);
  const realDataReady = createResourcesLoaded && availableDoctors.length > 0 && availableDepartments.length > 0;
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
    if (slotPreview.length === 0) warnings.push('Khung giờ hiện tại không có slot khám hợp lệ trong ca sáng, ca chiều hoặc ca tối.');
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
    slotPreview.length,
  ]);
  const serverWarnings = previewResult?.warnings || [];
  const submitBlockReason = (() => {
    if (!realDataReady) return createResourcesLoaded ? 'Chưa có đủ dữ liệu bác sĩ hoặc khoa để tạo lịch.' : 'Đang tải dữ liệu bác sĩ và khoa.';
    if (localWarnings.length > 0) return localWarnings[0];
    if (totalSlotCount <= 0) return 'Khung giờ hiện tại không có slot khám hợp lệ.';
    if (conflictCount > 0) return 'Bác sĩ đang có lịch trùng trong khung giờ này.';
    if (previewResult?.can_create === false) return previewResult?.warnings?.[0]?.message || 'Lịch chưa đạt điều kiện để tạo.';
    return '';
  })();
  const canSubmit = !submitBlockReason && !isSubmitting;
  const canTrySubmit = realDataReady && !isSubmitting;
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
  const scheduleTypeOptions = (scheduleTypes?.length ? scheduleTypes : scheduleTypeCatalog).map((type) => ({
    value: type.value,
    label: type.label || type.value,
    meta: [type.badge, type.meta].filter(Boolean).join(' • '),
  }));
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
      breakWindows: buildOperationalBreaks(form, breakWindows),
      patientPortalEnabled: advancedOptions.patientPortal,
      staffOnly: advancedOptions.staffOnly,
      returnVisitPriority: advancedOptions.returnVisit,
      earlyBookingEnabled: advancedOptions.earlyBooking,
    }),
    [advancedOptions, breakWindows, form],
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
    const selectedTypeMeta = name === 'scheduleType' ? getScheduleTypeMeta(value) : null;
    setForm((current) => {
      const next = { ...current, [name]: name === 'scheduleType' ? normalizeScheduleType(value) : value };
      if (name === 'doctor') {
        const doctor = availableDoctors.find((item) => item.id === value);
        next.department = doctor?.departmentId || '';
      }
      if (selectedTypeMeta) {
        next.duration = selectedTypeMeta.suggestedDuration || current.duration;
      }
      return next;
    });
    if (selectedTypeMeta) {
      setAdvancedOptions((current) => ({
        ...current,
        patientPortal: selectedTypeMeta.patientPortalEnabled !== false,
        staffOnly: selectedTypeMeta.staffOnly === true,
        returnVisit: selectedTypeMeta.returnVisitPriority === true,
      }));
    }
    setCreatedScheduleId('');
    setSelectedPreviewSlots([]);
    setActionError('');
    setActionMessage('');
  }

  function handleResetForm() {
    setForm({
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
      scheduleType: DEFAULT_SCHEDULE_TYPE,
      note: '',
    });
    setAdvancedOptions({
      patientPortal: true,
      staffOnly: false,
      returnVisit: false,
      earlyBooking: true,
    });
    setExtraBreaks([]);
    setSelectedPreviewSlots([]);
    setPreviewResult(null);
    setCreatedScheduleId('');
    setActionError('');
    setActionMessage('Đã đặt lại form tạo lịch.');
    handleStepSelect(1);
  }

  async function handleCreate(status) {
    setActionError('');
    setActionMessage('');
    setIsPublishMenuOpen(false);

    if (localWarnings.length > 0) {
      const message = localWarnings[0];
      setActionError(message);
      emitSchedulingNotification({
        title: 'Chưa thể tạo lịch',
        body: message,
        tone: 'warning',
        to: '/scheduling/create',
      });
      handleStepSelect(4);
      return;
    }
    if (!realDataReady || totalSlotCount <= 0 || conflictCount > 0) {
      const message = submitBlockReason || 'Lịch chưa đủ điều kiện để tạo.';
      setActionError(message);
      emitSchedulingNotification({
        title: 'Tạo lịch không thành công',
        body: message,
        tone: 'danger',
        to: '/scheduling/create',
      });
      handleStepSelect(4);
      return;
    }

    setIsSubmitting(true);
    try {
      let preview = previewResult;
      if (!preview || preview.can_create === false) {
        preview = await runPreviewCheck();
      }
      if (preview && preview.can_create === false) {
        const message = preview.warnings?.[0]?.message || 'Lịch chưa đạt điều kiện để tạo.';
        setActionError(message);
        emitSchedulingNotification({
          title: 'Tạo lịch không thành công',
          body: message,
          tone: 'danger',
          to: '/scheduling/create',
        });
        return;
      }

      const result = await actions.createScheduleFromForm(buildActionForm(status));
      const scheduleId = result?.schedule?.doctor_schedule_id || result?.schedule?.id || result?.doctor_schedule_id || '';
      const message = buildScheduleCreateMessage(result?.notification, status);
      setCreatedScheduleId(scheduleId);
      setActionMessage(message);
      emitSchedulingNotification({
        title: result?.notification?.title || (status === 'published' ? 'Đã công khai lịch bác sĩ' : 'Đã lưu nháp lịch bác sĩ'),
        body: message,
        tone: result?.notification?.type === 'schedule.updated_existing' ? 'info' : 'success',
        to: scheduleId ? `/scheduling/schedules/${scheduleId}` : '/scheduling/schedules',
      });
      setCreateStep(CREATE_STEPS.length);
    } catch (createError) {
      const message = createError.message || 'Máy chủ chưa tạo được lịch. Vui lòng kiểm tra lại.';
      setActionError(message);
      emitSchedulingNotification({
        title: 'Tạo lịch không thành công',
        body: message,
        tone: 'danger',
        to: '/scheduling/create',
      });
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
    if (next === CREATE_STEPS.length) {
      runPreviewCheck();
    }
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
          <button type="button" onClick={() => handleCreate('draft')} disabled={!canTrySubmit}>
            <Save size={16} strokeWidth={2.35} aria-hidden="true" />
            {isSubmitting ? 'Đang lưu' : 'Lưu nháp'}
          </button>
          <div className="scheduling-create-command__publish">
            <button type="button" className="is-primary" onClick={() => handleCreate('published')} disabled={!canTrySubmit}>
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
                <button type="button" disabled={!canTrySubmit} onClick={() => {
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
                    <DatePickerField
                      name="date"
                      value={form.date}
                      openSelect={openSelect}
                      setOpenSelect={setOpenSelect}
                      onSelect={updateFormValue}
                    />
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
                      <TimePickerField
                        name="start"
                        value={form.start}
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onSelect={updateFormValue}
                      />
                    </label>
                    <label className="scheduling-create-field is-required">
                      <span>Giờ kết thúc</span>
                      <TimePickerField
                        name="end"
                        value={form.end}
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onSelect={updateFormValue}
                      />
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
                      <TimePickerField
                        name="breakStart"
                        value={form.breakStart}
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onSelect={updateFormValue}
                        disabled={!form.hasBreak}
                      />
                    </label>
                    <label className="scheduling-create-field is-required">
                      <span>Kết thúc nghỉ</span>
                      <TimePickerField
                        name="breakEnd"
                        value={form.breakEnd}
                        openSelect={openSelect}
                        setOpenSelect={setOpenSelect}
                        onSelect={updateFormValue}
                        disabled={!form.hasBreak}
                      />
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
                          <TimePickerField
                            name={`extra-${item.id}-start`}
                            value={item.start}
                            openSelect={openSelect}
                            setOpenSelect={setOpenSelect}
                            onSelect={(_, nextValue) => handleExtraBreakChange(item.id, 'start', nextValue)}
                          />
                          <TimePickerField
                            name={`extra-${item.id}-end`}
                            value={item.end}
                            openSelect={openSelect}
                            setOpenSelect={setOpenSelect}
                            onSelect={(_, nextValue) => handleExtraBreakChange(item.id, 'end', nextValue)}
                          />
                          <button type="button" className="is-remove" aria-label="Xóa khoảng nghỉ" onClick={() => handleRemoveBreak(item.id)}>
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
                <button type="button" onClick={handleResetForm}>Đặt lại form</button>
                <div>
                  <button type="button" className="is-primary" onClick={handleContinueStep}>
                    <span>
                      {createStep >= CREATE_STEPS.length ? 'Kiểm tra lại' : 'Xem trước & tạo lịch'}
                      <small>{createStep >= CREATE_STEPS.length ? 'Cập nhật kiểm tra' : 'Sang bước xác nhận'}</small>
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
                  <span><i className="is-morning" /> Ca sáng</span>
                  <span><i className="is-afternoon" /> Ca chiều</span>
                  <span><i className="is-evening" /> Ca tối</span>
                  <span><i className="is-duty" /> Trực đêm</span>
                  <span><i className="is-break" /> Nghỉ giải lao</span>
                </div>
              </div>
              <div className="scheduling-create-slot-list">
                {visualSlotPreview.map((slot, index) => (
                  <button
                    key={`${slot.type}-${slot.value}-${index}`}
                    type="button"
                    className={`is-${slot.type} ${slot.shift ? `is-${slot.shift}` : ''} ${selectedSlotSet.has(slot.value) ? 'is-selected' : ''}`}
                    disabled={slot.type !== 'slot'}
                    onClick={() => togglePreviewSlot(slot.value)}
                  >
                    {slot.type === 'break' ? (
                      <>
                        <strong>Nghỉ</strong>
                        <small>{slot.range}</small>
                      </>
                    ) : slot.type === 'closed' ? (
                      <>
                        <strong>{slot.label}</strong>
                        <small>{slot.range}</small>
                      </>
                    ) : slot.type === 'duty' ? (
                      <>
                        <strong>{slot.value}</strong>
                        <small>Trực đêm</small>
                      </>
                    ) : slot.value}
                  </button>
                ))}
              </div>
              <div className="scheduling-create-preview-actions">
                <div>
                  <strong>{canSubmit ? 'Lịch đã sẵn sàng để tạo' : 'Chưa thể tạo lịch'}</strong>
                  <span>
                    {canSubmit
                      ? `${totalSlotCount} slot đặt khám, ${blockedBreakSlots} slot nghỉ/chuyển ca hoặc trực.`
                      : (submitBlockReason || serverWarnings[0]?.message || 'Bấm kiểm tra để cập nhật trạng thái lịch.')}
                  </span>
                </div>
                <button type="button" onClick={runPreviewCheck} disabled={!realDataReady || isChecking}>
                  <ShieldCheck size={14} strokeWidth={2.4} aria-hidden="true" />
                  {isChecking ? 'Đang kiểm tra' : 'Kiểm tra'}
                </button>
                <button type="button" onClick={() => handleCreate('draft')} disabled={!canTrySubmit}>
                  <Save size={14} strokeWidth={2.4} aria-hidden="true" />
                  {isSubmitting ? 'Đang lưu' : 'Lưu nháp'}
                </button>
                <button type="button" className="is-primary" onClick={() => handleCreate('published')} disabled={!canTrySubmit}>
                  <Check size={14} strokeWidth={2.55} aria-hidden="true" />
                  {isSubmitting ? 'Đang xử lý' : 'Công khai lịch'}
                </button>
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
                    <dt>Slot khóa do nghỉ/chuyển ca</dt>
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
                {operationalWarnings.map((warning) => (
                  <li key={warning} className="is-warning"><AlertTriangle size={14} strokeWidth={2.6} />{warning}</li>
                ))}
                {!localWarnings.length && !serverWarnings.length && !operationalWarnings.length ? (
                  <>
                    <li><Check size={14} strokeWidth={2.6} />Không phát hiện xung đột lịch</li>
                    <li><Check size={14} strokeWidth={2.6} />Bác sĩ thuộc khoa đã chọn</li>
                    <li><Check size={14} strokeWidth={2.6} />Khung giờ khám nằm trong ca sáng, chiều hoặc tối</li>
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
