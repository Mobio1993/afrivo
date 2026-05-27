import { useMemo, useState } from "react";

import VhRoomCard from "./VhRoomCard";

const FILTERS = [
  { key: "all", label: "Toutes" },
  { key: "dispo", label: "Disponibles" },
  { key: "occupe", label: "Occupees" },
  { key: "nettoyage", label: "Nettoyage" },
  { key: "depart", label: "Depart aujourd'hui" },
  { key: "alerte", label: "Alertes IoT" },
];

export default function VhRoomGrid({ rooms = [], onCheckout, onCheckin, onMarkClean, onBlock, onOpen }) {
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() => rooms.filter((room) => {
    if (filter === "dispo") return room.statut === "available" || room.statut === "reserved";
    if (filter === "occupe") return room.statut === "occupied";
    if (filter === "nettoyage") return room.statut === "cleaning";
    if (filter === "depart") return room.depart_aujourd_hui;
    if (filter === "alerte") return (room.porte_ouverte && room.porte_duree_min > 10) || (room.temperature !== null && room.temperature > 28);
    return true;
  }), [filter, rooms]);

  return (
    <div>
      <div className="vh-grid-toolbar">
        <span className="vh-grid-count">{filtered.length}/{rooms.length} chambres</span>
        <div className="vh-grid-filters">
          {FILTERS.map((item) => (
            <button key={item.key} type="button" className={`vh-filter-btn ${filter === item.key ? "active" : ""}`} onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="vh-room-grid">
        {filtered.map((room) => (
          <VhRoomCard
            key={room.id}
            room={room}
            onCheckout={onCheckout}
            onCheckin={onCheckin}
            onMarkClean={onMarkClean}
            onBlock={onBlock}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}
