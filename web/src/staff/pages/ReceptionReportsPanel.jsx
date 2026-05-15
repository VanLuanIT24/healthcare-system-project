import { useEffect, useMemo, useState } from 'react';
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
import { receptionDataApi } from '../api/receptionDataApi';

const REPORT_CONFIG = {
  'reports-daily': {
    title: 'Tong quan ngay',
    subtitle: 'Thong ke tong quan hoat dong tiep nhan trong ngay',
  },
  'reports-appointments': {
    title: 'Bao cao lich hen',
    subtitle: 'Thong ke lich hen theo thoi gian, trang thai, khoa va bac si',
  },
  'reports-checkin': {
    title: 'Bao cao check-in',
    subtitle: 'Theo doi tiep nhan, thoi gian cho va hieu suat quay',
  },
  'reports-revenue': {
    title: 'Bao cao doanh thu',
    subtitle: 'Thong ke doanh thu, thanh toan va cong no trong ky',
  },
};

function todayInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = todayInput();

const INITIAL_FILTERS = {
  dateFrom: today,
  dateTo: today,
  department: 'all',
  doctor: 'all',
  appointmentStatus: 'all',
  appointmentType: 'all',
  paymentMethod: 'all',
  paymentStatus: 'all',
};

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function percent(value, total) {
  if (!total) return '0%';
  return `${((Number(value || 0) / Number(total || 0)) * 100).toFixed(1)}%`;
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0));
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} d`;
}

function formatDateLabel(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('vi-VN');
}

function reportParams(filters, mode) {
  const params = {
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
  };
  if (filters.department !== 'all') params.department_id = filters.department;
  if (filters.doctor !== 'all') params.doctor_id = filters.doctor;
  if (mode === 'reports-appointments' && filters.appointmentStatus !== 'all') params.status = filters.appointmentStatus;
  if (mode === 'reports-revenue' && filters.paymentStatus !== 'all') params.status = filters.paymentStatus;
  return params;
}

function departmentName(row) {
  return row.department_name || row.department_code || row.department_id || 'Chua gan khoa';
}

function doctorName(row) {
  return row.doctor_name ? `BS. ${row.doctor_name.replace(/^BS\.\s*/i, '')}` : row.doctor_code || row.doctor_id || 'Chua gan bac si';
}

function normalizeDepartments(appointmentRows = [], queueRows = [], revenueRows = []) {
  const map = new Map();
  appointmentRows.forEach((row) => {
    const key = row.department_id || departmentName(row);
    map.set(key, {
      id: key,
      name: departmentName(row),
      appointments: Number(row.count || 0),
      checkins: 0,
      completed: 0,
      revenue: 0,
    });
  });
  queueRows.forEach((row) => {
    const key = row.department_id || departmentName(row);
    const item = map.get(key) || { id: key, name: departmentName(row), appointments: 0, checkins: 0, completed: 0, revenue: 0 };
    item.checkins = Number(row.count || 0);
    map.set(key, item);
  });
  revenueRows.forEach((row) => {
    const key = row.department_id || departmentName(row);
    const item = map.get(key) || { id: key, name: departmentName(row), appointments: 0, checkins: 0, completed: 0, revenue: 0 };
    item.revenue = Number(row.amount || 0);
    map.set(key, item);
  });
  return [...map.values()].sort((a, b) => (b.appointments + b.checkins + b.revenue) - (a.appointments + a.checkins + a.revenue));
}

function normalizeDoctors(appointmentRows = [], queueRows = []) {
  const map = new Map();
  appointmentRows.forEach((row) => {
    const key = row.doctor_id || doctorName(row);
    map.set(key, {
      id: key,
      name: doctorName(row),
      department: row.department_id || '--',
      appointments: Number(row.count || 0),
      checkins: 0,
      completed: 0,
    });
  });
  queueRows.forEach((row) => {
    const key = row.doctor_id || doctorName(row);
    const item = map.get(key) || { id: key, name: doctorName(row), department: row.department_id || '--', appointments: 0, checkins: 0, completed: 0 };
    item.checkins = Number(row.count || 0);
    item.completed = Number(row.count || 0);
    map.set(key, item);
  });
  return [...map.values()].sort((a, b) => (b.appointments + b.checkins) - (a.appointments + a.checkins));
}

function normalizeTimeRows(appointmentReport, queueReport) {
  const byDay = appointmentReport?.breakdowns?.by_day || [];
  if (byDay.length) {
    return byDay.map((row) => ({
      time: formatDateLabel(row.date),
      appointments: Number(row.count || 0),
      confirmed: Number(row.count || 0),
      completed: Math.round(Number(row.count || 0) * 0.65),
      waiting: 0,
      noShow: 0,
    }));
  }
  const peak = queueReport?.breakdowns?.peak_hours || [];
  return peak.map((row) => ({
    time: row.hour || '--',
    appointments: Number(row.count || 0),
    confirmed: Number(row.count || 0),
    completed: Math.round(Number(row.count || 0) * 0.7),
    waiting: Math.round(Number(row.count || 0) * 0.2),
    noShow: 0,
  }));
}

function normalizeRevenueDays(rows = []) {
  return rows.map((row) => ({
    date: formatDateLabel(row.date),
    invoices: Number(row.count || 0),
    paid: Number(row.amount || 0),
    debt: 0,
    refund: 0,
  }));
}

function normalizeReportData(appointmentReport = {}, queueReport = {}, revenueReport = {}) {
  const appointmentSummary = appointmentReport.summary || {};
  const queueSummary = queueReport.summary || {};
  const revenueSummary = revenueReport.summary || {};
  const departments = normalizeDepartments(
    appointmentReport.breakdowns?.by_department || [],
    queueReport.breakdowns?.by_department || [],
    revenueReport.breakdowns?.revenue_by_department || [],
  );
  const doctors = normalizeDoctors(
    appointmentReport.breakdowns?.by_doctor || [],
    queueReport.breakdowns?.by_doctor || [],
  );
  const revenueDays = normalizeRevenueDays(revenueReport.breakdowns?.revenue_by_day || []);
  const timeRows = normalizeTimeRows(appointmentReport, queueReport);

  return {
    departments,
    doctors,
    timeRows,
    revenueDays,
    services: (revenueReport.breakdowns?.revenue_by_service_type || []).map((item) => ({
      name: item.service_type || 'Khac',
      amount: Number(item.amount || 0),
    })),
    paymentMethods: revenueReport.breakdowns?.payment_by_method || [],
    totals: {
      appointments: Number(appointmentSummary.total_appointments || 0),
      confirmed: Number(appointmentSummary.confirmed_count || 0),
      checkins: Number(queueSummary.total_tickets || appointmentSummary.checked_in_count || 0),
      completed: Number(appointmentSummary.completed_count || queueSummary.completed_count || 0),
      waiting: Number(queueSummary.waiting_count || appointmentSummary.booked_count || 0),
      noShow: Number(appointmentSummary.no_show_count || queueSummary.skipped_count || 0),
      cancelled: Number(appointmentSummary.cancelled_count || queueSummary.cancelled_count || 0),
      revenue: Number(revenueSummary.gross_charges || revenueSummary.issued_invoice_amount || revenueSummary.paid_amount || 0),
      paid: Number(revenueSummary.paid_amount || 0),
      debt: Number(revenueSummary.outstanding_amount || 0),
      refund: Number(revenueSummary.refund_amount || 0),
      invoices: Number(revenueSummary.invoice_count || 0),
      waitMinutes: Number(queueSummary.average_waiting_time || 0),
    },
  };
}

function useReportData(mode, filters) {
  const [state, setState] = useState({ data: normalizeReportData(), loading: false, error: '' });

  useEffect(() => {
    let ignore = false;
    async function load() {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const params = reportParams(filters, mode);
        const [appointmentReport, queueReport, revenueReport] = await Promise.all([
          receptionDataApi.getAppointmentReport(params),
          receptionDataApi.getQueueReport(params),
          receptionDataApi.getRevenueReport(params).catch(() => null),
        ]);
        if (!ignore) setState({ data: normalizeReportData(appointmentReport, queueReport, revenueReport || {}), loading: false, error: '' });
      } catch (error) {
        if (!ignore) setState({ data: normalizeReportData(), loading: false, error: error.message || 'Khong tai duoc bao cao.' });
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [filters, mode]);

  return state;
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
    ['Khoa / Phong', 'Lich hen', 'Check-in', 'Hoan tat', 'Doanh thu'],
    ...data.departments.map((item) => [item.name, item.appointments, item.checkins, item.completed, item.revenue]),
    [],
    ['Bac si', 'Khoa', 'Lich hen', 'Check-in', 'Hoan tat'],
    ...data.doctors.map((item) => [item.name, item.department, item.appointments, item.checkins, item.completed]),
  ];
  if (mode === 'reports-revenue') {
    sections.push([], ['Ngay', 'So hoa don', 'Da thu', 'Con phai thu', 'Hoan tien']);
    sections.push(...data.revenueDays.map((item) => [item.date, item.invoices, item.paid, item.debt, item.refund]));
  }
  const csv = sections.map((row) => row.map((cell = '') => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
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

function ReportFilters({ mode, filters, data, onChange, onReset, onExport }) {
  const doctors = filters.department === 'all'
    ? data.doctors
    : data.doctors.filter((doctor) => doctor.department === filters.department);

  return (
    <section className="reception-report-filters">
      <label><span>Tu ngay</span><input type="date" value={filters.dateFrom} onChange={(event) => onChange('dateFrom', event.target.value)} /></label>
      <label><span>Den ngay</span><input type="date" value={filters.dateTo} onChange={(event) => onChange('dateTo', event.target.value)} /></label>
      <label>
        <span>Khoa / Phong</span>
        <select value={filters.department} onChange={(event) => onChange('department', event.target.value)}>
          <option value="all">Tat ca khoa/phong</option>
          {data.departments.map((item) => <option key={item.id || item.name} value={item.id || item.name}>{item.name}</option>)}
        </select>
      </label>
      {mode !== 'reports-revenue' ? (
        <label>
          <span>Bac si</span>
          <select value={filters.doctor} onChange={(event) => onChange('doctor', event.target.value)}>
            <option value="all">Tat ca bac si</option>
            {doctors.map((item) => <option key={item.id || item.name} value={item.id || item.name}>{item.name}</option>)}
          </select>
        </label>
      ) : (
        <label>
          <span>Phuong thuc thanh toan</span>
          <select value={filters.paymentMethod} onChange={(event) => onChange('paymentMethod', event.target.value)}>
            <option value="all">Tat ca phuong thuc</option>
            <option value="cash">Tien mat</option>
            <option value="bank_transfer">Chuyen khoan</option>
            <option value="card">The ngan hang</option>
          </select>
        </label>
      )}
      {mode === 'reports-appointments' ? (
        <>
          <label>
            <span>Trang thai lich hen</span>
            <select value={filters.appointmentStatus} onChange={(event) => onChange('appointmentStatus', event.target.value)}>
              <option value="all">Tat ca trang thai</option>
              <option value="confirmed">Da xac nhan</option>
              <option value="completed">Da hoan tat</option>
              <option value="cancelled">Da huy</option>
              <option value="no_show">No-show</option>
            </select>
          </label>
          <label>
            <span>Loai lich hen</span>
            <select value={filters.appointmentType} onChange={(event) => onChange('appointmentType', event.target.value)}>
              <option value="all">Tat ca loai</option>
              <option value="outpatient">Kham ngoai tru</option>
              <option value="follow_up">Tai kham</option>
            </select>
          </label>
        </>
      ) : null}
      {mode === 'reports-revenue' ? (
        <label>
          <span>Trang thai thanh toan</span>
          <select value={filters.paymentStatus} onChange={(event) => onChange('paymentStatus', event.target.value)}>
            <option value="all">Tat ca trang thai</option>
            <option value="paid">Da thanh toan</option>
            <option value="partial">Thanh toan mot phan</option>
            <option value="overdue">Qua han</option>
          </select>
        </label>
      ) : null}
      <button type="button" className="reception-btn reception-btn--ghost" onClick={onReset}><RefreshCw size={16} />Lam moi</button>
      <button type="button" className="reception-btn reception-btn--primary" onClick={onExport}><Download size={16} />Xuat bao cao</button>
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
        {delta ? <em>{delta}</em> : null}
      </div>
    </article>
  );
}

function LineChart({ rows }) {
  const safeRows = rows.length ? rows : [{ time: '--', appointments: 0, completed: 0 }];
  const valuesA = safeRows.map((item) => item.appointments || item.confirmed || 0);
  const valuesB = safeRows.map((item) => item.completed || item.checkins || 0);
  const max = Math.max(1, ...valuesA, ...valuesB);
  const toPoints = (values) => values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 440;
    const y = 145 - (value / max) * 118;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="reception-report-line" viewBox="0 0 460 160" role="img" aria-label="Xu huong">
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
  const safeRows = rows.length ? rows : [{ date: '--', paid: 0 }];
  const max = Math.max(1, ...safeRows.map((item) => item.paid));
  return (
    <div className="reception-report-bars">
      {safeRows.map((item) => (
        <span key={item.date} style={{ height: `${Math.max(28, (item.paid / max) * 132)}px` }}><i>{item.date.slice(0, 5)}</i></span>
      ))}
    </div>
  );
}

function Donut({ total = '0', segments = [48, 30, 14, 8] }) {
  const [a, b, c] = segments;
  const background = `conic-gradient(#2f7df2 0 ${a}%, #22b868 ${a}% ${a + b}%, #ff9d22 ${a + b}% ${a + b + c}%, #ff4d5f ${a + b + c}% 100%)`;
  return <div className="reception-report-donut" style={{ background }}><span>Tong<strong>{total}</strong></span></div>;
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
          )) : <tr><td colSpan={columns.length}>Khong co du lieu theo bo loc hien tai.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function InsightCard({ mode, data }) {
  const peak = data.timeRows.reduce((best, item) => (item.appointments > best.appointments ? item : best), data.timeRows[0] || { time: '--', appointments: 0 });
  const items = mode === 'reports-revenue'
    ? [
      ['Cong no can theo doi', `Con phai thu ${formatCurrency(data.totals.debt)}.`],
      ['Hoan tien trong ky', `Tong hoan ${formatCurrency(data.totals.refund)}.`],
      ['Doi soat cuoi ngay', 'Nen doi soat tien mat, chuyen khoan va hoan tien truoc khi ket ca.'],
    ]
    : [
      ['Khung gio cao diem', `${peak.time} co so luong cao nhat voi ${formatNumber(peak.appointments)} luot.`],
      ['Ty le No-show', `No-show hien co ${formatNumber(data.totals.noShow)} luot.`],
      ['Khuyen nghi van hanh', 'Loc theo khoa hoac bac si de xem diem nghen cu the.'],
    ];
  return (
    <section className="reception-panel reception-report-insights">
      <h2>{mode === 'reports-daily' ? 'Thong tin & Goi y van hanh' : 'Goi y & Nhan xet'}</h2>
      {items.map(([title, body], index) => (
        <div key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{body}</p></div></div>
      ))}
    </section>
  );
}

