from rest_framework import serializers


class ReportPeriodStatsSerializer(serializers.Serializer):
    """Enhanced stats for a given period with delta vs previous period."""

    encaissements_total = serializers.FloatField()
    paiements_valides = serializers.IntegerField()
    paiements_en_attente = serializers.IntegerField()
    montant_rembourse = serializers.FloatField()
    occupation_rate = serializers.FloatField()
    day_use_count = serializers.IntegerField()
    taux_recouvrement = serializers.FloatField()
    revpar = serializers.FloatField()
    ticket_moyen = serializers.FloatField()

    delta_encaissements = serializers.FloatField()
    delta_occupation = serializers.FloatField()
    delta_day_use = serializers.IntegerField()
    delta_taux_recouvrement = serializers.FloatField()
    delta_revpar = serializers.FloatField()

    modes_paiement = serializers.DictField()
    origine_revenus = serializers.DictField()

    sparkline_encaissements = serializers.ListField(child=serializers.FloatField())
    sparkline_paiements = serializers.ListField(child=serializers.IntegerField())
    sparkline_occupation = serializers.ListField(child=serializers.FloatField())
    sparkline_labels = serializers.ListField(child=serializers.CharField())

    rooms_heatmap = serializers.ListField()
    alerts = serializers.ListField()
    liste_detaillee = serializers.ListField()
