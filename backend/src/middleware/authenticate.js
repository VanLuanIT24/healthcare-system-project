const { verifyAccessToken } = require('../utils/tokens');
const { Patient, PatientAccount, Permission, Role, RolePermission, User, UserRole } = require('../models');

function ensureActiveAccount(account, label) {
  if (!account || account.is_deleted) {
    return `${label} không tồn tại hoặc đã bị xóa.`;
  }

  if (account.locked_until && account.locked_until > new Date()) {
    return `${label} đang tạm bị khóa.`;
  }

  if (account.status !== 'active') {
    return `${label} hiện không khả dụng.`;
  }

  return null;
}

async function resolveStaffAuthorization(userId) {
  const userRoles = await UserRole.find({
    user_id: userId,
    is_active: true,
  }).lean();

  const roleIds = userRoles.map((item) => item.role_id);
  const roles = await Role.find({ _id: { $in: roleIds }, status: 'active' }).lean();
  const activeRoleIds = roles.map((role) => role._id);

  const rolePermissions = await RolePermission.find({
    role_id: { $in: activeRoleIds },
    is_active: true,
  }).lean();

  const permissionIds = [...new Set(rolePermissions.map((item) => String(item.permission_id)))];
  const permissions = await Permission.find({ _id: { $in: permissionIds }, is_deleted: false }).lean();

  return {
    roles: roles.map((role) => role.role_code),
    permissions: permissions.map((permission) => permission.permission_code),
  };
}

async function authenticate(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ success: false, message: 'Thiếu token truy cập hoặc token không hợp lệ.' });
    }

    const payload = verifyAccessToken(token);

    if (payload.actor_type === 'staff') {
      const user = await User.findById(payload.sub).lean();
      if (!user) {
        return res.status(401).json({ success: false, message: 'Không tìm thấy tài khoản nhân sự.' });
      }

      const accountStateError = ensureActiveAccount(user, 'Tài khoản nhân sự');
      if (accountStateError) {
        return res.status(401).json({ success: false, message: accountStateError });
      }

      const authorization = await resolveStaffAuthorization(user._id);

      req.auth = {
        actorType: 'staff',
        userId: String(user._id),
        roles: authorization.roles,
        permissions: authorization.permissions,
        user,
      };
      return next();
    }

    if (payload.actor_type === 'patient') {
      const account = await PatientAccount.findById(payload.sub).lean();
      if (!account) {
        return res.status(401).json({ success: false, message: 'Không tìm thấy tài khoản bệnh nhân.' });
      }

      const accountStateError = ensureActiveAccount(account, 'Tài khoản bệnh nhân');
      if (accountStateError) {
        return res.status(401).json({ success: false, message: accountStateError });
      }

      const patient = await Patient.findById(account.patient_id).lean();
      if (!patient) {
        return res.status(401).json({ success: false, message: 'Không tìm thấy hồ sơ bệnh nhân.' });
      }

      req.auth = {
        actorType: 'patient',
        patientAccountId: String(account._id),
        patientId: String(patient._id),
        roles: ['patient'],
        permissions: ['patients.self.read', 'patients.self.update', 'appointments.self.read', 'appointments.self.create'],
        account,
        patient,
      };
      return next();
    }

    return res.status(401).json({ success: false, message: 'Loại tài khoản không được hỗ trợ.' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Bạn chưa được xác thực hoặc phiên đăng nhập đã hết hạn.' });
  }
}

module.exports = authenticate;
