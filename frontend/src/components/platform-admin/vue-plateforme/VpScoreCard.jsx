export default function VpScoreCard({ score, label, description }) {
  const color = score >= 90 ? "#1D9E75" : score >= 50 ? "#EF9F27" : "#E24B4A";
  const bgColor = score >= 90 ? "#E1F5EE" : score >= 50 ? "#FAEEDA" : "#FCEBEB";

  return (
    <div className="vp-score-card">
      <div className="vp-score-circle" style={{ borderColor: color }}>
        <span className="vp-score-val" style={{ color }}>{score}</span>
        <span className="vp-score-denom">/100</span>
      </div>
      <div className="vp-score-label-badge" style={{ background: bgColor, color }}>
        {label}
      </div>
      <p className="vp-score-desc">{description}</p>
    </div>
  );
}
