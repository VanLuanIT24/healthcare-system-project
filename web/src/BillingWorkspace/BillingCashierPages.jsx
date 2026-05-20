import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Download,
  FileSearch,
  FileText,
  History,
  Loader2,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { billingCashierAPI, getBillingCashierErrorMessage } from './billingCashierApi';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

const STATUS_LABELS = {
  issued: 'Chưa thanh toán',
  partially_paid: 'Thanh toán một phần',
  paid: 'Đã thu',
  voided: 'Đã hủy',
  cancelled: 'Đã hủy',
  pending: 'Chờ xử lý',
  pending_manual_confirmation: 'Chờ xác nhận',
  submitted_receipt: 'Đã gửi biên lai',
  manual_review: 'Manual review',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
  rejected: 'Bị từ chối',
  expired: 'Hết hạn',
  refunded: 'Đã hoàn tiền',
  refunded_manual: 'Hoàn tiền thủ công',
  open: 'Đang mở',
  closed: 'Đã đóng',
  not_open: 'Chưa mở ca',
};

const METHOD_LABELS = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  qr: 'QR',
  qr_manual: 'QR thủ công',
  card: 'Thẻ',
  e_wallet: 'Ví điện tử',
  insurance: 'Bảo hiểm',
  other: 'Khác',
};

const PROVIDER_LABELS = {
  bank_qr_manual: 'Bank QR manual',
  momo_personal_qr: 'MoMo personal QR',
  cash_manual: 'Cash manual',
  bank_qr: 'Bank QR',
};

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDateRange(dateValue) {
  const selected = dateValue || todayInputValue();
  return {
    date: selected,
    date_from: new Date(`${selected}T00:00:00`).toISOString(),
    date_to: new Date(`${selected}T23:59:59.999`).toISOString(),
  };
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function statusTone(status = '') {
  if (['paid', 'completed', 'confirmed', 'open'].includes(status)) return 'success';
  if (['failed', 'rejected', 'expired', 'cancelled', 'voided'].includes(status)) return 'danger';
  if (['partially_paid', 'submitted_receipt', 'manual_review', 'refunded', 'refunded_manual', 'closed'].includes(status)) return 'warning';
  return 'info';
}

function invoiceId(row) {
  if (!row) return null;
  return row.invoice?.id || row.invoice_id?._id || row.invoice_id || row.id || row._id;
}

function paymentId(row) {
  if (!row) return null;
  return row.payment?.id || row.payment_id || row.payment_intent_id || row.id || row._id;
}

function intentId(row) {
  if (!row) return null;
  return row.payment_intent_id || row.active_payment_intent?.id || row.id || row._id;
}

function patientFrom(row) {
  if (!row) return null;
  return row.patient || row.patient_id || row.invoice?.patient || null;
}

function invoiceFromIntent(intent) {
  if (!intent) return null;
  return intent.invoice || intent.invoice_id || null;
}

function useCashierResource(loader, params = {}, enabled = true) {
  const [state, setState] = useState({ data: null, loading: Boolean(enabled), error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: '' });
      return undefined;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loader(params)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error: getBillingCashierErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [loader, key, version, enabled]);

  return {
    ...state,
    refresh: () => setVersion((current) => current + 1),
  };
}

