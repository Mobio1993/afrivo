import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelApiHealth({ monitoring = {} }) {
  return <SrCard title="API Health"><div className="sr-list"><div className="sr-list-row"><span className="sr-row-main">Statut API</span><strong>{monitoring.api_status || "-"}</strong></div></div></SrCard>;
}
