const express = require('express');
const departmentController = require('../controllers/department.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');

const router = express.Router();

router.param('departmentId', validateObjectIdParam);

router.get('/active', departmentController.listActiveDepartments);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ permissions: [PERMISSION.DEPARTMENTS.READ] }), departmentController.listDepartments);
router.get('/search', authorize({ permissions: [PERMISSION.DEPARTMENTS.READ] }), departmentController.searchDepartments);
router.post('/', authorize({ permissions: [PERMISSION.DEPARTMENTS.CREATE] }), departmentController.createDepartment);
router.get('/:departmentId/summary', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.READ, PERMISSION.DEPARTMENTS.READ_OWN, PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ] }), departmentController.getDepartmentSummary);
router.get('/:departmentId', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.READ, PERMISSION.DEPARTMENTS.READ_OWN] }), departmentController.getDepartmentDetail);
router.patch('/:departmentId', authorize({ permissions: [PERMISSION.DEPARTMENTS.UPDATE] }), departmentController.updateDepartment);
router.patch(
  '/:departmentId/status',
  authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.UPDATE_STATUS, PERMISSION.DEPARTMENTS.UPDATE] }),
  departmentController.updateDepartmentStatus,
);
router.delete(
  '/:departmentId',
  authorize({ permissions: [PERMISSION.DEPARTMENTS.DELETE] }),
  departmentController.deleteDepartmentSoft,
);
router.get('/:departmentId/head', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.READ, PERMISSION.DEPARTMENTS.READ_OWN] }), departmentController.getDepartmentHead);
router.post(
  '/:departmentId/head',
  authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.ASSIGN_HEAD, PERMISSION.DEPARTMENTS.UPDATE] }),
  departmentController.assignDepartmentHead,
);
router.delete(
  '/:departmentId/head',
  authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.ASSIGN_HEAD, PERMISSION.DEPARTMENTS.UPDATE] }),
  departmentController.removeDepartmentHead,
);
router.get('/:departmentId/staff', authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.STAFF_READ, PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }), departmentController.listDepartmentStaff);
router.get(
  '/:departmentId/staff/count',
  authorize({ anyPermissions: [PERMISSION.DEPARTMENTS.STAFF_READ, PERMISSION.USERS.READ, PERMISSION.USERS.READ_DEPARTMENT] }),
  departmentController.countDepartmentStaff,
);
router.get(
  '/:departmentId/dependencies',
  authorize({ permissions: [PERMISSION.DEPARTMENTS.READ] }),
  departmentController.checkDepartmentInUse,
);
router.get('/:departmentId/check-active-staff', authorize({ permissions: [PERMISSION.DEPARTMENTS.READ] }), departmentController.checkDepartmentHasActiveStaff);
router.get('/:departmentId/can-deactivate', authorize({ permissions: [PERMISSION.DEPARTMENTS.READ] }), departmentController.checkDepartmentCanBeDeactivated);
router.get('/:departmentId/future-schedules', authorize({ permissions: [PERMISSION.DEPARTMENTS.READ] }), departmentController.checkDepartmentHasFutureSchedules);
router.get('/:departmentId/future-appointments', authorize({ permissions: [PERMISSION.DEPARTMENTS.READ] }), departmentController.checkDepartmentHasFutureAppointments);

module.exports = router;
