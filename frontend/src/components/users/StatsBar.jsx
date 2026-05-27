export default function StatsBar({ stats }) {
  return (
    <section className="um-stats" aria-label="Statistiques utilisateurs">
      <article className="um-stat-card">
        <strong>{stats.total || 0}</strong>
        <span>Utilisateurs total</span>
      </article>
      <article className="um-stat-card">
        <strong className="is-green">{stats.active || 0}</strong>
        <span>Actifs</span>
      </article>
      <article className="um-stat-card">
        <strong>{stats.admins || 0}</strong>
        <span>Administrateurs</span>
      </article>
    </section>
  );
}
