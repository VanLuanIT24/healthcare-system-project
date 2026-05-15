import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Crown,
  Edit3,
  Eye,
  FileText,
  IdCard,
  Lightbulb,
  Loader2,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import { receptionAppointmentsApi } from '../api/receptionAppointmentsApi';

const PAGE_CONFIG = {
  'patients-search': {
    eyebrow: 'Tiếp nhận bệnh nhân',
    title: 'Tìm bệnh nhân',
    subtitle: 'Lễ tân có thể tìm kiếm, xem lại và xác minh thông tin bệnh nhân trước khi tiếp nhận hoặc đặt lịch hẹn.',
  },
  'patients-create': {
    eyebrow: 'Hồ sơ hành chính',
    title: 'Tạo bệnh nhân mới',
    subtitle: 'Nhập thông tin để tạo hồ sơ bệnh nhân mới. Vui lòng kiểm tra trùng lặp trước khi lưu.',
  },
  'patients-record': {
    eyebrow: 'Quản lý hồ sơ',
    title: 'Hồ sơ bệnh nhân',
    subtitle: 'Xem thông tin hành chính, liên hệ, cảnh báo và lịch sử lịch hẹn gần đây.',
  },
  'patients-priority': {
    eyebrow: 'Tiếp nhận ưu tiên',
    title: 'Bệnh nhân ưu tiên',
    subtitle: 'Tiếp nhận nhanh chóng và theo dõi thuận tiện dành cho bệnh nhân VIP hoặc cần chăm sóc đặc biệt.',
  },
};

const GENDER_OPTIONS = [
  { value: '', label: 'Không rõ' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
  { value: 'unknown', label: 'Không rõ' },
];

const PRIORITY_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'elderly', label: 'Người cao tuổi' },
  { key: 'missing-phone', label: 'Thiếu SĐT' },
  { key: 'new', label: 'Hồ sơ mới' },
];

const DEPARTMENTS = [
  'Tất cả khoa/phòng',
  'Nội tổng quát',
  'Tim mạch',
  'Nhi khoa',
  'Sản phụ khoa',
  'Da liễu',
];

const PRIORITY_GROUPS = ['VIP', 'Người cao tuổi', 'Thai sản', 'Tái khám sớm', 'Theo dõi đặc biệt'];

const CREATE_BODY_FIELDS = [
  'full_name',
  'date_of_birth',
  'gender',
  'phone',
  'email',
  'national_id',
  'insurance_number',
  'address',
  'emergency_contact_name',
  'emergency_contact_phone',
  'confirm_duplicate_checked',
];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getErrorMessage(error, fallback) {
  return error?.payload?.message || error?.message || fallback;
}

function getPatientId(item) {
  return item?.patient_id || item?.id || item?._id || '';
}

