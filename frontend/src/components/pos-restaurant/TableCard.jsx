const STATUS_CLASS = {
  libre: "pos-tc-libre",
  occupee: "pos-tc-occupee",
  reservee: "pos-tc-reservee",
  fermee: "pos-tc-fermee",
};

const STATUS_LABEL = {
  libre: "Libre",
  occupee: "Occupee",
  reservee: "Reservee",
  fermee: "Fermee",
};

export default function TableCard({ table, onOpenOrder }) {
  const canOpen = table.statut === "libre";
  return (
    <button type="button" className={`pos-table-card ${STATUS_CLASS[table.statut] || ""}`} onClick={() => canOpen && onOpenOrder(table)}>
      <span className="pos-tc-num">Table {table.numero}</span>
      <span className="pos-tc-area">{table.area_nom || "Zone"}</span>
      <span className="pos-tc-cap">{table.capacite} pers.</span>
      <span className={`pos-pill pos-pill-${table.statut}`}>{STATUS_LABEL[table.statut] || table.statut}</span>
    </button>
  );
}
