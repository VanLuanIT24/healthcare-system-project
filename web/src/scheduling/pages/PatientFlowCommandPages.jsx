import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Filter,
  HeartPulse,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  UserCheck,
  UserRoundX,
  UsersRound,
} from 'lucide-react';

import { useSchedulingData } from '../context/SchedulingDataContext.jsx';
import { schedulingApi } from '../api/schedulingApi.js';
import { runSchedulingAction } from '../utils/schedulingActions.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

const STATUS_LABELS = {
  booked: 'Đã đặt',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã check-in',
  in_consultation: 'Đang khám',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  no_show: 'No-show',
  waiting: 'Đang chờ',
  called: 'Đã gọi',
  recalled: 'Gọi lại',
  skipped: 'Bỏ qua',
  in_service: 'Đang phục vụ',
};

const STAGE_LABELS = {
  scheduled: 'Đã đặt lịch',
  confirmed: 'Đã xác nhận',
  checked_in: 'Đã check-in',
  waiting_nurse: 'Chờ điều dưỡng',
  nurse_in_progress: 'Đang điều dưỡng',
  ready_for_doctor: 'Ready for doctor',
  called: 'Đã gọi',
  in_consultation: 'Đang khám',
  post_consult: 'Chờ xử lý tiếp',
  completed: 'Hoàn tất',
  exceptions: 'Cần điều phối',
};

const FLOW_STEPS = [
  { key: 'scheduled', label: 'Booked' },
  { key: 'confirmed', label: 'Confirm' },
  { key: 'checked_in', label: 'Check-in' },
  { key: 'waiting_nurse', label: 'Nurse' },
  { key: 'ready_for_doctor', label: 'Ready' },
  { key: 'called', label: 'Called' },
  { key: 'in_consultation', label: 'Exam' },
  { key: 'completed', label: 'Done' },
];

const FLOW_COLUMNS = [
  { key: 'scheduled', title: 'Đã đặt lịch', icon: CalendarCheck2 },
  { key: 'checked_in', title: 'Đã check-in', icon: UserCheck },
  { key: 'waiting_nurse', title: 'Chờ điều dưỡng', icon: HeartPulse },
  { key: 'ready_for_doctor', title: 'Ready for doctor', icon: ClipboardCheck },
  { key: 'called', title: 'Đã gọi', icon: BellRing },
  { key: 'in_consultation', title: 'Đang khám', icon: Stethoscope },
  { key: 'completed', title: 'Hoàn tất', icon: CheckCircle2 },
  { key: 'exceptions', title: 'Cần điều phối', icon: ShieldAlert },
];

const VIEW_CONFIG = {
  board: {
    title: 'Patient flow board',
    subtitle: 'Bản đồ realtime hành trình bệnh nhân trong ngày theo lịch hẹn, check-in, queue, điều dưỡng và lượt khám.',
    eyebrow: 'Day Operation Flow Control',
  },
  checkIn: {
    title: 'Check-in monitor',
    subtitle: 'Theo dõi bệnh nhân đến khám, xác nhận check-in và đưa vào queue.',
    eyebrow: 'Front desk intake',
  },
  waiting: {
    title: 'Bệnh nhân đang chờ',
    subtitle: 'Theo dõi bệnh nhân đã đến nhưng đang chờ điều dưỡng, bác sĩ hoặc queue.',
    eyebrow: 'Waiting control',
  },
  inConsultation: {
    title: 'Bệnh nhân đang khám',
    subtitle: 'Theo dõi queue in-service, appointment in-consultation và encounter đang mở.',
    eyebrow: 'Clinical service monitor',
  },
  needsAction: {
    title: 'Bệnh nhân cần điều phối',
    subtitle: 'Inbox cảnh báo các trường hợp cần con người can thiệp trong ngày.',
    eyebrow: 'Operations alert inbox',
  },
  completed: {
    title: 'Bệnh nhân hoàn tất / rời hệ thống',
    subtitle: 'Theo dõi bệnh nhân đã hoàn tất, no-show, hủy hoặc còn pending sau khám.',
    eyebrow: 'Exit flow',
  },
};

const fallbackFlowItems = [
  {
    id: 'demo-flow-1',
    patientName: 'Nguyễn Văn An',
    patientCode: 'BN000123',
    patientMeta: 'Nam · 35 tuổi',
    appointmentId: 'APT-001',
    appointmentTime: new Date().toISOString(),
    appointmentStatus: 'checked_in',
    queueId: 'QUE-001',
    queueNumber: 'NTQ-N008',
    queueStatus: 'waiting',
    doctorName: 'BS. Trần Thanh Hải',
    departmentName: 'Nội tổng quát',
    currentStage: 'ready_for_doctor',
    nursingStage: 'vital_done',
    waitingMinutes: 34,
    slaStatus: 'warning',
    riskTags: ['Chờ lâu', 'Ready for doctor'],
    source: 'demo',
  },
  {
    id: 'demo-flow-2',
    patientName: 'Trần Thị Bích Ngọc',
    patientCode: 'BN000491',
    patientMeta: 'Nữ · 28 tuổi',
    appointmentId: 'APT-002',
    appointmentTime: new Date(Date.now() + 20 * 60000).toISOString(),
    appointmentStatus: 'confirmed',
    queueId: null,
    queueNumber: null,
    queueStatus: null,
    doctorName: 'BS. Lê Minh Tuấn',
    departmentName: 'Tim mạch',
    currentStage: 'confirmed',
    nursingStage: 'not_started',
    waitingMinutes: 0,
    slaStatus: 'normal',
    riskTags: ['Sắp đến'],
    source: 'demo',
  },
  {
    id: 'demo-flow-3',
    patientName: 'Lê Quốc Tuấn',
    patientCode: 'BN000812',
    patientMeta: 'Nam · 42 tuổi',
    appointmentId: 'APT-003',
    appointmentTime: new Date(Date.now() - 45 * 60000).toISOString(),
    appointmentStatus: 'in_consultation',
    queueId: 'QUE-003',
    queueNumber: 'NTQ-N002',
    queueStatus: 'in_service',
    encounterId: 'ENC-003',
    doctorName: 'BS. Nguyễn Thị Lan',
    departmentName: 'Nhi khoa',
    currentStage: 'in_consultation',
    nursingStage: 'completed',
    waitingMinutes: 0,
    serviceMinutes: 28,
    slaStatus: 'normal',
    riskTags: ['Encounter active'],
    source: 'demo',
  },
  {
    id: 'demo-flow-4',
    patientName: 'Phạm Minh Châu',
    patientCode: 'BN000247',
    patientMeta: 'Nữ · 61 tuổi',
    appointmentId: 'APT-004',
    appointmentTime: new Date(Date.now() - 80 * 60000).toISOString(),
    appointmentStatus: 'checked_in',
    queueId: 'QUE-004',
    queueNumber: 'NTQ-P010',
    queueStatus: 'skipped',
    doctorName: 'BS. Vũ Hoàng Nam',
    departmentName: 'Cơ xương khớp',
    currentStage: 'exceptions',
    nursingStage: 'ready_for_doctor',
    waitingMinutes: 68,
    slaStatus: 'breached',
    riskTags: ['Bỏ qua', 'Ưu tiên', 'Quá SLA'],
    source: 'demo',
  },
];

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  return [];
}

