import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SuperRootPageShell, SuperRootState } from "../../../../features/super-root/shared/SuperRootShared";
import { superRootHotelsApi } from "../api/superRootHotelsApi";
import HotelsFilters from "../list/HotelsFilters";
import HotelsSkeleton from "../list/HotelsSkeleton";
import HotelsTable from "../list/HotelsTable";

const INITIAL_CREATE_FORM = {
  organization_id: "",
  name: "",
  code: "",
  slug: "",
  city: "",
  country: "",
  timezone: "Atlantic/Reykjavik",
  currency: "XOF",
  is_active: true,
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function codeFromName(value) {
  const compact = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
  return compact || "";
}

function getErrorMessage(error, fallback) {
  const payload = error?.payload;
  if (payload?.detail) return payload.detail;
  if (payload && typeof payload === "object") {
    return Object.values(payload).flat().filter(Boolean).join(" ") || fallback;
  }
  return error?.message || fallback;
}

export default function SuperRootHotelsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ q: "", status: "", license_status: "", city: "", country: "", page: 1 });
  const [data, setData] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function load(next = filters) {
    setLoading(true);
    setError("");
    try {
      setData(await superRootHotelsApi.getHotels(next));
    } catch (err) {
      setError(err.payload?.detail || err.message || "Chargement des hotels impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const delay = filters.q || filters.city || filters.country ? 350 : 0;
    const timeout = window.setTimeout(() => load(filters), delay);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.status, filters.license_status, filters.q, filters.city, filters.country]);

  useEffect(() => {
    superRootHotelsApi.listOrganizations()
      .then((payload) => setOrganizations(payload.organizations || []))
      .catch(() => setOrganizations([]));
  }, []);

  const hotels = data?.hotels || [];
  const active = hotels.filter((hotel) => hotel.is_active).length;
  const suspended = hotels.length - active;
  const pagination = data?.pagination || {};
  const total = pagination.total ?? data?.count ?? hotels.length;
  const page = pagination.page || 1;
  const pageSize = pagination.page_size || hotels.length || 1;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, (page - 1) * pageSize + hotels.length);

  function setCreateField(field, value) {
    setCreateForm((current) => {
      if (field === "name") {
        return {
          ...current,
          name: value,
          code: current.code ? current.code : codeFromName(value),
          slug: current.slug ? current.slug : slugify(value),
        };
      }
      if (field === "code") {
        return { ...current, code: String(value || "").toUpperCase() };
      }
      if (field === "slug") {
        return { ...current, slug: slugify(value) };
      }
      return { ...current, [field]: value };
    });
    setFormError("");
  }

  function validateCreateForm() {
    if (!createForm.organization_id) return "Selectionne une organisation proprietaire.";
    if (!createForm.name.trim()) return "Le nom de l'hotel est obligatoire.";
    if (!createForm.code.trim()) return "Le code hotel est obligatoire.";
    if (!createForm.slug.trim()) return "Le slug hotel est obligatoire.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(createForm.slug.trim())) {
      return "Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets.";
    }
    return "";
  }

  async function handleCreateHotel(event) {
    event.preventDefault();
    setFeedback("");
    const validationError = validateCreateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        organization_id: Number(createForm.organization_id),
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        slug: createForm.slug.trim().toLowerCase(),
        city: createForm.city.trim(),
        country: createForm.country.trim(),
        timezone: createForm.timezone.trim() || "Atlantic/Reykjavik",
        currency: createForm.currency.trim().toUpperCase() || "XOF",
        is_active: Boolean(createForm.is_active),
      };
      const result = await superRootHotelsApi.createHotel(payload);
      setCreateForm(INITIAL_CREATE_FORM);
      setShowCreate(false);
      setFeedback(`Hotel cree : ${result.hotel?.name || payload.name}`);
      await load({ ...filters, page: 1 });
    } catch (err) {
      setFormError(getErrorMessage(err, "Creation de l'hotel impossible."));
    } finally {
      setSaving(false);
    }
  }

  function openPlatformHotels() {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.license_status) params.set("license_status", filters.license_status);
    if (filters.city) params.set("city", filters.city);
    if (filters.country) params.set("country", filters.country);
    navigate(`/platform/hotels${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <SuperRootPageShell
      title="Hotels Super Root"
      subtitle="Pilotage global des hotels, licences, modules, securite, monitoring et audit."
      actions={(
        <>
          <button className="sr-btn sr-btn-outline" type="button" onClick={openPlatformHotels}>
            Admin Plateforme
          </button>
          <button className="sr-btn sr-btn-outline" onClick={() => load(filters)}>Actualiser</button>
          <button className="sr-btn" type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Fermer" : "Nouvel hotel"}
          </button>
        </>
      )}
    >
      <HotelsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={(event) => {
          event.preventDefault();
          load({ ...filters, page: 1 });
        }}
      />
      {feedback ? <div className="sr-state sr-hotels-feedback">{feedback}</div> : null}
      {showCreate ? (
        <section className="sr-hotels-create-card">
          <div className="sr-hotels-create-head">
            <div>
              <span>Creation tenant hotel</span>
              <h2>Nouvel hotel</h2>
            </div>
            <span className="sr-hotels-count">Super Root</span>
          </div>
          <form className="sr-hotels-create-form" onSubmit={handleCreateHotel}>
            <label>
              <span>Organisation *</span>
              <select
                className="sr-input"
                value={createForm.organization_id}
                onChange={(event) => setCreateField("organization_id", event.target.value)}
              >
                <option value="">Selectionner une organisation</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nom hotel *</span>
              <input
                className="sr-input"
                value={createForm.name}
                onChange={(event) => setCreateField("name", event.target.value)}
                placeholder="ex. AFRIVO Default Hotel"
              />
            </label>
            <label>
              <span>Code *</span>
              <input
                className="sr-input"
                value={createForm.code}
                onChange={(event) => setCreateField("code", event.target.value)}
                placeholder="ex. AFH"
              />
            </label>
            <label>
              <span>Slug *</span>
              <input
                className="sr-input"
                value={createForm.slug}
                onChange={(event) => setCreateField("slug", event.target.value)}
                placeholder="afrivo-default-hotel"
              />
            </label>
            <label>
              <span>Ville</span>
              <input
                className="sr-input"
                value={createForm.city}
                onChange={(event) => setCreateField("city", event.target.value)}
                placeholder="Abidjan"
              />
            </label>
            <label>
              <span>Pays</span>
              <input
                className="sr-input"
                value={createForm.country}
                onChange={(event) => setCreateField("country", event.target.value)}
                placeholder="Cote d'Ivoire"
              />
            </label>
            <label>
              <span>Fuseau horaire</span>
              <input
                className="sr-input"
                value={createForm.timezone}
                onChange={(event) => setCreateField("timezone", event.target.value)}
              />
            </label>
            <label>
              <span>Devise</span>
              <input
                className="sr-input"
                value={createForm.currency}
                onChange={(event) => setCreateField("currency", event.target.value)}
                maxLength={3}
              />
            </label>
            <label className="sr-hotels-toggle">
              <input
                type="checkbox"
                checked={createForm.is_active}
                onChange={(event) => setCreateField("is_active", event.target.checked)}
              />
              <span>Hotel actif des la creation</span>
            </label>
            <div className="sr-hotels-create-note">
              La creation ajoute uniquement la fiche hotel. Les abonnements, modules et admins hotel restent configurables dans les modules dedies.
            </div>
            {formError ? <div className="sr-error sr-hotels-form-error">{formError}</div> : null}
            <div className="sr-hotels-form-actions">
              <button className="sr-btn sr-btn-outline" type="button" onClick={() => setShowCreate(false)}>
                Annuler
              </button>
              <button className="sr-btn" type="submit" disabled={saving}>
                {saving ? "Creation..." : "Creer l'hotel"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
      {loading && !data ? (
        <HotelsSkeleton />
      ) : (
      <SuperRootState loading={false} error={error}>
        <div className="sr-hotels-kpi-grid">
          {[
            { label: "Hotels affiches", value: hotels.length },
            { label: "Actifs", value: active },
            { label: "Suspendus", value: suspended },
            { label: "Total serveur", value: total },
          ].map((item) => (
            <div className="sr-hotels-kpi" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <section className="sr-hotels-panel">
          <div className="sr-hotels-panel-head">
            <div>
              <span className="sr-hotels-section-kicker">Niveau business</span>
              <h2>Parc hotels</h2>
            </div>
            <span className="sr-hotels-count">{hotels.length}</span>
          </div>
          <HotelsTable hotels={hotels} />
          <div className="sr-pagination">
            <span>{start}-{end} sur {total} hotels</span>
            <button className="sr-btn sr-btn-outline" disabled={!pagination.has_previous || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Precedent</button>
            <span>Page {page} / {pagination.pages || 1}</span>
            <button className="sr-btn sr-btn-outline" disabled={!pagination.has_next || loading} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Suivant</button>
          </div>
        </section>
      </SuperRootState>
      )}
    </SuperRootPageShell>
  );
}
