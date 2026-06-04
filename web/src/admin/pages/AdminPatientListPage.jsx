import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Filter,
  HeartPulse,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { getApiErrorMessage, patientAPI, unwrapData } from '../../utils/api';
import { formatCompactDate, formatDateTime, formatNumber, getInitials } from '../staff/staffUi';

const PAGE_SIZE = 15;

const EMPTY_FILTERS = {
  keyword: '',
  status: '',
  gender: '',
  has_account: '',
  sort_by: 'created_at',
  sort_order: 'desc',
};

const STATUS_LABELS = {
  active: 'Đang hoạt động',
  inactive: 'Ngưng hoạt động',
  archived: 'Đã lưu trữ',
  merged: 'Đã gộp hồ sơ',
  pending: 'Chờ xử lý',
};

const GENDER_LABELS = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
  unknown: 'Chưa rõ',
};

function filtersFromSearchParams(searchParams) {
  return {
    keyword: searchParams.get('keyword') || '',
    status: searchParams.get('status') || '',
    gender: searchParams.get('gender') || '',
    has_account: searchParams.get('has_account') || '',
    sort_by: searchParams.get('sort_by') || EMPTY_FILTERS.sort_by,
    sort_order: searchParams.get('sort_order') || EMPTY_FILTERS.sort_order,
  };
}

function pageFromSearchParams(searchParams) {
  return Math.max(Number(searchParams.get('page') || 1), 1);
}

function syncSearchParams(setSearchParams, filters, page) {
  const next = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== EMPTY_FILTERS[key]) next.set(key, value);
  });
  if (page > 1) next.set('page', String(page));
  setSearchParams(next);
}

function patientIdOf(patient = {}) {
  return patient.patient_id || patient.id || patient._id || patient.patient_code;
}

function patientStatusLabel(status) {
  return STATUS_LABELS[status] || status || 'Chưa rõ';
}

function patientStatusTone(status) {
  if (status === 'active') return 'active';
  if (status === 'archived' || status === 'merged' || status === 'inactive') return 'disabled';
  return 'pending';
}

function genderLabel(gender) {
  return GENDER_LABELS[gender] || gender || 'Chưa rõ';
}

