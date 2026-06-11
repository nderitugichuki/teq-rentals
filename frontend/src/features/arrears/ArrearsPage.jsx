import { useSearchParams } from "react-router-dom";

import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { StatCard } from "../../components/ui/StatCard.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { useArrearsReport } from "../../hooks/useArrearsReport.js";
import { formatCurrency } from "../../lib/formatCurrency.js";

export function ArrearsPage() {
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get("tenant");
  const { report, isLoading, error } = useArrearsReport(tenantId ? `?tenant=${tenantId}` : "");

  const columns = [
    { key: "property", label: "Property" },
    { key: "unit", label: "Unit" },
    { key: "tenant", label: "Tenant" },
    { key: "amount", label: "Due", render: (row) => formatCurrency(row.amount) },
    { key: "amount_paid", label: "Paid", render: (row) => formatCurrency(row.amount_paid) },
    { key: "balance", label: "Balance", render: (row) => formatCurrency(row.balance) },
    { key: "due_date", label: "Due Date" },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Arrears"
        description="Units and tenants with unpaid, partial, or overdue rent balances."
      />
      <div className="mb-5 max-w-sm">
        <StatCard label="Total arrears" value={formatCurrency(report.total_arrears)} detail={`${report.results.length} open charge(s)`} />
      </div>
      {tenantId && !isLoading && !error && !report.results.length ? (
        <div className="mb-5 rounded-md border border-brand-100 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          No arrears for the tenant selected from global search.
        </div>
      ) : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading arrears...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!isLoading && !error ? (
        <DataTable
          columns={columns}
          rows={report.results}
          emptyMessage={tenantId ? "No arrears for this tenant." : "No arrears right now."}
          sortBy="due_date"
          sortDirection="desc"
          rowClassName={(row) => String(row.tenant_id) === String(tenantId) ? "bg-amber-50 ring-2 ring-inset ring-amber-300" : ""}
        />
      ) : null}
    </>
  );
}
