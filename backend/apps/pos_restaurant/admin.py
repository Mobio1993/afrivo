from django.contrib import admin

from .models import (
    Bill,
    DiningArea,
    Discount,
    KitchenTicket,
    Menu,
    MenuCategory,
    MenuItem,
    Order,
    OrderItem,
    Payment,
    Restaurant,
    Table,
    Tax,
    UserPosAccess,
    VoidReason,
)

admin.site.register(Restaurant)
admin.site.register(DiningArea)
admin.site.register(Table)
admin.site.register(Menu)
admin.site.register(MenuCategory)
admin.site.register(MenuItem)
admin.site.register(Discount)
admin.site.register(Tax)
admin.site.register(VoidReason)
admin.site.register(Order)
admin.site.register(OrderItem)
admin.site.register(KitchenTicket)
admin.site.register(Bill)
admin.site.register(Payment)
admin.site.register(UserPosAccess)
