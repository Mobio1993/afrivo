import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


def load_env_file(file_path):
    if not file_path.exists():
        return

    for raw_line in file_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(ENV_FILE)


def env(name, default=None):
    return os.getenv(name, default)


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def env_list(name, default=""):
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", "unsafe-development-key")
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOW_CREDENTIALS = True
FRONTEND_APP_URL = env("FRONTEND_APP_URL", "http://127.0.0.1:5173")
JWT_SECRET_KEY = env("JWT_SECRET_KEY", SECRET_KEY)
JWT_ACCESS_LIFETIME_SECONDS = int(env("JWT_ACCESS_LIFETIME_SECONDS", "900"))
JWT_REFRESH_LIFETIME_SECONDS = int(env("JWT_REFRESH_LIFETIME_SECONDS", "604800"))
JWT_ACCESS_COOKIE_NAME = env("JWT_ACCESS_COOKIE_NAME", "access_token")
JWT_REFRESH_COOKIE_NAME = env("JWT_REFRESH_COOKIE_NAME", "refresh_token")
JWT_COOKIE_SECURE = env_bool("JWT_COOKIE_SECURE", not DEBUG)
JWT_COOKIE_SAMESITE = env("JWT_COOKIE_SAMESITE", "Lax")
AUTH_LOGIN_THROTTLE_ATTEMPTS = int(env("AUTH_LOGIN_THROTTLE_ATTEMPTS", "5"))
AUTH_LOGIN_THROTTLE_WINDOW_SECONDS = int(env("AUTH_LOGIN_THROTTLE_WINDOW_SECONDS", "900"))
SATISFACTION_CLIENT_APP_KEY = env("SATISFACTION_CLIENT_APP_KEY", "afrivo-satisfaction-dev-key")
TENANCY_STRICT_BILLING = env_bool("TENANCY_STRICT_BILLING", False)
TENANCY_STRICT_CONSUMPTIONS = env_bool("TENANCY_STRICT_CONSUMPTIONS", False)
TENANCY_STRICT_SATISFACTION = env_bool("TENANCY_STRICT_SATISFACTION", False)
TENANCY_STRICT_GUESTS = env_bool("TENANCY_STRICT_GUESTS", False)
TENANCY_STRICT_OPERATIONS = env_bool("TENANCY_STRICT_OPERATIONS", False)
TENANCY_STRICT_HISTORY = env_bool("TENANCY_STRICT_HISTORY", False)
TENANCY_STRICT_ROOMS = env_bool("TENANCY_STRICT_ROOMS", False)
TENANCY_STRICT_BOOKINGS = env_bool("TENANCY_STRICT_BOOKINGS", False)
SUBSCRIPTION_ENFORCEMENT_ENABLED = env_bool("SUBSCRIPTION_ENFORCEMENT_ENABLED", False)
TENANCY_STRICT_MODULES = {
    "billing": TENANCY_STRICT_BILLING,
    "consumptions": TENANCY_STRICT_CONSUMPTIONS,
    "satisfaction": TENANCY_STRICT_SATISFACTION,
    "guests": TENANCY_STRICT_GUESTS,
    "operations": TENANCY_STRICT_OPERATIONS,
    "history": TENANCY_STRICT_HISTORY,
    "rooms": TENANCY_STRICT_ROOMS,
    "bookings": TENANCY_STRICT_BOOKINGS,
}

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "apps.core",
    "apps.tenancy",
    "apps.platform_admin",
    "apps.users",
    "apps.guests",
    "apps.rooms",
    "apps.bookings",
    "apps.stays",
    "apps.billing",
    "apps.consumptions",
    "apps.satisfaction",
    "apps.history",
    "apps.reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "hotel_reception_db"),
        "USER": env("POSTGRES_USER", "postgres"),
        "PASSWORD": env("POSTGRES_PASSWORD", "postgres"),
        "HOST": env("POSTGRES_HOST", "127.0.0.1"),
        "PORT": env("POSTGRES_PORT", "5432"),
    }
}

AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "Atlantic/Reykjavik"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "/admin/"
LOGOUT_REDIRECT_URL = "login"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
