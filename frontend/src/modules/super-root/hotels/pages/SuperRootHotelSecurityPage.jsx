import { SrCard, SuperRootPageShell, SuperRootState } from "../../../../features/super-root/shared/SuperRootShared";
import { superRootHotelsApi } from "../api/superRootHotelsApi";
import HotelDetailLayout from "../detail/HotelDetailLayout";
import HotelAccessLogs from "../security/HotelAccessLogs";
import HotelSecurityOverview from "../security/HotelSecurityOverview";
import HotelSessions from "../security/HotelSessions";
import { useHotelPageData } from "./useHotelPageData";

export default function SuperRootHotelSecurityPage() {
  const { hotelId, data, loading, error } = useHotelPageData(superRootHotelsApi.getHotelSecurity);
  return (
    <SuperRootPageShell title={data?.hotel?.name || "Securite hotel"} subtitle="Sessions, acces, 2FA et activite sensible.">
      <HotelDetailLayout hotelId={hotelId} hotel={data?.hotel}>
        <SuperRootState loading={loading} error={error}>
          <HotelSecurityOverview security={data?.security} />
          <div className="sr-grid-2">
            <SrCard title="Sessions actives"><HotelSessions sessions={data?.sessions || []} /></SrCard>
            <SrCard title="Logs sensibles"><HotelAccessLogs logs={data?.access_logs || []} /></SrCard>
          </div>
        </SuperRootState>
      </HotelDetailLayout>
    </SuperRootPageShell>
  );
}
