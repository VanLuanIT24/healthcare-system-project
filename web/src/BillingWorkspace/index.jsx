import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BillingShell } from './BillingShell';
import { flattenBillingMenu, getBillingPageMeta } from './billingData';
import {
  BillingActivityPage,
  BillingDashboardPage,
  BillingDebtsPage,
  BillingPaymentConfirmationsPage,
  BillingPaymentErrorsPage,
  BillingTasksPage,
  BillingTodayRevenuePage,
  BillingUnpaidInvoicesPage,
} from './BillingOverviewPages';
import {
  CashierCollectPage,
  CashierEWalletPage,
  CashierPartialInvoicesPage,
  CashierQrTransferPage,
  CashierReceiptsPage,
  CashierSearchPage,
  CashierTransferConfirmationPage,
  CashierUnpaidInvoicesPage,
} from './BillingCashierPages';
import { BillingChargesPage, BillingInvoicesPage, BillingPaymentsPage } from './BillingEntityPages';
import {
  InsuranceClaimsPage,
  InsurancePoliciesPage,
  InsuranceSettlementPage,
  InsuranceVerificationPage,
} from './BillingInsurancePages';
import {
  ReceiptDownloadPage,
  ReceiptHistoryPage,
  ReceiptPatientSubmittedPage,
  ReceiptPrintPage,
  ReceiptReprintPage,
} from './BillingReceiptPages';
import {
  PendingRefundsPage,
  ProcessedRefundsPage,
  RefundRequestsPage,
  RefundVoidHistoryPage,
  VoidInvoicePage,
  VoidPaymentPage,
} from './BillingRefundVoidPages';
import {
  ManualPaymentMatchPage,
  PaymentMismatchPage,
  QrTransferReconciliationPage,
  ReconciliationReportPage,
  UnmatchedTransactionsPage,
} from './BillingReconciliationPages';
import {
  ActiveServicesPage,
  DepartmentPriceListPage,
  InactiveServicesPage,
  ServiceCatalogPage,
} from './BillingPriceListPages';
import {
  BillingReportsOverviewPage,
  DepartmentRevenueReportPage,
  ExportReportPage,
  InsuranceReportPage,
  PaymentMethodsReportPage,
  ReceivablesReportPage,
  RefundVoidReportPage,
  RevenueReportPage,
} from './BillingReportPages';
import './billing.css';

const implementedRoutePrefixes = ['overview/', 'cashier/', 'invoices/', 'charges/', 'payments/', 'insurance/', 'receipts/', 'refunds/', 'reconciliation/', 'price-list/', 'reports/'];
const implementedExactRoutes = new Set(['dashboard']);

function hasImplementedPage(routePath) {
  return implementedExactRoutes.has(routePath) || implementedRoutePrefixes.some((prefix) => routePath.startsWith(prefix));
}

const billingRoutes = flattenBillingMenu()
  .map((item) => ({
    ...item,
    routePath: item.to.replace('/billing/', ''),
  }))
  .filter((item) => !hasImplementedPage(item.routePath));

function BillingTitleScreen({ item }) {
  const Icon = item.icon;

  return (
    <section className="billing-title-screen" aria-labelledby="billing-page-title">
      <div className="billing-title-screen__mark" aria-hidden="true">
        <Icon size={30} strokeWidth={2.2} />
      </div>
      <div>
        <span>{item.sectionLabel}</span>
        <h1 id="billing-page-title">{item.label}</h1>
      </div>
    </section>
  );
}

function BillingFallbackScreen() {
  const location = useLocation();
  return <BillingTitleScreen item={getBillingPageMeta(location.pathname)} />;
}

