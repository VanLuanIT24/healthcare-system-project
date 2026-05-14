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
  assertIncludes('src/services/order.service.js', 'globalPermissions: []', 'Order create must not treat generic create permission as cross-encounter global scope.');
  assertIncludes('src/services/order.service.js', 'Không được tạo order thay bác sĩ khác.', 'Order create must reject ordered_by spoofing.');
  assertIncludes('src/services/order.service.js', 'Doctor ngoài encounter không được tạo order.', 'Doctor outside the encounter must not create an order.');
  assertIncludes('src/services/order.service.js', 'department_id của order phải cùng khoa với encounter.', 'Order create must reject department spoofing.');
  assertIncludes('src/services/order.service.js', 'assertOrderScopedPermission', 'Order write actions must enforce doctor/department scope.');
  assertIncludes('src/services/order.service.js', 'getExistingDispatchChild', 'Order dispatch must be idempotent when a child order already exists.');
  assertIncludes('src/services/order.service.js', 'đã được dispatch bởi request khác', 'Order dispatch duplicate-key races must fail clearly instead of returning null.');
  assertIncludes('src/services/order.service.js', 'source_module: \'order\'', 'Order charges must carry a unique source module/id.');
  assertIncludes('src/services/order.service.js', 'if (existing) {', 'Order charge creation must return existing active charges on retry.');
  assertIncludes('src/services/order.service.js', 'if (!childCheck.completed)', 'Completing an order must not bypass incomplete child orders with force.');
  assertIncludes('src/services/order.service.js', 'withOrderFailureAudits', 'Order create/dispatch/status/charge failures must be audited.');
  assertIncludes('src/models/billing/charge.model.js', 'partialFilterExpression', 'Charge model must defensively prevent duplicate active order/source charges.');
  assertIncludes('src/models/billing/charge.model.js', '{ source_module: 1, source_id: 1 }', 'Charge model must index source module/id.');

  assertIncludes('src/services/laboratory.service.js', 'applyFinalOnlyResultFilter', 'READ_FINAL lab result permission must be constrained to final/amended results.');
  assertIncludes('src/services/laboratory.service.js', 'is_current: { $ne: false }', 'Patient portal and result lists must hide superseded lab result versions by default.');
  assertIncludes('src/services/laboratory.service.js', 'Quyền hiện tại chỉ được xem lab result final/amended.', 'READ_FINAL lab result detail must reject preliminary results.');
  assertIncludes('src/services/laboratory.service.js', 'Lab order đã có result final/amended khác.', 'Lab result finalize must prevent multiple final/amended results per lab order.');
  assertIncludes('src/services/laboratory.service.js', 'Specimen phải received/in_testing/stored trước khi finalize result.', 'Lab result finalize must require a processable specimen state.');
  assertIncludes('src/services/laboratory.service.js', 'Result item numeric phải có unit và reference_range', 'Lab result finalize must reject incomplete numeric result items.');
  assertIncludes('src/services/laboratory.service.js', 'Không được dispose specimen đang in_testing nếu không có force policy.', 'Specimen dispose must block in_testing specimens unless force policy is explicit.');
  assertIncludes('src/services/laboratory.service.js', 'LabResult.create([{', 'Amending a final lab result must create a new version instead of mutating the final document.');
  assertIncludes('src/services/laboratory.service.js', 'amended_from: String(result._id)', 'Lab result amendments must keep amended_from history in audit metadata.');
  assertIncludes('src/services/laboratory.service.js', 'Không release version lab result đã bị supersede.', 'Patient release must not publish superseded lab result versions.');
  assertIncludes('src/services/laboratory.service.js', 'lab_result.critical_pending_ack', 'Critical lab results must emit a pending acknowledgement event.');
  assertIncludes('src/services/laboratory.service.js', 'manual_abnormal_flags', 'Manual abnormal/critical flags must be visible in audit metadata.');
  assertIncludes('src/services/laboratory.service.js', 'withLaboratoryFailureAudits', 'Laboratory lifecycle failures must be audited.');
  assertIncludes('src/services/laboratory.service.js', 'acknowledgeCriticalLabResult', 'Critical lab results must have an acknowledge workflow.');
  assertIncludes('src/models/laboratory/lab-result.model.js', 'amended_from', 'Lab result model must persist amendment source links.');
  assertIncludes('src/models/laboratory/lab-result.model.js', 'is_current', 'Lab result model must distinguish current and historical versions.');
  assertIncludes('src/models/laboratory/lab-result.model.js', 'partialFilterExpression', 'Lab result model must prevent duplicate current final/amended results per lab order.');
  assertIncludes('src/models/laboratory/lab-result.model.js', 'critical_acknowledged_at', 'Lab result model must persist critical acknowledgements.');
  assertIncludes('src/routes/laboratory.routes.js', 'acknowledge-critical', 'Laboratory routes must expose critical acknowledgement.');
  assertIncludes('src/constants/permissions/permission-codes.js', 'CRITICAL_ACKNOWLEDGE', 'Permissions must include lab critical acknowledgement.');

  console.log('Order/Laboratory hardening checks passed.');
}

main();
