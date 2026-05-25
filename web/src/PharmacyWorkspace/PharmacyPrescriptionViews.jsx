import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  Filter,
  PackageCheck,
  Pill,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  billingAPI,
  encounterAPI,
  getApiErrorMessage,
  patientAPI,
  prescriptionAPI,
  unwrapData,
} from '../utils/api';
import {
  PHARMACY_PERMISSIONS,
  hasAnyPermission,
  readItems,
  runPrescriptionSafetyChecks,
} from './pharmacyApi';
import { confirmPharmacyAction, printPharmacyView, promptPharmacyText } from './pharmacyActions';
import { usePharmacyWorkspace } from './PharmacyShell';

const PRESCRIPTION_STATUS_META = {
  draft: { label: 'Chờ xác minh', tone: 'warning' },
  active: { label: 'Chờ xác minh', tone: 'warning' },
  pending: { label: 'Chờ xác minh', tone: 'warning' },
  pending_verification: { label: 'Chờ xác minh', tone: 'warning' },
  verified: { label: 'Sẵn sàng cấp phát', tone: 'info' },
  ready_to_dispense: { label: 'Sẵn sàng cấp phát', tone: 'info' },
  partially_dispensed: { label: 'Đã cấp một phần', tone: 'purple' },
  fully_dispensed: { label: 'Đã cấp phát', tone: 'success' },
  dispensed: { label: 'Đã cấp phát', tone: 'success' },
  completed: { label: 'Hoàn tất', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'muted' },
};

const DISPENSE_STATUS_META = {
  draft: { label: 'Chờ chuẩn bị', tone: 'warning' },
  partially_dispensed: { label: 'Cấp một phần', tone: 'purple' },
  dispensed: { label: 'Hoàn tất', tone: 'success' },
  completed: { label: 'Hoàn tất', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'muted' },
  returned: { label: 'Đã trả', tone: 'muted' },
};

const LIST_MODE_META = {
  all: {
    eyebrow: 'Đơn thuốc',
    title: 'Tất cả đơn',
    description: 'Theo dõi toàn bộ đơn thuốc, lọc theo trạng thái, bác sĩ, bệnh nhân, ngày kê và khoa.',
    icon: ClipboardList,
  },
  pending: {
    eyebrow: 'Đơn thuốc',
    title: 'Chờ xác minh',
    description: 'Kiểm tra dị ứng, tương tác thuốc và thuốc trùng trước khi xác minh đơn.',
    icon: ShieldAlert,
  },
  ready: {
    eyebrow: 'Đơn thuốc',
    title: 'Sẵn sàng cấp phát',
    description: 'Danh sách đơn đã xác minh, kiểm tra tồn kho từng thuốc và tạo phiếu cấp phát.',
    icon: PackageCheck,
  },
  dispensed: {
    eyebrow: 'Đơn thuốc',
    title: 'Đã cấp phát',
    description: 'Theo dõi đơn đã cấp phát, phiếu cấp phát, tổng tiền và trạng thái thanh toán.',
    icon: CheckCircle2,
  },
  cancelled: {
    eyebrow: 'Đơn thuốc',
    title: 'Đã hủy',
    description: 'Xem lý do hủy, người hủy, thời gian hủy và thao tác tạo lại/gia hạn.',
    icon: Ban,
  },
};

function getId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || value.value || '';
}

function getPrescriptionId(row) {
  return row?.prescription_id || row?._id || row?.id || '';
}

function getDispenseId(row) {
  return row?.dispense_id || row?._id || row?.id || '';
}

function getPatient(row) {
  return row?.patient_id || row?.patient || {};
}

function getPatientId(row) {
  return getId(row?.patient_id || row?.patient) || row?.patient_id || '';
}

function getEncounter(row) {
  return row?.encounter_id || row?.encounter || {};
}

function getEncounterId(row) {
  return getId(row?.encounter_id || row?.encounter) || row?.encounter_id || '';
}

function getPersonName(value, fallback = 'Chưa rõ') {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  return value.full_name || value.fullName || value.name || value.username || value.patient_name || fallback;
}

function getMedicationName(value) {
  if (!value) return 'Thuốc';
  if (typeof value === 'string') return value;
  return [value.brand_name || value.generic_name || value.medication_name, value.strength]
    .filter(Boolean)
    .join(' ') || value.medication_code || 'Thuốc';
}

function getMedicationId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.medication_id || value._id || value.id || '';
}

function parseDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

function formatDateTime(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value) {
  const parsed = parseDate(value);
  if (!parsed) return '--';
  return parsed.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getStatusMeta(status, map = PRESCRIPTION_STATUS_META) {
  return map[String(status || '').toLowerCase()] || { label: status || 'Không rõ', tone: 'muted' };
}

function StatusBadge({ status, map = PRESCRIPTION_STATUS_META }) {
  const meta = getStatusMeta(status, map);
  return <span className={`pharmacy-status-badge is-${meta.tone}`}>{meta.label}</span>;
}

function InlineError({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="pharmacy-widget-error">
      <AlertTriangle size={16} strokeWidth={2.25} aria-hidden="true" />
      <span>{message}</span>
      {onRetry ? <button type="button" onClick={onRetry}>Thử lại</button> : null}
    </div>
  );
}

function LoadingRows({ rows = 4 }) {
  return (
    <div className="pharmacy-skeleton-stack" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => <span className="pharmacy-skeleton" key={index} />)}
    </div>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="pharmacy-overview-empty">
      <CheckCircle2 size={22} strokeWidth={2.25} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, icon: Icon, actions }) {
  return (
    <section className="pharmacy-feature-head pharmacy-workspace-head">
      <span aria-hidden="true">
        <Icon size={24} strokeWidth={2.25} />
      </span>
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="pharmacy-head-actions">{actions}</div> : null}
    </section>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return (
    <button type="button" className="pharmacy-overview-toast" onClick={onClose}>
      <span>{message}</span>
      <X size={14} strokeWidth={2.3} aria-hidden="true" />
    </button>
  );
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getListStatusParams(mode, explicitStatus = '') {
  const status = normalizeText(explicitStatus);
  if (status === 'pending_verification') return ['draft', 'active'];
  if (status === 'ready_to_dispense') return ['verified'];
  if (status === 'dispensed') return ['fully_dispensed', 'completed'];
  if (status) return [status];
  if (mode === 'pending') return ['draft', 'active'];
  if (mode === 'ready') return ['verified'];
  if (mode === 'dispensed') return ['fully_dispensed', 'completed'];
  if (mode === 'cancelled') return ['cancelled'];
  return [''];
}

function isInsideDateFilter(row, filters, dateAccessor) {
  const value = parseDate(dateAccessor(row));
  if (!value) return true;
  if (filters.dateFrom && value < new Date(`${filters.dateFrom}T00:00:00`)) return false;
  if (filters.dateTo && value > new Date(`${filters.dateTo}T23:59:59.999`)) return false;
  return true;
}

function filterByDepartment(rows, department) {
  const keyword = normalizeText(department);
  if (!keyword) return rows;
  return rows.filter((row) => {
    const encounter = getEncounter(row);
    const haystack = [
      encounter.department_name,
      encounter.department_id?.department_name,
      encounter.department_id?.name,
      row.department_name,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(keyword);
  });
}

function mergeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = getPrescriptionId(row) || row.prescription_no;
    if (!key) return true;
    if (seen.has(String(key))) return false;
    seen.add(String(key));
    return true;
  });
}

