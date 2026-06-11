from rest_framework import serializers

from apps.properties.models import Unit
from apps.tenants.models import PromiseToPay, Tenant


class TenantSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            "id",
            "account",
            "created_by",
            "first_name",
            "last_name",
            "full_name",
            "phone_number",
            "email",
            "id_number",
            "kra_pin",
            "emergency_contact_name",
            "emergency_contact_phone",
            "move_in_date",
            "status",
            "move_out_date",
            "deposit_refund_status",
            "keys_returned",
            "damages_checked",
            "final_balance_confirmed",
            "unit_ready_for_next_tenant",
            "move_out_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account", "created_by", "full_name", "created_at", "updated_at"]

    def get_full_name(self, obj):
        return str(obj)

    def validate(self, attrs):
        required_fields = [
            "first_name",
            "last_name",
            "phone_number",
            "emergency_contact_name",
            "emergency_contact_phone",
            "move_in_date",
        ]
        errors = {
            field: "This field is required."
            for field in required_fields
            if not attrs.get(field) and not getattr(self.instance, field, None)
        }
        if errors:
            raise serializers.ValidationError(errors)

        phone_number = attrs.get("phone_number") or getattr(self.instance, "phone_number", "")
        request = self.context.get("request")
        account = getattr(self.instance, "account", None) or getattr(getattr(request, "user", None), "account", None)
        if phone_number and account:
            duplicate_phone = Tenant.objects.filter(account=account, phone_number=phone_number)
            if self.instance:
                duplicate_phone = duplicate_phone.exclude(pk=self.instance.pk)
            if duplicate_phone.exists():
                raise serializers.ValidationError({"phone_number": "This phone number is already registered in this landlord account."})
        return attrs


class PromiseToPaySerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    unit_label = serializers.SerializerMethodField()
    recorded_by_email = serializers.EmailField(source="recorded_by.email", read_only=True)

    class Meta:
        model = PromiseToPay
        fields = [
            "id",
            "account",
            "tenant",
            "tenant_name",
            "rent_charge",
            "unit_label",
            "promised_amount",
            "promised_date",
            "status",
            "note",
            "recorded_by",
            "recorded_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account", "tenant_name", "unit_label", "recorded_by", "recorded_by_email", "created_at", "updated_at"]

    def get_tenant_name(self, obj):
        return str(obj.tenant)

    def get_unit_label(self, obj):
        return str(obj.rent_charge.unit) if obj.rent_charge_id else ""


class TenantTransferSerializer(serializers.Serializer):
    class DepositHandling:
        CARRY_FORWARD = "carry_forward"
        ADDITIONAL = "additional"
        FULL = "full"

    new_unit = serializers.PrimaryKeyRelatedField(queryset=Unit.objects.select_related("property").all())
    transfer_date = serializers.DateField()
    deposit_handling = serializers.ChoiceField(
        choices=[
            (DepositHandling.CARRY_FORWARD, "Carry forward existing deposit"),
            (DepositHandling.ADDITIONAL, "Charge additional deposit only"),
            (DepositHandling.FULL, "Charge full deposit"),
        ],
        default=DepositHandling.CARRY_FORWARD,
    )
    additional_deposit_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, default=0)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        tenant = self.context["tenant"]
        user = self.context["request"].user
        new_unit = attrs["new_unit"]
        active_lease = tenant.leases.filter(status="active").select_related("unit", "unit__property").first()

        if not active_lease:
            raise serializers.ValidationError({"tenant": "This tenant does not have an active lease to transfer."})
        if active_lease.unit_id == new_unit.id:
            raise serializers.ValidationError({"new_unit": "Choose a different unit for the transfer."})
        if new_unit.property.account_id != tenant.account_id:
            raise serializers.ValidationError({"new_unit": "New unit must belong to the same landlord account."})
        if new_unit.status != Unit.Status.VACANT:
            raise serializers.ValidationError({"new_unit": "New unit must be vacant before transfer."})
        if new_unit.leases.filter(status="active").exists():
            raise serializers.ValidationError({"new_unit": "New unit already has an active lease."})
        if attrs["transfer_date"] < active_lease.start_date:
            raise serializers.ValidationError({"transfer_date": "Transfer date cannot be before the current lease start date."})
        if user.is_caretaker:
            if not active_lease.unit.property.caretakers.filter(id=user.id).exists():
                raise serializers.ValidationError({"tenant": "You can only transfer tenants from your assigned property."})
            if not new_unit.property.caretakers.filter(id=user.id).exists():
                raise serializers.ValidationError({"new_unit": "You can only transfer tenants to your assigned property."})

        attrs["active_lease"] = active_lease
        return attrs
