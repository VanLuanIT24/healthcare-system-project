import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  BellRing,
  CheckCircle2,
  Clock3,
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
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { billingOverviewAPI, getBillingOverviewErrorMessage } from './billingOverviewApi';

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
  pending: 'Chờ xử lý',
  pending_manual_confirmation: 'Chờ chuyển khoản',
  submitted_receipt: 'Đã gửi biên lai',
  manual_review: 'Manual review',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
  rejected: 'Bị từ chối',
  expired: 'Hết hạn',
  refunded_manual: 'Hoàn tiền thủ công',
  submitted: 'Đã gửi',
  under_review: 'Đang rà soát',
  settled: 'Đã quyết toán',
};

const METHOD_LABELS = {
  cash: 'Tiền mặt',
  qr: 'QR',
  qr_manual: 'QR thủ công',
  bank_transfer: 'Chuyển khoản',
  card: 'Thẻ',
  e_wallet: 'Ví điện tử',
  insurance: 'Bảo hiểm',
  other: 'Khác',
};

const ACTION_LABELS = {
  collect_payment: 'Thu tiền',
  create_qr: 'Tạo QR',
  view_invoice: 'Hóa đơn',
  print_invoice: 'In',
  view_receipt: 'Biên lai',
  confirm_transfer: 'Xác nhận',
  reject_transfer: 'Từ chối',
  manual_review: 'Review',
  retry_intent: 'Tạo lại QR',
  refund_payment: 'Refund',
  view_payment: 'Payment',
  copy_transaction_ref: 'Copy mã',
  create_invoice: 'Lên hóa đơn',
  view_charge: 'Charge',
  view_claim: 'Claim',
  review_claim: 'Rà soát',
  view_detail: 'Chi tiết',
  print_receipt: 'In biên lai',
};

const ACTION_ICONS = {
  collect_payment: WalletCards,
  create_qr: QrCode,
  view_invoice: ReceiptText,
  print_invoice: Printer,
  view_receipt: FileSearch,
  confirm_transfer: CheckCircle2,
  reject_transfer: X,
  manual_review: SlidersHorizontal,
  retry_intent: RefreshCcw,
  refund_payment: RefreshCcw,
  view_payment: CreditCard,
  copy_transaction_ref: FileText,
  create_invoice: ReceiptText,
  view_charge: FileText,
  view_claim: ShieldCheck,
  review_claim: ShieldCheck,
  view_detail: FileSearch,
  print_receipt: Printer,
};

const PAGE_META = {
  dashboard: {
    title: 'Dashboard viện phí',
    kicker: 'Command center',
    loader: billingOverviewAPI.dashboard,
  },
  tasks: {
    title: 'Việc cần xử lý',
    kicker: 'Work queue',
    loader: billingOverviewAPI.tasks,
  },
  todayRevenue: {
    title: 'Doanh thu hôm nay',
    kicker: 'Daily revenue',
    loader: billingOverviewAPI.todayRevenue,
  },
  unpaidInvoices: {
    title: 'Hóa đơn chờ thu',
    kicker: 'Receivables queue',
    loader: billingOverviewAPI.unpaidInvoices,
  },
  confirmations: {
    title: 'Payment cần xác nhận',
    kicker: 'Manual payment review',
    loader: billingOverviewAPI.paymentConfirmations,
  },
  errors: {
    title: 'Payment lỗi',
    kicker: 'Exception queue',
    loader: billingOverviewAPI.paymentErrors,
  },
  debts: {
    title: 'Công nợ',
    kicker: 'Aging and collection',
    loader: billingOverviewAPI.debts,
  },
  activity: {
    title: 'Giao dịch gần đây',
    kicker: 'Realtime billing feed',
    loader: billingOverviewAPI.activityFeed,
  },
};

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDateRange(dateValue) {
  const selected = dateValue || todayInputValue();
  const start = new Date(`${selected}T00:00:00`);
  const end = new Date(`${selected}T23:59:59.999`);
  return {
    date: selected,
    date_from: start.toISOString(),
    date_to: end.toISOString(),
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

function getItemId(item = {}) {
  return item.source_id || item.id || item.invoice?.id || item.payment?.id || item.intent?.id || item.payment_intent?.id;
}

function getItemPatient(item = {}) {
  return item.patient || item.invoice?.patient || item.payment?.patient || null;
}

function getItemInvoice(item = {}) {
  return item.invoice || null;
}

function getItemAmount(item = {}) {
  return item.amount ?? item.invoice?.balance_due ?? item.payment?.amount ?? item.intent?.amount ?? 0;
}

function statusTone(status = '') {
  if (['paid', 'completed', 'confirmed', 'settled'].includes(status)) return 'success';
  if (['failed', 'rejected', 'expired', 'cancelled'].includes(status)) return 'danger';
  if (['partially_paid', 'submitted_receipt', 'manual_review', 'refunded', 'voided'].includes(status)) return 'warning';
  return 'info';
}

function useOverviewData(pageKey, filters) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const meta = PAGE_META[pageKey] || PAGE_META.dashboard;

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    meta.loader(filters)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: getBillingOverviewErrorMessage(error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [meta, filters, version]);

  return {
    ...state,
    refresh: () => setVersion((current) => current + 1),
  };
}

function MoneyAmount({ value, compact = false }) {
  return (
    <span className={compact ? 'bo-money bo-money--compact' : 'bo-money'}>
      {formatMoney(value)}
    </span>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`bo-status bo-status--${statusTone(status)}`}>
      {STATUS_LABELS[status] || status || 'Không rõ'}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span className={`bo-priority bo-priority--${priority || 'normal'}`}>
      {priority === 'high' ? 'Ưu tiên cao' : priority === 'low' ? 'Thấp' : 'Bình thường'}
    </span>
  );
}

