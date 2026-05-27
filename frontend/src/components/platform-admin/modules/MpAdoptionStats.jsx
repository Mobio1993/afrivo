export default function MpAdoptionStats({ stats = [] }) {
  if (!stats.length) return null;

  const maxHotels = Math.max(...stats.map((stat) => stat.hotels_abonnes), 1);

  return (
    <div className="mp-card">
      <div className="mp-card-head">
        <span className="mp-card-title">Adoption par module</span>
        <span className="mp-card-sub">Nombre d'hotels abonnes</span>
      </div>
      <div className="mp-stats-body">
        {stats.map((stat) => {
          const pct = stat.taux_adoption_pct || 0;
          const barPct = Math.round((stat.hotels_abonnes / maxHotels) * 100);
          const barColor = pct >= 20 ? "#1D9E75" : "#EF9F27";
          const nom = stat.name || stat.nom || `Module ${stat.id}`;

          return (
            <div key={stat.id} className="mp-stat-row">
              <span className="mp-stat-lbl">{nom}</span>
              <div className="mp-stat-track">
                <div className="mp-stat-fill" style={{ width: `${barPct}%`, background: barColor }} />
              </div>
              <span className="mp-stat-val" style={{ color: barColor }}>
                {stat.hotels_abonnes}/{stat.total_hotels} - {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