function useInvoiceDetail(selectedInvoiceId) {
  const [state, setState] = useState({ detail: null, loading: false, error: '' });

  useEffect(() => {
    if (!selectedInvoiceId) {
      setState({ detail: null, loading: false, error: '' });
      return undefined;
    }
    let cancelled = false;
    setState({ detail: null, loading: true, error: '' });
    billingCashierAPI.invoiceDetail(selectedInvoiceId)
      .then((detail) => {
        if (!cancelled) setState({ detail, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ detail: null, loading: false, error: getBillingCashierErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedInvoiceId]);

  return state;
}

function loadPaymentReceipt({ payment_id }) {
  return billingCashierAPI.paymentReceipt(payment_id);
}

function loadReceiptPrintLogs({ payment_id }) {
  return billingCashierAPI.receiptPrintLogs(payment_id);
}

function MoneyAmount({ value, compact = false }) {
  return <span className={compact ? 'bo-money bo-money--compact' : 'bo-money'}>{formatMoney(value)}</span>;
}

function StatusBadge({ status }) {
  return <span className={`bo-status bo-status--${statusTone(status)}`}>{STATUS_LABELS[status] || status || 'Không rõ'}</span>;
}

function MethodBadge({ method }) {
  return <span className="bc-method">{METHOD_LABELS[method] || PROVIDER_LABELS[method] || method || '-'}</span>;
}

function PatientMini({ patient }) {
  if (!patient) return <span className="bo-muted">-</span>;
  return (
    <span className="bo-patient-mini">
      <UserRound size={15} />
      <span>
        <strong>{patient.full_name || patient.name || 'Bệnh nhân'}</strong>
        <small>{patient.patient_code || patient.id || patient._id || '-'}</small>
      </span>
    </span>
  );
}

function EmptyState({ label = 'Chưa có dữ liệu.', compact = false }) {
  return (
    <div className={compact ? 'bo-empty bo-empty--compact' : 'bo-empty'}>
      <FileSearch size={compact ? 18 : 28} />
      <span>{label}</span>
    </div>
  );
}

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`bo-panel ${className}`}>
      <header className="bo-panel__header">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function CashierCommandBar({ filters, setFilters, loading, onRefresh, onQuickAction }) {
  return (
    <section className="bo-command-bar bc-command-bar" aria-label="Bộ lọc quầy thu tiền">
      <div className="bo-command-bar__filters">
        <label>
          <span>Ngày</span>
          <input
            type="date"
            value={filters.date}
            onChange={(event) => setFilters((current) => ({ ...current, ...getDateRange(event.target.value) }))}
          />
        </label>
        <label>
          <span>Khoa</span>
          <input
            value={filters.department_id || ''}
            onChange={(event) => setFilters((current) => ({ ...current, department_id: event.target.value }))}
            placeholder="Department ID"
          />
        </label>
        <label>
          <span>Quầy</span>
          <input
            value={filters.counter_code || ''}
            onChange={(event) => setFilters((current) => ({ ...current, counter_code: event.target.value }))}
            placeholder="COUNTER-01"
          />
        </label>
        <label className="bo-command-bar__search">
          <Search size={16} aria-hidden="true" />
          <input
            value={filters.keyword || ''}
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            placeholder="Mã BN / Tên / SĐT / Invoice / Payment / Transaction ref"
          />
        </label>
      </div>
      <div className="bo-command-bar__actions">
        <button type="button" onClick={() => onQuickAction?.('collect')}>
          <WalletCards size={16} />
          <span>Thu tiền</span>
        </button>
        <button type="button" onClick={() => onQuickAction?.('qr')}>
          <QrCode size={16} />
          <span>Tạo QR</span>
        </button>
        <button type="button" onClick={() => onQuickAction?.('confirm')}>
          <CheckCircle2 size={16} />
          <span>Xác nhận</span>
        </button>
        <button type="button">
          <Download size={16} />
          <span>Excel</span>
        </button>
        <button type="button" className="bo-icon-action" onClick={onRefresh} aria-label="Tải lại dữ liệu">
          {loading ? <Loader2 size={17} className="bo-spin" /> : <RefreshCcw size={17} />}
        </button>
      </div>
    </section>
  );
}

function CashierHeader({ title, kicker, cashier, loading, onRefresh }) {
  return (
    <header className="bc-page-header">
      <div>
        <span>{kicker}</span>
        <h1>{title}</h1>
        <p>
          {cashier?.counter_code || 'COUNTER-01'} · {cashier?.shift_code || 'Chưa mở ca'} · Thu ngân: {cashier?.full_name || 'Đang đăng nhập'}
        </p>
      </div>
      <div className="bc-header-actions">
        <span className="bc-live-dot"><i /> Online realtime</span>
        <StatusBadge status={cashier?.shift_status || 'not_open'} />
        <button type="button" className="bo-icon-action" onClick={onRefresh} aria-label="Tải lại">
          {loading ? <Loader2 size={17} className="bo-spin" /> : <RefreshCcw size={17} />}
        </button>
      </div>
    </header>
  );
}

function KpiCard({ icon: Icon, label, value, meta, money = false, tone = 'blue' }) {
  return (
    <article className={`bo-kpi bo-kpi--${tone}`}>
      <div className="bo-kpi__icon" aria-hidden="true"><Icon size={20} /></div>
      <div className="bo-kpi__body">
        <span>{label}</span>
        <strong>{money ? formatMoney(value) : formatNumber(value)}</strong>
        <small>{meta}</small>
      </div>
    </article>
  );
}

function CashierKpis({ kpis = {} }) {
  return (
    <section className="bo-kpi-grid bc-kpi-grid">
      <KpiCard icon={ReceiptText} label="Hóa đơn chờ thu" value={kpis.unpaid_invoice_count} meta="Issued còn balance" tone="amber" />
      <KpiCard icon={CircleMoneyIcon} label="Tổng tiền phải thu" value={kpis.total_balance_due} meta="Balance due hiện tại" money />
      <KpiCard icon={Banknote} label="Đã thu hôm nay" value={kpis.today_revenue} meta="Completed payments" money tone="green" />
      <KpiCard icon={WalletCards} label="Tiền mặt hôm nay" value={kpis.today_cash_amount} meta="Cash drawer" money tone="green" />
      <KpiCard icon={ScanLine} label="QR chờ xác nhận" value={(kpis.pending_qr_count || 0) + (kpis.submitted_receipt_count || 0)} meta="QR/receipt/manual" tone="violet" />
      <KpiCard icon={AlertTriangle} label="Lệch/lỗi" value={(kpis.manual_review_count || 0) + (kpis.failed_payment_count || 0)} meta="Cần xử lý ngay" tone="danger" />
      <KpiCard icon={Printer} label="Biên lai đã in" value={kpis.printed_receipt_count} meta="Trong ngày" tone="amber" />
      <KpiCard icon={BadgeCheck} label="Partial paid" value={kpis.partial_invoice_count} meta="Cần thu tiếp" tone="blue" />
    </section>
  );
}

function CircleMoneyIcon(props) {
  return <WalletCards {...props} />;
}

function InvoiceQueueTable({ items = [], selectedId, onSelect, onCollect, onQr }) {
  if (!items.length) return <EmptyState label="Không có hóa đơn trong hàng đợi này." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table bc-invoice-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Bệnh nhân</th>
            <th>Khoa/lượt khám</th>
            <th>Còn phải thu</th>
            <th>QR/Claim</th>
            <th>Aging</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => {
            const id = invoiceId(row);
            const invoice = row.invoice || {};
            const department = row.encounter?.department || row.admission?.department;
            return (
              <tr key={id} className={selectedId === id ? 'is-selected' : ''} onClick={() => onSelect?.(row)}>
                <td>
                  <strong>{invoice.invoice_no || id}</strong>
                  <small><StatusBadge status={invoice.status} /></small>
                </td>
                <td><PatientMini patient={row.patient} /></td>
                <td>
                  <span>{department?.department_name || department?.department_code || '-'}</span>
                  <small>{row.encounter?.encounter_code || row.admission?.admission_no || '-'}</small>
                </td>
                <td>
                  <MoneyAmount value={invoice.balance_due} compact />
                  <small>Tổng {formatMoney(invoice.total_amount)}</small>
                </td>
                <td>
                  <div className="bc-stack">
                    {row.active_payment_intent ? <StatusBadge status={row.active_payment_intent.status} /> : <span className="bo-muted">Chưa có QR</span>}
                    {row.claim_summary?.pending_count ? <small>Bảo hiểm chờ: {row.claim_summary.pending_count}</small> : <small>Claim: {row.claim_summary?.count || 0}</small>}
                  </div>
                </td>
                <td>
                  <span className={row.flags?.includes('overdue') ? 'bc-aging is-danger' : 'bc-aging'}>{row.aging_days || 0} ngày</span>
                  <small>{row.suggested_action || '-'}</small>
                </td>
                <td>
                  <div className="bc-row-actions">
                    <button type="button" className="bo-table-action" onClick={(event) => { event.stopPropagation(); onCollect?.(row); }}>
                      <WalletCards size={14} />
                      <span>Thu</span>
                    </button>
                    <button type="button" className="bo-table-action" onClick={(event) => { event.stopPropagation(); onQr?.(row); }}>
                      <QrCode size={14} />
                      <span>QR</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceDetailPanel({ invoiceId: selectedInvoiceId }) {
  const { detail, loading, error } = useInvoiceDetail(selectedInvoiceId);
  const invoice = detail?.invoice || {};
  const patient = invoice.patient_id || detail?.patient || {};
  const items = detail?.items || [];
  const payments = detail?.payments || [];

  return (
    <Panel title="Chi tiết hóa đơn" className="bc-detail-panel">
      {!selectedInvoiceId ? <EmptyState compact label="Chọn một hóa đơn để xem chi tiết." /> : null}
      {loading ? <EmptyState compact label="Đang tải hóa đơn..." /> : null}
      {error ? <div className="bo-error"><AlertTriangle size={16} />{error}</div> : null}
      {detail && (
        <div className="bc-detail">
          <div className="bc-patient-card">
            <PatientMini patient={patient} />
            <span>{patient.phone || 'Chưa có SĐT'}</span>
            <span>{patient.gender || '-'} · {patient.date_of_birth ? formatDateTime(patient.date_of_birth) : '-'}</span>
          </div>
          <div className="bc-money-grid">
            <span>Tổng hóa đơn <strong>{formatMoney(invoice.total_amount)}</strong></span>
            <span>Đã thu <strong>{formatMoney(invoice.paid_amount)}</strong></span>
            <span>Còn lại <strong>{formatMoney(invoice.balance_due)}</strong></span>
            <span>Bảo hiểm <strong>{formatMoney(invoice.insurance_amount)}</strong></span>
          </div>
          <div className="bc-mini-table">
            <h3>Dịch vụ</h3>
            {items.slice(0, 6).map((item) => (
              <div key={item._id || item.id || item.charge_no}>
                <span>{item.service_name || item.description}</span>
                <strong>{formatMoney(item.line_total)}</strong>
              </div>
            ))}
            {!items.length ? <EmptyState compact label="Chưa có item." /> : null}
          </div>
          <div className="bc-mini-table">
            <h3>Lịch sử thanh toán</h3>
            {payments.slice(0, 5).map((payment) => (
              <div key={payment._id || payment.id}>
                <span>{payment.payment_no || payment.transaction_ref || payment.payment_method}</span>
                <strong>{formatMoney(payment.amount)}</strong>
              </div>
            ))}
            {!payments.length ? <EmptyState compact label="Chưa có payment." /> : null}
          </div>
        </div>
      )}
    </Panel>
  );
}

function CollectPaymentPanel({ selectedRow, onDone }) {
  const invoice = selectedRow?.invoice || {};
  const [form, setForm] = useState({
    amount: invoice.balance_due || '',
    payment_method: 'cash',
    transaction_ref: '',
    cash_received_amount: '',
    note: '',
    print_receipt: true,
  });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      amount: invoice.balance_due || '',
      cash_received_amount: invoice.balance_due || '',
    }));
    setState({ loading: false, error: '', success: '' });
  }, [invoice.id, invoice.balance_due]);

  const changeAmount = Number(form.cash_received_amount || 0) - Number(form.amount || 0);

  async function submit(event) {
    event.preventDefault();
    if (!invoice.id) return;
    setState({ loading: true, error: '', success: '' });
    try {
      await billingCashierAPI.collectPayment(invoice.id, {
        ...form,
        amount: Number(form.amount),
        cash_received_amount: form.payment_method === 'cash' ? Number(form.cash_received_amount || form.amount) : undefined,
        cash_change_amount: form.payment_method === 'cash' ? Math.max(0, changeAmount) : undefined,
        transaction_ref: form.payment_method === 'cash' ? undefined : form.transaction_ref,
        note: form.note || 'Thu tiền tại quầy',
      });
      setState({ loading: false, error: '', success: 'Đã ghi nhận thanh toán.' });
      onDone?.();
    } catch (error) {
      setState({ loading: false, error: getBillingCashierErrorMessage(error), success: '' });
    }
  }

  return (
    <Panel title="Panel thu tiền" className="bc-collect-panel">
      {!invoice.id ? <EmptyState compact label="Chọn hóa đơn để thu tiền." /> : null}
      {invoice.id && (
        <form className="bc-form" onSubmit={submit}>
          <div className="bc-selected-invoice">
            <span>{invoice.invoice_no}</span>
            <strong>{formatMoney(invoice.balance_due)}</strong>
          </div>
          <label>
            <span>Số tiền cần thu</span>
            <input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
          </label>
          <div className="bc-chip-row">
            <button type="button" onClick={() => setForm((current) => ({ ...current, amount: invoice.balance_due, cash_received_amount: invoice.balance_due }))}>Thu đủ</button>
            <button type="button" onClick={() => setForm((current) => ({ ...current, amount: Math.floor((invoice.balance_due || 0) / 2) }))}>Thu 50%</button>
            <button type="button" onClick={() => setForm((current) => ({ ...current, amount: '' }))}>Nhập khác</button>
          </div>
          <label>
            <span>Phương thức</span>
            <select value={form.payment_method} onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))}>
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="card">Thẻ</option>
              <option value="e_wallet">Ví điện tử</option>
              <option value="other">Khác</option>
            </select>
          </label>
          {form.payment_method === 'cash' ? (
            <div className="bc-cash-grid">
              <label>
                <span>Khách đưa</span>
                <input type="number" value={form.cash_received_amount} onChange={(event) => setForm((current) => ({ ...current, cash_received_amount: event.target.value }))} />
              </label>
              <span>
                Tiền thối
                <strong>{formatMoney(Math.max(0, changeAmount))}</strong>
              </span>
            </div>
          ) : (
            <label>
              <span>Mã giao dịch</span>
              <input value={form.transaction_ref} onChange={(event) => setForm((current) => ({ ...current, transaction_ref: event.target.value }))} placeholder="VCB202605200001" />
            </label>
          )}
          <label>
            <span>Ghi chú thu ngân</span>
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} />
          </label>
          <label className="bc-checkbox">
            <input type="checkbox" checked={form.print_receipt} onChange={(event) => setForm((current) => ({ ...current, print_receipt: event.target.checked }))} />
            <span>In biên lai sau khi thu</span>
          </label>
          {state.error ? <div className="bo-error"><AlertTriangle size={16} />{state.error}</div> : null}
          {state.success ? <div className="bc-success"><CheckCircle2 size={16} />{state.success}</div> : null}
          <button type="submit" className="bc-primary-button" disabled={state.loading}>
            {state.loading ? <Loader2 size={16} className="bo-spin" /> : <WalletCards size={16} />}
            <span>Thu và in biên lai</span>
          </button>
        </form>
      )}
    </Panel>
  );
}