function CommandBar({ filters, setFilters, loading, onRefresh, onAction }) {
  return (
    <section className="bo-command-bar" aria-label="Bộ lọc tổng quan viện phí">
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
          <span>Phương thức</span>
          <select
            value={filters.payment_method || ''}
            onChange={(event) => setFilters((current) => ({ ...current, payment_method: event.target.value }))}
          >
            <option value="">Tất cả</option>
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản</option>
            <option value="qr">QR</option>
            <option value="card">Thẻ</option>
            <option value="e_wallet">Ví điện tử</option>
            <option value="insurance">Bảo hiểm</option>
          </select>
        </label>
        <label className="bo-command-bar__search">
          <Search size={16} aria-hidden="true" />
          <input
            value={filters.keyword || ''}
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            placeholder="Mã BN / Tên / Invoice / Payment / Transaction ref"
          />
        </label>
      </div>
      <div className="bo-command-bar__actions">
        <button type="button" onClick={() => onAction('collect_payment')}>
          <WalletCards size={16} />
          <span>Thu tiền</span>
        </button>
        <button type="button" onClick={() => onAction('create_qr')}>
          <QrCode size={16} />
          <span>Tạo QR</span>
        </button>
        <button type="button" onClick={() => onAction('confirm_transfer')}>
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

function KpiCard({ icon: Icon, label, value, meta, tone = 'blue', money = false }) {
  return (
    <article className={`bo-kpi bo-kpi--${tone}`}>
      <div className="bo-kpi__icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <div className="bo-kpi__body">
        <span>{label}</span>
        <strong>{money ? formatMoney(value) : formatNumber(value)}</strong>
        <small>{meta}</small>
      </div>
      <span className="bo-kpi__trend">
        {tone === 'danger' ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
      </span>
    </article>
  );
}

function BarSeries({ items = [], labelKey = 'label', valueKey = 'amount', money = true }) {
  const max = Math.max(1, ...items.map((item) => Number(item[valueKey] || 0)));
  return (
    <div className="bo-bar-series">
      {items.length ? items.map((item) => (
        <div className="bo-bar-row" key={item[labelKey] || item.hour || item.stage || item.payment_method}>
          <span>{item[labelKey] || item.hour || item.stage || METHOD_LABELS[item.payment_method] || item.payment_method}</span>
          <div>
            <i style={{ width: `${Math.max(4, (Number(item[valueKey] || 0) / max) * 100)}%` }} />
          </div>
          <strong>{money ? formatMoney(item[valueKey]) : formatNumber(item[valueKey])}</strong>
        </div>
      )) : <EmptyState compact label="Chưa có dữ liệu biểu đồ." />}
    </div>
  );
}

function MethodBreakdown({ items = [] }) {
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;
  return (
    <div className="bo-methods">
      {items.length ? items.map((item) => (
        <div className="bo-method" key={item.payment_method || item.service_type || item.status}>
          <span>
            <i style={{ width: `${Math.max(5, (Number(item.amount || 0) / total) * 100)}%` }} />
          </span>
          <strong>{METHOD_LABELS[item.payment_method] || STATUS_LABELS[item.status] || item.service_type || item.payment_method}</strong>
          <em>{formatMoney(item.amount)}</em>
        </div>
      )) : <EmptyState compact label="Chưa có dữ liệu phân bổ." />}
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

function EmptyState({ label = 'Chưa có dữ liệu.', compact = false }) {
  return (
    <div className={compact ? 'bo-empty bo-empty--compact' : 'bo-empty'}>
      <FileSearch size={compact ? 18 : 28} />
      <span>{label}</span>
    </div>
  );
}

function QueueTabs({ groups, active, setActive }) {
  return (
    <div className="bo-tabs" role="tablist">
      {groups.map((group) => (
        <button
          key={group.key}
          type="button"
          className={active === group.key ? 'is-active' : ''}
          onClick={() => setActive(group.key)}
        >
          <span>{group.label}</span>
          <strong>{group.count}</strong>
        </button>
      ))}
    </div>
  );
}

function PatientMini({ patient }) {
  if (!patient) return <span className="bo-muted">-</span>;
  return (
    <span className="bo-patient-mini">
      <UserRound size={15} />
      <span>
        <strong>{patient.full_name || 'Bệnh nhân'}</strong>
        <small>{patient.patient_code || patient.id || '-'}</small>
      </span>
    </span>
  );
}

function ActionButton({ action, item, onAction }) {
  const Icon = ACTION_ICONS[action] || FileSearch;
  return (
    <button type="button" className="bo-table-action" onClick={() => onAction(action, item)} title={ACTION_LABELS[action] || action}>
      <Icon size={14} />
      <span>{ACTION_LABELS[action] || action}</span>
    </button>
  );
}

function QueueTable({ items = [], mode = 'tasks', onSelect, onAction }) {
  if (!items.length) return <EmptyState label="Không có dòng nào trong hàng đợi này." />;

  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead>
          <tr>
            <th>Ưu tiên</th>
            <th>Bệnh nhân</th>
            <th>Object</th>
            <th>Số tiền</th>
            <th>Trạng thái</th>
            <th>{mode === 'debt' ? 'Aging' : 'Lý do'}</th>
            <th>Hoạt động</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const invoice = getItemInvoice(item);
            const patient = getItemPatient(item);
            const objectCode = item.intent?.intent_code || item.payment?.payment_no || invoice?.invoice_no || item.insurance_claim?.claim_no || getItemId(item);
            const status = item.intent?.status || item.payment?.status || invoice?.status || item.status;
            return (
              <tr key={`${item.id || getItemId(item)}-${item.type || mode}`} onClick={() => onSelect(item)}>
                <td><PriorityBadge priority={item.priority} /></td>
                <td><PatientMini patient={patient} /></td>
                <td>
                  <button type="button" className="bo-object-link" onClick={(event) => { event.stopPropagation(); onSelect(item); }}>
                    {objectCode || '-'}
                  </button>
                  <small>{item.type || item.source_type}</small>
                </td>
                <td><MoneyAmount value={getItemAmount(item)} compact /></td>
                <td><StatusBadge status={status} /></td>
                <td>{mode === 'debt' ? `${item.aging_days || 0} ngày` : item.reason || '-'}</td>
                <td>{formatDateTime(item.last_activity_at || item.at)}</td>
                <td>
                  <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                    {(item.actions || ['view_detail']).slice(0, 3).map((action) => (
                      <ActionButton key={action} action={action} item={item} onAction={onAction} />
                    ))}
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

function ActivityTimeline({ items = [], onSelect, onAction }) {
  if (!items.length) return <EmptyState label="Chưa có activity viện phí trong bộ lọc hiện tại." />;
  return (
    <div className="bo-timeline">
      {items.map((item) => (
        <article key={item.id} className={`bo-timeline-item bo-timeline-item--${item.severity || 'info'}`}>
          <span className="bo-timeline-item__dot" />
          <button type="button" className="bo-timeline-item__main" onClick={() => onSelect(item)}>
            <small>{formatDateTime(item.at)}</small>
            <strong>{item.message || item.type}</strong>
            <span>
              {[item.patient?.patient_code, item.invoice?.invoice_no, item.payment?.payment_no, item.payment_intent?.intent_code]
                .filter(Boolean)
                .join(' · ') || item.type}
            </span>
          </button>
          <MoneyAmount value={item.amount} compact />
          <div className="bo-row-actions">
            {(item.actions || ['view_detail']).slice(0, 2).map((action) => (
              <ActionButton key={action} action={action} item={item} onAction={onAction} />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function DetailDrawer({ item, onClose, onAction }) {
  if (!item) return null;
  const patient = getItemPatient(item);
  const invoice = getItemInvoice(item);
  const intent = item.intent || item.payment_intent;
  const payment = item.payment;
  const status = intent?.status || payment?.status || invoice?.status || item.status;

  return (
    <aside className="bo-drawer" aria-label="Chi tiết viện phí">
      <header>
        <div>
          <span>Chi tiết</span>
          <h2>{intent?.intent_code || payment?.payment_no || invoice?.invoice_no || item.type || 'Billing item'}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết">
          <X size={18} />
        </button>
      </header>
      <div className="bo-drawer__body">
        <section>
          <h3>Bệnh nhân</h3>
          <PatientMini patient={patient} />
        </section>
        <section>
          <h3>Invoice</h3>
          {invoice ? (
            <dl>
              <div><dt>Mã hóa đơn</dt><dd>{invoice.invoice_no}</dd></div>
              <div><dt>Tổng tiền</dt><dd>{formatMoney(invoice.total_amount)}</dd></div>
              <div><dt>Đã thu</dt><dd>{formatMoney(invoice.paid_amount)}</dd></div>
              <div><dt>Còn nợ</dt><dd>{formatMoney(invoice.balance_due)}</dd></div>
              <div><dt>Hạn thu</dt><dd>{formatDateTime(invoice.due_at)}</dd></div>
            </dl>
          ) : <EmptyState compact label="Không có invoice liên quan." />}
        </section>
        {intent ? (
          <section>
            <h3>Payment intent</h3>
            <div className="bo-qr-panel">
              {intent.qr_image_url ? <img src={intent.qr_image_url} alt="QR thanh toán" /> : <QrCode size={54} />}
              <div>
                <strong>{intent.intent_code}</strong>
                <span>{METHOD_LABELS[intent.method] || intent.method} · {intent.provider}</span>
                <MoneyAmount value={intent.amount} compact />
              </div>
            </div>
          </section>
        ) : null}
        {payment ? (
          <section>
            <h3>Payment</h3>
            <dl>
              <div><dt>Mã payment</dt><dd>{payment.payment_no}</dd></div>
              <div><dt>Phương thức</dt><dd>{METHOD_LABELS[payment.payment_method] || payment.payment_method}</dd></div>
              <div><dt>Mã giao dịch</dt><dd>{payment.transaction_ref || '-'}</dd></div>
              <div><dt>Số tiền</dt><dd>{formatMoney(payment.amount)}</dd></div>
            </dl>
          </section>
        ) : null}
        <section>
          <h3>Trạng thái</h3>
          <StatusBadge status={status} />
          <p>{item.reason || item.message || 'Không có ghi chú bổ sung.'}</p>
        </section>
        <section>
          <h3>Thao tác hợp lệ</h3>
          <div className="bo-drawer__actions">
            {(item.actions || ['view_detail']).map((action) => (
              <ActionButton key={action} action={action} item={item} onAction={onAction} />
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function QuickActionModal({ action, item, onClose, onDone }) {
  const [form, setForm] = useState(() => ({
    invoice_id: item?.invoice?.id || '',
    amount: item ? getItemAmount(item) : '',
    payment_method: 'cash',
    provider: 'bank_qr_manual',
    transaction_reference: item?.intent?.transaction_reference || '',
    paid_at: new Date().toISOString().slice(0, 16),
    reason: '',
    note: '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const invoiceId = item?.invoice?.id || form.invoice_id;
  const intentId = item?.intent?.id || item?.payment_intent?.id || (item?.source_type === 'payment_intent' ? item.source_id : null);
  const title = ACTION_LABELS[action] || 'Thao tác viện phí';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (action === 'collect_payment') {
        if (!invoiceId) throw new Error('Chọn invoice trước khi thu tiền.');
        await billingOverviewAPI.createInvoicePayment(invoiceId, {
          amount: Number(form.amount),
          payment_method: form.payment_method,
          transaction_ref: form.transaction_reference || undefined,
          paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : undefined,
          note: form.note || undefined,
        });
      } else if (action === 'create_qr' || action === 'retry_intent') {
        if (!invoiceId) throw new Error('Chọn invoice trước khi tạo QR.');
        await billingOverviewAPI.createPaymentIntent(invoiceId, {
          provider: form.provider,
          amount: form.amount ? Number(form.amount) : undefined,
          force_new: action === 'retry_intent',
          allow_partial: Boolean(form.amount),
          note: form.note || undefined,
        });
      } else if (action === 'confirm_transfer') {
        if (!intentId) throw new Error('Chọn payment intent trước khi xác nhận.');
        await billingOverviewAPI.confirmManualPayment(intentId, {
          received_amount: Number(form.amount),
          transaction_reference: form.transaction_reference,
          paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : undefined,
          note: form.note || undefined,
        });
      } else if (action === 'reject_transfer') {
        if (!intentId) throw new Error('Chọn payment intent trước khi từ chối.');
        await billingOverviewAPI.rejectManualPayment(intentId, {
          reason: form.reason || form.note,
          note: form.note || undefined,
        });
      } else if (action === 'manual_review') {
        if (!intentId) throw new Error('Chọn payment intent trước khi review.');
        await billingOverviewAPI.markManualReview(intentId, {
          reason: form.reason || form.note,
          received_amount: form.amount ? Number(form.amount) : undefined,
          transaction_reference: form.transaction_reference || undefined,
          note: form.note || undefined,
        });
      } else {
        onClose();
        return;
      }
      onDone();
    } catch (modalError) {
      setError(getBillingOverviewErrorMessage(modalError, modalError.message || 'Không thể thực hiện thao tác.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bo-modal-backdrop" role="presentation">
      <form className="bo-modal" onSubmit={submit}>
        <header>
          <div>
            <span>Quick action</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng modal">
            <X size={18} />
          </button>
        </header>
        {error ? <div className="bo-alert bo-alert--danger">{error}</div> : null}
        <div className="bo-modal__grid">
          {['collect_payment', 'create_qr', 'retry_intent'].includes(action) ? (
            <label className="bo-modal__wide">
              <span>Invoice ID</span>
              <input
                value={form.invoice_id}
                onChange={(event) => setForm((current) => ({ ...current, invoice_id: event.target.value }))}
                placeholder="Chọn dòng invoice hoặc nhập invoice id"
                required
              />
            </label>
          ) : null}
          {['collect_payment', 'confirm_transfer', 'create_qr', 'retry_intent', 'manual_review'].includes(action) ? (
            <label>
              <span>Số tiền</span>
              <input type="number" min="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            </label>
          ) : null}
          {action === 'collect_payment' ? (
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
          ) : null}
          {['create_qr', 'retry_intent'].includes(action) ? (
            <label>
              <span>Provider</span>
              <select value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}>
                <option value="bank_qr_manual">Bank QR manual</option>
                <option value="momo_personal_qr">Momo personal QR</option>
                <option value="cash_manual">Cash manual</option>
              </select>
            </label>
          ) : null}
          {['collect_payment', 'confirm_transfer', 'manual_review'].includes(action) ? (
            <label>
              <span>Transaction ref</span>
              <input value={form.transaction_reference} onChange={(event) => setForm((current) => ({ ...current, transaction_reference: event.target.value }))} />
            </label>
          ) : null}
          {['collect_payment', 'confirm_transfer'].includes(action) ? (
            <label>
              <span>Paid at</span>
              <input type="datetime-local" value={form.paid_at} onChange={(event) => setForm((current) => ({ ...current, paid_at: event.target.value }))} />
            </label>
          ) : null}
          {['reject_transfer', 'manual_review'].includes(action) ? (
            <label className="bo-modal__wide">
              <span>Lý do</span>
              <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
            </label>
          ) : null}
          <label className="bo-modal__wide">
            <span>Ghi chú</span>
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows={3} />
          </label>
        </div>
        <footer>
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="bo-spin" /> : <CheckCircle2 size={16} />}
            <span>Thực hiện</span>
          </button>
        </footer>
      </form>
    </div>
  );
}

function OverviewFrame({ pageKey, children }) {
  const meta = PAGE_META[pageKey] || PAGE_META.dashboard;
  const [filters, setFilters] = useState(() => ({
    ...getDateRange(todayInputValue()),
    department_id: '',
    payment_method: '',
    keyword: '',
    limit: 40,
  }));
  const { data, loading, error, refresh } = useOverviewData(pageKey, filters);
  const [selected, setSelected] = useState(null);
  const [modalAction, setModalAction] = useState(null);

  function handleAction(action, item) {
    if (action === 'view_invoice' || action === 'view_payment' || action === 'view_detail' || action === 'view_receipt') {
      setSelected(item);
      return;
    }
    if (action === 'print_invoice' || action === 'print_receipt') {
      window.print();
      return;
    }
    if (action === 'copy_transaction_ref') {
      const ref = item?.payment?.transaction_ref || item?.intent?.transaction_reference || item?.transaction_reference || '';
      if (ref) navigator.clipboard?.writeText(ref);
      return;
    }
    setSelected(item || selected);
    setModalAction(action);
  }

  return (
    <section className="billing-overview">
      <header className="bo-page-header">
        <div>
          <span>{meta.kicker}</span>
          <h1>{meta.title}</h1>
        </div>
        <div className="bo-refresh-indicator">
          {loading ? <Loader2 size={16} className="bo-spin" /> : <Clock3 size={16} />}
          <span>Auto refresh 30s</span>
        </div>
      </header>

      <CommandBar
        filters={filters}
        setFilters={setFilters}
        loading={loading}
        onRefresh={refresh}
        onAction={(action) => handleAction(action, selected)}
      />

      {error ? <div className="bo-alert bo-alert--danger">{error}</div> : null}
      {children({ data: data || {}, loading, error, refresh, selected, setSelected, handleAction })}

      <DetailDrawer item={selected} onClose={() => setSelected(null)} onAction={handleAction} />
      {modalAction ? (
        <QuickActionModal
          action={modalAction}
          item={selected}
          onClose={() => setModalAction(null)}
          onDone={() => {
            setModalAction(null);
            refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function DashboardContent({ data, setSelected, handleAction }) {
  const kpi = data.kpi || {};
  const charts = data.charts || {};
  const queues = data.priority_queues || {};
  const [activeQueue, setActiveQueue] = useState('unpaid_invoices');
  const groups = [
    { key: 'unpaid_invoices', label: 'Chờ thu', count: queues.unpaid_invoices?.length || 0 },
    { key: 'payment_confirmations', label: 'Chờ xác nhận QR', count: queues.payment_confirmations?.length || 0 },
    { key: 'payment_errors', label: 'Payment lỗi', count: queues.payment_errors?.length || 0 },
    { key: 'refund_requests', label: 'Refund', count: queues.refund_requests?.length || 0 },
    { key: 'overdue_debts', label: 'Quá hạn', count: queues.overdue_debts?.length || 0 },
  ];

  return (
    <>
      <div className="bo-kpi-grid">
        <KpiCard icon={Banknote} label="Doanh thu thực thu" value={kpi.today_revenue} money meta={`${formatNumber(kpi.today_payment_count)} giao dịch completed`} tone="green" />
        <KpiCard icon={ReceiptText} label="Hóa đơn hôm nay" value={kpi.issued_invoice_amount_today} money meta={`${formatNumber(kpi.issued_invoice_count_today)} hóa đơn phát hành`} />
        <KpiCard icon={WalletCards} label="Tổng công nợ" value={kpi.unpaid_balance_total} money meta={`${formatNumber(kpi.unpaid_invoice_count)} hóa đơn còn nợ`} tone="violet" />
        <KpiCard icon={Clock3} label="Payment cần xác nhận" value={(kpi.pending_manual_payment_count || 0) + (kpi.submitted_receipt_count || 0)} meta={`${formatNumber(kpi.manual_review_count)} manual review`} tone="amber" />
        <KpiCard icon={AlertTriangle} label="Payment lỗi" value={kpi.failed_payment_count} meta={`${formatNumber(kpi.refund_requested_count)} refund request`} tone="danger" />
        <KpiCard icon={BellRing} label="Công nợ quá hạn" value={kpi.overdue_balance_total} money meta={`${formatNumber(kpi.overdue_invoice_count)} invoice quá hạn`} tone="rose" />
      </div>

      <div className="bo-grid bo-grid--dashboard">
        <Panel title="Doanh thu theo giờ">
          <BarSeries items={charts.revenue_by_hour || []} labelKey="hour" />
        </Panel>
        <Panel title="Cơ cấu phương thức">
          <MethodBreakdown items={charts.payment_by_method || []} />
        </Panel>
        <Panel title="Phễu thu tiền">
          <BarSeries items={charts.collection_funnel || []} labelKey="stage" />
        </Panel>
      </div>

      <div className="bo-grid bo-grid--queues">
        <Panel title="Hàng đợi ưu tiên" className="bo-panel--wide">
          <QueueTabs groups={groups} active={activeQueue} setActive={setActiveQueue} />
          <QueueTable items={queues[activeQueue] || []} onSelect={setSelected} onAction={handleAction} />
        </Panel>
        <Panel title="Activity realtime">
          <ActivityTimeline items={data.recent_activity || []} onSelect={setSelected} onAction={handleAction} />
        </Panel>
      </div>
    </>
  );
}

function TasksContent({ data, setSelected, handleAction }) {
  const groups = data.groups || {};
  const [active, setActive] = useState('submitted_receipts');
  const groupDefs = [
    ['submitted_receipts', 'Đã gửi biên lai'],
    ['pending_confirmations', 'Cần xác nhận'],
    ['manual_reviews', 'Cần review'],
    ['invoices_to_collect', 'Cần thu'],
    ['payment_errors', 'Lỗi'],
    ['overdue_debts', 'Quá hạn'],
    ['refund_requests', 'Refund'],
    ['insurance_claims', 'Bảo hiểm'],
    ['charges_waiting_invoice', 'Charge chờ invoice'],
  ].map(([key, label]) => ({ key, label, count: groups[key]?.length || 0 }));
  const summary = data.summary || {};

  return (
    <>
      <div className="bo-kpi-grid bo-kpi-grid--compact">
        <KpiCard icon={ClipboardIcon} label="Tất cả việc" value={summary.total} meta="Trong hàng đợi hiện tại" tone="blue" />
        <KpiCard icon={AlertTriangle} label="Ưu tiên cao" value={summary.high_priority} meta="Cần xử lý trước" tone="danger" />
        <KpiCard icon={Clock3} label="Quá SLA" value={summary.overdue_sla} meta="Quá hạn hoặc cận hạn" tone="amber" />
        <KpiCard icon={CheckCircle2} label="Payment cần xác nhận" value={summary.payment_confirmations} meta="QR/chuyển khoản" tone="green" />
      </div>
      <Panel title="Task board">
        <QueueTabs groups={groupDefs} active={active} setActive={setActive} />
        <QueueTable items={groups[active] || []} onSelect={setSelected} onAction={handleAction} />
      </Panel>
    </>
  );
}

function ClipboardIcon(props) {
  return <FileText {...props} />;
}

function TodayRevenueContent({ data, setSelected, handleAction }) {
  const summary = data.summary || {};
  const paymentRows = data.completed_payments || [];
  return (
    <>
      <div className="bo-kpi-grid">
        <KpiCard icon={Banknote} label="Tổng thực thu" value={summary.paid_amount} money meta={`${formatNumber(summary.payment_count)} giao dịch`} tone="green" />
        <KpiCard icon={ReceiptText} label="Hóa đơn phát hành" value={summary.issued_invoice_amount} money meta={`${formatNumber(summary.invoice_count)} hóa đơn`} />
        <KpiCard icon={FileText} label="Charge phát sinh" value={summary.gross_charges} money meta={`${formatNumber(summary.charge_count)} charge`} tone="violet" />
        <KpiCard icon={RefreshCcw} label="Refund/Void" value={(summary.refund_amount || 0) + (summary.voided_amount || 0)} money meta={`${formatNumber((summary.refund_count || 0) + (summary.voided_count || 0))} giao dịch`} tone="danger" />
      </div>
      <div className="bo-grid bo-grid--dashboard">
        <Panel title="Doanh thu theo giờ">
          <BarSeries items={data.revenue_by_hour || []} labelKey="hour" />
        </Panel>
        <Panel title="Theo phương thức">
          <MethodBreakdown items={data.payment_by_method || []} />
        </Panel>
        <Panel title="Top dịch vụ">
          <BarSeries items={(data.top_services || []).map((item) => ({ ...item, label: item.service_name }))} labelKey="label" />
        </Panel>
      </div>
      <Panel title="Giao dịch completed hôm nay">
        <QueueTable
          items={paymentRows.map((payment) => ({
            id: payment.id,
            type: 'completed_payment',
            source_type: 'payment',
            source_id: payment.id,
            priority: 'normal',
            patient: payment.patient,
            invoice: payment.invoice,
            payment,
            amount: payment.amount,
            status: payment.status,
            reason: METHOD_LABELS[payment.payment_method] || payment.payment_method,
            last_activity_at: payment.paid_at,
            actions: ['view_payment', 'print_receipt', 'copy_transaction_ref'],
          }))}
          onSelect={setSelected}
          onAction={handleAction}
        />
      </Panel>
    </>
  );
}

function QueuePageContent({ data, setSelected, handleAction, mode = 'tasks', title = 'Danh sách' }) {
  return (
    <Panel title={title}>
      <QueueTable items={data.items || []} mode={mode} onSelect={setSelected} onAction={handleAction} />
    </Panel>
  );
}

function DebtsContent({ data, setSelected, handleAction }) {
  const summary = data.summary || {};
  return (
    <>
      <div className="bo-kpi-grid">
        <KpiCard icon={WalletCards} label="Tổng công nợ" value={summary.total_outstanding} money meta={`${formatNumber(summary.invoice_count)} invoice`} tone="violet" />
        <KpiCard icon={UserRound} label="Bệnh nhân còn nợ" value={summary.patient_count} meta="Số người có balance_due" />
        <KpiCard icon={AlertTriangle} label="Công nợ quá hạn" value={summary.overdue_amount} money meta={`${formatNumber(summary.overdue_count)} invoice`} tone="danger" />
        <KpiCard icon={Clock3} label="Partial paid" value={summary.partial_paid_amount} money meta={`${formatNumber(summary.partial_paid_count)} invoice`} tone="amber" />
      </div>
      <div className="bo-grid bo-grid--debt">
        <Panel title="Aging buckets">
          <BarSeries items={data.aging_buckets || []} labelKey="bucket" />
        </Panel>
        <Panel title="Công nợ cần thu" className="bo-panel--wide">
          <QueueTable items={data.items || []} mode="debt" onSelect={setSelected} onAction={handleAction} />
        </Panel>
      </div>
    </>
  );
}

function ActivityContent({ data, setSelected, handleAction }) {
  return (
    <Panel title="Timeline viện phí">
      <ActivityTimeline items={data.items || []} onSelect={setSelected} onAction={handleAction} />
    </Panel>
  );
}

export function BillingDashboardPage() {
  return (
    <OverviewFrame pageKey="dashboard">
      {(props) => <DashboardContent {...props} />}
    </OverviewFrame>
  );
}

export function BillingTasksPage() {
  return (
    <OverviewFrame pageKey="tasks">
      {(props) => <TasksContent {...props} />}
    </OverviewFrame>
  );
}

export function BillingTodayRevenuePage() {
  return (
    <OverviewFrame pageKey="todayRevenue">
      {(props) => <TodayRevenueContent {...props} />}
    </OverviewFrame>
  );
}

export function BillingUnpaidInvoicesPage() {
  return (
    <OverviewFrame pageKey="unpaidInvoices">
      {(props) => <QueuePageContent {...props} title="Hóa đơn chưa thu đủ" />}
    </OverviewFrame>
  );
}

export function BillingPaymentConfirmationsPage() {
  return (
    <OverviewFrame pageKey="confirmations">
      {(props) => <QueuePageContent {...props} title="QR/chuyển khoản cần xác nhận" />}
    </OverviewFrame>
  );
}

export function BillingPaymentErrorsPage() {
  return (
    <OverviewFrame pageKey="errors">
      {(props) => <QueuePageContent {...props} title="Payment và intent bất thường" />}
    </OverviewFrame>
  );
}

export function BillingDebtsPage() {
  return (
    <OverviewFrame pageKey="debts">
      {(props) => <DebtsContent {...props} />}
    </OverviewFrame>
  );
}

export function BillingActivityPage() {
  return (
    <OverviewFrame pageKey="activity">
      {(props) => <ActivityContent {...props} />}
    </OverviewFrame>
  );
}
