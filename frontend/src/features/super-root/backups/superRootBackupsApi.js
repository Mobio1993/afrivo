import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootBackupsApi = {
  getBackups: () => httpClient.get(`${BASE}/backups/`),
};