async function loadPrescriptionRows(mode, filters) {
  const statusParams = getListStatusParams(mode, filters.status);
  const baseParams = {
    limit: 100,
    patient_id: filters.patientId || undefined,
    prescribed_by: filters.doctorId || undefined,
  };
  const keyword = filters.search.trim();
  const requests = statusParams.map((status) => {
    const params = {
      ...baseParams,
      status: status || undefined,
      q: keyword || undefined,
      search: keyword || undefined,
    };
    return keyword ? prescriptionAPI.search(params) : prescriptionAPI.list(params);
  });
  const responses = await Promise.all(requests);
  const rows = mergeRows(responses.flatMap(readItems));
  return filterByDepartment(
    rows.filter((row) => isInsideDateFilter(row, filters, (item) => item.prescribed_at || item.created_at)),
    filters.department,
  );
}

function getBillingSummaryForPrescription(row, billingData) {
  const prescriptionId = getPrescriptionId(row);
  const patientId = getPatientId(row);
  const encounterId = getEncounterId(row);
  const charges = billingData.charges.filter((item) =>
    getId(item.prescription_id) === String(prescriptionId)
    || getId(item.patient_id) === String(patientId)
    || getId(item.encounter_id) === String(encounterId),
  );
  const invoices = billingData.invoices.filter((item) =>
    getId(item.prescription_id) === String(prescriptionId)
    || getId(item.patient_id) === String(patientId)
    || getId(item.encounter_id) === String(encounterId),
  );
  const payments = billingData.payments.filter((item) =>
    invoices.some((invoice) => getId(item.invoice_id) === getId(invoice))
    || getId(item.patient_id) === String(patientId),
  );
  const amount = charges.reduce((sum, item) => sum + Number(item.amount || item.total_amount || item.charge_amount || 0), 0);
  const paid = payments.reduce((sum, item) => sum + Number(item.amount || item.payment_amount || 0), 0);
  const invoiceStatus = invoices[0]?.status || (paid >= amount && amount > 0 ? 'paid' : amount > 0 ? 'pending' : '');
  return { amount, paid, invoiceStatus, invoice: invoices[0] };
}

function PrescriptionFilters({ mode, filters, onChange, onReset }) {
  return (
    <section className="pharmacy-workspace-filters" aria-label="Bộ lọc đơn thuốc">
      <label className="is-wide">
        <Search size={15} strokeWidth={2.25} aria-hidden="true" />
        <input
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Tìm mã đơn, bệnh nhân, bác sĩ..."
        />
      </label>
      {mode === 'all' ? (
        <label>
          <Filter size={15} strokeWidth={2.25} aria-hidden="true" />
          <select value={filters.status} onChange={(event) => onChange({ status: event.target.value })}>
            <option value="">Tất cả trạng thái</option>
            <option value="pending_verification">Chờ xác minh</option>
            <option value="ready_to_dispense">Sẵn sàng cấp phát</option>
            <option value="dispensed">Đã cấp phát</option>
            <option value="cancelled">Đã hủy</option>
          </select>
        </label>
      ) : null}
      <label>
        <span>Từ</span>
        <input type="date" value={filters.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} />
      </label>
      <label>
        <span>Đến</span>
        <input type="date" value={filters.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} />
      </label>
      <label>
        <Pill size={15} strokeWidth={2.25} aria-hidden="true" />
        <input value={filters.patientId} onChange={(event) => onChange({ patientId: event.target.value })} placeholder="Patient ID" />
      </label>
      <label>
        <BadgeCheck size={15} strokeWidth={2.25} aria-hidden="true" />
        <input value={filters.doctorId} onChange={(event) => onChange({ doctorId: event.target.value })} placeholder="Doctor ID" />
      </label>
      <label>
        <FileText size={15} strokeWidth={2.25} aria-hidden="true" />
        <input value={filters.department} onChange={(event) => onChange({ department: event.target.value })} placeholder="Khoa" />
      </label>
      <button type="button" onClick={onReset}>
        <RotateCcw size={15} strokeWidth={2.25} aria-hidden="true" />
        Xóa lọc
      </button>
    </section>
  );
}

