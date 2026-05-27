import time

from django.core.cache import cache


class SuperRootApiLatencyMiddleware:
    """Stores a short rolling API latency window for Super Root monitoring."""

    CACHE_KEY = "super_root:monitoring:api_latency_samples"
    MAX_SAMPLES = 120

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.perf_counter()
        response = self.get_response(request)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

        if request.path.startswith("/api/"):
            samples = cache.get(self.CACHE_KEY) or []
            samples.append(
                {
                    "path": request.path,
                    "method": request.method,
                    "status_code": getattr(response, "status_code", 0),
                    "latency_ms": elapsed_ms,
                    "recorded_at": time.time(),
                }
            )
            cache.set(self.CACHE_KEY, samples[-self.MAX_SAMPLES :], 60 * 30)

        return response
