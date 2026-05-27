import { SrBadge, SrCard, SrTable, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { useSuperRootResource } from "../shared/useSuperRootApi";

export function SuperRootNotificationsPage() {
  const { data, error, loading, reload } = useSuperRootResource("dashboard");
  const dashboard = data?.dashboard || {};
  const rows = (dashboard.alerts || []).map((alert, index) => ({
    id: index,
    type: alert.type,
    message: alert.message,
    channel: "Console Super Root",
    status: alert.type === "ok" ? "Traite" : "A surveiller",
  }));

  return (
    <SuperRootPageShell
      title="Notifications"
      subtitle="Centre de notifications systeme, alertes critiques et messages operationnels."
      actions={<button className="sr-btn sr-btn-outline" onClick={reload}>Actualiser</button>}
    >
      <SuperRootState loading={loading} error={error}>
        <SrCard title="Notifications actives">
          <SrTable
            columns={[
              { key: "type", label: "Type", render: (row) => <SrBadge tone={row.type === "ok" ? "ok" : row.type === "critical" ? "danger" : "warning"}>{row.type}</SrBadge> },
              { key: "message", label: "Message" },
              { key: "channel", label: "Canal" },
              { key: "status", label: "Statut" },
            ]}
            rows={rows}
            empty="Aucune notification active."
          />
        </SrCard>
      </SuperRootState>
    </SuperRootPageShell>
  );
}