export default function BillingWorkspace() {
  return (
    <BillingShell>
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<BillingDashboardPage />} />
        <Route path="overview/action-items" element={<BillingTasksPage />} />
        <Route path="overview/today-revenue" element={<BillingTodayRevenuePage />} />
        <Route path="overview/pending-invoices" element={<BillingUnpaidInvoicesPage />} />
        <Route path="overview/payment-confirmation-needed" element={<BillingPaymentConfirmationsPage />} />
        <Route path="overview/payment-errors" element={<BillingPaymentErrorsPage />} />
        <Route path="overview/debt" element={<BillingDebtsPage />} />
        <Route path="overview/recent-transactions" element={<BillingActivityPage />} />
        <Route path="cashier/collect" element={<CashierCollectPage />} />
        <Route path="cashier/search-invoice-patient" element={<CashierSearchPage />} />
        <Route path="cashier/unpaid-invoices" element={<CashierUnpaidInvoicesPage />} />
        <Route path="cashier/partial-paid-invoices" element={<CashierPartialInvoicesPage />} />
        <Route path="cashier/qr-bank-transfer" element={<CashierQrTransferPage />} />
        <Route path="cashier/e-wallet" element={<CashierEWalletPage />} />
        <Route path="cashier/transfer-confirmation" element={<CashierTransferConfirmationPage />} />
        <Route path="cashier/print-receipt" element={<CashierReceiptsPage />} />
        <Route path="invoices" element={<Navigate to="/billing/invoices/all" replace />} />
        <Route path="invoices/:view" element={<BillingInvoicesPage />} />
        <Route path="charges" element={<Navigate to="/billing/charges/all" replace />} />
        <Route path="charges/:view" element={<BillingChargesPage />} />
        <Route path="payments" element={<Navigate to="/billing/payments/all" replace />} />
        <Route path="payments/:view" element={<BillingPaymentsPage />} />
        <Route path="receipts" element={<Navigate to="/billing/receipts/print" replace />} />
        <Route path="receipts/print" element={<ReceiptPrintPage />} />
        <Route path="receipts/reprint" element={<ReceiptReprintPage />} />
        <Route path="receipts/download" element={<ReceiptDownloadPage />} />
        <Route path="receipts/patient-submitted" element={<ReceiptPatientSubmittedPage />} />
        <Route path="receipts/sent-to-patient" element={<Navigate to="/billing/receipts/patient-submitted" replace />} />
        <Route path="receipts/history" element={<ReceiptHistoryPage />} />
        <Route path="insurance" element={<Navigate to="/billing/insurance/policies" replace />} />
        <Route path="insurance/policies" element={<InsurancePoliciesPage />} />
        <Route path="insurance/pending-verification" element={<InsuranceVerificationPage />} />
        <Route path="insurance/claims" element={<InsuranceClaimsPage view="all" />} />
        <Route path="insurance/pending-claims" element={<InsuranceClaimsPage view="pending" />} />
        <Route path="insurance/submitted-claims" element={<InsuranceClaimsPage view="submitted" />} />
        <Route path="insurance/reviewing-claims" element={<InsuranceClaimsPage view="reviewing" />} />
        <Route path="insurance/approved-claims" element={<InsuranceClaimsPage view="approved" />} />
        <Route path="insurance/rejected-claims" element={<InsuranceClaimsPage view="rejected" />} />
        <Route path="insurance/settlement" element={<InsuranceSettlementPage />} />
        <Route path="refunds" element={<Navigate to="/billing/refunds/requests" replace />} />
        <Route path="refunds/requests" element={<RefundRequestsPage />} />
        <Route path="refunds/pending" element={<PendingRefundsPage />} />
        <Route path="refunds/processed" element={<ProcessedRefundsPage />} />
        <Route path="refunds/cancel-payment" element={<VoidPaymentPage />} />
        <Route path="refunds/cancel-invoice" element={<VoidInvoicePage />} />
        <Route path="refunds/history" element={<RefundVoidHistoryPage />} />
        <Route path="reconciliation" element={<Navigate to="/billing/reconciliation/qr-transfer" replace />} />
        <Route path="reconciliation/qr-transfer" element={<QrTransferReconciliationPage />} />
        <Route path="reconciliation/manual-match-needed" element={<ManualPaymentMatchPage />} />
        <Route path="reconciliation/payment-mismatch" element={<PaymentMismatchPage />} />
        <Route path="reconciliation/unmatched-transactions" element={<UnmatchedTransactionsPage />} />
        <Route path="reconciliation/report" element={<ReconciliationReportPage />} />
        <Route path="price-list" element={<Navigate to="/billing/price-list/services" replace />} />
        <Route path="price-list/services" element={<ServiceCatalogPage />} />
        <Route path="price-list/by-department" element={<DepartmentPriceListPage />} />
        <Route path="price-list/active-services" element={<ActiveServicesPage />} />
        <Route path="price-list/inactive-services" element={<InactiveServicesPage />} />
        <Route path="reports" element={<Navigate to="/billing/reports/overview" replace />} />
        <Route path="reports/overview" element={<BillingReportsOverviewPage />} />
        <Route path="reports/revenue" element={<RevenueReportPage />} />
        <Route path="reports/debt" element={<ReceivablesReportPage />} />
        <Route path="reports/receivables" element={<ReceivablesReportPage />} />
        <Route path="reports/payment-method" element={<PaymentMethodsReportPage />} />
        <Route path="reports/payment-methods" element={<PaymentMethodsReportPage />} />
        <Route path="reports/by-department" element={<DepartmentRevenueReportPage />} />
        <Route path="reports/departments" element={<DepartmentRevenueReportPage />} />
        <Route path="reports/refund-cancel" element={<RefundVoidReportPage />} />
        <Route path="reports/refunds-voids" element={<RefundVoidReportPage />} />
        <Route path="reports/insurance" element={<InsuranceReportPage />} />
        <Route path="reports/export" element={<ExportReportPage />} />
        {billingRoutes.map((item) => (
          <Route
            key={item.to}
            path={item.routePath}
            element={<BillingTitleScreen item={item} />}
          />
        ))}
        <Route path="*" element={<BillingFallbackScreen />} />
      </Routes>
    </BillingShell>
  );
}
