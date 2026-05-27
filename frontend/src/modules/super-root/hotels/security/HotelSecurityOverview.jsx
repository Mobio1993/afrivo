import { SrKpiGrid } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelSecurityOverview({ security = {} }) {
  return (
    <SrKpiGrid
      items={[
        { label: "Utilisateurs", value: security.users_total ?? 0 },
        { label: "Actifs", value: security.active_users ?? 0 },
        { label: "Admins", value: security.admins ?? 0 },
        { label: "Sans 2FA", value: security.without_2fa ?? 0 },
        { label: "Verrouilles", value: security.locked_users ?? 0 },
      ]}
    />
  );
}
