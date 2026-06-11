import { useState } from "react";

import { createResource, postAction, uploadResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatCard } from "../../components/ui/StatCard.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TenantSearchInput } from "../../components/ui/TenantSearchInput.jsx";
import { TextArea } from "../../components/ui/TextArea.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { useAuth } from "../auth/AuthContext.jsx";

const initialForm = {
  property: "",
  unit: "",
  tenant: "",
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  resolution_notes: "",
};

const initialPhotoForm = {
  maintenance_request: "",
  caption: "",
  image: null,
};

export function MaintenancePage() {
  const { user } = useAuth();
  const { rows, isLoading, error, refetch } = useResourceList("/maintenance-requests/");
  const properties = useResourceList("/properties/");
  const units = useResourceList("/units/");
  const tenants = useResourceList("/tenants/");
  const photos = useResourceList("/maintenance-photos/");
  const [form, setForm] = useState(initialForm);
  const [photoForm, setPhotoForm] = useState(initialPhotoForm);
  const [message, setMessage] = useState(null);
  const [photoMessage, setPhotoMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const openCount = rows.filter((row) => ["open", "awaiting_approval", "approved", "in_progress"].includes(row.status)).length;
  const urgentCount = rows.filter((row) => row.priority === "urgent").length;
  const resolvedCount = rows.filter((row) => ["resolved", "closed"].includes(row.status)).length;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      await createResource("/maintenance-requests/", {
        ...form,
        tenant: form.tenant || null,
      });
      setForm(initialForm);
      refetch();
      setMessage({ type: "success", text: "Maintenance request created." });
    } catch {
      setMessage({ type: "error", text: "Could not create maintenance request. Check property, unit, and assignment fields." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePhotoSubmit(event) {
    event.preventDefault();
    setPhotoMessage(null);
    setIsUploadingPhoto(true);
    try {
      const payload = new FormData();
      payload.append("maintenance_request", photoForm.maintenance_request);
      payload.append("caption", photoForm.caption);
      payload.append("image", photoForm.image);
      await uploadResource("/maintenance-photos/", payload);
      setPhotoForm(initialPhotoForm);
      photos.refetch();
      refetch();
      setPhotoMessage({ type: "success", text: "Maintenance photo uploaded." });
    } catch {
      setPhotoMessage({ type: "error", text: "Could not upload photo. Choose a request and image file." });
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function resolveRequest(row) {
    await postAction(`/maintenance-requests/${row.id}/resolve/`, { resolution_notes: row.resolution_notes || "" });
    refetch();
  }

  async function runAction(row, action) {
    await postAction(`/maintenance-requests/${row.id}/${action}/`);
    refetch();
  }

  function renderActions(row) {
    const isLandlordSide = ["admin", "landlord"].includes(user?.role_name);
    const isCaretaker = user?.role_name === "caretaker";

    if (row.status === "closed") return "-";

    return (
      <div className="flex flex-wrap gap-2">
        {isCaretaker && row.status === "open" ? (
          <Button variant="secondary" onClick={() => runAction(row, "escalate")}>Escalate</Button>
        ) : null}
        {isLandlordSide && row.status === "awaiting_approval" ? (
          <>
            <Button onClick={() => runAction(row, "approve")}>Approve</Button>
            <Button variant="secondary" onClick={() => runAction(row, "reject")}>Reject</Button>
          </>
        ) : null}
        {isCaretaker && row.status === "approved" ? (
          <Button variant="secondary" onClick={() => runAction(row, "start")}>Start</Button>
        ) : null}
        {["approved", "in_progress"].includes(row.status) ? (
          <Button variant="secondary" onClick={() => resolveRequest(row)}>Resolve</Button>
        ) : null}
        {isLandlordSide && row.status === "resolved" ? (
          <Button onClick={() => runAction(row, "close")}>Close</Button>
        ) : null}
      </div>
    );
  }

  const columns = [
    { key: "title", label: "Issue" },
    { key: "property_name", label: "Property" },
    { key: "unit_label", label: "Unit" },
    { key: "tenant_name", label: "Tenant" },
    { key: "reported_at", label: "Reported", render: (row) => new Date(row.reported_at).toLocaleString() },
    { key: "priority", label: "Priority", render: (row) => <StatusBadge value={row.priority} /> },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { key: "photo_count", label: "Photos", render: (row) => row.photo_count || photos.rows.filter((photo) => Number(photo.maintenance_request) === Number(row.id)).length },
    {
      key: "actions",
      label: "Actions",
      render: renderActions,
    },
  ];

  return (
    <>
      <PageHeader title="Maintenance" description="Track tenant issues, caretaker work, priorities, and statuses." />
      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <StatCard label="Open work" value={openCount} detail="Open, approval, approved, or in progress" />
        <StatCard label="Urgent" value={urgentCount} detail="Needs fast attention" />
        <StatCard label="Resolved" value={resolvedCount} detail="Completed or closed" />
      </div>
      <FormPanel title="Add maintenance request" description="Create a repair or service request for a property unit.">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput label="Property" value={form.property} onChange={(event) => updateField("property", event.target.value)} required>
              <option value="">Choose property</option>
              {properties.rows.map((property) => (
                <option key={property.id} value={property.id}>{property.name}</option>
              ))}
            </SelectInput>
            <SelectInput label="Unit" value={form.unit} onChange={(event) => updateField("unit", event.target.value)} required>
              <option value="">Choose unit</option>
              {units.rows.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.property_name} - {unit.unit_number}</option>
              ))}
            </SelectInput>
            <TenantSearchInput tenants={tenants.rows} value={form.tenant} onChange={(tenantId) => updateField("tenant", tenantId)} required={false} />
            <TextInput label="Issue" value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
            <SelectInput label="Priority" value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </SelectInput>
            <SelectInput label="Status" value={form.status} onChange={(event) => updateField("status", event.target.value)}>
              <option value="open">Open</option>
              <option value="awaiting_approval">Awaiting Approval</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </SelectInput>
          </div>
          <div className="mt-4">
            <TextArea label="Description" value={form.description} onChange={(event) => updateField("description", event.target.value)} required />
          </div>
          <FormMessage message={message} />
          <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Create request"}</Button>
        </form>
      </FormPanel>
      <FormPanel title="Upload maintenance photo" description="Attach photos for landlord approval, repair progress, or completion proof.">
        <form onSubmit={handlePhotoSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <SelectInput label="Maintenance request" value={photoForm.maintenance_request} onChange={(event) => setPhotoForm((current) => ({ ...current, maintenance_request: event.target.value }))} required>
              <option value="">Choose request</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>{row.unit_label} - {row.title}</option>
              ))}
            </SelectInput>
            <TextInput label="Caption" value={photoForm.caption} onChange={(event) => setPhotoForm((current) => ({ ...current, caption: event.target.value }))} />
            <label className="block text-sm font-medium text-slate-700">
              Photo
              <input
                accept="image/*"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setPhotoForm((current) => ({ ...current, image: event.target.files?.[0] || null }))}
                required
                type="file"
              />
            </label>
          </div>
          <FormMessage message={photoMessage} />
          <Button type="submit" className="mt-4" disabled={isUploadingPhoto}>{isUploadingPhoto ? "Uploading..." : "Upload photo"}</Button>
        </form>
      </FormPanel>
      {isLoading ? <p className="text-sm text-slate-500">Loading maintenance requests...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!isLoading && !error ? <DataTable columns={columns} rows={rows} emptyMessage="No maintenance requests yet." sortBy="reported_at" sortDirection="desc" /> : null}
    </>
  );
}
