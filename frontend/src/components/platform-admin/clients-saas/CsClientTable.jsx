const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "actives", label: "Actives" },
  { key: "suspendues", label: "Suspendues" },
  { key: "attention", label: "A surveiller" },
];

const SANTE_CONFIG = {
  sain: { label: "Sain", dotColor: "#1D9E75", textColor: "#0F6E56" },
  attention: { label: "Attention", dotColor: "#EF9F27", textColor: "#633806" },
  critique: { label: "Critique", dotColor: "#A32D2D", textColor: "#A32D2D" },
};

const AV_COLORS = [
  { bg: "#E6F1FB", color: "#185FA5" },
  { bg: "#E1F5EE", color: "#0F6E56" },
  { bg: "#FAEEDA", color: "#633806" },
  { bg: "#EEEDFE", color: "#3C3489" },
  { bg: "#FCEBEB", color: "#A32D2D" },
];

function getAvatarColor(nom) {
  let hash = 0;
  for (let i = 0; i < (nom || "").length; i += 1) hash += nom.charCodeAt(i);
  return AV_COLORS[hash % AV_COLORS.length];
}

export default function CsClientTable({
  clients,
  search,
  onSearch,
  filter,
  onFilter,
  onView,
  onEdit,
}) {
  return (
    <div className="cs-card cs-table-card">
      <div className="cs-card-head">
        <span className="cs-card-title">
          Portefeuille clients
          <span className="cs-card-count">{clients.length}</span>
        </span>
      </div>

      <div className="cs-table-toolbar">
        <div className="cs-search-wrap">
          <i className="ti ti-search cs-search-ico" aria-hidden="true"></i>
          <input
            type="text"
            className="cs-search-input"
            placeholder="Rechercher par nom ou slug..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className="cs-filter-tabs">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              className={`cs-filter-btn ${filter === item.key ? "active" : ""}`}
              onClick={() => onFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cs-table-wrap">
        <table className="cs-table">
          <thead>
            <tr>
              <th style={{ width: "200px" }}>Organisation</th>
              <th style={{ width: "80px" }}>Etat</th>
              <th style={{ width: "55px" }}>Hotels</th>
              <th style={{ width: "55px" }}>Admins</th>
              <th style={{ width: "90px" }}>Quota</th>
              <th style={{ width: "80px" }}>Sante</th>
              <th style={{ width: "75px" }}></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="cs-table-empty">Aucun client trouve</td>
              </tr>
            ) : (
              clients.map((client) => {
                const avColor = getAvatarColor(client.nom);
                const sante = SANTE_CONFIG[client.sante_statut] || SANTE_CONFIG.sain;
                const quotaPct = client.quota_pct || 0;
                const barColor = quotaPct >= 90 ? "#E24B4A" : quotaPct >= 60 ? "#EF9F27" : "#1D9E75";
                const statut = client.statut_display;

                return (
                  <tr key={client.id} className="cs-tr" onClick={() => onView(client)}>
                    <td>
                      <div className="cs-org-row">
                        <div className="cs-av" style={{ background: avColor.bg, color: avColor.color }}>
                          {client.initiales}
                        </div>
                        <div className="cs-org-info">
                          <div className="cs-org-name">{client.nom}</div>
                          <div className="cs-org-slug">{client.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`cs-pill cs-pill-${statut === "Active" ? "actif" : "suspendu"}`}>
                        {statut}
                      </span>
                    </td>
                    <td className="cs-td-center">{client.hotels_count}</td>
                    <td className="cs-td-center">
                      <span style={client.admins_count === 0 ? { color: "#A32D2D", fontWeight: 500 } : {}}>
                        {client.admins_count}
                      </span>
                    </td>
                    <td>
                      <div className="cs-quota-cell">
                        <div className="cs-quota-txt">
                          {client.utilisateurs_actifs} / {client.plan_sans_limite ? "inf." : client.quota_plan}
                        </div>
                        <div className="cs-quota-bar">
                          <div className="cs-quota-fill" style={{ width: `${quotaPct}%`, background: barColor }} />
                        </div>
                        <div className="cs-quota-plan">{client.plan_nom}</div>
                      </div>
                    </td>
                    <td>
                      <span className="cs-sante" style={{ color: sante.textColor }}>
                        <span className="cs-sante-dot" style={{ background: sante.dotColor }} />
                        {sante.label}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="cs-actions-row">
                        <button className="cs-action-btn" title="Voir le detail" onClick={() => onView(client)}>
                          <i className="ti ti-eye" aria-hidden="true"></i>
                        </button>
                        <button className="cs-action-btn" title="Modifier" onClick={() => onEdit(client)}>
                          <i className="ti ti-edit" aria-hidden="true"></i>
                        </button>
                        <button className="cs-action-btn" title="Plus d'actions">
                          <i className="ti ti-dots" aria-hidden="true"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
