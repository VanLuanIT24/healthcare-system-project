import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Fingerprint,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { PasswordPolicyChecklist } from '../../../Auth/components/PasswordPolicyChecklist';
import { evaluatePasswordPolicy } from '../../../Auth/recovery/recoveryConfig';
import {
  createStaffAccount,
  generateStaffEmployeeCode,
  generateStaffUsername,
  getAssignableRoles,
  getDepartments,
  validateStaffUnique,
} from '../staffApi';
import { StaffSuccessDialog } from '../components/StaffDialogs';
import { formatNumber } from '../staffUi';
import '../staffWorkforcePro.css';

const INITIAL_FORM = {
  full_name: '',
  email: '',
  phone: '',
  username: '',
  department_id: '',
  employee_code: '',
  role_codes: [],
  status: 'active',
  password: '',
  confirm_password: '',
  must_change_password: true,
  send_activation_email: false,
  note: '',
};

const WORKSPACE_BY_ROLE = {
  super_admin: ['admin', 'scheduling', 'reception', 'doctor', 'nursing', 'lab', 'pharmacy', 'billing', 'reports'],
  admin: ['admin', 'scheduling', 'billing', 'reports'],
  manager: ['admin', 'scheduling', 'pharmacy', 'billing', 'reports'],
  department_head: ['scheduling', 'nursing', 'reports'],
  scheduler: ['scheduling', 'reception'],
  receptionist: ['scheduling', 'reception'],
  doctor: ['doctor', 'lab'],
  nurse: ['nursing', 'lab'],
  lab_technician: ['lab'],
  lab_manager: ['lab', 'reports'],
  radiologist: ['doctor', 'lab'],
  imaging_technician: ['lab'],
  procedure_staff: ['lab'],
  pharmacist: ['pharmacy', 'reports'],
  inventory_staff: ['pharmacy'],
  cashier: ['billing'],
  billing_staff: ['billing', 'reports'],
  insurance_staff: ['billing', 'reports'],
  medical_record_staff: ['reports'],
};

const ROLE_GROUPS = [
  { id: 'all', label: 'Tất cả', roleCodes: [] },
  { id: 'front_office', label: 'Tiếp nhận & lịch', roleCodes: ['receptionist', 'scheduler'] },
  { id: 'clinical', label: 'Lâm sàng', roleCodes: ['doctor', 'nurse', 'department_head'] },
  { id: 'diagnostics', label: 'Cận lâm sàng', roleCodes: ['lab_technician', 'lab_manager', 'radiologist', 'imaging_technician', 'procedure_staff'] },
  { id: 'finance_ops', label: 'Tài chính & vận hành', roleCodes: ['cashier', 'billing_staff', 'insurance_staff', 'pharmacist', 'inventory_staff', 'medical_record_staff'] },
  { id: 'governance', label: 'Quản trị', roleCodes: ['super_admin', 'admin', 'manager'] },
];

const ROLE_GROUP_BY_CODE = ROLE_GROUPS.reduce((map, group) => {
  group.roleCodes.forEach((roleCode) => map.set(roleCode, group.id));
  return map;
}, new Map());

const ROLE_ARCHETYPE_BY_CODE = {
  vn_seed_bac_si: { groupId: 'clinical', baseRoleCode: 'doctor' },
  vn_seed_dieu_duong: { groupId: 'clinical', baseRoleCode: 'nurse' },
  vn_seed_ky_thuat_xet_nghiem: { groupId: 'diagnostics', baseRoleCode: 'lab_technician' },
  vn_seed_ky_thuat_cdha: { groupId: 'diagnostics', baseRoleCode: 'imaging_technician' },
  vn_seed_duoc_si: { groupId: 'finance_ops', baseRoleCode: 'pharmacist' },
  vn_seed_thu_ngan: { groupId: 'finance_ops', baseRoleCode: 'cashier' },
  vn_seed_quan_tri: { groupId: 'governance', baseRoleCode: 'admin' },
  vn_seed_cham_soc_khach_hang: { groupId: 'front_office', baseRoleCode: 'receptionist' },
  vn_seed_quan_ly_khoa: { groupId: 'clinical', baseRoleCode: 'department_head' },
  vn_seed_bao_hiem: { groupId: 'finance_ops', baseRoleCode: 'insurance_staff' },
  vn_seed_ho_so_benh_an: { groupId: 'finance_ops', baseRoleCode: 'medical_record_staff' },
  vn_seed_dieu_phoi: { groupId: 'front_office', baseRoleCode: 'scheduler' },
};

