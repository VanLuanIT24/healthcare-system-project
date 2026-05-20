const mongoose = require('mongoose');
const {
  Attachment,
  Charge,
  Encounter,
  ImagingOrder,
  ImagingReport,
  LabOrder,
  LabResult,
  LabResultItem,
  MissingDocumentTask,
  Order,
  ProcedureOrder,
  ProcedureResult,
  Specimen,
} = require('../models');
const patientService = require('./patient.service');
const { createError } = require('../common/errors/error-factory');

const USER_SELECT = 'full_name employee_code username';
const DEPARTMENT_SELECT = 'name code department_name department_code';
const POPULATE_ORDER = [
  { path: 'department_id', select: DEPARTMENT_SELECT },
  { path: 'ordered_by', select: USER_SELECT },
  { path: 'assigned_to', select: USER_SELECT },
  { path: 'charge_id', select: 'charge_no status total_amount' },
];
const POPULATE_ENCOUNTER = [
  { path: 'department_id', select: DEPARTMENT_SELECT },
  { path: 'attending_doctor_id', select: USER_SELECT },
  { path: 'assigned_nurse_id', select: USER_SELECT },
];
const POPULATE_LAB = [
  { path: 'ordered_by', select: USER_SELECT },
  { path: 'order_id', select: 'order_no status priority clinical_indication sla_due_at sla_status ordered_at charge_id' },
];
const POPULATE_IMAGING = [
  { path: 'ordered_by', select: USER_SELECT },
  { path: 'scheduled_by', select: USER_SELECT },
  { path: 'completed_by', select: USER_SELECT },
  { path: 'assigned_technician_id', select: USER_SELECT },
  { path: 'assigned_radiologist_id', select: USER_SELECT },
  { path: 'order_id', select: 'order_no status priority clinical_indication sla_due_at sla_status ordered_at charge_id' },
];
const POPULATE_PROCEDURE = [
  { path: 'requested_by', select: USER_SELECT },
  { path: 'performer_id', select: USER_SELECT },
  { path: 'department_id', select: DEPARTMENT_SELECT },
  { path: 'order_id', select: 'order_no status priority clinical_indication sla_due_at sla_status ordered_at charge_id' },
];

const CLOSED_ORDER_STATUSES = new Set(['completed', 'cancelled', 'entered_in_error', 'no_show']);
const FINAL_RESULT_STATUSES = new Set(['final', 'finalized', 'signed', 'amended', 'released']);
const BAD_SCAN_STATUSES = new Set(['failed', 'infected']);
const BAD_REVIEW_STATUSES = new Set(['rejected']);
const OPEN_MISSING_TASK_STATUSES = new Set(['open', 'pending', 'overdue']);

function toId(value) {
  if (!value) return null;
  return String(value._id || value.id || value);
}

function compactUser(user) {
  if (!user || typeof user !== 'object') return user ? { id: toId(user) } : null;
  return {
    id: toId(user),
    name: user.full_name || user.username || user.employee_code || null,
    code: user.employee_code || null,
  };
}

function compactDepartment(department) {
  if (!department || typeof department !== 'object') return department ? { id: toId(department) } : null;
  return {
    id: toId(department),
    name: department.name || department.department_name || department.code || department.department_code || null,
    code: department.code || department.department_code || null,
  };
}

function normalizePatient(patient = {}) {
  return {
    id: toId(patient.patient_id || patient._id || patient.id),
    patient_id: toId(patient.patient_id || patient._id || patient.id),
    patient_code: patient.patient_code,
    full_name: patient.full_name,
    date_of_birth: patient.date_of_birth,
    gender: patient.gender,
    phone: patient.phone,
    status: patient.status,
  };
}

function normalizeEncounter(encounter = {}) {
  return {
    id: toId(encounter._id || encounter.id),
    encounter_id: toId(encounter._id || encounter.id),
    encounter_code: encounter.encounter_code,
    encounter_type: encounter.encounter_type,
    chief_reason: encounter.chief_reason,
    start_time: encounter.start_time,
    end_time: encounter.end_time,
    status: encounter.status,
    nursing_status: encounter.nursing_status,
    department: compactDepartment(encounter.department_id),
    attending_doctor: compactUser(encounter.attending_doctor_id),
    assigned_nurse: compactUser(encounter.assigned_nurse_id),
  };
}

function normalizeOrder(order = {}) {
  const source = order && typeof order === 'object' ? order : {};
  return {
    id: toId(source._id || source.id || order),
    order_id: toId(source._id || source.id || order),
    order_no: source.order_no,
    order_type: source.order_type,
    priority: source.priority,
    status: source.status,
    clinical_indication: source.clinical_indication,
    ordered_at: source.ordered_at,
    requested_at: source.requested_at,
    acknowledged_at: source.acknowledged_at,
    sla_due_at: source.sla_due_at,
    sla_status: source.sla_status,
    sla_breach_minutes: source.sla_breach_minutes,
    department: compactDepartment(source.department_id),
    ordered_by: compactUser(source.ordered_by),
    assigned_to: compactUser(source.assigned_to),
    charge: source.charge_id && typeof source.charge_id === 'object'
      ? {
        id: toId(source.charge_id),
        charge_no: source.charge_id.charge_no,
        status: source.charge_id.status,
        total_amount: source.charge_id.total_amount,
      }
      : null,
  };
}

