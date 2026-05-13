const { Charge, InsuranceClaim, InsurancePolicy, InvoiceItem, Invoice, Payment, ServiceCatalog } = require('../models');
const { createRepositoryMap } = require('./repository.factory');

module.exports = createRepositoryMap({
  chargeRepository: Charge,
  insuranceClaimRepository: InsuranceClaim,
  insurancePolicyRepository: InsurancePolicy,
  invoiceItemRepository: InvoiceItem,
  invoiceRepository: Invoice,
  paymentRepository: Payment,
  serviceCatalogRepository: ServiceCatalog,
});
