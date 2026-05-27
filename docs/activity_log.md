# Journal d'activite / Audit Log

Le module `history` contient le journal d'activite multi-tenant AFRIVO. Il complete `HistoryEntry` avec un modele `ActivityLog` plus detaille, destine aux audits operationnels.

## Donnees tracees

Chaque entree conserve l'hotel, l'utilisateur, son role, l'action, le module, l'objet concerne, la description, les anciennes et nouvelles valeurs, l'adresse IP, le navigateur, la session, la gravite et la date de creation.

Actions principales : `LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `DELETE`, `VIEW`, `CONFIRM`, `CANCEL`, `CHECKIN`, `CHECKOUT`, `PAYMENT`, `REFUND`, `ROOM_STATUS_CHANGE`, `PRICE_CHANGE`, `PASSWORD_CHANGE`, `PERMISSION_CHANGE`, `EXPORT`.

Gravites : `info`, `success`, `warning`, `danger`, `critical`.

## Journalisation

Utiliser le helper :

```python
from apps.history.services import log_activity

log_activity(
    request=request,
    action="CREATE",
    module="bookings",
    object_type="Booking",
    object_id=booking.id,
    object_reference=booking.reference,
    description="Creation d'une reservation",
    old_values=None,
    new_values={"status": booking.status},
    severity="success",
)
```

Les appels existants a `log_history()` alimentent aussi automatiquement `ActivityLog`, ce qui couvre les flux deja journalises : reservations, check-in, check-out, paiements, consommations, chambres, satisfaction et changements de statut.

## API

- `GET /api/history/activity-logs/`
- `GET /api/history/activity-logs/<id>/`
- `GET /api/history/activity-logs/summary/`

Filtres disponibles : `user`, `role`, `hotel`, `module`, `action`, `severity`, `date_start`, `date_end`, `search`, `page`, `page_size`.

## Acces

- Administrateur plateforme : tous les hotels.
- Administrateur hotel et manager : hotel actif uniquement.
- Receptionniste : pas d'acces par defaut, sauf permission explicite `history.view`.
- Caissier : acces autorise par defaut, limite a ses operations et aux modules financiers s'il n'a pas `history.manage`.

## Frontend

La page React est disponible sur `/history/activity-logs` avec statistiques, filtres, tableau pagine et drawer de detail.
