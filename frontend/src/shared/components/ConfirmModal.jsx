import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import "./ConfirmModal.css";

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "default",
  confirmDisabled = false,
}) {
  const cancelButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previouslyFocusedRef.current = document.activeElement;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 20);

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const confirmClassName = `confirm-modal__confirm confirm-modal__confirm--${variant}`;
  const iconClassName = `confirm-modal__icon confirm-modal__icon--${variant}`;
  const iconSymbol = variant === "danger" ? "!" : "?";

  return createPortal(
    <div
      className="confirm-modal__overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel?.();
        }
      }}
    >
      <div
        className="confirm-modal__dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
      >
        <div className="confirm-modal__header">
          <div className={iconClassName} aria-hidden="true">
            {iconSymbol}
          </div>

          <div className="confirm-modal__copy">
            <h3 id="confirm-modal-title">{title}</h3>
            <p id="confirm-modal-message">{message}</p>
          </div>
        </div>

        <div className="confirm-modal__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="secondary-button confirm-modal__cancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={confirmClassName}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
