const express = require('express');
const ApiResponse = require('../common/responses/api-response');
const accessAuthorizationRoutes = require('./access-authorization.routes');
const appointmentRoutes = require('./appointment.routes');
const adminRoutes = require('./admin.routes');
const auditRoutes = require('./audit.routes');
const authRoutes = require('./auth.routes');
const billingRoutes = require('./billing.routes');
const clinicalRoutes = require('./clinical.routes');
const dashboardRoutes = require('./dashboard.routes');
const departmentRoutes = require('./department.routes');
const devBankQrRoutes = require('./dev-bank-qr.routes');
const directoryRoutes = require('./directory.routes');
const doctorProfileRoutes = require('./doctor-profile.routes');
const emergencyRoutes = require('./emergency.routes');
const encounterRoutes = require('./encounter.routes');
const iamRoutes = require('./iam.routes');
const imagingRoutes = require('./imaging.routes');
const inpatientRoutes = require('./inpatient.routes');
const laboratoryRoutes = require('./laboratory.routes');
const messageRoutes = require('./message.routes');
const notificationRoutes = require('./notification.routes');
const orderRoutes = require('./order.routes');
const paymentsRoutes = require('./payments.routes');
const patientRoutes = require('./patient.routes');
const portalRoutes = require('./portal.routes');
const procedureRoutes = require('./procedure.routes');
const prescriptionRoutes = require('./prescription.routes');
const queueRoutes = require('./queue.routes');
const qrTokenRoutes = require('./qr-token.routes');
const reportsRoutes = require('./reports.routes');
const recordsRoutes = require('./records.routes');
const scheduleRoutes = require('./schedule.routes');
const staffRoutes = require('./staff.routes');
const supportTicketRoutes = require('./support-ticket.routes');
const userPreferenceRoutes = require('./user-preference.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  return ApiResponse.success(res, {
    ok: true,
    service: 'healthcare-system-backend',
  }, 'Service healthy.');
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/access', accessAuthorizationRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/billing', billingRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/iam', iamRoutes);
router.use('/staff', staffRoutes);
router.use('/departments', departmentRoutes);
router.use('/dev/bank-qr', devBankQrRoutes);
router.use('/directory', directoryRoutes);
router.use('/doctor-profiles', doctorProfileRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/patients', patientRoutes);
router.use('/portal', portalRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/queue', queueRoutes);
router.use('/qr', qrTokenRoutes);
router.use('/reports', reportsRoutes);
router.use('/encounters', encounterRoutes);
router.use('/clinical', clinicalRoutes);
router.use('/imaging', imagingRoutes);
router.use('/inpatient', inpatientRoutes);
router.use('/lab', laboratoryRoutes);
router.use('/notifications', notificationRoutes);
router.use('/messages', messageRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentsRoutes);
router.use('/procedures', procedureRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/records', recordsRoutes);
router.use('/support', supportTicketRoutes);
router.use('/preferences', userPreferenceRoutes);

module.exports = router;
