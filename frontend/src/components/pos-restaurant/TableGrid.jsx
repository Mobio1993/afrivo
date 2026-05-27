import TableCard from "./TableCard";

export default function TableGrid({ tables = [], onOpenOrder }) {
  if (!tables.length) return <div className="pos-empty">Aucune table configuree.</div>;
  return (
    <div className="pos-table-grid">
      {tables.map((table) => (
        <TableCard key={table.id} table={table} onOpenOrder={onOpenOrder} />
      ))}
    </div>
  );
}
