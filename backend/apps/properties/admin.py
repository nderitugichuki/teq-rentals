from django.contrib import admin

from apps.properties.models import Property, Unit


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ["name", "landlord", "property_type", "county", "town", "created_at"]
    list_filter = ["property_type", "county", "town"]
    search_fields = ["name", "address", "county", "town", "landlord__email"]
    filter_horizontal = ["caretakers"]


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ["unit_number", "property", "unit_type", "rent_amount", "status"]
    list_filter = ["status", "unit_type", "property"]
    search_fields = ["unit_number", "property__name"]
