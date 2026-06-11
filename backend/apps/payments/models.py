from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from apps.common.models import TimeStampedModel


class RentCharge(TimeStampedModel):
    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIAL = "partial", "Partial"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="rent_charges")
    lease = models.ForeignKey("leases.Lease", on_delete=models.PROTECT, related_name="rent_charges")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.PROTECT, related_name="rent_charges")
    unit = models.ForeignKey("properties.Unit", on_delete=models.PROTECT, related_name="rent_charges")
    property = models.ForeignKey("properties.Property", on_delete=models.PROTECT, related_name="rent_charges")
    billing_month = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    late_fee_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.UNPAID)

    class Meta:
        ordering = ["-billing_month", "tenant__first_name"]
        constraints = [
            models.UniqueConstraint(fields=["lease", "billing_month"], name="unique_charge_per_lease_month"),
        ]

    def __str__(self):
        return f"{self.tenant} - {self.billing_month:%Y-%m}"

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Rent charge amount must be greater than zero."})
        if self.amount_paid < 0:
            raise ValidationError({"amount_paid": "Amount paid cannot be negative."})
        if self.lease_id and self.tenant_id and self.lease.tenant_id != self.tenant_id:
            raise ValidationError({"tenant": "Tenant must match the selected lease."})
        if self.lease_id and self.unit_id and self.lease.unit_id != self.unit_id:
            raise ValidationError({"unit": "Unit must match the selected lease."})
        if self.unit_id and self.property_id and self.unit.property_id != self.property_id:
            raise ValidationError({"property": "Property must match the selected unit."})

    def save(self, *args, **kwargs):
        if not self.account_id and self.property_id:
            self.account_id = self.property.account_id
        self.balance = self.amount + self.late_fee_amount - self.amount_paid
        self.full_clean()
        if self.balance <= 0:
            self.status = self.Status.PAID
        elif self.amount_paid > 0:
            self.status = self.Status.PARTIAL
        elif self.due_date < timezone.localdate():
            self.status = self.Status.OVERDUE
        else:
            self.status = self.Status.UNPAID
        super().save(*args, **kwargs)


class UtilityCharge(TimeStampedModel):
    class UtilityType(models.TextChoices):
        WATER = "water", "Water"
        ELECTRICITY = "electricity", "Electricity"
        GARBAGE = "garbage", "Garbage"
        SECURITY = "security", "Security"
        SERVICE_CHARGE = "service_charge", "Service Charge"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIAL = "partial", "Partial"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="utility_charges")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.PROTECT, related_name="utility_charges")
    lease = models.ForeignKey("leases.Lease", on_delete=models.PROTECT, related_name="utility_charges")
    unit = models.ForeignKey("properties.Unit", on_delete=models.PROTECT, related_name="utility_charges")
    property = models.ForeignKey("properties.Property", on_delete=models.PROTECT, related_name="utility_charges")
    utility_type = models.CharField(max_length=32, choices=UtilityType.choices)
    billing_month = models.DateField()
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2)
    due_date = models.DateField()
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.UNPAID)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-billing_month", "utility_type"]

    def __str__(self):
        return f"{self.tenant} - {self.utility_type} - {self.billing_month:%Y-%m}"

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Utility charge amount must be greater than zero."})
        if self.amount_paid < 0:
            raise ValidationError({"amount_paid": "Amount paid cannot be negative."})
        if self.lease_id and self.tenant_id and self.lease.tenant_id != self.tenant_id:
            raise ValidationError({"tenant": "Tenant must match the selected lease."})
        if self.lease_id and self.unit_id and self.lease.unit_id != self.unit_id:
            raise ValidationError({"unit": "Unit must match the selected lease."})

    def save(self, *args, **kwargs):
        if not self.account_id and self.lease_id:
            self.account_id = self.lease.account_id
        if not self.property_id and self.unit_id:
            self.property_id = self.unit.property_id
        if self.amount is not None and self.amount_paid is not None:
            self.balance = self.amount - self.amount_paid
        self.full_clean()
        if self.balance <= 0:
            self.status = self.Status.PAID
        elif self.amount_paid > 0:
            self.status = self.Status.PARTIAL
        elif self.due_date < timezone.localdate():
            self.status = self.Status.OVERDUE
        else:
            self.status = self.Status.UNPAID
        super().save(*args, **kwargs)