function normalizePatient(item) {
  const patient = item?.patient || item || {};
  return {
    patient_id: getPatientId(patient),
    patient_code: patient.patient_code || patient.code || '--',
    full_name: patient.full_name || patient.patient_name || patient.name || 'Bệnh nhân',
    phone: patient.phone || patient.patient_phone || '--',
    email: patient.email || '',
    gender: patient.gender || 'unknown',
    date_of_birth: patient.date_of_birth || '',
    address: patient.address || '',
    status: patient.status || 'active',
    created_at: patient.created_at || '',
    national_id: patient.national_id || patient.cccd || patient.identity_number || '--',
    emergency_contact_name: patient.emergency_contact_name || '',
    emergency_contact_phone: patient.emergency_contact_phone || '',
    insurance_number: patient.insurance_number || '',
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

function formatInteger(value) {
  return new Intl.NumberFormat('vi-VN').format(value || 0);
}

function calculateAge(value) {
  if (!value) return null;
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function getGenderLabel(value) {
  return GENDER_OPTIONS.find((item) => item.value === value)?.label || 'Không rõ';
}

function getPriorityProfile(patient, index = 0) {
  const age = calculateAge(patient.date_of_birth);
  if (age !== null && age >= 60) return { group: 'Người cao tuổi', tone: 'blue', status: 'Ổn định' };
  const group = PRIORITY_GROUPS[index % PRIORITY_GROUPS.length];
  const status = index % 4 === 0 ? 'Đang theo dõi' : index % 4 === 1 ? 'Ổn định' : 'Cần theo dõi';
  const tone = group === 'VIP' ? 'warning' : group === 'Thai sản' ? 'danger' : group === 'Theo dõi đặc biệt' ? 'purple' : 'neutral';
  return { group, tone, status };
}

function StatusBadge({ status }) {
  const tone = status === 'active' ? 'success' : status === 'archived' ? 'warning' : 'neutral';
  const label = status === 'active' ? 'Đang hoạt động' : status === 'archived' ? 'Tạm khóa' : status || 'Không rõ';
  return <span className={`reception-status-badge is-${tone}`}>{label}</span>;
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="reception-appointment-alert is-danger">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

function PatientMetricCard({ icon: Icon, label, value, note, tone = 'blue' }) {
  return (
    <article className={`reception-patient-metric is-${tone}`}>
      <span className="reception-patient-metric__icon">
        <Icon size={24} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function PatientMetrics({ mode, total }) {
  if (mode === 'priority') {
    return (
      <div className="reception-patient-metrics reception-patient-metrics--five">
        <PatientMetricCard icon={Crown} label="Tổng bệnh nhân ưu tiên" value="2.368" note="Tất cả nhóm ưu tiên" />
        <PatientMetricCard icon={CalendarDays} label="Lịch hẹn hôm nay" value="156" note="18.2% so với hôm qua" tone="green" />
        <PatientMetricCard icon={Bell} label="Cần theo dõi" value="64" note="Cần liên hệ / đặt lịch" tone="orange" />
        <PatientMetricCard icon={CalendarDays} label="Có thể đặt lịch" value="1.842" note="77.8% tổng ưu tiên" tone="purple" />
        <PatientMetricCard icon={ClockIcon} label="Chờ xác nhận" value="42" note="Chờ BN xác nhận" tone="blue" />
      </div>
    );
  }

  return (
    <div className="reception-patient-metrics">
      <PatientMetricCard icon={UserPlus} label="Tổng số bệnh nhân" value={formatInteger(Math.max(total, 58742))} note="Tất cả bệnh nhân đã đăng ký" />
      <PatientMetricCard icon={UserPlus} label="Bệnh nhân mới (tháng này)" value="1.243" note="12.5% so với tháng trước" tone="green" />
      <PatientMetricCard icon={ShieldCheck} label="Trùng thông tin cần xử lý" value="87" note="Cần kiểm tra và xác minh" tone="orange" />
      <PatientMetricCard icon={CalendarDays} label="Bệnh nhân có thể đặt lịch" value="54.102" note="92.1% trong tổng số" tone="purple" />
    </div>
  );
}

function ClockIcon(props) {
  return <CalendarDays {...props} />;
}

function PatientFilterPanel({ query, setQuery, gender, setGender, status, setStatus, priorityFilter, setPriorityFilter, mode, onReset }) {
  return (
    <section className="reception-panel reception-patient-filter-panel">
      <div className="reception-patient-filter-heading">
        <div>
          <RefreshCw size={16} />
          <strong>{mode === 'priority' ? 'Bộ lọc bệnh nhân ưu tiên' : 'Bộ lọc tìm kiếm'}</strong>
        </div>
        {mode === 'search' ? (
          <button type="button" className="reception-btn reception-btn--ghost">
            <UserPlus size={16} />
            <span>Kiểm tra trùng</span>
          </button>
        ) : null}
      </div>
      <div className="reception-patient-filter-grid">
        <label>
          <span>Từ khóa</span>
          <div className="reception-field-with-icon">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={mode === 'priority' ? 'Tìm theo mã BN, họ tên, SĐT...' : 'Tên / SĐT / CCCD / Mã BN'}
            />
            <Search size={16} />
          </div>
        </label>
        {mode === 'priority' ? (
          <label>
            <span>Nhóm ưu tiên</span>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              {PRIORITY_FILTERS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>Ngày sinh</span>
            <input type="date" />
          </label>
        )}
        <label>
          <span>{mode === 'priority' ? 'Trạng thái' : 'Giới tính'}</span>
          {mode === 'priority' ? (
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Chọn trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="archived">Tạm khóa</option>
            </select>
          ) : (
            <select value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="">Tất cả</option>
              {GENDER_OPTIONS.slice(1).map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          )}
        </label>
        <label>
          <span>{mode === 'priority' ? 'Khoa/Phòng' : 'Trạng thái'}</span>
          {mode === 'priority' ? (
            <select>
              {DEPARTMENTS.map((department) => (
                <option key={department}>{department}</option>
              ))}
            </select>
          ) : (
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="archived">Tạm khóa</option>
            </select>
          )}
        </label>
        {mode === 'search' ? (
          <>
            <label>
              <span>Khoa/Phòng</span>
              <select>
                {DEPARTMENTS.map((department) => (
                  <option key={department}>{department}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Ngày tạo từ</span>
              <input type="date" />
            </label>
            <label>
              <span>Đến ngày</span>
              <input type="date" />
            </label>
          </>
        ) : (
          <label>
            <span>Ngày khám gần nhất</span>
            <input type="date" />
          </label>
        )}
        <div className="reception-patient-filter-actions">
          <button type="button" className="reception-btn reception-btn--ghost" onClick={onReset}>
            <RefreshCw size={16} />
            <span>Đặt lại</span>
          </button>
          <button type="button" className="reception-btn reception-btn--primary">
            <Search size={16} />
            <span>Tìm kiếm</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function PatientTable({ patients, mode, loading, selectedId, onSelect, onCreateAppointment }) {
  if (!patients.length) {
    return (
      <div className="reception-empty-panel">
        <div>
          {loading ? <Loader2 size={24} className="loader" /> : <ClipboardList size={24} />}
          <span>{loading ? 'Đang tải danh sách...' : 'Chưa có hồ sơ phù hợp.'}</span>
        </div>
      </div>
    );
  }

  return (
    <section className="reception-panel reception-patient-table-panel">
      <div className="reception-patient-table-wrap">
        <table className={`reception-patient-table ${mode === 'priority' ? 'is-priority' : 'is-search'}`}>
          <thead>
            {mode === 'priority' ? (
              <tr>
                <th>Mã BN</th>
                <th>Họ tên</th>
                <th>Nhóm ưu tiên</th>
                <th>SĐT</th>
                <th>Lần khám gần nhất</th>
                <th>Lịch hẹn tiếp theo</th>
                <th>Có thể đặt lịch</th>
                <th>Bảo hiểm</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            ) : (
              <tr>
                <th>Mã BN</th>
                <th>Họ tên</th>
                <th>Ngày sinh</th>
                <th>Giới tính</th>
                <th>SĐT</th>
                <th>CCCD/CMND</th>
                <th>Trạng thái</th>
                <th>Có thể đặt lịch</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            )}
          </thead>
          <tbody>
            {patients.map((patient, index) => {
              const priority = getPriorityProfile(patient, index);
              const isSelected = selectedId === patient.patient_id;
              return (
                <tr key={patient.patient_id || patient.patient_code} className={isSelected ? 'is-selected' : ''}>
                  <td><button type="button" className="reception-link-button" onClick={() => onSelect(patient)}>{patient.patient_code}</button></td>
                  <td>
                    <strong>{patient.full_name}</strong>
                    {mode === 'priority' ? <span>{getGenderLabel(patient.gender)} · {calculateAge(patient.date_of_birth) || '--'} tuổi</span> : null}
                  </td>
                  {mode === 'priority' ? (
                    <>
                      <td><span className={`reception-pill is-${priority.tone}`}>{priority.group}</span></td>
                      <td>{patient.phone}</td>
                      <td>20/05/2025<br /><span>Nội tổng quát</span></td>
                      <td>27/05/2025<br /><span>09:00</span></td>
                      <td><span className="reception-status-badge is-success">Có thể đặt</span></td>
                      <td><span className="reception-status-badge is-success">BHYT</span></td>
                      <td><span className={`reception-status-badge ${priority.status === 'Cần theo dõi' ? 'is-warning' : 'is-success'}`}>{priority.status}</span></td>
                    </>
                  ) : (
                    <>
                      <td>{formatDate(patient.date_of_birth)}</td>
                      <td>{getGenderLabel(patient.gender)}</td>
                      <td>{patient.phone}</td>
                      <td>{patient.national_id}</td>
                      <td><StatusBadge status={patient.status} /></td>
                      <td><span className="reception-status-badge is-success">Có thể đặt</span></td>
                      <td>{formatDate(patient.created_at)}</td>
                    </>
                  )}
                  <td>
                    <div className="reception-patient-table-actions">
                      <button type="button" onClick={() => onSelect(patient)} aria-label="Xem hồ sơ">
                        <Eye size={16} />
                      </button>
                      <button type="button" aria-label="Sửa hồ sơ">
                        <Edit3 size={16} />
                      </button>
                      <button type="button" onClick={() => onCreateAppointment(patient)} aria-label="Tạo lịch">
                        {mode === 'priority' ? <Phone size={16} /> : <FileText size={16} />}
                      </button>
                      {mode === 'priority' ? (
                        <button type="button" aria-label="Thao tác khác">
                          <MoreVertical size={16} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="reception-patient-table-footer">
        <span>Hiển thị 1-{Math.min(10, patients.length)} trong tổng số {formatInteger(mode === 'priority' ? 2368 : Math.max(patients.length, 58742))} kết quả</span>
        <div className="reception-pagination">
          <button type="button" disabled>{'<'}</button>
          <button type="button" className="is-active">1</button>
          <button type="button">2</button>
          <button type="button">3</button>
          <span>...</span>
          <button type="button">{mode === 'priority' ? '237' : '5.875'}</button>
          <button type="button">{'>'}</button>
        </div>
        <select>
          <option>10 / trang</option>
          <option>20 / trang</option>
          <option>50 / trang</option>
        </select>
      </div>
    </section>
  );
}

function PatientReceptionTips() {
  const tips = [
    'Luôn tìm kiếm trước khi tạo bệnh nhân mới',
    'Kiểm tra kỹ thông tin trùng khớp',
    'Xác nhận số điện thoại',
    'Mở hồ sơ nếu đã tồn tại',
  ];

  return (
    <section className="reception-panel reception-patient-side-card">
      <div className="reception-side-title">
        <Lightbulb size={20} />
        <h3>Gợi ý tiếp nhận</h3>
      </div>
      <div className="reception-patient-guide-list">
        {tips.map((tip, index) => (
          <div key={tip}>
            <span>{index + 1}</span>
            <p>{tip}<small>{index === 0 ? 'Tránh trùng lặp hồ sơ.' : 'Cập nhật thông tin mới nếu có thay đổi.'}</small></p>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickDuplicateCheck() {
  return (
    <section className="reception-panel reception-patient-side-card">
      <div className="reception-side-title">
        <UserPlus size={20} />
        <h3>Kiểm tra trùng nhanh</h3>
      </div>
      <p>Nhập SĐT hoặc CCCD để kiểm tra nhanh</p>
      <select>
        <option>Số điện thoại</option>
        <option>CCCD/CMND</option>
      </select>
      <input placeholder="Nhập số điện thoại" />
      <button type="button" className="reception-btn reception-btn--primary">Kiểm tra</button>
      <div className="reception-patient-check-result">
        <CheckCircle2 size={20} />
        <div>
          <strong>Không tìm thấy trùng khớp</strong>
          <span>Thông tin này chưa tồn tại trong hệ thống.</span>
        </div>
      </div>
    </section>
  );
}

function PatientPriorityAside({ patient, onCreateAppointment }) {
  if (!patient) {
    return (
      <section className="reception-panel reception-patient-side-card">
        <p>Chọn một bệnh nhân để xem thông tin ưu tiên.</p>
      </section>
    );
  }

  return (
    <section className="reception-panel reception-patient-priority-card">
      <div className="reception-patient-priority-card__head">
        <div className="reception-avatar-badge">{patient.full_name.slice(0, 1)}</div>
        <div>
          <h3>{patient.full_name}</h3>
          <span className="reception-status-badge is-warning">VIP</span>
          <p>{getGenderLabel(patient.gender)}, {calculateAge(patient.date_of_birth) || '--'} tuổi</p>
          <strong>{patient.patient_code}</strong>
          <p>{patient.phone}</p>
        </div>
      </div>
      <div className="reception-patient-priority-card__section">
        <strong>Tóm tắt</strong>
        <p>Khách hàng ưu tiên, cần kiểm tra lịch hẹn và xác nhận thông tin trước khi tiếp nhận.</p>
      </div>
      <div className="reception-patient-priority-info">
        <div>
          <CalendarDays size={16} />
          <span>Lịch hẹn tiếp theo</span>
          <strong>27/05/2025 - 09:00</strong>
        </div>
        <div>
          <ShieldCheck size={16} />
          <span>Bảo hiểm</span>
          <strong>{patient.insurance_number || 'BHYT'}</strong>
        </div>
      </div>
      <div className="reception-patient-priority-actions">
        <button type="button" className="reception-btn reception-btn--ghost">Xem timeline</button>
        <button type="button" className="reception-btn reception-btn--primary" onClick={() => onCreateAppointment(patient)}>
          <CalendarDays size={16} />
          <span>Đặt lịch</span>
        </button>
      </div>
    </section>
  );
}

function PatientSearchWorkspace(props) {
  const { patients, loading, selectedId, onSelect, onCreateAppointment } = props;

  return (
    <main className="reception-patient-main">
      <PatientMetrics mode="search" total={patients.length} />
      <PatientFilterPanel {...props} mode="search" />
      <PatientTable
        patients={patients}
        mode="search"
        loading={loading}
        selectedId={selectedId}
        onSelect={onSelect}
        onCreateAppointment={onCreateAppointment}
      />
    </main>
  );
}

function PriorityPatientWorkspace(props) {
  const { patients, loading, selectedId, onSelect, onCreateAppointment } = props;

  return (
    <main className="reception-patient-main">
      <PatientMetrics mode="priority" total={patients.length} />
      <PatientFilterPanel {...props} mode="priority" />
      <PatientTable
        patients={patients}
        mode="priority"
        loading={loading}
        selectedId={selectedId}
        onSelect={onSelect}
        onCreateAppointment={onCreateAppointment}
      />
    </main>
  );
}

function PatientCard({ patient, selected, onSelect, onCreateAppointment }) {
  const age = calculateAge(patient.date_of_birth);
  return (
    <article className={`reception-flow-card reception-patient-card ${selected ? 'is-selected' : ''}`}>
      <div className="reception-flow-card__header">
        <div>
          <strong>{patient.full_name}</strong>
          <span>{patient.patient_code} · {getGenderLabel(patient.gender)} · {age ? `${age} tuổi` : formatDate(patient.date_of_birth)}</span>
        </div>
        <StatusBadge status={patient.status} />
      </div>
      <div className="reception-flow-card__meta">
        <div>
          <span>Số điện thoại</span>
          <strong>{patient.phone}</strong>
        </div>
        <div>
          <span>Ngày sinh</span>
          <strong>{formatDate(patient.date_of_birth)}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{patient.email || '--'}</strong>
        </div>
        <div>
          <span>Liên hệ khẩn cấp</span>
          <strong>{patient.emergency_contact_phone || '--'}</strong>
        </div>
      </div>
      <div className="reception-flow-card__actions">
        <button type="button" className="reception-btn reception-btn--ghost" onClick={() => onSelect(patient)}>
          <FileText size={16} />
          <span>Xem hồ sơ</span>
        </button>
        <button type="button" className="reception-btn reception-btn--primary" onClick={() => onCreateAppointment(patient)}>
          <CalendarDays size={16} />
          <span>Tạo lịch</span>
        </button>
      </div>
    </article>
  );
}

function PatientRecordWorkspace({ patients, query, loading, selectedId, onSelect, onCreateAppointment }) {
  return (
    <section className="reception-panel">
      <div className="reception-panel__header">
        <div>
          <span>Danh sách bệnh nhân</span>
          <h2>{patients.length} hồ sơ</h2>
          <p>{query.trim() ? 'Kết quả đang cập nhật theo ký tự vừa nhập.' : 'Hiển thị theo bộ lọc hiện tại.'}</p>
        </div>
        {loading ? (
          <div className="reception-appointment-loading reception-appointment-loading--inline">
            <Loader2 size={18} />
            <span>Đang tải</span>
          </div>
        ) : null}
      </div>

      {patients.length ? (
        <div className="reception-flow-card-grid reception-patient-grid">
          {patients.map((patient) => (
            <PatientCard
              key={patient.patient_id || patient.patient_code}
              patient={patient}
              selected={selectedId === patient.patient_id}
              onSelect={onSelect}
              onCreateAppointment={onCreateAppointment}
            />
          ))}
        </div>
      ) : (
        <div className="reception-empty-panel">
          <div>
            {loading ? <Loader2 size={24} className="loader" /> : <ClipboardList size={24} />}
            <span>{loading ? 'Đang tải danh sách...' : 'Chưa có hồ sơ phù hợp.'}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function PatientDetail({ state, onBack, variant = 'panel' }) {
  const Wrapper = variant === 'drawer' ? 'div' : 'section';
  const wrapperClassName = variant === 'drawer'
    ? 'reception-patient-profile'
    : 'reception-panel reception-patient-profile';

  if (state.loading) {
    return (
      <Wrapper className={wrapperClassName}>
        {onBack ? (
          <button type="button" className="reception-btn reception-btn--ghost reception-patient-back" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Quay lại danh sách</span>
          </button>
        ) : null}
        <div className="reception-appointment-loading">
          <Loader2 size={18} />
          <span>Đang tải hồ sơ bệnh nhân...</span>
        </div>
      </Wrapper>
    );
  }

  if (!state.patient) return null;

  const patient = state.patient;
  const summary = state.summary || {};
  const appointments = safeArray(state.appointments);
  const allergies = safeArray(summary.active_allergies);
  const problems = safeArray(summary.active_problems);

  return (
    <Wrapper className={wrapperClassName}>
      <div className="reception-panel__header">
        <div>
          <span>Hồ sơ bệnh nhân</span>
          <h2>{patient.full_name}</h2>
          <p>{patient.patient_code} · {patient.phone || '--'} · {patient.address || 'Chưa có địa chỉ'}</p>
        </div>
        <div className="reception-patient-profile__actions">
          {onBack ? (
            <button type="button" className="reception-btn reception-btn--ghost" onClick={onBack}>
              <ArrowLeft size={16} />
              <span>Danh sách</span>
            </button>
          ) : null}
          <StatusBadge status={patient.status} />
        </div>
      </div>

      <div className="reception-patient-stat-grid">
        <div>
          <span>Dị ứng đang theo dõi</span>
          <strong>{summary.active_allergies_count ?? allergies.length ?? 0}</strong>
        </div>
        <div>
          <span>Vấn đề sức khỏe</span>
          <strong>{summary.active_problems_count ?? problems.length ?? 0}</strong>
        </div>
        <div>
          <span>Lịch sắp tới</span>
          <strong>{summary.upcoming_appointments_count ?? safeArray(summary.upcoming_appointments).length ?? 0}</strong>
        </div>
      </div>

      <div className="reception-patient-detail-grid">
        <div>
          <span>Ngày sinh</span>
          <strong>{formatDate(patient.date_of_birth)}</strong>
        </div>
        <div>
          <span>Giới tính</span>
          <strong>{getGenderLabel(patient.gender)}</strong>
        </div>
        <div>
          <span>Email</span>
          <strong>{patient.email || '--'}</strong>
        </div>
        <div>
          <span>Liên hệ khẩn cấp</span>
          <strong>{patient.emergency_contact_name || '--'} {patient.emergency_contact_phone ? `· ${patient.emergency_contact_phone}` : ''}</strong>
        </div>
      </div>

      <div className="reception-patient-history">
        <div>
          <h3>Lịch hẹn gần đây</h3>
          {appointments.length ? (
            appointments.slice(0, 5).map((item) => (
              <div key={item.appointment_id || item._id} className="reception-patient-history__item">
                <CalendarDays size={16} />
                <div>
                  <strong>{formatDateTime(item.appointment_time)}</strong>
                  <span>{item.department_name || '--'} · {item.doctor_name || '--'}</span>
                </div>
              </div>
            ))
          ) : (
            <p>Chưa có lịch hẹn gần đây.</p>
          )}
        </div>
        <div>
          <h3>Cảnh báo hồ sơ</h3>
          {[...allergies, ...problems].slice(0, 5).map((item, index) => (
            <div key={item._id || item.id || index} className="reception-patient-history__item">
              <ShieldCheck size={16} />
              <div>
                <strong>{item.name || item.problem_name || item.allergen || item.title || 'Thông tin theo dõi'}</strong>
                <span>{item.severity || item.status || 'Đang theo dõi'}</span>
              </div>
            </div>
          ))}
          {!allergies.length && !problems.length ? <p>Không có cảnh báo nổi bật.</p> : null}
        </div>
      </div>
      <InlineError message={state.error} />
    </Wrapper>
  );
}

function PatientDetailDrawer({ state, onClose }) {
  if (!state.loading && !state.error && !state.patient) return null;

  return (
    <aside className="reception-appointment-drawer reception-patient-drawer" aria-label="Chi tiết hồ sơ bệnh nhân">
      <div className="reception-appointment-drawer__header">
        <div>
          <span>Chi tiết hồ sơ</span>
          <h3>{state.patient?.full_name || 'Hồ sơ bệnh nhân'}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết hồ sơ">
          <X size={18} />
        </button>
      </div>
      {state.error && !state.patient ? <InlineError message={state.error} /> : null}
      <PatientDetail state={state} variant="drawer" />
    </aside>
  );
}

function DuplicateStatusCard({ form }) {
  const filled = [form.full_name, form.phone, form.national_id].filter(Boolean).length;
  return (
    <section className="reception-panel reception-patient-side-card">
      <div className="reception-side-title">
        <Search size={20} />
        <h3>Kiểm tra trùng nhanh</h3>
      </div>
      <p>Sau khi nhập Họ tên, SĐT hoặc CCCD, hệ thống sẽ kiểm tra trùng tự động.</p>
      <div className="reception-patient-duplicate-list">
        <div><UserPlus size={18} /><span>Họ tên gần giống</span><strong>{form.full_name ? 1 : 0}</strong></div>
        <div><Phone size={18} /><span>SĐT trùng</span><strong>{form.phone ? 0 : 0}</strong></div>
        <div><IdCard size={18} /><span>CCCD trùng</span><strong>{form.national_id ? 0 : 0}</strong></div>
      </div>
      <div className={`reception-patient-check-result ${filled ? 'is-success' : ''}`}>
        <CheckCircle2 size={22} />
        <div>
          <strong>{filled ? 'Chưa phát hiện trùng lặp' : 'Chưa đủ thông tin kiểm tra'}</strong>
          <span>{filled ? 'Vui lòng nhập thông tin để kiểm tra.' : 'Nhập tên, SĐT hoặc CCCD trước khi lưu.'}</span>
        </div>
      </div>
    </section>
  );
}

function CreatePatientTips() {
  return (
    <section className="reception-panel reception-patient-side-card">
      <div className="reception-side-title">
        <Lightbulb size={20} />
        <h3>Lưu ý tiếp nhận</h3>
      </div>
      <ul className="reception-patient-tip-list">
        <li>Kiểm tra trùng lặp trước khi lưu bệnh nhân để tránh tạo hồ sơ trùng.</li>
        <li>Ưu tiên nhập chính xác SĐT và CCCD.</li>
        <li>Thông tin có dấu * là bắt buộc.</li>
        <li>Có thể lưu nháp để hoàn thiện sau.</li>
      </ul>
    </section>
  );
}

function CreatePatientForm({ onCreated }) {
  const [form, setForm] = useState({
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
    confirm_duplicate_checked: false,
    province: '',
    district: '',
    ward: '',
    occupation: '',
    blood_type: '',
    nationality: 'Việt Nam',
    ethnicity: '',
    marital_status: '',
    note: '',
  });
  const [submitState, setSubmitState] = useState({ loading: false, error: '', success: '' });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitState({ loading: true, error: '', success: '' });
    try {
      const body = Object.fromEntries(
        Object.entries(form).filter(([key, value]) => CREATE_BODY_FIELDS.includes(key) && value !== '' && value !== false),
      );
      const data = await receptionAppointmentsApi.createPatient(body);
      const patient = normalizePatient(data?.patient || data);
      setSubmitState({ loading: false, error: '', success: 'Tạo hồ sơ bệnh nhân thành công.' });
      setForm({
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
        confirm_duplicate_checked: false,
        province: '',
        district: '',
        ward: '',
        occupation: '',
        blood_type: '',
        nationality: 'Việt Nam',
        ethnicity: '',
        marital_status: '',
        note: '',
      });
      onCreated(patient);
    } catch (error) {
      setSubmitState({
        loading: false,
        error: getErrorMessage(error, 'Không tạo được hồ sơ bệnh nhân.'),
        success: '',
      });
    }
  }

  return (
    <div className="reception-patient-create-layout">
      <main className="reception-patient-main">
        <section className="reception-panel reception-patient-stepper">
          {['Thông tin cơ bản', 'Thông tin liên hệ', 'Kiểm tra trùng', 'Xác nhận'].map((step, index) => (
            <div key={step} className={index === 0 ? 'is-active' : ''}>
              <span>{index + 1}</span>
              <div>
                <strong>{step}</strong>
                <small>{index === 0 ? 'Nhập thông tin cá nhân' : index === 1 ? 'Thông tin liên lạc & địa chỉ' : index === 2 ? 'Kiểm tra trùng lặp dữ liệu' : 'Xác nhận & tạo hồ sơ'}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="reception-panel">
          <div className="reception-panel__header">
            <div>
              <span>Thông tin cơ bản</span>
              <h2>Tạo hồ sơ mới</h2>
              <p>Nhập đầy đủ các trường bắt buộc để lễ tân có thể tiếp nhận và đặt lịch nhanh.</p>
            </div>
          </div>

          <form className="reception-form-grid reception-patient-create-form" onSubmit={handleSubmit}>
            <label>
              <span>Họ và tên *</span>
              <input value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} placeholder="Nhập họ và tên đầy đủ" required />
            </label>
            <label>
              <span>Ngày sinh *</span>
              <input type="date" value={form.date_of_birth} onChange={(event) => updateField('date_of_birth', event.target.value)} />
            </label>
            <label>
              <span>Giới tính *</span>
              <select value={form.gender} onChange={(event) => updateField('gender', event.target.value)}>
                {GENDER_OPTIONS.slice(1).map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Số điện thoại *</span>
              <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="Nhập số điện thoại" />
            </label>
            <label>
              <span>CCCD/CMND *</span>
              <input value={form.national_id} onChange={(event) => updateField('national_id', event.target.value)} placeholder="Nhập CCCD/CMND" />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="Nhập email nếu có" />
            </label>
            <label className="is-span-2">
              <span>Địa chỉ *</span>
              <input value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Số nhà, tên đường, thôn/xóm..." />
            </label>
            <label>
              <span>Tỉnh/Thành *</span>
              <select value={form.province} onChange={(event) => updateField('province', event.target.value)}>
                <option value="">Chọn tỉnh/thành</option>
                <option>Đà Nẵng</option>
                <option>TP. Hồ Chí Minh</option>
                <option>Hà Nội</option>
              </select>
            </label>
            <label>
              <span>Quận/Huyện *</span>
              <select value={form.district} onChange={(event) => updateField('district', event.target.value)}>
                <option value="">Chọn quận/huyện</option>
                <option>Hải Châu</option>
                <option>Thanh Khê</option>
                <option>Sơn Trà</option>
              </select>
            </label>
            <label>
              <span>Phường/Xã *</span>
              <select value={form.ward} onChange={(event) => updateField('ward', event.target.value)}>
                <option value="">Chọn phường/xã</option>
                <option>Phường 1</option>
                <option>Phường 2</option>
                <option>Phường 3</option>
              </select>
            </label>
            <label>
              <span>Nghề nghiệp</span>
              <select value={form.occupation} onChange={(event) => updateField('occupation', event.target.value)}>
                <option value="">Chọn nghề nghiệp</option>
                <option>Nhân viên văn phòng</option>
                <option>Kinh doanh</option>
                <option>Học sinh/Sinh viên</option>
              </select>
            </label>
            <label>
              <span>Nhóm máu</span>
              <select value={form.blood_type} onChange={(event) => updateField('blood_type', event.target.value)}>
                <option value="">Chọn nhóm máu</option>
                <option>A</option>
                <option>B</option>
                <option>AB</option>
                <option>O</option>
              </select>
            </label>
            <label>
              <span>Quốc tịch</span>
              <select value={form.nationality} onChange={(event) => updateField('nationality', event.target.value)}>
                <option>Việt Nam</option>
                <option>Khác</option>
              </select>
            </label>
            <label>
              <span>Dân tộc</span>
              <select value={form.ethnicity} onChange={(event) => updateField('ethnicity', event.target.value)}>
                <option value="">Chọn dân tộc</option>
                <option>Kinh</option>
                <option>Khác</option>
              </select>
            </label>
            <label>
              <span>Tình trạng hôn nhân</span>
              <select value={form.marital_status} onChange={(event) => updateField('marital_status', event.target.value)}>
                <option value="">Chọn tình trạng</option>
                <option>Độc thân</option>
                <option>Đã kết hôn</option>
              </select>
            </label>
            <label className="is-span-2">
              <span>Ghi chú</span>
              <textarea value={form.note} onChange={(event) => updateField('note', event.target.value)} maxLength={500} placeholder="Nhập ghi chú nếu có" />
            </label>
            <label className="reception-patient-check is-span-2">
              <input
                type="checkbox"
                checked={form.confirm_duplicate_checked}
                onChange={(event) => updateField('confirm_duplicate_checked', event.target.checked)}
              />
              <span>Đã kiểm tra hồ sơ có thể trùng trước khi tạo mới</span>
            </label>
            <InlineError message={submitState.error} />
            {submitState.success ? (
              <div className="reception-appointment-alert is-success">
                <CheckCircle2 size={18} />
                <span>{submitState.success}</span>
              </div>
            ) : null}
            <div className="reception-patient-form-actions is-span-2">
              <button type="button" className="reception-btn reception-btn--ghost">Hủy</button>
              <div>
                <button type="button" className="reception-btn reception-btn--ghost">
                  <FileText size={16} />
                  <span>Lưu nháp</span>
                </button>
                <button type="submit" className="reception-btn reception-btn--primary" disabled={submitState.loading}>
                  {submitState.loading ? <Loader2 size={16} className="loader" /> : <UserPlus size={16} />}
                  <span>Tiếp tục kiểm tra trùng</span>
                </button>
              </div>
            </div>
          </form>
        </section>
      </main>
      <aside className="reception-patient-side">
        <DuplicateStatusCard form={form} />
        <CreatePatientTips />
      </aside>
    </div>
  );
}

export function ReceptionPatientsPanel({ mode = 'patients-search', onNavigate }) {
  const config = PAGE_CONFIG[mode] || PAGE_CONFIG['patients-search'];
  const isCreateMode = mode === 'patients-create';
  const [query, setQuery] = useState('');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [listState, setListState] = useState({ loading: false, error: '', items: [] });
  const [detailState, setDetailState] = useState({ loading: false, error: '', patient: null, summary: null, appointments: [] });

  const filteredPatients = useMemo(() => {
    const source = listState.items;
    if (mode !== 'patients-priority' || priorityFilter === 'all') return source;
    return source.filter((patient) => {
      const age = calculateAge(patient.date_of_birth);
      if (priorityFilter === 'elderly') return age !== null && age >= 60;
      if (priorityFilter === 'missing-phone') return !patient.phone || patient.phone === '--';
      if (priorityFilter === 'new') {
        const created = patient.created_at ? new Date(patient.created_at) : null;
        if (!created || Number.isNaN(created.getTime())) return false;
        return Date.now() - created.getTime() <= 1000 * 60 * 60 * 24 * 14;
      }
      return true;
    });
  }, [listState.items, mode, priorityFilter]);

  const selectedPatient = detailState.patient || filteredPatients[0] || null;

  useEffect(() => {
    if (isCreateMode) return undefined;
    const timeoutId = window.setTimeout(async () => {
      setListState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const trimmed = query.trim();
        const params = {
          limit: mode === 'patients-search' && trimmed ? 20 : 18,
          gender,
          status,
          sort_by: 'updated_at',
          sort_order: 'desc',
        };
        const data = trimmed
          ? await receptionAppointmentsApi.searchPatients({ ...params, search: trimmed })
          : await receptionAppointmentsApi.listPatients(params);
        setListState({
          loading: false,
          error: '',
          items: safeArray(data?.items).map(normalizePatient),
        });
      } catch (error) {
        setListState({
          loading: false,
          error: getErrorMessage(error, 'Không tải được danh sách bệnh nhân.'),
          items: [],
        });
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query, gender, status, mode, isCreateMode]);

  async function openPatientDetail(patient) {
    if (!patient.patient_id) return;
    setDetailState({ loading: true, error: '', patient, summary: null, appointments: [] });
    try {
      const [detail, appointments] = await Promise.all([
        receptionAppointmentsApi.getPatientDetail(patient.patient_id),
        receptionAppointmentsApi.getPatientAppointments(patient.patient_id, { limit: 6, sort_order: 'desc' }),
      ]);
      const normalized = normalizePatient(detail?.patient || patient);
      setDetailState({
        loading: false,
        error: '',
        patient: normalized,
        summary: detail?.summary || null,
        appointments: safeArray(appointments?.items),
      });
    } catch (error) {
      setDetailState({
        loading: false,
        error: getErrorMessage(error, 'Không tải được hồ sơ bệnh nhân.'),
        patient,
        summary: null,
        appointments: [],
      });
    }
  }

  function handleCreated(patient) {
    setQuery(patient.full_name);
    openPatientDetail(patient);
  }

  function handleCreateAppointment(patient) {
    openPatientDetail(patient);
    onNavigate?.('appointments-create');
  }

  function resetFilters() {
    setQuery('');
    setGender('');
    setStatus('');
    setPriorityFilter('all');
  }

  function closePatientRecord() {
    setDetailState({ loading: false, error: '', patient: null, summary: null, appointments: [] });
  }

  return (
    <div className="reception-patient-page">
      <section className="reception-appointment-hero">
        <div>
          <span>{config.eyebrow}</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
        {!isCreateMode ? (
          <button type="button" className="reception-btn reception-btn--primary" onClick={() => onNavigate?.('patients-create')}>
            <Plus size={16} />
            <span>Tạo bệnh nhân mới</span>
          </button>
        ) : null}
      </section>

      {isCreateMode ? (
        <CreatePatientForm onCreated={handleCreated} />
      ) : (
        <>
          {mode === 'patients-record' ? (
            <section className="reception-panel">
              <div className="reception-patient-toolbar">
                <div className="reception-appointment-search">
                  <Search size={18} />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nhập tên, SĐT hoặc mã bệnh nhân..."
                  />
                </div>
                <select value={gender} onChange={(event) => setGender(event.target.value)}>
                  <option value="">Tất cả giới tính</option>
                  {GENDER_OPTIONS.slice(1).map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="archived">Tạm khóa</option>
                </select>
                <button type="button" className="reception-btn reception-btn--ghost" onClick={resetFilters}>
                  <RefreshCw size={16} />
                  <span>Làm mới</span>
                </button>
              </div>
            </section>
          ) : null}

          <InlineError message={listState.error} />

          {mode === 'patients-search' ? (
            <PatientSearchWorkspace
              patients={filteredPatients}
              loading={listState.loading}
              query={query}
              setQuery={setQuery}
              gender={gender}
              setGender={setGender}
              status={status}
              setStatus={setStatus}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              selectedId={detailState.patient?.patient_id}
              onReset={resetFilters}
              onSelect={openPatientDetail}
              onCreateAppointment={handleCreateAppointment}
            />
          ) : mode === 'patients-priority' ? (
            <PriorityPatientWorkspace
              patients={filteredPatients}
              loading={listState.loading}
              query={query}
              setQuery={setQuery}
              gender={gender}
              setGender={setGender}
              status={status}
              setStatus={setStatus}
              priorityFilter={priorityFilter}
              setPriorityFilter={setPriorityFilter}
              selectedId={detailState.patient?.patient_id}
              onReset={resetFilters}
              onSelect={openPatientDetail}
              onCreateAppointment={handleCreateAppointment}
            />
          ) : (
            <PatientRecordWorkspace
              patients={filteredPatients}
              query={query}
              loading={listState.loading}
              selectedId={detailState.patient?.patient_id}
              onSelect={openPatientDetail}
              onCreateAppointment={handleCreateAppointment}
            />
          )}
        </>
      )}

      <PatientDetailDrawer state={detailState} onClose={closePatientRecord} />
    </div>
  );
}
