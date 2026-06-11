export function Button({ className = "", variant = "primary", ...props }) {
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  };

  return (
    <button
      type={props.type || "button"}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
