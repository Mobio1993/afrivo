export default function VpAbonnements({ data }) {
  const rows = [
    { label: "Actif", pill: "vp-pill-actif", val: data.abonnements_actifs, valColor: "#0F6E56" },
    { label: "Essai", pill: "vp-pill-essai", val: data.abonnements_essai },
    { label: "Suspendu", pill: "vp-pill-suspendu", val: data.abonnements_suspendus },
    { label: "Expire", pill: "vp-pill-expire", val: data.abonnements_expires, valColor: "#A32D2D" },
  ];

  return (
    <div className="vp-card">
      <div className="vp-card-head">
        <span className="vp-card-title">Abonnements</span>
        <span className="vp-pill vp-pill-actif">{data.abonnements_actifs} actifs</span>
      </div>
      {rows.map((row) => (
        <div key={row.label} className="vp-abo-row">
          <span className={`vp-pill ${row.pill}`}>{row.label}</span>
          <span className="vp-abo-val" style={row.valColor ? { color: row.valColor } : {}}>
            {row.val}
          </span>
        </div>
      ))}
      <div className="vp-abo-retention">
        <div className="vp-abo-ret-row">
          <span className="vp-abo-ret-lbl">Taux de retention</span>
          <span className="vp-abo-ret-val" style={{ color: "#0F6E56" }}>
            {data.taux_retention_pct}%
          </span>
        </div>
        <div className="vp-ret-bar">
          <div
            className="vp-ret-fill"
            style={{
              width: `${data.taux_retention_pct}%`,
              background:
                data.taux_retention_pct >= 80
                  ? "#1D9E75"
                  : data.taux_retention_pct >= 50
                    ? "#EF9F27"
                    : "#E24B4A",
            }}
          />
        </div>
      </div>
    </div>
  );
}
