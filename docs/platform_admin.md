# Administration plateforme AFRIVO

Ce document explique comment activer et utiliser la console plateforme AFRIVO.

## 1. Appliquer les migrations

Depuis la racine du projet :

```powershell
python backend\manage.py migrate
```

Si vous etes deja dans le dossier `backend` :

```powershell
python manage.py migrate
```

## 2. Creer un administrateur plateforme

Utilisez cette commande pour creer un compte qui peut acceder a la console React `/platform` et au Django admin `/admin/`.

```powershell
python backend\manage.py create_platform_admin --username platform-admin --password "MotDePasseFort"
```

Le compte cree a automatiquement :

- `is_platform_admin=True`
- `is_staff=True`
- `is_superuser=True`
- aucun rattachement `organization`
- aucun rattachement `hotel`

## 3. Demarrer l'application

Backend :

```powershell
python backend\manage.py runserver
```

Frontend :

```powershell
cd frontend
npm run dev
```

## 4. Acceder a la console plateforme

Connectez-vous avec le compte plateforme cree, puis ouvrez :

```text
/platform
```

La sidebar doit afficher la section `Plateforme`.

## 5. Difference avec un admin hotel

Pour creer un administrateur rattache a un hotel, utilisez :

```powershell
python backend\manage.py create_hotel_admin --username hotel-admin --password "MotDePasseFort" --organization-id 1 --hotel-id 1
```

Cette commande cree un admin metier pour un hotel. Elle ne donne pas acces a la console plateforme.

L'option `--django-superuser` donne seulement les droits techniques Django :

```powershell
python backend\manage.py create_hotel_admin --username tech-admin --password "MotDePasseFort" --organization-id 1 --hotel-id 1 --django-superuser
```

Elle ne remplace pas `create_platform_admin`.

## 6. Cycle de vie des abonnements

Si des hotels existent deja sans plan ni abonnement, initialisez d'abord les abonnements manquants :

```powershell
python backend\manage.py init_platform_subscriptions --plan-code starter --plan-name "Starter"
```

Cette commande cree le plan s'il n'existe pas encore, puis cree un abonnement actif pour chaque hotel sans abonnement.

La commande suivante met a jour les abonnements expires ou suspendus :

```powershell
python backend\manage.py process_platform_subscription_lifecycle
```

En production, planifiez cette commande avec le Planificateur de taches Windows, cron, ou Celery Beat.

## 7. Verifications rapides

Tests backend du module plateforme :

```powershell
python backend\manage.py test apps.platform_admin --keepdb
```

Tests utilisateurs et authentification :

```powershell
python backend\manage.py test apps.users --keepdb
```
