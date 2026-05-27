# AFRIVO Architecture Refactor - Phase 4 Audit Logs Facade

Status: 100% complete for Phase 4  
Date: 2026-05-22  
Scope: audit facade only. No database table is moved and no migration is created.

## What Changed

Phase 4 introduces `backend/apps/audit_logs/` as the stable import boundary for audit concerns:

- hotel/business activity audit;
- legacy history entries;
- platform audit events;
- POS Restaurant audit events;
- ActivityLog integrity verification.

The current source of truth remains:

- `apps.history.models.ActivityLog`;
- `apps.history.models.HistoryEntry`;
- `apps.platform_admin.models.PlatformAuditEvent`;
- existing history and platform admin serializers/views.

## New Facade Structure

| File | Purpose |
| --- | --- |
| `backend/apps/audit_logs/apps.py` | Registers the audit facade app. |
| `backend/apps/audit_logs/models.py` | Re-exports `ActivityLog`, `HistoryEntry`, and `PlatformAuditEvent`. |
| `backend/apps/audit_logs/services.py` | Unified write facade for hotel, platform, POS, and integrity checks. |
| `backend/apps/audit_logs/api.py` | Re-exports audit serializers and viewsets. |
| `backend/apps/audit_logs/api_urls.py` | Route-compatible history API facade. |

## Compatibility Changes

`backend/config/settings/base.py`

- Adds `apps.audit_logs` to `INSTALLED_APPS`.
- No model migration is generated because the facade owns no new database table.

`backend/apps/core/api_urls.py`

- Changes `/api/history/` include from `apps.history.urls` to `apps.audit_logs.api_urls`.
- Endpoint paths and behavior remain identical.

`backend/apps/pos_restaurant/audit.py`

- Keeps the same `pos_audit_logger.log(user, action, data)` API.
- Delegates to `apps.audit_logs.services.PosAuditService`.
- POS events still go to the `pos_audit` logger and are also bridged to `ActivityLog` when possible.

## Endpoint Compatibility

No public endpoint path changed in Phase 4.

Existing audit endpoints remain available under `/api/history/`.

## Verification

- `python manage.py check` passed.
- `python manage.py makemigrations --check --dry-run` passed with no changes detected.

## Phase 4 Decision

Phase 4 is complete. Future backend code can import audit concerns from `apps.audit_logs.*` while existing history, platform admin, and POS behavior continues to work.

The next safe phase is Phase 5: optionally start replacing direct legacy imports with facade imports in low-risk modules, or build the next bounded domain facade.

