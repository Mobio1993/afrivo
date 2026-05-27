# Phase 3 - Centralisation multi-tenant

## Objectif

Centraliser l'isolation hotel/organisation dans une facade unique, sans deplacer les modeles existants `Organization` et `Hotel`.

## Service central

Le point d'entree principal est maintenant :

```python
from apps.tenants.services.tenant_service import TenantService
```

`TenantService` couvre :

- resolution du tenant courant depuis la requete ;
- acces utilisateur vers les hotels et organisations ;
- listes des hotels et organisations accessibles ;
- verification d'appartenance hotel/organisation ;
- scoping queryset hotel/organisation via la compatibilite existante ;
- assertions metier avec `ValidationError`.

## Compatibilite

`apps.tenancy.utils` reste en place comme moteur historique et couche de compatibilite.
Les nouveaux modules doivent appeler `TenantService` au lieu d'importer directement `apps.tenancy.utils`.

## Adoption effectuee

Les imports applicatifs directs vers `apps.tenancy.utils` ont ete remplaces par `TenantService` dans :

- billing
- consumptions
- day_use
- guests
- history
- operations
- pos_restaurant
- reports
- rooms
- satisfaction
- tenancy middleware et permissions DRF

Les imports restants vers `apps.tenancy.utils` sont limites aux tests et a `ScopeService`, qui sert d'adaptateur de compatibilite interne.

## Regle pour la suite

Tout nouveau code multi-tenant doit passer par `TenantService`.
Si un comportement manque, il faut l'ajouter dans `TenantService` plutot que recoder une verification locale.
