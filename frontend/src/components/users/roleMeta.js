export const ROLE_OPTIONS = [
  { value: "admin", label: "Administrateur" },
  { value: "reception", label: "Reception" },
  { value: "cashier", label: "Caissier" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "manager", label: "Manager" },
  { value: "restaurant", label: "Restaurant" },
];

export const ROLE_META = {
  admin: { label: "Administrateur", className: "admin" },
  administrateur: { label: "Administrateur", className: "admin" },
  reception: { label: "Reception", className: "reception" },
  cashier: { label: "Caissier", className: "cashier" },
  caissier: { label: "Caissier", className: "cashier" },
  housekeeping: { label: "Housekeeping", className: "housekeeping" },
  manager: { label: "Manager", className: "manager" },
  restaurant: { label: "Restaurant", className: "restaurant" },
};

export function getRoleMeta(role) {
  return ROLE_META[role] || { label: role || "Role", className: "default" };
}

export function getUserFullName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim()
    || user?.fullName
    || user?.username
    || "Utilisateur";
}

export function getInitials(user) {
  if (user?.initials) return user.initials;
  const source = getUserFullName(user);
  const parts = source.trim().split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}
