# Phase 2 - Centralisation des permissions IAM

## Objectif

Tous les modules applicatifs doivent passer par `PermissionService` pour les regles IAM, sans importer directement `apps.users.access`.

`apps.users.access` reste le moteur historique interne. Il est maintenant encapsule derriere :

```python
from apps.iam.services.permission_service import PermissionService
```

## Modules traites

- `platform_admin`
- `pos_restaurant`
- `users`
- `rooms`
- `billing`
- `operations`

## Modules hors liste egalement alignes

Pour respecter l'objectif d'une seule source metier IAM, les imports directs restants ont aussi ete remplaces dans :

- `reports`
- `day_use`
- `guests`

## Etat final

Le seul import direct restant vers `apps.users.access` est dans :

- `apps.iam.services.permission_service`

C'est volontaire : IAM est la facade officielle et centralisee.

## Verification

- `python manage.py check`
- `python manage.py makemigrations --check --dry-run`
