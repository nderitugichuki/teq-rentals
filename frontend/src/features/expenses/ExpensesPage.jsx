import { useState } from "react";

import { createResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatCard } from "../../components/ui/StatCard.jsx";
import { TextArea } from "../../components/ui/TextArea.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { todayDate } from "../../lib/today.js";

const initialForm = {
  property: "",
  unit: "",
  category: "repairs",
  amount: "",
  expense_date: todayDate(),
  description: "",
};

export function ExpensesPage() {
  const { rows, isLoading, error, refetch } = useResourceList("/expenses/");
  const properties = useResourceList("/properties/");
  const units = useResourceList("/units/");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalExpenses = rows.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      await createResource("/expenses/", {
        ...form,
        unit: form.unit || null,
      });
      setForm(initialForm);
      refetch();
      setMessage({ type: "success", text: "Expense recorded." });
    } catch {
      setMessage({ type: "error", text: "Could not record expense. Make sure the unit belongs to the selected property." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns = [
    { key: "property_name", label: "Property" },
    { key: "unit_label", label: "Unit" },
    { key: "category", label: "Category" },
    { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "expense_date", label: "Date", sortValue: (row) => `${row.expense_date || ""} ${row.created_at || ""}` },
    { key: "recorded_by_email", label: "Recorded By" },
  ];

  return (
    <>
      <PageHeader title="Expenses" description="Track property costs like repairs, cleaning, utilities, security, and management fees." />
      <div className="mb-5 max-w-sm">
        <StatCard label="Total expenses" value={formatCurrency(totalExpenses)} detail={`${rows.length} expense record(s)`} />
      </div>
      <FormPanel title="Add expense" description="Record a property or unit-level cost.">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput label="Property" value={form.property} onChange={(event) => updateField("property", event.target.value)} required>
              <option value="">Choose property</option>
              {properties.rows.map((property) => (
                <option key={property.id} value={property.id}>{property.name}</option>
              ))}
            </SelectInput>
            <SelectInput label="Unit" value={form.unit} onChange={(event) => updateField("unit", event.target.value)}>
              <option value="">Property-level expense</option>
              {units.rows.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.property_name} - {unit.unit_number}</option>
              ))}
            </SelectInput>
            <SelectInput label="Category" value={form.category} onChange={(event) => updateField("category", event.target.value)}>
              <option value="repairs">Repairs</option>
              <option value="security">Security</option>
              <option value="cleaning">Cleaning</option>
              <option value="utilities">Utilities</option>
              <option value="management">Management</option>
              <option value="taxes">Taxes</option>
              <option value="other">Other</option>
            </SelectInput>
            <TextInput label="Amount" type="number" min="1" value={form.amount} onChange={(event) => updateField("amount", event.target.value)} required />
            <TextInput label="Expense date" type="date" value={form.expense_date} onChange={(event) => updateField("expense_date", event.target.value)} required />
          </div>
          <div className="mt-4">
            <TextArea label="Description" value={form.description} onChange={(event) => updateField("description", event.target.value)} required />
          </div>
          <FormMessage message={message} />
          <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save expense"}</Button>
        </form>
      </FormPanel>
      {isLoading ? <p className="text-sm text-slate-500">Loading expenses...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!isLoading && !error ? <DataTable columns={columns} rows={rows} emptyMessage="No expenses yet." sortBy="expense_date" sortDirection="desc" /> : null}
    </>
  );
}
