import { useEffect, useState } from "react";

import PosKpiBar from "../../components/pos-restaurant/PosKpiBar";
import { posApi } from "../../hooks/usePosApi";

export function DashboardPage() {
  const [state, setState] = useState({ tables: [], orders: [], tickets: [], serverSummary: null, loading: true, error: "" });

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([posApi.getTables(), posApi.getOrders(), posApi.getKitchenTickets(), posApi.getServerPerformanceTable({ period: "today" })])
      .then(([tables, orders, tickets, serverPerformance]) => mounted && setState({
        tables: tables.status === "fulfilled" ? tables.value : [],
        orders: orders.status === "fulfilled" ? orders.value : [],
        tickets: tickets.status === "fulfilled" ? tickets.value : [],
        serverSummary: serverPerformance.status === "fulfilled" ? serverPerformance.value.summary : null,
        loading: false,
        error: "",
      }))
      .catch((error) => mounted && setState((prev) => ({ ...prev, loading: false, error: error.message })));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="pos-page">
      <div className="pos-page-header">
        <h2 className="pos-page-title">POS Restaurant</h2>
      </div>
      {state.loading ? <div className="pos-loading">Chargement...</div> : null}
      {state.error ? <div className="pos-error">{state.error}</div> : null}
      {!state.loading ? <PosKpiBar tables={state.tables} orders={state.orders} tickets={state.tickets} /> : null}
      {!state.loading ? (
        <div className="pos-kpi-bar">
          <div className="pos-kpi-cell">
            <span className="pos-kpi-label">Ventes du jour</span>
            <b className="pos-kpi-value">{Number(state.serverSummary?.total_sales_today || 0).toLocaleString("fr-FR")} XOF</b>
          </div>
          <div className="pos-kpi-cell">
            <span className="pos-kpi-label">Meilleur serveur</span>
            <b className="pos-kpi-value pos-kpi-green">{state.serverSummary?.best_server?.server_name || "-"}</b>
          </div>
          <div className="pos-kpi-cell">
            <span className="pos-kpi-label">Ticket moyen</span>
            <b className="pos-kpi-value">{Number(state.serverSummary?.average_ticket || 0).toLocaleString("fr-FR")} XOF</b>
          </div>
          <div className="pos-kpi-cell">
            <span className="pos-kpi-label">Plus de remises</span>
            <b className="pos-kpi-value pos-kpi-amber">{state.serverSummary?.most_discounts_server?.server_name || "-"}</b>
          </div>
          <div className="pos-kpi-cell">
            <span className="pos-kpi-label">Plus d'annulations</span>
            <b className="pos-kpi-value pos-kpi-red">{state.serverSummary?.most_cancellations_server?.server_name || "-"}</b>
          </div>
        </div>
      ) : null}
      <div className="pos-dashboard-grid">
        <section className="pos-card">
          <h3 className="pos-section-title">Commandes actives</h3>
          {state.orders.filter((order) => !["payee", "annulee"].includes(order.statut)).slice(0, 6).map((order) => (
            <div key={order.id} className="pos-list-row">
              <span>{order.reference}</span>
              <b>Table {order.table_numero}</b>
            </div>
          ))}
        </section>
        <section className="pos-card">
          <h3 className="pos-section-title">Cuisine</h3>
          {state.tickets.slice(0, 6).map((ticket) => (
            <div key={ticket.id} className="pos-list-row">
              <span>{ticket.order_ref}</span>
              <b>{ticket.statut}</b>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
