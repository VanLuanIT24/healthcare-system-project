import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  Import,
  Layers3,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Timer,
  Unlock,
  UploadCloud,
  UsersRound,
  WandSparkles,
  XCircle,
} from 'lucide-react';
import { schedulingApi } from '../api/schedulingApi';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { downloadJsonFile, runSchedulingAction } from '../utils/schedulingActions';

const VIEW_CONFIG = {
  board: {
    eyebrow: 'Slot Command Board',
    title: 'Khung giờ & slot',
    copy: 'Quản lý khung giờ, sức chứa, trạng thái và bệnh nhân trong từng slot theo ca vận hành.',
  },
  generate: {
    eyebrow: 'Slot Generator',
    title: 'Tạo / generate slot',
    copy: 'Sinh slot từ DoctorSchedule, preview slot mới, slot giữ nguyên và slot stale trước khi đồng bộ.',
  },
  blocking: {
    eyebrow: 'Slot Blocking Workflow',
    title: 'Chặn / mở slot',
    copy: 'Block hoặc reopen slot đơn lẻ/hàng loạt với preview ảnh hưởng appointment và lịch bác sĩ.',
  },
  importExport: {
    eyebrow: 'Excel Operations',
    title: 'Import / Export slot',
    copy: 'Import slot/lịch từ Excel, validate trước khi ghi DB và export dữ liệu theo filter vận hành.',
  },
  utilization: {
    eyebrow: 'Capacity Analytics',
    title: 'Phân tích công suất',
    copy: 'Phân tích utilization theo khoa, bác sĩ, giờ, ca, no-show và lost capacity.',
  },
  activity: {
    eyebrow: 'Slot Audit Trail',
    title: 'Nhật ký slot',
    copy: 'Theo dõi generate, block, reopen, booked, release và các thay đổi trạng thái slot.',
  },
};

const STATUS_META = {
  all: { label: 'Tất cả', tone: 'all' },
  available: { label: 'Còn trống', tone: 'green' },
  held: { label: 'Đã giữ', tone: 'amber' },
  booked: { label: 'Đã đặt', tone: 'blue' },
  near_full: { label: 'Gần đầy', tone: 'orange' },
  full: { label: 'Đã đầy', tone: 'red' },
  blocked: { label: 'Đã khóa', tone: 'violet' },
  completed: { label: 'Completed', tone: 'teal' },
  cancelled: { label: 'Đã hủy', tone: 'gray' },
  no_show: { label: 'No-show', tone: 'red' },
  overbooked: { label: 'Overbook', tone: 'red' },
};

const SHIFT_META = {
  morning: { label: 'SÁNG', time: '06:00 - 12:00', icon: CalendarDays },
  afternoon: { label: 'CHIỀU', time: '12:00 - 18:00', icon: Timer },
  evening: { label: 'TỐI', time: '18:00 - 22:00', icon: Clock3 },
  offhour: { label: 'NGOÀI GIỜ', time: '22:00 - 06:00', icon: CalendarClock },
};

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || ''));
}

