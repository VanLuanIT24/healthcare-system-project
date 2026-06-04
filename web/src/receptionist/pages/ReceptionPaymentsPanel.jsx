import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Hourglass,
  ListChecks,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  UserPlus,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { receptionDataApi } from '../api/receptionDataApi';

const STATUS_META = {
  pending: { label: 'Chờ thanh toán', tone: 'warning' },
  partial: { label: 'Thanh toán một phần', tone: 'info' },
  overdue: { label: 'Quá hạn', tone: 'danger' },
  paid: { label: 'Đã thanh toán', tone: 'success' },
  processing: { label: 'Đang xử lý', tone: 'warning' },
  refunded: { label: 'Đã hoàn tiền', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
};

const PAYMENT_CONFIG = {
  'payments-collect': {
    title: 'Thu thanh toán',
    subtitle: 'Danh sách hóa đơn cần thu và thao tác thanh toán',
    sideTitle: 'Gợi ý thao tác',
    sideItems: [
      ['Kiểm tra chi tiết hóa đơn', 'Xem thông tin tổng quan và tình trạng thanh toán của hóa đơn.'],
      ['Kiểm tra items dịch vụ', 'Xem các dịch vụ, thuốc, xét nghiệm đã sử dụng trong hóa đơn.'],
      ['Xác nhận số tiền còn lại', 'Đối chiếu số tiền còn phải trả trước khi tạo thanh toán.'],
      ['Tạo thanh toán', 'Ghi nhận thanh toán và chọn phương thức phù hợp.'],
      ['Xem lịch sử thanh toán', 'Theo dõi các lần thanh toán đã thực hiện của hóa đơn.'],
    ],
  },
  'payments-pending': {
    title: 'Hóa đơn chờ xử lý',
    subtitle: 'Theo dõi hóa đơn chưa thanh toán, thanh toán một phần và quá hạn',
    sideTitle: 'Việc cần xử lý',
    sideItems: [
      ['Ưu tiên hóa đơn quá hạn', 'Liên hệ bệnh nhân và xác nhận kế hoạch thanh toán.'],
      ['Đối soát thanh toán một phần', 'Kiểm tra giao dịch đã ghi nhận và số tiền còn lại.'],
      ['Nhắc thanh toán', 'Gửi nhắc lịch thanh toán cho hóa đơn đến hạn.'],
      ['Cập nhật trạng thái', 'Đảm bảo trạng thái hóa đơn khớp với giao dịch thực tế.'],
    ],
  },
  'payments-complete': {
    title: 'Đã thanh toán',
    subtitle: 'Danh sách hóa đơn và giao dịch đã thanh toán',
    sideTitle: 'Gợi ý thao tác',
    sideItems: [
      ['Kiểm tra chi tiết thanh toán', 'Xem thông tin đầy đủ gồm phương thức, số tiền, thu ngân và thời gian thanh toán.'],
      ['Đối chiếu phương thức', 'Đối chiếu giữa hóa đơn, phương thức thanh toán và biên nhận để đảm bảo chính xác.'],
      ['In biên nhận', 'In biên nhận thanh toán để bàn giao cho bệnh nhân khi cần thiết.'],
      ['Tra cứu lịch sử thanh toán', 'Theo dõi và tra cứu giao dịch theo mã hóa đơn, bệnh nhân hoặc khoảng thời gian.'],
    ],
  },
  'payments-refund': {
    title: 'Hoàn tiền',
    subtitle: 'Danh sách yêu cầu và lịch sử hoàn tiền',
    sideTitle: 'Quy trình hoàn tiền',
    sideItems: [
      ['1. Kiểm tra hóa đơn gốc', 'Đối chiếu thông tin hóa đơn, dịch vụ và tình trạng thanh toán.'],
      ['2. Xác minh số tiền', 'Kiểm tra số tiền cần hoàn, các khoản đã thanh toán và chính sách hoàn tiền.'],
      ['3. Lý do hoàn tiền', 'Ghi nhận lý do hoàn tiền và đính kèm minh chứng nếu có.'],
      ['4. Cập nhật trạng thái', 'Xử lý yêu cầu và cập nhật trạng thái đúng theo quy trình.'],
      ['5. Lưu lịch sử xử lý', 'Lưu lại toàn bộ thông tin, người xử lý và ghi chú để tra cứu sau này.'],
    ],
  },
};

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('vi-VN');
}

function getPatientName(value) {
  if (!value) return 'Bệnh nhân';
  if (typeof value === 'string') return value;
  return value.full_name || value.patient_name || value.name || value.patient_code || 'Bệnh nhân';
}

function getPatientMeta(value) {
  if (!value || typeof value === 'string') return '--';
  return value.patient_code || value.code || '--';
}

function mapInvoiceStatus(status, balanceDue = 0, paidAmount = 0) {
  if (status === 'paid') return 'paid';
  if (status === 'partially_paid' || paidAmount > 0) return 'partial';
  if (status === 'overdue') return 'overdue';
  if (balanceDue <= 0 && paidAmount > 0) return 'paid';
  return 'pending';
}

function mapPaymentMethod(method) {
  const value = String(method || '').toLowerCase();
  if (value === 'cash') return 'Tiền mặt';
  if (value === 'bank_transfer' || value === 'transfer') return 'Chuyển khoản';
  if (value === 'card' || value === 'credit_card') return 'Thẻ tín dụng';
  if (value === 'atm') return 'Thẻ ATM';
  return method || '--';
}

function mapPaymentMethodToApi(method) {
  if (method === 'Tiền mặt') return 'cash';
  if (method === 'Chuyển khoản') return 'bank_transfer';
  if (method === 'Thẻ ATM' || method === 'Thẻ tín dụng') return 'card';
  return 'other';
}

function normalizeInvoice(item) {
  const total = Number(item.total_amount ?? item.total ?? 0);
  const paid = Number(item.paid_amount ?? item.paid ?? 0);
  const remain = Number(item.balance_due ?? Math.max(total - paid, 0));
  return {
    rawId: item._id || item.id || item.invoice_id || '',
    id: item.invoice_no || item.invoice_code || item.code || item._id || item.id || '--',
    patient: getPatientName(item.patient_id || item.patient),
    meta: getPatientMeta(item.patient_id || item.patient),
    created: formatDateTime(item.issued_at || item.created_at),
    due: formatDate(item.due_date || item.payment_due_date || item.issued_at || item.created_at),
    total,
    paid,
    remain,
    status: mapInvoiceStatus(item.status, remain, paid),
    method: item.payment_method ? mapPaymentMethod(item.payment_method) : '--',
  };
}

