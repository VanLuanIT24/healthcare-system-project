export function isPatientUser(user) {
  return (user?.actorType || user?.actor_type) === 'patient'
}

export function isStaffUser(user) {
  return (user?.actorType || user?.actor_type) === 'staff'
}

export function hasRole(user, role) {
  return Array.isArray(user?.roles) && user.roles.includes(role)
}

export function isDoctorUser(user) {
  return isStaffUser(user) && hasRole(user, 'doctor')
}

export function canAccessDoctorModule(user) {
  return isDoctorUser(user)
}

export function getDefaultAuthenticatedPath(user) {
  if (isDoctorUser(user)) {
    return '/doctor/dashboard'
  }

  if (isPatientUser(user)) {
    return '/dashboard'
  }

  if (isStaffUser(user)) {
    return '/tai-khoan'
  }

  return '/'
}
