const { Types } = require('mongoose');
const {
  Appointment,
  Invoice,
  Patient,
  QueueTicket,
  SupportTicket,
} = require('../models');
const appointmentService = require('./appointment.service');
const patientService = require('./patient.service');
const qrTokenService = require('./qr-token.service');
const {
  buildPagination,
  createError,
  escapeRegex,
  getPagination,
} = require('./core.service');
const {
  mapAppointment,
  mapInvoice,
  mapQueueTicket,
  patientMapFor,
  departmentMapFor,
  userMapFor,
  sanitizePatient,
} = require('./reception-dashboard.service');

function toId(value) {
  if (!value) return null;
  return typeof value.toString === 'function' ? value.toString() : String(value);
}

function normalizeQuery(value) {
  return String(value || '').trim();
}

function isLikelyQrToken(value) {
  const text = normalizeQuery(value);
  return text.length >= 24 && /^[A-Za-z0-9_-]+$/.test(text);
}

async function getPatientIdsForKeyword(keyword, limit = 50) {
  const regex = new RegExp(escapeRegex(keyword), 'i');
  const patients = await Patient.find({
    is_deleted: false,
    $or: [
      { patient_code: regex },
      { full_name: regex },
      { phone: regex },
      { email: regex },
      { national_id: regex },
      { insurance_number: regex },
    ],
  })
    .select('_id')
    .limit(limit)
    .lean();
  return patients.map((patient) => patient._id);
}

async function searchQueue(keyword, actor, limit = 5) {
  const regex = new RegExp(escapeRegex(keyword), 'i');
  const patientIds = await getPatientIdsForKeyword(keyword);
  const items = await QueueTicket.find({
    $or: [
      { queue_number: regex },
      { display_number: regex },
      ...(patientIds.length ? [{ patient_id: { $in: patientIds } }] : []),
    ],
  })
    .sort({ queue_date: -1, checkin_time: -1, created_at: -1 })
    .limit(limit)
    .lean();
  const maps = {
    patientMap: await patientMapFor(items),
    departmentMap: await departmentMapFor(items),
    doctorMap: await userMapFor(items),
  };
  return items.map((item) => mapQueueTicket(item, maps));
}

async function searchInvoices(keyword, limit = 5) {
  const regex = new RegExp(escapeRegex(keyword), 'i');
  const patientIds = await getPatientIdsForKeyword(keyword);
  const items = await Invoice.find({
    $or: [
      { invoice_no: regex },
      ...(Types.ObjectId.isValid(keyword) ? [{ _id: keyword }] : []),
      ...(patientIds.length ? [{ patient_id: { $in: patientIds } }] : []),
    ],
  })
    .sort({ issued_at: -1, created_at: -1 })
    .limit(limit)
    .lean();
  const patientMap = await patientMapFor(items);
  return items.map((item) => mapInvoice(item, patientMap.get(toId(item.patient_id))));
}

