export const superRootHotelRoutes = [
  { path: "/super-root/hotels", hierarchy: "super-root", permission: ["platform_hotels", "view"] },
  { path: "/super-root/hotels/:hotelId", hierarchy: "super-root", permission: ["platform_hotels", "view"] },
  { path: "/super-root/hotels/:hotelId/modules", hierarchy: "super-root", permission: ["platform_hotels", "view"] },
  { path: "/super-root/hotels/:hotelId/security", hierarchy: "super-root", permission: ["platform_hotels", "view"] },
  { path: "/super-root/hotels/:hotelId/billing", hierarchy: "super-root", permission: ["platform_hotels", "view"] },
  { path: "/super-root/hotels/:hotelId/monitoring", hierarchy: "super-root", permission: ["platform_hotels", "view"] },
  { path: "/super-root/hotels/:hotelId/audit", hierarchy: "super-root", permission: ["platform_hotels", "view"] },
];
