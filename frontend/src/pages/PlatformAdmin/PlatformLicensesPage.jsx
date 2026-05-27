import { useEffect, useMemo, useState } from "react";

import { AppSelect } from "../../shared/components/AppSelect";
import {
  checkPlatformModuleAccess,
  createPlatformLicense,
  listPlatformHotels,
  listPlatformLicenses,
  listPlatformModules,
  listPlatformOrganizations,
  renewPlatformLicense,
  suspendPlatformLicense,
  updatePlatformLicense,
} from "../../services/platformAdminService";
import {
  IconEmpty,
  IconHotel,
  IconSubscription,
  PlatformBadge,
  PlatformEmptyState,
  PlatformEntityCell,
  PlatformKpiCard,
} from "./PlatformAdminComponents";
import { SkeletonStackList } from "./PlatformAdminSkeletons";
import "./PlatformAdmin.css";

const LICENSE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspendue" },
  { value: "expired", label: "Expiree" },
  { value: "cancelled", label: "Annulee" },
];

const EMPTY_LICENSE_FORM = {
  module_id: "",
  organization_id: "",
  hotel_id: "",
  status: "active",
  starts_at: "",
  ends_at: "",
  monthly_price: "0.00",
  notes: "",
};

const EMPTY_CHECK_FORM = {
  module_code: "",
  organization_id: "",
  hotel_id: "",
};

function toApiDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function toInputDate(value) {
  return value ? value.slice(0, 16) : "";
}

