from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.common.models import TimeStampedModel


class Expense(TimeStampedModel):
    class Category(models.TextChoices):
        REPAIRS = "repairs", "Repairs"
        SECURITY = "security", "Security"
        CLEANING = "cleaning", "Cleaning"
        UTILITIES = "utilities", "Utilities"
        MANAGEMENT = "management", "Management"
        TAXES = "taxes", "Taxes"
        OTHER = "other", "Other"

    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="expenses")
    property = models.ForeignKey("properties.Property", on_delete=models.PROTECT, related_name="expenses")
    unit = models.ForeignKey("properties.Unit", on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses")
    category = models.CharField(max_length=32, choices=Category.choices)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_date = models.DateField()
    description = models.TextField()
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="recorded_expenses")

    class Meta:
        ordering = ["-expense_date", "-created_at"]

    def __str__(self):
        return f"{self.property} - {self.category} - {self.amount}"

    def clean(self):
        if self.amount <= 0:
            raise ValidationError({"amount": "Expense amount must be greater than zero."})
        if self.unit and self.unit.property_id != self.property_id:
            raise ValidationError({"unit": "Unit must belong to the selected property."})

    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.account_id and self.property_id:
            self.account_id = self.property.account_id
        super().save(*args, **kwargs)
