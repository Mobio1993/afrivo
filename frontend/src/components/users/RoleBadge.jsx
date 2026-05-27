import { getRoleMeta } from "./roleMeta";

export default function RoleBadge({ role }) {
  const meta = getRoleMeta(role);
  return (
    <span className={`um-role-badge um-role-badge--${meta.className}`}>
      {meta.label}
    </span>
  );
}
