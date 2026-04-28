from django.contrib.auth.views import LoginView, LogoutView
from django.urls import reverse_lazy
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.users.forms import HotelAuthenticationForm
from apps.users.models import User
from apps.users.permissions import UserManagementPermission
from apps.users.serializers import UserSerializer


class HotelLoginView(LoginView):
    template_name = "auth/login.html"
    authentication_form = HotelAuthenticationForm
    redirect_authenticated_user = True

    def form_valid(self, form):
        response = super().form_valid(form)
        if not form.cleaned_data.get("remember_me"):
            self.request.session.set_expiry(0)
        return response

    def get_success_url(self):
        return self.get_redirect_url() or str(reverse_lazy("dashboard"))


class HotelLogoutView(LogoutView):
    next_page = reverse_lazy("login")


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [UserManagementPermission]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        queryset = User.objects.select_related("organization", "hotel").order_by("username")

        if getattr(user, "is_superuser", False) or getattr(user, "is_platform_admin", False):
            return queryset
        if getattr(user, "is_hotel_admin", False):
            if user.hotel_id:
                return queryset.filter(hotel=user.hotel)
            if user.organization_id:
                return queryset.filter(organization=user.organization)
            return queryset
        return queryset.filter(pk=user.pk)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": "Un administrateur ne peut pas se desactiver lui-meme depuis cette API."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
