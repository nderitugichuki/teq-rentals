import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { StatCard } from "../../components/ui/StatCard.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TenantSearchInput } from "../../components/ui/TenantSearchInput.jsx";
import { ChartPanel, MiniBarChart, ProgressBar, moneyFormatter } from "../../components/ui/Visuals.jsx";
import { useReport } from "../../hooks/useReport.js";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";

export function ReportsPage() {
  const tenants = useResourceList("/tenants/");
  const [tenantId, setTenantId] = useState("");
  const collection = useReport("/reports/rent-collection/");
  const occupancy = useReport("/reports/occupancy/");
  const incomeExpense = useReport("/reports/income-expense/");
  const propertySummary = useReport("/reports/property-summary/");
  const rentRoll = useReport("/reports/rent-roll/");
  const agedReceivables = useReport("/reports/aged-receivables/");
  const statementPath = tenantId ? `/reports/tenant-statement/?tenant=${tenantId}` : null;
  const tenantStatement = useReport(statementPath || "/reports/rent-collection/");

  const statement = tenantId ? tenantStatement.data : null;
  const isLoading = [collection, occupancy, incomeExpense, propertySummary, rentRoll, agedReceivables].some((report) => report.isLoading);
  const hasError = [collection, occupancy, incomeExpense, propertySummary, rentRoll, agedReceivables].some((report) => report.error);

  const propertyColumns = [
    { key: "name", label: "Property" },
    { key: "total_units", label: "Units" },
    { key: "occupied_units", label: "Occupied" },
    { key: "occupancy_rate", label: "Occupancy", render: (row) => `${row.occupancy_rate}%` },
    { key: "collected", label: "Collected", render: (row) => formatCurrency(row.collected) },
    { key: "arrears", label: "Arrears", render: (row) => formatCurrency(row.arrears) },
    { key: "expenses", label: "Expenses", render: (row) => formatCurrency(row.expenses) },
    { key: "net_income", label: "Net", render: (row) => formatCurrency(row.net_income) },
  ];

  const statementColumns = [
    { key: "date", label: "Date" },
    { key: "type", label: "Type" },
    { key: "description", label: "Description" },
    { key: "debit", label: "Debit", render: (row) => formatCurrency(row.debit) },
    { key: "credit", label: "Credit", render: (row) => formatCurrency(row.credit) },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];
  const rentRollColumns = [
    { key: "property", label: "Property" },
    { key: "unit", label: "Unit", sortValue: (row) => `${row.property || ""} ${row.unit || ""}` },
    { key: "unit_type", label: "Type" },
    { key: "tenant", label: "Tenant" },
    { key: "phone_number", label: "Phone" },
    { key: "rent_amount", label: "Rent", render: (row) => formatCurrency(row.rent_amount) },
    { key: "balance", label: "Balance", render: (row) => formatCurrency(row.balance) },
    { key: "lease_status", label: "Status", render: (row) => <StatusBadge value={row.lease_status} /> },
  ];
  const agedColumns = [
    { key: "property", label: "Property" },
    { key: "unit", label: "Unit" },
    { key: "tenant", label: "Tenant" },
    { key: "due_date", label: "Due Date" },
    { key: "age_days", label: "Age Days" },
    { key: "bucket", label: "Bucket" },
    { key: "balance", label: "Balance", render: (row) => formatCurrency(row.balance) },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];

  const selectedTenantName = useMemo(() => {
    return tenants.rows.find((tenant) => String(tenant.id) === String(tenantId))?.full_name || "";
  }, [tenantId, tenants.rows]);

  return (
    <>
      <PageHeader title="Reports" description="Business summaries for rent collection, occupancy, income, expenses, and tenant statements." />

      {isLoading ? <p className="mb-4 text-sm text-slate-500">Loading reports...</p> : null}
      {hasError ? <p className="mb-4 text-sm text-red-600">Some reports could not be loaded.</p> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Expected rent"
          value={formatCurrency(collection.data?.expected)}
          detail={`${collection.data?.collection_rate || 0}% collected`}
        />
        <StatCard
          label="Collected"
          value={formatCurrency(collection.data?.collected)}
          detail={`Balance ${formatCurrency(collection.data?.balance)}`}
        />
        <StatCard
          label="Occupancy"
          value={`${occupancy.data?.occupancy_rate || 0}%`}
          detail={`${occupancy.data?.occupied_units || 0}/${occupancy.data?.total_units || 0} units occupied`}
        />
        <StatCard
          label="Net income"
          value={formatCurrency(incomeExpense.data?.net_income)}
          detail={`Income ${formatCurrency(incomeExpense.data?.income)} less expenses`}
        />
      </div>

      <div className="mb-8 grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Collection Rate" description="Expected rent against confirmed collections.">
          <ProgressBar label="Collected" value={Number(collection.data?.collected || 0)} total={Number(collection.data?.expected || 0)} />
        </ChartPanel>
        <ChartPanel title="Revenue by Property" description="Property-level collections from the summary report.">
          {(propertySummary.data?.results || []).length ? (
            <MiniBarChart rows={propertySummary.data.results} labelKey="name" valueKey="collected" formatter={moneyFormatter} />
          ) : (
            <p className="text-sm text-slate-500">No revenue data yet.</p>
          )}
        </ChartPanel>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Property Summary</h2>
        <DataTable columns={propertyColumns} rows={propertySummary.data?.results || []} emptyMessage="No property summary data yet." sortBy={false} />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Rent Roll</h2>
        <DataTable columns={rentRollColumns} rows={rentRoll.data?.results || []} emptyMessage="No rent roll data yet." sortBy="unit" />
      </section>

      <section className="mb-8">
        <div className="mb-3 grid gap-4 md:grid-cols-5">
          <StatCard label="Aged Total" value={formatCurrency(agedReceivables.data?.total)} detail="All overdue balances" />
          <StatCard label="0-30" value={formatCurrency(agedReceivables.data?.buckets?.["0_30"])} detail="Recent" />
          <StatCard label="31-60" value={formatCurrency(agedReceivables.data?.buckets?.["31_60"])} detail="Needs follow-up" />
          <StatCard label="61-90" value={formatCurrency(agedReceivables.data?.buckets?.["61_90"])} detail="High risk" tone="amber" />
          <StatCard label="90+" value={formatCurrency(agedReceivables.data?.buckets?.over_90)} detail="Critical" tone="rose" />
        </div>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Aged Receivables</h2>
        <DataTable columns={agedColumns} rows={agedReceivables.data?.results || []} emptyMessage="No aged receivables right now." sortBy="age_days" sortDirection="desc" />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Tenant Statement</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a tenant to see charges, payments, and balance.</p>
          </div>
          <div className="flex gap-2">
            <TenantSearchInput tenants={tenants.rows} value={tenantId} onChange={setTenantId} required />
            <Button className="self-end" onClick={() => tenantStatement.refetch()} disabled={!tenantId}>
              Refresh
            </Button>
          </div>
        </div>

        {statement ? (
          <>
            <div className="mb-4 grid gap-4 md:grid-cols-3">
              <StatCard label={selectedTenantName || statement.tenant} value={formatCurrency(statement.balance)} detail="Current balance" />
              <StatCard label="Charged" value={formatCurrency(statement.total_charged)} detail="Total debits" />
              <StatCard label="Paid" value={formatCurrency(statement.total_paid)} detail="Total credits" />
            </div>
            <DataTable columns={statementColumns} rows={statement.results || []} emptyMessage="No statement rows for this tenant." sortBy="date" sortDirection="desc" />
          </>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Select a tenant to load their statement.
          </div>
        )}
      </section>
    </>
  );
}