class Payment(TimeStampedModel):
    class Method(models.TextChoices):
        MPESA = "mpesa", "M-Pesa"
        BANK = "bank", "Bank"
        CASH = "cash", "Cash"
        CHEQUE = "cheque", "Cheque"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="payments")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.PROTECT, related_name="payments")
    lease = models.ForeignKey("leases.Lease", on_delete=models.PROTECT, related_name="payments")
    rent_charge = models.ForeignKey(RentCharge, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=32, choices=Method.choices)
    reference_number = models.CharField(max_length=100, blank=True)
    receipt_number = models.CharField(max_length=100, unique=True, null=True, blank=True)
    mpesa_phone_number = models.CharField(max_length=32, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    payment_date = models.DateField()
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="received_payments")
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-payment_date", "-created_at"]

    def __str__(self):
        return f"{self.tenant} - {self.amount}"

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Payment amount must be greater than zero."})
        if self.lease_id and self.tenant_id and self.lease.tenant_id != self.tenant_id:
            raise ValidationError({"tenant": "Tenant must match the selected lease."})
        if self.rent_charge and self.rent_charge.lease_id != self.lease_id:
            raise ValidationError({"rent_charge": "Rent charge must belong to the selected lease."})
        if self.reference_number and Payment.objects.filter(reference_number__iexact=self.reference_number).exclude(pk=self.pk).exists():
            raise ValidationError({"reference_number": "A payment with this reference already exists."})

    def save(self, *args, **kwargs):
        self.full_clean()
        is_new = self.pk is None
        with transaction.atomic():
            if not self.account_id and self.lease_id:
                self.account_id = self.lease.account_id
            if not self.receipt_number:
                today = timezone.localdate().strftime("%Y%m%d")
                next_number = Payment.objects.count() + 1
                self.receipt_number = f"RCT-{today}-{next_number:05d}"
            super().save(*args, **kwargs)
            if is_new:
                self._apply_to_rent_charges()

    def _apply_to_rent_charges(self):
        if not self.lease_id:
            return

        remaining = self.amount
        outstanding_charges = list(
            RentCharge.objects.select_for_update()
            .filter(lease_id=self.lease_id, balance__gt=0)
            .order_by("due_date", "billing_month", "id")
        )

        if self.rent_charge_id:
            outstanding_charges.sort(
                key=lambda charge: (
                    0 if charge.id == self.rent_charge_id else 1,
                    charge.due_date,
                    charge.billing_month,
                    charge.id,
                )
            )

        for charge in outstanding_charges:
            if remaining <= 0:
                break
            applied_amount = min(remaining, charge.balance)
            charge.amount_paid += applied_amount
            charge.save(update_fields=["amount_paid", "balance", "status", "updated_at"])
            remaining -= applied_amount

        if remaining > 0 and self.rent_charge_id:
            charge = RentCharge.objects.select_for_update().get(pk=self.rent_charge_id)
            charge.amount_paid += remaining
            charge.save(update_fields=["amount_paid", "balance", "status", "updated_at"])


class PaymentClaim(TimeStampedModel):
    class Method(models.TextChoices):
        MPESA = "mpesa", "M-Pesa"
        BANK = "bank", "Bank"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending Verification"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="payment_claims")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.PROTECT, related_name="payment_claims")
    lease = models.ForeignKey("leases.Lease", on_delete=models.PROTECT, related_name="payment_claims")
    rent_charge = models.ForeignKey(RentCharge, on_delete=models.SET_NULL, null=True, blank=True, related_name="payment_claims")
    amount_claimed = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=32, choices=Method.choices, default=Method.MPESA)
    confirmation_code = models.CharField(max_length=100, unique=True)
    pasted_message = models.TextField(blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    bank_name = models.CharField(max_length=100, blank=True)
    claimed_payment_date = models.DateField(default=timezone.localdate)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="submitted_payment_claims")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING)
    verification_notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="verified_payment_claims",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_payment = models.OneToOneField(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name="source_claim")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.confirmation_code} - {self.tenant}"

    def clean(self):
        if self.amount_claimed <= 0:
            raise ValidationError({"amount_claimed": "Claimed amount must be greater than zero."})
        if self.lease_id and self.tenant_id and self.lease.tenant_id != self.tenant_id:
            raise ValidationError({"tenant": "Tenant must match the selected lease."})
        if self.rent_charge and self.rent_charge.lease_id != self.lease_id:
            raise ValidationError({"rent_charge": "Rent charge must belong to the selected lease."})
        if PaymentClaim.objects.filter(confirmation_code__iexact=self.confirmation_code).exclude(pk=self.pk).exists():
            raise ValidationError({"confirmation_code": "A payment claim with this confirmation code already exists."})

    def save(self, *args, **kwargs):
        self.confirmation_code = self.confirmation_code.strip()
        self.full_clean()
        if not self.account_id and self.lease_id:
            self.account_id = self.lease.account_id
        super().save(*args, **kwargs)

    def verify(self, verified_by, notes=""):
        if self.status != self.Status.PENDING:
            raise ValidationError("Only pending payment claims can be verified.")
        with transaction.atomic():
            claim = PaymentClaim.objects.select_for_update().get(pk=self.pk)
            payment = Payment.objects.create(
                tenant=claim.tenant,
                lease=claim.lease,
                rent_charge=claim.rent_charge,
                amount=claim.amount_claimed,
                payment_method=claim.payment_method,
                reference_number=claim.confirmation_code,
                mpesa_phone_number=claim.phone_number,
                bank_name=claim.bank_name,
                payment_date=claim.claimed_payment_date,
                received_by=verified_by,
                notes=f"Verified payment claim. {notes}".strip(),
            )
            claim.status = claim.Status.VERIFIED
            claim.verified_by = verified_by
            claim.verified_at = timezone.now()
            claim.verified_payment = payment
            claim.verification_notes = notes
            claim.save(update_fields=["status", "verified_by", "verified_at", "verified_payment", "verification_notes", "updated_at"])
            return payment

    def reject(self, rejected_by, notes):
        if self.status != self.Status.PENDING:
            raise ValidationError("Only pending payment claims can be rejected.")
        self.status = self.Status.REJECTED
        self.verified_by = rejected_by
        self.verified_at = timezone.now()
        self.verification_notes = notes
        self.save(update_fields=["status", "verified_by", "verified_at", "verification_notes", "updated_at"])


