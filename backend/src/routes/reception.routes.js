const express = require('express');
const receptionController = require('../controllers/reception.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('patientId', validateObjectIdParam);
router.param('ticketId', validateObjectIdParam);
router.param('appointmentId', validateObjectIdParam);
router.param('invoiceId', validateObjectIdParam);

const readPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.PATIENTS.SEARCH,
  PERMISSION.PATIENTS.READ,
  PERMISSION.PATIENTS.READ_LIMITED,
  PERMISSION.PATIENTS.READ_ASSIGNED,
  PERMISSION.APPOINTMENTS.READ,
  PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
  PERMISSION.QUEUE.READ,
  PERMISSION.QUEUE.READ_DEPARTMENT,
  PERMISSION.INVOICES.READ,
  PERMISSION.PAYMENTS.READ,
  PERMISSION.NOTIFICATIONS.SELF_READ,
  PERMISSION.NOTIFICATIONS.READ_OWN,
  PERMISSION.MESSAGES.STAFF_READ,
  PERMISSION.SUPPORT_TICKETS.REPLY,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.REPORTS.READ,
];

const checkinPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.APPOINTMENTS.CHECKIN,
  PERMISSION.QUEUE.CREATE,
];

const queueWritePermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.QUEUE.UPDATE,
  PERMISSION.QUEUE.CALL,
  PERMISSION.QUEUE.RECALL,
];

const printPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.QUEUE.PRINT_TICKET,
  PERMISSION.INVOICES.PRINT,
  PERMISSION.RECEIPTS.PRINT,
  PERMISSION.QR_TOKENS.CREATE,
];

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/bootstrap', authorize({ anyPermissions: readPermissions }), receptionController.getBootstrap);
router.get('/dashboard', authorize({ anyPermissions: readPermissions }), receptionController.getDashboard);
router.get('/sidebar-counters', authorize({ anyPermissions: readPermissions }), receptionController.getSidebarCounters);
router.get('/activity-feed', authorize({ anyPermissions: readPermissions }), receptionController.getActivityFeed);
router.get('/notifications', authorize({ anyPermissions: readPermissions }), receptionController.getNotifications);

router.get('/search', authorize({ anyPermissions: readPermissions }), receptionController.globalSearch);
router.get('/search/global', authorize({ anyPermissions: readPermissions }), receptionController.globalSearch);
router.get('/search/patients', authorize({ anyPermissions: readPermissions }), receptionController.searchPatients);
router.get('/lookup/phone', authorize({ anyPermissions: readPermissions }), receptionController.lookupPhone);
router.get('/lookup/national-id', authorize({ anyPermissions: readPermissions }), receptionController.lookupNationalId);
router.get('/recent-lookups', authorize({ anyPermissions: readPermissions }), receptionController.recentLookups);

router.get('/patients/:patientId/card', authorize({ anyPermissions: readPermissions }), receptionController.getPatientCard);
router.get('/patients/:patientId/admin-profile', authorize({ anyPermissions: readPermissions }), receptionController.getPatientCard);
router.get('/patients/:patientId/clinical-routing-readiness', authorize({ anyPermissions: readPermissions }), receptionController.getClinicalRoutingReadiness);
router.get('/patients/:patientId/pharmacy-routing-readiness', authorize({ anyPermissions: readPermissions }), receptionController.getPharmacyRoutingReadiness);

router.get('/upcoming-appointments', authorize({ anyPermissions: readPermissions }), receptionController.getUpcomingAppointments);
router.get('/waiting-patients', authorize({ anyPermissions: readPermissions }), receptionController.getWaitingPatients);
router.get('/queue-board', authorize({ anyPermissions: readPermissions }), receptionController.getQueueBoard);
router.get('/checkins/recent', authorize({ anyPermissions: readPermissions }), receptionController.getRecentCheckins);
router.get('/checkins/history', authorize({ anyPermissions: readPermissions }), receptionController.getRecentCheckins);
router.get('/checkins/errors', authorize({ anyPermissions: readPermissions }), receptionController.getCheckinErrors);
router.get('/checkin-errors', authorize({ anyPermissions: readPermissions }), receptionController.getCheckinErrors);
router.post('/checkin-errors/:checkinErrorId/retry', authorize({ anyPermissions: checkinPermissions }), receptionController.retryCheckinError);
router.post('/checkin-errors/:checkinErrorId/resolve', authorize({ anyPermissions: checkinPermissions }), receptionController.resolveCheckinError);