function statusIsOpen(status) {
  return status && !CLOSED_ORDER_STATUSES.has(String(status));
}

function isFinalStatus(status) {
  return FINAL_RESULT_STATUSES.has(String(status || '').toLowerCase());
}

function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function minutesBetween(start, end = new Date()) {
  const date = dateValue(start);
  if (!date) return null;
  return Math.max(Math.floor((end.getTime() - date.getTime()) / 60000), 0);
}

function computeSla(order = {}, fallbackStart) {
  const now = new Date();
  const due = dateValue(order.sla_due_at);
  const status = order.sla_status;
  if (status === 'breached') {
    return {
      status: 'breached',
      due_at: order.sla_due_at,
      breached_minutes: Number(order.sla_breach_minutes || minutesBetween(due, now) || 0),
    };
  }
  if (due && due < now && statusIsOpen(order.status)) {
    return {
      status: 'breached',
      due_at: due,
      breached_minutes: minutesBetween(due, now),
    };
  }
  if (due && statusIsOpen(order.status)) {
    const remaining = Math.max(Math.floor((due.getTime() - now.getTime()) / 60000), 0);
    return {
      status: remaining <= 30 ? 'warning' : 'normal',
      due_at: due,
      remaining_minutes: remaining,
    };
  }
  return {
    status: status || (statusIsOpen(order.status) && fallbackStart ? 'tracking' : 'none'),
    due_at: order.sla_due_at || null,
  };
}

function sortDescByTime(items, key = 'occurred_at') {
  return [...items].sort((a, b) => {
    const left = dateValue(a[key])?.getTime() || 0;
    const right = dateValue(b[key])?.getTime() || 0;
    return right - left;
  });
}

function groupBy(items, keyFn) {
  const map = new Map();
  (items || []).forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

function firstBy(items, keyFn) {
  const map = new Map();
  sortDescByTime(items || [], 'created_at').forEach((item) => {
    const key = keyFn(item);
    if (key && !map.has(key)) map.set(key, item);
  });
  return map;
}

function sourceOrder(childOrder) {
  return childOrder?.order_id && typeof childOrder.order_id === 'object' ? childOrder.order_id : {};
}

function attachmentBelongsTo(attachment, entityType, entityId, orderId) {
  const attachmentEntity = String(attachment.entity_type || '').toLowerCase();
  return (
    (entityType && entityId && attachmentEntity === entityType && toId(attachment.entity_id) === entityId) ||
    (orderId && toId(attachment.order_id) === orderId)
  );
}

function countAttachments(attachments, entityType, entityId, orderId) {
  return (attachments || []).filter((attachment) => attachmentBelongsTo(attachment, entityType, entityId, orderId));
}

function makeAllowedActions({ module, result, report, procedureResult, order, hasCritical }) {
  const released = result?.released_to_patient || report?.released_to_patient || procedureResult?.released_to_patient;
  return {
    view_detail: true,
    open_order: Boolean(order?.order_id || order?._id),
    open_timeline: true,
    acknowledge_critical: Boolean(hasCritical && !(result?.critical_acknowledged_at || report?.critical_acknowledged_at || procedureResult?.critical_acknowledged_at)),
    release_to_patient: Boolean((result || report || procedureResult) && !released),
    amend: module === 'lab' || module === 'imaging' || module === 'procedure',
    create_charge: module === 'procedure',
    download_file: true,
  };
}

function makeLabMatrix({ labOrders, specimensByLabOrder, resultByLabOrder, itemsByResult, attachments }) {
  return labOrders.map((labOrder) => {
    const parentOrder = sourceOrder(labOrder);
    const result = resultByLabOrder.get(toId(labOrder._id));
    const resultItems = result ? itemsByResult.get(toId(result._id)) || [] : [];
    const criticalItems = resultItems.filter((item) => item.is_critical || String(item.abnormal_flag || '').includes('critical'));
    const specimens = specimensByLabOrder.get(toId(labOrder._id)) || [];
    const files = countAttachments(attachments, 'lab_result', toId(result?._id), toId(parentOrder._id || labOrder.order_id));
    const hasCritical = Boolean(result?.is_critical || criticalItems.length);
    const released = Boolean(result?.released_to_patient);
    const final = isFinalStatus(result?.status);
    return {
      id: `lab:${toId(labOrder._id)}`,
      type: 'lab',
      patient_id: toId(labOrder.patient_id),
      encounter_id: toId(labOrder.encounter_id),
      order_id: toId(parentOrder._id || labOrder.order_id),
      child_order_id: toId(labOrder._id),
      result_id: toId(result?._id),
      display_name: labOrder.test_name,
      code: labOrder.test_code || labOrder.lab_order_no,
      specimen_type: labOrder.specimen_type,
      priority: labOrder.priority || parentOrder.priority,
      order_no: parentOrder.order_no || labOrder.lab_order_no,
      result_no: result?.result_no,
      order_status: labOrder.status || parentOrder.status,
      result_status: result?.status,
      ordered_at: labOrder.ordered_at || parentOrder.ordered_at,
      completed_at: labOrder.completed_at,
      reported_at: result?.reported_at || result?.verified_at,
      is_critical: hasCritical,
      critical_acknowledged_at: result?.critical_acknowledged_at,
      released_to_patient: released,
      released_at: result?.released_at,
      abnormal_count: resultItems.filter((item) => item.abnormal_flag && item.abnormal_flag !== 'normal').length,
      critical_items: criticalItems.slice(0, 6).map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        result_value: item.result_value,
        unit: item.unit,
        reference_range: item.reference_range,
        abnormal_flag: item.abnormal_flag,
      })),
      specimen_count: specimens.length,
      rejected_specimen_count: specimens.filter((item) => item.rejected_at || item.status === 'rejected').length,
      file_count: files.length,
      has_file_gap: Boolean(final && files.length === 0),
      sla: computeSla(parentOrder, labOrder.ordered_at),
      order: normalizeOrder(parentOrder),
      allowed_actions: makeAllowedActions({ module: 'lab', result, order: parentOrder, hasCritical }),
      raw_status: {
        lab_order: labOrder.status,
        result: result?.status,
      },
    };
  });
}

