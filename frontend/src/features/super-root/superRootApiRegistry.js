import { superRootAuditLogsApi } from "./audit-logs/superRootAuditLogsApi";
import { superRootBackupsApi } from "./backups/superRootBackupsApi";
import { superRootDashboardApi } from "./dashboard/superRootDashboardApi";
import { superRootHotelsApi } from "./hotels/superRootHotelsApi";
import { superRootLicensesApi } from "./licenses/superRootLicensesApi";
import { superRootMaintenanceApi } from "./maintenance/superRootMaintenanceApi";
import { superRootMonitoringApi } from "./monitoring/superRootMonitoringApi";
import { superRootModulesApi } from "./modules/superRootModulesApi";
import { superRootOrganizationsApi } from "./organizations/superRootOrganizationsApi";
import { superRootPlatformsApi } from "./platforms/superRootPlatformsApi";
import { superRootRolesPermissionsApi } from "./roles-permissions/superRootRolesPermissionsApi";
import { superRootSecurityApi } from "./security/superRootSecurityApi";
import { superRootSettingsApi } from "./settings/superRootSettingsApi";
import { superRootUsersApi } from "./users/superRootUsersApi";

const resourceLoaders = {
  dashboard: superRootDashboardApi.getDashboard,
  platform: superRootPlatformsApi.getPlatformOverview,
  platforms: superRootPlatformsApi.getPlatforms,
  organizations: superRootOrganizationsApi.listOrganizations,
  hotels: superRootHotelsApi.listHotels,
  users: superRootUsersApi.listUsers,
  roles: superRootRolesPermissionsApi.listRoles,
  permissions: superRootRolesPermissionsApi.listPermissions,
  licenses: superRootLicensesApi.listLicenses,
  modules: superRootModulesApi.listModules,
  "audit-logs": superRootAuditLogsApi.listAuditLogs,
  security: superRootSecurityApi.getSecurityReview,
  "security-alerts": superRootSecurityApi.listSecurityAlerts,
  settings: superRootSettingsApi.getSystemSettings,
  "system-settings": superRootSettingsApi.getSystemSettings,
  maintenance: superRootMaintenanceApi.getMaintenanceStatus,
  monitoring: superRootMonitoringApi.getMonitoring,
  backups: superRootBackupsApi.getBackups,
};

export function loadSuperRootResource(resource) {
  const loader = resourceLoaders[resource];
  if (!loader) {
    throw new Error(`Ressource Super Root inconnue: ${resource}`);
  }
  return loader();
}

export { superRootMaintenanceApi };
