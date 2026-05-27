const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "actifs", label: "Actifs" },
  { key: "suspendus", label: "Suspendus" },
  { key: "critique", label: "Quota critique" },
  { key: "sans_admin", label: "Sans admin" },
];

const QUOTA_COLOR = {
  sain: "#1D9E75",
  attention: "#EF9F27",
  critique: "#E24B4A",
  sans_limite: "#B4B2A9",
};

export default function PhHotelList({ hotels, selected, onSelect, search, onSearch, filter, onFilter, onNew }) {
  return (
    <div className="ph-card ph-hotel-list-card">
      <div className="ph-card-head">
        <span className="ph-card-title">
          Parc hotelier
          <span className="ph-card-count">{hotels.length}</span>
        </span>
        <button className="ph-btn-sm" onClick={onNew}>
          <i className="ti ti-plus" aria-hidden="true" />
          Nouvel hotel
        </button>
      </div>

      <div className="ph-list-search">
        <div className="ph-search-wrap">
          <i className="ti ti-search ph-search-ico" aria-hidden="true" />
          <input
            type="text"
            className="ph-search-input"
            placeholder="Rechercher par hotel, code, ville ou organisation..."
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="ph-list-filters">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            className={`ph-filter-btn ${filter === item.key ? "active" : ""}`}
            onClick={() => onFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="ph-hotel-rows">
        {hotels.length === 0 ? (
          <div className="ph-list-empty">Aucun hotel trouve</div>
        ) : (
          hotels.map((hotel) => {
            const quotaPct = hotel.quota_pct || 0;
            const barColor = QUOTA_COLOR[hotel.quota_statut] || QUOTA_COLOR.sain;
            return (
              <button
                key={hotel.id}
                type="button"
                className={`ph-hotel-row ${selected?.id === hotel.id ? "selected" : ""}`}
                onClick={() => onSelect(hotel)}
              >
                <div className="ph-hotel-av">{hotel.initiales}</div>
                <div className="ph-hotel-info">
                  <div className="ph-hotel-name">{hotel.nom}</div>
                  <div className="ph-hotel-org">{hotel.organisation_nom}</div>
                </div>
                <div className="ph-hotel-right">
                  <span className={`ph-pill ph-pill-${hotel.statut}`}>{hotel.statut_display}</span>
                  <div className="ph-quota-wrap">
                    <span className="ph-quota-txt">
                      {hotel.plan_sans_limite
                        ? `${hotel.utilisateurs_actifs} / inf.`
                        : `${hotel.utilisateurs_actifs} / ${hotel.quota_plan}`}
                    </span>
                    <div className="ph-quota-bar">
                      <div className="ph-quota-fill" style={{ width: `${quotaPct}%`, background: barColor }} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
