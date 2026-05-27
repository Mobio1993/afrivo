import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootModulesApi = {
  listModules: () => httpClient.get(`${BASE}/modules/`),
};
