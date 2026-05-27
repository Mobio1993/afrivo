import { Navigate, Route } from "react-router-dom";

import {
  SuperRootAuditLogsPage,
  SuperRootBackupsPage,
  SuperRootDashboardPage,
  SuperRootDeveloperCenterPage,
  SuperRootHotelAuditPage,
  SuperRootHotelBillingPage,
  SuperRootHotelDetailPage,
  SuperRootHotelModulesPage,
  SuperRootHotelMonitoringPage,
  SuperRootHotelSecurityPage,
  SuperRootHotelsPage,
  SuperRootAiAutomationPage,
  SuperRootInfrastructurePage,
  SuperRootLicensesPage,
  SuperRootLoginPage,
  SuperRootMaintenancePage,
  SuperRootMfaPage,
  SuperRootModulesPage,
  SuperRootMonitoringPage,
  SuperRootNotificationsPage,
  SuperRootOrganizationsPage,
  SuperRootPermissionsPage,
  SuperRootPlatformsPage,
  SuperRootRolesPage,
  SuperRootSecurityAlertsPage,
  SuperRootSettingsPage,
  SuperRootUsersPage,
} from "../routes.jsx";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import RequireSuperRoot from "../../shared/guards/RequireSuperRoot";
import SuperRootLayout from "../../shared/layouts/SuperRootLayout";

export function getSuperRootRoutes() {
  return (
    <>
      <Route path="/super-root/login" element={<SuperRootLoginPage />} />
      <Route path="/super-root/mfa" element={<SuperRootMfaPage />} />
      <Route element={<ProtectedRoute loginPath="/super-root/login" />}>
        <Route path="/super-root" element={<RequireSuperRoot />}>
          <Route element={<SuperRootLayout />}>
            <Route index element={<Navigate to="/super-root/dashboard" replace />} />
            <Route path="dashboard" element={<SuperRootDashboardPage />} />
            <Route path="platforms" element={<SuperRootPlatformsPage section="platform" />} />
            <Route path="organizations" element={<SuperRootOrganizationsPage section="organizations" />} />
            <Route path="hotels" element={<SuperRootHotelsPage />} />
            <Route path="hotels/:hotelId" element={<SuperRootHotelDetailPage />} />
            <Route path="hotels/:hotelId/modules" element={<SuperRootHotelModulesPage />} />
            <Route path="hotels/:hotelId/security" element={<SuperRootHotelSecurityPage />} />
            <Route path="hotels/:hotelId/billing" element={<SuperRootHotelBillingPage />} />
            <Route path="hotels/:hotelId/monitoring" element={<SuperRootHotelMonitoringPage />} />
            <Route path="hotels/:hotelId/audit" element={<SuperRootHotelAuditPage />} />
            <Route path="users" element={<SuperRootUsersPage section="users" />} />
            <Route path="roles-permissions" element={<SuperRootRolesPage section="users" />} />
            <Route path="roles" element={<SuperRootRolesPage section="users" />} />
            <Route path="permissions" element={<SuperRootPermissionsPage section="users" />} />
            <Route path="licenses" element={<SuperRootLicensesPage section="licenses" />} />
            <Route path="modules" element={<SuperRootModulesPage section="modules" />} />
            <Route path="audit-logs" element={<SuperRootAuditLogsPage />} />
            <Route path="security" element={<SuperRootSecurityAlertsPage />} />
            <Route path="security-alerts" element={<SuperRootSecurityAlertsPage />} />
            <Route path="settings" element={<SuperRootSettingsPage />} />
            <Route path="maintenance" element={<SuperRootMaintenancePage />} />
            <Route path="monitoring" element={<SuperRootMonitoringPage />} />
            <Route path="infrastructure" element={<SuperRootInfrastructurePage />} />
            <Route path="notifications" element={<SuperRootNotificationsPage />} />
            <Route path="ai-automation" element={<SuperRootAiAutomationPage />} />
            <Route path="developer-center" element={<SuperRootDeveloperCenterPage />} />
            <Route path="backups" element={<SuperRootBackupsPage />} />
          </Route>
        </Route>
      </Route>
    </>
  );
}
