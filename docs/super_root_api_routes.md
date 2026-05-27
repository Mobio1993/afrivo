# Super Root API routes

## Objectif

Exposer une facade API autonome pour le Super Root tout en reutilisant les couches existantes : IAM, tenants, licensing, audit logs et services Super Root.

Toutes les routes ci-dessous sont sous `/api/super-root/`.

## Routes disponibles

- `POST /auth/login/` : connexion reservee aux utilisateurs `is_super_root`.
- `POST /auth/logout/` : deconnexion via le mecanisme auth existant.
- `GET /dashboard/` : dashboard global systeme.
- `GET /platform/` : synthese historique conservee pour compatibilite frontend.
- `GET /platforms/` : vue plateforme globale.
- `GET /organizations/` : organisations et compteurs.
- `GET /hotels/` : hotels, abonnement et quota.
- `GET /users/` : utilisateurs tous scopes.
- `GET /roles/` : roles IAM.
- `GET /permissions/` : permissions IAM.
- `GET /licenses/` : licences modules.
- `GET /modules/` : modules plateforme.
- `GET /audit-logs/` : journaux d'activite et evenements plateforme.
- `GET /security/` : revue securite complete.
- `GET /security-alerts/` : alertes securite synthetiques.
- `GET /system-settings/` : configuration systeme non sensible.
- `GET /maintenance/` : statut maintenance.
- `POST /maintenance/run/` : actions de maintenance autorisees.
- `GET /backups/` : facade backup prete pour branchement infrastructure.

## Securite

- Les routes de lecture et maintenance utilisent `require_super_root`.
- Le login Super Root reutilise `AuthService` et refuse tout utilisateur non Super Root avant emission des tokens.
- Les modeles ne sont pas deplaces ; cette API reste une facade stable autour de l'existant.

## Verification

```bash
python manage.py check
python manage.py test apps.super_root --keepdb
python manage.py test apps.iam apps.tenants apps.licensing apps.pos_restaurant apps.super_root --keepdb
```

