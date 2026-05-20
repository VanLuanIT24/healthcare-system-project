import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  FileSearch,
  FileText,
  Filter,
  Loader2,
  PieChart,
  RefreshCcw,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { billingReportsAPI, getBillingReportErrorMessage } from './billingReportsApi';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

const STATUS_LABELS = {
  draft: 'Nháp',
  issued: 'Đã phát hành',
  partially_paid: 'Thanh toán một phần',
  paid: 'Đã thu',
  voided: 'Đã hủy',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
  refunded_manual: 'Hoàn tiền thủ công',
  pending: 'Chờ xử lý',
  pending_manual_confirmation: 'Chờ xác nhận',
  submitted_receipt: 'Đã gửi biên lai',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
  rejected: 'Từ chối',
  expired: 'Hết hạn',
  requested: 'Đã yêu cầu',
  under_review: 'Đang rà soát',
  approved: 'Đã duyệt',
  partially_approved: 'Duyệt một phần',
  processed: 'Đã xử lý',
  processing: 'Đang xử lý',
  settled: 'Đã quyết toán',
  submitted: 'Đã gửi',
};

const METHOD_LABELS = {
  cash: 'Tiền mặt',
  qr: 'QR',
  qr_manual: 'QR thủ công',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
  insurance: 'Bảo hiểm',
  e_wallet: 'Ví điện tử',
  wallet: 'Ví',
  other: 'Khác',
  unknown: 'Không rõ',
};

const REPORT_TYPES = [
  { value: 'summary', label: 'Tổng quan báo cáo' },
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'receivables', label: 'Công nợ' },
  { value: 'payment_methods', label: 'Phương thức thanh toán' },
  { value: 'departments', label: 'Theo khoa' },
  { value: 'refunds_voids', label: 'Refund / Void' },
  { value: 'insurance', label: 'Bảo hiểm' },
];

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shiftInputDate(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultFilters() {
  const today = todayInputValue();
  return {
    date_from: shiftInputDate(today, -29),
    date_to: today,
    department_id: '',
    payment_method: '',
    provider: '',
    status: '',
    compare_previous: false,
  };
}

function buildParams(filters = {}) {
  return {
    date_from: filters.date_from ? `${filters.date_from}T00:00:00` : undefined,
    date_to: filters.date_to ? `${filters.date_to}T23:59:59.999` : undefined,
    department_id: filters.department_id || undefined,
    payment_method: filters.payment_method || undefined,
    provider: filters.provider || undefined,
    status: filters.status || undefined,
    timezone: 'Asia/Ho_Chi_Minh',
    compare_previous: filters.compare_previous ? 'true' : undefined,
  };
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatPercent(value) {
  return `${formatNumber(Number(value || 0))}%`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN');
}

function labelStatus(status) {
  return STATUS_LABELS[status] || status || '-';
}

function labelMethod(method) {
  return METHOD_LABELS[method] || method || '-';
}

function patientName(value) {
  if (!value) return '-';
  if (typeof value === 'string') return value;
  return value.full_name || value.patient_name || value.patient_code || '-';
}

function patientCode(value) {
  if (!value || typeof value === 'string') return '';
  return [value.patient_code, value.phone].filter(Boolean).join(' · ');
}

function statusTone(status = '') {
  if (['paid', 'completed', 'confirmed', 'settled', 'approved', 'processed'].includes(status)) return 'success';
  if (['failed', 'rejected', 'expired', 'cancelled', 'voided'].includes(status)) return 'danger';
  if (['partially_paid', 'pending', 'pending_manual_confirmation', 'submitted_receipt', 'under_review', 'requested', 'processing'].includes(status)) return 'warning';
  return 'info';
}

function StatusBadge({ status }) {
  return <span className={`brep-status brep-status--${statusTone(status)}`}>{labelStatus(status)}</span>;
}

function useReportData(loader, params) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loader(params)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error: getBillingReportErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [loader, key, version]);

  return { ...state, refresh: () => setVersion((current) => current + 1) };
}

function useReportFilters() {
  return useState(() => defaultFilters());
}

function applyQuickRange(setFilters, days) {
  const today = todayInputValue();
  setFilters((current) => ({
    ...current,
    date_from: shiftInputDate(today, -(days - 1)),
    date_to: today,
  }));
}

