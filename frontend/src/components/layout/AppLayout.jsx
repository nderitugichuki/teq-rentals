import { Link, NavLink, Outlet } from "react-router-dom";
import { useMemo, useState } from "react";

import { postAction } from "../../api/resources.js";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { Button } from "../ui/Button.jsx";
import { StatusBadge } from "../ui/StatusBadge.jsx";

const navItems = [
  { label: "Dashboard", to: "/", roles: ["admin", "landlord", "caretaker"], group: "Main" },
  { label: "Properties", to: "/properties", roles: ["admin", "landlord", "caretaker"], group: "Property" },
  { label: "Units", to: "/units", roles: ["admin", "landlord", "caretaker"], group: "Property" },
  { label: "Tenants", to: "/tenants", roles: ["admin", "landlord", "caretaker"], group: "Property" },
  { label: "Leases", to: "/leases", roles: ["admin", "landlord", "caretaker"], group: "Property" },
  { label: "Payments", to: "/payments", roles: ["admin", "landlord"], group: "Rent & Money" },
  { label: "Follow-up", to: "/follow-up", roles: ["admin", "landlord", "caretaker"], group: "Rent & Money", badge: "followUp" },
  { label: "Transactions", to: "/transactions", roles: ["admin", "landlord"], group: "Rent & Money" },
  { label: "Utilities", to: "/utilities", roles: ["admin", "landlord"], feature: "utilities", group: "Rent & Money" },
  { label: "Expenses", to: "/expenses", roles: ["admin", "landlord"], feature: "expenses", group: "Rent & Money" },
  { label: "Arrears", to: "/arrears", roles: ["admin", "landlord"], group: "Rent & Money" },
  { label: "Payment Claims", to: "/payment-claims", roles: ["admin", "landlord", "caretaker"], feature: "payment_claims", group: "Verification", badge: "paymentClaims" },
  { label: "Cash Collections", to: "/cash-collections", roles: ["admin", "landlord", "caretaker"], feature: "cash_collections", group: "Verification", badge: "cashCollections" },
  { label: "Verification", to: "/verification", roles: ["admin", "landlord"], group: "Verification", badge: "verification" },
  { label: "Maintenance", to: "/maintenance", roles: ["admin", "landlord", "caretaker"], feature: "maintenance", group: "Operations", badge: "maintenance" },
  { label: "Reports", to: "/reports", roles: ["admin", "landlord"], group: "Operations" },
  { label: "Caretakers", to: "/staff", roles: ["admin", "landlord"], group: "Operations" },
  { label: "Notifications", to: "/notifications", roles: ["admin", "landlord", "caretaker"], group: "Settings" },
  { label: "Settings", to: "/settings", roles: ["admin", "landlord"], group: "Settings" },
  { label: "Audit Log", to: "/audit-log", roles: ["admin", "landlord"], group: "Settings" },
];

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function getNotificationAction(notification, role) {
  const text = normalize(`${notification.title} ${notification.message} ${notification.notification_type}`);
  const isCaretaker = role === "caretaker";

  if (text.includes("payment claim") || text.includes("cash collection") || text.includes("verification") || text.includes("confirmation")) {
    return {
      to: isCaretaker ? "/payment-claims" : "/verification",
      label: isCaretaker ? "View feedback" : "Take action",
      steps: isCaretaker
        ? "Check whether the landlord verified or rejected your submitted payment."
        : "Review the request, then verify or reject it.",
    };
  }

  if (text.includes("maintenance") || text.includes("issue")) {
    return {
      to: "/maintenance",
      label: isCaretaker ? "View issue" : "Take action",
      steps: isCaretaker
        ? "Check landlord feedback or continue the repair workflow."
        : "Review the issue, then approve, reject, or close it.",
    };
  }

  if (text.includes("vacated") || text.includes("occupied") || text.includes("tenant")) {
    return {
      to: "/tenants",
      label: "View tenant",
      steps: "Confirm the tenant and unit status.",
    };
  }

  return null;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [tenantQuery, setTenantQuery] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const role = user?.role_name || (user?.is_staff ? "admin" : "");
  const features = user?.account_features || {};
  const tenants = useResourceList("/tenants/");
  const leases = useResourceList("/leases/");
  const payments = useResourceList("/payments/");
  const charges = useResourceList("/rent-charges/");
  const countOptions = { pollMs: 10000 };
  const paymentClaims = useResourceList("/payment-claims/", true, countOptions);
  const cashCollections = useResourceList("/cash-collections/", true, countOptions);
  const maintenance = useResourceList("/maintenance-requests/", true, countOptions);
  const promises = useResourceList("/promises-to-pay/", true, countOptions);
  const landlordSide = ["admin", "landlord"].includes(role);
  const isCaretaker = role === "caretaker";
  const canUseNotifications = landlordSide || isCaretaker;
  const notifications = useResourceList("/notifications/", canUseNotifications, countOptions);
  const pendingClaimCount = paymentClaims.rows.filter((claim) => claim.status === "pending").length;
  const pendingCashCount = cashCollections.rows.filter((collection) => ["pending_handover", "handed_over"].includes(collection.status)).length;
  const maintenanceActionCount = maintenance.rows.filter((request) => {
    if (landlordSide) return ["awaiting_approval", "resolved"].includes(request.status);
    return ["open", "approved", "in_progress"].includes(request.status);
  }).length;
  const followUpCount = charges.rows.filter((charge) => Number(charge.balance || 0) > 0).length + promises.rows.filter((promise) => promise.status === "open").length;
  const badges = {
    followUp: followUpCount,
    paymentClaims: pendingClaimCount,
    cashCollections: pendingCashCount,
    verification: pendingClaimCount + pendingCashCount,
    maintenance: maintenanceActionCount,
  };
  const unreadNotifications = notifications.rows.filter((notification) => !notification.is_read);
  const recentNotifications = [...notifications.rows]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 6);
  const visibleNavItems = navItems.filter((item) => {
    const roleAllowed = item.roles.includes(role) || role === "admin";
    const featureAllowed = !item.feature || role === "admin" || features[item.feature] !== false;
    return roleAllowed && featureAllowed;
  });
  const tenantCards = useMemo(() => tenants.rows.map((tenant) => {
    const tenantLeases = leases.rows.filter((lease) => Number(lease.tenant) === Number(tenant.id));
    const activeLease = tenantLeases.find((lease) => lease.status === "active") || tenantLeases[0];
    const tenantPayments = payments.rows.filter((payment) => Number(payment.tenant) === Number(tenant.id));
    const tenantCharges = charges.rows.filter((charge) => Number(charge.tenant) === Number(tenant.id));
    const paid = tenantPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const balance = tenantCharges.reduce((sum, charge) => sum + Number(charge.balance || 0), 0);
    const searchText = [
      tenant.full_name,
      tenant.first_name,
      tenant.last_name,
      tenant.phone_number,
      tenant.email,
      tenant.id_number,
      tenant.kra_pin,
      tenant.emergency_contact_name,
      tenant.emergency_contact_phone,
      activeLease?.unit_label,
      activeLease?.status,
    ].map(normalize).join(" ");

    return { tenant, activeLease, tenantLeases, tenantPayments, tenantCharges, paid, balance, searchText };
  }), [charges.rows, leases.rows, payments.rows, tenants.rows]);
  const searchResults = tenantQuery.trim()
    ? tenantCards.filter((card) => card.searchText.includes(normalize(tenantQuery))).slice(0, 6)
    : [];
  const selectedTenant = selectedTenantId
    ? tenantCards.find((card) => Number(card.tenant.id) === Number(selectedTenantId))
    : searchResults[0];
  const groupedNavItems = visibleNavItems.reduce((groups, item) => {
    const group = item.group || "Main";
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});

  async function markNotificationRead(notificationId) {
    try {
      await postAction(`/notifications/${notificationId}/mark_read/`);
      notifications.refetch();
    } catch {
      // Keep the dropdown usable even if the backend rejects a stale item.
    }
  }

  function closeTenantSearch() {
    setTenantQuery("");
    setSelectedTenantId(null);
  }

  function closeMobileNav() {
    setShowMobileNav(false);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden h-screen w-60 overflow-hidden border-r border-slate-200 bg-white px-3 py-4 lg:flex lg:flex-col">
        <div className="shrink-0 rounded-md bg-[linear-gradient(135deg,#0d593c,#188a5a,#0f766e)] px-3 py-2.5 text-white shadow-sm">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-brand-100">RMS</div>
          <div className="mt-0.5 text-base font-semibold">Rental Manager</div>
        </div>
        <nav className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-8">
          {Object.entries(groupedNavItems).map(([group, items]) => (
            <div key={group}>
              <div className="mb-1 px-2 text-[0.62rem] font-black uppercase tracking-[0.16em] text-slate-400">{group}</div>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `block rounded-md border-l-4 px-2.5 py-1.5 text-[0.82rem] font-black transition ${
                        isActive ? "border-brand-700 bg-brand-600 text-white shadow-sm" : "border-transparent text-slate-700 hover:bg-brand-50 hover:text-brand-800"
                      }`
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      {badges[item.badge] ? (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[0.65rem] font-black leading-none text-white">
                          {badges[item.badge]}
                        </span>
                      ) : null}
                    </span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm text-slate-500">Logged in as</div>
              <div className="font-semibold text-slate-950">{user?.email}</div>
              <div className="text-xs font-medium capitalize text-brand-700">{role || "No role assigned"}</div>
            </div>
            <div className="relative order-3 w-full max-w-2xl flex-none md:order-none md:flex-1">
              <input
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                onChange={(event) => {
                  setTenantQuery(event.target.value);
                  setSelectedTenantId(null);
                }}
                placeholder="Search tenant by name, phone, emergency contact, or unit"
                type="search"
                value={tenantQuery}
              />
              {tenantQuery.trim() ? (
                <div className="absolute left-0 right-0 top-12 max-h-[75vh] overflow-y-auto rounded-md border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-950">Tenant search</div>
                      <div className="text-xs text-slate-500">{searchResults.length} result{searchResults.length === 1 ? "" : "s"}</div>
                    </div>
                    <button
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
                      onClick={closeTenantSearch}
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                  {searchResults.length ? (
                    <div className="grid gap-3 lg:grid-cols-[0.9fr_1.2fr]">
                      <div className="space-y-2">
                        {searchResults.map((card) => (
                          <button
                            className={`w-full rounded-md border px-3 py-2 text-left transition ${
                              Number(selectedTenant?.tenant.id) === Number(card.tenant.id)
                                ? "border-brand-300 bg-brand-50"
                                : "border-slate-200 hover:border-brand-200 hover:bg-slate-50"
                            }`}
                            key={card.tenant.id}
                            onClick={() => setSelectedTenantId(card.tenant.id)}
                            type="button"
                          >
                            <div className="font-black text-slate-950">{card.tenant.full_name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {card.tenant.phone_number || "No phone"} {card.activeLease?.unit_label ? `- ${card.activeLease.unit_label}` : ""}
                            </div>
                          </button>
                        ))}
                      </div>
                      {selectedTenant ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-lg font-black text-slate-950">{selectedTenant.tenant.full_name}</div>
                              <div className="text-sm text-slate-600">{selectedTenant.tenant.phone_number || "No phone"} {selectedTenant.tenant.email ? `- ${selectedTenant.tenant.email}` : ""}</div>
                            </div>
                            <StatusBadge value={selectedTenant.tenant.status} />
                          </div>
                          <div className={`mt-3 grid gap-2 ${isCaretaker ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                            <div className="rounded-md bg-white p-2">
                              <div className="text-xs font-semibold text-slate-500">Unit</div>
                              <div className="font-black text-slate-950">{selectedTenant.activeLease?.unit_label || "No active lease"}</div>
                            </div>
                            {!isCaretaker ? (
                              <div className="rounded-md bg-white p-2">
                                <div className="text-xs font-semibold text-slate-500">Paid</div>
                                <div className="font-black text-brand-700">{formatCurrency(selectedTenant.paid)}</div>
                              </div>
                            ) : null}
                            <div className="rounded-md bg-white p-2">
                              <div className="text-xs font-semibold text-slate-500">{isCaretaker ? "Follow-up" : "Balance"}</div>
                              <div className="font-black text-amber-700">{formatCurrency(selectedTenant.balance)}</div>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <div><span className="font-semibold text-slate-500">Emergency:</span> {selectedTenant.tenant.emergency_contact_phone || selectedTenant.tenant.emergency_contact_name || "Not recorded"}</div>
                            <div><span className="font-semibold text-slate-500">Move in:</span> {selectedTenant.tenant.move_in_date || "Not recorded"}</div>
                            {!isCaretaker ? <div><span className="font-semibold text-slate-500">Payments:</span> {selectedTenant.tenantPayments.length}</div> : null}
                            <div><span className="font-semibold text-slate-500">Rent charges:</span> {selectedTenant.tenantCharges.length}</div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {!isCaretaker ? <Link className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-bold text-white" onClick={closeTenantSearch} to="/payments">Record payment</Link> : null}
                            <Link className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-bold text-white" onClick={closeTenantSearch} to={`/leases?tenant=${selectedTenant.tenant.id}`}>View lease</Link>
                            {!isCaretaker ? <Link className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white" onClick={closeTenantSearch} to={`/arrears?tenant=${selectedTenant.tenant.id}`}>View arrears</Link> : null}
                            {isCaretaker ? <Link className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white" onClick={closeTenantSearch} to="/payment-claims">Submit claim</Link> : null}
                            <Link className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-bold text-white" onClick={closeTenantSearch} to={`/tenants?tenant=${selectedTenant.tenant.id}`}>Vacate tenant</Link>
                            <Link className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800" onClick={closeTenantSearch} to={`/tenants?tenant=${selectedTenant.tenant.id}`}>Details</Link>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">No matching tenant found.</div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canUseNotifications ? (
                <div className="relative">
                  <button
                    aria-label="Notifications"
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50"
                    onClick={() => setShowNotifications((current) => !current)}
                    type="button"
                  >
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 17a3 3 0 0 0 6 0" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {unreadNotifications.length ? (
                      <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 py-0.5 text-[0.65rem] font-black leading-none text-white">
                        {unreadNotifications.length}
                      </span>
                    ) : null}
                  </button>
                  {showNotifications ? (
                    <div className="fixed left-3 right-3 top-20 z-40 max-h-[78vh] overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl sm:left-auto sm:right-5 sm:w-[26rem]">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-950">Notifications</div>
                            <div className="text-xs text-slate-500">
                              {unreadNotifications.length} unread for {isCaretaker ? "caretaker" : "landlord"}
                            </div>
                          </div>
                          <button
                            className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100"
                            onClick={() => setShowNotifications(false)}
                            type="button"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Latest updates</div>
                        </div>
                        <Link className="text-xs font-bold text-brand-700 underline" onClick={() => setShowNotifications(false)} to="/notifications">
                          View all
                        </Link>
                      </div>
                      <div className="max-h-[58vh] space-y-2 overflow-y-auto p-3">
                        {recentNotifications.length ? recentNotifications.map((notification) => {
                          const action = getNotificationAction(notification, role);
                          return (
                            <div
                              className={`rounded-md border p-3 ${notification.is_read ? "border-slate-200 bg-white" : "border-brand-100 bg-brand-50"}`}
                              key={notification.id}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? "bg-slate-300" : "bg-brand-600"}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 text-sm font-black leading-5 text-slate-950">{notification.title}</div>
                                    <div className="shrink-0 text-[0.68rem] font-semibold text-slate-400">
                                      {notification.created_at ? new Date(notification.created_at).toLocaleDateString() : ""}
                                    </div>
                                  </div>
                                  <p className="mt-1 break-words text-xs leading-5 text-slate-600">{notification.message}</p>
                                  {action?.steps ? (
                                    <div className="mt-2 rounded-md bg-white/85 px-2.5 py-2 text-[0.72rem] font-semibold leading-4 text-slate-600">
                                      {action.steps}
                                    </div>
                                  ) : null}
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {action ? (
                                      <Link
                                        className="rounded-md bg-brand-600 px-3 py-1.5 text-center text-xs font-bold text-white shadow-sm"
                                        onClick={() => setShowNotifications(false)}
                                        to={action.to}
                                      >
                                        {action.label}
                                      </Link>
                                    ) : null}
                                    {!notification.is_read ? (
                                      <button
                                        className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-sm ring-1 ring-brand-100"
                                        onClick={() => markNotificationRead(notification.id)}
                                        type="button"
                                      >
                                        Mark read
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="rounded-md bg-slate-50 px-3 py-4 text-sm text-slate-500">No notifications yet.</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Button variant="secondary" onClick={logout}>
                Sign out
              </Button>
            </div>
          </div>
          <div className="mt-4 lg:hidden">
            <button
              className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-800 shadow-sm"
              onClick={() => setShowMobileNav((current) => !current)}
              type="button"
            >
              <span>Menu</span>
              <span className="text-lg leading-none">{showMobileNav ? "×" : "☰"}</span>
            </button>
            {showMobileNav ? (
              <nav className="mt-3 max-h-[58vh] overflow-y-auto rounded-md border border-slate-200 bg-white p-3 shadow-xl">
                {Object.entries(groupedNavItems).map(([group, items]) => (
                  <div className="mb-4 last:mb-0" key={group}>
                    <div className="mb-2 px-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-slate-400">{group}</div>
                    <div className="grid gap-1">
                      {items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === "/"}
                          onClick={closeMobileNav}
                          className={({ isActive }) =>
                            `rounded-md border-l-4 px-3 py-2.5 text-sm font-black transition ${
                              isActive ? "border-brand-700 bg-brand-600 text-white" : "border-transparent bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-800"
                            }`
                          }
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span>{item.label}</span>
                            {badges[item.badge] ? (
                              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[0.65rem] font-black leading-none text-white">
                                {badges[item.badge]}
                              </span>
                            ) : null}
                          </span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            ) : null}
          </div>
        </header>
        <main className="px-5 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
