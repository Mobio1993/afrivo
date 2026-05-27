import { useEffect, useState } from "react";

import { posApi } from "../../hooks/usePosApi";

function money(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} XOF`;
}

function badgeClass(label) {
  if (label === "excellente" || label === "bonne") return "pos-pill-libre";
  if (label === "moyenne") return "pos-pill-reservee";
  return "pos-pill-occupee";
}

export function ServerPerformancePage() {
  const [period, setPeriod] = useState("today");
  const [state, setState] = useState({ rows: [], summary: null, loading: true, error: "" });

  useEffect(() => {
    let mounted = true;
    posApi.getServerPerformanceTable({ period })
      .then((payload) => mounted && setState({ rows: payload.results || [], summary: payload.summary, loading: false, error: "" }))
      .catch((error) => mounted && setState((prev) => ({ ...prev, loading: false, error: error.message })));
    return () => {
      mounted = false;
    };
  }, [period]);

  return (
    <div className="pos-page">
      <div className="pos-page-header">
        <div>
          <h2 className="pos-page-title">Performances serveurs</h2>
          <p className="pos-muted">Classement operationnel base sur ventes, commandes, remises et annulations.</p>
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
        <>
          <div className="pos-kpi-bar">
            <div className="pos-kpi-cell"><span className="pos-kpi-label">Ventes</span><b className="pos-kpi-value">{money(state.summary?.total_sales_today)}</b></div>
            <div className="pos-kpi-cell"><span className="pos-kpi-label">Commandes</span><b className="pos-kpi-value">{state.summary?.total_orders || 0}</b></div>
            <div className="pos-kpi-cell"><span className="pos-kpi-label">Ticket moyen</span><b className="pos-kpi-value">{money(state.summary?.average_ticket)}</b></div>
            <div className="pos-kpi-cell"><span className="pos-kpi-label">Meilleur serveur</span><b className="pos-kpi-value">{state.summary?.best_server?.server_name || "-"}</b></div>
          </div>
          <section className="pos-card pos-table-card">
            <div className="pos-table-head pos-performance-head">
              <span>Serveur</span>
              <span>Ventes</span>
              <span>Commandes</span>
              <span>Ticket moyen</span>
              <span>Tables</span>
              <span>Annulations</span>
              <span>Performance</span>
            </div>
            {state.rows.length === 0 ? <div className="pos-empty">Aucune performance disponible.</div> : null}
            {state.rows.map((row) => (
              <div key={row.server_id} className="pos-table-row pos-performance-row">
                <strong>{row.server_name}</strong>
                <span>{money(row.total_sales_amount)}</span>
                <span>{row.total_orders}</span>
                <span>{money(row.average_ticket)}</span>
                <span>{row.total_tables_served}</span>
                <span>{row.cancellation_rate}%</span>
                <span className={`pos-pill ${badgeClass(row.performance_label)}`}>{row.performance_label}</span>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
