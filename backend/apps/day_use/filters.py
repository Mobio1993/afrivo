from django.db.models import Q


def filter_day_use_queryset(queryset, params):
    search = (params.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(reference__icontains=search)
            | Q(guest__first_name__icontains=search)
            | Q(guest__last_name__icontains=search)
            | Q(guest__phone__icontains=search)
            | Q(room__number__icontains=search)
        )
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if params.get("payment_status"):
        queryset = queryset.filter(payment_status=params["payment_status"])
    if params.get("room"):
        queryset = queryset.filter(room_id=params["room"])
    if params.get("client"):
        queryset = queryset.filter(guest_id=params["client"])
    if params.get("date_from"):
        queryset = queryset.filter(start_datetime__date__gte=params["date_from"])
    if params.get("date_to"):
        queryset = queryset.filter(start_datetime__date__lte=params["date_to"])
    return queryset.distinct()

