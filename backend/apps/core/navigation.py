from django.conf import settings


def build_sidebar_links(active_key):
    frontend_app_url = settings.FRONTEND_APP_URL.rstrip("/")
    items = [
        {
            "key": "home",
            "title": "Accueil",
            "subtitle": "Vue generale",
            "url": f"{frontend_app_url}/",
        },
        {
            "key": "dashboard",
            "title": "Dashboard API",
            "subtitle": "Pilotage",
            "url": f"{frontend_app_url}/dashboard",
        },
        {
            "key": "clients",
            "title": "Clients",
            "subtitle": "Base clients",
            "url": f"{frontend_app_url}/clients",
        },
        {
            "key": "exploitation",
            "title": "Exploitation",
            "subtitle": "Files du jour",
            "url": f"{frontend_app_url}/exploitation",
        },
        {
            "key": "operations",
            "title": "Operations",
            "subtitle": "Flux metier",
            "url": f"{frontend_app_url}/operations",
        },
        {
            "key": "reports",
            "title": "Rapports",
            "subtitle": "Analyse direction",
            "url": f"{frontend_app_url}/reports",
        },
    ]

    return [
        {
            "title": item["title"],
            "subtitle": item["subtitle"],
            "url": item["url"],
            "active": item["key"] == active_key,
        }
        for item in items
    ]
