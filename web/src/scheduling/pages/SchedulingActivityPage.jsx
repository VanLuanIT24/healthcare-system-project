import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileClock,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { schedulingApi } from '../api/schedulingApi';
import { useSchedulingData } from '../context/SchedulingDataContext';
import {
  buildScheduleActivities,
  formatActivityDate,
  getActivityTimestampValue,
  mapApiScheduleActivity,
} from '../utils/scheduleActivity';

const activityFilters = [
  { id: 'all', label: 'Tất cả' },
  { id: 'published', label: 'Công khai' },
  { id: 'blocked', label: 'Khóa slot' },
  { id: 'cancelled', label: 'Đã hủy' },
  { id: 'completed', label: 'Hoàn tất' },
];

function getTodayKey() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getActivityIcon(type) {
  if (type === 'blocked') return LockKeyhole;
  if (type === 'cancelled') return XCircle;
  if (type === 'completed') return ShieldCheck;
  if (type === 'published') return CheckCircle2;
  return CalendarClock;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function SchedulingActivityPage() {
  const { backendConnected, error, loading, refresh, schedules } = useSchedulingData();
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [remoteActivities, setRemoteActivities] = useState([]);
  const [activityError, setActivityError] = useState('');
  const [isActivityLoading, setIsActivityLoading] = useState(false);

  const fallbackActivities = useMemo(() => buildScheduleActivities(schedules), [schedules]);

  useEffect(() => {
    let isActive = true;

    async function loadActivities() {
      if (!backendConnected || !schedules.length) {
        setRemoteActivities([]);
        setActivityError('');
        return;
      }

      setIsActivityLoading(true);
      setActivityError('');

      const candidates = [...schedules]
        .sort((first, second) => {
          const secondTime = getActivityTimestampValue(second.updatedAt || second.createdAt || `${second.date}T${second.start || '00:00'}:00`);
          const firstTime = getActivityTimestampValue(first.updatedAt || first.createdAt || `${first.date}T${first.start || '00:00'}:00`);
          return secondTime - firstTime;
        })
        .slice(0, 24);

      const results = await Promise.allSettled(
        candidates.map((schedule) =>
          schedulingApi.getScheduleActivity(schedule.id, { limit: 8 }).then((response) =>
            (response?.items || []).map((item, index) => mapApiScheduleActivity(item, schedule, index)),
          ),
        ),
      );

      if (!isActive) return;

      const mapped = results
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value)
        .sort((first, second) => second.sortTime - first.sortTime);

      setRemoteActivities(mapped);
      setActivityError(mapped.length ? '' : 'Chưa nhận được nhật ký chi tiết từ máy chủ, đang dùng dữ liệu lịch hiện có.');
      setIsActivityLoading(false);
    }

    loadActivities().catch((activityFailure) => {
      if (!isActive) return;
      setRemoteActivities([]);
      setActivityError(activityFailure.message);
      setIsActivityLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [backendConnected, schedules]);

  const activities = remoteActivities.length ? remoteActivities : fallbackActivities;
  const todayKey = getTodayKey();
  const todayActivities = activities.filter((item) => {
    const date = new Date(item.sortTime);
    if (Number.isNaN(date.getTime())) return false;
    return date.toISOString().slice(0, 10) === todayKey;
  });
  const blockedActivities = activities.filter((item) => item.type === 'blocked');
  const publishedActivities = activities.filter((item) => item.type === 'published');

  const filteredActivities = activities.filter((item) => {
    const text = normalize(`${item.title} ${item.body} ${item.doctor} ${item.department} ${item.actor} ${item.scheduleCode}`);
    if (query && !text.includes(normalize(query))) return false;
    if (activeType !== 'all' && item.type !== activeType) return false;
    return true;
  });

  const groupedActivities = filteredActivities.reduce((groups, item) => {
    const key = item.dateLabel || formatActivityDate(item.sortTime);
    const current = groups.get(key) || [];
    current.push(item);
    groups.set(key, current);
    return groups;
  }, new Map());

  return (
    <main className="scheduling-activity-page">
      <section className="scheduling-activity-hero">
        <div>
          <span><FileClock size={17} strokeWidth={2.4} aria-hidden="true" /> Nhật ký lịch khám</span>
          <h1>Hoạt động liên quan đến lịch</h1>
          <p>Theo dõi toàn bộ thay đổi quan trọng: tạo lịch, công khai, khóa slot, hủy và hoàn tất lịch khám.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading || isActivityLoading}>
          <RefreshCw size={15} strokeWidth={2.35} aria-hidden="true" />
          Làm mới dữ liệu
        </button>
      </section>

      <section className="scheduling-activity-metrics" aria-label="Tóm tắt nhật ký lịch">
        <article><span>Tổng hoạt động</span><strong>{activities.length}</strong><small>trong dữ liệu lịch</small></article>
        <article><span>Hôm nay</span><strong>{todayActivities.length}</strong><small>cập nhật mới</small></article>
        <article><span>Công khai</span><strong>{publishedActivities.length}</strong><small>lịch đã hiển thị</small></article>
        <article><span>Cần theo dõi</span><strong>{blockedActivities.length}</strong><small>khóa slot/cảnh báo</small></article>
      </section>

      <section className="scheduling-activity-panel">
        <div className="scheduling-activity-toolbar">
          <label>
            <Search size={16} strokeWidth={2.25} aria-hidden="true" />
            <input value={query} placeholder="Tìm theo bác sĩ, khoa, mã lịch, người thao tác..." onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div>
            {activityFilters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeType === item.id ? 'is-active' : ''}
                onClick={() => setActiveType(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error || activityError ? (
          <p className="scheduling-activity-notice">{activityError || error}</p>
        ) : null}

        <div className="scheduling-activity-timeline">
          {Array.from(groupedActivities.entries()).map(([dateLabel, items]) => (
            <section key={dateLabel}>
              <h2>{dateLabel}</h2>
              <div>
                {items.map((item) => {
                  const ActivityIcon = getActivityIcon(item.type);

                  return (
                    <Link key={item.id} to={item.scheduleId ? `/scheduling/schedules/${item.scheduleId}` : '/scheduling/schedules'} className={`is-${item.tone}`}>
                      <span aria-hidden="true"><ActivityIcon size={17} strokeWidth={2.35} /></span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                        <small>{item.actor} - {item.doctor} - {item.department}</small>
                      </div>
                      <time>{item.timeLabel}</time>
                      <ChevronRight size={16} strokeWidth={2.35} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}

          {!filteredActivities.length ? (
            <div className="scheduling-activity-empty">
              <ClipboardList size={22} strokeWidth={2.25} aria-hidden="true" />
              <strong>Chưa có hoạt động phù hợp</strong>
              <span>Thử đổi bộ lọc hoặc làm mới dữ liệu lịch.</span>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
