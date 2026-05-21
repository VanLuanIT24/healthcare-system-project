const express = require('express');
const billingReportRoutes = require('./billing-report.routes');
const pharmacyReportRoutes = require('./pharmacy-report.routes');
const reportsController = require('../controllers/reports.controller');
const executiveReportController = require('../controllers/executive-report.controller');
const operationsReportController = require('../controllers/operations-report.controller');
const departmentsDoctorsReportController = require('../controllers/departments-doctors-report.controller');
const financeReportController = require('../controllers/finance-report.controller');
const diagnosticsReportController = require('../controllers/diagnostics-report.controller');
const inpatientEmergencyReportController = require('../controllers/inpatient-emergency-report.controller');
const qualityRiskReportController = require('../controllers/quality-risk-report.controller');
const recordsDocumentsReportController = require('../controllers/records-documents-report.controller');
const customReportController = require('../controllers/custom-report.controller');
const reportExportCenterController = require('../controllers/report-export-center.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { PERMISSION } = require('../constants/permissions');

const router = express.Router();

router.use(authenticate);
router.use(authorize({ actorTypes: ['staff'] }));

router.use('/pharmacy', pharmacyReportRoutes);
router.use('/billing', billingReportRoutes);

const customReportPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.EXPORT,
  PERMISSION.REPORTS.ADMIN_DASHBOARD_READ,
  PERMISSION.REPORTS.APPOINTMENTS_READ,
  PERMISSION.REPORTS.QUEUE_READ,
  PERMISSION.REPORTS.ENCOUNTERS_READ,
  PERMISSION.REPORTS.REVENUE_READ,
  PERMISSION.REPORTS.INVENTORY_READ,
  PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ,
  PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ,
];

const reportExportCenterPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.EXPORT,
  PERMISSION.REPORTS.ADMIN_DASHBOARD_READ,
  PERMISSION.AUDIT_LOGS.READ,
  PERMISSION.AUDIT_LOGS.EXPORT,
  PERMISSION.PHARMACY_REPORTS?.EXPORT,
  PERMISSION.REPORTS.MEDICAL_RECORDS_EXPORT,
].filter(Boolean);

router.post('/exports', authorize({
  anyPermissions: [PERMISSION.REPORTS.EXPORT, PERMISSION.REPORTS.READ_ALL, PERMISSION.AUDIT_LOGS.EXPORT, PERMISSION.PHARMACY_REPORTS?.EXPORT].filter(Boolean),
}), reportExportCenterController.createExport);

router.get('/exports', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.history);

router.get('/exports/csv', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.csv);

router.get('/exports/excel', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.excel);

router.get('/exports/pdf', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.pdf);

router.get('/exports/history', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.history);

router.get('/exports/processing', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.processing);

router.get('/exports/failed', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.failed);

router.get('/exports/schedules', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.schedules);

router.get('/exports/saved', authorize({
  anyPermissions: reportExportCenterPermissions,
}), reportExportCenterController.saved);

router.get('/custom/datasets', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.datasets);

router.get('/custom/datasets/:datasetKey/schema', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.datasetSchema);

router.post('/custom/preview', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.preview);

router.post('/custom/run', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.run);

router.get('/custom/reports', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.reports);

router.get('/custom/my', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.myReports);

router.get('/custom/shared', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.sharedReports);

router.get('/custom/pinned', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.pinnedReports);

router.get('/custom/exports', authorize({
  anyPermissions: customReportPermissions,
}), customReportController.exports);

router.get('/executive/overview', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.ADMIN_DASHBOARD_READ],
}), executiveReportController.overview);

router.get('/executive/kpi-today', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.ADMIN_DASHBOARD_READ],
}), executiveReportController.kpiToday);

router.get('/executive/kpi-period', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.ADMIN_DASHBOARD_READ],
}), executiveReportController.kpiPeriod);

router.get('/executive/comparison', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.ADMIN_DASHBOARD_READ],
}), executiveReportController.comparison);

