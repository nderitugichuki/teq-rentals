const styles = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  verified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  partial: "bg-amber-50 text-amber-700 ring-amber-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  pending_handover: "bg-amber-50 text-amber-700 ring-amber-200",
  handed_over: "bg-blue-50 text-blue-700 ring-blue-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  unpaid: "bg-slate-100 text-slate-700 ring-slate-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ value }) {
  const label = String(value || "-").replace(/_/g, " ");
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ring-1 ${styles[value] || styles.unpaid}`}>
      {label}
    </span>
  );
}
