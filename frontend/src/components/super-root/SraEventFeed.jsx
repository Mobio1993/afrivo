const SEVERITY_STYLE = {
  critique: { dot: "#A32D2D", tagBg: "#FCEBEB", tagColor: "#A32D2D", tagLabel: "Critique" },
  attention: { dot: "#EF9F27", tagBg: "#FAEEDA", tagColor: "#633806", tagLabel: "Attention" },
  info: { dot: "#378ADD", tagBg: "#E6F1FB", tagColor: "#185FA5", tagLabel: "Info" },
  ok: { dot: "#1D9E75", tagBg: "#E1F5EE", tagColor: "#0F6E56", tagLabel: "OK" },
};

const TYPE_STYLE = {
  organization: { label: "Organisation", bg: "#E1F5EE", color: "#0F6E56" },
  user: { label: "User", bg: "#E6F1FB", color: "#185FA5" },
  security: { label: "Security", bg: "#FCEBEB", color: "#A32D2D" },
  system: { label: "System", bg: "#F1EFE8", color: "#5F5E5A" },
};

function getEventType(event) {
  const raw = `${event.platform || ""} ${event.title || ""} ${event.description || ""}`.toLowerCase();
  if (raw.includes("security") || raw.includes("securite") || raw.includes("login") || raw.includes("session")) return TYPE_STYLE.security;
  if (raw.includes("user") || raw.includes("admin") || raw.includes("utilisateur")) return TYPE_STYLE.user;
  if (raw.includes("organization") || raw.includes("organisation") || raw.includes("tenant")) return TYPE_STYLE.organization;
  return TYPE_STYLE.system;
}

export default function SraEventFeed({ events = [] }) {
  return (
    <div className="sra-card sra-feed-card">
      <div className="sra-card-head">
        <span className="sra-card-title">Feed alertes & evenements live</span>
        <span className="sra-card-sub">Temps reel - 5 derniers</span>
      </div>
      <div className="sra-feed-rows">
        {events.length === 0 ? (
          <div className="sra-feed-empty">
            <div className="sra-empty-ico">
              <i className="ti ti-shield-check" aria-hidden="true"></i>
            </div>
            <div className="sra-empty-title">Aucune alerte critique</div>
            <div className="sra-empty-desc">
              Aucun evenement recent ne necessite une action Super Root.
            </div>
          </div>
        ) : (
          events.map((event, index) => {
            const sev = SEVERITY_STYLE[event.severity] || SEVERITY_STYLE.info;
            const type = getEventType(event);
            return (
              <div key={event.id ?? index} className="sra-feed-row">
                <div className="sra-feed-col-left">
                  <div className="sra-feed-dot" style={{ background: sev.dot }} />
                  {index < events.length - 1 && <div className="sra-feed-line" />}
                </div>
                <div className="sra-feed-ico" style={{ background: event.iconBg, color: event.iconColor }}>
                  <i className={`ti ${event.icon}`} aria-hidden="true"></i>
                </div>
                <div className="sra-feed-content">
                  <div className="sra-feed-main">
                    <div className="sra-feed-text">
                      <div className="sra-feed-title" title={event.title}>{event.title}</div>
                      {event.description && (
                        <div className="sra-feed-desc" title={event.description}>
                          {event.description}
                        </div>
                      )}
                    </div>
                    <span className="sra-feed-time">{event.time}</span>
                  </div>
                  <div className="sra-feed-meta">
                    <span
                      className="sra-feed-type"
                      style={{ background: type.bg, color: type.color }}
                    >
                      {type.label}
                    </span>
                    {event.platform && <span className="sra-feed-plat">{event.platform}</span>}
                    <span className="sra-feed-tag" style={{ background: sev.tagBg, color: sev.tagColor }}>
                      {sev.tagLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
