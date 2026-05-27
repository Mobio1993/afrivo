# AFRIVO Architecture Refactor - Phase 6 Users Facade Adoption

Status: 100% complete for Phase 6  
Date: 2026-05-22  
Scope: users module facade adoption only. No database table is moved and no migration is created.

## What Changed

Phase 6 continues facade adoption inside the `apps.users` module.

The goal is to reduce direct coupling from users/auth/IAM code to legacy technical apps while preserving every public API and behavior.

## Updated Files

| File | Change |
| --- | --- |
| `backend/apps/users/api_views.py` | Uses `apps.iam` for user/session/token/auth helpers and `apps.audit_logs` for auth audit writes. |
| `backend/apps/users/iam_api_views.py` | Uses `apps.iam` for IAM models/permissions/token resolution, `apps.tenants` for tenant models, and `apps.audit_logs` for audit writes. |
| `backend/apps/users/views.py` | Uses `apps.iam` for user model/permission helpers and `apps.audit_logs` for user-management audit writes. |
| `backend/apps/users/services.py` | Uses `apps.iam` for the user model and `apps.tenants` for organization/hotel/default tenancy resolution. |
| `backend/apps/users/serializers.py` | Uses `apps.iam` for user/permission helpers and `apps.tenants` for organization/hotel references. |

## Compatibility Rule

No URL, serializer field, response payload, permission rule, or authentication flow was intentionally changed.

Existing endpoints remain unchanged:

- `/api/auth/*`
- `/api/users/*`
- `/api/iam/*`

## What Did Not Change

- No model moved.
- No migration created.
- No auth endpoint changed.
- No token/cookie format changed.
- No frontend route changed.

## Verification

- `python manage.py check` passed.
- `python manage.py makemigrations --check --dry-run` passed with no changes detected.

## Phase 6 Decision

Phase 6 is complete. The `users` module now consumes the IAM, tenants, and audit facades in its main API/service layers.

The next safe step is Phase 7: adopt facades in `apps.platform_admin` views/services, especially licensing and platform audit imports.

