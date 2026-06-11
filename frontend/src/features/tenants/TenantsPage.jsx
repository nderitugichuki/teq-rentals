import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { createResource, postAction, updateResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { TenantSearchInput } from "../../components/ui/TenantSearchInput.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { useAuth } from "../auth/AuthContext.jsx";

const initialForm = {
  first_name: "",
  last_name: "",
  phone_number: "",
  email: "",
  id_number: "",
  kra_pin: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  move_in_date: "",
  status: "active",
  deposit_refund_status: "not_applicable",
};

const initialStatusForm = {
  tenantId: "",
  status: "active",
  move_out_date: "",
  deposit_refund_status: "not_applicable",
  keys_returned: false,
  damages_checked: false,
  final_balance_confirmed: false,
  unit_ready_for_next_tenant: false,
  move_out_notes: "",
};

const initialTransferForm = {
  tenantId: "",
  new_unit: "",
  transfer_date: "",
  deposit_handling: "carry_forward",
  additional_deposit_amount: "0",
  notes: "",
};

function formatApiError(error) {
  const data = error?.response?.data;
  if (!data || typeof data !== "object") return "Could not create tenant. Check the details and try again.";
  return Object.entries(data)
    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(" ") : messages}`)
    .join(" ");
}

export function TenantsPage() {
  const { user } = useAuth();
  const { rows, isLoading, error, refetch } = useResourceList("/tenants/");
  const [searchParams] = useSearchParams();
  const highlightedTenantId = searchParams.get("tenant");
  const leases = useResourceList("/leases/");
  const units = useResourceList("/units/");
  const properties = useResourceList("/properties/");
  const charges = useResourceList("/rent-charges/");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [statusForm, setStatusForm] = useState(initialStatusForm);
  const [transferForm, setTransferForm] = useState(initialTransferForm);
  const [selectedPropertyId, setSelectedPropertyId] = useState("all");
  const [statusMessage, setStatusMessage] = useState(null);
  const [transferMessage, setTransferMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const isCaretaker = user?.role_name === "caretaker";
  const showMoveOutFields = statusForm.status === "notice_given" || statusForm.status === "vacated";

  useEffect(() => {
    if (isCaretaker && properties.rows.length && selectedPropertyId === "all") {
      setSelectedPropertyId(String(properties.rows[0].id));
    }
  }, [isCaretaker, properties.rows, selectedPropertyId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateStatusField(field, value) {
    setStatusForm((current) => ({ ...current, [field]: value }));
  }

  function updateTransferField(field, value) {
    setTransferForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      await createResource("/tenants/", {
        ...form,
        move_in_date: form.move_in_date || null,
        status: "active",
      });
      setForm(initialForm);
      refetch();
      setMessage({ type: "success", text: "Tenant created." });
    } catch (error) {
      setMessage({ type: "error", text: formatApiError(error) });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTenantSelect(tenantId) {
    const tenant = rows.find((row) => String(row.id) === String(tenantId));
    setStatusForm({
      tenantId,
      status: tenant?.status || "active",
      move_out_date: tenant?.move_out_date || "",
      deposit_refund_status: tenant?.deposit_refund_status || "not_applicable",
      keys_returned: Boolean(tenant?.keys_returned),
      damages_checked: Boolean(tenant?.damages_checked),
      final_balance_confirmed: Boolean(tenant?.final_balance_confirmed),
      unit_ready_for_next_tenant: Boolean(tenant?.unit_ready_for_next_tenant),
      move_out_notes: tenant?.move_out_notes || "",
    });
  }

  function handleTransferTenantSelect(tenantId) {
    setTransferForm((current) => ({ ...current, tenantId }));
  }

  useEffect(() => {
    if (highlightedTenantId && rows.length) {
      handleTenantSelect(highlightedTenantId);
    }
  }, [highlightedTenantId, rows]);

  async function handleStatusSubmit(event) {
    event.preventDefault();
    setStatusMessage(null);
    setIsUpdatingStatus(true);

    try {
      await updateResource(`/tenants/${statusForm.tenantId}/`, {
        status: statusForm.status,
        move_out_date: statusForm.move_out_date || null,
        deposit_refund_status: statusForm.deposit_refund_status,
        keys_returned: statusForm.keys_returned,
        damages_checked: statusForm.damages_checked,
        final_balance_confirmed: statusForm.final_balance_confirmed,
        unit_ready_for_next_tenant: statusForm.unit_ready_for_next_tenant,
        move_out_notes: statusForm.move_out_notes,
      });
      setStatusForm(initialStatusForm);
      refetch();
      setStatusMessage({ type: "success", text: "Tenant status updated. If marked vacated, the active lease is closed and the unit becomes vacant." });
    } catch (error) {
      setStatusMessage({ type: "error", text: formatApiError(error) });
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleTransferSubmit(event) {
    event.preventDefault();
    setTransferMessage(null);
    setIsTransferring(true);

    try {
      await postAction(`/tenants/${transferForm.tenantId}/transfer/`, {
        new_unit: transferForm.new_unit,
        transfer_date: transferForm.transfer_date,
        deposit_handling: transferForm.deposit_handling,
        additional_deposit_amount: transferForm.additional_deposit_amount || "0",
        notes: transferForm.notes,
      });
      setTransferForm(initialTransferForm);
      refetch();
      leases.refetch();
      units.refetch();
      charges.refetch();
      setTransferMessage({ type: "success", text: "Tenant transferred. Old unit is now vacant and new unit is occupied." });
    } catch (error) {
      setTransferMessage({ type: "error", text: formatApiError(error) });
    } finally {
      setIsTransferring(false);
    }
  }

  const columns = [
    { key: "row_number", label: "No.", sortable: false, render: (_row, index) => index + 1 },
    { key: "unit_label", label: "Unit" },
    { key: "full_name", label: "Name" },
    { key: "phone_number", label: "Phone" },
    { key: "status", label: "Status" },
    { key: "move_in_date", label: "Move In" },
    { key: "move_out_date", label: "Move Out" },
  ];
  const propertyUnitIds = new Set(
    units.rows
      .filter((unit) => selectedPropertyId === "all" || String(unit.property) === String(selectedPropertyId))
      .map((unit) => Number(unit.id))
  );
  const propertyTenantIds = new Set(
    leases.rows
      .filter((lease) => selectedPropertyId === "all" || propertyUnitIds.has(Number(lease.unit)))
      .map((lease) => Number(lease.tenant))
  );
  const activeLeaseByTenant = leases.rows.reduce((lookup, lease) => {
    if (lease.status === "active" || !lookup[lease.tenant]) {
      lookup[lease.tenant] = lease;
    }
    return lookup;
  }, {});
  const visibleRows = (selectedPropertyId === "all" ? rows : rows.filter((tenant) => propertyTenantIds.has(Number(tenant.id))))
    .map((tenant) => ({
      ...tenant,
      unit_label: activeLeaseByTenant[tenant.id]?.unit_label || "No unit",
    }));
  const selectedTenantBalance = charges.rows
    .filter((charge) => Number(charge.tenant) === Number(statusForm.tenantId))
    .reduce((sum, charge) => sum + Number(charge.balance || 0), 0);
  const vacantUnits = units.rows
    .filter((unit) => selectedPropertyId === "all" || String(unit.property) === String(selectedPropertyId))
    .filter((unit) => unit.status === "vacant");
  const selectedTransferUnit = units.rows.find((unit) => String(unit.id) === String(transferForm.new_unit));
  const transferRent = Number(selectedTransferUnit?.rent_amount || 0);
  const transferDeposit = Number(
    transferForm.deposit_handling === "additional"
      ? transferForm.additional_deposit_amount || 0
      : selectedTransferUnit?.deposit_amount || 0
  );
  const transferMoveInTotal = transferRent + (transferForm.deposit_handling === "carry_forward" ? 0 : transferDeposit);

  return (
    <>
      <PageHeader title="Tenants" description="Tenant contacts and identity records." />
      <div className="mb-5 max-w-sm">
        <SelectInput label="Filter by property" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
          {!isCaretaker ? <option value="all">All properties</option> : null}
          {properties.rows.map((property) => (
            <option key={property.id} value={property.id}>{property.name}</option>
          ))}
        </SelectInput>
      </div>
      <FormPanel title="Add tenant" description="Register a tenant before assigning them to a unit through a lease.">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-4">
            <TextInput label="First name" value={form.first_name} onChange={(event) => updateField("first_name", event.target.value)} required />
            <TextInput label="Last name" value={form.last_name} onChange={(event) => updateField("last_name", event.target.value)} required />
            <TextInput label="Phone number" value={form.phone_number} onChange={(event) => updateField("phone_number", event.target.value)} required />
            <TextInput label="Emergency contact" value={form.emergency_contact_name} onChange={(event) => updateField("emergency_contact_name", event.target.value)} required />
            <TextInput label="Emergency phone" value={form.emergency_contact_phone} onChange={(event) => updateField("emergency_contact_phone", event.target.value)} required />
            <TextInput label="Move-in date" type="date" value={form.move_in_date} onChange={(event) => updateField("move_in_date", event.target.value)} required />
          </div>
          <FormMessage message={message} />
          <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save tenant"}</Button>
        </form>
      </FormPanel>
      <FormPanel title="Update existing tenant status" description="Use this when a tenant gives notice or vacates. Do not create a new tenant record for move-out.">
        <form onSubmit={handleStatusSubmit}>
          <div className="grid gap-4 md:grid-cols-4">
            <TenantSearchInput tenants={visibleRows} value={statusForm.tenantId} onChange={handleTenantSelect} required />
            <SelectInput label="New status" value={statusForm.status} onChange={(event) => updateStatusField("status", event.target.value)}>
              <option value="active">Active</option>
              <option value="notice_given">Notice Given</option>
              <option value="vacated">Vacated</option>
            </SelectInput>
            {showMoveOutFields ? (
              <>
                <TextInput label="Move-out date" type="date" value={statusForm.move_out_date} onChange={(event) => updateStatusField("move_out_date", event.target.value)} />
                <SelectInput label="Deposit refund" value={statusForm.deposit_refund_status} onChange={(event) => updateStatusField("deposit_refund_status", event.target.value)}>
                  <option value="not_applicable">Not Applicable</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial Refund</option>
                  <option value="refunded">Refunded</option>
                  <option value="withheld">Withheld</option>
                </SelectInput>
              </>
            ) : null}
          </div>
          {statusForm.status === "vacated" && selectedTenantBalance > 0 ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Warning: this tenant still has a balance of {new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(selectedTenantBalance)}. Vacating will free the unit, but arrears will remain in reports.
            </div>
          ) : null}
          <FormMessage message={statusMessage} />
          <Button type="submit" className="mt-4" disabled={isUpdatingStatus || !statusForm.tenantId}>
            {isUpdatingStatus ? "Updating..." : "Update tenant status"}
          </Button>
        </form>
      </FormPanel>
      <FormPanel title="Transfer tenant to another unit" description="Move an existing tenant without creating a duplicate tenant record. The old lease is closed and a new lease starts on the selected unit.">
        <form onSubmit={handleTransferSubmit}>
          <div className="grid gap-4 md:grid-cols-4">
            <TenantSearchInput tenants={visibleRows.filter((tenant) => tenant.status === "active")} value={transferForm.tenantId} onChange={handleTransferTenantSelect} required />
            <SelectInput label="New vacant unit" value={transferForm.new_unit} onChange={(event) => updateTransferField("new_unit", event.target.value)} required>
              <option value="">Choose unit</option>
              {vacantUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.property_name} - {unit.unit_number} - {new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(Number(unit.rent_amount || 0))}</option>
              ))}
            </SelectInput>
            <TextInput label="Transfer date" type="date" value={transferForm.transfer_date} onChange={(event) => updateTransferField("transfer_date", event.target.value)} required />
            <SelectInput label="Deposit handling" value={transferForm.deposit_handling} onChange={(event) => updateTransferField("deposit_handling", event.target.value)}>
              <option value="carry_forward">Carry forward existing deposit</option>
              <option value="additional">Charge additional deposit only</option>
              <option value="full">Charge full deposit</option>
            </SelectInput>
            {transferForm.deposit_handling === "additional" ? (
              <TextInput label="Additional deposit amount" type="number" min="0" value={transferForm.additional_deposit_amount} onChange={(event) => updateTransferField("additional_deposit_amount", event.target.value)} required />
            ) : null}
            <TextInput label="Transfer notes" value={transferForm.notes} onChange={(event) => updateTransferField("notes", event.target.value)} />
          </div>
          {selectedTransferUnit ? (
            <div className="mt-4 rounded-md border border-brand-100 bg-brand-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Amount required after transfer</p>
              <p className="mt-1 text-2xl font-black text-brand-900">{new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(transferMoveInTotal)}</p>
              <p className="mt-1 text-xs text-brand-700">
                {transferForm.deposit_handling === "carry_forward"
                  ? "Deposit is carried forward, so only the new unit rent is expected."
                  : transferForm.deposit_handling === "additional"
                    ? "Calculated as new unit rent plus the additional deposit entered."
                    : "Calculated as new unit rent plus full deposit."}
              </p>
            </div>
          ) : null}
          <FormMessage message={transferMessage} />
          <Button type="submit" className="mt-4" disabled={isTransferring || !transferForm.tenantId || !transferForm.new_unit}>
            {isTransferring ? "Transferring..." : "Transfer tenant"}
          </Button>
        </form>
      </FormPanel>
      {isLoading ? <p className="text-sm text-slate-500">Loading tenants...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {highlightedTenantId ? (
        <div className="mb-4 rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          Highlighting tenant selected from global search.
        </div>
      ) : null}
      {!isLoading && !error ? (
        <DataTable
          columns={columns}
          rows={visibleRows}
          emptyMessage="No tenants for this property."
          sortBy="unit_label"
          rowClassName={(row) => String(row.id) === String(highlightedTenantId) ? "bg-brand-50 ring-2 ring-inset ring-brand-300" : ""}
        />
      ) : null}
    </>
  );
}
