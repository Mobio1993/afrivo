import { useVueHotel } from "../../../hooks/useVueHotel";
import VhKpiBar from "../../../components/chambres/vue-hotel/VhKpiBar";
import VhMovements from "../../../components/chambres/vue-hotel/VhMovements";
import VhOccupationBar from "../../../components/chambres/vue-hotel/VhOccupationBar";
import VhPriorityQueue from "../../../components/chambres/vue-hotel/VhPriorityQueue";
import VhRoomGrid from "../../../components/chambres/vue-hotel/VhRoomGrid";
import VhSmartAssign from "../../../components/chambres/vue-hotel/VhSmartAssign";
import "../../../styles/vue-hotel.css";

function toLegacyRoom(room) {
  return {
    id: room.id,
    number: room.numero,
    status: room.statut,
    room_type_name: room.type_chambre_display,
    floor: room.etage,
  };
}

export default function HotelViewPage({
  canCheckInRooms = false,
  canCheckOutRooms = false,
  canMarkCleanRooms = false,
  canCreateMaintenance = false,
  canStartHousekeeping = false,
  canCompleteHousekeeping = false,
  canAssignHousekeeping = false,
  onOpenRoom,
  onCheckIn,
  onCheckOut,
  onMarkClean,
  onMaintenance,
  onStartHousekeeping,
  onCompleteHousekeeping,
  onAssignHousekeeping,
}) {
  const { data, loading, error } = useVueHotel();

  const openRoom = (room) => onOpenRoom?.(toLegacyRoom(room));
  const checkIn = (room) => {
    if (canCheckInRooms) onCheckIn?.(toLegacyRoom(room));
  };
  const checkOut = (room) => {
    if (canCheckOutRooms) onCheckOut?.(toLegacyRoom(room));
  };
  const markClean = (room) => {
    if (canMarkCleanRooms) onMarkClean?.(toLegacyRoom(room));
  };
  const blockRoom = (room) => {
    if (canCreateMaintenance) {
      onMaintenance?.(toLegacyRoom(room));
    }
  };

  return (
    <section className="vh-page">
      {loading ? <div className="vh-loading">Chargement...</div> : null}
      {error ? <div className="vh-error">{error}</div> : null}

      {data ? (
        <>
          <VhKpiBar data={data} />

          <div className="vh-section">
            <VhOccupationBar data={data} />
          </div>

          <div className="vh-section">
            <VhRoomGrid
              rooms={data.rooms || []}
              onCheckout={checkOut}
              onCheckin={checkIn}
              onMarkClean={markClean}
              onBlock={blockRoom}
              onOpen={openRoom}
            />
          </div>

          <div className="vh-section">
            <VhMovements departs={data.departs_liste || []} arrivees={data.arrivees_liste || []} />
          </div>

          <div className="vh-bottom-row">
            <div className="vh-section-left">
              <VhSmartAssign suggestions={data.suggestions || []} onAssign={(suggestion) => onOpenRoom?.({ id: suggestion.chambre_id, number: suggestion.chambre_numero })} />
            </div>
            <div className="vh-section-right">
              <VhPriorityQueue
                tasks={data.files_prioritaires || []}
                onDemarrer={canStartHousekeeping ? (id) => onStartHousekeeping?.({ id }) : undefined}
                onTerminer={canCompleteHousekeeping ? (id) => onCompleteHousekeeping?.({ id }) : undefined}
                onAssigner={canAssignHousekeeping ? (id) => onAssignHousekeeping?.({ id }) : undefined}
              />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
