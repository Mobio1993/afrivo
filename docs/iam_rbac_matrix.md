# IAM/RBAC AFRIVO

## Statut Phase 2

La Phase 2 IAM/RBAC introduit une matrice canonique de roles et de permissions metier fines.
Le backend reste l'autorite de securite. Le frontend utilise les memes permissions pour masquer les routes, menus et boutons, mais ne doit jamais etre considere comme une barriere de securite.

## Hierarchie canonique

| Niveau | Role canonique | Portee | Description |
|---:|---|---|---|
| 900 | `SUPER_ROOT` | Plateforme globale | Compte racine au-dessus de toute la plateforme. |
| 800 | `SUPER_ADMIN_PLATFORM` | Plateforme globale | Admin plateforme complet: organisations, hotels, licences, modules, securite. |
| 700 | `PLATFORM_ADMIN` | Plateforme limitee | Admin plateforme limite: lecture et operations non critiques. |
| 600 | `ORGANIZATION_ADMIN` | Organisation | Administration limitee a une organisation. |
| 500 | `HOTEL_ADMIN` | Hotel | Administration complete d'un hotel. |
| 400 | `HOTEL_MANAGER` | Hotel | Pilotage operationnel de l'hotel. |
| 300 | `RECEPTIONIST` | Hotel | Front office: clients, operations, check-in/out, paiements simples. |
| 300 | `ACCOUNTANT` | Hotel | Facturation, paiements, remboursements, rapports financiers. |
| 100 | `STAFF` | Hotel | Acces limite aux operations terrain. |
| 100 | `HOUSEKEEPING` | Hotel | Nettoyage et signalement de problemes chambre. |

## Mapping legacy vers IAM

| Role legacy | Role IAM canonique |
|---|---|
| `admin` | `HOTEL_ADMIN` |
| `manager` | `HOTEL_MANAGER` |
| `reception` | `RECEPTIONIST` |
| `cashier` | `ACCOUNTANT` |
| `housekeeping` | `STAFF` |
| `restaurant` | `STAFF` |

## Regles de gestion utilisateurs

Les actions de gestion utilisateur doivent passer par:

- `can_manage_user(actor, target)`
- `can_assign_role(actor, target, role_code, scope)`
- `can_perform_action(actor, action_code)`

Regles obligatoires:

- Un acteur ne peut pas creer, modifier, desactiver ou reinitialiser un compte de niveau egal ou superieur.
- Un acteur ne peut pas assigner un role de niveau egal ou superieur.
- `SUPER_ROOT` est le seul role autorise a gerer `SUPER_ROOT` et les roles critiques plateforme.
- Les admins hotel ne peuvent gerer que les utilisateurs de leur hotel.
- Les admins organisation ne peuvent gerer que les utilisateurs de leur organisation.
- Les restrictions frontend doivent toujours avoir leur equivalent backend.

## Permissions module

Les permissions module alimentent les routes et l'acces general:

| Module | Actions |
|---|---|
| `dashboard` | `read` |
| `clients` | `read`, `create`, `update`, `delete`, `manage` |
| `rooms` | `read`, `create`, `update`, `delete`, `manage` |
| `operations` | `read`, `create`, `update`, `delete`, `manage` |
| `billing` | `read`, `create`, `update`, `delete`, `manage` |
| `payments` | `read`, `create`, `update`, `delete`, `manage` |
| `reports` | `read`, `manage` |
| `users` | `read`, `create`, `update`, `delete`, `manage` |
| `settings` | `read`, `update`, `manage` |
| `platform_*` | Selon role plateforme |

Compatibilite:

- `build_user_permission_map()` conserve un fallback legacy par module.
- Les nouveaux droits critiques doivent utiliser les permissions metier fines ci-dessous.
- La migration progressive consiste a remplacer les decisions sensibles par `can_perform_action()`.

## Permissions metier fines

