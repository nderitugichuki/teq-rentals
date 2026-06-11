from django.db.models import Q


def scope_property_queryset(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account)
    if user.is_caretaker:
        return queryset.filter(account=user.account, caretakers=user)
    return queryset.none()


def scope_unit_queryset(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(property__account=user.account)
    if user.is_caretaker:
        return queryset.filter(property__account=user.account, property__caretakers=user)
    return queryset.none()


def scope_tenant_queryset(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account).distinct()
    if user.is_caretaker:
        return queryset.filter(account=user.account).filter(Q(created_by=user) | Q(leases__unit__property__caretakers=user)).distinct()
    return queryset.none()


def scope_lease_queryset(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account)
    if user.is_caretaker:
        return queryset.filter(account=user.account, unit__property__caretakers=user)
    return queryset.none()


def scope_financial_queryset(queryset, user):
    if user.is_admin:
        return queryset
    if user.is_landlord:
        return queryset.filter(account=user.account)
    if user.is_caretaker:
        return queryset.filter(
            account=user.account,
            property__caretakers=user,
        ).filter(Q(status="unpaid") | Q(status="partial") | Q(status="overdue"))
    return queryset.none()