function ReportFrame({ title, kicker, filters, setFilters, loading, error, onRefresh, exportType, children, rail }) {
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState('');

  async function handleExport(format = 'csv') {
    setExporting(true);
    setExportNote('');
    try {
      const result = await billingReportsAPI.export({
        ...buildParams(filters),
        report_type: exportType,
        format,
      });
      const content = result.content || JSON.stringify(result.data || result, null, 2);
      const blob = new Blob([content], { type: result.content_type || 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename || `billing_${exportType}.${format === 'json' ? 'json' : 'csv'}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportNote(result.note || 'Đã tạo file export.');
    } catch (error) {
      setExportNote(getBillingReportErrorMessage(error, 'Export thất bại.'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="billing-report-page">
      <header className="brep-header">
        <div>
          <span>{kicker}</span>
          <h1>{title}</h1>
        </div>
        <div className="brep-header__actions">
          <button type="button" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="brep-spin" size={17} /> : <RefreshCcw size={17} />}
            <span>Làm mới</span>
          </button>
          <button type="button" onClick={() => handleExport('csv')} disabled={exporting}>
            <Download size={17} />
            <span>CSV</span>
          </button>
          <button type="button" onClick={() => handleExport('json')} disabled={exporting}>
            <FileText size={17} />
            <span>JSON</span>
          </button>
        </div>
      </header>

      <div className="brep-filter-bar">
        <div className="brep-filter-bar__group">
          <CalendarDays size={17} />
          <input
            type="date"
            value={filters.date_from}
            onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
            aria-label="Từ ngày"
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))}
            aria-label="Đến ngày"
          />
        </div>
        <div className="brep-segmented" aria-label="Chọn nhanh khoảng ngày">
          <button type="button" onClick={() => applyQuickRange(setFilters, 1)}>Hôm nay</button>
          <button type="button" onClick={() => applyQuickRange(setFilters, 7)}>7 ngày</button>
          <button type="button" onClick={() => applyQuickRange(setFilters, 30)}>30 ngày</button>
        </div>
        <label className="brep-field">
          <Filter size={15} />
          <input
            value={filters.department_id}
            onChange={(event) => setFilters((current) => ({ ...current, department_id: event.target.value }))}
            placeholder="Department ID"
            aria-label="Department ID"
          />
        </label>
        <select
          value={filters.payment_method}
          onChange={(event) => setFilters((current) => ({ ...current, payment_method: event.target.value }))}
          aria-label="Phương thức thanh toán"
        >
          <option value="">Mọi phương thức</option>
          <option value="cash">Tiền mặt</option>
          <option value="qr">QR</option>
          <option value="bank_transfer">Chuyển khoản</option>
          <option value="card">Thẻ</option>
          <option value="insurance">Bảo hiểm</option>
          <option value="e_wallet">Ví điện tử</option>
        </select>
        <label className="brep-field">
          <SlidersHorizontal size={15} />
          <input
            value={filters.provider}
            onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))}
            placeholder="Provider"
            aria-label="Provider"
          />
        </label>
      </div>

      {exportNote ? <div className="brep-export-note">{exportNote}</div> : null}
      {error ? (
        <div className="brep-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="brep-layout">
        <div className="brep-layout__main">
          {children}
        </div>
        {rail ? <aside className="brep-rail">{rail}</aside> : null}
      </div>
    </section>
  );
}

function KpiGrid({ items = [] }) {
  return (
    <div className="brep-kpi-grid">
      {items.map((item) => {
        const Icon = item.icon || BarChart3;
        return (
          <article key={item.label} className={`brep-kpi brep-kpi--${item.tone || 'blue'}`}>
            <span className="brep-kpi__icon"><Icon size={19} /></span>
            <div>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
              <span>{item.meta}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ChartPanel({ title, icon: Icon = BarChart3, children, action }) {
  return (
    <section className="brep-panel">
      <header>
        <div>
          <Icon size={18} />
          <strong>{title}</strong>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ label = 'Chưa có dữ liệu.' }) {
  return (
    <div className="brep-empty">
      <FileSearch size={26} />
      <span>{label}</span>
    </div>
  );
}

function BarList({ rows = [], labelKey, valueKey = 'amount', valueFormatter = formatMoney, maxRows = 8 }) {
  const selected = rows.slice(0, maxRows);
  const max = Math.max(...selected.map((row) => Number(row[valueKey] || 0)), 0);
  if (!selected.length) return <EmptyState />;

  return (
    <div className="brep-bars">
      {selected.map((row, index) => {
        const label = typeof labelKey === 'function' ? labelKey(row) : row[labelKey];
        const value = Number(row[valueKey] || 0);
        const width = max ? `${Math.max((value / max) * 100, 4)}%` : '4%';
        return (
          <div key={`${label || index}-${index}`} className="brep-bar-row">
            <div className="brep-bar-row__label">
              <span>{label || 'Không rõ'}</span>
              <strong>{valueFormatter(value)}</strong>
            </div>
            <span className="brep-bar-row__track">
              <i style={{ width }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Funnel({ rows = {} }) {
  const entries = Object.entries(rows).map(([key, value]) => ({
    key,
    label: labelStatus(key),
    count: Number(value?.count || value || 0),
    amount: Number(value?.amount || 0),
  }));
  const max = Math.max(...entries.map((entry) => entry.count), 0);
  if (!entries.length) return <EmptyState />;

  return (
    <div className="brep-funnel">
      {entries.map((entry) => (
        <div key={entry.key}>
          <span>{entry.label}</span>
          <strong>{formatNumber(entry.count)}</strong>
          <i style={{ width: max ? `${Math.max((entry.count / max) * 100, 7)}%` : '7%' }} />
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns = [], rows = [], emptyLabel }) {
  if (!rows.length) return <EmptyState label={emptyLabel} />;
  return (
    <div className="brep-table-wrap">
      <table className="brep-table">
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row._id || row.id || row.invoice_no || row.payment_no || row.claim_no || rowIndex}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : row[column.key] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsightRail({ alerts = [], actions = [] }) {
  const navigate = useNavigate();
  const actionRoutes = {
    open_receivables: '/billing/reports/debt',
    open_payment_methods: '/billing/reports/payment-method',
    open_refunds: '/billing/reports/refund-cancel',
    open_insurance: '/billing/reports/insurance',
  };

  return (
    <>
      <section className="brep-rail-section">
        <header>
          <AlertTriangle size={17} />
          <strong>Cảnh báo</strong>
        </header>
        <div className="brep-alert-list">
          {alerts.length ? alerts.map((alert) => (
            <button key={alert.title} type="button" onClick={() => actionRoutes[alert.action] && navigate(actionRoutes[alert.action])}>
              <span className={`brep-alert-dot brep-alert-dot--${alert.severity || 'info'}`} />
              <span>{alert.title}</span>
              <strong>{typeof alert.value === 'number' && alert.value > 1000 ? formatMoney(alert.value) : formatNumber(alert.value)}</strong>
            </button>
          )) : <EmptyState label="Không có cảnh báo." />}
        </div>
      </section>
      <section className="brep-rail-section">
        <header>
          <CheckCircle2 size={17} />
          <strong>Hàng đợi</strong>
        </header>
        <div className="brep-action-list">
          {actions.map((action) => (
            <div key={action.key}>
              <span>{action.label}</span>
              <strong>{formatNumber(action.count)}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function OverviewReportPage() {
  const [filters, setFilters] = useReportFilters();
  const params = useMemo(() => buildParams(filters), [filters]);
  const report = useReportData(billingReportsAPI.summary, params);
  const data = report.data || {};

  return (
    <ReportFrame
      title="Tổng quan báo cáo viện phí"
      kicker="Billing intelligence"
      filters={filters}
      setFilters={setFilters}
      loading={report.loading}
      error={report.error}
      onRefresh={report.refresh}
      exportType="summary"
      rail={<InsightRail alerts={data.alerts || []} actions={data.pending_actions || []} />}
    >
      <KpiGrid items={(data.cards || []).map((card, index) => ({
        label: card.label,
        value: card.type === 'money' ? formatMoney(card.value) : card.type === 'percent' ? formatPercent(card.value) : formatNumber(card.value),
        meta: index < 4 ? 'Kỳ đang chọn' : 'Toàn bộ backlog',
        icon: [WalletCards, ReceiptTextIcon, Banknote, TrendingUp, Clock3, ShieldCheck, PieChart, SlidersHorizontal][index] || BarChart3,
        tone: ['blue', 'green', 'teal', 'amber', 'rose', 'violet', 'blue', 'amber'][index],
      }))} />
      <div className="brep-chart-grid">
        <ChartPanel title="Thực thu theo ngày" icon={TrendingUp}>
          <BarList rows={data.trends?.revenue_by_day || []} labelKey="date" valueKey="paid_amount" />
        </ChartPanel>
        <ChartPanel title="Phương thức thanh toán" icon={PieChart}>
          <BarList rows={data.trends?.payment_by_method || []} labelKey={(row) => labelMethod(row.payment_method)} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Aging công nợ" icon={Clock3}>
          <BarList rows={data.trends?.receivable_aging || []} labelKey="bucket" valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Claim bảo hiểm" icon={ShieldCheck}>
          <BarList rows={data.trends?.claim_by_status || []} labelKey={(row) => labelStatus(row.status)} valueKey="amount" />
        </ChartPanel>
      </div>
    </ReportFrame>
  );
}

function ReceiptTextIcon(props) {
  return <FileText {...props} />;
}

export function RevenueReportPage() {
  const [filters, setFilters] = useReportFilters();
  const params = useMemo(() => buildParams(filters), [filters]);
  const report = useReportData(billingReportsAPI.revenue, params);
  const data = report.data || {};
  const summary = data.summary || {};

  return (
    <ReportFrame title="Báo cáo doanh thu" kicker="Revenue command" filters={filters} setFilters={setFilters} loading={report.loading} error={report.error} onRefresh={report.refresh} exportType="revenue">
      <KpiGrid items={[
        { label: 'Charge phát sinh', value: formatMoney(summary.gross_charges), meta: `${formatNumber(summary.charge_count)} charge`, icon: WalletCards, tone: 'blue' },
        { label: 'Hóa đơn phát hành', value: formatMoney(summary.issued_invoice_amount), meta: `${formatNumber(summary.invoice_count)} invoice`, icon: FileText, tone: 'violet' },
        { label: 'Thực thu', value: formatMoney(summary.paid_amount), meta: `${formatNumber(summary.payment_count)} payment`, icon: Banknote, tone: 'green' },
        { label: 'Công nợ', value: formatMoney(summary.outstanding_amount), meta: formatPercent(summary.outstanding_rate), icon: Clock3, tone: 'amber' },
        { label: 'Refund', value: formatMoney(summary.refund_amount), meta: 'Theo ngày refund', icon: RotateCcw, tone: 'rose' },
        { label: 'Void', value: formatMoney(summary.voided_amount), meta: 'Theo ngày void', icon: AlertTriangle, tone: 'danger' },
        { label: 'Net revenue', value: formatMoney(summary.net_revenue), meta: formatPercent(summary.collection_rate), icon: TrendingUp, tone: 'teal' },
        { label: 'Tỷ lệ invoice', value: formatPercent(summary.charge_to_invoice_rate), meta: 'Invoice / charge', icon: ArrowUpRight, tone: 'blue' },
      ]} />
      <div className="brep-chart-grid">
        <ChartPanel title="Thực thu theo ngày" icon={TrendingUp}>
          <BarList rows={data.breakdowns?.revenue_by_day || []} labelKey="date" valueKey="paid_amount" />
        </ChartPanel>
        <ChartPanel title="Charge theo ngày" icon={BarChart3}>
          <BarList rows={data.breakdowns?.charge_by_day || []} labelKey="date" valueKey="gross_charges" />
        </ChartPanel>
        <ChartPanel title="Payment method" icon={PieChart}>
          <BarList rows={data.breakdowns?.payment_by_method || []} labelKey={(row) => labelMethod(row.payment_method)} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Invoice status" icon={FileText}>
          <BarList rows={data.breakdowns?.invoice_by_status || []} labelKey={(row) => labelStatus(row.status)} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Theo khoa" icon={BarChart3}>
          <BarList rows={data.breakdowns?.revenue_by_department || []} labelKey={(row) => row.department_name || row.department_code} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Theo loại dịch vụ" icon={FileSearch}>
          <BarList rows={data.breakdowns?.revenue_by_service_type || []} labelKey="service_type" valueKey="amount" />
        </ChartPanel>
      </div>
      <ChartPanel title="Invoice giá trị cao" icon={FileText}>
        <DataTable rows={data.top_lists?.top_invoices_by_amount || []} columns={[
          { key: 'invoice_no', label: 'Invoice' },
          { key: 'patient', label: 'Bệnh nhân', render: (row) => <><strong>{patientName(row.patient_id)}</strong><small>{patientCode(row.patient_id)}</small></> },
          { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'total_amount', label: 'Tổng tiền', render: (row) => formatMoney(row.total_amount) },
          { key: 'paid_amount', label: 'Đã thu', render: (row) => formatMoney(row.paid_amount) },
          { key: 'balance_due', label: 'Còn nợ', render: (row) => formatMoney(row.balance_due) },
        ]} />
      </ChartPanel>
    </ReportFrame>
  );
}

export function ReceivablesReportPage() {
  const [filters, setFilters] = useReportFilters();
  const params = useMemo(() => buildParams(filters), [filters]);
  const report = useReportData(billingReportsAPI.receivables, params);
  const data = report.data || {};
  const summary = data.summary || {};

  return (
    <ReportFrame title="Báo cáo công nợ" kicker="Receivables aging" filters={filters} setFilters={setFilters} loading={report.loading} error={report.error} onRefresh={report.refresh} exportType="receivables">
      <KpiGrid items={[
        { label: 'Tổng công nợ', value: formatMoney(summary.total_outstanding), meta: `${formatNumber(summary.invoice_count)} invoice`, icon: Clock3, tone: 'amber' },
        { label: 'Quá hạn', value: formatMoney(summary.overdue_amount), meta: `${formatNumber(summary.overdue_invoice_count)} invoice`, icon: AlertTriangle, tone: 'danger' },
        { label: 'Bảo hiểm', value: formatMoney(summary.insurance_receivable), meta: 'Phải thu BH', icon: ShieldCheck, tone: 'violet' },
        { label: 'Bệnh nhân tự trả', value: formatMoney(summary.patient_receivable), meta: 'Patient AR', icon: WalletCards, tone: 'blue' },
        { label: 'Ngày nợ TB', value: formatNumber(summary.average_days_outstanding), meta: 'Days outstanding', icon: CalendarDays, tone: 'teal' },
        { label: 'Tỷ lệ đã thu', value: formatPercent(summary.collection_rate), meta: 'Paid / invoice', icon: TrendingUp, tone: 'green' },
      ]} />
      <div className="brep-chart-grid">
        <ChartPanel title="Aging bucket" icon={Clock3}>
          <BarList rows={data.aging || []} labelKey="bucket" valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Công nợ theo khoa" icon={BarChart3}>
          <BarList rows={data.breakdowns?.by_department || []} labelKey={(row) => row.department_name || row.department_code} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Trạng thái invoice" icon={PieChart}>
          <BarList rows={data.breakdowns?.by_status || []} labelKey={(row) => labelStatus(row.status)} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Top bệnh nhân còn nợ" icon={WalletCards}>
          <BarList rows={data.breakdowns?.top_patients || []} labelKey={(row) => row.patient_name || row.patient_code} valueKey="amount" />
        </ChartPanel>
      </div>
      <ChartPanel title="Danh sách invoice cần follow-up" icon={FileText}>
        <DataTable rows={data.items || []} columns={[
          { key: 'invoice_no', label: 'Invoice' },
          { key: 'patient', label: 'Bệnh nhân', render: (row) => <><strong>{patientName(row.patient_id)}</strong><small>{patientCode(row.patient_id)}</small></> },
          { key: 'issued_at', label: 'Phát hành', render: (row) => formatDate(row.issued_at) },
          { key: 'due_at', label: 'Đến hạn', render: (row) => formatDate(row.due_at) },
          { key: 'age_days', label: 'Tuổi nợ', render: (row) => `${formatNumber(row.age_days)} ngày` },
          { key: 'overdue_days', label: 'Quá hạn', render: (row) => row.overdue_days ? `${formatNumber(row.overdue_days)} ngày` : '-' },
          { key: 'balance_due', label: 'Còn nợ', render: (row) => formatMoney(row.balance_due) },
          { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status} /> },
        ]} />
      </ChartPanel>
    </ReportFrame>
  );
}

export function PaymentMethodsReportPage() {
  const [filters, setFilters] = useReportFilters();
  const params = useMemo(() => buildParams(filters), [filters]);
  const report = useReportData(billingReportsAPI.paymentMethods, params);
  const data = report.data || {};
  const summary = data.summary || {};

  return (
    <ReportFrame title="Báo cáo phương thức thanh toán" kicker="Payment channel performance" filters={filters} setFilters={setFilters} loading={report.loading} error={report.error} onRefresh={report.refresh} exportType="payment_methods">
      <KpiGrid items={[
        { label: 'Tổng thực thu', value: formatMoney(summary.total_collected), meta: `${formatNumber(summary.payment_count)} giao dịch`, icon: CreditCard, tone: 'green' },
        { label: 'Hoàn tất', value: formatNumber(summary.completed_count), meta: formatPercent(summary.success_rate), icon: CheckCircle2, tone: 'teal' },
        { label: 'Failed / rejected', value: formatNumber(summary.failed_rejected_count), meta: 'Cần xử lý', icon: AlertTriangle, tone: 'danger' },
        { label: 'Manual review', value: formatNumber(summary.manual_review_count), meta: 'Queue', icon: SlidersHorizontal, tone: 'amber' },
        { label: 'Refunded', value: formatMoney(summary.refunded_amount), meta: 'Payment status', icon: RotateCcw, tone: 'rose' },
        { label: 'Xác nhận TB', value: `${formatNumber(summary.avg_confirmation_minutes)} phút`, meta: 'Confirmation lag', icon: Clock3, tone: 'blue' },
      ]} />
      <div className="brep-chart-grid">
        <ChartPanel title="Amount by method" icon={PieChart}>
          <BarList rows={data.methods || []} labelKey={(row) => `${labelMethod(row.payment_method)} · ${row.provider}`} valueKey="completed_amount" />
        </ChartPanel>
        <ChartPanel title="Intent funnel" icon={TrendingUp}>
          <Funnel rows={data.funnel || {}} />
        </ChartPanel>
        <ChartPanel title="Payment time series" icon={BarChart3}>
          <BarList rows={data.breakdowns?.time_series || []} labelKey={(row) => `${row.date} · ${labelMethod(row.payment_method)}`} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Provider status" icon={SlidersHorizontal}>
          <BarList rows={data.breakdowns?.provider_status || []} labelKey={(row) => `${row.provider} · ${labelStatus(row.status)}`} valueKey="count" valueFormatter={formatNumber} />
        </ChartPanel>
      </div>
      <ChartPanel title="So sánh phương thức" icon={CreditCard}>
        <DataTable rows={data.methods || []} columns={[
          { key: 'payment_method', label: 'Method', render: (row) => labelMethod(row.payment_method) },
          { key: 'provider', label: 'Provider' },
          { key: 'completed_amount', label: 'Completed', render: (row) => formatMoney(row.completed_amount) },
          { key: 'payment_count', label: 'Count', render: (row) => formatNumber(row.payment_count) },
          { key: 'pending_count', label: 'Pending', render: (row) => formatNumber(row.pending_count) },
          { key: 'failed_count', label: 'Failed', render: (row) => formatNumber(row.failed_count + row.rejected_count) },
          { key: 'success_rate', label: 'Success', render: (row) => formatPercent(row.success_rate) },
          { key: 'avg_confirmation_minutes', label: 'Confirm', render: (row) => `${formatNumber(row.avg_confirmation_minutes)} phút` },
        ]} />
      </ChartPanel>
    </ReportFrame>
  );
}

export function DepartmentRevenueReportPage() {
  const [filters, setFilters] = useReportFilters();
  const params = useMemo(() => buildParams(filters), [filters]);
  const report = useReportData(billingReportsAPI.departments, params);
  const data = report.data || {};
  const summary = data.summary || {};

  return (
    <ReportFrame title="Báo cáo theo khoa" kicker="Department revenue" filters={filters} setFilters={setFilters} loading={report.loading} error={report.error} onRefresh={report.refresh} exportType="departments">
      <KpiGrid items={[
        { label: 'Tổng charge', value: formatMoney(summary.gross_charges), meta: `${formatNumber(summary.charge_count)} charge`, icon: WalletCards, tone: 'blue' },
        { label: 'Hóa đơn', value: formatMoney(summary.issued_amount), meta: `${formatNumber(summary.invoice_count)} invoice`, icon: FileText, tone: 'violet' },
        { label: 'Thực thu', value: formatMoney(summary.paid_amount), meta: `${formatNumber(summary.payment_count)} payment`, icon: Banknote, tone: 'green' },
        { label: 'Công nợ', value: formatMoney(summary.outstanding_amount), meta: formatPercent(100 - Number(summary.collection_rate || 0)), icon: Clock3, tone: 'amber' },
        { label: 'Refund / void', value: formatMoney(summary.refund_void_amount), meta: 'Risk amount', icon: RotateCcw, tone: 'rose' },
        { label: 'Khoa có dữ liệu', value: formatNumber(summary.department_count), meta: formatPercent(summary.collection_rate), icon: BarChart3, tone: 'teal' },
      ]} />
      <div className="brep-chart-grid">
        <ChartPanel title="Thực thu theo khoa" icon={BarChart3}>
          <BarList rows={data.departments || []} labelKey={(row) => row.department_name || row.department_code} valueKey="paid_amount" />
        </ChartPanel>
        <ChartPanel title="Công nợ theo khoa" icon={Clock3}>
          <BarList rows={data.departments || []} labelKey={(row) => row.department_name || row.department_code} valueKey="outstanding_amount" />
        </ChartPanel>
      </div>
      <ChartPanel title="Leaderboard khoa" icon={TrendingUp}>
        <DataTable rows={data.departments || []} columns={[
          { key: 'department_name', label: 'Khoa', render: (row) => <><strong>{row.department_name}</strong><small>{row.department_code || row.department_id}</small></> },
          { key: 'charge_count', label: 'Charge', render: (row) => formatNumber(row.charge_count) },
          { key: 'gross_charges', label: 'Gross', render: (row) => formatMoney(row.gross_charges) },
          { key: 'invoice_count', label: 'Invoice', render: (row) => formatNumber(row.invoice_count) },
          { key: 'issued_amount', label: 'Issued', render: (row) => formatMoney(row.issued_amount) },
          { key: 'paid_amount', label: 'Paid', render: (row) => formatMoney(row.paid_amount) },
          { key: 'outstanding_amount', label: 'AR', render: (row) => formatMoney(row.outstanding_amount) },
          { key: 'collection_rate', label: 'Collection', render: (row) => formatPercent(row.collection_rate) },
        ]} />
      </ChartPanel>
    </ReportFrame>
  );
}

export function RefundVoidReportPage() {
  const [filters, setFilters] = useReportFilters();
  const params = useMemo(() => buildParams(filters), [filters]);
  const report = useReportData(billingReportsAPI.refundsVoids, params);
  const data = report.data || {};
  const summary = data.summary || {};
  const refunds = data.items?.refunds || [];

  return (
    <ReportFrame title="Báo cáo Refund / Void" kicker="Financial risk control" filters={filters} setFilters={setFilters} loading={report.loading} error={report.error} onRefresh={report.refresh} exportType="refunds_voids">
      <KpiGrid items={[
        { label: 'Refund request', value: formatMoney(summary.requested_amount), meta: `${formatNumber(summary.refund_request_count)} yêu cầu`, icon: RotateCcw, tone: 'rose' },
        { label: 'Approved', value: formatMoney(summary.approved_amount), meta: 'Đã duyệt', icon: CheckCircle2, tone: 'green' },
        { label: 'Processed', value: formatMoney(summary.processed_amount), meta: 'Đã xử lý', icon: Banknote, tone: 'teal' },
        { label: 'Pending', value: formatNumber(summary.pending_refund_count), meta: 'Queue', icon: Clock3, tone: 'amber' },
        { label: 'Voided payment', value: formatMoney(summary.voided_payment_amount), meta: `${formatNumber(summary.voided_payment_count)} payment`, icon: AlertTriangle, tone: 'danger' },
        { label: 'Risk score TB', value: formatNumber(summary.avg_risk_score), meta: 'Refund risk', icon: SlidersHorizontal, tone: 'blue' },
      ]} />
      <div className="brep-chart-grid">
        <ChartPanel title="Refund status" icon={PieChart}>
          <BarList rows={data.breakdowns?.refund_by_status || []} labelKey={(row) => labelStatus(row.refund_status)} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Lý do refund" icon={FileSearch}>
          <BarList rows={data.breakdowns?.refund_by_reason || []} labelKey="reason_category" valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Risk flags" icon={AlertTriangle}>
          <BarList rows={data.breakdowns?.risk_flags || []} labelKey="risk_flag" valueKey="count" valueFormatter={formatNumber} />
        </ChartPanel>
      </div>
      <ChartPanel title="Refund workflow" icon={RotateCcw}>
        <DataTable rows={refunds} columns={[
          { key: 'refund_no', label: 'Refund' },
          { key: 'patient', label: 'Bệnh nhân', render: (row) => <><strong>{patientName(row.patient_id)}</strong><small>{patientCode(row.patient_id)}</small></> },
          { key: 'payment', label: 'Payment', render: (row) => row.payment_id?.payment_no || '-' },
          { key: 'requested_amount', label: 'Request', render: (row) => formatMoney(row.requested_amount) },
          { key: 'processed_amount', label: 'Processed', render: (row) => formatMoney(row.processed_amount) },
          { key: 'refund_status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.refund_status} /> },
          { key: 'risk_score', label: 'Risk', render: (row) => formatNumber(row.risk_score) },
          { key: 'requested_at', label: 'Ngày yêu cầu', render: (row) => formatDate(row.requested_at || row.created_at) },
        ]} />
      </ChartPanel>
    </ReportFrame>
  );
}

export function InsuranceReportPage() {
  const [filters, setFilters] = useReportFilters();
  const params = useMemo(() => buildParams(filters), [filters]);
  const report = useReportData(billingReportsAPI.insurance, params);
  const data = report.data || {};
  const summary = data.summary || {};

  return (
    <ReportFrame title="Báo cáo bảo hiểm" kicker="Insurance receivables" filters={filters} setFilters={setFilters} loading={report.loading} error={report.error} onRefresh={report.refresh} exportType="insurance">
      <KpiGrid items={[
        { label: 'Tổng claim', value: formatNumber(summary.claim_count), meta: 'Claim count', icon: ShieldCheck, tone: 'violet' },
        { label: 'Submitted', value: formatMoney(summary.submitted_amount), meta: 'Đề nghị', icon: FileText, tone: 'blue' },
        { label: 'Approved', value: formatMoney(summary.approved_amount), meta: formatPercent(summary.approval_rate), icon: CheckCircle2, tone: 'green' },
        { label: 'Settled', value: formatMoney(summary.paid_amount), meta: formatPercent(summary.settlement_rate), icon: Banknote, tone: 'teal' },
        { label: 'Insurance AR', value: formatMoney(summary.insurance_receivable), meta: 'Approved - paid', icon: Clock3, tone: 'amber' },
        { label: 'Reject rate', value: formatPercent(summary.rejection_rate), meta: `${formatNumber(summary.average_settlement_days)} ngày settle`, icon: AlertTriangle, tone: 'rose' },
      ]} />
      <div className="brep-chart-grid">
        <ChartPanel title="Claim status" icon={PieChart}>
          <BarList rows={data.breakdowns?.by_status || []} labelKey={(row) => labelStatus(row.status)} valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Payer performance" icon={ShieldCheck}>
          <BarList rows={data.breakdowns?.by_payer || []} labelKey="payer_name" valueKey="submitted_amount" />
        </ChartPanel>
        <ChartPanel title="Claim aging" icon={Clock3}>
          <BarList rows={data.breakdowns?.aging || []} labelKey="bucket" valueKey="amount" />
        </ChartPanel>
        <ChartPanel title="Theo khoa" icon={BarChart3}>
          <BarList rows={data.breakdowns?.by_department || []} labelKey={(row) => row.department_name || row.department_code} valueKey="amount" />
        </ChartPanel>
      </div>
      <ChartPanel title="Claim detail" icon={ShieldCheck}>
        <DataTable rows={data.items || []} columns={[
          { key: 'claim_no', label: 'Claim' },
          { key: 'patient', label: 'Bệnh nhân', render: (row) => <><strong>{patientName(row.patient_id)}</strong><small>{patientCode(row.patient_id)}</small></> },
          { key: 'payer', label: 'Payer', render: (row) => <><strong>{row.policy_id?.payer_name || '-'}</strong><small>{row.policy_id?.policy_no || ''}</small></> },
          { key: 'invoice', label: 'Invoice', render: (row) => row.invoice_id?.invoice_no || '-' },
          { key: 'submitted_amount', label: 'Submitted', render: (row) => formatMoney(row.submitted_amount) },
          { key: 'approved_amount', label: 'Approved', render: (row) => formatMoney(row.approved_amount) },
          { key: 'paid_amount', label: 'Settled', render: (row) => formatMoney(row.paid_amount) },
          { key: 'status', label: 'Trạng thái', render: (row) => <StatusBadge status={row.status} /> },
        ]} />
      </ChartPanel>
    </ReportFrame>
  );
}

export function ExportReportPage() {
  const [filters, setFilters] = useReportFilters();
  const [reportType, setReportType] = useState('revenue');
  const [format, setFormat] = useState('csv');
  const [state, setState] = useState({ loading: false, message: '' });

  async function generateExport() {
    setState({ loading: true, message: '' });
    try {
      const result = await billingReportsAPI.export({
        ...buildParams(filters),
        report_type: reportType,
        format,
      });
      const content = result.content || JSON.stringify(result.data || result, null, 2);
      const blob = new Blob([content], { type: result.content_type || 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename || `billing_${reportType}.${format === 'json' ? 'json' : 'csv'}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setState({ loading: false, message: result.note || 'Export đã sẵn sàng.' });
    } catch (error) {
      setState({ loading: false, message: getBillingReportErrorMessage(error, 'Export thất bại.') });
    }
  }

  return (
    <ReportFrame title="Xuất báo cáo viện phí" kicker="Export center" filters={filters} setFilters={setFilters} loading={state.loading} error="" onRefresh={() => {}} exportType={reportType}>
      <div className="brep-export-grid">
        <section className="brep-export-builder">
          <header>
            <Download size={20} />
            <strong>Report builder</strong>
          </header>
          <label>
            Loại báo cáo
            <select value={reportType} onChange={(event) => setReportType(event.target.value)}>
              {REPORT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            Định dạng
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="xlsx">XLSX</option>
            </select>
          </label>
          <button type="button" onClick={generateExport} disabled={state.loading}>
            {state.loading ? <Loader2 className="brep-spin" size={17} /> : <Download size={17} />}
            <span>Generate</span>
          </button>
          {state.message ? <div className="brep-export-note">{state.message}</div> : null}
        </section>
        <section className="brep-export-history">
          <header>
            <FileText size={20} />
            <strong>Templates</strong>
          </header>
          {REPORT_TYPES.slice(1).map((item) => (
            <button key={item.value} type="button" onClick={() => setReportType(item.value)}>
              <span>{item.label}</span>
              <small>{item.value}</small>
            </button>
          ))}
        </section>
      </div>
    </ReportFrame>
  );
}

export {
  OverviewReportPage as BillingReportsOverviewPage,
};
