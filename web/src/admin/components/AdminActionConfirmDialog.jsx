import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const TONE_ICON = {
  danger: ShieldAlert,
  warning: AlertTriangle,
  success: CheckCircle2,
  neutral: AlertTriangle,
};

function formatDetail(detail) {
  if (!detail) return null;
  if (typeof detail === 'string') return { label: detail, value: '' };
  return detail;
}

export function AdminActionConfirmDialog({
  open,
  title,
  description,
  tone = 'warning',
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  details = [],
  reasonRequired = false,
  reasonLabel = 'Lý do thao tác',
  reasonPlaceholder = 'Nhập lý do để lưu vào nhật ký kiểm toán...',
  submitting = false,
  onCancel,
  onConfirm,
}) {
  const [reason, setReason] = useState('');
  const [validation, setValidation] = useState('');
  const Icon = TONE_ICON[tone] || AlertTriangle;
  const normalizedDetails = useMemo(() => details.map(formatDetail).filter(Boolean), [details]);

  useEffect(() => {
    if (!open) return undefined;
    setReason('');
    setValidation('');

    function onKeyDown(event) {
      if (event.key === 'Escape' && !submitting) onCancel?.();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel, submitting]);

  if (!open) return null;

  function handleConfirm() {
    const trimmedReason = reason.trim();
    if (reasonRequired && !trimmedReason) {
      setValidation('Vui lòng nhập lý do thao tác trước khi xác nhận.');
      return;
    }
    setValidation('');
    onConfirm?.(trimmedReason);
  }

  return (
    <div className="staff-dialog-backdrop" role="presentation" onClick={() => !submitting && onCancel?.()}>
      <div
        className={`staff-dialog admin-confirm admin-confirm--${tone} staff-dialog--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="staff-dialog__header admin-confirm__header">
          <div className="staff-dialog__title">
            <span className="staff-dialog__badge admin-confirm__badge">
              <Icon size={18} strokeWidth={2.35} aria-hidden="true" />
            </span>
            <h3 id="admin-confirm-title">{title}</h3>
            <p>{description}</p>
          </div>
          <button type="button" className="staff-dialog__close" onClick={onCancel} disabled={submitting} aria-label="Đóng hộp xác nhận">
            <X size={17} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </header>

        <div className="staff-dialog__body admin-confirm__body">
          {normalizedDetails.length ? (
            <dl className="admin-confirm__details">
              {normalizedDetails.map((detail) => (
                <div key={`${detail.label}-${detail.value}`}>
                  <dt>{detail.label}</dt>
                  <dd>{detail.value || '-'}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {reasonRequired ? (
            <label className="staff-dialog__field admin-confirm__reason">
              <span>{reasonLabel}</span>
              <textarea
                rows="4"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setValidation('');
                }}
                placeholder={reasonPlaceholder}
                autoFocus
              />
            </label>
          ) : null}

          {validation ? <p className="form-message error">{validation}</p> : null}
        </div>

        <footer className="staff-dialog__footer">
          <button type="button" className="staff-button staff-button--ghost" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`staff-button ${tone === 'danger' ? 'staff-button--danger' : 'staff-button--primary'}`}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Đang xử lý...' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
