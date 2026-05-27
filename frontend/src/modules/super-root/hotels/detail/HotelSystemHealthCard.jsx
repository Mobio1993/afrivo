import { SrBadge, SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelSystemHealthCard({ monitoring = {} }) {
  const tone = monitoring.system_health === "critique" ? "danger" : monitoring.system_health === "attention" ? "warning" : "ok";
  return (
    <SrCard title="Sante systeme">
      <div className="sr-list">
        <div className="sr-list-row"><span className="sr-row-main">Sante</span><SrBadge tone={tone}>{monitoring.system_health || "ok"}</SrBadge></div>
        <div className="sr-list-row"><span className="sr-row-main">API</span><strong>{monitoring.api_status || "-"}</strong></div>
        <div className="sr-list-row"><span className="sr-row-main">Performance</span><strong>{monitoring.performance_score ?? "-"} / 100</strong></div>
      </div>
    </SrCard>
  );
}
