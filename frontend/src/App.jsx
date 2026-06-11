import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout.jsx";
import { ProtectedRoute } from "./features/auth/ProtectedRoute.jsx";
import { AuditLogPage } from "./features/audit/AuditLogPage.jsx";
import { ArrearsPage } from "./features/arrears/ArrearsPage.jsx";
import { LoginPage } from "./features/auth/LoginPage.jsx";
import { CashCollectionsPage } from "./features/cashCollections/CashCollectionsPage.jsx";
import { DashboardPage } from "./features/dashboard/DashboardPage.jsx";
import { ExpensesPage } from "./features/expenses/ExpensesPage.jsx";
import { FollowUpPage } from "./features/followUp/FollowUpPage.jsx";
import { LeasesPage } from "./features/leases/LeasesPage.jsx";
import { MaintenancePage } from "./features/maintenance/MaintenancePage.jsx";
import { NotificationsPage } from "./features/notifications/NotificationsPage.jsx";
import { PaymentsPage } from "./features/payments/PaymentsPage.jsx";
import { PaymentClaimsPage } from "./features/paymentClaims/PaymentClaimsPage.jsx";
import { PropertiesPage } from "./features/properties/PropertiesPage.jsx";
import { PropertyDetailPage } from "./features/properties/PropertyDetailPage.jsx";
import { ReportsPage } from "./features/reports/ReportsPage.jsx";
import { SettingsPage } from "./features/settings/SettingsPage.jsx";
import { StaffPage } from "./features/staff/StaffPage.jsx";
import { TenantsPage } from "./features/tenants/TenantsPage.jsx";
import { TransactionsPage } from "./features/transactions/TransactionsPage.jsx";
import { UnitsPage } from "./features/units/UnitsPage.jsx";
import { UtilitiesPage } from "./features/utilities/UtilitiesPage.jsx";
import { VerificationPage } from "./features/verification/VerificationPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="properties" element={<PropertiesPage />} />
        <Route path="properties/:propertyId" element={<PropertyDetailPage />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="leases" element={<LeasesPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="follow-up" element={<FollowUpPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="utilities" element={<UtilitiesPage />} />
        <Route path="arrears" element={<ArrearsPage />} />
        <Route path="payment-claims" element={<PaymentClaimsPage />} />
        <Route path="cash-collections" element={<CashCollectionsPage />} />
        <Route path="verification" element={<VerificationPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
