export function hotelHealthTone(value) {
  const health = String(value || "").toLowerCase();
  if (["critique", "critical", "danger", "error"].includes(health)) return "danger";
  if (["attention", "warning", "degraded"].includes(health)) return "warning";
  return "ok";
}

export function hotelHealthLabel(value) {
  const health = String(value || "sain").toLowerCase();
  if (["critique", "critical", "danger", "error"].includes(health)) return "Critique";
  if (["attention", "warning", "degraded"].includes(health)) return "Attention";
  if (["sans_limite", "unlimited"].includes(health)) return "Sans limite";
  return "Sain";
}

export function subscriptionLabel(status) {
  const labels = {
    active: "Active",
    trial: "Essai",
    suspended: "Suspendue",
    expired: "Expiree",
    none: "Aucune",
  };
  return labels[String(status || "none").toLowerCase()] || status || "Aucune";
}

export function subscriptionTone(status) {
  const value = String(status || "none").toLowerCase();
  if (value === "active") return "ok";
  if (value === "expired" || value === "suspended") return "danger";
  return "warning";
}

export function formatHotelDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hotelInitials(name) {
  return String(name || "AF").slice(0, 2).toUpperCase();
}
