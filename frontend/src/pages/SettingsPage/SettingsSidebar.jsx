const SECTIONS = [
  { id: "general", label: "General" },
  { id: "reservations", label: "Reservations" },
  { id: "billing", label: "Facturation" },
  { id: "security", label: "Securite" },
  { id: "appearance", label: "Apparence" },
];


export function SettingsSidebar({ activeSection, onSelect, dirtySections = {} }) {
  return (
    <aside className="settings-sidebar" aria-label="Sections parametres">
      {SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          className={`settings-sidebar__item ${activeSection === section.id ? "active" : ""}`}
          onClick={() => onSelect(section.id)}
        >
          {section.label}
          {dirtySections[section.id] && <span className="settings-sidebar__dot" aria-label="modifications en attente" />}
        </button>
      ))}
    </aside>
  );
}