function makeImagingMatrix({ imagingOrders, reportByImagingOrder, attachments }) {
  return imagingOrders.map((imagingOrder) => {
    const parentOrder = sourceOrder(imagingOrder);
    const report = reportByImagingOrder.get(toId(imagingOrder._id));
    const files = countAttachments(attachments, 'imaging_order', toId(imagingOrder._id), toId(parentOrder._id || imagingOrder.order_id));
    const final = isFinalStatus(report?.status);
    return {
      id: `imaging:${toId(imagingOrder._id)}`,
      type: 'imaging',
      patient_id: toId(imagingOrder.patient_id),
      encounter_id: toId(imagingOrder.encounter_id),
      order_id: toId(parentOrder._id || imagingOrder.order_id),
      child_order_id: toId(imagingOrder._id),
      result_id: toId(report?._id),
      display_name: [imagingOrder.modality, imagingOrder.body_part].filter(Boolean).join(' - ') || 'Chẩn đoán hình ảnh',
      code: imagingOrder.imaging_order_no || imagingOrder.modality,
      priority: imagingOrder.priority || parentOrder.priority,
      order_no: parentOrder.order_no || imagingOrder.imaging_order_no,
      result_no: report?.report_no,
      order_status: imagingOrder.status || parentOrder.status,
      result_status: report?.status,
      ordered_at: imagingOrder.ordered_at || parentOrder.ordered_at,
      scheduled_at: imagingOrder.scheduled_at || imagingOrder.scheduled_start,
      completed_at: imagingOrder.completed_at,
      reported_at: report?.reported_at || report?.verified_at,
      is_critical: Boolean(report?.is_critical),
      critical_summary: report?.critical_finding || report?.critical_note,
      critical_acknowledged_at: report?.critical_acknowledged_at,
      released_to_patient: Boolean(report?.released_to_patient),
      released_at: report?.released_at,
      pacs_url: report?.pacs_url,
      file_count: files.length,
      has_file_gap: Boolean((imagingOrder.completed_at || final) && files.length === 0),
      sla: computeSla(parentOrder, imagingOrder.ordered_at || imagingOrder.scheduled_at),
      order: normalizeOrder(parentOrder),
      allowed_actions: makeAllowedActions({ module: 'imaging', report, order: parentOrder, hasCritical: report?.is_critical }),
      raw_status: {
        imaging_order: imagingOrder.status,
        report: report?.status,
      },
    };
  });
}

function makeProcedureMatrix({ procedureOrders, resultByProcedureOrder, attachments, chargesByProcedureOrder }) {
  return procedureOrders.map((procedureOrder) => {
    const parentOrder = sourceOrder(procedureOrder);
    const procedureResult = resultByProcedureOrder.get(toId(procedureOrder._id));
    const files = countAttachments(attachments, 'procedure_order', toId(procedureOrder._id), toId(parentOrder._id || procedureOrder.order_id));
    const charges = chargesByProcedureOrder.get(toId(procedureOrder._id)) || [];
    const completed = Boolean(procedureOrder.completed_at || procedureOrder.status === 'completed');
    return {
      id: `procedure:${toId(procedureOrder._id)}`,
      type: 'procedure',
      patient_id: toId(procedureOrder.patient_id),
      encounter_id: toId(procedureOrder.encounter_id),
      order_id: toId(parentOrder._id || procedureOrder.order_id),
      child_order_id: toId(procedureOrder._id),
      result_id: toId(procedureResult?._id),
      display_name: procedureOrder.procedure_name || 'Thủ thuật',
      code: procedureOrder.procedure_code,
      priority: procedureOrder.priority || parentOrder.priority,
      order_no: parentOrder.order_no || procedureOrder.procedure_order_no,
      result_no: procedureResult?.result_no,
      order_status: procedureOrder.status || parentOrder.status,
      result_status: procedureResult?.status || (procedureOrder.result_note ? 'completed_note' : null),
      ordered_at: procedureOrder.ordered_at || parentOrder.ordered_at,
      scheduled_at: procedureOrder.scheduled_at || procedureOrder.scheduled_start,
      performed_at: procedureOrder.performed_start,
      completed_at: procedureOrder.completed_at,
      reported_at: procedureResult?.reported_at || procedureResult?.signed_at,
      is_critical: Boolean(procedureResult?.is_critical),
      critical_summary: procedureResult?.critical_note,
      critical_acknowledged_at: procedureResult?.critical_acknowledged_at,
      released_to_patient: Boolean(procedureResult?.released_to_patient),
      released_at: procedureResult?.released_to_patient_at,
      performer: compactUser(procedureOrder.performer_id),
      file_count: files.length,
      charge_count: charges.length,
      has_file_gap: Boolean(completed && files.length === 0),
      has_charge_gap: Boolean(completed && charges.length === 0),
      sla: computeSla(parentOrder, procedureOrder.scheduled_start || procedureOrder.ordered_at),
      order: normalizeOrder(parentOrder),
      allowed_actions: makeAllowedActions({ module: 'procedure', procedureResult, order: parentOrder, hasCritical: procedureResult?.is_critical }),
      raw_status: {
        procedure_order: procedureOrder.status,
        result: procedureResult?.status,
      },
    };
  });
}