function firstArray(...values) {
  for (const value of values) {
    const items = asArray(value);
    if (items.length) return items;
  }
  return [];
}

function unwrap(settled) {
  return settled?.status === 'fulfilled' ? settled.value : null;
}

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function minutesSince(value) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function extractId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id || value.id || value.patient_id || value.appointment_id || value.queue_ticket_id || null;
}

function extractPatientName(item) {
  return (
    item.patient_name ||
    item.patient?.full_name ||
    item.patient?.name ||
    item.patient_id?.full_name ||
    item.patient_id?.name ||
    item.patient?.display_name ||
    'Chưa rõ bệnh nhân'
  );
}

function extractDoctorName(item) {
  return (
    item.doctor_name ||
    item.doctor?.full_name ||
    item.doctor?.name ||
    item.doctor_id?.user_id?.full_name ||
    item.doctor_id?.full_name ||
    item.doctor_id?.name ||
    'Chưa phân bác sĩ'
  );
}

function extractDepartmentName(item) {
  return (
    item.department_name ||
    item.department?.name ||
    item.department_id?.name ||
    'Chưa rõ khoa'
  );
}

function normalizeQueueTicket(ticket = {}) {
  const checkinTime = ticket.checkin_time || ticket.checked_in_at || ticket.created_at;
  const status = ticket.status || 'waiting';
  return {
    id: extractId(ticket) || ticket.queue_ticket_id || `queue-${ticket.queue_number || Math.random()}`,
    patientId: extractId(ticket.patient || ticket.patient_id),
    patientName: extractPatientName(ticket),
    patientCode: ticket.patient_code || ticket.patient?.patient_code || ticket.patient_id?.patient_code || '—',
    patientMeta: ticket.patient_meta || ticket.patient?.gender_age || '',
    appointmentId: extractId(ticket.appointment || ticket.appointment_id),
    appointmentTime: ticket.appointment_time || ticket.appointment?.appointment_time,
    appointmentStatus: ticket.appointment_status || ticket.appointment?.status,
    queueId: extractId(ticket) || ticket.queue_ticket_id,
    queueNumber: ticket.display_number || ticket.queue_number || '—',
    queueStatus: status,
    encounterId: extractId(ticket.encounter || ticket.encounter_id),
    doctorName: extractDoctorName(ticket),
    departmentName: extractDepartmentName(ticket),
    currentStage: inferStageFromQueue(ticket),
    nursingStage: ticket.nursing_stage || ticket.nursing?.stage || 'not_started',
    waitingMinutes: safeNumber(ticket.waiting_minutes, minutesSince(checkinTime)),
    serviceMinutes: safeNumber(ticket.service_minutes, minutesSince(ticket.service_start_time)),
    slaStatus: ticket.sla_status || (ticket.sla_breached_at ? 'breached' : status === 'waiting' && minutesSince(checkinTime) > 30 ? 'warning' : 'normal'),
    riskTags: normalizeRiskTags(ticket),
    calledTime: ticket.called_time,
    serviceStartTime: ticket.service_start_time,
    completedTime: ticket.completed_time,
    source: 'queue',
    raw: ticket,
  };
}

function normalizeAppointment(appointment = {}, linkedQueue = null) {
  const status = appointment.status || 'booked';
  const queue = linkedQueue ? normalizeQueueTicket(linkedQueue) : null;
  return {
    id: extractId(appointment) || appointment.appointment_id || `appointment-${appointment.appointment_time || Math.random()}`,
    patientId: extractId(appointment.patient || appointment.patient_id),
    patientName: extractPatientName(appointment),
    patientCode: appointment.patient_code || appointment.patient?.patient_code || appointment.patient_id?.patient_code || '—',
    patientMeta: appointment.patient_meta || appointment.patient?.gender_age || '',
    appointmentId: extractId(appointment) || appointment.appointment_id,
    appointmentTime: appointment.appointment_time || appointment.start_time || appointment.time,
    appointmentStatus: status,
    queueId: queue?.queueId || extractId(appointment.queue || appointment.queue_ticket),
    queueNumber: queue?.queueNumber || appointment.queue_number || appointment.queue?.queue_number,
    queueStatus: queue?.queueStatus || appointment.queue_status,
    encounterId: queue?.encounterId || extractId(appointment.encounter || appointment.encounter_id),
    doctorName: extractDoctorName(appointment),
    departmentName: extractDepartmentName(appointment),
    currentStage: queue?.currentStage || inferStageFromAppointment(appointment),
    nursingStage: queue?.nursingStage || appointment.nursing_stage || 'not_started',
    waitingMinutes: queue?.waitingMinutes || safeNumber(appointment.waiting_minutes, status === 'checked_in' ? minutesSince(appointment.checked_in_at) : 0),
    serviceMinutes: queue?.serviceMinutes || safeNumber(appointment.service_minutes, status === 'in_consultation' ? minutesSince(appointment.consultation_started_at) : 0),
    slaStatus: queue?.slaStatus || 'normal',
    riskTags: queue?.riskTags?.length ? queue.riskTags : appointmentRiskTags(appointment),
    checkedInAt: appointment.checked_in_at,
    source: 'appointment',
    raw: appointment,
  };
}

