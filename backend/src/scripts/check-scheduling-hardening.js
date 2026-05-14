const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

function assertIncludes(relativePath, expected, message) {
  if (!read(relativePath).includes(expected)) {
    throw new Error(`${message} (${relativePath})`);
  }
}

function main() {
  assertIncludes('src/services/appointment.service.js', 'requireUnassignedSlot: true', 'Appointment booking must reserve the slot before inserting the appointment.');
  assertIncludes('src/services/appointment.service.js', 'new Types.ObjectId()', 'Appointment booking must preallocate the id used to reserve the slot atomically.');
  assertIncludes('src/services/appointment.service.js', 'patient_id: actor.patientId', 'Patient portal booking must force patient_id from auth context.');
  assertIncludes('src/services/appointment.service.js', 'assertAppointmentWritable(appointment, actor, \'update\')', 'Appointment update must enforce writable scope.');
  assertIncludes('src/services/appointment.service.js', 'assertAppointmentWritable(appointment, actor, \'checkin\')', 'Appointment check-in must enforce writable scope.');
  assertIncludes('src/services/appointment.service.js', 'QueueTicket.findOne({\n    appointment_id: appointment._id,\n    status: { $in: ACTIVE_QUEUE_STATUSES }', 'Appointment check-in must be idempotent on active queue tickets.');
  assertIncludes('src/services/appointment.service.js', 'Không thể hoàn tất appointment khi chưa có encounter hợp lệ.', 'Appointment complete must require a linked encounter.');
  assertIncludes('src/services/appointment.service.js', 'Encounter chưa hoàn tất hoặc chưa có consultation đã ký.', 'Appointment complete must require completed encounter or signed consultation.');
  assertIncludes('src/services/appointment.service.js', 'success_count', 'Bulk appointment actions must return item-level partial results.');
  assertIncludes('src/services/appointment.service.js', 'Quyền hiện tại không được tìm kiếm lịch hẹn theo national_id.', 'Appointment search must gate national_id probing.');
  assertIncludes('src/services/appointment.service.js', 'audit_log_id: String(item._id)', 'Appointment timeline must map AuditLog through a safe DTO.');

  assertIncludes('src/services/schedule.service.js', 'assertScheduleWritable(schedule, actor)', 'Schedule mutations must enforce writable scope.');
  assertIncludes('src/services/schedule.service.js', 'conflict_strategy !== \'update_existing\'', 'POST create schedule must not silently overwrite exact duplicates.');
  assertIncludes('src/services/schedule.service.js', 'ordered: false', 'Generate slots must be idempotent under duplicate-key races.');
  assertIncludes('src/services/schedule.service.js', 'Slot đang có appointment active nên không thể mở lại bằng endpoint thường.', 'Reopen slot with active appointment must return conflict.');
  assertIncludes('src/services/schedule.service.js', 'Khoảng ngày không được vượt quá', 'Schedule date ranges must be bounded.');
  assertIncludes('src/services/schedule.service.js', 'canSeePatientData ? String(appointment.patient_id) : undefined', 'Booked slots with slot-read only must redact patient data.');
  assertIncludes('src/services/schedule.service.js', 'publicView ? undefined : appointmentsCount', 'Public available slots must not expose appointments_count.');
  assertIncludes('src/services/schedule.service.js', 'block_reason: canSeeOperationalSlotData', 'Public available slots must not expose block reasons.');

  assertIncludes('src/models/scheduling/appointment.model.js', 'unique: true', 'Appointment model must include unique constraints for active booking conflicts.');
  assertIncludes('src/models/scheduling/queue-ticket.model.js', 'ACTIVE_QUEUE_STATUSES', 'Queue ticket model must enforce one active ticket per appointment.');
  assertIncludes('src/models/scheduling/schedule-slot.model.js', '{ doctor_schedule_id: 1, start_time: 1 }', 'Schedule slots must have a unique schedule/time key.');

  console.log('Scheduling hardening checks passed.');
}

main();
