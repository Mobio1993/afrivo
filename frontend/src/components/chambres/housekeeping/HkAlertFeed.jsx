export default function HkAlertFeed({ alertes = [] }) {
  if (!alertes.length) return <div className="hk-empty">Aucune alerte - toutes les taches sont dans les temps</div>;

  return (
    <div className="hk-alert-feed">
      {alertes.map((alert, index) => (
        <div key={index} className={`hk-al-row ${alert.type === "critique" ? "hk-al-crit" : alert.type === "ok" ? "hk-al-ok" : "hk-al-warn"}`}>
          <span className="hk-al-room">Ch. {alert.chambre}</span>
          <span className="hk-al-msg">{alert.message}</span>
          <span className="hk-al-time">{alert.time}</span>
        </div>
      ))}
    </div>
  );
}
