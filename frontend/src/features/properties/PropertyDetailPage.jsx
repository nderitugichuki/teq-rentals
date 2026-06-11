import { Link, useParams } from "react-router-dom";

import { DataTable } from "../../components/ui/DataTable.jsx";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { StatCard } from "../../components/ui/StatCard.jsx";
import { ChartPanel, MiniBarChart, ProgressBar, moneyFormatter } from "../../components/ui/Visuals.jsx";
import { useReport } from "../../hooks/useReport.js";
import { formatCurrency } from "../../lib/formatCurrency.js";

export function PropertyDetailPage() {
  const { propertyId } = useParams();
  const report = useReport(`/reports/property-detail/?property=${propertyId}`);
  const data = report.data;
  const summary = data?.summary || {};

  const unitColumns = [
    { key: "unit_number", label: "Unit" },
    { key: "unit_type", label: "Type" },
    { key: "floor", label: "Floor" },
    { key: "rent_amount", label: "Rent", render: (row) => formatCurrency(row.rent_amount) },
    { key: "status", label: "Status" },
  ];

  const tenantColumns = [
    { key: "name", label: "Tenant" },
    { key: "unit", label: "Unit" },
    { key: "phone_number", label: "Phone" },
    { key: "status", label: "Status" },
  ];

  return (
    <>
      <div className="mb-4">
        <Link className="text-sm font-semibold text-brand-700 hover:underline" to="/properties">Back to properties</Link>
      </div>
      <PageHeader
        title={data?.property?.name || "Property Detail"}
        description={data?.property ? `${data.property.address}, ${data.property.town}, ${data.property.county}` : "One-building view for units, tenants, collections, arrears, and maintenance."}
      />

      {report.isLoading ? <p className="text-sm text-slate-500">Loading property detail...</p> : null}
      {report.error ? <p className="text-sm text-red-600">{report.error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Units" value={summary.total_units || 0} detail={`${summary.occupied_units || 0} occupied`} />
            <StatCard label="Vacant" value={summary.vacant_units || 0} detail="Available units" />
            <StatCard label="Collected" value={formatCurrency(summary.collected)} detail={`Expected ${formatCurrency(summary.expected)}`} />
            <StatCard label="Arrears" value={formatCurrency(summary.arrears)} detail={`${summary.open_maintenance || 0} open maintenance`} />
          </div>

          <div className="my-6 grid gap-4 xl:grid-cols-2">
            <ChartPanel title="Collection Rate" description="Confirmed collections against expected rent.">
              <ProgressBar label="Collected" value={Number(summary.collected || 0)} total={Number(summary.expected || 0)} />
            </ChartPanel>
            <ChartPanel title="Unit Types" description="Units grouped by category.">
              {(data.unit_type_summary || []).length ? (
                <MiniBarChart rows={data.unit_type_summary.map((row) => ({ ...row, id: row.unit_type }))} labelKey="unit_type" valueKey="total" />
              ) : (
                <p className="text-sm text-slate-500">No unit type data yet.</p>
              )}
            </ChartPanel>
          </div>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-slate-950">Units</h2>
            <DataTable columns={unitColumns} rows={data.units || []} emptyMessage="No units for this property yet." sortBy="unit_number" />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-slate-950">Tenants</h2>
            <DataTable columns={tenantColumns} rows={data.tenants || []} emptyMessage="No tenants for this property yet." sortBy="unit" />
          </section>
        </>
      ) : null}
    </>
  );
}
