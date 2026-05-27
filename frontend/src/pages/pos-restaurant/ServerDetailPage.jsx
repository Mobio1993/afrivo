import { useEffect, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";

import { posApi } from "../../hooks/usePosApi";

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("fr-FR")} XOF`;
}

function ServerTabs({ serverId }) {
  const tabs = [
    { to: `/pos-restaurant/servers/${serverId}`, label: "Fiche" },
    { to: `/pos-restaurant/servers/${serverId}/sales`, label: "Ventes" },
  ];
  return (
    <div className="pos-tabs">
      {tabs.map((tab) => (
        <NavLink key={tab.to} end to={tab.to} className={({ isActive }) => `pos-tab ${isActive ? "active" : ""}`}>
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}

export function ServerDetailPage() {
  const { serverId } = useParams();
  const [data, setData] = useState({ server: null, performance: null, loading: true, error: "" });

  useEffect(() => {
    let mounted = true;
    Promise.all([posApi.getServer(serverId), posApi.getServerPerformance(serverId, { period: "today" })])
      .then(([server, performance]) => mounted && setData({ server, performance, loading: false, error: "" }))
      .catch((error) => mounted && setData((prev) => ({ ...prev, loading: false, error: error.message })));
    return () => {
      mounted = false;
    };
  }, [serverId]);

  if (data.loading) return <div className="pos-page"><div className="pos-loading">Chargement...</div></div>;
  if (data.error) return <div className="pos-page"><div className="pos-error">{data.error}</div></div>;

  const server = data.server;
  const perf = data.performance || {};

  return (
    <div className="pos-page">
      <div className="pos-page-header">
        <div>
          <Link className="pos-link" to="/pos-restaurant/servers">Retour aux serveurs</Link>
          <h2 className="pos-page-title">{server.full_name}</h2>
          <p className="pos-muted">{server.restaurant_name} - {server.hotel_name || "Hotel non renseigne"}</p>
        </div>
        <span className={`pos-pill ${server.status === "active" ? "pos-pill-libre" : "pos-pill-occupee"}`}>{server.status}</span>
      </div>

      <ServerTabs serverId={serverId} />

      <div className="pos-kpi-bar">
        <div className="pos-kpi-cell"><span className="pos-kpi-label">Ventes jour</span><b className="pos-kpi-value">{formatMoney(perf.total_sales_amount)}</b></div>
        <div className="pos-kpi-cell"><span className="pos-kpi-label">Commandes</span><b className="pos-kpi-value">{perf.total_orders || 0}</b></div>
        <div className="pos-kpi-cell"><span className="pos-kpi-label">Ticket moyen</span><b className="pos-kpi-value">{formatMoney(perf.average_ticket)}</b></div>
        <div className="pos-kpi-cell"><span className="pos-kpi-label">Performance</span><b className="pos-kpi-value pos-kpi-green">{perf.performance_label || "-"}</b></div>
      </div>

      <div className="pos-two-col">
        <section className="pos-card">
          <h3 className="pos-section-title">Informations personnelles</h3>
          <div className="pos-list-row"><span>Code</span><b>{server.code}</b></div>
          <div className="pos-list-row"><span>Telephone</span><b>{server.phone || "-"}</b></div>
          <div className="pos-list-row"><span>Employee ID</span><b>{server.employee_id || "-"}</b></div>
          <div className="pos-list-row"><span>Compte lie</span><b>{server.user_username || "-"}</b></div>
        </section>
        <section className="pos-card">
          <h3 className="pos-section-title">Affectation</h3>
          <div className="pos-list-row"><span>Organisation</span><b>{server.organization_name || "-"}</b></div>
          <div className="pos-list-row"><span>Hotel</span><b>{server.hotel_name || "-"}</b></div>
          <div className="pos-list-row"><span>Restaurant</span><b>{server.restaurant_name || "-"}</b></div>
          <div className="pos-list-row"><span>Shift actuel</span><b>{server.current_shift?.shift_name || "Aucun shift"}</b></div>
        </section>
      </div>
    </div>
  );
}