function makeCriticalAlerts({ labMatrix, imagingMatrix, procedureMatrix }) {
  return [...labMatrix, ...imagingMatrix, ...procedureMatrix]
    .filter((item) => item.is_critical && !item.critical_acknowledged_at)
    .map((item) => ({
      id: `${item.type}:${item.result_id || item.child_order_id}:critical`,
      type: item.type,
      source_id: item.result_id || item.child_order_id,
      title: `${item.display_name} nguy cấp`,
      message: item.critical_summary || item.critical_items?.map((critical) => `${critical.item_name}: ${critical.result_value}`).join('; ') || 'Critical chưa ACK.',
      priority: item.priority,
      ordered_at: item.ordered_at,
      reported_at: item.reported_at,
      acknowledged_at: item.critical_acknowledged_at,
      order_no: item.order_no,
      result_no: item.result_no,
      allowed_actions: item.allowed_actions,
    }));
}

function makeFileGaps({ matrix, attachments, missingTasks }) {
  const computed = matrix
    .filter((item) => item.has_file_gap || item.has_charge_gap)
    .map((item) => ({
      id: `${item.id}:gap`,
      type: item.has_charge_gap ? 'missing_charge' : 'missing_file',
      module: item.type,
      source_id: item.child_order_id,
      order_id: item.order_id,
      title: item.has_charge_gap ? `Thiếu charge thủ thuật: ${item.display_name}` : `Thiếu file kết quả: ${item.display_name}`,
      status: 'open',
      due_at: item.completed_at || item.reported_at,
      severity: item.has_charge_gap ? 'warning' : 'high',
      item,
    }));

  const taskGaps = (missingTasks || [])
    .filter((task) => OPEN_MISSING_TASK_STATUSES.has(String(task.status || 'open')))
    .map((task) => ({
      id: `missing-task:${toId(task._id)}`,
      type: 'missing_document_task',
      module: task.module || task.entity_type || 'records',
      source_id: toId(task.entity_id),
      order_id: toId(task.order_id),
      title: task.title || task.required_document_label || 'Thiếu tài liệu bắt buộc',
      status: task.status,
      due_at: task.due_at,
      severity: task.priority === 'stat' ? 'critical' : 'high',
      required_category: task.required_category || task.category,
    }));

  const badFiles = (attachments || [])
    .filter((attachment) => BAD_SCAN_STATUSES.has(String(attachment.scan_status)) || BAD_REVIEW_STATUSES.has(String(attachment.review_status)))
    .map((attachment) => ({
      id: `attachment:${toId(attachment._id)}:quality`,
      type: 'file_quality',
      module: attachment.entity_type || 'records',
      source_id: toId(attachment.entity_id),
      order_id: toId(attachment.order_id),
      title: attachment.original_name || attachment.file_name || 'File cần xử lý',
      status: attachment.scan_status || attachment.review_status,
      severity: attachment.scan_status === 'infected' ? 'critical' : 'high',
      scan_status: attachment.scan_status,
      review_status: attachment.review_status,
      category: attachment.category,
    }));

  return [...taskGaps, ...computed, ...badFiles];
}

function makePendingActions({ matrix, fileGaps, criticalAlerts, correctionRequests = [] }) {
  const actions = [];

  criticalAlerts.forEach((alert) => actions.push({
    id: `${alert.id}:ack`,
    type: 'acknowledge_critical',
    severity: 'critical',
    title: 'ACK critical result',
    message: alert.message,
    due_at: alert.reported_at,
    source: alert,
  }));

  fileGaps.slice(0, 50).forEach((gap) => actions.push({
    id: `${gap.id}:resolve`,
    type: gap.type,
    severity: gap.severity,
    title: gap.title,
    message: gap.status,
    due_at: gap.due_at,
    source: gap,
  }));

  matrix
    .filter((item) => (item.result_id && !item.released_to_patient && isFinalStatus(item.result_status)))
    .forEach((item) => actions.push({
      id: `${item.id}:release`,
      type: 'release_to_patient',
      severity: 'warning',
      title: `Chưa release cho BN: ${item.display_name}`,
      message: item.result_no || item.order_no,
      due_at: item.reported_at,
      source: item,
    }));

  correctionRequests
    .filter((item) => !['resolved', 'cancelled', 'rejected'].includes(String(item.status)))
    .forEach((item) => actions.push({
      id: `correction:${toId(item._id)}`,
      type: 'correction_request',
      severity: item.severity || 'high',
      title: item.reason_text || item.reason_code || 'Kết quả cần sửa',
      message: item.status,
      due_at: item.due_at || item.created_at,
      source_id: toId(item._id),
    }));

  return sortDescByTime(actions, 'due_at').slice(0, 80);
}

