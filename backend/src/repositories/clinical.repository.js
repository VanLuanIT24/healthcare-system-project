const { Allergy, CarePlan, ClinicalNote, Consultation, Diagnosis, Encounter, ProblemList, VitalSign } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  allergyRepository: Allergy,
  carePlanRepository: CarePlan,
  clinicalNoteRepository: ClinicalNote,
  consultationRepository: Consultation,
  diagnosisRepository: Diagnosis,
  encounterRepository: Encounter,
  problemListRepository: ProblemList,
  vitalSignRepository: VitalSign,
});
