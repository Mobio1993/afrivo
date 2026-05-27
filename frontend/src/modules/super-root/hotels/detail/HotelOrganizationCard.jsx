import { SrBadge, SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelOrganizationCard({ organization = {} }) {
  return (
    <SrCard title="Organisation proprietaire">
      <div className="sr-list">
        <div className="sr-list-row"><span className="sr-row-main">{organization.name || "-"}</span><SrBadge tone={organization.is_active ? "ok" : "danger"}>{organization.status || "-"}</SrBadge></div>
        <div className="sr-list-row"><span className="sr-row-main">Slug</span><strong>{organization.slug || "-"}</strong></div>
      </div>
    </SrCard>
  );
}
