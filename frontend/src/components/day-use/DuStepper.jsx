const STEPS = [
  { key: "cree", label: "Cree", icon: "✦" },
  { key: "attente", label: "En attente", icon: "◷" },
  { key: "entre", label: "Entre", icon: "↵" },
  { key: "sorti", label: "Sorti", icon: "↳" },
  { key: "nettoyage", label: "Nettoyage", icon: "✣" },
  { key: "termine", label: "Termine", icon: "✓" },
];

export default function DuStepper({ currentStep, statut }) {
  const isAnnule = ["cancelled", "annule", "no_show"].includes(statut);

  return (
    <div className="du-stepper-wrap">
      <div className="du-stepper">
        {STEPS.map((step, index) => {
          const isDone = !isAnnule && index < currentStep;
          const isCurrent = !isAnnule && index === currentStep;
          return (
            <div key={step.key} className={`du-step ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}>
              {index < STEPS.length - 1 && <div className={`du-step-connector ${isDone ? "done" : ""}`} />}
              <div className="du-step-dot">{isDone ? "✓" : step.icon}</div>
              <div className="du-step-label">{step.label}</div>
            </div>
          );
        })}
      </div>
      {isAnnule && <div className="du-annule-banner">Day use annule</div>}
    </div>
  );
}
