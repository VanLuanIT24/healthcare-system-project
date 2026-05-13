const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('departmentId', validateObjectIdParam);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/system', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.ADMIN_DASHBOARD_READ,
  ],
}), dashboardController.getSystemDashboard);

router.get('/department/:departmentId', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ,
    PERMISSION.DEPARTMENTS.READ_OWN,
  ],
}), dashboardController.getDepartmentDashboard);

router.get('/doctor/me', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ,
    PERMISSION.APPOINTMENTS.READ_OWN,
    PERMISSION.ENCOUNTERS.READ_OWN,
  ],
}), dashboardController.getDoctorDashboard);

router.get('/billing', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.BILLING_READ,
    PERMISSION.REPORTS.REVENUE_READ,
    PERMISSION.PAYMENTS.READ,
  ],
}), dashboardController.getBillingDashboard);

router.get('/inventory', authorize({
  anyPermissions: [
    PERMISSION.REPORTS.READ,
    PERMISSION.REPORTS.READ_ALL,
    PERMISSION.REPORTS.INVENTORY_READ,
    PERMISSION.STOCK_BATCHES.READ,
    PERMISSION.INVENTORY_TRANSACTIONS.READ,
  ],
}), dashboardController.getInventoryDashboard);

module.exports = router;
