import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SrBadge, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { superRootOrganizationsApi } from "./superRootOrganizationsApi";

const INITIAL_FORM = {
  name: "",
  slug: "",
  status: "active",
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getErrorMessage(error, fallback) {
  const payload = error?.payload;
  if (payload?.detail) return payload.detail;
  if (payload && typeof payload === "object") {
    return Object.values(payload).flat().filter(Boolean).join(" ") || fallback;
  }
  return error?.message || fallback;
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function statusTone(status, isActive) {
  if (!isActive || status === "inactive") return "neutral";
  if (status === "suspended") return "danger";
  return "ok";
}

function statusLabel(status, isActive) {
  if (!isActive || status === "inactive") return "Inactive";
  if (status === "suspended") return "Suspendue";
  return "Active";
}

export function SuperRootOrganizationsPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function loadOrganizations() {
    setError("");
    const payload = await superRootOrganizationsApi.listOrganizations();
    setOrganizations(payload.organizations || []);
    setCount(payload.count ?? payload.organizations?.length ?? 0);
  }

  useEffect(() => {
    loadOrganizations()
      .catch((requestError) => {
        setError(getErrorMessage(requestError, "Impossible de charger les organisations."));
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredOrganizations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizations;
    return organizations.filter((organization) => (
      [organization.name, organization.slug, organization.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    ));
  }, [organizations, search]);

  const activeCount = useMemo(
    () => organizations.filter((organization) => organization.is_active && organization.status === "active").length,
    [organizations],
  );
  const suspendedCount = useMemo(
    () => organizations.filter((organization) => organization.status === "suspended").length,
    [organizations],
  );
  const hotelsCount = useMemo(
    () => organizations.reduce((sum, organization) => sum + (organization.hotels_count || 0), 0),
    [organizations],
  );

  function setField(field, value) {
    setForm((current) => {
      if (field === "name") {
        return { ...current, name: value, slug: slugify(value) };
      }
      return { ...current, [field]: value };
    });
    setFormError("");
  }

  function validateForm() {
    if (!form.name.trim()) return "Le nom de l'organisation est obligatoire.";
    if (!form.slug.trim()) return "Le slug est obligatoire.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      return "Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets.";
    }
    return "";
  }

  async function handleCreate(event) {
    event.preventDefault();
    setFeedback("");
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        status: form.status,
        is_active: form.status === "active",
      };
      await superRootOrganizationsApi.createOrganization(payload);
      await loadOrganizations();
      setForm(INITIAL_FORM);
      setShowCreate(false);
      setFeedback(`Organisation creee : ${payload.name}`);
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, "Creation de l'organisation impossible."));
    } finally {
      setSaving(false);
    }
  }

  function openPlatformOrganizations() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    navigate(`/platform/organizations${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <SuperRootPageShell
      title="Organisations Super Root"
      subtitle="Creation et supervision globale des organisations clientes AFRIVO."
      actions={(
        <>
          <button className="sr-btn sr-btn-outline" type="button" onClick={openPlatformOrganizations}>
            Admin Plateforme
          </button>
          <button className="sr-btn sr-btn-outline" type="button" onClick={() => loadOrganizations()}>
            Actualiser
          </button>
          <button className="sr-btn" type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Fermer" : "Nouvelle organisation"}
          </button>
        </>
      )}
    >
      <SuperRootState loading={loading} error={error}>
        {feedback ? <div className="sr-state sr-orgs-feedback">{feedback}</div> : null}

        <div className="sr-orgs-kpis">
          <div className="sr-orgs-kpi">
            <span>Organisations</span>
            <strong>{count}</strong>
          </div>
          <div className="sr-orgs-kpi">
            <span>Actives</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="sr-orgs-kpi">
            <span>Suspendues</span>
            <strong>{suspendedCount}</strong>
          </div>
          <div className="sr-orgs-kpi">
            <span>Hotels rattaches</span>
            <strong>{hotelsCount}</strong>
          </div>
        </div>

        {showCreate ? (
          <section className="sr-orgs-card">
            <div className="sr-orgs-card-head">
              <div>
                <span>Creation tenant</span>
                <h2>Nouvelle organisation</h2>
              </div>
              <SrBadge tone="ok">Super Root</SrBadge>
            </div>

            <form className="sr-orgs-form" onSubmit={handleCreate}>
              <label>
                <span>Nom organisation *</span>
                <input
                  className="sr-input"
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="ex. Complexe Hotelier Mirabelle"
                />
              </label>
              <label>
                <span>Slug *</span>
                <input
                  className="sr-input"
                  value={form.slug}
                  onChange={(event) => setField("slug", slugify(event.target.value))}
                  placeholder="complexe-hotelier-mirabelle"
                />
              </label>
              <label>
                <span>Statut initial</span>
                <select
                  className="sr-input"
                  value={form.status}
                  onChange={(event) => setField("status", event.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspendue</option>
                </select>
              </label>

              <div className="sr-orgs-note">
                La creation ici ouvre le tenant organisation. Les hotels, licences et admins organisation restent geres dans leurs modules dedies.
              </div>

              {formError ? <div className="sr-error sr-orgs-form-error">{formError}</div> : null}

              <div className="sr-orgs-form-actions">
                <button className="sr-btn sr-btn-outline" type="button" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
                <button className="sr-btn" type="submit" disabled={saving}>
                  {saving ? "Creation..." : "Creer l'organisation"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="sr-orgs-card">
          <div className="sr-orgs-card-head">
            <div>
              <span>Niveau tenant</span>
              <h2>Organisations clientes</h2>
            </div>
            <input
              className="sr-input sr-orgs-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher nom, slug, statut..."
            />
          </div>

          {filteredOrganizations.length ? (
            <div className="sr-orgs-list">
              {filteredOrganizations.map((organization) => (
                <article className="sr-orgs-row" key={organization.id}>
                  <div className="sr-orgs-identity">
                    <div className="sr-orgs-avatar">
                      {(organization.name || "OR").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong>{organization.name}</strong>
                      <span>{organization.slug}</span>
                    </div>
                  </div>

                  <div className="sr-orgs-metrics">
                    <div>
                      <span>Hotels</span>
                      <strong>{organization.hotels_count || 0}</strong>
                    </div>
                    <div>
                      <span>Utilisateurs</span>
                      <strong>{organization.users_count || 0}</strong>
                    </div>
                    <div>
                      <span>Creation</span>
                      <strong>{formatDate(organization.created_at)}</strong>
                    </div>
                  </div>

                  <div className="sr-orgs-status">
                    <SrBadge tone={statusTone(organization.status, organization.is_active)}>
                      {statusLabel(organization.status, organization.is_active)}
                    </SrBadge>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="sr-empty">Aucune organisation trouvee.</div>
          )}
        </section>
      </SuperRootState>
    </SuperRootPageShell>
  );
}
