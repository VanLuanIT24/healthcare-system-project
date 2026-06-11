import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  History,
  IdCard,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Route,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { receptionPatientAdminApi, getReceptionPatientAdminError } from '../api/receptionPatientAdminApi';

const LOCAL_LOOKUP_KEY = 'reception.recentLookups.v1';

const PAGE_CONFIG = {
  'patients-search': {
    eyebrow: 'Tìm kiếm & định danh',
    title: 'Tìm bệnh nhân',
    subtitle: 'Tìm xuyên bệnh nhân, lịch hẹn, queue, hóa đơn, ticket hỗ trợ và QR token bằng dữ liệu backend.',
    icon: Search,
  },
  'patients-qr-scan': {
    eyebrow: 'QR identity',
    title: 'Quét QR bệnh nhân',
    subtitle: 'Preview token QR qua global search, sau đó check-in QR bằng endpoint thật.',
    icon: QrCode,
  },
  'patients-identity-lookup': {
    eyebrow: 'Lookup',
    title: 'Tra cứu theo CCCD / SĐT',
    subtitle: 'Tra cứu exact match theo số điện thoại hoặc giấy tờ và chạy kiểm tra trùng hồ sơ.',
    icon: IdCard,
  },
  'patients-duplicate-check': {
    eyebrow: 'Duplicate control',
    title: 'Kiểm tra trùng hồ sơ',
    subtitle: 'Chạy scoring duplicate từ patient.service trước khi tạo mới hoặc merge hồ sơ.',
    icon: ShieldAlert,
  },
  'patients-duplicate-review': {
    eyebrow: 'Duplicate queue',
    title: 'Hồ sơ nghi trùng',
    subtitle: 'Backend hiện chưa có PatientDuplicateCase; màn này dùng duplicate checker thật và nêu rõ gap queue.',
    icon: ShieldAlert,
  },
  'patients-recent-lookups': {
    eyebrow: 'Lookup history',
    title: 'Lịch sử tra cứu gần đây',
    subtitle: 'Đọc recent-lookups từ backend; khi backend chưa persist thì chỉ hiển thị cache cục bộ để mở lại nhanh.',
    icon: History,
  },
  'patients-create': {
    eyebrow: 'Hồ sơ hành chính',
    title: 'Tạo bệnh nhân mới',
    subtitle: 'Wizard tạo hồ sơ có kiểm tra trùng, định danh, người thân và tài khoản portal trong payload thật.',
    icon: UserPlus,
  },
  'patients-record': {
    eyebrow: 'Admin profile',
    title: 'Hồ sơ hành chính',
    subtitle: 'Xem patient card, cập nhật trường hành chính và ghi thay đổi xuống database.',
    icon: ClipboardList,
  },
  'patients-contact': {
    eyebrow: 'Contact',
    title: 'Thông tin liên hệ',
    subtitle: 'Cập nhật SĐT, email, địa chỉ và liên hệ khẩn cấp trên hồ sơ bệnh nhân.',
    icon: Phone,
  },
  'patients-emergency-contact': {
    eyebrow: 'Relatives',
    title: 'Người thân / liên hệ khẩn cấp',
    subtitle: 'CRUD người thân, đặt liên hệ chính, khẩn cấp và xác minh quan hệ bằng endpoint patient relatives.',
    icon: Users,
  },
  'patients-identifiers': {
    eyebrow: 'Identifiers',
    title: 'Định danh bệnh nhân',
    subtitle: 'Thêm định danh, đặt primary, xóa mềm và kiểm tra trùng định danh.',
    icon: IdCard,
  },
  'patients-portal-account': {
    eyebrow: 'Portal',
    title: 'Tài khoản portal',
    subtitle: 'Tạo, khóa, mở khóa, vô hiệu hóa, reset mật khẩu và gửi xác minh qua API portal admin.',
    icon: UserCheck,
  },
  'patients-basic-insurance': {
    eyebrow: 'Insurance',
    title: 'Bảo hiểm cơ bản',
    subtitle: 'Thêm, xem, verify, reject hoặc cancel insurance policy của bệnh nhân.',
    icon: CreditCard,
  },
  'patients-profile-update-requests': {
    eyebrow: 'Change requests',
    title: 'Yêu cầu cập nhật hồ sơ',
    subtitle: 'Review PatientProfileChangeRequest: approve, reject, request-more-info và assign.',
    icon: ClipboardList,
  },
  'patients-missing-personal-info': {
    eyebrow: 'Profile completion',
    title: 'Thiếu thông tin cá nhân',
    subtitle: 'Tính completeness từ danh sách bệnh nhân thật và cho phép bổ sung nhanh bằng PATCH patient.',
    icon: ShieldAlert,
  },
  'patients-missing-documents': {
    eyebrow: 'Documents',
    title: 'Thiếu giấy tờ',
    subtitle: 'Worklist MissingDocumentTask: assign, resolve, waive và recompute bằng API tài liệu.',
    icon: FileText,
  },
  'patients-missing-insurance': {
    eyebrow: 'Insurance gap',
    title: 'Thiếu bảo hiểm',
    subtitle: 'Theo dõi policy thiếu ảnh, pending verify, hết hạn; gap bệnh nhân không có policy cần API riêng.',
    icon: CreditCard,
  },
  'patients-unverified-contact': {
    eyebrow: 'Verification',
    title: 'Chưa xác minh SĐT / email',
    subtitle: 'Theo dõi patient contact và portal account chưa verified; action thật hiện có là resend verification portal.',
    icon: Mail,
  },
  'patients-uploaded-documents': {
    eyebrow: 'Patient uploads',
    title: 'Tài liệu bệnh nhân gửi lên',
    subtitle: 'Review tài liệu portal: approve, reject, rescan, release và revoke release.',
    icon: FileText,
  },
  'patients-edit-requests': {
    eyebrow: 'Pending edits',
    title: 'Yêu cầu chỉnh sửa chờ duyệt',
    subtitle: 'View pending của PatientProfileChangeRequest, dùng cùng nghiệp vụ duyệt hồ sơ.',
    icon: Edit3,
  },
};

const ADMIN_MODES = new Set([
  'patients-record',
  'patients-contact',
  'patients-emergency-contact',
  'patients-identifiers',
  'patients-portal-account',
  'patients-basic-insurance',
]);

