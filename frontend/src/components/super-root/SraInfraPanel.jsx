const STATUT_STYLE = {
  ok: { dot: "#1D9E75", badgeBg: "#E1F5EE", badgeColor: "#0F6E56" },
  warning: { dot: "#EF9F27", badgeBg: "#FAEEDA", badgeColor: "#633806" },
  error: { dot: "#A32D2D", badgeBg: "#FCEBEB", badgeColor: "#A32D2D" },
  critical: { dot: "#A32D2D", badgeBg: "#FCEBEB", badgeColor: "#A32D2D" },
};

function panelStatus(status, issueCount) {
  if (status === "ok") return { label: "OK", cls: "ok" };
  if (status === "critical" || status === "error") return { label: "Critique", cls: "critical" };
  if (status === "warning") return { label: "Warning", cls: "warning" };
  return issueCount === 0 ? { label: "OK", cls: "ok" } : { label: "Warning", cls: "warning" };
}

export default function SraInfraPanel({ infraStatus = [], status = "" }) {
  const issueCount = infraStatus.filter((item) => item.statut !== "ok").length;
  const current = panelStatus(status, issueCount);
  const currentStyle = STATUT_STYLE[current.cls] || STATUT_STYLE.ok;

  return (
    <div className="sra-card sra-infra-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Infra & systeme</span>
        <span
          className="sra-pill"
          style={{ background: currentStyle.badgeBg, color: currentStyle.badgeColor }}
          title={issueCount === 0 ? "Aucun point d'attention" : `${issueCount} point(s) d'attention`}
        >
          {current.label}
        </span>
      </div>
      <div className="sra-infra-rows">
        {infraStatus.map((item) => {
          const style = STATUT_STYLE[item.statut] || STATUT_STYLE.ok;
          return (
            <div key={item.id} className={`sra-infra-row sra-infra-row-${item.statut}`}>
              <div className="sra-infra-dot" style={{ background: style.dot }} />
              <div className="sra-infra-ico">
                <i className={`ti ${item.icon}`} aria-hidden="true"></i>
              </div>
              <span className="sra-infra-lbl">{item.label}</span>
              <span className="sra-infra-badge" style={{ background: style.badgeBg, color: style.badgeColor }}>
                {item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
