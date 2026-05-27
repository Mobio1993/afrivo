const STATUT_CONFIG = {
  ok: { icon: "ti-circle-check", color: "#0F6E56", badgeBg: "#E1F5EE", badgeColor: "#0F6E56", badgeLabel: "Sain" },
  attention: {
    icon: "ti-alert-triangle",
    color: "#EF9F27",
    badgeBg: "#FAEEDA",
    badgeColor: "#633806",
    badgeLabel: "Attention",
  },
  critique: {
    icon: "ti-alert-circle",
    color: "#A32D2D",
    badgeBg: "#FCEBEB",
    badgeColor: "#A32D2D",
    badgeLabel: "Critique",
  },
};

export default function VpChecklist({ checklist = [] }) {
  const issueCount = checklist.filter((item) => item.statut !== "ok").length;

  return (
    <div className="vp-card">
      <div className="vp-card-head">
        <span className="vp-card-title">Checklist surveillance</span>
        <span
          className="vp-pill"
          style={issueCount === 0 ? { background: "#E1F5EE", color: "#0F6E56" } : { background: "#FAEEDA", color: "#633806" }}
        >
          {issueCount === 0 ? "Tout OK" : `${issueCount} point(s)`}
        </span>
      </div>
      <div className="vp-checklist-rows">
        {checklist.map((item) => {
          const cfg = STATUT_CONFIG[item.statut] || STATUT_CONFIG.ok;
          return (
            <div key={item.id} className="vp-check-row">
              <i className={`ti ${cfg.icon} vp-check-ico`} style={{ color: cfg.color }} aria-hidden="true"></i>
              <div className="vp-check-info">
                <span className="vp-check-lbl">{item.label}</span>
                <span className="vp-check-desc">{item.description}</span>
              </div>
              <span className="vp-check-badge" style={{ background: cfg.badgeBg, color: cfg.badgeColor }}>
                {cfg.badgeLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
