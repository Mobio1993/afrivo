import { buildInitials, normalizeClientStatus, normalizeValue } from "../utils";

export function ClientListRow({ client, isActive, onSelect }) {
  const hasEmail = client.email && client.email !== "-";
  const piece =
    client.identity_document_number && client.identity_document_number !== "-"
      ? client.identity_document_number
      : "-";
  const clientStatus = normalizeClientStatus(client.client_status);

  const isBlacklisted = Boolean(client.is_blacklisted);

  return (
    <button
      type="button"
      className={`client-row ${isActive ? "active" : ""} ${isBlacklisted ? "is-blacklisted" : ""}`}
      onClick={onSelect}
      aria-label={`Afficher les détails de ${client.full_name}`}
      aria-pressed={isActive}
    >
      <div className="client-row-avatar" aria-hidden="true">
        {buildInitials(client.full_name)}
      </div>

      <div className="client-row-content">
        <div className="client-row-top">
          <strong>{normalizeValue(client.full_name)}</strong>
          <div className="client-row-badges">
            {isBlacklisted ? (
              <span className="client-blacklist-badge" title="Client signalé — accès restreint">
                ⚠ Blacklisté
              </span>
            ) : (
              <span className={`client-status-badge client-status-badge--${clientStatus.tone}`}>
                {clientStatus.label}
              </span>
            )}
            <span className="client-row-badge">{normalizeValue(client.client_type_label)}</span>
            {hasEmail ? <span className="client-row-badge">Email</span> : null}
          </div>
        </div>

        <div className="client-row-meta">
          <span>{normalizeValue(client.phone)}</span>
          <span>•</span>
          <span>{normalizeValue(client.nationality)}</span>
          <span>•</span>
          <span>{piece}</span>
        </div>
      </div>
    </button>
  );
}
