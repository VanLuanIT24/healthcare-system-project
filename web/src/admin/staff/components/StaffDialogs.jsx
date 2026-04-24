import { useEffect, useState } from 'react';
import { getInitials, getStatusTone } from '../staffUi';

function DialogShell({ title, subtitle, tone = 'neutral', icon = null, onClose, children, footer }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="staff-dialog-backdrop" role="presentation" onClick={onClose}>
      <div className={`staff-dialog staff-dialog--${tone}`} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <header className="staff-dialog__header">
          <div className="staff-dialog__title">
            {icon ? <span className="staff-dialog__badge">{icon}</span> : null}
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="staff-dialog__close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="staff-dialog__body">{children}</div>
        <footer className="staff-dialog__footer">{footer}</footer>
      </div>
    </div>
  );
}

function StaffMiniProfile({ staff }) {
  if (!staff) return null;

  return (
    <div className="staff-dialog__profile staff-dialog__profile--reset">
      <div className="staff-dialog__profile-avatar admin-avatar">{getInitials(staff.full_name || staff.username)}</div>
      <div className="staff-dialog__profile-main">
        <strong>{staff.full_name || staff.username}</strong>
        <span>{staff.email || staff.username}</span>
        <small>
          {staff.department_name || 'Chưa gán khoa phòng'}
          {staff.employee_code ? ` · ID: ${staff.employee_code}` : ''}
        </small>
      </div>
      <span className={`admin-status-badge admin-status-badge--${getStatusTone(staff.status)}`}>{staff.status || 'active'}</span>
    </div>
  );
}

export function ResetPasswordDialog({ staff, onClose, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({
    new_password: '',
    confirm_password: '',
    must_change_password: true,
    note: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!form.new_password || form.new_password.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    if (form.new_password !== form.confirm_password) {
      setError('Xác nhận mật khẩu không khớp.');
      return;
    }

    setError('');
    onSubmit(form);
  }

  return (
    <DialogShell
      title="Đặt lại mật khẩu"
      subtitle="Thiết lập mật khẩu bảo mật mới cho tài khoản nhân sự này."
      tone="security"
      icon="◍"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="staff-button staff-button--ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form="reset-password-form" className="staff-button staff-button--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đặt lại...' : 'Xác nhận đặt lại'}
          </button>
        </>
      }
    >
      <StaffMiniProfile staff={staff} />
      <form id="reset-password-form" className="staff-dialog__form staff-dialog__form--reset" onSubmit={handleSubmit}>
        <label className="staff-dialog__field">
          <span>Mật khẩu mới</span>
          <div className="staff-dialog__password">
            <input
              name="new_password"
              type={showNewPassword ? 'text' : 'password'}
              value={form.new_password}
              onChange={handleChange}
            />
            <button type="button" onClick={() => setShowNewPassword((current) => !current)}>
              {showNewPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </label>
        <label className="staff-dialog__field">
          <span>Xác nhận mật khẩu mới</span>
          <div className="staff-dialog__password">
            <input
              name="confirm_password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={form.confirm_password}
              onChange={handleChange}
            />
            <button type="button" onClick={() => setShowConfirmPassword((current) => !current)}>
              {showConfirmPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </label>
        <label className="staff-dialog__toggle-card">
          <div>
            <strong>Bắt buộc đổi mật khẩu</strong>
            <span>Yêu cầu người dùng cập nhật thông tin đăng nhập ở lần đăng nhập tiếp theo.</span>
          </div>
          <span className={`staff-dialog__toggle ${form.must_change_password ? 'is-active' : ''}`}>
            <input
              name="must_change_password"
              type="checkbox"
              checked={form.must_change_password}
              onChange={handleChange}
            />
            <i />
          </span>
        </label>
        <label className="staff-dialog__field">
          <span>Ghi chú nội bộ</span>
          <textarea
            name="note"
            rows="4"
            value={form.note}
            onChange={handleChange}
            placeholder="Nhập lý do quản trị cho thao tác đặt lại mật khẩu..."
          />
        </label>
        {error ? <p className="form-message error">{error}</p> : null}
      </form>
    </DialogShell>
  );
}

const STATUS_COPY = {
  activate: {
    title: 'Kích hoạt hồ sơ',
    subtitle: 'Mở lại quyền truy cập hệ thống cho nhân sự này.',
    button: 'Xác nhận kích hoạt',
    tone: 'success',
    icon: '✓',
    noticeTone: 'info',
    noticeTitle: 'Thông tin',
    noticeBody: 'Hành động này sẽ ghi nhận vào nhật ký hệ thống. Sau khi kích hoạt, nhân sự có thể đăng nhập ngay lập tức.',
  },
  deactivate: {
    title: 'Vô hiệu hóa tài khoản',
    subtitle: 'Tài khoản bị vô hiệu hóa sẽ không thể đăng nhập vào hệ thống.',
    button: 'Xác nhận vô hiệu hóa',
    tone: 'warning',
    icon: '!',
    noticeTone: 'warning',
    noticeTitle: 'Thông báo',
    noticeBody: 'Hành động này sẽ được ghi vào nhật ký kiểm toán của hệ thống và ảnh hưởng trực tiếp đến trạng thái đăng nhập của tài khoản.',
  },
  unlock: {
    title: 'Mở khóa tài khoản',
    subtitle: 'Tài khoản này sẽ được mở lại để nhân sự có thể đăng nhập.',
    button: 'Xác nhận mở khóa',
    tone: 'neutral',
    icon: '○',
    noticeTone: 'info',
    noticeTitle: 'Thông tin',
    noticeBody: 'Hành động này sẽ mở lại tài khoản đang bị khóa và lưu lại lịch sử thao tác trong nhật ký kiểm toán.',
  },
};

export function StaffStatusDialog({ action, staff, onClose, onConfirm, isSubmitting }) {
  const copy = STATUS_COPY[action];
  if (!copy) return null;

  const isActivate = action === 'activate';
  const profileClassName = `staff-dialog__profile ${isActivate ? 'staff-dialog__profile--activate' : 'staff-dialog__profile--reset'}`;

  return (
    <DialogShell
      title={copy.title}
      subtitle={copy.subtitle}
      tone={copy.tone}
      icon={copy.icon}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="staff-button staff-button--ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="staff-button staff-button--primary" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Đang xử lý...' : copy.button}
          </button>
        </>
      }
    >
      <div className={profileClassName}>
        <div className="staff-dialog__profile-avatar admin-avatar">{getInitials(staff?.full_name || staff?.username)}</div>
        <div className="staff-dialog__profile-main">
          <strong>{staff?.full_name || staff?.username}</strong>
          <span>{staff?.email || staff?.username}</span>
          <small>
            {staff?.department_name || 'Chưa gán khoa phòng'}
            {staff?.employee_code ? ` · ID: ${staff.employee_code}` : ''}
          </small>
        </div>
        <span className={`admin-status-badge admin-status-badge--${getStatusTone(staff?.status)}`}>
          {staff?.status || 'active'}
        </span>
      </div>
      <div className={`staff-dialog__notice staff-dialog__notice--${copy.noticeTone}`}>
        <strong>{copy.noticeTitle}</strong>
        <p>{copy.noticeBody}</p>
      </div>
    </DialogShell>
  );
}

export function StaffSuccessDialog({ title, summary, actions, onClose }) {
  return (
    <DialogShell
      title={title}
      subtitle="Tác vụ đã được hoàn tất thành công."
      tone="success"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="staff-button staff-button--ghost" onClick={onClose}>
            Đóng
          </button>
          {actions}
        </>
      }
    >
      <div className="staff-success">
        {summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </DialogShell>
  );
}