| Permission | Description | Roles autorises par defaut |
|---|---|---|
| `operations.check_in` | Effectuer un check-in reservation/sejour | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `RECEPTIONIST` |
| `operations.check_out` | Effectuer un check-out sejour | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `RECEPTIONIST` |
| `operations.cancel` | Annuler une operation hoteliere | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `operations.no_show` | Marquer une reservation no-show | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `operations.relocate` | Reloger reservation/sejour | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `dayuse.check_in` | Effectuer l'entree day use | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `RECEPTIONIST` |
| `dayuse.check_out` | Effectuer la sortie day use | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `RECEPTIONIST` |
| `dayuse.cancel` | Annuler un day use | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `payments.record` | Enregistrer un paiement | `HOTEL_ADMIN`, `RECEPTIONIST`, `ACCOUNTANT` |
| `payments.correct` | Corriger un paiement | `HOTEL_ADMIN`, `ACCOUNTANT` |
| `payments.refund` | Rembourser un paiement | `HOTEL_ADMIN`, `ACCOUNTANT` |
| `payments.cancel` | Annuler un paiement | `HOTEL_ADMIN`, `ACCOUNTANT` |
| `billing.issue_invoice` | Emettre/creer une facture | `HOTEL_ADMIN`, `ACCOUNTANT` |
| `billing.cancel_invoice` | Annuler une facture | `HOTEL_ADMIN`, `ACCOUNTANT` |
| `billing.validate_invoice` | Valider/corriger une facture | `HOTEL_ADMIN`, `ACCOUNTANT` |
| `rooms.block` | Bloquer une chambre | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `rooms.unblock` | Debloquer/reactiver une chambre | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `rooms.maintenance` | Gerer statut maintenance chambre | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `rooms.cleaning_complete` | Terminer un nettoyage | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `RECEPTIONIST`, `STAFF`, `HOUSEKEEPING` |
| `housekeeping.assign` | Assigner une tache menage | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `housekeeping.start` | Demarrer une tache menage | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `STAFF`, `HOUSEKEEPING` |
| `housekeeping.complete` | Terminer une tache menage | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `STAFF`, `HOUSEKEEPING` |
| `housekeeping.report_problem` | Signaler un probleme menage | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `STAFF`, `HOUSEKEEPING` |
| `maintenance.create` | Creer un incident maintenance | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `maintenance.resolve` | Resoudre un incident maintenance | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `reports.view_financial` | Consulter rapports financiers | `HOTEL_ADMIN`, `ACCOUNTANT` |
| `reports.view_occupancy` | Consulter rapports occupation | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `RECEPTIONIST` |
| `reports.view_dayuse` | Consulter rapports day use | `HOTEL_ADMIN`, `HOTEL_MANAGER`, `RECEPTIONIST` |
| `reports.export` | Exporter rapports | `HOTEL_ADMIN`, `ACCOUNTANT` |
| `settings.update_hotel` | Modifier parametres hotel | `HOTEL_ADMIN`, `HOTEL_MANAGER` |
| `settings.update_security` | Modifier parametres securite | `HOTEL_ADMIN` |
| `settings.update_modules` | Modifier parametres modules | `HOTEL_ADMIN` |
| `users.change_role` | Creer/modifier role utilisateur | `HOTEL_ADMIN` |
| `users.reset_password` | Reinitialiser mot de passe utilisateur | `HOTEL_ADMIN` |
| `users.deactivate` | Desactiver utilisateur | `HOTEL_ADMIN` |

## Endpoints sensibles et permissions requises

### Operations

| Endpoint | Permission metier |
|---|---|
| `POST /api/operations/bookings/{id}/check-in/` | `operations.check_in` |
| `POST /api/operations/stays/{id}/check-out/` | `operations.check_out` |
| `POST /api/operations/bookings/{id}/cancel/` | `operations.cancel` |
| `POST /api/operations/bookings/{id}/no-show/` | `operations.no_show` |
| `POST /api/operations/bookings/{id}/relocate/` | `operations.relocate` |
| `POST /api/operations/stays/{id}/relocate/` | `operations.relocate` |
| `POST /api/operations/day-use/{id}/check-in/` | `dayuse.check_in` |
| `POST /api/operations/day-use/{id}/check-out/` | `dayuse.check_out` |
| `POST /api/operations/payments/create/` | `payments.record` |
| `POST /api/operations/payments/{id}/` | `payments.correct` |
| `POST /api/operations/payments/{id}/refund/` | `payments.refund` |
| `POST /api/operations/payments/{id}/cancel/` | `payments.cancel` |

### Billing

| Endpoint | Permission metier |
|---|---|
| `POST /api/billing/client-invoices/` | `billing.validate_invoice` |
| `PATCH /api/billing/client-invoices/{id}/` | `billing.validate_invoice` |
| `DELETE /api/billing/client-invoices/{id}/` | `billing.cancel_invoice` |
| `POST /api/billing/client-invoices/{id}/issue/` | `billing.issue_invoice` |
| `POST /api/billing/client-invoices/{id}/cancel/` | `billing.cancel_invoice` |
| `POST /api/billing/client-invoices/{id}/add-payment/` | `payments.record` |
| `POST /api/billing/client-payments/` | `payments.record` |
| `PATCH /api/billing/client-payments/{id}/` | `payments.correct` |
| `DELETE /api/billing/client-payments/{id}/` | `payments.cancel` |
| `POST /api/billing/client-payments/{id}/cancel/` | `payments.cancel` |

