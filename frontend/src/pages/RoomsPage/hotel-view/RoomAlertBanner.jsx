export default function RoomAlertBanner({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <div className="hv-alert-banner">
      <div className="hv-alert-title">Alertes urgentes</div>
      <div className="hv-alert-list">
        {alerts.map((alert, index) => (
          <span key={`${alert.label}-${index}`} className="hv-alert-pill">
            <strong>{alert.label}</strong>
            {alert.detail}
          </span>
        ))}
      </div>
    </div>
  );
}
