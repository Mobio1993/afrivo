import { SrBadge, SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelActivityFeed({ activity = [] }) {
  return (
    <SrCard title="Activite recente">
      <div className="sr-list">
        {activity.length ? activity.map((item) => (
          <div className="sr-list-row" key={item.id}>
            <div>
              <div className="sr-row-main">{item.description}</div>
              <div className="sr-row-sub">{item.actor} - {item.module}</div>
            </div>
            <SrBadge tone={item.severity === "danger" || item.severity === "critical" ? "danger" : "neutral"}>{item.action}</SrBadge>
          </div>
        )) : <div className="sr-empty">Aucune activite recente.</div>}
      </div>
    </SrCard>
  );
}
