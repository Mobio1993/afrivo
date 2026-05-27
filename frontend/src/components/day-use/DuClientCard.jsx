export default function DuClientCard({ dayUse }) {
  const initials = (dayUse.client_name || "CL")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="du-card">
      <div className="du-sec-label">Client</div>
      <div className="du-client-head">
        <div className="du-avatar">{initials}</div>
        <div>
          <div className="du-client-name">{dayUse.client_name || "—"}</div>
          <div className="du-client-sub">{dayUse.client_email || "—"}</div>
        </div>
      </div>
      {[
        { label: "Telephone", value: dayUse.client_phone },
        { label: "Nationalite", value: dayUse.client_nationalite },
      ].map((field) => (
        <div key={field.label} className="du-field-row">
          <span className="du-field-lbl">{field.label}</span>
          <span className={`du-field-val ${!field.value || field.value === "-" ? "du-muted" : ""}`}>{field.value || "—"}</span>
        </div>
      ))}
    </div>
  );
}
