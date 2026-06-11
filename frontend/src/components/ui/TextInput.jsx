export function TextInput({ label, id, className = "", uppercase, onChange, ...props }) {
  const inputId = id || props.name || label.toLowerCase().replace(/\s+/g, "-");
  const inputType = props.type || "text";
  const shouldUppercase =
    uppercase ??
    (!["date", "datetime-local", "email", "month", "number", "password", "search", "time", "url"].includes(inputType) &&
      !/email|password/i.test(label));

  function handleChange(event) {
    if (!shouldUppercase || typeof event.target.value !== "string") {
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
      <input
        id={inputId}
        className={`mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 ${shouldUppercase ? "uppercase" : ""} ${className}`}
        {...props}
        onChange={handleChange}
      />
    </label>
  );
}
