import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { hasPermission } from "../../auth/permissions";
import { AppSelect } from "../../components/AppSelect";
import { ConfirmModal } from "../../components/ConfirmModal";
import { createUser, deactivateUser, listUsers, updateUser } from "../../services/usersService";
import "./UsersPage.css";

const USER_ROLE_OPTIONS = [
  { value: "admin", label: "Administrateur" },
  { value: "reception", label: "Reception" },
  { value: "cashier", label: "Caissier" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "manager", label: "Manager" },
  { value: "restaurant", label: "Restaurant" },
];

const USER_STATUS_OPTIONS = [
  { value: "all", label: "Tous les statuts" },
  { value: "active", label: "Actifs" },
  { value: "inactive", label: "Desactives" },
];

const EMPTY_FORM = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "reception",
  is_active: true,
};

function SummaryCard({ label, value, meta }) {
  return (
    <article className="info-card users-summary-card">
      <strong>{label}</strong>
      <div className="metric">{value}</div>
      <p>{meta}</p>
    </article>
  );
}

function UserForm({ mode, form, errors, submitting, canManageUsers, onChange, onSubmit, onCancel }) {
  const isCreateMode = mode === "create";

  return (
    <form className="users-form-card" onSubmit={onSubmit}>
      <div className="users-form-grid">
        <label className="users-field">
          <span>Nom d'utilisateur</span>
          <input name="username" value={form.username} onChange={onChange} disabled={!canManageUsers || submitting} />
          {errors.username ? <small>{errors.username.join(" ")}</small> : null}
        </label>

        <label className="users-field">
          <span>Role</span>
          <AppSelect name="role" value={form.role} onChange={onChange} disabled={!canManageUsers || submitting}>
            {USER_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
          {errors.role ? <small>{errors.role.join(" ")}</small> : null}
        </label>

        <label className="users-field">
          <span>Prenom</span>
          <input name="first_name" value={form.first_name} onChange={onChange} disabled={!canManageUsers || submitting} />
          {errors.first_name ? <small>{errors.first_name.join(" ")}</small> : null}
        </label>

        <label className="users-field">
          <span>Nom</span>
          <input name="last_name" value={form.last_name} onChange={onChange} disabled={!canManageUsers || submitting} />
          {errors.last_name ? <small>{errors.last_name.join(" ")}</small> : null}
        </label>

        <label className="users-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            disabled={!canManageUsers || submitting}
          />
          {errors.email ? <small>{errors.email.join(" ")}</small> : null}
        </label>

        <label className="users-field">
          <span>Telephone</span>
          <input name="phone" value={form.phone} onChange={onChange} disabled={!canManageUsers || submitting} />
          {errors.phone ? <small>{errors.phone.join(" ")}</small> : null}
        </label>

        <label className="users-field users-field--full">
          <span>{isCreateMode ? "Mot de passe" : "Nouveau mot de passe"}</span>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            disabled={!canManageUsers || submitting}
            placeholder={isCreateMode ? "Mot de passe initial" : "Laisser vide pour conserver l'actuel"}
          />
          {errors.password ? <small>{errors.password.join(" ")}</small> : null}
        </label>
      </div>

      <div className="users-form-actions">
        <button type="submit" className="primary-button" disabled={!canManageUsers || submitting}>
          {submitting ? "Enregistrement..." : isCreateMode ? "Creer l'utilisateur" : "Mettre a jour"}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={submitting}>
          Annuler
        </button>
      </div>
    </form>
  );
}

export function UsersPage() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mode, setMode] = useState("view");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ error: "", success: "" });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const canManageUsers = hasPermission(authUser, "users", "manage");

  function syncForm(targetUser = null) {
    setForm(
      targetUser
        ? {
            username: targetUser.username || "",
            password: "",
            first_name: targetUser.first_name || "",
            last_name: targetUser.last_name || "",
            email: targetUser.email || "",
            phone: targetUser.phone || "",
            role: targetUser.role || "reception",
            is_active: targetUser.is_active ?? true,
          }
        : EMPTY_FORM,
    );
    setFormErrors({});
  }

  async function loadUsers(preferredUserId = selectedUserId) {
    const payload = await listUsers();
    const items = Array.isArray(payload) ? payload : payload.results || [];
    setUsers(items);

    if (!items.length) {
      setSelectedUserId(null);
      return;
    }

    const targetId =
      preferredUserId && items.some((item) => item.id === preferredUserId) ? preferredUserId : items[0].id;
    setSelectedUserId(targetId);
  }

  useEffect(() => {
    loadUsers()
      .catch((error) => {
        setStatus({ error: error.message || "Impossible de charger les utilisateurs.", success: "" });
      })
      .finally(() => setLoading(false));
  }, []);

  // Drawer — body lock + Escape
  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === "Escape" && !submitting && !showConfirmModal) setIsDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, submitting, showConfirmModal]);

  function openDrawer() { setIsDrawerOpen(true); }
  function closeDrawer() { if (submitting || showConfirmModal) return; setIsDrawerOpen(false); }

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((item) => {
      const matchesSearch =
        !term ||
        [
          item.username,
          item.first_name,
          item.last_name,
          item.email,
          item.phone,
          item.role_label,
          item.organization_name,
          item.hotel_name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const matchesRole = roleFilter === "all" || item.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? item.is_active : !item.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const selectedUser = useMemo(
    () =>
      filteredUsers.find((item) => item.id === selectedUserId) ||
      users.find((item) => item.id === selectedUserId) ||
      null,
    [filteredUsers, selectedUserId, users],
  );

  const summaryCards = useMemo(() => {
    const activeUsers = users.filter((item) => item.is_active).length;
    const inactiveUsers = users.filter((item) => !item.is_active).length;
    const adminUsers = users.filter((item) => item.role === "admin").length;

    return [
      {
        label: "Utilisateurs total",
        value: users.length,
        meta: "Population retournee par l'API selon votre perimetre courant.",
      },
      {
        label: "Actifs",
        value: activeUsers,
        meta: `${inactiveUsers} compte(s) desactive(s).`,
      },
      {
        label: "Administrateurs",
        value: adminUsers,
        meta: "Comptes avec droits complets sur la gestion utilisateur.",
      },
    ];
  }, [users]);

  const roleSegments = useMemo(
    () =>
      USER_ROLE_OPTIONS.map((roleOption) => ({
        ...roleOption,
        count: users.filter((item) => item.role === roleOption.value).length,
      })),
    [users],
  );

  function handleSelectUser(userId) {
    const targetUser = users.find((item) => item.id === userId) || null;
    setSelectedUserId(userId);
    setMode("view");
    syncForm(targetUser);
    setStatus((previous) => ({ ...previous, error: "" }));
    openDrawer();
  }

  function handleStartCreate() {
    if (!canManageUsers) {
      return;
    }
    setMode("create");
    setSelectedUserId(null);
    syncForm(null);
    setStatus({ error: "", success: "" });
    openDrawer();
  }

  function handleStartEdit() {
    if (!selectedUser || !canManageUsers) return;
    setMode("edit");
    syncForm(selectedUser);
    setStatus({ error: "", success: "" });
  }

  function handleCancel() {
    setMode("view");
    syncForm(selectedUser);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canManageUsers) {
      return;
    }

    setSubmitting(true);
    setFormErrors({});
    setStatus({ error: "", success: "" });

    const payload = {
      username: form.username,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      is_active: form.is_active,
    };
    if (form.password) {
      payload.password = form.password;
    }

    try {
      let savedUser;
      if (mode === "create") {
        savedUser = await createUser(payload);
        setStatus({ error: "", success: "Utilisateur créé avec succès." });
      } else {
        savedUser = await updateUser(selectedUser.id, payload);
        setStatus({ error: "", success: "Utilisateur mis à jour avec succès." });
      }
      await loadUsers(savedUser.id);
      setMode("view");
      syncForm(savedUser);
    } catch (error) {
      setFormErrors(error.payload || {});
      setStatus({ error: error.message || "Opération impossible.", success: "" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!canManageUsers || !selectedUser) return;
    setShowConfirmModal(true);
  }

  async function confirmDeactivate() {
    setSubmitting(true);
    setStatus({ error: "", success: "" });
    try {
      await deactivateUser(selectedUser.id);
      await loadUsers(selectedUser.id);
      setMode("view");
      setShowConfirmModal(false);
      setStatus({ error: "", success: "Utilisateur désactivé avec succès." });
    } catch (error) {
      setStatus({ error: error.message || "Désactivation impossible.", success: "" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack users-page">
      <section className="dashboard-hero">
        <div className="section-head">
          <div>
            <span className="eyebrow">Administration</span>
            <h2>Utilisateurs et rôles métier</h2>
            <p>
              Gérez les comptes internes, leur rôle opérationnel et leur statut d'activation
              sans perturber l'authentification existante.
            </p>
          </div>
        </div>
      </section>

      {loading ? <div className="status-box">Chargement des utilisateurs...</div> : null}
      {status.error ? <div className="alert-box">{status.error}</div> : null}
      {status.success ? <div className="success-box">{status.success}</div> : null}

      <section className="card-grid users-summary-grid">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} label={card.label} value={card.value} meta={card.meta} />
        ))}
      </section>

      {/* ── Liste pleine largeur ── */}
      <section className="list-panel users-list-panel">
        <div className="panel-head">
          <div>
            <h3>Répertoire utilisateurs</h3>
            <p>
              {canManageUsers
                ? "Création, mise à jour et suivi des comptes internes."
                : "Lecture seule de votre profil utilisateur."}
            </p>
          </div>
          {canManageUsers ? (
            <button type="button" className="primary-button" onClick={handleStartCreate}>
              Nouvel utilisateur
            </button>
          ) : null}
        </div>

        <div className="users-toolbar">
          <input
            type="search"
            className="filter-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Username, nom, email, rôle..."
          />
          <AppSelect value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} name="role_filter">
            <option value="all">Tous les rôles</option>
            {USER_ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </AppSelect>
          <AppSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} name="status_filter">
            {USER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </AppSelect>
        </div>

        <div className="users-segments">
          {roleSegments.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`users-segment ${roleFilter === item.value ? "active" : ""}`}
              onClick={() => setRoleFilter((c) => (c === item.value ? "all" : item.value))}
            >
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </button>
          ))}
        </div>

        <div className="table-like">
          {filteredUsers.length ? (
            filteredUsers.map((item) => (
              <div
                key={item.id}
                className={`table-card users-list-row users-list-row--${item.role} ${selectedUser?.id === item.id ? "active" : ""}`}
              >
                <div className="users-list-row__top">
                  <strong>
                    {item.first_name || item.last_name
                      ? `${item.first_name || ""} ${item.last_name || ""}`.trim()
                      : item.username}
                  </strong>
                  <div className="users-list-row__right">
                    <span className={`users-role-badge users-role-badge--${item.role} ${item.is_active ? "active" : "inactive"}`}>
                      {item.role_label || item.role}
                    </span>
                    <button
                      type="button"
                      className="users-row-action-btn"
                      onClick={() => handleSelectUser(item.id)}
                      aria-label={`Voir le profil de ${item.first_name || item.username}`}
                    >
                      Voir profil
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 8h10M9 4l4 4-4 4" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p>{item.username}</p>
                <small>{item.hotel_name || "-"}</small>
              </div>
            ))
          ) : (
            <article className="table-card users-empty-card">
              <strong>Aucun utilisateur trouvé</strong>
              <p>Le filtre actuel ne retourne aucun compte.</p>
            </article>
          )}
        </div>
      </section>

      {/* ── Drawer universel ── */}
      {isDrawerOpen ? (
        <div
          className="users-drawer-overlay"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeDrawer(); }}
        >
          <div
            className="users-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={mode === "create" ? "Nouvel utilisateur" : "Profil utilisateur"}
          >
            {/* Drawer head */}
            <div className="users-drawer-head">
              <div className="users-drawer-copy">
                <span className="eyebrow dark">
                  {mode === "create" ? "Nouvel utilisateur" : mode === "edit" ? "Modifier" : "Profil utilisateur"}
                </span>
                <strong>
                  {mode === "create"
                    ? "Créer un compte"
                    : selectedUser
                      ? `${selectedUser.first_name || ""} ${selectedUser.last_name || ""}`.trim() || selectedUser.username
                      : "Détail utilisateur"}
                </strong>
              </div>
              <button
                type="button"
                className="ghost-button light users-drawer-close"
                onClick={closeDrawer}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            {/* Drawer body */}
            <div className="users-drawer-body">
              {/* Actions bar (mode view) */}
              {mode === "view" && selectedUser && canManageUsers ? (
                <div className="users-drawer-actions-bar">
                  <button type="button" className="secondary-button" onClick={handleStartEdit}>
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="secondary-button danger"
                    onClick={handleDeactivate}
                    disabled={submitting || !selectedUser.is_active}
                  >
                    Désactiver
                  </button>
                </div>
              ) : null}

              {/* Form or profile */}
              {mode === "create" || mode === "edit" ? (
                <UserForm
                  mode={mode}
                  form={form}
                  errors={formErrors}
                  submitting={submitting}
                  canManageUsers={canManageUsers}
                  onChange={handleChange}
                  onSubmit={handleSubmit}
                  onCancel={handleCancel}
                />
              ) : selectedUser ? (
                <div className="table-like">
                  <article className="table-card users-profile-card">
                    <div className="table-row">
                      <strong>Nom complet</strong>
                      <span>{`${selectedUser.first_name || ""} ${selectedUser.last_name || ""}`.trim() || "-"}</span>
                    </div>
                    <div className="table-row">
                      <strong>Username</strong>
                      <span>{selectedUser.username}</span>
                    </div>
                    <div className="table-row">
                      <strong>Rôle</strong>
                      <span>{selectedUser.role_label || selectedUser.role}</span>
                    </div>
                    <div className="table-row">
                      <strong>Email</strong>
                      <span>{selectedUser.email || "-"}</span>
                    </div>
                    <div className="table-row">
                      <strong>Téléphone</strong>
                      <span>{selectedUser.phone || "-"}</span>
                    </div>
                    <div className="table-row">
                      <strong>Organisation</strong>
                      <span>{selectedUser.organization_name || "-"}</span>
                    </div>
                    <div className="table-row">
                      <strong>Hôtel</strong>
                      <span>{selectedUser.hotel_name || "-"}</span>
                    </div>
                    <div className="table-row">
                      <strong>Statut</strong>
                      <span>{selectedUser.is_active ? "Actif" : "Désactivé"}</span>
                    </div>
                  </article>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Confirm modal désactivation ── */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title="Désactiver ce compte ?"
        message={
          selectedUser
            ? `Le compte de ${selectedUser.first_name || selectedUser.username} sera désactivé. L'utilisateur ne pourra plus se connecter.`
            : "Ce compte sera désactivé."
        }
        onConfirm={confirmDeactivate}
        onCancel={() => { if (!submitting) setShowConfirmModal(false); }}
        confirmLabel={submitting ? "Désactivation..." : "Désactiver"}
        cancelLabel="Annuler"
        confirmDisabled={submitting}
        variant="danger"
      />
    </div>
  );
}
