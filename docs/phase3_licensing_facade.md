# AFRIVO Architecture Refactor - Phase 3 Licensing Facade

Status: 100% complete for Phase 3  
Date: 2026-05-22  
Scope: licensing facade only. No database table is moved and no migration is created.

## What Changed

Phase 3 introduces `backend/apps/licensing/` as the stable import boundary for:

- subscription plans;
- hotel subscriptions;
- platform modules;
- platform module licenses;
- runtime access checks for subscription and license enforcement.

The current source of truth remains:

- `apps.platform_admin.models.SubscriptionPlan`;
- `apps.platform_admin.models.HotelSubscription`;
- `apps.platform_admin.models.PlatformModule`;
- `apps.platform_admin.models.PlatformLicense`;
- existing platform admin views and serializers.

## New Facade Structure

| File | Purpose |
| --- | --- |
| `backend/apps/licensing/apps.py` | Registers the licensing facade app. |
| `backend/apps/licensing/plans/models.py` | Re-exports `SubscriptionPlan`. |
| `backend/apps/licensing/plans/services.py` | Plan lookup, active plans, and quota helpers. |
| `backend/apps/licensing/subscriptions/models.py` | Re-exports `HotelSubscription`. |
| `backend/apps/licensing/subscriptions/services.py` | Subscription lookup, lifecycle, renewal, and plan change facade. |
| `backend/apps/licensing/module_licenses/models.py` | Re-exports `PlatformModule` and `PlatformLicense`. |
| `backend/apps/licensing/module_licenses/services.py` | Module/license lookup, renewal, suspension, and access facade. |
| `backend/apps/licensing/services/access_service.py` | Runtime access checks for module licenses and hotel subscriptions. |
| `backend/apps/licensing/api/*` | Route-compatible API facade for future endpoint migration. |

## Compatibility Changes

`backend/config/settings/base.py`

- Adds `apps.licensing` to `INSTALLED_APPS`.
- No model migration is generated because the facade owns no new database table.

`backend/apps/tenancy/utils.py`

- Keeps the same public functions:
  - `get_module_license_codes`
  - `module_license_is_active`
  - `hotel_subscription_is_active`
- Internally delegates runtime checks to `apps.licensing.services.access_service`.
- This reduces direct coupling from tenancy guards to platform admin licensing internals.

## Endpoint Compatibility

No public endpoint path changed in Phase 3.

Existing platform endpoints remain available under `/api/platform/`:

- `/api/platform/subscriptions/`
- `/api/platform/subscriptions/plans/`
- `/api/platform/modules/`
- `/api/platform/licenses/`

The new `apps.licensing.api.urls` facade exists for future routing work, but it is not mounted publicly in this phase.

## Verification

- `python manage.py check` passed.
- `python manage.py makemigrations --check --dry-run` passed with no changes detected.

## Phase 3 Decision

Phase 3 is complete. Future backend code can import licensing concerns from `apps.licensing.*` while existing platform admin endpoints continue to work.

The next safe phase is Phase 4: introduce an `apps.audit_logs` facade that unifies ActivityLog, PlatformAuditEvent, and POS audit writes without changing their storage tables.