function makeTimeline({ encounters, orders, specimens, labResults, imagingOrders, imagingReports, procedureOrders, procedureResults, attachments }) {
  const events = [];
  encounters.forEach((encounter) => {
    events.push({
      id: `encounter:${toId(encounter._id)}`,
      module: 'encounter',
      type: 'encounter',
      title: `Lượt khám ${encounter.encounter_code}`,
      subtitle: encounter.chief_reason || encounter.status,
      occurred_at: encounter.start_time,
      status: encounter.status,
    });
  });
  orders.forEach((order) => {
    events.push({
      id: `order:${toId(order._id)}`,
      module: 'order',
      type: 'order_created',
      title: `${order.order_no} - ${order.order_type}`,
      subtitle: order.clinical_indication || order.status,
      occurred_at: order.ordered_at,
      status: order.status,
      priority: order.priority,
    });
    if (order.acknowledged_at) {
      events.push({
        id: `order:${toId(order._id)}:ack`,
        module: 'order',
        type: 'order_acknowledged',
        title: `${order.order_no} đã tiếp nhận`,
        subtitle: order.status,
        occurred_at: order.acknowledged_at,
      });
    }
  });
  specimens.forEach((specimen) => {
    [
      ['collected_at', 'Lấy mẫu', specimen.collected_at],
      ['received_at', 'Nhận mẫu', specimen.received_at],
      ['rejected_at', 'Từ chối mẫu', specimen.rejected_at],
      ['disposed_at', 'Hủy mẫu', specimen.disposed_at],
    ].forEach(([key, title, time]) => {
      if (!time) return;
      events.push({
        id: `specimen:${toId(specimen._id)}:${key}`,
        module: 'lab',
        type: key,
        title: `${title} ${specimen.specimen_no || ''}`.trim(),
        subtitle: specimen.rejection_reason || specimen.reject_reason || specimen.status,
        occurred_at: time,
        status: specimen.status,
      });
    });
  });
  labResults.forEach((result) => {
    events.push({
      id: `lab-result:${toId(result._id)}`,
      module: 'lab',
      type: 'lab_result',
      title: `${result.result_no || 'Lab result'} ${result.is_critical ? '- Critical' : ''}`.trim(),
      subtitle: result.status,
      occurred_at: result.reported_at || result.verified_at || result.created_at,
      status: result.status,
      severity: result.is_critical ? 'critical' : undefined,
    });
  });
  imagingOrders.forEach((order) => {
    [
      ['scheduled_at', 'Xếp lịch CĐHA', order.scheduled_at || order.scheduled_start],
      ['started_at', 'Bắt đầu CĐHA', order.started_at],
      ['completed_at', 'Hoàn tất kỹ thuật CĐHA', order.completed_at],
      ['no_show_at', 'No-show CĐHA', order.no_show_at],
      ['cancelled_at', 'Hủy CĐHA', order.cancelled_at],
    ].forEach(([key, title, time]) => {
      if (!time) return;
      events.push({
        id: `imaging-order:${toId(order._id)}:${key}`,
        module: 'imaging',
        type: key,
        title,
        subtitle: [order.modality, order.body_part, order.status].filter(Boolean).join(' · '),
        occurred_at: time,
        status: order.status,
      });
    });
  });
  imagingReports.forEach((report) => {
    events.push({
      id: `imaging-report:${toId(report._id)}`,
      module: 'imaging',
      type: 'imaging_report',
      title: `${report.report_no || 'Báo cáo CĐHA'} ${report.is_critical ? '- Critical' : ''}`.trim(),
      subtitle: report.critical_finding || report.impression || report.status,
      occurred_at: report.reported_at || report.verified_at || report.created_at,
      status: report.status,
      severity: report.is_critical ? 'critical' : undefined,
    });
  });
  procedureOrders.forEach((order) => {
    [
      ['scheduled_at', 'Xếp lịch thủ thuật', order.scheduled_at || order.scheduled_start],
      ['performed_start', 'Bắt đầu thủ thuật', order.performed_start],
      ['completed_at', 'Hoàn tất thủ thuật', order.completed_at],
      ['no_show_at', 'No-show thủ thuật', order.no_show_at],
      ['cancelled_at', 'Hủy thủ thuật', order.cancelled_at],
    ].forEach(([key, title, time]) => {
      if (!time) return;
      events.push({
        id: `procedure-order:${toId(order._id)}:${key}`,
        module: 'procedure',
        type: key,
        title,
        subtitle: [order.procedure_name, order.status].filter(Boolean).join(' · '),
        occurred_at: time,
        status: order.status,
      });
    });
  });
  procedureResults.forEach((result) => {
    events.push({
      id: `procedure-result:${toId(result._id)}`,
      module: 'procedure',
      type: 'procedure_result',
      title: `${result.result_no || 'Kết quả thủ thuật'} ${result.is_critical ? '- Critical' : ''}`.trim(),
      subtitle: result.conclusion || result.status,
      occurred_at: result.reported_at || result.signed_at || result.created_at,
      status: result.status,
      severity: result.is_critical ? 'critical' : undefined,
    });
  });
  attachments.forEach((attachment) => {
    events.push({
      id: `attachment:${toId(attachment._id)}`,
      module: 'records',
      type: 'attachment',
      title: attachment.original_name || attachment.file_name || 'Tệp kết quả',
      subtitle: [attachment.category, attachment.scan_status, attachment.review_status].filter(Boolean).join(' · '),
      occurred_at: attachment.created_at,
      status: attachment.status,
    });
  });
  return sortDescByTime(events).slice(0, 160);
}

