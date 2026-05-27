from apps.users.jwt_auth import (
    attach_auth_cookies,
    authenticate_request,
    blacklist_token,
    build_auth_response_payload,
    clear_auth_cookies,
    create_user_session,
    decode_jwt,
    generate_jwt,
    get_token_jti,
    get_user_from_payload,
    is_token_blacklisted,
    request_has_auth_token,
    resolve_api_user,
    revoke_user_session_by_token,
)


class TokenService:
    """JWT/session facade backed by apps.users.jwt_auth."""

    generate = staticmethod(generate_jwt)
    decode = staticmethod(decode_jwt)
    get_jti = staticmethod(get_token_jti)
    get_user_from_payload = staticmethod(get_user_from_payload)
    is_blacklisted = staticmethod(is_token_blacklisted)
    blacklist = staticmethod(blacklist_token)
    authenticate_request = staticmethod(authenticate_request)
    request_has_auth_token = staticmethod(request_has_auth_token)
    resolve_api_user = staticmethod(resolve_api_user)
    build_auth_payload = staticmethod(build_auth_response_payload)
    create_session = staticmethod(create_user_session)
    revoke_session_by_token = staticmethod(revoke_user_session_by_token)
    attach_cookies = staticmethod(attach_auth_cookies)
    clear_cookies = staticmethod(clear_auth_cookies)


__all__ = [
    "TokenService",
    "attach_auth_cookies",
    "authenticate_request",
    "blacklist_token",
    "build_auth_response_payload",
    "clear_auth_cookies",
    "create_user_session",
    "decode_jwt",
    "generate_jwt",
    "get_token_jti",
    "get_user_from_payload",
    "is_token_blacklisted",
    "request_has_auth_token",
    "resolve_api_user",
    "revoke_user_session_by_token",
]

