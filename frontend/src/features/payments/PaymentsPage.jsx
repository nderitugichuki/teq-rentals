import { useState } from "react";

import { createResource, postAction } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TenantSearchInput } from "../../components/ui/TenantSearchInput.jsx";
import { TextArea } from "../../components/ui/TextArea.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { monthStartDate } from "../../lib/monthStart.js";
import { parsePaymentMessage } from "../../lib/parsePaymentMessage.js";
import { todayDate } from "../../lib/today.js";

const initialChargeForm = {
  lease: "",
  tenant: "",
  unit: "",
  property: "",
  billing_month: monthStartDate(),
  amount: "",
  amount_paid: "0",
  due_date: todayDate(),
};

const initialPaymentForm = {
  tenant: "",
  lease: "",
  rent_charge: "",
  amount: "",
  payment_method: "mpesa",
  reference_number: "",
  mpesa_phone_number: "",
  bank_name: "",
  payment_date: todayDate(),
  notes: "",
  pasted_message: "",
};

export function PaymentsPage() {
  const { user } = useAuth();
  const { rows, isLoading, error, refetch } = useResourceList("/payments/");
  const leases = useResourceList("/leases/");
  const tenants = useResourceList("/tenants/");
  const units = useResourceList("/units/");
  const charges = useResourceList("/rent-charges/");
  const [chargeForm, setChargeForm] = useState(initialChargeForm);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [chargeMessage, setChargeMessage] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState(null);
  const [isSavingCharge, setIsSavingCharge] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isGeneratingCharges, setIsGeneratingCharges] = useState(false);
  const [chargeStatusFilter, setChargeStatusFilter] = useState("all");
  const canManageMoney = user?.role_name === "admin" || user?.role_name === "landlord";

  function updateCharge(field, value) {
    setChargeForm((current) => ({ ...current, [field]: value }));
  }

  function updatePayment(field, value) {
    setPaymentForm((current) => ({ ...current, [field]: value }));
  }

  function getActiveLeaseForTenant(tenantId) {
    return leases.rows.find((row) => String(row.tenant) === String(tenantId) && row.status === "active")
      || leases.rows.find((row) => String(row.tenant) === String(tenantId));
  }

  function getUnitForLease(lease) {
    return units.rows.find((row) => String(row.id) === String(lease?.unit));
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

  function getChargeLabel(chargeId) {
    const charge = charges.rows.find((row) => String(row.id) === String(chargeId));
    return charge ? `${charge.billing_month} - balance ${formatCurrency(charge.balance)}` : "";
  }

  function handleChargeTenantChange(tenantId) {
    const lease = getActiveLeaseForTenant(tenantId);
    const unit = getUnitForLease(lease);
    setChargeForm((current) => ({
      ...current,
      tenant: tenantId,
      lease: lease?.id || "",
      unit: lease?.unit || "",
      property: unit?.property || current.property,
      amount: lease?.rent_amount || current.amount,
    }));
  }

  function handlePaymentChargeChange(chargeId) {
    const charge = charges.rows.find((row) => String(row.id) === String(chargeId));
    setPaymentForm((current) => ({
      ...current,
      rent_charge: chargeId,
      tenant: charge?.tenant || current.tenant,
      lease: charge?.lease || current.lease,
      amount: current.amount || charge?.balance || "",
    }));
  }

  function handlePaymentTenantChange(tenantId) {
    const lease = getActiveLeaseForTenant(tenantId);
    const charge = getOldestOpenChargeForLease(lease?.id);
    setPaymentForm((current) => ({
      ...current,
      tenant: tenantId,
      lease: lease?.id || "",
      rent_charge: charge?.id || "",
      amount: current.amount || charge?.balance || "",
    }));
  }

  function handlePastedPaymentMessage(value) {
    const parsed = parsePaymentMessage(value);
    setPaymentForm((current) => ({
      ...current,
      pasted_message: value,
      payment_method: parsed.method || current.payment_method,
      reference_number: parsed.reference || current.reference_number,
      amount: parsed.amount || current.amount,
      mpesa_phone_number: parsed.phone || current.mpesa_phone_number,
      bank_name: parsed.bankName || current.bank_name,
      payment_date: parsed.date || current.payment_date,
      notes: value || current.notes,
    }));
  }

  async function handleChargeSubmit(event) {
    event.preventDefault();
    setChargeMessage(null);
    setIsSavingCharge(true);

    try {
      await createResource("/rent-charges/", chargeForm);
      setChargeForm(initialChargeForm);
      charges.refetch();
      setChargeMessage({ type: "success", text: "Rent charge created." });
    } catch {
      setChargeMessage({ type: "error", text: "Could not create rent charge. Make sure all linked fields match the lease." });
    } finally {
      setIsSavingCharge(false);
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    setPaymentMessage(null);
    setIsSavingPayment(true);

    try {
      const { pasted_message: _pastedMessage, ...payload } = paymentForm;
      await createResource("/payments/", {
        ...payload,
        rent_charge: paymentForm.rent_charge || null,
      });
      setPaymentForm(initialPaymentForm);
      refetch();
      charges.refetch();
      setPaymentMessage({ type: "success", text: "Payment recorded and linked charge updated." });
    } catch {
      setPaymentMessage({ type: "error", text: "Could not record payment. Check the tenant, lease, amount, and charge." });
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function generateCurrentMonthCharges() {
    setChargeMessage(null);
    setIsGeneratingCharges(true);
    try {
      const result = await postAction("/rent-charges/generate_current_month/");
      charges.refetch();
      setChargeMessage({ type: "success", text: `${result.created} rent charge(s) generated for the current month.` });
    } catch {
      setChargeMessage({ type: "error", text: "Could not generate rent charges. Check active leases first." });
    } finally {
      setIsGeneratingCharges(false);
    }
  }

  const columns = [
    { key: "row_number", label: "No.", sortable: false, render: (_row, index) => index + 1 },
    { key: "tenant_name", label: "Tenant" },
    { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "payment_method", label: "Method" },
    { key: "reference_number", label: "Reference" },
    { key: "receipt_number", label: "Receipt" },
    { key: "payment_date", label: "Payment Date" },
    { key: "created_at", label: "Recorded", render: (row) => new Date(row.created_at).toLocaleString() },
  ];

  const chargeColumns = [
    { key: "tenant_name", label: "Tenant" },
    { key: "billing_month", label: "Month" },
    { key: "due_date", label: "Due Date" },
    { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "amount_paid", label: "Paid", render: (row) => formatCurrency(row.amount_paid) },
    { key: "balance", label: "Balance", render: (row) => formatCurrency(row.balance) },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];
  const visibleCharges = charges.rows.filter((charge) => {
    const totalDue = Number(charge.amount || 0) + Number(charge.late_fee_amount || 0);
    const amountPaid = Number(charge.amount_paid || 0);
    if (chargeStatusFilter === "all") return true;
    if (chargeStatusFilter === "overpaid") return amountPaid > totalDue;
    return charge.status === chargeStatusFilter;
  });
  const statusCounts = {
    paid: charges.rows.filter((charge) => charge.status === "paid").length,
    unpaid: charges.rows.filter((charge) => charge.status === "unpaid").length,
    partial: charges.rows.filter((charge) => charge.status === "partial").length,
    overdue: charges.rows.filter((charge) => charge.status === "overdue").length,
    overpaid: charges.rows.filter((charge) => Number(charge.amount_paid || 0) > Number(charge.amount || 0) + Number(charge.late_fee_amount || 0)).length,
  };
  const paymentCharges = charges.rows.filter((charge) => {
    const matchesTenant = !paymentForm.tenant || String(charge.tenant) === String(paymentForm.tenant);
    const matchesLease = !paymentForm.lease || String(charge.lease) === String(paymentForm.lease);
    return matchesTenant && matchesLease && Number(charge.balance || 0) > 0;
  });

  return (
    <>
      <PageHeader title="Payments" description="Rent collections and payment references." />
      {canManageMoney ? (
      <FormPanel title="Create rent charge" description="Create a monthly rent bill. Status and balance are auto calculated by system.">
        <div className="mb-4 rounded-md border border-brand-100 bg-brand-50 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-medium text-brand-800">Generate this month's rent charges automatically from all active leases.</p>
            <Button type="button" variant="secondary" onClick={generateCurrentMonthCharges} disabled={isGeneratingCharges}>
              {isGeneratingCharges ? "Generating..." : "Generate current month"}
            </Button>
          </div>
        </div>
        <form onSubmit={handleChargeSubmit}>
          <div className="grid gap-4 md:grid-cols-4">
            <TenantSearchInput tenants={tenants.rows} value={chargeForm.tenant} onChange={handleChargeTenantChange} required />
            <TextInput label="Linked lease" value={getLeaseLabel(chargeForm.lease) || "NO ACTIVE LEASE FOUND"} readOnly />
            <TextInput label="Linked unit" value={getUnitForLease(leases.rows.find((row) => String(row.id) === String(chargeForm.lease)))?.unit_number || ""} readOnly />
            <TextInput label="Billing month" type="date" value={chargeForm.billing_month} onChange={(event) => updateCharge("billing_month", event.target.value)} required />
            <TextInput label="Amount" type="number" min="1" value={chargeForm.amount} onChange={(event) => updateCharge("amount", event.target.value)} required />
            <TextInput label="Amount paid" type="number" min="0" value={chargeForm.amount_paid} onChange={(event) => updateCharge("amount_paid", event.target.value)} required />
            <TextInput label="Due date" type="date" value={chargeForm.due_date} onChange={(event) => updateCharge("due_date", event.target.value)} required />
          </div>
          <FormMessage message={chargeMessage} />
          <Button type="submit" className="mt-4" disabled={isSavingCharge}>{isSavingCharge ? "Saving..." : "Create charge"}</Button>
        </form>
      </FormPanel>
      ) : null}

      {canManageMoney ? (
      <FormPanel title="Record official payment" description="Record confirmed rent received by the landlord. Caretaker claims use Payment Claims or Cash Collections.">
        <form onSubmit={handlePaymentSubmit}>
          <div className="grid gap-4 md:grid-cols-4">
            <TenantSearchInput tenants={tenants.rows} value={paymentForm.tenant} onChange={handlePaymentTenantChange} required />
            <TextInput label="Linked lease" value={getLeaseLabel(paymentForm.lease) || "NO ACTIVE LEASE FOUND"} readOnly />
            <SelectInput label="Linked rent charge" value={paymentForm.rent_charge} onChange={(event) => handlePaymentChargeChange(event.target.value)}>
              <option value="">No linked charge</option>
              {paymentCharges.map((charge) => (
                <option key={charge.id} value={charge.id}>{charge.tenant_name} - {charge.billing_month} - {formatCurrency(charge.balance)}</option>
              ))}
            </SelectInput>
            <TextInput label="Amount" type="number" min="1" value={paymentForm.amount} onChange={(event) => updatePayment("amount", event.target.value)} required />
            <SelectInput label="Method" value={paymentForm.payment_method} onChange={(event) => updatePayment("payment_method", event.target.value)}>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </SelectInput>
            <TextInput label="Reference" uppercase={false} value={paymentForm.reference_number} onChange={(event) => updatePayment("reference_number", event.target.value)} />
            {paymentForm.payment_method === "mpesa" ? (
              <TextInput label="M-Pesa phone" value={paymentForm.mpesa_phone_number} onChange={(event) => updatePayment("mpesa_phone_number", event.target.value)} />
            ) : null}
            {paymentForm.payment_method === "bank" ? (
              <TextInput label="Bank name" value={paymentForm.bank_name} onChange={(event) => updatePayment("bank_name", event.target.value)} />
            ) : null}
            <TextInput label="Payment date" type="date" value={paymentForm.payment_date} onChange={(event) => updatePayment("payment_date", event.target.value)} required />
            <TextInput label="Notes" value={paymentForm.notes} onChange={(event) => updatePayment("notes", event.target.value)} />
          </div>
          {["mpesa", "bank"].includes(paymentForm.payment_method) ? (
            <div className="mt-4">
              <TextArea
                label="Paste full M-Pesa or bank message"
                uppercase={false}
                value={paymentForm.pasted_message}
                onChange={(event) => handlePastedPaymentMessage(event.target.value)}
              />
            </div>
          ) : null}
          <FormMessage message={paymentMessage} />
          <Button type="submit" className="mt-4" disabled={isSavingPayment}>{isSavingPayment ? "Saving..." : "Record payment"}</Button>
        </form>
      </FormPanel>
      ) : null}

      <section className="mb-8">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Rent Charges</h2>
            <p className="mt-1 text-sm text-slate-500">Filter tenants by payment status.</p>
          </div>
          <SelectInput label="Status filter" value={chargeStatusFilter} onChange={(event) => setChargeStatusFilter(event.target.value)}>
            <option value="all">All charges</option>
            <option value="paid">Paid ({statusCounts.paid})</option>
            <option value="unpaid">Unpaid ({statusCounts.unpaid})</option>
            <option value="partial">Partial ({statusCounts.partial})</option>
            <option value="overdue">Overdue ({statusCounts.overdue})</option>
            <option value="overpaid">Overpaid ({statusCounts.overpaid})</option>
          </SelectInput>
        </div>
        <DataTable columns={chargeColumns} rows={visibleCharges} emptyMessage="No rent charges match this filter." />
      </section>

      {isLoading ? <p className="text-sm text-slate-500">Loading payments...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!isLoading && !error ? <DataTable columns={columns} rows={rows} emptyMessage="No payments yet." sortBy="created_at" sortDirection="desc" /> : null}
    </>
  );
}
