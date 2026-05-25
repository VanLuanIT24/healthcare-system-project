import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export function useClinicalOpsToasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function handleToast(event) {
      const detail = event.detail || {};
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [...current.slice(-3), { id, ...detail }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, detail.timeout || 4200);
    }

    window.addEventListener('clinical-ops:toast', handleToast);
    return () => window.removeEventListener('clinical-ops:toast', handleToast);
  }, []);

  return {
    toasts,
    closeToast: (id) => setToasts((current) => current.filter((item) => item.id !== id)),
  };
}

export function ClinicalOpsToastStack({ items = [], onClose }) {
  if (!items.length) return null;

  return (
    <div className="clinical-ops-toast-stack" role="status" aria-live="polite">
      {items.map((item) => (
        <article key={item.id} className={`clinical-ops-global-toast is-${item.tone || 'info'}`}>
          <div>
            <strong>{item.title || 'Thông báo cận lâm sàng'}</strong>
            {item.message ? <span>{item.message}</span> : null}
          </div>
          <button type="button" aria-label="Đóng thông báo" onClick={() => onClose(item.id)}>
            <X size={14} strokeWidth={2.25} />
          </button>
        </article>
      ))}
    </div>
  );
}
