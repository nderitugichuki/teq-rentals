from rest_framework import serializers

from apps.payments.models import CashCollection, Payment, PaymentClaim, RentCharge, UtilityCharge


class RentChargeSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    unit_label = serializers.SerializerMethodField()

    class Meta:
        model = RentCharge
        fields = [
            "id",
            "account",
            "lease",
            "tenant",
            "tenant_name",
            "unit",
            "unit_label",
            "property",
            "billing_month",
            "amount",
            "late_fee_amount",
            "amount_paid",
            "balance",
            "due_date",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account", "tenant_name", "unit_label", "balance", "status", "created_at", "updated_at"]

    def get_tenant_name(self, obj):
        return str(obj.tenant)

    def get_unit_label(self, obj):
        return str(obj.unit)


class PaymentSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "account",
            "tenant",
            "tenant_name",
            "lease",
            "rent_charge",
            "amount",
            "payment_method",
            "reference_number",
            "receipt_number",
            "mpesa_phone_number",
            "bank_name",
            "payment_date",
            "received_by",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account", "tenant_name", "received_by", "receipt_number", "created_at", "updated_at"]

    def get_tenant_name(self, obj):
        return str(obj.tenant)


class UtilityChargeSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    unit_label = serializers.SerializerMethodField()

    class Meta:
        model = UtilityCharge
        fields = [
            "id",
            "account",
            "tenant",
            "tenant_name",
            "lease",
            "unit",
            "unit_label",
            "property",
            "utility_type",
            "billing_month",
            "amount",
            "amount_paid",
            "balance",
            "due_date",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "account",
            "tenant",
            "tenant_name",
            "unit",
            "unit_label",
            "property",
            "balance",
            "status",
            "created_at",
            "updated_at",
        ]

    def get_tenant_name(self, obj):
        return str(obj.tenant)

    def get_unit_label(self, obj):
        return str(obj.unit)


class PaymentClaimSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    submitted_by_email = serializers.EmailField(source="submitted_by.email", read_only=True)
    verified_by_email = serializers.EmailField(source="verified_by.email", read_only=True)

    class Meta:
        model = PaymentClaim
        fields = [
            "id",
            "account",
            "tenant",
            "tenant_name",
            "lease",
            "rent_charge",
            "amount_claimed",
            "payment_method",
            "confirmation_code",
            "pasted_message",
            "phone_number",
            "bank_name",
            "claimed_payment_date",
            "submitted_by",
            "submitted_by_email",
            "status",
            "verification_notes",
            "verified_by",
            "verified_by_email",
            "verified_at",
            "verified_payment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "account",
            "tenant_name",
            "submitted_by",
            "submitted_by_email",
            "status",
            "verification_notes",
            "verified_by",
            "verified_by_email",
            "verified_at",
            "verified_payment",
            "created_at",
            "updated_at",
        ]

    def get_tenant_name(self, obj):
        return str(obj.tenant)


class CashCollectionSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    collected_by_email = serializers.EmailField(source="collected_by.email", read_only=True)
    confirmed_by_email = serializers.EmailField(source="confirmed_by.email", read_only=True)

    class Meta:
        model = CashCollection
        fields = [
            "id",
            "account",
            "tenant",
            "tenant_name",
            "lease",
            "rent_charge",
            "amount",
            "collection_date",
            "collected_by",
            "collected_by_email",
            "provisional_receipt_number",
            "status",
            "handed_over_to",
            "handover_date",
            "verification_notes",
            "confirmed_by",
            "confirmed_by_email",
            "confirmed_at",
            "confirmed_payment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "account",
            "tenant_name",
            "collected_by",
            "collected_by_email",
            "provisional_receipt_number",
            "status",
            "handed_over_to",
            "handover_date",
            "verification_notes",
            "confirmed_by",
            "confirmed_by_email",
            "confirmed_at",
            "confirmed_payment",
            "created_at",
            "updated_at",
        ]

    def get_tenant_name(self, obj):
        return str(obj.tenant)
