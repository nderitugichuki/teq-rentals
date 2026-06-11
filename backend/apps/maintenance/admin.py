from django.contrib import admin

from apps.maintenance.models import MaintenancePhoto, MaintenanceRequest


@admin.register(MaintenanceRequest)
class MaintenanceRequestAdmin(admin.ModelAdmin):
    list_display = ["title", "property", "unit", "priority", "status", "assigned_to", "reported_by", "cost"]
    list_filter = ["priority", "status", "property", "assigned_to"]
    search_fields = ["title", "description", "property__name", "unit__unit_number", "tenant__first_name", "tenant__last_name"]
    readonly_fields = ["resolved_at", "reported_at", "created_at", "updated_at"]


@admin.register(MaintenancePhoto)
class MaintenancePhotoAdmin(admin.ModelAdmin):
    list_display = ["maintenance_request", "caption", "uploaded_by", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["maintenance_request__title", "caption", "uploaded_by__email"]
