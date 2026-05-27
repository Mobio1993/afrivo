import { SrCard, SuperRootPageShell, SuperRootState } from "../../../../features/super-root/shared/SuperRootShared";
import { superRootHotelsApi } from "../api/superRootHotelsApi";
import HotelInvoices from "../billing/HotelInvoices";
import HotelLicense from "../billing/HotelLicense";
import HotelQuotaUsage from "../billing/HotelQuotaUsage";
import HotelSubscription from "../billing/HotelSubscription";
import HotelDetailLayout from "../detail/HotelDetailLayout";
import { useHotelPageData } from "./useHotelPageData";

export default function SuperRootHotelBillingPage() {
  const { hotelId, data, loading, error } = useHotelPageData(superRootHotelsApi.getHotelBilling);
  return (
    <SuperRootPageShell title={data?.hotel?.name || "Billing hotel"} subtitle="Abonnement, licences modules, factures et consommation.">
      <HotelDetailLayout hotelId={hotelId} hotel={data?.hotel}>
        <SuperRootState loading={loading} error={error}>
          <div className="sr-grid-2">
            <HotelSubscription subscription={data?.subscription} />
            <HotelQuotaUsage quota={data?.quota_usage} />
          </div>
          <SrCard title="Licences"><HotelLicense licenses={data?.licenses || []} /></SrCard>
          <SrCard title="Factures"><HotelInvoices invoices={data?.invoices || []} /></SrCard>
        </SuperRootState>
      </HotelDetailLayout>
    </SuperRootPageShell>
  );
}
