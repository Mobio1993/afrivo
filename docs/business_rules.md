# Règles Métier AFRIVO

## Multi-tenant

- Chaque hôtel est un tenant indépendant scopé par `hotel_id`.
- Un utilisateur appartient à un seul hôtel.
- Les données d'un hôtel ne sont jamais accessibles par un autre hôtel.
- Une `Organization` peut posséder plusieurs `Hotel`.

## Cycle de vie d'une réservation (Booking)

```
pending → confirmed → checked_in
                   ↘ cancelled
                   ↘ no_show
```

- Une réservation `pending` peut être confirmée ou annulée.
- Une réservation `confirmed` peut passer en `checked_in` ou `no_show`.
- Seule une réservation `confirmed` peut générer un séjour (`Stay`).

## Cycle de vie d'un séjour (Stay)

```
in_progress → completed
           ↘ cancelled
```

- Un séjour est créé au moment du check-in.
- Le check-out génère automatiquement une facture de clôture si des consommations sont non facturées.

## Statuts des chambres (Room)

| Statut | Description |
|--------|-------------|
| `available` | Disponible à la vente |
| `occupied` | Séjour en cours |
| `reserved` | Réservation confirmée |
| `cleaning` | En cours de nettoyage |
| `out_of_service` | Hors service (maintenance) |

- Le statut `occupied` est positionné automatiquement au check-in.
- Le statut `cleaning` est positionné automatiquement au check-out.
- Le statut `available` est positionné manuellement après validation ménage.

## Day-Use

- Un day-use est une occupation de chambre sans nuitée (même journée).
- Il suit les mêmes étapes de facturation qu'un séjour normal.
- Il est exclu des statistiques de nuitées mais inclus dans le taux d'occupation.

## Facturation

- Une facture (`ClientInvoice`) suit le cycle : `draft → issued → partially_paid → paid | cancelled`.
- Un paiement partiel fait passer la facture en `partially_paid`.
- Le solde restant est automatiquement recalculé à chaque paiement.
- Les modes de paiement acceptés : espèces, carte, virement, mobile money, chèque.

## Paiements

- Le module `payments` est autonome et expose les encaissements via `/api/payments/`.
- Un paiement (`Payment`) peut etre rattache a une facture, une reservation, un sejour, un day-use ou un client.
- Les statuts acceptes : `pending`, `paid`, `cancelled`, `refunded`.
- Les types acceptes : avance, paiement partiel, paiement complet, remboursement, ajustement.
- Les modes de paiement acceptes : especes, carte, virement, mobile money, cheque.
- Les factures continuent de recalculer leur solde automatiquement quand un paiement rattache est confirme.

## Consommations

- Une consommation (`ClientConsumption`) doit être `posted` avant d'être facturée.
- Une consommation `billed` ne peut plus être modifiée.
- Les départements : room, restaurant, bar, pool, nightclub, spa, laundry, events.

## Permissions et rôles

- Les permissions module definissent l'acces general aux pages et aux ressources (`view`, `create`, `update`, `delete`, `manage`).
- Les actions sensibles utilisent des permissions metier fines via `can_perform_action()`.
- Les actions de gestion utilisateur utilisent `can_manage_user(actor, target)` et `can_assign_role(actor, target, role_code, scope)`.
- Un utilisateur ne peut pas gerer un compte ou assigner un role de niveau egal ou superieur.
- La matrice canonique et les endpoints associes sont documentes dans [IAM/RBAC AFRIVO](iam_rbac_matrix.md).
- `UserModulePermission` reste un mecanisme de compatibilite legacy pendant la migration progressive.

## Satisfaction client

```
submitted → flagged → recorded → reviewed → escalated → closed
```

- Une satisfaction `flagged` signale un problème à traiter en priorité.
- Une satisfaction `escalated` remonte au management.
- Les sources : mobile app, web app, frontdesk, post-stay, email, phone, QR code, manual.

## Audit et traçabilité (History)

- Toute action métier significative génère une entrée dans `HistoryEntry`.
- Les actions tracées incluent : créations, check-in/out, paiements, annulations, modifications de statut.
- La table history est en append-only (aucune entrée ne doit être modifiée).

## Abonnements SaaS (Platform Admin)

- Un `SubscriptionPlan` définit les limites : nombre max d'hôtels, d'utilisateurs, fonctionnalités.
- Un `HotelSubscription` suit le cycle : `trial → active → suspended → expired | cancelled`.
- La période d'essai (trial) est limitée dans le temps.
- Un abonnement suspendu bloque l'accès à l'application pour les utilisateurs de l'hôtel.

## Codes de référence

- Les clients reçoivent un code au format `AFR-CL-XXXXXX`.
- Les références sont générées de façon unique via le module `core.references`.

## Robustesse reservation et check-out

- Une chambre ne peut pas etre affectee a deux reservations actives qui se chevauchent.
- Les reservations actives prises en compte sont `pending`, `confirmed` et `checked_in`.
- Le chevauchement est detecte si `date_arrivee < depart_existant` et `date_depart > arrivee_existante`.
- La creation, la modification et la confirmation d'une reservation revalident cette disponibilite.
- La politique de paiement au check-out est configurable par hotel via `HotelSettings.checkout_payment_policy`.
- En mode `BLOCKING`, le check-out est bloque tant que le sejour n'est pas entierement paye.
- En mode `NON_BLOCKING`, le check-out reste autorise et le solde restant demeure visible comme impaye.
