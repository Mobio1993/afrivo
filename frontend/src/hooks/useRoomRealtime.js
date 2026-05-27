import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchJson } from "../api/client";

const ENDPOINT = "/api/rooms/realtime/";
const POLL_INTERVAL_MS = 15000;

export function useRoomRealtime() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const selectedRoomRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson(ENDPOINT);
      setData(payload);
      setLastUpdate(new Date());
      const rooms = payload?.rooms || [];
      const current = selectedRoomRef.current;
      if (!current && rooms.length > 0) {
        setSelectedRoom(rooms[0]);
      } else if (current) {
        setSelectedRoom(rooms.find((room) => room.id === current.id) || rooms[0] || null);
      }
    } catch (err) {
      setError(err?.payload?.detail || err?.message || "Erreur de chargement temps reel");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
    intervalRef.current = window.setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalRef.current);
  }, [fetchData]);

  const filteredRooms = useMemo(() => {
    return (data?.rooms || []).filter((room) => {
      const query = search.trim().toLowerCase();
      const matchesSearch = !query || [
        room.numero,
        room.etat_hotelier_display,
        room.type_chambre_display,
        room.derniere_alerte_msg,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);

      const matchesFilter = filter === "all" ? true
        : filter === "occupees" ? room.etat_hotelier === "occupee"
        : filter === "disponibles" ? room.etat_hotelier === "disponible"
        : filter === "presence" ? room.presence_detectee
        : filter === "porte_ouverte" ? room.porte_statut === "ouverte"
        : filter === "alertes" ? Boolean(room.derniere_alerte_msg)
        : true;

      return matchesSearch && matchesFilter;
    });
  }, [data, filter, search]);

  useEffect(() => {
    if (selectedRoom && !filteredRooms.some((room) => room.id === selectedRoom.id)) {
      setSelectedRoom(filteredRooms[0] || null);
    }
  }, [filteredRooms, selectedRoom]);

  return {
    data,
    loading,
    error,
    lastUpdate,
    selectedRoom,
    setSelectedRoom,
    filter,
    setFilter,
    search,
    setSearch,
    filteredRooms,
    refetch: () => fetchData(false),
  };
}
