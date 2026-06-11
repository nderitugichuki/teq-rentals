from django.contrib.auth import get_user_model
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import RetrieveAPIView

from apps.accounts.models import Account, AuditLog, Role
from apps.accounts.serializers import AccountSerializer, AuditLogSerializer, RoleSerializer, UserSerializer

User = get_user_model()


class CurrentUserView(RetrieveAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAdminUser]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]


class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.select_related("owner").all()
    serializer_class = AccountSerializer
    search_fields = ["name", "owner__email"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(id=user.account_id)
        return queryset.none()

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def perform_update(self, serializer):
        user = self.request.user
        account = serializer.instance
        if not user.is_admin and account.id != user.account_id:
            raise PermissionDenied("You can only update your own account settings.")
        updated = serializer.save()
        AuditLog.objects.create(
            account=updated,
            actor=user,
            action="account_settings_updated",
            entity_type="Account",
            entity_id=str(updated.id),
            summary=f"{user.email} updated account feature settings.",
        )


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("account", "actor").all()
    serializer_class = AuditLogSerializer
    search_fields = ["action", "entity_type", "summary", "actor__email"]
    ordering_fields = ["created_at", "action", "entity_type"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account)
        return queryset.none()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("role").all()
    serializer_class = UserSerializer
    search_fields = ["email", "first_name", "last_name", "phone_number"]
    ordering_fields = ["email", "date_joined"]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account, role__name=Role.Names.CARETAKER)
        return queryset.none()

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    def _caretaker_role(self):
        return Role.objects.get(name=Role.Names.CARETAKER)

    def _ensure_staff_manager(self, instance=None):
        user = self.request.user
        if user.is_admin:
            return
        if user.is_landlord:
            if instance and (instance.account_id != user.account_id or instance.role_name != Role.Names.CARETAKER):
                raise PermissionDenied("You can only manage caretakers in your own account.")
            return
        raise PermissionDenied("You cannot manage staff users.")

    def perform_create(self, serializer):
        self._ensure_staff_manager()
        user = self.request.user
        if user.is_admin:
            created_user = serializer.save()
        else:
            created_user = serializer.save(account=user.account, role=self._caretaker_role())
        AuditLog.objects.create(
            account=created_user.account,
            actor=user,
            action="caretaker_created",
            entity_type="User",
            entity_id=str(created_user.id),
            summary=f"{user.email} created caretaker account {created_user.email}.",
        )

    def perform_update(self, serializer):
        self._ensure_staff_manager(serializer.instance)
        user = self.request.user
        if user.is_admin:
            updated_user = serializer.save()
        else:
            updated_user = serializer.save(account=user.account, role=self._caretaker_role(), is_staff=False, is_superuser=False)
        AuditLog.objects.create(
            account=updated_user.account,
            actor=user,
            action="caretaker_updated",
            entity_type="User",
            entity_id=str(updated_user.id),
            summary=f"{user.email} updated caretaker account {updated_user.email}.",
        )

    def perform_destroy(self, instance):
        self._ensure_staff_manager(instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        AuditLog.objects.create(
            account=instance.account,
            actor=self.request.user,
            action="caretaker_access_blocked",
            entity_type="User",
            entity_id=str(instance.id),
            summary=f"{self.request.user.email} blocked access for caretaker {instance.email}.",
        )