const DEPARTMENT_SCOPED_ROLE_CODES = new Set([
  'receptionist',
  'scheduler',
  'department_head',
  'doctor',
  'nurse',
  'lab_technician',
  'lab_manager',
  'radiologist',
  'imaging_technician',
  'procedure_staff',
  'pharmacist',
  'inventory_staff',
  'cashier',
  'billing_staff',
  'insurance_staff',
  'medical_record_staff',
]);

function normalizeRoleText(role = {}) {
  return `${role.role_code || ''} ${role.role_name || ''} ${role.description || ''}`.toLowerCase();
}

function getRoleArchetype(role = {}) {
  const roleCode = typeof role === 'string' ? role : role.role_code;
  if (ROLE_ARCHETYPE_BY_CODE[roleCode]) return ROLE_ARCHETYPE_BY_CODE[roleCode];
  if (ROLE_GROUP_BY_CODE.has(roleCode)) {
    return { groupId: ROLE_GROUP_BY_CODE.get(roleCode), baseRoleCode: roleCode };
  }

  const text = normalizeRoleText(role);
  if (/bác sĩ|bac_si|doctor|physician/.test(text)) return { groupId: 'clinical', baseRoleCode: 'doctor' };
  if (/điều dưỡng|dieu_duong|nurse/.test(text)) return { groupId: 'clinical', baseRoleCode: 'nurse' };
  if (/quản lý khoa|quan_ly_khoa|department head|department_head/.test(text)) return { groupId: 'clinical', baseRoleCode: 'department_head' };
  if (/lễ tân|le_tan|tiếp nhận|tiep_nhan|chăm sóc khách|support|reception/.test(text)) return { groupId: 'front_office', baseRoleCode: 'receptionist' };
  if (/điều phối|dieu_phoi|scheduler|lịch/.test(text)) return { groupId: 'front_office', baseRoleCode: 'scheduler' };
  if (/xét nghiệm|xet_nghiem|lab/.test(text)) return { groupId: 'diagnostics', baseRoleCode: 'lab_technician' };
  if (/chẩn đoán hình ảnh|chan_doan_hinh_anh|cdha|imaging|radiology/.test(text)) return { groupId: 'diagnostics', baseRoleCode: 'imaging_technician' };
  if (/dược|duoc|pharmac/.test(text)) return { groupId: 'finance_ops', baseRoleCode: 'pharmacist' };
  if (/thu ngân|thu_ngan|cashier/.test(text)) return { groupId: 'finance_ops', baseRoleCode: 'cashier' };
  if (/bảo hiểm|bao_hiem|insurance/.test(text)) return { groupId: 'finance_ops', baseRoleCode: 'insurance_staff' };
  if (/hồ sơ|ho_so|record/.test(text)) return { groupId: 'finance_ops', baseRoleCode: 'medical_record_staff' };
  if (/admin|quản trị|quan_tri/.test(text)) return { groupId: 'governance', baseRoleCode: 'admin' };
  return { groupId: 'governance', baseRoleCode: roleCode };
}

function getRoleGroupId(role) {
  return getRoleArchetype(role).groupId;
}

function getWorkspaceRoleCode(role) {
  return getRoleArchetype(role).baseRoleCode || role.role_code;
}

function isDepartmentScopedRole(role) {
  return DEPARTMENT_SCOPED_ROLE_CODES.has(getWorkspaceRoleCode(role));
}