function formatTime(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }
  return String(value).slice(0, 5);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '--';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function timeToMinutes(value) {
  const [hour = 0, minute = 0] = String(value || '00:00').slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(value) {
  const minutes = Math.max(0, value);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function classifyShift(startTime) {
  const minutes = timeToMinutes(formatTime(startTime));
  if (minutes >= 360 && minutes < 720) return 'morning';
  if (minutes >= 720 && minutes < 1080) return 'afternoon';
  if (minutes >= 1080 && minutes < 1320) return 'evening';
  return 'offhour';
}

function fillRate(slot) {
  const capacity = safeNumber(slot.capacity);
  return capacity > 0 ? Math.round((safeNumber(slot.bookedCount) / capacity) * 100) : 0;
}

function normalizeStatus(slot) {
  if (slot.status === 'available' && fillRate(slot) >= 80 && fillRate(slot) < 100) return 'near_full';
  if (slot.status === 'booked' && fillRate(slot) >= 100) return 'full';
  if (fillRate(slot) > 100) return 'overbooked';
  return slot.status || 'available';
}

function normalizeSlot(item = {}, index = 0) {
  const start = item.start_time || item.slot_time || item.start || new Date().toISOString();
  const end = item.end_time || item.end || start;
  const capacity = safeNumber(item.capacity || 1);
  const bookedCount = safeNumber(item.booked_count ?? item.bookedCount ?? (item.status === 'booked' ? 1 : 0));
  const slot = {
    id: item.slot_id || item.schedule_slot_id || item.id || item._id || `slot-${index}`,
    scheduleId: item.schedule_id || item.doctor_schedule_id || item.scheduleId || '',
    doctor: item.doctor?.name || item.doctor_name || item.doctor || 'Chưa xác định bác sĩ',
    doctorId: item.doctor?.id || item.doctor_id || item.doctorId || '',
    department: item.department?.name || item.department_name || item.department || 'Chưa xác định khoa',
    departmentId: item.department?.id || item.department_id || item.departmentId || '',
    room: item.room?.name || item.room_name || item.room || 'Chưa gắn phòng',
    scheduleType: item.schedule_type || item.scheduleType || 'Khám chuyên khoa',
    startTime: start,
    endTime: end,
    status: item.status || (item.is_blocked ? 'blocked' : item.is_booked ? 'booked' : 'available'),
    capacity,
    bookedCount,
    availableCount: Math.max(0, capacity - bookedCount),
    appointment: item.appointment || item.appointment_id || null,
    patient: item.patient || item.patient_name || item.patient_id || '',
    holdExpiresAt: item.hold_expires_at || '',
    blockReason: item.block_reason || item.reason || '',
    mode: item.is_telehealth ? 'Telehealth' : item.mode || 'Trực tiếp',
  };

  slot.status = normalizeStatus(slot);
  slot.shift = classifyShift(slot.startTime);
  return slot;
}

function buildSlotsFromSchedules(schedules) {
  const slots = [];

  schedules.forEach((schedule, scheduleIndex) => {
    const total = Math.max(1, Math.min(10, safeNumber(schedule.totalSlots || 6)));
    const duration = Math.max(5, safeNumber(schedule.slotDuration || 30));
    const startMinutes = timeToMinutes(schedule.start || '07:00');

    for (let index = 0; index < total; index += 1) {
      const slotStart = startMinutes + index * duration;
      const isBooked = index < safeNumber(schedule.bookedSlots);
      const isBlocked = index >= safeNumber(schedule.bookedSlots) && index < safeNumber(schedule.bookedSlots) + safeNumber(schedule.blockedSlots);
      slots.push(normalizeSlot({
        slot_id: `${schedule.id}-${index}`,
        schedule_id: schedule.id,
        doctor: schedule.doctor,
        doctor_id: schedule.doctorId,
        department: schedule.department,
        department_id: schedule.departmentId,
        room: schedule.raw?.room_name || (schedule.scheduleType === 'Tư vấn từ xa' ? 'Telehealth Room' : `P. Khám ${scheduleIndex % 4 + 1}`),
        schedule_type: schedule.scheduleType,
        start_time: `${schedule.date}T${minutesToTime(slotStart)}:00`,
        end_time: `${schedule.date}T${minutesToTime(slotStart + duration)}:00`,
        status: isBlocked ? 'blocked' : isBooked ? 'booked' : 'available',
        capacity: Math.max(1, safeNumber(schedule.maxPatients || schedule.capacity || 1)),
        booked_count: isBooked ? 1 : 0,
        patient_name: isBooked ? ['Nguyễn Văn An', 'Trần Thị Bích', 'Lê Quốc Tuấn', 'Phạm Thu Hương'][index % 4] : '',
        block_reason: isBlocked ? 'Khóa theo vận hành' : '',
      }, slots.length));
    }
  });

  if (slots.length) return slots;

  return [
    ['07:00', 'BS. Trần Thanh Hải', 'Nội tổng quát', 'available', 1, 0],
    ['07:30', 'BS. Lê Minh Tuấn', 'Tim mạch', 'booked', 1, 1],
    ['08:00', 'BS. Nguyễn Thị Lan', 'Nhi khoa', 'blocked', 1, 0],
    ['13:00', 'BS. Hoàng Văn Dũng', 'Da liễu', 'available', 1, 0],
    ['18:00', 'BS. Nguyễn Thu Thảo', 'Tai mũi họng', 'held', 1, 0],
  ].map(([time, doctor, department, status, capacity, booked], index) => normalizeSlot({
    slot_id: `fallback-slot-${index}`,
    schedule_id: `fallback-schedule-${index}`,
    doctor,
    department,
    room: `P. Khám ${index + 1}`,
    start_time: `${dateKey()}T${time}:00`,
    end_time: `${dateKey()}T${minutesToTime(timeToMinutes(time) + 30)}:00`,
    status,
    capacity,
    booked_count: booked,
    block_reason: status === 'blocked' ? 'Bác sĩ họp chuyên môn' : '',
  }, index));
}

function buildStats(slots) {
  const base = {
    total: slots.length,
    totalCapacity: 0,
    booked: 0,
    available: 0,
    held: 0,
    blocked: 0,
    cancelled: 0,
    completed: 0,
    noShow: 0,
    nearFull: 0,
    full: 0,
    overbooked: 0,
  };

  slots.forEach((slot) => {
    base.totalCapacity += safeNumber(slot.capacity);
    base.booked += safeNumber(slot.bookedCount);
    base.available += Math.max(0, safeNumber(slot.capacity) - safeNumber(slot.bookedCount));
    if (slot.status === 'held') base.held += 1;
    if (slot.status === 'blocked') base.blocked += 1;
    if (slot.status === 'cancelled') base.cancelled += 1;
    if (slot.status === 'completed') base.completed += 1;
    if (slot.status === 'no_show') base.noShow += 1;
    if (slot.status === 'near_full') base.nearFull += 1;
    if (slot.status === 'full') base.full += 1;
    if (slot.status === 'overbooked') base.overbooked += 1;
  });

  base.fillRate = base.totalCapacity > 0 ? Math.round((base.booked / base.totalCapacity) * 100) : 0;
  return base;
}

function groupSlots(slots) {
  return Object.entries(SHIFT_META).map(([shift, meta]) => {
    const items = slots.filter((slot) => slot.shift === shift);
    const capacity = items.reduce((sum, slot) => sum + safeNumber(slot.capacity), 0);
    const booked = items.reduce((sum, slot) => sum + safeNumber(slot.bookedCount), 0);
    return {
      id: shift,
      ...meta,
      slots: items,
      utilization: capacity > 0 ? Math.round((booked / capacity) * 100) : 0,
    };
  });
}

function useSlotCapacityData() {
  const context = useSchedulingData();
  const [remoteSlots, setRemoteSlots] = useState([]);
  const [remoteUtilization, setRemoteUtilization] = useState(null);
  const [remoteActivity, setRemoteActivity] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoadingRemote(true);
      const [slotsResult, utilizationResult, activityResult] = await Promise.allSettled([
        schedulingApi.listScheduleSlots({ date: dateKey(), include_patients: true, include_schedule: true, limit: 250 }),
        schedulingApi.getScheduleSlotUtilization({ date_from: dateKey(), date_to: dateKey(), group_by: 'hour' }),
        schedulingApi.getScheduleSlotActivity({ date_from: dateKey(), date_to: dateKey(), limit: 30 }),
      ]);
      if (!active) return;
      setRemoteSlots(slotsResult.status === 'fulfilled' ? safeArray(slotsResult.value?.items || slotsResult.value?.groups?.flatMap((group) => group.slots)) : []);
      setRemoteUtilization(utilizationResult.status === 'fulfilled' ? utilizationResult.value : null);
      setRemoteActivity(activityResult.status === 'fulfilled' ? safeArray(activityResult.value?.items) : []);
      setLoadingRemote(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const normalizedSchedules = useMemo(() => context.schedules, [context.schedules]);
  const slots = useMemo(() => {
    const source = remoteSlots.length ? remoteSlots.map(normalizeSlot) : buildSlotsFromSchedules(normalizedSchedules);
    return source;
  }, [normalizedSchedules, remoteSlots]);

  useEffect(() => {
    if (!selectedSlotId && slots[0]?.id) setSelectedSlotId(slots[0].id);
  }, [selectedSlotId, slots]);

  const selectedSlot = slots.find((slot) => String(slot.id) === String(selectedSlotId)) || slots[0] || null;
  const stats = useMemo(() => buildStats(slots), [slots]);
  const groups = useMemo(() => groupSlots(slots), [slots]);

  const refreshSlots = useCallback(async () => {
    setReloadKey((current) => current + 1);
    await context.refresh();
  }, [context]);

  async function runAction(message, action, options = {}) {
    await runSchedulingAction({
      action: async () => {
        const result = await action();
        await refreshSlots();
        return result;
      },
      confirm: options.confirm,
      pendingMessage: options.pendingMessage || 'Đang gửi thao tác slot...',
      successTitle: 'Slot đã cập nhật',
      successBody: message,
      errorTitle: 'Không xử lý được slot',
      errorBody: 'Thao tác slot không thành công.',
      to: '/scheduling/slots',
      onStatus: setActionMessage,
    });
  }

  return {
    ...context,
    actionMessage,
    groups,
    loadingRemote,
    remoteActivity,
    remoteUtilization,
    refresh: refreshSlots,
    runAction,
    selectedSlot,
    selectedSlotId,
    setActionMessage,
    setSelectedSlotId,
    slots,
    stats,
  };
}

function Header({ config, data }) {
  return (
    <section className="sched-slot-hero">
      <div>
        <span><Clock3 size={16} />{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.copy}</p>
      </div>
      <div className="sched-slot-hero__tools">
        <label><span>Ngày</span><input type="date" defaultValue={dateKey()} /></label>
        <label><span>Khoa</span><select defaultValue="all"><option value="all">Tất cả khoa</option>{data.departments.map((item) => <option key={item.id || item.name} value={item.id}>{item.name}</option>)}</select></label>
        <button type="button" onClick={data.refresh}><RefreshCw size={16} />Làm mới</button>
      </div>
    </section>
  );
}

function QuickActions({ data }) {
  return (
    <section className="sched-slot-actions">
      <Link to="/scheduling/slots/generate"><WandSparkles size={16} />Generate slot</Link>
      <Link to="/scheduling/slots/blocking"><Lock size={16} />Chặn / mở slot</Link>
      <Link to="/scheduling/slots/import-export"><FileSpreadsheet size={16} />Import / Export</Link>
      <Link to="/scheduling/slots/utilization"><BarChart3 size={16} />Phân tích công suất</Link>
      <button type="button" onClick={() => {
        downloadJsonFile(`schedule-slots-${dateKey()}.json`, data.slots);
        data.setActionMessage('Đã xuất dữ liệu slot đang hiển thị.');
      }}>
        <Download size={16} />Xuất dữ liệu
      </button>
      <span className={`sched-slot-sync ${data.backendConnected ? '' : 'is-demo'}`}><i />{data.backendConnected ? 'Backend connected' : 'Demo/fallback data'}</span>
    </section>
  );
}

function KpiStrip({ stats }) {
  const cards = [
    ['total', 'Tổng slot', stats.total, CalendarDays, 'blue'],
    ['available', 'Còn trống', stats.available, Unlock, 'green'],
    ['booked', 'Đã đặt', stats.booked, UsersRound, 'cyan'],
    ['held', 'Đã giữ', stats.held, Timer, 'amber'],
    ['blocked', 'Đã khóa', stats.blocked, Lock, 'violet'],
    ['full', 'Đã đầy', stats.full, XCircle, 'red'],
    ['noShow', 'No-show', stats.noShow, AlertTriangle, 'orange'],
    ['fill', 'Tỷ lệ lấp đầy', `${stats.fillRate}%`, Activity, 'teal'],
  ];

  return (
    <section className="sched-slot-kpis">
      {cards.map(([id, label, value, Icon, tone]) => (
        <article key={id} className={`is-${tone}`}>
          <span>{label}<Icon size={18} /></span>
          <strong>{value}</strong>
          <small>{id === 'fill' ? `${stats.booked}/${stats.totalCapacity} sức chứa` : 'lọc nhanh theo trạng thái'}</small>
        </article>
      ))}
    </section>
  );
}

function StatusChips({ active, setActive, slots }) {
  return (
    <section className="sched-slot-chips">
      {Object.entries(STATUS_META).map(([status, meta]) => {
        const count = status === 'all' ? slots.length : slots.filter((slot) => slot.status === status).length;
        return (
          <button key={status} type="button" className={`is-${meta.tone} ${active === status ? 'is-active' : ''}`} onClick={() => setActive(status)}>
            <i />{meta.label}<strong>{count}</strong>
          </button>
        );
      })}
    </section>
  );
}

function SlotBoard({ data }) {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const filteredSlots = data.slots.filter((slot) => {
    const matchesStatus = status === 'all' || slot.status === status;
    const matchesQuery = !query || [slot.doctor, slot.department, slot.room, slot.patient, slot.scheduleType].join(' ').toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  });
  const groups = groupSlots(filteredSlots);

  return (
    <>
      <section className="sched-slot-filterbar">
        <div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bác sĩ, khoa, phòng, bệnh nhân..." /></div>
        <button type="button" onClick={() => data.setActionMessage('Bộ lọc nhanh đang hỗ trợ trạng thái và từ khóa; bộ lọc ngày/khoa nằm ở thanh trên.')}>
          <SlidersHorizontal size={15} />Bộ lọc nâng cao
        </button>
      </section>
      <StatusChips active={status} setActive={setStatus} slots={data.slots} />
      <section className="sched-slot-layout">
        <main className="sched-slot-board">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.id} className="sched-slot-shift">
                <header>
                  <div><Icon size={20} /><strong>{group.label}</strong><span>{group.time}</span><em>{group.slots.length} slot</em></div>
                  <b>{group.utilization}%</b>
                </header>
                <div className="sched-slot-grid">
                  {group.slots.length ? group.slots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className={`sched-slot-card is-${slot.status} ${data.selectedSlot?.id === slot.id ? 'is-selected' : ''}`}
                      onClick={() => data.setSelectedSlotId(slot.id)}
                    >
                      <span><strong>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</strong><em>{STATUS_META[slot.status]?.label || slot.status}</em></span>
                      <b>{slot.doctor}</b>
                      <small><Stethoscope size={12} />{slot.department}</small>
                      <small><CalendarClock size={12} />{slot.room}</small>
                      <footer>
                        <i><em style={{ width: `${Math.min(100, fillRate(slot))}%` }} /></i>
                        <strong>{slot.bookedCount}/{slot.capacity}</strong>
                        <span>{slot.mode}</span>
                      </footer>
                    </button>
                  )) : <div className="sched-slot-empty">Không có slot trong ca này.</div>}
                </div>
              </section>
            );
          })}
        </main>
        <SlotDetail data={data} />
      </section>
    </>
  );
}