function normalizeFlowRemote(item = {}) {
  const patient = item.patient || item.patient_summary || {};
  const appointment = item.appointment || item.appointment_summary || {};
  const queue = item.queue || item.queue_summary || {};
  const nursing = item.nursing || item.nursing_summary || {};
  const encounter = item.encounter || item.encounter_summary || {};
  const stage = item.current_stage || item.stage || inferStageFromQueue(queue) || inferStageFromAppointment(appointment);

  return {
    id: item.flow_id || item.id || item._id || extractId(queue) || extractId(appointment) || `flow-${Math.random()}`,
    patientId: extractId(patient) || extractId(item.patient_id),
    patientName: item.patient_name || patient.full_name || patient.name || extractPatientName(item),
    patientCode: item.patient_code || patient.patient_code || '—',
    patientMeta: item.patient_meta || patient.gender_age || '',
    appointmentId: extractId(appointment) || extractId(item.appointment_id),
    appointmentTime: item.appointment_time || appointment.appointment_time || appointment.start_time,
    appointmentStatus: item.appointment_status || appointment.status,
    queueId: extractId(queue) || extractId(item.queue_ticket_id),
    queueNumber: item.queue_number || queue.display_number || queue.queue_number,
    queueStatus: item.queue_status || queue.status,
    encounterId: extractId(encounter) || extractId(item.encounter_id),
    doctorName: item.doctor_name || item.doctor?.name || appointment.doctor_name || queue.doctor_name || 'Chưa phân bác sĩ',
    departmentName: item.department_name || item.department?.name || appointment.department_name || queue.department_name || 'Chưa rõ khoa',
    currentStage: stage || 'scheduled',
    nursingStage: item.nursing_stage || nursing.stage || queue.nursing_stage || 'not_started',
    waitingMinutes: safeNumber(item.waiting_minutes, queue.checkin_time ? minutesSince(queue.checkin_time) : 0),
    serviceMinutes: safeNumber(item.service_minutes, queue.service_start_time ? minutesSince(queue.service_start_time) : 0),
    slaStatus: item.sla_status || (item.sla_breached_at || queue.sla_breached_at ? 'breached' : 'normal'),
    riskTags: Array.isArray(item.risk_tags) ? item.risk_tags : normalizeRiskTags(item),
    availableActions: item.available_actions || [],
    source: 'operations',
    raw: item,
  };
}

function normalizeRiskTags(item = {}) {
  const tags = [];
  const queueType = item.queue_type || item.queue?.queue_type;
  if (queueType === 'vip') tags.push('VIP');
  if (queueType === 'priority') tags.push('Ưu tiên');
  if (item.sla_breached_at || item.sla_status === 'breached') tags.push('Quá SLA');
  if ((item.waiting_minutes || minutesSince(item.checkin_time)) > 30) tags.push('Chờ lâu');
  if (item.nursing_stage === 'ready_for_doctor') tags.push('Ready for doctor');
  if (item.status === 'skipped') tags.push('Bỏ qua');
  if (item.status === 'no_show') tags.push('No-show');
  return tags;
}

function appointmentRiskTags(appointment = {}) {
  const tags = [];
  if (appointment.status === 'confirmed') tags.push('Chưa check-in');
  if (appointment.status === 'checked_in') tags.push('Đã đến');
  if (appointment.status === 'no_show') tags.push('No-show');
  if (appointment.status === 'cancelled') tags.push('Đã hủy');
  if (appointment.appointment_time && minutesSince(appointment.appointment_time) > 15 && ['booked', 'confirmed'].includes(appointment.status)) tags.push('Trễ check-in');
  return tags;
}

function inferStageFromAppointment(appointment = {}) {
  const status = appointment.status;
  if (status === 'completed') return 'completed';
  if (status === 'in_consultation') return 'in_consultation';
  if (status === 'checked_in') return 'checked_in';
  if (status === 'confirmed') return 'confirmed';
  if (status === 'cancelled' || status === 'no_show') return 'exceptions';
  return 'scheduled';
}

function inferStageFromQueue(ticket = {}) {
  const status = ticket.status;
  if (!status) return null;
  if (status === 'completed') return 'completed';
  if (status === 'in_service') return 'in_consultation';
  if (status === 'called' || status === 'recalled') return 'called';
  if (status === 'skipped' || status === 'no_show' || status === 'cancelled') return 'exceptions';
  if (ticket.nursing_stage === 'ready_for_doctor' || ticket.ready_for_doctor_at) return 'ready_for_doctor';
  if (ticket.nursing_stage && ticket.nursing_stage !== 'not_started') return 'waiting_nurse';
  return 'checked_in';
}

function stageOrder(stage) {
  const index = FLOW_STEPS.findIndex((item) => item.key === stage);
  if (stage === 'confirmed') return 1;
  if (stage === 'exceptions') return 99;
  return index >= 0 ? index : 0;
}

function buildFlowItems({ operations, appointments, queueTickets }) {
  const remoteColumns = operations?.columns;
  if (remoteColumns && typeof remoteColumns === 'object') {
    const remoteItems = Object.values(remoteColumns)
      .flatMap((items) => asArray(items))
      .map(normalizeFlowRemote);
    if (remoteItems.length) return dedupeFlowItems(remoteItems);
  }

  const remoteItems = firstArray(operations?.items, operations?.data, operations?.results).map(normalizeFlowRemote);
  if (remoteItems.length) return dedupeFlowItems(remoteItems);

  const normalizedQueues = queueTickets.map(normalizeQueueTicket);
  const queuesByAppointment = new Map(normalizedQueues.filter((item) => item.appointmentId).map((item) => [item.appointmentId, item.raw || item]));
  const normalizedAppointments = appointments.map((item) => normalizeAppointment(item, queuesByAppointment.get(extractId(item) || item.appointment_id)));

  return dedupeFlowItems([...normalizedQueues, ...normalizedAppointments]);
}

function dedupeFlowItems(items) {
  const seen = new Map();
  items.forEach((item) => {
    const key = item.appointmentId || item.queueId || item.id;
    const existing = seen.get(key);
    if (!existing || stageOrder(item.currentStage) > stageOrder(existing.currentStage)) {
      seen.set(key, item);
    }
  });
  return [...seen.values()].sort((a, b) => {
    const critical = Number(b.slaStatus === 'breached') - Number(a.slaStatus === 'breached');
    if (critical) return critical;
    return (b.waitingMinutes || 0) - (a.waitingMinutes || 0);
  });
}

function summarize(items, remoteSummary = {}) {
  const count = (predicate) => items.filter(predicate).length;
  return {
    scheduled: safeNumber(remoteSummary.scheduled, count((item) => ['scheduled', 'confirmed'].includes(item.currentStage))),
    checked_in: safeNumber(remoteSummary.checked_in, count((item) => ['checked_in', 'waiting_nurse', 'ready_for_doctor', 'called'].includes(item.currentStage))),
    waiting: safeNumber(remoteSummary.waiting, count((item) => ['waiting_nurse', 'ready_for_doctor', 'checked_in'].includes(item.currentStage))),
    ready_for_doctor: safeNumber(remoteSummary.ready_for_doctor, count((item) => item.currentStage === 'ready_for_doctor')),
    in_consultation: safeNumber(remoteSummary.in_consultation, count((item) => item.currentStage === 'in_consultation')),
    completed: safeNumber(remoteSummary.completed, count((item) => item.currentStage === 'completed')),
    no_show: safeNumber(remoteSummary.no_show, count((item) => item.appointmentStatus === 'no_show' || item.queueStatus === 'no_show')),
    needs_action: safeNumber(remoteSummary.needs_action, count((item) => item.currentStage === 'exceptions' || item.slaStatus === 'breached')),
    sla_breached: safeNumber(remoteSummary.sla_breached, count((item) => item.slaStatus === 'breached')),
  };
}

