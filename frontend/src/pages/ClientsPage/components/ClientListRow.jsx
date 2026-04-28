import { buildInitials, normalizeClientStatus, normalizeValue } from "../utils";

export function ClientListRow({ client, isActive, onSelect }) {
  const hasEmail = client.email && client.email !== "-";
  const piece =
    client.identity_document_number && client.identity_document_number !== "-"
      ? client.identity_document_number
      : "-";
  const clientStatus = normalizeClientStatus(client.client_status);

  return (
    <div className={`client-row ${isActive ? "active" : ""}`}>
      <div className="client-row-avatar" aria-hidden="true">
        {buildInitials(client.full_name)}
      </div>

      <div className="client-row-content">
        <div className="client-row-top">
          <strong>{normalizeValue(client.full_name)}</strong>
          <div className="client-row-badges">
            <span className={`client-status-badge client-status-badge--${clientStatus.tone}`}>
              {clientStatus.label}
            </span>
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

      <button
        type="button"
        className="client-row-action-btn"
        onClick={onSelect}
        aria-label={`Ouvrir la fiche de ${client.full_name}`}
      >
        <span>Voir fiche</span>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </button>
    </div>
  );
}