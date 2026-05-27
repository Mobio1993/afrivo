export default function PhAlertFeed({ alertes = [] }) {
  const critiques = alertes.filter((item) => item.type === "critique").length;
  const warnings = alertes.filter((item) => item.type === "warning").length;

  return (
    <div className="ph-card">
      <div className="ph-card-head">
        <span className="ph-card-title">
          Alertes & surveillance
          {critiques > 0 && <span className="ph-alert-badge ph-alert-badge-crit">{critiques}</span>}
          {warnings > 0 && <span className="ph-alert-badge ph-alert-badge-warn">{warnings}</span>}
        </span>
      </div>
      <div className="ph-alert-list">
        {alertes.map((alerte, index) => (
          <div key={`${alerte.hotel_code}-${index}`} className={`ph-al-row ph-al-${alerte.type}`}>
            <span className="ph-al-hotel">
              {alerte.hotel_code ? `[${alerte.hotel_code}]` : ""} {alerte.hotel_nom}
            </span>
            <span className="ph-al-msg">{alerte.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
