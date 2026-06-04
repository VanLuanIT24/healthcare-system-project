import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  Eye,
  FileClock,
  FileText,
  Filter,
  Flag,
  HeartPulse,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminActionConfirmDialog } from '../components/AdminActionConfirmDialog';
import { portalAdminGet, portalAdminPatch, portalAdminPost } from './patientPortalAdminApi';

const VIEW_CONFIG = {
  dashboard: {
    title: 'Quản trị cổng bệnh nhân',
    subtitle: 'Bảng điều khiển tài khoản bệnh nhân, người thân, hồ sơ tự gửi, tài liệu, bảo hiểm và audit.',
    icon: HeartPulse,
    endpoint: '/dashboard',
  },
  accounts: {
    title: 'Tài khoản bệnh nhân',
    subtitle: 'Bảo mật tài khoản, trạng thái đăng nhập, xác thực email/số điện thoại, Google OAuth và buộc đăng xuất.',
    icon: UserRound,
    endpoint: '/accounts',
    summaryEndpoint: '/accounts/summary',
    detail: (row) => `/accounts/${getRowId(row)}`,
  },
  relatives: {
    title: 'Người thân bệnh nhân',
    subtitle: 'Danh bạ người thân, xác minh quan hệ, rủi ro trùng lặp và trạng thái truy cập.',
    icon: UsersRound,
    endpoint: '/relatives',
    summaryEndpoint: '/relatives/summary',
    detail: (row) => `/relatives/${getRowId(row)}`,
  },
  authorizations: {
    title: 'Ủy quyền người thân',
    subtitle: 'Quyền truy cập người thân, ma trận phạm vi, phê duyệt/từ chối/thu hồi và quyền hiệu lực.',
    icon: ShieldCheck,
    endpoint: '/authorizations',
    summaryEndpoint: '/authorizations/summary',
    detail: (row) => `/authorizations/${getRowId(row)}`,
  },
  profilePolicies: {
    title: 'Hồ sơ bệnh nhân tự cập nhật',
    subtitle: 'Chính sách trường dữ liệu: trường được sửa, cần duyệt, cần giấy tờ, SLA và mức rủi ro.',
    icon: FileText,
    endpoint: '/profile-field-policies',
    detail: (row) => `/profile-field-policies/${row.field_name}`,
  },
  profileChanges: {
    title: 'Yêu cầu cập nhật hồ sơ',
    subtitle: 'Hàng đợi duyệt thay đổi thông tin, so sánh trước/sau, phân tích rủi ro và quyết định rà soát.',
    icon: ClipboardCheck,
    endpoint: '/profile-change-requests',
    summaryEndpoint: '/profile-change-requests/summary',
    detail: (row) => `/profile-change-requests/${getRowId(row)}`,
  },
  documents: {
    title: 'Tài liệu bệnh nhân tải lên',
    subtitle: 'Hàng đợi duyệt tài liệu, trạng thái quét virus, kiểm soát phát hành, metadata và nhật ký truy cập.',
    icon: UploadCloud,
    endpoint: '/documents',
    summaryEndpoint: '/documents/summary',
    detail: (row) => `/documents/${getRowId(row)}`,
  },
  exports: {
    title: 'Yêu cầu xuất hồ sơ',
    subtitle: 'Yêu cầu xuất ZIP, trạng thái worker, thử lại, hết hạn, thu hồi tải xuống và nhật ký xử lý.',
    icon: Download,
    endpoint: '/document-exports',
    summaryEndpoint: '/document-exports/summary',
    detail: (row) => `/document-exports/${getRowId(row)}`,
  },
  insurance: {
    title: 'Bảo hiểm bệnh nhân gửi',
    subtitle: 'Hàng đợi xác minh bảo hiểm, ảnh thẻ, chính sách chống trùng, xác minh/từ chối và yêu cầu bổ sung.',
    icon: ShieldAlert,
    endpoint: '/insurance-submissions',
    summaryEndpoint: '/insurance-submissions/summary',
    detail: (row) => `/insurance-submissions/${getRowId(row)}`,
  },
  featureFlags: {
    title: 'Cờ tính năng cổng bệnh nhân',
    subtitle: 'Rollout, phụ thuộc, mức rủi ro và rollback cho các tính năng tự phục vụ.',
    icon: Flag,
    endpoint: '/feature-flags',
    detail: (row) => `/feature-flags/${row.key}`,
  },
  audit: {
    title: 'Audit cổng bệnh nhân',
    subtitle: 'Luồng audit đăng nhập, đổi hồ sơ, tài liệu, bảo hiểm, ủy quyền người thân và truy cập nhạy cảm.',
    icon: FileClock,
    endpoint: '/audit',
    summaryEndpoint: '/audit/summary',
    detail: (row) => `/audit/${getRowId(row)}`,
  },
};

