import { useEffect, useMemo, useState } from "react";

const RISK_LABELS = {
  low: "Risque faible",
  medium: "Risque modere",
  high: "Risque eleve",
  critical: "Risque critique",
};

export default function SuperRootConfirmModal({
  open = true,
  title,
  description,
  target,
  risk = "high",
  requiredPhrase = "",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  busy = false,
  onCancel,
  onConfirm,
}) {
  const [typedPhrase, setTypedPhrase] = useState("");

  useEffect(() => {
    if (open) setTypedPhrase("");
  }, [open, requiredPhrase]);

  const riskLabel = RISK_LABELS[risk] || RISK_LABELS.high;
  const isPhraseValid = useMemo(() => {
    if (!requiredPhrase) return true;
    return typedPhrase.trim() === requiredPhrase;
  }, [requiredPhrase, typedPhrase]);

  if (!open) return null;

  return (
    <div className="sr-confirm-overlay" role="presentation">
      <div
        className="sr-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sr-confirm-title"
      >
        <div className="sr-confirm-head">
          <div>
            <div className={`sr-confirm-risk sr-confirm-risk-${risk}`}>
              {riskLabel}
            </div>
            <h2 id="sr-confirm-title" className="sr-confirm-title">
              {title}
            </h2>
          </div>
          <button
            className="sr-confirm-close"
            type="button"
            aria-label="Fermer"
            onClick={onCancel}
            disabled={busy}
          >
            <i className="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>

        <div className="sr-confirm-body">
          {description ? (
            <p className="sr-confirm-description">{description}</p>
          ) : null}

          {target ? (
            <div className="sr-confirm-target">
              <span className="sr-confirm-target-label">Cible</span>
              <strong>{target}</strong>
            </div>
          ) : null}

          {requiredPhrase ? (
            <label className="sr-confirm-field">
              <span>
                Tapez <strong>{requiredPhrase}</strong> pour confirmer.
              </span>
              <input
                className="sr-confirm-input"
                type="text"
                value={typedPhrase}
                onChange={(event) => setTypedPhrase(event.target.value)}
                disabled={busy}
                autoFocus
              />
            </label>
          ) : null}
        </div>

        <div className="sr-confirm-footer">
          <button
            className="sr-btn sr-btn-outline"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            className={`sr-btn ${risk === "critical" ? "sr-btn-danger" : ""}`}
            type="button"
            onClick={onConfirm}
            disabled={busy || !isPhraseValid}
          >
            {busy ? "Traitement..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
