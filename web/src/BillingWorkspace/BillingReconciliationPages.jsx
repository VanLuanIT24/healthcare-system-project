import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileSearch,
  FileText,
  History,
  Loader2,
  LockKeyhole,
  QrCode,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { billingReconciliationAPI, getReconciliationErrorMessage } from './billingReconciliationApi';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

const STATUS_LABELS = {
  pending: 'Chờ xử lý',
  pending_manual_confirmation: 'Chờ xác nhận',
  submitted_receipt: 'Đã gửi biên lai',
  manual_review: 'Manual review',
  confirmed: 'Đã xác nhận',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  rejected: 'Từ chối',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  unmatched: 'Chưa khớp',
  matched: 'Đã khớp',
  partial_matched: 'Khớp một phần',
  ignored: 'Bỏ qua',
  disputed: 'Nghi vấn',
  draft: 'Nháp',
  imported: 'Đã import',
  matching: 'Đang match',
  reviewing: 'Đang review',
  closed: 'Đã đóng',
  locked: 'Đã khóa',
};

const PROVIDER_LABELS = {
  bank_qr_manual: 'Bank QR thủ công',
  bank_qr: 'Bank QR',
  momo_personal_qr: 'MoMo personal QR',
  cash_manual: 'Cash manual',
};

