import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessPath,
  getFirstAllowedPath,
  getRoutePermissionRule,
  resolveDeniedRedirect,
} from "./routePermissions.js";

test("getRoutePermissionRule matches operations detail routes", () => {
  const rule = getRoutePermissionRule("/operations/stay/42");

  assert.ok(rule);
  assert.equal(rule.fallbackPath, "/dashboard");
});

test("platform admin can access every guarded route", () => {
  const user = { is_platform_admin: true };

  assert.equal(canAccessPath(user, "/dashboard"), true);
  assert.equal(canAccessPath(user, "/clients"), true);
  assert.equal(canAccessPath(user, "/rooms"), true);
  assert.equal(canAccessPath(user, "/reports"), true);
  assert.equal(canAccessPath(user, "/users"), true);
});

test("missing role falls back to reception permissions for route access", () => {
  const user = {};

  assert.equal(canAccessPath(user, "/dashboard"), true);
  assert.equal(canAccessPath(user, "/rooms"), true);
  assert.equal(canAccessPath(user, "/reports"), true);
  assert.equal(canAccessPath(user, "/users"), true);
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
