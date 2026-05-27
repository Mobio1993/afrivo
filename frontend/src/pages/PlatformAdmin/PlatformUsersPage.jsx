import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { AppSelect } from "../../shared/components/AppSelect";
import {
  createPosAccess,
  listPlatformHotels,
  listPlatformUsers,
  listPosAccesses,
  revokePosAccess,
  updatePosAccess,
} from "../../services/platformAdminService";
import { SkeletonTable } from "./PlatformAdminSkeletons";
import {
  PlatformBadge,
  PlatformEntityCell,
  PlatformEmptyState,
  IconEmptyUser,
} from "./PlatformAdminComponents";
import "./PlatformAdmin.css";

const PLATFORM_ORGANIZATIONS_UPDATED_EVENT = "afrivo:platform-organizations-updated";

const SCOPE_OPTIONS = [
  { value: "all",      label: "Tous les admins" },
  { value: "platform", label: "Admins plateforme" },
  { value: "organization", label: "Admins organisation" },
  { value: "hotel",    label: "Admins hôtel" },
];

const POS_ROLE_OPTIONS = [
  { value: "manager_restaurant", label: "Manager restaurant" },
  { value: "caissier", label: "Caissier" },
  { value: "serveur", label: "Serveur" },
  { value: "cuisinier", label: "Cuisinier" },
  { value: "barman", label: "Barman" },
];

function resolveAdminScope(user) {
  if (user.admin_scope === "platform" || user.is_platform_admin) return "platform";
  if (user.admin_scope === "organization" || (user.organization && !user.hotel)) return "organization";
  if (user.admin_scope === "hotel" || user.hotel) return "hotel";
  return user.admin_scope || "none";
}

function scopeLabel(scope) {
  if (scope === "platform") return "Plateforme";
  if (scope === "organization") return "Organisation";
  if (scope === "hotel") return "Hotel";
  return "Autre";
}

