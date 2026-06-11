import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatCard } from "../../components/ui/StatCard.jsx";
import { ChartPanel, DonutChart, LineChart, MiniBarChart, ProgressBar } from "../../components/ui/Visuals.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { useAuth } from "../auth/AuthContext.jsx";

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const isCaretaker = user?.role_name === "caretaker";
  const [selectedPropertyId, setSelectedPropertyId] = useState("all");
  const liveOptions = { pollMs: 10000 };
  const properties = useResourceList("/properties/", true, liveOptions);
  const units = useResourceList("/units/", true, liveOptions);
  const tenants = useResourceList("/tenants/", true, liveOptions);
  const leases = useResourceList("/leases/", true, liveOptions);
  const payments = useResourceList("/payments/", true, liveOptions);
  const charges = useResourceList("/rent-charges/", true, liveOptions);
  const utilityCharges = useResourceList("/utility-charges/", true, liveOptions);
  const maintenance = useResourceList("/maintenance-requests/", true, liveOptions);
  const claims = useResourceList("/payment-claims/", true, liveOptions);
  const collections = useResourceList("/cash-collections/", true, liveOptions);
  const selectedProperty = selectedPropertyId === "all" ? null : properties.rows.find((property) => String(property.id) === String(selectedPropertyId));
  const propertyUnits = selectedProperty ? units.rows.filter((unit) => Number(unit.property) === Number(selectedProperty.id)) : units.rows;
  const propertyCharges = selectedProperty ? charges.rows.filter((charge) => Number(charge.property) === Number(selectedProperty.id)) : charges.rows;
  const propertyUnitIds = new Set(propertyUnits.map((unit) => Number(unit.id)));
  const propertyLeases = selectedProperty ? leases.rows.filter((lease) => propertyUnitIds.has(Number(lease.unit))) : leases.rows;
  const propertyLeaseIds = new Set(propertyLeases.map((lease) => Number(lease.id)));
  const propertyUtilities = selectedProperty ? utilityCharges.rows.filter((charge) => Number(charge.property) === Number(selectedProperty.id)) : utilityCharges.rows;
  const propertyMaintenance = selectedProperty ? maintenance.rows.filter((row) => Number(row.property) === Number(selectedProperty.id)) : maintenance.rows;
  const propertyPayments = selectedProperty
    ? payments.rows.filter((payment) => propertyCharges.some((charge) => Number(charge.id) === Number(payment.rent_charge)))
    : payments.rows;

  useEffect(() => {
    if (isCaretaker && properties.rows.length && selectedPropertyId === "all") {
      setSelectedPropertyId(String(properties.rows[0].id));
    }
  }, [isCaretaker, properties.rows, selectedPropertyId]);

  const totalCollected = propertyPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const totalExpected = propertyCharges.reduce((sum, charge) => sum + Number(charge.amount || 0) + Number(charge.late_fee_amount || 0), 0);
  const totalBalance = propertyCharges.reduce((sum, charge) => sum + Number(charge.balance || 0), 0);
  const utilitiesExpected = propertyUtilities.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
  const utilitiesPaid = propertyUtilities.reduce((sum, charge) => sum + Number(charge.amount_paid || 0), 0);
  const utilitiesBalance = propertyUtilities.reduce((sum, charge) => sum + Number(charge.balance || 0), 0);
  const propertyTenantIds = new Set([
    ...propertyLeases.map((lease) => Number(lease.tenant)),
    ...propertyCharges.map((charge) => Number(charge.tenant)),
    ...propertyPayments.map((payment) => Number(payment.tenant)),
  ]);
  const visibleTenantsCount = selectedProperty ? tenants.rows.filter((tenant) => propertyTenantIds.has(Number(tenant.id))).length : tenants.rows.length;
  const occupiedUnits = propertyUnits.filter((unit) => unit.status === "occupied").length;
  const vacantUnits = propertyUnits.filter((unit) => unit.status === "vacant").length;
  const maintenanceUnits = propertyUnits.filter((unit) => unit.status === "maintenance").length;
  const openMaintenance = propertyMaintenance.filter((row) => !["resolved", "closed"].includes(row.status)).length;
  const pendingClaims = claims.rows.filter((claim) => claim.status === "pending" && (!selectedProperty || propertyLeaseIds.has(Number(claim.lease))));
  const pendingCollections = collections.rows.filter((collection) => ["pending_handover", "handed_over"].includes(collection.status) && (!selectedProperty || propertyLeaseIds.has(Number(collection.lease))));
  const maintenanceApprovals = propertyMaintenance.filter((row) => ["awaiting_approval", "resolved"].includes(row.status));
  const pendingClaimAmount = pendingClaims.reduce((sum, claim) => sum + Number(claim.amount_claimed || 0), 0);
  const pendingCollectionAmount = pendingCollections.reduce((sum, collection) => sum + Number(collection.amount || 0), 0);
  const pendingAmount = pendingClaimAmount + pendingCollectionAmount;
  const totalActionCount = pendingClaims.length + pendingCollections.length + maintenanceApprovals.length;
  const now = new Date();
  const monthTrendRows = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const monthKey = monthKeyFromDate(date);
    return {
      id: monthKey,
      monthKey,
      label: date.toLocaleDateString("en-KE", { month: "short" }),
      total: propertyPayments
        .filter((payment) => String(payment.payment_date || "").slice(0, 7) === monthKey)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    };
  });
  const unitTypeRows = Object.values(propertyUnits.reduce((groups, unit) => {
    const key = unit.unit_type || "other";
    groups[key] = groups[key] || { id: key, name: key.replaceAll("_", " "), total: 0 };
    groups[key].total += 1;
    return groups;
  }, {}));
  const unitStatusRows = [
    { id: "occupied", name: "Occupied", total: occupiedUnits },
    { id: "vacant", name: "Vacant", total: vacantUnits },
    { id: "maintenance", name: "Under maintenance", total: maintenanceUnits },
  ].filter((row) => row.total > 0);
  const rentStatusRows = ["paid", "partial", "overdue", "unpaid"].map((status) => ({
    id: status,
    name: status,
    total: propertyCharges.filter((charge) => charge.status === status).length,
  })).filter((row) => row.total > 0);
  const utilityRows = Object.values(propertyUtilities.reduce((groups, charge) => {
    const key = charge.utility_type || "other";
    groups[key] = groups[key] || { id: key, name: key.replaceAll("_", " "), total: 0 };
    groups[key].total += Number(charge.balance || 0);
    return groups;
  }, {})).filter((row) => row.total > 0);

  if (isCaretaker) {
    const caretakerClaims = claims.rows.filter((claim) => claim.status === "pending");
    const caretakerCash = collections.rows.filter((collection) => ["pending_handover", "handed_over"].includes(collection.status));
    const caretakerMaintenance = propertyMaintenance.filter((row) => ["open", "approved", "in_progress", "awaiting_approval"].includes(row.status));
    const followUpCharges = propertyCharges.filter((charge) => Number(charge.balance || 0) > 0);

    return (
      <>
        <PageHeader
          title="Caretaker Dashboard"
          description="Your assigned properties, rent follow-up, payment submissions, and maintenance work."
        />
        <div className="mb-6 max-w-sm">
          <SelectInput label="Assigned property" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
            {properties.rows.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </SelectInput>
        </div>
        <section className="rounded-md border border-brand-100 bg-brand-50 p-4 shadow-sm">
          <h2 className="text-lg font-black text-brand-950">Your Work Today</h2>
          <p className="mt-1 text-sm text-brand-800">Focus on tenants to follow up, payment evidence to submit, cash handovers, and maintenance movement.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <StatCard label="Follow-ups" value={followUpCharges.length} detail="Tenants with open balances" tone={followUpCharges.length ? "amber" : "default"} />
            <StatCard label="Payment Claims" value={caretakerClaims.length} detail="Waiting landlord verification" tone={caretakerClaims.length ? "amber" : "default"} />
            <StatCard label="Cash Pending" value={caretakerCash.length} detail="Needs handover/confirmation" tone={caretakerCash.length ? "amber" : "default"} />
            <StatCard label="Maintenance" value={caretakerMaintenance.length} detail="Open assigned work" tone={caretakerMaintenance.length ? "amber" : "default"} />
          </div>
        </section>
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <ChartPanel title="Unit Status" description="Assigned property occupancy only.">
            {unitStatusRows.length ? (
              <DonutChart rows={unitStatusRows} labelKey="name" valueKey="total" />
            ) : (
              <p className="text-sm text-slate-500">No units assigned yet.</p>
            )}
          </ChartPanel>
          <ChartPanel title="Follow-up Status" description="Open rent balances by state. Amounts are tenant balances, not landlord income.">
            {rentStatusRows.length ? (
              <DonutChart rows={rentStatusRows} labelKey="name" valueKey="total" />
            ) : (
              <p className="text-sm text-slate-500">No rent follow-ups right now.</p>
            )}
          </ChartPanel>
        </div>
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          <ChartPanel title="Maintenance Snapshot" description="Requests that still need caretaker movement.">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Open" value={caretakerMaintenance.filter((row) => row.status === "open").length} detail="New requests" />
              <StatCard label="Approved" value={caretakerMaintenance.filter((row) => row.status === "approved").length} detail="Can start work" />
              <StatCard label="In Progress" value={caretakerMaintenance.filter((row) => row.status === "in_progress").length} detail="Ongoing" />
            </div>
            <Link className="mt-4 inline-flex rounded-md bg-brand-600 px-4 py-2 text-sm font-bold text-white" to="/maintenance">Open maintenance</Link>
          </ChartPanel>
          <ChartPanel title="Next Actions" description="Operational shortcuts.">
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-md bg-brand-600 px-4 py-2 text-sm font-bold text-white" to="/follow-up">Open follow-up</Link>
              <Link className="rounded-md bg-amber-600 px-4 py-2 text-sm font-bold text-white" to="/payment-claims">Submit payment claim</Link>
              <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm font-bold text-white" to="/cash-collections">Record cash</Link>
              <Link className="rounded-md bg-slate-200 px-4 py-2 text-sm font-bold text-slate-800" to="/tenants">Add tenant</Link>
            </div>
          </ChartPanel>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={selectedProperty ? `${selectedProperty.name} Dashboard` : "All Properties Dashboard"}
        description={selectedProperty ? "Focused view for this property only." : "Combined view across all properties, units, tenants, and rent collection."}
      />
      <div className="mb-6 max-w-sm">
        <SelectInput label="Dashboard property" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
          <option value="all">All properties</option>
          {properties.rows.map((property) => (
            <option key={property.id} value={property.id}>{property.name}</option>
          ))}
        </SelectInput>
      </div>
      {!properties.rows.length ? (
        <div className="mb-6 rounded-md border border-brand-100 bg-brand-50 p-5">
          <h2 className="text-lg font-semibold text-brand-950">Start with your property</h2>
          <p className="mt-2 text-sm text-brand-800">
            Add the building first, then add units, tenants, and leases. Rent charges will be created automatically when leases are added.
          </p>
        </div>
      ) : null}
      <section className={`rounded-md border p-4 shadow-sm ${totalActionCount ? "border-amber-200 bg-amber-50" : "border-brand-100 bg-brand-50"}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className={`text-lg font-black ${totalActionCount ? "text-amber-950" : "text-brand-950"}`}>Action Required</h2>
            <p className={`mt-1 text-sm ${totalActionCount ? "text-amber-800" : "text-brand-800"}`}>
              {totalActionCount
                ? `${totalActionCount} item(s) need landlord action: payment verification, cash confirmation, or maintenance approval.`
                : "No pending approvals right now."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[560px]">
            <StatCard label="Payment Claims" value={pendingClaims.length} detail={formatCurrency(pendingClaimAmount)} tone={pendingClaims.length ? "amber" : "default"} />
            <StatCard label="Cash Confirmations" value={pendingCollections.length} detail={formatCurrency(pendingCollectionAmount)} tone={pendingCollections.length ? "amber" : "default"} />
            <StatCard label="Maintenance" value={maintenanceApprovals.length} detail="Approval or close needed" tone={maintenanceApprovals.length ? "amber" : "default"} />
          </div>
        </div>
        {totalActionCount ? (
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {pendingClaims.slice(0, 3).map((claim) => (
              <div key={`claim-${claim.id}`} className="rounded-md border border-amber-200 bg-white p-3">
                <div className="text-xs font-black uppercase tracking-wide text-amber-700">Payment claim</div>
                <div className="mt-1 font-black text-slate-950">{claim.tenant_name}</div>
                <div className="text-sm text-slate-600">{formatCurrency(claim.amount_claimed)} - {claim.confirmation_code}</div>
                <Link className="mt-3 inline-flex rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white" to="/verification">Review payment</Link>
              </div>
            ))}
            {pendingCollections.slice(0, 3).map((collection) => (
              <div key={`cash-${collection.id}`} className="rounded-md border border-amber-200 bg-white p-3">
                <div className="text-xs font-black uppercase tracking-wide text-amber-700">Cash collection</div>
                <div className="mt-1 font-black text-slate-950">{collection.tenant_name}</div>
                <div className="text-sm text-slate-600">{formatCurrency(collection.amount)} - {collection.provisional_receipt_number}</div>
                <Link className="mt-3 inline-flex rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white" to="/verification">Confirm cash</Link>
              </div>
            ))}
            {maintenanceApprovals.slice(0, 3).map((request) => (
              <div key={`maintenance-${request.id}`} className="rounded-md border border-amber-200 bg-white p-3">
                <div className="text-xs font-black uppercase tracking-wide text-amber-700">Maintenance</div>
                <div className="mt-1 font-black text-slate-950">{request.title}</div>
                <div className="text-sm text-slate-600">{request.unit_label} - {request.status.replaceAll("_", " ")}</div>
                <Link className="mt-3 inline-flex rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white" to="/maintenance">Review request</Link>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Units" value={propertyUnits.length} detail={`${occupiedUnits} occupied`} tone="brand" meta="Portfolio" />
        <StatCard label="Vacant" value={vacantUnits} detail="Available units" tone="sky" meta="Occupancy" />
        <StatCard label="Tenants" value={visibleTenantsCount} detail="Registered tenants" meta="Active" />
        <StatCard label="Collections" value={formatCurrency(totalCollected)} detail="Recorded rent payments" tone="brand" meta="KES" />
      </div>
      {(pendingClaims.length || pendingCollections.length) ? (
        <section className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-amber-950">Pending Payment Verification</h2>
              <p className="mt-1 text-sm text-amber-800">
                {pendingClaims.length} M-Pesa/bank claim(s), {pendingCollections.length} cash collection(s), total {formatCurrency(pendingAmount)} waiting for landlord action.
              </p>
            </div>
            <Link
              className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              to="/verification"
            >
              Review payments
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <StatCard label="M-Pesa/Bank Claims" value={pendingClaims.length} detail={formatCurrency(pendingClaimAmount)} tone="amber" />
            <StatCard label="Cash Collections" value={pendingCollections.length} detail={formatCurrency(pendingCollectionAmount)} tone="amber" />
            <StatCard label="Pending Amount" value={formatCurrency(pendingAmount)} detail="Awaiting confirmation" tone="amber" />
          </div>
        </section>
      ) : null}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Rent Collection" description={`${formatCurrency(totalBalance)} still outstanding.`}>
          <ProgressBar label="Collected vs expected" value={totalCollected} total={totalExpected} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard label="Expected" value={formatCurrency(totalExpected)} detail="Billed rent" tone="sky" />
            <StatCard label="Collected" value={formatCurrency(totalCollected)} detail="Confirmed payments" tone="brand" />
            <StatCard label="Open Issues" value={openMaintenance} detail="Maintenance pending" tone={openMaintenance ? "amber" : "default"} />
          </div>
        </ChartPanel>
        <ChartPanel title="6-Month Rent Trend" description="Confirmed rent collected over the last six months.">
          <LineChart rows={monthTrendRows} labelKey="label" valueKey="total" formatter={formatCurrency} />
        </ChartPanel>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Unit Status" description="Current occupancy picture.">
          {unitStatusRows.length ? (
            <DonutChart rows={unitStatusRows} labelKey="name" valueKey="total" />
          ) : (
            <p className="text-sm text-slate-500">No units added yet.</p>
          )}
        </ChartPanel>
        <ChartPanel title="Rent Status" description="Monthly rent charges by payment state.">
          {rentStatusRows.length ? (
            <DonutChart rows={rentStatusRows} labelKey="name" valueKey="total" />
          ) : (
            <p className="text-sm text-slate-500">No rent charges yet.</p>
          )}
        </ChartPanel>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Unit Categories" description="How this property is split across shops, bedsitters, and bedrooms.">
          {unitTypeRows.length ? (
            <MiniBarChart rows={unitTypeRows} labelKey="name" valueKey="total" />
          ) : (
            <p className="text-sm text-slate-500">No units added yet.</p>
          )}
        </ChartPanel>
        <ChartPanel title="Utilities" description="Optional separate charges for water, electricity, garbage, security, service fees, or other landlord-specific billing.">
          {propertyUtilities.length ? (
            <>
              <ProgressBar label="Utility charges paid" value={utilitiesPaid} total={utilitiesExpected} />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <StatCard label="Expected" value={formatCurrency(utilitiesExpected)} detail="Utility billing" tone="sky" />
                <StatCard label="Paid" value={formatCurrency(utilitiesPaid)} detail="Manually recorded" tone="brand" />
                <StatCard label="Balance" value={formatCurrency(utilitiesBalance)} detail="Utility arrears" tone={utilitiesBalance > 0 ? "amber" : "default"} />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">No separate utility charges. If this landlord includes utilities in rent, leave this module empty or turn it off in settings.</p>
          )}
        </ChartPanel>
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Utility Balances" description="Outstanding separate utility balances by category.">
          {utilityRows.length ? (
            <MiniBarChart rows={utilityRows} labelKey="name" valueKey="total" />
          ) : (
            <p className="text-sm text-slate-500">No utility balances to show.</p>
          )}
        </ChartPanel>
        <ChartPanel title="Maintenance Snapshot" description="Open requests that still need movement.">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Open" value={openMaintenance} detail="Not resolved" tone={openMaintenance ? "amber" : "default"} />
            <StatCard label="Occupied" value={occupiedUnits} detail="Active units" tone="brand" />
            <StatCard label="Vacant" value={vacantUnits} detail="Ready units" tone="sky" />
          </div>
        </ChartPanel>
      </div>
      {[properties, units, tenants, leases, payments, charges, utilityCharges, claims, collections].some((resource) => resource.error) ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some dashboard data could not be loaded yet. Add records in Django Admin or through APIs, then refresh.
        </div>
      ) : null}
    </>
  );
}
