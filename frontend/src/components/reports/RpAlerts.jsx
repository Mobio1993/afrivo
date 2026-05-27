const ALERT_STYLES = {
  warning: { bg: "#FAEEDA", color: "#633806", icon: "!" },
  error: { bg: "#FCEBEB", color: "#A32D2D", icon: "×" },
  success: { bg: "#E1F5EE", color: "#0F6E56", icon: "✓" },
};

export default function RpAlerts({ alerts = [] }) {
  if (!alerts.length) {
    return null;
  }

  return (
    <div className="rp-alerts">
      <div className="rp-sec-label">Alertes operationnelles</div>
      {alerts.map((alert, index) => {
        const style = ALERT_STYLES[alert.type] || ALERT_STYLES.warning;
        return (
          <div key={`${alert.type}-${index}`} className="rp-alert-row" style={{ background: style.bg, color: style.color }}>
            <span className="rp-alert-icon">{style.icon}</span>
            <span className="rp-alert-msg">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