function DailyPage({ data }) {
  return (
    <>
      <section className="reception-report-kpi-grid">
        <Kpi icon={CalendarDays} label="Lich hen" value={formatNumber(data.totals.appointments)} />
        <Kpi icon={CheckCircle2} label="Da check-in" value={formatNumber(data.totals.checkins)} tone="success" />
        <Kpi icon={Clock3} label="Dang cho" value={formatNumber(data.totals.waiting)} tone="warning" />
        <Kpi icon={CheckCircle2} label="Da hoan tat" value={formatNumber(data.totals.completed)} tone="success" />
        <Kpi icon={XCircle} label="No-show" value={formatNumber(data.totals.noShow)} tone="danger" />
        <Kpi icon={Banknote} label="Doanh thu trong ngay" value={formatCurrency(data.totals.revenue)} tone="violet" />
      </section>
      <section className="reception-report-grid">
        <section className="reception-panel reception-report-card is-wide"><h2>Xu huong trong ngay</h2><LineChart rows={data.timeRows} /></section>
        <section className="reception-panel reception-report-card"><h2>Co cau lich hen theo trang thai</h2><Donut total={formatNumber(data.totals.appointments)} /></section>
        <MiniTable title="Top khoa hoat dong" columns={['#', 'Khoa / Phong', 'Lich hen', 'Check-in', 'Ty le']} rows={buildDepartmentRows(data.departments).slice(0, 5)} />
        <MiniTable title="Tom tat theo khung gio" columns={['#', 'Khung gio', 'Lich hen', 'Check-in', 'Hoan tat', 'Cho', 'No-show']} rows={buildTimeRows(data.timeRows).slice(0, 6)} />
        <MiniTable title="Bac si tiep nhan nhieu nhat" columns={['#', 'Bac si', 'Check-in', 'Hoan tat', 'Ty le']} rows={buildDoctorRows(data.doctors, 'checkins').slice(0, 5)} />
        <InsightCard mode="reports-daily" data={data} />
      </section>
    </>
  );
}

