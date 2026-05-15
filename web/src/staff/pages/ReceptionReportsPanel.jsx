import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';

const REPORT_CONFIG = {
  'reports-daily': {
    title: 'Tổng quan ngày',
    subtitle: 'Thống kê tổng quan hoạt động tiếp nhận trong ngày',
  },
  'reports-appointments': {
    title: 'Báo cáo lịch hẹn',
    subtitle: 'Thống kê lịch hẹn theo thời gian, trạng thái, khoa và bác sĩ',
  },
  'reports-checkin': {
    title: 'Báo cáo check-in',
    subtitle: 'Theo dõi tiếp nhận, thời gian chờ và hiệu suất quầy',
  },
  'reports-revenue': {
    title: 'Báo cáo doanh thu',
    subtitle: 'Thống kê doanh thu, thanh toán và công nợ trong kỳ',
  },
};

const INITIAL_FILTERS = {
  dateFrom: '2025-05-23',
  dateTo: '2025-05-23',
  department: 'all',
  doctor: 'all',
  appointmentStatus: 'all',
  appointmentType: 'all',
  paymentMethod: 'all',
  paymentStatus: 'all',
};

const DEPARTMENTS = [
  { name: 'Khoa Khám bệnh', appointments: 842, checkins: 486, completed: 410, revenue: 312450000 },
  { name: 'Khoa Nhi', appointments: 486, checkins: 312, completed: 284, revenue: 228770000 },
  { name: 'Khoa Nội tổng hợp', appointments: 412, checkins: 276, completed: 236, revenue: 183220000 },
  { name: 'Khoa Sản', appointments: 268, checkins: 184, completed: 158, revenue: 124880000 },
  { name: 'Khoa Tai Mũi Họng', appointments: 192, checkins: 130, completed: 112, revenue: 79360000 },
  { name: 'Khoa Mắt', appointments: 146, checkins: 98, completed: 84, revenue: 56770000 },
];

const DOCTORS = [
  { name: 'BS. Trần Minh Đức', department: 'Khoa Khám bệnh', appointments: 162, checkins: 142, completed: 138 },
  { name: 'BS. Nguyễn Thu Hà', department: 'Khoa Nhi', appointments: 128, checkins: 116, completed: 104 },
  { name: 'BS. Phạm Quốc Hùng', department: 'Khoa Nội tổng hợp', appointments: 116, checkins: 104, completed: 92 },
  { name: 'BS. Lê Hoàng Nam', department: 'Khoa Sản', appointments: 104, checkins: 94, completed: 86 },
  { name: 'BS. Võ Thị Lan', department: 'Khoa Mắt', appointments: 98, checkins: 88, completed: 80 },
  { name: 'BS. Lê Minh Tuấn', department: 'Khoa Tai Mũi Họng', appointments: 86, checkins: 74, completed: 68 },
];

const TIME_ROWS = [
  { time: '00:00 - 06:00', appointments: 34, confirmed: 28, completed: 22, waiting: 2, noShow: 4 },
  { time: '06:00 - 08:00', appointments: 312, confirmed: 252, completed: 192, waiting: 26, noShow: 34 },
  { time: '08:00 - 10:00', appointments: 612, confirmed: 476, completed: 352, waiting: 54, noShow: 72 },
  { time: '10:00 - 12:00', appointments: 684, confirmed: 524, completed: 388, waiting: 60, noShow: 86 },
  { time: '12:00 - 14:00', appointments: 356, confirmed: 276, completed: 208, waiting: 28, noShow: 36 },
  { time: '14:00 - 16:00', appointments: 294, confirmed: 212, completed: 150, waiting: 22, noShow: 30 },
  { time: '16:00 - 18:00', appointments: 124, confirmed: 74, completed: 48, waiting: 12, noShow: 14 },
  { time: '18:00 - 24:00', appointments: 42, confirmed: 18, completed: 4, waiting: 10, noShow: 2 },
];

