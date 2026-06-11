from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Account, Role


class Command(BaseCommand):
    help = "Create default roles and an optional initial landlord/admin user."

    def add_arguments(self, parser):
        parser.add_argument("--email", help="Initial user email.")
        parser.add_argument("--password", help="Initial user password.")
        parser.add_argument("--role", default=Role.Names.LANDLORD, choices=[Role.Names.ADMIN, Role.Names.LANDLORD])
        parser.add_argument("--account-name", default="Main Property Account")

    def handle(self, *args, **options):
        for name, label in Role.Names.choices:
            Role.objects.get_or_create(name=name, defaults={"description": label})
        self.stdout.write(self.style.SUCCESS("Default roles are ready."))

        email = options.get("email")
        password = options.get("password")
        if not email and not password:
            return
        if not email or not password:
            raise CommandError("--email and --password must be provided together.")

        User = get_user_model()
        role = Role.objects.get(name=options["role"])
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "role": role,
                "is_staff": options["role"] == Role.Names.ADMIN,
                "is_superuser": options["role"] == Role.Names.ADMIN,
                "is_active": True,
            },
        )
        user.role = role
        user.is_active = True
        user.set_password(password)
        if options["role"] == Role.Names.ADMIN:
            user.is_staff = True
            user.is_superuser = True
        user.save()

        if options["role"] == Role.Names.LANDLORD:
            account, _ = Account.objects.get_or_create(
                owner=user,
                defaults={"name": options["account_name"]},
            )
            user.account = account
            user.save(update_fields=["account"])

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} {options['role']} user {email}."))
