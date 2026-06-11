from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from apps.common.querysets import scope_lease_queryset
from apps.leases.models import Lease
from apps.leases.serializers import LeaseSerializer
from apps.notifications.models import Notification


class LeaseViewSet(viewsets.ModelViewSet):
    queryset = Lease.objects.select_related("tenant", "unit", "unit__property", "created_by").all()
    serializer_class = LeaseSerializer
    filterset_fields = ["tenant", "unit", "status", "start_date"]
    search_fields = ["tenant__first_name", "tenant__last_name", "unit__unit_number", "unit__property__name"]
    ordering_fields = ["start_date", "end_date", "created_at"]

    def get_queryset(self):
        return scope_lease_queryset(super().get_queryset(), self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        unit = serializer.validated_data["unit"]
        if user.is_landlord and unit.property.account_id != user.account_id:
            raise PermissionDenied("You can only assign tenants to your own units.")
        if user.is_caretaker and not unit.property.caretakers.filter(id=user.id).exists():
            raise PermissionDenied("You can only assign tenants to units in your assigned properties.")
        if user.is_caretaker:
            lease = serializer.save(
                account=unit.property.account,
                created_by=self.request.user,
                rent_amount=unit.rent_amount,
                deposit_amount=unit.deposit_amount,
                deposit_required=True,
                end_date=None,
                expected_move_out_date=None,
            )
            self._notify_unit_occupied(lease)
            return
        lease = serializer.save(account=unit.property.account, created_by=self.request.user, deposit_required=True)
        self._notify_unit_occupied(lease)

    def _notify_unit_occupied(self, lease):
        if lease.status != Lease.Status.ACTIVE or not lease.account_id:
            return
        Notification.objects.create(
            account=lease.account,
            user=lease.account.owner,
            tenant=lease.tenant,
            title="Unit occupied",
            message=f"{lease.tenant} has been assigned to {lease.unit}. The unit is now occupied.",
            notification_type=Notification.Type.TENANT_UPDATE,
        )
