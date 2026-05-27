import { useEffect, useState } from "react";

import { posApi } from "../../hooks/usePosApi";

function money(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} XOF`;
}

export function ServerRankingPage() {
  const [period, setPeriod] = useState("today");
  const [state, setState] = useState({ rows: [], loading: true, error: "" });

  useEffect(() => {
    let mounted = true;
    posApi.getServerRanking({ period })
      .then((payload) => mounted && setState({ rows: payload.results || [], loading: false, error: "" }))
      .catch((error) => mounted && setState((prev) => ({ ...prev, loading: false, error: error.message })));
    return () => {
      mounted = false;
    };
  }, [period]);

  return (
    <div className="pos-page">
      <div className="pos-page-header">
        <div>
          <h2 className="pos-page-title">Classement serveurs</h2>
          <p className="pos-muted">Top serveurs selon score, chiffre d'affaires et qualite operationnelle.</p>
        </div>
        <select className="pos-input pos-small-select" value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="today">Aujourd'hui</option>
          <option value="yesterday">Hier</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
        </select>
      </div>
      {state.error ? <div className="pos-error">{state.error}</div> : null}
      {state.loading ? <div className="pos-loading">Chargement...</div> : null}
      {!state.loading ? (
        <section className="pos-card pos-ranking">
          {state.rows.length === 0 ? <div className="pos-empty">Aucun serveur classe pour cette periode.</div> : null}
          {state.rows.map((row, index) => (
            <div key={row.server_id} className="pos-ranking-row">
              <span className="pos-rank">#{index + 1}</span>
              <div>
                <strong>{row.server_name}</strong>
                <small>{row.restaurant_name}</small>
              </div>
              <span>{money(row.total_sales_amount)}</span>
              <span>{row.total_orders} commandes</span>
              <span>{money(row.average_ticket)}</span>
              <span className="pos-pill pos-pill-libre">{row.performance_label}</span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
