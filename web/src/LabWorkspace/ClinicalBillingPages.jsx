import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Filter,
  GitCompareArrows,
  History,
  Layers3,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  WalletCards,
  X,
} from 'lucide-react';
import { clinicalBillingApi, getClinicalBillingErrorMessage } from './clinicalBillingApi';

const SERVICE_LABEL = {
  lab: 'Xét nghiệm',
  imaging: 'CĐHA',
  procedure: 'Thủ thuật',
};

const CHARGE_STATUS_LABEL = {
  pending: 'Pending',
  draft: 'Draft',
  posted: 'Posted',
  billed: 'Billed',
  voided: 'Voided',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const INVOICE_STATUS_LABEL = {
  draft: 'Nháp',
  issued: 'Đã phát hành',
  partially_paid: 'Thanh toán một phần',
  paid: 'Đã thanh toán',
  voided: 'Voided',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const PAGE_CONFIG = {
  dashboard: {
    eyebrow: 'Hóa đơn CLS',
    title: 'Tổng quan hóa đơn cận lâm sàng',
    subtitle: 'Theo dõi charge, invoice, payment và lỗi đối soát cho xét nghiệm, chẩn đoán hình ảnh, thủ thuật.',
    source: 'dashboard',
  },
  chargeCandidates: {
    eyebrow: 'Chờ tạo charge',
    title: 'Order đủ điều kiện tính phí',
    subtitle: 'Các order CLS đã đến mốc tính phí nhưng chưa có charge active.',
    source: 'candidates',
    query: { only_missing_charge: 'true' },
  },
  charges: {
    eyebrow: 'Charge cận lâm sàng',
    title: 'Toàn bộ charge CLS',
    subtitle: 'Quản lý charge phát sinh từ lab, imaging và procedure, bao gồm posted, billed, voided.',
    source: 'charges',
  },
  unbilled: {
    eyebrow: 'Chờ lập hóa đơn',
    title: 'Charge posted chưa lên invoice',
    subtitle: 'Worklist gom charge theo bệnh nhân hoặc encounter trước khi lập hóa đơn.',
    source: 'unbilled',
  },
  draftInvoices: {
    eyebrow: 'Invoice draft',
    title: 'Hóa đơn nháp CLS',
    subtitle: 'Invoice đã snapshot charge nhưng chưa phát hành, cần kiểm tra trước khi issue.',
    source: 'invoices',
    query: { status: 'draft' },
  },
  issuedInvoices: {
    eyebrow: 'Invoice issued',
    title: 'Hóa đơn CLS đã phát hành',
    subtitle: 'Các invoice đã issue, bao gồm chưa thu, thu một phần hoặc đã thu đủ.',
    source: 'invoices',
    query: { status: 'issued' },
  },
  unpaidInvoices: {
    eyebrow: 'Chưa thanh toán',
    title: 'Hóa đơn CLS chưa thanh toán',
    subtitle: 'Queue thu tiền, tạo QR và nhắc thanh toán cho invoice issued còn nguyên công nợ.',
    source: 'invoices',
    query: { payment_state: 'unpaid' },
  },
  partialInvoices: {
    eyebrow: 'Thanh toán một phần',
    title: 'Hóa đơn CLS còn balance',
    subtitle: 'Theo dõi invoice đã thu một phần, bảo hiểm dự kiến và số tiền còn phải thu.',
    source: 'invoices',
    query: { payment_state: 'partially_paid' },
  },
  paidInvoices: {
    eyebrow: 'Đã thanh toán',
    title: 'Hóa đơn CLS đã thanh toán',
    subtitle: 'Tra cứu invoice đã paid, payment method, receipt và dữ liệu xuất kế toán.',
    source: 'invoices',
    query: { payment_state: 'paid' },
  },
  exceptions: {
    eyebrow: 'Lỗi nghiệp vụ',
    title: 'Exception center hóa đơn CLS',
    subtitle: 'Bắt các lỗi thất thu, sai trạng thái, charge/invoice/payment lệch nhau.',
    source: 'exceptions',
  },
  encounterBilling: {
    eyebrow: 'Theo encounter',
    title: 'Hóa đơn CLS theo lượt khám',
    subtitle: 'Xem tổng charge, invoice, payment và claim của một encounter.',
    source: 'reconciliation',
  },
  orderBilling: {
    eyebrow: 'Theo order',
    title: 'Billing trace theo order',
    subtitle: 'Đi theo đường Order -> Charge -> Invoice -> Payment để kiểm tra trạng thái thu phí.',
    source: 'reconciliation',
  },
  patientBilling: {
    eyebrow: 'Theo bệnh nhân',
    title: 'Hóa đơn CLS theo bệnh nhân',
    subtitle: 'Tra cứu invoice và công nợ CLS theo patient code, tên hoặc số điện thoại.',
    source: 'invoices',
  },
  reconciliation: {
    eyebrow: 'Đối soát',
    title: 'Order - Charge - Invoice - Payment',
    subtitle: 'Matrix đối soát thất thu, chờ lập hóa đơn, chờ thu và các case hủy/no-show.',
    source: 'reconciliation',
  },
  adjustments: {
    eyebrow: 'Điều chỉnh',
    title: 'Điều chỉnh / void hóa đơn CLS',
    subtitle: 'Hàng đợi các tình huống cần adjustment, refund, credit note hoặc debit note.',
    source: 'exceptions',
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
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function getRowId(row) {
  return row?._id || row?.id || row?.order_id || row?.entity_id || row?.order?._id || row?.invoice?._id || row?.charge?._id || row?.raw?._id;
}

function patientName(row) {
  const patient = row?.patient || row?.patient_id || row?.order?.patient || row?.raw?.patient_id;
  if (!patient || typeof patient !== 'object') return '-';
  return patient.full_name || patient.patient_code || '-';
}

function patientSub(row) {
  const patient = row?.patient || row?.patient_id || row?.raw?.patient_id;
  if (!patient || typeof patient !== 'object') return '';
  return [patient.patient_code, patient.phone].filter(Boolean).join(' · ');
}

function serviceName(row) {
  const service = row?.service || row?.service_id || row?.raw?.service_id;
  if (!service || typeof service !== 'object') return row?.description || '-';
  return service.service_name || service.service_code || '-';
}

function statusClass(value = '') {
  return String(value || 'neutral').replaceAll('_', '-');
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="clinical-billing-toast" role="status">
      <span>{message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={onClose}><X size={15} /></button>
    </div>
  );
}

function EmptyState({ title = 'Chưa có dữ liệu', message = 'Điều chỉnh bộ lọc hoặc làm mới dữ liệu.' }) {
  return (
    <div className="clinical-billing-empty">
      <FileText size={28} />
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

function WidgetError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="clinical-billing-error">
      <AlertTriangle size={18} />
      <span>{message}</span>
      <button type="button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

function KpiStrip({ data = {}, loading }) {
  const kpis = data.kpis || {};
  const items = [
    ['Order chưa charge', kpis.orders_without_charge, Clock3, 'warning'],
    ['Charge chưa invoice', kpis.charges_unbilled, WalletCards, 'info'],
    ['Invoice nháp', kpis.draft_invoices, FileText, 'neutral'],
    ['Đã phát hành', kpis.issued_invoices, ReceiptText, 'info'],
    ['Chưa thanh toán', kpis.unpaid_invoices, AlertTriangle, 'warning'],
    ['Đã thanh toán', kpis.paid_invoices, BadgeCheck, 'success'],
    ['Doanh thu hôm nay', formatMoney(kpis.revenue_today), CircleDollarSign, 'success'],
    ['Công nợ CLS', formatMoney(kpis.outstanding_balance), ShieldAlert, 'danger'],
  ];
  return (
    <section className="clinical-billing-kpis" aria-label="Chỉ số hóa đơn CLS">
      {items.map(([label, value, Icon, tone]) => (
        <article key={label} className={`clinical-billing-kpi is-${tone}${loading ? ' is-loading' : ''}`}>
          <Icon size={20} />
          <span>
            <small>{label}</small>
            <strong>{loading ? '...' : value}</strong>
          </span>
        </article>
      ))}
    </section>
  );
}

function ServiceTypeRevenue({ data = [] }) {
  const total = data.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  return (
    <section className="clinical-billing-panel clinical-billing-panel--service">
      <header>
        <span>Doanh thu theo nhóm dịch vụ</span>
        <strong>{formatMoney(total)}</strong>
      </header>
      <div className="clinical-billing-bars">
        {data.map((row) => {
          const percent = total > 0 ? Math.round((Number(row.revenue || 0) / total) * 100) : 0;
          return (
            <article key={row.service_type}>
              <div>
                <strong>{SERVICE_LABEL[row.service_type] || row.service_type}</strong>
                <span>{formatNumber(row.orders)} order · {formatNumber(row.charges)} charge · {formatNumber(row.unbilled_charges)} chờ invoice</span>
              </div>
              <b>{formatMoney(row.revenue)}</b>
              <i style={{ width: `${Math.max(percent, 4)}%` }} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FilterBar({ filters, setFilter, onRefresh, loading, source }) {
  const showInvoiceStatus = ['invoices', 'dashboard'].includes(source);
  const showChargeStatus = ['charges', 'unbilled'].includes(source);
  const invoiceFilterValue = filters.payment_state ? `pay:${filters.payment_state}` : (filters.status || '');
  return (
    <section className="clinical-billing-filters" aria-label="Bộ lọc hóa đơn CLS">
      <label className="clinical-billing-search">
        <Search size={16} />
        <input
          value={filters.q || ''}
          onChange={(event) => setFilter('q', event.target.value)}
          placeholder="Tìm bệnh nhân, order, charge, invoice"
        />
      </label>
      <label>
        <Stethoscope size={16} />
        <select value={filters.service_type || ''} onChange={(event) => setFilter('service_type', event.target.value)}>
          <option value="">Tất cả CLS</option>
          <option value="lab">Xét nghiệm</option>
          <option value="imaging">CĐHA</option>
          <option value="procedure">Thủ thuật</option>
        </select>
      </label>
      {showChargeStatus ? (
        <label>
          <WalletCards size={16} />
          <select value={filters.status || ''} onChange={(event) => setFilter('status', event.target.value)}>
            <option value="">Tất cả charge</option>
            <option value="pending">Pending</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="billed">Billed</option>
            <option value="voided">Voided</option>
          </select>
        </label>
      ) : null}
      {showInvoiceStatus ? (
        <label>
          <ReceiptText size={16} />
          <select value={invoiceFilterValue} onChange={(event) => setFilter(event.target.value.startsWith('pay:') ? 'payment_state' : 'status', event.target.value.replace('pay:', ''))}>
            <option value="">Tất cả invoice</option>
            <option value="draft">Nháp</option>
            <option value="issued">Đã phát hành</option>
            <option value="pay:unpaid">Chưa thanh toán</option>
            <option value="pay:partially_paid">Thanh toán một phần</option>
            <option value="pay:paid">Đã thanh toán</option>
          </select>
        </label>
      ) : null}
      <label>
        <Clock3 size={16} />
        <input type="date" value={filters.date_from || ''} onChange={(event) => setFilter('date_from', event.target.value)} />
      </label>
      <label>
        <Clock3 size={16} />
        <input type="date" value={filters.date_to || ''} onChange={(event) => setFilter('date_to', event.target.value)} />
      </label>
      <label>
        <Filter size={16} />
        <input value={filters.encounter_id || ''} onChange={(event) => setFilter('encounter_id', event.target.value)} placeholder="Encounter ID" />
      </label>
      <button type="button" className="clinical-billing-refresh" onClick={onRefresh} disabled={loading}>
        <RefreshCw className={loading ? 'is-spinning' : ''} size={16} />
        Làm mới
      </button>
    </section>
  );
}

function CandidateTable({ rows, loading, onAction, onOpenDetail }) {
  if (loading) return <EmptyState title="Đang tải order chờ charge" message="Đang tổng hợp trạng thái lab, imaging và procedure." />;
  if (!rows.length) return <EmptyState title="Không có order chờ tạo charge" message="Các order phù hợp hiện đã có charge hoặc chưa đủ điều kiện tính phí." />;
  return (
    <div className="clinical-billing-table-shell">
      <table className="clinical-billing-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Bệnh nhân</th>
            <th>Dịch vụ</th>
            <th>Trạng thái</th>
            <th>Giá gợi ý</th>
            <th>Lý do</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              <td>
                <button type="button" className="clinical-billing-link-cell" onClick={() => onOpenDetail(row, 'order')}>
                  <strong>{row.order_no}</strong>
                  <span>{SERVICE_LABEL[row.source_type] || row.source_type} · {row.source_order_no || 'child order'}</span>
                </button>
              </td>
              <td><strong>{patientName(row)}</strong><small>{patientSub(row)}</small></td>
              <td><strong>{serviceName(row)}</strong><small>{row.service?.service_code || row.source_type}</small></td>
              <td>
                <span className={`clinical-billing-badge is-${statusClass(row.order_status)}`}>{row.order_status}</span>
                <small>{row.execution_status}</small>
              </td>
              <td><strong>{formatMoney(row.suggested_price)}</strong><small>{formatDate(row.eligible_at)}</small></td>
              <td><span className={row.can_create_charge ? 'clinical-billing-ok' : 'clinical-billing-warn'}>{row.can_create_charge ? 'Sẵn sàng tạo charge' : row.charge_block_reason}</span></td>
              <td>
                <div className="clinical-billing-row-actions">
                  <button type="button" disabled={!row.can_create_charge} onClick={() => onAction('create_charge', row)}><WalletCards size={14} />Charge</button>
                  <button type="button" onClick={() => onOpenDetail(row, 'order')}><History size={14} />Trace</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChargesTable({ rows, loading, selectedChargeIds, toggleCharge, onAction, onOpenDetail, allowBatch }) {
  if (loading) return <EmptyState title="Đang tải charge CLS" message="Đang đọc charge và invoice liên quan." />;
  if (!rows.length) return <EmptyState title="Không có charge phù hợp" message="Điều chỉnh bộ lọc hoặc tạo charge từ order." />;
  return (
    <div className="clinical-billing-table-shell">
      <table className="clinical-billing-table">
        <thead>
          <tr>
            <th>{allowBatch ? 'Chọn' : 'Charge'}</th>
            <th>Charge</th>
            <th>Bệnh nhân</th>
            <th>Dịch vụ</th>
            <th>Số tiền</th>
            <th>Invoice</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            return (
              <tr key={id}>
                <td>
                  {allowBatch ? (
                    <input type="checkbox" checked={selectedChargeIds.includes(id)} onChange={() => toggleCharge(id)} aria-label={`Chọn charge ${row.charge_no}`} />
                  ) : <span className={`clinical-billing-badge is-${statusClass(row.status)}`}>{CHARGE_STATUS_LABEL[row.status] || row.status}</span>}
                </td>
                <td>
                  <button type="button" className="clinical-billing-link-cell" onClick={() => onOpenDetail(row, 'charge')}>
                    <strong>{row.charge_no}</strong>
                    <span>{row.order?.order_no || row.order_id?.order_no || row.source_module}</span>
                  </button>
                </td>
                <td><strong>{patientName(row)}</strong><small>{patientSub(row)}</small></td>
                <td><strong>{serviceName(row)}</strong><small>{SERVICE_LABEL[row.service_type] || row.service_type}</small></td>
                <td><strong>{formatMoney(row.total_amount)}</strong><small>{formatDate(row.charged_at)}</small></td>
                <td>
                  {row.invoice ? (
                    <button type="button" className="clinical-billing-link-cell" onClick={() => onOpenDetail(row.invoice, 'invoice')}>
                      <strong>{row.invoice.invoice_no}</strong><span>{INVOICE_STATUS_LABEL[row.invoice.status] || row.invoice.status}</span>
                    </button>
                  ) : <span className="clinical-billing-warn">Chưa lên invoice</span>}
                </td>
                <td>
                  <div className="clinical-billing-row-actions">
                    {!row.invoice && row.status === 'posted' ? <button type="button" onClick={() => onAction('batch_one', row)}><ReceiptText size={14} />Invoice</button> : null}
                    {!row.invoice && ['pending', 'draft', 'posted'].includes(row.status) ? <button type="button" onClick={() => onAction('void_charge', row)}><X size={14} />Void</button> : null}
                    <button type="button" onClick={() => onOpenDetail(row, 'charge')}><History size={14} />Trace</button>
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

function InvoicesTable({ rows, loading, onAction, onOpenDetail }) {
  if (loading) return <EmptyState title="Đang tải invoice CLS" message="Đang tổng hợp item, payment intent và payment mới nhất." />;
  if (!rows.length) return <EmptyState title="Không có invoice phù hợp" message="Gom charge posted để tạo hóa đơn mới." />;
  return (
    <div className="clinical-billing-table-shell">
      <table className="clinical-billing-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Bệnh nhân</th>
            <th>Nhóm dịch vụ</th>
            <th>Tổng tiền</th>
            <th>Đã thu / Còn lại</th>
            <th>Payment</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              <td>
                <button type="button" className="clinical-billing-link-cell" onClick={() => onOpenDetail(row, 'invoice')}>
                  <strong>{row.invoice_no}</strong>
                  <span className={`clinical-billing-badge is-${statusClass(row.status)}`}>{INVOICE_STATUS_LABEL[row.status] || row.status}</span>
                </button>
              </td>
              <td><strong>{patientName(row)}</strong><small>{patientSub(row)}</small></td>
              <td>
                <strong>{(row.clinical_service_types || []).map((type) => SERVICE_LABEL[type] || type).join(' + ') || 'CLS'}</strong>
                <small>{formatNumber(row.clinical_charge_count)} charge · {formatNumber(row.item_count)} item</small>
              </td>
              <td><strong>{formatMoney(row.total_amount)}</strong><small>{row.is_overdue ? `Quá hạn ${row.overdue_days} ngày` : formatDate(row.due_at || row.issued_at)}</small></td>
              <td><strong>{formatMoney(row.paid_amount)}</strong><small>{formatMoney(row.balance_due)}</small></td>
              <td>
                <strong>{row.latest_payment_intent?.status || row.latest_payment?.status || 'Chưa có'}</strong>
                <small>{row.latest_payment_intent?.intent_code || row.latest_payment?.payment_no || 'payment intent'}</small>
              </td>
              <td>
                <div className="clinical-billing-row-actions">
                  {row.status === 'draft' ? <button type="button" onClick={() => onAction('issue_invoice', row)}><CheckCircle2 size={14} />Issue</button> : null}
                  {['issued', 'partially_paid'].includes(row.status) ? <button type="button" onClick={() => onAction('collect_payment', row)}><Banknote size={14} />Thu</button> : null}
                  {['issued', 'partially_paid'].includes(row.status) ? <button type="button" onClick={() => onAction('create_qr', row)}><QrCode size={14} />QR</button> : null}
                  <button type="button" onClick={() => onOpenDetail(row, 'invoice')}><History size={14} />Timeline</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExceptionsTable({ rows, loading, onOpenDetail }) {
  if (loading) return <EmptyState title="Đang rà soát lỗi nghiệp vụ" message="Đang so khớp order, charge, invoice và payment." />;
  if (!rows.length) return <EmptyState title="Chưa phát hiện lỗi nghiệp vụ" message="Không có exception phù hợp với bộ lọc hiện tại." />;
  return (
    <div className="clinical-billing-table-shell">
      <table className="clinical-billing-table">
        <thead>
          <tr>
            <th>Mức độ</th>
            <th>Lỗi</th>
            <th>Đối tượng</th>
            <th>Bệnh nhân</th>
            <th>Ảnh hưởng</th>
            <th>Đề xuất xử lý</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><span className={`clinical-billing-badge is-${row.severity}`}>{row.severity}</span></td>
              <td><strong>{row.type}</strong><small>{formatDate(row.detected_at)}</small></td>
              <td>
                <button type="button" className="clinical-billing-link-cell" onClick={() => onOpenDetail(row, 'exception')}>
                  <strong>{row.entity_no || row.entity_type}</strong><span>{row.entity_type}</span>
                </button>
              </td>
              <td><strong>{patientName(row)}</strong><small>{patientSub(row)}</small></td>
              <td><strong>{formatMoney(row.amount)}</strong><small>{row.owner}</small></td>
              <td><span>{row.suggested_action}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReconciliationTable({ rows, loading, onOpenDetail }) {
  if (loading) return <EmptyState title="Đang dựng matrix đối soát" message="Đang so khớp trạng thái order, charge, invoice và payment." />;
  if (!rows.length) return <EmptyState title="Không có dòng đối soát" message="Điều chỉnh bộ lọc để xem thêm order CLS." />;
  return (
    <div className="clinical-billing-table-shell">
      <table className="clinical-billing-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Bệnh nhân</th>
            <th>Charge</th>
            <th>Invoice</th>
            <th>Payment</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)}>
              <td>
                <button type="button" className="clinical-billing-link-cell" onClick={() => onOpenDetail(row, 'order')}>
                  <strong>{row.order?.order_no}</strong>
                  <span>{SERVICE_LABEL[row.order?.order_type] || row.order?.order_type} · {row.order?.status}</span>
                </button>
              </td>
              <td><strong>{patientName(row)}</strong><small>{patientSub(row)}</small></td>
              <td><strong>{row.charges?.[0]?.charge_no || 'Missing'}</strong><small>{row.charges?.[0]?.status || 'missing'}</small></td>
              <td><strong>{row.invoices?.[0]?.invoice_no || 'Missing'}</strong><small>{row.invoices?.[0]?.status || 'missing'}</small></td>
              <td><strong>{row.payments?.[0]?.payment_no || 'Missing'}</strong><small>{row.payments?.[0]?.status || 'missing'}</small></td>
              <td><span className={`clinical-billing-badge is-${row.reconciliation?.severity || 'neutral'}`}>{row.reconciliation?.label}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({ selection, detail, loading, onClose, onAction }) {
  if (!selection) {
    return (
      <aside className="clinical-billing-drawer is-empty">
        <Sparkles size={24} />
        <strong>Trace lâm sàng - billing</strong>
        <span>{'Chọn một order, charge, invoice hoặc exception để xem đường đi Order -> Charge -> Invoice -> Payment.'}</span>
      </aside>
    );
  }

  const invoice = detail?.invoice || detail?.invoice_detail || (selection.type === 'invoice' ? detail : null);
  const trace = detail?.timeline || detail?.trace?.timeline || [];
  const order = detail?.order || selection.row?.order || selection.row;
  const charges = detail?.charges || detail?.trace?.charges || [];
  const invoices = detail?.invoices || detail?.trace?.invoices || [];
  const payments = detail?.payments || detail?.trace?.payments || [];

  return (
    <aside className="clinical-billing-drawer">
      <header>
        <div>
          <span>{selection.type}</span>
          <strong>{invoice?.invoice_no || order?.order_no || selection.row?.charge_no || selection.row?.entity_no || 'Chi tiết'}</strong>
        </div>
        <button type="button" aria-label="Đóng drawer" onClick={onClose}><X size={17} /></button>
      </header>
      {loading ? (
        <div className="clinical-billing-drawer__loading">Đang tải trace...</div>
      ) : (
        <div className="clinical-billing-drawer__body">
          {invoice ? (
            <section>
              <h3>Invoice money</h3>
              <div className="clinical-billing-money-grid">
                <span><small>Subtotal</small><strong>{formatMoney(invoice.subtotal_amount)}</strong></span>
                <span><small>Total</small><strong>{formatMoney(invoice.total_amount)}</strong></span>
                <span><small>Paid</small><strong>{formatMoney(invoice.paid_amount)}</strong></span>
                <span><small>Balance</small><strong>{formatMoney(invoice.balance_due)}</strong></span>
              </div>
              <div className="clinical-billing-row-actions">
                {invoice.status === 'draft' ? <button type="button" onClick={() => onAction('issue_invoice', invoice)}><CheckCircle2 size={14} />Issue</button> : null}
                {['issued', 'partially_paid'].includes(invoice.status) ? <button type="button" onClick={() => onAction('collect_payment', invoice)}><CreditCard size={14} />Thu tiền</button> : null}
                {['issued', 'partially_paid'].includes(invoice.status) ? <button type="button" onClick={() => onAction('create_qr', invoice)}><QrCode size={14} />Tạo QR</button> : null}
              </div>
            </section>
          ) : null}
          <section>
            <h3>Clinical billing trace</h3>
            <div className="clinical-billing-trace-grid">
              <span><small>Order</small><strong>{order?.order_no || '-'}</strong></span>
              <span><small>Charge</small><strong>{formatNumber(charges.length || (selection.row?.charge_no ? 1 : 0))}</strong></span>
              <span><small>Invoice</small><strong>{formatNumber(invoices.length || (invoice ? 1 : 0))}</strong></span>
              <span><small>Payment</small><strong>{formatNumber(payments.length || invoice?.payments?.length || 0)}</strong></span>
            </div>
          </section>
          {selection.row?.suggested_action ? (
            <section>
              <h3>Đề xuất xử lý</h3>
              <p>{selection.row.suggested_action}</p>
            </section>
          ) : null}
          <section>
            <h3>Dòng thời gian</h3>
            <div className="clinical-billing-timeline">
              {(trace.length ? trace : invoice?.payment_intents || []).slice(0, 18).map((event, index) => (
                <article key={`${event.event_type || event.status}-${event.entity_id || event._id || index}`}>
                  <i />
                  <strong>{event.title || event.intent_code || event.status}</strong>
                  <span>{formatDate(event.event_time || event.created_at)} · {event.entity_type || event.provider || 'billing'}</span>
                </article>
              ))}
              {!trace.length && !invoice?.payment_intents?.length ? <span className="clinical-billing-muted">Chưa có timeline chi tiết.</span> : null}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

function Pagination({ pagination = {}, setPage }) {
  if (!pagination.total) return null;
  return (
    <div className="clinical-billing-pagination">
      <span>Trang {pagination.page}/{pagination.total_pages || 1} · {formatNumber(pagination.total)} dòng</span>
      <div>
        <button type="button" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>Trước</button>
        <button type="button" disabled={pagination.page >= pagination.total_pages} onClick={() => setPage(pagination.page + 1)}>Sau</button>
      </div>
    </div>
  );
}

function AdjustmentPanel({ exceptions = [] }) {
  return (
    <section className="clinical-billing-adjustment">
      <header>
        <span>Adjustment readiness</span>
        <strong>Luồng điều chỉnh hóa đơn CLS</strong>
      </header>
      <div className="clinical-billing-adjustment__steps">
        {['Chọn invoice/order/charge', 'Chọn lý do', 'Phân tích ảnh hưởng', 'Đề xuất xử lý', 'Gửi duyệt', 'Post adjustment'].map((step, index) => (
          <article key={step}>
            <b>{index + 1}</b>
            <span>{step}</span>
          </article>
        ))}
      </div>
      <p>Backend hiện đã đưa các case cần adjustment vào exception center để không cho void/charge sai đường. Bước tiếp theo là model InvoiceAdjustment/CreditNote/DebitNote nếu cần hạch toán điều chỉnh thật.</p>
      <strong>{formatNumber(exceptions.length)} case đang cần phân loại adjustment</strong>
    </section>
  );
}

export function ClinicalBillingPage({ pageKey = 'dashboard' }) {
  const config = PAGE_CONFIG[pageKey] || PAGE_CONFIG.dashboard;
  const [filters, setFilters] = useState(() => ({ page: 1, limit: 25, ...(config.query || {}) }));
  const [dashboard, setDashboard] = useState({});
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selection, setSelection] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedChargeIds, setSelectedChargeIds] = useState([]);

  useEffect(() => {
    setFilters({ page: 1, limit: 25, ...(config.query || {}) });
    setSelection(null);
    setDetail(null);
    setSelectedChargeIds([]);
  }, [pageKey]);

  function setFilter(key, value) {
    setFilters((current) => {
      const next = { ...current, [key]: value, page: 1 };
      if (key === 'status' && value) delete next.payment_state;
      if (key === 'payment_state' && value) delete next.status;
      return next;
    });
  }

  const listParams = useMemo(() => ({ ...(config.query || {}), ...filters }), [config, filters]);

  async function loadDashboard() {
    setDashboardLoading(true);
    try {
      setDashboard(await clinicalBillingApi.dashboard({
        service_type: filters.service_type,
        date_from: filters.date_from,
        date_to: filters.date_to,
      }));
    } catch (_) {
      setDashboard({});
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      let result;
      if (config.source === 'dashboard') result = await clinicalBillingApi.dashboard(listParams);
      else if (config.source === 'candidates') result = await clinicalBillingApi.chargeCandidates(listParams);
      else if (config.source === 'charges') result = await clinicalBillingApi.charges(listParams);
      else if (config.source === 'unbilled') result = await clinicalBillingApi.unbilledCharges(listParams);
      else if (config.source === 'invoices') result = await clinicalBillingApi.invoices(listParams);
      else if (config.source === 'exceptions') result = await clinicalBillingApi.exceptions(listParams);
      else result = await clinicalBillingApi.reconciliation(listParams);
      setData(result || {});
      if (config.source === 'dashboard') setDashboard(result || {});
    } catch (loadError) {
      setError(getClinicalBillingErrorMessage(loadError));
      setData({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    if (config.source !== 'dashboard') loadDashboard();
  }, [pageKey, listParams.page, listParams.limit, listParams.q, listParams.service_type, listParams.status, listParams.payment_state, listParams.date_from, listParams.date_to, listParams.encounter_id]);

  async function refreshAll() {
    await Promise.all([loadData(), loadDashboard()]);
  }

  async function openDetail(row, type) {
    setSelection({ row, type });
    setDetail(null);
    setDetailLoading(true);
    try {
      const exceptionEntity = type === 'exception' ? row.entity_type : null;
      const orderId = exceptionEntity === 'order'
        ? row.entity_id
        : row.order_id || row.order?._id || (exceptionEntity !== 'invoice' ? row.raw?.order_id || row.raw?._id : null);
      const invoiceId = exceptionEntity === 'invoice'
        ? row.entity_id
        : row.invoice_id?._id || row.invoice_id || row.invoice?._id || row._id;
      if (type === 'invoice' || row.invoice_no || exceptionEntity === 'invoice') {
        const [invoiceDetail, timeline] = await Promise.all([
          clinicalBillingApi.invoiceDetail(invoiceId),
          clinicalBillingApi.invoiceTimeline(invoiceId).catch(() => null),
        ]);
        setDetail({ invoice: invoiceDetail, timeline: timeline?.timeline || [], charges: timeline?.charges || [], payments: invoiceDetail?.payments || [] });
      } else if (orderId) {
        const trace = await clinicalBillingApi.orderTrace(orderId);
        setDetail(trace);
      } else if (row.encounter?._id || row.encounter_id) {
        const summary = await clinicalBillingApi.encounterSummary(row.encounter?._id || row.encounter_id);
        setDetail(summary);
      } else {
        setDetail(row);
      }
    } catch (detailError) {
      setToast(getClinicalBillingErrorMessage(detailError, 'Không thể tải drawer chi tiết.'));
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleCharge(chargeId) {
    setSelectedChargeIds((current) => current.includes(chargeId)
      ? current.filter((id) => id !== chargeId)
      : [...current, chargeId]);
  }

  async function handleAction(action, row) {
    try {
      if (action === 'create_charge') {
        await clinicalBillingApi.createOrderCharge(row.order_id || row.order?._id, { post_immediately: true });
        setToast('Đã tạo charge posted cho order.');
      }
      if (action === 'batch_one') {
        await clinicalBillingApi.createInvoiceFromCharges({ charge_ids: [getRowId(row)], encounter_id: row.encounter?._id || row.encounter_id });
        setToast('Đã tạo invoice draft từ charge.');
      }
      if (action === 'batch_selected') {
        if (!selectedChargeIds.length) {
          setToast('Chọn ít nhất một charge để lập hóa đơn.');
          return;
        }
        await clinicalBillingApi.createInvoiceFromCharges({ charge_ids: selectedChargeIds, encounter_id: filters.encounter_id || undefined });
        setSelectedChargeIds([]);
        setToast('Đã tạo invoice draft từ các charge đã chọn.');
      }
      if (action === 'invoice_encounter') {
        const encounterId = filters.encounter_id || window.prompt('Encounter ID cần lập invoice');
        if (!encounterId) return;
        await clinicalBillingApi.createInvoiceFromEncounter({ encounter_id: encounterId, include_posted_only: true });
        setToast('Đã tạo invoice draft theo encounter.');
      }
      if (action === 'issue_invoice') {
        await clinicalBillingApi.issueInvoice(row._id || row.invoice_id || row.invoice?._id);
        setToast('Đã phát hành invoice.');
      }
      if (action === 'collect_payment') {
        const invoiceId = row._id || row.invoice_id || row.invoice?._id;
        const amount = window.prompt('Số tiền thu', String(row.balance_due || row.invoice?.balance_due || 0));
        if (!amount) return;
        await clinicalBillingApi.createPayment(invoiceId, { amount: Number(amount), payment_method: 'cash', payment_source: 'clinical_billing_workspace' });
        setToast('Đã ghi nhận payment.');
      }
      if (action === 'create_qr') {
        const invoiceId = row._id || row.invoice_id || row.invoice?._id;
        await clinicalBillingApi.createPaymentIntent(invoiceId, { amount: Number(row.balance_due || row.invoice?.balance_due || 0) });
        setToast('Đã tạo payment intent/QR cho invoice.');
      }
      if (action === 'void_charge') {
        const reason = window.prompt('Lý do void charge', 'Charge sai hoặc order không thực hiện');
        if (!reason) return;
        await clinicalBillingApi.voidCharge(getRowId(row), { reason });
        setToast('Đã void charge.');
      }
      await refreshAll();
    } catch (actionError) {
      setToast(getClinicalBillingErrorMessage(actionError));
    }
  }

  const rows = data.items || data.exceptions || [];
  const activeDashboard = config.source === 'dashboard' ? data : dashboard;
  const showBatch = config.source === 'unbilled' || pageKey === 'unbilled';

  return (
    <div className="clinical-billing-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <section className="clinical-billing-header">
        <div>
          <span>{config.eyebrow}</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        <div className="clinical-billing-header__actions">
          <button type="button" onClick={() => handleAction('invoice_encounter')}><Layers3 size={16} />Invoice encounter</button>
          <button type="button" onClick={() => handleAction('batch_selected')} disabled={!selectedChargeIds.length}><ReceiptText size={16} />Invoice selected</button>
          <button type="button" onClick={refreshAll}><RefreshCw size={16} />Làm mới</button>
        </div>
      </section>

      <KpiStrip data={activeDashboard} loading={dashboardLoading && config.source !== 'dashboard'} />
      {activeDashboard.by_service_type?.length ? <ServiceTypeRevenue data={activeDashboard.by_service_type} /> : null}
      <FilterBar filters={filters} setFilter={setFilter} onRefresh={refreshAll} loading={loading} source={config.source} />
      <WidgetError message={error} onRetry={refreshAll} />

      {pageKey === 'adjustments' ? <AdjustmentPanel exceptions={rows} /> : null}

      <section className="clinical-billing-layout">
        <main>
          {config.source === 'dashboard' ? <ExceptionsTable rows={activeDashboard.exceptions || []} loading={loading} onOpenDetail={openDetail} /> : null}
          {config.source === 'candidates' ? <CandidateTable rows={rows} loading={loading} onAction={handleAction} onOpenDetail={openDetail} /> : null}
          {['charges', 'unbilled'].includes(config.source) ? (
            <ChargesTable
              rows={rows}
              loading={loading}
              selectedChargeIds={selectedChargeIds}
              toggleCharge={toggleCharge}
              onAction={handleAction}
              onOpenDetail={openDetail}
              allowBatch={showBatch}
            />
          ) : null}
          {config.source === 'invoices' ? <InvoicesTable rows={rows} loading={loading} onAction={handleAction} onOpenDetail={openDetail} /> : null}
          {config.source === 'exceptions' ? <ExceptionsTable rows={rows} loading={loading} onOpenDetail={openDetail} /> : null}
          {config.source === 'reconciliation' ? <ReconciliationTable rows={rows} loading={loading} onOpenDetail={openDetail} /> : null}
          <Pagination pagination={data.pagination} setPage={(page) => setFilter('page', page)} />
        </main>
        <DetailDrawer selection={selection} detail={detail} loading={detailLoading} onClose={() => { setSelection(null); setDetail(null); }} onAction={handleAction} />
      </section>
    </div>
  );
}
