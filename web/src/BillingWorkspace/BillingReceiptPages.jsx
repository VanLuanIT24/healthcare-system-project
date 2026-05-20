import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileSearch,
  FileText,
  History,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { readStoredAuth } from '../lib/storage';
import { billingReceiptAPI, getBillingReceiptErrorMessage } from './billingReceiptApi';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

const PAYMENT_STATUS_LABELS = {
  pending: 'Chờ xử lý',
  pending_manual_confirmation: 'Chờ xác nhận',
  submitted_receipt: 'BN gửi biên lai',
  manual_review: 'Manual review',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  failed: 'Thất bại',
  rejected: 'Bị từ chối',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
  refunded_manual: 'Hoàn tiền thủ công',
  voided: 'Đã void',
};

const RECEIPT_STATUS_LABELS = {
  generated: 'Đã tạo',
  printed: 'Đã in',
  sent: 'Đã gửi',
  downloaded: 'Đã tải',
  voided: 'Đã void',
  reissued: 'Đã in lại',
};

const METHOD_LABELS = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản',
  qr: 'QR',
  card: 'Thẻ',
  insurance: 'Bảo hiểm',
  e_wallet: 'Ví điện tử',
  other: 'Khác',
  qr_manual: 'QR thủ công',
};

const PERMISSION = {
  receiptRead: 'receipts.read',
  receiptGenerate: 'receipts.generate',
  receiptPrint: 'receipts.print',
  receiptReprint: 'receipts.reprint',
  receiptDownload: 'receipts.download',
  receiptSend: 'receipts.send',
  receiptExport: 'receipts.export',
  receiptAudit: 'receipts.view_audit',
  paymentPrint: 'payments.print_receipt',
  paymentRead: 'payments.read',
  paymentCreate: 'payments.create',
  paymentReconcile: 'payment_reconciliation.read',
};

function currentPermissions() {
  const auth = readStoredAuth() || {};
  const user = auth.user || auth.profile || {};
  return new Set([
    ...(auth.permissions || []),
    ...(auth.permission_codes || []),
    ...(user.permissions || []),
    ...(user.permission_codes || []),
  ]);
}

function can(codes = []) {
  const permissions = currentPermissions();
  if (!permissions.size) return true;
  return permissions.has('*') || permissions.has('system.full_access') || codes.some((code) => permissions.has(code));
}

function getId(row = {}) {
  return row?._id || row?.id || row?.payment_id || row?.receipt_id || row?.payment_intent_id || null;
}

function getObjectId(value) {
  if (!value) return null;
  if (typeof value === 'object') return value._id || value.id || null;
  return value;
}

function getPayment(row = {}) {
  const safe = row || {};
  const payment = safe.payment_id || safe.payment || safe;
  return payment && typeof payment === 'object' ? payment : {};
}

function getInvoice(row = {}) {
  const safe = row || {};
  const invoice = safe.invoice_id || safe.invoice || getPayment(safe).invoice_id || {};
  return invoice && typeof invoice === 'object' ? invoice : {};
}

