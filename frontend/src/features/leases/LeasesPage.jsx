import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { createResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { SelectInput } from "../../components/ui/SelectInput.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TenantSearchInput } from "../../components/ui/TenantSearchInput.jsx";
import { TextInput } from "../../components/ui/TextInput.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { todayDate } from "../../lib/today.js";
import { useAuth } from "../auth/AuthContext.jsx";

const initialForm = {
  tenant: "",
  unit: "",
  start_date: todayDate(),
  rent_amount: "",
  deposit_amount: "",
  billing_day: "1",
  grace_period_days: "0",
  status: "active",
};

export function LeasesPage() {
  const { user } = useAuth();
  const { rows, isLoading, error, refetch } = useResourceList("/leases/");
  const [searchParams] = useSearchParams();
  const highlightedTenantId = searchParams.get("tenant");
  const tenants = useResourceList("/tenants/");
  const units = useResourceList("/units/");
  const properties = useResourceList("/properties/");
  const [form, setForm] = useState(initialForm);
  const [selectedPropertyId, setSelectedPropertyId] = useState("all");
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isCaretaker = user?.role_name === "caretaker";

  useEffect(() => {
    if (isCaretaker && properties.rows.length && selectedPropertyId === "all") {
      setSelectedPropertyId(String(properties.rows[0].id));
    }
  }, [isCaretaker, properties.rows, selectedPropertyId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleUnitChange(unitId) {
    const selectedUnit = units.rows.find((unit) => String(unit.id) === String(unitId));
    setForm((current) => ({
      ...current,
      unit: unitId,
      rent_amount: selectedUnit?.rent_amount || current.rent_amount,
      deposit_amount: selectedUnit?.deposit_amount || current.deposit_amount,
    }));
  }

  const rentAmount = Number(form.rent_amount || 0);
  const depositAmount = Number(form.deposit_amount || 0);
  const moveInTotal = rentAmount + depositAmount;

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      await createResource("/leases/", {
        ...form,
        status: "active",
      });
      setForm(initialForm);
      refetch();
      tenants.refetch();
      units.refetch();
      setMessage({ type: "success", text: "Tenant assigned. Active leases mark the unit occupied." });
    } catch {
      setMessage({ type: "error", text: "Could not create lease. Check if the unit already has an active lease." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns = [
    { key: "row_number", label: "No.", sortable: false, render: (_row, index) => index + 1 },
    { key: "tenant_name", label: "Tenant" },
    { key: "unit_label", label: "Unit" },
    { key: "start_date", label: "Start Date" },
    { key: "rent_amount", label: "Rent", render: (row) => formatCurrency(row.rent_amount) },
    { key: "deposit_amount", label: "Deposit", render: (row) => row.deposit_required ? formatCurrency(row.deposit_amount) : "Carried forward" },
    { key: "move_in_total", label: "Move-in Total", render: (row) => formatCurrency(row.move_in_total) },
    { key: "billing_day", label: "Due Day" },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];
  const propertyUnitIds = new Set(
    units.rows
      .filter((unit) => selectedPropertyId === "all" || String(unit.property) === String(selectedPropertyId))
      .map((unit) => Number(unit.id))
  );
  const visibleRows = selectedPropertyId === "all" ? rows : rows.filter((lease) => propertyUnitIds.has(Number(lease.unit)));
  const visibleUnits = (selectedPropertyId === "all" ? units.rows : units.rows.filter((unit) => String(unit.property) === String(selectedPropertyId)))
    .filter((unit) => unit.status === "vacant" || String(unit.id) === String(form.unit));
  const activeTenantIds = useMemo(
    () => new Set(rows.filter((lease) => lease.status === "active").map((lease) => Number(lease.tenant))),
    [rows]
  );
  const assignableTenants = tenants.rows.filter((tenant) => !activeTenantIds.has(Number(tenant.id)) || String(tenant.id) === String(form.tenant));

  return (
    <>
      <PageHeader
        title={isCaretaker ? "Tenant Assignments" : "Leases"}
        description={isCaretaker ? "Assign new tenants to units already created by management." : "Active and historical tenancy agreements."}
      />
      <div className="mb-5 max-w-sm">
        <SelectInput label="Filter by property" value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>
          {!isCaretaker ? <option value="all">All properties</option> : null}
          {properties.rows.map((property) => (
            <option key={property.id} value={property.id}>{property.name}</option>
          ))}
        </SelectInput>
      </div>
      <FormPanel
        title={isCaretaker ? "Assign tenant to unit" : "Create lease"}
        description={isCaretaker ? "Choose a tenant and select an available unit. New tenant onboarding requires rent plus deposit." : "Assign a tenant to a unit and lock in the billing terms. New tenant onboarding requires rent plus deposit."}
      >
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-4">
            <TenantSearchInput tenants={assignableTenants} value={form.tenant} onChange={(tenantId) => updateField("tenant", tenantId)} required />
            <SelectInput label="Unit" value={form.unit} onChange={(event) => handleUnitChange(event.target.value)} required>
              <option value="">Choose unit</option>
              {visibleUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.property_name} - {unit.unit_number} ({unit.status})</option>
              ))}
            </SelectInput>
            <TextInput label="Start date" type="date" value={form.start_date} onChange={(event) => updateField("start_date", event.target.value)} required />
            <TextInput
              label="Rent amount"
              type="number"
              min="1"
              value={form.rent_amount}
              onChange={(event) => updateField("rent_amount", event.target.value)}
              readOnly={isCaretaker}
              className={isCaretaker ? "bg-slate-100 font-semibold text-slate-500" : ""}
              required
            />
            <TextInput
              label="Deposit amount"
              type="number"
              min="0"
              value={form.deposit_amount}
              onChange={(event) => updateField("deposit_amount", event.target.value)}
              readOnly={isCaretaker}
              className={isCaretaker ? "bg-slate-100 font-semibold text-slate-500" : ""}
              required
            />
            <div className="rounded-md border border-brand-100 bg-brand-50 px-4 py-3 md:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Total required on onboarding</p>
              <p className="mt-1 text-2xl font-black text-brand-900">{formatCurrency(moveInTotal)}</p>
              <p className="mt-1 text-xs text-brand-700">Calculated as first month rent plus deposit.</p>
            </div>
            <TextInput label="Billing day" type="number" min="1" max="28" value={form.billing_day} onChange={(event) => updateField("billing_day", event.target.value)} required />
            <TextInput label="Grace period days" type="number" min="0" value={form.grace_period_days} onChange={(event) => updateField("grace_period_days", event.target.value)} required />
          </div>
          <FormMessage message={message} />
          <Button type="submit" className="mt-4" disabled={isSubmitting}>{isSubmitting ? "Saving..." : isCaretaker ? "Assign tenant" : "Create lease"}</Button>
        </form>
      </FormPanel>
      {isLoading ? <p className="text-sm text-slate-500">Loading leases...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {highlightedTenantId ? (
        <div className="mb-4 rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          Highlighting lease for tenant selected from global search.
        </div>
      ) : null}
      {!isLoading && !error ? (
        <DataTable
          columns={columns}
          rows={visibleRows}
          emptyMessage="No leases for this property."
          sortBy="start_date"
          sortDirection="desc"
          rowClassName={(row) => String(row.tenant) === String(highlightedTenantId) ? "bg-brand-50 ring-2 ring-inset ring-brand-300" : ""}
        />
      ) : null}
    </>
  );
}