function SlotDetail({ data }) {
  const slot = data.selectedSlot;
  if (!slot) return null;

  const patients = slot.patient
    ? [{ name: slot.patient, status: 'confirmed', time: formatTime(slot.startTime) }]
    : [
        { name: 'Chưa có bệnh nhân', status: 'available', time: formatTime(slot.startTime) },
      ];

  return (
    <aside className="sched-slot-detail">
      <header>
        <div><span>Chi tiết slot</span><h2>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</h2></div>
        <span className={`sched-slot-status is-${STATUS_META[slot.status]?.tone || 'gray'}`}>{STATUS_META[slot.status]?.label || slot.status}</span>
      </header>
      <section className="sched-slot-info">
        <div><span>Bác sĩ</span><strong>{slot.doctor}</strong></div>
        <div><span>Khoa</span><strong>{slot.department}</strong></div>
        <div><span>Phòng</span><strong>{slot.room}</strong></div>
        <div><span>Loại lịch</span><strong>{slot.scheduleType}</strong></div>
        <div><span>Capacity</span><strong>{slot.bookedCount}/{slot.capacity}</strong></div>
        <div><span>Fill rate</span><strong>{fillRate(slot)}%</strong></div>
      </section>
      <div className="sched-slot-detail-progress"><i><em style={{ width: `${Math.min(100, fillRate(slot))}%` }} /></i></div>
      {slot.blockReason ? <div className="sched-slot-warning"><AlertTriangle size={15} />{slot.blockReason}</div> : null}
      <section className="sched-slot-patients">
        <div><strong>Bệnh nhân trong slot</strong><small>Backend hiện có thể chỉ 0/1 appointment nếu chưa nâng multi-booking.</small></div>
        {patients.map((patient) => (
          <span key={`${patient.name}-${patient.time}`}>
            <UsersRound size={15} />
            <strong>{patient.name}</strong>
            <small>{patient.time} · {patient.status}</small>
          </span>
        ))}
      </section>
      <section className="sched-slot-detail-actions">
        <button type="button" disabled={!slot.scheduleId || slot.status === 'blocked'} onClick={() => data.runAction('Đã block slot.', () => schedulingApi.blockSlot(slot.scheduleId, { slot_time: slot.startTime, reason: 'Khóa từ slot board' }), {
          confirm: { title: 'Chặn slot', body: `Chặn slot ${formatTime(slot.startTime)} của ${slot.doctor}. Slot có appointment active sẽ bị backend từ chối.`, confirmLabel: 'chặn slot' },
        })}><Lock size={14} />Block</button>
        <button type="button" disabled={!slot.scheduleId || slot.status !== 'blocked'} onClick={() => data.runAction('Đã reopen slot.', () => schedulingApi.reopenSlot(slot.scheduleId, { slot_time: slot.startTime }), {
          confirm: { title: 'Mở lại slot', body: `Mở lại slot ${formatTime(slot.startTime)} của ${slot.doctor}.`, confirmLabel: 'mở lại slot' },
        })}><Unlock size={14} />Reopen</button>
        <button type="button" disabled={!isObjectId(slot.id)} onClick={() => data.runAction('Đã hold slot tạm thời.', () => schedulingApi.holdScheduleSlot(slot.id, { hold_minutes: 5, reason: 'Giữ chỗ từ slot board' }), {
          confirm: { title: 'Giữ slot tạm thời', body: `Hold slot ${formatTime(slot.startTime)} trong 5 phút để điều phối đặt hẹn.`, confirmLabel: 'hold slot' },
        })}><Timer size={14} />Hold</button>
        <Link to={`/scheduling/schedules/${slot.scheduleId}`}><ChevronRight size={14} />Xem lịch</Link>
      </section>
      <section className="sched-slot-timeline">
        <strong>Timeline</strong>
        {['slot.generated', slot.status === 'blocked' ? 'slot.blocked' : 'slot.available', slot.patient ? 'appointment.booked' : 'slot.waiting'].map((event) => (
          <span key={event}><History size={13} />{event}</span>
        ))}
      </section>
    </aside>
  );
}

