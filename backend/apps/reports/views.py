from decimal import Decimal

from django.db.models import Count, Q, Sum
from rest_framework import permissions, response, views
from rest_framework.exceptions import PermissionDenied

from apps.expenses.models import Expense
from apps.maintenance.models import MaintenanceRequest
from apps.payments.models import CashCollection, Payment, PaymentClaim, RentCharge, UtilityCharge
from apps.properties.models import Property, Unit
from apps.tenants.models import Tenant


def money(value):
    return value or Decimal("0.00")


def percentage(part, whole):
    if not whole:
        return 0
    return round((part / whole) * 100, 2)


def scope_properties(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account)
    if user.is_caretaker:
        return queryset.filter(caretakers=user)
    return queryset.none()


def scope_units(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(property__account=user.account)
    if user.is_caretaker:
        return queryset.filter(property__caretakers=user)
    return queryset.none()


def scope_charges(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account)
    if user.is_caretaker:
        return queryset.filter(property__caretakers=user).filter(Q(status="unpaid") | Q(status="partial") | Q(status="overdue"))
    return queryset.none()


def scope_tenants(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account)
    if user.is_caretaker:
        return queryset.filter(account=user.account, leases__unit__property__caretakers=user).distinct()
    return queryset.none()


def scope_payments(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account)
    if user.is_caretaker:
        return queryset.filter(lease__unit__property__caretakers=user)
    return queryset.none()


def scope_expenses(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account)
    if user.is_caretaker:
        return queryset.filter(property__caretakers=user)
    return queryset.none()


def deny_caretaker_financial_reports(user):
    if user.is_caretaker:
        raise PermissionDenied("Caretakers cannot access landlord financial reports.")


class RentCollectionReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deny_caretaker_financial_reports(request.user)
        charges = scope_charges(RentCharge.objects.select_related("property"), request.user)
        property_id = request.query_params.get("property")
        if property_id:
            charges = charges.filter(property_id=property_id)

        expected = money(charges.aggregate(total=Sum("amount"))["total"])
        collected = money(charges.aggregate(total=Sum("amount_paid"))["total"])
        balance = money(charges.aggregate(total=Sum("balance"))["total"])
        by_status = charges.values("status").annotate(count=Count("id"), total=Sum("balance")).order_by("status")

        return response.Response(
            {
                "expected": expected,
                "collected": collected,
                "balance": balance,
                "collection_rate": percentage(float(collected), float(expected)),
                "by_status": list(by_status),
            }
        )


class OccupancyReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        units = scope_units(Unit.objects.select_related("property"), request.user)
        property_id = request.query_params.get("property")
        if property_id:
            units = units.filter(property_id=property_id)

        total = units.count()
        occupied = units.filter(status=Unit.Status.OCCUPIED).count()
        vacant = units.filter(status=Unit.Status.VACANT).count()
        maintenance = units.filter(status=Unit.Status.MAINTENANCE).count()
        inactive = units.filter(status=Unit.Status.INACTIVE).count()

        return response.Response(
            {
                "total_units": total,
                "occupied_units": occupied,
                "vacant_units": vacant,
                "maintenance_units": maintenance,
                "inactive_units": inactive,
                "occupancy_rate": percentage(occupied, total),
            }
        )


class IncomeExpenseReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deny_caretaker_financial_reports(request.user)
        payments = scope_payments(Payment.objects.all(), request.user)
        expenses = scope_expenses(Expense.objects.all(), request.user)
        property_id = request.query_params.get("property")
        if property_id:
            payments = payments.filter(lease__unit__property_id=property_id)
            expenses = expenses.filter(property_id=property_id)

        income = money(payments.aggregate(total=Sum("amount"))["total"])
        expense_total = money(expenses.aggregate(total=Sum("amount"))["total"])

        return response.Response(
            {
                "income": income,
                "expenses": expense_total,
                "net_income": income - expense_total,
            }
        )


class PropertySummaryReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deny_caretaker_financial_reports(request.user)
        properties = scope_properties(Property.objects.all(), request.user)
        rows = []

        for property_obj in properties:
            units = Unit.objects.filter(property=property_obj)
            charges = RentCharge.objects.filter(property=property_obj)
            payments = Payment.objects.filter(lease__unit__property=property_obj)
            expenses = Expense.objects.filter(property=property_obj)
            total_units = units.count()
            occupied_units = units.filter(status=Unit.Status.OCCUPIED).count()
            collected = money(payments.aggregate(total=Sum("amount"))["total"])
            arrears = money(charges.aggregate(total=Sum("balance"))["total"])
            expense_total = money(expenses.aggregate(total=Sum("amount"))["total"])

            rows.append(
                {
                    "id": property_obj.id,
                    "name": property_obj.name,
                    "county": property_obj.county,
                    "town": property_obj.town,
                    "total_units": total_units,
                    "occupied_units": occupied_units,
                    "occupancy_rate": percentage(occupied_units, total_units),
                    "collected": collected,
                    "arrears": arrears,
                    "expenses": expense_total,
                    "net_income": collected - expense_total,
                }
            )

        return response.Response({"results": rows})


class PropertyDetailReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deny_caretaker_financial_reports(request.user)
        property_id = request.query_params.get("property")
        if not property_id:
            return response.Response({"detail": "property query parameter is required."}, status=400)

        properties = scope_properties(Property.objects.prefetch_related("caretakers"), request.user)
        property_obj = properties.filter(pk=property_id).first()
        if not property_obj:
            return response.Response({"detail": "Property not found."}, status=404)

        units = scope_units(Unit.objects.filter(property=property_obj), request.user)
        charges = scope_charges(RentCharge.objects.filter(property=property_obj), request.user)
        payments = scope_payments(Payment.objects.filter(lease__unit__property=property_obj), request.user)
        expenses = scope_expenses(Expense.objects.filter(property=property_obj), request.user)
        maintenance = MaintenanceRequest.objects.filter(property=property_obj)
        if not request.user.is_admin:
            maintenance = maintenance.filter(account=property_obj.account)
        if request.user.is_caretaker:
            maintenance = maintenance.filter(property__caretakers=request.user)

        unit_rows = [
            {
                "id": unit.id,
                "unit_number": unit.unit_number,
                "unit_type": unit.unit_type,
                "floor": unit.floor,
                "rent_amount": unit.rent_amount,
                "status": unit.status,
            }
            for unit in units.order_by("unit_type", "unit_number")
        ]

        tenants = Tenant.objects.filter(leases__unit__property=property_obj).distinct()
        tenant_rows = [
            {
                "id": tenant.id,
                "name": str(tenant),
                "phone_number": tenant.phone_number,
                "status": tenant.status,
                "unit": tenant.leases.filter(unit__property=property_obj).order_by("-start_date").first().unit.unit_number,
            }
            for tenant in tenants
        ]

        expected = money(charges.aggregate(total=Sum("amount"))["total"])
        collected = money(payments.aggregate(total=Sum("amount"))["total"])
        arrears = money(charges.aggregate(total=Sum("balance"))["total"])
        expense_total = money(expenses.aggregate(total=Sum("amount"))["total"])
        open_maintenance = maintenance.exclude(status__in=["resolved", "closed"]).count()

        return response.Response(
            {
                "property": {
                    "id": property_obj.id,
                    "name": property_obj.name,
                    "county": property_obj.county,
                    "town": property_obj.town,
                    "address": property_obj.address,
                    "caretakers": [caretaker.email for caretaker in property_obj.caretakers.all()],
                },
                "summary": {
                    "total_units": units.count(),
                    "occupied_units": units.filter(status=Unit.Status.OCCUPIED).count(),
                    "vacant_units": units.filter(status=Unit.Status.VACANT).count(),
                    "maintenance_units": units.filter(status=Unit.Status.MAINTENANCE).count(),
                    "expected": expected,
                    "collected": collected,
                    "arrears": arrears,
                    "expenses": expense_total,
                    "net_income": collected - expense_total,
                    "open_maintenance": open_maintenance,
                    "collection_rate": percentage(float(collected), float(expected)),
                },
                "units": unit_rows,
                "tenants": tenant_rows,
                "unit_type_summary": list(units.values("unit_type").annotate(total=Count("id")).order_by("unit_type")),
                "rent_status_summary": list(charges.values("status").annotate(total=Count("id"), balance=Sum("balance")).order_by("status")),
            }
        )


class TenantStatementReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deny_caretaker_financial_reports(request.user)
        tenant_id = request.query_params.get("tenant")
        if not tenant_id:
            return response.Response({"detail": "tenant query parameter is required."}, status=400)

        tenant = scope_tenants(Tenant.objects.all(), request.user).filter(pk=tenant_id).first()
        if not tenant:
            return response.Response({"detail": "Tenant not found."}, status=404)
        charges = scope_charges(RentCharge.objects.filter(tenant=tenant), request.user).order_by("billing_month")
        payments = scope_payments(Payment.objects.filter(tenant=tenant), request.user).order_by("payment_date")

        charge_rows = [
            {
                "id": charge.id,
                "date": charge.billing_month,
                "type": "Rent Charge",
                "description": f"Rent for {charge.billing_month:%B %Y}",
                "debit": charge.amount,
                "credit": Decimal("0.00"),
                "balance": charge.balance,
                "status": charge.status,
            }
            for charge in charges
        ]
        payment_rows = [
            {
                "id": payment.id,
                "date": payment.payment_date,
                "type": "Payment",
                "description": payment.reference_number or payment.get_payment_method_display(),
                "debit": Decimal("0.00"),
                "credit": payment.amount,
                "balance": Decimal("0.00"),
                "status": "paid",
            }
            for payment in payments
        ]
        rows = sorted(charge_rows + payment_rows, key=lambda row: row["date"])
        total_charged = money(charges.aggregate(total=Sum("amount"))["total"])
        total_paid = money(payments.aggregate(total=Sum("amount"))["total"])

        return response.Response(
            {
                "tenant": str(tenant),
                "total_charged": total_charged,
                "total_paid": total_paid,
                "balance": total_charged - total_paid,
                "results": rows,
            }
        )


class TransactionsLedgerReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deny_caretaker_financial_reports(request.user)
        property_id = request.query_params.get("property")
        rows = []

        payments = scope_payments(Payment.objects.select_related("tenant", "lease__unit__property"), request.user)
        expenses = scope_expenses(Expense.objects.select_related("property", "unit"), request.user)
        utility_charges = scope_charges(UtilityCharge.objects.select_related("tenant", "unit", "property"), request.user)
        claims = PaymentClaim.objects.select_related("tenant", "lease__unit__property")
        cash = CashCollection.objects.select_related("tenant", "lease__unit__property")
        if not request.user.is_admin:
            claims = claims.filter(account=request.user.account)
            cash = cash.filter(account=request.user.account)
        if request.user.is_caretaker:
            claims = claims.filter(lease__unit__property__caretakers=request.user)
            cash = cash.filter(lease__unit__property__caretakers=request.user)
        if property_id:
            payments = payments.filter(lease__unit__property_id=property_id)
            expenses = expenses.filter(property_id=property_id)
            utility_charges = utility_charges.filter(property_id=property_id)
            claims = claims.filter(lease__unit__property_id=property_id)
            cash = cash.filter(lease__unit__property_id=property_id)

        for payment in payments:
            rows.append({
                "id": f"payment-{payment.id}",
                "date": payment.payment_date,
                "type": "Rent Payment",
                "property": payment.lease.unit.property.name,
                "party": str(payment.tenant),
                "description": payment.reference_number or payment.get_payment_method_display(),
                "inflow": payment.amount,
                "outflow": Decimal("0.00"),
                "status": "confirmed",
                "sort_at": payment.created_at,
            })
        for expense in expenses:
            rows.append({
                "id": f"expense-{expense.id}",
                "date": expense.expense_date,
                "type": "Expense",
                "property": expense.property.name,
                "party": "",
                "description": expense.description,
                "inflow": Decimal("0.00"),
                "outflow": expense.amount,
                "status": expense.category,
                "sort_at": expense.created_at,
            })
        for charge in utility_charges:
            rows.append({
                "id": f"utility-{charge.id}",
                "date": charge.billing_month,
                "type": "Utility Charge",
                "property": charge.property.name,
                "party": str(charge.tenant),
                "description": charge.get_utility_type_display(),
                "inflow": Decimal("0.00"),
                "outflow": Decimal("0.00"),
                "status": charge.status,
                "sort_at": charge.created_at,
            })
        for claim in claims:
            rows.append({
                "id": f"claim-{claim.id}",
                "date": claim.claimed_payment_date,
                "type": "Payment Claim",
                "property": claim.lease.unit.property.name,
                "party": str(claim.tenant),
                "description": claim.confirmation_code,
                "inflow": claim.amount_claimed if claim.status == "verified" else Decimal("0.00"),
                "outflow": Decimal("0.00"),
                "status": claim.status,
                "sort_at": claim.verified_at or claim.created_at,
            })
        for collection in cash:
            rows.append({
                "id": f"cash-{collection.id}",
                "date": collection.collection_date,
                "type": "Cash Collection",
                "property": collection.lease.unit.property.name,
                "party": str(collection.tenant),
                "description": collection.provisional_receipt_number,
                "inflow": collection.amount if collection.status == "confirmed" else Decimal("0.00"),
                "outflow": Decimal("0.00"),
                "status": collection.status,
                "sort_at": collection.confirmed_at or collection.created_at,
            })

        rows = sorted(rows, key=lambda row: row["sort_at"], reverse=True)
        total_in = sum((row["inflow"] for row in rows), Decimal("0.00"))
        total_out = sum((row["outflow"] for row in rows), Decimal("0.00"))
        return response.Response({"total_in": total_in, "total_out": total_out, "net": total_in - total_out, "results": rows})


class RentRollReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deny_caretaker_financial_reports(request.user)
        units = scope_units(Unit.objects.select_related("property").prefetch_related("leases__tenant"), request.user)
        property_id = request.query_params.get("property")
        if property_id:
            units = units.filter(property_id=property_id)
        rows = []
        for unit in units.order_by("property__name", "unit_number"):
            lease = unit.leases.filter(status="active").select_related("tenant").first()
            charges = RentCharge.objects.filter(unit=unit)
            rows.append({
                "id": unit.id,
                "property": unit.property.name,
                "unit": unit.unit_number,
                "unit_type": unit.unit_type,
                "tenant": str(lease.tenant) if lease else "",
                "phone_number": lease.tenant.phone_number if lease else "",
                "rent_amount": lease.rent_amount if lease else unit.rent_amount,
                "lease_status": lease.status if lease else "vacant",
                "balance": money(charges.aggregate(total=Sum("balance"))["total"]),
            })
        return response.Response({"results": rows})


class AgedReceivablesReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        deny_caretaker_financial_reports(request.user)
        today = request._request.GET.get("as_of")
        charges = scope_charges(RentCharge.objects.select_related("tenant", "unit", "property").filter(balance__gt=0), request.user)
        property_id = request.query_params.get("property")
        if property_id:
            charges = charges.filter(property_id=property_id)

        rows = []
        buckets = {"0_30": Decimal("0.00"), "31_60": Decimal("0.00"), "61_90": Decimal("0.00"), "over_90": Decimal("0.00")}
        from django.utils.dateparse import parse_date
        as_of = parse_date(today) if today else None
        from django.utils import timezone
        as_of = as_of or timezone.localdate()

        for charge in charges.order_by("due_date"):
            age = max((as_of - charge.due_date).days, 0)
            bucket = "0_30" if age <= 30 else "31_60" if age <= 60 else "61_90" if age <= 90 else "over_90"
            buckets[bucket] += charge.balance
            rows.append({
                "id": charge.id,
                "property": charge.property.name,
                "unit": charge.unit.unit_number,
                "tenant": str(charge.tenant),
                "due_date": charge.due_date,
                "age_days": age,
                "bucket": bucket,
                "balance": charge.balance,
                "status": charge.status,
            })
        return response.Response({"buckets": buckets, "total": sum(buckets.values(), Decimal("0.00")), "results": rows})
