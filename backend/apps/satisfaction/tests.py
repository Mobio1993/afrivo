import json
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.bookings.models import Booking
from apps.guests.models import Guest
from apps.rooms.models import Room, RoomType
from apps.satisfaction.models import ClientSatisfaction
from apps.satisfaction.validators import build_feedback_token
from apps.stays.models import Stay
from apps.users.jwt_auth import generate_jwt


User = get_user_model()


class ClientSatisfactionModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="quality", password="testpass123")
        self.guest = Guest.objects.create(first_name="Awa", last_name="Diallo", phone="+221770009900")
        room_type = RoomType.objects.create(
            name="Classic",
            code="CLS2",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=40000,
        )
        room = Room.objects.create(number="118", room_type=room_type)
        booking = Booking.objects.create(
            guest=self.guest,
            room_type=room_type,
            room=room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate(),
            check_out_date=timezone.localdate() + timedelta(days=1),
        )
        self.stay = Stay.create_from_booking(booking, actor=self.user)

    def test_save_derives_satisfaction_level_from_overall_rating(self):
        satisfaction = ClientSatisfaction.objects.create(
            client=self.guest,
            stay=self.stay,
            overall_rating=4,
            recommendation_score=8,
            would_recommend=True,
            recorded_by=self.user,
        )

        self.assertEqual(satisfaction.satisfaction_level, ClientSatisfaction.SatisfactionLevel.SATISFIED)

    def test_clean_rejects_duplicate_stay_feedback(self):
        ClientSatisfaction.objects.create(
            client=self.guest,
            stay=self.stay,
            overall_rating=4,
        )

        duplicate = ClientSatisfaction(
            client=self.guest,
            stay=self.stay,
            overall_rating=5,
        )

        with self.assertRaisesMessage(Exception, "Un avis existe deja pour ce sejour."):
            duplicate.full_clean()


class ClientSatisfactionApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="quality-api",
            password="testpass123",
            role=User.Role.ADMIN,
        )
        self.guest = Guest.objects.create(first_name="Fatou", last_name="Ndiaye", phone="+221770004400")
        room_type = RoomType.objects.create(
            name="Premium QA",
            code="PQA",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night=90000,
        )
        room = Room.objects.create(number="411", room_type=room_type)
        booking = Booking.objects.create(
            guest=self.guest,
            room_type=room_type,
            room=room,
            status=Booking.Status.CONFIRMED,
            check_in_date=timezone.localdate() - timedelta(days=2),
            check_out_date=timezone.localdate() - timedelta(days=1),
        )
        self.stay = Stay.create_from_booking(booking, actor=self.admin)
        Stay.objects.filter(pk=self.stay.pk).update(status=Stay.Status.COMPLETED)
        self.stay.refresh_from_db()
        self.admin_token = generate_jwt(self.admin, "access")

    def test_client_submission_api_creates_feedback(self):
        feedback_token = build_feedback_token(stay_id=self.stay.id, client_id=self.guest.id)

        response = self.client.post(
            "/api/client/satisfaction/",
            data=json.dumps(
                {
                    "client": self.guest.id,
                    "stay": self.stay.id,
                    "overall_rating": 5,
                    "recommendation_score": 10,
                    "would_recommend": True,
                    "positive_points": "Accueil chaleureux",
                    "negative_points": "",
                    "suggestions": "Continuer ainsi",
                    "source": ClientSatisfaction.Source.MOBILE_APP,
                    "feedback_token": feedback_token,
                }
            ),
            content_type="application/json",
            HTTP_X_CLIENT_APP_KEY="afrivo-satisfaction-dev-key",
        )

        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload["client"], self.guest.id)
        self.assertEqual(payload["stay"], self.stay.id)
        self.assertEqual(payload["satisfaction_level"], ClientSatisfaction.SatisfactionLevel.VERY_SATISFIED)
        self.assertEqual(ClientSatisfaction.objects.count(), 1)

    def test_client_submission_rejects_duplicate_feedback_for_same_stay(self):
        ClientSatisfaction.objects.create(
            client=self.guest,
            stay=self.stay,
            overall_rating=4,
            source=ClientSatisfaction.Source.WEB_APP,
        )
        feedback_token = build_feedback_token(stay_id=self.stay.id, client_id=self.guest.id)

        response = self.client.post(
            "/api/client/satisfaction/",
            data=json.dumps(
                {
                    "client": self.guest.id,
                    "stay": self.stay.id,
                    "overall_rating": 3,
                    "source": ClientSatisfaction.Source.WEB_APP,
                    "feedback_token": feedback_token,
                }
            ),
            content_type="application/json",
            HTTP_X_CLIENT_APP_KEY="afrivo-satisfaction-dev-key",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("stay", response.json())

    def test_admin_read_only_list_returns_feedbacks(self):
        ClientSatisfaction.objects.create(
            client=self.guest,
            stay=self.stay,
            overall_rating=4,
            recommendation_score=8,
            would_recommend=True,
            source=ClientSatisfaction.Source.QR_CODE,
        )

        response = self.client.get(
            f"/api/admin/satisfaction/?client={self.guest.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        results = payload["results"] if isinstance(payload, dict) else payload
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["client"], self.guest.id)

    def test_admin_summary_endpoint_exposes_averages(self):
        ClientSatisfaction.objects.create(
            client=self.guest,
            stay=self.stay,
            overall_rating=2,
            recommendation_score=3,
            would_recommend=False,
            source=ClientSatisfaction.Source.WEB_APP,
        )

        response = self.client.get(
            f"/api/admin/satisfaction/summary/?client={self.guest.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["totals"]["count"], 1)
        self.assertEqual(payload["totals"]["dissatisfied_count"], 1)
        self.assertEqual(payload["averages"]["average_overall"], 2.0)

    def test_admin_post_is_not_allowed(self):
        response = self.client.post(
            "/api/admin/satisfaction/",
            data=json.dumps({"client": self.guest.id, "stay": self.stay.id, "overall_rating": 5}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )

        self.assertEqual(response.status_code, 403)

    @override_settings(
        TENANCY_STRICT_MODULES={
            "billing": False,
            "consumptions": False,
            "satisfaction": True,
            "guests": False,
            "operations": False,
            "history": False,
        }
    )
    def test_satisfaction_admin_api_can_be_switched_to_strict_mode(self):
        response = self.client.get(
            "/api/admin/satisfaction/",
            HTTP_AUTHORIZATION=f"Bearer {self.admin_token}",
        )

        self.assertEqual(response.status_code, 403)