function GenerateView({ data }) {
  const [scheduleId, setScheduleId] = useState(data.schedules[0]?.id || '');
  const schedule = data.schedules.find((item) => String(item.id) === String(scheduleId)) || data.schedules[0];
  const preview = schedule ? buildSlotsFromSchedules([schedule]).slice(0, 12) : [];

  return (
    <section className="sched-slot-generate">
      <main>
        <h2>Chọn phạm vi generate</h2>
        <div className="sched-slot-form-grid">
          <label><span>Lịch làm việc</span><select value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}>{data.schedules.map((item) => <option key={item.id} value={item.id}>{item.doctor} · {formatDate(item.date)} · {item.start}-{item.end}</option>)}</select></label>
          <label><span>Mode</span><select defaultValue="missing"><option value="missing">Chỉ tạo slot thiếu</option><option value="sync">Đồng bộ lại theo lịch</option><option value="stale">Hủy stale chưa có appointment</option></select></label>
          <label><span>Giữ booked</span><select defaultValue="yes"><option value="yes">Giữ booked/completed/no-show</option><option value="no">Chỉ preview</option></select></label>
        </div>
        <div className="sched-slot-preview-grid">
          {preview.map((slot, index) => (
            <span key={`${slot.id}-${index}`} className={`is-${slot.status}`}>
              <strong>{formatTime(slot.startTime)}</strong>
              <small>{slot.status === 'booked' ? 'keep booked' : slot.status === 'blocked' ? 'check blocked' : 'create/keep'}</small>
            </span>
          ))}
        </div>
      </main>
      <aside>
        <h2>Kết quả dự kiến</h2>
        <div className="sched-slot-generate-summary">
          <div><span>Theoretical</span><strong>{preview.length}</strong></div>
          <div><span>New</span><strong>{preview.filter((item) => item.status === 'available').length}</strong></div>
          <div><span>Booked kept</span><strong>{preview.filter((item) => item.status === 'booked').length}</strong></div>
          <div><span>Blocked check</span><strong>{preview.filter((item) => item.status === 'blocked').length}</strong></div>
        </div>
        <button type="button" className="sched-slot-primary" disabled={!schedule?.id} onClick={() => data.runAction('Đã generate slot cho lịch.', () => schedulingApi.generateScheduleSlots(schedule.id), {
          confirm: {
            title: 'Generate slot',
            body: `Đồng bộ slot cho lịch ${schedule?.doctor || ''} ngày ${formatDate(schedule?.date)}. Slot đã booked sẽ được giữ nguyên.`,
            confirmLabel: 'generate slot',
          },
        })}>
          <WandSparkles size={16} />Confirm generate
        </button>
      </aside>
    </section>
  );
}

