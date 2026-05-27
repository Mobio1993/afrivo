import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createPlatformHotel,
  createPlatformHotelAdmin,
  getPlatformHotelsDashboard,
  listPlatformOrganizations,
  reactivatePlatformHotel,
  suspendPlatformHotel,
  updatePlatformHotel,
} from "../services/platformAdminService";

export function usePlatformHotels() {
  const [data, setData] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [dashboardPayload, organizationsPayload] = await Promise.all([
        getPlatformHotelsDashboard(),
        listPlatformOrganizations(),
      ]);
      setData(dashboardPayload);
      setOrganizations(organizationsPayload.results || []);
      setSelectedHotel((current) => {
        if (current && dashboardPayload.hotels?.some((hotel) => hotel.id === current.id)) {
          return dashboardPayload.hotels.find((hotel) => hotel.id === current.id);
        }
        return dashboardPayload.hotels?.[0] || null;
      });
    } catch (err) {
      setError(err.message || "Erreur de chargement du dashboard hotels");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  const filteredHotels = useMemo(() => {
    return (data?.hotels || []).filter((hotel) => {
      const term = search.trim().toLowerCase();
      const matchSearch = !term
        || [hotel.nom, hotel.code, hotel.organisation_nom, hotel.ville, hotel.pays]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      const matchFilter = filter === "all" ? true
        : filter === "actifs" ? hotel.statut === "actif"
        : filter === "suspendus" ? hotel.statut === "suspendu"
        : filter === "critique" ? hotel.quota_statut === "critique"
        : filter === "sans_admin" ? hotel.admins_count === 0
        : true;

      return matchSearch && matchFilter;
    });
  }, [data?.hotels, filter, search]);

  const refresh = useCallback(() => fetchDashboard(false), [fetchDashboard]);

  const updateHotel = async (id, payload) => {
    try {
      const res = await updatePlatformHotel(id, payload);
      await fetchDashboard(true);
      return { success: true, data: res.hotel || res };
    } catch (err) {
      return { success: false, error: err.message || "Erreur mise a jour" };
    }
  };

  const toggleHotelActive = async (hotel) => {
    try {
      if (hotel.statut === "actif") {
        await suspendPlatformHotel(hotel.id);
      } else {
        await reactivatePlatformHotel(hotel.id);
      }
      await fetchDashboard(true);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || "Erreur changement statut" };
    }
  };

  const createHotel = async (formData) => {
    try {
      const hotelPayload = {
        organization_id: Number(formData.organization_id),
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        slug: formData.slug.trim(),
        country: formData.country.trim(),
        city: formData.city.trim(),
        timezone: formData.timezone,
        currency: formData.currency,
        is_active: formData.is_active,
      };
      const res = await createPlatformHotel(hotelPayload);
      const createdHotel = res.hotel;

      if (createdHotel?.id && formData.admin_username.trim() && formData.admin_password) {
        await createPlatformHotelAdmin(createdHotel.id, {
          username: formData.admin_username.trim(),
          password: formData.admin_password,
          first_name: formData.admin_first_name.trim(),
          last_name: formData.admin_last_name.trim(),
          email: formData.admin_email.trim(),
          phone: formData.admin_phone.trim(),
        });
      }

      await fetchDashboard(true);
      return { success: true, data: createdHotel };
    } catch (err) {
      return { success: false, error: err.message || "Erreur creation" };
    }
  };

  const createAdmin = async (hotelId, adminData) => {
    try {
      const res = await createPlatformHotelAdmin(hotelId, adminData);
      await fetchDashboard(true);
      return { success: true, data: res.user || res };
    } catch (err) {
      return { success: false, error: err.message || "Erreur creation admin" };
    }
  };

  return {
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
    refetch: refresh,
    updateHotel,
    toggleHotelActive,
    createHotel,
    createAdmin,
  };
}
