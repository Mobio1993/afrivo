from django.core import signing
from django.core.exceptions import ValidationError
from django.utils import timezone


TOKEN_SALT = "client-satisfaction"
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30


def build_feedback_token(*, stay_id, client_id):
    payload = {
        "stay_id": stay_id,
        "client_id": client_id,
        "issued_at": timezone.now().isoformat(),
    }
    return signing.dumps(payload, salt=TOKEN_SALT)


def validate_feedback_token(token, *, stay_id, client_id):
    if not token:
        raise ValidationError({"feedback_token": "Le jeton de satisfaction est requis."})

    try:
        payload = signing.loads(token, salt=TOKEN_SALT, max_age=TOKEN_MAX_AGE_SECONDS)
    except signing.BadSignature as error:
        raise ValidationError({"feedback_token": "Le jeton de satisfaction est invalide."}) from error
    except signing.SignatureExpired as error:
        raise ValidationError({"feedback_token": "Le jeton de satisfaction a expire."}) from error

    if payload.get("stay_id") != stay_id or payload.get("client_id") != client_id:
        raise ValidationError({"feedback_token": "Le jeton ne correspond pas au client ou au sejour fournis."})

    return payload
