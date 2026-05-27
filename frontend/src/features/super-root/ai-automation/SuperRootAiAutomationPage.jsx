import { SrBadge, SrCard, SrTable, SuperRootPageShell } from "../shared/SuperRootShared";

export function SuperRootAiAutomationPage() {
  const rows = [
    { id: "health", name: "Synthese sante plateforme", status: "Pret", scope: "Dashboard Super Root" },
    { id: "audit", name: "Detection evenements sensibles", status: "A brancher", scope: "Audit logs" },
    { id: "quota", name: "Alertes quotas proactives", status: "A brancher", scope: "Licences & abonnements" },
  ];

  return (
    <SuperRootPageShell
      title="AI & Automation"
      subtitle="Point d'ancrage pour assistants, analyses automatiques, alertes proactives et playbooks."
    >
      <SrCard title="Automatisations preparees">
        <SrTable
          columns={[
            { key: "name", label: "Automatisation" },
            { key: "status", label: "Statut", render: (row) => <SrBadge tone={row.status === "Pret" ? "ok" : "warning"}>{row.status}</SrBadge> },
            { key: "scope", label: "Scope" },
          ]}
          rows={rows}
        />
      </SrCard>
    </SuperRootPageShell>
  );
}
