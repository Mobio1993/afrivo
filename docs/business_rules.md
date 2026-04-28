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

## Consommations

- Une consommation (`ClientConsumption`) doit être `posted` avant d'être facturée.
- Une consommation `billed` ne peut plus être modifiée.
- Les départements : room, restaurant, bar, pool, nightclub, spa, laundry, events.

## Permissions et rôles

- Les permissions sont définies au niveau du module (ex: `billing`, `rooms`, `guests`).
- Un `UserModulePermission` peut accorder `read`, `write`, `delete` par module.
- L'administrateur hôtelier (`admin`) dispose de tous les droits par défaut.
- Le rôle `housekeeping` n'a accès qu'aux tâches de nettoyage.

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
