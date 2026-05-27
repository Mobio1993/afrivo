import { SrCard } from "../../../../features/super-root/shared/SuperRootShared";
import HotelActivityFeed from "../detail/HotelActivityFeed";

export default function HotelSuspiciousActivity({ logs = [] }) {
  return (
    <SrCard title="Activite suspecte">
      <HotelActivityFeed activity={logs} />
    </SrCard>
  );
}
