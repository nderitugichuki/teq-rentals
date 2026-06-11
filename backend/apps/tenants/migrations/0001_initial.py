from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Tenant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("first_name", models.CharField(max_length=150)),
                ("last_name", models.CharField(max_length=150)),
                ("phone_number", models.CharField(max_length=32, unique=True)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("id_number", models.CharField(blank=True, max_length=32)),
                ("kra_pin", models.CharField(blank=True, max_length=32)),
                ("emergency_contact_name", models.CharField(blank=True, max_length=150)),
                ("emergency_contact_phone", models.CharField(blank=True, max_length=32)),
            ],
            options={"ordering": ["first_name", "last_name"]},
        ),
    ]

