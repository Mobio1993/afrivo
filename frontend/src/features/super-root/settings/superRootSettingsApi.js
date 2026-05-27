import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootSettingsApi = {
  getSystemSettings: () => httpClient.get(`${BASE}/system-settings/`),
};
