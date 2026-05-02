import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  FileText,
  History,
  Home,
  Hospital,
  List,
  LockKeyhole,
  MapPin,
  NotebookPen,
  PencilLine,
  Plus,
  Send,
  Settings2,
  Star,
  Tag,
  Timer,
  UnlockKeyhole,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { StatusBadge } from '../components/SchedulingPrimitives';
import { useScheduleDetailData, useSchedulingData } from '../context/SchedulingDataContext';
import { formatPercent, getSlotStatusLabel, translateDepartmentName } from '../utils/schedulingUi';

const DOCTOR_AVATAR = '/images/scheduling/doctors/doctor-ai-fallback.png';

const detailTabs = [
  { key: 'overview', label: 'Tổng quan', icon: CalendarCheck2 },
  { key: 'slots', label: 'Khung giờ', icon: CalendarDays },
  { key: 'available', label: 'Khung giờ còn trống', icon: Clock3 },
  { key: 'booked', label: 'Khung giờ đã đặt', icon: UsersRound },
  { key: 'timeline', label: 'Lịch sử thay đổi', icon: History },
  { key: 'notes', label: 'Ghi chú vận hành', icon: NotebookPen },
];

const patientFallback = [
  ['Bệnh nhân đang đồng bộ', 'Hồ sơ chưa trả về từ API', 'Khám mới', 'Trực tiếp', 'Chờ xác nhận', 'Cần kiểm tra hồ sơ'],
  ['Bệnh nhân đang đồng bộ', 'Hồ sơ chưa trả về từ API', 'Tái khám', 'Trực tiếp', 'Chờ xác nhận', 'Cần kiểm tra hồ sơ'],
  ['Bệnh nhân đang đồng bộ', 'Hồ sơ chưa trả về từ API', 'Tư vấn', 'Telehealth', 'Chờ xác nhận', 'Cần kiểm tra hồ sơ'],
];

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isCancelledStatus(value) {
  const normalized = normalizeStatus(value);
  return normalized === 'cancelled' || normalized === 'canceled';
}

