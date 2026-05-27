import { SrCard, SuperRootPageShell, SuperRootState } from "../../../../features/super-root/shared/SuperRootShared";
import { superRootHotelsApi } from "../api/superRootHotelsApi";
import HotelDetailLayout from "../detail/HotelDetailLayout";
import HotelModulesList from "../modules/HotelModulesList";
import { useHotelPageData } from "./useHotelPageData";

export default function SuperRootHotelModulesPage() {
  const { hotelId, data, loading, error } = useHotelPageData(superRootHotelsApi.getHotelModules);
  return (
    <SuperRootPageShell title={data?.hotel?.name || "Modules hotel"} subtitle="Modules actifs, licences et scopes rattaches a l'hotel.">
      <HotelDetailLayout hotelId={hotelId} hotel={data?.hotel}>
        <SuperRootState loading={loading} error={error}>
          <SrCard title="Modules & licences">
            <HotelModulesList modules={data?.modules || []} />
          </SrCard>
        </SuperRootState>
      </HotelDetailLayout>
    </SuperRootPageShell>
  );
}
