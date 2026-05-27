import { SrBadge, SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelModulesCard({ modules = [] }) {
  return (
    <SrCard title="Modules actifs">
      <div className="sr-list">
        {modules.length ? modules.slice(0, 8).map((item) => (
          <div className="sr-list-row" key={item.id}>
            <span className="sr-row-main">{item.name}</span>
            <SrBadge tone={item.is_valid ? "ok" : "warning"}>{item.scope}</SrBadge>
          </div>
        )) : <div className="sr-empty">Aucun module actif.</div>}
      </div>
    </SrCard>
  );
}
