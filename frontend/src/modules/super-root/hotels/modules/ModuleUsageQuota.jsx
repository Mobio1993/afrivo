export default function ModuleUsageQuota({ module }) {
  return <span>{module.monthly_price || "0.00"} XOF / mois</span>;
}
