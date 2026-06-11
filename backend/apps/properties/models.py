from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class Property(TimeStampedModel):
    class PropertyType(models.TextChoices):
        APARTMENT = "apartment", "Apartment"
        HOUSE = "house", "House"
        COMMERCIAL = "commercial", "Commercial"
        MIXED_USE = "mixed_use", "Mixed Use"

    landlord = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="properties")
    account = models.ForeignKey("accounts.Account", on_delete=models.PROTECT, null=True, blank=True, related_name="properties")
    caretakers = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="assigned_properties")
    name = models.CharField(max_length=255)
    property_type = models.CharField(max_length=32, choices=PropertyType.choices, default=PropertyType.APARTMENT)
    address = models.CharField(max_length=255, blank=True)
    county = models.CharField(max_length=100, blank=True)
    town = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "properties"

    def __str__(self):
        return self.name


class Unit(TimeStampedModel):
    class UnitType(models.TextChoices):
        BEDSITTER = "bedsitter", "Bedsitter"
        ONE_BEDROOM = "one_bedroom", "One Bedroom"
        TWO_BEDROOM = "two_bedroom", "Two Bedroom"
        THREE_BEDROOM = "three_bedroom", "Three Bedroom"
        COMMERCIAL = "commercial", "Commercial"

    class Status(models.TextChoices):
        VACANT = "vacant", "Vacant"
        OCCUPIED = "occupied", "Occupied"
        MAINTENANCE = "maintenance", "Maintenance"
        INACTIVE = "inactive", "Inactive"

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="units")
    unit_number = models.CharField(max_length=50)
    unit_type = models.CharField(max_length=32, choices=UnitType.choices)
    floor = models.CharField(max_length=50, blank=True)
    rent_amount = models.DecimalField(max_digits=12, decimal_places=2)
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.VACANT)

    class Meta:
        ordering = ["property__name", "unit_number"]
        constraints = [
            models.UniqueConstraint(fields=["property", "unit_number"], name="unique_unit_per_property"),
        ]

    def __str__(self):
        return f"{self.property.name} - {self.unit_number}"
