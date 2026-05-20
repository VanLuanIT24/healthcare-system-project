import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileSearch,
  FileText,
  Loader2,
  QrCode,
  ReceiptText,
  RefreshCcw,
  Search,
  WalletCards,
  X,
} from 'lucide-react';
import { billingAPI, getApiErrorMessage, request, unwrapData } from '../utils/api';

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
  paid: 'Đã thanh toán',
  voided: 'Đã hủy',
  cancelled: 'Đã hủy',
  pending: 'Chờ xử lý',
  posted: 'Đã ghi nhận',
  billed: 'Đã lên hóa đơn',
  completed: 'Hoàn tất',
  confirmed: 'Đã xác nhận',
  pending_manual_confirmation: 'Chờ xác nhận',
  submitted_receipt: 'Đã gửi biên lai',
  manual_review: 'Chờ rà soát',
  failed: 'Thất bại',
  rejected: 'Bị từ chối',
  expired: 'Hết hạn',
  refunded: 'Đã hoàn tiền',
  refunded_manual: 'Hoàn tiền thủ công',
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

const INVOICE_VIEWS = {
  all: { title: 'Tất cả hóa đơn', query: {} },
  draft: { title: 'Hóa đơn nháp', query: { status: 'draft' } },
  issued: { title: 'Hóa đơn đã phát hành', query: { status: 'issued' } },
  unpaid: { title: 'Hóa đơn chưa thanh toán', query: { payment_state: 'unpaid' } },
  'partial-paid': { title: 'Hóa đơn thanh toán một phần', query: { payment_state: 'partially_paid' } },
  paid: { title: 'Hóa đơn đã thanh toán', query: { payment_state: 'paid' } },
  overdue: { title: 'Hóa đơn quá hạn', query: { overdue: 'true' } },
  cancelled: { title: 'Hóa đơn đã hủy', query: { status: 'cancelled' } },
  adjustments: { title: 'Điều chỉnh hóa đơn', query: { status: 'voided' } },
};

const CHARGE_VIEWS = {
  all: { title: 'Tất cả khoản tính phí', query: {} },
  create: { title: 'Tạo khoản tính phí', create: true, query: {} },
  'pending-post': { title: 'Khoản tính phí chờ ghi nhận', query: { status: 'pending' } },
  posted: { title: 'Khoản tính phí đã ghi nhận', query: { status: 'posted' } },
  uninvoiced: { title: 'Khoản tính phí chưa lên hóa đơn', query: { status: 'posted', has_invoice: 'false' } },
  invoiced: { title: 'Khoản tính phí đã lên hóa đơn', query: { has_invoice: 'true' } },
  'by-visit': { title: 'Khoản tính phí theo lượt khám', query: {} },
  'by-service': { title: 'Khoản tính phí theo dịch vụ', query: {} },
  'cancelled-needs-processing': { title: 'Khoản tính phí đã hủy / cần xử lý', query: { status: 'voided' } },
};

const PAYMENT_VIEWS = {
  intents: { title: 'Yêu cầu thanh toán', source: 'intents', query: {} },
  waiting: { title: 'Chờ thanh toán', source: 'intents', query: { status: 'pending' } },
  'manual-confirmation': {
    title: 'Chờ xác nhận thủ công',
    source: 'manual',
    query: { status: 'pending_manual_confirmation,submitted_receipt' },
  },
  'manual-review': { title: 'Chờ rà soát thủ công', source: 'manual', query: { status: 'manual_review' } },
  all: { title: 'Tất cả thanh toán', source: 'payments', query: {} },
  completed: { title: 'Thanh toán hoàn tất', source: 'payments', query: { status: 'completed' } },
  'failed-rejected': {
    title: 'Thanh toán thất bại / bị từ chối',
    source: 'payments',
    query: {},
    clientStatuses: ['failed', 'rejected'],
  },
  'expired-cancelled': {
    title: 'Thanh toán hết hạn / đã hủy',
    source: 'intents',
    query: {},
    clientStatuses: ['expired', 'cancelled'],
  },
  'refunded-cancelled': {
    title: 'Thanh toán đã hoàn tiền / đã hủy',
    source: 'payments',
    query: {},
    clientStatuses: ['refunded', 'refunded_manual', 'voided', 'cancelled'],
  },
};

