import { useEffect, useMemo, useRef, useState } from "react";

import { AppSelect } from "../../components/AppSelect";
import { ConfirmModal } from "../../components/ConfirmModal";
import {
  createPlatformHotel,
  createPlatformHotelAdmin,
  listPlatformHotels,
  listPlatformOrganizations,
  reactivatePlatformHotel,
  suspendPlatformHotel,
  updatePlatformHotel,
} from "../../services/platformAdminService";
import { SkeletonSectionGrid } from "./PlatformAdminSkeletons";
import {
  PlatformNavTabs,
  PlatformBadge,
  PlatformKpiCard,
  PlatformEntityCell,
  PlatformEmptyState,
  IconHotel,
  IconOrg,
  IconUser,
  IconEmptyHotel,
} from "./PlatformAdminComponents";
import { slugify } from "../../utils/slugify";
import "./PlatformAdmin.css";

/* h4 — listes fixes timezone et devise */
const TIMEZONE_OPTIONS = [
  { value: "Africa/Abidjan",      label: "Abidjan (GMT+0)" },
  { value: "Africa/Lagos",        label: "Lagos (GMT+1)" },
  { value: "Africa/Douala",       label: "Douala (GMT+1)" },
  { value: "Africa/Dakar",        label: "Dakar (GMT+0)" },
  { value: "Africa/Accra",        label: "Accra (GMT+0)" },
  { value: "Africa/Nairobi",      label: "Nairobi (GMT+3)" },
  { value: "Africa/Casablanca",   label: "Casablanca (GMT+1)" },
  { value: "Africa/Cairo",        label: "Le Caire (GMT+2)" },
  { value: "Europe/Paris",        label: "Paris (GMT+1/+2)" },
  { value: "Atlantic/Reykjavik",  label: "Reykjavik (UTC)" },
];

const CURRENCY_OPTIONS = [
  { value: "XOF", label: "XOF — Franc CFA UEMOA" },
  { value: "XAF", label: "XAF — Franc CFA CEMAC" },
  { value: "GHS", label: "GHS — Cedi ghanéen" },
  { value: "NGN", label: "NGN — Naira nigérian" },
  { value: "KES", label: "KES — Shilling kenyan" },
  { value: "MAD", label: "MAD — Dirham marocain" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — Dollar américain" },
];

/* h7 — auto-dismiss */
const AUTO_DISMISS_MS = 4000;

/* h5 — spinner */
function Spinner() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
    </svg>
  );
}

const STATUS_OPTIONS = [
  { value: "all",       label: "Tous les hôtels" },
  { value: "active",    label: "Hôtels actifs" },
  { value: "inactive",  label: "Hôtels inactifs" },
  { value: "trial",     label: "En essai" },
  { value: "suspended", label: "Suspendus" },
];

const EMPTY_CREATE_FORM = {
  organization_id: "",
  name: "",
  code: "",
  slug: "",
  country: "",
  city: "",
  timezone: "Atlantic/Reykjavik",
  currency: "XOF",
  is_active: true,
};

const EMPTY_ADMIN_FORM = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

function normalizeStatus(status, isActive) {
  if (!isActive) return "inactive";
  return status || "neutral";
}

function QuotaBadge({ status, count, limit }) {
  const normalized = status || "neutral";
  const label =
    normalized === "critical"  ? "Hors quota" :
    normalized === "warning"   ? "Quota à surveiller" :
    normalized === "unlimited" ? "Sans limite" :
                                 "Quota sain";
  return (
    <PlatformBadge
      status={normalized}
      label={`${label}${typeof count === "number" ? ` · ${count}${limit ? `/${limit}` : ""}` : ""}`}
    />
  );
}

