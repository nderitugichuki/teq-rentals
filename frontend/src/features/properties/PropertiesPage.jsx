import { useState } from "react";
import { Link } from "react-router-dom";

import { createResource, updateResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { TextArea } from "../../components/ui/TextArea.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";

const initialForm = {
  landlord: "",
  caretakers: [],
  name: "",
  property_type: "apartment",
  town: "",
  description: "",
};

export function PropertiesPage() {
  const { user } = useAuth();
  const { rows, isLoading, error, refetch } = useResourceList("/properties/");
  const users = useResourceList("/users/", ["admin", "landlord"].includes(user?.role_name));
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManageProperties = ["admin", "landlord"].includes(user?.role_name);
  const caretakerUsers = users.rows.filter((userRow) => userRow.role_name === "caretaker");

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCaretakers(event) {
    const caretakers = Array.from(event.target.selectedOptions, (option) => option.value);
    updateField("caretakers", caretakers);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      await createResource("/properties/", {
        ...form,
        address: form.town || form.name,
        county: "",
        landlord: user?.role_name === "admin" ? form.landlord : user?.id,
      });
      setForm(initialForm);
      refetch();
      setMessage({ type: "success", text: "Property created." });
    } catch {
      setMessage({ type: "error", text: "Could not create property. Make sure landlord and required fields are set." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignCaretakers(propertyId, caretakerIds) {
    await updateResource(`/properties/${propertyId}/`, { caretakers: caretakerIds });
    refetch();
    setMessage({ type: "success", text: "Caretaker assignment updated." });
  }

  const columns = [
    { key: "name", label: "Name", render: (row) => <Link className="font-semibold text-brand-700 hover:underline" to={`/properties/${row.id}`}>{row.name}</Link> },
    { key: "property_type", label: "Type" },
    { key: "town", label: "Town" },
    { key: "caretaker_emails", label: "Caretakers", render: (row) => row.caretaker_emails?.join(", ") || "-" },
  ];

  if (canManageProperties) {
    columns.push({
      key: "actions",
      label: "Assign",
      render: (row) => (
        <CaretakerAssignmentCell
          property={row}
          caretakers={caretakerUsers}
          onSave={handleAssignCaretakers}
        />
      ),
    });
  }

  return (
    <>
      <PageHeader title="My Property" description="Set up the building or apartment block this landlord manages." />
      {canManageProperties ? (
        <FormPanel title={rows.length ? "Add another property" : "Add your property"} description={rows.length ? "Most landlords manage one property, but another can be added when needed." : "Create the main building, estate, or apartment block first."}>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-3">
              {user?.role_name === "admin" ? (
                <SelectInput label="Landlord" value={form.landlord} onChange={(event) => updateField("landlord", event.target.value)} required>
                  <option value="">Choose landlord</option>
                  {users.rows.filter((userRow) => userRow.role_name === "landlord").map((userRow) => (
                    <option key={userRow.id} value={userRow.id}>{userRow.email}</option>
                  ))}
                </SelectInput>
              ) : null}
              <TextInput label="Name" value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
              <SelectInput label="Property type" value={form.property_type} onChange={(event) => updateField("property_type", event.target.value)}>
                <option value="apartment">Apartment</option>
                <option value="house">House</option>
                <option value="commercial">Commercial</option>
                <option value="mixed_use">Mixed Use</option>
              </SelectInput>
              <TextInput label="Town" value={form.town} onChange={(event) => updateField("town", event.target.value)} required />
              <SelectInput
                label="Assigned caretakers"
                value={form.caretakers}
                onChange={updateCaretakers}
                multiple
                className="min-h-24"
              >
                {caretakerUsers.map((userRow) => (
                  <option key={userRow.id} value={userRow.id}>{userRow.email}</option>
                ))}
              </SelectInput>
            </div>
            <p className="mt-2 text-xs text-slate-500">Hold Ctrl while clicking to select more than one caretaker.</p>
            <div className="mt-4">
              <TextArea label="Description" value={form.description} onChange={(event) => updateField("description", event.target.value)} />
            </div>
            <FormMessage message={message} />
            <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save property"}</Button>
          </form>
        </FormPanel>
      ) : (
        <div className="mb-5 rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          These are the properties assigned to you. You will only see units, tenants, arrears, and maintenance for these properties.
        </div>
      )}
      {isLoading ? <p className="text-sm text-slate-500">Loading properties...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!isLoading && !error ? <DataTable columns={columns} rows={rows} emptyMessage="No properties yet." /> : null}
    </>
  );
}

function CaretakerAssignmentCell({ property, caretakers, onSave }) {
  const [selectedCaretakers, setSelectedCaretakers] = useState((property.caretakers || []).map(String));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(property.id, selectedCaretakers);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex min-w-64 items-start gap-2">
      <select
        className="min-h-20 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-950 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        value={selectedCaretakers}
        onChange={(event) => setSelectedCaretakers(Array.from(event.target.selectedOptions, (option) => option.value))}
        multiple
      >
        {caretakers.map((caretaker) => (
          <option key={caretaker.id} value={caretaker.id}>{caretaker.email}</option>
        ))}
      </select>
      <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving" : "Save"}
      </Button>
    </div>
  );
}
