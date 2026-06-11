from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from apps.accounts.models import Account, AuditLog, Role, User


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "owner__email"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["action", "entity_type", "entity_id", "actor", "account", "created_at"]
    list_filter = ["action", "entity_type", "account"]
    search_fields = ["summary", "actor__email", "entity_type", "entity_id"]


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "description", "created_at"]
    search_fields = ["name", "description"]


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    model = User
    list_display = ["email", "account", "first_name", "last_name", "role", "is_staff", "is_active"]
    list_filter = ["account", "role", "is_staff", "is_active"]
    search_fields = ["email", "first_name", "last_name", "phone_number"]
    ordering = ["email"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone_number", "account", "role")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "password1", "password2", "role", "is_staff", "is_active"),
        }),
    )
