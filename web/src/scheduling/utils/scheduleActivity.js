function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

export function getActivityTimestampValue(value) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getScheduleActivityTimestamp(schedule) {
  return Math.max(
    getActivityTimestampValue(schedule.updatedAt),
    getActivityTimestampValue(schedule.createdAt),
    getActivityTimestampValue(`${schedule.date}T${schedule.start || '00:00'}:00`),
  );
}

export function formatActivityMoment(value) {
  const timestamp = typeof value === 'number' ? value : getActivityTimestampValue(value);
  if (!timestamp) return 'Chưa rõ';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatActivityDate(value) {
  const timestamp = typeof value === 'number' ? value : getActivityTimestampValue(value);
  if (!timestamp) return 'Không rõ ngày';

  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(timestamp));
}

export function getActivityActionLabel(action) {
  const labels = {
    created: 'Tạo lịch',
    updated: 'Cập nhật lịch',
    published: 'Công khai lịch',
    cancelled: 'Hủy lịch',
    canceled: 'Hủy lịch',
    blocked: 'Khóa khung giờ',
    reopened: 'Mở lại khung giờ',
    completed: 'Hoàn tất lịch',
    duplicated: 'Nhân bản lịch',
  };

  return labels[normalize(action)] || 'Hoạt động lịch';
}

function getDerivedActivityType(schedule) {
  const status = normalize(schedule.status);
  if (Number(schedule.blockedSlots || 0) > 0) return 'blocked';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'completed') return 'completed';
  if (schedule.publishStatus === 'Visible') return 'published';
  if (schedule.publishStatus === 'Hidden') return 'draft';
  return 'updated';
}

function getActivityTone(type) {
  const tones = {
    blocked: 'violet',
    cancelled: 'red',
    completed: 'blue',
    published: 'green',
    draft: 'amber',
    created: 'teal',
    updated: 'slate',
  };

  return tones[type] || 'slate';
}

function getDerivedTitle(schedule, type) {
  if (type === 'blocked') return `Khóa ${Number(schedule.blockedSlots || 0)} slot`;
  if (type === 'cancelled') return 'Hủy lịch khám';
  if (type === 'completed') return 'Hoàn tất lịch khám';
  if (type === 'published') return 'Công khai lịch';
  if (type === 'draft') return 'Cập nhật bản nháp';
  return 'Cập nhật lịch khám';
}

export function buildScheduleActivities(schedules, options = {}) {
  const limit = Number(options.limit || 0);
  const activities = schedules.map((schedule, index) => {
    const type = getDerivedActivityType(schedule);
    const timestamp = getScheduleActivityTimestamp(schedule);

    return {
      id: `${schedule.id || index}-${type}`,
      scheduleId: schedule.id,
      scheduleCode: schedule.code || schedule.id,
      doctor: schedule.doctor || 'Chưa xác định bác sĩ',
      department: schedule.department || 'Chưa xác định khoa',
      title: getDerivedTitle(schedule, type),
      body: `${schedule.doctor || 'Bác sĩ'} - ${schedule.department || 'Khoa'} - ${schedule.date || ''} ${schedule.start || ''}`.trim(),
      actor: schedule.updatedBy || schedule.createdBy || 'Hệ thống lịch',
      timeLabel: formatActivityMoment(timestamp),
      dateLabel: formatActivityDate(timestamp),
      sortTime: timestamp || index,
      type,
      tone: getActivityTone(type),
    };
  });

  const sorted = activities.sort((first, second) => second.sortTime - first.sortTime);
  return limit ? sorted.slice(0, limit) : sorted;
}

export function mapApiScheduleActivity(item, schedule, index = 0) {
  const action = normalize(item.action);
  const timestamp = getActivityTimestampValue(item.created_at || item.createdAt || item.time);
  const type =
    action.includes('publish') ? 'published'
      : action.includes('cancel') ? 'cancelled'
        : action.includes('block') ? 'blocked'
          : action.includes('complete') ? 'completed'
            : action.includes('create') ? 'created'
              : 'updated';

  return {
    id: item.id || `${schedule?.id || 'activity'}-${index}-${timestamp}`,
    scheduleId: schedule?.id || item.schedule_id || item.scheduleId,
    scheduleCode: schedule?.code || schedule?.id || item.schedule_id || item.scheduleId,
    doctor: schedule?.doctor || item.doctor_name || item.doctor || 'Chưa xác định bác sĩ',
    department: schedule?.department || item.department_name || item.department || 'Chưa xác định khoa',
    title: getActivityActionLabel(item.action),
    body: item.description || item.message || `${schedule?.doctor || 'Lịch khám'} - ${schedule?.department || 'Khoa'}`,
    actor: item.actor_name || item.actor || item.created_by || 'Hệ thống lịch',
    timeLabel: formatActivityMoment(timestamp),
    dateLabel: formatActivityDate(timestamp),
    sortTime: timestamp || index,
    type,
    tone: getActivityTone(type),
  };
}
