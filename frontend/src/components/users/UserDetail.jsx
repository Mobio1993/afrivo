import RoleBadge from "./RoleBadge";
import UserAvatar from "./UserAvatar";
import { getRoleMeta, getUserFullName } from "./roleMeta";

function formatDate(value, withTime = false) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Icon({ children }) {
  return <span className="um-detail-icon" aria-hidden="true">{children}</span>;
}

export default function UserDetail({
  user,
  onEdit,
  onChangeRole,
  onPassword,
  onDeactivate,
  canEdit = false,
  canChangeRole = false,
  canResetPassword = false,
  canDeactivate = false,
}) {
  if (!user) {
    return (
      <section className="um-panel um-detail-panel um-detail-empty">
        <div className="um-empty-illustration" aria-hidden="true">U</div>
        <strong>Selectionnez un utilisateur pour voir son profil</strong>
        <span>La fiche utilisateur apparaitra dans ce panneau.</span>
      </section>
    );
  }

  const roleMeta = getRoleMeta(user.role);
  const fields = [
    { icon: "U", label: "Username", value: user.username },
    { icon: "H", label: "Hotel / Organisation", value: user.hotel_name || user.organization_name || "-" },
    { icon: user.is_active ? "A" : "I", label: "Statut", value: user.is_active ? "Actif" : "Inactif" },
    { icon: "R", label: "Role", value: roleMeta.label },
    { icon: "C", label: "Date de creation", value: formatDate(user.date_joined || user.createdAt) },
    { icon: "T", label: "Derniere connexion", value: formatDate(user.last_login, true) },
  ];

  return (
    <section className="um-panel um-detail-panel">
      <header className="um-profile-header">
        <UserAvatar user={user} size="lg" />
        <div className="um-profile-copy">
          <h2>{getUserFullName(user)}</h2>
          <div className="um-profile-meta">
            <RoleBadge role={user.role} />
            <span className={`um-status ${user.is_active ? "is-active" : "is-inactive"}`}>
              {user.is_active ? "Actif" : "Inactif"}
            </span>
          </div>
        </div>
      </header>

      <div className="um-detail-fields">
        {fields.map((field) => (
          <div key={field.label} className="um-detail-row">
            <span>
              <Icon>{field.icon}</Icon>
              {field.label}
            </span>
            <strong>{field.value}</strong>
          </div>
        ))}
      </div>

      <div className="um-actions-grid">
        {canEdit ? (
          <button type="button" className="um-action-btn" onClick={onEdit}>
            <span aria-hidden="true">E</span>
            Modifier le profil
          </button>
        ) : null}
        {canChangeRole ? (
          <button type="button" className="um-action-btn" onClick={onChangeRole}>
            <span aria-hidden="true">R</span>
            Changer le role
          </button>
        ) : null}
        {canResetPassword ? (
          <button type="button" className="um-action-btn" onClick={onPassword}>
            <span aria-hidden="true">P</span>
            Reinitialiser le mot de passe
          </button>
        ) : null}
        {canDeactivate ? (
          <button
            type="button"
            className="um-action-btn is-danger"
            onClick={onDeactivate}
            disabled={!user.is_active}
          >
            <span aria-hidden="true">D</span>
            Desactiver le compte
          </button>
        ) : null}
      </div>
    </section>
  );
}
