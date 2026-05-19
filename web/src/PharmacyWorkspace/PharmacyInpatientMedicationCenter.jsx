import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Barcode,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Filter,
  HeartPulse,
  History,
  Pill,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  Stethoscope,
  Timer,
  UserCheck,
  X,
} from 'lucide-react';
import { getApiErrorMessage, inpatientMedicationAPI, pharmacyOverviewAPI, unwrapData } from '../utils/api';

const TODAY = new Date().toISOString().slice(0, 10);

const VIEW_CONFIG = {
  schedule: {
    eyebrow: 'Nhà thuốc & Kho dược / Dùng thuốc nội trú',
    title: 'Lịch dùng thuốc nội trú',
    description: 'eMAR timeline toàn khoa theo giờ, bệnh nhân, phòng giường, trạng thái cấp phát, dị ứng, high-alert và audit dùng thuốc.',
    icon: CalendarDays,
  },
  today: {
    eyebrow: 'Nhà thuốc & Kho dược / Dùng thuốc nội trú',
    title: 'Thuốc cần dùng hôm nay',
    description: 'Command center realtime cho liều quá giờ, đến giờ, sắp đến giờ, chưa cấp phát, đang hold và đã xử lý.',
    icon: Timer,
  },
  confirm: {
    eyebrow: 'Nhà thuốc & Kho dược / Dùng thuốc nội trú',
    title: 'Xác nhận dùng thuốc',
    description: 'Workbench 5 đúng kết hợp scan bệnh nhân, scan thuốc, kiểm tra lô, hạn dùng, dị ứng, sinh hiệu và double-check.',
    icon: BadgeCheck,
  },
  exceptions: {
    eyebrow: 'Nhà thuốc & Kho dược / Dùng thuốc nội trú',
    title: 'Tạm hoãn / từ chối / bỏ liều',
    description: 'Quản lý ngoại lệ dùng thuốc, lý do chuẩn hóa, review bác sĩ/dược sĩ, dời lịch và tạo can thiệp dược.',
    icon: AlertTriangle,
  },
  reactions: {
    eyebrow: 'Nhà thuốc & Kho dược / Dùng thuốc nội trú',
    title: 'Bất thường dùng thuốc',
    description: 'Medication safety center cho phản ứng thuốc, nghi dị ứng, high-alert, escalation, review dược và đóng case.',
    icon: ShieldAlert,
  },
};

const STATUS_META = {
  scheduled: { label: 'Chờ dùng', tone: 'info' },
  given: { label: 'Đã dùng', tone: 'success' },
  held: { label: 'Tạm hoãn', tone: 'warning' },
  refused: { label: 'BN từ chối', tone: 'warning' },
  omitted: { label: 'Bỏ liều', tone: 'danger' },
  cancelled: { label: 'Đã hủy', tone: 'muted' },
  entered_in_error: { label: 'Nhập sai', tone: 'danger' },
  pass: { label: 'Pass', tone: 'success' },
  warning: { label: 'Warning', tone: 'warning' },
  fail: { label: 'Fail', tone: 'danger' },
  observed: { label: 'Đã ghi nhận', tone: 'warning' },
  doctor_notified: { label: 'Đã báo bác sĩ', tone: 'info' },
  allergy_recorded: { label: 'Đã tạo dị ứng', tone: 'purple' },
  escalated: { label: 'Escalated', tone: 'danger' },
  resolved: { label: 'Đã xử lý', tone: 'success' },
  mild: { label: 'Nhẹ', tone: 'info' },
  moderate: { label: 'Trung bình', tone: 'warning' },
  severe: { label: 'Nặng', tone: 'danger' },
  life_threatening: { label: 'Nguy kịch', tone: 'danger' },
  critical: { label: 'Critical', tone: 'danger' },
  high: { label: 'High', tone: 'warning' },
  medium: { label: 'Medium', tone: 'info' },
  normal: { label: 'Normal', tone: 'muted' },
};

const QUEUE_COLUMNS = [
  { key: 'overdue', label: 'Quá giờ', icon: AlertTriangle },
  { key: 'due_now', label: 'Đến giờ dùng', icon: Clock3 },
  { key: 'due_next_2h', label: 'Sắp đến giờ', icon: Timer },
  { key: 'not_dispensed', label: 'Chưa đủ thuốc', icon: Pill },
  { key: 'held', label: 'Đang hold', icon: ShieldAlert },
  { key: 'done', label: 'Đã xử lý', icon: CheckCircle2 },
];

function readPayload(response) {
  return unwrapData(response) || {};
}

function readRows(payload, view) {
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.administrations)) return payload.administrations;
  if (view === 'reactions' && Array.isArray(payload.rows)) return payload.rows;
  return [];
}

function parseDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatTime(value) {
  const date = parseDate(value);
  if (!date) return '--:--';
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function patientName(row = {}) {
  const patient = row.patient || row.patient_context?.patient || {};
  return patient.full_name || patient.patient_name || patient.patient_code || 'Chưa rõ bệnh nhân';
}

function patientCode(row = {}) {
  const patient = row.patient || {};
  return patient.patient_code || '--';
}

function medicationName(row = {}) {
  return row.medication_display || row.medication?.brand_name || row.medication?.generic_name || row.medication?.name || row.medication?.medication_code || 'Chưa rõ thuốc';
}

function roomBed(row = {}) {
  return row.room_bed ||
    [row.patient_context?.room?.room_code || row.patient_context?.room?.room_name, row.patient_context?.bed?.bed_code || row.patient_context?.bed?.bed_name]
      .filter(Boolean)
      .join(' / ') ||
    '--';
}

function getRowId(row = {}) {
  return row.id || row.administration_id || row.medication_administration_id || row.reaction_id;
}

function minutesLabel(value) {
  if (value === null || value === undefined || value === '') return '--';
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return '--';
  if (minutes < 0) return `Trễ ${Math.abs(minutes)} phút`;
  if (minutes === 0) return 'Đúng giờ';
  return `Còn ${minutes} phút`;
}

function StatusBadge({ value }) {
  const meta = STATUS_META[value] || { label: value || '--', tone: 'muted' };
  return <span className={`pharmacy-inventory-badge is-${meta.tone}`}>{meta.label}</span>;
}

function RiskBadge({ row }) {
  const priority = row?.safety?.priority || row?.priority || 'normal';
  const meta = STATUS_META[priority] || STATUS_META.normal;
  return <span className={`pharmacy-inventory-badge is-${meta.tone}`}>{meta.label}</span>;
}

function LoadingState({ text = 'Đang tải dữ liệu eMAR nội trú' }) {
  return (
    <div className="pharmacy-inventory-state">
      <RefreshCw size={20} className="is-spinning" />
      <span>{text}</span>
    </div>
  );
}

function EmptyState({ text = 'Không có dữ liệu phù hợp' }) {
  return (
    <div className="pharmacy-inventory-state">
      <FileText size={20} />
      <span>{text}</span>
    </div>
  );
}

function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="pharmacy-inventory-error">
      <AlertTriangle size={17} />
      <span>{error}</span>
    </div>
  );
}

function Header({ config, onRefresh, onAction }) {
  const Icon = config.icon;
  return (
    <header className="emar-header pharmacy-inventory-header">
      <div className="pharmacy-inventory-header__title">
        <span className="pharmacy-inventory-header__crumb">{config.eyebrow}</span>
        <div>
          <span className="pharmacy-inventory-header__mark" aria-hidden="true"><Icon size={24} /></span>
          <h1>{config.title}</h1>
        </div>
        <p>{config.description}</p>
      </div>
      <div className="pharmacy-inventory-header__actions">
        <span className="pharmacy-inventory-sync"><Activity size={15} /> eMAR + safety</span>
        <button type="button" className="pharmacy-inventory-icon-button" aria-label="Refresh" onClick={onRefresh}>
          <RefreshCw size={18} />
        </button>
        {onAction ? (
          <button type="button" className="pharmacy-inventory-button" onClick={onAction}>
            <ScanLine size={16} /> Verify scan
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Filters({ view, filters, setFilters }) {
  return (
    <section className="emar-filters pharmacy-inventory-filters">
      <label className="pharmacy-inventory-search">
        <Filter size={16} />
        <input
          value={filters.search || ''}
          placeholder="Tìm bệnh nhân, thuốc, phòng, batch hoặc triệu chứng"
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
        />
      </label>
      {view !== 'exceptions' ? (
        <input type="date" value={filters.date || TODAY} onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value, page: 1 }))} />
      ) : null}
      {view === 'exceptions' ? (
        <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
          <option value="">Tất cả ngoại lệ</option>
          <option value="held">Tạm hoãn</option>
          <option value="refused">Bệnh nhân từ chối</option>
          <option value="omitted">Bỏ liều</option>
          <option value="entered_in_error">Nhập sai</option>
        </select>
      ) : null}
      {view === 'reactions' ? (
        <>
          <select value={filters.severity || ''} onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value, page: 1 }))}>
            <option value="">Mọi mức độ</option>
            <option value="mild">Nhẹ</option>
            <option value="moderate">Trung bình</option>
            <option value="severe">Nặng</option>
            <option value="life_threatening">Nguy kịch</option>
          </select>
          <select value={filters.status || ''} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value, page: 1 }))}>
            <option value="">Mọi trạng thái</option>
            <option value="observed">Đã ghi nhận</option>
            <option value="doctor_notified">Đã báo bác sĩ</option>
            <option value="allergy_recorded">Đã tạo dị ứng</option>
            <option value="resolved">Đã xử lý</option>
          </select>
        </>
      ) : null}
      <input value={filters.department_id || ''} placeholder="Khoa / department_id" onChange={(event) => setFilters((current) => ({ ...current, department_id: event.target.value, page: 1 }))} />
      <button type="button" className="pharmacy-inventory-button is-secondary" onClick={() => setFilters({ date: TODAY, page: 1, limit: 120 })}>
        Reset
      </button>
    </section>
  );
}

