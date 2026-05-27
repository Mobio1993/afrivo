# Phase 7 - Frontend hierarchy wiring

## Objectif

Brancher progressivement le frontend autour des niveaux hierarchiques sans casser les routes existantes.

## Ce qui est en place

- `/platform/...` reste maintenu et continue d'utiliser les pages existantes.
- `src/pages/platform-admin/` reste la facade propre des ecrans platform admin.
- `src/pages/super-root/` contient maintenant des pages dediees au niveau Super Root, branchees sur les endpoints `/api/super-root/...`.
- `src/pages/hotel-admin/` est ajoute avec un premier alias `/hotel-admin/dashboard`.
- Les guards actuels restent en place (`ProtectedRoute`, `ModuleGuard`, `RequirePlatformAdmin`).
- Les checks de niveau hierarchique passent par `src/auth/permissions.js` et `src/auth/routePermissions.js`.
- Le sidebar separe visuellement les menus Super Root, Plateforme et Hotel.
- Le premier chemin autorise d'un Super Root devient `/super-root/dashboard`.

## Routes ajoutees

- `/super-root`
- `/super-root/dashboard`
- `/super-root/organizations`
- `/super-root/hotels`
- `/super-root/modules`
- `/super-root/licenses`
- `/super-root/subscriptions`
- `/super-root/users`
- `/super-root/security`
- `/super-root/maintenance`
- `/hotel-admin`
- `/hotel-admin/dashboard`

## Pages Super Root dediees

- `SuperRootDashboardPage`: supervision globale, KPIs et evenements recents.
- `SuperRootPlatformPage`: vue portefeuille pour organisations, hotels, modules, licences, abonnements et utilisateurs.
- `SuperRootSecurityPage`: comptes sensibles, 2FA, verrouillages et activite sensible.
- `SuperRootMaintenancePage`: readiness, healthcheck et actions de maintenance.

## Strategie de migration

1. Garder `/platform/...` comme route stable.
2. Basculer les imports internes vers `src/pages/platform-admin/` sans deplacer les anciens composants.
3. Brancher `/super-root/...` sur des pages dediees quand le besoin Super Root est distinct.
4. Garder les guards existants et remplacer progressivement les checks disperses par `hasPermission` / `hasHierarchyAccess`.
5. Continuer a faire valider l'acces par les permissions IAM centralisees.

## Verification

- Tests frontend auth: `npm test` - OK
- Build frontend: `npm run build` - OK
