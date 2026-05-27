import test from "node:test";
import assert from "node:assert/strict";

import {
  canPerformAction,
  canWriteModule,
  getUserPermissions,
  hasHierarchyAccess,
  hasPermission,
  isPlatformAdminUser,
  isSuperRootUser,
} from "./permissions.js";

test("super admin platform has full permissions only on platform modules", () => {
  const permissions = getUserPermissions({ is_platform_admin: true, platform_role: "super_admin_platform" });

  assert.equal(permissions.dashboard.manage, false);
  assert.equal(permissions.users.manage, false);
  assert.equal(permissions.reports.delete, false);
  assert.equal(permissions.platform_organizations.manage, true);
  assert.equal(permissions.platform_modules.manage, true);
  assert.equal(permissions.platform_licenses.manage, true);
});

test("platform admin has limited platform permissions by default", () => {
  const permissions = getUserPermissions({ is_platform_admin: true, platform_role: "platform_admin" });

  assert.equal(permissions.dashboard.manage, false);
  assert.equal(permissions.platform_organizations.update, true);
  assert.equal(permissions.platform_organizations.delete, false);
  assert.equal(permissions.platform_modules.manage, false);
  assert.equal(permissions.platform_security.manage, false);
});

test("platform admin provided backend permissions take precedence", () => {
  const permissions = getUserPermissions({
    is_platform_admin: true,
    permissions: {
      platform_modules: {
        view: true,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
    },
  });

  assert.equal(permissions.platform_modules.view, true);
  assert.equal(permissions.platform_modules.manage, false);
  assert.equal(permissions.platform_licenses.manage, false);
});

test("hierarchy helpers recognize super root and platform admin roles", () => {
  const superRoot = { is_super_root: true };
  const platformAdmin = { is_platform_admin: true, platform_role: "platform_admin" };
  const hotelAdmin = { role_code: "hotel_admin" };

  assert.equal(isSuperRootUser(superRoot), true);
  assert.equal(isPlatformAdminUser(superRoot), true);
  assert.equal(hasHierarchyAccess(superRoot, "super-root"), true);
  assert.equal(hasHierarchyAccess(platformAdmin, "platform-admin"), true);
  assert.equal(hasHierarchyAccess(hotelAdmin, "hotel-admin"), true);
  assert.equal(hasHierarchyAccess(hotelAdmin, "platform-admin"), false);
});

test("reception fallback permissions allow clients create but deny users manage", () => {
  const user = { role_code: "reception" };

  assert.equal(hasPermission(user, "clients", "create"), true);
  assert.equal(hasPermission(user, "operations", "update"), true);
  assert.equal(hasPermission(user, "users", "view"), false);
  assert.equal(hasPermission(user, "users", "manage"), false);
});

test("activity history fallback is restricted but backend permissions are respected", () => {
  const manager = { role_code: "manager" };
  const cashierWithOverride = {
    role_code: "cashier",
    permissions: {
      history: {
        view: true,
        create: false,
        update: false,
        delete: false,
        manage: true,
      },
    },
  };

  assert.equal(hasPermission({ role_code: "admin" }, "history", "view"), true);
  assert.equal(hasPermission(manager, "history", "view"), false);
  assert.equal(hasPermission(cashierWithOverride, "history", "view"), true);
  assert.equal(hasPermission(cashierWithOverride, "history", "manage"), true);
});

test("users fallback is restricted but backend permissions are respected", () => {
  const manager = { role_code: "manager" };
  const receptionWithOverride = {
    role_code: "reception",
    permissions: {
      users: {
        view: true,
        create: true,
        update: true,
        delete: false,
        manage: true,
      },
    },
  };

  assert.equal(hasPermission({ role_code: "admin" }, "users", "view"), true);
  assert.equal(hasPermission(manager, "users", "view"), false);
  assert.equal(hasPermission(receptionWithOverride, "users", "view"), true);
  assert.equal(hasPermission(receptionWithOverride, "users", "manage"), true);
});

test("settings module is only writable by admin roles", () => {
  const receptionWithOverride = {
    role_code: "reception",
    permissions: {
      settings: {
        view: true,
        create: false,
        update: true,
        delete: false,
        manage: true,
      },
    },
  };

  assert.equal(hasPermission({ role_code: "admin" }, "settings", "manage"), true);
  assert.equal(hasPermission({ role_code: "hotel_admin" }, "settings", "update"), true);
  assert.equal(hasPermission(receptionWithOverride, "settings", "view"), true);
  assert.equal(hasPermission(receptionWithOverride, "settings", "manage"), true);
});

test("provided permission overrides are respected", () => {
  const user = {
    role_code: "manager",
    permissions: {
      rooms: {
        view: true,
        create: false,
        update: false,
        delete: false,
        manage: false,
      },
    },
  };

  assert.equal(hasPermission(user, "rooms", "manage"), false);
  assert.equal(hasPermission(user, "rooms", "update"), false);
  assert.equal(hasPermission(user, "rooms", "view"), true);
});

test("canWriteModule returns false on read-only modules", () => {
  const user = { role_code: "housekeeping" };

  assert.equal(canWriteModule(user, "reports"), false);
  assert.equal(canWriteModule(user, "rooms"), true);
});

test("business permissions are evaluated from the canonical action list", () => {
  const receptionist = {
    role_code: "reception",
    business_permissions: ["operations.check_in", "dayuse.check_out", "payments.record"],
  };
  const accountant = {
    role_code: "cashier",
    business_permissions: ["payments.refund", "payments.cancel"],
  };

  assert.equal(canPerformAction(receptionist, "operations.check_in"), true);
  assert.equal(canPerformAction(receptionist, "payments.refund"), false);
  assert.equal(canPerformAction(accountant, "payments.refund"), true);
  assert.equal(canPerformAction(accountant, "operations.check_in"), false);
});

test("day use business actions stay distinct from generic operations actions", () => {
  const receptionist = {
    role_code: "reception",
    business_permissions: ["operations.check_in"],
  };
  const dayUseAgent = {
    role_code: "reception",
    business_permissions: ["day_use.check_in"],
  };

  assert.equal(canPerformAction(receptionist, "operations.check_in"), true);
  assert.equal(canPerformAction(receptionist, "dayuse.check_in"), false);
  assert.equal(canPerformAction(dayUseAgent, "dayuse.check_in"), true);
  assert.equal(canPerformAction(dayUseAgent, "day-use.check_in"), true);
});
