"""IAM facade app for AFRIVO.

This app intentionally reuses the current users app as the source of truth.
It gives new code a stable IAM import path without moving database tables.
"""

