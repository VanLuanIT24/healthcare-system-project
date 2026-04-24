const express = require('express');
const appointmentRoutes = require('./appointment.routes');
const authRoutes = require('./auth.routes');
const clinicalRoutes = require('./clinical.routes');
const departmentRoutes = require('./department.routes');
const encounterRoutes = require('./encounter.routes');
const iamRoutes = require('./iam.routes');
const patientRoutes = require('./patient.routes');
const prescriptionRoutes = require('./prescription.routes');
const queueRoutes = require('./queue.routes');
const scheduleRoutes = require('./schedule.routes');
const staffRoutes = require('./staff.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'healthcare-system-backend',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/iam', iamRoutes);
router.use('/staff', staffRoutes);
router.use('/departments', departmentRoutes);
router.use('/patients', patientRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/queue', queueRoutes);
router.use('/encounters', encounterRoutes);
router.use('/clinical', clinicalRoutes);
router.use('/prescriptions', prescriptionRoutes);

module.exports = router;
