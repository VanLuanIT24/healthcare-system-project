export function formatDateTime(value) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatCompactDate(value) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

export function getInitials(name) {
  return String(name || 'ST')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function getStatusTone(status) {
  switch (status) {
    case 'active':
      return 'active';
    case 'locked':
      return 'locked';
    case 'suspended':
      return 'suspended';
    case 'disabled':
      return 'disabled';
    default:
      return 'pending';
  }
}

export function groupPermissions(permissionCodes = []) {
  return permissionCodes.reduce((groups, code) => {
    const moduleKey = String(code).split('.')[0] || 'general';
    groups[moduleKey] = groups[moduleKey] || [];
    groups[moduleKey].push(code);
    return groups;
  }, {});
}
