import { SrBadge, SrTable } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelAuditLogs({ logs = [] }) {
  return (
    <SrTable
      columns={[
        { key: "created_at", label: "Date", render: (row) => row.created_at ? new Date(row.created_at).toLocaleString("fr-FR") : "-" },
        { key: "action", label: "Action" },
        { key: "module", label: "Module" },
        { key: "severity", label: "Severite", render: (row) => <SrBadge tone={row.severity === "critical" || row.severity === "danger" ? "danger" : row.severity === "warning" ? "warning" : "neutral"}>{row.severity}</SrBadge> },
        { key: "actor", label: "Acteur" },
        { key: "description", label: "Description" },
      ]}
      rows={logs}
      empty="Aucun log pour cet hotel."
    />
  );
}
