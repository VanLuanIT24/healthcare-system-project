import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  assignDepartmentHead,
  checkDepartmentCanBeDeactivated,
  checkDepartmentHasFutureAppointments,
  checkDepartmentHasFutureSchedules,
  checkDepartmentInUse,
  getAuditLogs,
  getDepartmentDetail,
  getDepartmentSummary,
  listDepartmentStaff,
  removeDepartmentHead,
} from '../systemApi';
import { getStaffAccounts } from '../../staff/staffApi';
import {
  formatCompactDate,
  formatNumber,
  formatRelativeTime,
  getDepartmentTypeLabel,
  getInitials,
} from '../systemUi';

export function DepartmentDetailPage() {
  const { departmentId } = useParams();
  const [tab, setTab] = useState('general');
  const [data, setData] = useState({
    detail: null,
    summary: null,
    staff: [],
    dependencies: null,
    canDeactivate: null,
    futureSchedules: null,
    futureAppointments: null,
    audit: [],
    candidates: [],
  });
  const [assignHeadId, setAssignHeadId] = useState('');
  const [error, setError] = useState('');

  async function loadData() {
    const [detail, summary, staff, dependencies, canDeactivate, futureSchedules, futureAppointments, audit, candidates] = await Promise.all([
      getDepartmentDetail(departmentId),
      getDepartmentSummary(departmentId).catch(() => null),
      listDepartmentStaff(departmentId, 'limit=12').catch(() => ({ items: [] })),
      checkDepartmentInUse(departmentId).catch(() => null),
      checkDepartmentCanBeDeactivated(departmentId).catch(() => null),
      checkDepartmentHasFutureSchedules(departmentId).catch(() => null),
      checkDepartmentHasFutureAppointments(departmentId).catch(() => null),
      getAuditLogs('limit=120').catch(() => ({ items: [] })),
      getStaffAccounts('limit=100&status=active').catch(() => ({ items: [] })),
    ]);

    setData({
      detail,
      summary,
      staff: staff?.items || [],
      dependencies,
      canDeactivate,
      futureSchedules,
      futureAppointments,
      audit: (audit?.items || []).filter((item) => item.target_type === 'department' && String(item.target_id) === String(departmentId)).slice(0, 6),
      candidates: candidates?.items || [],
    });
    setAssignHeadId(detail?.department?.head_user_id || '');
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setError('');
      try {
        await loadData();
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [departmentId]);

  const detail = data.detail?.department;
  const head = data.detail?.head;
  const metrics = useMemo(() => [
    { label: 'Tổng nhân sự', value: formatNumber(data.summary?.staff?.total_staff || data.detail?.staff_count || 0) },
    { label: 'Nhân sự hoạt động', value: formatNumber(data.summary?.active_staff_count || 0) },
    { label: 'Lịch tương lai', value: formatNumber(data.summary?.future_schedules_count || 0) },
    { label: 'Lịch hẹn tương lai', value: formatNumber(data.summary?.future_appointments_count || 0) },
    { label: 'Trạng thái', value: detail?.status || 'N/A' },
  ], [data, detail]);

  async function handleAssignHead() {
    if (!assignHeadId) return;
    try {
      await assignDepartmentHead(departmentId, assignHeadId);
      await loadData();
    } catch (assignError) {
      setError(assignError.message);
    }
  }

  async function handleRemoveHead() {
    try {
      await removeDepartmentHead(departmentId);
      await loadData();
    } catch (removeError) {
      setError(removeError.message);
    }
  }

  if (!detail) {
    return <section className="staff-loading-panel">{error || 'Đang tải chi tiết khoa/phòng...'}</section>;
  }

  return (
    <section className="role-page system-admin-page">
      <section className="role-detail-hero role-detail-hero--premium admin-panel">
        <div className="role-detail-hero__main">
          <p className="admin-page-header__eyebrow">Admin / Khoa phòng / Chi tiết khoa/phòng</p>
          <div className="role-detail-hero__identity">
            <span>▣</span>
            <div>
              <h1>{detail.department_name}</h1>
              <code>{detail.department_code}</code>
              <div className="role-detail-hero__meta">
                <span className="role-chip role-chip--blue">{getDepartmentTypeLabel(detail.department_type)}</span>
                <span className={`admin-status-badge admin-status-badge--${detail.status}`}>{detail.status}</span>
                <small>{head ? `Trưởng khoa: ${head.full_name || head.username}` : 'Chưa gán trưởng khoa'}</small>
              </div>
            </div>
          </div>
        </div>
        <div className="role-detail-hero__actions">
          <Link to={`/admin/departments/${detail.department_id}/edit`} className="staff-button staff-button--ghost">Chỉnh sửa</Link>
          <button type="button" className="staff-button staff-button--ghost" onClick={handleRemoveHead}>Gỡ trưởng khoa</button>
          <div className="system-inline-action">
            <select value={assignHeadId} onChange={(event) => setAssignHeadId(event.target.value)}>
              <option value="">Chọn trưởng khoa</option>
              {data.candidates.map((item) => (
                <option key={item.user_id} value={item.user_id}>{item.full_name || item.username}</option>
              ))}
            </select>
            <button type="button" className="staff-button staff-button--primary" onClick={handleAssignHead}>Gán</button>
          </div>
        </div>
      </section>

      <section className="role-detail-metrics">
        {metrics.map((item) => (
          <article key={item.label} className="role-detail-metric admin-panel">
            <div>
              <small>{item.label}</small>
              <strong>{item.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="admin-panel role-detail-content">
        <div className="role-detail-tabs">
          {[
            ['general', 'Thông tin chung'],
            ['staff', 'Nhân sự'],
            ['activity', 'Lịch hoạt động'],
            ['checks', 'Kiểm tra ràng buộc'],
          ].map(([key, label]) => (
            <button key={key} type="button" className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'general' ? (
          <div className="role-detail-basic-grid">
            <div><span>Tên khoa/phòng</span><strong>{detail.department_name}</strong></div>
            <div><span>Mã</span><strong>{detail.department_code}</strong></div>
            <div><span>Loại</span><strong>{getDepartmentTypeLabel(detail.department_type)}</strong></div>
            <div><span>Vị trí</span><strong>{detail.location_note || 'Chưa cấu hình'}</strong></div>
            <div><span>Ngày tạo</span><strong>{formatCompactDate(detail.created_at)}</strong></div>
            <div><span>Ngày cập nhật</span><strong>{formatCompactDate(detail.updated_at)}</strong></div>
            <div><span>Trạng thái</span><strong>{detail.status}</strong></div>
            <div><span>Trưởng khoa</span><strong>{head?.full_name || head?.username || 'Chưa gán'}</strong></div>
          </div>
        ) : null}

        {tab === 'staff' ? (
          <div className="ops-table">
            <div className="ops-table__head ops-table__head--department-staff">
              <span>Nhân sự</span>
              <span>Email</span>
              <span>Trạng thái</span>
              <span>Đăng nhập cuối</span>
              <span>Thao tác</span>
            </div>
            {data.staff.map((item) => (
              <div key={item.user_id} className="ops-table__row ops-table__row--department-staff">
                <div className="ops-owner">
                  <span className="admin-avatar">{getInitials(item.full_name || item.username)}</span>
                  <div>
                    <strong>{item.full_name || item.username}</strong>
                    <small>{item.employee_code || item.username}</small>
                  </div>
                </div>
                <span>{item.email || 'Chưa có email'}</span>
                <span className={`admin-status-badge admin-status-badge--${item.status}`}>{item.status}</span>
                <small>{formatRelativeTime(item.last_login_at)}</small>
                <Link to={`/admin/staff/${item.user_id}`} className="staff-button staff-button--ghost">Xem</Link>
              </div>
            ))}
          </div>
        ) : null}

        {tab === 'activity' ? (
          <div className="system-split-grid">
            <article className="admin-panel">
              <div className="admin-panel__heading"><h2>Lịch tương lai</h2></div>
              <div className="system-stat-list">
                <div><span>Lịch làm việc</span><strong>{formatNumber(data.futureSchedules?.future_schedules_count || 0)}</strong></div>
                <div><span>Lịch hẹn</span><strong>{formatNumber(data.futureAppointments?.future_appointments_count || 0)}</strong></div>
                <div><span>Hôm nay</span><strong>{formatNumber(data.summary?.appointments_today || 0)}</strong></div>
              </div>
            </article>
            <article className="admin-panel">
              <div className="admin-panel__heading"><h2>Nhật ký gần đây</h2></div>
              <div className="admin-activity-list">
                {data.audit.map((item, index) => (
                  <div key={`${item._id || item.action}-${index}`} className="admin-activity-item">
                    <div className={`admin-activity-item__icon admin-activity-item__icon--${item.status || 'success'}`}>{index + 1}</div>
                    <div>
                      <strong>{item.message || item.action}</strong>
                      <span>{formatCompactDate(item.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        ) : null}

        {tab === 'checks' ? (
          <div className="system-checklist">
            <div className="system-check-item">
              <strong>Còn nhân sự hoạt động</strong>
              <span>{data.summary?.active_staff_count || 0} nhân sự đang hoạt động</span>
            </div>
            <div className="system-check-item">
              <strong>Còn lịch làm việc tương lai</strong>
              <span>{data.futureSchedules?.future_schedules_count || 0} lịch làm việc tương lai</span>
            </div>
            <div className="system-check-item">
              <strong>Còn lịch hẹn tương lai</strong>
              <span>{data.futureAppointments?.future_appointments_count || 0} lịch hẹn tương lai</span>
            </div>
            <div className="system-check-item">
              <strong>Khoa/phòng đang được sử dụng</strong>
              <span>{data.dependencies?.in_use ? 'Có dữ liệu phụ thuộc' : 'Không có phụ thuộc đáng kể'}</span>
            </div>
            <div className={`system-check-item ${data.canDeactivate?.can_deactivate ? 'is-ok' : 'is-alert'}`}>
              <strong>Có thể vô hiệu hóa</strong>
              <span>{data.canDeactivate?.can_deactivate ? 'Có thể chuyển tạm ngưng' : 'Chưa thể tạm ngưng vì còn lịch vận hành'}</span>
            </div>
          </div>
        ) : null}

        {error ? <p className="form-message error">{error}</p> : null}
      </section>
    </section>
  );
}
