# AFRIVO — Plateforme SaaS de gestion hoteliere

## Structure du projet

```
django/
├── backend/        Django REST API
├── frontend/       React + Vite (SPA)
├── docs/           Documentation
├── scripts/        Scripts de lancement
└── .venv/          Environnement virtuel Python
```

## Prerequis

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

## Lancement rapide

### Backend (Django)

```bash
# Depuis la racine du projet
.venv\Scripts\activate
cd backend
python manage.py runserver
```

Ou via le script :
```
scripts\run_backend.bat
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Ou via le script :
```
scripts\run_frontend.bat
```

## Variables d environnement

Copier `backend/.env.example` vers `backend/.env` et renseigner :

```
DJANGO_SECRET_KEY=
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
POSTGRES_DB=hotel_reception_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

## Commandes Django utiles

```bash
# Depuis backend/
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic
python manage.py showmigrations
```

## Architecture backend

```
backend/apps/
├── core/           Helpers API, decorateurs, navigation
├── tenancy/        Multi-tenant (hotel_id scoping)
├── users/          Auth JWT, roles, permissions
├── guests/         Gestion des clients
├── rooms/          Chambres, types, housekeeping, tarification
├── bookings/       Reservations et day-use
├── stays/          Sejours actifs (check-in / check-out)
├── billing/        Paiements et facturation
├── consumptions/   Consommations clients
├── satisfaction/   Enquetes de satisfaction
├── history/        Journal des actions metier
├── reports/        Rapports operationnels
├── operations/     Vues metier cross-module (poste reception)
└── platform_admin/ Administration plateforme
```
