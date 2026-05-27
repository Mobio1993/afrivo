import { useNavigate } from "react-router-dom";

import "./Toast.css";

const TYPE_STYLES = {
  success: {
    dot: "var(--theme-accent)",
    glow: "rgba(var(--theme-accent-rgb), 0.2)",
    bar: "rgba(var(--theme-accent-rgb), 0.4)",
    action: "var(--theme-accent)",
  },
  error: {
    dot: "#F09595",
    glow: "rgba(240, 149, 149, 0.2)",
    bar: "rgba(240, 149, 149, 0.4)",
    action: "#F09595",
  },
  warning: {
    dot: "#FAC775",
    glow: "rgba(250, 199, 117, 0.2)",
    bar: "rgba(250, 199, 117, 0.4)",
    action: "#FAC775",
  },
  info: {
    dot: "#93C5FD",
    glow: "rgba(147, 197, 253, 0.2)",
    bar: "rgba(147, 197, 253, 0.4)",
    action: "#93C5FD",
  },
};

function ToastItem({ toast, onRemove }) {
  const navigate = useNavigate();
  const styles = TYPE_STYLES[toast.type] || TYPE_STYLES.success;

  function handleAction() {
    if (toast.onAction) {
      toast.onAction();
    }
    if (toast.actionPath) {
      navigate(toast.actionPath);
    }
    onRemove(toast.id);
  }

  return (
    <div
      className={`snackbar-item ${toast.closing ? "snackbar-closing" : "snackbar-entering"}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="snackbar-icon-wrap" aria-hidden="true">
        <span
          className="snackbar-dot"
          style={{
            background: styles.dot,
            boxShadow: `0 0 0 3px ${styles.glow}`,
          }}
        />
      </span>
      <span className="snackbar-text">{toast.message}</span>
      {toast.actionLabel ? (
        <button
          type="button"
          className="snackbar-action"
          style={{ color: styles.action }}
          onClick={handleAction}
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <span className="snackbar-sep" aria-hidden="true" />
      <button
        type="button"
        className="snackbar-close"
        onClick={() => onRemove(toast.id)}
        aria-label="Fermer la notification"
      >
        <i className="ti ti-x" aria-hidden="true" />
      </button>
      <span
        className="snackbar-bar"
        style={{
          background: styles.bar,
          animationDuration: `${toast.duration}ms`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;

  return (
    <div className="snackbar-container" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}
