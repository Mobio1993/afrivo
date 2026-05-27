export default function RpBarChart({ title, items = [], maxValue }) {
  const max = maxValue || Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rp-barchart">
      {title ? <div className="rp-barchart-title">{title}</div> : null}
      <div className="rp-barchart-rows">
        {items.map((item) => {
          const pct = max > 0 ? Math.round((item.value / max) * 100) : 0;
          return (
            <div key={item.label} className="rp-bar-row">
              <span className="rp-bar-lbl">{item.label}</span>
              <div className="rp-bar-track">
                <div className="rp-bar-fill" style={{ width: `${pct}%`, background: item.color || "#1D9E75" }} />
              </div>
              <span className="rp-bar-val">
                {Number(item.value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}
                {item.count !== undefined && <span className="rp-bar-count"> ({item.count})</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
