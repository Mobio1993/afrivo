import { useState } from "react";

export function ClientsPagination({
  hasClients,
  currentPage,
  totalPages,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onGoToPage,
}) {
  const [inputValue, setInputValue] = useState("");

  if (!hasClients) {
    return null;
  }

  function handleGoTo(event) {
    event.preventDefault();
    const page = parseInt(inputValue, 10);
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onGoToPage(page);
    }
    setInputValue("");
  }

  const showGoto = totalPages > 5 && onGoToPage;

  return (
    <div className="clients-pagination">
      <button type="button" onClick={onPrevious} disabled={!hasPrevious} aria-label="Page précédente">
        ‹ Précédent
      </button>

      <span aria-live="polite" aria-atomic="true">
        Page {currentPage} sur {totalPages}
      </span>

      <button type="button" onClick={onNext} disabled={!hasNext} aria-label="Page suivante">
        Suivant ›
      </button>

      {showGoto ? (
        <form className="clients-pagination-goto" onSubmit={handleGoTo} aria-label="Aller à une page">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Page…"
            aria-label={`Numéro de page (1–${totalPages})`}
            className="clients-pagination-goto-input"
          />
          <button
            type="submit"
            className="secondary-button clients-pagination-goto-btn"
            disabled={!inputValue}
            aria-label="Aller à la page saisie"
          >
            OK
          </button>
        </form>
      ) : null}
    </div>
  );
}
