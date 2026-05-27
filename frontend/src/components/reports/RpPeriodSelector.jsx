const PERIODS = [
  { key: "today", label: "Aujourd'hui" },
  { key: "7days", label: "7 jours" },
  { key: "30days", label: "30 jours" },
  { key: "this_month", label: "Ce mois" },
  { key: "last_month", label: "Mois precedent" },
  { key: "custom", label: "Personnalise" },
];

export default function RpPeriodSelector({ period, onChange, customRange, onCustomRange }) {
  return (
    <div className="rp-period-wrap">
      <div className="rp-period-bar">
        {PERIODS.map((item) => (
          <button
            key={item.key}
            className={`rp-period-btn ${period === item.key ? "active" : ""}`}
            onClick={() => onChange(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="rp-custom-range">
          <input
            type="date"
            value={customRange.from}
            onChange={(event) => onCustomRange((current) => ({ ...current, from: event.target.value }))}
            aria-label="Date de debut"
          />
          <span>→</span>
          <input
            type="date"
            value={customRange.to}
            onChange={(event) => onCustomRange((current) => ({ ...current, to: event.target.value }))}
            aria-label="Date de fin"
          />
        </div>
      )}
    </div>
  );
}