const NAV_ITEMS = [
  ['dashboard', 'Tổng quan', HeartPulse],
  ['accounts', 'Tài khoản', UserRound],
  ['relatives', 'Người thân', UsersRound],
  ['authorizations', 'Ủy quyền', ShieldCheck],
  ['profilePolicies', 'Chính sách hồ sơ', FileText],
  ['profileChanges', 'Cập nhật hồ sơ', ClipboardCheck],
  ['documents', 'Tài liệu tải lên', UploadCloud],
  ['exports', 'Xuất hồ sơ', Download],
  ['insurance', 'Bảo hiểm', ShieldAlert],
  ['featureFlags', 'Cờ tính năng', Flag],
  ['audit', 'Audit', FileClock],
];

const VALUE_LABELS = {
  active: 'Đang hoạt động',
  healthy: 'Ổn định',
  verified: 'Đã xác minh',
  accepted: 'Đã chấp nhận',
  approved: 'Đã duyệt',
  ready: 'Sẵn sàng',
  success: 'Thành công',
  clean: 'Sạch',
  pending: 'Chờ xử lý',
  pending_review: 'Chờ duyệt',
  pending_verification: 'Chờ xác minh',
  submitted: 'Đã gửi',
  processing: 'Đang xử lý',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
  locked: 'Bị khóa',
  disabled: 'Đã vô hiệu hóa',
  blocked: 'Bị chặn',
  rejected: 'Đã từ chối',
  revoked: 'Đã thu hồi',
  failed: 'Lỗi',
  infected: 'Nhiễm mã độc',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  inactive: 'Ngưng hoạt động',
  skipped: 'Bỏ qua',
  enabled: 'Đang bật',
  draft: 'Bản nháp',
  denied: 'Bị từ chối',
  patient: 'Bệnh nhân',
  staff: 'Nhân sự',
  patient_relative: 'Người thân',
  google: 'Google',
  local: 'Nội bộ',
  live: 'Đang hoạt động',
};

const STATUS_TONE = {
  active: 'success',
  healthy: 'success',
  verified: 'success',
  accepted: 'success',
  approved: 'success',
  ready: 'success',
  success: 'success',
  clean: 'success',
  pending: 'warning',
  pending_review: 'warning',
  submitted: 'warning',
  processing: 'warning',
  pending_verification: 'warning',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
  locked: 'danger',
  disabled: 'muted',
  blocked: 'danger',
  rejected: 'danger',
  revoked: 'danger',
  failed: 'danger',
  infected: 'danger',
  expired: 'muted',
  cancelled: 'muted',
  inactive: 'muted',
  skipped: 'muted',
};

const COLUMNS = {
  accounts: [
    ['patient.full_name', 'Bệnh nhân'],
    ['patient.patient_code', 'MRN'],
    ['username', 'Username'],
    ['email', 'Email'],
    ['auth_provider', 'Xác thực'],
    ['status', 'Trạng thái', 'status'],
    ['failed_login_attempts', 'Lỗi đăng nhập'],
    ['active_session_count', 'Phiên'],
    ['last_login_at', 'Đăng nhập gần nhất'],
    ['risk_level', 'Rủi ro', 'status'],
  ],
  relatives: [
    ['full_name', 'Người thân'],
    ['relationship', 'Quan hệ'],
    ['patient.full_name', 'Bệnh nhân'],
    ['phone', 'Số điện thoại'],
    ['relationship_verified', 'Đã xác minh'],
    ['authorization_active_count', 'Ủy quyền hiệu lực'],
    ['status', 'Trạng thái', 'status'],
    ['created_at', 'Ngày tạo'],
  ],
  authorizations: [
    ['patient.full_name', 'Bệnh nhân'],
    ['relative.full_name', 'Người thân'],
    ['relative.relationship', 'Quan hệ'],
    ['authorization_type', 'Loại'],
    ['permissions', 'Phạm vi'],
    ['valid_to', 'Hiệu lực đến'],
    ['status', 'Trạng thái', 'status'],
    ['is_expiring_soon', 'Sắp hết hạn'],
  ],
  profilePolicies: [
    ['field_name', 'Trường'],
    ['group', 'Nhóm'],
    ['patient_editable', 'Được sửa'],
    ['requires_review', 'Cần duyệt'],
    ['requires_attachment', 'Cần giấy tờ'],
    ['sensitive', 'Nhạy cảm'],
    ['sla_hours', 'SLA h'],
    ['risk_level', 'Rủi ro', 'status'],
    ['enabled', 'Đang bật'],
  ],
  profileChanges: [
    ['patient.full_name', 'Bệnh nhân'],
    ['change_type', 'Loại thay đổi'],
    ['changed_fields', 'Trường đổi'],
    ['requested_by_actor.actor_type', 'Người yêu cầu'],
    ['risk_level', 'Rủi ro', 'status'],
    ['status', 'Trạng thái', 'status'],
    ['created_at', 'Ngày tạo'],
    ['reviewed_at', 'Ngày duyệt'],
  ],
  documents: [
    ['original_name', 'Tệp'],
    ['patient.full_name', 'Bệnh nhân'],
    ['category', 'Danh mục'],
    ['review_status', 'Duyệt', 'status'],
    ['scan_status', 'Quét', 'status'],
    ['visibility', 'Hiển thị'],
    ['released_to_patient', 'Đã phát hành'],
    ['file_size', 'Dung lượng'],
    ['created_at', 'Tải lên'],
  ],
  exports: [
    ['request_code', 'Yêu cầu'],
    ['patient.full_name', 'Bệnh nhân'],
    ['requested_by_actor_type', 'Actor'],
    ['export_type', 'Loại'],
    ['attachment_count', 'Tệp'],
    ['status', 'Trạng thái', 'status'],
    ['created_at', 'Ngày tạo'],
    ['expires_at', 'Hết hạn'],
  ],
  insurance: [
    ['patient.full_name', 'Bệnh nhân'],
    ['payer_name', 'Đơn vị bảo hiểm'],
    ['policy_no_masked', 'Số thẻ'],
    ['coverage_percent', 'Mức hưởng %'],
    ['valid_to', 'Hiệu lực đến'],
    ['verification_status', 'Xác minh', 'status'],
    ['missing_front_card', 'Thiếu mặt trước'],
    ['missing_back_card', 'Thiếu mặt sau'],
    ['submitted_at', 'Ngày gửi'],
  ],
  featureFlags: [
    ['key', 'Mã cờ'],
    ['name', 'Tên'],
    ['group', 'Nhóm'],
    ['enabled', 'Đang bật', 'status'],
    ['rollout_percentage', 'Rollout %'],
    ['risk_level', 'Rủi ro', 'status'],
    ['updated_at', 'Cập nhật'],
  ],
  audit: [
    ['created_at', 'Thời gian'],
    ['actor_type', 'Actor'],
    ['action', 'Hành động'],
    ['target_type', 'Đối tượng'],
    ['status', 'Trạng thái', 'status'],
    ['severity', 'Mức độ', 'status'],
    ['ip_address', 'IP'],
    ['message', 'Thông báo'],
  ],
};