const GENDER_OPTIONS = [
  { value: 'unknown', label: 'Không rõ' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
];

const IDENTIFIER_OPTIONS = [
  { value: 'mrn', label: 'MRN' },
  { value: 'national_id', label: 'CCCD / CMND' },
  { value: 'passport', label: 'Passport' },
  { value: 'insurance_no', label: 'BHYT' },
  { value: 'external_system_id', label: 'Mã hệ thống cũ' },
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getItems(payload) {
  if (Array.isArray(payload)) return payload;
  return safeArray(payload?.items || payload?.candidates || payload?.documents || payload?.policies || payload?.data?.items);
}

function getTotal(payload, fallback = 0) {
  return Number(payload?.pagination?.total ?? payload?.total ?? fallback) || 0;
}

function idOf(item, fields = []) {
  for (const field of fields) {
    if (item?.[field]) return item[field];
  }
  return item?.id || item?._id || '';
}

function getPatientId(item) {
  return idOf(item, ['patient_id', 'patientId']);
}

function patientFrom(item) {
  if (!item) return {};
  if (item.patient) return item.patient;
  if (typeof item.patient_id === 'object' && item.patient_id) return item.patient_id;
  return item;
}

function normalizePatient(item) {
  const source = patientFrom(item);
  return {
    patient_id: getPatientId(source) || idOf(source, ['_id']),
    patient_code: source.patient_code || source.code || '--',
    full_name: source.full_name || source.patient_name || source.name || 'Bệnh nhân',
    date_of_birth: source.date_of_birth || '',
    gender: source.gender || 'unknown',
    phone: source.phone || source.patient_phone || '',
    email: source.email || '',
    address: source.address || '',
    national_id: source.national_id || source.cccd || source.identity_number || '',
    insurance_number: source.insurance_number || '',
    emergency_contact_name: source.emergency_contact_name || '',
    emergency_contact_phone: source.emergency_contact_phone || '',
    identity_verified_at: source.identity_verified_at || '',
    status: source.status || 'active',
    created_at: source.created_at || '',
    updated_at: source.updated_at || '',
  };
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('vi-VN');
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return `${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${date.toLocaleDateString('vi-VN')}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatInteger(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function calculateAge(value) {
  if (!value) return '--';
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return '--';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function genderLabel(value) {
  return GENDER_OPTIONS.find((item) => item.value === value)?.label || 'Không rõ';
}

function statusTone(status) {
  if (['active', 'verified', 'approved', 'resolved', 'completed', 'success', 'valid'].includes(status)) return 'success';
  if (['pending', 'pending_verification', 'open', 'waiting_patient', 'draft'].includes(status)) return 'warning';
  if (['rejected', 'failed', 'overdue', 'locked', 'disabled', 'invalid', 'expired'].includes(status)) return 'danger';
  return 'neutral';
}

function missingFieldsFor(patient) {
  const missing = [];
  if (!patient.full_name || patient.full_name === 'Bệnh nhân') missing.push('Họ tên');
  if (!patient.date_of_birth) missing.push('Ngày sinh');
  if (!patient.gender || patient.gender === 'unknown') missing.push('Giới tính');
  if (!patient.phone) missing.push('SĐT');
  if (!patient.email) missing.push('Email');
  if (!patient.national_id) missing.push('CCCD/CMND');
  if (!patient.address) missing.push('Địa chỉ');
  if (!patient.emergency_contact_phone) missing.push('Liên hệ khẩn cấp');
  return missing;
}

function readLocalLookups() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_LOOKUP_KEY) || '[]');
  } catch (error) {
    return [];
  }
}

function pushLocalLookup(entry) {
  const next = [
    { id: `${Date.now()}-${Math.random()}`, created_at: new Date().toISOString(), ...entry },
    ...readLocalLookups(),
  ].slice(0, 40);
  window.localStorage.setItem(LOCAL_LOOKUP_KEY, JSON.stringify(next));
}

function PageHeader({ mode, onNavigate, right }) {
  const config = PAGE_CONFIG[mode] || PAGE_CONFIG['patients-search'];
  const Icon = config.icon;
  return (
    <section className="reception-appointment-hero reception-patient-admin-hero">
      <div>
        <span>{config.eyebrow}</span>
        <h1>{config.title}</h1>
        <p>{config.subtitle}</p>
      </div>
      <div className="reception-patient-admin-hero__actions">
        {right}
        <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onNavigate?.('patients-search')}>
          <Search size={16} />
          <span>Tìm BN</span>
        </button>
        <button type="button" className="reception-btn reception-btn--primary" onClick={() => onNavigate?.('patients-create')}>
          <Icon size={16} />
          <span>Tạo / xử lý</span>
        </button>
      </div>
    </section>
  );
}

function InlineState({ loading, error, success, note }) {
  if (loading) {
    return (
      <div className="reception-appointment-alert">
        <Loader2 size={18} className="loader" />
        <span>Đang tải dữ liệu backend...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="reception-appointment-alert is-danger">
        <AlertTriangle size={18} />
        <span>{error}</span>
      </div>
    );
  }
  if (success) {
    return (
      <div className="reception-appointment-alert is-success">
        <CheckCircle2 size={18} />
        <span>{success}</span>
      </div>
    );
  }
  if (note) {
    return (
      <div className="reception-appointment-alert">
        <ShieldAlert size={18} />
        <span>{note}</span>
      </div>
    );
  }
  return null;
}

function KpiStrip({ items }) {
  return (
    <section className="reception-workspace-metrics reception-patient-admin-kpis">
      {items.map((item) => {
        const Icon = item.icon || ClipboardList;
        return (
          <article key={item.label} className={`reception-workspace-metric is-${item.tone || 'info'}`}>
            <span className="reception-workspace-metric__icon"><Icon size={21} /></span>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <small>{item.hint}</small>
          </article>
        );
      })}
    </section>
  );
}

function PatientLine({ patient, onSelect, compact = false }) {
  const normalized = normalizePatient(patient);
  return (
    <button type="button" className={`reception-patient-admin-line ${compact ? 'is-compact' : ''}`} onClick={() => onSelect?.(normalized)}>
      <span className="reception-avatar-badge reception-avatar-badge--cyan">{normalized.full_name.slice(0, 1)}</span>
      <span>
        <strong>{normalized.patient_code} - {normalized.full_name}</strong>
        <small>
          {genderLabel(normalized.gender)} · {calculateAge(normalized.date_of_birth)} tuổi · {normalized.phone || 'Thiếu SĐT'} · CCCD {normalized.national_id || 'thiếu'}
        </small>
      </span>
      <ArrowRight size={16} />
    </button>
  );
}

function PatientPicker({ selectedPatient, onSelect }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, error: '', items: [] });

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const keyword = query.trim();
        const payload = keyword.length >= 2
          ? await receptionPatientAdminApi.searchReceptionPatients({ search: keyword, q: keyword, limit: 12, page: 1 })
          : await receptionPatientAdminApi.listPatients({ limit: 12, page: 1, sort_by: 'updated_at', sort_order: 'desc' });
        if (!active) return;
        setState({ loading: false, error: '', items: getItems(payload).map(normalizePatient) });
      } catch (error) {
        if (!active) return;
        setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không tải được bệnh nhân.'), items: [] });
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <section className="reception-panel reception-patient-admin-picker">
      <div className="reception-patient-admin-search">
        <Search size={17} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên / mã BN / SĐT / CCCD..." />
        {state.loading ? <Loader2 size={16} className="loader" /> : null}
      </div>
      <InlineState error={state.error} />
      <div className="reception-patient-admin-picker__list">
        {state.items.map((patient) => (
          <PatientLine
            key={patient.patient_id || patient.patient_code}
            patient={patient}
            compact
            onSelect={onSelect}
          />
        ))}
      </div>
      {selectedPatient ? (
        <div className="reception-patient-admin-selected">
          <span>Đang mở</span>
          <strong>{selectedPatient.patient_code} - {selectedPatient.full_name}</strong>
        </div>
      ) : null}
    </section>
  );
}

function ResultPatientCard({ patient, onSelect, onAction }) {
  const normalized = normalizePatient(patient);
  const missing = missingFieldsFor(normalized);
  return (
    <article className="reception-panel reception-patient-result-card">
      <header>
        <div>
          <strong>{normalized.patient_code} - {normalized.full_name}</strong>
          <span>{genderLabel(normalized.gender)} · {calculateAge(normalized.date_of_birth)} tuổi · {normalized.phone || 'Thiếu SĐT'} · CCCD: {normalized.national_id || 'thiếu'}</span>
        </div>
        <span className={`reception-status-badge is-${statusTone(normalized.status)}`}>{normalized.status}</span>
      </header>
      <div className="reception-patient-result-card__meta">
        <span>Định danh: {normalized.identity_verified_at ? 'Đã xác minh' : 'Chưa xác minh'}</span>
        <span>Email: {normalized.email || 'Thiếu'}</span>
        <span>Thiếu hồ sơ: {missing.length}</span>
      </div>
      <div className="reception-patient-result-card__actions">
        <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onSelect?.(normalized)}><Eye size={15} /><span>Mở hồ sơ</span></button>
        <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction?.('print_card', normalized)}><Printer size={15} /><span>In thẻ BN</span></button>
        <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction?.('route_cashier', normalized)}><CreditCard size={15} /><span>Chuyển thu ngân</span></button>
        <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction?.('route_clinical', normalized)}><Route size={15} /><span>Chuyển CLS</span></button>
      </div>
    </article>
  );
}

function SearchPatientsPage({ mode, onNavigate, onSelectPatient }) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [state, setState] = useState({ loading: false, error: '', data: null, success: '' });

  useEffect(() => {
    const keyword = query.trim();
    if (keyword.length < 2) {
      setState({ loading: false, error: '', data: null, success: '' });
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true, error: '', success: '' }));
      try {
        const payload = await receptionPatientAdminApi.globalSearch({ q: keyword, limit: 10 });
        if (!active) return;
        pushLocalLookup({ query: keyword, query_type: 'global', result_count: countSearchResults(payload), source_page: 'patients-search' });
        setState({ loading: false, error: '', data: payload, success: '' });
      } catch (error) {
        if (!active) return;
        setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không tìm kiếm được.'), data: null, success: '' });
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  async function runAction(action, patient) {
    const patientId = getPatientId(patient);
    if (!patientId) return;
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      if (action === 'print_card') {
        await receptionPatientAdminApi.printPatientCard(patientId);
        setState((current) => ({ ...current, loading: false, success: 'Đã ghi job in thẻ bệnh nhân vào backend.' }));
      } else {
        const destination = action === 'route_cashier' ? 'cashier' : 'clinical';
        await receptionPatientAdminApi.routePatient({ patient_id: patientId, destination, note: `Reception UI route ${destination}` });
        setState((current) => ({ ...current, loading: false, success: 'Đã ghi nhận chuyển tuyến trong audit/backend.' }));
      }
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không thực hiện được thao tác.') }));
    }
  }

  const results = state.data?.results || {};
  const tabs = [
    ['all', 'Tất cả', countSearchResults(state.data)],
    ['patients', 'Bệnh nhân', safeArray(results.patients).length],
    ['appointments', 'Lịch hẹn', safeArray(results.appointments).length],
    ['queue_tickets', 'Queue', safeArray(results.queue_tickets).length],
    ['invoices', 'Hóa đơn', safeArray(results.invoices).length],
    ['support_tickets', 'Ticket hỗ trợ', safeArray(results.support_tickets).length],
    ['qr_token', 'QR', results.qr_token ? 1 : 0],
  ];

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} />
      <section className="reception-panel reception-patient-admin-command">
        <label className="reception-patient-admin-command__search">
          <Search size={20} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nhập tên / mã BN / SĐT / CCCD / email / mã lịch hẹn / mã hóa đơn / mã queue / QR token"
          />
          {state.loading ? <Loader2 size={18} className="loader" /> : null}
        </label>
        <div className="reception-patient-admin-command__actions">
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onNavigate?.('patients-qr-scan')}><QrCode size={16} /><span>Quét QR</span></button>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onNavigate?.('patients-create')}><UserPlus size={16} /><span>Tạo BN mới</span></button>
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onNavigate?.('patients-duplicate-check')}><ShieldAlert size={16} /><span>Kiểm tra trùng</span></button>
        </div>
      </section>
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <section className="reception-segmented-tabs reception-patient-admin-tabs">
        {tabs.map(([key, label, count]) => (
          <button
            type="button"
            key={key}
            className={`reception-segmented-tabs__item ${activeTab === key ? 'is-active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label} <span>{formatInteger(count)}</span>
          </button>
        ))}
      </section>
      <div className="reception-patient-search-layout">
        <main className="reception-patient-search-results">
          {(activeTab === 'all' || activeTab === 'patients') && safeArray(results.patients).map((patient) => (
            <ResultPatientCard
              key={getPatientId(patient) || patient.patient_code}
              patient={patient}
              onSelect={(next) => {
                onSelectPatient?.(next);
                pushLocalLookup({ query, query_type: 'global', patient_id: getPatientId(next), selected_result_id: getPatientId(next), result_count: countSearchResults(state.data), source_page: 'patients-search' });
              }}
              onAction={runAction}
            />
          ))}
          {(activeTab === 'all' || activeTab === 'appointments') && safeArray(results.appointments).map((item) => (
            <EntityResult key={item.appointment_id} icon={CalendarDays} title={item.patient_name || 'Lịch hẹn'} meta={`${formatDateTime(item.appointment_time)} · ${item.department_name || '--'} · ${item.status || '--'}`}>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={async () => {
                setState((current) => ({ ...current, loading: true, error: '', success: '' }));
                try {
                  await receptionPatientAdminApi.quickCheckin({ appointment_id: item.appointment_id, create_queue: true, print_ticket: true });
                  setState((current) => ({ ...current, loading: false, success: 'Check-in lịch hẹn thành công.' }));
                } catch (error) {
                  setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không check-in được lịch hẹn.') }));
                }
              }}><CheckCircle2 size={15} /><span>Check-in</span></button>
            </EntityResult>
          ))}
          {(activeTab === 'all' || activeTab === 'queue_tickets') && safeArray(results.queue_tickets).map((item) => (
            <EntityResult key={item.queue_ticket_id} icon={ClipboardList} title={`${item.display_number || item.queue_number || 'Queue'} - ${item.patient_name || ''}`} meta={`${item.department_name || '--'} · ${item.status || '--'} · ${item.waiting_time_label || ''}`} />
          ))}
          {(activeTab === 'all' || activeTab === 'invoices') && safeArray(results.invoices).map((item) => (
            <EntityResult key={item.invoice_id} icon={CreditCard} title={item.invoice_no || 'Hóa đơn'} meta={`${item.patient_name || '--'} · ${formatCurrency(item.balance_due || item.total_amount)} · ${item.status || '--'}`} />
          ))}
          {(activeTab === 'all' || activeTab === 'support_tickets') && safeArray(results.support_tickets).map((item) => (
            <EntityResult key={item.ticket_id} icon={Send} title={item.ticket_code || item.subject || 'Ticket hỗ trợ'} meta={`${item.patient?.full_name || '--'} · ${item.priority || '--'} · ${item.status || '--'}`} />
          ))}
          {(activeTab === 'all' || activeTab === 'qr_token') && results.qr_token ? (
            <EntityResult icon={QrCode} title={`QR ${results.qr_token.token_status}`} meta={`${results.qr_token.token_type || 'unknown'} · ${results.qr_token.error || 'Preview từ qrTokenService.verifyQrToken'}`} />
          ) : null}
          {!countSearchResults(state.data) && query.trim().length >= 2 && !state.loading ? (
            <div className="reception-empty-panel">Không có kết quả. Có thể tạo bệnh nhân mới hoặc kiểm tra trùng theo CCCD/SĐT.</div>
          ) : null}
        </main>
        <aside className="reception-panel reception-patient-admin-side">
          <h3>Xem nhanh bệnh nhân</h3>
          <p>Chọn một bệnh nhân trong danh sách để mở hồ sơ nhanh. Các thao tác in thẻ và chuyển tuyến đều gọi API thật.</p>
          <div className="reception-patient-admin-gap">
            <ShieldCheck size={18} />
            <span>Lịch sử tra cứu hiện lưu tạm trên giao diện; không tạo dữ liệu giả trong hệ thống.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EntityResult({ icon: Icon, title, meta, children }) {
  return (
    <article className="reception-panel reception-patient-entity-result">
      <Icon size={21} />
      <div>
        <strong>{title}</strong>
        <span>{meta}</span>
      </div>
      <div>{children}</div>
    </article>
  );
}

function countSearchResults(payload) {
  const results = payload?.results || {};
  return safeArray(results.patients).length
    + safeArray(results.appointments).length
    + safeArray(results.queue_tickets).length
    + safeArray(results.invoices).length
    + safeArray(results.support_tickets).length
    + (results.qr_token ? 1 : 0);
}

function QrScanPage({ mode, onNavigate, onSelectPatient }) {
  const [token, setToken] = useState('');
  const [state, setState] = useState({ loading: false, error: '', preview: null, result: null, success: '' });

  async function previewQr() {
    if (!token.trim()) return;
    setState({ loading: true, error: '', preview: null, result: null, success: '' });
    try {
      const payload = await receptionPatientAdminApi.globalSearch({ q: token.trim(), limit: 5 });
      pushLocalLookup({ query: token.trim(), query_type: 'qr', result_count: countSearchResults(payload), source_page: 'patients-qr-scan' });
      setState({ loading: false, error: '', preview: payload, result: null, success: '' });
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không verify được QR qua global search.'), preview: null, result: null, success: '' });
    }
  }

  async function checkinQr() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const result = await receptionPatientAdminApi.qrCheckin({ token: token.trim(), create_queue: true, print_ticket: true });
      setState((current) => ({ ...current, loading: false, result, success: 'QR check-in thành công và đã ghi database.' }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không check-in được QR.') }));
    }
  }

  const qr = state.preview?.results?.qr_token;
  const patient = state.preview?.results?.patients?.[0] || state.result?.appointment?.patient || null;

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} />
      <div className="reception-patient-admin-two-col">
        <section className="reception-panel reception-qr-scanner-box">
          <div className="reception-qr-frame">
            <QrCode size={74} />
            <span>Camera scanner có thể nối thêm sau. Hiện dùng token input để gọi backend thật.</span>
          </div>
          <label className="reception-patient-admin-field">
            <span>Nhập mã QR thủ công</span>
            <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="QR token..." />
          </label>
          <div className="reception-row-actions">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setToken('')}><RefreshCw size={16} /><span>Quét lại</span></button>
            <button type="button" className="reception-btn reception-btn--primary" onClick={previewQr} disabled={state.loading || token.trim().length < 2}><Search size={16} /><span>Preview QR</span></button>
          </div>
        </section>
        <section className="reception-panel reception-patient-admin-detail">
          <h2>Kết quả QR</h2>
          <InlineState loading={state.loading} error={state.error} success={state.success} />
          <div className="reception-patient-admin-detail-grid">
            <div><span>Token status</span><strong>{qr?.token_status || state.result?.token_status || '--'}</strong></div>
            <div><span>Loại QR</span><strong>{qr?.token_type || state.result?.token_type || '--'}</strong></div>
            <div><span>Target</span><strong>{qr?.entity?.target_type || state.result?.entity?.target_type || '--'}</strong></div>
            <div><span>Lịch hẹn</span><strong>{state.result?.appointment_id || qr?.entity?.target_id || '--'}</strong></div>
          </div>
          {patient ? <PatientLine patient={patient} onSelect={onSelectPatient} /> : null}
          <div className="reception-patient-result-card__actions">
            <button type="button" className="reception-btn reception-btn--primary" onClick={checkinQr} disabled={!qr || qr.token_status !== 'valid' || state.loading}>
              <CheckCircle2 size={16} /><span>Check-in + tạo số</span>
            </button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onNavigate?.('patients-identity-lookup')}>
              <Phone size={16} /><span>Tra cứu SĐT/CCCD</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function IdentityLookupPage({ mode, onNavigate, onSelectPatient }) {
  const [lookupMode, setLookupMode] = useState('phone');
  const [value, setValue] = useState('');
  const [state, setState] = useState({ loading: false, error: '', items: [], duplicate: null, success: '' });

  async function submit(event) {
    event.preventDefault();
    if (!value.trim()) return;
    setState({ loading: true, error: '', items: [], duplicate: null, success: '' });
    try {
      const payload = lookupMode === 'phone'
        ? await receptionPatientAdminApi.lookupPhone({ phone: value.trim(), limit: 20 })
        : await receptionPatientAdminApi.lookupNationalId({ national_id: value.trim(), limit: 20 });
      const duplicate = await receptionPatientAdminApi.detectDuplicates(lookupMode === 'phone' ? { phone: value.trim() } : { national_id: value.trim() }).catch(() => null);
      pushLocalLookup({ query: value.trim(), query_type: lookupMode, result_count: getItems(payload).length, source_page: 'patients-identity-lookup' });
      setState({ loading: false, error: '', items: getItems(payload).map(normalizePatient), duplicate, success: '' });
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không tra cứu được.'), items: [], duplicate: null, success: '' });
    }
  }

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} />
      <section className="reception-panel reception-patient-admin-command">
        <form className="reception-patient-admin-lookup" onSubmit={submit}>
          <div className="reception-segmented-tabs">
            <button type="button" className={lookupMode === 'phone' ? 'is-active' : ''} onClick={() => setLookupMode('phone')}>Tra cứu SĐT</button>
            <button type="button" className={lookupMode === 'national_id' ? 'is-active' : ''} onClick={() => setLookupMode('national_id')}>Tra cứu CCCD / giấy tờ</button>
          </div>
          <label>
            <span>{lookupMode === 'phone' ? 'Số điện thoại' : 'Số CCCD / CMND / Passport / BHYT'}</span>
            <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={lookupMode === 'phone' ? '090...' : 'Nhập số giấy tờ'} />
          </label>
          <div className="reception-patient-admin-checks">
            <label><input type="checkbox" defaultChecked /> Tìm cả người thân</label>
            <label><input type="checkbox" defaultChecked /> Tìm cả tài khoản portal</label>
            <label><input type="checkbox" defaultChecked /> Tìm trong lịch hẹn hôm nay</label>
          </div>
          <button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}><Search size={16} /><span>Tra cứu</span></button>
        </form>
      </section>
      <InlineState loading={state.loading} error={state.error} />
      <KpiStrip items={[
        { label: 'Khớp chính xác', value: state.items.length, icon: ShieldCheck, tone: 'success', hint: 'Từ lookup backend' },
        { label: 'Ứng viên duplicate', value: safeArray(state.duplicate?.candidates).length, icon: ShieldAlert, tone: 'warning', hint: 'Từ scoring duplicate' },
        { label: 'High confidence', value: safeArray(state.duplicate?.candidates).filter((item) => item.level === 'high_confidence').length, icon: AlertTriangle, tone: 'danger', hint: 'Cần rà soát' },
        { label: 'Có thể liên quan', value: safeArray(state.duplicate?.candidates).filter((item) => item.level !== 'high_confidence').length, icon: Users, tone: 'info', hint: 'Possible match' },
      ]} />
      <div className="reception-patient-card-grid">
        {state.items.map((patient) => <ResultPatientCard key={patient.patient_id || patient.patient_code} patient={patient} onSelect={onSelectPatient} />)}
      </div>
      <DuplicateCandidateList payload={state.duplicate} onSelect={onSelectPatient} />
    </div>
  );
}

