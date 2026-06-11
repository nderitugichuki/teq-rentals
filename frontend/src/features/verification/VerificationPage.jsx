import { useState } from "react";

import { postAction } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { StatusBadge } from "../../components/ui/StatusBadge.jsx";
import { TextArea } from "../../components/ui/TextArea.jsx";
import { useResourceList } from "../../hooks/useResourceList.js";
import { formatCurrency } from "../../lib/formatCurrency.js";
import { useAuth } from "../auth/AuthContext.jsx";

function ActionPanel({ label, value, onChange }) {
  return (
    <div className="mb-5 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <TextArea
        label={label}
        placeholder="Optional for approval, required for rejection"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function VerificationPage() {
  const { user } = useAuth();
  const claims = useResourceList("/payment-claims/");
  const collections = useResourceList("/cash-collections/");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function runAction(path, successMessage) {
    setMessage("");
    setIsWorking(true);
    try {
      await postAction(path, { verification_notes: notes });
      claims.refetch();
      collections.refetch();
      setNotes("");
      setMessage(successMessage);
    } catch {
      setMessage("Action failed. Confirm you have landlord access and notes are present when rejecting.");
    } finally {
      setIsWorking(false);
    }
  }

  const pendingClaims = claims.rows.filter((claim) => claim.status === "pending");
  const pendingCollections = collections.rows.filter((collection) => ["pending_handover", "handed_over"].includes(collection.status));
  const canVerify = ["admin", "landlord"].includes(user?.role_name);

  if (!canVerify) {
    return (
      <>
        <PageHeader title="Verification" description="Payment verification is handled by the landlord." />
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Caretakers can submit payment claims and cash collections, but cannot verify or approve them.
        </div>
      </>
    );
  }

  const claimColumns = [
    { key: "tenant_name", label: "Tenant" },
    { key: "amount_claimed", label: "Amount", render: (row) => formatCurrency(row.amount_claimed) },
    { key: "payment_method", label: "Method" },
    { key: "confirmation_code", label: "Code" },
    { key: "claimed_payment_date", label: "Payment Date" },
    { key: "created_at", label: "Submitted", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button disabled={isWorking} onClick={() => runAction(`/payment-claims/${row.id}/verify/`, "Payment claim verified.")}>
            Verify
          </Button>
          <Button
            variant="secondary"
            disabled={isWorking}
            onClick={() => runAction(`/payment-claims/${row.id}/reject/`, "Payment claim rejected.")}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ];

  const collectionColumns = [
    { key: "tenant_name", label: "Tenant" },
    { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
    { key: "provisional_receipt_number", label: "Receipt" },
    { key: "collection_date", label: "Date" },
    { key: "created_at", label: "Submitted", render: (row) => new Date(row.created_at).toLocaleString() },
    { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button disabled={isWorking} onClick={() => runAction(`/cash-collections/${row.id}/confirm/`, "Cash collection confirmed.")}>
            Confirm
          </Button>
          <Button
            variant="secondary"
            disabled={isWorking}
            onClick={() => runAction(`/cash-collections/${row.id}/reject/`, "Cash collection rejected.")}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Verification"
        description="Landlords verify caretaker payment claims and cash collections before they become official payments."
      />
      <ActionPanel label="Verification notes" value={notes} onChange={setNotes} />
      {message ? <p className="mb-4 text-sm text-slate-600">{message}</p> : null}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Pending Payment Claims</h2>
        <DataTable columns={claimColumns} rows={pendingClaims} emptyMessage="No pending payment claims." sortBy="created_at" sortDirection="desc" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-950">Pending Cash Collections</h2>
        <DataTable columns={collectionColumns} rows={pendingCollections} emptyMessage="No pending cash collections." sortBy="created_at" sortDirection="desc" />
      </section>
    </>
  );
}
