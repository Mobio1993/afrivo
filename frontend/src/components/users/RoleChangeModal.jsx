import { useState } from "react";

import ModalShell from "./ModalShell";
import RoleBadge from "./RoleBadge";
import { ROLE_OPTIONS } from "./roleMeta";

export default function RoleChangeModal({ user, saving, error, onClose, onSubmit }) {
  const [role, setRole] = useState(user.role || "reception");

  return (
    <ModalShell title="Changer le role" onClose={onClose} maxWidth={430}>
      <form
        className="um-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(role);
        }}
      >
        <header className="um-modal-header">
          <div>
            <strong>Changer le role</strong>
            <span>Role actuel : <RoleBadge role={user.role} /></span>
          </div>
          <button type="button" className="um-icon-btn" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <label className="um-field">
          <span>Nouveau role</span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        {error ? <div className="um-inline-error">{error}</div> : null}

        <footer className="um-modal-footer">
          <button type="button" className="um-outline-btn" onClick={onClose} disabled={saving}>Annuler</button>
          <button type="submit" className="um-primary-btn" disabled={saving}>
            {saving ? "Confirmation..." : "Confirmer"}
          </button>
        </footer>
      </form>
    </ModalShell>
  );
}
