const express = require('express');
const departmentController = require('../controllers/department.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.get('/active', departmentController.listActiveDepartments);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.get('/', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.listDepartments);
router.get('/search', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.searchDepartments);
router.post('/', authorize({ anyPermissions: ['department.write', 'auth.staff.create'] }), departmentController.createDepartment);
router.get('/:departmentId/summary', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.getDepartmentSummary);
router.get('/:departmentId', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.getDepartmentDetail);
router.patch('/:departmentId', authorize({ anyPermissions: ['department.write', 'auth.staff.create'] }), departmentController.updateDepartment);
router.patch(
  '/:departmentId/status',
  authorize({ anyPermissions: ['department.write', 'auth.staff.update_status'] }),
  departmentController.updateDepartmentStatus,
);
router.delete(
  '/:departmentId',
  authorize({ anyPermissions: ['department.write', 'auth.staff.update_status'] }),
  departmentController.deleteDepartmentSoft,
);
router.get('/:departmentId/head', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.getDepartmentHead);
router.post(
  '/:departmentId/head',
  authorize({ anyPermissions: ['department.write', 'auth.staff.create'] }),
  departmentController.assignDepartmentHead,
);
router.delete(
  '/:departmentId/head',
  authorize({ anyPermissions: ['department.write', 'auth.staff.create'] }),
  departmentController.removeDepartmentHead,
);
router.get('/:departmentId/staff', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.listDepartmentStaff);
router.get(
  '/:departmentId/staff/count',
  authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }),
  departmentController.countDepartmentStaff,
);
router.get(
  '/:departmentId/dependencies',
  authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }),
  departmentController.checkDepartmentInUse,
);
router.get('/:departmentId/check-active-staff', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.checkDepartmentHasActiveStaff);
router.get('/:departmentId/can-deactivate', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.checkDepartmentCanBeDeactivated);
router.get('/:departmentId/future-schedules', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.checkDepartmentHasFutureSchedules);
router.get('/:departmentId/future-appointments', authorize({ anyPermissions: ['department.read', 'auth.staff.read'] }), departmentController.checkDepartmentHasFutureAppointments);

module.exports = router;