router.get('/executive/anomalies', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.ADMIN_DASHBOARD_READ],
}), executiveReportController.anomalies);

router.get('/executive/trends', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.ADMIN_DASHBOARD_READ],
}), executiveReportController.trends);

router.get('/executive/action-items', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.ADMIN_DASHBOARD_READ],
}), executiveReportController.actionItems);

router.get('/operations/overview', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.APPOINTMENTS_READ, PERMISSION.REPORTS.QUEUE_READ, PERMISSION.REPORTS.ENCOUNTERS_READ],
}), operationsReportController.overview);

router.get('/operations/encounters', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.ENCOUNTERS_READ],
}), operationsReportController.encounters);

router.get('/operations/appointments', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.APPOINTMENTS_READ],
}), operationsReportController.appointments);

router.get('/operations/check-in', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.APPOINTMENTS_READ, PERMISSION.REPORTS.QUEUE_READ],
}), operationsReportController.checkIn);

router.get('/operations/queue', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.QUEUE_READ],
}), operationsReportController.queue);

router.get('/operations/no-show', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.APPOINTMENTS_READ],
}), operationsReportController.noShow);

router.get('/operations/wait-time', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.QUEUE_READ],
}), operationsReportController.waitTime);

router.get('/operations/department-load', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ],
}), operationsReportController.departmentLoad);

router.get('/operations/slot-efficiency', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ, PERMISSION.REPORTS.APPOINTMENTS_READ],
}), operationsReportController.slotEfficiency);

router.get('/operations/patient-flow', authorize({
  anyPermissions: [PERMISSION.REPORTS.READ, PERMISSION.REPORTS.READ_ALL, PERMISSION.REPORTS.APPOINTMENTS_READ, PERMISSION.REPORTS.QUEUE_READ, PERMISSION.REPORTS.ENCOUNTERS_READ],
}), operationsReportController.patientFlow);

const departmentDoctorReportPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.DEPARTMENT_PERFORMANCE_READ,
  PERMISSION.REPORTS.DOCTOR_PERFORMANCE_READ,
  PERMISSION.REPORTS.APPOINTMENTS_READ,
  PERMISSION.REPORTS.QUEUE_READ,
  PERMISSION.REPORTS.ENCOUNTERS_READ,
  PERMISSION.REPORTS.REVENUE_READ,
];

router.get('/departments-doctors/overview', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.overview);

router.get('/departments-doctors/department-performance', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.departmentPerformance);

router.get('/departments-doctors/department-load', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.departmentLoad);

router.get('/departments-doctors/department-appointments', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.departmentAppointments);

router.get('/departments-doctors/department-queue', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.departmentQueue);

router.get('/departments-doctors/department-revenue', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.departmentRevenue);

router.get('/departments-doctors/department-staff', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.departmentStaff);

router.get('/departments-doctors/doctor-performance', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.doctorPerformance);

router.get('/departments-doctors/doctor-utilization', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.doctorUtilization);

router.get('/departments-doctors/doctor-no-show', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.doctorNoShow);

router.get('/departments-doctors/follow-up', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.followUp);

router.get('/departments-doctors/personal-report', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), departmentsDoctorsReportController.personalReport);

router.get('/departments-doctors/personal-report/:doctorId', authorize({
  anyPermissions: departmentDoctorReportPermissions,
}), (req, res, next) => {
  req.query = { ...req.query, doctor_id: req.params.doctorId };
  return departmentsDoctorsReportController.personalReport(req, res, next);
});

const financeReportPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.BILLING_READ,
  PERMISSION.REPORTS.REVENUE_READ,
  PERMISSION.REPORTS.INSURANCE_READ,
  PERMISSION.INVOICES.READ,
  PERMISSION.PAYMENTS.READ,
  PERMISSION.PAYMENT_INTENTS.READ,
  PERMISSION.PAYMENT_RECONCILIATION.READ,
  PERMISSION.CHARGES.READ,
  PERMISSION.INSURANCE_CLAIMS.READ,
  PERMISSION.INSURANCE_POLICIES.READ,
  PERMISSION.SERVICE_CATALOG.READ,
];

