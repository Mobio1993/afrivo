# AFRIVO Architecture Refactor - Phase 1 IAM Facade

Status: 100% complete for Phase 1  
Date: 2026-05-22  
Scope: IAM facade only. No database table is moved and no migration is created.

## What Changed

Phase 1 introduces `backend/apps/iam/` as the stable import boundary for identity and access management.

The current source of truth remains:

- `apps.users.models` for users, roles, permissions, sessions, and blacklisted tokens;
- `apps.users.jwt_auth` for JWT/session behavior;
- `apps.users.access` for permission decisions;
- `apps.users.iam_api_views` for existing IAM endpoints.

## New Facade Structure

| File | Purpose |
| --- | --- |
| `backend/apps/iam/apps.py` | Registers the IAM facade app. |
| `backend/apps/iam/models/user.py` | Re-exports `User`. |
| `backend/apps/iam/models/role.py` | Re-exports IAM role models. |
| `backend/apps/iam/models/permission.py` | Re-exports IAM permission models. |
| `backend/apps/iam/models/session.py` | Re-exports session/token models. |
| `backend/apps/iam/services/auth_service.py` | Facade for request user resolution and credential authentication. |
| `backend/apps/iam/services/token_service.py` | Facade for JWT, cookies, blacklist, and session helpers. |
| `backend/apps/iam/services/mfa_service.py` | Facade for MFA state checks and flag updates. |
| `backend/apps/iam/services/permission_service.py` | Facade for module/action and role hierarchy decisions. |
| `backend/apps/iam/audit/audit_logger.py` | Facade for IAM audit writes through `ActivityLog`. |
| `backend/apps/iam/api/permissions.py` | Reusable DRF permission classes for new IAM-aware APIs. |
| `backend/apps/iam/api/views.py` | Re-exports existing IAM endpoint functions. |
| `backend/apps/iam/api/urls.py` | Route-compatible IAM API URL facade. |

## Compatibility Changes

`backend/config/settings/base.py`

- Adds `apps.iam` to `INSTALLED_APPS`.
- No model migration is generated because the app owns no new database table.

`backend/apps/core/api_urls.py`

- Changes `/api/iam/` include from `apps.users.iam_urls` to `apps.iam.api.urls`.
- The endpoint paths and view behavior remain identical.

## Verification

- `python manage.py check` passed.
- `python manage.py makemigrations --check --dry-run` passed with no changes detected.

## Phase 1 Decision

Phase 1 is complete. Future backend code can import IAM concerns from `apps.iam.*` while existing code continues to work.

The next safe phase is Phase 2: introduce a tenants facade around `apps.tenancy` without moving `Organization`, `Hotel`, or `HotelSettings` tables.

