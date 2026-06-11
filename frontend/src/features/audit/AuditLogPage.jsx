import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";

export function AuditLogPage() {
  const { rows, isLoading, error } = useResourceList("/audit-logs/");
  const columns = [
    { key: "created_at", label: "Date", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "actor_email", label: "Actor" },
    { key: "action", label: "Action" },
    { key: "entity_type", label: "Record" },
    { key: "summary", label: "Summary" },
  ];

  return (
    <>
      <PageHeader title="Audit Log" description="Track important account actions for security and accountability." />
      {isLoading ? <p className="text-sm text-slate-500">Loading audit log...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!isLoading && !error ? <DataTable columns={columns} rows={rows} emptyMessage="No audit entries yet." sortBy="created_at" sortDirection="desc" /> : null}
    </>
  );
}
