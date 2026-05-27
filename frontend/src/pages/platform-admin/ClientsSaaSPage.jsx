import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import CsChecklist from "../../components/platform-admin/clients-saas/CsChecklist";
import CsClientTable from "../../components/platform-admin/clients-saas/CsClientTable";
import CsCreateForm from "../../components/platform-admin/clients-saas/CsCreateForm";
import CsKpiBar from "../../components/platform-admin/clients-saas/CsKpiBar";
import CsScoreCard from "../../components/platform-admin/clients-saas/CsScoreCard";
import { useClientsSaaS } from "../../hooks/useClientsSaaS";
import "../../styles/clients-saas.css";

export default function ClientsSaaSPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    data,
    loading,
    error,
    search,
    setSearch,
    filter,
    setFilter,
    filteredClients,
    refetch,
    createClient,
  } = useClientsSaaS();

  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const client = params.get("client") || "";
    if (q) setSearch(q);
    if (client && data?.clients?.length) {
      const selected = data.clients.find((item) => String(item.id) === String(client));
      if (selected?.nom) setSearch(selected.nom);
    }
  }, [data?.clients, location.search, setSearch]);

  const handleCreate = async (formData) => {
    const result = await createClient(formData);
    if (result.success) {
      setFeedback({ type: "success", msg: "Client SaaS cree avec succes." });
    } else {
      setFeedback({ type: "error", msg: result.error || "Erreur de creation." });
    }
    window.setTimeout(() => setFeedback(null), 3500);
    return result;
  };

  const handleView = (client) => {
    navigate(`/platform/organizations?client=${client.id}`);
  };

  const handleEdit = (client) => {
    navigate(`/platform/organizations?client=${client.id}&edit=1`);
  };

  return (
    <div className="cs-page">
      <div className="cs-page-header">
        <div>
          <div className="cs-breadcrumb">
            <i className="ti ti-circle-dot" style={{ fontSize: 10, color: "#1D9E75" }} aria-hidden="true"></i>
            PLATFORM ADMIN
          </div>
          <h1 className="cs-title">Organisations</h1>
          <p className="cs-subtitle">Portefeuille client, parc hotels et readiness commerciale.</p>
        </div>
        <button className="cs-refresh-btn" onClick={refetch} title="Actualiser" aria-label="Actualiser">
          <i className="ti ti-refresh" aria-hidden="true"></i>
        </button>
      </div>

      {loading ? <div className="cs-loading">Chargement du portefeuille...</div> : null}
      {error ? <div className="cs-error">{error}</div> : null}

      {feedback ? <div className={`cs-feedback cs-feedback-${feedback.type}`}>{feedback.msg}</div> : null}

      {data ? (
        <>
          <CsKpiBar data={data} />

          <div className="cs-layout">
            <div className="cs-col-main">
              <CsClientTable
                clients={filteredClients}
                search={search}
                onSearch={setSearch}
                filter={filter}
                onFilter={setFilter}
                onView={handleView}
                onEdit={handleEdit}
              />
            </div>

            <div className="cs-col-side">
              <CsScoreCard data={data} />
              <CsChecklist checklist={data.checklist || []} />
              <CsCreateForm onCreate={handleCreate} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
