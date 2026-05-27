import { Link } from "react-router-dom";

import { SrBadge } from "../../../../features/super-root/shared/SuperRootShared";
import HotelStatusBadge from "../list/HotelStatusBadge";
import { formatHotelDate, hotelHealthLabel, hotelHealthTone, hotelInitials } from "../utils/hotelUi";

export default function HotelDetailHero({ hotel = {} }) {
  const location = [hotel.city, hotel.country].filter(Boolean).join(" / ") || "-";

  return (
    <section className={`sr-hotel-hero ${hotel.is_active === false ? "is-suspended" : ""}`}>
      <div className="sr-hotel-hero-main">
        <div className="sr-hotel-avatar sr-hotel-hero-avatar">{hotelInitials(hotel.name)}</div>
        <div>
          <div className="sr-hotel-hero-kicker">Fiche hotel Super Root</div>
          <h2>{hotel.name || "Hotel sans nom"}</h2>
          <p>{hotel.organization_name || "Organisation non renseignee"} / {location}</p>
        </div>
      </div>

      <div className="sr-hotel-hero-badges">
        <HotelStatusBadge active={hotel.is_active !== false} />
        <HotelStatusBadge status={hotel.subscription_status || "none"} />
        <SrBadge tone={hotelHealthTone(hotel.system_health)}>{hotelHealthLabel(hotel.system_health)}</SrBadge>
      </div>

      <div className="sr-hotel-hero-metrics">
        <div><span>Chambres</span><strong>{hotel.rooms_count ?? 0}</strong></div>
        <div><span>Modules</span><strong>{hotel.modules_active ?? 0}</strong></div>
        <div><span>Derniere activite</span><strong>{formatHotelDate(hotel.last_activity)}</strong></div>
      </div>

      <div className="sr-hotel-hero-actions">
        <Link to={`/super-root/hotels/${hotel.id || ""}/modules`}>Modules</Link>
        <Link to={`/super-root/hotels/${hotel.id || ""}/security`}>Securite</Link>
        <Link to={`/super-root/hotels/${hotel.id || ""}/audit`}>Audit</Link>
      </div>
    </section>
  );
}