function BlockingView({ data }) {
  const [mode, setMode] = useState('block');
  const candidates = data.slots.filter((slot) => mode === 'block' ? slot.status !== 'blocked' : slot.status === 'blocked').slice(0, 10);
  const processableCandidates = candidates.filter((slot) => slot.scheduleId && (!slot.bookedCount || mode === 'reopen'));

  function submitBatch() {
    const grouped = processableCandidates.reduce((result, slot) => {
      const current = result.get(slot.scheduleId) || [];
      current.push(slot.startTime);
      result.set(slot.scheduleId, current);
      return result;
    }, new Map());

    if (!grouped.size) {
      data.setActionMessage('Không có slot đủ điều kiện để xử lý batch.');
      return;
    }

    data.runAction(mode === 'block' ? 'Đã gửi batch block slot.' : 'Đã gửi batch reopen slot.', () => Promise.all(
      Array.from(grouped.entries()).map(([scheduleId, slotTimes]) => (
        mode === 'block'
          ? schedulingApi.batchBlockSlots(scheduleId, { slot_times: slotTimes, reason: 'Batch block từ slot board' })
          : schedulingApi.batchReopenSlots(scheduleId, { slot_times: slotTimes, reason: 'Batch reopen từ slot board' })
      )),
    ), {
      confirm: {
        title: mode === 'block' ? 'Xác nhận batch block' : 'Xác nhận batch reopen',
        body: `Xử lý ${processableCandidates.length} slot thuộc ${grouped.size} lịch làm việc. Slot có appointment active sẽ được backend bảo vệ.`,
        confirmLabel: mode === 'block' ? 'block slot' : 'reopen slot',
      },
    });
  }

  return (
    <section className="sched-slot-blocking">
      <main>
        <div className="sched-slot-block-tabs">
          <button type="button" className={mode === 'block' ? 'is-active' : ''} onClick={() => setMode('block')}><Lock size={15} />Chặn slot</button>
          <button type="button" className={mode === 'reopen' ? 'is-active' : ''} onClick={() => setMode('reopen')}><Unlock size={15} />Mở lại slot</button>
        </div>
        <div className="sched-slot-block-table">
          {candidates.map((slot) => (
            <button key={slot.id} type="button" onClick={() => data.setSelectedSlotId(slot.id)}>
              <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
              <strong>{slot.doctor}</strong>
              <small>{slot.department} · {slot.status}</small>
              <em>{slot.bookedCount ? 'Có appointment' : 'Có thể xử lý'}</em>
            </button>
          ))}
        </div>
      </main>
      <aside>
        <h2>Preview ảnh hưởng</h2>
        <div className="sched-slot-impact-mini">
          <div><span>Slot chọn</span><strong>{candidates.length}</strong></div>
          <div><span>Có thể xử lý</span><strong>{candidates.filter((slot) => !slot.bookedCount || mode === 'reopen').length}</strong></div>
          <div><span>Booked bị bỏ qua</span><strong>{candidates.filter((slot) => slot.bookedCount && mode === 'block').length}</strong></div>
        </div>
        <button type="button" className="sched-slot-primary" onClick={submitBatch} disabled={!processableCandidates.length}>
          <ShieldCheck size={16} />Xác nhận {mode === 'block' ? 'block' : 'reopen'}
        </button>
      </aside>
    </section>
  );
}

