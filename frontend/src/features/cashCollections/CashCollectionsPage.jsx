import { useState } from "react";

import { createResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TenantSearchInput } from "../../components/ui/TenantSearchInput.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";

const initialForm = {
  tenant: "",
  lease: "",
  rent_charge: "",
  amount: "",
  collection_date: new Date().toISOString().slice(0, 10),
};

export function CashCollectionsPage() {
  const collections = useResourceList("/cash-collections/");
  const tenants = useResourceList("/tenants/");
  const leases = useResourceList("/leases/");
  const charges = useResourceList("/rent-charges/");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function getActiveLeaseForTenant(tenantId) {
    return leases.rows.find((row) => String(row.tenant) === String(tenantId) && row.status === "active")
      || leases.rows.find((row) => String(row.tenant) === String(tenantId));
  }

  function getOldestOpenChargeForLease(leaseId) {
    return charges.rows
      .filter((row) => String(row.lease) === String(leaseId) && Number(row.balance || 0) > 0)
      .sort((a, b) => String(a.due_date || a.billing_month).localeCompare(String(b.due_date || b.billing_month)))[0];
  }

  function getLeaseLabel(leaseId) {
    const lease = leases.rows.find((row) => String(row.id) === String(leaseId));
    return lease ? `${lease.tenant_name} - ${lease.unit_label}` : "";
  }

  function handleTenantChange(tenantId) {
    const lease = getActiveLeaseForTenant(tenantId);
    const charge = getOldestOpenChargeForLease(lease?.id);
    setForm((current) => ({
      ...current,
      tenant: tenantId,
      lease: lease?.id || "",
      rent_charge: charge?.id || "",
      amount: current.amount || charge?.balance || "",
    }));
  }

  function handleChargeChange(chargeId) {
    const charge = charges.rows.find((row) => String(row.id) === String(chargeId));
    setForm((current) => ({
      ...current,
      rent_charge: chargeId,
      tenant: charge?.tenant || current.tenant,
      lease: charge?.lease || current.lease,
      amount: charge?.balance || current.amount,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      await createResource("/cash-collections/", {
        ...form,
        rent_charge: form.rent_charge || null,
      });
      setForm(initialForm);
      collections.refetch();
      setMessage("Cash collection recorded as pending confirmation.");
    } catch {
      setMessage("Could not record cash collection. Check the selected tenant and lease.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns = [
    { key: "tenant_name", label: "Tenant" },
    { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "provisional_receipt_number", label: "Provisional Receipt" },
    { key: "collection_date", label: "Date" },
    { key: "created_at", label: "Recorded", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];
  const leaseCharges = charges.rows.filter((charge) => {
    const matchesTenant = !form.tenant || String(charge.tenant) === String(form.tenant);
    const matchesLease = !form.lease || String(charge.lease) === String(form.lease);
    return matchesTenant && matchesLease && Number(charge.balance || 0) > 0;
  });

  return (
    <>
      <PageHeader title="Cash Collections" description="Record cash received by caretakers before landlord confirmation." />
      <form onSubmit={handleSubmit} className="mb-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <TenantSearchInput tenants={tenants.rows} value={form.tenant} onChange={handleTenantChange} required />
          <TextInput label="Linked lease" value={getLeaseLabel(form.lease) || "NO ACTIVE LEASE FOUND"} readOnly />
          <SelectInput label="Linked rent charge" value={form.rent_charge} onChange={(event) => handleChargeChange(event.target.value)}>
            <option value="">No linked charge</option>
            {leaseCharges.map((charge) => (
              <option key={charge.id} value={charge.id}>{charge.tenant_name} - {charge.billing_month} - balance {formatCurrency(charge.balance)}</option>
            ))}
          </SelectInput>
          <TextInput label="Amount" type="number" min="1" value={form.amount} onChange={(event) => updateField("amount", event.target.value)} required />
          <TextInput label="Collection date" type="date" value={form.collection_date} onChange={(event) => updateField("collection_date", event.target.value)} required />
        </div>
        {!leaseCharges.length && form.lease ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No unpaid rent charge found for this lease. Ask the landlord to generate monthly rent charges first.
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        <Button type="submit" className="mt-4" disabled={isSubmitting}>
          {isSubmitting ? "Recording..." : "Record cash"}
        </Button>
      </form>
      <DataTable columns={columns} rows={collections.rows} emptyMessage="No cash collections yet." sortBy="created_at" sortDirection="desc" />
    </>
  );
}
