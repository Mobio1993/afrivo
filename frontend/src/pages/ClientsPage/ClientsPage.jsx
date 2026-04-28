import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../auth/permissions";
import { ConfirmModal } from "../../components/ConfirmModal";
import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient,
} from "../../services/clientsService";
import { ClientDetailPanel } from "./components/ClientDetailPanel";
import { ClientHistorySection } from "./components/ClientHistorySection";
import { ClientsListPanel } from "./components/ClientsListPanel";
import { ClientsSummaryCards } from "./components/ClientsSummaryCards";
import { buildInitials, formatDate, normalizeValue } from "./utils";
import "./ClientsPage.css";

const CLIENTS_PAGE_SIZE = 5;

function renderClientHistorySections(selectedClient) {
  if (!selectedClient) {
    return null;
  }

  return (
    <>
      <ClientHistorySection
        title="Historique des reservations"
        items={selectedClient.booking_history || []}
        emptyLabel="Aucune reservation disponible"
        renderMeta={(item) => (
          <>
            <div className="table-row">
              <strong>Type</strong>
              <span>{normalizeValue(item.room_type)}</span>
            </div>
            <div className="table-row">
              <strong>Sejour prevu</strong>
              <span>
                {formatDate(item.check_in_date)} au {formatDate(item.check_out_date)}
              </span>
            </div>
            <div className="table-row">
              <strong>Montant estime</strong>
              <span>{normalizeValue(item.estimated_amount)}</span>
            </div>
          </>
        )}
      />

      <ClientHistorySection
        title="Historique day use"
        items={selectedClient.day_use_history || []}
        emptyLabel="Aucun day use disponible"
        renderMeta={(item) => (
          <>
            <div className="table-row">
              <strong>Chambre</strong>
              <span>{normalizeValue(item.room)}</span>
            </div>
            <div className="table-row">
              <strong>Entree prevue</strong>
              <span>{formatDate(item.planned_entry_at)}</span>
            </div>
            <div className="table-row">
              <strong>Montant</strong>
              <span>{normalizeValue(item.total_amount)}</span>
            </div>
          </>
        )}
      />
    </>
  );
}

