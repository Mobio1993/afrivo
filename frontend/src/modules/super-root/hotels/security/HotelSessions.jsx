import { SrTable } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelSessions({ sessions = [] }) {
  return (
    <SrTable
      columns={[
        { key: "username", label: "Utilisateur" },
        { key: "device_name", label: "Appareil" },
        { key: "browser", label: "Navigateur" },
        { key: "ip_address", label: "IP" },
        { key: "last_activity", label: "Derniere activite", render: (row) => row.last_activity ? new Date(row.last_activity).toLocaleString("fr-FR") : "-" },
      ]}
      rows={sessions}
      empty="Aucune session active pour cet hotel."
    />
  );
}
