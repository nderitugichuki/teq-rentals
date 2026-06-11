from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.db.models.expressions


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("properties", "0001_initial"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Lease",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("start_date", models.DateField()),
                ("end_date", models.DateField(blank=True, null=True)),
                ("rent_amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("deposit_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("billing_day", models.PositiveSmallIntegerField(default=1)),
                ("status", models.CharField(choices=[("active", "Active"), ("terminated", "Terminated"), ("expired", "Expired")], default="active", max_length=32)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_leases", to=settings.AUTH_USER_MODEL)),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="leases", to="tenants.tenant")),
                ("unit", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="leases", to="properties.unit")),
            ],
            options={
                "ordering": ["-start_date"],
                "constraints": [models.UniqueConstraint(condition=models.Q(("status", "active")), fields=("unit",), name="one_active_lease_per_unit")],
            },
        ),
    ]