function makeActionAlerts(items, backendAlerts = [], abnormalVitals = []) {
  const alerts = [
    ...asArray(backendAlerts).map((item, index) => ({
      id: item.id || item.alert_id || `backend-alert-${index}`,
      severity: item.severity || item.priority || 'high',
      title: item.title || item.message || 'Cảnh báo vận hành',
      message: item.message || item.description || 'Cần điều phối viên kiểm tra trường hợp này.',
      patientName: extractPatientName(item),
      departmentName: extractDepartmentName(item),
      queueId: extractId(item.queue || item.queue_ticket_id),
      appointmentId: extractId(item.appointment || item.appointment_id),
      type: item.type || 'backend_alert',
      raw: item,
    })),
    ...asArray(abnormalVitals).map((item, index) => ({
      id: item.id || item.alert_id || `abnormal-vital-${index}`,
      severity: 'critical',
      title: 'Sinh hiệu bất thường đang chờ xử lý',
      message: item.message || 'Bệnh nhân có sinh hiệu bất thường, cần ưu tiên điều phối.',
      patientName: extractPatientName(item),
      departmentName: extractDepartmentName(item),
      queueId: extractId(item.queue || item.queue_ticket_id),
      appointmentId: extractId(item.appointment || item.appointment_id),
      type: 'abnormal_vital_waiting',
      raw: item,
    })),
  ];

  items.forEach((item) => {
    if (item.slaStatus === 'breached') {
      alerts.push({
        id: `sla-${item.id}`,
        severity: 'critical',
        title: 'Bệnh nhân chờ quá SLA',
        message: `${item.patientName} đã chờ ${item.waitingMinutes || 0} phút ở bước ${STAGE_LABELS[item.currentStage] || item.currentStage}.`,
        patientName: item.patientName,
        departmentName: item.departmentName,
        queueId: item.queueId,
        appointmentId: item.appointmentId,
        type: 'queue_waiting_sla_breached',
        flowItem: item,
      });
    }
    if (item.currentStage === 'ready_for_doctor' && (item.waitingMinutes || 0) > 20) {
      alerts.push({
        id: `ready-${item.id}`,
        severity: 'high',
        title: 'Ready for doctor nhưng chưa được gọi',
        message: `${item.patientName} đã sẵn sàng gặp bác sĩ ${item.waitingMinutes || 0} phút.`,
        patientName: item.patientName,
        departmentName: item.departmentName,
        queueId: item.queueId,
        appointmentId: item.appointmentId,
        type: 'ready_for_doctor_waiting_too_long',
        flowItem: item,
      });
    }
    if (item.appointmentStatus === 'checked_in' && !item.queueId) {
      alerts.push({
        id: `no-queue-${item.id}`,
        severity: 'high',
        title: 'Đã check-in nhưng chưa có queue',
        message: `${item.patientName} đã check-in nhưng chưa có ticket queue.`,
        patientName: item.patientName,
        departmentName: item.departmentName,
        appointmentId: item.appointmentId,
        type: 'checked_in_without_queue',
        flowItem: item,
      });
    }
    if (item.queueStatus === 'skipped') {
      alerts.push({
        id: `skipped-${item.id}`,
        severity: 'medium',
        title: 'Bệnh nhân bị bỏ qua',
        message: `${item.patientName} đang ở trạng thái skipped, cần gọi lại hoặc xử lý no-show.`,
        patientName: item.patientName,
        departmentName: item.departmentName,
        queueId: item.queueId,
        appointmentId: item.appointmentId,
        type: 'skipped_too_long',
        flowItem: item,
      });
    }
  });

  return alerts.slice(0, 30);
}

