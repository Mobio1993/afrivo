import { useState } from "react";

import SuperRootConfirmModal from "../shared/SuperRootConfirmModal";
import { SrBadge, SrCard, SrKpiGrid, SrTable, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { useSuperRootResource } from "../shared/useSuperRootApi";
import { superRootSecurityApi } from "./superRootSecurityApi";

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function SuperRootSecurityPage() {
  const { data, error, loading, reload } = useSuperRootResource("security");
  const [revokingId, setRevokingId] = useState(null);
  const [confirmSession, setConfirmSession] = useState(null);
  const [actionError, setActionError] = useState("");
  const security = data?.security || {};
  const policy = security.policy || {};

  async function revokeSession(sessionId, confirmation = null) {
    setRevokingId(sessionId);
    setActionError("");
    try {
      await superRootSecurityApi.revokeSession(sessionId, confirmation);
      await reload();
      setConfirmSession(null);
    } catch (err) {
      setActionError(err.payload?.detail || err.message || "Revocation impossible.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <SuperRootPageShell
      title="Securite globale"
      subtitle="Politiques techniques et surveillance des comptes sensibles."
      actions={<button className="sr-btn sr-btn-outline" onClick={reload}>Actualiser</button>}
    >
      <SuperRootState loading={loading} error={error}>
        <SrKpiGrid
          items={[
            { label: "Comptes sensibles", value: security.sensitive_users_total ?? 0 },
            { label: "Sans 2FA", value: security.sensitive_users_without_2fa?.length ?? 0 },
            { label: "Comptes verrouilles", value: security.locked_users?.length ?? 0 },
            { label: "Sessions Super Root", value: security.active_super_root_sessions?.length ?? 0 },
          ]}
        />

        {actionError ? <div className="sr-error">{actionError}</div> : null}

        <SrCard title="Sessions Super Root actives">
          <SrTable
            columns={[
              { key: "username", label: "Utilisateur" },
              { key: "device_name", label: "Appareil" },
              { key: "browser", label: "Navigateur" },
              { key: "os", label: "OS" },
              { key: "ip_address", label: "IP" },
              { key: "last_activity", label: "Derniere activite", render: (row) => formatDate(row.last_activity) },
              {
                key: "actions",
                label: "Action",
                render: (row) => (
                  <button
                    className="sr-btn sr-btn-outline"
                    type="button"
                    onClick={() => setConfirmSession(row)}
                    disabled={revokingId === row.id}
                  >
                    {revokingId === row.id ? "Revocation..." : "Revoquer"}
                  </button>
                ),
              },
            ]}
            rows={security.active_super_root_sessions || []}
            empty="Aucune session Super Root active."
          />
        </SrCard>

        <div className="sr-grid-2">
          <SrCard title="Comptes sensibles sans 2FA">
            <SrTable
              columns={[
                { key: "username", label: "Utilisateur" },
                { key: "email", label: "Email" },
                { key: "is_super_root", label: "Super Root", render: (row) => (row.is_super_root ? "Oui" : "Non") },
              ]}
              rows={security.sensitive_users_without_2fa || []}
              empty="Tous les comptes sensibles ont la 2FA."
            />
          </SrCard>
          <SrCard title="Politique de securite">
            <SrTable
              columns={[
                { key: "name", label: "Regle" },
                { key: "value", label: "Valeur" },
              ]}
              rows={[
                { id: "2fa", name: "2FA sensible", value: policy.auth_enforce_sensitive_2fa ? "ON" : "OFF" },
                { id: "debug", name: "Debug", value: policy.debug ? "ON" : "OFF" },
                { id: "hosts", name: "Allowed hosts", value: policy.allowed_hosts_count ?? 0 },
              ]}
            />
          </SrCard>
        </div>

        <div className="sr-grid-2">
          <SrCard title="Activite sensible recente">
            <div className="sr-list">
              {(security.recent_sensitive_activity || []).map((item) => (
                <div className="sr-list-row" key={item.id}>
                  <div>
                    <div className="sr-row-main">{item.description}</div>
                    <div className="sr-row-sub">{item.module} - {item.user}</div>
                  </div>
                  <SrBadge tone={item.severity === "danger" ? "danger" : "warning"}>{item.severity}</SrBadge>
                </div>
              ))}
            </div>
          </SrCard>
        </div>

        {confirmSession ? (
          <SuperRootConfirmModal
            title="Revoquer cette session Super Root ?"
            description="L'utilisateur sera deconnecte de cette session et devra repasser par le login renforce et la MFA."
            target={`${confirmSession.username || "Utilisateur"} - ${confirmSession.device_name || confirmSession.ip_address || "session active"}`}
            risk="high"
            requiredPhrase="CONFIRMER"
            confirmLabel="Revoquer la session"
            busy={revokingId === confirmSession.id}
            onCancel={() => setConfirmSession(null)}
            onConfirm={() => revokeSession(confirmSession.id, {
              confirmed: true,
              phrase: "CONFIRMER",
            })}
          />
        ) : null}
      </SuperRootState>
    </SuperRootPageShell>
  );
}
