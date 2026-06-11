from rest_framework import serializers

from apps.accounts.models import Role
from apps.properties.models import Property, Unit


class PropertySerializer(serializers.ModelSerializer):
    caretaker_emails = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            "id",
            "account",
            "landlord",
            "caretakers",
            "caretaker_emails",
            "name",
            "property_type",
            "address",
            "county",
            "town",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account", "caretaker_emails", "created_at", "updated_at"]
        extra_kwargs = {
            "landlord": {"required": False},
            "address": {"required": False},
            "county": {"required": False},
        }

    def get_caretaker_emails(self, obj):
        return [caretaker.email for caretaker in obj.caretakers.all()]

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        caretakers = attrs.get("caretakers")
        account = getattr(self.instance, "account", None) or getattr(user, "account", None)

        if getattr(user, "is_admin", False) and self.instance is None and not attrs.get("landlord"):
            raise serializers.ValidationError({"landlord": "This field is required when an admin creates a property."})

        if caretakers is not None and account is not None:
            invalid_caretakers = [
                caretaker.email
                for caretaker in caretakers
                if caretaker.account_id != account.id or caretaker.role_name != Role.Names.CARETAKER
            ]
            if invalid_caretakers:
                raise serializers.ValidationError(
                    {"caretakers": "Caretakers must belong to this landlord account and have the caretaker role."}
                )

        return attrs


class UnitSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source="property.name", read_only=True)

    class Meta:
        model = Unit
        fields = [
            "id",
            "property",
            "property_name",
            "unit_number",
            "unit_type",
            "floor",
            "rent_amount",
            "deposit_amount",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "property_name", "created_at", "updated_at"]
