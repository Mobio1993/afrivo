import importlib
import os
import time

from django.core.cache import cache
from django.db import connection
from django.utils import timezone

try:
    import psutil
except ImportError:  # pragma: no cover - depends on optional infra package
    psutil = None


def get_psutil():
    """Resolve psutil lazily so a long-running dev server sees it after install."""
    global psutil
    if psutil is None:
        try:
            psutil = importlib.import_module("psutil")
        except ImportError:
            psutil = None
    return psutil


class SuperRootMonitoringService:
    """Read-only operational monitoring facade for the Super Root console."""

    API_LATENCY_CACHE_KEY = "super_root:monitoring:api_latency_samples"

    @staticmethod
    def _database_probe():
        started = time.perf_counter()
        ok = True
        error = ""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as exc:
            ok = False
            error = str(exc)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        return {"ok": ok, "latency_ms": latency_ms, "error": error}

    @staticmethod
    def _cache_probe():
        started = time.perf_counter()
        ok = True
        error = ""
        try:
            key = "super_root_monitoring_probe"
            cache.set(key, "ok", 10)
            ok = cache.get(key) == "ok"
        except Exception as exc:
            ok = False
            error = str(exc)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        return {"ok": ok, "latency_ms": latency_ms, "error": error}

    @staticmethod
    def _system_probe():
        disk_pct = None
        cpu_pct = None
        ram_pct = None
        load_avg = None
        source = "stdlib"
        note = "CPU/RAM/disque detailles necessitent psutil ou un agent infrastructure."
        psutil_module = get_psutil()
        if psutil_module is not None:
            try:
                cpu_pct = psutil_module.cpu_percent(interval=None)
                ram_pct = psutil_module.virtual_memory().percent
                disk_pct = psutil_module.disk_usage(os.getcwd()).percent
                source = "psutil"
                note = ""
            except Exception as exc:
                note = str(exc)
        try:
            load_avg = os.getloadavg()[0]
        except (AttributeError, OSError):
            load_avg = None
        return {
            "cpu_pct": cpu_pct,
            "ram_pct": ram_pct,
            "disk_pct": disk_pct,
            "load_avg": load_avg,
            "source": source,
            "note": note,
        }

    @staticmethod
    def _api_probe(fallback_latency_ms):
        samples = cache.get(SuperRootMonitoringService.API_LATENCY_CACHE_KEY) or []
        recent = samples[-60:]
        if not recent:
            return {
                "ok": True,
                "latency_ms": fallback_latency_ms,
                "avg_latency_ms": fallback_latency_ms,
                "p95_latency_ms": fallback_latency_ms,
                "requests": 0,
                "errors": 0,
                "source": "probe_fallback",
            }
        latencies = sorted(float(item.get("latency_ms") or 0) for item in recent)
        errors = sum(1 for item in recent if int(item.get("status_code") or 0) >= 500)
        p95_index = max(0, min(len(latencies) - 1, round((len(latencies) - 1) * 0.95)))
        avg_latency = round(sum(latencies) / len(latencies), 2)
        p95_latency = round(latencies[p95_index], 2)
        return {
            "ok": errors == 0 and p95_latency < 1000,
            "latency_ms": avg_latency,
            "avg_latency_ms": avg_latency,
            "p95_latency_ms": p95_latency,
            "requests": len(recent),
            "errors": errors,
            "source": "middleware",
        }

    @staticmethod
    def _queue_probe():
        return {
            "ok": True,
            "pending": 0,
            "provider": "not_configured",
            "note": "Aucun worker/queue backend n'est configure dans les settings actuels.",
        }

    @staticmethod
    def snapshot():
        database = SuperRootMonitoringService._database_probe()
        cache_status = SuperRootMonitoringService._cache_probe()
        system = SuperRootMonitoringService._system_probe()
        queue = SuperRootMonitoringService._queue_probe()
        websocket = {
            "ok": False,
            "status": "not_configured",
            "note": "Aucun backend Channels/WebSocket Super Root detecte.",
        }
        fallback_api_latency_ms = round((database["latency_ms"] + cache_status["latency_ms"]) / 2, 2)
        api = SuperRootMonitoringService._api_probe(fallback_api_latency_ms)
        issues = [
            key
            for key, item in {
                "api": api,
                "database": database,
                "cache": cache_status,
                "queue": queue,
                "websocket": websocket,
            }.items()
            if not item.get("ok")
        ]
        return {
            "checked_at": timezone.now().isoformat(),
            "api": api,
            "database": database,
            "cache": cache_status,
            "queue": queue,
            "websocket": websocket,
            "system": system,
            "status": "warning" if issues else "ok",
            "issues": issues,
        }

    @staticmethod
    def live_snapshot():
        return SuperRootMonitoringService.snapshot()
