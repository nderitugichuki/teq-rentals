import { useState } from "react";

import { getCurrentUser } from "../../api/auth.js";
import { updateResource } from "../../api/resources.js";
import { Button } from "../../components/ui/Button.jsx";
import { FormMessage } from "../../components/ui/FormMessage.jsx";
import { FormPanel } from "../../components/ui/FormPanel.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

const featureFields = [
  ["enable_maintenance", "Maintenance"],
  ["enable_cash_collections", "Cash Collections"],
  ["enable_payment_claims", "Payment Claims"],
  ["enable_sms", "SMS Notifications"],
  ["enable_late_fees", "Late Fees"],
  ["enable_expenses", "Expenses"],
  ["enable_utilities", "Utilities"],
  ["enable_tenant_portal", "Tenant Portal"],
];

export function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({
    enable_maintenance: user?.account_features?.maintenance ?? true,
    enable_cash_collections: user?.account_features?.cash_collections ?? true,
    enable_payment_claims: user?.account_features?.payment_claims ?? true,
    enable_sms: user?.account_features?.sms ?? false,
    enable_late_fees: user?.account_features?.late_fees ?? true,
    enable_expenses: user?.account_features?.expenses ?? true,
    enable_utilities: user?.account_features?.utilities ?? true,
    enable_tenant_portal: user?.account_features?.tenant_portal ?? false,
  }));
  const [message, setMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  function updateField(field) {
    setForm((current) => ({ ...current, [field]: !current[field] }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await updateResource(`/accounts/${user.account}/`, form);
      await getCurrentUser();
      setMessage({ type: "success", text: "Feature settings saved. Sign out and back in to refresh the sidebar." });
    } catch {
      setMessage({ type: "error", text: "Could not save account settings." });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Turn modules on or off for this landlord account without affecting other landlords." />
      <FormPanel title="Account features" description="Disabled modules are hidden from this account's sidebar and can be enforced in workflows.">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            {featureFields.map(([field, label]) => (
              <label key={field} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3">
                <span className="font-semibold text-slate-800">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(form[field])}
                  onChange={() => updateField(field)}
                  className="h-5 w-5 rounded border-slate-300 text-brand-600"
                />
              </label>
            ))}
          </div>
          <FormMessage message={message} />
          <Button type="submit" className="mt-4" disabled={isSaving}>{isSaving ? "Saving..." : "Save settings"}</Button>
        </form>
      </FormPanel>
    </>
  );
}
