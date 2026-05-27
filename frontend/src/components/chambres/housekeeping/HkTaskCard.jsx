import { useState } from "react";

import HkAssignModal from "./HkAssignModal";
import HkProblemModal from "./HkProblemModal";

const PRIORITY_PILL = { urgent: "hk-pill-r", high: "hk-pill-r", normal: "hk-pill-g", low: "hk-pill-gr" };
const STATUS_PILL = { pending: "hk-pill-a", in_progress: "hk-pill-b", completed: "hk-pill-g", cancelled: "hk-pill-gr" };

export default function HkTaskCard({
  task,
  canStart = false,
  canComplete = false,
  canSuspend = false,
  canReportProblem = false,
  canAssign = false,
  onDemarrer,
  onTerminer,
  onSuspendre,
  onSignalerProbleme,
  onAssigner,
}) {
  const [showProblem, setShowProblem] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const isEnCours = task.statut === "in_progress";
  const isPending = task.statut === "pending";
  const isTermine = task.statut === "completed";
  const isProbleme = Boolean(task.probleme_signale);

  return (
    <div className={`hk-task-card ${task.est_en_retard ? "hk-task-retard" : ""} ${isEnCours ? "hk-task-encours" : ""}`}>
      <div className="hk-tc-header">
        <div className="hk-tc-left">
          <div className="hk-tc-num">Chambre {task.chambre_numero}</div>
          <div className="hk-tc-meta-line">
            <span>{task.type_tache_display}</span>
            <span className={`hk-pill ${PRIORITY_PILL[task.priorite] || "hk-pill-g"}`}>{task.priorite_display}</span>
            <span className={`hk-pill ${isProbleme ? "hk-pill-r" : STATUS_PILL[task.statut] || "hk-pill-gr"}`}>{task.statut_display}</span>
          </div>
        </div>
        <div className="hk-tc-right">
          {isEnCours && <span className="hk-tc-timer">{task.duree_ecoulee_min} / {task.temps_estime} min{task.est_en_retard ? ` - retard ${task.retard_min}min` : ""}</span>}
          {isPending && task.attente_min > 0 && <span className="hk-tc-timer">Attente : {task.attente_min} min</span>}
        </div>
      </div>

      {isEnCours && (
        <div className="hk-tc-progress-wrap">
          <div className="hk-tc-progress-fill" style={{ width: `${task.progression_pct}%`, background: task.est_en_retard ? "#E24B4A" : "#1D9E75" }} />
        </div>
      )}

      <div className="hk-tc-body">
        <div className="hk-tc-row"><span className="hk-tc-lbl">Agent assigne</span><span className={`hk-tc-val ${!task.agent_nom ? "hk-tc-muted" : ""}`}>{task.agent_nom || "Non attribue"}</span></div>
        <div className="hk-tc-row"><span className="hk-tc-lbl">Temps estime</span><span className="hk-tc-val">{task.temps_estime ? `${task.temps_estime} min` : "-"}</span></div>
        {isEnCours && task.heure_debut && (
          <>
            <div className="hk-tc-row"><span className="hk-tc-lbl">Demarre a</span><span className="hk-tc-val hk-tc-mono">{task.heure_debut}</span></div>
            <div className="hk-tc-row"><span className="hk-tc-lbl">Fin estimee</span><span className="hk-tc-val hk-tc-mono">{task.heure_fin_estimee}</span></div>
          </>
        )}
        {task.notes && <div className="hk-tc-row"><span className="hk-tc-lbl">Notes</span><span className="hk-tc-val">{task.notes}</span></div>}
        {isProbleme && <div className="hk-tc-row hk-tc-row-problem"><span className="hk-tc-lbl">Probleme</span><span className="hk-tc-val hk-tc-problem">{task.probleme_signale}</span></div>}
      </div>

      {!isTermine && (canStart || canComplete || canSuspend || canReportProblem || canAssign) && (
        <div className="hk-tc-footer">
          {isPending && canStart && <button type="button" className="hk-btn hk-btn-green" onClick={() => onDemarrer(task.id)}>Demarrer</button>}
          {(isPending || isEnCours) && canComplete && <button type="button" className="hk-btn hk-btn-green" onClick={() => onTerminer(task.id)}>Marquer propre</button>}
          {(isPending || isEnCours) && canAssign && <button type="button" className="hk-btn" onClick={() => setShowAssign(true)}>Assigner</button>}
          {isEnCours && canSuspend && <button type="button" className="hk-btn" onClick={() => onSuspendre(task.id)}>Suspendre</button>}
          {!isProbleme && canReportProblem && <button type="button" className="hk-btn hk-btn-red" onClick={() => setShowProblem(true)}>Signaler probleme</button>}
        </div>
      )}

      {showProblem && <HkProblemModal chambre={task.chambre_numero} onClose={() => setShowProblem(false)} onSubmit={async (msg) => { await onSignalerProbleme(task.id, msg); setShowProblem(false); }} />}
      {showAssign && <HkAssignModal chambre={task.chambre_numero} onClose={() => setShowAssign(false)} onSubmit={async (agentId) => { await onAssigner(task.id, agentId); setShowAssign(false); }} />}
    </div>
  );
}
