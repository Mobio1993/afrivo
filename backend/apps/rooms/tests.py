from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.guests.models import Guest
from apps.rooms.models import Room, RoomHousekeepingTask, RoomMaintenanceIncident, RoomType
from apps.tenancy.services import get_or_create_default_tenancy


User = get_user_model()


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
