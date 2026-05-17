const ApiError = require('../../common/errors/api-error');
const ERROR_CODE = require('../../common/errors/error-codes');

function canTransition(transitions, currentStatus, nextStatus) {
  if (!currentStatus || !nextStatus) return false;
  if (currentStatus === nextStatus) return true;
  return transitions[currentStatus]?.includes(nextStatus) || false;
}

function getAllowedTransitions(transitions, currentStatus) {
  return transitions[currentStatus] || [];
}

function isTerminalStatus(transitions, currentStatus) {
  return getAllowedTransitions(transitions, currentStatus).length === 0;
}

function assertTransition(transitions, currentStatus, nextStatus, entityName = 'dữ liệu') {
  if (canTransition(transitions, currentStatus, nextStatus)) {
    return true;
  }

  const allowed = getAllowedTransitions(transitions, currentStatus);
  const message = allowed.length
    ? `Không thể chuyển trạng thái ${entityName} từ ${currentStatus} sang ${nextStatus}. Trạng thái hợp lệ: ${allowed.join(', ')}.`
    : `Không thể chuyển trạng thái ${entityName} từ ${currentStatus} sang ${nextStatus}. Trạng thái hiện tại là trạng thái kết thúc.`;

  throw ApiError.conflict(message, {
    currentStatus,
    nextStatus,
    allowed,
  }, ERROR_CODE.INVALID_STATE_TRANSITION);
}

module.exports = {
  canTransition,
  getAllowedTransitions,
  isTerminalStatus,
  assertTransition,
};
