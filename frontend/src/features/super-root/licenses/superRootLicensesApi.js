import { httpClient } from "../../../shared/api/httpClient";

const BASE = "/api/super-root";

export const superRootLicensesApi = {
  listLicenses: () => httpClient.get(`${BASE}/licenses/`),
};
