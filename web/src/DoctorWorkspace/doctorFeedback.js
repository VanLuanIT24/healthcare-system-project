import { getApiErrorMessage, getApiErrorStatus } from '../utils/api'

const permissionMessageMap = {
  'queue.manage': 'Vai trò Bác sĩ không có quyền quản lý hàng chờ.',
  'appointments.write': 'Bạn không có quyền thay đổi trạng thái lịch hẹn.',
  'patients.write': 'Bạn không có quyền chỉnh sửa hồ sơ bệnh nhân.',
  'schedule.write': 'Bạn không có quyền chỉnh sửa lịch làm việc.',
  'schedule.publish': 'Bạn không có quyền phát hành lịch làm việc.',
  'schedule.cancel': 'Bạn không có quyền hủy lịch làm việc.',
  'encounters.write': 'Bạn không có quyền cập nhật phiên khám.',
  'consultations.write': 'Bạn không có quyền cập nhật phiếu khám.',
  'diagnoses.write': 'Bạn không có quyền cập nhật chẩn đoán.',
  'vitals.write': 'Bạn không có quyền cập nhật sinh hiệu.',
  'prescriptions.write': 'Bạn không có quyền cập nhật đơn thuốc.',
}

export function getDoctorPermissionMessage(permission, fallback = '') {
  return fallback || permissionMessageMap[permission] || 'Bạn không có quyền thực hiện thao tác này.'
}

export function showDoctorToast(toast, options = {}) {
  const message = String(options.message || '').trim()
  if (!toast || !message) {
    return
  }

  const method = toast[options.type] || toast.info
  method(message, {
    title: options.title || '',
    duration: options.duration,
  })
}

export function notifyDoctorSuccess(toast, message, title = 'Đã cập nhật') {
  showDoctorToast(toast, {
    type: 'success',
    title,
    message,
    duration: 2800,
  })
}

export function notifyPermissionDenied(toast, options = {}) {
  const permission = typeof options === 'string' ? options : options.permission
  const message = getDoctorPermissionMessage(permission, typeof options === 'object' ? options.message : '')

  showDoctorToast(toast, {
    type: 'warning',
    title: 'Không đủ quyền',
    message,
    duration: 4200,
  })
}

export function handleDoctorApiError(error, toast, fallback, options = {}) {
  const status = getApiErrorStatus(error)
  const message = getApiErrorMessage(error, fallback)

  if (status === 403) {
    notifyPermissionDenied(toast, {
      permission: options.permission,
      message,
    })
    return message
  }

  if (status === 409) {
    showDoctorToast(toast, {
      type: 'warning',
      title: 'Trạng thái chưa hợp lệ',
      message,
      duration: 4200,
    })
    return message
  }

  if (status === 400) {
    showDoctorToast(toast, {
      type: 'warning',
      title: 'Dữ liệu chưa hợp lệ',
      message,
      duration: 4200,
    })
    return message
  }

  showDoctorToast(toast, {
    type: status >= 500 ? 'error' : 'warning',
    title: status >= 500 ? 'Lỗi hệ thống' : 'Không thể thực hiện',
    message,
    duration: 4200,
  })

  return message
}

export function guardDoctorAction({ allowed, toast, permission, message, onAllowed }) {
  if (!allowed) {
    notifyPermissionDenied(toast, { permission, message })
    return false
  }

  if (typeof onAllowed === 'function') {
    onAllowed()
  }

  return true
}