function DuplicateCheckPage({ mode, onNavigate, onSelectPatient }) {
  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    gender: 'unknown',
    phone: '',
    email: '',
    national_id: '',
    insurance_number: '',
    identifier_type: '',
    identifier_value: '',
  });
  const [mergeForm, setMergeForm] = useState({ source_patient_id: '', target_patient_id: '' });
  const [state, setState] = useState({ loading: false, error: '', duplicate: null, preview: null, success: '' });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function checkDuplicates(event) {
    event.preventDefault();
    setState({ loading: true, error: '', duplicate: null, preview: null, success: '' });
    try {
      const duplicate = await receptionPatientAdminApi.detectDuplicates(form);
      setState({ loading: false, error: '', duplicate, preview: null, success: '' });
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không kiểm tra trùng được.'), duplicate: null, preview: null, success: '' });
    }
  }

  async function previewMerge() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const preview = await receptionPatientAdminApi.mergePreview(mergeForm);
      setState((current) => ({ ...current, loading: false, preview }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không preview merge được.') }));
    }
  }

  async function mergePatients() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      await receptionPatientAdminApi.mergePatients({ ...mergeForm, reason: 'Reception duplicate workbench merge' });
      setState((current) => ({ ...current, loading: false, success: 'Merge hồ sơ thành công. Dữ liệu đã cập nhật trong database.' }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không merge được hồ sơ.') }));
    }
  }

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} />
      <div className="reception-patient-admin-two-col">
        <section className="reception-panel">
          <form className="reception-form-grid" onSubmit={checkDuplicates}>
            <label><span>Họ tên</span><input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} /></label>
            <label><span>Ngày sinh</span><input type="date" value={form.date_of_birth} onChange={(event) => update('date_of_birth', event.target.value)} /></label>
            <label><span>Giới tính</span><select value={form.gender} onChange={(event) => update('gender', event.target.value)}>{GENDER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label><span>SĐT</span><input value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
            <label><span>Email</span><input value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
            <label><span>CCCD</span><input value={form.national_id} onChange={(event) => update('national_id', event.target.value)} /></label>
            <label><span>BHYT</span><input value={form.insurance_number} onChange={(event) => update('insurance_number', event.target.value)} /></label>
            <label><span>Loại định danh khác</span><select value={form.identifier_type} onChange={(event) => update('identifier_type', event.target.value)}><option value="">--</option>{IDENTIFIER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="is-span-2"><span>Mã định danh khác</span><input value={form.identifier_value} onChange={(event) => update('identifier_value', event.target.value)} /></label>
            <div className="reception-patient-form-actions is-span-2">
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setForm({ full_name: '', date_of_birth: '', gender: 'unknown', phone: '', email: '', national_id: '', insurance_number: '', identifier_type: '', identifier_value: '' })}>Reset</button>
              <button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}><RefreshCw size={16} /><span>Kiểm tra trùng</span></button>
            </div>
          </form>
        </section>
        <section className="reception-panel">
          <h2>Merge hồ sơ có sẵn</h2>
          <p className="reception-muted">Merge chỉ chạy khi có 2 patient_id thật. Form này gọi `/patients/merge/preview` và `/patients/merge`.</p>
          <div className="reception-form-grid reception-form-grid--single">
            <label><span>Hồ sơ nguồn</span><input value={mergeForm.source_patient_id} onChange={(event) => setMergeForm((current) => ({ ...current, source_patient_id: event.target.value }))} placeholder="source_patient_id" /></label>
            <label><span>Hồ sơ chính</span><input value={mergeForm.target_patient_id} onChange={(event) => setMergeForm((current) => ({ ...current, target_patient_id: event.target.value }))} placeholder="target_patient_id" /></label>
            <div className="reception-row-actions">
              <button type="button" className="reception-btn reception-btn--ghost" onClick={previewMerge} disabled={state.loading}><Eye size={16} /><span>Preview merge</span></button>
              <button type="button" className="reception-btn reception-btn--primary" onClick={mergePatients} disabled={state.loading || !state.preview}><ShieldCheck size={16} /><span>Merge hồ sơ</span></button>
            </div>
          </div>
        </section>
      </div>
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <DuplicateCandidateList payload={state.duplicate} onSelect={onSelectPatient} />
      {state.preview ? (
        <section className="reception-panel reception-patient-admin-json">
          <h2>Merge preview</h2>
          <pre>{JSON.stringify(state.preview, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}

function DuplicateCandidateList({ payload, onSelect }) {
  const candidates = safeArray(payload?.candidates || payload?.items);
  if (!payload) return null;
  return (
    <section className="reception-panel reception-patient-admin-table">
      <header className="reception-panel__header reception-panel__header--compact">
        <div>
          <h2>Ứng viên trùng hồ sơ</h2>
          <p>{payload.has_duplicates ? 'Có hồ sơ cần rà soát.' : 'Không có duplicate theo dữ liệu nhập.'}</p>
        </div>
      </header>
      <table>
        <thead><tr><th>Điểm</th><th>Mức độ</th><th>Mã BN</th><th>Họ tên</th><th>DOB</th><th>SĐT</th><th>Trường khớp</th><th>Action</th></tr></thead>
        <tbody>
          {candidates.map((item) => (
            <tr key={item.patient_id}>
              <td><strong>{item.score}</strong></td>
              <td><span className={`reception-status-badge is-${item.level === 'high_confidence' ? 'danger' : 'warning'}`}>{item.level}</span></td>
              <td>{item.patient_code}</td>
              <td>{item.full_name}</td>
              <td>{formatDate(item.date_of_birth)}</td>
              <td>{item.phone || '--'}</td>
              <td>{safeArray(item.matched_fields).join(', ') || '--'}</td>
              <td><button type="button" className="reception-btn reception-btn--ghost" onClick={() => onSelect?.(item)}><Eye size={15} /><span>Mở</span></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!candidates.length ? <div className="reception-empty-panel reception-empty-panel--compact">Không có ứng viên.</div> : null}
    </section>
  );
}

function DuplicateCasesPage({ mode, onNavigate, onSelectPatient }) {
  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} />
      <InlineState note="Backend chưa có PatientDuplicateCase nên chưa thể có queue assign/dismiss/merge đúng nghĩa. Màn này không giả lập queue; dùng checker thật bên dưới." />
      <DuplicateCheckPage mode="patients-duplicate-check" onNavigate={onNavigate} onSelectPatient={onSelectPatient} />
    </div>
  );
}

function RecentLookupsPage({ mode, onNavigate, onSelectPatient }) {
  const [state, setState] = useState({ loading: false, error: '', items: [], note: '' });

  async function load() {
    setState({ loading: true, error: '', items: [], note: '' });
    try {
      const payload = await receptionPatientAdminApi.recentLookups({ limit: 30 });
      setState({ loading: false, error: '', items: [...getItems(payload), ...readLocalLookups()], note: payload?.note || '' });
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không tải được lịch sử tra cứu.'), items: readLocalLookups(), note: '' });
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} right={<button type="button" className="reception-btn reception-btn--ghost" onClick={load}><RefreshCw size={16} /><span>Làm mới</span></button>} />
      <InlineState loading={state.loading} error={state.error} note={state.note} />
      <section className="reception-panel reception-patient-admin-table">
        <table>
          <thead><tr><th>Thời gian</th><th>Query</th><th>Loại</th><th>Số kết quả</th><th>Bệnh nhân mở</th><th>Nguồn</th><th>Action</th></tr></thead>
          <tbody>
            {state.items.map((item) => (
              <tr key={item.id || item._id || `${item.created_at}-${item.query}`}>
                <td>{formatDateTime(item.created_at)}</td>
                <td>{item.query || item.keyword || '--'}</td>
                <td>{item.query_type || '--'}</td>
                <td>{formatInteger(item.result_count)}</td>
                <td>{item.patient_id || item.selected_result_id || '--'}</td>
                <td>{item.source_page || 'server'}</td>
                <td>
                  {item.patient_id || item.selected_result_id ? (
                    <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onSelectPatient?.({ patient_id: item.patient_id || item.selected_result_id })}>
                      <Eye size={15} /><span>Mở lại</span>
                    </button>
                  ) : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.items.length ? <div className="reception-empty-panel">Chưa có lịch sử tra cứu.</div> : null}
      </section>
    </div>
  );
}

function CreatePatientPage({ mode, onNavigate, onSelectPatient }) {
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState({
    full_name: '',
    date_of_birth: '',
    gender: 'unknown',
    phone: '',
    email: '',
    national_id: '',
    insurance_number: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    status: 'active',
  });
  const [relative, setRelative] = useState({ full_name: '', relationship: '', phone: '', email: '', is_primary_contact: true, is_emergency_contact: true });
  const [account, setAccount] = useState({ create_account: false, username: '', email: '', phone: '', temporary_password: '' });
  const [flags, setFlags] = useState({ confirm_duplicate_checked: false, force_create: false, checkin_after_create: false });
  const [state, setState] = useState({ loading: false, error: '', duplicate: null, success: '' });

  function updatePatient(field, value) {
    setPatient((current) => ({ ...current, [field]: value }));
  }

  async function checkDuplicate() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const duplicate = await receptionPatientAdminApi.detectDuplicates(patient);
      setState((current) => ({ ...current, loading: false, duplicate }));
      setFlags((current) => ({ ...current, confirm_duplicate_checked: true }));
      setStep(2);
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không kiểm tra trùng được.') }));
    }
  }

  async function submit(event) {
    event.preventDefault();
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const body = {
        ...patient,
        confirm_duplicate_checked: flags.confirm_duplicate_checked,
        force_create: flags.force_create,
        relatives: relative.full_name ? [relative] : [],
        create_account: account.create_account,
        account: account.create_account ? {
          username: account.username || undefined,
          email: account.email || patient.email || undefined,
          phone: account.phone || patient.phone || undefined,
          temporary_password: account.temporary_password || undefined,
        } : undefined,
      };
      const payload = await receptionPatientAdminApi.createPatient(body);
      const created = normalizePatient(payload?.patient || payload?.detail?.patient || payload);
      setState((current) => ({ ...current, loading: false, success: `Đã tạo hồ sơ ${created.patient_code || created.full_name}.` }));
      onSelectPatient?.(created);
      if (flags.checkin_after_create) {
        onNavigate?.('checkin-walkin');
      }
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không tạo được bệnh nhân.') }));
    }
  }

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} />
      <section className="reception-panel reception-patient-stepper">
        {['Kiểm tra trùng', 'Thông tin cơ bản', 'Định danh', 'Liên hệ / người thân', 'Portal / check-in'].map((label, index) => (
          <button
            type="button"
            key={label}
            className={`${step === index + 1 ? 'is-active' : ''} ${step > index + 1 ? 'is-done' : ''}`}
            onClick={() => setStep(index + 1)}
          >
            <span>{index + 1}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </section>
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      {step === 1 ? (
        <section className="reception-panel">
          <div className="reception-form-grid">
            <label><span>Họ tên *</span><input value={patient.full_name} onChange={(event) => updatePatient('full_name', event.target.value)} /></label>
            <label><span>Ngày sinh</span><input type="date" value={patient.date_of_birth} onChange={(event) => updatePatient('date_of_birth', event.target.value)} /></label>
            <label><span>SĐT hoặc CCCD</span><input value={patient.phone || patient.national_id} onChange={(event) => updatePatient('phone', event.target.value)} /></label>
            <div className="reception-patient-form-actions is-span-2">
              <button type="button" className="reception-btn reception-btn--primary" onClick={checkDuplicate} disabled={state.loading}><ShieldAlert size={16} /><span>Kiểm tra trùng</span></button>
            </div>
          </div>
          <DuplicateCandidateList payload={state.duplicate} onSelect={onSelectPatient} />
        </section>
      ) : (
        <form className="reception-panel reception-form-grid" onSubmit={submit}>
          {step === 2 ? (
            <>
              <label><span>Họ tên *</span><input required value={patient.full_name} onChange={(event) => updatePatient('full_name', event.target.value)} /></label>
              <label><span>Ngày sinh</span><input type="date" value={patient.date_of_birth} onChange={(event) => updatePatient('date_of_birth', event.target.value)} /></label>
              <label><span>Giới tính</span><select value={patient.gender} onChange={(event) => updatePatient('gender', event.target.value)}>{GENDER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label><span>SĐT</span><input value={patient.phone} onChange={(event) => updatePatient('phone', event.target.value)} /></label>
              <label><span>Email</span><input value={patient.email} onChange={(event) => updatePatient('email', event.target.value)} /></label>
              <label className="is-span-2"><span>Địa chỉ</span><input value={patient.address} onChange={(event) => updatePatient('address', event.target.value)} /></label>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <label><span>CCCD / CMND</span><input value={patient.national_id} onChange={(event) => updatePatient('national_id', event.target.value)} /></label>
              <label><span>BHYT</span><input value={patient.insurance_number} onChange={(event) => updatePatient('insurance_number', event.target.value)} /></label>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <label><span>Liên hệ khẩn cấp</span><input value={patient.emergency_contact_name} onChange={(event) => updatePatient('emergency_contact_name', event.target.value)} /></label>
              <label><span>SĐT khẩn cấp</span><input value={patient.emergency_contact_phone} onChange={(event) => updatePatient('emergency_contact_phone', event.target.value)} /></label>
              <label><span>Người thân</span><input value={relative.full_name} onChange={(event) => setRelative((current) => ({ ...current, full_name: event.target.value }))} /></label>
              <label><span>Quan hệ</span><input value={relative.relationship} onChange={(event) => setRelative((current) => ({ ...current, relationship: event.target.value }))} /></label>
              <label><span>SĐT người thân</span><input value={relative.phone} onChange={(event) => setRelative((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label><span>Email người thân</span><input value={relative.email} onChange={(event) => setRelative((current) => ({ ...current, email: event.target.value }))} /></label>
            </>
          ) : null}
          {step === 5 ? (
            <>
              <label className="reception-patient-check"><input type="checkbox" checked={account.create_account} onChange={(event) => setAccount((current) => ({ ...current, create_account: event.target.checked }))} /><span>Tạo tài khoản portal</span></label>
              <label><span>Username</span><input value={account.username} onChange={(event) => setAccount((current) => ({ ...current, username: event.target.value }))} /></label>
              <label><span>Email portal</span><input value={account.email} onChange={(event) => setAccount((current) => ({ ...current, email: event.target.value }))} /></label>
              <label><span>Phone portal</span><input value={account.phone} onChange={(event) => setAccount((current) => ({ ...current, phone: event.target.value }))} /></label>
              <label className="reception-patient-check"><input type="checkbox" checked={flags.confirm_duplicate_checked} onChange={(event) => setFlags((current) => ({ ...current, confirm_duplicate_checked: event.target.checked }))} /><span>Đã kiểm tra duplicate</span></label>
              <label className="reception-patient-check"><input type="checkbox" checked={flags.force_create} onChange={(event) => setFlags((current) => ({ ...current, force_create: event.target.checked }))} /><span>Force create khi có quyền</span></label>
              <label className="reception-patient-check"><input type="checkbox" checked={flags.checkin_after_create} onChange={(event) => setFlags((current) => ({ ...current, checkin_after_create: event.target.checked }))} /><span>Sau khi lưu chuyển qua check-in vãng lai</span></label>
            </>
          ) : null}
          <div className="reception-patient-form-actions is-span-2">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setStep(Math.max(1, step - 1))}>Quay lại</button>
            {step < 5 ? (
              <button type="button" className="reception-btn reception-btn--primary" onClick={() => setStep(Math.min(5, step + 1))}>Tiếp tục</button>
            ) : (
              <button type="submit" className="reception-btn reception-btn--primary" disabled={state.loading}><UserPlus size={16} /><span>Lưu hồ sơ</span></button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function usePatientBundle(patientId) {
  const [state, setState] = useState({ loading: false, error: '', card: null, identifiers: [], relatives: [], insurance: [], accounts: [] });

  async function load() {
    if (!patientId) return;
    setState((current) => ({ ...current, loading: true, error: '' }));
    const [card, identifiers, relatives, insurance, accounts] = await Promise.allSettled([
      receptionPatientAdminApi.patientCard(patientId, { timeline_limit: 10 }),
      receptionPatientAdminApi.identifiers(patientId),
      receptionPatientAdminApi.relatives(patientId),
      receptionPatientAdminApi.patientInsurancePolicies(patientId),
      receptionPatientAdminApi.listPortalAccounts({ patient_id: patientId, limit: 5 }),
    ]);
    setState({
      loading: false,
      error: card.status === 'rejected' ? getReceptionPatientAdminError(card.reason, 'Không tải được patient card.') : '',
      card: card.status === 'fulfilled' ? card.value : null,
      identifiers: identifiers.status === 'fulfilled' ? getItems(identifiers.value) : [],
      relatives: relatives.status === 'fulfilled' ? getItems(relatives.value) : [],
      insurance: insurance.status === 'fulfilled' ? getItems(insurance.value) : [],
      accounts: accounts.status === 'fulfilled' ? getItems(accounts.value) : [],
    });
  }

  useEffect(() => {
    load();
  }, [patientId]);

  return { ...state, refresh: load };
}

function PatientAdminPage({ mode, onNavigate, onSelectPatient }) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const patientId = getPatientId(selectedPatient);
  const bundle = usePatientBundle(patientId);
  const patient = normalizePatient(bundle.card?.patient || bundle.card?.detail?.patient || selectedPatient);

  function selectPatient(patientValue) {
    setSelectedPatient(patientValue);
    onSelectPatient?.(patientValue);
  }

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} />
      <div className="reception-patient-admin-layout">
        <aside>
          <PatientPicker selectedPatient={selectedPatient} onSelect={selectPatient} />
          <section className="reception-panel reception-patient-admin-nav">
            {[
              ['patients-record', 'Hồ sơ', ClipboardList],
              ['patients-contact', 'Liên hệ', Phone],
              ['patients-emergency-contact', 'Người thân', Users],
              ['patients-identifiers', 'Định danh', IdCard],
              ['patients-portal-account', 'Portal', UserCheck],
              ['patients-basic-insurance', 'Bảo hiểm', CreditCard],
            ].map(([key, label, Icon]) => (
              <button type="button" key={key} className={mode === key ? 'is-active' : ''} onClick={() => onNavigate?.(key)}>
                <Icon size={16} /><span>{label}</span>
              </button>
            ))}
          </section>
        </aside>
        <main>
          {!patientId ? (
            <div className="reception-empty-panel">Chọn một bệnh nhân để thao tác dữ liệu hành chính.</div>
          ) : (
            <>
              <PatientAdminSummary patient={patient} bundle={bundle} />
              <InlineState loading={bundle.loading} error={bundle.error} />
              {mode === 'patients-record' ? <PatientRecordEditor patient={patient} onSaved={bundle.refresh} /> : null}
              {mode === 'patients-contact' ? <PatientContactEditor patient={patient} onSaved={bundle.refresh} /> : null}
              {mode === 'patients-emergency-contact' ? <RelativesManager patientId={patientId} relatives={bundle.relatives} onSaved={bundle.refresh} /> : null}
              {mode === 'patients-identifiers' ? <IdentifiersManager patientId={patientId} identifiers={bundle.identifiers} onSaved={bundle.refresh} /> : null}
              {mode === 'patients-portal-account' ? <PortalAccountManager patient={patient} accounts={bundle.accounts} onSaved={bundle.refresh} /> : null}
              {mode === 'patients-basic-insurance' ? <InsuranceManager patientId={patientId} policies={bundle.insurance} onSaved={bundle.refresh} /> : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function PatientAdminSummary({ patient, bundle }) {
  const warnings = [
    ...missingFieldsFor(patient),
    ...(bundle.card?.summary?.profile_warnings || []),
  ];
  return (
    <section className="reception-panel reception-patient-admin-summary">
      <div>
        <span className="reception-avatar-badge reception-avatar-badge--cyan">{patient.full_name.slice(0, 1)}</span>
        <div>
          <h2>{patient.patient_code} - {patient.full_name}</h2>
          <p>{genderLabel(patient.gender)} · {calculateAge(patient.date_of_birth)} tuổi · {patient.phone || 'Thiếu SĐT'}</p>
        </div>
      </div>
      <div className="reception-patient-admin-summary__badges">
        <span className={`reception-status-badge is-${statusTone(patient.status)}`}>{patient.status}</span>
        <span className={`reception-status-badge is-${patient.identity_verified_at ? 'success' : 'warning'}`}>{patient.identity_verified_at ? 'Identity verified' : 'Identity chưa verified'}</span>
        <span className={`reception-status-badge is-${warnings.length ? 'warning' : 'success'}`}>{warnings.length ? `${warnings.length} cảnh báo` : 'Hồ sơ đủ'}</span>
      </div>
    </section>
  );
}

function PatientRecordEditor({ patient, onSaved }) {
  const [form, setForm] = useState(patient);
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    setForm(patient);
  }, [patient.patient_id]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setState({ loading: true, error: '', success: '' });
    try {
      await receptionPatientAdminApi.updatePatient(patient.patient_id, {
        full_name: form.full_name,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        phone: form.phone,
        email: form.email,
        national_id: form.national_id,
        insurance_number: form.insurance_number,
        address: form.address,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
      });
      setState({ loading: false, error: '', success: 'Đã lưu hồ sơ hành chính.' });
      onSaved?.();
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không lưu được hồ sơ.'), success: '' });
    }
  }

  async function archive() {
    setState({ loading: true, error: '', success: '' });
    try {
      await receptionPatientAdminApi.archivePatient(patient.patient_id, { reason: 'Reception archive from admin profile' });
      setState({ loading: false, error: '', success: 'Đã archive hồ sơ.' });
      onSaved?.();
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không archive được hồ sơ.'), success: '' });
    }
  }

  return (
    <section className="reception-panel">
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <form className="reception-form-grid" onSubmit={save}>
        <label><span>Họ tên</span><input value={form.full_name || ''} onChange={(event) => update('full_name', event.target.value)} /></label>
        <label><span>Ngày sinh</span><input type="date" value={(form.date_of_birth || '').slice(0, 10)} onChange={(event) => update('date_of_birth', event.target.value)} /></label>
        <label><span>Giới tính</span><select value={form.gender || 'unknown'} onChange={(event) => update('gender', event.target.value)}>{GENDER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>SĐT</span><input value={form.phone || ''} onChange={(event) => update('phone', event.target.value)} /></label>
        <label><span>Email</span><input value={form.email || ''} onChange={(event) => update('email', event.target.value)} /></label>
        <label><span>CCCD</span><input value={form.national_id || ''} onChange={(event) => update('national_id', event.target.value)} /></label>
        <label><span>BHYT</span><input value={form.insurance_number || ''} onChange={(event) => update('insurance_number', event.target.value)} /></label>
        <label className="is-span-2"><span>Địa chỉ</span><input value={form.address || ''} onChange={(event) => update('address', event.target.value)} /></label>
        <label><span>Liên hệ khẩn cấp</span><input value={form.emergency_contact_name || ''} onChange={(event) => update('emergency_contact_name', event.target.value)} /></label>
        <label><span>SĐT khẩn cấp</span><input value={form.emergency_contact_phone || ''} onChange={(event) => update('emergency_contact_phone', event.target.value)} /></label>
        <div className="reception-patient-form-actions is-span-2">
          <button type="button" className="reception-btn reception-btn--ghost" onClick={archive}><Ban size={16} /><span>Archive</span></button>
          <button type="submit" className="reception-btn reception-btn--primary"><CheckCircle2 size={16} /><span>Lưu thay đổi</span></button>
        </div>
      </form>
    </section>
  );
}

function PatientContactEditor({ patient, onSaved }) {
  return (
    <section>
      <PatientRecordEditor patient={patient} onSaved={onSaved} />
      <InlineState note="Patient contact verification workflow chưa có endpoint riêng; nút xác minh không giả lập DB. Portal verification nằm ở tab Tài khoản portal." />
    </section>
  );
}

function RelativesManager({ patientId, relatives, onSaved }) {
  const [form, setForm] = useState({ full_name: '', relationship: '', phone: '', email: '', national_id: '', is_primary_contact: false, is_emergency_contact: false });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  async function run(action, relative = {}) {
    setState({ loading: true, error: '', success: '' });
    try {
      const relativeId = idOf(relative, ['relative_id']);
      if (action === 'add') await receptionPatientAdminApi.addRelative(patientId, form);
      if (action === 'primary') await receptionPatientAdminApi.updateRelative(relativeId, { is_primary_contact: true });
      if (action === 'emergency') await receptionPatientAdminApi.updateRelative(relativeId, { is_emergency_contact: true });
      if (action === 'verify') await receptionPatientAdminApi.updateRelative(relativeId, { relationship_verified: true });
      if (action === 'delete') await receptionPatientAdminApi.deleteRelative(relativeId);
      setState({ loading: false, error: '', success: 'Đã cập nhật người thân.' });
      setForm({ full_name: '', relationship: '', phone: '', email: '', national_id: '', is_primary_contact: false, is_emergency_contact: false });
      onSaved?.();
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không cập nhật được người thân.'), success: '' });
    }
  }

  return (
    <section className="reception-panel">
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <div className="reception-form-grid">
        <label><span>Họ tên</span><input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} /></label>
        <label><span>Quan hệ</span><input value={form.relationship} onChange={(event) => setForm((current) => ({ ...current, relationship: event.target.value }))} /></label>
        <label><span>SĐT</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
        <label><span>Email</span><input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
        <label><span>CCCD</span><input value={form.national_id} onChange={(event) => setForm((current) => ({ ...current, national_id: event.target.value }))} /></label>
        <label className="reception-patient-check"><input type="checkbox" checked={form.is_primary_contact} onChange={(event) => setForm((current) => ({ ...current, is_primary_contact: event.target.checked }))} /><span>Liên hệ chính</span></label>
        <label className="reception-patient-check"><input type="checkbox" checked={form.is_emergency_contact} onChange={(event) => setForm((current) => ({ ...current, is_emergency_contact: event.target.checked }))} /><span>Liên hệ khẩn cấp</span></label>
        <div className="reception-patient-form-actions"><button type="button" className="reception-btn reception-btn--primary" onClick={() => run('add')}><Plus size={16} /><span>Thêm người thân</span></button></div>
      </div>
      <SimpleTable
        columns={['Tên', 'Quan hệ', 'SĐT', 'Email', 'Chính', 'Khẩn cấp', 'Xác minh', 'Action']}
        rows={relatives.map((item) => [
          item.full_name,
          item.relationship,
          item.phone || '--',
          item.email || '--',
          item.is_primary_contact ? 'Có' : '--',
          item.is_emergency_contact ? 'Có' : '--',
          item.relationship_verified ? 'Đã xác minh' : 'Chưa',
          <div className="reception-row-actions is-compact">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('primary', item)}>Chính</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('emergency', item)}>Khẩn cấp</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('verify', item)}>Verify</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('delete', item)}><Trash2 size={14} /></button>
          </div>,
        ])}
      />
    </section>
  );
}

function IdentifiersManager({ patientId, identifiers, onSaved }) {
  const [form, setForm] = useState({ identifier_type: 'national_id', identifier_value: '', issued_by: '', valid_from: '', valid_to: '', is_primary: false });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  async function run(action, identifier = {}) {
    setState({ loading: true, error: '', success: '' });
    try {
      const identifierId = idOf(identifier, ['identifier_id']);
      if (action === 'add') await receptionPatientAdminApi.addIdentifier(patientId, form);
      if (action === 'primary') await receptionPatientAdminApi.setPrimaryIdentifier(patientId, identifierId);
      if (action === 'delete') await receptionPatientAdminApi.deleteIdentifier(patientId, identifierId);
      if (action === 'duplicate') await receptionPatientAdminApi.detectDuplicates({ identifier_type: identifier.identifier_type, identifier_value: identifier.identifier_value });
      setState({ loading: false, error: '', success: action === 'duplicate' ? 'Đã chạy kiểm tra trùng định danh.' : 'Đã cập nhật định danh.' });
      setForm({ identifier_type: 'national_id', identifier_value: '', issued_by: '', valid_from: '', valid_to: '', is_primary: false });
      onSaved?.();
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không cập nhật được định danh.'), success: '' });
    }
  }

  return (
    <section className="reception-panel">
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <div className="reception-form-grid">
        <label><span>Loại</span><select value={form.identifier_type} onChange={(event) => setForm((current) => ({ ...current, identifier_type: event.target.value }))}>{IDENTIFIER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span>Giá trị</span><input value={form.identifier_value} onChange={(event) => setForm((current) => ({ ...current, identifier_value: event.target.value }))} /></label>
        <label><span>Nơi cấp</span><input value={form.issued_by} onChange={(event) => setForm((current) => ({ ...current, issued_by: event.target.value }))} /></label>
        <label><span>Từ ngày</span><input type="date" value={form.valid_from} onChange={(event) => setForm((current) => ({ ...current, valid_from: event.target.value }))} /></label>
        <label><span>Đến ngày</span><input type="date" value={form.valid_to} onChange={(event) => setForm((current) => ({ ...current, valid_to: event.target.value }))} /></label>
        <label className="reception-patient-check"><input type="checkbox" checked={form.is_primary} onChange={(event) => setForm((current) => ({ ...current, is_primary: event.target.checked }))} /><span>Primary</span></label>
        <button type="button" className="reception-btn reception-btn--primary" onClick={() => run('add')}><Plus size={16} /><span>Thêm định danh</span></button>
      </div>
      <SimpleTable
        columns={['Loại', 'Giá trị', 'Nơi cấp', 'Hiệu lực', 'Primary', 'Action']}
        rows={identifiers.map((item) => [
          item.identifier_type,
          item.identifier_value,
          item.issued_by || '--',
          `${formatDate(item.valid_from)} - ${formatDate(item.valid_to)}`,
          item.is_primary ? 'Có' : '--',
          <div className="reception-row-actions is-compact">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('primary', item)}>Primary</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('duplicate', item)}>Trùng</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('delete', item)}><Trash2 size={14} /></button>
          </div>,
        ])}
      />
    </section>
  );
}

function PortalAccountManager({ patient, accounts, onSaved }) {
  const account = accounts[0] || null;
  const [form, setForm] = useState({ username: '', email: patient.email || '', phone: patient.phone || '', temporary_password: '' });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  async function run(action) {
    setState({ loading: true, error: '', success: '' });
    try {
      const accountId = idOf(account, ['account_id', 'patient_account_id']);
      if (action === 'create') await receptionPatientAdminApi.createPortalAccount(patient.patient_id, form);
      if (action === 'lock') await receptionPatientAdminApi.lockPortalAccount(accountId, { reason: 'Reception lock' });
      if (action === 'unlock') await receptionPatientAdminApi.unlockPortalAccount(accountId);
      if (action === 'disable') await receptionPatientAdminApi.disablePortalAccount(accountId, { reason: 'Reception disable' });
      if (action === 'enable') await receptionPatientAdminApi.enablePortalAccount(accountId);
      if (action === 'reset') await receptionPatientAdminApi.resetPortalPassword(accountId);
      if (action === 'resend') await receptionPatientAdminApi.resendPortalVerification(accountId);
      if (action === 'logout') await receptionPatientAdminApi.forceLogoutPortalAccount(accountId);
      setState({ loading: false, error: '', success: 'Đã cập nhật tài khoản portal.' });
      onSaved?.();
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không cập nhật được portal account.'), success: '' });
    }
  }

  return (
    <section className="reception-panel">
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      {!account ? (
        <div className="reception-form-grid">
          <label><span>Username</span><input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} /></label>
          <label><span>Email</span><input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label><span>SĐT</span><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label><span>Mật khẩu tạm</span><input value={form.temporary_password} onChange={(event) => setForm((current) => ({ ...current, temporary_password: event.target.value }))} placeholder="Để trống để backend tự sinh" /></label>
          <button type="button" className="reception-btn reception-btn--primary" onClick={() => run('create')}><UserCheck size={16} /><span>Tạo portal account</span></button>
        </div>
      ) : (
        <>
          <div className="reception-patient-admin-detail-grid">
            <div><span>Username</span><strong>{account.username || '--'}</strong></div>
            <div><span>Email</span><strong>{account.email || '--'}</strong></div>
            <div><span>Phone</span><strong>{account.phone || '--'}</strong></div>
            <div><span>Provider</span><strong>{account.auth_provider || '--'}</strong></div>
            <div><span>Status</span><strong>{account.status || '--'}</strong></div>
            <div><span>Last login</span><strong>{formatDateTime(account.last_login_at)}</strong></div>
          </div>
          <div className="reception-row-actions">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('lock')}><Lock size={16} /><span>Khóa</span></button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('unlock')}><Unlock size={16} /><span>Mở khóa</span></button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('disable')}><Ban size={16} /><span>Vô hiệu hóa</span></button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('enable')}><CheckCircle2 size={16} /><span>Kích hoạt</span></button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('reset')}><KeyRound size={16} /><span>Reset mật khẩu</span></button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('resend')}><Send size={16} /><span>Gửi xác minh</span></button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('logout')}><XCircle size={16} /><span>Force logout</span></button>
          </div>
        </>
      )}
    </section>
  );
}

