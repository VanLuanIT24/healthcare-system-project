const crypto = require('crypto');

function getHeaderValue(req, headerName) {
  const value = req.headers[headerName.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function requestContextMiddleware(req, res, next) {
  const requestId = getHeaderValue(req, 'x-request-id') || crypto.randomUUID();
  const correlationId = getHeaderValue(req, 'x-correlation-id') || requestId;
  const ip = req.ip;
  const userAgent = getHeaderValue(req, 'user-agent');

  req.context = {
    request_id: requestId,
    correlation_id: correlationId,
    ip,
    user_agent: userAgent,
    actor_type: null,
    actor_id: null,
    user: null,
    patientAccount: null,
    patient_id: null,
    roles: [],
    permissions: [],
    department_id: null,
    actor: {
      actor_type: null,
      actor_id: null,
      user_id: null,
      patient_account_id: null,
      patient_id: null,
      relative_id: null,
      roles: [],
      permissions: [],
      department_id: null,
      department_ids: [],
      doctor_profile_id: null,
      is_super_admin: false,
      is_staff: false,
      is_patient: false,
      is_patient_relative: false,
      is_system: false,
    },
    session: {
      session_id: null,
      token_type: null,
    },
    audit: {
      source: 'api',
      module: null,
      action: null,
    },
  };

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}

module.exports = requestContextMiddleware;
