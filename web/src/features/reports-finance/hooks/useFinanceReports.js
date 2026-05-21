import { reportsFinanceApi } from '../api/reportsFinanceApi';
import { useFinanceReport } from './useFinanceFilters';

export const useFinanceDashboard = () => useFinanceReport(reportsFinanceApi.dashboard);
export const useRevenueReport = () => useFinanceReport(reportsFinanceApi.revenue);
export const useAccountsReceivableReport = () => useFinanceReport(reportsFinanceApi.accountsReceivable);
export const useArAgingReport = () => useFinanceReport(reportsFinanceApi.arAging);
export const useInvoiceReport = () => useFinanceReport(reportsFinanceApi.invoices);
export const usePaymentReport = () => useFinanceReport(reportsFinanceApi.payments);
export const usePaymentMethodReport = () => useFinanceReport(reportsFinanceApi.paymentMethods);
export const useRefundVoidReport = () => useFinanceReport(reportsFinanceApi.refundVoid);
export const useReconciliationReport = () => useFinanceReport(reportsFinanceApi.reconciliation);
export const useInsuranceReport = () => useFinanceReport(reportsFinanceApi.insurance);

