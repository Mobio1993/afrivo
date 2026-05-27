import { SrBadge, SrCard, SrKpiGrid, SrTable, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { useSuperRootResource } from "../shared/useSuperRootApi";

function statusTone(ok) {
  return ok ? "ok" : "warning";
}

export function SuperRootMonitoringPage() {
  const { data, error, loading, reload } = useSuperRootResource("monitoring");
  const monitoring = data?.monitoring || {};
  const system = monitoring.system || {};

  const rows = [
    { id: "api", service: "API", ok: monitoring.api?.ok, value: `${monitoring.api?.latency_ms ?? "-"} ms`, note: "Latence probe interne" },
    { id: "database", service: "PostgreSQL", ok: monitoring.database?.ok, value: `${monitoring.database?.latency_ms ?? "-"} ms`, note: monitoring.database?.error || "Connexion OK" },
    { id: "cache", service: "Cache", ok: monitoring.cache?.ok, value: `${monitoring.cache?.latency_ms ?? "-"} ms`, note: monitoring.cache?.error || "Lecture/ecriture OK" },
    { id: "queue", service: "Queue", ok: monitoring.queue?.ok, value: `${monitoring.queue?.pending ?? 0} pending`, note: monitoring.queue?.note },
    { id: "websocket", service: "WebSocket", ok: monitoring.websocket?.ok, value: monitoring.websocket?.status || "-", note: monitoring.websocket?.note },
  ];

  return (
    <SuperRootPageShell
      title="Monitoring"
      subtitle="Sante temps reel des services techniques, latence API, base de donnees, cache et workers."
      actions={<button className="sr-btn sr-btn-outline" onClick={reload}>Actualiser</button>}
    >
      <SuperRootState loading={loading} error={error}>
        <SrKpiGrid
          items={[
            { label: "Statut global", value: monitoring.status === "ok" ? "OK" : "A surveiller" },
            { label: "API latency", value: `${monitoring.api?.latency_ms ?? "-"} ms` },
            { label: "DB latency", value: `${monitoring.database?.latency_ms ?? "-"} ms` },
            { label: "Cache latency", value: `${monitoring.cache?.latency_ms ?? "-"} ms` },
            { label: "Queue pending", value: monitoring.queue?.pending ?? 0 },
            { label: "Load avg", value: system.load_avg ?? "N/A" },
          ]}
        />

        <div className="sr-grid-2">
          <SrCard title="Services">
            <SrTable
              columns={[
                { key: "service", label: "Service" },
                { key: "status", label: "Statut", render: (row) => <SrBadge tone={statusTone(row.ok)}>{row.ok ? "OK" : "Warning"}</SrBadge> },
                { key: "value", label: "Mesure" },
                { key: "note", label: "Note" },
              ]}
              rows={rows}
            />
          </SrCard>
          <SrCard title="Systeme">
            <div className="sr-list">
              <div className="sr-list-row"><span className="sr-row-main">CPU</span><strong>{system.cpu_pct ?? "Agent requis"}</strong></div>
              <div className="sr-list-row"><span className="sr-row-main">RAM</span><strong>{system.ram_pct ?? "Agent requis"}</strong></div>
              <div className="sr-list-row"><span className="sr-row-main">Source</span><strong>{system.source || "-"}</strong></div>
              <div className="sr-list-row"><span className="sr-row-main">Dernier check</span><strong>{monitoring.checked_at ? new Date(monitoring.checked_at).toLocaleString("fr-FR") : "-"}</strong></div>
            </div>
          </SrCard>
        </div>
      </SuperRootState>
    </SuperRootPageShell>
  );
}
