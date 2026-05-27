# AFRIVO Architecture Refactor - Phase 2 Tenants Facade

Status: 100% complete for Phase 2  
Date: 2026-05-22  
Scope: tenants facade only. No database table is moved and no migration is created.

## What Changed

Phase 2 introduces `backend/apps/tenants/` as the stable import boundary for tenant concepts:

- organizations;
- hotels;
- hotel settings;
- user memberships at organization/hotel scope;
- tenant request scoping and queryset filtering.

The current source of truth remains:

- `apps.tenancy.models` for `Organization`, `Hotel`, and `HotelSettings`;
- `apps.tenancy.utils` for request scope helpers;
- `apps.tenancy.drf` for DRF permissions and scoped queryset mixins;
- `apps.users.models` for organization and hotel role assignments.

## New Facade Structure

| File | Purpose |
| --- | --- |
| `backend/apps/tenants/apps.py` | Registers the tenants facade app. |
| `backend/apps/tenants/organizations/models.py` | Re-exports `Organization`. |
| `backend/apps/tenants/organizations/services.py` | Organization lookup and active queryset facade. |
| `backend/apps/tenants/hotels/models.py` | Re-exports `Hotel` and `HotelSettings`. |
| `backend/apps/tenants/hotels/services.py` | Hotel lookup, active queryset, settings, and default tenant facade. |
| `backend/apps/tenants/memberships/models.py` | Re-exports `UserOrganizationRole` and `UserHotelRole`. |
| `backend/apps/tenants/memberships/services.py` | Membership query and role existence facade. |
| `backend/apps/tenants/services/scope_service.py` | Request tenant scoping and queryset filtering facade. |
| `backend/apps/tenants/api/permissions.py` | Re-exports tenant DRF permissions and mixins. |
| `backend/apps/tenants/api/serializers.py` | Re-exports tenant settings serializers. |
| `backend/apps/tenants/api/views.py` | Re-exports tenant settings views. |
| `backend/apps/tenants/api/urls.py` | Route-compatible tenant API URL facade. |

## Compatibility Changes

`backend/config/settings/base.py`

- Adds `apps.tenants` to `INSTALLED_APPS`.
- No model migration is generated because the facade owns no new database table.

`backend/apps/core/api_urls.py`

- Changes `/api/settings/` include from `apps.tenancy.urls` to `apps.tenants.api.urls`.
- Endpoint paths and behavior remain identical.

## Verification

- `python manage.py check` passed.
- `python manage.py makemigrations --check --dry-run` passed with no changes detected.

## Phase 2 Decision

Phase 2 is complete. Future backend code can import tenant concerns from `apps.tenants.*` while existing code continues to work.

The next safe phase is Phase 3: introduce a licensing facade around `apps.platform_admin` subscription and license models without moving their tables.

