import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { canPerformAction, hasPermission } from "../../auth/permissions";
import DuChambreCard from "../../components/day-use/DuChambreCard";
import DuClientCard from "../../components/day-use/DuClientCard";
import DuEncaissementsCard from "../../components/day-use/DuEncaissementsCard";
import DuFormCard from "../../components/day-use/DuFormCard";
import DuKpiBar from "../../components/day-use/DuKpiBar";
import DuPaiementModal from "../../components/day-use/DuPaiementModal";
import DuStepper from "../../components/day-use/DuStepper";
import DuTopBar from "../../components/day-use/DuTopBar";
import { useDayUseDetail } from "../../hooks/useDayUseDetail";
import "../../styles/day-use-detail.css";

export default function DayUseDetailPage({ dayUseId }) {
  const { entityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const id = dayUseId || entityId;
  const {
    dayUse,
    loading,
    error,
    actionError,
    clearActionError,
    refetch,
    effectuerEntree,
    effectuerSortie,
    terminerNettoyage,
    annuler,
    patchDayUse,
    ajouterPaiement,
  } = useDayUseDetail(id);
  const [showPaiementModal, setShowPaiementModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const canEntree = canPerformAction(user, "dayuse.check_in");
  const canSortie = canPerformAction(user, "dayuse.check_out");
  const canAnnuler = canPerformAction(user, "dayuse.cancel");
  const canNettoyage = canPerformAction(user, "rooms.cleaning_complete");
  const canRecordPayment = canPerformAction(user, "payments.record");
  const canEditDayUse = hasPermission(user, "operations", "update");

  if (loading) {
    return <div className="du-loading">Chargement...</div>;
  }
  if (error) {
    return <div className="du-error">Erreur : {error}</div>;
  }
  if (!dayUse) {
    return null;
  }

  const askConfirmation = (config) => {
    setConfirmAction(config);
  };

  const closeConfirm = () => {
    setConfirmAction(null);
  };

  const confirmAndRun = async () => {
    const action = confirmAction?.action;
    closeConfirm();
    if (action) {
      await action();
    }
  };

  return (
    <div className="du-page">
      <DuTopBar
        dayUse={dayUse}
        onBack={() => navigate(-1)}
        onEntree={() =>
          askConfirmation({
            title: "Effectuer l'entree",
            message: "Confirmer l'entree du client pour ce day use ?",
            confirmLabel: "Confirmer l'entree",
            action: effectuerEntree,
          })
        }
        onSortie={() =>
          askConfirmation({
            title: "Effectuer la sortie",
            message: "Confirmer la sortie du client et envoyer la chambre au nettoyage ?",
            confirmLabel: "Confirmer la sortie",
            action: effectuerSortie,
          })
        }
        onNettoyage={terminerNettoyage}
        onAnnuler={() =>
          askConfirmation({
            title: "Annuler le day use",
            message: "Cette action annulera le day use. Continuer ?",
            confirmLabel: "Annuler le day use",
            variant: "danger",
            action: () => annuler("Annulation depuis la fiche day use"),
          })
        }
        canEntree={canEntree}
        canSortie={canSortie}
        canNettoyage={canNettoyage}
        canAnnuler={canAnnuler}
      />
      <DuKpiBar dayUse={dayUse} />
      <DuStepper currentStep={dayUse.stepper_step} statut={dayUse.statut} />

      <div className="du-split">
        <div className="du-left">
          <DuClientCard dayUse={dayUse} />
          <DuChambreCard dayUse={dayUse} />
          <DuEncaissementsCard dayUse={dayUse} onAdd={() => setShowPaiementModal(true)} canAdd={canRecordPayment} />
        </div>
        <div className="du-right">
          <DuFormCard dayUse={dayUse} patchDayUse={patchDayUse} onSuccess={refetch} canEdit={canEditDayUse} />
        </div>
      </div>

      {showPaiementModal && (
        <DuPaiementModal
          onClose={() => setShowPaiementModal(false)}
          onSuccess={() => {
            setShowPaiementModal(false);
            refetch();
          }}
          ajouterPaiement={ajouterPaiement}
        />
      )}

      {actionError && (
        <div className="du-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="du-error-title">
          <div className="du-modal du-message-modal">
            <div className="du-message-icon du-message-icon-error">!</div>
            <div>
              <h3 className="du-message-title" id="du-error-title">Action impossible</h3>
              <p className="du-message-text">{actionError}</p>
            </div>
            <div className="du-modal-footer">
              <button className="du-btn-submit du-btn-submit-sm" type="button" onClick={clearActionError}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="du-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="du-confirm-title">
          <div className="du-modal du-message-modal">
            <div className={`du-message-icon ${confirmAction.variant === "danger" ? "du-message-icon-danger" : ""}`}>?</div>
            <div>
              <h3 className="du-message-title" id="du-confirm-title">{confirmAction.title}</h3>
              <p className="du-message-text">{confirmAction.message}</p>
            </div>
            <div className="du-modal-footer">
              <button className="du-btn" type="button" onClick={closeConfirm}>Annuler</button>
              <button
                className={`du-btn-submit du-btn-submit-sm ${confirmAction.variant === "danger" ? "du-btn-submit-danger" : ""}`}
                type="button"
                onClick={confirmAndRun}
              >
                {confirmAction.confirmLabel || "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
