import "./SuperRoot.css";

export function SuperRootPageShell({ title, subtitle, children, actions = null }) {
  return (
    <div className="sr-page">
      <div className="sr-header">
        <div>
          <div className="sr-eyebrow">SUPER ROOT</div>
          <h1 className="sr-title">{title}</h1>
          <p className="sr-subtitle">{subtitle}</p>
        </div>
        {actions && <div className="sr-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function SuperRootState({ loading, error, children }) {
  if (loading) {
    return <div className="sr-state">Chargement des donnees Super Root...</div>;
  }
  if (error) {
    return <div className="sr-error">{error}</div>;
  }
  return children;
}

export function SrCard({ title, children }) {
  return (
    <section className="sr-card">
      <div className="sr-card-title">{title}</div>
      {children}
    </section>
  );
}

export function SrKpiGrid({ items }) {
  return (
    <div className="sr-kpi-grid">
      {items.map((item) => (
        <div className="sr-kpi" key={item.label}>
          <span className="sr-kpi-label">{item.label}</span>
          <strong className="sr-kpi-value">{item.value}</strong>
          {item.meta && <span className="sr-kpi-meta">{item.meta}</span>}
        </div>
      ))}
    </div>
  );
}

export function SrTable({ columns, rows, empty = "Aucune donnee." }) {
  if (!rows?.length) {
    return <div className="sr-empty">{empty}</div>;
  }
  return (
    <div className="sr-table-wrap">
      <table className="sr-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.hotel_id || row.username || index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SrBadge({ children, tone = "neutral" }) {
  return <span className={`sr-badge sr-badge-${tone}`}>{children}</span>;
}