export function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [mode, setMode] = useState("detail");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [status, setStatus] = useState({ error: "", success: "", warning: "" });
  const [formErrors, setFormErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    count: 0,
    page: 1,
    pageSize: CLIENTS_PAGE_SIZE,
    totalPages: 1,
    next: null,
    previous: null,
  });
  const canCreateClients = hasPermission(user, "clients", "create");
  const canUpdateClients = hasPermission(user, "clients", "update");
  const canDeleteClients = hasPermission(user, "clients", "delete");

  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !deleteSubmitting && !showConfirmModal) {
        setIsDrawerOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteSubmitting, isDrawerOpen, showConfirmModal]);

  function openDrawer() {
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    if (deleteSubmitting || showConfirmModal) return;
    setIsDrawerOpen(false);
  }

  async function loadClients({
    page = 1,
    searchTerm = search,
    preferredClientId = selectedClientId,
    preserveSelection = false,
  } = {}) {
    const payload = await listClients({
      page,
      pageSize: CLIENTS_PAGE_SIZE,
      search: searchTerm,
    });

    const items = payload.results || [];
    setClients(items);
    setCurrentPage(payload.page || 1);
    setPagination({
      count: payload.count || 0,
      page: payload.page || 1,
      pageSize: payload.page_size || CLIENTS_PAGE_SIZE,
      totalPages: payload.total_pages || 1,
      next: payload.next || null,
      previous: payload.previous || null,
    });

    if (!items.length) {
      setSelectedClientId(null);
      setSelectedClient(null);
      return;
    }

    const hasPreferredClient = preferredClientId
      ? items.some((item) => item.id === preferredClientId)
      : false;

    if (hasPreferredClient) {
      setSelectedClientId(preferredClientId);
      return;
    }

    if (preserveSelection && preferredClientId) {
      return;
    }

    setSelectedClientId(items[0].id);
  }

  async function loadClientDetail(clientId) {
    if (!clientId) {
      setSelectedClient(null);
      return;
    }

    setDetailLoading(true);
    try {
      const payload = await getClient(clientId);
      setSelectedClient(payload);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadClients()
      .catch((error) => {
        setStatus({
          error: error.message || "Impossible de charger les clients.",
          success: "",
          warning: "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients({
        page: 1,
        searchTerm: search,
      }).catch((error) => {
        setStatus({
          error: error.message || "Impossible de rechercher les clients.",
          success: "",
          warning: "",
        });
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadClientDetail(selectedClientId).catch((error) => {
      setStatus({
        error: error.message || "Impossible de charger le detail client.",
        success: "",
        warning: "",
      });
    });
  }, [selectedClientId]);

  const summaryCards = useMemo(() => {
    const withPhone = clients.filter((item) => item.phone && item.phone !== "-").length;
    const withIdentity = clients.filter(
      (item) => item.identity_document_number && item.identity_document_number !== "-",
    ).length;
    const withEmail = clients.filter((item) => item.email && item.email !== "-").length;

    return [
      {
        label: "Clients trouves",
        value: pagination.count,
        meta: search
          ? `Resultats backend pour : ${search}`
          : "Nombre total de clients sur la recherche courante",
        tone: "default",
      },
      {
        label: "Contacts qualifies",
        value: withPhone,
        meta: `${withEmail} client(s) avec email exploitable sur cette page`,
        tone: "default",
      },
      {
        label: "Pieces renseignees",
        value: withIdentity,
        meta: "Controle anti-doublon visible sur la page chargee",
        tone: "default",
      },
      {
        label: "Client selectionne",
        value: selectedClient ? selectedClient.full_name : "Aucun client",
        meta: selectedClient
          ? `${selectedClient.stay_count} sejour(s) en historique`
          : "Selectionnez un client dans la liste",
        tone: "selected",
      },
    ];
  }, [clients, pagination.count, search, selectedClient]);

  const selectedClientHighlights = useMemo(() => {
    if (!selectedClient) {
      return [];
    }

    return [
      {
        label: "Type de client",
        value: selectedClient.client_type_label,
        meta: "Positionnement commercial et operational",
      },
      {
        label: "Telephone principal",
        value: selectedClient.phone,
        meta: "Numero principal de contact",
      },
      {
        label: "Email",
        value: selectedClient.email,
        meta: "Canal de confirmation ou de suivi",
      },
      {
        label: "Nationalite",
        value: selectedClient.nationality,
        meta: "Information utile pour l'accueil et le reporting",
      },
    ];
  }, [selectedClient]);

  const selectedClientSummary = useMemo(() => {
    if (!selectedClient?.summary) {
      return [];
    }
    return selectedClient.summary;
  }, [selectedClient]);

  const selectedClientViewModel = useMemo(() => {
    if (!selectedClient) {
      return null;
    }

    return {
      ...selectedClient,
      initials: buildInitials(selectedClient.full_name),
      formattedDateOfBirth: formatDate(selectedClient.date_of_birth),
      document_issue_date: formatDate(selectedClient.document_issue_date),
      document_expiry_date: formatDate(selectedClient.document_expiry_date),
      formattedUpdatedAt: formatDate(selectedClient.updated_at),
    };
  }, [selectedClient]);

  async function handleSave(formPayload) {
    if ((mode === "create" && !canCreateClients) || (mode === "edit" && !canUpdateClients)) {
      setStatus({ error: "Vous n'avez pas les droits suffisants pour enregistrer cette fiche client.", success: "", warning: "" });
      return;
    }
    setSubmitting(true);
    setFormErrors({});
    setStatus({ error: "", success: "", warning: "" });

    try {
      const payload =
        mode === "edit" && selectedClientId
          ? await updateClient(selectedClientId, formPayload)
          : await createClient(formPayload);

      const client = payload.client;
      const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
      const warningMessage = warnings.length
        ? `Doublons potentiels a verifier : ${warnings
            .map((item) => `${item.full_name} (${item.reasons.join(", ")})`)
            .join(" ; ")}`
        : "";
      setStatus({ error: "", success: payload.message, warning: warningMessage });
      setMode("detail");
      await loadClients({
        page: 1,
        searchTerm: search,
        preferredClientId: client.id,
      });
      await loadClientDetail(client.id);
      openDrawer();
    } catch (error) {
      setFormErrors(error.payload?.errors || {});
      setStatus({
        error: error.payload?.detail || error.message || "Operation impossible.",
        success: "",
        warning: "",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteRequest() {
    if (!selectedClientId || !selectedClient || !canDeleteClients) {
      return;
    }

    setShowConfirmModal(true);
  }

  function closeConfirmModal() {
    if (deleteSubmitting) {
      return;
    }

    setShowConfirmModal(false);
  }

  async function handleDelete() {
    if (!selectedClientId || !selectedClient) {
      return;
    }

    setDeleteSubmitting(true);
    setStatus({ error: "", success: "" });

    try {
      const payload = await deleteClient(selectedClientId);
      setStatus({ error: "", success: payload.message, warning: "" });
      setMode("detail");
      setShowConfirmModal(false);
      setIsDrawerOpen(false);
      await loadClients({
        page: currentPage,
        searchTerm: search,
        preferredClientId: null,
      });
    } catch (error) {
      setStatus({
        error: error.payload?.detail || error.message || "Suppression impossible.",
        success: "",
        warning: "",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function handleSelectFromModal(client) {
    if (!client?.id) {
      return;
    }

    setSelectedClientId(client.id);
    setMode("detail");
    setFormErrors({});
    setStatus({ error: "", success: "", warning: "" });
    openDrawer();
  }

  function handleCreateFromModal() {
    if (!canCreateClients) {
      return;
    }
    setMode("create");
    setFormErrors({});
    setStatus({ error: "", success: "", warning: "" });
    openDrawer();
  }

  function startCreate() {
    if (!canCreateClients) {
      return;
    }
    setMode("create");
    setFormErrors({});
    setStatus({ error: "", success: "", warning: "" });
    openDrawer();
  }

  function startEdit() {
    if (!selectedClient || !canUpdateClients) {
      return;
    }
    setMode("edit");
    setFormErrors({});
    setStatus({ error: "", success: "", warning: "" });
    openDrawer();
  }

  function cancelForm() {
    setMode("detail");
    setFormErrors({});
    setStatus((previousStatus) => ({ ...previousStatus, warning: "" }));
  }

  function handleSelectClient(clientId) {
    setSelectedClientId(clientId);
    setMode("detail");
    setFormErrors({});
    setStatus((previousStatus) => ({ ...previousStatus, error: "", warning: "" }));
    openDrawer();
  }

  function handlePreviousPage() {
    if (!pagination.previous) {
      return;
    }

    loadClients({
      page: Math.max(1, pagination.page - 1),
      searchTerm: search,
      preferredClientId: selectedClientId,
      preserveSelection: true,
    }).catch((error) => {
      setStatus({
        error: error.message || "Impossible de charger la page precedente.",
        success: "",
        warning: "",
      });
    });
  }

  function handleNextPage() {
    if (!pagination.next) {
      return;
    }

    loadClients({
      page: pagination.page + 1,
      searchTerm: search,
      preferredClientId: selectedClientId,
      preserveSelection: true,
    }).catch((error) => {
      setStatus({
        error: error.message || "Impossible de charger la page suivante.",
        success: "",
        warning: "",
      });
    });
  }

  const historyContent = renderClientHistorySections(selectedClient);
  const showDrawer = isDrawerOpen;
  const showDesktopHistory = false;

  return (
    <div className="page-stack dashboard-shell clients-page">
      <section className="dashboard-hero dashboard-hero-modern clients-hero">
        <div className="section-head">
          <div className="dashboard-hero-copy">
            <span className="eyebrow">Module Clients</span>
            <h2>Base clients, recherche rapide et historique hotelier</h2>
            <p>
              Gere les fiches clients depuis une interface React dediee, avec
              recherche instantanee, controle anti-doublon et lecture directe des
              reservations, sejours et day use.
            </p>
          </div>

          <div className="dashboard-hero-side">
            <ClientsSummaryCards cards={summaryCards} />
          </div>
        </div>
      </section>

      {loading ? <div className="status-box">Chargement des clients...</div> : null}
      {status.error ? <div className="alert-box">{status.error}</div> : null}
      {status.success ? <div className="success-box">{status.success}</div> : null}
      {status.warning ? <div className="warning-box">{status.warning}</div> : null}

      <section className="clients-main-grid">
        <ClientsListPanel
          clients={clients}
          loading={loading}
          search={search}
          totalCount={pagination.count}
          selectedClient={selectedClient}
          selectedClientId={selectedClientId}
          pagination={pagination}
          canCreate={canCreateClients}
          onSearchChange={setSearch}
          onClearSearch={() => setSearch("")}
          onCreate={startCreate}
          onSelectFromModal={handleSelectFromModal}
          onCreateFromModal={handleCreateFromModal}
          onSelectClient={handleSelectClient}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
        />
      </section>

      {showDesktopHistory ? (
        <section className="clients-history-layout clients-history-grid">{historyContent}</section>
      ) : null}

      {showDrawer ? (
        <div
          className="clients-drawer-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDrawer();
            }
          }}
        >
          <div
            className="clients-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Fiche client"
          >
            <div className="clients-drawer-head">
              <div className="clients-drawer-copy">
                <span className="eyebrow dark">Fiche client</span>
                <strong>
                  {mode === "create"
                    ? "Nouvelle fiche"
                    : mode === "edit"
                      ? "Edition"
                      : selectedClient?.full_name || "Detail client"}
                </strong>
              </div>

              <button
                type="button"
                className="ghost-button light clients-drawer-close"
                onClick={closeDrawer}
                aria-label="Fermer la fiche client"
              >
                ×
              </button>
            </div>

            <div className="clients-drawer-body">
              <ClientDetailPanel
                mode={mode}
                canCreate={canCreateClients}
                canEdit={canUpdateClients}
                canDelete={canDeleteClients}
                selectedClient={selectedClientViewModel}
                selectedClientHighlights={selectedClientHighlights}
                selectedClientSummary={selectedClientSummary}
                detailLoading={detailLoading}
                submitting={submitting}
                formErrors={formErrors}
                onStartEdit={startEdit}
                onDelete={handleDeleteRequest}
                onSave={handleSave}
                onCancelForm={cancelForm}
                onCreate={startCreate}
                onRefresh={() => loadClientDetail(selectedClientId)}
              />

              {mode === "detail" && selectedClient ? (
                <section className="clients-history-layout clients-history-grid clients-history-grid-mobile">
                  {historyContent}
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Supprimer ce client ?"
        message={
          selectedClient
            ? `La fiche de ${selectedClient.full_name} sera supprimee definitivement. Cette action est irreversible.`
            : "Cette fiche client sera supprimee definitivement. Cette action est irreversible."
        }
        onConfirm={handleDelete}
        onCancel={closeConfirmModal}
        confirmLabel={deleteSubmitting ? "Suppression..." : "Supprimer"}
        cancelLabel="Annuler"
        confirmDisabled={deleteSubmitting}
        variant="danger"
      />
    </div>
  );
}
