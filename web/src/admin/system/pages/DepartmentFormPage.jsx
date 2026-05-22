import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Bed,
  Building2,
  CheckCircle2,
  DoorOpen,
  Hospital,
  MapPin,
  PackageCheck,
  Save,
  ShieldAlert,
  Sparkles,
  Store,
  UserCheck,
  Workflow,
} from 'lucide-react';
import { getStaffAccounts } from '../../staff/staffApi';
import {
  createDepartmentWithDefaults,
  getDepartmentDetail,
  updateDepartment,
  updateDepartmentStatus,
} from '../systemApi';
import { getDepartmentTypeLabel } from '../systemUi';

const DEPARTMENT_TYPES = [
  ['clinical', 'Lâm sàng'],
  ['laboratory', 'Xét nghiệm'],
  ['lab', 'Lab legacy'],
  ['imaging', 'Chẩn đoán hình ảnh'],
  ['procedure', 'Thủ thuật'],
  ['pharmacy', 'Dược / nhà thuốc'],
  ['warehouse', 'Kho'],
  ['reception', 'Tiếp nhận'],
  ['billing', 'Viện phí'],
  ['administration', 'Hành chính'],
  ['support', 'Hỗ trợ'],
  ['emergency', 'Cấp cứu'],
  ['inpatient', 'Nội trú'],
  ['other', 'Khác'],
];

const LOCATION_TYPE_BY_DEPARTMENT = {
  laboratory: 'lab',
  lab: 'lab',
  imaging: 'imaging',
  pharmacy: 'pharmacy',
  warehouse: 'pharmacy',
  reception: 'clinic',
  procedure: 'clinic',
};

const ROOM_TYPE_BY_DEPARTMENT = {
  laboratory: 'lab',
  lab: 'lab',
  imaging: 'imaging',
  procedure: 'procedure',
  pharmacy: 'pharmacy',
  warehouse: 'storage',
  inpatient: 'ward',
};

function normalizeDepartmentCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

function defaultRoomCode(code) {
  return `${normalizeDepartmentCode(code) || 'DEPT'}-ROOM-01`;
}

function defaultWarehouseCode(code) {
  return `${normalizeDepartmentCode(code) || 'DEPT'}-WH`;
}

