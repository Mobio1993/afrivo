from django.conf import settings
from django.db import models


class SuperRootPlatform(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspendue"
        MAINTENANCE = "maintenance", "Maintenance"
        DEGRADED = "degraded", "Degradee"

    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180, unique=True)
    code = models.CharField(max_length=12)
    domain_url = models.URLField(blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.ACTIVE)
    environment = models.CharField(max_length=40, default="production")
    region = models.CharField(max_length=80, blank=True)
    owner_email = models.EmailField(blank=True)
    notes = models.TextField(blank=True)
    is_primary = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="super_root_platforms_created",
        on_delete=models.SET_NULL,
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        related_name="super_root_platforms_updated",
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_primary", "name"]
        indexes = [
            models.Index(fields=["slug"], name="sr_platform_slug_idx"),
            models.Index(fields=["status"], name="sr_platform_status_idx"),
        ]

    def __str__(self):
        return self.name
