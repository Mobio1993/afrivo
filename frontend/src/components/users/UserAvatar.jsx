import { getInitials, getRoleMeta } from "./roleMeta";

export default function UserAvatar({ user, role, size = "md" }) {
  const meta = getRoleMeta(role || user?.role);
  return (
    <span className={`um-avatar um-avatar--${size} um-avatar--${meta.className}`}>
      {getInitials(user)}
    </span>
  );
}
