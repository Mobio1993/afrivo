import { useState } from "react";

import SuperRootConfirmModal from "../shared/SuperRootConfirmModal";
import { SrCard, SrKpiGrid, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { runSuperRootMaintenance, useSuperRootResource } from "../shared/useSuperRootApi";

export function SuperRootMaintenancePage() {
  const { data, error, loading, reload } = useSuperRootResource("maintenance");
  const [feedback, setFeedback] = useState("");
  const [running, setRunning] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const maintenance = data?.maintenance || {};
  const readiness = data?.readiness || {};

  const handleRun = async (action, dryRun, confirmation = null) => {
    setRunning(true);
    setFeedback("");
    try {
      const payload = await runSuperRootMaintenance(action, dryRun, confirmation);
      setFeedback(payload.message || "Action executee.");
      await reload();
    } catch (err) {
      setFeedback(err.payload?.detail || err.message || "Action impossible.");
    } finally {
      setRunning(false);
    }
  };

  const confirmMaintenanceRun = async () => {
    if (!confirmAction) return;
    await handleRun(confirmAction.action, confirmAction.dryRun, {
      confirmed: true,
      phrase: "CONFIRMER",
    });
    setConfirmAction(null);
  };

  return (
    <SuperRootPageShell
      title="Maintenance"
      subtitle="Readiness, healthcheck et actions techniques reservees."
      actions={<button className="sr-btn sr-btn-outline" onClick={reload}>Actualiser</button>}
    >
      <SuperRootState loading={loading} error={error}>
        {feedback && <div className="sr-state">{feedback}</div>}
        <SrKpiGrid
          items={[
            { label: "Base de donnees", value: maintenance.database?.ok ? "OK" : "Erreur" },
            { label: "Cache", value: maintenance.cache?.ok ? "OK" : "Erreur" },
            { label: "Hotels", value: maintenance.tables?.hotels ?? 0 },
            { label: "Utilisateurs", value: maintenance.tables?.users ?? 0 },
            { label: "Readiness", value: readiness.ready ? "OK" : "A traiter" },
          ]}
        />
        <div className="sr-grid-2">
          <SrCard title="Readiness">
            <div className="sr-list">
              <div className="sr-list-row">
                <span className="sr-row-main">Hotels sans abonnement</span>
                <strong>{readiness.hotels_without_subscription ?? 0}</strong>
              </div>
              <div className="sr-list-row">
                <span className="sr-row-main">Utilisateurs sans scope</span>
                <strong>{readiness.users_without_scope ?? 0}</strong>
              </div>
              <div className="sr-list-row">
                <span className="sr-row-main">Organisations inactives avec hotels actifs</span>
                <strong>{readiness.inactive_organizations_with_active_hotels ?? 0}</strong>
              </div>
            </div>
          </SrCard>
          <SrCard title="Actions">
            <div className="sr-list">
              <button className="sr-btn sr-btn-outline" disabled={running} onClick={() => handleRun("healthcheck", true)}>
                Simuler healthcheck
              </button>
              <button className="sr-btn sr-btn-outline" disabled={running} onClick={() => handleRun("subscription_lifecycle", true)}>
                Simuler lifecycle abonnements
              </button>
              <button
                className="sr-btn"
                disabled={running}
                onClick={() => setConfirmAction({
                  action: "subscription_lifecycle",
                  dryRun: false,
                })}
              >
                Executer lifecycle abonnements
              </button>
            </div>
          </SrCard>
        </div>
      </SuperRootState>

      {confirmAction ? (
        <SuperRootConfirmModal
          title="Executer la maintenance ?"
          description="Cette action lance le lifecycle des abonnements en mode reel. Elle peut modifier des statuts d'abonnement et doit etre reservee a une intervention Super Root."
          target="Lifecycle abonnements"
          risk="critical"
          requiredPhrase="CONFIRMER"
          confirmLabel="Executer"
          busy={running}
          onCancel={() => setConfirmAction(null)}
          onConfirm={confirmMaintenanceRun}
        />
      ) : null}
    </SuperRootPageShell>
  );
}
