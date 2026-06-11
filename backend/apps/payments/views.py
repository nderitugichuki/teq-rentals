from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from django.db.models import Sum
from rest_framework import decorators, permissions, response, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.common.permissions import IsAdminLandlordOrReadOnly
from apps.common.querysets import scope_financial_queryset
from apps.notifications.models import Notification
from apps.payments.models import CashCollection, Payment, PaymentClaim, RentCharge, UtilityCharge
from apps.payments.serializers import (
    CashCollectionSerializer,
    PaymentClaimSerializer,
    PaymentSerializer,
    RentChargeSerializer,
    UtilityChargeSerializer,
)
from apps.payments.services import generate_rent_charges_for_month


class RentChargeViewSet(viewsets.ModelViewSet):
    queryset = RentCharge.objects.select_related("lease", "tenant", "unit", "property").all()
    serializer_class = RentChargeSerializer
    filterset_fields = ["lease", "tenant", "unit", "property", "billing_month", "status"]
    search_fields = ["tenant__first_name", "tenant__last_name", "unit__unit_number", "property__name"]
    ordering_fields = ["billing_month", "due_date", "amount", "balance", "created_at"]
    permission_classes = [IsAdminLandlordOrReadOnly]

    def get_queryset(self):
        return scope_financial_queryset(super().get_queryset(), self.request.user)

    def perform_create(self, serializer):
        lease = serializer.validated_data["lease"]
        user = self.request.user
        if user.is_landlord and lease.account_id != user.account_id:
            raise PermissionDenied("You can only create rent charges for your own account.")
        serializer.save(account=lease.account, tenant=lease.tenant, unit=lease.unit, property=lease.unit.property)

    @decorators.action(detail=False, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def generate_current_month(self, request):
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords can generate rent charges.")
        created = generate_rent_charges_for_month(timezone.localdate())
        if not request.user.is_admin:
            created = [charge for charge in created if charge.account_id == request.user.account_id]
        return response.Response({"created": len(created)}, status=status.HTTP_201_CREATED)


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related("tenant", "lease", "rent_charge", "received_by").all()
    serializer_class = PaymentSerializer
    filterset_fields = ["tenant", "lease", "rent_charge", "payment_method", "payment_date"]
    search_fields = ["tenant__first_name", "tenant__last_name", "reference_number"]
    ordering_fields = ["payment_date", "amount", "created_at"]
    permission_classes = [IsAdminLandlordOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        if user.is_caretaker:
            return queryset.none()
        return queryset.none()

    def perform_create(self, serializer):
        lease = serializer.validated_data["lease"]
        user = self.request.user
        if user.is_landlord and lease.account_id != user.account_id:
            raise PermissionDenied("You can only record payments for your own account.")
        try:
            payment = serializer.save(account=lease.account, tenant=lease.tenant, received_by=self.request.user)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        Notification.objects.create(
            account=payment.account,
            user=payment.account.owner if payment.account_id else None,
            tenant=payment.tenant,
            title="Payment received",
            message=f"Payment of Ksh {payment.amount} has been recorded for {payment.tenant}. Reference: {payment.reference_number or payment.id}.",
            notification_type=Notification.Type.PAYMENT_RECEIVED,
            channel=Notification.Channel.IN_APP,
        )


class UtilityChargeViewSet(viewsets.ModelViewSet):
    queryset = UtilityCharge.objects.select_related("tenant", "lease", "unit", "property").all()
    serializer_class = UtilityChargeSerializer
    filterset_fields = ["tenant", "lease", "unit", "property", "utility_type", "billing_month", "status"]
    search_fields = ["tenant__first_name", "tenant__last_name", "unit__unit_number", "property__name"]
    ordering_fields = ["billing_month", "due_date", "amount", "balance", "created_at"]
    permission_classes = [IsAdminLandlordOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        if user.is_caretaker:
            return queryset.none()
        return queryset.none()

    def perform_create(self, serializer):
        lease = serializer.validated_data["lease"]
        user = self.request.user
        if not (user.is_admin or user.is_landlord):
            raise PermissionDenied("Only landlords can create utility charges.")
        if not user.is_admin and lease.account_id != user.account_id:
            raise PermissionDenied("You can only create utility charges for your own account.")
        serializer.save(account=lease.account, tenant=lease.tenant, unit=lease.unit, property=lease.unit.property)


class PaymentClaimViewSet(viewsets.ModelViewSet):
    queryset = PaymentClaim.objects.select_related(
        "tenant",
        "lease",
        "rent_charge",
        "submitted_by",
        "verified_by",
        "verified_payment",
    ).all()
    serializer_class = PaymentClaimSerializer
    filterset_fields = ["tenant", "lease", "rent_charge", "payment_method", "status"]
    search_fields = ["tenant__first_name", "tenant__last_name", "confirmation_code"]
    ordering_fields = ["claimed_payment_date", "amount_claimed", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        if user.is_caretaker:
            return queryset.filter(account=user.account, lease__unit__property__caretakers=user, submitted_by=user)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_admin or user.is_landlord or user.is_caretaker):
            raise PermissionDenied("You cannot submit payment claims.")
        lease = serializer.validated_data["lease"]
        if user.is_caretaker and not lease.unit.property.caretakers.filter(id=user.id).exists():
            raise PermissionDenied("You can only submit claims for assigned properties.")
        if user.is_landlord and lease.account_id != user.account_id:
            raise PermissionDenied("You can only submit claims for your own account.")
        claim = serializer.save(account=lease.account, submitted_by=user)
        Notification.objects.create(
            account=claim.account,
            user=claim.account.owner,
            tenant=claim.tenant,
            title="Payment claim needs verification",
            message=(
                f"{claim.submitted_by.email} submitted a {claim.get_payment_method_display()} claim of Ksh {claim.amount_claimed} "
                f"for {claim.tenant} with reference {claim.confirmation_code}. Verify or reject it."
            ),
            notification_type=Notification.Type.PAYMENT_PENDING,
            channel=Notification.Channel.IN_APP,
        )

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def verify(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords and admins can verify payment claims.")
        claim = self.get_object()
        notes = request.data.get("verification_notes", "")
        try:
            payment = claim.verify(verified_by=request.user, notes=notes)
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages if hasattr(exc, "messages") else str(exc)) from exc
        Notification.objects.create(
            account=claim.account,
            user=claim.submitted_by,
            tenant=claim.tenant,
            title="Payment confirmed",
            message=f"Your payment claim for {claim.tenant} was verified. Amount: Ksh {payment.amount}. Reference: {payment.reference_number}.",
            notification_type=Notification.Type.PAYMENT_RECEIVED,
            channel=Notification.Channel.IN_APP,
        )
        return response.Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords and admins can reject payment claims.")
        notes = request.data.get("verification_notes", "")
        if not notes:
            raise ValidationError({"verification_notes": "Rejection notes are required."})
        claim = self.get_object()
        try:
            claim.reject(rejected_by=request.user, notes=notes)
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages if hasattr(exc, "messages") else str(exc)) from exc
        Notification.objects.create(
            account=claim.account,
            user=claim.submitted_by,
            tenant=claim.tenant,
            title="Payment claim rejected",
            message=f"Your payment claim for {claim.tenant} was rejected. Reference: {claim.confirmation_code}. {notes}",
            notification_type=Notification.Type.PAYMENT_REJECTED,
            channel=Notification.Channel.IN_APP,
        )
        return response.Response(self.get_serializer(claim).data, status=status.HTTP_200_OK)


class CashCollectionViewSet(viewsets.ModelViewSet):
    queryset = CashCollection.objects.select_related(
        "tenant",
        "lease",
        "rent_charge",
        "collected_by",
        "handed_over_to",
        "confirmed_by",
        "confirmed_payment",
    ).all()
    serializer_class = CashCollectionSerializer
    filterset_fields = ["tenant", "lease", "rent_charge", "status", "collection_date"]
    search_fields = ["tenant__first_name", "tenant__last_name", "provisional_receipt_number"]
    ordering_fields = ["collection_date", "amount", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        if user.is_caretaker:
            return queryset.filter(account=user.account, lease__unit__property__caretakers=user, collected_by=user)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_admin or user.is_landlord or user.is_caretaker):
            raise PermissionDenied("You cannot record cash collections.")
        lease = serializer.validated_data["lease"]
        if user.is_caretaker and not lease.unit.property.caretakers.filter(id=user.id).exists():
            raise PermissionDenied("You can only record cash for assigned properties.")
        if user.is_landlord and lease.account_id != user.account_id:
            raise PermissionDenied("You can only record cash for your own account.")
        collection = serializer.save(account=lease.account, collected_by=user)
        Notification.objects.create(
            account=collection.account,
            user=collection.account.owner,
            tenant=collection.tenant,
            title="Cash collection needs confirmation",
            message=(
                f"{collection.collected_by.email} recorded cash of Ksh {collection.amount} for {collection.tenant}. "
                f"Provisional receipt: {collection.provisional_receipt_number}. Confirm or reject it."
            ),
            notification_type=Notification.Type.PAYMENT_PENDING,
            channel=Notification.Channel.IN_APP,
        )

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def handover(self, request, pk=None):
        collection = self.get_object()
        if not (request.user.is_admin or request.user.is_landlord or collection.collected_by_id == request.user.id):
            raise PermissionDenied("You cannot mark this cash collection as handed over.")
        handed_over_to_id = request.data.get("handed_over_to")
        if not handed_over_to_id:
            raise ValidationError({"handed_over_to": "This field is required."})
        notes = request.data.get("verification_notes", "")
        try:
            collection.mark_handed_over(handed_over_to_id, notes=notes)
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages if hasattr(exc, "messages") else str(exc)) from exc
        return response.Response(self.get_serializer(collection).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def confirm(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords and admins can confirm cash collections.")
        collection = self.get_object()
        notes = request.data.get("verification_notes", "")
        try:
            payment = collection.confirm(confirmed_by=request.user, notes=notes)
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages if hasattr(exc, "messages") else str(exc)) from exc
        Notification.objects.create(
            account=collection.account,
            user=collection.collected_by,
            tenant=collection.tenant,
            title="Cash payment confirmed",
            message=f"Your cash collection for {collection.tenant} was confirmed. Amount: Ksh {payment.amount}. Receipt reference {payment.reference_number}.",
            notification_type=Notification.Type.PAYMENT_RECEIVED,
            channel=Notification.Channel.IN_APP,
        )
        return response.Response(PaymentSerializer(payment).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords and admins can reject cash collections.")
        notes = request.data.get("verification_notes", "")
        if not notes:
            raise ValidationError({"verification_notes": "Rejection notes are required."})
        collection = self.get_object()
        try:
            collection.reject(rejected_by=request.user, notes=notes)
        except DjangoValidationError as exc:
            raise ValidationError(exc.messages if hasattr(exc, "messages") else str(exc)) from exc
        Notification.objects.create(
            account=collection.account,
            user=collection.collected_by,
            tenant=collection.tenant,
            title="Cash payment rejected",
            message=f"Your cash collection for {collection.tenant} was rejected. Reference: {collection.provisional_receipt_number}. {notes}",
            notification_type=Notification.Type.PAYMENT_REJECTED,
            channel=Notification.Channel.IN_APP,
        )
        return response.Response(self.get_serializer(collection).data, status=status.HTTP_200_OK)


class ArrearsReportViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        if request.user.is_caretaker:
            raise PermissionDenied("Caretakers cannot access the financial arrears report.")
        queryset = RentCharge.objects.select_related("tenant", "unit", "property").filter(balance__gt=0)
        queryset = scope_financial_queryset(queryset, request.user)
        property_id = request.query_params.get("property")
        if property_id:
            queryset = queryset.filter(property_id=property_id)
        tenant_id = request.query_params.get("tenant")
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)

        charges = queryset.order_by("due_date")
        total_arrears = charges.aggregate(total=Sum("balance"))["total"] or 0
        data = [
            {
                "id": charge.id,
                "tenant_id": charge.tenant_id,
                "property": charge.property.name,
                "unit": charge.unit.unit_number,
                "tenant": str(charge.tenant),
                "amount": charge.amount,
                "amount_paid": charge.amount_paid,
                "balance": charge.balance,
                "due_date": charge.due_date,
                "status": charge.status,
            }
            for charge in charges
        ]
        return response.Response({"total_arrears": total_arrears, "results": data})
