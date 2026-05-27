import { useEffect, useState } from "react";

import TableGrid from "../../components/pos-restaurant/TableGrid";
import { posApi } from "../../hooks/usePosApi";

export function TablesPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setTables(await posApi.getTables());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleOpenOrder(table) {
    await posApi.openOrder(table.id, {});
    await load();
  }

  return (
    <div className="pos-page">
      <div className="pos-page-header"><h2 className="pos-page-title">Tables</h2></div>
      {loading ? <div className="pos-loading">Chargement...</div> : null}
      {error ? <div className="pos-error">{error}</div> : null}
      {!loading ? <TableGrid tables={tables} onOpenOrder={handleOpenOrder} /> : null}
    </div>
  );
}
