import { useState } from "react";

import ModalShell from "./ModalShell";

export default function PasswordModal({ user, saving, error, onClose, onSubmit }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    if (password.length < 8) {
      setLocalError("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Les mots de passe ne correspondent pas.");
      return;
    }
    onSubmit(password);
  }

  return (
    <ModalShell title="Reinitialiser le mot de passe" onClose={onClose} maxWidth={460}>
      <form className="um-form" onSubmit={handleSubmit}>
        <header className="um-modal-header">
          <div>
            <strong>Reinitialiser le mot de passe</strong>
            <span>Un nouveau mot de passe sera defini pour {user.username}.</span>
          </div>
          <button type="button" className="um-icon-btn" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        <div className="um-warning-box">
          Un email de reinitialisation pourra etre envoye a {user.username} selon votre configuration email.
        </div>

        <label className="um-field">
          <span>Nouveau mot de passe</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="um-field">
          <span>Confirmer mot de passe</span>
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </label>

        {localError || error ? <div className="um-inline-error">{localError || error}</div> : null}

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
