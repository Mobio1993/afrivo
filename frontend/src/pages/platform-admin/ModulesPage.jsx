import { useState } from "react";
import { useNavigate } from "react-router-dom";

import MpAdoptionStats from "../../components/platform-admin/modules/MpAdoptionStats";
import MpChecklist from "../../components/platform-admin/modules/MpChecklist";
import MpCreateForm from "../../components/platform-admin/modules/MpCreateForm";
import MpKpiBar from "../../components/platform-admin/modules/MpKpiBar";
import MpModuleTable from "../../components/platform-admin/modules/MpModuleTable";
import MpScoreCard from "../../components/platform-admin/modules/MpScoreCard";
import { useModules } from "../../hooks/useModules";
import "../../styles/modules-plateforme.css";

export default function ModulesPage() {
  const navigate = useNavigate();
  const {
    data,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    filteredModules,
    refetch,
    createModule,
    toggleModule,
  } = useModules();

  const [feedback, setFeedback] = useState(null);

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCreate = async (formData) => {
    const result = await createModule(formData);
    if (result.success) {
      showFeedback("success", "Module cree avec succes.");
    } else {
      showFeedback("error", result.error || "Erreur de creation.");
    }
    return result;
  };

  const handleEdit = (mod) => {
    navigate(`/platform/modules?module=${mod.id}&edit=1`);
  };

  const handleViewLicences = (mod) => {
    navigate(`/platform/licenses?module=${mod.id}`);
  };

  const handleToggle = async (mod) => {
    const result = await toggleModule(mod.id);
    if (result?.success === false) {
      showFeedback("error", result.error || "Erreur lors du changement de statut.");
    } else {
      showFeedback("success", "Statut du module mis a jour.");
    }
  };

  return (
    <div className="mp-page">
      <div className="mp-page-header">
        <div>
          <div className="mp-breadcrumb">
            <i className="ti ti-circle-dot" style={{ fontSize: 10, color: "#1D9E75" }} aria-hidden="true"></i>
            PLATFORM ADMIN
          </div>
          <h1 className="mp-title">Modules plateforme</h1>
          <p className="mp-subtitle">Catalogue des modules activables et configuration SaaS.</p>
        </div>
        <button className="mp-refresh-btn" onClick={refetch} title="Actualiser" type="button">
          <i className="ti ti-refresh" aria-hidden="true"></i>
        </button>
      </div>

      {loading && <div className="mp-loading">Chargement du catalogue...</div>}
      {error && <div className="mp-error">{error}</div>}

      {feedback && <div className={`mp-feedback mp-feedback-${feedback.type}`}>{feedback.msg}</div>}

      {data && (
        <>
          <MpKpiBar data={data} />

          <div className="mp-layout">
            <div className="mp-col-main">
              <MpModuleTable
                modules={filteredModules}
                search={search}
                onSearch={setSearch}
                filter={filter}
                onFilter={setFilter}
                onEdit={handleEdit}
                onViewLicences={handleViewLicences}
                onToggle={handleToggle}
              />
              <MpAdoptionStats stats={data.adoption_stats || []} />
            </div>

            <div className="mp-col-side">
              <MpScoreCard data={data} />
              <MpChecklist checklist={data.checklist || []} />
              <MpCreateForm onCreate={handleCreate} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
