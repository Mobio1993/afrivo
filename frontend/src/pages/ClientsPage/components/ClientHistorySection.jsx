import { normalizeValue } from "../utils";
import { EmptyStateCard } from "./EmptyStateCard";

export function ClientHistorySection({ title, items, emptyLabel, renderMeta }) {
  return (
    <section className="list-panel dashboard-panel client-history-section">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          <p>{items.length} element(s) affiches sur cette fiche.</p>
        </div>
      </div>

      <div className="table-like client-history-timeline">
        {items.map((item) => (
          <article
            key={`${title}-${item.id}`}
            className="table-card detail-info-card client-history-card"
          >
            <div className="client-history-track" aria-hidden="true">
              <span className="client-history-dot" />
              <span className="client-history-line" />
            </div>

            <div className="client-history-body">
              <div className="client-history-top">
                <div>
                  <strong>{normalizeValue(item.reference)}</strong>
                  <span>{normalizeValue(item.status)}</span>
                </div>
              </div>

              <div className="client-history-meta">{renderMeta(item)}</div>
            </div>
          </article>
        ))}

        {!items.length ? (
          <EmptyStateCard
            title={emptyLabel}
            description="Aucune information a afficher pour ce client sur cette section."
          />
        ) : null}
      </div>
    </section>
  );
}
