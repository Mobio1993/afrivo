import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { SrBadge, SuperRootPageShell, SuperRootState } from "../shared/SuperRootShared";
import { superRootUsersApi } from "./superRootUsersApi";

const INITIAL_FORM = {
  admin_scope: "platform",
  organization_id: "",
  hotel_id: "",
  username: "",
  password: "",
  password_confirm: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

const WEAK_PASSWORD_TERMS = ["password", "admin", "afrivo", "123456"];

function buildPasswordChecks(password, username) {
  const normalizedPassword = String(password || "");
  const lowerPassword = normalizedPassword.toLowerCase();
  const lowerUsername = String(username || "").trim().toLowerCase();

  return [
    {
      id: "length",
      label: "8 caracteres minimum",
      valid: normalizedPassword.length >= 8,
    },
    {
      id: "uppercase",
      label: "Au moins 1 majuscule",
      valid: /[A-Z]/.test(normalizedPassword),
    },
    {
      id: "lowercase",
      label: "Au moins 1 minuscule",
      valid: /[a-z]/.test(normalizedPassword),
    },
    {
      id: "digit",
      label: "Au moins 1 chiffre",
      valid: /\d/.test(normalizedPassword),
    },
    {
      id: "special",
      label: "Au moins 1 caractere special",
      valid: /[^A-Za-z0-9]/.test(normalizedPassword),
    },
    {
      id: "username",
      label: "Ne contient pas le username",
      valid: !lowerUsername || !lowerPassword.includes(lowerUsername),
    },
    {
      id: "weak_terms",
      label: "Pas de mot faible: password, admin, afrivo, 123456",
      valid: !WEAK_PASSWORD_TERMS.some((term) => lowerPassword.includes(term)),
    },
  ];
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

function resolveAdminScope(user) {
  if (user.admin_scope === "platform" || user.is_platform_admin) return "platform";
  if (user.admin_scope === "organization" || (user.organization && !user.hotel)) return "organization";
  if (user.admin_scope === "hotel" || user.hotel) return "hotel";
  return user.admin_scope || "none";
}

function adminScopeLabel(scope) {
  if (scope === "platform") return "Admin Plateforme";
  if (scope === "organization") return "Admin Organisation";
  if (scope === "hotel") return "Admin Hotel";
  return "Admin";
}

export function SuperRootUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function loadUsers() {
    setError("");
    const [payload, orgPayload, hotelPayload] = await Promise.all([
      superRootUsersApi.listPlatformAdmins(),
      superRootUsersApi.listOrganizations(),
      superRootUsersApi.listHotels(),
    ]);
    setUsers(payload.results || []);
    setOrganizations(orgPayload.organizations || []);
    setHotels(hotelPayload.hotels || hotelPayload.results || []);
  }

  useEffect(() => {
    loadUsers()
      .catch((requestError) => {
        setError(getErrorMessage(requestError, "Impossible de charger les administrateurs plateforme."));
      })
      .finally(() => setLoading(false));
  }, []);

  const platformAdmins = useMemo(
    () => users.filter((user) => resolveAdminScope(user) === "platform"),
    [users],
  );

  const organizationAdmins = useMemo(
    () => users.filter((user) => resolveAdminScope(user) === "organization"),
    [users],
  );

  const hotelAdmins = useMemo(
    () => users.filter((user) => resolveAdminScope(user) === "hotel"),
    [users],
  );

  const selectedHotel = useMemo(
    () => hotels.find((hotel) => String(hotel.id) === String(form.hotel_id)),
    [hotels, form.hotel_id],
  );

  const filteredPlatformAdmins = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return platformAdmins;
    return platformAdmins.filter((user) => (
      [user.full_name, user.username, user.email, user.role_label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    ));
  }, [platformAdmins, search]);

  const filteredOrganizationAdmins = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return organizationAdmins;
    return organizationAdmins.filter((user) => (
      [user.full_name, user.username, user.email, user.organization_name, user.role_label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    ));
  }, [organizationAdmins, search]);

  const filteredHotelAdmins = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return hotelAdmins;
    return hotelAdmins.filter((user) => (
      [user.full_name, user.username, user.email, user.organization_name, user.hotel_name, user.role_label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    ));
  }, [hotelAdmins, search]);

  const passwordChecks = useMemo(
    () => buildPasswordChecks(form.password, form.username),
    [form.password, form.username],
  );
  const passwordIsStrong = passwordChecks.every((check) => check.valid);
  const passwordConfirmationOk = Boolean(form.password) && form.password === form.password_confirm;

  function setField(field, value) {
    setForm((current) => {
      if (field === "admin_scope") {
        return {
          ...current,
          admin_scope: value,
          organization_id: value === "organization" ? current.organization_id : "",
          hotel_id: value === "hotel" ? current.hotel_id : "",
        };
      }
      return { ...current, [field]: value };
    });
    setFormError("");
  }

  function validateForm() {
    if (!form.username.trim()) return "Le username est obligatoire.";
    if (form.admin_scope === "organization" && !form.organization_id) {
      return "Selectionne l'organisation rattachee a cet Admin Organisation.";
    }
    if (form.admin_scope === "hotel" && !form.hotel_id) {
      return "Selectionne l'hotel rattache a cet Admin Hotel.";
    }
    if (!form.password) return "Le mot de passe est obligatoire.";
    if (!passwordIsStrong) return "Le mot de passe ne respecte pas toutes les exigences de securite.";
    if (form.password !== form.password_confirm) return "Les mots de passe ne correspondent pas.";
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
        username: form.username.trim(),
        password: form.password,
        admin_scope: form.admin_scope,
        ...(form.admin_scope === "organization" ? { organization_id: Number(form.organization_id) } : {}),
        ...(form.admin_scope === "hotel" ? { hotel_id: Number(form.hotel_id) } : {}),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      };
      const result = form.admin_scope === "organization"
        ? await superRootUsersApi.createOrganizationAdmin(payload)
        : form.admin_scope === "hotel"
          ? await superRootUsersApi.createHotelAdmin(payload)
          : await superRootUsersApi.createPlatformAdmin(payload);
      setUsers((current) => [result.user, ...current.filter((user) => user.id !== result.user?.id)]);
      setForm(INITIAL_FORM);
      setShowCreate(false);
      setFeedback(`${adminScopeLabel(form.admin_scope)} cree : ${result.user?.username || payload.username}`);
    } catch (requestError) {
      setFormError(getErrorMessage(requestError, "Creation de l'admin plateforme impossible."));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user) {
    const nextActive = !user.is_active;
    const scopeLabel = adminScopeLabel(resolveAdminScope(user));
    if (!nextActive) {
      const confirmed = window.confirm(
        `Desactiver ${scopeLabel} ${user.username} ? Il ne pourra plus se connecter tant qu'il reste inactif.`,
      );
      if (!confirmed) return;
    }

    setStatusBusyId(user.id);
    setFeedback("");
    setError("");
    try {
      const result = nextActive
        ? await superRootUsersApi.activatePlatformAdmin(user.id)
        : await superRootUsersApi.deactivatePlatformAdmin(user.id);
      const updatedUser = result.user || { ...user, is_active: nextActive };
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, ...updatedUser } : item)));
      setFeedback(`${updatedUser.username || user.username} ${nextActive ? "active" : "desactive"}.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Impossible de modifier le statut de cet administrateur."));
    } finally {
      setStatusBusyId(null);
    }
  }

  function openPlatformUsers() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (form.admin_scope) params.set("scope", form.admin_scope);
    navigate(`/platform/users${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <SuperRootPageShell
      title="Utilisateurs Super Root"
      subtitle="Creation et supervision des administrateurs plateforme AFRIVO."
      actions={(
        <>
          <button className="sr-btn sr-btn-outline" type="button" onClick={openPlatformUsers}>
            Admin Plateforme
          </button>
          <button className="sr-btn sr-btn-outline" type="button" onClick={() => loadUsers()}>
            Actualiser
          </button>
          <button className="sr-btn" type="button" onClick={() => setShowCreate((value) => !value)}>
            {showCreate ? "Fermer" : "Creer un admin"}
          </button>
        </>
      )}
    >
      <SuperRootState loading={loading} error={error}>
        {feedback ? <div className="sr-state sr-users-feedback">{feedback}</div> : null}

        <div className="sr-users-kpis">
          <div className="sr-users-kpi">
            <span>Admins plateforme</span>
            <strong>{platformAdmins.length}</strong>
          </div>
          <div className="sr-users-kpi">
            <span>Admins organisation</span>
            <strong>{organizationAdmins.length}</strong>
          </div>
          <div className="sr-users-kpi">
            <span>Admins hotel</span>
            <strong>{hotelAdmins.length}</strong>
          </div>
          <div className="sr-users-kpi">
            <span>Actifs</span>
            <strong>{[...platformAdmins, ...organizationAdmins, ...hotelAdmins].filter((user) => user.is_active).length}</strong>
          </div>
          <div className="sr-users-kpi">
            <span>Inactifs</span>
            <strong>{[...platformAdmins, ...organizationAdmins, ...hotelAdmins].filter((user) => !user.is_active).length}</strong>
          </div>
        </div>

        {showCreate ? (
          <section className="sr-users-card">
            <div className="sr-users-card-head">
              <div>
                <span>Creation securisee</span>
                <h2>{form.admin_scope === "organization" ? "Nouvel Admin Organisation" : form.admin_scope === "hotel" ? "Nouvel Admin Hotel" : "Nouvel Admin Plateforme"}</h2>
              </div>
              <SrBadge tone="ok">Super Root</SrBadge>
            </div>

            <form className="sr-users-form" onSubmit={handleCreate}>
              <label>
                <span>Type d'admin *</span>
                <select
                  className="sr-input"
                  value={form.admin_scope}
                  onChange={(event) => setField("admin_scope", event.target.value)}
                >
                  <option value="platform">Admin Plateforme</option>
                  <option value="organization">Admin Organisation</option>
                  <option value="hotel">Admin Hotel</option>
                </select>
              </label>
              {form.admin_scope === "organization" ? (
                <label>
                  <span>Organisation *</span>
                  <select
                    className="sr-input"
                    value={form.organization_id}
                    onChange={(event) => setField("organization_id", event.target.value)}
                  >
                    <option value="">Selectionner une organisation</option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                  {selectedHotel ? (
                    <small className="sr-users-field-note">
                      Organisation rattachee automatiquement : {selectedHotel.organization_name || selectedHotel.organization?.name || "-"}
                    </small>
                  ) : null}
                </label>
              ) : null}
              {form.admin_scope === "hotel" ? (
                <label>
                  <span>Hotel *</span>
                  <select
                    className="sr-input"
                    value={form.hotel_id}
                    onChange={(event) => setField("hotel_id", event.target.value)}
                  >
                    <option value="">Selectionner un hotel</option>
                    {hotels.map((hotel) => (
                      <option key={hotel.id} value={hotel.id}>
                        {hotel.name || hotel.nom} {hotel.organization_name ? `- ${hotel.organization_name}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                <span>Username *</span>
                <input
                  className="sr-input"
                  value={form.username}
                  onChange={(event) => setField("username", event.target.value)}
                  placeholder="ex. adminPlatform"
                />
              </label>
              <label>
                <span>Mot de passe *</span>
                <input
                  className="sr-input"
                  type="password"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                  placeholder="Minimum 8 caracteres forts"
                />
              </label>
              <label>
                <span>Confirmer *</span>
                <input
                  className="sr-input"
                  type="password"
                  value={form.password_confirm}
                  onChange={(event) => setField("password_confirm", event.target.value)}
                  placeholder="Confirmation"
                />
              </label>
              <div className="sr-users-password-policy" aria-live="polite">
                <div className="sr-users-password-head">
                  <span>Mot de passe admin</span>
                  <strong className={passwordIsStrong && passwordConfirmationOk ? "is-strong" : "is-weak"}>
                    {passwordIsStrong && passwordConfirmationOk ? "Fort" : "A renforcer"}
                  </strong>
                </div>
                <div className="sr-users-password-grid">
                  {passwordChecks.map((check) => (
                    <div className={`sr-users-password-check ${check.valid ? "is-valid" : ""}`} key={check.id}>
                      <i className={`ti ${check.valid ? "ti-circle-check" : "ti-circle"}`} aria-hidden="true" />
                      {check.label}
                    </div>
                  ))}
                  <div className={`sr-users-password-check ${passwordConfirmationOk ? "is-valid" : ""}`}>
                    <i className={`ti ${passwordConfirmationOk ? "ti-circle-check" : "ti-circle"}`} aria-hidden="true" />
                    Confirmation identique
                  </div>
                </div>
              </div>
              <label>
                <span>Prenom</span>
                <input className="sr-input" value={form.first_name} onChange={(event) => setField("first_name", event.target.value)} />
              </label>
              <label>
                <span>Nom</span>
                <input className="sr-input" value={form.last_name} onChange={(event) => setField("last_name", event.target.value)} />
              </label>
              <label>
                <span>Email</span>
                <input className="sr-input" type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} />
              </label>
              <label>
                <span>Telephone</span>
                <input className="sr-input" value={form.phone} onChange={(event) => setField("phone", event.target.value)} />
              </label>

              {formError ? <div className="sr-error sr-users-form-error">{formError}</div> : null}

              <div className="sr-users-form-actions">
                <button className="sr-btn sr-btn-outline" type="button" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
                <button className="sr-btn" type="submit" disabled={saving || !passwordIsStrong || !passwordConfirmationOk}>
                  {saving ? "Creation..." : "Creer l'admin"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="sr-users-card">
          <div className="sr-users-card-head">
            <div>
              <span>IAM Plateforme</span>
              <h2>Admins Plateforme</h2>
            </div>
            <input
              className="sr-input sr-users-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher username, email..."
            />
          </div>

          {filteredPlatformAdmins.length ? (
            <div className="sr-table-wrap">
              <table className="sr-table sr-users-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Role</th>
                    <th>Statut</th>
                    <th>Staff</th>
                    <th>Creation</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlatformAdmins.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="sr-users-person">
                          <strong>{user.full_name || user.username}</strong>
                          <span>{user.username}{user.email ? ` / ${user.email}` : ""}</span>
                        </div>
                      </td>
                      <td>{user.role_label || "Admin Plateforme"}</td>
                      <td>
                        <SrBadge tone={user.is_active ? "ok" : "danger"}>
                          {user.is_active ? "Actif" : "Inactif"}
                        </SrBadge>
                      </td>
                      <td>{user.is_staff ? "Oui" : "Non"}</td>
                      <td>{formatDate(user.date_joined)}</td>
                      <td>
                        <button
                          className={`sr-users-status-btn ${user.is_active ? "is-danger" : "is-success"}`}
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={statusBusyId === user.id}
                        >
                          {statusBusyId === user.id
                            ? "..."
                            : user.is_active
                              ? "Desactiver"
                              : "Activer"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sr-empty">Aucun admin plateforme trouve.</div>
          )}
        </section>

        <section className="sr-users-card">
          <div className="sr-users-card-head">
            <div>
              <span>IAM Organisation</span>
              <h2>Admins Organisation</h2>
            </div>
            <SrBadge tone="ok">{organizationAdmins.length}</SrBadge>
          </div>

          {filteredOrganizationAdmins.length ? (
            <div className="sr-table-wrap">
              <table className="sr-table sr-users-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Organisation</th>
                    <th>Statut</th>
                    <th>Staff</th>
                    <th>Creation</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrganizationAdmins.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="sr-users-person">
                          <strong>{user.full_name || user.username}</strong>
                          <span>{user.username}{user.email ? ` / ${user.email}` : ""}</span>
                        </div>
                      </td>
                      <td>{user.organization_name || "-"}</td>
                      <td>
                        <SrBadge tone={user.is_active ? "ok" : "danger"}>
                          {user.is_active ? "Actif" : "Inactif"}
                        </SrBadge>
                      </td>
                      <td>{user.is_staff ? "Oui" : "Non"}</td>
                      <td>{formatDate(user.date_joined)}</td>
                      <td>
                        <button
                          className={`sr-users-status-btn ${user.is_active ? "is-danger" : "is-success"}`}
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={statusBusyId === user.id}
                        >
                          {statusBusyId === user.id
                            ? "..."
                            : user.is_active
                              ? "Desactiver"
                              : "Activer"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sr-empty">Aucun admin organisation trouve.</div>
          )}
        </section>

        <section className="sr-users-card">
          <div className="sr-users-card-head">
            <div>
              <span>IAM Hotel</span>
              <h2>Admins Hotel</h2>
            </div>
            <SrBadge tone="ok">{hotelAdmins.length}</SrBadge>
          </div>

          {filteredHotelAdmins.length ? (
            <div className="sr-table-wrap">
              <table className="sr-table sr-users-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Hotel</th>
                    <th>Organisation</th>
                    <th>Statut</th>
                    <th>Staff</th>
                    <th>Creation</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHotelAdmins.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="sr-users-person">
                          <strong>{user.full_name || user.username}</strong>
                          <span>{user.username}{user.email ? ` / ${user.email}` : ""}</span>
                        </div>
                      </td>
                      <td>{user.hotel_name || "-"}</td>
                      <td>{user.organization_name || "-"}</td>
                      <td>
                        <SrBadge tone={user.is_active ? "ok" : "danger"}>
                          {user.is_active ? "Actif" : "Inactif"}
                        </SrBadge>
                      </td>
                      <td>{user.is_staff ? "Oui" : "Non"}</td>
                      <td>{formatDate(user.date_joined)}</td>
                      <td>
                        <button
                          className={`sr-users-status-btn ${user.is_active ? "is-danger" : "is-success"}`}
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={statusBusyId === user.id}
                        >
                          {statusBusyId === user.id
                            ? "..."
                            : user.is_active
                              ? "Desactiver"
                              : "Activer"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sr-empty">Aucun admin hotel trouve.</div>
          )}
        </section>
      </SuperRootState>
    </SuperRootPageShell>
  );
}