function getPatient(row = {}) {
  const safe = row || {};
  const patient = safe.patient_id || safe.patient || getPayment(safe).patient_id || {};
  return patient && typeof patient === 'object' ? patient : {};
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
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function statusTone(status = '') {
  if (['completed', 'confirmed', 'generated', 'printed', 'sent', 'downloaded'].includes(status)) return 'success';
  if (['pending', 'pending_manual_confirmation', 'submitted_receipt', 'manual_review', 'reissued'].includes(status)) return 'warning';
  if (['failed', 'rejected', 'expired', 'cancelled', 'refunded', 'refunded_manual', 'voided'].includes(status)) return 'danger';
  return 'info';
}

function StatusBadge({ status, labels = PAYMENT_STATUS_LABELS }) {
  return <span className={`bo-status bo-status--${statusTone(status)}`}>{labels[status] || status || '-'}</span>;
}

function EmptyState({ label }) {
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

function ReceiptFrame({ eyebrow, title, description, loading, error, onRefresh, actions, children }) {
  return (
    <section className="billing-overview br-workbench">
      <header className="bo-page-header">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="br-header-actions">
          <div className="bo-refresh-indicator">
            {loading ? <Loader2 size={16} className="bo-spin" /> : <Clock3 size={16} />}
            <span>Dữ liệu trực tiếp</span>
          </div>
          {actions}
        </div>
      </header>
      {error ? <div className="bo-alert bo-alert--danger"><AlertTriangle size={16} />{error}</div> : null}
      {children}
      <button type="button" className="br-floating-refresh" onClick={onRefresh} aria-label="Tải lại">
        {loading ? <Loader2 size={18} className="bo-spin" /> : <RefreshCcw size={18} />}
      </button>
    </section>
  );
}

function FilterBar({ filters, setFilters, placeholder, children }) {
  return (
    <section className="bo-command-bar" aria-label="Bộ lọc biên lai">
      <div className="bo-command-bar__filters">
        <label className="bo-command-bar__search">
          <Search size={16} aria-hidden="true" />
          <input
            value={filters.keyword}
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            placeholder={placeholder}
          />
        </label>
        {children}
        <label>
          <span>Giới hạn</span>
          <select value={filters.limit} onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value) }))}>
            <option value={20}>20 dòng</option>
            <option value={50}>50 dòng</option>
            <option value={100}>100 dòng</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function useWorkbench(loader, params) {
  const [state, setState] = useState({ rows: [], pagination: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    loader(params)
      .then((result) => {
        if (!cancelled) setState({ rows: result?.items || [], pagination: result?.pagination || null, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ rows: [], pagination: null, loading: false, error: getBillingReceiptErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [loader, key, version]);

  return { ...state, refresh: () => setVersion((current) => current + 1) };
}

function PatientCell({ row }) {
  const patient = getPatient(row);
  return (
    <div className="bo-patient-mini">
      <ReceiptText size={18} />
      <span>
        <strong>{patient.full_name || row.patient_name || '-'}</strong>
        <small>{[patient.patient_code, patient.phone].filter(Boolean).join(' · ') || getObjectId(row.patient_id) || '-'}</small>
      </span>
    </div>
  );
}

function ReceiptFileViewer({ source }) {
  const fileUrl = source?.receipt_image_url || source?.original_receipt_image_url || source?.payment_intent_id?.receipt_image_url;
  const mime = source?.receipt_mime_type || source?.original_receipt_mime_type || source?.payment_intent_id?.receipt_mime_type || '';
  return (
    <div className="br-file-viewer">
      {fileUrl && mime.includes('pdf') ? (
        <iframe src={fileUrl} title="Receipt PDF" />
      ) : fileUrl ? (
        <img src={fileUrl} alt="Biên lai bệnh nhân gửi" />
      ) : (
        <div className="br-file-viewer__empty"><FileText size={34} /><span>Chưa có file biên lai</span></div>
      )}
      <div>
        <strong>{source?.receipt_file_name || source?.original_receipt_file_name || source?.payment_intent_id?.receipt_file_name || 'File biên lai'}</strong>
        <small>{mime || '-'} · {source?.receipt_file_size || source?.original_receipt_file_size || source?.payment_intent_id?.receipt_file_size || 0} bytes</small>
      </div>
    </div>
  );
}

function ReceiptPreview({ payment, receipt, invoiceDetail }) {
  const actualPayment = getPayment(receipt || payment);
  const invoice = getInvoice(receipt || payment);
  const patient = getPatient(receipt || payment);
  const receiptNo = receipt?.receipt_no || actualPayment.payment_no || '-';

  return (
    <aside className="br-preview-panel" aria-label="Preview biên lai">
      <header>
        <div>
          <span>Receipt preview</span>
          <strong>{receiptNo}</strong>
        </div>
        {receipt?.status ? <StatusBadge status={receipt.status} labels={RECEIPT_STATUS_LABELS} /> : null}
      </header>
      <div className="br-receipt-paper">
        <div className="br-receipt-paper__hospital">
          <strong>MEDCARE HEALTH SYSTEM</strong>
          <span>BIÊN LAI THU TIỀN</span>
        </div>
        <dl>
          <div><dt>Mã biên lai</dt><dd>{receiptNo}</dd></div>
          <div><dt>Mã payment</dt><dd>{actualPayment.payment_no || '-'}</dd></div>
          <div><dt>Mã invoice</dt><dd>{invoice.invoice_no || getObjectId(actualPayment.invoice_id) || '-'}</dd></div>
          <div><dt>Bệnh nhân</dt><dd>{patient.full_name || '-'}</dd></div>
          <div><dt>Mã BN</dt><dd>{patient.patient_code || '-'}</dd></div>
          <div><dt>Ngày thu</dt><dd>{formatDateTime(actualPayment.paid_at || receipt?.issued_at)}</dd></div>
          <div><dt>Phương thức</dt><dd>{METHOD_LABELS[actualPayment.payment_method] || actualPayment.payment_method || '-'}</dd></div>
          <div><dt>Giao dịch</dt><dd>{actualPayment.transaction_ref || actualPayment.transaction_reference || '-'}</dd></div>
        </dl>
        <div className="br-receipt-total">
          <span>Tổng tiền</span>
          <strong>{formatMoney(actualPayment.amount || receipt?.amount)}</strong>
        </div>
      </div>
      <div className="br-preview-tabs">
        <section>
          <h3>Payment detail</h3>
          <dl>
            <div><dt>Provider</dt><dd>{actualPayment.payment_provider || actualPayment.provider || '-'}</dd></div>
            <div><dt>Intent code</dt><dd>{actualPayment.intent_code || '-'}</dd></div>
            <div><dt>Refund</dt><dd>{actualPayment.refund_status || '-'}</dd></div>
            <div><dt>Void/refund reason</dt><dd>{actualPayment.void_reason || actualPayment.refund_reason || '-'}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Invoice items</h3>
          {invoiceDetail?.items?.length ? invoiceDetail.items.slice(0, 5).map((item) => (
            <div className="br-line-item" key={item._id || item.service_name}>
              <span>{item.service_id?.service_name || item.description || item.item_name || '-'}</span>
              <strong>{formatMoney(item.line_total || item.total_amount)}</strong>
            </div>
          )) : <small>Chọn preview để tải invoice detail nếu cần.</small>}
        </section>
        <section>
          <h3>File bệnh nhân gửi</h3>
          <ReceiptFileViewer source={receipt || actualPayment} />
        </section>
      </div>
    </aside>
  );
}

function ReceiptKpis({ rows, mode = 'payments' }) {
  const amount = rows.reduce((sum, row) => sum + Number((mode === 'payments' ? row.amount : row.payment_id?.amount || row.amount) || 0), 0);
  const withFile = rows.filter((row) => row.receipt_image_url || row.original_receipt_image_url || row.payment_intent_id?.receipt_image_url).length;
  const printed = rows.filter((row) => Number(row.print_count || 0) > 0 || row.status === 'printed').length;
  const warnings = rows.filter((row) => ['voided', 'refunded', 'refunded_manual'].includes(row.status || row.payment_id?.status)).length;
  return (
    <div className="bo-kpi-grid bo-kpi-grid--compact">
      <KpiCard icon={ReceiptText} label="Tổng dòng" value={rows.length} meta="Theo bộ lọc hiện tại" />
      <KpiCard icon={Banknote} label="Tổng tiền" value={amount} money meta="Tính trên trang đang xem" tone="green" />
      <KpiCard icon={FileCheck2} label="Có file gửi kèm" value={withFile} meta="Ảnh/PDF bệnh nhân gửi" tone="violet" />
      <KpiCard icon={Printer} label="Đã in" value={printed} meta="Có print_count hoặc trạng thái printed" tone="amber" />
      <KpiCard icon={AlertTriangle} label="Refund/Void" value={warnings} meta="Cần cảnh báo khi in/tải" tone="danger" />
    </div>
  );
}

function PaymentReceiptTable({ rows, selected, onOpen, onAction }) {
  if (!rows.length) return <EmptyState label="Không có payment phù hợp để in biên lai." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table br-table">
        <thead>
          <tr>
            <th>Payment</th>
            <th>Invoice</th>
            <th>Bệnh nhân</th>
            <th>Số tiền</th>
            <th>Phương thức</th>
            <th>Giao dịch</th>
            <th>Ngày thu</th>
            <th>Trạng thái</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={getId(selected) === getId(row) ? 'is-active' : ''} onClick={() => onOpen(row)}>
              <td><strong>{row.payment_no || getId(row)}</strong><small>{row.intent_code || row.payment_provider || '-'}</small></td>
              <td><strong>{getInvoice(row).invoice_no || getObjectId(row.invoice_id) || '-'}</strong><small>{getInvoice(row).status || '-'}</small></td>
              <td><PatientCell row={row} /></td>
              <td>{formatMoney(row.amount)}</td>
              <td>{METHOD_LABELS[row.payment_method] || row.payment_method || '-'}</td>
              <td><span>{row.transaction_ref || row.transaction_reference || '-'}</span><small>{row.provider_transaction_id || '-'}</small></td>
              <td>{formatDateTime(row.paid_at || row.created_at)}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="bo-table-action" onClick={() => onAction('preview', row)}>Preview</button>
                  {can([PERMISSION.receiptPrint, PERMISSION.paymentPrint]) ? <button type="button" className="bo-table-action" onClick={() => onAction('print', row)}>In</button> : null}
                  {can([PERMISSION.receiptDownload, PERMISSION.paymentPrint]) ? <button type="button" className="bo-table-action" onClick={() => onAction('download', row)}>Tải</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReceiptPrintPage() {
  const [filters, setFilters] = useState({ keyword: '', payment_method: '', limit: 50 });
  const [selected, setSelected] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({
    page: 1,
    limit: filters.limit,
    status: 'completed',
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.payment_method ? { payment_method: filters.payment_method } : {}),
  }), [filters]);
  const { rows, loading, error, refresh } = useWorkbench(billingReceiptAPI.payments, params);

  async function ensureReceipt(row) {
    const result = await billingReceiptAPI.paymentReceipt(getId(row));
    setReceipt(result.receipt || result);
    return result.receipt || result;
  }

  async function runAction(action, row) {
    try {
      setSelected(row);
      const currentReceipt = await ensureReceipt(row);
      if (action === 'print') {
        await billingReceiptAPI.printReceipt(getId(currentReceipt), { copy_type: 'original' });
        setToast('Đã ghi nhận in biên lai.');
      }
      if (action === 'download') {
        await billingReceiptAPI.downloadReceipt(getId(currentReceipt));
        setToast('Đã ghi nhận tải biên lai.');
      }
      if (action === 'preview') setToast('Đã tải preview biên lai.');
      refresh();
    } catch (actionError) {
      setToast(getBillingReceiptErrorMessage(actionError));
    }
  }

  return (
    <ReceiptFrame
      eyebrow="Viện phí & Thu tiền / Biên lai / In biên lai"
      title="In biên lai"
      description="In biên lai thu tiền, chuyển khoản, QR, ví điện tử; preview trước khi in và xử lý nhanh các payment vừa hoàn tất."
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="br-primary-action" onClick={refresh}><RefreshCcw size={16} />Làm mới</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} placeholder="Tìm payment no, invoice no, bệnh nhân, transaction ref, intent code">
        <label>
          <span>Phương thức</span>
          <select value={filters.payment_method} onChange={(event) => setFilters((current) => ({ ...current, payment_method: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản</option>
            <option value="qr">QR</option>
            <option value="e_wallet">Ví điện tử</option>
            <option value="card">Thẻ</option>
          </select>
        </label>
      </FilterBar>
      {toast ? <div className="bo-alert"><CheckCircle2 size={16} />{toast}</div> : null}
      <ReceiptKpis rows={rows} mode="payments" />
      <section className="br-split">
        <PaymentReceiptTable rows={rows} selected={selected} onOpen={setSelected} onAction={runAction} />
        <ReceiptPreview payment={selected} receipt={receipt} />
      </section>
    </ReceiptFrame>
  );
}

function ReceiptTable({ rows, selected, onOpen, onAction, mode = 'download' }) {
  if (!rows.length) return <EmptyState label="Không có biên lai trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table br-table">
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Payment</th>
            <th>Invoice</th>
            <th>Bệnh nhân</th>
            <th>Số tiền</th>
            <th>In/Tải</th>
            <th>Trạng thái</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const payment = getPayment(row);
            return (
              <tr key={getId(row)} className={getId(selected) === getId(row) ? 'is-active' : ''} onClick={() => onOpen(row)}>
                <td><strong>{row.receipt_no || getId(row)}</strong><small>{formatDateTime(row.issued_at || row.created_at)}</small></td>
                <td><strong>{payment.payment_no || getObjectId(row.payment_id)}</strong><small>{payment.transaction_ref || row.transaction_ref || '-'}</small></td>
                <td><strong>{getInvoice(row).invoice_no || '-'}</strong><small>{getInvoice(row).status || '-'}</small></td>
                <td><PatientCell row={row} /></td>
                <td>{formatMoney(row.amount || payment.amount)}</td>
                <td><span>In {formatNumber(row.print_count || 0)}</span><small>Tải {formatNumber(row.download_count || 0)}</small></td>
                <td><StatusBadge status={row.status} labels={RECEIPT_STATUS_LABELS} /></td>
                <td>
                  <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                    {mode === 'reprint' && can([PERMISSION.receiptReprint, PERMISSION.paymentPrint]) ? <button type="button" className="bo-table-action" onClick={() => onAction('reprint', row)}>In lại</button> : null}
                    {can([PERMISSION.receiptDownload, PERMISSION.paymentPrint]) ? <button type="button" className="bo-table-action" onClick={() => onAction('download', row)}>Tải</button> : null}
                    {can([PERMISSION.receiptSend]) ? <button type="button" className="bo-table-action" onClick={() => onAction('send', row)}>Gửi</button> : null}
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

function useReceiptAction(refresh, setToast, setSelected) {
  return async function runAction(action, row) {
    try {
      setSelected?.(row);
      if (action === 'reprint') {
        const reason = window.prompt('Lý do in lại biên lai', 'Bệnh nhân yêu cầu bản sao');
        if (!reason) return;
        await billingReceiptAPI.reprintReceipt(getId(row), { reason, copy_type: 'duplicate' });
        setToast('Đã ghi nhận in lại biên lai.');
      }
      if (action === 'download') {
        await billingReceiptAPI.downloadReceipt(getId(row));
        setToast('Đã ghi nhận tải biên lai.');
      }
      if (action === 'send') {
        await billingReceiptAPI.sendReceipt(getId(row), { channel: 'patient_portal' });
        setToast('Đã ghi nhận gửi biên lai.');
      }
      refresh();
    } catch (error) {
      setToast(getBillingReceiptErrorMessage(error));
    }
  };
}

export function ReceiptReprintPage() {
  const [filters, setFilters] = useState({ keyword: '', status: '', limit: 50 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({
    page: 1,
    limit: filters.limit,
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  }), [filters]);
  const { rows, loading, error, refresh } = useWorkbench(billingReceiptAPI.receipts, params);
  const runAction = useReceiptAction(refresh, setToast, setSelected);

  return (
    <ReceiptFrame
      eyebrow="Viện phí & Thu tiền / Biên lai / In lại"
      title="In lại biên lai"
      description="Tìm biên lai đã phát hành, kiểm tra trạng thái payment, ghi nhận lý do và in bản sao có watermark."
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="br-primary-action" onClick={refresh}><Search size={16} />Tìm biên lai</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} placeholder="Receipt no, payment no, invoice no, bệnh nhân, transaction ref">
        <label>
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="printed">Đã in</option>
            <option value="generated">Đã tạo</option>
            <option value="reissued">Đã in lại</option>
            <option value="downloaded">Đã tải</option>
          </select>
        </label>
      </FilterBar>
      {toast ? <div className="bo-alert"><CheckCircle2 size={16} />{toast}</div> : null}
      <ReceiptKpis rows={rows} mode="receipts" />
      <section className="br-split">
        <ReceiptTable rows={rows} selected={selected} onOpen={setSelected} onAction={runAction} mode="reprint" />
        <ReceiptPreview receipt={selected} />
      </section>
    </ReceiptFrame>
  );
}

export function ReceiptDownloadPage() {
  const [filters, setFilters] = useState({ keyword: '', has_original_file: '', limit: 50 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({
    page: 1,
    limit: filters.limit,
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.has_original_file ? { has_original_file: filters.has_original_file } : {}),
  }), [filters]);
  const { rows, loading, error, refresh } = useWorkbench(billingReceiptAPI.receipts, params);
  const runAction = useReceiptAction(refresh, setToast, setSelected);

  async function exportRows() {
    try {
      const result = await billingReceiptAPI.exportReceipts(params);
      setToast(`Đã export metadata ${formatNumber(result.total_receipts || 0)} biên lai.`);
    } catch (error) {
      setToast(getBillingReceiptErrorMessage(error));
    }
  }

  return (
    <ReceiptFrame
      eyebrow="Viện phí & Thu tiền / Biên lai / Tải biên lai"
      title="Tải biên lai"
      description="Tải file PDF, ảnh/PDF bệnh nhân gửi, hoặc export nhiều biên lai theo bộ lọc."
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="br-primary-action" onClick={exportRows}><Download size={16} />Export</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} placeholder="Tìm receipt, payment, invoice, bệnh nhân, transaction ref">
        <label>
          <span>File gốc</span>
          <select value={filters.has_original_file} onChange={(event) => setFilters((current) => ({ ...current, has_original_file: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="true">Có file bệnh nhân</option>
            <option value="false">Chưa có file</option>
          </select>
        </label>
      </FilterBar>
      {toast ? <div className="bo-alert"><CheckCircle2 size={16} />{toast}</div> : null}
      <ReceiptKpis rows={rows} mode="receipts" />
      <section className="br-split">
        <ReceiptTable rows={rows} selected={selected} onOpen={setSelected} onAction={runAction} mode="download" />
        <ReceiptPreview receipt={selected} />
      </section>
    </ReceiptFrame>
  );
}

function IntentTable({ rows, selected, onOpen, onAction }) {
  if (!rows.length) return <EmptyState label="Không có biên lai bệnh nhân gửi trong queue này." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table br-table">
        <thead>
          <tr>
            <th>Intent</th>
            <th>Invoice</th>
            <th>Bệnh nhân</th>
            <th>Số tiền</th>
            <th>Provider</th>
            <th>Transaction</th>
            <th>File</th>
            <th>Trạng thái</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} className={getId(selected) === getId(row) ? 'is-active' : ''} onClick={() => onOpen(row)}>
              <td><strong>{row.intent_code || getId(row)}</strong><small>{row.payment_note || '-'}</small></td>
              <td><strong>{getInvoice(row).invoice_no || getObjectId(row.invoice_id)}</strong><small>{getInvoice(row).status || '-'}</small></td>
              <td><PatientCell row={row} /></td>
              <td>{formatMoney(row.amount)}</td>
              <td><span>{row.provider || '-'}</span><small>{row.method || '-'}</small></td>
              <td><span>{row.transaction_reference || '-'}</span><small>{row.provider_transaction_id || '-'}</small></td>
              <td>{row.receipt_image_url ? <BadgeCheck size={16} /> : <AlertTriangle size={16} />}</td>
              <td><StatusBadge status={row.status} /></td>
              <td>
                <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                  {can([PERMISSION.paymentCreate, PERMISSION.paymentReconcile]) ? <button type="button" className="bo-table-action" onClick={() => onAction('confirm', row)}>Xác nhận</button> : null}
                  {can([PERMISSION.paymentCreate]) ? <button type="button" className="bo-table-action" onClick={() => onAction('reject', row)}>Từ chối</button> : null}
                  {can([PERMISSION.paymentReconcile]) ? <button type="button" className="bo-table-action" onClick={() => onAction('review', row)}>Review</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntentVerificationPanel({ intent, onAction }) {
  if (!intent) return <aside className="br-verification-panel"><EmptyState label="Chọn một biên lai bệnh nhân gửi để xác minh." /></aside>;
  return (
    <aside className="br-verification-panel" aria-label="Xác minh biên lai bệnh nhân gửi">
      <header>
        <div>
          <span>Verification panel</span>
          <strong>{intent.intent_code}</strong>
        </div>
        <StatusBadge status={intent.status} />
      </header>
      <ReceiptFileViewer source={intent} />
      <section>
        <h3>Dữ liệu kỳ vọng</h3>
        <dl>
          <div><dt>Amount</dt><dd>{formatMoney(intent.amount)}</dd></div>
          <div><dt>Payment note</dt><dd>{intent.payment_note || '-'}</dd></div>
          <div><dt>Receiver</dt><dd>{intent.receiver_account_name || intent.receiver_name || '-'}</dd></div>
          <div><dt>Bank/account</dt><dd>{[intent.receiver_bank_bin, intent.receiver_account_no].filter(Boolean).join(' · ') || '-'}</dd></div>
          <div><dt>Expires</dt><dd>{formatDateTime(intent.expires_at)}</dd></div>
          <div><dt>Manual review</dt><dd>{intent.manual_review_reason || intent.failure_reason || '-'}</dd></div>
        </dl>
      </section>
      {intent.qr_image_url ? <img className="br-qr-image" src={intent.qr_image_url} alt="QR thanh toán" /> : null}
      <div className="br-checklist">
        <span><ShieldCheck size={14} />Đã kiểm tra số tiền</span>
        <span><ShieldCheck size={14} />Đã kiểm tra nội dung chuyển khoản</span>
        <span><ShieldCheck size={14} />Đã kiểm tra tài khoản nhận</span>
        <span><ShieldCheck size={14} />Đã kiểm tra mã giao dịch</span>
      </div>
      <div className="br-action-stack">
        <button type="button" onClick={() => onAction('confirm', intent)}><CheckCircle2 size={16} />Confirm payment</button>
        <button type="button" onClick={() => onAction('reject', intent)}><AlertTriangle size={16} />Reject payment</button>
        <button type="button" onClick={() => onAction('review', intent)}><History size={16} />Manual review</button>
      </div>
    </aside>
  );
}

export function ReceiptPatientSubmittedPage() {
  const [filters, setFilters] = useState({ keyword: '', status: 'pending_manual_confirmation,submitted_receipt,manual_review', limit: 50 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({
    page: 1,
    limit: filters.limit,
    status: filters.status,
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
  }), [filters]);
  const { rows, loading, error, refresh } = useWorkbench(billingReceiptAPI.paymentIntents, params);

  useEffect(() => {
    if (!selected && rows.length) setSelected(rows[0]);
  }, [rows, selected]);

  async function runAction(action, intent) {
    try {
      if (action === 'confirm') {
        const transactionRef = window.prompt('Transaction ref', intent.transaction_reference || intent.provider_transaction_id || '');
        if (!transactionRef) return;
        const amount = window.prompt('Received amount', intent.amount || 0);
        if (amount === null) return;
        await billingReceiptAPI.confirmBankTransfer(getId(intent), {
          transaction_ref: transactionRef,
          received_amount: Number(amount),
          received_at: new Date().toISOString(),
          note: 'Xác nhận từ màn biên lai bệnh nhân gửi',
        });
        setToast('Đã xác nhận chuyển khoản.');
      }
      if (action === 'reject') {
        const reason = window.prompt('Lý do từ chối', 'Biên lai không khớp thông tin giao dịch');
        if (!reason) return;
        await billingReceiptAPI.rejectBankTransfer(getId(intent), { reason });
        setToast('Đã từ chối biên lai.');
      }
      if (action === 'review') {
        const reason = window.prompt('Lý do manual review', 'Cần rà soát thêm giao dịch');
        if (!reason) return;
        await billingReceiptAPI.markManualReview(getId(intent), { reason });
        setToast('Đã chuyển sang manual review.');
      }
      refresh();
    } catch (actionError) {
      setToast(getBillingReceiptErrorMessage(actionError));
    }
  }

  return (
    <ReceiptFrame
      eyebrow="Viện phí & Thu tiền / Biên lai / Bệnh nhân gửi"
      title="Biên lai bệnh nhân gửi"
      description="Xác minh ảnh/PDF chuyển khoản do bệnh nhân gửi, so khớp số tiền, mã giao dịch, nội dung chuyển khoản và hóa đơn."
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="br-primary-action" onClick={refresh}><RefreshCcw size={16} />Lấy queue mới</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} placeholder="Tìm intent, invoice, bệnh nhân, transaction ref, payment note">
        <label>
          <span>Queue</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="pending_manual_confirmation,submitted_receipt,manual_review">Cần xử lý</option>
            <option value="submitted_receipt">BN đã gửi biên lai</option>
            <option value="manual_review">Manual review</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="failed,rejected">Bị từ chối</option>
            <option value="expired,cancelled">Hết hạn/hủy</option>
          </select>
        </label>
      </FilterBar>
      {toast ? <div className="bo-alert"><CheckCircle2 size={16} />{toast}</div> : null}
      <div className="bo-kpi-grid bo-kpi-grid--compact">
        <KpiCard icon={Clock3} label="Queue" value={rows.length} meta="Theo trạng thái đang chọn" />
        <KpiCard icon={FileCheck2} label="Có file" value={rows.filter((row) => row.receipt_image_url).length} meta="Ảnh/PDF gửi kèm" tone="green" />
        <KpiCard icon={AlertTriangle} label="Manual review" value={rows.filter((row) => row.status === 'manual_review').length} meta="Cần rà soát thêm" tone="amber" />
        <KpiCard icon={Banknote} label="Tổng tiền" value={rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)} money meta="Theo trang hiện tại" tone="violet" />
      </div>
      <section className="br-verification-layout">
        <IntentTable rows={rows} selected={selected} onOpen={setSelected} onAction={runAction} />
        <IntentVerificationPanel intent={selected} onAction={runAction} />
      </section>
    </ReceiptFrame>
  );
}

export function ReceiptHistoryPage() {
  const [filters, setFilters] = useState({ keyword: '', action: '', limit: 50 });
  const [selected, setSelected] = useState(null);
  const params = useMemo(() => ({
    page: 1,
    limit: filters.limit,
    ...(filters.action ? { action: filters.action } : {}),
  }), [filters]);
  const { rows, loading, error, refresh } = useWorkbench(billingReceiptAPI.receiptAudit, params);
  const filteredRows = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(keyword));
  }, [filters.keyword, rows]);

  return (
    <ReceiptFrame
      eyebrow="Viện phí & Thu tiền / Biên lai / Lịch sử"
      title="Lịch sử biên lai"
      description="Audit thao tác tạo, xem, in, tải, gửi, in lại, xác minh, từ chối, hoàn tiền và hủy biên lai."
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="br-primary-action" onClick={refresh}><History size={16} />Tải audit</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} placeholder="Tìm action, actor, payment, metadata">
        <label>
          <span>Action</span>
          <select value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}>
            <option value="">Tất cả receipt/payment</option>
            <option value="receipt.printed">In biên lai</option>
            <option value="receipt.reprinted">In lại</option>
            <option value="receipt.downloaded">Tải</option>
            <option value="manual_payment.receipt_submitted">BN gửi biên lai</option>
            <option value="payment.intent_confirm_bank_transfer">Xác nhận CK</option>
          </select>
        </label>
      </FilterBar>
      <div className="bo-table-wrap">
        <table className="bo-table br-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Target</th>
              <th>Status</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row._id || `${row.action}-${row.created_at}`} className={selected?._id === row._id ? 'is-active' : ''} onClick={() => setSelected(row)}>
                <td>{formatDateTime(row.created_at || row.at)}</td>
                <td><strong>{row.action}</strong><small>{row.module_key || '-'}</small></td>
                <td>{row.actor_type || '-'}<small>{getObjectId(row.actor_id) || ''}</small></td>
                <td>{row.target_type || row.source_type || '-'}<small>{getObjectId(row.target_id || row.source_id) || ''}</small></td>
                <td><StatusBadge status={row.status || 'success'} labels={{ success: 'Success', failed: 'Failed' }} /></td>
                <td>{row.message || row.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filteredRows.length ? <EmptyState label="Không có lịch sử biên lai trong bộ lọc này." /> : null}
      {selected ? (
        <aside className="bo-drawer br-drawer" aria-label="Chi tiết audit biên lai">
          <header>
            <div>
              <span>Audit detail</span>
              <h2>{selected.action}</h2>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Đóng"><X size={18} /></button>
          </header>
          <div className="bo-drawer__body">
            <section>
              <h3>Metadata</h3>
              <pre className="br-json">{JSON.stringify(selected, null, 2)}</pre>
            </section>
          </div>
        </aside>
      ) : null}
    </ReceiptFrame>
  );
}
