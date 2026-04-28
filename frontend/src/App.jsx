import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RequirePlatformAdmin } from "./components/RequirePlatformAdmin";

const lazyNamed = (factory, exportName) =>
  lazy(() => factory().then((module) => ({ default: module[exportName] })));

const ClientsPage = lazyNamed(() => import("./pages/ClientsPage/ClientsPage"), "ClientsPage");
const DashboardPage = lazyNamed(() => import("./pages/DashboardPage/DashboardPage"), "DashboardPage");
const ExploitationPage = lazyNamed(() => import("./pages/ExploitationPage/ExploitationPage"), "ExploitationPage");
const HomePage = lazyNamed(() => import("./pages/HomePage/HomePage"), "HomePage");
const LoginPage = lazyNamed(() => import("./pages/LoginPage/LoginPage"), "LoginPage");
const OperationDetailPage = lazyNamed(() => import("./pages/OperationDetailPage/OperationDetailPage"), "OperationDetailPage");
const OperationsPage = lazyNamed(() => import("./pages/OperationsPage/OperationsPage"), "OperationsPage");
const ReportsPage = lazyNamed(() => import("./pages/ReportsPage/ReportsPage"), "ReportsPage");
const RoomsPage = lazyNamed(() => import("./pages/RoomsPage/RoomsPage"), "RoomsPage");
const UsersPage = lazyNamed(() => import("./pages/UsersPage/UsersPage"), "UsersPage");
const PlatformDashboardPage = lazyNamed(() => import("./pages/PlatformAdmin/PlatformAdminIndex"), "PlatformDashboardPage");
const PlatformHotelsPage = lazyNamed(() => import("./pages/PlatformAdmin/PlatformAdminIndex"), "PlatformHotelsPage");
const PlatformOrganizationsPage = lazyNamed(() => import("./pages/PlatformAdmin/PlatformAdminIndex"), "PlatformOrganizationsPage");
const PlatformSecurityPage = lazyNamed(() => import("./pages/PlatformAdmin/PlatformAdminIndex"), "PlatformSecurityPage");
const PlatformSubscriptionsPage = lazyNamed(() => import("./pages/PlatformAdmin/PlatformAdminIndex"), "PlatformSubscriptionsPage");
const PlatformUsersPage = lazyNamed(() => import("./pages/PlatformAdmin/PlatformAdminIndex"), "PlatformUsersPage");

function RouteLoader() {
  return (
    <div className="route-loader" role="status" aria-live="polite">
      Chargement...
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/welcome" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/exploitation" element={<ExploitationPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/operations/:entityType/:entityId" element={<OperationDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/platform" element={<RequirePlatformAdmin><PlatformDashboardPage /></RequirePlatformAdmin>} />
            <Route path="/platform/organizations" element={<RequirePlatformAdmin><PlatformOrganizationsPage /></RequirePlatformAdmin>} />
            <Route path="/platform/hotels" element={<RequirePlatformAdmin><PlatformHotelsPage /></RequirePlatformAdmin>} />
            <Route path="/platform/subscriptions" element={<RequirePlatformAdmin><PlatformSubscriptionsPage /></RequirePlatformAdmin>} />
            <Route path="/platform/users" element={<RequirePlatformAdmin><PlatformUsersPage /></RequirePlatformAdmin>} />
            <Route path="/platform/security" element={<RequirePlatformAdmin><PlatformSecurityPage /></RequirePlatformAdmin>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
