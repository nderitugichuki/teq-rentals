from django.db.models import Q
from rest_framework import decorators, permissions, response, status, viewsets

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.select_related("user", "tenant").all()
    serializer_class = NotificationSerializer
    filterset_fields = ["notification_type", "channel", "status", "is_read"]
    search_fields = ["title", "message", "tenant__first_name", "tenant__last_name"]
    ordering_fields = ["created_at", "sent_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        if user.is_admin:
            return queryset
        if user.is_landlord:
            return queryset.filter(account=user.account).filter(Q(user=user) | Q(user__isnull=True))
        return queryset.filter(user=user)

    @decorators.action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        return response.Response(self.get_serializer(notification).data, status=status.HTTP_200_OK)
