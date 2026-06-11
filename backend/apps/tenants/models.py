from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Tenant(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        NOTICE_GIVEN = "notice_given", "Notice Given"
        VACATED = "vacated", "Vacated"

    class DepositRefundStatus(models.TextChoices):
        NOT_APPLICABLE = "not_applicable", "Not Applicable"
        PENDING = "pending", "Pending"
        PARTIAL = "partial", "Partial Refund"
        REFUNDED = "refunded", "Refunded"
        WITHHELD = "withheld", "Withheld"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="tenants")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_tenants",
    )
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    phone_number = models.CharField(max_length=32)
    email = models.EmailField(blank=True)
    id_number = models.CharField(max_length=32, blank=True)
    kra_pin = models.CharField(max_length=32, blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)
    move_in_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.ACTIVE)
    move_out_date = models.DateField(null=True, blank=True)
    deposit_refund_status = models.CharField(
        max_length=32,
        choices=DepositRefundStatus.choices,
        default=DepositRefundStatus.NOT_APPLICABLE,
    )
    keys_returned = models.BooleanField(default=False)
    damages_checked = models.BooleanField(default=False)
    final_balance_confirmed = models.BooleanField(default=False)
    unit_ready_for_next_tenant = models.BooleanField(default=False)
    move_out_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["first_name", "last_name"]
        constraints = [
            models.UniqueConstraint(fields=["account", "phone_number"], name="unique_tenant_phone_per_account"),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class PromiseToPay(TimeStampedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        KEPT = "kept", "Kept"
        MISSED = "missed", "Missed"
        CANCELLED = "cancelled", "Cancelled"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="promises_to_pay")
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="promises_to_pay")
    rent_charge = models.ForeignKey("payments.RentCharge", on_delete=models.SET_NULL, null=True, blank=True, related_name="promises_to_pay")
    promised_amount = models.DecimalField(max_digits=12, decimal_places=2)
    promised_date = models.DateField()
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.OPEN)
    note = models.TextField(blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="recorded_promises_to_pay")

    class Meta:
        ordering = ["promised_date", "-created_at"]

    def __str__(self):
        return f"{self.tenant} promised {self.promised_amount} on {self.promised_date}"

    def save(self, *args, **kwargs):
        if not self.account_id and self.tenant_id:
            self.account_id = self.tenant.account_id
        super().save(*args, **kwargs)
