import { useState } from "react";

import { createResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TenantSearchInput } from "../../components/ui/TenantSearchInput.jsx";
import { TextArea } from "../../components/ui/TextArea.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { parsePaymentMessage } from "../../lib/parsePaymentMessage.js";

const initialForm = {
  tenant: "",
  lease: "",
  rent_charge: "",
  amount_claimed: "",
  payment_method: "mpesa",
  confirmation_code: "",
  pasted_message: "",
  phone_number: "",
  bank_name: "",
  claimed_payment_date: new Date().toISOString().slice(0, 10),
};

export function PaymentClaimsPage() {
  const claims = useResourceList("/payment-claims/");
  const tenants = useResourceList("/tenants/");
  const leases = useResourceList("/leases/");
  const charges = useResourceList("/rent-charges/");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleTenantChange(tenantId) {
    setForm((current) => ({
      ...current,
      tenant: tenantId,
      lease: "",
      rent_charge: "",
    }));
  }

  function handleLeaseChange(leaseId) {
    const charge = charges.rows.find((row) => String(row.lease) === String(leaseId) && Number(row.balance || 0) > 0);
    setForm((current) => ({
      ...current,
      lease: leaseId,
      rent_charge: charge?.id || "",
      amount_claimed: current.amount_claimed || charge?.balance || "",
    }));
  }

  function handleChargeChange(chargeId) {
    const charge = charges.rows.find((row) => String(row.id) === String(chargeId));
    setForm((current) => ({
      ...current,
      rent_charge: chargeId,
      tenant: charge?.tenant || current.tenant,
      lease: charge?.lease || current.lease,
      amount_claimed: current.amount_claimed || charge?.balance || "",
    }));
  }

  function handlePastedMessage(value) {
    const parsed = parsePaymentMessage(value);
    setForm((current) => ({
      ...current,
      pasted_message: value,
      payment_method: parsed.method || current.payment_method,
      confirmation_code: parsed.reference || current.confirmation_code,
      amount_claimed: parsed.amount || current.amount_claimed,
      phone_number: parsed.phone || current.phone_number,
      bank_name: parsed.bankName || current.bank_name,
      claimed_payment_date: parsed.date || current.claimed_payment_date,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      await createResource("/payment-claims/", {
        ...form,
        rent_charge: form.rent_charge || null,
      });
      setForm(initialForm);
      claims.refetch();
      setMessage("Payment claim submitted for verification.");
    } catch {
      setMessage("Could not submit the payment claim. Check the selected tenant, lease, and reference code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns = [
    { key: "tenant_name", label: "Tenant" },
    { key: "amount_claimed", label: "Amount", render: (row) => formatCurrency(row.amount_claimed) },
    { key: "payment_method", label: "Method" },
    { key: "confirmation_code", label: "Code" },
    { key: "claimed_payment_date", label: "Payment Date" },
    { key: "created_at", label: "Submitted", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];
  const tenantLeases = leases.rows.filter((lease) => !form.tenant || String(lease.tenant) === String(form.tenant));
  const leaseCharges = charges.rows.filter((charge) => {
    const matchesTenant = !form.tenant || String(charge.tenant) === String(form.tenant);
    const matchesLease = !form.lease || String(charge.lease) === String(form.lease);
    return matchesTenant && matchesLease && Number(charge.balance || 0) > 0;
  });

  return (
    <>
      <PageHeader
        title="Payment Claims"
        description="Caretakers can capture M-Pesa or bank confirmation codes for landlord verification."
      />
      <form onSubmit={handleSubmit} className="mb-6 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <TenantSearchInput tenants={tenants.rows} value={form.tenant} onChange={handleTenantChange} required />
          <SelectInput label="Lease" value={form.lease} onChange={(event) => handleLeaseChange(event.target.value)} required>
            <option value="">Choose lease</option>
            {tenantLeases.map((lease) => (
              <option key={lease.id} value={lease.id}>{lease.tenant_name} - {lease.unit_label}</option>
            ))}
          </SelectInput>
          <SelectInput label="Rent charge" value={form.rent_charge} onChange={(event) => handleChargeChange(event.target.value)}>
            <option value="">No linked charge</option>
            {leaseCharges.map((charge) => (
              <option key={charge.id} value={charge.id}>{charge.tenant_name} - {charge.billing_month} - balance {formatCurrency(charge.balance)}</option>
            ))}
          </SelectInput>
          <TextInput label="Amount claimed" type="number" min="1" value={form.amount_claimed} onChange={(event) => updateField("amount_claimed", event.target.value)} required />
          <SelectInput label="Method" value={form.payment_method} onChange={(event) => updateField("payment_method", event.target.value)}>
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank</option>
          </SelectInput>
          <TextInput label="Confirmation code" uppercase={false} value={form.confirmation_code} onChange={(event) => updateField("confirmation_code", event.target.value)} required />
          <TextInput label="Payment date" type="date" value={form.claimed_payment_date} onChange={(event) => updateField("claimed_payment_date", event.target.value)} required />
          {form.payment_method === "mpesa" ? (
            <TextInput label="M-Pesa phone" value={form.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} />
          ) : null}
          {form.payment_method === "bank" ? (
            <TextInput label="Bank name" value={form.bank_name} onChange={(event) => updateField("bank_name", event.target.value)} />
          ) : null}
        </div>
        <div className="mt-4">
          <TextArea
            label="Paste full M-Pesa or bank message"
            uppercase={false}
            value={form.pasted_message}
            onChange={(event) => handlePastedMessage(event.target.value)}
          />
          <p className="mt-2 text-xs text-slate-500">
            The system extracts reference, amount, phone, date, and method where possible. Keep the full message here as evidence.
          </p>
        </div>
        {!leaseCharges.length && form.lease ? (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No unpaid rent charge found for this lease. Ask the landlord to generate monthly rent charges first.
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        <Button type="submit" className="mt-4" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit claim"}
        </Button>
      </form>
      <DataTable columns={columns} rows={claims.rows} emptyMessage="No payment claims yet." sortBy="created_at" sortDirection="desc" />
    </>
  );
}
