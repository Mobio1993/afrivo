from django.utils import timezone


class MfaService:
    """Small facade for MFA state.

    The login challenge flow remains in apps.users.api_views for compatibility.
    This service gives future code a stable place to check and mutate MFA flags.
    """

    @staticmethod
    def is_required(user):
        return bool(user and getattr(user, "requires_two_factor", False))

    @staticmethod
    def is_enabled(user):
        return bool(user and getattr(user, "two_factor_enabled", False))

    @staticmethod
    def enable(user):
        user.two_factor_enabled = True
        user.two_factor_enabled_at = timezone.now()
        user.save(update_fields=["two_factor_enabled", "two_factor_enabled_at"])
        return user

    @staticmethod
    def disable(user):
        user.two_factor_enabled = False
        user.two_factor_enabled_at = None
        user.save(update_fields=["two_factor_enabled", "two_factor_enabled_at"])
        return user


is_mfa_required = MfaService.is_required
is_mfa_enabled = MfaService.is_enabled