export function PlatformHotelsPage() {
  const [hotels, setHotels] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_CREATE_FORM);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN_FORM);
  const [loading, setLoading] = useState(true);
  /* h6 — états de soumission distincts par action */
  const [submittingCreate,  setSubmittingCreate]  = useState(false);
  const [submittingUpdate,  setSubmittingUpdate]  = useState(false);
  const [submittingAdmin,   setSubmittingAdmin]   = useState(false);
  const [submittingAction,  setSubmittingAction]  = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  /* h7 — auto-dismiss refs */
  const errorTimerRef   = useRef(null);
  const successTimerRef = useRef(null);

  /* h3 — slug auto-génération */
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  async function loadScreen(preferredId = selectedId) {
    const [hotelsPayload, organizationsPayload] = await Promise.all([
      listPlatformHotels(),
      listPlatformOrganizations(),
    ]);
    const nextHotels = hotelsPayload.results || [];
    const nextOrganizations = organizationsPayload.results || [];
    setHotels(nextHotels);
    setOrganizations(nextOrganizations);
    /* h1 — ne pas pré-sélectionner organizations[0] silencieusement */
    setCreateForm((current) => ({
      ...current,
      organization_id: current.organization_id,
    }));

    const nextSelectedId =
      preferredId && nextHotels.some((item) => item.id === preferredId) ? preferredId : nextHotels[0]?.id || null;
    setSelectedId(nextSelectedId);
    const currentHotel = nextHotels.find((item) => item.id === nextSelectedId) || nextHotels[0] || null;
    if (currentHotel) {
      setEditForm({
        organization_id: String(currentHotel.organization),
        name: currentHotel.name || "",
        code: currentHotel.code || "",
        slug: currentHotel.slug || "",
        country: currentHotel.country || "",
        city: currentHotel.city || "",
        timezone: currentHotel.timezone || "Atlantic/Reykjavik",
        currency: currentHotel.currency || "XOF",
        is_active: Boolean(currentHotel.is_active),
      });
    }
  }

  useEffect(() => {
    loadScreen()
      .catch((requestError) => {
        setError(requestError.message || "Impossible de charger les hotels.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredHotels = useMemo(() => {
    const term = search.trim().toLowerCase();
    return hotels.filter((item) => {
      const matchesSearch =
        !term
        || [item.name, item.code, item.organization_name, item.city, item.country]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      if (statusFilter === "all") {
        return matchesSearch;
      }
      if (statusFilter === "active" || statusFilter === "inactive") {
        return matchesSearch && (statusFilter === "active" ? item.is_active : !item.is_active);
      }
      return matchesSearch && item.subscription_status === statusFilter;
    });
  }, [hotels, search, statusFilter]);

  const selectedHotel =
    filteredHotels.find((item) => item.id === selectedId)
    || hotels.find((item) => item.id === selectedId)
    || filteredHotels[0]
    || null;

  useEffect(() => {
    if (!selectedHotel) {
      return;
    }
    setEditForm({
      organization_id: String(selectedHotel.organization),
      name: selectedHotel.name || "",
      code: selectedHotel.code || "",
      slug: selectedHotel.slug || "",
      country: selectedHotel.country || "",
      city: selectedHotel.city || "",
      timezone: selectedHotel.timezone || "Atlantic/Reykjavik",
      currency: selectedHotel.currency || "XOF",
      is_active: Boolean(selectedHotel.is_active),
    });
    setAdminForm(EMPTY_ADMIN_FORM);
  }, [selectedHotel?.id]);

  /* h7 — cleanup timers au démontage */
  useEffect(() => () => {
    clearTimeout(errorTimerRef.current);
    clearTimeout(successTimerRef.current);
  }, []);

  function showError(msg) {
    clearTimeout(errorTimerRef.current);
    setError(msg);
    errorTimerRef.current = window.setTimeout(() => setError(""), AUTO_DISMISS_MS);
  }

  function showSuccess(msg) {
    clearTimeout(successTimerRef.current);
    setSuccess(msg);
    successTimerRef.current = window.setTimeout(() => setSuccess(""), AUTO_DISMISS_MS);
  }

  /* h3 — auto-génération slug depuis le nom */
  useEffect(() => {
    if (isSlugManuallyEdited) return;
    const id = window.setTimeout(() => {
      setCreateForm((current) => {
        const next = slugify(current.name);
        if (current.slug === next) return current;
        return { ...current, slug: next };
      });
    }, 200);
    return () => window.clearTimeout(id);
  }, [createForm.name, isSlugManuallyEdited]);

  /* h6 — anySubmitting dérivé */
  const anySubmitting = submittingCreate || submittingUpdate || submittingAdmin || submittingAction;

  /* h5 — canSubmitHotel */
  const canSubmitHotel = Boolean(
    createForm.organization_id &&
    createForm.name.trim() &&
    createForm.code.trim() &&
    createForm.slug.trim() &&
    !submittingCreate
  );

  function handleCreateChange(event) {
    const { name, value } = event.target;
    setCreateForm((current) => ({
      ...current,
      [name]: name === "is_active" ? value === "true" : value,
    }));
    /* h3 — marquer le slug comme édité manuellement */
    if (name === "slug") setIsSlugManuallyEdited(true);
  }

  function handleEditChange(event) {
    const { name, value } = event.target;
    setEditForm((current) => ({
      ...current,
      [name]: name === "is_active" ? value === "true" : value,
    }));
  }

  function handleAdminChange(event) {
    const { name, value } = event.target;
    setAdminForm((current) => ({ ...current, [name]: value }));
  }

  async function handleCreateHotel(event) {
    event.preventDefault();
    if (!canSubmitHotel) return;

    setSubmittingCreate(true);
    setError("");
    setSuccess("");

    try {
      const payload = await createPlatformHotel({
        ...createForm,
        organization_id: Number(createForm.organization_id),
      });
      const createdHotel = payload.hotel;
      setCreateForm((current) => ({
        ...EMPTY_CREATE_FORM,
        organization_id: current.organization_id,
      }));
      setIsSlugManuallyEdited(false);
      await loadScreen(createdHotel?.id || null);
      /* h0 — accents corrects */
      showSuccess("Hôtel créé avec succès.");
    } catch (requestError) {
      showError(requestError.message || "Impossible de créer l'hôtel.");
    } finally {
      setSubmittingCreate(false);
    }
  }

  async function handleUpdateHotel(event) {
    event.preventDefault();
    if (!selectedHotel || submittingUpdate) return;

    setSubmittingUpdate(true);
    setError("");
    setSuccess("");

    try {
      await updatePlatformHotel(selectedHotel.id, {
        ...editForm,
        organization_id: Number(editForm.organization_id),
      });
      await loadScreen(selectedHotel.id);
      showSuccess("Hôtel mis à jour.");
    } catch (requestError) {
      showError(requestError.message || "Impossible de mettre à jour l'hôtel.");
    } finally {
      setSubmittingUpdate(false);
    }
  }

  async function handleCreateAdmin(event) {
    event.preventDefault();
    if (!selectedHotel || submittingAdmin) return;

    setSubmittingAdmin(true);
    setError("");
    setSuccess("");

    try {
      await createPlatformHotelAdmin(selectedHotel.id, adminForm);
      setAdminForm(EMPTY_ADMIN_FORM);
      await loadScreen(selectedHotel.id);
      showSuccess("Admin hôtel créé et rattaché pendant l'onboarding.");
    } catch (requestError) {
      showError(requestError.message || "Impossible de créer l'admin hôtel.");
    } finally {
      setSubmittingAdmin(false);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction || submittingAction || !selectedHotel) return;

    setSubmittingAction(true);
    setError("");
    setSuccess("");

    try {
      if (confirmAction === "suspend") {
        await suspendPlatformHotel(selectedHotel.id);
        showSuccess("Hôtel suspendu.");
      } else {
        await reactivatePlatformHotel(selectedHotel.id);
        showSuccess("Hôtel réactivé.");
      }
      await loadScreen(selectedHotel.id);
      setConfirmAction(null);
    } catch (requestError) {
      showError(requestError.message || "Impossible d'exécuter cette action.");
    } finally {
      setSubmittingAction(false);
    }
  }

  return (
    <div className="page-stack platform-admin-page">
      <section className="hero-panel">
        <span className="eyebrow">Plateforme</span>
        <h2>Hôtels abonnés</h2>
        <p>Supervision du parc hôtelier, du statut d'exploitation, des quotas et de l'onboarding admin.</p>
      </section>

      <PlatformNavTabs />

      <section className="platform-admin-summary-grid">
        <PlatformKpiCard
          icon={<IconHotel />}
          iconVariant="teal"
          label="Hôtels total"
          value={hotels.length}
          meta="Inventaire global des établissements hébergés."
          trendVariant="neutral"
        />
        <PlatformKpiCard
          icon={<IconHotel />}
          iconVariant="blue"
          label="Hôtels actifs"
          value={hotels.filter((item) => item.is_active).length}
          meta="Établissements actuellement exploitables."
          trendVariant="neutral"
        />
        <PlatformKpiCard
          icon={<IconUser />}
          iconVariant="slate"
          label="Admins hôtel"
          value={hotels.reduce((sum, item) => sum + (item.hotel_admin_count || 0), 0)}
          meta="Population admin active sur le parc."
          trendVariant="neutral"
        />
      </section>

      <section className="list-panel">
        <div className="panel-head">
          <div>
            <h3>Créer un hôtel</h3>
            <p>Onboarding initial d'un établissement avec son rattachement organisationnel.</p>
          </div>
        </div>
        {/* h2 labels visibles · h1 pas de pré-sélection · h3 slug auto · h4 selects · h5 canSubmit */}
        <form
          className="platform-admin-grid-form"
          onSubmit={handleCreateHotel}
          aria-busy={submittingCreate}
          style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}
        >
          {/* Rattachement organisationnel */}
          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
            <span className="platform-admin-form-label" id="label-create-org">Organisation parente</span>
            <AppSelect
              name="organization_id"
              value={createForm.organization_id}
              onChange={handleCreateChange}
              disabled={submittingCreate}
              aria-labelledby="label-create-org"
              invalid={!createForm.organization_id}
            >
              <option value="">Choisir une organisation</option>
              {organizations.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </AppSelect>
          </div>

          {/* Identité */}
          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="platform-admin-form-label" id="label-create-name">Nom de l'hôtel</span>
            <input
              className="filter-input"
              name="name"
              placeholder="ex. Grand Hôtel Abidjan"
              aria-labelledby="label-create-name"
              value={createForm.name}
              onChange={handleCreateChange}
              disabled={submittingCreate}
              required
            />
          </div>

          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="platform-admin-form-label" id="label-create-code">Code hôtel</span>
            <input
              className="filter-input"
              name="code"
              placeholder="ex. GHA"
              aria-labelledby="label-create-code"
              value={createForm.code}
              onChange={handleCreateChange}
              disabled={submittingCreate}
              required
            />
          </div>

          {/* h3 — slug auto-généré depuis le nom, éditable manuellement */}
          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="platform-admin-form-label" id="label-create-slug">
              Slug
              {!isSlugManuallyEdited && createForm.name && (
                <span style={{ color: "var(--text-soft)", fontWeight: 400, marginLeft: 6, fontSize: "0.68rem" }}>auto-généré</span>
              )}
            </span>
            <input
              className="filter-input"
              name="slug"
              placeholder="ex. grand-hotel-abidjan"
              aria-labelledby="label-create-slug"
              value={createForm.slug}
              onChange={handleCreateChange}
              disabled={submittingCreate}
              required
            />
          </div>

          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="platform-admin-form-label" id="label-create-status">Statut</span>
            <AppSelect
              name="is_active"
              value={String(createForm.is_active)}
              onChange={handleCreateChange}
              disabled={submittingCreate}
              aria-labelledby="label-create-status"
            >
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </AppSelect>
          </div>

          {/* Localisation */}
          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="platform-admin-form-label" id="label-create-country">Pays</span>
            <input
              className="filter-input"
              name="country"
              placeholder="ex. Côte d'Ivoire"
              aria-labelledby="label-create-country"
              value={createForm.country}
              onChange={handleCreateChange}
              disabled={submittingCreate}
            />
          </div>

          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="platform-admin-form-label" id="label-create-city">Ville</span>
            <input
              className="filter-input"
              name="city"
              placeholder="ex. Abidjan"
              aria-labelledby="label-create-city"
              value={createForm.city}
              onChange={handleCreateChange}
              disabled={submittingCreate}
            />
          </div>

          {/* h4 — Fuseau horaire via AppSelect */}
          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="platform-admin-form-label" id="label-create-tz">Fuseau horaire</span>
            <AppSelect
              name="timezone"
              value={createForm.timezone}
              onChange={handleCreateChange}
              disabled={submittingCreate}
              aria-labelledby="label-create-tz"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </AppSelect>
          </div>

          {/* h4 — Devise via AppSelect */}
          <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="platform-admin-form-label" id="label-create-currency">Devise</span>
            <AppSelect
              name="currency"
              value={createForm.currency}
              onChange={handleCreateChange}
              disabled={submittingCreate}
              aria-labelledby="label-create-currency"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </AppSelect>
          </div>

          {/* h5 — canSubmitHotel + pleine largeur + spinner */}
          <button
            type="submit"
            className="primary-button"
            disabled={!canSubmitHotel}
            aria-busy={submittingCreate}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, gridColumn: "1 / -1" }}
          >
            {submittingCreate ? <><Spinner />Création…</> : "Créer l'hôtel"}
          </button>
        </form>
      </section>

      <section className="list-panel">
        <div className="platform-admin-toolbar">
          <input
            className="filter-input"
            placeholder="Rechercher par hôtel, code, ville ou organisation"
            aria-label="Rechercher un hôtel"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <AppSelect
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filtrer par statut"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </div>
      </section>

      {loading ? <SkeletonSectionGrid /> : null}
      {error ? <div className="alert-box" role="alert" aria-live="assertive">{error}</div> : null}
      {success ? <div className="success-box" role="status" aria-live="polite" aria-atomic="true">{success}</div> : null}

      {!loading && !error ? (
        <section className="platform-admin-section-grid">
          <section className="list-panel">
            <div className="panel-head">
              <div>
                <h3>Parc hotelier</h3>
                <p>Vue d'ensemble des etablissements, de leur organisation et de leur statut d'abonnement.</p>
              </div>
            </div>
            {filteredHotels.length ? (
              <div className="platform-admin-table-wrap">
                <table className="platform-admin-table">
                  <thead>
                    <tr>
                      <th>Hotel</th>
                      <th>Organisation</th>
                      <th>Statut</th>
                      <th>Ville</th>
                      <th>Admins</th>
                    </tr>
                  </thead>
                  <tbody>
                  {filteredHotels.map((item) => {
                      const rowStatus = normalizeStatus(item.subscription_status, item.is_active);
                      return (
                      <tr
                        key={item.id}
                        className={selectedHotel?.id === item.id ? "active" : ""}
                        onClick={() => setSelectedId(item.id)}
                        tabIndex={0}
                        role="button"
                        aria-pressed={selectedHotel?.id === item.id}
                        aria-label={`Sélectionner l'hôtel ${item.name}`}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(item.id); } }}
                      >
                        <td>
                          <PlatformEntityCell
                            name={item.name}
                            sub={item.code || item.slug || "—"}
                            status={rowStatus}
                          />
                        </td>
                        <td>{item.organization_name || "—"}</td>
                        <td>
                          <div className="platform-admin-badge-row">
                            <PlatformBadge
                              status={rowStatus}
                              label={item.subscription_status_label || (item.is_active ? "Actif" : "Inactif")}
                            />
                            <QuotaBadge
                              status={item.user_quota_status}
                              count={item.active_user_count}
                              limit={item.subscription_plan_max_users}
                            />
                          </div>
                        </td>
                        <td>{[item.city, item.country].filter(Boolean).join(", ") || "—"}</td>
                        <td>{item.hotel_admin_count || 0}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <PlatformEmptyState
                icon={<IconEmptyHotel />}
                title="Aucun hôtel trouvé"
                description="Essayez un autre filtre ou créez votre premier établissement."
              />
            )}
          </section>

          <aside className="list-panel platform-admin-side-card">
            <div className="panel-head">
              <div>
                <h3>Fiche hotel</h3>
                <p>Detail plateforme pour le support, l'abonnement, les quotas et l'onboarding admin.</p>
              </div>
            </div>
            {selectedHotel ? (
              <>
                <div className="platform-admin-badge-row">
                  <PlatformBadge
                    status={normalizeStatus(selectedHotel.subscription_status, selectedHotel.is_active)}
                    label={selectedHotel.subscription_status_label || (selectedHotel.is_active ? "Actif" : "Inactif")}
                  />
                  <span className="platform-admin-code">{selectedHotel.subscription_plan_name || "Sans plan"}</span>
                  <QuotaBadge
                    status={selectedHotel.user_quota_status}
                    count={selectedHotel.active_user_count}
                    limit={selectedHotel.subscription_plan_max_users}
                  />
                </div>

                <div className="platform-admin-detail-list">
                  <div className="platform-admin-detail-row">
                    <strong>Hotel</strong>
                    <span>{selectedHotel.name}</span>
                  </div>
                  <div className="platform-admin-detail-row">
                    <strong>Organisation</strong>
                    <span>{selectedHotel.organization_name || "-"}</span>
                  </div>
                  <div className="platform-admin-detail-row">
                    <strong>Utilisateurs actifs</strong>
                    <span>{selectedHotel.active_user_count || 0}</span>
                  </div>
                  <div className="platform-admin-detail-row">
                    <strong>Quota plan</strong>
                    <span>{selectedHotel.subscription_plan_max_users != null ? selectedHotel.subscription_plan_max_users : "Illimité"}</span>
                  </div>
                </div>

                <form className="platform-admin-grid-form" onSubmit={handleUpdateHotel} aria-busy={submittingUpdate}>
                  <AppSelect name="organization_id" value={editForm.organization_id} onChange={handleEditChange} disabled={submittingUpdate} aria-label="Organisation">
                    {organizations.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.name}
                      </option>
                    ))}
                  </AppSelect>
                  <input className="filter-input" name="name" value={editForm.name} onChange={handleEditChange} disabled={submittingUpdate} required />
                  <input className="filter-input" name="code" value={editForm.code} onChange={handleEditChange} disabled={submittingUpdate} required />
                  <input className="filter-input" name="slug" value={editForm.slug} onChange={handleEditChange} disabled={submittingUpdate} required />
                  <input className="filter-input" name="country" value={editForm.country} onChange={handleEditChange} disabled={submittingUpdate} />
                  <input className="filter-input" name="city" value={editForm.city} onChange={handleEditChange} disabled={submittingUpdate} />
                  <input className="filter-input" name="timezone" value={editForm.timezone} onChange={handleEditChange} disabled={submittingUpdate} />
                  <input className="filter-input" name="currency" value={editForm.currency} onChange={handleEditChange} disabled={submittingUpdate} />
                  <AppSelect name="is_active" value={String(editForm.is_active)} onChange={handleEditChange} disabled={submittingUpdate} aria-label="Statut">
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </AppSelect>
                  <button type="submit" className="primary-button" disabled={submittingUpdate} aria-busy={submittingUpdate} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, gridColumn: "1 / -1" }}>
                    {submittingUpdate ? <><Spinner />Enregistrement…</> : "Mettre à jour"}
                  </button>
                </form>

                <form className="platform-admin-grid-form" onSubmit={handleCreateAdmin} aria-busy={submittingAdmin}>
                  <input className="filter-input" name="username" placeholder="Username admin hotel" value={adminForm.username} onChange={handleAdminChange} disabled={submittingAdmin} required />
                  <input className="filter-input" type="password" name="password" placeholder="Mot de passe" value={adminForm.password} onChange={handleAdminChange} disabled={submittingAdmin} required />
                  <input className="filter-input" name="first_name" placeholder="Prenom" value={adminForm.first_name} onChange={handleAdminChange} disabled={submittingAdmin} />
                  <input className="filter-input" name="last_name" placeholder="Nom" value={adminForm.last_name} onChange={handleAdminChange} disabled={submittingAdmin} />
                  <input className="filter-input" type="email" name="email" placeholder="Email" value={adminForm.email} onChange={handleAdminChange} disabled={submittingAdmin} />
                  <input className="filter-input" name="phone" placeholder="Telephone" value={adminForm.phone} onChange={handleAdminChange} disabled={submittingAdmin} />
                  <button type="submit" className="primary-button" disabled={submittingAdmin} aria-busy={submittingAdmin} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, gridColumn: "1 / -1" }}>
                    {submittingAdmin ? <><Spinner />Création…</> : "Créer l'admin hôtel"}
                  </button>
                </form>

                <div className="platform-admin-action-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setConfirmAction(selectedHotel.is_active ? "suspend" : "reactivate")}
                    disabled={anySubmitting}
                  >
                    {selectedHotel.is_active ? "Suspendre l'hôtel" : "Réactiver l'hôtel"}
                  </button>
                </div>
              </>
            ) : (
              <PlatformEmptyState
                icon={<IconEmptyHotel />}
                title="Aucun hôtel sélectionné"
                description="Choisissez une ligne pour consulter son détail."
              />
            )}
          </aside>
        </section>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(confirmAction)}
        title={confirmAction === "suspend" ? "Suspendre l'hôtel" : "Réactiver l'hôtel"}
        message={
          confirmAction === "suspend"
            ? "L'hotel et son abonnement courant passeront en statut suspendu."
            : "L'hotel redeviendra actif et l'abonnement suspendu repassera en actif."
        }
        confirmLabel={confirmAction === "suspend" ? "Suspendre" : "Réactiver"}
        variant={confirmAction === "suspend" ? "danger" : "default"}
        confirmDisabled={submittingAction}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}