export default function RtGauge({ value, min = 0, max = 100, label, unit = "", thresholds }) {
  if (value === null || value === undefined) {
    return (
      <div className="rt-gauge">
        <div className="rt-gauge-top">
          <span className="rt-gauge-val">-</span>
          <span className="rt-gauge-lbl">{label}</span>
        </div>
        <div className="rt-gauge-track"><div className="rt-gauge-fill" style={{ width: "0%", background: "#ccc" }} /></div>
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  let color = "#1D9E75";
  if (thresholds) {
    if (value >= thresholds.critical) color = "#E24B4A";
    else if (value >= thresholds.warn) color = "#EF9F27";
  }

  return (
    <div className="rt-gauge">
      <div className="rt-gauge-top">
        <span className="rt-gauge-val" style={{ color }}>{value}{unit}</span>
        <span className="rt-gauge-lbl">{label}</span>
      </div>
      <div className="rt-gauge-track">
        <div className="rt-gauge-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
