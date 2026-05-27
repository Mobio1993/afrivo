import hashlib

from django.db import migrations, models


def backfill_token_hashes(apps, schema_editor):
    BlacklistedToken = apps.get_model("users", "BlacklistedToken")
    for item in BlacklistedToken.objects.exclude(token="").iterator():
        token_hash = hashlib.sha256(item.token.encode("utf-8")).hexdigest()
        item.token_hash = token_hash
        try:
            parts = item.token.split(".")
            if len(parts) == 3:
                import base64
                import json

                payload = parts[1]
                payload += "=" * (-len(payload) % 4)
                data = json.loads(base64.urlsafe_b64decode(payload).decode("utf-8"))
                item.token_jti = data.get("jti", "") or ""
        except Exception:
            item.token_jti = ""
        item.save(update_fields=["token_hash", "token_jti"])


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0011_iam_foundation"),
    ]

    operations = [
        migrations.AlterField(
            model_name="blacklistedtoken",
            name="token",
            field=models.TextField(blank=True, default="", verbose_name="Token legacy"),
        ),
        migrations.AddField(
            model_name="blacklistedtoken",
            name="token_hash",
            field=models.CharField(blank=True, max_length=64, verbose_name="Hash token"),
        ),
        migrations.AddField(
            model_name="blacklistedtoken",
            name="token_jti",
            field=models.CharField(blank=True, max_length=80, verbose_name="JTI token"),
        ),
        migrations.AddIndex(
            model_name="blacklistedtoken",
            index=models.Index(fields=["token_hash"], name="black_token_hash_idx"),
        ),
        migrations.AddIndex(
            model_name="blacklistedtoken",
            index=models.Index(fields=["token_jti"], name="black_token_jti_idx"),
        ),
        migrations.RunPython(backfill_token_hashes, migrations.RunPython.noop),
    ]
