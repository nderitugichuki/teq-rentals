import { formatCurrency } from "../../lib/formatCurrency.js";

export function ProgressBar({ label, value, total, tone = "brand" }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const color = tone === "danger" ? "bg-red-500" : tone === "warning" ? "bg-amber-500" : "bg-brand-600";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">{percent}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function MiniBarChart({ rows, valueKey, labelKey, formatter = (value) => value }) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        const percent = Math.max(4, Math.round((value / max) * 100));
        return (
          <div key={row.id || row[labelKey]}>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{row[labelKey]}</span>
              <span>{formatter(value)}</span>
            </div>
            <div className="h-7 overflow-hidden rounded-md bg-slate-100">
              <div className="flex h-full items-center rounded-md bg-brand-600 px-2 text-xs font-bold text-white" style={{ width: `${percent}%` }}>
                {percent > 18 ? formatter(value) : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const segmentColors = ["#0f7a4f", "#f59e0b", "#ef4444", "#64748b", "#14b8a6"];

export function DonutChart({ rows, valueKey, labelKey, formatter = (value) => value }) {
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  let cursor = 0;
  const gradient = total
    ? rows.map((row, index) => {
      const value = Number(row[valueKey] || 0);
      const start = cursor;
      const end = cursor + (value / total) * 100;
      cursor = end;
      return `${segmentColors[index % segmentColors.length]} ${start}% ${end}%`;
    }).join(", ")
    : "#e2e8f0 0% 100%";

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div
        className="grid h-44 w-44 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${gradient})` }}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center shadow-inner">
          <div>
            <div className="text-2xl font-black text-slate-950">{formatter(total)}</div>
            <div className="text-xs font-semibold text-slate-500">Total</div>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {rows.map((row, index) => (
          <div key={row.id || row[labelKey]} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segmentColors[index % segmentColors.length] }} />
              <span className="truncate font-semibold capitalize text-slate-700">{String(row[labelKey]).replaceAll("_", " ")}</span>
            </div>
            <span className="font-bold text-slate-950">{formatter(Number(row[valueKey] || 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ rows, valueKey, labelKey, formatter = (value) => value }) {
  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 22, bottom: 34, left: 70 };
  const rawMax = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 0);
  const step = rawMax <= 50000 ? 5000 : rawMax <= 200000 ? 25000 : 50000;
  const max = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => index * step);
  const points = rows.map((row, index) => {
    const x = rows.length > 1 ? padding.left + (index / (rows.length - 1)) * (width - padding.left - padding.right) : width / 2;
    const y = height - padding.bottom - (Number(row[valueKey] || 0) / max) * (height - padding.top - padding.bottom);
    return { ...row, x, y, value: Number(row[valueKey] || 0) };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding.left},${height - padding.bottom} ${line} ${width - padding.right},${height - padding.bottom}`;

  return (
    <div className="overflow-hidden">
      <svg className="h-56 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart">
        <defs>
          <linearGradient id="lineChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = height - padding.bottom - (tick / max) * (height - padding.top - padding.bottom);
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text fill="#64748b" fontSize="11" fontWeight="700" textAnchor="end" x={padding.left - 8} y={y + 4}>
                {tick.toLocaleString("en-KE")}
              </text>
            </g>
          );
        })}
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} stroke="#94a3b8" strokeWidth="1.5" />
        <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} stroke="#94a3b8" strokeWidth="1.5" />
        <polygon fill="url(#lineChartFill)" points={area} />
        {line ? <polyline fill="none" points={line} stroke="#16a34a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" /> : null}
        {points.map((point) => (
          <g key={point.id || point[labelKey]}>
            <circle cx={point.x} cy={point.y} fill="#ffffff" r="6" stroke="#16a34a" strokeWidth="3" />
            <text fill="#475569" fontSize="12" fontWeight="700" textAnchor="middle" x={point.x} y={height - 8}>
              {point[labelKey]}
            </text>
          </g>
        ))}
      </svg>
      <div className="grid gap-2 sm:grid-cols-3">
        {points.map((point) => (
          <div key={point.id || point[labelKey]} className="rounded-md bg-slate-50 px-3 py-2">
            <div className="text-xs font-semibold text-slate-500">{point[labelKey]}</div>
            <div className="text-sm font-black text-slate-950">{formatter(point.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartPanel({ title, description, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function moneyFormatter(value) {
  return formatCurrency(value);
}
