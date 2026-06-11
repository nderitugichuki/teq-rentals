import { useState } from "react";

import { createResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { monthStartDate } from "../../lib/monthStart.js";
import { todayDate } from "../../lib/today.js";

const initialForm = {
  lease: "",
  utility_type: "water",
  billing_month: monthStartDate(),
  amount: "",
  amount_paid: "0",
  due_date: todayDate(),
  notes: "",
};

export function UtilitiesPage() {
  const charges = useResourceList("/utility-charges/");
  const leases = useResourceList("/leases/");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      await createResource("/utility-charges/", form);
      setForm(initialForm);
      charges.refetch();
      setMessage({ type: "success", text: "Utility charge created." });
    } catch {
      setMessage({ type: "error", text: "Could not create utility charge. Check lease, amount, and due date." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns = [
    { key: "tenant_name", label: "Tenant" },
    { key: "unit_label", label: "Unit" },
    { key: "utility_type", label: "Utility" },
    { key: "billing_month", label: "Month" },
    { key: "due_date", label: "Due Date" },
    { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "amount_paid", label: "Paid", render: (row) => formatCurrency(row.amount_paid) },
    { key: "balance", label: "Balance", render: (row) => formatCurrency(row.balance) },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Utilities"
        description="Optional utility billing for landlords who charge water, electricity, garbage, security, or service fees separately."
      />
      <FormPanel title="Add utility charge" description="Skip this module if utilities are already included in rent.">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-4">
            <SelectInput label="Lease" value={form.lease} onChange={(event) => updateField("lease", event.target.value)} required>
              <option value="">Choose lease</option>
              {leases.rows.map((lease) => (
                <option key={lease.id} value={lease.id}>{lease.tenant_name} - {lease.unit_label}</option>
              ))}
            </SelectInput>
            <SelectInput label="Utility" value={form.utility_type} onChange={(event) => updateField("utility_type", event.target.value)}>
              <option value="water">Water</option>
              <option value="electricity">Electricity</option>
              <option value="garbage">Garbage</option>
              <option value="security">Security</option>
              <option value="service_charge">Service Charge</option>
              <option value="other">Other</option>
            </SelectInput>
            <TextInput label="Billing month" type="date" value={form.billing_month} onChange={(event) => updateField("billing_month", event.target.value)} required />
            <TextInput label="Amount" type="number" min="1" value={form.amount} onChange={(event) => updateField("amount", event.target.value)} required />
            <TextInput label="Amount paid" type="number" min="0" value={form.amount_paid} onChange={(event) => updateField("amount_paid", event.target.value)} required />
            <TextInput label="Due date" type="date" value={form.due_date} onChange={(event) => updateField("due_date", event.target.value)} required />
            <TextInput label="Notes" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </div>
          <FormMessage message={message} />
          <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save utility charge"}</Button>
        </form>
      </FormPanel>
      <DataTable columns={columns} rows={charges.rows} emptyMessage="No utility charges yet." sortBy="billing_month" sortDirection="desc" />
    </>
  );
}
