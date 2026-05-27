from django.test import TestCase

from apps.iam.models import User
from apps.pos_restaurant.models import Restaurant, UserPosAccess
from apps.pos_restaurant.permissions import can_use_pos_scope, user_has_active_pos_access
from apps.tenancy.models import Hotel, Organization


class PosRestaurantSecurityRegressionTests(TestCase):
    """Phase 8 security tests for POS hotel scoping."""

    def setUp(self):
        self.organization_a = Organization.objects.create(name="POS Org A", slug="pos-org-a")
        self.hotel_a = Hotel.objects.create(
            organization=self.organization_a,
            name="POS Hotel A",
            code="POSA",
            slug="pos-hotel-a",
        )
        self.restaurant_a = Restaurant.objects.create(hotel=self.hotel_a, nom="Restaurant A")
        self.organization_b = Organization.objects.create(name="POS Org B", slug="pos-org-b")
        self.hotel_b = Hotel.objects.create(
            organization=self.organization_b,
            name="POS Hotel B",
            code="POSB",
            slug="pos-hotel-b",
        )
        self.restaurant_b = Restaurant.objects.create(hotel=self.hotel_b, nom="Restaurant B")
        self.pos_user = User.objects.create_user(
            username="pos-scoped-user",
            password="testpass123",
            role=User.Role.RESTAURANT,
        )
        UserPosAccess.objects.create(
            user=self.pos_user,
            organization=self.organization_a,
            hotel=self.hotel_a,
            restaurant=self.restaurant_a,
            pos_role=UserPosAccess.PosRole.SERVEUR,
        )

    def test_pos_user_can_access_only_assigned_hotel(self):
        self.assertTrue(user_has_active_pos_access(self.pos_user, hotel=self.hotel_a, restaurant=self.restaurant_a))
        self.assertFalse(user_has_active_pos_access(self.pos_user, hotel=self.hotel_b, restaurant=self.restaurant_b))

        self.assertTrue(can_use_pos_scope(self.pos_user, hotel=self.hotel_a, restaurant=self.restaurant_a))
        self.assertFalse(can_use_pos_scope(self.pos_user, hotel=self.hotel_b, restaurant=self.restaurant_b))
