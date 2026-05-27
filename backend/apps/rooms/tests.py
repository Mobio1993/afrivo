from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.guests.models import Guest
from apps.rooms.models import Room, RoomAlert, RoomHousekeepingTask, RoomLiveStatus, RoomMaintenanceIncident, RoomSensor, RoomType
from apps.tenancy.models import Hotel, HotelSettings, Organization
from apps.tenancy.services import get_or_create_default_tenancy


User = get_user_model()


def response_results(response):
    payload = response.json()
    if isinstance(payload, dict):
        return payload.get("results", [])
    return payload


class RoomsApiTests(TestCase):
    def setUp(self):
        self.organization, self.hotel = get_or_create_default_tenancy()
        self.admin = User.objects.create_user(
            username="room-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.housekeeper = User.objects.create_user(
            username="room-hk",
            password="testpass123",
            role=User.Role.HOUSEKEEPING,
            organization=self.organization,
            hotel=self.hotel,
        )
        self.room_type = RoomType.objects.create(
            hotel=self.hotel,
            name="Suite Executive",
            code="STE-EXE",
            capacity=2,
            max_adults=2,
            max_children=0,
            base_price_per_night="150.00",
            base_price_day_use="80.00",
            amenities=["wifi", "smart_tv"],
        )
        self.room = Room.objects.create(
            hotel=self.hotel,
            number="101",
            room_type=self.room_type,
            floor=1,
            status=Room.Status.AVAILABLE,
            is_vip_preferred=True,
        )
        self.guest = Guest.objects.create(
            hotel=self.hotel,
            first_name="Awa",
            last_name="Diop",
            client_type=Guest.ClientType.VIP,
        )
        self.client.force_login(self.admin)

    def test_rooms_dashboard_returns_summary_and_grid(self):
        response = self.client.get("/api/rooms/dashboard/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["summary"]["room_count"], 1)
        self.assertEqual(payload["room_grid"][0]["number"], "101")

    def test_room_direct_check_in_is_rejected(self):
        response = self.client.post(f"/api/rooms/{self.room.id}/check-in/")

        self.assertEqual(response.status_code, 400)
        self.room.refresh_from_db()
        self.assertEqual(self.room.status, Room.Status.AVAILABLE)
        self.assertIn("reservation confirmee", response.json()["detail"])

    def test_inactive_room_number_cannot_be_recreated_and_can_be_reactivated(self):
        self.client.delete(f"/api/rooms/{self.room.id}/")
        self.room.refresh_from_db()
        self.assertFalse(self.room.is_active)

        duplicate_response = self.client.post(
            "/api/rooms/",
            data={
                "number": "101",
                "room_type": self.room_type.id,
                "floor": 1,
                "status": Room.Status.AVAILABLE,
            },
        )

        self.assertEqual(duplicate_response.status_code, 400)
        duplicate_payload = duplicate_response.json()
        self.assertEqual(duplicate_payload["reactivate_room_id"], str(self.room.id))
        self.assertIn("desactivee", duplicate_payload["number"][0])

        reactivate_response = self.client.post(f"/api/rooms/{self.room.id}/reactivate/")

        self.assertEqual(reactivate_response.status_code, 200)
        self.room.refresh_from_db()
        self.assertTrue(self.room.is_active)

    def test_room_create_rejects_room_type_from_other_hotel(self):
        other_org = Organization.objects.create(name="Other Room Type Org", slug="other-room-type-org")
        other_hotel = Hotel.objects.create(
            organization=other_org,
            name="Other Room Type Hotel",
            code="ORTH",
            slug="other-room-type-hotel",
            is_active=True,
        )
        other_room_type = RoomType.objects.create(
            hotel=other_hotel,
            name="Other Suite",
            code="OTH-SUITE",
            base_price_per_night="99000.00",
        )

        response = self.client.post(
            "/api/rooms/",
            data={
                "number": "909",
                "room_type": other_room_type.id,
                "floor": 9,
                "status": Room.Status.AVAILABLE,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("room_type", response.json())

    def test_assignment_suggestions_include_matching_room(self):
        response = self.client.get(
            f"/api/rooms/assignment-suggestions/?guest={self.guest.id}&room_type={self.room_type.id}&limit=3"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["results"]), 1)
        self.assertEqual(payload["results"][0]["number"], "101")

    def test_realtime_endpoint_returns_room_supervision_payload(self):
        response = self.client.get("/api/rooms/realtime/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["source"], "simulated_backend")
        self.assertEqual(len(payload["results"]), 1)
        room_payload = payload["results"][0]
        self.assertEqual(room_payload["roomNumber"], "101")
        self.assertIn(room_payload["hotelStatus"], ["available", "occupied", "reserved", "cleaning", "maintenance"])
        self.assertIn("alertMessage", room_payload)
        self.assertIn("sensorStatus", room_payload)

    def test_smart_rooms_endpoints_are_scoped_to_active_hotel(self):
        RoomLiveStatus.objects.create(
            hotel=self.hotel,
            room=self.room,
            hotel_status=RoomLiveStatus.HotelStatus.AVAILABLE,
            presence_status=RoomLiveStatus.PresenceStatus.DETECTED,
        )
        RoomAlert.objects.create(
            hotel=self.hotel,
            room=self.room,
            alert_type=RoomAlert.AlertType.PRESENCE_ANOMALY,
            severity=RoomAlert.Severity.CRITICAL,
            message="Presence detectee dans une chambre disponible",
        )
        RoomSensor.objects.create(
            hotel=self.hotel,
            room=self.room,
            sensor_type=RoomSensor.SensorType.PRESENCE,
            name="Capteur presence 101",
            status=RoomSensor.Status.ONLINE,
        )
        other_org = Organization.objects.create(name="Go Dream", slug="go-dream")
        other_hotel = Hotel.objects.create(
            organization=other_org,
            name="Go Dream Hotel",
            code="GD-001",
            slug="go-dream-hotel",
            is_active=True,
        )
        HotelSettings.objects.create(hotel=other_hotel)
        other_admin = User.objects.create_user(
            username="go-dream-admin",
            password="testpass123",
            role=User.Role.ADMIN,
            organization=other_org,
            hotel=other_hotel,
        )

        self.client.force_login(other_admin)

        realtime_response = self.client.get("/api/rooms/realtime/")
        live_response = self.client.get("/api/rooms/live/")
        alerts_response = self.client.get("/api/rooms/alerts/")
        sensors_response = self.client.get("/api/rooms/sensors/")

        self.assertEqual(realtime_response.status_code, 200)
        self.assertEqual(live_response.status_code, 200)
        self.assertEqual(alerts_response.status_code, 200)
        self.assertEqual(sensors_response.status_code, 200)
        self.assertEqual(realtime_response.json()["results"], [])
        self.assertEqual(response_results(live_response), [])
        self.assertEqual(response_results(alerts_response), [])
        self.assertEqual(response_results(sensors_response), [])

    def test_housekeeping_completion_updates_room_status(self):
        self.room.status = Room.Status.CLEANING
        self.room.save(update_fields=["status", "updated_at"])
        task = RoomHousekeepingTask.objects.create(
            hotel=self.hotel,
            room=self.room,
            assigned_to=self.housekeeper,
            status=RoomHousekeepingTask.Status.IN_PROGRESS,
        )

        response = self.client.post(f"/api/rooms/housekeeping/tasks/{task.id}/complete/", data={"actual_minutes": 22})

        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.room.refresh_from_db()
        self.assertEqual(task.status, RoomHousekeepingTask.Status.COMPLETED)
        self.assertEqual(self.room.status, Room.Status.AVAILABLE)

    def test_open_maintenance_marks_room_out_of_service(self):
        response = self.client.post(
            "/api/rooms/maintenance/incidents/",
            data={
                "room": self.room.id,
                "title": "Climatiseur en panne",
                "severity": RoomMaintenanceIncident.Severity.HIGH,
                "status": RoomMaintenanceIncident.Status.OPEN,
                "marks_room_out_of_service": True,
            },
        )

        self.assertEqual(response.status_code, 201)
        self.room.refresh_from_db()
        self.assertEqual(self.room.status, Room.Status.OUT_OF_SERVICE)
