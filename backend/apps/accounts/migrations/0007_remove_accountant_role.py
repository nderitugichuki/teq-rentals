from django.db import migrations


def remove_accountant_role(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    User = apps.get_model("accounts", "User")

    landlord_role = Role.objects.filter(name="landlord").first()
    accountant_role = Role.objects.filter(name="accountant").first()
    if not accountant_role:
        return

    if landlord_role:
        User.objects.filter(role=accountant_role).update(role=landlord_role)
    else:
        User.objects.filter(role=accountant_role).update(role=None)

    accountant_role.delete()


def restore_accountant_role(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.get_or_create(
        name="accountant",
        defaults={"description": "Legacy financial management role."},
    )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0006_alter_role_name"),
    ]

    operations = [
        migrations.RunPython(remove_accountant_role, restore_accountant_role),
    ]
