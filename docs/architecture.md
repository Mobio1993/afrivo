# Architecture AFRIVO

## Vue d'ensemble

AFRIVO est une plateforme SaaS multi-tenant de gestion hoteliere. Elle repose sur une architecture decouplee backend/frontend communiquant via une API REST.

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Backend | Django + Django REST Framework | 5.2 / 3.17 |
| Frontend | React + Vite | 19 / 7 |
| Base de donnees | PostgreSQL | 14+ |
| Auth | JWT HTTP-only cookies | Custom |
| Runtime Python | CPython | 3.11+ |
| Runtime Node | Node.js | 18+ |

## Architecture multi-tenant

```text
Organization (niveau SaaS)
└── Hotel (tenant operationnel)
    ├── Users (staff avec roles)
    ├── Rooms / RoomTypes
    ├── Guests
    ├── Bookings / DayUse
    ├── Stays
    ├── Billing (Invoices, Payments)
    ├── Consumptions (services)
    ├── Satisfaction (feedback)
    └── History (audit log)
```

Chaque entite metier est scopee par `hotel_id`. Les requetes sont filtrees par le tenant actif quand le module est en mode strict.

## Structure du projet

```text
AFRIVO/
├── backend/          Django API
│   ├── apps/         Applications metier
│   └── config/       Settings, URLs, WSGI, ASGI
├── frontend/         React SPA
│   └── src/          Pages, composants, services, auth
├── database/         Backups, seeds, docs schema
├── docs/             Documentation technique et metier
└── scripts/          Scripts locaux
```

## Flux d'authentification

1. Le frontend appelle `GET /api/auth/csrf/` pour initialiser le cookie CSRF.
2. Le frontend envoie `POST /api/auth/login/` avec les identifiants et le token CSRF.
3. Le backend valide l'utilisateur et definit les cookies HTTP-only `access_token` et `refresh_token`.
4. Le frontend envoie automatiquement les cookies avec `credentials: include`.
5. Si l'access token expire, le frontend appelle `POST /api/auth/refresh/`.
6. Le backend refuse les refresh tokens presents dans la blacklist.
7. Le logout revoque le refresh token et supprime les cookies.

## Roles utilisateurs

| Role | Description |
|------|-------------|
| `admin` | Acces complet a l'hotel |
| `manager` | Gestion operationnelle |
| `reception` | Check-in/out, reservations |
| `cashier` | Facturation et paiements |
| `housekeeping` | Gestion des chambres |
| `restaurant` | Consommations F&B |

## Modules applicatifs

| App Django | Responsabilite |
|------------|----------------|
| `core` | Reponses API, navigation, references |
| `tenancy` | Organisation, hotel, multi-tenant |
| `users` | Authentification, roles, permissions |
| `guests` | Profils clients |
| `rooms` | Inventaire chambres et types |
| `bookings` | Reservations et day-use |
| `stays` | Sejours actifs |
| `billing` | Factures et paiements |
| `consumptions` | Services |
| `satisfaction` | Enquetes satisfaction client |
| `history` | Journal d'audit |
| `reports` | Analytique et rapports |
| `operations` | Vue reception cross-module |
| `platform_admin` | Administration SaaS |
