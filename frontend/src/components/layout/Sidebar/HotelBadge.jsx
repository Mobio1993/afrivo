import { useMemo } from "react";

function buildInitials(displayName) {
  if (!displayName || !displayName.trim()) return "??";

  const words = displayName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

export default function HotelBadge({ hotel, organization }) {
  const displayName = hotel?.name || organization?.name || "Hôtel";
  const logoUrl = hotel?.logo_url || organization?.logo_url || "";
  const status = organization?.status || hotel?.status || "active";

  const initials = useMemo(() => buildInitials(displayName), [displayName]);

  const statusLabel = {
    active: "Organisation active",
    suspended: "Organisation suspendue",
    inactive: "Organisation inactive",
    trial: "Période d'essai",
  }[status] ?? "Organisation active";

  const statusColor = {
    active: "var(--theme-hotel-dot)",
    suspended: "#EF9F27",
    inactive: "#F09595",
    trial: "#FAC775",
  }[status] ?? "var(--theme-hotel-dot)";

  return (
    <div className="hotel-badge-card">
      <div className="hbc-logo">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`Logo ${displayName}`}
            className="hbc-logo-img"
          />
        ) : (
          <span className="hbc-initials">{initials}</span>
        )}
      </div>

      <div className="hbc-text">
        <div className="hbc-name">{displayName}</div>
        <div className="hbc-status">{statusLabel}</div>
      </div>

      <div
        className="hbc-dot"
        style={{ background: statusColor }}
        aria-label={statusLabel}
      />
    </div>
  );
}
