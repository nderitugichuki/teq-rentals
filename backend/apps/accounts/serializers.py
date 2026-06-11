from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import Account, AuditLog, Role

User = get_user_model()


class AccountSerializer(serializers.ModelSerializer):
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    features = serializers.DictField(read_only=True)

    class Meta:
        model = Account
        fields = [
            "id",
            "name",
            "owner",
            "owner_email",
            "is_active",
            "enable_maintenance",
            "enable_cash_collections",
            "enable_payment_claims",
            "enable_sms",
            "enable_late_fees",
            "enable_expenses",
            "enable_utilities",
            "enable_tenant_portal",
            "features",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner_email", "created_at", "updated_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source="actor.email", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "account", "actor", "actor_email", "action", "entity_type", "entity_id", "summary", "created_at"]
        read_only_fields = fields


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name", "description", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)
    role_name = serializers.CharField(read_only=True)
    account_features = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "account",
            "first_name",
            "last_name",
            "phone_number",
            "role",
            "role_name",
            "account_features",
            "is_active",
            "is_staff",
            "password",
            "date_joined",
        ]
        read_only_fields = ["id", "is_staff", "date_joined", "role_name", "account_features"]

    def get_account_features(self, obj):
        return obj.account.features if obj.account else {}

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance
