const express = require('express');
const doctorProfileController = require('../controllers/doctor-profile.controller');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.get('/me', authenticate, doctorProfileController.getMyDoctorProfile);
router.patch('/me', authenticate, doctorProfileController.updateMyDoctorProfile);

module.exports = router;
