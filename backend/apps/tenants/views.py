from django.utils import timezone
from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.querysets import scope_tenant_queryset
from apps.leases.models import Lease
from apps.leases.serializers import LeaseSerializer
from apps.notifications.models import Notification
from apps.tenants.models import PromiseToPay, Tenant
from apps.tenants.serializers import PromiseToPaySerializer, TenantSerializer, TenantTransferSerializer


class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    search_fields = ["first_name", "last_name", "phone_number", "email", "id_number"]
    ordering_fields = ["first_name", "last_name", "created_at"]

    def get_queryset(self):
        return scope_tenant_queryset(super().get_queryset(), self.request.user)

    def perform_create(self, serializer):
        serializer.save(account=self.request.user.account, created_by=self.request.user)

    def perform_update(self, serializer):
        previous_status = serializer.instance.status
        tenant = serializer.save()
        active_leases = tenant.leases.filter(status__in=[Lease.Status.ACTIVE, Lease.Status.NOTICE_GIVEN])

        if tenant.status == Tenant.Status.NOTICE_GIVEN:
            for lease in active_leases:
                lease.status = Lease.Status.NOTICE_GIVEN
                lease.notice_given_date = lease.notice_given_date or timezone.localdate()
                lease.expected_move_out_date = tenant.move_out_date or lease.expected_move_out_date
                lease.save(update_fields=["status", "notice_given_date", "expected_move_out_date", "updated_at"])

        if tenant.status == Tenant.Status.VACATED:
            unit_labels = ", ".join(str(lease.unit) for lease in active_leases)
            for lease in active_leases:
                lease.status = Lease.Status.TERMINATED
                lease.end_date = tenant.move_out_date or timezone.localdate()
                lease.save(update_fields=["status", "end_date", "updated_at"])
            if previous_status != Tenant.Status.VACATED and tenant.account_id:
                unit_text = f" Unit now vacant: {unit_labels}." if unit_labels else ""
                Notification.objects.create(
                    account=tenant.account,
                    user=tenant.account.owner,
                    tenant=tenant,
                    title="Tenant vacated",
                    message=f"{tenant} has been marked as vacated.{unit_text}",
                    notification_type=Notification.Type.TENANT_UPDATE,
                )

    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        tenant = self.get_object()
        serializer = TenantTransferSerializer(data=request.data, context={"request": request, "tenant": tenant})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        old_lease = data["active_lease"]
        new_unit = data["new_unit"]
        transfer_date = data["transfer_date"]
        deposit_handling = data["deposit_handling"]
        additional_deposit_amount = data["additional_deposit_amount"]

        if deposit_handling == TenantTransferSerializer.DepositHandling.CARRY_FORWARD:
            deposit_required = False
            deposit_amount = new_unit.deposit_amount
        elif deposit_handling == TenantTransferSerializer.DepositHandling.ADDITIONAL:
            deposit_required = additional_deposit_amount > 0
            deposit_amount = additional_deposit_amount
        else:
            deposit_required = True
            deposit_amount = new_unit.deposit_amount

        with transaction.atomic():
            old_unit = old_lease.unit
            old_lease.status = Lease.Status.TERMINATED
            old_lease.end_date = transfer_date
            old_lease.save(update_fields=["status", "end_date", "updated_at"])

            new_lease = Lease.objects.create(
                account=tenant.account,
                tenant=tenant,
                unit=new_unit,
                start_date=transfer_date,
                rent_amount=new_unit.rent_amount,
                deposit_amount=deposit_amount,
                deposit_required=deposit_required,
                billing_day=old_lease.billing_day,
                grace_period_days=old_lease.grace_period_days,
                late_fee_type=old_lease.late_fee_type,
                late_fee_value=old_lease.late_fee_value,
                status=Lease.Status.ACTIVE,
                created_by=request.user,
            )

            if tenant.status != Tenant.Status.ACTIVE:
                tenant.status = Tenant.Status.ACTIVE
                tenant.move_out_date = None
                tenant.save(update_fields=["status", "move_out_date", "updated_at"])

            owner = tenant.account.owner if tenant.account_id else old_lease.unit.property.landlord
            Notification.objects.create(
                account=tenant.account,
                user=owner,
                tenant=tenant,
                title="Tenant transferred",
                message=f"{tenant} was transferred from {old_unit} to {new_unit}.",
                notification_type=Notification.Type.TENANT_UPDATE,
            )

        return Response(LeaseSerializer(new_lease, context={"request": request}).data, status=status.HTTP_201_CREATED)


class PromiseToPayViewSet(viewsets.ModelViewSet):
    queryset = PromiseToPay.objects.select_related("tenant", "rent_charge", "rent_charge__unit", "recorded_by").all()
    serializer_class = PromiseToPaySerializer
    filterset_fields = ["tenant", "rent_charge", "status", "promised_date"]
    search_fields = ["tenant__first_name", "tenant__last_name", "tenant__phone_number", "note"]
    ordering_fields = ["promised_date", "promised_amount", "created_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        if user.is_caretaker:
            return queryset.filter(account=user.account, tenant__leases__unit__property__caretakers=user).distinct()
        return queryset.none()

    def perform_create(self, serializer):
        tenant = serializer.validated_data["tenant"]
        user = self.request.user
        if user.is_caretaker and not tenant.leases.filter(unit__property__caretakers=user).exists():
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only record promises for tenants in assigned properties.")
        if not user.is_admin and tenant.account_id != user.account_id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You can only record promises within your account.")
        serializer.save(account=tenant.account, recorded_by=user)
