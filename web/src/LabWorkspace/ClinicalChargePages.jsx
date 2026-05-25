import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Filter,
  History,
  Layers3,
  RefreshCw,
  Search,
  Send,
  WalletCards,
  X,
} from 'lucide-react';
import { promptClinicalOpsText } from '../ClinicalOpsWorkspace/clinicalOpsActions';
import { clinicalChargeApi, getClinicalChargeErrorMessage } from './clinicalChargeApi';

const SERVICE_LABEL = {
  lab: 'Xét nghiệm',
  imaging: 'CĐHA',
  procedure: 'Thủ thuật',
};

const STATUS_LABEL = {
  pending: 'Chờ post',
  draft: 'Nháp',
  posted: 'Đã post',
  billed: 'Đã lên hóa đơn',
  voided: 'Void',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
  none: 'Không review',
  needs_review: 'Cần review',
  resolved: 'Đã xử lý',
  rejected: 'Từ chối',
};

const PAGE_CONFIG = {
  dashboard: {
    eyebrow: 'Charge CLS',
    title: 'Tổng quan charge cận lâm sàng',
    subtitle: 'Theo dõi order đã làm, charge đã tạo, charge thiếu, charge chưa invoice và review queue.',
    source: 'dashboard',
  },
  actionQueue: {
    eyebrow: 'Cần xử lý',
    title: 'Charge cần xử lý hôm nay',
    subtitle: 'Worklist các ca thiếu charge, chờ post, quá SLA, sai trạng thái hoặc cần Billing review.',
    source: 'actionQueue',
  },
  missing: {
    eyebrow: 'Chờ tạo charge',
    title: 'Order đủ điều kiện nhưng chưa có charge',
    subtitle: 'Lab, CĐHA và thủ thuật đã đến mốc tính phí nhưng chưa có charge active.',
    source: 'missing',
  },
  byOrder: {
    eyebrow: 'Theo order',
    title: 'Charge theo order',
    subtitle: 'Đối chiếu từng Order -> Charge -> Invoice -> Payment để tìm thất thu và sai trạng thái.',
    source: 'byOrder',
  },
  lab: {
    eyebrow: 'Xét nghiệm',
    title: 'Charge xét nghiệm',
    subtitle: 'Theo dõi phí xét nghiệm theo specimen, result, trạng thái charge và invoice.',
    source: 'lab',
    query: { service_type: 'lab' },
  },
  imaging: {
    eyebrow: 'Chẩn đoán hình ảnh',
    title: 'Charge chẩn đoán hình ảnh',
    subtitle: 'Kiểm soát phí X-quang, siêu âm, CT, MRI theo report và trạng thái billing.',
    source: 'imaging',
    query: { service_type: 'imaging' },
  },
  procedure: {
    eyebrow: 'Thủ thuật',
    title: 'Charge thủ thuật',
    subtitle: 'Tận dụng procedure charge workflow để kiểm soát completed, draft, posted, billed và void.',
    source: 'procedure',
    query: { service_type: 'procedure' },
  },
  posted: {
    eyebrow: 'Đã post',
    title: 'Charge đã post',
    subtitle: 'Các khoản phí đã ghi nhận chính thức, sẵn sàng gom invoice hoặc cần void nếu sai.',
    source: 'posted',
    query: { status: 'posted' },
  },
  unbilled: {
    eyebrow: 'Chưa lên hóa đơn',
    title: 'Charge posted chưa lên hóa đơn',
    subtitle: 'Worklist chống thất thu, gom theo bệnh nhân hoặc encounter trước khi lập invoice.',
    source: 'unbilled',
    query: { status: 'posted', has_invoice: 'false' },
  },
  billed: {
    eyebrow: 'Đã lên hóa đơn',
    title: 'Charge đã lên hóa đơn',
    subtitle: 'Tra charge đã billed, invoice status, paid amount, balance và yêu cầu adjustment nếu sai.',
    source: 'billed',
    query: { status: 'billed' },
  },
  exceptions: {
    eyebrow: 'Lỗi / review',
    title: 'Charge lỗi hoặc cần review',
    subtitle: 'Bắt missing charge, price mismatch, order hủy nhưng charge active, stale posted và billing feedback.',
    source: 'exceptions',
  },
  reconciliation: {
    eyebrow: 'Đối soát',
    title: 'Đối soát charge với Billing',
    subtitle: 'Matrix order, charge, invoice, payment để khóa ngày đối soát và xuất lỗi vận hành.',
    source: 'reconciliation',
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
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', hour12: false, minute: '2-digit' }).format(date);
}

function statusClass(value = '') {
  return String(value || 'neutral').replaceAll('_', '-');
}

function rowId(row) {
  return row?._id || row?.id || row?.order_id || row?.order?._id || row?.charge?._id || row?.raw?._id;
}

function orderId(row) {
  const value = row?.order_id || row?.order?._id || row?.order?.order_id || row?.raw?._id || row?.raw?.order_id || row?.charge?.order_id?._id || row?.charge?.order_id;
  return value && typeof value === 'object' ? value._id : value;
}

function chargeId(row) {
  return row?._id || row?.charge?._id || (row?.entity_type === 'charge' ? row.entity_id : null);
}

function patient(row) {
  return row?.patient || row?.patient_id || row?.order?.patient || row?.raw?.patient_id || row?.charge?.patient;
}

function encounter(row) {
  return row?.encounter || row?.encounter_id || row?.raw?.encounter_id || row?.charge?.encounter;
}

function service(row) {
  return row?.service || row?.service_id || row?.charge?.service || row?.raw?.service_id;
}

function sourceModule(row) {
  return row?.module || row?.source_type || row?.service_type || service(row)?.service_type || row?.order?.order_type || row?.raw?.order_type;
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="clinical-charge-toast" role="status">
      <span>{message}</span>
      <button type="button" aria-label="Đóng thông báo" onClick={onClose}><X size={15} /></button>
    </div>
  );
}

