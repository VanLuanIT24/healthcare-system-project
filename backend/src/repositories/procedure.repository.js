const { ProcedureOrder } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  procedureOrderRepository: ProcedureOrder,
});
