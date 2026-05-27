# Isolation multi-tenant AFRIVO

Ce document fixe la regle canonique de la Phase 3 IAM/RBAC.

## Regle utilisateur

Un utilisateur hotel valide doit avoir :

- une organisation active ;
- un hotel actif ;
- un hotel rattache a la meme organisation que l'utilisateur.

Si une de ces conditions echoue, les endpoints metier doivent refuser l'acces ou retourner un queryset vide.

Les comptes plateforme (`is_platform_admin`, `is_superuser`, roles plateforme canoniques) sont les seules exceptions controlees. Ils ne doivent acceder aux donnees globales que via des endpoints plateforme explicites.

## Regle queryset

Tout queryset metier contenant des donnees hotel doit passer par un scope tenant :

- `scope_queryset_to_hotel(queryset, request)` pour les modeles rattaches directement a `hotel` ;
- `scope_queryset_to_tenant(queryset, request)` quand le modele peut etre rattache par hotel ou organisation ;
- `filter_for_active_hotel(queryset, hotel=active_hotel)` dans les vues non-DRF.

Sans hotel actif valide, le comportement attendu est fail-closed : `queryset.none()`.

## Regle FK entrante

Tout endpoint qui accepte des identifiants lies a des objets metier doit valider que ces objets appartiennent au meme hotel actif :

- client / guest ;
- room / room_type ;
- booking / reservation ;
- stay ;
- day_use ;
- invoice / payment / consumption ;
- sensor / maintenance / housekeeping entities.

La validation centrale est `validate_objects_belong_to_hotel(hotel, **objects_by_field)`.

## Modules deja renforces

- Billing : paiements et factures valident leurs rattachements hotel.
- Rooms : chambres, types, tarifs, housekeeping, maintenance, IoT, alertes, evenements et releves energie.
- Day use : creation et modification valident client/chambre.
- Consumptions : consommations client valident client, sejour, reservation et chambre.
- Reports API et vues web : aggregats et exports sont filtres par hotel actif.
- History activity logs : acces hotel via `scope_queryset_to_hotel`, acces global reserve aux comptes plateforme.

## Tests attendus

Chaque module sensible doit avoir au moins un test cross-tenant prouvant qu'un utilisateur de l'hotel A ne peut pas :

- lire une ressource de l'hotel B ;
- creer une ressource en injectant une FK de l'hotel B ;
- exporter ou agreger des donnees de l'hotel B ;
- contourner le scope via des filtres query params.

## Principe de revue

Un endpoint metier est considere conforme Phase 3 seulement si :

1. son acces est protege par permission IAM/RBAC ;
2. son queryset est scope par tenant ;
3. ses FK entrantes sont validees ;
4. un test cross-tenant couvre le comportement critique.