function Badge({ value, tone }) {
  return <span className={`clinical-charge-badge ${tone || statusClass(value)}`}>{STATUS_LABEL[value] || SERVICE_LABEL[value] || value || '-'}</span>;
}

function KpiCard({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`clinical-charge-kpi ${tone || ''}`}>
      <div className="clinical-charge-kpi-icon"><Icon size={19} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

function Header({ config, onRefresh, onBulkPost, onBulkVoid, onBulkCreate, selectedCount }) {
  return (
    <div className="clinical-charge-header">
      <div>
        <span className="clinical-charge-eyebrow">{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
      </div>
      <div className="clinical-charge-actions">
        <button type="button" onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button>
        <button type="button" onClick={onBulkCreate} disabled={!selectedCount}><WalletCards size={16} /> Tạo charge</button>
        <button type="button" onClick={onBulkPost} disabled={!selectedCount}><CheckCircle2 size={16} /> Post</button>
        <button type="button" onClick={onBulkVoid} disabled={!selectedCount}><AlertTriangle size={16} /> Void</button>
      </div>
    </div>
  );
}

function FilterBar({ filters, setFilters }) {
  const patch = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  return (
    <div className="clinical-charge-filterbar">
      <label className="clinical-charge-search">
        <Search size={16} />
        <input value={filters.keyword || ''} onChange={(event) => patch('keyword', event.target.value)} placeholder="Tìm charge, order, patient, invoice" />
      </label>
      <label>
        <Filter size={15} />
        <select value={filters.service_type || ''} onChange={(event) => patch('service_type', event.target.value)}>
          <option value="">Tất cả loại</option>
          <option value="lab">Xét nghiệm</option>
          <option value="imaging">CĐHA</option>
          <option value="procedure">Thủ thuật</option>
        </select>
      </label>
      <label>
        <select value={filters.status || ''} onChange={(event) => patch('status', event.target.value)}>
          <option value="">Mọi charge status</option>
          <option value="pending">Pending</option>
          <option value="draft">Draft</option>
          <option value="posted">Posted</option>
          <option value="billed">Billed</option>
          <option value="voided">Voided</option>
          <option value="refunded">Refunded</option>
        </select>
      </label>
      <label>
        <select value={filters.review_status || ''} onChange={(event) => patch('review_status', event.target.value)}>
          <option value="">Mọi review</option>
          <option value="needs_review">Cần review</option>
          <option value="resolved">Đã xử lý</option>
          <option value="rejected">Từ chối</option>
          <option value="none">Không review</option>
        </select>
      </label>
      <input type="date" value={filters.date_from || ''} onChange={(event) => patch('date_from', event.target.value)} />
      <input type="date" value={filters.date_to || ''} onChange={(event) => patch('date_to', event.target.value)} />
    </div>
  );
}

function Dashboard({ data }) {
  const summary = data?.summary || {};
  const source = data?.source_dashboard || {};
  return (
    <>
      <div className="clinical-charge-kpis">
        <KpiCard icon={ClipboardCheck} label="Order hoàn tất" value={formatNumber(summary.orders_completed)} hint="Theo bộ lọc" />
        <KpiCard icon={WalletCards} label="Charge đã tạo" value={formatNumber(summary.charges_created)} hint="Có charge active" />
        <KpiCard icon={AlertTriangle} label="Thiếu charge" value={formatNumber(summary.missing_charge_count)} tone="danger" />
        <KpiCard icon={Clock3} label="Chờ post" value={formatNumber((summary.pending_charge_count || 0) + (summary.draft_charge_count || 0))} />
        <KpiCard icon={CheckCircle2} label="Đã post" value={formatNumber(summary.posted_charge_count)} />
        <KpiCard icon={Banknote} label="Chưa invoice" value={formatNumber(summary.unbilled_charge_count)} tone="warning" />
        <KpiCard icon={BadgeCheck} label="Đã billed" value={formatNumber(summary.billed_charge_count)} tone="success" />
        <KpiCard icon={Layers3} label="Cần review" value={formatNumber(summary.review_count || summary.exception_count)} tone="danger" />
      </div>

      <div className="clinical-charge-dashboard-grid">
        <section className="clinical-charge-panel">
          <div className="clinical-charge-panel-title">
            <h2>Theo module</h2>
            <span>{formatMoney(summary.total_charge_amount)}</span>
          </div>
          <div className="clinical-charge-module-list">
            {Object.entries(data?.by_module || {}).map(([key, row]) => (
              <div key={key} className="clinical-charge-module-row">
                <div>
                  <strong>{SERVICE_LABEL[key] || key}</strong>
                  <span>{formatNumber(row.completed_orders)} order · {formatNumber(row.charges_created)} charge</span>
                </div>
                <div className="clinical-charge-progress"><i style={{ width: `${Math.min((row.charges_created / Math.max(row.completed_orders || 1, 1)) * 100, 100)}%` }} /></div>
                <b>{formatMoney(row.posted_amount)}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="clinical-charge-panel">
          <div className="clinical-charge-panel-title">
            <h2>Cần xử lý ngay</h2>
            <span>{formatNumber(source.kpis?.billing_exceptions || 0)} lỗi</span>
          </div>
          <div className="clinical-charge-exception-stack">
            {(source.exceptions || []).slice(0, 6).map((item) => (
              <div key={item.id} className={`clinical-charge-exception-card ${item.severity}`}>
                <Badge value={item.severity} tone={item.severity} />
                <strong>{item.type}</strong>
                <span>{item.entity_no || item.suggested_action}</span>
              </div>
            ))}
            {!source.exceptions?.length ? <div className="clinical-charge-empty-mini">Không có exception nổi bật.</div> : null}
          </div>
        </section>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div className="clinical-charge-empty">
      <FileText size={28} />
      <strong>Chưa có dữ liệu</strong>
      <span>Điều chỉnh bộ lọc hoặc làm mới danh sách.</span>
    </div>
  );
}

function ActionQueueTable({ rows, onOpen, onCreateCharge, onPostCharge, onReview }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="clinical-charge-table-wrap">
      <table className="clinical-charge-table">
        <thead>
          <tr>
            <th>Mức độ</th>
            <th>Vấn đề</th>
            <th>Bệnh nhân</th>
            <th>Order / Charge</th>
            <th>Dịch vụ</th>
            <th>Số tiền</th>
            <th>Tuổi lỗi</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowId(row)} onClick={() => onOpen(row)}>
              <td><Badge value={row.severity} tone={row.severity} /></td>
              <td><strong>{row.type}</strong><span>{row.reason || row.suggested_action}</span></td>
              <td><strong>{patient(row)?.full_name || '-'}</strong><span>{patient(row)?.patient_code}</span></td>
              <td><strong>{row.order?.order_no || row.charge?.charge_no || row.entity_no || '-'}</strong><span>{SERVICE_LABEL[row.module] || row.module}</span></td>
              <td>{service(row)?.service_name || '-'}</td>
              <td>{formatMoney(row.amount)}</td>
              <td>{formatDate(row.detected_at)}</td>
              <td className="clinical-charge-row-actions" onClick={(event) => event.stopPropagation()}>
                {row.type === 'missing_charge' ? <button type="button" onClick={() => onCreateCharge(row, 'posted')}>Tạo</button> : null}
                {row.charge?.status === 'pending' || row.charge?.status === 'draft' ? <button type="button" onClick={() => onPostCharge(row.charge)}>Post</button> : null}
                {row.charge?._id ? <button type="button" onClick={() => onReview(row.charge)}>Review</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingTable({ rows, selected, toggle, onOpen, onCreateCharge }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="clinical-charge-table-wrap">
      <table className="clinical-charge-table">
        <thead>
          <tr>
            <th></th>
            <th>Order</th>
            <th>Loại</th>
            <th>Bệnh nhân</th>
            <th>Encounter</th>
            <th>Dịch vụ</th>
            <th>Trạng thái</th>
            <th>Giá gợi ý</th>
            <th>Lý do</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowId(row)} onClick={() => onOpen(row)}>
              <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.has(orderId(row))} onChange={() => toggle(orderId(row))} /></td>
              <td><strong>{row.order_no || row.order?.order_no}</strong><span>{formatDate(row.eligible_at)}</span></td>
              <td><Badge value={row.source_type || row.service?.service_type} /></td>
              <td><strong>{patient(row)?.full_name || '-'}</strong><span>{patient(row)?.patient_code}</span></td>
              <td>{encounter(row)?.encounter_code || '-'}</td>
              <td><strong>{service(row)?.service_name || '-'}</strong><span>{service(row)?.service_code}</span></td>
              <td><Badge value={row.order_status || row.execution_status} /></td>
              <td>{formatMoney(row.suggested_price || service(row)?.unit_price)}</td>
              <td>{row.charge_block_reason || 'Đủ điều kiện tạo charge'}</td>
              <td className="clinical-charge-row-actions" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={() => onCreateCharge(row, 'posted')}>Posted</button>
                <button type="button" onClick={() => onCreateCharge(row, 'draft')}>Draft</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChargesTable({ rows, selected, toggle, onOpen, onPostCharge, onVoidCharge, onReview, onResolve }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="clinical-charge-table-wrap">
      <table className="clinical-charge-table">
        <thead>
          <tr>
            <th></th>
            <th>Charge</th>
            <th>Loại</th>
            <th>Bệnh nhân</th>
            <th>Order</th>
            <th>Dịch vụ</th>
            <th>Số tiền</th>
            <th>Status</th>
            <th>Invoice</th>
            <th>Review</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowId(row)} onClick={() => onOpen(row)}>
              <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.has(chargeId(row))} onChange={() => toggle(chargeId(row))} /></td>
              <td><strong>{row.charge_no}</strong><span>{formatDate(row.charged_at)}</span></td>
              <td><Badge value={sourceModule(row)} /></td>
              <td><strong>{patient(row)?.full_name || '-'}</strong><span>{patient(row)?.patient_code}</span></td>
              <td><strong>{row.order?.order_no || row.order_id?.order_no || '-'}</strong><span>{row.order?.status || row.order_id?.status}</span></td>
              <td><strong>{service(row)?.service_name || row.description}</strong><span>{row.quantity} x {formatMoney(row.unit_price)}</span></td>
              <td><strong>{formatMoney(row.total_amount)}</strong><span>Giảm {formatMoney(row.discount_amount)}</span></td>
              <td><Badge value={row.status} /></td>
              <td><strong>{row.invoice?.invoice_no || row.invoice_id?.invoice_no || '-'}</strong><span>{row.invoice?.status || row.invoice_id?.status}</span></td>
              <td><Badge value={row.review_status || 'none'} /></td>
              <td className="clinical-charge-row-actions" onClick={(event) => event.stopPropagation()}>
                {['pending', 'draft'].includes(row.status) ? <button type="button" onClick={() => onPostCharge(row)}>Post</button> : null}
                {['pending', 'draft', 'posted'].includes(row.status) && !row.invoice_id ? <button type="button" onClick={() => onVoidCharge(row)}>Void</button> : null}
                <button type="button" onClick={() => onReview(row)}><Send size={13} /> Review</button>
                {row.review_status === 'needs_review' ? <button type="button" onClick={() => onResolve(row)}>Resolve</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReconciliationTable({ rows, onOpen }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="clinical-charge-table-wrap">
      <table className="clinical-charge-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Bệnh nhân</th>
            <th>Dịch vụ</th>
            <th>Charge</th>
            <th>Invoice</th>
            <th>Payment</th>
            <th>Trạng thái đối soát</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowId(row)} onClick={() => onOpen(row)}>
              <td><strong>{row.order?.order_no}</strong><span>{SERVICE_LABEL[row.order?.order_type] || row.order?.order_type}</span></td>
              <td><strong>{patient(row)?.full_name || '-'}</strong><span>{patient(row)?.patient_code}</span></td>
              <td>{service(row)?.service_name || '-'}</td>
              <td><strong>{formatNumber(row.charges?.length)}</strong><span>{formatMoney((row.charges || []).reduce((sum, item) => sum + Number(item.total_amount || 0), 0))}</span></td>
              <td><strong>{formatNumber(row.invoices?.length)}</strong><span>{row.invoices?.[0]?.status || '-'}</span></td>
              <td><strong>{formatNumber(row.payments?.length)}</strong><span>{row.payments?.[0]?.status || '-'}</span></td>
              <td><Badge value={row.reconciliation?.severity} tone={row.reconciliation?.severity} /><span>{row.reconciliation?.label}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExceptionsTable({ rows, onOpen }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="clinical-charge-table-wrap">
      <table className="clinical-charge-table">
        <thead>
          <tr>
            <th>Mức độ</th>
            <th>Lỗi</th>
            <th>Đối tượng</th>
            <th>Bệnh nhân</th>
            <th>Số tiền</th>
            <th>Phát hiện</th>
            <th>Đề xuất</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowId(row)} onClick={() => onOpen(row)}>
              <td><Badge value={row.severity} tone={row.severity} /></td>
              <td><strong>{row.type}</strong><span>{row.owner}</span></td>
              <td><strong>{row.entity_no || row.entity_id}</strong><span>{row.entity_type}</span></td>
              <td><strong>{patient(row)?.full_name || '-'}</strong><span>{patient(row)?.patient_code}</span></td>
              <td>{formatMoney(row.amount)}</td>
              <td>{formatDate(row.detected_at)}</td>
              <td>{row.suggested_action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({ detail, row, loading, onClose }) {
  if (!row) return null;
  const trace = detail || {};
  return (
    <aside className="clinical-charge-drawer">
      <div className="clinical-charge-drawer-head">
        <div>
          <span>Billing trace</span>
          <h2>{trace.order?.order_no || row.order?.order_no || row.charge_no || row.entity_no || 'Chi tiết'}</h2>
        </div>
        <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
      </div>
      {loading ? <div className="clinical-charge-drawer-loading">Đang tải trace...</div> : (
        <div className="clinical-charge-drawer-body">
          <section>
            <h3>Order</h3>
            <p>{trace.order?.order_no || row.order?.order_no || '-'}</p>
            <span>{SERVICE_LABEL[trace.order?.order_type || sourceModule(row)] || trace.order?.order_type || sourceModule(row)}</span>
          </section>
          <section>
            <h3>Charge</h3>
            {(trace.charges || (row.charge_no ? [row] : [])).map((charge) => (
              <div className="clinical-charge-mini-row" key={charge._id || charge.charge_no}>
                <strong>{charge.charge_no}</strong>
                <Badge value={charge.status} />
                <span>{formatMoney(charge.total_amount)}</span>
              </div>
            ))}
          </section>
          <section>
            <h3>Invoice / Payment</h3>
            {(trace.invoices || []).map((invoice) => (
              <div className="clinical-charge-mini-row" key={invoice._id}>
                <strong>{invoice.invoice_no}</strong>
                <Badge value={invoice.status} />
                <span>{formatMoney(invoice.balance_due)}</span>
              </div>
            ))}
            {!trace.invoices?.length ? <span>Chưa có invoice trong trace.</span> : null}
          </section>
          <section>
            <h3>Timeline</h3>
            <div className="clinical-charge-timeline">
              {(trace.timeline || []).map((item, index) => (
                <div key={`${item.type || item.label}-${index}`}>
                  <i />
                  <strong>{item.label || item.type}</strong>
                  <span>{formatDate(item.at || item.created_at)}</span>
                </div>
              ))}
              {!trace.timeline?.length ? <span>Chưa có timeline chi tiết.</span> : null}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

export function ClinicalChargePage({ pageKey = 'dashboard' }) {
  const config = PAGE_CONFIG[pageKey] || PAGE_CONFIG.dashboard;
  const [filters, setFilters] = useState({ page: 1, limit: 25, ...(config.query || {}) });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [activeRow, setActiveRow] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setFilters({ page: 1, limit: 25, ...(config.query || {}) });
    setSelected(new Set());
    setActiveRow(null);
  }, [pageKey]);

  const listParams = useMemo(() => ({
    ...filters,
    ...(config.query || {}),
  }), [filters, config]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await clinicalChargeApi[config.source](listParams);
      setData(response);
    } catch (err) {
      setError(getClinicalChargeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [listParams, config.source]);

  const rows = data?.items || data?.source_dashboard?.exceptions || [];
  const pagination = data?.pagination || {};

  const toggle = (id) => {
    if (!id) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runAction = async (action, successMessage) => {
    try {
      await action();
      setToast(successMessage);
      setSelected(new Set());
      await fetchData();
    } catch (err) {
      setToast(getClinicalChargeErrorMessage(err));
    }
  };

  const createCharge = (row, status = 'posted') => {
    const id = orderId(row);
    if (!id) return setToast('Không xác định được order để tạo charge.');
    return runAction(
      () => clinicalChargeApi.createOrderCharge(id, { status, post_immediately: status === 'posted' }),
      `Đã tạo charge ${status}.`,
    );
  };

  const postCharge = (row) => runAction(() => clinicalChargeApi.postCharge(chargeId(row) || row._id), 'Đã post charge.');

  const voidCharge = (row) => {
    const reason = promptClinicalOpsText({ title: 'Void charge', message: 'Nhập lý do void charge' });
    if (!reason) return null;
    return runAction(() => clinicalChargeApi.voidCharge(chargeId(row) || row._id, { reason }), 'Đã void charge.');
  };

  const markReview = (row) => {
    const notes = promptClinicalOpsText({ title: 'Billing review', message: 'Ghi chú gửi Billing review', defaultValue: 'Cần Billing review.' }) || 'Cần Billing review.';
    return runAction(() => clinicalChargeApi.sendToBillingReview(chargeId(row) || row._id, { notes }), 'Đã gửi Billing review.');
  };

  const resolveReview = (row) => runAction(() => clinicalChargeApi.resolveReview(chargeId(row) || row._id, { notes: 'Đã xử lý từ workspace Charge.' }), 'Đã resolve review.');

  const bulkCreate = () => {
    const ids = Array.from(selected);
    if (!ids.length) return null;
    return runAction(() => clinicalChargeApi.bulkCreateFromOrders({ order_ids: ids, status: 'posted' }), 'Đã tạo charge hàng loạt.');
  };

  const bulkPost = () => {
    const ids = Array.from(selected);
    if (!ids.length) return null;
    return runAction(() => clinicalChargeApi.bulkPost({ charge_ids: ids }), 'Đã post charge hàng loạt.');
  };

  const bulkVoid = () => {
    const ids = Array.from(selected);
    const reason = promptClinicalOpsText({ title: 'Void charge hàng loạt', message: 'Nhập lý do void hàng loạt' });
    if (!ids.length || !reason) return null;
    return runAction(() => clinicalChargeApi.bulkVoid({ charge_ids: ids, reason }), 'Đã void charge hàng loạt.');
  };

  const openDetail = async (row) => {
    setActiveRow(row);
    setDetail(null);
    const id = orderId(row);
    if (!id) return;
    setDetailLoading(true);
    try {
      setDetail(await clinicalChargeApi.orderContext(id));
    } catch (err) {
      setToast(getClinicalChargeErrorMessage(err, 'Không tải được billing trace.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const renderTable = () => {
    if (loading) return <div className="clinical-charge-loading">Đang tải dữ liệu charge...</div>;
    if (error) return <div className="clinical-charge-error"><AlertTriangle size={18} /> {error}<button type="button" onClick={fetchData}>Thử lại</button></div>;
    if (config.source === 'dashboard') return <Dashboard data={data || {}} />;
    if (config.source === 'actionQueue') return <ActionQueueTable rows={data?.items || []} onOpen={openDetail} onCreateCharge={createCharge} onPostCharge={postCharge} onReview={markReview} />;
    if (config.source === 'missing') return <MissingTable rows={data?.items || []} selected={selected} toggle={toggle} onOpen={openDetail} onCreateCharge={createCharge} />;
    if (['byOrder', 'reconciliation'].includes(config.source)) return <ReconciliationTable rows={data?.items || []} onOpen={openDetail} />;
    if (config.source === 'exceptions') return <ExceptionsTable rows={data?.items || []} onOpen={openDetail} />;
    return <ChargesTable rows={rows} selected={selected} toggle={toggle} onOpen={openDetail} onPostCharge={postCharge} onVoidCharge={voidCharge} onReview={markReview} onResolve={resolveReview} />;
  };

  return (
    <div className="clinical-charge-page">
      <Header
        config={config}
        onRefresh={fetchData}
        onBulkPost={bulkPost}
        onBulkVoid={bulkVoid}
        onBulkCreate={bulkCreate}
        selectedCount={selected.size}
      />
      <FilterBar filters={filters} setFilters={setFilters} />
      {config.source !== 'dashboard' ? (
        <div className="clinical-charge-strip">
          <KpiCard icon={Layers3} label="Dòng dữ liệu" value={formatNumber(pagination.total || rows.length || data?.items?.length || 0)} />
          <KpiCard icon={WalletCards} label="Đã chọn" value={formatNumber(selected.size)} />
          <KpiCard icon={History} label="Trang" value={`${pagination.page || filters.page}/${pagination.total_pages || 1}`} />
        </div>
      ) : null}
      {renderTable()}
      {pagination.total_pages > 1 ? (
        <div className="clinical-charge-pagination">
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
