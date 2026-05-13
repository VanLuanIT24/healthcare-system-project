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
  assertIncludes('src/routes/staff.routes.js', "router.param('roleId', validateObjectIdParam)", 'Staff roleId route param must be ObjectId-validated.');

  assertIncludes('src/services/staff.service.js', 'assertCanManageTargetStaff(user, actor, \'gán role cho\')', 'Staff role assignment must check target scope and priority before IAM sync.');
  assertIncludes('src/services/staff.service.js', 'Không được đổi department qua API update staff', 'Staff update must not transfer departments directly.');
  assertIncludes('src/services/staff.service.js', 'Tài khoản hiện tại chưa có department scope.', 'READ_DEPARTMENT without department scope must fail closed.');
  assertIncludes('src/services/staff.service.js', 'assertCanManageTargetStaff(user, actor, \'vô hiệu hóa\')', 'Deactivate wrapper must enforce staff scope.');
  assertNotIncludes('src/services/staff.service.js', 'username: user.username,\n      full_name: user.full_name,\n      email: user.email,\n      phone: user.phone,\n      employee_code: user.employee_code,\n      department_id', 'Limited doctors list must not expose account internals.');

  assertIncludes('src/services/admin/doctor-profile.service.js', 'serializePublicDoctorProfile', 'Public doctors must use a dedicated DTO.');
  assertNotIncludes('src/services/admin/doctor-profile.service.js', 'doctor_profile_id: item.doctor_profile_id,\n          user_id: item.user_id', 'Public doctors must not expose user_id.');
  assertIncludes('src/services/admin/doctor-profile.service.js', 'const userSearchFields = publicOnly', 'Public doctors search must use public fields only.');

  assertIncludes('src/services/admin/system-setting.service.js', 'filter.is_sensitive = false', 'Public settings must exclude sensitive settings.');
  assertIncludes('src/services/admin/system-setting.service.js', 'serializePublicSetting', 'Public settings must use a dedicated DTO.');
  assertIncludes('src/services/admin/system-setting.service.js', 'PERMISSION.SETTINGS.UPDATE_SENSITIVE', 'Sensitive settings must honor UPDATE_SENSITIVE permission.');

  console.log('Admin/Staff hardening checks passed.');
}

main();