const METHOD_LABELS = {
  qr_manual: 'QR thủ công',
  qr: 'QR',
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
};

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getDateRange(dateValue) {
  if (!dateValue) return {};
  return {
    date_from: new Date(`${dateValue}T00:00:00`).toISOString(),
    date_to: new Date(`${dateValue}T23:59:59.999`).toISOString(),
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

function idOf(value) {
  if (!value) return null;
  if (typeof value === 'object') return value._id || value.id || value.payment_intent_id || value.intent_id || null;
  return value;
}

function invoiceFrom(row = {}) {
  return row.invoice || row.invoice_id || row.matched_invoice_id || null;
}

function patientFrom(row = {}) {
  return row.patient || row.patient_id || invoiceFrom(row)?.patient || null;
}

function intentId(row = {}) {
  return row.payment_intent_id || row.intent_id || row._id || row.id;
}

function statusTone(status = '') {
  if (['confirmed', 'paid', 'matched', 'closed', 'locked'].includes(status)) return 'success';
  if (['failed', 'rejected', 'cancelled', 'expired', 'disputed'].includes(status)) return 'danger';
  if (['submitted_receipt', 'manual_review', 'partial_matched', 'reviewing', 'matching', 'imported'].includes(status)) return 'warning';
  return 'info';
}

function statusText(status) {
  return STATUS_LABELS[status] || status || '-';
}

function providerText(provider) {
  return PROVIDER_LABELS[provider] || METHOD_LABELS[provider] || provider || '-';
}

function diffTone(value) {
  const amount = Number(value || 0);
  if (amount === 0) return 'success';
  return amount > 0 ? 'warning' : 'danger';
}

function StatusBadge({ status }) {
  return <span className={`bo-status bo-status--${statusTone(status)}`}>{statusText(status)}</span>;
}

function ProviderBadge({ provider }) {
  return <span className="rc-provider">{providerText(provider)}</span>;
}

function MoneyDiff({ value }) {
  const amount = Number(value || 0);
  return (
    <span className={`rc-diff rc-diff--${diffTone(amount)}`}>
      {amount > 0 ? '+' : ''}{formatMoney(amount)}
    </span>
  );
}

function PatientMini({ patient }) {
  if (!patient) return <span className="bo-muted">-</span>;
  return (
    <span className="rv-patient">
      <UserRound size={15} />
      <span>
        <strong>{patient.full_name || patient.name || 'Bệnh nhân'}</strong>
        <small>{patient.patient_code || patient.phone || idOf(patient) || '-'}</small>
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

function useReconResource(loader, params = {}, enabled = true) {
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
        if (!cancelled) setState({ data: null, loading: false, error: getReconciliationErrorMessage(error) });
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

function ReconciliationHeader({ title, kicker, loading, onRefresh, actions }) {
  return (
    <header className="rv-page-header">
      <div>
        <span>{kicker}</span>
        <h1>{title}</h1>
        <p>Workspace đối soát QR/chuyển khoản với queue SLA, mismatch, import sao kê, candidate matching và audit thao tác.</p>
      </div>
      <div className="rv-header-actions">
        <span className="rv-live"><i /> Manual QR mode</span>
        {actions}
        <button type="button" className="bo-icon-action" onClick={onRefresh} aria-label="Tải lại">
          {loading ? <Loader2 size={17} className="bo-spin" /> : <RefreshCcw size={17} />}
        </button>
      </div>
    </header>
  );
}

function ReconciliationFilters({ filters, setFilters, statusOptions = [], provider = true, transaction = false }) {
  return (
    <section className="bo-command-bar rv-command-bar" aria-label="Bộ lọc đối soát">
      <div className="bo-command-bar__filters">
        <label>
          <span>Ngày</span>
          <input
            type="date"
            value={filters.date || ''}
            onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
          />
        </label>
        {provider && (
          <label>
            <span>Provider</span>
            <select
              value={filters.provider || ''}
              onChange={(event) => setFilters((current) => ({ ...current, provider: event.target.value }))}
            >
              <option value="">Tất cả</option>
              <option value="bank_qr_manual">Bank QR manual</option>
              <option value="bank_qr">Bank QR</option>
              <option value="momo_personal_qr">MoMo personal QR</option>
              <option value="cash_manual">Cash manual</option>
            </select>
          </label>
        )}
        <label>
          <span>Trạng thái</span>
          <select
            value={filters.status || ''}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          >
            <option value="">Tất cả</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{statusText(status)}</option>
            ))}
          </select>
        </label>
        {transaction && (
          <label>
            <span>Số tiền từ</span>
            <input
              type="number"
              min="0"
              value={filters.amount_min || ''}
              onChange={(event) => setFilters((current) => ({ ...current, amount_min: event.target.value }))}
              placeholder="0"
            />
          </label>
        )}
      </div>
      <div className="bo-command-bar__actions">
        <label className="bo-command-bar__search">
          <Search size={17} />
          <input
            value={filters.q || ''}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            placeholder="Tìm intent, invoice, bệnh nhân, ref..."
          />
        </label>
        <button type="button" onClick={() => setFilters({ date: todayInputValue() })}>
          <SlidersHorizontal size={16} />
          Reset
        </button>
      </div>
    </section>
  );
}

function OverviewKpis({ overview = {} }) {
  const kpi = overview.kpi || {};
  return (
    <section className="bo-kpi-grid rv-kpi-grid">
      <KpiCard icon={Clock3} label="Tổng cần đối soát" value={kpi.total_pending} meta={formatMoney(kpi.pending_amount)} tone="blue" />
      <KpiCard icon={BadgeCheck} label="Đã khớp" value={kpi.matched_transactions} meta={`${kpi.match_rate || 0}% match rate`} tone="green" />
      <KpiCard icon={ReceiptText} label="BN đã gửi biên lai" value={kpi.submitted_receipt} meta="Chờ thu ngân xác nhận" tone="amber" />
      <KpiCard icon={AlertTriangle} label="Manual review" value={kpi.manual_review} meta="Sai lệch cần xử lý" tone="danger" />
      <KpiCard icon={CheckCircle2} label="Xác nhận hôm nay" value={kpi.confirmed_today} meta="Payment intent đã confirm" tone="green" />
      <KpiCard icon={X} label="Từ chối hôm nay" value={kpi.rejected_today} meta="Rejected / failed" tone="rose" />
      <KpiCard icon={Upload} label="Sao kê đã import" value={kpi.imported_transactions} meta="BankStatementTransaction" tone="violet" />
      <KpiCard icon={FileSearch} label="Giao dịch chưa khớp" value={kpi.unmatched_transactions} meta="Cần candidate matching" tone="amber" />
    </section>
  );
}

function IntentDrawer({ intent, onClose, onConfirm, onReject }) {
  if (!intent) return null;
  const invoice = invoiceFrom(intent);
  const patient = patientFrom(intent);
  const review = intent.metadata?.bank_transfer_review || {};
  const auditLogs = intent.audit_logs || [];
  return (
    <aside className="bo-drawer rv-drawer" aria-label="Chi tiết payment intent">
      <header>
        <div>
          <span>Payment intent</span>
          <h2>{intent.intent_code || intent.payment_intent_id || idOf(intent)}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
      </header>
      <div className="bo-drawer__body rv-drawer-body">
        <div className="rv-drawer-hero">
          <QrCode size={26} />
          <div>
            <strong>{formatMoney(intent.amount)}</strong>
            <small>{providerText(intent.provider)} · {METHOD_LABELS[intent.method] || intent.method || '-'}</small>
          </div>
          <StatusBadge status={intent.status} />
        </div>
        <div className="rc-drawer-grid">
          <section>
            <h3>Payment intent</h3>
            <dl>
              <div><dt>Payment note</dt><dd>{intent.payment_note || '-'}</dd></div>
              <div><dt>Transaction ref</dt><dd>{intent.transaction_reference || intent.provider_transaction_id || '-'}</dd></div>
              <div><dt>Tài khoản nhận</dt><dd>{intent.receiver_account_no || '-'}</dd></div>
              <div><dt>Hết hạn</dt><dd>{formatDateTime(intent.expires_at)}</dd></div>
            </dl>
          </section>
          <section>
            <h3>Invoice / Patient</h3>
            <dl>
              <div><dt>Invoice</dt><dd>{invoice?.invoice_no || idOf(invoice) || '-'}</dd></div>
              <div><dt>Trạng thái invoice</dt><dd>{statusText(invoice?.status)}</dd></div>
              <div><dt>Balance</dt><dd>{formatMoney(invoice?.balance_due)}</dd></div>
              <div><dt>Bệnh nhân</dt><dd>{patient?.full_name || patient?.patient_code || '-'}</dd></div>
            </dl>
          </section>
          <section>
            <h3>Evidence / mismatch</h3>
            <dl>
              <div><dt>Biên lai upload</dt><dd>{intent.receipt_image_url ? 'Có' : 'Chưa có'}</dd></div>
              <div><dt>Expected</dt><dd>{formatMoney(intent.expected_amount || intent.amount)}</dd></div>
              <div><dt>Received</dt><dd>{formatMoney(intent.received_amount || review.received_amount)}</dd></div>
              <div><dt>Difference</dt><dd><MoneyDiff value={intent.difference_amount ?? review.difference_amount} /></dd></div>
            </dl>
          </section>
        </div>
        {intent.receipt_image_url && (
          <section>
            <h3>Receipt preview</h3>
            <img className="rc-receipt-preview" src={intent.receipt_image_url} alt="Biên lai bệnh nhân upload" />
          </section>
        )}
        <section>
          <h3>Audit timeline</h3>
          <div className="rv-timeline">
            {auditLogs.slice(-6).reverse().map((log, index) => (
              <article key={`${log.action}-${index}`}>
                <i />
                <div>
                  <strong>{log.action || 'event'}</strong>
                  <small>{formatDateTime(log.at)} · {log.reason || log.metadata?.reason || '-'}</small>
                </div>
              </article>
            ))}
            {!auditLogs.length && <EmptyState compact label="Chưa có audit log nhúng." />}
          </div>
        </section>
      </div>
      <div className="bo-drawer__actions">
        <button type="button" onClick={() => onConfirm(intent)}><CheckCircle2 size={16} /> Xác nhận</button>
        <button type="button" onClick={() => onReject(intent)}><X size={16} /> Từ chối</button>
      </div>
    </aside>
  );
}

function ConfirmTransferModal({ intent, onClose, onDone }) {
  const [form, setForm] = useState({
    transaction_ref: intent?.transaction_reference || intent?.provider_transaction_id || '',
    received_amount: intent?.received_amount || intent?.amount || '',
    received_at: '',
    note: 'Đã kiểm tra sao kê, số tiền và nội dung chuyển khoản.',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!intent) return null;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const intentPrimaryId = intentId(intent);
      const body = {
        ...form,
        received_amount: Number(form.received_amount || 0),
      };
      if (['bank_qr', 'bank_qr_manual'].includes(intent.provider)) {
        await billingReconciliationAPI.confirmBankTransfer(intentPrimaryId, body);
      } else {
        await billingReconciliationAPI.confirmManualPayment(intentPrimaryId, body);
      }
      onDone();
      onClose();
    } catch (submitError) {
      setError(getReconciliationErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bo-modal-backdrop" role="presentation">
      <form className="bo-modal rv-action-form rc-modal" onSubmit={submit}>
        <header className="rc-modal-header">
          <div>
            <span>Xác nhận chuyển khoản</span>
            <h2>{intent.intent_code || intentId(intent)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>
        {error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{error}</div>}
        <label>
          <span>Transaction reference *</span>
          <input required value={form.transaction_ref} onChange={(event) => setForm((current) => ({ ...current, transaction_ref: event.target.value }))} />
        </label>
        <label>
          <span>Received amount *</span>
          <input required type="number" min="1" value={form.received_amount} onChange={(event) => setForm((current) => ({ ...current, received_amount: event.target.value }))} />
        </label>
        <label>
          <span>Received at</span>
          <input type="datetime-local" value={form.received_at} onChange={(event) => setForm((current) => ({ ...current, received_at: event.target.value }))} />
        </label>
        <label className="rv-form-wide">
          <span>Note</span>
          <textarea rows={3} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
        </label>
        <label className="rv-check">
          <input type="checkbox" required />
          <span>Tôi đã kiểm tra số tiền, nội dung chuyển khoản, invoice/patient và trùng transaction reference.</span>
        </label>
        <div className="rv-action-row">
          <button type="submit" disabled={busy}>{busy ? <Loader2 className="bo-spin" size={16} /> : <CheckCircle2 size={16} />} Xác nhận khớp</button>
          <button type="button" onClick={onClose}>Hủy</button>
        </div>
      </form>
    </div>
  );
}

function RejectTransferModal({ intent, onClose, onDone }) {
  const [reason, setReason] = useState('Không tìm thấy giao dịch ngân hàng tương ứng.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!intent) return null;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const intentPrimaryId = intentId(intent);
      if (['bank_qr', 'bank_qr_manual'].includes(intent.provider)) {
        await billingReconciliationAPI.rejectBankTransfer(intentPrimaryId, { reason });
      } else {
        await billingReconciliationAPI.rejectManualPayment(intentPrimaryId, { reason });
      }
      onDone();
      onClose();
    } catch (submitError) {
      setError(getReconciliationErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bo-modal-backdrop" role="presentation">
      <form className="bo-modal rv-action-form rc-modal" onSubmit={submit}>
        <header className="rc-modal-header">
          <div>
            <span>Từ chối payment intent</span>
            <h2>{intent.intent_code || intentId(intent)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>
        {error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{error}</div>}
        <label className="rv-form-wide">
          <span>Lý do *</span>
          <textarea required rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="rv-action-row">
          <button type="submit" disabled={busy}>{busy ? <Loader2 className="bo-spin" size={16} /> : <X size={16} />} Từ chối</button>
          <button type="button" onClick={onClose}>Hủy</button>
        </div>
      </form>
    </div>
  );
}

function IntentTable({ items = [], loading, selected, setSelected, onConfirm, onReject }) {
  if (loading) return <EmptyState label="Đang tải payment intents..." />;
  if (!items.length) return <EmptyState label="Không có payment intent trong queue này." />;
  return (
    <div className="bo-table-wrap rv-table-wrap">
      <table className="bo-table rv-table">
        <thead>
          <tr>
            <th>Priority</th>
            <th>Intent / Invoice</th>
            <th>Patient</th>
            <th>Provider</th>
            <th>Expected</th>
            <th>Evidence</th>
            <th>Status</th>
            <th>Age / SLA</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const invoice = invoiceFrom(item);
            const patient = patientFrom(item);
            const selectedRow = idOf(selected) === idOf(item);
            const ageHours = item.created_at ? Math.max(0, Math.round((Date.now() - new Date(item.created_at).getTime()) / 36e5)) : 0;
            return (
              <tr key={idOf(item) || item.payment_intent_id} className={selectedRow ? 'is-selected' : ''} onClick={() => setSelected(item)}>
                <td><span className={`rv-risk rv-risk--${item.status === 'manual_review' ? 'danger' : 'success'}`}><ShieldCheck size={14} />{item.status === 'manual_review' ? 'High' : 'Normal'}</span></td>
                <td>
                  <strong>{item.intent_code || item.payment_intent_id}</strong>
                  <small>{invoice?.invoice_no || idOf(invoice) || '-'} · {item.payment_note || '-'}</small>
                </td>
                <td><PatientMini patient={patient} /></td>
                <td><ProviderBadge provider={item.provider} /><small>{METHOD_LABELS[item.method] || item.method || '-'}</small></td>
                <td><strong>{formatMoney(item.amount)}</strong><small>Received {formatMoney(item.received_amount || item.metadata?.bank_transfer_review?.received_amount)}</small></td>
                <td><span className={item.receipt_image_url ? 'rc-evidence is-ready' : 'rc-evidence'}>{item.receipt_image_url ? 'Có biên lai' : 'Chưa có'}</span></td>
                <td><StatusBadge status={item.status} /></td>
                <td><span className={`rv-sla rv-sla--${ageHours >= 2 ? 'warning' : 'success'}`}><Clock3 size={14} />{ageHours}h</span></td>
                <td>
                  <div className="rv-action-row">
                    <button type="button" onClick={(event) => { event.stopPropagation(); onConfirm(item); }}><CheckCircle2 size={15} />Xác nhận</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onReject(item); }}><X size={15} />Từ chối</button>
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

function useIntentActions(resourceRefresh) {
  const [selected, setSelected] = useState(null);
  const [confirmIntent, setConfirmIntent] = useState(null);
  const [rejectIntent, setRejectIntent] = useState(null);
  const refresh = () => {
    resourceRefresh();
    setSelected(null);
  };
  return {
    selected,
    setSelected,
    modals: (
      <>
        <IntentDrawer intent={selected} onClose={() => setSelected(null)} onConfirm={setConfirmIntent} onReject={setRejectIntent} />
        <ConfirmTransferModal intent={confirmIntent} onClose={() => setConfirmIntent(null)} onDone={refresh} />
        <RejectTransferModal intent={rejectIntent} onClose={() => setRejectIntent(null)} onDone={refresh} />
      </>
    ),
    onConfirm: setConfirmIntent,
    onReject: setRejectIntent,
  };
}

const loadOverview = (params) => billingReconciliationAPI.overview(params);
const loadPaymentIntents = (params) => billingReconciliationAPI.paymentIntents(params);
const loadManualPayments = (params) => billingReconciliationAPI.manualPayments(params);
const loadTransactions = (params) => billingReconciliationAPI.transactions(params);
const loadTransactionCandidates = ({ transaction_id }) => billingReconciliationAPI.transactionCandidates(transaction_id);
const loadDailyReport = (params) => billingReconciliationAPI.dailyReport(params);
const loadProviderReport = (params) => billingReconciliationAPI.providerReport(params);

export function QrTransferReconciliationPage() {
  const [filters, setFilters] = useState({ date: todayInputValue(), provider: '', status: '' });
  const params = useMemo(() => ({
    ...getDateRange(filters.date),
    provider: filters.provider || undefined,
    status: filters.status || 'pending_manual_confirmation,submitted_receipt,manual_review,confirmed,rejected,failed,expired',
    q: filters.q || undefined,
    limit: 50,
  }), [filters]);
  const overview = useReconResource(loadOverview, params);
  const intents = useReconResource(loadPaymentIntents, params);
  const actions = useIntentActions(() => {
    overview.refresh();
    intents.refresh();
  });

  return (
    <main className="rv-workbench">
      <ReconciliationHeader title="Đối soát QR / chuyển khoản" kicker="Manual QR reconciliation" loading={overview.loading || intents.loading} onRefresh={() => { overview.refresh(); intents.refresh(); }} actions={<button type="button" className="bo-icon-action" aria-label="Export"><Download size={17} /></button>} />
      <OverviewKpis overview={overview.data} />
      <ReconciliationFilters filters={filters} setFilters={setFilters} statusOptions={['pending_manual_confirmation', 'submitted_receipt', 'manual_review', 'confirmed', 'rejected', 'failed', 'expired']} />
      {(overview.error || intents.error) && <div className="rv-warning is-danger"><AlertTriangle size={16} />{overview.error || intents.error}</div>}
      <section className="rv-split">
        <section className="bo-panel bo-panel--wide">
          <header className="bo-panel__header">
            <h2>Worklist QR / chuyển khoản</h2>
            <span>{formatNumber(intents.data?.pagination?.total || intents.data?.items?.length || 0)} payment intents</span>
          </header>
          <IntentTable items={intents.data?.items || []} loading={intents.loading} selected={actions.selected} setSelected={actions.setSelected} onConfirm={actions.onConfirm} onReject={actions.onReject} />
        </section>
        <aside className="rv-risk-panel">
          <header><span>Risk engine</span><strong>Điểm cần kiểm</strong></header>
          <div className="rv-risk-list">
            <span><AlertTriangle size={16} /><strong>Amount mismatch</strong><small>Đẩy manual_review</small></span>
            <span><AlertTriangle size={16} /><strong>Duplicate reference</strong><small>Trừ 50 confidence</small></span>
            <span><AlertTriangle size={16} /><strong>Manual provider</strong><small>Không có bank API/webhook</small></span>
            <span><AlertTriangle size={16} /><strong>Receipt missing</strong><small>Yêu cầu chứng từ</small></span>
          </div>
          <div className="rv-rule-box">
            <strong>Chế độ hiện tại</strong>
            <span>Bank QR provider đang ở chế độ thủ công: import sao kê hoặc xác nhận bằng mắt từ app ngân hàng.</span>
          </div>
        </aside>
      </section>
      {actions.modals}
    </main>
  );
}

export function ManualPaymentMatchPage() {
  const [filters, setFilters] = useState({ date: todayInputValue(), provider: '', status: '' });
  const params = useMemo(() => ({
    ...getDateRange(filters.date),
    provider: filters.provider || undefined,
    status: filters.status || 'pending_manual_confirmation,submitted_receipt,manual_review',
    q: filters.q || undefined,
    has_receipt: filters.has_receipt || undefined,
    limit: 60,
  }), [filters]);
  const overview = useReconResource(loadOverview, params);
  const manual = useReconResource(loadManualPayments, params);
  const actions = useIntentActions(() => {
    overview.refresh();
    manual.refresh();
  });
  const items = manual.data?.items || [];

  return (
    <main className="rv-workbench">
      <ReconciliationHeader title="Manual payment cần khớp" kicker="Cashier / accountant queue" loading={manual.loading} onRefresh={() => { overview.refresh(); manual.refresh(); }} />
      <OverviewKpis overview={overview.data} />
      <ReconciliationFilters filters={filters} setFilters={setFilters} statusOptions={['pending_manual_confirmation', 'submitted_receipt', 'manual_review']} />
      {manual.error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{manual.error}</div>}
      <section className="rc-card-grid">
        {items.map((item) => {
          const invoice = invoiceFrom(item);
          const patient = patientFrom(item);
          return (
            <article className="rc-queue-card" key={idOf(item) || item.payment_intent_id}>
              <header>
                <StatusBadge status={item.status} />
                <strong>{formatMoney(item.amount)}</strong>
              </header>
              <div>
                <h2>{item.intent_code || item.payment_intent_id}</h2>
                <PatientMini patient={patient} />
              </div>
              <dl>
                <div><dt>Invoice</dt><dd>{invoice?.invoice_no || idOf(invoice) || '-'}</dd></div>
                <div><dt>Provider</dt><dd>{providerText(item.provider)}</dd></div>
                <div><dt>Payment note</dt><dd>{item.payment_note || '-'}</dd></div>
                <div><dt>Transaction ref</dt><dd>{item.transaction_reference || '-'}</dd></div>
                <div><dt>Reason</dt><dd>{item.manual_review_reason || '-'}</dd></div>
              </dl>
              <div className="rv-action-row">
                <button type="button" onClick={() => actions.setSelected(item)}><FileText size={15} />Chi tiết</button>
                <button type="button" onClick={() => actions.onConfirm(item)}><CheckCircle2 size={15} />Xác nhận</button>
                <button type="button" onClick={() => actions.onReject(item)}><X size={15} />Từ chối</button>
              </div>
            </article>
          );
        })}
        {!items.length && <EmptyState label="Không còn manual payment cần khớp." />}
      </section>
      {actions.modals}
    </main>
  );
}

export function PaymentMismatchPage() {
  const [filters, setFilters] = useState({ date: todayInputValue(), provider: '', status: 'manual_review' });
  const params = useMemo(() => ({
    ...getDateRange(filters.date),
    provider: filters.provider || undefined,
    status: 'manual_review',
    mismatch_type: filters.mismatch_type || undefined,
    q: filters.q || undefined,
    limit: 80,
  }), [filters]);
  const mismatch = useReconResource(loadManualPayments, params);
  const actions = useIntentActions(mismatch.refresh);
  const items = mismatch.data?.items || [];

  return (
    <main className="rv-workbench">
      <ReconciliationHeader title="Payment mismatch" kicker="Sai lệch cần xử lý" loading={mismatch.loading} onRefresh={mismatch.refresh} />
      <section className="bo-kpi-grid rv-kpi-grid">
        <KpiCard icon={AlertTriangle} label="Mismatch tổng" value={items.length} meta="manual_review" tone="danger" />
        <KpiCard icon={Banknote} label="Thiếu tiền" value={items.filter((item) => item.mismatch_type === 'amount_short' || Number(item.difference_amount) < 0).length} meta="Cần bổ sung tiền" tone="rose" />
        <KpiCard icon={BadgeCheck} label="Dư tiền" value={items.filter((item) => item.mismatch_type === 'amount_over' || Number(item.difference_amount) > 0).length} meta="Tạo credit/refund phần dư" tone="amber" />
        <KpiCard icon={ShieldCheck} label="Cần duyệt" value={items.filter((item) => Math.abs(Number(item.difference_amount || 0)) > 0).length} meta="Kế toán trưởng" tone="violet" />
      </section>
      <ReconciliationFilters filters={filters} setFilters={setFilters} statusOptions={['manual_review']} />
      {mismatch.error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{mismatch.error}</div>}
      <section className="bo-panel bo-panel--wide">
        <header className="bo-panel__header">
          <h2>Queue sai lệch</h2>
          <span>{formatNumber(items.length)} cases</span>
        </header>
        <div className="bo-table-wrap rv-table-wrap">
          <table className="bo-table rv-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Intent</th>
                <th>Patient</th>
                <th>Expected</th>
                <th>Received</th>
                <th>Difference</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const review = item.metadata?.bank_transfer_review || {};
                return (
                  <tr key={idOf(item) || item.payment_intent_id} onClick={() => actions.setSelected(item)}>
                    <td><span className={`rv-risk rv-risk--${diffTone(item.difference_amount ?? review.difference_amount)}`}><AlertTriangle size={14} />{item.mismatch_type || 'manual_review'}</span></td>
                    <td><strong>{item.intent_code || item.payment_intent_id}</strong><small>{item.payment_note || '-'}</small></td>
                    <td><PatientMini patient={patientFrom(item)} /></td>
                    <td>{formatMoney(item.expected_amount || item.amount)}</td>
                    <td>{formatMoney(item.received_amount || review.received_amount)}</td>
                    <td><MoneyDiff value={item.difference_amount ?? review.difference_amount} /></td>
                    <td>{item.manual_review_reason || item.detected_reason || '-'}</td>
                    <td><div className="rv-action-row"><button type="button" onClick={(event) => { event.stopPropagation(); actions.onConfirm(item); }}>Xác nhận</button><button type="button" onClick={(event) => { event.stopPropagation(); actions.onReject(item); }}>Từ chối</button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!items.length && <EmptyState label="Không có mismatch đang mở." compact />}
        </div>
      </section>
      {actions.modals}
    </main>
  );
}

function ImportTransactionsModal({ onClose, onDone }) {
  const [provider, setProvider] = useState('bank_qr_manual');
  const [raw, setRaw] = useState('[\n  {\n    "transaction_id": "FT24123456789",\n    "transaction_ref": "FT24123456789",\n    "amount": 450000,\n    "transaction_at": "2026-05-20T09:20:00+07:00",\n    "description": "BOYTE 20260520-0001"\n  }\n]');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const parsed = JSON.parse(raw);
      const transactions = Array.isArray(parsed) ? parsed : parsed.transactions;
      await billingReconciliationAPI.importTransactions({ provider, transactions });
      onDone();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof SyntaxError ? 'JSON sao kê không hợp lệ.' : getReconciliationErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bo-modal-backdrop" role="presentation">
      <form className="bo-modal rv-action-form rc-modal rc-modal--wide" onSubmit={submit}>
        <header className="rc-modal-header">
          <div>
            <span>Import sao kê</span>
            <h2>BankStatementTransaction</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
        </header>
        {error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{error}</div>}
        <label>
          <span>Provider</span>
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="bank_qr_manual">Bank QR manual</option>
            <option value="bank_qr">Bank QR</option>
            <option value="momo_personal_qr">MoMo personal QR</option>
          </select>
        </label>
        <label className="rv-form-wide">
          <span>Transactions JSON</span>
          <textarea rows={12} value={raw} onChange={(event) => setRaw(event.target.value)} />
        </label>
        <div className="rv-action-row">
          <button type="submit" disabled={busy}>{busy ? <Loader2 className="bo-spin" size={16} /> : <Upload size={16} />} Import</button>
          <button type="button" onClick={onClose}>Hủy</button>
        </div>
      </form>
    </div>
  );
}

function CandidatePanel({ transaction, onMatched }) {
  const candidateParams = useMemo(() => ({ transaction_id: idOf(transaction) }), [transaction]);
  const candidates = useReconResource(loadTransactionCandidates, candidateParams, Boolean(transaction));
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  async function matchCandidate(candidate) {
    setBusyId(idOf(candidate.payment_intent));
    setError('');
    try {
      await billingReconciliationAPI.matchIntent(idOf(transaction), {
        payment_intent_id: idOf(candidate.payment_intent),
        confirm_payment: true,
      });
      onMatched();
    } catch (matchError) {
      setError(getReconciliationErrorMessage(matchError));
    } finally {
      setBusyId('');
    }
  }

  if (!transaction) {
    return (
      <aside className="rv-side-panel">
        <header><span>Candidate matching</span><strong>Chọn giao dịch</strong></header>
        <EmptyState compact label="Chọn một giao dịch sao kê để xem gợi ý match." />
      </aside>
    );
  }

  const items = candidates.data?.items || [];
  return (
    <aside className="rv-side-panel">
      <header><span>Candidate matching</span><strong>{transaction.transaction_ref || transaction.transaction_id}</strong></header>
      <div className="rc-transaction-summary">
        <strong>{formatMoney(transaction.amount)}</strong>
        <span>{transaction.description || '-'}</span>
        <small>{formatDateTime(transaction.transaction_at)}</small>
      </div>
      {error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{error}</div>}
      {candidates.loading && <EmptyState compact label="Đang tìm candidate..." />}
      <div className="rc-candidate-list">
        {items.map((candidate) => (
          <article key={idOf(candidate.payment_intent)}>
            <header>
              <strong>{candidate.payment_intent?.intent_code}</strong>
              <span>{candidate.confidence_score}%</span>
            </header>
            <small>{candidate.reasons?.join(' · ') || '-'}</small>
            <dl>
              <div><dt>Amount</dt><dd>{formatMoney(candidate.payment_intent?.amount)}</dd></div>
              <div><dt>Diff</dt><dd><MoneyDiff value={candidate.difference_amount} /></dd></div>
              <div><dt>Invoice</dt><dd>{candidate.invoice?.invoice_no || '-'}</dd></div>
            </dl>
            <button type="button" disabled={Boolean(busyId)} onClick={() => matchCandidate(candidate)}>
              {busyId === idOf(candidate.payment_intent) ? <Loader2 className="bo-spin" size={15} /> : <ArrowLeftRight size={15} />}
              Match intent
            </button>
          </article>
        ))}
        {!items.length && !candidates.loading && <EmptyState compact label="Chưa có candidate đủ điều kiện." />}
      </div>
    </aside>
  );
}

export function UnmatchedTransactionsPage() {
  const [filters, setFilters] = useState({ date: todayInputValue(), provider: '', status: 'unmatched' });
  const [selected, setSelected] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const params = useMemo(() => ({
    ...getDateRange(filters.date),
    provider: filters.provider || undefined,
    match_status: filters.status || 'unmatched',
    amount_min: filters.amount_min || undefined,
    q: filters.q || undefined,
    limit: 80,
  }), [filters]);
  const transactions = useReconResource(loadTransactions, params);

  async function runAutoMatch() {
    setAutoBusy(true);
    try {
      await billingReconciliationAPI.autoMatch({ ...params, threshold: 90, review_threshold: 70, limit: 50 });
      transactions.refresh();
      setSelected(null);
    } finally {
      setAutoBusy(false);
    }
  }

  return (
    <main className="rv-workbench">
      <ReconciliationHeader
        title="Giao dịch chưa khớp"
        kicker="Bank statement workbench"
        loading={transactions.loading || autoBusy}
        onRefresh={transactions.refresh}
        actions={(
          <>
            <button type="button" className="bo-icon-action" onClick={() => setShowImport(true)} aria-label="Import sao kê"><Upload size={17} /></button>
            <button type="button" className="bo-icon-action" onClick={runAutoMatch} aria-label="Auto match">{autoBusy ? <Loader2 className="bo-spin" size={17} /> : <ShieldCheck size={17} />}</button>
          </>
        )}
      />
      <ReconciliationFilters filters={filters} setFilters={setFilters} statusOptions={['unmatched', 'matched', 'partial_matched', 'ignored', 'disputed']} transaction />
      {transactions.error && <div className="rv-warning is-danger"><AlertTriangle size={16} />{transactions.error}</div>}
      <section className="rv-split rv-split--wide">
        <section className="bo-panel bo-panel--wide">
          <header className="bo-panel__header">
            <h2>Bank statement transactions</h2>
            <span>{formatNumber(transactions.data?.pagination?.total || 0)} rows</span>
          </header>
          <div className="bo-table-wrap rv-table-wrap">
            <table className="bo-table rv-table">
              <thead>
                <tr>
                  <th>Bank ref</th>
                  <th>Time</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Detected</th>
                  <th>Confidence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(transactions.data?.items || []).map((transaction) => (
                  <tr key={idOf(transaction)} className={idOf(selected) === idOf(transaction) ? 'is-selected' : ''} onClick={() => setSelected(transaction)}>
                    <td><strong>{transaction.transaction_ref || transaction.transaction_id}</strong><small>{transaction.account_no || transaction.provider}</small></td>
                    <td>{formatDateTime(transaction.transaction_at)}</td>
                    <td><strong>{formatMoney(transaction.amount)}</strong></td>
                    <td>{transaction.description || '-'}</td>
                    <td><small>{transaction.detected_intent_code || '-'} · {transaction.detected_invoice_no || '-'}</small></td>
                    <td><span className={`rv-risk rv-risk--${Number(transaction.confidence_score) >= 90 ? 'success' : Number(transaction.confidence_score) >= 70 ? 'warning' : 'danger'}`}>{transaction.confidence_score || 0}%</span></td>
                    <td><StatusBadge status={transaction.match_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(transactions.data?.items || []).length && <EmptyState compact label="Chưa có giao dịch sao kê chưa khớp." />}
          </div>
        </section>
        <CandidatePanel transaction={selected} onMatched={() => { transactions.refresh(); setSelected(null); }} />
      </section>
      {showImport && <ImportTransactionsModal onClose={() => setShowImport(false)} onDone={transactions.refresh} />}
    </main>
  );
}

export function ReconciliationReportPage() {
  const [filters, setFilters] = useState({ date: todayInputValue(), provider: '' });
  const [exportedAt, setExportedAt] = useState('');
  const params = useMemo(() => ({
    ...getDateRange(filters.date),
    provider: filters.provider || undefined,
  }), [filters]);
  const overview = useReconResource(loadOverview, params);
  const daily = useReconResource(loadDailyReport, params);
  const provider = useReconResource(loadProviderReport, params);

  async function exportReport() {
    const result = await billingReconciliationAPI.exportReport({ ...params, format: 'json' });
    setExportedAt(formatDateTime(result.generated_at));
  }

  return (
    <main className="rv-workbench">
      <ReconciliationHeader title="Báo cáo đối soát" kicker="Finance reconciliation report" loading={overview.loading || daily.loading || provider.loading} onRefresh={() => { overview.refresh(); daily.refresh(); provider.refresh(); }} actions={<button type="button" className="bo-icon-action" onClick={exportReport} aria-label="Export"><Download size={17} /></button>} />
      <OverviewKpis overview={overview.data} />
      <ReconciliationFilters filters={filters} setFilters={setFilters} statusOptions={[]} />
      {exportedAt && <div className="rv-warning"><Download size={16} />Báo cáo JSON đã được tạo lúc {exportedAt}.</div>}
      <section className="rv-split">
        <section className="bo-panel bo-panel--wide">
          <header className="bo-panel__header">
            <h2>Báo cáo theo ngày</h2>
            <span>Expected vs received</span>
          </header>
          <div className="bo-table-wrap">
            <table className="bo-table rv-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Provider</th>
                  <th>Imported</th>
                  <th>Matched</th>
                  <th>Unmatched</th>
                  <th>Mismatch</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {(daily.data?.items || []).map((row) => (
                  <tr key={`${row.date}-${row.provider}`}>
                    <td>{row.date}</td>
                    <td><ProviderBadge provider={row.provider} /></td>
                    <td>{formatNumber(row.imported_transactions)}</td>
                    <td>{formatNumber(row.matched_transactions)}</td>
                    <td>{formatNumber(row.unmatched_transactions)}</td>
                    <td>{formatNumber(row.mismatch_transactions)}</td>
                    <td>{formatMoney(row.received_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(daily.data?.items || []).length && <EmptyState compact label="Chưa có dữ liệu báo cáo ngày." />}
          </div>
        </section>
        <aside className="rv-side-panel">
          <header><span>Provider summary</span><strong>Đối soát theo kênh</strong></header>
          <div className="rc-provider-report">
            {(provider.data?.items || []).map((row) => (
              <article key={row.provider}>
                <header><ProviderBadge provider={row.provider} /><strong>{formatMoney(row.statement_amount)}</strong></header>
                <dl>
                  <div><dt>Transactions</dt><dd>{formatNumber(row.transaction_count)}</dd></div>
                  <div><dt>Matched</dt><dd>{formatNumber(row.matched_count)}</dd></div>
                  <div><dt>Unmatched</dt><dd>{formatNumber(row.unmatched_count)}</dd></div>
                  <div><dt>Mismatch</dt><dd>{formatNumber(row.mismatch_count)}</dd></div>
                </dl>
              </article>
            ))}
            {!(provider.data?.items || []).length && <EmptyState compact label="Chưa có dữ liệu provider." />}
          </div>
          <div className="rv-rule-box">
            <strong>Lock period</strong>
            <span>Backend đã có API close/lock batch; UI báo cáo sẵn sàng mở rộng sang khóa kỳ theo quyền kế toán.</span>
          </div>
        </aside>
      </section>
    </main>
  );
}