export function PatientFlowCommandPage({ view = 'board' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.board;
  const scheduling = useSchedulingData();
  const [localFilters, setLocalFilters] = useState({
    date: todayIso(),
    departmentId: null,
    doctorId: null,
  });
  const filters = {
    ...localFilters,
    ...(scheduling.filters || {}),
  };
  const updateFilters = scheduling.updateFilters || ((nextFilters) => {
    setLocalFilters((current) => ({ ...current, ...nextFilters }));
  });
  const [state, setState] = useState({
    loading: true,
    error: null,
    flow: null,
    checkIn: null,
    waiting: null,
    inConsultation: null,
    needsAction: null,
    completed: null,
    appointments: [],
    queueTickets: [],
    nursingReady: null,
    nursingPending: null,
    nursingAlerts: null,
    abnormalVitals: null,
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeStage, setActiveStage] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const date = filters.date || todayIso();

  useEffect(() => {
    let mounted = true;

    const params = {
      date,
      department_id: filters.departmentId || undefined,
      doctor_id: filters.doctorId || undefined,
    };

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      const [
        flow,
        checkIn,
        waiting,
        inConsultation,
        needsAction,
        completed,
        appointments,
        queueTickets,
        nursingReady,
        nursingPending,
        nursingAlerts,
        abnormalVitals,
      ] = await Promise.allSettled([
        schedulingApi.getPatientFlowToday(params),
        schedulingApi.getPatientFlowCheckInMonitor(params),
        schedulingApi.getPatientFlowWaiting(params),
        schedulingApi.getPatientFlowInConsultation(params),
        schedulingApi.getPatientFlowNeedsAction(params),
        schedulingApi.getPatientFlowCompleted(params),
        schedulingApi.getTodayAppointments({ date, department_id: params.department_id, doctor_id: params.doctor_id }),
        schedulingApi.listQueueTickets({ date, department_id: params.department_id, doctor_id: params.doctor_id, limit: 250 }),
        schedulingApi.getNursingReadyForDoctor(params),
        schedulingApi.getNursingPendingPatients(params),
        schedulingApi.getNursingPriorityAlerts(params),
        schedulingApi.getNursingAbnormalVitals(params),
      ]);

      if (!mounted) return;

      const legacyAvailable = appointments.status === 'fulfilled' || queueTickets.status === 'fulfilled' || nursingReady.status === 'fulfilled' || nursingPending.status === 'fulfilled';
      const rejected = legacyAvailable
        ? null
        : [appointments, queueTickets, flow].find((item) => item.status === 'rejected');

      setState({
        loading: false,
        error: rejected ? rejected.reason?.message || 'Không tải được dữ liệu điều phối bệnh nhân.' : null,
        flow: unwrap(flow),
        checkIn: unwrap(checkIn),
        waiting: unwrap(waiting),
        inConsultation: unwrap(inConsultation),
        needsAction: unwrap(needsAction),
        completed: unwrap(completed),
        appointments: firstArray(unwrap(appointments)?.items, unwrap(appointments)?.appointments, unwrap(appointments)),
        queueTickets: firstArray(unwrap(queueTickets)?.items, unwrap(queueTickets)?.tickets, unwrap(queueTickets)),
        nursingReady: unwrap(nursingReady),
        nursingPending: unwrap(nursingPending),
        nursingAlerts: unwrap(nursingAlerts),
        abnormalVitals: unwrap(abnormalVitals),
      });
    }

    load();
    return () => {
      mounted = false;
    };
  }, [date, filters.departmentId, filters.doctorId, reloadKey]);

  const refreshFlow = useCallback(async () => {
    setReloadKey((current) => current + 1);
    await scheduling.refresh?.();
  }, [scheduling]);

  const flowItems = useMemo(() => {
    const built = buildFlowItems({
      operations: state.flow,
      appointments: state.appointments,
      queueTickets: state.queueTickets,
    });
    return built.length ? built : fallbackFlowItems;
  }, [state.appointments, state.flow, state.queueTickets]);

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return flowItems.filter((item) => {
      const matchesStage = activeStage === 'all' || item.currentStage === activeStage || (activeStage === 'waiting' && ['checked_in', 'waiting_nurse', 'ready_for_doctor'].includes(item.currentStage));
      const haystack = `${item.patientName} ${item.patientCode} ${item.queueNumber || ''} ${item.doctorName} ${item.departmentName}`.toLowerCase();
      return matchesStage && (!keyword || haystack.includes(keyword));
    });
  }, [activeStage, flowItems, searchTerm]);

  const summary = useMemo(() => summarize(flowItems, state.flow?.summary || {}), [flowItems, state.flow]);
  const alerts = useMemo(
    () => makeActionAlerts(flowItems, firstArray(state.needsAction?.items, state.needsAction?.alerts, state.nursingAlerts), state.abnormalVitals),
    [flowItems, state.abnormalVitals, state.needsAction, state.nursingAlerts],
  );

  const runAction = async (action, payload = {}) => {
    const configByAction = {
      'check-in': {
        label: 'Đã check-in bệnh nhân.',
        run: () => schedulingApi.checkInAppointment(payload.appointmentId, {}),
        confirm: { title: 'Check-in bệnh nhân', body: 'Đưa bệnh nhân vào luồng tiếp nhận trong ngày.', confirmLabel: 'check-in' },
      },
      'create-queue': {
        label: 'Đã tạo queue từ lịch hẹn.',
        run: () => schedulingApi.createQueueFromAppointment(payload.appointmentId, {}),
        confirm: { title: 'Tạo queue', body: 'Tạo queue ticket cho appointment đã check-in.', confirmLabel: 'tạo queue' },
      },
      call: {
        label: 'Đã gọi bệnh nhân.',
        run: () => schedulingApi.callQueueTicket(payload.queueId, {}),
        confirm: { title: 'Gọi bệnh nhân', body: 'Gọi queue ticket đang chọn.', confirmLabel: 'gọi bệnh nhân' },
      },
      'start-service': {
        label: 'Đã bắt đầu phục vụ.',
        run: () => schedulingApi.startQueueService(payload.queueId, {}),
        confirm: { title: 'Bắt đầu phục vụ', body: 'Chuyển queue sang trạng thái đang phục vụ.', confirmLabel: 'bắt đầu' },
      },
      'no-show': {
        label: 'Đã đánh dấu no-show.',
        run: () => schedulingApi.markQueueNoShow(payload.queueId, { reason: 'patient_flow_no_show' }),
        confirm: { title: 'Đánh dấu no-show', body: 'Chuyển queue sang no-show trong luồng bệnh nhân.', confirmLabel: 'mark no-show' },
      },
      'ack-alert': {
        label: 'Đã acknowledge cảnh báo.',
        run: () => schedulingApi.acknowledgePatientFlowAlert(payload.alertId, {}),
      },
    }[action];

    if (!configByAction || !configByAction.run) {
      setFeedback({ type: 'error', message: 'Thao tác điều phối chưa đủ dữ liệu để thực hiện.' });
      return;
    }

    await runSchedulingAction({
      action: async () => {
        const result = await configByAction.run();
        await refreshFlow();
        return result;
      },
      confirm: configByAction.confirm,
      pendingMessage: 'Đang gửi thao tác điều phối...',
      successTitle: 'Luồng bệnh nhân đã cập nhật',
      successBody: configByAction.label,
      errorTitle: 'Không xử lý được luồng bệnh nhân',
      errorBody: 'Không thực hiện được thao tác.',
      to: '/scheduling/patient-flow',
      onStatus: (message, type) => setFeedback({ type: type === 'error' ? 'error' : type === 'pending' ? 'pending' : 'success', message }),
    });
  };

  return (
    <div className="sched-flow-page">
      <PatientFlowHeader config={config} filters={filters} updateFilters={updateFilters} state={state} />

      {feedback ? <div className={`sched-command-feedback is-${feedback.type}`}>{feedback.message}</div> : null}

      <PatientFlowKpis summary={summary} />

      <FlowToolbar
        activeStage={activeStage}
        setActiveStage={setActiveStage}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        alertCount={alerts.length}
      />

      {view === 'board' ? (
        <PatientFlowBoard items={filteredItems} loading={state.loading} onSelect={setSelectedItem} runAction={runAction} />
      ) : null}

      {view === 'checkIn' ? (
        <CheckInMonitor items={filteredItems} monitor={state.checkIn} loading={state.loading} onSelect={setSelectedItem} runAction={runAction} />
      ) : null}

      {view === 'waiting' ? (
        <WaitingPatients items={filteredItems} waiting={state.waiting} loading={state.loading} onSelect={setSelectedItem} runAction={runAction} />
      ) : null}

      {view === 'inConsultation' ? (
        <InConsultationPatients items={filteredItems} source={state.inConsultation} loading={state.loading} onSelect={setSelectedItem} runAction={runAction} />
      ) : null}

      {view === 'needsAction' ? (
        <NeedsActionInbox alerts={alerts} loading={state.loading} runAction={runAction} onSelect={(alert) => setSelectedItem(alert.flowItem || null)} />
      ) : null}

      {view === 'completed' ? (
        <CompletedPatients items={filteredItems} completed={state.completed} loading={state.loading} onSelect={setSelectedItem} onSync={refreshFlow} />
      ) : null}

      {selectedItem ? (
        <PatientFlowDrawer item={selectedItem} onClose={() => setSelectedItem(null)} runAction={runAction} />
      ) : null}
    </div>
  );
}