function unwrap(response) {
  return unwrapData(response) || {};
}

function listPaymentIntents(params) {
  return request('/billing/payment-intents', { params });
}

function listManualPayments(params) {
  return request('/billing/manual-payments', { params });
}

function createPaymentIntent(invoiceId, body = {}) {
  return request(`/billing/invoices/${encodeURIComponent(invoiceId)}/payment-intents`, { method: 'POST', body });
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatDate(value) {
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
  if (['paid', 'completed', 'confirmed', 'posted', 'billed'].includes(status)) return 'success';
  if (['failed', 'rejected', 'expired', 'cancelled', 'voided'].includes(status)) return 'danger';
  if (['partially_paid', 'pending', 'pending_manual_confirmation', 'submitted_receipt', 'manual_review', 'refunded', 'refunded_manual'].includes(status)) return 'warning';
  return 'info';
}

function StatusBadge({ status }) {
  return <span className={`bo-status bo-status--${statusTone(status)}`}>{STATUS_LABELS[status] || status || '-'}</span>;
}

function EmptyState({ label = 'Chưa có dữ liệu.' }) {
  return (
    <div className="bo-empty">
      <FileSearch size={28} />
      <span>{label}</span>
    </div>
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

function getId(row = {}) {
  return row._id || row.id || row.invoice_id || row.payment_intent_id || row.payment_id;
}

function getObjectId(value) {
  if (!value) return null;
  if (typeof value === 'object') return value._id || value.id || null;
  return value;
}

function getPatient(row = {}) {
  const patient = row.patient || row.patient_id || row.invoice?.patient || null;
  return patient && typeof patient === 'object' ? patient : null;
}

function patientName(row = {}) {
  const patient = getPatient(row);
  return patient?.full_name || patient?.patient_code || row.patient_name || row.patient_code || '-';
}

function patientSub(row = {}) {
  const patient = getPatient(row);
  return [patient?.patient_code, patient?.phone].filter(Boolean).join(' · ');
}

function rowText(row = {}) {
  return [
    row.invoice_no,
    row.charge_no,
    row.payment_no,
    row.intent_code,
    row.transaction_ref,
    row.transaction_reference,
    row.description,
    row.service_id?.service_name,
    row.invoice_id?.invoice_no,
    patientName(row),
    patientSub(row),
  ].filter(Boolean).join(' ').toLowerCase();
}

function useBillingRows(loader, params) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loader(params)
      .then((response) => {
        if (!cancelled) setState({ data: unwrap(response), loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error: getApiErrorMessage(error, 'Không thể tải dữ liệu viện phí.') });
      });
    return () => {
      cancelled = true;
    };
  }, [loader, key, version]);

  return {
    ...state,
    refresh: () => setVersion((current) => current + 1),
  };
}

function BillingEntityFrame({ title, subtitle, filters, setFilters, loading, error, onRefresh, children }) {
  return (
    <section className="billing-overview">
      <header className="bo-page-header">
        <div>
          <span>Viện phí</span>
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="bo-refresh-indicator">
          {loading ? <Loader2 size={16} className="bo-spin" /> : <Clock3 size={16} />}
          <span>Dữ liệu trực tiếp</span>
        </div>
      </header>

      <section className="bo-command-bar" aria-label="Bộ lọc viện phí">
        <div className="bo-command-bar__filters">
          <label className="bo-command-bar__search">
            <Search size={16} aria-hidden="true" />
            <input
              value={filters.keyword}
              onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="Tìm mã, bệnh nhân, invoice, payment, dịch vụ"
            />
          </label>
          <label>
            <span>Giới hạn</span>
            <select
              value={filters.limit}
              onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value) }))}
            >
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
              <option value={100}>100 dòng</option>
            </select>
          </label>
        </div>
        <div className="bo-command-bar__actions">
          <button type="button" onClick={onRefresh}>
            {loading ? <Loader2 size={16} className="bo-spin" /> : <RefreshCcw size={16} />}
            <span>Tải lại</span>
          </button>
        </div>
      </section>

      {error ? <div className="bo-alert bo-alert--danger"><AlertTriangle size={16} />{error}</div> : null}
      {children}
    </section>
  );
}

