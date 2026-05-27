const STATUT_CFG = {
  sain: { icon: "ti-circle-check", color: "#0F6E56", bg: "#E1F5EE", label: "Sain" },
  attention: { icon: "ti-alert-triangle", color: "#633806", bg: "#FAEEDA", label: "Attention" },
  critique: { icon: "ti-alert-circle", color: "#A32D2D", bg: "#FCEBEB", label: "Critique" },
  info: { icon: "ti-info-circle", color: "#185FA5", bg: "#E6F1FB", label: "Info" },
};

export default function MpChecklist({ checklist = [] }) {
  const issues = checklist.filter((item) => item.statut !== "sain" && item.statut !== "info").length;

  return (
    <div className="mp-card">
      <div className="mp-card-head">
        <span className="mp-card-title">Checklist catalogue</span>
        <span
          className="mp-pill"
          style={
            issues === 0
              ? { background: "#E1F5EE", color: "#0F6E56" }
              : { background: "#FAEEDA", color: "#633806" }
          }
        >
          {issues === 0 ? "Tout OK" : `${issues} point(s)`}
        </span>
      </div>
      <div className="mp-checklist-rows">
        {checklist.map((item) => {
          const cfg = STATUT_CFG[item.statut] || STATUT_CFG.sain;
          return (
            <div key={item.id} className="mp-check-row">
              <i className={`ti ${cfg.icon} mp-check-ico`} style={{ color: cfg.color }} aria-hidden="true"></i>
              <div className="mp-check-info">
                <span className="mp-check-lbl">{item.label}</span>
                <span className="mp-check-desc">{item.description}</span>
              </div>
              <span className="mp-check-badge" style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
