import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelDatabaseUsage({ monitoring = {} }) {
  return <SrCard title="Database"><div className="sr-list"><div className="sr-list-row"><span className="sr-row-main">Statut DB</span><strong>{monitoring.database_status || "-"}</strong></div></div></SrCard>;
}
