import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppSelect } from "../../components/AppSelect";
import {
  createPlatformOrganization,
  listPlatformOrganizations,
} from "../../services/platformAdminService";
import { slugify } from "../../utils/slugify";
import { SkeletonSectionGrid } from "./PlatformAdminSkeletons";
import {
  PlatformNavTabs,
  PlatformBadge,
  PlatformKpiCard,
  PlatformEntityCell,
  PlatformEmptyState,
  IconOrg,
  IconHotel,
  IconEmptyHotel,
} from "./PlatformAdminComponents";
import "./PlatformAdmin.css";

const FILTER_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "active", label: "Actives" },
  { value: "inactive", label: "Inactives" },
];

const EMPTY_FORM = {
  name: "",
  slug: "",
  is_active: true,
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* ── FIX #10 — auto-dismiss pour success/error ─────────────── */
const AUTO_DISMISS_MS = 4000;

export function PlatformOrganizationsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* FIX #10 — refs pour les timers d'auto-dismiss */
  const errorTimerRef = useRef(null);
  const successTimerRef = useRef(null);

  /* FIX #10 — nettoyer les timers au démontage */
  useEffect(() => {
    return () => {
      clearTimeout(errorTimerRef.current);
      clearTimeout(successTimerRef.current);
    };
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

  async function loadOrganizations(preferredId = selectedId) {
    const payload = await listPlatformOrganizations();
    const items = payload.results || [];
    setOrganizations(items);

    const nextSelectedId =
      preferredId && items.some((item) => item.id === preferredId)
        ? preferredId
        : items[0]?.id || null;

    setSelectedId(nextSelectedId);
  }

  useEffect(() => {
    loadOrganizations()
      .catch((requestError) => {
        showError(requestError.message || "Impossible de charger les organisations.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return organizations.filter((item) => {
      const matchesSearch =
        !term ||
        [item.name, item.slug]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? item.is_active : !item.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [organizations, search, statusFilter]);

  const selectedOrganization =
    filteredOrganizations.find((item) => item.id === selectedId) ||
    filteredOrganizations[0] ||
    null;

  const slugError = useMemo(() => {
    if (!form.slug.trim()) return "Le slug est requis.";
    if (!SLUG_PATTERN.test(form.slug.trim())) {
      return "Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets.";
    }
    return "";
  }, [form.slug]);

  const canSubmit = Boolean(!submitting && form.name.trim() && !slugError);

  useEffect(() => {
    if (isSlugManuallyEdited) return undefined;

    const timeoutId = window.setTimeout(() => {
      setForm((current) => {
        const nextSlug = slugify(current.name);
        if (current.slug === nextSlug) return current;
        return { ...current, slug: nextSlug };
      });
    }, 200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [form.name, isSlugManuallyEdited]);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === "is_active" ? value === "true" : value,
    }));

    if (name === "slug") {
      setIsSlugManuallyEdited(true);
    }
  }

  function handleNameChange(event) {
    setForm((current) => ({
      ...current,
      name: event.target.value,
    }));
  }

  async function handleCreateOrganization(event) {
    event.preventDefault();

    setSubmitAttempted(true);
    if (submitting || !canSubmit) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload = await createPlatformOrganization({
        ...form,
        slug: form.slug.trim(),
      });

      setForm(EMPTY_FORM);
      setIsSlugManuallyEdited(false);
      setSubmitAttempted(false);

      await loadOrganizations(payload.organization?.id || null);

      /* FIX #10 — auto-dismiss success */
      showSuccess("Organisation créée avec succès.");
    } catch (requestError) {
      /* FIX #10 — auto-dismiss error */
      showError(requestError.message || "Impossible de créer l'organisation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack platform-admin-page">
      <section className="hero-panel">
        <span className="eyebrow">Plateforme</span>
        <h2>Organisations abonnées</h2>
        <p>
          Lecture centralisée des comptes clients, du parc hôtelier rattaché et
          des administrateurs hôtel.
        </p>
      </section>

      <PlatformNavTabs />

      <section className="platform-admin-summary-grid">
        <PlatformKpiCard
          icon={<IconOrg />}
          iconVariant="blue"
          label="Organisations"
          value={organizations.length}
          meta="Comptes clients référencés"
          trendVariant="neutral"
        />

        <PlatformKpiCard
          icon={<IconOrg />}
          iconVariant="teal"
          label="Actives"
          value={organizations.filter((item) => item.is_active).length}
          meta="Opérables sur la plateforme"
          trendVariant="neutral"
        />

        <PlatformKpiCard
          icon={<IconHotel />}
          iconVariant="amber"
          label="Hôtels rattachés"
          value={organizations.reduce(
            (sum, item) => sum + (item.hotel_count || 0),
            0
          )}
          meta="Inventaire cumulé"
          trendVariant="neutral"
        />
      </section>

      <section className="list-panel">
        <div className="panel-head">
          <div>
            <h3>Nouvelle organisation</h3>
            <p>
              Création rapide d'un nouveau client SaaS AFRIVO avant onboarding
              hôtel.
            </p>
          </div>
        </div>

        {/* Disposition F — champs sur une ligne, séparateur, bouton pleine largeur */}
        <form
          className="platform-admin-stacked-form"
          onSubmit={handleCreateOrganization}
          aria-busy={submitting}
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
        >
          {/* Ligne champs : Nom · Slug · État */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 140px", gap: 10, minWidth: 0 }}>
            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span className="platform-admin-form-label" id="label-name">Nom</span>
              <input
                className="filter-input"
                name="name"
                placeholder="Nom de l'organisation"
                value={form.name}
                onChange={handleNameChange}
                disabled={submitting}
                required
                aria-labelledby="label-name"
                style={{ height: 42, minHeight: 42, boxSizing: "border-box" }}
              />
            </div>

            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span className="platform-admin-form-label" id="label-slug">Slug</span>
              <input
                className="filter-input"
                name="slug"
                placeholder="slug-auto-généré"
                value={form.slug}
                onChange={handleFormChange}
                disabled={submitting}
                required
                aria-labelledby="label-slug"
                aria-invalid={slugError ? "true" : "false"}
                aria-describedby={slugError ? "slug-error" : undefined}
                style={{ height: 42, minHeight: 42, boxSizing: "border-box" }}
              />
              {(isSlugManuallyEdited || submitAttempted) && slugError && (
                <span id="slug-error" className="platform-admin-field-error" role="alert">
                  {slugError}
                </span>
              )}
            </div>

            <div className="platform-admin-form-field" style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <span className="platform-admin-form-label" id="label-status">État</span>
              <AppSelect
                name="is_active"
                value={String(form.is_active)}
                onChange={handleFormChange}
                disabled={submitting}
                aria-labelledby="label-status"
                style={{
                  height: 42,
                  minHeight: 42,
                  maxHeight: 42,
                  fontSize: "0.85rem",
                  borderRadius: 12,
                  padding: "0 12px",
                  boxSizing: "border-box",
                }}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </AppSelect>
            </div>
          </div>

          {/* Séparateur */}
          <hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.08)", margin: "16px 0" }} />

          {/* Bouton pleine largeur */}
          <button
            type="submit"
            className="primary-button"
            disabled={!canSubmit}
            aria-busy={submitting}
            style={{
              width: "100%",
              height: 42,
              minHeight: 42,
              borderRadius: 12,
              fontSize: "0.85rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxSizing: "border-box",
            }}
          >
            {submitting ? (
              <>
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}
                >
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
                </svg>
                Création…
              </>
            ) : (
              "Créer l'organisation"
            )}
          </button>
        </form>
      </section>

      <section className="list-panel">
        {/* FIX #4 — label visible pour le filtre de statut */}
        <div className="platform-admin-toolbar">
          <input
            className="filter-input"
            placeholder="Rechercher par nom ou slug"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Rechercher une organisation"
          />

          <AppSelect
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filtrer par statut"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </div>
      </section>

      {loading ? <SkeletonSectionGrid /> : null}

      {/* FIX #3 — role="alert" sur l'erreur, role="status" + aria-live sur le succès */}
      {error ? (
        <div className="alert-box" role="alert" aria-live="assertive">
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="success-box"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {success}
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="platform-admin-section-grid">
          <section className="list-panel">
            <div className="panel-head">
              <div>
                <h3>Liste des organisations</h3>
                <p>
                  Vue portefeuille pour le support, le suivi commercial et
                  l'onboarding.
                </p>
              </div>
            </div>

            {filteredOrganizations.length ? (
              <div className="platform-admin-table-wrap">
                {/* FIX #7 — role="rowgroup" + tabIndex sur tbody tr pour navigation clavier */}
                <table className="platform-admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Organisation</th>
                      <th scope="col">État</th>
                      <th scope="col">Hôtels</th>
                      <th scope="col">Admins</th>
                      <th scope="col">Abonnements actifs</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredOrganizations.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          selectedOrganization?.id === item.id ? "active" : ""
                        }
                        onClick={() => setSelectedId(item.id)}
                        /* FIX #7 — accessibilité clavier */
                        tabIndex={0}
                        role="button"
                        aria-pressed={selectedOrganization?.id === item.id}
                        aria-label={`Sélectionner l'organisation ${item.name}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(item.id);
                          }
                        }}
                      >
                        <td>
                          <PlatformEntityCell
                            name={item.name}
                            sub={item.slug}
                            status={item.is_active ? "active" : "inactive"}
                          />
                        </td>

                        <td>
                          <PlatformBadge
                            status={item.is_active ? "active" : "inactive"}
                            label={item.is_active ? "Active" : "Inactive"}
                          />
                        </td>

                        <td>{item.hotel_count || 0}</td>
                        <td>{item.hotel_admin_count || 0}</td>
                        <td>{item.active_subscription_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <PlatformEmptyState
                icon={<IconEmptyHotel />}
                title="Aucune organisation trouvée"
                description="Affinez vos filtres ou créez un nouveau compte client."
              />
            )}
          </section>

          {/* FIX #8 — fiche organisation : badge intégré dans la detail-list, pas en double */}
          <aside className="list-panel platform-admin-side-card">
            <div className="panel-head">
              <div>
                <h3>Fiche organisation</h3>
                <p>Détail du compte client sélectionné pour le support AFRIVO.</p>
              </div>
            </div>

            {selectedOrganization ? (
              <div className="platform-admin-detail-list">
                {/* FIX #8 — badge intégré directement dans la liste, plus de badge-row séparée */}
                <div className="platform-admin-detail-row">
                  <strong>Nom</strong>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {selectedOrganization.name}
                    <PlatformBadge
                      status={selectedOrganization.is_active ? "active" : "inactive"}
                      label={selectedOrganization.is_active ? "Active" : "Inactive"}
                    />
                  </span>
                </div>

                <div className="platform-admin-detail-row">
                  <strong>Slug</strong>
                  <span>{selectedOrganization.slug || "—"}</span>
                </div>

                <div className="platform-admin-detail-row">
                  <strong>Hôtels total</strong>
                  <span>{selectedOrganization.hotel_count || 0}</span>
                </div>

                <div className="platform-admin-detail-row">
                  <strong>Hôtels actifs</strong>
                  <span>{selectedOrganization.active_hotel_count || 0}</span>
                </div>

                <div className="platform-admin-detail-row">
                  <strong>Utilisateurs</strong>
                  <span>{selectedOrganization.user_count || 0}</span>
                </div>

                <div className="platform-admin-detail-row">
                  <strong>Admins hôtel</strong>
                  <span>{selectedOrganization.hotel_admin_count || 0}</span>
                </div>
              </div>
            ) : (
              <PlatformEmptyState
                icon={<IconOrg />}
                title="Aucune organisation sélectionnée"
                description="Sélectionnez une ligne pour consulter son détail."
              />
            )}
          </aside>
        </section>
      ) : null}

      {/* FIX #2 — keyframe spinner dans le style global inline */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}