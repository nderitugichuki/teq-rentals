import { useMemo, useState } from "react";

import { TextInput } from "./TextInput.jsx";
import { formatCurrency } from "../../lib/formatCurrency.js";

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

export function LeaseSearchInput({ label = "Lease", leases, value, onChange, placeholder = "Search by tenant, phone, unit, or property", required = false }) {
  const [query, setQuery] = useState("");
  const selectedLease = leases.find((lease) => String(lease.id) === String(value));
  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return [];
    return leases
      .filter((lease) => {
        const haystack = [
          lease.tenant_name,
          lease.tenant_phone,
          lease.unit_label,
          lease.property_name,
          lease.rent_amount,
          lease.status,
        ].map(normalize).join(" ");
        return haystack.includes(term);
      })
      .slice(0, 8);
  }, [query, leases]);

  function selectLease(lease) {
    onChange(String(lease.id));
    setQuery("");
  }

  return (
    <div className="relative">
      <TextInput
        label={label}
        placeholder={selectedLease ? `${selectedLease.tenant_name} - ${selectedLease.unit_label}` : placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        required={required && !value}
      />
      {selectedLease ? (
        <div className="mt-1 flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">
          <span>{selectedLease.tenant_name} - {selectedLease.unit_label} - {formatCurrency(selectedLease.rent_amount)}</span>
          <button className="text-brand-700 underline" type="button" onClick={() => onChange("")}>Change</button>
        </div>
      ) : null}
      {query.trim() ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {results.length ? results.map((lease) => (
            <button
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-brand-50"
              key={lease.id}
              type="button"
              onClick={() => selectLease(lease)}
            >
              <span className="font-semibold text-slate-950">{lease.tenant_name}</span>
              <span className="ml-2 text-xs text-slate-500">{lease.unit_label} - {formatCurrency(lease.rent_amount)}</span>
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-slate-500">No lease found.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
