from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "account",
            "user",
            "tenant",
            "tenant_name",
            "title",
            "message",
            "notification_type",
            "channel",
            "status",
            "is_read",
            "sent_at",
            "failure_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account", "tenant_name", "created_at", "updated_at"]

    def get_tenant_name(self, obj):
        return str(obj.tenant) if obj.tenant else ""
