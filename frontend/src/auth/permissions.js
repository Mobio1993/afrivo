const MODULES = [
  "dashboard",
  "clients",
  "rooms",
  "operations",
  "billing",
  "payments",
  "reports",
  "history",
  "users",
  "settings",
  "satisfaction",
  "platform_organizations",
  "platform_hotels",
  "platform_modules",
  "platform_licenses",
  "platform_subscriptions",
  "platform_users",
  "platform_security",
];

const ACTIONS = ["view", "create", "update", "delete", "manage"];
const BUSINESS_ACTION_FALLBACKS = {
  "rooms.block": ["rooms", "manage"],
  "rooms.unblock": ["rooms", "manage"],
  "rooms.maintenance": ["rooms", "manage"],
  "rooms.cleaning_complete": ["rooms", "update"],
  "operations.check_in": ["operations", "update"],
  "operations.check_out": ["operations", "update"],
  "operations.cancel": ["operations", "update"],
  "operations.no_show": ["operations", "update"],
  "operations.relocate": ["operations", "update"],
  "dayuse.check_in": ["operations", "update"],
  "dayuse.check_out": ["operations", "update"],
  "dayuse.cancel": ["operations", "update"],
  "payments.record": ["payments", "create"],
  "payments.correct": ["payments", "update"],
  "payments.refund": ["payments", "update"],
  "payments.cancel": ["payments", "update"],
  "billing.issue_invoice": ["billing", "update"],
  "billing.cancel_invoice": ["billing", "delete"],
  "billing.validate_invoice": ["billing", "update"],
  "reports.view_financial": ["reports", "view"],
  "reports.view_occupancy": ["reports", "view"],
  "reports.view_dayuse": ["reports", "view"],
  "reports.export": ["reports", "manage"],
  "housekeeping.assign": ["rooms", "update"],
  "housekeeping.start": ["rooms", "update"],
  "housekeeping.complete": ["rooms", "update"],
  "housekeeping.report_problem": ["rooms", "update"],
  "maintenance.create": ["rooms", "update"],
  "maintenance.resolve": ["rooms", "update"],
  "settings.update_hotel": ["settings", "update"],
  "settings.update_security": ["settings", "manage"],
  "settings.update_modules": ["settings", "manage"],
  "users.change_role": ["users", "update"],
  "users.reset_password": ["users", "manage"],
  "users.deactivate": ["users", "delete"],
};
const PLATFORM_MODULES = new Set([
  "platform_organizations",
  "platform_hotels",
  "platform_modules",
  "platform_licenses",
  "platform_subscriptions",
  "platform_users",
  "platform_security",
]);

const SUPER_ROOT_CODES = new Set(["super_root", "SUPER_ROOT"]);
const PLATFORM_ADMIN_CODES = new Set([
  "super_admin_platform",
  "platform_admin",
  "SUPER_ADMIN_PLATFORM",
  "PLATFORM_ADMIN",
]);
const HOTEL_ADMIN_CODES = new Set(["admin", "hotel_admin", "HOTEL_ADMIN"]);

function allow(view = false, create = false, update = false, remove = false, manage = false) {
  return {
    view,
    create,
    update,
    delete: remove,
    manage,
  };
}

const PLATFORM_ADMIN_FALLBACK_PERMISSIONS = {
  platform_organizations: allow(true, true, true),
  platform_hotels: allow(true, true, true),
  platform_modules: allow(true),
  platform_licenses: allow(true),
  platform_subscriptions: allow(true, true, true),
  platform_users: allow(true),
  platform_security: allow(true),
};

