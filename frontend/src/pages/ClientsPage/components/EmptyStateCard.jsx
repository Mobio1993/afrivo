export function EmptyStateCard({ title, description, action }) {
  return (
    <div className="empty-state-card" role="status" aria-live="polite">
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div className="action-row">{action}</div> : null}
    </div>
  );
}
