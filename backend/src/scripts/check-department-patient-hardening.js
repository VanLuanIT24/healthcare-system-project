const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(relativePath, expected, message) {
  if (!read(relativePath).includes(expected)) {
    throw new Error(`${message} (${relativePath})`);
  }
}

function assertNotIncludes(relativePath, unexpected, message) {
  if (read(relativePath).includes(unexpected)) {
    throw new Error(`${message} (${relativePath})`);
  }
}

function main() {
  assertIncludes('src/services/department.service.js', "const BLOCKING_SCHEDULE_STATUSES = ['draft', 'published', 'active']", 'Department deactivation must block draft/published/active schedules consistently.');
  assertIncludes('src/services/department.service.js', "status: 'active',\n    }),\n    DoctorSchedule.countDocuments", 'Department deactivation must count active staff before allowing inactive status.');
  assertIncludes('src/services/department.service.js', 'Staff được chọn chưa thuộc department nào.', 'Department head assignment must reject staff without department scope.');
  assertIncludes('src/services/department.service.js', 'Không được gán head khi tạo department', 'Department create must not assign head_user_id directly.');
  assertIncludes('src/services/department.service.js', "return getDepartmentDetail(department._id, actor)", 'Department head removal must preserve actor scope when returning detail.');
  assertIncludes('src/services/department.service.js', 'Trường không được phép:', 'Department create/update must reject unknown protected fields.');

  assertIncludes('src/controllers/patient.controller.js', 'detectDuplicatePatients({ ...req.query, ...req.body }, req.auth)', 'Duplicate detection must receive actor context for masking.');
  assertIncludes('src/services/patient.service.js', 'options.allowLimited === true', 'READ_LIMITED must not grant patient detail by default.');
  assertIncludes('src/services/patient.service.js', 'canUseSensitivePatientSearchFilters', 'Patient search must gate sensitive search fields.');
  assertIncludes('src/services/patient.service.js', "throw createError('Quyền hiện tại không được tìm kiếm theo phone/email/national_id/insurance_number.", 'Limited patient search must reject sensitive direct filters.');
  assertIncludes('src/services/patient.service.js', 'assertCanWritePatientClinical', 'Problem/allergy writes must enforce patient assignment or full read scope.');
  assertIncludes('src/services/patient.service.js', 'Force archive hồ sơ bệnh nhân đang bị vô hiệu hóa', 'Archive force must not bypass business blockers without a dedicated permission.');
  assertIncludes('src/services/patient.service.js', 'released_to_patient = true', 'Patient timeline must filter released portal-visible clinical records.');
  assertNotIncludes('src/services/patient.service.js', 'data: item,', 'Patient timeline must not return raw module documents.');

  console.log('Department/Patient hardening checks passed.');
}

main();
