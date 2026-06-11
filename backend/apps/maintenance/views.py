from django.utils import timezone
from rest_framework import decorators, parsers, response, status, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.maintenance.models import MaintenancePhoto, MaintenanceRequest
from apps.maintenance.serializers import MaintenancePhotoSerializer, MaintenanceRequestSerializer
from apps.notifications.models import Notification


class MaintenanceRequestViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRequest.objects.select_related(
        "property",
        "unit",
        "tenant",
        "assigned_to",
        "reported_by",
    ).all()
    serializer_class = MaintenanceRequestSerializer
    filterset_fields = ["property", "unit", "tenant", "priority", "status", "assigned_to"]
    search_fields = ["title", "description", "property__name", "unit__unit_number", "tenant__first_name", "tenant__last_name"]
    ordering_fields = ["reported_at", "priority", "status", "cost", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        if user.is_caretaker:
            return queryset.filter(account=user.account, property__caretakers=user)
        return queryset.none()

    def perform_create(self, serializer):
        property_obj = serializer.validated_data["property"]
        unit = serializer.validated_data["unit"]
        tenant = serializer.validated_data.get("tenant")
        user = self.request.user
        if user.is_landlord and property_obj.account_id != user.account_id:
            raise PermissionDenied("You can only report maintenance for your own account.")
        if user.is_caretaker and not property_obj.caretakers.filter(id=user.id).exists():
            raise PermissionDenied("You can only report maintenance for assigned properties.")
        if unit.property_id != property_obj.id:
            raise PermissionDenied("Unit must belong to the selected property.")
        if tenant and tenant.account_id != property_obj.account_id:
            raise PermissionDenied("Tenant must belong to the selected property account.")
        maintenance_request = serializer.save(account=property_obj.account, reported_by=self.request.user)
        landlord = maintenance_request.account.owner if maintenance_request.account_id else maintenance_request.property.landlord
        if self.request.user.is_caretaker:
            Notification.objects.create(
                account=maintenance_request.account,
                user=landlord,
                tenant=maintenance_request.tenant,
                title="New maintenance issue",
                message=(
                    f"{self.request.user.email} reported {maintenance_request.title} for "
                    f"{maintenance_request.unit}. Review the issue and approve next steps if needed."
                ),
                notification_type=Notification.Type.MAINTENANCE_UPDATE,
                channel=Notification.Channel.IN_APP,
            )

    @decorators.action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        maintenance_request = self.get_object()
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords can assign maintenance work.")
        assigned_to = request.data.get("assigned_to")
        maintenance_request.assigned_to_id = assigned_to
        maintenance_request.status = MaintenanceRequest.Status.APPROVED
        maintenance_request.save(update_fields=["assigned_to", "status", "updated_at"])
        return response.Response(self.get_serializer(maintenance_request).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"])
    def escalate(self, request, pk=None):
        maintenance_request = self.get_object()
        maintenance_request.status = MaintenanceRequest.Status.AWAITING_APPROVAL
        maintenance_request.approval_notes = request.data.get("approval_notes", maintenance_request.approval_notes)
        maintenance_request.save(update_fields=["status", "approval_notes", "updated_at"])
        landlord = maintenance_request.account.owner if maintenance_request.account_id else maintenance_request.property.landlord
        Notification.objects.create(
            account=maintenance_request.account,
            user=landlord,
            tenant=maintenance_request.tenant,
            title="Maintenance approval needed",
            message=f"{maintenance_request.title} for {maintenance_request.unit} is awaiting your approval.",
            notification_type=Notification.Type.MAINTENANCE_UPDATE,
            channel=Notification.Channel.IN_APP,
        )
        return response.Response(self.get_serializer(maintenance_request).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords can approve maintenance work.")
        maintenance_request = self.get_object()
        maintenance_request.status = MaintenanceRequest.Status.APPROVED
        maintenance_request.approved_at = timezone.now()
        maintenance_request.approval_notes = request.data.get("approval_notes", maintenance_request.approval_notes)
        maintenance_request.save(update_fields=["status", "approved_at", "approval_notes", "updated_at"])
        if maintenance_request.reported_by_id:
            Notification.objects.create(
                account=maintenance_request.account,
                user=maintenance_request.reported_by,
                tenant=maintenance_request.tenant,
                title="Maintenance approved",
                message=f"{maintenance_request.title} for {maintenance_request.unit} has been approved by the landlord.",
                notification_type=Notification.Type.MAINTENANCE_UPDATE,
                channel=Notification.Channel.IN_APP,
            )
        return response.Response(self.get_serializer(maintenance_request).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords can reject maintenance work.")
        maintenance_request = self.get_object()
        maintenance_request.status = MaintenanceRequest.Status.CLOSED
        maintenance_request.approval_notes = request.data.get("approval_notes", "Rejected")
        maintenance_request.save(update_fields=["status", "approval_notes", "updated_at"])
        if maintenance_request.reported_by_id:
            Notification.objects.create(
                account=maintenance_request.account,
                user=maintenance_request.reported_by,
                tenant=maintenance_request.tenant,
                title="Maintenance rejected",
                message=f"{maintenance_request.title} for {maintenance_request.unit} was rejected. {maintenance_request.approval_notes}",
                notification_type=Notification.Type.MAINTENANCE_UPDATE,
                channel=Notification.Channel.IN_APP,
            )
        return response.Response(self.get_serializer(maintenance_request).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        maintenance_request = self.get_object()
        if maintenance_request.status != MaintenanceRequest.Status.APPROVED:
            raise PermissionDenied("Only approved maintenance requests can be started.")
        maintenance_request.status = MaintenanceRequest.Status.IN_PROGRESS
        maintenance_request.save(update_fields=["status", "updated_at"])
        return response.Response(self.get_serializer(maintenance_request).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        maintenance_request = self.get_object()
        maintenance_request.status = MaintenanceRequest.Status.RESOLVED
        maintenance_request.resolution_notes = request.data.get("resolution_notes", maintenance_request.resolution_notes)
        maintenance_request.resolved_at = timezone.now()
        maintenance_request.save(update_fields=["status", "resolution_notes", "resolved_at", "updated_at"])
        landlord = maintenance_request.account.owner if maintenance_request.account_id else maintenance_request.property.landlord
        Notification.objects.create(
            account=maintenance_request.account,
            user=landlord,
            tenant=maintenance_request.tenant,
            title="Maintenance issue resolved",
            message=(
                f"{maintenance_request.title} for {maintenance_request.unit} has been marked resolved by "
                f"{request.user.email}. Review and close it if satisfied."
            ),
            notification_type=Notification.Type.MAINTENANCE_UPDATE,
            channel=Notification.Channel.IN_APP,
        )
        return response.Response(self.get_serializer(maintenance_request).data, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        if not (request.user.is_admin or request.user.is_landlord):
            raise PermissionDenied("Only landlords can close maintenance requests.")
        maintenance_request = self.get_object()
        maintenance_request.status = MaintenanceRequest.Status.CLOSED
        maintenance_request.save(update_fields=["status", "updated_at"])
        if maintenance_request.reported_by_id:
            Notification.objects.create(
                account=maintenance_request.account,
                user=maintenance_request.reported_by,
                tenant=maintenance_request.tenant,
                title="Maintenance closed",
                message=f"{maintenance_request.title} for {maintenance_request.unit} has been closed by the landlord.",
                notification_type=Notification.Type.MAINTENANCE_UPDATE,
                channel=Notification.Channel.IN_APP,
            )
        return response.Response(self.get_serializer(maintenance_request).data, status=status.HTTP_200_OK)


class MaintenancePhotoViewSet(viewsets.ModelViewSet):
    queryset = MaintenancePhoto.objects.select_related("maintenance_request", "uploaded_by").all()
    serializer_class = MaintenancePhotoSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]
    filterset_fields = ["maintenance_request"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        if user.is_caretaker:
            return queryset.filter(account=user.account, maintenance_request__property__caretakers=user)
        return queryset.none()

    def perform_create(self, serializer):
        maintenance_request = serializer.validated_data["maintenance_request"]
        user = self.request.user
        if user.is_caretaker and not maintenance_request.property.caretakers.filter(id=user.id).exists():
            raise PermissionDenied("You can only upload photos for assigned properties.")
        if not user.is_admin and maintenance_request.account_id != user.account_id:
            raise PermissionDenied("You can only upload photos within your account.")
        serializer.save(account=maintenance_request.account, uploaded_by=user)
