const { Admission, BedAssignment, Bed, Room } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  admissionRepository: Admission,
  bedAssignmentRepository: BedAssignment,
  bedRepository: Bed,
  roomRepository: Room,
});
