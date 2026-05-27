# Phase 6 - Super Root

## Objectif

Separer les responsabilites techniques reservees au Super Root de l'administration plateforme classique.

## App creee

`apps.super_root` est maintenant l'app backend dediee au niveau Super Root.

Services :

- `SuperRootDashboardService`
- `SuperRootPlatformService`
- `SuperRootSecurityService`
- `SuperRootMaintenanceService`

API :

- `GET /api/super-root/dashboard/`
- `GET /api/super-root/platform/`
- `GET /api/super-root/security/`
- `GET /api/super-root/maintenance/`
- `POST /api/super-root/maintenance/run/`

## Securite

Toutes les vues passent par l'auth existante puis verifient `user.is_super_root`.
Un administrateur plateforme classique ne peut pas utiliser ces endpoints.

## Integration

L'app est ajoutee a `INSTALLED_APPS` et exposee via `apps.core.api_urls`.
Les modeles existants restent dans leurs apps actuelles.

## Responsabilites couvertes

- dashboard global systeme ;
- supervision plateformes ;
- politiques securite globales ;
- maintenance et readiness ;
- actions reservees Super Root.
