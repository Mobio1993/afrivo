from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="SuperRootPlatform",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=160)),
                ("slug", models.SlugField(max_length=180, unique=True)),
                ("code", models.CharField(max_length=12)),
                ("domain_url", models.URLField(blank=True)),
                ("status", models.CharField(choices=[("active", "Active"), ("suspended", "Suspendue"), ("maintenance", "Maintenance"), ("degraded", "Degradee")], default="active", max_length=24)),
                ("environment", models.CharField(default="production", max_length=40)),
                ("region", models.CharField(blank=True, max_length=80)),
                ("owner_email", models.EmailField(blank=True, max_length=254)),
                ("notes", models.TextField(blank=True)),
                ("is_primary", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="super_root_platforms_created", to=settings.AUTH_USER_MODEL)),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="super_root_platforms_updated", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-is_primary", "name"],
            },
        ),
        migrations.AddIndex(
            model_name="superrootplatform",
            index=models.Index(fields=["slug"], name="sr_platform_slug_idx"),
        ),
        migrations.AddIndex(
            model_name="superrootplatform",
            index=models.Index(fields=["status"], name="sr_platform_status_idx"),
        ),
    ]