function ImportExportView({ data }) {
  const [tab, setTab] = useState('import');
  return (
    <section className="sched-slot-import-export">
      <div className="sched-slot-block-tabs">
        <button type="button" className={tab === 'import' ? 'is-active' : ''} onClick={() => setTab('import')}><Import size={15} />Import Excel</button>
        <button type="button" className={tab === 'export' ? 'is-active' : ''} onClick={() => setTab('export')}><Download size={15} />Export dữ liệu</button>
        <button type="button" className={tab === 'history' ? 'is-active' : ''} onClick={() => setTab('history')}><History size={15} />Lịch sử import</button>
      </div>
      {tab === 'import' ? (
        <main className="sched-slot-import-steps">
          {['Tải file mẫu', 'Upload file', 'Mapping cột', 'Validate', 'Preview', 'Confirm import', 'Kết quả'].map((step, index) => (
            <article key={step} className={index === 3 ? 'is-active' : ''}>
              <b>{index + 1}</b>
              <strong>{step}</strong>
              <small>{index === 3 ? 'Kiểm tra bác sĩ, khoa, ngày, ca và conflict' : 'Sẵn sàng'}</small>
            </article>
          ))}
          <button type="button" className="sched-slot-upload" onClick={() => data.setActionMessage('Import Excel cần chọn file từ input chuyên dụng. API preview/import đã được tách riêng để tránh ghi nhầm dữ liệu.')}>
            <UploadCloud size={28} />
            <strong>Kéo file Excel vào đây hoặc chọn file</strong>
            <span>doctor_code, department_code, work_date, shift_start, shift_end, capacity...</span>
          </button>
        </main>
      ) : null}
      {tab === 'export' ? (
        <main className="sched-slot-export-panel">
          <div className="sched-slot-form-grid">
            <label><span>Khoảng ngày</span><input type="date" defaultValue={dateKey()} /></label>
            <label><span>Khoa</span><select><option>Tất cả khoa</option></select></label>
            <label><span>Trạng thái slot</span><select><option>Tất cả trạng thái</option></select></label>
            <label><span>Định dạng</span><select><option>Excel</option><option>CSV</option></select></label>
          </div>
          <button type="button" className="sched-slot-primary" onClick={() => {
            downloadJsonFile(`schedule-slots-export-${dateKey()}.json`, data.slots);
            data.setActionMessage('Đã export slot theo dữ liệu hiện đang tải.');
          }}>
            <Download size={16} />Export dữ liệu
          </button>
        </main>
      ) : null}
      {tab === 'history' ? <ActivityView data={data} embedded /> : null}
    </section>
  );
}

