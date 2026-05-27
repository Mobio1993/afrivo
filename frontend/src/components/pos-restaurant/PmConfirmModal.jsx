export default function PmConfirmModal({ title, message, onCancel, onConfirm, danger }) {
  return (
    <div className="pm-modal-overlay">
      <div className="pm-modal pm-modal-sm">
        <div className="pm-modal-head">
          <span className="pm-modal-title">{title}</span>
          <button type="button" className="pm-modal-close" onClick={onCancel}>x</button>
        </div>
        <div className="pm-modal-body">
          <p className="pm-confirm-message">{message}</p>
        </div>
        <div className="pm-modal-footer">
          <button type="button" className="pm-btn" onClick={onCancel}>Annuler</button>
          <button type="button" className={`pm-btn ${danger ? "pm-btn-danger" : "pm-btn-primary"}`} onClick={onConfirm}>Confirmer</button>
        </div>
      </div>
    </div>
  );
}
