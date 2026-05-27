export default function RpTabNav({ tabs, active, onChange }) {
  return (
    <div className="rp-tab-nav">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`rp-tab-btn ${active === tab.key ? "active" : ""}`}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