function ToggleCard({ active, icon: Icon, title, description, onClick }) {
  return (
    <button type="button" className={`facility-create-pro-toggle ${active ? 'is-active' : ''}`} onClick={onClick}>
      <Icon size={18} />
      <strong>{title}</strong>
      <small>{description}</small>
    </button>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`facility-create-pro-field ${full ? 'facility-create-pro-field--full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function DepartmentFormPage({ mode }) {
  const navigate = useNavigate();
  const { departmentId } = useParams();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    department_name: '',
    department_code: '',
    department_type: 'clinical',
    status: 'active',
    location_note: '',
    head_user_id: '',
  });
  const [defaults, setDefaults] = useState({
    create_location: true,
    location_name: '',
    location_type: 'clinic',
    address: '',
    phone: '',
    public_visible: false,
    create_room: true,
    room_code: '',
    room_name: '',
    room_type: 'consultation',
    building: '',
    floor: '',
    capacity: 1,
    create_warehouse: false,
    warehouse_code: '',
    warehouse_name: '',
    warehouse_type: 'department',
  });
  const [headCandidates, setHeadCandidates] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [staffData, detailData] = await Promise.all([
          getStaffAccounts('limit=120&status=active').catch(() => ({ items: [] })),
          isEdit && departmentId ? getDepartmentDetail(departmentId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setHeadCandidates(staffData?.items || []);
        if (detailData?.department) {
          setForm({
            department_name: detailData.department.department_name || '',
            department_code: detailData.department.department_code || '',
            department_type: detailData.department.department_type || 'clinical',
            status: detailData.department.status || 'active',
            location_note: detailData.department.location_note || '',
            head_user_id: detailData.department.head_user_id || '',
          });
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [departmentId, isEdit]);

  useEffect(() => {
    setDefaults((current) => ({
      ...current,
      location_name: current.location_name || `${form.department_name || 'Khoa mới'} - địa điểm mặc định`,
      location_type: LOCATION_TYPE_BY_DEPARTMENT[form.department_type] || 'clinic',
      room_code: current.room_code || defaultRoomCode(form.department_code),
      room_name: current.room_name || `${form.department_name || 'Khoa mới'} - phòng mặc định`,
      room_type: ROOM_TYPE_BY_DEPARTMENT[form.department_type] || 'consultation',
      warehouse_code: current.warehouse_code || defaultWarehouseCode(form.department_code),
      warehouse_name: current.warehouse_name || `${form.department_name || 'Khoa mới'} - kho mặc định`,
    }));
  }, [form.department_code, form.department_name, form.department_type]);

  const selectedHead = useMemo(
    () => headCandidates.find((candidate) => candidate.user_id === form.head_user_id),
    [form.head_user_id, headCandidates],
  );

  const workspaceSuggestions = useMemo(() => {
    const map = {
      clinical: ['scheduling', 'doctor', 'nursing', 'reports'],
      laboratory: ['lab', 'reports'],
      lab: ['lab', 'reports'],
      imaging: ['lab', 'doctor', 'reports'],
      procedure: ['lab', 'doctor', 'billing'],
      pharmacy: ['pharmacy', 'reports'],
      warehouse: ['pharmacy'],
      reception: ['reception', 'scheduling'],
      billing: ['billing', 'reports'],
      administration: ['admin', 'reports'],
      emergency: ['reception', 'doctor', 'nursing', 'billing'],
      inpatient: ['nursing', 'doctor', 'billing', 'reports'],
    };
    return map[form.department_type] || ['reports'];
  }, [form.department_type]);

  function updateForm(name, value) {
    setForm((current) => ({
      ...current,
      [name]: name === 'department_code' ? normalizeDepartmentCode(value) : value,
    }));
  }

  function updateDefaults(name, value) {
    setDefaults((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    if (!form.department_name.trim() || !form.department_code.trim()) {
      setError('Tên khoa/phòng và mã khoa/phòng là bắt buộc.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (isEdit) {
        await updateDepartment(departmentId, {
          department_name: form.department_name,
          department_code: form.department_code,
          department_type: form.department_type,
          location_note: form.location_note,
        });
        await updateDepartmentStatus(departmentId, form.status);
        navigate(`/admin/facilities/departments/${departmentId}`, { replace: true });
        return;
      }

      const created = await createDepartmentWithDefaults({
        department: {
          department_name: form.department_name,
          department_code: form.department_code,
          department_type: form.department_type,
          location_note: form.location_note,
          status: form.status,
        },
        defaults,
      });
      navigate(`/admin/facilities/departments/${created?.department?.department_id || ''}`, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="facility-create-pro-page">
      <section className="facility-create-pro-hero">
        <div className="facility-create-pro-hero__icon"><Hospital size={26} strokeWidth={2.25} /></div>
        <div>
          <span>Facility & Department Builder</span>
          <h1>{isEdit ? 'Chỉnh sửa khoa phòng' : 'Tạo khoa phòng'}</h1>
          <p>Wizard tạo department kèm địa điểm, phòng, kho mặc định và gợi ý workspace. Backend chỉ tạo những resource đã bật trong phần mặc định vận hành.</p>
        </div>
        <div className="facility-create-pro-hero__actions">
          <Link to="/admin/facilities/departments" className="staff-button staff-button--ghost">Hủy</Link>
          <button type="button" className="staff-button staff-button--primary" onClick={submit} disabled={submitting}>
            <Save size={16} /> {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo khoa phòng'}
          </button>
        </div>
      </section>

      {error ? <p className="form-message error">{error}</p> : null}

      <section className="facility-create-pro-layout">
        <main className="facility-create-pro-main">
          <section className="facility-create-pro-panel">
            <div className="facility-create-pro-panel__head"><Building2 size={18} /><h2>Thông tin khoa</h2><span>Step 1</span></div>
            <div className="facility-create-pro-grid">
              <Field label="Tên khoa/phòng">
                <input value={form.department_name} onChange={(event) => updateForm('department_name', event.target.value)} placeholder="Khoa Tim mạch" />
              </Field>
              <Field label="Mã khoa/phòng">
                <input value={form.department_code} onChange={(event) => updateForm('department_code', event.target.value)} placeholder="CARDIO" />
              </Field>
              <Field label="Loại khoa">
                <select value={form.department_type} onChange={(event) => updateForm('department_type', event.target.value)}>
                  {DEPARTMENT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Trạng thái ban đầu">
                <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
              <Field label="Ghi chú vị trí / vận hành" full>
                <textarea rows="3" value={form.location_note} onChange={(event) => updateForm('location_note', event.target.value)} placeholder="Tầng 3 khu B, gần khu khám chuyên khoa..." />
              </Field>
            </div>
          </section>

          <section className="facility-create-pro-panel">
            <div className="facility-create-pro-panel__head"><UserCheck size={18} /><h2>Trưởng khoa / phụ trách</h2><span>Step 2</span></div>
            <div className="facility-create-pro-grid">
              <Field label="Ứng viên trưởng khoa">
                <select value={form.head_user_id} onChange={(event) => updateForm('head_user_id', event.target.value)} disabled={!isEdit}>
                  <option value="">Chọn sau</option>
                  {headCandidates.map((candidate) => (
                    <option key={candidate.user_id} value={candidate.user_id}>{candidate.full_name || candidate.username}</option>
                  ))}
                </select>
                <small>{isEdit ? 'Backend sẽ kiểm tra active, đúng khoa và role department_head khi gán ở màn chi tiết.' : 'Khoa mới cần có nhân sự thuộc khoa trước khi gán trưởng khoa.'}</small>
              </Field>
              <div className="facility-create-pro-head-preview">
                <span>{selectedHead ? selectedHead.full_name || selectedHead.username : 'Chưa chọn head'}</span>
                <small>{selectedHead?.email || 'Có thể gán sau trong màn Trưởng khoa'}</small>
              </div>
            </div>
          </section>

          {!isEdit ? (
            <section className="facility-create-pro-panel">
              <div className="facility-create-pro-panel__head"><Workflow size={18} /><h2>Tạo mặc định vận hành</h2><span>Step 3</span></div>
              <div className="facility-create-pro-toggle-grid">
                <ToggleCard active={defaults.create_location} icon={MapPin} title="FacilityLocation" description="Tạo địa điểm mặc định cho public/internal directory." onClick={() => updateDefaults('create_location', !defaults.create_location)} />
                <ToggleCard active={defaults.create_room} icon={DoorOpen} title="Room" description="Tạo phòng vận hành ban đầu cho khoa." onClick={() => updateDefaults('create_room', !defaults.create_room)} />
                <ToggleCard active={defaults.create_warehouse} icon={Store} title="Warehouse" description="Tạo kho khoa/pharmacy nếu khoa cần quản lý tồn." onClick={() => updateDefaults('create_warehouse', !defaults.create_warehouse)} />
              </div>

              <div className="facility-create-pro-grid">
                <Field label="Tên địa điểm">
                  <input value={defaults.location_name} onChange={(event) => updateDefaults('location_name', event.target.value)} disabled={!defaults.create_location} />
                </Field>
                <Field label="Loại địa điểm">
                  <select value={defaults.location_type} onChange={(event) => updateDefaults('location_type', event.target.value)} disabled={!defaults.create_location}>
                    <option value="clinic">Clinic</option>
                    <option value="lab">Lab</option>
                    <option value="imaging">Imaging</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="hospital_branch">Hospital branch</option>
                  </select>
                </Field>
                <Field label="Địa chỉ">
                  <input value={defaults.address} onChange={(event) => updateDefaults('address', event.target.value)} disabled={!defaults.create_location} />
                </Field>
                <Field label="Điện thoại">
                  <input value={defaults.phone} onChange={(event) => updateDefaults('phone', event.target.value)} disabled={!defaults.create_location} />
                </Field>
                <Field label="Mã phòng">
                  <input value={defaults.room_code} onChange={(event) => updateDefaults('room_code', event.target.value)} disabled={!defaults.create_room} />
                </Field>
                <Field label="Tên phòng">
                  <input value={defaults.room_name} onChange={(event) => updateDefaults('room_name', event.target.value)} disabled={!defaults.create_room} />
                </Field>
                <Field label="Loại phòng">
                  <select value={defaults.room_type} onChange={(event) => updateDefaults('room_type', event.target.value)} disabled={!defaults.create_room}>
                    <option value="consultation">Consultation</option>
                    <option value="ward">Ward</option>
                    <option value="procedure">Procedure</option>
                    <option value="operating">Operating</option>
                    <option value="lab">Lab</option>
                    <option value="imaging">Imaging</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="storage">Storage</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Sức chứa">
                  <input type="number" min="0" value={defaults.capacity} onChange={(event) => updateDefaults('capacity', event.target.value)} disabled={!defaults.create_room} />
                </Field>
                <Field label="Mã kho">
                  <input value={defaults.warehouse_code} onChange={(event) => updateDefaults('warehouse_code', event.target.value)} disabled={!defaults.create_warehouse} />
                </Field>
                <Field label="Tên kho">
                  <input value={defaults.warehouse_name} onChange={(event) => updateDefaults('warehouse_name', event.target.value)} disabled={!defaults.create_warehouse} />
                </Field>
              </div>
            </section>
          ) : null}
        </main>

        <aside className="facility-create-pro-sidebar">
          <section className="facility-create-pro-preview">
            <div className="facility-create-pro-preview__avatar">{form.department_code || 'DEPT'}</div>
            <h2>{form.department_name || 'Khoa/phòng mới'}</h2>
            <p>{getDepartmentTypeLabel(form.department_type)} · {form.status}</p>
            <div>
              {workspaceSuggestions.map((workspace) => <span key={workspace}>{workspace}</span>)}
            </div>
          </section>
          <section className="facility-create-pro-card">
            <strong>Resource sẽ tạo</strong>
            <div className="facility-create-pro-impact">
              <span><MapPin size={15} /> Location <b>{defaults.create_location ? 1 : 0}</b></span>
              <span><DoorOpen size={15} /> Room <b>{defaults.create_room ? 1 : 0}</b></span>
              <span><Store size={15} /> Warehouse <b>{defaults.create_warehouse ? 1 : 0}</b></span>
              <span><Bed size={15} /> Bed <b>0</b></span>
            </div>
          </section>
          <section className="facility-create-pro-card facility-create-pro-card--warning">
            <ShieldAlert size={18} />
            <p>Deactivate khoa vẫn được backend kiểm tra dependency: staff active, lịch tương lai, appointment tương lai, encounter mở và doctor profile active.</p>
          </section>
          <button type="button" className="staff-button staff-button--primary" onClick={submit} disabled={submitting}>
            <CheckCircle2 size={16} /> {submitting ? 'Đang ghi...' : 'Xác nhận'}
          </button>
        </aside>
      </section>
    </section>
  );
}

export function DepartmentCreatePage() {
  return <DepartmentFormPage mode="create" />;
}

export function DepartmentEditPage() {
  return <DepartmentFormPage mode="edit" />;
}