const REVENUE_DAYS = [
  { date: '17/05/2025', invoices: 152, paid: 98650000, debt: 31270000, refund: 3120000 },
  { date: '18/05/2025', invoices: 168, paid: 116820000, debt: 38480000, refund: 3450000 },
  { date: '19/05/2025', invoices: 171, paid: 123450000, debt: 39870000, refund: 3630000 },
  { date: '20/05/2025', invoices: 176, paid: 128930000, debt: 41260000, refund: 4120000 },
  { date: '21/05/2025', invoices: 185, paid: 135780000, debt: 45390000, refund: 4980000 },
  { date: '22/05/2025', invoices: 196, paid: 147360000, debt: 47290000, refund: 4730000 },
  { date: '23/05/2025', invoices: 198, paid: 192830000, debt: 57070000, refund: 3860000 },
];

const SERVICES = [
  ['Khám chuyên khoa', 268900000, '27.3%'],
  ['Xét nghiệm', 188450000, '19.1%'],
  ['Siêu âm', 142600000, '14.5%'],
  ['Nội soi', 98300000, '10.0%'],
  ['Chụp X-Quang', 67250000, '6.8%'],
];

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function percent(value, total) {
  if (!total) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0));
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
}

function dateFactor(filters) {
  if (filters.dateFrom !== INITIAL_FILTERS.dateFrom || filters.dateTo !== INITIAL_FILTERS.dateTo) return 0.82;
  return 1;
}

function statusFactor(filters, mode) {
  if (mode === 'reports-appointments' && filters.appointmentStatus !== 'all') return 0.58;
  if (mode === 'reports-revenue' && filters.paymentStatus !== 'all') return 0.66;
  return 1;
}

function methodFactor(filters) {
  if (filters.paymentMethod === 'cash') return 0.423;
  if (filters.paymentMethod === 'bank') return 0.346;
  if (filters.paymentMethod === 'card') return 0.158;
  return 1;
}

function scale(value, factor) {
  return Math.max(0, Math.round(Number(value || 0) * factor));
}

function useReportData(mode, filters) {
  return useMemo(() => {
    const byDepartment = filters.department === 'all'
      ? DEPARTMENTS
      : DEPARTMENTS.filter((item) => item.name === filters.department);
    const byDoctor = filters.doctor === 'all'
      ? DOCTORS.filter((item) => filters.department === 'all' || item.department === filters.department)
      : DOCTORS.filter((item) => item.name === filters.doctor);
    const factor = dateFactor(filters) * statusFactor(filters, mode) * methodFactor(filters);
    const departments = byDepartment.map((item) => ({
      ...item,
      appointments: scale(item.appointments, factor),
      checkins: scale(item.checkins, factor),
      completed: scale(item.completed, factor),
      revenue: scale(item.revenue, factor),
    }));
    const doctors = byDoctor.map((item) => ({
      ...item,
      appointments: scale(item.appointments, factor),
      checkins: scale(item.checkins, factor),
      completed: scale(item.completed, factor),
    }));
    const timeRows = TIME_ROWS.map((item) => ({
      ...item,
      appointments: scale(item.appointments, factor),
      confirmed: scale(item.confirmed, factor),
      completed: scale(item.completed, factor),
      waiting: scale(item.waiting, factor),
      noShow: scale(item.noShow, factor),
    }));
    const revenueDays = REVENUE_DAYS.map((item) => ({
      ...item,
      invoices: scale(item.invoices, factor),
      paid: scale(item.paid, factor),
      debt: scale(item.debt, factor),
      refund: scale(item.refund, factor),
    }));
    const totalAppointments = sum(departments, 'appointments');
    const totalCheckins = sum(departments, 'checkins');
    const totalCompleted = sum(departments, 'completed');
    const totalRevenue = sum(departments, 'revenue');
    const noShow = Math.round(totalAppointments * 0.065);
    const cancelled = Math.round(totalAppointments * 0.05);
    const waiting = Math.max(0, Math.round(totalAppointments * 0.11));
    const paid = sum(revenueDays, 'paid');
    const debt = sum(revenueDays, 'debt');
    const refund = sum(revenueDays, 'refund');

    return {
      departments,
      doctors,
      timeRows,
      revenueDays,
      totals: {
        appointments: totalAppointments,
        confirmed: Math.round(totalAppointments * 0.75),
        checkins: totalCheckins,
        completed: totalCompleted,
        waiting,
        noShow,
        cancelled,
        revenue: totalRevenue || paid,
        paid,
        debt,
        refund,
        invoices: sum(revenueDays, 'invoices'),
        waitMinutes: Math.max(8, Math.round(18 * (filters.department === 'all' ? 1 : 0.82))),
      },
    };
  }, [filters, mode]);
}