function QrCreationPanel({ selectedRow, provider = 'bank_qr_manual', onDone }) {
  const invoice = selectedRow?.invoice || {};
  const existingIntent = selectedRow?.active_payment_intent;
  const [form, setForm] = useState({
    amount: invoice.balance_due || '',
    provider,
    allow_partial: true,
    force_new: false,
    payment_note: '',
  });
  const [state, setState] = useState({ loading: false, error: '', intent: null });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      amount: invoice.balance_due || '',
      provider,
      payment_note: existingIntent?.payment_note || '',
    }));
    setState({ loading: false, error: '', intent: existingIntent || null });
  }, [invoice.id, invoice.balance_due, provider, existingIntent?.id]);

  async function createIntent(event) {
    event.preventDefault();
    if (!invoice.id) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await billingCashierAPI.createPaymentIntent(invoice.id, {
        ...form,
        amount: Number(form.amount),
        method: form.provider === 'cash_manual' ? 'cash' : 'qr_manual',
        metadata: { created_from: 'cashier_counter' },
      });
      setState({ loading: false, error: '', intent: data.payment_intent || data });
      onDone?.();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getBillingCashierErrorMessage(error) }));
    }
  }

  const intent = state.intent || existingIntent;

  return (
    <Panel title={provider === 'momo_personal_qr' ? 'Tạo ví điện tử' : 'Tạo QR / chuyển khoản'} className="bc-qr-panel">
      {!invoice.id ? <EmptyState compact label="Chọn hóa đơn để tạo QR." /> : null}
      {invoice.id && (
        <form className="bc-form" onSubmit={createIntent}>
          <div className="bc-selected-invoice">
            <span>{invoice.invoice_no}</span>
            <strong>{formatMoney(invoice.balance_due)}</strong>
          </div>
          <label>
            <span>Số tiền QR</span>
            <input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
          </label>
          <label>
            <span>Provider</span>
            <select value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}>
              <option value="bank_qr_manual">Bank QR manual</option>
              <option value="momo_personal_qr">MoMo personal QR</option>
              <option value="cash_manual">Cash manual</option>
            </select>
          </label>
          <label>
            <span>Nội dung chuyển khoản</span>
            <input value={form.payment_note} onChange={(event) => setForm((current) => ({ ...current, payment_note: event.target.value }))} placeholder="Tự sinh nếu để trống" />
          </label>
          <div className="bc-toggle-row">
            <label className="bc-checkbox">
              <input type="checkbox" checked={form.allow_partial} onChange={(event) => setForm((current) => ({ ...current, allow_partial: event.target.checked }))} />
              <span>Cho phép thanh toán một phần</span>
            </label>
            <label className="bc-checkbox">
              <input type="checkbox" checked={form.force_new} onChange={(event) => setForm((current) => ({ ...current, force_new: event.target.checked }))} />
              <span>Tạo QR mới</span>
            </label>
          </div>
          {state.error ? <div className="bo-error"><AlertTriangle size={16} />{state.error}</div> : null}
          <button type="submit" className="bc-primary-button" disabled={state.loading}>
            {state.loading ? <Loader2 size={16} className="bo-spin" /> : <QrCode size={16} />}
            <span>Tạo QR</span>
          </button>
        </form>
      )}
      {intent ? <QrIntentPreview intent={intent} /> : null}
    </Panel>
  );
}