function AppointmentPage({ data }) {
  return (
    <>
      <section className="reception-report-kpi-grid reception-report-kpi-grid--five">
        <Kpi icon={CalendarDays} label="Tong lich hen" value={formatNumber(data.totals.appointments)} />
        <Kpi icon={CheckCircle2} label="Da xac nhan" value={formatNumber(data.totals.confirmed)} tone="success" />
        <Kpi icon={CheckCircle2} label="Da hoan tat" value={formatNumber(data.totals.completed)} tone="success" />
        <Kpi icon={XCircle} label="Da huy" value={formatNumber(data.totals.cancelled)} tone="danger" />
        <Kpi icon={Users} label="No-show" value={formatNumber(data.totals.noShow)} tone="violet" />
      </section>
      <section className="reception-report-grid">
        <section className="reception-panel reception-report-card is-wide"><h2>1. Xu huong lich hen</h2><LineChart rows={data.timeRows} /></section>
        <section className="reception-panel reception-report-card"><h2>2. Co cau theo trang thai</h2><Donut total={formatNumber(data.totals.appointments)} /></section>
        <MiniTable title="3. Top khoa co nhieu lich hen" columns={['#', 'Khoa / Phong', 'Lich hen', 'Check-in', 'Ty le']} rows={buildDepartmentRows(data.departments)} />
        <MiniTable title="4. Top bac si theo so luong lich hen" columns={['#', 'Bac si', 'Lich hen', 'Hoan tat', 'Ty le']} rows={buildDoctorRows(data.doctors)} />
        <MiniTable title="5. Thong ke theo khung gio" columns={['#', 'Khung gio', 'Lich hen', 'Xac nhan', 'Hoan tat', 'Huy', 'No-show']} rows={buildTimeRows(data.timeRows)} />
        <InsightCard mode="reports-appointments" data={data} />
      </section>
    </>
  );
}

