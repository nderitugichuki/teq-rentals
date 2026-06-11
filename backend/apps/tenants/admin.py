from django.contrib import admin

from apps.tenants.models import PromiseToPay, Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ["first_name", "last_name", "phone_number", "status", "move_out_date"]
    search_fields = ["first_name", "last_name", "phone_number", "email", "id_number"]


@admin.register(PromiseToPay)
class PromiseToPayAdmin(admin.ModelAdmin):
    list_display = ["tenant", "promised_amount", "promised_date", "status", "recorded_by"]
    list_filter = ["status", "promised_date"]
    search_fields = ["tenant__first_name", "tenant__last_name", "tenant__phone_number", "note"]
