import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getStaffAccounts } from '../../staff/staffApi';
import { createDepartment, getDepartmentDetail, updateDepartment } from '../systemApi';
import { getDepartmentTypeLabel } from '../systemUi';

function parseLocationParts(locationNote = '') {
  const segments = String(locationNote)
    .split('-')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length >= 2) {
    return {
      building: segments.slice(0, 2).join(' - '),
      floor: segments[2] || '',
      note: segments.slice(3).join(' - '),
    };
  }

  return {
    building: '',
    floor: '',
    note: locationNote || '',
  };
}

function buildLocationNote({ building, floor, note }) {
  return [building, floor, note].map((item) => String(item || '').trim()).filter(Boolean).join(' - ');
}

function DepartmentFormPage({ mode }) {
  const navigate = useNavigate();
  const { departmentId } = useParams();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [headCandidates, setHeadCandidates] = useState([]);
  const [form, setForm] = useState({
    department_name: '',
    department_code: '',
    department_type: 'clinical',
    status: 'active',
    head_user_id: '',
    estimated_staff_count: '0',
    building_zone: '',
    floor_label: '',
    internal_note: '',
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [staffData, detail] = await Promise.all([
          getStaffAccounts('limit=100&status=active'),
          mode === 'edit' && departmentId ? getDepartmentDetail(departmentId) : Promise.resolve(null),
        ]);

        if (!active) return;
        setHeadCandidates(staffData?.items || []);

        if (detail?.department) {
          const locationParts = parseLocationParts(detail.department.location_note || '');
          setForm({
            department_name: detail.department.department_name || '',
            department_code: detail.department.department_code || '',
            department_type: detail.department.department_type || 'clinical',
            status: detail.department.status || 'active',
            head_user_id: detail.department.head_user_id || '',
            estimated_staff_count: String(detail.staff_count || 0),
            building_zone: locationParts.building,
            floor_label: locationParts.floor,
            internal_note: locationParts.note,
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
  }, [departmentId, mode]);

  const selectedHead = useMemo(
    () => headCandidates.find((item) => item.user_id === form.head_user_id) || null,
    [form.head_user_id, headCandidates],
  );

  const preview = useMemo(
    () => ({
      title: form.department_name || 'Khoa Nội tổng quát',
      code: form.department_code || 'INT-GEN',
      type: getDepartmentTypeLabel(form.department_type),
      status: form.status,
      headName: selectedHead?.full_name || selectedHead?.username || 'Chưa thiết lập',
      estimatedStaff: form.estimated_staff_count || '0',
      building: form.building_zone || 'Tòa A - Khu kỹ thuật',
      floor: form.floor_label || 'Tầng 4',
    }),
    [form, selectedHead],
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit() {
    if (!form.department_name || !form.department_code) {
      setError('Tên và mã khoa/phòng là bắt buộc.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const locationNote = buildLocationNote({
        building: form.building_zone,
        floor: form.floor_label,
        note: form.internal_note,
      });

      const payload = {
        department_name: form.department_name,
        department_code: form.department_code,
        department_type: form.department_type,
        location_note: locationNote,
        status: form.status,
        head_user_id: form.head_user_id || undefined,
      };

      const result = mode === 'create'
        ? await createDepartment(payload)
        : await updateDepartment(departmentId, payload);

      const resolvedId = result?.department?.department_id || departmentId;
      navigate(resolvedId ? `/admin/departments/${resolvedId}` : '/admin/departments', { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="role-page system-admin-page department-form-page">
      <section className="role-hero role-form-hero department-form-hero">
        <div className="role-hero__copy">
          <p className="admin-page-header__eyebrow">
            {mode === 'create' ? 'Admin / Khoa phòng / Tạo khoa/phòng' : 'Admin / Khoa phòng / Chỉnh sửa khoa/phòng'}
          </p>
          <h1>{mode === 'create' ? 'Tạo khoa/phòng mới' : 'Chỉnh sửa khoa/phòng'}</h1>
          <p>Thiết lập cấu trúc vận hành cho hệ thống Aura Lumina với trải nghiệm quản trị rõ ràng và trực quan.</p>
        </div>
        <div className="role-hero__actions">
          <Link to="/admin/departments" className="staff-button staff-button--ghost department-form-button department-form-button--ghost">Hủy</Link>
          <button type="button" className="staff-button staff-button--primary department-form-button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Đang lưu...' : mode === 'create' ? 'Lưu khoa/phòng' : 'Lưu thay đổi'}
          </button>
        </div>
      </section>

      <section className="role-form-layout department-form-layout">
        <div className="role-form-stack department-form-stack">
          <article className="role-form-card admin-panel department-form-section">
            <div className="department-form-section__header department-form-section__header--violet">
              <span>i</span>
              <div>
                <h2>Thông tin cơ bản</h2>
                <p>Đặt tên khoa/phòng, mã định danh và loại hình hoạt động.</p>
              </div>
            </div>
            <div className="staff-create-grid department-form-grid">
              <label className="staff-field staff-field--full department-form-field">
                <span>Tên khoa/phòng ban</span>
                <input name="department_name" value={form.department_name} onChange={handleChange} placeholder="e.g., Khoa Nội tổng quát" />
              </label>
              <label className="staff-field department-form-field">
                <span>Mã định danh (code)</span>
                <input name="department_code" value={form.department_code} onChange={handleChange} placeholder="INT-GEN" />
              </label>
              <label className="staff-field department-form-field">
                <span>Loại hình</span>
                <select name="department_type" value={form.department_type} onChange={handleChange}>
                  <option value="clinical">Lâm sàng</option>
                  <option value="admin">Quản trị</option>
                  <option value="pharmacy">Dược</option>
                  <option value="lab">Xét nghiệm</option>
                  <option value="imaging">Chẩn đoán hình ảnh</option>
                  <option value="non_clinical">Khác</option>
                </select>
              </label>
            </div>
          </article>

          <article className="role-form-card admin-panel department-form-section">
            <div className="department-form-section__header department-form-section__header--teal">
              <span>⌘</span>
              <div>
                <h2>Nhân sự & Vận hành</h2>
                <p>Thiết lập trưởng khoa/phòng, quy mô dự kiến và trạng thái hoạt động ban đầu.</p>
              </div>
            </div>
            <div className="staff-create-grid department-form-grid">
              <label className="staff-field department-form-field">
                <span>Trưởng khoa/phòng</span>
                <select name="head_user_id" value={form.head_user_id} onChange={handleChange}>
                  <option value="">Chọn nhân sự...</option>
                  {headCandidates.map((item) => (
                    <option key={item.user_id} value={item.user_id}>
                      {item.full_name || item.username}
                    </option>
                  ))}
                </select>
              </label>
              <label className="staff-field department-form-field">
                <span>Số lượng nhân sự dự kiến</span>
                <input
                  name="estimated_staff_count"
                  type="number"
                  min="0"
                  value={form.estimated_staff_count}
                  onChange={handleChange}
                  placeholder="0"
                />
              </label>
              <div className="staff-field staff-field--full department-form-field">
                <span>Trạng thái hoạt động</span>
                <div className="department-form-status-toggle" role="radiogroup" aria-label="Trạng thái hoạt động">
                  <button
                    type="button"
                    className={form.status === 'active' ? 'is-active' : ''}
                    onClick={() => setForm((current) => ({ ...current, status: 'active' }))}
                  >
                    <span className="department-form-status-dot" />
                  <strong>Đang hoạt động</strong>
                  </button>
                  <button
                    type="button"
                    className={form.status === 'inactive' ? 'is-active' : ''}
                    onClick={() => setForm((current) => ({ ...current, status: 'inactive' }))}
                  >
                    <span className="department-form-status-dot" />
                  <strong>Tạm ngưng</strong>
                  </button>
                </div>
              </div>
            </div>
          </article>

          <article className="role-form-card admin-panel department-form-section">
            <div className="department-form-section__header department-form-section__header--amber">
              <span>⌂</span>
              <div>
                <h2>Vị trí & Ghi chú</h2>
                <p>Bổ sung nơi vận hành, tầng và ghi chú nội bộ để thuận tiện quản lý.</p>
              </div>
            </div>
            <div className="staff-create-grid department-form-grid">
              <label className="staff-field department-form-field">
                <span>Tòa nhà / Khu vực</span>
                <input
                  name="building_zone"
                  value={form.building_zone}
                  onChange={handleChange}
                  placeholder="Tòa A - Khu kỹ thuật"
                />
              </label>
              <label className="staff-field department-form-field">
                <span>Tầng</span>
                <input
                  name="floor_label"
                  value={form.floor_label}
                  onChange={handleChange}
                  placeholder="Tầng 4"
                />
              </label>
              <label className="staff-field staff-field--full department-form-field">
                <span>Ghi chú nội bộ</span>
                <textarea
                  name="internal_note"
                  rows="5"
                  value={form.internal_note}
                  onChange={handleChange}
                  placeholder="Nhập ghi chú chi tiết về chức năng hoặc yêu cầu đặc biệt..."
                />
              </label>
            </div>
            {error ? <p className="form-message error">{error}</p> : null}
          </article>
        </div>

        <aside className="role-summary-stack department-form-sidebar">
          <article className="role-summary-card admin-panel department-preview-card">
            <div className="department-preview-card__topbar">
              <span className="department-preview-card__icon">⊞</span>
          <span className="department-preview-card__mode">Chế độ xem trước</span>
            </div>
            <div className="department-preview-card__content">
              <small>Xem trước danh mục</small>
              <div>
                <h3>{preview.title}</h3>
                <p>{preview.code} • {preview.type}</p>
              </div>
            </div>
            <div className="department-preview-card__meta">
              <div>
                <span className="department-preview-card__meta-icon">◉</span>
                <span>Trưởng khoa</span>
                <strong>{preview.headName}</strong>
              </div>
              <div>
                <span className="department-preview-card__meta-icon">◌</span>
                <span>Nhân sự</span>
                <strong>{preview.estimatedStaff} nhân viên</strong>
              </div>
              <div>
                <span className="department-preview-card__meta-icon">⌂</span>
                <span>Vị trí</span>
                <strong>{preview.building} • {preview.floor}</strong>
              </div>
            </div>
            <div className="department-preview-card__note">
              "Dữ liệu sẽ được tự động cập nhật vào danh bạ bệnh viện ngay sau khi lưu."
            </div>
          </article>

          <article className="role-summary-card admin-panel department-ai-hint">
            <h3>Hệ thống gợi ý</h3>
            <p>Các khoa lâm sàng thường yêu cầu mã định danh duy nhất để tích hợp tốt với hệ thống HIS.</p>
            <div className="department-ai-hint__badge">{preview.status === 'active' ? 'Sẵn sàng triển khai' : 'Đang ở chế độ nháp'}</div>
          </article>
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
