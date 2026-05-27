import { useNavigate } from "react-router-dom";

import { SrBadge } from "../../../../features/super-root/shared/SuperRootShared";
import HotelStatusBadge from "./HotelStatusBadge";
import { formatHotelDate, hotelHealthLabel, hotelHealthTone, hotelInitials } from "../utils/hotelUi";

export default function HotelsTable({ hotels }) {
  const navigate = useNavigate();

  if (!hotels?.length) {
    return (
      <div className="sr-hotels-empty">
        <strong>Aucun hotel trouve</strong>
        <span>Ajuste les filtres ou actualise le parc Super Root.</span>
      </div>
    );
  }

  return (
    <div className="sr-hotels-cards">
      {hotels.map((hotel) => {
        const location = [hotel.city, hotel.country].filter(Boolean).join(" / ") || "-";
        const openHotel = () => navigate(`/super-root/hotels/${hotel.id}`);

        return (
          <article
            className={`sr-hotel-card ${hotel.is_active ? "" : "is-suspended"}`}
            key={hotel.id}
            role="button"
            tabIndex={0}
            onClick={openHotel}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") openHotel();
            }}
            aria-label={`Ouvrir la fiche ${hotel.name}`}
          >
            <div className="sr-hotel-card-head">
              <div className="sr-hotel-brand">
                <div className="sr-hotel-avatar">{hotelInitials(hotel.name)}</div>
                <div>
                  <h3>{hotel.name || "Hotel sans nom"}</h3>
                  <p>{hotel.organization_name || "Organisation non renseignee"}</p>
                </div>
              </div>
              <div className="sr-hotel-status-group">
                <SrBadge tone={hotelHealthTone(hotel.system_health)}>{hotelHealthLabel(hotel.system_health)}</SrBadge>
                <HotelStatusBadge active={hotel.is_active} />
                <HotelStatusBadge status={hotel.subscription_status || "none"} />
                <span className="sr-hotel-open-hint">
                  Voir detail
                  <i className="ti ti-arrow-right" aria-hidden="true" />
                </span>
              </div>
            </div>

            <div className="sr-hotel-metrics">
              <div>
                <span>Chambres</span>
                <strong>{hotel.rooms_count ?? 0}</strong>
              </div>
              <div>
                <span>Modules</span>
                <strong>{hotel.modules_active ?? 0}</strong>
              </div>
              <div>
                <span>Localisation</span>
                <strong>{location}</strong>
              </div>
              <div>
                <span>Derniere activite</span>
                <strong>{formatHotelDate(hotel.last_activity)}</strong>
              </div>
            </div>

            <div className="sr-hotel-footer">
              <div className="sr-hotel-health">
                <span>Organisation / licence</span>
                <strong>{hotel.organization_name || "-"} / {hotel.subscription_status || "none"}</strong>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