function roleRisk(role = {}) {
  if (['super_admin'].includes(role.role_code)) return 'critical';
  if (['admin', 'manager'].includes(role.role_code) || Number(role.priority_level || 0) >= 80) return 'high';
  if (Number(role.priority_level || 0) >= 50) return 'medium';
  return 'low';
}

function RiskBadge({ level }) {
  return <span className={`staff-create-pro-risk staff-create-pro-risk--${level}`}>{level}</span>;
}

function Field({ icon: Icon, label, children, hint, error }) {
  return (
    <label className={`staff-create-pro-field${error ? ' has-error' : ''}`}>
      <span>{Icon ? <Icon size={15} strokeWidth={2.25} /> : null}{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
      {error ? <em>{error}</em> : null}
    </label>
  );
}

function getPasswordPolicyMessage(form) {
  if (!form.password) return '';

  const checks = evaluatePasswordPolicy('staff', form.password, [form.username, form.email, form.phone]);
  if (Object.values(checks).every(Boolean)) return '';

  if (!checks.length) return 'Mật khẩu nhân sự phải có ít nhất 10 ký tự.';
  if (!checks.lowercase) return 'Mật khẩu nhân sự phải có chữ thường.';
  if (!checks.uppercase) return 'Mật khẩu nhân sự phải có chữ hoa.';
  if (!checks.number) return 'Mật khẩu nhân sự phải có số.';
  if (!checks.specialChar) return 'Mật khẩu nhân sự phải có ký tự đặc biệt.';
  if (!checks.special) return 'Mật khẩu không được chứa username, email hoặc số điện thoại.';
  if (!checks.common) return 'Mật khẩu quá phổ biến.';

  return 'Mật khẩu chưa đáp ứng chính sách bảo mật.';
}

export function StaffCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(INITIAL_FORM);
  const [activeRoleGroup, setActiveRoleGroup] = useState('all');
  const [roleQuery, setRoleQuery] = useState('');
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [uniqueCheck, setUniqueCheck] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadMeta() {
      try {
        const [rolesData, departmentsData] = await Promise.all([getAssignableRoles(), getDepartments('limit=150')]);
        if (!active) return;
        const roleItems = rolesData?.items || [];
        const departmentItems = departmentsData?.items || [];
        setRoles(roleItems);
        setDepartments(departmentItems);
        setForm((current) => ({
          ...current,
          role_codes: searchParams.get('role') && roleItems.some((item) => item.role_code === searchParams.get('role'))
            ? [searchParams.get('role')]
            : current.role_codes,
          department_id: searchParams.get('department') && departmentItems.some((item) => item.department_id === searchParams.get('department'))
            ? searchParams.get('department')
            : current.department_id,
        }));
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }
    loadMeta();
    return () => {
      active = false;
    };
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (form.username) params.set('username', form.username);
    if (form.email) params.set('email', form.email);
    if (form.phone) params.set('phone', form.phone);
    if (form.employee_code) params.set('employee_code', form.employee_code);
    if (![...params.keys()].length) {
      setUniqueCheck(null);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        setUniqueCheck(await validateStaffUnique(params.toString()));
      } catch {
        setUniqueCheck(null);
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [form.username, form.email, form.phone, form.employee_code]);

  const selectedRoles = useMemo(
    () => roles.filter((role) => form.role_codes.includes(role.role_code)),
    [form.role_codes, roles],
  );
  const selectedDepartment = departments.find((department) => department.department_id === form.department_id);
  const visibleRoles = useMemo(() => {
    const keyword = roleQuery.trim().toLowerCase();
    return roles.filter((role) => {
      const roleGroupId = getRoleGroupId(role);
      const matchGroup = activeRoleGroup === 'all' || roleGroupId === activeRoleGroup;
      const matchKeyword =
        !keyword ||
        [
          role.role_name,
          role.role_code,
          role.description,
          ROLE_GROUPS.find((group) => group.id === roleGroupId)?.label,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      return matchGroup && matchKeyword;
    });
  }, [activeRoleGroup, roleQuery, roles]);
  const roleGroupCounts = useMemo(() => {
    const counts = { all: roles.length };
    roles.forEach((role) => {
      const group = getRoleGroupId(role);
      counts[group] = (counts[group] || 0) + 1;
    });
    return counts;
  }, [roles]);
  const needsDepartmentScope = selectedRoles.some((role) => isDepartmentScopedRole(role));
  const departmentScopeLabel = needsDepartmentScope ? 'Scope khoa/phòng bắt buộc' : 'Scope khoa/phòng tùy chọn';
  const accessProfileLabel = selectedRoles.length
    ? selectedRoles.map((role) => role.role_name || role.role_code).join(' + ')
    : 'Chưa chọn chức năng truy cập';
  const workspacePreview = useMemo(
    () => [...new Set(selectedRoles.flatMap((role) => WORKSPACE_BY_ROLE[getWorkspaceRoleCode(role)] || []))],
    [selectedRoles],
  );
  const workspacePreviewHint = selectedRoles.length
    ? 'Role custom sẽ dùng permission thực tế từ backend khi đăng nhập.'
    : 'Chưa chọn role.';
  const maxPriority = selectedRoles.reduce((max, role) => Math.max(max, Number(role.priority_level || 0)), 0);
  const selectedRisk = selectedRoles.some((role) => roleRisk(role) === 'critical')
    ? 'critical'
    : selectedRoles.some((role) => roleRisk(role) === 'high')
      ? 'high'
      : selectedRoles.some((role) => roleRisk(role) === 'medium')
        ? 'medium'
        : 'low';

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleRole(roleCode) {
    setForm((current) => ({
      ...current,
      role_codes: current.role_codes.includes(roleCode)
        ? current.role_codes.filter((item) => item !== roleCode)
        : [...current.role_codes, roleCode],
    }));
  }

  async function handleGenerateUsername() {
    setError('');
    try {
      const result = await generateStaffUsername({ full_name: form.full_name, email: form.email, phone: form.phone });
      updateField('username', result.username || form.username);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function handleGenerateEmployeeCode() {
    setError('');
    try {
      const result = await generateStaffEmployeeCode({ department_id: form.department_id });
      updateField('employee_code', result.employee_code || form.employee_code);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function submitForm(event, keepCreating = false) {
    event.preventDefault();
    setError('');

    if (!form.full_name || !form.email || !form.phone || !form.username || !form.role_codes.length) {
      setError('Vui lòng nhập đủ họ tên, email, số điện thoại, username và ít nhất một vai trò.');
      return;
    }
    if (needsDepartmentScope && !form.department_id) {
      setError('Vui lòng chọn khoa/phòng công tác cho các vai trò vận hành theo scope khoa/phòng.');
      return;
    }
    if (form.password && form.password !== form.confirm_password) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }
    if (form.password) {
      const passwordPolicyMessage = getPasswordPolicyMessage(form);
      if (passwordPolicyMessage) {
        setError(passwordPolicyMessage);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        username: form.username,
        department_id: form.department_id || undefined,
        employee_code: form.employee_code || undefined,
        role_codes: form.role_codes,
        status: form.status,
        password: form.password || undefined,
        must_change_password: form.must_change_password,
      };
      const result = await createStaffAccount(payload);
      const createdUser = result?.user;
      const temporaryPassword = result?.initial_password || form.password || 'Backend đã tự sinh mật khẩu';
      if (!keepCreating) {
        navigate(`/admin/staff/${createdUser?.user_id || ''}`, { replace: true });
        return;
      }
      setSuccess({
        userId: createdUser?.user_id,
        title: 'Tạo tài khoản nhân sự thành công',
        summary: [
          { label: 'Nhân sự', value: createdUser?.full_name || payload.full_name },
          { label: 'Username', value: createdUser?.username || payload.username },
          { label: 'Vai trò', value: selectedRoles.map((role) => role.role_code).join(', ') },
          { label: 'Mật khẩu tạm', value: temporaryPassword },
        ],
      });
      setForm((current) => ({ ...INITIAL_FORM, department_id: current.department_id, role_codes: current.role_codes }));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="staff-create-pro-page">
        <section className="staff-create-pro-hero">
          <div className="staff-create-pro-hero__icon"><UserPlus size={26} strokeWidth={2.25} /></div>
          <div>
            <span>Human Identity Control</span>
            <h1>Tạo tài khoản nhân viên</h1>
            <p>Onboarding nhân sự nội bộ với kiểm tra unique realtime, role priority, workspace preview, chính sách mật khẩu và cảnh báo rủi ro trước khi tạo.</p>
          </div>
          <div className="staff-create-pro-hero__actions">
            <Link to="/admin/staff" className="staff-button staff-button--ghost">Hủy</Link>
            <button type="submit" form="staff-create-pro-form" className="staff-button staff-button--primary" disabled={submitting}>
              <CheckCircle2 size={16} /> {submitting ? 'Đang tạo...' : 'Tạo nhân sự'}
            </button>
          </div>
        </section>

        {error ? <p className="form-message error">{error}</p> : null}

        <form id="staff-create-pro-form" className="staff-create-pro-layout" onSubmit={(event) => submitForm(event, false)}>
          <main className="staff-create-pro-main">
            <section className="staff-create-pro-panel">
              <div className="staff-create-pro-panel__head">
                <Fingerprint size={19} />
                <div><span>Bước 1</span><strong>Thông tin định danh</strong></div>
              </div>
              <div className="staff-create-pro-grid">
                <Field icon={UsersRound} label="Họ và tên">
                  <input value={form.full_name} onChange={(event) => updateField('full_name', event.target.value)} placeholder="VD: BS. Nguyễn Minh An" />
                </Field>
                <Field icon={Mail} label="Email" error={uniqueCheck?.email?.available === false ? 'Email đã tồn tại trong staff/patient account.' : ''}>
                  <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="nguyen.an@hospital.vn" />
                </Field>
                <Field icon={Phone} label="Số điện thoại" error={uniqueCheck?.phone?.available === false ? 'Số điện thoại đã tồn tại.' : ''}>
                  <input value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="+84 9xx xxx xxx" />
                </Field>
                <Field icon={Fingerprint} label="Username" error={uniqueCheck?.username?.available === false ? 'Username đã tồn tại.' : ''}>
                  <div className="staff-create-pro-inline">
                    <input value={form.username} onChange={(event) => updateField('username', event.target.value)} placeholder="nguyenminhan" />
                    <button type="button" onClick={handleGenerateUsername}><Sparkles size={15} /> Gợi ý</button>
                  </div>
                </Field>
              </div>
            </section>

            <section className="staff-create-pro-panel staff-create-pro-panel--access">
              <div className="staff-create-pro-panel__head">
                <ShieldCheck size={19} />
                <div><span>Bước 2</span><strong>Vai trò & quyền truy cập</strong></div>
              </div>

              <div className="staff-create-pro-role-toolbar">
                <label>
                  <Search size={15} aria-hidden="true" />
                  <input
                    value={roleQuery}
                    onChange={(event) => setRoleQuery(event.target.value)}
                    placeholder="Tìm role, mã quyền, nhóm nghiệp vụ..."
                  />
                </label>
                <div className="staff-create-pro-role-tabs" role="tablist" aria-label="Nhóm vai trò">
                  {ROLE_GROUPS.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      className={activeRoleGroup === group.id ? 'is-active' : ''}
                      onClick={() => setActiveRoleGroup(group.id)}
                    >
                      {group.label}
                      <span>{formatNumber(roleGroupCounts[group.id] || 0)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedRoles.length ? (
                <div className="staff-create-pro-selected-roles" aria-label="Vai trò đã chọn">
                  {selectedRoles.map((role) => (
                    <button key={role.role_code} type="button" onClick={() => toggleRole(role.role_code)}>
                      <span>{role.role_name || role.role_code}</span>
                      <code>{role.role_code}</code>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="staff-create-pro-role-grid">
                {visibleRoles.map((role) => {
                  const selected = form.role_codes.includes(role.role_code);
                  return (
                    <button key={role.role_code} type="button" className={selected ? 'is-selected' : ''} onClick={() => toggleRole(role.role_code)}>
                      <div className="staff-create-pro-role-main">
                        <strong>{role.role_name}</strong>
                        <code>{role.role_code}</code>
                        <small>{role.description || 'Vai trò vận hành nội bộ'}</small>
                      </div>
                      <div className="staff-create-pro-role-meta">
                        <span className="staff-create-pro-priority">P{role.priority_level || 0}</span>
                        <RiskBadge level={roleRisk(role)} />
                      </div>
                    </button>
                  );
                })}
                {!visibleRoles.length ? (
                  <div className="staff-create-pro-empty-role">Không có role phù hợp với bộ lọc hiện tại.</div>
                ) : null}
              </div>
            </section>

            <section className="staff-create-pro-panel">
              <div className="staff-create-pro-panel__head">
                <Briefcase size={19} />
                <div><span>Bước 3</span><strong>Đơn vị công tác & phạm vi</strong></div>
              </div>
              <div className="staff-create-pro-assignment-grid">
                <div className="staff-create-pro-grid">
                  <Field icon={Building2} label="Khoa/phòng công tác" hint={needsDepartmentScope ? 'Áp dụng làm phạm vi queue, lịch, báo cáo và dữ liệu theo khoa.' : 'Có thể để trống với role quản trị toàn hệ thống.'}>
                    <select value={form.department_id} onChange={(event) => updateField('department_id', event.target.value)}>
                      <option value="">Chưa gán khoa/phòng</option>
                      {departments.map((department) => (
                        <option key={department.department_id} value={department.department_id}>
                          {department.department_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field icon={BadgeCheck} label="Mã nhân viên" error={uniqueCheck?.employee_code?.available === false ? 'Mã nhân viên đã tồn tại.' : ''}>
                    <div className="staff-create-pro-inline">
                      <input value={form.employee_code} onChange={(event) => updateField('employee_code', event.target.value)} placeholder="EMP-0001" />
                      <button type="button" onClick={handleGenerateEmployeeCode}><RefreshCw size={15} /> Sinh mã</button>
                    </div>
                  </Field>
                </div>
                <div className="staff-create-pro-assignment-card">
                  <MapPin size={18} aria-hidden="true" />
                  <div>
                    <span>{departmentScopeLabel}</span>
                    <strong>{selectedDepartment?.department_name || 'Chưa gán đơn vị công tác'}</strong>
                    <p>{accessProfileLabel}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="staff-create-pro-panel">
              <div className="staff-create-pro-panel__head">
                <KeyRound size={19} />
                <div><span>Bước 4</span><strong>Bảo mật tài khoản</strong></div>
              </div>
              <div className="staff-create-pro-grid">
                <Field icon={KeyRound} label="Mật khẩu tạm" hint="Để trống để backend tự sinh mật khẩu mạnh.">
                  <input type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} />
                </Field>
                <Field icon={KeyRound} label="Xác nhận mật khẩu">
                  <input type="password" value={form.confirm_password} onChange={(event) => updateField('confirm_password', event.target.value)} />
                </Field>
              </div>
              {form.password ? (
                <div className="staff-create-pro-password-policy">
                  <PasswordPolicyChecklist actorType="staff" password={form.password} identifiers={[form.username, form.email, form.phone]} />
                </div>
              ) : null}
              <div className="staff-create-pro-toggles">
                <label className={form.must_change_password ? 'is-on' : ''}>
                  <input type="checkbox" checked={form.must_change_password} onChange={(event) => updateField('must_change_password', event.target.checked)} />
                  <span><strong>Bắt đổi mật khẩu</strong><small>Phù hợp tài khoản mới hoặc reset bảo mật.</small></span>
                </label>
                <label className={form.send_activation_email ? 'is-on' : ''}>
                  <input type="checkbox" checked={form.send_activation_email} onChange={(event) => updateField('send_activation_email', event.target.checked)} />
                  <span><strong>Gửi lời mời</strong><small>Backend hiện ở mức MVP notification.</small></span>
                </label>
                <label className={form.status === 'active' ? 'is-on' : ''}>
                  <input type="checkbox" checked={form.status === 'active'} onChange={(event) => updateField('status', event.target.checked ? 'active' : 'suspended')} />
                  <span><strong>Kích hoạt ngay</strong><small>Cho phép đăng nhập sau khi tạo.</small></span>
                </label>
              </div>
            </section>
          </main>

          <aside className="staff-create-pro-sidebar">
            <section className="staff-create-pro-card">
              <div className="staff-create-pro-avatar">{String(form.full_name || form.username || 'NV').slice(0, 2).toUpperCase()}</div>
              <h2>{form.full_name || 'Nhân sự mới'}</h2>
              <p>{form.email || form.username || 'Chưa có định danh đăng nhập'}</p>
              <div className="staff-create-pro-card__badges">
                <span>{selectedDepartment?.department_name || 'Chưa gán đơn vị'}</span>
                <RiskBadge level={selectedRisk} />
              </div>
            </section>

            <section className="staff-create-pro-card staff-create-pro-impact">
              <div className="staff-create-pro-impact__row">
                <span>Access profile</span>
                <strong>{selectedRoles.length ? 'Đã chọn' : 'Trống'}</strong>
              </div>
              <div className="staff-create-pro-impact__row">
                <span>Role đã chọn</span>
                <strong>{formatNumber(selectedRoles.length)}</strong>
              </div>
              <div className="staff-create-pro-impact__row">
                <span>Priority cao nhất</span>
                <strong>{formatNumber(maxPriority)}</strong>
              </div>
              <div className="staff-create-pro-impact__row">
                <span>Workspace dự kiến</span>
                <strong>{formatNumber(workspacePreview.length)}</strong>
              </div>
              <div className="staff-create-pro-impact__row">
                <span>Scope dữ liệu</span>
                <strong>{needsDepartmentScope ? (selectedDepartment ? 'Theo khoa' : 'Thiếu khoa') : 'Theo role'}</strong>
              </div>
              <div className="staff-create-pro-workspaces">
                {workspacePreview.length ? workspacePreview.map((workspace) => <span key={workspace}>{workspace}</span>) : <small>{workspacePreviewHint}</small>}
              </div>
            </section>

            <section className="staff-create-pro-card staff-create-pro-warning">
              <ShieldAlert size={20} />
              <div>
                <strong>Guard backend đang áp dụng</strong>
                <ul>
                  <li>Không cho gán role priority bằng/cao hơn actor.</li>
                  <li>Non-super-admin không gán được super_admin.</li>
                  <li>Trùng username/email/phone/employee_code bị chặn.</li>
                  <li>Tạo xong có thể trả mật khẩu tạm một lần.</li>
                </ul>
              </div>
            </section>

            <div className="staff-create-pro-submit-row">
              <button type="button" className="staff-button staff-button--ghost" onClick={(event) => submitForm(event, true)} disabled={submitting}>
                <ClipboardCheck size={16} /> Tạo & tiếp tục
              </button>
              <button type="submit" className="staff-button staff-button--primary" disabled={submitting}>
                <UserPlus size={16} /> Tạo nhân sự
              </button>
            </div>
          </aside>
        </form>
      </section>

      {success ? (
        <StaffSuccessDialog
          title={success.title}
          summary={success.summary}
          onClose={() => setSuccess(null)}
          actions={(
            <>
              <Link to={`/admin/staff/${success.userId}`} className="staff-button staff-button--ghost">Mở Staff 360</Link>
              <button type="button" className="staff-button staff-button--primary" onClick={() => setSuccess(null)}>Tạo tiếp</button>
            </>
          )}
        />
      ) : null}
    </>
  );
}
