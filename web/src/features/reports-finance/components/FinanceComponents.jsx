import { useState } from 'react';
import { AlertTriangle, Banknote, CreditCard, FileText, RefreshCw, ShieldCheck, X } from 'lucide-react';
import {
  DataErrorStrip,
  ExecutiveKpiCard,
  ExportReportButton as BaseExportReportButton,
  ReportEmptyState,
  ReportErrorState,
  ReportSectionCard,
  ReportSkeleton,
  TrendChart,
} from '../../reports-overview/components/ExecutiveOverviewComponents';
import { formatByUnit, formatCurrency, formatDateTime, formatNumber, formatPercent, safeNumber } from '../../reports-overview/utils/formatters';
import { financeStatusLabel, financeStatusTone, paymentMethodLabels } from '../utils/financeFormatters';

export { DataErrorStrip, ReportEmptyState, ReportErrorState, ReportSectionCard, ReportSkeleton };

export function FinanceFilterBar({ title, subtitle, filters, onChange, onReset, onRefresh, isRefreshing, lastUpdatedAt, exportType }) {
  const [advanced, setAdvanced] = useState(false);
  const update = (field, value) => onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '' } : {}) });
  return (
    <div className="operation-header finance-header">
      <div>
        <span>Tài chính / Viện phí</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="operation-header__tools">
        {['today', '7d', 'week', 'month', 'quarter', 'custom'].map((range) => (
          <button key={range} type="button" className={filters.range === range ? 'is-active' : ''} onClick={() => update('range', range)}>
            {({ today: 'Hôm nay', '7d': '7 ngày', week: 'Tuần này', month: 'Tháng này', quarter: 'Quý này', custom: 'Custom' })[range]}
          </button>
        ))}
        {filters.range === 'custom' ? (
          <>
            <input type="date" value={filters.date_from || ''} onChange={(event) => update('date_from', event.target.value)} />
            <input type="date" value={filters.date_to || ''} onChange={(event) => update('date_to', event.target.value)} />
          </>
        ) : null}
        <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Khoa" />
        <input value={filters.patient_id || ''} onChange={(event) => update('patient_id', event.target.value)} placeholder="Bệnh nhân" />
        {advanced ? (
          <>
            <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="issued">Invoice issued</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="completed">Payment completed</option>
              <option value="pending_manual_confirmation">Chờ xác nhận</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </select>
            <select value={filters.payment_method || ''} onChange={(event) => update('payment_method', event.target.value)}>
              <option value="">Tất cả phương thức</option>
              {Object.entries(paymentMethodLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <input value={filters.service_type || ''} onChange={(event) => update('service_type', event.target.value)} placeholder="Loại dịch vụ" />
          </>
        ) : null}
        <button type="button" onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Ẩn lọc nâng cao' : 'Lọc nâng cao'}</button>
        <button type="button" onClick={onReset}>Reset bộ lọc</button>
        <button type="button" onClick={onRefresh}><RefreshCw size={15} className={isRefreshing ? 'is-spinning' : ''} />Refresh</button>
        <BaseExportReportButton filters={filters} reportType={exportType || 'revenue'} />
        <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export function FinanceKpiGrid({ cards = [], onOpen }) {
  return (
    <div className="executive-kpi-grid finance-kpi-grid">
      {cards.map((card, index) => (
        <ExecutiveKpiCard key={card.key || card.label} card={card} index={index} onClick={() => onOpen?.(card, 'KPI tài chính')} />
      ))}
    </div>
  );
}

export const FinanceKpiCard = ExecutiveKpiCard;
export const ExportReportButton = BaseExportReportButton;

export function FinanceStatusBadge({ status, type = 'invoice' }) {
  return <span className={`executive-badge status-${financeStatusTone(status)}`}>{financeStatusLabel(status, type)}</span>;
}

export function FinanceTrendChart({ rows = [], series = [{ key: 'amount', label: 'Số tiền' }] }) {
  return <TrendChart data={rows || []} series={series} />;
}

export function RevenueBreakdownChart({ rows = [] }) {
  return <TrendChart data={rows || []} type="bar" />;
}

export function PaymentMethodDonut({ rows = [] }) {
  return <TrendChart data={rows || []} type="donut" />;
}

export const InvoiceStatusDonut = PaymentMethodDonut;
export const AgingBucketChart = RevenueBreakdownChart;

export function FinanceHealthScore({ rows = [] }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu health score" compact />;
  return (
    <div className="finance-health-grid">
      {rows.map((row) => (
        <article key={row.key} className={`status-${row.status || 'neutral'}`}>
          <span>{row.label}</span>
          <strong>{formatPercent(row.score)}</strong>
          <div><i style={{ width: `${Math.min(100, safeNumber(row.score))}%` }} /></div>
        </article>
      ))}
    </div>
  );
}

export function FinanceDataTable({ columns = [], rows = [], onRowClick, pagination, onPageChange }) {
  const [sort, setSort] = useState({ key: columns[0]?.key, direction: 'asc' });
  const sorted = [...(rows || [])].sort((left, right) => {
    const a = left?.[sort.key] ?? '';
    const b = right?.[sort.key] ?? '';
    return sort.direction === 'asc' ? String(a).localeCompare(String(b)) : String(b).localeCompare(String(a));
  });
  if (!rows?.length) return <ReportEmptyState title="Chưa có dữ liệu bảng" />;
  return (
    <div className="finance-table-wrap">
      <table className="executive-table finance-table">
        <thead>
          <tr>{columns.map((column) => (
            <th key={column.key} className={column.money ? 'is-money' : ''}>
              <button type="button" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 'asc' ? 'desc' : 'asc' })}>{column.label}</button>
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={row._id || row.id || row.ref_no || index} onClick={() => onRowClick?.(row)}>
              {columns.map((column) => <td key={column.key} className={column.money ? 'is-money' : ''}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination ? (
        <div className="operation-pagination">
          <button type="button" disabled={(pagination.page || 1) <= 1} onClick={() => onPageChange?.((pagination.page || 1) - 1)}>Trước</button>
          <span>Trang {pagination.page || 1} / {pagination.total_pages || pagination.pages || 1}</span>
          <button type="button" disabled={(pagination.page || 1) >= (pagination.total_pages || pagination.pages || 1)} onClick={() => onPageChange?.((pagination.page || 1) + 1)}>Sau</button>
        </div>
      ) : null}
    </div>
  );
}

export function FinanceDetailDrawer({ item, type = 'Chi tiết tài chính', onClose }) {
  if (!item) return null;
  return (
    <aside className="operation-drawer" aria-label="Chi tiết tài chính">
      <div className="operation-drawer__panel finance-drawer">
        <header>
          <div>
            <span>{type}</span>
            <h2>{item.invoice_no || item.payment_no || item.claim_no || item.charge_no || item.intent_code || item.ref_no || item.label || 'Chi tiết'}</h2>
          </div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="operation-drawer__body">
          {Object.entries(item).slice(0, 34).map(([key, value]) => (
            <div key={key}>
              <span>{key}</span>
              <strong>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</strong>
            </div>
          ))}
        </div>
        <footer>
          <button type="button">Mở module liên quan</button>
          <button type="button">Xem audit</button>
          <button type="button">Xuất dòng này</button>
        </footer>
      </div>
    </aside>
  );
}

export const InvoiceDetailDrawer = FinanceDetailDrawer;
export const PaymentDetailDrawer = FinanceDetailDrawer;
export const ChargeDetailDrawer = FinanceDetailDrawer;
export const InsuranceClaimDrawer = FinanceDetailDrawer;

export function ReconciliationIssueTable({ rows = [], onOpen }) {
  return (
    <FinanceDataTable
      rows={rows}
      onRowClick={onOpen}
      columns={[
        { key: 'intent_code', label: 'Intent code' },
        { key: 'invoice_no', label: 'Invoice' },
        { key: 'amount', label: 'Số tiền', money: true, render: (row) => formatCurrency(row.amount) },
        { key: 'provider', label: 'Provider' },
        { key: 'method', label: 'Method', render: (row) => financeStatusLabel(row.method, 'method') },
        { key: 'status', label: 'Intent status', render: (row) => <FinanceStatusBadge status={row.status} type="payment" /> },
        { key: 'payment_status', label: 'Payment status', render: (row) => <FinanceStatusBadge status={row.payment_status} type="payment" /> },
        { key: 'reconciliation_status', label: 'Đối soát', render: (row) => <FinanceStatusBadge status={row.reconciliation_status} type="payment" /> },
        { key: 'issue_title', label: 'Issue' },
      ]}
    />
  );
}

export function RefundVoidLedger({ rows = [], onOpen }) {
  return (
    <FinanceDataTable
      rows={rows}
      onRowClick={onOpen}
      columns={[
        { key: 'type', label: 'Loại' },
        { key: 'ref_no', label: 'Ref no' },
        { key: 'invoice_no', label: 'Invoice' },
        { key: 'amount', label: 'Số tiền', money: true, render: (row) => formatCurrency(row.amount) },
        { key: 'status', label: 'Trạng thái', render: (row) => <FinanceStatusBadge status={row.status} type="payment" /> },
        { key: 'reason', label: 'Lý do' },
        { key: 'occurred_at', label: 'Thời điểm', render: (row) => formatDateTime(row.occurred_at) },
      ]}
    />
  );
}

export function ReportInsightCard({ insight }) {
  const Icon = insight?.status === 'danger' ? AlertTriangle : insight?.status === 'good' ? ShieldCheck : Banknote;
  if (!insight) return null;
  return (
    <article className={`finance-insight status-${insight.status || 'neutral'}`}>
      <Icon size={18} />
      <div>
        <strong>{insight.title}</strong>
        <p>{insight.description}</p>
      </div>
    </article>
  );
}

export function FinanceInsightGrid({ insights = [] }) {
  if (!insights.length) return <ReportEmptyState title="Chưa có insight tài chính" compact />;
  return <div className="finance-insight-grid">{insights.map((item) => <ReportInsightCard key={item.title} insight={item} />)}</div>;
}

export function ActionCenter({ data = {}, onOpen }) {
  const items = [
    ...(data.accounts_receivable?.items || []).slice(0, 4).map((row) => ({ icon: FileText, title: row.invoice_no || 'Invoice công nợ', description: `${formatCurrency(row.balance_due)} · ${row.days_outstanding} ngày`, item: row, type: 'Invoice công nợ' })),
    ...(data.payment_intents || []).filter((row) => row.status === 'pending_manual_confirmation').slice(0, 4).map((row) => ({ icon: CreditCard, title: row.intent_code || 'Payment intent', description: `${formatCurrency(row.amount)} · chờ xác nhận`, item: row, type: 'Payment intent' })),
    ...(data.insurance_claims || []).filter((row) => ['submitted', 'under_review'].includes(row.status)).slice(0, 4).map((row) => ({ icon: ShieldCheck, title: row.claim_no || 'Insurance claim', description: financeStatusLabel(row.status, 'claim'), item: row, type: 'Insurance claim' })),
  ];
  if (!items.length) return <ReportEmptyState title="Không có việc tài chính cần xử lý ngay" compact />;
  return (
    <div className="finance-action-list">
      {items.map((entry, index) => {
        const Icon = entry.icon;
        return (
          <button key={`${entry.title}-${index}`} type="button" onClick={() => onOpen?.(entry.item, entry.type)}>
            <Icon size={17} />
            <span><strong>{entry.title}</strong><em>{entry.description}</em></span>
          </button>
        );
      })}
    </div>
  );
}

export function formatFinanceValue(value, unit) {
  return formatByUnit(value, unit);
}

