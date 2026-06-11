import { useState } from "react";

import { createResource, updateResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatCard } from "../../components/ui/StatCard.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { todayDate } from "../../lib/today.js";

const initialPromiseForm = {
  tenant: "",
  rent_charge: "",
  promised_amount: "",
  promised_date: todayDate(),
  note: "",
};

function daysSince(dateValue) {
  if (!dateValue) return 0;
  const then = new Date(dateValue);
  const now = new Date();
  return Math.max(0, Math.floor((now - then) / 86400000));
}

export function FollowUpPage() {
  const charges = useResourceList("/rent-charges/");
  const claims = useResourceList("/payment-claims/");
  const cash = useResourceList("/cash-collections/");
  const promises = useResourceList("/promises-to-pay/");
  const [promiseForm, setPromiseForm] = useState(initialPromiseForm);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openPromises = promises.rows.filter((promise) => promise.status === "open");
  const followRows = charges.rows
    .filter((charge) => Number(charge.balance || 0) > 0)
    .map((charge) => {
      const tenantClaims = claims.rows.filter((claim) => Number(claim.rent_charge) === Number(charge.id) && claim.status === "pending");
      const tenantCash = cash.rows.filter((collection) => Number(collection.rent_charge) === Number(charge.id) && ["pending_handover", "handed_over"].includes(collection.status));
      const promise = openPromises.find((row) => Number(row.rent_charge) === Number(charge.id));
      const state = tenantClaims.length
        ? "claim_pending"
        : tenantCash.length
          ? "cash_pending"
          : promise
            ? "promised"
            : charge.status;
      return {
        ...charge,
        follow_status: state,
        promised_date: promise?.promised_date || "",
        promised_amount: promise?.promised_amount || "",
        promise_id: promise?.id || null,
        cash_age_days: tenantCash.length ? Math.max(...tenantCash.map((collection) => daysSince(collection.collection_date))) : 0,
      };
    });
  const cashAgingRows = cash.rows
    .filter((collection) => ["pending_handover", "handed_over"].includes(collection.status))
    .map((collection) => ({ ...collection, age_days: daysSince(collection.collection_date) }));

  function updatePromise(field, value) {
    setPromiseForm((current) => ({ ...current, [field]: value }));
  }

  function selectCharge(chargeId) {
    const charge = charges.rows.find((row) => String(row.id) === String(chargeId));
    setPromiseForm((current) => ({
      ...current,
      rent_charge: chargeId,
      tenant: charge?.tenant || "",
      promised_amount: charge?.balance || current.promised_amount,
    }));
  }

  async function createPromise(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      await createResource("/promises-to-pay/", promiseForm);
      setPromiseForm(initialPromiseForm);
      promises.refetch();
      setMessage({ type: "success", text: "Promise to pay recorded." });
    } catch {
      setMessage({ type: "error", text: "Could not record promise. Choose a charge, amount, and date." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function markPromise(row, status) {
    if (!row.promise_id) return;
    await updateResource(`/promises-to-pay/${row.promise_id}/`, { status });
    promises.refetch();
  }

  const followColumns = [
    { key: "tenant_name", label: "Tenant" },
    { key: "unit_label", label: "Unit" },
    { key: "billing_month", label: "Month" },
    { key: "balance", label: "Balance", render: (row) => formatCurrency(row.balance) },
    { key: "follow_status", label: "Follow-up", render: (row) => <StatusBadge value={row.follow_status} /> },
    { key: "promised_date", label: "Promise Date" },
    { key: "actions", label: "Actions", render: (row) => row.promise_id ? (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => markPromise(row, "kept")}>Kept</Button>
        <Button variant="secondary" onClick={() => markPromise(row, "missed")}>Missed</Button>
      </div>
    ) : "-" },
  ];
  const cashColumns = [
    { key: "tenant_name", label: "Tenant" },
    { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "collection_date", label: "Collected" },
    { key: "age_days", label: "Days Pending" },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];

  return (
    <>
      <PageHeader title="Collection Follow-up" description="Monthly rent follow-up checklist for unpaid, partial, promised, claim-pending, and cash-pending tenants." />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Needs follow-up" value={followRows.length} detail="Open balances" tone="amber" />
        <StatCard label="Promises" value={openPromises.length} detail="Open promises" />
        <StatCard label="Cash pending" value={cashAgingRows.length} detail="Not confirmed" tone="amber" />
        <StatCard label="Oldest cash" value={`${Math.max(0, ...cashAgingRows.map((row) => row.age_days))} days`} detail="Handover aging" />
      </div>
      <FormPanel title="Record promise to pay" description="Use this when a tenant says they will pay later, so nobody forgets the follow-up.">
        <form onSubmit={createPromise}>
          <div className="grid gap-4 md:grid-cols-4">
            <SelectInput label="Rent charge" value={promiseForm.rent_charge} onChange={(event) => selectCharge(event.target.value)} required>
              <option value="">Choose balance</option>
              {charges.rows.filter((charge) => Number(charge.balance || 0) > 0).map((charge) => (
                <option key={charge.id} value={charge.id}>{charge.tenant_name} - {charge.unit_label} - {formatCurrency(charge.balance)}</option>
              ))}
            </SelectInput>
            <TextInput label="Tenant ID" value={promiseForm.tenant} onChange={(event) => updatePromise("tenant", event.target.value)} required />
            <TextInput label="Promised amount" type="number" min="1" value={promiseForm.promised_amount} onChange={(event) => updatePromise("promised_amount", event.target.value)} required />
            <TextInput label="Promised date" type="date" value={promiseForm.promised_date} onChange={(event) => updatePromise("promised_date", event.target.value)} required />
            <TextInput label="Note" value={promiseForm.note} onChange={(event) => updatePromise("note", event.target.value)} />
          </div>
          <FormMessage message={message} />
          <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save promise"}</Button>
        </form>
      </FormPanel>
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Follow-up Checklist</h2>
        <DataTable columns={followColumns} rows={followRows} emptyMessage="No tenants need rent follow-up right now." sortBy="billing_month" sortDirection="desc" />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Cash Handover Aging</h2>
        <DataTable columns={cashColumns} rows={cashAgingRows} emptyMessage="No pending cash handovers." sortBy="age_days" sortDirection="desc" />
      </section>
    </>
  );
}