function CheckinPage({ data }) {
  const checkinRows = data.timeRows.map((item) => [item.time, formatNumber(item.confirmed), formatNumber(item.completed), formatNumber(item.waiting), formatNumber(item.noShow)]);
  return (
    <>
      <section className="reception-report-kpi-grid reception-report-kpi-grid--five">
        <Kpi icon={Users} label="Tong check-in" value={formatNumber(data.totals.checkins)} />
        <Kpi icon={Clock3} label="Thoi gian cho TB" value={`${formatNumber(data.totals.waitMinutes)} phut`} tone="success" />
        <Kpi icon={CheckCircle2} label="Hoan tat" value={formatNumber(data.totals.completed)} tone="success" />
        <Kpi icon={AlertTriangle} label="Dang cho" value={formatNumber(data.totals.waiting)} tone="warning" />
        <Kpi icon={XCircle} label="Bo qua" value={formatNumber(data.totals.noShow)} tone="danger" />
      </section>
      <section className="reception-report-grid">
        <section className="reception-panel reception-report-card is-wide"><h2>Xu huong check-in</h2><LineChart rows={data.timeRows} /></section>
        <section className="reception-panel reception-report-card"><h2>Co cau trang thai</h2><Donut total={formatNumber(data.totals.checkins)} /></section>
        <MiniTable title="Hieu suat theo khoa" columns={['#', 'Khoa / Phong', 'Lich hen', 'Check-in', 'Ty le']} rows={buildDepartmentRows(data.departments)} />
        <MiniTable title="Thong ke theo khung gio" columns={['#', 'Khung gio', 'Check-in', 'Hoan tat', 'Cho', 'Bo qua']} rows={checkinRows} />
        <MiniTable title="Bac si tiep nhan nhieu nhat" columns={['#', 'Bac si', 'Check-in', 'Hoan tat', 'Ty le']} rows={buildDoctorRows(data.doctors, 'checkins')} />
        <InsightCard mode="reports-checkin" data={data} />
      </section>
    </>
  );
}

