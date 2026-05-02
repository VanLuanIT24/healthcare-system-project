import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  GaugeCircle,
  LockKeyhole,
  RefreshCw,
  Search,
  UploadCloud,
  X,
} from 'lucide-react';
import { StatusBadge } from '../components/SchedulingPrimitives';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { formatPercent } from '../utils/schedulingUi';

const todayFilters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'visible', label: 'Đã công khai' },
  { id: 'hidden', label: 'Chưa công khai' },
  { id: 'pressure', label: 'Gần kín' },
  { id: 'open', label: 'Còn nhiều slot' },
];

function getTodayKey() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatDateLong(value) {
  const date = parseDateKey(value);
  if (!date) return 'Hôm nay';
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function isCancelledStatus(value) {
  const normalized = normalize(value);
  return normalized === 'cancelled' || normalized === 'canceled';
}

function isCompletedStatus(value) {
  return normalize(value) === 'completed';
}

function getUtilization(item) {
  const totalSlots = Number(item.totalSlots || 0);
  const bookedSlots = Number(item.bookedSlots || 0);
  return Number(item.utilization || (totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0));
}

function getScheduleAssessment(item) {
  if (isCancelledStatus(item.status)) return { tone: 'red', label: 'Đã hủy', body: 'Không nhận đặt lịch.' };
  if (item.publishStatus === 'Hidden') return { tone: 'amber', label: 'Cần công khai', body: 'Bệnh nhân chưa thấy lịch.' };
  if (getUtilization(item) >= 95) return { tone: 'red', label: 'Gần kín', body: 'Cần chuẩn bị phương án điều phối.' };
  if (getUtilization(item) >= 80) return { tone: 'blue', label: 'Cao', body: 'Theo dõi công suất trong ngày.' };
  if (Number(item.bookedSlots || 0) === 0) return { tone: 'slate', label: 'Chưa có đặt', body: 'Có thể cần nhắc kênh đặt lịch.' };
  return { tone: 'green', label: 'Ổn định', body: 'Ca khám đang vận hành bình thường.' };
}

function sortByTime(first, second) {
  return `${first.start || ''} ${first.doctor || ''}`.localeCompare(`${second.start || ''} ${second.doctor || ''}`);
}

function buildDepartmentRows(schedules) {
  const grouped = schedules.reduce((groups, item) => {
    const key = item.department || 'Chưa xác định khoa';
    const current = groups.get(key) || { name: key, schedules: 0, booked: 0, total: 0, available: 0, blocked: 0 };
    current.schedules += 1;
    current.booked += Number(item.bookedSlots || 0);
    current.total += Number(item.totalSlots || 0);
    current.available += Number(item.availableSlots || 0);
    current.blocked += Number(item.blockedSlots || 0);
    groups.set(key, current);
    return groups;
  }, new Map());

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      utilization: item.total > 0 ? (item.booked / item.total) * 100 : 0,
    }))
    .sort((first, second) => second.utilization - first.utilization);
}

