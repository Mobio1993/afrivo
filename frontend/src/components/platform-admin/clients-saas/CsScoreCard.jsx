export default function CsScoreCard({ data }) {
  const score = data.score_sante || 0;
  const color = score >= 90 ? "#1D9E75" : score >= 50 ? "#EF9F27" : "#A32D2D";
  const bgColor = score >= 90 ? "#E1F5EE" : score >= 50 ? "#FAEEDA" : "#FCEBEB";

  return (
    <div className="cs-card cs-score-card">
      <div className="cs-card-head">
        <span className="cs-card-title">Score sante portefeuille</span>
      </div>
      <div className="cs-score-body">
        <div className="cs-score-circle" style={{ borderColor: color }}>
          <span className="cs-score-val" style={{ color }}>{score}</span>
          <span className="cs-score-denom">/100</span>
        </div>
        <div>
          <div className="cs-score-label" style={{ background: bgColor, color }}>
            {data.score_label}
          </div>
          <p className="cs-score-desc">{data.score_description}</p>
        </div>
      </div>
    </div>
  );
}
