import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Download,
  FileSearch,
  FileText,
  History,
  Layers3,
  Loader2,
  ReceiptText,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldAlert,
  Timer,
  Upload,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import { billingRefundVoidAPI, getRefundVoidErrorMessage } from './billingRefundVoidApi';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

const REFUND_STATUS_LABELS = {
  requested: 'Mới gửi',
  under_review: 'Đang review',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  processing: 'Đang chi',
  processed: 'Đã hoàn',
  failed: 'Hoàn lỗi',
  cancelled: 'Đã hủy',
  none: 'Chưa yêu cầu',
};

const PAYMENT_STATUS_LABELS = {
  pending: 'Pending',
  completed: 'Completed',
  confirmed: 'Confirmed',
  refunded: 'Đã hoàn',
  refunded_manual: 'Hoàn thủ công',
  voided: 'Đã void',
  failed: 'Thất bại',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};

const INVOICE_STATUS_LABELS = {
  draft: 'Nháp',
  issued: 'Đã phát hành',
  partially_paid: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
  voided: 'Đã void',
  cancelled: 'Đã hủy',
  refunded: 'Đã refund',
};

const METHOD_LABELS = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  qr: 'QR',
  card: 'Thẻ',
  e_wallet: 'Ví điện tử',
  insurance: 'Bảo hiểm',
  original_method: 'Phương thức gốc',
  manual: 'Thủ công',
  other: 'Khác',
};

const SOURCE_LABELS = {
  patient_portal: 'Patient portal',
  cashier: 'Cashier',
  accounting: 'Kế toán',
  accountant: 'Kế toán',
  admin: 'Admin',
  reconciliation: 'Đối soát',
  insurance: 'Bảo hiểm',
  system: 'System',
};

const REFUND_PAGE_CONFIG = {
  requests: {
    title: 'Refund request',
    kicker: 'Tiếp nhận yêu cầu hoàn tiền',
    bucket: 'requests',
    tabs: ['requested', 'under_review', 'approved', 'rejected'],
  },
  pending: {
    title: 'Refund chờ xử lý',
    kicker: 'Queue vận hành kế toán',
    bucket: 'pending',
    tabs: ['requested', 'under_review', 'approved', 'processing', 'failed'],
  },
  processed: {
    title: 'Refund đã xử lý',
    kicker: 'Lịch sử chi tiền và từ chối',
    bucket: 'processed',
    tabs: ['processed', 'rejected', 'cancelled', 'failed'],
  },
};

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
  if (typeof value === 'object') return value._id || value.id || null;
  return value;
}

function patientName(row = {}) {
  const patient = row.patient_id || row.patient || {};
  return patient.full_name || patient.patient_code || row.patient_name || '-';
}

function patientSub(row = {}) {
  const patient = row.patient_id || row.patient || {};
  return [patient.patient_code, patient.phone].filter(Boolean).join(' · ') || '-';
}

function statusTone(status = '') {
  if (['processed', 'completed', 'paid', 'approved'].includes(status)) return 'success';
  if (['rejected', 'failed', 'cancelled', 'voided'].includes(status)) return 'danger';
  if (['requested', 'under_review', 'processing', 'partially_paid', 'refunded', 'refunded_manual'].includes(status)) return 'warning';
  return 'info';
}

function refundStatusText(status) {
  return REFUND_STATUS_LABELS[status] || PAYMENT_STATUS_LABELS[status] || INVOICE_STATUS_LABELS[status] || status || '-';
}

function StatusBadge({ status }) {
  return <span className={`bo-status bo-status--${statusTone(status)}`}>{refundStatusText(status)}</span>;
}

function RiskBadge({ score = 0, flags = [] }) {
  const value = Number(score || 0);
  const tone = value >= 60 ? 'danger' : value >= 30 ? 'warning' : 'success';
  return (
    <span className={`rv-risk rv-risk--${tone}`}>
      <ShieldAlert size={14} />
      {value || flags.length * 12}
    </span>
  );
}