function QrIntentPreview({ intent }) {
  const qr = intent.qr_image_url || intent.qrImageUrl;
  return (
    <div className="bc-qr-preview">
      <div className="bc-qr-box">
        {qr ? <img src={qr} alt="QR thanh toán" /> : <QrCode size={90} />}
      </div>
      <div>
        <strong>{intent.intent_code || intent.payment_intent_id}</strong>
        <StatusBadge status={intent.status} />
        <MoneyAmount value={intent.amount} />
        <span>{intent.payment_note || 'Chưa có nội dung chuyển khoản'}</span>
        <small>{intent.receiver_bank_bin || intent.receiver_phone || '-'} · {intent.receiver_account_no || intent.receiver_account_name || '-'}</small>
      </div>
    </div>
  );
}

function CashierFrame({ title, kicker, filters, setFilters, dataState, children, onQuickAction }) {
  const cashier = dataState.data?.cashier;
  return (
    <main className="billing-overview billing-cashier">
      <CashierHeader title={title} kicker={kicker} cashier={cashier} loading={dataState.loading} onRefresh={dataState.refresh} />
      <CashierCommandBar filters={filters} setFilters={setFilters} loading={dataState.loading} onRefresh={dataState.refresh} onQuickAction={onQuickAction} />
      {dataState.error ? <div className="bo-error"><AlertTriangle size={16} />{dataState.error}</div> : null}
      {children}
    </main>
  );
}

