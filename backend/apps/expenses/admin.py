from django.contrib import admin

from apps.expenses.models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ["property", "unit", "category", "amount", "expense_date", "recorded_by"]
    list_filter = ["category", "expense_date", "property"]
    search_fields = ["property__name", "unit__unit_number", "description", "recorded_by__email"]