function InsuranceManager({ patientId, policies, onSaved }) {
  const [form, setForm] = useState({ payer_name: '', payer_code: '', policy_no: '', member_no: '', coverage_type: 'BHYT', coverage_percent: 80, valid_from: '', valid_to: '', is_primary: true });
  const [state, setState] = useState({ loading: false, error: '', success: '' });

  async function run(action, policy = {}) {
    setState({ loading: true, error: '', success: '' });
    try {
      const policyId = idOf(policy, ['policy_id', 'insurance_policy_id']);
      if (action === 'add') await receptionPatientAdminApi.createPatientInsurancePolicy(patientId, form);
      if (action === 'verify') await receptionPatientAdminApi.verifyInsurancePolicy(policyId);
      if (action === 'reject') await receptionPatientAdminApi.rejectInsurancePolicy(policyId, { reason: 'Reception reject' });
      if (action === 'cancel') await receptionPatientAdminApi.cancelInsurancePolicy(policyId, { reason: 'Reception cancel' });
      setState({ loading: false, error: '', success: 'Đã cập nhật bảo hiểm.' });
      onSaved?.();
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không cập nhật được bảo hiểm.'), success: '' });
    }
  }

  return (
    <section className="reception-panel">
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <div className="reception-form-grid">
        <label><span>Tên bảo hiểm</span><input value={form.payer_name} onChange={(event) => setForm((current) => ({ ...current, payer_name: event.target.value }))} /></label>
        <label><span>Mã payer</span><input value={form.payer_code} onChange={(event) => setForm((current) => ({ ...current, payer_code: event.target.value }))} /></label>
        <label><span>Số thẻ / policy no</span><input value={form.policy_no} onChange={(event) => setForm((current) => ({ ...current, policy_no: event.target.value }))} /></label>
        <label><span>Member no</span><input value={form.member_no} onChange={(event) => setForm((current) => ({ ...current, member_no: event.target.value }))} /></label>
        <label><span>Loại</span><input value={form.coverage_type} onChange={(event) => setForm((current) => ({ ...current, coverage_type: event.target.value }))} /></label>
        <label><span>% chi trả</span><input type="number" value={form.coverage_percent} onChange={(event) => setForm((current) => ({ ...current, coverage_percent: event.target.value }))} /></label>
        <label><span>Từ ngày</span><input type="date" value={form.valid_from} onChange={(event) => setForm((current) => ({ ...current, valid_from: event.target.value }))} /></label>
        <label><span>Đến ngày</span><input type="date" value={form.valid_to} onChange={(event) => setForm((current) => ({ ...current, valid_to: event.target.value }))} /></label>
        <button type="button" className="reception-btn reception-btn--primary" onClick={() => run('add')}><Plus size={16} /><span>Thêm bảo hiểm</span></button>
      </div>
      <InsurancePolicyTable policies={policies} onAction={run} />
    </section>
  );
}

