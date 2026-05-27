import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { posApi } from "../../hooks/usePosApi";

const STATUS_LABEL = { active: "Actif", suspended: "Suspendu", inactive: "Inactif" };

function statusClass(status) {
  return status === "active" ? "pos-pill-libre" : status === "suspended" ? "pos-pill-occupee" : "pos-pill-fermee";
}

export function ServersPage() {
  const [servers, setServers] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "", restaurant: "" });
  const [form, setForm] = useState({ restaurant: "", code: "", first_name: "", last_name: "", phone: "", employee_id: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [state, setState] = useState({ loading: true, saving: false, error: "", feedback: "" });

  async function load() {
    try {
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      setServers(await posApi.getServers(filters));
    } catch (error) {
      setState((prev) => ({ ...prev, error: error.message }));
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => ({
    total: servers.length,
    active: servers.filter((server) => server.status === "active").length,
    suspended: servers.filter((server) => server.status === "suspended").length,
    restaurants: new Set(servers.map((server) => server.restaurant).filter(Boolean)).size,
  }), [servers]);

  async function createServer(event) {
    event.preventDefault();
    setState((prev) => ({ ...prev, saving: true, error: "", feedback: "" }));
    try {
      await posApi.createServer({
        ...form,
        restaurant: Number(form.restaurant),
      });
      setForm({ restaurant: "", code: "", first_name: "", last_name: "", phone: "", employee_id: "" });
      setShowCreate(false);
      setState((prev) => ({ ...prev, feedback: "Serveur cree avec succes." }));
      await load();
    } catch (error) {
      setState((prev) => ({ ...prev, error: error.message }));
    } finally {
      setState((prev) => ({ ...prev, saving: false }));
    }
  }

  return (
    <div className="pos-page">
      <div className="pos-page-header">
        <div>
          <h2 className="pos-page-title">Serveurs</h2>
          <p className="pos-muted">Suivi des serveurs, shifts et rattachements restaurant.</p>
        </div>
        <button className="pos-btn pos-btn-primary" type="button" onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? "Fermer" : "Nouveau serveur"}
        </button>
      </div>

      <section className="pos-card pos-filter-grid">
        <input className="pos-input" placeholder="Rechercher serveur" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select className="pos-input" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="inactive">Inactifs</option>
        </select>
        <input className="pos-input" placeholder="ID restaurant" value={filters.restaurant} onChange={(event) => setFilters({ ...filters, restaurant: event.target.value })} />
        <button className="pos-btn pos-btn-primary" type="button" onClick={load}>Filtrer</button>
      </section>

      {showCreate ? (
        <form className="pos-card pos-server-form" onSubmit={createServer}>
          <div>
            <h3 className="pos-section-title">Creation serveur</h3>
            <p className="pos-muted">Le serveur doit etre rattache a un restaurant POS existant.</p>
          </div>
          <input className="pos-input" required placeholder="ID restaurant *" value={form.restaurant} onChange={(event) => setForm({ ...form, restaurant: event.target.value })} />
          <input className="pos-input" required placeholder="Code serveur *" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          <input className="pos-input" required placeholder="Prenom *" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
          <input className="pos-input" placeholder="Nom" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
          <input className="pos-input" placeholder="Telephone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          <input className="pos-input" placeholder="Employee ID" value={form.employee_id} onChange={(event) => setForm({ ...form, employee_id: event.target.value })} />
          <div className="pos-form-actions">
            <button className="pos-btn" type="button" onClick={() => setShowCreate(false)}>Annuler</button>
            <button className="pos-btn pos-btn-primary" type="submit" disabled={state.saving}>{state.saving ? "Creation..." : "Creer"}</button>
          </div>
        </form>
      ) : null}

      {state.error ? <div className="pos-error">{state.error}</div> : null}
      {state.feedback ? <div className="pos-success">{state.feedback}</div> : null}

      <div className="pos-kpi-bar">
        <div className="pos-kpi-cell"><span className="pos-kpi-label">Serveurs</span><b className="pos-kpi-value">{stats.total}</b></div>
        <div className="pos-kpi-cell"><span className="pos-kpi-label">Actifs</span><b className="pos-kpi-value pos-kpi-green">{stats.active}</b></div>
        <div className="pos-kpi-cell"><span className="pos-kpi-label">Suspendus</span><b className="pos-kpi-value pos-kpi-red">{stats.suspended}</b></div>
        <div className="pos-kpi-cell"><span className="pos-kpi-label">Restaurants</span><b className="pos-kpi-value">{stats.restaurants}</b></div>
      </div>

      <section className="pos-card pos-table-card">
        <div className="pos-table-head">
          <span>Serveur</span>
          <span>Restaurant</span>
          <span>Statut</span>
          <span>Shift</span>
          <span></span>
        </div>
        {state.loading ? <div className="pos-loading">Chargement...</div> : null}
        {!state.loading && servers.length === 0 ? <div className="pos-empty">Aucun serveur trouve.</div> : null}
        {servers.map((server) => (
          <div key={server.id} className="pos-table-row">
            <div>
              <strong>{server.full_name}</strong>
              <small>{server.code}{server.phone ? ` - ${server.phone}` : ""}</small>
            </div>
            <span>{server.restaurant_name || "-"}</span>
            <span className={`pos-pill ${statusClass(server.status)}`}>{STATUS_LABEL[server.status] || server.status}</span>
            <span>{server.current_shift?.shift_name || "Aucun shift"}</span>
            <Link className="pos-link" to={`/pos-restaurant/servers/${server.id}`}>Voir detail</Link>
          </div>
        ))}
      </section>
    </div>
  );
}
