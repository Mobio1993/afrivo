from math import ceil


DEFAULT_PAGE_SIZE = 5
MAX_PAGE_SIZE = 50


def parse_positive_int(value, default):
    try:
        parsed_value = int(value)
    except (TypeError, ValueError):
        return default
    return parsed_value if parsed_value > 0 else default


def build_paginated_payload(request, queryset, serialize_item):
    current_page = parse_positive_int(request.GET.get("page"), 1)
    current_page_size = min(
        parse_positive_int(request.GET.get("page_size"), DEFAULT_PAGE_SIZE),
        MAX_PAGE_SIZE,
    )

    total_count = queryset.count()
    total_pages = max(1, ceil(total_count / current_page_size)) if total_count else 1

    if current_page > total_pages:
        current_page = total_pages

    start = (current_page - 1) * current_page_size
    end = start + current_page_size

    params = request.GET.copy()
    params["page_size"] = str(current_page_size)

    def build_page_url(target_page):
        if target_page < 1 or target_page > total_pages:
            return None
        params["page"] = str(target_page)
        return request.build_absolute_uri(f"{request.path}?{params.urlencode()}")

    return {
        "count": total_count,
        "page": current_page,
        "page_size": current_page_size,
        "total_pages": total_pages,
        "next": build_page_url(current_page + 1) if current_page < total_pages else None,
        "previous": build_page_url(current_page - 1) if current_page > 1 else None,
        "results": [serialize_item(item) for item in queryset[start:end]],
    }
