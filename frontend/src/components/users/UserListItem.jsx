import UserAvatar from "./UserAvatar";
import { getRoleMeta, getUserFullName } from "./roleMeta";

export default function UserListItem({ user, isSelected, onClick }) {
  const roleMeta = getRoleMeta(user.role);
  return (
    <button
      type="button"
      className={`um-user-row${isSelected ? " is-selected" : ""}${!user.is_active ? " is-inactive" : ""}`}
      onClick={onClick}
    >
      <UserAvatar user={user} size="sm" />
      <span className="um-user-row__copy">
        <strong>{getUserFullName(user)}</strong>
        <small>{roleMeta.label}</small>
      </span>
      {user.is_active ? <span className="um-online-dot" aria-label="Actif" /> : null}
    </button>
  );
}
