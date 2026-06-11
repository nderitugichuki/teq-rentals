import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { StatCard } from "../../components/ui/StatCard.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { useReport } from "../../hooks/useReport.js";
import { formatCurrency } from "../../lib/formatCurrency.js";

export function TransactionsPage() {
  const ledger = useReport("/reports/transactions/");
  const rows = ledger.data?.results || [];
  const columns = [
    { key: "date", label: "Date", sortValue: (row) => row.sort_at || row.date },
    { key: "type", label: "Type" },
    { key: "property", label: "Property" },
    { key: "party", label: "Tenant / Party" },
    { key: "description", label: "Reference" },
    { key: "inflow", label: "In", render: (row) => formatCurrency(row.inflow) },
    { key: "outflow", label: "Out", render: (row) => formatCurrency(row.outflow) },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  ];

  return (
    <>
      <PageHeader title="Transactions" description="One money ledger for rent payments, claims, cash, utilities, and expenses." />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total In" value={formatCurrency(ledger.data?.total_in)} detail="Confirmed inflows" tone="brand" />
        <StatCard label="Total Out" value={formatCurrency(ledger.data?.total_out)} detail="Recorded expenses" tone="amber" />
        <StatCard label="Net" value={formatCurrency(ledger.data?.net)} detail="In minus out" />
      </div>
      {ledger.isLoading ? <p className="text-sm text-slate-500">Loading transactions...</p> : null}
      {ledger.error ? <p className="text-sm text-red-600">Could not load transactions.</p> : null}
      {!ledger.isLoading && !ledger.error ? <DataTable columns={columns} rows={rows} emptyMessage="No transactions yet." sortBy="date" sortDirection="desc" /> : null}
    </>
  );
}