function SlaPill({ date }) {
  const requestedAt = date ? new Date(date) : null;
  const hours = requestedAt && !Number.isNaN(requestedAt.getTime())
    ? Math.max(0, Math.round((Date.now() - requestedAt.getTime()) / 36e5))
    : 0;
  const tone = hours >= 48 ? 'danger' : hours >= 24 ? 'warning' : 'success';
  return <span className={`rv-sla rv-sla--${tone}`}><Timer size={14} />{hours}h</span>;
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

function useRefundVoidResource(loader, params = {}, enabled = true) {
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
        if (!cancelled) setState({ data: null, loading: false, error: getRefundVoidErrorMessage(error) });
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

function RefundVoidHeader({ title, kicker, loading, onRefresh }) {
  return (
    <header className="rv-page-header">
      <div>
        <span>{kicker}</span>
        <h1>{title}</h1>
        <p>Queue vận hành refund, void payment, void invoice, chứng từ, rủi ro và audit theo thời gian thực.</p>
      </div>
      <div className="rv-header-actions">
        <span className="rv-live"><i /> Realtime-ready</span>
        <button type="button" className="bo-icon-action" onClick={onRefresh} aria-label="Tải lại">
          {loading ? <Loader2 size={17} className="bo-spin" /> : <RefreshCcw size={17} />}
        </button>
      </div>
    </header>
  );
}

function RefundVoidKpis({ summary = {}, rows = [] }) {
  return (
    <section className="bo-kpi-grid rv-kpi-grid">
      <KpiCard icon={RotateCcw} label="Request hôm nay" value={summary.refund_request_today || rows.length} meta="Tạo trong ngày" tone="blue" />
      <KpiCard icon={Banknote} label="Tiền refund pending" value={summary.refund_amount_pending} meta="Requested/approved/processing" money tone="amber" />
      <KpiCard icon={BadgeCheck} label="Refund processed" value={summary.refund_processed_amount} meta={`${formatNumber(summary.processed_count)} hồ sơ`} money tone="green" />
      <KpiCard icon={ShieldAlert} label="Rủi ro cao" value={summary.high_risk_count} meta="Risk score >= 60" tone="danger" />
      <KpiCard icon={CreditCard} label="Void payment" value={summary.void_payment_count} meta={formatMoney(summary.void_payment_amount)} tone="violet" />
      <KpiCard icon={ReceiptText} label="Void invoice" value={summary.void_invoice_count} meta={formatMoney(summary.void_invoice_amount)} tone="blue" />
      <KpiCard icon={Clock3} label="Chờ xử lý" value={summary.pending_count} meta="Refund chưa hoàn tất" tone="amber" />
      <KpiCard icon={Ban} label="Bị từ chối" value={summary.rejected_count} meta="Reject/cancel" tone="danger" />
    </section>
  );
}

function CommandBar({ filters, setFilters, loading, onRefresh, children }) {
  return (
    <section className="bo-command-bar rv-command-bar" aria-label="Bộ lọc hoàn tiền hủy">
      <div className="bo-command-bar__filters">
        <label className="bo-command-bar__search">
          <Search size={16} aria-hidden="true" />
          <input
            value={filters.keyword || ''}
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value, page: 1 }))}
            placeholder="Mã refund, payment, invoice, bệnh nhân, SĐT, transaction ref"
          />
        </label>
        <label>
          <span>Từ ngày</span>
          <input type="date" value={filters.date_from || ''} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value, page: 1 }))} />
        </label>
        <label>
          <span>Đến ngày</span>
          <input type="date" value={filters.date_to || ''} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value, page: 1 }))} />
        </label>
        {children}
      </div>
      <div className="bo-command-bar__actions">
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