function InsurancePolicyTable({ policies, onAction, includeRequestMoreInfo = false }) {
  return (
    <SimpleTable
      columns={['Bệnh nhân', 'Số thẻ', 'Payer', 'Hiệu lực', 'Verify', 'Ảnh thẻ', 'Action']}
      rows={policies.map((item) => {
        const patient = normalizePatient(item.patient || item.patient_id);
        return [
          patient.patient_id ? `${patient.patient_code} - ${patient.full_name}` : '--',
          item.policy_no || '--',
          item.payer_name || '--',
          `${formatDate(item.valid_from)} - ${formatDate(item.valid_to)}`,
          <span className={`reception-status-badge is-${statusTone(item.verification_status)}`}>{item.verification_status || '--'}</span>,
          `${item.front_card_attachment_id ? 'Front' : 'Thiếu front'} / ${item.back_card_attachment_id ? 'Back' : 'Thiếu back'}`,
          <div className="reception-row-actions is-compact">
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction?.('verify', item)}>Verify</button>
            <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction?.('reject', item)}>Reject</button>
            {includeRequestMoreInfo ? (
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction?.('more', item)}>Yêu cầu bổ sung</button>
            ) : (
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onAction?.('cancel', item)}>Cancel</button>
            )}
          </div>,
        ];
      })}
    />
  );
}

