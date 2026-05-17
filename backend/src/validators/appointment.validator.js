const { Types } = require('mongoose');
const ApiError = require('../common/errors/api-error');
const ERROR_CODE = require('../common/errors/error-codes');
const { assertRequired, requestValidator } = require('./validator-result');
const { APPOINTMENT_STATUS } = require('../constants/statuses');
const { APPOINTMENT_TRANSITIONS } = require('../constants/transitions');
const { canTransition } = require('../shared/utils/status-transition');

function isObjectId(value) {
  return Types.ObjectId.isValid(String(value || ''));
}

function validateObjectId(value, field, errors) {
  if (value !== undefined && value !== null && value !== '' && !isObjectId(value)) {
    errors.push({ target: 'body', field, message: `${field} must be a valid ObjectId.` });
  }
}

function validateBookingRequestShape(req) {
  const body = req.body || {};
  const errors = [];
  const isPatientBooking = req.auth?.actorType === 'patient' || req.auth?.actor_type === 'patient';

  if (!isPatientBooking) assertRequired(body.patient_id, 'patient_id', errors);
  assertRequired(body.doctor_id, 'doctor_id', errors);
  assertRequired(body.department_id, 'department_id', errors);
  assertRequired(body.appointment_time, 'appointment_time', errors);

  validateObjectId(body.patient_id, 'patient_id', errors);
  validateObjectId(body.doctor_id, 'doctor_id', errors);
  validateObjectId(body.department_id, 'department_id', errors);
  validateObjectId(body.doctor_schedule_id, 'doctor_schedule_id', errors);
  validateObjectId(body.schedule_slot_id, 'schedule_slot_id', errors);

  if (body.appointment_time) {
    const date = new Date(body.appointment_time);
    if (Number.isNaN(date.getTime())) {
      errors.push({ target: 'body', field: 'appointment_time', message: 'appointment_time must be a valid date.' });
    }
  }

  if (body.reason && String(body.reason).length > 1000) {
    errors.push({ target: 'body', field: 'reason', message: 'reason must be at most 1000 characters.' });
  }

  return errors;
}

function validateStatusTransitionRequest(req) {
  const errors = [];
  assertRequired(req.body?.current_status, 'current_status', errors);
  assertRequired(req.body?.next_status, 'next_status', errors);
  return errors;
}

function assertSlotAvailable(slot) {
  if (!slot) throw ApiError.notFound('Không tìm thấy appointment slot.');
  if (slot.status === 'blocked' || slot.status === 'cancelled') {
    throw ApiError.conflict('Slot này đang bị khóa hoặc đã hủy.', null, ERROR_CODE.APPOINTMENT_SLOT_FULL);
  }
  if (Number(slot.booked_count || 0) >= Number(slot.capacity || 1)) {
    throw ApiError.conflict('Slot này đã hết sức chứa.', {
      slot_id: String(slot._id || slot.id),
      booked_count: slot.booked_count,
      capacity: slot.capacity,
    }, ERROR_CODE.APPOINTMENT_SLOT_FULL);
  }
  return true;
}

function assertPatientCanBook(patient) {
  if (!patient || patient.is_deleted) throw ApiError.notFound('Không tìm thấy bệnh nhân.');
  if (patient.status !== 'active') throw ApiError.conflict('Bệnh nhân hiện không được phép đặt lịch.');
  return true;
}

function assertAppointmentTransition(currentStatus, nextStatus) {
  if (!Object.values(APPOINTMENT_STATUS).includes(nextStatus)) {
    throw ApiError.validation('Trạng thái appointment không hợp lệ.', [{ field: 'next_status' }]);
  }
  if (!canTransition(APPOINTMENT_TRANSITIONS, currentStatus, nextStatus)) {
    throw ApiError.conflict('Chuyển trạng thái appointment không hợp lệ.', {
      current_status: currentStatus,
      next_status: nextStatus,
      allowed: APPOINTMENT_TRANSITIONS[currentStatus] || [],
    }, ERROR_CODE.INVALID_STATE_TRANSITION);
  }
  return true;
}

function assertBookingScope(actor = {}, payload = {}) {
  const actorType = actor.actorType || actor.actor_type;
  if (actorType === 'patient' && String(payload.patient_id) !== String(actor.patientId || actor.patient_id)) {
    throw ApiError.forbidden('Bệnh nhân chỉ được đặt lịch cho hồ sơ của chính mình.', null, ERROR_CODE.RELATIVE_SCOPE_DENIED);
  }
  return true;
}

module.exports = {
  request: {
    validateBookingRequestShape,
    validateStatusTransitionRequest,
    booking: requestValidator(validateBookingRequestShape),
    statusTransition: requestValidator(validateStatusTransitionRequest),
  },
  business: {
    assertPatientCanBook,
  },
  state: {
    assertSlotAvailable,
    assertAppointmentTransition,
  },
  scope: {
    assertBookingScope,
  },
};