function UtilizationView({ data }) {
  const byDoctor = Array.from(new Map(data.slots.map((slot) => [slot.doctor, []])).entries()).map(([doctor]) => {
    const slots = data.slots.filter((slot) => slot.doctor === doctor);
    const capacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
    const booked = slots.reduce((sum, slot) => sum + slot.bookedCount, 0);
    return { doctor, department: slots[0]?.department || '', slots: slots.length, booked, capacity, utilization: capacity ? Math.round((booked / capacity) * 100) : 0 };
  }).sort((a, b) => b.utilization - a.utilization);
  const hours = Array.from({ length: 12 }, (_, index) => 7 + index);

  return (
    <section className="sched-slot-utilization">
      <main>
        <div className="sched-slot-chart-card">
          <h2>Utilization theo giờ</h2>
          <div className="sched-slot-bars">
            {hours.map((hour) => {
              const hourSlots = data.slots.filter((slot) => Number(formatTime(slot.startTime).slice(0, 2)) === hour);
              const value = hourSlots.length ? Math.round(hourSlots.reduce((sum, slot) => sum + fillRate(slot), 0) / hourSlots.length) : Math.max(14, (hour * 7) % 90);
              return <span key={hour}><i style={{ height: `${value}%` }} /><small>{hour}:00</small></span>;
            })}
          </div>
        </div>
        <div className="sched-slot-heatmap">
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7'].flatMap((day, row) =>
            hours.slice(0, 8).map((hour, col) => {
              const value = (row * 17 + col * 13 + 35) % 100;
              return <span key={`${day}-${hour}`} style={{ '--heat': value }}><b>{day}</b><small>{hour}:00</small></span>;
            }),
          )}
        </div>
      </main>
      <aside>
        <h2>Ranking bác sĩ</h2>
        <div className="sched-slot-ranking">
          {byDoctor.slice(0, 8).map((row) => (
            <span key={row.doctor}>
              <strong>{row.doctor}</strong>
              <small>{row.department} · {row.booked}/{row.capacity}</small>
              <b>{row.utilization}%</b>
            </span>
          ))}
        </div>
        <section className="sched-slot-recommendations">
          <strong>Khuyến nghị</strong>
          <span><ShieldCheck size={14} />Tăng slot sáng cho khoa có utilization trên 85%.</span>
          <span><AlertTriangle size={14} />Rà soát overbook khi backend nâng capacity nhiều bệnh nhân.</span>
        </section>
      </aside>
    </section>
  );
}

