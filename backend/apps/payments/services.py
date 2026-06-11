from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.db import transaction

from apps.leases.models import Lease
from apps.payments.models import RentCharge


def month_start(value):
    return date(value.year, value.month, 1)


def due_date_for_month(month, billing_day):
    day = min(billing_day, monthrange(month.year, month.month)[1])
    return date(month.year, month.month, day)


def calculate_late_fee(lease):
    if lease.late_fee_type == Lease.LateFeeType.FIXED:
        return lease.late_fee_value
    if lease.late_fee_type == Lease.LateFeeType.PERCENTAGE:
        return (lease.rent_amount * lease.late_fee_value / Decimal("100.00")).quantize(Decimal("0.01"))
    return Decimal("0.00")


@transaction.atomic
def apply_existing_credit_to_charge(charge):
    remaining_balance = charge.balance
    if remaining_balance <= 0:
        return charge

    credit_charges = (
        RentCharge.objects.select_for_update()
        .filter(lease=charge.lease, billing_month__lt=charge.billing_month, balance__lt=0)
        .order_by("billing_month", "id")
    )

    for credit_charge in credit_charges:
        if remaining_balance <= 0:
            break
        available_credit = -credit_charge.balance
        applied_credit = min(available_credit, remaining_balance)
        credit_charge.amount_paid -= applied_credit
        credit_charge.save(update_fields=["amount_paid", "balance", "status", "updated_at"])
        charge.amount_paid += applied_credit
        charge.save(update_fields=["amount_paid", "balance", "status", "updated_at"])
        remaining_balance = charge.balance

    return charge


@transaction.atomic
def generate_rent_charges_for_month(target_month):
    billing_month = month_start(target_month)
    leases = Lease.objects.select_related("tenant", "unit", "unit__property").filter(
        status=Lease.Status.ACTIVE,
        start_date__lte=target_month,
    ).filter(
        end_date__isnull=True,
    ) | Lease.objects.select_related("tenant", "unit", "unit__property").filter(
        status=Lease.Status.ACTIVE,
        start_date__lte=target_month,
        end_date__gte=billing_month,
    )

    created = []
    for lease in leases.distinct():
        charge, was_created = RentCharge.objects.get_or_create(
            lease=lease,
            billing_month=billing_month,
            defaults={
                "account": lease.account,
                "tenant": lease.tenant,
                "unit": lease.unit,
                "property": lease.unit.property,
                "amount": lease.rent_amount,
                "late_fee_amount": Decimal("0.00"),
                "amount_paid": Decimal("0.00"),
                "due_date": due_date_for_month(billing_month, lease.billing_day),
            },
        )
        if was_created:
            apply_existing_credit_to_charge(charge)
            created.append(charge)
    return created


def generate_initial_rent_charge_for_lease(lease):
    billing_month = month_start(lease.start_date)
    charge, was_created = RentCharge.objects.get_or_create(
        lease=lease,
        billing_month=billing_month,
        defaults={
            "account": lease.account,
            "tenant": lease.tenant,
            "unit": lease.unit,
            "property": lease.unit.property,
            "amount": lease.rent_amount,
            "late_fee_amount": Decimal("0.00"),
            "amount_paid": Decimal("0.00"),
            "due_date": due_date_for_month(billing_month, lease.billing_day),
        },
    )
    if was_created:
        apply_existing_credit_to_charge(charge)
    return charge, was_created
