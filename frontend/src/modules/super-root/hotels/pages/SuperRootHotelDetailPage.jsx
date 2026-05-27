import { useState } from "react";

import SuperRootConfirmModal from "../../../../features/super-root/shared/SuperRootConfirmModal";
import { SuperRootPageShell, SuperRootState } from "../../../../features/super-root/shared/SuperRootShared";
import CriticalActions from "../audit/CriticalActions";
import { superRootHotelsApi } from "../api/superRootHotelsApi";
import HotelDetailLayout from "../detail/HotelDetailLayout";
import HotelOverview from "../detail/HotelOverview";
import { useHotelPageData } from "./useHotelPageData";

export default function SuperRootHotelDetailPage() {
  const { hotelId, data, loading, error, reload } = useHotelPageData(superRootHotelsApi.getHotelById);
  const [confirmAction, setConfirmAction] = useState(null);
  const [feedback, setFeedback] = useState("");
  const hotel = data?.hotel;

  async function runAction() {
    if (!confirmAction) return;
    setFeedback("");
    const reason = confirmAction.reason || "Action Super Root";
    try {
      if (confirmAction.type === "suspend") await superRootHotelsApi.suspendHotel(hotelId, reason);
      if (confirmAction.type === "reactivate") await superRootHotelsApi.reactivateHotel(hotelId, reason);
      if (confirmAction.type === "maintenance") await superRootHotelsApi.putHotelInMaintenance(hotelId, reason);
      setFeedback("Action executee avec succes.");
      setConfirmAction(null);
      await reload();
    } catch (err) {
      setFeedback(err.payload?.detail || err.message || "Action impossible.");
    }
  }

  return (
    <SuperRootPageShell title={hotel?.name || "Detail hotel"} subtitle="Vue globale Super Root du tenant hotelier.">
      <SuperRootState loading={loading} error={error}>
        {feedback ? <div className="sr-state">{feedback}</div> : null}
        <HotelDetailLayout hotelId={hotelId} hotel={hotel}>
          <div className="sr-grid-2">
            <CriticalActions
              hotel={hotel}
              onSuspend={() => setConfirmAction({ type: "suspend", title: "Suspendre cet hotel ?", reason: "Suspension Super Root" })}
              onReactivate={() => setConfirmAction({ type: "reactivate", title: "Reactiver cet hotel ?", reason: "Reactivation Super Root" })}
              onMaintenance={() => setConfirmAction({ type: "maintenance", title: "Mettre cet hotel en maintenance ?", reason: "Maintenance Super Root" })}
            />
          </div>
          <HotelOverview data={data || {}} />
        </HotelDetailLayout>
      </SuperRootState>

      {confirmAction ? (
        <SuperRootConfirmModal
          title={confirmAction.title}
          description="Cette action est critique et sera inscrite dans l'audit log Super Root."
          target={hotel?.name}
          risk={confirmAction.type === "suspend" ? "critical" : "high"}
          requiredPhrase="CONFIRMER"
          confirmLabel="Confirmer"
          onCancel={() => setConfirmAction(null)}
          onConfirm={runAction}
        />
      ) : null}
    </SuperRootPageShell>
  );
}