function getNested(row, path) {
  return String(path || '').split('.').reduce((value, key) => (value ? value[key] : undefined), row);
}

function getRowId(row = {}) {
  return row.id || row._id || row.key || row.request_code || row.field_name;
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('vi-VN') : '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString('vi-VN');
  if (value instanceof Date) return value.toLocaleString('vi-VN');
  if (typeof value === 'object') return value.full_name || value.patient_code || value.name || value.label || JSON.stringify(value);
  return VALUE_LABELS[String(value).toLowerCase()] || String(value).replace(/_/g, ' ');
}

function StatusBadge({ value }) {
  const text = value === true ? 'enabled' : value === false ? 'disabled' : value || 'unknown';
  const normalized = String(text).toLowerCase();
  const tone = STATUS_TONE[text] || STATUS_TONE[normalized] || 'neutral';
  return <span className={`ppa-badge ppa-badge--${tone}`}>{formatValue(text)}</span>;
}

function KpiCard({ label, value, tone = 'neutral', icon: Icon }) {
  return (
    <article className={`ppa-kpi ppa-kpi--${tone}`}>
      <div className="ppa-kpi__icon">{Icon ? <Icon size={18} strokeWidth={2.3} /> : null}</div>
      <span>{label}</span>
      <strong>{formatValue(value)}</strong>
    </article>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button type="button" className="ppa-icon-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
      <Icon size={16} strokeWidth={2.25} />
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, variant = 'default', disabled }) {
  return (
    <button type="button" className={`ppa-action ppa-action--${variant}`} onClick={onClick} disabled={disabled}>
      {Icon ? <Icon size={16} strokeWidth={2.25} /> : null}
      <span>{label}</span>
    </button>
  );
}

function buildKpis(view, data, summary) {
  if (view === 'dashboard') {
    const kpis = data?.kpis || {};
    return [
      ['Tài khoản active', kpis.active_accounts, 'success', UserRound],
      ['Tài khoản bị khóa', kpis.locked_accounts, kpis.locked_accounts ? 'danger' : 'neutral', LockKeyhole],
      ['Tài khoản rủi ro', kpis.risk_accounts, kpis.risk_accounts ? 'danger' : 'neutral', ShieldAlert],
      ['Hồ sơ chờ duyệt', kpis.profile_change_pending, 'warning', ClipboardCheck],
      ['Tài liệu chờ duyệt', kpis.document_review_pending, 'warning', UploadCloud],
      ['Bảo hiểm chờ xác minh', kpis.insurance_pending_review, 'warning', ShieldCheck],
      ['Ủy quyền chờ duyệt', kpis.authorization_pending, 'warning', UsersRound],
      ['Xuất hồ sơ lỗi', kpis.export_failed, kpis.export_failed ? 'danger' : 'neutral', AlertTriangle],
      ['Truy cập nhạy cảm', kpis.sensitive_access_today, kpis.sensitive_access_today ? 'danger' : 'neutral', FileClock],
    ];
  }

  const source = summary || {};
  return Object.entries(source)
    .filter(([, value]) => typeof value !== 'object')
    .slice(0, 10)
    .map(([key, value]) => [
      key.replaceAll('_', ' '),
      value,
      String(key).includes('failed') || String(key).includes('locked') || String(key).includes('risk') ? 'danger' : 'neutral',
      Activity,
    ]);
}

