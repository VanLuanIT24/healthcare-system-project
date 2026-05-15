import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Filter,
  Mail,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { receptionDataApi } from '../api/receptionDataApi';

const MODE_CONFIG = {
  'notifications-all': {
    title: 'Tất cả thông báo',
    subtitle: 'Danh sách toàn bộ thông báo của tôi',
    category: '',
    detailTitle: 'Chi tiết thông báo',
  },
  'notifications-unread': {
    title: 'Chưa đọc',
    subtitle: 'Danh sách thông báo chưa đọc cần xử lý',
    unreadOnly: true,
    detailTitle: 'Xem nhanh',
  },
  'notifications-appointments': {
    title: 'Thông báo lịch hẹn',
    subtitle: 'Thông báo liên quan đến đặt lịch, xác nhận, hủy và nhắc lịch',
    category: 'appointment',
    detailTitle: 'Chi tiết thông báo',
  },
  'notifications-payments': {
    title: 'Thông báo thanh toán',
    subtitle: 'Thông báo liên quan đến hóa đơn, thanh toán và công nợ bệnh nhân',
    category: 'payment',
    detailTitle: 'Chi tiết thông báo đã chọn',
  },
  'notifications-system': {
    title: 'Thông báo hệ thống',
    subtitle: 'Thông báo về bảo trì, cấu hình, quy trình và cập nhật hệ thống',
    category: 'system',
    detailTitle: 'Chi tiết thông báo',
  },
};

const TYPE_META = {
  appointment: { label: 'Lịch hẹn', tone: 'info', icon: CalendarDays },
  payment: { label: 'Thanh toán', tone: 'danger', icon: CreditCard },
  system: { label: 'Hệ thống', tone: 'warning', icon: Settings },
};

const PRIORITY_META = {
  high: { label: 'Cao', tone: 'danger' },
  medium: { label: 'Trung bình', tone: 'warning' },
  low: { label: 'Thấp', tone: 'success' },
  normal: { label: 'Bình thường', tone: 'neutral' },
};

