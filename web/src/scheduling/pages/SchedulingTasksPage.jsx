import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GaugeCircle,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';
import { StatusBadge } from '../components/SchedulingPrimitives';
import { useSchedulingData } from '../context/SchedulingDataContext';
import { formatPercent } from '../utils/schedulingUi';

const taskFilters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unpublished', label: 'Chưa công khai' },
  { id: 'capacity', label: 'Công suất cao' },
  { id: 'review', label: 'Cần rà soát' },
  { id: 'overdue', label: 'Quá ngày' },
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

function formatDateShort(value) {
  const date = parseDateKey(value);
  if (!date) return 'Chưa rõ ngày';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function getScheduleTimeValue(item) {
  const date = parseDateKey(item.date);
  if (!date) return 0;
  const [hour = 0, minute = 0] = String(item.start || '00:00').split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

function isCancelledStatus(value) {
  const normalized = normalize(value);
  return normalized === 'cancelled' || normalized === 'canceled';
}

function isCompletedStatus(value) {
  return normalize(value) === 'completed';
}

function isInvalidTime(item) {
  return String(item.start || '').localeCompare(String(item.end || '')) >= 0;
}

function getTaskIcon(category) {
  if (category === 'unpublished') return LockKeyhole;
  if (category === 'capacity') return GaugeCircle;
  if (category === 'overdue') return CalendarClock;
  return ShieldAlert;
}

function buildTaskItems(schedules, todayKey) {
  const tasks = [];

  schedules.forEach((schedule, index) => {
    const totalSlots = Number(schedule.totalSlots || 0);
    const bookedSlots = Number(schedule.bookedSlots || 0);
    const availableSlots = Number(schedule.availableSlots || 0);
    const blockedSlots = Number(schedule.blockedSlots || 0);
    const utilization = Number(schedule.utilization || (totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0));
    const cancelled = isCancelledStatus(schedule.status);
    const completed = isCompletedStatus(schedule.status);
    const activeSchedule = !cancelled && !completed;
    const base = {
      schedule,
      scheduleTime: getScheduleTimeValue(schedule) || index,
      doctor: schedule.doctor || 'Chưa xác định bác sĩ',
      department: schedule.department || 'Chưa xác định khoa',
      dateLabel: formatDateShort(schedule.date),
      timeLabel: `${schedule.start || '--:--'} - ${schedule.end || '--:--'}`,
      utilization,
    };

    if (schedule.publishStatus === 'Hidden' && activeSchedule) {
      tasks.push({
        ...base,
        id: `${schedule.id}-unpublished`,
        category: 'unpublished',
        tone: 'amber',
        score: 88,
        title: 'Lịch chưa công khai',
        body: 'Bệnh nhân và lễ tân chưa nhìn thấy khung giờ này. Nên công khai sau khi kiểm tra.',
        recommendation: 'Công khai hoặc chỉnh lại ca khám nếu chưa sẵn sàng.',
      });
    }

    if (totalSlots > 0 && activeSchedule && (utilization >= 85 || availableSlots <= 2)) {
      tasks.push({
        ...base,
        id: `${schedule.id}-capacity`,
        category: 'capacity',
        tone: utilization >= 95 ? 'red' : 'blue',
        score: utilization >= 95 ? 96 : 78,
        title: utilization >= 95 ? 'Ca khám gần kín' : 'Công suất cần theo dõi',
        body: `${bookedSlots}/${totalSlots} slot đã đặt, còn ${availableSlots} slot khả dụng.`,
        recommendation: utilization >= 95 ? 'Cân nhắc mở thêm ca hoặc điều phối sang bác sĩ khác.' : 'Theo dõi thêm trước giờ khám.',
      });
    }

    const needsReview =
      isInvalidTime(schedule) ||
      schedule.doctor?.includes('Chưa xác định') ||
      schedule.department?.includes('Chưa xác định') ||
      (cancelled && bookedSlots > 0) ||
      (schedule.date >= todayKey && bookedSlots > 0 && blockedSlots > 0);

    if (needsReview) {
      tasks.push({
        ...base,
        id: `${schedule.id}-review`,
        category: 'review',
        tone: cancelled && bookedSlots > 0 ? 'red' : 'blue',
        score: cancelled && bookedSlots > 0 ? 100 : 82,
        title: cancelled && bookedSlots > 0 ? 'Lịch hủy còn bệnh nhân' : 'Lịch cần rà soát',
        body: cancelled && bookedSlots > 0
          ? `${bookedSlots} lượt đặt bị ảnh hưởng bởi lịch đã hủy.`
          : 'Có thông tin ca khám cần kiểm tra trước khi vận hành.',
        recommendation: cancelled && bookedSlots > 0 ? 'Liên hệ bệnh nhân và điều phối lịch thay thế.' : 'Mở chi tiết lịch để kiểm tra bác sĩ, khoa, giờ hoặc slot khóa.',
      });
    }

    if (schedule.date < todayKey && activeSchedule) {
      tasks.push({
        ...base,
        id: `${schedule.id}-overdue`,
        category: 'overdue',
        tone: 'red',
        score: 92,
        title: 'Lịch đã qua ngày chưa đóng',
        body: 'Ca khám đã qua ngày nhưng trạng thái chưa hoàn tất hoặc hủy.',
        recommendation: 'Kiểm tra kết quả vận hành và cập nhật trạng thái lịch.',
      });
    }
  });

  return tasks.sort((first, second) => second.score - first.score || first.scheduleTime - second.scheduleTime);
}

export function SchedulingTasksPage() {
  const { actions, error, loading, refresh, schedules } = useSchedulingData();
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const todayKey = getTodayKey();

  const taskItems = useMemo(() => buildTaskItems(schedules, todayKey), [schedules, todayKey]);
  const unpublishedTasks = taskItems.filter((item) => item.category === 'unpublished');
  const capacityTasks = taskItems.filter((item) => item.category === 'capacity');
  const reviewTasks = taskItems.filter((item) => item.category === 'review');
  const overdueTasks = taskItems.filter((item) => item.category === 'overdue');

  const filteredTasks = taskItems.filter((item) => {
    const haystack = normalize(`${item.title} ${item.body} ${item.recommendation} ${item.doctor} ${item.department} ${item.schedule?.id}`);
    if (activeFilter !== 'all' && item.category !== activeFilter) return false;
    if (query && !haystack.includes(normalize(query))) return false;
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
    <main className="scheduling-activity-page scheduling-action-center-page">
      <section className="scheduling-activity-hero scheduling-work-hero">
        <div>
          <span><ShieldAlert size={17} strokeWidth={2.4} aria-hidden="true" /> Trung tâm xử lý</span>
          <h1>Việc cần xử lý ngay</h1>
          <p>Ưu tiên các lịch chưa công khai, ca gần hết slot, lịch có rủi ro vận hành và lịch đã qua ngày chưa đóng.</p>
        </div>
        <div className="scheduling-work-hero__actions">
          <button type="button" onClick={refresh} disabled={loading}>
            <RefreshCw size={15} strokeWidth={2.35} aria-hidden="true" />
            Làm mới
          </button>
          <Link to="/scheduling/dashboard">Về tổng quan</Link>
        </div>
      </section>

      <section className="scheduling-activity-metrics scheduling-work-metrics" aria-label="Tóm tắt việc cần xử lý">
        <article><span>Tổng việc cần xử lý</span><strong>{taskItems.length}</strong><small>ưu tiên theo mức rủi ro</small></article>
        <article><span>Chưa công khai</span><strong>{unpublishedTasks.length}</strong><small>cần duyệt hiển thị</small></article>
        <article><span>Công suất cao</span><strong>{capacityTasks.length}</strong><small>cần điều phối slot</small></article>
        <article><span>Cần rà soát</span><strong>{reviewTasks.length + overdueTasks.length}</strong><small>xung đột hoặc quá ngày</small></article>
      </section>

      {actionMessage ? <p className="scheduling-work-toast">{actionMessage}</p> : null}
      {error ? <p className="scheduling-activity-notice">{error}</p> : null}

      <section className="scheduling-activity-panel scheduling-work-panel">
        <div className="scheduling-activity-toolbar">
          <label>
            <Search size={16} strokeWidth={2.25} aria-hidden="true" />
            <input value={query} placeholder="Tìm theo bác sĩ, khoa, mã lịch hoặc nội dung cần xử lý..." onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div>
            {taskFilters.map((item) => (
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

        <div className="scheduling-task-list">
          {filteredTasks.map((item) => {
            const TaskIcon = getTaskIcon(item.category);

            return (
              <article key={item.id} className={`scheduling-task-card is-${item.tone}`}>
                <div className="scheduling-task-card__icon" aria-hidden="true">
                  <TaskIcon size={20} strokeWidth={2.35} />
                </div>
                <div className="scheduling-task-card__body">
                  <div className="scheduling-task-card__head">
                    <div>
                      <span>{item.category === 'capacity' ? 'Công suất' : item.category === 'unpublished' ? 'Công khai' : item.category === 'overdue' ? 'Quá ngày' : 'Rà soát'}</span>
                      <h2>{item.title}</h2>
                    </div>
                    <StatusBadge value={item.schedule.status}>{item.schedule.status}</StatusBadge>
                  </div>

                  <p>{item.body}</p>
                  <div className="scheduling-task-card__meta">
                    <span><CalendarDays size={14} strokeWidth={2.25} aria-hidden="true" /> {item.dateLabel}</span>
                    <span><Clock3 size={14} strokeWidth={2.25} aria-hidden="true" /> {item.timeLabel}</span>
                    <span><GaugeCircle size={14} strokeWidth={2.25} aria-hidden="true" /> {formatPercent(item.utilization)}</span>
                  </div>
                  <strong>{item.doctor}</strong>
                  <small>{item.department}</small>
                  <em>{item.recommendation}</em>
                </div>

                <div className="scheduling-task-card__actions">
                  {item.schedule.publishStatus === 'Hidden' && !isCancelledStatus(item.schedule.status) ? (
                    <button
                      type="button"
                      onClick={() => runAction('Đã công khai lịch khám.', () => actions.publishSchedule(item.schedule.id))}
                    >
                      <UploadCloud size={15} strokeWidth={2.3} aria-hidden="true" />
                      Công khai
                    </button>
                  ) : null}
                  <Link to={`/scheduling/schedules/${item.schedule.id}`}>
                    Chi tiết
                    <ChevronRight size={15} strokeWidth={2.35} aria-hidden="true" />
                  </Link>
                  <Link to="/scheduling/slots">Khung giờ</Link>
                </div>
              </article>
            );
          })}

          {!filteredTasks.length ? (
            <div className="scheduling-activity-empty">
              <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden="true" />
              <strong>Không có việc cần xử lý phù hợp</strong>
              <span>Thử đổi bộ lọc hoặc làm mới dữ liệu lịch.</span>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
