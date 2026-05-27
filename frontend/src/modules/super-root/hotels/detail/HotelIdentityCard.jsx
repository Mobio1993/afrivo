import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelIdentityCard({ identity = {} }) {
  return (
    <SrCard title="Identite hotel">
      <div className="sr-list">
        <div className="sr-list-row"><span className="sr-row-main">Nom</span><strong>{identity.name || "-"}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Code</span><strong>{identity.code || "-"}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Localisation</span><strong>{[identity.city, identity.country].filter(Boolean).join(", ") || "-"}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Fuseau</span><strong>{identity.timezone || "-"}</strong></div>
      </div>
    </SrCard>
  );
}