function SimpleTable({ columns, rows }) {
  return (
    <div className="reception-patient-admin-table">
      <table>
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) => <td key={`${rowIndex}-${columns[index]}`}>{cell || '--'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <div className="reception-empty-panel reception-empty-panel--compact">Không có dữ liệu.</div> : null}
    </div>
  );
}

function ProfileChangesPage({ mode, onNavigate, onSelectPatient }) {
  const [state, setState] = useState({ loading: false, error: '', items: [], summary: null, success: '' });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const [summary, list] = await Promise.all([
        receptionPatientAdminApi.profileChangeSummary().catch(() => null),
        receptionPatientAdminApi.profileChangeRequests({ status: mode === 'patients-edit-requests' ? 'pending' : '', limit: 50 }),
      ]);
      setState({ loading: false, error: '', items: getItems(list), summary, success: '' });
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không tải được yêu cầu cập nhật.'), items: [], summary: null, success: '' });
    }
  }

  async function run(action, item) {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    const requestId = idOf(item, ['request_id', 'profile_change_request_id']);
    try {
      if (action === 'approve') await receptionPatientAdminApi.approveProfileChange(requestId, { note: 'Approved from reception UI' });
      if (action === 'reject') await receptionPatientAdminApi.rejectProfileChange(requestId, { reason: 'Rejected from reception UI' });
      if (action === 'more') await receptionPatientAdminApi.requestMoreInfoProfileChange(requestId, { reason: 'Cần bổ sung tài liệu xác minh.' });
      if (action === 'assign') await receptionPatientAdminApi.assignProfileChange(requestId, {});
      setState((current) => ({ ...current, loading: false, success: 'Đã cập nhật request.' }));
      load();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không xử lý được request.') }));
    }
  }

  useEffect(() => {
    load();
  }, [mode]);

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} right={<button type="button" className="reception-btn reception-btn--ghost" onClick={load}><RefreshCw size={16} /><span>Làm mới</span></button>} />
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <KpiStrip items={[
        { label: 'Tổng request', value: formatInteger(getTotal(state.summary, state.items.length)), icon: ClipboardList, tone: 'info', hint: 'Theo backend summary/list' },
        { label: 'Pending', value: formatInteger(state.items.filter((item) => item.status === 'pending').length), icon: AlertTriangle, tone: 'warning', hint: 'Chờ duyệt' },
        { label: 'Identity', value: formatInteger(state.items.filter((item) => item.change_type === 'identity').length), icon: IdCard, tone: 'danger', hint: 'Rủi ro cao' },
        { label: 'Đã tải', value: formatInteger(state.items.length), icon: CheckCircle2, tone: 'success', hint: 'Dòng hiện tại' },
      ]} />
      <SimpleTable
        columns={['Bệnh nhân', 'Loại', 'Trước', 'Sau', 'Nguồn', 'Trạng thái', 'Ngày gửi', 'Action']}
        rows={state.items.map((item) => {
          const patient = normalizePatient(item.patient || item.patient_id);
          return [
            patient.patient_id ? <button type="button" className="reception-link-button" onClick={() => onSelectPatient?.(patient)}>{patient.patient_code} - {patient.full_name}</button> : item.patient_id || '--',
            item.change_type,
            stringifyShort(item.old_value_snapshot),
            stringifyShort(item.new_value),
            item.requested_by_actor?.actor_type || item.source || '--',
            <span className={`reception-status-badge is-${statusTone(item.status)}`}>{item.status}</span>,
            formatDateTime(item.created_at),
            <div className="reception-row-actions is-compact">
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('approve', item)}>Duyệt</button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('reject', item)}>Từ chối</button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('more', item)}>Bổ sung</button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('assign', item)}>Assign</button>
            </div>,
          ];
        })}
      />
    </div>
  );
}