### Rooms, housekeeping, maintenance

| Endpoint | Permission metier |
|---|---|
| `POST /api/rooms/{id}/complete-cleaning/` | `rooms.cleaning_complete` |
| `POST /api/rooms/{id}/reactivate/` | `rooms.unblock` |
| `POST /api/rooms/housekeeping/tasks/{id}/start/` | `housekeeping.start` |
| `POST /api/rooms/housekeeping/tasks/{id}/complete/` | `housekeeping.complete` |
| `POST /api/rooms/housekeeping/tasks/{id}/action/demarrer/` | `housekeeping.start` |
| `POST /api/rooms/housekeeping/tasks/{id}/action/terminer/` | `housekeeping.complete` |
| `POST /api/rooms/housekeeping/tasks/{id}/action/assigner/` | `housekeeping.assign` |
| `POST /api/rooms/housekeeping/tasks/{id}/action/signaler_probleme/` | `housekeeping.report_problem` |
| `POST /api/rooms/maintenance/incidents/` | `maintenance.create` |
| `POST /api/rooms/maintenance/incidents/{id}/resolve/` | `maintenance.resolve` |
| `POST /api/rooms/alerts/{id}/resolve/` | `maintenance.resolve` |

### Reports

| Endpoint | Permission metier |
|---|---|
| `GET /api/reports/financial/` | `reports.view_financial` |
| `GET /api/reports/occupancy/` | `reports.view_occupancy` |
| `GET /api/reports/day-use/` | `reports.view_dayuse` |
| `GET /api/reports/enhanced-stats/` | Au moins une permission rapport fine |

### Users and IAM

| Endpoint | Permission metier |
|---|---|
| `POST /api/users/` | `users.change_role` + `can_manage_user` |
| `PATCH /api/users/{id}/` | `users.change_role` + `can_manage_user` |
| `DELETE /api/users/{id}/` | `users.deactivate` + `can_manage_user` |
| `POST /api/users/{id}/set_password/` | `users.reset_password` + `can_manage_user` |
| `POST /api/iam/assign-role/` | `platform_security.manage` + `can_assign_role` |
| `POST /api/iam/revoke-role/` | `platform_security.manage` + `can_assign_role` |

## Frontend

Le backend expose:

- `permissions`: matrice module/action pour routes et menus.
- `business_permissions`: liste des permissions metier fines.

Helpers frontend:

- `hasPermission(user, module, action)`
- `canWriteModule(user, module)`
- `canPerformAction(user, actionCode, { strict })`

Regles frontend:

- Les routes utilisent principalement `hasPermission`.
- Les boutons sensibles utilisent `canPerformAction`.
- Toute action masquee cote frontend doit rester refusee cote backend si appelee directement.

## Tests minimum

Pour chaque permission sensible:

| Cas | Resultat attendu |
|---|---|
| Role autorise | `200`, `201` ou `204` |
| Role non autorise | `403` |
| Tenant different | `403` ou `404` selon endpoint |
| Role inferieur gerant role superieur | `403` |
| Frontend sans permission | Bouton/route non visible ou redirection |

Suites de verification Phase 2:

```bash
cd backend
python manage.py check
python manage.py test apps.users.tests.UserPermissionModelTests apps.users.tests.UserApiTests apps.users.tests.AuthIamEndpointTests --keepdb
python manage.py test apps.rooms.tests apps.billing.tests.ClientInvoiceApiTests apps.billing.tests.ClientPaymentApiTests --keepdb

cd ../frontend
npm test -- --runInBand
npm run build
```

## Maintenance de la matrice

Lorsqu'une nouvelle action sensible est ajoutee:

1. Creer un code permission metier clair: `module.verbe_metier`.
2. Ajouter le code dans `DEFAULT_IAM_ROLE_PERMISSION_CODES`.
3. Ajouter une migration de seed `IAMPermission` + `IAMRolePermission`.
4. Ajouter le code dans `BUSINESS_ACTION_FALLBACKS` si une compatibilite legacy est necessaire.
5. Proteger l'endpoint avec `can_perform_action()` ou `business_action_map`.
6. Exposer/masquer le bouton frontend avec `canPerformAction()`.
7. Ajouter un test autorise/refuse.