function makeCounters({ orders, labMatrix, imagingMatrix, procedureMatrix, fileGaps, attachments, criticalAlerts }) {
  const matrix = [...labMatrix, ...imagingMatrix, ...procedureMatrix];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return {
    total_orders: orders.length,
    lab_orders: labMatrix.length,
    imaging_orders: imagingMatrix.length,
    procedure_orders: procedureMatrix.length,
    pending_orders: orders.filter((order) => statusIsOpen(order.status)).length,
    completed_orders: orders.filter((order) => order.status === 'completed').length,
    critical_unacknowledged: criticalAlerts.length,
    results_pending_release: matrix.filter((item) => item.result_id && !item.released_to_patient && isFinalStatus(item.result_status)).length,
    files_missing: fileGaps.filter((gap) => gap.type === 'missing_file' || gap.type === 'missing_document_task').length,
    files_scan_failed: attachments.filter((item) => BAD_SCAN_STATUSES.has(String(item.scan_status))).length,
    file_review_pending: attachments.filter((item) => item.review_status === 'pending').length,
    procedure_charges_missing: procedureMatrix.filter((item) => item.has_charge_gap).length,
    new_results: matrix.filter((item) => dateValue(item.reported_at) && dateValue(item.reported_at) >= oneDayAgo).length,
    waiting_signature: [...imagingMatrix, ...procedureMatrix].filter((item) => item.result_id && !['signed', 'final', 'amended', 'released'].includes(String(item.result_status))).length,
    no_show: [...imagingMatrix, ...procedureMatrix].filter((item) => item.order_status === 'no_show').length,
    sla_breached: matrix.filter((item) => item.sla?.status === 'breached').length,
  };
}

async function assertPatientAccess(patientId, actor) {
  if (!mongoose.Types.ObjectId.isValid(String(patientId))) {
    throw createError(422, 'patientId không hợp lệ.');
  }
  return patientService.getPatientDetail(patientId, actor);
}

async function resolveEncounterPatient(encounterId, actor) {
  if (!mongoose.Types.ObjectId.isValid(String(encounterId))) {
    throw createError(422, 'encounterId không hợp lệ.');
  }
  const encounter = await Encounter.findById(encounterId).populate(POPULATE_ENCOUNTER).lean();
  if (!encounter) throw createError(404, 'Không tìm thấy lượt khám.');
  const patientDetail = await assertPatientAccess(encounter.patient_id, actor);
  return { encounter, patientDetail };
}

function buildDateFilter(query = {}) {
  const filter = {};
  const from = dateValue(query.date_from || query.from);
  const to = dateValue(query.date_to || query.to);
  if (from || to) {
    filter.$gte = from || undefined;
    filter.$lte = to || undefined;
    Object.keys(filter).forEach((key) => filter[key] === undefined && delete filter[key]);
  }
  return Object.keys(filter).length ? filter : null;
}

