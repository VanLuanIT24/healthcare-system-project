const express = require('express');
const appointmentRoutes = require('./appointment.routes');
const adminRoutes = require('./admin.routes');
const auditRoutes = require('./audit.routes');
const authRoutes = require('./auth.routes');
const billingRoutes = require('./billing.routes');
const clinicalRoutes = require('./clinical.routes');
const dashboardRoutes = require('./dashboard.routes');
const departmentRoutes = require('./department.routes');
const encounterRoutes = require('./encounter.routes');
const iamRoutes = require('./iam.routes');
const imagingRoutes = require('./imaging.routes');
const inpatientRoutes = require('./inpatient.routes');
const laboratoryRoutes = require('./laboratory.routes');
const notificationRoutes = require('./notification.routes');
const orderRoutes = require('./order.routes');
const patientRoutes = require('./patient.routes');
const procedureRoutes = require('./procedure.routes');
const prescriptionRoutes = require('./prescription.routes');
const queueRoutes = require('./queue.routes');
const reportsRoutes = require('./reports.routes');
const recordsRoutes = require('./records.routes');
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
router.use('/admin', adminRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/billing', billingRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/iam', iamRoutes);
router.use('/staff', staffRoutes);
router.use('/departments', departmentRoutes);
router.use('/patients', patientRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/queue', queueRoutes);
router.use('/reports', reportsRoutes);
router.use('/encounters', encounterRoutes);
router.use('/clinical', clinicalRoutes);
router.use('/imaging', imagingRoutes);
router.use('/inpatient', inpatientRoutes);
router.use('/lab', laboratoryRoutes);
router.use('/notifications', notificationRoutes);
router.use('/orders', orderRoutes);
router.use('/procedures', procedureRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/records', recordsRoutes);

module.exports = router;