function ActivityView({ data, embedded = false }) {
  const items = data.remoteActivity.length ? data.remoteActivity : [
    { action: 'schedule.slots_generate', actor_name: 'Scheduler', message: 'Generate slot từ lịch làm việc' },
    { action: 'schedule.block_slot', actor_name: 'Điều phối viên', message: 'Block slot do bác sĩ họp' },
    { action: 'schedule.reopen_slot', actor_name: 'Admin', message: 'Mở lại slot sau khi kiểm tra' },
    { action: 'schedule.slot_book', actor_name: 'Receptionist', message: 'Đặt appointment vào slot' },
  ];

  return (
    <section className={embedded ? 'sched-slot-activity is-embedded' : 'sched-slot-activity'}>
      {items.map((item, index) => (
        <article key={`${item.action}-${index}`}>
          <span><History size={15} /></span>
          <div>
            <strong>{item.action}</strong>
            <small>{item.actor_name || item.actor_type || 'Hệ thống'} · {item.message || 'Cập nhật slot'}</small>
          </div>
          <time>{item.created_at ? formatTime(item.created_at) : `${String(8 + index).padStart(2, '0')}:00`}</time>
        </article>
      ))}
    </section>
  );
}

export function SlotCapacityCommandPage({ view = 'board' }) {
  const data = useSlotCapacityData();
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.board;

  return (
    <main className="sched-slot-page">
      <Header config={config} data={data} />
      {(data.actionMessage || data.error) ? (
        <div className={`sched-slot-notice ${data.error ? 'is-warning' : 'is-success'}`}>
          {data.error || data.actionMessage}
        </div>
      ) : null}
      <QuickActions data={data} />
      <KpiStrip stats={data.stats} />
      {view === 'board' ? <SlotBoard data={data} /> : null}
      {view === 'generate' ? <GenerateView data={data} /> : null}
      {view === 'blocking' ? <BlockingView data={data} /> : null}
      {view === 'importExport' ? <ImportExportView data={data} /> : null}
      {view === 'utilization' ? <UtilizationView data={data} /> : null}
      {view === 'activity' ? <ActivityView data={data} /> : null}
    </main>
  );
}
