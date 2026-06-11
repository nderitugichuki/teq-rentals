import { postAction } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";

export function NotificationsPage() {
  const { rows, isLoading, error, refetch } = useResourceList("/notifications/");

  async function markRead(notificationId) {
    try {
      await postAction(`/notifications/${notificationId}/mark_read/`);
      refetch();
    } catch {
    }
  }

  const columns = [
    { key: "title", label: "Title" },
    { key: "tenant_name", label: "Tenant" },
    { key: "notification_type", label: "Type" },
    { key: "message", label: "Message" },
    { key: "is_read", label: "Read", render: (row) => <StatusBadge value={row.is_read ? "read" : "unread"} /> },
    { key: "created_at", label: "Created", render: (row) => new Date(row.created_at).toLocaleString() },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (row) => row.is_read ? null : <Button type="button" variant="secondary" onClick={() => markRead(row.id)}>Mark read</Button>,
    },
  ];

  return (
    <>
      <PageHeader title="Notifications" description="Internal system alerts for approvals, caretaker feedback, maintenance updates, and occupancy changes." />
      {isLoading ? <p className="text-sm text-slate-500">Loading notifications...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!isLoading && !error ? <DataTable columns={columns} rows={rows} emptyMessage="No notifications yet." sortBy="created_at" sortDirection="desc" /> : null}
    </>
  );
}
