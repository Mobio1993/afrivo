# Frontend IAM/RBAC

Le frontend AFRIVO applique les permissions uniquement comme couche d'ergonomie:
masquage des routes, menus et boutons non autorises. La securite definitive reste
toujours cote Django/DRF.

## Regles appliquees

- Les routes connectees passent par `ProtectedRoute` et `canAccessPath`.
- Toute route non declaree dans `ROUTE_PERMISSION_RULES` est refusee par defaut.
- Les pages metier sont enveloppees par `ModuleGuard`.
- La sidebar et le topbar filtrent les entrees selon les modules visibles.
- Les actions operationnelles sensibles utilisent `canPerformAction` avec les codes
  IAM metier canoniques lorsque disponibles.
- Les boutons de gestion utilisateur sont conditionnes par les actions metier
  `users.change_role`, `users.reset_password` et `users.deactivate`.
- Les permissions frontend ne sont jamais considerees comme une autorisation
  definitive. Les permissions Django/DRF restent la source d'autorite.

## Matrice routes frontend -> permission backend attendue

| Route frontend | Guard React | Permission DRF/IAM attendue |
| --- | --- | --- |
| `/dashboard`, `/welcome` | `dashboard:view` | `dashboard.view` |
| `/clients` | `clients:view` | `clients.view` |
| `/rooms`, `/smart-rooms` | `rooms:view` | `rooms.view` |
| `/day-use` | `operations:view` | `operations.view` + actions `dayuse.*` cote API |
| `/reservation-planning` | `operations:view` | `operations.view` |
| `/exploitation`, `/operations`, `/operations/all`, `/operations/bookings`, `/operations/*` | `operations:view` | `operations.view` + actions metier cote API |
| `/billing` | `billing:view` | `billing.view` + actions `billing.*` / `payments.*` cote API |
| `/payments` | `payments:view` | `payments.view` + actions `payments.*` cote API |
| `/reports` | `reports:view` | `reports.view` + actions `reports.view_*` / `reports.export` cote API |
| `/history/activity-logs` | `history:view` | `history.view` |
| `/users`, `/admin/utilisateurs` | `users:view` | `users.view` + `can_manage_user` et actions `users.*` cote API |
| `/settings` | `settings:view` | `settings.view` + actions `settings.*` cote API |
| `/platform` | `platform_security:view` | `platform_security.view` |
| `/platform/organizations` | `platform_organizations:view` | `platform_organizations.view` |
| `/platform/hotels` | `platform_hotels:view` | `platform_hotels.view` |
| `/platform/modules` | `platform_modules:view` | `platform_modules.view` |
| `/platform/licenses` | `platform_licenses:view` | `platform_licenses.view` |
| `/platform/subscriptions` | `platform_subscriptions:view` | `platform_subscriptions.view` |
| `/platform/users` | `platform_users:view` | `platform_users.view` |
| `/platform/security` | `platform_security:view` | `platform_security.view` |
| `/account/security` | utilisateur connecte | endpoint compte limite a l'utilisateur courant |

## Actions sensibles couvertes

- Operations: `operations.check_in`, `operations.check_out`, `operations.cancel`,
  `operations.no_show`, `operations.relocate`.
- Day use: `dayuse.check_in`, `dayuse.check_out`, `dayuse.cancel`.
- Paiements: `payments.record`, `payments.correct`, `payments.refund`,
  `payments.cancel`.
- Chambres/housekeeping/maintenance: `rooms.cleaning_complete`,
  `housekeeping.start`, `housekeeping.complete`, `housekeeping.assign`,
  `housekeeping.report_problem`, `maintenance.create`, `maintenance.resolve`.
- Rapports: `reports.view_financial`, `reports.view_occupancy`,
  `reports.view_dayuse`.
- Utilisateurs: `users.change_role`, `users.reset_password`,
  `users.deactivate`.

## Tests

Les tests frontend IAM sont dans:

- `frontend/src/auth/permissions.test.js`
- `frontend/src/auth/routePermissions.test.js`

Le test `every protected app route has an IAM route rule` sert de garde-fou:
si une route protegee est ajoutee dans `App.jsx`, elle doit etre ajoutee dans
`ROUTE_PERMISSION_RULES` et documentee dans la matrice ci-dessus.

Commandes de verification:

```bash
npm test
npm run build
```
