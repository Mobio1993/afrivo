import { SrBadge, SrCard, SrTable, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { useSuperRootResource } from "../shared/useSuperRootApi";

export function SuperRootInfrastructurePage() {
  const { data, error, loading, reload } = useSuperRootResource("monitoring");
  const monitoring = data?.monitoring || {};
  const rows = [
    { id: "api", layer: "API", status: monitoring.api?.ok ? "OK" : "Warning", value: `${monitoring.api?.latency_ms ?? "-"} ms` },
    { id: "db", layer: "Database", status: monitoring.database?.ok ? "OK" : "Warning", value: monitoring.database?.error || `${monitoring.database?.latency_ms ?? "-"} ms` },
    { id: "cache", layer: "Cache", status: monitoring.cache?.ok ? "OK" : "Warning", value: monitoring.cache?.error || `${monitoring.cache?.latency_ms ?? "-"} ms` },
    { id: "queue", layer: "Workers / Queue", status: monitoring.queue?.ok ? "OK" : "Warning", value: monitoring.queue?.note || "-" },
    { id: "ws", layer: "WebSocket", status: monitoring.websocket?.ok ? "OK" : "A configurer", value: monitoring.websocket?.note || "-" },
  ];

  return (
    <SuperRootPageShell
      title="Infrastructure"
      subtitle="Vue technique des couches API, base de donnees, cache, workers et realtime."
      actions={<button className="sr-btn sr-btn-outline" onClick={reload}>Actualiser</button>}
    >
      <SuperRootState loading={loading} error={error}>
        <SrCard title="Etat infrastructure">
          <SrTable
            columns={[
              { key: "layer", label: "Couche" },
              { key: "status", label: "Statut", render: (row) => <SrBadge tone={row.status === "OK" ? "ok" : "warning"}>{row.status}</SrBadge> },
              { key: "value", label: "Details" },
            ]}
            rows={rows}
          />
        </SrCard>
      </SuperRootState>
    </SuperRootPageShell>
  );
}
