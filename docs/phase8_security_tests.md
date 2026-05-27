# Phase 8 - Tests de securite

## Objectif

Ajouter une suite de tests ciblee pour verrouiller les frontieres critiques IAM, tenants, licensing, POS Restaurant et Super Root sans deplacer les modeles existants.

## Matrice couverte

- Un receptionniste ne peut pas creer un admin hotel.
- Un admin hotel ne peut pas creer un admin plateforme.
- Un admin plateforme ne peut pas modifier un Super Root.
- Un utilisateur de l'hotel A ne voit pas / n'accede pas a l'hotel B.
- Un utilisateur POS ne peut utiliser que le scope hotel/restaurant qui lui est assigne.
- Une licence inactive bloque l'acces au module.
- Une licence active organisation donne l'acces au module pour les hotels de cette organisation.
- Un quota critique remonte dans le dashboard Super Root.
- Les endpoints Super Root restent reserves au vrai Super Root.

## Emplacement des tests

- `backend/apps/iam/tests.py`
- `backend/apps/tenants/tests.py`
- `backend/apps/licensing/tests.py`
- `backend/apps/pos_restaurant/tests.py`
- `backend/apps/super_root/tests.py`

## Verification

Commande executee :

```bash
python manage.py test apps.iam apps.tenants apps.licensing apps.pos_restaurant apps.super_root --keepdb
```

Resultat :

- 9 tests executes
- 9 tests OK

