import { useState } from 'react';
import {
  ActionCenter,
  AgingBucketChart,
  DataErrorStrip,
  FinanceDataTable,
  FinanceDetailDrawer,
  FinanceFilterBar,
  FinanceHealthScore,
  FinanceInsightGrid,
  FinanceKpiGrid,
  FinanceStatusBadge,
  FinanceTrendChart,
  InvoiceStatusDonut,
  PaymentMethodDonut,
  ReconciliationIssueTable,
  RefundVoidLedger,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  RevenueBreakdownChart,
} from '../components/FinanceComponents';
import {
  useAccountsReceivableReport,
  useArAgingReport,
  useFinanceDashboard,
  useInsuranceReport,
  useInvoiceReport,
  usePaymentMethodReport,
  usePaymentReport,
  useReconciliationReport,
  useRefundVoidReport,
  useRevenueReport,
} from '../hooks/useFinanceReports';
import { financeStatusLabel } from '../utils/financeFormatters';
import { formatCurrency, formatDateTime, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import '../styles/reportsFinance.css';

function rowsOf(value) {
  return value?.items || [];
}

function PageFrame({ query, title, subtitle, exportType, children }) {
  const [drawer, setDrawer] = useState(null);
  if (query.isLoading) return <ReportSkeleton />;
  if (query.error) return <ReportErrorState error={query.error} onRetry={query.refresh} />;
  return (
    <div className="executive-overview-page operation-page finance-page">
      <FinanceFilterBar
        title={title}
        subtitle={subtitle}
        filters={query.filters}
        onChange={query.setFilters}
        onReset={query.resetFilters}
        onRefresh={query.refresh}
        isRefreshing={query.isRefreshing}
        lastUpdatedAt={query.lastUpdatedAt || query.data?.generated_at}
        exportType={exportType}
      />
      <DataErrorStrip errors={query.data?.data_errors} />
      {children(query.data || {}, (item, type = title) => setDrawer({ item, type }), query)}
      <FinanceDetailDrawer item={drawer?.item} type={drawer?.type || title} onClose={() => setDrawer(null)} />
    </div>
  );
}

const invoiceColumns = [
  { key: 'invoice_no', label: 'Invoice no' },
  { key: 'patient_name', label: 'Bệnh nhân', render: (row) => row.patient_name || row.patient_id?.full_name || row.patient_id?.patient_code || '—' },
  { key: 'status', label: 'Trạng thái', render: (row) => <FinanceStatusBadge status={row.status} type="invoice" /> },
  { key: 'subtotal_amount', label: 'Subtotal', money: true, render: (row) => formatCurrency(row.subtotal_amount) },
  { key: 'discount_amount', label: 'Discount', money: true, render: (row) => formatCurrency(row.discount_amount) },
  { key: 'insurance_amount', label: 'Insurance', money: true, render: (row) => formatCurrency(row.insurance_amount) },
  { key: 'tax_amount', label: 'Tax', money: true, render: (row) => formatCurrency(row.tax_amount) },
  { key: 'total_amount', label: 'Total', money: true, render: (row) => formatCurrency(row.total_amount) },
  { key: 'paid_amount', label: 'Paid', money: true, render: (row) => formatCurrency(row.paid_amount) },
  { key: 'balance_due', label: 'Balance', money: true, render: (row) => formatCurrency(row.balance_due) },
  { key: 'issued_at', label: 'Issued at', render: (row) => formatDateTime(row.issued_at) },
  { key: 'days_outstanding', label: 'Ngày nợ', render: (row) => formatNumber(row.days_outstanding) },
];

const paymentColumns = [
  { key: 'payment_no', label: 'Payment no' },
  { key: 'invoice_no', label: 'Invoice', render: (row) => row.invoice_id?.invoice_no || row.invoice_no || '—' },
  { key: 'amount', label: 'Amount', money: true, render: (row) => formatCurrency(row.amount) },
  { key: 'currency', label: 'Currency', render: (row) => row.currency || 'VND' },
  { key: 'payment_method', label: 'Method', render: (row) => financeStatusLabel(row.payment_method, 'method') },
  { key: 'provider', label: 'Provider', render: (row) => row.payment_provider || row.provider || '—' },
  { key: 'transaction_ref', label: 'Transaction ref', render: (row) => row.transaction_ref || row.provider_transaction_id || '—' },
  { key: 'status', label: 'Trạng thái', render: (row) => <FinanceStatusBadge status={row.status} type="payment" /> },
  { key: 'paid_at', label: 'Paid at', render: (row) => formatDateTime(row.paid_at) },
];

const claimColumns = [
  { key: 'claim_no', label: 'Claim no' },
  { key: 'invoice_no', label: 'Invoice', render: (row) => row.invoice_id?.invoice_no || '—' },
  { key: 'payer_name', label: 'Payer', render: (row) => row.policy_id?.payer_name || row.payer_name || '—' },
  { key: 'submitted_amount', label: 'Submitted', money: true, render: (row) => formatCurrency(row.submitted_amount) },
  { key: 'approved_amount', label: 'Approved', money: true, render: (row) => formatCurrency(row.approved_amount) },
  { key: 'paid_amount', label: 'Paid', money: true, render: (row) => formatCurrency(row.paid_amount || row.settled_amount) },
  { key: 'status', label: 'Status', render: (row) => <FinanceStatusBadge status={row.status} type="claim" /> },
  { key: 'submitted_at', label: 'Submitted at', render: (row) => formatDateTime(row.submitted_at) },
];

function TodoPanel({ todos = [] }) {
  if (!todos.length) return null;
  return (
    <ReportSectionCard title="Backend TODO enterprise">
      <ul className="dd-todo-list">
        {todos.map((todo) => <li key={todo}>{todo}</li>)}
      </ul>
    </ReportSectionCard>
  );
}

function FinanceCharts({ data }) {
  return (
    <div className="executive-layout">
      <ReportSectionCard title="Revenue by day"><FinanceTrendChart rows={data.charts?.revenue_by_day || []} /></ReportSectionCard>
      <ReportSectionCard title="Payment by method"><PaymentMethodDonut rows={data.charts?.payment_by_method || []} /></ReportSectionCard>
      <ReportSectionCard title="Invoice by status"><InvoiceStatusDonut rows={data.charts?.invoice_by_status || []} /></ReportSectionCard>
    </div>
  );
}

export function FinanceDashboardPage() {
  const query = useFinanceDashboard();
  return (
    <PageFrame query={query} title="Dashboard tài chính" subtitle="Tổng quan doanh thu, công nợ, hóa đơn, thanh toán và bảo hiểm" exportType="revenue">
      {(data, open) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <FinanceCharts data={data} />
          <div className="executive-layout">
            <ReportSectionCard title="Finance health"><FinanceHealthScore rows={data.finance_health || []} /></ReportSectionCard>
            <ReportSectionCard title="Action center"><ActionCenter data={data} onOpen={open} /></ReportSectionCard>
          </div>
          <div className="executive-layout">
            <ReportSectionCard title="Recent payments"><FinanceDataTable rows={data.payments || []} columns={paymentColumns.slice(0, 6)} onRowClick={(item) => open(item, 'Payment')} /></ReportSectionCard>
            <ReportSectionCard title="Recent invoices"><FinanceDataTable rows={data.invoices || []} columns={invoiceColumns.slice(0, 6)} onRowClick={(item) => open(item, 'Invoice')} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Insight tài chính"><FinanceInsightGrid insights={data.insights || []} /></ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function FinanceRevenuePage() {
  const query = useRevenueReport();
  return (
    <PageFrame query={query} title="Doanh thu" subtitle="Gross charges, invoice issued, paid, outstanding, refund, void và net revenue tạm tính" exportType="revenue">
      {(data, open) => {
        const summary = data.revenue?.summary || {};
        const tableRows = (data.charts?.revenue_by_day || []).map((row) => ({
          ...row,
          gross_charges: summary.gross_charges,
          issued_invoice_amount: summary.issued_invoice_amount,
          outstanding_amount: summary.outstanding_amount,
          refund_amount: summary.refund_amount,
          voided_amount: summary.voided_amount,
          collection_rate: summary.issued_invoice_amount ? (safeNumber(summary.paid_amount) / safeNumber(summary.issued_invoice_amount)) * 100 : 0,
        }));
        return (
          <>
            <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
            <FinanceCharts data={data} />
            <div className="executive-layout">
              <ReportSectionCard title="Revenue by department"><RevenueBreakdownChart rows={data.charts?.revenue_by_department || []} /></ReportSectionCard>
              <ReportSectionCard title="Revenue by service type"><RevenueBreakdownChart rows={data.charts?.revenue_by_service_type || []} /></ReportSectionCard>
            </div>
            <ReportSectionCard title="Bảng doanh thu theo ngày">
              <FinanceDataTable rows={tableRows} onRowClick={(item) => open(item, 'Revenue day')} columns={[
                { key: 'date', label: 'Ngày' },
                { key: 'gross_charges', label: 'Gross charges', money: true, render: (row) => formatCurrency(row.gross_charges) },
                { key: 'issued_invoice_amount', label: 'Invoice issued', money: true, render: (row) => formatCurrency(row.issued_invoice_amount) },
                { key: 'amount', label: 'Paid amount', money: true, render: (row) => formatCurrency(row.amount) },
                { key: 'outstanding_amount', label: 'Outstanding', money: true, render: (row) => formatCurrency(row.outstanding_amount) },
                { key: 'refund_amount', label: 'Refund', money: true, render: (row) => formatCurrency(row.refund_amount) },
                { key: 'voided_amount', label: 'Void', money: true, render: (row) => formatCurrency(row.voided_amount) },
                { key: 'count', label: 'Payment count', render: (row) => formatNumber(row.count) },
                { key: 'collection_rate', label: 'Collection rate', render: (row) => formatPercent(row.collection_rate) },
              ]} />
            </ReportSectionCard>
            <ReportSectionCard title="Insight"><FinanceInsightGrid insights={data.insights || []} /></ReportSectionCard>
          </>
        );
      }}
    </PageFrame>
  );
}

export function AccountsReceivablePage() {
  const query = useAccountsReceivableReport();
  return (
    <PageFrame query={query} title="Công nợ" subtitle="Theo dõi hóa đơn còn phải thu, rủi ro thu tiền và ưu tiên collection" exportType="revenue">
      {(data, open) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Outstanding by status"><InvoiceStatusDonut rows={data.charts?.invoice_by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Aging bucket"><AgingBucketChart rows={data.accounts_receivable?.aging_buckets || []} /></ReportSectionCard>
            <ReportSectionCard title="Nhóm cần thu"><ActionCenter data={data} onOpen={open} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Invoice công nợ">
            <FinanceDataTable rows={data.accounts_receivable?.items || []} columns={invoiceColumns} onRowClick={(item) => open(item, 'Invoice công nợ')} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function ArAgingPage() {
  const query = useArAgingReport();
  return (
    <PageFrame query={query} title="Aging công nợ" subtitle="Bucket công nợ 0-7, 8-15, 16-30, 31-60, 61-90 và trên 90 ngày" exportType="revenue">
      {(data, open) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="finance-aging-grid">
            {(data.accounts_receivable?.aging_buckets || []).map((bucket) => (
              <article key={bucket.bucket} onClick={() => open(bucket, 'Aging bucket')}>
                <span>{bucket.bucket} ngày · {formatNumber(bucket.invoice_count)} invoice</span>
                <strong>{formatCurrency(bucket.outstanding_amount)}</strong>
              </article>
            ))}
          </div>
          <div className="executive-layout">
            <ReportSectionCard title="Bucket theo số tiền"><AgingBucketChart rows={data.accounts_receivable?.aging_buckets || []} /></ReportSectionCard>
            <ReportSectionCard title="Bucket theo số invoice"><RevenueBreakdownChart rows={(data.accounts_receivable?.aging_buckets || []).map((row) => ({ ...row, value: row.invoice_count }))} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Chi tiết invoice aging">
            <FinanceDataTable rows={data.accounts_receivable?.items || []} columns={invoiceColumns} onRowClick={(item) => open(item, 'Invoice aging')} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function FinanceInvoicesPage() {
  const query = useInvoiceReport();
  return (
    <PageFrame query={query} title="Hóa đơn" subtitle="Quản trị invoice lifecycle: draft, issued, paid, partially paid, voided, refunded" exportType="revenue">
      {(data, open, q) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <FinanceCharts data={data} />
          <ReportSectionCard title="Bảng hóa đơn">
            <FinanceDataTable rows={data.invoices || []} columns={invoiceColumns} pagination={data.lists?.invoices?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => open(item, 'Invoice')} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function FinancePaymentsPage() {
  const query = usePaymentReport();
  return (
    <PageFrame query={query} title="Thanh toán" subtitle="Payment, receipt, refund, void và payment intent cần xác nhận" exportType="revenue">
      {(data, open, q) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Payment by status"><PaymentMethodDonut rows={data.charts?.payment_by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Payment by method"><PaymentMethodDonut rows={data.charts?.payment_by_method || []} /></ReportSectionCard>
            <ReportSectionCard title="Payment intents"><ReconciliationIssueTable rows={data.reconciliation || []} onOpen={(item) => open(item, 'Payment intent')} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Bảng thanh toán">
            <FinanceDataTable rows={data.payments || []} columns={paymentColumns} pagination={data.lists?.payments?.pagination} onPageChange={(page) => q.setFilters({ page })} onRowClick={(item) => open(item, 'Payment')} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function PaymentMethodsPage() {
  const query = usePaymentMethodReport();
  return (
    <PageFrame query={query} title="Payment method" subtitle="Phân tích phương thức thanh toán, tỷ trọng, average ticket và provider readiness" exportType="revenue">
      {(data, open) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Amount by method"><PaymentMethodDonut rows={data.payment_methods || []} /></ReportSectionCard>
            <ReportSectionCard title="Bar amount by method"><RevenueBreakdownChart rows={data.payment_methods || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Bảng payment method">
            <FinanceDataTable rows={data.payment_methods || []} onRowClick={(item) => open(item, 'Payment method')} columns={[
              { key: 'label', label: 'Phương thức', render: (row) => financeStatusLabel(row.label, 'method') },
              { key: 'count', label: 'Count', render: (row) => formatNumber(row.count) },
              { key: 'amount', label: 'Amount', money: true, render: (row) => formatCurrency(row.amount) },
              { key: 'share_percent', label: 'Share', render: (row) => formatPercent(row.share_percent) },
              { key: 'average_amount', label: 'Average amount', money: true, render: (row) => formatCurrency(row.average_amount) },
            ]} />
          </ReportSectionCard>
          <ReportSectionCard title="Provider panel">
            <div className="finance-provider-grid">
              {(data.payment_providers || []).length ? data.payment_providers.map((provider) => (
                <article key={provider.key || provider.provider || provider.name} onClick={() => open(provider, 'Payment provider')}>
                  <strong>{provider.name || provider.provider || provider.key}</strong>
                  <span>{provider.method || provider.status || 'provider'}</span>
                </article>
              )) : <ReportEmptyState title="Chưa có provider thanh toán" compact />}
            </div>
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function RefundVoidPage() {
  const query = useRefundVoidReport();
  return (
    <PageFrame query={query} title="Refund / void" subtitle="Ledger thống nhất cho payment refund, payment void, invoice void và charge void" exportType="revenue">
      {(data, open) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Refund/Void by type"><RevenueBreakdownChart rows={data.charts?.refund_void_by_type || []} /></ReportSectionCard>
            <ReportSectionCard title="Risk panel"><FinanceInsightGrid insights={data.insights || []} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Refund / void ledger">
            <RefundVoidLedger rows={data.refund_void_ledger || []} onOpen={(item) => open(item, 'Refund/Void')} />
          </ReportSectionCard>
        </>
      )}
    </PageFrame>
  );
}

export function ReconciliationPage() {
  const query = useReconciliationReport();
  return (
    <PageFrame query={query} title="Đối soát" subtitle="Payment intent, payment, provider status, transaction ref và mismatch queue" exportType="revenue">
      {(data, open) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-kanban">
            {['pending_manual_confirmation', 'warning', 'matched', 'pending', 'rejected'].map((status) => (
              <section key={status} className="executive-kanban__column">
                <header><strong>{status}</strong><span>{(data.reconciliation || []).filter((row) => row.status === status || row.reconciliation_status === status).length}</span></header>
                {(data.reconciliation || []).filter((row) => row.status === status || row.reconciliation_status === status).slice(0, 8).map((row) => (
                  <article key={row._id || row.intent_code} className="executive-task-card" onClick={() => open(row, 'Đối soát')}>
                    <strong>{row.intent_code || row._id}</strong>
                    <p>{formatCurrency(row.amount)} · {row.issue_title || row.reconciliation_status}</p>
                  </article>
                ))}
              </section>
            ))}
          </div>
          <ReportSectionCard title="Bảng đối soát">
            <ReconciliationIssueTable rows={data.reconciliation || []} onOpen={(item) => open(item, 'Payment intent')} />
          </ReportSectionCard>
          <TodoPanel todos={data.backend_todo} />
        </>
      )}
    </PageFrame>
  );
}

export function InsurancePage() {
  const query = useInsuranceReport();
  return (
    <PageFrame query={query} title="Bảo hiểm" subtitle="Claim lifecycle, approval rate, settlement rate, payer và policy status" exportType="revenue">
      {(data, open) => (
        <>
          <FinanceKpiGrid cards={data.summary_cards || []} onOpen={open} />
          <div className="executive-layout">
            <ReportSectionCard title="Claim by status"><PaymentMethodDonut rows={data.charts?.claim_by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Claim amount by status"><RevenueBreakdownChart rows={data.charts?.claim_by_status || []} /></ReportSectionCard>
            <ReportSectionCard title="Insurance KPI"><FinanceHealthScore rows={[
              { key: 'approval', label: 'Approval rate', score: data.insurance_analytics?.approval_rate, status: 'good' },
              { key: 'settlement', label: 'Settlement rate', score: data.insurance_analytics?.settlement_rate, status: 'good' },
            ]} /></ReportSectionCard>
          </div>
          <ReportSectionCard title="Bảng insurance claim">
            <FinanceDataTable rows={data.insurance_claims || []} columns={claimColumns} pagination={data.lists?.insurance_claims?.pagination} onRowClick={(item) => open(item, 'Insurance claim')} />
          </ReportSectionCard>
          <TodoPanel todos={data.backend_todo} />
        </>
      )}
    </PageFrame>
  );
}

