import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import './toast.css'

const ToastContext = createContext(null)
const DEFAULT_DURATION = 3000

const toastIcons = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
}

function createToastId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    if (toast.duration === Infinity) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      onDismiss(toast.id)
    }, toast.duration ?? DEFAULT_DURATION)

    return () => window.clearTimeout(timer)
  }, [onDismiss, toast.duration, toast.id])

  return (
    <div
      className={`hc-toast hc-toast-${toast.type}${toast.isLeaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="hc-toast-icon">{toastIcons[toast.type] || toastIcons.info}</span>
      <div className="hc-toast-content">
        {toast.title ? <strong>{toast.title}</strong> : null}
        <span>{toast.message}</span>
      </div>
      <button
        className="hc-toast-close"
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => onDismiss(toast.id)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m18 6-12 12" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, isLeaving: true } : toast))
    )

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 180)
  }, [])

  const showToast = useCallback((options) => {
    const nextToast = {
      id: createToastId(),
      type: options.type || 'info',
      title: options.title || '',
      message: options.message || '',
      duration: options.duration ?? 3000,
    }

    if (!nextToast.message) {
      return null
    }

    setToasts((current) => {
      const duplicated = current.some(
        (toast) => toast.type === nextToast.type && toast.message === nextToast.message
      )

      if (duplicated) {
        return current
      }

      return [nextToast, ...current].slice(0, 5)
    })

    return nextToast.id
  }, [])

  const value = useMemo(
    () => ({
      showToast,
      dismiss,
      success: (message, options = {}) => showToast({ ...options, type: 'success', message }),
      error: (message, options = {}) => showToast({ ...options, type: 'error', message }),
      warning: (message, options = {}) => showToast({ ...options, type: 'warning', message }),
      info: (message, options = {}) => showToast({ ...options, type: 'info', message }),
    }),
    [dismiss, showToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="hc-toast-viewport" aria-label="Thông báo hệ thống">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return context
}
