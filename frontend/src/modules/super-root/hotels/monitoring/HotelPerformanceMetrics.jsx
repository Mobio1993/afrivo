import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";

export default function HotelPerformanceMetrics({ monitoring = {} }) {
  return <SrCard title="Performance"><div className="sr-list"><div className="sr-list-row"><span className="sr-row-main">Score</span><strong>{monitoring.performance_score ?? "-"} / 100</strong></div></div></SrCard>;
}
