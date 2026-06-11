from django.contrib import admin

from apps.payments.models import CashCollection, Payment, PaymentClaim, RentCharge, UtilityCharge


@admin.register(RentCharge)
class RentChargeAdmin(admin.ModelAdmin):
    list_display = ["tenant", "unit", "billing_month", "amount", "amount_paid", "balance", "status"]
    list_filter = ["status", "billing_month", "property"]
    search_fields = ["tenant__first_name", "tenant__last_name", "unit__unit_number", "property__name"]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["tenant", "amount", "payment_method", "reference_number", "payment_date", "received_by"]
    list_filter = ["payment_method", "payment_date"]
    search_fields = ["tenant__first_name", "tenant__last_name", "reference_number"]


@admin.register(UtilityCharge)
class UtilityChargeAdmin(admin.ModelAdmin):
    list_display = ["tenant", "unit", "utility_type", "billing_month", "amount", "amount_paid", "balance", "status"]
    list_filter = ["status", "utility_type", "billing_month", "property"]
    search_fields = ["tenant__first_name", "tenant__last_name", "unit__unit_number", "property__name"]


@admin.register(PaymentClaim)
class PaymentClaimAdmin(admin.ModelAdmin):
    list_display = ["confirmation_code", "tenant", "amount_claimed", "payment_method", "status", "submitted_by", "verified_by"]
    list_filter = ["status", "payment_method", "claimed_payment_date"]
    search_fields = ["confirmation_code", "tenant__first_name", "tenant__last_name"]
    readonly_fields = ["verified_payment", "verified_at"]


@admin.register(CashCollection)
class CashCollectionAdmin(admin.ModelAdmin):
    list_display = ["provisional_receipt_number", "tenant", "amount", "status", "collected_by", "confirmed_by"]
    list_filter = ["status", "collection_date"]
    search_fields = ["provisional_receipt_number", "tenant__first_name", "tenant__last_name"]
    readonly_fields = ["provisional_receipt_number", "confirmed_payment", "confirmed_at"]
