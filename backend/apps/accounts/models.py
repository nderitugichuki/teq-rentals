from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models

from apps.common.models import TimeStampedModel


class Account(TimeStampedModel):
    name = models.CharField(max_length=255)
    owner = models.OneToOneField(
        "User",
        on_delete=models.PROTECT,
        related_name="owned_account",
    )
    is_active = models.BooleanField(default=True)
    enable_maintenance = models.BooleanField(default=True)
    enable_cash_collections = models.BooleanField(default=True)
    enable_payment_claims = models.BooleanField(default=True)
    enable_sms = models.BooleanField(default=False)
    enable_late_fees = models.BooleanField(default=True)
    enable_expenses = models.BooleanField(default=True)
    enable_utilities = models.BooleanField(default=True)
    enable_tenant_portal = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def features(self):
        return {
            "maintenance": self.enable_maintenance,
            "cash_collections": self.enable_cash_collections,
            "payment_claims": self.enable_payment_claims,
            "sms": self.enable_sms,
            "late_fees": self.enable_late_fees,
            "expenses": self.enable_expenses,
            "utilities": self.enable_utilities,
            "tenant_portal": self.enable_tenant_portal,
        }


class AuditLog(TimeStampedModel):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="audit_logs")
    actor = models.ForeignKey("User", on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=64, blank=True)
    summary = models.TextField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} {self.entity_type} {self.entity_id}".strip()


class Role(TimeStampedModel):
    class Names(models.TextChoices):
        ADMIN = "admin", "Admin"
        LANDLORD = "landlord", "Landlord"
        CARETAKER = "caretaker", "Caretaker"

    name = models.CharField(max_length=32, choices=Names.choices, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.get_name_display()


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, username=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = models.CharField(max_length=150, unique=True, blank=True)
    email = models.EmailField(unique=True)
    account = models.ForeignKey(Account, on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    phone_number = models.CharField(max_length=32, blank=True)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ["email"]

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    @property
    def role_name(self):
        return self.role.name if self.role else None

    @property
    def is_admin(self):
        return self.is_superuser or self.role_name == Role.Names.ADMIN

    @property
    def is_landlord(self):
        return self.role_name == Role.Names.LANDLORD

    @property
    def is_caretaker(self):
        return self.role_name == Role.Names.CARETAKER
