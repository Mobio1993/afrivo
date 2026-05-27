import { useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { canPerformAction, hasPermission } from "../../auth/permissions";
import RpAlerts from "../../components/reports/RpAlerts";
import RpDayUseTab from "../../components/reports/RpDayUseTab";
import RpDetailTable from "../../components/reports/RpDetailTable";
import RpFinanciersTab from "../../components/reports/RpFinanciersTab";
import RpKpiGrid from "../../components/reports/RpKpiGrid";
import RpOccupationTab from "../../components/reports/RpOccupationTab";
import RpPeriodSelector from "../../components/reports/RpPeriodSelector";
import RpSparklines from "../../components/reports/RpSparklines";
import RpTabNav from "../../components/reports/RpTabNav";
import { useReports } from "../../hooks/useReports";
import "../../styles/reports.css";

const TABS = [
  { key: "financiers", label: "Financiers", action: "reports.view_financial" },
  { key: "occupation", label: "Occupation", action: "reports.view_occupancy" },
  { key: "day_use", label: "Day use", action: "reports.view_dayuse" },
  { key: "tenancy", label: "Tenancy readiness", module: "reports", permission: "manage" },
];

export function ReportsPage() {
  const { user } = useAuth();
  const { data, loading, error, period, setPeriod, customRange, setCustomRange } = useReports();
  const [activeTab, setActiveTab] = useState("financiers");
  const visibleTabs = TABS.filter((tab) =>
    tab.action ? canPerformAction(user, tab.action, { strict: false }) : hasPermission(user, tab.module, tab.permission)
  );
  const currentTab = visibleTabs.some((tab) => tab.key === activeTab) ? activeTab : visibleTabs[0]?.key || "financiers";

  return (
    <div className="rp-page">
      <div className="rp-header">
        <div>
          <div className="rp-header-badge">Rapports React</div>
          <div className="rp-header-title">Rapports direction</div>
          <div className="rp-header-sub">Lecture analytique par domaine metier pour piloter l'exploitation</div>
        </div>
        <RpPeriodSelector
          period={period}
          onChange={setPeriod}
          customRange={customRange}
          onCustomRange={setCustomRange}
        />
      </div>

      {loading && <div className="rp-loading">Chargement des donnees...</div>}
      {error && <div className="rp-error">{error}</div>}

      {data && (
        <>
          <RpKpiGrid data={data} />
          <RpSparklines data={data} />
          <RpAlerts alerts={data.alerts || []} />

          <RpTabNav tabs={visibleTabs} active={currentTab} onChange={setActiveTab} />
          <div className="rp-tab-content">
            {currentTab === "financiers" && <RpFinanciersTab data={data} />}
            {currentTab === "occupation" && <RpOccupationTab data={data} />}
            {currentTab === "day_use" && <RpDayUseTab data={data} />}
            {currentTab === "tenancy" && (
              <div className="rp-section">
                <div className="rp-sec-title">Tenancy readiness</div>
                <div className="rp-empty">Module de suivi tenancy conserve dans les rapports classiques.</div>
              </div>
            )}
          </div>

          <RpDetailTable items={data.liste_detaillee || []} />
        </>
      )}
    </div>
  );
}
