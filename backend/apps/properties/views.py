from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import AuditLog
from apps.common.querysets import scope_property_queryset, scope_unit_queryset
from apps.properties.models import Property, Unit
from apps.properties.serializers import PropertySerializer, UnitSerializer


class PropertyViewSet(viewsets.ModelViewSet):
    queryset = Property.objects.select_related("landlord").all()
    serializer_class = PropertySerializer
    filterset_fields = ["landlord", "property_type", "county", "town"]
    search_fields = ["name", "address", "county", "town"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        return scope_property_queryset(super().get_queryset(), self.request.user)

    def _ensure_property_manager(self, property_obj=None):
        user = self.request.user
        if user.is_admin:
            return
        if user.is_landlord and (property_obj is None or property_obj.landlord_id == user.id):
            return
        raise PermissionDenied("Only the property landlord or admin can manage this property.")

    def _enforce_single_property_per_caretaker(self, property_obj):
        caretakers = list(property_obj.caretakers.all())
        if not caretakers:
            return
        for caretaker in caretakers:
            other_properties = Property.objects.filter(account=property_obj.account, caretakers=caretaker).exclude(pk=property_obj.pk)
            for other_property in other_properties:
                other_property.caretakers.remove(caretaker)

    def perform_create(self, serializer):
        self._ensure_property_manager()
        if self.request.user.is_landlord:
            property_obj = serializer.save(landlord=self.request.user, account=self.request.user.account)
        else:
            property_obj = serializer.save()
        self._enforce_single_property_per_caretaker(property_obj)
        AuditLog.objects.create(
            account=property_obj.account,
            actor=self.request.user,
            action="property_created",
            entity_type="Property",
            entity_id=str(property_obj.id),
            summary=f"{self.request.user.email} created property {property_obj.name}.",
        )

    def perform_update(self, serializer):
        self._ensure_property_manager(serializer.instance)
        if self.request.user.is_landlord:
            property_obj = serializer.save(landlord=self.request.user, account=self.request.user.account)
        else:
            property_obj = serializer.save()
        self._enforce_single_property_per_caretaker(property_obj)
        AuditLog.objects.create(
            account=property_obj.account,
            actor=self.request.user,
            action="property_updated",
            entity_type="Property",
            entity_id=str(property_obj.id),
            summary=f"{self.request.user.email} updated property {property_obj.name}.",
        )

    def perform_destroy(self, instance):
        self._ensure_property_manager(instance)
        instance.delete()


class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.select_related("property", "property__landlord").all()
    serializer_class = UnitSerializer
    filterset_fields = ["property", "unit_type", "status"]
    search_fields = ["unit_number", "property__name"]
    ordering_fields = ["unit_number", "rent_amount", "created_at"]

    def get_queryset(self):
        return scope_unit_queryset(super().get_queryset(), self.request.user)

    def _ensure_unit_manager(self):
        user = self.request.user
        if not (user.is_admin or user.is_landlord):
            raise PermissionDenied("Only admins and landlords can manage units.")

    def perform_create(self, serializer):
        self._ensure_unit_manager()
        user = self.request.user
        property_obj = serializer.validated_data["property"]
        if user.is_landlord and property_obj.account_id != user.account_id:
            raise PermissionDenied("You can only create units for your own account.")
        serializer.save()

    def perform_update(self, serializer):
        self._ensure_unit_manager()
        user = self.request.user
        property_obj = serializer.validated_data.get("property", serializer.instance.property)
        if user.is_landlord and property_obj.account_id != user.account_id:
            raise PermissionDenied("You can only move units within your own account.")
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_unit_manager()
        instance.delete()
