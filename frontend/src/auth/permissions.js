const MODULES = [
  "dashboard",
  "clients",
  "rooms",
  "operations",
  "billing",
  "reports",
  "users",
  "satisfaction",
  "platform_organizations",
  "platform_hotels",
  "platform_subscriptions",
  "platform_users",
  "platform_security",
];

const ACTIONS = ["view", "create", "update", "delete", "manage"];

function allow(view = false, create = false, update = false, remove = false, manage = false) {
  return {
    view,
    create,
    update,
    delete: remove,
    manage,
  };
}

const ROLE_FALLBACK_PERMISSIONS = {
  admin: {
    dashboard: allow(true, true, true, true, true),
    clients: allow(true, true, true, true, true),
    rooms: allow(true, true, true, true, true),
    operations: allow(true, true, true, true, true),
    billing: allow(true, true, true, true, true),
    reports: allow(true, true, true, true, true),
    users: allow(true, true, true, true, true),
    satisfaction: allow(true, true, true, true, true),
  },
  manager: {
    dashboard: allow(true),
    clients: allow(true, true, true),
    rooms: allow(true, true, true, false, true),
    operations: allow(true, true, true, false, true),
    billing: allow(true),
    reports: allow(true),
    users: allow(true),
    satisfaction: allow(true),
  },
  reception: {
    dashboard: allow(true),
    clients: allow(true, true, true),
    rooms: allow(true),
    operations: allow(true, true, true),
    billing: allow(true),
    reports: allow(true),
    users: allow(true),
    satisfaction: allow(true),
  },
  cashier: {
    dashboard: allow(true),
    clients: allow(true),
    rooms: allow(true),
    operations: allow(true),
    billing: allow(true, true, true),
    reports: allow(true),
    users: allow(true),
    satisfaction: allow(true),
  },
  housekeeping: {
    dashboard: allow(true),
    clients: allow(false),
    rooms: allow(true, true, true),
    operations: allow(true, true, true),
    billing: allow(false),
    reports: allow(false),
    users: allow(false),
    satisfaction: allow(false),
  },
  restaurant: {
    dashboard: allow(true),
    clients: allow(true),
    rooms: allow(true),
    operations: allow(true),
    billing: allow(true),
    reports: allow(true),
    users: allow(false),
    satisfaction: allow(true),
  },
};

function buildEmptyPermissionMap() {
  return Object.fromEntries(MODULES.map((module) => [module, allow()]));
}

function normalizeRoleCode(roleCode) {
  if (roleCode === "receptionist") {
    return "reception";
  }
  return roleCode || "reception";
}

export function getUserPermissions(user) {
  if (!user) {
    return buildEmptyPermissionMap();
  }

  if (user.is_platform_admin) {
    return Object.fromEntries(MODULES.map((module) => [module, allow(true, true, true, true, true)]));
  }

  const roleCode = normalizeRoleCode(user.role_code || user.role);
  const fallback = ROLE_FALLBACK_PERMISSIONS[roleCode] || ROLE_FALLBACK_PERMISSIONS.reception;
  const provided = user.permissions || {};
  const base = buildEmptyPermissionMap();

  for (const module of MODULES) {
    const fallbackModule = fallback[module] || allow();
    const providedModule = provided[module] || {};
    base[module] = {
      view: Boolean(providedModule.view ?? fallbackModule.view),
      create: Boolean(providedModule.create ?? fallbackModule.create),
      update: Boolean(providedModule.update ?? fallbackModule.update),
      delete: Boolean(providedModule.delete ?? fallbackModule.delete),
      manage: Boolean(providedModule.manage ?? fallbackModule.manage),
    };
  }

  return base;
}

export function hasPermission(user, module, action = "view") {
  if (!MODULES.includes(module) || !ACTIONS.includes(action)) {
    return false;
  }
  const permissionMap = getUserPermissions(user);
  return Boolean(permissionMap[module]?.[action]);
}

export function canWriteModule(user, module) {
  return (
    hasPermission(user, module, "create")
    || hasPermission(user, module, "update")
    || hasPermission(user, module, "delete")
    || hasPermission(user, module, "manage")
  );
}
