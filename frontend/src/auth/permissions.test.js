import test from "node:test";
import assert from "node:assert/strict";

import { canWriteModule, getUserPermissions, hasPermission } from "./permissions.js";

test("platform admin has full permissions on every module", () => {
  const permissions = getUserPermissions({ is_platform_admin: true });

  assert.equal(permissions.dashboard.manage, true);
  assert.equal(permissions.users.manage, true);
  assert.equal(permissions.reports.delete, true);
});

test("reception fallback permissions allow clients create but deny users manage", () => {
  const user = { role_code: "reception" };

  assert.equal(hasPermission(user, "clients", "create"), true);
  assert.equal(hasPermission(user, "operations", "update"), true);
  assert.equal(hasPermission(user, "users", "manage"), false);
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
