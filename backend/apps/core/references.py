from secrets import token_hex

from django.utils import timezone


def generate_unique_reference(model_class, prefix, field_name="reference", random_hex_length=4):
    """
    Build a collision-resistant reference while preserving a readable timestamp prefix.
    """
    while True:
        # Keep references within the current max_length=20 used across the project.
        timestamp = timezone.now().strftime("%y%m%d%H%M%S")
        candidate = f"{prefix}-{timestamp}{token_hex(random_hex_length // 2).upper()}"
        if not model_class.objects.filter(**{field_name: candidate}).exists():
            return candidate