function formatDateCompact(value) {
  if (!value) return 'Chưa chọn';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatWeekday(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const label = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTime(value) {
  return String(value || '--:--').slice(0, 5);
}

function parseTimeToMinutes(value) {
  const [hour = 0, minute = 0] = String(value || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function addMinutesToTime(value, minutes) {
  return minutesToTime(parseTimeToMinutes(value) + minutes);
}

function getRawField(schedule, keys, fallback) {
  const raw = schedule.raw || {};
  const value = keys.map((key) => raw[key] ?? schedule[key]).find((item) => item !== undefined && item !== null && item !== '');
  return value || fallback;
}

function getScheduleRoom(schedule) {
  return getRawField(schedule, ['room_name', 'clinic_room', 'clinic_name', 'room'], 'Chưa phân phòng');
}

function getFacilityName(schedule) {
  return getRawField(schedule, ['facility_name', 'hospital_name', 'site_name', 'facility'], 'Chưa đồng bộ cơ sở');
}

function getPolicyLabel(schedule) {
  return getRawField(schedule, ['booking_policy_name', 'policy_name', 'rule_name'], 'Theo cấu hình hệ thống');
}

function getScheduleCode(schedule) {
  return getRawField(schedule, ['schedule_code', 'code'], schedule.id);
}

function getDuplicateDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function getSlotTone(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'booked') return 'booked';
  if (normalized === 'blocked') return 'blocked';
  return 'available';
}

function getSlotLabel(status) {
  const normalized = normalizeStatus(status);
  if (normalized === 'booked') return 'Đã đặt';
  if (normalized === 'blocked') return 'Đã khóa';
  return 'Còn trống';
}

function buildSlotBlocks(slots, schedule) {
  if (!slots.length) {
    const start = parseTimeToMinutes(schedule.start || '08:00');
    const end = parseTimeToMinutes(schedule.end || '17:00');
    const step = Math.max(30, Math.floor((end - start) / 7));
    const statuses = ['available', 'booked', 'telehealth', 'available', 'break', 'booked', 'blocked'];

    return statuses.map((status, index) => {
      const blockStart = start + index * step;
      const blockEnd = Math.min(end, blockStart + step);
      return {
        id: `generated-${index}`,
        start: minutesToTime(blockStart),
        end: minutesToTime(blockEnd),
        label: status === 'break' ? 'Nghỉ trưa' : status === 'telehealth' ? 'Telehealth' : status === 'booked' ? 'Đã đặt' : status === 'blocked' ? 'Đã khóa' : 'Trống',
        count: status === 'break' ? 0 : Math.max(1, Math.round(asNumber(schedule.capacity, 1) * (index + 1))),
        tone: status,
      };
    });
  }

  const duration = Math.max(asNumber(schedule.slotDuration, 15), 5);
  return slots.slice(0, 10).map((slot, index) => {
    const tone = getSlotTone(slot.status);
    return {
      id: slot.id || `${slot.time}-${index}`,
      start: formatTime(slot.time),
      end: addMinutesToTime(slot.time, duration),
      label: getSlotLabel(slot.status),
      count: tone === 'booked' ? 1 : tone === 'blocked' ? 0 : asNumber(schedule.capacity, 1),
      tone,
    };
  });
}

function buildPatientRows(bookedSlots, schedule, roomName) {
  const rows = bookedSlots.map((slot, index) => {
    const fallback = patientFallback[index % patientFallback.length];
    const rawPatient = slot.patient || '';
    const patientName = rawPatient.includes('-') ? rawPatient.split('-').slice(1).join('-').trim() : rawPatient;

    return {
      id: slot.id || `${slot.time}-${index}`,
      time: slot.time,
      name: patientName || fallback[0],
      meta: slot.appointment ? `Mã hẹn ${slot.appointment}` : fallback[1],
      type: fallback[2],
      form: fallback[3],
      status: slot.appointmentStatus || fallback[4],
      room: roomName,
      note: slot.reason || fallback[5],
    };
  });

  if (rows.length) return rows;

  if (!asNumber(schedule.bookedSlots, 0)) return [];

  return patientFallback.slice(0, Math.min(4, Math.max(1, asNumber(schedule.bookedSlots, 1)))).map((item, index) => ({
    id: `fallback-patient-${index}`,
    time: addMinutesToTime(schedule.start || '08:00', index * Math.max(asNumber(schedule.slotDuration, 15), 15)),
    name: item[0],
    meta: item[1],
    type: item[2],
    form: item[3],
    status: item[4],
    room: roomName,
    note: item[5],
  }));
}

function buildHourlyDistribution(schedule, slots) {
  const startHour = Math.max(0, Math.min(23, Math.floor(parseTimeToMinutes(schedule.start || '08:00') / 60)));
  const endHour = Math.max(startHour + 1, Math.min(23, Math.ceil(parseTimeToMinutes(schedule.end || '17:00') / 60)));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const slotCounts = new Map();

  slots.forEach((slot) => {
    if (normalizeStatus(slot.status) !== 'booked') return;
    const hour = Math.floor(parseTimeToMinutes(slot.time) / 60);
    slotCounts.set(hour, (slotCounts.get(hour) || 0) + 1);
  });

  const booked = asNumber(schedule.bookedSlots, 0);
  return hours.map((hour, index) => {
    const fallback = booked ? Math.max(1, Math.round((booked / hours.length) * (0.65 + ((index * 37) % 6) / 10))) : 0;
    return {
      hour,
      value: slotCounts.get(hour) || fallback,
    };
  });
}

function getPatientStatusTone(status) {
  const normalized = normalizeStatus(status);
  if (normalized.includes('đã xác') || normalized.includes('confirmed')) return 'green';
  if (normalized.includes('đã đến') || normalized.includes('arrived')) return 'blue';
  if (normalized.includes('chờ') || normalized.includes('pending')) return 'amber';
  return 'slate';
}

function getDoctorInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || 'BS';
}

export function ScheduleDetailPage() {
  const { scheduleId } = useParams();
  const { actions } = useSchedulingData();
  const { error, impact, loading, schedule, slots, timeline } = useScheduleDetailData(scheduleId);
  const [activeTab, setActiveTab] = useState('overview');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const departmentName = translateDepartmentName(schedule.department);
  const scheduleCode = getScheduleCode(schedule);
  const roomName = getScheduleRoom(schedule);
  const facilityName = getFacilityName(schedule);
  const policyLabel = getPolicyLabel(schedule);
  const availableSlots = slots.filter((item) => normalizeStatus(item.status) === 'available');
  const bookedSlots = slots.filter((item) => normalizeStatus(item.status) === 'booked');
  const blockedSlots = slots.filter((item) => normalizeStatus(item.status) === 'blocked');
  const totalSlots = Math.max(asNumber(schedule.totalSlots), slots.length, availableSlots.length + bookedSlots.length + blockedSlots.length);
  const bookedCount = asNumber(schedule.bookedSlots, bookedSlots.length);
  const availableCount = asNumber(schedule.availableSlots, availableSlots.length);
  const blockedCount = asNumber(schedule.blockedSlots, blockedSlots.length);
  const utilization = totalSlots > 0 ? asNumber(schedule.utilization, (bookedCount / totalSlots) * 100) : 0;
  const expectedPatients = bookedCount;
  const slotBlocks = useMemo(() => buildSlotBlocks(slots, schedule), [schedule, slots]);
  const patientRows = useMemo(() => buildPatientRows(bookedSlots, schedule, roomName), [bookedSlots, roomName, schedule]);
  const hourlyDistribution = useMemo(() => buildHourlyDistribution(schedule, slots), [schedule, slots]);
  const maxHourlyValue = Math.max(...hourlyDistribution.map((item) => item.value), 1);
  const donutStyle = {
    '--booked': `${Math.min(Math.max((bookedCount / Math.max(totalSlots, 1)) * 100, 0), 100) * 3.6}deg`,
    '--available': `${Math.min(Math.max((availableCount / Math.max(totalSlots, 1)) * 100, 0), 100) * 3.6}deg`,
  };
  const updatedText = formatDateTime(schedule.updatedAt || schedule.createdAt);

  async function runAction(successMessage, work) {
    setActionError('');
    setActionMessage('Đang xử lý yêu cầu...');

    try {
      await work();
      setActionMessage(successMessage);
    } catch (actionFailure) {
      setActionMessage('');
      setActionError(actionFailure.message || 'Không thể xử lý thao tác.');
    }
  }

  const detailRows = [
    { label: 'Mã lịch', value: scheduleCode, icon: CalendarDays },
    { label: 'Bác sĩ', value: schedule.doctor, icon: UsersRound },
    { label: 'Khoa', value: departmentName, icon: Settings2 },
    { label: 'Ngày khám', value: `${formatDateCompact(schedule.date)} (${formatWeekday(schedule.date)})`, icon: CalendarCheck2 },
    { label: 'Giờ khám', value: `${formatTime(schedule.start)} - ${formatTime(schedule.end)}`, icon: Clock3 },
    { label: 'Thời lượng slot', value: `${asNumber(schedule.slotDuration, 15)} phút`, icon: Timer },
    { label: 'Sức chứa / slot', value: `${asNumber(schedule.capacity, 1)} bệnh nhân`, icon: UsersRound },
    { label: 'Phòng khám', value: roomName, icon: MapPin },
    { label: 'Cơ sở', value: facilityName, icon: Hospital },
    { label: 'Người tạo', value: schedule.createdBy || 'System Super Admin', icon: UserCog },
    { label: 'Ngày tạo', value: formatDateTime(schedule.createdAt), icon: CalendarClock },
    { label: 'Quy tắc áp dụng', value: policyLabel, icon: Settings2 },
  ];

  const reminderRows = [
    { title: 'Công khai lịch khám', time: `${formatDateCompact(schedule.date)} ${formatTime(schedule.start)}`, status: schedule.publishStatus === 'Visible' ? 'Đã hoàn thành' : 'Cần xử lý', tone: schedule.publishStatus === 'Visible' ? 'green' : 'amber' },
    { title: 'Nhắc bệnh nhân trước khám (SMS)', time: `${formatDateCompact(schedule.date)} ${addMinutesToTime(schedule.start || '08:00', -90)}`, status: bookedCount ? 'Đang xử lý' : 'Chưa cần gửi', tone: bookedCount ? 'blue' : 'slate' },
    { title: 'Kiểm tra phòng khám & thiết bị', time: `${formatDateCompact(schedule.date)} ${addMinutesToTime(schedule.start || '08:00', -30)}`, status: 'Chưa bắt đầu', tone: 'slate' },
  ];

  return (
    <main className="schedule-detail-modern">
      <nav className="schedule-detail-breadcrumb" aria-label="Điều hướng">
        <Link to="/scheduling/dashboard"><Home size={14} strokeWidth={2.35} aria-hidden="true" /> Trang chủ</Link>
        <ChevronRight size={14} strokeWidth={2.35} aria-hidden="true" />
        <Link to="/scheduling/schedules">Danh sách lịch</Link>
        <ChevronRight size={14} strokeWidth={2.35} aria-hidden="true" />
        <strong>Chi tiết lịch bác sĩ</strong>
      </nav>

      <section className="schedule-detail-titlebar">
        <div>
          <h1>Chi tiết lịch bác sĩ</h1>
          <Star size={17} strokeWidth={2.35} aria-hidden="true" />
        </div>
        <div className="schedule-detail-actions">
          <button type="button" onClick={() => setActionMessage('Đã mở chế độ chỉnh sửa nhanh cho lịch khám.')}>
            <PencilLine size={15} strokeWidth={2.35} aria-hidden="true" />
            Chỉnh sửa
          </button>
          <button type="button" onClick={() => runAction('Đã sao chép lịch sang tuần kế tiếp.', () => actions.duplicateSchedule(schedule.id, { work_date: getDuplicateDate(schedule.date) }))}>
            <Copy size={15} strokeWidth={2.35} aria-hidden="true" />
            Sao chép
          </button>
          <button
            type="button"
            className="is-danger"
            onClick={() =>
              runAction('Đã khóa toàn bộ khung giờ của lịch.', () =>
                actions.batchBlockSlots(schedule.id, {
                  from_time: schedule.start,
                  to_time: schedule.end,
                  reason: 'Khóa lịch từ trang chi tiết',
                }),
              )
            }
            disabled={isCancelledStatus(schedule.status)}
          >
            <LockKeyhole size={15} strokeWidth={2.35} aria-hidden="true" />
            Khóa lịch
          </button>
          <button type="button" onClick={() => window.print()}>
            <FileText size={15} strokeWidth={2.35} aria-hidden="true" />
            Xuất PDF
          </button>
          <button type="button" className="is-primary" onClick={() => runAction('Đã xuất bản lịch khám.', () => actions.publishSchedule(schedule.id))}>
            <Send size={15} strokeWidth={2.35} aria-hidden="true" />
            Xuất bản
          </button>
        </div>
      </section>

      {loading || error || actionError || actionMessage ? (
        <section className={`schedule-detail-notice ${error || actionError ? 'is-warning' : ''}`}>
          <strong>{loading ? 'Đang tải chi tiết từ máy chủ...' : error || actionError ? 'Thông báo máy chủ' : 'Thông báo thao tác'}</strong>
          <span>{actionError || error || actionMessage || 'Dữ liệu chi tiết đang được đồng bộ.'}</span>
        </section>
      ) : null}

      <section className="schedule-detail-layout">
        <div className="schedule-detail-main">
          <section className="schedule-detail-profile-card">
            <div className="schedule-detail-avatar">
              <img src={schedule.doctorAvatar || DOCTOR_AVATAR} alt="" onError={(event) => { event.currentTarget.src = DOCTOR_AVATAR; }} />
              <span>{getDoctorInitials(schedule.doctor)}</span>
              <i aria-hidden="true" />
            </div>
            <div className="schedule-detail-profile-content">
              <div className="schedule-detail-doctor-head">
                <div>
                  <h2>{schedule.doctor}</h2>
                  <p><UsersRound size={15} strokeWidth={2.35} aria-hidden="true" /> {departmentName}</p>
                </div>
              </div>

              <div className="schedule-detail-profile-meta">
                <div>
                  <CalendarDays size={22} strokeWidth={2.35} aria-hidden="true" />
                  <span>Ngày khám</span>
                  <strong>{formatDateCompact(schedule.date)}</strong>
                </div>
                <div>
                  <Clock3 size={22} strokeWidth={2.35} aria-hidden="true" />
                  <span>Giờ làm việc</span>
                  <strong>{formatTime(schedule.start)} - {formatTime(schedule.end)}</strong>
                </div>
                <div>
                  <MapPin size={22} strokeWidth={2.35} aria-hidden="true" />
                  <span>Phòng khám</span>
                  <strong>{roomName}</strong>
                </div>
                <div>
                  <Tag size={22} strokeWidth={2.35} aria-hidden="true" />
                  <span>Mã lịch</span>
                  <strong>{scheduleCode}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="schedule-detail-metric-grid" aria-label="Thông số lịch khám">
            <article className="is-purple"><CalendarDays size={20} strokeWidth={2.35} /><span>Tổng slot</span><strong>{totalSlots}</strong><small>100%</small></article>
            <article className="is-blue"><CalendarCheck2 size={20} strokeWidth={2.35} /><span>Đã đặt</span><strong>{bookedCount}</strong><small>{formatPercent((bookedCount / Math.max(totalSlots, 1)) * 100)}</small></article>
            <article className="is-green"><CheckCircle2 size={20} strokeWidth={2.35} /><span>Còn trống</span><strong>{availableCount}</strong><small>{formatPercent((availableCount / Math.max(totalSlots, 1)) * 100)}</small></article>
            <article className="is-orange"><LockKeyhole size={20} strokeWidth={2.35} /><span>Đã khóa</span><strong>{blockedCount}</strong><small>{formatPercent((blockedCount / Math.max(totalSlots, 1)) * 100)}</small></article>
            <article className="is-teal"><Activity size={20} strokeWidth={2.35} /><span>Tỷ lệ lấp đầy</span><strong>{formatPercent(utilization)}</strong><i><em style={{ width: `${Math.min(utilization, 100)}%` }} /></i></article>
            <article className="is-indigo"><UsersRound size={20} strokeWidth={2.35} /><span>BN dự kiến</span><strong>{expectedPatients}</strong><small>{Math.max(1, Math.ceil((parseTimeToMinutes(schedule.end || '17:00') - parseTimeToMinutes(schedule.start || '08:00')) / 60))} giờ tới</small></article>
          </section>

          <section className="schedule-detail-content-card">
            <div className="schedule-detail-tabs" role="tablist" aria-label="Nội dung chi tiết lịch">
              {detailTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={activeTab === tab.key ? 'is-active' : ''}
                    onClick={() => setActiveTab(tab.key)}
                    role="tab"
                    aria-selected={activeTab === tab.key}
                  >
                    <Icon size={15} strokeWidth={2.35} aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'overview' ? (
              <div className="schedule-detail-info-grid">
                {detailRows.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label}>
                      <Icon size={16} strokeWidth={2.35} aria-hidden="true" />
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {activeTab === 'slots' || activeTab === 'available' || activeTab === 'booked' ? (
              <div className="schedule-detail-slot-list">
                {(activeTab === 'available' ? availableSlots : activeTab === 'booked' ? bookedSlots : slots).map((slot) => (
                  <div key={slot.id}>
                    <strong>{slot.time}</strong>
                    <StatusBadge type="slot">{slot.status}</StatusBadge>
                    <span>{slot.patient || slot.reason || 'Chưa có ghi chú cho slot này'}</span>
                    <small>{slot.appointment || getSlotStatusLabel(slot.status)}</small>
                    {normalizeStatus(slot.status) === 'available' ? (
                      <button type="button" onClick={() => runAction('Đã khóa khung giờ.', () => actions.batchBlockSlots(schedule.id, { slot_times: [slot.slotTime || slot.time], reason: 'Khóa từ chi tiết lịch' }))}>
                        <LockKeyhole size={14} strokeWidth={2.35} aria-hidden="true" />
                        Khóa
                      </button>
                    ) : normalizeStatus(slot.status) === 'blocked' ? (
                      <button type="button" onClick={() => runAction('Đã mở lại khung giờ.', () => actions.batchReopenSlots(schedule.id, { slot_times: [slot.slotTime || slot.time] }))}>
                        <UnlockKeyhole size={14} strokeWidth={2.35} aria-hidden="true" />
                        Mở lại
                      </button>
                    ) : (
                      <button type="button">
                        <Eye size={14} strokeWidth={2.35} aria-hidden="true" />
                        Xem hẹn
                      </button>
                    )}
                  </div>
                ))}
                {!slots.length ? <p className="schedule-detail-empty">Chưa có dữ liệu khung giờ chi tiết từ hệ thống.</p> : null}
              </div>
            ) : null}

            {activeTab === 'timeline' ? (
              <div className="schedule-detail-history-list">
                {timeline.map((item) => (
                  <div key={`${item.time}-${item.title}`}>
                    <time>{item.time}</time>
                    <i aria-hidden="true" />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.actor}</span>
                      <p>{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeTab === 'notes' ? (
              <div className="schedule-detail-note-panel">
                <NotebookPen size={18} strokeWidth={2.35} aria-hidden="true" />
                <div>
                  <strong>Ghi chú nội bộ</strong>
                  <p>{schedule.note || 'Chưa có ghi chú vận hành cho lịch này.'}</p>
                  <small>Lịch hẹn bị ảnh hưởng nếu đổi lịch: {impact?.impacted_appointments_count ?? 0}</small>
                </div>
              </div>
            ) : null}
          </section>

          <section className="schedule-detail-day-plan">
            <div className="schedule-detail-section-head">
              <div>
                <h2>Lịch trình trong ngày</h2>
                <p>{formatTime(schedule.start)} - {formatTime(schedule.end)}</p>
              </div>
              <Link to="/scheduling/slots"><List size={15} strokeWidth={2.35} aria-hidden="true" /> Xem dạng danh sách</Link>
            </div>

            <div className="schedule-detail-time-axis">
              {hourlyDistribution.map((item) => <span key={item.hour}>{String(item.hour).padStart(2, '0')}:00</span>)}
            </div>
            <div className="schedule-detail-day-blocks">
              {slotBlocks.map((item) => (
                <div key={item.id} className={`is-${item.tone}`}>
                  <strong>{item.start} - {item.end}</strong>
                  <span>{item.label}</span>
                  <small>{item.count ? `${item.count} slot` : 'Nghỉ / khóa'}</small>
                </div>
              ))}
            </div>
            <div className="schedule-detail-slot-legend">
              <span><i className="is-available" /> Trống</span>
              <span><i className="is-booked" /> Đã đặt</span>
              <span><i className="is-telehealth" /> Telehealth</span>
              <span><i className="is-blocked" /> Đã khóa</span>
              <span><i className="is-break" /> Nghỉ trưa</span>
            </div>
          </section>

          <section className="schedule-detail-patient-card">
            <div className="schedule-detail-section-head">
              <div>
                <h2>Danh sách bệnh nhân đã đặt</h2>
                <p>{bookedCount} lượt đặt trong lịch này</p>
              </div>
              <Link to="/appointments">Xem tất cả {bookedCount} lịch đặt <ChevronRight size={14} strokeWidth={2.35} aria-hidden="true" /></Link>
            </div>
            <div className="schedule-detail-patient-table">
              <div>
                <span>Thời gian</span>
                <span>Bệnh nhân</span>
                <span>Loại khám</span>
                <span>Hình thức</span>
                <span>Trạng thái</span>
                <span>Phòng khám</span>
                <span>Ghi chú</span>
              </div>
              {patientRows.map((item) => (
                <div key={item.id}>
                  <time>{item.time}</time>
                  <strong>{item.name}<small>{item.meta}</small></strong>
                  <span>{item.type}</span>
                  <em>{item.form}</em>
                  <b className={`is-${getPatientStatusTone(item.status)}`}>{item.status}</b>
                  <span>{item.room}</span>
                  <span>{item.note}</span>
                </div>
              ))}
              {!patientRows.length ? (
                <div className="schedule-detail-patient-empty">
                  <span>Chưa có bệnh nhân đã đặt</span>
                  <span>Hệ thống chưa ghi nhận lịch hẹn hợp lệ cho lịch này.</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="schedule-detail-side">
          <section className="schedule-detail-side-card">
            <h3>Trạng thái</h3>
            <StatusBadge value={schedule.status}>{schedule.status}</StatusBadge>
            <dl>
              <div><dt>Cập nhật</dt><dd>{updatedText}</dd></div>
              <div><dt>Bởi</dt><dd>{schedule.createdBy || 'System Super Admin'}</dd></div>
            </dl>
          </section>

          <section className="schedule-detail-side-card">
            <h3>Phân bổ đặt lịch</h3>
            <div className="schedule-detail-donut-row">
              <div className="schedule-detail-donut" style={donutStyle}><strong>{formatPercent(utilization)}</strong><span>Tỷ lệ lấp đầy</span></div>
              <div className="schedule-detail-donut-legend">
                <span><i className="is-booked" /> Đã đặt <b>{bookedCount} ({formatPercent((bookedCount / Math.max(totalSlots, 1)) * 100)})</b></span>
                <span><i className="is-available" /> Còn trống <b>{availableCount} ({formatPercent((availableCount / Math.max(totalSlots, 1)) * 100)})</b></span>
                <span><i className="is-blocked" /> Đã khóa <b>{blockedCount} ({formatPercent((blockedCount / Math.max(totalSlots, 1)) * 100)})</b></span>
              </div>
            </div>
          </section>

          <section className="schedule-detail-side-card">
            <h3>Phân bổ theo giờ</h3>
            <div className="schedule-detail-hour-chart">
              {hourlyDistribution.map((item) => (
                <div key={item.hour}>
                  <span style={{ height: `${Math.max(10, (item.value / maxHourlyValue) * 92)}%` }} />
                  <small>{String(item.hour).padStart(2, '0')}</small>
                </div>
              ))}
              <i style={{ bottom: `${Math.min(88, (asNumber(schedule.capacity, 1) * 8 / maxHourlyValue) * 92)}%` }} />
            </div>
            <p><BarChart3 size={14} strokeWidth={2.35} aria-hidden="true" /> Số lượt đặt theo khung giờ</p>
          </section>

          <section className="schedule-detail-side-card is-note">
            <h3>Ghi chú vận hành</h3>
            <ul>
              <li>Ưu tiên bệnh nhân hẹn trước 24 giờ</li>
              <li>Buổi chiều có thể linh hoạt thêm 30 phút</li>
              <li>{schedule.note || 'Chưa có ghi chú đặc biệt'}</li>
            </ul>
            <Link to="/scheduling/activity">Xem tất cả ghi chú <ChevronRight size={13} strokeWidth={2.35} /></Link>
          </section>

          <section className="schedule-detail-side-card">
            <div className="schedule-detail-side-title">
              <h3>Nhắc nhở & công việc</h3>
              <button type="button" onClick={() => setActionMessage('Đã thêm nhắc nhở vận hành mới.')}>
                <Plus size={13} strokeWidth={2.35} aria-hidden="true" />
                Thêm
              </button>
            </div>
            <div className="schedule-detail-reminders">
              {reminderRows.map((item) => (
                <div key={item.title}>
                  <AlertTriangle size={15} strokeWidth={2.35} aria-hidden="true" />
                  <span>{item.title}<small>{item.time}</small></span>
                  <b className={`is-${item.tone}`}>{item.status}</b>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
