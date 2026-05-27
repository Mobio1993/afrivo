const KPI_CONFIG = [
  {
    key: "organisations_total",
    label: "Organisations",
    sub: () => "SaaS clients",
    icon: "ti-users",
    color: "blue",
  },
  {
    key: "hotels_actifs",
    label: "Hotels actifs",
    sub: (d) => (d.hotels_inactifs === 0 ? "100%" : `${d.hotels_inactifs} inactif(s)`),
    icon: "ti-circle-check",
    color: "green",
    valColor: (d) => (d.hotels_actifs > 0 ? "#0F6E56" : undefined),
  },
  {
    key: "abonnements_total",
    label: "Abonnements",
    sub: (d) => `${d.abonnements_actifs} actifs - ${d.abonnements_essai} essai`,
    icon: "ti-receipt",
    color: "purple",
  },
  {
    key: "admins_plateforme",
    label: "Admins plateforme",
    sub: (d) => `${d.admins_hotels} admins hotels`,
    icon: "ti-shield-check",
    color: "amber",
  },
  {
    key: "quota_critique_count",
    label: "Quota critique",
    sub: (d) => (d.quota_critique_count > 0 ? "Hotels >100%" : "Aucun"),
    icon: "ti-alert-triangle",
    color: "red",
    valColor: (d) => (d.quota_critique_count > 0 ? "#A32D2D" : "#0F6E56"),
  },
];

const ICO_COLORS = {
  blue: { bg: "#E6F1FB", color: "#185FA5" },
  green: { bg: "#E1F5EE", color: "#0F6E56" },
  purple: { bg: "#EEEDFE", color: "#3C3489" },
  amber: { bg: "#FAEEDA", color: "#633806" },
  red: { bg: "#FCEBEB", color: "#A32D2D" },
};

export default function VpKpiBar({ data }) {
  return (
    <div className="vp-kpi-bar">
      {KPI_CONFIG.map((k) => {
        const ico = ICO_COLORS[k.color];
        const valClr = k.valColor ? k.valColor(data) : undefined;
        return (
          <div key={k.key} className="vp-kpi-cell">
            <div className="vp-kpi-ico" style={{ background: ico.bg, color: ico.color }}>
              <i className={`ti ${k.icon}`} aria-hidden="true"></i>
            </div>
            <div>
              <div className="vp-kpi-lbl">{k.label}</div>
              <div className="vp-kpi-val" style={valClr ? { color: valClr } : {}}>
                {data[k.key]}
              </div>
              <div className="vp-kpi-sub">{k.sub(data)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