function PatientCell({ row }) {
  const patient = row.patient || {};
  return (
    <div className="ppa-patient-cell">
      <strong>{patient.full_name || row.full_name || '-'}</strong>
      <span>{patient.patient_code || row.patient_code || row.email || row.phone || '-'}</span>
    </div>
  );
}

function DataTable({ view, items, onSelect, onAction }) {
  const columns = COLUMNS[view] || COLUMNS.accounts;
  return (
    <div className="ppa-table-wrap">
      <table className="ppa-table">
        <thead>
          <tr>
            {columns.map(([, label]) => <th key={label}>{label}</th>)}
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="ppa-empty">Chưa có dữ liệu phù hợp bộ lọc.</td>
            </tr>
          ) : items.map((row) => (
            <tr key={getRowId(row)}>
              {columns.map(([path, label, type]) => {
                const value = getNested(row, path);
                return (
                  <td key={`${getRowId(row)}-${label}`}>
                    {type === 'status' ? <StatusBadge value={value} /> : path.includes('patient.full_name') ? <PatientCell row={row} /> : formatValue(value)}
                  </td>
                );
              })}
              <td>
                <div className="ppa-row-actions">
                  <IconButton icon={Eye} label="Xem chi tiết" onClick={() => onSelect(row)} />
                  {row.id || row.key ? <IconButton icon={Copy} label="Copy ID" onClick={() => navigator.clipboard?.writeText(String(row.id || row.key))} /> : null}
                  {quickActions(view, row, onAction)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function quickActions(view, row, onAction) {
  if (view === 'accounts') {
    return (
      <>
        <IconButton icon={row.status === 'locked' ? ShieldCheck : LockKeyhole} label={row.status === 'locked' ? 'Mở khóa' : 'Khóa'} onClick={() => onAction(row.status === 'locked' ? 'unlock' : 'lock', row)} />
        <IconButton icon={KeyRound} label="Đặt lại mật khẩu" onClick={() => onAction('resetPassword', row)} />
      </>
    );
  }
  if (view === 'relatives') {
    return <IconButton icon={row.relationship_verified ? ShieldX : ShieldCheck} label={row.relationship_verified ? 'Hủy xác minh' : 'Xác minh'} onClick={() => onAction(row.relationship_verified ? 'unverifyRelative' : 'verifyRelative', row)} />;
  }
  if (view === 'authorizations') {
    return (
      <>
        {row.status === 'pending' ? <IconButton icon={CheckCircle2} label="Duyệt" onClick={() => onAction('approveAuthorization', row)} /> : null}
        <IconButton icon={ShieldX} label="Thu hồi" onClick={() => onAction('revokeAuthorization', row)} />
      </>
    );
  }
  if (view === 'profileChanges') {
    return (
      <>
        {row.status === 'pending' ? <IconButton icon={CheckCircle2} label="Duyệt" onClick={() => onAction('approveProfileChange', row)} /> : null}
        {row.status === 'pending' ? <IconButton icon={ShieldX} label="Từ chối" onClick={() => onAction('rejectProfileChange', row)} /> : null}
      </>
    );
  }
  if (view === 'documents') {
    return (
      <>
        <IconButton icon={ScanLine} label="Quét lại" onClick={() => onAction('rescanDocument', row)} />
        {row.review_status === 'pending' ? <IconButton icon={CheckCircle2} label="Duyệt" onClick={() => onAction('approveDocument', row)} /> : null}
      </>
    );
  }
  if (view === 'exports') return <IconButton icon={RefreshCw} label="Thử xuất lại" onClick={() => onAction('retryExport', row)} />;
  if (view === 'insurance') return <IconButton icon={ShieldCheck} label="Xác minh" onClick={() => onAction('verifyInsurance', row)} />;
  if (view === 'featureFlags') return <IconButton icon={row.enabled ? ShieldX : CheckCircle2} label={row.enabled ? 'Tắt' : 'Bật'} onClick={() => onAction('toggleFlag', row)} />;
  return null;
}

function DetailDrawer({ detail, row, view, loading, onClose, onAction }) {
  if (!row) return null;
  const payload = detail || row;
  return (
    <aside className="ppa-drawer" aria-label="Chi tiết quản trị cổng bệnh nhân">
      <div className="ppa-drawer__head">
        <div>
          <span>Chi tiết bản ghi</span>
          <strong>{formatValue(row.patient?.full_name || row.full_name || row.key || row.request_code || row.action || getRowId(row))}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng"><X size={18} /></button>
      </div>
      <div className="ppa-drawer__actions">
        {drawerActions(view, row, onAction)}
      </div>
      {loading ? <p className="ppa-muted">Đang tải chi tiết...</p> : (
        <div className="ppa-drawer__body">
          <section>
            <h3>Tổng quan</h3>
            <dl className="ppa-detail-grid">
              {Object.entries(payload).filter(([, value]) => typeof value !== 'object' || value === null).slice(0, 18).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll('_', ' ')}</dt>
                  <dd>{key.includes('status') || key.includes('risk') ? <StatusBadge value={value} /> : formatValue(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>JSON gốc</h3>
            <pre className="ppa-json">{JSON.stringify(payload, null, 2)}</pre>
          </section>
        </div>
      )}
    </aside>
  );
}

function drawerActions(view, row, onAction) {
  const actions = [];
  if (view === 'accounts') actions.push(['forceLogout', 'Buộc đăng xuất', LockKeyhole, 'danger'], ['resetPassword', 'Đặt lại mật khẩu', KeyRound, 'warning']);
  if (view === 'documents') actions.push(['rescanDocument', 'Quét lại', ScanLine, 'warning'], ['approveDocument', 'Duyệt', CheckCircle2, 'success'], ['rejectDocument', 'Từ chối', ShieldX, 'danger']);
  if (view === 'profileChanges') actions.push(['approveProfileChange', 'Duyệt', CheckCircle2, 'success'], ['rejectProfileChange', 'Từ chối', ShieldX, 'danger']);
  if (view === 'insurance') actions.push(['verifyInsurance', 'Xác minh', ShieldCheck, 'success'], ['rejectInsurance', 'Từ chối', ShieldX, 'danger']);
  if (view === 'exports') actions.push(['retryExport', 'Thử lại', RefreshCw, 'warning'], ['expireExport', 'Đánh dấu hết hạn', Clock3, 'danger']);
  if (view === 'featureFlags') actions.push(['toggleFlag', row.enabled ? 'Tắt' : 'Bật', row.enabled ? ShieldX : CheckCircle2, row.enabled ? 'danger' : 'success']);
  return actions.map(([action, label, Icon, variant]) => (
    <ActionButton key={action} icon={Icon} label={label} variant={variant} onClick={() => onAction(action, row)} />
  ));
}

function portalTargetLabel(row = {}) {
  return row.patient?.full_name
    || row.full_name
    || row.name
    || row.username
    || row.email
    || row.original_name
    || row.request_code
    || row.key
    || row.policy_no_masked
    || getRowId(row)
    || 'Bản ghi đã chọn';
}

function portalActionCopy(action, row = {}) {
  const flagState = row.enabled ? 'tắt' : 'bật';
  const copies = {
    lock: ['Khóa tài khoản bệnh nhân?', 'Tài khoản sẽ không thể tiếp tục đăng nhập cho đến khi được mở khóa.', 'Xác nhận khóa', 'danger', true],
    unlock: ['Mở khóa tài khoản?', 'Tài khoản sẽ được phép đăng nhập trở lại nếu thỏa chính sách bảo mật.', 'Mở khóa', 'warning', false],
    resetPassword: ['Đặt lại mật khẩu?', 'Hệ thống sẽ tạo yêu cầu đặt lại mật khẩu cho tài khoản này.', 'Đặt lại mật khẩu', 'warning', true],
    forceLogout: ['Buộc đăng xuất tài khoản?', 'Tất cả phiên hiện tại của tài khoản sẽ bị thu hồi.', 'Buộc đăng xuất', 'danger', true],
    verifyRelative: ['Xác minh quan hệ người thân?', 'Người thân này sẽ được đánh dấu đã xác minh quan hệ.', 'Xác minh', 'success', false],
    unverifyRelative: ['Hủy xác minh quan hệ?', 'Trạng thái xác minh quan hệ của người thân sẽ bị gỡ bỏ.', 'Hủy xác minh', 'warning', true],
    approveAuthorization: ['Duyệt ủy quyền người thân?', 'Người thân sẽ có quyền truy cập theo phạm vi đã khai báo.', 'Duyệt ủy quyền', 'success', false],
    revokeAuthorization: ['Thu hồi ủy quyền người thân?', 'Quyền truy cập của người thân sẽ bị thu hồi và có thể ảnh hưởng phiên đang hoạt động.', 'Thu hồi ủy quyền', 'danger', true],
    approveProfileChange: ['Duyệt yêu cầu cập nhật hồ sơ?', 'Thông tin bệnh nhân sẽ được chấp nhận theo dữ liệu đã gửi.', 'Duyệt thay đổi', 'success', false],
    rejectProfileChange: ['Từ chối yêu cầu cập nhật hồ sơ?', 'Yêu cầu sẽ bị đóng và cần ghi rõ lý do cho audit.', 'Từ chối', 'danger', true],
    approveDocument: ['Duyệt tài liệu tải lên?', 'Tài liệu sẽ được chuyển sang trạng thái đã chấp nhận.', 'Duyệt tài liệu', 'success', false],
    rejectDocument: ['Từ chối tài liệu?', 'Tài liệu sẽ không được phát hành cho bệnh nhân.', 'Từ chối tài liệu', 'danger', true],
    rescanDocument: ['Quét lại tài liệu?', 'Hệ thống sẽ đưa tài liệu vào hàng đợi quét lại.', 'Quét lại', 'warning', false],
    retryExport: ['Thử xuất hồ sơ lại?', 'Worker sẽ chạy lại yêu cầu xuất hồ sơ đã chọn.', 'Thử lại', 'warning', true],
    expireExport: ['Đánh dấu yêu cầu xuất là hết hạn?', 'Liên kết tải xuống hiện có sẽ không còn dùng được.', 'Đánh dấu hết hạn', 'danger', true],
    verifyInsurance: ['Xác minh bảo hiểm?', 'Hồ sơ bảo hiểm sẽ được đánh dấu đã xác minh.', 'Xác minh', 'success', false],
    rejectInsurance: ['Từ chối hồ sơ bảo hiểm?', 'Hồ sơ bảo hiểm sẽ bị từ chối và cần lý do rõ ràng.', 'Từ chối', 'danger', true],
    toggleFlag: [`${row.enabled ? 'Tắt' : 'Bật'} cờ tính năng?`, `Cờ tính năng sẽ được ${flagState} cho cổng bệnh nhân.`, row.enabled ? 'Tắt cờ' : 'Bật cờ', row.enabled ? 'danger' : 'success', true],
  };
  const copy = copies[action];
  if (!copy) return null;
  const [title, description, confirmLabel, tone, reasonRequired] = copy;
  return {
    title,
    description,
    confirmLabel,
    tone,
    reasonRequired,
    reasonLabel: 'Lý do thao tác',
    details: [
      { label: 'Đối tượng', value: portalTargetLabel(row) },
      { label: 'ID', value: getRowId(row) },
      { label: 'Trạng thái hiện tại', value: formatValue(row.status || row.review_status || row.verification_status || row.enabled) },
    ],
  };
}

function DashboardView({ data }) {
  const queue = data?.work_queue || [];
  const health = data?.portal_health?.components || [];
  const feed = data?.realtime_activity || [];
  return (
    <div className="ppa-dashboard-grid">
      <section className="ppa-panel">
        <div className="ppa-panel__head">
          <strong>Việc cần xử lý</strong>
          <span>Hàng đợi hợp nhất theo SLA</span>
        </div>
        <div className="ppa-work-queue">
          {queue.map((item) => (
            <Link to={item.route} key={item.type} className="ppa-work-item">
              <div>
                <strong>{item.label}</strong>
                <span>{item.sla_overdue || 0} quá SLA</span>
              </div>
              <b>{formatValue(item.count)}</b>
            </Link>
          ))}
        </div>
      </section>
      <section className="ppa-panel">
        <div className="ppa-panel__head">
          <strong>Sức khỏe cổng bệnh nhân</strong>
          <span>API, scan, notification, worker và audit</span>
        </div>
        <div className="ppa-health-list">
          {health.map((item) => (
            <div className="ppa-health-row" key={item.code}>
              <StatusBadge value={item.status} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.signal}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="ppa-panel ppa-panel--wide">
        <div className="ppa-panel__head">
          <strong>Hoạt động thời gian thực</strong>
          <span>Luồng audit mới nhất liên quan cổng bệnh nhân</span>
        </div>
        <div className="ppa-activity-feed">
          {feed.length === 0 ? <p className="ppa-muted">Chưa có hoạt động mới.</p> : feed.map((item) => (
            <div key={item.id || item._id} className="ppa-activity-item">
              <span>{new Date(item.created_at).toLocaleString('vi-VN')}</span>
              <strong>{item.action}</strong>
              <p>{item.message || item.target_type || '-'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


function normalizePortalItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function EntityRunway({ view, config, rows, summary, data }) {
  if (view === 'dashboard') return null;
  const endpoint = config.endpoint;
  const stages = workflowStages(view);
  return (
    <section className="ppa-runway">
      <article className="ppa-runway__main">
        <span className="ppa-eyebrow">Production workflow</span>
        <h2>{config.title}</h2>
        <p>{config.subtitle}</p>
        <div className="ppa-stage-row">
          {stages.map((stage, index) => (
            <div className="ppa-stage" key={stage}>
              <b>{index + 1}</b>
              <span>{stage}</span>
            </div>
          ))}
        </div>
      </article>
      <article className="ppa-runway__side">
        <strong>Backend contract</strong>
        <span>GET /api/admin/patient-portal{endpoint}</span>
        <span>Records: {formatValue(rows.length)}</span>
        <span>Summary: {summary ? 'Đã kết nối' : 'Không có endpoint summary'}</span>
        <span>Realtime: {formatValue(data?.portal_health?.status || 'live')}</span>
      </article>
    </section>
  );
}

function workflowStages(view) {
  const map = {
    accounts: ['Định danh', 'Xác thực', 'Phiên đăng nhập', 'Khóa / mở khóa'],
    relatives: ['Tạo người thân', 'Xác minh quan hệ', 'Liên kết bệnh nhân', 'Theo dõi rủi ro'],
    authorizations: ['Yêu cầu', 'Duyệt phạm vi', 'Hiệu lực', 'Thu hồi'],
    profilePolicies: ['Chọn trường', 'Đặt policy', 'SLA duyệt', 'Audit thay đổi'],
    profileChanges: ['Bệnh nhân gửi', 'So sánh dữ liệu', 'Duyệt / từ chối', 'Cập nhật hồ sơ'],
    documents: ['Upload', 'Virus scan', 'Duyệt tài liệu', 'Release / archive'],
    exports: ['Tạo yêu cầu', 'Worker ZIP', 'Link tải', 'Hết hạn / thu hồi'],
    insurance: ['Gửi bảo hiểm', 'Kiểm tra ảnh thẻ', 'Xác minh', 'Áp dụng billing'],
    featureFlags: ['Cấu hình', 'Rollout', 'Giám sát', 'Rollback'],
    audit: ['Ghi log', 'Tra cứu', 'Phân loại', 'Export bằng chứng'],
  };
  return map[view] || ['Tải dữ liệu', 'Kiểm tra', 'Thao tác', 'Audit'];
}

export function PatientPortalAdminPage({ view = 'dashboard' }) {
  const config = VIEW_CONFIG[view] || VIEW_CONFIG.dashboard;
  const Icon = config.icon;
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedStatus, setAppliedStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildListParams(view, { search: appliedSearch, status: appliedStatus });
      const [main, nextSummary] = await Promise.all([
        portalAdminGet(config.endpoint, params),
        config.summaryEndpoint ? portalAdminGet(config.summaryEndpoint) : Promise.resolve(null),
      ]);
      setData(main);
      setSummary(nextSummary);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Không thể tải quản trị cổng bệnh nhân.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, appliedStatus, config.endpoint, config.summaryEndpoint, view]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function applyFilters() {
    setAppliedSearch(search);
    setAppliedStatus(status);
  }

  async function selectRow(row) {
    setSelected(row);
    setDetail(row);
    if (!config.detail) return;
    setDetailLoading(true);
    try {
      setDetail(await portalAdminGet(config.detail(row)));
    } catch (err) {
      setDetail({ ...row, detail_error: err.message });
    } finally {
      setDetailLoading(false);
    }
  }

  function handleAction(action, row) {
    const copy = portalActionCopy(action, row);
    if (!copy) {
      executeAction(action, row).catch((err) => setError(err.message || 'Thao tác không thành công.'));
      return;
    }
    setConfirmAction({ action, row, ...copy });
  }

  async function executeAction(action, row, reason = '') {
    const id = getRowId(row);
    const key = row.key || id;
    const body = reason ? { reason } : {};
    const calls = {
      lock: () => portalAdminPost(`/accounts/${id}/lock`, body),
      unlock: () => portalAdminPost(`/accounts/${id}/unlock`, body),
      resetPassword: () => portalAdminPost(`/accounts/${id}/reset-password`, body),
      forceLogout: () => portalAdminPost(`/accounts/${id}/force-logout`, body),
      verifyRelative: () => portalAdminPost(`/relatives/${id}/verify-relationship`, body),
      unverifyRelative: () => portalAdminPost(`/relatives/${id}/unverify-relationship`, body),
      approveAuthorization: () => portalAdminPost(`/authorizations/${id}/approve`, body),
      revokeAuthorization: () => portalAdminPost(`/authorizations/${id}/revoke`, body),
      approveProfileChange: () => portalAdminPost(`/profile-change-requests/${id}/approve`, body),
      rejectProfileChange: () => portalAdminPost(`/profile-change-requests/${id}/reject`, body),
      approveDocument: () => portalAdminPost(`/documents/${id}/approve`, body),
      rejectDocument: () => portalAdminPost(`/documents/${id}/reject`, body),
      rescanDocument: () => portalAdminPost(`/documents/${id}/rescan`, body),
      retryExport: () => portalAdminPost(`/document-exports/${id}/retry`, body),
      expireExport: () => portalAdminPost(`/document-exports/${id}/expire`, body),
      verifyInsurance: () => portalAdminPost(`/insurance-submissions/${id}/verify`, body),
      rejectInsurance: () => portalAdminPost(`/insurance-submissions/${id}/reject`, body),
      toggleFlag: () => portalAdminPatch(`/feature-flags/${key}`, { enabled: !row.enabled }),
    };
    if (!calls[action]) return;
    setActionSubmitting(true);
    try {
      await calls[action]();
      setConfirmAction(null);
      await loadData();
      if (selected) await selectRow(selected);
    } catch (err) {
      setError(err.message || 'Thao tác không thành công.');
    } finally {
      setActionSubmitting(false);
    }
  }

  const kpis = useMemo(() => buildKpis(view, data, summary), [view, data, summary]);
  const items = normalizePortalItems(data);

  return (
    <div className="ppa-shell">
      <header className="ppa-hero">
        <div className="ppa-hero__title">
          <span className="ppa-hero__icon"><Icon size={24} strokeWidth={2.35} /></span>
          <div>
            <p>Quản trị hệ thống / Cổng bệnh nhân</p>
            <h1>{config.title}</h1>
            <span>{config.subtitle}</span>
          </div>
        </div>
        <div className="ppa-hero__actions">
          <span className="ppa-env-badge">Bảng điều khiển production</span>
          <span className="ppa-health-badge"><Activity size={14} /> {formatValue(data?.portal_health?.status || data?.status || 'live')}</span>
          <ActionButton icon={RefreshCw} label="Làm mới" onClick={loadData} disabled={loading} />
        </div>
      </header>

      <nav className="ppa-nav" aria-label="Các màn hình quản trị cổng bệnh nhân">
        {NAV_ITEMS.map(([key, label, NavIcon]) => (
          <Link key={key} to={key === 'dashboard' ? '/admin/patient-portal' : `/admin/patient-portal/${routeForView(key)}`} className={key === view ? 'is-active' : ''}>
            <NavIcon size={15} strokeWidth={2.25} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <section className="ppa-kpi-strip">
        {kpis.map(([label, value, tone, KpiIcon]) => <KpiCard key={label} label={label} value={value} tone={tone} icon={KpiIcon} />)}
      </section>

      <EntityRunway view={view} config={config} rows={items} summary={summary} data={data} />

      {view !== 'dashboard' ? (
        <section className="ppa-filter-bar">
          <div className="ppa-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyFilters();
              }}
              placeholder="Tìm tên, MRN, email, ID, action, file, policy..."
            />
          </div>
          <label>
            <Filter size={15} />
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả trạng thái</option>
              {statusOptions(view).map((option) => <option key={option} value={option}>{formatValue(option)}</option>)}
            </select>
          </label>
          <ActionButton icon={Search} label="Áp dụng" onClick={applyFilters} disabled={loading} />
          <span className="ppa-muted">Cập nhật gần nhất: {lastUpdated ? lastUpdated.toLocaleTimeString('vi-VN') : '-'}</span>
        </section>
      ) : null}

      {error ? <div className="ppa-alert"><AlertTriangle size={16} /> {error}</div> : null}

      {loading ? (
        <div className="ppa-loading"><RefreshCw size={18} /> Đang tải quản trị cổng bệnh nhân...</div>
      ) : view === 'dashboard' ? (
        <DashboardView data={data} />
      ) : (
        <DataTable view={view} items={items} onSelect={selectRow} onAction={handleAction} />
      )}

      <DetailDrawer detail={detail} row={selected} view={view} loading={detailLoading} onClose={() => setSelected(null)} onAction={handleAction} />
      <AdminActionConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title}
        description={confirmAction?.description}
        tone={confirmAction?.tone}
        confirmLabel={confirmAction?.confirmLabel}
        details={confirmAction?.details}
        reasonRequired={confirmAction?.reasonRequired}
        reasonLabel={confirmAction?.reasonLabel}
        submitting={actionSubmitting}
        onCancel={() => setConfirmAction(null)}
        onConfirm={(reason) => executeAction(confirmAction.action, confirmAction.row, reason)}
      />
    </div>
  );
}

function routeForView(view) {
  const routes = {
    accounts: 'accounts',
    relatives: 'relatives',
    authorizations: 'authorizations',
    profilePolicies: 'profile-field-policies',
    profileChanges: 'profile-change-requests',
    documents: 'documents',
    exports: 'document-exports',
    insurance: 'insurance-submissions',
    featureFlags: 'feature-flags',
    audit: 'audit',
  };
  return routes[view] || '';
}

function buildListParams(view, state) {
  if (view === 'dashboard') return {};
  const params = { search: state.search };
  if (view === 'documents') params.review_status = state.status;
  else if (view === 'insurance') params.verification_status = state.status;
  else if (view !== 'featureFlags' && view !== 'profilePolicies') params.status = state.status;
  return params;
}

function statusOptions(view) {
  const map = {
    accounts: ['active', 'pending_verification', 'locked', 'disabled'],
    relatives: ['active', 'inactive', 'blocked'],
    authorizations: ['pending', 'active', 'expired', 'revoked', 'rejected'],
    profileChanges: ['pending', 'approved', 'rejected', 'cancelled'],
    documents: ['pending', 'accepted', 'rejected'],
    exports: ['pending', 'processing', 'ready', 'failed', 'expired'],
    insurance: ['draft', 'submitted', 'pending_review', 'verified', 'rejected', 'expired'],
    audit: ['success', 'failed', 'denied'],
  };
  return map[view] || [];
}
