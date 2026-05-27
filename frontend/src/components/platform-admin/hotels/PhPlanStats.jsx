const PLAN_COLORS = ["#7F77DD", "#378ADD", "#1D9E75", "#EF9F27", "#E24B4A"];

const QUOTA_BARS = [
  { key: "sain", label: "0-59% utilise", color: "#1D9E75" },
  { key: "attention", label: "60-89% utilise", color: "#EF9F27" },
  { key: "critique", label: ">=90% utilise", color: "#E24B4A" },
  { key: "sans_limite", label: "Sans limite", color: "#B4B2A9" },
];

export default function PhPlanStats({ statsPlans = {}, statsQuota = {} }) {
  const maxPlan = Math.max(...Object.values(statsPlans), 1);
  const maxQuota = Math.max(...Object.values(statsQuota), 1);

  return (
    <div className="ph-card">
      <div className="ph-card-head">
        <span className="ph-card-title">Repartition des plans</span>
      </div>
      <div className="ph-stats-body">
        <div className="ph-stats-section">
          {Object.entries(statsPlans).map(([plan, count], index) => (
            <div key={plan} className="ph-stat-row">
              <span className="ph-stat-lbl">{plan}</span>
              <div className="ph-stat-track">
                <div
                  className="ph-stat-fill"
                  style={{ width: `${Math.round((count / maxPlan) * 100)}%`, background: PLAN_COLORS[index % PLAN_COLORS.length] }}
                />
              </div>
              <span className="ph-stat-val">{count}</span>
            </div>
          ))}
        </div>
        <div className="ph-stats-sep-lbl">Sante des quotas</div>
        <div className="ph-stats-section">
          {QUOTA_BARS.map((quota) => {
            const count = statsQuota[quota.key] || 0;
            return (
              <div key={quota.key} className="ph-stat-row">
                <span className="ph-stat-lbl">{quota.label}</span>
                <div className="ph-stat-track">
                  <div
                    className="ph-stat-fill"
                    style={{ width: `${Math.round((count / maxQuota) * 100)}%`, background: quota.color }}
                  />
                </div>
                <span className="ph-stat-val">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
