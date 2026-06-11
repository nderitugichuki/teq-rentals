import { useMemo, useState } from "react";

import { TextInput } from "./TextInput.jsx";

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

export function TenantSearchInput({ label = "Tenant", tenants, value, onChange, placeholder = "Search by name, phone, or unit", required = false }) {
  const [query, setQuery] = useState("");
  const selectedTenant = tenants.find((tenant) => String(tenant.id) === String(value));
  const results = useMemo(() => {
    const term = normalize(query);
    if (!term) return [];
    return tenants
      .filter((tenant) => {
        const haystack = [
          tenant.full_name,
          tenant.first_name,
          tenant.last_name,
          tenant.phone_number,
          tenant.unit_label,
          tenant.emergency_contact_phone,
        ].map(normalize).join(" ");
        return haystack.includes(term);
      })
      .slice(0, 8);
  }, [query, tenants]);

  function selectTenant(tenant) {
    onChange(String(tenant.id));
    setQuery("");
  }

  return (
    <div className="relative">
      <TextInput
        label={label}
        placeholder={selectedTenant ? selectedTenant.full_name : placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        required={required && !value}
      />
      {selectedTenant ? (
        <div className="mt-1 flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">
          <span>{selectedTenant.full_name} {selectedTenant.phone_number ? `- ${selectedTenant.phone_number}` : ""}</span>
          <button className="text-brand-700 underline" type="button" onClick={() => onChange("")}>Change</button>
        </div>
      ) : null}
      {query.trim() ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {results.length ? results.map((tenant) => (
            <button
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-brand-50"
              key={tenant.id}
              type="button"
              onClick={() => selectTenant(tenant)}
            >
              <span className="font-semibold text-slate-950">{tenant.full_name}</span>
              <span className="ml-2 text-xs text-slate-500">{tenant.phone_number || "NO PHONE"}</span>
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-slate-500">No tenant found.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
