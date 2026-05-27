import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { SrCard, SuperRootPageShell, SuperRootState } from "../../../../features/super-root/shared/SuperRootShared";
import ExportLogs from "../audit/ExportLogs";
import HotelAuditLogs from "../audit/HotelAuditLogs";
import { superRootHotelsApi } from "../api/superRootHotelsApi";
import HotelDetailLayout from "../detail/HotelDetailLayout";

export default function SuperRootHotelAuditPage() {
  const { hotelId } = useParams();
  const [filters, setFilters] = useState({ q: "", page: 1 });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await superRootHotelsApi.getHotelAuditLogs(hotelId, filters));
    } catch (err) {
      setError(err.payload?.detail || err.message || "Chargement audit impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page]);

  return (
    <SuperRootPageShell
      title={data?.hotel?.name || "Audit hotel"}
      subtitle="Journal d'activite et export auditable du tenant hotel."
      actions={<ExportLogs href={superRootHotelsApi.exportHotelAuditLogs(hotelId, filters)} />}
    >
      <HotelDetailLayout hotelId={hotelId} hotel={data?.hotel}>
        <form className="sr-filterbar" onSubmit={(event) => { event.preventDefault(); load(); }}>
          <input className="sr-input" value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} placeholder="Rechercher dans les logs..." />
          <button className="sr-btn" type="submit">Rechercher</button>
        </form>
        <SuperRootState loading={loading} error={error}>
          <SrCard title={`Logs (${data?.pagination?.total ?? 0})`}>
            <HotelAuditLogs logs={data?.audit_logs || []} />
            <div className="sr-pagination">
              <button className="sr-btn sr-btn-outline" disabled={!data?.pagination?.has_previous} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Precedent</button>
              <span>Page {data?.pagination?.page || 1} / {data?.pagination?.pages || 1}</span>
              <button className="sr-btn sr-btn-outline" disabled={!data?.pagination?.has_next} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Suivant</button>
            </div>
          </SrCard>
        </SuperRootState>
      </HotelDetailLayout>
    </SuperRootPageShell>
  );
}
