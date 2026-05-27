# Phase 5 - Centralisation audit logs

## Objectif

Tous les evenements sensibles doivent passer par `apps.audit_logs` avant d'etre ecrits dans les stockages existants.

## Service central

Le point d'entree principal pour le nouveau code est :

```python
from apps.audit_logs.services import AuditService
```

Services specialises disponibles :

- `AuditLogService`
- `HotelAuditService`
- `PlatformAuditService`
- `PosAuditService`

## Stockages conserves

La phase ne deplace pas les modeles. Elle ecrit dans les tables existantes :

- `ActivityLog`
- `HistoryEntry`
- `PlatformAuditEvent`
- logger POS `pos_audit`
- logs IAM via `ActivityLog`

## Adoption effectuee

Les modules metier suivants ne consomment plus directement `apps.history.services` pour ecrire les logs :

- bookings
- billing
- consumptions
- day_use
- guests
- iam
- operations
- payments
- pos_restaurant
- rooms
- satisfaction
- stays
- tenancy
- users

Les evenements plateforme et licensing passent par `PlatformAuditService`.

## Compatibilite

`apps.history.services` reste le moteur historique interne pour `ActivityLog` et `HistoryEntry`.
Les imports directs restants sont limites aux helpers de lecture de timeline, aux tests, et a `apps.audit_logs` lui-meme.

## Regle pour la suite

Tout nouveau log sensible doit utiliser `AuditService` ou un service specialise de `apps.audit_logs.services`.