export function CashierCollectPage() {
  const [filters, setFilters] = useState(getDateRange(todayInputValue()));
  const workbench = useCashierResource(billingCashierAPI.workbench, filters);
  const [selectedRow, setSelectedRow] = useState(null);
  const queues = workbench.data?.queues || {};
  const invoiceItems = selectedRow ? [selectedRow, ...(queues.urgent_unpaid_invoices || []).filter((row) => invoiceId(row) !== invoiceId(selectedRow))] : (queues.urgent_unpaid_invoices || []);

  useEffect(() => {
    if (!selectedRow && queues.urgent_unpaid_invoices?.length) setSelectedRow(queues.urgent_unpaid_invoices[0]);
  }, [queues.urgent_unpaid_invoices, selectedRow]);

  return (
    <CashierFrame title="Thu tiền" kicker="Cashier command center" filters={filters} setFilters={setFilters} dataState={workbench}>
      <CashierKpis kpis={workbench.data?.kpis} />
      <section className="bc-workbench-grid">
        <Panel title="Hàng đợi cần thu" action={<span>{formatNumber(invoiceItems.length)} dòng ưu tiên</span>}>
          <InvoiceQueueTable
            items={invoiceItems}
            selectedId={invoiceId(selectedRow)}
            onSelect={setSelectedRow}
            onCollect={setSelectedRow}
            onQr={setSelectedRow}
          />
        </Panel>
        <div className="bc-side-stack">
          <CollectPaymentPanel selectedRow={selectedRow} onDone={workbench.refresh} />
          <InvoiceDetailPanel invoiceId={invoiceId(selectedRow)} />
        </div>
      </section>
    </CashierFrame>
  );
}

export function CashierSearchPage() {
  const [filters, setFilters] = useState({ ...getDateRange(todayInputValue()), keyword: '' });
  const [query, setQuery] = useState('');
  const workbench = useCashierResource(billingCashierAPI.workbench, filters);
  const search = useCashierResource(billingCashierAPI.search, { q: query, department_id: filters.department_id }, query.trim().length >= 2);
  const groups = [
    { key: 'patients', label: 'Bệnh nhân', items: search.data?.patients || [] },
    { key: 'invoices', label: 'Hóa đơn', items: search.data?.invoices || [] },
    { key: 'payment_intents', label: 'Payment intent', items: search.data?.payment_intents || [] },
    { key: 'payments', label: 'Payment', items: search.data?.payments || [] },
    { key: 'encounters', label: 'Lượt khám', items: search.data?.encounters || [] },
  ];

  return (
    <CashierFrame title="Tìm hóa đơn / bệnh nhân" kicker="Ctrl+K cashier search" filters={filters} setFilters={setFilters} dataState={workbench}>
      <section className="bc-search-hero">
        <Search size={24} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nhập mã hóa đơn, mã BN, tên, SĐT, CCCD, mã encounter, mã payment..."
        />
        {search.loading ? <Loader2 size={20} className="bo-spin" /> : <ArrowRight size={20} />}
      </section>
      <section className="bc-search-grid">
        {groups.map((group) => (
          <Panel key={group.key} title={`${group.label} (${group.items.length})`}>
            <SearchResultList groupKey={group.key} items={group.items} />
          </Panel>
        ))}
      </section>
    </CashierFrame>
  );
}

function SearchResultList({ groupKey, items = [] }) {
  if (!items.length) return <EmptyState compact label="Không có kết quả." />;
  return (
    <div className="bc-result-list">
      {items.map((item, index) => {
        const patient = item.patient || item.patient_id || item.patient?.patient || item.patient;
        const invoice = item.invoice || item.invoice_id;
        const payment = item.payment || item.payment_intent || item;
        return (
          <article key={item.id || item._id || invoice?.id || payment?.payment_intent_id || index}>
            <div>
              <strong>
                {patient?.full_name || invoice?.invoice_no || payment?.payment_no || payment?.intent_code || item.encounter_code || item.admission_no}
              </strong>
              <span>{patient?.patient_code || invoice?.status || payment?.status || item.status || groupKey}</span>
            </div>
            <small>
              {item.debt ? `Công nợ ${formatMoney(item.debt.balance_due)} · ${item.debt.invoice_count} hóa đơn` : null}
              {invoice ? `Invoice ${invoice.invoice_no || invoice.id} · ${formatMoney(invoice.balance_due)}` : null}
              {payment?.amount ? `${formatMoney(payment.amount)} · ${payment.transaction_ref || payment.payment_note || ''}` : null}
            </small>
          </article>
        );
      })}
    </div>
  );
}

