const BaseRepository = require('./base.repository');
const repositoryHelpers = require('./repository.helpers');
const repositoryFactory = require('./repository.factory');

module.exports = {
  BaseRepository,
  repositoryHelpers,
  repositoryFactory,
  adminRepository: require('./admin.repository'),
  authRepository: require('./auth.repository'),
  billingRepository: require('./billing.repository'),
  clinicalRepository: require('./clinical.repository'),
  commonRepository: require('./common.repository'),
  iamRepository: require('./iam.repository'),
  imagingRepository: require('./imaging.repository'),
  inpatientRepository: require('./inpatient.repository'),
  laboratoryRepository: require('./laboratory.repository'),
  notificationRepository: require('./notification.repository'),
  orderRepository: require('./order.repository'),
  patientRepository: require('./patient.repository'),
  pharmacyRepository: require('./pharmacy.repository'),
  procedureRepository: require('./procedure.repository'),
  recordsRepository: require('./records.repository'),
  schedulingRepository: require('./scheduling.repository'),
};
