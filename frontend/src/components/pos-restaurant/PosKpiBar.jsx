export default function PosKpiBar({ tables = [], orders = [], tickets = [] }) {
  const openOrders = orders.filter((order) => !["payee", "annulee"].includes(order.statut)).length;
  const kpis = [
    { label: "Tables libres", value: tables.filter((table) => table.statut === "libre").length, tone: "green" },
    { label: "Tables occupees", value: tables.filter((table) => table.statut === "occupee").length, tone: "red" },
    { label: "Commandes ouvertes", value: openOrders, tone: "blue" },
    { label: "Tickets cuisine", value: tickets.length, tone: "amber" },
  ];

  return (
    <div className="pos-kpi-bar">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="pos-kpi-cell">
          <span className="pos-kpi-label">{kpi.label}</span>
          <strong className={`pos-kpi-value pos-kpi-${kpi.tone}`}>{kpi.value}</strong>
        </div>
      ))}
    </div>
  );
}