function InvoiceQueuePage({ mode }) {
  const isPartial = mode === 'partial';
  const [filters, setFilters] = useState({ ...getDateRange(todayInputValue()), sort: isPartial ? 'issued_at_desc' : 'due_at_asc' });
  const workbench = useCashierResource(billingCashierAPI.workbench, filters);
  const loader = isPartial ? billingCashierAPI.partialInvoices : billingCashierAPI.unpaidInvoices;
  const queue = useCashierResource(loader, { ...filters, q: filters.keyword, limit: 30 });
  const [selectedRow, setSelectedRow] = useState(null);

  return (
    <CashierFrame
      title={isPartial ? 'Hóa đơn thanh toán một phần' : 'Hóa đơn chưa thanh toán'}
      kicker={isPartial ? 'Partial payment queue' : 'Unpaid invoice queue'}
      filters={filters}
      setFilters={setFilters}
      dataState={{ ...workbench, loading: workbench.loading || queue.loading, error: workbench.error || queue.error, refresh: () => { workbench.refresh(); queue.refresh(); } }}
    >
      <CashierKpis kpis={{ ...workbench.data?.kpis, total_balance_due: queue.data?.summary?.total_balance_due }} />
      <section className="bc-workbench-grid">
        <Panel title={isPartial ? 'Danh sách partial paid' : 'Danh sách chưa thanh toán'} action={<span>{formatNumber(queue.data?.summary?.count || 0)} hóa đơn</span>}>
          <InvoiceQueueTable items={queue.data?.items || []} selectedId={invoiceId(selectedRow)} onSelect={setSelectedRow} onCollect={setSelectedRow} onQr={setSelectedRow} />
        </Panel>
        <div className="bc-side-stack">
          <CollectPaymentPanel selectedRow={selectedRow} onDone={() => { queue.refresh(); workbench.refresh(); }} />
          <InvoiceDetailPanel invoiceId={invoiceId(selectedRow)} />
        </div>
      </section>
    </CashierFrame>
  );
}

export function CashierUnpaidInvoicesPage() {
  return <InvoiceQueuePage mode="unpaid" />;
}

export function CashierPartialInvoicesPage() {
  return <InvoiceQueuePage mode="partial" />;
}

export function CashierQrTransferPage() {
  const [filters, setFilters] = useState({ ...getDateRange(todayInputValue()), status_group: 'unpaid', sort: 'due_at_asc' });
  const workbench = useCashierResource(billingCashierAPI.workbench, filters);
  const queue = useCashierResource(billingCashierAPI.invoices, { ...filters, q: filters.keyword, limit: 20 });
  const [selectedRow, setSelectedRow] = useState(null);

  return (
    <CashierFrame title="Thanh toán QR / chuyển khoản" kicker="Bank transfer workspace" filters={filters} setFilters={setFilters} dataState={{ ...workbench, loading: workbench.loading || queue.loading, refresh: () => { workbench.refresh(); queue.refresh(); } }}>
      <section className="bc-workbench-grid bc-workbench-grid--qr">
        <Panel title="Invoice có thể tạo QR">
          <InvoiceQueueTable items={queue.data?.items || []} selectedId={invoiceId(selectedRow)} onSelect={setSelectedRow} onCollect={setSelectedRow} onQr={setSelectedRow} />
        </Panel>
        <div className="bc-side-stack">
          <QrCreationPanel selectedRow={selectedRow} provider="bank_qr_manual" onDone={() => { queue.refresh(); workbench.refresh(); }} />
          <InvoiceDetailPanel invoiceId={invoiceId(selectedRow)} />
        </div>
      </section>
    </CashierFrame>
  );
}

export function CashierEWalletPage() {
  const [filters, setFilters] = useState({ ...getDateRange(todayInputValue()), status_group: 'unpaid' });
  const workbench = useCashierResource(billingCashierAPI.workbench, filters);
  const queue = useCashierResource(billingCashierAPI.invoices, { ...filters, q: filters.keyword, limit: 20 });
  const [selectedRow, setSelectedRow] = useState(null);

  return (
    <CashierFrame title="Ví điện tử" kicker="Manual wallet collection" filters={filters} setFilters={setFilters} dataState={{ ...workbench, loading: workbench.loading || queue.loading, refresh: () => { workbench.refresh(); queue.refresh(); } }}>
      <section className="bc-provider-grid">
        <ProviderCard icon={CreditCard} title="MoMo personal QR" meta="Manual confirmation · webhook chưa bật" status="Enabled" />
        <ProviderCard icon={QrCode} title="Bank QR" meta="VietQR provider · xác nhận thủ công" status="Enabled" />
        <ProviderCard icon={Banknote} title="Cash manual" meta="Dự phòng cho thu tại quầy" status="Enabled" />
      </section>
      <section className="bc-workbench-grid bc-workbench-grid--qr">
        <Panel title="Invoice chờ thu">
          <InvoiceQueueTable items={queue.data?.items || []} selectedId={invoiceId(selectedRow)} onSelect={setSelectedRow} onCollect={setSelectedRow} onQr={setSelectedRow} />
        </Panel>
        <QrCreationPanel selectedRow={selectedRow} provider="momo_personal_qr" onDone={() => { queue.refresh(); workbench.refresh(); }} />
      </section>
    </CashierFrame>
  );
}

function ProviderCard({ icon: Icon, title, meta, status }) {
  return (
    <article className="bc-provider-card">
      <Icon size={22} />
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <BadgeCheck size={18} />
      <small>{status}</small>
    </article>
  );
}

