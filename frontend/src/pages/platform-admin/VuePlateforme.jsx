import { useNavigate } from "react-router-dom";

import VpAbonnements from "../../components/platform-admin/vue-plateforme/VpAbonnements";
import VpChecklist from "../../components/platform-admin/vue-plateforme/VpChecklist";
import VpEventJournal from "../../components/platform-admin/vue-plateforme/VpEventJournal";
import VpKpiBar from "../../components/platform-admin/vue-plateforme/VpKpiBar";
import VpQuickActions from "../../components/platform-admin/vue-plateforme/VpQuickActions";
import VpScoreCard from "../../components/platform-admin/vue-plateforme/VpScoreCard";
import { useVuePlateforme } from "../../hooks/useVuePlateforme";
import "../../styles/vue-plateforme.css";

export default function VuePlateforme() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useVuePlateforme();

  const actions = [
    {
      id: "onboarding",
      label: "Demarrer un onboarding SaaS",
      icon: "ti-rocket",
      color: "primary",
      onClick: () => navigate("/platform/hotels?onboarding=1"),
    },
    {
      id: "hotel",
      label: "Creer un hotel seul",
      icon: "ti-building-plus",
      color: "green",
      onClick: () => navigate("/platform/hotels?create=1"),
    },
    {
      id: "admin",
      label: "Creer un admin hotel",
      icon: "ti-user-plus",
      color: "blue",
      onClick: () => navigate("/platform/users?create=1"),
    },
    {
      id: "abonnements",
      label: "Gerer les abonnements",
      icon: "ti-receipt",
      color: "purple",
      onClick: () => navigate("/platform/subscriptions"),
    },
  ];

  return (
    <div className="vp-page">
      <div className="vp-page-header">
        <div>
          <div className="vp-breadcrumb">
            <i className="ti ti-circle-dot" style={{ fontSize: 10, color: "#1D9E75" }} aria-hidden="true"></i>
            PLATFORM ADMIN
          </div>
          <h1 className="vp-title">Console plateforme</h1>
          <p className="vp-subtitle">Supervision globale des hotels, abonnements et admins AFRIVO.</p>
        </div>
        <button className="vp-refresh-btn" onClick={refetch} title="Actualiser" aria-label="Actualiser">
          <i className="ti ti-refresh" aria-hidden="true"></i>
        </button>
      </div>

      {loading ? <div className="vp-loading">Chargement de la console...</div> : null}
      {error ? <div className="vp-error">{error}</div> : null}

      {data ? (
        <>
          <div className="vp-top-strip">
            <VpScoreCard score={data.score_sante} label={data.score_label} description={data.score_description} />
            <VpKpiBar data={data} />
          </div>

          <div className="vp-three-cols">
            <VpAbonnements data={data} />
            <VpQuickActions actions={actions} />
            <VpChecklist checklist={data.checklist || []} />
          </div>

          <VpEventJournal events={data.events || []} />
        </>
      ) : null}
    </div>
  );
}
