export default function MpScoreCard({ data }) {
  const score = data.score_catalogue || 0;
  const color = score >= 90 ? "#1D9E75" : score >= 50 ? "#EF9F27" : "#A32D2D";
  const bgColor = score >= 90 ? "#E1F5EE" : score >= 50 ? "#FAEEDA" : "#FCEBEB";

  return (
    <div className="mp-card">
      <div className="mp-card-head">
        <span className="mp-card-title">Score catalogue</span>
      </div>
      <div className="mp-score-body">
        <div className="mp-score-circle" style={{ borderColor: color }}>
          <span className="mp-score-val" style={{ color }}>
            {score}
          </span>
          <span className="mp-score-denom">/100</span>
        </div>
        <div>
          <div className="mp-score-label" style={{ background: bgColor, color }}>
            {data.score_label}
          </div>
          <p className="mp-score-desc">{data.score_description}</p>
        </div>
      </div>
    </div>
  );
}
