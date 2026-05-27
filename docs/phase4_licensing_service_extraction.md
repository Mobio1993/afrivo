# Phase 4 - Extraction licensing

## Objectif

Faire de `apps.licensing` la couche metier stable pour les abonnements, plans et licences modules.
Les modeles restent temporairement dans `apps.platform_admin.models`.

## Services centraux

Les nouveaux points d'entree sont :

- `apps.licensing.services.plan_service.PlanService`
- `apps.licensing.services.subscription_service.SubscriptionService`
- `apps.licensing.services.module_license_service.ModuleLicenseService`
- `apps.licensing.services.license_service.LicenseService`

## Responsabilites centralisees

`PlanService` :

- lecture des plans ;
- quotas utilisateurs ;
- quotas hotels ;
- detection des plans sans limite.

`SubscriptionService` :

- abonnements actifs ;
- quota utilisateurs par hotel ;
- usage quota ;
- expiration d'abonnement ;
- renouvellement ;
- changement de plan ;
- lifecycle automatique.

`ModuleLicenseService` :

- lecture des modules ;
- lecture des licences ;
- acces module ;
- expiration effective des licences ;
- renouvellement ;
- suspension.

`LicenseService` :

- facade unifiee pour le nouveau code.

## Compatibilite

Les anciens chemins restent fonctionnels :

- `apps.licensing.plans.services`
- `apps.licensing.subscriptions.services`
- `apps.licensing.module_licenses.services`
- certaines fonctions de `apps.platform_admin.services`

Ces chemins deleguent maintenant vers la couche `apps.licensing.services`.

## Adoption effectuee

- `platform_admin.views` utilise `SubscriptionService` et `ModuleLicenseService` pour les operations licensing.
- la commande `process_platform_subscription_lifecycle` utilise `SubscriptionService`.
- les guards runtime continuent a utiliser `LicensingAccessService`, qui s'appuie sur les services centraux.

## Regle pour la suite

Tout nouveau code de licence, abonnement, quota ou acces module doit appeler `apps.licensing.services`.
`platform_admin` doit rester l'interface d'administration, pas la source metier licensing.
