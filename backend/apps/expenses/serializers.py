from rest_framework import serializers

from apps.expenses.models import Expense


class ExpenseSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source="property.name", read_only=True)
    unit_label = serializers.SerializerMethodField()
    recorded_by_email = serializers.EmailField(source="recorded_by.email", read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "property",
            "property_name",
            "unit",
            "unit_label",
            "category",
            "amount",
            "expense_date",
            "description",
            "recorded_by",
            "recorded_by_email",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "property_name", "unit_label", "recorded_by", "recorded_by_email", "created_at", "updated_at"]

    def get_unit_label(self, obj):
        return str(obj.unit) if obj.unit else ""

