import { useState } from "react";

import { createResource, updateResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";

const initialForm = {
  email: "",
  first_name: "",
  last_name: "",
  phone_number: "",
  password: "",
  is_active: true,
};

export function StaffPage() {
  const caretakers = useResourceList("/users/");
  const properties = useResourceList("/properties/");
  const [form, setForm] = useState(initialForm);
  const [editForm, setEditForm] = useState(null);
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
      await createResource("/users/", form);
      setForm(initialForm);
      caretakers.refetch();
      setMessage({ type: "success", text: "Caretaker account created." });
    } catch {
      setMessage({ type: "error", text: "Could not create caretaker. Check email and password." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleAccess(row) {
    await updateResource(`/users/${row.id}/`, { is_active: !row.is_active });
    caretakers.refetch();
    setMessage({ type: "success", text: row.is_active ? "Caretaker access blocked." : "Caretaker access restored." });
  }

  function startEdit(row) {
    setEditForm({
      id: row.id,
      email: row.email,
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      phone_number: row.phone_number || "",
      password: "",
    });
  }

  async function saveCaretakerUpdate(event) {
    event.preventDefault();
    const payload = {
      email: editForm.email,
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      phone_number: editForm.phone_number,
    };
    if (editForm.password) payload.password = editForm.password;
    await updateResource(`/users/${editForm.id}/`, payload);
    setEditForm(null);
    caretakers.refetch();
    setMessage({ type: "success", text: "Caretaker details updated." });
  }

  async function assignProperty(propertyId, caretakerIds) {
    const property = properties.rows.find((row) => String(row.id) === String(propertyId));
    await updateResource(`/properties/${propertyId}/`, { caretakers: caretakerIds, landlord: property.landlord });
    properties.refetch();
    setMessage({ type: "success", text: "Property caretaker assignment updated." });
  }

  const columns = [
    { key: "email", label: "Email" },
    { key: "first_name", label: "First Name" },
    { key: "phone_number", label: "Phone" },
    { key: "is_active", label: "Access", render: (row) => row.is_active ? "Active" : "Blocked" },
    {
      key: "actions",
      label: "Action",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => startEdit(row)}>Edit</Button>
          <Button variant="secondary" onClick={() => toggleAccess(row)}>
            {row.is_active ? "Block access" : "Restore access"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Caretakers"
        description="Create caretaker accounts, block access for sacked staff, and assign caretakers to properties."
      />

      <FormPanel title="Add caretaker" description="Create a login for a newly hired caretaker. They only see properties assigned to them.">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput label="Email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} required />
            <TextInput label="First name" value={form.first_name} onChange={(event) => updateField("first_name", event.target.value)} />
            <TextInput label="Last name" value={form.last_name} onChange={(event) => updateField("last_name", event.target.value)} />
            <TextInput label="Phone number" value={form.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} />
            <TextInput label="Password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} required />
          </div>
          <FormMessage message={message} />
          <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Create caretaker"}</Button>
        </form>
      </FormPanel>

      {editForm ? (
        <FormPanel title="Manage caretaker" description="Update contact details, reset password, or restore/block access from the account list.">
          <form onSubmit={saveCaretakerUpdate}>
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput label="Email" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} required />
              <TextInput label="First name" value={editForm.first_name} onChange={(event) => setEditForm((current) => ({ ...current, first_name: event.target.value }))} />
              <TextInput label="Last name" value={editForm.last_name} onChange={(event) => setEditForm((current) => ({ ...current, last_name: event.target.value }))} />
              <TextInput label="Phone number" value={editForm.phone_number} onChange={(event) => setEditForm((current) => ({ ...current, phone_number: event.target.value }))} />
              <TextInput label="New password" type="password" value={editForm.password} onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit">Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => setEditForm(null)}>Cancel</Button>
            </div>
          </form>
        </FormPanel>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Caretaker Accounts</h2>
        <DataTable columns={columns} rows={caretakers.rows} emptyMessage="No caretakers yet." />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Property Assignments</h2>
        <p className="mt-1 text-sm text-slate-500">Assign each property to the caretaker responsible for it. Reassigning moves that caretaker away from their previous property.</p>
        <div className="mt-4 space-y-4">
          {properties.rows.map((property) => (
            <PropertyAssignment
              key={property.id}
              property={property}
              caretakers={caretakers.rows}
              onSave={assignProperty}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function PropertyAssignment({ property, caretakers, onSave }) {
  const [selected, setSelected] = useState((property.caretakers || []).map(String));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(property.id, selected);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_2fr_auto] md:items-start">
      <div>
        <div className="font-semibold text-slate-950">{property.name}</div>
        <div className="text-sm text-slate-500">{property.town || "No town recorded"}</div>
      </div>
      <SelectInput
        label="Assigned caretakers"
        value={selected}
        onChange={(event) => setSelected(Array.from(event.target.selectedOptions, (option) => option.value))}
        multiple
        className="min-h-24"
      >
        {caretakers.map((caretaker) => (
          <option key={caretaker.id} value={caretaker.id}>{caretaker.email}</option>
        ))}
      </SelectInput>
      <Button variant="secondary" onClick={handleSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