function PatientFlowHeader({ config, filters, updateFilters, state }) {
  return (
    <section className="sched-command-hero sched-flow-hero">
      <div className="sched-command-hero__copy">
        <span className="sched-command-eyebrow">{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
        <div className="sched-command-hero__meta">
          <span className="sched-realtime-dot" />
          {state.loading ? 'Đang đồng bộ dữ liệu patient flow' : 'Realtime sẵn sàng · Queue/Nursing/Appointment'}
          {state.error ? <span className="sched-command-error"> · {state.error}</span> : null}
        </div>
      </div>

      <div className="sched-command-controls">
        <label>
          Ngày vận hành
          <input
            type="date"
            value={filters.date || todayIso()}
            onChange={(event) => updateFilters({ date: event.target.value })}
          />
        </label>
        <label>
          Khoa
          <select value={filters.departmentId || ''} onChange={(event) => updateFilters({ departmentId: event.target.value || null })}>
            <option value="">Toàn hệ thống</option>
            <option value="dept-demo-1">Nội tổng quát</option>
            <option value="dept-demo-2">Tim mạch</option>
            <option value="dept-demo-3">Nhi khoa</option>
          </select>
        </label>
        <label>
          Bác sĩ
          <select value={filters.doctorId || ''} onChange={(event) => updateFilters({ doctorId: event.target.value || null })}>
            <option value="">Tất cả bác sĩ</option>
            <option value="doctor-demo-1">BS. Trần Thanh Hải</option>
            <option value="doctor-demo-2">BS. Lê Minh Tuấn</option>
          </select>
        </label>
      </div>

      <div className="sched-command-quick-actions">
        <Link to="/scheduling/patient-flow/check-in"><UserCheck size={16} /> Check-in</Link>
        <Link to="/scheduling/patient-flow/waiting"><Clock3 size={16} /> Đang chờ</Link>
        <Link to="/scheduling/queue/call"><BellRing size={16} /> Gọi bệnh nhân</Link>
        <Link to="/scheduling/patient-flow/needs-action"><ShieldAlert size={16} /> Cần điều phối</Link>
      </div>
    </section>
  );
}

function PatientFlowKpis({ summary }) {
  const cards = [
    { label: 'Đã đặt lịch', value: summary.scheduled, icon: CalendarCheck2, tone: 'blue' },
    { label: 'Đã check-in', value: summary.checked_in, icon: UserCheck, tone: 'green' },
    { label: 'Đang chờ', value: summary.waiting, icon: Clock3, tone: 'amber' },
    { label: 'Ready for doctor', value: summary.ready_for_doctor, icon: ClipboardCheck, tone: 'teal' },
    { label: 'Đang khám', value: summary.in_consultation, icon: Stethoscope, tone: 'purple' },
    { label: 'Hoàn tất', value: summary.completed, icon: CheckCircle2, tone: 'green' },
    { label: 'No-show', value: summary.no_show, icon: UserRoundX, tone: 'red' },
    { label: 'Cần điều phối', value: summary.needs_action, icon: ShieldAlert, tone: 'red' },
  ];

  return (
    <section className="sched-queue-kpis">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article className={`sched-queue-kpi is-${card.tone}`} key={card.label}>
            <span><Icon size={19} /></span>
            <div>
              <strong>{card.value}</strong>
              <small>{card.label}</small>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function FlowToolbar({ activeStage, setActiveStage, searchTerm, setSearchTerm, alertCount }) {
  const filters = [
    ['all', 'Tất cả'],
    ['waiting', 'Đang chờ'],
    ['ready_for_doctor', 'Ready'],
    ['called', 'Đã gọi'],
    ['in_consultation', 'Đang khám'],
    ['completed', 'Hoàn tất'],
    ['exceptions', `Cần xử lý (${alertCount})`],
  ];

  return (
    <section className="sched-queue-toolbar">
      <div className="sched-queue-search">
        <Search size={16} />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Tìm bệnh nhân, mã BN, queue, bác sĩ..."
        />
      </div>
      <div className="sched-queue-filter-row">
        <Filter size={15} />
        {filters.map(([key, label]) => (
          <button
            className={activeStage === key ? 'is-active' : ''}
            key={key}
            onClick={() => setActiveStage(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function PatientFlowBoard({ items, loading, onSelect, runAction }) {
  const grouped = useMemo(() => {
    const next = Object.fromEntries(FLOW_COLUMNS.map((column) => [column.key, []]));
    items.forEach((item) => {
      const key = next[item.currentStage] ? item.currentStage : item.currentStage === 'confirmed' ? 'scheduled' : 'exceptions';
      next[key].push(item);
    });
    return next;
  }, [items]);

  if (loading) return <BoardSkeleton />;

  return (
    <section className="sched-flow-board">
      {FLOW_COLUMNS.map((column) => {
        const Icon = column.icon;
        const columnItems = grouped[column.key] || [];
        return (
          <div className="sched-flow-column" key={column.key}>
            <header>
              <span><Icon size={16} /> {column.title}</span>
              <strong>{columnItems.length}</strong>
            </header>
            <div className="sched-flow-column__body">
              {columnItems.length ? columnItems.map((item) => (
                <PatientFlowCard item={item} key={item.id} onSelect={onSelect} runAction={runAction} />
              )) : <EmptyColumn label="Không có bệnh nhân ở bước này" />}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function PatientFlowCard({ item, onSelect, runAction }) {
  return (
    <article className={`sched-flow-card is-${item.slaStatus || 'normal'}`} onClick={() => onSelect(item)}>
      <header>
        <div>
          <strong>{item.patientName}</strong>
          <small>{item.patientCode} {item.patientMeta ? `· ${item.patientMeta}` : ''}</small>
        </div>
        {item.queueNumber ? <span className="sched-queue-number">{item.queueNumber}</span> : <span className="sched-flow-tag">No queue</span>}
      </header>

      <PatientJourneyStepper stage={item.currentStage} />

      <div className="sched-flow-card__meta">
        <span><CalendarCheck2 size={14} /> {formatTime(item.appointmentTime)}</span>
        <span><Stethoscope size={14} /> {item.doctorName}</span>
        <span><UsersRound size={14} /> {item.departmentName}</span>
        {item.waitingMinutes ? <span><Clock3 size={14} /> Chờ {item.waitingMinutes} phút</span> : null}
      </div>

      <div className="sched-flow-card__tags">
        <span>{STAGE_LABELS[item.currentStage] || item.currentStage}</span>
        {item.nursingStage ? <span>Nursing: {item.nursingStage}</span> : null}
        {item.riskTags?.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
      </div>

      <footer onClick={(event) => event.stopPropagation()}>
        {item.queueId ? (
          <>
            <button type="button" onClick={() => runAction('call', { queueId: item.queueId })}>Gọi</button>
            <button type="button" onClick={() => runAction('start-service', { queueId: item.queueId })}>Bắt đầu</button>
          </>
        ) : item.appointmentId ? (
          <button type="button" onClick={() => runAction('create-queue', { appointmentId: item.appointmentId })}>Tạo queue</button>
        ) : null}
        <button type="button" onClick={() => onSelect(item)}>Context</button>
      </footer>
    </article>
  );
}

function PatientJourneyStepper({ stage }) {
  const current = stageOrder(stage);
  return (
    <div className="sched-flow-stepper">
      {FLOW_STEPS.map((step) => {
        const active = stageOrder(step.key) <= current && stage !== 'exceptions';
        return (
          <span className={active ? 'is-done' : ''} key={step.key}>
            <i />
            <small>{step.label}</small>
          </span>
        );
      })}
    </div>
  );
}

function CheckInMonitor({ items, monitor, loading, onSelect, runAction }) {
  const monitorItems = firstArray(monitor?.items, monitor?.appointments).map((item) => normalizeFlowRemote(item));
  const rows = monitorItems.length ? monitorItems : items.filter((item) => ['scheduled', 'confirmed', 'checked_in', 'exceptions'].includes(item.currentStage));

  if (loading) return <TableSkeleton />;

  return (
    <section className="sched-command-panel sched-flow-monitor">
      <header>
        <div>
          <h2>Danh sách check-in trong ngày</h2>
          <p>Ưu tiên các lịch sắp đến, đến trễ, đã check-in nhưng chưa có queue.</p>
        </div>
        <Link to="/scheduling/appointments/check-in"><ArrowRight size={15} /> Mở check-in lịch hẹn</Link>
      </header>
      <div className="sched-flow-table">
        <div className="sched-flow-table__head">
          <span>Giờ hẹn</span>
          <span>Bệnh nhân</span>
          <span>Bác sĩ / khoa</span>
          <span>Trạng thái</span>
          <span>Queue</span>
          <span>Thao tác</span>
        </div>
        {rows.map((item) => (
          <div className="sched-flow-table__row" key={item.id} onClick={() => onSelect(item)}>
            <span>{formatTime(item.appointmentTime)}</span>
            <span><strong>{item.patientName}</strong><small>{item.patientCode}</small></span>
            <span><strong>{item.doctorName}</strong><small>{item.departmentName}</small></span>
            <span><StatusPill value={item.appointmentStatus || item.currentStage} /></span>
            <span>{item.queueNumber || 'Chưa có queue'}</span>
            <span onClick={(event) => event.stopPropagation()}>
              {item.appointmentId && item.currentStage !== 'checked_in' ? (
                <button type="button" onClick={() => runAction('check-in', { appointmentId: item.appointmentId })}>Check-in</button>
              ) : null}
              {item.appointmentId && !item.queueId ? (
                <button type="button" onClick={() => runAction('create-queue', { appointmentId: item.appointmentId })}>Tạo queue</button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WaitingPatients({ items, waiting, loading, onSelect, runAction }) {
  const remote = [];
  const lanes = waiting?.lanes || waiting?.columns;
  if (lanes && typeof lanes === 'object') {
    Object.values(lanes).forEach((value) => remote.push(...asArray(value).map(normalizeFlowRemote)));
  }
  const rows = remote.length ? remote : items.filter((item) => ['checked_in', 'waiting_nurse', 'ready_for_doctor', 'called', 'exceptions'].includes(item.currentStage) && item.currentStage !== 'completed');

  if (loading) return <BoardSkeleton />;

  const groups = [
    { key: 'waiting_nurse', title: 'Chờ điều dưỡng' },
    { key: 'ready_for_doctor', title: 'Ready for doctor' },
    { key: 'called', title: 'Đã gọi' },
    { key: 'exceptions', title: 'Bị bỏ qua / quá SLA' },
  ];

  return (
    <section className="sched-flow-waiting-grid">
      {groups.map((group) => {
        const groupRows = rows.filter((item) => item.currentStage === group.key || (group.key === 'exceptions' && item.slaStatus === 'breached'));
        return (
          <div className="sched-command-panel" key={group.key}>
            <header>
              <div>
                <h2>{group.title}</h2>
                <p>{groupRows.length} bệnh nhân</p>
              </div>
            </header>
            <div className="sched-flow-stack">
              {groupRows.length ? groupRows.map((item) => (
                <PatientFlowCard item={item} key={item.id} onSelect={onSelect} runAction={runAction} />
              )) : <EmptyColumn label="Không có bệnh nhân" />}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function InConsultationPatients({ items, source, loading, onSelect, runAction }) {
  const remote = firstArray(source?.items, source?.in_consultation, source?.data).map(normalizeFlowRemote);
  const rows = remote.length ? remote : items.filter((item) => item.currentStage === 'in_consultation' || item.queueStatus === 'in_service');

  if (loading) return <TableSkeleton />;

  return (
    <section className="sched-command-panel sched-flow-monitor">
      <header>
        <div>
          <h2>Bệnh nhân đang khám</h2>
          <p>Giám sát thời lượng khám, encounter và mismatch giữa queue, appointment, encounter.</p>
        </div>
        <Link to="/clinical/encounters"><Stethoscope size={15} /> Mở encounter</Link>
      </header>
      <div className="sched-flow-service-grid">
        {rows.length ? rows.map((item) => (
          <article className="sched-flow-service-card" key={item.id} onClick={() => onSelect(item)}>
            <header>
              <span>{item.queueNumber || 'No queue'}</span>
              <StatusPill value={item.queueStatus || item.appointmentStatus || item.currentStage} />
            </header>
            <strong>{item.patientName}</strong>
            <small>{item.doctorName} · {item.departmentName}</small>
            <div className="sched-flow-service-card__metric">
              <Clock3 size={16} />
              <span>Đang khám {item.serviceMinutes || item.waitingMinutes || 0} phút</span>
            </div>
            <footer onClick={(event) => event.stopPropagation()}>
              {item.encounterId ? <Link to={`/clinical/encounters/${item.encounterId}`}>Mở encounter</Link> : <span>Chưa có encounter</span>}
              {item.queueId ? <button type="button" onClick={() => runAction('start-service', { queueId: item.queueId })}>Đồng bộ</button> : null}
            </footer>
          </article>
        )) : <EmptyColumn label="Không có bệnh nhân đang khám" />}
      </div>
    </section>
  );
}

function NeedsActionInbox({ alerts, loading, runAction, onSelect }) {
  if (loading) return <TableSkeleton />;

  return (
    <section className="sched-command-panel sched-flow-alert-inbox">
      <header>
        <div>
          <h2>Priority inbox</h2>
          <p>Cảnh báo được xếp theo mức độ vận hành và an toàn bệnh nhân.</p>
        </div>
        <Link to="/scheduling/alerts"><AlertTriangle size={15} /> Cảnh báo vận hành</Link>
      </header>
      <div className="sched-flow-alert-list">
        {alerts.length ? alerts.map((alert) => (
          <article className={`sched-flow-alert is-${alert.severity}`} key={alert.id} onClick={() => onSelect(alert)}>
            <span>{alert.severity}</span>
            <div>
              <strong>{alert.title}</strong>
              <p>{alert.message}</p>
              <small>{alert.patientName || 'Không rõ bệnh nhân'} · {alert.departmentName || 'Không rõ khoa'} · {alert.type}</small>
            </div>
            <footer onClick={(event) => event.stopPropagation()}>
              {alert.queueId ? <Link to={`/scheduling/queue?ticket=${alert.queueId}`}>Mở queue</Link> : null}
              {alert.appointmentId ? <Link to={`/scheduling/appointments?appointment=${alert.appointmentId}`}>Mở lịch hẹn</Link> : null}
              <button type="button" onClick={() => runAction('ack-alert', { alertId: alert.id })}>Acknowledge</button>
            </footer>
          </article>
        )) : <EmptyColumn label="Không có cảnh báo cần xử lý" />}
      </div>
    </section>
  );
}

function CompletedPatients({ items, completed, loading, onSelect, onSync }) {
  const remote = firstArray(completed?.items, completed?.completed, completed?.data).map(normalizeFlowRemote);
  const rows = remote.length ? remote : items.filter((item) => ['completed', 'exceptions'].includes(item.currentStage) || ['completed', 'no_show', 'cancelled'].includes(item.appointmentStatus));

  if (loading) return <TableSkeleton />;

  return (
    <section className="sched-command-panel sched-flow-monitor">
      <header>
        <div>
          <h2>Hoàn tất / rời hệ thống</h2>
          <p>Theo dõi cycle time, no-show, hủy và các pending sau khám.</p>
        </div>
        <button type="button" onClick={onSync}><RefreshCw size={15} /> Đồng bộ</button>
      </header>
      <div className="sched-flow-table">
        <div className="sched-flow-table__head is-completed">
          <span>Bệnh nhân</span>
          <span>Queue</span>
          <span>Bác sĩ / khoa</span>
          <span>Appointment</span>
          <span>Encounter</span>
          <span>Tổng thời gian</span>
        </div>
        {rows.map((item) => (
          <div className="sched-flow-table__row is-completed" key={item.id} onClick={() => onSelect(item)}>
            <span><strong>{item.patientName}</strong><small>{item.patientCode}</small></span>
            <span>{item.queueNumber || '—'}</span>
            <span><strong>{item.doctorName}</strong><small>{item.departmentName}</small></span>
            <span><StatusPill value={item.appointmentStatus || item.currentStage} /></span>
            <span>{item.encounterId || '—'}</span>
            <span>{(item.waitingMinutes || 0) + (item.serviceMinutes || 0)} phút</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PatientFlowDrawer({ item, onClose, runAction }) {
  return (
    <aside className="sched-queue-drawer">
      <header>
        <div>
          <span className="sched-command-eyebrow">Patient context</span>
          <h2>{item.patientName}</h2>
          <p>{item.patientCode} · {item.departmentName}</p>
        </div>
        <button type="button" onClick={onClose}>Đóng</button>
      </header>

      <div className="sched-queue-drawer__section">
        <h3>Journey</h3>
        <PatientJourneyStepper stage={item.currentStage} />
        <dl>
          <div><dt>Stage</dt><dd>{STAGE_LABELS[item.currentStage] || item.currentStage}</dd></div>
          <div><dt>Giờ hẹn</dt><dd>{formatDateTime(item.appointmentTime)}</dd></div>
          <div><dt>Queue</dt><dd>{item.queueNumber || 'Chưa có queue'}</dd></div>
          <div><dt>Nursing</dt><dd>{item.nursingStage || '—'}</dd></div>
          <div><dt>SLA</dt><dd>{item.slaStatus || 'normal'}</dd></div>
        </dl>
      </div>

      <div className="sched-queue-drawer__section">
        <h3>Liên kết</h3>
        <div className="sched-queue-drawer__links">
          {item.appointmentId ? <Link to={`/scheduling/appointments?appointment=${item.appointmentId}`}>Appointment</Link> : null}
          {item.queueId ? <Link to={`/scheduling/queue?ticket=${item.queueId}`}>Queue ticket</Link> : null}
          {item.encounterId ? <Link to={`/clinical/encounters/${item.encounterId}`}>Encounter</Link> : null}
          {!item.appointmentId && !item.queueId && !item.encounterId ? <span>Chưa có liên kết nghiệp vụ</span> : null}
        </div>
      </div>

      <div className="sched-queue-drawer__section">
        <h3>Cảnh báo</h3>
        <div className="sched-flow-card__tags">
          {(item.riskTags?.length ? item.riskTags : ['Không có cảnh báo']).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      </div>

      <div className="sched-queue-drawer__actions">
        {item.appointmentId && !item.queueId ? <button type="button" onClick={() => runAction('create-queue', { appointmentId: item.appointmentId })}>Tạo queue</button> : null}
        {item.queueId ? <button type="button" onClick={() => runAction('call', { queueId: item.queueId })}>Gọi bệnh nhân</button> : null}
        {item.queueId ? <button type="button" onClick={() => runAction('no-show', { queueId: item.queueId })}>Mark no-show</button> : null}
      </div>

      <div className="sched-queue-drawer__section">
        <h3>Timeline vận hành</h3>
        <ol className="sched-queue-timeline">
          <li><History size={14} /> {formatTime(item.appointmentTime)} · Lịch hẹn được ghi nhận</li>
          {item.checkedInAt ? <li><UserCheck size={14} /> {formatTime(item.checkedInAt)} · Bệnh nhân check-in</li> : null}
          {item.queueNumber ? <li><BellRing size={14} /> Queue {item.queueNumber} · {STATUS_LABELS[item.queueStatus] || item.queueStatus}</li> : null}
          {item.encounterId ? <li><Stethoscope size={14} /> Encounter {item.encounterId}</li> : null}
        </ol>
      </div>
    </aside>
  );
}

function StatusPill({ value }) {
  return <span className={`sched-status-pill is-${value || 'unknown'}`}>{STATUS_LABELS[value] || STAGE_LABELS[value] || value || '—'}</span>;
}

function EmptyColumn({ label }) {
  return <div className="sched-flow-empty">{label}</div>;
}

function BoardSkeleton() {
  return (
    <section className="sched-flow-board">
      {FLOW_COLUMNS.slice(0, 5).map((column) => (
        <div className="sched-flow-column is-loading" key={column.key}>
          <header><span>{column.title}</span><strong>...</strong></header>
          <div className="sched-flow-column__body">
            <div className="sched-flow-skeleton" />
            <div className="sched-flow-skeleton" />
          </div>
        </div>
      ))}
    </section>
  );
}

function TableSkeleton() {
  return (
    <section className="sched-command-panel sched-flow-monitor">
      <div className="sched-flow-skeleton is-wide" />
      <div className="sched-flow-skeleton is-wide" />
      <div className="sched-flow-skeleton is-wide" />
    </section>
  );
}
