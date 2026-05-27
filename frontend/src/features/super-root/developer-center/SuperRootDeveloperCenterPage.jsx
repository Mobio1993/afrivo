import { SrCard, SrTable, SuperRootPageShell } from "../shared/SuperRootShared";

export function SuperRootDeveloperCenterPage() {
  const endpoints = [
    { id: "dashboard", method: "GET", path: "/api/super-root/dashboard/", usage: "KPIs globaux" },
    { id: "monitoring", method: "GET", path: "/api/super-root/monitoring/", usage: "Monitoring read-only" },
    { id: "audit", method: "GET", path: "/api/super-root/audit-logs/", usage: "Audit logs filtres/export" },
    { id: "security", method: "GET", path: "/api/super-root/security/", usage: "IAM, MFA, sessions" },
    { id: "maintenance", method: "GET/POST", path: "/api/super-root/maintenance/", usage: "Readiness et actions confirmees" },
  ];

  return (
    <SuperRootPageShell
      title="Developer Center"
      subtitle="Contrats API internes, facades Super Root et points d'extension techniques."
    >
      <SrCard title="Endpoints Super Root">
        <SrTable
          columns={[
            { key: "method", label: "Methode" },
            { key: "path", label: "Endpoint" },
            { key: "usage", label: "Usage" },
          ]}
          rows={endpoints}
        />
      </SrCard>
    </SuperRootPageShell>
  );
}
