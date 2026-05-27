import { SrBadge, SrCard, SrKpiGrid, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { useSuperRootResource } from "../shared/useSuperRootApi";

export function SuperRootDashboardPage() {
  const { data, error, loading, reload } = useSuperRootResource("dashboard");
  const dashboard = data?.dashboard || {};
  const kpis = dashboard.kpis || {};

  return (
    <SuperRootPageShell
      title="Dashboard systeme"
      subtitle="Vue technique globale reservee au Super Root."
      actions={<button className="sr-btn sr-btn-outline" onClick={reload}>Actualiser</button>}
    >
      <SuperRootState loading={loading} error={error}>
        <SrKpiGrid
          items={[
            { label: "Organisations", value: kpis.organizations_total ?? 0, meta: `${kpis.organizations_active ?? 0} actives` },
            { label: "Hotels", value: kpis.hotels_total ?? 0, meta: `${kpis.hotels_active ?? 0} actifs` },
            { label: "Utilisateurs", value: kpis.users_total ?? 0, meta: `${kpis.users_active ?? 0} actifs` },
            { label: "Super Roots", value: kpis.super_roots ?? 0 },
            { label: "Licences actives", value: kpis.licenses_active ?? 0 },
            { label: "Activite du jour", value: kpis.activity_today ?? 0 },
          ]}
        />

        <div className="sr-grid-2">
          <SrCard title="Alertes globales">
            <div className="sr-list">
              {(dashboard.alerts || []).map((alert, index) => (
                <div className="sr-list-row" key={`${alert.type}-${index}`}>
                  <div className="sr-row-main">{alert.message}</div>
                  <SrBadge tone={alert.type === "critical" ? "critical" : alert.type}>{alert.type}</SrBadge>
                </div>
              ))}
            </div>
          </SrCard>
          <SrCard title="Evenements plateforme recents">
            <div className="sr-list">
              {(dashboard.recent_platform_events || []).map((event) => (
                <div className="sr-list-row" key={event.id}>
                  <div>
                    <div className="sr-row-main">{event.event_type}</div>
                    <div className="sr-row-sub">{event.actor} - {event.target_label}</div>
                  </div>
                  <SrBadge>{event.target_type || "event"}</SrBadge>
                </div>
              ))}
            </div>
          </SrCard>
        </div>
      </SuperRootState>
    </SuperRootPageShell>
  );
}
