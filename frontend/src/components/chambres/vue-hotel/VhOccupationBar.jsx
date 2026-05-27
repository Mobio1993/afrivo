export default function VhOccupationBar({ data }) {
  const total = (data.disponibles || 0) + (data.occupees || 0) + (data.nettoyage || 0) + (data.hors_service || 0);
  if (!total) return null;

  const pct = (n) => Math.round((Number(n || 0) / total) * 100);
  const segments = [
    { label: `Occupees (${data.occupees} - ${pct(data.occupees)}%)`, pct: pct(data.occupees), color: "#A32D2D" },
    { label: `Nettoyage (${data.nettoyage} - ${pct(data.nettoyage)}%)`, pct: pct(data.nettoyage), color: "#EF9F27" },
    { label: `Disponibles (${data.disponibles} - ${pct(data.disponibles)}%)`, pct: pct(data.disponibles), color: "#1D9E75" },
    { label: `Hors service (${data.hors_service})`, pct: pct(data.hors_service), color: "#B4B2A9" },
  ].filter((segment) => segment.pct > 0);

  return (
    <div className="vh-occ-wrap">
      <div className="vh-sec-label">Occupation visuelle</div>
      <div className="vh-occ-bar">
        {segments.map((segment) => (
          <div key={segment.label} className="vh-occ-seg" style={{ width: `${segment.pct}%`, background: segment.color }} title={segment.label}>
            {segment.pct > 8 ? <span>{segment.pct}%</span> : null}
          </div>
        ))}
      </div>
      <div className="vh-occ-legend">
        {segments.map((segment) => (
          <div key={segment.label} className="vh-leg-row">
            <div className="vh-leg-dot" style={{ background: segment.color }} />
            <span>{segment.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