function KpiStrip({ summary = {}, view }) {
  const cards = view === 'reactions'
    ? [
      { key: 'today', label: 'Phản ứng hôm nay', value: summary.today || 0, icon: HeartPulse, tone: 'danger' },
      { key: 'allergy', label: 'Nghi dị ứng mới', value: summary.suspected_allergy || 0, icon: ShieldAlert, tone: 'warning' },
      { key: 'severe', label: 'Phản ứng nặng', value: summary.severe || 0, icon: AlertTriangle, tone: 'danger' },
      { key: 'doctor', label: 'Đã báo bác sĩ', value: summary.doctor_notified || 0, icon: Bell, tone: 'info' },
      { key: 'allergy-created', label: 'Đã tạo allergy', value: summary.allergy_created || 0, icon: BadgeCheck, tone: 'purple' },
      { key: 'unresolved', label: 'Case chưa xử lý', value: summary.unresolved || 0, icon: Clock3, tone: 'warning' },
    ]
    : [
      { key: 'total', label: 'Tổng liều', value: summary.total_doses || summary.total || 0, icon: Pill },
      { key: 'due', label: 'Đến giờ', value: summary.due_now || 0, icon: Clock3, tone: 'info' },
      { key: 'overdue', label: 'Quá giờ', value: summary.overdue || 0, icon: AlertTriangle, tone: 'danger' },
      { key: 'given', label: 'Đã dùng', value: summary.given || 0, icon: CheckCircle2, tone: 'success' },
      { key: 'held', label: 'Tạm hoãn', value: summary.held || 0, icon: ShieldAlert, tone: 'warning' },
      { key: 'refused', label: 'Từ chối', value: summary.refused || 0, icon: UserCheck, tone: 'warning' },
      { key: 'omitted', label: 'Bỏ liều', value: summary.omitted || 0, icon: AlertTriangle, tone: 'danger' },
      { key: 'allergy', label: 'Cảnh báo dị ứng', value: summary.allergy_alerts || 0, icon: HeartPulse, tone: 'danger' },
      { key: 'not-dispensed', label: 'Chưa cấp phát', value: summary.not_dispensed_count || 0, icon: Pill, tone: 'warning' },
      { key: 'high-alert', label: 'High-alert', value: summary.high_alert_count || 0, icon: ShieldAlert, tone: 'danger' },
      { key: 'double-check', label: 'Cần double-check', value: summary.double_check_required || 0, icon: ClipboardCheck, tone: 'purple' },
      { key: 'rx', label: 'Có phản ứng', value: summary.reaction_count || 0, icon: HeartPulse, tone: 'warning' },
    ];
  return (
    <section className="pharmacy-inventory-kpis emar-kpis">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.key} className={`pharmacy-inventory-kpi is-${card.tone || 'neutral'}`}>
            <span><Icon size={18} /></span>
            <div>
              <small>{card.label}</small>
              <strong>{formatNumber(card.value)}</strong>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function DoseCard({ row, onSelect, onAction }) {
  return (
    <article className={`emar-dose-card is-${row.safety?.priority || row.priority || 'normal'}`} onClick={() => onSelect(row)}>
      <header>
        <span>{formatTime(row.scheduled_at)}</span>
        <StatusBadge value={row.status} />
      </header>
      <strong>{medicationName(row)}</strong>
      <small>{row.dose || '--'} · {row.route || row.medication?.route_default || '--'} · {minutesLabel(row.due_minutes)}</small>
      <div className="emar-card-flags">
        {row.safety?.high_alert ? <span>High-alert</span> : null}
        {row.safety?.allergy_alert ? <span>Dị ứng</span> : null}
        {row.safety?.not_dispensed ? <span>Chưa cấp phát</span> : null}
        {row.latest_reaction ? <span>Phản ứng</span> : null}
      </div>
      <footer>
        <button type="button" onClick={(event) => { event.stopPropagation(); onAction('scan', row); }}><Barcode size={14} /> Scan</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onAction('administer', row); }}><CheckCircle2 size={14} /> Dùng</button>
      </footer>
    </article>
  );
}

