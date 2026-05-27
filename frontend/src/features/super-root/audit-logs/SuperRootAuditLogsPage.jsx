import { useEffect, useState } from "react";

import { SrBadge, SrCard, SrTable, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { superRootAuditLogsApi } from "./superRootAuditLogsApi";

const SEVERITY_TONE = {
  info: "neutral",
  success: "ok",
  warning: "warning",
  danger: "danger",
  critical: "danger",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SuperRootAuditLogsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", source: "all", severity: "", page: 1 });

  async function load(nextFilters = filters) {
    setLoading(true);
    setError("");
    try {
      setData(await superRootAuditLogsApi.listAuditLogs(nextFilters));
    } catch (err) {
      setError(err.payload?.detail || err.message || "Chargement des logs impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.source, filters.severity]);

  function updateFilter(key, value) {
    const next = { ...filters, [key]: value, page: 1 };
    setFilters(next);
    if (key !== "q") load(next);
  }

  function submitSearch(event) {
    event.preventDefault();
    load({ ...filters, page: 1 });
  }

  const pagination = data?.pagination || {};

  return (
    <SuperRootPageShell
      title="Audit logs"
      subtitle="Recherche, filtres, pagination et export des actions critiques Super Root et plateforme."
      actions={
        <>
          <a className="sr-btn sr-btn-outline" href={superRootAuditLogsApi.exportCsvUrl(filters)}>Exporter CSV</a>
          <button className="sr-btn sr-btn-outline" onClick={() => load(filters)}>Actualiser</button>
        </>
      }
    >
      <form className="sr-filterbar" onSubmit={submitSearch}>
        <input
          className="sr-input"
          value={filters.q}
          onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
          placeholder="Rechercher action, acteur, cible..."
        />
        <select className="sr-input" value={filters.source} onChange={(event) => updateFilter("source", event.target.value)}>
          <option value="all">Toutes sources</option>
          <option value="activity">Activite hotel/systeme</option>
          <option value="platform">Plateforme</option>
        </select>
        <select className="sr-input" value={filters.severity} onChange={(event) => updateFilter("severity", event.target.value)}>
          <option value="">Toutes severites</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="danger">Danger</option>
          <option value="critical">Critical</option>
        </select>
        <button className="sr-btn" type="submit">Rechercher</button>
      </form>

      <SuperRootState loading={loading} error={error}>
        <SrCard title={`Journal unifie (${pagination.total ?? 0})`}>
          <SrTable
            columns={[
              { key: "created_at", label: "Date", render: (row) => formatDate(row.created_at) },
              { key: "source", label: "Source" },
              { key: "type", label: "Type" },
              { key: "severity", label: "Severite", render: (row) => <SrBadge tone={SEVERITY_TONE[row.severity] || "neutral"}>{row.severity}</SrBadge> },
              { key: "actor", label: "Acteur" },
              { key: "target", label: "Cible" },
              { key: "description", label: "Description" },
            ]}
            rows={data?.audit_logs || []}
            empty="Aucun log ne correspond aux filtres."
          />
          <div className="sr-pagination">
            <button className="sr-btn sr-btn-outline" disabled={!pagination.has_previous} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Precedent</button>
            <span>Page {pagination.page || 1} / {pagination.pages || 1}</span>
            <button className="sr-btn sr-btn-outline" disabled={!pagination.has_next} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Suivant</button>
          </div>
        </SrCard>
      </SuperRootState>
    </SuperRootPageShell>
  );
}
