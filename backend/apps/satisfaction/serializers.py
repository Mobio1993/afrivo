from django.db.models import Avg
from rest_framework import serializers

from apps.guests.models import Guest
from apps.stays.models import Stay
from apps.satisfaction.models import ClientSatisfaction
from apps.satisfaction.validators import validate_feedback_token


class AdminClientSatisfactionSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    stay_reference = serializers.CharField(source="stay.reference", read_only=True)
    consumption_reference = serializers.CharField(source="consumption.reference", read_only=True)
    recorded_by_name = serializers.SerializerMethodField()
    satisfaction_level_label = serializers.CharField(source="get_satisfaction_level_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    source_label = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = ClientSatisfaction
        fields = [
            "id",
            "reference",
            "client",
            "client_name",
            "stay",
            "stay_reference",
            "consumption",
            "consumption_reference",
            "recorded_by",
            "recorded_by_name",
            "overall_rating",
            "satisfaction_level",
            "satisfaction_level_label",
            "recommendation_score",
            "would_recommend",
            "reception_rating",
            "room_rating",
            "cleanliness_rating",
            "restaurant_rating",
            "bar_rating",
            "pool_rating",
            "spa_rating",
            "laundry_rating",
            "positive_points",
            "negative_points",
            "suggestions",
            "notes",
            "submitted_at",
            "status",
            "status_label",
            "source",
            "source_label",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "reference",
            "client_name",
            "stay_reference",
            "consumption_reference",
            "recorded_by_name",
            "satisfaction_level_label",
            "status_label",
            "source_label",
            "created_at",
            "updated_at",
        ]

    def get_recorded_by_name(self, obj):
        if not obj.recorded_by:
            return ""
        return obj.recorded_by.get_full_name().strip() or obj.recorded_by.username

    def validate(self, attrs):
        instance = self.instance
        client = attrs.get("client") if "client" in attrs else getattr(instance, "client", None)
        stay = attrs.get("stay") if "stay" in attrs else getattr(instance, "stay", None)
        consumption = attrs.get("consumption") if "consumption" in attrs else getattr(instance, "consumption", None)
        overall_rating = attrs.get("overall_rating") if "overall_rating" in attrs else getattr(instance, "overall_rating", None)
        recommendation_score = (
            attrs.get("recommendation_score")
            if "recommendation_score" in attrs
            else getattr(instance, "recommendation_score", None)
        )

        if not client:
            raise serializers.ValidationError({"client": "Le client est obligatoire."})
        if overall_rating is not None and not 1 <= overall_rating <= 5:
            raise serializers.ValidationError({"overall_rating": "La note globale doit etre comprise entre 1 et 5."})
        if recommendation_score is not None and not 0 <= recommendation_score <= 10:
            raise serializers.ValidationError(
                {"recommendation_score": "Le score de recommandation doit etre compris entre 0 et 10."}
            )
        if stay and stay.guest_id != client.id:
            raise serializers.ValidationError({"stay": "Le sejour selectionne doit appartenir au meme client."})
        if consumption and consumption.client_id != client.id:
            raise serializers.ValidationError({"consumption": "La consommation selectionnee doit appartenir au meme client."})
        if stay and consumption and consumption.stay_id and consumption.stay_id != stay.id:
            raise serializers.ValidationError({"consumption": "La consommation ne correspond pas au sejour selectionne."})
        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data.setdefault("recorded_by", request.user)
        hotel = getattr(request, "active_hotel", None) if request else None
        if hotel is None and request:
            hotel = getattr(getattr(request, "user", None), "hotel", None)
        validated_data.setdefault("hotel", hotel)
        return ClientSatisfaction.objects.create(**validated_data)

    def update(self, instance, validated_data):
        if instance.status == ClientSatisfaction.Status.CLOSED:
            immutable_fields = {
                "client",
                "stay",
                "consumption",
                "overall_rating",
                "recommendation_score",
                "would_recommend",
            }
            if immutable_fields.intersection(validated_data.keys()):
                raise serializers.ValidationError("Un avis clos ne peut plus etre modifie sur ses champs principaux.")

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance


class ClientSatisfactionSubmissionSerializer(serializers.ModelSerializer):
    feedback_token = serializers.CharField(write_only=True)

    class Meta:
        model = ClientSatisfaction
        fields = [
            "client",
            "stay",
            "overall_rating",
            "recommendation_score",
            "would_recommend",
            "reception_rating",
            "room_rating",
            "cleanliness_rating",
            "restaurant_rating",
            "bar_rating",
            "pool_rating",
            "spa_rating",
            "laundry_rating",
            "positive_points",
            "negative_points",
            "suggestions",
            "submitted_at",
            "source",
            "feedback_token",
        ]

    def validate(self, attrs):
        client = attrs.get("client")
        stay = attrs.get("stay")
        token = attrs.get("feedback_token")

        if client is None:
            raise serializers.ValidationError({"client": "Le client est obligatoire."})
        if stay is None:
            raise serializers.ValidationError({"stay": "Le sejour est obligatoire pour soumettre un avis client."})
        if stay.guest_id != client.id:
            raise serializers.ValidationError({"stay": "Le sejour selectionne ne correspond pas au client."})
        if stay.status != Stay.Status.COMPLETED:
            raise serializers.ValidationError({"stay": "Le feedback ne peut etre soumis qu'apres check-out."})
        if ClientSatisfaction.objects.filter(stay=stay).exists():
            raise serializers.ValidationError({"stay": "Un feedback a deja ete soumis pour ce sejour."})

        validate_feedback_token(token, stay_id=stay.id, client_id=client.id)
        return attrs

    def create(self, validated_data):
        validated_data.pop("feedback_token", None)
        stay = validated_data.get("stay")
        if stay and getattr(stay, "hotel_id", None):
            validated_data.setdefault("hotel_id", stay.hotel_id)
        validated_data["status"] = ClientSatisfaction.Status.FLAGGED if (validated_data.get("overall_rating") or 0) <= 2 else ClientSatisfaction.Status.SUBMITTED
        return ClientSatisfaction.objects.create(**validated_data)


class ClientSatisfactionSubmissionResponseSerializer(serializers.ModelSerializer):
    satisfaction_level_label = serializers.CharField(source="get_satisfaction_level_display", read_only=True)

    class Meta:
        model = ClientSatisfaction
        fields = [
            "id",
            "reference",
            "client",
            "stay",
            "overall_rating",
            "satisfaction_level",
            "satisfaction_level_label",
            "recommendation_score",
            "would_recommend",
            "submitted_at",
            "status",
            "source",
            "created_at",
        ]


def build_satisfaction_summary(queryset):
    aggregates = queryset.aggregate(
        average_overall=Avg("overall_rating"),
        average_recommendation=Avg("recommendation_score"),
        average_reception=Avg("reception_rating"),
        average_room=Avg("room_rating"),
        average_cleanliness=Avg("cleanliness_rating"),
        average_restaurant=Avg("restaurant_rating"),
        average_bar=Avg("bar_rating"),
        average_pool=Avg("pool_rating"),
        average_spa=Avg("spa_rating"),
        average_laundry=Avg("laundry_rating"),
    )
    return {
        key: round(value, 2) if value is not None else None
        for key, value in aggregates.items()
    }
