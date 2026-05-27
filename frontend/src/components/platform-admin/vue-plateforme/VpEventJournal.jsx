const EVENT_TYPE_CONFIG = {
  Organisation: { bg: "#FAEEDA", color: "#633806", icon: "ti-building" },
  Hotel: { bg: "#E1F5EE", color: "#0F6E56", icon: "ti-building-plus" },
  User: { bg: "#E6F1FB", color: "#185FA5", icon: "ti-user-plus" },
  Abonnement: { bg: "#EEEDFE", color: "#3C3489", icon: "ti-receipt" },
  Securite: { bg: "#FCEBEB", color: "#A32D2D", icon: "ti-shield-x" },
};

function getEventConfig(typeEntite) {
  const key = Object.keys(EVENT_TYPE_CONFIG).find((candidate) =>
    (typeEntite || "").toLowerCase().includes(candidate.toLowerCase()),
  );
  return EVENT_TYPE_CONFIG[key] || { bg: "#F1EFE8", color: "#5F5E5A", icon: "ti-info-circle" };
}

export default function VpEventJournal({ events = [] }) {
  const visible = events.slice(0, 5);

  return (
    <div className="vp-card">
      <div className="vp-card-head">
        <span className="vp-card-title">Journal d'activite securite</span>
        <span className="vp-card-sub">
          {events.length} evenement{events.length > 1 ? "s" : ""} recent{events.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="vp-journal-grid">
        {visible.length === 0 ? (
          <div className="vp-journal-empty">Aucun evenement enregistre</div>
        ) : (
          visible.map((eventItem, idx) => {
            const cfg = getEventConfig(eventItem.type_entite);
            return (
              <div
                key={eventItem.id || idx}
                className="vp-journal-cell"
                style={{ borderRight: idx < visible.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}
              >
                <div className="vp-journal-ico" style={{ background: cfg.bg, color: cfg.color }}>
                  <i className={`ti ${cfg.icon}`} aria-hidden="true"></i>
                </div>
                <div className="vp-journal-action">{eventItem.action}</div>
                <div className="vp-journal-desc">{eventItem.description}</div>
                <div className="vp-journal-meta">
                  <span className="vp-journal-time">{eventItem.created_at_display}</span>
                  {eventItem.type_entite ? (
                    <span className="vp-journal-tag" style={{ background: cfg.bg, color: cfg.color }}>
                      {eventItem.type_entite}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