const INITIAL_NOTIFICATIONS = [
  {
    id: 'BN-250514-00123',
    title: 'Nhắc lịch hẹn ngày mai',
    category: 'appointment',
    description: 'Bệnh nhân Nguyễn Văn A có lịch khám Tim mạch vào lúc 08:30 ngày mai 15/05/2026.',
    time: '10:30, 14/05/2026',
    read: false,
    priority: 'normal',
    patient: 'Nguyễn Văn A',
    related: 'Nguyễn Văn A - MS: BN-20260456',
    actionLabel: 'Xem lịch hẹn',
    details: ['Dịch vụ: Khám chuyên khoa Tim mạch', 'Bác sĩ: BS. Lê Minh Tuấn', 'Thời gian: 10:30, 15/05/2026', 'Địa điểm: Phòng khám Tim mạch - Tầng 3'],
  },
  {
    id: 'HD-250514-00876',
    title: 'Hóa đơn chưa thanh toán',
    category: 'payment',
    description: 'Hóa đơn của bệnh nhân Trần Thị B tổng tiền 1.250.000đ chưa được thanh toán.',
    time: '09:15, 14/05/2026',
    read: false,
    priority: 'high',
    patient: 'Trần Thị B',
    related: 'Hóa đơn HD-250514-00876',
    actionLabel: 'Xem chi tiết hóa đơn',
    details: ['Số tiền: 1.250.000đ', 'Trạng thái: Chưa thanh toán', 'Hạn thanh toán: 16/05/2026'],
  },
  {
    id: 'SYS-20260514-01',
    title: 'Bảo trì hệ thống tối nay',
    category: 'system',
    description: 'Hệ thống sẽ bảo trì từ 22:00 - 23:00 ngày 15/05/2026.',
    time: '08:45, 14/05/2026',
    read: false,
    priority: 'high',
    patient: '',
    related: 'Toàn bộ hệ thống MedCare HMS',
    actionLabel: 'Xem tài liệu',
    group: 'Bảo trì',
    details: ['Thời gian bắt đầu: 23:00, Thứ Tư 14/05/2026', 'Thời gian kết thúc dự kiến: 01:00, Thứ Năm 15/05/2026', 'Phạm vi ảnh hưởng: Toàn bộ hệ thống'],
  },
  {
    id: 'BN-250514-00120',
    title: 'Xác nhận lịch hẹn',
    category: 'appointment',
    description: 'Bệnh nhân Lê Thị C đã xác nhận lịch hẹn khám Nội tiết ngày 16/05/2026.',
    time: '08:20, 14/05/2026',
    read: false,
    priority: 'medium',
    patient: 'Lê Thị C',
    related: 'Lịch hẹn',
    actionLabel: 'Xem lịch hẹn',
    details: ['Bệnh nhân đã xác nhận qua SMS', 'Khoa: Nội tiết', 'Thời gian: 09:15, 16/05/2026'],
  },
  {
    id: 'HD-250513-00822',
    title: 'Hóa đơn sắp đến hạn',
    category: 'payment',
    description: 'Hóa đơn của bệnh nhân Phạm Văn D sẽ đến hạn trong 1 ngày với số tiền 850.000đ.',
    time: '16:40, 13/05/2026',
    read: false,
    priority: 'medium',
    patient: 'Phạm Văn D',
    related: 'Hóa đơn HD-250513-00822',
    actionLabel: 'Xem chi tiết hóa đơn',
    details: ['Số tiền còn lại: 850.000đ', 'Hạn thanh toán: 15/05/2026'],
  },
  {
    id: 'POL-20260513-02',
    title: 'Cập nhật quy trình tiếp nhận',
    category: 'system',
    description: 'Quy trình tiếp nhận bệnh nhân mới đã được cập nhật từ ngày 13/05/2026.',
    time: '14:10, 13/05/2026',
    read: true,
    priority: 'medium',
    patient: '',
    related: 'Quy trình lễ tân',
    actionLabel: 'Xem tài liệu',
    group: 'Cập nhật',
    details: ['Áp dụng cho quy trình tiếp nhận ngoại trú', 'Yêu cầu cập nhật checklist tại quầy'],
  },
  {
    id: 'BN-250512-00098',
    title: 'Hủy lịch hẹn',
    category: 'appointment',
    description: 'Bệnh nhân Hoàng Văn E đã hủy lịch hẹn khám Răng Hàm Mặt ngày 14/05/2026.',
    time: '11:20, 12/05/2026',
    read: true,
    priority: 'low',
    patient: 'Hoàng Văn E',
    related: 'Lịch hẹn',
    actionLabel: 'Xem lịch hẹn',
    details: ['Lý do: Bệnh nhân bận việc cá nhân', 'Trạng thái: Đã hủy'],
  },
  {
    id: 'HD-250513-00321',
    title: 'Thanh toán thành công',
    category: 'payment',
    description: 'Hóa đơn của bệnh nhân Lê Minh C đã thanh toán thành công qua chuyển khoản.',
    time: '16:20, 13/05/2026',
    read: true,
    priority: 'low',
    patient: 'Lê Minh C',
    related: 'Hóa đơn HD-250513-00321',
    actionLabel: 'Xem chi tiết hóa đơn',
    details: ['Số tiền: 640.000đ', 'Phương thức: Chuyển khoản', 'Trạng thái: Thành công'],
  },
];

function formatNotificationTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}, ${date.toLocaleDateString('vi-VN')}`;
}

function resolveNotificationCategory(item) {
  const payloadType = item.payload?.entity_type || item.entity_type || '';
  const type = String(item.notification_type || item.type || payloadType || '').toLowerCase();
  if (type.includes('appointment') || payloadType === 'appointment') return 'appointment';
  if (type.includes('payment') || type.includes('invoice') || payloadType === 'invoice') return 'payment';
  return 'system';
}

function normalizeNotification(item) {
  const category = resolveNotificationCategory(item);
  const details = [];
  if (item.payload?.entity_type) details.push(`Liên quan: ${item.payload.entity_type}`);
  if (item.payload?.entity_id) details.push(`Mã liên quan: ${item.payload.entity_id}`);
  if (item.channel) details.push(`Kênh: ${item.channel}`);

  return {
    rawId: item._id || item.id || item.notification_id || '',
    id: item.notification_no || item.code || item._id || item.id || '--',
    title: item.title || item.subject || 'Thông báo',
    category,
    description: item.message || item.description || item.content || 'Không có nội dung mô tả.',
    time: formatNotificationTime(item.created_at || item.sent_at),
    read: Boolean(item.read_at) || item.status === 'read',
    priority: item.priority || 'normal',
    patient: item.payload?.patient_name || item.patient_name || '',
    related: item.payload?.entity_id || item.related || item.payload?.route || '--',
    actionLabel: category === 'appointment' ? 'Xem lịch hẹn' : category === 'payment' ? 'Xem chi tiết hóa đơn' : 'Xem tài liệu',
    group: item.payload?.group || item.notification_type || 'Hệ thống',
    details: details.length ? details : [item.message || item.description || 'Không có nội dung bổ sung.'],
  };
}

function StatusBadge({ read }) {
  return <span className={`reception-status-badge is-${read ? 'success' : 'info'}`}>{read ? 'Đã đọc' : 'Chưa đọc'}</span>;
}

function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.normal;
  return <span className={`reception-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