function ScheduleTimeline({ data, rows, onSelect, onAction }) {
  const patients = data.patients?.length ? data.patients : [];
  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.admission_id || row.patient_id || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }, [rows]);
  if (!rows.length) return <EmptyState text="Chưa có lịch dùng thuốc trong ngày đã chọn." />;
  return (
    <section className="emar-timeline">
      <div className="emar-time-header">
        {Array.from({ length: 13 }, (_, index) => index + 6).map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}
      </div>
      {(patients.length ? patients : rows.map((row) => ({ admission_id: row.admission_id, patient: row.patient, room: row.patient_context?.room, bed: row.patient_context?.bed }))).slice(0, 80).map((patient, index) => {
        const key = patient.admission_id || patient.patient?.patient_id || `${patientName(patient)}-${index}`;
        const items = grouped.get(key) || rows.filter((row) => row.admission_id === patient.admission_id);
        if (!items.length && patients.length) return null;
        return (
          <div className="emar-timeline-row" key={key}>
            <aside>
              <strong>{patient.patient?.full_name || patient.patient?.patient_name || patientName(items[0] || patient)}</strong>
              <small>{[patient.room?.room_code || patient.room?.room_name, patient.bed?.bed_code || patient.bed?.bed_name].filter(Boolean).join(' / ') || roomBed(items[0])}</small>
            </aside>
            <div className="emar-timeline-track">
              {items.map((row) => <DoseCard key={getRowId(row)} row={row} onSelect={onSelect} onAction={onAction} />)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function QueueBoard({ data, onSelect, onAction }) {
  return (
    <section className="emar-queue-board">
      {QUEUE_COLUMNS.map((column) => {
        const Icon = column.icon;
        const items = data[column.key] || [];
        return (
          <article className="emar-queue-column" key={column.key}>
            <header>
              <span><Icon size={16} /> {column.label}</span>
              <strong>{formatNumber(items.length)}</strong>
            </header>
            <div>
              {items.slice(0, 8).map((row) => (
                <button type="button" className={`emar-queue-card is-${row.safety?.priority || 'normal'}`} key={getRowId(row)} onClick={() => onSelect(row)}>
                  <span>{formatTime(row.scheduled_at)} · {medicationName(row)}</span>
                  <strong>{patientName(row)}</strong>
                  <small>{roomBed(row)} · {minutesLabel(row.due_minutes)}</small>
                  <em>{row.dispensing?.label || 'Chưa rõ cấp phát'}</em>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!items.length ? <small className="emar-empty-mini">Không có liều</small> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function AdministrationTable({ rows, onSelect, onAction }) {
  if (!rows.length) return <EmptyState />;
  return (
    <div className="pharmacy-inventory-table-wrap">
      <table className="pharmacy-inventory-table emar-table">
        <thead>
          <tr>
            <th>Giờ dùng</th>
            <th>Bệnh nhân</th>
            <th>Thuốc</th>
            <th>Liều / đường dùng</th>
            <th>Cấp phát / lô</th>
            <th>An toàn</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)} onClick={() => onSelect(row)}>
              <td><strong>{formatTime(row.scheduled_at)}</strong><small>{minutesLabel(row.due_minutes)}</small></td>
              <td><strong>{patientName(row)}</strong><small>{patientCode(row)} · {roomBed(row)}</small></td>
              <td><strong>{medicationName(row)}</strong><small>{row.medication?.generic_name || row.medication?.medication_code || '--'}</small></td>
              <td><strong>{row.dose || '--'}</strong><small>{row.route || row.medication?.route_default || '--'}</small></td>
              <td><strong>{row.dispensing?.label || '--'}</strong><small>{row.stock_batch?.batch_no || row.dispensing?.stock_batch?.batch_no || row.batch_no_snapshot || 'Chưa rõ batch'}</small></td>
              <td><RiskBadge row={row} /><small>{[row.safety?.high_alert ? 'High-alert' : null, row.safety?.allergy_alert ? 'Dị ứng' : null, row.safety?.double_check_required ? 'Double-check' : null].filter(Boolean).join(' · ') || 'Không cờ lớn'}</small></td>
              <td><StatusBadge value={row.status} /></td>
              <td>
                <div className="emar-row-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); onAction('scan', row); }}><Barcode size={14} /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onAction('administer', row); }}><CheckCircle2 size={14} /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onAction('hold', row); }}><AlertTriangle size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SafetyChecklist({ checklist = [] }) {
  return (
    <div className="emar-checklist">
      {checklist.map((item) => (
        <div key={item.code} className={`is-${item.status || 'pending'}`}>
          {item.status === 'pass' ? <CheckCircle2 size={16} /> : item.status === 'fail' ? <AlertTriangle size={16} /> : <Clock3 size={16} />}
          <span>{item.label}</span>
          <StatusBadge value={item.status || 'pending'} />
        </div>
      ))}
    </div>
  );
}

function ConfirmWorkbench({ data, onSelect, onAction }) {
  const row = data.selected;
  if (!row) return <EmptyState text="Chưa có liều cần xác nhận trong bộ lọc hiện tại." />;
  return (
    <section className="emar-confirm-grid">
      <article className="emar-panel">
        <header><UserCheck size={18} /><strong>Bệnh nhân</strong></header>
        <dl>
          <div><dt>Họ tên</dt><dd>{patientName(row)}</dd></div>
          <div><dt>Mã bệnh nhân</dt><dd>{patientCode(row)}</dd></div>
          <div><dt>Admission</dt><dd>{row.admission?.admission_no || row.admission_id || '--'}</dd></div>
          <div><dt>Phòng / giường</dt><dd>{roomBed(row)}</dd></div>
          <div><dt>Bác sĩ điều trị</dt><dd>{row.patient_context?.attending_doctor?.full_name || '--'}</dd></div>
          <div><dt>Dị ứng</dt><dd>{(row.patient_context?.allergies || []).map((item) => item.allergen || item.reaction).filter(Boolean).join(', ') || '--'}</dd></div>
          <div><dt>Sinh hiệu mới nhất</dt><dd>{row.patient_context?.latest_vitals?.recorded_at ? formatDateTime(row.patient_context.latest_vitals.recorded_at) : '--'}</dd></div>
        </dl>
      </article>
      <article className="emar-panel is-primary">
        <header><Pill size={18} /><strong>Thuốc cần dùng</strong></header>
        <h2>{medicationName(row)}</h2>
        <dl>
          <div><dt>Hoạt chất</dt><dd>{row.medication?.generic_name || '--'}</dd></div>
          <div><dt>Hàm lượng</dt><dd>{row.medication?.strength || '--'}</dd></div>
          <div><dt>Liều</dt><dd>{row.dose || '--'}</dd></div>
          <div><dt>Đường dùng</dt><dd>{row.route || row.medication?.route_default || '--'}</dd></div>
          <div><dt>Giờ dự kiến</dt><dd>{formatDateTime(row.scheduled_at)}</dd></div>
          <div><dt>Cấp phát</dt><dd>{row.dispensing?.label || '--'}</dd></div>
          <div><dt>Lô / HSD</dt><dd>{[row.stock_batch?.batch_no || row.dispensing?.stock_batch?.batch_no || row.batch_no_snapshot, row.stock_batch?.expiry_date || row.dispensing?.stock_batch?.expiry_date || row.expiry_date_snapshot ? formatDateTime(row.stock_batch?.expiry_date || row.dispensing?.stock_batch?.expiry_date || row.expiry_date_snapshot) : null].filter(Boolean).join(' · ') || '--'}</dd></div>
        </dl>
        <div className="emar-confirm-actions">
          <button type="button" className="pharmacy-inventory-button" onClick={() => onAction('scan', row)}><ScanLine size={16} /> Verify scan</button>
          <button type="button" className="pharmacy-inventory-button" onClick={() => onAction('administer', row)}><CheckCircle2 size={16} /> Xác nhận dùng</button>
          <button type="button" className="pharmacy-inventory-button is-secondary" onClick={() => onSelect(row)}><History size={16} /> Chi tiết</button>
        </div>
      </article>
      <article className="emar-panel">
        <header><ClipboardCheck size={18} /><strong>Checklist an toàn</strong></header>
        <SafetyChecklist checklist={data.checklist || []} />
      </article>
    </section>
  );
}

function ExceptionCenter({ data, rows, onSelect, onAction }) {
  const lanes = [
    { key: 'needs_doctor_review', label: 'Cần bác sĩ xử lý', icon: Stethoscope },
    { key: 'needs_pharmacist_review', label: 'Cần dược sĩ review', icon: ShieldAlert },
    { key: 'unresolved', label: 'Chưa xử lý', icon: Clock3 },
  ];
  return (
    <>
      <section className="emar-exception-lanes">
        {lanes.map((lane) => {
          const Icon = lane.icon;
          const items = data[lane.key] || [];
          return (
            <article key={lane.key}>
              <header><Icon size={16} /><strong>{lane.label}</strong><span>{items.length}</span></header>
              {items.slice(0, 5).map((row) => (
                <button type="button" key={getRowId(row)} onClick={() => onSelect(row)}>
                  <strong>{patientName(row)}</strong>
                  <span>{medicationName(row)} · {row.reason_code || row.reason_not_given || 'Chưa rõ lý do'}</span>
                </button>
              ))}
            </article>
          );
        })}
      </section>
      <AdministrationTable rows={rows} onSelect={onSelect} onAction={onAction} />
    </>
  );
}

function ReactionTable({ rows, onSelect, onAction }) {
  if (!rows.length) return <EmptyState text="Chưa có bất thường dùng thuốc phù hợp." />;
  return (
    <div className="pharmacy-inventory-table-wrap">
      <table className="pharmacy-inventory-table emar-table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Bệnh nhân</th>
            <th>Thuốc nghi ngờ</th>
            <th>Triệu chứng</th>
            <th>Mức độ</th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} onClick={() => onSelect(row)}>
              <td><strong>{formatDateTime(row.observed_at)}</strong><small>{row.administration?.administered_at ? `Sau dùng ${formatTime(row.administration.administered_at)}` : '--'}</small></td>
              <td><strong>{patientName(row)}</strong><small>{row.patient?.patient_code || '--'}</small></td>
              <td><strong>{row.medication_display || medicationName(row)}</strong><small>{row.administration?.dose || '--'} · {row.administration?.route || '--'}</small></td>
              <td><strong>{(row.symptoms || []).join(', ') || '--'}</strong><small>{row.intervention_note || '--'}</small></td>
              <td><StatusBadge value={row.severity} /></td>
              <td><StatusBadge value={row.status} /></td>
              <td>
                <div className="emar-row-actions">
                  <button type="button" onClick={(event) => { event.stopPropagation(); onAction('reviewReaction', row); }}><ShieldAlert size={14} /></button>
                  <button type="button" onClick={(event) => { event.stopPropagation(); onAction('resolveReaction', row); }}><CheckCircle2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({ item, onClose, onAction }) {
  if (!item) return null;
  const isReaction = Boolean(item.reaction_id);
  return (
    <aside className="pharmacy-inventory-drawer emar-drawer">
      <header>
        <div>
          <span>{isReaction ? 'Bất thường dùng thuốc' : 'Chi tiết eMAR'}</span>
          <strong>{isReaction ? item.medication_display : medicationName(item)}</strong>
          <small>{patientName(item)} · {isReaction ? formatDateTime(item.observed_at) : formatDateTime(item.scheduled_at)}</small>
        </div>
        <button type="button" aria-label="Đóng drawer" onClick={onClose}><X size={18} /></button>
      </header>
      <section>
        <dl className="pharmacy-inventory-keygrid">
          <div><dt>Bệnh nhân</dt><dd>{patientName(item)}</dd></div>
          <div><dt>Phòng/giường</dt><dd>{roomBed(item)}</dd></div>
          <div><dt>Thuốc</dt><dd>{isReaction ? item.medication_display : medicationName(item)}</dd></div>
          <div><dt>Liều</dt><dd>{item.dose || item.administration?.dose || '--'}</dd></div>
          <div><dt>Đường dùng</dt><dd>{item.route || item.administration?.route || '--'}</dd></div>
          <div><dt>Batch</dt><dd>{item.stock_batch?.batch_no || item.dispensing?.stock_batch?.batch_no || item.batch_no_snapshot || '--'}</dd></div>
          <div><dt>Cấp phát</dt><dd>{item.dispensing?.label || '--'}</dd></div>
          <div><dt>Trạng thái</dt><dd><StatusBadge value={item.status} /></dd></div>
          <div><dt>Cảnh báo</dt><dd>{[item.safety?.high_alert ? 'High-alert' : null, item.safety?.allergy_alert ? 'Dị ứng' : null, item.safety?.not_dispensed ? 'Chưa cấp phát' : null].filter(Boolean).join(', ') || '--'}</dd></div>
          <div><dt>Ghi chú</dt><dd>{item.note || item.reason_not_given || item.intervention_note || '--'}</dd></div>
        </dl>
        {!isReaction ? (
          <div className="emar-drawer-actions">
            <button type="button" className="pharmacy-inventory-button" onClick={() => onAction('administer', item)}><CheckCircle2 size={15} /> Xác nhận</button>
            <button type="button" className="pharmacy-inventory-button is-secondary" onClick={() => onAction('hold', item)}><AlertTriangle size={15} /> Hold</button>
            <button type="button" className="pharmacy-inventory-button is-secondary" onClick={() => onAction('reaction', item)}><HeartPulse size={15} /> Ghi phản ứng</button>
          </div>
        ) : (
          <div className="emar-drawer-actions">
            <button type="button" className="pharmacy-inventory-button" onClick={() => onAction('reviewReaction', item)}><ShieldAlert size={15} /> Dược sĩ review</button>
            <button type="button" className="pharmacy-inventory-button is-secondary" onClick={() => onAction('resolveReaction', item)}><CheckCircle2 size={15} /> Đóng case</button>
          </div>
        )}
        {(item.audit_timeline || []).length ? (
          <ol className="dispensing-timeline">
            {(item.audit_timeline || []).map((event) => (
              <li key={event._id || event.id || event.occurred_at}>
                <strong>{event.event_type || event.type}</strong>
                <span>{formatDateTime(event.occurred_at || event.created_at)} · {event.note || '--'}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </aside>
  );
}

function defaultForm(action, row = {}) {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return {
    administered_at: localNow,
    scheduled_at: localNow,
    dose: row.dose || '',
    route: row.route || row.medication?.route_default || '',
    site: row.site || '',
    patient_id: row.patient_id || row.patient?.patient_id || '',
    medication_id: row.medication_id || row.medication?.id || row.medication?._id || '',
    stock_batch_id: row.stock_batch_id || row.stock_batch?.id || row.stock_batch?._id || row.dispensing?.stock_batch?._id || '',
    batch_no: row.batch_no_snapshot || row.stock_batch?.batch_no || row.dispensing?.stock_batch?.batch_no || '',
    reason_code: action === 'hold' ? 'awaiting_doctor_review' : action === 'refuse' ? 'patient_refused' : action === 'omit' ? 'missed_window' : '',
    reason: '',
    note: '',
    symptoms: '',
    severity: 'mild',
    suspected_allergy: false,
    create_allergy: false,
    medication_stopped: false,
    intervention_type: 'adverse_reaction',
    recommendation: '',
    review_status: 'reviewed',
  };
}

function ActionDialog({ action, row, onClose, onDone }) {
  const [form, setForm] = useState(() => defaultForm(action, row));
  const [saving, setSaving] = useState(false);
  const titleMap = {
    scan: 'Verify scan 5 đúng',
    administer: 'Xác nhận đã dùng thuốc',
    hold: 'Tạm hoãn liều',
    refuse: 'Bệnh nhân từ chối',
    omit: 'Bỏ liều',
    reschedule: 'Dời giờ dùng thuốc',
    reaction: 'Ghi nhận bất thường',
    intervention: 'Tạo can thiệp dược',
    reviewReaction: 'Dược sĩ review phản ứng',
    resolveReaction: 'Đóng case phản ứng',
  };

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const id = getRowId(row);
      if (action === 'scan') {
        await inpatientMedicationAPI.verifyScan({
          administration_id: row.administration_id || row.id,
          patient_id: form.patient_id,
          medication_id: form.medication_id,
          stock_batch_id: form.stock_batch_id,
          batch_no: form.batch_no,
        });
      } else if (action === 'administer') {
        await inpatientMedicationAPI.administer(id, {
          administered_at: form.administered_at,
          dose: form.dose,
          route: form.route,
          site: form.site,
          note: form.note,
        });
      } else if (['hold', 'refuse', 'omit'].includes(action)) {
        await inpatientMedicationAPI[action](id, {
          reason_code: form.reason_code,
          reason: form.reason,
          reason_not_given: form.reason,
          note: form.note,
          requires_doctor_review: true,
          requires_pharmacist_review: true,
        });
      } else if (action === 'reschedule') {
        await inpatientMedicationAPI.reschedule(id, { scheduled_at: form.scheduled_at, reason_code: form.reason_code, note: form.note || form.reason });
      } else if (action === 'reaction') {
        await inpatientMedicationAPI.addReaction(id, {
          symptoms: form.symptoms.split(',').map((item) => item.trim()).filter(Boolean),
          severity: form.severity,
          suspected_allergy: form.suspected_allergy,
          create_allergy: form.create_allergy,
          medication_stopped: form.medication_stopped,
          intervention_note: form.note,
        });
      } else if (action === 'intervention') {
        await pharmacyOverviewAPI.createMedicationIntervention({
          patient_id: row.patient_id || row.patient?.patient_id,
          admission_id: row.admission_id,
          medication_administration_id: row.administration_id || row.id,
          intervention_type: form.intervention_type,
          severity: form.severity === 'life_threatening' ? 'critical' : form.severity,
          recommendation: form.recommendation || form.note,
        });
      } else if (action === 'reviewReaction') {
        await pharmacyOverviewAPI.pharmacistReviewMedicationReaction(row.reaction_id || row.id, {
          status: form.review_status,
          note: form.note,
          recommendation: form.recommendation,
        });
      } else if (action === 'resolveReaction') {
        await pharmacyOverviewAPI.resolveMedicationReaction(row.reaction_id || row.id, { note: form.note || form.recommendation });
      }
      onDone();
    } catch (error) {
      window.alert(getApiErrorMessage(error, 'Không thể xử lý thao tác eMAR.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pharmacy-inventory-modal emar-modal" role="dialog" aria-modal="true">
      <form onSubmit={submit}>
        <header>
          <div>
            <span>Dùng thuốc nội trú</span>
            <strong>{titleMap[action] || 'Thao tác eMAR'}</strong>
            <small>{patientName(row)} · {medicationName(row)}</small>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </header>
        {action === 'scan' ? (
          <>
            <label><span>Mã bệnh nhân / patient_id</span><input value={form.patient_id} onChange={(event) => setForm((current) => ({ ...current, patient_id: event.target.value }))} /></label>
            <label><span>Mã thuốc / medication_id</span><input value={form.medication_id} onChange={(event) => setForm((current) => ({ ...current, medication_id: event.target.value }))} /></label>
            <label><span>Stock batch ID</span><input value={form.stock_batch_id} onChange={(event) => setForm((current) => ({ ...current, stock_batch_id: event.target.value }))} /></label>
            <label><span>Batch no</span><input value={form.batch_no} onChange={(event) => setForm((current) => ({ ...current, batch_no: event.target.value }))} /></label>
          </>
        ) : null}
        {action === 'administer' ? (
          <>
            <label><span>Thời gian dùng thực tế</span><input type="datetime-local" value={form.administered_at} onChange={(event) => setForm((current) => ({ ...current, administered_at: event.target.value }))} /></label>
            <label><span>Liều thực tế</span><input value={form.dose} onChange={(event) => setForm((current) => ({ ...current, dose: event.target.value }))} /></label>
            <label><span>Đường dùng</span><input value={form.route} onChange={(event) => setForm((current) => ({ ...current, route: event.target.value }))} /></label>
            <label><span>Vị trí dùng</span><input value={form.site} onChange={(event) => setForm((current) => ({ ...current, site: event.target.value }))} /></label>
          </>
        ) : null}
        {['hold', 'refuse', 'omit', 'reschedule'].includes(action) ? (
          <>
            {action === 'reschedule' ? <label><span>Giờ dùng mới</span><input type="datetime-local" value={form.scheduled_at} onChange={(event) => setForm((current) => ({ ...current, scheduled_at: event.target.value }))} /></label> : null}
            <label>
              <span>Lý do chuẩn hóa</span>
              <select value={form.reason_code} onChange={(event) => setForm((current) => ({ ...current, reason_code: event.target.value }))}>
                <option value="abnormal_vitals">Sinh hiệu bất thường</option>
                <option value="awaiting_doctor_review">Chờ bác sĩ đánh giá</option>
                <option value="patient_procedure">Bệnh nhân đi thủ thuật</option>
                <option value="medication_unavailable">Chưa có thuốc</option>
                <option value="suspected_allergy">Nghi dị ứng</option>
                <option value="patient_refused">Bệnh nhân từ chối</option>
                <option value="missed_window">Quá khung giờ</option>
                <option value="operational_error">Lỗi vận hành</option>
              </select>
            </label>
            <label><span>Lý do chi tiết</span><textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
          </>
        ) : null}
        {action === 'reaction' ? (
          <>
            <label><span>Triệu chứng</span><input value={form.symptoms} placeholder="Mẩn đỏ, khó thở, buồn nôn..." onChange={(event) => setForm((current) => ({ ...current, symptoms: event.target.value }))} /></label>
            <label><span>Mức độ</span><select value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}><option value="mild">Nhẹ</option><option value="moderate">Trung bình</option><option value="severe">Nặng</option><option value="life_threatening">Nguy kịch</option></select></label>
            <label className="emar-check-row"><input type="checkbox" checked={form.suspected_allergy} onChange={(event) => setForm((current) => ({ ...current, suspected_allergy: event.target.checked }))} /><span>Nghi dị ứng thuốc</span></label>
            <label className="emar-check-row"><input type="checkbox" checked={form.create_allergy} onChange={(event) => setForm((current) => ({ ...current, create_allergy: event.target.checked }))} /><span>Tạo allergy nếu phù hợp</span></label>
            <label className="emar-check-row"><input type="checkbox" checked={form.medication_stopped} onChange={(event) => setForm((current) => ({ ...current, medication_stopped: event.target.checked }))} /><span>Đã dừng thuốc</span></label>
          </>
        ) : null}
        {action === 'intervention' ? (
          <>
            <label><span>Loại can thiệp</span><select value={form.intervention_type} onChange={(event) => setForm((current) => ({ ...current, intervention_type: event.target.value }))}><option value="adverse_reaction">Adverse reaction</option><option value="allergy_risk">Nguy cơ dị ứng</option><option value="timing_issue">Vấn đề thời điểm</option><option value="missed_dose">Bỏ liều</option><option value="stock_substitution">Thay thế tồn kho</option></select></label>
            <label><span>Mức độ</span><select value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
            <label><span>Khuyến nghị</span><textarea value={form.recommendation} onChange={(event) => setForm((current) => ({ ...current, recommendation: event.target.value }))} required /></label>
          </>
        ) : null}
        {['reviewReaction', 'resolveReaction'].includes(action) ? (
          <>
            {action === 'reviewReaction' ? <label><span>Kết luận review</span><select value={form.review_status} onChange={(event) => setForm((current) => ({ ...current, review_status: event.target.value }))}><option value="reviewed">Đã review</option><option value="resolved">Review và đóng case</option></select></label> : null}
            <label><span>Khuyến nghị / ghi chú</span><textarea value={form.recommendation || form.note} onChange={(event) => setForm((current) => ({ ...current, recommendation: event.target.value, note: event.target.value }))} /></label>
          </>
        ) : null}
        {!['scan', 'hold', 'refuse', 'omit', 'reschedule', 'reaction', 'intervention', 'reviewReaction', 'resolveReaction'].includes(action) ? null : (
          <label><span>Ghi chú</span><textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></label>
        )}
        <footer>
          <button type="button" className="pharmacy-inventory-button is-secondary" onClick={onClose}>Hủy</button>
          <button type="submit" className="pharmacy-inventory-button" disabled={saving}>{saving ? 'Đang xử lý' : 'Xác nhận'}</button>
        </footer>
      </form>
    </div>
  );
}

async function loadPage(view, filters, selectedId) {
  if (view === 'schedule') return readPayload(await pharmacyOverviewAPI.inpatientMedicationScheduleBoard(filters));
  if (view === 'today') return readPayload(await pharmacyOverviewAPI.inpatientMedicationTodayCommandCenter(filters));
  if (view === 'confirm') return readPayload(await pharmacyOverviewAPI.inpatientMedicationConfirmWorkbench({ ...filters, administration_id: selectedId || filters.administration_id }));
  if (view === 'exceptions') return readPayload(await pharmacyOverviewAPI.inpatientMedicationExceptions(filters));
  if (view === 'reactions') return readPayload(await pharmacyOverviewAPI.inpatientMedicationReactions(filters));
  return {};
}

function usePageData(view, filters, selectedId) {
  const [state, setState] = useState({ loading: true, data: {}, error: '' });
  async function refresh() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await loadPage(view, filters, selectedId);
      setState({ loading: false, data, error: '' });
    } catch (error) {
      setState({ loading: false, data: {}, error: getApiErrorMessage(error, 'Không thể tải dữ liệu dùng thuốc nội trú.') });
    }
  }
  useEffect(() => {
    refresh();
  }, [view, JSON.stringify(filters), selectedId]);
  return { ...state, refresh };
}

export function PharmacyInpatientMedicationPage({ view = 'today' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.today;
  const [filters, setFilters] = useState({ date: TODAY, page: 1, limit: 120 });
  const [selected, setSelected] = useState(null);
  const [selectedConfirmId, setSelectedConfirmId] = useState('');
  const [dialog, setDialog] = useState(null);
  const { loading, data, error, refresh } = usePageData(view, filters, selectedConfirmId);
  const rows = useMemo(() => readRows(data, view), [data, view]);
  const summary = data.summary || {};

  function openAction(action, row = selected || data.selected || rows[0]) {
    if (!row) return;
    setDialog({ action, row });
  }

  function handleSelect(row) {
    setSelected(row);
    if (view === 'confirm') setSelectedConfirmId(row.administration_id || row.id || '');
  }

  function handleDone() {
    setDialog(null);
    refresh();
  }

  return (
    <section className="pharmacy-inventory-page emar-page">
      <Header config={config} onRefresh={refresh} onAction={rows[0] || data.selected ? () => openAction('scan', data.selected || rows[0]) : null} />
      <KpiStrip summary={summary} view={view} />
      <Filters view={view} filters={filters} setFilters={setFilters} />
      <ErrorBanner error={error} />
      {loading ? <LoadingState /> : (
        <>
          {view === 'schedule' ? <ScheduleTimeline data={data} rows={rows} onSelect={handleSelect} onAction={openAction} /> : null}
          {view === 'today' ? <><QueueBoard data={data} onSelect={handleSelect} onAction={openAction} /><AdministrationTable rows={rows} onSelect={handleSelect} onAction={openAction} /></> : null}
          {view === 'confirm' ? <ConfirmWorkbench data={data} onSelect={handleSelect} onAction={openAction} /> : null}
          {view === 'exceptions' ? <ExceptionCenter data={data} rows={rows} onSelect={handleSelect} onAction={openAction} /> : null}
          {view === 'reactions' ? <ReactionTable rows={rows} onSelect={handleSelect} onAction={openAction} /> : null}
        </>
      )}
      <DetailDrawer item={selected} onClose={() => setSelected(null)} onAction={openAction} />
      {dialog ? <ActionDialog action={dialog.action} row={dialog.row} onClose={() => setDialog(null)} onDone={handleDone} /> : null}
    </section>
  );
}

