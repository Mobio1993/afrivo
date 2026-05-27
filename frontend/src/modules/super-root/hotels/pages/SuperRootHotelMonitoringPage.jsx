import { SuperRootPageShell, SuperRootState } from "../../../../features/super-root/shared/SuperRootShared";
import { superRootHotelsApi } from "../api/superRootHotelsApi";
import HotelDetailLayout from "../detail/HotelDetailLayout";
import HotelApiHealth from "../monitoring/HotelApiHealth";
import HotelDatabaseUsage from "../monitoring/HotelDatabaseUsage";
import HotelPerformanceMetrics from "../monitoring/HotelPerformanceMetrics";
import HotelStorageUsage from "../monitoring/HotelStorageUsage";
import { useHotelPageData } from "./useHotelPageData";

export default function SuperRootHotelMonitoringPage() {
  const { hotelId, data, loading, error } = useHotelPageData(superRootHotelsApi.getHotelMonitoring);
  return (
    <SuperRootPageShell title={data?.hotel?.name || "Monitoring hotel"} subtitle="Sante technique et performance du tenant hotel.">
      <HotelDetailLayout hotelId={hotelId} hotel={data?.hotel}>
        <SuperRootState loading={loading} error={error}>
          <div className="sr-grid-2">
            <HotelApiHealth monitoring={data?.monitoring} />
            <HotelDatabaseUsage monitoring={data?.monitoring} />
            <HotelStorageUsage monitoring={data?.monitoring} />
            <HotelPerformanceMetrics monitoring={data?.monitoring} />
          </div>
        </SuperRootState>
      </HotelDetailLayout>
    </SuperRootPageShell>
  );
}
