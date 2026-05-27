const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "actifs", label: "Actifs" },
  { key: "inactifs", label: "Inactifs" },
  { key: "attention", label: "Faible adoption" },
];

const SANTE_CONFIG = {
  sain: { label: "Sain", dot: "#1D9E75", text: "#0F6E56" },
  attention: { label: "Attention", dot: "#EF9F27", text: "#633806" },
  inactif: { label: "Inactif", dot: "#B4B2A9", text: "#5F5E5A" },
};

export default function MpModuleTable({
  modules,
  search,
  onSearch,
  filter,
  onFilter,
  onEdit,
  onViewLicences,
  onToggle,
}) {
  return (
    <div className="mp-card mp-table-card">
      <div className="mp-card-head">
        <span className="mp-card-title">
          Catalogue modules
          <span className="mp-card-count">{modules.length}</span>
        </span>
      </div>

      <div className="mp-table-toolbar">
        <div className="mp-search-wrap">
          <i className="ti ti-search mp-search-ico" aria-hidden="true"></i>
          <input
            type="text"
            className="mp-search-input"
            placeholder="Rechercher par nom ou code..."
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
        <div className="mp-filter-tabs">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              className={`mp-filter-btn ${filter === item.key ? "active" : ""}`}
              onClick={() => onFilter(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mp-table-wrap">
        <table className="mp-table">
          <thead>
            <tr>
              <th style={{ width: "180px" }}>Module</th>
              <th style={{ width: "70px" }}>Statut</th>
              <th style={{ width: "90px" }}>Prix / mois</th>
              <th style={{ width: "60px" }}>Hotels</th>
              <th style={{ width: "110px" }}>Adoption</th>
              <th style={{ width: "80px" }}>Sante</th>
              <th style={{ width: "70px" }}></th>
            </tr>
          </thead>
          <tbody>
            {modules.length === 0 ? (
              <tr>
                <td colSpan={7} className="mp-table-empty">
                  Aucun module trouve
                </td>
              </tr>
            ) : (
              modules.map((mod) => {
                const sante = SANTE_CONFIG[mod.sante_statut] || SANTE_CONFIG.sain;
                const adoption = mod.taux_adoption_pct || 0;
                const barColor = adoption >= 20 ? "#1D9E75" : "#EF9F27";
                const moduleName = mod.name || mod.nom || "-";
                const moduleCode = mod.code || "-";

                return (
                  <tr key={mod.id} className="mp-tr">
                    <td>
                      <div className="mp-mod-row">
                        <div className="mp-mod-av">{mod.initiales}</div>
                        <div className="mp-mod-info">
                          <div className="mp-mod-name">{moduleName}</div>
                          <div className="mp-mod-code">{moduleCode}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className={`mp-pill mp-pill-${mod.statut_display === "Actif" ? "actif" : "inactif"}`}>
                        {mod.statut_display}
                      </span>
                    </td>

                    <td className="mp-td-mono">{mod.prix_display}</td>
                    <td className="mp-td-center">{mod.hotels_abonnes}</td>

                    <td>
                      <div className="mp-adopt-cell">
                        <div className="mp-adopt-top">
                          <span style={{ color: barColor, fontWeight: 500 }}>{adoption}%</span>
                        </div>
                        <div className="mp-adopt-bar">
                          <div className="mp-adopt-fill" style={{ width: `${adoption}%`, background: barColor }} />
                        </div>
                        <div className="mp-adopt-sub">
                          {mod.hotels_abonnes} hotel{mod.hotels_abonnes > 1 ? "s" : ""}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="mp-sante" style={{ color: sante.text }}>
                        <span className="mp-sante-dot" style={{ background: sante.dot }} />
                        {sante.label}
                      </span>
                    </td>

                    <td onClick={(event) => event.stopPropagation()}>
                      <div className="mp-actions-row">
                        <button className="mp-action-btn" title="Modifier" onClick={() => onEdit(mod)} type="button">
                          <i className="ti ti-edit" aria-hidden="true"></i>
                        </button>
                        <button
                          className="mp-action-btn"
                          title="Voir les licences"
                          onClick={() => onViewLicences(mod)}
                          type="button"
                        >
                          <i className="ti ti-receipt" aria-hidden="true"></i>
                        </button>
                        <button
                          className="mp-action-btn"
                          title={mod.statut_display === "Actif" ? "Desactiver" : "Activer"}
                          onClick={() => onToggle(mod)}
                          type="button"
                        >
                          <i className={`ti ${mod.statut_display === "Actif" ? "ti-toggle-right" : "ti-toggle-left"}`} aria-hidden="true"></i>
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
