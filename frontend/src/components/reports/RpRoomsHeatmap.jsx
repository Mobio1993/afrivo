const STATUS_COLORS = {
  occupe: "#1D9E75",
  day_use: "#7F77DD",
  libre: "var(--color-background-secondary, #f5f5f5)",
  maintenance: "#F09595",
};

export default function RpRoomsHeatmap({ rooms = [], total = 14 }) {
  const cells = [...rooms];
  while (cells.length < total) {
    cells.push({ numero: "?", statut: "libre" });
  }

  const occupied = cells.filter((room) => room.statut === "occupe").length;
  const dayUse = cells.filter((room) => room.statut === "day_use").length;
  const free = cells.filter((room) => room.statut === "libre").length;
  const maintenance = cells.filter((room) => room.statut === "maintenance").length;

  return (
    <div>
      <div className="rp-heatmap-header">
        <span className="rp-sec-label">Parc hotelier · {total} chambres</span>
        <span className="rp-heatmap-rate">{Math.round(((occupied + dayUse) / total) * 100)}% occupe</span>
      </div>
      <div className="rp-heatmap-grid">
        {cells.map((room, index) => (
          <div
            key={`${room.numero}-${index}`}
            className="rp-heatmap-cell"
            style={{ background: STATUS_COLORS[room.statut] || "#eee" }}
            title={`Ch. ${room.numero} - ${room.statut}`}
          >
            <span className="rp-heatmap-num">{room.numero}</span>
          </div>
        ))}
      </div>
      <div className="rp-heatmap-legend">
        {[
          { key: "occupe", color: "#1D9E75", label: `Occupe (${occupied})` },
          { key: "day_use", color: "#7F77DD", label: `Day use (${dayUse})` },
          { key: "libre", color: "var(--color-background-secondary, #f5f5f5)", label: `Libre (${free})`, border: true },
          { key: "maintenance", color: "#F09595", label: `Maintenance (${maintenance})` },
        ].map((item) => (
          <div key={item.key} className="rp-leg-row">
            <div
              className="rp-leg-dot"
              style={{ background: item.color, border: item.border ? "1px solid #ccc" : "none" }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
