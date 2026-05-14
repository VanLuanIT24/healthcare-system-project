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

function assertNotIncludes(relativePath, unexpected, message) {
  if (read(relativePath).includes(unexpected)) {
    throw new Error(`${message} (${relativePath})`);
  }
}

function functionBody(relativePath, functionName, nextFunctionName) {
  const content = read(relativePath);
  const start = content.indexOf(`async function ${functionName}`);
  const end = nextFunctionName ? content.indexOf(`async function ${nextFunctionName}`, start + 1) : -1;
  if (start === -1) {
    throw new Error(`Missing function ${functionName} (${relativePath})`);
  }
  return content.slice(start, end === -1 ? undefined : end);
}

function main() {
  assertIncludes('src/routes/staff.routes.js', "router.param('roleId', validateObjectIdParam)", 'Staff roleId route param must be ObjectId-validated.');

  assertIncludes('src/services/staff.service.js', 'assertCanManageTargetStaff(user, actor, \'gán role cho\')', 'Staff role assignment must check target scope and priority before IAM sync.');
  assertIncludes('src/services/staff.service.js', 'Không được đổi department qua API update staff', 'Staff update must not transfer departments directly.');
  assertIncludes('src/services/staff.service.js', 'Tài khoản hiện tại chưa có department scope.', 'READ_DEPARTMENT without department scope must fail closed.');
  assertIncludes('src/services/staff.service.js', 'assertCanManageTargetStaff(user, actor, \'vô hiệu hóa\')', 'Deactivate wrapper must enforce staff scope.');
  const doctorsListBody = functionBody('src/services/staff.service.js', 'getDoctorsList', 'getAssignableStaffRoles');
  if (doctorsListBody.includes('username: user.username') || doctorsListBody.includes('email: user.email') || doctorsListBody.includes('phone: user.phone')) {
    throw new Error('Limited doctors list must not expose account internals. (src/services/staff.service.js)');
  }

  assertIncludes('src/services/admin/doctor-profile.service.js', 'serializePublicDoctorProfile', 'Public doctors must use a dedicated DTO.');
  assertNotIncludes('src/services/admin/doctor-profile.service.js', 'doctor_profile_id: item.doctor_profile_id,\n          user_id: item.user_id', 'Public doctors must not expose user_id.');
  assertIncludes('src/services/admin/doctor-profile.service.js', 'const userSearchFields = publicOnly', 'Public doctors search must use public fields only.');

  assertIncludes('src/services/admin/system-setting.service.js', 'filter.is_sensitive = false', 'Public settings must exclude sensitive settings.');
  assertIncludes('src/services/admin/system-setting.service.js', 'serializePublicSetting', 'Public settings must use a dedicated DTO.');
  assertIncludes('src/services/admin/system-setting.service.js', 'PERMISSION.SETTINGS.UPDATE_SENSITIVE', 'Sensitive settings must honor UPDATE_SENSITIVE permission.');

  console.log('Admin/Staff hardening checks passed.');
}

main();
