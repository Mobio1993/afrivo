import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../auth/permissions";
import { assignDefaultHotelFromReport, getReportBySlug, getReportsOverview } from "../../services/reportsService";
import "./ReportsPage.css";

const periodOptions = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "7 jours" },
  { value: "month", label: "30 jours" },
];

const reportTabs = [
  { slug: "financial", label: "Financiers" },
  { slug: "occupancy", label: "Occupation" },
  { slug: "day_use", label: "Day use" },
  { slug: "tenancy", label: "Tenancy readiness" },
];

function renderRows(activeReport, rows) {
  if (!rows?.length) {
    return <div className="empty-note">Aucune donnee disponible sur la periode selectionnee.</div>;
  }

  return (
    <div className="table-like">
      {rows.map((row) => (
        <article key={`${activeReport}-${row.reference || row.name || row.guest || row.username}`} className="table-card">
          {Object.entries(row).map(([key, value]) => (
            <div key={key} className="table-row">
              <strong>{key}</strong>
              <span>{String(value ?? "-")}</span>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}

function renderTenancyReadiness(reportData, onAssignDefaultHotel, actionLoading) {
  const nextActivation = reportData.next_activation || null;
  const rolloutJournal = reportData.rollout_journal || [];
  const nextActivationStatusClass =
    nextActivation?.status === "ready"
      ? "ready"
      : nextActivation?.status === "complete"
        ? "complete"
        : "blocked";

  return (
    <>
      <section className="list-panel reports-tenancy-actions-panel">
        <div className="panel-head">
          <div>
            <h3>Actions de preparation</h3>
            <p>Rattache les comptes encore bloquants a l'hotel par defaut sans passer par l'admin Django.</p>
          </div>
          <button
            type="button"
            className="primary-button reports-action-button"
            onClick={onAssignDefaultHotel}
            disabled={actionLoading || !reportData.summary?.unassigned_users}
          >
            {actionLoading ? "Rattachement en cours..." : "Rattacher tous les comptes sans hotel"}
          </button>
        </div>
      </section>

      <section className={`list-panel reports-next-activation-panel ${nextActivationStatusClass}`}>
        <div className="panel-head">
          <div>
            <h3>Prêt à activer maintenant</h3>
            <p>
              {nextActivation?.status === "complete"
                ? "Tous les modules cibles ont deja ete bascules en mode strict."
                : nextActivation?.can_activate_now
                  ? "Le prochain module recommande peut etre active immediatement."
                  : "La prochaine bascule reste bloquee tant que tous les comptes n'ont pas d'hotel."}
            </p>
          </div>
          <span className={`reports-next-activation-badge ${nextActivationStatusClass}`}>
            {nextActivation?.status === "complete"
              ? "Termine"
              : nextActivation?.can_activate_now
                ? "Pret"
                : "Bloque"}
          </span>
        </div>

        {nextActivation?.status === "complete" ? (
          <div className="reports-next-activation-copy">
            <strong>Parcours de bascule termine</strong>
            <p>{nextActivation.activation_instruction}</p>
          </div>
        ) : (
          <div className="reports-next-activation-grid">
            <article className="stack-card reports-next-activation-card">
              <strong>Module cible</strong>
              <span className="stack-metric">{nextActivation?.module || "-"}</span>
              <p>
                {nextActivation?.can_activate_now
                  ? "Aucun compte bloquant restant. La bascule peut etre engagee."
                  : `${nextActivation?.blocking_users || 0} compte(s) restent a rattacher avant activation.`}
              </p>
            </article>

            <article className="stack-card reports-next-activation-card">
              <strong>Variable d'activation</strong>
              <span className="stack-metric">
                <code>
                  {nextActivation?.env_var
                    ? `${nextActivation.env_var}=${nextActivation.activation_value || "true"}`
                    : "Aucune"}
                </code>
              </span>
              <p>{nextActivation?.activation_instruction || "Aucune instruction disponible."}</p>
            </article>
          </div>
        )}
      </section>

      <section className="list-panel">
        <div className="panel-head">
          <div>
            <h3>Journal de bascule</h3>
            <p>Lecture operationnelle des modules deja stricts et de ceux qui restent dans le pipeline recommande.</p>
          </div>
        </div>
        <div className="stack-list">
          {rolloutJournal.map((item) => (
            <article key={item.module} className="stack-card reports-rollout-journal-card">
              <div className="reports-rollout-journal-head">
                <strong>{item.title}</strong>
                <span className={`reports-rollout-journal-badge ${item.status}`}>{item.status}</span>
              </div>
              <p>{item.message}</p>
              {item.env_var ? (
                <small>
                  Variable cible: <code>{item.env_var}=true</code>
                </small>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="card-grid">
        <article className="info-card">
          <strong>Utilisateurs total</strong>
          <div className="metric">{reportData.summary?.total_users ?? 0}</div>
          <p>Population utilisateur analysee pour la bascule tenancy.</p>
        </article>
        <article className="info-card">
          <strong>Utilisateurs rattaches</strong>
          <div className="metric">{reportData.summary?.assigned_users ?? 0}</div>
          <p>Comptes deja relies a un hotel actif.</p>
        </article>
        <article className="info-card">
          <strong>Utilisateurs a corriger</strong>
          <div className="metric">{reportData.summary?.unassigned_users ?? 0}</div>
          <p>Comptes encore bloquants avant bascule stricte.</p>
        </article>
        <article className="info-card">
          <strong>Taux de preparation</strong>
          <div className="metric">{reportData.summary?.readiness_ratio ?? 0}%</div>
          <p>Part des utilisateurs deja prets pour le mode strict.</p>
        </article>
      </section>

      <section className="dashboard-columns dashboard-columns-equal">
        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>Ordre de bascule recommande</h3>
              <p>Sequence conseillee pour activer les modules stricts sans rupture.</p>
            </div>
          </div>
          <div className="stack-list">
            {(reportData.recommended_rollout_order || []).map((item, index) => (
              <article key={item} className="stack-card reports-rollout-card">
                <strong>
                  {index + 1}. {item}
                </strong>
                <p>Module cible pour la prochaine activation stricte.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>Etat des modules</h3>
              <p>Lecture immediate des modules deja stricts ou encore bloquants.</p>
            </div>
          </div>
          <div className="stack-list">
            {(reportData.strict_modules || []).map((item) => (
              <article key={item.module} className="stack-card reports-module-card">
                <strong>{item.module}</strong>
                <span
                  className={`reports-module-badge ${
                    item.strict_enabled ? "strict" : item.ready_for_strict_mode ? "ready" : "blocked"
                  }`}
                >
                  {item.strict_enabled
                    ? "Strict actif"
                    : item.ready_for_strict_mode
                      ? "Pret"
                      : `${item.blocking_users} bloquant(s)`}
                </span>
                <p>
                  {item.strict_enabled
                    ? "Le module applique deja le controle hotel strict."
                    : item.ready_for_strict_mode
                      ? "Le module peut etre active en mode strict."
                      : "Des utilisateurs restent a rattacher avant activation."}
                </p>
                {item.env_var ? (
                  <div className="reports-module-activation">
                    <div className="table-row">
                      <strong>Variable</strong>
                      <span>
                        <code>{item.env_var}=true</code>
                      </span>
                    </div>
                    <div className="table-row">
                      <strong>Procedure</strong>
                      <span>{item.activation_instruction}</span>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="dashboard-columns dashboard-columns-equal">
        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>Repartition par role</h3>
              <p>Vision des comptes encore non rattaches selon leur usage metier.</p>
            </div>
          </div>
          <div className="table-like">
            {(reportData.role_breakdown || []).map((item) => (
              <article key={item.role} className="table-card">
                <div className="table-row">
                  <strong>Role</strong>
                  <span>{item.label}</span>
                </div>
                <div className="table-row">
                  <strong>Total</strong>
                  <span>{item.count}</span>
                </div>
                <div className="table-row">
                  <strong>Sans hotel</strong>
                  <span>{item.missing_hotel_count}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>Comptes a corriger</h3>
              <p>Liste des utilisateurs encore sans hotel avant bascule stricte.</p>
            </div>
          </div>
          {renderRows("tenancy-users", reportData.users_without_hotel)}
        </section>
      </section>
    </>
  );
}

export function ReportsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("today");
  const [overview, setOverview] = useState(null);
  const [activeReport, setActiveReport] = useState("financial");
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const canViewReports = hasPermission(user, "reports", "view");
  const canManageReports = hasPermission(user, "reports", "manage");
  const visibleReportTabs = useMemo(
    () => reportTabs.filter((tab) => tab.slug !== "tenancy" || canManageReports),
    [canManageReports],
  );

  useEffect(() => {
    if (!canViewReports) {
      setOverview(null);
      return;
    }
    getReportsOverview(period).then(setOverview).catch(() => null);
  }, [canViewReports, period]);

  useEffect(() => {
    if (!canViewReports) {
      setLoading(false);
      setError("Vous n'avez pas les droits suffisants pour consulter les rapports.");
      setReportData(null);
      return;
    }
    if (activeReport === "tenancy" && !canManageReports) {
      setActiveReport(visibleReportTabs[0]?.slug || "financial");
      return;
    }
    setLoading(true);
    setError("");

    getReportBySlug(activeReport, period)
      .then((payload) => {
        setReportData(payload);
      })
      .catch(() => {
        setReportData(null);
        setError("Impossible de charger ce rapport pour le moment.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeReport, canManageReports, canViewReports, period, visibleReportTabs]);

  const reportHeroLabel = useMemo(() => {
    if (activeReport === "tenancy") {
      return "Pilotage tenancy";
    }
    return reportData?.period?.label || overview?.period?.label || "Periode";
  }, [activeReport, overview, reportData]);

  async function handleAssignDefaultHotel() {
    if (actionLoading || !canManageReports || !reportData?.summary?.unassigned_users) {
      return;
    }

    const confirmed = window.confirm(
      "Rattacher tous les utilisateurs sans hotel a l'hotel par defaut ?",
    );
    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setActionMessage("");

    try {
      const payload = await assignDefaultHotelFromReport();
      setReportData(payload);
      setActionMessage(payload.assignment_result?.message || "Rattachement effectue.");
    } catch (requestError) {
      setActionMessage(requestError.message || "Impossible de lancer le rattachement pour le moment.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="page-stack reports-page">
      <section className="dashboard-hero">
        <div className="section-head">
          <div>
            <span className="eyebrow">Rapports React</span>
            <h2>{overview?.title || "Rapports direction"}</h2>
            <p>
              {overview?.subtitle ||
                "Lecture analytique des rapports financiers, d'occupation, day use et du pilotage tenancy."}
            </p>
          </div>

          <div className="pill-row">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`pill ${period === option.value ? "active" : ""}`}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card-grid compact-grid">
        {(overview?.summary_cards || []).map((card) => (
          <article key={card.label} className="info-card">
            <strong>{card.label}</strong>
            <div className="metric">{card.value}</div>
            <p>{card.meta}</p>
          </article>
        ))}
      </section>

      <section className="list-panel">
        <div className="report-tabs">
          {visibleReportTabs.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              className={`report-tab-button ${activeReport === tab.slug ? "active" : ""}`}
              onClick={() => setActiveReport(tab.slug)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {!canViewReports ? <div className="alert-box">Vous n'avez pas les droits suffisants pour consulter les rapports.</div> : null}
      {loading ? <div className="status-box">Chargement du rapport selectionne...</div> : null}
      {error ? <div className="alert-box">{error}</div> : null}
      {actionMessage ? <div className="success-box">{actionMessage}</div> : null}

      {reportData ? (
        <>
          <section className="hero-panel">
            <span className="eyebrow">{reportHeroLabel}</span>
            <h2>{reportData.title}</h2>
            <p>{reportData.subtitle}</p>
          </section>

          {activeReport === "tenancy" ? (
            renderTenancyReadiness(reportData, handleAssignDefaultHotel, actionLoading)
          ) : (
            <>
              <section className="card-grid">
                {(reportData.summary_cards || []).map((card) => (
                  <article key={card.label} className="info-card">
                    <strong>{card.label}</strong>
                    <div className="metric">{card.value}</div>
                    <p>{card.meta}</p>
                  </article>
                ))}
              </section>

              {reportData.payment_methods ? (
                <section className="dashboard-columns dashboard-columns-equal">
                  <section className="list-panel">
                    <div className="panel-head">
                      <div>
                        <h3>Modes de paiement</h3>
                        <p>Repartition des encaissements valides.</p>
                      </div>
                    </div>
                    <div className="stack-list">
                      {reportData.payment_methods.map((item) => (
                        <article key={item.label} className="stack-card">
                          <strong>{item.label}</strong>
                          <span className="stack-metric">{item.total_amount}</span>
                          <p>{item.total_count} paiement(s)</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="list-panel">
                    <div className="panel-head">
                      <div>
                        <h3>Origine des revenus</h3>
                        <p>Lecture des encaissements selon la source metier.</p>
                      </div>
                    </div>
                    <div className="stack-list">
                      {reportData.source_breakdown.map((item) => (
                        <article key={item.title} className="stack-card">
                          <strong>{item.title}</strong>
                          <span className="stack-metric">{item.amount}</span>
                          <p>{item.count} paiement(s)</p>
                          <small>{item.description}</small>
                        </article>
                      ))}
                    </div>
                  </section>
                </section>
              ) : null}

              {reportData.status_cards ? (
                <section className="dashboard-columns dashboard-columns-equal">
                  <section className="list-panel">
                    <div className="panel-head">
                      <div>
                        <h3>Statuts</h3>
                        <p>Lecture immediate de l'etat du domaine selectionne.</p>
                      </div>
                    </div>
                    <div className="operation-grid">
                      {reportData.status_cards.map((item) => (
                        <article key={item.label} className="operation-card">
                          <strong>{item.label}</strong>
                          <span>{item.value}</span>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="list-panel">
                    <div className="panel-head">
                      <div>
                        <h3>Details analytiques</h3>
                        <p>Ventilation complementaire de la periode.</p>
                      </div>
                    </div>
                    <div className="stack-list">
                      {(reportData.room_type_breakdown || reportData.overtime_breakdown || []).map((item) => (
                        <article key={item.name || item.label} className="stack-card compact">
                          <strong>{item.name || item.label}</strong>
                          <span className="stack-metric">
                            {item.total_amount || item.total_rooms || item.available_count || item.total_count}
                          </span>
                          <p>
                            {item.occupied_count !== undefined
                              ? `${item.available_count} disponibles / ${item.occupied_count} occupees`
                              : `${item.total_count} element(s)`}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>
                </section>
              ) : null}

              <section className="list-panel">
                <div className="panel-head">
                  <div>
                    <h3>Liste detaillee</h3>
                    <p>Lecture detaillee des derniers elements sur la periode selectionnee.</p>
                  </div>
                </div>
                {renderRows(activeReport, reportData.recent_rows)}
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