async function loadInvestigationBundle({ patientId, encounterId, actor, query = {} }) {
  const patientDetail = patientId ? await assertPatientAccess(patientId, actor) : null;
  const patientFilterId = patientId || patientDetail?.patient?.patient_id;
  const baseFilter = patientFilterId ? { patient_id: patientFilterId } : {};
  if (encounterId) baseFilter.encounter_id = encounterId;
  const dateFilter = buildDateFilter(query);
  const orderFilter = { ...baseFilter };
  if (dateFilter) orderFilter.ordered_at = dateFilter;

  const limit = Math.min(Math.max(Number(query.limit || 200), 20), 500);
  const [
    encounters,
    orders,
    labOrders,
    specimens,
    labResults,
    imagingOrders,
    imagingReports,
    procedureOrders,
    procedureResults,
    attachments,
    missingTasks,
    charges,
  ] = await Promise.all([
    Encounter.find(baseFilter).populate(POPULATE_ENCOUNTER).sort({ start_time: -1 }).limit(limit).lean(),
    Order.find(orderFilter).populate(POPULATE_ORDER).sort({ ordered_at: -1 }).limit(limit).lean(),
    LabOrder.find(orderFilter).populate(POPULATE_LAB).sort({ ordered_at: -1 }).limit(limit).lean(),
    Specimen.find(baseFilter).sort({ collected_at: -1, created_at: -1 }).limit(limit).lean(),
    LabResult.find(baseFilter)
      .populate([
        { path: 'performed_by', select: USER_SELECT },
        { path: 'verified_by', select: USER_SELECT },
        { path: 'released_by', select: USER_SELECT },
      ])
      .sort({ reported_at: -1, verified_at: -1, created_at: -1 })
      .limit(limit)
      .lean(),
    ImagingOrder.find(orderFilter).populate(POPULATE_IMAGING).sort({ ordered_at: -1, scheduled_at: -1 }).limit(limit).lean(),
    ImagingReport.find(baseFilter)
      .populate([
        { path: 'verified_by', select: USER_SELECT },
        { path: 'released_by', select: USER_SELECT },
      ])
      .sort({ reported_at: -1, verified_at: -1, created_at: -1 })
      .limit(limit)
      .lean(),
    ProcedureOrder.find(orderFilter).populate(POPULATE_PROCEDURE).sort({ ordered_at: -1, scheduled_at: -1 }).limit(limit).lean(),
    ProcedureResult.find(baseFilter)
      .populate([
        { path: 'performer_id', select: USER_SELECT },
        { path: 'signed_by', select: USER_SELECT },
        { path: 'released_to_patient_by', select: USER_SELECT },
      ])
      .sort({ reported_at: -1, signed_at: -1, created_at: -1 })
      .limit(limit)
      .lean(),
    Attachment.find({ ...baseFilter, is_deleted: false })
      .populate([
        { path: 'released_by', select: USER_SELECT },
        { path: 'reviewed_by', select: USER_SELECT },
      ])
      .sort({ created_at: -1 })
      .limit(limit)
      .lean(),
    MissingDocumentTask.find(baseFilter).sort({ due_at: 1, created_at: -1 }).limit(limit).lean(),
    Charge.find(baseFilter).sort({ charged_at: -1, created_at: -1 }).limit(limit).lean(),
  ]);

  const labResultIds = labResults.map((item) => item._id);
  const labItems = labResultIds.length
    ? await LabResultItem.find({ lab_result_id: { $in: labResultIds } }).sort({ display_order: 1, item_name: 1 }).lean()
    : [];

  const specimensByLabOrder = groupBy(specimens, (item) => toId(item.lab_order_id));
  const resultByLabOrder = firstBy(labResults, (item) => toId(item.lab_order_id));
  const itemsByResult = groupBy(labItems, (item) => toId(item.lab_result_id));
  const reportByImagingOrder = firstBy(imagingReports, (item) => toId(item.imaging_order_id));
  const resultByProcedureOrder = firstBy(procedureResults, (item) => toId(item.procedure_order_id));
  const chargesByProcedureOrder = groupBy(charges, (item) => toId(item.source_id) || toId(item.order_id));

  const labMatrix = makeLabMatrix({ labOrders, specimensByLabOrder, resultByLabOrder, itemsByResult, attachments });
  const imagingMatrix = makeImagingMatrix({ imagingOrders, reportByImagingOrder, attachments });
  const procedureMatrix = makeProcedureMatrix({ procedureOrders, resultByProcedureOrder, attachments, chargesByProcedureOrder });
  const matrix = sortDescByTime([...labMatrix, ...imagingMatrix, ...procedureMatrix], 'ordered_at');
  const criticalAlerts = makeCriticalAlerts({ labMatrix, imagingMatrix, procedureMatrix });
  const fileGaps = makeFileGaps({ matrix, attachments, missingTasks });
  const correctionRequests = [];
  const pendingActions = makePendingActions({ matrix, fileGaps, criticalAlerts, correctionRequests });
  const timeline = makeTimeline({
    encounters,
    orders,
    specimens,
    labResults,
    imagingOrders,
    imagingReports,
    procedureOrders,
    procedureResults,
    attachments,
  });
  const counters = makeCounters({ orders, labMatrix, imagingMatrix, procedureMatrix, fileGaps, attachments, criticalAlerts });

  return {
    patientDetail,
    patient: patientDetail?.patient || null,
    encounters: encounters.map(normalizeEncounter),
    active_encounter: encounters.find((item) => ['arrived', 'in_progress', 'on_hold', 'planned'].includes(String(item.status))) || encounters[0] || null,
    counters,
    matrix,
    latest_lab_results: labMatrix.filter((item) => item.result_id).slice(0, 12),
    latest_imaging_reports: imagingMatrix.filter((item) => item.result_id).slice(0, 12),
    latest_procedures: procedureMatrix.slice(0, 12),
    critical_alerts: criticalAlerts,
    pending_actions: pendingActions,
    file_gaps: fileGaps,
    sla_breaches: matrix.filter((item) => item.sla?.status === 'breached'),
    timeline,
    attachments: attachments.map((item) => ({
      id: toId(item._id),
      attachment_id: toId(item._id),
      entity_type: item.entity_type,
      entity_id: toId(item.entity_id),
      order_id: toId(item.order_id),
      file_name: item.file_name,
      original_name: item.original_name,
      category: item.category,
      mime_type: item.mime_type,
      file_size: item.file_size,
      scan_status: item.scan_status,
      review_status: item.review_status,
      released_to_patient: item.released_to_patient,
      status: item.status,
      created_at: item.created_at,
    })),
    raw_counts: {
      orders: orders.length,
      lab_orders: labOrders.length,
      lab_results: labResults.length,
      imaging_orders: imagingOrders.length,
      imaging_reports: imagingReports.length,
      procedure_orders: procedureOrders.length,
      procedure_results: procedureResults.length,
      attachments: attachments.length,
    },
  };
}

