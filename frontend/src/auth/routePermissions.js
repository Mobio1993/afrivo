import { hasPermission } from "./permissions.js";

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
    matcher: /^\/reports$/,
    requirements: [["reports", "view"]],
    fallbackPath: "/dashboard",
  },
  {
    matcher: /^\/users$/,
    requirements: [["users", "view"]],
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
    return true;
  }
  return rule.requirements.some(([module, action]) => hasPermission(user, module, action));
}

export function getFirstAllowedPath(user) {
  const preferredPaths = [
    "/dashboard",
    "/welcome",
    "/clients",
    "/rooms",
    "/exploitation",
    "/operations",
    "/reports",
    "/users",
    "/platform",
    "/platform/hotels",
    "/platform/organizations",
    "/platform/subscriptions",
    "/platform/users",
    "/platform/security",
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
