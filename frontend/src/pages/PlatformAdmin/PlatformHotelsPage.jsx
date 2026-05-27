import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { usePlatformHotels } from "../../hooks/usePlatformHotels";
import PhAlertFeed from "../../components/platform-admin/hotels/PhAlertFeed";
import PhCreateModal from "../../components/platform-admin/hotels/PhCreateModal";
import PhDetailPanel from "../../components/platform-admin/hotels/PhDetailPanel";
import PhHotelList from "../../components/platform-admin/hotels/PhHotelList";
import PhKpiBar from "../../components/platform-admin/hotels/PhKpiBar";
import PhPlanStats from "../../components/platform-admin/hotels/PhPlanStats";
import "../../styles/platform-hotels.css";

export function PlatformHotelsPage() {
  const location = useLocation();
  const {
    data,
    organizations,
    loading,
    error,
    selectedHotel,
    setSelectedHotel,
    search,
    setSearch,
    filter,
    setFilter,
    filteredHotels,
    showCreate,
    setShowCreate,
    refetch,
    toggleHotelActive,
    createHotel,
    createAdmin,
  } = usePlatformHotels();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    const status = params.get("status") || "";
    const shouldCreate = params.get("create") === "1" || params.get("onboarding") === "1";
    if (q) setSearch(q);
    if (status === "active") setFilter("actifs");
    if (status === "inactive") setFilter("suspendus");
    if (shouldCreate) setShowCreate(true);
  }, [location.search, setFilter, setSearch, setShowCreate]);

  return (
    <div className="ph-page">
      <div className="ph-page-header">
        <div>
          <div className="ph-page-breadcrumb">
            <i className="ti ti-circle-dot" style={{ fontSize: 10, color: "#1D9E75" }} aria-hidden="true" />
            PLATFORM ADMIN
          </div>
          <h1 className="ph-page-title">Hotels abonnes</h1>
          <p className="ph-page-sub">Vue portefeuille du parc hotelier et des etats d'abonnement.</p>
        </div>
        <button className="ph-btn-primary" onClick={() => setShowCreate(true)}>
          <i className="ti ti-plus" aria-hidden="true" />
          Creer un hotel
        </button>
      </div>

      {loading && <div className="ph-loading">Chargement du dashboard...</div>}
      {error && <div className="ph-error">{error}</div>}

      {data && (
        <>
          <PhKpiBar data={data} />

          <div className="ph-layout">
            <div className="ph-col-main">
              <PhHotelList
                hotels={filteredHotels}
                selected={selectedHotel}
                onSelect={setSelectedHotel}
                search={search}
                onSearch={setSearch}
                filter={filter}
                onFilter={setFilter}
                onNew={() => setShowCreate(true)}
              />
            </div>

            <div className="ph-col-middle">
              <PhAlertFeed alertes={data.alertes || []} />
              <PhPlanStats
                statsPlans={data.stats_plans || {}}
                statsQuota={data.stats_quota || {}}
                total={data.hotels_total}
              />
            </div>

            <div className="ph-col-detail">
              <PhDetailPanel
                hotel={selectedHotel}
                onToggleStatus={toggleHotelActive}
                onCreateAdmin={createAdmin}
                onSuccess={refetch}
              />
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <PhCreateModal
          organizations={organizations}
          onClose={() => setShowCreate(false)}
          onCreate={createHotel}
          onSuccess={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