function EntityKpis({ entity, rows = [], pagination }) {
  const totalAmount = rows.reduce((sum, row) => sum + Number(row.total_amount || row.amount || 0), 0);
  const balanceDue = rows.reduce((sum, row) => sum + Number(row.balance_due || 0), 0);
  const total = pagination?.total ?? rows.length;

  return (
    <div className="bo-kpi-grid bo-kpi-grid--compact">
      <KpiCard icon={FileText} label="Tổng dòng" value={total} meta="Theo bộ lọc hiện tại" />
      <KpiCard icon={Banknote} label={entity === 'payments' ? 'Số tiền' : 'Tổng giá trị'} value={totalAmount} money meta="Tính trên trang đang xem" tone="green" />
      <KpiCard icon={WalletCards} label="Còn phải thu" value={balanceDue} money meta="Balance due trên trang" tone="amber" />
      <KpiCard icon={BadgeCheck} label="Đang hiển thị" value={rows.length} meta={`Page ${pagination?.page || 1}`} tone="violet" />
    </div>
  );
}

function InvoiceTable({ rows, onOpen, onAction }) {
  if (!rows.length) return <EmptyState label="Không có hóa đơn trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead>
          <tr>
            <th>Hóa đơn</th>
            <th>Bệnh nhân</th>
            <th>Ngày phát hành</th>
            <th>Tổng tiền</th>
            <th>Đã thu</th>
            <th>Còn nợ</th>
            <th>Trạng thái</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} onClick={() => onOpen(row)}>
              <td><strong>{row.invoice_no || getId(row)}</strong><small>{row.due_at ? `Hạn ${formatDate(row.due_at)}` : '-'}</small></td>
              <td><strong>{patientName(row)}</strong><small>{patientSub(row)}</small></td>
              <td>{formatDate(row.issued_at || row.created_at)}</td>
              <td>{formatMoney(row.total_amount)}</td>
              <td>{formatMoney(row.paid_amount)}</td>
              <td>{formatMoney(row.balance_due)}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                  {row.status === 'draft' ? <button type="button" className="bo-table-action" onClick={() => onAction('issue_invoice', row)}>Issue</button> : null}
                  {['issued', 'partially_paid'].includes(row.status) ? <button type="button" className="bo-table-action" onClick={() => onAction('collect_payment', row)}>Thu</button> : null}
                  {['issued', 'partially_paid'].includes(row.status) ? <button type="button" className="bo-table-action" onClick={() => onAction('create_qr', row)}><QrCode size={14} />QR</button> : null}
                  {!['paid', 'voided', 'cancelled'].includes(row.status) ? <button type="button" className="bo-table-action" onClick={() => onAction('void_invoice', row)}>Hủy</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChargeTable({ rows, onOpen, onAction }) {
  if (!rows.length) return <EmptyState label="Không có khoản tính phí trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead>
          <tr>
            <th>Khoản phí</th>
            <th>Bệnh nhân</th>
            <th>Dịch vụ</th>
            <th>SL</th>
            <th>Tổng tiền</th>
            <th>Invoice</th>
            <th>Trạng thái</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} onClick={() => onOpen(row)}>
              <td><strong>{row.charge_no || getId(row)}</strong><small>{formatDate(row.charged_at || row.created_at)}</small></td>
              <td><strong>{patientName(row)}</strong><small>{patientSub(row)}</small></td>
              <td><strong>{row.service_id?.service_name || row.description || '-'}</strong><small>{row.service_id?.service_code || row.source_module || '-'}</small></td>
              <td>{formatNumber(row.quantity || 1)}</td>
              <td>{formatMoney(row.total_amount)}</td>
              <td><span>{row.invoice_id?.invoice_no || '-'}</span><small>{row.invoice_id?.status || ''}</small></td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                  {['pending', 'draft'].includes(row.status) ? <button type="button" className="bo-table-action" onClick={() => onAction('post_charge', row)}>Post</button> : null}
                  {row.status === 'posted' && !row.invoice_id ? <button type="button" className="bo-table-action" onClick={() => onAction('invoice_charge', row)}>Lên HĐ</button> : null}
                  {['pending', 'draft', 'posted'].includes(row.status) && !row.invoice_id ? <button type="button" className="bo-table-action" onClick={() => onAction('void_charge', row)}>Void</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentTable({ rows, source, onOpen, onAction }) {
  if (!rows.length) return <EmptyState label="Không có thanh toán trong bộ lọc này." />;
  const isIntent = source !== 'payments';
  return (
    <div className="bo-table-wrap">
      <table className="bo-table">
        <thead>
          <tr>
            <th>{isIntent ? 'Payment intent' : 'Payment'}</th>
            <th>Bệnh nhân</th>
            <th>Invoice</th>
            <th>Phương thức</th>
            <th>Số tiền</th>
            <th>Giao dịch</th>
            <th>Trạng thái</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} onClick={() => onOpen(row)}>
              <td><strong>{row.intent_code || row.payment_no || row.payment_intent_id || getId(row)}</strong><small>{formatDate(row.paid_at || row.created_at)}</small></td>
              <td><strong>{patientName(row)}</strong><small>{patientSub(row)}</small></td>
              <td><span>{row.invoice_id?.invoice_no || getObjectId(row.invoice_id) || '-'}</span><small>{row.invoice_id?.status || ''}</small></td>
              <td>{METHOD_LABELS[row.payment_method || row.method] || row.provider || '-'}</td>
              <td>{formatMoney(row.amount)}</td>
              <td>{row.transaction_ref || row.transaction_reference || row.provider_order_id || '-'}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                  {!isIntent && ['completed', 'confirmed'].includes(row.status) ? <button type="button" className="bo-table-action" onClick={() => onAction('refund_payment', row)}>Refund</button> : null}
                  {!isIntent && !['voided', 'refunded'].includes(row.status) ? <button type="button" className="bo-table-action" onClick={() => onAction('void_payment', row)}>Void</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({ row, onClose }) {
  if (!row) return null;
  return (
    <aside className="bo-drawer" aria-label="Chi tiết viện phí">
      <header>
        <div>
          <span>Chi tiết</span>
          <h2>{row.invoice_no || row.charge_no || row.payment_no || row.intent_code || getId(row)}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><X size={18} /></button>
      </header>
      <div className="bo-drawer__body">
        <section>
          <h3>Bệnh nhân</h3>
          <p>{patientName(row)}</p>
          <small>{patientSub(row)}</small>
        </section>
        <section>
          <h3>Trạng thái</h3>
          <StatusBadge status={row.status} />
        </section>
        <section>
          <h3>Số tiền</h3>
          <dl>
            <div><dt>Tổng</dt><dd>{formatMoney(row.total_amount || row.amount)}</dd></div>
            <div><dt>Đã thu</dt><dd>{formatMoney(row.paid_amount)}</dd></div>
            <div><dt>Còn nợ</dt><dd>{formatMoney(row.balance_due)}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Dữ liệu thô</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{JSON.stringify(row, null, 2)}</pre>
        </section>
      </div>
    </aside>
  );
}

function ChargeCreatePanel({ onCreated }) {
  const [form, setForm] = useState({
    patient_id: '',
    encounter_id: '',
    service_id: '',
    quantity: 1,
    unit_price: '',
    description: '',
    status: 'pending',
  });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  function patch(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setState({ loading: true, error: '', success: '' });
    try {
      await billingAPI.createCharge({
        ...form,
        quantity: Number(form.quantity || 1),
        unit_price: form.unit_price === '' ? undefined : Number(form.unit_price),
        encounter_id: form.encounter_id || undefined,
        description: form.description || undefined,
      });
      setState({ loading: false, error: '', success: 'Đã tạo khoản tính phí.' });
      onCreated?.();
    } catch (error) {
      setState({ loading: false, error: getApiErrorMessage(error, 'Không thể tạo khoản tính phí.'), success: '' });
    }
  }

  return (
    <section className="bo-panel">
      <header className="bo-panel__header">
        <h2>Tạo khoản tính phí thủ công</h2>
      </header>
      <form className="be-form" onSubmit={submit}>
        <label>
          <span>Patient ID</span>
          <input value={form.patient_id} onChange={(event) => patch('patient_id', event.target.value)} required />
        </label>
        <label>
          <span>Encounter ID</span>
          <input value={form.encounter_id} onChange={(event) => patch('encounter_id', event.target.value)} />
        </label>
        <label>
          <span>Service ID</span>
          <input value={form.service_id} onChange={(event) => patch('service_id', event.target.value)} required />
        </label>
        <label>
          <span>Số lượng</span>
          <input type="number" min="1" value={form.quantity} onChange={(event) => patch('quantity', event.target.value)} />
        </label>
        <label>
          <span>Đơn giá override</span>
          <input type="number" min="0" value={form.unit_price} onChange={(event) => patch('unit_price', event.target.value)} placeholder="Bỏ trống để lấy bảng giá" />
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={form.status} onChange={(event) => patch('status', event.target.value)}>
            <option value="pending">Pending</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
          </select>
        </label>
        <label className="be-form__wide">
          <span>Mô tả</span>
          <textarea rows={3} value={form.description} onChange={(event) => patch('description', event.target.value)} />
        </label>
        {state.error ? <div className="bo-alert bo-alert--danger be-form__wide">{state.error}</div> : null}
        {state.success ? <div className="bo-alert be-form__wide"><CheckCircle2 size={16} />{state.success}</div> : null}
        <div className="bo-command-bar__actions be-form__wide">
          <button type="submit" disabled={state.loading}>
            {state.loading ? <Loader2 size={16} className="bo-spin" /> : <CheckCircle2 size={16} />}
            <span>Tạo charge</span>
          </button>
        </div>
      </form>
    </section>
  );
}

function BillingRowsPage({ entity, config, source = entity }) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ keyword: '', limit: 50 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const loader = useMemo(() => {
    if (entity === 'invoices') return billingAPI.invoices;
    if (entity === 'charges') return billingAPI.charges;
    if (source === 'manual') return listManualPayments;
    if (source === 'intents') return listPaymentIntents;
    return billingAPI.payments;
  }, [entity, source]);
  const params = useMemo(() => ({
    page,
    limit: filters.limit,
    ...(config.query || {}),
    ...(filters.keyword ? { keyword: filters.keyword, q: filters.keyword } : {}),
  }), [config, filters, page]);
  const { data, loading, error, refresh } = useBillingRows(loader, params);
  const keyword = filters.keyword.trim().toLowerCase();
  const rows = useMemo(() => {
    let items = Array.isArray(data?.items) ? data.items : [];
    if (config.clientStatuses?.length) {
      items = items.filter((row) => config.clientStatuses.includes(row.status));
    }
    if (keyword) {
      items = items.filter((row) => rowText(row).includes(keyword));
    }
    return items;
  }, [config.clientStatuses, data?.items, keyword]);

  async function runAction(action, row) {
    try {
      if (action === 'collect_payment') {
        navigate('/billing/cashier/collect');
        return;
      }
      if (action === 'issue_invoice') {
        await billingAPI.issueInvoice(getId(row));
        setToast('Đã phát hành hóa đơn.');
      }
      if (action === 'void_invoice') {
        const reason = window.prompt('Lý do hủy hóa đơn', 'Hủy từ màn viện phí');
        if (!reason) return;
        await billingAPI.voidInvoice(getId(row), { reason });
        setToast('Đã hủy hóa đơn.');
      }
      if (action === 'create_qr') {
        await createPaymentIntent(getId(row), { provider: 'bank_qr_manual', amount: Number(row.balance_due || 0), allow_partial: false });
        setToast('Đã tạo yêu cầu thanh toán QR.');
      }
      if (action === 'post_charge') {
        await billingAPI.postCharge(getId(row));
        setToast('Đã post khoản tính phí.');
      }
      if (action === 'void_charge') {
        const reason = window.prompt('Lý do void charge', 'Void từ màn viện phí');
        if (!reason) return;
        await billingAPI.voidCharge(getId(row), { reason });
        setToast('Đã void khoản tính phí.');
      }
      if (action === 'invoice_charge') {
        await billingAPI.createInvoiceFromCharges({ charge_ids: [getId(row)], encounter_id: getObjectId(row.encounter_id) || undefined });
        setToast('Đã tạo hóa đơn từ khoản tính phí.');
      }
      if (action === 'void_payment') {
        const reason = window.prompt('Lý do void payment', 'Void từ màn viện phí');
        if (!reason) return;
        await billingAPI.voidPayment(getId(row), { reason });
        setToast('Đã void thanh toán.');
      }
      if (action === 'refund_payment') {
        const reason = window.prompt('Lý do refund payment', 'Refund từ màn viện phí');
        if (!reason) return;
        await billingAPI.refundPayment(getId(row), { reason });
        setToast('Đã hoàn tiền thanh toán.');
      }
      refresh();
    } catch (actionError) {
      setToast(getApiErrorMessage(actionError, 'Không thể thực hiện thao tác.'));
    }
  }

  return (
    <BillingEntityFrame
      title={config.title}
      subtitle="Tra cứu, lọc và xử lý dữ liệu nghiệp vụ viện phí."
      filters={filters}
      setFilters={(updater) => {
        setPage(1);
        setFilters(updater);
      }}
      loading={loading}
      error={error}
      onRefresh={refresh}
    >
      {toast ? (
        <div className="bo-alert" role="status">
          <CheckCircle2 size={16} />
          <span>{toast}</span>
          <button type="button" className="bo-table-action" onClick={() => setToast('')}><X size={14} /></button>
        </div>
      ) : null}

      {config.create ? <ChargeCreatePanel onCreated={refresh} /> : null}
      <EntityKpis entity={entity === 'payments' ? 'payments' : entity} rows={rows} pagination={data?.pagination} />

      <section className="bo-panel">
        <header className="bo-panel__header">
          <h2>Danh sách</h2>
          <span>{formatNumber(rows.length)} dòng</span>
        </header>
        {entity === 'invoices' ? <InvoiceTable rows={rows} onOpen={setSelected} onAction={runAction} /> : null}
        {entity === 'charges' ? <ChargeTable rows={rows} onOpen={setSelected} onAction={runAction} /> : null}
        {entity === 'payments' ? <PaymentTable rows={rows} source={source} onOpen={setSelected} onAction={runAction} /> : null}
      </section>

      <div className="bo-tabs" aria-label="Phân trang">
        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trang trước</button>
        <button type="button" className="is-active">Trang {page}</button>
        <button
          type="button"
          disabled={data?.pagination && page >= data.pagination.total_pages}
          onClick={() => setPage((current) => current + 1)}
        >
          Trang sau
        </button>
      </div>

      <DetailDrawer row={selected} onClose={() => setSelected(null)} />
    </BillingEntityFrame>
  );
}

export function BillingInvoicesPage() {
  const { view = 'all' } = useParams();
  return <BillingRowsPage entity="invoices" config={INVOICE_VIEWS[view] || INVOICE_VIEWS.all} />;
}

export function BillingChargesPage() {
  const { view = 'all' } = useParams();
  return <BillingRowsPage entity="charges" config={CHARGE_VIEWS[view] || CHARGE_VIEWS.all} />;
}

export function BillingPaymentsPage() {
  const { view = 'all' } = useParams();
  const config = PAYMENT_VIEWS[view] || PAYMENT_VIEWS.all;
  return <BillingRowsPage entity="payments" source={config.source} config={config} />;
}
