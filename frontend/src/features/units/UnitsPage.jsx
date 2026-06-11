import { useEffect, useState } from "react";

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
import { useAuth } from "../auth/AuthContext.jsx";

const initialForm = {
  property: "",
  unit_number: "",
  unit_type: "one_bedroom",
  floor: "",
  rent_amount: "",
  deposit_amount: "",
  status: "vacant",
};

export function UnitsPage() {
  const { user } = useAuth();
  const { rows, isLoading, error, refetch } = useResourceList("/units/");
  const properties = useResourceList("/properties/");
  const [form, setForm] = useState(initialForm);
  const [selectedPropertyId, setSelectedPropertyId] = useState("all");
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManageUnits = ["admin", "landlord"].includes(user?.role_name);
  const isCaretaker = user?.role_name === "caretaker";

  useEffect(() => {
    if (isCaretaker && properties.rows.length && selectedPropertyId === "all") {
      setSelectedPropertyId(String(properties.rows[0].id));
    }
  }, [isCaretaker, properties.rows, selectedPropertyId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      await createResource("/units/", form);
      setForm(initialForm);
      refetch();
      setMessage({ type: "success", text: "Unit created." });
    } catch {
      setMessage({ type: "error", text: "Could not create unit. Check property, rent, and unique unit number." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns = [
    { key: "unit_number", label: "Unit" },
    { key: "property_name", label: "Property" },
    { key: "unit_type", label: "Type" },
    { key: "rent_amount", label: "Rent", render: (row) => formatCurrency(row.rent_amount) },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];
  const visibleRows = selectedPropertyId === "all"
    ? rows
    : rows.filter((unit) => String(unit.property) === String(selectedPropertyId));

  return (
    <>
      <PageHeader title="Units" description="Vacant and occupied unit inventory." />
      <div className="mb-5 max-w-sm">
        <SelectInput label="Filter by property" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
          {!isCaretaker ? <option value="all">All properties</option> : null}
          {properties.rows.map((property) => (
            <option key={property.id} value={property.id}>{property.name}</option>
          ))}
        </SelectInput>
      </div>
      {canManageUnits ? (
        <FormPanel title="Add unit" description="Create a rentable unit under a property.">
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-3">
              <SelectInput label="Property" value={form.property} onChange={(event) => updateField("property", event.target.value)} required>
                <option value="">Choose property</option>
                {properties.rows.map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </SelectInput>
              <TextInput label="Unit number" value={form.unit_number} onChange={(event) => updateField("unit_number", event.target.value)} required />
              <SelectInput label="Unit type" value={form.unit_type} onChange={(event) => updateField("unit_type", event.target.value)}>
                <option value="bedsitter">Bedsitter</option>
                <option value="one_bedroom">One Bedroom</option>
                <option value="two_bedroom">Two Bedroom</option>
                <option value="three_bedroom">Three Bedroom</option>
                <option value="commercial">Commercial</option>
              </SelectInput>
              <TextInput label="Floor" value={form.floor} onChange={(event) => updateField("floor", event.target.value)} />
              <TextInput label="Rent amount" type="number" min="0" value={form.rent_amount} onChange={(event) => updateField("rent_amount", event.target.value)} required />
              <TextInput label="Deposit amount" type="number" min="0" value={form.deposit_amount} onChange={(event) => updateField("deposit_amount", event.target.value)} required />
              <SelectInput label="Status" value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                <option value="vacant">Vacant</option>
                <option value="occupied">Occupied</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </SelectInput>
            </div>
            <FormMessage message={message} />
            <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save unit"}</Button>
          </form>
        </FormPanel>
      ) : (
        <div className="mb-5 rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          Units are created by the landlord. Caretakers can view available units and assign tenants through leases.
        </div>
      )}
      {isLoading ? <p className="text-sm text-slate-500">Loading units...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!isLoading && !error ? <DataTable columns={columns} rows={visibleRows} emptyMessage="No units for this property." sortBy="unit_number" /> : null}
    </>
  );
}
