const LEVEL_STYLE = {
  critique: { cls: "rt-al-critical", icon: "!" },
  critical: { cls: "rt-al-critical", icon: "!" },
  warning: { cls: "rt-al-warning", icon: "!" },
  info: { cls: "rt-al-info", icon: "i" },
  ok: { cls: "rt-al-ok", icon: "ok" },
};

export default function RtAlertFeed({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <div className="rt-section">
        <div className="rt-sec-label">Alertes temps reel</div>
        <div className="rt-empty">Aucune alerte active - parc operationnel</div>
      </div>
    );
  }

  return (
    <div className="rt-section">
      <div className="rt-sec-label">
        Alertes temps reel
        <span className="rt-badge-count">{alerts.filter((alert) => !alert.resolue).length}</span>
      </div>
      <div className="rt-alert-feed">
        {alerts.map((alert, index) => {
          const style = LEVEL_STYLE[alert.niveau] || LEVEL_STYLE.warning;
          return (
            <div key={`${alert.chambre_numero}-${index}`} className={`rt-al-row ${style.cls} ${alert.resolue ? "rt-al-resolue" : ""}`}>
              <div className={`rt-al-ico rt-al-ico-${alert.niveau || "warning"}`}>{style.icon}</div>
              <span className="rt-al-room">Ch. {alert.chambre_numero}</span>
              <span className="rt-al-msg">{alert.message}</span>
              <span className="rt-al-time">{alert.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
