export function ClientsSummaryCards({ cards }) {
  const pills = cards.filter((card) => card.tone !== "selected");

  return (
    <div className="clients-stats-pills">
      {pills.map((card) => (
        <span key={card.label} className="clients-stat-pill" title={card.meta}>
          <span className="clients-stat-pill-value">{card.value}</span>
          <span className="clients-stat-pill-label">{card.label}</span>
        </span>
      ))}
    </div>
  );
}
