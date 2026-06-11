export function TextArea({ label, id, className = "", uppercase = true, onChange, ...props }) {
  const inputId = id || props.name || label.toLowerCase().replace(/\s+/g, "-");

  function handleChange(event) {
    if (!uppercase || typeof event.target.value !== "string") {
      onChange?.(event);
      return;
    }

    const upperValue = event.target.value.toUpperCase();
    if (event.target.value !== upperValue) {
      event.target.value = upperValue;
    }
    onChange?.(event);
  }

  return (
    <label className="block" htmlFor={inputId}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <textarea
        id={inputId}
        className={`mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 ${uppercase ? "uppercase" : ""} ${className}`}
        {...props}
        onChange={handleChange}
      />
    </label>
  );
}
