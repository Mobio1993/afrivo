import ModalShell from "./ModalShell";

export default function ConfirmModal({ title, message, confirmLabel, variant = "danger", saving, onCancel, onConfirm }) {
  return (
    <ModalShell title={title} onClose={onCancel} maxWidth={430}>
      <div className="um-confirm">
        <header className="um-modal-header">
          <div>
            <strong>{title}</strong>
            <span>Confirmation requise</span>
          </div>
          <button type="button" className="um-icon-btn" onClick={onCancel} aria-label="Fermer">×</button>
        </header>

        <div className={`um-confirm-message um-confirm-message--${variant}`}>
          {message}
        </div>

        <footer className="um-modal-footer">
          <button type="button" className="um-outline-btn" onClick={onCancel} disabled={saving}>Annuler</button>
          <button type="button" className={`um-danger-btn um-danger-btn--${variant}`} onClick={onConfirm} disabled={saving}>
            {saving ? "Traitement..." : confirmLabel}
          </button>
        </footer>
      </div>
    </ModalShell>
  );
}
