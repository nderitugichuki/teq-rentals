from django.contrib import admin

from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["title", "tenant", "user", "notification_type", "channel", "status", "is_read", "created_at"]
    list_filter = ["notification_type", "channel", "status", "is_read"]
    search_fields = ["title", "message", "tenant__first_name", "tenant__last_name", "user__email"]
    readonly_fields = ["sent_at", "failure_reason", "created_at", "updated_at"]

