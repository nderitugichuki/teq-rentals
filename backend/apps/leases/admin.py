from django.contrib import admin

from apps.leases.models import Lease


@admin.register(Lease)
class LeaseAdmin(admin.ModelAdmin):
    list_display = ["tenant", "unit", "start_date", "end_date", "rent_amount", "deposit_amount", "deposit_required", "move_in_total", "status"]
    list_filter = ["status", "deposit_required", "start_date"]
    search_fields = ["tenant__first_name", "tenant__last_name", "unit__unit_number", "unit__property__name"]