export function PlatformLicensesPage() {
  const [licenses, setLicenses] = useState([]);
  const [modules, setModules] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [selectedLicenseId, setSelectedLicenseId] = useState(null);
  const [createForm, setCreateForm] = useState(EMPTY_LICENSE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_LICENSE_FORM);
  const [checkForm, setCheckForm] = useState(EMPTY_CHECK_FORM);
  const [checkResult, setCheckResult] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadScreen(preferredId = selectedLicenseId) {
    const [licensesPayload, modulesPayload, organizationsPayload, hotelsPayload] = await Promise.all([
      listPlatformLicenses(),
      listPlatformModules(),
      listPlatformOrganizations(),
      listPlatformHotels(),
    ]);
    const nextLicenses = licensesPayload.results || [];
    setLicenses(nextLicenses);
    setModules(modulesPayload.results || []);
    setOrganizations(organizationsPayload.results || []);
    setHotels(hotelsPayload.results || []);
    setSelectedLicenseId(
      preferredId && nextLicenses.some((item) => item.id === preferredId)
        ? preferredId
        : nextLicenses[0]?.id || null
    );
  }

  useEffect(() => {
    loadScreen()
      .catch((requestError) => setError(requestError.message || "Impossible de charger les licences."))
      .finally(() => setLoading(false));
  }, []);

  const filteredLicenses = useMemo(() => {
    const term = search.trim().toLowerCase();
    return licenses.filter((item) => {
      const matchesSearch =
        !term ||
        [item.module_name, item.module_code, item.organization_name, item.hotel_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [licenses, search, statusFilter]);

  const selectedLicense =
    filteredLicenses.find((item) => item.id === selectedLicenseId) ||
    licenses.find((item) => item.id === selectedLicenseId) ||
    null;

  useEffect(() => {
    if (!selectedLicense) return;
    setEditForm({
      module_id: String(selectedLicense.module || ""),
      organization_id: String(selectedLicense.organization || ""),
      hotel_id: String(selectedLicense.hotel || ""),
      status: selectedLicense.status || "active",
      starts_at: toInputDate(selectedLicense.starts_at),
      ends_at: toInputDate(selectedLicense.ends_at),
      monthly_price: selectedLicense.monthly_price || "0.00",
      notes: selectedLicense.notes || "",
    });
  }, [selectedLicense]);

  function handleLicenseFormChange(setter, event) {
    const { name, value } = event.target;
    setter((current) => ({
      ...current,
      [name]: value,
      ...(name === "hotel_id" && value ? { organization_id: "" } : {}),
    }));
    setError("");
  }

  function handleCheckChange(event) {
    const { name, value } = event.target;
    setCheckForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "hotel_id" && value ? { organization_id: "" } : {}),
    }));
    setCheckResult(null);
  }

  function buildPayload(source) {
    const payload = {
      module_id: Number(source.module_id),
      organization_id: source.organization_id ? Number(source.organization_id) : null,
      hotel_id: source.hotel_id ? Number(source.hotel_id) : null,
      status: source.status,
      ends_at: toApiDate(source.ends_at),
      monthly_price: source.monthly_price,
      notes: source.notes,
    };
    if (source.starts_at) {
      payload.starts_at = toApiDate(source.starts_at);
    }
    return payload;
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const payload = await createPlatformLicense(buildPayload(createForm));
      setSuccess("Licence creee.");
      setCreateForm(EMPTY_LICENSE_FORM);
      await loadScreen(payload.license?.id);
    } catch (requestError) {
      setError(requestError.message || "Impossible de creer la licence.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedLicense || submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await updatePlatformLicense(selectedLicense.id, buildPayload(editForm));
      setSuccess("Licence mise a jour.");
      await loadScreen(selectedLicense.id);
    } catch (requestError) {
      setError(requestError.message || "Impossible de modifier la licence.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSuspend() {
    if (!selectedLicense || submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await suspendPlatformLicense(selectedLicense.id, { note: "Suspension depuis la console plateforme." });
      setSuccess("Licence suspendue.");
      await loadScreen(selectedLicense.id);
    } catch (requestError) {
      setError(requestError.message || "Impossible de suspendre la licence.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRenew() {
    if (!selectedLicense || !editForm.ends_at || submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await renewPlatformLicense(selectedLicense.id, {
        ends_at: toApiDate(editForm.ends_at),
        note: "Renouvellement depuis la console plateforme.",
      });
      setSuccess("Licence renouvelee.");
      await loadScreen(selectedLicense.id);
    } catch (requestError) {
      setError(requestError.message || "Impossible de renouveler la licence.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckAccess(event) {
    event.preventDefault();
    if (checking || !checkForm.module_code) return;
    setChecking(true);
    setCheckResult(null);
    setError("");
    try {
      const payload = await checkPlatformModuleAccess({
        moduleCode: checkForm.module_code,
        organizationId: checkForm.organization_id || null,
        hotelId: checkForm.hotel_id || null,
      });
      setCheckResult(payload);
    } catch (requestError) {
      setError(requestError.message || "Impossible de verifier l'acces module.");
    } finally {
      setChecking(false);
    }
  }

  const activeCount = licenses.filter((item) => item.status === "active").length;
  const validCount = licenses.filter((item) => item.is_valid).length;

  return (
    <div className="page-stack platform-admin-page">
      <section className="platform-admin-summary-grid">
        <PlatformKpiCard icon={<IconSubscription />} label="Licences" value={licenses.length} meta="Affectations module" />
        <PlatformKpiCard icon={<IconSubscription />} iconVariant="teal" label="Actives" value={activeCount} meta="Statut actif" />
        <PlatformKpiCard icon={<IconHotel />} iconVariant="blue" label="Valides maintenant" value={validCount} meta="Licence + cible + module OK" />
      </section>

      {error ? <div className="alert-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      <section className="platform-admin-dashboard-grid">
        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>Nouvelle licence</h3>
              <p>Ciblez une organisation entière ou un hotel précis.</p>
            </div>
          </div>
          <LicenseForm
            form={createForm}
            modules={modules}
            organizations={organizations}
            hotels={hotels}
            submitting={submitting}
            onChange={(event) => handleLicenseFormChange(setCreateForm, event)}
            onSubmit={handleCreate}
            submitLabel="Creer la licence"
          />
        </section>

        <section className="list-panel">
          <div className="panel-head">
            <div>
              <h3>Verifier un acces module</h3>
              <p>Controlez si une organisation ou un hotel peut utiliser un module.</p>
            </div>
          </div>
          <form className="platform-admin-grid-form" onSubmit={handleCheckAccess}>
            <AppSelect name="module_code" value={checkForm.module_code} onChange={handleCheckChange} required>
              <option value="">Module...</option>
              {modules.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
            </AppSelect>
            <AppSelect name="organization_id" value={checkForm.organization_id} onChange={handleCheckChange} disabled={Boolean(checkForm.hotel_id)}>
              <option value="">Organisation...</option>
              {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </AppSelect>
            <AppSelect name="hotel_id" value={checkForm.hotel_id} onChange={handleCheckChange}>
              <option value="">Hotel...</option>
              {hotels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </AppSelect>
            <button type="submit" className="primary-button" disabled={checking}>
              {checking ? "Verification..." : "Verifier l'acces"}
            </button>
          </form>
          {checkResult ? (
            <div className="platform-admin-inline-stats" style={{ marginTop: 12 }}>
              <span><strong>Resultat</strong>{checkResult.allowed ? "Autorise" : "Refuse"}</span>
              <span><strong>Module</strong>{checkResult.module_code}</span>
            </div>
          ) : null}
        </section>
      </section>

      <section className="list-panel">
        <div className="platform-admin-toolbar">
          <input className="filter-input" placeholder="Rechercher module, organisation, hotel..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <AppSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tous les statuts</option>
            {LICENSE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </AppSelect>
        </div>
      </section>

      {loading ? (
        <section className="list-panel"><SkeletonStackList count={5} /></section>
      ) : (
        <section className="platform-admin-section-grid">
          <section className="list-panel">
            {filteredLicenses.length ? (
              <div className="platform-admin-table-wrap">
                <table className="platform-admin-table">
                  <thead>
                    <tr>
                      <th>Licence</th>
                      <th>Cible</th>
                      <th>Statut</th>
                      <th>Expiration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLicenses.map((item) => (
                      <tr key={item.id} className={selectedLicense?.id === item.id ? "selected" : ""} onClick={() => setSelectedLicenseId(item.id)}>
                        <td><PlatformEntityCell name={item.module_name} sub={item.module_code} status={item.status} /></td>
                        <td>{item.hotel_name || item.organization_name || "-"}</td>
                        <td><PlatformBadge status={item.status} label={item.is_valid ? "Valide" : item.status} /></td>
                        <td>{item.ends_at ? new Date(item.ends_at).toLocaleDateString("fr-FR") : "Sans expiration"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <PlatformEmptyState icon={<IconEmpty />} title="Aucune licence trouvee" description="Creez une licence ou ajustez les filtres." />
            )}
          </section>

          <aside className="list-panel platform-admin-side-card">
            <div className="panel-head">
              <div>
                <h3>Fiche licence</h3>
                <p>Modifier, renouveler ou suspendre la licence selectionnee.</p>
              </div>
            </div>
            {selectedLicense ? (
              <>
                <LicenseForm
                  form={editForm}
                  modules={modules}
                  organizations={organizations}
                  hotels={hotels}
                  submitting={submitting}
                  onChange={(event) => handleLicenseFormChange(setEditForm, event)}
                  onSubmit={handleUpdate}
                  submitLabel="Enregistrer"
                />
                <div className="platform-admin-action-row">
                  <button type="button" className="ghost-button" onClick={handleRenew} disabled={submitting || !editForm.ends_at}>
                    Renouveler
                  </button>
                  <button type="button" className="danger-button" onClick={handleSuspend} disabled={submitting || selectedLicense.status === "suspended"}>
                    Suspendre
                  </button>
                </div>
              </>
            ) : (
              <PlatformEmptyState icon={<IconEmpty />} title="Aucune licence selectionnee" description="Selectionnez une licence pour consulter sa fiche." />
            )}
          </aside>
        </section>
      )}
    </div>
  );
}

function LicenseForm({ form, modules, organizations, hotels, submitting, onChange, onSubmit, submitLabel }) {
  return (
    <form className="platform-admin-grid-form" onSubmit={onSubmit}>
      <AppSelect name="module_id" value={form.module_id} onChange={onChange} disabled={submitting} required>
        <option value="">Module...</option>
        {modules.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </AppSelect>
      <AppSelect name="organization_id" value={form.organization_id} onChange={onChange} disabled={submitting || Boolean(form.hotel_id)}>
        <option value="">Organisation...</option>
        {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </AppSelect>
      <AppSelect name="hotel_id" value={form.hotel_id} onChange={onChange} disabled={submitting}>
        <option value="">Hotel...</option>
        {hotels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </AppSelect>
      <AppSelect name="status" value={form.status} onChange={onChange} disabled={submitting}>
        {LICENSE_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </AppSelect>
      <input className="filter-input" name="starts_at" type="datetime-local" value={form.starts_at} onChange={onChange} disabled={submitting} />
      <input className="filter-input" name="ends_at" type="datetime-local" value={form.ends_at} onChange={onChange} disabled={submitting} />
      <input className="filter-input" name="monthly_price" type="number" min="0" step="0.01" value={form.monthly_price} onChange={onChange} disabled={submitting} />
      <textarea className="filter-input platform-admin-textarea" name="notes" placeholder="Notes" value={form.notes} onChange={onChange} disabled={submitting} />
      <button type="submit" className="primary-button" disabled={submitting}>
        {submitting ? "Enregistrement..." : submitLabel}
      </button>
    </form>
  );
}