function RefundTable({ rows = [], selectedId, onSelect }) {
  if (!rows.length) return <EmptyState label="Không có refund request trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap rv-table-wrap">
      <table className="bo-table rv-table">
        <thead>
          <tr>
            <th>Risk</th>
            <th>SLA</th>
            <th>Refund</th>
            <th>Bệnh nhân</th>
            <th>Payment / Invoice</th>
            <th>Số tiền</th>
            <th>Nguồn</th>
            <th>Trạng thái</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = idOf(row);
            const payment = row.payment_id || row.payment || {};
            const invoice = row.invoice_id || row.invoice || {};
            return (
              <tr key={id} className={selectedId === id ? 'is-selected' : ''} onClick={() => onSelect(row)}>
                <td><RiskBadge score={row.risk_score} flags={row.risk_flags} /></td>
                <td><SlaPill date={row.requested_at || row.created_at} /></td>
                <td>
                  <strong>{row.refund_no || id}</strong>
                  <small>{row.reason_category || row.reason_detail || '-'}</small>
                </td>
                <td>
                  <span className="rv-patient"><UserRound size={15} />{patientName(row)}</span>
                  <small>{patientSub(row)}</small>
                </td>
                <td>
                  <strong>{payment.payment_no || idOf(payment) || '-'}</strong>
                  <small>{invoice.invoice_no || idOf(invoice) || '-'}</small>
                </td>
                <td>
                  <span className="bo-money bo-money--compact">{formatMoney(row.processed_amount || row.approved_amount || row.requested_amount)}</span>
                  <small>Gốc {formatMoney(row.original_payment_amount)}</small>
                </td>
                <td>{SOURCE_LABELS[row.request_source] || row.request_source || '-'}</td>
                <td><StatusBadge status={row.refund_status} /></td>
                <td><span className="rv-next">{nextRefundAction(row.refund_status)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function nextRefundAction(status) {
  if (status === 'requested') return 'Review';
  if (status === 'under_review') return 'Approve / Reject';
  if (status === 'approved') return 'Process payout';
  if (status === 'processing') return 'Mark paid';
  if (status === 'failed') return 'Retry / reject';
  return 'Open audit';
}

function DetailLine({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  );
}

function RefundDetailDrawer({ refund, onClose, onDone }) {
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({ reason: '', payout_transaction_ref: '', payout_provider: '', amount: '' });
  const [state, setState] = useState({ loading: false, error: '', success: '' });
  const detailState = useRefundVoidResource(
    () => billingRefundVoidAPI.refundDetail(idOf(refund)),
    { refund_id: idOf(refund) },
    Boolean(refund),
  );
  const detail = detailState.data || refund;
  const payment = detail?.payment || detail?.payment_id || {};
  const invoice = detail?.invoice || detail?.invoice_id || {};

  useEffect(() => {
    setTab('overview');
    setForm({ reason: '', payout_transaction_ref: '', payout_provider: '', amount: '' });
    setState({ loading: false, error: '', success: '' });
  }, [idOf(refund)]);

  if (!refund) return null;

  async function act(type) {
    setState({ loading: true, error: '', success: '' });
    try {
      const refundId = idOf(detail);
      if (type === 'review') await billingRefundVoidAPI.reviewRefund(refundId, { note: form.reason });
      if (type === 'approve') await billingRefundVoidAPI.approveRefund(refundId, { approved_amount: Number(form.amount || detail.requested_amount), reason: form.reason });
      if (type === 'reject') await billingRefundVoidAPI.rejectRefund(refundId, { reason: form.reason || 'Không đủ điều kiện hoàn tiền' });
      if (type === 'process') {
        await billingRefundVoidAPI.processRefund(refundId, {
          processed_amount: Number(form.amount || detail.approved_amount || detail.requested_amount),
          payout_transaction_ref: form.payout_transaction_ref,
          payout_provider: form.payout_provider,
          reason: form.reason,
        });
      }
      if (type === 'evidence') {
        await billingRefundVoidAPI.addEvidence(refundId, {
          evidence_files: [{
            file_name: 'Chứng từ bổ sung',
            file_url: form.payout_transaction_ref || 'manual://evidence',
            evidence_type: 'internal_note',
            note: form.reason,
          }],
        });
      }
      setState({ loading: false, error: '', success: 'Đã cập nhật refund.' });
      onDone?.();
      detailState.refresh();
    } catch (error) {
      setState({ loading: false, error: getRefundVoidErrorMessage(error), success: '' });
    }
  }

  const tabs = [
    ['overview', 'Tổng quan'],
    ['payment', 'Payment gốc'],
    ['invoice', 'Invoice'],
    ['evidence', 'Chứng từ'],
    ['approval', 'Approval'],
    ['audit', 'Timeline'],
  ];

  return (
    <aside className="bo-drawer rv-drawer" aria-label="Chi tiết refund">
      <header>
        <div>
          <span>Refund detail</span>
          <h2>{detail?.refund_no || idOf(refund)}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><X size={18} /></button>
      </header>
      <div className="rv-drawer-hero">
        <RiskBadge score={detail?.risk_score} flags={detail?.risk_flags} />
        <div>
          <strong>{formatMoney(detail?.requested_amount)}</strong>
          <small>{refundStatusText(detail?.refund_status)} · {SOURCE_LABELS[detail?.request_source] || detail?.request_source}</small>
        </div>
        <StatusBadge status={detail?.refund_status} />
      </div>

      <div className="bo-tabs rv-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {detailState.loading ? <EmptyState compact label="Đang tải chi tiết refund..." /> : null}
      {detailState.error ? <div className="bo-error"><AlertTriangle size={16} />{detailState.error}</div> : null}

      <div className="bo-drawer__body rv-drawer-body">
        {tab === 'overview' ? (
          <section>
            <h3>Tổng quan</h3>
            <dl>
              <DetailLine label="Patient" value={`${patientName(detail)} · ${patientSub(detail)}`} />
              <DetailLine label="Refund amount" value={formatMoney(detail?.requested_amount)} />
              <DetailLine label="Approved" value={formatMoney(detail?.approved_amount)} />
              <DetailLine label="Processed" value={formatMoney(detail?.processed_amount)} />
              <DetailLine label="Reason" value={detail?.reason_detail || detail?.reject_reason} />
              <DetailLine label="Risk flags" value={(detail?.risk_flags || []).join(', ') || '-'} />
            </dl>
          </section>
        ) : null}
        {tab === 'payment' ? (
          <section>
            <h3>Payment gốc</h3>
            <dl>
              <DetailLine label="Payment no" value={payment.payment_no} />
              <DetailLine label="Status" value={refundStatusText(payment.status)} />
              <DetailLine label="Method" value={METHOD_LABELS[payment.payment_method] || payment.payment_method} />
              <DetailLine label="Provider" value={payment.payment_provider || payment.provider} />
              <DetailLine label="Transaction ref" value={payment.transaction_ref || payment.transaction_reference || payment.provider_transaction_id} />
              <DetailLine label="Paid at" value={formatDateTime(payment.paid_at)} />
            </dl>
          </section>
        ) : null}
        {tab === 'invoice' ? (
          <section>
            <h3>Invoice liên quan</h3>
            <dl>
              <DetailLine label="Invoice no" value={invoice.invoice_no} />
              <DetailLine label="Status" value={refundStatusText(invoice.status)} />
              <DetailLine label="Total" value={formatMoney(invoice.total_amount)} />
              <DetailLine label="Paid" value={formatMoney(invoice.paid_amount)} />
              <DetailLine label="Balance due" value={formatMoney(invoice.balance_due)} />
            </dl>
            {['paid', 'partially_paid'].includes(invoice.status) ? (
              <div className="rv-warning"><AlertTriangle size={16} />Invoice có payment completed, void invoice phải đi qua refund/void payment trước.</div>
            ) : null}
          </section>
        ) : null}
        {tab === 'evidence' ? (
          <section>
            <h3>Chứng từ</h3>
            <div className="rv-evidence-grid">
              {(detail?.evidence_files || []).map((file, index) => (
                <article key={`${file.file_url || file.file_name}-${index}`}>
                  <FileText size={18} />
                  <strong>{file.file_name || file.evidence_type || 'Evidence'}</strong>
                  <small>{file.note || file.file_url || '-'}</small>
                </article>
              ))}
              {!detail?.evidence_files?.length ? <EmptyState compact label="Chưa có chứng từ refund." /> : null}
            </div>
          </section>
        ) : null}
        {tab === 'approval' ? (
          <section>
            <h3>Approval chain</h3>
            <div className="rv-approval-chain">
              {['Cashier lead', 'Accountant', 'Finance manager', 'Admin override'].map((label, index) => (
                <span key={label} className={index < 2 && ['approved', 'processed'].includes(detail?.refund_status) ? 'is-done' : ''}>
                  <ClipboardCheck size={15} />
                  {label}
                </span>
              ))}
            </div>
          </section>
        ) : null}
        {tab === 'audit' ? (
          <section>
            <h3>Timeline & Audit</h3>
            <div className="rv-timeline">
              {(detail?.audit_timeline || detail?.audit_logs || []).map((item, index) => (
                <article key={`${item.action}-${index}`}>
                  <i />
                  <div>
                    <strong>{item.action}</strong>
                    <small>{formatDateTime(item.at || item.created_at)} · {item.source || item.actor_type || '-'}</small>
                    {item.reason ? <span>{item.reason}</span> : null}
                  </div>
                </article>
              ))}
              {!detail?.audit_timeline?.length && !detail?.audit_logs?.length ? <EmptyState compact label="Chưa có audit timeline." /> : null}
            </div>
          </section>
        ) : null}
      </div>

      <form className="rv-action-form" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>Số tiền</span>
          <input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder={String(detail?.approved_amount || detail?.requested_amount || '')} />
        </label>
        <label>
          <span>Reference / chứng từ</span>
          <input value={form.payout_transaction_ref} onChange={(event) => setForm((current) => ({ ...current, payout_transaction_ref: event.target.value }))} placeholder="Payout ref hoặc file URL" />
        </label>
        <label className="rv-form-wide">
          <span>Lý do / ghi chú</span>
          <textarea rows={2} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
        </label>
        {state.error ? <div className="bo-error rv-form-wide"><AlertTriangle size={16} />{state.error}</div> : null}
        {state.success ? <div className="bc-success rv-form-wide"><CheckCircle2 size={16} />{state.success}</div> : null}
        <div className="rv-action-row rv-form-wide">
          <button type="button" onClick={() => act('review')} disabled={state.loading || detail?.refund_status !== 'requested'}><FileSearch size={15} />Review</button>
          <button type="button" onClick={() => act('approve')} disabled={state.loading || !['requested', 'under_review', 'failed'].includes(detail?.refund_status)}><BadgeCheck size={15} />Approve</button>
          <button type="button" onClick={() => act('process')} disabled={state.loading || !['approved', 'processing'].includes(detail?.refund_status)}><WalletCards size={15} />Process</button>
          <button type="button" onClick={() => act('reject')} disabled={state.loading || ['processed', 'rejected', 'cancelled'].includes(detail?.refund_status)}><Ban size={15} />Reject</button>
          <button type="button" onClick={() => act('evidence')} disabled={state.loading}><Upload size={15} />Evidence</button>
        </div>
      </form>
    </aside>
  );
}

function RefundQueuePage({ mode }) {
  const config = REFUND_PAGE_CONFIG[mode] || REFUND_PAGE_CONFIG.requests;
  const [filters, setFilters] = useState({ page: 1, limit: 30, keyword: '', refund_status: '', date_from: '', date_to: '' });
  const [selected, setSelected] = useState(null);
  const params = useMemo(() => ({
    page: filters.page,
    limit: filters.limit,
    bucket: config.bucket,
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.refund_status ? { refund_status: filters.refund_status } : {}),
    ...(filters.date_from ? { date_from: `${filters.date_from}T00:00:00` } : {}),
    ...(filters.date_to ? { date_to: `${filters.date_to}T23:59:59` } : {}),
  }), [config.bucket, filters]);
  const refunds = useRefundVoidResource(billingRefundVoidAPI.refunds, params);
  const summary = useRefundVoidResource(billingRefundVoidAPI.summary, params);
  const rows = refunds.data?.items || [];

  function refreshAll() {
    refunds.refresh();
    summary.refresh();
  }

  return (
    <section className="billing-overview rv-workbench">
      <RefundVoidHeader title={config.title} kicker={config.kicker} loading={refunds.loading || summary.loading} onRefresh={refreshAll} />
      <RefundVoidKpis summary={summary.data || {}} rows={rows} />
      <CommandBar filters={filters} setFilters={setFilters} loading={refunds.loading} onRefresh={refreshAll}>
        <label>
          <span>Trạng thái</span>
          <select value={filters.refund_status} onChange={(event) => setFilters((current) => ({ ...current, refund_status: event.target.value, page: 1 }))}>
            <option value="">Tất cả tab</option>
            {config.tabs.map((status) => <option key={status} value={status}>{REFUND_STATUS_LABELS[status]}</option>)}
          </select>
        </label>
        <label>
          <span>Giới hạn</span>
          <select value={filters.limit} onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value), page: 1 }))}>
            <option value={20}>20 dòng</option>
            <option value={30}>30 dòng</option>
            <option value={50}>50 dòng</option>
          </select>
        </label>
      </CommandBar>
      {refunds.error ? <div className="bo-error"><AlertTriangle size={16} />{refunds.error}</div> : null}

      <div className="bo-tabs rv-tabs">
        <button type="button" className={!filters.refund_status ? 'is-active' : ''} onClick={() => setFilters((current) => ({ ...current, refund_status: '', page: 1 }))}>Tất cả</button>
        {config.tabs.map((status) => (
          <button key={status} type="button" className={filters.refund_status === status ? 'is-active' : ''} onClick={() => setFilters((current) => ({ ...current, refund_status: status, page: 1 }))}>
            {REFUND_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <section className="rv-split">
        <section className="bo-panel">
          <header className="bo-panel__header">
            <h2>Queue refund</h2>
            <span>{formatNumber(rows.length)} hồ sơ</span>
          </header>
          <RefundTable rows={rows} selectedId={idOf(selected)} onSelect={setSelected} />
        </section>
        <RiskEnginePanel rows={rows} />
      </section>

      <div className="bo-tabs" aria-label="Phân trang refund">
        <button type="button" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trang trước</button>
        <button type="button" className="is-active">Trang {filters.page}</button>
        <button type="button" disabled={refunds.data?.pagination && filters.page >= refunds.data.pagination.total_pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Trang sau</button>
      </div>

      <RefundDetailDrawer refund={selected} onClose={() => setSelected(null)} onDone={refreshAll} />
    </section>
  );
}

function RiskEnginePanel({ rows = [] }) {
  const flags = rows.flatMap((row) => row.risk_flags || []);
  const counts = flags.reduce((acc, flag) => ({ ...acc, [flag]: (acc[flag] || 0) + 1 }), {});
  const topFlags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <aside className="rv-risk-panel">
      <header>
        <span>Risk engine</span>
        <strong>{formatNumber(topFlags.length)} tín hiệu</strong>
      </header>
      <div className="rv-risk-list">
        {topFlags.map(([flag, count]) => (
          <span key={flag}>
            <ShieldAlert size={15} />
            <strong>{flag.replace(/_/g, ' ')}</strong>
            <small>{count} case</small>
          </span>
        ))}
        {!topFlags.length ? <EmptyState compact label="Chưa phát hiện risk flag." /> : null}
      </div>
      <div className="rv-rule-box">
        <strong>Rule đang bật</strong>
        <span>Amount threshold · Same payment duplicate · Insurance claim · Missing receipt · Manual provider · Under 24h</span>
      </div>
    </aside>
  );
}

function PreviewList({ preview }) {
  if (!preview) return <EmptyState compact label="Chọn một dòng để xem preview an toàn." />;
  const blockers = preview.blocking_reasons || preview.blockers || [];
  const warnings = preview.warnings || [];
  return (
    <div className="rv-preview">
      <div className={blockers.length ? 'rv-readiness is-blocked' : 'rv-readiness is-ready'}>
        {blockers.length ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        <strong>{blockers.length ? 'Đang bị chặn' : 'Có thể thao tác'}</strong>
      </div>
      {[...blockers, ...warnings].map((item) => (
        <span key={`${item.code}-${item.message}`} className={blockers.includes(item) ? 'is-danger' : ''}>
          {item.message || item.code}
        </span>
      ))}
      <section>
        <h3>Before / After</h3>
        <dl>
          <DetailLine label="Invoice before" value={`${preview.invoice_before?.status || '-'} · paid ${formatMoney(preview.invoice_before?.paid_amount)}`} />
          <DetailLine label="Invoice after" value={`${preview.invoice_after?.status || '-'} · paid ${formatMoney(preview.invoice_after?.paid_amount)}`} />
          <DetailLine label="Recommended" value={preview.recommended_action} />
        </dl>
      </section>
    </div>
  );
}

function VoidPaymentPage() {
  const [filters, setFilters] = useState({ page: 1, limit: 30, keyword: '', status: 'pending,completed' });
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ reason: '', reason_category: 'cashier_error', void_type: '', notify_patient: false });
  const [action, setAction] = useState({ loading: false, error: '', success: '' });
  const payments = useRefundVoidResource(billingRefundVoidAPI.payments, {
    page: filters.page,
    limit: filters.limit,
    status: filters.status,
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
  });
  const preview = useRefundVoidResource(
    () => billingRefundVoidAPI.paymentVoidPreview(idOf(selected)),
    { payment_id: idOf(selected) },
    Boolean(selected),
  );
  const summary = useRefundVoidResource(billingRefundVoidAPI.summary, {});
  const rows = payments.data?.items || [];

  async function voidSelected() {
    if (!selected) return;
    setAction({ loading: true, error: '', success: '' });
    try {
      await billingRefundVoidAPI.voidPayment(idOf(selected), {
        reason: form.reason || 'Void payment từ refund/void workspace',
        reason_category: form.reason_category,
        void_type: form.void_type || preview.data?.recommended_action,
        notify_patient: form.notify_patient,
      });
      setAction({ loading: false, error: '', success: 'Đã void payment.' });
      payments.refresh();
      summary.refresh();
      preview.refresh();
    } catch (error) {
      setAction({ loading: false, error: getRefundVoidErrorMessage(error), success: '' });
    }
  }

  return (
    <section className="billing-overview rv-workbench">
      <RefundVoidHeader title="Void payment" kicker="Hủy / reversal thanh toán" loading={payments.loading} onRefresh={payments.refresh} />
      <RefundVoidKpis summary={summary.data || {}} rows={rows} />
      <CommandBar filters={filters} setFilters={setFilters} loading={payments.loading} onRefresh={payments.refresh}>
        <label>
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
            <option value="pending,completed">Có thể void</option>
            <option value="pending">Pending payment</option>
            <option value="completed">Completed cần reverse</option>
            <option value="voided">Đã void</option>
          </select>
        </label>
      </CommandBar>
      {payments.error ? <div className="bo-error"><AlertTriangle size={16} />{payments.error}</div> : null}
      <section className="rv-split rv-split--wide">
        <section className="bo-panel">
          <header className="bo-panel__header">
            <h2>Payment eligibility queue</h2>
            <span>{formatNumber(rows.length)} payment</span>
          </header>
          <PaymentVoidTable rows={rows} selectedId={idOf(selected)} onSelect={setSelected} />
        </section>
        <aside className="rv-side-panel">
          <header>
            <span>Void preview</span>
            <strong>{selected?.payment_no || 'Chọn payment'}</strong>
          </header>
          {preview.loading ? <EmptyState compact label="Đang tính preview..." /> : <PreviewList preview={preview.data} />}
          <form className="rv-action-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>Reason category</span>
              <select value={form.reason_category} onChange={(event) => setForm((current) => ({ ...current, reason_category: event.target.value }))}>
                <option value="duplicate_payment">Duplicate payment</option>
                <option value="wrong_amount">Sai số tiền</option>
                <option value="wrong_invoice">Sai invoice</option>
                <option value="wrong_patient">Sai bệnh nhân</option>
                <option value="cashier_error">Cashier error</option>
                <option value="bank_mismatch">Bank mismatch</option>
                <option value="fraud_suspected">Nghi vấn fraud</option>
                <option value="other">Khác</option>
              </select>
            </label>
            <label>
              <span>Lý do chi tiết</span>
              <textarea rows={3} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
            </label>
            <label className="rv-check">
              <input type="checkbox" checked={form.notify_patient} onChange={(event) => setForm((current) => ({ ...current, notify_patient: event.target.checked }))} />
              <span>Thông báo bệnh nhân</span>
            </label>
            {selected?.status === 'completed' ? <div className="rv-warning"><AlertTriangle size={16} />Payment completed nên được hiểu là reversal/void nghiệp vụ, không phải refund tiền ra ngoài.</div> : null}
            {action.error ? <div className="bo-error"><AlertTriangle size={16} />{action.error}</div> : null}
            {action.success ? <div className="bc-success"><CheckCircle2 size={16} />{action.success}</div> : null}
            <button type="button" className="bc-danger-button" disabled={!selected || action.loading || preview.data?.can_void === false} onClick={voidSelected}>
              {action.loading ? <Loader2 size={16} className="bo-spin" /> : <Ban size={16} />}
              <span>Void payment</span>
            </button>
          </form>
        </aside>
      </section>
    </section>
  );
}

function PaymentVoidTable({ rows = [], selectedId, onSelect }) {
  if (!rows.length) return <EmptyState label="Không có payment phù hợp để void." />;
  return (
    <div className="bo-table-wrap rv-table-wrap">
      <table className="bo-table rv-table">
        <thead>
          <tr>
            <th>Payment</th>
            <th>Bệnh nhân</th>
            <th>Invoice</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Transaction</th>
            <th>Status</th>
            <th>Eligibility</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={idOf(row)} className={selectedId === idOf(row) ? 'is-selected' : ''} onClick={() => onSelect(row)}>
              <td><strong>{row.payment_no || idOf(row)}</strong><small>{formatDateTime(row.paid_at || row.created_at)}</small></td>
              <td><span className="rv-patient"><UserRound size={15} />{patientName(row)}</span><small>{patientSub(row)}</small></td>
              <td><strong>{row.invoice_id?.invoice_no || '-'}</strong><small>{refundStatusText(row.invoice_id?.status)}</small></td>
              <td>{METHOD_LABELS[row.payment_method] || row.payment_provider || '-'}</td>
              <td>{formatMoney(row.amount)}</td>
              <td>{row.transaction_ref || row.transaction_reference || row.provider_transaction_id || '-'}</td>
              <td><StatusBadge status={row.status} /></td>
              <td><span className="rv-next">{row.status === 'completed' ? 'Reverse recommended' : 'Void pending'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VoidInvoicePage() {
  const [filters, setFilters] = useState({ page: 1, limit: 30, keyword: '', status: 'draft,issued,partially_paid,paid' });
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ reason: '', reason_category: 'wrong_charge', cancel: false, release_charges: true, notify_patient: false });
  const [action, setAction] = useState({ loading: false, error: '', success: '' });
  const invoices = useRefundVoidResource(billingRefundVoidAPI.invoices, {
    page: filters.page,
    limit: filters.limit,
    status: filters.status,
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
  });
  const preview = useRefundVoidResource(
    () => billingRefundVoidAPI.invoiceVoidPreview(idOf(selected)),
    { invoice_id: idOf(selected) },
    Boolean(selected),
  );
  const summary = useRefundVoidResource(billingRefundVoidAPI.summary, {});
  const rows = invoices.data?.items || [];

  async function voidSelected() {
    if (!selected) return;
    setAction({ loading: true, error: '', success: '' });
    try {
      await billingRefundVoidAPI.voidInvoice(idOf(selected), {
        reason: form.reason || 'Void invoice từ refund/void workspace',
        reason_category: form.reason_category,
        cancel: form.cancel,
        release_charges: form.release_charges,
        notify_patient: form.notify_patient,
      });
      setAction({ loading: false, error: '', success: 'Đã void/cancel invoice.' });
      invoices.refresh();
      summary.refresh();
      preview.refresh();
    } catch (error) {
      setAction({ loading: false, error: getRefundVoidErrorMessage(error), success: '' });
    }
  }

  return (
    <section className="billing-overview rv-workbench">
      <RefundVoidHeader title="Void invoice" kicker="Hủy hóa đơn và release charges" loading={invoices.loading} onRefresh={invoices.refresh} />
      <RefundVoidKpis summary={summary.data || {}} rows={rows} />
      <CommandBar filters={filters} setFilters={setFilters} loading={invoices.loading} onRefresh={invoices.refresh}>
        <label>
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
            <option value="draft,issued,partially_paid,paid">Tất cả cần kiểm tra</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued chưa thu</option>
            <option value="partially_paid,paid">Có payment</option>
            <option value="voided,cancelled">Đã hủy</option>
          </select>
        </label>
      </CommandBar>
      {invoices.error ? <div className="bo-error"><AlertTriangle size={16} />{invoices.error}</div> : null}
      <section className="rv-split rv-split--wide">
        <section className="bo-panel">
          <header className="bo-panel__header">
            <h2>Invoice eligibility queue</h2>
            <span>{formatNumber(rows.length)} invoice</span>
          </header>
          <InvoiceVoidTable rows={rows} selectedId={idOf(selected)} onSelect={setSelected} />
        </section>
        <aside className="rv-side-panel">
          <header>
            <span>Void invoice preview</span>
            <strong>{selected?.invoice_no || 'Chọn invoice'}</strong>
          </header>
          {preview.loading ? <EmptyState compact label="Đang tính preview..." /> : <PreviewList preview={preview.data} />}
          <form className="rv-action-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span>Reason category</span>
              <select value={form.reason_category} onChange={(event) => setForm((current) => ({ ...current, reason_category: event.target.value }))}>
                <option value="wrong_patient">Sai bệnh nhân</option>
                <option value="wrong_charge">Sai charge</option>
                <option value="duplicate_invoice">Duplicate invoice</option>
                <option value="service_cancelled">Hủy dịch vụ</option>
                <option value="insurance_recalculation">Tính lại bảo hiểm</option>
                <option value="other">Khác</option>
              </select>
            </label>
            <label>
              <span>Lý do chi tiết</span>
              <textarea rows={3} value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
            </label>
            <label className="rv-check">
              <input type="checkbox" checked={form.release_charges} onChange={(event) => setForm((current) => ({ ...current, release_charges: event.target.checked }))} />
              <span>Release charges về posted</span>
            </label>
            <label className="rv-check">
              <input type="checkbox" checked={form.cancel} onChange={(event) => setForm((current) => ({ ...current, cancel: event.target.checked }))} />
              <span>Cancel thay vì void</span>
            </label>
            {preview.data?.blocking_reasons?.some((item) => item.code === 'HAS_COMPLETED_PAYMENT') ? (
              <div className="rv-warning"><AlertTriangle size={16} />Hóa đơn đã có payment completed. Cần refund hoặc void payment trước khi hủy invoice.</div>
            ) : null}
            {action.error ? <div className="bo-error"><AlertTriangle size={16} />{action.error}</div> : null}
            {action.success ? <div className="bc-success"><CheckCircle2 size={16} />{action.success}</div> : null}
            <button type="button" className="bc-danger-button" disabled={!selected || action.loading || preview.data?.can_void === false} onClick={voidSelected}>
              {action.loading ? <Loader2 size={16} className="bo-spin" /> : <Ban size={16} />}
              <span>{form.cancel ? 'Cancel invoice' : 'Void invoice'}</span>
            </button>
          </form>
        </aside>
      </section>
    </section>
  );
}

function InvoiceVoidTable({ rows = [], selectedId, onSelect }) {
  if (!rows.length) return <EmptyState label="Không có invoice trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap rv-table-wrap">
      <table className="bo-table rv-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Bệnh nhân</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Balance</th>
            <th>Status</th>
            <th>Blocking reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={idOf(row)} className={selectedId === idOf(row) ? 'is-selected' : ''} onClick={() => onSelect(row)}>
              <td><strong>{row.invoice_no || idOf(row)}</strong><small>{formatDateTime(row.issued_at || row.created_at)}</small></td>
              <td><span className="rv-patient"><UserRound size={15} />{patientName(row)}</span><small>{patientSub(row)}</small></td>
              <td>{formatMoney(row.total_amount)}</td>
              <td>{formatMoney(row.paid_amount)}</td>
              <td>{formatMoney(row.balance_due)}</td>
              <td><StatusBadge status={row.status} /></td>
              <td><span className="rv-next">{Number(row.paid_amount || 0) > 0 ? 'Cần xử lý payment trước' : 'Có thể void'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefundVoidHistoryPage() {
  const [filters, setFilters] = useState({ page: 1, limit: 50, keyword: '', event_type: '', date_from: todayInputValue(), date_to: todayInputValue() });
  const params = useMemo(() => ({
    page: filters.page,
    limit: filters.limit,
    ...(filters.event_type ? { event_type: filters.event_type } : {}),
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.date_from ? { date_from: `${filters.date_from}T00:00:00` } : {}),
    ...(filters.date_to ? { date_to: `${filters.date_to}T23:59:59` } : {}),
  }), [filters]);
  const history = useRefundVoidResource(billingRefundVoidAPI.history, params);
  const summary = useRefundVoidResource(billingRefundVoidAPI.summary, params);
  const rows = history.data?.items || [];

  return (
    <section className="billing-overview rv-workbench">
      <RefundVoidHeader title="Lịch sử hoàn tiền / hủy" kicker="Audit center" loading={history.loading || summary.loading} onRefresh={() => { history.refresh(); summary.refresh(); }} />
      <RefundVoidKpis summary={summary.data || {}} rows={rows} />
      <CommandBar filters={filters} setFilters={setFilters} loading={history.loading} onRefresh={history.refresh}>
        <label>
          <span>Event type</span>
          <select value={filters.event_type} onChange={(event) => setFilters((current) => ({ ...current, event_type: event.target.value, page: 1 }))}>
            <option value="">Tất cả</option>
            <option value="refund.processed">Refund processed</option>
            <option value="refund.rejected">Refund rejected</option>
            <option value="payment.voided">Payment voided</option>
            <option value="invoice.voided,invoice.cancelled">Invoice void/cancel</option>
          </select>
        </label>
      </CommandBar>
      {history.error ? <div className="bo-error"><AlertTriangle size={16} />{history.error}</div> : null}
      <section className="bo-panel">
        <header className="bo-panel__header">
          <h2>Timeline audit</h2>
          <span>{formatNumber(rows.length)} sự kiện</span>
        </header>
        <HistoryTable rows={rows} />
      </section>
    </section>
  );
}

function HistoryTable({ rows = [] }) {
  if (!rows.length) return <EmptyState label="Không có sự kiện refund/void trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap rv-table-wrap">
      <table className="bo-table rv-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>Target</th>
            <th>Patient</th>
            <th>Amount</th>
            <th>Actor</th>
            <th>Reason</th>
            <th>Audit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.event_type}-${row.target_id}-${index}`}>
              <td>{formatDateTime(row.happened_at)}</td>
              <td><StatusBadge status={row.event_type} /></td>
              <td><strong>{row.target_no || row.target_id}</strong><small>{row.target_type}</small></td>
              <td><span className="rv-patient"><UserRound size={15} />{row.patient?.full_name || row.patient?.patient_code || '-'}</span><small>{row.patient?.phone || '-'}</small></td>
              <td>{formatMoney(row.amount)}</td>
              <td>{row.actor?.full_name || row.actor?.username || row.actor?.actor_type || '-'}</td>
              <td>{row.reason || '-'}</td>
              <td><span className="rv-next">{row.evidence_count ? `${row.evidence_count} chứng từ` : 'Audit ok'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RefundRequestsPage() {
  return <RefundQueuePage mode="requests" />;
}

export function PendingRefundsPage() {
  return <RefundQueuePage mode="pending" />;
}

export function ProcessedRefundsPage() {
  return <RefundQueuePage mode="processed" />;
}

export { VoidPaymentPage, VoidInvoicePage, RefundVoidHistoryPage };
