from apps.audit_logs.services import AuditService
from apps.iam.models import UserSession


class SuperRootAuditService:
    """Mandatory audit facade for Super Root operations.

    The storage remains the existing unified AuditService, but this facade makes
    Super Root events consistent and guarantees security metadata is attached.
    """

    MODULE = "super_root_security"

    @staticmethod
    def client_ip(request=None):
        if request is None:
            return ""
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")

    @staticmethod
    def user_agent(request=None):
        if request is None:
            return ""
        return request.META.get("HTTP_USER_AGENT", "")

    @classmethod
    def session_metadata(cls, request=None, actor=None):
        metadata = {
            "ip_address": cls.client_ip(request),
            "user_agent": cls.user_agent(request),
            "path": getattr(request, "path", "") if request is not None else "",
            "method": getattr(request, "method", "") if request is not None else "",
            "access_token_jti": "",
            "device_session_id": None,
            "device_name": "",
        }

        jwt_payload = getattr(request, "jwt_payload", None) if request is not None else None
        if jwt_payload:
            metadata["access_token_jti"] = jwt_payload.get("jti", "")

        user = actor or getattr(request, "user", None)
        if not getattr(user, "is_authenticated", False):
            return metadata

        queryset = UserSession.objects.filter(user=user, is_active=True)
        ip_address = metadata["ip_address"]
        user_agent = metadata["user_agent"]
        if ip_address:
            queryset = queryset.filter(ip_address=ip_address)
        if user_agent:
            queryset = queryset.filter(user_agent=user_agent)
        session = queryset.order_by("-last_activity", "-created_at").first()
        if session is not None:
            metadata["device_session_id"] = session.id
            metadata["device_name"] = session.device_name
        return metadata

    @classmethod
    def log(
        cls,
        *,
        actor=None,
        action,
        target=None,
        request=None,
        severity="info",
        metadata=None,
        description="",
    ):
        payload = {
            "portal": "super_root",
            "action": action,
            **cls.session_metadata(request=request, actor=actor),
            **(metadata or {}),
        }
        return AuditService.log(
            actor=actor,
            action=action,
            target=target,
            request=request,
            severity=severity,
            module=cls.MODULE,
            metadata=payload,
            description=description or f"Super Root: {action}",
        )

    @classmethod
    def auth(cls, request=None, *, actor=None, action, identifier="", severity="info", metadata=None):
        return cls.log(
            actor=actor,
            target=actor,
            request=request,
            action=action,
            severity=severity,
            metadata={"identifier": identifier, **(metadata or {})},
            description=f"Authentification Super Root: {action}",
        )

    @classmethod
    def access(cls, request=None, *, actor=None, action, target=None, severity="info", metadata=None):
        return cls.log(
            actor=actor,
            target=target,
            request=request,
            action=action,
            severity=severity,
            metadata=metadata,
            description=f"Acces Super Root: {action}",
        )

    @classmethod
    def denied(cls, request=None, *, actor=None, action, target=None, reason="", metadata=None):
        return cls.log(
            actor=actor,
            target=target,
            request=request,
            action=action,
            severity="critical",
            metadata={"reason": reason, **(metadata or {})},
            description=f"Tentative interdite Super Root: {action}",
        )

    @classmethod
    def critical(cls, request=None, *, actor=None, action, target=None, severity="warning", metadata=None):
        return cls.log(
            actor=actor,
            target=target,
            request=request,
            action=action,
            severity=severity,
            metadata=metadata,
            description=f"Action critique Super Root: {action}",
        )
