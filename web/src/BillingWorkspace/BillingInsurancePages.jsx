import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  FileCheck2,
  FileSearch,
  Loader2,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldAlert,
  WalletCards,
  X,
} from 'lucide-react';
import { readStoredAuth } from '../lib/storage';
import { billingInsuranceAPI, getBillingInsuranceErrorMessage } from './billingInsuranceApi';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('vi-VN');

const POLICY_STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  cancelled: 'Đã hủy',
  expired: 'Hết hạn',
};

const VERIFICATION_LABELS = {
  draft: 'Nháp',
  submitted: 'Chờ xác minh',
  pending_review: 'Đang review',
  verified: 'Đã xác minh',
  rejected: 'Bị từ chối',
  expired: 'Hết hạn',
  resubmission_required: 'Cần gửi lại',
};

const CLAIM_STATUS_LABELS = {
  draft: 'Chờ xử lý',
  submitted: 'Đã gửi',
  under_review: 'Đang review',
  approved: 'Đã duyệt',
  partially_approved: 'Duyệt một phần',
  rejected: 'Bị từ chối',
  settled: 'Đã quyết toán',
  cancelled: 'Đã hủy',
};

const SOURCE_LABELS = {
  staff_created: 'Nhân viên tạo',
  patient_submitted: 'Bệnh nhân gửi',
};

const CLAIM_VIEWS = {
  all: {
    title: 'Claims bảo hiểm',
    eyebrow: 'Viện phí & Thu tiền / Bảo hiểm / Claims',
    description: 'Theo dõi vòng đời hồ sơ claim từ khởi tạo, gửi, review, duyệt, từ chối đến settlement.',
    query: {},
  },
  pending: {
    title: 'Claim chờ xử lý',
    eyebrow: 'Viện phí & Thu tiền / Bảo hiểm / Claim chờ xử lý',
    description: 'Hoàn thiện hồ sơ claim trước khi gửi bảo hiểm.',
    query: { status: 'draft' },
  },
  submitted: {
    title: 'Claim đã gửi',
    eyebrow: 'Viện phí & Thu tiền / Bảo hiểm / Claim đã gửi',
    description: 'Theo dõi hồ sơ đã gửi sang đơn vị bảo hiểm và external reference.',
    query: { status: 'submitted' },
  },
  reviewing: {
    title: 'Claim đang review',
    eyebrow: 'Viện phí & Thu tiền / Bảo hiểm / Claim đang review',
    description: 'Đối chiếu invoice, policy và quyết định duyệt hoặc từ chối claim bảo hiểm.',
    query: { status: 'under_review' },
  },
  approved: {
    title: 'Claim được duyệt',
    eyebrow: 'Viện phí & Thu tiền / Bảo hiểm / Claim được duyệt',
    description: 'Theo dõi claim đã được duyệt, còn chờ nhận tiền hoặc thanh toán một phần.',
    query: { status: 'approved,partially_approved' },
  },
  rejected: {
    title: 'Claim bị từ chối',
    eyebrow: 'Viện phí & Thu tiền / Bảo hiểm / Claim bị từ chối',
    description: 'Phân tích lý do từ chối và hướng xử lý tiếp theo cho hồ sơ bảo hiểm.',
    query: { status: 'rejected' },
  },
};

const PERMISSION = {
  policyRead: 'insurance_policies.read',
  policyUpdate: 'insurance_policies.update',
  policyVerify: 'insurance_policies.verify',
  policyReject: 'insurance_policies.reject',
  policyCancel: 'insurance_policies.deactivate',
  claimUpdate: 'insurance_claims.update',
  claimSubmit: 'insurance_claims.submit',
  claimReview: 'insurance_claims.mark_under_review',
  claimApprove: 'insurance_claims.approve',
  claimPartialApprove: 'insurance_claims.partially_approve',
  claimReject: 'insurance_claims.reject',
  claimSettle: 'insurance_claims.settle',
  claimCancel: 'insurance_claims.cancel',
};

function getId(row = {}) {
  return row?._id || row?.id || row?.policy_id || row?.claim_id || null;
}

function getObjectId(value) {
  if (!value) return null;
  if (typeof value === 'object') return value._id || value.id || null;
  return value;
}

function getPatient(value = {}) {
  const patient = value.patient_id || value.patient || null;
  return patient && typeof patient === 'object' ? patient : null;
}

function getPolicy(value = {}) {
  const policy = value.policy_id || value.policy || null;
  return policy && typeof policy === 'object' ? policy : null;
}

