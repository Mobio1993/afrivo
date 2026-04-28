export function ClientsSummaryCards({ cards }) {
  return (
    <div className="clients-hero-aside clients-summary-aside">
      {cards.map((card) => (
        <article
          key={card.label}
          className={`dashboard-aside-card clients-hero-card ${
            card.tone === "selected" ? "clients-hero-card-selected" : ""
          }`}
        >
          <strong className="clients-hero-card-label">{card.label}</strong>

          <div
            className={`dashboard-aside-value clients-hero-card-value ${
              card.tone === "selected" ? "clients-hero-card-value-selected" : ""
            }`}
            title={typeof card.value === "string" ? card.value : undefined}
          >
            {card.value}
          </div>

          <p className="clients-hero-card-meta">{card.meta}</p>
        </article>
      ))}
    </div>
  );
}
