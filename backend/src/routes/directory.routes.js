const express = require('express');
const directoryController = require('../controllers/directory.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');
const { validateObjectIdParam } = require('../common/validators');
const { createAuthRateLimit } = require('../middleware/auth-rate-limit');

const router = express.Router();

router.param('doctorId', validateObjectIdParam);

const publicDirectoryLimit = createAuthRateLimit({
  scope: 'public-directory',
  limit: 120,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => `${req.path}:${JSON.stringify(req.query || {})}`,
  message: 'Quá nhiều yêu cầu directory public. Vui lòng thử lại sau.',
});

router.get('/departments', publicDirectoryLimit, directoryController.listDepartments);
router.get('/doctors', publicDirectoryLimit, directoryController.listDoctors);
router.get('/doctors/:doctorId', publicDirectoryLimit, directoryController.getDoctor);
router.get('/services', publicDirectoryLimit, directoryController.listServices);
router.get('/service-prices', publicDirectoryLimit, directoryController.listServicePrices);
router.get('/clinics', publicDirectoryLimit, directoryController.listClinics);
router.get('/pharmacies', publicDirectoryLimit, directoryController.listPharmacies);
router.get('/available-slots', publicDirectoryLimit, directoryController.listAvailableSlots);

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'], anyPermissions: [PERMISSION.DIRECTORY.MANAGE] }));

module.exports = router;
