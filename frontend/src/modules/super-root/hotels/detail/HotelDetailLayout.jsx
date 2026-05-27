import { Link, NavLink } from "react-router-dom";
import HotelDetailHero from "./HotelDetailHero";

const TABS = [
  { label: "Overview", to: "" },
  { label: "Modules", to: "modules" },
  { label: "Security", to: "security" },
  { label: "Billing", to: "billing" },
  { label: "Monitoring", to: "monitoring" },
  { label: "Audit Logs", to: "audit" },
];

export default function HotelDetailLayout({ hotelId, hotel, children }) {
  return (
    <>
      <div className="sr-hotel-back-row">
        <Link className="sr-hotel-back-link" to="/super-root/hotels">
          <i className="ti ti-arrow-left" aria-hidden="true" />
          Tous les hotels
        </Link>
      </div>
      {hotel ? <HotelDetailHero hotel={hotel} /> : null}
      <nav className="sr-tabs" aria-label="Navigation detail hotel">
        {TABS.map((tab) => (
          <NavLink
            key={tab.label}
            end={tab.to === ""}
            className={({ isActive }) => `sr-tab ${isActive ? "active" : ""}`}
            to={`/super-root/hotels/${hotelId}${tab.to ? `/${tab.to}` : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <div className="sr-hotel-detail-content">{children}</div>
    </>
  );
}