function MissingPersonalInfoPage({ mode, onNavigate, onSelectPatient }) {
  const [state, setState] = useState({ loading: false, error: '', items: [], selected: null, success: '' });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const payload = await receptionPatientAdminApi.listPatients({ limit: 100, page: 1, sort_by: 'updated_at', sort_order: 'desc' });
      const items = getItems(payload).map(normalizePatient).map((patient) => ({ patient, missing: missingFieldsFor(patient) })).filter((item) => item.missing.length);
      setState((current) => ({ ...current, loading: false, items }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không tải được danh sách hồ sơ thiếu.') }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} right={<button type="button" className="reception-btn reception-btn--ghost" onClick={load}><RefreshCw size={16} /><span>Làm mới</span></button>} />
      <InlineState loading={state.loading} error={state.error} success={state.success} note="Chưa có PatientCompletenessTask backend; danh sách này được tính từ dữ liệu Patient thật và action bổ sung dùng PATCH /patients/:id." />
      <KpiStrip items={[
        { label: 'Hồ sơ thiếu', value: formatInteger(state.items.length), icon: ShieldAlert, tone: 'warning', hint: 'Tính từ Patient' },
        { label: 'Thiếu SĐT', value: formatInteger(state.items.filter((item) => item.missing.includes('SĐT')).length), icon: Phone, tone: 'danger', hint: 'Ảnh hưởng nhắc lịch' },
        { label: 'Thiếu CCCD', value: formatInteger(state.items.filter((item) => item.missing.includes('CCCD/CMND')).length), icon: IdCard, tone: 'warning', hint: 'Định danh' },
        { label: 'Thiếu liên hệ khẩn cấp', value: formatInteger(state.items.filter((item) => item.missing.includes('Liên hệ khẩn cấp')).length), icon: Users, tone: 'info', hint: 'Cần bổ sung' },
      ]} />
      <SimpleTable
        columns={['Bệnh nhân', 'Thiếu gì', 'Mức độ', 'Cập nhật cuối', 'Action']}
        rows={state.items.map(({ patient, missing }) => [
          <button type="button" className="reception-link-button" onClick={() => onSelectPatient?.(patient)}>{patient.patient_code} - {patient.full_name}</button>,
          missing.join(', '),
          missing.includes('CCCD/CMND') || missing.includes('Ngày sinh') ? 'Critical' : 'High',
          formatDateTime(patient.updated_at || patient.created_at),
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => setState((current) => ({ ...current, selected: patient }))}><Edit3 size={15} /><span>Cập nhật nhanh</span></button>,
        ])}
      />
      {state.selected ? <QuickPatientPatch patient={state.selected} onClose={() => setState((current) => ({ ...current, selected: null }))} onSaved={() => { setState((current) => ({ ...current, selected: null, success: 'Đã bổ sung hồ sơ.' })); load(); }} /> : null}
    </div>
  );
}

function QuickPatientPatch({ patient, onClose, onSaved }) {
  const [form, setForm] = useState(patient);
  const [state, setState] = useState({ loading: false, error: '' });
  async function save(event) {
    event.preventDefault();
    setState({ loading: true, error: '' });
    try {
      await receptionPatientAdminApi.updatePatient(patient.patient_id, form);
      onSaved?.();
    } catch (error) {
      setState({ loading: false, error: getReceptionPatientAdminError(error, 'Không lưu được bổ sung.') });
    }
  }
  return (
    <aside className="reception-patient-quick-drawer">
      <div className="reception-patient-quick-drawer__header">
        <div><strong>Bổ sung nhanh</strong><small>{patient.patient_code} - {patient.full_name}</small></div>
        <button type="button" onClick={onClose}><XCircle size={20} /></button>
      </div>
      <form className="reception-form-grid reception-form-grid--single" onSubmit={save}>
        <InlineState loading={state.loading} error={state.error} />
        {['phone', 'email', 'national_id', 'address', 'emergency_contact_name', 'emergency_contact_phone'].map((field) => (
          <label key={field}><span>{field}</span><input value={form[field] || ''} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} /></label>
        ))}
        <button type="submit" className="reception-btn reception-btn--primary">Lưu bổ sung</button>
      </form>
    </aside>
  );
}

function MissingDocumentsPage({ mode, onNavigate, onSelectPatient }) {
  const [state, setState] = useState({ loading: false, error: '', items: [], success: '' });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const payload = await receptionPatientAdminApi.missingDocuments({ limit: 80 });
      setState((current) => ({ ...current, loading: false, items: getItems(payload) }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không tải được missing documents.') }));
    }
  }

  async function run(action, item) {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    const taskId = idOf(item, ['task_id', 'missing_document_task_id']);
    try {
      if (action === 'assign') await receptionPatientAdminApi.assignMissingDocument(taskId, {});
      if (action === 'waive') await receptionPatientAdminApi.waiveMissingDocument(taskId, { reason: 'Waived from reception UI' });
      if (action === 'resolve') await receptionPatientAdminApi.resolveMissingDocument(taskId, { note: 'Resolved from reception UI' });
      if (action === 'recompute') await receptionPatientAdminApi.recomputeMissingDocuments({});
      setState((current) => ({ ...current, loading: false, success: 'Đã cập nhật MissingDocumentTask.' }));
      load();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không xử lý được task.') }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} right={<button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('recompute', {})}><RefreshCw size={16} /><span>Recompute</span></button>} />
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <KpiStrip items={[
        { label: 'Tổng thiếu giấy tờ', value: formatInteger(state.items.length), icon: FileText, tone: 'warning', hint: 'MissingDocumentTask' },
        { label: 'Overdue', value: formatInteger(state.items.filter((item) => item.status === 'overdue').length), icon: AlertTriangle, tone: 'danger', hint: 'Quá hạn' },
        { label: 'Critical', value: formatInteger(state.items.filter((item) => item.severity === 'critical').length), icon: ShieldAlert, tone: 'danger', hint: 'Ưu tiên cao' },
        { label: 'Đã assign', value: formatInteger(state.items.filter((item) => item.assigned_to).length), icon: UserCheck, tone: 'success', hint: 'Có phụ trách' },
      ]} />
      <SimpleTable
        columns={['Mức độ', 'Bệnh nhân', 'Loại giấy tờ', 'Module', 'Liên quan', 'Hạn xử lý', 'Trạng thái', 'Action']}
        rows={state.items.map((item) => {
          const patient = normalizePatient(item.patient || item.patient_id);
          return [
            item.severity,
            patient.patient_id ? <button type="button" className="reception-link-button" onClick={() => onSelectPatient?.(patient)}>{patient.patient_code} - {patient.full_name}</button> : item.patient_id || '--',
            item.expected_file_label || item.required_category,
            item.module,
            item.entity_title || item.entity_code || item.entity_type,
            formatDateTime(item.due_at),
            <span className={`reception-status-badge is-${statusTone(item.status)}`}>{item.status}</span>,
            <div className="reception-row-actions is-compact">
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('assign', item)}>Assign</button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('resolve', item)}>Resolve</button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('waive', item)}>Waive</button>
            </div>,
          ];
        })}
      />
    </div>
  );
}

