import { useEffect, useState } from "react";

import { ConfirmModal } from "../../../shared/components/ConfirmModal";

const EMPTY_ADMIN_FORM = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

export default function PhDetailPanel({ hotel, onToggleStatus, onCreateAdmin, onSuccess }) {
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN_FORM);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);

  useEffect(() => {
    setAdminForm(EMPTY_ADMIN_FORM);
    setFeedback(null);
    setConfirmStatusChange(false);
  }, [hotel?.id]);

  if (!hotel) {
    return (
      <div className="ph-card ph-detail-empty">
        <i className="ti ti-building" style={{ fontSize: 28 }} aria-hidden="true" />
        <p>Selectionnez un hotel pour voir sa fiche</p>
      </div>
    );
  }

  const setAdmin = (event) => {
    const { name, value } = event.target;
    setAdminForm((current) => ({ ...current, [name]: value }));
  };

  const submitAdmin = async (event) => {
    event.preventDefault();
    if (!adminForm.username.trim() || !adminForm.password) {
      setFeedback({ type: "error", msg: "Username et mot de passe requis." });
      return;
    }
    setSavingAdmin(true);
    const result = await onCreateAdmin(hotel.id, adminForm);
    setSavingAdmin(false);
    setFeedback(result.success ? { type: "success", msg: "Admin hotel cree." } : { type: "error", msg: result.error });
    if (result.success) setAdminForm(EMPTY_ADMIN_FORM);
  };

  const toggleStatus = async () => {
    setSavingStatus(true);
    const result = await onToggleStatus(hotel);
    setSavingStatus(false);
    setConfirmStatusChange(false);
    setFeedback(result.success ? { type: "success", msg: "Statut hotel mis a jour." } : { type: "error", msg: result.error });
    if (result.success) onSuccess?.();
  };

  const isSuspending = hotel.statut === "actif";

  return (
    <>
      <div className="ph-card ph-detail-card">
        <div className="ph-card-head">
          <span className="ph-card-title">Fiche hotel</span>
        </div>

        <div className="ph-detail-body">
          <div className="ph-detail-hero">
            <div className="ph-detail-av">{hotel.initiales}</div>
            <div>
              <div className="ph-detail-name">{hotel.nom}</div>
              <div className="ph-detail-pills">
                <span className={`ph-pill ph-pill-${hotel.statut}`}>{hotel.statut_display}</span>
                <span className="ph-pill ph-pill-plan">{hotel.plan_nom}</span>
                {hotel.alerte && (
                  <span className={`ph-pill ph-pill-alert-${hotel.alerte.type}`}>
                    {hotel.alerte.type === "critique" ? "Critique" : "Attention"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {feedback && <div className={`ph-detail-feedback ph-feedback-${feedback.type}`}>{feedback.msg}</div>}

          <div className="ph-detail-sec-lbl">Identite</div>
          {[
            { label: "Hotel", value: hotel.nom },
            { label: "Code", value: hotel.code, mono: true },
            { label: "Slug", value: hotel.slug, mono: true },
            { label: "Organisation", value: hotel.organisation_nom },
            { label: "Pays", value: hotel.pays || "-" },
            { label: "Ville", value: hotel.ville || "-" },
            { label: "Fuseau", value: hotel.fuseau_horaire || "-" },
            { label: "Devise", value: hotel.devise || "-" },
          ].map((item) => (
            <div key={item.label} className="ph-detail-row">
              <span className="ph-detail-lbl">{item.label}</span>
              <span className={`ph-detail-val ${item.mono ? "ph-detail-mono" : ""}`}>{item.value}</span>
            </div>
          ))}

          <div className="ph-detail-sec-lbl">Quota & abonnement</div>
          <div className="ph-detail-quota-row">
            <span className="ph-detail-lbl">Utilisateurs actifs</span>
            <span className="ph-detail-val">
              {hotel.utilisateurs_actifs} / {hotel.plan_sans_limite ? "inf." : hotel.quota_plan}
            </span>
          </div>
          <div className="ph-detail-quota-bar">
            <div
              className="ph-detail-quota-fill"
              style={{
                width: `${hotel.quota_pct || 0}%`,
                background: hotel.quota_statut === "critique" ? "#E24B4A" : hotel.quota_statut === "attention" ? "#EF9F27" : "#1D9E75",
              }}
            />
          </div>
          {[
            { label: "Plan actuel", value: hotel.plan_nom },
            { label: "Quota plan", value: hotel.plan_sans_limite ? "Sans limite" : hotel.quota_plan },
            { label: "Admins assignes", value: hotel.admins_count },
          ].map((item) => (
            <div key={item.label} className="ph-detail-row">
              <span className="ph-detail-lbl">{item.label}</span>
              <span className="ph-detail-val">{item.value}</span>
            </div>
          ))}

          <div className="ph-detail-sec-lbl">Creation admin hotel</div>
          <form className="ph-admin-mini-form" onSubmit={submitAdmin}>
            <input className="ph-form-input" name="username" placeholder="Username" value={adminForm.username} onChange={setAdmin} disabled={savingAdmin} />
            <input className="ph-form-input" name="password" type="password" placeholder="Mot de passe" value={adminForm.password} onChange={setAdmin} disabled={savingAdmin} />
            <input className="ph-form-input" name="first_name" placeholder="Prenom" value={adminForm.first_name} onChange={setAdmin} disabled={savingAdmin} />
            <input className="ph-form-input" name="last_name" placeholder="Nom" value={adminForm.last_name} onChange={setAdmin} disabled={savingAdmin} />
            <input className="ph-form-input ph-admin-full" name="email" type="email" placeholder="Email" value={adminForm.email} onChange={setAdmin} disabled={savingAdmin} />
            <button className="ph-action-btn ph-action-secondary ph-admin-full" type="submit" disabled={savingAdmin}>
              <i className="ti ti-user-plus" aria-hidden="true" />
              {savingAdmin ? "Creation..." : "Creer l'admin hotel"}
            </button>
          </form>

          <div className="ph-detail-actions">
            <button
              className={isSuspending ? "ph-action-btn ph-action-danger" : "ph-action-btn ph-action-primary"}
              onClick={() => setConfirmStatusChange(true)}
              disabled={savingStatus}
            >
              {savingStatus ? "Mise a jour..." : isSuspending ? "Suspendre l'hotel" : "Reactiver l'hotel"}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmStatusChange}
        title={isSuspending ? "Suspendre l'hotel" : "Reactiver l'hotel"}
        message={
          isSuspending
            ? `L'hotel ${hotel.nom} et son abonnement courant passeront en statut suspendu.`
            : `L'hotel ${hotel.nom} redeviendra actif et accessible.`
        }
        confirmLabel={isSuspending ? "Suspendre" : "Reactiver"}
        variant={isSuspending ? "danger" : "default"}
        confirmDisabled={savingStatus}
        onConfirm={toggleStatus}
        onCancel={() => setConfirmStatusChange(false)}
      />
    </>
  );
}
