import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../auth/permissions";
import { ConfirmModal } from "../../shared/components/ConfirmModal";
import { useTopbarActions } from "../../components/layout/Topbar/TopbarContext";
import {
  archiveClient,
  createClient,
  getClient,
  listClients,
  reactivateClient,
  updateClient,
} from "../../services/clientsService";
import { ClientDetailPanel } from "./components/ClientDetailPanel";
import { ClientsListPanel } from "./components/ClientsListPanel";
import { ClientsSummaryCards } from "./components/ClientsSummaryCards";
import { buildInitials } from "./utils";
import "./ClientsPage.css";

const CLIENTS_PAGE_SIZE = 5;

const CLIENT_LIST_FILTERS = [
  { key: "all", label: "Tous" },
  { key: "vip", label: "VIP" },
  { key: "blacklist", label: "Blacklist" },
  { key: "missing_contact", label: "Contact incomplet" },
  { key: "missing_document", label: "Piece manquante" },
  { key: "archived", label: "Archives" },
];

export function ClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setTopbarActions } = useTopbarActions();

  const searchEffectReadyRef = useRef(false);
  const clientsRequestIdRef = useRef(0);
  const clientDetailRequestIdRef = useRef(0);

  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [activeClientFilter, setActiveClientFilter] = useState("all");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [mode, setMode] = useState("detail");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
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
  const [clientFilterCounts, setClientFilterCounts] = useState({});

  const canCreateClients = hasPermission(user, "clients", "create");
  const canUpdateClients = hasPermission(user, "clients", "update");
  const canDeleteClients = hasPermission(user, "clients", "delete");

  // Drawer is only visually present for form modes
  const isFormDrawerOpen = isDrawerOpen && (mode === "edit" || mode === "create");

  useEffect(() => {
    document.body.style.overflow = isFormDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFormDrawerOpen]);

  useEffect(() => {
    if (!status.success) return undefined;
    const t = setTimeout(() => setStatus((s) => ({ ...s, success: "" })), 4000);
    return () => clearTimeout(t);
  }, [status.success]);

  useEffect(() => {
    if (!isFormDrawerOpen) return undefined;

    function handleKeyDown(event) {
      if (
        event.key === "Escape" &&
        !deleteSubmitting &&
        !submitting &&
        !showConfirmModal &&
        !showUnsavedModal
      ) {
        if (mode === "edit" || mode === "create") {
          setShowUnsavedModal(true);
          return;
        }
        setIsDrawerOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteSubmitting, isFormDrawerOpen, mode, showConfirmModal, showUnsavedModal, submitting]);

  function openDrawer() {
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    if (deleteSubmitting || submitting || showConfirmModal || showUnsavedModal) return;

    if (mode === "edit" || mode === "create") {
      setShowUnsavedModal(true);
      return;
    }

    setIsDrawerOpen(false);
  }

  function handleUnsavedConfirm() {
    setShowUnsavedModal(false);
    setMode("detail");
    setFormErrors({});
    setIsDrawerOpen(false);
  }

  function closeUnsavedModal() {
    setShowUnsavedModal(false);
  }

  async function loadClients({
    page = 1,
    searchTerm = search,
    filter = activeClientFilter,
    preferredClientId = selectedClientId,
    preserveSelection = false,
  } = {}) {
    const requestId = clientsRequestIdRef.current + 1;
    clientsRequestIdRef.current = requestId;

    const payload = await listClients({
      page,
      pageSize: CLIENTS_PAGE_SIZE,
      search: searchTerm,
      filter,
      includeInactive: filter === "archived",
    });

    if (requestId !== clientsRequestIdRef.current) {
      return null;
    }

    const items = payload.results || [];
    const pageSize = payload.page_size || CLIENTS_PAGE_SIZE;
    const count = payload.count || 0;
    const totalPages = Math.max(
      1,
      payload.total_pages || Math.ceil(count / pageSize) || 1,
    );
    const rawPage = payload.page || page || 1;
    const normalizedPage = Math.min(Math.max(1, rawPage), totalPages);

    if (!items.length && count > 0 && rawPage > totalPages) {
      return loadClients({
        page: totalPages,
        searchTerm,
        filter,
        preferredClientId,
        preserveSelection,
      });
    }

    setClients(items);
    setCurrentPage(normalizedPage);
    setPagination({
      count,
      page: normalizedPage,
      pageSize,
      totalPages,
      next: payload.next || null,
      previous: payload.previous || null,
    });
    setClientFilterCounts(payload.filter_counts || {});

    if (!items.length) {
      setSelectedClientId(null);
      setSelectedClient(null);
      return payload;
    }

    const hasPreferredClient = preferredClientId
      ? items.some((item) => item.id === preferredClientId)
      : false;

    if (hasPreferredClient) {
      setSelectedClientId(preferredClientId);
      return payload;
    }

    if (preserveSelection && preferredClientId) {
      return payload;
    }

    setSelectedClientId(items[0].id);
    return payload;
  }

  async function loadClientDetail(clientId) {
    const requestId = clientDetailRequestIdRef.current + 1;
    clientDetailRequestIdRef.current = requestId;

    if (!clientId) {
      setSelectedClient(null);
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    try {
      const payload = await getClient(clientId);
      if (requestId !== clientDetailRequestIdRef.current) {
        return;
      }
      setSelectedClient(payload);
    } finally {
      if (requestId === clientDetailRequestIdRef.current) {
        setDetailLoading(false);
      }
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
    if (!searchEffectReadyRef.current) {
      searchEffectReadyRef.current = true;
      return undefined;
    }

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
        error: error.message || "Impossible de charger le détail client.",
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
        label: "Clients trouvés",
        value: pagination.count,
        meta: search
          ? `Résultats backend pour : ${search}`
          : "Nombre total de clients sur la recherche courante",
        tone: "default",
      },
      {
        label: "Contacts qualifiés",
        value: withPhone,
        meta: `${withEmail} avec email — sur les ${clients.length} clients de cette page`,
        tone: "default",
      },
      {
        label: "Pièces renseignées",
        value: withIdentity,
        meta: `Sur ${clients.length} clients affichés — contrôle anti-doublon de la page`,
        tone: "default",
      },
      {
        label: "Client sélectionné",
        value: selectedClient ? selectedClient.full_name : "Aucun client",
        meta: selectedClient
          ? `${selectedClient.stay_count} séjour(s) en historique`
          : "Sélectionnez un client dans la liste",
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
        meta: "Positionnement commercial et opérationnel",
      },
      {
        label: "Téléphone principal",
        value: selectedClient.phone,
        meta: "Numéro principal de contact",
      },
      {
        label: "Email",
        value: selectedClient.email,
        meta: "Canal de confirmation ou de suivi",
      },
      {
        label: "Nationalité",
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

  useEffect(() => {
    setTopbarActions(
      <>
        <ClientsSummaryCards cards={summaryCards} />
      </>,
    );

    return () => setTopbarActions(null);
  }, [setTopbarActions, summaryCards]);

  const visibleClients = clients;

  const selectedClientViewModel = useMemo(() => {
    if (!selectedClient) {
      return null;
    }

    const initials = buildInitials(selectedClient.full_name);

    const formatDate = (value) => {
      if (!value || value === "-") return "-";
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return value;
      return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d);
    };

    return {
      ...selectedClient,
      initials,
      formattedDateOfBirth: formatDate(selectedClient.date_of_birth),
      document_issue_date: formatDate(selectedClient.document_issue_date),
      document_expiry_date: formatDate(selectedClient.document_expiry_date),
      formattedUpdatedAt: formatDate(selectedClient.updated_at),
    };
  }, [selectedClient]);

  useEffect(() => {
    if (!visibleClients.length || !selectedClientId) {
      return;
    }

    if (!visibleClients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(visibleClients[0].id);
    }
  }, [selectedClientId, visibleClients]);

  function handleQuickAction(action) {
    if (!selectedClient?.id) {
      return;
    }

    const params = new URLSearchParams();
    params.set("action", action);
    params.set("client_id", String(selectedClient.id));
    if (selectedClient.full_name) {
      params.set("client_name", selectedClient.full_name);
    }

    navigate(`/operations?${params.toString()}`);
  }

  async function handleSave(formPayload) {
    if ((mode === "create" && !canCreateClients) || (mode === "edit" && !canUpdateClients)) {
      setStatus({
        error: "Vous n'avez pas les droits suffisants pour enregistrer cette fiche client.",
        success: "",
        warning: "",
      });
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
        ? `Doublons potentiels à vérifier : ${warnings
            .map((item) => `${item.full_name} (${item.reasons.join(", ")})`)
            .join(" ; ")}`
        : "";

      setStatus({ error: "", success: payload.message, warning: warningMessage });
      setMode("detail");

      await loadClients({
        page: 1,
        searchTerm: search,
        preferredClientId: client.id,
        preserveSelection: true,
      });

      await loadClientDetail(client.id);
      openDrawer();
    } catch (error) {
      setFormErrors(error.payload?.errors || {});
      setStatus({
        error: error.payload?.detail || error.message || "Opération impossible.",
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
    setStatus({ error: "", success: "", warning: "" });

    try {
      const payload = await archiveClient(selectedClientId);
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
        error: error.payload?.detail || error.message || "Archivage impossible.",
        success: "",
        warning: "",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleReactivate() {
    if (!selectedClientId || !selectedClient || !canUpdateClients) {
      return;
    }

    setSubmitting(true);
    setStatus({ error: "", success: "", warning: "" });

    try {
      const payload = await reactivateClient(selectedClientId);
      const clientId = payload.client?.id || selectedClientId;
      setStatus({ error: "", success: payload.message, warning: "" });
      setMode("detail");
      await loadClients({
        page: 1,
        searchTerm: search,
        filter: activeClientFilter,
        preferredClientId: clientId,
        preserveSelection: true,
      });
      await loadClientDetail(clientId);
    } catch (error) {
      setStatus({
        error: error.payload?.detail || error.message || "Réactivation impossible.",
        success: "",
        warning: "",
      });
    } finally {
      setSubmitting(false);
    }
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

  function handleFilterChange(filterKey) {
    setActiveClientFilter(filterKey);
    loadClients({
      page: 1,
      searchTerm: search,
      filter: filterKey,
      preferredClientId: null,
      preserveSelection: false,
    }).catch((error) => {
      setStatus({
        error: error.message || "Impossible de filtrer les clients.",
        success: "",
        warning: "",
      });
    });
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
        error: error.message || "Impossible de charger la page précédente.",
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

  function handleGoToPage(page) {
    loadClients({
      page,
      searchTerm: search,
      preferredClientId: selectedClientId,
      preserveSelection: true,
    }).catch((error) => {
      setStatus({
        error: error.message || "Impossible de charger cette page.",
        success: "",
        warning: "",
      });
    });
  }

  return (
    <div className="page-stack dashboard-shell clients-page">

      {/* ── Topbar ── */}
      {/* ── Status messages (hors drawer) ── */}
      {loading ? (
        <div className="status-box">Chargement des clients...</div>
      ) : null}

      {!isFormDrawerOpen && status.error ? (
        <div className="alert-box" role="alert">{status.error}</div>
      ) : null}
      {!isFormDrawerOpen && status.success ? (
        <div className="success-box" role="status">{status.success}</div>
      ) : null}
      {!isFormDrawerOpen && status.warning ? (
        <div className="warning-box" role="status">{status.warning}</div>
      ) : null}

      {/* ── Split layout ── */}
      <div className="clients-split">
        {/* Colonne gauche : liste */}
        <div className="clients-split-list">
          <ClientsListPanel
            clients={visibleClients}
            search={search}
            totalCount={pagination.count}
            pageCount={clients.length}
            activeFilter={activeClientFilter}
            filters={CLIENT_LIST_FILTERS}
            filterCounts={clientFilterCounts}
            selectedClientId={selectedClientId}
            pagination={pagination}
            canCreate={canCreateClients}
            onSearchChange={setSearch}
            onClearSearch={() => setSearch("")}
            onFilterChange={handleFilterChange}
            onCreate={startCreate}
            onSelectClient={handleSelectClient}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
            onGoToPage={handleGoToPage}
          />
        </div>

        {/* Colonne droite : détail inline (mode detail uniquement) */}
        <div className="clients-split-detail">
          <ClientDetailPanel
            mode="detail"
            canCreate={canCreateClients}
            canEdit={canUpdateClients}
            canDelete={canDeleteClients}
            selectedClient={selectedClientViewModel}
            selectedClientHighlights={selectedClientHighlights}
            selectedClientSummary={selectedClientSummary}
            detailLoading={detailLoading}
            submitting={false}
            formErrors={{}}
            onStartEdit={startEdit}
            onDelete={handleDeleteRequest}
            onReactivate={handleReactivate}
            onSave={handleSave}
            onCancelForm={cancelForm}
            onCreate={startCreate}
            onQuickAction={handleQuickAction}
            onRefresh={() => loadClientDetail(selectedClientId)}
          />
        </div>
      </div>

      {/* ── Drawer — edit / create uniquement ── */}
      {isFormDrawerOpen ? (
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
            aria-label="Formulaire client"
          >
            <div className="clients-drawer-head">
              <div className="clients-drawer-copy">
                <span className="eyebrow dark">
                  {mode === "create" ? "Nouveau client" : "Modifier le client"}
                </span>
                <strong>
                  {mode === "create"
                    ? "Nouvelle fiche"
                    : selectedClient?.full_name || "Édition"}
                </strong>
              </div>

              <button
                type="button"
                className="ghost-button light clients-drawer-close"
                onClick={closeDrawer}
                aria-label="Fermer le formulaire"
              >
                ×
              </button>
            </div>

            <div className="clients-drawer-body">
              {status.error ? (
                <div className="alert-box clients-drawer-status" role="alert">
                  {status.error}
                </div>
              ) : null}
              {status.success ? (
                <div className="success-box clients-drawer-status" role="status">
                  {status.success}
                </div>
              ) : null}
              {status.warning ? (
                <div className="warning-box clients-drawer-status" role="status">
                  {status.warning}
                </div>
              ) : null}

              <ClientDetailPanel
                mode={mode}
                canCreate={canCreateClients}
                canEdit={canUpdateClients}
                canDelete={canDeleteClients}
                selectedClient={selectedClientViewModel}
                selectedClientHighlights={selectedClientHighlights}
                selectedClientSummary={selectedClientSummary}
                detailLoading={false}
                submitting={submitting}
                formErrors={formErrors}
                onStartEdit={startEdit}
                onDelete={handleDeleteRequest}
                onReactivate={handleReactivate}
                onSave={handleSave}
                onCancelForm={cancelForm}
                onCreate={startCreate}
                onQuickAction={handleQuickAction}
                onRefresh={() => loadClientDetail(selectedClientId)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modals ── */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title="Archiver ce client ?"
        message={
          selectedClient
            ? `La fiche de ${selectedClient.full_name} sera archivée et retirée de la liste active.`
            : "Cette fiche client sera archivée et retirée de la liste active."
        }
        onConfirm={handleDelete}
        onCancel={closeConfirmModal}
        confirmLabel={deleteSubmitting ? "Archivage..." : "Archiver"}
        cancelLabel="Annuler"
        confirmDisabled={deleteSubmitting}
        variant="danger"
      />

      <ConfirmModal
        isOpen={showUnsavedModal}
        title="Modifications non enregistrées"
        message="Des modifications non enregistrées seront perdues si vous fermez ce formulaire. Continuer ?"
        onConfirm={handleUnsavedConfirm}
        onCancel={closeUnsavedModal}
        confirmLabel="Fermer sans enregistrer"
        cancelLabel="Continuer l'édition"
        variant="danger"
      />
    </div>
  );
}
