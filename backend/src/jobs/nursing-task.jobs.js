const { NursingTask, Notification } = require('../models');
const {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_RECIPIENT_TYPE,
  NOTIFICATION_STATUS,
} = require('../constants/statuses');
const realtimeService = require('../realtime/realtime.service');

const OPEN_STATUSES = ['draft', 'assigned', 'accepted', 'todo', 'in_progress', 'blocked', 'waiting_doctor'];
const MANAGER_ESCALATION_PRIORITIES = ['high', 'urgent', 'stat', 'critical'];

function normalizeId(value) {
  if (!value) return null;
  const id = value._id || value.id || value;
  return typeof id.toString === 'function' ? id.toString() : String(id);
}

function notificationPriority(priority) {
  if (['stat', 'critical'].includes(priority)) return NOTIFICATION_PRIORITY.CRITICAL;
  if (priority === 'urgent') return NOTIFICATION_PRIORITY.URGENT;
  if (priority === 'high') return NOTIFICATION_PRIORITY.HIGH;
  if (priority === 'low') return NOTIFICATION_PRIORITY.LOW;
  return NOTIFICATION_PRIORITY.NORMAL;
}

async function createOverdueNotification(task) {
  if (!task.assigned_to) return null;
  return Notification.create({
    recipient_type: NOTIFICATION_RECIPIENT_TYPE.STAFF,
    recipient_id: task.assigned_to,
    recipient_actor_type: 'staff',
    recipient_actor_id: task.assigned_to,
    recipient_user_id: task.assigned_to,
    patient_id: task.patient_id,
    channel: NOTIFICATION_CHANNEL.IN_APP,
    notification_type: 'nursing_task.overdue',
    event_type: 'nursing_task.overdue',
    priority: notificationPriority(task.priority),
    dedupe_key: `nursing_task:overdue:${normalizeId(task)}`,
    title: 'Task điều dưỡng quá hạn',
    message: `${task.task_code || 'Task'} - ${task.title}`,
    action_url: `/nurse/tasks-handover/overdue?task=${normalizeId(task)}`,
    payload: {
      entity_type: 'nursing_task',
      entity_id: normalizeId(task),
      task_code: task.task_code,
      due_at: task.due_at,
    },
    created_by_module: 'nursing-task-overdue-job',
    sent_at: new Date(),
    delivered_at: new Date(),
    status: NOTIFICATION_STATUS.SENT,
  }).catch((error) => {
    if (error?.code === 11000) return null;
    throw error;
  });
}

async function detectOverdueNursingTasks({ limit = 200, now = new Date() } = {}) {
  const tasks = await NursingTask.find({
    status: { $in: OPEN_STATUSES },
    due_at: { $lt: now },
  })
    .sort({ due_at: 1 })
    .limit(limit);

  let marked = 0;
  let notified = 0;
  let escalated = 0;

  for (const task of tasks) {
    const firstOverdue = !task.overdue_at;
    if (firstOverdue) {
      task.overdue_at = now;
      task.status = 'overdue';
      marked += 1;
    }
    const lateMinutes = Math.max(0, Math.floor((now.getTime() - new Date(task.due_at).getTime()) / 60000));
    if (task.sla_minutes && lateMinutes >= Number(task.sla_minutes) && Number(task.escalation_level || 0) < 1) {
      task.escalation_level = 1;
      task.escalated_at = now;
      task.escalation_reason = task.escalation_reason || 'Task vượt ngưỡng SLA tự động.';
      escalated += 1;
    }
    await task.save();
    const notification = await createOverdueNotification(task);
    if (notification) notified += 1;
    realtimeService.emitToScope('nursing_task.overdue', {
      task_id: normalizeId(task),
      task_code: task.task_code,
      patient_id: normalizeId(task.patient_id),
      department_id: normalizeId(task.department_id),
      priority: task.priority,
      due_at: task.due_at,
      overdue_at: task.overdue_at,
      escalation_level: task.escalation_level || 0,
    }, {
      user_id: normalizeId(task.assigned_to),
      department_id: normalizeId(task.department_id),
      role: MANAGER_ESCALATION_PRIORITIES.includes(task.priority) ? 'nurse_manager' : 'nurse',
    });
  }

  return {
    scanned: tasks.length,
    marked,
    notified,
    escalated,
    generated_at: new Date(),
  };
}

module.exports = {
  detectOverdueNursingTasks,
};
