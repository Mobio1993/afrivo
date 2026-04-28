export function ClientsPagination({
  hasClients,
  currentPage,
  totalPages,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}) {
  if (!hasClients) {
    return null;
  }

  return (
    <div className="clients-pagination">
      <button type="button" onClick={onPrevious} disabled={!hasPrevious}>
        Precedent
      </button>

      <span>
        Page {currentPage} sur {totalPages}
      </span>

      <button type="button" onClick={onNext} disabled={!hasNext}>
        Suivant
      </button>
    </div>
  );
}
