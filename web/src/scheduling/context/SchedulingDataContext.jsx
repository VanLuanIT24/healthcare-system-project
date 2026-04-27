import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { schedulingApi } from '../api/schedulingApi';
import {
  calendarEvents as mockCalendarEvents,
  departments as mockDepartments,
  doctors as mockDoctors,
  operationAlerts as mockOperationAlerts,
  scheduleStats as mockScheduleStats,
  schedules as mockSchedules,
  slots as mockSlots,
  timeline as mockTimeline,
  utilizationSeries as mockUtilizationSeries,
} from '../data/schedulingData';

const SchedulingDataContext = createContext(null);

function formatClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || '').slice(0, 5);
  }
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function formatDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function buildDateTime(dateValue, timeValue) {
  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

function mapScheduleFromApi(item = {}) {
  const stats = item.slots_summary || {};
  return {
    id: item.doctor_schedule_id,
    doctor: item.doctor_name || item.doctor_code || 'Chưa xác định bác sĩ',
    doctorId: item.doctor_id,
    department: item.department_name || item.department_code || 'Chưa xác định khoa',
    departmentId: item.department_id,
    date: formatDateKey(item.work_date),
    start: formatClock(item.shift_start),
    end: formatClock(item.shift_end),
    totalSlots: Number(stats.total_slots || 0),
    bookedSlots: Number(stats.booked_slots || 0),
    availableSlots: Number(stats.available_slots || 0),
    blockedSlots: Number(stats.blocked_slots || item.blocked_slots_count || 0),
    status: item.status || 'draft',
    publishStatus: item.publish_status === 'visible' ? 'Visible' : 'Hidden',
    utilization: Number(item.utilization_rate || stats.utilization_rate || 0),
    slotDuration: Number(item.slot_duration_minutes || 15),
    capacity: Number(item.max_patients || 1),
    createdBy: item.created_by || 'Máy chủ',
    createdAt: item.created_at || '',
    updatedAt: item.updated_at || '',
    note: item.note || 'Dữ liệu được đồng bộ từ máy chủ lịch khám.',
    raw: item,
  };
}

function mapGroupToDoctor(item) {
  return {
    id: item.id,
    name: item.label || 'Chưa xác định bác sĩ',
    department: 'Theo dữ liệu lịch',
    load: Number(item.utilization_rate || 0),
    totalSlots: Number(item.total_slots || 0),
    bookedSlots: Number(item.booked_slots || 0),
    availableSlots: Number(item.available_slots || 0),
  };
}

function mapGroupToDepartment(item) {
  return {
    id: item.id,
    name: item.label || 'Chưa xác định khoa',
    bookings: Number(item.booked_slots || 0),
    utilization: Number(item.utilization_rate || 0),
    totalSlots: Number(item.total_slots || 0),
    availableSlots: Number(item.available_slots || 0),
    schedulesCount: Number(item.schedules_count || 0),
  };
}

function buildStatsFromSummary(summary, schedules) {
  if (!summary?.overview) return mockScheduleStats;
  const overview = summary.overview;
  return [
    { label: 'Lịch hôm nay', value: overview.today_schedules || 0, delta: 'đang vận hành', tone: 'blue', icon: 'LH' },
    { label: 'Lịch trong tuần', value: overview.schedules_count || schedules.length, delta: 'theo bộ lọc', tone: 'indigo', icon: 'LT' },
    { label: 'Chưa công khai', value: overview.unpublished_schedules || 0, delta: 'cần duyệt', tone: 'amber', icon: 'CK' },
    { label: 'Tổng khung giờ', value: overview.total_slots || 0, delta: 'toàn hệ thống', tone: 'slate', icon: 'KG' },
    { label: 'Đã đặt', value: overview.booked_slots || 0, delta: 'lịch hẹn hợp lệ', tone: 'green', icon: 'ĐĐ' },
    { label: 'Còn trống', value: overview.available_slots || 0, delta: 'có thể đặt', tone: 'mint', icon: 'CT' },
    { label: 'Đã khóa', value: overview.blocked_slots || 0, delta: 'do vận hành', tone: 'red', icon: 'K' },
    { label: 'Lấp đầy trung bình', value: `${Math.round(overview.utilization_rate || 0)}%`, delta: 'theo khoảng ngày', tone: 'violet', icon: '%' },
  ];
}

function buildCalendarEventsFromSchedules(schedules) {
  if (!schedules.length) return mockCalendarEvents;
  return schedules.slice(0, 14).map((schedule, index) => {
    const utilization = Number(schedule.utilization || 0);
    const status = schedule.status === 'cancelled' ? 'cancelled' : utilization >= 95 ? 'full' : utilization >= 80 ? 'near-full' : 'open';
    const date = new Date(schedule.date);
    return {
      id: schedule.id,
      day: Number.isNaN(date.getTime()) ? `Ngày ${index + 1}` : new Intl.DateTimeFormat('vi-VN', { weekday: 'short' }).format(date),
      date: Number.isNaN(date.getTime()) ? String(index + 1) : new Intl.DateTimeFormat('vi-VN', { day: '2-digit' }).format(date),
      doctor: schedule.doctor,
      time: `${schedule.start}-${schedule.end}`,
      booked: schedule.bookedSlots,
      total: schedule.totalSlots,
      status,
      scheduleId: schedule.id,
    };
  });
}

function mapOperationAlerts(alerts) {
  return alerts?.length
    ? alerts.map((item) => ({
        title: item.title,
        body: item.body,
        tone: item.tone === 'danger' ? 'danger' : item.tone === 'warning' ? 'warning' : 'info',
      }))
    : mockOperationAlerts;
}

function mapUtilizationSeries(series) {
  return series?.length
    ? series.map((item) => ({ label: item.label || formatDateKey(item.date), value: Number(item.value || 0) }))
    : mockUtilizationSeries;
}

function mapSlotFromApi(slot, bookedMap, blockedMap) {
  const key = new Date(slot.slot_time).toISOString();
  const booked = bookedMap.get(key);
  const blocked = blockedMap.get(key);
  const status = slot.is_blocked ? 'Blocked' : slot.is_booked ? 'Booked' : 'Available';
  return {
    id: key,
    time: formatClock(slot.slot_time),
    slotTime: slot.slot_time,
    status,
    patient: booked ? `${booked.patient_code || 'BN'} - ${booked.patient_name || 'Bệnh nhân'}` : '',
    appointment: booked?.appointment_id || '',
    appointmentStatus: booked?.status || '',
    reason: blocked?.reason || '',
    blockedBy: blocked?.blocked_by || '',
    blockedAt: blocked?.blocked_at || '',
  };
}

function getActionTitle(action) {
  const labels = {
    'schedule.create': 'Đã tạo lịch',
    'schedule.update': 'Đã cập nhật lịch',
    'schedule.publish': 'Đã công khai lịch',
    'schedule.cancel': 'Đã hủy lịch',
    'schedule.complete': 'Đã hoàn tất lịch',
    'schedule.block_slot': 'Đã khóa khung giờ',
    'schedule.reopen_slot': 'Đã mở lại khung giờ',
    'schedule.batch_block_slots': 'Đã khóa nhiều khung giờ',
    'schedule.batch_reopen_slots': 'Đã mở lại nhiều khung giờ',
  };
  return labels[action] || 'Hoạt động lịch khám';
}

function mapActivityFromApi(item) {
  return {
    time: formatClock(item.created_at),
    title: getActionTitle(item.action),
    actor: item.actor_name || item.actor_type || 'Hệ thống',
    body: item.message || 'Không có mô tả bổ sung.',
  };
}

function createFallbackState() {
  return {
    schedules: mockSchedules,
    doctors: mockDoctors,
    departments: mockDepartments,
    scheduleStats: mockScheduleStats,
    operationAlerts: mockOperationAlerts,
    utilizationSeries: mockUtilizationSeries,
    calendarEvents: mockCalendarEvents,
    rawSummary: null,
    backendConnected: false,
  };
}

export function SchedulingDataProvider({ children }) {
  const [state, setState] = useState(createFallbackState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, list] = await Promise.all([
        schedulingApi.getSystemSummary({ preset: 'week' }),
        schedulingApi.listSchedules({ limit: 100 }),
      ]);
      const schedules = (list?.items || summary?.items || []).map(mapScheduleFromApi);
      const doctors = summary?.by_doctor?.length ? summary.by_doctor.map(mapGroupToDoctor) : mockDoctors;
      const departments = summary?.by_department?.length ? summary.by_department.map(mapGroupToDepartment) : mockDepartments;

      setState({
        schedules: schedules.length ? schedules : mockSchedules,
        doctors,
        departments,
        scheduleStats: buildStatsFromSummary(summary, schedules),
        operationAlerts: mapOperationAlerts(summary?.operation_alerts),
        utilizationSeries: mapUtilizationSeries(summary?.utilization_series),
        calendarEvents: buildCalendarEventsFromSchedules(schedules),
        rawSummary: summary,
        backendConnected: true,
      });
    } catch (loadError) {
      setError(loadError.message);
      setState((current) => ({ ...createFallbackState(), backendConnected: false, rawSummary: current.rawSummary }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resolveDepartmentId = useCallback(
    (value, doctorId) => {
      const byIdOrName = state.departments.find((item) => item.id === value || item.name === value);
      if (byIdOrName?.id) return byIdOrName.id;
      const doctor = state.doctors.find((item) => item.id === doctorId);
      const byDoctorDepartment = state.departments.find((item) => item.name === doctor?.department);
      return byDoctorDepartment?.id || value;
    },
    [state.departments, state.doctors],
  );

  const createScheduleFromForm = useCallback(
    async (form) => {
      const departmentId = resolveDepartmentId(form.department, form.doctor);
      const payload = {
        doctor_id: form.doctor,
        department_id: departmentId,
        work_date: form.date,
        shift_start: buildDateTime(form.date, form.start),
        shift_end: buildDateTime(form.date, form.end),
        slot_duration_minutes: Number(form.duration || 15),
        max_patients: Number(form.capacity || 1),
        status: form.status || 'draft',
      };
      const result = await schedulingApi.createSchedule(payload);
      await refresh();
      return result;
    },
    [refresh, resolveDepartmentId],
  );

  const actions = useMemo(
    () => ({
      createScheduleFromForm,
      bulkCreateSchedules: async (payload) => {
        const result = await schedulingApi.bulkCreateSchedules(payload);
        await refresh();
        return result;
      },
      bulkPublishSchedules: async (scheduleIds) => {
        const result = await schedulingApi.bulkPublishSchedules(scheduleIds);
        await refresh();
        return result;
      },
      publishSchedule: async (scheduleId) => {
        const result = await schedulingApi.publishSchedule(scheduleId);
        await refresh();
        return result;
      },
      cancelSchedule: async (scheduleId) => {
        const result = await schedulingApi.cancelSchedule(scheduleId);
        await refresh();
        return result;
      },
      duplicateSchedule: async (scheduleId, payload) => {
        const result = await schedulingApi.duplicateSchedule(scheduleId, payload);
        await refresh();
        return result;
      },
      batchBlockSlots: async (scheduleId, payload) => {
        const result = await schedulingApi.batchBlockSlots(scheduleId, payload);
        await refresh();
        return result;
      },
      batchReopenSlots: async (scheduleId, payload) => {
        const result = await schedulingApi.batchReopenSlots(scheduleId, payload);
        await refresh();
        return result;
      },
    }),
    [createScheduleFromForm, refresh],
  );

  const value = useMemo(
    () => ({
      ...state,
      loading,
      error,
      refresh,
      actions,
    }),
    [actions, error, loading, refresh, state],
  );

  return <SchedulingDataContext.Provider value={value}>{children}</SchedulingDataContext.Provider>;
}

export function useSchedulingData() {
  const context = useContext(SchedulingDataContext);
  if (!context) {
    throw new Error('useSchedulingData phải được dùng bên trong SchedulingDataProvider.');
  }
  return context;
}

export function useScheduleDetailData(scheduleId) {
  const context = useSchedulingData();
  const fallbackSchedule = context.schedules.find((item) => item.id === scheduleId) || context.schedules[0] || mockSchedules[0];
  const [detailState, setDetailState] = useState({
    schedule: fallbackSchedule,
    slots: mockSlots,
    timeline: mockTimeline,
    impact: null,
    loading: false,
    error: '',
  });

  useEffect(() => {
    let isActive = true;

    async function loadDetail() {
      if (!scheduleId || !context.backendConnected) {
        setDetailState((current) => ({
          ...current,
          schedule: fallbackSchedule,
          slots: mockSlots,
          timeline: mockTimeline,
          impact: null,
          loading: false,
          error: context.backendConnected ? '' : context.error,
        }));
        return;
      }

      setDetailState((current) => ({ ...current, loading: true, error: '' }));
      const [detailResult, availableResult, bookedResult, activityResult, impactResult] = await Promise.allSettled([
        schedulingApi.getScheduleDetail(scheduleId),
        schedulingApi.getAvailableSlots(scheduleId),
        schedulingApi.getBookedSlots(scheduleId),
        schedulingApi.getScheduleActivity(scheduleId, { limit: 20 }),
        schedulingApi.previewImpact(scheduleId, {}),
      ]);

      if (!isActive) return;

      const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
      const available = availableResult.status === 'fulfilled' ? availableResult.value : null;
      const booked = bookedResult.status === 'fulfilled' ? bookedResult.value : null;
      const activity = activityResult.status === 'fulfilled' ? activityResult.value : null;
      const impact = impactResult.status === 'fulfilled' ? impactResult.value : null;
      const blockedMap = new Map((detail?.schedule?.blocked_slots || []).map((slot) => [new Date(slot.slot_time).toISOString(), slot]));
      const bookedMap = new Map((booked?.items || []).map((slot) => [new Date(slot.appointment_time).toISOString(), slot]));

      setDetailState({
        schedule: detail?.schedule ? mapScheduleFromApi(detail.schedule) : fallbackSchedule,
        slots: available?.items?.length ? available.items.map((slot) => mapSlotFromApi(slot, bookedMap, blockedMap)) : mockSlots,
        timeline: activity?.items?.length ? activity.items.map(mapActivityFromApi) : mockTimeline,
        impact,
        loading: false,
        error:
          detailResult.status === 'rejected'
            ? detailResult.reason.message
            : availableResult.status === 'rejected'
              ? availableResult.reason.message
              : '',
      });
    }

    loadDetail();
    return () => {
      isActive = false;
    };
  }, [context.backendConnected, context.error, fallbackSchedule, scheduleId]);

  return detailState;
}
