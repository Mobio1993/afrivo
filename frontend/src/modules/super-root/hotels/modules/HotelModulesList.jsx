import { SrTable } from "../../../../features/super-root/shared/SuperRootShared";
import ModuleActivationStatus from "./ModuleActivationStatus";
import ModuleUsageQuota from "./ModuleUsageQuota";

export default function HotelModulesList({ modules = [] }) {
  return (
    <SrTable
      columns={[
        { key: "name", label: "Module" },
        { key: "code", label: "Code" },
        { key: "scope", label: "Scope" },
        { key: "status", label: "Statut", render: (row) => <ModuleActivationStatus module={row} /> },
        { key: "monthly_price", label: "Tarif", render: (row) => <ModuleUsageQuota module={row} /> },
        { key: "ends_at", label: "Expiration", render: (row) => row.ends_at ? new Date(row.ends_at).toLocaleDateString("fr-FR") : "Sans fin" },
      ]}
      rows={modules}
      empty="Aucun module rattache a cet hotel."
    />
  );
}
