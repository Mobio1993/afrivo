function SkeletonLine({ width = "100%", height = 14, style }) {
  return (
    <div
      className="pa-skeleton"
      style={{ width, height, borderRadius: 6, ...style }}
    />
  );
}

export function SkeletonSummaryCards({ count = 3 }) {
  return (
    <section className="platform-admin-summary-grid">
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="info-card" style={{ display: "grid", gap: 14 }}>
          <SkeletonLine width="55%" height={12} />
          <SkeletonLine width="35%" height={36} />
          <SkeletonLine width="75%" height={11} />
        </article>
      ))}
    </section>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="platform-admin-table-wrap">
      <table className="platform-admin-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <SkeletonLine width="55%" height={10} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} style={{ cursor: "default" }}>
              <td>
                <div style={{ display: "grid", gap: 6 }}>
                  <SkeletonLine width="70%" height={13} />
                  <SkeletonLine width="45%" height={11} />
                </div>
              </td>
              {Array.from({ length: cols - 1 }).map((_, colIdx) => (
                <td key={colIdx}>
                  <SkeletonLine width={`${48 + ((colIdx * 13) % 32)}%`} height={13} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonDetailPanel() {
  return (
    <aside className="list-panel platform-admin-side-card">
      <div className="panel-head">
        <div style={{ display: "grid", gap: 8, width: "100%" }}>
          <SkeletonLine width="50%" height={16} />
          <SkeletonLine width="78%" height={12} />
        </div>
      </div>
      <div className="platform-admin-detail-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="platform-admin-detail-row">
            <SkeletonLine width="32%" height={12} />
            <SkeletonLine width="42%" height={12} />
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonLine key={i} width="100%" height={38} style={{ borderRadius: 10 }} />
        ))}
      </div>
    </aside>
  );
}

export function SkeletonStackList({ count = 4 }) {
  return (
    <div className="platform-admin-stack-list">
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="platform-admin-stack-card" style={{ display: "grid", gap: 10 }}>
          <div className="platform-admin-stack-top">
            <SkeletonLine width="45%" height={14} />
            <SkeletonLine width="20%" height={28} style={{ borderRadius: 999 }} />
          </div>
          <SkeletonLine width="28%" height={11} style={{ borderRadius: 999 }} />
          <SkeletonLine width="88%" height={12} />
          <SkeletonLine width="65%" height={11} />
        </article>
      ))}
    </div>
  );
}

export function SkeletonSectionGrid() {
  return (
    <section className="platform-admin-section-grid">
      <section className="list-panel">
        <SkeletonTable rows={6} cols={5} />
      </section>
      <SkeletonDetailPanel />
    </section>
  );
}

export function SkeletonDashboardGrid({ leftRows = 5, leftCols = 5, rightCount = 4 }) {
  return (
    <section className="platform-admin-dashboard-grid">
      <section className="list-panel">
        <SkeletonTable rows={leftRows} cols={leftCols} />
      </section>
      <section className="list-panel">
        <SkeletonStackList count={rightCount} />
      </section>
    </section>
  );
}

export function SkeletonTwoStackPanels({ count = 3 }) {
  return (
    <section className="platform-admin-dashboard-grid">
      <section className="list-panel">
        <SkeletonStackList count={count} />
      </section>
      <section className="list-panel">
        <SkeletonStackList count={count} />
      </section>
    </section>
  );
}
