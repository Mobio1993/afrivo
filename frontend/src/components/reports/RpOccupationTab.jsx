import RpRoomsHeatmap from "./RpRoomsHeatmap";

export default function RpOccupationTab({ data }) {
  const rooms = data.rooms_heatmap || [];
  const occupied = rooms.filter((room) => room.statut === "occupe").length;
  const dayUse = rooms.filter((room) => room.statut === "day_use").length;
  const free = rooms.filter((room) => room.statut === "libre").length;
  const maintenance = rooms.filter((room) => room.statut === "maintenance").length;

  return (
    <div className="rp-tab-section">
      <div className="rp-occ-kpis">
        {[
          { label: "Taux occupation", value: `${Number(data.occupation_rate || 0).toFixed(1)}%`, color: "blue" },
          { label: "Chambres occupees", value: occupied },
          { label: "Day use actifs", value: dayUse },
          { label: "Chambres libres", value: free },
          { label: "Maintenance", value: maintenance },
        ].map((kpi) => (
          <div key={kpi.label} className="rp-fin-kpi">
            <div className="rp-kpi-lbl">{kpi.label}</div>
            <div className={`rp-kpi-val ${kpi.color ? `rp-kpi-${kpi.color}` : ""}`}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="rp-section">
        <RpRoomsHeatmap rooms={rooms} total={14} />
      </div>
    </div>
  );
}