function normalizePayment(item) {
  const invoice = item.invoice_id || item.invoice || {};
  return {
    rawId: item._id || item.id || item.payment_id || '',
    id: item.payment_no || item.payment_code || item._id || item.id || '--',
    invoice: invoice.invoice_no || invoice.invoice_code || invoice._id || item.invoice_no || '--',
    patient: getPatientName(item.patient_id || item.patient),
    meta: getPatientMeta(item.patient_id || item.patient),
    date: formatDateTime(item.paid_at || item.created_at),
    amount: Number(item.amount || 0),
    method: mapPaymentMethod(item.payment_method),
    cashier: item.received_by?.full_name || item.created_by?.full_name || '--',
    status: item.status || 'completed',
    reason: item.refund_reason || item.void_reason || '--',
  };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getInvoiceId(item) {
  return item?.invoice_id || item?._id || item?.id || item?.rawId || '';
}

function getIntentId(item) {
  return item?.payment_intent_id || item?.intent_id || item?._id || item?.id || '';
}

function getPaymentId(item) {
  return item?.payment_id || item?._id || item?.id || '';
}

function getPatientId(item) {
  return item?.patient_id?._id || item?.patient_id || item?.patient?.patient_id || item?.patient?.id || item?.patient?._id || '';
}

function getInvoiceNo(item) {
  return item?.invoice_no || item?.invoice_code || item?.code || getInvoiceId(item).slice(-8).toUpperCase() || '--';
}

function getIntentCode(item) {
  return item?.intent_code || item?.code || getIntentId(item).slice(-8).toUpperCase() || '--';
}

function getBalanceDue(item) {
  return Number(item?.balance_due ?? Math.max(Number(item?.total_amount || 0) - Number(item?.paid_amount || 0), 0));
}

function getPatientLabel(item) {
  return getPatientName(item?.patient_id || item?.patient) || item?.patient_name || '--';
}

function getPatientPhone(item) {
  const patient = item?.patient_id || item?.patient || {};
  return patient.phone || patient.patient_phone || item?.patient_phone || '--';
}

function getBillingStatusMeta(status) {
  const key = String(status || '').toLowerCase();
  const map = {
    draft: ['Nháp', 'neutral'],
    issued: ['Đã phát hành', 'info'],
    partially_paid: ['Thanh toán một phần', 'warning'],
    paid: ['Đã thanh toán', 'success'],
    void: ['Đã hủy', 'danger'],
    voided: ['Đã hủy', 'danger'],
    created: ['Đã tạo', 'info'],
    pending: ['Đang chờ', 'warning'],
    pending_manual_confirmation: ['Chờ xác nhận', 'warning'],
    submitted_receipt: ['Có biên lai', 'info'],
    manual_review: ['Manual review', 'danger'],
    expired: ['Hết hạn', 'danger'],
    cancelled: ['Đã hủy', 'danger'],
    failed: ['Lỗi', 'danger'],
    rejected: ['Đã từ chối', 'danger'],
    completed: ['Hoàn tất', 'success'],
    open: ['Open', 'warning'],
  };
  const [label, tone] = map[key] || [status || '--', 'neutral'];
  return { label, tone };
}

function BillingBadge({ status }) {
  const meta = getBillingStatusMeta(status);
  return <span className={`reception-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

function InlineBillingError({ message }) {
  if (!message) return null;
  return (
    <div className="reception-appointment-alert is-danger">
      <XCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

function InlineBillingSuccess({ message }) {
  if (!message) return null;
  return (
    <div className="reception-appointment-alert is-success">
      <CheckCircle2 size={18} />
      <span>{message}</span>
    </div>
  );
}

function getDatePart(value) {
  return String(value || '').split(' ')[0];
}

function parseLocalDate(value) {
  if (!value) return null;
  const [day, month, year] = String(value).split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function toDateInputValue(value) {
  const date = parseLocalDate(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function isDateInRange(dateText, from, to) {
  const date = parseLocalDate(getDatePart(dateText));
  if (!date) return true;
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

function getNowLabel() {
  const now = new Date();
  return `${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return <span className={`reception-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

function PaymentHero({ mode, onCreatePayment }) {
  const config = PAYMENT_CONFIG[mode] || PAYMENT_CONFIG['payments-collect'];
  const canCreatePayment = mode === 'payments-collect' && onCreatePayment;
  return (
    <section className="reception-payment-hero">
      <div>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
      </div>
      <div className="reception-payment-actions">
        {canCreatePayment ? (
          <button
            type="button"
            className="reception-btn reception-btn--primary"
            onClick={() => onCreatePayment?.()}
          >
            <Plus size={16} />
            <span>Tạo thanh toán</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function KpiCard({ icon: Icon, label, value, subtitle, tone = 'info' }) {
  return (
    <article className={`reception-payment-kpi is-${tone}`}>
      <span><Icon size={25} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{subtitle}</em>
      </div>
    </article>
  );
}

function SearchFilters({ mode, filters, onChange }) {
  const update = (key, value) => onChange?.({ ...filters, [key]: value });

  return (
    <section className="reception-payment-filters">
      <label className="is-wide">
        <span>{mode === 'payments-complete' ? 'Mã hóa đơn / Mã thanh toán / Bệnh nhân' : mode === 'payments-refund' ? 'Mã hoàn tiền / Mã hóa đơn / Bệnh nhân' : 'Tìm kiếm'}</span>
        <div>
          <Search size={16} />
          <input
            value={filters.query}
            onChange={(event) => update('query', event.target.value)}
            placeholder="Nhập mã hóa đơn, tên bệnh nhân hoặc SĐT..."
          />
        </div>
      </label>
      <label>
        <span>{mode === 'payments-complete' ? 'Phương thức thanh toán' : mode === 'payments-refund' ? 'Lý do hoàn' : 'Trạng thái'}</span>
        {mode === 'payments-refund' ? (
          <select value={filters.reason} onChange={(event) => update('reason', event.target.value)}>
            <option value="">Tất cả</option>
            <option value="Thu thừa">Thu thừa</option>
            <option value="Hủy dịch vụ">Hủy dịch vụ</option>
            <option value="Hủy lịch">Hủy lịch</option>
          </select>
        ) : mode === 'payments-complete' ? (
          <select value={filters.method} onChange={(event) => update('method', event.target.value)}>
            <option value="">Tất cả</option>
            <option value="Tiền mặt">Tiền mặt</option>
            <option value="Chuyển khoản">Chuyển khoản</option>
            <option value="Thẻ ATM">Thẻ ATM</option>
            <option value="Thẻ tín dụng">Thẻ tín dụng</option>
          </select>
        ) : (
          <select value={filters.status} onChange={(event) => update('status', event.target.value)}>
            <option value="">Tất cả</option>
            <option value="pending">Chờ thanh toán</option>
            <option value="partial">Thanh toán một phần</option>
            <option value="overdue">Quá hạn</option>
            <option value="paid">Đã thanh toán</option>
          </select>
        )}
      </label>
      {mode !== 'payments-refund' ? (
        <label>
          <span>{mode === 'payments-complete' ? 'Thu ngân' : 'Phương thức thanh toán'}</span>
          {mode === 'payments-complete' ? (
            <input value={filters.cashier} onChange={(event) => update('cashier', event.target.value)} placeholder="Nhập tên thu ngân" />
          ) : (
            <select value={filters.method} onChange={(event) => update('method', event.target.value)}>
              <option value="">Tất cả</option>
              <option value="Tiền mặt">Tiền mặt</option>
              <option value="Chuyển khoản">Chuyển khoản</option>
              <option value="Thẻ ATM">Thẻ ATM</option>
              <option value="Thẻ tín dụng">Thẻ tín dụng</option>
            </select>
          )}
        </label>
      ) : null}
      <label className="reception-payment-date-range">
        <span>Khoảng ngày</span>
        <div>
          <CalendarDays size={16} />
          <input type="date" value={filters.from} onChange={(event) => update('from', event.target.value)} />
          <small>-</small>
          <input type="date" value={filters.to} onChange={(event) => update('to', event.target.value)} />
        </div>
      </label>
    </section>
  );
}

function SideGuide({ mode }) {
  const config = PAYMENT_CONFIG[mode] || PAYMENT_CONFIG['payments-collect'];
  const icons = [FileText, ListChecks, Banknote, CreditCard, Clock3];
  return (
    <aside className="reception-payment-guide">
      <h2>{config.sideTitle}</h2>
      {config.sideItems.map(([title, body], index) => {
        const Icon = icons[index % icons.length];
        return (
          <div key={title} className="reception-payment-guide__item">
            <span><Icon size={20} /></span>
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        );
      })}
      <div className="reception-payment-support">
        <span> Cần hỗ trợ?</span>
        <strong>Liên hệ IT hỗ trợ: 1900 1234</strong>
      </div>
    </aside>
  );
}

function InvoiceTable({ rows = [], onCreatePayment }) {
  return (
    <section className="reception-panel reception-payment-table-panel">
      <table className="reception-payment-table">
        <thead>
          <tr>
            <th>Mã hóa đơn</th>
            <th>Bệnh nhân</th>
            <th>Ngày tạo</th>
            <th>Hạn thanh toán</th>
            <th>Tổng tiền</th>
            <th>Đã thanh toán</th>
            <th>Còn phải trả</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td><a>{item.id}</a></td>
              <td><strong>{item.patient}</strong><span>{item.meta}</span></td>
              <td>{item.created}</td>
              <td><a>{item.due}</a></td>
              <td>{formatMoney(item.total)}</td>
              <td>{formatMoney(item.paid)}</td>
              <td className={item.remain > 0 ? 'is-danger' : 'is-success'}>{formatMoney(item.remain)}</td>
              <td><StatusBadge status={item.status} /></td>
              <td><RowActions onCreatePayment={() => onCreatePayment?.(item)} canPay={item.remain > 0} /></td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan="9" className="reception-payment-empty">Không có dữ liệu thanh toán từ backend.</td></tr>
          ) : null}
        </tbody>
      </table>
      <TableFooter total={rows.length} />
    </section>
  );
}

function PaymentTable({ rows = [] }) {
  return (
    <section className="reception-panel reception-payment-table-panel">
      <table className="reception-payment-table">
        <thead>
          <tr>
            <th>Mã thanh toán</th>
            <th>Mã hóa đơn</th>
            <th>Bệnh nhân</th>
            <th>Ngày thanh toán</th>
            <th>Số tiền</th>
            <th>Phương thức</th>
            <th>Thu ngân</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td><a>{item.id}</a></td>
              <td><a>{item.invoice}</a></td>
              <td><strong>{item.patient}</strong><span>{item.meta}</span></td>
              <td>{item.date}</td>
              <td>{formatMoney(item.amount)}</td>
              <td>{item.method}</td>
              <td>{item.cashier}</td>
              <td><StatusBadge status="paid" /><small>Hoàn tất</small></td>
              <td>--</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan="9" className="reception-payment-empty">Không có giao dịch thanh toán từ backend.</td></tr>
          ) : null}
        </tbody>
      </table>
      <TableFooter total={rows.length} label="giao dịch" />
    </section>
  );
}

function RefundTable({ rows = [] }) {
  return (
    <section className="reception-panel reception-payment-table-panel">
      <table className="reception-payment-table">
        <thead>
          <tr>
            <th>Mã hoàn tiền</th>
            <th>Mã hóa đơn</th>
            <th>Bệnh nhân</th>
            <th>Ngày yêu cầu</th>
            <th>Số tiền</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
            <th>Người xử lý</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td><a>{item.id}</a></td>
              <td>{item.invoice}</td>
              <td><strong>{item.patient}</strong><span>{item.meta}</span></td>
              <td>{item.date}</td>
              <td>{formatMoney(item.amount)}</td>
              <td>{item.reason}</td>
              <td><StatusBadge status={item.status} /></td>
              <td>{item.handler}</td>
              <td>--</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan="9" className="reception-payment-empty">Không có yêu cầu hoàn tiền từ backend.</td></tr>
          ) : null}
        </tbody>
      </table>
      <TableFooter total={rows.length} label="kết quả" />
    </section>
  );
}

function RowActions({ canPay = true, onCreatePayment }) {
  return (
    <div className="reception-payment-row-actions">
      {canPay ? <button type="button" onClick={onCreatePayment}><Plus size={16} /></button> : <span>--</span>}
    </div>
  );
}

function TableFooter({ total, label = 'kết quả' }) {
  const numericTotal = Number(total || 0);
  const visible = Math.min(numericTotal, 8);
  return (
    <div className="reception-payment-table-footer">
      <span>{numericTotal ? `Hiển thị 1 đến ${visible} trong tổng số ${numericTotal}` : 'Hiển thị 0'} {label}</span>
      <div>
        <span>Số dòng / trang</span>
        <select><option>10</option></select>
        <button type="button">‹</button>
        <button type="button" className="is-active">1</button>
        <button type="button">›</button>
      </div>
    </div>
  );
}

function Tabs({ active, setActive, items }) {
  return (
    <div className="reception-payment-tabs">
      {items.map((item) => (
        <button key={item.key} type="button" className={active === item.key ? 'is-active' : ''} onClick={() => setActive(item.key)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function CollectPage({ mode, invoices, onCreatePayment }) {
  const [filters, setFilters] = useState({
    query: '',
    status: '',
    method: '',
    from: '',
    to: '',
  });
  const rows = useMemo(() => {
    const baseRows = mode === 'payments-pending'
      ? invoices.filter((item) => item.status !== 'paid')
      : invoices;
    const keyword = filters.query.trim().toLowerCase();

    return baseRows.filter((item) => {
      const matchesKeyword = !keyword
        || item.id.toLowerCase().includes(keyword)
        || item.patient.toLowerCase().includes(keyword)
        || item.meta.toLowerCase().includes(keyword);
      const matchesStatus = !filters.status || item.status === filters.status;
      const matchesMethod = !filters.method || item.method === filters.method;
      const matchesDate = isDateInRange(item.created, filters.from, filters.to);
      return matchesKeyword && matchesStatus && matchesMethod && matchesDate;
    });
  }, [filters, invoices, mode]);

  return (
    <>
      <PaymentHero mode={mode} onCreatePayment={onCreatePayment} />
      <section className="reception-payment-kpi-grid">
        <KpiCard icon={ReceiptText} label="Tổng hóa đơn" value={invoices.length.toLocaleString('vi-VN')} subtitle="Tất cả hóa đơn" />
        <KpiCard icon={Hourglass} label="Chờ thanh toán" value={invoices.filter((item) => item.status === 'pending').length} subtitle="Đang cần thu" tone="warning" />
        <KpiCard icon={Clock3} label="Quá hạn" value={invoices.filter((item) => item.status === 'overdue').length} subtitle="Cần xử lý sớm" tone="danger" />
        <KpiCard icon={CheckCircle2} label="Đã thanh toán hôm nay" value={invoices.filter((item) => item.status === 'paid').length} subtitle={formatMoney(invoices.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.paid, 0))} tone="success" />
      </section>
      <SearchFilters mode={mode} filters={filters} onChange={setFilters} />
      <InvoiceTable rows={rows} onCreatePayment={onCreatePayment} />
    </>
  );
}

function CompletePage({ payments }) {
  const [active, setActive] = useState('all');
  const [filters, setFilters] = useState({
    query: '',
    method: '',
    cashier: '',
    from: '',
    to: '',
  });
  const rows = useMemo(() => {
    const keyword = filters.query.trim().toLowerCase();
    return payments.filter((item) => {
      const matchesKeyword = !keyword
        || item.id.toLowerCase().includes(keyword)
        || item.invoice.toLowerCase().includes(keyword)
        || item.patient.toLowerCase().includes(keyword);
      const matchesMethod = !filters.method || item.method === filters.method;
      const matchesCashier = !filters.cashier || item.cashier.toLowerCase().includes(filters.cashier.toLowerCase());
      const matchesDate = isDateInRange(item.date, filters.from, filters.to);
      return matchesKeyword && matchesMethod && matchesCashier && matchesDate;
    });
  }, [filters, payments]);

  return (
    <>
      <PaymentHero mode="payments-complete" />
      <section className="reception-payment-kpi-grid">
        <KpiCard icon={ReceiptText} label="Tổng giao dịch" value={payments.length.toLocaleString('vi-VN')} subtitle="giao dịch" />
        <KpiCard icon={Banknote} label="Tổng tiền đã thu" value={formatMoney(payments.reduce((sum, item) => sum + item.amount, 0))} subtitle="VND" tone="success" />
        <KpiCard icon={WalletCards} label="Tiền mặt" value={formatMoney(payments.filter((item) => item.method === 'Tiền mặt').reduce((sum, item) => sum + item.amount, 0))} subtitle="Theo bộ dữ liệu hiện tại" tone="warning" />
        <KpiCard icon={CreditCard} label="Chuyển khoản / thẻ" value={formatMoney(payments.filter((item) => item.method !== 'Tiền mặt').reduce((sum, item) => sum + item.amount, 0))} subtitle="Theo bộ dữ liệu hiện tại" tone="violet" />
      </section>
      <Tabs active={active} setActive={setActive} items={[
        { key: 'all', label: 'Tất cả' },
        { key: 'today', label: 'Hôm nay' },
        { key: '7d', label: '7 ngày qua' },
        { key: '30d', label: '30 ngày qua' },
      ]} />
      <SearchFilters mode="payments-complete" filters={filters} onChange={setFilters} />
      <PaymentTable rows={rows} />
    </>
  );
}

function RefundPage({ refunds }) {
  const [active, setActive] = useState('all');
  const [filters, setFilters] = useState({
    query: '',
    reason: '',
    from: '',
    to: '',
  });
  const rows = useMemo(() => {
    const keyword = filters.query.trim().toLowerCase();
    return refunds.filter((item) => {
      const matchesTab = active === 'all' || item.status === active;
      const matchesKeyword = !keyword
        || item.id.toLowerCase().includes(keyword)
        || item.invoice.toLowerCase().includes(keyword)
        || item.patient.toLowerCase().includes(keyword);
      const matchesReason = !filters.reason || item.reason.toLowerCase().includes(filters.reason.toLowerCase());
      const matchesDate = isDateInRange(item.date, filters.from, filters.to);
      return matchesTab && matchesKeyword && matchesReason && matchesDate;
    });
  }, [active, filters, refunds]);

  return (
    <>
      <PaymentHero mode="payments-refund" />
      <section className="reception-payment-kpi-grid">
        <KpiCard icon={RefreshCw} label="Yêu cầu đang xử lý" value={refunds.filter((item) => item.status === 'processing').length} subtitle="Theo dữ liệu hệ thống" />
        <KpiCard icon={CheckCircle2} label="Đã hoàn tiền" value={refunds.filter((item) => item.status === 'refunded').length} subtitle={formatMoney(refunds.filter((item) => item.status === 'refunded').reduce((sum, item) => sum + item.amount, 0))} tone="success" />
        <KpiCard icon={XCircle} label="Đã hủy" value={refunds.filter((item) => item.status === 'cancelled').length} subtitle="Theo dữ liệu hệ thống" tone="danger" />
        <KpiCard icon={WalletCards} label="Tổng tiền hoàn" value={formatMoney(refunds.reduce((sum, item) => sum + item.amount, 0))} subtitle="Trong khoảng đã chọn" tone="warning" />
      </section>
      <Tabs active={active} setActive={setActive} items={[
        { key: 'all', label: 'Tất cả' },
        { key: 'processing', label: 'Đang xử lý' },
        { key: 'refunded', label: 'Đã hoàn tiền' },
        { key: 'cancelled', label: 'Đã hủy' },
      ]} />
      <SearchFilters mode="payments-refund" filters={filters} onChange={setFilters} />
      <RefundTable rows={rows} />
    </>
  );
}

function CreatePaymentModal({ invoices, invoiceId, onClose, onSubmit }) {
  const payableInvoices = invoices.filter((item) => item.remain > 0);
  const initialInvoice = payableInvoices.find((item) => item.id === invoiceId) || payableInvoices[0] || null;
  const [form, setForm] = useState({
    invoiceId: initialInvoice?.id || '',
    amount: initialInvoice?.remain || 0,
    method: 'Tiền mặt',
    note: '',
  });

  const selectedInvoice = invoices.find((item) => item.id === form.invoiceId) || null;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleInvoiceChange(value) {
    const invoice = invoices.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      invoiceId: value,
      amount: invoice?.remain || 0,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!selectedInvoice || !amount || amount <= 0) return;
    onSubmit({
      ...form,
      amount: Math.min(amount, selectedInvoice.remain),
      invoice: selectedInvoice,
    });
  }

  return (
    <div className="reception-payment-modal-backdrop" role="presentation">
      <section className="reception-payment-modal" role="dialog" aria-modal="true" aria-label="Tạo thanh toán">
        <header>
          <div>
            <span>Tạo thanh toán</span>
            <h2>Ghi nhận thanh toán hóa đơn</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng">×</button>
        </header>

        <form onSubmit={handleSubmit} className="reception-payment-modal__form">
          <label>
            <span>Hóa đơn</span>
            <select value={form.invoiceId} onChange={(event) => handleInvoiceChange(event.target.value)} required>
              {payableInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.id} - {invoice.patient} - còn {formatMoney(invoice.remain)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Số tiền thanh toán</span>
            <input
              type="number"
              min="1"
              max={selectedInvoice?.remain || undefined}
              value={form.amount}
              onChange={(event) => update('amount', event.target.value)}
              required
            />
          </label>
          <label>
            <span>Phương thức thanh toán</span>
            <select value={form.method} onChange={(event) => update('method', event.target.value)}>
              <option>Tiền mặt</option>
              <option>Chuyển khoản</option>
              <option>Thẻ ATM</option>
              <option>Thẻ tín dụng</option>
            </select>
          </label>
          <label className="is-span-2">
            <span>Ghi chú</span>
            <textarea value={form.note} onChange={(event) => update('note', event.target.value)} placeholder="Ghi chú thanh toán nếu có..." />
          </label>

          {selectedInvoice ? (
            <div className="reception-payment-modal__summary is-span-2">
              <div><span>Bệnh nhân</span><strong>{selectedInvoice.patient}</strong></div>
              <div><span>Tổng hóa đơn</span><strong>{formatMoney(selectedInvoice.total)}</strong></div>
              <div><span>Đã thanh toán</span><strong>{formatMoney(selectedInvoice.paid)}</strong></div>
              <div><span>Còn phải trả</span><strong>{formatMoney(selectedInvoice.remain)}</strong></div>
            </div>
          ) : null}

          <footer className="is-span-2">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={onClose}>Hủy</button>
            <button type="submit" className="reception-btn reception-btn--primary" disabled={!selectedInvoice}>
              <Plus size={16} />
              <span>Lưu thanh toán</span>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ReceptionBillingHero({ title, subtitle, icon: Icon = CreditCard, actions }) {
  return (
    <section className="reception-payment-hero">
      <div>
        <span className="reception-appointment-eyebrow">
          <Icon size={16} />
          Reception billing
        </span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="reception-payment-actions">{actions}</div> : null}
    </section>
  );
}

function BillingPatientButton({ item, onSelectPatient }) {
  return (
    <button
      type="button"
      className="reception-inline-link"
      disabled={!getPatientId(item)}
      onClick={() => onSelectPatient?.({
        patient_id: getPatientId(item),
        full_name: getPatientLabel(item),
        phone: getPatientPhone(item),
      })}
    >
      {getPatientLabel(item)}
    </button>
  );
}

function InvoiceDetailDrawer({ state, onClose, onCreateQr, onPrintGuide, onRouteCashier }) {
  if (!state.loading && !state.error && !state.invoice) return null;
  const invoice = state.invoice?.invoice || state.invoice || {};
  const items = safeArray(state.invoice?.items || state.invoice?.invoice_items || invoice.items);
  const intents = safeArray(state.invoice?.payment_intents || state.invoice?.paymentIntents || invoice.payment_intents);
  const payments = safeArray(state.invoice?.payments || invoice.payments);
  return (
    <aside className="reception-appointment-drawer" aria-label="Chi tiết hóa đơn">
      <div className="reception-appointment-drawer__header">
        <div>
          <span>Invoice detail</span>
          <h3>{invoice.invoice_no || getInvoiceNo(invoice)}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng">
          <XCircle size={20} />
        </button>
      </div>
      {state.loading ? <div className="reception-appointment-loading"><Clock3 size={18} /><span>Đang tải hóa đơn...</span></div> : null}
      <InlineBillingError message={state.error} />
      {invoice ? (
        <>
          <div className="reception-detail-grid">
            <div><span>Bệnh nhân</span><strong>{getPatientLabel(invoice)}</strong></div>
            <div><span>Tổng tiền</span><strong>{formatMoney(invoice.total_amount)}</strong></div>
            <div><span>Đã thanh toán</span><strong>{formatMoney(invoice.paid_amount)}</strong></div>
            <div><span>Còn phải thu</span><strong>{formatMoney(getBalanceDue(invoice))}</strong></div>
            <div><span>Trạng thái</span><strong>{invoice.status || '--'}</strong></div>
            <div><span>Hạn thanh toán</span><strong>{formatDate(invoice.due_at || invoice.due_date)}</strong></div>
          </div>
          <div className="reception-detail-actions">
            <button type="button" className="reception-btn reception-btn--primary" onClick={() => onCreateQr?.(invoice)}>
              <CreditCard size={16} />
              <span>Tạo QR</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onPrintGuide?.(invoice)}>
              <Printer size={16} />
              <span>In hướng dẫn</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onRouteCashier?.(invoice)}>
              <Send size={16} />
              <span>Chuyển thu ngân</span>
            </button>
          </div>
          <section className="reception-detail-timeline">
            <h4>Dòng dịch vụ</h4>
            {items.map((item, index) => (
              <div key={item.invoice_item_id || item._id || index} className="reception-detail-timeline__item">
                <span>{item.service_name || item.description || item.name || `Item ${index + 1}`}</span>
                <strong>{formatMoney(item.line_total || item.amount || item.total_amount)}</strong>
                <small>SL {item.quantity || 1}</small>
              </div>
            ))}
            {!items.length ? <div className="reception-empty-panel reception-empty-panel--compact">Backend không trả dòng dịch vụ trong payload này.</div> : null}
          </section>
          <section className="reception-detail-timeline">
            <h4>Payment intents</h4>
            {intents.map((intent) => (
              <div key={getIntentId(intent)} className="reception-detail-timeline__item">
                <span>{getIntentCode(intent)}</span>
                <strong>{formatMoney(intent.amount)}</strong>
                <small>{intent.provider || '--'} · {intent.status || '--'}</small>
              </div>
            ))}
            {!intents.length ? <div className="reception-empty-panel reception-empty-panel--compact">Chưa có intent kèm hóa đơn.</div> : null}
          </section>
          <section className="reception-detail-timeline">
            <h4>Payments</h4>
            {payments.map((payment) => (
              <div key={getPaymentId(payment)} className="reception-detail-timeline__item">
                <span>{payment.payment_no || getPaymentId(payment)}</span>
                <strong>{formatMoney(payment.amount)}</strong>
                <small>{payment.payment_method || '--'} · {payment.status || '--'}</small>
              </div>
            ))}
            {!payments.length ? <div className="reception-empty-panel reception-empty-panel--compact">Chưa có payment kèm hóa đơn.</div> : null}
          </section>
        </>
      ) : null}
    </aside>
  );
}

function UnpaidInvoicesPanel({ onSelectPatient }) {
  const [filters, setFilters] = useState({ q: '', status: '', limit: 100 });
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [drawer, setDrawer] = useState({ loading: false, error: '', invoice: null });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadInvoices() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const params = { limit: filters.limit, status: filters.status, q: filters.q || undefined };
        const data = await receptionDataApi.listCashierUnpaidInvoices(params).catch(() => receptionDataApi.listInvoices({
          ...params,
          status: filters.status || 'draft,issued,partially_paid',
        }));
        if (!mounted) return;
        const items = safeArray(data?.items).filter((item) => getBalanceDue(item) > 0);
        setState({ loading: false, error: '', items });
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tải được hóa đơn chờ thu.', items: [] });
      }
    }
    loadInvoices();
    return () => {
      mounted = false;
    };
  }, [filters.q, filters.status, filters.limit, refreshToken]);

  async function openInvoice(invoice) {
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId) return;
    setDrawer({ loading: true, error: '', invoice: null });
    try {
      const detail = await receptionDataApi.getInvoiceDetail(invoiceId);
      setDrawer({ loading: false, error: '', invoice: detail });
    } catch (error) {
      setDrawer({ loading: false, error: error?.payload?.message || error?.message || 'Không tải được chi tiết hóa đơn.', invoice: null });
    }
  }

  async function createQr(invoice) {
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId) return;
    setBusy(`qr:${invoiceId}`);
    try {
      await receptionDataApi.createPaymentIntent(invoiceId, {
        provider: 'bank_qr_manual',
        method: 'qr_manual',
        amount: getBalanceDue(invoice),
      });
      setNotice(`Đã tạo hoặc lấy lại QR payment intent cho ${getInvoiceNo(invoice)}.`);
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không tạo được QR thanh toán.');
    } finally {
      setBusy('');
    }
  }

  async function printGuide(invoice) {
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId) return;
    setBusy(`print:${invoiceId}`);
    try {
      await receptionDataApi.printPaymentGuide(invoiceId, { source_page: 'reception_unpaid_invoices' });
      setNotice(`Đã ghi nhận lệnh in hướng dẫn thanh toán cho ${getInvoiceNo(invoice)}.`);
      window.print();
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không in được hướng dẫn thanh toán.');
    } finally {
      setBusy('');
    }
  }

  async function routeCashier(invoice) {
    const patientId = getPatientId(invoice);
    if (!patientId) {
      window.alert('Invoice không có patient_id để chuyển thu ngân.');
      return;
    }
    const reason = window.prompt('Lý do chuyển sang thu ngân:', 'Hỗ trợ thanh toán hóa đơn tại quầy');
    if (reason === null) return;
    const invoiceId = getInvoiceId(invoice);
    setBusy(`route:${invoiceId}`);
    try {
      await receptionDataApi.routeToCashier({
        patient_id: patientId,
        invoice_id: invoiceId,
        invoice_ids: [invoiceId],
        reason,
        priority: 'normal',
      });
      setNotice(`Đã chuyển ${getPatientLabel(invoice)} sang thu ngân.`);
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không chuyển được sang thu ngân.');
    } finally {
      setBusy('');
    }
  }

  const totalDue = state.items.reduce((sum, item) => sum + getBalanceDue(item), 0);
  const overdue = state.items.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now()).length;
  const partial = state.items.filter((item) => item.status === 'partially_paid' || Number(item.paid_amount || 0) > 0).length;

  return (
    <section className="reception-payment-page">
      <ReceptionBillingHero
        title="Hóa đơn chờ thu"
        subtitle="Danh sách hóa đơn còn balance_due để lễ tân hướng dẫn QR, in phiếu hoặc chuyển sang thu ngân."
        icon={ReceiptText}
        actions={(
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}>
            <RefreshCw size={16} />
            <span>Làm mới</span>
          </button>
        )}
      />
      <InlineBillingSuccess message={notice} />
      <InlineBillingError message={state.error} />
      <section className="reception-payment-kpi-grid">
        <KpiCard icon={ReceiptText} label="Hóa đơn chờ thu" value={state.items.length.toLocaleString('vi-VN')} subtitle="invoice còn nợ" />
        <KpiCard icon={Banknote} label="Tổng còn phải thu" value={formatMoney(totalDue)} subtitle="VND" tone="danger" />
        <KpiCard icon={Hourglass} label="Quá hạn" value={overdue.toLocaleString('vi-VN')} subtitle="theo due_at" tone="warning" />
        <KpiCard icon={WalletCards} label="Thanh toán một phần" value={partial.toLocaleString('vi-VN')} subtitle="partial paid" tone="info" />
      </section>
      <section className="reception-payment-filters">
        <label className="is-wide">
          <span>Tìm kiếm</span>
          <div>
            <Search size={16} />
            <input value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Tên / SĐT / mã BN / mã hóa đơn" />
          </div>
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="partially_paid">Partially paid</option>
          </select>
        </label>
      </section>
      {state.loading ? <div className="reception-appointment-loading"><Clock3 size={18} /><span>Đang tải hóa đơn...</span></div> : null}
      <section className="reception-panel reception-payment-table-panel">
        <table className="reception-payment-table">
          <thead>
            <tr>
              <th>Mã hóa đơn</th>
              <th>Bệnh nhân</th>
              <th>SĐT</th>
              <th>Tổng tiền</th>
              <th>Đã thanh toán</th>
              <th>Còn phải thu</th>
              <th>Trạng thái</th>
              <th>Hạn thanh toán</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {state.items.map((invoice) => {
              const invoiceId = getInvoiceId(invoice);
              const rowBusy = busy.endsWith(`:${invoiceId}`);
              return (
                <tr key={invoiceId}>
                  <td><strong>{getInvoiceNo(invoice)}</strong></td>
                  <td><BillingPatientButton item={invoice} onSelectPatient={onSelectPatient} /></td>
                  <td>{getPatientPhone(invoice)}</td>
                  <td>{formatMoney(invoice.total_amount)}</td>
                  <td>{formatMoney(invoice.paid_amount)}</td>
                  <td>{formatMoney(getBalanceDue(invoice))}</td>
                  <td><BillingBadge status={invoice.status} /></td>
                  <td>{formatDate(invoice.due_at || invoice.due_date)}</td>
                  <td>
                    <div className="reception-payment-row-actions">
                      <button type="button" disabled={rowBusy} onClick={() => openInvoice(invoice)}>Xem</button>
                      <button type="button" disabled={rowBusy} onClick={() => createQr(invoice)}>Tạo QR</button>
                      <button type="button" disabled={rowBusy} onClick={() => printGuide(invoice)}>In HD</button>
                      <button type="button" disabled={rowBusy} onClick={() => routeCashier(invoice)}>Thu ngân</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!state.items.length ? <tr><td colSpan="9" className="reception-payment-empty">Không có hóa đơn chờ thu từ backend.</td></tr> : null}
          </tbody>
        </table>
      </section>
      <InvoiceDetailDrawer
        state={drawer}
        onClose={() => setDrawer({ loading: false, error: '', invoice: null })}
        onCreateQr={createQr}
        onPrintGuide={printGuide}
        onRouteCashier={routeCashier}
      />
    </section>
  );
}

function PaymentStatusPanel({ onSelectPatient }) {
  const [tab, setTab] = useState('invoice');
  const [state, setState] = useState({ loading: true, error: '', invoices: [], intents: [], payments: [] });
  const [providerStatus, setProviderStatus] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const [invoicesData, intentsData, paymentsData] = await Promise.all([
          receptionDataApi.listInvoices({ limit: 100 }),
          receptionDataApi.listPaymentIntents({ limit: 100 }).catch(() => ({ items: [] })),
          receptionDataApi.listPayments({ limit: 100 }).catch(() => ({ items: [] })),
        ]);
        if (!mounted) return;
        setState({
          loading: false,
          error: '',
          invoices: safeArray(invoicesData?.items),
          intents: safeArray(intentsData?.items),
          payments: safeArray(paymentsData?.items),
        });
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tải được trạng thái thanh toán.', invoices: [], intents: [], payments: [] });
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  async function checkProvider(intent) {
    const intentId = getIntentId(intent);
    if (!intentId) return;
    try {
      const data = await receptionDataApi.getPaymentIntentProviderStatus(intentId);
      setProviderStatus(data);
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không kiểm tra được provider.');
    }
  }

  const unpaidTotal = state.invoices.reduce((sum, item) => sum + getBalanceDue(item), 0);
  const pendingIntents = state.intents.filter((item) => ['created', 'pending', 'pending_manual_confirmation', 'submitted_receipt'].includes(item.status)).length;
  const reviewCount = state.intents.filter((item) => item.status === 'manual_review' || item.review_status === 'open').length;

  return (
    <section className="reception-payment-page">
      <ReceptionBillingHero
        title="Trạng thái thanh toán"
        subtitle="Tra nhanh theo hóa đơn, payment intent và payment đã ghi nhận."
        icon={CreditCard}
        actions={<button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}><RefreshCw size={16} /><span>Làm mới</span></button>}
      />
      <InlineBillingError message={state.error} />
      <section className="reception-payment-kpi-grid">
        <KpiCard icon={ReceiptText} label="Invoice mở" value={state.invoices.filter((item) => getBalanceDue(item) > 0).length.toLocaleString('vi-VN')} subtitle={formatMoney(unpaidTotal)} tone="danger" />
        <KpiCard icon={Hourglass} label="Intent pending" value={pendingIntents.toLocaleString('vi-VN')} subtitle="created/pending" tone="warning" />
        <KpiCard icon={ListChecks} label="Manual review" value={reviewCount.toLocaleString('vi-VN')} subtitle="cần đối soát" tone="info" />
        <KpiCard icon={Banknote} label="Payment records" value={state.payments.length.toLocaleString('vi-VN')} subtitle="đã ghi nhận" tone="success" />
      </section>
      <div className="reception-payment-tabs">
        {[
          ['invoice', 'Theo hóa đơn'],
          ['intent', 'Theo payment intent'],
          ['payment', 'Theo payment'],
        ].map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {state.loading ? <div className="reception-appointment-loading"><Clock3 size={18} /><span>Đang tải trạng thái...</span></div> : null}
      {providerStatus ? (
        <InlineBillingSuccess message={`Provider status: ${providerStatus.status || providerStatus.provider_status || JSON.stringify(providerStatus).slice(0, 120)}`} />
      ) : null}
      <section className="reception-panel reception-payment-table-panel">
        {tab === 'invoice' ? (
          <table className="reception-payment-table">
            <thead><tr><th>Invoice</th><th>Bệnh nhân</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody>
              {state.invoices.map((invoice) => (
                <tr key={getInvoiceId(invoice)}>
                  <td>{getInvoiceNo(invoice)}</td>
                  <td><BillingPatientButton item={invoice} onSelectPatient={onSelectPatient} /></td>
                  <td>{formatMoney(invoice.total_amount)}</td>
                  <td>{formatMoney(invoice.paid_amount)}</td>
                  <td>{formatMoney(getBalanceDue(invoice))}</td>
                  <td><BillingBadge status={invoice.status} /></td>
                  <td>{formatDateTime(invoice.updated_at || invoice.issued_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {tab === 'intent' ? (
          <table className="reception-payment-table">
            <thead><tr><th>Intent</th><th>Invoice</th><th>Bệnh nhân</th><th>Provider</th><th>Amount</th><th>Status</th><th>Review</th><th>Action</th></tr></thead>
            <tbody>
              {state.intents.map((intent) => (
                <tr key={getIntentId(intent)}>
                  <td>{getIntentCode(intent)}</td>
                  <td>{intent.invoice_id?.invoice_no || intent.invoice_no || getInvoiceNo(intent.invoice_id)}</td>
                  <td><BillingPatientButton item={intent} onSelectPatient={onSelectPatient} /></td>
                  <td>{intent.provider || '--'}</td>
                  <td>{formatMoney(intent.amount)}</td>
                  <td><BillingBadge status={intent.status} /></td>
                  <td><BillingBadge status={intent.review_status || 'open'} /></td>
                  <td><button type="button" className="reception-btn reception-btn--ghost" onClick={() => checkProvider(intent)}>Provider</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {tab === 'payment' ? (
          <table className="reception-payment-table">
            <thead><tr><th>Payment</th><th>Invoice</th><th>Bệnh nhân</th><th>Method</th><th>Amount</th><th>Status</th><th>Paid at</th></tr></thead>
            <tbody>
              {state.payments.map((payment) => (
                <tr key={getPaymentId(payment)}>
                  <td>{payment.payment_no || getPaymentId(payment)}</td>
                  <td>{payment.invoice_id?.invoice_no || payment.invoice_no || '--'}</td>
                  <td><BillingPatientButton item={payment} onSelectPatient={onSelectPatient} /></td>
                  <td>{payment.payment_method || '--'}</td>
                  <td>{formatMoney(payment.amount)}</td>
                  <td><BillingBadge status={payment.status} /></td>
                  <td>{formatDateTime(payment.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </section>
  );
}

function QrGuidePanel({ onSelectPatient }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: '', invoices: [] });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [intent, setIntent] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadInvoices() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const data = query.trim()
          ? await receptionDataApi.searchCashierBilling({ q: query.trim(), limit: 30 }).catch(() => receptionDataApi.listCashierUnpaidInvoices({ q: query.trim(), limit: 30 }))
          : await receptionDataApi.listCashierUnpaidInvoices({ limit: 50 });
        if (!mounted) return;
        setState({ loading: false, error: '', invoices: safeArray(data?.items).filter((item) => getBalanceDue(item) > 0) });
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tìm được hóa đơn.', invoices: [] });
      }
    }
    loadInvoices();
    return () => {
      mounted = false;
    };
  }, [query]);

  async function createQr(invoice = selectedInvoice, forceNew = false) {
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId) return;
    setBusy(true);
    try {
      const data = await receptionDataApi.createPaymentIntent(invoiceId, {
        provider: 'bank_qr_manual',
        method: 'qr_manual',
        amount: getBalanceDue(invoice),
        force_new: forceNew,
      });
      setIntent(data?.payment_intent || data);
      setSelectedInvoice(invoice);
      setNotice(forceNew ? 'Đã tạo lại QR mới.' : 'Đã tạo hoặc lấy QR thanh toán hiện hành.');
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không tạo được QR.');
    } finally {
      setBusy(false);
    }
  }

  async function printGuide() {
    const invoiceId = getInvoiceId(selectedInvoice);
    if (!invoiceId) return;
    setBusy(true);
    try {
      await receptionDataApi.printPaymentGuide(invoiceId, { payment_intent_id: getIntentId(intent), source_page: 'reception_qr_guide' });
      setNotice('Đã ghi nhận lệnh in hướng dẫn QR.');
      window.print();
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không in được hướng dẫn QR.');
    } finally {
      setBusy(false);
    }
  }

  async function checkPaid() {
    if (!intent) return;
    setBusy(true);
    try {
      const data = await receptionDataApi.getPaymentIntentProviderStatus(getIntentId(intent));
      setNotice(`Provider status: ${data?.status || data?.provider_status || 'đã truy vấn'}`);
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không kiểm tra được trạng thái.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="reception-payment-page">
      <ReceptionBillingHero title="Hướng dẫn QR thanh toán" subtitle="Chọn invoice, tạo QR payment intent, in hướng dẫn và kiểm tra trạng thái provider." icon={CreditCard} />
      <InlineBillingError message={state.error} />
      <InlineBillingSuccess message={notice} />
      <div className="reception-payment-layout">
        <main className="reception-payment-content">
          <section className="reception-payment-filters">
            <label className="is-wide">
              <span>Tìm hóa đơn / bệnh nhân</span>
              <div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên / SĐT / mã BN / invoice no" /></div>
            </label>
          </section>
          <section className="reception-panel reception-payment-table-panel">
            <table className="reception-payment-table">
              <thead><tr><th>Invoice</th><th>Bệnh nhân</th><th>Còn phải thu</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {state.invoices.map((invoice) => (
                  <tr key={getInvoiceId(invoice)}>
                    <td>{getInvoiceNo(invoice)}</td>
                    <td><BillingPatientButton item={invoice} onSelectPatient={onSelectPatient} /></td>
                    <td>{formatMoney(getBalanceDue(invoice))}</td>
                    <td><BillingBadge status={invoice.status} /></td>
                    <td><button type="button" className="reception-btn reception-btn--primary" disabled={busy} onClick={() => createQr(invoice)}>Tạo QR</button></td>
                  </tr>
                ))}
                {!state.invoices.length ? <tr><td colSpan="5" className="reception-payment-empty">Không có invoice còn phải thu.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </main>
        <aside className="reception-payment-guide">
          <h3>QR payment guide</h3>
          {selectedInvoice ? (
            <>
              <div className="reception-detail-grid">
                <div><span>Invoice</span><strong>{getInvoiceNo(selectedInvoice)}</strong></div>
                <div><span>Bệnh nhân</span><strong>{getPatientLabel(selectedInvoice)}</strong></div>
                <div><span>Số tiền</span><strong>{formatMoney(intent?.amount || getBalanceDue(selectedInvoice))}</strong></div>
                <div><span>Intent</span><strong>{intent ? getIntentCode(intent) : '--'}</strong></div>
                <div><span>Ngân hàng</span><strong>{intent?.receiver_bank_bin || '--'}</strong></div>
                <div><span>Số TK</span><strong>{intent?.receiver_account_no || '--'}</strong></div>
                <div><span>Chủ TK</span><strong>{intent?.receiver_account_name || '--'}</strong></div>
                <div><span>Hết hạn</span><strong>{formatDateTime(intent?.expires_at)}</strong></div>
              </div>
              <div className="reception-receipt-preview__qr">
                {intent?.qr_image_url ? <img src={intent.qr_image_url} alt="QR thanh toán" /> : <span>{intent?.qr_payload || intent?.payment_note || getIntentCode(intent)}</span>}
              </div>
              <div className="reception-payment-row-actions">
                <button type="button" disabled={busy} onClick={() => createQr(selectedInvoice, true)}>Tạo lại QR</button>
                <button type="button" disabled={busy || !intent} onClick={printGuide}>In hướng dẫn</button>
                <button type="button" disabled={busy || !intent} onClick={checkPaid}>Kiểm tra đã thanh toán</button>
              </div>
            </>
          ) : (
            <div className="reception-payment-support">
              <strong>Chưa chọn hóa đơn</strong>
              <p>Chọn một invoice còn nợ để tạo QR và hướng dẫn bệnh nhân thanh toán.</p>
            </div>
          )}
          <div className="reception-payment-support">
            <strong>Hướng dẫn bệnh nhân</strong>
            <p>Mở app ngân hàng, quét QR, kiểm tra đúng số tiền, không sửa nội dung chuyển khoản, giữ lại biên lai nếu cần đối soát.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function PaymentReviewPanel({ onSelectPatient }) {
  const [filters, setFilters] = useState({ status: '', limit: 100 });
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadReviews() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const data = await receptionDataApi.listCashierManualPayments(filters).catch(() => receptionDataApi.listManualPayments(filters));
        if (!mounted) return;
        setState({ loading: false, error: '', items: safeArray(data?.items) });
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tải được payment review.', items: [] });
      }
    }
    loadReviews();
    return () => {
      mounted = false;
    };
  }, [filters.status, filters.limit, refreshToken]);

  async function runReviewAction(type, item) {
    const intentId = getIntentId(item);
    if (!intentId) return;
    setBusy(`${type}:${intentId}`);
    try {
      if (type === 'provider') {
        const data = await receptionDataApi.getPaymentIntentProviderStatus(intentId);
        setNotice(`Provider status: ${data?.status || data?.provider_status || 'đã truy vấn'}`);
      }
      if (type === 'review') {
        const reason = window.prompt('Lý do đưa vào manual review:', item.mismatch_type || 'Cần thu ngân kiểm tra');
        if (reason === null) return;
        await receptionDataApi.markPaymentIntentManualReview(intentId, { reason });
        setNotice('Đã đưa payment vào manual review.');
      }
      if (type === 'confirm') {
        const confirmed = window.confirm('Xác nhận payment này? Chỉ thực hiện nếu tài khoản có quyền tài chính phù hợp.');
        if (!confirmed) return;
        await receptionDataApi.confirmBankTransfer(intentId, {
          received_amount: item.received_amount || item.amount,
          transaction_reference: item.transaction_reference,
        });
        setNotice('Đã xác nhận payment.');
      }
      if (type === 'reject') {
        const reason = window.prompt('Lý do từ chối payment:');
        if (reason === null) return;
        await receptionDataApi.rejectBankTransfer(intentId, { reason });
        setNotice('Đã từ chối payment.');
      }
      setRefreshToken((current) => current + 1);
    } catch (error) {
      window.alert(error?.payload?.message || error?.message || 'Không xử lý được payment review.');
    } finally {
      setBusy('');
    }
  }

  const mismatch = state.items.filter((item) => item.mismatch_type).length;
  const shortPaid = state.items.filter((item) => Number(item.difference_amount || 0) < 0).length;
  const overPaid = state.items.filter((item) => Number(item.difference_amount || 0) > 0).length;

  return (
    <section className="reception-payment-page">
      <ReceptionBillingHero title="Payment cần xác nhận" subtitle="Review queue cho bank transfer/manual receipt; thao tác confirm/reject phụ thuộc quyền tài chính." icon={ListChecks} actions={<button type="button" className="reception-btn reception-btn--ghost" onClick={() => setRefreshToken((current) => current + 1)}><RefreshCw size={16} /><span>Làm mới</span></button>} />
      <InlineBillingError message={state.error} />
      <InlineBillingSuccess message={notice} />
      <section className="reception-payment-kpi-grid">
        <KpiCard icon={ListChecks} label="Cần xác nhận" value={state.items.length.toLocaleString('vi-VN')} subtitle="manual payments" tone="warning" />
        <KpiCard icon={XCircle} label="Mismatch" value={mismatch.toLocaleString('vi-VN')} subtitle="sai nội dung/số tiền" tone="danger" />
        <KpiCard icon={Hourglass} label="Chuyển thiếu" value={shortPaid.toLocaleString('vi-VN')} subtitle="difference < 0" tone="danger" />
        <KpiCard icon={Banknote} label="Chuyển dư" value={overPaid.toLocaleString('vi-VN')} subtitle="difference > 0" tone="info" />
      </section>
      <section className="reception-payment-filters">
        <label>
          <span>Status</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="pending_manual_confirmation">Pending manual</option>
            <option value="submitted_receipt">Submitted receipt</option>
            <option value="manual_review">Manual review</option>
          </select>
        </label>
      </section>
      {state.loading ? <div className="reception-appointment-loading"><Clock3 size={18} /><span>Đang tải payment review...</span></div> : null}
      <section className="reception-panel reception-payment-table-panel">
        <table className="reception-payment-table">
          <thead><tr><th>Intent</th><th>Bệnh nhân</th><th>Invoice</th><th>Cần thu</th><th>Đã nhận</th><th>Chênh lệch</th><th>Provider</th><th>Review</th><th>Action</th></tr></thead>
          <tbody>
            {state.items.map((item) => {
              const intentId = getIntentId(item);
              const rowBusy = busy.endsWith(`:${intentId}`);
              return (
                <tr key={intentId}>
                  <td>{getIntentCode(item)}</td>
                  <td><BillingPatientButton item={item} onSelectPatient={onSelectPatient} /></td>
                  <td>{item.invoice_id?.invoice_no || item.invoice_no || '--'}</td>
                  <td>{formatMoney(item.expected_amount || item.amount)}</td>
                  <td>{formatMoney(item.received_amount)}</td>
                  <td>{formatMoney(item.difference_amount)}</td>
                  <td>{item.provider || '--'}</td>
                  <td><BillingBadge status={item.review_status || item.status} /></td>
                  <td>
                    <div className="reception-payment-row-actions">
                      <button type="button" disabled={rowBusy} onClick={() => runReviewAction('provider', item)}>Provider</button>
                      <button type="button" disabled={rowBusy} onClick={() => runReviewAction('review', item)}>Review</button>
                      <button type="button" disabled={rowBusy} onClick={() => runReviewAction('confirm', item)}>Confirm</button>
                      <button type="button" disabled={rowBusy} onClick={() => runReviewAction('reject', item)}>Reject</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!state.items.length ? <tr><td colSpan="9" className="reception-payment-empty">Không có payment cần xác nhận.</td></tr> : null}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function CashierRoutingPanel({ onSelectPatient }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: '', items: [] });
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ reason: 'Thu trước/sau khám tại quầy', priority: 'normal', note: '' });
  const [submit, setSubmit] = useState({ loading: false, error: '', success: null });

  useEffect(() => {
    let mounted = true;
    async function loadCandidates() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const data = query.trim()
          ? await receptionDataApi.searchCashierBilling({ q: query.trim(), limit: 30 }).catch(() => receptionDataApi.listCashierUnpaidInvoices({ q: query.trim(), limit: 30 }))
          : await receptionDataApi.listCashierUnpaidInvoices({ limit: 50 });
        if (!mounted) return;
        setState({ loading: false, error: '', items: safeArray(data?.items).filter((item) => getBalanceDue(item) > 0) });
      } catch (error) {
        if (!mounted) return;
        setState({ loading: false, error: error?.payload?.message || error?.message || 'Không tải được danh sách chuyển thu ngân.', items: [] });
      }
    }
    loadCandidates();
    return () => {
      mounted = false;
    };
  }, [query]);

  async function submitRoute(event) {
    event.preventDefault();
    if (!selected || !getPatientId(selected)) {
      setSubmit({ loading: false, error: 'Chọn bệnh nhân/invoice có patient_id.', success: null });
      return;
    }
    setSubmit({ loading: true, error: '', success: null });
    try {
      const invoiceId = getInvoiceId(selected);
      const data = await receptionDataApi.routeToCashier({
        patient_id: getPatientId(selected),
        invoice_id: invoiceId,
        invoice_ids: [invoiceId],
        unpaid_total: getBalanceDue(selected),
        reason: form.reason,
        priority: form.priority,
        note: form.note,
      });
      setSubmit({ loading: false, error: '', success: data });
    } catch (error) {
      setSubmit({ loading: false, error: error?.payload?.message || error?.message || 'Không chuyển được sang thu ngân.', success: null });
    }
  }

  return (
    <section className="reception-payment-page">
      <ReceptionBillingHero title="Chuyển sang thu ngân" subtitle="Chọn bệnh nhân có hóa đơn còn nợ, ghi lý do và route qua /reception/route-to-cashier." icon={Send} />
      <div className="reception-payment-layout">
        <main className="reception-payment-content">
          <section className="reception-payment-filters">
            <label className="is-wide">
              <span>Tìm bệnh nhân / hóa đơn</span>
              <div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên / SĐT / mã BN / invoice" /></div>
            </label>
          </section>
          <InlineBillingError message={state.error} />
          <section className="reception-panel reception-payment-table-panel">
            <table className="reception-payment-table">
              <thead><tr><th>Invoice</th><th>Bệnh nhân</th><th>SĐT</th><th>Còn nợ</th><th>Status</th><th>Chọn</th></tr></thead>
              <tbody>
                {state.items.map((invoice) => (
                  <tr key={getInvoiceId(invoice)}>
                    <td>{getInvoiceNo(invoice)}</td>
                    <td><BillingPatientButton item={invoice} onSelectPatient={onSelectPatient} /></td>
                    <td>{getPatientPhone(invoice)}</td>
                    <td>{formatMoney(getBalanceDue(invoice))}</td>
                    <td><BillingBadge status={invoice.status} /></td>
                    <td><button type="button" className="reception-btn reception-btn--ghost" onClick={() => setSelected(invoice)}>Chọn</button></td>
                  </tr>
                ))}
                {!state.items.length ? <tr><td colSpan="6" className="reception-payment-empty">Không có invoice còn nợ.</td></tr> : null}
              </tbody>
            </table>
          </section>
        </main>
        <form className="reception-payment-guide" onSubmit={submitRoute}>
          <h3>Form chuyển thu ngân</h3>
          {selected ? (
            <div className="reception-detail-grid">
              <div><span>Bệnh nhân</span><strong>{getPatientLabel(selected)}</strong></div>
              <div><span>Invoice</span><strong>{getInvoiceNo(selected)}</strong></div>
              <div><span>Còn nợ</span><strong>{formatMoney(getBalanceDue(selected))}</strong></div>
              <div><span>Status</span><strong>{selected.status || '--'}</strong></div>
            </div>
          ) : <div className="reception-payment-support">Chọn invoice để chuyển sang thu ngân.</div>}
          <label>
            <span>Lý do chuyển</span>
            <select value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}>
              <option value="Thu trước/sau khám tại quầy">Thu trước/sau khám</option>
              <option value="Xác nhận chuyển khoản">Xác nhận chuyển khoản</option>
              <option value="Thanh toán thiếu">Thanh toán thiếu</option>
              <option value="Hỗ trợ QR">Hỗ trợ QR</option>
              <option value="Hoàn tiền / điều chỉnh">Hoàn tiền / điều chỉnh</option>
            </select>
          </label>
          <label>
            <span>Ưu tiên</span>
            <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
              <option value="normal">Bình thường</option>
              <option value="priority">Ưu tiên</option>
              <option value="urgent">Khẩn</option>
            </select>
          </label>
          <label>
            <span>Ghi chú thu ngân</span>
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Ghi chú cho thu ngân..." />
          </label>
          <InlineBillingError message={submit.error} />
          <InlineBillingSuccess message={submit.success ? `Đã chuyển sang thu ngân. Next step: ${submit.success.next_step || 'cashier_workbench'}` : ''} />
          <div className="reception-payment-row-actions">
            <button type="submit" className="reception-btn reception-btn--primary" disabled={submit.loading || !selected}>Chuyển thu ngân</button>
            <button type="button" disabled={!selected} onClick={() => selected && receptionDataApi.printPaymentGuide(getInvoiceId(selected), { source_page: 'cashier_routing' }).then(() => window.print()).catch((error) => window.alert(error?.message || 'Không in được hướng dẫn.'))}>Chuyển + in HD</button>
          </div>
        </form>
      </div>
    </section>
  );
}

export function ReceptionPaymentsPanel({ mode = 'payments-pending', onSelectPatient }) {
  if (mode === 'payments-pending') return <UnpaidInvoicesPanel onSelectPatient={onSelectPatient} />;
  if (mode === 'payments-status' || mode === 'payments-complete') return <PaymentStatusPanel onSelectPatient={onSelectPatient} />;
  if (mode === 'payments-qr-guide') return <QrGuidePanel onSelectPatient={onSelectPatient} />;
  if (mode === 'payments-confirmation') return <PaymentReviewPanel onSelectPatient={onSelectPatient} />;
  if (mode === 'payments-transfer-cashier') return <CashierRoutingPanel onSelectPatient={onSelectPatient} />;

  return <LegacyReceptionPaymentsPanel mode={mode} />;
}

function LegacyReceptionPaymentsPanel({ mode = 'payments-collect' }) {
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadState, setLoadState] = useState({ loading: false, error: '' });
  const [paymentModal, setPaymentModal] = useState({ open: false, invoiceId: '' });

  async function loadBillingData() {
    setLoadState({ loading: true, error: '' });
    try {
      const [invoiceData, paymentData] = await Promise.all([
        receptionDataApi.listInvoices({ limit: 100 }),
        receptionDataApi.listPayments({ limit: 100 }),
      ]);
      setInvoices((invoiceData?.items || []).map(normalizeInvoice));
      setPayments((paymentData?.items || []).map(normalizePayment));
      setLoadState({ loading: false, error: '' });
    } catch (error) {
      setLoadState({
        loading: false,
        error: error?.payload?.message || error?.message || 'Không tải được dữ liệu thanh toán.',
      });
    }
  }

  useEffect(() => {
    loadBillingData();
  }, []);

  function openPaymentModal(invoice) {
    setPaymentModal({ open: true, invoiceId: invoice?.id || '' });
  }

  async function handleCreatePayment(payload) {
    if (!payload.invoice.rawId) return;
    setLoadState({ loading: true, error: '' });
    try {
      await receptionDataApi.createPayment(payload.invoice.rawId, {
        amount: payload.amount,
        payment_method: mapPaymentMethodToApi(payload.method),
        note: payload.note,
      });
      setPaymentModal({ open: false, invoiceId: '' });
      await loadBillingData();
    } catch (error) {
      setLoadState({
        loading: false,
        error: error?.payload?.message || error?.message || 'Không tạo được thanh toán.',
      });
    }
  }

  const refunds = useMemo(() => (
    payments
      .filter((item) => ['refunded', 'voided', 'cancelled'].includes(item.status))
      .map((item) => ({
        id: item.id,
        invoice: item.invoice,
        patient: item.patient,
        meta: item.meta,
        date: item.date,
        amount: item.amount,
        reason: item.reason || 'Hoàn tiền thanh toán',
        status: item.status === 'voided' ? 'cancelled' : item.status,
        handler: item.cashier,
      }))
  ), [payments]);

  return (
    <div className="reception-payment-page">
      {loadState.error ? (
        <div className="reception-appointment-alert is-danger">
          <XCircle size={18} />
          <span>{loadState.error}</span>
        </div>
      ) : null}
      {loadState.loading ? (
        <div className="reception-appointment-loading reception-appointment-loading--inline">
          <Clock3 size={18} />
          <span>Đang tải dữ liệu thanh toán...</span>
        </div>
      ) : null}
      <div className="reception-payment-layout">
        <main className="reception-payment-content">
          {mode === 'payments-complete' ? <CompletePage payments={payments} /> : null}
          {mode === 'payments-refund' ? <RefundPage refunds={refunds} /> : null}
          {mode === 'payments-collect' || mode === 'payments-pending' ? (
            <CollectPage mode={mode} invoices={invoices} onCreatePayment={openPaymentModal} />
          ) : null}
        </main>
        <SideGuide mode={mode} />
      </div>
      {paymentModal.open ? (
        <CreatePaymentModal
          invoices={invoices}
          invoiceId={paymentModal.invoiceId}
          onClose={() => setPaymentModal({ open: false, invoiceId: '' })}
          onSubmit={handleCreatePayment}
        />
      ) : null}
    </div>
  );
}
