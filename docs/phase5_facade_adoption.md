# AFRIVO Architecture Refactor - Phase 5 Facade Adoption

Status: 100% complete for Phase 5  
Date: 2026-05-22  
Scope: low-risk facade adoption only. No database table is moved and no migration is created.

## What Changed

Phase 5 starts replacing direct imports from legacy technical apps with the new facade apps created in phases 1-4.

This phase is intentionally narrow. It updates cross-cutting guard/scope layers first because they are the safest and most valuable places to prove the architecture:

- API auth decorators;
- hotel/tenant DRF permission guards;
- user-management DRF permission guard;
- POS Restaurant permission guard;
- hotel settings audit write path.

## Updated Files

| File | Change |
| --- | --- |
| `backend/apps/core/api_views.py` | Uses `apps.iam`, `apps.tenants`, `apps.licensing`, and `apps.audit_logs` facades for auth, permissions, scope, licensing, and history model import. |
| `backend/apps/tenancy/drf.py` | Uses IAM, tenants, and licensing facades for DRF permission decisions. |
| `backend/apps/users/permissions.py` | Uses IAM facade for permission and token resolution helpers. |
| `backend/apps/tenancy/permissions.py` | Uses IAM and tenants facades for settings access checks. |
| `backend/apps/tenancy/api_views.py` | Uses audit facade for history writes and tenants facade for request hotel resolution. |
| `backend/apps/pos_restaurant/permissions.py` | Uses IAM and tenants facades for POS access checks. |
| `backend/apps/pos_restaurant/views.py` | Uses tenants facade for request hotel/platform-scope helpers. |

## Compatibility Rule

Function names and behavior were kept stable. This means existing code still calls:

- `resolve_api_user`;
- `user_can_access`;
- `can_perform_action`;
- `attach_request_hotel`;
- `module_license_is_active`;
- `hotel_subscription_is_active`;
- `log_history`;

but those names now come from facade modules in the low-risk files above.

## What Did Not Change

- No model moved.
- No migration created.
- No public endpoint changed.
- No frontend route changed.
- No auth/session/JWT behavior changed.
- No platform admin business workflow changed.

## Verification

- `python manage.py check` passed.
- `python manage.py makemigrations --check --dry-run` passed with no changes detected.

## Phase 5 Decision

Phase 5 is complete. The project now has working facade apps and the first production paths consuming them.

The next safe step is to continue facade adoption module by module, starting with:

1. `apps.users.api_views` auth/audit imports;
2. `apps.users.iam_api_views` IAM/audit imports;
3. `apps.platform_admin.views` licensing/audit imports;
4. business modules using `apps.tenancy.drf`.

