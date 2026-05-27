import { hasHierarchyAccess, hasPermission } from "./permissions.js";

export const ROUTE_PERMISSION_RULES = [
  {
    matcher: /^\/(?:welcome)?$/,
    requirements: [["dashboard", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/dashboard$/,
    requirements: [["dashboard", "view"]],
    fallbackPath: "/welcome",
  },
  {
    matcher: /^\/clients$/,
    requirements: [["clients", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/rooms$/,
    requirements: [["rooms", "view"], ["operations", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/smart-rooms$/,
    requirements: [["rooms", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/reservation-planning$/,
    requirements: [["operations", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/exploitation$/,
    requirements: [["operations", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/operations(?:\/.+)?$/,
    requirements: [["operations", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/day-use$/,
    requirements: [["operations", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/billing(?:\/.+)?$/,
    requirements: [["billing", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/payments(?:\/.+)?$/,
    requirements: [["payments", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/reports$/,
    requirements: [["reports", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/history\/activity-logs$/,
    requirements: [["history", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/account\/security$/,
    requirements: [],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/users$/,
    requirements: [["users", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/admin\/utilisateurs$/,
    requirements: [["users", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/settings$/,
    requirements: [["settings", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/pos-restaurant(?:\/.*)?$/,
    requirements: [],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/platform$/,
    requirements: [["platform_security", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/platform\/organizations$/,
    requirements: [["platform_organizations", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/platform\/hotels$/,
    requirements: [["platform_hotels", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/platform\/modules$/,
    requirements: [["platform_modules", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/platform\/licenses$/,
    requirements: [["platform_licenses", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/platform\/subscriptions$/,
    requirements: [["platform_subscriptions", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/platform\/users$/,
    requirements: [["platform_users", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/platform\/security$/,
    requirements: [["platform_security", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/super-root$/,
    hierarchy: "super-root",
    requirements: [["platform_security", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/super-root\/dashboard$/,
    hierarchy: "super-root",
    requirements: [["platform_security", "view"]],
    fallbackPath: "/platform",
  },
  {
    matcher: /^\/super-root\/platforms$/,
    hierarchy: "super-root",
    requirements: [["platform_security", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/organizations$/,
    hierarchy: "super-root",
    requirements: [["platform_organizations", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/hotels(?:\/\d+(?:\/(?:modules|security|billing|monitoring|audit))?)?$/,
    hierarchy: "super-root",
    requirements: [["platform_hotels", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/modules$/,
    hierarchy: "super-root",
    requirements: [["platform_modules", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/licenses$/,
    hierarchy: "super-root",
    requirements: [["platform_licenses", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/users$/,
    hierarchy: "super-root",
    requirements: [["platform_users", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/(?:roles-permissions|roles|permissions)$/,
    hierarchy: "super-root",
    requirements: [["platform_users", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/(?:audit-logs|security|security-alerts|settings|backups)$/,
    hierarchy: "super-root",
    requirements: [["platform_security", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/(?:monitoring|infrastructure|notifications|ai-automation|developer-center)$/,
    hierarchy: "super-root",
    requirements: [["platform_security", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/super-root\/maintenance$/,
    hierarchy: "super-root",
    requirements: [["platform_security", "manage"], ["platform_security", "view"]],
    fallbackPath: "/super-root/dashboard",
  },
  {
    matcher: /^\/hotel-admin$/,
    hierarchy: "hotel-admin",
    requirements: [["dashboard", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/hotel-admin\/dashboard$/,
    hierarchy: "hotel-admin",
    requirements: [["dashboard", "view"]],
    fallbackPath: "/dashboard",
  },
];

function normalizePathname(pathname) {
  if (!pathname) {
    return "/";
  }
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function getRoutePermissionRule(pathname) {
  const normalizedPathname = normalizePathname(pathname);
  return ROUTE_PERMISSION_RULES.find((rule) => rule.matcher.test(normalizedPathname)) || null;
}

export function canAccessPath(user, pathname) {
  const rule = getRoutePermissionRule(pathname);
  if (!rule) {
    return false;
  }
  if (rule.hierarchy && !hasHierarchyAccess(user, rule.hierarchy)) {
    return false;
  }
  if (!rule.requirements || rule.requirements.length === 0) {
    return true;
  }
  return rule.requirements.some(([module, action]) => hasPermission(user, module, action));
}

export function getFirstAllowedPath(user) {
  const preferredPaths = [
    "/super-root/dashboard",
    "/super-root/platforms",
    "/super-root/hotels",
    "/super-root/organizations",
    "/super-root/modules",
    "/super-root/licenses",
    "/super-root/users",
    "/super-root/roles-permissions",
    "/super-root/audit-logs",
    "/super-root/security",
    "/super-root/settings",
    "/super-root/maintenance",
    "/super-root/monitoring",
    "/super-root/infrastructure",
    "/super-root/notifications",
    "/super-root/ai-automation",
    "/super-root/developer-center",
    "/super-root/backups",
    "/dashboard",
    "/welcome",
    "/clients",
    "/rooms",
    "/smart-rooms",
    "/exploitation",
    "/operations",
    "/reservation-planning",
    "/payments",
    "/pos-restaurant/dashboard",
    "/reports",
    "/history/activity-logs",
    "/account/security",
    "/users",
    "/settings",
    "/platform",
    "/platform/hotels",
    "/platform/organizations",
    "/platform/modules",
    "/platform/licenses",
    "/platform/subscriptions",
    "/platform/users",
    "/platform/security",
    "/hotel-admin/dashboard",
  ];

  return preferredPaths.find((path) => canAccessPath(user, path)) || "/login";
}

export function resolveDeniedRedirect(user, pathname) {
  const rule = getRoutePermissionRule(pathname);
  const preferredFallback = rule?.fallbackPath;
  if (preferredFallback && canAccessPath(user, preferredFallback)) {
    return preferredFallback;
  }
  return getFirstAllowedPath(user);
}
