from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Property",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255)),
                ("property_type", models.CharField(choices=[("apartment", "Apartment"), ("house", "House"), ("commercial", "Commercial"), ("mixed_use", "Mixed Use")], default="apartment", max_length=32)),
                ("address", models.CharField(max_length=255)),
                ("county", models.CharField(max_length=100)),
                ("town", models.CharField(max_length=100)),
                ("description", models.TextField(blank=True)),
                ("landlord", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="properties", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name_plural": "properties", "ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Unit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("unit_number", models.CharField(max_length=50)),
                ("unit_type", models.CharField(choices=[("bedsitter", "Bedsitter"), ("one_bedroom", "One Bedroom"), ("two_bedroom", "Two Bedroom"), ("three_bedroom", "Three Bedroom"), ("commercial", "Commercial")], max_length=32)),
                ("floor", models.CharField(blank=True, max_length=50)),
                ("rent_amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("deposit_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("status", models.CharField(choices=[("vacant", "Vacant"), ("occupied", "Occupied"), ("maintenance", "Maintenance"), ("inactive", "Inactive")], default="vacant", max_length=32)),
                ("property", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="units", to="properties.property")),
            ],
            options={
                "ordering": ["property__name", "unit_number"],
                "constraints": [models.UniqueConstraint(fields=("property", "unit_number"), name="unique_unit_per_property")],
            },
        ),
    ]

