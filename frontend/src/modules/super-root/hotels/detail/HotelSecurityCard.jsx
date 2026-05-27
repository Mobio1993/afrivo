import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelSecurityCard({ security = {} }) {
  return (
    <SrCard title="Securite">
      <div className="sr-list">
        <div className="sr-list-row"><span className="sr-row-main">Utilisateurs actifs</span><strong>{security.active_users ?? 0}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Admins</span><strong>{security.admins ?? 0}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Sans 2FA</span><strong>{security.without_2fa ?? 0}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Verrouilles</span><strong>{security.locked_users ?? 0}</strong></div>
      </div>
    </SrCard>
  );
}