router.get('/finance/dashboard', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.dashboard);

router.get('/finance/revenue', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.revenue);

router.get('/finance/accounts-receivable', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.accountsReceivable);

router.get('/finance/ar-aging', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.arAging);

router.get('/finance/invoices', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.invoices);

router.get('/finance/payments', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.payments);

router.get('/finance/payment-methods', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.paymentMethods);

router.get('/finance/refund-void', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.refundVoid);

router.get('/finance/reconciliation', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.reconciliation);

router.get('/finance/insurance', authorize({
  anyPermissions: financeReportPermissions,
}), financeReportController.insurance);

const diagnosticsReportPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.ORDERS.READ,
  PERMISSION.ORDERS.READ_LAB,
  PERMISSION.ORDERS.READ_IMAGING,
  PERMISSION.ORDERS.READ_PROCEDURE,
  PERMISSION.LAB_ORDERS.READ,
  PERMISSION.SPECIMENS.READ,
  PERMISSION.LAB_RESULTS.READ,
  PERMISSION.IMAGING_ORDERS.READ,
  PERMISSION.IMAGING_REPORTS.READ,
  PERMISSION.PROCEDURE_ORDERS.READ,
  PERMISSION.PROCEDURE_ORDERS.SUMMARY_READ,
  PERMISSION.DIAGNOSTIC_ALERTS.READ,
];

router.get('/diagnostics/overview', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.overview);

router.get('/diagnostics/lab-orders', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.labOrders);

router.get('/diagnostics/lab-turnaround-time', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.labTurnaroundTime);

router.get('/diagnostics/specimens', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.specimens);

router.get('/diagnostics/imaging-orders', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.imagingOrders);

router.get('/diagnostics/imaging-turnaround-time', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.imagingTurnaroundTime);

router.get('/diagnostics/report-pending', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.reportPending);

router.get('/diagnostics/critical-results', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.criticalResults);

router.get('/diagnostics/procedure-orders', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.procedureOrders);

router.get('/diagnostics/overdue-orders', authorize({
  anyPermissions: diagnosticsReportPermissions,
}), diagnosticsReportController.overdueOrders);

const inpatientEmergencyReportPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.ADMISSIONS.READ,
  PERMISSION.ADMISSIONS.READ_DEPARTMENT,
  PERMISSION.WARD_BOARD.READ,
  PERMISSION.BEDS.READ,
  PERMISSION.BEDS.READ_DEPARTMENT,
  PERMISSION.BED_ASSIGNMENTS.READ,
  PERMISSION.BED_ASSIGNMENTS.READ_DEPARTMENT,
  PERMISSION.INPATIENT_TASKS.READ,
  PERMISSION.INPATIENT_TASKS.READ_DEPARTMENT,
  PERMISSION.INPATIENT_HANDOVERS.READ,
  PERMISSION.INPATIENT_HANDOVERS.READ_DEPARTMENT,
  PERMISSION.MEDICATION_ADMINISTRATIONS.READ,
  PERMISSION.EMERGENCY.READ,
];

router.get('/inpatient-emergency/admissions', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.admissions);

router.get('/inpatient-emergency/discharges', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.discharges);

router.get('/inpatient-emergency/bed-occupancy', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.bedOccupancy);

router.get('/inpatient-emergency/bed-turnover', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.bedTurnover);

router.get('/inpatient-emergency/length-of-stay', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.lengthOfStay);

router.get('/inpatient-emergency/inpatient-tasks', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.inpatientTasks);

router.get('/inpatient-emergency/emergency-cases', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.emergencyCases);

router.get('/inpatient-emergency/response-time', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.responseTime);

