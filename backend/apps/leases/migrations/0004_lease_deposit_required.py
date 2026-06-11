from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("leases", "0003_lease_one_active_lease_per_tenant"),
    ]

    operations = [
        migrations.AddField(
            model_name="lease",
            name="deposit_required",
            field=models.BooleanField(default=True),
        ),
    ]
