import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Stethoscope,
  TimerReset,
} from 'lucide-react';
import { reportsOverviewApi } from '../api/reportsOverviewApi';
import {
  formatByUnit,
  formatCurrency,
  formatDateTime,
  formatMinutes,
  formatNumber,
  formatPercent,
  getMetricLabel,
  metricUnit,
  safeNumber,
  statusLabel,
} from '../utils/formatters';

const ICONS = [CalendarDays, CheckCircle2, Stethoscope, Activity, Clock3, TimerReset, BarChart3, ShieldAlert];

export function ExecutiveFilterBar({
  title,
  subtitle,
  filters,
  onChange,
  onRefresh,
  isRefreshing,
  lastUpdatedAt,
  exportType = 'appointments',
  showPeriod = true,
}) {
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  function update(field, value) {
    onChange({ [field]: value, ...(field === 'range' && value !== 'custom' ? { date_from: '', date_to: '', period: value } : {}) });
  }

  return (
    <div className="executive-page-header">
      <div className="executive-page-header__copy">
        <span>Báo cáo & Phân tích</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="executive-page-header__tools">
        {showPeriod ? (
          <select value={filters.range || filters.period || 'today'} onChange={(event) => update('range', event.target.value)} aria-label="Chọn kỳ báo cáo">
            <option value="today">Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="quarter">Quý này</option>
            <option value="7d">7 ngày</option>
            <option value="30d">30 ngày</option>
            <option value="custom">Tùy chỉnh</option>
          </select>
        ) : null}
        {filters.range === 'custom' ? (
          <>
            <input type="date" value={filters.date_from || ''} onChange={(event) => update('date_from', event.target.value)} aria-label="Từ ngày" />
            <input type="date" value={filters.date_to || ''} onChange={(event) => update('date_to', event.target.value)} aria-label="Đến ngày" />
          </>
        ) : null}
        <input value={filters.department_id || ''} onChange={(event) => update('department_id', event.target.value)} placeholder="Mã khoa/phòng" aria-label="Lọc khoa phòng" />
        <input value={filters.doctor_id || ''} onChange={(event) => update('doctor_id', event.target.value)} placeholder="Mã bác sĩ" aria-label="Lọc bác sĩ" />
        <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)} aria-label="Trạng thái">
          <option value="">Tất cả trạng thái</option>
          <option value="completed">Hoàn tất</option>
          <option value="cancelled">Đã hủy</option>
          <option value="waiting">Đang chờ</option>
          <option value="in_progress">Đang xử lý</option>
        </select>
        <select value={filters.timezone || 'Asia/Ho_Chi_Minh'} onChange={(event) => update('timezone', event.target.value)} aria-label="Múi giờ">
          <option value="Asia/Ho_Chi_Minh">Asia/Saigon</option>
          <option value="UTC">UTC</option>
        </select>
        <button type="button" className="executive-button executive-button--soft" onClick={() => setIsAutoRefresh((current) => !current)}>
          <Filter size={16} />
          {isAutoRefresh ? 'Auto refresh bật' : 'Auto refresh tắt'}
        </button>
        <button type="button" className="executive-button executive-button--soft" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw size={16} className={isRefreshing ? 'is-spinning' : ''} />
          Refresh
        </button>
        <ExportReportButton filters={filters} reportType={exportType} />
        <span className="executive-updated">Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
      </div>
    </div>
  );
}