export function SchedulingTodayPage() {
  const { actions, error, loading, refresh, schedules } = useSchedulingData();
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const todayKey = getTodayKey();

  const todaySchedules = useMemo(
    () => schedules.filter((item) => item.date === todayKey).sort(sortByTime),
    [schedules, todayKey],
  );

  const todayTotals = todaySchedules.reduce(
    (total, item) => ({
      booked: total.booked + Number(item.bookedSlots || 0),
      available: total.available + Number(item.availableSlots || 0),
      blocked: total.blocked + Number(item.blockedSlots || 0),
      slots: total.slots + Number(item.totalSlots || 0),
      unpublished: total.unpublished + (item.publishStatus === 'Hidden' && !isCancelledStatus(item.status) ? 1 : 0),
      pressure: total.pressure + (getUtilization(item) >= 85 || Number(item.availableSlots || 0) <= 2 ? 1 : 0),
    }),
    { booked: 0, available: 0, blocked: 0, slots: 0, unpublished: 0, pressure: 0 },
  );
  const todayUtilization = todayTotals.slots > 0 ? (todayTotals.booked / todayTotals.slots) * 100 : 0;
  const departmentRows = useMemo(() => buildDepartmentRows(todaySchedules), [todaySchedules]);

  const filteredSchedules = todaySchedules.filter((item) => {
    const utilization = getUtilization(item);
    const haystack = normalize(`${item.doctor} ${item.department} ${item.id} ${item.start} ${item.end}`);
    if (query && !haystack.includes(normalize(query))) return false;
    if (activeFilter === 'visible' && item.publishStatus !== 'Visible') return false;
    if (activeFilter === 'hidden' && item.publishStatus !== 'Hidden') return false;
    if (activeFilter === 'pressure' && utilization < 85 && Number(item.availableSlots || 0) > 2) return false;
    if (activeFilter === 'open' && (utilization >= 65 || Number(item.availableSlots || 0) <= 6)) return false;
    return true;
  });

  async function runAction(successMessage, callback) {
    setActionMessage('Đang xử lý yêu cầu...');

    try {
      await callback();
      setActionMessage(successMessage);
    } catch (actionError) {
      setActionMessage(actionError.message || 'Không thể xử lý thao tác.');
    }
  }

  return (
    <main className="scheduling-activity-page scheduling-today-overview-page">
      <section className="scheduling-activity-hero scheduling-work-hero scheduling-today-hero">
        <div>
          <span><CalendarCheck2 size={17} strokeWidth={2.4} aria-hidden="true" /> Tổng quan trong ngày</span>
          <h1>Lịch khám hôm nay</h1>
          <p>{formatDateLong(todayKey)} - theo dõi số ca, slot đã đặt, slot còn trống, trạng thái công khai và cảnh báo vận hành.</p>
        </div>
        <div className="scheduling-work-hero__actions">
          <button type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={15} strokeWidth={2.35} aria-hidden="true" />
            Làm mới
          </button>
          <Link to="/scheduling/calendar">Lịch trực quan</Link>
        </div>
      </section>

      <section className="scheduling-activity-metrics scheduling-work-metrics" aria-label="Tóm tắt lịch hôm nay">
        <article><span>Ca khám hôm nay</span><strong>{todaySchedules.length}</strong><small>theo ngày hiện tại</small></article>
        <article><span>Đã đặt</span><strong>{todayTotals.booked}</strong><small>lượt hẹn hợp lệ</small></article>
        <article><span>Còn trống</span><strong>{todayTotals.available}</strong><small>slot có thể đặt</small></article>
        <article><span>Lấp đầy TB</span><strong>{formatPercent(todayUtilization)}</strong><small>{todayTotals.pressure} ca cần theo dõi</small></article>
      </section>

      {actionMessage ? <p className="scheduling-work-toast">{actionMessage}</p> : null}
      {error ? <p className="scheduling-activity-notice">{error}</p> : null}

      <section className="scheduling-today-insights">
        <article>
          <div>
            <Building2 size={18} strokeWidth={2.35} aria-hidden="true" />
            <h2>Tổng quan theo khoa</h2>
          </div>
          <div className="scheduling-today-department-list">
            {departmentRows.length ? departmentRows.map((item) => (
              <div key={item.name}>
                <span>{item.name}</span>
                <strong>{formatPercent(item.utilization)}</strong>
                <em><i style={{ width: `${Math.min(item.utilization, 100)}%` }} /></em>
                <small>{item.schedules} ca - {item.booked}/{item.total} slot đã đặt</small>
              </div>
            )) : (
              <p>Chưa có ca khám trong ngày để phân tích theo khoa.</p>
            )}
          </div>
        </article>

        <article>
          <div>
            <AlertTriangle size={18} strokeWidth={2.35} aria-hidden="true" />
            <h2>Cảnh báo hôm nay</h2>
          </div>
          <div className="scheduling-today-alert-list">
            <div className={todayTotals.unpublished ? 'is-warning' : 'is-good'}>
              <LockKeyhole size={16} strokeWidth={2.3} aria-hidden="true" />
              <strong>{todayTotals.unpublished ? `${todayTotals.unpublished} lịch chưa công khai` : 'Tất cả lịch đã sẵn sàng công khai'}</strong>
              <span>{todayTotals.unpublished ? 'Cần duyệt để bệnh nhân nhìn thấy slot.' : 'Không có lịch ẩn trong hôm nay.'}</span>
            </div>
            <div className={todayTotals.pressure ? 'is-warning' : 'is-good'}>
              <GaugeCircle size={16} strokeWidth={2.3} aria-hidden="true" />
              <strong>{todayTotals.pressure ? `${todayTotals.pressure} ca gần kín` : 'Công suất đang ổn định'}</strong>
              <span>{todayTotals.pressure ? 'Theo dõi để mở thêm ca hoặc điều phối.' : 'Chưa có ca vượt ngưỡng cảnh báo.'}</span>
            </div>
            <div className={todayTotals.blocked ? 'is-warning' : 'is-good'}>
              <Clock3 size={16} strokeWidth={2.3} aria-hidden="true" />
              <strong>{todayTotals.blocked ? `${todayTotals.blocked} slot bị khóa` : 'Không có slot khóa'}</strong>
              <span>{todayTotals.blocked ? 'Kiểm tra lý do khóa nếu ảnh hưởng đặt lịch.' : 'Slot hôm nay đang mở bình thường.'}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="scheduling-activity-panel scheduling-work-panel">
        <div className="scheduling-activity-toolbar">
          <label>
            <Search size={16} strokeWidth={2.25} aria-hidden="true" />
            <input value={query} placeholder="Tìm theo bác sĩ, khoa, mã lịch hoặc giờ khám..." onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div>
            {todayFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeFilter === item.id ? 'is-active' : ''}
                onClick={() => setActiveFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="scheduling-today-list">
          {filteredSchedules.map((item) => {
            const assessment = getScheduleAssessment(item);

            return (
              <article key={item.id} className={`scheduling-today-card is-${assessment.tone}`}>
                <div className="scheduling-today-card__time">
                  <CalendarClock size={18} strokeWidth={2.35} aria-hidden="true" />
                  <strong>{item.start}</strong>
                  <span>{item.end}</span>
                </div>
                <div className="scheduling-today-card__body">
                  <div>
                    <h2>{item.doctor}</h2>
                    <StatusBadge value={item.status}>{item.status}</StatusBadge>
                  </div>
                  <p>{item.department}</p>
                  <div className="scheduling-today-card__stats">
                    <span>Tổng <b>{item.totalSlots}</b></span>
                    <span>Đã đặt <b>{item.bookedSlots}</b></span>
                    <span>Còn trống <b>{item.availableSlots}</b></span>
                    <span>Đã khóa <b>{item.blockedSlots}</b></span>
                    <span>Lấp đầy <b>{formatPercent(getUtilization(item))}</b></span>
                  </div>
                  <em>{assessment.label}: {assessment.body}</em>
                </div>
                <div className="scheduling-today-card__actions">
                  <Link to={`/scheduling/schedules/${item.id}`} aria-label={`Xem ${item.doctor}`}>
                    <Eye size={15} strokeWidth={2.3} aria-hidden="true" />
                    Chi tiết
                  </Link>
                  {item.publishStatus === 'Hidden' && !isCancelledStatus(item.status) ? (
                    <button type="button" onClick={() => runAction('Đã công khai lịch khám.', () => actions.publishSchedule(item.id))}>
                      <UploadCloud size={15} strokeWidth={2.3} aria-hidden="true" />
                      Công khai
                    </button>
                  ) : null}
                  {!isCancelledStatus(item.status) && !isCompletedStatus(item.status) ? (
                    <button type="button" className="is-danger" onClick={() => runAction('Đã hủy lịch khám.', () => actions.cancelSchedule(item.id))}>
                      <X size={15} strokeWidth={2.35} aria-hidden="true" />
                      Hủy
                    </button>
                  ) : null}
                  <Link to="/scheduling/slots">
                    Slot
                    <ChevronRight size={14} strokeWidth={2.35} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}

          {!filteredSchedules.length ? (
            <div className="scheduling-activity-empty">
              <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden="true" />
              <strong>Không có lịch hôm nay phù hợp</strong>
              <span>Hệ thống chưa ghi nhận ca khám trong ngày này hoặc bộ lọc đang quá hẹp.</span>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
