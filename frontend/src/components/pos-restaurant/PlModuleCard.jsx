export default function PlModuleCard({ icon, tag, name, description, color, active }) {
  return (
    <div className={`pl-module-card ${active ? "pl-module-active" : ""}`}>
      <div className="pl-module-ico" style={{ background: `${color}22` }}>
        <i className={`ti ${icon}`} style={{ color }} aria-hidden="true" />
      </div>
      <div className="pl-module-info">
        <span className="pl-module-tag" style={{ color }}>
          {tag}
        </span>
        <span className="pl-module-name">{name}</span>
        <span className="pl-module-sub">{description}</span>
      </div>
      <i className="ti ti-arrow-right pl-module-arrow" aria-hidden="true" />
    </div>
  );
}

