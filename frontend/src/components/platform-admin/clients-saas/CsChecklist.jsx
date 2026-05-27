const STATUT_CFG = {
  sain: { icon: "ti-circle-check", color: "#0F6E56", bg: "#E1F5EE", label: "Sain" },
  attention: { icon: "ti-alert-triangle", color: "#633806", bg: "#FAEEDA", label: "Attention" },
  critique: { icon: "ti-alert-circle", color: "#A32D2D", bg: "#FCEBEB", label: "Critique" },
};

export default function CsChecklist({ checklist = [] }) {
  const issues = checklist.filter((item) => item.statut !== "sain").length;

  return (
    <div className="cs-card cs-checklist-card">
      <div className="cs-card-head">
        <span className="cs-card-title">Checklist portefeuille</span>
        <span
          className="cs-pill"
          style={issues === 0 ? { background: "#E1F5EE", color: "#0F6E56" } : { background: "#FAEEDA", color: "#633806" }}
        >
          {issues === 0 ? "Tout OK" : `${issues} point(s)`}
        </span>
      </div>
      <div className="cs-checklist-rows">
        {checklist.map((item) => {
          const cfg = STATUT_CFG[item.statut] || STATUT_CFG.sain;
          return (
            <div key={item.id} className="cs-check-row">
              <i className={`ti ${cfg.icon} cs-check-ico`} style={{ color: cfg.color }} aria-hidden="true"></i>
              <div className="cs-check-info">
                <span className="cs-check-lbl">{item.label}</span>
                <span className="cs-check-desc">{item.description}</span>
              </div>
              <span className="cs-check-badge" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
