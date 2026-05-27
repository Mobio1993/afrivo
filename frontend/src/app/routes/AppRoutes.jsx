import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import {
  ActivityLogsPage,
  AccountSecurityPage,
  AllOperationsPage,
  BillingPage,
  BookingsPage,
  ClientsPage,
  DashboardPage,
  DayUsePage,
  ExploitationPage,
  HomePage,
  HotelAdminDashboardPage,
  LoginPage,
  OperationDetailPage,
  OperationsPage,
  PaymentsPage,
  PlatformDashboardPage,
  PlatformHotelsPage,
  PlatformLicensesPage,
  PlatformModulesPage,
  PlatformOrganizationsPage,
  PlatformSecurityPage,
  PlatformSubscriptionsPage,
  PlatformUsersPage,
  PosBillingPage,
  PosDashboardPage,
  PosKitchenPage,
  PosLoginPage,
  PosMenuPage,
  PosOrdersPage,
  PosPaymentsPage,
  PosReportsPage,
  PosServerDetailPage,
  PosServerPerformancePage,
  PosServerRankingPage,
  PosServerSalesPage,
  PosServersPage,
  PosSettingsPage,
  PosTablesPage,
  ReportsPage,
  ReservationPlanningPage,
  RoomsPage,
  RouteLoader,
  SettingsPage,
  SmartRoomsPage,
  StayDetailPage,
  UsersPage,
} from "../routes.jsx";
import { AppLayout } from "../../components/layout/AppLayout/AppLayout";
import { ModuleGuard } from "../../components/ModuleGuard";
import PosLayout from "../../components/pos-restaurant/PosLayout";
import { ProtectedRoute } from "../../components/ProtectedRoute";
import { getSuperRootRoutes } from "./SuperRootRoutes";

function guard(module, page, action = "view") {
  return (
    <ModuleGuard module={module} action={action}>
      {page}
    </ModuleGuard>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pos-restaurant/login" element={<PosLoginPage />} />
        <Route path="/pos-restaurant" element={<PosLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PosDashboardPage />} />
          <Route path="tables" element={<PosTablesPage />} />
          <Route path="orders" element={<PosOrdersPage />} />
          <Route path="menu" element={<PosMenuPage />} />
          <Route path="kitchen" element={<PosKitchenPage />} />
          <Route path="billing" element={<PosBillingPage />} />
          <Route path="payments" element={<PosPaymentsPage />} />
          <Route path="reports" element={<PosReportsPage />} />
          <Route path="servers" element={<PosServersPage />} />
          <Route path="servers/:serverId" element={<PosServerDetailPage />} />
          <Route path="servers/:serverId/sales" element={<PosServerSalesPage />} />
          <Route path="server-performance" element={<PosServerPerformancePage />} />
          <Route path="server-ranking" element={<PosServerRankingPage />} />
          <Route path="settings" element={<PosSettingsPage />} />
        </Route>

        {getSuperRootRoutes()}

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/welcome" element={guard("dashboard", <HomePage />)} />
            <Route path="/dashboard" element={guard("dashboard", <DashboardPage />)} />
            <Route path="/day-use" element={guard("operations", <DayUsePage />)} />
            <Route path="/clients" element={guard("clients", <ClientsPage />)} />
            <Route path="/rooms" element={guard("rooms", <RoomsPage />)} />
            <Route path="/smart-rooms" element={guard("rooms", <SmartRoomsPage />)} />
            <Route path="/reservation-planning" element={guard("operations", <ReservationPlanningPage />)} />
            <Route path="/billing" element={guard("billing", <BillingPage />)} />
            <Route path="/payments" element={guard("payments", <PaymentsPage />)} />
            <Route path="/exploitation" element={guard("operations", <ExploitationPage />)} />
            <Route path="/operations" element={guard("operations", <OperationsPage />)} />
            <Route path="/operations/all" element={guard("operations", <AllOperationsPage />)} />
            <Route path="/operations/bookings" element={guard("operations", <BookingsPage />)} />
            <Route path="/operations/stays/:stayId" element={guard("operations", <StayDetailPage />)} />
            <Route path="/operations/:entityType/:entityId" element={guard("operations", <OperationDetailPage />)} />
            <Route path="/reports" element={guard("reports", <ReportsPage />)} />
            <Route path="/history/activity-logs" element={guard("history", <ActivityLogsPage />)} />
            <Route path="/account/security" element={<AccountSecurityPage />} />
            <Route path="/users" element={guard("users", <UsersPage />)} />
            <Route path="/admin/utilisateurs" element={guard("users", <UsersPage />)} />
            <Route path="/settings" element={guard("settings", <SettingsPage />)} />
            <Route path="/hotel-admin" element={<Navigate to="/hotel-admin/dashboard" replace />} />
            <Route path="/hotel-admin/dashboard" element={guard("dashboard", <HotelAdminDashboardPage />)} />
            <Route path="/platform" element={guard("platform_security", <PlatformDashboardPage />)} />
            <Route path="/platform/organizations" element={guard("platform_organizations", <PlatformOrganizationsPage />)} />
            <Route path="/platform/hotels" element={guard("platform_hotels", <PlatformHotelsPage />)} />
            <Route path="/platform/modules" element={guard("platform_modules", <PlatformModulesPage />)} />
            <Route path="/platform/licenses" element={guard("platform_licenses", <PlatformLicensesPage />)} />
            <Route path="/platform/subscriptions" element={guard("platform_subscriptions", <PlatformSubscriptionsPage />)} />
            <Route path="/platform/users" element={guard("platform_users", <PlatformUsersPage />)} />
            <Route path="/platform/security" element={guard("platform_security", <PlatformSecurityPage />)} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
