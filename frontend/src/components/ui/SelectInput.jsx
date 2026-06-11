export function SelectInput({ label, id, children, className = "", ...props }) {
  const inputId = id || props.name || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        id={inputId}
        className={`mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

