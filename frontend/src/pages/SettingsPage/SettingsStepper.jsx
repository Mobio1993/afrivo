const STEPS = [
  { id: "general",      label: "Général",      num: 1 },
  { id: "reservations", label: "Réservations", num: 2 },
  { id: "billing",      label: "Facturation",  num: 3 },
  { id: "security",     label: "Sécurité",     num: 4 },
  { id: "appearance",   label: "Apparence",    num: 5 },
];


export function SettingsStepper({ activeSection, onSelect, getStepState }) {
  return (
    <nav className="settings-stepper" aria-label="Étapes de configuration">
      {STEPS.map((step) => {
        const state = getStepState(step.id);
        const isActive = activeSection === step.id;
        return (
          <button
            key={step.id}
            type="button"
            className={`settings-step${isActive ? " active" : ""}`}
            onClick={() => onSelect(step.id)}
            aria-current={isActive ? "step" : undefined}
          >
            <span className={`settings-step__num settings-step__num--${state}`}>
              {state === "done" ? "✓" : state === "warning" ? "!" : step.num}
            </span>
            <span className="settings-step__label">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
