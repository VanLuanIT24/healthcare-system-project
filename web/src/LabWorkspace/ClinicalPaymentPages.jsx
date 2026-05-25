import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Filter,
  History,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  WalletCards,
  X,
} from 'lucide-react';
import { promptClinicalOpsText } from '../ClinicalOpsWorkspace/clinicalOpsActions';
import { clinicalPaymentApi, getClinicalPaymentErrorMessage } from './clinicalPaymentApi';

const SERVICE_LABEL = {
  lab: 'Xét nghiệm',
  imaging: 'CĐHA',
  procedure: 'Thủ thuật',
};

const GATE_LABEL = {
  ready_non_billable: 'Ready: không tính phí',
  ready_paid: 'Ready: đã paid',
  ready_override: 'Ready: override',
  blocked_no_charge: 'No charge',
  blocked_charge_not_posted: 'Charge chưa post',
  blocked_no_invoice: 'No invoice',
  blocked_invoice_draft: 'Invoice draft',
  waiting_payment: 'Chờ thanh toán',
  waiting_confirmation: 'Chờ xác nhận',
  submitted_receipt: 'Đã gửi biên lai',
  manual_review: 'Manual review',
  payment_failed_or_expired: 'Payment lỗi/hết hạn',
  refunded_or_voided: 'Refund/Void',
};

const PAGE_CONFIG = {
  dashboard: {
    eyebrow: 'Payment CLS',
    title: 'Tổng quan payment cận lâm sàng',
    subtitle: 'Theo dõi order bị chặn bởi payment, QR chờ xác nhận, manual review và order đã sẵn sàng thực hiện.',
    source: 'dashboard',
  },
  waiting: {
    eyebrow: 'Chờ thanh toán',
    title: 'Order chờ thanh toán trước thực hiện',
    subtitle: 'Các order billable chưa đủ điều kiện tài chính: thiếu charge, chưa invoice, còn balance hoặc QR lỗi.',
    source: 'waitingPayment',
  },
  ready: {
    eyebrow: 'Sẵn sàng',
    title: 'Đã thanh toán / sẵn sàng thực hiện',
    subtitle: 'Order non-billable, invoice đã paid hoặc được override hợp lệ.',
    source: 'ready',
  },
  confirmation: {
    eyebrow: 'Xác nhận QR',
    title: 'Chờ xác nhận QR / chuyển khoản',
    subtitle: 'Payment intent đã nộp biên lai hoặc đang chờ xác nhận thủ công.',
    source: 'confirmation',
  },
  manualReview: {
    eyebrow: 'Manual review',
    title: 'Payment cần manual review',
    subtitle: 'Chênh tiền, sai nội dung, receipt không rõ hoặc tình huống cần thu ngân xử lý.',
    source: 'manualReview',
  },
  byEncounter: {
    eyebrow: 'Encounter',
    title: 'Payment theo encounter',
    subtitle: 'Tổng hợp payment gate của toàn bộ order CLS trong một lượt khám.',
    source: 'orders',
  },
  byOrder: {
    eyebrow: 'Theo order',
    title: 'Payment gate theo order dịch vụ',
    subtitle: 'Mỗi dòng là một order với Charge, Invoice, PaymentIntent, Payment và trạng thái can perform.',
    source: 'orders',
  },
  errors: {
    eyebrow: 'Lỗi payment',
    title: 'Payment lỗi / hết hạn / bị từ chối',
    subtitle: 'Các case ảnh hưởng thực hiện dịch vụ do QR hết hạn, rejected, failed hoặc payment void/refund.',
    source: 'errors',
  },
  refundVoid: {
    eyebrow: 'Refund / Void',
    title: 'Refund / void liên quan CLS',
    subtitle: 'Theo dõi payment đã refund/void hoặc refund request phát sinh từ dịch vụ CLS.',
    source: 'refundVoid',
  },
};

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function idOf(row) {
  return row?.order?._id || row?._id || row?.payment?._id || row?.invoice?._id;
}

function gateTone(status) {
  if (['ready_non_billable', 'ready_paid', 'ready_override'].includes(status)) return 'success';
  if (['waiting_confirmation', 'submitted_receipt', 'manual_review'].includes(status)) return 'warning';
  if (['payment_failed_or_expired', 'refunded_or_voided', 'blocked_no_charge', 'blocked_no_invoice'].includes(status)) return 'danger';
  return 'neutral';
}

