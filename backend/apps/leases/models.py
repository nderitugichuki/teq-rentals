from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.common.models import TimeStampedModel
from apps.properties.models import Unit


class Lease(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        NOTICE_GIVEN = "notice_given", "Notice Given"
        TERMINATED = "terminated", "Terminated"
        EXPIRED = "expired", "Expired"

    class LateFeeType(models.TextChoices):
        NONE = "none", "None"
        FIXED = "fixed", "Fixed Amount"
        PERCENTAGE = "percentage", "Percentage"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="leases")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.PROTECT, related_name="leases")
    unit = models.ForeignKey("properties.Unit", on_delete=models.PROTECT, related_name="leases")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    rent_amount = models.DecimalField(max_digits=12, decimal_places=2)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deposit_required = models.BooleanField(default=True)
    billing_day = models.PositiveSmallIntegerField(default=1)
    grace_period_days = models.PositiveSmallIntegerField(default=0)
    late_fee_type = models.CharField(max_length=32, choices=LateFeeType.choices, default=LateFeeType.NONE)
    late_fee_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notice_given_date = models.DateField(null=True, blank=True)
    expected_move_out_date = models.DateField(null=True, blank=True)
    renewed_from = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="renewals")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.ACTIVE)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_leases")

    class Meta:
        ordering = ["-start_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["unit"],
                condition=Q(status="active"),
                name="one_active_lease_per_unit",
            ),
            models.UniqueConstraint(
                fields=["tenant"],
                condition=Q(status="active"),
                name="one_active_lease_per_tenant",
            ),
        ]

    def __str__(self):
        return f"{self.tenant} - {self.unit}"

    @property
    def move_in_total(self):
        if not self.deposit_required:
            return self.rent_amount
        return self.rent_amount + self.deposit_amount

    def clean(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date cannot be earlier than start date."})
        if not 1 <= self.billing_day <= 28:
            raise ValidationError({"billing_day": "Billing day must be between 1 and 28."})
        active_leases = Lease.objects.filter(status=self.Status.ACTIVE).exclude(pk=self.pk)
        if self.tenant_id and self.unit_id and self.tenant.account_id != self.unit.property.account_id:
            raise ValidationError({"tenant": "Tenant must belong to the same landlord account as the unit."})
        if self.status == self.Status.ACTIVE and self.tenant_id and active_leases.filter(tenant_id=self.tenant_id).exists():
            raise ValidationError({"tenant": "This tenant already has an active lease."})
        if self.status == self.Status.ACTIVE and self.unit_id and active_leases.filter(unit_id=self.unit_id).exists():
            raise ValidationError({"unit": "This unit already has an active lease."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        if self.status == self.Status.ACTIVE and self.unit.status != Unit.Status.OCCUPIED:
            self.unit.status = Unit.Status.OCCUPIED
            self.unit.save(update_fields=["status", "updated_at"])
        if self.status == self.Status.ACTIVE:
            from apps.payments.services import generate_initial_rent_charge_for_lease

            generate_initial_rent_charge_for_lease(self)
        elif not self.unit.leases.filter(status=self.Status.ACTIVE).exclude(pk=self.pk).exists():
            self.unit.status = Unit.Status.VACANT
            self.unit.save(update_fields=["status", "updated_at"])
