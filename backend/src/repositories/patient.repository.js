const { PatientAccount, PatientAuthorization, PatientIdentifier, PatientRelative, Patient } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  patientAccountRepository: PatientAccount,
  patientAuthorizationRepository: PatientAuthorization,
  patientIdentifierRepository: PatientIdentifier,
  patientRelativeRepository: PatientRelative,
  patientRepository: Patient,
});