function buildDepartmentRows(rows) {
  const total = sum(rows, 'appointments');
  return rows.map((item) => [item.name, formatNumber(item.appointments), formatNumber(item.checkins), percent(item.appointments, total)]);
}

function buildDoctorRows(rows, metric = 'appointments') {
  return rows.map((item) => [
    item.name,
    formatNumber(item[metric]),
    formatNumber(item.completed),
    percent(item.completed, item[metric]),
  ]);
}

function buildTimeRows(rows) {
  return rows.map((item) => [
    item.time,
    formatNumber(item.appointments),
    formatNumber(item.confirmed),
    formatNumber(item.completed),
    formatNumber(item.waiting),
    formatNumber(item.noShow),
  ]);
}

function buildRevenueRows(rows) {
  return rows.map((item) => [
    item.date,
    formatNumber(item.invoices),
    formatCurrency(item.paid),
    formatCurrency(item.debt),
    formatCurrency(item.refund),
  ]);
}

function exportCsv(mode, data) {
  const config = REPORT_CONFIG[mode] || REPORT_CONFIG['reports-daily'];
  const sections = [
    [config.title],
    [],
    ['Khoa / Phòng', 'Lịch hẹn', 'Check-in', 'Hoàn tất', 'Doanh thu'],
    ...data.departments.map((item) => [item.name, item.appointments, item.checkins, item.completed, item.revenue]),
    [],
    ['Bác sĩ', 'Khoa', 'Lịch hẹn', 'Check-in', 'Hoàn tất'],
    ...data.doctors.map((item) => [item.name, item.department, item.appointments, item.checkins, item.completed]),
  ];
  if (mode === 'reports-revenue') {
    sections.push([], ['Ngày', 'Số hóa đơn', 'Đã thu', 'Còn phải thu', 'Hoàn tiền']);
    sections.push(...data.revenueDays.map((item) => [item.date, item.invoices, item.paid, item.debt, item.refund]));
  }
  const csv = sections
    .map((row) => row.map((cell = '') => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${mode}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ReportHero({ mode }) {
  const config = REPORT_CONFIG[mode] || REPORT_CONFIG['reports-daily'];
  return (
    <section className="reception-report-hero">
      <div>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
      </div>
    </section>
  );
}

function ReportFilters({ mode, filters, onChange, onReset, onExport }) {
  const doctors = filters.department === 'all'
    ? DOCTORS
    : DOCTORS.filter((doctor) => doctor.department === filters.department);

  return (
    <section className="reception-report-filters">
      <label>
        <span>Từ ngày</span>
        <input type="date" value={filters.dateFrom} onChange={(event) => onChange('dateFrom', event.target.value)} />
      </label>
      <label>
        <span>Đến ngày</span>
        <input type="date" value={filters.dateTo} onChange={(event) => onChange('dateTo', event.target.value)} />
      </label>
      <label>
        <span>Khoa / Phòng</span>
        <select value={filters.department} onChange={(event) => onChange('department', event.target.value)}>
          <option value="all">Tất cả khoa/phòng</option>
          {DEPARTMENTS.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
        </select>
      </label>
      {mode !== 'reports-revenue' ? (
        <label>
          <span>Bác sĩ</span>
          <select value={filters.doctor} onChange={(event) => onChange('doctor', event.target.value)}>
            <option value="all">Tất cả bác sĩ</option>
            {doctors.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
        </label>
      ) : (
        <label>
          <span>Phương thức thanh toán</span>
          <select value={filters.paymentMethod} onChange={(event) => onChange('paymentMethod', event.target.value)}>
            <option value="all">Tất cả phương thức</option>
            <option value="cash">Tiền mặt</option>
            <option value="bank">Chuyển khoản</option>
            <option value="card">Thẻ ngân hàng</option>
          </select>
        </label>
      )}
      {mode === 'reports-appointments' ? (
        <>
          <label>
            <span>Trạng thái lịch hẹn</span>
            <select value={filters.appointmentStatus} onChange={(event) => onChange('appointmentStatus', event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="completed">Đã hoàn tất</option>
              <option value="cancelled">Đã hủy</option>
              <option value="no_show">No-show</option>
            </select>
          </label>
          <label>
            <span>Loại lịch hẹn</span>
            <select value={filters.appointmentType} onChange={(event) => onChange('appointmentType', event.target.value)}>
              <option value="all">Tất cả loại</option>
              <option value="outpatient">Khám ngoại trú</option>
              <option value="follow_up">Tái khám</option>
            </select>
          </label>
        </>
      ) : null}
      {mode === 'reports-revenue' ? (
        <label>
          <span>Trạng thái thanh toán</span>
          <select value={filters.paymentStatus} onChange={(event) => onChange('paymentStatus', event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="partial">Thanh toán một phần</option>
            <option value="overdue">Quá hạn</option>
          </select>
        </label>
      ) : null}
      <button type="button" className="reception-btn reception-btn--ghost" onClick={onReset}><RefreshCw size={16} />Làm mới</button>
      <button type="button" className="reception-btn reception-btn--primary" onClick={onExport}><Download size={16} />Xuất báo cáo</button>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, delta, tone = 'info' }) {
  return (
    <article className={`reception-report-kpi is-${tone}`}>
      <span><Icon size={25} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{delta}</em>
      </div>
    </article>
  );
}

function LineChart({ rows }) {
  const valuesA = rows.map((item) => item.appointments || item.confirmed || 0);
  const valuesB = rows.map((item) => item.completed || item.checkins || 0);
  const max = Math.max(1, ...valuesA, ...valuesB);
  const toPoints = (values) => values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 440;
    const y = 145 - (value / max) * 118;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="reception-report-line" viewBox="0 0 460 160" role="img" aria-label="Xu hướng">
      {[30, 60, 90, 120, 150].map((y) => <line key={y} x1="0" y1={y} x2="460" y2={y} />)}
      <polyline points={toPoints(valuesA)} className="is-blue" />
      <polyline points={toPoints(valuesB)} className="is-green" />
      {toPoints(valuesA).split(' ').map((point) => {
        const [x, y] = point.split(',');
        return <circle key={point} cx={x} cy={y} r="3" className="is-blue-dot" />;
      })}
    </svg>
  );
}

function BarChart({ rows }) {
  const max = Math.max(1, ...rows.map((item) => item.paid));
  return (
    <div className="reception-report-bars">
      {rows.map((item) => (
        <span key={item.date} style={{ height: `${Math.max(28, (item.paid / max) * 132)}px` }}><i>{item.date.slice(0, 5)}</i></span>
      ))}
    </div>
  );
}

function Donut({ total = '2.458', segments = [48, 30, 14, 8] }) {
  const [a, b, c] = segments;
  const background = `conic-gradient(#2f7df2 0 ${a}%, #22b868 ${a}% ${a + b}%, #ff9d22 ${a + b}% ${a + b + c}%, #ff4d5f ${a + b + c}% 100%)`;
  return (
    <div className="reception-report-donut" style={{ background }}>
      <span>Tổng<strong>{total}</strong></span>
    </div>
  );
}

function MiniTable({ title, rows, columns }) {
  return (
    <section className="reception-panel reception-report-card">
      <h2>{title}</h2>
      <table className="reception-report-table">
        <thead><tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, rowIndex) => (
            <tr key={`${title}-${rowIndex}`}>
              <td>{rowIndex + 1}</td>
              {row.map((cell, index) => <td key={`${cell}-${index}`}>{cell}</td>)}
            </tr>
          )) : (
            <tr><td colSpan={columns.length}>Không có dữ liệu theo bộ lọc hiện tại.</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function InsightCard({ mode, data }) {
  const peak = data.timeRows.reduce((best, item) => (item.appointments > best.appointments ? item : best), data.timeRows[0]);
  const items = mode === 'reports-revenue'
    ? [
      ['Tỷ trọng tiền mặt & chuyển khoản', 'Có thể lọc theo phương thức để xem riêng từng nguồn thu và xuất báo cáo đối soát.'],
      ['Công nợ cần theo dõi', `Còn phải thu ${formatCurrency(data.totals.debt)}. Nên rà soát các hóa đơn quá hạn trong ngày.`],
      ['Gợi ý đối soát cuối ngày', 'Đối soát tiền mặt, chuyển khoản và hoàn tiền trước 22:00 để đảm bảo số liệu chính xác.'],
    ]
    : [
      ['Khung giờ cao điểm', `${peak.time} có số lượng cao nhất với ${formatNumber(peak.appointments)} lượt.`],
      ['Tỷ lệ No-show', `No-show hiện ở mức ${formatNumber(data.totals.noShow)} lượt. Cần nhắc lịch qua SMS/Zalo.`],
      ['Khuyến nghị vận hành', 'Lọc theo khoa hoặc bác sĩ để xem điểm nghẽn cụ thể trước khi điều phối nhân sự.'],
    ];
  return (
    <section className="reception-panel reception-report-insights">
      <h2>{mode === 'reports-daily' ? 'Thông tin & Gợi ý vận hành' : 'Gợi ý & Nhận xét'}</h2>
      {items.map(([title, body], index) => (
        <div key={title}>
          <span>{index + 1}</span>
          <div><strong>{title}</strong><p>{body}</p></div>
        </div>
      ))}
    </section>
  );
}

function DailyPage({ data }) {
  return (
    <>
      <section className="reception-report-kpi-grid">
        <Kpi icon={CalendarDays} label="Lịch hẹn" value={formatNumber(data.totals.appointments)} delta="↑ 12.5% so với hôm qua" />
        <Kpi icon={CheckCircle2} label="Đã check-in" value={formatNumber(data.totals.checkins)} delta="↑ 10.3% so với hôm qua" tone="success" />
        <Kpi icon={Clock3} label="Đang chờ" value={formatNumber(data.totals.waiting)} delta="↓ -8.7% so với hôm qua" tone="warning" />
        <Kpi icon={CheckCircle2} label="Đã hoàn tất" value={formatNumber(data.totals.completed)} delta="↑ 9.8% so với hôm qua" tone="success" />
        <Kpi icon={XCircle} label="No-show" value={formatNumber(data.totals.noShow)} delta="↓ -4.0% so với hôm qua" tone="danger" />
        <Kpi icon={Banknote} label="Doanh thu trong ngày" value={formatCurrency(data.totals.revenue)} delta="↑ 15.2% so với hôm qua" tone="violet" />
      </section>
      <section className="reception-report-grid">
        <section className="reception-panel reception-report-card is-wide"><h2>Xu hướng trong ngày</h2><LineChart rows={data.timeRows} /></section>
        <section className="reception-panel reception-report-card"><h2>Cơ cấu lịch hẹn theo trạng thái</h2><Donut total={formatNumber(data.totals.appointments)} /></section>
        <MiniTable title="Top khoa hoạt động" columns={['#', 'Khoa / Phòng', 'Lịch hẹn', 'Check-in', 'Tỷ lệ']} rows={buildDepartmentRows(data.departments).slice(0, 5)} />
        <MiniTable title="Tóm tắt theo khung giờ" columns={['#', 'Khung giờ', 'Lịch hẹn', 'Check-in', 'Hoàn tất', 'Chờ', 'No-show']} rows={buildTimeRows(data.timeRows).slice(0, 6)} />
        <MiniTable title="Bác sĩ tiếp nhận nhiều nhất" columns={['#', 'Bác sĩ', 'Check-in', 'Hoàn tất', 'Tỷ lệ']} rows={buildDoctorRows(data.doctors, 'checkins').slice(0, 5)} />
        <InsightCard mode="reports-daily" data={data} />
      </section>
    </>
  );
}

function AppointmentPage({ data }) {
  return (
    <>
      <section className="reception-report-kpi-grid reception-report-kpi-grid--five">
        <Kpi icon={CalendarDays} label="Tổng lịch hẹn" value={formatNumber(data.totals.appointments)} delta="↑ 13.6% so với kỳ trước" />
        <Kpi icon={CheckCircle2} label="Đã xác nhận" value={formatNumber(data.totals.confirmed)} delta="↑ 14.2% so với kỳ trước" tone="success" />
        <Kpi icon={CheckCircle2} label="Đã hoàn tất" value={formatNumber(data.totals.completed)} delta="↑ 12.1% so với kỳ trước" tone="success" />
        <Kpi icon={XCircle} label="Đã hủy" value={formatNumber(data.totals.cancelled)} delta="↑ 8.3% so với kỳ trước" tone="danger" />
        <Kpi icon={Users} label="No-show" value={formatNumber(data.totals.noShow)} delta="↑ 5.7% so với kỳ trước" tone="violet" />
      </section>
      <section className="reception-report-grid">
        <section className="reception-panel reception-report-card is-wide"><h2>1. Xu hướng lịch hẹn</h2><LineChart rows={data.timeRows} /></section>
        <section className="reception-panel reception-report-card"><h2>2. Cơ cấu theo trạng thái</h2><Donut total={formatNumber(data.totals.appointments)} /></section>
        <MiniTable title="3. Top khoa có nhiều lịch hẹn" columns={['#', 'Khoa / Phòng', 'Lịch hẹn', 'Check-in', 'Tỷ lệ']} rows={buildDepartmentRows(data.departments)} />
        <MiniTable title="4. Top bác sĩ theo số lượng lịch hẹn" columns={['#', 'Bác sĩ', 'Lịch hẹn', 'Hoàn tất', 'Tỷ lệ']} rows={buildDoctorRows(data.doctors)} />
        <MiniTable title="5. Thống kê theo khung giờ" columns={['#', 'Khung giờ', 'Lịch hẹn', 'Xác nhận', 'Hoàn tất', 'Hủy', 'No-show']} rows={buildTimeRows(data.timeRows)} />
        <InsightCard mode="reports-appointments" data={data} />
      </section>
    </>
  );
}

function CheckinPage({ data }) {
  const checkinRows = data.timeRows.map((item) => [
    item.time,
    formatNumber(item.confirmed),
    formatNumber(item.completed),
    formatNumber(item.waiting),
    formatNumber(item.noShow),
  ]);

  return (
    <>
      <section className="reception-report-kpi-grid reception-report-kpi-grid--five">
        <Kpi icon={Users} label="Tổng check-in" value={formatNumber(data.totals.checkins)} delta="↑ 14.2% so với kỳ trước" />
        <Kpi icon={Clock3} label="Thời gian chờ TB" value={`${data.totals.waitMinutes} phút`} delta="↓ 7.5% so với kỳ trước" tone="success" />
        <Kpi icon={CheckCircle2} label="Hoàn tất" value={formatNumber(data.totals.completed)} delta="↑ 12.1% so với kỳ trước" tone="success" />
        <Kpi icon={AlertTriangle} label="Đang chờ" value={formatNumber(data.totals.waiting)} delta="↑ 6.2% so với kỳ trước" tone="warning" />
        <Kpi icon={XCircle} label="Bỏ qua" value={formatNumber(data.totals.noShow)} delta="↓ 4.1% so với kỳ trước" tone="danger" />
      </section>
      <section className="reception-report-grid">
        <section className="reception-panel reception-report-card is-wide"><h2>Xu hướng check-in</h2><LineChart rows={data.timeRows} /></section>
        <section className="reception-panel reception-report-card"><h2>Cơ cấu trạng thái</h2><Donut total={formatNumber(data.totals.checkins)} /></section>
        <MiniTable title="Hiệu suất theo khoa" columns={['#', 'Khoa / Phòng', 'Lịch hẹn', 'Check-in', 'Tỷ lệ']} rows={buildDepartmentRows(data.departments)} />
        <MiniTable title="Thống kê theo khung giờ" columns={['#', 'Khung giờ', 'Check-in', 'Hoàn tất', 'Chờ', 'Bỏ qua']} rows={checkinRows} />
        <MiniTable title="Bác sĩ tiếp nhận nhiều nhất" columns={['#', 'Bác sĩ', 'Check-in', 'Hoàn tất', 'Tỷ lệ']} rows={buildDoctorRows(data.doctors, 'checkins')} />
        <InsightCard mode="reports-checkin" data={data} />
      </section>
    </>
  );
}

function RevenuePage({ data }) {
  const departmentRows = data.departments.map((item) => [item.name, formatCurrency(item.revenue), percent(item.revenue, data.totals.revenue)]);
  return (
    <>
      <p className="reception-report-note">Chỉ hiển thị khi người dùng có quyền billing</p>
      <section className="reception-report-kpi-grid reception-report-kpi-grid--five">
        <Kpi icon={Banknote} label="Tổng doanh thu" value={formatCurrency(data.totals.revenue)} delta="↑ 12.8% so với kỳ trước" />
        <Kpi icon={CheckCircle2} label="Đã thu" value={formatCurrency(data.totals.paid)} delta="↑ 10.4% so với kỳ trước" tone="success" />
        <Kpi icon={FileText} label="Còn phải thu" value={formatCurrency(data.totals.debt)} delta="↑ 18.7% so với kỳ trước" tone="warning" />
        <Kpi icon={FileText} label="Số hóa đơn" value={formatNumber(data.totals.invoices)} delta="↑ 11.2% so với kỳ trước" tone="violet" />
        <Kpi icon={XCircle} label="Hoàn tiền" value={formatCurrency(data.totals.refund)} delta="↓ -5.3% so với kỳ trước" tone="danger" />
      </section>
      <section className="reception-report-grid">
        <section className="reception-panel reception-report-card"><h2>Doanh thu theo ngày</h2><BarChart rows={data.revenueDays} /></section>
        <section className="reception-panel reception-report-card"><h2>Cơ cấu theo phương thức thanh toán</h2><Donut total={formatCurrency(data.totals.revenue)} segments={[42, 35, 16, 7]} /></section>
        <MiniTable title="Doanh thu theo khoa/phòng" columns={['#', 'Khoa / Phòng', 'Doanh thu', 'Tỷ trọng']} rows={departmentRows} />
        <MiniTable title="Top dịch vụ mang lại doanh thu" columns={['#', 'Dịch vụ', 'Doanh thu', 'Tỷ trọng']} rows={SERVICES.map(([name, amount, ratio]) => [name, formatCurrency(amount * methodFactor(INITIAL_FILTERS)), ratio])} />
        <MiniTable title="Tổng hợp thanh toán" columns={['#', 'Ngày', 'Số hóa đơn', 'Đã thu', 'Còn phải thu', 'Hoàn tiền']} rows={buildRevenueRows(data.revenueDays)} />
        <InsightCard mode="reports-revenue" data={data} />
      </section>
    </>
  );
}

export function ReceptionReportsPanel({ mode = 'reports-daily' }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const data = useReportData(mode, filters);

  function handleChange(key, value) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'department') next.doctor = 'all';
      return next;
    });
  }

  return (
    <div className="reception-report-page">
      <ReportHero mode={mode} />
      <ReportFilters
        mode={mode}
        filters={filters}
        onChange={handleChange}
        onReset={() => setFilters(INITIAL_FILTERS)}
        onExport={() => exportCsv(mode, data)}
      />
      {mode === 'reports-daily' ? <DailyPage data={data} /> : null}
      {mode === 'reports-appointments' ? <AppointmentPage data={data} /> : null}
      {mode === 'reports-checkin' ? <CheckinPage data={data} /> : null}
      {mode === 'reports-revenue' ? <RevenuePage data={data} /> : null}
    </div>
  );
}
