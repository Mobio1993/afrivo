import { useEffect, useMemo, useState } from "react";

import { AppSelect } from "../../components/AppSelect";
import { listPlatformUsers } from "../../services/platformAdminService";
import { SkeletonTable } from "./PlatformAdminSkeletons";
import {
  PlatformNavTabs,
  PlatformBadge,
  PlatformEntityCell,
  PlatformEmptyState,
  IconEmptyUser,
} from "./PlatformAdminComponents";
import "./PlatformAdmin.css";

const SCOPE_OPTIONS = [
  { value: "all",      label: "Tous les admins" },
  { value: "platform", label: "Admins plateforme" },
  { value: "hotel",    label: "Admins hôtel" },
];

export function PlatformUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listPlatformUsers()
      .then((payload) => {
        setUsers(payload.results || []);
      })
      .catch((requestError) => {
        setError(requestError.message || "Impossible de charger les administrateurs.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((item) => {
      const matchesSearch =
        !term
        || [item.full_name, item.username, item.email, item.organization_name, item.hotel_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesScope = scopeFilter === "all" || item.admin_scope === scopeFilter;
      return matchesSearch && matchesScope;
    });
  }, [users, search, scopeFilter]);

  return (
    <div className="page-stack platform-admin-page">
      <section className="hero-panel">
        <span className="eyebrow">Plateforme</span>
        <h2>Administrateurs</h2>
        <p>Population admin plateforme et admins hotel, avec lecture du perimetre d’action et du rattachement.</p>
      </section>

      <PlatformNavTabs />

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
                          status={item.admin_scope === "platform" ? "platform" : (item.is_active ? "active" : "inactive")}
                        />
                      </td>
                      <td>
                        <PlatformBadge
                          status={item.admin_scope || "neutral"}
                          label={item.admin_scope === "platform" ? "Plateforme" : "Hôtel"}
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
    </div>
  );
}