const ROLE_FALLBACK_PERMISSIONS = {
  admin: {
    dashboard: allow(true, true, true, true, true),
    clients: allow(true, true, true, true, true),
    rooms: allow(true, true, true, true, true),
    operations: allow(true, true, true, true, true),
    billing: allow(true, true, true, true, true),
    payments: allow(true, true, true, true, true),
    reports: allow(true, true, true, true, true),
    history: allow(true, false, false, false, true),
    users: allow(true, true, true, true, true),
    settings: allow(true, false, true, false, true),
    satisfaction: allow(true, true, true, true, true),
  },
  manager: {
    dashboard: allow(true),
    clients: allow(true, true, true),
    rooms: allow(true, true, true, false, true),
    operations: allow(true, true, true, false, true),
    billing: allow(true),
    payments: allow(true),
    reports: allow(true),
    history: allow(false),
    users: allow(false),
    settings: allow(false),
    satisfaction: allow(true),
  },
  reception: {
    dashboard: allow(true),
    clients: allow(true, true, true),
    rooms: allow(true),
    operations: allow(true, true, true),
    billing: allow(true),
    payments: allow(true, true, true),
    reports: allow(true),
    history: allow(false),
    users: allow(false),
    settings: allow(false),
    satisfaction: allow(true),
  },
  cashier: {
    dashboard: allow(true),
    clients: allow(true),
    rooms: allow(true),
    operations: allow(true),
    billing: allow(true, true, true),
    payments: allow(true, true, true),
    reports: allow(true),
    history: allow(false),
    users: allow(false),
    settings: allow(false),
    satisfaction: allow(true),
  },
  housekeeping: {
    dashboard: allow(true),
    clients: allow(false),
    rooms: allow(true, true, true),
    operations: allow(true, true, true),
    billing: allow(false),
    payments: allow(false),
    reports: allow(false),
    history: allow(false),
    users: allow(false),
    settings: allow(false),
    satisfaction: allow(false),
  },
  restaurant: {
    dashboard: allow(true),
    clients: allow(true),
    rooms: allow(true),
    operations: allow(true),
    billing: allow(true),
    payments: allow(true, true, true),
    reports: allow(true),
    history: allow(false),
    users: allow(false),
    settings: allow(false),
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
  if (roleCode === "hotel_admin") {
    return "admin";
  }
  return roleCode || "reception";
}

function normalizedCandidates(user) {
  if (!user) {
    return [];
  }
  return [
    user.role_code,
    user.role,
    user.platform_role,
    user.iam_role,
    user.is_super_root ? "super_root" : "",
  ].filter(Boolean);
}

export function isSuperRootUser(user) {
  return Boolean(
    user
    && (
      user.is_super_root === true
      || normalizedCandidates(user).some((code) => SUPER_ROOT_CODES.has(code))
    )
  );
}

export function isPlatformAdminUser(user) {
  return Boolean(
    user
    && (
      user.is_platform_admin === true
      || isSuperRootUser(user)
      || normalizedCandidates(user).some((code) => PLATFORM_ADMIN_CODES.has(code))
    )
  );
}

export function isHotelAdminUser(user) {
  return Boolean(
    user
    && (
      user.is_hotel_admin === true
      || normalizedCandidates(user).some((code) => HOTEL_ADMIN_CODES.has(code))
    )
  );
}

export function hasHierarchyAccess(user, hierarchy) {
  if (!user) {
    return false;
  }
  if (hierarchy === "super-root") {
    return isSuperRootUser(user);
  }
  if (hierarchy === "platform-admin") {
    return (
      isPlatformAdminUser(user)
      || Array.from(PLATFORM_MODULES).some((module) => hasPermission(user, module, "view"))
    );
  }
  if (hierarchy === "hotel-admin") {
    return isHotelAdminUser(user);
  }
  if (hierarchy === "pos-restaurant") {
    return hasPermission(user, "operations", "view") || hasPermission(user, "payments", "view");
  }
  return false;
}

export function getUserPermissions(user) {
  if (!user) {
    return buildEmptyPermissionMap();
  }

  const provided = user.permissions || {};
  const hasProvidedPermissions = Object.keys(provided).length > 0;

  if (isPlatformAdminUser(user) && !hasProvidedPermissions) {
    const isSuperAdminPlatform = isSuperRootUser(user) || user.platform_role === "super_admin_platform";
    return Object.fromEntries(
      MODULES.map((module) => [
        module,
        isSuperAdminPlatform && PLATFORM_MODULES.has(module)
          ? allow(true, true, true, true, true)
          : PLATFORM_ADMIN_FALLBACK_PERMISSIONS[module] || allow(),
      ])
    );
  }

  const roleCode = normalizeRoleCode(user.role_code || user.role);
  const fallback = ROLE_FALLBACK_PERMISSIONS[roleCode] || ROLE_FALLBACK_PERMISSIONS.reception;
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

function normalizeBusinessActionCode(actionCode) {
  if (actionCode === "*.*") {
    return "*.*";
  }
  if (!actionCode || !actionCode.includes(".")) {
    return "";
  }
  const [module, action] = actionCode.split(".", 2);
  const normalizedModule = {
    day_use: "dayuse",
    "day-use": "dayuse",
  }[module] || module;
  return `${normalizedModule}.${action}`;
}

export function canPerformAction(user, actionCode, { strict = true } = {}) {
  if (!user || !actionCode) {
    return false;
  }
  const normalizedAction = normalizeBusinessActionCode(actionCode);
  const businessPermissions = new Set(
    (user.business_permissions || user.businessPermissions || [])
      .map((permission) => normalizeBusinessActionCode(permission))
      .filter(Boolean)
  );
  if (businessPermissions.has("*.*") || businessPermissions.has(normalizedAction)) {
    return true;
  }
  const [module] = normalizedAction.split(".");
  if (businessPermissions.has(`${module}.manage`)) {
    return true;
  }
  const fallback = BUSINESS_ACTION_FALLBACKS[normalizedAction];
  if (!fallback) {
    return false;
  }
  const [fallbackModule, fallbackAction] = fallback;
  if (hasPermission(user, fallbackModule, "manage")) {
    return true;
  }
  return !strict && hasPermission(user, fallbackModule, fallbackAction);
}
