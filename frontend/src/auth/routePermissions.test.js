import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessPath,
  getFirstAllowedPath,
  getRoutePermissionRule,
  resolveDeniedRedirect,
} from "./routePermissions.js";

const APP_PROTECTED_PATHS = [
  "/",
  "/welcome",
  "/dashboard",
  "/day-use",
  "/clients",
  "/rooms",
  "/smart-rooms",
  "/reservation-planning",
  "/billing",
  "/payments",
  "/exploitation",
  "/operations",
  "/operations/all",
  "/operations/bookings",
  "/operations/stays/42",
  "/operations/bookings/42",
  "/reports",
  "/history/activity-logs",
  "/account/security",
  "/users",
  "/admin/utilisateurs",
  "/settings",
  "/pos-restaurant/dashboard",
  "/pos-restaurant/tables",
  "/platform",
  "/platform/organizations",
  "/platform/hotels",
  "/platform/modules",
  "/platform/licenses",
  "/platform/subscriptions",
  "/platform/users",
  "/platform/security",
  "/super-root",
  "/super-root/dashboard",
  "/super-root/platforms",
  "/super-root/organizations",
  "/super-root/hotels",
  "/super-root/modules",
  "/super-root/licenses",
  "/super-root/users",
  "/super-root/roles-permissions",
  "/super-root/roles",
  "/super-root/permissions",
  "/super-root/audit-logs",
  "/super-root/security",
  "/super-root/security-alerts",
  "/super-root/settings",
  "/super-root/maintenance",
  "/super-root/backups",
  "/hotel-admin",
  "/hotel-admin/dashboard",
];

test("every protected app route has an IAM route rule", () => {
  for (const path of APP_PROTECTED_PATHS) {
    assert.ok(getRoutePermissionRule(path), `${path} must be declared in ROUTE_PERMISSION_RULES`);
  }
});

test("getRoutePermissionRule matches operations detail routes", () => {
  const rule = getRoutePermissionRule("/operations/stay/42");

  assert.ok(rule);
  assert.equal(rule.fallbackPath, "/dashboard");
});

test("getRoutePermissionRule covers secondary protected hotel routes", () => {
  assert.ok(getRoutePermissionRule("/smart-rooms"));
  assert.ok(getRoutePermissionRule("/reservation-planning"));
  assert.ok(getRoutePermissionRule("/admin/utilisateurs"));
  assert.ok(getRoutePermissionRule("/pos-restaurant/dashboard"));
  assert.ok(getRoutePermissionRule("/super-root/dashboard"));
  assert.ok(getRoutePermissionRule("/super-root/platforms"));
  assert.ok(getRoutePermissionRule("/super-root/maintenance"));
  assert.ok(getRoutePermissionRule("/super-root/backups"));
  assert.ok(getRoutePermissionRule("/hotel-admin/dashboard"));
});

test("super root auth routes stay outside protected route permission rules", () => {
  assert.equal(getRoutePermissionRule("/super-root/login"), null);
  assert.equal(getRoutePermissionRule("/super-root/mfa"), null);
});

test("unknown protected paths are denied by default", () => {
  const user = { role_code: "admin" };

  assert.equal(canAccessPath(user, "/unregistered-sensitive-page"), false);
});

test("super admin platform can access platform routes only", () => {
  const user = { is_platform_admin: true, platform_role: "super_admin_platform" };

  assert.equal(canAccessPath(user, "/dashboard"), false);
  assert.equal(canAccessPath(user, "/clients"), false);
  assert.equal(canAccessPath(user, "/rooms"), false);
  assert.equal(canAccessPath(user, "/reports"), false);
  assert.equal(canAccessPath(user, "/users"), false);
  assert.equal(canAccessPath(user, "/settings"), false);
  assert.equal(canAccessPath(user, "/platform"), true);
  assert.equal(canAccessPath(user, "/platform/organizations"), true);
  assert.equal(canAccessPath(user, "/platform/modules"), true);
  assert.equal(canAccessPath(user, "/platform/licenses"), true);
  assert.equal(canAccessPath(user, "/account/security"), true);
});

test("super root aliases use the same IAM platform permissions", () => {
  const user = { is_super_root: true };
  const platformAdmin = { is_platform_admin: true, platform_role: "platform_admin" };

  assert.equal(canAccessPath(user, "/super-root"), true);
  assert.equal(canAccessPath(user, "/super-root/dashboard"), true);
  assert.equal(canAccessPath(user, "/super-root/platforms"), true);
  assert.equal(canAccessPath(user, "/super-root/hotels"), true);
  assert.equal(canAccessPath(user, "/super-root/roles-permissions"), true);
  assert.equal(canAccessPath(user, "/super-root/roles"), true);
  assert.equal(canAccessPath(user, "/super-root/permissions"), true);
  assert.equal(canAccessPath(user, "/super-root/audit-logs"), true);
  assert.equal(canAccessPath(user, "/super-root/security"), true);
  assert.equal(canAccessPath(user, "/super-root/security-alerts"), true);
  assert.equal(canAccessPath(user, "/super-root/settings"), true);
  assert.equal(canAccessPath(user, "/super-root/maintenance"), true);
  assert.equal(canAccessPath(user, "/super-root/backups"), true);
  assert.equal(getFirstAllowedPath(user), "/super-root/dashboard");
  assert.equal(canAccessPath(user, "/hotel-admin/dashboard"), false);
  assert.equal(canAccessPath(platformAdmin, "/super-root/dashboard"), false);
});

test("hotel admin alias keeps existing dashboard permission guard", () => {
  const user = { role_code: "hotel_admin" };

  assert.equal(canAccessPath(user, "/hotel-admin"), true);
  assert.equal(canAccessPath(user, "/hotel-admin/dashboard"), true);
  assert.equal(canAccessPath(user, "/super-root/dashboard"), false);
  assert.equal(canAccessPath({ role_code: "reception" }, "/hotel-admin/dashboard"), false);
});

test("missing role falls back to reception permissions for route access", () => {
  const user = {};

  assert.equal(canAccessPath(user, "/dashboard"), true);
  assert.equal(canAccessPath(user, "/rooms"), true);
  assert.equal(canAccessPath(user, "/reports"), true);
  assert.equal(canAccessPath(user, "/users"), false);
  assert.equal(canAccessPath(user, "/settings"), false);
  assert.equal(canAccessPath(user, "/account/security"), true);
});

test("housekeeping is redirected away from reports to the first allowed path", () => {
  const user = { role_code: "housekeeping" };

  assert.equal(canAccessPath(user, "/reports"), false);
  assert.equal(resolveDeniedRedirect(user, "/reports"), "/dashboard");
});

test("user with only clients access is redirected to clients", () => {
  const user = {
    role_code: "housekeeping",
    permissions: {
      clients: {
        view: true,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
      dashboard: {
        view: false,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
      rooms: {
        view: false,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
      operations: {
        view: false,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
      billing: {
        view: false,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
      reports: {
        view: false,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
      users: {
        view: false,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
      satisfaction: {
        view: false,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
    },
  };

  assert.equal(getFirstAllowedPath(user), "/clients");
  assert.equal(resolveDeniedRedirect(user, "/users"), "/clients");
});