export function ExportReportButton({ filters, reportType = 'appointments' }) {
  const [state, setState] = useState('idle');

  async function handleExport(format) {
    setState('loading');
    try {
      const result = await reportsOverviewApi.exportReport({ ...filters, report_type: reportType, type: reportType, format });
      if (format === 'csv' && result?.content) {
        const blob = new Blob([result.content], { type: result.content_type || 'text/csv' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = result.filename || `${reportType}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(result?.data || result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${reportType}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      setState('done');
      window.setTimeout(() => setState('idle'), 1400);
    } catch (error) {
      setState('error');
      window.setTimeout(() => setState('idle'), 1800);
    }
  }

  return (
    <div className="executive-export">
      <button type="button" className="executive-button" onClick={() => handleExport('csv')} disabled={state === 'loading'}>
        <Download size={16} />
        {state === 'loading' ? 'Đang export' : state === 'error' ? 'Export lỗi' : 'CSV'}
      </button>
      <button type="button" className="executive-button executive-button--soft" onClick={() => handleExport('json')} disabled={state === 'loading'}>
        JSON
      </button>
    </div>
  );
}

export function ExecutiveKpiCard({ card, index = 0, onClick }) {
  const Icon = ICONS[index % ICONS.length];
  return (
    <button type="button" className={`executive-kpi-card status-${card.status || 'neutral'}`} onClick={onClick}>
      <span className="executive-kpi-card__icon"><Icon size={20} /></span>
      <span className="executive-kpi-card__value">{formatByUnit(card.value, card.unit)}</span>
      <span className="executive-kpi-card__label">{card.label}</span>
      <span className="executive-kpi-card__meta">
        {card.trend === 'down' ? <ArrowDown size={14} /> : card.trend === 'up' ? <ArrowUp size={14} /> : <Activity size={14} />}
        {statusLabel(card.status)}
      </span>
    </button>
  );
}

export function HealthScoreCard({ title, health }) {
  const score = Math.max(0, Math.min(100, safeNumber(health?.score)));
  return (
    <div className={`executive-health-card status-${health?.status || 'neutral'}`}>
      <div>
        <span>{title}</span>
        <strong>{formatNumber(score)}/100</strong>
      </div>
      <div className="executive-health-card__bar"><span style={{ width: `${score}%` }} /></div>
    </div>
  );
}

export function ReportSectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`executive-section-card ${className}`}>
      <header>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function TrendChart({ data = [], series = [], type = 'line' }) {
  const rows = Array.isArray(data) ? data : [];
  const max = Math.max(1, ...rows.flatMap((row) => series.map((item) => safeNumber(row[item.key]))));
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu biểu đồ" />;

  if (type === 'donut') {
    const total = rows.reduce((sum, row) => sum + safeNumber(row.count || row.value), 0) || 1;
    return (
      <div className="executive-donut-list">
        {rows.slice(0, 7).map((row, index) => (
          <div key={`${row.status || row.label || index}`} className="executive-donut-row">
            <span className={`dot dot-${index}`} />
            <strong>{row.status || row.label || row.category || 'Khác'}</strong>
            <span>{formatPercent((safeNumber(row.count || row.value) / total) * 100)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'bar') {
    return (
      <div className="executive-bar-chart">
        {rows.slice(0, 10).map((row, index) => {
          const value = safeNumber(row.value || row.count || row.amount);
          return (
            <div key={`${row.label || row.date || index}`} className="executive-bar-chart__row">
              <span>{row.label || row.date || row.hour || 'Khác'}</span>
              <div><i style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div>
              <strong>{formatNumber(value)}</strong>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="executive-line-chart" style={{ '--points': rows.length }}>
      {series.map((item, seriesIndex) => (
        <div key={item.key} className={`executive-line-chart__series series-${seriesIndex}`}>
          {rows.map((row, index) => (
            <span
              key={`${item.key}-${row.date || index}`}
              title={`${item.label}: ${formatNumber(row[item.key])}`}
              style={{
                left: `${rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100}%`,
                bottom: `${(safeNumber(row[item.key]) / max) * 86 + 7}%`,
              }}
            />
          ))}
        </div>
      ))}
      <div className="executive-line-chart__axis">
        {rows.slice(0, 8).map((row, index) => <span key={`${row.date}-${index}`}>{String(row.date || '').slice(5)}</span>)}
      </div>
    </div>
  );
}

export function ComparisonTable({ metrics = {} }) {
  const rows = Object.entries(metrics || {});
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu so sánh" />;
  return (
    <div className="executive-table-wrap">
      <table className="executive-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Hiện tại</th>
            <th>Kỳ trước</th>
            <th>Chênh lệch</th>
            <th>Xu hướng</th>
            <th>Diễn giải</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, value]) => {
            const unit = metricUnit(key);
            return (
              <tr key={key}>
                <td>{getMetricLabel(key)}</td>
                <td>{formatByUnit(value.current, unit)}</td>
                <td>{formatByUnit(value.previous, unit)}</td>
                <td>{formatByUnit(value.change, unit)} {value.change_percent !== null ? `(${formatPercent(value.change_percent)})` : ''}</td>
                <td><span className={`executive-badge status-${value.status}`}>{value.direction}</span></td>
                <td>{value.status === 'danger' ? 'Biến động bất lợi, cần kiểm tra nguyên nhân.' : value.status === 'good' ? 'Biến động tích cực.' : 'Ổn định hoặc thiếu dữ liệu kỳ trước.'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AnomalyAlertTable({ items = [] }) {
  if (!items.length) return <ReportEmptyState title="Chưa phát hiện bất thường" description="Các rule hiện tại chưa ghi nhận chỉ số vượt ngưỡng." />;
  return (
    <div className="executive-table-wrap">
      <table className="executive-table">
        <thead>
          <tr>
            <th>Mức</th>
            <th>Module</th>
            <th>Cảnh báo</th>
            <th>Metric</th>
            <th>Hiện tại</th>
            <th>Ngưỡng</th>
            <th>Thao tác gợi ý</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.module}-${item.metric}-${index}`}>
              <td><span className={`executive-badge severity-${item.severity}`}>{item.severity}</span></td>
              <td>{item.module}</td>
              <td>{item.title}</td>
              <td>{item.metric}</td>
              <td>{formatNumber(item.current)}</td>
              <td>{formatNumber(item.threshold)}</td>
              <td>{item.suggested_action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ActionItemBoard({ items = [], groups }) {
  const grouped = groups || {
    now: items.filter((item) => item.priority === 'now'),
    today: items.filter((item) => item.priority === 'today'),
    watch: items.filter((item) => item.priority === 'watch'),
    stable: items.filter((item) => item.priority === 'stable'),
  };
  const columns = [
    ['now', 'Cần xử lý ngay'],
    ['today', 'Trong hôm nay'],
    ['watch', 'Theo dõi'],
    ['stable', 'Đã ổn'],
  ];
  return (
    <div className="executive-kanban">
      {columns.map(([key, label]) => (
        <section key={key} className="executive-kanban__column">
          <header>
            <strong>{label}</strong>
            <span>{formatNumber(grouped[key]?.length || 0)}</span>
          </header>
          {(grouped[key] || []).length ? (grouped[key] || []).map((item) => (
            <article key={item.id} className={`executive-task-card severity-${item.severity}`}>
              <div>
                <span>{item.module}</span>
                <strong>{item.title}</strong>
              </div>
              <p>{item.description}</p>
              <footer>
                <span>{item.source || 'rule_engine'}</span>
                <span>{formatDateTime(item.due_at)}</span>
              </footer>
            </article>
          )) : <ReportEmptyState title="Không có việc" compact />}
        </section>
      ))}
    </div>
  );
}

export function RankingTable({ rows = [], type = 'department' }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có dữ liệu xếp hạng" compact />;
  return (
    <div className="executive-ranking">
      {rows.slice(0, 8).map((row, index) => (
        <button type="button" key={`${row.label}-${index}`}>
          <span>{index + 1}</span>
          <strong>{row.label || row.department_name || row.doctor_name || 'Chưa xác định'}</strong>
          <em>{formatNumber(row.value || row.count || row.appointment_count || row.encounter_count)}</em>
          <small>{type === 'doctor' ? 'Bác sĩ' : 'Khoa/phòng'}</small>
        </button>
      ))}
    </div>
  );
}

export const DepartmentRankingTable = (props) => <RankingTable {...props} type="department" />;
export const DoctorRankingTable = (props) => <RankingTable {...props} type="doctor" />;

export function KpiDetailTable({ groups = [] }) {
  const rows = groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })));
  return (
    <div className="executive-table-wrap">
      <table className="executive-table">
        <thead>
          <tr>
            <th>Nhóm</th>
            <th>KPI</th>
            <th>Actual</th>
            <th>Target</th>
            <th>Status</th>
            <th>Impact</th>
            <th>Suggested action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.group}-${row.label}`}>
              <td>{row.group}</td>
              <td>{row.label}</td>
              <td>{formatByUnit(row.value, row.unit)}</td>
              <td>Chưa cấu hình</td>
              <td><span className={`executive-badge status-${row.status || 'neutral'}`}>{statusLabel(row.status)}</span></td>
              <td>{row.impact || 'Theo dõi vận hành'}</td>
              <td>{row.action || 'TODO backend: cấu hình target và khuyến nghị theo vai trò.'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DataErrorStrip({ errors = [] }) {
  if (!errors?.length) return null;
  return (
    <div className="executive-data-errors">
      <AlertTriangle size={18} />
      <span>{formatNumber(errors.length)} nguồn dữ liệu chưa tải được. UI đang hiển thị phần dữ liệu còn lại.</span>
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="executive-skeleton">
      {Array.from({ length: 12 }).map((_, index) => <span key={index} />)}
    </div>
  );
}

export function ReportEmptyState({ title = 'Chưa có dữ liệu', description = 'Thử đổi bộ lọc hoặc refresh lại báo cáo.', compact = false }) {
  return (
    <div className={`executive-empty${compact ? ' is-compact' : ''}`}>
      <Search size={compact ? 16 : 24} />
      <strong>{title}</strong>
      {!compact ? <p>{description}</p> : null}
    </div>
  );
}

export function ReportErrorState({ error, onRetry }) {
  return (
    <div className="executive-error">
      <AlertTriangle size={30} />
      <strong>{error?.status === 403 ? 'Bạn không có quyền xem báo cáo này' : 'Không thể tải báo cáo'}</strong>
      <p>{error?.message || 'Vui lòng thử lại sau.'}</p>
      <button type="button" className="executive-button" onClick={onRetry}>Thử lại</button>
    </div>
  );
}

export function DrilldownKpiGrid({ cards = [] }) {
  const navigate = useNavigate();
  const routeByModule = {
    appointments: '/reports/clinical-operations/appointments',
    queue: '/reports/clinical-operations/queue',
    encounters: '/reports/clinical-operations/visits-encounters',
    finance: '/reports/finance-billing/revenue',
    inventory: '/reports/pharmacy-inventory/stock',
    quality: '/reports/quality-risk/critical-alerts',
    clinical_ops: '/reports/clinical-services/overdue-orders',
    notifications: '/reports/quality-risk/notification-delivery',
  };
  return (
    <div className="executive-kpi-grid">
      {cards.map((card, index) => (
        <ExecutiveKpiCard
          key={card.key || card.label}
          card={card}
          index={index}
          onClick={() => navigate(routeByModule[card.module] || '/reports/overview/dashboard')}
        />
      ))}
    </div>
  );
}

export function FinanceMiniTable({ revenue = {} }) {
  const summary = revenue.summary || {};
  const rows = [
    ['Gross charges', summary.gross_charges || summary.charge_amount],
    ['Issued invoice amount', summary.issued_invoice_amount || summary.invoice_amount],
    ['Paid amount', summary.paid_amount || summary.total_paid],
    ['Outstanding amount', summary.outstanding_amount || summary.balance_due],
    ['Payment count', summary.payment_count],
    ['Refund amount', summary.refund_amount],
    ['Voided amount', summary.voided_amount],
  ];
  return (
    <div className="executive-mini-list">
      {rows.map(([label, value]) => (
        <span key={label}><strong>{label}</strong><em>{label.includes('amount') || label.includes('charges') ? formatCurrency(value) : formatNumber(value)}</em></span>
      ))}
    </div>
  );
}

export function PeakHourHeatmap({ rows = [] }) {
  if (!rows.length) return <ReportEmptyState title="Chưa có peak hours" compact />;
  const max = Math.max(1, ...rows.map((row) => safeNumber(row.count || row.value)));
  return (
    <div className="executive-heatmap">
      {rows.map((row, index) => (
        <span key={`${row.hour}-${index}`} style={{ opacity: 0.35 + (safeNumber(row.count || row.value) / max) * 0.65 }}>
          <strong>{row.hour || row.label}</strong>
          <em>{formatNumber(row.count || row.value)}</em>
        </span>
      ))}
    </div>
  );
}

export function buildKpiGroups(kpis = {}) {
  const appointments = kpis.appointments || {};
  const queue = kpis.queue || {};
  const encounters = kpis.encounters || {};
  const finance = kpis.finance || {};
  const inventory = kpis.inventory || {};
  const quality = kpis.quality || {};
  return [
    {
      title: 'Vận hành',
      items: [
        ['Tổng lịch hẹn', appointments.total_appointments],
        ['Booked', appointments.booked_count],
        ['Confirmed', appointments.confirmed_count],
        ['Checked-in', appointments.checked_in_count],
        ['Completed', appointments.completed_count],
        ['No-show', appointments.no_show_count, 'danger'],
        ['Cancellation rate', appointments.cancellation_rate, 'warning', 'percent'],
        ['Completion rate', appointments.completion_rate, 'good', 'percent'],
      ].map(([label, value, status = 'neutral', unit]) => ({ label, value, status, unit })),
    },
    {
      title: 'Queue',
      items: [
        ['Total tickets', queue.total_tickets],
        ['Waiting', queue.waiting_count, 'warning'],
        ['Called', queue.called_count],
        ['In service', queue.in_service_count],
        ['Skipped', queue.skipped_count, 'warning'],
        ['Recalled', queue.recalled_count],
        ['Average waiting time', queue.average_waiting_time, safeNumber(queue.average_waiting_time) > 30 ? 'danger' : 'good', 'minutes'],
        ['Average service time', queue.average_service_time, 'neutral', 'minutes'],
      ].map(([label, value, status = 'neutral', unit]) => ({ label, value, status, unit })),
    },
    {
      title: 'Encounter',
      items: [
        ['Total encounters', encounters.total_encounters],
        ['Planned', encounters.planned_count],
        ['Arrived', encounters.arrived_count],
        ['In progress', encounters.in_progress_count],
        ['On hold', encounters.on_hold_count, 'warning'],
        ['Completed', encounters.completed_count, 'good'],
        ['Cancelled', encounters.cancelled_count, 'warning'],
        ['Average duration', encounters.average_duration || encounters.average_consultation_duration, 'neutral', 'minutes'],
      ].map(([label, value, status = 'neutral', unit]) => ({ label, value, status, unit })),
    },
    {
      title: 'Tài chính',
      items: [
        ['Gross charges', finance.gross_charges || finance.charge_amount, 'neutral', 'currency'],
        ['Issued invoice amount', finance.issued_invoice_amount || finance.invoice_amount, 'neutral', 'currency'],
        ['Paid amount', finance.paid_amount || finance.total_paid, 'good', 'currency'],
        ['Outstanding amount', finance.outstanding_amount || finance.balance_due, 'warning', 'currency'],
        ['Payment count', finance.payment_count],
        ['Refund amount', finance.refund_amount, 'warning', 'currency'],
        ['Voided amount', finance.voided_amount, 'warning', 'currency'],
      ].map(([label, value, status = 'neutral', unit]) => ({ label, value, status, unit })),
    },
    {
      title: 'Kho',
      items: [
        ['Total medications', inventory.total_medications],
        ['Total batches', inventory.total_batches],
        ['Low stock items', inventory.low_stock_items, 'warning'],
        ['Near expiry batches', inventory.near_expiry_batches, 'warning'],
        ['Expired batches', inventory.expired_batches, 'danger'],
        ['Recalled batches', inventory.recalled_batches, 'danger'],
        ['Inventory value', inventory.inventory_value, 'neutral', 'currency'],
      ].map(([label, value, status = 'neutral', unit]) => ({ label, value, status, unit })),
    },
    {
      title: 'Chất lượng',
      items: [
        ['Critical alerts', quality.critical || quality.critical_open, 'danger'],
        ['Overdue orders', quality.overdue_orders, 'danger'],
        ['Pending approval', quality.pending_approval, 'warning'],
        ['Pending completion', quality.pending_completion, 'warning'],
      ].map(([label, value, status = 'neutral', unit]) => ({ label, value, status, unit })),
    },
  ];
}
