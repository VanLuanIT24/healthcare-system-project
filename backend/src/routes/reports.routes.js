const express = require('express');
const reportsController = require('../controllers/reports.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/appointments', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.APPOINTMENTS_READ,
    PERMISSION.APPOINTMENTS.READ,
    PERMISSION.APPOINTMENTS.READ_DEPARTMENT,
    PERMISSION.APPOINTMENTS.READ_OWN,
  ],
}), reportsController.getAppointmentReport);

router.get('/queue', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.QUEUE_READ,
    PERMISSION.QUEUE.READ,
    PERMISSION.QUEUE.READ_DEPARTMENT,
    PERMISSION.QUEUE.READ_OWN,
  ],
}), reportsController.getQueueReport);

router.get('/encounters', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.ENCOUNTERS_READ,
    PERMISSION.ENCOUNTERS.READ,
    PERMISSION.ENCOUNTERS.READ_DEPARTMENT,
    PERMISSION.ENCOUNTERS.READ_OWN,
  ],
}), reportsController.getEncounterReport);

router.get('/revenue', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.REVENUE_READ,
    PERMISSION.REPORTS.BILLING_READ,
  ],
}), reportsController.getRevenueReport);

router.get('/inventory', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.INVENTORY_READ,
    PERMISSION.REPORTS.LOW_STOCK_READ,
    PERMISSION.REPORTS.EXPIRING_STOCK_READ,
    PERMISSION.STOCK_BATCHES.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ,
  ],
}), reportsController.getInventoryReport);

router.get('/departments', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ,
    PERMISSION.DEPARTMENTS.READ,
    PERMISSION.DEPARTMENTS.READ_OWN,
  ],
}), reportsController.getDepartmentReport);

router.get('/doctors', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ,
    PERMISSION.ENCOUNTERS.READ_OWN,
    PERMISSION.APPOINTMENTS.READ_OWN,
  ],
}), reportsController.getDoctorReport);

router.get('/export', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.EXPORT,
    PERMISSION.REPORTS.READ_ALL,
  ],
}), reportsController.exportReport);

module.exports = router;
