export default function PayTabNav({ tabs, active, onChange }) {
  return (
    <div className="pay-tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`pay-tab-btn ${active === tab.key ? "active" : ""}`}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
