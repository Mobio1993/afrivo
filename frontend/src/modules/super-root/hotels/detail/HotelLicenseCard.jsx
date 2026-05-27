import { SrBadge, SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelLicenseCard({ subscription = {} }) {
  const quota = subscription.quota || {};
  return (
    <SrCard title="Abonnement & quota">
      <div className="sr-list">
        <div className="sr-list-row"><span className="sr-row-main">{subscription.plan_name || "Aucun plan"}</span><SrBadge tone={subscription.status === "active" ? "ok" : "warning"}>{subscription.status || "none"}</SrBadge></div>
        <div className="sr-list-row"><span className="sr-row-main">Quota utilisateurs</span><strong>{quota.used ?? 0} / {quota.quota || "Sans limite"}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Statut quota</span><strong>{quota.status || "-"}</strong></div>
      </div>
    </SrCard>
  );
}
