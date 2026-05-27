const ACTION_COLORS = {
  primary: { bg: "#1D9E75", icoColor: "rgba(255,255,255,.8)", lbl: "#fff" },
  green: { bg: "#E1F5EE", icoColor: "#0F6E56" },
  blue: { bg: "#E6F1FB", icoColor: "#185FA5" },
  purple: { bg: "#EEEDFE", icoColor: "#3C3489" },
};

export default function VpQuickActions({ actions = [] }) {
  return (
    <div className="vp-card">
      <div className="vp-card-head">
        <span className="vp-card-title">Actions rapides</span>
      </div>
      <div className="vp-actions-body">
        {actions.map((action) => {
          const c = ACTION_COLORS[action.color] || ACTION_COLORS.green;
          return (
            <button
              key={action.id}
              className={`vp-action-btn ${action.color === "primary" ? "vp-action-primary" : ""}`}
              onClick={action.onClick}
              style={action.color === "primary" ? { background: "#1D9E75", borderColor: "#1D9E75" } : {}}
            >
              <div className="vp-action-ico" style={{ background: c.bg, color: c.icoColor }}>
                <i className={`ti ${action.icon}`} aria-hidden="true"></i>
              </div>
              <span className="vp-action-lbl" style={c.lbl ? { color: c.lbl } : {}}>
                {action.label}
              </span>
              <i
                className="ti ti-arrow-right vp-action-arrow"
                style={c.lbl ? { color: "rgba(255,255,255,.6)" } : {}}
                aria-hidden="true"
              ></i>
            </button>
          );
        })}
      </div>
    </div>
  );
}
