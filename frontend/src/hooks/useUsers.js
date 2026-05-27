import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import {
  createUser as createUserRequest,
  deactivateUser as deactivateUserRequest,
  getUserStats,
  listUsers,
  setUserPassword as setUserPasswordRequest,
  updateUser as updateUserRequest,
} from "../services/usersService";

const INITIAL_STATS = { total: 0, active: 0, admins: 0, by_role: {} };

function usersReducer(state, action) {
  switch (action.type) {
    case "set":
      return action.users;
    case "upsert": {
      const exists = state.some((user) => user.id === action.user.id);
      if (exists) {
        return state.map((user) => (user.id === action.user.id ? action.user : user));
      }
      return [action.user, ...state];
    }
    case "deactivate":
      return state.map((user) => (
        user.id === action.userId ? { ...user, is_active: false } : user
      ));
    default:
      return state;
  }
}

function normalizeUsers(payload) {
  return Array.isArray(payload) ? payload : payload?.results || [];
}

export function useUsers(filters = {}) {
  const [users, dispatch] = useReducer(usersReducer, []);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const stableFilters = useMemo(() => filters, [
    filters.search,
    filters.role,
    filters.status,
  ]);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersPayload, statsPayload] = await Promise.all([
        listUsers(stableFilters),
        getUserStats(stableFilters),
      ]);
      dispatch({ type: "set", users: normalizeUsers(usersPayload) });
      setStats({ ...INITIAL_STATS, ...statsPayload });
    } catch (requestError) {
      setError(requestError.message || "Impossible de charger les utilisateurs.");
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, [stableFilters]);

  useEffect(() => {
    refetch().catch(() => {});
  }, [refetch]);

  const createUser = useCallback(async (payload) => {
    const user = await createUserRequest(payload);
    dispatch({ type: "upsert", user });
    return user;
  }, []);

  const updateUser = useCallback(async (userId, payload) => {
    const user = await updateUserRequest(userId, payload);
    dispatch({ type: "upsert", user });
    return user;
  }, []);

  const deactivateUser = useCallback(async (userId) => {
    await deactivateUserRequest(userId);
    dispatch({ type: "deactivate", userId });
  }, []);

  const setPassword = useCallback((userId, password) => {
    return setUserPasswordRequest(userId, password);
  }, []);

  return {
    users,
    stats,
    loading,
    error,
    refetch,
    createUser,
    updateUser,
    deactivateUser,
    setPassword,
  };
}