router.get('/inpatient-emergency/case-resolution', authorize({
  anyPermissions: inpatientEmergencyReportPermissions,
}), inpatientEmergencyReportController.caseResolution);

const qualityRiskReportPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.ADMIN_DASHBOARD_READ,
  PERMISSION.DIAGNOSTIC_ALERTS.READ,
  PERMISSION.AUDIT_LOGS.READ,
  PERMISSION.AUDIT_LOGS.READ_LIMITED,
  PERMISSION.AUDIT_LOGS.READ_SECURITY,
  PERMISSION.BREAK_GLASS.READ,
  PERMISSION.SUPPORT_TICKETS.MANAGE,
  PERMISSION.SUPPORT_TICKETS.REPLY,
  PERMISSION.NOTIFICATIONS.READ,
  PERMISSION.NOTIFICATIONS.READ_FAILED,
  PERMISSION.NOTIFICATIONS.MANAGE,
  PERMISSION.EMERGENCY.READ,
];

router.get('/quality-risk/dashboard', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.dashboard);

router.get('/quality-risk/critical-alerts', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.criticalAlerts);

router.get('/quality-risk/break-glass', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.breakGlass);

router.get('/quality-risk/sensitive-access', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.sensitiveAccess);

router.get('/quality-risk/security-audit', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.securityAudit);

router.get('/quality-risk/support-tickets', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.supportTickets);

router.get('/quality-risk/complaints-ratings', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.complaintsRatings);

router.get('/quality-risk/sla', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.sla);

router.get('/quality-risk/job-failure', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.jobFailure);

router.get('/quality-risk/notification-delivery', authorize({
  anyPermissions: qualityRiskReportPermissions,
}), qualityRiskReportController.notificationDelivery);

const recordsDocumentsReportPermissions = [
  PERMISSION.REPORTS.READ,
  PERMISSION.REPORTS.READ_ALL,
  PERMISSION.REPORTS.MEDICAL_RECORDS_READ,
  PERMISSION.MEDICAL_RECORDS.READ,
  PERMISSION.MEDICAL_RECORDS.READ_DEPARTMENT,
  PERMISSION.MEDICAL_RECORDS.READ_ASSIGNED,
  PERMISSION.MEDICAL_RECORDS.EXPORT,
  PERMISSION.ATTACHMENTS.READ,
  PERMISSION.ATTACHMENTS.READ_DEPARTMENT,
  PERMISSION.ATTACHMENTS.READ_BY_ENTITY,
  PERMISSION.ATTACHMENTS.READ_CLINICAL,
  PERMISSION.DOCUMENTS.TIMELINE_READ,
  PERMISSION.DOCUMENTS.TIMELINE_READ_DEPARTMENT,
  PERMISSION.AUDIT_LOGS.READ,
  PERMISSION.AUDIT_LOGS.READ_ENTITY,
];

router.get('/records-documents/medical-records', authorize({
  anyPermissions: recordsDocumentsReportPermissions,
}), recordsDocumentsReportController.medicalRecords);

router.get('/records-documents/finalized-records', authorize({
  anyPermissions: recordsDocumentsReportPermissions,
}), recordsDocumentsReportController.finalizedRecords);

router.get('/records-documents/released-records', authorize({
  anyPermissions: recordsDocumentsReportPermissions,
}), recordsDocumentsReportController.releasedRecords);

router.get('/records-documents/void-archive', authorize({
  anyPermissions: recordsDocumentsReportPermissions,
}), recordsDocumentsReportController.voidArchive);

router.get('/records-documents/attachments', authorize({
  anyPermissions: recordsDocumentsReportPermissions,
}), recordsDocumentsReportController.attachments);

router.get('/records-documents/exports', authorize({
  anyPermissions: recordsDocumentsReportPermissions,
}), recordsDocumentsReportController.exports);

router.get('/records-documents/timeline', authorize({
  anyPermissions: recordsDocumentsReportPermissions,
}), recordsDocumentsReportController.timeline);

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
