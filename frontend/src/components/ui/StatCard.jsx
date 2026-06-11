const toneClasses = {
  default: "border-slate-200 bg-white",
  brand: "border-brand-100 bg-brand-50",
  amber: "border-amber-200 bg-amber-50",
  rose: "border-rose-200 bg-rose-50",
  sky: "border-sky-200 bg-sky-50",
};

export function StatCard({ label, value, detail, tone = "default", meta }) {
  return (
    <div className={`rounded-md border p-4 shadow-sm ${toneClasses[tone] || toneClasses.default}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-slate-600">{label}</div>
        {meta ? <div className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-brand-700 shadow-sm">{meta}</div> : null}
      </div>
      <div className="mt-2 text-3xl font-bold text-slate-950">{value}</div>
      {detail ? <div className="mt-2 text-sm text-slate-500">{detail}</div> : null}
    </div>
  );
}
