export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function formatDateTime(value, options = {}) {
  if (!value) {
    return 'Chưa có dữ liệu'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Chưa có dữ liệu'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    ...options,
  }).format(date)
}

export function summarizeUserAgent(userAgent = '') {
  if (!userAgent) {
    return 'Không rõ thiết bị'
  }

  let browser = 'Trình duyệt khác'
  let platform = 'Thiết bị khác'

  if (/Edg/i.test(userAgent)) {
    browser = 'Microsoft Edge'
  } else if (/Chrome/i.test(userAgent)) {
    browser = 'Google Chrome'
  } else if (/Firefox/i.test(userAgent)) {
    browser = 'Mozilla Firefox'
  } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    browser = 'Safari'
  }

  if (/Windows/i.test(userAgent)) {
    platform = 'Windows'
  } else if (/Android/i.test(userAgent)) {
    platform = 'Android'
  } else if (/iPhone|iPad|iOS/i.test(userAgent)) {
    platform = 'iOS'
  } else if (/Mac OS X|Macintosh/i.test(userAgent)) {
    platform = 'macOS'
  } else if (/Linux/i.test(userAgent)) {
    platform = 'Linux'
  }

  return `${browser} • ${platform}`
}
