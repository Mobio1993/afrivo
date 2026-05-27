import { lazy } from "react";

const lazyNamed = (factory, exportName) =>
  lazy(() => factory().then((module) => ({ default: module[exportName] })));

export const ClientsPage = lazyNamed(() => import("../pages/ClientsPage/ClientsPage"), "ClientsPage");
export const AccountSecurityPage = lazyNamed(() => import("../pages/AccountSecurityPage/AccountSecurityPage"), "AccountSecurityPage");
export const ActivityLogsPage = lazyNamed(() => import("../pages/ActivityLogsPage/ActivityLogsPage"), "ActivityLogsPage");
export const AllOperationsPage = lazyNamed(() => import("../pages/AllOperationsPage/AllOperationsPage"), "AllOperationsPage");
export const BookingsPage = lazyNamed(() => import("../pages/BookingsPage/BookingsPage"), "BookingsPage");
export const DashboardPage = lazyNamed(() => import("../pages/DashboardPage/DashboardPage"), "DashboardPage");
export const DayUsePage = lazyNamed(() => import("../pages/DayUsePage/DayUsePage"), "DayUsePage");
export const ExploitationPage = lazyNamed(() => import("../pages/ExploitationPage/ExploitationPage"), "ExploitationPage");
export const HomePage = lazyNamed(() => import("../pages/HomePage/HomePage"), "HomePage");
export const LoginPage = lazyNamed(() => import("../pages/LoginPage/LoginPage"), "LoginPage");
export const OperationDetailPage = lazyNamed(() => import("../pages/OperationDetailPage/OperationDetailPage"), "OperationDetailPage");
export const OperationsPage = lazyNamed(() => import("../pages/OperationsPage/OperationsPage"), "OperationsPage");
export const ReportsPage = lazyNamed(() => import("../pages/ReportsPage/ReportsPage"), "ReportsPage");
export const RoomsPage = lazyNamed(() => import("../pages/RoomsPage/RoomsPage"), "RoomsPage");
export const SmartRoomsPage = lazyNamed(() => import("../pages/SmartRoomsPage/SmartRoomsPage"), "SmartRoomsPage");
export const BillingPage = lazyNamed(() => import("../modules/billing/pages/BillingPage"), "BillingPage");
export const PaymentsPage = lazyNamed(() => import("../pages/PaymentsPage/PaymentsPage"), "PaymentsPage");
export const ReservationPlanningPage = lazyNamed(
  () => import("../pages/ReservationPlanningPage/ReservationPlanningPage"),
  "ReservationPlanningPage",
);
export const StayDetailPage = lazyNamed(() => import("../pages/StayDetailPage/StayDetailPage"), "StayDetailPage");
export const UsersPage = lazyNamed(() => import("../pages/UsersPage/UsersPage"), "UsersPage");
export const SettingsPage = lazyNamed(() => import("../pages/SettingsPage/SettingsPage"), "SettingsPage");
export const PlatformDashboardPage = lazyNamed(() => import("../pages/platform-admin/PlatformAdminIndex"), "PlatformDashboardPage");
export const PlatformHotelsPage = lazyNamed(() => import("../pages/platform-admin/PlatformAdminIndex"), "PlatformHotelsPage");
export const PlatformLicensesPage = lazyNamed(() => import("../pages/platform-admin/PlatformAdminIndex"), "PlatformLicensesPage");
export const PlatformModulesPage = lazyNamed(() => import("../pages/platform-admin/PlatformAdminIndex"), "PlatformModulesPage");
export const PlatformOrganizationsPage = lazyNamed(() => import("../pages/platform-admin/PlatformAdminIndex"), "PlatformOrganizationsPage");
export const PlatformSecurityPage = lazyNamed(() => import("../pages/platform-admin/PlatformAdminIndex"), "PlatformSecurityPage");
export const PlatformSubscriptionsPage = lazyNamed(() => import("../pages/platform-admin/PlatformAdminIndex"), "PlatformSubscriptionsPage");
export const PlatformUsersPage = lazyNamed(() => import("../pages/platform-admin/PlatformAdminIndex"), "PlatformUsersPage");
export const SuperRootDashboardPage = lazyNamed(() => import("../features/super-root/dashboard"), "SuperRootDashboardPage");
export const SuperRootPlatformsPage = lazyNamed(() => import("../features/super-root/platforms"), "SuperRootPlatformsPage");
export const SuperRootHotelsPage = lazyNamed(() => import("../features/super-root/hotels"), "SuperRootHotelsPage");
export const SuperRootHotelDetailPage = lazyNamed(() => import("../features/super-root/hotels"), "SuperRootHotelDetailPage");
export const SuperRootHotelModulesPage = lazyNamed(() => import("../features/super-root/hotels"), "SuperRootHotelModulesPage");
export const SuperRootHotelSecurityPage = lazyNamed(() => import("../features/super-root/hotels"), "SuperRootHotelSecurityPage");
export const SuperRootHotelBillingPage = lazyNamed(() => import("../features/super-root/hotels"), "SuperRootHotelBillingPage");
export const SuperRootHotelMonitoringPage = lazyNamed(() => import("../features/super-root/hotels"), "SuperRootHotelMonitoringPage");
export const SuperRootHotelAuditPage = lazyNamed(() => import("../features/super-root/hotels"), "SuperRootHotelAuditPage");
export const SuperRootLicensesPage = lazyNamed(() => import("../features/super-root/licenses"), "SuperRootLicensesPage");
export const SuperRootMaintenancePage = lazyNamed(() => import("../features/super-root/maintenance"), "SuperRootMaintenancePage");
export const SuperRootMonitoringPage = lazyNamed(() => import("../features/super-root/monitoring"), "SuperRootMonitoringPage");
export const SuperRootInfrastructurePage = lazyNamed(() => import("../features/super-root/infrastructure"), "SuperRootInfrastructurePage");
export const SuperRootNotificationsPage = lazyNamed(() => import("../features/super-root/notifications"), "SuperRootNotificationsPage");
export const SuperRootAiAutomationPage = lazyNamed(() => import("../features/super-root/ai-automation"), "SuperRootAiAutomationPage");
export const SuperRootDeveloperCenterPage = lazyNamed(() => import("../features/super-root/developer-center"), "SuperRootDeveloperCenterPage");
export const SuperRootModulesPage = lazyNamed(() => import("../features/super-root/modules"), "SuperRootModulesPage");
export const SuperRootOrganizationsPage = lazyNamed(() => import("../features/super-root/organizations"), "SuperRootOrganizationsPage");
export const SuperRootAuditLogsPage = lazyNamed(() => import("../features/super-root/audit-logs"), "SuperRootAuditLogsPage");
export const SuperRootSecurityAlertsPage = lazyNamed(() => import("../features/super-root/security"), "SuperRootSecurityAlertsPage");
export const SuperRootSettingsPage = lazyNamed(() => import("../features/super-root/settings"), "SuperRootSettingsPage");
export const SuperRootBackupsPage = lazyNamed(() => import("../features/super-root/backups"), "SuperRootBackupsPage");
export const SuperRootRolesPage = lazyNamed(() => import("../features/super-root/roles-permissions"), "SuperRootRolesPage");
export const SuperRootPermissionsPage = lazyNamed(() => import("../features/super-root/roles-permissions"), "SuperRootPermissionsPage");
export const SuperRootUsersPage = lazyNamed(() => import("../features/super-root/users"), "SuperRootUsersPage");
export const HotelAdminDashboardPage = lazyNamed(() => import("../pages/hotel-admin/HotelAdminIndex"), "HotelAdminDashboardPage");
export const PosLoginPage = lazyNamed(() => import("../pages/pos-restaurant/PosLoginPage"), "PosLoginPage");
export const PosDashboardPage = lazyNamed(() => import("../pages/pos-restaurant/DashboardPage"), "DashboardPage");
export const PosTablesPage = lazyNamed(() => import("../pages/pos-restaurant/TablesPage"), "TablesPage");
export const PosOrdersPage = lazyNamed(() => import("../pages/pos-restaurant/OrdersPage"), "OrdersPage");
export const PosMenuPage = lazyNamed(() => import("../pages/pos-restaurant/MenuPage"), "MenuPage");
export const PosKitchenPage = lazyNamed(() => import("../pages/pos-restaurant/KitchenPage"), "KitchenPage");
export const PosBillingPage = lazyNamed(() => import("../pages/pos-restaurant/BillingPage"), "BillingPage");
export const PosPaymentsPage = lazyNamed(() => import("../pages/pos-restaurant/PaymentsPage"), "PaymentsPage");
export const PosReportsPage = lazyNamed(() => import("../pages/pos-restaurant/ReportsPage"), "ReportsPage");
export const PosServerDetailPage = lazyNamed(() => import("../pages/pos-restaurant/ServerDetailPage"), "ServerDetailPage");
export const PosServerPerformancePage = lazyNamed(() => import("../pages/pos-restaurant/ServerPerformancePage"), "ServerPerformancePage");
export const PosServerRankingPage = lazyNamed(() => import("../pages/pos-restaurant/ServerRankingPage"), "ServerRankingPage");
export const PosServerSalesPage = lazyNamed(() => import("../pages/pos-restaurant/ServerSalesPage"), "ServerSalesPage");
export const PosServersPage = lazyNamed(() => import("../pages/pos-restaurant/ServersPage"), "ServersPage");
export const PosSettingsPage = lazyNamed(() => import("../pages/pos-restaurant/SettingsPage"), "SettingsPage");
export const SuperRootLoginPage = lazyNamed(() => import("../features/super-root/auth/SuperRootLoginPage"), "SuperRootLoginPage");
export const SuperRootMfaPage = lazyNamed(() => import("../features/super-root/auth/SuperRootMfaPage"), "SuperRootMfaPage");

export function RouteLoader() {
  return (
    <div className="route-loader" role="status" aria-live="polite">
      Chargement...
    </div>
  );
}
