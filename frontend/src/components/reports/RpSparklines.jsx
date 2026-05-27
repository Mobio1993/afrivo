function Sparkline({ values = [], color = "#1D9E75", fillColor = "#E1F5EE" }) {
  if (!values || values.length < 2) {
    return <div className="rp-spark-empty">—</div>;
  }
  const width = 180;
  const height = 36;
  const pad = 2;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = pad + (index / (values.length - 1)) * (width - pad * 2);
      const y = pad + (1 - (value - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const closed = `${points} ${width - pad},${height} ${pad},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="rp-spark-svg" aria-hidden="true">
      <polygon points={closed} fill={fillColor} opacity="0.6" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export default function RpSparklines({ data }) {
  const items = [
    {
      label: "Encaissements (7j)",
      value: Number(data.encaissements_total || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 }),
      delta: data.delta_encaissements,
      values: data.sparkline_encaissements || [],
      color: "#1D9E75",
      fill: "#E1F5EE",
    },
    {
      label: "Paiements valides (7j)",
      value: data.paiements_valides,
      delta: null,
      values: data.sparkline_paiements || [],
      color: "#378ADD",
      fill: "#E6F1FB",
    },
    {
      label: "Occupation (7j)",
      value: `${Number(data.occupation_rate || 0).toFixed(1)}%`,
      delta: data.delta_occupation,
      values: data.sparkline_occupation || [],
      color: data.delta_occupation < 0 ? "#E24B4A" : "#1D9E75",
      fill: data.delta_occupation < 0 ? "#FCEBEB" : "#E1F5EE",
    },
  ];

  return (
    <div className="rp-sparklines-row">
      {items.map((item) => (
        <div key={item.label} className="rp-spark-card">
          <div className="rp-spark-header">
            <div>
              <div className="rp-spark-lbl">{item.label}</div>
              <div className="rp-spark-val">{item.value}</div>
            </div>
            {item.delta !== null && item.delta !== undefined && (
              <span className={`rp-spark-delta ${item.delta >= 0 ? "up" : "dn"}`}>
                {item.delta >= 0 ? "▲" : "▼"} {item.delta >= 0 ? "+" : ""}{item.delta}%
              </span>
            )}
          </div>
          <Sparkline values={item.values} color={item.color} fillColor={item.fill} />
        </div>
      ))}
    </div>
  );
}
