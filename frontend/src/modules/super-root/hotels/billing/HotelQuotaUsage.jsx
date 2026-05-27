import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelQuotaUsage({ quota = {} }) {
  return (
    <SrCard title="Consommation quota">
      <div className="sr-list">
        <div className="sr-list-row"><span className="sr-row-main">Utilises</span><strong>{quota.used ?? 0}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Quota</span><strong>{quota.quota || "Sans limite"}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Pourcentage</span><strong>{quota.percent ?? 0}%</strong></div>
      </div>
    </SrCard>
  );
}
