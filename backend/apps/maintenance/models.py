from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class MaintenanceRequest(TimeStampedModel):
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        AWAITING_APPROVAL = "awaiting_approval", "Awaiting Approval"
        APPROVED = "approved", "Approved"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="maintenance_requests")
    property = models.ForeignKey("properties.Property", on_delete=models.PROTECT, related_name="maintenance_requests")
    unit = models.ForeignKey("properties.Unit", on_delete=models.PROTECT, related_name="maintenance_requests")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.SET_NULL, null=True, blank=True, related_name="maintenance_requests")
    title = models.CharField(max_length=255)
    description = models.TextField()
    priority = models.CharField(max_length=32, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.OPEN)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_maintenance_requests",
    )
    reported_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reported_maintenance_requests")
    cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    approval_notes = models.TextField(blank=True)
    resolution_notes = models.TextField(blank=True)
    reported_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-reported_at", "-created_at"]

    def __str__(self):
        return f"{self.unit} - {self.title}"

    def clean(self):
        if self.unit and self.unit.property_id != self.property_id:
            raise ValidationError({"unit": "Unit must belong to the selected property."})
        if self.cost is not None and self.cost < 0:
            raise ValidationError({"cost": "Cost cannot be negative."})
        if self.status in [self.Status.RESOLVED, self.Status.CLOSED] and not self.resolved_at:
            self.resolved_at = timezone.now()

    def save(self, *args, **kwargs):
        if not self.account_id and self.property_id:
            self.account_id = self.property.account_id
        self.full_clean()
        super().save(*args, **kwargs)


class MaintenancePhoto(TimeStampedModel):
    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="maintenance_photos")
    maintenance_request = models.ForeignKey(MaintenanceRequest, on_delete=models.CASCADE, related_name="photos")
    image = models.FileField(upload_to="maintenance/photos/")
    caption = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="maintenance_photos")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.maintenance_request} photo"

    def save(self, *args, **kwargs):
        if not self.account_id and self.maintenance_request_id:
            self.account_id = self.maintenance_request.account_id
        super().save(*args, **kwargs)