async function searchSupportTickets(keyword, limit = 5) {
  const regex = new RegExp(escapeRegex(keyword), 'i');
  const patientIds = await getPatientIdsForKeyword(keyword);
  const items = await SupportTicket.find({
    $or: [
      { ticket_code: regex },
      { subject: regex },
      { description: regex },
      ...(patientIds.length ? [{ patient_id: { $in: patientIds } }] : []),
    ],
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();
  const patientMap = await patientMapFor(items);
  return items.map((item) => ({
    ticket_id: toId(item._id),
    ticket_code: item.ticket_code,
    patient_id: toId(item.patient_id),
    patient: sanitizePatient(patientMap.get(toId(item.patient_id))),
    subject: item.subject,
    category: item.category,
    priority: item.priority,
    status: item.status,
    sla_due_at: item.sla_due_at,
    created_at: item.created_at,
  }));
}

function suggestedAction(results = {}) {
  if (results.qr_token?.token_status === 'valid') {
    return { type: 'open_qr_result', token_type: results.qr_token.token_type };
  }
  if (results.patients?.length === 1) {
    return { type: 'open_patient', patient_id: results.patients[0].patient_id };
  }
  if (results.appointments?.length === 1) {
    return { type: 'open_appointment', appointment_id: results.appointments[0].appointment_id };
  }
  if (results.queue_tickets?.length === 1) {
    return { type: 'open_queue_ticket', queue_ticket_id: results.queue_tickets[0].queue_ticket_id };
  }
  if (results.invoices?.length === 1) {
    return { type: 'open_invoice', invoice_id: results.invoices[0].invoice_id };
  }
  return { type: 'show_results' };
}

async function globalSearch(query = {}, actor = {}) {
  const keyword = normalizeQuery(query.q || query.keyword || query.search);
  if (keyword.length < 2) {
    throw createError('q phải có ít nhất 2 ký tự.', 400);
  }
  const limit = Math.min(Math.max(Number(query.limit || 5), 1), 10);
  const [
    patientsPayload,
    appointmentsPayload,
    queueTickets,
    invoices,
    supportTickets,
    qrToken,
  ] = await Promise.all([
    patientService.searchPatients({ search: keyword, limit, page: 1 }, actor).catch(() => ({ items: [] })),
    appointmentService.searchAppointments({ q: keyword, limit, page: 1 }, actor).catch(() => ({ items: [] })),
    searchQueue(keyword, actor, limit).catch(() => []),
    searchInvoices(keyword, limit).catch(() => []),
    searchSupportTickets(keyword, limit).catch(() => []),
    isLikelyQrToken(keyword)
      ? qrTokenService.verifyQrToken(keyword, actor, {}).catch((error) => ({
        token_status: 'invalid',
        error: error.message,
      }))
      : Promise.resolve(null),
  ]);

  const appointments = appointmentsPayload.items || [];
  const rawAppointmentItems = appointments.map((item) => ({
    _id: item.appointment_id,
    patient_id: item.patient_id,
    patient_code: item.patient_code,
    patient_name: item.patient_name,
    patient_phone: item.patient_phone,
    doctor_id: item.doctor_id,
    doctor_name: item.doctor_name,
    department_id: item.department_id,
    department_name: item.department_name,
    appointment_time: item.appointment_time,
    appointment_type: item.appointment_type,
    source: item.source,
    status: item.status,
    reason: item.reason,
  }));

  const results = {
    patients: patientsPayload.items || [],
    appointments: rawAppointmentItems.map((item) => mapAppointment(item)),
    queue_tickets: queueTickets,
    invoices,
    support_tickets: supportTickets,
    qr_token: qrToken
      ? {
        token_status: qrToken.valid === false || qrToken.token_status === 'invalid' ? 'invalid' : 'valid',
        token_type: qrToken.token?.type || null,
        entity: qrToken.token || null,
        error: qrToken.error,
      }
      : null,
  };

  return {
    query: keyword,
    results,
    suggested_action: suggestedAction(results),
  };
}

async function searchPatients(query = {}, actor = {}) {
  const payload = await patientService.searchPatients(query, actor);
  return {
    ...payload,
    suggested_action: payload.items?.length === 1
      ? { type: 'open_patient', patient_id: payload.items[0].patient_id }
      : { type: 'show_results' },
  };
}

async function lookupPhone(query = {}, actor = {}) {
  const phone = normalizeQuery(query.phone || query.q || query.search);
  if (!phone) throw createError('phone là bắt buộc.', 400);
  return searchPatients({ phone, search: phone, limit: query.limit || 10, page: query.page || 1 }, actor);
}

async function lookupNationalId(query = {}, actor = {}) {
  const nationalId = normalizeQuery(query.national_id || query.cccd || query.q || query.search);
  if (!nationalId) throw createError('national_id là bắt buộc.', 400);
  return searchPatients({ national_id: nationalId, search: nationalId, limit: query.limit || 10, page: query.page || 1 }, actor);
}

async function recentLookups(query = {}) {
  const { page, limit } = getPagination(query);
  return {
    items: [],
    pagination: buildPagination(page, limit, 0),
    note: 'Lookup log persistence is not enabled yet. Frontend can still keep a local recent list.',
  };
}

module.exports = {
  globalSearch,
  searchPatients,
  lookupPhone,
  lookupNationalId,
  recentLookups,
};
