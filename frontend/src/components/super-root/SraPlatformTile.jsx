const SANTE_COLORS = {
  sain: { border: "var(--color-border-secondary)", uptime: "#0F6E56", dot: "#1D9E75" },
  attention: { border: "#EF9F27", uptime: "#633806", dot: "#EF9F27" },
  critique: { border: "#A32D2D", uptime: "#A32D2D", dot: "#A32D2D" },
};

export default function SraPlatformTile({ platform, onAction }) {
  const sante = SANTE_COLORS[platform.sante] || SANTE_COLORS.sain;
  const isSuspended = ["suspendue", "suspendu", "suspended"].includes((platform.statut || "").toLowerCase());
  const tileStatus = isSuspended ? "suspended" : platform.sante || "sain";
  const metrics = [
    { label: "Hotels", value: platform.hotels ?? "-" },
    { label: "Orgs", value: platform.orgs ?? "-" },
    { label: "Abo.", value: platform.abonnements ?? "-" },
    { label: "Admins", value: platform.admins ?? "-" },
  ];

  return (
    <div className={`sra-plat-tile sra-plat-${tileStatus}`}>
      <div className="sra-pt-head">
        <div className="sra-pt-brand">
          <div className="sra-pt-av" style={{ background: platform.avatarBg, color: platform.avatarColor }}>
            {platform.code || platform.nom?.slice(0, 2).toUpperCase() || "AF"}
          </div>
          <div>
            <div className="sra-pt-name">{platform.nom}</div>
            <div className="sra-pt-url">{platform.url || "-"}</div>
          </div>
        </div>
        <span className="sra-pt-uptime" style={{ color: sante.uptime }}>
          <span className="sra-pt-dot" style={{ background: sante.dot }} />
          {platform.uptime ?? "-"}%
        </span>
        <span className={`sra-pt-status sra-pt-status-${tileStatus}`}>
          {isSuspended ? "Suspendue" : platform.sante === "attention" ? "Attention" : platform.sante === "critique" ? "Critique" : "Active"}
        </span>
      </div>

      <div className="sra-pt-metrics">
        {metrics.map((metric) => (
          <div key={metric.label} className="sra-ptm">
            <span className="sra-ptm-l">{metric.label}</span>
            <span className="sra-ptm-v">{metric.value}</span>
          </div>
        ))}
      </div>

      <div className="sra-pt-footer">
        <div className="sra-pt-rev">
          <span className="sra-pt-rev-lbl">Revenus ce mois</span>
          <span className="sra-pt-rev-val" style={{ color: platform.revenueChange >= 0 ? "#0F6E56" : "#A32D2D" }}>
            {platform.revenueMois ? `${Number(platform.revenueMois).toLocaleString("fr-FR")} XOF` : "-"}
          </span>
        </div>
        <div className="sra-pt-actions">
          <button className="sra-pt-btn" onClick={() => onAction?.("view", platform)} type="button">Voir details</button>
          <button className="sra-pt-btn" onClick={() => onAction?.("admins", platform)} type="button">Admins</button>
          <button className="sra-pt-btn sra-pt-btn-manage" onClick={() => onAction?.("manage", platform)} type="button">
            Gerer
          </button>
        </div>
      </div>
    </div>
  );
}