export function PlatformUsersPage() {
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hotels, setHotels] = useState([]);
  const [posAccesses, setPosAccesses] = useState([]);
  const [posSaving, setPosSaving] = useState(false);
  const [posError, setPosError] = useState("");
  const [posForm, setPosForm] = useState({
    user: "",
    hotel: "",
    pos_role: "serveur",
  });

  async function loadUsers() {
    setPosError("");
    const [usersPayload, hotelsPayload, posAccessResult] = await Promise.all([
      listPlatformUsers(),
      listPlatformHotels({ isActive: true }),
      listPosAccesses()
        .then((payload) => ({ ok: true, payload }))
        .catch((requestError) => ({ ok: false, error: requestError })),
    ]);
    setUsers(usersPayload.results || []);
    setHotels(hotelsPayload.results || []);
    if (posAccessResult.ok) {
      setPosAccesses(posAccessResult.payload.results || posAccessResult.payload || []);
    } else {
      setPosAccesses([]);
      setPosError(
        posAccessResult.error?.payload?.detail
          || posAccessResult.error?.message
          || "Impossible de charger les acces POS Restaurant.",
      );
    }
  }

  useEffect(() => {
    loadUsers()
      .catch((requestError) => {
        setError(requestError.message || "Impossible de charger les administrateurs.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    function handleOrganizationsUpdated() {
      loadUsers().catch((requestError) => {
        setError(requestError.message || "Impossible de rafraichir les administrateurs.");
      });
    }

    window.addEventListener(PLATFORM_ORGANIZATIONS_UPDATED_EVENT, handleOrganizationsUpdated);
    return () => {
      window.removeEventListener(PLATFORM_ORGANIZATIONS_UPDATED_EVENT, handleOrganizationsUpdated);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const scope = params.get("scope") || "";
    const create = params.get("create") === "1";
    if (q) setSearch(q);
    if (["platform", "organization", "hotel"].includes(scope)) setScopeFilter(scope);
    if (create) setScopeFilter("platform");
  }, [location.search]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((item) => {
      const matchesSearch =
        !term
        || [item.full_name, item.username, item.email, item.organization_name, item.hotel_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesScope = scopeFilter === "all" || resolveAdminScope(item) === scopeFilter;
      return matchesSearch && matchesScope;
    });
  }, [users, search, scopeFilter]);

  async function handleCreatePosAccess(event) {
    event.preventDefault();
    setPosError("");
    if (!posForm.user || !posForm.hotel || !posForm.pos_role) {
      setPosError("Utilisateur, hotel et role POS sont obligatoires.");
      return;
    }
    setPosSaving(true);
    try {
      await createPosAccess({
        user: Number(posForm.user),
        hotel: Number(posForm.hotel),
        pos_role: posForm.pos_role,
        is_active: true,
      });
      const payload = await listPosAccesses();
      setPosAccesses(payload.results || payload || []);
      setPosForm((current) => ({ ...current, user: "" }));
    } catch (requestError) {
      setPosError(requestError.payload?.detail || requestError.message || "Impossible de creer l'acces POS.");
    } finally {
      setPosSaving(false);
    }
  }

  async function handleToggleAccess(access) {
    setPosError("");
    try {
      const updated = await updatePosAccess(access.id, { is_active: !access.is_active });
      setPosAccesses((current) => current.map((item) => (item.id === access.id ? updated : item)));
    } catch (requestError) {
      setPosError(requestError.payload?.detail || requestError.message || "Impossible de modifier l'acces POS.");
    }
  }

  async function handleRevokeAccess(access) {
    setPosError("");
    try {
      await revokePosAccess(access.id);
      setPosAccesses((current) => current.filter((item) => item.id !== access.id));
    } catch (requestError) {
      setPosError(requestError.payload?.detail || requestError.message || "Impossible de revoquer l'acces POS.");
    }
  }

  return (
    <div className="page-stack platform-admin-page">
      <section className="list-panel">
        <div className="platform-admin-toolbar">
          <input
            className="filter-input"
            placeholder="Rechercher par nom, username, email ou hotel"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <AppSelect value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </div>
      </section>

      {loading ? (
        <section className="list-panel">
          <SkeletonTable rows={7} cols={6} />
        </section>
      ) : null}
      {error ? <div className="alert-box">{error}</div> : null}

      {!loading && !error ? (
        <section className="list-panel">
          {filteredUsers.length ? (
            <div className="platform-admin-table-wrap">
              <table className="platform-admin-table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Perimetre</th>
                    <th>Role</th>
                    <th>Organisation</th>
                    <th>Hotel</th>
                    <th>Etat</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <PlatformEntityCell
                          name={item.full_name || item.username}
                          sub={`${item.username}${item.email ? ` · ${item.email}` : ""}`}
                          status={resolveAdminScope(item) === "platform" ? "platform" : (item.is_active ? "active" : "inactive")}
                        />
                      </td>
                      <td>
                        <PlatformBadge
                          status={resolveAdminScope(item) || "neutral"}
                          label={scopeLabel(resolveAdminScope(item))}
                        />
                      </td>
                      <td>{item.role_label || item.role || "—"}</td>
                      <td>{item.organization_name || "—"}</td>
                      <td>{item.hotel_name || "—"}</td>
                      <td>
                        <PlatformBadge
                          status={item.is_active ? "active" : "inactive"}
                          label={item.is_active ? "Actif" : "Inactif"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <PlatformEmptyState
              icon={<IconEmptyUser />}
              title="Aucun administrateur trouvé"
              description="Ajustez le filtre pour retrouver un profil de supervision."
            />
          )}
        </section>
      ) : null}

      {!loading && !error ? (
        <section className="list-panel">
          <div className="platform-admin-section-head">
            <div>
              <h3>Acces POS Restaurant</h3>
              <p>Attribuez un role POS a un utilisateur existant, limite a un hotel.</p>
            </div>
          </div>

          <form className="platform-admin-pos-form" onSubmit={handleCreatePosAccess}>
            <input
              className="filter-input"
              type="number"
              min="1"
              placeholder="ID utilisateur"
              value={posForm.user}
              onChange={(event) => setPosForm((current) => ({ ...current, user: event.target.value }))}
            />
            <AppSelect value={posForm.hotel} onChange={(event) => setPosForm((current) => ({ ...current, hotel: event.target.value }))}>
              <option value="">Hotel</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name || hotel.nom || `Hotel #${hotel.id}`}
                </option>
              ))}
            </AppSelect>
            <AppSelect
              value={posForm.pos_role}
              onChange={(event) => setPosForm((current) => ({ ...current, pos_role: event.target.value }))}
            >
              {POS_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
            <button className="primary-button" type="submit" disabled={posSaving}>
              {posSaving ? "Creation..." : "Creer l'acces POS"}
            </button>
          </form>

          {posError ? <div className="alert-box">{posError}</div> : null}

          {posAccesses.length ? (
            <div className="platform-admin-table-wrap">
              <table className="platform-admin-table">
                <thead>
                  <tr>
                    <th>Utilisateur POS</th>
                    <th>Hotel</th>
                    <th>Role POS</th>
                    <th>Etat</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posAccesses.map((access) => (
                    <tr key={access.id}>
                      <td>
                        <PlatformEntityCell
                          name={access.user_full_name || access.user_username}
                          sub={`${access.user_username || ""}${access.user_email ? ` · ${access.user_email}` : ""}`}
                          status={access.is_active ? "active" : "inactive"}
                        />
                      </td>
                      <td>{access.hotel_name || "—"}</td>
                      <td>{access.pos_role_display || access.pos_role}</td>
                      <td>
                        <PlatformBadge status={access.is_active ? "active" : "inactive"} label={access.is_active ? "Actif" : "Inactif"} />
                      </td>
                      <td>
                        <div className="platform-admin-row-actions">
                          <button type="button" className="platform-admin-inline-link" onClick={() => handleToggleAccess(access)}>
                            {access.is_active ? "Desactiver" : "Activer"}
                          </button>
                          <button type="button" className="danger-button" onClick={() => handleRevokeAccess(access)}>
                            Revoquer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <PlatformEmptyState
              icon={<IconEmptyUser />}
              title="Aucun acces POS cree"
              description="Creez un premier acces pour autoriser un utilisateur a ouvrir le POS Restaurant."
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
