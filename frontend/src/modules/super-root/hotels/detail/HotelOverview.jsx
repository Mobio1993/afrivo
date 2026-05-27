import HotelActivityFeed from "./HotelActivityFeed";
import HotelIdentityCard from "./HotelIdentityCard";
import HotelLicenseCard from "./HotelLicenseCard";
import HotelModulesCard from "./HotelModulesCard";
import HotelOrganizationCard from "./HotelOrganizationCard";
import HotelSecurityCard from "./HotelSecurityCard";
import HotelSystemHealthCard from "./HotelSystemHealthCard";

export default function HotelOverview({ data }) {
  return (
    <div className="sr-hotel-overview">
      <div className="sr-grid-3">
        <HotelIdentityCard identity={data.identity} />
        <HotelOrganizationCard organization={data.organization} />
        <HotelLicenseCard subscription={data.subscription} />
      </div>
      <div className="sr-grid-3">
        <HotelModulesCard modules={data.modules} />
        <HotelSystemHealthCard monitoring={data.monitoring} />
        <HotelSecurityCard security={data.security} />
      </div>
      <HotelActivityFeed activity={data.activity} />
    </div>
  );
}