function ageFromDob(value) {
  if (!value) return null;
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function buildPatientParams(filters, page) {
  return {
    page,
    limit: PAGE_SIZE,
    include_account: 'true',
    keyword: filters.keyword,
    status: filters.status,
    gender: filters.gender,
    has_account: filters.has_account,
    sort_by: filters.sort_by,
    sort_order: filters.sort_order,
  };
}

function MiniMetric({ icon: Icon, label, value, tone = 'blue', hint }) {
  return (
    <article className={`staff-command-metric staff-command-metric--${tone}`}>
      <span className="staff-command-metric__icon" aria-hidden="true">
        <Icon size={19} strokeWidth={2.25} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {hint ? <em>{hint}</em> : null}
      </div>
    </article>
  );
}

function PatientIdentity({ patient, onOpen }) {
  const age = ageFromDob(patient.date_of_birth);

  return (
    <button type="button" className="patient-admin-identity" onClick={() => onOpen(patient)}>
      <div className="admin-avatar">{getInitials(patient.full_name || patient.patient_code || 'BN')}</div>
      <div>
        <strong>{patient.full_name || 'Chưa có tên'}</strong>
        <small>{patient.patient_code || 'Chưa có mã bệnh nhân'}</small>
        <small>
          {formatCompactDate(patient.date_of_birth)}
          {age !== null ? ` · ${age} tuổi` : ''}
        </small>
      </div>
    </button>
  );
}

function ContactStack({ patient }) {
  return (
    <div className="patient-admin-contact">
      <span>
        <Phone size={14} strokeWidth={2.25} />
        {patient.phone || 'Chưa có SĐT'}
      </span>
      <span>
        <Mail size={14} strokeWidth={2.25} />
        {patient.email || 'Chưa có email'}
      </span>
    </div>
  );
}

function PatientInspector({ inspector, onClose }) {
  if (!inspector) return null;

  const detail = inspector.detail || {};
  const patient = detail.patient || inspector.patient || {};
  const summary = detail.summary || {};
  const identifiers = Array.isArray(detail.identifiers) ? detail.identifiers : [];
  const relatives = Array.isArray(detail.relatives) ? detail.relatives : [];
  const account = detail.account;

  return (
    <aside className="staff-inspector patient-admin-inspector" aria-label="Chi tiết bệnh nhân">
      <div className="staff-inspector__scrim" onClick={onClose} role="presentation" />
      <section className="staff-inspector__panel">
        <header className="staff-inspector__header">
          <div className="staff-inspector__identity">
            <div className="admin-avatar">{getInitials(patient.full_name || patient.patient_code || 'BN')}</div>
            <div>
              <small>Patient 360 Profile</small>
              <h2>{patient.full_name || 'Bệnh nhân chưa có tên'}</h2>
              <span>{patient.patient_code || patientIdOf(patient) || 'Chưa có mã hồ sơ'}</span>
            </div>
          </div>
          <button type="button" className="staff-icon-button" onClick={onClose} aria-label="Đóng">
            <X size={18} strokeWidth={2.3} />
          </button>
        </header>

        <div className="staff-inspector__badges">
          <span className={`staff-status-dot staff-status-dot--${patientStatusTone(patient.status)}`}>
            <span />
            {patientStatusLabel(patient.status)}
          </span>
          <span>{genderLabel(patient.gender)}</span>
          <span>{account ? 'Có tài khoản portal' : 'Chưa liên kết portal'}</span>
        </div>

        {inspector.loading ? (
          <div className="staff-inspector__loading">Đang tải hồ sơ bệnh nhân...</div>
        ) : (
          <div className="staff-inspector__body">
            {inspector.error ? <p className="form-message error">{inspector.error}</p> : null}

            <div className="staff-inspector-grid">
              {[
                ['Ngày sinh', formatCompactDate(patient.date_of_birth)],
                ['Giới tính', genderLabel(patient.gender)],
                ['Số điện thoại', patient.phone || 'Chưa có'],
                ['Email', patient.email || 'Chưa có'],
                ['Địa chỉ', patient.address || 'Chưa có'],
                ['Ngày tạo', formatDateTime(patient.created_at)],
                ['CCCD/CMND', patient.national_id || 'Không hiển thị'],
                ['BHYT', patient.insurance_number || 'Không hiển thị'],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>

            <div className="patient-admin-detail-grid">
              <div>
                <span>Dị ứng đang hoạt động</span>
                <strong>{formatNumber(summary.active_allergies_count)}</strong>
              </div>
              <div>
                <span>Vấn đề sức khỏe</span>
                <strong>{formatNumber(summary.active_problems_count)}</strong>
              </div>
              <div>
                <span>Lịch hẹn sắp tới</span>
                <strong>{formatNumber(summary.upcoming_appointments_count)}</strong>
              </div>
              <div>
                <span>Người thân</span>
                <strong>{formatNumber(relatives.length)}</strong>
              </div>
            </div>

            <div className="staff-inspector-stack">
              <h3>Định danh</h3>
              <div className="staff-inspector-list">
                {identifiers.length ? identifiers.map((identifier) => (
                  <span key={identifier.identifier_id || `${identifier.identifier_type}-${identifier.identifier_value}`}>
                    {identifier.identifier_type}: {identifier.identifier_value}
                  </span>
                )) : <span>Chưa có định danh bổ sung hoặc chưa đủ quyền đọc.</span>}
              </div>
            </div>
          </div>
        )}
      </section>
    </aside>
  );
}

export function AdminPatientListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [appliedFilters, setAppliedFilters] = useState(() => filtersFromSearchParams(searchParams));
  const [page, setPage] = useState(() => pageFromSearchParams(searchParams));
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inspector, setInspector] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadPatients() {
      setLoading(true);
      setError('');

      try {
        const payload = unwrapData(await patientAPI.list(buildPatientParams(appliedFilters, page)));
        if (!active) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setPatients(items);
        setPagination(payload?.pagination || { page, total_pages: 1, total: items.length });
      } catch (loadError) {
        if (!active) return;
        setError(getApiErrorMessage(loadError, 'Không thể tải danh sách bệnh nhân.'));
        setPatients([]);
        setPagination({ page, total_pages: 1, total: 0 });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPatients();
    return () => {
      active = false;
    };
  }, [appliedFilters, page]);

  const metrics = useMemo(() => {
    const activeCount = patients.filter((patient) => patient.status === 'active').length;
    const accountCount = patients.filter((patient) => patient.has_account).length;
    const missingContactCount = patients.filter((patient) => !patient.phone && !patient.email).length;

    return [
      { label: 'Tổng hồ sơ', value: formatNumber(pagination.total), icon: UsersRound, tone: 'blue', hint: 'theo bộ lọc' },
      { label: 'Trang hiện tại', value: formatNumber(patients.length), icon: FileText, tone: 'cyan', hint: `${PAGE_SIZE} / trang` },
      { label: 'Đang hoạt động', value: formatNumber(activeCount), icon: CheckCircle2, tone: 'green', hint: 'trên trang này' },
      { label: 'Có tài khoản', value: formatNumber(accountCount), icon: ShieldCheck, tone: 'violet', hint: 'portal liên kết' },
      { label: 'Thiếu liên hệ', value: formatNumber(missingContactCount), icon: AlertTriangle, tone: 'amber', hint: 'cần bổ sung' },
    ];
  }, [pagination.total, patients]);

  const totalPages = Math.max(pagination.total_pages || pagination.totalPages || 1, 1);

  function applyFilters(nextFilters = filters) {
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
    syncSearchParams(setSearchParams, nextFilters, 1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
    setSearchParams(new URLSearchParams());
  }

  function movePage(nextPage) {
    const resolvedPage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(resolvedPage);
    syncSearchParams(setSearchParams, appliedFilters, resolvedPage);
  }

  async function refreshPatients() {
    const payload = unwrapData(await patientAPI.list(buildPatientParams(appliedFilters, page)));
    const items = Array.isArray(payload?.items) ? payload.items : [];
    setPatients(items);
    setPagination(payload?.pagination || { page, total_pages: 1, total: items.length });
  }

  async function openInspector(patient) {
    const patientId = patientIdOf(patient);
    if (!patientId) return;
    setInspector({ patient, loading: true, detail: null, error: '' });

    try {
      const detail = unwrapData(await patientAPI.detail(patientId));
      setInspector({ patient, loading: false, detail, error: '' });
    } catch (detailError) {
      setInspector({
        patient,
        loading: false,
        detail: { patient },
        error: getApiErrorMessage(detailError, 'Không thể tải chi tiết bệnh nhân.'),
      });
    }
  }

  function exportCurrentPageCsv() {
    if (!patients.length) return;
    const headers = ['patient_code', 'full_name', 'date_of_birth', 'gender', 'phone', 'email', 'status', 'has_account'];
    const rows = patients.map((patient) => headers.map((key) => {
      const value = key === 'has_account' ? (patient.has_account ? 'true' : 'false') : patient[key];
      return `"${String(value ?? '').replaceAll('"', '""')}"`;
    }).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-patients-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="staff-command-hero">
        <div className="staff-command-hero__copy">
          <span>Patient Registry Control</span>
          <h1>Danh sách bệnh nhân</h1>
          <p>Tra cứu toàn bộ hồ sơ bệnh nhân theo quyền quản trị hệ thống, gồm thông tin định danh, liên hệ, trạng thái và liên kết tài khoản portal.</p>
        </div>

        <div className="staff-command-hero__actions">
          <button type="button" className="staff-button staff-button--ghost" onClick={refreshPatients} disabled={loading}>
            <RefreshCw size={16} strokeWidth={2.25} />
            <span>Làm mới</span>
          </button>
          <button type="button" className="staff-button staff-button--ghost" onClick={exportCurrentPageCsv} disabled={!patients.length}>
            <Download size={16} strokeWidth={2.25} />
            <span>Export</span>
          </button>
        </div>
      </section>

      <section className="staff-command-metrics patient-admin-metrics">
        {metrics.map((item) => <MiniMetric key={item.label} {...item} />)}
      </section>

      <section className="staff-command-filters patient-admin-filters">
        <label className="staff-command-search">
          <Search size={17} strokeWidth={2.2} />
          <input
            type="search"
            value={filters.keyword}
            onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilters();
            }}
            placeholder="Tìm tên, mã bệnh nhân, SĐT, email, CCCD, BHYT..."
          />
        </label>

        <div className="staff-command-filter-grid">
          <label>
            <HeartPulse size={15} strokeWidth={2.2} />
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
              <option value="archived">Đã lưu trữ</option>
              <option value="merged">Đã gộp hồ sơ</option>
            </select>
          </label>

          <label>
            <UserRound size={15} strokeWidth={2.2} />
            <select value={filters.gender} onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))}>
              <option value="">Tất cả giới tính</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
              <option value="unknown">Chưa rõ</option>
            </select>
          </label>

          <label>
            <ShieldCheck size={15} strokeWidth={2.2} />
            <select value={filters.has_account} onChange={(event) => setFilters((current) => ({ ...current, has_account: event.target.value }))}>
              <option value="">Tài khoản portal bất kỳ</option>
              <option value="true">Đã liên kết</option>
              <option value="false">Chưa liên kết</option>
            </select>
          </label>

          <label>
            <Filter size={15} strokeWidth={2.2} />
            <select value={`${filters.sort_by}:${filters.sort_order}`} onChange={(event) => {
              const [sortBy, sortOrder] = event.target.value.split(':');
              setFilters((current) => ({ ...current, sort_by: sortBy, sort_order: sortOrder }));
            }}>
              <option value="created_at:desc">Mới tạo trước</option>
              <option value="updated_at:desc">Mới cập nhật trước</option>
              <option value="full_name:asc">Tên A-Z</option>
              <option value="patient_code:asc">Mã bệnh nhân A-Z</option>
              <option value="date_of_birth:desc">Ngày sinh mới trước</option>
            </select>
          </label>

          <button type="button" className="staff-filter-reset" onClick={resetFilters}>
            Reset
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={() => applyFilters()} disabled={loading}>
            <Search size={15} strokeWidth={2.2} />
            Áp dụng
          </button>
        </div>
      </section>

      <section className="staff-command-table-panel">
        {error ? <p className="form-message error">{error}</p> : null}

        {loading ? (
          <div className="patient-admin-loading">Đang tải danh sách bệnh nhân...</div>
        ) : patients.length === 0 ? (
          <div className="staff-empty-state">
            <div className="staff-empty-state__art"><Search size={30} strokeWidth={2.2} /></div>
            <h3>Không tìm thấy bệnh nhân phù hợp</h3>
            <p>Thử đổi bộ lọc hoặc kiểm tra quyền đọc danh sách bệnh nhân.</p>
          </div>
        ) : (
          <div className="patient-admin-table-scroll">
            <div className="patient-admin-table">
              <div className="patient-admin-table__head">
                <span>Bệnh nhân</span>
                <span>Liên hệ</span>
                <span>Giới tính</span>
                <span>Trạng thái</span>
                <span>Tài khoản portal</span>
                <span>Định danh</span>
                <span>Cập nhật</span>
                <span>Actions</span>
              </div>

              {patients.map((patient) => (
                <div key={patientIdOf(patient)} className="patient-admin-table__row">
                  <PatientIdentity patient={patient} onOpen={openInspector} />
                  <ContactStack patient={patient} />
                  <span className="patient-admin-soft-cell">{genderLabel(patient.gender)}</span>
                  <span className={`staff-status-dot staff-status-dot--${patientStatusTone(patient.status)}`}>
                    <span />
                    {patientStatusLabel(patient.status)}
                  </span>
                  <span className={`patient-admin-account ${patient.has_account ? 'is-linked' : 'is-missing'}`}>
                    {patient.has_account ? patient.account_status || 'Đã liên kết' : 'Chưa liên kết'}
                  </span>
                  <div className="patient-admin-sensitive">
                    <span>{patient.national_id ? `CCCD ${patient.national_id}` : 'CCCD chưa có/ẩn'}</span>
                    <span>{patient.insurance_number ? `BHYT ${patient.insurance_number}` : 'BHYT chưa có/ẩn'}</span>
                  </div>
                  <div className="staff-engagement-cell">
                    <strong>{formatCompactDate(patient.updated_at)}</strong>
                    <small>Created: {formatCompactDate(patient.created_at)}</small>
                  </div>
                  <div className="staff-command-actions">
                    <button type="button" title="Xem Patient 360" onClick={() => openInspector(patient)}>
                      <Eye size={16} strokeWidth={2.25} />
                    </button>
                    <button type="button" title="Hồ sơ lâm sàng" onClick={() => openInspector(patient)}>
                      <CalendarDays size={16} strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <footer className="staff-pagination">
          <span>
            Trang {pagination.page || page} / {totalPages} · {formatNumber(pagination.total)} hồ sơ
          </span>
          <div>
            <button type="button" className="staff-button staff-button--ghost" disabled={page <= 1 || loading} onClick={() => movePage(page - 1)}>
              Trước
            </button>
            <button type="button" className="staff-button staff-button--ghost" disabled={page >= totalPages || loading} onClick={() => movePage(page + 1)}>
              Sau
            </button>
          </div>
        </footer>
      </section>

      <PatientInspector inspector={inspector} onClose={() => setInspector(null)} />
    </>
  );
}