router.get('/worklist', authorize({ anyPermissions: readPermissions }), receptionController.getWorklist);
router.post('/worklist/:itemId/assign', authorize({ anyPermissions: queueWritePermissions }), receptionController.assignWorklistItem);
router.post('/worklist/:itemId/resolve', authorize({ anyPermissions: queueWritePermissions }), receptionController.resolveWorklistItem);
router.post('/worklist/:itemId/snooze', authorize({ anyPermissions: queueWritePermissions }), receptionController.snoozeWorklistItem);

router.post('/checkin/quick', authorize({ anyPermissions: checkinPermissions }), receptionController.quickCheckin);
router.post('/checkin/qr', authorize({ anyPermissions: checkinPermissions }), receptionController.qrCheckin);
router.post('/walk-in-checkin', authorize({ anyPermissions: checkinPermissions }), receptionController.walkInCheckin);

router.get('/routing-options', authorize({ anyPermissions: readPermissions }), receptionController.getRoutingOptions);
router.post('/route-patient', authorize({ anyPermissions: queueWritePermissions }), receptionController.routePatient);
router.post('/route-to-nursing', authorize({ anyPermissions: queueWritePermissions }), receptionController.routeToNursing);
router.post('/route-to-doctor', authorize({ anyPermissions: queueWritePermissions }), receptionController.routeToDoctor);
router.post('/route-to-cashier', authorize({ anyPermissions: readPermissions }), receptionController.routeToCashier);
router.post('/route-to-clinical', authorize({ anyPermissions: readPermissions }), receptionController.routeToClinical);
router.post('/route-to-pharmacy', authorize({ anyPermissions: readPermissions }), receptionController.routeToPharmacy);
router.get('/routing-history', authorize({ anyPermissions: readPermissions }), receptionController.getRoutingHistory);

router.get('/print/templates', authorize({ anyPermissions: readPermissions }), receptionController.getPrintTemplates);
router.post('/print/queue-ticket/:ticketId', authorize({ anyPermissions: printPermissions }), receptionController.printQueueTicket);
router.post('/print/appointment-slip/:appointmentId', authorize({ anyPermissions: printPermissions }), receptionController.printAppointmentSlip);
router.post('/print/payment-guide/:invoiceId', authorize({ anyPermissions: printPermissions }), receptionController.printPaymentGuide);
router.post('/print/patient-card/:patientId', authorize({ anyPermissions: printPermissions }), receptionController.printPatientCard);
router.post('/print/log', authorize({ anyPermissions: printPermissions }), receptionController.logPrint);

router.get('/reports/daily-overview', authorize({ anyPermissions: readPermissions }), receptionController.getDailyOverviewReport);
router.get('/reports/visits', authorize({ anyPermissions: readPermissions }), receptionController.getVisitsReport);
router.get('/reports/checkins', authorize({ anyPermissions: readPermissions }), receptionController.getCheckinsReport);
router.get('/reports/no-shows', authorize({ anyPermissions: readPermissions }), receptionController.getNoShowsReport);
router.get('/reports/wait-times', authorize({ anyPermissions: readPermissions }), receptionController.getWaitTimesReport);
router.get('/reports/routing', authorize({ anyPermissions: readPermissions }), receptionController.getRoutingReport);
router.get('/reports/counter-performance', authorize({ anyPermissions: readPermissions }), receptionController.getCounterPerformanceReport);

module.exports = router;
