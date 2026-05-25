import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Hourglass,
  ListChecks,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
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

export function ReceptionPaymentsPanel({ mode = 'payments-collect' }) {
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
