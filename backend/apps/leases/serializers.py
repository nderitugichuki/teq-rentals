from rest_framework import serializers

from apps.leases.models import Lease


class LeaseSerializer(serializers.ModelSerializer):
    tenant_name = serializers.SerializerMethodField()
    unit_label = serializers.SerializerMethodField()
    move_in_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Lease
        fields = [
            "id",
            "account",
            "tenant",
            "tenant_name",
            "unit",
            "unit_label",
            "start_date",
            "end_date",
            "rent_amount",
            "deposit_amount",
            "deposit_required",
            "move_in_total",
            "billing_day",
            "grace_period_days",
            "late_fee_type",
            "late_fee_value",
            "notice_given_date",
            "expected_move_out_date",
            "renewed_from",
            "status",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "account", "tenant_name", "unit_label", "created_by", "created_at", "updated_at"]

    def get_tenant_name(self, obj):
        return str(obj.tenant)

    def get_unit_label(self, obj):
        return str(obj.unit)
