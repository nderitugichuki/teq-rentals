from rest_framework import serializers

from apps.maintenance.models import MaintenancePhoto, MaintenanceRequest


class MaintenancePhotoSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True)
    request_title = serializers.CharField(source="maintenance_request.title", read_only=True)

    class Meta:
        model = MaintenancePhoto
        fields = [
            "id",
            "account",
            "maintenance_request",
            "request_title",
            "image",
            "caption",
            "uploaded_by",
            "uploaded_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account", "request_title", "uploaded_by", "uploaded_by_email", "created_at", "updated_at"]


class MaintenanceRequestSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source="property.name", read_only=True)
    unit_label = serializers.SerializerMethodField()
    tenant_name = serializers.SerializerMethodField()
    assigned_to_email = serializers.EmailField(source="assigned_to.email", read_only=True)
    reported_by_email = serializers.EmailField(source="reported_by.email", read_only=True)
    photo_count = serializers.IntegerField(source="photos.count", read_only=True)

    class Meta:
        model = MaintenanceRequest
        fields = [
            "id",
            "account",
            "property",
            "property_name",
            "unit",
            "unit_label",
            "tenant",
            "tenant_name",
            "title",
            "description",
            "priority",
            "status",
            "assigned_to",
            "assigned_to_email",
            "reported_by",
            "reported_by_email",
            "photo_count",
            "cost",
            "approval_notes",
            "resolution_notes",
            "reported_at",
            "approved_at",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "account",
            "property_name",
            "unit_label",
            "tenant_name",
            "reported_by",
            "reported_by_email",
            "resolved_at",
            "created_at",
            "updated_at",
        ]

    def get_unit_label(self, obj):
        return str(obj.unit)

    def get_tenant_name(self, obj):
        return str(obj.tenant) if obj.tenant else ""
