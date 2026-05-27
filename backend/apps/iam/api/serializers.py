"""IAM API serializer facade.

The canonical serializers remain in apps.users during Phase 1. Import from this
module in new code to avoid coupling new features to the legacy app layout.
"""

from apps.users.serializers import *  # noqa: F401,F403

