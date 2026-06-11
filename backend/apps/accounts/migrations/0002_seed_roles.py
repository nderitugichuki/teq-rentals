from django.db import migrations


ROLES = [
    ("admin", "Full platform access."),
    ("landlord", "Manage owned properties, units, leases, tenants, and reports."),
    ("accountant", "Manage rent charges, payments, expenses, and financial reports."),
    ("caretaker", "Manage assigned units and maintenance operations."),
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for name, description in ROLES:
        Role.objects.get_or_create(name=name, defaults={"description": description})


def remove_seeded_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(name__in=[name for name, _description in ROLES]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_roles, remove_seeded_roles),
    ]
