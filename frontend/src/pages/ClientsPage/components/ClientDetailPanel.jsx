import { useEffect, useState } from "react";

import { ClientForm } from "../../../components/ClientForm";
import { normalizeClientStatus, normalizeValue } from "../utils";
import { ClientConsumptionsTab } from "./ClientConsumptionsTab";
import { ClientHistoryTab } from "./ClientHistoryTab";
import { ClientInvoicesTab } from "./ClientInvoicesTab";
import { ClientPaymentsTab } from "./ClientPaymentsTab";
import { ClientSatisfactionTab } from "./ClientSatisfactionTab";
import { ClientStaysTab } from "./ClientStaysTab";
import { EmptyStateCard } from "./EmptyStateCard";

function DetailRow({ label, value }) {
  return (
    <div className="table-row">
      <strong>{label}</strong>
      <span>{normalizeValue(value)}</span>
    </div>
  );
}

function DetailSection({ title, rows }) {
  return (
    <div className="table-card detail-info-card clients-detail-section-card">
      <div className="clients-detail-section-card__head">
        <strong>{title}</strong>
      </div>
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

function HighlightCard({ label, value, meta }) {
  return (
    <article className="info-card dashboard-kpi-card clients-highlight-card">
      <span className="dashboard-card-label">{label}</span>
      <div className="clients-highlight-value">{normalizeValue(value)}</div>
      <p>{meta}</p>
    </article>
  );
}

function isBlankClientValue(value) {
  return value === null || value === undefined || value === "" || value === "-";
}

function parseClientDate(value) {
  if (isBlankClientValue(value)) return null;

  if (typeof value === "string") {
    const frenchDateMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (frenchDateMatch) {
      const [, day, month, year] = frenchDateMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCompactDateTime(value) {
  const parsed = parseClientDate(value);
  if (!parsed) return "";

  return parsed.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildClientAlerts(selectedClient, clientStatus) {
  if (!selectedClient) return [];

  const alerts = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const documentExpiryDate = parseClientDate(selectedClient.document_expiry_date);

  if (selectedClient.is_blacklisted || clientStatus.value === "blacklist") {
    alerts.push({
      key: "blacklist",
      tone: "danger",
      title: "Client blacklisté",
      description: "Vérifier les consignes internes avant toute nouvelle opération.",
    });
  }

  if (clientStatus.value === "vip") {
    alerts.push({
      key: "vip",
      tone: "success",
      title: "Client VIP",
      description: "Prévoir un accueil prioritaire et vérifier les préférences habituelles.",
    });
  }

  if (documentExpiryDate && documentExpiryDate < today) {
    alerts.push({
      key: "expired-document",
      tone: "warning",
      title: "Pièce expirée",
      description: "Demander une pièce d'identité à jour lors du prochain passage.",
    });
  }

  if (isBlankClientValue(selectedClient.identity_document_number)) {
    alerts.push({
      key: "missing-document",
      tone: "info",
      title: "Pièce non renseignée",
      description: "Compléter le numéro de pièce pour limiter les doublons.",
    });
  }

  if (isBlankClientValue(selectedClient.phone)) {
    alerts.push({
      key: "missing-phone",
      tone: "warning",
      title: "Téléphone manquant",
      description: "Ajouter un contact principal pour les confirmations et relances.",
    });
  }

  if (isBlankClientValue(selectedClient.email)) {
    alerts.push({
      key: "missing-email",
      tone: "info",
      title: "Email manquant",
      description: "Utile pour l'envoi de confirmations, factures et enquêtes satisfaction.",
    });
  }

  return alerts;
}

function ClientAlerts({ alerts }) {
  if (!alerts.length) return null;

  return (
    <div className="clients-alerts" role="status" aria-live="polite">
      {alerts.map((alert) => (
        <article key={alert.key} className={`clients-alert clients-alert--${alert.tone}`}>
          <strong>{alert.title}</strong>
          <span>{alert.description}</span>
        </article>
      ))}
    </div>
  );
}

const CLIENT_COMPLETENESS_FIELDS = [
  { key: "full_name", label: "Nom complet", weight: 2 },
  { key: "phone", label: "Telephone", weight: 2 },
  { key: "email", label: "Email", weight: 1 },
  { key: "nationality", label: "Nationalite", weight: 1 },
  { key: "identity_document_type_label", label: "Type de piece", weight: 1 },
  { key: "identity_document_number", label: "Numero de piece", weight: 2 },
  { key: "document_expiry_date", label: "Expiration piece", weight: 1 },
  { key: "address", label: "Adresse", weight: 1 },
  { key: "emergency_contact_name", label: "Contact urgence", weight: 1 },
  { key: "emergency_contact_phone", label: "Telephone urgence", weight: 1 },
];

function buildClientCompleteness(selectedClient) {
  if (!selectedClient) {
    return { score: 0, completed: 0, total: 0, missing: [], tone: "low" };
  }

  const total = CLIENT_COMPLETENESS_FIELDS.reduce((sum, field) => sum + field.weight, 0);
  const missing = [];
  const completed = CLIENT_COMPLETENESS_FIELDS.reduce((sum, field) => {
    if (isBlankClientValue(selectedClient[field.key])) {
      missing.push(field.label);
      return sum;
    }
    return sum + field.weight;
  }, 0);
  const score = Math.round((completed / total) * 100);

  return {
    score,
    completed,
    total,
    missing,
    tone: score >= 80 ? "high" : score >= 55 ? "medium" : "low",
  };
}

function ClientCompleteness({ completeness, canEdit, onStartEdit }) {
  if (!completeness.total) return null;

  const missingPreview = completeness.missing.slice(0, 3).join(", ");
  const remainingCount = Math.max(0, completeness.missing.length - 3);

  return (
    <div className={`clients-completeness clients-completeness--${completeness.tone}`}>
      <div className="clients-completeness-head">
        <div>
          <strong>Qualite fiche</strong>
          <span>{completeness.score}%</span>
        </div>
        {canEdit && completeness.missing.length ? (
          <button
            type="button"
            className="clients-completeness-edit"
            onClick={onStartEdit}
          >
            Completer
          </button>
        ) : null}
      </div>
      <div
        className="clients-completeness-bar"
        role="progressbar"
        aria-label="Taux de completion de la fiche client"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completeness.score}
      >
        <span style={{ width: `${completeness.score}%` }} />
      </div>
      {completeness.missing.length ? (
        <p>
          Manquant : {missingPreview}
          {remainingCount ? `, +${remainingCount}` : ""}
        </p>
      ) : (
        <p>Dossier client complet pour les operations courantes.</p>
      )}
    </div>
  );
}

const CLIENT_QUICK_ACTIONS = [
  {
    action: "booking",
    label: "Reservation",
    description: "Creer une reservation",
  },
  {
    action: "stay",
    label: "Sejour",
    description: "Ouvrir un sejour",
  },
  {
    action: "day_use",
    label: "Day use",
    description: "Preparer un passage court",
  },
  {
    action: "payment",
    label: "Paiement",
    description: "Aller aux encaissements",
  },
];

function ClientQuickActions({ onQuickAction }) {
  if (!onQuickAction) return null;

  return (
    <div className="clients-quick-actions" aria-label="Actions rapides client">
      <div className="clients-quick-actions-head">
        <strong>Actions rapides</strong>
      </div>
      <div className="clients-quick-actions-grid">
        {CLIENT_QUICK_ACTIONS.map((item) => (
          <button
            key={item.action}
            type="button"
            className="clients-quick-action"
            onClick={() => onQuickAction(item.action)}
          >
            <span>{item.label}</span>
            <small>{item.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function ClientCompactSummary({ items }) {
  if (!items.length) return null;

  return (
    <div className="clients-compact-summary" aria-label="Resume rapide du client">
      {items.map((item) => (
        <span key={item.key} className={`clients-compact-summary-pill clients-compact-summary-pill--${item.tone}`}>
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ClientDetailPanel({
  mode,
  canCreate,
  canEdit,
  canDelete,
  selectedClient,
  selectedClientHighlights,
  selectedClientSummary,
  detailLoading,
  submitting,
  formErrors,
  onStartEdit,
  onDelete,
  onReactivate,
  onSave,
  onCancelForm,
  onCreate,
  onQuickAction,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState("profile");
  const [clientCodeCopied, setClientCodeCopied] = useState(false);
  const clientStatus = normalizeClientStatus(selectedClient?.client_status);
  const clientCode = selectedClient?.client_code || selectedClient?.clientCode || "";
  const displayClientCode = clientCode || "Code non généré";
  const clientAlerts = buildClientAlerts(selectedClient, clientStatus);
  const clientCompleteness = buildClientCompleteness(selectedClient);
  const canViewFinancial = selectedClient?.permissions?.financial !== false;
  const canViewSatisfaction = selectedClient?.permissions?.satisfaction !== false;
  const compactSummaryItems = selectedClient
    ? [
        {
          key: "status",
          label: clientStatus.label,
          tone: clientStatus.tone || "neutral",
        },
        {
          key: "stays",
          label: `${selectedClient.stay_portfolio?.total_count ?? selectedClient.stay_count ?? 0} sejour(s)`,
          tone: "neutral",
        },
        {
          key: "client-type",
          label: normalizeValue(selectedClient.client_type_label),
          tone: "neutral",
        },
        selectedClient.timeline_portfolio?.last_event_at
          ? {
              key: "last-event",
              label: `Dernier passage ${formatCompactDateTime(selectedClient.timeline_portfolio.last_event_at)}`,
              tone: "neutral",
            }
          : null,
        {
          key: "completeness",
          label: `Fiche ${clientCompleteness.score}%`,
          tone: clientCompleteness.tone,
        },
        canViewFinancial && Number(selectedClient.payment_portfolio?.pending_count || 0) > 0
          ? {
              key: "pending-payments",
              label: `${selectedClient.payment_portfolio.pending_count} paiement(s) en attente`,
              tone: "warning",
            }
          : null,
        canViewFinancial && Number(selectedClient.invoice_portfolio?.balance_due || 0) > 0
          ? {
              key: "balance-due",
              label: `Solde ${selectedClient.invoice_portfolio.balance_due}`,
              tone: "warning",
            }
          : null,
      ].filter(Boolean)
    : [];
  useEffect(() => {
    if (
      mode !== "detail" ||
      (!canViewFinancial && ["consumptions", "invoices", "payments"].includes(activeTab)) ||
      (!canViewSatisfaction && activeTab === "satisfaction")
    ) {
      setActiveTab("profile");
    }
  }, [activeTab, canViewFinancial, canViewSatisfaction, mode, selectedClient?.id]);

  useEffect(() => {
    setClientCodeCopied(false);
  }, [selectedClient?.id, clientCode]);

  async function handleCopyClientCode() {
    if (!clientCode) return;
    try {
      await navigator.clipboard.writeText(clientCode);
      setClientCodeCopied(true);
      window.setTimeout(() => setClientCodeCopied(false), 1800);
    } catch (_error) {
      setClientCodeCopied(false);
    }
  }

  const sections = selectedClient
    ? [
        {
          title: "Identité",
          rows: [
            { label: "Nom complet", value: selectedClient.full_name },
            { label: "Type", value: selectedClient.client_type_label },
            { label: "Statut", value: clientStatus.label },
            { label: "Genre", value: selectedClient.gender_label },
            { label: "Naissance", value: selectedClient.formattedDateOfBirth },
            { label: "Lieu", value: selectedClient.place_of_birth },
            { label: "Nationalité", value: selectedClient.nationality },
            { label: "Situation", value: selectedClient.marital_status_label },
            { label: "Profession", value: selectedClient.profession },
          ],
        },
        {
          title: "Coordonnées",
          rows: [
            { label: "Téléphone", value: selectedClient.phone },
            { label: "Tél. secondaire", value: selectedClient.secondary_phone },
            { label: "Email", value: selectedClient.email },
            { label: "Ville", value: selectedClient.city },
            { label: "Adresse", value: selectedClient.address },
          ],
        },
        {
          title: "Pièce d'identité",
          rows: [
            { label: "Type", value: selectedClient.identity_document_type_label },
            { label: "Numéro", value: selectedClient.identity_document_number },
            { label: "Émission", value: selectedClient.document_issue_date },
            { label: "Expiration", value: selectedClient.document_expiry_date },
            { label: "Lieu émission", value: selectedClient.document_issue_place },
          ],
        },
        {
          title: "Urgence & suivi",
          rows: [
            { label: "Contact urgence", value: selectedClient.emergency_contact_name },
            { label: "Tél. urgence", value: selectedClient.emergency_contact_phone },
            { label: "Lien", value: selectedClient.emergency_contact_relationship },
            { label: "Notes", value: selectedClient.notes },
            { label: "Mise à jour", value: selectedClient.formattedUpdatedAt },
          ],
        },
      ]
    : [];

  /* ── Form mode (edit / create) ── */
  if (mode === "create" || mode === "edit") {
    return (
      <section className="clients-detail-panel">
        <div className="clients-detail-form-head">
          <h3>
            {mode === "create" ? "Nouvelle fiche client" : "Modifier la fiche client"}
          </h3>
          <p>
            Renseignez les informations client avec vérification immédiate des champs essentiels.
          </p>
        </div>
        <ClientForm
          mode={mode}
          initialData={mode === "edit" ? selectedClient : null}
          onSubmit={onSave}
          onCancel={onCancelForm}
          serverErrors={formErrors}
          submitting={submitting}
        />
      </section>
    );
  }

  /* ── Loading skeleton ── */
  if (detailLoading) {
    return (
      <section className="clients-detail-panel">
        <div
          className="clients-detail-skeleton"
          aria-busy="true"
          aria-label="Chargement de la fiche client"
        >
          <div className="clients-skeleton-hero">
            <div className="clients-skeleton-avatar" aria-hidden="true" />
            <div className="clients-skeleton-copy">
              <div className="clients-skeleton-line w-55" />
              <div className="clients-skeleton-line w-35" />
              <div className="clients-skeleton-badges">
                <div className="clients-skeleton-badge" />
                <div className="clients-skeleton-badge" />
              </div>
            </div>
          </div>
          <div className="clients-skeleton-tabs">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="clients-skeleton-tab" aria-hidden="true" />
            ))}
          </div>
          <div className="clients-skeleton-body">
            {[70, 50, 85, 60, 40, 75].map((w, i) => (
              <div key={i} className={`clients-skeleton-line w-${w}`} aria-hidden="true" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  /* ── Empty state ── */
  if (!selectedClient) {
    return (
      <section className="clients-detail-panel">
        <div className="clients-detail-empty">
          <span className="clients-detail-empty-icon" aria-hidden="true">👤</span>
          <strong>Sélectionnez un client</strong>
          <p>Cliquez sur une ligne de la liste pour afficher la fiche complète du client.</p>
          {canCreate ? (
            <button
              type="button"
              className="primary-button"
              style={{ marginTop: 8 }}
              onClick={onCreate}
            >
              + Nouveau client
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  /* ── Detail view ── */
  return (
    <section className="clients-detail-panel">
      {/* Compact header */}
      <div className="clients-detail-header">
        <div className="clients-detail-avatar" aria-hidden="true">
          {selectedClient.initials}
        </div>

        <div className="clients-detail-header-info">
          <strong className="clients-detail-header-name">
            {normalizeValue(selectedClient.full_name)}
          </strong>

          <div className="clients-detail-header-contact">
            <span>{normalizeValue(selectedClient.phone)}</span>
            {selectedClient.email && selectedClient.email !== "-" ? (
              <>
                <span aria-hidden="true">Â·</span>
                <span>{selectedClient.email}</span>
              </>
            ) : null}
          </div>

          <ClientCompactSummary items={compactSummaryItems} />
        </div>

        <div className="clients-detail-header-actions">
          {onRefresh ? (
            <button
              type="button"
              className="clients-detail-header-refresh"
              onClick={onRefresh}
              title="Rafraîchir la fiche"
              aria-label="Rafraîchir la fiche client"
            >
              ↻
            </button>
          ) : null}

          {canEdit && selectedClient.is_active === false && onReactivate ? (
            <button
              type="button"
              className="secondary-button clients-detail-action-button"
              onClick={onReactivate}
            >
              Reactiver
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              className="secondary-button clients-detail-action-button"
              onClick={onStartEdit}
            >
              Modifier
            </button>
          ) : null}

          {canDelete && selectedClient.is_active !== false ? (
            <button
              type="button"
              className="secondary-button clients-detail-action-button clients-detail-action-danger"
              onClick={onDelete}
            >
              Archiver
            </button>
          ) : null}
        </div>
      </div>

      <ClientAlerts alerts={clientAlerts} />
      <div className="clients-detail-ops-strip">
        <ClientCompleteness
          completeness={clientCompleteness}
          canEdit={canEdit}
          onStartEdit={onStartEdit}
        />
        <ClientQuickActions onQuickAction={onQuickAction} />
      </div>

      {/* Tabs + content */}
      <div className="table-like">
        {/* Tab bar */}
        <div
          className="clients-detail-tabs"
          role="tablist"
          aria-label="Sections de la fiche client"
        >
          {[
            {
              id: "profile",
              label: "Profil",
              count: null,
              indicator: clientCompleteness.missing.length ? "warning" : null,
            },
            {
              id: "history",
              label: "Historique",
              count: selectedClient?.timeline_portfolio?.total_events ?? null,
              indicator: selectedClient?.timeline_portfolio?.last_event_at ? "info" : null,
            },
            {
              id: "stays",
              label: "Séjours",
              count: selectedClient?.stay_portfolio?.total_count ?? null,
              indicator: Number(selectedClient?.stay_portfolio?.active_count || 0) > 0 ? "success" : null,
            },
            {
              id: "consumptions",
              label: "Consommations",
              count: selectedClient?.consumption_portfolio?.total_count ?? null,
              indicator: Number(selectedClient?.consumption_portfolio?.draft_count || 0) > 0 ? "warning" : null,
            },
            {
              id: "invoices",
              label: "Factures",
              count: selectedClient?.invoice_portfolio?.total_count ?? null,
              indicator: Number(selectedClient?.invoice_portfolio?.balance_due || 0) > 0 ? "warning" : null,
            },
            {
              id: "payments",
              label: "Paiements",
              count: selectedClient?.payment_portfolio?.confirmed_count ?? null,
              indicator: Number(selectedClient?.payment_portfolio?.pending_count || 0) > 0 ? "warning" : null,
            },
            {
              id: "satisfaction",
              label: "Satisfaction",
              count: selectedClient?.satisfaction_portfolio?.total_count ?? null,
              indicator: Number(selectedClient?.satisfaction_portfolio?.dissatisfied_count || 0) > 0 ? "danger" : null,
            },
          ]
            .filter((tab) => {
              if (["consumptions", "invoices", "payments"].includes(tab.id)) {
                return canViewFinancial;
              }
              if (tab.id === "satisfaction") {
                return canViewSatisfaction;
              }
              return true;
            })
            .map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              className={`clients-detail-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.indicator ? (
                <span
                  className={`clients-tab-indicator clients-tab-indicator--${tab.indicator}`}
                  aria-hidden="true"
                />
              ) : null}
              {tab.label}
              {tab.count !== null && tab.count > 0 ? (
                <span className="clients-tab-count" aria-hidden="true">
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div
          key={activeTab}
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          tabIndex={0}
          className="clients-tabpanel"
        >
          {activeTab === "profile" ? (
            <>
              {/* Client code */}
              <div className="clients-client-code-row" style={{ marginBottom: 12 }}>
                <span className="clients-client-code-label">Code client</span>
                <div className="clients-client-code-group">
                  <span
                    className={`clients-client-code-badge ${clientCode ? "" : "is-empty"}`}
                    title={displayClientCode}
                  >
                    {displayClientCode}
                  </span>
                  <button
                    type="button"
                    className="ghost-button clients-client-code-copy"
                    onClick={handleCopyClientCode}
                    disabled={!clientCode}
                  >
                    {clientCodeCopied ? "Copié" : "Copier"}
                  </button>
                </div>
              </div>

              {/* Highlight cards */}
              {selectedClientHighlights.length ? (
                <div className="clients-summary-grid">
                  {selectedClientHighlights.map((item) => (
                    <HighlightCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      meta={item.meta}
                    />
                  ))}
                </div>
              ) : null}

              {/* Detail sections — 2-column grid */}
              <div className="clients-detail-sections-grid">
                {sections.map((section) => (
                  <DetailSection
                    key={section.title}
                    title={section.title}
                    rows={section.rows}
                  />
                ))}
              </div>

              {/* KPI summary from server */}
              {selectedClientSummary.length ? (
                <div className="clients-summary-grid">
                  {selectedClientSummary.map((item) => (
                    <article key={item.label} className="info-card dashboard-kpi-card clients-highlight-card">
                      <span className="dashboard-card-label">{item.label}</span>
                      <div className="clients-highlight-value">
                        {normalizeValue(item.value)}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === "history" ? (
            <ClientHistoryTab selectedClient={selectedClient} />
          ) : null}
          {activeTab === "stays" ? (
            <ClientStaysTab selectedClient={selectedClient} />
          ) : null}
          {activeTab === "consumptions" ? (
            <ClientConsumptionsTab selectedClient={selectedClient} />
          ) : null}
          {activeTab === "invoices" ? (
            <ClientInvoicesTab selectedClient={selectedClient} />
          ) : null}
          {activeTab === "payments" ? (
            <ClientPaymentsTab selectedClient={selectedClient} />
          ) : null}
          {activeTab === "satisfaction" ? (
            <ClientSatisfactionTab selectedClient={selectedClient} />
          ) : null}
        </div>
      </div>
    </section>
  );
}
