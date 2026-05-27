import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root/auth";

export const superRootAuthApi = {
  login: (credentials) => httpClient.post(`${BASE}/login/`, credentials),
  logout: () => httpClient.post(`${BASE}/logout/`, {}),
};
