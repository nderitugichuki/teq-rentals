from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Notification(TimeStampedModel):
    class Type(models.TextChoices):
        PAYMENT_RECEIVED = "payment_received", "Payment Received"
        PAYMENT_PENDING = "payment_pending", "Payment Pending Verification"
        PAYMENT_REJECTED = "payment_rejected", "Payment Rejected"
        RENT_REMINDER = "rent_reminder", "Rent Reminder"
        ARREARS_NOTICE = "arrears_notice", "Arrears Notice"
        LEASE_EXPIRY = "lease_expiry", "Lease Expiry"
        MAINTENANCE_UPDATE = "maintenance_update", "Maintenance Update"
        TENANT_UPDATE = "tenant_update", "Tenant Update"

    account = models.ForeignKey("accounts.Account", on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    class Channel(models.TextChoices):
        IN_APP = "in_app", "In App"
        SMS = "sms", "SMS"
        EMAIL = "email", "Email"
        WHATSAPP = "whatsapp", "WhatsApp"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=64, choices=Type.choices)
    channel = models.CharField(max_length=32, choices=Channel.choices, default=Channel.IN_APP)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    is_read = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
