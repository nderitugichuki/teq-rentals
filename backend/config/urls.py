from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.views import AccountViewSet, AuditLogViewSet, CurrentUserView, RoleViewSet, UserViewSet
from apps.expenses.views import ExpenseViewSet
from apps.leases.views import LeaseViewSet
from apps.maintenance.views import MaintenancePhotoViewSet, MaintenanceRequestViewSet
from apps.notifications.views import NotificationViewSet
from apps.payments.views import (
    ArrearsReportViewSet,
    CashCollectionViewSet,
    PaymentClaimViewSet,
    PaymentViewSet,
    RentChargeViewSet,
    UtilityChargeViewSet,
)
from apps.properties.views import PropertyViewSet, UnitViewSet
from apps.reports.views import (
    IncomeExpenseReportView,
    OccupancyReportView,
    PropertySummaryReportView,
    PropertyDetailReportView,
    AgedReceivablesReportView,
    RentRollReportView,
    RentCollectionReportView,
    TenantStatementReportView,
    TransactionsLedgerReportView,
)
from apps.tenants.views import PromiseToPayViewSet, TenantViewSet


def health_check(request):
    return JsonResponse({"status": "ok"})

router = DefaultRouter()
router.register("accounts", AccountViewSet)
router.register("audit-logs", AuditLogViewSet)
router.register("roles", RoleViewSet)
router.register("users", UserViewSet)
router.register("properties", PropertyViewSet)
router.register("units", UnitViewSet)
router.register("tenants", TenantViewSet)
router.register("promises-to-pay", PromiseToPayViewSet)
router.register("leases", LeaseViewSet)
router.register("rent-charges", RentChargeViewSet)
router.register("payments", PaymentViewSet)
router.register("utility-charges", UtilityChargeViewSet)
router.register("payment-claims", PaymentClaimViewSet)
router.register("cash-collections", CashCollectionViewSet)
router.register("notifications", NotificationViewSet)
router.register("expenses", ExpenseViewSet)
router.register("maintenance-requests", MaintenanceRequestViewSet)
router.register("maintenance-photos", MaintenancePhotoViewSet)
router.register("reports/arrears", ArrearsReportViewSet, basename="arrears-report")

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("admin/", admin.site.urls),
    path("api/v1/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/v1/auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("api/v1/reports/rent-collection/", RentCollectionReportView.as_view(), name="rent_collection_report"),
    path("api/v1/reports/occupancy/", OccupancyReportView.as_view(), name="occupancy_report"),
    path("api/v1/reports/income-expense/", IncomeExpenseReportView.as_view(), name="income_expense_report"),
    path("api/v1/reports/property-summary/", PropertySummaryReportView.as_view(), name="property_summary_report"),
    path("api/v1/reports/property-detail/", PropertyDetailReportView.as_view(), name="property_detail_report"),
    path("api/v1/reports/tenant-statement/", TenantStatementReportView.as_view(), name="tenant_statement_report"),
    path("api/v1/reports/transactions/", TransactionsLedgerReportView.as_view(), name="transactions_ledger_report"),
    path("api/v1/reports/rent-roll/", RentRollReportView.as_view(), name="rent_roll_report"),
    path("api/v1/reports/aged-receivables/", AgedReceivablesReportView.as_view(), name="aged_receivables_report"),
    path("api/v1/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