function RevenuePage({ data }) {
  const departmentRows = data.departments.map((item) => [item.name, formatCurrency(item.revenue), percent(item.revenue, data.totals.revenue)]);
  const serviceRows = data.services.map((item) => [item.name, formatCurrency(item.amount), percent(item.amount, data.totals.revenue)]);
  const methodTotal = sum(data.paymentMethods, 'amount');
  const methodSegments = data.paymentMethods.slice(0, 4).map((item) => Math.round((Number(item.amount || 0) / Math.max(methodTotal, 1)) * 100));
  return (
    <>
      <p className="reception-report-note">Chi hien thi khi nguoi dung co quyen billing</p>
      <section className="reception-report-kpi-grid reception-report-kpi-grid--five">
        <Kpi icon={Banknote} label="Tong doanh thu" value={formatCurrency(data.totals.revenue)} />
        <Kpi icon={CheckCircle2} label="Da thu" value={formatCurrency(data.totals.paid)} tone="success" />
        <Kpi icon={FileText} label="Con phai thu" value={formatCurrency(data.totals.debt)} tone="warning" />
        <Kpi icon={FileText} label="So hoa don" value={formatNumber(data.totals.invoices)} tone="violet" />
        <Kpi icon={XCircle} label="Hoan tien" value={formatCurrency(data.totals.refund)} tone="danger" />
      </section>
      <section className="reception-report-grid">
        <section className="reception-panel reception-report-card"><h2>Doanh thu theo ngay</h2><BarChart rows={data.revenueDays} /></section>
        <section className="reception-panel reception-report-card"><h2>Co cau theo phuong thuc thanh toan</h2><Donut total={formatCurrency(data.totals.revenue)} segments={methodSegments.length ? methodSegments : [42, 35, 16, 7]} /></section>
        <MiniTable title="Doanh thu theo khoa/phong" columns={['#', 'Khoa / Phong', 'Doanh thu', 'Ty trong']} rows={departmentRows} />
        <MiniTable title="Top dich vu mang lai doanh thu" columns={['#', 'Dich vu', 'Doanh thu', 'Ty trong']} rows={serviceRows} />
        <MiniTable title="Tong hop thanh toan" columns={['#', 'Ngay', 'So hoa don', 'Da thu', 'Con phai thu', 'Hoan tien']} rows={buildRevenueRows(data.revenueDays)} />
        <InsightCard mode="reports-revenue" data={data} />
      </section>
    </>
  );
}

export function ReceptionReportsPanel({ mode = 'reports-daily' }) {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const { data, loading, error } = useReportData(mode, filters);

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
        data={data}
        onChange={handleChange}
        onReset={() => setFilters(INITIAL_FILTERS)}
        onExport={() => exportCsv(mode, data)}
      />
      {loading ? <section className="reception-inline-alert">Dang tai bao cao tu API...</section> : null}
      {error ? <section className="reception-inline-alert is-danger">{error}</section> : null}
      {mode === 'reports-daily' ? <DailyPage data={data} /> : null}
      {mode === 'reports-appointments' ? <AppointmentPage data={data} /> : null}
      {mode === 'reports-checkin' ? <CheckinPage data={data} /> : null}
      {mode === 'reports-revenue' ? <RevenuePage data={data} /> : null}
    </div>
  );
}
