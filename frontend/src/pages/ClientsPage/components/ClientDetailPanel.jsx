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

function HighlightCard({ label, value, meta }) {
  return (
    <article className="info-card dashboard-kpi-card clients-highlight-card">
      <span className="dashboard-card-label">{label}</span>
      <div className="clients-highlight-value">{normalizeValue(value)}</div>
      <p>{meta}</p>
    </article>
  );
}

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
  onSave,
  onCancelForm,
  onCreate,
}) {
  const [activeTab, setActiveTab] = useState("profile");
  const [clientCodeCopied, setClientCodeCopied] = useState(false);
  const clientStatus = normalizeClientStatus(selectedClient?.client_status);
  const clientCode = selectedClient?.client_code || selectedClient?.clientCode || "";
  const displayClientCode = clientCode || "Code non genere";

  useEffect(() => {
    if (mode !== "detail") {
      setActiveTab("profile");
    }
  }, [mode, selectedClient?.id]);

  useEffect(() => {
    setClientCodeCopied(false);
  }, [selectedClient?.id, clientCode]);

  async function handleCopyClientCode() {
    if (!clientCode) {
      return;
    }

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
          title: "Identite",
          rows: [
            { label: "Nom complet", value: selectedClient.full_name },
            { label: "Type de client", value: selectedClient.client_type_label },
            { label: "Statut client", value: clientStatus.label },
            { label: "Genre", value: selectedClient.gender_label },
            { label: "Date de naissance", value: selectedClient.formattedDateOfBirth },
            { label: "Lieu de naissance", value: selectedClient.place_of_birth },
            { label: "Nationalite", value: selectedClient.nationality },
            { label: "Situation matrimoniale", value: selectedClient.marital_status_label },
            { label: "Profession", value: selectedClient.profession },
          ],
        },
        {
          title: "Coordonnees",
          rows: [
            { label: "Telephone principal", value: selectedClient.phone },
            { label: "Telephone secondaire", value: selectedClient.secondary_phone },
            { label: "Email", value: selectedClient.email },
            { label: "Ville", value: selectedClient.city },
            { label: "Pays", value: selectedClient.country },
            { label: "Adresse", value: selectedClient.address },
          ],
        },
        {
          title: "Piece d'identite",
          rows: [
            { label: "Type", value: selectedClient.identity_document_type_label },
            { label: "Numero", value: selectedClient.identity_document_number },
            { label: "Date d'emission", value: selectedClient.document_issue_date },
            { label: "Date d'expiration", value: selectedClient.document_expiry_date },
            { label: "Lieu d'emission", value: selectedClient.document_issue_place },
          ],
        },
        {
          title: "Urgence et suivi",
          rows: [
            { label: "Contact d'urgence", value: selectedClient.emergency_contact_name },
            { label: "Telephone d'urgence", value: selectedClient.emergency_contact_phone },
            { label: "Lien avec le client", value: selectedClient.emergency_contact_relationship },
            { label: "Notes", value: selectedClient.notes },
            { label: "Derniere mise a jour", value: selectedClient.formattedUpdatedAt },
          ],
        },
      ]
    : [];

  return (
    <section className="list-panel dashboard-panel clients-detail-panel">
      <div className="panel-head">
        <div>
          <h3>
            {mode === "create"
              ? "Nouvelle fiche client"
              : mode === "edit"
                ? "Modifier la fiche client"
                : "Fiche client"}
          </h3>
          <p>
            {mode === "detail"
              ? "Consulte la fiche complete, les coordonnees et l'historique hotelier."
              : "Renseigne les informations client avec verification immediate des champs essentiels."}
          </p>
        </div>

        {mode === "detail" && selectedClient ? (
          <div className="action-row clients-detail-actions">
            {canEdit ? (
              <button
                type="button"
                className="secondary-button clients-detail-action-button"
                onClick={onStartEdit}
              >
                Modifier
              </button>
            ) : null}

            {canDelete ? (
              <button
                type="button"
                className="secondary-button danger clients-detail-action-button clients-detail-action-danger"
                onClick={onDelete}
              >
                Supprimer
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {mode === "create" || mode === "edit" ? (
        <ClientForm
          mode={mode}
          initialData={mode === "edit" ? selectedClient : null}
          onSubmit={onSave}
          onCancel={onCancelForm}
          serverErrors={formErrors}
          submitting={submitting}
        />
      ) : detailLoading ? (
        <div className="status-box">Chargement de la fiche client...</div>
      ) : selectedClient ? (
        <div className="table-like">
          <div className="clients-detail-tabs">
            <button
              type="button"
              className={`clients-detail-tab ${activeTab === "profile" ? "active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              Profil
            </button>
            <button
              type="button"
              className={`clients-detail-tab ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              Historique
            </button>
            <button
              type="button"
              className={`clients-detail-tab ${activeTab === "stays" ? "active" : ""}`}
              onClick={() => setActiveTab("stays")}
            >
              Sejours
            </button>
            <button
              type="button"
              className={`clients-detail-tab ${activeTab === "consumptions" ? "active" : ""}`}
              onClick={() => setActiveTab("consumptions")}
            >
              Consommations
            </button>
            <button
              type="button"
              className={`clients-detail-tab ${activeTab === "invoices" ? "active" : ""}`}
              onClick={() => setActiveTab("invoices")}
            >
              Factures
            </button>
            <button
              type="button"
              className={`clients-detail-tab ${activeTab === "payments" ? "active" : ""}`}
              onClick={() => setActiveTab("payments")}
            >
              Paiements
            </button>
            <button
              type="button"
              className={`clients-detail-tab ${activeTab === "satisfaction" ? "active" : ""}`}
              onClick={() => setActiveTab("satisfaction")}
            >
              Satisfaction
            </button>
          </div>

          {activeTab === "profile" ? (
            <>
          <div className="clients-detail-hero">
            <div className="client-avatar large" aria-hidden="true">
              {selectedClient.initials}
            </div>

            <div className="clients-detail-copy">
              <strong>{normalizeValue(selectedClient.full_name)}</strong>
              <p>
                Fiche client enrichie pour le suivi hotelier, la qualite de donnees
                et la preparation des modules de sejour, consommation et facturation.
              </p>

              <div className="clients-client-code-row">
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
                    {clientCodeCopied ? "Copie" : "Copier"}
                  </button>
                </div>
              </div>

              <div className="client-badge-row">
                <span className={`client-status-badge client-status-badge--${clientStatus.tone}`}>
                  {clientStatus.label}
                </span>
                <span className="client-badge">{normalizeValue(selectedClient.client_type_label)}</span>
                <span className="client-badge subtle">
                  {normalizeValue(selectedClient.identity_document_type_label)}
                </span>
              </div>
            </div>
          </div>

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

          <div className="clients-detail-sections-grid">
            {sections.map((section) => (
              <DetailSection key={section.title} title={section.title} rows={section.rows} />
            ))}
          </div>

          {selectedClientSummary.length ? (
            <div className="clients-summary-grid">
              {selectedClientSummary.map((item) => (
                <article key={item.label} className="info-card dashboard-kpi-card">
                  <span className="dashboard-card-label">{item.label}</span>
                  <div className="metric dashboard-kpi-value">
                    {normalizeValue(item.value)}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
            </>
          ) : null}

          {activeTab === "history" ? <ClientHistoryTab selectedClient={selectedClient} /> : null}
          {activeTab === "stays" ? <ClientStaysTab selectedClient={selectedClient} /> : null}
          {activeTab === "consumptions" ? (
            <ClientConsumptionsTab selectedClient={selectedClient} />
          ) : null}
          {activeTab === "invoices" ? <ClientInvoicesTab selectedClient={selectedClient} /> : null}
          {activeTab === "payments" ? <ClientPaymentsTab selectedClient={selectedClient} /> : null}
          {activeTab === "satisfaction" ? <ClientSatisfactionTab selectedClient={selectedClient} /> : null}
        </div>
      ) : (
        <EmptyStateCard
          title="Aucun client selectionne"
          description="Selectionne un client dans la liste ou cree une nouvelle fiche."
          action={
            canCreate ? (
              <button type="button" className="primary-button" onClick={onCreate}>
                Nouveau client
              </button>
            ) : null
          }
        />
      )}
    </section>
  );
}
