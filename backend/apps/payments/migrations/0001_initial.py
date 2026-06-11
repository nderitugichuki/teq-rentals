from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("leases", "0001_initial"),
        ("properties", "0001_initial"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="RentCharge",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("billing_month", models.DateField()),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("amount_paid", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("balance", models.DecimalField(decimal_places=2, max_digits=12)),
                ("due_date", models.DateField()),
                ("status", models.CharField(choices=[("unpaid", "Unpaid"), ("partial", "Partial"), ("paid", "Paid"), ("overdue", "Overdue")], default="unpaid", max_length=32)),
                ("lease", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="rent_charges", to="leases.lease")),
                ("property", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="rent_charges", to="properties.property")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="rent_charges", to="tenants.tenant")),
                ("unit", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="rent_charges", to="properties.unit")),
            ],
            options={
                "ordering": ["-billing_month", "tenant__first_name"],
                "constraints": [models.UniqueConstraint(fields=("lease", "billing_month"), name="unique_charge_per_lease_month")],
            },
        ),
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("payment_method", models.CharField(choices=[("mpesa", "M-Pesa"), ("bank", "Bank"), ("cash", "Cash"), ("cheque", "Cheque")], max_length=32)),
                ("reference_number", models.CharField(blank=True, max_length=100)),
                ("payment_date", models.DateField()),
                ("notes", models.TextField(blank=True)),
                ("lease", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payments", to="leases.lease")),
                ("received_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="received_payments", to=settings.AUTH_USER_MODEL)),
                ("rent_charge", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="payments", to="payments.rentcharge")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="payments", to="tenants.tenant")),
            ],
            options={"ordering": ["-payment_date", "-created_at"]},
        ),
    ]