function MissingInsurancePage({ mode, onNavigate }) {
  const [state, setState] = useState({ loading: false, error: '', policies: [], submissions: [], summary: null, success: '' });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const [summary, missingCard, submissions] = await Promise.all([
        receptionPatientAdminApi.insurancePolicySummary({ missing_card: 'true' }).catch(() => null),
        receptionPatientAdminApi.insurancePolicies({ limit: 60, missing_card: 'true' }),
        receptionPatientAdminApi.insuranceSubmissions({ limit: 40 }).catch(() => ({ items: [] })),
      ]);
      setState({ loading: false, error: '', policies: getItems(missingCard), submissions: getItems(submissions), summary, success: '' });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không tải được worklist bảo hiểm.') }));
    }
  }

  async function run(action, policy) {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    const policyId = idOf(policy, ['policy_id', 'insurance_policy_id']);
    try {
      if (action === 'verify') await receptionPatientAdminApi.verifyInsuranceSubmission(policyId, {});
      if (action === 'reject') await receptionPatientAdminApi.rejectInsuranceSubmission(policyId, { reason: 'Rejected from reception missing insurance' });
      if (action === 'more') await receptionPatientAdminApi.requestMoreInfoInsurance(policyId, { reason: 'Cần bổ sung ảnh thẻ bảo hiểm.' });
      setState((current) => ({ ...current, loading: false, success: 'Đã cập nhật bảo hiểm.' }));
      load();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không xử lý được bảo hiểm.') }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} right={<button type="button" className="reception-btn reception-btn--ghost" onClick={load}><RefreshCw size={16} /><span>Làm mới</span></button>} />
      <InlineState loading={state.loading} error={state.error} success={state.success} note="Backend chưa có endpoint bệnh nhân không có policy; màn này dùng insurance policy/submission thật cho pending, missing card và hết hạn." />
      <KpiStrip items={[
        { label: 'Policy thiếu ảnh', value: formatInteger(state.policies.length), icon: CreditCard, tone: 'warning', hint: 'missing_card=true' },
        { label: 'Submission', value: formatInteger(state.submissions.length), icon: FileText, tone: 'info', hint: 'Portal submissions' },
        { label: 'Pending verify', value: formatInteger([...state.policies, ...state.submissions].filter((item) => item.verification_status === 'pending').length), icon: AlertTriangle, tone: 'danger', hint: 'Cần duyệt' },
        { label: 'Expired', value: formatInteger(state.policies.filter((item) => item.valid_to && new Date(item.valid_to) < new Date()).length), icon: CalendarDays, tone: 'danger', hint: 'Hết hạn' },
      ]} />
      <InsurancePolicyTable policies={[...state.policies, ...state.submissions]} onAction={run} includeRequestMoreInfo />
    </div>
  );
}

function UnverifiedContactPage({ mode, onNavigate }) {
  const [state, setState] = useState({ loading: false, error: '', accounts: [], patients: [], success: '' });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const [accounts, patients] = await Promise.all([
        receptionPatientAdminApi.listPortalAccounts({ limit: 80 }).catch(() => ({ items: [] })),
        receptionPatientAdminApi.listPatients({ limit: 80 }),
      ]);
      setState({
        loading: false,
        error: '',
        accounts: getItems(accounts).filter((item) => !item.email_verified || !item.phone_verified_at),
        patients: getItems(patients).map(normalizePatient).filter((patient) => !patient.phone || !patient.email),
        success: '',
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không tải được danh sách contact verification.') }));
    }
  }

  async function resend(account) {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      await receptionPatientAdminApi.resendPortalVerification(idOf(account, ['account_id', 'patient_account_id']));
      setState((current) => ({ ...current, loading: false, success: 'Đã gửi lại xác minh portal.' }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không gửi lại xác minh được.') }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} right={<button type="button" className="reception-btn reception-btn--ghost" onClick={load}><RefreshCw size={16} /><span>Làm mới</span></button>} />
      <InlineState loading={state.loading} error={state.error} success={state.success} note="Patient contact verification chưa có workflow DB riêng; portal account resend verification là action thật đang có." />
      <KpiStrip items={[
        { label: 'Portal chưa verified', value: formatInteger(state.accounts.length), icon: UserCheck, tone: 'warning', hint: 'PatientAccount' },
        { label: 'Thiếu SĐT/email', value: formatInteger(state.patients.length), icon: Mail, tone: 'danger', hint: 'Patient contact' },
        { label: 'Không có SĐT', value: formatInteger(state.patients.filter((item) => !item.phone).length), icon: Phone, tone: 'danger', hint: 'Cần cập nhật' },
        { label: 'Không có email', value: formatInteger(state.patients.filter((item) => !item.email).length), icon: Mail, tone: 'warning', hint: 'Có thể đánh dấu không dùng email sau' },
      ]} />
      <SimpleTable
        columns={['Username', 'Email', 'Phone', 'Email verified', 'Phone verified', 'Status', 'Action']}
        rows={state.accounts.map((item) => [
          item.username || '--',
          item.email || '--',
          item.phone || '--',
          item.email_verified ? 'Có' : 'Chưa',
          item.phone_verified_at ? 'Có' : 'Chưa',
          item.status || '--',
          <button type="button" className="reception-btn reception-btn--ghost" onClick={() => resend(item)}><Send size={15} /><span>Gửi xác minh</span></button>,
        ])}
      />
    </div>
  );
}

function UploadedDocumentsPage({ mode, onNavigate, onSelectPatient }) {
  const [state, setState] = useState({ loading: false, error: '', summary: null, items: [], success: '' });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      const [summary, list] = await Promise.all([
        receptionPatientAdminApi.documentsSummary().catch(() => null),
        receptionPatientAdminApi.documents({ limit: 80, review_status: 'pending' }),
      ]);
      setState({ loading: false, error: '', summary, items: getItems(list), success: '' });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không tải được tài liệu.') }));
    }
  }

  async function run(action, item) {
    setState((current) => ({ ...current, loading: true, error: '', success: '' }));
    const documentId = idOf(item, ['document_id', 'attachment_id']);
    try {
      if (action === 'approve') await receptionPatientAdminApi.approveDocument(documentId, { note: 'Approved from reception UI' });
      if (action === 'reject') await receptionPatientAdminApi.rejectDocument(documentId, { reason: 'Rejected from reception UI' });
      if (action === 'rescan') await receptionPatientAdminApi.rescanDocument(documentId, {});
      if (action === 'release') await receptionPatientAdminApi.releaseDocument(documentId, {});
      if (action === 'revoke') await receptionPatientAdminApi.revokeDocumentRelease(documentId, {});
      setState((current) => ({ ...current, loading: false, success: 'Đã cập nhật tài liệu.' }));
      load();
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: getReceptionPatientAdminError(error, 'Không xử lý được tài liệu.') }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="reception-patient-page">
      <PageHeader mode={mode} onNavigate={onNavigate} right={<button type="button" className="reception-btn reception-btn--ghost" onClick={load}><RefreshCw size={16} /><span>Làm mới</span></button>} />
      <InlineState loading={state.loading} error={state.error} success={state.success} />
      <KpiStrip items={[
        { label: 'Tài liệu chờ duyệt', value: formatInteger(state.items.length), icon: FileText, tone: 'warning', hint: 'review_status=pending' },
        { label: 'Scan pending', value: formatInteger(state.items.filter((item) => item.scan_status === 'pending').length), icon: RefreshCw, tone: 'info', hint: 'Antivirus scan' },
        { label: 'Scan lỗi', value: formatInteger(state.items.filter((item) => ['failed', 'infected'].includes(item.scan_status)).length), icon: AlertTriangle, tone: 'danger', hint: 'Cần xử lý' },
        { label: 'Released', value: formatInteger(state.items.filter((item) => item.released_to_patient).length), icon: CheckCircle2, tone: 'success', hint: 'Đã release' },
      ]} />
      <SimpleTable
        columns={['Tài liệu', 'Bệnh nhân', 'Loại', 'Nguồn', 'Scan', 'Review', 'Released', 'Ngày gửi', 'Action']}
        rows={state.items.map((item) => {
          const patient = normalizePatient(item.patient || item.patient_id);
          return [
            item.original_name || item.file_name || item.title || '--',
            patient.patient_id ? <button type="button" className="reception-link-button" onClick={() => onSelectPatient?.(patient)}>{patient.patient_code} - {patient.full_name}</button> : item.patient_id || '--',
            item.category || item.document_type || '--',
            item.source || item.uploaded_by_actor_type || '--',
            <span className={`reception-status-badge is-${statusTone(item.scan_status)}`}>{item.scan_status || '--'}</span>,
            <span className={`reception-status-badge is-${statusTone(item.review_status)}`}>{item.review_status || '--'}</span>,
            item.released_to_patient ? 'Có' : '--',
            formatDateTime(item.created_at || item.uploaded_at),
            <div className="reception-row-actions is-compact">
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('approve', item)}>Duyệt</button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('reject', item)}>Từ chối</button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('rescan', item)}>Rescan</button>
              <button type="button" className="reception-btn reception-btn--ghost" onClick={() => run('release', item)}>Release</button>
            </div>,
          ];
        })}
      />
    </div>
  );
}

function stringifyShort(value) {
  if (value === undefined || value === null || value === '') return '--';
  if (typeof value === 'string') return value.length > 70 ? `${value.slice(0, 70)}...` : value;
  const text = JSON.stringify(value);
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

export function ReceptionPatientsPanel({ mode = 'patients-search', onNavigate, onSelectPatient }) {
  if (mode === 'patients-search') return <SearchPatientsPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-qr-scan') return <QrScanPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-identity-lookup') return <IdentityLookupPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-duplicate-check') return <DuplicateCheckPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-duplicate-review') return <DuplicateCasesPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-recent-lookups') return <RecentLookupsPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-create') return <CreatePatientPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (ADMIN_MODES.has(mode)) return <PatientAdminPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-profile-update-requests' || mode === 'patients-edit-requests') return <ProfileChangesPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-missing-personal-info') return <MissingPersonalInfoPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-missing-documents') return <MissingDocumentsPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-missing-insurance') return <MissingInsurancePage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-unverified-contact') return <UnverifiedContactPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  if (mode === 'patients-uploaded-documents') return <UploadedDocumentsPage mode={mode} onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
  return <SearchPatientsPage mode="patients-search" onNavigate={onNavigate} onSelectPatient={onSelectPatient} />;
}
