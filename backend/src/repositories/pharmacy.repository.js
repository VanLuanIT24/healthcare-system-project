const { DispenseItem, Dispense, InventoryTransaction, MedicationAdministration, MedicationMaster, PrescriptionItem, Prescription, StockBatch } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  dispenseItemRepository: DispenseItem,
  dispenseRepository: Dispense,
  inventoryTransactionRepository: InventoryTransaction,
  medicationAdministrationRepository: MedicationAdministration,
  medicationMasterRepository: MedicationMaster,
  prescriptionItemRepository: PrescriptionItem,
  prescriptionRepository: Prescription,
  stockBatchRepository: StockBatch,
});
