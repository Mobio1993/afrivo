# Documentation API AFRIVO

## Base URL

```text
http://localhost:8000/api/
```

## Authentification

Tous les endpoints proteges utilisent des cookies JWT HTTP-only.

- Access token : stocke dans un cookie HTTP-only.
- Refresh token : stocke dans un cookie HTTP-only limite aux routes `/api/auth/`.
- CSRF : requis pour les requetes sensibles (`POST`, `PUT`, `PATCH`, `DELETE`).
- Les requetes frontend utilisent `credentials: include` pour envoyer automatiquement les cookies.

## Authentication Flow

1. Le frontend appelle `GET /api/auth/csrf/` pour obtenir le cookie CSRF.
2. Le frontend appelle `POST /api/auth/login/` avec les identifiants.
3. Le backend authentifie l'utilisateur et definit les cookies HTTP-only `access_token` et `refresh_token`.
4. Les requetes API suivantes envoient automatiquement les cookies via `credentials: include`.
5. Si l'access token expire, le frontend appelle automatiquement `POST /api/auth/refresh/`.
6. Le logout appelle `POST /api/auth/logout/`, revoque le refresh token et supprime les cookies.

### Connexion

```http
POST /api/auth/login/
Content-Type: application/json
X-CSRFToken: <csrf_token>

{
  "username": "user@hotel.com",
  "password": "motdepasse",
  "remember_me": true
}
```

Reponse :

```json
{
  "authenticated": true,
  "user": { "id": 1, "role": "reception" }
}
```

### Rafraichir la session

```http
POST /api/auth/refresh/
Content-Type: application/json
X-CSRFToken: <csrf_token>
```

Le refresh token est lu depuis le cookie HTTP-only. Aucun token n'est envoye dans le corps JSON.

### Deconnexion

```http
POST /api/auth/logout/
Content-Type: application/json
X-CSRFToken: <csrf_token>
```

Le refresh token est ajoute a la blacklist, puis les cookies d'authentification sont supprimes.

## Endpoints principaux

### Utilisateurs

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users/` | Liste des utilisateurs |
| POST | `/api/users/` | Creer un utilisateur |
| GET | `/api/users/{id}/` | Detail utilisateur |
| PATCH | `/api/users/{id}/` | Modifier un utilisateur |

### Clients

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/clients/` | Liste des clients |
| POST | `/api/clients/` | Creer un client |
| GET | `/api/clients/{id}/` | Detail client |
| PATCH | `/api/clients/{id}/` | Modifier un client |

### Chambres

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/rooms/` | Liste des chambres |
| GET | `/api/rooms/types/` | Types de chambres |
| PATCH | `/api/rooms/{id}/status/` | Changer le statut |

### Operations

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/operations/board/` | Tableau operationnel |
| GET | `/api/operations/bookings/` | Liste des reservations |
| POST | `/api/operations/bookings/create/` | Creer une reservation |
| POST | `/api/operations/bookings/{id}/confirm/` | Confirmer une reservation |
| POST | `/api/operations/bookings/{id}/cancel/` | Annuler une reservation |
| POST | `/api/operations/bookings/{id}/check-in/` | Convertir en check-in |
| GET | `/api/operations/stays/` | Liste des sejours |
| POST | `/api/operations/stays/create/` | Creer un sejour |
| POST | `/api/operations/stays/{id}/check-out/` | Cloturer un sejour |
| GET | `/api/operations/day-uses/` | Liste des day-use |
| POST | `/api/operations/day-use/create/` | Creer un day-use |
| POST | `/api/operations/day-use/{id}/check-in/` | Entree day-use |
| POST | `/api/operations/day-use/{id}/check-out/` | Sortie day-use |
| GET | `/api/operations/payments/` | Liste des paiements |
| POST | `/api/operations/payments/create/` | Enregistrer un paiement |

### Facturation

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/billing/invoices/` | Liste des factures |
| POST | `/api/billing/invoices/` | Creer une facture |
| GET | `/api/billing/payments/` | Liste des paiements |

### Consommations

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/consumptions/` | Liste des consommations |
| POST | `/api/consumptions/` | Ajouter une consommation |
| POST | `/api/consumptions/{id}/post/` | Poster une consommation |

### Satisfaction

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/satisfaction/` | Liste des enquetes |
| POST | `/api/satisfaction/` | Creer une enquete |

### Rapports

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/reports/overview/` | Vue d'ensemble des rapports |
| GET | `/api/reports/occupancy/` | Taux d'occupation |
| GET | `/api/reports/financial/` | Rapport financier |
| GET | `/api/reports/day-use/` | Rapport day-use |

### Platform Admin

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/platform/organizations/` | Liste des organisations |
| GET | `/api/platform/hotels/` | Liste des hotels |
| GET | `/api/platform/subscriptions/` | Liste des abonnements |
| GET | `/api/platform/users/` | Liste des utilisateurs plateforme |

## Format des reponses

Les reponses API suivent le format standard AFRIVO :

```json
{
  "success": true,
  "data": {},
  "message": "Operation reussie"
}
```

En cas d'erreur :

```json
{
  "success": false,
  "code": "MESSAGE_CODE",
  "detail": "Description lisible"
}
```

## Codes HTTP utilises

| Code | Signification |
|------|---------------|
| 200 | Succes |
| 201 | Cree |
| 400 | Donnees invalides |
| 401 | Non authentifie |
| 403 | Non autorise |
| 404 | Ressource introuvable |
| 409 | Conflit |
| 429 | Trop de requetes |
| 500 | Erreur serveur |
