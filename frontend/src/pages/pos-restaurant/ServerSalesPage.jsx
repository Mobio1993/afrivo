import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { posApi } from "../../hooks/usePosApi";

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
];

function money(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} XOF`;
}

export function ServerSalesPage() {
  const { serverId } = useParams();
  const [period, setPeriod] = useState("today");
  const [data, setData] = useState({ server: null, summary: null, orders: [], loading: true, error: "" });

  useEffect(() => {
    let mounted = true;
    posApi.getServerSales(serverId, { period })
      .then((payload) => mounted && setData({ ...payload, loading: false, error: "" }))
      .catch((error) => mounted && setData((prev) => ({ ...prev, loading: false, error: error.message })));
    return () => {
      mounted = false;
    };
  }, [serverId, period]);

  const summary = data.summary || {};

  return (
    <div className="pos-page">
      <div className="pos-page-header">
        <div>
          <Link className="pos-link" to={`/pos-restaurant/servers/${serverId}`}>Retour fiche serveur</Link>
          <h2 className="pos-page-title">Ventes serveur</h2>
          <p className="pos-muted">{data.server?.full_name || "Serveur"}</p>
        </div>
        <select className="pos-input pos-small-select" value={period} onChange={(event) => setPeriod(event.target.value)}>
          {PERIODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      {data.error ? <div className="pos-error">{data.error}</div> : null}
      {data.loading ? <div className="pos-loading">Chargement...</div> : null}

      {!data.loading ? (
        <>
          <div className="pos-kpi-bar">
            <div className="pos-kpi-cell"><span className="pos-kpi-label">Montant vendu</span><b className="pos-kpi-value">{money(summary.total_sales_amount)}</b></div>
            <div className="pos-kpi-cell"><span className="pos-kpi-label">Paiements recus</span><b className="pos-kpi-value">{money(summary.total_paid_amount)}</b></div>
            <div className="pos-kpi-cell"><span className="pos-kpi-label">Remises</span><b className="pos-kpi-value pos-kpi-amber">{money(summary.total_discounts)}</b></div>
            <div className="pos-kpi-cell"><span className="pos-kpi-label">Annulations</span><b className="pos-kpi-value pos-kpi-red">{summary.cancellation_rate || 0}%</b></div>
          </div>

          <section className="pos-card pos-table-card">
            <div className="pos-table-head pos-sales-head">
              <span>Commande</span>
              <span>Table</span>
              <span>Articles</span>
              <span>Total</span>
              <span>Payé</span>
              <span>Statut</span>
            </div>
            {data.orders.length === 0 ? <div className="pos-empty">Aucune vente sur cette periode.</div> : null}
            {data.orders.map((order) => (
              <div key={order.id} className="pos-table-row pos-sales-row">
                <strong>{order.reference}</strong>
                <span>Table {order.table}</span>
                <span>{order.items_count}</span>
                <span>{money(order.total)}</span>
                <span>{money(order.paid)}</span>
                <span className="pos-pill pos-pill-libre">{order.status}</span>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
