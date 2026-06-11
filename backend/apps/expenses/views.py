from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from apps.expenses.models import Expense
from apps.expenses.serializers import ExpenseSerializer


class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related("property", "unit", "recorded_by").all()
    serializer_class = ExpenseSerializer
    filterset_fields = ["property", "unit", "category", "expense_date", "recorded_by"]
    search_fields = ["property__name", "unit__unit_number", "description"]
    ordering_fields = ["expense_date", "amount", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        return queryset.none()

    def perform_create(self, serializer):
        property_obj = serializer.validated_data["property"]
        user = self.request.user
        if not (user.is_admin or user.is_landlord):
            raise PermissionDenied("Only landlords can record expenses.")
        if user.is_landlord and property_obj.account_id != user.account_id:
            raise PermissionDenied("You can only record expenses for your own account.")
        serializer.save(account=property_obj.account, recorded_by=self.request.user)
