import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function ModalShell({ title, children, onClose, maxWidth = 520 }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const first = dialog?.querySelector(FOCUSABLE);
    first?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE));
      if (!focusable.length) return;
      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.body.classList.add("um-modal-open");
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("um-modal-open");
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="um-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="um-modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {children}
      </section>
    </div>
  );
}