function responseFromBundle(bundle, mode = 'overview') {
  const payload = {
    patient: bundle.patient ? normalizePatient(bundle.patient) : null,
    active_encounter: bundle.active_encounter ? normalizeEncounter(bundle.active_encounter) : null,
    encounters: bundle.encounters,
    counters: bundle.counters,
  };

  if (mode === 'snapshot') return payload;
  if (mode === 'result-matrix') return { items: bundle.matrix, counters: bundle.counters };
  if (mode === 'timeline') return { items: bundle.timeline };
  if (mode === 'pending-actions') return { items: bundle.pending_actions, counters: bundle.counters };
  if (mode === 'critical-alerts') return { items: bundle.critical_alerts, counters: bundle.counters };
  if (mode === 'file-gaps') return { items: bundle.file_gaps, counters: bundle.counters };
  if (mode === 'sla-breaches') return { items: bundle.sla_breaches, counters: bundle.counters };

  return {
    ...payload,
    latest_lab_results: bundle.latest_lab_results,
    latest_imaging_reports: bundle.latest_imaging_reports,
    latest_procedures: bundle.latest_procedures,
    critical_alerts: bundle.critical_alerts,
    pending_actions: bundle.pending_actions,
    file_gaps: bundle.file_gaps,
    sla_breaches: bundle.sla_breaches,
    result_matrix: bundle.matrix,
    timeline: bundle.timeline,
    attachments: bundle.attachments,
    raw_counts: bundle.raw_counts,
    patient_context: {
      identifiers: bundle.patientDetail?.identifiers || [],
      account: bundle.patientDetail?.account || null,
      relatives: bundle.patientDetail?.relatives || [],
      summary: bundle.patientDetail?.summary || {},
    },
  };
}

async function getPatientOverview(patientId, query = {}, actor = {}) {
  const bundle = await loadInvestigationBundle({ patientId, query, actor });
  return responseFromBundle(bundle, 'overview');
}

async function getPatientSnapshot(patientId, query = {}, actor = {}) {
  const bundle = await loadInvestigationBundle({ patientId, query, actor });
  return responseFromBundle(bundle, 'snapshot');
}

async function getPatientResultMatrix(patientId, query = {}, actor = {}) {
  const bundle = await loadInvestigationBundle({ patientId, query, actor });
  return responseFromBundle(bundle, 'result-matrix');
}

async function getPatientTimeline(patientId, query = {}, actor = {}) {
  const bundle = await loadInvestigationBundle({ patientId, query, actor });
  return responseFromBundle(bundle, 'timeline');
}

async function getPatientPendingActions(patientId, query = {}, actor = {}) {
  const bundle = await loadInvestigationBundle({ patientId, query, actor });
  return responseFromBundle(bundle, 'pending-actions');
}

async function getPatientCriticalAlerts(patientId, query = {}, actor = {}) {
  const bundle = await loadInvestigationBundle({ patientId, query, actor });
  return responseFromBundle(bundle, 'critical-alerts');
}

async function getPatientFileGaps(patientId, query = {}, actor = {}) {
  const bundle = await loadInvestigationBundle({ patientId, query, actor });
  return responseFromBundle(bundle, 'file-gaps');
}

async function getPatientSlaBreaches(patientId, query = {}, actor = {}) {
  const bundle = await loadInvestigationBundle({ patientId, query, actor });
  return responseFromBundle(bundle, 'sla-breaches');
}

async function getEncounterOverview(encounterId, query = {}, actor = {}) {
  const { encounter, patientDetail } = await resolveEncounterPatient(encounterId, actor);
  const bundle = await loadInvestigationBundle({ patientId: encounter.patient_id, encounterId, query, actor });
  bundle.patientDetail = patientDetail;
  bundle.patient = patientDetail.patient;
  bundle.active_encounter = encounter;
  return responseFromBundle(bundle, 'overview');
}

async function getEncounterResultMatrix(encounterId, query = {}, actor = {}) {
  const { encounter } = await resolveEncounterPatient(encounterId, actor);
  const bundle = await loadInvestigationBundle({ patientId: encounter.patient_id, encounterId, query, actor });
  return responseFromBundle(bundle, 'result-matrix');
}

async function getEncounterTimeline(encounterId, query = {}, actor = {}) {
  const { encounter } = await resolveEncounterPatient(encounterId, actor);
  const bundle = await loadInvestigationBundle({ patientId: encounter.patient_id, encounterId, query, actor });
  return responseFromBundle(bundle, 'timeline');
}

async function getEncounterPendingActions(encounterId, query = {}, actor = {}) {
  const { encounter } = await resolveEncounterPatient(encounterId, actor);
  const bundle = await loadInvestigationBundle({ patientId: encounter.patient_id, encounterId, query, actor });
  return responseFromBundle(bundle, 'pending-actions');
}

module.exports = {
  getPatientOverview,
  getPatientSnapshot,
  getPatientResultMatrix,
  getPatientTimeline,
  getPatientPendingActions,
  getPatientCriticalAlerts,
  getPatientFileGaps,
  getPatientSlaBreaches,
  getEncounterOverview,
  getEncounterResultMatrix,
  getEncounterTimeline,
  getEncounterPendingActions,
};
