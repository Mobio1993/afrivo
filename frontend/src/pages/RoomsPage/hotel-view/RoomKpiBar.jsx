const fmt = (value) => Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

export default function RoomKpiBar({ kpis }) {
  const items = [
    { label: "Disponibles", value: kpis.available, tone: "green", sub: "Pretes" },
    { label: "Occupees", value: kpis.occupied, tone: "rose", sub: "Clients presents" },
    { label: "Nettoyage", value: kpis.cleaning, tone: "amber", sub: "Housekeeping" },
    { label: "Occupation", value: `${kpis.occupancyRate}%`, tone: "blue", sub: "Parc actif" },
    { label: "Check-ins", value: kpis.checkinsToday, tone: "green", sub: "Aujourd'hui" },
    { label: "Check-outs", value: kpis.checkoutsToday, tone: "amber", sub: "A traiter" },
    { label: "Revenus jour", value: fmt(kpis.revenueToday), tone: "blue", sub: "XOF encaisses" },
    { label: "Duree moy.", value: `${kpis.avgStay}j`, tone: "neutral", sub: "Sejour" },
  ];

  return (
    <div className="hv-kpi-bar">
      {items.map((item) => (
        <div key={item.label} className={`hv-kpi hv-kpi-${item.tone}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.sub}</small>
        </div>
      ))}
    </div>
  );
}