function Badge({ value, tone }) {
  return <span className={`clinical-payment-badge ${tone || gateTone(value)}`}>{GATE_LABEL[value] || SERVICE_LABEL[value] || value || '-'}</span>;
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="clinical-payment-toast" role="status">
      <span>{message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={onClose}><X size={15} /></button>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`clinical-payment-kpi ${tone || ''}`}>
      <i><Icon size={19} /></i>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

function Header({ config, onRefresh, onPaymentFlow, selectedRow }) {
  return (
    <div className="clinical-payment-header">
      <div>
        <span className="clinical-payment-eyebrow">{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
      </div>
      <div className="clinical-payment-actions">
        <button type="button" onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button>
        <button type="button" disabled={!selectedRow?.order?._id} onClick={() => onPaymentFlow(selectedRow)}><QrCode size={16} /> Tạo QR flow</button>
      </div>
    </div>
  );
}

function FilterBar({ filters, setFilters }) {
  const patch = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  return (
    <div className="clinical-payment-filterbar">
      <label className="clinical-payment-search">
        <Search size={16} />
        <input value={filters.keyword || ''} onChange={(event) => patch('keyword', event.target.value)} placeholder="Tìm order, patient, encounter, invoice" />
      </label>
      <label>
        <Filter size={15} />
        <select value={filters.service_type || ''} onChange={(event) => patch('service_type', event.target.value)}>
          <option value="">Tất cả dịch vụ</option>
          <option value="lab">Xét nghiệm</option>
          <option value="imaging">CĐHA</option>
          <option value="procedure">Thủ thuật</option>
        </select>
      </label>
      <label>
        <select value={filters.gate_status || ''} onChange={(event) => patch('gate_status', event.target.value)}>
          <option value="">Mọi payment gate</option>
          <option value="blocked_no_charge">No charge</option>
          <option value="blocked_no_invoice">No invoice</option>
          <option value="waiting_payment">Chờ thanh toán</option>
          <option value="waiting_confirmation,submitted_receipt">Chờ xác nhận</option>
          <option value="manual_review">Manual review</option>
          <option value="ready_paid,ready_non_billable,ready_override">Ready</option>
          <option value="payment_failed_or_expired">Lỗi/hết hạn</option>
        </select>
      </label>
      <label>
        <select value={filters.priority || ''} onChange={(event) => patch('priority', event.target.value)}>
          <option value="">Mọi ưu tiên</option>
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT</option>
        </select>
      </label>
      <input type="date" value={filters.date_from || ''} onChange={(event) => patch('date_from', event.target.value)} />
      <input type="date" value={filters.date_to || ''} onChange={(event) => patch('date_to', event.target.value)} />
    </div>
  );
}

function Dashboard({ data, onOpen }) {
  const summary = data?.summary || {};
  return (
    <>
      <div className="clinical-payment-kpis">
        <Kpi icon={FileText} label="Order CLS hôm nay" value={formatNumber(summary.total_orders)} />
        <Kpi icon={WalletCards} label="Billable" value={formatNumber(summary.billable_orders)} />
        <Kpi icon={AlertTriangle} label="Thiếu charge" value={formatNumber(summary.no_charge_orders)} tone="danger" />
        <Kpi icon={Banknote} label="Invoice chưa paid" value={formatNumber(summary.unpaid_invoices)} tone="warning" />
        <Kpi icon={BadgeCheck} label="Ready to perform" value={formatNumber(summary.ready_to_perform)} tone="success" />
        <Kpi icon={Clock3} label="Chờ xác nhận QR" value={formatNumber(summary.waiting_confirmation)} tone="warning" />
        <Kpi icon={ShieldAlert} label="Manual review" value={formatNumber(summary.manual_review)} tone="danger" />
        <Kpi icon={CreditCard} label="Balance due" value={formatMoney(summary.balance_due)} />
      </div>
      <div className="clinical-payment-dashboard-grid">
        <section className="clinical-payment-panel">
          <div className="clinical-payment-panel-title">
            <h2>Theo loại dịch vụ</h2>
            <span>{formatMoney(summary.total_amount)}</span>
          </div>
          <div className="clinical-payment-module-list">
            {(data?.by_service_type || []).map((row) => (
              <div className="clinical-payment-module-row" key={row.service_type}>
                <div>
                  <strong>{SERVICE_LABEL[row.service_type] || row.service_type}</strong>
                  <span>{formatNumber(row.orders)} order · {formatNumber(row.paid)} ready</span>
                </div>
                <div className="clinical-payment-progress"><i style={{ width: `${Math.min((row.paid / Math.max(row.orders || 1, 1)) * 100, 100)}%` }} /></div>
                <b>{formatMoney(row.balance_due)}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="clinical-payment-panel">
          <div className="clinical-payment-panel-title">
            <h2>STAT / Urgent bị chặn</h2>
            <span>{formatNumber(data?.urgent_queue?.length || 0)}</span>
          </div>
          <div className="clinical-payment-queue-stack">
            {(data?.urgent_queue || []).map((row) => (
              <button type="button" key={idOf(row)} onClick={() => onOpen(row)}>
                <Badge value={row.payment_gate.status} />
                <strong>{row.order.order_no}</strong>
                <span>{row.patient?.full_name} · {formatMoney(row.payment_gate.balance_due)}</span>
              </button>
            ))}
            {!data?.urgent_queue?.length ? <div className="clinical-payment-empty-mini">Không có order khẩn bị chặn.</div> : null}
          </div>
        </section>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="clinical-payment-empty">
      <ReceiptText size={28} />
      <strong>Chưa có dữ liệu payment</strong>
      <span>Điều chỉnh bộ lọc hoặc làm mới danh sách.</span>
    </div>
  );
}

function PaymentTable({ rows, selectedId, onSelect, onOpen, onPaymentFlow, onOverride, onConfirm, onReject }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="clinical-payment-table-wrap">
      <table className="clinical-payment-table">
        <thead>
          <tr>
            <th></th>
            <th>Payment gate</th>
            <th>Order</th>
            <th>Loại</th>
            <th>Bệnh nhân</th>
            <th>Dịch vụ</th>
            <th>Charge</th>
            <th>Invoice</th>
            <th>Payment intent</th>
            <th>Số tiền</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={idOf(row)} onClick={() => onOpen(row)}>
              <td onClick={(event) => event.stopPropagation()}>
                <input type="radio" checked={selectedId === row.order?._id} onChange={() => onSelect(row)} />
              </td>
              <td><Badge value={row.payment_gate?.status} /><span>{row.payment_gate?.blocking_reason}</span></td>
              <td><strong>{row.order?.order_no}</strong><span>{row.clinical_order?.no || row.order?.status}</span></td>
              <td><Badge value={row.order?.order_type} /></td>
              <td><strong>{row.patient?.full_name || '-'}</strong><span>{row.patient?.patient_code}</span></td>
              <td><strong>{row.service?.service_name || row.clinical_order?.name || '-'}</strong><span>{row.order?.priority}</span></td>
              <td><strong>{row.charge?.charge_no || '-'}</strong><span>{row.charge?.status}</span></td>
              <td><strong>{row.invoice?.invoice_no || '-'}</strong><span>{row.invoice?.status}</span></td>
              <td><strong>{row.payment_intent?.intent_code || '-'}</strong><span>{row.payment_intent?.status}</span></td>
              <td><strong>{formatMoney(row.payment_gate?.balance_due)}</strong><span>Paid {formatMoney(row.payment_gate?.paid_amount)}</span></td>
              <td className="clinical-payment-row-actions" onClick={(event) => event.stopPropagation()}>
                {row.payment_gate?.allowed_actions?.includes('create_payment_flow') || row.payment_gate?.allowed_actions?.includes('create_payment_intent') ? (
                  <button type="button" onClick={() => onPaymentFlow(row)}><QrCode size={13} /> QR</button>
                ) : null}
                {['waiting_confirmation', 'submitted_receipt', 'manual_review'].includes(row.payment_gate?.status) ? (
                  <button type="button" onClick={() => onConfirm(row)}>Confirm</button>
                ) : null}
                {['waiting_confirmation', 'submitted_receipt', 'manual_review'].includes(row.payment_gate?.status) ? (
                  <button type="button" onClick={() => onReject(row)}>Reject</button>
                ) : null}
                {row.payment_gate?.blocking ? <button type="button" onClick={() => onOverride(row)}>Override</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RefundVoidTable({ rows, onOpen }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="clinical-payment-table-wrap">
      <table className="clinical-payment-table">
        <thead>
          <tr>
            <th>Case</th>
            <th>Payment</th>
            <th>Bệnh nhân</th>
            <th>Invoice</th>
            <th>Số tiền</th>
            <th>Status</th>
            <th>Lý do</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.payment?._id} onClick={() => onOpen(row)}>
              <td><Badge value={row.type} tone={row.type === 'payment_void' ? 'danger' : 'warning'} /></td>
              <td><strong>{row.payment?.payment_no}</strong><span>{row.payment?.payment_method}</span></td>
              <td><strong>{row.patient?.full_name}</strong><span>{row.patient?.patient_code}</span></td>
              <td><strong>{row.invoice?.invoice_no}</strong><span>{row.invoice?.status}</span></td>
              <td>{formatMoney(row.amount)}</td>
              <td>{row.status}</td>
              <td>{row.reason || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({ row, detail, loading, onClose }) {
  if (!row) return null;
  const data = detail || row;
  const qr = data.payment_intent?.qr_image_url;
  return (
    <aside className="clinical-payment-drawer">
      <div className="clinical-payment-drawer-head">
        <div>
          <span>Payment gate</span>
          <h2>{data.order?.order_no || data.payment?.payment_no || 'Chi tiết payment'}</h2>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </div>
      {loading ? <div className="clinical-payment-drawer-loading">Đang tải payment gate...</div> : (
        <div className="clinical-payment-drawer-body">
          <section>
            <h3>Tổng quan</h3>
            <Badge value={data.payment_gate?.status} />
            <p>{data.payment_gate?.blocking_reason || 'Không có lý do chặn.'}</p>
            <div className="clinical-payment-money-grid">
              <span>Total <strong>{formatMoney(data.payment_gate?.required_amount)}</strong></span>
              <span>Paid <strong>{formatMoney(data.payment_gate?.paid_amount)}</strong></span>
              <span>Balance <strong>{formatMoney(data.payment_gate?.balance_due)}</strong></span>
            </div>
          </section>
          <section>
            <h3>Order / Charge / Invoice</h3>
            <div className="clinical-payment-mini-row"><strong>{data.order?.order_no}</strong><span>{SERVICE_LABEL[data.order?.order_type]}</span></div>
            <div className="clinical-payment-mini-row"><strong>{data.charge?.charge_no || 'No charge'}</strong><span>{data.charge?.status}</span></div>
            <div className="clinical-payment-mini-row"><strong>{data.invoice?.invoice_no || 'No invoice'}</strong><span>{data.invoice?.status}</span></div>
          </section>
          <section>
            <h3>QR / Receipt</h3>
            {qr ? <img className="clinical-payment-qr" alt="QR payment" src={qr} /> : <span>Chưa có QR active.</span>}
            <div className="clinical-payment-mini-row"><strong>{data.payment_intent?.intent_code || '-'}</strong><span>{data.payment_intent?.status}</span></div>
            <div className="clinical-payment-mini-row"><strong>{data.payment_intent?.payment_note || '-'}</strong><span>{formatDate(data.payment_intent?.expires_at)}</span></div>
            {data.payment_intent?.receipt_image_url ? <a href={data.payment_intent.receipt_image_url} target="_blank" rel="noreferrer">Mở biên lai</a> : null}
          </section>
          <section>
            <h3>Payment</h3>
            <div className="clinical-payment-mini-row"><strong>{data.payment?.payment_no || '-'}</strong><span>{data.payment?.status}</span></div>
            <div className="clinical-payment-mini-row"><strong>{formatMoney(data.payment?.amount)}</strong><span>{formatDate(data.payment?.paid_at)}</span></div>
          </section>
        </div>
      )}
    </aside>
  );
}

export function ClinicalPaymentPage({ pageKey = 'dashboard' }) {
  const config = PAGE_CONFIG[pageKey] || PAGE_CONFIG.dashboard;
  const [filters, setFilters] = useState({ page: 1, limit: 25 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [activeRow, setActiveRow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setFilters({ page: 1, limit: 25 });
    setSelectedRow(null);
    setActiveRow(null);
  }, [pageKey]);

  const params = useMemo(() => ({ ...filters }), [filters]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await clinicalPaymentApi[config.source](params));
    } catch (err) {
      setError(getClinicalPaymentErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [config.source, params]);

  const runAction = async (action, message) => {
    try {
      const result = await action();
      setToast(message);
      await fetchData();
      if (result?.order) setSelectedRow(result);
    } catch (err) {
      setToast(getClinicalPaymentErrorMessage(err));
    }
  };

  const openDetail = async (row) => {
    setActiveRow(row);
    setDetail(row);
    if (!row?.order?._id) return;
    setDetailLoading(true);
    try {
      setDetail(await clinicalPaymentApi.orderGate(row.order._id));
    } catch (err) {
      setToast(getClinicalPaymentErrorMessage(err, 'Không tải được payment gate.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const createFlow = (row) => {
    if (!row?.order?._id) return setToast('Chọn một order trước khi tạo payment flow.');
    return runAction(() => clinicalPaymentApi.createPaymentFlow(row.order._id, { provider: 'bank_qr_manual' }), 'Đã tạo payment flow / QR.');
  };

  const override = (row) => {
    const reason = promptClinicalOpsText({ title: 'Override thanh toán', message: 'Lý do cho phép thực hiện trước thanh toán' });
    if (!reason) return null;
    return runAction(() => clinicalPaymentApi.createOverride(row.order._id, { reason, override_type: 'manager_approved' }), 'Đã tạo payment override.');
  };

  const confirm = (row) => {
    const intentId = row.payment_intent?._id || row.payment_intent?.payment_intent_id;
    if (!intentId) return setToast('Không có payment intent để xác nhận.');
    const transactionRef = promptClinicalOpsText({ title: 'Xác nhận thanh toán', message: 'Mã giao dịch / transaction ref', defaultValue: `manual:${row.payment_intent?.intent_code || Date.now()}` }) || `manual:${row.payment_intent?.intent_code || Date.now()}`;
    return runAction(() => clinicalPaymentApi.confirmIntent(intentId, {
      transaction_ref: transactionRef,
      received_amount: row.payment_intent?.amount || row.payment_gate?.balance_due,
      received_at: new Date().toISOString(),
    }), 'Đã gửi xác nhận payment.');
  };

  const reject = (row) => {
    const intentId = row.payment_intent?._id || row.payment_intent?.payment_intent_id;
    const reason = promptClinicalOpsText({ title: 'Từ chối thanh toán', message: 'Lý do từ chối payment' });
    if (!intentId || !reason) return null;
    return runAction(() => clinicalPaymentApi.rejectIntent(intentId, { reason }), 'Đã từ chối payment.');
  };

  const rows = data?.items || [];
  const pagination = data?.pagination || {};

  const renderContent = () => {
    if (loading) return <div className="clinical-payment-loading">Đang tải payment CLS...</div>;
    if (error) return <div className="clinical-payment-error"><AlertTriangle size={18} /> {error}<button type="button" onClick={fetchData}>Thử lại</button></div>;
    if (config.source === 'dashboard') return <Dashboard data={data || {}} onOpen={openDetail} />;
    if (config.source === 'refundVoid') return <RefundVoidTable rows={rows} onOpen={openDetail} />;
    return (
      <PaymentTable
        rows={rows}
        selectedId={selectedRow?.order?._id}
        onSelect={setSelectedRow}
        onOpen={openDetail}
        onPaymentFlow={createFlow}
        onOverride={override}
        onConfirm={confirm}
        onReject={reject}
      />
    );
  };

  return (
    <div className="clinical-payment-page">
      <Header config={config} onRefresh={fetchData} onPaymentFlow={createFlow} selectedRow={selectedRow} />
      <FilterBar filters={filters} setFilters={setFilters} />
      {config.source !== 'dashboard' ? (
        <div className="clinical-payment-strip">
          <Kpi icon={History} label="Dòng dữ liệu" value={formatNumber(pagination.total || rows.length)} />
          <Kpi icon={WalletCards} label="Đang chọn" value={selectedRow?.order?.order_no || '-'} />
          <Kpi icon={ReceiptText} label="Trang" value={`${pagination.page || filters.page}/${pagination.total_pages || 1}`} />
        </div>
      ) : null}
      {renderContent()}
      {pagination.total_pages > 1 ? (
        <div className="clinical-payment-pagination">
          <button type="button" disabled={(pagination.page || 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: (pagination.page || 1) - 1 }))}>Trước</button>
          <span>Trang {pagination.page} / {pagination.total_pages}</span>
          <button type="button" disabled={(pagination.page || 1) >= pagination.total_pages} onClick={() => setFilters((current) => ({ ...current, page: (pagination.page || 1) + 1 }))}>Sau</button>
        </div>
      ) : null}
      <DetailDrawer row={activeRow} detail={detail} loading={detailLoading} onClose={() => setActiveRow(null)} />
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
