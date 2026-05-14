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
  assertIncludes('src/models/scheduling/queue-ticket.model.js', 'status: { $in: ACTIVE_QUEUE_STATUSES }', 'Queue tickets must allow only one active ticket per appointment.');
  assertIncludes('src/services/queue.service.js', 'function assertQueueWritable', 'Queue mutations must enforce writable scope.');
  assertIncludes('src/services/queue.service.js', 'Bác sĩ chỉ được thao tác queue của chính mình.', 'Doctor queue writes must be own-scope only.');
  assertIncludes('src/services/queue.service.js', '{ _id: ticket._id, status: QUEUE_STATUS.WAITING }', 'Call-next must atomically claim a waiting ticket.');
  assertIncludes('src/services/queue.service.js', 'status: QUEUE_STATUS.WAITING', 'Call-next must only select waiting tickets.');
  assertIncludes('src/services/queue.service.js', 'Chỉ queue ticket đã called/recalled mới được bắt đầu phục vụ.', 'Start service must require called/recalled status.');
  assertIncludes('src/services/queue.service.js', 'Không thể complete queue ticket khi chưa có encounter hợp lệ.', 'Queue complete must require an encounter.');
  assertIncludes('src/services/queue.service.js', 'Encounter phải completed trước khi complete queue ticket.', 'Queue complete must not bypass encounter completion.');
  assertIncludes('src/services/queue.service.js', 'Bác sĩ đang có encounter active khác.', 'Queue start service must respect doctor active encounter policy.');
  assertIncludes('src/services/queue.service.js', 'Không được transfer queue đã gắn appointment sang bác sĩ/khoa khác', 'Appointment-linked queue transfers must not desync appointment scope.');
  assertIncludes('src/services/queue.service.js', 'includePatientData: false, includeClinicalLinks: false', 'Queue board DTO must redact patient and clinical link data.');
  assertIncludes('src/services/queue.service.js', 'items: items.map(formatAuditTimelineItem)', 'Queue timeline must not return raw AuditLog documents.');

  assertIncludes('src/models/clinical/encounter.model.js', 'appointment_id: { $exists: true }', 'Encounter model must have a defensive appointment uniqueness index.');
  assertIncludes('src/models/clinical/encounter.model.js', 'unique: true', 'Encounter appointment uniqueness must be enforced at model level.');
  assertIncludes('src/services/encounter.service.js', 'function assertEncounterTargetWritable', 'Encounter create/update must enforce target writable scope.');
  assertIncludes('src/services/encounter.service.js', 'Bác sĩ chỉ được truy cập encounter của chính mình.', 'Doctor encounter access must be own-scope only.');
  assertIncludes('src/services/encounter.service.js', 'Appointment đã có encounter active.', 'Creating a duplicate appointment encounter must return conflict.');
  assertIncludes('src/services/encounter.service.js', 'Queue ticket đã có encounter active.', 'Creating a duplicate queue encounter must return conflict.');
  assertIncludes('src/services/encounter.service.js', 'assertNoOtherInProgressEncounterForDoctor', 'Doctor active encounter policy must be enforced.');
  assertIncludes('src/services/encounter.service.js', 'checkEncounterHasBlockingOrders', 'Encounter completion/cancel must inspect active orders.');
  assertIncludes('src/services/encounter.service.js', 'Encounter còn order active chưa hoàn tất/hủy.', 'Encounter completion must block active orders.');
  assertIncludes('src/services/encounter.service.js', 'items: items.map(serializeAuditTimelineItem)', 'Encounter timeline must not return raw AuditLog documents.');

  assertIncludes('src/models/clinical/diagnosis.model.js', 'partialFilterExpression', 'Diagnosis model must enforce one active primary diagnosis per encounter.');
  assertIncludes('src/models/clinical/diagnosis.model.js', 'is_primary: true', 'Diagnosis unique index must target primary diagnoses.');
  assertIncludes('src/services/clinical.service.js', 'normalizeDiagnosisWriteError', 'Clinical diagnosis duplicate-key conflicts must map to 409.');
  assertIncludes('src/services/clinical.service.js', 'is_primary: false', 'Primary diagnosis creation must avoid violating the unique index before demoting old primaries.');
  assertIncludes('src/services/clinical.service.js', 'heart_rate: [20, 250]', 'Vital sign validation must reject impossible heart rates.');
  assertIncludes('src/services/clinical.service.js', 'systolic_bp: [40, 260]', 'Vital sign validation must reject impossible blood pressures.');
  assertIncludes('src/services/clinical.service.js', 'Clinical note hiện không thể chỉnh sửa trực tiếp.', 'Signed clinical notes must not be directly editable.');
  assertIncludes('src/services/clinical.service.js', "action: 'clinical_note.amend'", 'Clinical note amendments must be audited.');
  assertIncludes('src/services/clinical.service.js', 'Bác sĩ chỉ được thao tác dữ liệu lâm sàng của encounter do mình phụ trách.', 'Doctor clinical writes must be own-encounter only.');
  assertIncludes('src/services/clinical.service.js', 'status: ALLERGY_STATUS.ACTIVE', 'Entered-in-error allergies must not be surfaced as active warnings.');

  console.log('Queue/Encounter/Clinical hardening checks passed.');
}

main();
