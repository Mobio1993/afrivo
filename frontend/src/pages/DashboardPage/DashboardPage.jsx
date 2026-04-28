import { useEffect, useState } from "react";

import { fetchJson } from "../../api/client";
import "./DashboardPage.css";

/* URLs Django via variable d'env — évite le hardcode 127.0.0.1 */
const DJANGO_BASE = import.meta.env.VITE_DJANGO_URL || "";

const periodOptions = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 jours" },
  { value: "month", label: "30 jours" },
];

export function DashboardPage() {
  const [period, setPeriod] = useState("today");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    setError("");
    setLoading(true);

    fetchJson(`/api/dashboard/summary/?period=${period}`, { signal: controller.signal })
      .then((payload) => {
        setData(payload);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setData(null);
        setError("Connectez-vous d'abord côté Django pour charger les données.");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [period]);

  const periodSubtitle = data?.period?.subtitle || "Lecture financière en cours.";

  return (
    <div className="page-stack dashboard-shell dashboard-page">
      <section className="dashboard-hero dashboard-hero-modern">
        <div className="section-head">
          <div className="dashboard-hero-copy">
            <span className="eyebrow">Dashboard React</span>
            <h2>Tableau de bord direction</h2>
            <p>
              Vue React branchée sur l'API Django pour suivre l'activité,
              l'occupation, les encaissements et les alertes en temps réel.
            </p>
            <div className="hero-chip dashboard-chip">
              {data?.period?.label || "Période"} - {data?.status_summary || "Chargement..."}
            </div>
          </div>

          <div className="dashboard-hero-side">
            <div className="pill-row dashboard-periods">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`pill ${period === option.value ? "active" : ""}`}
                  onClick={() => setPeriod(option.value)}
                  aria-pressed={period === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="dashboard-hero-aside">
              {(data?.spotlight_cards || []).map((card) => (
                <article key={`aside-${card.title}`} className="dashboard-aside-card">
                  <strong>{card.title}</strong>
                  <div className="dashboard-aside-value">{card.value}</div>
                  <p>{card.meta}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-strip dashboard-hero-strip">
          <div className="dashboard-hero-meta">
            <span className="dashboard-meta-label">Lecture active</span>
            <strong>{periodSubtitle}</strong>
          </div>
          <div className="hero-links dashboard-hero-links">
            <a className="ghost-button light dashboard-link-button" href={`${DJANGO_BASE}/reports/financial/`} target="_blank" rel="noopener noreferrer">
              Rapports Django
            </a>
            <a className="primary-button dashboard-link-button" href={`${DJANGO_BASE}/admin/`} target="_blank" rel="noopener noreferrer">
              Administration
            </a>
          </div>
        </div>
      </section>

      {loading ? <div className="status-box" role="status" aria-live="polite">Chargement du tableau de bord...</div> : null}
      {error ? <div className="alert-box" role="alert" aria-live="assertive">{error}</div> : null}

      <section className="dashboard-kpi-grid">
        {(data?.kpi_cards || []).map((card) => (
          <article key={`kpi-${card.label}`} className="info-card dashboard-kpi-card">
            <span className="dashboard-card-label">{card.label}</span>
            <div className="metric dashboard-kpi-value">{card.value}</div>
            <p>{card.meta}</p>
          </article>
        ))}
      </section>

      <section className="dashboard-columns">
        <div>
          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Indicateurs financiers</h3>
                <p>{periodSubtitle}</p>
              </div>
            </div>
            <div className="operation-grid finance-grid">
              {(data?.financial_cards || []).map((card) => (
                <article key={`fin-${card.label}`} className="operation-card finance-card dashboard-finance-card">
                  <strong>{card.label}</strong>
                  <span>{card.value}</span>
                  <p>{card.meta}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Graphiques de pilotage</h3>
                <p>Lecture visuelle jour par jour de l'encaissement et de l'activité.</p>
              </div>
            </div>
            <div className="dashboard-chart-grid">
              {(data?.chart_cards || []).map((chart) => (
                <article key={`chart-${chart.title}`} className="chart-card dashboard-chart-card">
                  <strong>{chart.title}</strong>
                  <p>{chart.subtitle}</p>
                  <div className="chart-bars">
                    {chart.items.map((item) => (
                      <div key={`${chart.title}-${item.label}`} className="chart-column">
                        <span className="chart-top">{item.value}</span>
                        <div className="chart-track">
                          <div className="chart-fill" style={{ height: `${item.height}%` }} />
                        </div>
                        <span className="chart-bottom">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Activité récente</h3>
                <p>Derniers événements critiques remontés par l'historique Django.</p>
              </div>
            </div>
            <div className="activity-list">
              {(data?.recent_activity || []).map((item) => (
                <article key={`${item.title}-${item.time}`} className="activity-card">
                  <div className="activity-badge">{item.label}</div>
                  <div className="activity-content">
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    <div className="activity-meta">
                      <span>
                        {item.actor} - {item.time}
                      </span>
                      <a href={`${DJANGO_BASE}${item.url}`} target="_blank" rel="noopener noreferrer">Voir</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="dashboard-side-stack">
          <section className="list-panel dashboard-panel dashboard-alert-panel">
            <div className="panel-head">
              <div>
                <h3>Alertes prioritaires</h3>
                <p>Actions immédiates à traiter pour protéger l'exploitation.</p>
              </div>
            </div>
            <div className="alert-list">
              {(data?.alerts || []).map((alert) => (
                <article key={`alert-${alert.title}`} className={`alert-card ${alert.level}`}>
                  <div className="alert-count">{alert.count}</div>
                  <div className="alert-copy">
                    <strong>{alert.title}</strong>
                    <p>{alert.description}</p>
                  </div>
                  <a href={`${DJANGO_BASE}${alert.url}`} target="_blank" rel="noopener noreferrer">{alert.action_label}</a>
                </article>
              ))}
              {!data?.alerts?.length ? (
                <div className="empty-note">Aucune alerte prioritaire pour le moment.</div>
              ) : null}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Encaissements par flux</h3>
                <p>Répartition métier des revenus sur la période sélectionnée.</p>
              </div>
            </div>
            <div className="stack-list">
              {(data?.payment_channels || []).map((item) => (
                <article key={`channel-${item.title}`} className="stack-card dashboard-stack-card">
                  <strong>{item.title}</strong>
                  <span className="stack-metric">{item.amount}</span>
                  <p>{item.count} paiement(s)</p>
                  <small>{item.description}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Modes de paiement</h3>
                <p>Mix des encaissements déjà validés.</p>
              </div>
            </div>
            <div className="stack-list">
              {(data?.payment_mix || []).map((item) => (
                <article key={`mix-${item.method}`} className="stack-card compact dashboard-stack-card dashboard-stack-compact">
                  <strong>{item.method}</strong>
                  <span className="stack-metric">{item.amount}</span>
                  <p>{item.total} paiement(s)</p>
                </article>
              ))}
            </div>
          </section>

          <section className="list-panel dashboard-panel">
            <div className="panel-head">
              <div>
                <h3>Actions rapides</h3>
                <p>Raccourcis admin utiles pendant la migration React.</p>
              </div>
            </div>
            <div className="quick-links">
              {(data?.quick_actions || []).map((item) => (
                <a key={`qa-${item.title}`} className="quick-link dashboard-quick-link" href={`${DJANGO_BASE}${item.url}`} target="_blank" rel="noopener noreferrer">
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>

      {!loading ? (
        <>
          <section className="dashboard-columns dashboard-lower-grid">
            {(data?.operations_cards || []).map((panel) => (
              <section key={panel.title} className="list-panel dashboard-panel">
                <div className="panel-head">
                  <div>
                    <h3>{panel.title}</h3>
                  </div>
                </div>
                <div className="operation-grid">
                  {panel.items.map((item) => (
                    <article key={`op-${item.label}`} className="operation-card dashboard-mini-card">
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </section>

          <section className="dashboard-columns dashboard-lower-grid">
            {(data?.business_panels || []).map((panel) => (
              <section key={panel.title} className="list-panel dashboard-panel">
                <div className="panel-head">
                  <div>
                    <h3>{panel.title}</h3>
                  </div>
                </div>
                <div className="operation-grid">
                  {panel.items.map((item) => (
                    <article key={`bp-${item.label}`} className="operation-card dashboard-mini-card">
                      <strong>{item.label}</strong>
                      <span>{item.value}</span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}