class CashCollection(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING_HANDOVER = "pending_handover", "Pending Handover"
        HANDED_OVER = "handed_over", "Handed Over"
        CONFIRMED = "confirmed", "Confirmed"
        REJECTED = "rejected", "Rejected"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="cash_collections")
    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.PROTECT, related_name="cash_collections")
    lease = models.ForeignKey("leases.Lease", on_delete=models.PROTECT, related_name="cash_collections")
    rent_charge = models.ForeignKey(RentCharge, on_delete=models.SET_NULL, null=True, blank=True, related_name="cash_collections")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    collection_date = models.DateField(default=timezone.localdate)
    collected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="cash_collections")
    provisional_receipt_number = models.CharField(max_length=100, unique=True, blank=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING_HANDOVER)
    handed_over_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cash_handovers_received",
    )
    handover_date = models.DateField(null=True, blank=True)
    verification_notes = models.TextField(blank=True)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="confirmed_cash_collections",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmed_payment = models.OneToOneField(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name="source_cash_collection")

    class Meta:
        ordering = ["-collection_date", "-created_at"]

    def __str__(self):
        return f"{self.provisional_receipt_number} - {self.tenant}"

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Cash amount must be greater than zero."})
        if self.lease_id and self.tenant_id and self.lease.tenant_id != self.tenant_id:
            raise ValidationError({"tenant": "Tenant must match the selected lease."})
        if self.rent_charge and self.rent_charge.lease_id != self.lease_id:
            raise ValidationError({"rent_charge": "Rent charge must belong to the selected lease."})

    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.account_id and self.lease_id:
            self.account_id = self.lease.account_id
        if not self.provisional_receipt_number:
            today = timezone.localdate().strftime("%Y%m%d")
            next_number = CashCollection.objects.count() + 1
            self.provisional_receipt_number = f"CASH-{today}-{next_number:05d}"
        super().save(*args, **kwargs)

    def mark_handed_over(self, handed_over_to, handover_date=None, notes=""):
        if self.status != self.Status.PENDING_HANDOVER:
            raise ValidationError("Only pending cash collections can be handed over.")
        self.status = self.Status.HANDED_OVER
        if isinstance(handed_over_to, int) or str(handed_over_to).isdigit():
            self.handed_over_to_id = handed_over_to
        else:
            self.handed_over_to = handed_over_to
        self.handover_date = handover_date or timezone.localdate()
        self.verification_notes = notes
        self.save(update_fields=["status", "handed_over_to", "handover_date", "verification_notes", "updated_at"])

    def confirm(self, confirmed_by, notes=""):
        if self.status not in [self.Status.PENDING_HANDOVER, self.Status.HANDED_OVER]:
            raise ValidationError("Only pending or handed-over cash collections can be confirmed.")
        with transaction.atomic():
            collection = CashCollection.objects.select_for_update().get(pk=self.pk)
            payment = Payment.objects.create(
                tenant=collection.tenant,
                lease=collection.lease,
                rent_charge=collection.rent_charge,
                amount=collection.amount,
                payment_method=Payment.Method.CASH,
                reference_number=collection.provisional_receipt_number,
                payment_date=collection.collection_date,
                received_by=confirmed_by,
                notes=f"Confirmed cash collection. {notes}".strip(),
            )
            collection.status = collection.Status.CONFIRMED
            collection.confirmed_by = confirmed_by
            collection.confirmed_at = timezone.now()
            collection.confirmed_payment = payment
            collection.verification_notes = notes
            collection.save(update_fields=["status", "confirmed_by", "confirmed_at", "confirmed_payment", "verification_notes", "updated_at"])
            return payment

    def reject(self, rejected_by, notes):
        if self.status == self.Status.CONFIRMED:
            raise ValidationError("Confirmed cash collections cannot be rejected.")
        self.status = self.Status.REJECTED
        self.confirmed_by = rejected_by
        self.confirmed_at = timezone.now()
        self.verification_notes = notes
        self.save(update_fields=["status", "confirmed_by", "confirmed_at", "verification_notes", "updated_at"])