function TypeBadge({ category }) {
  const meta = TYPE_META[category] || TYPE_META.system;
  return <span className={`reception-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

function NotificationIcon({ category }) {
  const Icon = TYPE_META[category]?.icon || Bell;
  return <span className={`reception-notification-icon is-${category}`}><Icon size={18} /></span>;
}

function baseFilters() {
  return {
    query: '',
    category: '',
    read: '',
    priority: '',
    from: '2026-05-07',
    to: '2026-05-14',
    tab: 'all',
  };
}

function matchesKeyword(item, query) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;
  return [item.title, item.id, item.description, item.patient, item.related]
    .some((value) => String(value || '').toLowerCase().includes(keyword));
}

function NotificationHero({ mode, notifications, onMarkAllRead }) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG['notifications-all'];
  const unread = notifications.filter((item) => !item.read).length;
  const high = notifications.filter((item) => item.priority === 'high').length;
  const appointment = notifications.filter((item) => item.category === 'appointment').length;
  const payment = notifications.filter((item) => item.category === 'payment').length;
  const system = notifications.filter((item) => item.category === 'system').length;

  const cards = mode === 'notifications-payments'
    ? [
      [ReceiptIcon, 'Tổng thông báo thanh toán', payment, 'Tất cả thời gian', 'info'],
      [Mail, 'Chưa đọc', unread, 'Cần bạn xem', 'warning'],
      [AlertTriangle, 'Quá hạn', high, 'Cần xử lý ngay', 'danger'],
      [CheckCircle2, 'Thanh toán thành công', notifications.filter((item) => item.category === 'payment' && item.read).length, 'Đã ghi nhận', 'success'],
    ]
    : mode === 'notifications-system'
      ? [
        [Megaphone, 'Tổng thông báo hệ thống', system, 'Tất cả thời gian', 'info'],
        [Mail, 'Chưa đọc', unread, 'Cần bạn xem', 'warning'],
        [CalendarDays, 'Bảo trì sắp tới', 2, 'Trong 7 ngày tới', 'success'],
        [Settings, 'Cập nhật quy trình', 9, 'Trong 30 ngày', 'violet'],
      ]
      : mode === 'notifications-appointments'
        ? [
          [CalendarDays, 'Tổng lịch hẹn', appointment, 'Tất cả thông báo', 'info'],
          [Mail, 'Chưa đọc', unread, 'Cần bạn xem', 'warning'],
          [CalendarDays, 'Hôm nay', 7, 'Thông báo mới', 'success'],
          [AlertTriangle, 'Cần xác nhận', 4, 'Từ bệnh nhân', 'danger'],
        ]
        : [
          [Bell, mode === 'notifications-unread' ? 'Chưa đọc' : 'Tổng thông báo', mode === 'notifications-unread' ? unread : notifications.length, mode === 'notifications-unread' ? 'Tất cả' : 'Tất cả thời gian', 'info'],
          [Mail, 'Chưa đọc', unread, 'Cần bạn xem', 'warning'],
          [CalendarDays, mode === 'notifications-unread' ? 'Lịch hẹn' : 'Hôm nay', mode === 'notifications-unread' ? appointment : 18, mode === 'notifications-unread' ? 'Hôm nay & sắp tới' : 'Thông báo mới', 'success'],
          [AlertTriangle, mode === 'notifications-unread' ? 'Thanh toán' : 'Ưu tiên cao', mode === 'notifications-unread' ? payment : high, mode === 'notifications-unread' ? 'Hóa đơn đến hạn' : 'Cần xử lý sớm', 'danger'],
        ];

  return (
    <section className="reception-notification-hero">
      <div>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
      </div>
      <button type="button" className="reception-btn reception-btn--primary" onClick={onMarkAllRead}>
        <Mail size={16} />
        <span>Đánh dấu tất cả đã đọc</span>
      </button>
      <div className="reception-notification-kpis">
        {cards.map(([Icon, label, value, subtitle, tone]) => (
          <article key={label} className={`reception-notification-kpi is-${tone}`}>
            <span><Icon size={24} /></span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <em>{subtitle}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ReceiptIcon(props) {
  return <FileText {...props} />;
}

function NotificationFilters({ mode, filters, onChange }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });
  return (
    <section className="reception-notification-filters">
      <label className="is-wide">
        <Search size={16} />
        <input value={filters.query} onChange={(event) => update('query', event.target.value)} placeholder="Tìm theo tiêu đề hoặc nội dung..." />
      </label>
      {mode === 'notifications-all' ? (
        <select value={filters.category} onChange={(event) => update('category', event.target.value)}>
          <option value="">Loại thông báo</option>
          <option value="appointment">Lịch hẹn</option>
          <option value="payment">Thanh toán</option>
          <option value="system">Hệ thống</option>
        </select>
      ) : null}
      {mode !== 'notifications-unread' ? (
        <select value={filters.read} onChange={(event) => update('read', event.target.value)}>
          <option value="">Trạng thái đọc</option>
          <option value="unread">Chưa đọc</option>
          <option value="read">Đã đọc</option>
        </select>
      ) : (
        <select value={filters.priority} onChange={(event) => update('priority', event.target.value)}>
          <option value="">Mức độ ưu tiên</option>
          <option value="high">Cao</option>
          <option value="medium">Trung bình</option>
          <option value="low">Thấp</option>
        </select>
      )}
      <label className="reception-notification-date">
        <input type="date" value={filters.from} onChange={(event) => update('from', event.target.value)} />
        <span>→</span>
        <input type="date" value={filters.to} onChange={(event) => update('to', event.target.value)} />
      </label>
      <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onChange(baseFilters())}>
        <Filter size={16} />
        <span>Bộ lọc</span>
      </button>
    </section>
  );
}

function NotificationTabs({ mode, active, onChange }) {
  const tabs = mode === 'notifications-appointments'
    ? [
      ['all', 'Tất cả'],
      ['reminder', 'Nhắc lịch'],
      ['confirmed', 'Xác nhận'],
      ['cancelled', 'Hủy lịch'],
      ['rescheduled', 'Đổi lịch'],
    ]
    : mode === 'notifications-payments'
      ? [
        ['all', 'Tất cả'],
        ['unpaid', 'Chưa thanh toán'],
        ['overdue', 'Quá hạn'],
        ['success', 'Thanh toán thành công'],
        ['refund', 'Hoàn tiền'],
      ]
      : mode === 'notifications-system'
        ? [
          ['all', 'Tất cả'],
          ['maintenance', 'Bảo trì'],
          ['update', 'Cập nhật'],
          ['policy', 'Chính sách'],
          ['warning', 'Cảnh báo'],
        ]
        : [];
  if (!tabs.length) return null;
  return (
    <div className="reception-notification-tabs">
      {tabs.map(([key, label]) => (
        <button type="button" key={key} className={active === key ? 'is-active' : ''} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function NotificationTable({ mode, rows, selectedId, onSelect, onMarkRead }) {
  const isAppointment = mode === 'notifications-appointments';
  const isPayment = mode === 'notifications-payments';
  const isSystem = mode === 'notifications-system';
  return (
    <section className="reception-panel reception-notification-table-panel">
      <table className="reception-notification-table">
        <thead>
          <tr>
            <th>Thông báo</th>
            {isAppointment ? <th>Bệnh nhân</th> : null}
            {isPayment ? <th>Mã hóa đơn</th> : null}
            {isSystem ? <th>Nhóm</th> : !isAppointment && !isPayment ? <th>Loại</th> : null}
            <th>Mô tả</th>
            <th>Thời gian</th>
            <th>{mode === 'notifications-unread' || isSystem ? 'Mức độ' : 'Trạng thái'}</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className={selectedId === item.id ? 'is-selected' : ''}>
              <td>
                <div className="reception-notification-title-cell">
                  <i className={item.read ? 'is-read' : ''} />
                  <NotificationIcon category={item.category} />
                  <div><strong>{item.title}</strong><span>{item.id}</span></div>
                </div>
              </td>
              {isAppointment ? <td>{item.patient}<span>{item.id}</span></td> : null}
              {isPayment ? <td>{item.related}</td> : null}
              {isSystem ? <td><TypeBadge category={item.category} /></td> : !isAppointment && !isPayment ? <td><TypeBadge category={item.category} /></td> : null}
              <td>{item.description}</td>
              <td>{item.time}</td>
              <td>{mode === 'notifications-unread' || isSystem ? <PriorityBadge priority={item.priority} /> : <StatusBadge read={item.read} />}</td>
              <td>
                <div className="reception-notification-actions">
                  <button type="button" onClick={() => onSelect(item)}><Eye size={15} /></button>
                  <button type="button" onClick={() => onMarkRead(item.id)}><Mail size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan="7" className="reception-notification-empty">Không có thông báo phù hợp.</td></tr>
          ) : null}
        </tbody>
      </table>
      <div className="reception-notification-footer">
        <span>Hiển thị 1 - {rows.length} trong {rows.length} thông báo</span>
        <div><button>Trước</button><button className="is-active">1</button><button>Sau</button></div>
      </div>
    </section>
  );
}

function NotificationDetail({ item, mode, onClose, onMarkRead }) {
  if (!item) {
    return (
      <aside className="reception-notification-detail">
        <h2>{mode === 'notifications-unread' ? 'Gợi ý xử lý' : 'Chi tiết thông báo'}</h2>
        <QuickSuggestions mode={mode} />
      </aside>
    );
  }
  return (
    <aside className="reception-notification-detail">
      <header>
        <h2>{MODE_CONFIG[mode]?.detailTitle || 'Chi tiết thông báo'}</h2>
        <button type="button" onClick={onClose}><X size={18} /></button>
      </header>
      <div className="reception-notification-detail__title">
        <NotificationIcon category={item.category} />
        <div>
          <strong>{item.title}</strong>
          <span>{item.id}</span>
        </div>
        <StatusBadge read={item.read} />
      </div>
      <dl>
        <div><dt>Thời gian</dt><dd>{item.time}</dd></div>
        <div><dt>Trạng thái</dt><dd><StatusBadge read={item.read} /></dd></div>
        <div><dt>Mức độ ưu tiên</dt><dd><PriorityBadge priority={item.priority} /></dd></div>
        <div><dt>Người gửi</dt><dd>Hệ thống</dd></div>
        <div><dt>Liên quan đến</dt><dd>{item.related}</dd></div>
      </dl>
      <section>
        <h3>Nội dung chi tiết</h3>
        <p>{item.description}</p>
        <ul>
          {item.details.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>
      <footer>
        <button type="button" className="reception-btn reception-btn--primary" onClick={() => onMarkRead(item.id)}>
          <Mail size={16} />
          <span>Đánh dấu đã đọc</span>
        </button>
        <button type="button" className="reception-btn reception-btn--ghost">
          <FileText size={16} />
          <span>{item.actionLabel}</span>
        </button>
      </footer>
    </aside>
  );
}

function QuickSuggestions({ mode }) {
  const items = mode === 'notifications-unread'
    ? [
      ['Đọc từng thông báo', 'Xem chi tiết để nắm rõ nội dung và yêu cầu.'],
      ['Ưu tiên lịch hẹn hôm nay', 'Liên hệ bệnh nhân xác nhận giờ đến.'],
      ['Kiểm tra hóa đơn đến hạn', 'Nhắc thanh toán để tránh gián đoạn dịch vụ.'],
      ['Đánh dấu đã đọc sau khi xử lý', 'Giữ danh sách gọn gàng và không bỏ sót.'],
    ]
    : [
      ['Kiểm tra chi tiết thông báo', 'Mở thông báo để xem toàn bộ nội dung.'],
      ['Xử lý theo mức độ ưu tiên', 'Ưu tiên các thông báo mức cao trước.'],
      ['Đánh dấu sau khi hoàn tất', 'Cập nhật trạng thái đọc để tránh trùng việc.'],
    ];
  return (
    <div className="reception-notification-suggestions">
      {items.map(([title, body], index) => (
        <div key={title}>
          <span>{index + 1}</span>
          <div><strong>{title}</strong><p>{body}</p></div>
        </div>
      ))}
    </div>
  );
}

function filterNotifications(items, mode, filters) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG['notifications-all'];
  return items.filter((item) => {
    if (config.category && item.category !== config.category) return false;
    if (config.unreadOnly && item.read) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.read === 'read' && !item.read) return false;
    if (filters.read === 'unread' && item.read) return false;
    if (filters.priority && item.priority !== filters.priority) return false;
    if (filters.tab !== 'all') {
      const target = `${item.title} ${item.description} ${item.group || ''}`.toLowerCase();
      const tabMatchers = {
        reminder: ['nhắc'],
        confirmed: ['xác nhận'],
        cancelled: ['hủy'],
        rescheduled: ['đổi'],
        unpaid: ['chưa thanh toán'],
        overdue: ['quá hạn', 'đến hạn'],
        success: ['thành công'],
        refund: ['hoàn'],
        maintenance: ['bảo trì'],
        update: ['cập nhật'],
        policy: ['chính sách', 'quyền'],
        warning: ['cảnh báo'],
      };
      const keywords = tabMatchers[filters.tab] || [filters.tab];
      if (!keywords.some((keyword) => target.includes(keyword))) return false;
    }
    return matchesKeyword(item, filters.query);
  });
}

export function ReceptionNotificationsPanel({ mode = 'notifications-all' }) {
  const [items, setItems] = useState([]);
  const [loadState, setLoadState] = useState({ loading: false, error: '' });
  const [filters, setFilters] = useState(baseFilters);
  const visibleItems = useMemo(() => filterNotifications(items, mode, filters), [filters, items, mode]);
  const [selectedId, setSelectedId] = useState(visibleItems[0]?.id || '');
  const selected = visibleItems.find((item) => item.id === selectedId) || visibleItems[0] || null;

  async function loadNotifications() {
    setLoadState({ loading: true, error: '' });
    try {
      const data = await receptionDataApi.listNotifications({ limit: 100 });
      setItems((data?.items || []).map(normalizeNotification));
      setLoadState({ loading: false, error: '' });
    } catch (error) {
      setLoadState({
        loading: false,
        error: error?.payload?.message || error?.message || 'Không tải được thông báo.',
      });
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function markRead(id) {
    const item = items.find((entry) => entry.id === id);
    if (!item?.rawId) return;
    setItems((current) => current.map((entry) => entry.id === id ? { ...entry, read: true } : entry));
    try {
      await receptionDataApi.markNotificationRead(item.rawId);
    } catch (error) {
      setLoadState({
        loading: false,
        error: error?.payload?.message || error?.message || 'Không đánh dấu được thông báo.',
      });
      loadNotifications();
    }
  }

  async function markAllRead() {
    const currentIds = new Set(filterNotifications(items, mode, { ...baseFilters(), tab: 'all' }).map((item) => item.id));
    setItems((current) => current.map((item) => currentIds.has(item.id) ? { ...item, read: true } : item));
    try {
      await receptionDataApi.markAllNotificationsRead();
      await loadNotifications();
    } catch (error) {
      setLoadState({
        loading: false,
        error: error?.payload?.message || error?.message || 'Không đánh dấu được toàn bộ thông báo.',
      });
    }
  }

  return (
    <div className="reception-notification-page">
      {loadState.error ? (
        <div className="reception-appointment-alert is-danger">
          <AlertTriangle size={18} />
          <span>{loadState.error}</span>
        </div>
      ) : null}
      {loadState.loading ? (
        <div className="reception-appointment-loading reception-appointment-loading--inline">
          <Bell size={18} />
          <span>Đang tải thông báo...</span>
        </div>
      ) : null}
      <NotificationHero mode={mode} notifications={items} onMarkAllRead={markAllRead} />
      <div className="reception-notification-layout">
        <main className="reception-notification-main">
          <NotificationTabs mode={mode} active={filters.tab} onChange={(tab) => setFilters((current) => ({ ...current, tab }))} />
          <NotificationFilters mode={mode} filters={filters} onChange={setFilters} />
          <NotificationTable
            mode={mode}
            rows={visibleItems}
            selectedId={selected?.id}
            onSelect={(item) => setSelectedId(item.id)}
            onMarkRead={markRead}
          />
        </main>
        <NotificationDetail
          item={selected}
          mode={mode}
          onClose={() => setSelectedId('')}
          onMarkRead={markRead}
        />
      </div>
    </div>
  );
}
