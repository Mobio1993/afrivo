from django.db.models import Count, Q
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.history.models import HistoryEntry
from apps.history.services import log_history
from apps.satisfaction.permissions import IsClientApp, ReadOnlyHotelAdmin
from apps.satisfaction.models import ClientSatisfaction
from apps.satisfaction.serializers import (
    AdminClientSatisfactionSerializer,
    ClientSatisfactionSubmissionResponseSerializer,
    ClientSatisfactionSubmissionSerializer,
    build_satisfaction_summary,
)
from apps.tenancy.drf import HotelScopedQuerysetMixin


class ClientSatisfactionSubmissionApi(generics.CreateAPIView):
    serializer_class = ClientSatisfactionSubmissionSerializer
    permission_classes = [IsClientApp]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        satisfaction = serializer.save()
        log_history(
            action_type=HistoryEntry.ActionType.SATISFACTION_RECORDED,
            module="satisfaction",
            entity_type="ClientSatisfaction",
            entity_reference=satisfaction.reference,
            description=f"Avis client soumis : {satisfaction.reference}.",
            metadata={
                "satisfaction_id": satisfaction.id,
                "client_id": satisfaction.client_id,
                "stay_id": satisfaction.stay_id,
                "overall_rating": satisfaction.overall_rating,
                "satisfaction_level": satisfaction.satisfaction_level,
                "source": satisfaction.source,
            },
        )
        output = ClientSatisfactionSubmissionResponseSerializer(satisfaction, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)


class AdminClientSatisfactionViewSet(HotelScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = AdminClientSatisfactionSerializer
    permission_classes = [ReadOnlyHotelAdmin]
    http_method_names = ["get", "head", "options"]
    hotel_scope_module = "satisfaction"

    def get_queryset(self):
        queryset = (
            ClientSatisfaction.objects.select_related("client", "stay", "consumption", "recorded_by")
            .order_by("-submitted_at", "-id")
        )
        queryset = self.scope_queryset(queryset)

        client_id = self.request.query_params.get("client")
        stay_id = self.request.query_params.get("stay")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        satisfaction_level = self.request.query_params.get("satisfaction_level")
        overall_rating = self.request.query_params.get("overall_rating")
        status_value = self.request.query_params.get("status")
        search = (self.request.query_params.get("search") or "").strip()

        if client_id:
            queryset = queryset.filter(client_id=client_id)
        if stay_id:
            queryset = queryset.filter(stay_id=stay_id)
        if date_from:
            queryset = queryset.filter(submitted_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(submitted_at__date__lte=date_to)
        if satisfaction_level:
            queryset = queryset.filter(satisfaction_level=satisfaction_level)
        if overall_rating:
            queryset = queryset.filter(overall_rating=overall_rating)
        if status_value:
            queryset = queryset.filter(status=status_value)
        if search:
            queryset = queryset.filter(
                Q(reference__icontains=search)
                | Q(client__first_name__icontains=search)
                | Q(client__last_name__icontains=search)
                | Q(stay__reference__icontains=search)
                | Q(positive_points__icontains=search)
                | Q(negative_points__icontains=search)
                | Q(suggestions__icontains=search)
            )

        return queryset

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        return Response(
            {
                "totals": {
                    "count": queryset.count(),
                    "would_recommend_count": queryset.filter(would_recommend=True).count(),
                    "dissatisfied_count": queryset.filter(
                        satisfaction_level__in=[
                            ClientSatisfaction.SatisfactionLevel.DISSATISFIED,
                            ClientSatisfaction.SatisfactionLevel.VERY_DISSATISFIED,
                        ]
                    ).count(),
                },
                "averages": build_satisfaction_summary(queryset),
                "by_level": list(
                    queryset.values("satisfaction_level").annotate(count=Count("id")).order_by("satisfaction_level")
                ),
                "by_rating": list(
                    queryset.values("overall_rating").annotate(count=Count("id")).order_by("overall_rating")
                ),
            }
        )

    def create(self, request, *args, **kwargs):
        return Response({"detail": "Creation non autorisee sur l'API admin."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def update(self, request, *args, **kwargs):
        return Response({"detail": "Modification non autorisee sur l'API admin."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response({"detail": "Modification non autorisee sur l'API admin."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Suppression non autorisee sur l'API admin."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