function PrescriptionActions({
  row,
  mode,
  permissions,
  onView,
  onVerify,
  onCreateDispense,
  onCancel,
  onComplete,
  onDuplicate,
  onRenew,
}) {
  const status = String(row.status || '').toLowerCase();
  const canVerify = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.prescriptionsVerify);
  const canCancel = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.prescriptionsCancel);
  const canCreateDispense = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.dispensesCreate);
  const canComplete = canVerify;
  const isPending = ['draft', 'active', 'pending_verification'].includes(status);
  const isReady = ['verified', 'ready_to_dispense'].includes(status);
  const isDispensed = ['fully_dispensed'].includes(status);
  const isCancelled = status === 'cancelled';

  return (
    <div className="pharmacy-row-actions">
      <button type="button" title="Xem chi tiết" onClick={() => onView(row)}>
        <Eye size={15} strokeWidth={2.25} aria-hidden="true" />
      </button>
      {canVerify && isPending ? (
        <button type="button" title="Xác minh" onClick={() => onVerify(row)}>
          <BadgeCheck size={15} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : null}
      {canCreateDispense && isReady ? (
        <button type="button" title="Tạo phiếu cấp phát" onClick={() => onCreateDispense(row)}>
          <PackageCheck size={15} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : null}
      {canComplete && isDispensed ? (
        <button type="button" title="Hoàn tất đơn" onClick={() => onComplete(row)}>
          <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : null}
      {canCancel && !isCancelled && mode !== 'dispensed' ? (
        <button className="is-danger" type="button" title="Hủy đơn" onClick={() => onCancel(row)}>
          <Ban size={15} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" title="Duplicate" onClick={() => onDuplicate(row)}>
        <Copy size={15} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <button type="button" title="Renew" onClick={() => onRenew(row)}>
        <RefreshCw size={15} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}

function PrescriptionTable({
  rows,
  mode,
  loading,
  billingData,
  permissions,
  onView,
  onVerify,
  onCreateDispense,
  onCancel,
  onComplete,
  onDuplicate,
  onRenew,
}) {
  if (loading) return <LoadingRows rows={6} />;
  if (!rows.length) {
    return <EmptyState title="Chưa có đơn thuốc" description="Không có đơn thuốc phù hợp với bộ lọc hiện tại." />;
  }

  return (
    <div className="pharmacy-table-scroll">
      <table className="pharmacy-overview-table pharmacy-workspace-table">
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Bệnh nhân</th>
            <th>Bác sĩ kê</th>
            <th>Khoa</th>
            <th>Ngày kê</th>
            <th>Số thuốc</th>
            {mode === 'dispensed' ? <th>Phiếu cấp phát</th> : null}
            {mode === 'cancelled' ? <th>Lý do hủy</th> : null}
            <th>Trạng thái</th>
            <th>Cảnh báo</th>
            <th>Thanh toán</th>
            {mode === 'cancelled' ? <th>Thời gian hủy</th> : null}
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const patient = getPatient(row);
            const encounter = getEncounter(row);
            const billing = getBillingSummaryForPrescription(row, billingData);
            const hasWarning = row.has_allergy_conflict || row.has_interaction_conflict || row.warning_count;
            const prescriptionId = getPrescriptionId(row);
            return (
              <tr key={prescriptionId || row.prescription_no}>
                <td><strong>{row.prescription_no || prescriptionId || '--'}</strong></td>
                <td>
                  <span>{getPersonName(patient, row.patient_name || 'Bệnh nhân')}</span>
                  <small>{patient.patient_code || patient.phone || '--'}</small>
                </td>
                <td>{getPersonName(row.prescribed_by, row.doctor_name || 'Bác sĩ')}</td>
                <td>{encounter.department_name || encounter.department_id?.department_name || row.department_name || '--'}</td>
                <td>{formatDateTime(row.prescribed_at || row.created_at)}</td>
                <td>{row.items_count ?? row.item_count ?? row.items?.length ?? '--'}</td>
                {mode === 'dispensed' ? <td>{row.dispense_no || row.latest_dispense_no || '--'}</td> : null}
                {mode === 'cancelled' ? <td>{row.cancel_reason || row.reason || '--'}</td> : null}
                <td><StatusBadge status={row.status} /></td>
                <td>
                  {hasWarning ? (
                    <span className="pharmacy-warning-pill">
                      <AlertTriangle size={13} strokeWidth={2.3} aria-hidden="true" />
                      Cần kiểm tra
                    </span>
                  ) : <span className="pharmacy-muted-text">Ổn</span>}
                </td>
                <td>
                  <span>{billing.amount ? formatCurrency(billing.amount) : '--'}</span>
                  <small>{billing.invoiceStatus || 'Chưa có hóa đơn'}</small>
                </td>
                {mode === 'cancelled' ? <td>{formatDateTime(row.cancelled_at)}</td> : null}
                <td>
                  <PrescriptionActions
                    row={row}
                    mode={mode}
                    permissions={permissions}
                    onView={onView}
                    onVerify={onVerify}
                    onCreateDispense={onCreateDispense}
                    onCancel={onCancel}
                    onComplete={onComplete}
                    onDuplicate={onDuplicate}
                    onRenew={onRenew}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SafetyDialog({ state, busy, onCancel, onConfirm }) {
  if (!state) return null;
  return (
    <div className="pharmacy-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div className="pharmacy-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>An toàn thuốc</span>
            <h2>{state.prescription?.prescription_no || 'Đơn thuốc'}</h2>
          </div>
          <button type="button" aria-label="Đóng" onClick={onCancel}>
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </header>
        <div className="pharmacy-dialog-findings">
          {state.findings.length ? state.findings.map((item, index) => (
            <article className={`is-${item.tone}`} key={`${item.title}-${index}`}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </article>
          )) : (
            <article className="is-success">
              <strong>Không phát hiện cảnh báo nghiêm trọng</strong>
              <span>Các kiểm tra dị ứng, tương tác và thuốc trùng đã hoàn tất.</span>
            </article>
          )}
        </div>
        <footer>
          <button type="button" onClick={onCancel} disabled={busy}>Đóng</button>
          <button type="button" className="is-primary" onClick={onConfirm} disabled={busy}>
            {busy ? 'Đang xác minh...' : 'Xác minh đơn'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function usePrescriptionActions({ onDone }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [safetyDialog, setSafetyDialog] = useState(null);

  async function handleVerify(row) {
    const prescriptionId = getPrescriptionId(row);
    if (!prescriptionId) return;
    setBusy(true);
    try {
      const [detailResponse, itemsResponse, safety] = await Promise.all([
        prescriptionAPI.detail(prescriptionId),
        prescriptionAPI.listItems(prescriptionId),
        runPrescriptionSafetyChecks(prescriptionId),
      ]);
      setSafetyDialog({
        prescription: unwrapData(detailResponse)?.prescription || row,
        items: readItems(itemsResponse),
        findings: safety.findings || [],
      });
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể kiểm tra an toàn thuốc.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmVerify() {
    const prescriptionId = getPrescriptionId(safetyDialog?.prescription);
    if (!prescriptionId) return;
    setBusy(true);
    try {
      await prescriptionAPI.verify(prescriptionId, {
        override_allergy: safetyDialog.findings?.some((item) => item.title === 'Cảnh báo dị ứng') || undefined,
        override_interaction_warning_reason: safetyDialog.findings?.length
          ? 'Đã rà soát cảnh báo an toàn thuốc tại Pharmacy Workspace.'
          : undefined,
      });
      setSafetyDialog(null);
      setToast('Đã xác minh đơn thuốc.');
      await onDone?.();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể xác minh đơn thuốc.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(row) {
    const prescriptionId = getPrescriptionId(row);
    const reason = promptPharmacyText({
      title: 'Hủy đơn thuốc',
      message: `Nhập lý do hủy đơn ${row.prescription_no || prescriptionId}`,
    });
    if (!prescriptionId || !reason) return;
    setBusy(true);
    try {
      await prescriptionAPI.cancel(prescriptionId, { reason });
      setToast('Đã hủy đơn thuốc.');
      await onDone?.();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể hủy đơn thuốc.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(row) {
    const prescriptionId = getPrescriptionId(row);
    if (!prescriptionId || !confirmPharmacyAction({ title: 'Hoàn tất đơn thuốc', message: `Hoàn tất đơn ${row.prescription_no || prescriptionId}?` })) return;
    setBusy(true);
    try {
      await prescriptionAPI.complete(prescriptionId, {});
      setToast('Đã hoàn tất đơn thuốc.');
      await onDone?.();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể hoàn tất đơn thuốc.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateDispense(row) {
    const prescriptionId = getPrescriptionId(row);
    if (!prescriptionId) return;
    setBusy(true);
    try {
      await prescriptionAPI.createDispense(prescriptionId, {
        allow_multiple_drafts: true,
        note: 'Tạo phiếu cấp phát từ Pharmacy Workspace.',
      });
      setToast('Đã tạo phiếu cấp phát.');
      navigate('/pharmacy/dispensing/queue');
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể tạo phiếu cấp phát.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(row) {
    const prescriptionId = getPrescriptionId(row);
    if (!prescriptionId) return;
    setBusy(true);
    try {
      await prescriptionAPI.duplicate(prescriptionId);
      setToast('Đã duplicate đơn thuốc.');
      await onDone?.();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể duplicate đơn thuốc.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleRenew(row) {
    const prescriptionId = getPrescriptionId(row);
    if (!prescriptionId) return;
    setBusy(true);
    try {
      await prescriptionAPI.renew(prescriptionId, { reason: 'Renew từ Pharmacy Workspace.' });
      setToast('Đã gia hạn/tạo lại đơn thuốc.');
      await onDone?.();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể renew đơn thuốc.'));
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    toast,
    setToast,
    safetyDialog,
    setSafetyDialog,
    handleVerify,
    confirmVerify,
    handleCancel,
    handleComplete,
    handleCreateDispense,
    handleDuplicate,
    handleRenew,
  };
}

function PrescriptionDrawer({ prescriptionId, onClose, onRefresh }) {
  const [state, setState] = useState({ loading: true, error: '', detail: null, items: [], summary: null });
  const actions = usePrescriptionActions({ onDone: onRefresh });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    async function load() {
      setState({ loading: true, error: '', detail: null, items: [], summary: null });
      try {
        const [detailResponse, summaryResponse, itemsResponse] = await Promise.allSettled([
          prescriptionAPI.detail(prescriptionId),
          prescriptionAPI.summary(prescriptionId),
          prescriptionAPI.listItems(prescriptionId),
        ]);
        if (!active) return;
        const detailPayload = detailResponse.status === 'fulfilled' ? unwrapData(detailResponse.value) : null;
        setState({
          loading: false,
          error: detailResponse.status === 'rejected' ? getApiErrorMessage(detailResponse.reason, 'Không thể tải chi tiết đơn.') : '',
          detail: detailPayload?.prescription || detailPayload || null,
          items: itemsResponse.status === 'fulfilled' ? readItems(itemsResponse.value) : detailPayload?.items || [],
          summary: summaryResponse.status === 'fulfilled' ? unwrapData(summaryResponse.value) : null,
        });
      } catch (error) {
        if (active) setState({ loading: false, error: getApiErrorMessage(error, 'Không thể tải chi tiết đơn.'), detail: null, items: [], summary: null });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [prescriptionId]);

  const row = state.detail || {};

  return (
    <div className="pharmacy-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="pharmacy-drawer" aria-label="Chi tiết đơn thuốc" onClick={(event) => event.stopPropagation()}>
        <Toast message={actions.toast} onClose={() => actions.setToast('')} />
        <header>
          <div>
            <span>Chi tiết đơn thuốc</span>
            <h2>{row.prescription_no || prescriptionId}</h2>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}>
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </header>
        <InlineError message={state.error} />
        {state.loading ? <LoadingRows rows={5} /> : (
          <>
            <section className="pharmacy-detail-summary">
              <article>
                <small>Bệnh nhân</small>
                <strong>{getPersonName(getPatient(row), row.patient_name || 'Bệnh nhân')}</strong>
              </article>
              <article>
                <small>Trạng thái</small>
                <StatusBadge status={row.status} />
              </article>
              <article>
                <small>Ngày kê</small>
                <strong>{formatDateTime(row.prescribed_at || row.created_at)}</strong>
              </article>
            </section>
            <section className="pharmacy-detail-section">
              <h3>Danh sách thuốc</h3>
              {state.items.length ? state.items.map((item) => (
                <article className="pharmacy-medication-line" key={item._id || item.id}>
                  <span>
                    <strong>{getMedicationName(item.medication_id)}</strong>
                    <small>{[item.dose || item.dosage, item.route, item.frequency].filter(Boolean).join(' · ') || '--'}</small>
                  </span>
                  <em>{formatNumber(item.quantity)} {item.unit || ''}</em>
                </article>
              )) : <small className="pharmacy-muted-text">Chưa có item thuốc.</small>}
            </section>
            <footer className="pharmacy-drawer-actions">
              <button type="button" onClick={() => navigate(`/pharmacy/prescriptions/${prescriptionId}`)}>
                <FileText size={15} strokeWidth={2.25} aria-hidden="true" />
                Mở trang chi tiết
              </button>
              <button type="button" onClick={() => actions.handleVerify(row)}>
                <BadgeCheck size={15} strokeWidth={2.25} aria-hidden="true" />
                Xác minh
              </button>
              <button type="button" onClick={() => actions.handleCreateDispense(row)}>
                <PackageCheck size={15} strokeWidth={2.25} aria-hidden="true" />
                Tạo phiếu
              </button>
            </footer>
          </>
        )}
        <SafetyDialog
          state={actions.safetyDialog}
          busy={actions.busy}
          onCancel={() => actions.setSafetyDialog(null)}
          onConfirm={actions.confirmVerify}
        />
      </aside>
    </div>
  );
}

export function PrescriptionListScreen({ mode = 'all' }) {
  const meta = LIST_MODE_META[mode] || LIST_MODE_META.all;
  const { permissions } = usePharmacyWorkspace();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [billingData, setBillingData] = useState({ charges: [], invoices: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    patientId: '',
    doctorId: '',
    department: '',
  });
  const actions = usePrescriptionActions({ onDone: loadData });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [prescriptionRows, charges, invoices, payments] = await Promise.all([
        loadPrescriptionRows(mode, filters),
        billingAPI.charges({ limit: 100 }).catch(() => ({ data: { data: [] } })),
        billingAPI.invoices({ limit: 100 }).catch(() => ({ data: { data: [] } })),
        billingAPI.payments({ limit: 100 }).catch(() => ({ data: { data: [] } })),
      ]);
      setRows(prescriptionRows);
      setBillingData({
        charges: readItems(charges),
        invoices: readItems(invoices),
        payments: readItems(payments),
      });
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Không thể tải danh sách đơn thuốc.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [mode, filters.search, filters.status, filters.dateFrom, filters.dateTo, filters.patientId, filters.doctorId, filters.department]);

  const stats = useMemo(() => {
    const pending = rows.filter((item) => ['draft', 'active'].includes(String(item.status || '').toLowerCase())).length;
    const ready = rows.filter((item) => String(item.status || '').toLowerCase() === 'verified').length;
    const dispensed = rows.filter((item) => ['fully_dispensed', 'completed'].includes(String(item.status || '').toLowerCase())).length;
    return { total: rows.length, pending, ready, dispensed };
  }, [rows]);

  const Icon = meta.icon;

  return (
    <div className="pharmacy-page pharmacy-workspace-page">
      <Toast message={actions.toast} onClose={() => actions.setToast('')} />
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        icon={Icon}
        actions={(
          <>
            <button type="button" onClick={loadData}>
              <RefreshCw size={16} strokeWidth={2.25} aria-hidden="true" />
              Làm mới
            </button>
            <Link to="/pharmacy/dispensing/create">
              <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
              Tạo phiếu
            </Link>
          </>
        )}
      />

      <section className="pharmacy-workspace-stat-grid">
        <article><small>Tổng đơn</small><strong>{formatNumber(stats.total)}</strong></article>
        <article><small>Chờ xác minh</small><strong>{formatNumber(stats.pending)}</strong></article>
        <article><small>Sẵn sàng cấp phát</small><strong>{formatNumber(stats.ready)}</strong></article>
        <article><small>Đã cấp phát</small><strong>{formatNumber(stats.dispensed)}</strong></article>
      </section>

      <PrescriptionFilters
        mode={mode}
        filters={filters}
        onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
        onReset={() => setFilters({ search: '', status: '', dateFrom: '', dateTo: '', patientId: '', doctorId: '', department: '' })}
      />

      <section className="pharmacy-overview-card pharmacy-workspace-card">
        <header className="pharmacy-card-head">
          <div>
            <span>{meta.eyebrow}</span>
            <h2>{meta.title}</h2>
          </div>
          <strong>{formatNumber(rows.length)} đơn</strong>
        </header>
        <InlineError message={error} onRetry={loadData} />
        <PrescriptionTable
          rows={rows}
          mode={mode}
          loading={loading}
          billingData={billingData}
          permissions={permissions}
          onView={(row) => setSelectedId(getPrescriptionId(row))}
          onVerify={actions.handleVerify}
          onCreateDispense={actions.handleCreateDispense}
          onCancel={actions.handleCancel}
          onComplete={actions.handleComplete}
          onDuplicate={actions.handleDuplicate}
          onRenew={actions.handleRenew}
        />
      </section>

      {selectedId ? <PrescriptionDrawer prescriptionId={selectedId} onClose={() => setSelectedId('')} onRefresh={loadData} /> : null}
      <SafetyDialog
        state={actions.safetyDialog}
        busy={actions.busy}
        onCancel={() => actions.setSafetyDialog(null)}
        onConfirm={actions.confirmVerify}
      />
    </div>
  );
}

function DetailTabs({ active, onChange }) {
  const tabs = [
    { id: 'overview', label: 'Tổng quan đơn' },
    { id: 'items', label: 'Danh sách thuốc' },
    { id: 'safety', label: 'An toàn thuốc' },
    { id: 'history', label: 'Lịch sử bệnh nhân' },
  ];
  return (
    <div className="pharmacy-tabs" role="tablist">
      {tabs.map((item) => (
        <button key={item.id} type="button" className={active === item.id ? 'is-active' : ''} onClick={() => onChange(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function PrescriptionDetailScreen() {
  const { prescriptionId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [state, setState] = useState({
    loading: true,
    error: '',
    detail: null,
    summary: null,
    items: [],
    patientSummary: null,
    allergies: [],
    problems: [],
    activePrescriptions: [],
    history: [],
    encounter: null,
    encounterSummary: null,
    encounterOrders: [],
    orderSummary: null,
    safety: null,
  });
  const actions = usePrescriptionActions({ onDone: loadDetail });

  async function loadDetail() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [detailResponse, summaryResponse, itemsResponse] = await Promise.all([
        prescriptionAPI.detail(prescriptionId),
        prescriptionAPI.summary(prescriptionId).catch(() => null),
        prescriptionAPI.listItems(prescriptionId).catch(() => ({ data: { data: [] } })),
      ]);
      const detailPayload = unwrapData(detailResponse);
      const detail = detailPayload?.prescription || detailPayload;
      const patientId = getPatientId(detail);
      const encounterId = getEncounterId(detail);
      const [
        patientSummary,
        allergies,
        problems,
        activePrescriptions,
        history,
        encounterDetail,
        encounterSummary,
        encounterOrders,
        orderSummary,
        safety,
      ] = await Promise.all([
        patientId ? patientAPI.summary(patientId).catch(() => null) : null,
        patientId ? patientAPI.allergies(patientId).catch(() => ({ data: { data: [] } })) : { data: { data: [] } },
        patientId ? patientAPI.problems(patientId).catch(() => ({ data: { data: [] } })) : { data: { data: [] } },
        patientId ? prescriptionAPI.listByPatient(patientId, { status: 'active', limit: 20 }).catch(() => ({ data: { data: [] } })) : { data: { data: [] } },
        patientId ? prescriptionAPI.listByPatient(patientId, { limit: 30 }).catch(() => ({ data: { data: [] } })) : { data: { data: [] } },
        encounterId ? encounterAPI.detail(encounterId).catch(() => null) : null,
        encounterId ? encounterAPI.summary(encounterId).catch(() => null) : null,
        encounterId ? encounterAPI.listOrders(encounterId).catch(() => ({ data: { data: [] } })) : { data: { data: [] } },
        encounterId ? encounterAPI.ordersSummary(encounterId).catch(() => null) : null,
        runPrescriptionSafetyChecks(prescriptionId).catch(() => null),
      ]);

      setState({
        loading: false,
        error: '',
        detail,
        summary: summaryResponse ? unwrapData(summaryResponse) : null,
        items: readItems(itemsResponse),
        patientSummary: patientSummary ? unwrapData(patientSummary) : null,
        allergies: readItems(allergies),
        problems: readItems(problems),
        activePrescriptions: readItems(activePrescriptions),
        history: readItems(history),
        encounter: encounterDetail ? unwrapData(encounterDetail) : null,
        encounterSummary: encounterSummary ? unwrapData(encounterSummary) : null,
        encounterOrders: readItems(encounterOrders),
        orderSummary: orderSummary ? unwrapData(orderSummary) : null,
        safety,
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getApiErrorMessage(error, 'Không thể tải chi tiết đơn thuốc.') }));
    }
  }

  useEffect(() => {
    loadDetail();
  }, [prescriptionId]);

  const row = state.detail || {};
  const patient = getPatient(row);
  const encounter = getEncounter(row);

  return (
    <div className="pharmacy-page pharmacy-workspace-page">
      <Toast message={actions.toast} onClose={() => actions.setToast('')} />
      <PageHeader
        eyebrow="Chi tiết đơn thuốc"
        title={row.prescription_no || prescriptionId}
        description="Tổng quan đơn, danh sách thuốc, an toàn thuốc và lịch sử bệnh nhân."
        icon={FileText}
        actions={(
          <>
            <button type="button" onClick={() => navigate('/pharmacy/prescriptions')}>
              Tất cả đơn
            </button>
            <button type="button" onClick={loadDetail}>
              <RefreshCw size={16} strokeWidth={2.25} aria-hidden="true" />
              Làm mới
            </button>
          </>
        )}
      />
      <InlineError message={state.error} onRetry={loadDetail} />
      {state.loading ? <LoadingRows rows={8} /> : (
        <section className="pharmacy-detail-layout">
          <article className="pharmacy-overview-card pharmacy-detail-main">
            <DetailTabs active={tab} onChange={setTab} />
            {tab === 'overview' ? (
              <div className="pharmacy-detail-grid">
                <article><small>Bệnh nhân</small><strong>{getPersonName(patient, row.patient_name || 'Bệnh nhân')}</strong></article>
                <article><small>Bác sĩ kê</small><strong>{getPersonName(row.prescribed_by, row.doctor_name || 'Bác sĩ')}</strong></article>
                <article><small>Khoa</small><strong>{encounter.department_name || encounter.department_id?.department_name || '--'}</strong></article>
                <article><small>Ngày kê</small><strong>{formatDateTime(row.prescribed_at || row.created_at)}</strong></article>
                <article><small>Trạng thái</small><StatusBadge status={row.status} /></article>
                <article><small>Số thuốc</small><strong>{formatNumber(state.items.length)}</strong></article>
              </div>
            ) : null}
            {tab === 'items' ? (
              <div className="pharmacy-detail-section">
                {state.items.length ? state.items.map((item) => (
                  <article className="pharmacy-medication-line is-large" key={item._id || item.id}>
                    <span>
                      <strong>{getMedicationName(item.medication_id)}</strong>
                      <small>{[item.dose || item.dosage, item.route, item.frequency, `${item.duration_days || '--'} ngày`].filter(Boolean).join(' · ')}</small>
                    </span>
                    <em>{formatNumber(item.quantity)} {item.unit || ''}</em>
                  </article>
                )) : <EmptyState title="Chưa có thuốc" description="Đơn thuốc chưa có item thuốc." />}
              </div>
            ) : null}
            {tab === 'safety' ? (
              <div className="pharmacy-safety-grid">
                <section>
                  <h3>Cảnh báo tự động</h3>
                  {state.safety?.findings?.length ? state.safety.findings.map((item, index) => (
                    <article className={`is-${item.tone}`} key={`${item.title}-${index}`}>
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                    </article>
                  )) : <article className="is-success"><strong>Không có cảnh báo nghiêm trọng</strong><span>Kiểm tra an toàn đã hoàn tất.</span></article>}
                </section>
                <section>
                  <h3>Dị ứng</h3>
                  {state.allergies.length ? state.allergies.map((item) => (
                    <article key={item._id || item.id}>
                      <strong>{item.allergen || item.name || 'Dị ứng'}</strong>
                      <span>{[item.severity, item.reaction].filter(Boolean).join(' · ') || '--'}</span>
                    </article>
                  )) : <small className="pharmacy-muted-text">Không có dị ứng được ghi nhận.</small>}
                </section>
                <section>
                  <h3>Vấn đề bệnh lý</h3>
                  {state.problems.length ? state.problems.map((item) => (
                    <article key={item._id || item.id}>
                      <strong>{item.problem_name || item.name || item.diagnosis || 'Vấn đề'}</strong>
                      <span>{item.status || item.severity || '--'}</span>
                    </article>
                  )) : <small className="pharmacy-muted-text">Không có problem active.</small>}
                </section>
              </div>
            ) : null}
            {tab === 'history' ? (
              <div className="pharmacy-history-list">
                {state.history.length ? state.history.map((item) => (
                  <button type="button" key={getPrescriptionId(item) || item.prescription_no} onClick={() => navigate(`/pharmacy/prescriptions/${getPrescriptionId(item)}`)}>
                    <span>
                      <strong>{item.prescription_no || getPrescriptionId(item)}</strong>
                      <small>{formatDateTime(item.prescribed_at || item.created_at)}</small>
                    </span>
                    <StatusBadge status={item.status} />
                  </button>
                )) : <EmptyState title="Chưa có lịch sử thuốc" description="Lịch sử đơn thuốc của bệnh nhân sẽ hiển thị tại đây." />}
              </div>
            ) : null}
          </article>
          <aside className="pharmacy-overview-card pharmacy-detail-side">
            <header className="pharmacy-card-head">
              <div>
                <span>Thao tác</span>
                <h2>Workflow</h2>
              </div>
            </header>
            <div className="pharmacy-side-actions">
              <button type="button" onClick={() => actions.handleVerify(row)}><BadgeCheck size={15} />Xác minh</button>
              <button type="button" onClick={() => actions.handleCreateDispense(row)}><PackageCheck size={15} />Tạo phiếu cấp phát</button>
              <button type="button" onClick={() => actions.handleComplete(row)}><CheckCircle2 size={15} />Hoàn tất</button>
              <button type="button" onClick={() => actions.handleDuplicate(row)}><Copy size={15} />Duplicate</button>
              <button type="button" onClick={() => actions.handleRenew(row)}><RefreshCw size={15} />Renew</button>
              <button type="button" className="is-danger" onClick={() => actions.handleCancel(row)}><Ban size={15} />Hủy đơn</button>
            </div>
            <div className="pharmacy-context-card">
              <h3>Ngữ cảnh lần khám</h3>
              <p>{state.encounterSummary?.summary || state.encounter?.encounter_code || 'Chưa có summary encounter.'}</p>
              <strong>{formatNumber(state.encounterOrders.length)} y lệnh liên quan</strong>
            </div>
          </aside>
        </section>
      )}
      <SafetyDialog
        state={actions.safetyDialog}
        busy={actions.busy}
        onCancel={() => actions.setSafetyDialog(null)}
        onConfirm={actions.confirmVerify}
      />
    </div>
  );
}

function getDispenseDate(row) {
  return row.dispensed_at || row.completed_at || row.created_at;
}

async function loadDispenseRows(mode, filters) {
  const status = mode === 'completed' ? 'dispensed' : filters.status || undefined;
  const response = await prescriptionAPI.listDispenses({
    limit: 100,
    status,
    patient_id: filters.patientId || undefined,
  });
  return readItems(response)
    .filter((item) => mode === 'queue'
      ? !['dispensed', 'cancelled', 'returned'].includes(String(item.status || '').toLowerCase())
      : ['dispensed', 'completed'].includes(String(item.status || '').toLowerCase()))
    .filter((item) => isInsideDateFilter(item, filters, getDispenseDate))
    .filter((item) => {
      const keyword = normalizeText(filters.search);
      if (!keyword) return true;
      return [
        item.dispense_no,
        item.prescription_id?.prescription_no,
        item.patient_id?.full_name,
        item.patient_name,
      ].filter(Boolean).join(' ').toLowerCase().includes(keyword);
    });
}

function DispenseDrawer({ dispenseId, onClose, onRefresh }) {
  const [state, setState] = useState({ loading: true, error: '', detail: null, items: [], transactions: [], charges: [] });

  useEffect(() => {
    let active = true;
    async function load() {
      setState({ loading: true, error: '', detail: null, items: [], transactions: [], charges: [] });
      try {
        const response = await prescriptionAPI.dispenseDetail(dispenseId);
        const payload = unwrapData(response) || {};
        if (!active) return;
        setState({
          loading: false,
          error: '',
          detail: payload.dispense || payload,
          items: payload.items || [],
          transactions: payload.inventory_transactions || [],
          charges: payload.charges || [],
        });
      } catch (error) {
        if (active) setState({ loading: false, error: getApiErrorMessage(error, 'Không thể tải phiếu cấp phát.'), detail: null, items: [], transactions: [], charges: [] });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [dispenseId]);

  const row = state.detail || {};

  return (
    <div className="pharmacy-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="pharmacy-drawer" aria-label="Chi tiết phiếu cấp phát" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Phiếu cấp phát</span>
            <h2>{row.dispense_no || dispenseId}</h2>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}>
            <X size={18} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </header>
        <InlineError message={state.error} />
        {state.loading ? <LoadingRows rows={5} /> : (
          <>
            <section className="pharmacy-detail-summary">
              <article><small>Đơn thuốc</small><strong>{row.prescription_id?.prescription_no || row.prescription_no || '--'}</strong></article>
              <article><small>Bệnh nhân</small><strong>{getPersonName(row.patient_id || row.patient, row.patient_name || 'Bệnh nhân')}</strong></article>
              <article><small>Trạng thái</small><StatusBadge status={row.status} map={DISPENSE_STATUS_META} /></article>
            </section>
            <section className="pharmacy-detail-section">
              <h3>Thuốc cấp phát</h3>
              {state.items.length ? state.items.map((item) => (
                <article className="pharmacy-medication-line" key={item._id || item.id}>
                  <span>
                    <strong>{getMedicationName(item.medication_id || item.prescription_item_id?.medication_id)}</strong>
                    <small>{item.stock_batch_id?.batch_no || item.batch_no || 'Tự chọn FEFO'}</small>
                  </span>
                  <em>{formatNumber(item.quantity)} {item.unit || ''}</em>
                </article>
              )) : <small className="pharmacy-muted-text">Chưa có item cấp phát.</small>}
            </section>
            <footer className="pharmacy-drawer-actions">
              <button type="button" onClick={() => printPharmacyView('In phiếu cấp phát')}><Printer size={15} />In phiếu</button>
              <button type="button" onClick={onRefresh}><RefreshCw size={15} />Làm mới</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

export function DispenseQueueScreen({ mode = 'queue' }) {
  const isCompleted = mode === 'completed';
  const { permissions } = usePharmacyWorkspace();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', dateFrom: '', dateTo: '', patientId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [selectedId, setSelectedId] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      setRows(await loadDispenseRows(mode, filters));
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Không thể tải hàng chờ cấp phát.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [mode, filters.search, filters.status, filters.dateFrom, filters.dateTo, filters.patientId]);

  async function handleComplete(row) {
    const dispenseId = getDispenseId(row);
    if (!dispenseId || !confirmPharmacyAction({ title: 'Hoàn tất phiếu cấp phát', message: `Hoàn tất phiếu ${row.dispense_no || dispenseId}?` })) return;
    try {
      await prescriptionAPI.completeDispense(dispenseId, { note: 'Hoàn tất từ Pharmacy Workspace.' });
      setToast('Đã hoàn tất cấp phát.');
      await loadData();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể hoàn tất phiếu cấp phát.'));
    }
  }

  async function handleCancel(row) {
    const dispenseId = getDispenseId(row);
    const reason = promptPharmacyText({
      title: 'Hủy phiếu cấp phát',
      message: `Nhập lý do hủy phiếu ${row.dispense_no || dispenseId}`,
    });
    if (!dispenseId || !reason) return;
    try {
      await prescriptionAPI.cancelDispense(dispenseId, { reason });
      setToast('Đã hủy phiếu cấp phát.');
      await loadData();
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể hủy phiếu cấp phát.'));
    }
  }

  const canComplete = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.dispensesComplete);
  const canCancel = hasAnyPermission(permissions, PHARMACY_PERMISSIONS.dispensesCancel);

  return (
    <div className="pharmacy-page pharmacy-workspace-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="Cấp phát thuốc"
        title={isCompleted ? 'Hoàn tất cấp phát' : 'Hàng chờ cấp phát'}
        description={isCompleted ? 'Danh sách phiếu đã hoàn tất cấp phát.' : 'Theo dõi phiếu cấp phát, trạng thái chuẩn bị, thiếu tồn kho và thao tác hoàn tất/hủy.'}
        icon={PackageCheck}
        actions={<Link to="/pharmacy/dispensing/create"><Plus size={16} />Tạo phiếu cấp phát</Link>}
      />
      <section className="pharmacy-workspace-filters">
        <label className="is-wide"><Search size={15} /><input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Tìm mã phiếu, mã đơn, bệnh nhân..." /></label>
        {!isCompleted ? (
          <label><Filter size={15} /><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Tất cả trạng thái</option><option value="draft">Chờ chuẩn bị</option><option value="partially_dispensed">Cấp một phần</option></select></label>
        ) : null}
        <label><span>Từ</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} /></label>
        <label><span>Đến</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} /></label>
        <label><Pill size={15} /><input value={filters.patientId} onChange={(event) => setFilters((current) => ({ ...current, patientId: event.target.value }))} placeholder="Patient ID" /></label>
        <button type="button" onClick={loadData}><RefreshCw size={15} />Làm mới</button>
      </section>
      <section className="pharmacy-overview-card pharmacy-workspace-card">
        <header className="pharmacy-card-head">
          <div><span>Cấp phát</span><h2>{isCompleted ? 'Phiếu đã hoàn tất' : 'Hàng chờ'}</h2></div>
          <strong>{formatNumber(rows.length)} phiếu</strong>
        </header>
        <InlineError message={error} onRetry={loadData} />
        {loading ? <LoadingRows rows={6} /> : rows.length ? (
          <div className="pharmacy-table-scroll">
            <table className="pharmacy-overview-table pharmacy-workspace-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Mã đơn thuốc</th>
                  <th>Bệnh nhân</th>
                  <th>Số thuốc</th>
                  <th>Trạng thái chuẩn bị</th>
                  <th>Thiếu tồn kho</th>
                  <th>Người tạo</th>
                  <th>Thời gian tạo</th>
                  {isCompleted ? <th>Ngày cấp phát</th> : null}
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={getDispenseId(row) || row.dispense_no}>
                    <td><strong>{row.dispense_no || getDispenseId(row)}</strong></td>
                    <td>{row.prescription_id?.prescription_no || row.prescription_no || '--'}</td>
                    <td>{getPersonName(row.patient_id || row.patient, row.patient_name || 'Bệnh nhân')}</td>
                    <td>{row.items_count ?? row.item_count ?? row.items?.length ?? '--'}</td>
                    <td><StatusBadge status={row.status} map={DISPENSE_STATUS_META} /></td>
                    <td>{row.has_stockout || row.stockout ? <span className="pharmacy-warning-pill">Thiếu tồn</span> : <span className="pharmacy-muted-text">Đủ</span>}</td>
                    <td>{getPersonName(row.created_by, row.created_by_name || '--')}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    {isCompleted ? <td>{formatDateTime(row.dispensed_at || row.completed_at)}</td> : null}
                    <td>
                      <div className="pharmacy-row-actions">
                        <button type="button" title="Xem phiếu" onClick={() => setSelectedId(getDispenseId(row))}><Eye size={15} /></button>
                        {canComplete && !isCompleted ? <button className="is-success" type="button" title="Hoàn tất" onClick={() => handleComplete(row)}><CheckCircle2 size={15} /></button> : null}
                        {canCancel && !isCompleted ? <button className="is-danger" type="button" title="Hủy" onClick={() => handleCancel(row)}><Ban size={15} /></button> : null}
                        {isCompleted ? <button type="button" title="In phiếu" onClick={() => printPharmacyView('In phiếu cấp phát')}><Printer size={15} /></button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="Chưa có phiếu cấp phát" description="Không có phiếu phù hợp với bộ lọc hiện tại." />}
      </section>
      {selectedId ? <DispenseDrawer dispenseId={selectedId} onClose={() => setSelectedId('')} onRefresh={loadData} /> : null}
    </div>
  );
}

export function DispenseCreateScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('prescription_id') || '');
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  async function loadReadyPrescriptions() {
    setLoading(true);
    try {
      const params = { status: 'verified', limit: 50, q: query || undefined, search: query || undefined };
      const response = query ? await prescriptionAPI.search(params) : await prescriptionAPI.list(params);
      setRows(readItems(response));
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể tải đơn sẵn sàng cấp phát.'));
    } finally {
      setLoading(false);
    }
  }

  async function loadSelected(id) {
    if (!id) {
      setDetail(null);
      setItems([]);
      setStockMap({});
      return;
    }
    setLoading(true);
    try {
      const [detailResponse, itemsResponse] = await Promise.all([
        prescriptionAPI.detail(id),
        prescriptionAPI.listItems(id),
      ]);
      const nextItems = readItems(itemsResponse);
      const stockResponses = await Promise.allSettled(
        nextItems.map((item) => {
          const medicationId = getMedicationId(item.medication_id);
          return medicationId ? prescriptionAPI.stockSelection(medicationId, { quantity: item.quantity }) : Promise.resolve(null);
        }),
      );
      setDetail(unwrapData(detailResponse)?.prescription || unwrapData(detailResponse));
      setItems(nextItems);
      setStockMap(Object.fromEntries(nextItems.map((item, index) => [
        item._id || item.id,
        stockResponses[index].status === 'fulfilled' && stockResponses[index].value ? unwrapData(stockResponses[index].value) : null,
      ])));
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể tải đơn thuốc được chọn.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReadyPrescriptions();
  }, []);

  useEffect(() => {
    loadSelected(selectedId);
  }, [selectedId]);

  async function submit() {
    if (!selectedId) {
      setToast('Chọn đơn thuốc trước khi tạo phiếu.');
      return;
    }
    setLoading(true);
    try {
      await prescriptionAPI.createDispense(selectedId, {
        allow_multiple_drafts: true,
        note,
      });
      setToast('Đã tạo phiếu cấp phát.');
      navigate('/pharmacy/dispensing/queue');
    } catch (error) {
      setToast(getApiErrorMessage(error, 'Không thể tạo phiếu cấp phát.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pharmacy-page pharmacy-workspace-page">
      <Toast message={toast} onClose={() => setToast('')} />
      <PageHeader
        eyebrow="Cấp phát thuốc"
        title="Tạo phiếu cấp phát"
        description="Tạo từ đơn thuốc đã xác minh hoặc tìm kiếm đơn sẵn sàng cấp phát."
        icon={Plus}
      />
      <section className="pharmacy-dispense-create-grid">
        <article className="pharmacy-overview-card">
          <header className="pharmacy-card-head"><div><span>Tìm đơn</span><h2>Đơn đã xác minh</h2></div></header>
          <div className="pharmacy-workspace-filters is-inline">
            <label className="is-wide"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã đơn, bệnh nhân, bác sĩ..." /></label>
            <button type="button" onClick={loadReadyPrescriptions}><Search size={15} />Tìm</button>
          </div>
          {loading && !detail ? <LoadingRows rows={4} /> : (
            <div className="pharmacy-select-list">
              {rows.map((row) => (
                <button key={getPrescriptionId(row)} type="button" className={selectedId === getPrescriptionId(row) ? 'is-active' : ''} onClick={() => setSelectedId(getPrescriptionId(row))}>
                  <span><strong>{row.prescription_no || getPrescriptionId(row)}</strong><small>{getPersonName(getPatient(row), row.patient_name || 'Bệnh nhân')}</small></span>
                  <StatusBadge status={row.status} />
                </button>
              ))}
            </div>
          )}
        </article>
        <article className="pharmacy-overview-card">
          <header className="pharmacy-card-head"><div><span>Phiếu cấp phát</span><h2>Thông tin tạo phiếu</h2></div></header>
          {!detail ? <EmptyState title="Chưa chọn đơn" description="Chọn một đơn đã xác minh để kiểm tra thuốc và lô khả dụng." /> : (
            <>
              <section className="pharmacy-detail-summary">
                <article><small>Mã đơn</small><strong>{detail.prescription_no || selectedId}</strong></article>
                <article><small>Bệnh nhân</small><strong>{getPersonName(getPatient(detail), detail.patient_name || 'Bệnh nhân')}</strong></article>
                <article><small>Trạng thái</small><StatusBadge status={detail.status} /></article>
              </section>
              <div className="pharmacy-detail-section">
                <h3>Danh sách thuốc cần cấp</h3>
                {items.map((item) => {
                  const stock = stockMap[item._id || item.id];
                  const stockItems = readItems(stock);
                  const available = stock?.available_quantity ?? stock?.total_available ?? stockItems.reduce((sum, batch) => sum + Number(batch.quantity_on_hand || batch.available_quantity || 0), 0);
                  return (
                    <article className="pharmacy-medication-line is-large" key={item._id || item.id}>
                      <span>
                        <strong>{getMedicationName(item.medication_id)}</strong>
                        <small>{stockItems[0]?.batch_no ? `Lô ưu tiên: ${stockItems[0].batch_no}` : 'FEFO tự chọn khi hoàn tất'}</small>
                      </span>
                      <em>{formatNumber(available)} khả dụng / cần {formatNumber(item.quantity)}</em>
                    </article>
                  );
                })}
              </div>
              <label className="pharmacy-note-field">
                <span>Ghi chú dược sĩ</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder="Ghi chú chuẩn bị/cấp phát..." />
              </label>
              <div className="pharmacy-form-actions">
                <button type="button" onClick={() => navigate('/pharmacy/prescriptions/ready-to-dispense')}>Hủy</button>
                <button type="button" className="is-primary" disabled={loading} onClick={submit}>
                  <PackageCheck size={15} />
                  Tạo phiếu cấp phát
                </button>
              </div>
            </>
          )}
        </article>
      </section>
    </div>
  );
}
