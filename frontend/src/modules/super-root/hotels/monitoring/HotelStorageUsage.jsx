import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelStorageUsage({ monitoring = {} }) {
  return <SrCard title="Storage"><div className="sr-list"><div className="sr-list-row"><span className="sr-row-main">Stockage</span><strong>{monitoring.storage_status || "-"}</strong></div></div></SrCard>;
}
