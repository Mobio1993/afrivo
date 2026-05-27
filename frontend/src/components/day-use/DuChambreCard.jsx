export default function DuChambreCard({ dayUse }) {
  const fields = [
    { label: "Numero", value: dayUse.chambre_numero },
    { label: "Type", value: dayUse.chambre_type },
    { label: "Statut", value: dayUse.chambre_statut },
    { label: "Etage", value: dayUse.chambre_etage },
    { label: "Depassement", value: dayUse.depassement_display || dayUse.depassement },
    { label: "Entree reelle", value: dayUse.entree_reelle },
    { label: "Sortie reelle", value: dayUse.sortie_reelle },
  ];

  return (
    <div className="du-card">
      <div className="du-sec-label">Chambre & occupation</div>
      {fields.map((field) => (
        <div key={field.label} className="du-field-row">
          <span className="du-field-lbl">{field.label}</span>
          <span className={`du-field-val ${!field.value ? "du-muted" : ""}`}>{field.value || "—"}</span>
        </div>
      ))}
    </div>
  );
}
