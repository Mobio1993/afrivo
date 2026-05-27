import { Link } from "react-router-dom";

export default function HotelActionsMenu({ hotel }) {
  return (
    <div className="sr-hotel-actions" onClick={(event) => event.stopPropagation()}>
      <details className="sr-hotel-menu">
        <summary aria-label={`Actions pour ${hotel.name}`}>
          Actions
          <i className="ti ti-dots" aria-hidden="true" />
        </summary>
        <div className="sr-hotel-menu-list">
          <Link to={`/super-root/hotels/${hotel.id}/modules`}>Modules</Link>
          <Link to={`/super-root/hotels/${hotel.id}/security`}>Securite</Link>
          <Link to={`/super-root/hotels/${hotel.id}/billing`}>Billing</Link>
          <Link to={`/super-root/hotels/${hotel.id}/monitoring`}>Monitoring</Link>
          <Link to={`/super-root/hotels/${hotel.id}/audit`}>Audit</Link>
        </div>
      </details>
    </div>
  );
}
