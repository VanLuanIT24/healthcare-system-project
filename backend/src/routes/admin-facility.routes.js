const express = require('express');
const facilityAdminController = require('../controllers/facility-admin.controller');
const authorize = require('../middleware/authorize');
const { validateObjectIdParam } = require('../common/validators');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

const readPermissions = [
  PERMISSION.SYSTEM.FULL_ACCESS,
  PERMISSION.DEPARTMENTS.READ,
  PERMISSION.DEPARTMENTS.READ_OWN,
  PERMISSION.REPORTS.ADMIN_DASHBOARD_READ,
  PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ,
  PERMISSION.ROOMS.READ,
  PERMISSION.BEDS.READ,
  PERMISSION.DIRECTORY.READ,
  PERMISSION.DIRECTORY.MANAGE,
  PERMISSION.IMAGING_EQUIPMENT.READ,
  PERMISSION.PHARMACY_CONFIG.READ,
].filter(Boolean);

router.param('departmentId', validateObjectIdParam);

router.get('/overview', authorize({ anyPermissions: readPermissions }), facilityAdminController.getOverview);
router.post('/departments/create-with-defaults', authorize({ permissions: [PERMISSION.DEPARTMENTS.CREATE] }), facilityAdminController.createDepartmentWithDefaults);
router.get('/departments/operations-board', authorize({ anyPermissions: readPermissions }), facilityAdminController.getDepartmentOperationsBoard);
router.get('/departments/:departmentId/operational-profile', authorize({ anyPermissions: readPermissions }), facilityAdminController.getDepartmentOperationalProfile);
router.get('/resources', authorize({ anyPermissions: readPermissions }), facilityAdminController.getResourceBoard);
router.get('/operational-status', authorize({ anyPermissions: readPermissions }), facilityAdminController.getOperationalStatus);

module.exports = router;