function getInvoice(value = {}) {
  const invoice = value.invoice_id || value.invoice || null;
  return invoice && typeof invoice === 'object' ? invoice : null;
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function formatPercent(value) {
  if (value === undefined || value === null || value === '') return '-';
  return `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function daysSince(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  return `${days} ngày`;
}

function statusTone(status = '') {
  if (['active', 'verified', 'approved', 'settled'].includes(status)) return 'success';
  if (['submitted', 'pending_review', 'draft', 'under_review', 'partially_approved'].includes(status)) return 'warning';
  if (['rejected', 'cancelled', 'expired', 'inactive'].includes(status)) return 'danger';
  return 'info';
}

function summaryCount(summary, groupKey, status) {
  const rows = summary?.[groupKey] || [];
  return Number(rows.find((item) => item._id === status)?.count || 0);
}

function claimOutstanding(claim = {}) {
  return Math.max(0, Number(claim.approved_amount || 0) - Number(claim.paid_amount || 0));
}

function approvalRate(claim = {}) {
  if (!Number(claim.submitted_amount || 0)) return 0;
  return Number(claim.approved_amount || 0) / Number(claim.submitted_amount || 0);
}

function settlementRate(claim = {}) {
  if (!Number(claim.approved_amount || 0)) return 0;
  return Number(claim.paid_amount || 0) / Number(claim.approved_amount || 0);
}

function currentPermissions() {
  const auth = readStoredAuth() || {};
  const user = auth.user || auth.profile || {};
  return new Set([
    ...(auth.permissions || []),
    ...(auth.permission_codes || []),
    ...(user.permissions || []),
    ...(user.permission_codes || []),
  ]);
}

function can(codes = []) {
  const permissions = currentPermissions();
  if (!permissions.size) return true;
  return permissions.has('*') || permissions.has('system.full_access') || codes.some((code) => permissions.has(code));
}

function StatusBadge({ status, labels }) {
  return <span className={`bo-status bo-status--${statusTone(status)}`}>{labels?.[status] || status || '-'}</span>;
}

function EmptyState({ label }) {
  return (
    <div className="bo-empty">
      <FileSearch size={28} />
      <span>{label}</span>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, meta, money = false, tone = 'blue' }) {
  return (
    <article className={`bo-kpi bo-kpi--${tone}`}>
      <div className="bo-kpi__icon" aria-hidden="true"><Icon size={20} /></div>
      <div className="bo-kpi__body">
        <span>{label}</span>
        <strong>{money ? formatMoney(value) : formatNumber(value)}</strong>
        <small>{meta}</small>
      </div>
    </article>
  );
}

function InsuranceFrame({ eyebrow, title, description, loading, error, onRefresh, actions, children }) {
  return (
    <section className="billing-overview bi-workbench">
      <header className="bo-page-header">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="bi-header-actions">
          <div className="bo-refresh-indicator">
            {loading ? <Loader2 size={16} className="bo-spin" /> : <Clock3 size={16} />}
            <span>Dữ liệu trực tiếp</span>
          </div>
          {actions}
        </div>
      </header>
      {error ? <div className="bo-alert bo-alert--danger"><AlertTriangle size={16} />{error}</div> : null}
      {children}
      <button type="button" className="bi-floating-refresh" onClick={onRefresh} aria-label="Tải lại dữ liệu">
        {loading ? <Loader2 size={18} className="bo-spin" /> : <RefreshCcw size={18} />}
      </button>
    </section>
  );
}

function FilterBar({ filters, setFilters, children, placeholder = 'Tìm bệnh nhân, policy, claim, invoice' }) {
  return (
    <section className="bo-command-bar" aria-label="Bộ lọc bảo hiểm">
      <div className="bo-command-bar__filters">
        <label className="bo-command-bar__search">
          <Search size={16} aria-hidden="true" />
          <input
            value={filters.keyword}
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            placeholder={placeholder}
          />
        </label>
        {children}
        <label>
          <span>Giới hạn</span>
          <select
            value={filters.limit}
            onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value) }))}
          >
            <option value={20}>20 dòng</option>
            <option value={50}>50 dòng</option>
            <option value={100}>100 dòng</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function PatientCell({ row }) {
  const patient = getPatient(row);
  return (
    <div className="bo-patient-mini">
      <CreditCard size={18} />
      <span>
        <strong>{patient?.full_name || row.patient_name || '-'}</strong>
        <small>{[patient?.patient_code, patient?.phone].filter(Boolean).join(' · ') || getObjectId(row.patient_id) || '-'}</small>
      </span>
    </div>
  );
}

function AttachmentTile({ label, attachment }) {
  const fileUrl = attachment?.file_url || attachment?.url;
  return (
    <div className="bi-card-tile">
      <div className="bi-card-tile__preview">
        {fileUrl ? <img src={fileUrl} alt={label} /> : <ShieldAlert size={34} />}
      </div>
      <div>
        <strong>{label}</strong>
        <small>{attachment ? attachment.original_name || attachment.file_name || 'Có ảnh thẻ' : 'Chưa có ảnh'}</small>
      </div>
    </div>
  );
}

function usePolicyWorkbench(params) {
  const [state, setState] = useState({ rows: [], summary: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    Promise.all([
      billingInsuranceAPI.policies(params),
      billingInsuranceAPI.policySummary(params),
    ])
      .then(([list, summary]) => {
        if (!cancelled) setState({ rows: list?.items || [], summary, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ rows: [], summary: null, loading: false, error: getBillingInsuranceErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  return { ...state, refresh: () => setVersion((current) => current + 1) };
}

function useClaimWorkbench(params) {
  const [state, setState] = useState({ rows: [], summary: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: '' }));
    Promise.all([
      billingInsuranceAPI.claims(params),
      billingInsuranceAPI.claimSummary(params),
    ])
      .then(([list, summary]) => {
        if (!cancelled) setState({ rows: list?.items || [], summary, loading: false, error: '' });
      })
      .catch((error) => {
        if (!cancelled) setState({ rows: [], summary: null, loading: false, error: getBillingInsuranceErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  return { ...state, refresh: () => setVersion((current) => current + 1) };
}

function PolicyKpis({ summary }) {
  return (
    <div className="bo-kpi-grid bo-kpi-grid--compact">
      <KpiCard icon={ShieldAlert} label="Tổng policy" value={summary?.total_policies || 0} meta="Toàn bộ chính sách" />
      <KpiCard icon={BadgeCheck} label="Active" value={summaryCount(summary, 'by_status', 'active')} meta="Đang hiệu lực" tone="green" />
      <KpiCard icon={Clock3} label="Chờ xác minh" value={summaryCount(summary, 'by_verification', 'submitted')} meta="Queue bệnh nhân gửi" tone="amber" />
      <KpiCard icon={AlertTriangle} label="Thiếu ảnh thẻ" value={summary?.missing_card_image || 0} meta="Cần bổ sung hồ sơ" tone="danger" />
      <KpiCard icon={FileCheck2} label="Sắp hết hạn 30 ngày" value={summary?.expiring_30_days || 0} meta="Cần kiểm tra hiệu lực" tone="violet" />
    </div>
  );
}

function PolicyTable({ rows, onOpen, onAction }) {
  if (!rows.length) return <EmptyState label="Không có policy trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table bi-table">
        <thead>
          <tr>
            <th>Bệnh nhân</th>
            <th>Payer / Policy</th>
            <th>Coverage</th>
            <th>Hiệu lực</th>
            <th>Xác minh</th>
            <th>Trạng thái</th>
            <th>Nguồn</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getId(row)} onClick={() => onOpen(row)}>
              <td><PatientCell row={row} /></td>
              <td>
                <strong>{row.payer_name || '-'}</strong>
                <small>{[row.policy_no, row.member_no, row.payer_code].filter(Boolean).join(' · ') || '-'}</small>
              </td>
              <td>
                <strong>{formatPercent(row.coverage_percent)}</strong>
                <small>{row.coverage_type || (row.is_primary ? 'Primary policy' : '-')}</small>
              </td>
              <td>
                <span>{formatDate(row.valid_from)} - {formatDate(row.valid_to)}</span>
                <small>{row.valid_to ? `Còn/qua hạn theo ngày ${formatDate(row.valid_to)}` : '-'}</small>
              </td>
              <td><StatusBadge status={row.verification_status} labels={VERIFICATION_LABELS} /></td>
              <td><StatusBadge status={row.status} labels={POLICY_STATUS_LABELS} /></td>
              <td>{SOURCE_LABELS[row.source] || row.source || '-'}</td>
              <td>
                <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                  {row.verification_status === 'submitted' && can([PERMISSION.policyVerify]) ? <button type="button" className="bo-table-action" onClick={() => onAction('verify', row)}>Verify</button> : null}
                  {row.verification_status === 'submitted' && can([PERMISSION.policyReject]) ? <button type="button" className="bo-table-action" onClick={() => onAction('reject', row)}>Reject</button> : null}
                  {can([PERMISSION.policyUpdate]) ? <button type="button" className="bo-table-action" onClick={() => onAction('coverage', row)}>Coverage</button> : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolicyDrawer({ policy, onClose, onAction }) {
  if (!policy) return null;
  const patient = getPatient(policy);
  return (
    <aside className="bo-drawer bi-drawer" aria-label="Chi tiết policy bảo hiểm">
      <header>
        <div>
          <span>Policy detail</span>
          <h2>{policy.policy_no || getId(policy)}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><X size={18} /></button>
      </header>
      <div className="bo-drawer__body">
        <section className="bi-drawer-hero">
          <ShieldAlert size={24} />
          <div>
            <strong>{policy.payer_name || '-'}</strong>
            <small>{[policy.payer_code, policy.coverage_type, formatPercent(policy.coverage_percent)].filter(Boolean).join(' · ')}</small>
          </div>
        </section>
        <section>
          <h3>Bệnh nhân</h3>
          <dl>
            <div><dt>Họ tên</dt><dd>{patient?.full_name || '-'}</dd></div>
            <div><dt>Mã BN</dt><dd>{patient?.patient_code || '-'}</dd></div>
            <div><dt>Liên hệ</dt><dd>{patient?.phone || '-'}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Thông tin bảo hiểm</h3>
          <dl>
            <div><dt>Policy no</dt><dd>{policy.policy_no || '-'}</dd></div>
            <div><dt>Member no</dt><dd>{policy.member_no || '-'}</dd></div>
            <div><dt>Coverage</dt><dd>{formatPercent(policy.coverage_percent)}</dd></div>
            <div><dt>Primary</dt><dd>{policy.is_primary ? 'Có' : 'Không'}</dd></div>
            <div><dt>Hiệu lực</dt><dd>{formatDate(policy.valid_from)} - {formatDate(policy.valid_to)}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Ảnh thẻ</h3>
          <div className="bi-card-grid">
            <AttachmentTile label="Mặt trước" attachment={policy.front_card_attachment_id} />
            <AttachmentTile label="Mặt sau" attachment={policy.back_card_attachment_id} />
          </div>
        </section>
        <section>
          <h3>Xử lý</h3>
          <dl>
            <div><dt>Verification</dt><dd><StatusBadge status={policy.verification_status} labels={VERIFICATION_LABELS} /></dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={policy.status} labels={POLICY_STATUS_LABELS} /></dd></div>
            <div><dt>Submitted</dt><dd>{formatDateTime(policy.submitted_at)}</dd></div>
            <div><dt>Reviewed</dt><dd>{formatDateTime(policy.reviewed_at)}</dd></div>
            <div><dt>Lý do từ chối</dt><dd>{policy.rejection_reason || '-'}</dd></div>
          </dl>
          <div className="bi-action-strip">
            {can([PERMISSION.policyVerify]) ? <button type="button" onClick={() => onAction('verify', policy)}><CheckCircle2 size={16} />Verify</button> : null}
            {can([PERMISSION.policyReject]) ? <button type="button" onClick={() => onAction('reject', policy)}><AlertTriangle size={16} />Reject</button> : null}
            {can([PERMISSION.policyUpdate]) ? <button type="button" onClick={() => onAction('primary', policy)}><BadgeCheck size={16} />Primary</button> : null}
            {can([PERMISSION.policyUpdate]) ? <button type="button" onClick={() => onAction('attach', policy)}><FileCheck2 size={16} />Thay ảnh</button> : null}
            {can([PERMISSION.policyCancel]) ? <button type="button" onClick={() => onAction('cancel', policy)}><X size={16} />Cancel</button> : null}
          </div>
        </section>
      </div>
    </aside>
  );
}

export function InsurancePoliciesPage() {
  const [filters, setFilters] = useState({ keyword: '', verification_status: '', status: '', payer_name: '', limit: 50 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({
    page: 1,
    limit: filters.limit,
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.verification_status ? { verification_status: filters.verification_status } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.payer_name ? { payer_name: filters.payer_name } : {}),
  }), [filters]);
  const { rows, summary, loading, error, refresh } = usePolicyWorkbench(params);

  async function runAction(action, policy) {
    try {
      if (action === 'verify') {
        const input = window.prompt('Coverage percent sau khi xác minh', policy.coverage_percent ?? 80);
        if (input === null) return;
        await billingInsuranceAPI.verifyPolicy(getId(policy), { coverage_percent: Number(input) });
        setToast('Đã xác minh policy.');
      }
      if (action === 'reject') {
        const reason = window.prompt('Lý do từ chối', policy.rejection_reason || 'Thông tin thẻ chưa khớp');
        if (!reason) return;
        await billingInsuranceAPI.rejectPolicy(getId(policy), { reason });
        setToast('Đã từ chối policy.');
      }
      if (action === 'coverage') {
        const input = window.prompt('Coverage percent', policy.coverage_percent ?? 0);
        if (input === null) return;
        await billingInsuranceAPI.updatePolicy(getId(policy), { coverage_percent: Number(input) });
        setToast('Đã cập nhật coverage.');
      }
      if (action === 'primary') {
        await billingInsuranceAPI.updatePolicy(getId(policy), { is_primary: true });
        setToast('Đã đặt làm policy chính.');
      }
      if (action === 'attach') {
        const attachmentId = window.prompt('Attachment ID ảnh thẻ');
        if (!attachmentId) return;
        const side = window.prompt('Mặt thẻ: front hoặc back', 'front');
        if (!['front', 'back'].includes(side)) return;
        await billingInsuranceAPI.attachPolicyCard(getId(policy), { attachment_id: attachmentId, side });
        setToast('Đã gắn ảnh thẻ vào policy.');
      }
      if (action === 'cancel') {
        const reason = window.prompt('Lý do cancel policy', 'Policy không còn sử dụng');
        if (!reason) return;
        await billingInsuranceAPI.cancelPolicy(getId(policy), { reason });
        setToast('Đã cancel policy.');
      }
      refresh();
    } catch (actionError) {
      setToast(getBillingInsuranceErrorMessage(actionError));
    }
  }

  return (
    <InsuranceFrame
      eyebrow="Viện phí & Thu tiền / Bảo hiểm / Chính sách bảo hiểm"
      title="Chính sách bảo hiểm"
      description="Quản lý thẻ bảo hiểm, đơn vị chi trả, hiệu lực, coverage và trạng thái xác minh."
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="bi-primary-action" onClick={refresh}><RefreshCcw size={16} />Tải lại</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} placeholder="Tìm tên BN, mã BN, payer, policy no, member no">
        <label>
          <span>Xác minh</span>
          <select value={filters.verification_status} onChange={(event) => setFilters((current) => ({ ...current, verification_status: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="submitted">Chờ xác minh</option>
            <option value="verified">Đã xác minh</option>
            <option value="rejected">Bị từ chối</option>
            <option value="draft">Nháp</option>
          </select>
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Tất cả</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          <span>Payer</span>
          <input value={filters.payer_name} onChange={(event) => setFilters((current) => ({ ...current, payer_name: event.target.value }))} placeholder="BHYT, VSS..." />
        </label>
      </FilterBar>
      {toast ? <div className="bo-alert"><CheckCircle2 size={16} />{toast}</div> : null}
      <PolicyKpis summary={summary} />
      <section className="bi-main-with-drawer">
        <PolicyTable rows={rows} onOpen={setSelected} onAction={runAction} />
        <PolicyDrawer policy={selected} onClose={() => setSelected(null)} onAction={runAction} />
      </section>
    </InsuranceFrame>
  );
}

export function InsuranceVerificationPage() {
  const [selected, setSelected] = useState(null);
  const [coverage, setCoverage] = useState('');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({ page: 1, limit: 50, verification_status: 'submitted', source: 'patient_submitted' }), []);
  const { rows, summary, loading, error, refresh } = usePolicyWorkbench(params);

  useEffect(() => {
    if (!selected && rows.length) setSelected(rows[0]);
  }, [rows, selected]);

  useEffect(() => {
    setCoverage(selected?.coverage_percent ?? '');
    setNote('');
  }, [selected]);

  async function decide(action) {
    if (!selected) return;
    try {
      if (action === 'verify') {
        await billingInsuranceAPI.verifyPolicy(getId(selected), { coverage_percent: coverage === '' ? undefined : Number(coverage) });
        setToast('Đã duyệt policy trong queue xác minh.');
      } else {
        const reason = note || window.prompt('Lý do từ chối', 'Ảnh thẻ hoặc thông tin chưa hợp lệ');
        if (!reason) return;
        await billingInsuranceAPI.rejectPolicy(getId(selected), { reason });
        setToast('Đã từ chối policy.');
      }
      setSelected(null);
      refresh();
    } catch (actionError) {
      setToast(getBillingInsuranceErrorMessage(actionError));
    }
  }

  return (
    <InsuranceFrame
      eyebrow="Viện phí & Thu tiền / Bảo hiểm / Chờ xác minh"
      title="Chờ xác minh"
      description="Duyệt thẻ bảo hiểm bệnh nhân gửi lên, kiểm tra ảnh thẻ, coverage và hiệu lực policy."
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="bi-primary-action" onClick={refresh}><RefreshCcw size={16} />Lấy queue mới</button>}
    >
      {toast ? <div className="bo-alert"><CheckCircle2 size={16} />{toast}</div> : null}
      <PolicyKpis summary={summary} />
      <section className="bi-verification-layout">
        <div className="bi-queue">
          <header>
            <span>Queue bệnh nhân</span>
            <strong>{formatNumber(rows.length)} hồ sơ</strong>
          </header>
          {rows.length ? rows.map((policy) => {
            const patient = getPatient(policy);
            return (
              <button
                type="button"
                key={getId(policy)}
                className={`bi-queue-item ${getId(selected) === getId(policy) ? 'is-active' : ''}`}
                onClick={() => setSelected(policy)}
              >
                <strong>{patient?.full_name || policy.policy_no}</strong>
                <span>{patient?.patient_code || policy.payer_name}</span>
                <small>{policy.payer_name} · đợi {daysSince(policy.submitted_at)}</small>
              </button>
            );
          }) : <EmptyState label="Không còn policy chờ xác minh." />}
        </div>
        <div className="bi-review-stage">
          {selected ? (
            <>
              <div className="bi-stage-header">
                <div>
                  <span>Review workspace</span>
                  <h2>{selected.payer_name || '-'}</h2>
                </div>
                <StatusBadge status={selected.verification_status} labels={VERIFICATION_LABELS} />
              </div>
              <div className="bi-card-grid bi-card-grid--large">
                <AttachmentTile label="Mặt trước" attachment={selected.front_card_attachment_id} />
                <AttachmentTile label="Mặt sau" attachment={selected.back_card_attachment_id} />
              </div>
              <div className="bi-compare-grid">
                <section>
                  <h3>Patient profile</h3>
                  <dl>
                    <div><dt>Tên</dt><dd>{getPatient(selected)?.full_name || '-'}</dd></div>
                    <div><dt>Mã BN</dt><dd>{getPatient(selected)?.patient_code || '-'}</dd></div>
                    <div><dt>Ngày sinh</dt><dd>{formatDate(getPatient(selected)?.date_of_birth)}</dd></div>
                    <div><dt>SĐT</dt><dd>{getPatient(selected)?.phone || '-'}</dd></div>
                  </dl>
                </section>
                <section>
                  <h3>Submitted policy</h3>
                  <dl>
                    <div><dt>Payer</dt><dd>{selected.payer_name || '-'}</dd></div>
                    <div><dt>Policy no</dt><dd>{selected.policy_no || '-'}</dd></div>
                    <div><dt>Member no</dt><dd>{selected.member_no || '-'}</dd></div>
                    <div><dt>Coverage</dt><dd>{formatPercent(selected.coverage_percent)}</dd></div>
                    <div><dt>Hiệu lực</dt><dd>{formatDate(selected.valid_from)} - {formatDate(selected.valid_to)}</dd></div>
                  </dl>
                </section>
              </div>
            </>
          ) : <EmptyState label="Chọn một hồ sơ trong queue để review." />}
        </div>
        <aside className="bi-decision-panel">
          <header>
            <span>Decision panel</span>
            <strong>{selected ? selected.policy_no : '-'}</strong>
          </header>
          <label>
            <span>Coverage percent final</span>
            <input type="number" min="0" max="100" value={coverage} onChange={(event) => setCoverage(event.target.value)} />
          </label>
          <label>
            <span>Reviewer note / reject reason</span>
            <textarea rows={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú nội bộ hoặc lý do từ chối" />
          </label>
          <div className="bi-risk-flags">
            {!selected?.front_card_attachment_id ? <span>Thiếu ảnh mặt trước</span> : null}
            {!selected?.back_card_attachment_id ? <span>Thiếu ảnh mặt sau</span> : null}
            {Number(selected?.coverage_percent || 0) > 100 ? <span>Coverage &gt; 100</span> : null}
            {selected?.valid_to && new Date(selected.valid_to) < new Date() ? <span>Policy hết hạn</span> : null}
          </div>
          <div className="bi-action-stack">
            <button type="button" disabled={!selected || !can([PERMISSION.policyVerify])} onClick={() => decide('verify')}>
              <CheckCircle2 size={16} />Verify policy
            </button>
            <button type="button" disabled={!selected || !can([PERMISSION.policyReject])} onClick={() => decide('reject')}>
              <AlertTriangle size={16} />Reject policy
            </button>
          </div>
        </aside>
      </section>
    </InsuranceFrame>
  );
}

function ClaimKpis({ summary, rows }) {
  const pageSubmitted = rows.reduce((sum, row) => sum + Number(row.submitted_amount || 0), 0);
  const pageApproved = rows.reduce((sum, row) => sum + Number(row.approved_amount || 0), 0);
  const pagePaid = rows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  return (
    <div className="bo-kpi-grid bo-kpi-grid--compact">
      <KpiCard icon={ClipboardList} label="Tổng claims" value={summary?.total?.count || 0} meta="Theo bộ lọc hiện tại" />
      <KpiCard icon={Clock3} label="Đang xử lý" value={summaryCount(summary, 'by_status', 'draft') + summaryCount(summary, 'by_status', 'submitted') + summaryCount(summary, 'by_status', 'under_review')} meta="Draft, submitted, review" tone="amber" />
      <KpiCard icon={Banknote} label="Submitted amount" value={summary?.total?.submitted_amount || pageSubmitted} money meta="Tổng tiền gửi" tone="green" />
      <KpiCard icon={BadgeCheck} label="Approved amount" value={summary?.total?.approved_amount || pageApproved} money meta="Tổng tiền duyệt" tone="violet" />
      <KpiCard icon={WalletCards} label="Outstanding" value={summary?.outstanding_amount || Math.max(0, pageApproved - pagePaid)} money meta="Còn phải thu bảo hiểm" tone="danger" />
    </div>
  );
}

function ClaimTable({ rows, onOpen, onAction }) {
  if (!rows.length) return <EmptyState label="Không có claim trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table bi-table">
        <thead>
          <tr>
            <th>Claim</th>
            <th>Bệnh nhân</th>
            <th>Invoice</th>
            <th>Payer</th>
            <th>Submitted</th>
            <th>Approved / Paid</th>
            <th>Outstanding</th>
            <th>Trạng thái</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const policy = getPolicy(row);
            const invoice = getInvoice(row);
            return (
              <tr key={getId(row)} onClick={() => onOpen(row)}>
                <td><strong>{row.claim_no || getId(row)}</strong><small>{row.external_claim_ref || formatDateTime(row.submitted_at || row.created_at)}</small></td>
                <td><PatientCell row={row} /></td>
                <td><strong>{invoice?.invoice_no || getObjectId(row.invoice_id) || '-'}</strong><small>{invoice?.status || '-'}</small></td>
                <td><strong>{policy?.payer_name || '-'}</strong><small>{policy?.policy_no || '-'}</small></td>
                <td>{formatMoney(row.submitted_amount)}</td>
                <td>
                  <strong>{formatMoney(row.approved_amount)}</strong>
                  <small>Paid {formatMoney(row.paid_amount)}</small>
                </td>
                <td>
                  <strong>{formatMoney(claimOutstanding(row))}</strong>
                  <small>{Math.round(approvalRate(row) * 100)}% duyệt · {Math.round(settlementRate(row) * 100)}% settle</small>
                </td>
                <td><StatusBadge status={row.status} labels={CLAIM_STATUS_LABELS} /></td>
                <td>
                  <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                    {row.status === 'draft' && can([PERMISSION.claimSubmit]) ? <button type="button" className="bo-table-action" onClick={() => onAction('submit', row)}>Submit</button> : null}
                    {row.status === 'submitted' && can([PERMISSION.claimReview]) ? <button type="button" className="bo-table-action" onClick={() => onAction('review', row)}>Review</button> : null}
                    {row.status === 'under_review' && can([PERMISSION.claimApprove, PERMISSION.claimPartialApprove]) ? <button type="button" className="bo-table-action" onClick={() => onAction('approve', row)}>Approve</button> : null}
                    {['approved', 'partially_approved'].includes(row.status) && can([PERMISSION.claimSettle]) ? <button type="button" className="bo-table-action" onClick={() => onAction('settle', row)}>Settle</button> : null}
                    {['draft', 'submitted'].includes(row.status) && can([PERMISSION.claimUpdate]) ? <button type="button" className="bo-table-action" onClick={() => onAction('edit', row)}>Sửa</button> : null}
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

function ClaimDrawer({ claim, onClose, onAction }) {
  const [state, setState] = useState({ detail: null, readiness: null, settlements: null, loading: false, error: '' });
  const claimId = getId(claim);

  useEffect(() => {
    if (!claimId) return;
    let cancelled = false;
    setState({ detail: claim, readiness: null, settlements: null, loading: true, error: '' });
    Promise.allSettled([
      billingInsuranceAPI.claimDetail(claimId),
      billingInsuranceAPI.claimReadiness(claimId),
      billingInsuranceAPI.claimSettlements(claimId),
    ]).then((results) => {
      if (cancelled) return;
      setState({
        detail: results[0].status === 'fulfilled' ? results[0].value : claim,
        readiness: results[1].status === 'fulfilled' ? results[1].value : null,
        settlements: results[2].status === 'fulfilled' ? results[2].value : null,
        loading: false,
        error: results.find((result) => result.status === 'rejected')?.reason ? 'Một phần dữ liệu chi tiết chưa tải được.' : '',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  if (!claim) return null;
  const detail = state.detail || claim;
  const policy = getPolicy(detail);
  const invoice = getInvoice(detail);
  const readiness = state.readiness;
  const settlements = state.settlements;

  return (
    <aside className="bo-drawer bi-drawer" aria-label="Chi tiết claim bảo hiểm">
      <header>
        <div>
          <span>Claim detail</span>
          <h2>{detail.claim_no || claimId}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"><X size={18} /></button>
      </header>
      <div className="bo-drawer__body">
        {state.loading ? <div className="bo-alert"><Loader2 size={16} className="bo-spin" />Đang tải chi tiết claim...</div> : null}
        {state.error ? <div className="bo-alert bo-alert--danger"><AlertTriangle size={16} />{state.error}</div> : null}
        <section className="bi-drawer-hero">
          <ReceiptText size={24} />
          <div>
            <strong>{CLAIM_STATUS_LABELS[detail.status] || detail.status}</strong>
            <small>{policy?.payer_name || '-'} · {invoice?.invoice_no || getObjectId(detail.invoice_id) || '-'}</small>
          </div>
        </section>
        <section>
          <h3>Financial</h3>
          <div className="bi-money-grid">
            <span><small>Submitted</small><strong>{formatMoney(detail.submitted_amount)}</strong></span>
            <span><small>Approved</small><strong>{formatMoney(detail.approved_amount)}</strong></span>
            <span><small>Paid</small><strong>{formatMoney(detail.paid_amount)}</strong></span>
            <span><small>Outstanding</small><strong>{formatMoney(claimOutstanding(detail))}</strong></span>
          </div>
        </section>
        <section>
          <h3>Tổng quan</h3>
          <dl>
            <div><dt>Patient</dt><dd>{getPatient(detail)?.full_name || '-'}</dd></div>
            <div><dt>Invoice</dt><dd>{invoice?.invoice_no || '-'}</dd></div>
            <div><dt>Payer</dt><dd>{policy?.payer_name || '-'}</dd></div>
            <div><dt>Policy no</dt><dd>{policy?.policy_no || '-'}</dd></div>
            <div><dt>External ref</dt><dd>{detail.external_claim_ref || '-'}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDateTime(detail.submitted_at)}</dd></div>
            <div><dt>Approved</dt><dd>{formatDateTime(detail.approved_at)}</dd></div>
            <div><dt>Settled</dt><dd>{formatDateTime(detail.settled_at)}</dd></div>
          </dl>
        </section>
        <section>
          <h3>Readiness</h3>
          {readiness ? (
            <div className="bi-readiness">
              <strong className={readiness.ready ? 'is-ready' : 'is-blocked'}>{readiness.ready ? 'Ready to submit' : 'Có blocker'}</strong>
              {[...(readiness.blockers || []), ...(readiness.warnings || [])].map((item) => (
                <span key={`${item.code}-${item.message}`}>{item.message}</span>
              ))}
            </div>
          ) : <small>Readiness API chưa trả dữ liệu.</small>}
        </section>
        <section>
          <h3>Settlement history</h3>
          {settlements?.payments?.length ? settlements.payments.map((payment) => (
            <div className="bi-settlement-line" key={payment._id || payment.payment_no}>
              <strong>{payment.payment_no || payment.transaction_ref}</strong>
              <span>{formatMoney(payment.amount)} · {formatDateTime(payment.paid_at)}</span>
            </div>
          )) : <small>Chưa có payment insurance gắn với claim.</small>}
        </section>
        <section>
          <h3>Actions</h3>
          <div className="bi-action-strip">
            {detail.status === 'draft' && can([PERMISSION.claimSubmit]) ? <button type="button" onClick={() => onAction('submit', detail)}><FileCheck2 size={16} />Submit</button> : null}
            {detail.status === 'submitted' && can([PERMISSION.claimReview]) ? <button type="button" onClick={() => onAction('review', detail)}><ClipboardCheck size={16} />Under review</button> : null}
            {detail.status === 'under_review' && can([PERMISSION.claimApprove, PERMISSION.claimPartialApprove]) ? <button type="button" onClick={() => onAction('approve', detail)}><BadgeCheck size={16} />Approve</button> : null}
            {detail.status === 'under_review' && can([PERMISSION.claimReject]) ? <button type="button" onClick={() => onAction('reject', detail)}><AlertTriangle size={16} />Reject</button> : null}
            {['approved', 'partially_approved'].includes(detail.status) && can([PERMISSION.claimSettle]) ? <button type="button" onClick={() => onAction('settle', detail)}><CircleDollarSign size={16} />Settle</button> : null}
            {!['settled', 'cancelled', 'rejected'].includes(detail.status) && can([PERMISSION.claimCancel]) ? <button type="button" onClick={() => onAction('cancel', detail)}><X size={16} />Cancel</button> : null}
          </div>
        </section>
      </div>
    </aside>
  );
}

function useClaimActions(refresh, setToast) {
  return async function runAction(action, claim) {
    try {
      if (action === 'submit') {
        await billingInsuranceAPI.submitClaim(getId(claim));
        setToast('Đã submit claim.');
      }
      if (action === 'review') {
        await billingInsuranceAPI.markUnderReview(getId(claim));
        setToast('Đã chuyển claim sang under review.');
      }
      if (action === 'approve') {
        const defaultAmount = claim.submitted_amount || claim.approved_amount || 0;
        const amount = window.prompt('Approved amount', defaultAmount);
        if (amount === null) return;
        const externalRef = window.prompt('External claim ref', claim.external_claim_ref || '');
        await billingInsuranceAPI.approveClaim(getId(claim), { approved_amount: Number(amount), external_claim_ref: externalRef || undefined });
        setToast('Đã duyệt claim.');
      }
      if (action === 'reject') {
        const reason = window.prompt('Lý do từ chối claim', claim.rejection_reason || 'Hồ sơ chưa đủ điều kiện duyệt');
        if (!reason) return;
        await billingInsuranceAPI.rejectClaim(getId(claim), { reason });
        setToast('Đã từ chối claim.');
      }
      if (action === 'settle') {
        const remaining = claimOutstanding(claim);
        const amount = window.prompt('Paid amount settlement', remaining || claim.approved_amount || 0);
        if (amount === null) return;
        const transactionRef = window.prompt('Transaction ref', claim.external_claim_ref || claim.claim_no || '');
        await billingInsuranceAPI.settleClaim(getId(claim), {
          paid_amount: Number(amount),
          transaction_ref: transactionRef || undefined,
        });
        setToast('Đã ghi nhận settlement bảo hiểm.');
      }
      if (action === 'cancel') {
        const reason = window.prompt('Lý do hủy claim', claim.cancel_reason || 'Hủy theo nghiệp vụ bảo hiểm');
        if (!reason) return;
        await billingInsuranceAPI.cancelClaim(getId(claim), { reason });
        setToast('Đã hủy claim.');
      }
      if (action === 'edit') {
        const amount = window.prompt('Submitted amount', claim.submitted_amount || 0);
        if (amount === null) return;
        const externalRef = window.prompt('External claim ref', claim.external_claim_ref || '');
        await billingInsuranceAPI.updateClaim(getId(claim), {
          submitted_amount: Number(amount),
          external_claim_ref: externalRef || undefined,
        });
        setToast('Đã cập nhật claim.');
      }
      refresh();
    } catch (error) {
      setToast(getBillingInsuranceErrorMessage(error));
    }
  };
}

export function InsuranceClaimsPage({ view = 'all' }) {
  const config = CLAIM_VIEWS[view] || CLAIM_VIEWS.all;
  const [filters, setFilters] = useState({ keyword: '', payer_name: '', limit: 50 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({
    page: 1,
    limit: filters.limit,
    ...(config.query || {}),
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.payer_name ? { payer_name: filters.payer_name } : {}),
  }), [config, filters]);
  const { rows, summary, loading, error, refresh } = useClaimWorkbench(params);
  const runAction = useClaimActions(refresh, setToast);

  return (
    <InsuranceFrame
      eyebrow={config.eyebrow}
      title={config.title}
      description={config.description}
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="bi-primary-action" onClick={refresh}><RefreshCcw size={16} />Tải lại</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} placeholder="Tìm claim no, invoice no, patient, payer, external ref">
        <label>
          <span>Payer</span>
          <input value={filters.payer_name} onChange={(event) => setFilters((current) => ({ ...current, payer_name: event.target.value }))} placeholder="BHYT, VSS..." />
        </label>
      </FilterBar>
      {toast ? <div className="bo-alert"><CheckCircle2 size={16} />{toast}</div> : null}
      <ClaimKpis summary={summary} rows={rows} />
      <section className="bi-main-with-drawer">
        <ClaimTable rows={rows} onOpen={setSelected} onAction={runAction} />
        <ClaimDrawer claim={selected} onClose={() => setSelected(null)} onAction={runAction} />
      </section>
    </InsuranceFrame>
  );
}

function SettlementTable({ rows, onOpen, onAction }) {
  if (!rows.length) return <EmptyState label="Không có claim settlement trong bộ lọc này." />;
  return (
    <div className="bo-table-wrap">
      <table className="bo-table bi-table">
        <thead>
          <tr>
            <th>Claim</th>
            <th>Payer</th>
            <th>Bệnh nhân</th>
            <th>Approved</th>
            <th>Paid</th>
            <th>Remaining</th>
            <th>Ngày duyệt</th>
            <th>Trạng thái</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const policy = getPolicy(row);
            return (
              <tr key={getId(row)} onClick={() => onOpen(row)}>
                <td><strong>{row.claim_no || getId(row)}</strong><small>{row.external_claim_ref || '-'}</small></td>
                <td><strong>{policy?.payer_name || '-'}</strong><small>{policy?.payer_code || policy?.policy_no || '-'}</small></td>
                <td><PatientCell row={row} /></td>
                <td>{formatMoney(row.approved_amount)}</td>
                <td>{formatMoney(row.paid_amount)}</td>
                <td><strong>{formatMoney(claimOutstanding(row))}</strong></td>
                <td>{formatDateTime(row.approved_at)}</td>
                <td><StatusBadge status={row.status} labels={CLAIM_STATUS_LABELS} /></td>
                <td>
                  <div className="bo-row-actions" onClick={(event) => event.stopPropagation()}>
                    {['approved', 'partially_approved'].includes(row.status) && can([PERMISSION.claimSettle]) ? <button type="button" className="bo-table-action" onClick={() => onAction('settle', row)}>Settle</button> : null}
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

export function InsuranceSettlementPage() {
  const [filters, setFilters] = useState({ keyword: '', payer_name: '', limit: 50 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');
  const params = useMemo(() => ({
    page: 1,
    limit: filters.limit,
    status: 'approved,partially_approved,settled',
    ...(filters.keyword ? { keyword: filters.keyword } : {}),
    ...(filters.payer_name ? { payer_name: filters.payer_name } : {}),
  }), [filters]);
  const { rows, summary, loading, error, refresh } = useClaimWorkbench(params);
  const runAction = useClaimActions(refresh, setToast);
  const paidTotal = rows.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);
  const remainingTotal = rows.reduce((sum, row) => sum + claimOutstanding(row), 0);

  return (
    <InsuranceFrame
      eyebrow="Viện phí & Thu tiền / Bảo hiểm / Settlement"
      title="Settlement bảo hiểm"
      description="Theo dõi tiền bảo hiểm phải thu, đã nhận, chênh lệch và đối soát settlement vào invoice."
      loading={loading}
      error={error}
      onRefresh={refresh}
      actions={<button type="button" className="bi-primary-action" onClick={refresh}><RefreshCcw size={16} />Đối soát lại</button>}
    >
      <FilterBar filters={filters} setFilters={setFilters} placeholder="Tìm claim, invoice, patient, payer, external ref">
        <label>
          <span>Payer</span>
          <input value={filters.payer_name} onChange={(event) => setFilters((current) => ({ ...current, payer_name: event.target.value }))} placeholder="Tên đơn vị chi trả" />
        </label>
      </FilterBar>
      {toast ? <div className="bo-alert"><CheckCircle2 size={16} />{toast}</div> : null}
      <div className="bo-kpi-grid bo-kpi-grid--compact">
        <KpiCard icon={BadgeCheck} label="Awaiting settlement" value={summaryCount(summary, 'by_status', 'approved') + summaryCount(summary, 'by_status', 'partially_approved')} meta="Đã duyệt/chưa nhận đủ" />
        <KpiCard icon={CircleDollarSign} label="Approved amount" value={summary?.total?.approved_amount || 0} money meta="Tổng tiền được duyệt" tone="green" />
        <KpiCard icon={WalletCards} label="Paid amount" value={summary?.total?.paid_amount || paidTotal} money meta="Đã nhận từ bảo hiểm" tone="violet" />
        <KpiCard icon={AlertTriangle} label="Outstanding" value={summary?.outstanding_amount || remainingTotal} money meta="Còn phải thu" tone="danger" />
      </div>
      <section className="bi-main-with-drawer">
        <SettlementTable rows={rows} onOpen={setSelected} onAction={runAction} />
        <ClaimDrawer claim={selected} onClose={() => setSelected(null)} onAction={runAction} />
      </section>
    </InsuranceFrame>
  );
}