export function CashierTransferConfirmationPage() {
  const [filters, setFilters] = useState({ ...getDateRange(todayInputValue()), status: 'pending_manual_confirmation,submitted_receipt,manual_review' });
  const workbench = useCashierResource(billingCashierAPI.workbench, filters);
  const queue = useCashierResource(billingCashierAPI.manualPayments, { status: filters.status, department_id: filters.department_id, limit: 30 });
  const [selected, setSelected] = useState(null);

  const tabs = [
    { label: 'Chờ xác nhận', status: 'pending_manual_confirmation' },
    { label: 'Đã gửi biên lai', status: 'submitted_receipt' },
    { label: 'Manual review', status: 'manual_review' },
    { label: 'Đã từ chối', status: 'rejected' },
    { label: 'Hết hạn', status: 'expired' },
  ];

  return (
    <CashierFrame title="Xác nhận chuyển khoản" kicker="Manual payment review" filters={filters} setFilters={setFilters} dataState={{ ...workbench, loading: workbench.loading || queue.loading, error: workbench.error || queue.error, refresh: () => { workbench.refresh(); queue.refresh(); } }}>
      <div className="bo-tabs bc-tabs">
        {tabs.map((tab) => (
          <button key={tab.status} type="button" className={filters.status === tab.status ? 'is-active' : ''} onClick={() => setFilters((current) => ({ ...current, status: tab.status }))}>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <section className="bc-workbench-grid">
        <ManualPaymentTable items={queue.data?.items || []} selectedId={intentId(selected)} onSelect={setSelected} />
        <ManualPaymentDrawer selected={selected} onDone={() => { queue.refresh(); workbench.refresh(); }} />
      </section>
    </CashierFrame>
  );
}

function ManualPaymentTable({ items = [], selectedId, onSelect }) {
  return (
    <Panel title="Payment cần xử lý" action={<span>{formatNumber(items.length)} giao dịch</span>}>
      {!items.length ? <EmptyState label="Không có payment manual trong tab này." /> : (
        <div className="bo-table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th>Intent</th>
                <th>Bệnh nhân</th>
                <th>Invoice</th>
                <th>Số tiền</th>
                <th>Provider</th>
                <th>Receipt</th>
                <th>SLA</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const id = intentId(item);
                const invoice = invoiceFromIntent(item);
                return (
                  <tr key={id} className={selectedId === id ? 'is-selected' : ''} onClick={() => onSelect?.(item)}>
                    <td><strong>{item.intent_code || id}</strong><small><StatusBadge status={item.status} /></small></td>
                    <td><PatientMini patient={item.patient_id || item.patient} /></td>
                    <td><span>{invoice?.invoice_no || '-'}</span><small>{invoice?.status || '-'}</small></td>
                    <td><MoneyAmount value={item.amount} compact /></td>
                    <td><MethodBadge method={item.provider} /></td>
                    <td>{item.receipt_image_url ? <BadgeCheck size={17} /> : <span className="bo-muted">Chưa có</span>}</td>
                    <td><span>{formatDateTime(item.expires_at)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ManualPaymentDrawer({ selected, onDone }) {
  const [form, setForm] = useState({ received_amount: '', transaction_ref: '', reason: '', note: '' });
  const [state, setState] = useState({ loading: false, error: '', success: '', duplicate: null });

  useEffect(() => {
    setForm({
      received_amount: selected?.amount || '',
      transaction_ref: selected?.transaction_reference || '',
      reason: '',
      note: '',
    });
    setState({ loading: false, error: '', success: '', duplicate: null });
  }, [intentId(selected)]);

  async function checkDuplicate() {
    if (!form.transaction_ref) return;
    try {
      const duplicate = await billingCashierAPI.transactionRefCheck({ provider: selected?.provider, transaction_ref: form.transaction_ref });
      setState((current) => ({ ...current, duplicate }));
    } catch (error) {
      setState((current) => ({ ...current, error: getBillingCashierErrorMessage(error) }));
    }
  }

  async function act(type) {
    if (!selected) return;
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      if (type === 'confirm') {
        await billingCashierAPI.confirmManualPayment(intentId(selected), {
          received_amount: Number(form.received_amount),
          transaction_ref: form.transaction_ref,
          note: form.note,
        });
      } else {
        await billingCashierAPI.rejectManualPayment(intentId(selected), {
          reason: form.reason || 'Thu ngân từ chối giao dịch manual',
          note: form.note,
        });
      }
      setState({ loading: false, error: '', success: type === 'confirm' ? 'Đã xác nhận thanh toán.' : 'Đã từ chối payment.', duplicate: null });
      onDone?.();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getBillingCashierErrorMessage(error) }));
    }
  }

  return (
    <Panel title="Drawer xác nhận" className="bc-confirm-panel">
      {!selected ? <EmptyState compact label="Chọn payment để xử lý." /> : (
        <div className="bc-form">
          <QrIntentPreview intent={selected} />
          {selected.receipt_image_url ? (
            <div className="bc-receipt-preview">
              <img src={selected.receipt_image_url} alt="Biên lai bệnh nhân gửi" />
            </div>
          ) : <EmptyState compact label="Chưa có ảnh/PDF biên lai." />}
          <label>
            <span>Số tiền nhận</span>
            <input type="number" value={form.received_amount} onChange={(event) => setForm((current) => ({ ...current, received_amount: event.target.value }))} />
          </label>
          <label>
            <span>Transaction ref</span>
            <div className="bc-inline-field">
              <input value={form.transaction_ref} onChange={(event) => setForm((current) => ({ ...current, transaction_ref: event.target.value }))} />
              <button type="button" className="bo-table-action" onClick={checkDuplicate}><Search size={14} /><span>Check</span></button>
            </div>
          </label>
          {state.duplicate?.exists ? <div className="bc-warning"><AlertTriangle size={16} />Mã giao dịch đã tồn tại trong hệ thống.</div> : null}
          <label>
            <span>Lý do từ chối / ghi chú</span>
            <textarea rows={3} value={form.reason || form.note} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value, note: event.target.value }))} />
          </label>
          {state.error ? <div className="bo-error"><AlertTriangle size={16} />{state.error}</div> : null}
          {state.success ? <div className="bc-success"><CheckCircle2 size={16} />{state.success}</div> : null}
          <div className="bc-row-actions">
            <button type="button" className="bc-primary-button" onClick={() => act('confirm')} disabled={state.loading}>
              <CheckCircle2 size={16} />
              <span>Xác nhận</span>
            </button>
            <button type="button" className="bc-danger-button" onClick={() => act('reject')} disabled={state.loading}>
              <X size={16} />
              <span>Từ chối</span>
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function CashierReceiptsPage() {
  const [filters, setFilters] = useState({ ...getDateRange(todayInputValue()), status: 'completed', keyword: '' });
  const workbench = useCashierResource(billingCashierAPI.workbench, filters);
  const payments = useCashierResource(billingCashierAPI.payments, { status: 'completed', limit: 30, patient_id: filters.patient_id });
  const [selected, setSelected] = useState(null);
  const receipt = useCashierResource(
    loadPaymentReceipt,
    { payment_id: paymentId(selected) },
    Boolean(paymentId(selected)),
  );
  const logs = useCashierResource(
    loadReceiptPrintLogs,
    { payment_id: paymentId(selected) },
    Boolean(paymentId(selected)),
  );
  const visiblePayments = useMemo(() => {
    const keyword = String(filters.keyword || '').toLowerCase();
    const items = payments.data?.items || [];
    if (!keyword) return items;
    return items.filter((item) => [
      item.payment_no,
      item.transaction_ref,
      item.transaction_reference,
      item.invoice_id?.invoice_no,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [payments.data?.items, filters.keyword]);

  async function printSelected() {
    if (!selected) return;
    await billingCashierAPI.createReceiptPrintLog(paymentId(selected), { reason: 'In biên lai từ màn quầy thu' });
    logs.refresh();
  }

  return (
    <CashierFrame title="In biên lai" kicker="Receipt center" filters={filters} setFilters={setFilters} dataState={{ ...workbench, loading: workbench.loading || payments.loading, refresh: () => { workbench.refresh(); payments.refresh(); } }}>
      <section className="bc-workbench-grid">
        <Panel title="Danh sách biên lai" action={<span>{formatNumber(visiblePayments.length)} payment</span>}>
          <PaymentReceiptTable items={visiblePayments} selectedId={paymentId(selected)} onSelect={setSelected} />
        </Panel>
        <Panel title="Preview biên lai" className="bc-receipt-center">
          {!selected ? <EmptyState compact label="Chọn payment để xem biên lai." /> : (
            <div className="bc-receipt-paper">
              <header>
                <strong>BỆNH VIỆN / PHÒNG KHÁM</strong>
                <span>BIÊN LAI THANH TOÁN</span>
              </header>
              <div className="bc-receipt-lines">
                <span>Receipt no <strong>{receipt.data?.receipt?.receipt_no || selected.payment_no}</strong></span>
                <span>Invoice no <strong>{selected.invoice_id?.invoice_no || '-'}</strong></span>
                <span>Payment no <strong>{selected.payment_no}</strong></span>
                <span>Phương thức <strong>{METHOD_LABELS[selected.payment_method] || selected.payment_method}</strong></span>
                <span>Transaction ref <strong>{selected.transaction_ref || selected.transaction_reference || '-'}</strong></span>
                <span>Paid at <strong>{formatDateTime(selected.paid_at)}</strong></span>
              </div>
              <div className="bc-receipt-total">
                <span>Số tiền thu lần này</span>
                <strong>{formatMoney(selected.amount)}</strong>
              </div>
              <div className="bc-verify-box">
                <QrCode size={42} />
                <span>QR verify receipt</span>
              </div>
              <button type="button" className="bc-primary-button" onClick={printSelected}>
                <Printer size={16} />
                <span>In / ghi nhận lượt in</span>
              </button>
              <div className="bc-mini-table">
                <h3>Lịch sử in</h3>
                {(logs.data?.items || []).map((log) => (
                  <div key={log._id || log.id}>
                    <span>{formatDateTime(log.printed_at)}</span>
                    <strong>Copy #{log.copy_no}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </section>
    </CashierFrame>
  );
}

function PaymentReceiptTable({ items = [], selectedId, onSelect }) {
  if (!items.length) return <EmptyState label="Chưa có payment completed." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead>
          <tr>
            <th>Payment</th>
            <th>Invoice</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Paid at</th>
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((payment) => (
            <tr key={paymentId(payment)} className={selectedId === paymentId(payment) ? 'is-selected' : ''} onClick={() => onSelect?.(payment)}>
              <td><strong>{payment.payment_no}</strong><small>{payment.transaction_ref || payment.transaction_reference || '-'}</small></td>
              <td><span>{payment.invoice_id?.invoice_no || '-'}</span><small>{payment.invoice_id?.status || '-'}</small></td>
              <td><MoneyAmount value={payment.amount} compact /></td>
              <td><MethodBadge method={payment.payment_method} /></td>
              <td>{formatDateTime(payment.paid_at)}</td>
              <td><Printer size={17} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
